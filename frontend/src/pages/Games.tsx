import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';

const games = [
  {
    id: 'bomb-party',
    name: 'Bomb Party',
    description: 'Trouve des mots contenant les lettres avant que la bombe explose.',
    type: 'Party',
    requiresParty: true,
  },
  {
    id: 'poker',
    name: 'Poker',
    description: "Hold'em minimaliste en party, blindes fixes et rounds rapides.",
    type: 'Party',
    requiresParty: true,
  },
  {
    id: 'petit-bac',
    name: 'Petit Bac',
    description: 'Remplis les categories avec la bonne lettre avant la fin du temps.',
    type: 'Party',
    requiresParty: true,
  },
  {
    id: 'monopoly',
    name: 'Monopoly',
    description: 'Achete, construis et deviens le dernier joueur solvent.',
    type: 'Party',
    requiresParty: true,
  },
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
    id: 'casino',
    name: 'Casino',
    description: 'Choisis entre machine à sous et roulette animée.',
    type: 'Chance',
  },
  {
    id: 'market',
    name: 'Salle de marche',
    description: 'Investis sur plusieurs cryptos avec une interface pro.',
    type: 'Trading',
  },
  {
    id: 'aura-coin',
    name: 'Aura Coin',
    description: 'Trade la cryptomonnaie virtuelle. Achète bas, vends haut.',
    type: 'Trading',
  },
];

export default function Games() {
  const { currentParty } = useSocket();
  const multiplayerGames = games.filter((game) => game.requiresParty);
  const soloGames = games.filter((game) => !game.requiresParty);

  const getGameLink = (game: typeof games[0]) => {
    if (game.id === 'bomb-party') {
      return '/games/bomb-party';
    }
    if (game.id === 'poker') {
      return '/games/poker';
    }
    if (game.id === 'petit-bac') {
      return '/games/petit-bac';
    }
    if (game.id === 'monopoly') {
      return '/games/monopoly';
    }
    return `/games/${game.id}`;
  };

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
      <section className="space-y-10">
        <div className="space-y-2">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Multijoueur
          </h2>
          <div className="space-y-0">
            {multiplayerGames.map((game) => (
              <Link
                key={game.id}
                to={getGameLink(game)}
                className="group flex items-center justify-between py-6 border-b border-border/30 hover:border-foreground/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-medium group-hover:text-foreground transition-colors">
                      {game.name}
                    </h3>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {game.type}
                    </span>
                    {game.requiresParty && currentParty && (
                      <span className="text-xs text-muted-foreground">
                        Party
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {game.description}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Solo
          </h2>
          <div className="space-y-0">
            {soloGames.map((game) => (
              <Link
                key={game.id}
                to={getGameLink(game)}
                className="group flex items-center justify-between py-6 border-b border-border/30 hover:border-foreground/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-medium group-hover:text-foreground transition-colors">
                      {game.name}
                    </h3>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {game.type}
                    </span>
                    {game.requiresParty && currentParty && (
                      <span className="text-xs text-muted-foreground">
                        Party
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {game.description}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
