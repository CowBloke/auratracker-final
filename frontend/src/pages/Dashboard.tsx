import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { leaderboardsApi, economyApi, usersApi } from '../services/api';
import { ArrowRight, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Transfer {
  id: string;
  senderId: string;
  receiverId: string;
  auraAmount: number;
  moneyAmount: number;
  isGift?: boolean;
  message?: string | null;
  createdAt: string;
  sender: { id: string; username: string };
  receiver: { id: string; username: string };
}

interface DailyAllowance {
  dailyLimit: number;
  used: number;
  remaining: number;
  lastReset: string;
  nextReset: string;
}

interface UserListItem {
  id: string;
  username: string;
  aura: number;
}

interface Ranking {
  rank: number;
  userId: string;
  username: string;
  value: number;
}

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const { onlineUsers } = useSocket();
  const [auraRankings, setAuraRankings] = useState<Ranking[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [allUsers, setAllUsers] = useState<UserListItem[]>([]);
  const [dailyAllowance, setDailyAllowance] = useState<DailyAllowance | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [giftAmount, setGiftAmount] = useState(10);
  const [giftText, setGiftText] = useState('');
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftMessage, setGiftMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [allTransfers, setAllTransfers] = useState<Transfer[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  const fetchDailyAllowance = async () => {
    try {
      const res = await economyApi.getDailyAllowance();
      setDailyAllowance(res.data);
    } catch (error) {
      console.error('Failed to fetch daily allowance:', error);
    }
  };

  const fetchAllHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await economyApi.getTransfers({ limit: 50 });
      setAllTransfers(res.data.transfers);
      setHasMoreHistory(res.data.transfers.length >= 50);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadMoreHistory = async () => {
    if (historyLoading || !hasMoreHistory) return;
    setHistoryLoading(true);
    try {
      const res = await economyApi.getTransfers({ limit: 50, offset: allTransfers.length });
      const newTransfers = res.data.transfers;
      setAllTransfers(prev => [...prev, ...newTransfers]);
      setHasMoreHistory(newTransfers.length >= 50);
    } catch (error) {
      console.error('Failed to load more history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rankingsRes, transfersRes, usersRes, allowanceRes] = await Promise.all([
          leaderboardsApi.get('aura', { limit: 5 }),
          economyApi.getTransfers({ limit: 5 }),
          usersApi.getAll(),
          economyApi.getDailyAllowance(),
        ]);
        
        setAuraRankings(rankingsRes.data.rankings);
        setUserRank(rankingsRes.data.userRank);
        setRecentTransfers(transfersRes.data.transfers);
        setAllUsers(usersRes.data.users);
        setDailyAllowance(allowanceRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleGiftAura = async () => {
    if (!selectedUserId || giftAmount <= 0) return;
    
    setGiftLoading(true);
    setGiftMessage(null);
    
    try {
      await economyApi.giftAura({ 
        receiverId: selectedUserId, 
        amount: giftAmount,
        message: giftText.trim() || undefined,
      });
      
      const selectedUser = allUsers.find(u => u.id === selectedUserId);
      setGiftMessage({ 
        type: 'success', 
        text: `${giftAmount} aura → ${selectedUser?.username}` 
      });
      
      await Promise.all([
        fetchDailyAllowance(),
        economyApi.getTransfers({ limit: 5 }).then(res => setRecentTransfers(res.data.transfers)),
        refreshUser(),
      ]);
      
      setSelectedUserId('');
      setGiftAmount(10);
      setGiftText('');
      
      setTimeout(() => setGiftMessage(null), 3000);
    } catch (error: any) {
      setGiftMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Échec' 
      });
    } finally {
      setGiftLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}j`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Hero Stats */}
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">
          {onlineUsers.length} en ligne
        </p>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight">
          {user?.username}
        </h1>
      </header>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
        <div className="space-y-1">
          <p className="text-4xl md:text-5xl font-light tabular-nums">
            {user?.aura.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">aura</p>
        </div>
        <div className="space-y-1">
          <p className="text-4xl md:text-5xl font-light tabular-nums">
            ${user?.money.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">money</p>
        </div>
        <div className="space-y-1">
          <p className="text-4xl md:text-5xl font-light tabular-nums">
            #{userRank || '—'}
          </p>
          <p className="text-sm text-muted-foreground">rang</p>
        </div>
        <div className="space-y-1">
          <p className="text-4xl md:text-5xl font-light tabular-nums">
            {dailyAllowance?.remaining || 0}
          </p>
          <p className="text-sm text-muted-foreground">dons restants</p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Gift Section */}
      <section className="space-y-6">
        <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
          Envoyer de l'aura
        </h2>
        
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={!dailyAllowance || dailyAllowance.remaining === 0}
            >
              <SelectTrigger className="flex-1 h-12 bg-transparent border-border/50 text-base">
                <SelectValue placeholder="Destinataire" />
              </SelectTrigger>
              <SelectContent>
                {allUsers
                  .filter(u => u.id !== user?.id)
                  .map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.username}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            
            <Input
              type="number"
              value={giftAmount}
              onChange={(e) => setGiftAmount(Math.min(Math.max(1, parseInt(e.target.value) || 0), dailyAllowance?.remaining || 50))}
              min={1}
              max={dailyAllowance?.remaining || 50}
              disabled={!dailyAllowance || dailyAllowance.remaining === 0}
              className="w-full sm:w-24 h-12 bg-transparent border-border/50 text-base text-center"
              placeholder="10"
            />
            
            <Button
              onClick={handleGiftAura}
              disabled={!selectedUserId || giftAmount <= 0 || giftLoading || !dailyAllowance || dailyAllowance.remaining === 0}
              variant="outline"
              className="h-12 w-12 shrink-0 border-border/50"
            >
              {giftLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="relative">
            <Input
              type="text"
              value={giftText}
              onChange={(e) => setGiftText(e.target.value)}
              disabled={!dailyAllowance || dailyAllowance.remaining === 0}
              className="h-12 bg-transparent border-border/50 text-base pr-16"
              placeholder="Message"
              maxLength={50}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 tabular-nums">
              {giftText.length}/50
            </span>
          </div>
        </div>
        
        {giftMessage && (
          <p className={cn(
            "text-sm",
            giftMessage.type === 'success' ? 'text-foreground' : 'text-destructive'
          )}>
            {giftMessage.text}
          </p>
        )}
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Leaderboard */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Classement
          </h2>
          <Link 
            to="/leaderboards" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Voir tout <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        
        <div className="space-y-0">
          {auraRankings.map((ranking) => (
            <div
              key={ranking.userId}
              className={cn(
                "flex items-center justify-between py-4 border-b border-border/30 last:border-0",
                ranking.userId === user?.id && "bg-muted/30 -mx-4 px-4"
              )}
            >
              <div className="flex items-center gap-6">
                <span className="text-muted-foreground text-sm w-6 tabular-nums">
                  {ranking.rank}
                </span>
                <span className="font-medium">{ranking.username}</span>
              </div>
              <span className="tabular-nums text-muted-foreground">
                {ranking.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Recent Activity */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Activité récente
          </h2>
          <Sheet open={historyOpen} onOpenChange={(open) => {
            setHistoryOpen(open);
            if (open && allTransfers.length === 0) {
              fetchAllHistory();
            }
          }}>
            <SheetTrigger asChild>
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                Voir tout <ArrowRight className="h-3 w-3" />
              </button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-sm text-muted-foreground tracking-wide uppercase font-normal">
                  Historique d'activité
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-0">
                {historyLoading && allTransfers.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : allTransfers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12">Aucun transfert</p>
                ) : (
                  <>
                    {allTransfers.map((transfer) => (
                      <div
                        key={transfer.id}
                        className="py-3 border-b border-border/30 last:border-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs text-muted-foreground shrink-0 w-10">
                              {formatTimeAgo(transfer.createdAt)}
                            </span>
                            <span className="truncate">
                              {transfer.sender.username} → {transfer.receiver.username}
                            </span>
                          </div>
                          <span className="tabular-nums shrink-0">
                            {transfer.auraAmount}
                          </span>
                        </div>
                        {transfer.message && (
                          <p className="text-sm text-muted-foreground mt-1 ml-[3.25rem] italic truncate">
                            "{transfer.message}"
                          </p>
                        )}
                      </div>
                    ))}
                    {hasMoreHistory && (
                      <Button
                        variant="ghost"
                        className="w-full mt-4"
                        onClick={loadMoreHistory}
                        disabled={historyLoading}
                      >
                        {historyLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Charger plus'
                        )}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
        
        {recentTransfers.length === 0 ? (
          <p className="text-muted-foreground">Aucun transfert</p>
        ) : (
          <div className="space-y-0">
            {recentTransfers.map((transfer) => (
              <div
                key={transfer.id}
                className="py-3 border-b border-border/30 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-8">
                      {formatTimeAgo(transfer.createdAt)}
                    </span>
                    <span>
                      {transfer.sender.username} → {transfer.receiver.username}
                    </span>
                  </div>
                  <span className="tabular-nums">
                    {transfer.auraAmount}
                  </span>
                </div>
                {transfer.message && (
                  <p className="text-sm text-muted-foreground mt-1 ml-12 italic">
                    "{transfer.message}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
