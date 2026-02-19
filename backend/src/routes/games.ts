import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, gameCompleteSchema } from '../middleware/validation.js';
import { logGame, logAdmin } from '../utils/logger.js';
import { checkQuestProgress } from './quests.js';
import { listBombPartyLanguageFiles, resolveBombPartyLanguageFile, readBombPartyDictionaryWords } from '../utils/bombpartyDictionary.js';

const router = Router();
const isDoodleJumpType = (gameType: string) => gameType === 'doodle_jump' || gameType === 'doodle_jump_mort_subite';
const WORDLE_GUESS_LIMIT = 6;
const WORDLE_WORD_LENGTH = 5;

type WordleTileState = 'correct' | 'present' | 'absent';

function normalizeWordCandidate(input: string): string {
  return input
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
}

function getWordleWords(): string[] {
  const languageFiles = listBombPartyLanguageFiles();
  if (languageFiles.length === 0) {
    throw new Error('No dictionary files found in backend/data');
  }

  const languageFile = resolveBombPartyLanguageFile(languageFiles[0]?.fileName);
  const dictionaryWords = readBombPartyDictionaryWords(languageFile);

  const uniqueWords = new Set<string>();
  for (const rawWord of dictionaryWords) {
    const normalized = normalizeWordCandidate(rawWord);
    if (normalized.length !== WORDLE_WORD_LENGTH) {
      continue;
    }
    if (!/^[A-Z]+$/.test(normalized)) {
      continue;
    }
    uniqueWords.add(normalized);
  }

  if (uniqueWords.size === 0) {
    throw new Error(`No ${WORDLE_WORD_LENGTH}-letter words available for Wordle`);
  }

  return Array.from(uniqueWords.values()).sort();
}

const WORDLE_WORDS = getWordleWords();
const WORDLE_WORD_SET = new Set(WORDLE_WORDS);

function getUtcDayStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getRacerDaySeed(trackDate: Date): number {
  const dayIndex = Math.floor(trackDate.getTime() / 86400000);
  const seed = ((dayIndex * 2654435761) ^ 0x9e3779b9) >>> 0;
  return seed === 0 ? 1 : seed;
}

function getWordIndexForDate(puzzleDate: Date): number {
  const dayIndex = Math.floor(puzzleDate.getTime() / 86400000);
  return dayIndex % WORDLE_WORDS.length;
}

function evaluateWordleGuess(guess: string, answer: string): WordleTileState[] {
  const result: WordleTileState[] = Array.from({ length: WORDLE_WORD_LENGTH }, () => 'absent');
  const letterCounts = new Map<string, number>();

  for (let i = 0; i < WORDLE_WORD_LENGTH; i += 1) {
    const answerLetter = answer[i];
    if (guess[i] === answerLetter) {
      result[i] = 'correct';
    } else {
      letterCounts.set(answerLetter, (letterCounts.get(answerLetter) ?? 0) + 1);
    }
  }

  for (let i = 0; i < WORDLE_WORD_LENGTH; i += 1) {
    if (result[i] === 'correct') {
      continue;
    }
    const guessLetter = guess[i];
    const remaining = letterCounts.get(guessLetter) ?? 0;
    if (remaining > 0) {
      result[i] = 'present';
      letterCounts.set(guessLetter, remaining - 1);
    }
  }

  return result;
}

function parseWordleGuesses(guessesJson: string): string[] {
  try {
    const parsed = JSON.parse(guessesJson) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => normalizeWordCandidate(entry))
      .filter((entry) => entry.length === WORDLE_WORD_LENGTH);
  } catch {
    return [];
  }
}

async function getOrCreateTodayWordlePuzzle() {
  const todayStart = getUtcDayStart();
  const answerWord = WORDLE_WORDS[getWordIndexForDate(todayStart)];
  return prisma.wordlePuzzle.upsert({
    where: { puzzleDate: todayStart },
    update: {},
    create: {
      puzzleDate: todayStart,
      word: answerWord,
    },
  });
}

// Game reward configuration
const GAME_REWARDS = {
  doodle_jump: {
    minScoreForReward: 100,
    // Progressive rewards based on score
    // Base money reward increases with score tiers
    baseMoneyMultiplier: 0.05, // Base multiplier
    scoreTiers: [
      { minScore: 0, moneyMultiplier: 0.05, auraBonus: 0 },      // 0-499: 0.05x score
      { minScore: 500, moneyMultiplier: 0.08, auraBonus: 5 },    // 500-999: 0.08x score + 5 aura
      { minScore: 1000, moneyMultiplier: 0.12, auraBonus: 10 },  // 1000-1999: 0.12x score + 10 aura
      { minScore: 2000, moneyMultiplier: 0.18, auraBonus: 20 },  // 2000-3999: 0.18x score + 20 aura
      { minScore: 4000, moneyMultiplier: 0.25, auraBonus: 35 },  // 4000-7999: 0.25x score + 35 aura
      { minScore: 8000, moneyMultiplier: 0.35, auraBonus: 50 },  // 8000+: 0.35x score + 50 aura
    ],
  },
  solitaire: {
    // Rewards only for completed games (won = true)
    // Score is calculated as: 10000 - (time in seconds) - (moves * 2) + bonus
    // Higher score = faster time + fewer moves
    minScoreForReward: 0, // Always give rewards for wins
    scoreTiers: [
      { minScore: 0, moneyReward: 50, auraBonus: 5 },         // Slow win
      { minScore: 5000, moneyReward: 100, auraBonus: 10 },    // Decent win
      { minScore: 7000, moneyReward: 150, auraBonus: 15 },    // Good win
      { minScore: 8000, moneyReward: 200, auraBonus: 25 },    // Great win
      { minScore: 9000, moneyReward: 300, auraBonus: 40 },    // Excellent win
      { minScore: 9500, moneyReward: 500, auraBonus: 60 },    // Perfect win
    ],
  },
  game_2048: {
    minScoreForReward: 16384, // Only give money rewards for extremely high scores
    // Progressive rewards based on highest tile reached
    // Aura is only given if player reaches 2048 (won = true)
    // Money is only given for extremely high scores to prevent farming
    scoreTiers: [
      { minScore: 16384, moneyMultiplier: 0.0003, auraBonus: 50 },   // 16384+: 0.0003x score + 50 aura (only if won)
    ],
  },
  flappy_bird: {
    minScoreForReward: 10,
    // Progressive rewards based on score (pipes passed)
    scoreTiers: [
      { minScore: 0, moneyMultiplier: 0.1, auraBonus: 0 },       // 0-9: 0.1x score
      { minScore: 10, moneyMultiplier: 0.15, auraBonus: 2 },      // 10-24: 0.15x score + 2 aura
      { minScore: 25, moneyMultiplier: 0.2, auraBonus: 5 },       // 25-49: 0.2x score + 5 aura
      { minScore: 50, moneyMultiplier: 0.25, auraBonus: 10 },    // 50-99: 0.25x score + 10 aura
      { minScore: 100, moneyMultiplier: 0.3, auraBonus: 20 },    // 100-199: 0.3x score + 20 aura
      { minScore: 200, moneyMultiplier: 0.4, auraBonus: 35 },    // 200-499: 0.4x score + 35 aura
      { minScore: 500, moneyMultiplier: 0.5, auraBonus: 50 },     // 500+: 0.5x score + 50 aura
    ],
  },
  casino: {
    auraForBigWin: 10, // For wins >= 10x bet
    bigWinMultiplier: 10,
    auraForHugeWin: 50, // For wins >= 50x bet
    hugeWinMultiplier: 50,
  },
  racer: {
    minScoreForReward: 0, // Always give rewards for completed laps
    // Score is lap time in seconds (lower is better)
    // Rewards are based on how fast the lap was completed
    scoreTiers: [
      { maxTime: 180, moneyReward: 20, auraBonus: 2 },      // > 3min: slow lap
      { maxTime: 120, moneyReward: 50, auraBonus: 5 },      // 2-3min: decent lap
      { maxTime: 90, moneyReward: 100, auraBonus: 10 },     // 1.5-2min: good lap
      { maxTime: 60, moneyReward: 200, auraBonus: 25 },     // 1-1.5min: great lap
      { maxTime: 45, moneyReward: 500, auraBonus: 50 },      // < 1min: excellent lap
    ],
  },
  tetris: {
    minScoreForReward: 1000, // Minimum score to get rewards
    // Progressive rewards based on score (intentionally conservative to avoid inflation)
    scoreTiers: [
      { minScore: 0, moneyMultiplier: 0.0004, auraBonus: 1 },
      { minScore: 100000, moneyMultiplier: 0.0007, auraBonus: 4 },
      { minScore: 200000, moneyMultiplier: 0.001, auraBonus: 8 },
      { minScore: 300000, moneyMultiplier: 0.0013, auraBonus: 12 },
      { minScore: 500000, moneyMultiplier: 0.0016, auraBonus: 15 },
      { minScore: 800000, moneyMultiplier: 0.002, auraBonus: 20 },
    ],
  },
};

// Calculate progressive rewards for Doodle Jump based on score
function calculateDoodleJumpRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.doodle_jump;
  
  if (score < config.minScoreForReward) {
    return { money: 0, aura: 0 };
  }

  // Find the appropriate tier for this score
  let selectedTier = config.scoreTiers[0];
  for (let i = config.scoreTiers.length - 1; i >= 0; i--) {
    if (score >= config.scoreTiers[i].minScore) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  // Calculate money reward based on tier multiplier
  const moneyReward = Math.floor(score * selectedTier.moneyMultiplier);
  
  // Calculate aura reward: base tier bonus + bonus for new high score
  let auraReward = selectedTier.auraBonus;
  if (isNewHighScore) {
    // Additional bonus for beating your own record (scales with score)
    const highScoreBonus = Math.min(Math.floor(score / 1000) * 10, 100);
    auraReward += highScoreBonus;
  }

  return { money: moneyReward, aura: auraReward };
}

// Calculate progressive rewards for 2048 based on score
// Aura is only given if player reaches 2048 (won = true)
function calculate2048Rewards(score: number, isNewHighScore: boolean, won: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.game_2048;
  
  if (score < config.minScoreForReward) {
    return { money: 0, aura: 0 };
  }

  // Find the appropriate tier for this score
  let selectedTier = config.scoreTiers[0];
  for (let i = config.scoreTiers.length - 1; i >= 0; i--) {
    if (score >= config.scoreTiers[i].minScore) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  // Calculate money reward based on tier multiplier
  const moneyReward = Math.floor(score * selectedTier.moneyMultiplier);
  
  // Calculate aura reward: only if player reached 2048 (won = true)
  let auraReward = 0;
  if (won) {
    auraReward = selectedTier.auraBonus;
    if (isNewHighScore) {
      // Additional bonus for beating your own record (scales with score)
      const highScoreBonus = Math.min(Math.floor(score / 2048) * 5, 50);
      auraReward += highScoreBonus;
    }
  }

  return { money: moneyReward, aura: auraReward };
}

// Calculate progressive rewards for Flappy Bird based on score
function calculateFlappyBirdRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.flappy_bird;
  
  if (score < config.minScoreForReward) {
    return { money: 0, aura: 0 };
  }

  // Find the appropriate tier for this score
  let selectedTier = config.scoreTiers[0];
  for (let i = config.scoreTiers.length - 1; i >= 0; i--) {
    if (score >= config.scoreTiers[i].minScore) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  // Calculate money reward based on tier multiplier
  const moneyReward = Math.floor(score * selectedTier.moneyMultiplier);
  
  // Calculate aura reward: base tier bonus + bonus for new high score
  let auraReward = selectedTier.auraBonus;
  if (isNewHighScore) {
    // Additional bonus for beating your own record (scales with score)
    const highScoreBonus = Math.min(Math.floor(score / 50) * 5, 50);
    auraReward += highScoreBonus;
  }

  return { money: moneyReward, aura: auraReward };
}

// Calculate rewards for Solitaire based on score (only for wins)
// Score formula: 10000 - time(seconds) - moves*2
function calculateSolitaireRewards(score: number, isNewHighScore: boolean, won: boolean): { money: number; aura: number } {
  // No rewards for losses
  if (!won) {
    return { money: 0, aura: 0 };
  }

  const config = GAME_REWARDS.solitaire;

  // Find the appropriate tier for this score
  let selectedTier = config.scoreTiers[0];
  for (let i = config.scoreTiers.length - 1; i >= 0; i--) {
    if (score >= config.scoreTiers[i].minScore) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  // Fixed money reward based on tier
  let moneyReward = selectedTier.moneyReward;
  
  // Calculate aura reward
  let auraReward = selectedTier.auraBonus;
  if (isNewHighScore) {
    // Additional bonus for beating your own record
    const highScoreBonus = Math.min(Math.floor(score / 1000) * 5, 30);
    auraReward += highScoreBonus;
  }

  return { money: moneyReward, aura: auraReward };
}

// Calculate rewards for Racer based on lap time (lower is better)
// Score is lap time in seconds
function calculateRacerRewards(score: number, isNewHighScore: boolean, won: boolean): { money: number; aura: number } {
  // No rewards if didn't complete a lap
  if (!won) {
    return { money: 0, aura: 0 };
  }

  const config = GAME_REWARDS.racer;

  // Find the appropriate tier for this lap time (lower time = better tier)
  // Tiers are ordered from fastest to slowest
  let selectedTier = config.scoreTiers[config.scoreTiers.length - 1]; // Default to slowest tier
  for (let i = 0; i < config.scoreTiers.length; i++) {
    if (score <= config.scoreTiers[i].maxTime) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  // Fixed money reward based on tier
  let moneyReward = selectedTier.moneyReward;
  
  // Calculate aura reward
  let auraReward = selectedTier.auraBonus;
  if (isNewHighScore) {
    // Additional bonus for beating your own record (faster time)
    // The faster the time, the bigger the bonus
    const timeBonus = Math.max(0, 60 - score); // Bonus decreases as time increases
    const highScoreBonus = Math.min(Math.floor(timeBonus / 5) * 5, 30);
    auraReward += highScoreBonus;
  }

  return { money: moneyReward, aura: auraReward };
}

// Calculate rewards for Tetris based on score
function calculateTetrisRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.tetris;
  
  if (score < config.minScoreForReward) {
    return { money: 0, aura: 0 };
  }

  // Find the appropriate tier for this score
  let selectedTier = config.scoreTiers[0];
  for (let i = config.scoreTiers.length - 1; i >= 0; i--) {
    if (score >= config.scoreTiers[i].minScore) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  // Calculate money reward based on tier multiplier
  const moneyReward = Math.floor(score * selectedTier.moneyMultiplier);
  
  // Calculate aura reward: base tier bonus + bonus for new high score
  let auraReward = selectedTier.auraBonus;
  if (isNewHighScore) {
    // Small high-score bonus to prevent runaway aura inflation.
    const highScoreBonus = Math.min(Math.floor(score / 500000), 5);
    auraReward += highScoreBonus;
  }

  return { money: moneyReward, aura: auraReward };
}

// Daily Wordle state, leaderboard and history
router.get('/daily/wordle', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const puzzle = await getOrCreateTodayWordlePuzzle();
    const attempt = await prisma.wordleAttempt.findUnique({
      where: {
        puzzleId_userId: {
          puzzleId: puzzle.id,
          userId: req.user.id,
        },
      },
    });

    const guesses = attempt ? parseWordleGuesses(attempt.guessesJson) : [];
    const evaluations = guesses.map((guess) => ({
      guess,
      result: evaluateWordleGuess(guess, puzzle.word),
    }));

    const leaderboardRows = await prisma.wordleAttempt.findMany({
      where: {
        puzzleId: puzzle.id,
        solved: true,
        guessCount: { not: null },
      },
      orderBy: [
        { guessCount: 'asc' },
        { completedAt: 'asc' },
      ],
      take: 50,
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

    const historyPuzzles = await prisma.wordlePuzzle.findMany({
      where: {
        puzzleDate: { lt: puzzle.puzzleDate },
      },
      orderBy: { puzzleDate: 'desc' },
      take: 60,
      select: {
        id: true,
        puzzleDate: true,
        word: true,
        _count: {
          select: {
            attempts: true,
          },
        },
      },
    });

    const solvedByPuzzle = historyPuzzles.length > 0
      ? await prisma.wordleAttempt.groupBy({
          by: ['puzzleId'],
          where: {
            solved: true,
            puzzleId: { in: historyPuzzles.map((entry) => entry.id) },
          },
          _count: {
            puzzleId: true,
          },
        })
      : [];

    const solvedCountByPuzzleId = new Map<string, number>(
      solvedByPuzzle.map((entry) => [entry.puzzleId, entry._count.puzzleId])
    );

    return res.json({
      puzzleDate: puzzle.puzzleDate.toISOString(),
      maxGuesses: WORDLE_GUESS_LIMIT,
      wordLength: WORDLE_WORD_LENGTH,
      userAttempt: {
        guesses,
        evaluations,
        isCompleted: attempt?.isCompleted ?? false,
        solved: attempt?.solved ?? false,
        guessCount: attempt?.guessCount ?? null,
      },
      leaderboard: leaderboardRows.map((entry) => ({
        userId: entry.user.id,
        username: entry.user.username,
        usernameColor: entry.user.usernameColor,
        guessCount: entry.guessCount,
        completedAt: entry.completedAt?.toISOString() ?? null,
      })),
      history: historyPuzzles.map((entry) => ({
        puzzleDate: entry.puzzleDate.toISOString(),
        word: entry.word.toLowerCase(),
        totalPlayers: entry._count.attempts,
        solvedCount: solvedCountByPuzzleId.get(entry.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error('Get daily wordle state error:', error);
    return res.status(500).json({ error: 'Failed to get daily wordle state' });
  }
});

router.post('/daily/wordle/guess', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const rawGuess = typeof req.body?.guess === 'string' ? req.body.guess : '';
    const guess = normalizeWordCandidate(rawGuess);

    if (guess.length !== WORDLE_WORD_LENGTH) {
      return res.status(400).json({ error: `Guess must be ${WORDLE_WORD_LENGTH} letters` });
    }
    if (!WORDLE_WORD_SET.has(guess)) {
      return res.status(400).json({ error: 'Word not found in dictionary' });
    }

    const puzzle = await getOrCreateTodayWordlePuzzle();
    const existingAttempt = await prisma.wordleAttempt.findUnique({
      where: {
        puzzleId_userId: {
          puzzleId: puzzle.id,
          userId: req.user.id,
        },
      },
    });

    const existingGuesses = existingAttempt ? parseWordleGuesses(existingAttempt.guessesJson) : [];
    if (existingAttempt?.isCompleted || existingGuesses.length >= WORDLE_GUESS_LIMIT) {
      return res.status(409).json({
        error: 'Daily Wordle already completed',
        isCompleted: true,
        solved: existingAttempt?.solved ?? false,
        guesses: existingGuesses,
      });
    }

    const nextGuesses = [...existingGuesses, guess];
    const solved = guess === puzzle.word;
    const isCompleted = solved || nextGuesses.length >= WORDLE_GUESS_LIMIT;
    const currentEvaluation = evaluateWordleGuess(guess, puzzle.word);
    const guessCount = isCompleted ? nextGuesses.length : null;

    await prisma.wordleAttempt.upsert({
      where: {
        puzzleId_userId: {
          puzzleId: puzzle.id,
          userId: req.user.id,
        },
      },
      create: {
        puzzleId: puzzle.id,
        userId: req.user.id,
        guessesJson: JSON.stringify(nextGuesses),
        isCompleted,
        solved,
        guessCount,
        completedAt: isCompleted ? new Date() : null,
      },
      update: {
        guessesJson: JSON.stringify(nextGuesses),
        isCompleted,
        solved,
        guessCount,
        completedAt: isCompleted ? new Date() : null,
      },
    });

    return res.json({
      guess,
      result: currentEvaluation,
      guesses: nextGuesses,
      solved,
      isCompleted,
      attemptsRemaining: Math.max(0, WORDLE_GUESS_LIMIT - nextGuesses.length),
    });
  } catch (error) {
    console.error('Submit daily wordle guess error:', error);
    return res.status(500).json({ error: 'Failed to submit wordle guess' });
  }
});

router.get('/daily/racer', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const limit = Math.max(1, Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100));
    const trackDate = getUtcDayStart();

    const allRuns = await prisma.dailyRacerRun.findMany({
      where: { trackDate },
      orderBy: [{ lapTimeMs: 'asc' }, { createdAt: 'asc' }],
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

    const bestByUser = new Map<string, (typeof allRuns)[number]>();
    for (const run of allRuns) {
      if (!bestByUser.has(run.userId)) {
        bestByUser.set(run.userId, run);
      }
    }

    const leaderboard = Array.from(bestByUser.values())
      .slice(0, limit)
      .map((run, index) => ({
        rank: index + 1,
        userId: run.user.id,
        username: run.user.username,
        usernameColor: run.user.usernameColor,
        bestLapTimeMs: run.lapTimeMs,
        achievedAt: run.createdAt.toISOString(),
      }));

    const userRuns = allRuns.filter((run) => run.userId === req.user!.id);
    const userBest = userRuns.length > 0 ? userRuns[0] : null;

    return res.json({
      trackDate: trackDate.toISOString(),
      seed: getRacerDaySeed(trackDate),
      leaderboard,
      userBestLapTimeMs: userBest?.lapTimeMs ?? null,
      userRunCount: userRuns.length,
    });
  } catch (error) {
    console.error('Get daily racer state error:', error);
    return res.status(500).json({ error: 'Failed to get daily racer state' });
  }
});

router.post('/daily/racer/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const lapTimeMs = Number(req.body?.lapTimeMs);
    if (!Number.isInteger(lapTimeMs) || lapTimeMs < 1_000 || lapTimeMs > 3_600_000) {
      return res.status(400).json({ error: 'lapTimeMs must be an integer between 1000 and 3600000' });
    }

    const trackDate = getUtcDayStart();
    const previousBest = await prisma.dailyRacerRun.findFirst({
      where: { userId: req.user.id, trackDate },
      orderBy: [{ lapTimeMs: 'asc' }, { createdAt: 'asc' }],
    });

    const run = await prisma.dailyRacerRun.create({
      data: {
        userId: req.user.id,
        trackDate,
        lapTimeMs,
      },
    });

    const isNewDailyBest = !previousBest || lapTimeMs < previousBest.lapTimeMs;

    return res.json({
      success: true,
      run: {
        id: run.id,
        lapTimeMs: run.lapTimeMs,
        trackDate: run.trackDate.toISOString(),
        createdAt: run.createdAt.toISOString(),
      },
      isNewDailyBest,
      bestLapTimeMs: isNewDailyBest ? lapTimeMs : previousBest.lapTimeMs,
    });
  } catch (error) {
    console.error('Submit daily racer run error:', error);
    return res.status(500).json({ error: 'Failed to submit daily racer run' });
  }
});

// Get game stats for a user
router.get('/:gameType/stats/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { gameType, userId } = req.params;
    
    let stats = await prisma.gameStats.findUnique({
      where: {
        userId_gameType: {
          userId,
          gameType,
        },
      },
    });
    
    if (!stats) {
      // Return default stats
      stats = {
        id: '',
        userId,
        gameType,
        wins: 0,
        losses: 0,
        highScore: 0,
        totalPlayed: 0,
      };
    }
    
    res.json({ stats });
  } catch (error) {
    console.error('Get game stats error:', error);
    res.status(500).json({ error: 'Failed to get game stats' });
  }
});

// Complete a game
router.post('/:gameType/complete', authMiddleware, validate(gameCompleteSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { gameType } = req.params;
    const { score, won, duration, bet, netGain } = req.body;
    
    // Get current user balance and stats
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // For casino, check if user has enough money for bet
    if (gameType === 'casino' && bet) {
      if (currentUser.money < bet) {
        return res.status(400).json({ error: 'Insufficient funds' });
      }
    }
    
    const currentStats = await prisma.gameStats.findUnique({
      where: {
        userId_gameType: {
          userId: req.user.id,
          gameType,
        },
      },
    });
    
    // For racer, lower score (time) is better, so check differently
    const isNewHighScore = gameType === 'racer' 
      ? (!currentStats || score < currentStats.highScore || currentStats.highScore === 0)
      : (!currentStats || score > currentStats.highScore);
    // Calculate rewards
    let auraReward = 0;
    let moneyReward = 0;
    
    if (isDoodleJumpType(gameType)) {
      const rewards = calculateDoodleJumpRewards(score, isNewHighScore);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'game_2048') {
      const rewards = calculate2048Rewards(score, isNewHighScore, won || false);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'flappy_bird') {
      const rewards = calculateFlappyBirdRewards(score, isNewHighScore);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'solitaire') {
      const rewards = calculateSolitaireRewards(score, isNewHighScore, won || false);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'racer') {
      const rewards = calculateRacerRewards(score, isNewHighScore, won || false);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'tetris') {
      const rewards = calculateTetrisRewards(score, isNewHighScore);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'casino' && bet) {
      // Casino: score is the win amount, bet is deducted, netGain = score - bet
      // Deduct bet first, then add winnings
      moneyReward = netGain || (score - bet); // netGain can be negative
      
      // Aura rewards for big wins
      const config = GAME_REWARDS.casino;
      if (won && score >= bet * config.hugeWinMultiplier) {
        auraReward = config.auraForHugeWin;
      } else if (won && score >= bet * config.bigWinMultiplier) {
        auraReward = config.auraForBigWin;
      }
    }
    
    // Update stats and user balance in transaction
    const [stats, user] = await prisma.$transaction([
      prisma.gameStats.upsert({
        where: {
          userId_gameType: {
            userId: req.user.id,
            gameType,
          },
        },
        create: {
          userId: req.user.id,
          gameType,
          wins: won ? 1 : 0,
          losses: won ? 0 : 1,
          highScore: score,
          totalPlayed: 1,
        },
        update: {
          wins: won ? { increment: 1 } : undefined,
          losses: !won ? { increment: 1 } : undefined,
          highScore: isNewHighScore ? score : undefined,
          totalPlayed: { increment: 1 },
        },
        // For racer, we need to ensure highScore is always the best (lowest) time
        // This is handled by isNewHighScore check above
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          aura: { increment: auraReward },
          money: { increment: moneyReward },
        },
      }),
    ]);
    
    // Emit balance update (always for casino, or if there are rewards)
    if (gameType === 'casino' || auraReward > 0 || moneyReward > 0) {
      io.emit('economy:balance-update', {
        userId: req.user.id,
        aura: user.aura,
        money: user.money,
      });
    }

    // Log game completion
    logGame('game_complete', req.user.id, currentUser.username, {
      gameType,
      score,
      won,
      duration,
      bet: bet || undefined,
      netGain: netGain || undefined,
      auraReward,
      moneyReward,
      isNewHighScore,
    });

    // Log casino bet specifically
    if (gameType === 'casino' && bet) {
      logGame('casino_bet', req.user.id, currentUser.username, {
        bet,
        won,
        winAmount: score,
        netGain: netGain || (score - bet),
      });
    }

    // Log high score
    if (isNewHighScore) {
      logGame('highscore', req.user.id, currentUser.username, {
        gameType,
        newHighScore: score,
        previousHighScore: currentStats?.highScore || 0,
      });
    }

    // Check quest progress
    if (isDoodleJumpType(gameType)) {
      await checkQuestProgress(req.user.id, 'DOODLE_JUMP_SCORE', score);
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'game_2048') {
      await checkQuestProgress(req.user.id, 'GAME_2048_SCORE', score);
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'flappy_bird') {
      await checkQuestProgress(req.user.id, 'FLAPPY_BIRD_SCORE', score);
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'solitaire') {
      await checkQuestProgress(req.user.id, 'SOLITAIRE_PLAYS', 1);
      await checkQuestProgress(req.user.id, 'SOLITAIRE_WINS', won ? 1 : 0);
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'racer') {
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'tetris') {
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
    } else if (gameType === 'casino') {
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    }

    res.json({
      auraReward,
      moneyReward,
      newStats: stats,
      isNewHighScore,
    });
  } catch (error) {
    console.error('Complete game error:', error);
    res.status(500).json({ error: 'Failed to complete game' });
  }
});

// Get game leaderboard
router.get('/:gameType/leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { gameType } = req.params;
    const { limit = '20' } = req.query;

    const rankings = await prisma.gameStats.findMany({
      where: { gameType, user: { isAdmin: false } },
      orderBy: { highScore: gameType === 'racer' ? 'asc' : 'desc' },
      take: parseInt(limit as string),
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    res.json({ rankings });
  } catch (error) {
    console.error('Get game leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Admin: Delete a user's game stats (reset their high score)
router.delete('/:gameType/stats/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user is admin
    const adminUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!adminUser?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { gameType, userId } = req.params;

    // Get target user info for logging
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    // Delete the game stats record
    await prisma.gameStats.delete({
      where: {
        userId_gameType: {
          userId,
          gameType,
        },
      },
    });

    // Log stats deletion
    logAdmin('stats_delete', req.user.id, adminUser.username, userId, targetUser?.username || undefined, {
      gameType,
    });

    res.json({ success: true, message: 'Game stats deleted successfully' });
  } catch (error) {
    console.error('Delete game stats error:', error);
    res.status(500).json({ error: 'Failed to delete game stats' });
  }
});

export default router;
