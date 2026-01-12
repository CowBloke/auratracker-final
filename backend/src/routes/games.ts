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
    const { score, won, duration } = req.body;
    
    // Get current stats
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
    
    // Emit balance update
    if (auraReward > 0 || moneyReward > 0) {
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
      where: { gameType },
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

export default router;
