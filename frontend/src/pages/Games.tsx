import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';

type GamesTab = 'singleplayer' | 'multiplayer' | 'daily';

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
    description: 'Construis ta base, entraine des troupes, attaque tes ennemis.',
    type: 'PvP',
    image: '/images/games/clash.png',
  },
  {
    id: 'doodle-jump',
    name: 'Doodle Jump',
    description: 'Saute le plus haut possible pour gagner des recompenses.',
    type: 'Score',
    image: '/images/games/doodlejump.png',
  },
  {
    id: 'game-2048',
    name: '2048',
    description: 'Fusionne les tuiles pour atteindre 2048 et gagner des recompenses.',
    type: 'Score',
    image: '/images/games/2048.png',
  },
  {
    id: 'flappy-bird',
    name: 'Flappy Bird',
    description: 'Evite les tuyaux et survole le plus loin possible pour gagner des recompenses.',
    type: 'Score',
    image: '/images/games/flappybird.png',
  },
  {
    id: 'casino',
    name: 'Casino',
    description: 'Choisis entre machine a sous et roulette animee.',
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
    description: 'Trade la cryptomonnaie virtuelle. Achete bas, vends haut.',
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
  {
    id: 'racer',
    name: 'Racer',
    description: 'Course pseudo-3D style Outrun. Evite les voitures et finis le tour le plus vite possible.',
    type: 'Score',
    image: '/images/games/racer.png',
  },
  {
    id: 'tetris',
    name: 'Tetris',
    description: 'Le classique jeu de puzzle. Empile les pieces et complete des lignes pour gagner des points.',
    type: 'Score',
    image: '/images/games/tetris.png',
  },
];

const dailyGames = [
  {
    id: 'wordle',
    name: 'Wordle',
    description: 'Un mot de 5 lettres par jour. Compare ton nombre d\'essais.',
    type: 'Daily',
    gradient: 'from-fuchsia-500 via-pink-500 to-rose-500',
  },
];

const tabConfig: Array<{ id: GamesTab; label: string; className: string }> = [
  {
    id: 'singleplayer',
    label: 'Singleplayer',
    className: 'from-sky-500 to-blue-500 text-white border-sky-300/50',
  },
  {
    id: 'multiplayer',
    label: 'Multiplayer',
    className: 'from-emerald-500 to-teal-500 text-white border-emerald-300/50',
  },
  {
    id: 'daily',
    label: 'Daily Games',
    className: 'from-fuchsia-500 to-rose-500 text-white border-fuchsia-300/50',
  },
];

export default function Games() {
  const [activeTab, setActiveTab] = useState<GamesTab>('singleplayer');

  const multiplayerGames = useMemo(() => games.filter((game) => game.requiresParty), []);
  const soloGames = useMemo(() => games.filter((game) => !game.requiresParty), []);

  const getGameLink = (gameId: string) => {
    if (gameId === 'bomb-party') {
      return '/games/bomb-party';
    }
    if (gameId === 'poker') {
      return '/games/poker';
    }
    if (gameId === 'petit-bac') {
      return '/games/petit-bac';
    }
    if (gameId === 'bataille-navale') {
      return '/games/bataille-navale';
    }
    if (gameId === 'game-2048') {
      return '/games/2048';
    }
    if (gameId === 'flappy-bird') {
      return '/games/flappy-bird';
    }
    if (gameId === 'solitaire') {
      return '/games/solitaire';
    }
    if (gameId === 'racer') {
      return '/games/racer';
    }
    if (gameId === 'tetris') {
      return '/games/tetris';
    }
    if (gameId === 'wordle') {
      return '/games/wordle';
    }
    return `/games/${gameId}`;
  };

  const gamesToRender = activeTab === 'multiplayer' ? multiplayerGames : activeTab === 'daily' ? dailyGames : soloGames;

  return (
    <PageLayout variant="compact">
      <div className={SPACING.PAGE_SPACING}>
        <div className={SPACING.SECTION_SPACING}>
          <div className="flex flex-wrap gap-3">
            {tabConfig.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-xl border px-5 py-2.5 text-sm font-semibold transition',
                  activeTab === tab.id
                    ? `bg-gradient-to-r ${tab.className} shadow-md`
                    : 'border-border/40 bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={SPACING.CARD_SPACING}>
            <h2 className={TYPOGRAPHY.MUTED}>
              {activeTab === 'multiplayer' ? 'Multiplayer' : activeTab === 'daily' ? 'Daily Games' : 'Singleplayer'}
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {gamesToRender.map((game) => (
                <Link
                  key={game.id}
                  to={getGameLink(game.id)}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border/40 bg-card text-card-foreground shadow-sm transition hover:-translate-y-1 hover:border-foreground/40 hover:shadow-md"
                >
                  {'image' in game ? (
                    <img
                      src={game.image}
                      alt={game.name}
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className={cn('absolute inset-0 bg-gradient-to-br', game.gradient)} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="relative z-10 flex h-full flex-col justify-end p-5 text-white">
                    <h3 className={TYPOGRAPHY.H4}>{game.name}</h3>
                    <p className="mt-1 text-xs text-white/85">{game.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
