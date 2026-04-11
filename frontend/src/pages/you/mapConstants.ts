export const MAP_VIEWBOX_WIDTH = 1000;
export const MAP_VIEWBOX_HEIGHT = 700;

export const CITY_ROAD_PATHS = [
  'M42,176 C214,214 344,154 466,182 S736,240 958,190',
  'M72,330 C240,290 336,348 518,330 S762,260 942,322',
  'M92,548 C258,504 372,564 562,544 S796,478 932,520',
  'M248,56 C280,168 270,302 300,428 S332,620 366,668',
  'M652,40 C608,164 636,308 604,442 S572,618 550,666',
];

export const CITY_PARK_PATHS = [
  'M98,420 C140,388 214,386 252,430 C222,486 140,500 98,462 Z',
  'M734,108 C786,84 862,100 900,154 C870,208 782,214 734,168 Z',
];

export const CITY_RIVER_PATH = 'M0,438 C122,408 204,352 318,378 C430,404 494,486 600,484 C734,480 842,392 1000,420 L1000,700 L0,700 Z';

export const CITY_BLOCK_TONES = ['#122033', '#14253a', '#182a44', '#1b304b', '#243654'];

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

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getFallbackBusinessPosition(businessId: string, order = 0): { x: number; y: number } {
  const hash = djb2Hash(`${businessId}-${order}`);
  const cellsX = 8;
  const cellsY = 5;
  const cellWidth = MAP_VIEWBOX_WIDTH / cellsX;
  const cellHeight = MAP_VIEWBOX_HEIGHT / cellsY;
  const cellIndex = hash % (cellsX * cellsY);
  const cellX = cellIndex % cellsX;
  const cellY = Math.floor(cellIndex / cellsX);
  const jitterX = (Math.floor(hash / 17) % 56) - 28;
  const jitterY = (Math.floor(hash / 29) % 42) - 21;
  const x = clamp(Math.round(cellX * cellWidth + cellWidth / 2 + jitterX), 54, MAP_VIEWBOX_WIDTH - 54);
  const y = clamp(Math.round(cellY * cellHeight + cellHeight / 2 + jitterY), 54, MAP_VIEWBOX_HEIGHT - 54);
  return { x, y };
}
