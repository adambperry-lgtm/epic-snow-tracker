import type { DailyForecast, Resort, ResortForecast } from '../types/resort';

const CACHE_KEY = 'epic_snow_tracker_forecasts_v3';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const BATCH_SIZE = 25;

interface CachedForecastStore {
  timestamp: number;
  data: Record<string, ResortForecast>;
}

interface OpenMeteoDailyResponse {
  current?: {
    snow_depth?: number | null; // meters
  };
  daily?: {
    time: string[];
    weather_code: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    snowfall_sum: (number | null)[];
    wind_speed_10m_max: (number | null)[];
  };
}

function formatDayLabel(dateStr: string, indexFromToday: number): string {
  if (indexFromToday === 0) return 'Today';
  if (indexFromToday === 1) return 'Tomorrow';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function loadFromCache(): Record<string, ResortForecast> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedForecastStore = JSON.parse(raw);
    if (!parsed || typeof parsed.timestamp !== 'number' || !parsed.data) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function saveToCache(data: Record<string, ResortForecast>): void {
  try {
    const payload: CachedForecastStore = {
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

function parseOpenMeteoItem(resort: Resort, item: OpenMeteoDailyResponse): ResortForecast {
  const dailyRaw = item.daily;
  const now = Date.now();
  const rawSnowDepthM = item.current?.snow_depth;
  const snowDepthCm =
    typeof rawSnowDepthM === 'number' ? Math.round(rawSnowDepthM * 100) : null;

  if (!dailyRaw || !dailyRaw.time || dailyRaw.time.length === 0) {
    return {
      resortId: resort.id,
      fetchedAt: now,
      snowDepthCm,
      snowfall48hCm: 0,
      snowfall5dCm: 0,
      snowfall7dCm: 0,
      snowfall24hCm: 0,
      daily: [],
    };
  }

  // With past_days=7 and forecast_days=5, indices 0..6 are the past 7 days,
  // index 7 is today, and 8..11 are the next 4 days.
  const pastDaysCount = Math.max(0, dailyRaw.time.length - 5);

  const snowfall24hCm =
    pastDaysCount > 0 ? dailyRaw.snowfall_sum[pastDaysCount - 1] ?? 0 : 0;

  // Actual past 7-day snowfall (excludes future forecast)
  let snowfall7dCm = 0;
  for (let i = 0; i < pastDaysCount; i++) {
    snowfall7dCm += dailyRaw.snowfall_sum[i] ?? 0;
  }

  // Next 5 days starting from today (index = pastDaysCount)
  const upcomingDaily: DailyForecast[] = [];
  for (let i = pastDaysCount; i < dailyRaw.time.length && upcomingDaily.length < 5; i++) {
    const idxFromToday = i - pastDaysCount;
    upcomingDaily.push({
      date: dailyRaw.time[i],
      dayLabel: formatDayLabel(dailyRaw.time[i], idxFromToday),
      snowfallCm: dailyRaw.snowfall_sum[i] ?? 0,
      tempMaxC: dailyRaw.temperature_2m_max[i] ?? 0,
      tempMinC: dailyRaw.temperature_2m_min[i] ?? 0,
      windMaxKmh: dailyRaw.wind_speed_10m_max[i] ?? 0,
      weatherCode: dailyRaw.weather_code[i] ?? 0,
    });
  }

  // 48h forecasted snowfall = Today + Tomorrow
  const snowfall48hCm =
    (upcomingDaily[0]?.snowfallCm ?? 0) + (upcomingDaily[1]?.snowfallCm ?? 0);

  // 5-day forecasted snowfall = sum of next 5 days
  const snowfall5dCm = upcomingDaily.reduce((acc, d) => acc + d.snowfallCm, 0);

  return {
    resortId: resort.id,
    fetchedAt: now,
    snowDepthCm,
    snowfall48hCm: Math.round(snowfall48hCm * 10) / 10,
    snowfall5dCm: Math.round(snowfall5dCm * 10) / 10,
    snowfall7dCm: Math.round(snowfall7dCm * 10) / 10,
    snowfall24hCm: Math.round(snowfall24hCm * 10) / 10,
    daily: upcomingDaily,
  };
}

async function fetchBatch(resorts: Resort[]): Promise<Record<string, ResortForecast>> {
  const lats = resorts.map((r) => r.lat.toFixed(4)).join(',');
  const lngs = resorts.map((r) => r.lng.toFixed(4)).join(',');
  const elevs = resorts
    .map((r) => Math.round(r.summitElevationFt * 0.3048))
    .join(',');

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lats}` +
    `&longitude=${lngs}` +
    `&elevation=${elevs}` +
    `&current=snow_depth` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,wind_speed_10m_max` +
    `&past_days=7&forecast_days=5&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo HTTP ${response.status}`);
  }

  const json = await response.json();
  const items: OpenMeteoDailyResponse[] = Array.isArray(json) ? json : [json];

  const result: Record<string, ResortForecast> = {};
  resorts.forEach((resort, idx) => {
    if (items[idx]) {
      result[resort.id] = parseOpenMeteoItem(resort, items[idx]);
    }
  });
  return result;
}

export async function fetchAllResortForecasts(
  resorts: Resort[],
  forceRefresh = false
): Promise<{ forecasts: Record<string, ResortForecast>; fromCache: boolean }> {
  if (!forceRefresh) {
    const cached = loadFromCache();
    if (cached && Object.keys(cached).length >= resorts.length * 0.8) {
      return { forecasts: cached, fromCache: true };
    }
  }

  const batches: Resort[][] = [];
  for (let i = 0; i < resorts.length; i += BATCH_SIZE) {
    batches.push(resorts.slice(i, i + BATCH_SIZE));
  }

  const batchResults = await Promise.allSettled(batches.map((b) => fetchBatch(b)));
  const merged: Record<string, ResortForecast> = {};

  for (const res of batchResults) {
    if (res.status === 'fulfilled') {
      Object.assign(merged, res.value);
    }
  }

  if (Object.keys(merged).length > 0) {
    saveToCache(merged);
  }

  return { forecasts: merged, fromCache: false };
}

export function getCacheAgeMinutes(): number | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedForecastStore = JSON.parse(raw);
    if (!parsed?.timestamp) return null;
    return Math.max(0, Math.round((Date.now() - parsed.timestamp) / 60000));
  } catch {
    return null;
  }
}
