import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  usersApi,
  adminApi,
  leaderboardsApi,
  auraCoinApi,
  bombPartyApi,
  BombPartyStats,
  badgesApi,
  Badge,
  UserBadgeEntry,
  SocialRelationship,
  SocialStats,
  UserEconomyHistoryPoint,
} from '../services/api';
import { AlertTriangle, Ban as BanIcon, Building2, CalendarDays, Edit2, Heart, Loader2, MessageCircle, Save, Send, X, Coins, Wallet, Activity, Zap, Users, Star, Trophy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { toast } from '@/hooks/use-toast';
import { TYPOGRAPHY } from '@/lib/design-system';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { UserBadges } from '@/components/badges/UserBadges';
import { ClanTag, toClanTagData } from '@/components/clans/ClanTag';
import { BadgeCatalog } from '@/components/badges/BadgeSelector';
import { ProfileBadgeSlots } from '@/components/badges/ProfileBadgeSlots';
import { BadgeData } from '@/components/badges/BadgeIcon';
import { OverallClassementBadge } from '@/components/profile/OverallClassementBadge';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

const PROFILE_GAME_CATALOG = [
  { gameType: 'russian_roulette', label: 'Roulette russe' },
  { gameType: 'poker', label: 'Poker' },
  { gameType: 'petit_bac', label: 'Petit Bac' },
  { gameType: 'uno', label: 'UNO' },
  { gameType: 'battleship', label: 'Bataille Navale' },
  { gameType: 'doodle_jump', label: 'Doodle Jump' },
  { gameType: 'doodle_jump_mort_subite', label: 'Doodle Jump Mort Subite' },
  { gameType: 'logic_lab', label: 'Sudoku' },
  { gameType: 'minesweeper', label: 'Demineur' },
  { gameType: 'minesweeper_speedrun', label: 'Demineur Speedrun' },
  { gameType: 'game_2048', label: '2048' },
  { gameType: 'flappy_bird', label: 'Flappy Bird' },
  { gameType: 'chrome_dino', label: 'Chrome Dino' },
  { gameType: 'snake', label: 'Snake' },
  { gameType: 'stack_tower', label: 'Tour empilée' },
  { gameType: 'fruit_ninja', label: 'Fruit Ninja' },
  { gameType: 'qs_watermelon', label: 'QS Watermelon' },
  { gameType: 'geometry_dash', label: 'Geometry Dash' },
  { gameType: 'casino', label: 'Casino' },
  { gameType: 'solitaire', label: 'Solitaire' },
  { gameType: 'racer', label: 'Racer' },
  { gameType: 'hexgl', label: 'HexGL' },
  { gameType: 'tetris', label: 'Tetris' },
  { gameType: 'knife_hit', label: 'Knife Hit' },
  { gameType: 'goyave_empire', label: 'Goyave Empire' },
  { gameType: 'crossy_road', label: 'Crossy Road' },
  { gameType: 'puissance_4', label: 'Puissance 4' },
  { gameType: 'chess', label: 'Echecs' },
  { gameType: 'ballarena', label: 'Arène des balles' },
  { gameType: 'morpion', label: 'Morpion' },
] as const;

const INITIAL_VISIBLE_GAME_ROWS = 12;

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  startup: 'Startup Tech',
  bank: 'Banque',
  agency: 'Agence',
};

const YOU_SKILL_META: Record<string, { label: string; bar: string; text: string }> = {
  affaires: { label: 'Affaires', bar: 'bg-emerald-500', text: 'text-emerald-500' },
  social: { label: 'Social', bar: 'bg-purple-500', text: 'text-purple-500' },
  intelligence: { label: 'Intelligence', bar: 'bg-sky-500', text: 'text-sky-500' },
  charisme: { label: 'Charisme', bar: 'bg-pink-500', text: 'text-pink-500' },
  finance: { label: 'Finance', bar: 'bg-amber-500', text: 'text-amber-500' },
  illegalite: { label: 'Illégalité', bar: 'bg-rose-500', text: 'text-rose-500' },
};

const profileEconomyChartConfig = {
  aura: {
    label: 'Aura',
    color: '#eab308',
  },
  money: {
    label: 'Argent',
    color: '#22c55e',
  },
} satisfies ChartConfig;

interface ProfileUser {
  id: string;
  username: string;
  firstName?: string | null;
  aura: number;
  money: number;
  auraCoinBalance: number;
  usernameColor?: string | null;
  profilePicture?: string | null;
  profileBanner?: string | null;
  bio?: string | null;
  totalScore?: number;
  overallRank?: number;
  lastScoreUpdate?: string;
  overallRankTotalPlayers?: number;
  createdAt: string;
  dailyPassStreak: number;
  clanTag?: { text: string; style: string | null } | null;
  auraCoinStats?: {
    transactionCount: number;
    totalMoney: number;
  };
  social?: SocialRelationship &
  SocialStats & {
    connections: Array<{
      id: string;
      username: string;
      firstName?: string | null;
      usernameColor?: string | null;
      profilePicture?: string | null;
      createdAt: string;
    }>;
  };
  gameStats: Array<{
    gameType: string;
    wins: number;
    losses: number;
    highScore: number;
    totalPlayed: number;
  }>;
  marriage?: {
    partner: { id: string; username: string; usernameColor?: string | null };
    marriedAt: string | null;
  } | null;
  ownedBusinesses?: Array<{ id: string; name: string; typeKey: string }>;
  youSkills?: Array<{ key: string; level: number; xp: number }>;
}

interface Rankings {
  aura: { value: number; rank: number };
  money: { value: number; rank: number };
  overall?: { value: number; rank: number; totalPlayers?: number; updatedAt?: string };
  [key: string]: unknown;
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { error?: unknown } } }).response?.data?.error === 'string'
  ) {
    return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
  }
  return fallback;
};

export default function Profile() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [auraCoinPrice, setAuraCoinPrice] = useState<number | null>(null);
  const [bombPartyStats, setBombPartyStats] = useState<BombPartyStats | null>(null);
  const [economyHistory, setEconomyHistory] = useState<UserEconomyHistoryPoint[]>([]);
  const [economyHistoryLoading, setEconomyHistoryLoading] = useState(false);

  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [showAllGameStats, setShowAllGameStats] = useState(false);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [warningSeverity, setWarningSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [creatingWarning, setCreatingWarning] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banType, setBanType] = useState<'TEMPORARY' | 'PERMANENT'>('TEMPORARY');
  const [banDuration, setBanDuration] = useState(24);
  const [creatingBan, setCreatingBan] = useState(false);

  const [userBadges, setUserBadges] = useState<UserBadgeEntry[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [totalUsers, setTotalUsers] = useState<number | undefined>(undefined);
  const [equippedBadge1Id, setEquippedBadge1Id] = useState<string | null>(null);
  const [equippedBadge2Id, setEquippedBadge2Id] = useState<string | null>(null);

  const targetUserId = userId || currentUser?.id;
  const isOwnProfile = targetUserId === currentUser?.id;
  const canModerateProfile = Boolean(currentUser?.isAdmin && !isOwnProfile && profileUser);

  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
    }
  }, [targetUserId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setBombPartyStats(null);
      setEconomyHistoryLoading(true);
      const [userRes, rankingsRes] = await Promise.all([
        usersApi.getById(targetUserId!),
        leaderboardsApi.getUserRankings(targetUserId!),
      ]);
      setProfileUser(userRes.data.user);
      setRankings(rankingsRes.data.rankings);
      setBioText(userRes.data.user.bio || '');
      setShowAllGameStats(false);

      try {
        const historyRes = await usersApi.getEconomyHistory(targetUserId!, 30);
        setEconomyHistory(historyRes.data.history);
      } catch (error) {
        console.error('Failed to fetch economy history:', error);
        setEconomyHistory([]);
      } finally {
        setEconomyHistoryLoading(false);
      }

      try {
        const [badgesRes, allBadgesRes] = await Promise.all([
          badgesApi.getUserBadges(targetUserId!),
          badgesApi.getAll(),
        ]);
        setUserBadges(badgesRes.data.badges);
        setAllBadges(allBadgesRes.data.badges);
        setTotalUsers(allBadgesRes.data.totalUsers);
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
      setEconomyHistory([]);
      setEconomyHistoryLoading(false);
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

  const handleEquipBadge = (slot: 1 | 2, badgeId: string | null) => {
    if (slot === 1) setEquippedBadge1Id(badgeId);
    else setEquippedBadge2Id(badgeId);
  };

  const handleFollowToggle = async () => {
    if (!profileUser || isOwnProfile) return;

    try {
      setSocialLoading(true);
      if (profileUser.social?.isFollowing) {
        const res = await usersApi.unfollow(profileUser.id);
        setProfileUser((prev) =>
          prev
            ? {
              ...prev,
              social: prev.social
                ? {
                  ...prev.social,
                  ...res.data.relationship,
                  ...res.data.stats,
                }
                : {
                  ...res.data.relationship,
                  ...res.data.stats,
                  connections: [],
                },
            }
            : prev,
        );
      } else {
        const res = await usersApi.follow(profileUser.id);
        setProfileUser((prev) =>
          prev
            ? {
              ...prev,
              social: prev.social
                ? {
                  ...prev.social,
                  ...res.data.relationship,
                  ...res.data.stats,
                }
                : {
                  ...res.data.relationship,
                  ...res.data.stats,
                  connections: [],
                },
            }
            : prev,
        );
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    } finally {
      setSocialLoading(false);
    }
  };

  const openWarningDialog = () => {
    setWarningMessage('');
    setWarningSeverity('MEDIUM');
    setWarningDialogOpen(true);
  };

  const createWarning = async () => {
    if (!profileUser || !warningMessage.trim()) return;

    try {
      setCreatingWarning(true);
      const res = await adminApi.createWarning({
        userId: profileUser.id,
        message: warningMessage.trim(),
        severity: warningSeverity,
      });
      setWarningDialogOpen(false);
      setWarningMessage('');
      setWarningSeverity('MEDIUM');
      toast({
        title: 'Avertissement envoye',
        description: res.data.message || `L'utilisateur ${profileUser.username} verra un popup a confirmer.`,
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: getApiErrorMessage(error, "Impossible d'envoyer l'avertissement."),
        variant: 'destructive',
      });
    } finally {
      setCreatingWarning(false);
    }
  };

  const openBanDialog = () => {
    setBanReason('');
    setBanType('TEMPORARY');
    setBanDuration(24);
    setBanDialogOpen(true);
  };

  const createBan = async () => {
    if (!profileUser || !banReason.trim()) return;

    try {
      setCreatingBan(true);
      await adminApi.createBan({
        userId: profileUser.id,
        reason: banReason.trim(),
        type: banType,
        durationHours: banType === 'TEMPORARY' ? banDuration : undefined,
      });
      setBanDialogOpen(false);
      toast({
        title: 'Utilisateur banni',
        description: `${profileUser.username} a ete banni avec succes.`,
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: getApiErrorMessage(error, 'Erreur lors du bannissement.'),
        variant: 'destructive',
      });
    } finally {
      setCreatingBan(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 pb-8 lg:px-6">
        <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-border/60 bg-card">
          <div className="h-36 animate-pulse bg-muted/60 md:h-48" />
          <div className="px-5 pb-8 md:px-8">
            <div className="-mt-12 flex flex-col gap-6 md:-mt-16">
              <div className="h-24 w-24 rounded-full border-4 border-card bg-muted/60 md:h-32 md:w-32" />
              <div className="space-y-3">
                <div className="h-8 w-56 rounded-full bg-muted/60" />
                <div className="h-4 w-72 rounded-full bg-muted/50" />
                <div className="h-4 w-full max-w-xl rounded-full bg-muted/40" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="w-full px-4 pb-8 lg:px-6">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-border/60 bg-card px-6 py-16 text-center">
          <p className={cn(TYPOGRAPHY.MUTED)}>Utilisateur introuvable</p>
        </div>
      </div>
    );
  }

  const bombPartyWins = bombPartyStats?.wins ?? 0;
  const bombPartyGames = bombPartyStats?.totalPlayed ?? 0;
  const totalWins = profileUser.gameStats.reduce((acc, s) => acc + s.wins, 0) + bombPartyWins;
  const totalGames = profileUser.gameStats.reduce((acc, s) => acc + s.totalPlayed, 0) + bombPartyGames;
  const totalWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
  const auraCoinTransactionCount = profileUser.auraCoinStats?.transactionCount ?? 0;
  const auraCoinTotalMoney = profileUser.auraCoinStats?.totalMoney ?? 0;
  const auraCoinValue = auraCoinPrice !== null ? profileUser.auraCoinBalance * auraCoinPrice : null;
  const totalMoneyValue = auraCoinValue !== null ? profileUser.money + auraCoinValue : null;
  const overallRank = profileUser.overallRank ?? rankings?.overall?.rank ?? null;
  const overallTotalPlayers = profileUser.overallRankTotalPlayers ?? rankings?.overall?.totalPlayers;
  const overallTotalScore = profileUser.totalScore ?? rankings?.overall?.value;
  const equippedBadge1 = userBadges.find((b) => b.id === equippedBadge1Id) ?? null;
  const equippedBadge2 = userBadges.find((b) => b.id === equippedBadge2Id) ?? null;
  const equippedBadges = [equippedBadge1, equippedBadge2].filter(Boolean) as BadgeData[];
  const social = profileUser.social;
  const clanTag = toClanTagData(profileUser.clanTag);
  const memberSinceLabel = new Date(profileUser.createdAt).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  const profileBannerUrl = profileUser.profileBanner ? resolveImageUrl(profileUser.profileBanner) : null;
  const statsByGameType = new Map(profileUser.gameStats.map((stat) => [stat.gameType, stat]));
  const knownGameTypes = new Set(PROFILE_GAME_CATALOG.map((entry) => entry.gameType));
  const excludedUnknownGameTypes = new Set([...knownGameTypes, 'bombparty']);
  const catalogGameRows = PROFILE_GAME_CATALOG.map(({ gameType, label }) => {
    const stat = statsByGameType.get(gameType) ?? null;
    return {
      label,
      playedCount: stat?.totalPlayed ?? 0,
      metrics: [
        `${stat?.highScore?.toLocaleString() ?? 0} record`,
        `${stat?.wins ?? 0} V`,
        `${stat?.totalPlayed ?? 0} jouees`,
        `${stat && stat.totalPlayed > 0 ? Math.round((stat.wins / stat.totalPlayed) * 100) : 0}%`,
      ],
    };
  });
  const unknownGameRows = profileUser.gameStats
    .filter((stat) => !excludedUnknownGameTypes.has(stat.gameType))
    .map((stat) => ({
      label: humanizeGameType(stat.gameType),
      playedCount: stat.totalPlayed,
      metrics: [
        `${stat.highScore.toLocaleString()} record`,
        `${stat.wins} V`,
        `${stat.totalPlayed} jouees`,
        `${stat.totalPlayed > 0 ? Math.round((stat.wins / stat.totalPlayed) * 100) : 0}%`,
      ],
    }));
  const gameRows = [
    {
      label: 'Aura Coin',
      playedCount: auraCoinTransactionCount,
      metrics: [
        `${auraCoinTransactionCount} transactions`,
        formatCurrency(auraCoinTotalMoney, 0),
      ],
    },
    {
      label: 'Bombe de mots',
      playedCount: bombPartyStats?.totalPlayed ?? 0,
      metrics: bombPartyStats
        ? [
          `${bombPartyStats.longestWord || '-'} record`,
          `${bombPartyStats.wordsTyped.toLocaleString()} mots`,
          `${bombPartyStats.wins} V`,
          `${bombPartyStats.totalPlayed} jouees`,
          `${bombPartyStats.totalPlayed > 0 ? Math.round((bombPartyStats.wins / bombPartyStats.totalPlayed) * 100) : 0}%`,
        ]
        : ['- record', '0 mots', '0 V', '0 jouees', '0%'],
    },
    ...catalogGameRows,
    ...unknownGameRows,
  ].sort((a, b) => b.playedCount - a.playedCount || a.label.localeCompare(b.label, 'fr-FR'));
  const hasHiddenGameRows = gameRows.length > INITIAL_VISIBLE_GAME_ROWS;


  const headerSocialStats = [
    { label: 'Followers', value: social?.followerCount ?? 0 },
    { label: 'Following', value: social?.followingCount ?? 0 },
    { label: 'Connexions', value: social?.connectionCount ?? 0 },
    { label: 'Win rate', value: `${totalWinRate}%` },
  ];

  return (
    <>
      <div className="w-full px-0 pb-8">
        <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-border/40 bg-card/80 backdrop-blur-xl shadow-xl shadow-black/5">
          <div className="relative h-28 overflow-hidden border-b border-border/30 bg-gradient-to-br from-muted via-background to-muted/70 md:h-36">
            {profileBannerUrl ? (
              <>
                <img
                  src={profileBannerUrl}
                  alt={`Banniere de ${profileUser.username}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" />
              </>
            ) : null}
            <div className="absolute -left-20 top-0 h-48 w-48 rounded-full bg-foreground/[0.05] blur-3xl" />
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-foreground/[0.04] blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/45 to-transparent" />

            <div className="absolute right-4 top-4 z-30 md:right-6 md:top-5">
              <OverallClassementBadge
                rank={overallRank}
                totalPlayers={overallTotalPlayers}
                totalScore={overallTotalScore}
              />
            </div>
          </div>

          <div className="relative z-10 border-b border-border/30 px-5 pb-5 pt-3 md:px-8">
            <div className="flex flex-col gap-4">
              <div className="relative z-20 -mt-12 flex flex-col gap-4 md:-mt-14 md:flex-row md:items-end md:justify-between">
                <ProfileAvatar profileUser={profileUser} />
                <div className="flex shrink-0 flex-wrap items-center gap-3 md:justify-end">
                  {isOwnProfile ? (
                    <Button
                      variant="outline"
                      className="rounded-full px-5"
                      onClick={() => setEditingBio(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                      Modifier la bio
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        className="rounded-full px-5"
                        onClick={() => navigate(`/messages?user=${profileUser.id}`)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Message
                      </Button>
                      <Button
                        onClick={handleFollowToggle}
                        disabled={socialLoading}
                        className="rounded-full px-5"
                      >
                        {socialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {social?.isFollowing ? 'Ne plus suivre' : 'Suivre'}
                      </Button>
                    </>
                  )}
                  {canModerateProfile ? (
                    <>
                      <Button
                        variant="outline"
                        className="rounded-full border-amber-500/50 px-5 text-amber-500 hover:bg-amber-500/10"
                        onClick={openWarningDialog}
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Avertir
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-full border-orange-500/50 px-5 text-orange-500 hover:bg-orange-500/10"
                        onClick={openBanDialog}
                      >
                        <BanIcon className="h-4 w-4" />
                        Bannir
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {isOwnProfile || equippedBadges.length > 0 ? (
                    <ProfileBadgeSlots
                      badges={userBadges}
                      equippedBadge1Id={equippedBadge1Id}
                      equippedBadge2Id={equippedBadge2Id}
                      editable={isOwnProfile}
                      variant="inline"
                      onEquip={handleEquipBadge}
                    />
                  ) : null}
                  <span
                    className="min-w-0 truncate text-3xl font-semibold tracking-tight md:text-4xl"
                    style={profileUser.usernameColor ? { color: profileUser.usernameColor } : undefined}
                  >
                    {profileUser.username}
                  </span>
                  {clanTag ? (
                    <ClanTag
                      tag={clanTag}
                      className="rounded-md px-2 py-1 text-[11px] font-semibold md:text-xs"
                    />
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                  {profileUser.firstName ? (
                    <span className="font-medium text-foreground/80">{profileUser.firstName}</span>
                  ) : null}
                  <span className="rounded-full border border-border/70 px-3 py-1 text-sm text-muted-foreground">
                    @{profileUser.username}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Membre depuis {memberSinceLabel}
                  </span>
                  {isOwnProfile ? (
                    <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
                      La banniere se change depuis l'inventaire
                    </span>
                  ) : null}
                </div>

                <p className={cn('max-w-2xl text-sm leading-6 text-foreground/88', !profileUser.bio && 'text-muted-foreground')}>
                  {profileUser.bio ||
                    (isOwnProfile
                      ? 'Ajoute une description pour te presenter aux autres joueurs.'
                      : 'Aucune description pour le moment.')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                {headerSocialStats.map((item) => (
                  <div key={item.label} className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="font-semibold text-foreground">{item.value}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.55fr)_340px]">
            <div className="min-w-0 lg:border-r lg:border-border/30">
              <SectionBlock
                title="A propos"
                action={
                  isOwnProfile && !editingBio ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingBio(true)}
                      className="rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="h-4 w-4" />
                      Modifier
                    </Button>
                  ) : null
                }
              >
                {editingBio ? (
                  <div className="space-y-4">
                    <Textarea
                      value={bioText}
                      onChange={(e) => setBioText(e.target.value)}
                      placeholder="Ecris quelque chose sur toi..."
                      className="min-h-[120px] resize-none rounded-2xl border-border/70 bg-background/70"
                      maxLength={500}
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className={cn(TYPOGRAPHY.XS, 'tabular-nums text-muted-foreground')}>
                        {bioText.length}/500
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleCancelBio} disabled={savingBio}>
                          <X className="h-4 w-4" />
                          Annuler
                        </Button>
                        <Button size="sm" onClick={handleSaveBio} disabled={savingBio} className="rounded-full px-4">
                          {savingBio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className={cn('text-sm leading-7 text-foreground/88', !profileUser.bio && 'text-muted-foreground')}>
                    {profileUser.bio ||
                      (isOwnProfile
                        ? 'Ajoute une description pour te presenter aux autres joueurs.'
                        : 'Aucune description.')}
                  </p>
                )}
              </SectionBlock>

              <SectionBlock title="Aperçu du joueur">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  {/* Aura & Global Rank - Big Card */}
                  <div className="group relative overflow-hidden rounded-[2rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-background to-background p-5 md:col-span-7 xl:col-span-6">
                    <div className="absolute right-0 top-0 p-6 opacity-10 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-20">
                      <Sparkles className="h-24 w-24 text-amber-500" />
                      <div className="absolute inset-0 rounded-full bg-amber-500/30 blur-3xl" />
                    </div>
                    <div className="relative z-10 flex h-full flex-col justify-between gap-5">
                      <div>
                        <div className="flex items-center gap-2 text-amber-500/80">
                          <Star className="h-4 w-4" />
                          <p className="text-xs font-semibold tracking-wider uppercase">Aura</p>
                        </div>
                        <p className="mt-1 text-4xl font-bold tracking-tighter sm:text-5xl">{profileUser.aura.toLocaleString()}</p>
                        <p className="mt-1 text-sm font-medium text-muted-foreground">{formatRank(rankings?.aura?.rank)}</p>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Trophy className="h-3 w-3" />
                            <p className="text-[10px] font-semibold tracking-wider uppercase">Classement global</p>
                          </div>
                          <p className="mt-1 text-xl font-semibold">{overallRank ? `#${overallRank}` : '-'}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1.5 text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <p className="text-[10px] font-semibold tracking-wider uppercase">Joueurs</p>
                          </div>
                          <p className="mt-1 text-base font-medium">{overallTotalPlayers ? overallTotalPlayers.toLocaleString() : '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Economy - Spans remaining columns */}
                  <div className="flex flex-col gap-4 md:col-span-5 xl:col-span-6">
                    {/* Money */}
                    <div className="group relative flex flex-1 flex-col justify-center overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-background to-background p-5">
                      <div className="absolute right-0 top-0 p-4 opacity-10 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-20">
                        <Wallet className="h-16 w-16 text-emerald-500" />
                        <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-2xl" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-1.5 text-emerald-500/80">
                          <Coins className="h-4 w-4" />
                          <p className="text-xs font-semibold tracking-wider uppercase">Argent</p>
                        </div>
                        <p className="mt-1 text-3xl font-bold tracking-tight">{formatCurrency(profileUser.money, 0)}</p>
                        <p className="mt-1 text-sm font-medium text-muted-foreground">{formatRank(rankings?.money?.rank)}</p>
                      </div>
                    </div>
                    {/* AuraCoin & Total */}
                    <div className="grid flex-1 grid-cols-2 gap-4">
                      <div className="rounded-[1.5rem] border border-border/40 bg-background/40 p-4">
                        <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">AuraCoin</p>
                        <p className="mt-1 text-lg font-semibold">{profileUser.auraCoinBalance.toFixed(2)} AC</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{auraCoinValue !== null ? formatCurrency(auraCoinValue) : '-'}</p>
                      </div>
                      <div className="rounded-[1.5rem] border border-border/40 bg-background/40 p-4">
                        <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Valeur totale</p>
                        <p className="mt-1 truncate text-lg font-semibold">{totalMoneyValue !== null ? formatCurrency(totalMoneyValue) : '-'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Cash + AC</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats - Bottom row */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:col-span-12">
                    <div className="rounded-[1.5rem] border border-border/40 bg-background/40 p-4 text-center">
                      <p className="text-xs text-muted-foreground">Victoires</p>
                      <p className="mt-1 text-xl font-bold">{totalWins.toLocaleString()}</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-border/40 bg-background/40 p-4 text-center">
                      <p className="text-xs text-muted-foreground">Parties</p>
                      <p className="mt-1 text-xl font-bold">{totalGames.toLocaleString()}</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-border/40 bg-background/40 p-4 text-center">
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                      <p className="mt-1 text-xl font-bold">{totalWinRate}%</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-orange-500/20 bg-gradient-to-b from-orange-500/10 to-transparent p-4 text-center">
                      <p className="text-xs text-orange-500/80">Streak Quotidien</p>
                      <p className="mt-1 text-xl font-bold">{profileUser.dailyPassStreak} j</p>
                    </div>
                  </div>
                </div>
              </SectionBlock>

              <SectionBlock title="Evolution aura / argent (30 jours)">
                {economyHistoryLoading ? (
                  <div className="h-[260px] animate-pulse rounded-3xl border border-border/40 bg-muted/20" />
                ) : economyHistory.length > 0 ? (
                  <div className="rounded-3xl border border-border/40 bg-gradient-to-b from-background/40 to-background/10 p-3 sm:p-5 shadow-sm">
                    <ChartContainer config={profileEconomyChartConfig} className="!aspect-auto h-[240px] w-full sm:h-[280px]">
                      <LineChart data={economyHistory} margin={{ top: 12, right: 12, bottom: 6, left: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          minTickGap={24}
                          tickFormatter={(value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                        />
                        <YAxis yAxisId="aura" orientation="left" tickLine={false} axisLine={false} width={64} />
                        <YAxis yAxisId="money" orientation="right" tickLine={false} axisLine={false} width={72} />
                        <ChartTooltip
                          cursor={false}
                          content={
                            <ChartTooltipContent
                              indicator="line"
                              labelFormatter={(value) => new Date(`${String(value)}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
                            />
                          }
                        />
                        <Line
                          yAxisId="aura"
                          dataKey="aura"
                          type="monotone"
                          stroke="var(--color-aura)"
                          strokeWidth={2.2}
                          dot={false}
                          activeDot={{ r: 4, fill: 'var(--color-aura)' }}
                        />
                        <Line
                          yAxisId="money"
                          dataKey="money"
                          type="monotone"
                          stroke="var(--color-money)"
                          strokeWidth={2.2}
                          dot={false}
                          activeDot={{ r: 4, fill: 'var(--color-money)' }}
                        />
                      </LineChart>
                    </ChartContainer>
                  </div>
                ) : (
                  <p className={TYPOGRAPHY.MUTED}>Historique indisponible pour le moment.</p>
                )}
              </SectionBlock>

              <SectionBlock title="Jeux Favoris" flushBottom={!hasHiddenGameRows}>
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {gameRows.slice(0, 3).map(({ label, playedCount, metrics }) => (
                     <div key={label} className="group flex flex-col justify-between gap-4 rounded-[1.5rem] border border-border/40 bg-gradient-to-br from-background/50 to-background/10 p-5 transition-colors hover:border-primary/30">
                       <div className="flex items-start justify-between">
                         <h3 className="text-lg font-semibold">{label}</h3>
                         <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{playedCount} jouées</span>
                       </div>
                       <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                         {metrics.map((metric, i) => {
                            const isWinRate = metric.includes('%');
                            const isWins = metric.includes(' V');
                            const isRecord = metric.includes('record');
                            let mLabel = "Stat";
                            let mVal = metric;
                            if (isWinRate) { mLabel = "Win Rate"; mVal = metric; }
                            else if (isWins) { mLabel = "Victoires"; mVal = metric.replace(' V', ''); }
                            else if (isRecord) { mLabel = "Record"; mVal = metric.replace(' record', ''); }
                            else if (metric.includes('mots')) { mLabel = "Mots"; mVal = metric.replace(' mots', ''); }
                            else if (metric.includes('transactions')) { mLabel = "Transactions"; mVal = metric.replace(' transactions', ''); }
                            else if (metric.includes('jouees')) { mLabel = "Parties"; mVal = metric.replace(' jouees', ''); }
                            else if (metric.startsWith('$')) { mLabel = "Total"; mVal = metric; }
                            
                            if (mLabel === "Parties" || mLabel === "Transactions") return null;

                            return (
                               <div key={i}>
                                 <p className="text-[11px] tracking-wider text-muted-foreground uppercase">{mLabel}</p>
                                 <p className="font-medium">{mVal}</p>
                               </div>
                            );
                         })}
                       </div>
                     </div>
                  ))}
                </div>

                {gameRows.length > 3 && (
                  <div className="mt-8">
                    <h3 className="mb-4 px-2 text-sm font-medium text-muted-foreground">Autres statistiques</h3>
                    <div className="flex flex-col gap-2">
                      {(showAllGameStats ? gameRows.slice(3) : gameRows.slice(3, INITIAL_VISIBLE_GAME_ROWS)).map(({ label, metrics }) => (
                        <div key={label} className="flex flex-col gap-3 rounded-2xl border border-transparent p-4 transition-colors hover:border-border/40 hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm font-medium">{label}</span>
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm tabular-nums text-muted-foreground sm:justify-end">
                            {metrics.map((metric, i) => (
                              <div key={`${label}-${metric}-${i}`} className="flex items-center gap-2">
                                {i > 0 && <div className="hidden h-1 w-1 rounded-full bg-border/80 sm:block" />}
                                <span className={metric.includes('%') ? "font-medium text-foreground" : ""}>{metric}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {hasHiddenGameRows ? (
                  <div className="mt-6 flex justify-center">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setShowAllGameStats((prev) => !prev)}
                    >
                      {showAllGameStats ? 'Voir moins' : 'Charger plus'}
                    </Button>
                  </div>
                ) : null}
              </SectionBlock>

              <SectionBlock title="Badges" flushBottom>
                {!isOwnProfile && equippedBadges.length > 0 ? (
                  <div className="mb-5 flex items-center gap-4 rounded-3xl border border-border/40 bg-background/35 p-4 shadow-sm">
                    <UserBadges
                      badges={equippedBadges}
                      size="xl"
                      showEmptySlots={false}
                      tooltipSide="bottom"
                    />
                  </div>
                ) : null}

                {allBadges.length > 0 ? (
                  <BadgeCatalog allBadges={allBadges} earnedBadges={userBadges} totalUsers={totalUsers} />
                ) : userBadges.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {userBadges.map((badge) => (
                      <div key={badge.id} className="h-9 w-9" />
                    ))}
                  </div>
                ) : (
                  <p className={TYPOGRAPHY.MUTED}>Aucun badge.</p>
                )}
              </SectionBlock>
            </div>

            <aside className="min-w-0">
              <div className="flex flex-col lg:sticky lg:top-6">
                {profileUser.marriage || (profileUser.ownedBusinesses && profileUser.ownedBusinesses.length > 0) ? (
                  <SidebarPanel title="Vie & Entreprises" flushBottom={!social && !profileUser.youSkills?.length}>
                    <div className="space-y-4">
                      {profileUser.ownedBusinesses && profileUser.ownedBusinesses.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Entreprises</p>
                          <div className="space-y-2">
                            {profileUser.ownedBusinesses.map((biz) => (
                              <div key={biz.id} className="group flex items-center gap-3 rounded-2xl border border-border/40 bg-gradient-to-br from-background/50 to-background/10 p-3 transition-all duration-300 hover:border-border/60 hover:bg-background/40 hover:shadow-sm">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                  <Building2 className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">{biz.name}</p>
                                  <p className="text-[11px] text-muted-foreground">{BUSINESS_TYPE_LABELS[biz.typeKey] ?? biz.typeKey}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      
                      {profileUser.marriage ? (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Statut relationnel</p>
                          <div className="group flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-transparent p-3 transition-colors hover:border-rose-500/40">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-500">
                              <Heart className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 text-sm font-semibold">
                                <span className="text-muted-foreground font-normal">Marié(e) avec</span>
                                <button
                                  className="hover:underline truncate"
                                  style={profileUser.marriage.partner.usernameColor ? { color: profileUser.marriage.partner.usernameColor } : undefined}
                                  onClick={() => navigate(`/profile/${profileUser.marriage!.partner.id}`)}
                                >
                                  {profileUser.marriage.partner.username}
                                </button>
                              </div>
                              {profileUser.marriage.marriedAt ? (
                                <p className="text-[11px] text-muted-foreground">
                                  depuis le {new Date(profileUser.marriage.marriedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </SidebarPanel>
                ) : null}

                <SidebarPanel title="Highlights" flushBottom={!social && !profileUser.youSkills?.length}>
                  <div className="grid gap-3">
                    <CompactMetric
                      label="Aura"
                      value={profileUser.aura.toLocaleString()}
                      detail={formatRank(rankings?.aura?.rank)}
                      icon={Star}
                      colorClass="text-amber-500 bg-amber-500/10"
                    />
                    <CompactMetric
                      label="Money"
                      value={formatCurrency(profileUser.money, 0)}
                      detail={formatRank(rankings?.money?.rank)}
                      icon={Coins}
                      colorClass="text-emerald-500 bg-emerald-500/10"
                    />
                    <CompactMetric
                      label="AuraCoin"
                      value={`${profileUser.auraCoinBalance.toFixed(4)} AC`}
                      detail={auraCoinValue !== null ? formatCurrency(auraCoinValue) : 'Prix indisponible'}
                      icon={Zap}
                      colorClass="text-sky-500 bg-sky-500/10"
                    />
                    <CompactMetric
                      label="Valeur totale"
                      value={totalMoneyValue !== null ? formatCurrency(totalMoneyValue) : '-'}
                      detail="cash + AuraCoin"
                      icon={Activity}
                      colorClass="text-primary bg-primary/10"
                    />
                  </div>
                </SidebarPanel>

                {social ? (
                  <SidebarPanel title="Réseau" flushBottom={!profileUser.youSkills?.length}>
                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                      <CompactMetric label="Followers" value={String(social.followerCount)} icon={Users} colorClass="text-purple-500 bg-purple-500/10" />
                      <CompactMetric label="Following" value={String(social.followingCount)} icon={Users} colorClass="text-pink-500 bg-pink-500/10" />
                      <CompactMetric label="Connexions" value={String(social.connectionCount)} icon={Users} colorClass="text-indigo-500 bg-indigo-500/10" />
                    </div>

                    {social.connections.length > 0 ? (
                      <div className="mt-5 space-y-3">
                        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Connexions visibles</p>
                        <div className="flex flex-wrap gap-2">
                          {social.connections.map((connection) => (
                            <Button
                              key={connection.id}
                              variant="outline"
                              size="sm"
                              className="rounded-full h-8 px-3 text-xs"
                              onClick={() => navigate(`/profile/${connection.id}`)}
                            >
                              {connection.username}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </SidebarPanel>
                ) : null}

                {profileUser.youSkills && profileUser.youSkills.length > 0 ? (
                  <SidebarPanel title="You · Compétences" flushBottom>
                    <div className="grid grid-cols-2 gap-2">
                      {profileUser.youSkills.map((skill) => {
                        const meta = YOU_SKILL_META[skill.key] ?? { label: skill.key, bar: 'bg-amber-500', text: 'text-amber-500' };
                        const pct = Math.round((skill.xp / 100) * 100);
                        return (
                          <div key={skill.key} className="group rounded-2xl border border-border/40 bg-gradient-to-br from-background/50 to-background/10 px-3 py-2 transition-all duration-300 hover:border-border/60 hover:shadow-sm">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate text-xs font-medium text-muted-foreground">{meta.label}</span>
                              <span className={cn('shrink-0 text-[10px] font-bold tabular-nums', meta.text)}>Niv.{skill.level}</span>
                            </div>
                            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/40">
                              <div className={cn('h-full transition-all duration-500', meta.bar)} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SidebarPanel>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </div>

      <Dialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer un avertissement</DialogTitle>
            <DialogDescription>
              {profileUser ? `${profileUser.username} verra un popup qu'il devra confirmer avoir lu.` : "L'utilisateur verra un popup qu'il devra confirmer avoir lu."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Severite</label>
              <Select value={warningSeverity} onValueChange={(value: 'LOW' | 'MEDIUM' | 'HIGH') => setWarningSeverity(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Information</SelectItem>
                  <SelectItem value="MEDIUM">Avertissement</SelectItem>
                  <SelectItem value="HIGH">Grave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                placeholder="Entrez le message de l'avertissement..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarningDialogOpen(false)} disabled={creatingWarning}>
              Annuler
            </Button>
            <Button onClick={createWarning} disabled={creatingWarning || !warningMessage.trim()}>
              {creatingWarning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Envoyer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bannir un utilisateur</DialogTitle>
            <DialogDescription>
              {profileUser ? `Empecher ${profileUser.username} d'acceder a la plateforme.` : "Empecher un utilisateur d'acceder a la plateforme."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Raison</label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Indiquez la raison du bannissement..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type de bannissement</label>
              <Select value={banType} onValueChange={(value: 'TEMPORARY' | 'PERMANENT') => setBanType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEMPORARY">Temporaire</SelectItem>
                  <SelectItem value="PERMANENT">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {banType === 'TEMPORARY' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Duree (heures)</label>
                <Input
                  type="number"
                  value={banDuration}
                  onChange={(e) => setBanDuration(parseInt(e.target.value, 10) || 1)}
                  min={1}
                  placeholder="24"
                />
                <p className="text-xs text-muted-foreground">
                  Le bannissement expirera dans {banDuration} heure{banDuration > 1 ? 's' : ''}
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)} disabled={creatingBan}>
              Annuler
            </Button>
            <Button
              onClick={createBan}
              disabled={creatingBan || !banReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {creatingBan ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bannissement...
                </>
              ) : (
                <>
                  <BanIcon className="mr-2 h-4 w-4" />
                  Bannir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileAvatar({ profileUser }: { profileUser: ProfileUser }) {
  if (profileUser.profilePicture) {
    return (
      <img
        src={resolveImageUrl(profileUser.profilePicture)}
        alt={profileUser.username}
        className="relative z-20 h-20 w-20 shrink-0 rounded-full border-[3px] border-card bg-card object-cover shadow-xl transition-transform hover:scale-[1.02] md:h-24 md:w-24"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className="relative z-20 flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[3px] border-card bg-muted/70 shadow-xl transition-transform hover:scale-[1.02] md:h-24 md:w-24">
      <span
        className="text-2xl font-semibold tracking-tight md:text-3xl"
        style={profileUser.usernameColor ? { color: profileUser.usernameColor } : undefined}
      >
        {profileUser.username.slice(0, 2)}
      </span>
    </div>
  );
}

function SectionBlock({
  title,
  action,
  flushBottom = false,
  children,
}: {
  title: string;
  action?: ReactNode;
  flushBottom?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn('px-5 py-8 md:px-8', !flushBottom && 'border-b border-border/30')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground/90">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SidebarPanel({
  title,
  children,
  flushBottom = false,
}: {
  title: string;
  children: ReactNode;
  flushBottom?: boolean;
}) {
  return (
    <section className={cn('px-5 py-8 md:px-6', !flushBottom && 'border-b border-border/30')}>
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground/90">{title}</h2>
      </div>
      {children}
    </section>
  );
}


function CompactMetric({
  label,
  value,
  detail,
  icon: Icon,
  colorClass = "text-muted-foreground"
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: React.ElementType;
  colorClass?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-background/50 to-background/10 p-3.5 transition-all duration-300 hover:border-border/60 hover:bg-background/40 hover:shadow-sm">
      <div className="relative z-10 flex h-full items-center gap-3">
        {Icon ? (
          <div className={cn("flex shrink-0 items-center justify-center rounded-xl p-2.5", colorClass)}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground/80">{label}</p>
          <p className="mt-0.5 truncate text-lg font-semibold tracking-tight text-foreground/90">{value}</p>
          {detail ? <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground/80">{detail}</p> : null}
        </div>
      </div>
    </div>
  );
}


function formatCurrency(value: number, digits = 2) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatRank(rank?: number | null) {
  return rank ? `Rank #${rank}` : 'Rank -';
}

function humanizeGameType(gameType: string) {
  return gameType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
