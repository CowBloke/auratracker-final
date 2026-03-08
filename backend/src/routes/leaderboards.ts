import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

type LeaderboardCategory =
  | 'aura'
  | 'money'
  | 'total_money'
  | 'doodle_jump'
  | 'doodle_jump_mort_subite'
  | 'game_2048'
  | 'flappy_bird'
  | 'solitaire'
  | 'racer'
  | 'tetris'
  | 'knife_hit'
  | 'minesweeper'
  | 'casino'
  | 'casino_losses'
  | 'games_played'
  | 'bombparty';

// Get leaderboard by category
router.get('/:category', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.params as { category: LeaderboardCategory };
    const { limit = '50', offset = '0' } = req.query;
    
    let rankings: any[] = [];
    let totalMoneyPrice: number | null = null;
    
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

      case 'total_money': {
        const latestPrice = await prisma.auraCoinPrice.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { price: true },
        });
        totalMoneyPrice = latestPrice?.price ?? 100;
        const take = parseInt(limit as string);
        const skip = parseInt(offset as string);
        const totals = await prisma.$queryRaw<
          {
            id: string;
            username: string;
            usernameColor: string | null;
            money: number;
            auraCoinBalance: number;
            total: number;
          }[]
        >`
          SELECT
            id,
            username,
            usernameColor,
            money,
            auraCoinBalance,
            (money + auraCoinBalance * ${totalMoneyPrice}) as total
          FROM "User"
          WHERE isAdmin = 0
          ORDER BY total DESC
          LIMIT ${take} OFFSET ${skip}
        `;
        rankings = totals.map((u, i) => ({
          rank: skip + i + 1,
          userId: u.id,
          username: u.username,
          usernameColor: u.usernameColor,
          value: Number(u.total),
        }));
        break;
      }
        
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

      case 'doodle_jump_mort_subite':
        rankings = await prisma.gameStats.findMany({
          where: { gameType: 'doodle_jump_mort_subite', user: { isAdmin: false } },
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
        
      case 'game_2048':
        rankings = await prisma.gameStats.findMany({
          where: { gameType: 'game_2048', user: { isAdmin: false } },
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
        
      case 'flappy_bird':
        rankings = await prisma.gameStats.findMany({
          where: { gameType: 'flappy_bird', user: { isAdmin: false } },
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
        rankings = await prisma.gameStats.findMany({
          where: { gameType: 'solitaire', user: { isAdmin: false } },
          select: {
            userId: true,
            highScore: true,
            wins: true,
            totalPlayed: true,
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
          wins: s.wins,
          totalPlayed: s.totalPlayed,
        }));
        break;

      case 'racer':
        rankings = await prisma.gameStats.findMany({
          where: { gameType: 'racer', user: { isAdmin: false } },
          select: {
            userId: true,
            highScore: true,
            user: {
              select: { username: true, usernameColor: true },
            },
          },
          orderBy: { highScore: 'asc' },
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

      case 'tetris':
        rankings = await prisma.gameStats.findMany({
          where: { gameType: 'tetris', user: { isAdmin: false } },
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

      case 'knife_hit':
        rankings = await prisma.gameStats.findMany({
          where: { gameType: 'knife_hit', user: { isAdmin: false } },
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

      case 'minesweeper':
        rankings = await prisma.gameStats.findMany({
          where: { gameType: 'minesweeper', user: { isAdmin: false } },
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

      case 'casino_losses': {
        // Get all non-admin user IDs first
        const nonAdminUsers = await prisma.user.findMany({
          where: { isAdmin: false },
          select: { id: true },
        });
        const nonAdminUserIds = new Set(nonAdminUsers.map((u) => u.id));

        // Get all casino bet logs and calculate total losses per user
        const casinoLogs = await prisma.log.findMany({
          where: {
            type: 'GAME',
            action: 'casino_bet',
            userId: { not: null },
          },
          select: {
            userId: true,
            metadata: true,
          },
        });

        // Calculate total losses per user (netGain is negative for losses)
        const lossesByUser = new Map<string, number>();
        for (const log of casinoLogs) {
          if (!log.userId || !log.metadata || !nonAdminUserIds.has(log.userId)) continue;
          try {
            const metadata = JSON.parse(log.metadata);
            const netGain = metadata.netGain ?? 0;
            // netGain is negative for losses, so we sum the absolute value of negative netGains
            // or equivalently, subtract positive netGains from losses
            const currentLosses = lossesByUser.get(log.userId) ?? 0;
            if (netGain < 0) {
              lossesByUser.set(log.userId, currentLosses + Math.abs(netGain));
            }
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }

        // Get user info for users with losses
        const userIds = Array.from(lossesByUser.keys());
        if (userIds.length === 0) {
          rankings = [];
          break;
        }
        const users = await prisma.user.findMany({
          where: { id: { in: userIds }, isAdmin: false },
          select: { id: true, username: true, usernameColor: true },
        });
        const userMap = new Map(users.map((u) => [u.id, { username: u.username, usernameColor: u.usernameColor }]));

        // Create rankings sorted by losses (descending)
        const lossEntries = Array.from(lossesByUser.entries())
          .map(([userId, losses]) => ({
            userId,
            losses,
            username: userMap.get(userId)?.username || 'Unknown',
            usernameColor: userMap.get(userId)?.usernameColor || null,
          }))
          .sort((a, b) => b.losses - a.losses);

        const take = parseInt(limit as string);
        const skip = parseInt(offset as string);
        rankings = lossEntries.slice(skip, skip + take).map((entry, i) => ({
          rank: skip + i + 1,
          userId: entry.userId,
          username: entry.username,
          usernameColor: entry.usernameColor,
          value: entry.losses,
        }));
        break;
      }
        
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

      case 'bombparty':
        rankings = await prisma.bombPartyStats.findMany({
          where: { user: { isAdmin: false } },
          select: {
            userId: true,
            wins: true,
            losses: true,
            totalPlayed: true,
            user: {
              select: { username: true, usernameColor: true },
            },
          },
          orderBy: { wins: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        });
        rankings = rankings.map((s, i) => ({
          rank: parseInt(offset as string) + i + 1,
          userId: s.userId,
          username: s.user.username,
          usernameColor: s.user.usernameColor,
          value: s.wins,
          wins: s.wins,
          losses: s.losses,
          totalPlayed: s.totalPlayed,
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
      } else if (category === 'doodle_jump_mort_subite') {
        // Calculate user's rank even if not in top rankings
        const userStats = await prisma.gameStats.findUnique({
          where: {
            userId_gameType: {
              userId: req.user.id,
              gameType: 'doodle_jump_mort_subite',
            },
          },
        });
        if (userStats) {
          const higherScores = await prisma.gameStats.count({
            where: {
              gameType: 'doodle_jump_mort_subite',
              highScore: { gt: userStats.highScore },
              user: { isAdmin: false },
            },
          });
          userRank = higherScores + 1;
        }
      } else if (category === 'game_2048') {
        // Calculate user's rank even if not in top rankings
        const userStats = await prisma.gameStats.findUnique({
          where: {
            userId_gameType: {
              userId: req.user.id,
              gameType: 'game_2048',
            },
          },
        });
        if (userStats) {
          const higherScores = await prisma.gameStats.count({
            where: {
              gameType: 'game_2048',
              highScore: { gt: userStats.highScore },
              user: { isAdmin: false },
            },
          });
          userRank = higherScores + 1;
        }
      } else if (category === 'racer') {
        const userStats = await prisma.gameStats.findUnique({
          where: {
            userId_gameType: {
              userId: req.user.id,
              gameType: 'racer',
            },
          },
        });
        if (userStats) {
          const lowerTimes = await prisma.gameStats.count({
            where: {
              gameType: 'racer',
              highScore: { lt: userStats.highScore },
              user: { isAdmin: false },
            },
          });
          userRank = lowerTimes + 1;
        }
      } else if (category === 'tetris') {
        const userStats = await prisma.gameStats.findUnique({
          where: {
            userId_gameType: {
              userId: req.user.id,
              gameType: 'tetris',
            },
          },
        });
        if (userStats) {
          const higherScores = await prisma.gameStats.count({
            where: {
              gameType: 'tetris',
              highScore: { gt: userStats.highScore },
              user: { isAdmin: false },
            },
          });
          userRank = higherScores + 1;
        }
      } else if (category === 'knife_hit') {
        const userStats = await prisma.gameStats.findUnique({
          where: {
            userId_gameType: {
              userId: req.user.id,
              gameType: 'knife_hit',
            },
          },
        });
        if (userStats) {
          const higherScores = await prisma.gameStats.count({
            where: {
              gameType: 'knife_hit',
              highScore: { gt: userStats.highScore },
              user: { isAdmin: false },
            },
          });
          userRank = higherScores + 1;
        }
      } else if (category === 'minesweeper') {
        const userStats = await prisma.gameStats.findUnique({
          where: {
            userId_gameType: {
              userId: req.user.id,
              gameType: 'minesweeper',
            },
          },
        });
        if (userStats) {
          const higherScores = await prisma.gameStats.count({
            where: {
              gameType: 'minesweeper',
              highScore: { gt: userStats.highScore },
              user: { isAdmin: false },
            },
          });
          userRank = higherScores + 1;
        }
      } else if (category === 'bombparty') {
        const userStats = await prisma.bombPartyStats.findUnique({
          where: { userId: req.user.id },
        });
        if (userStats) {
          const higherWins = await prisma.bombPartyStats.count({
            where: {
              wins: { gt: userStats.wins },
              user: { isAdmin: false },
            },
          });
          userRank = higherWins + 1;
        }
      } else if (category === 'total_money') {
        const priceToUse = totalMoneyPrice ?? 100;
        const userTotals = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { money: true, auraCoinBalance: true },
        });
        if (userTotals) {
          const userTotalValue = userTotals.money + userTotals.auraCoinBalance * priceToUse;
          const higherTotals = await prisma.$queryRaw<{ count: number }[]>`
            SELECT COUNT(*) as count
            FROM "User"
            WHERE isAdmin = 0
              AND (money + auraCoinBalance * ${priceToUse}) > ${userTotalValue}
          `;
          userRank = Number(higherTotals[0]?.count ?? 0) + 1;
        }
      } else if (category === 'casino_losses') {
        // Calculate user's total casino losses
        const casinoLogs = await prisma.log.findMany({
          where: {
            type: 'GAME',
            action: 'casino_bet',
            userId: req.user.id,
          },
          select: {
            metadata: true,
          },
        });

        let userTotalLosses = 0;
        for (const log of casinoLogs) {
          if (!log.metadata) continue;
          try {
            const metadata = JSON.parse(log.metadata);
            const netGain = metadata.netGain ?? 0;
            if (netGain < 0) {
              userTotalLosses += Math.abs(netGain);
            }
          } catch (e) {
            continue;
          }
        }

        if (userTotalLosses > 0) {
          // Get all non-admin user IDs first
          const nonAdminUsers = await prisma.user.findMany({
            where: { isAdmin: false },
            select: { id: true },
          });
          const nonAdminUserIds = new Set(nonAdminUsers.map((u) => u.id));

          // Count users with higher losses
          const allCasinoLogs = await prisma.log.findMany({
            where: {
              type: 'GAME',
              action: 'casino_bet',
              userId: { not: null },
            },
            select: {
              userId: true,
              metadata: true,
            },
          });

          const lossesByUser = new Map<string, number>();
          for (const log of allCasinoLogs) {
            if (!log.userId || !log.metadata || !nonAdminUserIds.has(log.userId)) continue;
            try {
              const metadata = JSON.parse(log.metadata);
              const netGain = metadata.netGain ?? 0;
              if (netGain < 0) {
                const currentLosses = lossesByUser.get(log.userId) ?? 0;
                lossesByUser.set(log.userId, currentLosses + Math.abs(netGain));
              }
            } catch (e) {
              continue;
            }
          }

          const higherLosses = Array.from(lossesByUser.values()).filter(
            (losses) => losses > userTotalLosses
          ).length;
          userRank = higherLosses + 1;
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
      const betterScoreWhere =
        stat.gameType === 'racer'
          ? {
              gameType: stat.gameType,
              highScore: { lt: stat.highScore },
              user: { isAdmin: false },
            }
          : {
              gameType: stat.gameType,
              highScore: { gt: stat.highScore },
              user: { isAdmin: false },
            };

      const betterScores = await prisma.gameStats.count({
        where: betterScoreWhere,
      });
      
      rankings[stat.gameType] = {
        highScore: stat.highScore,
        rank: betterScores + 1,
        wins: stat.wins,
        losses: stat.losses,
        totalPlayed: stat.totalPlayed,
      };
    }

    const bombPartyStats = await prisma.bombPartyStats.findUnique({
      where: { userId },
    });

    if (bombPartyStats) {
      const higherWins = await prisma.bombPartyStats.count({
        where: {
          wins: { gt: bombPartyStats.wins },
          user: { isAdmin: false },
        },
      });

      rankings.bombparty = {
        wins: bombPartyStats.wins,
        losses: bombPartyStats.losses,
        totalPlayed: bombPartyStats.totalPlayed,
        wordsTyped: bombPartyStats.wordsTyped,
        longestWord: bombPartyStats.longestWord,
        rank: higherWins + 1,
      };
    }
    
    res.json({ userId, username: user.username, rankings });
  } catch (error) {
    console.error('Get user rankings error:', error);
    res.status(500).json({ error: 'Failed to get user rankings' });
  }
});

export default router;
