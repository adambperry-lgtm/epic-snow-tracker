import React, { useState, useEffect } from 'react';
import {
  X,
  Mountain,
  Snowflake,
  Wind,
  Thermometer,
  CheckCircle2,
  XCircle,
  CloudSnow,
  Cloud,
  Sun,
  Radio,
  Pencil,
  Check,
  Moon,
} from 'lucide-react';
import type {
  Resort,
  ResortForecast,
  ResortStatus,
  UnitSystem,
} from '../types/resort';
import {
  formatElevation,
  formatSnow,
  formatTemp,
  formatWind,
} from '../utils/units';
import type { ResortStatusUpdateInput } from '../services/resortStatusService';

interface ResortDrawerProps {
  resort: Resort | null;
  forecast?: ResortForecast;
  status: ResortStatus | null;
  isLoadingStatus: boolean;
  units: UnitSystem;
  onUnitsToggle: () => void;
  onSaveStatus: (resortId: string, input: ResortStatusUpdateInput) => Promise<void>;
  onClose: () => void;
}

function renderWeatherIcon(code: number, snowCm: number) {
  if (snowCm >= 1.25 || (code >= 71 && code <= 77) || code === 85 || code === 86) {
    return <Snowflake className="h-4 w-4 text-cyan-300" />;
  }
  if (code >= 51 && code <= 67) {
    return <CloudSnow className="h-4 w-4 text-sky-300" />;
  }
  if (code === 0 || code === 1) {
    return <Sun className="h-4 w-4 text-amber-300" />;
  }
  return <Cloud className="h-4 w-4 text-slate-400" />;
}

export const ResortDrawer: React.FC<ResortDrawerProps> = ({
  resort,
  forecast,
  status,
  isLoadingStatus,
  units,
  onUnitsToggle,
  onSaveStatus,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(true);
  const [formLiftsOpen, setFormLiftsOpen] = useState(0);
  const [formTrailsOpen, setFormTrailsOpen] = useState(0);
  const [formBaseDepth, setFormBaseDepth] = useState(0);

  useEffect(() => {
    setIsEditing(false);
  }, [resort?.id]);

  useEffect(() => {
    if (status) {
      setFormOpen(status.isOpen);
      setFormLiftsOpen(status.liftsOpen);
      setFormTrailsOpen(status.trailsOpen);
      setFormBaseDepth(
        units === 'imperial'
          ? Math.round(status.baseDepthCm / 2.54)
          : status.baseDepthCm
      );
    }
  }, [status, units]);

  if (!resort) return null;

  const liftsOpen = status?.liftsOpen ?? 0;
  const liftsTotal = status?.liftsTotal ?? resort.totalLifts;
  const liftsPct = liftsTotal > 0 ? Math.round((liftsOpen / liftsTotal) * 100) : 0;

  const trailsOpen = status?.trailsOpen ?? 0;
  const trailsTotal = status?.trailsTotal ?? resort.totalTrails;
  const trailsPct = trailsTotal > 0 ? Math.round((trailsOpen / trailsTotal) * 100) : 0;

  const isOpen = status?.isOpen ?? resort.typicalSeasonOpen;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const baseCm =
        units === 'imperial'
          ? Math.round(formBaseDepth * 2.54)
          : Math.round(formBaseDepth);
      await onSaveStatus(resort.id, {
        isOpen: formOpen,
        liftsOpen: Math.max(0, Math.min(formLiftsOpen, liftsTotal)),
        liftsTotal,
        trailsOpen: Math.max(0, Math.min(formTrailsOpen, trailsTotal)),
        trailsTotal,
        baseDepthCm: Math.max(0, baseCm),
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const sourceLabel = isLoadingStatus
    ? 'Checking live status…'
    : status?.source === 'onthesnow-live'
    ? 'Live (OnTheSnow)'
    : status?.source === 'liftie-live'
    ? 'Live via Liftie'
    : status?.source === 'db-synced'
    ? 'Synced (Volume DB)'
    : 'Seasonal Estimate';

  const baseDepthCm = status?.baseDepthCm ?? 0;
  const snow5dCm = forecast?.snowfall5dCm ?? 0;
  const basePts = Math.min(35, Math.round((baseDepthCm / 150) * 35));
  const snowPts = Math.min(35, Math.round((snow5dCm / 30) * 35));
  const terrainPts = isOpen ? Math.min(30, Math.round(((liftsPct + trailsPct) / 200) * 30)) : 0;
  const conditionsScore = Math.max(0, Math.min(100, basePts + snowPts + terrainPts));

  const gaugeRadius = 26;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCircumference - (conditionsScore / 100) * gaugeCircumference;

  return (
    <aside
      aria-label={`${resort.name} details`}
      className="fixed inset-y-0 right-0 z-[1200] flex w-full flex-col border-l border-white/[0.09] bg-[#0b0c10]/98 shadow-2xl backdrop-blur-2xl sm:w-[440px]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                resort.accessType === 'unlimited'
                  ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30'
                  : 'bg-[#ff4b2b]/15 text-[#ff7a59] ring-1 ring-[#ff4b2b]/30'
              }`}
            >
              {resort.accessType === 'unlimited'
                ? 'Epic Unlimited'
                : `Partner · ${resort.accessLabel}`}
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                isOpen && status?.closedForDay
                  ? 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30'
                  : isOpen
                  ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-white/[0.06] text-zinc-400 ring-1 ring-white/10'
              }`}
            >
              {isOpen && status?.closedForDay ? (
                <Moon className="h-3 w-3" />
              ) : isOpen ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {isOpen && status?.closedForDay
                ? "Closed for Day · Today's Stats"
                : isOpen
                ? 'Open'
                : 'Closed'}
            </span>
          </div>

          <h2 className="mt-2.5 truncate font-display text-xl font-extrabold tracking-[-0.02em] text-white">
            {resort.name}
          </h2>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
            <span>{resort.location}</span>
            <span className="text-zinc-600">•</span>
            <span className="flex items-center gap-1 font-mono-tabular">
              <Mountain className="h-3.5 w-3.5 text-zinc-500" />
              Summit {formatElevation(resort.summitElevationFt, units)}
            </span>
          </div>
        </div>

        <button
          id="close-drawer-btn"
          type="button"
          onClick={onClose}
          aria-label="Close resort details"
          className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Carv-style Conditions Index */}
        <section
          aria-label="Conditions Index"
          className="carv-card flex items-center justify-between gap-4 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r={gaugeRadius}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="5"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={gaugeRadius}
                  fill="none"
                  stroke="#ff4b2b"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeOffset}
                  className="transition-all duration-700"
                />
              </svg>
              <span className="absolute font-mono-tabular text-base font-bold text-white">
                {conditionsScore}
              </span>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Conditions Index
              </div>
              <div className="mt-0.5 font-display text-sm font-bold text-white">
                {conditionsScore >= 75
                  ? 'Prime Alpine'
                  : conditionsScore >= 45
                  ? 'Good Coverage'
                  : 'Early / Variable'}
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-400">
                Base · 5d Snow · Terrain
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center font-mono-tabular">
            <div className="rounded-xl bg-white/[0.04] px-2 py-1.5">
              <div className="text-[10px] text-zinc-500">BASE</div>
              <div className="text-xs font-bold text-zinc-200">{basePts}/35</div>
            </div>
            <div className="rounded-xl bg-white/[0.04] px-2 py-1.5">
              <div className="text-[10px] text-zinc-500">SNOW</div>
              <div className="text-xs font-bold text-sky-300">{snowPts}/35</div>
            </div>
            <div className="rounded-xl bg-white/[0.04] px-2 py-1.5">
              <div className="text-[10px] text-zinc-500">OPEN</div>
              <div className="text-xs font-bold text-emerald-400">{terrainPts}/30</div>
            </div>
          </div>
        </section>

        {/* Snow Totals & Base */}
        <section aria-labelledby="snow-totals-heading">
          <div className="mb-2.5 flex items-center justify-between">
            <h3
              id="snow-totals-heading"
              className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
            >
              Snow Totals &amp; Base
            </h3>
            <button
              type="button"
              onClick={onUnitsToggle}
              className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 font-mono-tabular text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
            >
              {units === 'imperial' ? 'Switch to cm / °C' : 'Switch to in / °F'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="carv-card rounded-2xl p-3.5">
              <div className="text-[11px] text-zinc-400">Base Depth</div>
              <div className="mt-1 font-mono-tabular text-lg font-bold text-white">
                {status ? formatSnow(status.baseDepthCm, units, 0) : '--'}
              </div>
            </div>

            <div className="carv-card rounded-2xl p-3.5">
              <div className="text-[11px] text-zinc-400">Past 24h</div>
              <div className="mt-1 font-mono-tabular text-lg font-bold text-sky-300">
                {forecast ? formatSnow(forecast.snowfall24hCm, units) : '--'}
              </div>
            </div>

            <div className="carv-card rounded-2xl p-3.5">
              <div className="text-[11px] text-zinc-400">Past 7 Days</div>
              <div className="mt-1 font-mono-tabular text-lg font-bold text-blue-300">
                {forecast ? formatSnow(forecast.snowfall7dCm, units) : '--'}
              </div>
            </div>
          </div>
        </section>

        {/* High-Level Terrain & Lift Counts */}
        <section
          aria-labelledby="terrain-counts-heading"
          className="carv-card rounded-2xl p-4"
        >
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <h3
              id="terrain-counts-heading"
              className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
            >
              Terrain &amp; Lift Status
            </h3>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                <Radio
                  className={`h-3 w-3 ${
                    status?.source === 'onthesnow-live' ||
                    status?.source === 'liftie-live' ||
                    status?.source === 'db-synced'
                      ? 'text-emerald-400'
                      : 'text-zinc-500'
                  }`}
                />
                {sourceLabel}
              </span>

              <button
                type="button"
                onClick={() => setIsEditing((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
              >
                <Pencil className="h-2.5 w-2.5" />
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-white/[0.05] px-3 py-2">
                <span className="font-medium text-zinc-200">Operating Status</span>
                <button
                  type="button"
                  onClick={() => setFormOpen((v) => !v)}
                  className={`rounded-full px-3 py-1 font-semibold ${
                    formOpen
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                      : 'bg-white/10 text-zinc-300'
                  }`}
                >
                  {formOpen ? 'Open' : 'Closed'}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[11px] text-zinc-400">
                    Lifts (/{liftsTotal})
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={liftsTotal}
                    value={formLiftsOpen}
                    onChange={(e) => setFormLiftsOpen(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#08090c] px-2.5 py-1.5 font-mono-tabular text-white outline-none focus:border-[#ff4b2b]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] text-zinc-400">
                    Trails (/{trailsTotal})
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={trailsTotal}
                    value={formTrailsOpen}
                    onChange={(e) => setFormTrailsOpen(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#08090c] px-2.5 py-1.5 font-mono-tabular text-white outline-none focus:border-[#ff4b2b]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] text-zinc-400">
                    Base ({units === 'imperial' ? 'in' : 'cm'})
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={formBaseDepth}
                    onChange={(e) => setFormBaseDepth(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#08090c] px-2.5 py-1.5 font-mono-tabular text-white outline-none focus:border-[#ff4b2b]"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-1.5 rounded-full bg-white py-2 font-semibold text-[#08090c] transition-colors hover:bg-zinc-200 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                {isSaving ? 'Saving to Volume DB…' : 'Save to Persistent DB'}
              </button>
            </form>
          ) : (
            <div className="space-y-3.5">
              {/* Open Lifts */}
              <div>
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="font-medium text-zinc-200">Open Lifts</span>
                  <span className="font-mono-tabular font-semibold text-white">
                    {liftsOpen} / {liftsTotal}{' '}
                    <span className="text-zinc-400">({liftsPct}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-all duration-500"
                    style={{ width: `${liftsPct}%` }}
                  />
                </div>
              </div>

              {/* Open Trails */}
              <div>
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="font-medium text-zinc-200">Open Trails</span>
                  <span className="font-mono-tabular font-semibold text-white">
                    {trailsOpen} / {trailsTotal}{' '}
                    <span className="text-zinc-400">({trailsPct}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${trailsPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Near-Term Snow Forecast (Next 5 Days) */}
        <section aria-labelledby="forecast-heading">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3
                id="forecast-heading"
                className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
              >
                5-Day Summit Forecast
              </h3>
              {forecast && (
                <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 font-mono-tabular text-[11px] font-bold text-sky-300 ring-1 ring-sky-400/30">
                  Total: {formatSnow(forecast.snowfall5dCm, units)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-zinc-500">
              Open-Meteo @ {formatElevation(resort.summitElevationFt, units)}
            </span>
          </div>

          {!forecast || forecast.daily.length === 0 ? (
            <div className="carv-card rounded-2xl p-4 text-center text-xs text-zinc-400">
              Loading live Open-Meteo summit forecast…
            </div>
          ) : (
            <div className="space-y-2">
              {forecast.daily.map((day) => {
                const hasSnow = day.snowfallCm >= 1.25;
                return (
                  <div
                    key={day.date}
                    className={`flex items-center justify-between rounded-2xl border px-3.5 py-2.5 transition-colors ${
                      hasSnow
                        ? 'border-sky-400/30 bg-sky-500/[0.07]'
                        : 'border-white/[0.07] bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06]">
                        {renderWeatherIcon(day.weatherCode, day.snowfallCm)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {day.dayLabel}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-zinc-400">
                          {day.date.slice(5)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div className="hidden items-center gap-1 text-[11px] text-zinc-400 sm:flex">
                        <Wind className="h-3 w-3 text-zinc-500" />
                        <span className="font-mono-tabular">
                          {formatWind(day.windMaxKmh, units)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-zinc-300">
                        <Thermometer className="h-3 w-3 text-zinc-500" />
                        <span className="font-mono-tabular">
                          {formatTemp(day.tempMaxC, units)} /{' '}
                          <span className="text-zinc-500">
                            {formatTemp(day.tempMinC, units)}
                          </span>
                        </span>
                      </div>

                      <div
                        className={`min-w-[54px] rounded-full px-2.5 py-1 text-center font-mono-tabular text-xs font-bold ${
                          day.snowfallCm >= 14
                            ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/40'
                            : day.snowfallCm >= 1.25
                            ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/30'
                            : 'bg-white/[0.05] text-zinc-400'
                        }`}
                      >
                        {formatSnow(day.snowfallCm, units)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pass Eligibility Footer */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[11px] text-zinc-400">
          <span className="font-semibold text-zinc-200">2026–27 Pass Access: </span>
          {resort.passTiers.join(' & ')} ({resort.accessLabel})
        </div>
      </div>
    </aside>
  );
};
