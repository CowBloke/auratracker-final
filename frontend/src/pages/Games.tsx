import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Info, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { AdCard } from '@/components/ads/AdCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemContent, ItemGroup, ItemTitle, ItemActions } from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFeatures } from '@/contexts/FeaturesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { resolveThemeImageUrl } from '@/lib/images';
import { getGameImage } from '@/lib/game-images';
import { type Ad, adminApi, adsApi, gamesApi } from '@/services/api';

type GamesTab = 'singleplayer' | 'multiplayer' | 'all';
type MultiplayerTab = 'all' | 'duel' | 'party';
type SortOption = 'default' | 'popular' | 'newest' | 'most-played';
type RewardFilter = 'all' | 'with-rewards' | 'without-rewards';
type BetaFilter = 'all' | 'beta' | 'stable';
type AdminCatalogSettingKey = 'games_beta_ids' | 'games_new_ids';

type Game = {
  id: string;
  pageKey: string;
  name: string;
  description: string;
  type: string;
  requiresParty?: boolean;
  emoji?: string;
  image: string;
  statsKeys: string[];
  releaseRank: number;
  hasRewards: boolean;
};

type RewardTierLine = {
  label: string;
  reward: string;
};

const games: Game[] = [
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
  },
  {
    id: 'loto',
    pageKey: 'loto',
    name: 'Loto',
    description: 'Loterie multijoueur a tickets avec tirage periodique et cagnotte partagee.',
    type: 'Groupe',
    requiresParty: true,
    image: getGameImage('loto'),
    statsKeys: [],
    releaseRank: 39,
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
  },
  {
    id: 'blockblast',
    pageKey: 'game-blockblast',
    name: 'BlockBlast',
    description: 'Le port Blockerino: pose des blocs, casse lignes et colonnes, puis tiens jusqu à ce qu aucun placement ne soit possible.',
    type: 'Logique',
    emoji: '🟪',
    image: getGameImage('blockblast'),
    statsKeys: ['blockblast'],
    releaseRank: 38,
    hasRewards: true,
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
    hasRewards: true,
  },
  {
    id: 'minesweeper',
    pageKey: 'game-minesweeper',
    name: 'Démineur',
    description: 'Balise les bombes, ouvre les zones sûres et finis la grille le plus proprement possible.',
    type: 'Logique',
    emoji: '💣',
    image: getGameImage('minesweeper'),
    statsKeys: ['minesweeper', 'minesweeper_speedrun'],
    releaseRank: 26,
    hasRewards: true,
  },
  {
    id: 'hextris',
    pageKey: 'game-hextris',
    name: 'Hextris',
    description: 'Puzzle hexagonal inspiré par Tetris. Assemble les blocs en hexagone pour les supprimer.',
    type: 'Puzzle',
    emoji: '⬡',
    image: getGameImage('hextris'),
    statsKeys: ['hextris'],
    releaseRank: 27,
    hasRewards: true,
  },
  {
    id: 'paper-io',
    pageKey: 'game-paper-io',
    name: 'Paper.io',
    description: 'Clone solo de Paper.io contre des bots: trace des boucles pour conquérir le territoire et élimine tes rivaux.',
    type: 'Arcade',
    emoji: '🟦',
    image: getGameImage('paper-io'),
    statsKeys: ['paper_io'],
    releaseRank: 42,
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
  },
  {
    id: 'snake',
    pageKey: 'game-snake',
    name: 'Snake',
    description: 'Snake modernise: combos, acceleration progressive et grille native integree a l interface Aura.',
    type: 'Arcade',
    emoji: '🐍',
    image: getGameImage('snake'),
    statsKeys: ['snake'],
    releaseRank: 37,
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
  },
  {
    id: 'market-room',
    pageKey: 'game-market-room',
    name: 'Salle de marché',
    description: 'Hub crypto SaaS avec Aura Coin, un stable coin et un coin tres instable.',
    type: 'Trading',
    image: getGameImage('market-room'),
    statsKeys: [],
    releaseRank: 7,
    hasRewards: false,
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: false,
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
    hasRewards: true,
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
    hasRewards: false,
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
    hasRewards: false,
  },
  {
    id: 'hexgl',
    pageKey: 'game-hexgl',
    name: 'HexGL',
    description: 'Course futuriste WebGL ultra rapide inspirée des jeux antigravité, jouable directement dans le navigateur.',
    type: 'Arcade',
    emoji: '🚀',
    image: getGameImage('hexgl'),
    statsKeys: ['hexgl'],
    releaseRank: 33,
    hasRewards: true,
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
    hasRewards: false,
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
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
    hasRewards: true,
  },
  {
    id: 'dotsandboxes',
    pageKey: 'game-dotsandboxes',
    name: 'Dots and Boxes',
    description: 'Relie les points pour fermer des carres. Un duel tactique ou chaque carre compte.',
    type: 'Duel',
    requiresParty: true,
    image: getGameImage('dotsandboxes'),
    statsKeys: ['dotsandboxes'],
    releaseRank: 41,
    hasRewards: true,
  },
  {
    id: 'horse-race',
    pageKey: 'game-horse-race',
    name: 'Hippodrome',
    description: 'Course de chevaux toutes les 5 minutes : paris, cotes en direct et commentaires en français.',
    type: 'Chance',
    emoji: '🏇',
    image: '/images/games/cheval.png',
    statsKeys: [],
    releaseRank: 40,
    hasRewards: false,
  },
];

const NEW_GAMES_SHOWCASE_IDS: string[] = ['horse-race'];

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

const gameRewardTiers: Partial<Record<Game['id'], RewardTierLine[]>> = {
  'russian-roulette': [
    { label: 'Partie terminée', reward: 'Pas de gain fixe actuellement' },
  ],
  'bomb-party': [
    { label: 'Vainqueur', reward: '50 aura + 10$ par mot x multiplicateurs' },
    { label: 'Autres joueurs', reward: '5$ par mot x multiplicateurs' },
    { label: 'Multiplicateurs', reward: 'Selon nombre de vies et de joueurs' },
  ],
  poker: [
    { label: 'Partie terminée', reward: 'Pas de gain fixe actuellement' },
  ],
  'petit-bac': [
    { label: 'Partie terminée', reward: 'Pas de gain fixe actuellement' },
  ],
  uno: [
    { label: 'Victoire', reward: '60$ + 40 aura' },
    { label: 'Défaite', reward: '20$' },
  ],
  'bataille-navale': [
    { label: 'Victoire', reward: '50$ + 30 aura' },
    { label: 'Défaite', reward: '20$' },
  ],
  'doodle-jump': [
    { label: '100+', reward: '0.05 x score' },
    { label: '500+', reward: '0.08 x score + 5 aura' },
    { label: '1 000+', reward: '0.12 x score + 10 aura' },
    { label: '2 000+', reward: '0.18 x score + 20 aura' },
    { label: '4 000+', reward: '0.25 x score + 35 aura' },
    { label: '8 000+', reward: '0.35 x score + 50 aura' },
  ],
  blockblast: [
    { label: '50+', reward: '16$ + 1 aura' },
    { label: '120+', reward: '38$ + 4 aura' },
    { label: '220+', reward: '72$ + 8 aura' },
    { label: '360+', reward: '120$ + 12 aura' },
    { label: '550+', reward: '185$ + 18 aura' },
    { label: '800+', reward: '280$ + 26 aura' },
  ],
  'logic-lab': [
    { label: '200+', reward: '20$ + 1 aura' },
    { label: '350+', reward: '45$ + 4 aura' },
    { label: '550+', reward: '80$ + 8 aura' },
    { label: '750+', reward: '140$ + 14 aura' },
    { label: '900+', reward: '220$ + 22 aura' },
  ],
  minesweeper: [
    { label: '700+', reward: '22$ + 2 aura' },
    { label: '1 000+', reward: '50$ + 5 aura' },
    { label: '1 300+', reward: '90$ + 9 aura' },
    { label: '1 650+', reward: '150$ + 15 aura' },
    { label: '2 100+', reward: '230$ + 22 aura' },
  ],
  'game-2048': [
    { label: '16 384+', reward: '0.0003 x score + 50 aura si 2048 atteint' },
    { label: 'Bonus record', reward: 'Aura supplementaire si record personnel battu' },
  ],
  'flappy-bird': [
    { label: '10+', reward: '0.15 x score + 2 aura' },
    { label: '25+', reward: '0.20 x score + 5 aura' },
    { label: '50+', reward: '0.25 x score + 10 aura' },
    { label: '100+', reward: '0.30 x score + 20 aura' },
    { label: '200+', reward: '0.40 x score + 35 aura' },
    { label: '500+', reward: '0.50 x score + 50 aura' },
  ],
  'chrome-dino': [
    { label: '100+', reward: '18$ + 1 aura' },
    { label: '220+', reward: '38$ + 3 aura' },
    { label: '380+', reward: '68$ + 6 aura' },
    { label: '580+', reward: '115$ + 10 aura' },
    { label: '850+', reward: '185$ + 17 aura' },
    { label: '1 200+', reward: '285$ + 26 aura' },
    { label: '1 700+', reward: '410$ + 36 aura' },
  ],
  snake: [
    { label: '40+', reward: '12$ + 1 aura' },
    { label: '80+', reward: '28$ + 3 aura' },
    { label: '140+', reward: '52$ + 6 aura' },
    { label: '220+', reward: '90$ + 10 aura' },
    { label: '320+', reward: '145$ + 16 aura' },
    { label: '460+', reward: '230$ + 24 aura' },
  ],
  'paper-io': [
    { label: '3% territoire', reward: '12$ + 1 aura' },
    { label: '8% territoire', reward: '28$ + 3 aura' },
    { label: '15% territoire', reward: '55$ + 6 aura' },
    { label: '25% territoire', reward: '95$ + 10 aura' },
    { label: '40% territoire', reward: '150$ + 16 aura' },
    { label: '60% territoire', reward: '240$ + 26 aura' },
    { label: 'Bonus KO', reward: '+500 points par bot éliminé' },
  ],
  'stack-tower': [
    { label: '10+', reward: '12$ + 1 aura' },
    { label: '20+', reward: '26$ + 3 aura' },
    { label: '35+', reward: '50$ + 6 aura' },
    { label: '55+', reward: '85$ + 10 aura' },
    { label: '80+', reward: '130$ + 15 aura' },
    { label: '120+', reward: '190$ + 22 aura' },
  ],
  'fruit-ninja': [
    { label: '50+', reward: '12$ + 1 aura' },
    { label: '120+', reward: '28$ + 3 aura' },
    { label: '220+', reward: '55$ + 6 aura' },
    { label: '350+', reward: '95$ + 10 aura' },
    { label: '500+', reward: '160$ + 16 aura' },
    { label: '700+', reward: '250$ + 24 aura' },
  ],
  'qs-watermelon': [
    { label: '80+', reward: '12$ + 1 aura' },
    { label: '200+', reward: '30$ + 3 aura' },
    { label: '420+', reward: '62$ + 6 aura' },
    { label: '800+', reward: '120$ + 10 aura' },
    { label: '1 400+', reward: '210$ + 16 aura' },
    { label: '2 200+', reward: '330$ + 24 aura' },
  ],
  'geometry-dash': [
    { label: '100+', reward: '12$ + 1 aura' },
    { label: '250+', reward: '28$ + 3 aura' },
    { label: '500+', reward: '60$ + 6 aura' },
    { label: '900+', reward: '110$ + 10 aura' },
    { label: '1 400+', reward: '180$ + 16 aura' },
    { label: '2 200+', reward: '280$ + 24 aura' },
  ],
  casino: [
    { label: 'Gros gain', reward: '10 aura si gain >= 10x la mise' },
    { label: 'Tres gros gain', reward: '50 aura si gain >= 50x la mise' },
  ],
  soccer: [
    { label: 'But gagne', reward: 'Paiement selon la mise et les bonus casino' },
    { label: 'Defaite', reward: 'La mise est perdue' },
  ],
  mines: [
    { label: 'Cashout', reward: 'Paiement selon le multiplicateur atteint' },
    { label: 'Mine touchee', reward: 'La mise est perdue' },
  ],
  crash: [
    { label: 'Cashout avant crash', reward: 'Paiement selon le multiplicateur atteint' },
    { label: 'Crash subi', reward: 'La mise est perdue' },
  ],
  solitaire: [
    { label: 'Victoire', reward: '50$ + 5 aura minimum' },
    { label: '5 000+', reward: '100$ + 10 aura' },
    { label: '7 000+', reward: '150$ + 15 aura' },
    { label: '8 000+', reward: '200$ + 25 aura' },
    { label: '9 000+', reward: '300$ + 40 aura' },
    { label: '9 500+', reward: '500$ + 60 aura' },
  ],
  racer: [
    { label: '< 45s', reward: '500$ + 50 aura' },
    { label: '< 60s', reward: '200$ + 25 aura' },
    { label: '< 90s', reward: '100$ + 10 aura' },
    { label: '< 120s', reward: '50$ + 5 aura' },
    { label: '< 180s', reward: '20$ + 2 aura' },
    { label: 'Finir le tour', reward: '8$ + 1 aura minimum' },
  ],
  tetris: [
    { label: '1 000+', reward: '0.0004 x score + 1 aura' },
    { label: '100 000+', reward: '0.0007 x score + 4 aura' },
    { label: '200 000+', reward: '0.0010 x score + 8 aura' },
    { label: '300 000+', reward: '0.0013 x score + 12 aura' },
    { label: '500 000+', reward: '0.0016 x score + 15 aura' },
    { label: '800 000+', reward: '0.0020 x score + 20 aura' },
  ],
  'knife-hit': [
    { label: '35+', reward: '90$ + 8 aura' },
    { label: '50+', reward: '170$ + 14 aura' },
    { label: '80+', reward: '320$ + 24 aura' },
  ],
  'goyave-empire': [
    { label: '100+', reward: '10$ + 1 aura' },
    { label: '1 000+', reward: '25$ + 3 aura' },
    { label: '10 000+', reward: '60$ + 8 aura' },
    { label: '100 000+', reward: '150$ + 20 aura' },
    { label: '1 000 000+', reward: '400$ + 50 aura' },
    { label: '10 000 000+', reward: '1 000$ + 100 aura' },
  ],
  'puissance-quatre': [
    { label: 'Victoire', reward: '50$ + 30 aura' },
    { label: 'Match nul', reward: '25$ + 5 aura' },
    { label: 'Défaite', reward: '20$' },
  ],
  echecs: [
    { label: 'Victoire', reward: '50$ + 30 aura' },
    { label: 'Match nul', reward: '25$ + 5 aura' },
    { label: 'Défaite', reward: '20$' },
  ],
  'ball-arena': [
    { label: 'Victoire', reward: '50$ + 30 aura' },
    { label: 'Match nul', reward: '25$ + 5 aura' },
    { label: 'Défaite', reward: '20$' },
  ],
  morpion: [
    { label: 'Victoire', reward: '40$ + 18 aura' },
    { label: 'Match nul', reward: '24$ + 5 aura' },
    { label: 'Défaite', reward: '20$' },
  ],
  dotsandboxes: [
    { label: 'Victoire', reward: '40$ + 18 aura' },
    { label: 'Match nul', reward: '24$ + 5 aura' },
    { label: 'Défaite', reward: '20$' },
  ],
  hexgl: [
    { label: '< 75s', reward: '500$ + 50 aura' },
    { label: '< 95s', reward: '220$ + 25 aura' },
    { label: '< 120s', reward: '120$ + 12 aura' },
    { label: '< 150s', reward: '70$ + 6 aura' },
    { label: '< 210s', reward: '30$ + 3 aura' },
    { label: 'Finir la course', reward: '10$ + 1 aura minimum' },
  ],
};

const GAME_LINK_OVERRIDES: Record<string, string> = {
  crash: '/games/casino?table=crash',
  casino: '/games/casino',
  'game-2048': '/games/2048',
  'market-room': '/games/salle-de-marche',
  loto: '/loto',
};

export default function Games() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<GamesTab>('all');
  const [activeMultiplayerTab, setActiveMultiplayerTab] = useState<MultiplayerTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [rewardFilter, setRewardFilter] = useState<RewardFilter>('all');
  const [betaFilter, setBetaFilter] = useState<BetaFilter>('all');
  const [catalogStats, setCatalogStats] = useState<{ global: Record<string, number>; personal: Record<string, number> }>({
    global: {},
    personal: {},
  });
  const [managedBetaGameIds, setManagedBetaGameIds] = useState<string[]>([]);
  const [managedNewGameIds, setManagedNewGameIds] = useState<string[]>([]);
  const [savingCatalogTag, setSavingCatalogTag] = useState<string | null>(null);
  const [rewardDetailsGameId, setRewardDetailsGameId] = useState<string | null>(null);
  const [adPool, setAdPool] = useState<Ad[]>([]);
  const { maintenanceStatus, refreshFeatures } = useFeatures();
  const { theme } = useTheme();
  const { user } = useAuth();
  const disabledPages = maintenanceStatus.disabledPages;
  const isAdmin = Boolean(user?.isAdmin);
  const canBypassMaintenance = Boolean(user?.isAdmin || user?.isSuperAdmin || user?.isBetaTester);

  useEffect(() => {
    setManagedBetaGameIds(maintenanceStatus.betaGameIds ?? []);
    setManagedNewGameIds(maintenanceStatus.newGameIds ?? []);
  }, [maintenanceStatus.betaGameIds, maintenanceStatus.newGameIds]);

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

  useEffect(() => {
    void adsApi.listPublic({ limit: 12 })
      .then((response) => {
        setAdPool(response.data.ads);
      })
      .catch(() => {});
  }, []);

  const visibleGames = useMemo(
    () => (canBypassMaintenance ? games : games.filter((game) => !disabledPages.includes(game.pageKey))),
    [canBypassMaintenance, disabledPages]
  );
  const betaGameSet = useMemo(() => new Set(managedBetaGameIds), [managedBetaGameIds]);
  const newGameSet = useMemo(() => new Set(managedNewGameIds), [managedNewGameIds]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filterGames = (list: Game[]) => list.filter((game) => {
    if (rewardFilter === 'with-rewards' && !game.hasRewards) return false;
    if (rewardFilter === 'without-rewards' && game.hasRewards) return false;

    const isBeta = betaGameSet.has(game.id);
    if (betaFilter === 'beta' && !isBeta) return false;
    if (betaFilter === 'stable' && isBeta) return false;

    if (!normalizedSearchQuery) return true;

    const searchableText = `${game.name} ${game.description} ${game.type}`.toLowerCase();
    return searchableText.includes(normalizedSearchQuery);
  });
  const getGlobalPlayCount = (game: Game) =>
    game.statsKeys.reduce((total, key) => total + (catalogStats.global[key] ?? 0), 0);
  const getPersonalPlayCount = (game: Game) =>
    game.statsKeys.reduce((total, key) => total + (catalogStats.personal[key] ?? 0), 0);
  const sortGames = (list: Game[]) => [...list].sort((a, b) => {
    const aIsNew = newGameSet.has(a.id) ? 1 : 0;
    const bIsNew = newGameSet.has(b.id) ? 1 : 0;

    if (sortBy === 'popular') {
      return getGlobalPlayCount(b) - getGlobalPlayCount(a) || b.releaseRank - a.releaseRank;
    }
    if (sortBy === 'newest') {
      return bIsNew - aIsNew || b.releaseRank - a.releaseRank;
    }
    if (sortBy === 'most-played') {
      return getPersonalPlayCount(b) - getPersonalPlayCount(a) || getGlobalPlayCount(b) - getGlobalPlayCount(a);
    }
    return games.findIndex((game) => game.id === a.id) - games.findIndex((game) => game.id === b.id);
  });

  const multiplayerGames = useMemo(() => filterGames(sortGames(visibleGames.filter((game) => game.requiresParty))), [visibleGames, sortBy, catalogStats, normalizedSearchQuery, rewardFilter, betaFilter, managedBetaGameIds, managedNewGameIds]);
  const soloGames = useMemo(() => filterGames(sortGames(visibleGames.filter((game) => !game.requiresParty))), [visibleGames, sortBy, catalogStats, normalizedSearchQuery, rewardFilter, betaFilter, managedBetaGameIds, managedNewGameIds]);
  const duelGames = useMemo(() => filterGames(sortGames(visibleGames.filter((game) => game.requiresParty && game.type === 'Duel'))), [visibleGames, sortBy, catalogStats, normalizedSearchQuery, rewardFilter, betaFilter, managedBetaGameIds, managedNewGameIds]);
  const partyGames = useMemo(() => filterGames(sortGames(visibleGames.filter((game) => game.requiresParty && game.type === 'Groupe'))), [visibleGames, sortBy, catalogStats, normalizedSearchQuery, rewardFilter, betaFilter, managedBetaGameIds, managedNewGameIds]);

  const getGameLink = (gameId: string) => GAME_LINK_OVERRIDES[gameId] ?? `/games/${gameId}`;

  const handleGameClick = (gameId: string) => {
    const link = getGameLink(gameId);
    navigate(link);
  };

  const injectAdsIntoGrid = (nodes: React.JSX.Element[], startAdIdx = 0): { elements: React.JSX.Element[]; nextAdIdx: number } => {
    const cardAds = adPool.filter((ad) => ad.isActive);
    if (cardAds.length === 0 || user?.hasAdblock) return { elements: nodes, nextAdIdx: startAdIdx };

    const result: React.JSX.Element[] = [];
    let adIdx = startAdIdx;

    nodes.forEach((node, i) => {
      result.push(node);
      if ((i + 1) % 6 === 0 && adIdx < cardAds.length) {
        result.push(<AdCard key={`ad-${adIdx}`} ad={cardAds[adIdx]!} />);
        adIdx += 1;
      }
    });

    return { elements: result, nextAdIdx: adIdx };
  };

  const multiplayerGamesToRender = activeMultiplayerTab === 'duel'
    ? duelGames
    : activeMultiplayerTab === 'party'
      ? partyGames
      : multiplayerGames;

  const gamesToRender = activeTab === 'singleplayer' ? soloGames : multiplayerGamesToRender;

  const activeCardAds = adPool.filter((ad) => ad.isActive);
  const multiplayerTabAdOffset = activeCardAds.length > 1
    ? Math.floor(soloGames.length / 6) % activeCardAds.length
    : 0;

  const toggleCatalogTag = async (
    gameId: string,
    settingKey: AdminCatalogSettingKey,
    currentIds: string[],
    setIds: (ids: string[]) => void,
    label: 'bêta' | 'nouveau'
  ) => {
    const nextIds = currentIds.includes(gameId)
      ? currentIds.filter((id) => id !== gameId)
      : games.filter((game) => [...currentIds, gameId].includes(game.id)).map((game) => game.id);

    try {
      setSavingCatalogTag(`${settingKey}:${gameId}`);
      setIds(nextIds);
      await adminApi.updateSettings({
        [settingKey]: JSON.stringify(nextIds),
      });
      await refreshFeatures();
      toast.success(`Statut ${label} mis à jour.`);
    } catch (error: any) {
      setIds(currentIds);
      toast.error(error?.response?.data?.error || `Impossible de mettre à jour le statut ${label}.`);
    } finally {
      setSavingCatalogTag(null);
    }
  };

  const renderGameCard = (game: Game) => {
    const isBeta = betaGameSet.has(game.id);
    const isNew = newGameSet.has(game.id);
    const hasRewardTiers = Boolean(gameRewardTiers[game.id]?.length);

    return (
      <Card key={game.id} className="relative gap-4 overflow-hidden pt-0 transition-colors hover:bg-accent/40">
        <AspectRatio ratio={4 / 3} className="bg-muted">
          {game.emoji ? (
            <div className="flex size-full items-center justify-center text-7xl">{game.emoji}</div>
          ) : null}
          {game.image ? (
            <img
              src={resolveThemeImageUrl(game.image, theme)}
              alt=""
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
              onError={(event) => {
                (event.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : null}
        </AspectRatio>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="text-left after:absolute after:inset-0 focus-visible:outline-none"
              onClick={() => handleGameClick(game.id)}
            >
              {game.name}
            </button>
            {isNew ? <Badge>Nouveau</Badge> : null}
            {isBeta ? <Badge variant="secondary">Bêta</Badge> : null}
          </CardTitle>
          <CardDescription className="line-clamp-2">{game.description}</CardDescription>
        </CardHeader>
        {isAdmin || hasRewardTiers ? (
          <CardFooter className="relative z-10 flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <>
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={isNew}
                  disabled={savingCatalogTag === `games_new_ids:${game.id}`}
                  onPressedChange={() =>
                    void toggleCatalogTag(game.id, 'games_new_ids', managedNewGameIds, setManagedNewGameIds, 'nouveau')
                  }
                >
                  Nouveau
                </Toggle>
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={isBeta}
                  disabled={savingCatalogTag === `games_beta_ids:${game.id}`}
                  onPressedChange={() =>
                    void toggleCatalogTag(game.id, 'games_beta_ids', managedBetaGameIds, setManagedBetaGameIds, 'bêta')
                  }
                >
                  Bêta
                </Toggle>
              </>
            ) : null}
            {hasRewardTiers ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => setRewardDetailsGameId(game.id)}
                aria-label={`Voir les récompenses de ${game.name}`}
              >
                <Info />
              </Button>
            ) : null}
          </CardFooter>
        ) : null}
      </Card>
    );
  };

  const activeRewardDetailsGame = rewardDetailsGameId
    ? games.find((game) => game.id === rewardDetailsGameId) ?? null
    : null;

  const showcaseGames = useMemo(
    () => NEW_GAMES_SHOWCASE_IDS
      .map((id) => visibleGames.find((game) => game.id === id))
      .filter((game): game is Game => Boolean(game)),
    [visibleGames]
  );

  const renderEmptyState = () => (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>Aucun jeu trouvé</EmptyTitle>
        <EmptyDescription>Aucun jeu ne correspond à votre recherche.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  const gridClassName = 'grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4';

  const renderSection = (title: string, list: Game[], startAdIdx: number) => {
    const grid = injectAdsIntoGrid(list.map(renderGameCard), startAdIdx);
    return {
      nextAdIdx: grid.nextAdIdx,
      node: (
        <section key={title} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <Separator className="flex-1" />
          </div>
          {list.length > 0 ? <div className={gridClassName}>{grid.elements}</div> : renderEmptyState()}
        </section>
      ),
    };
  };

  return (
    <PageShell>
      <PageHeader
        title="Jeux"
        description="Solo, duel ou en groupe : choisissez votre prochaine partie."
      />

      {showcaseGames.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold tracking-tight">Nouveaux jeux</h2>
            <Badge variant="secondary">À découvrir</Badge>
            <Separator className="flex-1" />
          </div>
          <div className={gridClassName}>{showcaseGames.map(renderGameCard)}</div>
        </section>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GamesTab)} className="gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {tabConfig.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher un jeu"
              className="sm:w-60"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="justify-between sm:w-48">
                  Trier et filtrer
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Tri</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                  <DropdownMenuRadioItem value="default">Ordre par défaut</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="popular">Populaire</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="newest">Nouveaux</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="most-played">Plus joués</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Récompenses</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-60">
                    <DropdownMenuRadioGroup value={rewardFilter} onValueChange={(value) => setRewardFilter(value as RewardFilter)}>
                      <DropdownMenuRadioItem value="all">Toutes les récompenses</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="with-rewards">Avec récompenses</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="without-rewards">Sans récompenses</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Statut bêta</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    <DropdownMenuRadioGroup value={betaFilter} onValueChange={(value) => setBetaFilter(value as BetaFilter)}>
                      <DropdownMenuRadioItem value="all">Tous les statuts</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="beta">Bêta</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="stable">Hors bêta</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <TabsContent value={activeTab} className="flex flex-col gap-6">
          {activeTab === 'multiplayer' ? (
            <ToggleGroup
              type="single"
              variant="outline"
              value={activeMultiplayerTab}
              onValueChange={(value) => value && setActiveMultiplayerTab(value as MultiplayerTab)}
              className="self-start"
            >
              <ToggleGroupItem value="all">Tous</ToggleGroupItem>
              <ToggleGroupItem value="party">Groupe</ToggleGroupItem>
              <ToggleGroupItem value="duel">Duel</ToggleGroupItem>
            </ToggleGroup>
          ) : null}

          {activeTab === 'all' ? (
            (() => {
              const solo = renderSection('Solo', soloGames, 0);
              const multi = renderSection('Multijoueur', multiplayerGames, solo.nextAdIdx);
              return (
                <div className="flex flex-col gap-8">
                  {solo.node}
                  {multi.node}
                </div>
              );
            })()
          ) : gamesToRender.length > 0 ? (
            <div className={gridClassName}>
              {injectAdsIntoGrid(gamesToRender.map(renderGameCard), activeTab === 'multiplayer' ? multiplayerTabAdOffset : 0).elements}
            </div>
          ) : (
            renderEmptyState()
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(activeRewardDetailsGame)} onOpenChange={(open) => !open && setRewardDetailsGameId(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Récompenses : {activeRewardDetailsGame?.name ?? 'Jeu'}</DialogTitle>
            <DialogDescription>Paliers de gains selon vos performances.</DialogDescription>
          </DialogHeader>
          <ItemGroup>
            {(activeRewardDetailsGame ? gameRewardTiers[activeRewardDetailsGame.id] : [])?.map((tier) => (
              <Item key={`${activeRewardDetailsGame?.id ?? 'game'}-${tier.label}`} variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>{tier.label}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <span className="text-sm text-muted-foreground">{tier.reward}</span>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
