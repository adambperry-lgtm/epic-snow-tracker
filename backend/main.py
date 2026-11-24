import json
import os
import sqlite3
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

LIFTIE_BASE_URL = "https://liftie.info/api/resort"
CACHE_TTL_SECONDS = 15 * 60  # 15 minutes

BASE_DIR = Path(__file__).resolve().parent.parent


def resolve_db_path() -> Path:
    env_path = os.environ.get("DB_PATH")
    if env_path:
        return Path(env_path)
    railway_volume = Path("/data")
    if railway_volume.is_dir():
        return railway_volume / "epic_snow.db"
    return BASE_DIR / "data" / "epic_snow.db"


DB_PATH = resolve_db_path()


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db_connection() as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS lift_cache (
                slug TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                fetched_at REAL NOT NULL
            )
            """
        )
        conn.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Epic Snow Tracker API", lifespan=lifespan)


def read_cached_lift(slug: str) -> tuple[float, dict[str, Any]] | None:
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT payload, fetched_at FROM lift_cache WHERE slug = ?",
            (slug,),
        ).fetchone()
    if row is None:
        return None
    return float(row["fetched_at"]), json.loads(row["payload"])


def write_cached_lift(slug: str, payload: dict[str, Any], fetched_at: float) -> None:
    serialized = json.dumps(payload)
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO lift_cache (slug, payload, fetched_at)
            VALUES (?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                payload = excluded.payload,
                fetched_at = excluded.fetched_at
            """,
            (slug, serialized, fetched_at),
        )
        conn.commit()


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "db_path": str(DB_PATH)}


@app.get("/api/lifts/{slug}")
async def get_lift_status(slug: str) -> JSONResponse:
    now = time.time()
    cached = read_cached_lift(slug)
    if cached is not None:
        fetched_at, payload = cached
        if now - fetched_at < CACHE_TTL_SECONDS:
            return JSONResponse(
                content=payload,
                headers={"X-Cache": "HIT"},
            )

    url = f"{LIFTIE_BASE_URL}/{slug}"
    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"Accept": "application/json"})
    except httpx.RequestError as exc:
        if cached is not None:
            return JSONResponse(
                content=cached[1],
                headers={"X-Cache": "STALE"},
            )
        raise HTTPException(
            status_code=502,
            detail=f"Upstream Liftie request failed: {exc}",
        ) from exc

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Resort '{slug}' not found on Liftie")

    if resp.status_code >= 400:
        if cached is not None:
            return JSONResponse(
                content=cached[1],
                headers={"X-Cache": "STALE"},
            )
        raise HTTPException(
            status_code=502,
            detail=f"Liftie returned HTTP {resp.status_code}",
        )

    payload = resp.json()
    write_cached_lift(slug, payload, now)
    return JSONResponse(
        content=payload,
        headers={"X-Cache": "MISS"},
    )


# Serve compiled React production build (frontend/dist)
FRONTEND_DIST = Path(os.environ.get("FRONTEND_DIST", BASE_DIR / "frontend" / "dist"))

if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Serve other root static files (e.g., favicon.svg) and catch-all SPA fallback
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API route not found")

        candidate = (FRONTEND_DIST / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(FRONTEND_DIST.resolve()):
            return FileResponse(candidate)

        index_file = FRONTEND_DIST / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)

        raise HTTPException(status_code=404, detail="Frontend build not found")
