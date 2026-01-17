import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';

type Stage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
type PokerAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';

interface PokerPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  chips: number;
  bet: number; // Current round contribution
  totalBet: number; // Total contribution for this hand
  hand: string[];
  hasFolded: boolean;
  isAllIn: boolean;
  isEliminated: boolean;
  lastAction: PokerAction | 'small-blind' | 'big-blind' | null;
  hasActedThisRound: boolean;
}

interface PokerGame {
  partyId: string;
  players: PokerPlayer[];
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentPlayerIndex: number;
  deck: string[];
  communityCards: string[];
  stage: Stage;
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
  highestBet: number;
  isActive: boolean;
  handNumber: number;
  maxHands: number;
  startingStack: number;
  turnTimer: NodeJS.Timeout | null;
  turnStartTime: number;
  lastHandResult?: HandResult;
}

interface HandResult {
  winners: Array<{ userId: string; username: string; amountWon: number; handRank: string }>;
  showdown: Array<{ userId: string; username: string; hand: string[]; handRank: string }>;
  pot: number;
}

interface PendingJoinPrompt {
  partyId: string;
  leaderId: string;
  startStack: number;
  bigBlind: number;
  responses: Map<string, boolean>;
  memberIds: string[];
  timer: NodeJS.Timeout | null;
}

interface PendingPlayAgainPrompt {
  partyId: string;
  startStack: number;
  bigBlind: number;
  responses: Map<string, boolean>;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  timer: NodeJS.Timeout | null;
}

const activeGames = new Map<string, PokerGame>();
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();
const playerSockets = new Map<string, string>();

const JOIN_TIMEOUT = 10000;
const PLAY_AGAIN_TIMEOUT = 20000;
const ACTION_TIME_LIMIT = 25000;
const MAX_HANDS = 20;
const DEFAULT_STACK = 800;
const MIN_STACK = 200;
const MAX_STACK = 2000;

const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const suitOrder = ['h', 'd', 'c', 's'];

const createDeck = () => {
  const deck: string[] = [];
  for (const rank of rankOrder) {
    for (const suit of suitOrder) {
      deck.push(`${rank}${suit}`);
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const getNextActiveIndex = (players: PokerPlayer[], startIndex: number, predicate?: (p: PokerPlayer) => boolean) => {
  const total = players.length;
  for (let i = 1; i <= total; i++) {
    const idx = (startIndex + i) % total;
    const player = players[idx];
    if (!player.isEliminated && (!predicate || predicate(player))) {
      return idx;
    }
  }
  return -1;
};

const actionable = (player: PokerPlayer) =>
  !player.hasFolded && !player.isAllIn && !player.isEliminated && player.chips > 0;

const activeAndWithChips = (player: PokerPlayer) => !player.isEliminated && player.chips > 0;

const resetActionFlags = (game: PokerGame, actingIndex?: number) => {
  game.players.forEach((p, idx) => {
    if (!p.hasFolded && !p.isEliminated) {
      p.hasActedThisRound = false;
    }
    if (actingIndex !== undefined && idx === actingIndex) {
      p.hasActedThisRound = true;
    }
  });
};

const calculatePot = (game: PokerGame) =>
  game.players.reduce((sum, p) => sum + (p.totalBet || 0), 0);

const cardValue = (card: string) => rankOrder.indexOf(card[0]);
const cardSuit = (card: string) => card[1];

interface HandValue {
  rank: number; // 8 straight flush -> 0 high card
  highCards: number[];
  description: string;
}

const isStraight = (values: number[]) => {
  const unique = Array.from(new Set(values)).sort((a, b) => b - a);
  if (unique.length < 5) return null;

  for (let i = 0; i <= unique.length - 5; i++) {
    const window = unique.slice(i, i + 5);
    if (window[0] - window[4] === 4) return window[0];
  }

  // Wheel straight (A-2-3-4-5)
  if (unique.includes(12) && unique.includes(3) && unique.includes(2) && unique.includes(1) && unique.includes(0)) {
    return 3; // Five-high straight value anchor
  }
  return null;
};

const evaluateFive = (cards: string[]): HandValue => {
  const values = cards.map(cardValue).sort((a, b) => b - a);
  const suits = cards.map(cardSuit);

  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const flushSuit = new Set(suits).size === 1 ? suits[0] : null;
  const flushCards = flushSuit ? cards : [];
  const flushValues = flushCards.map(cardValue).sort((a, b) => b - a);
  const straightHigh = isStraight(values);
  const straightFlushHigh =
    flushCards.length >= 5 ? isStraight(flushCards.map(cardValue).sort((a, b) => b - a)) : null;

  if (straightFlushHigh !== null) {
    return { rank: 8, highCards: [straightFlushHigh], description: 'Quinte flush' };
  }

  if (groups[0][1] === 4) {
    const kicker = values.find((v) => v !== groups[0][0]) || 0;
    return { rank: 7, highCards: [groups[0][0], kicker], description: 'Carré' };
  }

  if (groups[0][1] === 3 && groups[1]?.[1] >= 2) {
    return { rank: 6, highCards: [groups[0][0], groups[1][0]], description: 'Full' };
  }

  if (flushCards.length >= 5) {
    return { rank: 5, highCards: flushValues.slice(0, 5), description: 'Couleur' };
  }

  if (straightHigh !== null) {
    return { rank: 4, highCards: [straightHigh], description: 'Quinte' };
  }

  if (groups[0][1] === 3) {
    const kickers = values.filter((v) => v !== groups[0][0]).slice(0, 2);
    return { rank: 3, highCards: [groups[0][0], ...kickers], description: 'Brelan' };
  }

  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const pairHigh = groups[0][0];
    const pairLow = groups[1][0];
    const kicker = values.find((v) => v !== pairHigh && v !== pairLow) || 0;
    return { rank: 2, highCards: [pairHigh, pairLow, kicker], description: 'Double paire' };
  }

  if (groups[0][1] === 2) {
    const kickers = values.filter((v) => v !== groups[0][0]).slice(0, 3);
    return { rank: 1, highCards: [groups[0][0], ...kickers], description: 'Paire' };
  }

  return { rank: 0, highCards: values.slice(0, 5), description: 'Hauteur' };
};

const bestHand = (cards: string[]): HandValue => {
  let best: HandValue | null = null;
  for (let i = 0; i < cards.length - 4; i++) {
    for (let j = i + 1; j < cards.length - 3; j++) {
      for (let k = j + 1; k < cards.length - 2; k++) {
        for (let l = k + 1; l < cards.length - 1; l++) {
          for (let m = l + 1; m < cards.length; m++) {
            const hand = evaluateFive([cards[i], cards[j], cards[k], cards[l], cards[m]]);
            if (!best || compareHands(hand, best) > 0) {
              best = hand;
            }
          }
        }
      }
    }
  }
  return best || evaluateFive(cards.slice(0, 5));
};

const compareHands = (a: HandValue, b: HandValue) => {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.highCards.length, b.highCards.length); i++) {
    const av = a.highCards[i] ?? 0;
    const bv = b.highCards[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
};

const serializeGameState = (game: PokerGame, viewerId?: string) => {
  const pot = calculatePot(game);
  return {
    partyId: game.partyId,
    stage: game.stage,
    communityCards: game.communityCards,
    pot,
    smallBlind: game.smallBlind,
    bigBlind: game.bigBlind,
    minRaise: game.minRaise,
    highestBet: game.highestBet,
    dealerId: game.players[game.dealerIndex]?.userId,
    smallBlindId: game.players[game.smallBlindIndex]?.userId,
    bigBlindId: game.players[game.bigBlindIndex]?.userId,
    currentPlayerId: game.players[game.currentPlayerIndex]?.userId,
    turnEndsAt: game.turnStartTime ? game.turnStartTime + ACTION_TIME_LIMIT : null,
    handNumber: game.handNumber,
    maxHands: game.maxHands,
    lastHandResult: game.lastHandResult,
    startingStack: game.startingStack,
    players: game.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
      chips: p.chips,
      bet: p.bet,
      totalBet: p.totalBet,
      hasFolded: p.hasFolded,
      isAllIn: p.isAllIn,
      isEliminated: p.isEliminated,
      lastAction: p.lastAction,
      hand:
        game.stage === 'showdown' || viewerId === p.userId
          ? p.hand
          : p.hand.length
          ? ['??', '??']
          : [],
    })),
    yourHand: game.players.find((p) => p.userId === viewerId)?.hand ?? [],
    availableActions: (() => {
      if (!viewerId) return [];
      const me = game.players.find((p) => p.userId === viewerId);
      if (!me || !actionable(me) || game.players[game.currentPlayerIndex]?.userId !== viewerId) return [];
      const actions: PokerAction[] = ['fold'];
      if (me.bet === game.highestBet) {
        actions.push('check');
      } else {
        actions.push('call');
      }
      if (me.chips > 0) {
        if (game.highestBet === 0) {
          actions.push('bet');
        } else {
          actions.push('raise');
        }
        actions.push('all-in');
      }
      return actions;
    })(),
    callAmount: (() => {
      const me = game.players.find((p) => p.userId === viewerId);
      if (!me) return 0;
      return Math.max(0, Math.min(me.chips, game.highestBet - me.bet));
    })(),
    minRaiseTo:
      game.highestBet === 0 ? Math.min(game.bigBlind, game.startingStack) : game.highestBet + game.minRaise,
  };
};

const emitState = (game: PokerGame, io: Server) => {
  // Send personalized state to each player to include their hand without leaking others
  for (const player of game.players) {
    const socketId = playerSockets.get(player.userId);
    if (socketId) {
      io.to(socketId).emit('poker:state', serializeGameState(game, player.userId));
    }
  }
};

const startTurnTimer = (game: PokerGame, io: Server) => {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
  }
  game.turnStartTime = Date.now();
  game.turnTimer = setTimeout(() => {
    const current = game.players[game.currentPlayerIndex];
    if (!current || current.hasFolded || current.isAllIn || current.isEliminated) {
      return;
    }
    // Auto-check if possible, otherwise fold
    const canCheck = current.bet === game.highestBet;
    handleAction(game.partyId, current.userId, canCheck ? 'check' : 'fold', undefined, io, true);
  }, ACTION_TIME_LIMIT);
};

const clearTurnTimer = (game: PokerGame) => {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
};

const isBettingRoundComplete = (game: PokerGame) => {
  const activePlayers = game.players.filter((p) => !p.hasFolded && !p.isEliminated);
  if (activePlayers.length <= 1) return true;

  const everyoneActed = activePlayers.every((p) => p.hasActedThisRound || p.isAllIn);
  const alignedBets = activePlayers.every((p) => p.isAllIn || p.bet === game.highestBet);

  const anyActionable = activePlayers.some(actionable);
  if (!anyActionable) return true;

  return everyoneActed && alignedBets;
};

const getNextActionPlayer = (game: PokerGame, fromIndex: number) => {
  const total = game.players.length;
  for (let i = 1; i <= total; i++) {
    const idx = (fromIndex + i) % total;
    const player = game.players[idx];
    if (actionable(player)) {
      return idx;
    }
  }
  return -1;
};

const hasActionablePlayers = (game: PokerGame) => game.players.some(actionable);

const moveToNextStage = (game: PokerGame, io: Server) => {
  clearTurnTimer(game);

  if (game.stage === 'preflop') {
    game.stage = 'flop';
    game.communityCards = game.deck.splice(0, 3);
  } else if (game.stage === 'flop') {
    game.stage = 'turn';
    game.communityCards.push(...game.deck.splice(0, 1));
  } else if (game.stage === 'turn') {
    game.stage = 'river';
    game.communityCards.push(...game.deck.splice(0, 1));
  } else {
    game.stage = 'showdown';
  }

  game.players.forEach((p) => {
    p.bet = 0;
    p.hasActedThisRound = false;
    p.lastAction = p.lastAction;
  });
  game.highestBet = 0;
  game.minRaise = game.bigBlind;

  if (!hasActionablePlayers(game) || game.stage === 'showdown') {
    // If everyone est all-in, deal le board complet
    while (game.communityCards.length < 5 && game.deck.length > 0) {
      game.communityCards.push(game.deck.pop()!);
    }
    finishHand(game, io);
    return;
  }

  game.currentPlayerIndex = getNextActiveIndex(game.players, game.dealerIndex, actionable);
  startTurnTimer(game, io);
  emitState(game, io);
};

const buildSidePots = (game: PokerGame) => {
  const contributions = game.players
    .filter((p) => p.totalBet > 0)
    .map((p) => ({ userId: p.userId, amount: p.totalBet }))
    .sort((a, b) => a.amount - b.amount);

  const pots: Array<{ amount: number; eligible: string[] }> = [];
  let remaining = contributions;

  if (remaining.length === 0) {
    return pots;
  }

  while (remaining.length > 0) {
    const smallest = remaining[0].amount;
    const eligible = remaining.map((r) => r.userId);
    const potAmount = smallest * eligible.length;
    pots.push({ amount: potAmount, eligible });
    remaining = remaining
      .map((r) => ({ ...r, amount: r.amount - smallest }))
      .filter((r) => r.amount > 0);
  }

  return pots;
};

const finishHand = (game: PokerGame, io: Server) => {
  clearTurnTimer(game);
  game.stage = 'showdown';

  const activePlayers = game.players.filter((p) => !p.hasFolded && !p.isEliminated);

  if (activePlayers.length === 1) {
    // Everyone else folded
    const loneWinner = activePlayers[0];
    const pot = calculatePot(game);
    loneWinner.chips += pot;
    game.lastHandResult = {
      winners: [{ userId: loneWinner.userId, username: loneWinner.username, amountWon: pot, handRank: 'Par abandon' }],
      showdown: [{ userId: loneWinner.userId, username: loneWinner.username, hand: loneWinner.hand, handRank: 'N/A' }],
      pot,
    };
  } else {
    const sidePots = buildSidePots(game);
    const payouts = new Map<string, number>();
    const showdownDetails: HandResult['showdown'] = [];

    const handValues = new Map<string, HandValue>();
    for (const player of activePlayers) {
      const value = bestHand([...player.hand, ...game.communityCards]);
      handValues.set(player.userId, value);
      showdownDetails.push({
        userId: player.userId,
        username: player.username,
        hand: player.hand,
        handRank: value.description,
      });
    }

    for (const pot of sidePots) {
      const eligiblePlayers = activePlayers.filter((p) => pot.eligible.includes(p.userId));
      let best: HandValue | null = null;
      let winners: PokerPlayer[] = [];

      for (const player of eligiblePlayers) {
        const val = handValues.get(player.userId)!;
        if (!best) {
          best = val;
          winners = [player];
          continue;
        }
        const cmp = compareHands(val, best);
        if (cmp > 0) {
          best = val;
          winners = [player];
        } else if (cmp === 0) {
          winners.push(player);
        }
      }

      const share = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount % winners.length;
      winners.forEach((winner, idx) => {
        const amount = share + (idx < remainder ? 1 : 0);
        payouts.set(winner.userId, (payouts.get(winner.userId) || 0) + amount);
      });
    }

    for (const [userId, amount] of payouts.entries()) {
      const player = game.players.find((p) => p.userId === userId);
      if (player) {
        player.chips += amount;
      }
    }

    const potTotal = calculatePot(game);
    game.lastHandResult = {
      winners: Array.from(payouts.entries()).map(([userId, amount]) => {
        const player = game.players.find((p) => p.userId === userId)!;
        const handRank = handValues.get(userId)?.description || '';
        return { userId, username: player.username, amountWon: amount, handRank };
      }),
      showdown: showdownDetails,
      pot: potTotal,
    };
  }

  // Reset per-hand bets
  game.players.forEach((p) => {
    p.bet = 0;
    p.totalBet = 0;
    p.hasFolded = false;
    p.isAllIn = false;
    p.hasActedThisRound = false;
  });

  emitState(game, io);

  // Eliminate broke players
  game.players.forEach((p) => {
    if (p.chips <= 0) {
      p.isEliminated = true;
    }
  });

  // Determine if match is over
  const contenders = game.players.filter((p) => !p.isEliminated);
  const reachedHandCap = game.handNumber >= game.maxHands;
  if (contenders.length <= 1 || reachedHandCap) {
    endMatch(game, io);
    return;
  }

  // Start next hand after short pause
  setTimeout(() => {
    startHand(game, io);
  }, 1500);
};

const postBlind = (player: PokerPlayer, amount: number) => {
  const commit = Math.min(amount, player.chips);
  player.chips -= commit;
  player.bet = commit;
  player.totalBet = commit;
  player.lastAction = commit < amount ? 'all-in' : null;
  if (player.chips === 0) {
    player.isAllIn = true;
  }
  player.hasActedThisRound = false;
  return commit;
};

const startHand = (game: PokerGame, io: Server) => {
  clearTurnTimer(game);
  const contenders = game.players.filter((p) => !p.isEliminated && p.chips > 0);
  if (contenders.length < 2) {
    endMatch(game, io);
    return;
  }

  game.handNumber += 1;
  game.deck = createDeck();
  game.communityCards = [];
  game.stage = 'preflop';
  game.highestBet = 0;
  game.minRaise = game.bigBlind;
  game.lastHandResult = undefined;

  // Rotate dealer (keep current seat for the first hand if still active)
  if (game.handNumber === 1) {
    if (!activeAndWithChips(game.players[game.dealerIndex])) {
      game.dealerIndex = getNextActiveIndex(game.players, game.dealerIndex, activeAndWithChips);
      if (game.dealerIndex === -1) game.dealerIndex = 0;
    }
  } else {
    game.dealerIndex = getNextActiveIndex(game.players, game.dealerIndex, activeAndWithChips);
    if (game.dealerIndex === -1) {
      game.dealerIndex = 0;
    }
  }

  game.players.forEach((p) => {
    if (!p.isEliminated) {
      p.hand = [game.deck.pop()!, game.deck.pop()!];
    } else {
      p.hand = [];
    }
    p.bet = 0;
    p.totalBet = 0;
    p.hasFolded = p.isEliminated;
    p.isAllIn = false;
    p.hasActedThisRound = false;
    p.lastAction = null;
  });

  // Blinds
  game.smallBlindIndex = getNextActiveIndex(game.players, game.dealerIndex, activeAndWithChips);
  game.bigBlindIndex = getNextActiveIndex(game.players, game.smallBlindIndex, activeAndWithChips);

  const sbPlayer = game.players[game.smallBlindIndex];
  const bbPlayer = game.players[game.bigBlindIndex];

  const sb = postBlind(sbPlayer, Math.floor(game.smallBlind));
  sbPlayer.lastAction = 'small-blind';
  const bb = postBlind(bbPlayer, game.bigBlind);
  bbPlayer.lastAction = 'big-blind';

  game.highestBet = Math.max(sb, bb);
  game.minRaise = game.bigBlind;

  game.currentPlayerIndex = getNextActionPlayer(game, game.bigBlindIndex);

  if (!hasActionablePlayers(game) || game.currentPlayerIndex === -1) {
    moveToNextStage(game, io);
    return;
  }

  startTurnTimer(game, io);
  emitState(game, io);
};

const handleAction = (
  partyId: string,
  userId: string,
  action: PokerAction,
  amount: number | undefined,
  io: Server,
  isAuto = false,
) => {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;

  const playerIndex = game.players.findIndex((p) => p.userId === userId);
  if (playerIndex === -1) return;
  const player = game.players[playerIndex];

  if (game.players[game.currentPlayerIndex]?.userId !== userId && !isAuto) {
    return;
  }

  if (player.hasFolded || player.isAllIn || player.isEliminated) {
    return;
  }

  clearTurnTimer(game);

  const callAmount = Math.max(0, Math.min(player.chips, game.highestBet - player.bet));

  const commitChips = (targetBet: number, asAction: PokerAction) => {
    const desired = Math.min(targetBet, player.bet + player.chips);
    const toPut = desired - player.bet;
    if (toPut <= 0) return false;
    player.chips -= toPut;
    player.bet += toPut;
    player.totalBet += toPut;
    player.lastAction = asAction;
    if (player.chips === 0) {
      player.isAllIn = true;
    }
    player.hasActedThisRound = true;
    return true;
  };

  switch (action) {
    case 'fold': {
      player.hasFolded = true;
      player.lastAction = 'fold';
      player.hasActedThisRound = true;
      break;
    }
    case 'check': {
      if (player.bet !== game.highestBet) {
        io.to(playerSockets.get(userId) || '').emit('poker:error', { message: 'Check impossible' });
        startTurnTimer(game, io);
        return;
      }
      player.lastAction = 'check';
      player.hasActedThisRound = true;
      break;
    }
    case 'call': {
      if (callAmount <= 0) {
        player.lastAction = 'check';
        player.hasActedThisRound = true;
        break;
      }
      commitChips(player.bet + callAmount, 'call');
      break;
    }
    case 'bet': {
      const target = amount ?? player.bet + player.chips;
      const minBet = Math.min(game.bigBlind, player.bet + player.chips);
      if (game.highestBet > 0) {
        io.to(playerSockets.get(userId) || '').emit('poker:error', { message: 'Utilise raise au lieu de bet' });
        startTurnTimer(game, io);
        return;
      }
      if (target < minBet && target < player.bet + player.chips) {
        io.to(playerSockets.get(userId) || '').emit('poker:error', { message: 'Mise trop petite' });
        startTurnTimer(game, io);
        return;
      }
      commitChips(target, 'bet');
      game.highestBet = player.bet;
      game.minRaise = player.bet;
      resetActionFlags(game, playerIndex);
      break;
    }
    case 'raise': {
      const target = amount ?? game.highestBet + game.minRaise;
      if (target <= game.highestBet && target < player.bet + player.chips) {
        io.to(playerSockets.get(userId) || '').emit('poker:error', { message: 'Raise insuffisant' });
        startTurnTimer(game, io);
        return;
      }
      const minRaiseTo = game.highestBet + game.minRaise;
      if (target < minRaiseTo && target < player.bet + player.chips) {
        io.to(playerSockets.get(userId) || '').emit('poker:error', { message: 'Raise trop petit' });
        startTurnTimer(game, io);
        return;
      }
      commitChips(target, 'raise');
      const raiseAmount = player.bet - game.highestBet;
      if (player.bet > game.highestBet) {
        if (raiseAmount >= game.minRaise) {
          game.minRaise = raiseAmount;
        }
        game.highestBet = player.bet;
        resetActionFlags(game, playerIndex);
      }
      break;
    }
    case 'all-in': {
      const target = player.bet + player.chips;
      commitChips(target, 'all-in');
      if (player.bet > game.highestBet) {
        const raiseAmount = player.bet - game.highestBet;
        if (raiseAmount >= game.minRaise) {
          game.minRaise = raiseAmount;
        }
        game.highestBet = player.bet;
        resetActionFlags(game, playerIndex);
      }
      break;
    }
  }

  // Everyone folded except one
  const remaining = game.players.filter((p) => !p.hasFolded && !p.isEliminated);
  if (remaining.length <= 1) {
    finishHand(game, io);
    return;
  }

  // Advance betting round if complete
  if (isBettingRoundComplete(game)) {
    moveToNextStage(game, io);
    return;
  }

  // Next player
  const next = getNextActionPlayer(game, playerIndex);
  if (next === -1) {
    moveToNextStage(game, io);
    return;
  }
  game.currentPlayerIndex = next;
  startTurnTimer(game, io);
  emitState(game, io);
};

const endMatch = (game: PokerGame, io: Server) => {
  clearTurnTimer(game);
  const active = game.players.filter((p) => !p.isEliminated);
  const winner = active.reduce(
    (top, p) => (p.chips > (top?.chips || 0) ? p : top),
    active[0] || null,
  );

  const gameOver = {
    winnerId: winner?.userId ?? null,
    winnerUsername: winner?.username ?? null,
    standings: game.players
      .map((p) => ({ userId: p.userId, username: p.username, chips: p.chips }))
      .sort((a, b) => b.chips - a.chips),
  };

  activeGames.delete(game.partyId);

  io.to(`party:${game.partyId}`).emit('poker:game-over', gameOver);

  const playAgainPrompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    startStack: game.startingStack,
    bigBlind: game.bigBlind,
    responses: new Map(),
    players: game.players.map((p) => ({ userId: p.userId, username: p.username, usernameColor: p.usernameColor })),
    timer: null,
  };

  pendingPlayAgainPrompts.set(game.partyId, playAgainPrompt);

  playAgainPrompt.timer = setTimeout(() => resolvePlayAgainPrompt(game.partyId, io), PLAY_AGAIN_TIMEOUT);

  io.to(`party:${game.partyId}`).emit('poker:play-again-prompt', {
    partyId: game.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: Date.now(),
    startStack: playAgainPrompt.startStack,
    bigBlind: playAgainPrompt.bigBlind,
    players: playAgainPrompt.players,
    responses: [],
  });
};

const resolveJoinPrompt = async (partyId: string, io: Server) => {
  const prompt = pendingJoinPrompts.get(partyId);
  if (!prompt) return;

  if (prompt.timer) clearTimeout(prompt.timer);
  pendingJoinPrompts.delete(partyId);

  const accepted = Array.from(prompt.responses.entries())
    .filter(([_, ok]) => ok)
    .map(([id]) => id);

  if (accepted.length < 2) {
    io.to(`party:${partyId}`).emit('poker:join-cancelled', {
      reason: 'Au moins 2 joueurs requis',
    });
    return;
  }

  const partyMembers = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: accepted } },
    include: {
      user: {
        select: { id: true, username: true, usernameColor: true },
      },
    },
  });

  const players: PokerPlayer[] = partyMembers.map((m) => ({
    userId: m.user.id,
    username: m.user.username,
    usernameColor: m.user.usernameColor,
    chips: prompt.startStack,
    bet: 0,
    totalBet: 0,
    hand: [],
    hasFolded: false,
    isAllIn: false,
    isEliminated: false,
    lastAction: null,
    hasActedThisRound: false,
  }));

  // Shuffle seats
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  const game: PokerGame = {
    partyId,
    players,
    dealerIndex: 0,
    smallBlindIndex: 0,
    bigBlindIndex: 0,
    currentPlayerIndex: 0,
    deck: [],
    communityCards: [],
    stage: 'preflop',
    smallBlind: Math.floor(prompt.bigBlind / 2),
    bigBlind: prompt.bigBlind,
    minRaise: prompt.bigBlind,
    highestBet: 0,
    isActive: true,
    handNumber: 0,
    maxHands: MAX_HANDS,
    startingStack: prompt.startStack,
    turnTimer: null,
    turnStartTime: Date.now(),
  };

  activeGames.set(partyId, game);

  startHand(game, io);
};

const resolvePlayAgainPrompt = (partyId: string, io: Server) => {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingPlayAgainPrompts.delete(partyId);

  const rejoiners = Array.from(prompt.responses.entries())
    .filter(([_, ok]) => ok)
    .map(([id]) => id);

  if (rejoiners.length < 2) {
    io.to(`party:${partyId}`).emit('poker:play-again-cancelled', {
      reason: 'Pas assez de joueurs pour relancer',
    });
    return;
  }

  prisma.partyMember
    .findMany({
      where: { partyId, userId: { in: rejoiners } },
      include: { user: { select: { id: true, username: true, usernameColor: true } } },
    })
    .then((members) => {
      if (members.length < 2) {
        io.to(`party:${partyId}`).emit('poker:play-again-cancelled', {
          reason: 'Pas assez de joueurs dans la party',
        });
        return;
      }
      const players: PokerPlayer[] = members.map((m) => ({
        userId: m.user.id,
        username: m.user.username,
        usernameColor: m.user.usernameColor,
        chips: prompt.startStack,
        bet: 0,
        totalBet: 0,
        hand: [],
        hasFolded: false,
        isAllIn: false,
        isEliminated: false,
        lastAction: null,
        hasActedThisRound: false,
      }));

      for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
      }

      const game: PokerGame = {
        partyId,
        players,
        dealerIndex: 0,
        smallBlindIndex: 0,
        bigBlindIndex: 0,
        currentPlayerIndex: 0,
        deck: [],
        communityCards: [],
        stage: 'preflop',
        smallBlind: Math.floor(prompt.bigBlind / 2),
        bigBlind: prompt.bigBlind,
        minRaise: prompt.bigBlind,
        highestBet: 0,
        isActive: true,
        handNumber: 0,
        maxHands: MAX_HANDS,
        startingStack: prompt.startStack,
        turnTimer: null,
        turnStartTime: Date.now(),
      };

      activeGames.set(partyId, game);
      startHand(game, io);
    })
    .catch((err) => {
      console.error('Failed to restart poker game', err);
      io.to(`party:${partyId}`).emit('poker:error', { message: 'Impossible de relancer la partie' });
    });
};

export const setupPokerHandlers = (socket: Socket, io: Server) => {
  // Track socket for private state pushes
  socket.on('poker:register', (data: { userId: string }) => {
    playerSockets.set(data.userId, socket.id);
  });

  socket.on('poker:start', async (data: { userId: string; partyId: string; startStack?: number; bigBlind?: number }) => {
    const { userId, partyId } = data;
    let startStack = Math.max(MIN_STACK, Math.min(MAX_STACK, data.startStack ?? DEFAULT_STACK));
    let bigBlind = Math.max(10, Math.min(startStack / 2, data.bigBlind ?? 20));
    bigBlind = Math.round(bigBlind);

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: { party: true },
      });

      if (!membership || membership.partyId !== partyId || !membership.isLeader) {
        socket.emit('poker:error', { message: 'Seul le leader peut lancer' });
        return;
      }

      if (pendingJoinPrompts.has(partyId) || activeGames.has(partyId)) {
        socket.emit('poker:error', { message: 'Une partie est déjà en cours' });
        return;
      }

      const partyMembers = await prisma.partyMember.findMany({
        where: { partyId },
        include: { user: { select: { id: true, username: true, usernameColor: true } } },
      });

      if (partyMembers.length < 2) {
        socket.emit('poker:error', { message: '2 joueurs minimum' });
        return;
      }

      const memberIds = partyMembers.map((m) => m.user.id);
      const prompt: PendingJoinPrompt = {
        partyId,
        leaderId: userId,
        startStack,
        bigBlind,
        responses: new Map([[userId, true]]),
        memberIds,
        timer: null,
      };

      pendingJoinPrompts.set(partyId, prompt);
      prompt.timer = setTimeout(() => resolveJoinPrompt(partyId, io), JOIN_TIMEOUT);

      io.to(`party:${partyId}`).emit('poker:join-prompt', {
        partyId,
        leaderId: userId,
        startStack,
        bigBlind,
        timeLimit: JOIN_TIMEOUT,
        startTime: Date.now(),
        members: partyMembers.map((m) => ({
          userId: m.user.id,
          username: m.user.username,
          usernameColor: m.user.usernameColor,
        })),
        responses: [{ userId, accepted: true }],
      });
    } catch (err) {
      console.error('Start poker error', err);
      socket.emit('poker:error', { message: 'Impossible de démarrer' });
    }
  });

  socket.on('poker:join-response', (data: { partyId: string; userId: string; accepted: boolean }) => {
    const prompt = pendingJoinPrompts.get(data.partyId);
    if (!prompt || !prompt.memberIds.includes(data.userId)) return;
    prompt.responses.set(data.userId, data.accepted);

    const responses = Array.from(prompt.responses.entries()).map(([userId, accepted]) => ({ userId, accepted }));
    io.to(`party:${data.partyId}`).emit('poker:join-response-update', { partyId: data.partyId, responses });

    if (prompt.responses.size === prompt.memberIds.length) {
      if (prompt.timer) clearTimeout(prompt.timer);
      resolveJoinPrompt(data.partyId, io);
    }
  });

  socket.on('poker:action', (data: { partyId: string; userId: string; action: PokerAction; amount?: number }) => {
    playerSockets.set(data.userId, socket.id);
    handleAction(data.partyId, data.userId, data.action, data.amount, io);
  });

  socket.on('poker:leave', (data: { partyId: string; userId: string }) => {
    const game = activeGames.get(data.partyId);
    if (!game) return;
    const player = game.players.find((p) => p.userId === data.userId);
    if (!player) return;
    player.hasFolded = true;
    player.isEliminated = true;
    player.chips = 0;
    if (game.players[game.currentPlayerIndex]?.userId === data.userId) {
      const next = getNextActionPlayer(game, game.currentPlayerIndex);
      if (next !== -1) game.currentPlayerIndex = next;
    }
    if (game.players.filter((p) => !p.isEliminated && !p.hasFolded).length <= 1) {
      finishHand(game, io);
    } else {
      emitState(game, io);
    }
  });

  socket.on('poker:play-again-response', (data: { partyId: string; userId: string; playAgain: boolean }) => {
    const prompt = pendingPlayAgainPrompts.get(data.partyId);
    if (!prompt) return;
    if (!prompt.players.find((p) => p.userId === data.userId)) return;
    prompt.responses.set(data.userId, data.playAgain);
    const responses = Array.from(prompt.responses.entries()).map(([userId, playAgain]) => ({ userId, playAgain }));
    const playAgainCount = responses.filter((r) => r.playAgain).length;
    const leaveCount = responses.filter((r) => !r.playAgain).length;

    io.to(`party:${data.partyId}`).emit('poker:play-again-response-update', {
      partyId: data.partyId,
      responses,
      playAgainCount,
      leaveCount,
    });

    if (prompt.responses.size === prompt.players.length) {
      resolvePlayAgainPrompt(data.partyId, io);
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of playerSockets.entries()) {
      if (socketId === socket.id) {
        playerSockets.delete(userId);
        break;
      }
    }
  });
};

export const sendActivePokerState = (socket: Socket, partyId: string, userId: string) => {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;
  const isPlayer = game.players.some((p) => p.userId === userId);
  if (!isPlayer) return;
  socket.emit('poker:state', serializeGameState(game, userId));
};

export const sendPendingPokerPlayAgainPrompt = (socket: Socket, partyId: string, userId: string) => {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  const isPlayer = prompt.players.some((p) => p.userId === userId);
  if (!isPlayer) return;

  const responses = Array.from(prompt.responses.entries()).map(([uid, playAgain]) => ({ userId: uid, playAgain }));
  const playAgainCount = responses.filter((r) => r.playAgain).length;
  const leaveCount = responses.filter((r) => !r.playAgain).length;

  socket.emit('poker:play-again-prompt', {
    partyId: prompt.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: Date.now(),
    startStack: prompt.startStack,
    bigBlind: prompt.bigBlind,
    players: prompt.players,
    responses,
    playAgainCount,
    leaveCount,
  });
};
