import type { PrismaClient } from '@prisma/client';
import { getNextParisMidnight, getParisDayKey, getParisDayStart } from './dailyAura.js';
import { emitNotificationCreated } from './notifications.js';
import { emitSharedBalanceUpdatesForUserIds } from './sharedBalance.js';
import { applyDailyGameRewardCaps } from './dailyGameRewards.js';

const LAST_DAILY_RACER_REWARD_RUN_KEY = 'last_daily_racer_reward_run_date';

const DAILY_RACER_RANK_REWARDS = [
  { rank: 1, money: 300, aura: 30 },
  { rank: 2, money: 200, aura: 20 },
  { rank: 3, money: 100, aura: 10 },
] as const;

let _timer: ReturnType<typeof setTimeout> | null = null;

export const runDailyRacerRewards = async (
  prisma: PrismaClient,
  force = false,
): Promise<{ skipped: boolean; rewardedUsers: number; rewardedDayKey: string }> => {
  const now = new Date();
  const todayKey = getParisDayKey(now);

  if (!force) {
    const lastRun = await prisma.gameSettings.findUnique({
      where: { key: LAST_DAILY_RACER_REWARD_RUN_KEY },
      select: { value: true },
    });

    if (lastRun?.value === todayKey) {
      return { skipped: true, rewardedUsers: 0, rewardedDayKey: getParisDayKey(new Date(now.getTime() - 86400000)) };
    }
  }

  const previousDay = new Date(now.getTime() - 86400000);
  const rewardedDayKey = getParisDayKey(previousDay);
  const trackDate = getParisDayStart(previousDay);

  const runs = await prisma.dailyRacerRun.findMany({
    where: {
      trackDate,
      user: {
        isSuperAdmin: false,
      },
    },
    orderBy: [{ lapTimeMs: 'asc' }, { createdAt: 'asc' }],
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  const bestRunsByUser = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!bestRunsByUser.has(run.userId)) {
      bestRunsByUser.set(run.userId, run);
    }
  }

  const winners = Array.from(bestRunsByUser.values()).slice(0, DAILY_RACER_RANK_REWARDS.length);
  const winnerIds: string[] = [];

  for (const [index, winner] of winners.entries()) {
    const reward = DAILY_RACER_RANK_REWARDS[index];
    const cappedReward = await applyDailyGameRewardCaps(prisma, winner.userId, 'racer_daily', reward);
    const appliedReward = {
      money: cappedReward?.appliedMoney ?? 0,
      aura: cappedReward?.appliedAura ?? 0,
    };
    const notification = await prisma.notification.create({
      data: {
        userId: winner.userId,
        type: 'SYSTEM',
        title: `Recompense Daily Racer - Top ${reward.rank}`,
        body: `Tu as termine #${reward.rank} du classement Daily Racer du ${rewardedDayKey}. Gain: ${appliedReward.money}$ et ${appliedReward.aura} aura.`,
        icon: 'trophy',
        link: '/games/racer',
        data: JSON.stringify({
          gameType: 'racer_daily',
          dayKey: rewardedDayKey,
          rank: reward.rank,
          lapTimeMs: winner.lapTimeMs,
          rewardMoney: appliedReward.money,
          rewardAura: appliedReward.aura,
        }),
      },
    });

    emitNotificationCreated(notification);
    winnerIds.push(winner.userId);
  }

  await prisma.gameSettings.upsert({
    where: { key: LAST_DAILY_RACER_REWARD_RUN_KEY },
    update: { value: todayKey },
    create: { key: LAST_DAILY_RACER_REWARD_RUN_KEY, value: todayKey },
  });

  if (winnerIds.length > 0) {
    await emitSharedBalanceUpdatesForUserIds(prisma, winnerIds);
  }

  console.log(`[daily-racer] ${rewardedDayKey}: rewarded ${winnerIds.length} user(s)`);

  return {
    skipped: false,
    rewardedUsers: winnerIds.length,
    rewardedDayKey,
  };
};

const scheduleNextRun = (prisma: PrismaClient): void => {
  const now = new Date();
  const nextMidnight = getNextParisMidnight(now);
  const delay = Math.max(0, nextMidnight.getTime() - now.getTime());

  _timer = setTimeout(() => {
    void runDailyRacerRewards(prisma).then(() => scheduleNextRun(prisma));
  }, delay);
};

export const startDailyRacerRewardsScheduler = (prisma: PrismaClient): void => {
  if (_timer) return;
  scheduleNextRun(prisma);
  const next = getNextParisMidnight(new Date());
  console.log(`[daily-racer] Scheduler started - next run at ${next.toISOString()}`);
};

export const stopDailyRacerRewardsScheduler = (): void => {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
};
