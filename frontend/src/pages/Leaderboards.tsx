import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auraCoinApi, AuraCoinLeaderboardEntry, gamesApi, leaderboardsApi, clansApi, usersApi } from '../services/api';
import { X, Zap, DollarSign, TrendingUp, Gem, ArrowUp, Skull, Layers, Wind, Diamond, Timer, LayoutGrid, Sparkles, TrendingDown, Flame, Gamepad2, Hash, Target, Bomb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';
import { UsernameDisplay } from '@/components/ui/username-display';
import { toClanTagData } from '@/components/clans/ClanTag';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserBadges, BadgeData } from '@/components/badges/UserBadges';
import { PlayerHoverCard } from '@/components/ui/player-hover-card';

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

type Category = 'aura' | 'money' | 'total_money' | 'auracoin' | 'doodle_jump' | 'doodle_jump_mort_subite' | 'game_2048' | 'flappy_bird' | 'chrome_dino' | 'stack_tower' | 'geometry_dash' | 'qs_watermelon' | 'solitaire' | 'racer' | 'tetris' | 'knife_hit' | 'minesweeper' | 'fruit_ninja' | 'goyave_empire' | 'logic_lab' | 'casino' | 'casino_losses' | 'chess' | 'petit_bac' | 'puissance_4' | 'jackpot_5' | 'ball_arena' | 'poker' | 'battleship' | 'russian_roulette' | 'levier_infernal' | 'uno' | 'morpion' | 'polymarket_ratio' | 'games_played' | 'bombparty';
type View = Category | 'nombres';
type Period = 'all' | 'monthly' | 'weekly' | 'daily';

const PERIOD_CATEGORIES = new Set<Category>([
  'doodle_jump', 'doodle_jump_mort_subite', 'game_2048', 'flappy_bird',
  'chrome_dino', 'solitaire', 'racer', 'tetris', 'knife_hit', 'minesweeper', 'casino',
]);

const PERIOD_OPTIONS: { id: Period; label: string }[] = [
  { id: 'all', label: 'Tout le temps' },
  { id: 'monthly', label: 'Ce mois' },
  { id: 'weekly', label: 'Cette semaine' },
  { id: 'daily', label: "Aujourd'hui" },
];

const categories: { id: Category; name: string; valueLabel: string; icon: typeof Zap }[] = [
  { id: 'aura', name: 'Aura', valueLabel: 'aura', icon: Zap },
  { id: 'money', name: 'Argent', valueLabel: '$', icon: DollarSign },
  { id: 'total_money', name: 'Argent total', valueLabel: '$', icon: TrendingUp },
  { id: 'auracoin', name: 'Aura Coin', valueLabel: 'AuraCoin', icon: Gem },
  { id: 'doodle_jump', name: 'Doodle Jump', valueLabel: 'score', icon: ArrowUp },
  { id: 'doodle_jump_mort_subite', name: 'Doodle Jump - Mort subite', valueLabel: 'score', icon: Skull },
  { id: 'game_2048', name: '2048', valueLabel: 'score', icon: Layers },
  { id: 'flappy_bird', name: 'Flappy Bird', valueLabel: 'score', icon: Wind },
  { id: 'chrome_dino', name: 'Chrome Dino', valueLabel: 'score', icon: Gamepad2 },
  { id: 'stack_tower', name: 'Stack Tower', valueLabel: 'score', icon: Layers },
  { id: 'geometry_dash', name: 'Geometry Dash', valueLabel: 'score', icon: ArrowUp },
  { id: 'qs_watermelon', name: 'QS Watermelon', valueLabel: 'score', icon: Sparkles },
  { id: 'solitaire', name: 'Solitaire', valueLabel: 'score', icon: Diamond },
  { id: 'racer', name: 'Racer', valueLabel: 'temps', icon: Timer },
  { id: 'tetris', name: 'Tetris', valueLabel: 'score', icon: LayoutGrid },
  { id: 'knife_hit', name: 'Knife Hit', valueLabel: 'score', icon: Target },
  { id: 'minesweeper', name: 'Démineur', valueLabel: 'score', icon: Bomb },
  { id: 'fruit_ninja', name: 'Fruit Ninja', valueLabel: 'score', icon: Target },
  { id: 'goyave_empire', name: 'Goyave Empire', valueLabel: 'score', icon: Flame },
  { id: 'logic_lab', name: 'Sudoku', valueLabel: 'score', icon: Hash },
  { id: 'casino', name: 'Gains Casino (partie unique)', valueLabel: '$', icon: Sparkles },
  { id: 'casino_losses', name: 'Pertes Casino (totales)', valueLabel: '$', icon: TrendingDown },
  { id: 'chess', name: 'Échecs', valueLabel: 'victoires', icon: Hash },
  { id: 'petit_bac', name: 'Petit Bac', valueLabel: 'victoires', icon: Sparkles },
  { id: 'puissance_4', name: 'Puissance 4', valueLabel: 'victoires', icon: Layers },
  { id: 'jackpot_5', name: 'Jackpot 5', valueLabel: 'victoires', icon: Gem },
  { id: 'ball_arena', name: 'Ball Arena', valueLabel: 'victoires', icon: Target },
  { id: 'poker', name: 'Poker', valueLabel: 'victoires', icon: Diamond },
  { id: 'battleship', name: 'Bataille Navale', valueLabel: 'victoires', icon: Target },
  { id: 'russian_roulette', name: 'Roulette Russe', valueLabel: 'victoires', icon: Skull },
  { id: 'levier_infernal', name: 'Levier Infernal', valueLabel: 'victoires', icon: Zap },
  { id: 'uno', name: 'Uno', valueLabel: 'victoires', icon: Layers },
  { id: 'morpion', name: 'Morpion', valueLabel: 'victoires', icon: Hash },
  { id: 'polymarket_ratio', name: 'Polymarket', valueLabel: 'ratio', icon: TrendingUp },
  { id: 'bombparty', name: 'Bomb Party', valueLabel: 'victoires', icon: Flame },
  { id: 'games_played', name: 'Parties', valueLabel: 'jeux', icon: Gamepad2 },
];

const economyCategories: Category[] = ['aura', 'money', 'total_money', 'auracoin'];
const gameCategories: Category[] = ['doodle_jump', 'doodle_jump_mort_subite', 'game_2048', 'flappy_bird', 'chrome_dino', 'stack_tower', 'geometry_dash', 'qs_watermelon', 'solitaire', 'racer', 'tetris', 'knife_hit', 'minesweeper', 'fruit_ninja', 'goyave_empire', 'logic_lab', 'casino', 'casino_losses', 'chess', 'petit_bac', 'puissance_4', 'jackpot_5', 'ball_arena', 'poker', 'battleship', 'russian_roulette', 'levier_infernal', 'uno', 'morpion', 'polymarket_ratio', 'bombparty', 'games_played'];
const genericGameCategories: Category[] = ['stack_tower', 'geometry_dash', 'qs_watermelon', 'fruit_ninja', 'goyave_empire', 'logic_lab'];
const deletableGameCategories: Partial<Record<Category, string>> = {
  doodle_jump: 'doodle_jump',
  doodle_jump_mort_subite: 'doodle_jump_mort_subite',
  game_2048: 'game_2048',
  flappy_bird: 'flappy_bird',
  chrome_dino: 'chrome_dino',
  stack_tower: 'stack_tower',
  geometry_dash: 'geometry_dash',
  qs_watermelon: 'qs_watermelon',
  solitaire: 'solitaire',
  racer: 'racer',
  tetris: 'tetris',
  knife_hit: 'knife_hit',
  minesweeper: 'minesweeper',
  fruit_ninja: 'fruit_ninja',
  goyave_empire: 'goyave_empire',
  logic_lab: 'logic_lab',
  casino: 'casino',
  chess: 'chess',
  petit_bac: 'petit_bac',
  puissance_4: 'puissance_4',
  jackpot_5: 'jackpot_5',
  ball_arena: 'ball_arena',
  poker: 'poker',
  battleship: 'battleship',
  russian_roulette: 'russian_roulette',
  levier_infernal: 'levier_infernal',
  uno: 'uno',
  morpion: 'morpion',
};

const gamesCatalog = ['Doodle Jump', 'Démineur', '2048', 'Flappy Bird', 'Chrome Dino', 'Stack Tower', 'Geometry Dash', 'Fruit Ninja', 'Goyave Empire', 'Sudoku', 'Casino', 'Bomb Party', 'Poker', 'Petit Bac', 'Bataille Navale', 'Solitaire', 'Racer', 'Tetris', 'Knife Hit', 'Polymarket', 'Échecs', 'Puissance 4', 'Jackpot 5', 'Ball Arena', 'Roulette Russe', 'Levier Infernal', 'Uno', 'Morpion'];

const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const formatMoney = (value: number, digits = 0) => `$${formatNumber(value, digits)}`;

export default function Leaderboards() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<View>('aura');
  const [period, setPeriod] = useState<Period>('all');
  const category: Category = activeView === 'nombres' ? 'aura' : activeView as Category;

  // Rankings state
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Nombres state
  const [nombresSections, setNombresSections] = useState<StatSection[]>([]);
  const [nombresLoading, setNombresLoading] = useState(false);

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
      case 'racer':
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
    if (!confirm(`Supprimer le score de ${username} ?`)) return;

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
              {/* Nombres — special entry */}
              <button
                type="button"
                onClick={() => setActiveView('nombres')}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40",
                  activeView === 'nombres' && "bg-muted"
                )}
              >
                <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className={cn(TYPOGRAPHY.SMALL, activeView === 'nombres' ? "text-foreground" : "text-muted-foreground")}>
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
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveView(cat.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40",
                          activeView === cat.id && "bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className={cn(TYPOGRAPHY.SMALL, activeView === cat.id ? "text-foreground" : "text-muted-foreground")}>
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
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveView(cat.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40",
                          activeView === cat.id && "bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className={cn(TYPOGRAPHY.SMALL, activeView === cat.id ? "text-foreground" : "text-muted-foreground")}>
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
                <div className="flex justify-center py-12">
                  <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
                </div>
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
                  <div className="flex justify-center py-12">
                    <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
                  </div>
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
                              <div className="flex items-center gap-2">
                                {ranking.badges && ranking.badges.length > 0 && (
                                  <UserBadges badges={ranking.badges} size="xs" showEmptySlots={false} tooltipSide="right" />
                                )}
                                <PlayerHoverCard
                                  userId={ranking.userId}
                                  username={ranking.username}
                                  usernameColor={ranking.usernameColor}
                                  clanTag={toClanTagData(ranking.clanTag)}
                                  className={cn(TYPOGRAPHY.BODY, "font-medium", ranking.userId === user?.id && "text-foreground")}
                                >
                                  <UsernameDisplay username={ranking.username} usernameColor={ranking.usernameColor} clanTag={toClanTagData(ranking.clanTag)} />
                                </PlayerHoverCard>
                              </div>
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
