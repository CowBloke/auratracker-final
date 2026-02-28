export type BlockablePage = {
  key: string;
  path: string;
  label: string;
  category: string;
};

export const BLOCKABLE_PAGES: BlockablePage[] = [
  { key: 'dashboard', path: '/', label: 'Tableau de bord', category: 'Général' },
  { key: 'games-hub', path: '/games', label: 'Hub Jeux', category: 'Jeux' },
  { key: 'game-2048', path: '/games/2048', label: '2048', category: 'Jeux' },
  { key: 'game-doodle-jump', path: '/games/doodle-jump', label: 'Doodle Jump', category: 'Jeux' },
  { key: 'game-flappy-bird', path: '/games/flappy-bird', label: 'Flappy Bird', category: 'Jeux' },
  { key: 'game-clash', path: '/games/clash', label: 'Clash', category: 'Jeux' },
  { key: 'game-casino', path: '/games/casino', label: 'Casino', category: 'Jeux' },
  { key: 'game-aura-coin', path: '/games/aura-coin', label: 'Aura Coin', category: 'Jeux' },
  { key: 'game-bomb-party', path: '/games/bomb-party', label: 'Bomb Party', category: 'Jeux' },
  { key: 'game-poker', path: '/games/poker', label: 'Poker', category: 'Jeux' },
  { key: 'game-petit-bac', path: '/games/petit-bac', label: 'Petit Bac', category: 'Jeux' },
  { key: 'game-bataille-navale', path: '/games/bataille-navale', label: 'Bataille Navale', category: 'Jeux' },
  { key: 'game-solitaire', path: '/games/solitaire', label: 'Solitaire', category: 'Jeux' },
  { key: 'game-racer', path: '/games/racer', label: 'Racer', category: 'Jeux' },
  { key: 'game-tetris', path: '/games/tetris', label: 'Tetris', category: 'Jeux' },
  { key: 'game-polymarket', path: '/games/polymarket', label: 'Polymarket (Jeux)', category: 'Jeux' },
  { key: 'polymarket', path: '/polymarket', label: 'Polymarket (direct)', category: 'Jeux' },
  { key: 'leaderboards', path: '/leaderboards', label: 'Classements', category: 'Communauté' },
  { key: 'leaderboards-numbers', path: '/leaderboards/nombres', label: 'Classement Nombres', category: 'Communauté' },
  { key: 'party', path: '/party', label: 'Party', category: 'Communauté' },
  { key: 'clans', path: '/clans', label: 'Clans', category: 'Communauté' },
  { key: 'suggestions', path: '/suggestions', label: 'Suggestions', category: 'Communauté' },
  { key: 'inventory', path: '/inventory', label: 'Inventaire', category: 'Profil' },
  { key: 'profile', path: '/profile', label: 'Profils', category: 'Profil' },
  { key: 'pass', path: '/pass', label: 'Pass', category: 'Général' },
  { key: 'quests', path: '/quests', label: 'Quêtes', category: 'Général' },
  { key: 'rules', path: '/rules', label: 'Règles', category: 'Général' },
  { key: 'settings', path: '/settings', label: 'Paramètres utilisateur', category: 'Profil' },
];

export const getBlockablePageByKey = (key: string) =>
  BLOCKABLE_PAGES.find((page) => page.key === key);
