import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/page-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useFeatures } from '@/contexts/FeaturesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { resolveThemeImageUrl } from '@/lib/images';
import { getGameImage } from '@/lib/game-images';
import { gamesApi } from '@/services/api';

type GamesTab = 'singleplayer' | 'multiplayer' | 'all';
type MultiplayerTab = 'all' | 'duel' | 'party';
type SortOption = 'default' | 'popular' | 'newest' | 'most-played';
type Game = (typeof games)[number];

const games = [
  {
    id: 'russian-roulette',
    pageKey: 'game-russian-roulette',
    name: 'Roulette russe',
    description: 'Assis autour d\'une table sombre, chacun tire à son tour. Le dernier en vie gagne.',
    type: 'Groupe',
    requiresParty: true,
    image: getGameImage('russian-roulette'),
    statsKeys: ['russian_roulette'],
    releaseRank: 3,
  },
  {
    id: 'bomb-party',
    pageKey: 'game-bomb-party',
    name: 'Bombe de mots',
    description: 'Trouve des mots contenant les lettres avant que la bombe explose.',
    type: 'Groupe',
    requiresParty: true,
    image: getGameImage('bomb-party'),
    statsKeys: ['bombparty'],
    releaseRank: 12,
  },
  {
    id: 'poker',
    pageKey: 'game-poker',
    name: 'Poker',
    description: "Hold'em minimaliste en groupe, blindes fixes et manches rapides.",
    type: 'Groupe',
    requiresParty: true,
    image: getGameImage('poker'),
    statsKeys: ['poker'],
    releaseRank: 11,
  },
  {
    id: 'petit-bac',
    pageKey: 'game-petit-bac',
    name: 'Petit Bac',
    description: 'Remplis les categories avec la bonne lettre avant la fin du temps.',
    type: 'Groupe',
    requiresParty: true,
    image: getGameImage('petit-bac'),
    statsKeys: ['petit_bac'],
    releaseRank: 13,
  },
  {
    id: 'uno',
    pageKey: 'game-uno',
    name: 'UNO',
    description: 'Le classique jeu de cartes : aligne les couleurs et valeurs, joue des actions et fais UNO en premier.',
    type: 'Groupe',
    requiresParty: true,
    emoji: '🃏',
    image: getGameImage('uno'),
    statsKeys: ['uno'],
    releaseRank: 24,
  },
  {
    id: 'bataille-navale',
    pageKey: 'game-bataille-navale',
    name: 'Bataille Navale',
    description: 'Place tes bateaux et coule ceux de ton adversaire.',
    type: 'Duel',
    requiresParty: true,
    image: getGameImage('bataille-navale'),
    statsKeys: ['battleship'],
    releaseRank: 8,
  },
  {
    id: 'doodle-jump',
    pageKey: 'game-doodle-jump',
    name: 'Doodle Jump',
    description: 'Saute le plus haut possible pour gagner des récompenses.',
    type: 'Score',
    image: getGameImage('doodle-jump'),
    statsKeys: ['doodle_jump', 'doodle_jump_mort_subite'],
    releaseRank: 1,
  },
  {
    id: 'logic-lab',
    pageKey: 'game-logic-lab',
    name: 'Sudoku',
    description: 'Grilles Sudoku générées à la volée, plusieurs niveaux et classement sur tes meilleures résolutions.',
    type: 'Logique',
    image: getGameImage('logic-lab'),
    statsKeys: ['logic_lab'],
    releaseRank: 25,
  },
  {
    id: 'minesweeper',
    pageKey: 'game-minesweeper',
    name: 'Démineur',
    description: 'Balise les bombes, ouvre les zones sûres et finis la grille le plus proprement possible.',
    type: 'Logique',
    emoji: '💣',
    image: getGameImage('minesweeper'),
    statsKeys: ['minesweeper'],
    releaseRank: 26,
  },
  {
    id: 'game-2048',
    pageKey: 'game-2048',
    name: '2048',
    description: 'Fusionne les tuiles pour atteindre 2048 et gagner des récompenses.',
    type: 'Score',
    image: getGameImage('game-2048'),
    statsKeys: ['game_2048'],
    releaseRank: 2,
  },
  {
    id: 'flappy-bird',
    pageKey: 'game-flappy-bird',
    name: 'Flappy Bird',
    description: 'Évite les tuyaux et survole le plus loin possible pour gagner des récompenses.',
    type: 'Score',
    image: getGameImage('flappy-bird'),
    statsKeys: ['flappy_bird'],
    releaseRank: 5,
  },
  {
    id: 'chrome-dino',
    pageKey: 'game-chrome-dino',
    name: 'Chrome Dino',
    description: 'Runner désertique façon hors-ligne Chrome: saute, baisse-toi et tiens la vitesse le plus longtemps possible.',
    type: 'Arcade',
    emoji: '🦖',
    image: getGameImage('chrome-dino'),
    statsKeys: ['chrome_dino'],
    releaseRank: 15,
  },
  {
    id: 'stack-tower',
    pageKey: 'game-stack-tower',
    name: 'Tour empilée',
    description: 'Empile des blocs en rythme et vise des coupes parfaites pour monter la tour le plus haut possible.',
    type: 'Arcade',
    emoji: '🧱',
    image: getGameImage('stack-tower'),
    statsKeys: ['stack_tower'],
    releaseRank: 16,
  },
  {
    id: 'fruit-ninja',
    pageKey: 'game-fruit-ninja',
    name: 'Fruit Ninja',
    description: 'Tranche les fruits avec ta souris avant qu\'ils tombent. Évite les bombes et enchaîne les combos.',
    type: 'Arcade',
    emoji: '🍉',
    image: getGameImage('fruit-ninja'),
    statsKeys: ['fruit_ninja'],
    releaseRank: 28,
  },
  {
    id: 'qs-watermelon',
    pageKey: 'game-qs-watermelon',
    name: 'QS Watermelon',
    description: 'Lâche les fruits dans la cuve, fusionne les doublons et vise la pastèque sans dépasser la ligne.',
    type: 'Arcade',
    image: getGameImage('qs-watermelon'),
    statsKeys: ['qs_watermelon'],
    releaseRank: 17,
  },
  {
    id: 'geometry-dash',
    pageKey: 'game-geometry-dash',
    name: 'Geometry Dash',
    description: 'Cours en rythme, saute au pixel près et tiens le plus loin possible dans ce dash arcade.',
    type: 'Arcade',
    image: getGameImage('geometry-dash'),
    statsKeys: ['geometry_dash'],
    releaseRank: 18,
  },
  {
    id: 'casino',
    pageKey: 'game-casino',
    name: 'Casino',
    description: 'Choisis entre machine a sous et roulette animee.',
    type: 'Chance',
    image: getGameImage('casino'),
    statsKeys: ['casino'],
    releaseRank: 6,
  },
  {
    id: 'aura-coin',
    pageKey: 'game-aura-coin',
    name: 'Aura Coin',
    description: 'Trade la cryptomonnaie virtuelle. Achete bas, vends haut.',
    type: 'Trading',
    image: getGameImage('aura-coin'),
    statsKeys: [],
    releaseRank: 7,
  },
  {
    id: 'solitaire',
    pageKey: 'game-solitaire',
    name: 'Solitaire',
    description: 'Le classique jeu de cartes. Empile les cartes pour gagner.',
    type: 'Score',
    image: getGameImage('solitaire'),
    statsKeys: ['solitaire'],
    releaseRank: 9,
  },
  {
    id: 'racer',
    pageKey: 'game-racer',
    name: 'Racer',
    description: 'Course pseudo-3D style Outrun. Évite les voitures et finis le tour le plus vite possible.',
    type: 'Score',
    image: getGameImage('racer'),
    statsKeys: ['racer', 'racer_daily'],
    releaseRank: 21,
  },
  {
    id: 'tetris',
    pageKey: 'game-tetris',
    name: 'Tetris',
    description: 'Le classique jeu de puzzle. Empile les pieces et complete des lignes pour gagner des points.',
    type: 'Score',
    image: getGameImage('tetris'),
    statsKeys: ['tetris'],
    releaseRank: 22,
  },
  {
    id: 'knife-hit',
    pageKey: 'game-knife-hit',
    name: 'Knife Hit',
    description: 'Lance au bon moment, evite les lames en place et grimpe de niveau en niveau.',
    type: 'Arcade',
    image: getGameImage('knife-hit'),
    statsKeys: ['knife_hit'],
    releaseRank: 23,
  },
  {
    id: 'clash-village',
    pageKey: 'game-clash-village',
    name: 'Clash Village',
    description: 'Bâtis ton village, renforce tes défenses et pille les réserves ennemies dans des raids asynchrones.',
    type: 'Strategy',
    image: getGameImage('clash-village'),
    statsKeys: ['clash_village'],
    releaseRank: 29,
  },
  {
    id: 'goyave-empire',
    pageKey: 'game-goyave-empire',
    name: 'Goyave Empire',
    description: "Construis un empire de goyaves. Récolte, améliore et encaisse des récompenses.",
    type: 'Idle',
    image: getGameImage('goyave-empire'),
    statsKeys: ['goyave_empire'],
    releaseRank: 30,
  },
  {
    id: 'polytrack',
    pageKey: 'game-polytrack',
    name: 'PolyTrack',
    description: 'Course low-poly time trial sur 14 circuits. Soumets tes meilleurs temps et grimpe au classement.',
    type: 'Score',
    emoji: '🏎️',
    image: getGameImage('polytrack'),
    statsKeys: [],
    releaseRank: 31,
  },
  {
    id: 'eaglercraft',
    pageKey: 'game-eaglercraft',
    name: 'Eaglercraft',
    description: 'Version navigateur façon Minecraft 1.8, jouable directement depuis le site en plein écran.',
    type: 'Sandbox',
    emoji: '⛏️',
    image: getGameImage('eaglercraft'),
    statsKeys: [],
    releaseRank: 32,
  },
  {
    id: 'subway-surfers',
    pageKey: 'game-subway-surfers',
    name: 'Subway Surfers Clone',
    description: 'Runner 3D style métro inspiré du projet Unity clone, intégré en mode web quand le build est disponible.',
    type: 'Arcade',
    emoji: '🚇',
    image: getGameImage('subway-surfers'),
    statsKeys: [],
    releaseRank: 33,
  },
  {
    id: 'hexgl',
    pageKey: 'game-hexgl',
    name: 'HexGL',
    description: 'Course futuriste WebGL ultra rapide inspirée des jeux antigravité, jouable directement dans le navigateur.',
    type: 'Arcade',
    emoji: '🚀',
    image: getGameImage('hexgl'),
    statsKeys: [],
    releaseRank: 34,
  },
  {
    id: 'opengd',
    pageKey: 'game-opengd',
    name: 'OpenGD',
    description: 'Implémentation open source de Geometry Dash, intégrée au hub avec shell plein écran et détection du build web.',
    type: 'Arcade',
    emoji: '🟩',
    image: getGameImage('opengd'),
    statsKeys: [],
    releaseRank: 35,
  },
  {
    id: 'crossy-road',
    pageKey: 'game-crossy-road',
    name: 'Crossy Road',
    description: 'Arcade reflexe: traverse routes et rails sans te faire percuter, en visant la plus longue progression.',
    type: 'Arcade',
    emoji: '🐔',
    image: getGameImage('crossy-road'),
    statsKeys: ['crossy_road'],
    releaseRank: 36,
  },
  {
    id: 'puissance-quatre',
    pageKey: 'game-puissance-quatre',
    name: 'Puissance 4',
    description: 'Aligne 4 jetons avant ton adversaire dans ce duel classique.',
    type: 'Duel',
    requiresParty: true,
    image: getGameImage('puissance-quatre'),
    statsKeys: ['puissance_4'],
    releaseRank: 19,
  },
  {
    id: 'echecs',
    pageKey: 'game-echecs',
    name: 'Échecs',
    description: 'Duel complet avec roque, prise en passant, promotion et mat.',
    type: 'Duel',
    requiresParty: true,
    image: getGameImage('echecs'),
    statsKeys: ['chess'],
    releaseRank: 20,
  },
  {
    id: 'ball-arena',
    pageKey: 'game-ball-arena',
    name: 'Arène des balles',
    description: "Vise et propulse ton adversaire hors de l'arène. Glisse pour choisir direction et puissance.",
    type: 'Duel',
    requiresParty: true,
    emoji: '🎱',
    image: getGameImage('ball-arena'),
    statsKeys: ['ball_arena'],
    releaseRank: 27,
  },
  {
    id: 'morpion',
    pageKey: 'game-morpion',
    name: 'Morpion',
    description: 'Duel minimaliste en 3x3: bloque, anticipe et aligne 3 symboles.',
    type: 'Duel',
    requiresParty: true,
    image: getGameImage('morpion'),
    statsKeys: ['morpion'],
    releaseRank: 14,
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
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogStats, setCatalogStats] = useState<{ global: Record<string, number>; personal: Record<string, number> }>({
    global: {},
    personal: {},
  });
  const { maintenanceStatus } = useFeatures();
  const { theme } = useTheme();
  const { user } = useAuth();
  const disabledPages = maintenanceStatus.disabledPages;

  useEffect(() => {
    let cancelled = false;

    const fetchCatalogStats = async () => {
      try {
        const response = await gamesApi.getCatalogStats();
        if (!cancelled) {
          setCatalogStats(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch games catalog stats:', error);
      }
    };

    if (user) {
      fetchCatalogStats();
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

  const visibleGames = useMemo(() => games.filter((game) => !disabledPages.includes(game.pageKey)), [disabledPages]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filterGames = (list: Game[]) => list.filter((game) => {
    if (!normalizedSearchQuery) return true;

    const searchableText = `${game.name} ${game.description} ${game.type}`.toLowerCase();
    return searchableText.includes(normalizedSearchQuery);
  });
  const getGlobalPlayCount = (game: Game) =>
    game.statsKeys.reduce((total, key) => total + (catalogStats.global[key] ?? 0), 0);
  const getPersonalPlayCount = (game: Game) =>
    game.statsKeys.reduce((total, key) => total + (catalogStats.personal[key] ?? 0), 0);
  const sortGames = (list: Game[]) => [...list].sort((a, b) => {
    if (sortBy === 'popular') {
      return getGlobalPlayCount(b) - getGlobalPlayCount(a) || b.releaseRank - a.releaseRank;
    }
    if (sortBy === 'newest') {
      return b.releaseRank - a.releaseRank;
    }
    if (sortBy === 'most-played') {
      return getPersonalPlayCount(b) - getPersonalPlayCount(a) || getGlobalPlayCount(b) - getGlobalPlayCount(a);
    }
    return games.findIndex((game) => game.id === a.id) - games.findIndex((game) => game.id === b.id);
  });

  const multiplayerGames = useMemo(() => filterGames(sortGames(visibleGames.filter((game) => game.requiresParty))), [visibleGames, sortBy, catalogStats, normalizedSearchQuery]);
  const soloGames = useMemo(() => filterGames(sortGames(visibleGames.filter((game) => !game.requiresParty))), [visibleGames, sortBy, catalogStats, normalizedSearchQuery]);
  const duelGames = useMemo(() => filterGames(sortGames(visibleGames.filter((game) => game.requiresParty && game.type === 'Duel'))), [visibleGames, sortBy, catalogStats, normalizedSearchQuery]);
  const partyGames = useMemo(() => filterGames(sortGames(visibleGames.filter((game) => game.requiresParty && game.type === 'Groupe'))), [visibleGames, sortBy, catalogStats, normalizedSearchQuery]);

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
    if (gameId === 'clash-village') {
      return '/games/clash-village';
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
    if (gameId === 'eaglercraft') {
      return '/games/eaglercraft';
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

  const renderEmptyState = () => (
    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
      Aucun jeu ne correspond à ta recherche.
    </div>
  );

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="h-auto flex-wrap">
            {tabConfig.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher un jeu"
              className="sm:w-[240px]"
            />

            <div className="sm:w-[220px]">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger>
                  <SelectValue placeholder="Trier les jeux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Ordre par défaut</SelectItem>
                  <SelectItem value="popular">Populaire</SelectItem>
                  <SelectItem value="newest">Nouveaux</SelectItem>
                  <SelectItem value="most-played">Plus joués</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <TabsContent value={activeTab} className={SPACING.CARD_SPACING}>
          {activeTab === 'multiplayer' && (
            <Tabs
              value={activeMultiplayerTab}
              onValueChange={(value) => setActiveMultiplayerTab(value as MultiplayerTab)}
            >
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="all">Tous</TabsTrigger>
                <TabsTrigger value="party">Groupe</TabsTrigger>
                <TabsTrigger value="duel">Duel</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {activeTab === 'all' ? (
            <div className="space-y-8">
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">Solo</h2>
                  <div className="h-px flex-1 bg-border/70" />
                </div>
                {soloGames.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                    {soloGames.map(renderGameCard)}
                  </div>
                ) : (
                  renderEmptyState()
                )}
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">Multijoueur</h2>
                  <div className="h-px flex-1 bg-border/70" />
                </div>
                {multiplayerGames.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                    {multiplayerGames.map(renderGameCard)}
                  </div>
                ) : (
                  renderEmptyState()
                )}
              </section>
            </div>
          ) : (
            gamesToRender.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {gamesToRender.map(renderGameCard)}
              </div>
            ) : (
              renderEmptyState()
            )
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
