import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BombPartyPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  lives: number;
  wordsUsed: string[];
  isEliminated: boolean;
  wordsTypedCount: number;
}

interface BombPartyGame {
  partyId: string;
  players: BombPartyPlayer[];
  currentPlayerIndex: number;
  currentPrompt: string;
  currentInput: string;
  difficulty: 'easy' | 'medium' | 'hard';
  turnStartTime: number;
  turnDuration: number;
  usedWords: Set<string>;
  round: number;
  isActive: boolean;
  turnTimer: NodeJS.Timeout | null;
  maxLives: number;
  roundsWithoutLifeLoss: number; // Track consecutive rounds without losing a life
}

// Store active games by partyId
const activeGames = new Map<string, BombPartyGame>();

// Dictionary loaded once
let dictionary: Set<string> | null = null;

// Load dictionary
function loadDictionary(): Set<string> {
  if (dictionary) return dictionary;

  try {
    const dictionaryPath = path.join(__dirname, '../../data/dictionary.txt');
    const content = fs.readFileSync(dictionaryPath, 'utf-8');
    dictionary = new Set(
      content
        .split('\n')
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length >= 2)
    );
    console.log(`Loaded dictionary with ${dictionary.size} words`);
    return dictionary;
  } catch (error) {
    console.error('Failed to load dictionary:', error);
    return new Set();
  }
}

// Get random prompt from database
async function getRandomPrompt(difficulty: 'easy' | 'medium' | 'hard'): Promise<string> {
  const prompts = await prisma.bombPartyPrompt.findMany({
    where: { difficulty },
    select: { prompt: true },
  });

  if (prompts.length === 0) {
    // Fallback prompts if DB is empty
    const fallbacks = ['TH', 'IN', 'ER', 'AN', 'RE', 'ON', 'AT', 'EN', 'ND', 'TI'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  return prompts[Math.floor(Math.random() * prompts.length)].prompt;
}

// Calculate turn duration based on rounds without life loss (gets faster when no one loses lives)
function getTurnDuration(roundsWithoutLifeLoss: number): number {
  const baseDuration = 10000; // 10 seconds
  const minDuration = 3000; // 3 seconds minimum
  // Every 3 rounds without a life loss, reduce by 500ms
  const reduction = Math.min(Math.floor(roundsWithoutLifeLoss / 3) * 500, baseDuration - minDuration);
  return baseDuration - reduction;
}

// Get next non-eliminated player index
function getNextPlayerIndex(game: BombPartyGame): number {
  let nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
  let attempts = 0;

  while (game.players[nextIndex].isEliminated && attempts < game.players.length) {
    nextIndex = (nextIndex + 1) % game.players.length;
    attempts++;
  }

  return nextIndex;
}

// Count alive players
function countAlivePlayers(game: BombPartyGame): number {
  return game.players.filter(p => !p.isEliminated).length;
}

// Get winner (last alive player)
function getWinner(game: BombPartyGame): BombPartyPlayer | null {
  const alive = game.players.filter(p => !p.isEliminated);
  return alive.length === 1 ? alive[0] : null;
}

// Serialize game state for client
function serializeGameState(game: BombPartyGame) {
  return {
    partyId: game.partyId,
    players: game.players.map(p => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
      lives: p.lives,
      isEliminated: p.isEliminated,
      wordsTypedCount: p.wordsTypedCount,
    })),
    currentPlayerIndex: game.currentPlayerIndex,
    currentPlayerId: game.players[game.currentPlayerIndex].userId,
    currentPrompt: game.currentPrompt,
    currentInput: game.currentInput,
    difficulty: game.difficulty,
    turnDuration: game.turnDuration,
    turnStartTime: game.turnStartTime,
    round: game.round,
    usedWords: Array.from(game.usedWords).slice(-20), // Last 20 words
  };
}

export const setupBombPartyHandlers = (socket: Socket, io: Server) => {
  // Start game
  socket.on('bombparty:start', async (data: {
    userId: string;
    partyId: string;
    lives: number;
    difficulty: 'easy' | 'medium' | 'hard';
  }) => {
    const { userId, partyId, lives, difficulty } = data;

    try {
      // Validate lives (2-5)
      const validLives = Math.max(2, Math.min(5, lives));

      // Check if user is party leader
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: { party: true },
      });

      if (!membership || membership.partyId !== partyId) {
        socket.emit('bombparty:error', { message: 'You are not in this party' });
        return;
      }

      if (!membership.isLeader) {
        socket.emit('bombparty:error', { message: 'Only the party leader can start the game' });
        return;
      }

      // Check if game already active
      if (activeGames.has(partyId)) {
        socket.emit('bombparty:error', { message: 'A game is already in progress' });
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
        socket.emit('bombparty:error', { message: 'Need at least 2 players to start' });
        return;
      }

      // Load dictionary
      loadDictionary();

      // Get initial prompt
      const prompt = await getRandomPrompt(difficulty);

      // Create game state
      const game: BombPartyGame = {
        partyId,
        players: partyMembers.map(m => ({
          userId: m.user.id,
          username: m.user.username,
          usernameColor: m.user.usernameColor,
          lives: validLives,
          wordsUsed: [],
          isEliminated: false,
          wordsTypedCount: 0,
        })),
        currentPlayerIndex: 0,
        currentPrompt: prompt,
        currentInput: '',
        difficulty,
        turnStartTime: Date.now(),
        turnDuration: getTurnDuration(0),
        usedWords: new Set(),
        round: 0,
        isActive: true,
        turnTimer: null,
        maxLives: validLives,
        roundsWithoutLifeLoss: 0,
      };

      // Shuffle player order
      for (let i = game.players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [game.players[i], game.players[j]] = [game.players[j], game.players[i]];
      }

      activeGames.set(partyId, game);

      // Start turn timer
      startTurnTimer(game, io);

      // Emit game started to party room
      io.to(`party:${partyId}`).emit('bombparty:started', serializeGameState(game));
    } catch (error) {
      console.error('Start bomb party error:', error);
      socket.emit('bombparty:error', { message: 'Failed to start game' });
    }
  });

  // Player typing (real-time sync)
  socket.on('bombparty:type', (data: {
    partyId: string;
    userId: string;
    input: string;
  }) => {
    const { partyId, userId, input } = data;
    const game = activeGames.get(partyId);

    if (!game || !game.isActive) return;

    // Only current player can type
    if (game.players[game.currentPlayerIndex].userId !== userId) return;

    game.currentInput = input.toUpperCase();

    // Broadcast to all players
    io.to(`party:${partyId}`).emit('bombparty:typing', {
      input: game.currentInput,
      userId,
    });
  });

  // Player submits word
  socket.on('bombparty:submit', async (data: {
    partyId: string;
    userId: string;
    word: string;
  }) => {
    const { partyId, userId, word } = data;
    const game = activeGames.get(partyId);

    if (!game || !game.isActive) return;

    // Only current player can submit
    if (game.players[game.currentPlayerIndex].userId !== userId) {
      socket.emit('bombparty:word-rejected', { reason: 'Not your turn' });
      return;
    }

    const upperWord = word.toUpperCase().trim();
    const dict = loadDictionary();

    // Validate word
    if (!upperWord.includes(game.currentPrompt)) {
      socket.emit('bombparty:word-rejected', {
        reason: `Word must contain "${game.currentPrompt}"`,
      });
      return;
    }

    if (!dict.has(upperWord)) {
      socket.emit('bombparty:word-rejected', { reason: 'Not a valid word' });
      return;
    }

    if (game.usedWords.has(upperWord)) {
      socket.emit('bombparty:word-rejected', { reason: 'Word already used' });
      return;
    }

    // Word accepted!
    clearTurnTimer(game);

    const currentPlayer = game.players[game.currentPlayerIndex];
    currentPlayer.wordsUsed.push(upperWord);
    currentPlayer.wordsTypedCount++;
    game.usedWords.add(upperWord);

    // Get new prompt
    const newPrompt = await getRandomPrompt(game.difficulty);

    // Move to next player
    game.currentPlayerIndex = getNextPlayerIndex(game);
    game.currentPrompt = newPrompt;
    game.currentInput = '';
    game.round++;
    game.roundsWithoutLifeLoss++;
    game.turnDuration = getTurnDuration(game.roundsWithoutLifeLoss);
    game.turnStartTime = Date.now();

    // Start new turn timer
    startTurnTimer(game, io);

    // Emit accepted
    io.to(`party:${partyId}`).emit('bombparty:word-accepted', {
      word: upperWord,
      playerId: userId,
      ...serializeGameState(game),
    });
  });

  // Player leaves game
  socket.on('bombparty:leave', async (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    const game = activeGames.get(partyId);

    if (!game) return;

    // Eliminate the player
    const player = game.players.find(p => p.userId === userId);
    if (player && !player.isEliminated) {
      player.isEliminated = true;
      player.lives = 0;

      io.to(`party:${partyId}`).emit('bombparty:player-eliminated', {
        playerId: userId,
        username: player.username,
        reason: 'left',
      });

      // Check for winner
      if (countAlivePlayers(game) <= 1) {
        await endGame(game, io);
      } else if (game.players[game.currentPlayerIndex].userId === userId) {
        // If it was their turn, move to next player
        clearTurnTimer(game);
        await advanceTurn(game, io, true);
      }
    }
  });

  // Handle disconnect during game
  socket.on('disconnect', () => {
    // Find any games this socket was in and handle appropriately
    // This is handled by party:leave which calls bombparty:leave
  });
};

// Turn timer logic
function startTurnTimer(game: BombPartyGame, io: Server) {
  clearTurnTimer(game);

  game.turnTimer = setTimeout(async () => {
    if (!game.isActive) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    currentPlayer.lives--;

    // Reset the consecutive rounds counter when someone loses a life
    game.roundsWithoutLifeLoss = 0;
    game.turnDuration = getTurnDuration(0); // Reset turn duration

    io.to(`party:${game.partyId}`).emit('bombparty:bomb-exploded', {
      playerId: currentPlayer.userId,
      username: currentPlayer.username,
      livesRemaining: currentPlayer.lives,
    });

    if (currentPlayer.lives <= 0) {
      currentPlayer.isEliminated = true;

      io.to(`party:${game.partyId}`).emit('bombparty:player-eliminated', {
        playerId: currentPlayer.userId,
        username: currentPlayer.username,
        reason: 'timeout',
      });

      // Check for winner
      if (countAlivePlayers(game) <= 1) {
        await endGame(game, io);
        return;
      }
    }

    // Advance to next turn
    await advanceTurn(game, io, false);
  }, game.turnDuration);
}

function clearTurnTimer(game: BombPartyGame) {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
}

async function advanceTurn(game: BombPartyGame, io: Server, skipPromptChange: boolean) {
  game.currentPlayerIndex = getNextPlayerIndex(game);
  game.currentInput = '';
  game.turnStartTime = Date.now();

  if (!skipPromptChange) {
    game.currentPrompt = await getRandomPrompt(game.difficulty);
    game.round++;
    // Don't increment roundsWithoutLifeLoss here - only when word is accepted
  }

  startTurnTimer(game, io);

  io.to(`party:${game.partyId}`).emit('bombparty:turn-changed', serializeGameState(game));
}

async function endGame(game: BombPartyGame, io: Server) {
  clearTurnTimer(game);
  game.isActive = false;

  const winner = getWinner(game);

  // Calculate rewards
  const rewards: { [userId: string]: { aura: number; money: number } } = {};

  for (const player of game.players) {
    if (player.userId === winner?.userId) {
      // Winner: 50 aura + 10 money per word
      rewards[player.userId] = {
        aura: 50,
        money: player.wordsTypedCount * 10,
      };
    } else {
      // Others: 5 money per word
      rewards[player.userId] = {
        aura: 0,
        money: player.wordsTypedCount * 5,
      };
    }

    // Update stats and balance
    try {
      // Update BombPartyStats
      const longestWord = player.wordsUsed.reduce(
        (longest, word) => (word.length > longest.length ? word : longest),
        ''
      );

      await prisma.bombPartyStats.upsert({
        where: { userId: player.userId },
        create: {
          userId: player.userId,
          wins: player.userId === winner?.userId ? 1 : 0,
          losses: player.userId === winner?.userId ? 0 : 1,
          totalPlayed: 1,
          wordsTyped: player.wordsTypedCount,
          longestWord: longestWord || null,
        },
        update: {
          wins: player.userId === winner?.userId ? { increment: 1 } : undefined,
          losses: player.userId !== winner?.userId ? { increment: 1 } : undefined,
          totalPlayed: { increment: 1 },
          wordsTyped: { increment: player.wordsTypedCount },
          longestWord: longestWord.length > 0 ? longestWord : undefined,
        },
      });

      // Update user balance
      const reward = rewards[player.userId];
      if (reward.aura > 0 || reward.money > 0) {
        const updatedUser = await prisma.user.update({
          where: { id: player.userId },
          data: {
            aura: { increment: reward.aura },
            money: { increment: reward.money },
          },
        });

        // Emit balance update
        io.emit('economy:balance-update', {
          userId: player.userId,
          aura: updatedUser.aura,
          money: updatedUser.money,
        });
      }
    } catch (error) {
      console.error('Failed to update stats for player:', player.userId, error);
    }
  }

  // Emit game over
  io.to(`party:${game.partyId}`).emit('bombparty:game-over', {
    winnerId: winner?.userId,
    winnerUsername: winner?.username,
    players: game.players.map(p => ({
      userId: p.userId,
      username: p.username,
      wordsTypedCount: p.wordsTypedCount,
      isWinner: p.userId === winner?.userId,
      rewards: rewards[p.userId],
    })),
  });

  // Remove game
  activeGames.delete(game.partyId);
}

// Export for cleanup if needed
export function cleanupBombPartyGames() {
  for (const [partyId, game] of activeGames) {
    clearTurnTimer(game);
  }
  activeGames.clear();
}
