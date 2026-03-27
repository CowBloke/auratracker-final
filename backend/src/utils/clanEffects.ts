import type { ClanEffect } from '@prisma/client';
import { prisma } from '../server.js';

export const CLAN_EFFECT_GAME_MONEY_BOOST = 'CLAN_GAME_MONEY_BOOST';
export const DEFAULT_CLAN_EFFECT_DURATION_HOURS = 1;
export const DEFAULT_CLAN_EFFECT_COOLDOWN_HOURS = 24;

type ClanEffectPayload = {
  type?: string;
  percentage?: number;
  durationHours?: number;
  cooldownHours?: number;
};

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000);

export const parseClanEffectPayload = (effect: string | null): ClanEffectPayload | null => {
  if (!effect) return null;
  try {
    return JSON.parse(effect) as ClanEffectPayload;
  } catch {
    return null;
  }
};

export const isClanGameMoneyBoostEffect = (effect: string | null) =>
  parseClanEffectPayload(effect)?.type === CLAN_EFFECT_GAME_MONEY_BOOST;

export const getClanEffectStatus = (effect: Pick<ClanEffect, 'activeUntil' | 'cooldownUntil'>, now = new Date()) => ({
  isActive: Boolean(effect.activeUntil && effect.activeUntil > now),
  isOnCooldown: Boolean(effect.cooldownUntil && effect.cooldownUntil > now),
});

export const serializeClanEffect = (effect: Pick<ClanEffect, 'id' | 'type' | 'name' | 'description' | 'value' | 'durationHours' | 'cooldownHours' | 'activatedAt' | 'activeUntil' | 'cooldownUntil'>) => {
  const status = getClanEffectStatus(effect);
  return {
    id: effect.id,
    type: effect.type,
    name: effect.name,
    description: effect.description,
    value: effect.value,
    durationHours: effect.durationHours,
    cooldownHours: effect.cooldownHours,
    activatedAt: effect.activatedAt,
    activeUntil: effect.activeUntil,
    cooldownUntil: effect.cooldownUntil,
    isActive: status.isActive,
    isOnCooldown: status.isOnCooldown,
  };
};

export const getActiveClanMoneyBoostForUser = async (userId: string) => {
  const membership = await prisma.clanMember.findUnique({
    where: { userId },
    select: {
      clan: {
        select: {
          activeEffects: {
            where: {
              type: CLAN_EFFECT_GAME_MONEY_BOOST,
              activeUntil: { gt: new Date() },
            },
            orderBy: {
              activeUntil: 'desc',
            },
            take: 1,
          },
        },
      },
    },
  });

  return membership?.clan?.activeEffects[0] ?? null;
};

export const getActiveClanMoneyBoostPercentsForUsers = async (userIds: string[]) => {
  if (userIds.length === 0) {
    return new Map<string, number>();
  }

  const memberships = await prisma.clanMember.findMany({
    where: {
      userId: { in: userIds },
    },
    select: {
      userId: true,
      clan: {
        select: {
          activeEffects: {
            where: {
              type: CLAN_EFFECT_GAME_MONEY_BOOST,
              activeUntil: { gt: new Date() },
            },
            take: 1,
          },
        },
      },
    },
  });

  const result = new Map<string, number>();
  for (const membership of memberships) {
    result.set(membership.userId, membership.clan.activeEffects[0]?.value ?? 0);
  }
  return result;
};

export const buildClanEffectActivation = (payload: ClanEffectPayload | null, now = new Date()) => {
  const value = Math.max(0, Math.floor(payload?.percentage ?? 0));
  const durationHours = Math.max(1, Math.floor(payload?.durationHours ?? DEFAULT_CLAN_EFFECT_DURATION_HOURS));
  const cooldownHours = Math.max(durationHours, Math.floor(payload?.cooldownHours ?? DEFAULT_CLAN_EFFECT_COOLDOWN_HOURS));

  return {
    value,
    durationHours,
    cooldownHours,
    activatedAt: now,
    activeUntil: addHours(now, durationHours),
    cooldownUntil: addHours(now, cooldownHours),
  };
};
