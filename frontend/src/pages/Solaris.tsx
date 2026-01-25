import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { solarisApi, SolarisTransaction, SolarisPriceHistory } from '../services/api';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Solaris() {
  const { refreshUser } = useAuth();
  const { socket } = useSocket();
  
  const [currentPrice, setCurrentPrice] = useState(18);
  const [feePercentage, setFeePercentage] = useState(0.015);
  const [priceHistory, setPriceHistory] = useState<SolarisPriceHistory[]>([]);
  const [solarisBalance, setSolarisBalance] = useState(0);
  const [moneyBalance, setMoneyBalance] = useState(0);
  
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [myTransactions, setMyTransactions] = useState<SolarisTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<SolarisTransaction[]>([]);
  
  const fetchData = useCallback(async () => {
    try {
      const [priceRes, myTxRes, allTxRes] = await Promise.all([
        solarisApi.getPrice(24),
        solarisApi.getMyTransactions({ limit: 50 }),
        solarisApi.getAllTransactions({ limit: 50 }),
      ]);
      
      setCurrentPrice(priceRes.data.currentPrice);
      setFeePercentage(priceRes.data.feePercentage);
      setPriceHistory(priceRes.data.history);
      setSolarisBalance(priceRes.data.userBalance.solaris);
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
    
    socket.on('solaris:price-update', handlePriceUpdate);
    
    return () => {
      socket.off('solaris:price-update', handlePriceUpdate);
    };
  }, [socket]);
  
  const handleBuy = async () => {
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await solarisApi.buy(amount);
      setSolarisBalance(res.data.newBalance.solaris);
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
      const res = await solarisApi.sell(amount);
      setSolarisBalance(res.data.newBalance.solaris);
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
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-6">
      {/* Main Trading Card */}
      <div className="border border-border/30 p-6 space-y-5">
        {/* Balances and Current Price */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-border/30 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde Money</p>
            <p className="text-2xl font-light tabular-nums">${moneyBalance.toLocaleString()}</p>
          </div>
          <div className="border border-border/30 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde Solaris</p>
            <p className="text-2xl font-light tabular-nums">{solarisBalance.toFixed(4)} SOL</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              ≈ ${(solarisBalance * currentPrice).toFixed(2)}
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
            <span className="text-sm text-muted-foreground uppercase tracking-wide">Cours 24h</span>
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

        {/* Trading Interface */}
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
                  <span>Frais ({(feePercentage * 100).toFixed(1)}%)</span>
                  <span className="tabular-nums">-${buyFee}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vous recevrez</span>
                  <span className="tabular-nums text-foreground">{buyCoinsEstimate.toFixed(4)} SOL</span>
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
              <label className="text-xs text-muted-foreground">Quantité (SOL)</label>
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
                  onClick={() => setSellAmount(solarisBalance.toFixed(4))}
                  disabled={loading || solarisBalance <= 0}
                  className={cn(
                    "px-3 py-2 border text-[10px] uppercase tracking-widest transition-colors whitespace-nowrap",
                    !loading && solarisBalance > 0
                      ? "border-red-500/60 text-red-500 hover:bg-red-500 hover:text-background"
                      : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  Max
                </button>
                <button
                  onClick={handleSell}
                  disabled={loading || !sellAmount || sellCoinAmount <= 0 || sellCoinAmount > solarisBalance}
                  className={cn(
                    "px-4 py-2 border text-xs transition-colors whitespace-nowrap",
                    !loading && sellCoinAmount > 0 && sellCoinAmount <= solarisBalance
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
                  <span>Frais ({(feePercentage * 100).toFixed(1)}%)</span>
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
                    {tx.type === 'BUY' ? '+' : '-'}{tx.coinAmount.toFixed(4)} SOL
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
