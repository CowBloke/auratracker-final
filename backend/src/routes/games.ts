import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, gameCompleteSchema } from '../middleware/validation.js';
import { logGame, logAdmin } from '../utils/logger.js';
import { checkQuestProgress } from './quests.js';
import { recheckBadgeForCondition, awardBadgeByKey } from '../utils/badgeAwards.js';
import { announceGameRecordBroken } from '../socket/chat.js';
import { getActiveClanMoneyBoostForUser } from '../utils/clanEffects.js';

const router = Router();
const isDoodleJumpType = (gameType: string) => gameType === 'doodle_jump' || gameType === 'doodle_jump_mort_subite';

const GAME_CHAT_LABELS: Record<string, string> = {
  doodle_jump: 'Doodle Jump',
  doodle_jump_mort_subite: 'Doodle Jump Mort Subite',
  game_2048: '2048',
  flappy_bird: 'Flappy Bird',
  chrome_dino: 'Chrome Dino',
  stack_tower: 'Stack Tower',
  geometry_dash: 'Geometry Dash',
  qs_watermelon: 'QS Watermelon',
  solitaire: 'Solitaire',
  racer: 'Racer',
  tetris: 'Tetris',
  knife_hit: 'Knife Hit',
  goyave_empire: 'Goyave Empire',
  logic_lab: 'Sudoku',
  minesweeper: 'Minesweeper',
  fruit_ninja: 'Fruit Ninja',
};

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
  chrome_dino: {
    minScoreForReward: 120,
    scoreTiers: [
      { minScore: 0, moneyReward: 0, auraBonus: 0 },
      { minScore: 120, moneyReward: 16, auraBonus: 1 },
      { minScore: 260, moneyReward: 34, auraBonus: 3 },
      { minScore: 420, moneyReward: 60, auraBonus: 6 },
      { minScore: 650, moneyReward: 105, auraBonus: 10 },
      { minScore: 950, moneyReward: 170, auraBonus: 16 },
      { minScore: 1350, moneyReward: 260, auraBonus: 24 },
    ],
  },
  stack_tower: {
    minScoreForReward: 10,
    scoreTiers: [
      { minScore: 0, moneyReward: 0, auraBonus: 0 },
      { minScore: 10, moneyReward: 12, auraBonus: 1 },
      { minScore: 20, moneyReward: 26, auraBonus: 3 },
      { minScore: 35, moneyReward: 50, auraBonus: 6 },
      { minScore: 55, moneyReward: 85, auraBonus: 10 },
      { minScore: 80, moneyReward: 130, auraBonus: 15 },
      { minScore: 120, moneyReward: 190, auraBonus: 22 },
    ],
  },
  qs_watermelon: {
    minScoreForReward: 80,
    scoreTiers: [
      { minScore: 0, moneyReward: 0, auraBonus: 0 },
      { minScore: 80, moneyReward: 12, auraBonus: 1 },
      { minScore: 200, moneyReward: 30, auraBonus: 3 },
      { minScore: 420, moneyReward: 62, auraBonus: 6 },
      { minScore: 800, moneyReward: 120, auraBonus: 10 },
      { minScore: 1400, moneyReward: 210, auraBonus: 16 },
      { minScore: 2200, moneyReward: 330, auraBonus: 24 },
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
      { maxTime: 45, moneyReward: 500, auraBonus: 50 },       // < 45s: excellent lap
      { maxTime: 60, moneyReward: 200, auraBonus: 25 },       // < 1min: great lap
      { maxTime: 90, moneyReward: 100, auraBonus: 10 },       // 1-1.5min: good lap
      { maxTime: 120, moneyReward: 50, auraBonus: 5 },        // 1.5-2min: decent lap
      { maxTime: 180, moneyReward: 20, auraBonus: 2 },        // 2-3min: slow lap
      { maxTime: Number.POSITIVE_INFINITY, moneyReward: 8, auraBonus: 1 }, // > 3min: completion reward
    ],
    dailyFirstRunReward: { money: 15, aura: 1 },
    dailyBestBonus: { money: 35, aura: 6 },
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
    minScoreForReward: 35,
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
  fruit_ninja: {
    minScoreForReward: 50,
    scoreTiers: [
      { minScore: 0,   moneyReward: 0,  auraBonus: 0 },
      { minScore: 50,  moneyReward: 12, auraBonus: 1 },
      { minScore: 120, moneyReward: 28, auraBonus: 3 },
      { minScore: 220, moneyReward: 55, auraBonus: 6 },
      { minScore: 350, moneyReward: 95, auraBonus: 10 },
      { minScore: 500, moneyReward: 160, auraBonus: 16 },
      { minScore: 700, moneyReward: 250, auraBonus: 24 },
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

function calculateChromeDinoRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.chrome_dino;

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
    moneyReward += Math.min(Math.floor(score / 180) * 5, 55);
    auraReward += Math.min(Math.floor(score / 240), 10);
  }

  return { money: moneyReward, aura: auraReward };
}

function calculateStackTowerRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.stack_tower;

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
    moneyReward += Math.min(Math.floor(score / 14) * 4, 60);
    auraReward += Math.min(Math.floor(score / 22), 8);
  }

  return { money: moneyReward, aura: auraReward };
}

function calculateQSWatermelonRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
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
    moneyReward += Math.min(Math.floor(score / 180) * 5, 80);
    auraReward += Math.min(Math.floor(score / 260), 12);
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
  // Tiers are ordered from fastest to slowest.
  let selectedTier = config.scoreTiers[config.scoreTiers.length - 1];
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

  let moneyReward = selectedTier.moneyReward;
  let auraReward = selectedTier.auraBonus;

  const topTier = config.scoreTiers[config.scoreTiers.length - 1];
  if (score > topTier.minScore) {
    // Diminishing returns above top tier with a hard cap at 100T guavas.
    const maxScoreForScaling = 100_000_000_000_000;
    const maxMoneyReward = 2000;
    const maxAuraReward = 200;
    const clampedScore = Math.min(score, maxScoreForScaling);
    const progress = (clampedScore - topTier.minScore) / (maxScoreForScaling - topTier.minScore);

    // Normalized inverse-exponential curve to gain less and less near the cap.
    const curveStrength = 5;
    const scaledProgress = (1 - Math.exp(-curveStrength * progress)) / (1 - Math.exp(-curveStrength));

    moneyReward = Math.round(topTier.moneyReward + (maxMoneyReward - topTier.moneyReward) * scaledProgress);
    auraReward = Math.round(topTier.auraBonus + (maxAuraReward - topTier.auraBonus) * scaledProgress);
  }

  if (isNewHighScore) {
    const tierIndex = config.scoreTiers.indexOf(selectedTier);
    const tierFraction = tierIndex / (config.scoreTiers.length - 1);
    const bonus = Math.round(
      config.highScoreBonusMin + tierFraction * (config.highScoreBonusMax - config.highScoreBonusMin)
    );
    auraReward += bonus;
  }

  moneyReward = Math.min(moneyReward, 2000);
  auraReward = Math.min(auraReward, 200);

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

function calculateKnifeHitRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.knife_hit;
  const minScoreForAuraReward = 50;

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

  let auraReward = score >= minScoreForAuraReward ? selectedTier.auraBonus : 0;
  if (isNewHighScore && score >= minScoreForAuraReward) {
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

function calculateFruitNinjaRewards(score: number, isNewHighScore: boolean): { money: number; aura: number } {
  const config = GAME_REWARDS.fruit_ninja;

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
    moneyReward += Math.min(Math.floor(score / 100) * 6, 60);
    auraReward += Math.min(Math.floor(score / 150), 8);
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

    const isNewDailyBest = !previousBest || lapTimeMs < previousBest.lapTimeMs;
    const isFirstRunToday = !previousBest;
    const bonusConfig = GAME_REWARDS.racer;
    const dailyMoneyReward =
      (isFirstRunToday ? bonusConfig.dailyFirstRunReward.money : 0) +
      (isNewDailyBest ? bonusConfig.dailyBestBonus.money : 0);
    const dailyAuraReward =
      (isFirstRunToday ? bonusConfig.dailyFirstRunReward.aura : 0) +
      (isNewDailyBest ? bonusConfig.dailyBestBonus.aura : 0);

    const [run, user] = await prisma.$transaction([
      prisma.dailyRacerRun.create({
        data: {
          userId: req.user.id,
          trackDate,
          lapTimeMs,
        },
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          money: { increment: dailyMoneyReward },
          aura: { increment: dailyAuraReward },
        },
      }),
    ]);

    if (dailyMoneyReward > 0 || dailyAuraReward > 0) {
      io.emit('economy:balance-update', {
        userId: req.user.id,
        aura: user.aura,
        money: user.money,
      });
      logGame('game_reward', req.user.id, req.user.username, {
        gameType: 'racer_daily',
        lapTimeMs,
        isFirstRunToday,
        isNewDailyBest,
        auraReward: dailyAuraReward,
        moneyReward: dailyMoneyReward,
      });
    }

    return res.json({
      success: true,
      run: {
        id: run.id,
        lapTimeMs: run.lapTimeMs,
        trackDate: run.trackDate.toISOString(),
        createdAt: run.createdAt.toISOString(),
      },
      rewards: {
        money: dailyMoneyReward,
        aura: dailyAuraReward,
        isFirstRunToday,
        isNewDailyBest,
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

// Get aggregated stats for the games catalog
router.get('/catalog/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const [globalStats, personalStats] = await Promise.all([
      prisma.gameStats.groupBy({
        by: ['gameType'],
        where: {
          user: {
            isSuperAdmin: false,
          },
        },
        _sum: {
          totalPlayed: true,
        },
      }),
      prisma.gameStats.findMany({
        where: {
          userId: req.user.id,
        },
        select: {
          gameType: true,
          totalPlayed: true,
        },
      }),
    ]);

    res.json({
      global: globalStats.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.gameType] = entry._sum.totalPlayed ?? 0;
        return acc;
      }, {}),
      personal: personalStats.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.gameType] = entry.totalPlayed;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Get games catalog stats error:', error);
    res.status(500).json({ error: 'Failed to get games catalog stats' });
  }
});

// Complete a game
router.post('/:gameType/complete', authMiddleware, validate(gameCompleteSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { gameType } = req.params;
    const { score, won, duration, bet, netGain, maxTile, difficulty } = req.body;
    
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

    const previousGlobalBest = await prisma.gameStats.findFirst({
      where: {
        gameType,
        ...(gameType === 'racer' ? { highScore: { gt: 0 } } : {}),
      },
      orderBy: { highScore: gameType === 'racer' ? 'asc' : 'desc' },
      select: {
        userId: true,
        highScore: true,
      },
    });
    
    // For racer, lower score (time) is better, so check differently
    const isNewHighScore = gameType === 'racer' 
      ? (!currentStats || score < currentStats.highScore || currentStats.highScore === 0)
      : (!currentStats || score > currentStats.highScore);
    // Calculate rewards
    let auraReward = 0;
    let moneyReward = 0;
    const badgeUpdateTasks: Promise<unknown>[] = [];
    
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
    } else if (gameType === 'chrome_dino') {
      const rewards = calculateChromeDinoRewards(score, isNewHighScore);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'stack_tower') {
      const rewards = calculateStackTowerRewards(score, isNewHighScore);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'qs_watermelon') {
      const rewards = calculateQSWatermelonRewards(score, isNewHighScore);
      moneyReward = rewards.money;
      auraReward = rewards.aura;
    } else if (gameType === 'geometry_dash') {
      const rewards = calculateGeometryDashRewards(score, isNewHighScore);
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
    } else if (gameType === 'fruit_ninja') {
      const rewards = calculateFruitNinjaRewards(score, isNewHighScore);
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

    // Defensive fallback: eligible Chrome Dino runs should never end with 0/0 rewards.
    if (
      gameType === 'chrome_dino'
      && score >= GAME_REWARDS.chrome_dino.minScoreForReward
      && moneyReward <= 0
      && auraReward <= 0
    ) {
      moneyReward = GAME_REWARDS.chrome_dino.scoreTiers[1]?.moneyReward ?? 1;
      auraReward = GAME_REWARDS.chrome_dino.scoreTiers[1]?.auraBonus ?? 1;
      logGame('reward_fallback', req.user.id, currentUser.username, {
        gameType,
        score,
        reason: 'chrome_dino_zero_reward_guard',
      });
    }
    
    const clanMoneyBoost = moneyReward > 0 ? await getActiveClanMoneyBoostForUser(req.user.id) : null;
    const clanMoneyBoostPercent = clanMoneyBoost?.value ?? 0;
    const clanMoneyBoostBonus = clanMoneyBoostPercent > 0
      ? Math.floor(moneyReward * (clanMoneyBoostPercent / 100))
      : 0;

    moneyReward += clanMoneyBoostBonus;

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

    // Record score history outside the main transaction so it never blocks game completion
    prisma.gameScoreHistory.create({
      data: { userId: req.user.id, gameType, score },
    }).catch((err) => console.error('[gameScoreHistory] failed to insert:', err));

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
      clanMoneyBoostBonus,
      clanMoneyBoostPercent,
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
      // Recalculate the champion badge for this game before the client refreshes user data.
      badgeUpdateTasks.push(recheckBadgeForCondition(`GAME_HIGHSCORE_${gameType}`));
    }

    const isNewGlobalRecord = gameType === 'racer'
      ? !previousGlobalBest || previousGlobalBest.highScore === 0 || score < previousGlobalBest.highScore
      : !previousGlobalBest || score > previousGlobalBest.highScore;

    if (isNewHighScore && isNewGlobalRecord && GAME_CHAT_LABELS[gameType]) {
      void announceGameRecordBroken(io, {
        username: currentUser.username,
        gameLabel: GAME_CHAT_LABELS[gameType],
        score,
        gameType,
      });
    }

    // ── Achievement badge checks ─────────────────────────────────────────────

    // 2048 tile tracking: also upsert a game_2048_tile stat with the max tile as highScore
    if (gameType === 'game_2048' && maxTile && typeof maxTile === 'number' && maxTile > 0) {
      const currentTileStat = await prisma.gameStats.findUnique({
        where: { userId_gameType: { userId: req.user.id, gameType: 'game_2048_tile' } },
        select: { highScore: true },
      });
      const isNewTileRecord = !currentTileStat || maxTile > currentTileStat.highScore;
      await prisma.gameStats.upsert({
        where: { userId_gameType: { userId: req.user.id, gameType: 'game_2048_tile' } },
        create: { userId: req.user.id, gameType: 'game_2048_tile', wins: 0, losses: 0, highScore: maxTile, totalPlayed: 1 },
        update: {
          totalPlayed: { increment: 1 },
          highScore: isNewTileRecord ? maxTile : undefined,
        },
      });
      if (maxTile >= 2048) badgeUpdateTasks.push(recheckBadgeForCondition('GAME_2048_TILE_2048'));
      if (maxTile >= 4096) badgeUpdateTasks.push(recheckBadgeForCondition('GAME_2048_TILE_4096'));
    }

    // Sudoku difficulty badge tracking (logic_lab with difficulty param)
    if (gameType === 'logic_lab' && won && difficulty && typeof difficulty === 'string') {
      const diffKey = difficulty.toLowerCase();
      const sudokuGameType = `logic_lab_${diffKey}`;
      await prisma.gameStats.upsert({
        where: { userId_gameType: { userId: req.user.id, gameType: sudokuGameType } },
        create: { userId: req.user.id, gameType: sudokuGameType, wins: 1, losses: 0, highScore: score, totalPlayed: 1 },
        update: { wins: { increment: 1 }, totalPlayed: { increment: 1 }, highScore: score > (currentStats?.highScore ?? 0) ? score : undefined },
      });
      const condMap: Record<string, string> = { easy: 'SUDOKU_EASY', medium: 'SUDOKU_MEDIUM', hard: 'SUDOKU_HARD', expert: 'SUDOKU_EXPERT' };
      if (condMap[diffKey]) badgeUpdateTasks.push(recheckBadgeForCondition(condMap[diffKey]));
      badgeUpdateTasks.push(recheckBadgeForCondition('SUDOKU_COMPLETED'));
    }

    // Minesweeper difficulty badge tracking
    if (gameType === 'minesweeper' && won && difficulty && typeof difficulty === 'string') {
      const diffKey = difficulty.toLowerCase();
      const minesweeperGameType = `minesweeper_${diffKey}`;
      await prisma.gameStats.upsert({
        where: { userId_gameType: { userId: req.user.id, gameType: minesweeperGameType } },
        create: { userId: req.user.id, gameType: minesweeperGameType, wins: 1, losses: 0, highScore: score, totalPlayed: 1 },
        update: { wins: { increment: 1 }, totalPlayed: { increment: 1 }, highScore: score > (currentStats?.highScore ?? 0) ? score : undefined },
      });
      const condMap: Record<string, string> = { debutant: 'MINESWEEPER_DEBUTANT', intermediaire: 'MINESWEEPER_INTERMEDIAIRE', expert: 'MINESWEEPER_EXPERT' };
      if (condMap[diffKey]) badgeUpdateTasks.push(recheckBadgeForCondition(condMap[diffKey]));
      badgeUpdateTasks.push(recheckBadgeForCondition('MINESWEEPER_WIN'));
    }

    // Solitaire win badge
    if (gameType === 'solitaire' && won) {
      badgeUpdateTasks.push(recheckBadgeForCondition('SOLITAIRE_WIN'));
    }

    // Racer completion badge (any valid lap time submitted)
    if (gameType === 'racer') {
      badgeUpdateTasks.push(recheckBadgeForCondition('RACER_LAP'));
    }

    // Casino big bet badges
    if (gameType === 'casino' && bet && typeof bet === 'number') {
      const thresholds = [10000, 20000, 50000, 100000];
      for (const threshold of thresholds) {
        if (bet >= threshold) {
          const betGameType = `casino_bet_${threshold}`;
          await prisma.gameStats.upsert({
            where: { userId_gameType: { userId: req.user.id, gameType: betGameType } },
            create: { userId: req.user.id, gameType: betGameType, wins: 1, losses: 0, highScore: bet, totalPlayed: 1 },
            update: { wins: { increment: 1 }, totalPlayed: { increment: 1 }, highScore: bet > 0 ? Math.max(bet, 0) : undefined },
          });
          badgeUpdateTasks.push(recheckBadgeForCondition(`CASINO_BET_${threshold}`));
        }
      }
    }

    // NIGHT_OWL_WIN / EARLY_BIRD_WIN: time-of-win badges
    if (won) {
      const hour = new Date().getHours();
      if (hour >= 2 && hour < 5) {
        badgeUpdateTasks.push(awardBadgeByKey(req.user.id, 'NIGHT_OWL_WIN', 'Victoire entre 2h et 5h du matin'));
      }
      if (hour < 7) {
        badgeUpdateTasks.push(awardBadgeByKey(req.user.id, 'EARLY_BIRD_WIN', 'Victoire avant 7h du matin'));
      }
    }

    // PERFECT_10: track cross-game consecutive win streak (highScore = current streak)
    {
      const streakStat = await prisma.gameStats.findUnique({
        where: { userId_gameType: { userId: req.user.id, gameType: 'win_streak' } },
        select: { highScore: true },
      });
      const newStreak = won ? (streakStat?.highScore ?? 0) + 1 : 0;
      await prisma.gameStats.upsert({
        where: { userId_gameType: { userId: req.user.id, gameType: 'win_streak' } },
        create: { userId: req.user.id, gameType: 'win_streak', wins: 0, losses: 0, highScore: newStreak, totalPlayed: 1 },
        update: { highScore: newStreak, totalPlayed: { increment: 1 } },
      });
      if (won && newStreak >= 10) {
        badgeUpdateTasks.push(awardBadgeByKey(req.user.id, 'PERFECT_10', '10 victoires consécutives'));
      }
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
    } else if (gameType === 'chrome_dino') {
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'stack_tower') {
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'qs_watermelon') {
      await checkQuestProgress(req.user.id, 'PLAY_GAMES', 1);
      if (won) {
        await checkQuestProgress(req.user.id, 'WIN_GAMES', 1);
      }
    } else if (gameType === 'geometry_dash') {
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

    if (badgeUpdateTasks.length > 0) {
      await Promise.all(badgeUpdateTasks);
    }

    res.json({
      auraReward,
      moneyReward,
      clanMoneyBoostBonus,
      clanMoneyBoostPercent,
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

async function attachUserDecorations<T extends { user: { id: string } }>(rows: T[]) {
  if (rows.length === 0) return rows.map((row) => ({ ...row, badges: [], user: { ...row.user, clanTag: null } }));

  const userIds = rows.map((r) => r.user.id);
  const [badgeUsers, clanMemberships] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        equippedBadge1: { select: BADGE_SELECT },
        equippedBadge2: { select: BADGE_SELECT },
      },
    }),
    prisma.clanMember.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, clan: { select: { tagUnlocked: true, tagText: true, tagStyle: true } } },
    }),
  ]);

  const badgeMap = new Map(
    badgeUsers.map((u) => [
      u.id,
      [
        ...(u.equippedBadge1 ? [u.equippedBadge1] : []),
        ...(u.equippedBadge2 ? [u.equippedBadge2] : []),
      ],
    ])
  );

  const clanTagMap = new Map(
    clanMemberships
      .filter((m) => m.clan?.tagUnlocked && m.clan?.tagText)
      .map((m) => [m.userId, { text: m.clan!.tagText!, style: m.clan!.tagStyle }])
  );

  return rows.map((r) => ({
    ...r,
    badges: badgeMap.get(r.user.id) ?? [],
    user: { ...r.user, clanTag: clanTagMap.get(r.user.id) ?? null },
  }));
}

function extractActiveGoyaveCount(saveData: string): number {
  const parsed = parseGoyaveSaveSnapshot(saveData);
  if (!parsed) return 0;
  return parsed.guavas;
}

const GOYAVE_ACTIVE_WINDOW_MS = 15 * 60 * 1000;

function parseGoyaveSaveSnapshot(saveData: string): { guavas: number; lastTick: number } | null {
  try {
    const parsed = JSON.parse(saveData) as { guavas?: unknown; lastTick?: unknown };
    const rawGuavas = typeof parsed.guavas === 'number' ? parsed.guavas : Number(parsed.guavas);
    const guavas = Number.isFinite(rawGuavas) && rawGuavas >= 0 ? Math.floor(rawGuavas) : 0;
    const rawLastTick = typeof parsed.lastTick === 'number' ? parsed.lastTick : Number(parsed.lastTick);
    const lastTick = Number.isFinite(rawLastTick) && rawLastTick > 0 ? Math.floor(rawLastTick) : 0;
    return { guavas, lastTick };
  } catch {
    return null;
  }
}

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

    const rankings = await attachUserDecorations(rawRankings);

    res.json({ rankings });
  } catch (error) {
    console.error('Get game leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Goyave Empire: active leaderboard (recently synced players ranked by current guavas)
router.get('/goyave_empire/active-leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '20' } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);
    const activeSince = Date.now() - GOYAVE_ACTIVE_WINDOW_MS;

    const saves = await prisma.goyaveSave.findMany({
      where: {
        user: { isSuperAdmin: false },
      },
      select: {
        id: true,
        saveData: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
          },
        },
      },
    });

    const ranked = saves
      .map((save) => {
        const snapshot = parseGoyaveSaveSnapshot(save.saveData);
        const dbUpdatedAt = save.updatedAt instanceof Date
          ? save.updatedAt.getTime()
          : new Date(save.updatedAt).getTime();
        const lastActivityAt = Math.max(snapshot?.lastTick ?? 0, Number.isFinite(dbUpdatedAt) ? dbUpdatedAt : 0);

        return {
          id: save.id,
          highScore: snapshot?.guavas ?? 0,
          lastActivityAt,
          user: save.user,
        };
      })
      .filter((entry) => entry.lastActivityAt >= activeSince)
      .filter((entry) => entry.highScore > 0)
      .sort((a, b) => b.highScore - a.highScore)
      .slice(0, parsedLimit);

    const rankings = await attachUserDecorations(ranked);
    res.json({ rankings, windowSeconds: GOYAVE_ACTIVE_WINDOW_MS / 1000 });
  } catch (error) {
    console.error('Get active goyave leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get active leaderboard' });
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
    const incomingSnapshot = parseGoyaveSaveSnapshot(saveData);
    if (!incomingSnapshot) return res.status(400).json({ error: 'saveData must be valid JSON' });

    const existing = await prisma.goyaveSave.findUnique({
      where: { userId: req.user.id },
      select: { id: true, saveData: true },
    });

    // Ignore stale writes that can arrive out-of-order when clients sync frequently.
    if (existing) {
      const existingSnapshot = parseGoyaveSaveSnapshot(existing.saveData);
      if (existingSnapshot && existingSnapshot.lastTick > incomingSnapshot.lastTick) {
        return res.json({ success: true, ignoredStale: true });
      }

      await prisma.goyaveSave.update({
        where: { id: existing.id },
        data: { saveData },
      });
      return res.json({ success: true });
    }

    await prisma.goyaveSave.create({
      data: { userId: req.user.id, saveData },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Save goyave state error:', error);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

export default router;
