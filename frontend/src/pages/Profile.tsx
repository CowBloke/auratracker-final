import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersApi, leaderboardsApi, auraCoinApi, bombPartyApi, BombPartyStats, badgesApi, UserBadgeEntry } from '../services/api';
import { Edit2, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';
import { UserBadges } from '@/components/badges/UserBadges';
import { BadgeSelector } from '@/components/badges/BadgeSelector';
import { BadgeData } from '@/components/badges/BadgeIcon';

interface ProfileUser {
  id: string;
  username: string;
  firstName?: string | null;
  aura: number;
  money: number;
  auraCoinBalance: number;
  usernameColor?: string | null;
  profilePicture?: string | null;
  bio?: string | null;
  createdAt: string;
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

  // Badge state
  const [userBadges, setUserBadges] = useState<UserBadgeEntry[]>([]);
  const [equippedBadge1Id, setEquippedBadge1Id] = useState<string | null>(null);
  const [equippedBadge2Id, setEquippedBadge2Id] = useState<string | null>(null);

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
        const badgesRes = await badgesApi.getUserBadges(targetUserId!);
        setUserBadges(badgesRes.data.badges);
        setEquippedBadge1Id(badgesRes.data.equippedBadge1Id);
        setEquippedBadge2Id(badgesRes.data.equippedBadge2Id);
      } catch {
        // Badges are non-critical
      }

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
      <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
        <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
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
  const equippedBadge1 = userBadges.find((b) => b.id === equippedBadge1Id) ?? null;
  const equippedBadge2 = userBadges.find((b) => b.id === equippedBadge2Id) ?? null;
  const equippedBadges = [equippedBadge1, equippedBadge2].filter(Boolean) as BadgeData[];

  return (
    <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
      {/* Profile Picture */}
      <div className="flex items-start gap-6">
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
              className={cn(TYPOGRAPHY.H2, "md:text-4xl")}
              style={profileUser.usernameColor ? { color: profileUser.usernameColor } : undefined}
            >
              {profileUser.username.slice(0, 2)}
            </span>
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <UserBadges
              badges={equippedBadges}
              size="md"
              tooltipSide="bottom"
              showEmptySlots={false}
            />
            <UsernameDisplay
              username={profileUser.username}
              firstName={profileUser.firstName}
              usernameColor={profileUser.usernameColor}
              className={cn(TYPOGRAPHY.H1, "md:text-7xl")}
              labelClassName="text-sm md:text-base text-muted-foreground"
            />
          </div>
            <p className={cn(TYPOGRAPHY.SMALL, "mt-2")}>
              Membre depuis {new Date(profileUser.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

      {/* Bio Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>À propos</CardDescription>
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
        </CardHeader>
        <CardContent className={SPACING.CARD_SPACING}>
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
                <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground tabular-nums")}>
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
            <p className={profileUser.bio ? TYPOGRAPHY.BODY : cn(TYPOGRAPHY.MUTED, "")}>
              {profileUser.bio || (isOwnProfile ? 'Ajoute une description pour te présenter aux autres joueurs.' : 'Aucune description.')}
            </p>
          )}
        </CardContent>
      </Card>


      {/* Badges Section */}
      <Card>
        <CardHeader>
          <CardDescription>Badges</CardDescription>
        </CardHeader>
        <CardContent className={SPACING.CARD_SPACING}>
          {isOwnProfile ? (
            <BadgeSelector userId={profileUser.id} />
          ) : (
            userBadges.length === 0 ? (
              <p className={TYPOGRAPHY.MUTED}>Aucun badge.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Équipés :</span>
                  <UserBadges badges={equippedBadges} size="md" showEmptySlots={false} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {userBadges.map((badge) => (
                    <div key={badge.id} className="flex flex-col items-center gap-1">
                      <UserBadges badges={[badge]} size="md" showEmptySlots={false} tooltipSide="bottom" />
                      <span className="text-[9px] text-muted-foreground max-w-[48px] truncate">{badge.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className={cn(TYPOGRAPHY.H2, "md:text-5xl tabular-nums")}>
              {profileUser.aura.toLocaleString()}
            </p>
            <p className={TYPOGRAPHY.SMALL}>
              aura <span className="text-muted-foreground/60">#{rankings?.aura?.rank || '—'}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className={cn(TYPOGRAPHY.H2, "md:text-5xl tabular-nums")}>
              ${profileUser.money.toLocaleString()}
            </p>
            <p className={TYPOGRAPHY.SMALL}>
              money <span className="text-muted-foreground/60">#{rankings?.money?.rank || '—'}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className={cn(TYPOGRAPHY.H2, "md:text-5xl tabular-nums")}>
              {profileUser.auraCoinBalance.toFixed(4)} AuraCoin
            </p>
            <p className={TYPOGRAPHY.SMALL}>
              Aura Coin
            </p>
            <p className={cn(TYPOGRAPHY.XS, "tabular-nums")}>
              ≈ ${auraCoinValue !== null ? auraCoinValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className={cn(TYPOGRAPHY.H2, "md:text-5xl tabular-nums")}>
              ${totalMoneyValue !== null ? totalMoneyValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
            </p>
            <p className={TYPOGRAPHY.SMALL}>
              total money
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className={cn(TYPOGRAPHY.H2, "md:text-5xl tabular-nums")}>
              {totalWins}
            </p>
            <p className={TYPOGRAPHY.SMALL}>victoires</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className={cn(TYPOGRAPHY.H2, "md:text-5xl tabular-nums")}>
              {totalGames}
            </p>
            <p className={TYPOGRAPHY.SMALL}>parties</p>
          </CardContent>
        </Card>
      </div>


      {/* Game Stats */}
      <Card>
        <CardHeader>
          <CardDescription>Statistiques par jeu</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasGameStats && (
            <p className={TYPOGRAPHY.MUTED}>Aucune partie jouée</p>
          )}
          <div className="divide-y divide-border/30">
            <div className="flex items-center justify-between py-4">
              <span className={cn(TYPOGRAPHY.BODY, "font-medium capitalize")}>aura coin</span>
              <div className={cn("flex items-center gap-8 tabular-nums", TYPOGRAPHY.SMALL)}>
                <span>{auraCoinTransactionCount} transactions</span>
                <span>${auraCoinTotalMoney.toLocaleString()}</span>
              </div>
            </div>
            {profileUser.gameStats.map((stat) => (
              <div
                key={stat.gameType}
                className="flex items-center justify-between py-4"
              >
                <span className={cn(TYPOGRAPHY.BODY, "font-medium capitalize")}>
                  {stat.gameType.replace('_', ' ')}
                </span>
                <div className={cn("flex items-center gap-8 tabular-nums", TYPOGRAPHY.SMALL)}>
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
              <div className="flex items-center justify-between py-4">
                <span className={cn(TYPOGRAPHY.BODY, "font-medium capitalize")}>bomb party</span>
                <div className={cn("flex items-center gap-8 tabular-nums", TYPOGRAPHY.SMALL)}>
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
        </CardContent>
      </Card>
    </div>
  );
}
