# Epic Snow Tracker (2026–27)

Interactive full-stack web application displaying Epic Pass owned and partner ski resorts across North America, Europe, and Japan with live Open-Meteo summit snow forecasts and Liftie lift counts.

## Architecture

- **Frontend (`frontend/`)**: React, TypeScript, Tailwind CSS v4, Leaflet (`react-leaflet`), Lucide icons.
- **Backend (`backend/`)**: FastAPI + `httpx` serving `/api/lifts/{slug}` (with a 15-minute in-memory TTL cache) and the compiled `frontend/dist` bundle.

## Local Development

1. **Start the FastAPI backend (port 8000):**
   ```bash
   .venv/bin/uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start the Vite dev server (port 5173, proxies `/api` to `localhost:8000`):**
   ```bash
   cd frontend && npm run dev
   ```

## Railway Single-Service Deployment

The root `Dockerfile` builds the Vite bundle in Stage 1 (`node:22-alpine`) and runs FastAPI + Uvicorn in Stage 2 (`python:3.12-slim`) bound to `0.0.0.0:${PORT:-8000}`.

### Persistent Volume (SQLite)
- Mount a Railway volume at `/data` (or set `DB_PATH=/your/mount/epic_snow.db`).
- FastAPI automatically initializes SQLite in WAL mode at startup and persists the 15-minute Liftie cache across restarts and redeploys.
