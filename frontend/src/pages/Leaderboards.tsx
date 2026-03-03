import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auraCoinApi, AuraCoinLeaderboardEntry, gamesApi, leaderboardsApi, clansApi, usersApi } from '../services/api';
import { X, Zap, DollarSign, TrendingUp, Gem, ArrowUp, Skull, Layers, Wind, Diamond, Timer, LayoutGrid, Sparkles, TrendingDown, Flame, Gamepad2, Hash } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';
import { UsernameDisplay } from '@/components/ui/username-display';

interface Ranking {
  rank: number;
  userId: string;
  username: string;
  usernameColor?: string | null;
  value: number;
  moneyValue?: number;
  wins?: number;
  totalPlayed?: number;
}

type StatItem = { label: string; value: string; hint?: string };
type StatSection = { title: string; items: StatItem[] };

type Category = 'aura' | 'money' | 'total_money' | 'auracoin' | 'doodle_jump' | 'doodle_jump_mort_subite' | 'game_2048' | 'flappy_bird' | 'solitaire' | 'racer' | 'tetris' | 'casino' | 'casino_losses' | 'games_played' | 'bombparty';
type View = Category | 'nombres';

const categories: { id: Category; name: string; valueLabel: string; icon: typeof Zap }[] = [
  { id: 'aura', name: 'Aura', valueLabel: 'aura', icon: Zap },
  { id: 'money', name: 'Argent', valueLabel: '$', icon: DollarSign },
  { id: 'total_money', name: 'Argent total', valueLabel: '$', icon: TrendingUp },
  { id: 'auracoin', name: 'Aura Coin', valueLabel: 'AC', icon: Gem },
  { id: 'doodle_jump', name: 'Doodle Jump', valueLabel: 'score', icon: ArrowUp },
  { id: 'doodle_jump_mort_subite', name: 'Doodle Jump - Mort subite', valueLabel: 'score', icon: Skull },
  { id: 'game_2048', name: '2048', valueLabel: 'score', icon: Layers },
  { id: 'flappy_bird', name: 'Flappy Bird', valueLabel: 'score', icon: Wind },
  { id: 'solitaire', name: 'Solitaire', valueLabel: 'score', icon: Diamond },
  { id: 'racer', name: 'Racer', valueLabel: 'temps', icon: Timer },
  { id: 'tetris', name: 'Tetris', valueLabel: 'score', icon: LayoutGrid },
  { id: 'casino', name: 'Gains Casino (partie unique)', valueLabel: '$', icon: Sparkles },
  { id: 'casino_losses', name: 'Pertes Casino (totales)', valueLabel: '$', icon: TrendingDown },
  { id: 'bombparty', name: 'Bomb Party', valueLabel: 'victoires', icon: Flame },
  { id: 'games_played', name: 'Parties', valueLabel: 'jeux', icon: Gamepad2 },
];

const economyCategories: Category[] = ['aura', 'money', 'total_money', 'auracoin'];
const gameCategories: Category[] = ['doodle_jump', 'doodle_jump_mort_subite', 'game_2048', 'flappy_bird', 'solitaire', 'racer', 'tetris', 'casino', 'casino_losses', 'bombparty', 'games_played'];
const deletableGameCategories: Partial<Record<Category, string>> = {
  doodle_jump: 'doodle_jump',
  doodle_jump_mort_subite: 'doodle_jump_mort_subite',
  game_2048: 'game_2048',
  flappy_bird: 'flappy_bird',
  solitaire: 'solitaire',
  racer: 'racer',
  tetris: 'tetris',
  casino: 'casino',
};

const gamesCatalog = ['Doodle Jump', '2048', 'Flappy Bird', 'Casino', 'Bomb Party', 'Poker', 'Petit Bac', 'Bataille Navale', 'Solitaire', 'Racer', 'Tetris', 'Polymarket'];

const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const formatMoney = (value: number, digits = 0) => `$${formatNumber(value, digits)}`;

export default function Leaderboards() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<View>('aura');
  const category: Category = activeView === 'nombres' ? 'aura' : activeView as Category;

  // Rankings state
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Nombres state
  const [nombresSections, setNombresSections] = useState<StatSection[]>([]);
  const [nombresLoading, setNombresLoading] = useState(false);

  useEffect(() => {
    if (activeView !== 'nombres') {
      fetchRankings();
    }
  }, [activeView]);

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
      } else {
        const response = await leaderboardsApi.get(category, { limit: 50 });
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
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds - minutes * 60);
    const tenths = Math.floor(10 * (seconds - Math.floor(seconds)));
    if (minutes > 0) {
      return `${minutes}.${secs < 10 ? '0' : ''}${secs}.${tenths}`;
    } else {
      return `${secs}.${tenths}`;
    }
  };

  const formatValue = (ranking: Ranking) => {
    const numericValue = typeof ranking.value === 'number' ? ranking.value : Number(ranking.value);
    switch (category) {
      case 'auracoin':
        return `${numericValue.toFixed(4)} AC • ≈ $${(ranking.moneyValue || 0).toFixed(2)}`;
      case 'total_money':
        return `$${numericValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'money':
      case 'casino':
        return `$${numericValue.toLocaleString()}`;
      case 'casino_losses':
        return `-$${numericValue.toLocaleString()}`;
      case 'racer':
        return formatTime(numericValue);
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
      <div className={SPACING.PAGE_CONTENT}>
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Sidebar */}
          <Card className="h-fit">
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
                <p className={cn(TYPOGRAPHY.XS, "px-3 pb-1 text-muted-foreground/50 font-medium tracking-wider")}>
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
                <p className={cn(TYPOGRAPHY.XS, "px-3 pb-1 text-muted-foreground/50 font-medium tracking-wider")}>
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
          </Card>

          {/* Main content */}
          <div className="space-y-4">
            <h2 className={TYPOGRAPHY.H3}>{activeTitle}</h2>

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
                      <h3 className={cn(TYPOGRAPHY.XS, "text-muted-foreground/60 font-medium tracking-wider")}>
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
                            <div className="flex items-center gap-6">
                              <span className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground w-8 tabular-nums")}>
                                {ranking.rank}
                              </span>
                              <span className={cn(
                                TYPOGRAPHY.BODY,
                                "font-medium",
                                ranking.userId === user?.id && "text-foreground"
                              )}>
                                <UsernameDisplay username={ranking.username} usernameColor={ranking.usernameColor} />
                              </span>
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
        </div>
      </div>
    </PageShell>
  );
}
