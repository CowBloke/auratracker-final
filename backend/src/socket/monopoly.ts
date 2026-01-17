import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';

const JOIN_TIMEOUT = 10000;
const PLAY_AGAIN_TIMEOUT = 20000;
const STARTING_CASH = 1500;
const PASS_GO_BONUS = 200;
const JAIL_FINE = 50;

const HOUSE_LIMIT = 5; // 5 = hotel

type TileType =
  | 'go'
  | 'property'
  | 'railroad'
  | 'utility'
  | 'chance'
  | 'community'
  | 'tax'
  | 'jail'
  | 'free-parking'
  | 'go-to-jail';

type CardType = 'money' | 'move' | 'jail' | 'repair' | 'collect' | 'pay';

interface CardDefinition {
  id: string;
  text: string;
  type: CardType;
  amount?: number;
  moveTo?: number;
  moveSteps?: number;
  nearest?: 'railroad' | 'utility';
  perHouse?: number;
  perHotel?: number;
}

interface TileDefinition {
  index: number;
  name: string;
  type: TileType;
  color?: string;
  price?: number;
  rent?: number[];
  houseCost?: number;
  taxAmount?: number;
}

interface TileState {
  ownerId?: string | null;
  houses: number;
  mortgaged: boolean;
}

interface MonopolyPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  isBankrupt: boolean;
}

interface PendingPurchase {
  tileIndex: number;
  price: number;
}

interface AuctionState {
  tileIndex: number;
  highestBid: number;
  highestBidderId: string | null;
  activeBidderIds: string[];
  currentBidderIndex: number;
  minBid: number;
}

interface MonopolyGame {
  partyId: string;
  players: MonopolyPlayer[];
  tiles: TileState[];
  currentPlayerIndex: number;
  lastRoll: { die1: number; die2: number; total: number; isDouble: boolean } | null;
  doublesCount: number;
  phase: 'waiting-roll' | 'jail' | 'resolve' | 'auction' | 'turn-end';
  pendingPurchase: PendingPurchase | null;
  auction: AuctionState | null;
  log: string[];
  turnNumber: number;
  chanceDeck: CardDefinition[];
  communityDeck: CardDefinition[];
  isActive: boolean;
}

interface PendingJoinPrompt {
  partyId: string;
  leaderId: string;
  responses: Map<string, boolean>;
  memberIds: string[];
  timer: NodeJS.Timeout | null;
  startTime: number;
}

interface PendingPlayAgainPrompt {
  partyId: string;
  responses: Map<string, boolean>;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  timer: NodeJS.Timeout | null;
  startTime: number;
  gameOverData: {
    winnerId: string | null;
    winnerUsername: string | null;
    standings: Array<{ userId: string; username: string; cash: number }>;
  };
}

const activeGames = new Map<string, MonopolyGame>();
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();

const BOARD: TileDefinition[] = [
  { index: 0, name: 'GO', type: 'go' },
  { index: 1, name: 'Mediterranean Avenue', type: 'property', color: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
  { index: 2, name: 'Community Chest', type: 'community' },
  { index: 3, name: 'Baltic Avenue', type: 'property', color: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
  { index: 4, name: 'Income Tax', type: 'tax', taxAmount: 200 },
  { index: 5, name: 'Reading Railroad', type: 'railroad', price: 200 },
  { index: 6, name: 'Oriental Avenue', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { index: 7, name: 'Chance', type: 'chance' },
  { index: 8, name: 'Vermont Avenue', type: 'property', color: 'lightblue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { index: 9, name: 'Connecticut Avenue', type: 'property', color: 'lightblue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
  { index: 10, name: 'Jail', type: 'jail' },
  { index: 11, name: 'St. Charles Place', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { index: 12, name: 'Electric Company', type: 'utility', price: 150 },
  { index: 13, name: 'States Avenue', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { index: 14, name: 'Virginia Avenue', type: 'property', color: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
  { index: 15, name: 'Pennsylvania Railroad', type: 'railroad', price: 200 },
  { index: 16, name: 'St. James Place', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { index: 17, name: 'Community Chest', type: 'community' },
  { index: 18, name: 'Tennessee Avenue', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { index: 19, name: 'New York Avenue', type: 'property', color: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
  { index: 20, name: 'Free Parking', type: 'free-parking' },
  { index: 21, name: 'Kentucky Avenue', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { index: 22, name: 'Chance', type: 'chance' },
  { index: 23, name: 'Indiana Avenue', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { index: 24, name: 'Illinois Avenue', type: 'property', color: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
  { index: 25, name: 'B. & O. Railroad', type: 'railroad', price: 200 },
  { index: 26, name: 'Atlantic Avenue', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { index: 27, name: 'Ventnor Avenue', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { index: 28, name: 'Water Works', type: 'utility', price: 150 },
  { index: 29, name: 'Marvin Gardens', type: 'property', color: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
  { index: 30, name: 'Go To Jail', type: 'go-to-jail' },
  { index: 31, name: 'Pacific Avenue', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { index: 32, name: 'North Carolina Avenue', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { index: 33, name: 'Community Chest', type: 'community' },
  { index: 34, name: 'Pennsylvania Avenue', type: 'property', color: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
  { index: 35, name: 'Short Line', type: 'railroad', price: 200 },
  { index: 36, name: 'Chance', type: 'chance' },
  { index: 37, name: 'Park Place', type: 'property', color: 'darkblue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
  { index: 38, name: 'Luxury Tax', type: 'tax', taxAmount: 100 },
  { index: 39, name: 'Boardwalk', type: 'property', color: 'darkblue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 },
];

const COLOR_GROUPS: Record<string, number[]> = {
  brown: [1, 3],
  lightblue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  darkblue: [37, 39],
};

const CHANCE_CARDS: CardDefinition[] = [
  { id: 'chance-go', text: 'Advance to GO (Collect $200).', type: 'move', moveTo: 0 },
  { id: 'chance-illinois', text: 'Advance to Illinois Avenue.', type: 'move', moveTo: 24 },
  { id: 'chance-charles', text: 'Advance to St. Charles Place.', type: 'move', moveTo: 11 },
  { id: 'chance-boardwalk', text: 'Advance to Boardwalk.', type: 'move', moveTo: 39 },
  { id: 'chance-nearest-railroad', text: 'Advance to the nearest Railroad.', type: 'move', nearest: 'railroad' },
  { id: 'chance-nearest-utility', text: 'Advance to the nearest Utility.', type: 'move', nearest: 'utility' },
  { id: 'chance-back-3', text: 'Go back 3 spaces.', type: 'move', moveSteps: -3 },
  { id: 'chance-bank-dividend', text: 'Bank pays you dividend of $50.', type: 'money', amount: 50 },
  { id: 'chance-poor-tax', text: 'Pay poor tax of $15.', type: 'pay', amount: 15 },
  { id: 'chance-go-jail', text: 'Go to Jail.', type: 'jail' },
  { id: 'chance-get-out', text: 'Get Out of Jail Free.', type: 'jail' },
  { id: 'chance-chairman', text: 'Pay each player $50.', type: 'collect', amount: 50 },
];

const COMMUNITY_CARDS: CardDefinition[] = [
  { id: 'community-go', text: 'Advance to GO (Collect $200).', type: 'move', moveTo: 0 },
  { id: 'community-bank-error', text: 'Bank error in your favor. Collect $200.', type: 'money', amount: 200 },
  { id: 'community-doctor', text: 'Doctor\'s fees. Pay $50.', type: 'pay', amount: 50 },
  { id: 'community-stock', text: 'From sale of stock you get $50.', type: 'money', amount: 50 },
  { id: 'community-get-out', text: 'Get Out of Jail Free.', type: 'jail' },
  { id: 'community-go-jail', text: 'Go to Jail.', type: 'jail' },
  { id: 'community-inherit', text: 'You inherit $100.', type: 'money', amount: 100 },
  { id: 'community-life', text: 'Life insurance matures. Collect $100.', type: 'money', amount: 100 },
  { id: 'community-hospital', text: 'Pay hospital fees of $100.', type: 'pay', amount: 100 },
  { id: 'community-school', text: 'Pay school fees of $50.', type: 'pay', amount: 50 },
  { id: 'community-birthday', text: 'It is your birthday. Collect $10 from each player.', type: 'collect', amount: 10 },
  { id: 'community-repairs', text: 'You are assessed for street repairs.', type: 'repair', perHouse: 40, perHotel: 115 },
];

const shuffle = <T,>(items: T[]): T[] => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const initTileState = (): TileState[] =>
  BOARD.map(() => ({ ownerId: null, houses: 0, mortgaged: false }));

const getCurrentPlayer = (game: MonopolyGame) => game.players[game.currentPlayerIndex];

const pushLog = (game: MonopolyGame, message: string) => {
  game.log.push(message);
  if (game.log.length > 12) {
    game.log.shift();
  }
};

const serializeGameState = (game: MonopolyGame) => ({
  partyId: game.partyId,
  tiles: BOARD.map((tile, idx) => ({
    ...tile,
    ownerId: game.tiles[idx].ownerId ?? null,
    houses: game.tiles[idx].houses,
    mortgaged: game.tiles[idx].mortgaged,
  })),
  players: game.players.map((p) => ({
    userId: p.userId,
    username: p.username,
    usernameColor: p.usernameColor,
    cash: p.cash,
    position: p.position,
    inJail: p.inJail,
    jailTurns: p.jailTurns,
    getOutOfJailCards: p.getOutOfJailCards,
    isBankrupt: p.isBankrupt,
  })),
  currentPlayerId: game.players[game.currentPlayerIndex]?.userId ?? null,
  lastRoll: game.lastRoll,
  doublesCount: game.doublesCount,
  phase: game.phase,
  pendingPurchase: game.pendingPurchase,
  auction: game.auction,
  log: game.log,
  turnNumber: game.turnNumber,
  isActive: game.isActive,
});

const getActivePlayers = (game: MonopolyGame) => game.players.filter((p) => !p.isBankrupt);

const findPlayerIndex = (game: MonopolyGame, userId: string) =>
  game.players.findIndex((p) => p.userId === userId);

const ownsAllInGroup = (game: MonopolyGame, playerId: string, color?: string) => {
  if (!color) return false;
  const group = COLOR_GROUPS[color];
  if (!group) return false;
  return group.every((idx) => game.tiles[idx].ownerId === playerId && !game.tiles[idx].mortgaged);
};

const countRailroadsOwned = (game: MonopolyGame, playerId: string) =>
  BOARD.filter((tile, idx) => tile.type === 'railroad' && game.tiles[idx].ownerId === playerId).length;

const countUtilitiesOwned = (game: MonopolyGame, playerId: string) =>
  BOARD.filter((tile, idx) => tile.type === 'utility' && game.tiles[idx].ownerId === playerId).length;

const getRent = (game: MonopolyGame, tileIndex: number, diceTotal: number) => {
  const tile = BOARD[tileIndex];
  const state = game.tiles[tileIndex];
  if (!state.ownerId || state.mortgaged) return 0;

  if (tile.type === 'property' && tile.rent) {
    const houses = state.houses;
    if (houses > 0) {
      return tile.rent[Math.min(houses, tile.rent.length - 1)] || tile.rent[0];
    }
    const baseRent = tile.rent[0] || 0;
    return ownsAllInGroup(game, state.ownerId, tile.color) ? baseRent * 2 : baseRent;
  }

  if (tile.type === 'railroad') {
    const count = countRailroadsOwned(game, state.ownerId);
    return [0, 25, 50, 100, 200][count] || 25;
  }

  if (tile.type === 'utility') {
    const count = countUtilitiesOwned(game, state.ownerId);
    const multiplier = count >= 2 ? 10 : 4;
    return multiplier * diceTotal;
  }

  return 0;
};

const adjustCash = (player: MonopolyPlayer, amount: number) => {
  player.cash += amount;
};

const sellHouse = (game: MonopolyGame, tileIndex: number) => {
  const tile = BOARD[tileIndex];
  const state = game.tiles[tileIndex];
  if (tile.type !== 'property' || state.houses <= 0 || !tile.houseCost) return 0;
  state.houses -= 1;
  return Math.floor(tile.houseCost / 2);
};

const mortgageProperty = (game: MonopolyGame, tileIndex: number) => {
  const tile = BOARD[tileIndex];
  const state = game.tiles[tileIndex];
  if (!tile.price || state.mortgaged || state.houses > 0 || !state.ownerId) return 0;
  state.mortgaged = true;
  return Math.floor(tile.price / 2);
};

const liquidateForPayment = (game: MonopolyGame, player: MonopolyPlayer, amount: number) => {
  if (player.cash >= amount) return;

  const ownedIndexes = BOARD.map((tile, idx) => ({ tile, idx }))
    .filter(({ tile, idx }) => game.tiles[idx].ownerId === player.userId && tile.type === 'property')
    .map(({ idx }) => idx);

  // Sell houses first
  let iterations = 0;
  while (player.cash < amount && iterations < 200) {
    iterations += 1;
    const withHouses = ownedIndexes.filter((idx) => game.tiles[idx].houses > 0);
    if (withHouses.length === 0) break;
    const idx = withHouses.sort((a, b) => game.tiles[b].houses - game.tiles[a].houses)[0];
    const cash = sellHouse(game, idx);
    if (cash > 0) {
      adjustCash(player, cash);
      pushLog(game, `${player.username} vend une maison sur ${BOARD[idx].name}.`);
    } else {
      break;
    }
  }

  // Mortgage properties if still short
  if (player.cash < amount) {
    const mortgageTargets = ownedIndexes.filter((idx) => game.tiles[idx].houses === 0 && !game.tiles[idx].mortgaged);
    for (const idx of mortgageTargets) {
      if (player.cash >= amount) break;
      const cash = mortgageProperty(game, idx);
      if (cash > 0) {
        adjustCash(player, cash);
        pushLog(game, `${player.username} hypothèque ${BOARD[idx].name}.`);
      }
    }
  }
};

const handleBankruptcy = (game: MonopolyGame, player: MonopolyPlayer, creditorId: string | null, io: Server) => {
  player.isBankrupt = true;
  pushLog(game, `${player.username} est en faillite.`);

  for (let i = 0; i < game.tiles.length; i++) {
    if (game.tiles[i].ownerId === player.userId) {
      if (creditorId) {
        game.tiles[i].ownerId = creditorId;
        game.tiles[i].houses = 0;
      } else {
        game.tiles[i].ownerId = null;
        game.tiles[i].houses = 0;
        game.tiles[i].mortgaged = false;
      }
    }
  }

  player.cash = 0;

  const active = getActivePlayers(game);
  if (active.length <= 1) {
    endGame(game, active[0]?.userId || null, io);
  }
};

const payAmount = (
  game: MonopolyGame,
  player: MonopolyPlayer,
  amount: number,
  recipientId: string | null,
  io: Server,
) => {
  if (amount <= 0) return;
  liquidateForPayment(game, player, amount);
  if (player.cash < amount) {
    handleBankruptcy(game, player, recipientId, io);
    return;
  }
  adjustCash(player, -amount);
  if (recipientId) {
    const recipient = game.players.find((p) => p.userId === recipientId);
    if (recipient) {
      adjustCash(recipient, amount);
    }
  }
};

const moveToTile = (game: MonopolyGame, player: MonopolyPlayer, targetIndex: number, collectGo: boolean) => {
  if (collectGo && targetIndex < player.position) {
    adjustCash(player, PASS_GO_BONUS);
    pushLog(game, `${player.username} passe par GO et collecte $${PASS_GO_BONUS}.`);
  }
  player.position = targetIndex;
};

const sendToJail = (game: MonopolyGame, player: MonopolyPlayer) => {
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  game.doublesCount = 0;
  game.phase = 'jail';
  pushLog(game, `${player.username} va en prison.`);
};

const drawCard = (game: MonopolyGame, deckType: 'chance' | 'community') => {
  const deck = deckType === 'chance' ? game.chanceDeck : game.communityDeck;
  if (deck.length === 0) return null;
  const card = deck.shift() || null;
  if (card && !(card.type === 'jail' && card.id.includes('get-out'))) {
    deck.push(card);
  }
  return card;
};

const applyCard = (game: MonopolyGame, player: MonopolyPlayer, card: CardDefinition, io: Server) => {
  pushLog(game, `${player.username} tire une carte: ${card.text}`);

  if (card.type === 'money' && card.amount) {
    adjustCash(player, card.amount);
    return;
  }

  if (card.type === 'pay' && card.amount) {
    payAmount(game, player, card.amount, null, io);
    return;
  }

  if (card.type === 'collect' && card.amount) {
    game.players.forEach((p) => {
      if (p.userId !== player.userId && !p.isBankrupt) {
        payAmount(game, p, card.amount || 0, player.userId, io);
      }
    });
    return;
  }

  if (card.type === 'repair') {
    let total = 0;
    for (let i = 0; i < game.tiles.length; i++) {
      if (game.tiles[i].ownerId === player.userId) {
        const houses = game.tiles[i].houses;
        if (houses >= HOUSE_LIMIT) {
          total += card.perHotel || 0;
        } else {
          total += houses * (card.perHouse || 0);
        }
      }
    }
    if (total > 0) {
      payAmount(game, player, total, null, io);
    }
    return;
  }

  if (card.type === 'jail') {
    if (card.id.includes('get-out')) {
      player.getOutOfJailCards += 1;
      return;
    }
    sendToJail(game, player);
    return;
  }

  if (card.type === 'move') {
    if (typeof card.moveSteps === 'number') {
      const newIndex = (player.position + card.moveSteps + BOARD.length) % BOARD.length;
      player.position = newIndex;
      resolveTile(game, player, io);
      return;
    }

    if (card.nearest) {
      const targets = BOARD.map((tile, idx) => ({ tile, idx }))
        .filter(({ tile }) => tile.type === card.nearest)
        .map(({ idx }) => idx);
      const current = player.position;
      let target = targets.find((idx) => idx > current);
      if (target === undefined) {
        target = targets[0];
      }
      moveToTile(game, player, target, true);
      resolveTile(game, player, io);
      return;
    }

    if (typeof card.moveTo === 'number') {
      moveToTile(game, player, card.moveTo, true);
      resolveTile(game, player, io);
    }
  }
};

const resolveTile = (game: MonopolyGame, player: MonopolyPlayer, io: Server) => {
  if (!game.isActive) return;
  const tileIndex = player.position;
  const tile = BOARD[tileIndex];
  const state = game.tiles[tileIndex];

  if (tile.type === 'go-to-jail') {
    sendToJail(game, player);
    return;
  }

  if (tile.type === 'tax' && tile.taxAmount) {
    payAmount(game, player, tile.taxAmount, null, io);
    pushLog(game, `${player.username} paie $${tile.taxAmount} de taxe.`);
    return;
  }

  if (tile.type === 'chance') {
    const card = drawCard(game, 'chance');
    if (card) {
      applyCard(game, player, card, io);
    }
    return;
  }

  if (tile.type === 'community') {
    const card = drawCard(game, 'community');
    if (card) {
      applyCard(game, player, card, io);
    }
    return;
  }

  if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
    if (!state.ownerId) {
      if (tile.price && player.cash >= tile.price) {
        game.pendingPurchase = { tileIndex, price: tile.price };
        game.phase = 'resolve';
        pushLog(game, `${player.username} peut acheter ${tile.name} pour $${tile.price}.`);
      } else {
        startAuction(game, tileIndex);
      }
      return;
    }

    if (state.ownerId && state.ownerId !== player.userId) {
      const rent = getRent(game, tileIndex, game.lastRoll?.total || 0);
      if (rent > 0) {
        payAmount(game, player, rent, state.ownerId, io);
        pushLog(game, `${player.username} paie $${rent} de loyer pour ${tile.name}.`);
      }
    }
  }
};

const startAuction = (game: MonopolyGame, tileIndex: number) => {
  const activeIds = game.players.filter((p) => !p.isBankrupt).map((p) => p.userId);
  game.auction = {
    tileIndex,
    highestBid: 0,
    highestBidderId: null,
    activeBidderIds: [...activeIds],
    currentBidderIndex: 0,
    minBid: 1,
  };
  game.phase = 'auction';
  game.pendingPurchase = null;
  pushLog(game, `Encheres ouvertes pour ${BOARD[tileIndex].name}.`);
};

const advanceAuction = (game: MonopolyGame, io: Server) => {
  const auction = game.auction;
  if (!auction) return;

  if (auction.activeBidderIds.length <= 1) {
    if (auction.highestBidderId) {
      const winner = game.players.find((p) => p.userId === auction.highestBidderId);
      const tileIndex = auction.tileIndex;
      const tile = BOARD[tileIndex];
      if (winner && tile.price) {
        payAmount(game, winner, auction.highestBid, null, io);
        game.tiles[tileIndex].ownerId = winner.userId;
        pushLog(game, `${winner.username} gagne ${tile.name} pour $${auction.highestBid}.`);
      }
    } else {
      pushLog(game, `Aucun enchere pour ${BOARD[auction.tileIndex].name}.`);
    }
    game.auction = null;
    game.phase = 'turn-end';
    return;
  }

  auction.currentBidderIndex = (auction.currentBidderIndex + 1) % auction.activeBidderIds.length;
};

const endTurn = (game: MonopolyGame, io: Server) => {
  const active = getActivePlayers(game);
  if (active.length <= 1) {
    endGame(game, active[0]?.userId || null, io);
    return;
  }

  let nextIndex = game.currentPlayerIndex;
  let attempts = 0;
  do {
    nextIndex = (nextIndex + 1) % game.players.length;
    attempts += 1;
  } while (game.players[nextIndex].isBankrupt && attempts < game.players.length);

  game.currentPlayerIndex = nextIndex;
  game.doublesCount = 0;
  game.lastRoll = null;
  game.pendingPurchase = null;
  game.auction = null;
  game.turnNumber += 1;
  const current = getCurrentPlayer(game);
  game.phase = current.inJail ? 'jail' : 'waiting-roll';
  pushLog(game, `Tour de ${current.username}.`);
};

const endGame = (game: MonopolyGame, winnerId: string | null, io: Server | null) => {
  game.isActive = false;
  const winner = winnerId ? game.players.find((p) => p.userId === winnerId) : null;
  const standings = game.players
    .map((p) => ({ userId: p.userId, username: p.username, cash: p.cash }))
    .sort((a, b) => b.cash - a.cash);

  const gameOverData = {
    winnerId: winner?.userId || null,
    winnerUsername: winner?.username || null,
    standings,
  };

  activeGames.delete(game.partyId);

  if (io) {
    io.to(`party:${game.partyId}`).emit('monopoly:game-over', gameOverData);

    const playAgainPrompt: PendingPlayAgainPrompt = {
      partyId: game.partyId,
      responses: new Map(),
      players: game.players.map((p) => ({
        userId: p.userId,
        username: p.username,
        usernameColor: p.usernameColor,
      })),
      timer: null,
      startTime: Date.now(),
      gameOverData,
    };

    pendingPlayAgainPrompts.set(game.partyId, playAgainPrompt);

    playAgainPrompt.timer = setTimeout(() => resolvePlayAgainPrompt(game.partyId, io), PLAY_AGAIN_TIMEOUT);

    io.to(`party:${game.partyId}`).emit('monopoly:play-again-prompt', {
      partyId: game.partyId,
      timeLimit: PLAY_AGAIN_TIMEOUT,
      startTime: playAgainPrompt.startTime,
      players: playAgainPrompt.players,
      responses: [],
      gameOverData,
    });
  }
};

const resolvePlayAgainPrompt = (partyId: string, io: Server) => {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;

  if (prompt.timer) {
    clearTimeout(prompt.timer);
    prompt.timer = null;
  }

  const accepted = Array.from(prompt.responses.entries())
    .filter(([_, ok]) => ok)
    .map(([id]) => id);

  pendingPlayAgainPrompts.delete(partyId);

  if (accepted.length < 2) {
    io.to(`party:${partyId}`).emit('monopoly:play-again-cancelled', {
      reason: 'Not enough players accepted',
    });
    return;
  }

  startGame(partyId, accepted, io);
};

const startGame = async (partyId: string, acceptedIds: string[], io: Server) => {
  const partyMembers = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: {
      user: { select: { id: true, username: true, usernameColor: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });

  const players: MonopolyPlayer[] = partyMembers.map((m) => ({
    userId: m.user.id,
    username: m.user.username,
    usernameColor: m.user.usernameColor,
    cash: STARTING_CASH,
    position: 0,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    isBankrupt: false,
  }));

  const shuffled = shuffle(players);

  const game: MonopolyGame = {
    partyId,
    players: shuffled,
    tiles: initTileState(),
    currentPlayerIndex: 0,
    lastRoll: null,
    doublesCount: 0,
    phase: shuffled[0]?.inJail ? 'jail' : 'waiting-roll',
    pendingPurchase: null,
    auction: null,
    log: [],
    turnNumber: 1,
    chanceDeck: shuffle(CHANCE_CARDS),
    communityDeck: shuffle(COMMUNITY_CARDS),
    isActive: true,
  };

  pushLog(game, `Tour de ${shuffled[0]?.username}.`);

  activeGames.set(partyId, game);
  io.to(`party:${partyId}`).emit('monopoly:started', serializeGameState(game));
};

export const setupMonopolyHandlers = (socket: Socket, io: Server) => {
  socket.on('monopoly:start', async (data: { userId: string; partyId: string }) => {
    const { userId, partyId } = data;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: { party: true },
      });

      if (!membership || membership.partyId !== partyId) {
        socket.emit('monopoly:error', { message: 'You are not in this party' });
        return;
      }

      if (!membership.isLeader) {
        socket.emit('monopoly:error', { message: 'Only the party leader can start the game' });
        return;
      }

      if (activeGames.has(partyId) || pendingJoinPrompts.has(partyId)) {
        socket.emit('monopoly:error', { message: 'A game is already in progress' });
        return;
      }

      const partyMembers = await prisma.partyMember.findMany({
        where: { partyId },
        include: {
          user: { select: { id: true, username: true, usernameColor: true } },
        },
        orderBy: { joinedAt: 'asc' },
      });

      if (partyMembers.length < 2) {
        socket.emit('monopoly:error', { message: 'Need at least 2 players to start' });
        return;
      }

      const prompt: PendingJoinPrompt = {
        partyId,
        leaderId: userId,
        responses: new Map(),
        memberIds: partyMembers.map((m) => m.userId),
        timer: null,
        startTime: Date.now(),
      };

      pendingJoinPrompts.set(partyId, prompt);

      prompt.timer = setTimeout(() => resolveJoinPrompt(partyId, io), JOIN_TIMEOUT);

      io.to(`party:${partyId}`).emit('monopoly:join-prompt', {
        partyId,
        leaderId: userId,
        timeLimit: JOIN_TIMEOUT,
        startTime: prompt.startTime,
        members: partyMembers.map((m) => ({
          userId: m.userId,
          username: m.user.username,
          usernameColor: m.user.usernameColor,
        })),
        responses: [],
      });
    } catch (error) {
      console.error('Start monopoly error:', error);
      socket.emit('monopoly:error', { message: 'Failed to start game' });
    }
  });

  socket.on('monopoly:join-response', (data: { partyId: string; userId: string; accepted: boolean }) => {
    const { partyId, userId, accepted } = data;
    const prompt = pendingJoinPrompts.get(partyId);
    if (!prompt) return;

    if (!prompt.memberIds.includes(userId)) return;

    prompt.responses.set(userId, accepted);

    io.to(`party:${partyId}`).emit('monopoly:join-response-update', {
      partyId,
      responses: Array.from(prompt.responses.entries()).map(([id, ok]) => ({ userId: id, accepted: ok })),
    });

    if (prompt.memberIds.every((id) => prompt.responses.has(id))) {
      resolveJoinPrompt(partyId, io);
    }
  });

  socket.on('monopoly:roll', (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive) return;

    const current = getCurrentPlayer(game);
    if (!current || current.userId !== userId) return;
    if (game.phase !== 'waiting-roll') return;
    if (current.inJail) return;

    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;
    const isDouble = die1 === die2;

    game.lastRoll = { die1, die2, total, isDouble };

    if (isDouble) {
      game.doublesCount += 1;
    } else {
      game.doublesCount = 0;
    }

    if (game.doublesCount >= 3) {
      sendToJail(game, current);
      game.phase = 'turn-end';
      io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
      return;
    }

    const start = current.position;
    const next = (start + total) % BOARD.length;
    if (next < start) {
      adjustCash(current, PASS_GO_BONUS);
      pushLog(game, `${current.username} passe par GO et collecte $${PASS_GO_BONUS}.`);
    }

    current.position = next;
    pushLog(game, `${current.username} avance de ${total} cases.`);

    resolveTile(game, current, io);

    if (!game.isActive) return;
    if (current.isBankrupt) {
      endTurn(game, io);
      io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
      return;
    }
    if (game.pendingPurchase || game.auction || current.inJail) {
      io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
      return;
    }

    game.phase = isDouble ? 'waiting-roll' : 'turn-end';
    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:jail-roll', (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive) return;

    const current = getCurrentPlayer(game);
    if (!current || current.userId !== userId) return;
    if (!current.inJail || game.phase !== 'jail') return;

    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;
    const isDouble = die1 === die2;

    game.lastRoll = { die1, die2, total, isDouble };

    if (isDouble) {
      current.inJail = false;
      current.jailTurns = 0;
      pushLog(game, `${current.username} sort de prison avec un double.`);
      const next = (current.position + total) % BOARD.length;
      if (next < current.position) {
        adjustCash(current, PASS_GO_BONUS);
        pushLog(game, `${current.username} passe par GO et collecte $${PASS_GO_BONUS}.`);
      }
      current.position = next;
      resolveTile(game, current, io);
      if (!game.isActive) return;
      if (current.isBankrupt) {
        endTurn(game, io);
        io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
        return;
      }
      if (game.pendingPurchase || game.auction) {
        io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
        return;
      }
      game.phase = 'turn-end';
      io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
      return;
    }

    current.jailTurns += 1;
    pushLog(game, `${current.username} rate son double (${current.jailTurns}/3).`);

    if (current.jailTurns >= 3) {
      payAmount(game, current, JAIL_FINE, null, io);
      if (!game.isActive) return;
      if (current.isBankrupt) {
        endTurn(game, io);
        io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
        return;
      }
      current.inJail = false;
      current.jailTurns = 0;
      const next = (current.position + total) % BOARD.length;
      if (next < current.position) {
        adjustCash(current, PASS_GO_BONUS);
        pushLog(game, `${current.username} passe par GO et collecte $${PASS_GO_BONUS}.`);
      }
      current.position = next;
      resolveTile(game, current, io);
      if (!game.isActive) return;
      if (current.isBankrupt) {
        endTurn(game, io);
        io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
        return;
      }
      if (game.pendingPurchase || game.auction) {
        io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
        return;
      }
      game.phase = 'turn-end';
    }

    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:jail-pay', (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive) return;
    const current = getCurrentPlayer(game);
    if (!current || current.userId !== userId) return;
    if (!current.inJail || game.phase !== 'jail') return;

    payAmount(game, current, JAIL_FINE, null, io);
    if (!game.isActive) return;
    if (current.isBankrupt) {
      endTurn(game, io);
      io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
      return;
    }
    current.inJail = false;
    current.jailTurns = 0;
    game.phase = 'waiting-roll';
    pushLog(game, `${current.username} paye $${JAIL_FINE} pour sortir de prison.`);
    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:jail-use-card', (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive) return;
    const current = getCurrentPlayer(game);
    if (!current || current.userId !== userId) return;
    if (!current.inJail || game.phase !== 'jail') return;

    if (current.getOutOfJailCards <= 0) return;
    current.getOutOfJailCards -= 1;
    current.inJail = false;
    current.jailTurns = 0;
    game.phase = 'waiting-roll';
    pushLog(game, `${current.username} utilise une carte de sortie de prison.`);
    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:buy', (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive) return;

    const current = getCurrentPlayer(game);
    if (!current || current.userId !== userId) return;
    if (!game.pendingPurchase) return;

    const { tileIndex, price } = game.pendingPurchase;
    if (current.cash < price) return;

    payAmount(game, current, price, null, io);
    game.tiles[tileIndex].ownerId = current.userId;
    game.pendingPurchase = null;
    pushLog(game, `${current.username} achete ${BOARD[tileIndex].name} pour $${price}.`);

    game.phase = game.lastRoll?.isDouble ? 'waiting-roll' : 'turn-end';

    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:decline', (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive) return;
    const current = getCurrentPlayer(game);
    if (!current || current.userId !== userId) return;
    if (!game.pendingPurchase) return;

    startAuction(game, game.pendingPurchase.tileIndex);
    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:auction-bid', (data: { partyId: string; userId: string; amount: number }) => {
    const { partyId, userId, amount } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive || !game.auction) return;

    const auction = game.auction;
    const bidderId = auction.activeBidderIds[auction.currentBidderIndex];
    if (bidderId !== userId) return;

    const bidder = game.players.find((p) => p.userId === userId);
    if (!bidder || bidder.cash < amount) return;

    const minBid = Math.max(auction.minBid, auction.highestBid + 1);
    if (amount < minBid) return;

    auction.highestBid = amount;
    auction.highestBidderId = userId;
    pushLog(game, `${bidder.username} encherit $${amount}.`);
    advanceAuction(game, io);

    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:auction-pass', (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive || !game.auction) return;

    const auction = game.auction;
    const bidderId = auction.activeBidderIds[auction.currentBidderIndex];
    if (bidderId !== userId) return;

    auction.activeBidderIds = auction.activeBidderIds.filter((id) => id !== userId);
    pushLog(game, `${game.players.find((p) => p.userId === userId)?.username || 'Joueur'} passe.`);

    if (auction.currentBidderIndex >= auction.activeBidderIds.length) {
      auction.currentBidderIndex = 0;
    }

    advanceAuction(game, io);

    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:build', (data: { partyId: string; userId: string; tileIndex: number; count?: number }) => {
    const { partyId, userId, tileIndex, count } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive) return;

    const current = getCurrentPlayer(game);
    if (!current || current.userId !== userId) return;
    if (game.phase === 'auction' || game.pendingPurchase) return;

    const tile = BOARD[tileIndex];
    const state = game.tiles[tileIndex];
    if (tile.type !== 'property' || state.ownerId !== userId || state.mortgaged || !tile.houseCost) return;

    if (!ownsAllInGroup(game, userId, tile.color)) return;

    const group = COLOR_GROUPS[tile.color || ''] || [];
    const minHouses = Math.min(...group.map((idx) => game.tiles[idx].houses));
    if (state.houses > minHouses) return; // enforce even build

    const buildCount = Math.max(1, Math.min(count || 1, HOUSE_LIMIT - state.houses));
    const cost = tile.houseCost * buildCount;
    if (current.cash < cost) return;

    payAmount(game, current, cost, null, io);
    state.houses += buildCount;
    pushLog(game, `${current.username} construit ${buildCount} maison(s) sur ${tile.name}.`);
    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:sell', (data: { partyId: string; userId: string; tileIndex: number; count?: number }) => {
    const { partyId, userId, tileIndex, count } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive) return;

    const current = getCurrentPlayer(game);
    if (!current || current.userId !== userId) return;
    if (game.phase === 'auction' || game.pendingPurchase) return;

    const tile = BOARD[tileIndex];
    const state = game.tiles[tileIndex];
    if (tile.type !== 'property' || state.ownerId !== userId || state.houses <= 0 || !tile.houseCost) return;

    const sellCount = Math.max(1, Math.min(count || 1, state.houses));
    let cash = 0;
    for (let i = 0; i < sellCount; i++) {
      cash += sellHouse(game, tileIndex);
    }
    adjustCash(current, cash);
    pushLog(game, `${current.username} vend ${sellCount} maison(s) sur ${tile.name}.`);
    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:mortgage', (data: { partyId: string; userId: string; tileIndex: number }) => {
    const { partyId, userId, tileIndex } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive) return;
    const current = getCurrentPlayer(game);
    if (!current || current.userId !== userId) return;
    if (game.phase === 'auction' || game.pendingPurchase) return;

    const tile = BOARD[tileIndex];
    const state = game.tiles[tileIndex];
    if (!tile.price || state.ownerId !== userId || state.houses > 0 || state.mortgaged) return;

    const cash = mortgageProperty(game, tileIndex);
    if (cash > 0) {
      adjustCash(current, cash);
      pushLog(game, `${current.username} hypothèque ${tile.name}.`);
      io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
    }
  });

  socket.on('monopoly:unmortgage', (data: { partyId: string; userId: string; tileIndex: number }) => {
    const { partyId, userId, tileIndex } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive) return;
    const current = getCurrentPlayer(game);
    if (!current || current.userId !== userId) return;
    if (game.phase === 'auction' || game.pendingPurchase) return;

    const tile = BOARD[tileIndex];
    const state = game.tiles[tileIndex];
    if (!tile.price || state.ownerId !== userId || !state.mortgaged) return;

    const cost = Math.floor(tile.price / 2 * 1.1);
    if (current.cash < cost) return;

    payAmount(game, current, cost, null, io);
    state.mortgaged = false;
    pushLog(game, `${current.username} leve l'hypotheque de ${tile.name}.`);
    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:end-turn', (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive) return;

    const current = getCurrentPlayer(game);
    if (!current || current.userId !== userId) return;
    if (game.phase !== 'turn-end') return;

    endTurn(game, io);
    io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
  });

  socket.on('monopoly:leave', (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    const game = activeGames.get(partyId);
    if (!game) return;

    const player = game.players.find((p) => p.userId === userId);
    if (!player) return;

    handleBankruptcy(game, player, null, io);
    if (game.isActive) {
      if (game.players[game.currentPlayerIndex]?.userId === userId) {
        endTurn(game, io);
      }
      io.to(`party:${partyId}`).emit('monopoly:updated', serializeGameState(game));
    }
  });

  socket.on('monopoly:play-again-response', (data: { partyId: string; userId: string; playAgain: boolean }) => {
    const { partyId, userId, playAgain } = data;
    const prompt = pendingPlayAgainPrompts.get(partyId);
    if (!prompt) return;

    if (!prompt.players.find((p) => p.userId === userId)) return;

    prompt.responses.set(userId, playAgain);

    io.to(`party:${partyId}`).emit('monopoly:play-again-response-update', {
      partyId,
      responses: Array.from(prompt.responses.entries()).map(([id, ok]) => ({ userId: id, playAgain: ok })),
    });

    if (prompt.players.every((p) => prompt.responses.has(p.userId))) {
      resolvePlayAgainPrompt(partyId, io);
    }
  });
};

const resolveJoinPrompt = async (partyId: string, io: Server) => {
  const prompt = pendingJoinPrompts.get(partyId);
  if (!prompt) return;

  if (prompt.timer) {
    clearTimeout(prompt.timer);
    prompt.timer = null;
  }

  const accepted = Array.from(prompt.responses.entries())
    .filter(([_, ok]) => ok)
    .map(([id]) => id);

  pendingJoinPrompts.delete(partyId);

  if (accepted.length < 2) {
    io.to(`party:${partyId}`).emit('monopoly:join-cancelled', {
      reason: 'Not enough players accepted',
    });
    return;
  }

  await startGame(partyId, accepted, io);
};

export function sendActiveMonopolyState(socket: Socket, partyId: string, userId: string) {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;
  const isPlayer = game.players.some((p) => p.userId === userId);
  if (!isPlayer) return;
  socket.emit('monopoly:started', serializeGameState(game));
}

export function sendPendingMonopolyPlayAgainPrompt(socket: Socket, partyId: string, userId: string) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  const isPlayer = prompt.players.some((p) => p.userId === userId);
  if (!isPlayer) return;

  const elapsed = Date.now() - prompt.startTime;
  const timeRemaining = Math.max(0, PLAY_AGAIN_TIMEOUT - elapsed);
  if (timeRemaining <= 0) return;

  const responses = Array.from(prompt.responses.entries()).map(([id, ok]) => ({
    userId: id,
    playAgain: ok,
  }));

  socket.emit('monopoly:play-again-prompt', {
    partyId: prompt.partyId,
    timeLimit: timeRemaining,
    startTime: prompt.startTime,
    players: prompt.players,
    responses,
    gameOverData: prompt.gameOverData,
  });
}
