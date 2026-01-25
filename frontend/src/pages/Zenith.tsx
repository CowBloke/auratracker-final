import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { zenithApi, ZenithTransaction, ZenithPriceHistory } from '../services/api';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';

export default function Zenith() {
  const { refreshUser } = useAuth();
  const { socket } = useSocket();
  
  const [currentPrice, setCurrentPrice] = useState(62);
  const [feePercentage, setFeePercentage] = useState(0.028);
  const [priceHistory, setPriceHistory] = useState<ZenithPriceHistory[]>([]);
  const [zenithBalance, setZenithBalance] = useState(0);
  const [moneyBalance, setMoneyBalance] = useState(0);
  
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [myTransactions, setMyTransactions] = useState<ZenithTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<ZenithTransaction[]>([]);
  
  const fetchData = useCallback(async () => {
    try {
      const [priceRes, myTxRes, allTxRes] = await Promise.all([
        zenithApi.getPrice(24),
        zenithApi.getMyTransactions({ limit: 50 }),
        zenithApi.getAllTransactions({ limit: 50 }),
      ]);
      
      setCurrentPrice(priceRes.data.currentPrice);
      setFeePercentage(priceRes.data.feePercentage);
      setPriceHistory(priceRes.data.history);
      setZenithBalance(priceRes.data.userBalance.zenith);
      setMoneyBalance(priceRes.data.userBalance.money);
      setMyTransactions(myTxRes.data.transactions);
      setAllTransactions(allTxRes.data.transactions);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }, []);
  
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
    };
    
    socket.on('zenith:price-update', handlePriceUpdate);
    
    return () => {
      socket.off('zenith:price-update', handlePriceUpdate);
    };
  }, [socket]);
  
  const handleBuy = async () => {
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await zenithApi.buy(amount);
      setZenithBalance(res.data.newBalance.zenith);
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
      const res = await zenithApi.sell(amount);
      setZenithBalance(res.data.newBalance.zenith);
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

  // Format chart data for Recharts
  const chartData = priceHistory.map((p) => ({
    time: new Date(p.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
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
    <PageLayout>
      {/* Main Trading Card */}
      <Card className="border-border/40">
        <CardContent className={SPACING.SECTION_SPACING}>
          {/* Balances and Current Price */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-border/40">
              <CardContent className="p-4">
                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground uppercase tracking-wide")}>Solde Money</p>
                <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>${moneyBalance.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4">
                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground uppercase tracking-wide")}>Solde Zenith</p>
                <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>{zenithBalance.toFixed(4)} ZNT</p>
                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground tabular-nums")}>
                  ≈ ${(zenithBalance * currentPrice).toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4">
                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground uppercase tracking-wide")}>Prix Actuel</p>
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
          <Card className="border-border/40">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground uppercase tracking-wide")}>Cours 24h</span>
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

          {/* Trading Interface */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Buy */}
            <Card className="border-border/40">
              <CardContent className={SPACING.CARD_SPACING}>
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
                      className="text-[10px] uppercase tracking-widest whitespace-nowrap border-emerald-500/60 text-emerald-500 hover:bg-emerald-500 hover:text-background"
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
                      <span>Frais ({(feePercentage * 100).toFixed(1)}%)</span>
                      <span className="tabular-nums">-${buyFee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Vous recevrez</span>
                      <span className="tabular-nums text-foreground">{buyCoinsEstimate.toFixed(4)} ZNT</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sell */}
            <Card className="border-border/40">
              <CardContent className={SPACING.CARD_SPACING}>
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                  <h2 className={TYPOGRAPHY.H6}>Vendre</h2>
                </div>

                <div>
                  <label className={TYPOGRAPHY.XS}>Quantité (ZNT)</label>
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
                      onClick={() => setSellAmount(zenithBalance.toFixed(4))}
                      disabled={loading || zenithBalance <= 0}
                      variant="outline"
                      size="sm"
                      className="text-[10px] uppercase tracking-widest whitespace-nowrap border-red-500/60 text-red-500 hover:bg-red-500 hover:text-background"
                    >
                      Max
                    </Button>
                    <Button
                      onClick={handleSell}
                      disabled={loading || !sellAmount || sellCoinAmount <= 0 || sellCoinAmount > zenithBalance}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "text-xs whitespace-nowrap",
                        !loading && sellCoinAmount > 0 && sellCoinAmount <= zenithBalance
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
                      <span>Frais ({(feePercentage * 100).toFixed(1)}%)</span>
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
      <Card className="border-border/40">
        <CardContent className={SPACING.CARD_SPACING}>
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
                              <span
                                className={TYPOGRAPHY.XS}
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
                        <p className={cn(TYPOGRAPHY.XS, "tabular-nums")}>
                          {tx.type === 'BUY' ? '+' : '-'}{tx.coinAmount.toFixed(4)} ZNT
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
    </PageLayout>
  );
}
