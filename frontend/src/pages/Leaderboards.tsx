import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auraCoinApi, AuraCoinLeaderboardEntry, gamesApi, leaderboardsApi } from '../services/api';
import { X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

type Category = 'aura' | 'money' | 'total_money' | 'auracoin' | 'doodle_jump' | 'doodle_jump_mort_subite' | 'game_2048' | 'flappy_bird' | 'solitaire' | 'racer' | 'tetris' | 'casino' | 'casino_losses' | 'games_played' | 'bombparty';

const categories: { id: Category; name: string; valueLabel: string }[] = [
  { id: 'aura', name: 'Aura', valueLabel: 'aura' },
  { id: 'money', name: 'Argent', valueLabel: '$' },
  { id: 'total_money', name: 'Argent total', valueLabel: '$' },
  { id: 'auracoin', name: 'Aura Coin', valueLabel: 'AC' },
  { id: 'doodle_jump', name: 'Doodle Jump', valueLabel: 'score' },
  { id: 'doodle_jump_mort_subite', name: 'Doodle Jump - Mort subite', valueLabel: 'score' },
  { id: 'game_2048', name: '2048', valueLabel: 'score' },
  { id: 'flappy_bird', name: 'Flappy Bird', valueLabel: 'score' },
  { id: 'solitaire', name: 'Solitaire', valueLabel: 'score' },
  { id: 'racer', name: 'Racer', valueLabel: 'temps' },
  { id: 'tetris', name: 'Tetris', valueLabel: 'score' },
  { id: 'casino', name: 'Gains Casino (partie unique)', valueLabel: '$' },
  { id: 'casino_losses', name: 'Pertes Casino (totales)', valueLabel: '$' },
  { id: 'bombparty', name: 'Bomb Party', valueLabel: 'victoires' },
  { id: 'games_played', name: 'Parties', valueLabel: 'jeux' },
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

export default function Leaderboards() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category>('aura');
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const navItems = useMemo(() => ([
    { to: '/leaderboards', label: 'Classements', end: true },
    { to: '/leaderboards/nombres', label: 'Nombres' },
  ]), []);
  const activeTab: 'economy' | 'games' = economyCategories.includes(category) ? 'economy' : 'games';
  const activeNavTab = location.pathname === '/leaderboards/nombres' ? '/leaderboards/nombres' : '/leaderboards';

  useEffect(() => {
    fetchRankings();
  }, [category]);

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

  return (
    <PageShell>
      <div className={SPACING.PAGE_CONTENT}>
        {userRank ? (
          <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground tabular-nums")}>
            Position personnelle #{userRank}
          </p>
        ) : null}

        {/* Navigation */}
        <Tabs value={activeNavTab} onValueChange={(value) => navigate(value)}>
          <TabsList className="h-auto flex-wrap">
            {navItems.map((item) => (
              <TabsTrigger key={item.to} value={item.to}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Category Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (value === 'economy' && !economyCategories.includes(category)) {
              setCategory(economyCategories[0]);
            }

            if (value === 'games' && !gameCategories.includes(category)) {
              setCategory(gameCategories[0]);
            }
          }}
        >
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="economy">Économie</TabsTrigger>
            <TabsTrigger value="games">Jeux</TabsTrigger>
          </TabsList>

          <TabsContent value="economy" className={SPACING.SECTION_SPACING}>
            <Tabs value={category} onValueChange={(value) => setCategory(value as Category)}>
              <TabsList className="h-auto flex-wrap">
                {categories
                  .filter((cat) => economyCategories.includes(cat.id))
                  .map((cat) => (
                    <TabsTrigger key={cat.id} value={cat.id}>
                      {cat.name}
                    </TabsTrigger>
                  ))}
              </TabsList>
            </Tabs>
          </TabsContent>

          <TabsContent value="games" className={SPACING.SECTION_SPACING}>
            <Tabs value={category} onValueChange={(value) => setCategory(value as Category)}>
              <TabsList className="h-auto flex-wrap">
                {categories
                  .filter((cat) => gameCategories.includes(cat.id))
                  .map((cat) => (
                    <TabsTrigger key={cat.id} value={cat.id}>
                      {cat.name}
                    </TabsTrigger>
                  ))}
              </TabsList>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Rankings */}
        <div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : rankings.length === 0 ? (
            <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
              Aucun classement pour le moment
            </p>
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
                          {ranking.userId === user?.id && (
                            <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground ml-2")}>(toi)</span>
                          )}
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
        </div>
      </div>
    </PageShell>
  );
}
