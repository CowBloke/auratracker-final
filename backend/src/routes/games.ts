import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, gameCompleteSchema } from '../middleware/validation.js';
import { logGame, logAdmin } from '../utils/logger.js';

const router = Router();

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
  casino: {
    auraForBigWin: 10, // For wins >= 10x bet
    bigWinMultiplier: 10,
    auraForHugeWin: 50, // For wins >= 50x bet
    hugeWinMultiplier: 50,
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
    
    const isNewHighScore = !currentStats || score > currentStats.highScore;
    // Calculate rewards
    let auraReward = 0;
    let moneyReward = 0;
    
    if (gameType === 'doodle_jump') {
      const rewards = calculateDoodleJumpRewards(score, isNewHighScore);
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
      orderBy: { highScore: 'desc' },
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
