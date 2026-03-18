/**
 * Default automatic badge definitions.
 * Run ensureDefaultBadges() at server startup — it is fully idempotent:
 * badges are identified by autoConditionKey and will be created only if missing.
 */

import { prisma } from '../server.js';

// ─── Visual presets ───────────────────────────────────────────────────────────

const GRAD = (from: string, to: string, direction = 'to bottom right') =>
  JSON.stringify({ from, to, direction });

const LEGENDARY = {
  backgroundType: 'gradient',
  backgroundGradient: GRAD('#b45309', '#f59e0b'),
  backgroundColor: '#b45309',
  borderColor: '#f59e0b',
  iconColor: '#fff7ed',
  rarity: 'legendary',
};

const EPIC = {
  backgroundType: 'gradient',
  backgroundGradient: GRAD('#6d28d9', '#a855f7'),
  backgroundColor: '#6d28d9',
  borderColor: '#a855f7',
  iconColor: '#faf5ff',
  rarity: 'epic',
};

const RARE = {
  backgroundType: 'gradient',
  backgroundGradient: GRAD('#1d4ed8', '#3b82f6'),
  backgroundColor: '#1d4ed8',
  borderColor: '#60a5fa',
  iconColor: '#eff6ff',
  rarity: 'rare',
};

const UNCOMMON = {
  backgroundType: 'gradient',
  backgroundGradient: GRAD('#15803d', '#22c55e'),
  backgroundColor: '#15803d',
  borderColor: '#4ade80',
  iconColor: '#f0fdf4',
  rarity: 'uncommon',
};

// Unique gradient per game champion badge
const GAME_GRAD: Record<string, { from: string; to: string }> = {
  doodle_jump:              { from: '#166534', to: '#22c55e' },
  doodle_jump_mort_subite:  { from: '#7f1d1d', to: '#ef4444' },
  flappy_bird:              { from: '#92400e', to: '#f59e0b' },
  game_2048:                { from: '#1e3a5f', to: '#3b82f6' },
  geometry_dash:            { from: '#4c1d95', to: '#8b5cf6' },
  qs_watermelon:            { from: '#166534', to: '#4ade80' },
  solitaire:                { from: '#1e1b4b', to: '#6366f1' },
  racer:                    { from: '#7f1d1d', to: '#f97316' },
  tetris:                   { from: '#0c4a6e', to: '#38bdf8' },
  knife_hit:                { from: '#450a0a', to: '#dc2626' },
  goyave_empire:            { from: '#365314', to: '#84cc16' },
  logic_lab:                { from: '#1e3a5f', to: '#a5f3fc' },
  minesweeper:              { from: '#374151', to: '#9ca3af' },
  casino:                   { from: '#713f12', to: '#eab308' },
  bombparty:                { from: '#7c2d12', to: '#fb923c' },
};

const GAME_ICON: Record<string, string> = {
  doodle_jump:             '🦘',
  doodle_jump_mort_subite: '💀',
  flappy_bird:             '🐦',
  game_2048:               '🔢',
  geometry_dash:           '📐',
  qs_watermelon:           '🍉',
  solitaire:               '🃏',
  racer:                   '🏎️',
  tetris:                  '🧱',
  knife_hit:               '🔪',
  goyave_empire:           '🌿',
  logic_lab:               '🧠',
  minesweeper:             '💣',
  casino:                  '🎰',
  bombparty:               '💥',
};

const GAME_LABEL: Record<string, string> = {
  doodle_jump:             'Doodle Jump',
  doodle_jump_mort_subite: 'Doodle Jump Mort Subite',
  flappy_bird:             'Flappy Bird',
  game_2048:               '2048',
  geometry_dash:           'Geometry Dash',
  qs_watermelon:           'Watermelon',
  solitaire:               'Solitaire',
  racer:                   'Racer',
  tetris:                  'Tetris',
  knife_hit:               'Knife Hit',
  goyave_empire:           'Goyave Empire',
  logic_lab:               'Logic Lab',
  minesweeper:             'Démineur',
  casino:                  'Casino',
  bombparty:               'Bomb Party',
};

// ─── Badge definitions ────────────────────────────────────────────────────────

interface BadgeDef {
  autoConditionKey: string;
  name: string;
  description: string;
  howToObtain: string;
  icon: string;
  category: string;
  backgroundType: string;
  backgroundColor: string;
  backgroundGradient?: string;
  borderColor: string;
  iconColor: string;
  rarity: string;
  isHidden?: boolean;
}

const AURA_BADGES: BadgeDef[] = [
  {
    autoConditionKey: 'TOP_1_AURA',
    name: '#1 Aura',
    description: 'Le joueur avec le plus d\'aura sur toute la plateforme.',
    howToObtain: 'Avoir le plus d\'aura parmi tous les joueurs.',
    icon: '👑',
    category: 'leaderboard',
    ...LEGENDARY,
  },
  {
    autoConditionKey: 'TOP_3_AURA',
    name: 'Top 3 Aura',
    description: 'Parmi les 3 joueurs avec le plus d\'aura.',
    howToObtain: 'Être dans le top 3 du classement aura.',
    icon: '✨',
    category: 'leaderboard',
    ...EPIC,
  },
  {
    autoConditionKey: 'TOP_5_AURA',
    name: 'Top 5 Aura',
    description: 'Parmi les 5 joueurs avec le plus d\'aura.',
    howToObtain: 'Être dans le top 5 du classement aura.',
    icon: '⚡',
    category: 'leaderboard',
    ...RARE,
  },
  {
    autoConditionKey: 'TOP_10_AURA',
    name: 'Top 10 Aura',
    description: 'Parmi les 10 joueurs avec le plus d\'aura.',
    howToObtain: 'Être dans le top 10 du classement aura.',
    icon: '🌟',
    category: 'leaderboard',
    ...UNCOMMON,
  },
];

const MONEY_BADGES: BadgeDef[] = [
  {
    autoConditionKey: 'TOP_1_MONEY',
    name: '#1 Argent',
    description: 'Le joueur le plus riche de la plateforme.',
    howToObtain: 'Avoir le plus d\'argent parmi tous les joueurs.',
    icon: '💎',
    category: 'leaderboard',
    ...LEGENDARY,
  },
  {
    autoConditionKey: 'TOP_3_MONEY',
    name: 'Top 3 Argent',
    description: 'Parmi les 3 joueurs les plus riches.',
    howToObtain: 'Être dans le top 3 du classement argent.',
    icon: '💰',
    category: 'leaderboard',
    ...EPIC,
  },
  {
    autoConditionKey: 'TOP_5_MONEY',
    name: 'Top 5 Argent',
    description: 'Parmi les 5 joueurs les plus riches.',
    howToObtain: 'Être dans le top 5 du classement argent.',
    icon: '💵',
    category: 'leaderboard',
    ...RARE,
  },
  {
    autoConditionKey: 'TOP_10_MONEY',
    name: 'Top 10 Argent',
    description: 'Parmi les 10 joueurs les plus riches.',
    howToObtain: 'Être dans le top 10 du classement argent.',
    icon: '🪙',
    category: 'leaderboard',
    ...UNCOMMON,
  },
];

const GAME_CONDITION_KEYS = [
  'doodle_jump', 'doodle_jump_mort_subite',
  'flappy_bird', 'game_2048', 'geometry_dash',
  'qs_watermelon', 'solitaire', 'racer',
  'tetris', 'knife_hit', 'goyave_empire',
  'logic_lab', 'minesweeper', 'casino',
];

const GAME_BADGES: BadgeDef[] = GAME_CONDITION_KEYS.map((gameType) => {
  const g = GAME_GRAD[gameType] ?? { from: '#374151', to: '#6b7280' };
  const label = GAME_LABEL[gameType] ?? gameType;
  const isRacer = gameType === 'racer';
  return {
    autoConditionKey: `GAME_HIGHSCORE_${gameType}`,
    name: `Champion ${label}`,
    description: `${isRacer ? 'Le meilleur temps sur' : 'Le meilleur score sur'} ${label}.`,
    howToObtain: `${isRacer ? 'Avoir le meilleur temps de lap' : 'Avoir le meilleur score'} sur ${label}.`,
    icon: GAME_ICON[gameType] ?? '🏆',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD(g.from, g.to),
    backgroundColor: g.from,
    borderColor: g.to,
    iconColor: '#ffffff',
    rarity: 'epic',
  };
});

const BOMBPARTY_BADGE: BadgeDef = {
  autoConditionKey: 'BOMBPARTY_TOP_WINS',
  name: 'Champion Bomb Party',
  description: 'Le joueur avec le plus de victoires en Bomb Party.',
  howToObtain: 'Avoir le plus grand nombre de victoires en Bomb Party.',
  icon: GAME_ICON.bombparty,
  category: 'achievement',
  backgroundType: 'gradient',
  backgroundGradient: GRAD(GAME_GRAD.bombparty.from, GAME_GRAD.bombparty.to),
  backgroundColor: GAME_GRAD.bombparty.from,
  borderColor: GAME_GRAD.bombparty.to,
  iconColor: '#ffffff',
  rarity: 'epic',
};

// ─── Membre AuraTracker ───────────────────────────────────────────────────────

const MEMBER_BADGE: BadgeDef = {
  autoConditionKey: 'MEMBER',
  name: 'Membre AuraTracker',
  description: 'Membre officiel de la communauté AuraTracker.',
  howToObtain: 'Avoir un compte approuvé sur AuraTracker.',
  icon: '🔰',
  category: 'special',
  backgroundType: 'gradient',
  backgroundGradient: GRAD('#0f766e', '#14b8a6'),
  backgroundColor: '#0f766e',
  borderColor: '#2dd4bf',
  iconColor: '#f0fdfa',
  rarity: 'uncommon',
};

// ─── Class badges (3 levels × 7 letters = 21 badges) ─────────────────────────

const LEVEL_GRAD: Record<string, { from: string; to: string; border: string }> = {
  SECONDE:    { from: '#1e3a8a', to: '#3b82f6', border: '#93c5fd' },
  PREMIERE:   { from: '#92400e', to: '#f59e0b', border: '#fcd34d' },
  TERMINALE:  { from: '#7f1d1d', to: '#ef4444', border: '#fca5a5' },
};

const LEVEL_LABEL: Record<string, string> = {
  SECONDE:   'Seconde',
  PREMIERE:  'Première',
  TERMINALE: 'Terminale',
};

const CLASS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
const LEVELS = ['SECONDE', 'PREMIERE', 'TERMINALE'] as const;

const CLASS_BADGES: BadgeDef[] = LEVELS.flatMap((level) =>
  CLASS_LETTERS.map((letter): BadgeDef => {
    const g = LEVEL_GRAD[level];
    return {
      autoConditionKey: `CLASS_${level}_${letter}`,
      name: `${LEVEL_LABEL[level]} ${letter}`,
      description: `Élève en ${LEVEL_LABEL[level]} ${letter}.`,
      howToObtain: `Être inscrit en ${LEVEL_LABEL[level]} ${letter}.`,
      icon: letter,
      category: 'special',
      backgroundType: 'gradient',
      backgroundGradient: GRAD(g.from, g.to),
      backgroundColor: g.from,
      borderColor: g.border,
      iconColor: '#ffffff',
      rarity: 'common',
    };
  }),
);

// ─── Achievement badges ───────────────────────────────────────────────────────

const ACHIEVEMENT_BADGES: BadgeDef[] = [
  {
    autoConditionKey: 'TRYHARDEUR',
    name: 'Tryhardeur',
    description: 'A joué plus de 100 parties au total, tous jeux confondus.',
    howToObtain: 'Joue 100 parties sur n\'importe quel jeu de la plateforme.',
    icon: '💪',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#f97316', '#dc2626'),
    backgroundColor: '#f97316',
    borderColor: '#f97316',
    iconColor: '#ffffff',
    rarity: 'uncommon',
  },
  {
    autoConditionKey: 'GRIND_200',
    name: 'No Life',
    description: 'A joué plus de 200 parties au total. Il a vraiment rien d\'autre à faire.',
    howToObtain: 'Joue 200 parties sur n\'importe quel jeu.',
    icon: '🔥',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#991b1b', '#7c3aed'),
    backgroundColor: '#991b1b',
    borderColor: '#ef4444',
    iconColor: '#ffffff',
    rarity: 'rare',
  },
  {
    autoConditionKey: 'GAME_2048_TILE_2048',
    name: '2048',
    description: 'A accompli la tuile 2048 dans le jeu du même nom.',
    howToObtain: 'Atteins la tuile 2048 dans le jeu 2048.',
    icon: '🎯',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#1d4ed8', '#7c3aed'),
    backgroundColor: '#1d4ed8',
    borderColor: '#60a5fa',
    iconColor: '#fbbf24',
    rarity: 'rare',
  },
  {
    autoConditionKey: 'GAME_2048_TILE_4096',
    name: '4096',
    description: 'A atteint la légendaire tuile 4096. Un vrai génie des chiffres.',
    howToObtain: 'Atteins la tuile 4096 dans le jeu 2048.',
    icon: '🧠',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#4c1d95', '#0f172a'),
    backgroundColor: '#4c1d95',
    borderColor: '#c084fc',
    iconColor: '#ffffff',
    rarity: 'epic',
  },
  {
    autoConditionKey: 'SUDOKU_COMPLETED',
    name: 'Sudokiste',
    description: 'A complété une grille de sudoku. La logique ne lui fait pas peur.',
    howToObtain: 'Termine une grille de sudoku.',
    icon: '🧩',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#065f46', '#0f766e'),
    backgroundColor: '#065f46',
    borderColor: '#34d399',
    iconColor: '#ffffff',
    rarity: 'uncommon',
  },
  {
    autoConditionKey: 'TOP_CASINO_LOSSES',
    name: 'Grande Ruine',
    description: 'A perdu le plus d\'argent au casino. Le casino remercie chaleureusement.',
    howToObtain: 'Être le joueur avec le plus de défaites au casino.',
    icon: '💸',
    category: 'special',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#78350f', '#1c1917'),
    backgroundColor: '#78350f',
    borderColor: '#f59e0b',
    iconColor: '#fbbf24',
    rarity: 'epic',
  },
  {
    autoConditionKey: 'CASINO_VETERAN',
    name: 'Habitué du Casino',
    description: 'A joué 25 parties ou plus au casino. Le croupier le connaît par son prénom.',
    howToObtain: 'Joue 25 parties au casino.',
    icon: '🎰',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#92400e', '#451a03'),
    backgroundColor: '#92400e',
    borderColor: '#d97706',
    iconColor: '#fbbf24',
    rarity: 'uncommon',
  },
  {
    autoConditionKey: 'FLAPPY_BIRD_50',
    name: 'Flappy Pro',
    description: 'A atteint 50 points à Flappy Bird. Ça tient du miracle.',
    howToObtain: 'Atteins un score de 50 à Flappy Bird.',
    icon: '🐦',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#0369a1', '#7dd3fc'),
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8',
    iconColor: '#fef08a',
    rarity: 'rare',
  },
  {
    autoConditionKey: 'MINESWEEPER_WIN',
    name: 'Déminer',
    description: 'A remporté une partie de Démineur sans exploser.',
    howToObtain: 'Gagne une partie de Démineur.',
    icon: '💣',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#374151', '#111827'),
    backgroundColor: '#374151',
    borderColor: '#6b7280',
    iconColor: '#ffffff',
    rarity: 'uncommon',
  },
];

// ─── New achievement badges ───────────────────────────────────────────────────

const NEW_ACHIEVEMENT_BADGES: BadgeDef[] = [
  // Casino big bet badges
  {
    autoConditionKey: 'CASINO_BET_10000',
    name: 'Gros Joueur',
    description: 'A misé 10 000$ ou plus en une seule mise au casino.',
    howToObtain: 'Place une mise d\'au moins 10 000$ au casino.',
    icon: '🎲',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#78350f', '#d97706'),
    backgroundColor: '#78350f',
    borderColor: '#fbbf24',
    iconColor: '#fef3c7',
    rarity: 'uncommon',
  },
  {
    autoConditionKey: 'CASINO_BET_20000',
    name: 'Grand Joueur',
    description: 'A misé 20 000$ ou plus en une seule mise au casino.',
    howToObtain: 'Place une mise d\'au moins 20 000$ au casino.',
    icon: '🃏',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#92400e', '#b45309'),
    backgroundColor: '#92400e',
    borderColor: '#f59e0b',
    iconColor: '#ffffff',
    rarity: 'rare',
  },
  {
    autoConditionKey: 'CASINO_BET_50000',
    name: 'Millionnaire du Casino',
    description: 'A misé 50 000$ ou plus en une seule mise. Les nerfs d\'acier.',
    howToObtain: 'Place une mise d\'au moins 50 000$ au casino.',
    icon: '💎',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#1d4ed8', '#7c3aed'),
    backgroundColor: '#1d4ed8',
    borderColor: '#a78bfa',
    iconColor: '#e0e7ff',
    rarity: 'epic',
  },
  {
    autoConditionKey: 'CASINO_BET_100000',
    name: 'Roi du Casino',
    description: 'A misé 100 000$ ou plus en une seule mise. Légendaire.',
    howToObtain: 'Place une mise d\'au moins 100 000$ au casino.',
    icon: '👑',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#b45309', '#f59e0b'),
    backgroundColor: '#b45309',
    borderColor: '#fde68a',
    iconColor: '#fffbeb',
    rarity: 'legendary',
  },
  // Nuit Blanche
  {
    autoConditionKey: 'NUIT_BLANCHE',
    name: 'Nuit Blanche',
    description: 'Connecté à 3h du matin. Les yeux rougis, le café chaud.',
    howToObtain: 'Connecte-toi entre 3h00 et 4h00 du matin.',
    icon: '🌙',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#0f172a', '#1e1b4b'),
    backgroundColor: '#0f172a',
    borderColor: '#4f46e5',
    iconColor: '#c7d2fe',
    rarity: 'rare',
  },
  // Sudoku difficulty badges
  {
    autoConditionKey: 'SUDOKU_EASY',
    name: 'Sudoku Facile',
    description: 'A complété une grille de sudoku en mode Facile.',
    howToObtain: 'Termine une grille de sudoku en difficulté Facile.',
    icon: '🧩',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#166534', '#22c55e'),
    backgroundColor: '#166534',
    borderColor: '#86efac',
    iconColor: '#f0fdf4',
    rarity: 'common',
  },
  {
    autoConditionKey: 'SUDOKU_MEDIUM',
    name: 'Sudoku Intermédiaire',
    description: 'A complété une grille de sudoku en mode Intermédiaire.',
    howToObtain: 'Termine une grille de sudoku en difficulté Intermédiaire.',
    icon: '🧩',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#0369a1', '#0ea5e9'),
    backgroundColor: '#0369a1',
    borderColor: '#7dd3fc',
    iconColor: '#f0f9ff',
    rarity: 'uncommon',
  },
  {
    autoConditionKey: 'SUDOKU_HARD',
    name: 'Sudoku Difficile',
    description: 'A complété une grille de sudoku en mode Difficile.',
    howToObtain: 'Termine une grille de sudoku en difficulté Difficile.',
    icon: '🧩',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#6d28d9', '#a855f7'),
    backgroundColor: '#6d28d9',
    borderColor: '#d8b4fe',
    iconColor: '#faf5ff',
    rarity: 'rare',
  },
  {
    autoConditionKey: 'SUDOKU_EXPERT',
    name: 'Sudoku Expert',
    description: 'A complété une grille de sudoku en mode Expert. Chapeau.',
    howToObtain: 'Termine une grille de sudoku en difficulté Expert.',
    icon: '🧩',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#991b1b', '#dc2626'),
    backgroundColor: '#991b1b',
    borderColor: '#fca5a5',
    iconColor: '#fff1f2',
    rarity: 'epic',
  },
  // Minesweeper difficulty badges
  {
    autoConditionKey: 'MINESWEEPER_DEBUTANT',
    name: 'Démineur Débutant',
    description: 'A remporté une partie de Démineur en mode Débutant.',
    howToObtain: 'Gagne une partie de Démineur en difficulté Débutant.',
    icon: '💣',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#374151', '#4b5563'),
    backgroundColor: '#374151',
    borderColor: '#9ca3af',
    iconColor: '#f9fafb',
    rarity: 'common',
  },
  {
    autoConditionKey: 'MINESWEEPER_INTERMEDIAIRE',
    name: 'Démineur Intermédiaire',
    description: 'A remporté une partie de Démineur en mode Intermédiaire.',
    howToObtain: 'Gagne une partie de Démineur en difficulté Intermédiaire.',
    icon: '💣',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#065f46', '#059669'),
    backgroundColor: '#065f46',
    borderColor: '#34d399',
    iconColor: '#ecfdf5',
    rarity: 'uncommon',
  },
  {
    autoConditionKey: 'MINESWEEPER_EXPERT',
    name: 'Démineur Expert',
    description: 'A survécu au Démineur en mode Expert. Un héros.',
    howToObtain: 'Gagne une partie de Démineur en difficulté Expert.',
    icon: '💣',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#7c2d12', '#ea580c'),
    backgroundColor: '#7c2d12',
    borderColor: '#fb923c',
    iconColor: '#fff7ed',
    rarity: 'epic',
  },
  // Solitaire win
  {
    autoConditionKey: 'SOLITAIRE_WIN',
    name: 'Solitaire Victorieux',
    description: 'A remporté une partie de Solitaire.',
    howToObtain: 'Gagne une partie de Solitaire.',
    icon: '🃏',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#1e1b4b', '#3730a3'),
    backgroundColor: '#1e1b4b',
    borderColor: '#818cf8',
    iconColor: '#e0e7ff',
    rarity: 'uncommon',
  },
  // Lewis Hamilton (Racer)
  {
    autoConditionKey: 'RACER_LAP',
    name: 'Lewis Hamilton',
    description: 'A complété un tour sur Racer. Vroom.',
    howToObtain: 'Termine un lap sur Racer.',
    icon: '🏎️',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#7f1d1d', '#f97316'),
    backgroundColor: '#7f1d1d',
    borderColor: '#fb923c',
    iconColor: '#fff7ed',
    rarity: 'common',
  },
  // Magnus Carlsen (Chess)
  {
    autoConditionKey: 'CHESS_WIN',
    name: 'Magnus Carlsen',
    description: 'A remporté une partie d\'échecs.',
    howToObtain: 'Gagne une partie d\'échecs.',
    icon: '♟️',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#1c1917', '#44403c'),
    backgroundColor: '#1c1917',
    borderColor: '#a8a29e',
    iconColor: '#fafaf9',
    rarity: 'uncommon',
  },
  // Généreux (Gift)
  {
    autoConditionKey: 'GENEROUS',
    name: 'Généreux',
    description: 'A offert un cadeau à quelqu\'un. La générosité ça se mérite.',
    howToObtain: 'Offre un cadeau à un autre joueur.',
    icon: '🎁',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#be185d', '#ec4899'),
    backgroundColor: '#be185d',
    borderColor: '#f9a8d4',
    iconColor: '#fff0f6',
    rarity: 'uncommon',
  },
  // Bug Reporter
  {
    autoConditionKey: 'BUG_REPORTER',
    name: '☝️🤓',
    description: 'A reporté un bug. Techniquement utile.',
    howToObtain: 'Reporte un bug via le formulaire prévu à cet effet.',
    icon: '🐛',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#166534', '#15803d'),
    backgroundColor: '#166534',
    borderColor: '#4ade80',
    iconColor: '#f0fdf4',
    rarity: 'common',
  },
  // Puissant (Connect 4)
  {
    autoConditionKey: 'PUISSANCE_4_WIN',
    name: 'Puissant',
    description: 'A gagné une partie de Puissance 4.',
    howToObtain: 'Gagne une partie de Puissance 4.',
    icon: '🔴',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#dc2626', '#b91c1c'),
    backgroundColor: '#dc2626',
    borderColor: '#fca5a5',
    iconColor: '#fff1f2',
    rarity: 'common',
  },
  // Ball Arena champion
  {
    autoConditionKey: 'BALL_ARENA_WIN',
    name: 'Boulet de Canon',
    description: 'A expulsé son adversaire de l\'arène.',
    howToObtain: 'Gagne une partie de Ball Arena.',
    icon: '🎱',
    category: 'achievement',
    backgroundType: 'gradient',
    backgroundGradient: GRAD('#0e7490', '#06b6d4'),
    backgroundColor: '#0e7490',
    borderColor: '#67e8f9',
    iconColor: '#ecfeff',
    rarity: 'common',
  },
];

const ALL_DEFAULT_BADGES: BadgeDef[] = [
  MEMBER_BADGE,
  ...CLASS_BADGES,
  ...AURA_BADGES,
  ...MONEY_BADGES,
  ...GAME_BADGES,
  BOMBPARTY_BADGE,
  ...ACHIEVEMENT_BADGES,
  ...NEW_ACHIEVEMENT_BADGES,
];

// ─── Idempotent seeder ────────────────────────────────────────────────────────

/**
 * Creates all default automatic badges if they don't already exist.
 * Safe to call on every server startup.
 */
export const ensureDefaultBadges = async (): Promise<void> => {
  try {
    for (const def of ALL_DEFAULT_BADGES) {
      const existing = await prisma.badge.findFirst({
        where: { autoConditionKey: def.autoConditionKey },
        select: { id: true },
      });
      if (!existing) {
        await prisma.badge.create({
          data: {
            name: def.name,
            description: def.description,
            howToObtain: def.howToObtain,
            icon: def.icon,
            backgroundType: def.backgroundType,
            backgroundColor: def.backgroundColor,
            backgroundGradient: def.backgroundGradient ?? null,
            backgroundImage: null,
            iconColor: def.iconColor,
            borderColor: def.borderColor,
            category: def.category,
            rarity: def.rarity,
            isAutomatic: true,
            autoConditionKey: def.autoConditionKey,
            isActive: true,
            isHidden: def.isHidden ?? false,
          },
        });
      }
    }
    console.log(`[badges] Default badges seeded (${ALL_DEFAULT_BADGES.length} definitions checked)`);
  } catch (error) {
    console.error('[badges] Failed to seed default badges:', error);
  }
};
