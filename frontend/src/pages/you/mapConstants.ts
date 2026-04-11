import type { StyleSpecification } from 'maplibre-gl';

export const WORLD_MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
} satisfies StyleSpecification;

export const WORLD_LONGITUDE_LIMITS = {
  min: -180,
  max: 180,
};

export const WORLD_LATITUDE_LIMITS = {
  min: -85.05112878,
  max: 85.05112878,
};

export const TYPE_EMOJI: Record<string, string> = {
  lemonade: 'L',
  epicerie: 'S',
  restaurant: 'R',
  coffee_shop: 'C',
  bank: 'B',
  transfer: 'T',
  startup: 'U',
  agency: 'A',
  formation: 'F',
  law_firm: 'J',
  supreme_court: 'P',
};

export const BUSINESS_PIN_COLORS = ['#f59e0b', '#22c55e', '#38bdf8', '#c084fc', '#818cf8', '#f472b6', '#fb7185', '#facc15'];

export function djb2Hash(str: string): number {
  let hash = 5381;
  for (let index = 0; index < str.length; index++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(index);
    hash &= 0xffffffff;
  }
  return Math.abs(hash);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getBusinessPinColor(typeKey: string): string {
  return BUSINESS_PIN_COLORS[djb2Hash(typeKey) % BUSINESS_PIN_COLORS.length];
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
