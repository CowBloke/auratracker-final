import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { auraCoinApi, AuraCoinTransaction, AuraCoinPriceHistory, AuraCoinPosition } from '../services/api';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { UsernameDisplay } from '@/components/ui/username-display';

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
    <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
      {/* Main Trading Card */}
      <Card>
        <CardContent className={`p-6 ${SPACING.SECTION_SPACING}`}>
          {/* Balances and Current Price */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground  ")}>Solde Money</p>
                <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>${moneyBalance.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground  ")}>Solde AuraCoin</p>
                <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>{auraCoinBalance.toFixed(4)} AuraCoin</p>
                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground tabular-nums")}>
                  ≈ ${(auraCoinBalance * currentPrice).toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground  ")}>Prix Actuel</p>
                <div className="flex items-center gap-2">
                  <span className={cn(TYPOGRAPHY.H2, "tabular-nums")}>
                    ${currentPrice.toFixed(2)}
                  </span>
                  <span className={cn(
                    "flex items-center",
                    TYPOGRAPHY.XS,
                    priceChange >= 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Professional Chart */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground  ")}>
                  Cours {timePeriod === 'hour' ? '1h' : timePeriod === 'day' ? '24h' : timePeriod === 'week' ? '7j' : '30j'}
                </span>
                <div className="flex gap-1 border border-border/30 rounded-md">
                  <Button
                    onClick={() => setTimePeriod('hour')}
                    variant={timePeriod === 'hour' ? 'default' : 'ghost'}
                    size="sm"
                    className="text-xs"
                  >
                    Heure
                  </Button>
                  <Button
                    onClick={() => setTimePeriod('day')}
                    variant={timePeriod === 'day' ? 'default' : 'ghost'}
                    size="sm"
                    className="text-xs"
                  >
                    Jour
                  </Button>
                  <Button
                    onClick={() => setTimePeriod('week')}
                    variant={timePeriod === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className="text-xs"
                  >
                    Semaine
                  </Button>
                  <Button
                    onClick={() => setTimePeriod('month')}
                    variant={timePeriod === 'month' ? 'default' : 'ghost'}
                    size="sm"
                    className="text-xs"
                  >
                    Mois
                  </Button>
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
            </CardContent>
          </Card>

          {/* Trading Mode Selector */}
          <Tabs value={tradingMode} onValueChange={(v) => setTradingMode(v as 'spot' | 'leverage')}>
            <TabsList>
              <TabsTrigger value="spot">Spot</TabsTrigger>
              <TabsTrigger value="leverage">Levier (x10 max)</TabsTrigger>
            </TabsList>

            <TabsContent value="spot" className="mt-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Buy */}
                <Card>
                  <CardContent className={`p-6 ${SPACING.CARD_SPACING}`}>
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                      <h2 className={TYPOGRAPHY.H6}>Acheter</h2>
                    </div>

                    <div>
                      <label className={TYPOGRAPHY.XS}>Montant ($)</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          value={buyAmount}
                          onChange={(e) => setBuyAmount(e.target.value)}
                          placeholder="0"
                          className="flex-1 tabular-nums"
                        />
                        <Button
                          type="button"
                          onClick={() => setBuyAmount(moneyBalance.toString())}
                          disabled={loading || moneyBalance <= 0}
                          variant="outline"
                          size="sm"
                          className="text-[10px]   whitespace-nowrap border-emerald-500/60 text-emerald-500 hover:bg-emerald-500 hover:text-background"
                        >
                          Max
                        </Button>
                        <Button
                          onClick={handleBuy}
                          disabled={loading || !buyAmount || buyMoneyAmount <= 0 || buyMoneyAmount > moneyBalance}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "text-xs whitespace-nowrap",
                            !loading && buyMoneyAmount > 0 && buyMoneyAmount <= moneyBalance
                              ? "border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-background"
                              : ""
                          )}
                        >
                          Acheter
                        </Button>
                      </div>
                    </div>

                    {buyMoneyAmount > 0 && (
                      <div className={cn(TYPOGRAPHY.XS, "text-muted-foreground space-y-1 pt-1")}>
                        <div className="flex justify-between">
                          <span>Frais ({(feePercentage * 100).toFixed(0)}%)</span>
                          <span className="tabular-nums">-${buyFee}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Vous recevrez</span>
                          <span className="tabular-nums text-foreground">{buyCoinsEstimate.toFixed(4)} AuraCoin</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Sell */}
                <Card>
                  <CardContent className={`p-6 ${SPACING.CARD_SPACING}`}>
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                      <h2 className={TYPOGRAPHY.H6}>Vendre</h2>
                    </div>

                    <div>
                      <label className={TYPOGRAPHY.XS}>Quantité (AuraCoin)</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          value={sellAmount}
                          onChange={(e) => setSellAmount(e.target.value)}
                          placeholder="0"
                          step="0.0001"
                          className="flex-1 tabular-nums"
                        />
                        <Button
                          type="button"
                          onClick={() => setSellAmount(auraCoinBalance.toFixed(4))}
                          disabled={loading || auraCoinBalance <= 0}
                          variant="outline"
                          size="sm"
                          className="text-[10px]   whitespace-nowrap border-red-500/60 text-red-500 hover:bg-red-500 hover:text-background"
                        >
                          Max
                        </Button>
                        <Button
                          onClick={handleSell}
                          disabled={loading || !sellAmount || sellCoinAmount <= 0 || sellCoinAmount > auraCoinBalance}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "text-xs whitespace-nowrap",
                            !loading && sellCoinAmount > 0 && sellCoinAmount <= auraCoinBalance
                              ? "border-red-500 text-red-500 hover:bg-red-500 hover:text-background"
                              : ""
                          )}
                        >
                          Vendre
                        </Button>
                      </div>
                    </div>

                    {sellCoinAmount > 0 && (
                      <div className={cn(TYPOGRAPHY.XS, "text-muted-foreground space-y-1 pt-1")}>
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
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="leverage" className="mt-4">
              <div className={SPACING.CARD_SPACING}>
                {/* Leverage Trading Interface */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Open Position */}
                  <Card>
                    <CardContent className={`p-6 ${SPACING.CARD_SPACING}`}>
                      <div className="flex items-center gap-2">
                        <h2 className={TYPOGRAPHY.H6}>Ouvrir une Position</h2>
                      </div>

                      {/* Position Type */}
                      <div>
                        <label className={TYPOGRAPHY.XS}>Type de Position</label>
                        <div className="flex gap-2 mt-1">
                          <Button
                            type="button"
                            onClick={() => setPositionType('LONG')}
                            variant={positionType === 'LONG' ? 'default' : 'outline'}
                            className="flex-1"
                          >
                            LONG
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setPositionType('SHORT')}
                            variant={positionType === 'SHORT' ? 'default' : 'outline'}
                            className="flex-1"
                          >
                            SHORT
                          </Button>
                        </div>
                      </div>

                      {/* Leverage Selector */}
                      <div>
                        <label className={TYPOGRAPHY.XS}>Effet de Levier</label>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {[1, 2, 3, 5, 10].map((lev) => (
                            <Button
                              key={lev}
                              type="button"
                              onClick={() => setLeverage(lev)}
                              variant={leverage === lev ? 'default' : 'outline'}
                              size="sm"
                              className="text-xs"
                            >
                              {lev}x
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Margin Amount */}
                      <div>
                        <label className={TYPOGRAPHY.XS}>Marge ($)</label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type="number"
                            value={marginAmount}
                            onChange={(e) => setMarginAmount(e.target.value)}
                            placeholder="0"
                            className="flex-1 tabular-nums"
                          />
                          <Button
                            type="button"
                            onClick={() => setMarginAmount(moneyBalance.toString())}
                            disabled={loading || moneyBalance <= 0}
                            variant="outline"
                            size="sm"
                            className="text-[10px]   whitespace-nowrap"
                          >
                            Max
                          </Button>
                        </div>
                      </div>

                      {marginAmountNum > 0 && (
                        <div className={cn(TYPOGRAPHY.XS, "text-muted-foreground space-y-1 pt-1")}>
                          <div className="flex justify-between">
                            <span>Valeur notionnelle</span>
                            <span className="tabular-nums text-foreground">${notionalValue.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Quantité (AuraCoin)</span>
                            <span className="tabular-nums text-foreground">{coinAmountLeveraged.toFixed(4)} AuraCoin</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Prix d'entrée</span>
                            <span className="tabular-nums">${currentPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={handleOpenPosition}
                        disabled={loading || !marginAmount || marginAmountNum <= 0 || marginAmountNum > moneyBalance}
                        variant="outline"
                        className={cn(
                          "w-full",
                          !loading && marginAmountNum > 0 && marginAmountNum <= moneyBalance
                            ? positionType === 'LONG'
                              ? "border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-background"
                              : "border-red-500 text-red-500 hover:bg-red-500 hover:text-background"
                            : ""
                        )}
                      >
                        Ouvrir {positionType}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Open Positions */}
                  <Card>
                    <CardContent className={`p-6 ${SPACING.CARD_SPACING}`}>
                      <h2 className={TYPOGRAPHY.H6}>Positions Ouvertes</h2>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {openPositions.length === 0 ? (
                          <p className={cn(TYPOGRAPHY.MUTED, "text-center py-4")}>
                            Aucune position ouverte
                          </p>
                        ) : (
                          openPositions.map((pos) => (
                            <Card
                              key={pos.id}
                              className={cn(
                                "p-3",
                                pos.type === 'LONG' ? "border-emerald-500/30" : "border-red-500/30"
                              )}
                            >
                              <CardContent className="p-0 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      TYPOGRAPHY.XS,
                                      "font-medium",
                                      pos.type === 'LONG' ? "text-emerald-500" : "text-red-500"
                                    )}>
                                      {pos.type} {pos.leverage}x
                                    </span>
                                  </div>
                                  <Button
                                    onClick={() => handleClosePosition(pos.id)}
                                    disabled={loading}
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                                <div className={cn(TYPOGRAPHY.XS, "space-y-1")}>
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
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4">
            <p className={cn(TYPOGRAPHY.SMALL, "text-center text-destructive")}>
              {error}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <Card>
        <CardContent className={`p-6 ${SPACING.CARD_SPACING}`}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my' | 'all')}>
            <TabsList>
              <TabsTrigger value="my">Mes Transactions</TabsTrigger>
              <TabsTrigger value="all">Toutes les Transactions</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-4">
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {transactions.length === 0 ? (
                  <p className={cn(TYPOGRAPHY.MUTED, "text-center py-6")}>
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
                          "w-7 h-7 flex items-center justify-center border rounded-md",
                          tx.type === 'BUY'
                            ? "border-emerald-500/30 text-emerald-500"
                            : "border-red-500/30 text-red-500"
                        )}>
                          {tx.type === 'BUY' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {activeTab === 'all' && (
                              <UsernameDisplay
                                username={tx.user.username}
                                usernameColor={tx.user.usernameColor}
                                className={TYPOGRAPHY.XS}
                              />
                            )}
                            <span className={cn(
                              "text-[10px] ",
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
                        <p className={cn(TYPOGRAPHY.XS, "tabular-nums")}>
                          {tx.type === 'BUY' ? '+' : '-'}{tx.coinAmount.toFixed(4)} AuraCoin
                        </p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          @ ${tx.price.toFixed(2)} • Frais: ${tx.fee}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
