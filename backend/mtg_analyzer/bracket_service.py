"""Orchestration facade for the Bracket Engine track (docs/spec/bracket-engine.md).

Kept separate from `service.AnalyzerService` deliberately: this repo tracks an `upstream` remote
(QuackQuackLabs/MTG-Analyzer) and `service.py` is currently identical to it — this module is a
fork-only addition that owns the decklist → `BracketAssessment` wiring without touching upstream-
shared files, so future upstream merges stay clean. It reuses upstream's own pure engine pieces
(`ingest.decklist.parse_deck`, `ingest.resolve.resolve_deck`, `data.db.CardDatabase`) rather than
duplicating them — only the bracket-specific pieces (adapter, engine, ruleset, report) are new.
"""

from __future__ import annotations

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
from mtg_analyzer.data.db import CardDatabase
from mtg_analyzer.ingest.decklist import parse_deck
from mtg_analyzer.ingest.resolve import resolve_deck
from mtg_analyzer.models.assessment import BracketAssessment
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
                 ruleset: Ruleset | None = None) -> None:
        # A caller-supplied `db` is used as-is (assumed single-threaded use — a script/CLI, or a
        # test that never crosses threads) and is never closed by this service. Otherwise, since
        # sqlite3 connections are bound to the thread that opened them and FastAPI's sync routes
        # each run in a threadpool worker thread (not necessarily the same one across calls, or
        # the same as the lifespan/shutdown thread), a fresh connection is opened per call and
        # closed immediately after — see `_open_db`.
        self._db = db
        self._db_path = db_path
        self._ruleset = ruleset
        self.notes: list[str] = []

    def _open_db(self) -> CardDatabase:
        """A connection scoped to the current call/thread — see `__init__`'s note on why a shared,
        cached connection isn't safe across FastAPI's threadpool."""
        if self._db is not None:
            return self._db
        return CardDatabase(self._db_path)

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
        the local card DB) → adapt to the engine's own `Deck` model → `BracketEngine.analyze` →
        render. Unresolved cards are reported, never silently dropped."""
        parsed = parse_deck(decklist_text)
        db = self._open_db()
        try:
            resolved = resolve_deck(db, parsed)
        finally:
            if self._db is None:  # only close connections this call opened itself
                db.close()
        resolved.name = name

        deck, unresolved = to_assessment_deck(resolved)
        if unresolved:
            self.notes.append(
                f"Bracket analysis: {len(unresolved)} card(s) could not be resolved and were "
                "excluded from the assessment.")

        context = AnalysisContext(ruleset=self.ruleset, data_version="local")
        assessment = BracketEngine(context).analyze(deck)
        markdown = render_markdown(assessment, deck, unresolved)
        return BracketReport(deck=resolved, assessment=assessment, unresolved=unresolved,
                             markdown=markdown)
