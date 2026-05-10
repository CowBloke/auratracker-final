import type { Prisma, PrismaClient } from '@prisma/client';
import { getNextParisMidnight, getParisDayKey } from './daily-aura.js';

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

const DAILY_GAME_MONEY_TRACKER_KEY_PREFIX = 'daily_game_money_tracker';
const DAILY_GAME_AURA_TRACKER_KEY_PREFIX = 'daily_game_aura_tracker';

const buildDailyGameTrackerKey = (userId: string, gameType: string, type: 'aura' | 'money') => {
  const normalizedGameType = gameType.trim().toLowerCase() || 'unknown';
  const prefix = type === 'aura' ? DAILY_GAME_AURA_TRACKER_KEY_PREFIX : DAILY_GAME_MONEY_TRACKER_KEY_PREFIX;
  return `${prefix}:${userId}:${normalizedGameType}`;
};

const parseDailyGameTrackerValue = (value: string | null): { dayKey: string; amountGiven: number } | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as { dayKey?: unknown; amountGiven?: unknown; moneyGiven?: unknown; auraGiven?: unknown };
    if (typeof parsed.dayKey !== 'string') {
      return null;
    }

    // Support both old "moneyGiven" and new "amountGiven" keys for backward compatibility during migration
    const rawAmount = parsed.amountGiven ?? parsed.moneyGiven ?? parsed.auraGiven ?? 0;
    const parsedAmount = Number.parseInt(String(rawAmount), 10);
    return {
      dayKey: parsed.dayKey,
      amountGiven: Number.isInteger(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0,
    };
  } catch {
    return null;
  }
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

/**
 * Resolves the limit for a specific game and reward type.
 * Priority: 
 * 1. Specific game setting (e.g., game_limit_aura:doodle_jump)
 * 2. Global default setting (e.g., daily_game_aura_limit)
 * 3. Constant fallback
 */
export const resolveGameLimit = async (client: DailyGameRewardDbClient, gameType: string, type: 'aura' | 'money'): Promise<number> => {
  const specificKey = `game_limit_${type}:${gameType}`;
  const specificSetting = await client.gameSettings.findUnique({
    where: { key: specificKey },
    select: { value: true },
  });

  if (specificSetting?.value) {
    const parsed = Number.parseInt(specificSetting.value, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  const globalLimits = await getDailyGameRewardLimits(client);
  return globalLimits[type];
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
  gameType: string,
  reward: DailyGameRewardRequest,
): Promise<DailyGameRewardApplication | null> => {
  return client.$transaction(async (tx) => {
    const state = await syncUserDailyGameRewardState(tx, userId);

    if (!state) {
      return null;
    }

    const requestedAura = normalizeRewardAmount(reward.aura);
    const requestedMoney = normalizeRewardAmount(reward.money);
    const now = new Date();
    const todayKey = getParisDayKey(now);

    // Resolve per-game limits
    const auraLimitForGame = await resolveGameLimit(tx, gameType, 'aura');
    const moneyLimitForGame = await resolveGameLimit(tx, gameType, 'money');

    // Trackers for per-game progress today
    const auraTrackerKey = buildDailyGameTrackerKey(userId, gameType, 'aura');
    const moneyTrackerKey = buildDailyGameTrackerKey(userId, gameType, 'money');

    const [auraTrackerSetting, moneyTrackerSetting] = await Promise.all([
      tx.gameSettings.findUnique({ where: { key: auraTrackerKey }, select: { value: true } }),
      tx.gameSettings.findUnique({ where: { key: moneyTrackerKey }, select: { value: true } }),
    ]);

    const auraTracker = parseDailyGameTrackerValue(auraTrackerSetting?.value ?? null);
    const moneyTracker = parseDailyGameTrackerValue(moneyTrackerSetting?.value ?? null);

    const auraGivenForGameToday = auraTracker?.dayKey === todayKey ? auraTracker.amountGiven : 0;
    const moneyGivenForGameToday = moneyTracker?.dayKey === todayKey ? moneyTracker.amountGiven : 0;

    const remainingAuraForGame = Math.max(0, auraLimitForGame - auraGivenForGameToday);
    const remainingMoneyForGame = Math.max(0, moneyLimitForGame - moneyGivenForGameToday);

    const appliedAura = Math.min(requestedAura, remainingAuraForGame);
    const appliedMoney = Math.min(requestedMoney, remainingMoneyForGame);

    if (appliedAura > 0 || appliedMoney > 0) {
      await Promise.all([
        tx.user.update({
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
        }),
        appliedAura > 0 && tx.gameSettings.upsert({
          where: { key: auraTrackerKey },
          create: {
            key: auraTrackerKey,
            value: JSON.stringify({
              dayKey: todayKey,
              amountGiven: appliedAura,
            }),
          },
          update: {
            value: JSON.stringify({
              dayKey: todayKey,
              amountGiven: auraGivenForGameToday + appliedAura,
            }),
          },
        }),
        appliedMoney > 0 && tx.gameSettings.upsert({
          where: { key: moneyTrackerKey },
          create: {
            key: moneyTrackerKey,
            value: JSON.stringify({
              dayKey: todayKey,
              amountGiven: appliedMoney,
            }),
          },
          update: {
            value: JSON.stringify({
              dayKey: todayKey,
              amountGiven: moneyGivenForGameToday + appliedMoney,
            }),
          },
        }),
      ]);
    }

    return {
      userId,
      appliedAura,
      appliedMoney,
      remainingAura: Math.max(0, remainingAuraForGame - appliedAura),
      remainingMoney: Math.max(0, remainingMoneyForGame - appliedMoney),
      nextResetAt: state.nextResetAt,
    };
  });
};