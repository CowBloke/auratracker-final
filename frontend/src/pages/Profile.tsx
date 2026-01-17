import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersApi, leaderboardsApi, auraCoinApi, bombPartyApi, BombPartyStats } from '../services/api';
import { Edit2, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { resolveImageUrl } from '@/lib/images';

const nftRarityLabels: Record<string, string> = {
  COMMON: 'Commun',
  UNCOMMON: 'Inhabituel',
  RARE: 'Rare',
  EPIC: 'Épique',
  LEGENDARY: 'Légendaire',
};

interface ProfileUser {
  id: string;
  username: string;
  aura: number;
  money: number;
  auraCoinBalance: number;
  usernameColor?: string | null;
  profilePicture?: string | null;
  bio?: string | null;
  createdAt: string;
  badges: Array<{
    id: string;
    name: string;
    color: string;
    assignedAt: string;
    userBadgeId: string;
  }>;
  auraCoinStats?: {
    transactionCount: number;
    totalMoney: number;
  };
  gameStats: Array<{
    gameType: string;
    wins: number;
    losses: number;
    highScore: number;
    totalPlayed: number;
  }>;
  displayedNft?: {
    id: string;
    purchasePrice: number;
    acquiredAt: string;
    nft: {
      id: string;
      name: string;
      description: string;
      imageUrl: string;
      rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
      createdAt: string;
      price: number;
    };
  } | null;
}

interface Rankings {
  aura: { value: number; rank: number };
  money: { value: number; rank: number };
  [key: string]: any;
}

export default function Profile() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [auraCoinPrice, setAuraCoinPrice] = useState<number | null>(null);
  const [bombPartyStats, setBombPartyStats] = useState<BombPartyStats | null>(null);
  
  // Bio editing state
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [savingBio, setSavingBio] = useState(false);

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
      setBombPartyStats(null);
      const [userRes, rankingsRes] = await Promise.all([
        usersApi.getById(targetUserId!),
        leaderboardsApi.getUserRankings(targetUserId!),
      ]);
      setProfileUser(userRes.data.user);
      setRankings(rankingsRes.data.rankings);
      setBioText(userRes.data.user.bio || '');

      try {
        const bombPartyRes = await bombPartyApi.getStats(targetUserId!);
        setBombPartyStats(bombPartyRes.data);
      } catch (error) {
        console.error('Failed to fetch Bomb Party stats:', error);
        setBombPartyStats(null);
      }
      
      try {
        const priceRes = await auraCoinApi.getPrice();
        setAuraCoinPrice(priceRes.data.currentPrice);
      } catch (error) {
        console.error('Failed to fetch AuraCoin price:', error);
        setAuraCoinPrice(null);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBio = async () => {
    if (!profileUser) return;
    
    setSavingBio(true);
    try {
      await usersApi.update(profileUser.id, { bio: bioText });
      setProfileUser({ ...profileUser, bio: bioText || null });
      setEditingBio(false);
    } catch (error) {
      console.error('Failed to save bio:', error);
    } finally {
      setSavingBio(false);
    }
  };

  const handleCancelBio = () => {
    setBioText(profileUser?.bio || '');
    setEditingBio(false);
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

  const bombPartyWins = bombPartyStats?.wins ?? 0;
  const bombPartyGames = bombPartyStats?.totalPlayed ?? 0;
  const totalWins = profileUser.gameStats.reduce((acc, s) => acc + s.wins, 0) + bombPartyWins;
  const totalGames = profileUser.gameStats.reduce((acc, s) => acc + s.totalPlayed, 0) + bombPartyGames;
  const hasBombPartyStats = (bombPartyStats?.totalPlayed ?? 0) > 0;
  const auraCoinTransactionCount = profileUser.auraCoinStats?.transactionCount ?? 0;
  const auraCoinTotalMoney = profileUser.auraCoinStats?.totalMoney ?? 0;
  const hasGameStats = profileUser.gameStats.length > 0 || hasBombPartyStats;
  const auraCoinValue = auraCoinPrice !== null
    ? profileUser.auraCoinBalance * auraCoinPrice
    : null;
  const totalMoneyValue = auraCoinValue !== null
    ? profileUser.money + auraCoinValue
    : null;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-start gap-6">
          {/* Profile Picture */}
          {profileUser.profilePicture ? (
            <img 
              src={resolveImageUrl(profileUser.profilePicture)} 
              alt={profileUser.username}
              className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-2 border-border shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-muted/30 flex items-center justify-center border-2 border-border shrink-0">
              <span 
                className="text-3xl md:text-4xl font-light"
                style={profileUser.usernameColor ? { color: profileUser.usernameColor } : undefined}
              >
                {profileUser.username.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Profil {isOwnProfile && '(toi)'}
            </p>
            <h1 
              className="text-5xl md:text-7xl font-light tracking-tight truncate"
              style={profileUser.usernameColor ? { color: profileUser.usernameColor } : undefined}
            >
              {profileUser.username}
            </h1>
            {profileUser.badges?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {profileUser.badges.map((badge) => (
                  <span
                    key={badge.userBadgeId || badge.id}
                    className="text-xs uppercase tracking-wide px-2.5 py-1 rounded-full border"
                    style={{ color: badge.color, borderColor: badge.color }}
                  >
                    {badge.name}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              Membre depuis {new Date(profileUser.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </header>

      {/* Bio Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            À propos
          </h2>
          {isOwnProfile && !editingBio && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingBio(true)}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          )}
        </div>
        
        {editingBio ? (
          <div className="space-y-3">
            <Textarea
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              placeholder="Écris quelque chose sur toi..."
              className="bg-transparent resize-none min-h-[100px]"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground tabular-nums">
                {bioText.length}/500
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelBio}
                  disabled={savingBio}
                >
                  <X className="h-4 w-4 mr-1" />
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveBio}
                  disabled={savingBio}
                >
                  {savingBio ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className={profileUser.bio ? 'text-foreground' : 'text-muted-foreground italic'}>
            {profileUser.bio || (isOwnProfile ? 'Ajoute une description pour te présenter aux autres joueurs.' : 'Aucune description.')}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
          NFT affiché
        </h2>
        {profileUser.displayedNft ? (
          <div className="flex items-center gap-4 border border-border/40 p-4">
            <div className="w-16 h-16 bg-muted/30 flex items-center justify-center rounded shrink-0 overflow-hidden">
              {profileUser.displayedNft.nft.imageUrl ? (
                <img
                  src={resolveImageUrl(profileUser.displayedNft.nft.imageUrl)}
                  alt={profileUser.displayedNft.nft.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-medium truncate">
                  {profileUser.displayedNft.nft.name}
                </h3>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {nftRarityLabels[profileUser.displayedNft.nft.rarity] || profileUser.displayedNft.nft.rarity}
                </span>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {profileUser.displayedNft.nft.description}
              </p>
              <div className="text-xs text-muted-foreground/80 flex items-center gap-4">
                <span>
                  Créé le {new Date(profileUser.displayedNft.nft.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <span>
                  Prix d'achat ${profileUser.displayedNft.purchasePrice}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun NFT affiché.
          </p>
        )}
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
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
            {profileUser.auraCoinBalance.toFixed(4)} AC
          </p>
          <p className="text-sm text-muted-foreground">
            Aura Coin
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            ≈ ${auraCoinValue !== null ? auraCoinValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-4xl md:text-5xl font-light tabular-nums">
            ${totalMoneyValue !== null ? totalMoneyValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </p>
          <p className="text-sm text-muted-foreground">
            total money
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
        
        {!hasGameStats && (
          <p className="text-muted-foreground">Aucune partie jouée</p>
        )}
        <div className="space-y-0">
          <div className="flex items-center justify-between py-4 border-b border-border/30 last:border-0">
            <span className="font-medium capitalize">aura coin</span>
            <div className="flex items-center gap-8 text-sm text-muted-foreground tabular-nums">
              <span>{auraCoinTransactionCount} transactions</span>
              <span>${auraCoinTotalMoney.toLocaleString()}</span>
            </div>
          </div>
          {profileUser.gameStats.map((stat) => (
            <div
              key={stat.gameType}
              className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
            >
              <span className="font-medium capitalize">
                {stat.gameType.replace('_', ' ')}
              </span>
              <div className="flex items-center gap-8 text-sm text-muted-foreground tabular-nums">
                <span>{stat.highScore.toLocaleString()} record</span>
                <span>{stat.wins} V</span>
                <span>{stat.totalPlayed} jouées</span>
                <span>
                  {stat.totalPlayed > 0
                    ? Math.round((stat.wins / stat.totalPlayed) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          ))}
          {hasBombPartyStats && bombPartyStats && (
            <div className="flex items-center justify-between py-4 border-b border-border/30 last:border-0">
              <span className="font-medium capitalize">bomb party</span>
              <div className="flex items-center gap-8 text-sm text-muted-foreground tabular-nums">
                <span>{bombPartyStats.longestWord || '—'} record</span>
                <span>{bombPartyStats.wordsTyped.toLocaleString()} mots</span>
                <span>{bombPartyStats.wins} V</span>
                <span>{bombPartyStats.totalPlayed} jouées</span>
                <span>
                  {bombPartyStats.totalPlayed > 0
                    ? Math.round((bombPartyStats.wins / bombPartyStats.totalPlayed) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
