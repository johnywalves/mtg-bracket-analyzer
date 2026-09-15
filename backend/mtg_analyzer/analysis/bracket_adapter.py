"""Bridge the existing decklist/resolve pipeline into the Bracket Engine's own lightweight
domain model (`models/assessment.py`).

The Bracket Engine (docs/spec/bracket-engine.md) defines its own minimal `Card`/`Deck` so the
engine stays independent of the richer `models/card.py` (which carries the full Scryfall payload).
This module is the only place that knows about both — everything downstream of `to_assessment_deck`
only ever sees the lightweight model.
"""

from __future__ import annotations

from typing import Literal

from mtg_analyzer.models.assessment import Card as AssessmentCard
from mtg_analyzer.models.assessment import Deck, DeckCard, DeckSource
from mtg_analyzer.models.card import Card
from mtg_analyzer.models.deck import ResolvedDeck, ResolvedEntry


def _to_assessment_card(card: Card) -> AssessmentCard:
    return AssessmentCard(
        name=card.name,
        oracle_id=card.oracle_id or card.id,
        mana_cost=card.get_mana_cost() or None,
        mana_value=card.cmc,
        type_line=card.type_line or "",
        oracle_text=card.get_oracle_text(),
        colors=card.colors,
        color_identity=card.color_identity,
    )


def _to_deck_card(entry: ResolvedEntry) -> DeckCard:
    assert entry.card is not None
    return DeckCard(
        card=_to_assessment_card(entry.card),
        quantity=entry.quantity,
        category=entry.category,
        is_commander=entry.section == "commander",
        is_companion=entry.section == "companion",
    )


def to_assessment_deck(
    resolved: ResolvedDeck, *, source_type: Literal["moxfield", "text", "manual"] = "text"
) -> tuple[Deck, list[str]]:
    """Convert a `ResolvedDeck` (ingest/resolve.py) into the Bracket Engine's `Deck`.

    Unresolved entries can't be classified (no `oracle_id`/text to check), so they're excluded from
    the `Deck` and returned as `unresolved_names` for the caller to surface as a warning — per
    docs/spec/bracket-engine.md §8 ("Unresolved cards MUST be reported").
    """
    unresolved = [e.requested_name for e in resolved.entries if not e.resolved]

    commander = [_to_deck_card(e) for e in resolved.entries if e.resolved and e.section == "commander"]
    main = [_to_deck_card(e) for e in resolved.entries if e.resolved and e.section == "main"]
    companion_entries = [e for e in resolved.entries if e.resolved and e.section == "companion"]
    companion = _to_deck_card(companion_entries[0]) if companion_entries else None

    deck = Deck(
        name=resolved.name,
        commander=commander,
        cards=main,
        companion=companion,
        source=DeckSource(type=source_type),
    )
    return deck, unresolved
