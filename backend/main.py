import os
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

LIFTIE_BASE_URL = "https://liftie.info/api/resort"
CACHE_TTL_SECONDS = 15 * 60  # 15 minutes

app = FastAPI(title="Epic Snow Tracker API")

# In-memory TTL cache: slug -> (timestamp, payload)
_lift_cache: dict[str, tuple[float, dict[str, Any]]] = {}


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/lifts/{slug}")
async def get_lift_status(slug: str) -> JSONResponse:
    now = time.monotonic()
    cached = _lift_cache.get(slug)
    if cached is not None:
        cached_at, payload = cached
        if now - cached_at < CACHE_TTL_SECONDS:
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
    _lift_cache[slug] = (now, payload)
    return JSONResponse(
        content=payload,
        headers={"X-Cache": "MISS"},
    )


# Serve compiled React production build (frontend/dist)
BASE_DIR = Path(__file__).resolve().parent.parent
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
