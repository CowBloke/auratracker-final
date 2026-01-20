import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
const ANNOUNCEMENT_KEY = 'topbar_announcement';

// Get all users (for the 40-user community)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
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
          aura: true,
          money: true,
          auraCoinBalance: true,
          usernameColor: true,
          profilePicture: true,
          bio: true,
          createdAt: true,
          userBadges: {
            where: { isSelected: true },
            select: {
              id: true,
              assignedAt: true,
              badge: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  color: true,
                },
              },
            },
            orderBy: { assignedAt: 'desc' },
            take: 2,
          },
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
    
    const { userBadges, ...userData } = user;
    const badges = userBadges.map((userBadge) => ({
      id: userBadge.badge.id,
      name: userBadge.badge.name,
      description: userBadge.badge.description,
      color: userBadge.badge.color,
      assignedAt: userBadge.assignedAt,
      userBadgeId: userBadge.id,
    }));

    res.json({
      user: {
        ...userData,
        badges,
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

// Get current user's badges
router.get('/me/badges', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userBadges = await prisma.userBadge.findMany({
      where: { userId: req.user!.id },
      include: {
        badge: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
          }
        }
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({ badges: userBadges });
  } catch (error) {
    console.error('Get user badges error:', error);
    res.status(500).json({ error: 'Failed to get badges' });
  }
});

// Update selected badges (limit 2)
router.put('/me/badges/selected', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { badgeIds } = req.body;

    if (!Array.isArray(badgeIds)) {
      return res.status(400).json({ error: 'badgeIds must be an array' });
    }

    if (badgeIds.length > 2) {
      return res.status(400).json({ error: 'You can only select up to 2 badges' });
    }

    // Verify user owns all these badges
    const userBadges = await prisma.userBadge.findMany({
      where: {
        userId: req.user!.id,
        badgeId: { in: badgeIds },
      },
    });

    if (userBadges.length !== badgeIds.length) {
      return res.status(400).json({ error: 'You do not own all selected badges' });
    }

    // Deselect all badges first
    await prisma.userBadge.updateMany({
      where: { userId: req.user!.id },
      data: { isSelected: false },
    });

    // Select the chosen badges
    if (badgeIds.length > 0) {
      await prisma.userBadge.updateMany({
        where: {
          userId: req.user!.id,
          badgeId: { in: badgeIds },
        },
        data: { isSelected: true },
      });
    }

    // Return updated badges
    const updatedBadges = await prisma.userBadge.findMany({
      where: { userId: req.user!.id },
      include: {
        badge: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
          }
        }
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({ badges: updatedBadges });
  } catch (error) {
    console.error('Update selected badges error:', error);
    res.status(500).json({ error: 'Failed to update selected badges' });
  }
});

export default router;
