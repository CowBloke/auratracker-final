import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { auraCoinApi, AuraCoinTransaction, AuraCoinPriceHistory } from '../services/api';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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

  const MIN_FEE = 1;
  const MIN_TRADE_GROSS = MIN_FEE + 1;
  
  const fetchData = useCallback(async () => {
    try {
      const [priceRes, myTxRes, allTxRes] = await Promise.all([
        auraCoinApi.getPrice(24),
        auraCoinApi.getMyTransactions({ limit: 50 }),
        auraCoinApi.getAllTransactions({ limit: 50 }),
      ]);
      
      setCurrentPrice(priceRes.data.currentPrice);
      setFeePercentage(priceRes.data.feePercentage);
      setPriceHistory(priceRes.data.history);
      setAuraCoinBalance(priceRes.data.userBalance.auraCoin);
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
    
    socket.on('auracoin:price-update', handlePriceUpdate);
    
    return () => {
      socket.off('auracoin:price-update', handlePriceUpdate);
    };
  }, [socket]);
  
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
  
  // Calculate price change
  const priceChange = priceHistory.length > 1
    ? ((currentPrice - priceHistory[0].price) / priceHistory[0].price) * 100
    : 0;
  
  // Calculate estimates
  const buyMoneyAmount = parseFloat(buyAmount) || 0;
  const buyFee = Math.floor(buyMoneyAmount * feePercentage);
  const buyCoinsEstimate = (buyMoneyAmount - buyFee) / currentPrice;
  
  const sellCoinAmount = parseFloat(sellAmount) || 0;
  const sellGrossAmount = Math.floor(sellCoinAmount * currentPrice);
  const sellFee = Math.floor(sellGrossAmount * feePercentage);
  const sellNetAmount = sellGrossAmount - sellFee;

  const minBuyAmount = MIN_TRADE_GROSS;
  const minSellAmount = Math.ceil((MIN_TRADE_GROSS / currentPrice) * 10000) / 10000;
  const canUseMinBuy = moneyBalance >= minBuyAmount;
  const canUseMinSell = auraCoinBalance >= minSellAmount;
  
  // Mini chart SVG
  const chartWidth = 400;
  const chartHeight = 100;
  const chartPadding = 10;
  
  const minPrice = Math.min(...priceHistory.map(p => p.price), currentPrice) * 0.99;
  const maxPrice = Math.max(...priceHistory.map(p => p.price), currentPrice) * 1.01;
  const priceRange = maxPrice - minPrice || 1;
  
  const chartPoints = priceHistory.map((p, i) => {
    const x = chartPadding + (i / Math.max(priceHistory.length - 1, 1)) * (chartWidth - 2 * chartPadding);
    const y = chartHeight - chartPadding - ((p.price - minPrice) / priceRange) * (chartHeight - 2 * chartPadding);
    return `${x},${y}`;
  }).join(' ');
  
  const transactions = activeTab === 'my' ? myTransactions : allTransactions;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-12">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/games"
              className="text-sm text-muted-foreground tracking-wide uppercase hover:text-foreground transition-colors"
            >
              ← Jeux
            </Link>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Aura Coin
            </h1>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-3xl font-light tabular-nums">
                ${currentPrice.toFixed(2)}
              </span>
              <span className={cn(
                "flex items-center text-sm",
                priceChange >= 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {priceChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Prix actuel</p>
          </div>
        </div>
      </header>
      
      {/* Price Chart */}
      <div className="border border-border/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground uppercase tracking-wide">Cours 24h</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            Min: ${minPrice.toFixed(2)} / Max: ${maxPrice.toFixed(2)}
          </span>
        </div>
        
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-32"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
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
          
          {/* Price line */}
          {priceHistory.length > 1 && (
            <polyline
              fill="none"
              stroke={priceChange >= 0 ? '#10b981' : '#ef4444'}
              strokeWidth="2"
              points={chartPoints}
            />
          )}
          
          {/* Current price dot */}
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
      
      {/* Balances */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border/30 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde $</p>
          <p className="text-2xl font-light tabular-nums">${moneyBalance.toLocaleString()}</p>
        </div>
        <div className="border border-border/30 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde AuraCoin</p>
          <p className="text-2xl font-light tabular-nums">{auraCoinBalance.toFixed(4)} AC</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            ≈ ${(auraCoinBalance * currentPrice).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Trading Interface */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Buy */}
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
                  disabled={loading || !canUseMinBuy}
                  className={cn(
                    "px-2 py-1 border text-[10px] uppercase tracking-widest transition-colors",
                    !loading && canUseMinBuy
                      ? "border-emerald-500/60 text-emerald-500 hover:bg-emerald-500 hover:text-background"
                      : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  Min
                </button>
                <button
                  type="button"
                  onClick={() => setBuyAmount(moneyBalance.toString())}
                  disabled={loading || moneyBalance <= 0}
                  className={cn(
                    "px-2 py-1 border text-[10px] uppercase tracking-widest transition-colors",
                    !loading && moneyBalance > 0
                      ? "border-emerald-500/60 text-emerald-500 hover:bg-emerald-500 hover:text-background"
                      : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  Max
                </button>
              </div>
            </div>
            <input
              type="number"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              placeholder="0"
              className="w-full mt-1 px-3 py-2 bg-transparent border border-border/30 focus:border-foreground/30 outline-none tabular-nums"
            />
          </div>
          
          {buyMoneyAmount > 0 && (
            <div className="text-sm text-muted-foreground space-y-1">
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
          
          <button
            onClick={handleBuy}
            disabled={loading || !buyAmount || buyMoneyAmount <= 0 || buyMoneyAmount > moneyBalance}
            className={cn(
              "w-full py-3 border text-sm transition-colors",
              !loading && buyMoneyAmount > 0 && buyMoneyAmount <= moneyBalance
                ? "border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-background"
                : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            {loading ? 'Traitement...' : 'Acheter'}
          </button>
        </div>
        
        {/* Sell */}
        <div className="border border-border/30 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-medium">Vendre</h2>
          </div>
          
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Quantité (AC)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSellAmount(minSellAmount.toFixed(4))}
                  disabled={loading || !canUseMinSell}
                  className={cn(
                    "px-2 py-1 border text-[10px] uppercase tracking-widest transition-colors",
                    !loading && canUseMinSell
                      ? "border-red-500/60 text-red-500 hover:bg-red-500 hover:text-background"
                      : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  Min
                </button>
                <button
                  type="button"
                  onClick={() => setSellAmount(auraCoinBalance.toFixed(4))}
                  disabled={loading || auraCoinBalance <= 0}
                  className={cn(
                    "px-2 py-1 border text-[10px] uppercase tracking-widest transition-colors",
                    !loading && auraCoinBalance > 0
                      ? "border-red-500/60 text-red-500 hover:bg-red-500 hover:text-background"
                      : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  Max
                </button>
              </div>
            </div>
            <input
              type="number"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
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
                <span>Frais ({(feePercentage * 100).toFixed(0)}%)</span>
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
            disabled={loading || !sellAmount || sellCoinAmount <= 0 || sellCoinAmount > auraCoinBalance}
            className={cn(
              "w-full py-3 border text-sm transition-colors",
              !loading && sellCoinAmount > 0 && sellCoinAmount <= auraCoinBalance
                ? "border-red-500 text-red-500 hover:bg-red-500 hover:text-background"
                : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            {loading ? 'Traitement...' : 'Vendre'}
          </button>
        </div>
      </div>
      
      {/* Error */}
      {error && (
        <div className="text-center text-red-500 text-sm">
          {error}
        </div>
      )}
      
      {/* Transactions */}
      <div className="space-y-4">
        <div className="flex gap-4 border-b border-border/30">
          <button
            onClick={() => setActiveTab('my')}
            className={cn(
              "pb-3 text-sm transition-colors",
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
              "pb-3 text-sm transition-colors",
              activeTab === 'all'
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Toutes les Transactions
          </button>
        </div>
        
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune transaction
            </p>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3 border-b border-border/10"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 flex items-center justify-center border",
                    tx.type === 'BUY'
                      ? "border-emerald-500/30 text-emerald-500"
                      : "border-red-500/30 text-red-500"
                  )}>
                    {tx.type === 'BUY' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {activeTab === 'all' && (
                        <span
                          className="text-sm font-medium"
                          style={{ color: tx.user.usernameColor || undefined }}
                        >
                          {tx.user.username}
                        </span>
                      )}
                      <span className={cn(
                        "text-xs uppercase",
                        tx.type === 'BUY' ? "text-emerald-500" : "text-red-500"
                      )}>
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
                    {tx.type === 'BUY' ? '+' : '-'}{tx.coinAmount.toFixed(4)} AC
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
