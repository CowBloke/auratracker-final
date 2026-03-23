import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/page-shell';
import { useFeatures } from '@/contexts/FeaturesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveThemeImageUrl } from '@/lib/images';

type GamesTab = 'singleplayer' | 'multiplayer' | 'all';
type MultiplayerTab = 'all' | 'duel' | 'party';
type Game = (typeof games)[number];

const games = [
  {
    id: 'russian-roulette',
    pageKey: 'game-russian-roulette',
    name: 'Russian Roulette',
    description: 'Assis autour d\'une table sombre, chacun tire à son tour. Le dernier en vie gagne.',
    type: 'Party',
    requiresParty: true,
    image: '/images/games/rouletterusse.png',
  },
  {
    id: 'bomb-party',
    pageKey: 'game-bomb-party',
    name: 'Bomb Party',
    description: 'Trouve des mots contenant les lettres avant que la bombe explose.',
    type: 'Party',
    requiresParty: true,
    image: '/images/games/bombparty.png',
  },
  {
    id: 'poker',
    pageKey: 'game-poker',
    name: 'Poker',
    description: "Hold'em minimaliste en party, blindes fixes et rounds rapides.",
    type: 'Party',
    requiresParty: true,
    image: '/images/games/poker.png',
  },
  {
    id: 'petit-bac',
    pageKey: 'game-petit-bac',
    name: 'Petit Bac',
    description: 'Remplis les categories avec la bonne lettre avant la fin du temps.',
    type: 'Party',
    requiresParty: true,
    image: '/images/games/petitbac.png',
  },
  {
    id: 'uno',
    pageKey: 'game-uno',
    name: 'UNO',
    description: 'Le classique jeu de cartes : aligne les couleurs et valeurs, joue des actions et fais UNO en premier.',
    type: 'Party',
    requiresParty: true,
    emoji: '🃏',
    image: '/images/games/uno.png',
  },
  {
    id: 'bataille-navale',
    pageKey: 'game-bataille-navale',
    name: 'Bataille Navale',
    description: 'Place tes bateaux et coule ceux de ton adversaire.',
    type: 'Duel',
    requiresParty: true,
    image: '/images/games/bataillenavale.png',
  },
  {
    id: 'doodle-jump',
    pageKey: 'game-doodle-jump',
    name: 'Doodle Jump',
    description: 'Saute le plus haut possible pour gagner des récompenses.',
    type: 'Score',
    image: '/images/games/doodlejump.png',
  },
  {
    id: 'logic-lab',
    pageKey: 'game-logic-lab',
    name: 'Sudoku',
    description: 'Grilles Sudoku générées à la volée, plusieurs niveaux et classement sur tes meilleures résolutions.',
    type: 'Logique',
    image: '/images/games/sudoku.png',
  },
  {
    id: 'minesweeper',
    pageKey: 'game-minesweeper',
    name: 'Démineur',
    description: 'Balise les bombes, ouvre les zones sûres et finis la grille le plus proprement possible.',
    type: 'Logique',
    emoji: '💣',
    image: '/images/games/minesweeper.png',
  },
  {
    id: 'game-2048',
    pageKey: 'game-2048',
    name: '2048',
    description: 'Fusionne les tuiles pour atteindre 2048 et gagner des récompenses.',
    type: 'Score',
    image: '/images/games/2048.png',
  },
  {
    id: 'flappy-bird',
    pageKey: 'game-flappy-bird',
    name: 'Flappy Bird',
    description: 'Évite les tuyaux et survole le plus loin possible pour gagner des récompenses.',
    type: 'Score',
    image: '/images/games/flappybird.png',
  },
  {
    id: 'chrome-dino',
    pageKey: 'game-chrome-dino',
    name: 'Chrome Dino',
    description: 'Runner désertique façon hors-ligne Chrome: saute, baisse-toi et tiens la vitesse le plus longtemps possible.',
    type: 'Arcade',
    emoji: '🦖',
    image: '/images/games/dino.png',
  },
  {
    id: 'stack-tower',
    pageKey: 'game-stack-tower',
    name: 'Stack Tower',
    description: 'Empile des blocs en rythme et vise des coupes parfaites pour monter la tour le plus haut possible.',
    type: 'Arcade',
    emoji: '🧱',
    image: '/images/games/stack.png',
  },
  {
    id: 'fruit-ninja',
    pageKey: 'game-fruit-ninja',
    name: 'Fruit Ninja',
    description: 'Tranche les fruits avec ta souris avant qu\'ils tombent. Évite les bombes et enchaîne les combos.',
    type: 'Arcade',
    emoji: '🍉',
    image: '/images/games/fruitninja.png',
  },
  {
    id: 'qs-watermelon',
    pageKey: 'game-qs-watermelon',
    name: 'QS Watermelon',
    description: 'Lâche les fruits dans la cuve, fusionne les doublons et vise la pastèque sans dépasser la ligne.',
    type: 'Arcade',
    image: '/images/games/qswatermelon.svg',
  },
  {
    id: 'geometry-dash',
    pageKey: 'game-geometry-dash',
    name: 'Geometry Dash',
    description: 'Cours en rythme, saute au pixel près et tiens le plus loin possible dans ce dash arcade.',
    type: 'Arcade',
    image: '/images/games/geometrydash.png',
  },
  {
    id: 'casino',
    pageKey: 'game-casino',
    name: 'Casino',
    description: 'Choisis entre machine a sous et roulette animee.',
    type: 'Chance',
    image: '/images/games/casino.png',
  },
  {
    id: 'aura-coin',
    pageKey: 'game-aura-coin',
    name: 'Aura Coin',
    description: 'Trade la cryptomonnaie virtuelle. Achete bas, vends haut.',
    type: 'Trading',
    image: '/images/games/auracoin.png',
  },
  {
    id: 'solitaire',
    pageKey: 'game-solitaire',
    name: 'Solitaire',
    description: 'Le classique jeu de cartes. Empile les cartes pour gagner.',
    type: 'Score',
    image: '/images/games/solitaire.png',
  },
  {
    id: 'racer',
    pageKey: 'game-racer',
    name: 'Racer',
    description: 'Course pseudo-3D style Outrun. Évite les voitures et finis le tour le plus vite possible.',
    type: 'Score',
    image: '/images/games/racer.png',
  },
  {
    id: 'tetris',
    pageKey: 'game-tetris',
    name: 'Tetris',
    description: 'Le classique jeu de puzzle. Empile les pieces et complete des lignes pour gagner des points.',
    type: 'Score',
    image: '/images/games/tetris.png',
  },
  {
    id: 'knife-hit',
    pageKey: 'game-knife-hit',
    name: 'Knife Hit',
    description: 'Lance au bon moment, evite les lames en place et grimpe de niveau en niveau.',
    type: 'Arcade',
    image: '/images/games/knifehit.png',
  },
  {
    id: 'goyave-empire',
    pageKey: 'game-goyave-empire',
    name: 'Goyave Empire',
    description: "Construis un empire de goyaves. Récolte, améliore et encaisse des récompenses.",
    type: 'Idle',
    image: '/images/games/goyaveempire.png',
  },
  {
    id: 'puissance-quatre',
    pageKey: 'game-puissance-quatre',
    name: 'Puissance 4',
    description: 'Aligne 4 jetons avant ton adversaire dans ce duel classique.',
    type: 'Duel',
    requiresParty: true,
    image: '/images/games/puissance4.png',
  },
  {
    id: 'echecs',
    pageKey: 'game-echecs',
    name: 'Échecs',
    description: 'Duel complet avec roque, prise en passant, promotion et mat.',
    type: 'Duel',
    requiresParty: true,
    image: '/images/games/chess.png',
  },
  {
    id: 'ball-arena',
    pageKey: 'game-ball-arena',
    name: 'Ball Arena',
    description: "Vise et propulse ton adversaire hors de l'arène. Glisse pour choisir direction et puissance.",
    type: 'Duel',
    requiresParty: true,
    emoji: '🎱',
    image: '/images/games/ballarena.png',
  },
  {
    id: 'morpion',
    pageKey: 'game-morpion',
    name: 'Morpion',
    description: 'Duel minimaliste en 3x3: bloque, anticipe et aligne 3 symboles.',
    type: 'Duel',
    requiresParty: true,
    image: '/images/games/puissance4.png',
  },
];

const tabConfig: Array<{ id: GamesTab; label: string }> = [
  {
    id: 'all',
    label: 'Tous',
  },
  {
    id: 'singleplayer',
    label: 'Singleplayer',
  },
  {
    id: 'multiplayer',
    label: 'Multiplayer',
  },
];

export default function Games() {
  const [activeTab, setActiveTab] = useState<GamesTab>('all');
  const [activeMultiplayerTab, setActiveMultiplayerTab] = useState<MultiplayerTab>('all');
  const { maintenanceStatus } = useFeatures();
  const { theme } = useTheme();
  const disabledPages = maintenanceStatus.disabledPages;

  const visibleGames = useMemo(() => games.filter((game) => !disabledPages.includes(game.pageKey)), [disabledPages]);
  const multiplayerGames = useMemo(() => visibleGames.filter((game) => game.requiresParty), [visibleGames]);
  const soloGames = useMemo(() => visibleGames.filter((game) => !game.requiresParty), [visibleGames]);
  const duelGames = useMemo(
    () => multiplayerGames.filter((game) => game.type === 'Duel'),
    [multiplayerGames],
  );
  const partyGames = useMemo(
    () => multiplayerGames.filter((game) => game.type === 'Party'),
    [multiplayerGames],
  );

  const getGameLink = (gameId: string) => {
    if (gameId === 'russian-roulette') {
      return '/games/russian-roulette';
    }
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
    if (gameId === 'geometry-dash') {
      return '/games/geometry-dash';
    }
    if (gameId === 'qs-watermelon') {
      return '/games/qs-watermelon';
    }
    if (gameId === 'logic-lab') {
      return '/games/logic-lab';
    }
    if (gameId === 'minesweeper') {
      return '/games/minesweeper';
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
    if (gameId === 'knife-hit') {
      return '/games/knife-hit';
    }
    if (gameId === 'puissance-quatre') {
      return '/games/puissance-quatre';
    }
    if (gameId === 'ball-arena') {
      return '/games/ball-arena';
    }
    if (gameId === 'morpion') {
      return '/games/morpion';
    }
    if (gameId === 'echecs') {
      return '/games/echecs';
    }
    return `/games/${gameId}`;
  };

  const multiplayerGamesToRender = activeMultiplayerTab === 'duel'
    ? duelGames
    : activeMultiplayerTab === 'party'
      ? partyGames
      : multiplayerGames;

  const gamesToRender = activeTab === 'singleplayer'
      ? soloGames
      : multiplayerGamesToRender;

  const renderGameCard = (game: Game) => (
    <Link
      key={game.id}
      to={getGameLink(game.id)}
      className="group block"
    >
      <Card className="relative isolate aspect-square overflow-hidden transition hover:border-foreground/40 hover:shadow-md">
        {'emoji' in game && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-950/40 text-8xl">
            {game.emoji as string}
          </div>
        )}
        {game.image && (
          <img
            src={resolveThemeImageUrl(game.image, theme)}
            alt={game.name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <CardContent className="relative z-10 flex h-full flex-col justify-end p-5 text-white">
          <p className="text-xs font-medium   text-white/70">{game.type}</p>
          <h3 className={TYPOGRAPHY.H4}>{game.name}</h3>
          <p className="mt-1 text-xs text-white/85">{game.description}</p>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <PageShell>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GamesTab)} className={SPACING.SECTION_SPACING}>
        <TabsList className="h-auto flex-wrap">
          {tabConfig.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className={SPACING.CARD_SPACING}>
          {activeTab === 'multiplayer' && (
            <Tabs
              value={activeMultiplayerTab}
              onValueChange={(value) => setActiveMultiplayerTab(value as MultiplayerTab)}
            >
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="all">Tous</TabsTrigger>
                <TabsTrigger value="party">Party</TabsTrigger>
                <TabsTrigger value="duel">Duel</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {activeTab === 'all' ? (
            <div className="space-y-8">
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">Singleplayer</h2>
                  <div className="h-px flex-1 bg-border/70" />
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  {soloGames.map(renderGameCard)}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">Multiplayer</h2>
                  <div className="h-px flex-1 bg-border/70" />
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  {multiplayerGames.map(renderGameCard)}
                </div>
              </section>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {gamesToRender.map(renderGameCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
