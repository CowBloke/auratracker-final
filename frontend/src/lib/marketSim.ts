import type { AuraCoinTransaction } from '@/services/api';
import type { MarketCoinId } from '@/data/marketCoins';

export type SimTransaction = AuraCoinTransaction & { coinId: MarketCoinId };

type SimState = {
  cash: number;
  balances: Record<MarketCoinId, number>;
  transactions: SimTransaction[];
};

const SIM_KEY = 'market-sim-v1';
const DEFAULT_CASH = 10000;

const createDefaultBalances = (coinIds: MarketCoinId[]) =>
  coinIds.reduce((acc, coinId) => {
    acc[coinId] = 0;
    return acc;
  }, {} as Record<MarketCoinId, number>);

export const loadSimState = (coinIds: MarketCoinId[]): SimState => {
  if (typeof window === 'undefined') {
    return {
      cash: DEFAULT_CASH,
      balances: createDefaultBalances(coinIds),
      transactions: [],
    };
  }

  try {
    const raw = window.localStorage.getItem(SIM_KEY);
    if (!raw) {
      return {
        cash: DEFAULT_CASH,
        balances: createDefaultBalances(coinIds),
        transactions: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<SimState>;
    const balances = createDefaultBalances(coinIds);
    if (parsed.balances) {
      coinIds.forEach((coinId) => {
        balances[coinId] = parsed.balances?.[coinId] ?? 0;
      });
    }
    return {
      cash: typeof parsed.cash === 'number' ? parsed.cash : DEFAULT_CASH,
      balances,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch {
    return {
      cash: DEFAULT_CASH,
      balances: createDefaultBalances(coinIds),
      transactions: [],
    };
  }
};

export const saveSimState = (state: SimState) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIM_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
};

export const recordSimTransaction = (
  state: SimState,
  transaction: SimTransaction
): SimState => ({
  ...state,
  transactions: [transaction, ...state.transactions].slice(0, 150),
});

export type { SimState };
