import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, gameCompleteSchema } from '../middleware/validation.js';

const router = Router();

// Game reward configuration
const GAME_REWARDS = {
  doodle_jump: {
    moneyPerScore: 0.1, // 1 money per 10 score
    auraForNewHighScore: 50,
    minScoreForReward: 100,
  },
  solitaire: {
    moneyPerWin: 100,
    auraForFastWin: 25, // Under 3 minutes
    fastWinThreshold: 180, // seconds
  },
  casino: {
    auraForBigWin: 10, // For wins >= 10x bet
    bigWinMultiplier: 10,
    auraForHugeWin: 50, // For wins >= 50x bet
    hugeWinMultiplier: 50,
  },
};

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
        fastestWin: null,
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
    const isFastWin = won && duration && duration < (GAME_REWARDS.solitaire?.fastWinThreshold || 180);
    
    // Calculate rewards
    let auraReward = 0;
    let moneyReward = 0;
    
    if (gameType === 'doodle_jump') {
      const config = GAME_REWARDS.doodle_jump;
      if (score >= config.minScoreForReward) {
        moneyReward = Math.floor(score * config.moneyPerScore);
      }
      if (isNewHighScore && score >= config.minScoreForReward) {
        auraReward = config.auraForNewHighScore;
      }
    } else if (gameType === 'solitaire') {
      const config = GAME_REWARDS.solitaire;
      if (won) {
        moneyReward = config.moneyPerWin;
        if (isFastWin) {
          auraReward = config.auraForFastWin;
        }
      }
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
          fastestWin: won && duration ? duration : null,
        },
        update: {
          wins: won ? { increment: 1 } : undefined,
          losses: !won ? { increment: 1 } : undefined,
          highScore: isNewHighScore ? score : undefined,
          totalPlayed: { increment: 1 },
          fastestWin: won && duration && (!currentStats?.fastestWin || duration < currentStats.fastestWin)
            ? duration
            : undefined,
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

    // Delete the game stats record
    await prisma.gameStats.delete({
      where: {
        userId_gameType: {
          userId,
          gameType,
        },
      },
    });

    res.json({ success: true, message: 'Game stats deleted successfully' });
  } catch (error) {
    console.error('Delete game stats error:', error);
    res.status(500).json({ error: 'Failed to delete game stats' });
  }
});

export default router;
