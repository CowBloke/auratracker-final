import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';

interface PetitBacPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  score: number;
  submitted: boolean;
}

interface PetitBacGame {
  partyId: string;
  players: PetitBacPlayer[];
  categories: string[];
  currentLetter: string;
  round: number;
  maxRounds: number;
  roundDuration: number;
  roundStartTime: number;
  phase: 'playing' | 'scoring';
  isActive: boolean;
  roundTimer: NodeJS.Timeout | null;
  answers: Map<string, Record<string, string>>;
}

interface PendingJoinPrompt {
  partyId: string;
  leaderId: string;
  rounds: number;
  roundDuration: number;
  categories: string[];
  responses: Map<string, boolean>;
  memberIds: string[];
  timer: NodeJS.Timeout | null;
  startTime: number;
}

interface PendingPlayAgainPrompt {
  partyId: string;
  rounds: number;
  roundDuration: number;
  categories: string[];
  responses: Map<string, boolean>;
  players: Array<{
    userId: string;
    username: string;
    usernameColor?: string | null;
  }>;
  gameOverData: {
    winnerIds: string[];
    winnerUsernames: string[];
    players: Array<{
      userId: string;
      username: string;
      score: number;
      isWinner: boolean;
    }>;
  };
  timer: NodeJS.Timeout | null;
  startTime: number;
}

const activeGames = new Map<string, PetitBacGame>();
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();

const DEFAULT_CATEGORIES = ['Prenom', 'Ville', 'Pays', 'Animal', 'Objet', 'Metier'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const JOIN_PROMPT_MS = 10000;
const PLAY_AGAIN_PROMPT_MS = 20000;
const ROUND_PAUSE_MS = 4000;

function getRandomLetter(): string {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

function normalizeValue(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '');
}

function sanitizeCategories(categories?: string[]): string[] {
  const cleaned = (categories || [])
    .map((cat) => cat.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (cleaned.length === 0) {
    return DEFAULT_CATEGORIES;
  }
  const unique = Array.from(new Set(cleaned));
  return unique.length > 0 ? unique : DEFAULT_CATEGORIES;
}

function serializeGameState(game: PetitBacGame) {
  return {
    partyId: game.partyId,
    players: game.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
      score: p.score,
      submitted: p.submitted,
    })),
    categories: game.categories,
    currentLetter: game.currentLetter,
    round: game.round,
    maxRounds: game.maxRounds,
    roundDuration: game.roundDuration,
    roundStartTime: game.roundStartTime,
    phase: game.phase,
    submittedCount: game.players.filter((p) => p.submitted).length,
  };
}

export const setupPetitBacHandlers = (socket: Socket, io: Server) => {
  socket.on('petitbac:start', async (data: {
    userId: string;
    partyId: string;
    rounds: number;
    roundDuration: number;
    categories?: string[];
  }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, rounds, roundDuration, categories } = data;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: { party: true },
      });

      if (!membership || membership.partyId !== partyId) {
        socket.emit('petitbac:error', { message: 'You are not in this party' });
        return;
      }

      if (!membership.isLeader) {
        socket.emit('petitbac:error', { message: 'Only the party leader can start the game' });
        return;
      }

      if (activeGames.has(partyId)) {
        socket.emit('petitbac:error', { message: 'A game is already in progress' });
        return;
      }

      if (pendingJoinPrompts.has(partyId)) {
        socket.emit('petitbac:error', { message: 'A game is already being started' });
        return;
      }

      const partyMembers = await prisma.partyMember.findMany({
        where: { partyId },
        include: {
          user: {
            select: { id: true, username: true, usernameColor: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      });

      if (partyMembers.length < 2) {
        socket.emit('petitbac:error', { message: 'Need at least 2 players to start' });
        return;
      }

      const safeRounds = Math.min(Math.max(rounds || 5, 1), 10);
      const safeDuration = Math.min(Math.max(roundDuration || 60000, 15000), 120000);
      const safeCategories = sanitizeCategories(categories);

      const prompt: PendingJoinPrompt = {
        partyId,
        leaderId: userId,
        rounds: safeRounds,
        roundDuration: safeDuration,
        categories: safeCategories,
        responses: new Map(),
        memberIds: partyMembers.map((m) => m.userId),
        timer: null,
        startTime: Date.now(),
      };

      pendingJoinPrompts.set(partyId, prompt);

      prompt.timer = setTimeout(() => {
        resolveJoinPrompt(partyId, io);
      }, JOIN_PROMPT_MS);

      io.to(`party:${partyId}`).emit('petitbac:join-prompt', {
        partyId,
        leaderId: userId,
        rounds: safeRounds,
        roundDuration: safeDuration,
        categories: safeCategories,
        timeLimit: JOIN_PROMPT_MS,
        members: partyMembers.map((m) => ({
          userId: m.userId,
          username: m.user.username,
          usernameColor: m.user.usernameColor,
        })),
        responses: [],
      });
    } catch (error) {
      console.error('Start petit bac error:', error);
      socket.emit('petitbac:error', { message: 'Failed to start game' });
    }
  });

  socket.on('petitbac:join-response', (data: { partyId: string; userId: string; accepted: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, accepted } = data;
    const prompt = pendingJoinPrompts.get(partyId);
    if (!prompt) return;

    if (!prompt.memberIds.includes(userId)) return;

    prompt.responses.set(userId, accepted);

    const responses = Array.from(prompt.responses.entries()).map(([id, value]) => ({
      userId: id,
      accepted: value,
    }));

    io.to(`party:${partyId}`).emit('petitbac:join-response-update', {
      partyId,
      responses,
    });

    if (prompt.responses.size === prompt.memberIds.length) {
      resolveJoinPrompt(partyId, io);
    }
  });

  socket.on('petitbac:submit', (data: { partyId: string; userId: string; answers: Record<string, string> }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, answers } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive || game.phase !== 'playing') return;

    const player = game.players.find((p) => p.userId === userId);
    if (!player || player.submitted) return;

    const normalizedAnswers: Record<string, string> = {};
    for (const category of game.categories) {
      normalizedAnswers[category] = (answers?.[category] || '').trim();
    }

    game.answers.set(userId, normalizedAnswers);
    player.submitted = true;

    io.to(`party:${partyId}`).emit('petitbac:player-submitted', {
      partyId,
      userId,
      submittedCount: game.players.filter((p) => p.submitted).length,
    });

    if (game.players.every((p) => p.submitted)) {
      endRound(game, io);
    }
  });

  socket.on('petitbac:leave', async (data: { partyId: string; userId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;
    const game = activeGames.get(partyId);
    if (!game) return;

    const playerIndex = game.players.findIndex((p) => p.userId === userId);
    if (playerIndex === -1) return;

    game.players.splice(playerIndex, 1);
    game.answers.delete(userId);

    io.to(`party:${partyId}`).emit('petitbac:player-left', { userId });

    if (game.players.length < 2) {
      await endGame(game, io);
    }
  });

  socket.on('petitbac:play-again-response', (data: {
    partyId: string;
    userId: string;
    playAgain: boolean;
  }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, playAgain } = data;
    const prompt = pendingPlayAgainPrompts.get(partyId);
    if (!prompt) return;

    if (!prompt.players.find((p) => p.userId === userId)) return;

    prompt.responses.set(userId, playAgain);

    const responses = Array.from(prompt.responses.entries()).map(([id, pa]) => ({
      userId: id,
      playAgain: pa,
    }));

    const playAgainCount = responses.filter((r) => r.playAgain).length;
    const leaveCount = responses.filter((r) => !r.playAgain).length;

    io.to(`party:${partyId}`).emit('petitbac:play-again-response-update', {
      partyId,
      userId,
      playAgain,
      responses,
      playAgainCount,
      leaveCount,
    });

    if (prompt.responses.size === prompt.players.length) {
      if (prompt.timer) {
        clearTimeout(prompt.timer);
        prompt.timer = null;
      }
      resolvePlayAgainPrompt(partyId, io);
    }
  });
};

async function resolveJoinPrompt(partyId: string, io: Server) {
  const prompt = pendingJoinPrompts.get(partyId);
  if (!prompt) return;

  if (prompt.timer) {
    clearTimeout(prompt.timer);
    prompt.timer = null;
  }

  const acceptedUserIds = Array.from(prompt.responses.entries())
    .filter(([_, accepted]) => accepted)
    .map(([userId]) => userId);

  pendingJoinPrompts.delete(partyId);

  if (acceptedUserIds.length < 2) {
    io.to(`party:${partyId}`).emit('petitbac:join-cancelled', {
      reason: 'Not enough players accepted (need at least 2)',
    });
    return;
  }

  const partyMembers = await prisma.partyMember.findMany({
    where: {
      partyId,
      userId: { in: acceptedUserIds },
    },
    include: {
      user: {
        select: { id: true, username: true, usernameColor: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  if (partyMembers.length < 2) {
    io.to(`party:${partyId}`).emit('petitbac:join-cancelled', {
      reason: 'Not enough players still in party',
    });
    return;
  }

  const game: PetitBacGame = {
    partyId,
    players: partyMembers.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      usernameColor: m.user.usernameColor,
      score: 0,
      submitted: false,
    })),
    categories: prompt.categories,
    currentLetter: getRandomLetter(),
    round: 1,
    maxRounds: prompt.rounds,
    roundDuration: prompt.roundDuration,
    roundStartTime: Date.now(),
    phase: 'playing',
    isActive: true,
    roundTimer: null,
    answers: new Map(),
  };

  activeGames.set(partyId, game);
  startRoundTimer(game, io);

  io.to(`party:${partyId}`).emit('petitbac:started', serializeGameState(game));
}

function startRoundTimer(game: PetitBacGame, io: Server) {
  if (game.roundTimer) {
    clearTimeout(game.roundTimer);
  }
  game.roundTimer = setTimeout(() => {
    endRound(game, io);
  }, game.roundDuration);
}

function endRound(game: PetitBacGame, io: Server) {
  if (!game.isActive || game.phase !== 'playing') return;

  if (game.roundTimer) {
    clearTimeout(game.roundTimer);
    game.roundTimer = null;
  }

  const letter = normalizeValue(game.currentLetter)[0];
  const roundScores: Array<{
    userId: string;
    username: string;
    answers: Record<string, string>;
    perCategoryScores: Record<string, number>;
    score: number;
    totalScore: number;
  }> = [];

  const categoryAnswerMap: Record<string, Record<string, number>> = {};
  for (const category of game.categories) {
    const counts: Record<string, number> = {};
    for (const player of game.players) {
      const answer = game.answers.get(player.userId)?.[category] || '';
      const normalized = normalizeValue(answer);
      if (!normalized || normalized[0] !== letter) continue;
      counts[normalized] = (counts[normalized] || 0) + 1;
    }
    categoryAnswerMap[category] = counts;
  }

  for (const player of game.players) {
    const answers = game.answers.get(player.userId) || {};
    let totalRoundScore = 0;
    const perCategoryScores: Record<string, number> = {};

    for (const category of game.categories) {
      const rawAnswer = answers[category] || '';
      const normalized = normalizeValue(rawAnswer);
      if (!normalized || normalized[0] !== letter) {
        perCategoryScores[category] = 0;
        continue;
      }
      const count = categoryAnswerMap[category][normalized] || 0;
      const score = count <= 1 ? 10 : 5;
      perCategoryScores[category] = score;
      totalRoundScore += score;
    }

    player.score += totalRoundScore;
    player.submitted = false;
    roundScores.push({
      userId: player.userId,
      username: player.username,
      answers,
      perCategoryScores,
      score: totalRoundScore,
      totalScore: player.score,
    });
  }

  game.phase = 'scoring';

  io.to(`party:${game.partyId}`).emit('petitbac:round-ended', {
    game: serializeGameState(game),
    result: {
      round: game.round,
      letter: game.currentLetter,
      categories: game.categories,
      submissions: roundScores,
    },
  });

  if (game.round >= game.maxRounds) {
    endGame(game, io);
    return;
  }

  setTimeout(() => {
    if (!game.isActive) return;
    game.round += 1;
    game.currentLetter = getRandomLetter();
    game.roundStartTime = Date.now();
    game.phase = 'playing';
    game.answers.clear();
    game.players.forEach((p) => {
      p.submitted = false;
    });
    startRoundTimer(game, io);
    io.to(`party:${game.partyId}`).emit('petitbac:round-started', serializeGameState(game));
  }, ROUND_PAUSE_MS);
}

async function endGame(game: PetitBacGame, io: Server) {
  if (!game.isActive) return;
  game.isActive = false;

  if (game.roundTimer) {
    clearTimeout(game.roundTimer);
    game.roundTimer = null;
  }

  if (game.players.length === 0) {
    activeGames.delete(game.partyId);
    return;
  }

  const topScore = Math.max(...game.players.map((p) => p.score));
  const winners = game.players.filter((p) => p.score === topScore);

  const gameOverData = {
    winnerIds: winners.map((p) => p.userId),
    winnerUsernames: winners.map((p) => p.username),
    players: game.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      score: p.score,
      isWinner: winners.some((w) => w.userId === p.userId),
    })),
  };

  activeGames.delete(game.partyId);

  // Check quest progress for all players
  for (const player of game.players) {
    await checkQuestProgress(player.userId, 'PETIT_BAC_PLAYS', 1);
    await checkQuestProgress(player.userId, 'PLAY_GAMES', 1);
    if (winners.some((w) => w.userId === player.userId)) {
      await checkQuestProgress(player.userId, 'WIN_GAMES', 1);
    }
  }

  const playAgainPrompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    rounds: game.maxRounds,
    roundDuration: game.roundDuration,
    categories: game.categories,
    responses: new Map(),
    players: game.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
    })),
    gameOverData,
    timer: null,
    startTime: Date.now(),
  };

  pendingPlayAgainPrompts.set(game.partyId, playAgainPrompt);

  playAgainPrompt.timer = setTimeout(() => {
    resolvePlayAgainPrompt(game.partyId, io);
  }, PLAY_AGAIN_PROMPT_MS);

  io.to(`party:${game.partyId}`).emit('petitbac:play-again-prompt', {
    partyId: game.partyId,
    timeLimit: PLAY_AGAIN_PROMPT_MS,
    gameOverData,
    players: playAgainPrompt.players,
    responses: [],
  });
}

async function resolvePlayAgainPrompt(partyId: string, io: Server) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;

  if (prompt.timer) {
    clearTimeout(prompt.timer);
    prompt.timer = null;
  }

  const playAgainUserIds = Array.from(prompt.responses.entries())
    .filter(([_, playAgain]) => playAgain)
    .map(([userId]) => userId);

  pendingPlayAgainPrompts.delete(partyId);

  if (playAgainUserIds.length < 2) {
    io.to(`party:${partyId}`).emit('petitbac:play-again-cancelled', {
      reason: 'Not enough players want to play again (need at least 2)',
    });
    return;
  }

  const partyMembers = await prisma.partyMember.findMany({
    where: {
      partyId,
      userId: { in: playAgainUserIds },
    },
    include: {
      user: {
        select: { id: true, username: true, usernameColor: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  if (partyMembers.length < 2) {
    io.to(`party:${partyId}`).emit('petitbac:play-again-cancelled', {
      reason: 'Not enough players still in party',
    });
    return;
  }

  const game: PetitBacGame = {
    partyId,
    players: partyMembers.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      usernameColor: m.user.usernameColor,
      score: 0,
      submitted: false,
    })),
    categories: prompt.categories,
    currentLetter: getRandomLetter(),
    round: 1,
    maxRounds: prompt.rounds,
    roundDuration: prompt.roundDuration,
    roundStartTime: Date.now(),
    phase: 'playing',
    isActive: true,
    roundTimer: null,
    answers: new Map(),
  };

  activeGames.set(partyId, game);
  startRoundTimer(game, io);

  io.to(`party:${partyId}`).emit('petitbac:started', serializeGameState(game));
}

export function sendPendingPetitBacPlayAgainPrompt(socket: Socket, partyId: string, userId: string) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;

  const isPlayer = prompt.players.some((p) => p.userId === userId);
  if (!isPlayer) return;

  const elapsed = Date.now() - prompt.startTime;
  const timeRemaining = Math.max(0, PLAY_AGAIN_PROMPT_MS - elapsed);
  if (timeRemaining <= 0) return;

  const responses = Array.from(prompt.responses.entries()).map(([id, playAgain]) => ({
    userId: id,
    playAgain,
  }));
  const playAgainCount = responses.filter((r) => r.playAgain).length;
  const leaveCount = responses.filter((r) => !r.playAgain).length;

  socket.emit('petitbac:play-again-prompt', {
    partyId: prompt.partyId,
    timeLimit: timeRemaining,
    gameOverData: prompt.gameOverData,
    players: prompt.players,
    responses,
    playAgainCount,
    leaveCount,
  });
}

export function sendActivePetitBacGameState(socket: Socket, partyId: string, userId: string) {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;

  const isPlayer = game.players.some((p) => p.userId === userId);
  if (!isPlayer) return;

  socket.emit('petitbac:started', serializeGameState(game));
}
