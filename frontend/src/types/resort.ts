export type RegionView = 'north-america' | 'international';

export type SubRegion =
  | 'Rockies'
  | 'West & Tahoe'
  | 'Pacific Northwest & BC'
  | 'Northeast'
  | 'Mid-Atlantic'
  | 'Midwest'
  | 'Canadian Rockies & Quebec'
  | 'Swiss Alps'
  | 'French & Italian Alps'
  | 'Austrian Alps'
  | 'Japan';

export type AccessType = 'unlimited' | 'partner';

export type PassTier = 'Epic Pass' | 'Epic Local';

export type UnitSystem = 'imperial' | 'metric';

export interface Resort {
  id: string;
  name: string;
  location: string; // State / Province / Country
  country: 'US' | 'CA' | 'CH' | 'FR' | 'IT' | 'AT' | 'JP';
  regionView: RegionView;
  subRegion: SubRegion;
  lat: number;
  lng: number;
  summitElevationFt: number;
  baseElevationFt: number;
  accessType: AccessType;
  accessLabel: string; // e.g., "Unlimited", "7 Days", "5 Consecutive Days"
  passTiers: PassTier[]; // Which passes include this resort
  liftieSlug?: string; // Optional Liftie API slug for live lift counts
  totalLifts: number;
  totalTrails: number;
  typicalSeasonOpen: boolean;
}

export interface DailyForecast {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g., "Mon", "Today"
  snowfallCm: number;
  tempMaxC: number;
  tempMinC: number;
  windMaxKmh: number;
  weatherCode: number;
}

export interface ResortForecast {
  resortId: string;
  fetchedAt: number;
  snowDepthCm: number | null;
  snowfall48hCm: number;
  snowfall7dCm: number;
  snowfall24hCm: number;
  daily: DailyForecast[];
}

export interface ResortStatus {
  resortId: string;
  isOpen: boolean;
  liftsOpen: number;
  liftsTotal: number;
  trailsOpen: number;
  trailsTotal: number;
  baseDepthCm: number;
  snow24hCm: number;
  snow7dCm: number;
  source: 'onthesnow-live' | 'liftie-live' | 'db-synced' | 'seeded';
  updatedAt: string;
}
