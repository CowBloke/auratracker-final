import type { PrismaClient } from '@prisma/client';

export const DAILY_AURA_LIMIT_SETTING_KEY = 'daily_aura_distribution_limit';
export const DEFAULT_DAILY_AURA_LIMIT = 100;
const DAILY_AURA_TIME_ZONE = 'Europe/Paris';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DAILY_AURA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const nextResetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DAILY_AURA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const parsePartsToNumber = (value: string) => Number.parseInt(value, 10);

const getParisDateParts = (date: Date) => {
  const parts = nextResetFormatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '0';

  return {
    year: parsePartsToNumber(lookup('year')),
    month: parsePartsToNumber(lookup('month')),
    day: parsePartsToNumber(lookup('day')),
    hour: parsePartsToNumber(lookup('hour')),
    minute: parsePartsToNumber(lookup('minute')),
    second: parsePartsToNumber(lookup('second')),
  };
};

export const getParisDayKey = (date: Date) => dayFormatter.format(date);

export const getNextParisMidnight = (date = new Date()) => {
  const { year, month, day, hour, minute, second } = getParisDateParts(date);
  const currentUtcMillis = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMs = currentUtcMillis - date.getTime();
  const nextLocalMidnightUtc = Date.UTC(year, month - 1, day + 1, 0, 0, 0);
  return new Date(nextLocalMidnightUtc - offsetMs);
};

export const getDailyAuraLimit = async (client: PrismaClient) => {
  const setting = await client.gameSettings.findUnique({
    where: { key: DAILY_AURA_LIMIT_SETTING_KEY },
    select: { value: true },
  });

  const parsedValue = Number.parseInt(setting?.value ?? '', 10);
  return Number.isInteger(parsedValue) && parsedValue >= 0
    ? parsedValue
    : DEFAULT_DAILY_AURA_LIMIT;
};

export const syncUserDailyAuraState = async (client: PrismaClient, userId: string) => {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      dailyAuraGiven: true,
      dailyAuraLimit: true,
      lastDailyReset: true,
    },
  });

  if (!user) {
    return null;
  }

  const globalLimit = await getDailyAuraLimit(client);
  const now = new Date();
  const shouldReset = getParisDayKey(user.lastDailyReset) !== getParisDayKey(now);
  const shouldSyncLimit = user.dailyAuraLimit !== globalLimit;

  if (!shouldReset && !shouldSyncLimit) {
    return {
      ...user,
      remainingAura: Math.max(0, user.dailyAuraLimit - user.dailyAuraGiven),
      nextResetAt: getNextParisMidnight(now),
    };
  }

  const updatedUser = await client.user.update({
    where: { id: userId },
    data: shouldReset
      ? {
          dailyAuraGiven: 0,
          dailyAuraLimit: globalLimit,
          lastDailyReset: now,
        }
      : {
          dailyAuraLimit: globalLimit,
        },
    select: {
      id: true,
      dailyAuraGiven: true,
      dailyAuraLimit: true,
      lastDailyReset: true,
    },
  });

  return {
    ...updatedUser,
    remainingAura: Math.max(0, updatedUser.dailyAuraLimit - updatedUser.dailyAuraGiven),
    nextResetAt: getNextParisMidnight(now),
  };
};
