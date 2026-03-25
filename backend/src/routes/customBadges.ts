import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { awardBadge } from '../utils/badgeAwards.js';

const router = Router();

const REQUEST_SELECT = {
  id: true,
  userId: true,
  status: true,
  name: true,
  description: true,
  icon: true,
  backgroundColor: true,
  borderColor: true,
  rarity: true,
  adminNote: true,
  badgeId: true,
  pricePaid: true,
  createdAt: true,
  updatedAt: true,
} as const;

const serializeRequest = (r: any) => ({
  ...r,
  createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
  updatedAt: r.updatedAt?.toISOString?.() ?? r.updatedAt,
});

// ─── POST /custom-badges ──────────────────────────────────────────────────────
// Submit a custom badge request (one pending request per user)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { name, description, icon, backgroundColor, borderColor, rarity } = req.body;

    if (!name?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'name and description are required' });
    }

    // Only one pending request allowed at a time
    const existing = await prisma.customBadgeRequest.findFirst({
      where: { userId: req.user.id, status: 'pending' },
    });
    if (existing) {
      return res.status(409).json({ error: 'Tu as déjà une demande de badge en attente' });
    }

    const request = await prisma.customBadgeRequest.create({
      data: {
        userId: req.user.id,
        name: name.trim(),
        description: description.trim(),
        icon: icon ?? '⭐',
        backgroundColor: backgroundColor ?? '#374151',
        borderColor: borderColor ?? '#6b7280',
        rarity: rarity ?? 'common',
      },
      select: REQUEST_SELECT,
    });

    // Notify all admins
    const admins = await prisma.user.findMany({
      where: { isAdmin: true, isApproved: true },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: 'ADMIN',
          title: 'Nouvelle demande de badge',
          body: `${req.user!.username} souhaite créer le badge "${name.trim()}"`,
          link: '/admin?tab=badges',
          icon: 'Award',
          data: {
            requestId: request.id,
            requesterId: req.user!.id,
            requesterUsername: req.user!.username,
          },
        }),
      ),
    );

    res.status(201).json({ request: serializeRequest(request) });
  } catch (error) {
    console.error('POST /custom-badges error:', error);
    res.status(500).json({ error: 'Failed to submit custom badge request' });
  }
});

// ─── GET /custom-badges/my ────────────────────────────────────────────────────
// Get the current user's own custom badge requests
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const requests = await prisma.customBadgeRequest.findMany({
      where: { userId: req.user.id },
      select: {
        ...REQUEST_SELECT,
        badge: {
          select: {
            id: true, name: true, description: true,
            icon: true, iconColor: true,
            backgroundColor: true, backgroundType: true, backgroundGradient: true,
            borderColor: true, rarity: true, category: true, isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ requests: requests.map(serializeRequest) });
  } catch (error) {
    console.error('GET /custom-badges/my error:', error);
    res.status(500).json({ error: 'Failed to fetch your custom badge requests' });
  }
});

// ─── Admin: GET /custom-badges/pending ───────────────────────────────────────
router.get('/pending', authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.customBadgeRequest.findMany({
      where: { status: 'pending' },
      select: {
        ...REQUEST_SELECT,
        user: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ requests: requests.map(serializeRequest) });
  } catch (error) {
    console.error('GET /custom-badges/pending error:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// ─── Admin: POST /custom-badges/:id/approve ──────────────────────────────────
router.post('/:id/approve', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const request = await prisma.customBadgeRequest.findUnique({
      where: { id: req.params.id },
      select: {
        ...REQUEST_SELECT,
        user: { select: { id: true, username: true } },
      },
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(409).json({ error: 'Request already processed' });

    const { adminNote } = req.body as { adminNote?: string };

    // Create the badge with category 'custom' — filtered from other users' catalogs
    const badge = await prisma.badge.create({
      data: {
        name: request.name,
        description: request.description,
        icon: request.icon,
        backgroundColor: request.backgroundColor,
        borderColor: request.borderColor,
        rarity: request.rarity,
        category: 'custom',
        createdById: request.userId,
        isActive: true,
        isHidden: false,
      },
    });

    await prisma.customBadgeRequest.update({
      where: { id: request.id },
      data: { status: 'approved', adminNote: adminNote ?? null, badgeId: badge.id },
    });

    await awardBadge(request.userId, badge.id, 'Badge personnalisé approuvé');

    await createNotification({
      userId: request.userId,
      type: 'BADGE_EARNED',
      title: 'Badge personnalisé approuvé !',
      body: `Ton badge "${request.name}" a été approuvé. Tu peux maintenant l'équiper sur ton profil !`,
      link: `/profile/${request.userId}`,
      icon: 'Award',
      data: { badgeId: badge.id },
    });

    res.json({ success: true, badge });
  } catch (error) {
    console.error('POST /custom-badges/:id/approve error:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// ─── Admin: POST /custom-badges/:id/reject ───────────────────────────────────
router.post('/:id/reject', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const request = await prisma.customBadgeRequest.findUnique({
      where: { id: req.params.id },
      select: { ...REQUEST_SELECT, user: { select: { id: true, username: true } } },
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(409).json({ error: 'Request already processed' });

    const { adminNote } = req.body as { adminNote?: string };

    await prisma.$transaction(async (tx) => {
      await tx.customBadgeRequest.update({
        where: { id: request.id },
        data: { status: 'rejected', adminNote: adminNote ?? null },
      });
      if (request.pricePaid > 0) {
        await tx.user.update({
          where: { id: request.userId },
          data: { money: { increment: request.pricePaid } },
        });
      }
    });

    await createNotification({
      userId: request.userId,
      type: 'SYSTEM',
      title: 'Badge personnalisé refusé',
      body: adminNote
        ? `Ta demande de badge "${request.name}" a été refusée. Raison : ${adminNote}. Tu as été remboursé $${request.pricePaid}.`
        : `Ta demande de badge "${request.name}" a été refusée. Tu as été remboursé $${request.pricePaid}.`,
      icon: 'X',
      data: { requestId: request.id, refunded: request.pricePaid },
    });

    res.json({ success: true, refunded: request.pricePaid });
  } catch (error) {
    console.error('POST /custom-badges/:id/reject error:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

export default router;
