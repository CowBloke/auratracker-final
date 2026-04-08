export interface DistrictBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CityDistrict {
  id: string;
  label: string;
  svgPath: string;
  labelX: number;
  labelY: number;
  fill: string;
  stroke: string;
  pinColor: string;
  bounds: DistrictBounds;
  typeKeys: string[];
}

export const CITY_DISTRICTS: CityDistrict[] = [
  {
    id: 'commerce',
    label: 'Boulevards Marchands',
    svgPath: '48,108 228,54 366,88 390,212 302,320 136,298 56,214',
    labelX: 222,
    labelY: 178,
    fill: 'rgba(245, 158, 11, 0.14)',
    stroke: 'rgba(251, 191, 36, 0.45)',
    pinColor: '#f59e0b',
    bounds: { x: 88, y: 92, w: 240, h: 180 },
    typeKeys: ['lemonade', 'epicerie', 'restaurant', 'coffee_shop'],
  },
  {
    id: 'finance',
    label: 'Quartier des Tours',
    svgPath: '394,74 584,42 688,112 668,252 546,324 394,256 364,146',
    labelX: 528,
    labelY: 170,
    fill: 'rgba(16, 185, 129, 0.14)',
    stroke: 'rgba(52, 211, 153, 0.45)',
    pinColor: '#10b981',
    bounds: { x: 408, y: 84, w: 232, h: 190 },
    typeKeys: ['bank', 'transfer'],
  },
  {
    id: 'tech',
    label: 'Neon Tech',
    svgPath: '714,96 890,62 960,146 934,302 764,320 694,214',
    labelX: 826,
    labelY: 178,
    fill: 'rgba(14, 165, 233, 0.14)',
    stroke: 'rgba(56, 189, 248, 0.45)',
    pinColor: '#38bdf8',
    bounds: { x: 736, y: 96, w: 184, h: 188 },
    typeKeys: ['startup', 'agency'],
  },
  {
    id: 'services',
    label: 'Campus Créatif',
    svgPath: '62,388 246,332 406,398 376,566 198,638 56,542',
    labelX: 214,
    labelY: 496,
    fill: 'rgba(168, 85, 247, 0.14)',
    stroke: 'rgba(196, 181, 253, 0.45)',
    pinColor: '#c084fc',
    bounds: { x: 92, y: 384, w: 248, h: 196 },
    typeKeys: ['formation'],
  },
  {
    id: 'justice',
    label: 'Cité Civique',
    svgPath: '454,372 654,320 892,362 952,526 810,644 576,654 434,548',
    labelX: 692,
    labelY: 502,
    fill: 'rgba(99, 102, 241, 0.14)',
    stroke: 'rgba(129, 140, 248, 0.45)',
    pinColor: '#818cf8',
    bounds: { x: 500, y: 372, w: 356, h: 220 },
    typeKeys: ['law_firm', 'supreme_court'],
  },
];

export const DISTRICT_FOR_TYPE: Record<string, string> = {};
for (const district of CITY_DISTRICTS) {
  for (const typeKey of district.typeKeys) {
    DISTRICT_FOR_TYPE[typeKey] = district.id;
  }
}

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

export function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return Math.abs(hash);
}

export function getBusinessPinPosition(
  businessId: string,
  bounds: DistrictBounds,
): { x: number; y: number } {
  const hash = djb2Hash(businessId);
  const margin = 24;
  const usableW = Math.max(40, bounds.w - margin * 2);
  const usableH = Math.max(40, bounds.h - margin * 2);
  const x = bounds.x + margin + (hash % usableW);
  const y = bounds.y + margin + (Math.floor(hash / 997) % usableH);
  return { x, y };
}
