import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { type Ad, adsApi, auraCoinApi, AuraCoinLeaderboardEntry, gamesApi, leaderboardsApi, clansApi, usersApi } from '../services/api';
import { AdBanner } from '@/components/ads/AdBanner';
import { X, TrendingUp, Gem, ArrowUp, Skull, Layers, Wind, Diamond, Timer, LayoutGrid, Sparkles, TrendingDown, Flame, Gamepad2, Hash, Target, Bomb, BarChart2, Trophy, Info, Bird, Rocket, Zap, Coins, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';
import { UsernameDisplay } from '@/components/ui/username-display';
import { toClanTagData } from '@/components/clans/ClanTag';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BadgeData } from '@/components/badges/UserBadges';
import { PlayerHoverCard } from '@/components/ui/player-hover-card';
import { TableSkeleton } from '@/components/ui/loading-skeletons';

type CategoryIcon = React.ComponentType<{ className?: string }>;

interface Ranking {
  rank: number;
  userId: string;
  username: string;
  usernameColor?: string | null;
  value: number;
  moneyValue?: number;
  wins?: number;
  losses?: number;
  totalPlayed?: number;
  badges?: BadgeData[];
  clanTag?: { text: string; style: string | null } | null;
}

type StatItem = { label: string; value: string; hint?: string };
type StatSection = { title: string; items: StatItem[] };

type Category = 'aura' | 'money' | 'total_money' | 'auracoin' | 'followers' | 'doodle_jump' | 'doodle_jump_mort_subite' | 'game_2048' | 'flappy_bird' | 'duck_hunt' | 'chrome_dino' | 'snake' | 'crossy_road' | 'stack_tower' | 'geometry_dash' | 'qs_watermelon' | 'solitaire' | 'racer' | 'hexgl' | 'tetris' | 'knife_hit' | 'minesweeper' | 'minesweeper_speedrun' | 'fruit_ninja' | 'goyave_empire' | 'logic_lab' | 'casino' | 'casino_losses' | 'chess' | 'petit_bac' | 'puissance_4' | 'ball_arena' | 'poker' | 'battleship' | 'russian_roulette' | 'uno' | 'morpion' | 'polymarket_ratio' | 'games_played' | 'bombparty' | 'overall';
type View = Category | 'nombres';
type Period = 'all' | 'monthly' | 'weekly' | 'daily';

const PERIOD_CATEGORIES = new Set<Category>([
  'doodle_jump', 'doodle_jump_mort_subite', 'game_2048', 'flappy_bird', 'duck_hunt',
  'chrome_dino', 'solitaire', 'racer', 'hexgl', 'tetris', 'knife_hit', 'minesweeper', 'minesweeper_speedrun', 'casino',
]);

const PERIOD_OPTIONS: { id: Period; label: string }[] = [
  { id: 'all', label: 'Tout le temps' },
  { id: 'monthly', label: 'Ce mois' },
  { id: 'weekly', label: 'Cette semaine' },
  { id: 'daily', label: "Aujourd'hui" },
];

const categories: { id: Category; name: string; valueLabel: string; icon: CategoryIcon }[] = [
  { id: 'overall', name: 'Classement global', valueLabel: 'score', icon: Trophy },
  { id: 'aura', name: 'Aura', valueLabel: 'aura', icon: Zap },
  { id: 'money', name: 'Argent', valueLabel: '$', icon: Coins },
  { id: 'total_money', name: 'Argent total', valueLabel: '$', icon: Coins },
  { id: 'auracoin', name: 'Aura Coin', valueLabel: 'AuraCoin', icon: Gem },
  { id: 'followers', name: 'Followers', valueLabel: 'followers', icon: Users },
  { id: 'doodle_jump', name: 'Doodle Jump', valueLabel: 'score', icon: ArrowUp },
  { id: 'doodle_jump_mort_subite', name: 'Doodle Jump - Mort subite', valueLabel: 'score', icon: Skull },
  { id: 'game_2048', name: '2048', valueLabel: 'score', icon: Layers },
  { id: 'flappy_bird', name: 'Flappy Bird', valueLabel: 'score', icon: Wind },
  { id: 'duck_hunt', name: 'Duck Hunt', valueLabel: 'score', icon: Target },
  { id: 'chrome_dino', name: 'Chrome Dino', valueLabel: 'score', icon: Gamepad2 },
  { id: 'snake', name: 'Snake', valueLabel: 'score', icon: Gamepad2 },
  { id: 'crossy_road', name: 'Crossy Road', valueLabel: 'score', icon: Bird },
  { id: 'stack_tower', name: 'Tour empilée', valueLabel: 'score', icon: Layers },
  { id: 'geometry_dash', name: 'Geometry Dash', valueLabel: 'score', icon: ArrowUp },
  { id: 'qs_watermelon', name: 'QS Watermelon', valueLabel: 'score', icon: Sparkles },
  { id: 'solitaire', name: 'Solitaire', valueLabel: 'score', icon: Diamond },
  { id: 'racer', name: 'Racer', valueLabel: 'temps', icon: Timer },
  { id: 'hexgl', name: 'HexGL', valueLabel: 'temps', icon: Rocket },
  { id: 'tetris', name: 'Tetris', valueLabel: 'score', icon: LayoutGrid },
  { id: 'knife_hit', name: 'Knife Hit', valueLabel: 'score', icon: Target },
  { id: 'minesweeper', name: 'Démineur', valueLabel: 'score', icon: Bomb },
  { id: 'minesweeper_speedrun', name: 'Démineur Speedrun', valueLabel: 'temps', icon: Timer },
  { id: 'fruit_ninja', name: 'Fruit Ninja', valueLabel: 'score', icon: Target },
  { id: 'goyave_empire', name: 'Goyave Empire', valueLabel: 'score', icon: Flame },
  { id: 'logic_lab', name: 'Sudoku', valueLabel: 'score', icon: Hash },
  { id: 'casino', name: 'Gains Casino (partie unique)', valueLabel: '$', icon: Sparkles },
  { id: 'casino_losses', name: 'Pertes Casino (totales)', valueLabel: '$', icon: TrendingDown },
  { id: 'chess', name: 'Échecs', valueLabel: 'victoires', icon: Hash },
  { id: 'petit_bac', name: 'Petit Bac', valueLabel: 'victoires', icon: Sparkles },
  { id: 'puissance_4', name: 'Puissance 4', valueLabel: 'victoires', icon: Layers },
  { id: 'ball_arena', name: 'Arène des balles', valueLabel: 'victoires', icon: Target },
  { id: 'poker', name: 'Poker', valueLabel: 'victoires', icon: Diamond },
  { id: 'battleship', name: 'Bataille Navale', valueLabel: 'victoires', icon: Target },
  { id: 'russian_roulette', name: 'Roulette Russe', valueLabel: 'victoires', icon: Skull },
  { id: 'uno', name: 'Uno', valueLabel: 'victoires', icon: Layers },
  { id: 'morpion', name: 'Morpion', valueLabel: 'victoires', icon: Hash },
  { id: 'polymarket_ratio', name: 'Polymarket', valueLabel: 'ratio', icon: TrendingUp },
  { id: 'bombparty', name: 'Bombe de mots', valueLabel: 'victoires', icon: Flame },
  { id: 'games_played', name: 'Parties', valueLabel: 'jeux', icon: Gamepad2 },
];

const economyCategories: Category[] = ['aura', 'money', 'total_money', 'auracoin'];
const socialCategories: Category[] = ['followers'];
const gameCategories: Category[] = ['doodle_jump', 'doodle_jump_mort_subite', 'game_2048', 'flappy_bird', 'chrome_dino', 'snake', 'crossy_road', 'stack_tower', 'geometry_dash', 'qs_watermelon', 'solitaire', 'racer', 'hexgl', 'tetris', 'knife_hit', 'minesweeper', 'minesweeper_speedrun', 'fruit_ninja', 'goyave_empire', 'logic_lab', 'casino', 'casino_losses', 'chess', 'petit_bac', 'puissance_4', 'ball_arena', 'poker', 'battleship', 'russian_roulette', 'uno', 'morpion', 'polymarket_ratio', 'bombparty', 'games_played'];
const genericGameCategories: Category[] = ['snake', 'crossy_road', 'stack_tower', 'geometry_dash', 'qs_watermelon', 'fruit_ninja', 'goyave_empire', 'logic_lab'];
const deletableGameCategories: Partial<Record<Category, string>> = {
  doodle_jump: 'doodle_jump',
  doodle_jump_mort_subite: 'doodle_jump_mort_subite',
  game_2048: 'game_2048',
  flappy_bird: 'flappy_bird',
  chrome_dino: 'chrome_dino',
  snake: 'snake',
  crossy_road: 'crossy_road',
  stack_tower: 'stack_tower',
  geometry_dash: 'geometry_dash',
  qs_watermelon: 'qs_watermelon',
  solitaire: 'solitaire',
  racer: 'racer',
  hexgl: 'hexgl',
  tetris: 'tetris',
  knife_hit: 'knife_hit',
  minesweeper: 'minesweeper',
  minesweeper_speedrun: 'minesweeper_speedrun',
  fruit_ninja: 'fruit_ninja',
  goyave_empire: 'goyave_empire',
  logic_lab: 'logic_lab',
  casino: 'casino',
  chess: 'chess',
  petit_bac: 'petit_bac',
  puissance_4: 'puissance_4',
  ball_arena: 'ball_arena',
  poker: 'poker',
  battleship: 'battleship',
  russian_roulette: 'russian_roulette',
  uno: 'uno',
  morpion: 'morpion',
};

const gamesCatalog = ['Doodle Jump', 'Démineur', '2048', 'Flappy Bird', 'Chrome Dino', 'Crossy Road', 'Tour empilée', 'Geometry Dash', 'Fruit Ninja', 'Goyave Empire', 'Sudoku', 'Casino', 'Bombe de mots', 'Poker', 'Petit Bac', 'Bataille navale', 'Solitaire', 'Racer', 'HexGL', 'Tetris', 'Knife Hit', 'Polymarket', 'Échecs', 'Puissance 4', 'Arène des balles', 'Roulette russe', 'Uno', 'Morpion'];

const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const formatMoney = (value: number, digits = 0) => `$${formatNumber(value, digits)}`;

export default function Leaderboards() {
  const { user } = useAuth();
  const { confirm } = useAppDialog();
  const [activeView, setActiveView] = useState<View>('overall');
  const [period, setPeriod] = useState<Period>('all');
  const category: Category = activeView === 'nombres' ? 'aura' : activeView as Category;

  // Rankings state
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Nombres state
  const [nombresSections, setNombresSections] = useState<StatSection[]>([]);
  const [nombresLoading, setNombresLoading] = useState(false);

  // Breakdown panel for overall ranking
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [bannerAd, setBannerAd] = useState<Ad | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    void adsApi.listPublic({ limit: 1 }).then((res) => setBannerAd(res.data.ads[0] ?? null)).catch(() => {});
  }, []);

  // Reset period when switching to a category that doesn't support it
  useEffect(() => {
    if (activeView === 'nombres' || !PERIOD_CATEGORIES.has(category)) {
      setPeriod('all');
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView !== 'nombres') {
      fetchRankings();
    }
  }, [activeView, period]);

  useEffect(() => {
    if (activeView === 'nombres' && nombresSections.length === 0) {
      fetchNombres();
    }
  }, [activeView]);

  const fetchRankings = async () => {
    try {
      setLoading(true);
      if (category === 'auracoin') {
        const [leaderboardRes, priceRes] = await Promise.all([
          auraCoinApi.getLeaderboard(50),
          auraCoinApi.getPrice(24),
        ]);
        const currentPrice = priceRes.data.currentPrice;
        const mapped = leaderboardRes.data.leaderboard.map((entry: AuraCoinLeaderboardEntry, index: number) => ({
          rank: index + 1,
          userId: entry.id,
          username: entry.username,
          usernameColor: entry.usernameColor,
          value: entry.auraCoinBalance,
          moneyValue: entry.auraCoinBalance * currentPrice,
        }));
        setRankings(mapped);
        const userEntry = mapped.find((entry) => entry.userId === user?.id);
        setUserRank(userEntry ? userEntry.rank : null);
      } else if (genericGameCategories.includes(category)) {
        const response = await gamesApi.getLeaderboard(category, 50);
        const mapped: Ranking[] = (response.data.rankings || []).map((entry: any, index: number) => ({
          rank: index + 1,
          userId: entry.user?.id || '',
          username: entry.user?.username || 'Unknown',
          usernameColor: entry.user?.usernameColor,
          value: Number(entry.highScore || 0),
          badges: entry.badges,
          clanTag: entry.user?.clanTag ?? null,
        }));
        setRankings(mapped);
        const userEntry = mapped.find((entry) => entry.userId === user?.id);
        setUserRank(userEntry ? userEntry.rank : null);
      } else if (category === 'followers') {
        const response = await usersApi.getAll();
        const followersRows = (response.data.users || [])
          .map((entry: any) => ({
            userId: entry.id,
            username: entry.username,
            usernameColor: entry.usernameColor,
            value: Number(entry.social?.followerCount || 0),
          })) as Array<Omit<Ranking, 'rank'>>;

        const mapped: Ranking[] = followersRows
          .sort((a: Omit<Ranking, 'rank'>, b: Omit<Ranking, 'rank'>) => b.value - a.value)
          .slice(0, 50)
          .map((entry: Omit<Ranking, 'rank'>, index: number) => ({
            ...entry,
            rank: index + 1,
          }));
        setRankings(mapped);
        const userEntry = mapped.find((entry) => entry.userId === user?.id);
        setUserRank(userEntry ? userEntry.rank : null);
      } else {
        const params: Parameters<typeof leaderboardsApi.get>[1] = { limit: 50 };
        if (period !== 'all' && PERIOD_CATEGORIES.has(category)) params.period = period;
        const response = await leaderboardsApi.get(category, params);
        setRankings(response.data.rankings);
        setUserRank(response.data.userRank);
      }
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNombres = async () => {
    setNombresLoading(true);
    try {
      const [usersRes, clansRes, priceRes, gamesPlayedRes] = await Promise.all([
        usersApi.getAll(),
        clansApi.list(),
        auraCoinApi.getPrice(24),
        leaderboardsApi.get('games_played', { limit: 1000 }),
      ]);

      const users = (usersRes.data.users || []) as { aura: number; money: number; auraCoinBalance: number; createdAt: string }[];
      const totalUsers = users.length;
      const totalAura = users.reduce((sum, u) => sum + Number(u.aura || 0), 0);
      const totalMoney = users.reduce((sum, u) => sum + Number(u.money || 0), 0);
      const totalAuraCoin = users.reduce((sum, u) => sum + Number(u.auraCoinBalance || 0), 0);
      const auraCoinPrice = Number(priceRes.data.currentPrice || 0);
      const totalWealth = totalMoney + totalAuraCoin * auraCoinPrice;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const newUsers7d = users.filter((u) => new Date(u.createdAt) >= sevenDaysAgo).length;

      const clans = clansRes.data.clans || [];
      const totalClans = clans.length;
      const totalClanMembers = clans.reduce((sum, clan) => sum + (clan.memberCount || 0), 0);

      const gamesPlayedRankings = (gamesPlayedRes.data.rankings || []) as { value: number }[];
      const totalGamesPlayed = gamesPlayedRankings.reduce((sum, e) => sum + Number(e.value || 0), 0);

      setNombresSections([
        {
          title: 'Communauté',
          items: [
            { label: 'Joueurs inscrits', value: formatNumber(totalUsers), hint: 'Tous les profils actifs et valides.' },
            { label: 'Nouveaux joueurs (7 jours)', value: formatNumber(newUsers7d), hint: 'Arrivées récentes dans la communauté.' },
            { label: 'Clans actifs', value: formatNumber(totalClans), hint: 'Clans qui comptent au moins un membre.' },
            { label: 'Membres en clan', value: formatNumber(totalClanMembers), hint: 'Somme des membres dans tous les clans.' },
          ],
        },
        {
          title: 'Économie',
          items: [
            { label: 'Aura totale', value: formatNumber(totalAura), hint: 'Aura cumulée sur tous les joueurs.' },
            { label: 'Argent total', value: formatMoney(totalMoney), hint: 'Solde global en dollars virtuels.' },
            { label: 'Aura Coin total', value: formatNumber(totalAuraCoin, 2), hint: 'Somme des balances Aura Coin.' },
            { label: 'Richesse estimée', value: formatMoney(totalWealth), hint: 'Argent + Aura Coin au prix actuel.' },
          ],
        },
        {
          title: 'Jeux',
          items: [
            { label: 'Jeux disponibles', value: formatNumber(gamesCatalog.length), hint: gamesCatalog.join(', ') + '.' },
            { label: 'Parties jouées (tous jeux)', value: formatNumber(totalGamesPlayed), hint: 'Total cumulé des parties enregistrées.' },
          ],
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch nombres:', error);
    } finally {
      setNombresLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const totalMs = Math.max(0, Math.round(seconds * 1000));
    const minutes = Math.floor(totalMs / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const milliseconds = totalMs % 1000;
    if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    } else {
      return `${secs}.${milliseconds.toString().padStart(3, '0')}`;
    }
  };

  const formatValue = (ranking: Ranking) => {
    const numericValue = typeof ranking.value === 'number' ? ranking.value : Number(ranking.value);
    switch (category) {
      case 'auracoin':
        return `${numericValue.toFixed(4)} AuraCoin • ≈ $${(ranking.moneyValue || 0).toFixed(2)}`;
      case 'total_money':
        return `$${numericValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'money':
      case 'casino':
        return `$${numericValue.toLocaleString()}`;
      case 'casino_losses':
        return `-$${numericValue.toLocaleString()}`;
      case 'overall':
        return `${Math.round(numericValue).toLocaleString('fr-FR')} pts`;
      case 'racer':
      case 'hexgl':
        return formatTime(numericValue);
      case 'polymarket_ratio': {
        const wins = ranking.wins ?? 0;
        const losses = ranking.losses ?? 0;
        return `${numericValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${wins}/${losses})`;
      }
      default:
        return numericValue.toLocaleString();
    }
  };

  const handleDeleteScore = async (userId: string, username: string) => {
    const gameType = deletableGameCategories[category];
    if (!gameType) return;
    if (!(await confirm(`Supprimer le score de ${username} ?`))) return;

    try {
      await gamesApi.deleteStats(gameType, userId);
      await fetchRankings();
    } catch (error) {
      console.error('Failed to delete score:', error);
    }
  };

  const activeTitle = activeView === 'nombres'
    ? 'Nombres'
    : categories.find(c => c.id === activeView)?.name ?? '';

  return (
    <PageShell>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] h-[calc(100svh-var(--header-height)-4rem)]">
          {/* Sidebar */}
          <Card className="h-full overflow-hidden">
            <ScrollArea className="h-full">
            <CardContent className="p-2">
              {/* Classement global — special entry */}
              <button
                type="button"
                onClick={() => setActiveView('overall')}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40",
                  activeView === 'overall' && "bg-muted"
                )}
              >
                <span className={cn("flex items-center gap-2", TYPOGRAPHY.SMALL, activeView === 'overall' ? "text-foreground" : "text-muted-foreground")}>
                  <Trophy className="w-3.5 h-3.5 shrink-0" />
                  Classement global
                </span>
              </button>

              {/* Nombres — special entry */}
              <button
                type="button"
                onClick={() => setActiveView('nombres')}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40",
                  activeView === 'nombres' && "bg-muted"
                )}
              >
                <span className={cn("flex items-center gap-2", TYPOGRAPHY.SMALL, activeView === 'nombres' ? "text-foreground" : "text-muted-foreground")}>
                  <BarChart2 className="w-3.5 h-3.5 shrink-0" />
                  Nombres
                </span>
              </button>

              {/* Économie group */}
              <div className="mt-3">
                <p className={cn(TYPOGRAPHY.XS, "px-3 pb-1 text-muted-foreground/50 font-medium")}>
                  Économie
                </p>
                <div className="space-y-0.5">
                  {categories.filter(c => economyCategories.includes(c.id)).map(cat => {
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveView(cat.id)}
                        className={cn(
                          "w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40",
                          activeView === cat.id && "bg-muted"
                        )}
                      >
                        <span className={cn("flex items-center gap-2", TYPOGRAPHY.SMALL, activeView === cat.id ? "text-foreground" : "text-muted-foreground")}>
                          <cat.icon className="w-3.5 h-3.5 shrink-0" />
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Communaute group */}
              <div className="mt-3">
                <p className={cn(TYPOGRAPHY.XS, "px-3 pb-1 text-muted-foreground/50 font-medium")}>
                  Communaute
                </p>
                <div className="space-y-0.5">
                  {categories.filter(c => socialCategories.includes(c.id)).map(cat => {
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveView(cat.id)}
                        className={cn(
                          "w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40",
                          activeView === cat.id && "bg-muted"
                        )}
                      >
                        <span className={cn("flex items-center gap-2", TYPOGRAPHY.SMALL, activeView === cat.id ? "text-foreground" : "text-muted-foreground")}>
                          <cat.icon className="w-3.5 h-3.5 shrink-0" />
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Jeux group */}
              <div className="mt-3">
                <p className={cn(TYPOGRAPHY.XS, "px-3 pb-1 text-muted-foreground/50 font-medium")}>
                  Jeux
                </p>
                <div className="space-y-0.5">
                  {categories.filter(c => gameCategories.includes(c.id)).map(cat => {
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveView(cat.id)}
                        className={cn(
                          "w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40",
                          activeView === cat.id && "bg-muted"
                        )}
                      >
                        <span className={cn("flex items-center gap-2", TYPOGRAPHY.SMALL, activeView === cat.id ? "text-foreground" : "text-muted-foreground")}>
                          <cat.icon className="w-3.5 h-3.5 shrink-0" />
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
            </ScrollArea>
          </Card>

          {/* Main content */}
          <ScrollArea className="h-full">
          <div className="space-y-4">
            <h2 className={TYPOGRAPHY.H3}>{activeTitle}</h2>

            {bannerAd && !bannerDismissed && !user?.hasAdblock ? <AdBanner ad={bannerAd} onDismiss={() => setBannerDismissed(true)} /> : null}

            {activeView === 'overall' && (
              <div className="rounded-lg border border-border/40 bg-muted/20">
                <button
                  type="button"
                  onClick={() => setShowBreakdown(true)}
                  className="flex w-full items-center px-4 py-3 text-left"
                >
                  <span className={cn("flex items-center gap-1.5", TYPOGRAPHY.SMALL, "text-muted-foreground")}>
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Comment est calculé ce classement ?
                  </span>
                </button>
              </div>
            )}

            <Dialog open={showBreakdown} onOpenChange={setShowBreakdown}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Comment est calcule le classement global ?
                  </DialogTitle>
                  <DialogDescription>
                    Details de la methode utilisee pour classer les joueurs.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-[11px] text-muted-foreground">
                  <p>
                    Chaque joueur recoit un rang dans chacune des categories ci-dessous.
                    Le <span className="text-foreground/80 font-medium">score global est la somme de ces rangs</span> ; un score plus bas signifie un meilleur classement.
                    Les categories non jouees ajoutent une penalite de <span className="text-foreground/80 font-medium">(N+1) points</span> ou N est le nombre de participants dans cette categorie.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-foreground/70 font-medium mb-1.5">Economie</p>
                      <ul className="space-y-0.5 text-muted-foreground/80">
                        <li>Aura</li>
                        <li>Argent</li>
                        <li>Valeur totale (argent + AuraCoin)</li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-foreground/70 font-medium mb-1.5">Jeux - score</p>
                      <ul className="space-y-0.5 text-muted-foreground/80">
                        <li>Doodle Jump, 2048, Flappy Bird</li>
                        <li>Chrome Dino, Crossy Road, Stack Tower</li>
                        <li>Geometry Dash, QS Watermelon, Solitaire, Racer, HexGL</li>
                        <li>Tetris, Knife Hit, Demineur</li>
                        <li>Fruit Ninja, Goyave Empire, Sudoku</li>
                        <li>Casino (gain max)</li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-foreground/70 font-medium mb-1.5">Jeux - victoires</p>
                      <ul className="space-y-0.5 text-muted-foreground/80">
                        <li>Echecs, Petit Bac, Puissance 4</li>
                        <li>Arene des balles, Poker, Bataille Navale</li>
                        <li>Roulette Russe, Uno, Morpion</li>
                        <li>Bombe de mots</li>
                      </ul>
                      <p className="text-foreground/70 font-medium mb-1.5 mt-3">Divers</p>
                      <ul className="space-y-0.5 text-muted-foreground/80">
                        <li>Parties jouees (tous jeux)</li>
                        <li>Polymarket (ratio V/D)</li>
                        <li>Pertes Casino (totales)</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-muted-foreground/50 text-[10px]">Mis a jour automatiquement toutes les 15 minutes.</p>
                </div>
              </DialogContent>
            </Dialog>

            {activeView !== 'nombres' && PERIOD_CATEGORIES.has(category) && (
              <div className="flex gap-1">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPeriod(opt.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      period === opt.id
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {activeView === 'nombres' ? (
              nombresLoading ? (
                <TableSkeleton rows={3} />
              ) : nombresSections.length === 0 ? (
                <div className="py-12" />
              ) : (
                <div className="space-y-8">
                  {nombresSections.map((section) => (
                    <div key={section.title} className="space-y-3">
                      <h3 className={cn(TYPOGRAPHY.XS, "text-muted-foreground/60 font-medium")}>
                        {section.title}
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {section.items.map((item) => (
                          <Card key={item.label}>
                            <CardContent className="p-4 md:p-5 space-y-2">
                              <p className={cn(TYPOGRAPHY.H2, "md:text-4xl tabular-nums")}>{item.value}</p>
                              <p className={TYPOGRAPHY.SMALL}>{item.label}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                {loading ? (
                  <TableSkeleton rows={8} />
                ) : rankings.length === 0 ? (
                  <div className="py-12" />
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border/30">
                        {rankings.map((ranking) => (
                          <div
                            key={ranking.userId}
                            className={cn(
                              "group flex items-center justify-between py-4 px-6",
                              ranking.userId === user?.id && "bg-muted/30"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <span className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground w-8 tabular-nums shrink-0")}>
                                {ranking.rank}
                              </span>
                              <PlayerHoverCard
                                userId={ranking.userId}
                                username={ranking.username}
                                usernameColor={ranking.usernameColor}
                                clanTag={toClanTagData(ranking.clanTag)}
                                className={cn(TYPOGRAPHY.BODY, "font-medium", ranking.userId === user?.id && "text-foreground")}
                              >
                                <UsernameDisplay 
                                  username={ranking.username} 
                                  userId={ranking.userId}
                                  usernameColor={ranking.usernameColor} 
                                  badges={ranking.badges}
                                  clanTag={toClanTagData(ranking.clanTag)}
                                  clickable={true}
                                  badgeSize="xs"
                                />
                              </PlayerHoverCard>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn("tabular-nums", TYPOGRAPHY.MUTED)}>
                                {formatValue(ranking)}
                              </span>
                              {user?.isAdmin && deletableGameCategories[category] && (
                                <Button
                                  variant="ghost"
                                  onClick={() => handleDeleteScore(ranking.userId, ranking.username)}
                                  className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                  title="Supprimer ce score"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
          </ScrollArea>
      </div>
    </PageShell>
  );
}
