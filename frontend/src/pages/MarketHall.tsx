import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { auraCoinApi, AuraCoinPriceHistory, AuraCoinTransaction } from '@/services/api';
import { marketCoins, buildSyntheticHistory, clamp, MarketCoin } from '@/data/marketCoins';
import { loadSimState, SimTransaction } from '@/lib/marketSim';

const MINI_POINTS = 40;
const AURA_BASE_PRICE = 100;

const buildMiniPoints = (history: AuraCoinPriceHistory[]) => {
  if (history.length < 2) return '';
  const slice = history.slice(-MINI_POINTS);
  const width = 120;
  const height = 36;
  const padding = 4;
  const prices = slice.map((item) => item.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  return slice
    .map((item, index) => {
      const x = padding + (index / Math.max(slice.length - 1, 1)) * (width - 2 * padding);
      const y = height - padding - ((item.price - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');
};

const MiniSparkline = ({ history }: { history: AuraCoinPriceHistory[] }) => {
  const points = buildMiniPoints(history);
  return (
    <svg viewBox="0 0 120 36" className="w-full h-10" preserveAspectRatio="none">
      {points && (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
          opacity={0.5}
        />
      )}
    </svg>
  );
};

const mapDerivedTransaction = (
  tx: AuraCoinTransaction,
  coin: MarketCoin
): SimTransaction => {
  const priceMultiplier = coin.basePrice / AURA_BASE_PRICE;
  const price = Math.max(0.1, Math.round(tx.price * priceMultiplier * 100) / 100);
  const coinAmount = clamp(tx.coinAmount * (AURA_BASE_PRICE / coin.basePrice), 0.0001, 999999);
  const moneyAmount = Math.max(1, Math.floor(coinAmount * price));
  const fee = Math.max(1, Math.floor(moneyAmount * coin.feePercentage));

  return {
    ...tx,
    id: `${tx.id}-${coin.id}`,
    price,
    coinAmount,
    moneyAmount,
    fee,
    coinId: coin.id,
  };
};

export default function MarketHall() {
  const [auraPrice, setAuraPrice] = useState(100);
  const [auraFee, setAuraFee] = useState(0.02);
  const [auraHistory, setAuraHistory] = useState<AuraCoinPriceHistory[]>([]);
  const [auraTransactions, setAuraTransactions] = useState<AuraCoinTransaction[]>([]);
  const [simTransactions, setSimTransactions] = useState<SimTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAura = async () => {
      try {
        setLoading(true);
        const [priceRes, txRes] = await Promise.all([
          auraCoinApi.getPrice(24),
          auraCoinApi.getAllTransactions({ limit: 50 }),
        ]);
        setAuraPrice(priceRes.data.currentPrice);
        setAuraFee(priceRes.data.feePercentage);
        setAuraHistory(priceRes.data.history);
        setAuraTransactions(txRes.data.transactions);
      } catch (error) {
        console.error('Failed to fetch AuraCoin data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAura();
  }, []);

  useEffect(() => {
    const { transactions } = loadSimState(
      marketCoins.filter((coin) => !coin.primary).map((coin) => coin.id)
    );
    setSimTransactions(transactions);
  }, []);

  const syntheticHistories = useMemo(() => {
    return marketCoins.reduce((acc, coin) => {
      if (coin.primary) return acc;
      acc[coin.id] = buildSyntheticHistory(coin.basePrice, coin.id);
      return acc;
    }, {} as Record<string, AuraCoinPriceHistory[]>);
  }, []);

  const coinViews = useMemo(() => {
    return marketCoins.map((coin) => {
      if (coin.primary && auraHistory.length > 0) {
        return {
          ...coin,
          history: auraHistory,
          currentPrice: auraPrice,
          feePercentage: auraFee,
        };
      }
      const history = syntheticHistories[coin.id] || buildSyntheticHistory(coin.basePrice, coin.id);
      const currentPrice = history[history.length - 1]?.price ?? coin.basePrice;
      return {
        ...coin,
        history,
        currentPrice,
        feePercentage: coin.feePercentage,
      };
    });
  }, [auraHistory, auraPrice, auraFee, syntheticHistories]);

  const combinedTransactions = useMemo(() => {
    const baseAura = auraTransactions.map((tx) => ({ ...tx, coinId: 'aura-coin' as const }));
    const derived = marketCoins
      .filter((coin) => !coin.primary)
      .flatMap((coin) => auraTransactions.slice(0, 12).map((tx) => mapDerivedTransaction(tx, coin)));
    return [...simTransactions, ...derived, ...baseAura]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 40);
  }, [auraTransactions, simTransactions]);

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-16">
      <div className="flex items-center justify-end">
        <div className="text-right text-sm text-muted-foreground tabular-nums">
          {auraHistory.length ? `${auraHistory.length} points` : 'Chargement...'}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {coinViews.map((coin) => {
          const priceChange = coin.history.length > 1
            ? ((coin.currentPrice - coin.history[0].price) / coin.history[0].price) * 100
            : 0;
          return (
            <Link
              key={coin.id}
              to={coin.route}
              className="border border-border/30 p-6 space-y-4 hover:border-foreground/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-medium">{coin.name}</h2>
                    {coin.primary && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        Principal
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{coin.description}</p>
                </div>
                <div className="text-sm text-muted-foreground">{coin.symbol}</div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-light tabular-nums">
                    ${coin.currentPrice.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span>Fee {(coin.feePercentage * 100).toFixed(1)}%</span>
                    <span className="tabular-nums">
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="w-32">
                  <MiniSparkline history={coin.history} />
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Historique global des transactions
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">{loading ? 'Chargement...' : `${combinedTransactions.length} lignes`}</span>
        </div>
        {combinedTransactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Aucune transaction recente</p>
        ) : (
          <div className="space-y-0">
            {combinedTransactions.map((tx) => {
              const coinMeta = marketCoins.find((coin) => coin.id === tx.coinId);
              const positive = tx.type === 'BUY';
              return (
                <div key={tx.id} className="flex items-center justify-between py-4 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground uppercase">
                      {positive ? 'Achat' : 'Vente'}
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: tx.user.usernameColor || undefined }}
                    >
                      {tx.user.username}
                    </span>
                    {coinMeta && (
                      <span className="text-xs text-muted-foreground uppercase">
                        {coinMeta.symbol}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums">
                      {positive ? '+' : '-'}{tx.coinAmount.toFixed(4)} {coinMeta?.symbol ?? 'AC'}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      @ ${tx.price.toFixed(2)} • Frais: ${tx.fee}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
