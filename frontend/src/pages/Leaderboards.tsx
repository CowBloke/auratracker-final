import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auraCoinApi, AuraCoinLeaderboardEntry, leaderboardsApi } from '../services/api';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';

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

export default function Leaderboards() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>('aura');
  const [activeTab, setActiveTab] = useState<'economy' | 'games'>('economy');
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const navItems = useMemo(() => ([
    { to: '/leaderboards', label: 'Classements', end: true },
    { to: '/leaderboards/nombres', label: 'Nombres' },
  ]), []);

  // Update activeTab when category changes
  useEffect(() => {
    if (economyCategories.includes(category)) {
      setActiveTab('economy');
    } else if (gameCategories.includes(category)) {
      setActiveTab('games');
    }
  }, [category]);

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

  return (
    <PageShell>
      <div className={SPACING.PAGE_CONTENT}>
        {userRank ? (
          <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground tabular-nums")}>
            Position personnelle #{userRank}
          </p>
        ) : null}

        {/* Navigation */}
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  buttonVariants({
                    variant: isActive ? 'secondary' : 'outline',
                    size: 'sm',
                  }),
                  'h-9'
                )}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'economy' | 'games')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="economy">Économie</TabsTrigger>
            <TabsTrigger value="games">Jeux</TabsTrigger>
          </TabsList>

          <TabsContent value="economy" className={SPACING.SECTION_SPACING}>
            <div className="flex flex-wrap gap-2">
              {categories
                .filter((cat) => economyCategories.includes(cat.id))
                .map((cat) => (
                  <Button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    variant={category === cat.id ? 'secondary' : 'outline'}
                    size="sm"
                  >
                    {cat.name}
                  </Button>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="games" className={SPACING.SECTION_SPACING}>
            <div className="flex flex-wrap gap-2">
              {categories
                .filter((cat) => gameCategories.includes(cat.id))
                .map((cat) => (
                  <Button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    variant={category === cat.id ? 'secondary' : 'outline'}
                    size="sm"
                  >
                    {cat.name}
                  </Button>
                ))}
            </div>
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
                        "flex items-center justify-between py-4 px-6",
                        ranking.userId === user?.id && "bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-6">
                        <span className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground w-8 tabular-nums")}>
                          {ranking.rank}
                        </span>
                        <span 
                          className={cn(
                            TYPOGRAPHY.BODY,
                            "font-medium",
                            ranking.userId === user?.id && "text-foreground"
                          )}
                          style={ranking.usernameColor ? { color: ranking.usernameColor } : undefined}
                        >
                          {ranking.username}
                          {ranking.userId === user?.id && (
                            <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground ml-2")}>(toi)</span>
                          )}
                        </span>
                      </div>
                      <span className={cn("tabular-nums", TYPOGRAPHY.MUTED)}>
                        {formatValue(ranking)}
                      </span>
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
