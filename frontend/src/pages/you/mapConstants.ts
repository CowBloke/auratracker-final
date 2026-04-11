import type { StyleSpecification } from 'maplibre-gl';

export const WORLD_MAP_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'carto',
      type: 'raster',
      source: 'carto',
    },
  ],
} satisfies StyleSpecification;

export const WORLD_LONGITUDE_LIMITS = { min: -180, max: 180 };
export const WORLD_LATITUDE_LIMITS = { min: -85.05112878, max: 85.05112878 };

export const TYPE_EMOJI: Record<string, string> = {
  lemonade: '🍋',
  epicerie: '🛒',
  restaurant: '🍽',
  coffee_shop: '☕',
  bank: '🏦',
  transfer: '💸',
  startup: '🚀',
  agency: '💼',
  formation: '🎓',
  law_firm: '⚖',
  supreme_court: '🏛',
};

export const TYPE_COLORS: Record<string, string> = {
  lemonade: '#f59e0b',
  epicerie: '#22c55e',
  restaurant: '#ef4444',
  coffee_shop: '#92400e',
  bank: '#3b82f6',
  transfer: '#6366f1',
  startup: '#a855f7',
  agency: '#ec4899',
  formation: '#14b8a6',
  law_firm: '#64748b',
  supreme_court: '#f97316',
};

const FALLBACK_COLORS = ['#f59e0b', '#22c55e', '#38bdf8', '#c084fc', '#818cf8', '#f472b6', '#fb7185'];

export function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return Math.abs(hash);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getBusinessPinColor(typeKey: string): string {
  return TYPE_COLORS[typeKey] ?? FALLBACK_COLORS[djb2Hash(typeKey) % FALLBACK_COLORS.length];
}

export function getFallbackBusinessPosition(businessId: string, order = 0): { longitude: number; latitude: number } {
  const hash = djb2Hash(`${businessId}-${order}`);
  const columns = 12;
  const rows = 5;
  const longitudeStep = 360 / columns;
  const latitudeStep = 120 / rows;
  const cellIndex = hash % (columns * rows);
  const column = cellIndex % columns;
  const row = Math.floor(cellIndex / columns);
  const longitudeJitter = (Math.floor(hash / 17) % 42) - 21;
  const latitudeJitter = (Math.floor(hash / 29) % 24) - 12;
  const longitude = clamp(-180 + longitudeStep / 2 + column * longitudeStep + longitudeJitter, WORLD_LONGITUDE_LIMITS.min + 2, WORLD_LONGITUDE_LIMITS.max - 2);
  const latitude = clamp(60 - latitudeStep / 2 - row * latitudeStep + latitudeJitter, WORLD_LATITUDE_LIMITS.min + 2, WORLD_LATITUDE_LIMITS.max - 2);
  return { longitude, latitude };
}
