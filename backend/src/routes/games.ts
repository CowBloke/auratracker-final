import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, gameCompleteSchema } from '../middleware/validation.js';
import { logGame, logAdmin } from '../utils/logger.js';
import { checkQuestProgress } from './quests.js';
import { recheckBadgeForCondition } from '../utils/badgeAwards.js';

const router = Router();
const isDoodleJumpType = (gameType: string) => gameType === 'doodle_jump' || gameType === 'doodle_jump_mort_subite';

function getUtcDayStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getRacerDaySeed(trackDate: Date): number {
  const dayIndex = Math.floor(trackDate.getTime() / 86400000);
  const seed = ((dayIndex * 2654435761) ^ 0x9e3779b9) >>> 0;
  return seed === 0 ? 1 : seed;
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
  geometry_dash: {
    minScoreForReward: 100,
    scoreTiers: [
      { minScore: 0, moneyReward: 0, auraBonus: 0 },
      { minScore: 100, moneyReward: 12, auraBonus: 1 },
      { minScore: 250, moneyReward: 28, auraBonus: 3 },
      { minScore: 500, moneyReward: 60, auraBonus: 6 },
      { minScore: 900, moneyReward: 110, auraBonus: 10 },
      { minScore: 1400, moneyReward: 180, auraBonus: 16 },
      { minScore: 2200, moneyReward: 280, auraBonus: 24 },
    ],
  },
  qs_watermelon: {
    minScoreForReward: 80,
    scoreTiers: [
      { minScore: 0, moneyReward: 0, auraBonus: 0 },
      { minScore: 80, moneyReward: 14, auraBonus: 1 },
      { minScore: 180, moneyReward: 32, auraBonus: 3 },
      { minScore: 320, moneyReward: 58, auraBonus: 6 },
      { minScore: 520, moneyReward: 95, auraBonus: 10 },
      { minScore: 800, moneyReward: 150, auraBonus: 16 },
      { minScore: 1200, moneyReward: 220, auraBonus: 24 },
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
  knife_hit: {
    minScoreForReward: 5,
    scoreTiers: [
      { minScore: 0, moneyReward: 0, auraBonus: 0 },
      { minScore: 5, moneyReward: 15, auraBonus: 1 },
      { minScore: 15, moneyReward: 40, auraBonus: 4 },
      { minScore: 30, moneyReward: 90, auraBonus: 8 },
      { minScore: 50, moneyReward: 170, auraBonus: 14 },
      { minScore: 80, moneyReward: 320, auraBonus: 24 },
    ],
  },
  goyave_empire: {
    minScoreForReward: 100,
    // Fixed rewards per tier (score = total guavas harvested before cash out)
    scoreTiers: [
      { minScore: 100,         moneyReward: 10,   auraBonus: 1   },
      { minScore: 1_000,       moneyReward: 25,   auraBonus: 3   },
      { minScore: 10_000,      moneyReward: 60,   auraBonus: 8   },
      { minScore: 100_000,     moneyReward: 150,  auraBonus: 20  },
      { minScore: 1_000_000,   moneyReward: 400,  auraBonus: 50  },
      { minScore: 10_000_000,  moneyReward: 1000, auraBonus: 100 },
    ],
    highScoreBonusMin: 5,
    highScoreBonusMax: 25,
  },
  logic_lab: {
    minScoreForReward: 200,
    scoreTiers: [
      { minScore: 0, moneyReward: 0, auraBonus: 0 },
      { minScore: 200, moneyReward: 20, auraBonus: 1 },
      { minScore: 350, moneyReward: 45, auraBonus: 4 },
      { minScore: 550, moneyReward: 80, auraBonus: 8 },
      { minScore: 750, moneyReward: 140, auraBonus: 14 },
      { minScore: 900, moneyReward: 220, auraBonus: 22 },
    ],
  },
  minesweeper: {
    minScoreForReward: 700,
    scoreTiers: [
      { minScore: 0, moneyReward: 0, auraBonus: 0 },
      { minScore: 700, moneyReward: 22, auraBonus: 2 },
      { minScore: 1000, moneyReward: 50, auraBonus: 5 },
      { minScore: 1300, moneyReward: 90, auraBonus: 9 },
      { minScore: 1650, moneyReward: 150, auraBonus: 15 },
      { minScore: 2100, moneyReward: 230, auraBonus: 22 },
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

function calculateGeometryDashRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.geometry_dash;

  if (score < config.minScoreForReward) {
    return { money: 0, aura: 0 };
  }

  let selectedTier = config.scoreTiers[0];
  for (let i = config.scoreTiers.length - 1; i >= 0; i--) {
    if (score >= config.scoreTiers[i].minScore) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  let moneyReward = selectedTier.moneyReward;
  let auraReward = selectedTier.auraBonus;

  if (isNewHighScore) {
    moneyReward += Math.min(Math.floor(score / 250) * 6, 60);
    auraReward += Math.min(Math.floor(score / 300), 10);
  }

  return { money: moneyReward, aura: auraReward };
}

function calculateQsWatermelonRewards(score: number, isNewHighScore: boolean, won: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.qs_watermelon;

  if (score < config.minScoreForReward) {
    return { money: 0, aura: 0 };
  }

  let selectedTier = config.scoreTiers[0];
  for (let i = config.scoreTiers.length - 1; i >= 0; i--) {
    if (score >= config.scoreTiers[i].minScore) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  let moneyReward = selectedTier.moneyReward;
  let auraReward = selectedTier.auraBonus;

  if (isNewHighScore) {
    moneyReward += Math.min(Math.floor(score / 200) * 6, 54);
    auraReward += Math.min(Math.floor(score / 250), 8);
  }

  if (won) {
    auraReward += 8;
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

// Calculate rewards for Goyave Empire based on total guavas harvested
function calculateGoyaveEmpireRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.goyave_empire;

  if (score < config.minScoreForReward) {
    return { money: 0, aura: 0 };
  }

  let selectedTier = config.scoreTiers[0];
  for (let i = config.scoreTiers.length - 1; i >= 0; i--) {
    if (score >= config.scoreTiers[i].minScore) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  let auraReward = selectedTier.auraBonus;
  if (isNewHighScore) {
    const tierIndex = config.scoreTiers.indexOf(selectedTier);
    const tierFraction = tierIndex / (config.scoreTiers.length - 1);
    const bonus = Math.round(
      config.highScoreBonusMin + tierFraction * (config.highScoreBonusMax - config.highScoreBonusMin)
    );
    auraReward += bonus;
  }

  return { money: selectedTier.moneyReward, aura: auraReward };
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

function calculateKnifeHitRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.knife_hit;

  if (score < config.minScoreForReward) {
    return { money: 0, aura: 0 };
  }

  let selectedTier = config.scoreTiers[0];
  for (let i = config.scoreTiers.length - 1; i >= 0; i--) {
    if (score >= config.scoreTiers[i].minScore) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  let auraReward = selectedTier.auraBonus;
  if (isNewHighScore) {
    auraReward += Math.min(Math.floor(score / 20), 8);
  }

  return { money: selectedTier.moneyReward, aura: auraReward };
}

function calculateLogicLabRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.logic_lab;

  if (score < config.minScoreForReward) {
    return { money: 0, aura: 0 };
  }

  let selectedTier = config.scoreTiers[0];
  for (let i = config.scoreTiers.length - 1; i >= 0; i--) {
    if (score >= config.scoreTiers[i].minScore) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  let moneyReward = selectedTier.moneyReward;
  let auraReward = selectedTier.auraBonus;

  if (isNewHighScore) {
    moneyReward += Math.min(Math.floor(score / 200) * 5, 40);
    auraReward += Math.min(Math.floor(score / 250), 6);
  }

  return { money: moneyReward, aura: auraReward };
}

function calculateMinesweeperRewards(score: number, isNewHighScore: boolean, won: boolean): { money: number; aura: number } {
  if (!won) {
    return { money: 0, aura: 0 };
  }

  const config = GAME_REWARDS.minesweeper;

  if (score < config.minScoreForReward) {
    return { money: 0, aura: 0 };
  }

  let selectedTier = config.scoreTiers[0];
  for (let i = config.scoreTiers.length - 1; i >= 0; i--) {
    if (score >= config.scoreTiers[i].minScore) {
      selectedTier = config.scoreTiers[i];
      break;
    }
  }

  const moneyReward = selectedTier.moneyReward;
  let auraReward = selectedTier.auraBonus;

  if (isNewHighScore) {
    auraReward += Math.min(Math.floor(score / 300), 10);
  }

  return { money: moneyReward, aura: auraReward };
}


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
    } else if (gameType === 'geometry_dash') {
      const rewards = calculateGeometryDashRewards(score, isNewHighScore);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'qs_watermelon') {
      const rewards = calculateQsWatermelonRewards(score, isNewHighScore, won || false);
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
    } else if (gameType === 'knife_hit') {
      const rewards = calculateKnifeHitRewards(score, isNewHighScore);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'goyave_empire') {
      const rewards = calculateGoyaveEmpireRewards(score, isNewHighScore);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'logic_lab') {
      const rewards = calculateLogicLabRewards(score, isNewHighScore);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'minesweeper') {
      const rewards = calculateMinesweeperRewards(score, isNewHighScore, won || false);
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
      // Immediately recalculate the champion badge for this game (non-blocking)
      void recheckBadgeForCondition(`GAME_HIGHSCORE_${gameType}`);
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
    } else if (gameType === 'geometry_dash') {
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'qs_watermelon') {
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
    } else if (gameType === 'knife_hit') {
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'casino') {
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'goyave_empire') {
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'logic_lab') {
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'minesweeper') {
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

const BADGE_SELECT = {
  id: true,
  name: true,
  description: true,
  howToObtain: true,
  backgroundType: true,
  backgroundColor: true,
  backgroundGradient: true,
  backgroundImage: true,
  icon: true,
  iconColor: true,
  borderColor: true,
  category: true,
  rarity: true,
} as const;

// Get game leaderboard
router.get('/:gameType/leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { gameType } = req.params;
    const { limit = '20' } = req.query;

    const rawRankings = await prisma.gameStats.findMany({
      where: { gameType, user: { isSuperAdmin: false } },
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

    // Attach equipped badges
    let rankings: any[] = rawRankings;
    if (rawRankings.length > 0) {
      const badgeUsers = await prisma.user.findMany({
        where: { id: { in: rawRankings.map((r) => r.user.id) } },
        select: {
          id: true,
          equippedBadge1: { select: BADGE_SELECT },
          equippedBadge2: { select: BADGE_SELECT },
        },
      });
      const badgeMap = new Map(badgeUsers.map((u) => [
        u.id,
        [
          ...(u.equippedBadge1 ? [u.equippedBadge1] : []),
          ...(u.equippedBadge2 ? [u.equippedBadge2] : []),
        ],
      ]));
      rankings = rawRankings.map((r) => ({ ...r, badges: badgeMap.get(r.user.id) ?? [] }));
    }

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

// Goyave Empire: load save state from DB
router.get('/goyave_empire/save', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const save = await prisma.goyaveSave.findUnique({ where: { userId: req.user.id } });
    res.json({ saveData: save?.saveData || null });
  } catch (error) {
    console.error('Load goyave save error:', error);
    res.status(500).json({ error: 'Failed to load save' });
  }
});

// Goyave Empire: persist save state to DB
router.post('/goyave_empire/save', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const { saveData } = req.body;
    if (typeof saveData !== 'string') return res.status(400).json({ error: 'saveData must be a string' });
    await prisma.goyaveSave.upsert({
      where: { userId: req.user.id },
      update: { saveData },
      create: { userId: req.user.id, saveData },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Save goyave state error:', error);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

export default router;
