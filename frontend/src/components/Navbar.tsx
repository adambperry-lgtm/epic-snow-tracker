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
    <header className="relative z-[1000] flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-[#0b1120]/95 px-4 py-2.5 backdrop-blur-md">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 ring-1 ring-sky-400/30">
          <MountainSnow className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
              Epic Snow Tracker
            </h1>
            <span className="hidden rounded-md bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium text-sky-300 ring-1 ring-slate-700 sm:inline-block">
              2026–27
            </span>
          </div>
          <p className="hidden text-[11px] text-slate-400 md:block">
            68 Epic Pass &amp; Partner Mountains · Live Summit Forecasts
          </p>
        </div>
      </div>

      {/* Regional Map Switcher */}
      <nav
        aria-label="Regional map switcher"
        className="flex items-center gap-1.5 rounded-xl bg-slate-900/90 p-1 ring-1 ring-slate-800"
      >
        <button
          id="nav-north-america"
          type="button"
          onClick={() => onRegionChange('north-america')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
            regionView === 'north-america'
              ? 'bg-sky-500 text-slate-950 shadow-sm shadow-sky-500/25'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span>North America</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono-tabular ${
              regionView === 'north-america'
                ? 'bg-slate-950/20 text-slate-950'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            44
          </span>
        </button>

        <button
          id="nav-europe-japan"
          type="button"
          onClick={() => onRegionChange('international')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
            regionView === 'international'
              ? 'bg-sky-500 text-slate-950 shadow-sm shadow-sky-500/25'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          <span>Europe &amp; Japan</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono-tabular ${
              regionView === 'international'
                ? 'bg-slate-950/20 text-slate-950'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            24
          </span>
        </button>

        {regionView === 'international' && (
          <div className="ml-1 hidden items-center gap-1 border-l border-slate-700/80 pl-2 sm:flex">
            <button
              id="jump-europe"
              type="button"
              onClick={() => onIntlFocusChange('europe')}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                intlFocus === 'europe'
                  ? 'bg-slate-700 text-sky-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              Alps (22)
            </button>
            <button
              id="jump-japan"
              type="button"
              onClick={() => onIntlFocusChange('japan')}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                intlFocus === 'japan'
                  ? 'bg-slate-700 text-sky-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              Japan (2)
            </button>
          </div>
        )}
      </nav>

      {/* Search, Units & Refresh */}
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <div ref={searchRef} className="relative flex-1 sm:w-60 sm:flex-initial">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
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
              className="w-full rounded-lg border border-slate-700/80 bg-slate-900/90 py-1.5 pl-8 pr-7 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {isSearchOpen && query.trim().length > 0 && (
            <div className="absolute right-0 top-full z-[1100] mt-1.5 w-full min-w-[260px] overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
              {searchResults.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-400">
                  No resorts matching &ldquo;{query}&rdquo;
                </div>
              ) : (
                <ul className="max-h-72 divide-y divide-slate-800/80 overflow-y-auto">
                  {searchResults.map((r) => {
                    const f = forecasts[r.id];
                    const snow48 = f ? formatSnowShort(f.snowfall48hCm, units) : '--';
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => handlePickResort(r)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-slate-800/80"
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-100">
                              {r.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {r.location} ·{' '}
                              <span
                                className={
                                  r.accessType === 'unlimited'
                                    ? 'text-sky-400'
                                    : 'text-amber-400'
                                }
                              >
                                {r.accessLabel}
                              </span>
                            </div>
                          </div>
                          <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono-tabular text-xs font-semibold text-cyan-300">
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
          className="rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 font-mono-tabular text-xs font-semibold text-slate-200 transition-colors hover:border-sky-500/60 hover:text-sky-300"
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
          className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-sky-500/60 hover:text-sky-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
          <span className="hidden lg:inline">
            {isRefreshing ? 'Syncing…' : 'Live'}
          </span>
        </button>
      </div>
    </header>
  );
};
