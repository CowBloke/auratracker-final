export type RouletteColor = 'red' | 'black' | 'green';
export type BetType = 'straight' | 'color' | 'parity' | 'range' | 'dozen' | 'column';

export interface Bet {
  type: BetType;
  value: number | string;
  amount: number;
}

export interface SpinOutcome {
  number: number;
  color: RouletteColor;
  payout: number;
  net: number;
  totalBet: number;
}

export const WHEEL_NUMBERS: number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const CHIP_VALUES = [5, 10, 25, 50, 100, 250, 500, 1000];
export const SPIN_DURATION = 4200;
export const BALL_DURATION = 4600;
export const SLICE_ANGLE = 360 / WHEEL_NUMBERS.length;
export const WHEEL_OFFSET = -90;

export const TABLE_ROWS = Array.from({ length: 12 }, (_, idx) => {
  const start = 3 * (12 - idx) - 2;
  return [start, start + 1, start + 2];
});

export const getNumberColor = (num: number): RouletteColor => {
  if (num === 0) return 'green';
  return RED_NUMBERS.has(num) ? 'red' : 'black';
};

export const getDozen = (num: number) => {
  if (num === 0) return null;
  if (num <= 12) return 1;
  if (num <= 24) return 2;
  return 3;
};

export const getColumn = (num: number) => {
  if (num === 0) return null;
  return ((num - 1) % 3) + 1;
};

export const getBetMultiplier = (bet: Bet, winningNumber: number) => {
  switch (bet.type) {
    case 'straight':
      return bet.value === winningNumber ? 36 : 0;
    case 'color': {
      const color = getNumberColor(winningNumber);
      return bet.value === color ? 2 : 0;
    }
    case 'parity': {
      if (winningNumber === 0) return 0;
      const parity = winningNumber % 2 === 0 ? 'even' : 'odd';
      return bet.value === parity ? 2 : 0;
    }
    case 'range': {
      if (winningNumber === 0) return 0;
      const range = winningNumber <= 18 ? 'low' : 'high';
      return bet.value === range ? 2 : 0;
    }
    case 'dozen': {
      const dozen = getDozen(winningNumber);
      return dozen && dozen === bet.value ? 3 : 0;
    }
    case 'column': {
      const column = getColumn(winningNumber);
      return column && column === bet.value ? 3 : 0;
    }
    default:
      return 0;
  }
};
