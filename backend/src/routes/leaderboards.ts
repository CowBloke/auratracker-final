import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

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

const router = Router();

type Period = 'daily' | 'weekly' | 'monthly';

// Game types that can be filtered by period via game_complete logs
const PERIOD_GAME_TYPES = new Set([
  'doodle_jump', 'doodle_jump_mort_subite', 'game_2048', 'flappy_bird',
  'chrome_dino', 'solitaire', 'racer', 'tetris', 'knife_hit', 'minesweeper', 'casino',
]);

const SCORE_GAME_CATEGORIES = {
  doodle_jump: { gameType: 'doodle_jump', order: 'desc' as const },
  doodle_jump_mort_subite: { gameType: 'doodle_jump_mort_subite', order: 'desc' as const },
  game_2048: { gameType: 'game_2048', order: 'desc' as const },
  flappy_bird: { gameType: 'flappy_bird', order: 'desc' as const },
  chrome_dino: { gameType: 'chrome_dino', order: 'desc' as const },
  solitaire: { gameType: 'solitaire', order: 'desc' as const },
  racer: { gameType: 'racer', order: 'asc' as const },
  tetris: { gameType: 'tetris', order: 'desc' as const },
  knife_hit: { gameType: 'knife_hit', order: 'desc' as const },
  minesweeper: { gameType: 'minesweeper', order: 'desc' as const },
  casino: { gameType: 'casino', order: 'desc' as const },
} as const;

const WIN_GAME_CATEGORIES = {
  chess: 'chess',
  petit_bac: 'petit_bac',
  puissance_4: 'puissance_4',
  ball_arena: 'ball_arena',
  poker: 'poker',
  battleship: 'battleship',
  russian_roulette: 'russian_roulette',
  uno: 'uno',
  morpion: 'morpion',
} as const;

function getPeriodStart(period: Period): Date {
  const now = new Date();
  if (period === 'daily') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  } else if (period === 'weekly') {
    const day = now.getUTCDay(); // 0=Sun
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
    return monday;
  } else {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
}

async function getPeriodGameRankings(
  gameType: string,
  periodStart: Date,
  ascending = false,
): Promise<{ userId: string; username: string; usernameColor: string | null; value: number }[]> {
  const logs = await prisma.log.findMany({
    where: {
      type: 'GAME',
      action: 'game_complete',
      createdAt: { gte: periodStart },
      userId: { not: null },
      metadata: { not: null },
    },
    select: {
      userId: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const bestByUser = new Map<string, { value: number; achievedAt: Date }>();
  for (const log of logs) {
    if (!log.userId || !log.metadata) continue;

    try {
      const metadata = JSON.parse(log.metadata) as { gameType?: unknown; score?: unknown };
      if (metadata.gameType !== gameType) continue;

      const score = Number(metadata.score);
      if (!Number.isFinite(score)) continue;

      const currentBest = bestByUser.get(log.userId);
      const isBetterScore = currentBest
        ? ascending
          ? score < currentBest.value
          : score > currentBest.value
        : false;
      const isSameScoreEarlier = currentBest && score === currentBest.value && log.createdAt < currentBest.achievedAt;

      if (!currentBest || isBetterScore || isSameScoreEarlier) {
        bestByUser.set(log.userId, { value: score, achievedAt: log.createdAt });
      }
    } catch {
      continue;
    }
  }

  const userIds = Array.from(bestByUser.keys());
  if (userIds.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      isSuperAdmin: false,
    },
    select: {
      id: true,
      username: true,
      usernameColor: true,
    },
  });
  const userMap = new Map(users.map((user) => [user.id, user]));

  return userIds
    .filter((userId) => userMap.has(userId))
    .map((userId) => ({
      userId,
      username: userMap.get(userId)!.username,
      usernameColor: userMap.get(userId)!.usernameColor,
      value: bestByUser.get(userId)!.value,
      achievedAt: bestByUser.get(userId)!.achievedAt,
    }))
    .sort((a, b) => {
      if (a.value !== b.value) {
        return ascending ? a.value - b.value : b.value - a.value;
      }
      if (a.achievedAt.getTime() !== b.achievedAt.getTime()) {
        return a.achievedAt.getTime() - b.achievedAt.getTime();
      }
      return a.username.localeCompare(b.username, 'fr');
    })
    .map(({ achievedAt: _achievedAt, ...ranking }) => ranking);
}

type LeaderboardCategory =
  | 'aura'
  | 'money'
  | 'total_money'
  | 'doodle_jump'
  | 'doodle_jump_mort_subite'
  | 'game_2048'
  | 'flappy_bird'
  | 'chrome_dino'
  | 'solitaire'
  | 'racer'
  | 'tetris'
  | 'knife_hit'
  | 'minesweeper'
  | 'casino'
  | 'casino_losses'
  | 'chess'
  | 'petit_bac'
  | 'puissance_4'
  | 'ball_arena'
  | 'poker'
  | 'battleship'
  | 'russian_roulette'
  | 'uno'
  | 'morpion'
  | 'polymarket_ratio'
  | 'games_played'
  | 'bombparty';

// Get leaderboard by category
router.get('/:category', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.params as { category: LeaderboardCategory };
    const { limit = '50', offset = '0', period } = req.query;

    let rankings: any[] = [];
    let totalMoneyPrice: number | null = null;
    const scoreCategoryConfig = SCORE_GAME_CATEGORIES[category as keyof typeof SCORE_GAME_CATEGORIES];
    const winGameType = WIN_GAME_CATEGORIES[category as keyof typeof WIN_GAME_CATEGORIES];

    // Period-filtered leaderboard for score-based games
    if (period && (period === 'daily' || period === 'weekly' || period === 'monthly') && PERIOD_GAME_TYPES.has(category)) {
      const periodStart = getPeriodStart(period as Period);
      const ascending = category === 'racer';
      const take = parseInt(limit as string);
      const skip = parseInt(offset as string);
      const allPeriodRankings = await getPeriodGameRankings(category, periodStart, ascending);
      const visiblePeriodRankings = allPeriodRankings.slice(skip, skip + take);
      rankings = visiblePeriodRankings.map((r, i) => ({
        rank: skip + i + 1,
        userId: r.userId,
        username: r.username,
        usernameColor: r.usernameColor,
        value: r.value,
      }));

      if (rankings.length > 0) {
        const rankedUserIds = rankings.map((r: any) => r.userId);
        const [badgeUsers, clanMemberships] = await Promise.all([
          prisma.user.findMany({
            where: { id: { in: rankedUserIds } },
            select: {
              id: true,
              equippedBadge1: { select: BADGE_SELECT },
              equippedBadge2: { select: BADGE_SELECT },
            },
          }),
          prisma.clanMember.findMany({
            where: { userId: { in: rankedUserIds } },
            select: {
              userId: true,
              clan: { select: { tagUnlocked: true, tagText: true, tagStyle: true } },
            },
          }),
        ]);
        const badgeMap = new Map(badgeUsers.map((u) => [
          u.id,
          [...(u.equippedBadge1 ? [u.equippedBadge1] : []), ...(u.equippedBadge2 ? [u.equippedBadge2] : [])],
        ]));
        const clanTagMap = new Map<string, { text: string; style: string | null }>();
        for (const m of clanMemberships) {
          if (m.clan?.tagUnlocked && m.clan?.tagText) {
            clanTagMap.set(m.userId, { text: m.clan.tagText, style: m.clan.tagStyle });
          }
        }
        rankings = rankings.map((r: any) => ({
          ...r,
          badges: badgeMap.get(r.userId) ?? [],
          clanTag: clanTagMap.get(r.userId) ?? null,
        }));
      }

      // User's own rank in the period
      let userRank = null;
      if (req.user) {
        const userIndex = allPeriodRankings.findIndex((r) => r.userId === req.user!.id);
        if (userIndex !== -1) {
          userRank = userIndex + 1;
        }
      }

      return res.json({ rankings, userRank });
    }

    if (winGameType) {
      rankings = await prisma.gameStats.findMany({
        where: { gameType: winGameType, user: { isSuperAdmin: false } },
        select: {
          userId: true,
          wins: true,
          losses: true,
          totalPlayed: true,
          user: {
            select: { username: true, usernameColor: true },
          },
        },
        orderBy: [
          { wins: 'desc' },
          { totalPlayed: 'desc' },
        ],
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
    } else if (scoreCategoryConfig) {
      rankings = await prisma.gameStats.findMany({
        where: { gameType: scoreCategoryConfig.gameType, user: { isSuperAdmin: false } },
        select: {
          userId: true,
          highScore: true,
          wins: true,
          totalPlayed: true,
          user: {
            select: { username: true, usernameColor: true },
          },
        },
        orderBy: { highScore: scoreCategoryConfig.order },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      });
      rankings = rankings.map((s, i) => ({
        rank: parseInt(offset as string) + i + 1,
        userId: s.userId,
        username: s.user.username,
        usernameColor: s.user.usernameColor,
        value: s.highScore,
        wins: category === 'solitaire' ? s.wins : undefined,
        totalPlayed: category === 'solitaire' ? s.totalPlayed : undefined,
      }));
    } else switch (category) {
      case 'aura':
        rankings = await prisma.user.findMany({
          where: { isSuperAdmin: false },
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
          where: { isSuperAdmin: false },
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
          WHERE isSuperAdmin = 0
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
        
      case 'polymarket_ratio': {
        const resolvedBets = await prisma.polymarketBet.findMany({
          where: {
            event: { status: 'RESOLVED' },
            user: { isSuperAdmin: false },
          },
          select: {
            userId: true,
            payout: true,
            user: {
              select: { username: true, usernameColor: true },
            },
          },
        });

        const statsByUser = new Map<string, {
          username: string;
          usernameColor: string | null;
          wins: number;
          losses: number;
        }>();

        for (const bet of resolvedBets) {
          const current = statsByUser.get(bet.userId) ?? {
            username: bet.user.username,
            usernameColor: bet.user.usernameColor,
            wins: 0,
            losses: 0,
          };
          if (bet.payout !== null) current.wins += 1;
          else current.losses += 1;
          statsByUser.set(bet.userId, current);
        }

        const take = parseInt(limit as string);
        const skip = parseInt(offset as string);
        const sorted = Array.from(statsByUser.entries())
          .filter(([, stat]) => stat.wins + stat.losses > 0)
          .map(([userId, stat]) => ({
            userId,
            username: stat.username,
            usernameColor: stat.usernameColor,
            wins: stat.wins,
            losses: stat.losses,
            value: stat.losses === 0 ? stat.wins : stat.wins / stat.losses,
          }))
          .sort((a, b) => {
            if (b.value !== a.value) return b.value - a.value;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return a.losses - b.losses;
          });

        rankings = sorted.slice(skip, skip + take).map((entry, i) => ({
          rank: skip + i + 1,
          ...entry,
        }));
        break;
      }
        
      case 'casino_losses': {
        // Get all non-admin user IDs first
        const nonAdminUsers = await prisma.user.findMany({
          where: { isSuperAdmin: false },
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
          where: { id: { in: userIds }, isSuperAdmin: false },
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
          where: { user: { isSuperAdmin: false } },
          _sum: { totalPlayed: true },
          orderBy: { _sum: { totalPlayed: 'desc' } },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
        });
        
        const userIds = userGames.map((g) => g.userId);
        const users = await prisma.user.findMany({
          where: { id: { in: userIds }, isSuperAdmin: false },
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
          where: { user: { isSuperAdmin: false } },
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
    
    // Batch-fetch equipped badges and clan tags for all ranked users
    if (rankings.length > 0) {
      const rankedUserIds = rankings.map((r: any) => r.userId);
      const [badgeUsers, clanMemberships] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: rankedUserIds } },
          select: {
            id: true,
            equippedBadge1: { select: BADGE_SELECT },
            equippedBadge2: { select: BADGE_SELECT },
          },
        }),
        prisma.clanMember.findMany({
          where: { userId: { in: rankedUserIds } },
          select: {
            userId: true,
            clan: { select: { tagUnlocked: true, tagText: true, tagStyle: true } },
          },
        }),
      ]);
      const badgeMap = new Map(badgeUsers.map((u) => [
        u.id,
        [
          ...(u.equippedBadge1 ? [u.equippedBadge1] : []),
          ...(u.equippedBadge2 ? [u.equippedBadge2] : []),
        ],
      ]));
      const clanTagMap = new Map<string, { text: string; style: string | null }>();
      for (const m of clanMemberships) {
        if (m.clan?.tagUnlocked && m.clan?.tagText) {
          clanTagMap.set(m.userId, { text: m.clan.tagText, style: m.clan.tagStyle });
        }
      }
      rankings = rankings.map((r: any) => ({
        ...r,
        badges: badgeMap.get(r.userId) ?? [],
        clanTag: clanTagMap.get(r.userId) ?? null,
      }));
    }

    // Get current user's rank if authenticated
    let userRank = null;
    if (req.user) {
      const userInRankings = rankings.find((r) => r.userId === req.user!.id);
      if (userInRankings) {
        userRank = userInRankings.rank;
      } else if (scoreCategoryConfig) {
        const userStats = await prisma.gameStats.findUnique({
          where: {
            userId_gameType: {
              userId: req.user.id,
              gameType: scoreCategoryConfig.gameType,
            },
          },
        });
        if (userStats) {
          const betterScores = await prisma.gameStats.count({
            where: {
              gameType: scoreCategoryConfig.gameType,
              highScore: scoreCategoryConfig.order === 'asc'
                ? { lt: userStats.highScore }
                : { gt: userStats.highScore },
              user: { isSuperAdmin: false },
            },
          });
          userRank = betterScores + 1;
        }
      } else if (winGameType) {
        const userStats = await prisma.gameStats.findUnique({
          where: {
            userId_gameType: {
              userId: req.user.id,
              gameType: winGameType,
            },
          },
        });
        if (userStats) {
          const higherWins = await prisma.gameStats.count({
            where: {
              gameType: winGameType,
              wins: { gt: userStats.wins },
              user: { isSuperAdmin: false },
            },
          });
          userRank = higherWins + 1;
        }
      } else if (category === 'bombparty') {
        const userStats = await prisma.bombPartyStats.findUnique({
          where: { userId: req.user.id },
        });
        if (userStats) {
          const higherWins = await prisma.bombPartyStats.count({
            where: {
              wins: { gt: userStats.wins },
              user: { isSuperAdmin: false },
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
            WHERE isSuperAdmin = 0
              AND (money + auraCoinBalance * ${priceToUse}) > ${userTotalValue}
          `;
          userRank = Number(higherTotals[0]?.count ?? 0) + 1;
        }
      } else if (category === 'polymarket_ratio') {
        const userResolvedBets = await prisma.polymarketBet.findMany({
          where: {
            userId: req.user.id,
            event: { status: 'RESOLVED' },
          },
          select: { payout: true },
        });

        if (userResolvedBets.length > 0) {
          const userWins = userResolvedBets.filter((bet) => bet.payout !== null).length;
          const userLosses = userResolvedBets.length - userWins;
          const userRatio = userLosses === 0 ? userWins : userWins / userLosses;

          const allResolvedBets = await prisma.polymarketBet.findMany({
            where: {
              event: { status: 'RESOLVED' },
              user: { isSuperAdmin: false },
            },
            select: { userId: true, payout: true },
          });

          const ratiosByUser = new Map<string, { wins: number; losses: number }>();
          for (const bet of allResolvedBets) {
            const current = ratiosByUser.get(bet.userId) ?? { wins: 0, losses: 0 };
            if (bet.payout !== null) current.wins += 1;
            else current.losses += 1;
            ratiosByUser.set(bet.userId, current);
          }

          const betterUsers = Array.from(ratiosByUser.values()).filter((entry) => {
            const ratio = entry.losses === 0 ? entry.wins : entry.wins / entry.losses;
            if (ratio !== userRatio) return ratio > userRatio;
            if (entry.wins !== userWins) return entry.wins > userWins;
            return entry.losses < userLosses;
          }).length;
          userRank = betterUsers + 1;
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
            where: { isSuperAdmin: false },
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
      where: { aura: { gt: user.aura }, isSuperAdmin: false },
    }) + 1;
    
    const moneyRank = await prisma.user.count({
      where: { money: { gt: user.money }, isSuperAdmin: false },
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
              user: { isSuperAdmin: false },
            }
          : {
              gameType: stat.gameType,
              highScore: { gt: stat.highScore },
              user: { isSuperAdmin: false },
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
          user: { isSuperAdmin: false },
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
