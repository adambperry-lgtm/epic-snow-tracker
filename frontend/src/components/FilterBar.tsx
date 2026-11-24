import React from 'react';
import { Filter, List, Map as MapIcon, Snowflake } from 'lucide-react';
import type {
  PassTier,
  RegionView,
  SubRegion,
  UnitSystem,
} from '../types/resort';

export type PassFilter = 'all' | PassTier;
export type MinSnowFilter = 0 | 2.5 | 7.5 | 14; // in cm (0", ~1", ~3", ~6")
export type ViewMode = 'map' | 'list';

interface FilterBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  regionView: RegionView;
  intlFocus: 'europe' | 'japan';
  onIntlFocusChange: (focus: 'europe' | 'japan') => void;
  availableSubRegions: SubRegion[];
  selectedSubRegion: 'all' | SubRegion;
  onSubRegionChange: (sub: 'all' | SubRegion) => void;
  passFilter: PassFilter;
  onPassFilterChange: (tier: PassFilter) => void;
  minSnowCm: MinSnowFilter;
  onMinSnowChange: (cm: MinSnowFilter) => void;
  units: UnitSystem;
  visibleCount: number;
  totalInRegion: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  viewMode,
  onViewModeChange,
  regionView,
  intlFocus,
  onIntlFocusChange,
  availableSubRegions,
  selectedSubRegion,
  onSubRegionChange,
  passFilter,
  onPassFilterChange,
  minSnowCm,
  onMinSnowChange,
  units,
  visibleCount,
  totalInRegion,
}) => {
  const snowOptions: { value: MinSnowFilter; label: string }[] =
    units === 'imperial'
      ? [
          { value: 0, label: 'Any Snow' },
          { value: 2.5, label: '1"+ (48h)' },
          { value: 7.5, label: '3"+ (48h)' },
          { value: 14, label: '6"+ (48h)' },
        ]
      : [
          { value: 0, label: 'Any Snow' },
          { value: 2.5, label: '3cm+ (48h)' },
          { value: 7.5, label: '8cm+ (48h)' },
          { value: 14, label: '14cm+ (48h)' },
        ];

  return (
    <div className="relative z-[900] flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800/80 bg-[#0d1424]/90 px-4 py-2 backdrop-blur-md">
      {/* Left Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <Filter className="h-3.5 w-3.5 text-sky-400" />
          <span className="hidden sm:inline">Filters:</span>
        </div>

        {/* Sub-Region Dropdown */}
        <select
          id="filter-subregion"
          aria-label="Filter by Sub-Region"
          value={selectedSubRegion}
          onChange={(e) => onSubRegionChange(e.target.value as 'all' | SubRegion)}
          className="rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 outline-none transition-colors hover:border-slate-600 focus:border-sky-500"
        >
          <option value="all">All Sub-Regions</option>
          {availableSubRegions.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>

        {/* Pass Tier Filter */}
        <div className="flex items-center rounded-lg border border-slate-700/80 bg-slate-900 p-0.5">
          {(
            [
              { id: 'all', label: 'All Passes' },
              { id: 'Epic Pass', label: 'Full Epic' },
              { id: 'Epic Local', label: 'Epic Local' },
            ] as { id: PassFilter; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              id={`filter-pass-${item.id.toLowerCase().replace(/\s+/g, '-')}`}
              type="button"
              onClick={() => onPassFilterChange(item.id)}
              className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                passFilter === item.id
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Min 48h Snow Filter */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900 p-0.5">
          <Snowflake className="ml-1.5 h-3 w-3 text-cyan-400" />
          {snowOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onMinSnowChange(opt.value)}
              className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                minSnowCm === opt.value
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Mobile Europe / Japan quick jump */}
        {regionView === 'international' && (
          <div className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900 p-0.5 sm:hidden">
            <button
              type="button"
              onClick={() => onIntlFocusChange('europe')}
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                intlFocus === 'europe' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400'
              }`}
            >
              Alps
            </button>
            <button
              type="button"
              onClick={() => onIntlFocusChange('japan')}
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                intlFocus === 'japan' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400'
              }`}
            >
              Japan
            </button>
          </div>
        )}
      </div>

      {/* Right Legend & Count */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <div className="hidden items-center gap-3 xl:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-500 ring-1 ring-slate-300/60" />
            <span>0&quot;</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 ring-1 ring-cyan-200/80" />
            <span>1–5&quot;</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 ring-1 ring-blue-300" />
            <span>6&quot;+ (48h)</span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-sky-400" />
            <span>Unlimited</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rotate-45 border-2 border-amber-400" />
            <span>Partner</span>
          </span>
        </div>

        <span className="rounded-md bg-slate-800/80 px-2 py-0.5 font-mono-tabular text-slate-300">
          {visibleCount} / {totalInRegion} resorts
        </span>

        {/* Map / List Switcher */}
        <div className="flex items-center rounded-lg border border-slate-700/80 bg-slate-900 p-0.5">
          <button
            id="view-mode-map"
            type="button"
            onClick={() => onViewModeChange('map')}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              viewMode === 'map'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span>Map</span>
          </button>
          <button
            id="view-mode-list"
            type="button"
            onClick={() => onViewModeChange('list')}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              viewMode === 'list'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>List</span>
          </button>
        </div>
      </div>
    </div>
  );
};
