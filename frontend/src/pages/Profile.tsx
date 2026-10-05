import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Ban as BanIcon, Building2, Edit2, Heart, MessageCircle, Save, Send, X } from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import {
  usersApi,
  adminApi,
  leaderboardsApi,
  auraCoinApi,
  bombPartyApi,
  BombPartyStats,
  badgesApi,
  Badge as BadgeType,
  UserBadgeEntry,
  SocialRelationship,
  SocialStats,
  UserEconomyHistoryPoint,
} from '../services/api';
import { PageShell } from '@/components/layout/PageShell';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { resolveImageUrl } from '@/lib/images';
import { UserBadges } from '@/components/badges/UserBadges';
import { ClanTag, toClanTagData } from '@/components/clans/ClanTag';
import { BadgeCatalog } from '@/components/badges/BadgeSelector';
import { ProfileBadgeSlots } from '@/components/badges/ProfileBadgeSlots';
import { BadgeData } from '@/components/badges/BadgeIcon';
import { OverallClassementBadge } from '@/components/profile/OverallClassementBadge';

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

const profileEconomyChartConfig = {
  aura: {
    label: 'Aura',
    color: 'var(--chart-1)',
  },
  money: {
    label: 'Argent',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

const YOU_SKILL_LABELS: Record<string, string> = {
  affaires: 'Affaires',
  social: 'Social',
  intelligence: 'Intelligence',
  charisme: 'Charisme',
  finance: 'Finance',
  illegalite: 'Illégalité',
};

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

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="truncate text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {detail ? (
        <CardContent className="px-4">
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

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
  const [allBadges, setAllBadges] = useState<BadgeType[]>([]);
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
      toast('Avertissement envoye', { description: res.data.message || `L'utilisateur ${profileUser.username} verra un popup a confirmer.` });
    } catch (error) {
      toast.error('Erreur', { description: getApiErrorMessage(error, "Impossible d'envoyer l'avertissement.") });
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
      toast('Utilisateur banni', { description: `${profileUser.username} a ete banni avec succes.` });
    } catch (error) {
      toast.error('Erreur', { description: getApiErrorMessage(error, 'Erreur lors du bannissement.') });
    } finally {
      setCreatingBan(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </PageShell>
    );
  }

  if (!profileUser) {
    return (
      <PageShell>
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Utilisateur introuvable</EmptyTitle>
            <EmptyDescription>Ce profil n&apos;existe pas ou n&apos;est plus disponible.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PageShell>
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
  const totalMoneyValue = auraCoinValue !== null ? Number(profileUser.money) + auraCoinValue : null;
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

  const initials = profileUser.username.slice(0, 2).toUpperCase();
  const visibleGameRows = showAllGameStats ? gameRows : gameRows.slice(0, INITIAL_VISIBLE_GAME_ROWS);
  const gameMetricsLabel = (metrics: string[]) => metrics.join(' · ');

  return (
    <>
      <PageShell>
        <Card className="overflow-hidden py-0">
          <AspectRatio ratio={5 / 1} className="bg-muted">
            {profileBannerUrl ? <img src={profileBannerUrl} alt={`Bannière de ${profileUser.username}`} className="size-full object-cover" /> : null}
            <div className="absolute right-4 top-4">
              <OverallClassementBadge rank={overallRank} totalPlayers={overallTotalPlayers} totalScore={overallTotalScore} />
            </div>
          </AspectRatio>
          <CardContent className="flex flex-col gap-4 pb-6">
            <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <Avatar className="size-24 border-4 border-card">
                {profileUser.profilePicture ? <AvatarImage src={resolveImageUrl(profileUser.profilePicture)} alt={profileUser.username} /> : null}
                <AvatarFallback className="text-2xl font-semibold" style={profileUser.usernameColor ? { color: profileUser.usernameColor } : undefined}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap items-center gap-2">
                {isOwnProfile ? (
                  <Button variant="outline" onClick={() => setEditingBio(true)}>
                    <Edit2 />
                    Modifier la bio
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => navigate(`/messages?user=${profileUser.id}`)}>
                      <MessageCircle />
                      Message
                    </Button>
                    <Button onClick={handleFollowToggle} disabled={socialLoading}>
                      {socialLoading ? <Spinner /> : null}
                      {social?.isFollowing ? 'Ne plus suivre' : 'Suivre'}
                    </Button>
                  </>
                )}
                {canModerateProfile ? (
                  <>
                    <Button variant="outline" onClick={openWarningDialog}>
                      <AlertTriangle />
                      Avertir
                    </Button>
                    <Button variant="destructive" onClick={openBanDialog}>
                      <BanIcon />
                      Bannir
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
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
                <h1 className="text-2xl font-semibold" style={profileUser.usernameColor ? { color: profileUser.usernameColor } : undefined}>
                  {profileUser.username}
                </h1>
                {profileUser.firstName ? <span className="text-sm text-muted-foreground">{profileUser.firstName}</span> : null}
                {clanTag ? <ClanTag tag={clanTag} /> : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Membre depuis {memberSinceLabel}
                {isOwnProfile ? " · La bannière se change depuis l'inventaire" : ''}
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                {headerSocialStats.map((item) => (
                  <span key={item.label} className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{item.value}</span> {item.label}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>À propos</CardTitle>
                {isOwnProfile && !editingBio ? (
                  <CardAction>
                    <Button variant="ghost" size="sm" onClick={() => setEditingBio(true)}>
                      <Edit2 />
                      Modifier
                    </Button>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent>
                {editingBio ? (
                  <Field>
                    <FieldLabel htmlFor="profile-bio" className="sr-only">
                      Bio
                    </FieldLabel>
                    <Textarea
                      id="profile-bio"
                      value={bioText}
                      onChange={(event) => setBioText(event.target.value)}
                      placeholder="Écrivez quelque chose sur vous…"
                      rows={5}
                      maxLength={500}
                    />
                    <FieldDescription>{bioText.length}/500</FieldDescription>
                  </Field>
                ) : (
                  <p className={profileUser.bio ? 'whitespace-pre-wrap text-sm' : 'text-sm text-muted-foreground'}>
                    {profileUser.bio || (isOwnProfile ? 'Ajoutez une description pour vous présenter aux autres joueurs.' : 'Aucune description.')}
                  </p>
                )}
              </CardContent>
              {editingBio ? (
                <CardFooter className="justify-end gap-2">
                  <Button variant="ghost" onClick={handleCancelBio} disabled={savingBio}>
                    <X />
                    Annuler
                  </Button>
                  <Button onClick={handleSaveBio} disabled={savingBio}>
                    {savingBio ? <Spinner /> : <Save />}
                    Enregistrer
                  </Button>
                </CardFooter>
              ) : null}
            </Card>

            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Aperçu du joueur</h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Metric label="Aura" value={profileUser.aura.toLocaleString()} detail={formatRank(rankings?.aura?.rank)} />
                <Metric label="Argent" value={formatCurrency(profileUser.money, 0)} detail={formatRank(rankings?.money?.rank)} />
                <Metric
                  label="AuraCoin"
                  value={`${profileUser.auraCoinBalance.toFixed(2)} AC`}
                  detail={auraCoinValue !== null ? formatCurrency(auraCoinValue) : 'Prix indisponible'}
                />
                <Metric label="Valeur totale" value={totalMoneyValue !== null ? formatCurrency(totalMoneyValue) : '-'} detail="Cash + AuraCoin" />
                <Metric label="Classement global" value={overallRank ? `#${overallRank}` : '-'} detail={overallTotalPlayers ? `${overallTotalPlayers.toLocaleString()} joueurs` : undefined} />
                <Metric label="Victoires" value={totalWins.toLocaleString()} />
                <Metric label="Parties" value={totalGames.toLocaleString()} detail={`Win rate ${totalWinRate}%`} />
                <Metric label="Streak quotidien" value={`${profileUser.dailyPassStreak} j`} />
              </div>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Évolution aura / argent</CardTitle>
                <CardDescription>30 derniers jours</CardDescription>
              </CardHeader>
              <CardContent>
                {economyHistoryLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : economyHistory.length > 0 ? (
                  <ChartContainer config={profileEconomyChartConfig} className="!aspect-auto h-64 w-full">
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
                      <Line yAxisId="aura" dataKey="aura" type="monotone" stroke="var(--color-aura)" strokeWidth={2} dot={false} />
                      <Line yAxisId="money" dataKey="money" type="monotone" stroke="var(--color-money)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Historique indisponible pour le moment.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Jeux</CardTitle>
                <CardDescription>Statistiques par jeu, triées par nombre de parties.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jeu</TableHead>
                      <TableHead className="text-right">Statistiques</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleGameRows.map(({ label, metrics }) => (
                      <TableRow key={label}>
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell className="whitespace-normal text-right tabular-nums text-muted-foreground">{gameMetricsLabel(metrics)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              {hasHiddenGameRows ? (
                <CardFooter className="justify-center">
                  <Button variant="outline" onClick={() => setShowAllGameStats((previous) => !previous)}>
                    {showAllGameStats ? 'Voir moins' : 'Charger plus'}
                  </Button>
                </CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {!isOwnProfile && equippedBadges.length > 0 ? (
                  <UserBadges badges={equippedBadges} size="xl" showEmptySlots={false} tooltipSide="bottom" />
                ) : null}
                {allBadges.length > 0 ? (
                  <BadgeCatalog allBadges={allBadges} earnedBadges={userBadges} totalUsers={totalUsers} />
                ) : userBadges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun badge.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            {profileUser.marriage || (profileUser.ownedBusinesses && profileUser.ownedBusinesses.length > 0) ? (
              <Card>
                <CardHeader>
                  <CardTitle>Vie & entreprises</CardTitle>
                </CardHeader>
                <CardContent>
                  <ItemGroup>
                    {profileUser.ownedBusinesses?.map((biz, index) => (
                      <div key={biz.id}>
                        {index > 0 ? <ItemSeparator /> : null}
                        <Item size="sm">
                          <ItemMedia variant="icon">
                            <Building2 />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>{biz.name}</ItemTitle>
                            <ItemDescription>{BUSINESS_TYPE_LABELS[biz.typeKey] ?? biz.typeKey}</ItemDescription>
                          </ItemContent>
                        </Item>
                      </div>
                    ))}
                    {profileUser.marriage ? (
                      <>
                        {profileUser.ownedBusinesses && profileUser.ownedBusinesses.length > 0 ? <ItemSeparator /> : null}
                        <Item size="sm">
                          <ItemMedia variant="icon">
                            <Heart />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>
                              Marié(e) avec{' '}
                              <button
                                type="button"
                                className="hover:underline"
                                style={profileUser.marriage.partner.usernameColor ? { color: profileUser.marriage.partner.usernameColor } : undefined}
                                onClick={() => navigate(`/profile/${profileUser.marriage!.partner.id}`)}
                              >
                                {profileUser.marriage.partner.username}
                              </button>
                            </ItemTitle>
                            {profileUser.marriage.marriedAt ? (
                              <ItemDescription>
                                depuis le {new Date(profileUser.marriage.marriedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </ItemDescription>
                            ) : null}
                          </ItemContent>
                        </Item>
                      </>
                    ) : null}
                  </ItemGroup>
                </CardContent>
              </Card>
            ) : null}

            {social ? (
              <Card>
                <CardHeader>
                  <CardTitle>Réseau</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Followers', value: social.followerCount },
                      { label: 'Following', value: social.followingCount },
                      { label: 'Connexions', value: social.connectionCount },
                    ].map((stat) => (
                      <div key={stat.label} className="flex flex-col rounded-lg border p-2">
                        <span className="text-lg font-semibold tabular-nums">{stat.value}</span>
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                  {social.connections.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium">Connexions visibles</p>
                      <div className="flex flex-wrap gap-2">
                        {social.connections.map((connection) => (
                          <Button key={connection.id} variant="outline" size="sm" onClick={() => navigate(`/profile/${connection.id}`)}>
                            {connection.username}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {profileUser.youSkills && profileUser.youSkills.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>You · Compétences</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {profileUser.youSkills.map((skill) => (
                    <div key={skill.key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>{YOU_SKILL_LABELS[skill.key] ?? skill.key}</span>
                        <Badge variant="secondary">Niv. {skill.level}</Badge>
                      </div>
                      <Progress value={Math.min(100, skill.xp)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </PageShell>

      <Dialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer un avertissement</DialogTitle>
            <DialogDescription>
              {`${profileUser.username} verra un popup qu'il devra confirmer avoir lu.`}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="warning-severity">Sévérité</FieldLabel>
              <Select value={warningSeverity} onValueChange={(value: 'LOW' | 'MEDIUM' | 'HIGH') => setWarningSeverity(value)}>
                <SelectTrigger id="warning-severity" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Information</SelectItem>
                  <SelectItem value="MEDIUM">Avertissement</SelectItem>
                  <SelectItem value="HIGH">Grave</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="warning-message">Message</FieldLabel>
              <Textarea id="warning-message" value={warningMessage} onChange={(event) => setWarningMessage(event.target.value)} placeholder="Entrez le message de l'avertissement…" rows={4} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarningDialogOpen(false)} disabled={creatingWarning}>
              Annuler
            </Button>
            <Button onClick={createWarning} disabled={creatingWarning || !warningMessage.trim()}>
              {creatingWarning ? <Spinner /> : <Send />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bannir un utilisateur</DialogTitle>
            <DialogDescription>{`Empêcher ${profileUser.username} d'accéder à la plateforme.`}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ban-reason">Raison</FieldLabel>
              <Textarea id="ban-reason" value={banReason} onChange={(event) => setBanReason(event.target.value)} placeholder="Indiquez la raison du bannissement…" rows={3} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ban-type">Type de bannissement</FieldLabel>
              <Select value={banType} onValueChange={(value: 'TEMPORARY' | 'PERMANENT') => setBanType(value)}>
                <SelectTrigger id="ban-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEMPORARY">Temporaire</SelectItem>
                  <SelectItem value="PERMANENT">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {banType === 'TEMPORARY' ? (
              <Field>
                <FieldLabel htmlFor="ban-duration">Durée (heures)</FieldLabel>
                <Input id="ban-duration" type="number" value={banDuration} onChange={(event) => setBanDuration(parseInt(event.target.value, 10) || 1)} min={1} placeholder="24" />
                <FieldDescription>
                  Le bannissement expirera dans {banDuration} heure{banDuration > 1 ? 's' : ''}.
                </FieldDescription>
              </Field>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)} disabled={creatingBan}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={createBan} disabled={creatingBan || !banReason.trim()}>
              {creatingBan ? <Spinner /> : <BanIcon />}
              Bannir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
