import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { auraCoinApi, AuraCoinPriceHistory, AuraCoinTransaction } from '@/services/api';
import { marketCoins, buildSyntheticHistory, clamp, MarketCoin } from '@/data/marketCoins';
import { loadSimState, SimTransaction } from '@/lib/marketSim';
import { cn } from '@/lib/utils';

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

const MiniSparkline = ({ history, positive }: { history: AuraCoinPriceHistory[]; positive: boolean }) => {
  const points = buildMiniPoints(history);
  return (
    <svg viewBox="0 0 120 36" className="w-full h-10" preserveAspectRatio="none">
      {points && (
        <polyline
          fill="none"
          stroke={positive ? '#10b981' : '#ef4444'}
          strokeWidth="2"
          points={points}
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
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-12">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/games"
              className="text-sm text-muted-foreground tracking-wide uppercase hover:text-foreground transition-colors"
            >
              ← Jeux
            </Link>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Salle de marche
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Quatre cryptos, une interface de trading unique. Aura Coin reste la reference principale.
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p className="uppercase tracking-wide">Apercu 24h</p>
            <p className="tabular-nums">{auraHistory.length ? `${auraHistory.length} points` : 'Chargement...'}</p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {coinViews.map((coin) => {
          const priceChange = coin.history.length > 1
            ? ((coin.currentPrice - coin.history[0].price) / coin.history[0].price) * 100
            : 0;
          return (
            <Link
              key={coin.id}
              to={coin.route}
              className="border border-border/30 p-5 space-y-4 hover:border-foreground/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-medium">{coin.name}</h2>
                    {coin.primary && (
                      <span className="text-[10px] uppercase tracking-widest border border-amber-400 text-amber-400 px-2 py-0.5">
                        Principal
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{coin.description}</p>
                </div>
                <div className={cn('text-sm font-medium', coin.accent)}>{coin.symbol}</div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-light tabular-nums">
                    ${coin.currentPrice.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Fee {(coin.feePercentage * 100).toFixed(1)}%</span>
                    <span className={cn('flex items-center gap-1', priceChange >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                      {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="w-32">
                  <MiniSparkline history={coin.history} positive={priceChange >= 0} />
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Historique global des transactions</h2>
          <span className="text-xs text-muted-foreground">{loading ? 'Chargement...' : `${combinedTransactions.length} lignes`}</span>
        </div>
        <div className="border border-border/30">
          {combinedTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Aucune transaction recente</p>
          ) : (
            combinedTransactions.map((tx) => {
              const coinMeta = marketCoins.find((coin) => coin.id === tx.coinId);
              const positive = tx.type === 'BUY';
              return (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3 border-b border-border/10">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 flex items-center justify-center border',
                      positive
                        ? 'border-emerald-500/30 text-emerald-500'
                        : 'border-red-500/30 text-red-500'
                    )}>
                      {positive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-medium"
                          style={{ color: tx.user.usernameColor || undefined }}
                        >
                          {tx.user.username}
                        </span>
                        <span className={cn('text-xs uppercase', positive ? 'text-emerald-500' : 'text-red-500')}>
                          {positive ? 'Achat' : 'Vente'}
                        </span>
                        {coinMeta && (
                          <span className={cn('text-xs uppercase', coinMeta.accent)}>
                            {coinMeta.symbol}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
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
            })
          )}
        </div>
      </section>
    </div>
  );
}
