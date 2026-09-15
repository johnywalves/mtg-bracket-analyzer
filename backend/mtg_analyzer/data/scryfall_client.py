"""Async Scryfall live-API client for ad-hoc lookups.

Used only for things bulk data can't serve well: autocomplete, fuzzy single-card
resolution, ad-hoc search, and batch decklist resolution. Bulk-first remains the
rule for inventory-scale work (see the ``scryfall-api`` skill).

Enforces the required headers, a ~100 ms throttle, and 429 backoff. Every endpoint
also reads/writes through a :class:`ScryfallCache` (SQLite, TTL-based) so repeat
lookups — the same card autocompleted twice, the same decklist re-resolved, an
overlapping ``collection`` batch — don't re-hit the network at all.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Sequence
from itertools import islice
from typing import Any

import httpx

from mtg_analyzer import config
from mtg_analyzer.data.scryfall_cache import ScryfallCache
from mtg_analyzer.models.card import Card

_COLLECTION_BATCH = 75  # Scryfall hard limit per /cards/collection request


def _cache_key(*parts: Any) -> str:
    return "|".join("" if p is None else str(p) for p in parts)


def _normalize_identifier(identifier: dict[str, Any]) -> dict[str, Any]:
    """Case-fold string values so equivalent identifiers share one cache entry."""
    return {k: (v.lower() if isinstance(v, str) else v) for k, v in identifier.items()}


def _identifier_key(identifier: dict[str, Any]) -> str:
    normalized = _normalize_identifier(identifier)
    return _cache_key("collection", *(f"{k}={normalized[k]}" for k in sorted(normalized)))


def _identifier_matches(identifier: dict[str, Any], card: dict[str, Any]) -> bool:
    """Does a ``/cards/collection`` response object satisfy a given identifier?"""
    if "id" in identifier:
        return card.get("id") == identifier["id"]
    if "oracle_id" in identifier:
        return card.get("oracle_id") == identifier["oracle_id"]
    if "set" in identifier and "collector_number" in identifier:
        return (
            str(card.get("set", "")).lower() == str(identifier["set"]).lower()
            and str(card.get("collector_number", "")) == str(identifier["collector_number"])
        )
    if "name" in identifier:
        wanted = str(identifier["name"]).lower()
        name = str(card.get("name", "")).lower()
        front = name.split(" // ")[0]
        if wanted not in (name, front):
            return False
        if "set" in identifier:
            return str(card.get("set", "")).lower() == str(identifier["set"]).lower()
        return True
    return False


class ScryfallClient:
    def __init__(
        self,
        client: httpx.AsyncClient | None = None,
        *,
        cache: ScryfallCache | None | bool = True,
    ) -> None:
        self._client = client or httpx.AsyncClient(
            base_url=config.SCRYFALL_API_BASE,
            headers=config.DEFAULT_HEADERS,
            timeout=30,
        )
        self._owns_client = client is None
        self._last_request = 0.0

        # ``cache=True`` (default): own a fresh disk-backed ScryfallCache.
        # ``cache=False``/``None``: no caching. ``cache=<ScryfallCache>``: use it,
        # but don't close it on aclose() — the caller owns its lifetime.
        if isinstance(cache, ScryfallCache):
            self._cache: ScryfallCache | None = cache
            self._owns_cache = False
        elif cache:
            self._cache = ScryfallCache()
            self._owns_cache = True
        else:
            self._cache = None
            self._owns_cache = False

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()
        if self._owns_cache and self._cache is not None:
            self._cache.close()

    async def __aenter__(self) -> ScryfallClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.aclose()

    # --- core request with throttle + 429 backoff ---------------------------
    async def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        delay = config.REQUEST_DELAY_SECONDS - (time.monotonic() - self._last_request)
        if delay > 0:
            await asyncio.sleep(delay)
        for attempt in range(3):
            resp = await self._client.request(method, url, **kwargs)
            self._last_request = time.monotonic()
            if resp.status_code == 429:
                await asyncio.sleep(float(resp.headers.get("Retry-After", "1")) + attempt)
                continue
            return resp
        return resp

    # --- endpoints ----------------------------------------------------------
    async def named(
        self, *, exact: str | None = None, fuzzy: str | None = None, set_code: str | None = None
    ) -> Card | None:
        """Resolve a single card by exact or fuzzy name. Returns None on 404/ambiguous."""
        if (exact is None) == (fuzzy is None):
            raise ValueError("Provide exactly one of `exact` or `fuzzy`.")
        params = {"exact": exact} if exact is not None else {"fuzzy": fuzzy}
        if set_code:
            params["set"] = set_code

        key = _cache_key("named", exact, fuzzy, set_code)
        if self._cache is not None and (hit := self._cache.get(key)) is not None:
            return Card.model_validate(hit["data"]) if hit["data"] is not None else None

        resp = await self._request("GET", "/cards/named", params=params)
        if resp.status_code == 404:
            if self._cache is not None:
                self._cache.set(key, {"data": None})
            return None
        resp.raise_for_status()
        data = resp.json()
        if self._cache is not None:
            self._cache.set(key, {"data": data})
        return Card.model_validate(data)

    async def autocomplete(self, query: str) -> list[str]:
        key = _cache_key("autocomplete", query)
        if self._cache is not None and (hit := self._cache.get(key)) is not None:
            return list(hit["data"])

        resp = await self._request("GET", "/cards/autocomplete", params={"q": query})
        resp.raise_for_status()
        names = list(resp.json().get("data", []))
        if self._cache is not None:
            self._cache.set(key, {"data": names})
        return names

    async def search(self, query: str, *, order: str = "name", unique: str = "cards") -> list[Card]:
        """First page (≤175) of a Scryfall search. Returns [] when nothing matches."""
        key = _cache_key("search", query, order, unique)
        if self._cache is not None and (hit := self._cache.get(key)) is not None:
            return [Card.model_validate(c) for c in hit["data"]]

        resp = await self._request(
            "GET", "/cards/search", params={"q": query, "order": order, "unique": unique}
        )
        if resp.status_code == 404:
            if self._cache is not None:
                self._cache.set(key, {"data": []})
            return []
        resp.raise_for_status()
        data = resp.json().get("data", [])
        if self._cache is not None:
            self._cache.set(key, {"data": data})
        return [Card.model_validate(c) for c in data]

    async def collection(self, identifiers: Sequence[dict[str, Any]]) -> tuple[list[Card], list[dict]]:
        """Batch-resolve identifiers (auto-chunked to 75). Returns (found, not_found).

        Each identifier is looked up in the cache first; only cache misses go out
        over the network, and both found and not-found results are cached so a
        second pass over an overlapping decklist/inventory costs nothing.
        """
        found: list[Card] = []
        not_found: list[dict] = []
        to_fetch: list[dict] = []

        if self._cache is not None:
            for ident in identifiers:
                hit = self._cache.get(_identifier_key(ident))
                if hit is None:
                    to_fetch.append(ident)
                elif hit["data"] is not None:
                    found.append(Card.model_validate(hit["data"]))
                else:
                    not_found.append(ident)
        else:
            to_fetch = list(identifiers)

        it = iter(to_fetch)
        while batch := list(islice(it, _COLLECTION_BATCH)):
            resp = await self._request("POST", "/cards/collection", json={"identifiers": batch})
            resp.raise_for_status()
            body = resp.json()
            data = body.get("data", [])
            batch_not_found = body.get("not_found", [])
            found.extend(Card.model_validate(c) for c in data)
            not_found.extend(batch_not_found)

            if self._cache is not None:
                for ident in batch:
                    match = next((c for c in data if _identifier_matches(ident, c)), None)
                    envelope = {"data": match} if match is not None else {"data": None}
                    self._cache.set(_identifier_key(ident), envelope)

        return found, not_found
