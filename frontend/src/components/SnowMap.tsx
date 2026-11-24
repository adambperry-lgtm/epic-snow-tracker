import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { RegionView, Resort, ResortForecast, UnitSystem } from '../types/resort';
import { formatSnowShort, getSnowTier } from '../utils/units';

type MapStyle = 'carto-dark' | 'dark' | 'terrain' | 'satellite';

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
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [cartoApiKey, setCartoApiKey] = useState<string>(
    import.meta.env.VITE_CARTO_API_KEY || ''
  );

  useEffect(() => {
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => {
        if (cfg?.cartoApiKey) {
          setCartoApiKey(cfg.cartoApiKey);
          setMapStyle('carto-dark');
        }
      })
      .catch(() => {});
  }, []);

  const markers = useMemo(() => {
    return resorts.map((resort) => {
      const forecast = forecasts[resort.id];
      const snow48hCm = forecast?.snowfall48hCm ?? 0;
      const isSelected = selectedResort?.id === resort.id;
      const icon = createResortIcon(resort, snow48hCm, isSelected, units);
      return { resort, forecast, snow48hCm, icon };
    });
  }, [resorts, forecasts, selectedResort, units]);

  const cartoUrl = cartoApiKey
    ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(cartoApiKey)}`
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  const tileConfig = {
    'carto-dark': {
      url: cartoUrl,
      subdomains: ['a', 'b', 'c', 'd'],
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      className: '',
    },
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
      <div className="absolute bottom-5 left-4 z-[800] flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/90 p-1 shadow-xl backdrop-blur-md">
        {(
          [
            ...(cartoApiKey
              ? [{ id: 'carto-dark' as MapStyle, label: 'CARTO Dark' }]
              : []),
            { id: 'dark', label: 'Esri Dark' },
            { id: 'terrain', label: 'Terrain' },
            { id: 'satellite', label: 'Satellite' },
          ] as { id: MapStyle; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMapStyle(item.id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              mapStyle === item.id
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
          key={`${mapStyle}-${cartoApiKey ? 'k' : 'nk'}`}
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
