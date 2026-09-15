"""Orchestration facade for the Bracket Engine track (docs/spec/bracket-engine.md).

Kept separate from `service.AnalyzerService` deliberately: this repo tracks an `upstream` remote
(QuackQuackLabs/MTG-Analyzer) and `service.py` is currently identical to it — this module is a
fork-only addition that owns the decklist → `BracketAssessment` wiring without touching upstream-
shared files, so future upstream merges stay clean. It reuses upstream's own pure engine pieces
(`ingest.decklist.parse_deck`, `ingest.resolve.resolve_deck`, `data.db.CardDatabase`) rather than
duplicating them — only the bracket-specific pieces (adapter, engine, ruleset, report) are new.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Self

from mtg_analyzer.analysis.bracket_adapter import to_assessment_deck
from mtg_analyzer.analysis.bracket_report import render_markdown
from mtg_analyzer.analysis.engine import (
    AnalysisContext,
    BracketEngine,
    Ruleset,
    load_latest_ruleset,
)
from mtg_analyzer.combos.store import ComboStore
from mtg_analyzer.data.db import CardDatabase
from mtg_analyzer.data.scryfall_client import ScryfallClient
from mtg_analyzer.ingest.decklist import parse_deck
from mtg_analyzer.ingest.resolve import resolve_deck
from mtg_analyzer.models.assessment import BracketAssessment
from mtg_analyzer.models.card import Card
from mtg_analyzer.models.deck import ResolvedDeck


@dataclass
class BracketReport:
    """A decklist run through the Bracket Engine: the resolved deck, its assessment, any names that
    couldn't be resolved, and a rendered Markdown report."""
    deck: ResolvedDeck
    assessment: BracketAssessment
    unresolved: list[str]
    markdown: str


class BracketService:
    """Owns the card DB + ruleset lifecycle for the Bracket Engine. Construct one per process/request
    scope and reuse it — mirrors `AnalyzerService`'s lazy-resource pattern without depending on it."""

    def __init__(self, *, db: CardDatabase | None = None, db_path: Path | None = None,
                 ruleset: Ruleset | None = None, combo_db_path: Path | None = None) -> None:
        # A caller-supplied `db` is used as-is (assumed single-threaded use — a script/CLI, or a
        # test that never crosses threads) and is never closed by this service. Otherwise, since
        # sqlite3 connections are bound to the thread that opened them and FastAPI's sync routes
        # each run in a threadpool worker thread (not necessarily the same one across calls, or
        # the same as the lifespan/shutdown thread), a fresh connection is opened per call and
        # closed immediately after — see `_open_db`.
        self._db = db
        self._db_path = db_path
        self._ruleset = ruleset
        # `combo_db_path` defaults to `config.DB_PATH` inside `ComboStore` itself — same shared
        # `app.db` the card DB uses. A `ComboStore` is opened/closed per call, same thread-safety
        # rationale as `_open_db` above.
        self._combo_db_path = combo_db_path
        self.notes: list[str] = []

    def _live_fill_unresolved(self, db: CardDatabase, resolved: ResolvedDeck) -> None:
        """Best-effort: batch-fetch entries that missed the offline lookup from live Scryfall
        (`/cards/collection`, name-keyed — matches `resolve_card`'s own priority), upsert hits into
        `db` so the next run resolves offline too, and fill them onto the matching entries in place.

        Never raises — network absence/failure just leaves entries unresolved, same as before this
        step existed (the engine itself stays offline-only; only resolution touches the network).
        """
        unresolved = [e for e in resolved.entries if not e.resolved]
        if not unresolved:
            return

        async def run() -> tuple[list[Card], list[dict]]:
            async with ScryfallClient() as client:
                return await client.collection(
                    [{"name": e.requested_name} for e in unresolved]
                )

        try:
            found, _not_found = asyncio.run(run())
        except Exception as exc:  # noqa: BLE001 — network is best-effort; offline path still works
            self.notes.append(
                f"Live Scryfall backfill unavailable — {type(exc).__name__} "
                "(offline or rate-limited); skipped.")
            return

        by_name = {c.name.lower(): c for c in found}
        by_front = {c.name.split(" // ")[0].lower(): c for c in found}
        filled = 0
        for entry in unresolved:
            key = entry.requested_name.lower()
            card = by_name.get(key) or by_front.get(key)
            if card is None:
                continue
            db.upsert_card(card)
            entry.card = card
            filled += 1

        if filled:
            self.notes.append(
                f"Filled {filled} card(s) live from Scryfall (not yet in the local bulk snapshot).")

    def _open_db(self) -> CardDatabase:
        """A connection scoped to the current call/thread — see `__init__`'s note on why a shared,
        cached connection isn't safe across FastAPI's threadpool."""
        if self._db is not None:
            return self._db
        return CardDatabase(self._db_path)

    def _open_combo_store(self) -> ComboStore:
        """A connection scoped to the current call/thread — same rationale as `_open_db`. Always
        succeeds (creates an empty cache on first use), so the engine's `combo_store is None`
        branch is only exercised by callers/tests that build an `AnalysisContext` directly."""
        return ComboStore(self._combo_db_path)

    @property
    def ruleset(self) -> Ruleset:
        if self._ruleset is None:
            self._ruleset = load_latest_ruleset()
        return self._ruleset

    def close(self) -> None:
        pass  # no cached, cross-call connection to close — see `_open_db`

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def analyze_decklist(self, decklist_text: str, *, name: str | None = None) -> BracketReport:
        """Decklist text → `BracketAssessment` + Markdown report. Parse → resolve (offline, against
        the local card DB) → live-fill any remaining gaps from Scryfall → adapt to the engine's own
        `Deck` model → `BracketEngine.analyze` → render. Unresolved cards are reported, never
        silently dropped."""
        parsed = parse_deck(decklist_text)
        db = self._open_db()
        try:
            resolved = resolve_deck(db, parsed)
            self._live_fill_unresolved(db, resolved)
        finally:
            if self._db is None:  # only close connections this call opened itself
                db.close()
        resolved.name = name

        deck, unresolved = to_assessment_deck(resolved)
        if unresolved:
            self.notes.append(
                f"Bracket analysis: {len(unresolved)} card(s) could not be resolved and were "
                "excluded from the assessment.")

        combo_store = self._open_combo_store()
        try:
            context = AnalysisContext(ruleset=self.ruleset, data_version="local",
                                       combo_store=combo_store)
            assessment = BracketEngine(context).analyze(deck)
        finally:
            combo_store.close()
        markdown = render_markdown(assessment, deck, unresolved)
        return BracketReport(deck=resolved, assessment=assessment, unresolved=unresolved,
                             markdown=markdown)
