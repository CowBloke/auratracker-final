import { Link } from 'react-router-dom';

const games = [
  {
    id: 'bomb-party',
    name: 'Bomb Party',
    description: 'Trouve des mots contenant les lettres avant que la bombe explose.',
    type: 'Party',
    requiresParty: true,
    image: '/images/games/bombparty.png',
  },
  {
    id: 'poker',
    name: 'Poker',
    description: "Hold'em minimaliste en party, blindes fixes et rounds rapides.",
    type: 'Party',
    requiresParty: true,
    image: '/images/games/poker.png',
  },
  {
    id: 'petit-bac',
    name: 'Petit Bac',
    description: 'Remplis les categories avec la bonne lettre avant la fin du temps.',
    type: 'Party',
    requiresParty: true,
    image: '/images/games/petitbac.png',
  },
  {
    id: 'russian-roulette',
    name: 'Roulette Russe',
    description: '1/6 chance de perdre à chaque tour. Le dernier survivant gagne.',
    type: 'Party',
    requiresParty: true,
    image: '/images/games/russianroulette.png',
  },
  {
    id: 'bataille-navale',
    name: 'Bataille Navale',
    description: 'Place tes bateaux et coule ceux de ton adversaire.',
    type: 'Duel',
    requiresParty: true,
    image: '/images/games/bataillenavale.png',
  },
  {
    id: 'clash',
    name: 'Clash',
    description: 'Construis ta base, entraîne des troupes, attaque tes ennemis.',
    type: 'PvP',
    image: '/images/games/clash.png',
  },
  {
    id: 'doodle-jump',
    name: 'Doodle Jump',
    description: 'Saute le plus haut possible pour gagner des récompenses.',
    type: 'Score',
    image: '/images/games/doodlejump.png',
  },
  {
    id: 'game-2048',
    name: '2048',
    description: 'Fusionne les tuiles pour atteindre 2048 et gagner des récompenses.',
    type: 'Score',
    image: '/images/games/2048.png', // Placeholder, peut être remplacé plus tard
  },
  {
    id: 'flappy-bird',
    name: 'Flappy Bird',
    description: 'Évite les tuyaux et survole le plus loin possible pour gagner des récompenses.',
    type: 'Score',
    image: '/images/games/flappybird.png', // Placeholder, peut être remplacé plus tard
  },
  {
    id: 'casino',
    name: 'Casino',
    description: 'Choisis entre machine à sous et roulette animée.',
    type: 'Chance',
    image: '/images/games/casino.png',
  },
  {
    id: 'market',
    name: 'Salle de marche',
    description: 'Investis sur plusieurs cryptos avec une interface pro.',
    type: 'Trading',
    image: '/images/games/market.png',
  },
  {
    id: 'aura-coin',
    name: 'Aura Coin',
    description: 'Trade la cryptomonnaie virtuelle. Achète bas, vends haut.',
    type: 'Trading',
    image: '/images/games/auracoin.png',
  },
  {
    id: 'solitaire',
    name: 'Solitaire',
    description: 'Le classique jeu de cartes. Empile les cartes pour gagner.',
    type: 'Score',
    image: '/images/games/solitaire.png',
  },
];

export default function Games() {
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
  if (game.id === 'russian-roulette') {
    return '/games/russian-roulette';
  }
  if (game.id === 'bataille-navale') {
    return '/games/bataille-navale';
  }
  if (game.id === 'game-2048') {
    return '/games/2048';
  }
  if (game.id === 'flappy-bird') {
    return '/games/flappy-bird';
  }
  if (game.id === 'solitaire') {
    return '/games/solitaire';
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

      {/* Games Grid */}
      <section className="space-y-10">
        <div className="space-y-2">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Multijoueur
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {multiplayerGames.map((game) => (
              <Link
                key={game.id}
                to={getGameLink(game)}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-border/40 bg-card text-card-foreground shadow-sm transition hover:-translate-y-1 hover:border-foreground/40 hover:shadow-lg"
              >
                <img
                  src={game.image}
                  alt={game.name}
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="relative z-10 flex h-full flex-col justify-end p-5 text-white">
                  <h3 className="text-xl font-semibold">{game.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Solo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {soloGames.map((game) => (
              <Link
                key={game.id}
                to={getGameLink(game)}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-border/40 bg-card text-card-foreground shadow-sm transition hover:-translate-y-1 hover:border-foreground/40 hover:shadow-lg"
              >
                <img
                  src={game.image}
                  alt={game.name}
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="relative z-10 flex h-full flex-col justify-end p-5 text-white">
                  <h3 className="text-xl font-semibold">{game.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
