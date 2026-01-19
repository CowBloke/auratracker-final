import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { auraCoinApi, AuraCoinTransaction, AuraCoinPriceHistory, AuraCoinPosition } from '../services/api';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function AuraCoin() {
  const { refreshUser } = useAuth();
  const { socket } = useSocket();
  
  const [currentPrice, setCurrentPrice] = useState(100);
  const [feePercentage, setFeePercentage] = useState(0.02);
  const [priceHistory, setPriceHistory] = useState<AuraCoinPriceHistory[]>([]);
  const [auraCoinBalance, setAuraCoinBalance] = useState(0);
  const [moneyBalance, setMoneyBalance] = useState(0);
  
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [myTransactions, setMyTransactions] = useState<AuraCoinTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<AuraCoinTransaction[]>([]);
  
  const [timePeriod, setTimePeriod] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  
  // Leveraged trading state
  const [tradingMode, setTradingMode] = useState<'spot' | 'leverage'>('spot');
  const [positionType, setPositionType] = useState<'LONG' | 'SHORT'>('LONG');
  const [leverage, setLeverage] = useState(1);
  const [marginAmount, setMarginAmount] = useState('');
  const [openPositions, setOpenPositions] = useState<AuraCoinPosition[]>([]);
  
  const getHoursForPeriod = (period: 'hour' | 'day' | 'week' | 'month') => {
    switch (period) {
      case 'hour': return 1;
      case 'day': return 24;
      case 'week': return 168; // 7 * 24
      case 'month': return 720; // 30 * 24
      default: return 24;
    }
  };
  
  const fetchData = useCallback(async () => {
    try {
      const hours = getHoursForPeriod(timePeriod);
      const [priceRes, myTxRes, allTxRes, openPosRes] = await Promise.all([
        auraCoinApi.getPrice(hours),
        auraCoinApi.getMyTransactions({ limit: 50 }),
        auraCoinApi.getAllTransactions({ limit: 50 }),
        auraCoinApi.getOpenPositions().catch(() => ({ data: { positions: [] } })),
      ]);
      
      setCurrentPrice(priceRes.data.currentPrice);
      setFeePercentage(priceRes.data.feePercentage);
      setPriceHistory(priceRes.data.history);
      setAuraCoinBalance(priceRes.data.userBalance.auraCoin);
      setMoneyBalance(priceRes.data.userBalance.money);
      setMyTransactions(myTxRes.data.transactions);
      setAllTransactions(allTxRes.data.transactions);
      setOpenPositions(openPosRes.data.positions as any);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }, [timePeriod]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Listen for price updates via WebSocket
  useEffect(() => {
    if (!socket) return;
    
    const handlePriceUpdate = (data: { price: number; timestamp: string }) => {
      setCurrentPrice(data.price);
      setPriceHistory(prev => [
        ...prev.slice(-288), // Keep last 24h of 5min intervals
        { price: data.price, volume: 0, createdAt: data.timestamp },
      ]);
      // Refresh open positions to update P&L
      auraCoinApi.getOpenPositions()
        .then(res => setOpenPositions(res.data.positions as any))
        .catch(() => {});
    };
    
    socket.on('auracoin:price-update', handlePriceUpdate);
    
    return () => {
      socket.off('auracoin:price-update', handlePriceUpdate);
    };
  }, [socket]);
  
  // Refresh positions periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (tradingMode === 'leverage') {
        auraCoinApi.getOpenPositions()
          .then(res => setOpenPositions(res.data.positions as any))
          .catch(() => {});
      }
    }, 5000); // Every 5 seconds
    
    return () => clearInterval(interval);
  }, [tradingMode]);
  
  const handleBuy = async () => {
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await auraCoinApi.buy(amount);
      setAuraCoinBalance(res.data.newBalance.auraCoin);
      setMoneyBalance(res.data.newBalance.money);
      setCurrentPrice(res.data.transaction.newPrice);
      setBuyAmount('');
      await refreshUser();
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Échec de l\'achat');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSell = async () => {
    const amount = parseFloat(sellAmount);
    if (!amount || amount <= 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await auraCoinApi.sell(amount);
      setAuraCoinBalance(res.data.newBalance.auraCoin);
      setMoneyBalance(res.data.newBalance.money);
      setCurrentPrice(res.data.transaction.newPrice);
      setSellAmount('');
      await refreshUser();
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Échec de la vente');
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenPosition = async () => {
    if (!marginAmountNum || marginAmountNum <= 0) return;
    if (marginAmountNum > moneyBalance) {
      setError('Fonds insuffisants pour la marge');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await auraCoinApi.openPosition(positionType, leverage, marginAmountNum);
      setMoneyBalance(res.data.newBalance.money);
      setMarginAmount('');
      await refreshUser();
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Échec d\'ouverture de position');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClosePosition = async (positionId: string) => {
    setLoading(true);
    setError('');
    
    try {
      const res = await auraCoinApi.closePosition(positionId);
      setMoneyBalance(res.data.newBalance.money);
      await refreshUser();
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Échec de fermeture de position');
    } finally {
      setLoading(false);
    }
  };
  
  // Calculate price change
  const priceChange = priceHistory.length > 1
    ? ((currentPrice - priceHistory[0].price) / priceHistory[0].price) * 100
    : 0;
  
  // Minimum fee constant (matches backend)
  const MIN_FEE = 1;
  
  // Calculate estimates
  const buyMoneyAmount = parseFloat(buyAmount) || 0;
  const buyFee = Math.max(MIN_FEE, Math.floor(buyMoneyAmount * feePercentage));
  const buyCoinsEstimate = (buyMoneyAmount - buyFee) / currentPrice;
  
  const sellCoinAmount = parseFloat(sellAmount) || 0;
  const sellGrossAmount = Math.floor(sellCoinAmount * currentPrice);
  const sellFee = Math.max(MIN_FEE, Math.floor(sellGrossAmount * feePercentage));
  const sellNetAmount = sellGrossAmount - sellFee;
  
  // Leveraged trading calculations
  const marginAmountNum = parseFloat(marginAmount) || 0;
  const notionalValue = marginAmountNum * leverage;
  const coinAmountLeveraged = notionalValue / currentPrice;

  // Format chart data for Recharts based on time period
  const formatChartTime = (date: Date, period: 'hour' | 'day' | 'week' | 'month') => {
    switch (period) {
      case 'hour':
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      case 'day':
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      case 'week':
        return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', hour: '2-digit' });
      case 'month':
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      default:
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
  };
  
  const chartData = priceHistory.map((p) => ({
    time: formatChartTime(new Date(p.createdAt), timePeriod),
    price: p.price,
    timestamp: p.createdAt,
  }));

  const transactions = activeTab === 'my' ? myTransactions : allTransactions;

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border/30 p-3 shadow-lg">
          <p className="text-sm font-medium">${data.price.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(data.timestamp).toLocaleString('fr-FR')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-6">
      {/* Header */}
      <header>
        <Link
          to="/games"
          className="text-sm text-muted-foreground tracking-wide uppercase hover:text-foreground transition-colors"
        >
          ← Jeux
        </Link>
        <h1 className="text-4xl md:text-5xl font-light tracking-tight mt-2">
          Aura Coin
        </h1>
      </header>

      {/* Main Trading Card */}
      <div className="border border-border/30 p-6 space-y-5">
        {/* Balances and Current Price */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-border/30 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde Money</p>
            <p className="text-2xl font-light tabular-nums">${moneyBalance.toLocaleString()}</p>
          </div>
          <div className="border border-border/30 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde AuraCoin</p>
            <p className="text-2xl font-light tabular-nums">{auraCoinBalance.toFixed(4)} AC</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              ≈ ${(auraCoinBalance * currentPrice).toFixed(2)}
            </p>
          </div>
          <div className="border border-border/30 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Prix Actuel</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-light tabular-nums">
                ${currentPrice.toFixed(2)}
              </span>
              <span className={cn(
                "flex items-center text-xs",
                priceChange >= 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Professional Chart */}
        <div className="border border-border/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground uppercase tracking-wide">
              Cours {timePeriod === 'hour' ? '1h' : timePeriod === 'day' ? '24h' : timePeriod === 'week' ? '7j' : '30j'}
            </span>
            <div className="flex gap-1 border border-border/30">
              <button
                onClick={() => setTimePeriod('hour')}
                className={cn(
                  "px-3 py-1 text-xs transition-colors",
                  timePeriod === 'hour'
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-border/30"
                )}
              >
                Heure
              </button>
              <button
                onClick={() => setTimePeriod('day')}
                className={cn(
                  "px-3 py-1 text-xs transition-colors",
                  timePeriod === 'day'
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-border/30"
                )}
              >
                Jour
              </button>
              <button
                onClick={() => setTimePeriod('week')}
                className={cn(
                  "px-3 py-1 text-xs transition-colors",
                  timePeriod === 'week'
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-border/30"
                )}
              >
                Semaine
              </button>
              <button
                onClick={() => setTimePeriod('month')}
                className={cn(
                  "px-3 py-1 text-xs transition-colors",
                  timePeriod === 'month'
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-border/30"
                )}
              >
                Mois
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                opacity={0.1}
                vertical={false}
              />
              <XAxis
                dataKey="time"
                stroke="currentColor"
                opacity={0.5}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="currentColor"
                opacity={0.5}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="price"
                stroke={priceChange >= 0 ? '#10b981' : '#ef4444'}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Trading Mode Selector */}
        <div className="flex gap-2 border-b border-border/30">
          <button
            onClick={() => setTradingMode('spot')}
            className={cn(
              "px-4 py-2 text-sm transition-colors",
              tradingMode === 'spot'
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Spot
          </button>
          <button
            onClick={() => setTradingMode('leverage')}
            className={cn(
              "px-4 py-2 text-sm transition-colors",
              tradingMode === 'leverage'
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Levier (x10 max)
          </button>
        </div>

        {/* Trading Interface */}
        {tradingMode === 'spot' ? (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Buy */}
          <div className="border border-border/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              <h2 className="text-base font-medium">Acheter</h2>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Montant ($)</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="0"
                  className="flex-1 px-3 py-2 bg-transparent border border-border/30 focus:border-foreground/30 outline-none tabular-nums text-sm"
                />
                <button
                  type="button"
                  onClick={() => setBuyAmount(moneyBalance.toString())}
                  disabled={loading || moneyBalance <= 0}
                  className={cn(
                    "px-3 py-2 border text-[10px] uppercase tracking-widest transition-colors whitespace-nowrap",
                    !loading && moneyBalance > 0
                      ? "border-emerald-500/60 text-emerald-500 hover:bg-emerald-500 hover:text-background"
                      : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  Max
                </button>
                <button
                  onClick={handleBuy}
                  disabled={loading || !buyAmount || buyMoneyAmount <= 0 || buyMoneyAmount > moneyBalance}
                  className={cn(
                    "px-4 py-2 border text-xs transition-colors whitespace-nowrap",
                    !loading && buyMoneyAmount > 0 && buyMoneyAmount <= moneyBalance
                      ? "border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-background"
                      : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  Acheter
                </button>
              </div>
            </div>

            {buyMoneyAmount > 0 && (
              <div className="text-xs text-muted-foreground space-y-1 pt-1">
                <div className="flex justify-between">
                  <span>Frais ({(feePercentage * 100).toFixed(0)}%)</span>
                  <span className="tabular-nums">-${buyFee}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vous recevrez</span>
                  <span className="tabular-nums text-foreground">{buyCoinsEstimate.toFixed(4)} AC</span>
                </div>
              </div>
            )}
          </div>

          {/* Sell */}
          <div className="border border-border/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-red-500" />
              <h2 className="text-base font-medium">Vendre</h2>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Quantité (AC)</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="0"
                  step="0.0001"
                  className="flex-1 px-3 py-2 bg-transparent border border-border/30 focus:border-foreground/30 outline-none tabular-nums text-sm"
                />
                <button
                  type="button"
                  onClick={() => setSellAmount(auraCoinBalance.toFixed(4))}
                  disabled={loading || auraCoinBalance <= 0}
                  className={cn(
                    "px-3 py-2 border text-[10px] uppercase tracking-widest transition-colors whitespace-nowrap",
                    !loading && auraCoinBalance > 0
                      ? "border-red-500/60 text-red-500 hover:bg-red-500 hover:text-background"
                      : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  Max
                </button>
                <button
                  onClick={handleSell}
                  disabled={loading || !sellAmount || sellCoinAmount <= 0 || sellCoinAmount > auraCoinBalance}
                  className={cn(
                    "px-4 py-2 border text-xs transition-colors whitespace-nowrap",
                    !loading && sellCoinAmount > 0 && sellCoinAmount <= auraCoinBalance
                      ? "border-red-500 text-red-500 hover:bg-red-500 hover:text-background"
                      : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  Vendre
                </button>
              </div>
            </div>

            {sellCoinAmount > 0 && (
              <div className="text-xs text-muted-foreground space-y-1 pt-1">
                <div className="flex justify-between">
                  <span>Valeur brute</span>
                  <span className="tabular-nums">${sellGrossAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Frais ({(feePercentage * 100).toFixed(0)}%)</span>
                  <span className="tabular-nums">-${sellFee}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vous recevrez</span>
                  <span className="tabular-nums text-foreground">${sellNetAmount}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        ) : (
        <div className="space-y-4">
          {/* Leverage Trading Interface */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Open Position */}
            <div className="border border-border/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-medium">Ouvrir une Position</h2>
              </div>

              {/* Position Type */}
              <div>
                <label className="text-xs text-muted-foreground">Type de Position</label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setPositionType('LONG')}
                    className={cn(
                      "flex-1 px-3 py-2 border text-sm transition-colors",
                      positionType === 'LONG'
                        ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                        : "border-border/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    LONG
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositionType('SHORT')}
                    className={cn(
                      "flex-1 px-3 py-2 border text-sm transition-colors",
                      positionType === 'SHORT'
                        ? "border-red-500 text-red-500 bg-red-500/10"
                        : "border-border/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    SHORT
                  </button>
                </div>
              </div>

              {/* Leverage Selector */}
              <div>
                <label className="text-xs text-muted-foreground">Effet de Levier</label>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {[1, 2, 3, 5, 10].map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      onClick={() => setLeverage(lev)}
                      className={cn(
                        "px-3 py-1 text-xs border transition-colors",
                        leverage === lev
                          ? "border-foreground text-foreground bg-foreground/10"
                          : "border-border/30 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Margin Amount */}
              <div>
                <label className="text-xs text-muted-foreground">Marge ($)</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    value={marginAmount}
                    onChange={(e) => setMarginAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 px-3 py-2 bg-transparent border border-border/30 focus:border-foreground/30 outline-none tabular-nums text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setMarginAmount(moneyBalance.toString())}
                    disabled={loading || moneyBalance <= 0}
                    className={cn(
                      "px-3 py-2 border text-[10px] uppercase tracking-widest transition-colors whitespace-nowrap",
                      !loading && moneyBalance > 0
                        ? "border-foreground/60 text-foreground hover:bg-foreground hover:text-background"
                        : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                    )}
                  >
                    Max
                  </button>
                </div>
              </div>

              {marginAmountNum > 0 && (
                <div className="text-xs text-muted-foreground space-y-1 pt-1">
                  <div className="flex justify-between">
                    <span>Valeur notionnelle</span>
                    <span className="tabular-nums text-foreground">${notionalValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantité (AC)</span>
                    <span className="tabular-nums text-foreground">{coinAmountLeveraged.toFixed(4)} AC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Prix d'entrée</span>
                    <span className="tabular-nums">${currentPrice.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleOpenPosition}
                disabled={loading || !marginAmount || marginAmountNum <= 0 || marginAmountNum > moneyBalance}
                className={cn(
                  "w-full px-4 py-2 border text-sm transition-colors",
                  !loading && marginAmountNum > 0 && marginAmountNum <= moneyBalance
                    ? positionType === 'LONG'
                      ? "border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-background"
                      : "border-red-500 text-red-500 hover:bg-red-500 hover:text-background"
                    : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                )}
              >
                Ouvrir {positionType}
              </button>
            </div>

            {/* Open Positions */}
            <div className="border border-border/30 p-4 space-y-3">
              <h2 className="text-base font-medium">Positions Ouvertes</h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {openPositions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    Aucune position ouverte
                  </p>
                ) : (
                  openPositions.map((pos) => (
                    <div
                      key={pos.id}
                      className={cn(
                        "p-3 border space-y-2",
                        pos.type === 'LONG' ? "border-emerald-500/30" : "border-red-500/30"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-medium",
                            pos.type === 'LONG' ? "text-emerald-500" : "text-red-500"
                          )}>
                            {pos.type} {pos.leverage}x
                          </span>
                        </div>
                        <button
                          onClick={() => handleClosePosition(pos.id)}
                          disabled={loading}
                          className="p-1 hover:bg-border/30 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Prix d'entrée</span>
                          <span className="tabular-nums">${pos.entryPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Prix actuel</span>
                          <span className="tabular-nums">${pos.currentPrice?.toFixed(2) || currentPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Marge</span>
                          <span className="tabular-nums">${pos.marginAmount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">P&L</span>
                          <span className={cn(
                            "tabular-nums font-medium",
                            (pos.pnl || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                          )}>
                            {pos.pnl && pos.pnl >= 0 ? '+' : ''}{pos.pnl?.toFixed(2) || '0.00'} $
                            ({pos.pnlPercentage?.toFixed(2) || '0.00'}%)
                          </span>
                        </div>
                        {pos.marginRatio !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ratio de marge</span>
                            <span className={cn(
                              "tabular-nums",
                              pos.marginRatio < 1 ? "text-red-500" : "text-foreground"
                            )}>
                              {(pos.marginRatio * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-center text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Transactions */}
      <div className="border border-border/30 p-5 space-y-3">
        <div className="flex gap-4 border-b border-border/30">
          <button
            onClick={() => setActiveTab('my')}
            className={cn(
              "pb-2 text-sm transition-colors",
              activeTab === 'my'
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Mes Transactions
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "pb-2 text-sm transition-colors",
              activeTab === 'all'
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Toutes les Transactions
          </button>
        </div>

        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              Aucune transaction
            </p>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 border-b border-border/10"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-7 h-7 flex items-center justify-center border",
                    tx.type === 'BUY'
                      ? "border-emerald-500/30 text-emerald-500"
                      : "border-red-500/30 text-red-500"
                  )}>
                    {tx.type === 'BUY' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {activeTab === 'all' && (
                        <span
                          className="text-xs font-medium"
                          style={{ color: tx.user.usernameColor || undefined }}
                        >
                          {tx.user.username}
                        </span>
                      )}
                      <span className={cn(
                        "text-[10px] uppercase",
                        tx.type === 'BUY' ? "text-emerald-500" : "text-red-500"
                      )}>
                        {tx.type === 'BUY' ? 'Achat' : 'Vente'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs tabular-nums">
                    {tx.type === 'BUY' ? '+' : '-'}{tx.coinAmount.toFixed(4)} AC
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
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
