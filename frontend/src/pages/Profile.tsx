import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersApi, leaderboardsApi, economyApi } from '../services/api';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
        setTransferError('Montant invalide');
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
      setTransferError(error.response?.data?.error || 'Échec du transfert');
    } finally {
      setTransferLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <p className="text-center text-muted-foreground py-12">
          Utilisateur introuvable
        </p>
      </div>
    );
  }

  const totalWins = profileUser.gameStats.reduce((acc, s) => acc + s.wins, 0);
  const totalGames = profileUser.gameStats.reduce((acc, s) => acc + s.totalPlayed, 0);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Profil {isOwnProfile && '(toi)'}
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              {profileUser.username}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Membre depuis {new Date(profileUser.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          {!isOwnProfile && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Send className="h-4 w-4" />
              Envoyer
            </button>
          )}
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
        <div className="space-y-1">
          <p className="text-4xl md:text-5xl font-light tabular-nums">
            {profileUser.aura.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            aura <span className="text-muted-foreground/60">#{rankings?.aura?.rank || '—'}</span>
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-4xl md:text-5xl font-light tabular-nums">
            ${profileUser.money.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            money <span className="text-muted-foreground/60">#{rankings?.money?.rank || '—'}</span>
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-4xl md:text-5xl font-light tabular-nums">
            {totalWins}
          </p>
          <p className="text-sm text-muted-foreground">victoires</p>
        </div>
        <div className="space-y-1">
          <p className="text-4xl md:text-5xl font-light tabular-nums">
            {totalGames}
          </p>
          <p className="text-sm text-muted-foreground">parties</p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Game Stats */}
      <section className="space-y-6">
        <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
          Statistiques par jeu
        </h2>
        
        {profileUser.gameStats.length === 0 ? (
          <p className="text-muted-foreground">Aucune partie jouée</p>
        ) : (
          <div className="space-y-0">
            {profileUser.gameStats.map((stat) => (
              <div
                key={stat.gameType}
                className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
              >
                <span className="font-medium capitalize">
                  {stat.gameType.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-8 text-sm text-muted-foreground tabular-nums">
                  <span>{stat.highScore.toLocaleString()} best</span>
                  <span>{stat.wins} W</span>
                  <span>{stat.totalPlayed} played</span>
                  <span>
                    {stat.totalPlayed > 0
                      ? Math.round((stat.wins / stat.totalPlayed) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">
              Envoyer à {profileUser.username}
            </DialogTitle>
          </DialogHeader>
          
          {transferError && (
            <p className="text-sm text-destructive">{transferError}</p>
          )}

          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTransferType('money')}
                className={cn(
                  "flex-1 px-4 py-2 text-sm border transition-colors",
                  transferType === 'money'
                    ? "border-foreground text-foreground"
                    : "border-border/30 text-muted-foreground"
                )}
              >
                Money
              </button>
              <button
                onClick={() => setTransferType('aura')}
                className={cn(
                  "flex-1 px-4 py-2 text-sm border transition-colors",
                  transferType === 'aura'
                    ? "border-foreground text-foreground"
                    : "border-border/30 text-muted-foreground"
                )}
              >
                Aura
              </button>
            </div>

            <div className="space-y-2">
              <Input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="Montant"
                min="1"
                className="h-12 bg-transparent border-border/50 text-center"
              />
              <p className="text-xs text-muted-foreground text-center">
                Solde: {transferType === 'money'
                  ? `$${currentUser?.money.toLocaleString()}`
                  : currentUser?.aura.toLocaleString()}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowTransferModal(false);
                setTransferError('');
                setTransferAmount('');
              }}
              className="border-border/30"
            >
              Annuler
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferLoading || !transferAmount}
              variant="outline"
              className="border-foreground"
            >
              {transferLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Envoyer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
