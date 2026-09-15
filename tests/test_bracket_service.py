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

    def __init__(self, cards: list[Card] | None = None, *, error: Exception | None = None) -> None:
        self._cards = cards or []
        self._error = error

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def collection(self, identifiers: list[dict]) -> tuple[list[Card], list[dict]]:
        if self._error is not None:
            raise self._error
        wanted = {ident["name"].lower() for ident in identifiers}
        found = [c for c in self._cards if c.name.lower() in wanted]
        not_found = [ident for ident in identifiers if ident["name"].lower()
                     not in {c.name.lower() for c in found}]
        return found, not_found


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
