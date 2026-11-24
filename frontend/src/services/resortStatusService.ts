import type { Resort, ResortForecast, ResortStatus } from '../types/resort';

/**
 * Seeded seasonal defaults for resorts not covered by Liftie API
 * or without a saved status in the persistent SQLite database.
 */
interface SeededResortMetrics {
  isOpen: boolean;
  openLiftRatio: number;
  openTrailRatio: number;
  baseDepthCm: number;
}

const SEEDED_METRICS_BY_SUBREGION: Record<string, SeededResortMetrics> = {
  Rockies: {
    isOpen: true,
    openLiftRatio: 0.72,
    openTrailRatio: 0.65,
    baseDepthCm: 112,
  },
  'West & Tahoe': {
    isOpen: true,
    openLiftRatio: 0.65,
    openTrailRatio: 0.58,
    baseDepthCm: 95,
  },
  'Pacific Northwest & BC': {
    isOpen: true,
    openLiftRatio: 0.78,
    openTrailRatio: 0.71,
    baseDepthCm: 138,
  },
  Northeast: {
    isOpen: true,
    openLiftRatio: 0.55,
    openTrailRatio: 0.46,
    baseDepthCm: 64,
  },
  'Mid-Atlantic': {
    isOpen: false,
    openLiftRatio: 0,
    openTrailRatio: 0,
    baseDepthCm: 25,
  },
  Midwest: {
    isOpen: false,
    openLiftRatio: 0,
    openTrailRatio: 0,
    baseDepthCm: 20,
  },
  'Canadian Rockies & Quebec': {
    isOpen: true,
    openLiftRatio: 0.68,
    openTrailRatio: 0.62,
    baseDepthCm: 105,
  },
  'Swiss Alps': {
    isOpen: true,
    openLiftRatio: 0.74,
    openTrailRatio: 0.68,
    baseDepthCm: 128,
  },
  'French & Italian Alps': {
    isOpen: true,
    openLiftRatio: 0.76,
    openTrailRatio: 0.70,
    baseDepthCm: 135,
  },
  'Austrian Alps': {
    isOpen: true,
    openLiftRatio: 0.79,
    openTrailRatio: 0.74,
    baseDepthCm: 142,
  },
  Japan: {
    isOpen: true,
    openLiftRatio: 0.64,
    openTrailRatio: 0.59,
    baseDepthCm: 145,
  },
};

interface LiftieResponse {
  lifts?: {
    status?: Record<string, string>;
    stats?: {
      open?: number;
      hold?: number;
      scheduled?: number;
      closed?: number;
    };
  };
  open?: boolean;
  timestamp?: {
    lifts?: number;
  };
}

const liftieCache = new Map<string, { data: LiftieResponse; fetchedAt: number }>();
const LIFTIE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function getSeededResortStatus(
  resort: Resort,
  forecast?: ResortForecast
): ResortStatus {
  const defaults = SEEDED_METRICS_BY_SUBREGION[resort.subRegion] ?? {
    isOpen: resort.typicalSeasonOpen,
    openLiftRatio: 0.6,
    openTrailRatio: 0.55,
    baseDepthCm: 80,
  };

  const isOpen = resort.typicalSeasonOpen && defaults.isOpen;
  const liftsOpen = isOpen
    ? Math.max(1, Math.round(resort.totalLifts * defaults.openLiftRatio))
    : 0;
  const trailsOpen = isOpen
    ? Math.max(1, Math.round(resort.totalTrails * defaults.openTrailRatio))
    : 0;

  const snow24hCm = forecast?.snowfall24hCm ?? 0;
  const snow7dCm = forecast?.snowfall7dCm ?? 0;

  // Prefer live Open-Meteo snow_depth when non-zero; otherwise fall back to regional estimate
  const liveSnowDepth = forecast?.snowDepthCm;
  const baseDepthCm =
    typeof liveSnowDepth === 'number' && liveSnowDepth > 0
      ? liveSnowDepth
      : isOpen
      ? Math.round(defaults.baseDepthCm + snow7dCm * 0.4)
      : Math.round(snow7dCm * 0.3);

  return {
    resortId: resort.id,
    isOpen,
    liftsOpen,
    liftsTotal: resort.totalLifts,
    trailsOpen,
    trailsTotal: resort.totalTrails,
    baseDepthCm,
    snow24hCm,
    snow7dCm,
    source: 'seeded',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Fetches resort status with priority:
 * 1. Persistent Railway SQLite DB (/api/resorts/{id}/status)
 * 2. Live Liftie API proxy (/api/lifts/{slug})
 * 3. Seeded seasonal fallback + live Open-Meteo snow totals
 */
export async function fetchResortStatus(
  resort: Resort,
  forecast?: ResortForecast
): Promise<ResortStatus> {
  const fallback = getSeededResortStatus(resort, forecast);

  // 1. Check backend live OnTheSnow / persistent SQLite DB status
  try {
    const dbRes = await fetch(`/api/resorts/${encodeURIComponent(resort.id)}/status`);
    if (dbRes.ok) {
      const saved = (await dbRes.json()) as ResortStatus;
      return {
        ...saved,
        liftsTotal: saved.liftsTotal > 0 ? saved.liftsTotal : resort.totalLifts,
        trailsTotal: saved.trailsTotal > 0 ? saved.trailsTotal : resort.totalTrails,
        baseDepthCm:
          saved.baseDepthCm > 0
            ? saved.baseDepthCm
            : saved.isOpen
            ? fallback.baseDepthCm
            : forecast?.snowDepthCm ?? 0,
        snow24hCm: fallback.snow24hCm,
        snow7dCm: fallback.snow7dCm,
      };
    }
  } catch {
    // Continue to Liftie / fallback
  }

  if (!resort.liftieSlug) {
    return fallback;
  }

  // 2. Try Liftie proxy
  try {
    const cached = liftieCache.get(resort.liftieSlug);
    let data: LiftieResponse;

    if (cached && Date.now() - cached.fetchedAt < LIFTIE_CACHE_TTL_MS) {
      data = cached.data;
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`/api/lifts/${encodeURIComponent(resort.liftieSlug)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return fallback;
      }
      data = (await res.json()) as LiftieResponse;
      liftieCache.set(resort.liftieSlug, { data, fetchedAt: Date.now() });
    }

    const stats = data.lifts?.stats;
    const statusMap = data.lifts?.status;

    if (stats || statusMap) {
      const openCount =
        stats?.open ??
        (statusMap
          ? Object.values(statusMap).filter((s) => s === 'open').length
          : fallback.liftsOpen);

      const totalCount = statusMap
        ? Object.keys(statusMap).length
        : (stats?.open ?? 0) +
            (stats?.hold ?? 0) +
            (stats?.scheduled ?? 0) +
            (stats?.closed ?? 0) || resort.totalLifts;

      const isOpen = data.open ?? openCount > 0;
      const openRatio = totalCount > 0 ? openCount / totalCount : 0;
      const trailsOpen = isOpen
        ? Math.min(
            resort.totalTrails,
            Math.max(1, Math.round(resort.totalTrails * Math.max(openRatio, 0.25)))
          )
        : 0;

      return {
        ...fallback,
        isOpen,
        liftsOpen: openCount,
        liftsTotal: totalCount,
        trailsOpen,
        trailsTotal: resort.totalTrails,
        source: 'liftie-live',
        updatedAt: data.timestamp?.lifts
          ? new Date(data.timestamp.lifts).toISOString()
          : new Date().toISOString(),
      };
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export interface ResortStatusUpdateInput {
  isOpen: boolean;
  liftsOpen: number;
  liftsTotal: number;
  trailsOpen: number;
  trailsTotal: number;
  baseDepthCm: number;
}

export async function saveResortStatus(
  resortId: string,
  input: ResortStatusUpdateInput,
  forecast?: ResortForecast
): Promise<ResortStatus> {
  const res = await fetch(`/api/resorts/${encodeURIComponent(resortId)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      is_open: input.isOpen,
      lifts_open: input.liftsOpen,
      lifts_total: input.liftsTotal,
      trails_open: input.trailsOpen,
      trails_total: input.trailsTotal,
      base_depth_cm: input.baseDepthCm,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to save resort status (HTTP ${res.status})`);
  }

  const saved = (await res.json()) as ResortStatus;
  return {
    ...saved,
    snow24hCm: forecast?.snowfall24hCm ?? 0,
    snow7dCm: forecast?.snowfall7dCm ?? 0,
    source: 'db-synced',
  };
}

function normalizeStatusMap(
  raw: Record<string, ResortStatus>,
  resorts: Resort[],
  forecasts: Record<string, ResortForecast>
): Record<string, ResortStatus> {
  const result: Record<string, ResortStatus> = {};
  for (const resort of resorts) {
    const fallback = getSeededResortStatus(resort, forecasts[resort.id]);
    const saved = raw[resort.id];
    if (saved) {
      result[resort.id] = {
        ...saved,
        liftsTotal: saved.liftsTotal > 0 ? saved.liftsTotal : resort.totalLifts,
        trailsTotal: saved.trailsTotal > 0 ? saved.trailsTotal : resort.totalTrails,
        baseDepthCm:
          saved.baseDepthCm > 0
            ? saved.baseDepthCm
            : saved.isOpen
            ? fallback.baseDepthCm
            : forecasts[resort.id]?.snowDepthCm ?? 0,
        snow24hCm: fallback.snow24hCm,
        snow7dCm: fallback.snow7dCm,
      };
    } else {
      result[resort.id] = fallback;
    }
  }
  return result;
}

export async function fetchAllResortStatuses(
  resorts: Resort[],
  forecasts: Record<string, ResortForecast>
): Promise<Record<string, ResortStatus>> {
  try {
    const res = await fetch('/api/resorts/statuses');
    if (res.ok) {
      const raw = (await res.json()) as Record<string, ResortStatus>;
      return normalizeStatusMap(raw, resorts, forecasts);
    }
  } catch {
    // Fall back to seeded map
  }
  return normalizeStatusMap({}, resorts, forecasts);
}

export async function syncAllResortStatuses(
  resorts: Resort[],
  forecasts: Record<string, ResortForecast>
): Promise<Record<string, ResortStatus>> {
  const res = await fetch('/api/resorts/sync', { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Sync failed (HTTP ${res.status})`);
  }
  const raw = (await res.json()) as Record<string, ResortStatus>;
  return normalizeStatusMap(raw, resorts, forecasts);
}
