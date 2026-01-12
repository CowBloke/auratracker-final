import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { leaderboardsApi, economyApi, usersApi } from '../services/api';
import {
  Sparkles,
  Coins,
  Trophy,
  Gamepad2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Gift,
  Send,
  Users,
  Loader2,
  Moon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Transfer {
  id: string;
  senderId: string;
  receiverId: string;
  auraAmount: number;
  moneyAmount: number;
  isGift?: boolean;
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
  
  // Gift aura state
  const [allUsers, setAllUsers] = useState<UserListItem[]>([]);
  const [dailyAllowance, setDailyAllowance] = useState<DailyAllowance | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [giftAmount, setGiftAmount] = useState(10);
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftMessage, setGiftMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDailyAllowance = async () => {
    try {
      const res = await economyApi.getDailyAllowance();
      setDailyAllowance(res.data);
    } catch (error) {
      console.error('Failed to fetch daily allowance:', error);
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
      await economyApi.giftAura({ receiverId: selectedUserId, amount: giftAmount });
      
      const selectedUser = allUsers.find(u => u.id === selectedUserId);
      setGiftMessage({ 
        type: 'success', 
        text: `${giftAmount} aura envoyé à ${selectedUser?.username}!` 
      });
      
      // Refresh data
      await Promise.all([
        fetchDailyAllowance(),
        economyApi.getTransfers({ limit: 5 }).then(res => setRecentTransfers(res.data.transfers)),
        refreshUser(),
      ]);
      
      setSelectedUserId('');
      setGiftAmount(10);
      
      // Clear success message after 3 seconds
      setTimeout(() => setGiftMessage(null), 3000);
    } catch (error: any) {
      setGiftMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Échec de l\'envoi d\'aura' 
      });
    } finally {
      setGiftLoading(false);
    }
  };

  const getTimeUntilReset = () => {
    if (!dailyAllowance) return '';
    const nextReset = new Date(dailyAllowance.nextReset);
    const now = new Date();
    const diff = nextReset.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">
            Welcome back, <span className="text-gradient-aura">{user?.username}</span>!
          </CardTitle>
          <CardDescription>
            Ready to earn some Aura? Check out the games or see how you rank against others.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Aura Card */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
              Prestige
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {user?.aura.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total Aura</p>
          </CardContent>
        </Card>

        {/* Money Card */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Coins className="h-8 w-8 text-primary" />
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
              Currency
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              ${user?.money.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total Money</p>
          </CardContent>
        </Card>

        {/* Rank Card */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Trophy className="h-8 w-8 text-primary" />
            <Badge variant="outline" className="bg-primary/20 text-primary-foreground">
              Ranking
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary-foreground">
              #{userRank || '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Aura Leaderboard</p>
          </CardContent>
        </Card>

        {/* Online Card */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Gamepad2 className="h-8 w-8 text-primary" />
            <Badge variant="outline" className="bg-primary/20 text-primary">
              Live
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {onlineUsers.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Players Online</p>
          </CardContent>
        </Card>
      </div>

      {/* Gift Aura Section */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Envoyer de l'Aura
            </CardTitle>
            {dailyAllowance && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Prochain reset: <span className="text-primary">{getTimeUntilReset()}</span>
                </span>
                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                  {dailyAllowance.remaining}/{dailyAllowance.dailyLimit} disponible
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress bar */}
          {dailyAllowance && (
            <div className="mb-4">
              <Progress 
                value={(dailyAllowance.remaining / dailyAllowance.dailyLimit) * 100} 
                className="h-2"
              />
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* User selector */}
            <div className="flex-1">
              <Label htmlFor="user-select" className="flex items-center gap-1 mb-2">
                <Users className="h-4 w-4" />
                Destinataire
              </Label>
              <Select
                value={selectedUserId}
                onValueChange={setSelectedUserId}
                disabled={!dailyAllowance || dailyAllowance.remaining === 0}
              >
                <SelectTrigger id="user-select">
                  <SelectValue placeholder="Sélectionner un utilisateur..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter(u => u.id !== user?.id)
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.username} ({u.aura.toLocaleString()} aura)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Amount input */}
            <div className="w-full sm:w-40">
              <Label htmlFor="gift-amount" className="flex items-center gap-1 mb-2">
                <Sparkles className="h-4 w-4" />
                Quantité
              </Label>
              <Input
                id="gift-amount"
                type="number"
                value={giftAmount}
                onChange={(e) => setGiftAmount(Math.min(Math.max(1, parseInt(e.target.value) || 0), dailyAllowance?.remaining || 50))}
                min={1}
                max={dailyAllowance?.remaining || 50}
                disabled={!dailyAllowance || dailyAllowance.remaining === 0}
              />
            </div>
            
            {/* Send button */}
            <div className="flex items-end">
              <Button
                onClick={handleGiftAura}
                disabled={!selectedUserId || giftAmount <= 0 || giftLoading || !dailyAllowance || dailyAllowance.remaining === 0}
                className="h-10"
              >
                {giftLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Envoyer
              </Button>
            </div>
          </div>
          
          {/* Message */}
          {giftMessage && (
            <Alert 
              variant={giftMessage.type === 'success' ? 'default' : 'destructive'}
              className={cn(
                "mt-4",
                giftMessage.type === 'success' && "bg-primary/20 text-primary border-primary/30"
              )}
            >
              <AlertDescription>{giftMessage.text}</AlertDescription>
            </Alert>
          )}
          
          {dailyAllowance && dailyAllowance.remaining === 0 && (
            <Alert className="mt-4">
              <AlertDescription className="text-center flex items-center justify-center gap-2">
                Tu as utilisé tout ton quota d'aura pour aujourd'hui. Reviens demain ! <Moon className="w-4 h-4" />
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Aura Leaderboard */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Top Aura Players
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/leaderboards" className="flex items-center gap-1">
                  View all
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {auraRankings.map((ranking, index) => (
                <div
                  key={ranking.userId}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg",
                    ranking.userId === user?.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={index === 0 ? 'default' : index === 2 ? 'secondary' : 'outline'}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                        index === 0 && 'bg-primary/20 text-primary',
                        index === 2 && 'bg-secondary/20 text-secondary-foreground'
                      )}
                    >
                      {ranking.rank}
                    </Badge>
                    <span className="font-medium">{ranking.username}</span>
                  </div>
                  <span className="font-semibold">
                    {ranking.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Transfers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransfers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No recent transfers</p>
              ) : (
                recentTransfers.map((transfer) => {
                  const isSender = transfer.senderId === user?.id;
                  const otherUser = isSender ? transfer.receiver : transfer.sender;
                  const isGift = transfer.isGift;
                  
                  return (
                    <div
                      key={transfer.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg",
                        isGift 
                          ? 'bg-primary/10 border border-primary/20' 
                          : 'bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {isGift ? (
                          <Gift className={cn("h-5 w-5", isSender ? 'text-primary' : 'text-primary')} />
                        ) : isSender ? (
                          <ArrowUpRight className="h-5 w-5 text-destructive" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5 text-primary" />
                        )}
                        <div>
                          <p className="font-medium">
                            {isGift 
                              ? (isSender ? 'Don envoyé à' : 'Don reçu de')
                              : (isSender ? 'Envoyé à' : 'Reçu de')
                            }{' '}
                            <span className="text-primary">{otherUser.username}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(transfer.createdAt)}
                            {isGift && <span className="ml-1 text-primary">• cadeau</span>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {transfer.auraAmount > 0 && (
                        <p className={cn(
                          isGift 
                            ? (isSender ? 'text-primary' : 'text-primary')
                            : (isSender ? 'text-destructive' : 'text-primary')
                        )}>
                          {isSender && !isGift ? '-' : '+'}{transfer.auraAmount} Aura
                        </p>
                        )}
                        {transfer.moneyAmount > 0 && (
                        <p className={cn(isSender ? 'text-destructive' : 'text-primary')}>
                          {isSender ? '-' : '+'}${transfer.moneyAmount}
                        </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto flex-col p-4" asChild>
              <Link to="/games/doodle-jump">
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Gamepad2 className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">Doodle Jump</p>
                <p className="text-xs text-muted-foreground">Play now</p>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4" asChild>
              <Link to="/games/solitaire">
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-secondary/20 flex items-center justify-center">
                  <Gamepad2 className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">Solitaire</p>
                <p className="text-xs text-muted-foreground">Play now</p>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4" asChild>
              <Link to="/marketplace">
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Coins className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">Marketplace</p>
                <p className="text-xs text-muted-foreground">Shop items</p>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4" asChild>
              <Link to="/leaderboards">
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">Leaderboards</p>
                <p className="text-xs text-muted-foreground">View rankings</p>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
