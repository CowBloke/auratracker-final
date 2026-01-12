import { Link } from 'react-router-dom';
import { Gamepad2, ArrowRight, Star, Trophy, Clock, Swords, TrendingUp, Heart, Coins } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const games = [
  {
    id: 'clash',
    name: 'Clash',
    description: 'Build your base, train troops, and raid enemies! Steal resources and climb the trophy ladder.',
    icon: Swords,
    color: 'accent-orange',
    featured: true,
    rewards: [
      'Steal up to 20% of enemy money',
      'Steal up to 10% of enemy aura',
      'Earn trophies for wins',
    ],
    stats: {
      type: 'PvP',
      players: 'Async',
    },
  },
  {
    id: 'doodle-jump',
    name: 'Doodle Jump',
    description: 'Jump your way to the top! Earn money based on your score and aura for new high scores.',
    icon: TrendingUp,
    color: 'accent-green',
    rewards: [
      'Money: 1 per 10 score',
      'Aura: 50 for new high score',
    ],
    stats: {
      type: 'High Score',
      players: 'Solo',
    },
  },
  {
    id: 'solitaire',
    name: 'Solitaire',
    description: 'Classic Klondike solitaire. Win games to earn money and aura for fast completions.',
    icon: Heart,
    color: 'accent-pink',
    rewards: [
      'Money: 100 per win',
      'Aura: 25 for fast win (<3 min)',
    ],
    stats: {
      type: 'Win/Loss',
      players: 'Solo',
    },
  },
  {
    id: 'casino',
    name: 'Casino Slots',
    description: 'Spin the reels and try your luck! Win big with matching symbols. Bet money to play.',
    icon: Coins,
    color: 'accent-purple',
    rewards: [
      'Win up to 50x your bet',
      'Aura bonus for big wins',
    ],
    stats: {
      type: 'Gambling',
      players: 'Solo',
    },
  },
];

const getColorClasses = (color: string) => {
  const colors: Record<string, string> = {
    'accent-orange': 'from-accent-orange/20 to-accent-orange/5',
    'accent-green': 'from-accent-green/20 to-accent-green/5',
    'accent-pink': 'from-accent-pink/20 to-accent-pink/5',
    'accent-purple': 'from-purple-500/20 to-purple-500/5',
  };
  return colors[color] || colors['accent-orange'];
};

const getBadgeColorClasses = (color: string) => {
  const colors: Record<string, string> = {
    'accent-orange': 'bg-primary/20 text-primary border-primary/30',
    'accent-green': 'bg-primary/20 text-primary border-primary/30',
    'accent-pink': 'bg-secondary/20 text-secondary-foreground border-secondary/30',
    'accent-purple': 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  };
  return colors[color] || colors['accent-orange'];
};

export default function Games() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-primary" />
            Games
          </h1>
          <p className="text-muted-foreground mt-2">
            Play games to earn Aura and Money
          </p>
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {games.map((game) => (
          <Card key={game.id} className="overflow-hidden group">
            {/* Game Header */}
            <div className={cn("h-32 bg-gradient-to-br flex items-center justify-center relative overflow-hidden", getColorClasses(game.color))}>
              <game.icon className="w-20 h-20 text-foreground/80" />
              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>

            {/* Game Info */}
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{game.name}</CardTitle>
                <Badge variant="outline" className={getBadgeColorClasses(game.color)}>
                  {game.stats.players}
                </Badge>
              </div>
              <CardDescription>{game.description}</CardDescription>
            </CardHeader>

            <CardContent>
              {/* Rewards */}
              <div className="space-y-2 mb-6">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" />
                  Rewards
                </p>
                <ul className="space-y-1">
                  {game.rewards.map((reward, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {reward}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4" />
                  <span>{game.stats.type}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>~5 min</span>
                </div>
              </div>

              {/* Play Button */}
              <Button asChild className="w-full" size="lg">
                <Link to={`/games/${game.id}`}>
                  Play Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-muted-foreground">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Trivia', 'Poker', 'Racing', 'Puzzle'].map((game) => (
              <div
                key={game}
                className="p-4 rounded-lg bg-muted border text-center opacity-50"
              >
                <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-muted flex items-center justify-center">
                  <Gamepad2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">{game}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
