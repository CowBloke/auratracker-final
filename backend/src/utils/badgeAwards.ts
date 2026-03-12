import { prisma } from '../server.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoConditionKey =
  | 'TOP_1_AURA'
  | 'TOP_3_AURA'
  | 'TOP_5_AURA'
  | 'TOP_10_AURA'
  | 'TOP_1_MONEY'
  | 'TOP_3_MONEY'
  | 'TOP_5_MONEY'
  | 'TOP_10_MONEY'
  | `GAME_HIGHSCORE_${string}`;

// ─── Core award / revoke helpers ─────────────────────────────────────────────

/**
 * Award a badge to a user. Safe to call even if the user already has the badge.
 * Returns the UserBadge record (newly created or existing).
 */
export const awardBadge = async (
  userId: string,
  badgeId: string,
  reason?: string,
): Promise<boolean> => {
  try {
    const existing = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
    });
    if (existing) return false; // already owned

    await prisma.userBadge.create({
      data: { userId, badgeId, obtainedReason: reason ?? null },
    });
    return true;
  } catch (error) {
    console.error('badgeAwards.awardBadge error:', error);
    return false;
  }
};

/**
 * Revoke a badge from a user and unequip it from both badge slots if present.
 * Safe to call even if the user does not own the badge.
 */
export const revokeBadge = async (userId: string, badgeId: string): Promise<boolean> => {
  try {
    // Unequip from both slots in a single update
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { equippedBadge1Id: true, equippedBadge2Id: true },
    });
    if (user) {
      const unequipData: Record<string, null> = {};
      if (user.equippedBadge1Id === badgeId) unequipData.equippedBadge1Id = null;
      if (user.equippedBadge2Id === badgeId) unequipData.equippedBadge2Id = null;
      if (Object.keys(unequipData).length > 0) {
        await prisma.user.update({ where: { id: userId }, data: unequipData });
      }
    }

    await prisma.userBadge.delete({
      where: { userId_badgeId: { userId, badgeId } },
    });
    return true;
  } catch {
    return false;
  }
};

// ─── Auto-badge helpers ───────────────────────────────────────────────────────

const getQualifyingUserIds = async (key: string): Promise<Set<string>> => {
  if (key === 'TOP_1_AURA') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { aura: 'desc' },
      take: 1,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_3_AURA') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { aura: 'desc' },
      take: 3,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_5_AURA') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { aura: 'desc' },
      take: 5,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_10_AURA') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { aura: 'desc' },
      take: 10,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_1_MONEY') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { money: 'desc' },
      take: 1,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_3_MONEY') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { money: 'desc' },
      take: 3,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_5_MONEY') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { money: 'desc' },
      take: 5,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_10_MONEY') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { money: 'desc' },
      take: 10,
    });
    return new Set(users.map((u) => u.id));
  }
  // GAME_HIGHSCORE_{gameType} – top-1 highscore for a specific game type
  // racer uses ascending order (lower lapTime = better)
  if (key.startsWith('GAME_HIGHSCORE_')) {
    const gameType = key.slice('GAME_HIGHSCORE_'.length).toLowerCase();
    const order = gameType === 'racer' ? 'asc' : 'desc';
    const stat = await prisma.gameStats.findFirst({
      where: { gameType, highScore: { gt: 0 } },
      select: { userId: true },
      orderBy: { highScore: order },
    });
    return stat ? new Set([stat.userId]) : new Set();
  }
  // BOMBPARTY_TOP_WINS – top BombParty wins holder
  if (key === 'BOMBPARTY_TOP_WINS') {
    const stat = await prisma.bombPartyStats.findFirst({
      select: { userId: true },
      orderBy: { wins: 'desc' },
    });
    return stat ? new Set([stat.userId]) : new Set();
  }
  return new Set();
};

/**
 * Check every automatic badge and award/revoke memberships accordingly.
 * This is idempotent — safe to call at any time.
 */
export const checkAndUpdateAutoBadges = async (): Promise<void> => {
  try {
    const autoBadges = await prisma.badge.findMany({
      where: { isAutomatic: true, isActive: true, autoConditionKey: { not: null } },
      select: { id: true, autoConditionKey: true, name: true },
    });

    for (const badge of autoBadges) {
      if (!badge.autoConditionKey) continue;

      const qualifyingIds = await getQualifyingUserIds(badge.autoConditionKey);

      // Users who currently have this badge
      const current = await prisma.userBadge.findMany({
        where: { badgeId: badge.id },
        select: { userId: true },
      });
      const currentIds = new Set(current.map((ub) => ub.userId));

      // Award to new qualifiers
      for (const userId of qualifyingIds) {
        if (!currentIds.has(userId)) {
          await awardBadge(
            userId,
            badge.id,
            `Automatiquement obtenu : ${badge.name}`,
          );
        }
      }

      // Revoke from users who no longer qualify
      for (const userId of currentIds) {
        if (!qualifyingIds.has(userId)) {
          await revokeBadge(userId, badge.id);
        }
      }
    }
  } catch (error) {
    console.error('checkAndUpdateAutoBadges error:', error);
  }
};

// ─── Scheduled runner ─────────────────────────────────────────────────────────

let _autoBadgeTimer: ReturnType<typeof setInterval> | null = null;

/** Start periodic auto-badge checks every 5 minutes. */
export const startAutoBadgeScheduler = (): void => {
  if (_autoBadgeTimer) return;
  void checkAndUpdateAutoBadges(); // run once immediately
  _autoBadgeTimer = setInterval(() => {
    void checkAndUpdateAutoBadges();
  }, 5 * 60_000);
};

export const stopAutoBadgeScheduler = (): void => {
  if (_autoBadgeTimer) {
    clearInterval(_autoBadgeTimer);
    _autoBadgeTimer = null;
  }
};
