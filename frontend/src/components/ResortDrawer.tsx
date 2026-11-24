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

  return (
    <aside
      aria-label={`${resort.name} details`}
      className="fixed inset-y-0 right-0 z-[1200] flex w-full flex-col border-l border-slate-800 bg-[#0b1120]/98 shadow-2xl backdrop-blur-xl sm:w-[430px]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/90 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                resort.accessType === 'unlimited'
                  ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30'
                  : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
              }`}
            >
              {resort.accessType === 'unlimited'
                ? 'Epic Unlimited'
                : `Partner · ${resort.accessLabel}`}
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isOpen
                  ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700'
              }`}
            >
              {isOpen ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {isOpen ? 'Open' : 'Closed'}
            </span>
          </div>

          <h2 className="mt-2 truncate text-xl font-bold tracking-tight text-white">
            {resort.name}
          </h2>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>{resort.location}</span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1 font-mono-tabular">
              <Mountain className="h-3.5 w-3.5 text-slate-500" />
              Summit {formatElevation(resort.summitElevationFt, units)}
            </span>
          </div>
        </div>

        <button
          id="close-drawer-btn"
          type="button"
          onClick={onClose}
          aria-label="Close resort details"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Snow Totals & Base */}
        <section aria-labelledby="snow-totals-heading">
          <div className="mb-2.5 flex items-center justify-between">
            <h3
              id="snow-totals-heading"
              className="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Snow Totals &amp; Base
            </h3>
            <button
              type="button"
              onClick={onUnitsToggle}
              className="rounded-md bg-slate-800/80 px-2 py-0.5 font-mono-tabular text-[11px] font-medium text-sky-300 hover:bg-slate-800"
            >
              {units === 'imperial' ? 'Switch to cm / °C' : 'Switch to in / °F'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[11px] text-slate-400">Base Depth</div>
              <div className="mt-1 font-mono-tabular text-lg font-bold text-white">
                {status ? formatSnow(status.baseDepthCm, units, 0) : '--'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[11px] text-slate-400">Past 24h</div>
              <div className="mt-1 font-mono-tabular text-lg font-bold text-cyan-300">
                {forecast ? formatSnow(forecast.snowfall24hCm, units) : '--'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[11px] text-slate-400">Past 7 Days</div>
              <div className="mt-1 font-mono-tabular text-lg font-bold text-sky-300">
                {forecast ? formatSnow(forecast.snowfall7dCm, units) : '--'}
              </div>
            </div>
          </div>
        </section>

        {/* High-Level Terrain & Lift Counts */}
        <section
          aria-labelledby="terrain-counts-heading"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3
              id="terrain-counts-heading"
              className="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Terrain &amp; Lift Status
            </h3>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Radio
                  className={`h-3 w-3 ${
                    status?.source === 'onthesnow-live' ||
                    status?.source === 'liftie-live' ||
                    status?.source === 'db-synced'
                      ? 'text-emerald-400'
                      : 'text-slate-500'
                  }`}
                />
                {sourceLabel}
              </span>

              <button
                type="button"
                onClick={() => setIsEditing((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:border-sky-500/60 hover:text-sky-300"
              >
                <Pencil className="h-2.5 w-2.5" />
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
                <span className="font-medium text-slate-200">Operating Status</span>
                <button
                  type="button"
                  onClick={() => setFormOpen((v) => !v)}
                  className={`rounded-md px-2.5 py-1 font-semibold ${
                    formOpen
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {formOpen ? 'Open' : 'Closed'}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[11px] text-slate-400">
                    Lifts (/{liftsTotal})
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={liftsTotal}
                    value={formLiftsOpen}
                    onChange={(e) => setFormLiftsOpen(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 font-mono-tabular text-white outline-none focus:border-sky-500"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] text-slate-400">
                    Trails (/{trailsTotal})
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={trailsTotal}
                    value={formTrailsOpen}
                    onChange={(e) => setFormTrailsOpen(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 font-mono-tabular text-white outline-none focus:border-sky-500"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] text-slate-400">
                    Base ({units === 'imperial' ? 'in' : 'cm'})
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={formBaseDepth}
                    onChange={(e) => setFormBaseDepth(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 font-mono-tabular text-white outline-none focus:border-sky-500"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-1.5 font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:opacity-50"
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
                  <span className="font-medium text-slate-200">Open Lifts</span>
                  <span className="font-mono-tabular font-semibold text-white">
                    {liftsOpen} / {liftsTotal}{' '}
                    <span className="text-slate-400">Lifts Open ({liftsPct}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-all duration-500"
                    style={{ width: `${liftsPct}%` }}
                  />
                </div>
              </div>

              {/* Open Trails */}
              <div>
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="font-medium text-slate-200">Open Trails</span>
                  <span className="font-mono-tabular font-semibold text-white">
                    {trailsOpen} / {trailsTotal}{' '}
                    <span className="text-slate-400">Trails Open ({trailsPct}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
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
          <div className="mb-2.5 flex items-center justify-between">
            <h3
              id="forecast-heading"
              className="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              5-Day Summit Forecast
            </h3>
            <span className="text-[11px] text-slate-500">
              Open-Meteo @ {formatElevation(resort.summitElevationFt, units)}
            </span>
          </div>

          {!forecast || forecast.daily.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center text-xs text-slate-400">
              Loading live Open-Meteo summit forecast…
            </div>
          ) : (
            <div className="space-y-2">
              {forecast.daily.map((day) => {
                const hasSnow = day.snowfallCm >= 1.25;
                return (
                  <div
                    key={day.date}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition-colors ${
                      hasSnow
                        ? 'border-cyan-500/30 bg-cyan-950/20'
                        : 'border-slate-800/90 bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/90">
                        {renderWeatherIcon(day.weatherCode, day.snowfallCm)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {day.dayLabel}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-slate-400">
                          {day.date.slice(5)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div className="hidden items-center gap-1 text-[11px] text-slate-400 sm:flex">
                        <Wind className="h-3 w-3 text-slate-500" />
                        <span className="font-mono-tabular">
                          {formatWind(day.windMaxKmh, units)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-slate-300">
                        <Thermometer className="h-3 w-3 text-slate-500" />
                        <span className="font-mono-tabular">
                          {formatTemp(day.tempMaxC, units)} /{' '}
                          <span className="text-slate-400">
                            {formatTemp(day.tempMinC, units)}
                          </span>
                        </span>
                      </div>

                      <div
                        className={`min-w-[54px] rounded-lg px-2 py-1 text-center font-mono-tabular text-xs font-bold ${
                          day.snowfallCm >= 14
                            ? 'bg-blue-500/25 text-blue-300 ring-1 ring-blue-400/40'
                            : day.snowfallCm >= 1.25
                            ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30'
                            : 'bg-slate-800/80 text-slate-400'
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
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 px-3.5 py-2.5 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-300">2026–27 Pass Access: </span>
          {resort.passTiers.join(' & ')} ({resort.accessLabel})
        </div>
      </div>
    </aside>
  );
};
