"""FastAPI application — a thin adapter over the engine.

Phase 0: health route + CORS for local dev. Feature routes are added per the
phases in project-plan.md (card lookup, deck import/analysis, recommendations).
"""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from mtg_analyzer import __version__

# Vite dev server origins (local single-user dev). Tighten/remove for any future hosting.
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Routes that must stay reachable without a key (deploy/orchestration probes).
UNAUTHENTICATED_PATHS = {"/health"}

app = FastAPI(
    title="MTG Analyzer",
    version=__version__,
    summary="Local Commander (EDH) deck analyzer, simulator, and recommender.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_api_key(request: Request, call_next):
    """Reject requests without a valid API_KEY (see docs/spec/bracket-engine.md §47.1).

    Accepts either header:
      X-API-Key: <key>
      Authorization: Bearer <key>

    If API_KEY is unset in the environment, auth is skipped (local dev without .env).
    """
    expected = os.environ.get("API_KEY")
    if expected and request.url.path not in UNAUTHENTICATED_PATHS:
        provided = request.headers.get("X-API-Key")
        if not provided:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                provided = auth_header.removeprefix("Bearer ")

        if provided != expected:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid API key."},
            )

    return await call_next(request)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe used by the frontend to confirm the backend is up."""
    return {"status": "ok", "version": __version__}
