import json
import os
import re
import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

LIFTIE_BASE_URL = "https://liftie.info/api/resort"
ONTHESNOW_BASE_URL = "https://www.onthesnow.com"
CACHE_TTL_SECONDS = 15 * 60  # 15 minutes

BASE_DIR = Path(__file__).resolve().parent.parent

# Mapping of resort IDs to OnTheSnow skireport paths for live lift/trail counts
ONTHESNOW_PATHS: dict[str, str] = {
    "vail": "colorado/vail",
    "beaver-creek": "colorado/beaver-creek",
    "breckenridge": "colorado/breckenridge",
    "keystone": "colorado/keystone",
    "crested-butte": "colorado/crested-butte-mountain-resort",
    "telluride": "colorado/telluride",
    "park-city": "utah/park-city-mountain-resort",
    "heavenly": "california/heavenly-mountain-resort",
    "northstar": "california/northstar-california",
    "kirkwood": "california/kirkwood",
    "stevens-pass": "washington/stevens-pass-resort",
    "whistler-blackcomb": "british-columbia/whistler-blackcomb",
    "stowe": "vermont/stowe-mountain-resort",
    "okemo": "vermont/okemo-mountain-resort",
    "mount-snow": "vermont/mount-snow",
    "attitash": "new-hampshire/attitash",
    "wildcat": "new-hampshire/wildcat-mountain",
    "mount-sunapee": "new-hampshire/mount-sunapee",
    "crotched": "new-hampshire/crotched-mountain",
    "hunter": "new-york/hunter-mountain",
    "seven-springs": "pennsylvania/seven-springs",
    "laurel-mountain": "pennsylvania/laurel-mountain",
    "hidden-valley-pa": "pennsylvania/hidden-valley-resort",
    "liberty": "pennsylvania/liberty-mountain-resort",
    "roundtop": "pennsylvania/roundtop-mountain-resort",
    "whitetail": "pennsylvania/whitetail-resort",
    "jack-frost": "pennsylvania/jack-frost",
    "big-boulder": "pennsylvania/big-boulder",
    "afton-alps": "minnesota/afton-alps",
    "mt-brighton": "michigan/mt-brighton",
    "wilmot": "wisconsin/wilmot-mountain",
    "fernie": "british-columbia/fernie-alpine-resort",
    "kicking-horse": "british-columbia/kicking-horse",
    "kimberley": "british-columbia/kimberley-alpine-resort",
    "nakiska": "alberta/nakiska",
    "mont-sainte-anne": "quebec/mont-sainte-anne",
    "stoneham": "quebec/stoneham",
    "verbier-4-vallees": "valais/verbier",
    "crans-montana": "valais/crans-montana",
    "les-3-vallees": "northern-alps/val-thorens",
    "solden": "tyrol/soelden",
    "ski-arlberg": "tyrol/st-anton-am-arlberg",
    "rusutsu": "hokkaido/rusutsu-resort",
}


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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS resort_status (
                resort_id TEXT PRIMARY KEY,
                is_open INTEGER NOT NULL,
                lifts_open INTEGER NOT NULL,
                lifts_total INTEGER NOT NULL,
                trails_open INTEGER NOT NULL,
                trails_total INTEGER NOT NULL,
                base_depth_cm INTEGER NOT NULL,
                source TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Epic Snow Tracker API", lifespan=lifespan)


class ResortStatusUpdate(BaseModel):
    is_open: bool
    lifts_open: int = Field(ge=0)
    lifts_total: int = Field(ge=1)
    trails_open: int = Field(ge=0)
    trails_total: int = Field(ge=1)
    base_depth_cm: int = Field(ge=0)
    source: str = "db-synced"


def parse_onthesnow_html(html: str) -> dict[str, Any] | None:
    lifts_match = re.search(
        r"Lifts Open.*?<span>\s*(\d+)\s*/\s*(\d+)\s*</span>",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    runs_match = re.search(
        r"Runs Open.*?<span>\s*(\d+)\s*/\s*(\d+)\s*</span>",
        html,
        re.IGNORECASE | re.DOTALL,
    )

    if not lifts_match and not runs_match:
        if re.search(r">\s*Closed\s*</span>|closed for the season", html, re.IGNORECASE):
            return {
                "isOpen": False,
                "liftsOpen": 0,
                "liftsTotal": 0,
                "trailsOpen": 0,
                "trailsTotal": 0,
            }
        return None

    lifts_open = int(lifts_match.group(1)) if lifts_match else 0
    lifts_total = int(lifts_match.group(2)) if lifts_match else 0
    trails_open = int(runs_match.group(1)) if runs_match else 0
    trails_total = int(runs_match.group(2)) if runs_match else 0

    return {
        "isOpen": (lifts_open > 0 or trails_open > 0),
        "liftsOpen": lifts_open,
        "liftsTotal": lifts_total,
        "trailsOpen": trails_open,
        "trailsTotal": trails_total,
    }


def upsert_resort_status(
    resort_id: str,
    is_open: bool,
    lifts_open: int,
    lifts_total: int,
    trails_open: int,
    trails_total: int,
    base_depth_cm: int,
    source: str,
    updated_at: str,
) -> None:
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO resort_status (
                resort_id, is_open, lifts_open, lifts_total,
                trails_open, trails_total, base_depth_cm, source, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(resort_id) DO UPDATE SET
                is_open = excluded.is_open,
                lifts_open = excluded.lifts_open,
                lifts_total = excluded.lifts_total,
                trails_open = excluded.trails_open,
                trails_total = excluded.trails_total,
                base_depth_cm = excluded.base_depth_cm,
                source = excluded.source,
                updated_at = excluded.updated_at
            """,
            (
                resort_id,
                int(is_open),
                lifts_open,
                lifts_total,
                trails_open,
                trails_total,
                base_depth_cm,
                source,
                updated_at,
            ),
        )
        conn.commit()


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


@app.get("/api/config")
async def get_public_config() -> dict[str, str]:
    carto_key = os.environ.get("CARTO_API_KEY") or os.environ.get("VITE_CARTO_API_KEY") or ""
    return {"cartoApiKey": carto_key}


@app.get("/api/resorts/{resort_id}/status")
async def get_resort_status(resort_id: str) -> JSONResponse:
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT resort_id, is_open, lifts_open, lifts_total,
                   trails_open, trails_total, base_depth_cm, source, updated_at
            FROM resort_status
            WHERE resort_id = ?
            """,
            (resort_id,),
        ).fetchone()

    # If manually synced ("db-synced") or freshly cached live ("onthesnow-live" < 15m), return it
    if row is not None:
        is_manual = row["source"] == "db-synced"
        is_fresh = False
        try:
            updated_dt = datetime.fromisoformat(row["updated_at"])
            age_seconds = (datetime.now(timezone.utc) - updated_dt).total_seconds()
            is_fresh = age_seconds < CACHE_TTL_SECONDS
        except ValueError:
            is_fresh = False

        if is_manual or is_fresh:
            return JSONResponse(
                content={
                    "resortId": row["resort_id"],
                    "isOpen": bool(row["is_open"]),
                    "liftsOpen": row["lifts_open"],
                    "liftsTotal": row["lifts_total"],
                    "trailsOpen": row["trails_open"],
                    "trailsTotal": row["trails_total"],
                    "baseDepthCm": row["base_depth_cm"],
                    "source": row["source"],
                    "updatedAt": row["updated_at"],
                },
                headers={"X-Cache": "HIT"},
            )

    # Otherwise fetch live from OnTheSnow if mapped
    ots_path = ONTHESNOW_PATHS.get(resort_id)
    if ots_path:
        url = f"{ONTHESNOW_BASE_URL}/{ots_path}/skireport"
        try:
            async with httpx.AsyncClient(
                timeout=7.0,
                follow_redirects=True,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml",
                },
            ) as client:
                resp = await client.get(url)
            if resp.status_code == 200:
                parsed = parse_onthesnow_html(resp.text)
                if parsed is not None:
                    now_iso = datetime.now(timezone.utc).isoformat()
                    upsert_resort_status(
                        resort_id=resort_id,
                        is_open=parsed["isOpen"],
                        lifts_open=parsed["liftsOpen"],
                        lifts_total=parsed["liftsTotal"],
                        trails_open=parsed["trailsOpen"],
                        trails_total=parsed["trailsTotal"],
                        base_depth_cm=row["base_depth_cm"] if row else 0,
                        source="onthesnow-live",
                        updated_at=now_iso,
                    )
                    return JSONResponse(
                        content={
                            "resortId": resort_id,
                            **parsed,
                            "baseDepthCm": row["base_depth_cm"] if row else 0,
                            "source": "onthesnow-live",
                            "updatedAt": now_iso,
                        },
                        headers={"X-Cache": "MISS"},
                    )
        except httpx.RequestError:
            pass

    # If stale row exists, return it rather than 404
    if row is not None:
        return JSONResponse(
            content={
                "resortId": row["resort_id"],
                "isOpen": bool(row["is_open"]),
                "liftsOpen": row["lifts_open"],
                "liftsTotal": row["lifts_total"],
                "trailsOpen": row["trails_open"],
                "trailsTotal": row["trails_total"],
                "baseDepthCm": row["base_depth_cm"],
                "source": row["source"],
                "updatedAt": row["updated_at"],
            },
            headers={"X-Cache": "STALE"},
        )

    raise HTTPException(status_code=404, detail="No live or saved status for resort")


@app.put("/api/resorts/{resort_id}/status")
async def put_resort_status(resort_id: str, body: ResortStatusUpdate) -> JSONResponse:
    now_iso = datetime.now(timezone.utc).isoformat()
    lifts_open = min(body.lifts_open, body.lifts_total)
    trails_open = min(body.trails_open, body.trails_total)
    upsert_resort_status(
        resort_id=resort_id,
        is_open=body.is_open,
        lifts_open=lifts_open,
        lifts_total=body.lifts_total,
        trails_open=trails_open,
        trails_total=body.trails_total,
        base_depth_cm=body.base_depth_cm,
        source="db-synced",
        updated_at=now_iso,
    )

    return JSONResponse(
        content={
            "resortId": resort_id,
            "isOpen": body.is_open,
            "liftsOpen": lifts_open,
            "liftsTotal": body.lifts_total,
            "trailsOpen": trails_open,
            "trailsTotal": body.trails_total,
            "baseDepthCm": body.base_depth_cm,
            "source": "db-synced",
            "updatedAt": now_iso,
        }
    )


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
        async with httpx.AsyncClient(
            timeout=6.0,
            follow_redirects=True,
            headers={"User-Agent": "EpicSnowTracker/1.0", "Accept": "application/json"},
        ) as client:
            resp = await client.get(url)
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
