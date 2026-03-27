import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';
import { logGame } from '../utils/logger.js';

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
  phase: 'playing' | 'review' | 'scoring';
  isActive: boolean;
  roundTimer: NodeJS.Timeout | null;
  answers: Map<string, Record<string, string>>;
  reviewAssignments: Map<string, Array<{ playerId: string; category: string }>>;
  reviewVotes: Map<string, Map<string, Record<string, boolean>>>;
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
  const pendingReviews = Array.from(game.reviewAssignments.values()).reduce((total, assignments) => total + assignments.length, 0);
  const completedReviews = Array.from(game.reviewVotes.values()).reduce((total, playerVotes) => {
    return total + Array.from(playerVotes.values()).reduce((playerTotal, categories) => playerTotal + Object.keys(categories).length, 0);
  }, 0);

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
    reviewProgress: {
      completed: completedReviews,
      total: pendingReviews,
    },
  };
}

function serializeReviewState(game: PetitBacGame) {
  return {
    round: game.round,
    letter: game.currentLetter,
    categories: game.categories,
    submissions: game.players.map((player) => ({
      userId: player.userId,
      username: player.username,
      answers: game.answers.get(player.userId) || {},
    })),
    reviewAssignments: Array.from(game.reviewAssignments.entries()).map(([reviewerId, targets]) => ({
      reviewerId,
      targets,
    })),
    completedReviewerIds: Array.from(game.reviewVotes.keys()),
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

    beginReviewPhase(game, io);
  });

  socket.on('petitbac:submit-review', (data: {
    partyId: string;
    userId: string;
    validations: Record<string, Record<string, boolean>>;
  }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, validations } = data;
    const game = activeGames.get(partyId);
    if (!game || !game.isActive || game.phase !== 'review') return;

    const assignments = game.reviewAssignments.get(userId) || [];
    if (assignments.length === 0) return;

    const reviewMap = new Map<string, Record<string, boolean>>();
    for (const assignment of assignments) {
      const decision = validations?.[assignment.playerId]?.[assignment.category];
      if (typeof decision !== 'boolean') {
        return;
      }
      const playerReviews = reviewMap.get(assignment.playerId) || {};
      playerReviews[assignment.category] = decision;
      reviewMap.set(assignment.playerId, playerReviews);
    }

    game.reviewVotes.set(userId, reviewMap);

    io.to(`party:${partyId}`).emit('petitbac:review-progress', {
      game: serializeGameState(game),
      completedReviewerIds: Array.from(game.reviewVotes.keys()),
    });

    if (game.players.every((player) => (game.reviewAssignments.get(player.userId) || []).length === 0 || game.reviewVotes.has(player.userId))) {
      finalizeRound(game, io);
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
    game.reviewAssignments.delete(userId);
    game.reviewVotes.delete(userId);
    game.reviewAssignments.forEach((assignments, reviewerId) => {
      const filtered = assignments.filter((assignment) => assignment.playerId !== userId);
      game.reviewAssignments.set(reviewerId, filtered);
    });
    game.reviewVotes.forEach((votes) => {
      votes.delete(userId);
    });

    io.to(`party:${partyId}`).emit('petitbac:player-left', { userId });

    if (game.players.length < 2) {
      await endGame(game, io);
      return;
    }

    if (game.phase === 'playing' && game.players.every((p) => p.submitted)) {
      beginReviewPhase(game, io);
      return;
    }

    if (game.phase === 'review') {
      io.to(`party:${partyId}`).emit('petitbac:review-progress', {
        game: serializeGameState(game),
        completedReviewerIds: Array.from(game.reviewVotes.keys()),
      });
      if (game.players.every((player) => (game.reviewAssignments.get(player.userId) || []).length === 0 || game.reviewVotes.has(player.userId))) {
        finalizeRound(game, io);
      }
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
    reviewAssignments: new Map(),
    reviewVotes: new Map(),
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
    for (const player of game.players) {
      if (!player.submitted) {
        if (!game.answers.has(player.userId)) {
          game.answers.set(player.userId, {});
        }
        player.submitted = true;
      }
    }
    beginReviewPhase(game, io);
  }, game.roundDuration);
}

function buildReviewAssignments(game: PetitBacGame) {
  const assignments = new Map<string, Array<{ playerId: string; category: string }>>();

  for (const reviewer of game.players) {
    const reviewerAssignments: Array<{ playerId: string; category: string }> = [];
    for (const target of game.players) {
      if (target.userId === reviewer.userId) continue;
      const answers = game.answers.get(target.userId) || {};
      for (const category of game.categories) {
        if ((answers[category] || '').trim()) {
          reviewerAssignments.push({ playerId: target.userId, category });
        }
      }
    }
    assignments.set(reviewer.userId, reviewerAssignments);
  }

  return assignments;
}

function beginReviewPhase(game: PetitBacGame, io: Server) {
  if (!game.isActive || game.phase !== 'playing') return;

  if (game.roundTimer) {
    clearTimeout(game.roundTimer);
    game.roundTimer = null;
  }

  game.phase = 'review';
  game.reviewAssignments = buildReviewAssignments(game);
  game.reviewVotes.clear();

  io.to(`party:${game.partyId}`).emit('petitbac:review-started', {
    game: serializeGameState(game),
    result: serializeReviewState(game),
  });

  const noReviewsNeeded = game.players.every((player) => (game.reviewAssignments.get(player.userId) || []).length === 0);
  if (noReviewsNeeded) {
    finalizeRound(game, io);
  }
}

function finalizeRound(game: PetitBacGame, io: Server) {
  if (!game.isActive || game.phase !== 'review') return;

  const letter = normalizeValue(game.currentLetter)[0];
  const roundScores: Array<{
    userId: string;
    username: string;
    answers: Record<string, string>;
    perCategoryScores: Record<string, number>;
    validationStatus: Record<string, 'accepted' | 'rejected' | 'auto-rejected'>;
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
    const validationStatus: Record<string, 'accepted' | 'rejected' | 'auto-rejected'> = {};

    for (const category of game.categories) {
      const rawAnswer = answers[category] || '';
      const normalized = normalizeValue(rawAnswer);
      if (!normalized || normalized[0] !== letter) {
        perCategoryScores[category] = 0;
        validationStatus[category] = 'auto-rejected';
        continue;
      }
      const reviews = game.players
        .filter((reviewer) => reviewer.userId !== player.userId)
        .map((reviewer) => game.reviewVotes.get(reviewer.userId)?.get(player.userId)?.[category] ?? false);
      const isAccepted = reviews.length > 0 && reviews.every(Boolean);
      if (!isAccepted) {
        perCategoryScores[category] = 0;
        validationStatus[category] = 'rejected';
        continue;
      }
      const count = categoryAnswerMap[category][normalized] || 0;
      const score = count <= 1 ? 10 : 5;
      perCategoryScores[category] = score;
      validationStatus[category] = 'accepted';
      totalRoundScore += score;
    }

    player.score += totalRoundScore;
    player.submitted = false;
    roundScores.push({
      userId: player.userId,
      username: player.username,
      answers,
      perCategoryScores,
      validationStatus,
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
    game.reviewAssignments.clear();
    game.reviewVotes.clear();
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

  for (const player of game.players) {
    logGame('game_complete', player.userId, player.username, {
      gameType: 'petit_bac',
      score: player.score,
      won: winners.some((w) => w.userId === player.userId),
      auraReward: 0,
      moneyReward: 0,
      isMultiplayer: true,
      partyId: game.partyId,
      totalPlayers: game.players.length,
      winnerIds: winners.map((w) => w.userId),
      winnerUsernames: winners.map((w) => w.username),
      rounds: game.maxRounds,
    });
  }

  activeGames.delete(game.partyId);

  io.to(`party:${game.partyId}`).emit('petitbac:game-over', gameOverData);

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
    startTime: Date.now(),
    rounds: playAgainPrompt.rounds,
    roundDuration: playAgainPrompt.roundDuration,
    categories: playAgainPrompt.categories,
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
    reviewAssignments: new Map(),
    reviewVotes: new Map(),
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

  const responses = Array.from(prompt.responses.entries()).map(([id, playAgain]) => ({
    userId: id,
    playAgain,
  }));
  const playAgainCount = responses.filter((r) => r.playAgain).length;
  const leaveCount = responses.filter((r) => !r.playAgain).length;

  socket.emit('petitbac:play-again-prompt', {
    partyId: prompt.partyId,
    timeLimit: PLAY_AGAIN_PROMPT_MS,
    startTime: Date.now(),
    rounds: prompt.rounds,
    roundDuration: prompt.roundDuration,
    categories: prompt.categories,
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
  if (game.phase === 'review') {
    socket.emit('petitbac:review-started', {
      game: serializeGameState(game),
      result: serializeReviewState(game),
    });
  }
}
