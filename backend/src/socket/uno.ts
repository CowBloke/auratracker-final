import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';
import { logGame } from '../utils/logger.js';
import { getActiveClanMoneyBoostPercentsForUsers } from '../utils/clanEffects.js';
import { emitSharedBalanceUpdatesForUserIds } from '../utils/sharedBalance.js';
import { applyDailyGameRewardCaps } from '../utils/dailyGameRewards.js';
import { duelPartyIds, deleteDuelParty } from './duelParties.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type CardColor = 'red' | 'green' | 'blue' | 'yellow' | 'wild';
type CardValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
}

interface UnoPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: number;
}

interface ChallengeWindow {
  challengedUserId: string;     // the one who played Wild+4
  targetUserId: string;         // the one who can challenge
  blufferHandBefore: Card[];    // bluffer's hand before the play (for fair check)
  activeColorBefore: CardColor | null;
  timer: NodeJS.Timeout;
  timeLimit: number;
  startTime: number;
}

interface LastAction {
  type: 'played' | 'drew' | 'challenged' | 'uno-called' | 'caught';
  userId: string;
  username: string;
  card?: Card;
  count?: number;
  chosenColor?: CardColor;
}

interface UnoGame {
  partyId: string;
  players: UnoPlayer[];
  deck: Card[];
  discardPile: Card[];
  hands: Map<string, Card[]>;         // userId → hand
  currentPlayerIndex: number;
  direction: 1 | -1;
  pendingDraw: number;                 // stacked draws waiting for current player
  pendingDrawType: 'draw2' | 'wild4' | null;
  chosenColor: CardColor | null;       // active color override for wild cards
  phase: 'playing' | 'finished';
  winnerId: string | null;
  turnTimer: NodeJS.Timeout | null;
  turnStartTime: number;
  turnDuration: number;
  isActive: boolean;
  unoCalled: Set<string>;              // userIds that pressed UNO (have 1 card)
  lastAction: LastAction | null;
  challengeWindow: ChallengeWindow | null;
}

interface PendingJoinPrompt {
  partyId: string;
  leaderId: string;
  responses: Map<string, boolean>;
  memberIds: string[];
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  timer: NodeJS.Timeout | null;
  startTime: number;
}

interface PendingPlayAgainPrompt {
  partyId: string;
  responses: Map<string, boolean>;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  timer: NodeJS.Timeout | null;
  startTime: number;
}

// ─── State ───────────────────────────────────────────────────────────────────

const activeGames = new Map<string, UnoGame>();
const playerSockets = new Map<string, string>();   // userId → socketId
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();

const JOIN_PROMPT_TIMEOUT = 15_000;
const PLAY_AGAIN_TIMEOUT = 20_000;
const TURN_TIMEOUT = 30_000;
const CHALLENGE_TIMEOUT = 8_000;
const CARDS_PER_PLAYER = 7;

// ─── Deck ────────────────────────────────────────────────────────────────────

function createDeck(): Card[] {
  const cards: Card[] = [];
  const colors: CardColor[] = ['red', 'green', 'blue', 'yellow'];
  let id = 0;
  for (const color of colors) {
    cards.push({ id: String(id++), color, value: '0' });
    for (const value of ['1','2','3','4','5','6','7','8','9','skip','reverse','draw2'] as CardValue[]) {
      cards.push({ id: String(id++), color, value });
      cards.push({ id: String(id++), color, value });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: String(id++), color: 'wild', value: 'wild' });
    cards.push({ id: String(id++), color: 'wild', value: 'wild4' });
  }
  return cards;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPlayable(
  card: Card,
  topCard: Card,
  chosenColor: CardColor | null,
  pendingDraw: number,
  pendingDrawType: 'draw2' | 'wild4' | null,
): boolean {
  if (pendingDraw > 0) {
    if (pendingDrawType === 'draw2') return card.value === 'draw2';
    if (pendingDrawType === 'wild4') return card.value === 'wild4';
    return false;
  }
  if (card.value === 'wild' || card.value === 'wild4') return true;
  const activeColor = chosenColor ?? topCard.color;
  return card.color === activeColor || card.value === topCard.value;
}

function getNextIndex(game: UnoGame, steps = 1): number {
  const n = game.players.length;
  return ((game.currentPlayerIndex + game.direction * steps) % n + n) % n;
}

function drawCardsForUser(game: UnoGame, userId: string, n: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (game.deck.length === 0) {
      if (game.discardPile.length <= 1) break;
      const top = game.discardPile.pop()!;
      game.deck = shuffle(game.discardPile);
      game.discardPile = [top];
    }
    if (game.deck.length === 0) break;
    drawn.push(game.deck.pop()!);
  }
  const hand = game.hands.get(userId) ?? [];
  hand.push(...drawn);
  game.hands.set(userId, hand);
  return drawn;
}

// ─── State serialization ─────────────────────────────────────────────────────

function serializeCard(c: Card) {
  return { id: c.id, color: c.color, value: c.value };
}

function serializeStateForPlayer(game: UnoGame, userId: string) {
  return {
    partyId: game.partyId,
    players: game.players.map(p => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
      playerIndex: p.playerIndex,
      handCount: game.hands.get(p.userId)?.length ?? 0,
      calledUno: game.unoCalled.has(p.userId),
    })),
    topCard: serializeCard(game.discardPile[game.discardPile.length - 1]),
    deckCount: game.deck.length,
    myHand: (game.hands.get(userId) ?? []).map(serializeCard),
    currentPlayerId: game.players[game.currentPlayerIndex].userId,
    direction: game.direction,
    pendingDraw: game.pendingDraw,
    pendingDrawType: game.pendingDrawType,
    chosenColor: game.chosenColor,
    phase: game.phase,
    winnerId: game.winnerId,
    turnDuration: game.turnDuration,
    turnStartTime: game.turnStartTime,
    lastAction: game.lastAction
      ? {
          ...game.lastAction,
          card: game.lastAction.card ? serializeCard(game.lastAction.card) : undefined,
        }
      : null,
    challengeWindow: game.challengeWindow
      ? {
          challengedUserId: game.challengeWindow.challengedUserId,
          targetUserId: game.challengeWindow.targetUserId,
          timeLimit: game.challengeWindow.timeLimit,
          startTime: game.challengeWindow.startTime,
        }
      : null,
  };
}

function emitStateToAll(game: UnoGame, io: Server) {
  for (const player of game.players) {
    const sid = playerSockets.get(player.userId);
    if (sid) {
      io.to(sid).emit('uno:state', serializeStateForPlayer(game, player.userId));
    }
  }
}

// ─── Timers ──────────────────────────────────────────────────────────────────

function clearTurnTimer(game: UnoGame) {
  if (game.turnTimer) { clearTimeout(game.turnTimer); game.turnTimer = null; }
}

function scheduleTurnTimer(game: UnoGame, io: Server) {
  clearTurnTimer(game);
  game.turnStartTime = Date.now();
  game.turnTimer = setTimeout(() => void handleTurnTimeout(game.partyId, io), game.turnDuration);
}

async function handleTurnTimeout(partyId: string, io: Server) {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive || game.phase !== 'playing') return;
  clearTurnTimer(game);

  const p = game.players[game.currentPlayerIndex];
  const drawCount = game.pendingDraw > 0 ? game.pendingDraw : 1;
  drawCardsForUser(game, p.userId, drawCount);
  game.unoCalled.delete(p.userId);
  game.lastAction = { type: 'drew', userId: p.userId, username: p.username, count: drawCount };
  game.pendingDraw = 0;
  game.pendingDrawType = null;
  game.currentPlayerIndex = getNextIndex(game);

  scheduleTurnTimer(game, io);
  emitStateToAll(game, io);
}

// ─── Challenge resolution ─────────────────────────────────────────────────────

function resolveChallengeWindow(partyId: string, io: Server, wasChallenge: boolean) {
  const game = activeGames.get(partyId);
  if (!game) return;

  const cw = game.challengeWindow;
  game.challengeWindow = null;

  if (!cw) {
    scheduleTurnTimer(game, io);
    emitStateToAll(game, io);
    return;
  }

  if (wasChallenge) {
    // Check if bluffer had a card matching the active color before their wild+4
    const wasBluffing =
      cw.activeColorBefore !== null
        ? cw.blufferHandBefore.some(c => c.color === cw.activeColorBefore)
        : false;

    if (wasBluffing) {
      // Challenger wins: bluffer draws 4
      drawCardsForUser(game, cw.challengedUserId, 4);
      game.pendingDraw = 0;
      game.pendingDrawType = null;
      game.lastAction = {
        type: 'challenged',
        userId: cw.targetUserId,
        username: game.players.find(p => p.userId === cw.targetUserId)?.username ?? '',
      };
      io.to(`party:${partyId}`).emit('uno:challenge-result', {
        challengerWon: true,
        challengerId: cw.targetUserId,
        challengedId: cw.challengedUserId,
      });
      // Challenger keeps their turn (currentPlayerIndex is already the challenger)
      scheduleTurnTimer(game, io);
      emitStateToAll(game, io);
    } else {
      // Bluffer wins: challenger draws 6 (4 stack + 2 penalty)
      drawCardsForUser(game, cw.targetUserId, 6);
      game.pendingDraw = 0;
      game.pendingDrawType = null;
      game.lastAction = {
        type: 'challenged',
        userId: cw.targetUserId,
        username: game.players.find(p => p.userId === cw.targetUserId)?.username ?? '',
      };
      io.to(`party:${partyId}`).emit('uno:challenge-result', {
        challengerWon: false,
        challengerId: cw.targetUserId,
        challengedId: cw.challengedUserId,
      });
      game.currentPlayerIndex = getNextIndex(game);
      scheduleTurnTimer(game, io);
      emitStateToAll(game, io);
    }
  } else {
    // No challenge: target draws the pending 4 cards
    const count = game.pendingDraw;
    drawCardsForUser(game, cw.targetUserId, count);
    game.pendingDraw = 0;
    game.pendingDrawType = null;
    game.lastAction = {
      type: 'drew',
      userId: cw.targetUserId,
      username: game.players.find(p => p.userId === cw.targetUserId)?.username ?? '',
      count,
    };
    game.currentPlayerIndex = getNextIndex(game);
    scheduleTurnTimer(game, io);
    emitStateToAll(game, io);
  }
}

// ─── End game ─────────────────────────────────────────────────────────────────

async function endGame(game: UnoGame, io: Server, winnerId: string) {
  clearTurnTimer(game);
  if (game.challengeWindow) {
    clearTimeout(game.challengeWindow.timer);
    game.challengeWindow = null;
  }
  game.isActive = false;
  game.phase = 'finished';
  game.winnerId = winnerId;
  emitStateToAll(game, io);

  const winReward = { aura: 40, money: 60 };
  const lossReward = { aura: 0, money: 20 };

  try {
    const winner = game.players.find(p => p.userId === winnerId)!;
    const others = game.players.filter(p => p.userId !== winnerId);
    const boostPercents = await getActiveClanMoneyBoostPercentsForUsers(game.players.map((player) => player.userId));
    const resolveMoneyReward = (userId: string, base: number) => base + Math.floor(base * ((boostPercents.get(userId) ?? 0) / 100));
    const resolvedWinReward = { ...winReward, money: resolveMoneyReward(winner.userId, winReward.money) };
    const cappedWinReward = await applyDailyGameRewardCaps(prisma, winnerId, resolvedWinReward);
    const cappedLossRewards = await Promise.all(
      others.map(async (other) => {
        const resolvedLossReward = { ...lossReward, money: resolveMoneyReward(other.userId, lossReward.money) };
        const capped = await applyDailyGameRewardCaps(prisma, other.userId, resolvedLossReward);
        return {
          userId: other.userId,
          reward: {
            aura: capped?.appliedAura ?? 0,
            money: capped?.appliedMoney ?? 0,
          },
        };
      })
    );

    await emitSharedBalanceUpdatesForUserIds(
      prisma,
      [
        (cappedWinReward?.appliedAura ?? 0) > 0 || (cappedWinReward?.appliedMoney ?? 0) > 0 ? winnerId : null,
        ...cappedLossRewards.filter(({ reward }) => reward.aura > 0 || reward.money > 0).map(({ userId }) => userId),
      ].filter((userId): userId is string => Boolean(userId))
    );

    await checkQuestProgress(winnerId, 'PLAY_GAMES', 1);
    await checkQuestProgress(winnerId, 'WIN_GAMES', 1);
    for (const other of others) {
      await checkQuestProgress(other.userId, 'PLAY_GAMES', 1);
    }

    await prisma.gameStats.upsert({
      where: { userId_gameType: { userId: winnerId, gameType: 'uno' } },
      create: { userId: winnerId, gameType: 'uno', wins: 1, losses: 0, highScore: 1, totalPlayed: 1 },
      update: { wins: { increment: 1 }, totalPlayed: { increment: 1 } },
    });
    for (const other of others) {
      await prisma.gameStats.upsert({
        where: { userId_gameType: { userId: other.userId, gameType: 'uno' } },
        create: { userId: other.userId, gameType: 'uno', wins: 0, losses: 1, highScore: 0, totalPlayed: 1 },
        update: { losses: { increment: 1 }, totalPlayed: { increment: 1 } },
      });
    }

    io.to(`party:${game.partyId}`).emit('uno:game-over', {
      winnerId,
      winnerUsername: winner.username,
      rewards: {
        winner: {
          aura: cappedWinReward?.appliedAura ?? 0,
          money: cappedWinReward?.appliedMoney ?? 0,
        },
        loser: lossReward,
      },
    });

    logGame('game_complete', winner.userId, winner.username, {
      gameType: 'uno', score: 1, won: true,
      auraReward: cappedWinReward?.appliedAura ?? 0, moneyReward: cappedWinReward?.appliedMoney ?? 0,
      isMultiplayer: true, partyId: game.partyId,
    });
  } catch (err) {
    console.error('uno:endGame error:', err);
  }

  // Play-again prompt
  const prompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    responses: new Map(),
    players: game.players.map(p => ({ userId: p.userId, username: p.username, usernameColor: p.usernameColor })),
    timer: null,
    startTime: Date.now(),
  };
  pendingPlayAgainPrompts.set(game.partyId, prompt);
  prompt.timer = setTimeout(() => resolvePlayAgainPrompt(game.partyId, io), PLAY_AGAIN_TIMEOUT);
  io.to(`party:${game.partyId}`).emit('uno:play-again-prompt', {
    partyId: game.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: prompt.startTime,
    players: prompt.players,
    responses: [],
  });

  activeGames.delete(game.partyId);
}

// ─── Play-again ───────────────────────────────────────────────────────────────

async function resolvePlayAgainPrompt(partyId: string, io: Server) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingPlayAgainPrompts.delete(partyId);

  const playAgainIds = Array.from(prompt.responses.entries())
    .filter(([, v]) => v)
    .map(([uid]) => uid);

  if (playAgainIds.length < 2) {
    io.to(`party:${partyId}`).emit('uno:play-again-cancelled', {});
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: playAgainIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if (members.length < 2) {
    io.to(`party:${partyId}`).emit('uno:play-again-cancelled', {});
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  startUnoGame(partyId, members, io);
}

// ─── Start game ───────────────────────────────────────────────────────────────

function startUnoGame(
  partyId: string,
  members: Array<{ user: { id: string; username: string; usernameColor?: string | null } }>,
  io: Server,
) {
  const rawDeck = shuffle(createDeck());
  const hands = new Map<string, Card[]>();
  const players: UnoPlayer[] = members.map((m, i) => ({
    userId: m.user.id,
    username: m.user.username,
    usernameColor: m.user.usernameColor ?? null,
    playerIndex: i,
  }));

  let idx = 0;
  for (const player of players) {
    hands.set(player.userId, rawDeck.slice(idx, idx + CARDS_PER_PLAYER));
    idx += CARDS_PER_PLAYER;
  }

  const remaining = rawDeck.slice(idx);

  // Find a non-wild starting card
  let startIdx = remaining.findIndex(c => c.color !== 'wild');
  if (startIdx === -1) startIdx = 0;
  const firstCard = remaining.splice(startIdx, 1)[0];

  const game: UnoGame = {
    partyId,
    players,
    deck: remaining,
    discardPile: [firstCard],
    hands,
    currentPlayerIndex: Math.floor(Math.random() * players.length),
    direction: 1,
    pendingDraw: 0,
    pendingDrawType: null,
    chosenColor: null,
    phase: 'playing',
    winnerId: null,
    turnTimer: null,
    turnStartTime: Date.now(),
    turnDuration: TURN_TIMEOUT,
    isActive: true,
    unoCalled: new Set(),
    lastAction: null,
    challengeWindow: null,
  };

  // Apply first card effects
  if (firstCard.value === 'skip') {
    game.currentPlayerIndex = getNextIndex(game, 1);
  } else if (firstCard.value === 'reverse') {
    if (players.length === 2) {
      game.currentPlayerIndex = getNextIndex(game, 1);
    } else {
      game.direction = -1;
      game.currentPlayerIndex = getNextIndex(game, 1);
    }
  } else if (firstCard.value === 'draw2') {
    game.pendingDraw = 2;
    game.pendingDrawType = 'draw2';
  }

  activeGames.set(partyId, game);
  scheduleTurnTimer(game, io);
  emitStateToAll(game, io);
}

// ─── Join prompt resolution ───────────────────────────────────────────────────

async function resolveJoinPrompt(partyId: string, io: Server) {
  const prompt = pendingJoinPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingJoinPrompts.delete(partyId);

  const acceptedIds = Array.from(prompt.responses.entries())
    .filter(([, v]) => v)
    .map(([uid]) => uid);

  if (acceptedIds.length < 2) {
    io.to(`party:${partyId}`).emit('uno:join-cancelled', {});
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if (members.length < 2) {
    io.to(`party:${partyId}`).emit('uno:join-cancelled', {});
    return;
  }

  startUnoGame(partyId, members, io);
}

// ─── Direct start (from duel system) ─────────────────────────────────────────

export function startDirectUnoGame(
  partyId: string,
  players: Array<{ user: { id: string; username: string; usernameColor?: string | null } }>,
  io: Server,
) {
  if (activeGames.has(partyId)) return;
  startUnoGame(partyId, players, io);
}

// ─── Socket handlers ──────────────────────────────────────────────────────────

export const setupUnoHandlers = (socket: Socket, io: Server) => {
  const userId = socket.data.userId as string | undefined;
  if (!userId) return;
  playerSockets.set(userId, socket.id);

  // ── Register (reconnect) ────────────────────────────────────────────────
  socket.on('uno:register', async () => {
    if (!userId) return;
    playerSockets.set(userId, socket.id);

    let partyId = socket.data.partyId as string | undefined;
    if (!partyId) {
      try {
        const m = await prisma.partyMember.findUnique({ where: { userId }, select: { partyId: true } });
        partyId = m?.partyId;
      } catch { /* ignore */ }
    }
    if (!partyId) return;

    const game = activeGames.get(partyId);
    if (game?.players.some(p => p.userId === userId)) {
      socket.emit('uno:state', serializeStateForPlayer(game, userId));
    }

    const joinPrompt = pendingJoinPrompts.get(partyId);
    if (joinPrompt) {
      socket.emit('uno:join-prompt', {
        partyId: joinPrompt.partyId,
        leaderId: joinPrompt.leaderId,
        timeLimit: JOIN_PROMPT_TIMEOUT,
        startTime: joinPrompt.startTime,
        members: joinPrompt.members,
        responses: Array.from(joinPrompt.responses.entries()).map(([uid, v]) => ({ userId: uid, accepted: v })),
      });
    }

    const playAgainPrompt = pendingPlayAgainPrompts.get(partyId);
    if (playAgainPrompt) {
      socket.emit('uno:play-again-prompt', {
        partyId: playAgainPrompt.partyId,
        timeLimit: PLAY_AGAIN_TIMEOUT,
        startTime: playAgainPrompt.startTime,
        players: playAgainPrompt.players,
        responses: Array.from(playAgainPrompt.responses.entries()).map(([uid, v]) => ({ userId: uid, playAgain: v })),
      });
    }
  });

  // ── Start ────────────────────────────────────────────────────────────────
  socket.on('uno:start', async (data: { partyId: string }) => {
    if (!userId) return;
    const { partyId } = data;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: {
          party: {
            include: {
              members: { include: { user: { select: { id: true, username: true, usernameColor: true } } } },
            },
          },
        },
      });

      if (!membership || membership.partyId !== partyId) {
        socket.emit('uno:error', { message: 'Tu n\'es pas dans cette partie.' });
        return;
      }
      if (!membership.isLeader) {
        socket.emit('uno:error', { message: 'Seul le leader peut lancer la partie.' });
        return;
      }
      const count = membership.party.members.length;
      if (count < 2 || count > 4) {
        socket.emit('uno:error', { message: 'Il faut entre 2 et 4 joueurs.' });
        return;
      }
      if (activeGames.has(partyId)) {
        socket.emit('uno:error', { message: 'Une partie est déjà en cours.' });
        return;
      }
      if (pendingJoinPrompts.has(partyId)) {
        socket.emit('uno:error', { message: 'Une demande est déjà en cours.' });
        return;
      }

      const membersData = membership.party.members;
      const memberIds = membersData.map(m => m.user.id);
      const membersInfo = membersData.map(m => ({
        userId: m.user.id,
        username: m.user.username,
        usernameColor: m.user.usernameColor,
      }));

      const prompt: PendingJoinPrompt = {
        partyId,
        leaderId: userId,
        responses: new Map([[userId, true]]),
        memberIds,
        members: membersInfo,
        timer: null,
        startTime: Date.now(),
      };
      pendingJoinPrompts.set(partyId, prompt);
      prompt.timer = setTimeout(() => resolveJoinPrompt(partyId, io), JOIN_PROMPT_TIMEOUT);

      io.to(`party:${partyId}`).emit('uno:join-prompt', {
        partyId,
        leaderId: userId,
        timeLimit: JOIN_PROMPT_TIMEOUT,
        startTime: prompt.startTime,
        members: membersInfo,
        responses: [{ userId, accepted: true }],
      });
    } catch (err) {
      console.error('uno:start error:', err);
      socket.emit('uno:error', { message: 'Impossible de lancer la partie.' });
    }
  });

  // ── Join response ────────────────────────────────────────────────────────
  socket.on('uno:join-response', async (data: { partyId: string; accepted: boolean }) => {
    if (!userId) return;
    const prompt = pendingJoinPrompts.get(data.partyId);
    if (!prompt || !prompt.memberIds.includes(userId)) return;

    prompt.responses.set(userId, data.accepted);
    const responses = Array.from(prompt.responses.entries()).map(([uid, v]) => ({ userId: uid, accepted: v }));
    io.to(`party:${data.partyId}`).emit('uno:join-response-update', { partyId: data.partyId, responses });

    if (prompt.responses.size === prompt.memberIds.length) {
      await resolveJoinPrompt(data.partyId, io);
    }
  });

  // ── Play card ────────────────────────────────────────────────────────────
  socket.on('uno:play-card', (data: { partyId: string; cardId: string; chosenColor?: CardColor }) => {
    if (!userId) return;
    const { partyId, cardId, chosenColor } = data;

    const game = activeGames.get(partyId);
    if (!game?.isActive || game.phase !== 'playing') {
      socket.emit('uno:error', { message: 'Aucune partie en cours.' });
      return;
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.userId !== userId) {
      socket.emit('uno:error', { message: 'Ce n\'est pas ton tour.' });
      return;
    }

    // During a challenge window the target must decide first
    if (game.challengeWindow && game.challengeWindow.targetUserId === userId) {
      socket.emit('uno:error', { message: 'Décide d\'abord si tu contestes.' });
      return;
    }

    const hand = game.hands.get(userId) ?? [];
    const cardIdx = hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) {
      socket.emit('uno:error', { message: 'Carte introuvable.' });
      return;
    }

    const card = hand[cardIdx];
    const topCard = game.discardPile[game.discardPile.length - 1];

    if (!isPlayable(card, topCard, game.chosenColor, game.pendingDraw, game.pendingDrawType)) {
      socket.emit('uno:error', { message: 'Cette carte ne peut pas être jouée.' });
      return;
    }
    if ((card.value === 'wild' || card.value === 'wild4') && !chosenColor) {
      socket.emit('uno:error', { message: 'Choisis une couleur.' });
      return;
    }

    clearTurnTimer(game);

    // Remove from hand
    hand.splice(cardIdx, 1);
    game.hands.set(userId, hand);
    game.discardPile.push(card);

    // Update chosen color
    game.chosenColor = (card.value === 'wild' || card.value === 'wild4')
      ? (chosenColor ?? null)
      : null;

    // Win condition
    if (hand.length === 0) {
      game.lastAction = { type: 'played', userId, username: currentPlayer.username, card };
      void endGame(game, io, userId);
      return;
    }

    // Track UNO state
    if (hand.length > 1) game.unoCalled.delete(userId);

    game.lastAction = {
      type: 'played',
      userId,
      username: currentPlayer.username,
      card,
      chosenColor: chosenColor ?? undefined,
    };

    // Apply card effects
    if (card.value === 'skip') {
      // In 2p, skip acts as "play again" (stay on same index); in 3-4p skip the next player
      if (game.players.length > 2) {
        game.currentPlayerIndex = getNextIndex(game, 2);
      }
      // else: keep currentPlayerIndex unchanged (current player plays again)
    } else if (card.value === 'reverse') {
      game.direction = (game.direction === 1 ? -1 : 1) as 1 | -1;
      if (game.players.length === 2) {
        // reverse in 2p = skip = play again, don't advance
      } else {
        game.currentPlayerIndex = getNextIndex(game, 1);
      }
    } else if (card.value === 'draw2') {
      game.pendingDraw += 2;
      game.pendingDrawType = 'draw2';
      game.currentPlayerIndex = getNextIndex(game, 1);
    } else if (card.value === 'wild4') {
      const nextIdx = getNextIndex(game, 1);
      const nextPlayer = game.players[nextIdx];
      const blufferHandBefore = [...hand]; // hand already without wild4
      const activeColorBefore = game.chosenColor ?? (topCard.color !== 'wild' ? topCard.color : null);

      game.pendingDraw += 4;
      game.pendingDrawType = 'wild4';
      game.currentPlayerIndex = nextIdx;

      const challengeTimer = setTimeout(
        () => resolveChallengeWindow(partyId, io, false),
        CHALLENGE_TIMEOUT,
      );
      game.challengeWindow = {
        challengedUserId: userId,
        targetUserId: nextPlayer.userId,
        blufferHandBefore,
        activeColorBefore,
        timer: challengeTimer,
        timeLimit: CHALLENGE_TIMEOUT,
        startTime: Date.now(),
      };

      emitStateToAll(game, io);
      return; // Don't schedule turn timer until challenge resolves
    } else if (card.value === 'wild') {
      game.currentPlayerIndex = getNextIndex(game, 1);
    } else {
      // Number card
      game.pendingDraw = 0;
      game.pendingDrawType = null;
      game.currentPlayerIndex = getNextIndex(game, 1);
    }

    scheduleTurnTimer(game, io);
    emitStateToAll(game, io);
  });

  // ── Draw card ────────────────────────────────────────────────────────────
  socket.on('uno:draw', (data: { partyId: string }) => {
    if (!userId) return;
    const game = activeGames.get(data.partyId);
    if (!game?.isActive || game.phase !== 'playing') {
      socket.emit('uno:error', { message: 'Aucune partie en cours.' });
      return;
    }
    if (game.players[game.currentPlayerIndex].userId !== userId) {
      socket.emit('uno:error', { message: 'Ce n\'est pas ton tour.' });
      return;
    }

    // If there's a challenge window: accept the wild4 (no challenge)
    if (game.challengeWindow && game.challengeWindow.targetUserId === userId) {
      clearTimeout(game.challengeWindow.timer);
      resolveChallengeWindow(data.partyId, io, false);
      return;
    }

    clearTurnTimer(game);

    const p = game.players[game.currentPlayerIndex];
    const drawCount = game.pendingDraw > 0 ? game.pendingDraw : 1;
    drawCardsForUser(game, userId, drawCount);
    game.unoCalled.delete(userId);
    game.lastAction = { type: 'drew', userId, username: p.username, count: drawCount };
    game.pendingDraw = 0;
    game.pendingDrawType = null;
    game.currentPlayerIndex = getNextIndex(game, 1);

    scheduleTurnTimer(game, io);
    emitStateToAll(game, io);
  });

  // ── Call UNO ─────────────────────────────────────────────────────────────
  socket.on('uno:uno-call', (data: { partyId: string }) => {
    if (!userId) return;
    const game = activeGames.get(data.partyId);
    if (!game?.isActive) return;

    const hand = game.hands.get(userId) ?? [];
    if (hand.length !== 1) return;

    game.unoCalled.add(userId);
    const player = game.players.find(p => p.userId === userId);
    game.lastAction = { type: 'uno-called', userId, username: player?.username ?? '' };
    io.to(`party:${data.partyId}`).emit('uno:uno-announced', {
      userId,
      username: player?.username ?? '',
    });
    emitStateToAll(game, io);
  });

  // ── Catch UNO ────────────────────────────────────────────────────────────
  socket.on('uno:catch', (data: { partyId: string; targetId: string }) => {
    if (!userId || userId === data.targetId) return;
    const game = activeGames.get(data.partyId);
    if (!game?.isActive) return;

    const targetHand = game.hands.get(data.targetId) ?? [];
    if (targetHand.length !== 1 || game.unoCalled.has(data.targetId)) return;

    drawCardsForUser(game, data.targetId, 2);
    const targetPlayer = game.players.find(p => p.userId === data.targetId);
    const catcher = game.players.find(p => p.userId === userId);
    game.lastAction = { type: 'caught', userId, username: catcher?.username ?? '' };

    io.to(`party:${data.partyId}`).emit('uno:catch-success', {
      catcherId: userId,
      catcherUsername: catcher?.username,
      targetId: data.targetId,
      targetUsername: targetPlayer?.username,
    });
    emitStateToAll(game, io);
  });

  // ── Challenge Wild+4 ─────────────────────────────────────────────────────
  socket.on('uno:challenge', (data: { partyId: string }) => {
    if (!userId) return;
    const game = activeGames.get(data.partyId);
    if (!game?.isActive) return;

    const cw = game.challengeWindow;
    if (!cw || cw.targetUserId !== userId) return;

    clearTimeout(cw.timer);
    game.challengeWindow = null;
    resolveChallengeWindow(data.partyId, io, true);
  });

  // ── Play again ───────────────────────────────────────────────────────────
  socket.on('uno:play-again-response', (data: { partyId: string; playAgain: boolean }) => {
    if (!userId) return;
    const prompt = pendingPlayAgainPrompts.get(data.partyId);
    if (!prompt?.players.find(p => p.userId === userId)) return;

    prompt.responses.set(userId, data.playAgain);
    const responses = Array.from(prompt.responses.entries()).map(([uid, v]) => ({ userId: uid, playAgain: v }));
    io.to(`party:${data.partyId}`).emit('uno:play-again-response-update', { partyId: data.partyId, responses });

    if (prompt.responses.size === prompt.players.length) {
      resolvePlayAgainPrompt(data.partyId, io);
    }
  });

  // ── Leave ────────────────────────────────────────────────────────────────
  socket.on('uno:leave', (data: { partyId: string }) => {
    if (!userId) return;
    const game = activeGames.get(data.partyId);
    if (game) {
      clearTurnTimer(game);
      if (game.challengeWindow) {
        clearTimeout(game.challengeWindow.timer);
        game.challengeWindow = null;
      }
      activeGames.delete(data.partyId);
      io.to(`party:${data.partyId}`).emit('uno:left', { userId });
    }
  });
};
