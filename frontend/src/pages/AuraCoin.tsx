import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocketBase } from '../contexts/SocketContext';
import {
  auraCoinApi,
  AuraCoinPriceHistory,
  AuraCoinTransaction,
  MiningBlock,
  MinerLeaderboardEntry,
  AuraCoinLeaderboardEntry,
} from '../services/api';
import { cn } from '@/lib/utils';
import { Cpu, TrendingUp, TrendingDown, Zap, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SPACING } from '@/lib/design-system';
import { UsernameDisplay } from '@/components/ui/username-display';
import { format } from 'date-fns';

const fmt = (n: number, decimals = 2) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtCoin = (n: number) => {
  if (n >= 1e6) return `${fmt(n / 1e6, 3)}M`;
  if (n >= 1e3) return `${fmt(n / 1e3, 3)}k`;
  return fmt(n, 6);
};

const fmtMoney = (n: number) => {
  if (n >= 1e9) return `$${fmt(n / 1e9, 2)}B`;
  if (n >= 1e6) return `$${fmt(n / 1e6, 2)}M`;
  if (n >= 1e3) return `$${fmt(n / 1e3, 1)}k`;
  return `$${fmt(n, 0)}`;
};

const fmtMoneyExpanded = (n: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + ' $';
};

const txTypeLabel = (type: string) => {
  switch (type) {
    case 'BUY': return { label: 'Achat', color: 'text-green-400' };
    case 'SELL': return { label: 'Vente', color: 'text-red-400' };
    case 'MINE_REWARD': return { label: 'Minage', color: 'text-yellow-400' };
    case 'GPU_PURCHASE': return { label: 'GPU', color: 'text-blue-400' };
    case 'GPU_FEE': return { label: 'Frais GPU', color: 'text-orange-400' };
    default: return { label: type, color: 'text-muted-foreground' };
  }
};

const halvingCountdown = (ms: number) => {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}j ${h}h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}min`;
};

export default function AuraCoin() {
  const { refreshUser } = useAuth();
  const { socket } = useSocketBase();

  // Market state
  const [currentPrice, setCurrentPrice] = useState(2000);
  const [priceHistory, setPriceHistory] = useState<AuraCoinPriceHistory[]>([]);
  const [pool, setPool] = useState<{ coinX: number; moneyY: number; k: number; totalMined: number; blockNumber: number } | null>(null);
  const [miningInfo, setMiningInfo] = useState<{ currentReward: number; halvings: number; nextHalvingMs: number } | null>(null);
  const [auraCoin, setAuraCoin] = useState(0);
  const [money, setMoney] = useState(0);
  const [timePeriod, setTimePeriod] = useState<'hour' | 'day' | 'week'>('day');

  // Trading state
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState('');

  // Mining state
  const [miner, setMiner] = useState<{
    gpuCount: number; power: number; share: number; totalMined: number;
    dailyFee: number; nextGpuCost: number; canAffordNext: boolean;
  } | null>(null);
  const [serverStats, setServerStats] = useState<{
    totalPower: number; activeMiners: number; blockNumber: number;
    totalMined: number; currentReward: number; halvings: number; blockIntervalMs: number;
  } | null>(null);
  const [recentBlocks, setRecentBlocks] = useState<MiningBlock[]>([]);
  const [gpuMax, setGpuMax] = useState(250);
  const [miningLoading, setMiningLoading] = useState(false);
  const [miningError, setMiningError] = useState('');

  // Leaderboard state
  const [coinLeaderboard, setCoinLeaderboard] = useState<AuraCoinLeaderboardEntry[]>([]);
  const [minerLeaderboard, setMinerLeaderboard] = useState<MinerLeaderboardEntry[]>([]);

  // Transaction state
  const [myTxs, setMyTxs] = useState<AuraCoinTransaction[]>([]);
  const [allTxs, setAllTxs] = useState<AuraCoinTransaction[]>([]);

  const periodHours = timePeriod === 'hour' ? 1 : timePeriod === 'day' ? 24 : 168;

  const fetchPrice = useCallback(async () => {
    try {
      const res = await auraCoinApi.getPrice(periodHours);
      setCurrentPrice(res.data.currentPrice);
      setPriceHistory(res.data.history);
      setPool(res.data.pool);
      setMiningInfo(res.data.mining);
      setAuraCoin(res.data.userBalance.auraCoin);
      setMoney(res.data.userBalance.money);
    } catch {}
  }, [periodHours]);

  const fetchMining = useCallback(async () => {
    try {
      const res = await auraCoinApi.getMiningStats();
      setMiner(res.data.myMiner);
      setServerStats(res.data.server);
      setRecentBlocks(res.data.recentBlocks);
      setGpuMax(res.data.gpuMax);
    } catch {}
  }, []);

  const fetchLeaderboards = useCallback(async () => {
    try {
      const [coinRes, minerRes] = await Promise.all([
        auraCoinApi.getLeaderboard(15),
        auraCoinApi.getMiningLeaderboard(),
      ]);
      setCoinLeaderboard(coinRes.data.leaderboard);
      setMinerLeaderboard(minerRes.data.leaderboard);
    } catch {}
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const [myRes, allRes] = await Promise.all([
        auraCoinApi.getMyTransactions({ limit: 30 }),
        auraCoinApi.getAllTransactions({ limit: 30 }),
      ]);
      setMyTxs(myRes.data.transactions);
      setAllTxs(allRes.data.transactions);
    } catch {}
  }, []);

  useEffect(() => {
    fetchPrice();
    fetchMining();
    fetchLeaderboards();
    fetchTransactions();
  }, [fetchPrice, fetchMining, fetchLeaderboards, fetchTransactions]);

  // WebSocket: price updates
  useEffect(() => {
    if (!socket) return;
    const onPrice = (data: { price: number; timestamp: string }) => {
      setCurrentPrice(data.price);
      setPriceHistory((prev) => [
        ...prev.slice(-299),
        { price: data.price, volume: 0, createdAt: data.timestamp },
      ]);
    };
    socket.on('auracoin:price-update', onPrice);
    return () => { socket.off('auracoin:price-update', onPrice); };
  }, [socket]);

  // WebSocket: new block mined
  useEffect(() => {
    if (!socket) return;
    const onBlock = (data: MiningBlock & { minerColor?: string | null }) => {
      setRecentBlocks((prev) => [data, ...prev.slice(0, 9)]);
      fetchMining();
      fetchPrice();
    };
    socket.on('auracoin:block-mined', onBlock);
    return () => { socket.off('auracoin:block-mined', onBlock); };
  }, [socket, fetchMining, fetchPrice]);

  const handleBuy = async () => {
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0) return;
    setTradeLoading(true);
    setTradeError('');
    try {
      const res = await auraCoinApi.buy(amount);
      setAuraCoin(res.data.newBalance.auraCoin);
      setMoney(Number(res.data.newBalance.money));
      setCurrentPrice(res.data.newPrice);
      setBuyAmount('');
      await refreshUser();
      fetchTransactions();
    } catch (err: any) {
      setTradeError(err.response?.data?.error || "Échec de l'achat");
    } finally {
      setTradeLoading(false);
    }
  };

  const handleSell = async () => {
    const amount = parseFloat(sellAmount);
    if (!amount || amount <= 0) return;
    setTradeLoading(true);
    setTradeError('');
    try {
      const res = await auraCoinApi.sell(amount);
      setAuraCoin(res.data.newBalance.auraCoin);
      setMoney(Number(res.data.newBalance.money));
      setCurrentPrice(res.data.newPrice);
      setSellAmount('');
      await refreshUser();
      fetchTransactions();
    } catch (err: any) {
      setTradeError(err.response?.data?.error || 'Échec de la vente');
    } finally {
      setTradeLoading(false);
    }
  };

  const handleBuyGpu = async () => {
    setMiningLoading(true);
    setMiningError('');
    try {
      const res = await auraCoinApi.buyGpu();
      setMoney(Number(res.data.newBalance.money));
      await fetchMining();
      await refreshUser();
      fetchTransactions();
    } catch (err: any) {
      setMiningError(err.response?.data?.error || 'Erreur achat GPU');
    } finally {
      setMiningLoading(false);
    }
  };

  const priceChange = priceHistory.length > 1
    ? ((priceHistory[priceHistory.length - 1].price - priceHistory[0].price) / priceHistory[0].price) * 100
    : 0;

  const chartColor = priceChange >= 0 ? '#22c55e' : '#ef4444';

  return (
    <div className={cn(SPACING.PAGE_PADDING, 'space-y-4 max-w-7xl mx-auto pb-8')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-yellow-400">◈</span> AuraCoin
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            AMM décentralisé · Minage GPU · Anti-whale
          </p>
        </div>
        <div className="text-right">
          <p className={cn('text-3xl font-bold tabular-nums', priceChange >= 0 ? 'text-green-400' : 'text-red-400')}>
            {fmtMoney(currentPrice)}
          </p>
          <p className={cn('text-sm font-medium', priceChange >= 0 ? 'text-green-400' : 'text-red-400')}>
            {priceChange >= 0 ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
            {priceChange >= 0 ? '+' : ''}{fmt(priceChange, 2)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT COLUMN: Chart + Trading */}
        <div className="lg:col-span-2 space-y-4">
          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Prix (hype-ajusté)</CardTitle>
                <div className="flex gap-1">
                  {(['hour', 'day', 'week'] as const).map((p) => (
                    <Button
                      key={p}
                      variant={timePeriod === p ? 'default' : 'ghost'}
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setTimePeriod(p)}
                    >
                      {p === 'hour' ? '1H' : p === 'day' ? '24H' : '7J'}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={priceHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis
                    dataKey="createdAt"
                    tickFormatter={(v) => format(new Date(v), 'HH:mm')}
                    tick={{ fontSize: 10, fill: '#888' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => fmtMoney(v)}
                    tick={{ fontSize: 10, fill: '#888' }}
                    width={60}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmtMoneyExpanded(v), 'Prix']}
                    labelFormatter={(l) => format(new Date(l), 'dd/MM HH:mm')}
                    contentStyle={{
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#ffffff'   // 👈 AJOUT ICI
                    }}
                  />
                  <Line type="monotone" dataKey="price" stroke={chartColor} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pool info strip */}
          {pool && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Pool coins', value: fmtCoin(pool.coinX) },
                { label: 'Pool liquidité', value: fmtMoney(pool.moneyY) },
                { label: 'Coins minés (total)', value: fmtCoin(pool.totalMined) },
              ].map(({ label, value }) => (
                <Card key={label}>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-semibold tabular-nums">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Trading panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Trading AMM</CardTitle>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Solde: <strong className="text-foreground">{fmtMoney(money)}</strong></span>
                <span>AuraCoin: <strong className="text-yellow-400">{fmtCoin(auraCoin)}</strong></span>
                <span>Frais: <strong className="text-foreground">2%</strong></span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Acheter</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Montant $"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      className="h-8 text-sm"
                      min="1"
                    />
                    <Button
                      size="sm"
                      className="h-8 bg-green-600 hover:bg-green-500"
                      onClick={handleBuy}
                      disabled={tradeLoading || !buyAmount}
                    >
                      Acheter
                    </Button>
                  </div>
                  {buyAmount && parseFloat(buyAmount) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {pool ? fmtCoin(
                        (() => {
                          const net = parseFloat(buyAmount) * 0.98;
                          const k = pool.coinX * pool.moneyY;
                          const newY = pool.moneyY + net;
                          return pool.coinX - k / newY;
                        })()
                      ) : '—'} AuraCoin reçus
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Vendre</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Montant coins"
                      value={sellAmount}
                      onChange={(e) => setSellAmount(e.target.value)}
                      className="h-8 text-sm"
                      min="0"
                      step="any"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8"
                      onClick={handleSell}
                      disabled={tradeLoading || !sellAmount}
                    >
                      Vendre
                    </Button>
                  </div>
                  {sellAmount && parseFloat(sellAmount) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {pool ? fmtMoney(
                        (() => {
                          const coins = parseFloat(sellAmount);
                          const k = pool.coinX * pool.moneyY;
                          const newX = pool.coinX + coins;
                          return (pool.moneyY - k / newX) * 0.98;
                        })()
                      ) : '—'} reçus
                    </p>
                  )}
                </div>
              </div>
              {tradeError && <p className="text-red-400 text-xs">{tradeError}</p>}
            </CardContent>
          </Card>

          {/* Transactions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="mine">
                <TabsList className="h-7 mb-2">
                  <TabsTrigger value="mine" className="text-xs h-6">Mes tx</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs h-6">Toutes</TabsTrigger>
                </TabsList>
                <TabsContent value="mine">
                  <TxList txs={myTxs} />
                </TabsContent>
                <TabsContent value="all">
                  <TxList txs={allTxs} showUser />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Mining + Leaderboards */}
        <div className="space-y-4">
          {/* Mining stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-blue-400" /> Minage GPU
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {miningInfo && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/30 rounded p-2">
                    <p className="text-muted-foreground">Récompense bloc</p>
                    <p className="font-bold text-yellow-400">{fmtCoin(miningInfo.currentReward)} ◈</p>
                  </div>
                  <div className="bg-muted/30 rounded p-2">
                    <p className="text-muted-foreground">Halvings</p>
                    <p className="font-bold">×{miningInfo.halvings}</p>
                  </div>
                  <div className="bg-muted/30 rounded p-2 col-span-2">
                    <p className="text-muted-foreground">Prochain halving dans</p>
                    <p className="font-bold">{halvingCountdown(miningInfo.nextHalvingMs)}</p>
                  </div>
                </div>
              )}

              {serverStats && (
                <div className="text-xs space-y-1 border-t border-border pt-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mineurs actifs</span>
                    <span>{serverStats.activeMiners}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Puissance totale</span>
                    <span>{fmt(serverStats.totalPower, 1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bloc actuel</span>
                    <span>#{serverStats.blockNumber}</span>
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-2 space-y-2">
                <p className="text-xs font-medium">Mes GPUs</p>
                {miner ? (
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GPUs</span>
                      <span className="font-bold">{miner.gpuCount} / {gpuMax}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Puissance</span>
                      <span>{fmt(miner.power, 2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Part réseau</span>
                      <span className="text-blue-400">{fmt(miner.share * 100, 2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total miné</span>
                      <span className="text-yellow-400">{fmtCoin(miner.totalMined)} ◈</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frais/jour</span>
                      <span className="text-orange-400">{fmtMoney(miner.dailyFee)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucun GPU. Achetez-en un pour commencer à miner.</p>
                )}

                {miner && miner.gpuCount < gpuMax && (
                  <div className="bg-muted/20 rounded p-2 text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">GPU #{(miner.gpuCount) + 1}</span>
                      <span className="font-bold">{fmtMoney(miner.nextGpuCost)}</span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={handleBuyGpu}
                      disabled={miningLoading || !miner.canAffordNext}
                    >
                      <Cpu className="h-3 w-3 mr-1" />
                      {miner.canAffordNext ? 'Acheter GPU' : 'Fonds insuffisants'}
                    </Button>
                  </div>
                )}
                {!miner && (
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={handleBuyGpu}
                    disabled={miningLoading}
                  >
                    <Cpu className="h-3 w-3 mr-1" /> Acheter premier GPU
                  </Button>
                )}
                {miningError && <p className="text-red-400 text-xs">{miningError}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Recent blocks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-yellow-400" /> Blocs récents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentBlocks.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun bloc miné.</p>
              ) : (
                <div className="space-y-1">
                  {recentBlocks.map((b) => (
                    <div key={b.blockNumber} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-muted-foreground">#{b.blockNumber}</span>
                      <span className="font-medium truncate max-w-[80px]">{b.minerName ?? '—'}</span>
                      <span className="text-yellow-400">+{fmtCoin(b.reward)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leaderboards */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Award className="h-4 w-4 text-purple-400" /> Classements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="holders">
                <TabsList className="h-7 mb-2">
                  <TabsTrigger value="holders" className="text-xs h-6">Détenteurs</TabsTrigger>
                  <TabsTrigger value="miners" className="text-xs h-6">Mineurs</TabsTrigger>
                </TabsList>
                <TabsContent value="holders">
                  <div className="space-y-1">
                    {coinLeaderboard.slice(0, 10).map((u, i) => (
                      <div key={u.id} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-4">{i + 1}.</span>
                        <UsernameDisplay username={u.username} usernameColor={u.usernameColor} className="flex-1 truncate text-xs" />
                        <span className="text-yellow-400 tabular-nums">{fmtCoin(u.auraCoinBalance)}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="miners">
                  <div className="space-y-1">
                    {minerLeaderboard.slice(0, 10).map((m, i) => (
                      <div key={m.userId} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-4">{i + 1}.</span>
                        <UsernameDisplay username={m.username} usernameColor={m.usernameColor} className="flex-1 truncate text-xs" />
                        <span className="text-blue-400">{m.gpuCount} GPU</span>
                        <span className="text-yellow-400 tabular-nums">{fmtCoin(m.totalMined)}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TxList({ txs, showUser = false }: { txs: AuraCoinTransaction[]; showUser?: boolean }) {
  if (txs.length === 0) return <p className="text-xs text-muted-foreground">Aucune transaction.</p>;
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {txs.map((tx) => {
        const { label, color } = txTypeLabel(tx.type);
        return (
          <div key={tx.id} className="flex items-center gap-2 text-xs py-0.5 border-b border-border/30">
            <span className={cn('font-medium w-14 shrink-0', color)}>{label}</span>
            {showUser && (
              <UsernameDisplay
                username={tx.user.username}
                usernameColor={tx.user.usernameColor}
                className="truncate max-w-[70px] text-xs"
              />
            )}
            {tx.coinAmount > 0 && (
              <span className="text-yellow-400">{fmtCoin(tx.coinAmount)} ◈</span>
            )}
            {tx.moneyAmount !== 0 && (
              <span className={tx.moneyAmount > 0 ? 'text-green-400' : 'text-red-400'}>
                {tx.moneyAmount > 0 ? '+' : ''}{fmtMoney(Math.abs(tx.moneyAmount))}
              </span>
            )}
            <span className="text-muted-foreground ml-auto shrink-0">
              {format(new Date(tx.createdAt), 'dd/MM HH:mm')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
