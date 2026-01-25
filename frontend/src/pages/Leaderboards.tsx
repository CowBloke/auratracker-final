import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auraCoinApi, AuraCoinLeaderboardEntry, leaderboardsApi } from '../services/api';
import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';

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

type Category = 'aura' | 'money' | 'total_money' | 'auracoin' | 'doodle_jump' | 'game_2048' | 'flappy_bird' | 'solitaire' | 'casino' | 'casino_losses' | 'games_played' | 'bombparty';

const categories: { id: Category; name: string; valueLabel: string }[] = [
  { id: 'aura', name: 'Aura', valueLabel: 'aura' },
  { id: 'money', name: 'Argent', valueLabel: '$' },
  { id: 'total_money', name: 'Argent total', valueLabel: '$' },
  { id: 'auracoin', name: 'Aura Coin', valueLabel: 'AC' },
  { id: 'doodle_jump', name: 'Doodle Jump', valueLabel: 'score' },
  { id: 'game_2048', name: '2048', valueLabel: 'score' },
  { id: 'flappy_bird', name: 'Flappy Bird', valueLabel: 'score' },
  { id: 'solitaire', name: 'Solitaire', valueLabel: 'score' },
  { id: 'casino', name: 'Gains Casino (partie unique)', valueLabel: '$' },
  { id: 'casino_losses', name: 'Pertes Casino (totales)', valueLabel: '$' },
  { id: 'bombparty', name: 'Bomb Party', valueLabel: 'victoires' },
  { id: 'games_played', name: 'Parties', valueLabel: 'jeux' },
];

export default function Leaderboards() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>('aura');
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const navItems = useMemo(() => ([
    { to: '/leaderboards', label: 'Classements', end: true },
    { to: '/leaderboards/nombres', label: 'Nombres' },
  ]), []);

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
      default:
        return numericValue.toLocaleString();
    }
  };

  return (
    <PageLayout variant="compact">
      {userRank && (
        <div className="flex items-center justify-end">
          <div className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground tabular-nums")}>
            #{userRank}
          </div>
        </div>
      )}

      {/* Category Selector */}
      <div className="flex flex-wrap gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cn(
              "px-4 py-2 text-sm border transition-colors rounded-md",
              isActive
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      {/* Category Selector */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={category === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory(cat.id)}
            className={cn(
              category === cat.id
                ? "border-foreground"
                : "border-border/30"
            )}
          >
            {cat.name}
          </Button>
        ))}
      </div>

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
          <Card className="border-border/40">
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
    </PageLayout>
  );
}
