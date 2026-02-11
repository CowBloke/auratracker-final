import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { logGame } from '../utils/logger.js';
import { checkQuestProgress } from '../routes/quests.js';

interface RussianRoulettePlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  isAlive: boolean;
  roundsSurvived: number;
  isEliminated: boolean;
}

interface RussianRouletteGame {
  partyId: string;
  players: RussianRoulettePlayer[];
  currentPlayerIndex: number;
  round: number;
  isActive: boolean;
  chamberPosition: number; // Position actuelle dans le barillet (0-5)
  bulletPosition: number; // Position de la balle (0-5, aléatoire au début)
}

// Store active games by partyId
const activeGames = new Map<string, RussianRouletteGame>();

// Store pending join prompts by partyId
interface PendingJoinPrompt {
  partyId: string;
  leaderId: string;
  responses: Map<string, boolean>; // userId -> accepted
  memberIds: string[];
  timer: NodeJS.Timeout | null;
  startTime: number;
}
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();

// Store pending play again prompts by partyId
interface PendingPlayAgainPrompt {
  partyId: string;
  responses: Map<string, boolean>; // userId -> playAgain (true) or leave (false)
  players: Array<{
    userId: string;
    username: string;
    usernameColor?: string | null;
  }>;
  gameOverData: {
    winnerId: string | null;
    winnerUsername: string | null;
    players: Array<{
      userId: string;
      username: string;
      roundsSurvived: number;
      isWinner: boolean;
      rewards: { aura: number; money: number };
    }>;
  };
  timer: NodeJS.Timeout | null;
  startTime: number;
}
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();

const JOIN_PROMPT_TIMEOUT = 30000; // 30 seconds
const PLAY_AGAIN_PROMPT_TIMEOUT = 20000;

// Calculate rewards based on performance
function calculateRewards(
  isWinner: boolean,
  roundsSurvived: number,
  totalPlayers: number
): { aura: number; money: number } {
  if (isWinner) {
    // Winner gets more rewards based on number of players and rounds
    const baseAura = 20 + (totalPlayers - 2) * 5; // More players = more reward
    const baseMoney = 100 + (totalPlayers - 2) * 25;
    const roundBonus = roundsSurvived * 5; // Bonus for surviving more rounds
    return {
      aura: baseAura + roundBonus,
      money: baseMoney + roundBonus * 2,
    };
  } else {
    // Losers get smaller rewards based on how long they survived
    return {
      aura: Math.max(0, roundsSurvived * 2),
      money: Math.max(0, roundsSurvived * 10),
    };
  }
}

// Send active game state to a socket
export const sendActiveRussianRouletteState = (socket: Socket, partyId: string, userId: string) => {
  const game = activeGames.get(partyId);
  if (!game) return;

  const player = game.players.find((p) => p.userId === userId);
  if (!player) return;

  socket.emit('russianroulette:state', {
    players: game.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
      isAlive: p.isAlive,
      roundsSurvived: p.roundsSurvived,
      isEliminated: p.isEliminated,
    })),
    currentPlayerIndex: game.currentPlayerIndex,
    round: game.round,
    isActive: game.isActive,
    isYourTurn: game.players[game.currentPlayerIndex]?.userId === userId,
  });
};

// Send pending play again prompt to a socket
export const sendPendingRussianRoulettePlayAgainPrompt = (
  socket: Socket,
  partyId: string,
  userId: string
) => {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;

  const isPlayer = prompt.players.some((p) => p.userId === userId);
  if (!isPlayer) return;

  const responses = Array.from(prompt.responses.entries()).map(([uid, playAgain]) => ({
    userId: uid,
    playAgain,
  }));
  const playAgainCount = responses.filter((r) => r.playAgain).length;
  const leaveCount = responses.filter((r) => !r.playAgain).length;

  socket.emit('russianroulette:play-again-prompt', {
    partyId: prompt.partyId,
    timeLimit: PLAY_AGAIN_PROMPT_TIMEOUT,
    startTime: Date.now(),
    players: prompt.players,
    responses,
    playAgainCount,
    leaveCount,
  });
};

export const setupRussianRouletteHandlers = (socket: Socket, io: Server) => {
  // Start game (initiates join prompt for all party members)
  socket.on('russianroulette:start', async (data: { userId: string; partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;

    try {
      // Check if user is party leader
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: { party: true },
      });

      if (!membership || membership.partyId !== partyId) {
        socket.emit('russianroulette:error', { message: 'You are not in this party' });
        return;
      }

      if (!membership.isLeader) {
        socket.emit('russianroulette:error', {
          message: 'Only the party leader can start the game',
        });
        return;
      }

      // Check if game already active or join prompt pending
      if (activeGames.has(partyId)) {
        socket.emit('russianroulette:error', { message: 'A game is already in progress' });
        return;
      }

      if (pendingJoinPrompts.has(partyId)) {
        socket.emit('russianroulette:error', { message: 'A game is already being started' });
        return;
      }

      // Get all party members
      const partyMembers = await prisma.partyMember.findMany({
        where: { partyId },
        include: {
          user: {
            select: { id: true, username: true, usernameColor: true },
          },
        },
      });

      if (partyMembers.length < 2) {
        socket.emit('russianroulette:error', { message: 'Need at least 2 players to start' });
        return;
      }

      // Create pending join prompt
      const memberIds = partyMembers.map((m) => m.user.id);
      const pendingPrompt: PendingJoinPrompt = {
        partyId,
        leaderId: userId,
        responses: new Map(),
        memberIds,
        timer: null,
        startTime: Date.now(),
      };

      pendingJoinPrompts.set(partyId, pendingPrompt);

      // Send join prompt to all members
      io.to(`party:${partyId}`).emit('russianroulette:join-prompt', {
        partyId,
        timeout: JOIN_PROMPT_TIMEOUT,
      });

      // Set timeout to auto-start or cancel
      pendingPrompt.timer = setTimeout(() => {
        resolveJoinPrompt(partyId, io);
      }, JOIN_PROMPT_TIMEOUT);
    } catch (error) {
      console.error('Start Russian Roulette error:', error);
      socket.emit('russianroulette:error', { message: 'Failed to start game' });
    }
  });

  // Respond to join prompt
  socket.on(
    'russianroulette:respond-join',
    async (data: { partyId: string; userId: string; accepted: boolean }) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;
      const { partyId, accepted } = data;

      try {
        const prompt = pendingJoinPrompts.get(partyId);
        if (!prompt) {
          socket.emit('russianroulette:error', { message: 'No join prompt found' });
          return;
        }

        if (!prompt.memberIds.includes(userId)) {
          socket.emit('russianroulette:error', { message: 'You are not in this party' });
          return;
        }

        prompt.responses.set(userId, accepted);

        // Check if all responded
        if (prompt.responses.size === prompt.memberIds.length) {
          if (prompt.timer) {
            clearTimeout(prompt.timer);
          }
          resolveJoinPrompt(partyId, io);
        }
      } catch (error) {
        console.error('Respond join error:', error);
        socket.emit('russianroulette:error', { message: 'Failed to respond' });
      }
    }
  );

  // Pull trigger (player's turn)
  socket.on('russianroulette:pull-trigger', async (data: { partyId: string; userId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;

    try {
      const game = activeGames.get(partyId);
      if (!game) {
        socket.emit('russianroulette:error', { message: 'No active game found' });
        return;
      }

      if (!game.isActive) {
        socket.emit('russianroulette:error', { message: 'Game is not active' });
        return;
      }

      const currentPlayer = game.players[game.currentPlayerIndex];
      if (!currentPlayer || currentPlayer.userId !== userId) {
        socket.emit('russianroulette:error', { message: 'Not your turn' });
        return;
      }

      if (!currentPlayer.isAlive) {
        socket.emit('russianroulette:error', { message: 'You are already eliminated' });
        return;
      }

      // Check if bullet fires (1/6 chance)
      const fired = game.chamberPosition === game.bulletPosition;

      if (fired) {
        // Player is eliminated
        currentPlayer.isAlive = false;
        currentPlayer.isEliminated = true;

        // Check if game is over (only one player left)
        const alivePlayers = game.players.filter((p) => p.isAlive);
        if (alivePlayers.length === 1) {
          // Game over - winner is the last alive
          const winner = alivePlayers[0];
          winner.roundsSurvived = game.round;

          await endGame(game, io, winner.userId);
          return;
        }

        // Move to next alive player
        do {
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        } while (!game.players[game.currentPlayerIndex].isAlive);

        // Reset chamber position for next round
        game.chamberPosition = 0;
        game.bulletPosition = Math.floor(Math.random() * 6); // New random bullet position
        game.round++;
      } else {
        // Player survives
        currentPlayer.roundsSurvived++;
        game.chamberPosition = (game.chamberPosition + 1) % 6;

        // Move to next alive player
        do {
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        } while (!game.players[game.currentPlayerIndex].isAlive);
      }

      // Broadcast updated state
      io.to(`party:${partyId}`).emit('russianroulette:state', {
        players: game.players.map((p) => ({
          userId: p.userId,
          username: p.username,
          usernameColor: p.usernameColor,
          isAlive: p.isAlive,
          roundsSurvived: p.roundsSurvived,
          isEliminated: p.isEliminated,
        })),
        currentPlayerIndex: game.currentPlayerIndex,
        round: game.round,
        isActive: game.isActive,
        lastShot: {
          playerId: currentPlayer.userId,
          playerUsername: currentPlayer.username,
          fired,
        },
      });
    } catch (error) {
      console.error('Pull trigger error:', error);
      socket.emit('russianroulette:error', { message: 'Failed to pull trigger' });
    }
  });

  // Leave game
  socket.on('russianroulette:leave', async (data: { partyId: string; userId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;

    try {
      const game = activeGames.get(partyId);
      if (!game) {
        return;
      }

      const player = game.players.find((p) => p.userId === userId);
      if (!player) {
        return;
      }

      // Mark player as eliminated
      player.isAlive = false;
      player.isEliminated = true;

      // Check if game should end
      const alivePlayers = game.players.filter((p) => p.isAlive);
      if (alivePlayers.length <= 1) {
        if (alivePlayers.length === 1) {
          const winner = alivePlayers[0];
          winner.roundsSurvived = game.round;
          await endGame(game, io, winner.userId);
        } else {
          // No winner - all left
          game.isActive = false;
          activeGames.delete(partyId);
          io.to(`party:${partyId}`).emit('russianroulette:game-cancelled');
        }
        return;
      }

      // Move to next alive player if current player left
      if (game.players[game.currentPlayerIndex].userId === userId) {
        do {
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        } while (!game.players[game.currentPlayerIndex].isAlive);
      }

      // Broadcast updated state
      io.to(`party:${partyId}`).emit('russianroulette:state', {
        players: game.players.map((p) => ({
          userId: p.userId,
          username: p.username,
          usernameColor: p.usernameColor,
          isAlive: p.isAlive,
          roundsSurvived: p.roundsSurvived,
          isEliminated: p.isEliminated,
        })),
        currentPlayerIndex: game.currentPlayerIndex,
        round: game.round,
        isActive: game.isActive,
      });
    } catch (error) {
      console.error('Leave game error:', error);
    }
  });

  // Respond to play again prompt
  socket.on(
    'russianroulette:respond-play-again',
    async (data: { partyId: string; userId: string; playAgain: boolean }) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;
      const { partyId, playAgain } = data;

      try {
        const prompt = pendingPlayAgainPrompts.get(partyId);
        if (!prompt) {
          return;
        }
        if (!prompt.players.find((p) => p.userId === userId)) {
          return;
        }

        prompt.responses.set(userId, playAgain);

        const responses = Array.from(prompt.responses.entries()).map(([uid, pa]) => ({
          userId: uid,
          playAgain: pa,
        }));
        const playAgainCount = responses.filter((r) => r.playAgain).length;
        const leaveCount = responses.filter((r) => !r.playAgain).length;

        io.to(`party:${partyId}`).emit('russianroulette:play-again-response-update', {
          partyId,
          responses,
          playAgainCount,
          leaveCount,
        });

        // Check if all responded
        if (prompt.responses.size === prompt.players.length) {
          if (prompt.timer) {
            clearTimeout(prompt.timer);
          }
          resolvePlayAgainPrompt(partyId, io);
        }
      } catch (error) {
        console.error('Respond play again error:', error);
      }
    }
  );
};

const startRussianRouletteGame = (
  partyId: string,
  users: Array<{ id: string; username: string; usernameColor?: string | null }>,
  io: Server
) => {
  const shuffledPlayers = [...users];
  for (let i = shuffledPlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
  }

  const game: RussianRouletteGame = {
    partyId,
    players: shuffledPlayers.map((p) => ({
      userId: p.id,
      username: p.username,
      usernameColor: p.usernameColor,
      isAlive: true,
      roundsSurvived: 0,
      isEliminated: false,
    })),
    currentPlayerIndex: 0,
    round: 1,
    isActive: true,
    chamberPosition: 0,
    bulletPosition: Math.floor(Math.random() * 6),
  };

  activeGames.set(partyId, game);

  io.to(`party:${partyId}`).emit('russianroulette:game-started', {
    players: game.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
      isAlive: p.isAlive,
      roundsSurvived: p.roundsSurvived,
      isEliminated: p.isEliminated,
    })),
    currentPlayerIndex: game.currentPlayerIndex,
    round: game.round,
    isActive: game.isActive,
  });
};

async function resolveJoinPrompt(partyId: string, io: Server) {
  const prompt = pendingJoinPrompts.get(partyId);
  if (!prompt) return;

  pendingJoinPrompts.delete(partyId);

  // Get all accepted players
  const acceptedPlayerIds = Array.from(prompt.responses.entries())
    .filter(([_, accepted]) => accepted)
    .map(([userId]) => userId);

  if (acceptedPlayerIds.length < 2) {
    // Not enough players
    io.to(`party:${partyId}`).emit('russianroulette:join-cancelled', {
      reason: 'Not enough players accepted',
    });
    return;
  }

  // Get player details
  const players = await prisma.user.findMany({
    where: { id: { in: acceptedPlayerIds } },
    select: { id: true, username: true, usernameColor: true },
  });

  startRussianRouletteGame(partyId, players, io);
}

async function endGame(game: RussianRouletteGame, io: Server, winnerId: string) {
  game.isActive = false;

  const winner = game.players.find((p) => p.userId === winnerId);
  if (!winner) {
    activeGames.delete(game.partyId);
    return;
  }

  const totalPlayers = game.players.length;

  // Calculate rewards and update stats
  const playerResults = await Promise.all(
    game.players.map(async (player) => {
      const isWinner = player.userId === winnerId;
      const rewards = calculateRewards(isWinner, player.roundsSurvived, totalPlayers);

      // Get current stats
      const currentStats = await prisma.gameStats.findUnique({
        where: {
          userId_gameType: {
            userId: player.userId,
            gameType: 'russian_roulette',
          },
        },
      });

      const isNewHighScore = !currentStats || player.roundsSurvived > currentStats.highScore;

      // Update game stats
      const stats = await prisma.gameStats.upsert({
        where: {
          userId_gameType: {
            userId: player.userId,
            gameType: 'russian_roulette',
          },
        },
        create: {
          userId: player.userId,
          gameType: 'russian_roulette',
          wins: isWinner ? 1 : 0,
          losses: isWinner ? 0 : 1,
          highScore: player.roundsSurvived, // Use rounds survived as high score
          totalPlayed: 1,
        },
        update: {
          wins: isWinner ? { increment: 1 } : undefined,
          losses: isWinner ? undefined : { increment: 1 },
          highScore: isNewHighScore ? player.roundsSurvived : undefined,
          totalPlayed: { increment: 1 },
        },
      });

      // Update user balance
      await prisma.user.update({
        where: { id: player.userId },
        data: {
          aura: { increment: rewards.aura },
          money: { increment: rewards.money },
        },
      });

      // Log game completion
      const user = await prisma.user.findUnique({
        where: { id: player.userId },
        select: { username: true },
      });

      logGame('game_complete', player.userId, user?.username || 'Unknown', {
        gameType: 'russian_roulette',
        score: player.roundsSurvived,
        won: isWinner,
        roundsSurvived: player.roundsSurvived,
        totalPlayers,
        auraReward: rewards.aura,
        moneyReward: rewards.money,
      });

      // Check quest progress
      await checkQuestProgress(player.userId, 'PLAY_GAMES', 1);
      if (isWinner) {
        await checkQuestProgress(player.userId, 'WIN_GAMES', 1);
      }

      // Emit balance update
      const updatedUser = await prisma.user.findUnique({
        where: { id: player.userId },
        select: { aura: true, money: true },
      });

      if (updatedUser) {
        io.emit('economy:balance-update', {
          userId: player.userId,
          aura: updatedUser.aura,
          money: updatedUser.money,
        });
      }

      return {
        userId: player.userId,
        username: player.username,
        roundsSurvived: player.roundsSurvived,
        isWinner,
        rewards,
      };
    })
  );

  const gameOverData = {
    winnerId: winner.userId,
    winnerUsername: winner.username,
    players: playerResults,
  };

  // Broadcast game over
  io.to(`party:${game.partyId}`).emit('russianroulette:game-over', gameOverData);

  // Create play again prompt
  const prompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
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

  pendingPlayAgainPrompts.set(game.partyId, prompt);

  // Send play again prompt to all players
  io.to(`party:${game.partyId}`).emit('russianroulette:play-again-prompt', {
    partyId: game.partyId,
    timeLimit: PLAY_AGAIN_PROMPT_TIMEOUT,
    startTime: Date.now(),
    players: prompt.players,
    responses: [],
  });

  // Set timeout
  prompt.timer = setTimeout(() => {
    resolvePlayAgainPrompt(game.partyId, io);
  }, PLAY_AGAIN_PROMPT_TIMEOUT);

  activeGames.delete(game.partyId);
}

async function resolvePlayAgainPrompt(partyId: string, io: Server) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;

  if (prompt.timer) {
    clearTimeout(prompt.timer);
  }
  pendingPlayAgainPrompts.delete(partyId);

  const playAgainPlayerIds = Array.from(prompt.responses.entries())
    .filter(([_, playAgain]) => playAgain)
    .map(([userId]) => userId);

  if (playAgainPlayerIds.length < 2) {
    io.to(`party:${partyId}`).emit('russianroulette:play-again-cancelled', {
      reason: 'Not enough players want to play again (need at least 2)',
    });
    return;
  }

  const partyMembers = await prisma.partyMember.findMany({
    where: {
      partyId,
      userId: { in: playAgainPlayerIds },
    },
    include: {
      user: {
        select: { id: true, username: true, usernameColor: true },
      },
    },
  });

  if (partyMembers.length < 2) {
    io.to(`party:${partyId}`).emit('russianroulette:play-again-cancelled', {
      reason: 'Not enough players in party to play again',
    });
    return;
  }

  startRussianRouletteGame(
    partyId,
    partyMembers.map((m) => ({
      id: m.user.id,
      username: m.user.username,
      usernameColor: m.user.usernameColor,
    })),
    io,
  );
}

// Cleanup inactive games periodically
export const startRussianRouletteCleanup = (io: Server) => {
  setInterval(() => {
    const now = Date.now();
    for (const [partyId, game] of activeGames.entries()) {
      // Games should be cleaned up when they end, but this is a safety net
      if (!game.isActive) {
        activeGames.delete(partyId);
      }
    }
  }, 60000); // Run every minute
};
