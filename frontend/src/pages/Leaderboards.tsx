import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { leaderboardsApi } from '../services/api';
import { cn } from '@/lib/utils';

interface Ranking {
  rank: number;
  userId: string;
  username: string;
  value: number;
  wins?: number;
  totalPlayed?: number;
}

type Category = 'aura' | 'money' | 'doodle_jump' | 'solitaire' | 'casino' | 'games_played';

const categories: { id: Category; name: string; valueLabel: string }[] = [
  { id: 'aura', name: 'Aura', valueLabel: 'aura' },
  { id: 'money', name: 'Money', valueLabel: '$' },
  { id: 'doodle_jump', name: 'Doodle Jump', valueLabel: 'score' },
  { id: 'solitaire', name: 'Solitaire', valueLabel: '%' },
  { id: 'casino', name: 'Casino', valueLabel: '$' },
  { id: 'games_played', name: 'Parties', valueLabel: 'jeux' },
];

export default function Leaderboards() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>('aura');
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRankings();
  }, [category]);

  const fetchRankings = async () => {
    try {
      setLoading(true);
      const response = await leaderboardsApi.get(category, { limit: 50 });
      setRankings(response.data.rankings);
      setUserRank(response.data.userRank);
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (ranking: Ranking) => {
    switch (category) {
      case 'money':
      case 'casino':
        return `$${ranking.value.toLocaleString()}`;
      case 'solitaire':
        return `${ranking.value}%`;
      default:
        return ranking.value.toLocaleString();
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Compétition
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Classement
            </h1>
          </div>
          {userRank && (
            <div className="text-right text-sm text-muted-foreground tabular-nums">
              #{userRank}
            </div>
          )}
        </div>
      </header>

      {/* Category Selector */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={cn(
              "px-4 py-2 text-sm border transition-colors",
              category === cat.id
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Rankings */}
      <section>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
          </div>
        ) : rankings.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            Aucun classement pour le moment
          </p>
        ) : (
          <div className="space-y-0">
            {rankings.map((ranking) => (
              <div
                key={ranking.userId}
                className={cn(
                  "flex items-center justify-between py-4 border-b border-border/30 last:border-0",
                  ranking.userId === user?.id && "bg-muted/30 -mx-4 px-4"
                )}
              >
                <div className="flex items-center gap-6">
                  <span className="text-muted-foreground text-sm w-8 tabular-nums">
                    {ranking.rank}
                  </span>
                  <span className={cn(
                    "font-medium",
                    ranking.userId === user?.id && "text-foreground"
                  )}>
                    {ranking.username}
                    {ranking.userId === user?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(toi)</span>
                    )}
                  </span>
                </div>
                <span className="tabular-nums text-muted-foreground">
                  {formatValue(ranking)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
