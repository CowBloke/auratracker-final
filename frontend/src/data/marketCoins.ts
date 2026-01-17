import type { AuraCoinPriceHistory } from '@/services/api';

export type MarketCoinId = 'aura-coin' | 'solaris' | 'zenith' | 'rift';

export type MarketCoin = {
  id: MarketCoinId;
  name: string;
  symbol: string;
  primary?: boolean;
  basePrice: number;
  feePercentage: number;
  accent: string;
  route: string;
  description: string;
};

export const marketCoins: MarketCoin[] = [
  {
    id: 'aura-coin',
    name: 'Aura Coin',
    symbol: 'AC',
    primary: true,
    basePrice: 100,
    feePercentage: 0.02,
    accent: 'text-amber-400',
    route: '/games/aura-coin',
    description: 'La crypto principale d Aura Tracker. Stable mais nerveuse.',
  },
  {
    id: 'solaris',
    name: 'Solaris',
    symbol: 'SOL',
    basePrice: 18,
    feePercentage: 0.015,
    accent: 'text-emerald-400',
    route: '/games/market/solaris',
    description: 'Mouvement doux, faible fee, bonne pour scalper.',
  },
  {
    id: 'zenith',
    name: 'Zenith',
    symbol: 'ZNT',
    basePrice: 62,
    feePercentage: 0.028,
    accent: 'text-sky-400',
    route: '/games/market/zenith',
    description: 'Volatilite moyenne, spreads nerveux, swing rapide.',
  },
  {
    id: 'rift',
    name: 'Rift',
    symbol: 'RFT',
    basePrice: 210,
    feePercentage: 0.035,
    accent: 'text-rose-400',
    route: '/games/market/rift',
    description: 'Tres volatile, grosse amplitude, fees eleves.',
  },
];

export const getMarketCoin = (coinId: string | undefined) =>
  marketCoins.find((coin) => coin.id === coinId);

const hashSeed = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const buildSyntheticHistory = (
  basePrice: number,
  coinId: string,
  points = 288,
  now = Date.now()
): AuraCoinPriceHistory[] => {
  const seed = hashSeed(coinId);
  const data: AuraCoinPriceHistory[] = [];
  for (let i = 0; i < points; i += 1) {
    const wave = Math.sin((i + seed) / 8) * 0.03;
    const drift = Math.cos((i + seed) / 17) * 0.02;
    const jitter = Math.sin((i + seed) / 5) * 0.01;
    const price = Math.max(0.1, basePrice * (1 + wave + drift + jitter));
    data.push({
      price: Math.round(price * 100) / 100,
      volume: 0,
      createdAt: new Date(now - (points - i) * 5 * 60 * 1000).toISOString(),
    });
  }
  return data;
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
