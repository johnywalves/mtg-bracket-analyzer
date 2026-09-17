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
from mtg_analyzer.ingest.resolve import front_face_name, resolve_card_live, resolve_deck
from mtg_analyzer.models.assessment import BracketAssessment
from mtg_analyzer.models.card import Card
from mtg_analyzer.models.deck import ResolvedDeck

# Cap on individual (non-batched) live-resolution fallback calls per analyze_decklist
# request — the batch /cards/collection pass above already handles the common case in one
# call; this only guards a pathological all-garbage decklist from making a request issue
# dozens of sequential live calls (each throttled ~100ms by ScryfallClient._request).
_MAX_INDIVIDUAL_LIVE_FALLBACKS = 20


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

        # For a "/"-joined DFC name (single slash, not Scryfall's own " // " join — e.g.
        # "Goldbug, Humanity's Ally / Goldbug, Scrappy Scout"), also request the front-face
        # segment as a second identifier in the same batch, since /cards/collection only
        # matches a card's exact name.
        identifiers = [{"name": e.requested_name} for e in unresolved]
        for e in unresolved:
            if front := front_face_name(e.requested_name):
                identifiers.append({"name": front})

        async def run() -> tuple[list[Card], list[dict], dict[str, Card | None], int]:
            async with ScryfallClient() as client:
                found, not_found = await client.collection(identifiers)
                # Batch pass done — anything still unresolved after it (e.g. a Portuguese
                # printed name, or a reskin/flavor name Scryfall's exact-name collection
                # lookup doesn't match) gets one more try each through the full extended
                # tail (local cache → live English fuzzy → live `lang:pt` search), capped
                # so a decklist full of garbage names can't turn into dozens of sequential
                # live calls on one request.
                by_name = {c.name.lower(): c for c in found}
                by_front = {c.name.split(" // ")[0].lower(): c for c in found}
                still_unresolved = []
                for entry in unresolved:
                    key = entry.requested_name.lower()
                    if key in by_name or key in by_front:
                        continue
                    if front := front_face_name(entry.requested_name):
                        if front.lower() in by_name or front.lower() in by_front:
                            continue
                    still_unresolved.append(entry)
                extended: dict[str, Card | None] = {}
                for entry in still_unresolved[:_MAX_INDIVIDUAL_LIVE_FALLBACKS]:
                    extended[entry.requested_name] = await resolve_card_live(
                        db, client, entry.requested_name)
                truncated = max(0, len(still_unresolved) - _MAX_INDIVIDUAL_LIVE_FALLBACKS)
                return found, not_found, extended, truncated

        try:
            found, _not_found, extended, truncated = asyncio.run(run())
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
                # Retry with just the front-face segment for a "/"-joined DFC name the
                # collection batch missed on the full string (e.g. "Goldbug, Humanity's
                # Ally / Goldbug, Scrappy Scout" — Scryfall only matches its own " // " join).
                if front := front_face_name(entry.requested_name):
                    card = by_name.get(front.lower()) or by_front.get(front.lower())
            if card is None:
                card = extended.get(entry.requested_name)
                if card is None:
                    continue
                # resolve_card_live already upserted the card (and cached any PT name hit)
                # itself — don't re-upsert here.
                entry.card = card
                filled += 1
                continue
            db.upsert_card(card)
            entry.card = card
            filled += 1

        if filled:
            self.notes.append(
                f"Filled {filled} card(s) live from Scryfall (not yet in the local bulk snapshot).")
        if truncated:
            self.notes.append(
                f"{truncated} more unresolved card(s) skipped the individual live-resolution "
                f"fallback (cap: {_MAX_INDIVIDUAL_LIVE_FALLBACKS} per request).")

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
