import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';
import { logGame } from '../utils/logger.js';

interface Jackpot5Player {
  userId: string;
  username: string;
  usernameColor?: string | null;
}

interface Jackpot5Game {
  partyId: string;
  players: Jackpot5Player[];
  picks: Map<string, number[]>;
  submittedUserIds: Set<string>;
  draw: number[] | null;
  pickDeadline: number;
  timer: NodeJS.Timeout | null;
  isActive: boolean;
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
  players: Jackpot5Player[];
  timer: NodeJS.Timeout | null;
  results: Jackpot5GameOver['results'];
  draw: number[];
}

interface Jackpot5Result {
  userId: string;
  username: string;
  usernameColor?: string | null;
  pick: number[] | null;
  matches: number;
  auraReward: number;
  moneyReward: number;
  isWinner: boolean;
}

interface Jackpot5GameOver {
  partyId: string;
  draw: number[];
  winners: string[];
  results: Jackpot5Result[];
}

const activeGames = new Map<string, Jackpot5Game>();
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();

const JOIN_TIMEOUT = 15000;
const PICK_TIMEOUT = 45000;
const PLAY_AGAIN_TIMEOUT = 20000;
const DIGITS_PER_PICK = 5;

const REWARD_TABLE: Record<number, { money: number; aura: number }> = {
  0: { money: 0, aura: 0 },
  1: { money: 0, aura: 0 },
  2: { money: 25, aura: 1 },
  3: { money: 70, aura: 3 },
  4: { money: 180, aura: 7 },
  5: { money: 450, aura: 18 },
};

const isValidPick = (pick: unknown): pick is number[] =>
  Array.isArray(pick)
  && pick.length === DIGITS_PER_PICK
  && pick.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9);

const randomDraw = () =>
  Array.from({ length: DIGITS_PER_PICK }, () => Math.floor(Math.random() * 10));

const countMatches = (pick: number[], draw: number[]) => {
  const remaining = [...draw];
  let matches = 0;

  for (const digit of pick) {
    const index = remaining.indexOf(digit);
    if (index !== -1) {
      remaining.splice(index, 1);
      matches += 1;
    }
  }

  return matches;
};

const serializeGame = (game: Jackpot5Game) => ({
  partyId: game.partyId,
  players: game.players,
  submittedUserIds: Array.from(game.submittedUserIds),
  pickDeadline: game.pickDeadline,
  digitsPerPick: DIGITS_PER_PICK,
  isActive: game.isActive,
});

const emitState = (io: Server, game: Jackpot5Game) => {
  io.to(`party:${game.partyId}`).emit('jackpot5:state', serializeGame(game));
};

const finishGame = async (game: Jackpot5Game, io: Server) => {
  if (!game.isActive) return;
  game.isActive = false;

  if (game.timer) {
    clearTimeout(game.timer);
    game.timer = null;
  }

  const draw = game.draw ?? randomDraw();
  game.draw = draw;

  const results = game.players.map((player) => {
    const pick = game.picks.get(player.userId) ?? null;
    const matches = pick ? countMatches(pick, draw) : 0;
    const reward = REWARD_TABLE[matches] ?? REWARD_TABLE[0];

    return {
      userId: player.userId,
      username: player.username,
      usernameColor: player.usernameColor,
      pick,
      matches,
      auraReward: reward.aura,
      moneyReward: reward.money,
      isWinner: false,
    };
  });

  const topMatches = Math.max(...results.map((result) => result.matches), 0);
  const winners = results
    .filter((result) => result.matches === topMatches && topMatches > 0)
    .map((result) => result.userId);

  for (const result of results) {
    result.isWinner = winners.includes(result.userId);
  }

  await Promise.all(results.map(async (result) => {
    if (result.auraReward > 0 || result.moneyReward > 0) {
      await prisma.user.update({
        where: { id: result.userId },
        data: {
          aura: { increment: result.auraReward },
          money: { increment: result.moneyReward },
        },
      });
    }

    logGame('game_complete', result.userId, result.username, {
      gameType: 'jackpot_5',
      score: result.matches,
      won: result.isWinner,
      auraReward: result.auraReward,
      moneyReward: result.moneyReward,
      isMultiplayer: true,
      partyId: game.partyId,
      totalPlayers: game.players.length,
      draw,
      pick: result.pick,
    });

    await checkQuestProgress(result.userId, 'PLAY_GAMES', 1);
    if (result.isWinner) {
      await checkQuestProgress(result.userId, 'WIN_GAMES', 1);
    }
  }));

  activeGames.delete(game.partyId);

  const payload: Jackpot5GameOver = {
    partyId: game.partyId,
    draw,
    winners,
    results: results.sort((a, b) => (
      b.matches - a.matches
      || b.moneyReward - a.moneyReward
      || a.username.localeCompare(b.username, 'fr')
    )),
  };

  io.to(`party:${game.partyId}`).emit('jackpot5:game-over', payload);

  const playAgainPrompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    responses: new Map(),
    players: game.players,
    timer: null,
    results: payload.results,
    draw,
  };

  pendingPlayAgainPrompts.set(game.partyId, playAgainPrompt);
  playAgainPrompt.timer = setTimeout(() => resolvePlayAgainPrompt(game.partyId, io), PLAY_AGAIN_TIMEOUT);

  io.to(`party:${game.partyId}`).emit('jackpot5:play-again-prompt', {
    partyId: game.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: Date.now(),
    players: playAgainPrompt.players,
    responses: [],
    draw,
    results: payload.results,
  });
};

const startPickingPhase = (partyId: string, players: Jackpot5Player[], io: Server) => {
  const game: Jackpot5Game = {
    partyId,
    players,
    picks: new Map(),
    submittedUserIds: new Set(),
    draw: null,
    pickDeadline: Date.now() + PICK_TIMEOUT,
    timer: null,
    isActive: true,
  };

  game.timer = setTimeout(() => {
    void finishGame(game, io);
  }, PICK_TIMEOUT);

  activeGames.set(partyId, game);
  emitState(io, game);
};

const resolveJoinPrompt = async (partyId: string, io: Server) => {
  const prompt = pendingJoinPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingJoinPrompts.delete(partyId);

  const acceptedIds = Array.from(prompt.responses.entries())
    .filter(([_, accepted]) => accepted)
    .map(([userId]) => userId);

  if (acceptedIds.length < 2) {
    io.to(`party:${partyId}`).emit('jackpot5:join-cancelled', { reason: 'Au moins 2 joueurs sont requis.' });
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          usernameColor: true,
        },
      },
    },
  });

  const players = members.map((member) => ({
    userId: member.user.id,
    username: member.user.username,
    usernameColor: member.user.usernameColor,
  }));

  startPickingPhase(partyId, players, io);
};

const resolvePlayAgainPrompt = async (partyId: string, io: Server) => {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingPlayAgainPrompts.delete(partyId);

  const acceptedIds = Array.from(prompt.responses.entries())
    .filter(([_, accepted]) => accepted)
    .map(([userId]) => userId);

  if (acceptedIds.length < 2) {
    io.to(`party:${partyId}`).emit('jackpot5:play-again-cancelled', { reason: 'Pas assez de joueurs pour relancer.' });
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          usernameColor: true,
        },
      },
    },
  });

  if (members.length < 2) {
    io.to(`party:${partyId}`).emit('jackpot5:play-again-cancelled', { reason: 'Pas assez de joueurs pour relancer.' });
    return;
  }

  startPickingPhase(partyId, members.map((member) => ({
    userId: member.user.id,
    username: member.user.username,
    usernameColor: member.user.usernameColor,
  })), io);
};

export const setupJackpot5Handlers = (socket: Socket, io: Server) => {
  socket.on('jackpot5:start', async (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: { party: true },
      });

      if (!membership || membership.partyId !== data.partyId || !membership.isLeader) {
        socket.emit('jackpot5:error', { message: 'Seul le leader peut lancer Jackpot 5.' });
        return;
      }

      if (pendingJoinPrompts.has(data.partyId) || activeGames.has(data.partyId)) {
        socket.emit('jackpot5:error', { message: 'Une partie de Jackpot 5 est déjà en cours.' });
        return;
      }

      const partyMembers = await prisma.partyMember.findMany({
        where: { partyId: data.partyId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              usernameColor: true,
            },
          },
        },
      });

      if (partyMembers.length < 2) {
        socket.emit('jackpot5:error', { message: '2 joueurs minimum requis.' });
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

      io.to(`party:${data.partyId}`).emit('jackpot5:join-prompt', {
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
      console.error('jackpot5:start error', error);
      socket.emit('jackpot5:error', { message: 'Impossible de lancer Jackpot 5.' });
    }
  });

  socket.on('jackpot5:join-response', (data: { partyId: string; accepted: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const prompt = pendingJoinPrompts.get(data.partyId);
    if (!prompt || !prompt.memberIds.includes(userId)) return;

    prompt.responses.set(userId, data.accepted);
    const responses = Array.from(prompt.responses.entries()).map(([id, accepted]) => ({ userId: id, accepted }));
    io.to(`party:${data.partyId}`).emit('jackpot5:join-response-update', { partyId: data.partyId, responses });

    if (prompt.responses.size === prompt.memberIds.length) {
      void resolveJoinPrompt(data.partyId, io);
    }
  });

  socket.on('jackpot5:submit-pick', async (data: { partyId: string; pick: number[] }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const game = activeGames.get(data.partyId);
    if (!game || !game.isActive) return;
    if (!game.players.some((player) => player.userId === userId)) return;
    if (!isValidPick(data.pick)) {
      socket.emit('jackpot5:error', { message: 'La combinaison doit contenir 5 chiffres entre 0 et 9.' });
      return;
    }

    game.picks.set(userId, [...data.pick]);
    game.submittedUserIds.add(userId);
    emitState(io, game);

    if (game.submittedUserIds.size === game.players.length) {
      await finishGame(game, io);
    }
  });

  socket.on('jackpot5:play-again-response', (data: { partyId: string; playAgain: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const prompt = pendingPlayAgainPrompts.get(data.partyId);
    if (!prompt || !prompt.players.some((player) => player.userId === userId)) return;

    prompt.responses.set(userId, data.playAgain);
    const responses = Array.from(prompt.responses.entries()).map(([id, playAgain]) => ({ userId: id, playAgain }));

    io.to(`party:${data.partyId}`).emit('jackpot5:play-again-response-update', {
      partyId: data.partyId,
      responses,
      playAgainCount: responses.filter((response) => response.playAgain).length,
      leaveCount: responses.filter((response) => !response.playAgain).length,
    });

    if (prompt.responses.size === prompt.players.length) {
      void resolvePlayAgainPrompt(data.partyId, io);
    }
  });
};

export const sendActiveJackpot5State = (socket: Socket, partyId: string, userId: string) => {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;
  if (!game.players.some((player) => player.userId === userId)) return;
  socket.emit('jackpot5:state', serializeGame(game));
};

export const sendPendingJackpot5PlayAgainPrompt = (socket: Socket, partyId: string, userId: string) => {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  if (!prompt.players.some((player) => player.userId === userId)) return;

  socket.emit('jackpot5:play-again-prompt', {
    partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: Date.now(),
    players: prompt.players,
    responses: Array.from(prompt.responses.entries()).map(([id, playAgain]) => ({ userId: id, playAgain })),
    draw: prompt.draw,
    results: prompt.results,
  });
};
