import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';
import { logGame } from '../utils/logger.js';
import { recheckBadgeForCondition } from '../utils/badgeAwards.js';
import { getActiveClanMoneyBoostPercentsForUsers } from '../utils/clanEffects.js';
import { emitSharedBalanceUpdatesForUserIds } from '../utils/sharedBalance.js';
import { applyDailyGameRewardCaps } from '../utils/dailyGameRewards.js';
import { readBombPartyDictionaryWords, resolveBombPartyLanguageFile } from '../utils/bombpartyDictionary.js';
import { getBombPartyLanguageSetting, getBombPartyThreeLetterStartRound, getBombPartyWppSettings } from '../utils/bombpartySettings.js';

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

function extractSubmittedWordCandidates(input: string): string[] {
  return input
    .toUpperCase()
    .trim()
    .split(/[\s.]+/)
    .filter((candidate) => candidate.length >= 2);
}

// Store active games by partyId
const activeGames = new Map<string, BombPartyGame>();

// Store pending join prompts by partyId
interface PendingJoinPrompt {
  partyId: string;
  leaderId: string;
  lives: number;
  difficulty: 'easy' | 'medium' | 'hard';
  responses: Map<string, boolean>; // userId -> accepted
  memberIds: string[];
  timer: NodeJS.Timeout | null;
  startTime: number;
}
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();

interface PendingPlayAgainPrompt {
  partyId: string;
  lives: number;
  difficulty: 'easy' | 'medium' | 'hard';
  responses: Map<string, boolean>; // userId -> playAgain
  playerIds: string[];
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
      wordsTypedCount: number;
      isWinner: boolean;
      rewards: { aura: number; money: number };
    }>;
  };
  timer: NodeJS.Timeout | null;
  startTime: number;
}
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();

// Dictionary loaded once
let dictionary: Set<string> | null = null;
let dictionaryLanguageFile: string | null = null;
let dictionaryLoadPromise: Promise<Set<string>> | null = null;

// Cache for WPP settings
let cachedWppSettings: { easy: number; medium: number; hard: number } | null = null;
const PLAY_AGAIN_PROMPT_MS = 10000;

async function getBombPartyLanguageFile(): Promise<string> {
  if (dictionaryLanguageFile) return dictionaryLanguageFile;
  const setting = await getBombPartyLanguageSetting(prisma);
  const resolved = resolveBombPartyLanguageFile(setting);
  dictionaryLanguageFile = resolved;
  return resolved;
}

// Load dictionary
async function loadDictionary(): Promise<Set<string>> {
  const languageFile = await getBombPartyLanguageFile();
  if (dictionary && dictionaryLanguageFile === languageFile) return dictionary;

  if (dictionaryLoadPromise) return dictionaryLoadPromise;

  dictionaryLoadPromise = (async () => {
    try {
      const words = readBombPartyDictionaryWords(languageFile);
      dictionary = new Set(words);
      dictionaryLanguageFile = languageFile;
      console.log(`Loaded dictionary (${languageFile}) with ${dictionary.size} words`);
      return dictionary;
    } catch (error) {
      console.error('Failed to load dictionary:', error);
      dictionary = new Set();
      return dictionary;
    } finally {
      dictionaryLoadPromise = null;
    }
  })();

  return dictionaryLoadPromise;
}

// Cache for 3-letter start round setting
let threeLetterStartRound: number | null = null;

// Get setting for when 3-letter prompts should start
async function getThreeLetterStartRound(): Promise<number> {
  if (threeLetterStartRound !== null) return threeLetterStartRound;
  threeLetterStartRound = await getBombPartyThreeLetterStartRound(prisma);
  return threeLetterStartRound;
}

async function getWppSettings(): Promise<{ easy: number; medium: number; hard: number }> {
  if (cachedWppSettings) return cachedWppSettings;
  cachedWppSettings = await getBombPartyWppSettings(prisma);
  return cachedWppSettings;
}

// Clear cached setting (call this when settings are updated)
export function clearBombPartySettingsCache() {
  threeLetterStartRound = null;
  cachedWppSettings = null;
  dictionary = null;
  dictionaryLanguageFile = null;
  dictionaryLoadPromise = null;
}

// Get random prompt from database based on difficulty and round
async function getRandomPrompt(difficulty: 'easy' | 'medium' | 'hard', round: number = 0): Promise<string> {
  const startRound = await getThreeLetterStartRound();
  const wpp = await getWppSettings();

  // Determine which prompt lengths to include based on round
  // Before startRound: only 2-letter prompts
  // After startRound: mix of 2-letter and 3-letter (increasing 3-letter probability)
  let lengths: number[];
  if (round < startRound) {
    lengths = [2];
  } else {
    // Gradually increase 3-letter probability
    // At startRound: 20% chance of 3-letter
    // Every 5 rounds after: increase by 10% (max 80%)
    const roundsAfterStart = round - startRound;
    const threeLetterChance = Math.min(0.2 + Math.floor(roundsAfterStart / 5) * 0.1, 0.8);
    lengths = Math.random() < threeLetterChance ? [3] : [2];
  }

  const wordCountFilter =
    difficulty === 'easy'
      ? { gte: wpp.easy }
      : difficulty === 'medium'
        ? { gte: wpp.medium, lt: wpp.easy }
        : { gte: wpp.hard, lt: wpp.medium };

  const prompts = await prisma.bombPartyPrompt.findMany({
    where: {
      length: { in: lengths },
      wordCount: wordCountFilter,
    },
    select: { prompt: true },
  });

  if (prompts.length === 0) {
    // Fallback: try any length with this difficulty
    const fallbackPrompts = await prisma.bombPartyPrompt.findMany({
      where: { wordCount: wordCountFilter },
      select: { prompt: true },
    });

    if (fallbackPrompts.length > 0) {
      return fallbackPrompts[Math.floor(Math.random() * fallbackPrompts.length)].prompt;
    }

    // Ultimate fallback prompts if DB is empty
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
    maxLives: game.maxLives,
  };
}

export const setupBombPartyHandlers = (socket: Socket, io: Server) => {
  // Start game (initiates join prompt for all party members)
  socket.on('bombparty:start', async (data: {
    userId: string;
    partyId: string;
    lives: number;
    difficulty: 'easy' | 'medium' | 'hard';
  }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, lives, difficulty } = data;

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

      // Check if game already active or join prompt pending
      if (activeGames.has(partyId)) {
        socket.emit('bombparty:error', { message: 'A game is already in progress' });
        return;
      }

      if (pendingJoinPrompts.has(partyId)) {
        socket.emit('bombparty:error', { message: 'A game is already being started' });
        return;
      }

      if (pendingPlayAgainPrompts.has(partyId)) {
        socket.emit('bombparty:error', { message: 'A replay vote is already in progress' });
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

      // Create pending join prompt
      const memberIds = partyMembers.map(m => m.user.id);
      const pendingPrompt: PendingJoinPrompt = {
        partyId,
        leaderId: userId,
        lives: validLives,
        difficulty,
        responses: new Map(),
        memberIds,
        timer: null,
        startTime: Date.now(),
      };

      // Leader auto-accepts
      pendingPrompt.responses.set(userId, true);

      pendingJoinPrompts.set(partyId, pendingPrompt);

      // Set 10-second timer
      pendingPrompt.timer = setTimeout(() => {
        resolveJoinPrompt(partyId, io);
      }, 10000);

      // Emit join prompt to all party members (include leader's auto-accept in initial responses)
      io.to(`party:${partyId}`).emit('bombparty:join-prompt', {
        partyId,
        leaderId: userId,
        lives: validLives,
        difficulty,
        timeLimit: 10000,
        members: partyMembers.map(m => ({
          userId: m.user.id,
          username: m.user.username,
          usernameColor: m.user.usernameColor,
        })),
        responses: [{ userId, accepted: true }], // Leader auto-accepts
      });
    } catch (error) {
      console.error('Start bomb party error:', error);
      socket.emit('bombparty:error', { message: 'Failed to start game' });
    }
  });

  // Handle join prompt response
  socket.on('bombparty:join-response', async (data: {
    partyId: string;
    userId: string;
    accepted: boolean;
  }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, accepted } = data;
    const pendingPrompt = pendingJoinPrompts.get(partyId);

    if (!pendingPrompt) {
      return;
    }

    // Check if user is part of this prompt
    if (!pendingPrompt.memberIds.includes(userId)) {
      return;
    }

    // Record response
    pendingPrompt.responses.set(userId, accepted);

    // Broadcast response to party
    io.to(`party:${partyId}`).emit('bombparty:join-response-update', {
      partyId,
      userId,
      accepted,
      responses: Array.from(pendingPrompt.responses.entries()).map(([id, acc]) => ({
        userId: id,
        accepted: acc,
      })),
    });

    // Check if all responses received
    if (pendingPrompt.responses.size === pendingPrompt.memberIds.length) {
      // Clear timer and resolve immediately
      if (pendingPrompt.timer) {
        clearTimeout(pendingPrompt.timer);
        pendingPrompt.timer = null;
      }
      resolveJoinPrompt(partyId, io);
    }
  });

  // Player typing (real-time sync)
  socket.on('bombparty:type', (data: {
    partyId: string;
    userId: string;
    input: string;
  }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, input } = data;
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
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, word } = data;
    const game = activeGames.get(partyId);

    if (!game || !game.isActive) return;

    // Only current player can submit
    if (game.players[game.currentPlayerIndex].userId !== userId) {
      socket.emit('bombparty:word-rejected', { reason: 'Not your turn' });
      return;
    }

    const candidates = extractSubmittedWordCandidates(word);
    const dict = await loadDictionary();

    if (candidates.length === 0) {
      socket.emit('bombparty:word-rejected', { reason: 'Type a word' });
      return;
    }

    const promptCandidates = candidates.filter((candidate) => candidate.includes(game.currentPrompt));
    if (promptCandidates.length === 0) {
      socket.emit('bombparty:word-rejected', {
        reason: `Word must contain "${game.currentPrompt}"`,
      });
      return;
    }

    const validCandidates = promptCandidates.filter((candidate) => dict.has(candidate));
    if (validCandidates.length === 0) {
      socket.emit('bombparty:word-rejected', { reason: 'Not a valid word' });
      return;
    }

    const acceptedWord = validCandidates.find((candidate) => !game.usedWords.has(candidate));
    if (!acceptedWord) {
      socket.emit('bombparty:word-rejected', { reason: 'Word already used' });
      return;
    }

    // Word accepted!
    clearTurnTimer(game);

    const currentPlayer = game.players[game.currentPlayerIndex];
    currentPlayer.wordsUsed.push(acceptedWord);
    currentPlayer.wordsTypedCount++;
    game.usedWords.add(acceptedWord);

    // Move to next player and increment round first so we use the new round for prompt selection
    game.currentPlayerIndex = getNextPlayerIndex(game);
    game.round++;

    // Get new prompt (3-letter prompts may appear based on current round)
    const newPrompt = await getRandomPrompt(game.difficulty, game.round);
    game.currentPrompt = newPrompt;
    game.currentInput = '';
    game.roundsWithoutLifeLoss++;
    game.turnDuration = getTurnDuration(game.roundsWithoutLifeLoss);
    game.turnStartTime = Date.now();

    // Start new turn timer
    startTurnTimer(game, io);

    // Emit accepted
    io.to(`party:${partyId}`).emit('bombparty:word-accepted', {
      word: acceptedWord,
      playerId: userId,
      ...serializeGameState(game),
    });
  });

  // Player leaves game
  socket.on('bombparty:leave', async (data: { partyId: string; userId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;
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

  socket.on('bombparty:play-again-response', (data: {
    partyId: string;
    userId: string;
    playAgain: boolean;
  }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, playAgain } = data;
    const prompt = pendingPlayAgainPrompts.get(partyId);
    if (!prompt) return;

    if (!prompt.playerIds.includes(userId)) return;

    prompt.responses.set(userId, playAgain);

    const responses = Array.from(prompt.responses.entries()).map(([id, value]) => ({
      userId: id,
      playAgain: value,
    }));
    const playAgainCount = responses.filter((r) => r.playAgain).length;
    const leaveCount = responses.filter((r) => !r.playAgain).length;

    io.to(`party:${partyId}`).emit('bombparty:play-again-response-update', {
      partyId,
      responses,
      playAgainCount,
      leaveCount,
    });

    if (prompt.responses.size === prompt.playerIds.length) {
      if (prompt.timer) {
        clearTimeout(prompt.timer);
        prompt.timer = null;
      }
      resolvePlayAgainPrompt(partyId, io);
    }
  });

  // Handle disconnect during game
  socket.once('disconnect', () => {
    // Find any games this socket was in and handle appropriately
    // This is handled by party:leave which calls bombparty:leave
  });
};

// Resolve join prompt and start game if enough players accepted
async function resolveJoinPrompt(partyId: string, io: Server) {
  const pendingPrompt = pendingJoinPrompts.get(partyId);
  if (!pendingPrompt) return;

  // Clear timer if still running
  if (pendingPrompt.timer) {
    clearTimeout(pendingPrompt.timer);
    pendingPrompt.timer = null;
  }

  // Count accepted players
  const acceptedUserIds = Array.from(pendingPrompt.responses.entries())
    .filter(([_, accepted]) => accepted)
    .map(([userId]) => userId);

  // Remove pending prompt
  pendingJoinPrompts.delete(partyId);

  // Need at least 2 players to start
  if (acceptedUserIds.length < 2) {
    io.to(`party:${partyId}`).emit('bombparty:join-cancelled', {
      reason: 'Not enough players accepted (need at least 2)',
    });
    return;
  }

  // Get accepted party members
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
  });

  // Load dictionary
  await loadDictionary();

  // Get initial prompt
  const prompt = await getRandomPrompt(pendingPrompt.difficulty);

  // Create game state with only accepted players
  const game: BombPartyGame = {
    partyId,
    players: partyMembers.map(m => ({
      userId: m.user.id,
      username: m.user.username,
      usernameColor: m.user.usernameColor,
      lives: pendingPrompt.lives,
      wordsUsed: [],
      isEliminated: false,
      wordsTypedCount: 0,
    })),
    currentPlayerIndex: 0,
    currentPrompt: prompt,
    currentInput: '',
    difficulty: pendingPrompt.difficulty,
    turnStartTime: Date.now(),
    turnDuration: getTurnDuration(0),
    usedWords: new Set(),
    round: 0,
    isActive: true,
    turnTimer: null,
    maxLives: pendingPrompt.lives,
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
}

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
    game.currentPrompt = await getRandomPrompt(game.difficulty, game.round);
    // Don't increment roundsWithoutLifeLoss here - only when word is accepted
  }

  startTurnTimer(game, io);

  io.to(`party:${game.partyId}`).emit('bombparty:turn-changed', serializeGameState(game));
}

async function resolvePlayAgainPrompt(partyId: string, io: Server) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;

  if (prompt.timer) {
    clearTimeout(prompt.timer);
    prompt.timer = null;
  }

  pendingPlayAgainPrompts.delete(partyId);

  const replayUserIds = Array.from(prompt.responses.entries())
    .filter(([, playAgain]) => playAgain)
    .map(([userId]) => userId);

  if (replayUserIds.length < 2) {
    io.to(`party:${partyId}`).emit('bombparty:play-again-cancelled', {
      reason: 'Not enough players chose replay (need at least 2)',
    });
    return;
  }

  if (activeGames.has(partyId) || pendingJoinPrompts.has(partyId)) {
    io.to(`party:${partyId}`).emit('bombparty:play-again-cancelled', {
      reason: 'Cannot start replay right now',
    });
    return;
  }

  const partyMembers = await prisma.partyMember.findMany({
    where: {
      partyId,
      userId: { in: replayUserIds },
    },
    include: {
      user: {
        select: { id: true, username: true, usernameColor: true },
      },
    },
  });

  if (partyMembers.length < 2) {
    io.to(`party:${partyId}`).emit('bombparty:play-again-cancelled', {
      reason: 'Not enough replay players are still in the party',
    });
    return;
  }

  await loadDictionary();
  const promptText = await getRandomPrompt(prompt.difficulty);

  const game: BombPartyGame = {
    partyId,
    players: partyMembers.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
      usernameColor: m.user.usernameColor,
      lives: prompt.lives,
      wordsUsed: [],
      isEliminated: false,
      wordsTypedCount: 0,
    })),
    currentPlayerIndex: 0,
    currentPrompt: promptText,
    currentInput: '',
    difficulty: prompt.difficulty,
    turnStartTime: Date.now(),
    turnDuration: getTurnDuration(0),
    usedWords: new Set(),
    round: 0,
    isActive: true,
    turnTimer: null,
    maxLives: prompt.lives,
    roundsWithoutLifeLoss: 0,
  };

  for (let i = game.players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [game.players[i], game.players[j]] = [game.players[j], game.players[i]];
  }

  activeGames.set(partyId, game);
  startTurnTimer(game, io);
  io.to(`party:${partyId}`).emit('bombparty:started', serializeGameState(game));
}

async function endGame(game: BombPartyGame, io: Server) {
  clearTurnTimer(game);
  game.isActive = false;

  const winner = getWinner(game);

  // Calculate multipliers based on game settings
  // Lives multiplier: more hearts = longer game = more rewards
  // 2 hearts = 1x, 3 hearts = 1.3x, 4 hearts = 1.6x, 5 hearts = 2x
  const livesMultiplier = 0.7 + (game.maxLives * 0.3);
  
  // Player count multiplier: more players = more competitive = more rewards
  // 2 players = 1x, 3 players = 1.2x, 4 players = 1.4x, 5+ players = 1.6x
  const playerCount = game.players.length;
  const playerCountMultiplier = Math.min(1 + (playerCount - 2) * 0.2, 1.6);
  
  // Combined multiplier
  const totalMultiplier = livesMultiplier * playerCountMultiplier;
  const boostPercents = await getActiveClanMoneyBoostPercentsForUsers(game.players.map((player) => player.userId));
  const resolveMoneyReward = (userId: string, base: number) => base + Math.floor(base * ((boostPercents.get(userId) ?? 0) / 100));

  // Calculate rewards
  const rewards: { [userId: string]: { aura: number; money: number } } = {};

  for (const player of game.players) {
    if (player.userId === winner?.userId) {
      // Winner: base rewards scaled by multipliers
      // Base: 50 aura + 10 money per word
      const baseAura = 50;
      const baseMoneyPerWord = 10;
      
      rewards[player.userId] = {
        aura: Math.floor(baseAura * totalMultiplier),
        money: resolveMoneyReward(player.userId, Math.floor(player.wordsTypedCount * baseMoneyPerWord * totalMultiplier)),
      };
    } else {
      // Others: base rewards scaled by multipliers
      // Base: 0 aura + 5 money per word
      const baseMoneyPerWord = 5;
      
      rewards[player.userId] = {
        aura: 0,
        money: resolveMoneyReward(player.userId, Math.floor(player.wordsTypedCount * baseMoneyPerWord * totalMultiplier)),
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
      const reward = rewards[player.userId] ?? { aura: 0, money: 0 };
      const cappedReward = await applyDailyGameRewardCaps(prisma, player.userId, 'bombparty', reward);
      const resolvedReward = {
        aura: cappedReward?.appliedAura ?? 0,
        money: cappedReward?.appliedMoney ?? 0,
      };
      rewards[player.userId] = resolvedReward;

      // Check quest progress
      await checkQuestProgress(player.userId, 'BOMB_PARTY_PLAYS', 1);
      await checkQuestProgress(player.userId, 'PLAY_GAMES', 1);
      if (player.userId === winner?.userId) {
        await checkQuestProgress(player.userId, 'WIN_GAMES', 1);
      }
    } catch (error) {
      console.error('Failed to update stats for player:', player.userId, error);
    }
  }

  await emitSharedBalanceUpdatesForUserIds(
    prisma,
    Object.entries(rewards)
      .filter(([, reward]) => reward.aura > 0 || reward.money > 0)
      .map(([userId]) => userId)
  );

  // Recalculate BombParty champion badge immediately (non-blocking)
  if (winner) {
    void recheckBadgeForCondition('BOMBPARTY_TOP_WINS');
  }

  // Build game over data
  const gameOverData = {
    winnerId: winner?.userId ?? null,
    winnerUsername: winner?.username ?? null,
    players: game.players.map(p => ({
      userId: p.userId,
      username: p.username,
      wordsTypedCount: p.wordsTypedCount,
      isWinner: p.userId === winner?.userId,
      rewards: rewards[p.userId],
    })),
  };

  for (const player of game.players) {
    const reward = rewards[player.userId] || { aura: 0, money: 0 };
    logGame('game_complete', player.userId, player.username, {
      gameType: 'bombparty',
      score: player.wordsTypedCount,
      won: player.userId === winner?.userId,
      auraReward: reward.aura,
      moneyReward: reward.money,
      isMultiplayer: true,
      partyId: game.partyId,
      totalPlayers: game.players.length,
      winnerId: winner?.userId ?? null,
      winnerUsername: winner?.username ?? null,
    });
  }

  // Remove game from active games
  activeGames.delete(game.partyId);

  io.to(`party:${game.partyId}`).emit('bombparty:game-over', gameOverData);

  const replayPrompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    lives: game.maxLives,
    difficulty: game.difficulty,
    responses: new Map(),
    playerIds: game.players.map((p) => p.userId),
    players: game.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
    })),
    gameOverData,
    timer: null,
    startTime: Date.now(),
  };

  const existingPrompt = pendingPlayAgainPrompts.get(game.partyId);
  if (existingPrompt?.timer) {
    clearTimeout(existingPrompt.timer);
  }
  pendingPlayAgainPrompts.set(game.partyId, replayPrompt);

  replayPrompt.timer = setTimeout(() => {
    resolvePlayAgainPrompt(game.partyId, io);
  }, PLAY_AGAIN_PROMPT_MS);

  io.to(`party:${game.partyId}`).emit('bombparty:play-again-prompt', {
    partyId: replayPrompt.partyId,
    lives: replayPrompt.lives,
    difficulty: replayPrompt.difficulty,
    timeLimit: PLAY_AGAIN_PROMPT_MS,
    startTime: replayPrompt.startTime,
    players: replayPrompt.players,
    gameOverData: replayPrompt.gameOverData,
    responses: [],
    playAgainCount: 0,
    leaveCount: 0,
  });

}

// Export for cleanup if needed
export function cleanupBombPartyGames() {
  for (const [partyId, game] of activeGames) {
    clearTurnTimer(game);
  }
  activeGames.clear();

  for (const [, prompt] of pendingPlayAgainPrompts) {
    if (prompt.timer) clearTimeout(prompt.timer);
  }
  pendingPlayAgainPrompts.clear();
}

// Send active game state to a reconnecting player
export function sendActiveGameState(socket: Socket, partyId: string, userId: string) {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;

  // Only send if this user is a player in the game
  const isPlayer = game.players.some(p => p.userId === userId);
  if (!isPlayer) return;

  // Send the current game state
  socket.emit('bombparty:started', serializeGameState(game));
}

export function sendPendingBombPartyPlayAgainPrompt(socket: Socket, partyId: string, userId: string) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  if (!prompt.playerIds.includes(userId)) return;

  const responses = Array.from(prompt.responses.entries()).map(([id, value]) => ({
    userId: id,
    playAgain: value,
  }));

  socket.emit('bombparty:play-again-prompt', {
    partyId: prompt.partyId,
    lives: prompt.lives,
    difficulty: prompt.difficulty,
    timeLimit: PLAY_AGAIN_PROMPT_MS,
    startTime: prompt.startTime,
    players: prompt.players,
    gameOverData: prompt.gameOverData,
    responses,
    playAgainCount: responses.filter((r) => r.playAgain).length,
    leaveCount: responses.filter((r) => !r.playAgain).length,
  });
}

// Periodic cleanup for stale games (games running for more than 30 minutes)
const GAME_MAX_DURATION = 30 * 60 * 1000; // 30 minutes

export function startBombPartyCleanup(io: Server) {
  setInterval(() => {
    const now = Date.now();
    for (const [partyId, game] of activeGames) {
      // Check if game has been running too long or is inactive
      const gameAge = now - (game.turnStartTime - game.turnDuration * game.round);
      const isStale = gameAge > GAME_MAX_DURATION || !game.isActive;

      if (isStale) {
        console.log(`Cleaning up stale bomb party game for party ${partyId}`);
        clearTurnTimer(game);

        // Notify players the game was cleaned up
        io.to(`party:${partyId}`).emit('bombparty:game-over', {
          winnerId: null,
          winnerUsername: null,
          players: game.players.map(p => ({
            userId: p.userId,
            username: p.username,
            wordsTypedCount: p.wordsTypedCount,
            isWinner: false,
            rewards: { aura: 0, money: 0 },
          })),
        });

        activeGames.delete(partyId);
      }
    }
  }, 60 * 1000); // Check every minute
}
