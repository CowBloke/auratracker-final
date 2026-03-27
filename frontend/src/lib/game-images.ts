const GAME_IMAGE_FALLBACK = '/aura-icon.svg';

const GAME_IMAGE_BY_ID: Record<string, string> = {
  'aura-coin': '/images/games/auracoin.png',
  casino: '/images/games/casino.png',
  'clash-village': '/images/games/clash.png',
  'chrome-dino': '/images/games/dino.png',
  'doodle-jump': '/images/games/doodlejump.png',
  eaglercraft: '/images/games/minecraft.png',
  'flappy-bird': '/images/games/flappy.png',
  'fruit-ninja': '/images/games/fruit.png',
  'geometry-dash': '/images/games/geometry.png',
  'goyave-empire': '/images/games/goyave.png',
  'knife-hit': '/images/games/knife.png',
  minesweeper: '/images/games/demineur.png',
  racer: '/images/games/racer.png',
  'qs-watermelon': '/images/games/watermelon.png',
  solitaire: '/images/games/solitaire.png',
  'stack-tower': '/images/games/stackit.png',
  sudoku: '/images/games/sudoku.png',
  'logic-lab': '/images/games/sudoku.png',
  tetris: '/images/games/tetris.png',
};

const CASINO_GAME_IMAGE_BY_ID: Record<string, string> = {
  roulette: '/images/games/casino.png',
  slots: '/images/games/casino.png',
  blackjack: '/images/games/casino.png',
};

export const getGameImage = (gameId: string) => {
  return GAME_IMAGE_BY_ID[gameId] ?? GAME_IMAGE_FALLBACK;
};

export const getCasinoGameImage = (gameId: string) => {
  return CASINO_GAME_IMAGE_BY_ID[gameId] ?? GAME_IMAGE_FALLBACK;
};
