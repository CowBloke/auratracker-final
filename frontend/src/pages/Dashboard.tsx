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
} from 'lucide-react';

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
        text: `🎁 ${giftAmount} aura envoyé à ${selectedUser?.username}!` 
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-primary text-xl font-display">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="card p-6">
        <h1 className="text-3xl font-bold font-display mb-2">
          Welcome back, <span className="text-gradient-aura">{user?.username}</span>!
        </h1>
        <p className="text-gray-400">
          Ready to earn some Aura? Check out the games or see how you rank against others.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Aura Card */}
        <div className="card p-6 border-l-4 border-aura">
          <div className="flex items-center justify-between mb-4">
            <Sparkles className="w-8 h-8 text-aura" />
            <span className="badge-aura">Prestige</span>
          </div>
          <p className="text-3xl font-bold font-mono text-aura-light">
            {user?.aura.toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 mt-1">Total Aura</p>
        </div>

        {/* Money Card */}
        <div className="card p-6 border-l-4 border-money">
          <div className="flex items-center justify-between mb-4">
            <Coins className="w-8 h-8 text-money" />
            <span className="badge-money">Currency</span>
          </div>
          <p className="text-3xl font-bold font-mono text-money-light">
            ${user?.money.toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 mt-1">Total Money</p>
        </div>

        {/* Rank Card */}
        <div className="card p-6 border-l-4 border-primary">
          <div className="flex items-center justify-between mb-4">
            <Trophy className="w-8 h-8 text-primary" />
            <span className="badge bg-primary/20 text-primary-light">Ranking</span>
          </div>
          <p className="text-3xl font-bold font-mono text-primary-light">
            #{userRank || '—'}
          </p>
          <p className="text-sm text-gray-400 mt-1">Aura Leaderboard</p>
        </div>

        {/* Online Card */}
        <div className="card p-6 border-l-4 border-accent-green">
          <div className="flex items-center justify-between mb-4">
            <Gamepad2 className="w-8 h-8 text-accent-green" />
            <span className="badge bg-accent-green/20 text-accent-green">Live</span>
          </div>
          <p className="text-3xl font-bold font-mono text-accent-green">
            {onlineUsers.length}
          </p>
          <p className="text-sm text-gray-400 mt-1">Players Online</p>
        </div>
      </div>

      {/* Gift Aura Section */}
      <div className="card p-6 border border-aura/30 bg-gradient-to-br from-aura/5 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Gift className="w-5 h-5 text-aura" />
            Envoyer de l'Aura
          </h2>
          {dailyAllowance && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-400">
                Prochain reset: <span className="text-aura-light font-mono">{getTimeUntilReset()}</span>
              </span>
              <span className="badge-aura">
                {dailyAllowance.remaining}/{dailyAllowance.dailyLimit} disponible
              </span>
            </div>
          )}
        </div>
        
        {/* Progress bar */}
        {dailyAllowance && (
          <div className="mb-4">
            <div className="h-2 bg-background rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-aura to-aura-light transition-all duration-300"
                style={{ width: `${(dailyAllowance.remaining / dailyAllowance.dailyLimit) * 100}%` }}
              />
            </div>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-4">
          {/* User selector */}
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Destinataire
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="input w-full"
              disabled={!dailyAllowance || dailyAllowance.remaining === 0}
            >
              <option value="">Sélectionner un utilisateur...</option>
              {allUsers
                .filter(u => u.id !== user?.id)
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.aura.toLocaleString()} aura)
                  </option>
                ))}
            </select>
          </div>
          
          {/* Amount input */}
          <div className="w-full sm:w-40">
            <label className="block text-sm text-gray-400 mb-2">
              <Sparkles className="w-4 h-4 inline mr-1" />
              Quantité
            </label>
            <input
              type="number"
              value={giftAmount}
              onChange={(e) => setGiftAmount(Math.min(Math.max(1, parseInt(e.target.value) || 0), dailyAllowance?.remaining || 50))}
              min={1}
              max={dailyAllowance?.remaining || 50}
              className="input w-full"
              disabled={!dailyAllowance || dailyAllowance.remaining === 0}
            />
          </div>
          
          {/* Send button */}
          <div className="flex items-end">
            <button
              onClick={handleGiftAura}
              disabled={!selectedUserId || giftAmount <= 0 || giftLoading || !dailyAllowance || dailyAllowance.remaining === 0}
              className="btn-primary h-[42px] px-6 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {giftLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Envoyer
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Message */}
        {giftMessage && (
          <div className={`mt-4 p-3 rounded-lg ${
            giftMessage.type === 'success' 
              ? 'bg-accent-green/20 text-accent-green border border-accent-green/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {giftMessage.text}
          </div>
        )}
        
        {dailyAllowance && dailyAllowance.remaining === 0 && (
          <div className="mt-4 p-3 rounded-lg bg-gray-700/30 text-gray-400 text-center">
            Tu as utilisé tout ton quota d'aura pour aujourd'hui. Reviens demain ! 🌙
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Aura Leaderboard */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-aura" />
              Top Aura Players
            </h2>
            <Link
              to="/leaderboards"
              className="text-sm text-primary hover:text-primary-hover flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {auraRankings.map((ranking, index) => (
              <div
                key={ranking.userId}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  ranking.userId === user?.id
                    ? 'bg-aura/10 border border-aura/30'
                    : 'bg-background/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : index === 1
                        ? 'bg-gray-400/20 text-gray-400'
                        : index === 2
                        ? 'bg-orange-500/20 text-orange-500'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {ranking.rank}
                  </span>
                  <span className="font-medium">{ranking.username}</span>
                </div>
                <span className="font-mono text-aura-light">
                  {ranking.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent-cyan" />
              Recent Transfers
            </h2>
          </div>
          <div className="space-y-3">
            {recentTransfers.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No recent transfers</p>
            ) : (
              recentTransfers.map((transfer) => {
                const isSender = transfer.senderId === user?.id;
                const otherUser = isSender ? transfer.receiver : transfer.sender;
                const isGift = transfer.isGift;
                
                return (
                  <div
                    key={transfer.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isGift 
                        ? 'bg-aura/10 border border-aura/20' 
                        : 'bg-background/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isGift ? (
                        <Gift className={`w-5 h-5 ${isSender ? 'text-aura' : 'text-aura-light'}`} />
                      ) : isSender ? (
                        <ArrowUpRight className="w-5 h-5 text-red-400" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-accent-green" />
                      )}
                      <div>
                        <p className="font-medium">
                          {isGift 
                            ? (isSender ? 'Don envoyé à' : 'Don reçu de')
                            : (isSender ? 'Envoyé à' : 'Reçu de')
                          }{' '}
                          <span className="text-primary">{otherUser.username}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTimeAgo(transfer.createdAt)}
                          {isGift && <span className="ml-1 text-aura">• cadeau</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {transfer.auraAmount > 0 && (
                        <p className={`font-mono ${
                          isGift 
                            ? (isSender ? 'text-aura' : 'text-aura-light')
                            : (isSender ? 'text-red-400' : 'text-aura-light')
                        }`}>
                          {isSender && !isGift ? '-' : '+'}{transfer.auraAmount} Aura
                        </p>
                      )}
                      {transfer.moneyAmount > 0 && (
                        <p className={`font-mono ${isSender ? 'text-red-400' : 'text-money-light'}`}>
                          {isSender ? '-' : '+'}${transfer.moneyAmount}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/games/doodle-jump"
            className="card-hover p-4 text-center"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <Gamepad2 className="w-6 h-6 text-accent-green" />
            </div>
            <p className="font-medium">Doodle Jump</p>
            <p className="text-xs text-gray-400">Play now</p>
          </Link>
          <Link
            to="/games/solitaire"
            className="card-hover p-4 text-center"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-accent-pink/20 flex items-center justify-center">
              <Gamepad2 className="w-6 h-6 text-accent-pink" />
            </div>
            <p className="font-medium">Solitaire</p>
            <p className="text-xs text-gray-400">Play now</p>
          </Link>
          <Link
            to="/marketplace"
            className="card-hover p-4 text-center"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-money/20 flex items-center justify-center">
              <Coins className="w-6 h-6 text-money" />
            </div>
            <p className="font-medium">Marketplace</p>
            <p className="text-xs text-gray-400">Shop items</p>
          </Link>
          <Link
            to="/leaderboards"
            className="card-hover p-4 text-center"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-primary/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium">Leaderboards</p>
            <p className="text-xs text-gray-400">View rankings</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
