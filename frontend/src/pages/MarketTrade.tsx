import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { buildSyntheticHistory, getMarketCoin, marketCoins } from '@/data/marketCoins';
import { loadSimState, recordSimTransaction, saveSimState, SimTransaction, SimState } from '@/lib/marketSim';
import type { AuraCoinPriceHistory } from '@/services/api';

export default function MarketTrade() {
  const { coinId } = useParams();
  const coin = getMarketCoin(coinId);
  const { user } = useAuth();

  const altCoinIds = useMemo(
    () => marketCoins.filter((entry) => !entry.primary).map((entry) => entry.id),
    []
  );

  const [priceHistory, setPriceHistory] = useState<AuraCoinPriceHistory[]>(() =>
    coin ? buildSyntheticHistory(coin.basePrice, coin.id) : []
  );
  const [currentPrice, setCurrentPrice] = useState(() =>
    priceHistory[priceHistory.length - 1]?.price ?? coin?.basePrice ?? 0
  );
  const [simState, setSimState] = useState<SimState>(() => loadSimState(altCoinIds));

  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');

  useEffect(() => {
    if (!coin) return;
    setPriceHistory(buildSyntheticHistory(coin.basePrice, coin.id));
  }, [coin?.id, coin?.basePrice]);

  useEffect(() => {
    setCurrentPrice(priceHistory[priceHistory.length - 1]?.price ?? coin?.basePrice ?? 0);
  }, [priceHistory, coin?.basePrice]);

  useEffect(() => {
    if (!coin) return;
    const interval = window.setInterval(() => {
      setPriceHistory((prev) => {
        const last = prev[prev.length - 1]?.price ?? coin.basePrice;
        const change = (Math.random() - 0.5) * 0.02;
        const next = Math.max(0.1, Math.round(last * (1 + change) * 100) / 100);
        setCurrentPrice(next);
        return [
          ...prev.slice(-287),
          { price: next, volume: 0, createdAt: new Date().toISOString() },
        ];
      });
    }, 8000);

    return () => window.clearInterval(interval);
  }, [coin]);

  useEffect(() => {
    saveSimState(simState);
  }, [simState]);

  if (!coin || coin.primary) {
    return <Navigate to="/games/market" replace />;
  }

  const balance = simState.balances[coin.id] || 0;
  const cash = simState.cash;
  const transactions = simState.transactions.filter((tx) => tx.coinId === coin.id);

  const MIN_FEE = 1;
  const MIN_TRADE_GROSS = MIN_FEE + 1;

  const priceChange = priceHistory.length > 1
    ? ((currentPrice - priceHistory[0].price) / priceHistory[0].price) * 100
    : 0;

  const buyMoneyAmount = parseFloat(buyAmount) || 0;
  const buyFee = Math.floor(buyMoneyAmount * coin.feePercentage);
  const buyCoinsEstimate = (buyMoneyAmount - buyFee) / currentPrice;

  const sellCoinAmount = parseFloat(sellAmount) || 0;
  const sellGrossAmount = Math.floor(sellCoinAmount * currentPrice);
  const sellFee = Math.floor(sellGrossAmount * coin.feePercentage);
  const sellNetAmount = sellGrossAmount - sellFee;

  const minBuyAmount = MIN_TRADE_GROSS;
  const minSellAmount = Math.ceil((MIN_TRADE_GROSS / currentPrice) * 10000) / 10000;
  const canUseMinBuy = cash >= minBuyAmount;
  const canUseMinSell = balance >= minSellAmount;

  const minPrice = Math.min(...priceHistory.map((item) => item.price), currentPrice) * 0.99;
  const maxPrice = Math.max(...priceHistory.map((item) => item.price), currentPrice) * 1.01;
  const priceRange = maxPrice - minPrice || 1;

  const chartWidth = 400;
  const chartHeight = 100;
  const chartPadding = 10;

  const chartPoints = priceHistory
    .map((item, index) => {
      const x = chartPadding + (index / Math.max(priceHistory.length - 1, 1)) * (chartWidth - 2 * chartPadding);
      const y = chartHeight - chartPadding - ((item.price - minPrice) / priceRange) * (chartHeight - 2 * chartPadding);
      return `${x},${y}`;
    })
    .join(' ');

  const handleBuy = () => {
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0) return;
    if (amount > cash) {
      setError('Solde insuffisant');
      return;
    }

    const fee = Math.floor(amount * coin.feePercentage);
    const net = amount - fee;
    if (net <= 0) {
      setError('Montant trop bas pour couvrir les frais');
      return;
    }

    const coinsReceived = net / currentPrice;
    const nextState: SimState = {
      ...simState,
      cash: cash - amount,
      balances: {
        ...simState.balances,
        [coin.id]: (simState.balances[coin.id] || 0) + coinsReceived,
      },
    };

    const tx: SimTransaction = {
      id: `sim-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      userId: user?.id ?? 'sim',
      type: 'BUY',
      coinAmount: coinsReceived,
      moneyAmount: amount,
      price: currentPrice,
      fee,
      createdAt: new Date().toISOString(),
      user: {
        id: user?.id ?? 'sim',
        username: user?.username ?? 'Trader',
        usernameColor: user?.usernameColor ?? null,
      },
      coinId: coin.id,
    };

    setSimState(recordSimTransaction(nextState, tx));
    setBuyAmount('');
    setError('');
  };

  const handleSell = () => {
    const amount = parseFloat(sellAmount);
    if (!amount || amount <= 0) return;
    if (amount > balance) {
      setError('Solde insuffisant');
      return;
    }

    const gross = Math.floor(amount * currentPrice);
    const fee = Math.floor(gross * coin.feePercentage);
    const net = gross - fee;
    if (net <= 0) {
      setError('Montant trop bas pour couvrir les frais');
      return;
    }

    const nextState: SimState = {
      ...simState,
      cash: cash + net,
      balances: {
        ...simState.balances,
        [coin.id]: (simState.balances[coin.id] || 0) - amount,
      },
    };

    const tx: SimTransaction = {
      id: `sim-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      userId: user?.id ?? 'sim',
      type: 'SELL',
      coinAmount: amount,
      moneyAmount: net,
      price: currentPrice,
      fee,
      createdAt: new Date().toISOString(),
      user: {
        id: user?.id ?? 'sim',
        username: user?.username ?? 'Trader',
        usernameColor: user?.usernameColor ?? null,
      },
      coinId: coin.id,
    };

    setSimState(recordSimTransaction(nextState, tx));
    setSellAmount('');
    setError('');
  };

  const displayedTransactions = activeTab === 'my' ? transactions : transactions;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-12">
      <div className="flex items-center justify-end">
        <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-3xl font-light tabular-nums">
                ${currentPrice.toFixed(2)}
              </span>
              <span
                className={cn(
                  'flex items-center text-sm',
                  priceChange >= 0 ? 'text-emerald-500' : 'text-red-500'
                )}
              >
                {priceChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Fee {(coin.feePercentage * 100).toFixed(1)}%</p>
          </div>
        </div>

      <div className="border border-border/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground uppercase tracking-wide">Cours 24h</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            Min: ${minPrice.toFixed(2)} / Max: ${maxPrice.toFixed(2)}
          </span>
        </div>

        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-32" preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={chartPadding}
              y1={chartPadding + ratio * (chartHeight - 2 * chartPadding)}
              x2={chartWidth - chartPadding}
              y2={chartPadding + ratio * (chartHeight - 2 * chartPadding)}
              stroke="currentColor"
              strokeOpacity={0.1}
            />
          ))}

          {priceHistory.length > 1 && (
            <polyline
              fill="none"
              stroke={priceChange >= 0 ? '#10b981' : '#ef4444'}
              strokeWidth="2"
              points={chartPoints}
            />
          )}

          {priceHistory.length > 0 && (
            <circle
              cx={chartWidth - chartPadding}
              cy={chartHeight - chartPadding - ((currentPrice - minPrice) / priceRange) * (chartHeight - 2 * chartPadding)}
              r="4"
              fill={priceChange >= 0 ? '#10b981' : '#ef4444'}
            />
          )}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border/30 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde $ (simu)</p>
          <p className="text-2xl font-light tabular-nums">${cash.toLocaleString()}</p>
        </div>
        <div className="border border-border/30 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde {coin.name}</p>
          <p className="text-2xl font-light tabular-nums">{balance.toFixed(4)} {coin.symbol}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            ≈ ${(balance * currentPrice).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border border-border/30 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-medium">Acheter</h2>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Montant ($)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBuyAmount(minBuyAmount.toString())}
                  disabled={!canUseMinBuy}
                  className={cn(
                    'px-2 py-1 border text-[10px] uppercase tracking-widest transition-colors',
                    canUseMinBuy
                      ? 'border-emerald-500/60 text-emerald-500 hover:bg-emerald-500 hover:text-background'
                      : 'border-border/30 text-muted-foreground/50 cursor-not-allowed'
                  )}
                >
                  Min
                </button>
                <button
                  type="button"
                  onClick={() => setBuyAmount(cash.toString())}
                  disabled={cash <= 0}
                  className={cn(
                    'px-2 py-1 border text-[10px] uppercase tracking-widest transition-colors',
                    cash > 0
                      ? 'border-emerald-500/60 text-emerald-500 hover:bg-emerald-500 hover:text-background'
                      : 'border-border/30 text-muted-foreground/50 cursor-not-allowed'
                  )}
                >
                  Max
                </button>
              </div>
            </div>
            <input
              type="number"
              value={buyAmount}
              onChange={(event) => setBuyAmount(event.target.value)}
              placeholder="0"
              className="w-full mt-1 px-3 py-2 bg-transparent border border-border/30 focus:border-foreground/30 outline-none tabular-nums"
            />
          </div>

          {buyMoneyAmount > 0 && (
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Frais ({(coin.feePercentage * 100).toFixed(1)}%)</span>
                <span className="tabular-nums">-${buyFee}</span>
              </div>
              <div className="flex justify-between">
                <span>Vous recevrez</span>
                <span className="tabular-nums text-foreground">{buyCoinsEstimate.toFixed(4)} {coin.symbol}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={!buyAmount || buyMoneyAmount <= 0 || buyMoneyAmount > cash}
            className={cn(
              'w-full py-3 border text-sm transition-colors',
              buyMoneyAmount > 0 && buyMoneyAmount <= cash
                ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-background'
                : 'border-border/30 text-muted-foreground/50 cursor-not-allowed'
            )}
          >
            Acheter
          </button>
        </div>

        <div className="border border-border/30 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-medium">Vendre</h2>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Quantite ({coin.symbol})</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSellAmount(minSellAmount.toFixed(4))}
                  disabled={!canUseMinSell}
                  className={cn(
                    'px-2 py-1 border text-[10px] uppercase tracking-widest transition-colors',
                    canUseMinSell
                      ? 'border-red-500/60 text-red-500 hover:bg-red-500 hover:text-background'
                      : 'border-border/30 text-muted-foreground/50 cursor-not-allowed'
                  )}
                >
                  Min
                </button>
                <button
                  type="button"
                  onClick={() => setSellAmount(balance.toFixed(4))}
                  disabled={balance <= 0}
                  className={cn(
                    'px-2 py-1 border text-[10px] uppercase tracking-widest transition-colors',
                    balance > 0
                      ? 'border-red-500/60 text-red-500 hover:bg-red-500 hover:text-background'
                      : 'border-border/30 text-muted-foreground/50 cursor-not-allowed'
                  )}
                >
                  Max
                </button>
              </div>
            </div>
            <input
              type="number"
              value={sellAmount}
              onChange={(event) => setSellAmount(event.target.value)}
              placeholder="0"
              step="0.0001"
              className="w-full mt-1 px-3 py-2 bg-transparent border border-border/30 focus:border-foreground/30 outline-none tabular-nums"
            />
          </div>

          {sellCoinAmount > 0 && (
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Valeur brute</span>
                <span className="tabular-nums">${sellGrossAmount}</span>
              </div>
              <div className="flex justify-between">
                <span>Frais ({(coin.feePercentage * 100).toFixed(1)}%)</span>
                <span className="tabular-nums">-${sellFee}</span>
              </div>
              <div className="flex justify-between">
                <span>Vous recevrez</span>
                <span className="tabular-nums text-foreground">${sellNetAmount}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleSell}
            disabled={!sellAmount || sellCoinAmount <= 0 || sellCoinAmount > balance}
            className={cn(
              'w-full py-3 border text-sm transition-colors',
              sellCoinAmount > 0 && sellCoinAmount <= balance
                ? 'border-red-500 text-red-500 hover:bg-red-500 hover:text-background'
                : 'border-border/30 text-muted-foreground/50 cursor-not-allowed'
            )}
          >
            Vendre
          </button>
        </div>
      </div>

      {error && <div className="text-center text-red-500 text-sm">{error}</div>}

      <div className="space-y-4">
        <div className="flex gap-4 border-b border-border/30">
          <button
            onClick={() => setActiveTab('my')}
            className={cn(
              'pb-3 text-sm transition-colors',
              activeTab === 'my'
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Mes Transactions
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'pb-3 text-sm transition-colors',
              activeTab === 'all'
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Toutes les Transactions
          </button>
        </div>

        <div className="space-y-2">
          {displayedTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucune transaction</p>
          ) : (
            displayedTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3 border-b border-border/10">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-8 h-8 flex items-center justify-center border',
                      tx.type === 'BUY'
                        ? 'border-emerald-500/30 text-emerald-500'
                        : 'border-red-500/30 text-red-500'
                    )}
                  >
                    {tx.type === 'BUY' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium"
                        style={{ color: tx.user.usernameColor || undefined }}
                      >
                        {tx.user.username}
                      </span>
                      <span
                        className={cn(
                          'text-xs uppercase',
                          tx.type === 'BUY' ? 'text-emerald-500' : 'text-red-500'
                        )}
                      >
                        {tx.type === 'BUY' ? 'Achat' : 'Vente'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums">
                    {tx.type === 'BUY' ? '+' : '-'}{tx.coinAmount.toFixed(4)} {coin.symbol}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    @ ${tx.price.toFixed(2)} • Frais: ${tx.fee}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
