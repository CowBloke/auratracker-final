export interface DistrictBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CityDistrict {
  id: string;
  label: string;
  /** SVG polygon points string on a 1000×700 canvas */
  svgPath: string;
  /** Center point for the label text */
  labelX: number;
  labelY: number;
  /** Semi-transparent fill hex */
  fill: string;
  stroke: string;
  /** District pin color (used for pin border) */
  pinColor: string;
  /** Area within which pins scatter */
  bounds: DistrictBounds;
  typeKeys: string[];
}

export const CITY_DISTRICTS: CityDistrict[] = [
  {
    id: 'commerce',
    label: 'Quartier commercial',
    svgPath: '0,0 400,0 400,350 0,350',
    labelX: 200,
    labelY: 22,
    fill: 'rgba(251,191,36,0.08)',
    stroke: 'rgba(251,191,36,0.25)',
    pinColor: '#f59e0b',
    bounds: { x: 10, y: 30, w: 380, h: 310 },
    typeKeys: ['lemonade', 'epicerie', 'restaurant', 'coffee_shop'],
  },
  {
    id: 'finance',
    label: 'District financier',
    svgPath: '400,0 700,0 700,350 400,350',
    labelX: 550,
    labelY: 22,
    fill: 'rgba(52,211,153,0.08)',
    stroke: 'rgba(52,211,153,0.25)',
    pinColor: '#10b981',
    bounds: { x: 410, y: 30, w: 280, h: 310 },
    typeKeys: ['bank', 'transfer'],
  },
  {
    id: 'tech',
    label: 'Silicon Quarter',
    svgPath: '700,0 1000,0 1000,350 700,350',
    labelX: 850,
    labelY: 22,
    fill: 'rgba(56,189,248,0.08)',
    stroke: 'rgba(56,189,248,0.25)',
    pinColor: '#0ea5e9',
    bounds: { x: 710, y: 30, w: 280, h: 310 },
    typeKeys: ['startup', 'agency'],
  },
  {
    id: 'services',
    label: 'Zone des services',
    svgPath: '0,350 500,350 500,700 0,700',
    labelX: 250,
    labelY: 372,
    fill: 'rgba(167,139,250,0.08)',
    stroke: 'rgba(167,139,250,0.25)',
    pinColor: '#a78bfa',
    bounds: { x: 10, y: 380, w: 480, h: 310 },
    typeKeys: ['formation'],
  },
  {
    id: 'justice',
    label: 'Palais de Justice',
    svgPath: '500,350 1000,350 1000,700 500,700',
    labelX: 750,
    labelY: 372,
    fill: 'rgba(99,102,241,0.08)',
    stroke: 'rgba(99,102,241,0.25)',
    pinColor: '#6366f1',
    bounds: { x: 510, y: 380, w: 480, h: 310 },
    typeKeys: ['law_firm', 'supreme_court'],
  },
];

export const DISTRICT_FOR_TYPE: Record<string, string> = {};
for (const d of CITY_DISTRICTS) {
  for (const t of d.typeKeys) {
    DISTRICT_FOR_TYPE[t] = d.id;
  }
}

export const TYPE_EMOJI: Record<string, string> = {
  lemonade: '🍋',
  epicerie: '🛒',
  restaurant: '🍽️',
  coffee_shop: '☕',
  bank: '🏦',
  transfer: '💸',
  startup: '🚀',
  agency: '🏠',
  formation: '🎓',
  law_firm: '⚖️',
  supreme_court: '🏛️',
};

/** djb2 hash — always returns a positive integer */
export function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/** Deterministic pin position within a district's bounds, derived from the business ID */
export function getBusinessPinPosition(
  businessId: string,
  bounds: DistrictBounds,
): { x: number; y: number } {
  const hash = djb2Hash(businessId);
  const margin = 28;
  const usableW = bounds.w - margin * 2;
  const usableH = bounds.h - margin * 2;
  const x = bounds.x + margin + (hash % usableW);
  const y = bounds.y + margin + (Math.floor(hash / 1000) % usableH);
  return { x, y };
}