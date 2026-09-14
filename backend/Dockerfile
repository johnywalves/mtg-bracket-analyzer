FROM python:3.12-slim AS base

WORKDIR /app

# System deps for scipy/numpy wheels build (if no manylinux wheel matches)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first (layer caching)
COPY pyproject.toml ./
COPY backend/mtg_analyzer ./backend/mtg_analyzer

RUN pip install --no-cache-dir .

# Regenerable local data directory (bulk cache, sqlite db)
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "mtg_analyzer.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
