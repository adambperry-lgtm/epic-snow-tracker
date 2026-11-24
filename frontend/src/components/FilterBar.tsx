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
    <div className="relative z-[900] flex flex-wrap items-center justify-between gap-2.5 border-b border-white/[0.07] bg-[#0c0e13]/92 px-5 py-2.5 backdrop-blur-xl">
      {/* Left Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <Filter className="h-3.5 w-3.5 text-[#ff4b2b]" />
          <span className="hidden sm:inline">Filters</span>
        </div>

        {/* Sub-Region Dropdown */}
        <select
          id="filter-subregion"
          aria-label="Filter by Sub-Region"
          value={selectedSubRegion}
          onChange={(e) => onSubRegionChange(e.target.value as 'all' | SubRegion)}
          className="rounded-full border border-white/[0.09] bg-[#13151c] px-3 py-1 text-xs font-medium text-zinc-200 outline-none transition-colors hover:border-white/20 focus:border-white/35"
        >
          <option value="all">All Sub-Regions</option>
          {availableSubRegions.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>

        {/* Pass Tier Filter */}
        <div className="flex items-center rounded-full border border-white/[0.08] bg-[#13151c] p-0.5">
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
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                passFilter === item.id
                  ? 'bg-white/14 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Min 48h Snow Filter */}
        <div className="flex items-center gap-0.5 rounded-full border border-white/[0.08] bg-[#13151c] p-0.5">
          <Snowflake className="ml-2 mr-1 h-3 w-3 text-sky-400" />
          {snowOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onMinSnowChange(opt.value)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                minSnowCm === opt.value
                  ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Mobile Europe / Japan quick jump */}
        {regionView === 'international' && (
          <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#13151c] p-0.5 sm:hidden">
            <button
              type="button"
              onClick={() => onIntlFocusChange('europe')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                intlFocus === 'europe' ? 'bg-[#ff4b2b] text-white' : 'text-zinc-400'
              }`}
            >
              Alps
            </button>
            <button
              type="button"
              onClick={() => onIntlFocusChange('japan')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                intlFocus === 'japan' ? 'bg-[#ff4b2b] text-white' : 'text-zinc-400'
              }`}
            >
              Japan
            </button>
          </div>
        )}
      </div>

      {/* Right Legend & Count */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
        <div className="hidden items-center gap-3 xl:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600 ring-1 ring-zinc-400/50" />
            <span>0&quot;</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400 ring-1 ring-sky-200/70" />
            <span>1–5&quot;</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-1 ring-blue-300" />
            <span>6&quot;+ (48h)</span>
          </span>
          <span className="text-white/15">|</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-sky-400" />
            <span>Unlimited</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rotate-45 border-2 border-[#ff7a59]" />
            <span>Partner</span>
          </span>
        </div>

        <span className="rounded-full border border-white/[0.07] bg-[#13151c] px-2.5 py-0.5 font-mono-tabular text-zinc-300">
          {visibleCount} / {totalInRegion} resorts
        </span>

        {/* Map / List Switcher */}
        <div className="flex items-center rounded-full border border-white/[0.08] bg-[#13151c] p-0.5">
          <button
            id="view-mode-map"
            type="button"
            onClick={() => onViewModeChange('map')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              viewMode === 'map'
                ? 'bg-white text-[#08090c] shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span>Map</span>
          </button>
          <button
            id="view-mode-list"
            type="button"
            onClick={() => onViewModeChange('list')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              viewMode === 'list'
                ? 'bg-white text-[#08090c] shadow-sm'
                : 'text-zinc-400 hover:text-white'
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
