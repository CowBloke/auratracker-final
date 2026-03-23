import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';
import { logGame } from '../utils/logger.js';

interface LeverPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  isAlive: boolean;
  pulls: number;
  safePulls: number;
  explodedAtRound: number | null;
}

interface LeverState {
  id: number;
  color: string;
  isPulled: boolean;
}

interface LeverGame {
  partyId: string;
  players: LeverPlayer[];
  currentPlayerIndex: number;
  levers: LeverState[];
  explosiveLeverId: number;
  round: number;
  isActive: boolean;
  lastEvent: {
    type: 'safe' | 'boom' | 'auto-safe' | 'auto-boom';
    playerId: string;
    username: string;
    leverId: number;
    leverColor: string;
  } | null;
  turnTimer: NodeJS.Timeout | null;
  turnStartTime: number;
}

interface PendingJoinPrompt {
  partyId: string;
  leaderId: string;
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

const LEVER_COLORS = ['Rouge', 'Rose', 'Jaune', 'Vert', 'Bleu'];
const JOIN_TIMEOUT = 15000;
const PLAY_AGAIN_TIMEOUT = 20000;
const TURN_TIME_LIMIT = 15000;
const ROUND_RESET_DELAY = 2500;

const activeGames = new Map<string, LeverGame>();
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();

const createLevers = (): LeverState[] =>
  LEVER_COLORS.map((color, index) => ({
    id: index,
    color,
    isPulled: false,
  }));

const getAlivePlayers = (game: LeverGame) => game.players.filter((player) => player.isAlive);

const getNextAliveIndex = (game: LeverGame, fromIndex: number) => {
  for (let i = 1; i <= game.players.length; i += 1) {
    const nextIndex = (fromIndex + i) % game.players.length;
    if (game.players[nextIndex]?.isAlive) {
      return nextIndex;
    }
  }
  return -1;
};

const serializeGame = (game: LeverGame) => ({
  partyId: game.partyId,
  players: game.players.map((player) => ({
    userId: player.userId,
    username: player.username,
    usernameColor: player.usernameColor,
    isAlive: player.isAlive,
    pulls: player.pulls,
    safePulls: player.safePulls,
    explodedAtRound: player.explodedAtRound,
  })),
  currentPlayerId: game.players[game.currentPlayerIndex]?.userId ?? null,
  levers: game.levers,
  round: game.round,
  isActive: game.isActive,
  lastEvent: game.lastEvent,
  turnEndsAt: game.turnStartTime + TURN_TIME_LIMIT,
  alivePlayers: getAlivePlayers(game).length,
  totalPlayers: game.players.length,
});

const emitState = (game: LeverGame, io: Server) => {
  io.to(`party:${game.partyId}`).emit('leverblast:state', serializeGame(game));
};

const clearTurnTimer = (game: LeverGame) => {
  if (!game.turnTimer) return;
  clearTimeout(game.turnTimer);
  game.turnTimer = null;
};

const startTurnTimer = (game: LeverGame, io: Server) => {
  clearTurnTimer(game);
  game.turnStartTime = Date.now();
  game.turnTimer = setTimeout(() => {
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isAlive) return;
    const availableLever = game.levers.find((lever) => !lever.isPulled);
    if (!availableLever) return;
    void handlePull(game.partyId, currentPlayer.userId, availableLever.id, io, true);
  }, TURN_TIME_LIMIT);
};

const resetRound = (game: LeverGame) => {
  game.round += 1;
  game.levers = createLevers();
  game.explosiveLeverId = Math.floor(Math.random() * game.levers.length);
  game.lastEvent = null;
};

const createGameFromMembers = (
  partyId: string,
  members: Array<{ user: { id: string; username: string; usernameColor?: string | null } }>,
): LeverGame => {
  const players = members.map((member) => ({
    userId: member.user.id,
    username: member.user.username,
    usernameColor: member.user.usernameColor,
    isAlive: true,
    pulls: 0,
    safePulls: 0,
    explodedAtRound: null,
  }));

  for (let i = players.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  return {
    partyId,
    players,
    currentPlayerIndex: 0,
    levers: createLevers(),
    explosiveLeverId: Math.floor(Math.random() * LEVER_COLORS.length),
    round: 1,
    isActive: true,
    lastEvent: null,
    turnTimer: null,
    turnStartTime: Date.now(),
  };
};

const endGame = async (game: LeverGame, io: Server) => {
  clearTurnTimer(game);
  game.isActive = false;

  const winner = getAlivePlayers(game)[0] ?? null;
  const standings = [...game.players]
    .sort((a, b) => {
      if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
      if ((a.explodedAtRound ?? Number.MAX_SAFE_INTEGER) !== (b.explodedAtRound ?? Number.MAX_SAFE_INTEGER)) {
        return (b.explodedAtRound ?? 0) - (a.explodedAtRound ?? 0);
      }
      return b.safePulls - a.safePulls;
    })
    .map((player) => ({
      userId: player.userId,
      username: player.username,
      usernameColor: player.usernameColor,
      isAlive: player.isAlive,
      pulls: player.pulls,
      safePulls: player.safePulls,
      explodedAtRound: player.explodedAtRound,
      isWinner: player.userId === winner?.userId,
    }));

  for (const player of game.players) {
    const isWinner = player.userId === winner?.userId;
    await prisma.gameStats.upsert({
      where: { userId_gameType: { userId: player.userId, gameType: 'levier_infernal' } },
      create: {
        userId: player.userId,
        gameType: 'levier_infernal',
        wins: isWinner ? 1 : 0,
        losses: isWinner ? 0 : 1,
        highScore: player.safePulls,
        totalPlayed: 1,
      },
      update: {
        ...(isWinner ? { wins: { increment: 1 } } : { losses: { increment: 1 } }),
        totalPlayed: { increment: 1 },
      },
    });

    logGame('game_complete', player.userId, player.username, {
      gameType: 'levier_infernal',
      score: player.safePulls,
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

  io.to(`party:${game.partyId}`).emit('leverblast:game-over', {
    winnerId: winner?.userId ?? null,
    winnerUsername: winner?.username ?? null,
    standings,
  });

  const playAgainPrompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    responses: new Map(),
    players: game.players.map((player) => ({
      userId: player.userId,
      username: player.username,
      usernameColor: player.usernameColor,
    })),
    timer: null,
  };

  pendingPlayAgainPrompts.set(game.partyId, playAgainPrompt);
  playAgainPrompt.timer = setTimeout(() => resolvePlayAgainPrompt(game.partyId, io), PLAY_AGAIN_TIMEOUT);

  io.to(`party:${game.partyId}`).emit('leverblast:play-again-prompt', {
    partyId: game.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: Date.now(),
    players: playAgainPrompt.players,
    responses: [],
  });
};

const continueAfterSafePull = async (game: LeverGame, io: Server) => {
  const nextIndex = getNextAliveIndex(game, game.currentPlayerIndex);
  if (nextIndex === -1) {
    await endGame(game, io);
    return;
  }

  game.currentPlayerIndex = nextIndex;
  startTurnTimer(game, io);
  emitState(game, io);
};

const handlePull = async (
  partyId: string,
  userId: string,
  leverId: number,
  io: Server,
  isAuto = false,
) => {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;

  const currentPlayer = game.players[game.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.userId !== userId || !currentPlayer.isAlive) return;

  const selectedLever = game.levers.find((lever) => lever.id === leverId);
  if (!selectedLever || selectedLever.isPulled) return;

  clearTurnTimer(game);
  selectedLever.isPulled = true;
  currentPlayer.pulls += 1;

  const exploded = selectedLever.id === game.explosiveLeverId;
  if (exploded) {
    currentPlayer.isAlive = false;
    currentPlayer.explodedAtRound = game.round;
    game.lastEvent = {
      type: isAuto ? 'auto-boom' : 'boom',
      playerId: currentPlayer.userId,
      username: currentPlayer.username,
      leverId: selectedLever.id,
      leverColor: selectedLever.color,
    };
    emitState(game, io);

    const alivePlayers = getAlivePlayers(game);
    if (alivePlayers.length <= 1) {
      setTimeout(() => {
        void endGame(game, io);
      }, ROUND_RESET_DELAY);
      return;
    }

    setTimeout(() => {
      resetRound(game);
      const nextIndex = getNextAliveIndex(game, game.currentPlayerIndex);
      if (nextIndex === -1) {
        void endGame(game, io);
        return;
      }
      game.currentPlayerIndex = nextIndex;
      startTurnTimer(game, io);
      emitState(game, io);
    }, ROUND_RESET_DELAY);
    return;
  }

  currentPlayer.safePulls += 1;
  game.lastEvent = {
    type: isAuto ? 'auto-safe' : 'safe',
    playerId: currentPlayer.userId,
    username: currentPlayer.username,
    leverId: selectedLever.id,
    leverColor: selectedLever.color,
  };

  await continueAfterSafePull(game, io);
};

const resolveJoinPrompt = async (partyId: string, io: Server) => {
  const prompt = pendingJoinPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingJoinPrompts.delete(partyId);

  const acceptedIds = Array.from(prompt.responses.entries())
    .filter(([, accepted]) => accepted)
    .map(([userId]) => userId);

  if (acceptedIds.length < 2) {
    io.to(`party:${partyId}`).emit('leverblast:join-cancelled', { reason: 'Au moins 2 joueurs requis' });
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
  });

  if (members.length < 2) {
    io.to(`party:${partyId}`).emit('leverblast:join-cancelled', { reason: 'Au moins 2 joueurs requis' });
    return;
  }

  const game = createGameFromMembers(partyId, members);
  activeGames.set(partyId, game);
  startTurnTimer(game, io);
  emitState(game, io);
};

const resolvePlayAgainPrompt = async (partyId: string, io: Server) => {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingPlayAgainPrompts.delete(partyId);

  const acceptedIds = Array.from(prompt.responses.entries())
    .filter(([, playAgain]) => playAgain)
    .map(([userId]) => userId);

  if (acceptedIds.length < 2) {
    io.to(`party:${partyId}`).emit('leverblast:play-again-cancelled', { reason: 'Pas assez de joueurs' });
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
  });

  if (members.length < 2) {
    io.to(`party:${partyId}`).emit('leverblast:play-again-cancelled', { reason: 'Pas assez de joueurs' });
    return;
  }

  const game = createGameFromMembers(partyId, members);
  activeGames.set(partyId, game);
  startTurnTimer(game, io);
  emitState(game, io);
};

export const setupLeverBlastHandlers = (socket: Socket, io: Server) => {
  socket.on('leverblast:start', async (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: { party: true },
      });

      if (!membership || membership.partyId !== data.partyId || !membership.isLeader) {
        socket.emit('leverblast:error', { message: 'Seul le leader peut lancer la manche' });
        return;
      }

      if (activeGames.has(data.partyId) || pendingJoinPrompts.has(data.partyId)) {
        socket.emit('leverblast:error', { message: 'Une partie est déjà en cours' });
        return;
      }

      const partyMembers = await prisma.partyMember.findMany({
        where: { partyId: data.partyId },
        include: { user: { select: { id: true, username: true, usernameColor: true } } },
      });

      if (partyMembers.length < 2) {
        socket.emit('leverblast:error', { message: '2 joueurs minimum requis' });
        return;
      }

      const prompt: PendingJoinPrompt = {
        partyId: data.partyId,
        leaderId: userId,
        responses: new Map([[userId, true]]),
        memberIds: partyMembers.map((member) => member.user.id),
        timer: null,
      };

      pendingJoinPrompts.set(data.partyId, prompt);
      prompt.timer = setTimeout(() => resolveJoinPrompt(data.partyId, io), JOIN_TIMEOUT);

      io.to(`party:${data.partyId}`).emit('leverblast:join-prompt', {
        partyId: data.partyId,
        leaderId: userId,
        timeLimit: JOIN_TIMEOUT,
        startTime: Date.now(),
        members: partyMembers.map((member) => ({
          userId: member.user.id,
          username: member.user.username,
          usernameColor: member.user.usernameColor,
        })),
        responses: [{ userId, accepted: true }],
      });
    } catch (error) {
      console.error('Start lever blast error', error);
      socket.emit('leverblast:error', { message: 'Impossible de démarrer Levier Infernal' });
    }
  });

  socket.on('leverblast:join-response', (data: { partyId: string; accepted: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const prompt = pendingJoinPrompts.get(data.partyId);
    if (!prompt || !prompt.memberIds.includes(userId)) return;

    prompt.responses.set(userId, data.accepted);
    const responses = Array.from(prompt.responses.entries()).map(([playerId, accepted]) => ({
      userId: playerId,
      accepted,
    }));

    io.to(`party:${data.partyId}`).emit('leverblast:join-response-update', {
      partyId: data.partyId,
      responses,
    });

    if (prompt.responses.size === prompt.memberIds.length) {
      if (prompt.timer) clearTimeout(prompt.timer);
      void resolveJoinPrompt(data.partyId, io);
    }
  });

  socket.on('leverblast:pull', (data: { partyId: string; leverId: number }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    void handlePull(data.partyId, userId, data.leverId, io);
  });

  socket.on('leverblast:play-again-response', (data: { partyId: string; playAgain: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const prompt = pendingPlayAgainPrompts.get(data.partyId);
    if (!prompt || !prompt.players.some((player) => player.userId === userId)) return;

    prompt.responses.set(userId, data.playAgain);
    const responses = Array.from(prompt.responses.entries()).map(([playerId, playAgain]) => ({
      userId: playerId,
      playAgain,
    }));
    const playAgainCount = responses.filter((entry) => entry.playAgain).length;

    io.to(`party:${data.partyId}`).emit('leverblast:play-again-response-update', {
      partyId: data.partyId,
      responses,
      playAgainCount,
      leaveCount: responses.filter((entry) => !entry.playAgain).length,
    });

    if (prompt.responses.size === prompt.players.length) {
      void resolvePlayAgainPrompt(data.partyId, io);
    }
  });
};

export const sendActiveLeverBlastState = (socket: Socket, partyId: string, userId: string) => {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;
  if (!game.players.some((player) => player.userId === userId)) return;
  socket.emit('leverblast:state', serializeGame(game));
};

export const sendPendingLeverBlastPlayAgainPrompt = (
  socket: Socket,
  partyId: string,
  userId: string,
) => {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  if (!prompt.players.some((player) => player.userId === userId)) return;

  const responses = Array.from(prompt.responses.entries()).map(([playerId, playAgain]) => ({
    userId: playerId,
    playAgain,
  }));

  socket.emit('leverblast:play-again-prompt', {
    partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: Date.now(),
    players: prompt.players,
    responses,
    playAgainCount: responses.filter((entry) => entry.playAgain).length,
    leaveCount: responses.filter((entry) => !entry.playAgain).length,
  });
};
