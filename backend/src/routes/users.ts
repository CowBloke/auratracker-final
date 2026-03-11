import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();
const ANNOUNCEMENT_KEY = 'topbar_announcement';

// Get all users (for the 40-user community)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        schoolLevel: true,
        classLetter: true,
        aura: true,
        money: true,
        auraCoinBalance: true,
        usernameColor: true,
        profilePicture: true,
        bio: true,
        createdAt: true,
      },
      orderBy: {
        aura: 'desc',
      },
    });
    
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get top bar announcement (all authenticated users)
router.get('/announcement', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const setting = await prisma.gameSettings.findUnique({
      where: { key: ANNOUNCEMENT_KEY },
    });

    res.json({ message: setting?.value || '' });
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ error: 'Failed to get announcement' });
  }
});

// Get pending update popups for the current user
router.get('/update-popups/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const popups = await prisma.updatePopup.findMany({
      where: {
        isPublished: true,
        releaseDate: { lte: now },
        views: {
          none: {
            userId: req.user!.id,
          },
        },
      },
      orderBy: [
        { releaseDate: 'asc' },
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        title: true,
        summary: true,
        message: true,
        imageUrl: true,
        releaseDate: true,
        createdAt: true,
      },
    });

    res.json({ popups });
  } catch (error) {
    console.error('Get pending update popups error:', error);
    res.status(500).json({ error: 'Failed to get pending update popups' });
  }
});

// Mark an update popup as viewed for current user
router.post('/update-popups/:id/viewed', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const popup = await prisma.updatePopup.findUnique({
      where: { id },
      select: { id: true, isPublished: true },
    });

    if (!popup || !popup.isPublished) {
      return res.status(404).json({ error: 'Update popup not found' });
    }

    await prisma.userUpdatePopupView.upsert({
      where: {
        userId_popupId: {
          userId: req.user!.id,
          popupId: id,
        },
      },
      create: {
        userId: req.user!.id,
        popupId: id,
      },
      update: {
        viewedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark update popup viewed error:', error);
    res.status(500).json({ error: 'Failed to mark popup as viewed' });
  }
});

// Get user by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const [user, auraCoinAggregate] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          firstName: true,
          schoolLevel: true,
          classLetter: true,
          aura: true,
          money: true,
          auraCoinBalance: true,
          usernameColor: true,
          profilePicture: true,
          bio: true,
          createdAt: true,
          gameStats: {
            select: {
              gameType: true,
              wins: true,
              losses: true,
              highScore: true,
              totalPlayed: true,
            },
          },
        },
      }),
      prisma.auraCoinTransaction.aggregate({
        where: { userId: id },
        _count: { _all: true },
        _sum: { moneyAmount: true },
      }),
    ]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      user: {
        ...user,
        auraCoinStats: {
          transactionCount: auraCoinAggregate._count._all,
          totalMoney: auraCoinAggregate._sum.moneyAmount ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Only allow users to update their own profile
    if (req.user?.id !== id && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { username, bio } = req.body;

    if (username) {
      // Check if username is taken
      const existing = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id },
        },
      });

      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const updateData: { username?: string; bio?: string } = {};
    if (username) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio?.trim() || null;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        schoolLevel: true,
        classLetter: true,
        aura: true,
        money: true,
        auraCoinBalance: true,
        isAdmin: true,
        usernameColor: true,
        profilePicture: true,
        bio: true,
        createdAt: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /users/name-change-request – request a username change (authenticated)
router.post('/name-change-request', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { requestedUsername, reason } = req.body;

    if (!requestedUsername || typeof requestedUsername !== 'string') {
      return res.status(400).json({ error: 'requestedUsername is required' });
    }

    const trimmed = requestedUsername.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      return res.status(400).json({ error: 'Le pseudo doit faire entre 3 et 20 caractères' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return res.status(400).json({ error: 'Le pseudo ne peut contenir que des lettres, chiffres et underscores' });
    }

    const userId = req.user!.id;

    // Check if username is already taken
    const existing = await prisma.user.findFirst({ where: { username: trimmed, NOT: { id: userId } } });
    if (existing) {
      return res.status(400).json({ error: 'Ce pseudo est déjà pris' });
    }

    // Block if there's already a pending request from this user
    const pending = await prisma.nameChangeRequest.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (pending) {
      return res.status(400).json({ error: 'Vous avez déjà une demande en attente' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });

    const request = await prisma.nameChangeRequest.create({
      data: {
        userId,
        currentUsername: currentUser!.username,
        requestedUsername: trimmed,
        reason: reason?.trim() || null,
      },
    });

    const admins = await prisma.user.findMany({
      where: { isAdmin: true, isApproved: true },
      select: { id: true },
    });

    await Promise.allSettled(admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: 'SYSTEM',
        title: 'Nouvelle demande de pseudo',
        body: `${currentUser!.username} demande le pseudo ${trimmed}.`,
        data: {
          requestId: request.id,
          userId,
          currentUsername: currentUser!.username,
          requestedUsername: trimmed,
        },
        link: '/admin',
        icon: 'user-round-pen',
      })
    ));

    res.status(201).json({ request });
  } catch (error) {
    console.error('Name change request error:', error);
    res.status(500).json({ error: 'Failed to submit name change request' });
  }
});

// ========== ADMIN WARNINGS ==========

// Get unacknowledged warnings for current user
router.get('/warnings/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const warnings = await prisma.adminWarning.findMany({
      where: {
        userId: req.user!.id,
        isAcknowledged: false,
      },
      include: {
        issuedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ warnings });
  } catch (error) {
    console.error('Get pending warnings error:', error);
    res.status(500).json({ error: 'Failed to get pending warnings' });
  }
});

// Acknowledge a warning
router.post('/warnings/:id/acknowledge', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const warning = await prisma.adminWarning.findUnique({
      where: { id },
      select: { id: true, userId: true, isAcknowledged: true },
    });

    if (!warning) {
      return res.status(404).json({ error: 'Warning not found' });
    }

    // Ensure user can only acknowledge their own warnings
    if (warning.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Cannot acknowledge another user\'s warning' });
    }

    if (warning.isAcknowledged) {
      return res.json({ success: true, message: 'Warning already acknowledged' });
    }

    await prisma.adminWarning.update({
      where: { id },
      data: {
        isAcknowledged: true,
        acknowledgedAt: new Date(),
      },
    });

    res.json({ success: true, message: 'Warning acknowledged' });
  } catch (error) {
    console.error('Acknowledge warning error:', error);
    res.status(500).json({ error: 'Failed to acknowledge warning' });
  }
});

export default router;
