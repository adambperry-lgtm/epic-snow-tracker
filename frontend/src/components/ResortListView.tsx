import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Moon,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type {
  Resort,
  ResortForecast,
  ResortStatus,
  UnitSystem,
} from '../types/resort';
import { formatSnow, formatSnowShort, getSnowTier } from '../utils/units';

export type SortKey =
  | 'name'
  | 'region'
  | 'lifts'
  | 'trails'
  | 'base'
  | 'forecast';

export type SortDirection = 'asc' | 'desc';

interface ResortListViewProps {
  resorts: Resort[];
  forecasts: Record<string, ResortForecast>;
  statuses: Record<string, ResortStatus>;
  selectedResort: Resort | null;
  units: UnitSystem;
  isSyncingStatuses: boolean;
  onSyncStatuses: () => void;
  onSelectResort: (resort: Resort) => void;
}

export const ResortListView: React.FC<ResortListViewProps> = ({
  resorts,
  forecasts,
  statuses,
  selectedResort,
  units,
  isSyncingStatuses,
  onSyncStatuses,
  onSelectResort,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('forecast');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Default to descending for numeric metrics, ascending for text
      setSortDir(key === 'name' || key === 'region' ? 'asc' : 'desc');
    }
  };

  const sortedResorts = useMemo(() => {
    const list = [...resorts];
    list.sort((a, b) => {
      const sa = statuses[a.id];
      const sb = statuses[b.id];
      const fa = forecasts[a.id];
      const fb = forecasts[b.id];

      let cmp = 0;

      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'region':
          cmp =
            a.subRegion.localeCompare(b.subRegion) ||
            a.name.localeCompare(b.name);
          break;
        case 'lifts': {
          const pctA =
            sa && sa.liftsTotal > 0 ? sa.liftsOpen / sa.liftsTotal : 0;
          const pctB =
            sb && sb.liftsTotal > 0 ? sb.liftsOpen / sb.liftsTotal : 0;
          cmp = pctA - pctB || (sa?.liftsOpen ?? 0) - (sb?.liftsOpen ?? 0);
          break;
        }
        case 'trails': {
          const pctA =
            sa && sa.trailsTotal > 0 ? sa.trailsOpen / sa.trailsTotal : 0;
          const pctB =
            sb && sb.trailsTotal > 0 ? sb.trailsOpen / sb.trailsTotal : 0;
          cmp = pctA - pctB || (sa?.trailsOpen ?? 0) - (sb?.trailsOpen ?? 0);
          break;
        }
        case 'base':
          cmp = (sa?.baseDepthCm ?? 0) - (sb?.baseDepthCm ?? 0);
          break;
        case 'forecast':
          cmp = (fa?.snowfall48hCm ?? 0) - (fb?.snowfall48hCm ?? 0);
          break;
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [resorts, statuses, forecasts, sortKey, sortDir]);

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-sky-400" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-sky-400" />
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#090d16]">
      {/* List View Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-[#0b1120]/70 px-4 py-2.5">
        <div className="text-xs text-slate-400">
          Click any column header to sort · Click a mountain for 5-day forecast
        </div>
        <button
          id="sync-all-statuses-btn"
          type="button"
          onClick={onSyncStatuses}
          disabled={isSyncingStatuses}
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/20 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isSyncingStatuses ? 'animate-spin' : ''}`}
          />
          {isSyncingStatuses ? 'Syncing Live Counts…' : 'Sync Live Lift & Trail Counts'}
        </button>
      </div>

      {/* Scrollable Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-slate-800 bg-[#0d1424]/95 text-[11px] font-semibold uppercase tracking-wider text-slate-400 backdrop-blur-md">
            <tr>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="inline-flex items-center gap-1.5 hover:text-white"
                >
                  Mountain
                  {renderSortIcon('name')}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('region')}
                  className="inline-flex items-center gap-1.5 hover:text-white"
                >
                  Region
                  {renderSortIcon('region')}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('lifts')}
                  className="inline-flex items-center gap-1.5 hover:text-white"
                >
                  Lifts Open
                  {renderSortIcon('lifts')}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('trails')}
                  className="inline-flex items-center gap-1.5 hover:text-white"
                >
                  Trails Open
                  {renderSortIcon('trails')}
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('base')}
                  className="inline-flex items-center gap-1.5 hover:text-white"
                >
                  Snow Base
                  {renderSortIcon('base')}
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('forecast')}
                  className="inline-flex items-center gap-1.5 hover:text-white"
                >
                  48h Forecast
                  {renderSortIcon('forecast')}
                </button>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/70">
            {sortedResorts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                  No resorts match the current filters.
                </td>
              </tr>
            ) : (
              sortedResorts.map((resort) => {
                const status = statuses[resort.id];
                const forecast = forecasts[resort.id];
                const isSelected = selectedResort?.id === resort.id;

                const isOpen = status?.isOpen ?? resort.typicalSeasonOpen;
                const liftsOpen = status?.liftsOpen ?? 0;
                const liftsTotal = status?.liftsTotal ?? resort.totalLifts;
                const liftsPct =
                  liftsTotal > 0 ? Math.round((liftsOpen / liftsTotal) * 100) : 0;

                const trailsOpen = status?.trailsOpen ?? 0;
                const trailsTotal = status?.trailsTotal ?? resort.totalTrails;
                const trailsPct =
                  trailsTotal > 0 ? Math.round((trailsOpen / trailsTotal) * 100) : 0;

                const snow48Cm = forecast?.snowfall48hCm ?? 0;
                const snowTier = getSnowTier(snow48Cm);

                return (
                  <tr
                    key={resort.id}
                    onClick={() => onSelectResort(resort)}
                    className={`cursor-pointer transition-colors hover:bg-slate-800/45 ${
                      isSelected ? 'bg-sky-500/10' : ''
                    }`}
                  >
                    {/* Mountain */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            isOpen && status?.closedForDay
                              ? 'bg-indigo-500/15 text-indigo-300'
                              : isOpen
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                          title={
                            isOpen && status?.closedForDay
                              ? "Closed for day (showing today's stats)"
                              : isOpen
                              ? 'Open'
                              : 'Closed'
                          }
                        >
                          {isOpen && status?.closedForDay ? (
                            <Moon className="h-3.5 w-3.5" />
                          ) : isOpen ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-100">
                              {resort.name}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                resort.accessType === 'unlimited'
                                  ? 'bg-sky-500/15 text-sky-300'
                                  : 'bg-amber-500/15 text-amber-300'
                              }`}
                            >
                              {resort.accessLabel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {resort.location}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Region */}
                    <td className="px-4 py-3 text-slate-300">{resort.subRegion}</td>

                    {/* Lifts Open */}
                    <td className="px-4 py-3">
                      <div className="w-32">
                        <div className="mb-1 flex items-center justify-between font-mono-tabular text-[11px]">
                          <span className="font-semibold text-slate-200">
                            {liftsOpen} / {liftsTotal}
                          </span>
                          <span className="text-slate-400">{liftsPct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-sky-400"
                            style={{ width: `${liftsPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Trails Open */}
                    <td className="px-4 py-3">
                      <div className="w-32">
                        <div className="mb-1 flex items-center justify-between font-mono-tabular text-[11px]">
                          <span className="font-semibold text-slate-200">
                            {trailsOpen} / {trailsTotal}
                          </span>
                          <span className="text-slate-400">{trailsPct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${trailsPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Snow Base */}
                    <td className="px-4 py-3 text-right font-mono-tabular font-semibold text-slate-200">
                      {status ? formatSnow(status.baseDepthCm, units, 0) : '--'}
                    </td>

                    {/* 48h Forecast */}
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block min-w-[46px] rounded-md px-2 py-0.5 text-center font-mono-tabular text-xs font-bold ${
                          snowTier === 'heavy'
                            ? 'bg-blue-500/25 text-blue-300 ring-1 ring-blue-400/40'
                            : snowTier === 'moderate'
                            ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30'
                            : 'bg-slate-800/80 text-slate-400'
                        }`}
                      >
                        {forecast ? formatSnowShort(snow48Cm, units) : '--'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
