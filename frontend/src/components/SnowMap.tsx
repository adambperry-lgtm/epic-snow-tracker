import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { RegionView, Resort, ResortForecast, UnitSystem } from '../types/resort';
import { formatSnowShort, getSnowTier } from '../utils/units';

interface SnowMapProps {
  resorts: Resort[];
  forecasts: Record<string, ResortForecast>;
  selectedResort: Resort | null;
  flyToTarget: { resort: Resort; timestamp: number } | null;
  regionView: RegionView;
  intlFocus: 'europe' | 'japan';
  units: UnitSystem;
  onSelectResort: (resort: Resort) => void;
}

const REGION_VIEWS: Record<string, { center: [number, number]; zoom: number }> = {
  'north-america': { center: [42.0, -96.5], zoom: 4 },
  europe: { center: [46.5, 9.6], zoom: 6 },
  japan: { center: [39.6, 139.2], zoom: 5 },
};

const MapCameraController: React.FC<{
  regionView: RegionView;
  intlFocus: 'europe' | 'japan';
  flyToTarget: { resort: Resort; timestamp: number } | null;
}> = ({ regionView, intlFocus, flyToTarget }) => {
  const map = useMap();

  useEffect(() => {
    const key = regionView === 'north-america' ? 'north-america' : intlFocus;
    const view = REGION_VIEWS[key];
    if (view) {
      map.flyTo(view.center, view.zoom, { duration: 1.0 });
    }
  }, [regionView, intlFocus, map]);

  useEffect(() => {
    if (flyToTarget) {
      const { resort } = flyToTarget;
      map.flyTo([resort.lat, resort.lng], Math.max(map.getZoom(), 8), {
        duration: 1.1,
      });
    }
  }, [flyToTarget, map]);

  return null;
};

function createResortIcon(
  resort: Resort,
  snow48hCm: number,
  isSelected: boolean,
  units: UnitSystem
): L.DivIcon {
  const tier = getSnowTier(snow48hCm);
  const isPartner = resort.accessType === 'partner';

  const bgColors = {
    none: '#334155',
    moderate: '#0891b2',
    heavy: '#3b82f6',
  };

  const borderColors = {
    none: isPartner ? '#f59e0b' : '#94a3b8',
    moderate: isPartner ? '#fbbf24' : '#22d3ee',
    heavy: isPartner ? '#fcd34d' : '#a5b4fc',
  };

  const glowStyle =
    tier === 'heavy'
      ? 'box-shadow: 0 0 14px rgba(59, 130, 246, 0.75);'
      : tier === 'moderate'
      ? 'box-shadow: 0 0 10px rgba(34, 211, 238, 0.55);'
      : 'box-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);';

  const selectedRing = isSelected
    ? 'outline: 2.5px solid #ffffff; outline-offset: 2px; transform: scale(1.2);'
    : '';

  const shapeStyle = isPartner
    ? `width: 14px; height: 14px; border-radius: 3px; transform: rotate(45deg);`
    : `width: 15px; height: 15px; border-radius: 9999px;`;

  const snowLabel =
    snow48hCm >= 1.25 ? formatSnowShort(snow48hCm, units) : '';

  const labelHtml = snowLabel
    ? `<span style="
        position: absolute;
        left: 18px;
        top: -3px;
        background: rgba(15, 23, 42, 0.92);
        color: ${tier === 'heavy' ? '#93c5fd' : '#67e8f9'};
        border: 1px solid ${tier === 'heavy' ? 'rgba(99, 102, 241, 0.6)' : 'rgba(34, 211, 238, 0.45)'};
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 700;
        padding: 1px 4px;
        border-radius: 4px;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      ">${snowLabel}</span>`
    : '';

  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px;">
      <div style="
        ${shapeStyle}
        background-color: ${bgColors[tier]};
        border: 2px solid ${borderColors[tier]};
        ${glowStyle}
        ${selectedRing}
        transition: transform 0.15s ease;
      "></div>
      ${labelHtml}
    </div>
  `;

  return L.divIcon({
    className: 'custom-resort-pin',
    html,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export const SnowMap: React.FC<SnowMapProps> = ({
  resorts,
  forecasts,
  selectedResort,
  flyToTarget,
  regionView,
  intlFocus,
  units,
  onSelectResort,
}) => {
  const markers = useMemo(() => {
    return resorts.map((resort) => {
      const forecast = forecasts[resort.id];
      const snow48hCm = forecast?.snowfall48hCm ?? 0;
      const isSelected = selectedResort?.id === resort.id;
      const icon = createResortIcon(resort, snow48hCm, isSelected, units);
      return { resort, forecast, snow48hCm, icon };
    });
  }, [resorts, forecasts, selectedResort, units]);

  return (
    <div className="relative h-full w-full flex-1">
      <MapContainer
        center={REGION_VIEWS['north-america'].center}
        zoom={REGION_VIEWS['north-america'].zoom}
        minZoom={2}
        maxZoom={14}
        zoomControl={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        <MapCameraController
          regionView={regionView}
          intlFocus={intlFocus}
          flyToTarget={flyToTarget}
        />

        {markers.map(({ resort, snow48hCm, icon }) => (
          <Marker
            key={`${resort.id}-${units}-${selectedResort?.id === resort.id}-${Math.round(snow48hCm)}`}
            position={[resort.lat, resort.lng]}
            icon={icon}
            eventHandlers={{
              click: () => onSelectResort(resort),
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              className="alpine-tooltip"
            >
              <div className="min-w-[140px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">
                    {resort.name}
                  </span>
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      resort.accessType === 'unlimited'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {resort.accessLabel}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {resort.location}
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-slate-700/70 pt-1 text-[11px]">
                  <span className="text-slate-400">48h Forecast:</span>
                  <span className="font-mono-tabular font-semibold text-cyan-300">
                    {formatSnowShort(snow48hCm, units)}
                  </span>
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
