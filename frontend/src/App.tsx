import { useEffect, useMemo, useState, useCallback } from 'react';
import { RESORTS } from './data/resorts';
import type {
  RegionView,
  Resort,
  ResortForecast,
  ResortStatus,
  SubRegion,
  UnitSystem,
} from './types/resort';
import {
  fetchAllResortForecasts,
  getCacheAgeMinutes,
} from './services/weatherService';
import {
  fetchAllResortStatuses,
  fetchResortStatus,
  getSeededResortStatus,
  saveResortStatus,
  syncAllResortStatuses,
  type ResortStatusUpdateInput,
} from './services/resortStatusService';
import { Navbar } from './components/Navbar';
import {
  FilterBar,
  type MinSnowFilter,
  type PassFilter,
  type ViewMode,
} from './components/FilterBar';
import { SnowMap } from './components/SnowMap';
import { ResortListView } from './components/ResortListView';
import { ResortDrawer } from './components/ResortDrawer';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [regionView, setRegionView] = useState<RegionView>('north-america');
  const [intlFocus, setIntlFocus] = useState<'europe' | 'japan'>('europe');
  const [units, setUnits] = useState<UnitSystem>('imperial');

  const [selectedSubRegion, setSelectedSubRegion] = useState<'all' | SubRegion>('all');
  const [passFilter, setPassFilter] = useState<PassFilter>('all');
  const [minSnowCm, setMinSnowCm] = useState<MinSnowFilter>(0);

  const [forecasts, setForecasts] = useState<Record<string, ResortForecast>>({});
  const [allStatuses, setAllStatuses] = useState<Record<string, ResortStatus>>({});
  const [isSyncingStatuses, setIsSyncingStatuses] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [cacheAgeMinutes, setCacheAgeMinutes] = useState<number | null>(null);

  const [selectedResort, setSelectedResort] = useState<Resort | null>(null);
  const [resortStatus, setResortStatus] = useState<ResortStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [flyToTarget, setFlyToTarget] = useState<{
    resort: Resort;
    timestamp: number;
  } | null>(null);

  const loadForecasts = useCallback(async (force = false) => {
    setIsRefreshing(true);
    try {
      const { forecasts: data } = await fetchAllResortForecasts(RESORTS, force);
      setForecasts(data);
      setCacheAgeMinutes(getCacheAgeMinutes());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadForecasts(false);
  }, [loadForecasts]);

  // Load bulk statuses for list view & map tooltips whenever forecasts update
  useEffect(() => {
    let cancelled = false;
    fetchAllResortStatuses(RESORTS, forecasts).then((map) => {
      if (!cancelled) {
        setAllStatuses(map);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [forecasts]);

  const handleSyncAllStatuses = useCallback(async () => {
    setIsSyncingStatuses(true);
    try {
      const updated = await syncAllResortStatuses(RESORTS, forecasts);
      setAllStatuses(updated);
      if (selectedResort && updated[selectedResort.id]) {
        setResortStatus(updated[selectedResort.id]);
      }
    } finally {
      setIsSyncingStatuses(false);
    }
  }, [forecasts, selectedResort]);

  // Reset sub-region filter when switching between North America and Europe & Japan
  const handleRegionChange = (view: RegionView) => {
    setRegionView(view);
    setSelectedSubRegion('all');
    setSelectedResort(null);
  };

  const handleIntlFocusChange = (focus: 'europe' | 'japan') => {
    setIntlFocus(focus);
    setSelectedSubRegion('all');
  };

  // Load live OnTheSnow / DB / Liftie status whenever a resort is selected
  useEffect(() => {
    if (!selectedResort) {
      setResortStatus(null);
      return;
    }

    let cancelled = false;
    const forecast = forecasts[selectedResort.id];
    setResortStatus(
      allStatuses[selectedResort.id] ??
        getSeededResortStatus(selectedResort, forecast)
    );
    setIsLoadingStatus(true);

    fetchResortStatus(selectedResort, forecast).then((status) => {
      if (!cancelled) {
        setResortStatus(status);
        setAllStatuses((prev) => ({ ...prev, [selectedResort.id]: status }));
        setIsLoadingStatus(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedResort, forecasts]);

  const handleSelectResort = useCallback(
    (resort: Resort, fly = true) => {
      if (resort.regionView !== regionView) {
        setRegionView(resort.regionView);
        setSelectedSubRegion('all');
      }
      if (resort.regionView === 'international') {
        setIntlFocus(resort.country === 'JP' ? 'japan' : 'europe');
      }
      setSelectedResort(resort);
      if (fly) {
        setTimeout(() => {
          setFlyToTarget({ resort, timestamp: Date.now() });
        }, 50);
      }
    },
    [regionView]
  );

  const resortsInRegion = useMemo(
    () => RESORTS.filter((r) => r.regionView === regionView),
    [regionView]
  );

  const availableSubRegions = useMemo(() => {
    const set = new Set<SubRegion>();
    resortsInRegion.forEach((r) => set.add(r.subRegion));
    return Array.from(set);
  }, [resortsInRegion]);

  const filteredResorts = useMemo(() => {
    return resortsInRegion.filter((r) => {
      if (selectedSubRegion !== 'all' && r.subRegion !== selectedSubRegion) {
        return false;
      }
      if (passFilter !== 'all' && !r.passTiers.includes(passFilter)) {
        return false;
      }
      if (minSnowCm > 0) {
        const snow48 = forecasts[r.id]?.snowfall48hCm ?? 0;
        if (snow48 < minSnowCm) return false;
      }
      return true;
    });
  }, [resortsInRegion, selectedSubRegion, passFilter, minSnowCm, forecasts]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#08090c] text-zinc-100">
      <Navbar
        regionView={regionView}
        onRegionChange={handleRegionChange}
        intlFocus={intlFocus}
        onIntlFocusChange={handleIntlFocusChange}
        units={units}
        onUnitsToggle={() =>
          setUnits((prev) => (prev === 'imperial' ? 'metric' : 'imperial'))
        }
        resorts={RESORTS}
        forecasts={forecasts}
        onSelectResort={(r) => handleSelectResort(r, true)}
        isRefreshing={isRefreshing}
        onRefresh={() => loadForecasts(true)}
        cacheAgeMinutes={cacheAgeMinutes}
      />

      <FilterBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        regionView={regionView}
        intlFocus={intlFocus}
        onIntlFocusChange={handleIntlFocusChange}
        availableSubRegions={availableSubRegions}
        selectedSubRegion={selectedSubRegion}
        onSubRegionChange={setSelectedSubRegion}
        passFilter={passFilter}
        onPassFilterChange={setPassFilter}
        minSnowCm={minSnowCm}
        onMinSnowChange={setMinSnowCm}
        units={units}
        visibleCount={filteredResorts.length}
        totalInRegion={resortsInRegion.length}
      />

      <main className="relative flex flex-1 overflow-hidden">
        {viewMode === 'map' ? (
          <SnowMap
            resorts={filteredResorts}
            forecasts={forecasts}
            selectedResort={selectedResort}
            flyToTarget={flyToTarget}
            regionView={regionView}
            intlFocus={intlFocus}
            units={units}
            onSelectResort={(r) => handleSelectResort(r, true)}
          />
        ) : (
          <ResortListView
            resorts={filteredResorts}
            forecasts={forecasts}
            statuses={allStatuses}
            selectedResort={selectedResort}
            units={units}
            isSyncingStatuses={isSyncingStatuses}
            onSyncStatuses={handleSyncAllStatuses}
            onSelectResort={(r) => handleSelectResort(r, false)}
          />
        )}

        <ResortDrawer
          resort={selectedResort}
          forecast={selectedResort ? forecasts[selectedResort.id] : undefined}
          status={resortStatus}
          isLoadingStatus={isLoadingStatus}
          units={units}
          onUnitsToggle={() =>
            setUnits((prev) => (prev === 'imperial' ? 'metric' : 'imperial'))
          }
          onSaveStatus={async (resortId: string, input: ResortStatusUpdateInput) => {
            const updated = await saveResortStatus(
              resortId,
              input,
              forecasts[resortId]
            );
            setResortStatus(updated);
            setAllStatuses((prev) => ({ ...prev, [resortId]: updated }));
          }}
          onClose={() => setSelectedResort(null)}
        />
      </main>
    </div>
  );
}

export default App;
