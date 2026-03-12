import { prisma } from '../server.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoConditionKey =
  | 'MEMBER'
  | `CLASS_${string}`
  | 'TOP_1_AURA'
  | 'TOP_3_AURA'
  | 'TOP_5_AURA'
  | 'TOP_10_AURA'
  | 'TOP_1_MONEY'
  | 'TOP_3_MONEY'
  | 'TOP_5_MONEY'
  | 'TOP_10_MONEY'
  | 'BOMBPARTY_TOP_WINS'
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
  // Every approved user earns the MEMBER badge
  if (key === 'MEMBER') {
    const users = await prisma.user.findMany({
      where: { isApproved: true },
      select: { id: true },
    });
    return new Set(users.map((u) => u.id));
  }
  // CLASS_SECONDE_A, CLASS_PREMIERE_B, CLASS_TERMINALE_G, …
  if (key.startsWith('CLASS_')) {
    const rest = key.slice('CLASS_'.length); // e.g. "SECONDE_A"
    const lastUnderscore = rest.lastIndexOf('_');
    if (lastUnderscore === -1) return new Set();
    const schoolLevel = rest.slice(0, lastUnderscore); // "SECONDE"
    const classLetter = rest.slice(lastUnderscore + 1); // "A"
    const users = await prisma.user.findMany({
      where: { isApproved: true, schoolLevel, classLetter },
      select: { id: true },
    });
    return new Set(users.map((u) => u.id));
  }
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

// ─── Targeted single-condition recheck ───────────────────────────────────────

/**
 * Re-evaluate exactly one automatic badge condition and update only the users
 * whose membership changed. Also auto-equips newly awarded badges.
 *
 * Use this for immediate recalculations (e.g. on new highscore) instead of
 * running the full checkAndUpdateAutoBadges() cycle.
 */
export const recheckBadgeForCondition = async (conditionKey: string): Promise<void> => {
  try {
    const badge = await prisma.badge.findFirst({
      where: { autoConditionKey: conditionKey, isAutomatic: true, isActive: true },
      select: { id: true, name: true },
    });
    if (!badge) return;

    const qualifyingIds = await getQualifyingUserIds(conditionKey);

    const current = await prisma.userBadge.findMany({
      where: { badgeId: badge.id },
      select: { userId: true },
    });
    const currentIds = new Set(current.map((ub) => ub.userId));

    const affected = new Set<string>();

    for (const userId of qualifyingIds) {
      if (!currentIds.has(userId)) {
        await awardBadge(userId, badge.id, `Automatiquement obtenu : ${badge.name}`);
        affected.add(userId);
      }
    }

    for (const userId of currentIds) {
      if (!qualifyingIds.has(userId)) {
        await revokeBadge(userId, badge.id);
        affected.add(userId);
      }
    }

    // Auto-equip for affected users only (fast — at most 2 users per highscore change)
    if (affected.size > 0) {
      await autoEquipForUsers([...affected]);
    }
  } catch (error) {
    console.error(`recheckBadgeForCondition(${conditionKey}) error:`, error);
  }
};

/** Auto-equip logic scoped to a specific list of user IDs. */
export const autoEquipForUsers = async (userIds: string[]): Promise<void> => {
  if (userIds.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, isApproved: true },
      select: {
        id: true,
        schoolLevel: true,
        classLetter: true,
        equippedBadge1Id: true,
        equippedBadge2Id: true,
        earnedBadges: {
          select: { badge: { select: { id: true, autoConditionKey: true } } },
        },
      },
    });

    for (const user of users) {
      if (user.equippedBadge1Id && user.equippedBadge2Id) continue;

      const ownedByKey = new Map(
        user.earnedBadges
          .filter((ub) => ub.badge.autoConditionKey)
          .map((ub) => [ub.badge.autoConditionKey!, ub.badge.id]),
      );
      const ownedIds = user.earnedBadges.map((ub) => ub.badge.id);

      const classKey =
        user.schoolLevel && user.classLetter
          ? `CLASS_${user.schoolLevel}_${user.classLetter}`
          : null;

      const priority: string[] = [];
      if (classKey && ownedByKey.has(classKey)) priority.push(ownedByKey.get(classKey)!);
      if (ownedByKey.has('MEMBER')) priority.push(ownedByKey.get('MEMBER')!);
      for (const id of ownedIds) {
        if (!priority.includes(id)) priority.push(id);
      }

      const alreadyEquipped = new Set(
        [user.equippedBadge1Id, user.equippedBadge2Id].filter(Boolean) as string[],
      );
      const candidates = priority.filter((id) => !alreadyEquipped.has(id));

      const patch: { equippedBadge1Id?: string; equippedBadge2Id?: string } = {};

      if (!user.equippedBadge1Id && candidates[0]) {
        patch.equippedBadge1Id = candidates[0];
        alreadyEquipped.add(candidates[0]);
        candidates.shift();
      }
      if (!user.equippedBadge2Id) {
        const next = candidates.find((id) => !alreadyEquipped.has(id));
        if (next) patch.equippedBadge2Id = next;
      }

      if (Object.keys(patch).length > 0) {
        await prisma.user.update({ where: { id: user.id }, data: patch });
      }
    }
  } catch (error) {
    console.error('autoEquipForUsers error:', error);
  }
};

// ─── Auto-equip ──────────────────────────────────────────────────────────────

/**
 * For every approved user with at least one empty badge slot, fill it with:
 *   Slot 1 priority: class badge → member badge → any earned badge
 *   Slot 2 priority: member badge → any earned badge (different from slot 1)
 *
 * Already-equipped slots are never changed.
 */
export const autoEquipDefaultBadges = async (): Promise<void> => {
  try {
    const ids = await prisma.user.findMany({
      where: { isApproved: true },
      select: { id: true },
    });
    await autoEquipForUsers(ids.map((u) => u.id));
    console.log('[badges] Auto-equip pass completed');
  } catch (error) {
    console.error('autoEquipDefaultBadges error:', error);
  }
};

// ─── Scheduled runner ─────────────────────────────────────────────────────────

let _autoBadgeTimer: ReturnType<typeof setInterval> | null = null;

const runFullBadgeCycle = async () => {
  await checkAndUpdateAutoBadges();
  await autoEquipDefaultBadges();
};

/** Start periodic auto-badge checks + auto-equip every 5 minutes. */
export const startAutoBadgeScheduler = (): void => {
  if (_autoBadgeTimer) return;
  void runFullBadgeCycle(); // run once immediately
  _autoBadgeTimer = setInterval(() => {
    void runFullBadgeCycle();
  }, 5 * 60_000);
};

export const stopAutoBadgeScheduler = (): void => {
  if (_autoBadgeTimer) {
    clearInterval(_autoBadgeTimer);
    _autoBadgeTimer = null;
  }
};
