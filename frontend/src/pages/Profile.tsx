import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  usersApi,
  leaderboardsApi,
  auraCoinApi,
  bombPartyApi,
  BombPartyStats,
  badgesApi,
  Badge,
  UserBadgeEntry,
  SocialRelationship,
  SocialStats,
} from '../services/api';
import { CalendarDays, Edit2, Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TYPOGRAPHY } from '@/lib/design-system';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { UserBadges } from '@/components/badges/UserBadges';
import { ClanTag, toClanTagData } from '@/components/clans/ClanTag';
import { BadgeCatalog } from '@/components/badges/BadgeSelector';
import { ProfileBadgeSlots } from '@/components/badges/ProfileBadgeSlots';
import { BadgeData } from '@/components/badges/BadgeIcon';

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
  { gameType: 'game_2048', label: '2048' },
  { gameType: 'flappy_bird', label: 'Flappy Bird' },
  { gameType: 'chrome_dino', label: 'Chrome Dino' },
  { gameType: 'stack_tower', label: 'Tour empilée' },
  { gameType: 'fruit_ninja', label: 'Fruit Ninja' },
  { gameType: 'qs_watermelon', label: 'QS Watermelon' },
  { gameType: 'geometry_dash', label: 'Geometry Dash' },
  { gameType: 'casino', label: 'Casino' },
  { gameType: 'solitaire', label: 'Solitaire' },
  { gameType: 'racer', label: 'Racer' },
  { gameType: 'tetris', label: 'Tetris' },
  { gameType: 'knife_hit', label: 'Knife Hit' },
  { gameType: 'goyave_empire', label: 'Goyave Empire' },
  { gameType: 'puissance_4', label: 'Puissance 4' },
  { gameType: 'chess', label: 'Echecs' },
  { gameType: 'ballarena', label: 'Arène des balles' },
  { gameType: 'morpion', label: 'Morpion' },
] as const;

const INITIAL_VISIBLE_GAME_ROWS = 12;

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
  createdAt: string;
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
}

interface Rankings {
  aura: { value: number; rank: number };
  money: { value: number; rank: number };
  [key: string]: any;
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

  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [showAllGameStats, setShowAllGameStats] = useState(false);

  const [userBadges, setUserBadges] = useState<UserBadgeEntry[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [totalUsers, setTotalUsers] = useState<number | undefined>(undefined);
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
      setShowAllGameStats(false);

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

  if (loading) {
    return (
      <div className="w-full px-4 pb-8 lg:px-6">
        <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[28px] border border-border/60 bg-card">
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
        <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-border/60 bg-card px-6 py-16 text-center">
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
  const visibleGameRows = showAllGameStats ? gameRows : gameRows.slice(0, INITIAL_VISIBLE_GAME_ROWS);
  const hasHiddenGameRows = gameRows.length > INITIAL_VISIBLE_GAME_ROWS;

  const summaryMetrics = [
    {
      label: 'Aura',
      value: profileUser.aura.toLocaleString(),
      detail: formatRank(rankings?.aura?.rank),
    },
    {
      label: 'Money',
      value: formatCurrency(profileUser.money, 0),
      detail: formatRank(rankings?.money?.rank),
    },
    {
      label: 'AuraCoin',
      value: `${profileUser.auraCoinBalance.toFixed(4)} AC`,
      detail: auraCoinValue !== null ? formatCurrency(auraCoinValue) : 'Prix indisponible',
    },
    {
      label: 'Valeur totale',
      value: totalMoneyValue !== null ? formatCurrency(totalMoneyValue) : '-',
      detail: 'cash + AuraCoin',
    },
    {
      label: 'Victoires',
      value: totalWins.toLocaleString(),
      detail: `${totalWinRate}% win rate`,
    },
    {
      label: 'Parties',
      value: totalGames.toLocaleString(),
      detail: 'tous jeux confondus',
    },
  ];

  const headerSocialStats = [
    { label: 'Followers', value: social?.followerCount ?? 0 },
    { label: 'Following', value: social?.followingCount ?? 0 },
    { label: 'Connexions', value: social?.connectionCount ?? 0 },
    { label: 'Win rate', value: `${totalWinRate}%` },
  ];

  return (
    <div className="w-full px-0 pb-8">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-sm">
        <div className="relative h-36 overflow-hidden border-b border-border/60 bg-gradient-to-br from-muted via-background to-muted/70 md:h-48">
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
        </div>

        <div className="relative z-10 border-b border-border/60 px-5 pb-6 pt-4 md:px-8">
          <div className="flex flex-col gap-5">
            <div className="relative z-20 -mt-16 flex flex-col gap-4 md:-mt-20 md:flex-row md:items-end md:justify-between">
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
                  <Button
                    onClick={handleFollowToggle}
                    disabled={socialLoading}
                    className="rounded-full px-5"
                  >
                    {socialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {social?.isFollowing ? 'Ne plus suivre' : 'Suivre'}
                  </Button>
                )}
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
          <div className="min-w-0 lg:border-r lg:border-border/60">
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

            <SectionBlock title="Vue d'ensemble">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {summaryMetrics.map((metric) => (
                  <MetricTile
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    detail={metric.detail}
                  />
                ))}
              </div>
            </SectionBlock>

            <SectionBlock title="Statistiques par jeu">
              <div className="divide-y divide-border/60 overflow-hidden rounded-3xl border border-border/60 bg-background/35">
                {visibleGameRows.map(({ label, metrics }) => (
                  <GameStatRow
                    key={label}
                    title={label}
                    metrics={metrics}
                  />
                ))}
              </div>

              {hasHiddenGameRows ? (
                <div className="mt-4 flex justify-center">
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
                <div className="mb-5 flex items-center gap-4 rounded-3xl border border-border/60 bg-background/35 p-4">
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
              <SidebarPanel title="Highlights">
                <div className="grid gap-3">
                  <CompactMetric
                    label="Aura"
                    value={profileUser.aura.toLocaleString()}
                    detail={formatRank(rankings?.aura?.rank)}
                  />
                  <CompactMetric
                    label="Money"
                    value={formatCurrency(profileUser.money, 0)}
                    detail={formatRank(rankings?.money?.rank)}
                  />
                  <CompactMetric
                    label="AuraCoin"
                    value={`${profileUser.auraCoinBalance.toFixed(4)} AC`}
                    detail={auraCoinValue !== null ? formatCurrency(auraCoinValue) : 'Prix indisponible'}
                  />
                  <CompactMetric
                    label="Valeur totale"
                    value={totalMoneyValue !== null ? formatCurrency(totalMoneyValue) : '-'}
                    detail="cash + AuraCoin"
                  />
                </div>
              </SidebarPanel>

              {social ? (
                <SidebarPanel title="Reseau" flushBottom>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <CompactMetric label="Followers" value={String(social.followerCount)} />
                    <CompactMetric label="Following" value={String(social.followingCount)} />
                    <CompactMetric label="Connexions" value={String(social.connectionCount)} />
                  </div>

                  {social.connections.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      <p className="text-xs text-muted-foreground">Connexions visibles</p>
                      <div className="flex flex-wrap gap-2">
                        {social.connections.map((connection) => (
                          <Button
                            key={connection.id}
                            variant="outline"
                            size="sm"
                            className="rounded-full"
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
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ProfileAvatar({ profileUser }: { profileUser: ProfileUser }) {
  if (profileUser.profilePicture) {
    return (
      <img
        src={resolveImageUrl(profileUser.profilePicture)}
        alt={profileUser.username}
        className="relative z-20 h-24 w-24 shrink-0 rounded-full border-4 border-card object-cover shadow-sm md:h-32 md:w-32"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className="relative z-20 flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-card bg-muted/70 shadow-sm md:h-32 md:w-32">
      <span
        className="text-3xl font-semibold tracking-tight md:text-4xl"
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
    <section className={cn('px-5 py-6 md:px-8', !flushBottom && 'border-b border-border/60')}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
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
    <section className={cn('px-5 py-6 md:px-6', !flushBottom && 'border-b border-border/60')}>
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-background/40 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function CompactMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-background/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function GameStatRow({
  title,
  metrics,
}: {
  title: string;
  metrics: string[];
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
      <span className="text-sm font-medium capitalize text-foreground">{title}</span>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm tabular-nums text-muted-foreground md:justify-end">
        {metrics.map((metric) => (
          <span key={`${title}-${metric}`}>{metric}</span>
        ))}
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
