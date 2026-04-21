export type SlotSymbol = '🍒' | '🍋' | '🍊' | '🍇' | '🔔' | '⭐' | '💎' | '7️⃣';

export interface SlotResult {
  reels: SlotSymbol[][];
  winAmount: number;
  multiplier: number;
  winningLines: number[];
}

export const SLOT_SYMBOLS: SlotSymbol[] = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];
export const SLOT_SYMBOL_VALUES: Record<SlotSymbol, number> = {
  '🍒': 2,
  '🍋': 3,
  '🍊': 4,
  '🍇': 5,
  '🔔': 10,
  '⭐': 15,
  '💎': 25,
  '7️⃣': 50,
};

export const REEL_COUNT = 3;
export const ROWS = 3;
export const SLOT_SPIN_DURATION = 2000;
export const BET_STEPS = [10, 25, 50, 100, 250, 500, 1000];
