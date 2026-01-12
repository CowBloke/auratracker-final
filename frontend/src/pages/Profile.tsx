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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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
        <div className="animate-pulse text-primary text-xl">
          Loading...
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <CardTitle className="text-xl mb-2">User Not Found</CardTitle>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarFallback className="text-3xl">
                  {profileUser.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-3xl">
                  {profileUser.username}
                  {isOwnProfile && (
                    <Badge variant="secondary" className="ml-2">You</Badge>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {new Date(profileUser.createdAt).toLocaleDateString()}</span>
                </CardDescription>
              </div>
            </div>

            {!isOwnProfile && (
              <Button onClick={() => setShowTransferModal(true)}>
                <Send className="w-4 h-4" />
                Send Currency
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <span className="text-sm text-muted-foreground">Rank #{rankings?.aura?.rank || '—'}</span>
            </div>
            <p className="text-2xl font-bold">
              {profileUser.aura.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Aura</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Coins className="w-6 h-6 text-primary" />
              <span className="text-sm text-muted-foreground">Rank #{rankings?.money?.rank || '—'}</span>
            </div>
            <p className="text-2xl font-bold">
              ${profileUser.money.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Money</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-6">
            <Trophy className="w-6 h-6 text-primary mb-2" />
            <p className="text-2xl font-bold">
              {profileUser.gameStats.reduce((acc, s) => acc + s.wins, 0)}
            </p>
            <p className="text-sm text-muted-foreground">Total Wins</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-6">
            <Trophy className="w-6 h-6 text-primary mb-2" />
            <p className="text-2xl font-bold">
              {profileUser.gameStats.reduce((acc, s) => acc + s.totalPlayed, 0)}
            </p>
            <p className="text-sm text-muted-foreground">Games Played</p>
          </CardContent>
        </Card>
      </div>

      {/* Game Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Game Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {profileUser.gameStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No games played yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profileUser.gameStats.map((stat) => (
                <Card key={stat.gameType}>
                  <CardContent className="p-4">
                    <h3 className="font-medium capitalize mb-3">
                      {stat.gameType.replace('_', ' ')}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">High Score</p>
                        <p className="text-lg font-semibold">
                          {stat.highScore.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Win Rate</p>
                        <p className="text-lg font-semibold">
                          {stat.totalPlayed > 0
                            ? Math.round((stat.wins / stat.totalPlayed) * 100)
                            : 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Wins</p>
                        <p className="text-lg font-semibold">{stat.wins}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Played</p>
                        <p className="text-lg font-semibold">{stat.totalPlayed}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to {profileUser.username}</DialogTitle>
            <DialogDescription>
              Transfer currency to this user
            </DialogDescription>
          </DialogHeader>
          
          {transferError && (
            <Alert variant="destructive">
              <AlertDescription>{transferError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={() => setTransferType('money')}
                variant={transferType === 'money' ? 'default' : 'outline'}
                className="flex-1"
              >
                <Coins className="w-4 h-4 mr-2" />
                Money
              </Button>
              <Button
                onClick={() => setTransferType('aura')}
                variant={transferType === 'aura' ? 'default' : 'outline'}
                className="flex-1"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Aura
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Your balance: {transferType === 'money'
                  ? `$${currentUser?.money.toLocaleString()}`
                  : currentUser?.aura.toLocaleString()}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowTransferModal(false);
                setTransferError('');
                setTransferAmount('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferLoading || !transferAmount}
            >
              {transferLoading ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
