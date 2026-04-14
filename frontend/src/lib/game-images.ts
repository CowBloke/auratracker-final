const GAME_IMAGE_FALLBACK = '/aura-icon.svg';

const GAME_IMAGE_BY_ID: Record<string, string> = {
  'game-2048': '/images/games/2048.png',
  'aura-coin': '/images/games/auracoin.png',
  'market-room': '/images/games/auracoin.png',
  'ball-arena': '/images/games/ball.png',
  'bataille-navale': '/images/games/bataille.png',
  blockblast: '/images/games/blockblast.png',
  'bomb-party': '/images/games/bomb.png',
  casino: '/images/games/casino.png',
  soccer: '/images/games/roulette.png',
  mines: '/images/games/demineur.png',
  crash: '/images/games/casino.png',
  'clash-village': '/images/games/clash.png',
  'chrome-dino': '/images/games/dino.png',
  'crossy-road': '/images/games/crossyroad.png',
  'doodle-jump': '/images/games/doodlejump.png',
  echecs: '/images/games/echecs.png',
  eaglercraft: '/images/games/minecraft.png',
  'flappy-bird': '/images/games/flappy.png',
  'fruit-ninja': '/images/games/fruit.png',
  'geometry-dash': '/images/games/geometry.png',
  'goyave-empire': '/images/games/goyave.png',
  hexgl: '/images/games/hexgl.png',
  'knife-hit': '/images/games/knife.png',
  loto: '/braquage-legal-logo.png',
  morpion: '/images/games/morpion.png',
  minesweeper: '/images/games/demineur.png',
  'petit-bac': '/images/games/bac.png',
  poker: '/images/games/poker.png',
  polytrack: '/images/games/polytrack.png',
  'puissance-quatre': '/images/games/puissance.png',
  racer: '/images/games/racer.png',
  'russian-roulette': '/images/games/roulette.png',
  'qs-watermelon': '/images/games/watermelon.png',
  snake: '/images/games/snake.png',
  solitaire: '/images/games/solitaire.png',
  'stack-tower': '/images/games/stack.png',
  'subway-surfers': '/images/games/subwaysurfer.png',
  sudoku: '/images/games/sudoku.png',
  'logic-lab': '/images/games/sudoku.png',
  opengd: '/images/games/geometry.png',
  tetris: '/images/games/tetris.png',
  uno: '/images/games/uno.png',
};

const CASINO_GAME_IMAGE_BY_ID: Record<string, string> = {
  roulette: '/images/games/roulette.png',
  slots: '/images/games/casino.png',
  blackjack: '/images/games/casino.png',
};

export const getGameImage = (gameId: string) => {
  return GAME_IMAGE_BY_ID[gameId] ?? GAME_IMAGE_FALLBACK;
};

export const getCasinoGameImage = (gameId: string) => {
  return CASINO_GAME_IMAGE_BY_ID[gameId] ?? GAME_IMAGE_FALLBACK;
};
