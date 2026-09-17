"""Resolve parsed decklist / inventory entries to local card identities.

Resolution priority (offline, against the local card DB):
  card name → Scryfall id → (set code + collector number).

Name first is deliberate: a card name maps uniquely to a gameplay identity (oracle_id),
which is all resolution needs — printing details (set/collector/foil/price) are stored
verbatim from the source. The bulk DB holds only ONE representative printing per card,
so an id / (set, collector) from an export usually misses, and when it *does* hit it can
match a *different* card's representative printing — so those are fallbacks for when the
name doesn't resolve, not the primary key. Unresolved entries are surfaced, not dropped.
"""

from __future__ import annotations

import re

from mtg_analyzer.data.db import CardDatabase
from mtg_analyzer.data.scryfall_client import ScryfallClient
from mtg_analyzer.models.card import Card
from mtg_analyzer.models.deck import ParsedDeck, ResolvedDeck, ResolvedEntry
from mtg_analyzer.models.inventory import Inventory, InventoryItem

# Users/exports sometimes type a DFC's two faces separated by a single "/" (with or
# without surrounding spaces) instead of Scryfall's own " // " join — e.g.
# "Goldbug, Humanity's Ally / Goldbug, Scrappy Scout". Splitting on the front segment
# lets that resolve against the existing front_name index without new indexing.
_SLASH_SPLIT_RE = re.compile(r"\s*/{1,2}\s*")


def front_face_name(name: str) -> str | None:
    """First segment of a `/`- or `//`-joined DFC name, or None if there's no split
    (or the front segment is too short to be meaningful)."""
    if "/" not in name:
        return None
    front = _SLASH_SPLIT_RE.split(name, maxsplit=1)[0].strip()
    return front if len(front) >= 2 else None


def resolve_card(
    db: CardDatabase,
    *,
    name: str,
    set_code: str | None = None,
    collector_number: str | None = None,
    scryfall_id: str | None = None,
) -> Card | None:
    if card := db.get_by_name(name):
        return card
    if front := front_face_name(name):
        if card := db.get_by_name(front):
            return card
    if card := db.get_by_flavor_name(name):
        return card
    if scryfall_id and (card := db.get_by_scryfall_id(scryfall_id)):
        return card
    if set_code and collector_number:
        return db.get_by_set_collector(set_code, collector_number)
    return None


def resolve_deck(db: CardDatabase, parsed: ParsedDeck) -> ResolvedDeck:
    entries = [
        ResolvedEntry(
            quantity=e.quantity,
            section=e.section,
            requested_name=e.name,
            category=e.category,
            card=resolve_card(db, name=e.name, set_code=e.set_code,
                              collector_number=e.collector_number),
        )
        for e in parsed.entries
    ]
    return ResolvedDeck(name=parsed.name, entries=entries)


async def resolve_card_live(db: CardDatabase, client: ScryfallClient, name: str) -> Card | None:
    """Extended, network-capable resolution tail for a single name — used only where a
    caller already tried the cheap offline+batched paths and still has misses (see
    `BracketService._live_fill_unresolved`). Order:

      1. local exact/front-split/flavor-name (`resolve_card`, no network)
      2. `localized_name_cache` hit → `get_by_oracle_id` (no network)
      3. live English exact/fuzzy (`ScryfallClient.named`) — upserts + returns on hit
      4. live Portuguese printed-name search (`lang:pt`) — on exactly one hit, caches
         `(name, oracle_id)` in `localized_name_cache`, upserts the canonical (English)
         card, and returns it. Ambiguous (>1) or zero results give up.

    Never raises — network absence/failure just means the name stays unresolved, same as
    every other live-fallback path in this codebase.
    """
    if card := resolve_card(db, name=name):
        return card

    if oracle_id := db.get_localized_name(name, lang="pt"):
        if card := db.get_by_oracle_id(oracle_id):
            return card

    try:
        if card := await client.named(fuzzy=name):
            db.upsert_card(card)
            return card

        results = await client.search(f'"{name}" lang:pt', unique="cards")
    except Exception:  # noqa: BLE001 — best-effort, mirrors other live-fallback paths
        return None

    if len(results) == 1:
        card = results[0]
        oracle_key = card.oracle_id or card.id
        db.cache_localized_name(name, oracle_key, lang="pt")
        db.upsert_card(card)
        return card
    return None


def resolve_inventory(db: CardDatabase, items: list[InventoryItem]) -> Inventory:
    """Attach oracle_id to each item (in place) and wrap as an Inventory."""
    for item in items:
        card = resolve_card(db, name=item.name, set_code=item.set_code,
                            collector_number=item.collector_number, scryfall_id=item.scryfall_id)
        item.oracle_id = card.oracle_id if card else None
    return Inventory(items=items)
