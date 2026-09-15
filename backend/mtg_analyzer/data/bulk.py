"""Scryfall bulk-data downloader.

Polls ``/bulk-data``, downloads the Oracle Cards and Rulings files, and re-downloads
only when Scryfall's ``updated_at`` changes (tracked in a local manifest). Streams to
disk so memory stays bounded regardless of file size.

As of 2026, Scryfall serves bulk files as ``.jsonl.gz`` — one JSON object per line, gzip at
the file level (not just HTTP Content-Encoding), which httpx's ``iter_bytes`` does *not*
transparently decode. ``_stream_to_file`` therefore wraps the byte stream in
``gzip.GzipFile`` and writes the *decompressed* JSONL to disk (no ``.gz`` suffix), which is
what ``data/db.py``'s ``_stream_bulk_objects`` reads. The catalog now exposes this URL as
``jsonl_download_uri`` (the older ``download_uri``/single-JSON-array layout is gone).

See the ``scryfall-api`` skill for the bulk-data catalog and refresh guidance.
"""

from __future__ import annotations

import gzip
import json
import shutil
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import httpx

from mtg_analyzer import config


@dataclass(frozen=True)
class BulkFile:
    bulk_type: str
    path: Path
    updated_at: str


class BulkDataManager:
    def __init__(self, scryfall_dir: Path | None = None) -> None:
        self.dir = scryfall_dir or config.SCRYFALL_DIR
        self.manifest_path = self.dir / "manifest.json"

    # --- manifest -----------------------------------------------------------
    def _load_manifest(self) -> dict[str, dict[str, str]]:
        if self.manifest_path.exists():
            return json.loads(self.manifest_path.read_text())
        return {}

    def _save_manifest(self, manifest: dict[str, dict[str, str]]) -> None:
        self.manifest_path.write_text(json.dumps(manifest, indent=2))

    def local_file(self, bulk_type: str) -> BulkFile | None:
        """Return the locally cached file for a bulk type, or None if absent."""
        entry = self._load_manifest().get(bulk_type)
        if not entry:
            return None
        path = self.dir / entry["file"]
        if not path.exists():
            return None
        return BulkFile(bulk_type=bulk_type, path=path, updated_at=entry["updated_at"])

    # --- network ------------------------------------------------------------
    def fetch_catalog(self) -> dict[str, dict]:
        """GET /bulk-data → {bulk_type: entry} keyed on the entry's ``type``."""
        resp = httpx.get(
            f"{config.SCRYFALL_API_BASE}/bulk-data",
            headers=config.DEFAULT_HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        return {entry["type"]: entry for entry in resp.json()["data"]}

    def download(self, bulk_type: str, *, force: bool = False) -> BulkFile:
        """Download ``bulk_type`` if its ``updated_at`` changed (or ``force``)."""
        config.ensure_dirs()
        catalog = self.fetch_catalog()
        if bulk_type not in catalog:
            raise ValueError(f"Unknown bulk type {bulk_type!r}; have {sorted(catalog)}")
        entry = catalog[bulk_type]
        updated_at = entry["updated_at"]

        cached = self.local_file(bulk_type)
        if cached and cached.updated_at == updated_at and not force:
            return cached  # up to date

        dest = self.dir / f"{bulk_type}.jsonl"
        self._stream_to_file(entry["jsonl_download_uri"], dest)

        manifest = self._load_manifest()
        manifest[bulk_type] = {"file": dest.name, "updated_at": updated_at}
        self._save_manifest(manifest)
        return BulkFile(bulk_type=bulk_type, path=dest, updated_at=updated_at)

    def _stream_to_file(self, url: str, dest: Path) -> None:
        tmp = dest.with_suffix(dest.suffix + ".part")
        with (
            httpx.stream("GET", url, headers=config.DEFAULT_HEADERS, timeout=None) as resp,
            tmp.open("wb") as fh,
        ):
            resp.raise_for_status()
            # Scryfall's `.jsonl.gz` bulk files are gzip at the file level (not just HTTP
            # Content-Encoding), so httpx's iter_bytes yields the raw compressed bytes — wrap in
            # gzip to stream out decompressed JSONL lines instead of the compressed stream.
            with gzip.GzipFile(fileobj=_iter_bytes_as_fileobj(resp.iter_bytes())) as gz:
                shutil.copyfileobj(gz, fh)
        tmp.replace(dest)  # atomic swap so a partial download never looks complete


class _iter_bytes_as_fileobj:
    """Wrap an httpx ``iter_bytes`` generator into the file-like object ``gzip.GzipFile`` needs.
    Matches the gzip typeshed's ``_ReadableFileobj`` Protocol exactly: ``read(n)`` (GzipFile calls
    it with -1 to mean "until EOF") plus ``seek`` — GzipFile probes seekability once at open time
    via a zero-length forward seek, which is all this stream needs to support."""
    def __init__(self, chunks: Iterator[bytes]) -> None:
        self._it = iter(chunks)
        self._buf = bytearray()
        self._eof = False

    def read(self, n: int, /) -> bytes:
        while not self._eof and (n < 0 or len(self._buf) < n):
            try:
                self._buf.extend(next(self._it))
            except StopIteration:
                self._eof = True
        if n < 0:
            n = len(self._buf)
        out = bytes(self._buf[:n])
        del self._buf[:n]
        return out

    def seek(self, n: int, /) -> int:
        if n != 0:
            raise OSError("_iter_bytes_as_fileobj is a forward-only stream; only seek(0) is valid")
        return 0
