import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';
import { logGame } from '../utils/logger.js';

interface RRPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  isAlive: boolean;
  pullCount: number;
  passedOut: boolean;
}

interface RRGame {
  partyId: string;
  players: RRPlayer[];
  currentPlayerIndex: number;
  cylinderPosition: number; // 0-5, current chamber facing barrel
  bulletChamber: number;    // 0-5, server only
  round: number;
  stake: number;
  isActive: boolean;
  lastEvent: { type: 'click' | 'bang' | 'pass'; playerId: string; username: string } | null;
  turnTimer: NodeJS.Timeout | null;
  turnStartTime: number;
}

interface PendingJoinPrompt {
  partyId: string;
  leaderId: string;
  stake: number;
  responses: Map<string, boolean>;
  memberIds: string[];
  timer: NodeJS.Timeout | null;
}

interface PendingPlayAgainPrompt {
  partyId: string;
  responses: Map<string, boolean>;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  timer: NodeJS.Timeout | null;
}

const activeGames = new Map<string, RRGame>();
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();
const playerSockets = new Map<string, string>();

const JOIN_TIMEOUT = 15000;
const PLAY_AGAIN_TIMEOUT = 20000;
const TURN_TIME_LIMIT = 20000;
const BANG_DELAY = 3500; // delay before next player turn after a BANG

const randomBulletChamber = () => Math.floor(Math.random() * 6);
const getAlivePlayers = (game: RRGame) => game.players.filter((p) => p.isAlive);

const getNextAliveIndex = (game: RRGame, fromIndex: number) => {
  const total = game.players.length;
  for (let i = 1; i <= total; i++) {
    const idx = (fromIndex + i) % total;
    if (game.players[idx].isAlive) return idx;
  }
  return -1;
};

const serializeGame = (game: RRGame) => ({
  partyId: game.partyId,
  players: game.players.map((p) => ({
    userId: p.userId,
    username: p.username,
    usernameColor: p.usernameColor,
    isAlive: p.isAlive,
    pullCount: p.pullCount,
    passedOut: p.passedOut,
  })),
  currentPlayerId: game.players[game.currentPlayerIndex]?.userId ?? null,
  cylinderPosition: game.cylinderPosition,
  round: game.round,
  isActive: game.isActive,
  lastEvent: game.lastEvent,
  turnEndsAt: game.turnStartTime + TURN_TIME_LIMIT,
  alivePlayers: getAlivePlayers(game).length,
  totalPlayers: game.players.length,
  stake: game.stake,
});

const emitState = (game: RRGame, io: Server) => {
  io.to(`party:${game.partyId}`).emit('roulette:state', serializeGame(game));
};

const startTurnTimer = (game: RRGame, io: Server) => {
  if (game.turnTimer) clearTimeout(game.turnTimer);
  game.turnStartTime = Date.now();
  game.turnTimer = setTimeout(async () => {
    const current = game.players[game.currentPlayerIndex];
    if (!current || !current.isAlive) return;
    await handlePass(game.partyId, current.userId, io, true);
  }, TURN_TIME_LIMIT);
};

const clearTurnTimer = (game: RRGame) => {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
};

const reloadCylinder = (game: RRGame) => {
  game.bulletChamber = randomBulletChamber();
  game.cylinderPosition = 0;
  game.round += 1;
};

const handlePull = async (partyId: string, userId: string, io: Server) => {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;

  const current = game.players[game.currentPlayerIndex];
  if (!current || current.userId !== userId || !current.isAlive) return;

  clearTurnTimer(game);

  const chamberFired = game.cylinderPosition === game.bulletChamber;
  current.pullCount += 1;
  const firedChamber = game.cylinderPosition;
  game.cylinderPosition = (game.cylinderPosition + 1) % 6;

  if (chamberFired) {
    current.isAlive = false;
    game.lastEvent = { type: 'bang', playerId: userId, username: current.username };
    emitState(game, io);
    io.to(`party:${partyId}`).emit('roulette:bang', {
      playerId: userId,
      username: current.username,
      chamber: firedChamber,
    });

    const alive = getAlivePlayers(game);
    if (alive.length <= 1) {
      setTimeout(() => endGame(game, io), BANG_DELAY);
      return;
    }

    // After BANG: reload and continue after delay
    setTimeout(() => {
      reloadCylinder(game);
      const nextIdx = getNextAliveIndex(game, game.currentPlayerIndex);
      if (nextIdx === -1) {
        endGame(game, io);
        return;
      }
      game.currentPlayerIndex = nextIdx;
      game.lastEvent = null;
      startTurnTimer(game, io);
      emitState(game, io);
    }, BANG_DELAY);
  } else {
    game.lastEvent = { type: 'click', playerId: userId, username: current.username };

    // If all 6 chambers exhausted without bang, reload
    if (game.cylinderPosition === 0) {
      reloadCylinder(game);
    }

    const nextIdx = getNextAliveIndex(game, game.currentPlayerIndex);
    if (nextIdx === -1) {
      await endGame(game, io);
      return;
    }
    game.currentPlayerIndex = nextIdx;
    startTurnTimer(game, io);
    emitState(game, io);
  }
};

const handlePass = async (partyId: string, userId: string, io: Server, isAuto = false) => {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;

  const current = game.players[game.currentPlayerIndex];
  if (!current || current.userId !== userId || !current.isAlive) return;

  clearTurnTimer(game);

  current.isAlive = false;
  current.passedOut = true;
  game.lastEvent = { type: 'pass', playerId: userId, username: current.username };

  const alive = getAlivePlayers(game);
  emitState(game, io);

  if (alive.length <= 1) {
    await endGame(game, io);
    return;
  }

  const nextIdx = getNextAliveIndex(game, game.currentPlayerIndex);
  if (nextIdx === -1) {
    await endGame(game, io);
    return;
  }
  game.currentPlayerIndex = nextIdx;
  startTurnTimer(game, io);
  emitState(game, io);
};

const endGame = async (game: RRGame, io: Server) => {
  clearTurnTimer(game);
  game.isActive = false;

  const alive = getAlivePlayers(game);
  const winner = alive[0] ?? null;

  const standings = game.players.map((p) => ({
    userId: p.userId,
    username: p.username,
    usernameColor: p.usernameColor,
    isAlive: p.isAlive,
    pullCount: p.pullCount,
    passedOut: p.passedOut,
  }));

  // Award pot to winner
  if (game.stake > 0 && winner) {
    await prisma.user.update({
      where: { id: winner.userId },
      data: { money: { increment: game.stake * game.players.length } },
    });
  }

  for (const player of game.players) {
    const isWinner = player.userId === winner?.userId;
    logGame('game_complete', player.userId, player.username, {
      gameType: 'russian_roulette',
      score: player.pullCount,
      won: isWinner,
      auraReward: 0,
      moneyReward: 0,
      isMultiplayer: true,
      partyId: game.partyId,
      totalPlayers: game.players.length,
      winnerId: winner?.userId ?? null,
      winnerUsername: winner?.username ?? null,
    });
    await checkQuestProgress(player.userId, 'PLAY_GAMES', 1);
    if (isWinner) {
      await checkQuestProgress(player.userId, 'WIN_GAMES', 1);
    }
  }

  activeGames.delete(game.partyId);

  io.to(`party:${game.partyId}`).emit('roulette:game-over', {
    winnerId: winner?.userId ?? null,
    winnerUsername: winner?.username ?? null,
    standings,
  });

  const playAgainPrompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    responses: new Map(),
    players: game.players.map((p) => ({ userId: p.userId, username: p.username, usernameColor: p.usernameColor })),
    timer: null,
  };
  pendingPlayAgainPrompts.set(game.partyId, playAgainPrompt);
  playAgainPrompt.timer = setTimeout(() => resolvePlayAgainPrompt(game.partyId, io), PLAY_AGAIN_TIMEOUT);

  io.to(`party:${game.partyId}`).emit('roulette:play-again-prompt', {
    partyId: game.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: Date.now(),
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
    io.to(`party:${partyId}`).emit('roulette:join-cancelled', { reason: 'Au moins 2 joueurs requis' });
    return;
  }

  // Check and deduct stake
  let finalAccepted = accepted;
  if (prompt.stake > 0) {
    const affordable: string[] = [];
    for (const uid of accepted) {
      const u = await prisma.user.findUnique({ where: { id: uid }, select: { money: true } });
      if (u && u.money >= prompt.stake) affordable.push(uid);
    }
    if (affordable.length < 2) {
      io.to(`party:${partyId}`).emit('roulette:join-cancelled', { reason: 'Pas assez de joueurs avec les fonds nécessaires' });
      return;
    }
    await prisma.user.updateMany({ where: { id: { in: affordable } }, data: { money: { decrement: prompt.stake } } });
    finalAccepted = affordable;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: finalAccepted } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
  });

  const players: RRPlayer[] = members.map((m) => ({
    userId: m.user.id,
    username: m.user.username,
    usernameColor: m.user.usernameColor,
    isAlive: true,
    pullCount: 0,
    passedOut: false,
  }));

  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  const game: RRGame = {
    partyId,
    players,
    currentPlayerIndex: 0,
    cylinderPosition: 0,
    bulletChamber: randomBulletChamber(),
    round: 1,
    isActive: true,
    lastEvent: null,
    turnTimer: null,
    turnStartTime: Date.now(),
    stake: prompt.stake,
  };

  activeGames.set(partyId, game);
  startTurnTimer(game, io);
  emitState(game, io);
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
    io.to(`party:${partyId}`).emit('roulette:play-again-cancelled', { reason: 'Pas assez de joueurs' });
    return;
  }

  prisma.partyMember.findMany({
    where: { partyId, userId: { in: rejoiners } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
  }).then(async (members) => {
    if (members.length < 2) {
      io.to(`party:${partyId}`).emit('roulette:play-again-cancelled', { reason: 'Pas assez de joueurs' });
      return;
    }

    const players: RRPlayer[] = members.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
      usernameColor: m.user.usernameColor,
      isAlive: true,
      pullCount: 0,
      passedOut: false,
    }));

    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }

    const game: RRGame = {
      partyId,
      players,
      currentPlayerIndex: 0,
      cylinderPosition: 0,
      bulletChamber: randomBulletChamber(),
      round: 1,
      isActive: true,
      lastEvent: null,
      turnTimer: null,
      turnStartTime: Date.now(),
      stake: 0,
    };

    activeGames.set(partyId, game);
    startTurnTimer(game, io);
    emitState(game, io);
  }).catch((err) => {
    console.error('Failed to restart roulette game', err);
    io.to(`party:${partyId}`).emit('roulette:error', { message: 'Impossible de relancer la partie' });
  });
};

export const setupRussianRouletteHandlers = (socket: Socket, io: Server) => {
  socket.on('roulette:register', () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    playerSockets.set(userId, socket.id);
  });

  socket.on('roulette:start', async (data: { partyId: string; stake?: number }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: { party: true },
      });

      if (!membership || membership.partyId !== partyId || !membership.isLeader) {
        socket.emit('roulette:error', { message: 'Seul le leader peut lancer' });
        return;
      }

      if (pendingJoinPrompts.has(partyId) || activeGames.has(partyId)) {
        socket.emit('roulette:error', { message: 'Une partie est déjà en cours' });
        return;
      }

      const partyMembers = await prisma.partyMember.findMany({
        where: { partyId },
        include: { user: { select: { id: true, username: true, usernameColor: true } } },
      });

      if (partyMembers.length < 2) {
        socket.emit('roulette:error', { message: '2 joueurs minimum requis' });
        return;
      }

      const memberIds = partyMembers.map((m) => m.user.id);
      const stake = Math.max(0, Math.min(Math.floor(data.stake ?? 0), 100000));
      const prompt: PendingJoinPrompt = {
        partyId,
        leaderId: userId,
        responses: new Map([[userId, true]]),
        memberIds,
        timer: null,
        stake,
      };
      pendingJoinPrompts.set(partyId, prompt);
      prompt.timer = setTimeout(() => resolveJoinPrompt(partyId, io), JOIN_TIMEOUT);

      io.to(`party:${partyId}`).emit('roulette:join-prompt', {
        partyId,
        leaderId: userId,
        stake,
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
      console.error('Start roulette error', err);
      socket.emit('roulette:error', { message: 'Impossible de démarrer' });
    }
  });

  socket.on('roulette:join-response', (data: { partyId: string; accepted: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const prompt = pendingJoinPrompts.get(data.partyId);
    if (!prompt || !prompt.memberIds.includes(userId)) return;

    prompt.responses.set(userId, data.accepted);
    const responses = Array.from(prompt.responses.entries()).map(([uid, accepted]) => ({ userId: uid, accepted }));
    io.to(`party:${data.partyId}`).emit('roulette:join-response-update', { partyId: data.partyId, responses });

    if (prompt.responses.size === prompt.memberIds.length) {
      if (prompt.timer) clearTimeout(prompt.timer);
      resolveJoinPrompt(data.partyId, io);
    }
  });

  socket.on('roulette:pull', async (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    playerSockets.set(userId, socket.id);
    await handlePull(data.partyId, userId, io);
  });

  socket.on('roulette:pass', async (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    await handlePass(data.partyId, userId, io);
  });

  socket.on('roulette:play-again-response', (data: { partyId: string; playAgain: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const prompt = pendingPlayAgainPrompts.get(data.partyId);
    if (!prompt) return;
    if (!prompt.players.find((p) => p.userId === userId)) return;

    prompt.responses.set(userId, data.playAgain);
    const responses = Array.from(prompt.responses.entries()).map(([uid, playAgain]) => ({ userId: uid, playAgain }));
    const playAgainCount = responses.filter((r) => r.playAgain).length;

    io.to(`party:${data.partyId}`).emit('roulette:play-again-response-update', {
      partyId: data.partyId,
      responses,
      playAgainCount,
      leaveCount: responses.filter((r) => !r.playAgain).length,
    });

    if (prompt.responses.size === prompt.players.length) {
      resolvePlayAgainPrompt(data.partyId, io);
    }
  });

  socket.on('disconnect', () => {
    for (const [uid, sid] of playerSockets.entries()) {
      if (sid === socket.id) {
        playerSockets.delete(uid);
        break;
      }
    }
  });
};

export const sendActiveRouletteState = (socket: Socket, partyId: string, userId: string) => {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;
  const isPlayer = game.players.some((p) => p.userId === userId);
  if (!isPlayer) return;
  socket.emit('roulette:state', serializeGame(game));
};
