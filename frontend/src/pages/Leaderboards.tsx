import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { leaderboardsApi } from '../services/api';
import { Trophy, Sparkles, Coins, Gamepad2, Medal, Crown, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

const categories: { id: Category; name: string; icon: React.ReactNode; valueLabel: string }[] = [
  { id: 'aura', name: 'Aura', icon: <Sparkles className="w-5 h-5" />, valueLabel: 'Aura' },
  { id: 'money', name: 'Money', icon: <Coins className="w-5 h-5" />, valueLabel: 'Money' },
  { id: 'doodle_jump', name: 'Doodle Jump', icon: <Gamepad2 className="w-5 h-5" />, valueLabel: 'High Score' },
  { id: 'solitaire', name: 'Solitaire', icon: <Medal className="w-5 h-5" />, valueLabel: 'Win Rate' },
  { id: 'casino', name: 'Casino', icon: <DollarSign className="w-5 h-5" />, valueLabel: 'Best Win' },
  { id: 'games_played', name: 'Most Active', icon: <Trophy className="w-5 h-5" />, valueLabel: 'Games' },
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
        return `$${ranking.value.toLocaleString()}`;
      case 'casino':
        return `$${ranking.value.toLocaleString()}`;
      case 'solitaire':
        return `${ranking.value}%`;
      default:
        return ranking.value.toLocaleString();
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-muted-foreground" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-500" />;
      default:
        return null;
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 2:
        return 'bg-muted border-muted-foreground/30';
      case 3:
        return 'bg-orange-500/10 border-orange-500/30';
      default:
        return 'bg-muted/50 border-transparent';
    }
  };

  const currentCategory = categories.find((c) => c.id === category)!;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Trophy className="w-8 h-8 text-primary" />
          Leaderboards
        </h1>
        <p className="text-muted-foreground mt-2">
          See how you rank against other players
        </p>
      </div>

      {/* Category Tabs */}
      <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
        <TabsList className="flex flex-wrap">
          {categories.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className="flex items-center gap-2">
              {cat.icon}
              {cat.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* User Rank Card */}
      {userRank && (
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">#{userRank}</span>
                </div>
                <div>
                  <p className="font-medium">Your Rank</p>
                  <p className="text-sm text-muted-foreground">in {currentCategory.name}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rankings Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Skeleton className="h-8 w-8" />
            </div>
          ) : rankings.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-bold text-muted-foreground mb-2">No Rankings Yet</h2>
              <p className="text-muted-foreground">Be the first to claim the top spot!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px] text-center">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">{currentCategory.valueLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((ranking) => (
                  <TableRow
                    key={ranking.userId}
                    className={cn(
                      "border-l-4",
                      ranking.userId === user?.id
                        ? 'bg-primary/10 border-l-primary'
                        : getRankStyle(ranking.rank)
                    )}
                  >
                    <TableCell className="text-center">
                      {getRankIcon(ranking.rank) || (
                        <span className="text-lg font-bold text-muted-foreground">
                          {ranking.rank}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {ranking.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className={cn("font-medium", ranking.userId === user?.id && 'text-primary')}>
                            {ranking.username}
                            {ranking.userId === user?.id && (
                              <span className="ml-2 text-xs text-primary">(You)</span>
                            )}
                          </p>
                          {category === 'solitaire' && ranking.wins !== undefined && (
                            <p className="text-xs text-muted-foreground">
                              {ranking.wins} wins / {ranking.totalPlayed} games
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "text-lg font-bold",
                          category === 'aura' && 'text-primary',
                          (category === 'money' || category === 'casino') && 'text-primary',
                          category !== 'aura' && category !== 'money' && category !== 'casino' && 'text-primary-foreground'
                        )}
                      >
                        {formatValue(ranking)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
