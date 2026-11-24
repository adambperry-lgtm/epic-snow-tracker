import React, { useState, useRef, useEffect } from 'react';
import {
  MountainSnow,
  Search,
  RefreshCw,
  Globe,
  MapPin,
  X,
} from 'lucide-react';
import type { RegionView, Resort, ResortForecast, UnitSystem } from '../types/resort';
import { formatSnowShort } from '../utils/units';

interface NavbarProps {
  regionView: RegionView;
  onRegionChange: (view: RegionView) => void;
  intlFocus: 'europe' | 'japan';
  onIntlFocusChange: (focus: 'europe' | 'japan') => void;
  units: UnitSystem;
  onUnitsToggle: () => void;
  resorts: Resort[];
  forecasts: Record<string, ResortForecast>;
  onSelectResort: (resort: Resort) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  cacheAgeMinutes: number | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  regionView,
  onRegionChange,
  intlFocus,
  onIntlFocusChange,
  units,
  onUnitsToggle,
  resorts,
  forecasts,
  onSelectResort,
  isRefreshing,
  onRefresh,
  cacheAgeMinutes,
}) => {
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = query.trim()
    ? resorts
        .filter(
          (r) =>
            r.name.toLowerCase().includes(query.toLowerCase()) ||
            r.location.toLowerCase().includes(query.toLowerCase()) ||
            r.subRegion.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8)
    : [];

  const handlePickResort = (resort: Resort) => {
    setQuery('');
    setIsSearchOpen(false);
    onSelectResort(resort);
  };

  return (
    <header className="relative z-[1000] flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0b0c10]/95 px-5 py-3 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex items-center gap-3.5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff4b2b] text-white shadow-[0_0_20px_rgba(255,75,43,0.35)]">
          <MountainSnow className="h-5 w-5 stroke-[2.25]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-base font-extrabold tracking-[-0.03em] text-white sm:text-lg">
              EPIC SNOW
            </h1>
            <span className="hidden rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono-tabular text-[10px] font-semibold tracking-wider text-zinc-300 uppercase sm:inline-block">
              2026–27
            </span>
          </div>
          <p className="hidden text-[11px] font-medium tracking-wide text-zinc-400 md:block">
            68 Mountains · Live Summit Telemetry
          </p>
        </div>
      </div>

      {/* Regional Map Switcher */}
      <nav
        aria-label="Regional map switcher"
        className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#13151c] p-1"
      >
        <button
          id="nav-north-america"
          type="button"
          onClick={() => onRegionChange('north-america')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-[13px] ${
            regionView === 'north-america'
              ? 'bg-white text-[#08090c] shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span>North America</span>
          <span
            className={`rounded-full px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold ${
              regionView === 'north-america'
                ? 'bg-[#08090c]/10 text-[#08090c]'
                : 'bg-white/[0.07] text-zinc-400'
            }`}
          >
            44
          </span>
        </button>

        <button
          id="nav-europe-japan"
          type="button"
          onClick={() => onRegionChange('international')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-[13px] ${
            regionView === 'international'
              ? 'bg-white text-[#08090c] shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          <span>Europe &amp; Japan</span>
          <span
            className={`rounded-full px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold ${
              regionView === 'international'
                ? 'bg-[#08090c]/10 text-[#08090c]'
                : 'bg-white/[0.07] text-zinc-400'
            }`}
          >
            24
          </span>
        </button>

        {regionView === 'international' && (
          <div className="ml-1 hidden items-center gap-1 border-l border-white/10 pl-2 pr-1 sm:flex">
            <button
              id="jump-europe"
              type="button"
              onClick={() => onIntlFocusChange('europe')}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                intlFocus === 'europe'
                  ? 'bg-[#ff4b2b] text-white'
                  : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              Alps (22)
            </button>
            <button
              id="jump-japan"
              type="button"
              onClick={() => onIntlFocusChange('japan')}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                intlFocus === 'japan'
                  ? 'bg-[#ff4b2b] text-white'
                  : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              Japan (2)
            </button>
          </div>
        )}
      </nav>

      {/* Search, Units & Refresh */}
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <div ref={searchRef} className="relative flex-1 sm:w-64 sm:flex-initial">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-zinc-500" />
            <input
              id="resort-search-input"
              type="text"
              value={query}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              placeholder="Fly to resort (e.g. Vail, Hakuba)..."
              className="w-full rounded-full border border-white/[0.09] bg-[#13151c] py-1.5 pl-8.5 pr-7 text-xs text-white placeholder-zinc-500 outline-none transition-all focus:border-white/30 focus:bg-[#181b24]"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute right-2.5 text-zinc-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {isSearchOpen && query.trim().length > 0 && (
            <div className="absolute right-0 top-full z-[1100] mt-2 w-full min-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#111319]/98 shadow-2xl backdrop-blur-xl">
              {searchResults.length === 0 ? (
                <div className="px-4 py-3.5 text-xs text-zinc-400">
                  No resorts matching &ldquo;{query}&rdquo;
                </div>
              ) : (
                <ul className="max-h-72 divide-y divide-white/[0.06] overflow-y-auto">
                  {searchResults.map((r) => {
                    const f = forecasts[r.id];
                    const snow48 = f ? formatSnowShort(f.snowfall48hCm, units) : '--';
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => handlePickResort(r)}
                          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                        >
                          <div>
                            <div className="text-xs font-semibold text-white">
                              {r.name}
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              {r.location} ·{' '}
                              <span
                                className={
                                  r.accessType === 'unlimited'
                                    ? 'text-sky-400'
                                    : 'text-[#ff7a59]'
                                }
                              >
                                {r.accessLabel}
                              </span>
                            </div>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 font-mono-tabular text-xs font-semibold text-sky-300">
                            {snow48}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Unit Toggle */}
        <button
          id="unit-toggle-btn"
          type="button"
          onClick={onUnitsToggle}
          title="Toggle Imperial (°F / in) vs Metric (°C / cm)"
          className="rounded-full border border-white/[0.09] bg-[#13151c] px-3 py-1.5 font-mono-tabular text-xs font-semibold text-zinc-200 transition-colors hover:border-white/25 hover:text-white"
        >
          {units === 'imperial' ? '°F / in' : '°C / cm'}
        </button>

        {/* Refresh Forecasts */}
        <button
          id="refresh-forecasts-btn"
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          title={
            cacheAgeMinutes !== null
              ? `Forecast cached ${cacheAgeMinutes}m ago. Click to refresh.`
              : 'Refresh live Open-Meteo forecasts'
          }
          className="flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-[#13151c] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-[#ff4b2b]/60 hover:text-white disabled:opacity-50"
        >
          {isRefreshing ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#ff4b2b]" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-[#ff4b2b] shadow-[0_0_8px_#ff4b2b]" />
          )}
          <span className="hidden tracking-wide uppercase lg:inline">
            {isRefreshing ? 'Syncing' : 'Live'}
          </span>
        </button>
      </div>
    </header>
  );
};
