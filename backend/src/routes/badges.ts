import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, updateMyBadgeSelectionSchema } from '../middleware/validation.js';

const router = Router();

type BadgeStyle = Record<string, unknown>;

const safeParseStyle = (style: string): BadgeStyle => {
  try {
    const parsed = JSON.parse(style);
    if (parsed && typeof parsed === 'object') return parsed as BadgeStyle;
    return {};
  } catch {
    return {};
  }
};

const toPublicBadge = (badge: { id: string; key: string; name: string; description: string | null; style: string }) => {
  return {
    id: badge.id,
    key: badge.key,
    name: badge.name,
    description: badge.description,
    style: safeParseStyle(badge.style),
  };
};

// Get displayed (selected) badges for many users (used for username rendering)
router.get('/selected', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const raw = typeof req.query.userIds === 'string' ? req.query.userIds : '';
    const userIds = raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (userIds.length === 0) {
      return res.json({ users: {} });
    }

    if (userIds.length > 100) {
      return res.status(400).json({ error: 'Too many userIds (max 100)' });
    }

    const selections = await prisma.userBadgeSelection.findMany({
      where: {
        userId: { in: userIds },
        slot: { in: [1, 2] },
        badgeId: { not: null },
        badge: {
          isActive: true,
        },
      },
      select: {
        userId: true,
        slot: true,
        badge: {
          select: {
            id: true,
            key: true,
            name: true,
            description: true,
            style: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ userId: 'asc' }, { slot: 'asc' }],
    });

    const users: Record<string, ReturnType<typeof toPublicBadge>[]> = {};

    for (const row of selections) {
      if (!row.badge || !row.badge.isActive) continue;
      (users[row.userId] ??= []).push(toPublicBadge(row.badge));
    }

    return res.json({ users });
  } catch (error) {
    console.error('Get selected badges error:', error);
    return res.status(500).json({ error: 'Failed to get selected badges' });
  }
});

// List current user's granted badges + current selection
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const [grants, selections] = await Promise.all([
      prisma.userBadgeGrant.findMany({
        where: {
          userId,
          revokedAt: null,
          badge: { isActive: true },
        },
        select: {
          badge: {
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
              style: true,
              isActive: true,
            },
          },
        },
        orderBy: {
          badge: { name: 'asc' },
        },
      }),
      prisma.userBadgeSelection.findMany({
        where: { userId, slot: { in: [1, 2] } },
        select: { slot: true, badgeId: true },
      }),
    ]);

    const selection: { slot1: string | null; slot2: string | null } = { slot1: null, slot2: null };
    for (const s of selections) {
      if (s.slot === 1) selection.slot1 = s.badgeId;
      if (s.slot === 2) selection.slot2 = s.badgeId;
    }

    return res.json({
      badges: grants
        .map((g) => g.badge)
        .filter((b): b is NonNullable<typeof b> => Boolean(b && b.isActive))
        .map(toPublicBadge),
      selection,
    });
  } catch (error) {
    console.error('Get my badges error:', error);
    return res.status(500).json({ error: 'Failed to get my badges' });
  }
});

// Update current user's 2 selected badges (must be granted)
router.put('/my/selection', authMiddleware, validate(updateMyBadgeSelectionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { slot1BadgeId, slot2BadgeId } = req.body as { slot1BadgeId: string | null; slot2BadgeId: string | null };

    const chosen = [slot1BadgeId, slot2BadgeId].filter((id): id is string => Boolean(id));
    if (new Set(chosen).size !== chosen.length) {
      return res.status(400).json({ error: 'You cannot select the same badge twice' });
    }

    if (chosen.length > 0) {
      const owned = await prisma.userBadgeGrant.findMany({
        where: {
          userId,
          revokedAt: null,
          badgeId: { in: chosen },
          badge: { isActive: true },
        },
        select: { badgeId: true },
      });
      const ownedIds = new Set(owned.map((o) => o.badgeId));
      const missing = chosen.filter((id) => !ownedIds.has(id));
      if (missing.length > 0) {
        return res.status(400).json({ error: 'Some selected badges are not available for this user' });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.userBadgeSelection.upsert({
        where: { userId_slot: { userId, slot: 1 } },
        create: { userId, slot: 1, badgeId: slot1BadgeId },
        update: { badgeId: slot1BadgeId },
      });
      await tx.userBadgeSelection.upsert({
        where: { userId_slot: { userId, slot: 2 } },
        create: { userId, slot: 2, badgeId: slot2BadgeId },
        update: { badgeId: slot2BadgeId },
      });
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Update my badge selection error:', error);
    return res.status(500).json({ error: 'Failed to update badge selection' });
  }
});

export default router;

