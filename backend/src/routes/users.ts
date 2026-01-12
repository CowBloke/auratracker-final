import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all users (for the 40-user community)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        aura: true,
        money: true,
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

// Get user by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        aura: true,
        money: true,
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
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
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
    
    const { username } = req.body;
    
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
    
    const user = await prisma.user.update({
      where: { id },
      data: { username },
      select: {
        id: true,
        username: true,
        email: true,
        aura: true,
        money: true,
        isAdmin: true,
        createdAt: true,
      },
    });
    
    res.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;
