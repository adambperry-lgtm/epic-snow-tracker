import type { UnitSystem } from '../types/resort';

export function cmToInches(cm: number): number {
  return cm / 2.54;
}

export function formatSnow(cm: number, units: UnitSystem, decimals = 1): string {
  if (units === 'imperial') {
    const inches = cmToInches(cm);
    if (inches > 0 && inches < 0.1) return '<0.1"';
    return `${inches.toFixed(inches >= 10 ? 0 : decimals)}"`;
  }
  if (cm > 0 && cm < 1) return '<1 cm';
  return `${Math.round(cm)} cm`;
}

export function formatSnowShort(cm: number, units: UnitSystem): string {
  if (units === 'imperial') {
    const inches = cmToInches(cm);
    if (inches < 0.2) return '0"';
    if (inches < 1) return `${inches.toFixed(1)}"`;
    return `${Math.round(inches)}"`;
  }
  if (cm < 0.5) return '0cm';
  return `${Math.round(cm)}cm`;
}

export function formatTemp(c: number, units: UnitSystem): string {
  if (units === 'imperial') {
    return `${Math.round((c * 9) / 5 + 32)}°F`;
  }
  return `${Math.round(c)}°C`;
}

export function formatWind(kmh: number, units: UnitSystem): string {
  if (units === 'imperial') {
    return `${Math.round(kmh * 0.621371)} mph`;
  }
  return `${Math.round(kmh)} km/h`;
}

export function formatElevation(ft: number, units: UnitSystem): string {
  if (units === 'imperial') {
    return `${ft.toLocaleString()} ft`;
  }
  return `${Math.round(ft * 0.3048).toLocaleString()} m`;
}

export type SnowTier = 'none' | 'moderate' | 'heavy';

/**
 * Categorizes 48h forecasted snowfall:
 * - 'none': ~0" (< 1.25 cm / < 0.5") -> Slate Gray
 * - 'moderate': 1–5" (1.25 cm to 13.99 cm) -> Light Cyan
 * - 'heavy': 6"+ (>= 14 cm / ~5.5"+) -> Electric Blue / Indigo
 */
export function getSnowTier(snow48hCm: number): SnowTier {
  if (snow48hCm >= 14) return 'heavy';
  if (snow48hCm >= 1.25) return 'moderate';
  return 'none';
}
