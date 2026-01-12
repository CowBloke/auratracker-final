import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const games = [
  {
    id: 'clash',
    name: 'Clash',
    description: 'Construis ta base, entraîne des troupes, attaque tes ennemis.',
    type: 'PvP',
  },
  {
    id: 'doodle-jump',
    name: 'Doodle Jump',
    description: 'Saute le plus haut possible pour gagner des récompenses.',
    type: 'Score',
  },
  {
    id: 'solitaire',
    name: 'Solitaire',
    description: 'Le classique Klondike. Gagne pour obtenir aura et money.',
    type: 'Victoire',
  },
  {
    id: 'casino',
    name: 'Casino',
    description: 'Tente ta chance aux machines à sous.',
    type: 'Chance',
  },
];

export default function Games() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Jouer
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Jeux
            </h1>
          </div>
        </div>
      </header>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Games List */}
      <section className="space-y-0">
        {games.map((game) => (
          <Link
            key={game.id}
            to={`/games/${game.id}`}
            className="group flex items-center justify-between py-6 border-b border-border/30 hover:border-foreground/30 transition-colors"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-medium group-hover:text-foreground transition-colors">
                  {game.name}
                </h2>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {game.type}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {game.description}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </section>
    </div>
  );
}
