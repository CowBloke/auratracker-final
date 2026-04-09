import type { Prisma, PrismaClient } from '@prisma/client';
import { getNextParisMidnight, getParisDayKey } from './dailyAura.js';

export const DAILY_GAME_AURA_LIMIT_SETTING_KEY = 'daily_game_aura_limit';
export const DAILY_GAME_MONEY_LIMIT_SETTING_KEY = 'daily_game_money_limit';
export const DEFAULT_DAILY_GAME_AURA_LIMIT = 500;
export const DEFAULT_DAILY_GAME_MONEY_LIMIT = 1000;

type DailyGameRewardDbClient = PrismaClient | Prisma.TransactionClient;

export type DailyGameRewardState = {
  id: string;
  dailyGameAuraGiven: number;
  dailyGameMoneyGiven: number;
  dailyGameAuraLimit: number;
  dailyGameMoneyLimit: number;
  lastDailyGameReset: Date;
  remainingAura: number;
  remainingMoney: number;
  nextResetAt: Date;
};

export type DailyGameRewardRequest = {
  aura?: number;
  money?: number;
};

export type DailyGameRewardApplication = {
  userId: string;
  appliedAura: number;
  appliedMoney: number;
  remainingAura: number;
  remainingMoney: number;
  nextResetAt: Date;
};

const normalizeRewardAmount = (value?: number) => {
  if (!Number.isFinite(value ?? 0)) {
    return 0;
  }

  return Math.max(0, Math.floor(value ?? 0));
};

export const getDailyGameRewardLimits = async (client: DailyGameRewardDbClient) => {
  const [auraSetting, moneySetting] = await Promise.all([
    client.gameSettings.findUnique({
      where: { key: DAILY_GAME_AURA_LIMIT_SETTING_KEY },
      select: { value: true },
    }),
    client.gameSettings.findUnique({
      where: { key: DAILY_GAME_MONEY_LIMIT_SETTING_KEY },
      select: { value: true },
    }),
  ]);

  const parsedAura = Number.parseInt(auraSetting?.value ?? '', 10);
  const parsedMoney = Number.parseInt(moneySetting?.value ?? '', 10);

  return {
    aura: Number.isInteger(parsedAura) && parsedAura >= 0 ? parsedAura : DEFAULT_DAILY_GAME_AURA_LIMIT,
    money: Number.isInteger(parsedMoney) && parsedMoney >= 0 ? parsedMoney : DEFAULT_DAILY_GAME_MONEY_LIMIT,
  };
};

export const syncUserDailyGameRewardState = async (client: DailyGameRewardDbClient, userId: string): Promise<DailyGameRewardState | null> => {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      dailyGameAuraGiven: true,
      dailyGameMoneyGiven: true,
      dailyGameAuraLimit: true,
      dailyGameMoneyLimit: true,
      lastDailyGameReset: true,
    },
  });

  if (!user) {
    return null;
  }

  const globalLimits = await getDailyGameRewardLimits(client);
  const now = new Date();
  const shouldReset = getParisDayKey(user.lastDailyGameReset) !== getParisDayKey(now);
  const shouldSyncLimits = user.dailyGameAuraLimit !== globalLimits.aura || user.dailyGameMoneyLimit !== globalLimits.money;

  if (shouldReset || shouldSyncLimits) {
    const updatedUser = await client.user.update({
      where: { id: userId },
      data: shouldReset
        ? {
            dailyGameAuraGiven: 0,
            dailyGameMoneyGiven: 0,
            dailyGameAuraLimit: globalLimits.aura,
            dailyGameMoneyLimit: globalLimits.money,
            lastDailyGameReset: now,
          }
        : {
            dailyGameAuraLimit: globalLimits.aura,
            dailyGameMoneyLimit: globalLimits.money,
          },
      select: {
        id: true,
        dailyGameAuraGiven: true,
        dailyGameMoneyGiven: true,
        dailyGameAuraLimit: true,
        dailyGameMoneyLimit: true,
        lastDailyGameReset: true,
      },
    });

    return {
      ...updatedUser,
      remainingAura: Math.max(0, updatedUser.dailyGameAuraLimit - updatedUser.dailyGameAuraGiven),
      remainingMoney: Math.max(0, updatedUser.dailyGameMoneyLimit - updatedUser.dailyGameMoneyGiven),
      nextResetAt: getNextParisMidnight(now),
    };
  }

  return {
    ...user,
    remainingAura: Math.max(0, user.dailyGameAuraLimit - user.dailyGameAuraGiven),
    remainingMoney: Math.max(0, user.dailyGameMoneyLimit - user.dailyGameMoneyGiven),
    nextResetAt: getNextParisMidnight(now),
  };
};

export const applyDailyGameRewardCaps = async (
  client: PrismaClient,
  userId: string,
  reward: DailyGameRewardRequest,
): Promise<DailyGameRewardApplication | null> => {
  return client.$transaction(async (tx) => {
    const state = await syncUserDailyGameRewardState(tx, userId);

    if (!state) {
      return null;
    }

    const requestedAura = normalizeRewardAmount(reward.aura);
    const requestedMoney = normalizeRewardAmount(reward.money);
    const appliedAura = Math.min(requestedAura, state.remainingAura);
    const appliedMoney = Math.min(requestedMoney, state.remainingMoney);

    if (appliedAura > 0 || appliedMoney > 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(appliedAura > 0
            ? {
                aura: { increment: BigInt(appliedAura) },
                dailyGameAuraGiven: { increment: appliedAura },
              }
            : {}),
          ...(appliedMoney > 0
            ? {
                money: { increment: appliedMoney },
                dailyGameMoneyGiven: { increment: appliedMoney },
              }
            : {}),
        },
      });
    }

    return {
      userId,
      appliedAura,
      appliedMoney,
      remainingAura: Math.max(0, state.remainingAura - appliedAura),
      remainingMoney: Math.max(0, state.remainingMoney - appliedMoney),
      nextResetAt: state.nextResetAt,
    };
  });
};