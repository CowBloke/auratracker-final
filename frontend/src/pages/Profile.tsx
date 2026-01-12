import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersApi, leaderboardsApi, economyApi } from '../services/api';
import {
  User,
  Sparkles,
  Coins,
  Trophy,
  Calendar,
  Send,
} from 'lucide-react';

interface ProfileUser {
  id: string;
  username: string;
  aura: number;
  money: number;
  createdAt: string;
  gameStats: Array<{
    gameType: string;
    wins: number;
    losses: number;
    highScore: number;
    totalPlayed: number;
  }>;
}

interface Rankings {
  aura: { value: number; rank: number };
  money: { value: number; rank: number };
  [key: string]: any;
}

export default function Profile() {
  const { userId } = useParams();
  const { user: currentUser, refreshUser } = useAuth();
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferType, setTransferType] = useState<'aura' | 'money'>('money');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');

  const targetUserId = userId || currentUser?.id;
  const isOwnProfile = targetUserId === currentUser?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
    }
  }, [targetUserId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const [userRes, rankingsRes] = await Promise.all([
        usersApi.getById(targetUserId!),
        leaderboardsApi.getUserRankings(targetUserId!),
      ]);
      setProfileUser(userRes.data.user);
      setRankings(rankingsRes.data.rankings);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferAmount || !profileUser) return;
    
    try {
      setTransferLoading(true);
      setTransferError('');
      
      const amount = parseInt(transferAmount);
      if (isNaN(amount) || amount <= 0) {
        setTransferError('Invalid amount');
        return;
      }

      await economyApi.transfer({
        receiverId: profileUser.id,
        [transferType === 'aura' ? 'auraAmount' : 'moneyAmount']: amount,
      });

      await refreshUser();
      await fetchProfile();
      setShowTransferModal(false);
      setTransferAmount('');
    } catch (error: any) {
      setTransferError(error.response?.data?.error || 'Transfer failed');
    } finally {
      setTransferLoading(false);
    }
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

  if (!profileUser) {
    return (
      <div className="card p-12 text-center">
        <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-400 mb-2">User Not Found</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-aura flex items-center justify-center">
              <span className="text-3xl font-bold text-white">
                {profileUser.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold font-display">
                {profileUser.username}
                {isOwnProfile && (
                  <span className="ml-2 text-sm text-primary">(You)</span>
                )}
              </h1>
              <div className="flex items-center gap-2 mt-2 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>Joined {new Date(profileUser.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {!isOwnProfile && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              Send Currency
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6 border-l-4 border-aura">
          <div className="flex items-center justify-between mb-2">
            <Sparkles className="w-6 h-6 text-aura" />
            <span className="text-sm text-gray-400">Rank #{rankings?.aura?.rank || '—'}</span>
          </div>
          <p className="text-2xl font-bold font-mono text-aura-light">
            {profileUser.aura.toLocaleString()}
          </p>
          <p className="text-sm text-gray-400">Aura</p>
        </div>

        <div className="card p-6 border-l-4 border-money">
          <div className="flex items-center justify-between mb-2">
            <Coins className="w-6 h-6 text-money" />
            <span className="text-sm text-gray-400">Rank #{rankings?.money?.rank || '—'}</span>
          </div>
          <p className="text-2xl font-bold font-mono text-money-light">
            ${profileUser.money.toLocaleString()}
          </p>
          <p className="text-sm text-gray-400">Money</p>
        </div>

        <div className="card p-6 border-l-4 border-accent-green">
          <Trophy className="w-6 h-6 text-accent-green mb-2" />
          <p className="text-2xl font-bold font-mono text-accent-green">
            {profileUser.gameStats.reduce((acc, s) => acc + s.wins, 0)}
          </p>
          <p className="text-sm text-gray-400">Total Wins</p>
        </div>

        <div className="card p-6 border-l-4 border-primary">
          <Trophy className="w-6 h-6 text-primary mb-2" />
          <p className="text-2xl font-bold font-mono text-primary-light">
            {profileUser.gameStats.reduce((acc, s) => acc + s.totalPlayed, 0)}
          </p>
          <p className="text-sm text-gray-400">Games Played</p>
        </div>
      </div>

      {/* Game Stats */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Game Statistics</h2>
        {profileUser.gameStats.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No games played yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profileUser.gameStats.map((stat) => (
              <div
                key={stat.gameType}
                className="p-4 rounded-lg bg-background/50"
              >
                <h3 className="font-medium capitalize mb-3">
                  {stat.gameType.replace('_', ' ')}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">High Score</p>
                    <p className="font-mono text-lg text-primary-light">
                      {stat.highScore.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Win Rate</p>
                    <p className="font-mono text-lg text-accent-green">
                      {stat.totalPlayed > 0
                        ? Math.round((stat.wins / stat.totalPlayed) * 100)
                        : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Wins</p>
                    <p className="font-mono text-lg">{stat.wins}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Total Played</p>
                    <p className="font-mono text-lg">{stat.totalPlayed}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md animate-slide-up">
            <h2 className="text-xl font-bold mb-4">
              Send to {profileUser.username}
            </h2>
            
            {transferError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {transferError}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setTransferType('money')}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    transferType === 'money'
                      ? 'bg-money/20 border border-money text-money-light'
                      : 'bg-surface text-gray-400'
                  }`}
                >
                  <Coins className="w-5 h-5 inline mr-2" />
                  Money
                </button>
                <button
                  onClick={() => setTransferType('aura')}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    transferType === 'aura'
                      ? 'bg-aura/20 border border-aura text-aura-light'
                      : 'bg-surface text-gray-400'
                  }`}
                >
                  <Sparkles className="w-5 h-5 inline mr-2" />
                  Aura
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="input"
                  placeholder="0"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your balance: {transferType === 'money'
                    ? `$${currentUser?.money.toLocaleString()}`
                    : currentUser?.aura.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferError('');
                  setTransferAmount('');
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferLoading || !transferAmount}
                className="btn-primary flex-1"
              >
                {transferLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
