import { Link } from 'react-router-dom';
import { Gamepad2, ArrowRight, Star, Trophy, Clock } from 'lucide-react';

const games = [
  {
    id: 'doodle-jump',
    name: 'Doodle Jump',
    description: 'Jump your way to the top! Earn money based on your score and aura for new high scores.',
    image: '🦘',
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
    image: '🃏',
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
];

export default function Games() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-primary" />
            Games
          </h1>
          <p className="text-gray-400 mt-2">
            Play games to earn Aura and Money
          </p>
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {games.map((game) => (
          <div key={game.id} className="card overflow-hidden group">
            {/* Game Header */}
            <div className={`h-32 bg-gradient-to-br from-${game.color}/20 to-${game.color}/5 flex items-center justify-center relative overflow-hidden`}>
              <span className="text-7xl">{game.image}</span>
              <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
            </div>

            {/* Game Info */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-bold">{game.name}</h2>
                <div className="flex items-center gap-2">
                  <span className={`badge bg-${game.color}/20 text-${game.color}`}>
                    {game.stats.players}
                  </span>
                </div>
              </div>

              <p className="text-gray-400 mb-4">{game.description}</p>

              {/* Rewards */}
              <div className="space-y-2 mb-6">
                <p className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Star className="w-4 h-4 text-money" />
                  Rewards
                </p>
                <ul className="space-y-1">
                  {game.rewards.map((reward, index) => (
                    <li key={index} className="text-sm text-gray-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {reward}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-6 text-sm text-gray-400">
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
              <Link
                to={`/games/${game.id}`}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 group-hover:shadow-lg transition-shadow"
              >
                Play Now
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Coming Soon */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-400">Coming Soon</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Trivia', 'Poker', 'Racing', 'Puzzle'].map((game) => (
            <div
              key={game}
              className="p-4 rounded-lg bg-background/50 border border-gray-700/50 text-center opacity-50"
            >
              <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-gray-700/50 flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-gray-500" />
              </div>
              <p className="font-medium text-gray-400">{game}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
