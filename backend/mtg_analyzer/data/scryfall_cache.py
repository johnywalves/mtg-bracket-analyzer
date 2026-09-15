"""SQLite-backed TTL cache for Scryfall live-API responses.

This sits in front of :class:`~mtg_analyzer.data.scryfall_client.ScryfallClient` and
supplements — does not replace — the bulk-ingested local card DB (``data/db.py``).
The bulk DB already serves the vast majority of lookups offline; this cache exists
for the surface ``ScryfallClient`` actually hits over the network: fuzzy name
resolution, autocomplete, ad-hoc search, and batch ``/cards/collection`` lookups
for identifiers that don't resolve locally (new sets not yet in the bulk snapshot,
typos, etc). Persisting to disk means repeat runs (e.g. re-resolving the same
decklist) don't re-hit Scryfall at all.

Entries expire after ``ttl_seconds`` (default ``config.SCRYFALL_CACHE_TTL_SECONDS``,
which matches the ~12h bulk-data refresh cadence — no point caching longer than
Scryfall itself considers its data fresh).
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from mtg_analyzer import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS scryfall_cache (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    fetched_at REAL NOT NULL
);
"""

class ScryfallCache:
    def __init__(self, db_path: Path | None = None, ttl_seconds: float | None = None) -> None:
        self.path = db_path or config.SCRYFALL_CACHE_PATH
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.ttl_seconds = (
            ttl_seconds if ttl_seconds is not None else config.SCRYFALL_CACHE_TTL_SECONDS
        )
        self.conn = sqlite3.connect(self.path)
        self.conn.execute(SCHEMA)

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> ScryfallCache:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def get(self, key: str) -> dict[str, Any] | None:
        """Return the cached envelope ``{"data": ...}``, or None if absent/expired."""
        row = self.conn.execute(
            "SELECT value, fetched_at FROM scryfall_cache WHERE key = ?", (key,)
        ).fetchone()
        if row is None:
            return None
        value, fetched_at = row
        if time.time() - fetched_at > self.ttl_seconds:
            self.conn.execute("DELETE FROM scryfall_cache WHERE key = ?", (key,))
            self.conn.commit()
            return None
        return dict(json.loads(value))

    def set(self, key: str, envelope: dict[str, Any]) -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO scryfall_cache (key, value, fetched_at) VALUES (?, ?, ?)",
            (key, json.dumps(envelope), time.time()),
        )
        self.conn.commit()

    def clear(self) -> None:
        self.conn.execute("DELETE FROM scryfall_cache")
        self.conn.commit()
