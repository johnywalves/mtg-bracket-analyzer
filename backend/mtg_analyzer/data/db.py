"""Local SQLite card database: schema, streaming ingest, and queries.

Two tables, per project-plan.md:
  * ``cards``     — one row per gameplay identity (``oracle_id``); the canonical
                    record everything joins to. Holds extracted columns for fast
                    filtering plus the full Scryfall JSON for faithful reconstruction.
  * ``printings`` — one row per specific printing (Scryfall ``id``) for price/set/image.
                    From the Oracle Cards bulk this is one printing per card; swapping
                    in Default Cards later populates all printings (same schema).

Plus a ``rulings`` table joined on ``oracle_id``. Ingest reads Scryfall's bulk files in a
streaming, memory-bounded way; both the current JSONL layout (one object per line) and the
legacy single-JSON-array layout are supported — see ``_stream_bulk_objects``.
"""

from __future__ import annotations

import datetime
import json
import sqlite3
from collections.abc import Iterator
from pathlib import Path

import ijson

from mtg_analyzer import config
from mtg_analyzer.models.card import Card, Ruling

# Non-gameplay layouts that pollute name lookups (art cards, tokens, emblems, etc.).
# Kept in the DB for fidelity but deprioritized so a name resolves to the real card.
NON_GAMEPLAY_LAYOUTS = frozenset(
    {"art_series", "token", "double_faced_token", "emblem", "vanguard", "scheme",
     "planar", "augment", "host", "sticker"}
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS cards (
    oracle_id        TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    front_name       TEXT NOT NULL,              -- name before ' // ' (for DFC lookups)
    back_name        TEXT,                       -- name after ' // ', if any (DFC back face)
    flavor_name      TEXT,                       -- Universes Beyond reskin name (front face)
    back_flavor_name TEXT,                       -- reskin name of the back face, if any
    cmc              REAL NOT NULL DEFAULT 0,
    ci_key           TEXT NOT NULL DEFAULT '',   -- sorted color identity, e.g. 'GU'
    type_line        TEXT,
    commander_legal  INTEGER NOT NULL DEFAULT 0,
    game_changer     INTEGER NOT NULL DEFAULT 0,
    layout           TEXT,
    is_gameplay      INTEGER NOT NULL DEFAULT 1, -- 0 for art series / tokens / emblems
    json             TEXT NOT NULL               -- full Scryfall card object
);
CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_cards_front ON cards(front_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_cards_ci ON cards(ci_key);
CREATE INDEX IF NOT EXISTS idx_cards_cmc ON cards(cmc);
CREATE INDEX IF NOT EXISTS idx_cards_legal ON cards(commander_legal);

CREATE TABLE IF NOT EXISTS printings (
    id               TEXT PRIMARY KEY,
    oracle_id        TEXT NOT NULL,
    set_code         TEXT,
    collector_number TEXT,
    rarity           TEXT,
    usd              REAL,
    image_normal     TEXT
);
CREATE INDEX IF NOT EXISTS idx_printings_oracle ON printings(oracle_id);

CREATE TABLE IF NOT EXISTS rulings (
    oracle_id    TEXT NOT NULL,
    source       TEXT,
    published_at TEXT,
    comment      TEXT
);
CREATE INDEX IF NOT EXISTS idx_rulings_oracle ON rulings(oracle_id);

-- On-demand cache of localized (non-English) printed names → oracle_id, populated the
-- first time a name resolves via a live `lang:<lang>` Scryfall search (see
-- ingest.resolve.resolve_card_live). Avoids re-hitting the network for the same
-- Portuguese/etc. name on a later decklist.
CREATE TABLE IF NOT EXISTS localized_name_cache (
    printed_name_normalized TEXT NOT NULL,  -- casefolded + stripped
    lang                     TEXT NOT NULL,
    oracle_id                TEXT NOT NULL,
    cached_at                TEXT NOT NULL,
    PRIMARY KEY (printed_name_normalized, lang)
);
"""

_BATCH = 1000


def _name_columns(card: Card) -> tuple[str, str | None, str | None, str | None]:
    """(front_name, back_name, flavor_name, back_flavor_name) for a card's indexed name columns.

    front/back split on Scryfall's ``" // "`` DFC name join. flavor_name is the front face's
    Universes Beyond reskin (top-level field); back_flavor_name is the back face's, read from
    ``card_faces`` when present.
    """
    front_name, _, back_name_raw = card.name.partition(" // ")
    back_name: str | None = back_name_raw or None
    flavor_name = card.flavor_name
    back_flavor_name = None
    if card.card_faces:
        if flavor_name is None:
            flavor_name = card.card_faces[0].flavor_name
        if len(card.card_faces) > 1:
            back_flavor_name = card.card_faces[1].flavor_name
    return front_name, back_name, flavor_name, back_flavor_name


class CardDatabase:
    def __init__(self, db_path: Path | None = None) -> None:
        self.path = db_path or config.DB_PATH
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self._migrate()

    def _migrate(self) -> None:
        """Add columns introduced after a DB was first created (`data/` is regenerable, but a
        stale local snapshot shouldn't crash on startup — just re-ingest to backfill the new
        columns)."""
        existing = {row["name"] for row in self.conn.execute("PRAGMA table_info(cards)")}
        for column in ("back_name", "flavor_name", "back_flavor_name"):
            if column not in existing:
                self.conn.execute(f"ALTER TABLE cards ADD COLUMN {column} TEXT")
        # These indexes reference columns that may have just been added above, so they can't
        # live in the initial CREATE-TABLE-IF-NOT-EXISTS script (would fail against a pre-
        # existing table that predates the column).
        self.conn.executescript(
            "CREATE INDEX IF NOT EXISTS idx_cards_back ON cards(back_name COLLATE NOCASE);"
            "CREATE INDEX IF NOT EXISTS idx_cards_flavor ON cards(flavor_name COLLATE NOCASE);"
            "CREATE INDEX IF NOT EXISTS idx_cards_back_flavor "
            "ON cards(back_flavor_name COLLATE NOCASE);"
        )
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> CardDatabase:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # --- ingest -------------------------------------------------------------
    def ingest_cards(self, bulk_path: Path) -> int:
        """Stream an Oracle/Default Cards bulk file into cards + printings."""
        count = 0
        cur = self.conn.cursor()
        card_rows: list[tuple] = []
        printing_rows: list[tuple] = []
        for card in _stream_cards(bulk_path):
            oracle_key = card.oracle_id or card.id
            ci_key = "".join(sorted(card.color_identity))
            front_name, back_name, flavor_name, back_flavor_name = _name_columns(card)
            card_rows.append(
                (
                    oracle_key,
                    card.name,
                    front_name,
                    back_name,
                    flavor_name,
                    back_flavor_name,
                    card.cmc,
                    ci_key,
                    card.type_line,
                    int(card.is_commander_legal()),
                    int(card.game_changer),
                    card.layout,
                    int(card.layout not in NON_GAMEPLAY_LAYOUTS),
                    card.model_dump_json(),
                )
            )
            printing_rows.append(
                (
                    card.id,
                    oracle_key,
                    card.set,
                    card.collector_number,
                    card.rarity,
                    card.usd_price(),
                    card.get_image("normal"),
                )
            )
            count += 1
            if len(card_rows) >= _BATCH:
                self._flush(cur, card_rows, printing_rows)
                card_rows, printing_rows = [], []
        self._flush(cur, card_rows, printing_rows)
        self.conn.commit()
        return count

    @staticmethod
    def _flush(cur: sqlite3.Cursor, cards: list[tuple], printings: list[tuple]) -> None:
        if cards:
            cur.executemany(
                "INSERT OR REPLACE INTO cards "
                "(oracle_id, name, front_name, back_name, flavor_name, back_flavor_name, cmc, "
                " ci_key, type_line, commander_legal, game_changer, layout, is_gameplay, json) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                cards,
            )
        if printings:
            cur.executemany(
                "INSERT OR REPLACE INTO printings "
                "(id, oracle_id, set_code, collector_number, rarity, usd, image_normal) "
                "VALUES (?,?,?,?,?,?,?)",
                printings,
            )

    def upsert_card(self, card: Card) -> None:
        """Insert/replace a single card fetched live (e.g. from a Scryfall resolution fallback).

        Builds the same `cards`/`printings` row shape as `ingest_cards`, so a live-fetched card
        self-heals the local DB and resolves offline on the next run — see
        docs/spec/bracket-engine.md's requirement that cached results stay deterministic regardless
        of network availability.
        """
        oracle_key = card.oracle_id or card.id
        ci_key = "".join(sorted(card.color_identity))
        front_name, back_name, flavor_name, back_flavor_name = _name_columns(card)
        card_row = (
            oracle_key,
            card.name,
            front_name,
            back_name,
            flavor_name,
            back_flavor_name,
            card.cmc,
            ci_key,
            card.type_line,
            int(card.is_commander_legal()),
            int(card.game_changer),
            card.layout,
            int(card.layout not in NON_GAMEPLAY_LAYOUTS),
            card.model_dump_json(),
        )
        printing_row = (
            card.id,
            oracle_key,
            card.set,
            card.collector_number,
            card.rarity,
            card.usd_price(),
            card.get_image("normal"),
        )
        cur = self.conn.cursor()
        self._flush(cur, [card_row], [printing_row])
        self.conn.commit()

    def ingest_rulings(self, bulk_path: Path) -> int:
        """Stream a Rulings bulk file into the rulings table (replaces existing)."""
        cur = self.conn.cursor()
        cur.execute("DELETE FROM rulings")
        rows: list[tuple] = []
        count = 0
        for r in _stream_bulk_objects(bulk_path):
            rows.append((r.get("oracle_id"), r.get("source"), r.get("published_at"),
                         r.get("comment")))
            count += 1
            if len(rows) >= _BATCH:
                cur.executemany("INSERT INTO rulings VALUES (?,?,?,?)", rows)
                rows = []
        if rows:
            cur.executemany("INSERT INTO rulings VALUES (?,?,?,?)", rows)
        self.conn.commit()
        return count

    # --- queries ------------------------------------------------------------
    def card_count(self) -> int:
        return int(self.conn.execute("SELECT COUNT(*) FROM cards").fetchone()[0])

    def _card_from_row(self, row: sqlite3.Row | None) -> Card | None:
        return Card.model_validate(json.loads(row["json"])) if row else None

    def get_by_oracle_id(self, oracle_id: str) -> Card | None:
        row = self.conn.execute(
            "SELECT json FROM cards WHERE oracle_id = ?", (oracle_id,)
        ).fetchone()
        return self._card_from_row(row)

    def get_by_name(self, name: str) -> Card | None:
        """Resolve a card by exact full name, front-face name, or back-face name
        (case-insensitive).

        So "Delver of Secrets" resolves to the real transform card, not the same-named
        art-series object, and "Insectile Aberration" (its back face) resolves too.
        Gameplay cards win over non-gameplay ones.
        """
        row = self.conn.execute(
            "SELECT json FROM cards WHERE name = ? COLLATE NOCASE OR front_name = ? COLLATE NOCASE "
            "OR back_name = ? COLLATE NOCASE "
            "ORDER BY is_gameplay DESC, length(name) LIMIT 1",
            (name, name, name),
        ).fetchone()
        return self._card_from_row(row)

    def get_by_flavor_name(self, name: str) -> Card | None:
        """Resolve a Universes Beyond reskin name (e.g. "Helm's Deep") to its real card,
        checking both the front and back face's flavor name."""
        row = self.conn.execute(
            "SELECT json FROM cards WHERE flavor_name = ? COLLATE NOCASE "
            "OR back_flavor_name = ? COLLATE NOCASE "
            "ORDER BY is_gameplay DESC, length(name) LIMIT 1",
            (name, name),
        ).fetchone()
        return self._card_from_row(row)

    def search_by_name(self, fragment: str, limit: int = 25) -> list[Card]:
        """Substring search, gameplay cards first."""
        rows = self.conn.execute(
            "SELECT json FROM cards WHERE name LIKE ? COLLATE NOCASE "
            "ORDER BY is_gameplay DESC, name LIMIT ?",
            (f"%{fragment}%", limit),
        ).fetchall()
        return [c for r in rows if (c := self._card_from_row(r))]

    def get_by_scryfall_id(self, scryfall_id: str) -> Card | None:
        """Resolve a specific printing id to its card (via the printings table)."""
        row = self.conn.execute(
            "SELECT c.json FROM printings p JOIN cards c ON c.oracle_id = p.oracle_id "
            "WHERE p.id = ?",
            (scryfall_id,),
        ).fetchone()
        return self._card_from_row(row)

    def get_by_set_collector(self, set_code: str, collector_number: str) -> Card | None:
        """Resolve a set code + collector number to its card.

        Note: the Oracle Cards bulk stores one representative printing per card, so this
        hits only for that printing; callers fall back to name resolution otherwise.
        """
        row = self.conn.execute(
            "SELECT c.json FROM printings p JOIN cards c ON c.oracle_id = p.oracle_id "
            "WHERE p.set_code = ? COLLATE NOCASE AND p.collector_number = ? COLLATE NOCASE",
            (set_code, collector_number),
        ).fetchone()
        return self._card_from_row(row)

    def min_usd(self, oracle_id: str) -> float | None:
        """Cheapest USD price across cached printings of a card (None if unpriced)."""
        row = self.conn.execute(
            "SELECT MIN(usd) FROM printings WHERE oracle_id = ? AND usd IS NOT NULL", (oracle_id,)
        ).fetchone()
        return float(row[0]) if row and row[0] is not None else None

    def get_localized_name(self, name: str, lang: str = "pt") -> str | None:
        """oracle_id previously cached for this localized printed name, if any."""
        row = self.conn.execute(
            "SELECT oracle_id FROM localized_name_cache "
            "WHERE printed_name_normalized = ? AND lang = ?",
            (name.strip().lower(), lang),
        ).fetchone()
        return row["oracle_id"] if row else None

    def cache_localized_name(self, name: str, oracle_id: str, lang: str = "pt") -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO localized_name_cache "
            "(printed_name_normalized, lang, oracle_id, cached_at) VALUES (?,?,?,?)",
            (name.strip().lower(), lang, oracle_id, datetime.datetime.now(datetime.UTC).isoformat()),
        )
        self.conn.commit()

    def get_rulings(self, oracle_id: str) -> list[Ruling]:
        rows = self.conn.execute(
            "SELECT oracle_id, source, published_at, comment FROM rulings "
            "WHERE oracle_id = ? ORDER BY published_at",
            (oracle_id,),
        ).fetchall()
        return [Ruling.model_validate(dict(r)) for r in rows]


def _stream_cards(bulk_path: Path) -> Iterator[Card]:
    for obj in _stream_bulk_objects(bulk_path):
        yield Card.model_validate(obj)


def _stream_bulk_objects(bulk_path: Path) -> Iterator[dict]:
    """Yield one dict per card/ruling from a Scryfall bulk file.

    Supports both formats Scryfall has served:
      * the current ``.jsonl.gz`` layout — one JSON object per line (gzip-decompressed by
        :class:`BulkDataManager` on download, so by the time this sees it it's plain JSONL);
      * the legacy layout — a single top-level JSON array (what older caches / test fixtures
        still hold).

    The format is detected from the first non-whitespace byte, so the on-disk filename suffix
    doesn't matter.
    """
    with bulk_path.open("rb") as fh:
        head = fh.read(1)
        while head in (b" ", b"\t", b"\r", b"\n"):
            head = fh.read(1)
        fh.seek(0)
        if head == b"[":  # legacy: top-level JSON array
            yield from ijson.items(fh, "item")
        else:  # current: JSONL, one object per line
            for line in fh:
                line = line.strip()
                if line:
                    yield json.loads(line)
