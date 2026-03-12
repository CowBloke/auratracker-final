import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get detailed solitaire stats for a user
router.get('/stats/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const stats = await prisma.gameStats.findUnique({
      where: {
        userId_gameType: {
          userId,
          gameType: 'solitaire',
        },
      },
    });

    if (!stats) {
      return res.json({
        stats: {
          userId,
          gameType: 'solitaire',
          wins: 0,
          losses: 0,
          highScore: 0,
          totalPlayed: 0,
          winRate: 0,
        },
      });
    }

    const winRate = stats.totalPlayed > 0 
      ? Math.round((stats.wins / stats.totalPlayed) * 100) 
      : 0;

    res.json({
      stats: {
        ...stats,
        winRate,
      },
    });
  } catch (error) {
    console.error('Get solitaire stats error:', error);
    res.status(500).json({ error: 'Failed to get solitaire stats' });
  }
});

// Get solitaire leaderboard with additional details
router.get('/leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '20', sortBy = 'highScore' } = req.query;

    let orderBy: { highScore?: 'desc'; wins?: 'desc' } = { highScore: 'desc' };
    if (sortBy === 'wins') {
      orderBy = { wins: 'desc' };
    }

    const rankings = await prisma.gameStats.findMany({
      where: { 
        gameType: 'solitaire',
        user: { isSuperAdmin: false },
      },
      orderBy,
      take: parseInt(limit as string),
      include: {
        user: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
            profilePicture: true,
          },
        },
      },
    });

    const formattedRankings = rankings.map((s, i) => ({
      rank: i + 1,
      userId: s.userId,
      username: s.user.username,
      usernameColor: s.user.usernameColor,
      profilePicture: s.user.profilePicture,
      highScore: s.highScore,
      wins: s.wins,
      losses: s.losses,
      totalPlayed: s.totalPlayed,
      winRate: s.totalPlayed > 0 ? Math.round((s.wins / s.totalPlayed) * 100) : 0,
    }));

    // Get current user's rank if authenticated
    let userStats = null;
    if (req.user) {
      const stats = await prisma.gameStats.findUnique({
        where: {
          userId_gameType: {
            userId: req.user.id,
            gameType: 'solitaire',
          },
        },
      });

      if (stats) {
        const higherScores = await prisma.gameStats.count({
          where: {
            gameType: 'solitaire',
            highScore: { gt: stats.highScore },
            user: { isSuperAdmin: false },
          },
        });

        userStats = {
          rank: higherScores + 1,
          highScore: stats.highScore,
          wins: stats.wins,
          losses: stats.losses,
          totalPlayed: stats.totalPlayed,
          winRate: stats.totalPlayed > 0 ? Math.round((stats.wins / stats.totalPlayed) * 100) : 0,
        };
      }
    }

    res.json({ rankings: formattedRankings, userStats });
  } catch (error) {
    console.error('Get solitaire leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get solitaire leaderboard' });
  }
});

// Get global solitaire statistics
router.get('/global-stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const aggregateStats = await prisma.gameStats.aggregate({
      where: { gameType: 'solitaire' },
      _sum: {
        wins: true,
        losses: true,
        totalPlayed: true,
      },
      _max: {
        highScore: true,
      },
      _count: {
        userId: true,
      },
    });

    const totalWins = aggregateStats._sum.wins || 0;
    const totalLosses = aggregateStats._sum.losses || 0;
    const totalPlayed = aggregateStats._sum.totalPlayed || 0;
    const globalWinRate = totalPlayed > 0 
      ? Math.round((totalWins / totalPlayed) * 100) 
      : 0;

    res.json({
      stats: {
        totalPlayers: aggregateStats._count.userId,
        totalGamesPlayed: totalPlayed,
        totalWins,
        totalLosses,
        globalWinRate,
        highestScore: aggregateStats._max.highScore || 0,
      },
    });
  } catch (error) {
    console.error('Get global solitaire stats error:', error);
    res.status(500).json({ error: 'Failed to get global solitaire stats' });
  }
});

export default router;
