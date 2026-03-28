import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { awardBadge, revokeBadge, checkAndUpdateAutoBadges, autoEquipDefaultBadges } from '../utils/badgeAwards.js';

const router = Router();

// ─── Shared badge select shape ────────────────────────────────────────────────
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
  isAutomatic: true,
  autoConditionKey: true,
  isActive: true,
  isHidden: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
} as const;

const serializeBadge = (b: any) => ({
  ...b,
  createdAt: b.createdAt?.toISOString?.() ?? b.createdAt,
  updatedAt: b.updatedAt?.toISOString?.() ?? b.updatedAt,
});

// ─── GET /badges ──────────────────────────────────────────────────────────────
// Public — returns all active badges (admin: all badges)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user?.isAdmin ?? false;
    const [badges, totalUsers] = await Promise.all([
      prisma.badge.findMany({
        where: isAdmin ? {} : { isActive: true },
        select: { ...BADGE_SELECT, _count: { select: { userBadges: true } } },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      prisma.user.count(),
    ]);
    res.json({
      badges: badges.map((b) => {
        const { _count, ...rest } = b;
        return { ...serializeBadge(rest), ownerCount: _count.userBadges };
      }),
      totalUsers,
    });
  } catch (error) {
    console.error('GET /badges error:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// ─── GET /badges/:id ──────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const badge = await prisma.badge.findUnique({
      where: { id: req.params.id },
      select: {
        ...BADGE_SELECT,
        _count: { select: { userBadges: true } },
      },
    });
    if (!badge) return res.status(404).json({ error: 'Badge not found' });
    res.json({ badge: serializeBadge(badge) });
  } catch (error) {
    console.error('GET /badges/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch badge' });
  }
});

// ─── GET /badges/user/:userId ─────────────────────────────────────────────────
// Returns the badges a user has earned + which slots they have equipped
router.get('/user/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const [user, userBadges] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { equippedBadge1Id: true, equippedBadge2Id: true },
      }),
      prisma.userBadge.findMany({
        where: { userId },
        include: { badge: { select: BADGE_SELECT } },
        orderBy: { obtainedAt: 'desc' },
      }),
    ]);

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      equippedBadge1Id: user.equippedBadge1Id,
      equippedBadge2Id: user.equippedBadge2Id,
      badges: userBadges.map((ub) => ({
        ...serializeBadge(ub.badge),
        obtainedAt: ub.obtainedAt.toISOString(),
        obtainedReason: ub.obtainedReason,
      })),
    });
  } catch (error) {
    console.error('GET /badges/user/:userId error:', error);
    res.status(500).json({ error: 'Failed to fetch user badges' });
  }
});

// ─── POST /badges/equip ───────────────────────────────────────────────────────
// Body: { slot: 1 | 2, badgeId: string | null }
// badgeId null = unequip that slot
router.post('/equip', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const { slot, badgeId } = req.body as { slot: 1 | 2; badgeId: string | null };

    if (slot !== 1 && slot !== 2) {
      return res.status(400).json({ error: 'slot must be 1 or 2' });
    }

    if (badgeId !== null && typeof badgeId !== 'string') {
      return res.status(400).json({ error: 'badgeId must be a string or null' });
    }

    if (badgeId !== null) {
      // Verify user owns this badge
      const owned = await prisma.userBadge.findUnique({
        where: { userId_badgeId: { userId: req.user.id, badgeId } },
      });
      if (!owned) return res.status(403).json({ error: 'You do not own this badge' });

      // Prevent equipping the same badge in both slots
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { equippedBadge1Id: true, equippedBadge2Id: true },
      });
      if (
        (slot === 1 && currentUser?.equippedBadge2Id === badgeId) ||
        (slot === 2 && currentUser?.equippedBadge1Id === badgeId)
      ) {
        return res.status(400).json({ error: 'Cannot equip the same badge in both slots' });
      }
    }

    const field = slot === 1 ? 'equippedBadge1Id' : 'equippedBadge2Id';
    await prisma.user.update({
      where: { id: req.user.id },
      data: { [field]: badgeId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('POST /badges/equip error:', error);
    res.status(500).json({ error: 'Failed to equip badge' });
  }
});

// ─── Admin: POST /badges ──────────────────────────────────────────────────────
router.post('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, description, howToObtain,
      backgroundType, backgroundColor, backgroundGradient, backgroundImage,
      icon, iconColor, borderColor,
      category, rarity, isAutomatic, autoConditionKey, isActive, isHidden,
    } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: 'name and description are required' });
    }

    const badge = await prisma.badge.create({
      data: {
        name, description,
        howToObtain: howToObtain ?? null,
        backgroundType: backgroundType ?? 'solid',
        backgroundColor: backgroundColor ?? '#374151',
        backgroundGradient: backgroundGradient ?? null,
        backgroundImage: backgroundImage ?? null,
        icon: icon ?? '⭐',
        iconColor: iconColor ?? '#ffffff',
        borderColor: borderColor ?? '#6b7280',
        category: category ?? 'special',
        rarity: rarity ?? 'common',
        isAutomatic: isAutomatic ?? false,
        autoConditionKey: autoConditionKey ?? null,
        isActive: isActive ?? true,
        isHidden: isHidden ?? false,
        createdById: req.user!.id,
      },
      select: BADGE_SELECT,
    });

    res.status(201).json({ badge: serializeBadge(badge) });
  } catch (error) {
    console.error('POST /badges error:', error);
    res.status(500).json({ error: 'Failed to create badge' });
  }
});

// ─── Admin: PUT /badges/:id ───────────────────────────────────────────────────
router.put('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, description, howToObtain,
      backgroundType, backgroundColor, backgroundGradient, backgroundImage,
      icon, iconColor, borderColor,
      category, rarity, isAutomatic, autoConditionKey, isActive, isHidden,
    } = req.body;

    const badge = await prisma.badge.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(howToObtain !== undefined && { howToObtain }),
        ...(backgroundType !== undefined && { backgroundType }),
        ...(backgroundColor !== undefined && { backgroundColor }),
        ...(backgroundGradient !== undefined && { backgroundGradient }),
        ...(backgroundImage !== undefined && { backgroundImage }),
        ...(icon !== undefined && { icon }),
        ...(iconColor !== undefined && { iconColor }),
        ...(borderColor !== undefined && { borderColor }),
        ...(category !== undefined && { category }),
        ...(rarity !== undefined && { rarity }),
        ...(isAutomatic !== undefined && { isAutomatic }),
        ...(autoConditionKey !== undefined && { autoConditionKey }),
        ...(isActive !== undefined && { isActive }),
        ...(isHidden !== undefined && { isHidden }),
      },
      select: BADGE_SELECT,
    });

    res.json({ badge: serializeBadge(badge) });
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Badge not found' });
    console.error('PUT /badges/:id error:', error);
    res.status(500).json({ error: 'Failed to update badge' });
  }
});

// ─── Admin: DELETE /badges/:id ────────────────────────────────────────────────
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.badge.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') return res.status(404).json({ error: 'Badge not found' });
    console.error('DELETE /badges/:id error:', error);
    res.status(500).json({ error: 'Failed to delete badge' });
  }
});

// ─── Admin: POST /badges/award ────────────────────────────────────────────────
// Body: { userId, badgeId, reason? }
router.post('/award', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, badgeId, reason } = req.body as {
      userId: string; badgeId: string; reason?: string;
    };
    if (!userId || !badgeId) {
      return res.status(400).json({ error: 'userId and badgeId are required' });
    }

    const [userExists, badgeExists] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.badge.findUnique({ where: { id: badgeId }, select: { id: true } }),
    ]);
    if (!userExists) return res.status(404).json({ error: 'User not found' });
    if (!badgeExists) return res.status(404).json({ error: 'Badge not found' });

    const awarded = await awardBadge(userId, badgeId, reason ?? `Attribué par un admin`);
    res.json({ success: true, alreadyOwned: !awarded });
  } catch (error) {
    console.error('POST /badges/award error:', error);
    res.status(500).json({ error: 'Failed to award badge' });
  }
});

// ─── Admin: DELETE /badges/revoke/:userId/:badgeId ────────────────────────────
router.delete('/revoke/:userId/:badgeId', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, badgeId } = req.params;
    const revoked = await revokeBadge(userId, badgeId);
    if (!revoked) return res.status(404).json({ error: 'User does not own this badge' });
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /badges/revoke error:', error);
    res.status(500).json({ error: 'Failed to revoke badge' });
  }
});

// ─── Admin: GET /badges/admin/all-users ──────────────────────────────────────
// Returns all users with their equipped badges (for admin overview)
router.get('/admin/all-users', authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        equippedBadge1Id: true,
        equippedBadge2Id: true,
        earnedBadges: {
          include: { badge: { select: BADGE_SELECT } },
          orderBy: { obtainedAt: 'desc' },
        },
      },
      orderBy: { username: 'asc' },
    });

    res.json({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        equippedBadge1Id: u.equippedBadge1Id,
        equippedBadge2Id: u.equippedBadge2Id,
        badges: u.earnedBadges.map((ub: any) => ({
          ...serializeBadge(ub.badge),
          obtainedAt: ub.obtainedAt.toISOString(),
          obtainedReason: ub.obtainedReason,
        })),
      })),
    });
  } catch (error) {
    console.error('GET /badges/admin/all-users error:', error);
    res.status(500).json({ error: 'Failed to fetch user badge data' });
  }
});

// ─── Admin: POST /badges/check-auto ──────────────────────────────────────────
// Manually trigger the auto-badge check + auto-equip pass
router.post('/check-auto', authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    await checkAndUpdateAutoBadges();
    await autoEquipDefaultBadges();
    res.json({ success: true, message: 'Auto-badge check + auto-equip completed' });
  } catch (error) {
    console.error('POST /badges/check-auto error:', error);
    res.status(500).json({ error: 'Failed to run auto-badge check' });
  }
});

export default router;
