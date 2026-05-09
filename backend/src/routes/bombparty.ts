import { Router } from 'express';
import { prisma } from '../server.js';
import { authMiddleware } from '../middleware/auth.js';
import { getBombPartyWppSettings } from '../utils/bombparty-settings.js';

const router = Router();

// Get player stats
router.get('/stats/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const stats = await prisma.bombPartyStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      return res.json({
        wins: 0,
        losses: 0,
        totalPlayed: 0,
        wordsTyped: 0,
        longestWord: null,
      });
    }

    res.json(stats);
  } catch (error) {
    console.error('Get bomb party stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get leaderboard
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const rankings = await prisma.bombPartyStats.findMany({
      where: { user: { isSuperAdmin: false } },
      orderBy: { wins: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, username: true, usernameColor: true },
        },
      },
    });

    res.json({
      rankings: rankings.map((r, index) => ({
        rank: index + 1,
        userId: r.userId,
        username: r.user.username,
        usernameColor: r.user.usernameColor,
        wins: r.wins,
        losses: r.losses,
        totalPlayed: r.totalPlayed,
        wordsTyped: r.wordsTyped,
        longestWord: r.longestWord,
      })),
    });
  } catch (error) {
    console.error('Get bomb party leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Get prompt stats (for debugging/admin)
router.get('/prompts/stats', authMiddleware, async (req, res) => {
  try {
    const wpp = await getBombPartyWppSettings(prisma);

    const easy = await prisma.bombPartyPrompt.count({
      where: { wordCount: { gte: wpp.easy } },
    });
    const medium = await prisma.bombPartyPrompt.count({
      where: { wordCount: { gte: wpp.medium, lt: wpp.easy } },
    });
    const hard = await prisma.bombPartyPrompt.count({
      where: { wordCount: { gte: wpp.hard, lt: wpp.medium } },
    });

    res.json({
      total: easy + medium + hard,
      easy,
      medium,
      hard,
    });
  } catch (error) {
    console.error('Get prompt stats error:', error);
    res.status(500).json({ error: 'Failed to get prompt stats' });
  }
});

export default router;
