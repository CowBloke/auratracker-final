import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

type LeaderboardCategory = 'aura' | 'money' | 'doodle_jump' | 'solitaire' | 'casino' | 'games_played';

// Get leaderboard by category
router.get('/:category', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.params as { category: LeaderboardCategory };
    const { limit = '50', offset = '0' } = req.query;
    
    let rankings: any[] = [];
    
    switch (category) {
      case 'aura':
        rankings = await prisma.user.findMany({
          where: { isAdmin: false },
          select: {
            id: true,
            username: true,
            usernameColor: true,
            aura: true,
          },
          orderBy: { aura: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        });
        rankings = rankings.map((u, i) => ({
          rank: parseInt(offset as string) + i + 1,
          userId: u.id,
          username: u.username,
          usernameColor: u.usernameColor,
          value: u.aura,
        }));
        break;
        
      case 'money':
        rankings = await prisma.user.findMany({
          where: { isAdmin: false },
          select: {
            id: true,
            username: true,
            usernameColor: true,
            money: true,
          },
          orderBy: { money: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        });
        rankings = rankings.map((u, i) => ({
          rank: parseInt(offset as string) + i + 1,
          userId: u.id,
          username: u.username,
          usernameColor: u.usernameColor,
          value: u.money,
        }));
        break;
        
      case 'doodle_jump':
        rankings = await prisma.gameStats.findMany({
          where: { gameType: 'doodle_jump', user: { isAdmin: false } },
          select: {
            userId: true,
            highScore: true,
            user: {
              select: { username: true, usernameColor: true },
            },
          },
          orderBy: { highScore: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        });
        rankings = rankings.map((s, i) => ({
          rank: parseInt(offset as string) + i + 1,
          userId: s.userId,
          username: s.user.username,
          usernameColor: s.user.usernameColor,
          value: s.highScore,
        }));
        break;
        
      case 'solitaire':
        // Win rate leaderboard (minimum 10 games)
        rankings = await prisma.gameStats.findMany({
          where: {
            gameType: 'solitaire',
            totalPlayed: { gte: 10 },
            user: { isAdmin: false },
          },
          select: {
            userId: true,
            wins: true,
            totalPlayed: true,
            user: {
              select: { username: true, usernameColor: true },
            },
          },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        });
        // Calculate win rate and sort
        rankings = rankings
          .map((s) => ({
            userId: s.userId,
            username: s.user.username,
            usernameColor: s.user.usernameColor,
            value: Math.round((s.wins / s.totalPlayed) * 100),
            wins: s.wins,
            totalPlayed: s.totalPlayed,
          }))
          .sort((a, b) => b.value - a.value)
          .map((r, i) => ({ ...r, rank: parseInt(offset as string) + i + 1 }));
        break;
        
      case 'casino':
        rankings = await prisma.gameStats.findMany({
          where: { gameType: 'casino', user: { isAdmin: false } },
          select: {
            userId: true,
            highScore: true,
            user: {
              select: { username: true, usernameColor: true },
            },
          },
          orderBy: { highScore: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        });
        rankings = rankings.map((s, i) => ({
          rank: parseInt(offset as string) + i + 1,
          userId: s.userId,
          username: s.user.username,
          usernameColor: s.user.usernameColor,
          value: s.highScore,
        }));
        break;
        
      case 'games_played':
        // Aggregate total games played across all game types
        const userGames = await prisma.gameStats.groupBy({
          by: ['userId'],
          where: { user: { isAdmin: false } },
          _sum: { totalPlayed: true },
          orderBy: { _sum: { totalPlayed: 'desc' } },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        });
        
        const userIds = userGames.map((g) => g.userId);
        const users = await prisma.user.findMany({
          where: { id: { in: userIds }, isAdmin: false },
          select: { id: true, username: true, usernameColor: true },
        });
        const userMap = new Map(users.map((u) => [u.id, { username: u.username, usernameColor: u.usernameColor }]));
        
        rankings = userGames.map((g, i) => ({
          rank: parseInt(offset as string) + i + 1,
          userId: g.userId,
          username: userMap.get(g.userId)?.username || 'Unknown',
          usernameColor: userMap.get(g.userId)?.usernameColor || null,
          value: g._sum.totalPlayed || 0,
        }));
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid category' });
    }
    
    // Get current user's rank if authenticated
    let userRank = null;
    if (req.user) {
      const userInRankings = rankings.find((r) => r.userId === req.user!.id);
      if (userInRankings) {
        userRank = userInRankings.rank;
      } else if (category === 'casino') {
        // Calculate user's rank even if not in top rankings
        const userStats = await prisma.gameStats.findUnique({
          where: {
            userId_gameType: {
              userId: req.user.id,
              gameType: 'casino',
            },
          },
        });
        if (userStats) {
          const higherScores = await prisma.gameStats.count({
            where: {
              gameType: 'casino',
              highScore: { gt: userStats.highScore },
              user: { isAdmin: false },
            },
          });
          userRank = higherScores + 1;
        }
      } else if (category === 'doodle_jump') {
        // Calculate user's rank even if not in top rankings
        const userStats = await prisma.gameStats.findUnique({
          where: {
            userId_gameType: {
              userId: req.user.id,
              gameType: 'doodle_jump',
            },
          },
        });
        if (userStats) {
          const higherScores = await prisma.gameStats.count({
            where: {
              gameType: 'doodle_jump',
              highScore: { gt: userStats.highScore },
              user: { isAdmin: false },
            },
          });
          userRank = higherScores + 1;
        }
      }
    }
    
    res.json({ rankings, userRank });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Get all rankings for a user
router.get('/user/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        aura: true,
        money: true,
      },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const gameStats = await prisma.gameStats.findMany({
      where: { userId },
    });
    
    // Calculate ranks
    const auraRank = await prisma.user.count({
      where: { aura: { gt: user.aura }, isAdmin: false },
    }) + 1;
    
    const moneyRank = await prisma.user.count({
      where: { money: { gt: user.money }, isAdmin: false },
    }) + 1;
    
    const rankings: Record<string, any> = {
      aura: { value: user.aura, rank: auraRank },
      money: { value: user.money, rank: moneyRank },
    };
    
    for (const stat of gameStats) {
      const higherScores = await prisma.gameStats.count({
        where: {
          gameType: stat.gameType,
          highScore: { gt: stat.highScore },
          user: { isAdmin: false },
        },
      });
      
      rankings[stat.gameType] = {
        highScore: stat.highScore,
        rank: higherScores + 1,
        wins: stat.wins,
        losses: stat.losses,
        totalPlayed: stat.totalPlayed,
      };
    }
    
    res.json({ userId, username: user.username, rankings });
  } catch (error) {
    console.error('Get user rankings error:', error);
    res.status(500).json({ error: 'Failed to get user rankings' });
  }
});

export default router;
