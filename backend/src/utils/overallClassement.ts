import { PrismaClient } from '@prisma/client';

const DEFAULT_OVERALL_CLASSEMENT_INTERVAL_MS = 15 * 60_000;

const WIN_BASED_GAME_TYPES = new Set([
  'chess',
  'petit_bac',
  'puissance_4',
  'ball_arena',
  'poker',
  'battleship',
  'russian_roulette',
  'levier_infernal',
  'uno',
  'morpion',
]);

type RankedEntry = {
  userId: string;
  metric: number;
  secondary?: number;
};

let overallClassementTimer: ReturnType<typeof setInterval> | null = null;

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const rankEntries = (entries: RankedEntry[], ascending: boolean): Map<string, number> => {
  const sorted = [...entries].sort((left, right) => {
    if (left.metric !== right.metric) {
      return ascending ? left.metric - right.metric : right.metric - left.metric;
    }
    const leftSecondary = left.secondary ?? 0;
    const rightSecondary = right.secondary ?? 0;
    if (leftSecondary !== rightSecondary) {
      return rightSecondary - leftSecondary;
    }
    return left.userId.localeCompare(right.userId, 'fr');
  });

  return new Map(sorted.map((entry, index) => [entry.userId, index + 1]));
};

const applyCategoryRanks = (
  totalScoreByUser: Map<string, number>,
  allUserIds: string[],
  rankMap: Map<string, number>,
  participantCount: number,
) => {
  if (participantCount === 0) {
    return false;
  }

  const missingPenalty = participantCount + 1;
  for (const userId of allUserIds) {
    const current = totalScoreByUser.get(userId) ?? 0;
    totalScoreByUser.set(userId, current + (rankMap.get(userId) ?? missingPenalty));
  }
  return true;
};

export const recomputeOverallClassement = async (prisma: PrismaClient): Promise<void> => {
  try {
    const [users, latestAuraCoinPrice, allGameStats, bombPartyStats, resolvedBets, casinoLogs] = await Promise.all([
      prisma.user.findMany({
        where: { isSuperAdmin: false },
        select: {
          id: true,
          aura: true,
          money: true,
          auraCoinBalance: true,
        },
      }),
      prisma.auraCoinPrice.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { price: true },
      }),
      prisma.gameStats.findMany({
        where: { user: { isSuperAdmin: false } },
        select: {
          userId: true,
          gameType: true,
          highScore: true,
          wins: true,
          totalPlayed: true,
        },
      }),
      prisma.bombPartyStats.findMany({
        where: { user: { isSuperAdmin: false } },
        select: {
          userId: true,
          wins: true,
          totalPlayed: true,
        },
      }),
      prisma.polymarketBet.findMany({
        where: {
          event: { status: 'RESOLVED' },
          user: { isSuperAdmin: false },
        },
        select: {
          userId: true,
          payout: true,
        },
      }),
      prisma.log.findMany({
        where: {
          type: 'GAME',
          action: 'casino_bet',
          userId: { not: null },
          metadata: { not: null },
        },
        select: {
          userId: true,
          metadata: true,
        },
      }),
    ]);

    if (users.length === 0) {
      return;
    }

    const allUserIds = users.map((user) => user.id);
    const validUserIds = new Set(allUserIds);
    const totalScoreByUser = new Map<string, number>();
    let categoryCount = 0;

    for (const userId of allUserIds) {
      totalScoreByUser.set(userId, 0);
    }

    const addCategory = (rankMap: Map<string, number>, participantCount: number) => {
      const applied = applyCategoryRanks(totalScoreByUser, allUserIds, rankMap, participantCount);
      if (applied) {
        categoryCount += 1;
      }
    };

    addCategory(
      rankEntries(users.map((user) => ({ userId: user.id, metric: Number(user.aura) })), false),
      users.length,
    );

    addCategory(
      rankEntries(users.map((user) => ({ userId: user.id, metric: user.money })), false),
      users.length,
    );

    const auraCoinPrice = latestAuraCoinPrice?.price ?? 100;
    addCategory(
      rankEntries(
        users.map((user) => ({
          userId: user.id,
          metric: user.money + user.auraCoinBalance * auraCoinPrice,
        })),
        false,
      ),
      users.length,
    );

    const gamesPlayedByUser = new Map<string, number>();
    for (const stat of allGameStats) {
      gamesPlayedByUser.set(stat.userId, (gamesPlayedByUser.get(stat.userId) ?? 0) + stat.totalPlayed);
    }
    const gamesPlayedEntries = Array.from(gamesPlayedByUser.entries())
      .filter(([, totalPlayed]) => totalPlayed > 0)
      .map(([userId, totalPlayed]) => ({ userId, metric: totalPlayed }));
    addCategory(rankEntries(gamesPlayedEntries, false), gamesPlayedEntries.length);

    const bombPartyEntries = bombPartyStats
      .filter((stat) => stat.totalPlayed > 0)
      .map((stat) => ({ userId: stat.userId, metric: stat.wins, secondary: stat.totalPlayed }));
    addCategory(rankEntries(bombPartyEntries, false), bombPartyEntries.length);

    const gameStatsByType = new Map<string, RankedEntry[]>();
    for (const stat of allGameStats) {
      if (stat.totalPlayed <= 0) {
        continue;
      }

      const list = gameStatsByType.get(stat.gameType) ?? [];
      if (WIN_BASED_GAME_TYPES.has(stat.gameType)) {
        list.push({ userId: stat.userId, metric: stat.wins, secondary: stat.totalPlayed });
      } else {
        list.push({ userId: stat.userId, metric: stat.highScore, secondary: stat.totalPlayed });
      }
      gameStatsByType.set(stat.gameType, list);
    }

    for (const [gameType, entries] of gameStatsByType.entries()) {
      const ascending = gameType === 'racer';
      addCategory(rankEntries(entries, ascending), entries.length);
    }

    const polymarketByUser = new Map<string, { wins: number; losses: number }>();
    for (const bet of resolvedBets) {
      const current = polymarketByUser.get(bet.userId) ?? { wins: 0, losses: 0 };
      if (bet.payout !== null) {
        current.wins += 1;
      } else {
        current.losses += 1;
      }
      polymarketByUser.set(bet.userId, current);
    }

    const polymarketEntries = Array.from(polymarketByUser.entries())
      .filter(([, value]) => value.wins + value.losses > 0)
      .map(([userId, value]) => ({
        userId,
        metric: value.losses === 0 ? value.wins : value.wins / value.losses,
        secondary: value.wins * 10_000 - value.losses,
      }));
    addCategory(rankEntries(polymarketEntries, false), polymarketEntries.length);

    const casinoLossesByUser = new Map<string, number>();
    for (const log of casinoLogs) {
      if (!log.userId || !validUserIds.has(log.userId) || !log.metadata) {
        continue;
      }

      try {
        const metadata = JSON.parse(log.metadata) as { netGain?: unknown };
        const netGain = Number(metadata.netGain ?? 0);
        if (Number.isFinite(netGain) && netGain < 0) {
          const current = casinoLossesByUser.get(log.userId) ?? 0;
          casinoLossesByUser.set(log.userId, current + Math.abs(netGain));
        }
      } catch {
        continue;
      }
    }

    const casinoLossEntries = Array.from(casinoLossesByUser.entries())
      .filter(([, losses]) => losses > 0)
      .map(([userId, losses]) => ({ userId, metric: losses }));
    addCategory(rankEntries(casinoLossEntries, false), casinoLossEntries.length);

    if (categoryCount === 0) {
      return;
    }

    const now = new Date();
    const finalScores = allUserIds.map((userId) => ({
      userId,
      totalScore: Number((totalScoreByUser.get(userId) ?? 0).toFixed(2)),
    }));

    finalScores.sort((left, right) => {
      if (left.totalScore !== right.totalScore) {
        return left.totalScore - right.totalScore;
      }
      return left.userId.localeCompare(right.userId, 'fr');
    });

    const updates = finalScores.map((entry, index) => ({
      userId: entry.userId,
      totalScore: entry.totalScore,
      overallRank: index + 1,
      lastScoreUpdate: now,
    }));

    const chunks = chunkArray(updates, 100);
    for (const chunk of chunks) {
      await prisma.$transaction(
        chunk.map((entry) =>
          prisma.user.update({
            where: { id: entry.userId },
            data: {
              totalScore: entry.totalScore,
              overallRank: entry.overallRank,
              lastScoreUpdate: entry.lastScoreUpdate,
            },
          }),
        ),
      );
    }

    console.log(`[overall-classement] Updated ${updates.length} users across ${categoryCount} categories`);
  } catch (error) {
    console.error('[overall-classement] Recompute failed:', error);
  }
};

export const startOverallClassementScheduler = (
  prisma: PrismaClient,
  intervalMs = DEFAULT_OVERALL_CLASSEMENT_INTERVAL_MS,
): void => {
  if (overallClassementTimer) {
    return;
  }

  overallClassementTimer = setInterval(() => {
    void recomputeOverallClassement(prisma);
  }, intervalMs);
};

export const stopOverallClassementScheduler = (): void => {
  if (!overallClassementTimer) {
    return;
  }

  clearInterval(overallClassementTimer);
  overallClassementTimer = null;
};
