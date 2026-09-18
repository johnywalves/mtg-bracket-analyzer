"""Tests for BracketService's live Scryfall backfill (`_live_fill_unresolved`) — cards missing from
the local bulk snapshot get fetched live, upserted into the DB (offline-deterministic next run per
docs/spec/bracket-engine.md), and filled onto the matching entries. Network failure degrades
gracefully: entries just stay unresolved, same as before this step existed."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Self

import pytest
from mtg_analyzer.bracket_service import BracketService
from mtg_analyzer.data.db import CardDatabase
from mtg_analyzer.models.card import Card
from mtg_analyzer.models.deck import ResolvedDeck, ResolvedEntry


def make_card(name: str, **kw: Any) -> Card:
    base = {"id": name, "oracle_id": name, "name": name, "layout": "normal", "cmc": 1.0,
            "type_line": "Artifact", "color_identity": [], "legalities": {"commander": "legal"}}
    base.update(kw)
    return Card.model_validate(base)


def unresolved_entry(name: str) -> ResolvedEntry:
    return ResolvedEntry(quantity=1, section="main", requested_name=name, card=None)


class _FakeScryfallClient:
    """Stands in for `ScryfallClient` — no network, just echoes back what the test wired up."""

    def __init__(self, cards: list[Card] | None = None, *, error: Exception | None = None,
                 pt_hits: dict[str, list[Card]] | None = None,
                 fuzzy_hits: dict[str, Card] | None = None) -> None:
        self._cards = cards or []
        self._error = error
        # name (as passed to search()/named()) -> canned result, for Phase D's extended tail.
        self._pt_hits = pt_hits or {}
        self._fuzzy_hits = fuzzy_hits or {}

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def collection(self, identifiers: list[dict]) -> tuple[list[Card], list[dict]]:
        if self._error is not None:
            raise self._error
        wanted = {ident["name"].lower() for ident in identifiers}
        # Real Scryfall /cards/collection matches a DFC by its front-face name too, not
        # just the full "Front // Back" string — mirror that here.
        found = [
            c for c in self._cards
            if c.name.lower() in wanted or c.name.split(" // ")[0].lower() in wanted
        ]
        not_found = [ident for ident in identifiers if ident["name"].lower()
                     not in {c.name.lower() for c in found}
                     and ident["name"].lower() not in
                     {c.name.split(" // ")[0].lower() for c in found}]
        return found, not_found

    async def named(self, *, exact: str | None = None, fuzzy: str | None = None,
                     set_code: str | None = None) -> Card | None:
        return self._fuzzy_hits.get((exact or fuzzy or "").lower())

    async def search(self, query: str, *, order: str = "name", unique: str = "cards") -> list[Card]:
        # Tests key `pt_hits` by the bare name they expect resolve_card_live to search for.
        for name, results in self._pt_hits.items():
            if f'"{name}"' in query:
                return results
        return []


def test_live_fill_resolves_and_upserts(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = CardDatabase(tmp_path / "test.db")
    try:
        sol_ring = make_card("Sol Ring")
        monkeypatch.setattr(
            "mtg_analyzer.bracket_service.ScryfallClient",
            lambda *a, **kw: _FakeScryfallClient([sol_ring]),
        )
        svc = BracketService(db=db)
        deck = ResolvedDeck(entries=[unresolved_entry("Sol Ring")])

        svc._live_fill_unresolved(db, deck)

        assert deck.entries[0].resolved
        assert deck.entries[0].card.name == "Sol Ring"
        assert db.get_by_name("Sol Ring") is not None  # self-healed the local DB
        assert any("Filled 1 card" in n for n in svc.notes)
    finally:
        db.close()


def test_live_fill_retries_front_face_for_slash_joined_dfc_name(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # User typed the DFC name with a single "/" (not Scryfall's " // " join); the batch
    # collection call misses on the full string, so a front-face-only retry must catch it.
    db = CardDatabase(tmp_path / "test.db")
    try:
        goldbug = make_card(
            "Goldbug, Humanity's Ally // Goldbug, Scrappy Scout",
            layout="transform",
        )
        monkeypatch.setattr(
            "mtg_analyzer.bracket_service.ScryfallClient",
            lambda *a, **kw: _FakeScryfallClient([goldbug]),
        )
        svc = BracketService(db=db)
        deck = ResolvedDeck(entries=[
            unresolved_entry("Goldbug, Humanity's Ally / Goldbug, Scrappy Scout"),
        ])

        svc._live_fill_unresolved(db, deck)

        assert deck.entries[0].resolved
        assert deck.entries[0].card.name == "Goldbug, Humanity's Ally // Goldbug, Scrappy Scout"
    finally:
        db.close()


def test_live_fill_still_missing_name_stays_unresolved(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = CardDatabase(tmp_path / "test.db")
    try:
        monkeypatch.setattr(
            "mtg_analyzer.bracket_service.ScryfallClient",
            lambda *a, **kw: _FakeScryfallClient([]),  # Scryfall doesn't know it either
        )
        svc = BracketService(db=db)
        deck = ResolvedDeck(entries=[unresolved_entry("Not A Real Card")])

        svc._live_fill_unresolved(db, deck)

        assert not deck.entries[0].resolved
        assert db.get_by_name("Not A Real Card") is None
        assert not any("Filled" in n for n in svc.notes)
    finally:
        db.close()


def test_live_fill_network_failure_is_graceful(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = CardDatabase(tmp_path / "test.db")
    try:
        monkeypatch.setattr(
            "mtg_analyzer.bracket_service.ScryfallClient",
            lambda *a, **kw: _FakeScryfallClient(error=ConnectionError("offline")),
        )
        svc = BracketService(db=db)
        deck = ResolvedDeck(entries=[unresolved_entry("Sol Ring")])

        svc._live_fill_unresolved(db, deck)  # must not raise

        assert not deck.entries[0].resolved
        assert any("backfill unavailable" in n for n in svc.notes)
    finally:
        db.close()


def test_live_fill_resolves_via_live_pt_search_and_caches(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Batch /cards/collection has no idea what "Anel Solar" is (that's a printed PT name,
    # not the oracle name it indexes on) — the individual extended-tail fallback's live
    # `lang:pt` search is what has to catch this.
    db = CardDatabase(tmp_path / "test.db")
    try:
        sol_ring = make_card("Sol Ring")
        monkeypatch.setattr(
            "mtg_analyzer.bracket_service.ScryfallClient",
            lambda *a, **kw: _FakeScryfallClient(pt_hits={"Anel Solar": [sol_ring]}),
        )
        svc = BracketService(db=db)
        deck = ResolvedDeck(entries=[unresolved_entry("Anel Solar")])

        svc._live_fill_unresolved(db, deck)

        assert deck.entries[0].resolved
        assert deck.entries[0].card.name == "Sol Ring"
        assert db.get_by_name("Sol Ring") is not None  # canonical card self-healed too
        assert db.get_localized_name("Anel Solar", lang="pt") == "Sol Ring"
        assert any("Filled 1 card" in n for n in svc.notes)
    finally:
        db.close()


def test_live_fill_ambiguous_pt_search_stays_unresolved_no_cache_write(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = CardDatabase(tmp_path / "test.db")
    try:
        monkeypatch.setattr(
            "mtg_analyzer.bracket_service.ScryfallClient",
            lambda *a, **kw: _FakeScryfallClient(
                pt_hits={"Carta Ambigua": [make_card("Card A"), make_card("Card B")]}),
        )
        svc = BracketService(db=db)
        deck = ResolvedDeck(entries=[unresolved_entry("Carta Ambigua")])

        svc._live_fill_unresolved(db, deck)

        assert not deck.entries[0].resolved
        assert db.get_localized_name("Carta Ambigua", lang="pt") is None
    finally:
        db.close()


def test_live_fill_individual_fallback_cap_notes_truncation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = CardDatabase(tmp_path / "test.db")
    try:
        monkeypatch.setattr("mtg_analyzer.bracket_service._MAX_INDIVIDUAL_LIVE_FALLBACKS", 1)
        monkeypatch.setattr(
            "mtg_analyzer.bracket_service.ScryfallClient",
            lambda *a, **kw: _FakeScryfallClient([]),
        )
        svc = BracketService(db=db)
        deck = ResolvedDeck(entries=[
            unresolved_entry("Not A Real Card One"),
            unresolved_entry("Not A Real Card Two"),
        ])

        svc._live_fill_unresolved(db, deck)

        assert any("skipped the individual live-resolution fallback" in n for n in svc.notes)
    finally:
        db.close()


def test_live_fill_skips_network_call_when_nothing_unresolved(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = CardDatabase(tmp_path / "test.db")
    try:
        def boom(*a: Any, **kw: Any) -> Any:
            raise AssertionError("ScryfallClient should not be constructed when nothing is unresolved")

        monkeypatch.setattr("mtg_analyzer.bracket_service.ScryfallClient", boom)
        svc = BracketService(db=db)
        deck = ResolvedDeck(entries=[
            ResolvedEntry(quantity=1, section="main", requested_name="Sol Ring", card=make_card("Sol Ring")),
        ])

        svc._live_fill_unresolved(db, deck)  # no unresolved entries → early return, no network

        assert svc.notes == []
    finally:
        db.close()


class _FakeComboClient:
    """Stands in for `CommanderSpellbookClient` — no network, just echoes back what the
    test wired up. `included=None` simulates a deck with no combos; raising on construction
    simulates network failure."""

    def __init__(self, included: list | None = None) -> None:
        self._included = included

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def find_my_combos(self, main, commanders=()):
        if self._included is None:
            raise ConnectionError("offline")
        from mtg_analyzer.combos.store import DeckCombos
        return DeckCombos(identity="", included=self._included, almost_included=[],
                          included_by_changing_commanders=[],
                          almost_included_by_adding_colors=[])


def _commander_decklist() -> str:
    return "1 Sol Ring\n1 Sol Ring, Dark Lord\n"


def test_analyze_decklist_populates_commanders(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = CardDatabase(tmp_path / "test.db")
    try:
        sol_ring = make_card("Sol Ring", oracle_id="or1", colors=[], color_identity=[])
        sauron = make_card("Sauron, the Dark Lord", oracle_id="or2",
                           colors=["U", "B", "R"], color_identity=["U", "B", "R"],
                           type_line="Legendary Creature")
        db.upsert_card(sol_ring)
        db.upsert_card(sauron)
        monkeypatch.setattr(
            "mtg_analyzer.bracket_service.CommanderSpellbookClient",
            lambda *a, **kw: _FakeComboClient(included=[]),
        )
        svc = BracketService(db=db)

        report = svc.analyze_decklist("1 Sauron, the Dark Lord\n1 Sol Ring\n")

        assert "Sauron, the Dark Lord" in report.assessment.commanders
    finally:
        db.close()


def test_analyze_decklist_combo_lookup_failure_is_graceful(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = CardDatabase(tmp_path / "test.db")
    try:
        sol_ring = make_card("Sol Ring", oracle_id="or1")
        db.upsert_card(sol_ring)
        monkeypatch.setattr(
            "mtg_analyzer.bracket_service.CommanderSpellbookClient",
            lambda *a, **kw: _FakeComboClient(included=None),  # raises on find_my_combos
        )
        svc = BracketService(db=db)

        report = svc.analyze_decklist("1 Sol Ring\n")  # must not raise

        assert report.assessment is not None
        assert any("combo lookup unavailable" in n for n in svc.notes)
    finally:
        db.close()
