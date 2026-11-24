import asyncio
import json
import os
import re
import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

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
    "verbier": "valais/verbier",
    "nendaz": "valais/nendaz",
    "veysonnaz": "valais/veysonnaz",
    "crans-montana": "valais/crans-montana",
    "val-thorens": "northern-alps/val-thorens",
    "meribel": "northern-alps/meribel",
    "courchevel": "northern-alps/courchevel",
    "les-menuires": "northern-alps/les-menuires",
    "madonna-di-campiglio": "trentino/madonna-di-campiglio",
    "folgarida-marilleva": "trentino/folgarida-marilleva",
    "st-anton-am-arlberg": "tyrol/st-anton-am-arlberg",
    "lech-zurs": "vorarlberg/lech-zuers-am-arlberg",
    "mayrhofen": "tyrol/mayrhofen",
    "zillertal-arena": "tyrol/zillertal-arena",
    "solden": "tyrol/soelden",
    "saalbach-hinterglemm": "salzburg/saalbach-hinterglemm-leogang-fieberbrunn",
    "rusutsu": "hokkaido/rusutsu-resort",
}

RESORT_TIMEZONES: dict[str, str] = {
    # Rockies (Mountain)
    "vail": "America/Denver",
    "beaver-creek": "America/Denver",
    "breckenridge": "America/Denver",
    "keystone": "America/Denver",
    "crested-butte": "America/Denver",
    "telluride": "America/Denver",
    "park-city": "America/Denver",
    "fernie": "America/Edmonton",
    "kicking-horse": "America/Edmonton",
    "kimberley": "America/Edmonton",
    "nakiska": "America/Edmonton",
    # West / Pacific
    "heavenly": "America/Los_Angeles",
    "northstar": "America/Los_Angeles",
    "kirkwood": "America/Los_Angeles",
    "stevens-pass": "America/Los_Angeles",
    "whistler-blackcomb": "America/Vancouver",
    # Midwest (Central)
    "afton-alps": "America/Chicago",
    "wilmot": "America/Chicago",
    "hidden-valley-mo": "America/Chicago",
    "snow-creek": "America/Chicago",
    # Europe & Japan
    "andermatt-sedrun-disentis": "Europe/Zurich",
    "crans-montana": "Europe/Zurich",
    "verbier": "Europe/Zurich",
    "nendaz": "Europe/Zurich",
    "veysonnaz": "Europe/Zurich",
    "val-thorens": "Europe/Paris",
    "meribel": "Europe/Paris",
    "courchevel": "Europe/Paris",
    "les-menuires": "Europe/Paris",
    "madonna-di-campiglio": "Europe/Rome",
    "folgarida-marilleva": "Europe/Rome",
    "pinzolo": "Europe/Rome",
    "st-anton-am-arlberg": "Europe/Vienna",
    "lech-zurs": "Europe/Vienna",
    "mayrhofen": "Europe/Vienna",
    "zillertal-arena": "Europe/Vienna",
    "hintertux-glacier": "Europe/Vienna",
    "solden": "Europe/Vienna",
    "silvretta-montafon": "Europe/Vienna",
    "saalbach-hinterglemm": "Europe/Vienna",
    "zell-am-see": "Europe/Vienna",
    "kitzsteinhorn-kaprun": "Europe/Vienna",
    "hakuba-valley": "Asia/Tokyo",
    "rusutsu": "Asia/Tokyo",
}


def get_resort_local_date(resort_id: str) -> str:
    tz_name = RESORT_TIMEZONES.get(resort_id, "America/New_York")
    return datetime.now(ZoneInfo(tz_name)).date().isoformat()


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
                updated_at TEXT NOT NULL,
                report_date TEXT,
                closed_for_day INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        for col_sql in (
            "ALTER TABLE resort_status ADD COLUMN report_date TEXT",
            "ALTER TABLE resort_status ADD COLUMN closed_for_day INTEGER NOT NULL DEFAULT 0",
        ):
            try:
                conn.execute(col_sql)
            except sqlite3.OperationalError:
                pass
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
) -> dict[str, Any]:
    today_local = get_resort_local_date(resort_id)
    closed_for_day = False

    with get_db_connection() as conn:
        existing = conn.execute(
            """
            SELECT is_open, lifts_open, lifts_total, trails_open, trails_total,
                   base_depth_cm, report_date, closed_for_day
            FROM resort_status
            WHERE resort_id = ?
            """,
            (resort_id,),
        ).fetchone()

        # If the mountain was already open today (local resort date) and an automated
        # evening/night check sees 0 lifts/trails, keep today's operating stats and
        # mark closed_for_day=True until the resort's local calendar date rolls over.
        if (
            source != "db-synced"
            and existing is not None
            and existing["report_date"] == today_local
            and bool(existing["is_open"])
            and not is_open
        ):
            is_open = True
            lifts_open = existing["lifts_open"]
            lifts_total = existing["lifts_total"] or lifts_total
            trails_open = existing["trails_open"]
            trails_total = existing["trails_total"] or trails_total
            base_depth_cm = base_depth_cm or existing["base_depth_cm"]
            closed_for_day = True

        conn.execute(
            """
            INSERT INTO resort_status (
                resort_id, is_open, lifts_open, lifts_total,
                trails_open, trails_total, base_depth_cm, source,
                updated_at, report_date, closed_for_day
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(resort_id) DO UPDATE SET
                is_open = excluded.is_open,
                lifts_open = excluded.lifts_open,
                lifts_total = excluded.lifts_total,
                trails_open = excluded.trails_open,
                trails_total = excluded.trails_total,
                base_depth_cm = excluded.base_depth_cm,
                source = excluded.source,
                updated_at = excluded.updated_at,
                report_date = excluded.report_date,
                closed_for_day = excluded.closed_for_day
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
                today_local,
                int(closed_for_day),
            ),
        )
        conn.commit()

    return {
        "resortId": resort_id,
        "isOpen": is_open,
        "liftsOpen": lifts_open,
        "liftsTotal": lifts_total,
        "trailsOpen": trails_open,
        "trailsTotal": trails_total,
        "baseDepthCm": base_depth_cm,
        "source": source,
        "updatedAt": updated_at,
        "reportDate": today_local,
        "closedForDay": closed_for_day,
    }


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


STATUS_SELECT_COLS = """
    resort_id, is_open, lifts_open, lifts_total,
    trails_open, trails_total, base_depth_cm, source,
    updated_at, report_date, closed_for_day
"""


def _row_to_status_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "resortId": row["resort_id"],
        "isOpen": bool(row["is_open"]),
        "liftsOpen": row["lifts_open"],
        "liftsTotal": row["lifts_total"],
        "trailsOpen": row["trails_open"],
        "trailsTotal": row["trails_total"],
        "baseDepthCm": row["base_depth_cm"],
        "source": row["source"],
        "updatedAt": row["updated_at"],
        "reportDate": row["report_date"],
        "closedForDay": bool(row["closed_for_day"]),
    }


@app.get("/api/resorts/statuses")
async def get_all_resort_statuses() -> JSONResponse:
    with get_db_connection() as conn:
        rows = conn.execute(
            f"SELECT {STATUS_SELECT_COLS} FROM resort_status"
        ).fetchall()

    if not rows:
        return await sync_all_onthesnow_statuses()

    return JSONResponse(content={r["resort_id"]: _row_to_status_dict(r) for r in rows})


@app.post("/api/resorts/sync")
async def sync_all_onthesnow_statuses() -> JSONResponse:
    sem = asyncio.Semaphore(8)

    async def fetch_one(client: httpx.AsyncClient, resort_id: str, ots_path: str) -> None:
        async with sem:
            try:
                resp = await client.get(f"{ONTHESNOW_BASE_URL}/{ots_path}/skireport")
                if resp.status_code != 200:
                    return
                parsed = parse_onthesnow_html(resp.text)
                if parsed is None:
                    return
                now_iso = datetime.now(timezone.utc).isoformat()
                with get_db_connection() as conn:
                    existing = conn.execute(
                        "SELECT source, base_depth_cm, report_date FROM resort_status WHERE resort_id = ?",
                        (resort_id,),
                    ).fetchone()
                # Preserve manual db-synced overrides for the same local day
                if (
                    existing
                    and existing["source"] == "db-synced"
                    and existing["report_date"] == get_resort_local_date(resort_id)
                ):
                    return
                upsert_resort_status(
                    resort_id=resort_id,
                    is_open=parsed["isOpen"],
                    lifts_open=parsed["liftsOpen"],
                    lifts_total=parsed["liftsTotal"],
                    trails_open=parsed["trailsOpen"],
                    trails_total=parsed["trailsTotal"],
                    base_depth_cm=existing["base_depth_cm"] if existing else 0,
                    source="onthesnow-live",
                    updated_at=now_iso,
                )
            except httpx.RequestError:
                return

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
        await asyncio.gather(
            *(fetch_one(client, rid, path) for rid, path in ONTHESNOW_PATHS.items())
        )

    with get_db_connection() as conn:
        rows = conn.execute(
            f"SELECT {STATUS_SELECT_COLS} FROM resort_status"
        ).fetchall()
    return JSONResponse(content={r["resort_id"]: _row_to_status_dict(r) for r in rows})


@app.get("/api/resorts/{resort_id}/status")
async def get_resort_status(resort_id: str) -> JSONResponse:
    with get_db_connection() as conn:
        row = conn.execute(
            f"SELECT {STATUS_SELECT_COLS} FROM resort_status WHERE resort_id = ?",
            (resort_id,),
        ).fetchone()

    today_local = get_resort_local_date(resort_id)

    # Return cached status if same local day AND (manual db-synced OR < 15m old)
    if row is not None and row["report_date"] == today_local:
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
                content=_row_to_status_dict(row),
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
                    saved = upsert_resort_status(
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
                        content=saved,
                        headers={"X-Cache": "MISS"},
                    )
        except httpx.RequestError:
            pass

    # If stale row exists from today, return it rather than 404
    if row is not None and row["report_date"] == today_local:
        return JSONResponse(
            content=_row_to_status_dict(row),
            headers={"X-Cache": "STALE"},
        )

    raise HTTPException(status_code=404, detail="No live or saved status for resort")


@app.put("/api/resorts/{resort_id}/status")
async def put_resort_status(resort_id: str, body: ResortStatusUpdate) -> JSONResponse:
    now_iso = datetime.now(timezone.utc).isoformat()
    lifts_open = min(body.lifts_open, body.lifts_total)
    trails_open = min(body.trails_open, body.trails_total)
    saved = upsert_resort_status(
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
    return JSONResponse(content=saved)


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
