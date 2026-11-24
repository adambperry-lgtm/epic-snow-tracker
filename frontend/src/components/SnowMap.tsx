import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { RegionView, Resort, ResortForecast, UnitSystem } from '../types/resort';
import { formatSnowShort, getSnowTier } from '../utils/units';

type MapStyle = 'dark' | 'terrain' | 'satellite';

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
    none: '#27272a',
    moderate: '#0284c7',
    heavy: '#2563eb',
  };

  const borderColors = {
    none: isPartner ? '#ff7a59' : '#a1a1aa',
    moderate: isPartner ? '#ff7a59' : '#38bdf8',
    heavy: isPartner ? '#ff947a' : '#93c5fd',
  };

  const glowStyle =
    tier === 'heavy'
      ? 'box-shadow: 0 0 14px rgba(37, 99, 235, 0.8);'
      : tier === 'moderate'
      ? 'box-shadow: 0 0 10px rgba(56, 189, 248, 0.55);'
      : 'box-shadow: 0 2px 6px rgba(0, 0, 0, 0.65);';

  const selectedRing = isSelected
    ? 'outline: 2.5px solid #ff4b2b; outline-offset: 2px; transform: scale(1.22);'
    : '';

  const shapeStyle = isPartner
    ? `width: 14px; height: 14px; border-radius: 3px; transform: rotate(45deg);`
    : `width: 15px; height: 15px; border-radius: 9999px;`;

  const snowLabel =
    snow48hCm >= 1.25 ? formatSnowShort(snow48hCm, units) : '';

  const labelHtml = snowLabel
    ? `<span style="
        position: absolute;
        left: 19px;
        top: -3px;
        background: rgba(15, 17, 22, 0.94);
        color: ${tier === 'heavy' ? '#93c5fd' : '#7dd3fc'};
        border: 1px solid rgba(255, 255, 255, 0.14);
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 9999px;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 4px 10px rgba(0,0,0,0.65);
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
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');

  const markers = useMemo(() => {
    return resorts.map((resort) => {
      const forecast = forecasts[resort.id];
      const snow48hCm = forecast?.snowfall48hCm ?? 0;
      const isSelected = selectedResort?.id === resort.id;
      const icon = createResortIcon(resort, snow48hCm, isSelected, units);
      return { resort, forecast, snow48hCm, icon };
    });
  }, [resorts, forecasts, selectedResort, units]);

  const tileConfig = {
    dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      subdomains: ['server'],
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      className: '',
    },
    terrain: {
      url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      subdomains: ['0', '1', '2', '3'],
      attribution: 'Map data &copy; Google',
      className: 'google-dark-tiles',
    },
    satellite: {
      url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      subdomains: ['0', '1', '2', '3'],
      attribution: 'Map data &copy; Google',
      className: '',
    },
  }[mapStyle];

  return (
    <div className="relative h-full w-full flex-1">
      <div className="absolute bottom-5 left-4 z-[800] flex items-center gap-1 rounded-full border border-white/10 bg-[#0f1116]/92 p-1 shadow-2xl backdrop-blur-xl">
        {(
          [
            { id: 'dark', label: 'Dark Map' },
            { id: 'terrain', label: 'Terrain' },
            { id: 'satellite', label: 'Satellite' },
          ] as { id: MapStyle; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMapStyle(item.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              mapStyle === item.id
                ? 'bg-white text-[#08090c] shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <MapContainer
        center={REGION_VIEWS['north-america'].center}
        zoom={REGION_VIEWS['north-america'].zoom}
        minZoom={2}
        maxZoom={16}
        zoomControl={true}
        className="h-full w-full"
      >
        <TileLayer
          key={mapStyle}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          subdomains={tileConfig.subdomains}
          className={tileConfig.className}
          maxZoom={mapStyle === 'dark' ? 16 : 20}
        />
        {mapStyle === 'dark' && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
            maxZoom={16}
          />
        )}

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
              <div className="min-w-[155px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-xs font-bold text-white">
                    {resort.name}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                      resort.accessType === 'unlimited'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-[#ff4b2b]/20 text-[#ff7a59]'
                    }`}
                  >
                    {resort.accessLabel}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-400">
                  {resort.location}
                </div>
                <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-1.5 text-[11px]">
                  <span className="text-zinc-400">48h Forecast</span>
                  <span className="font-mono-tabular font-bold text-sky-300">
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
