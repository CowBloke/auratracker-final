import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Middleware to check if user is admin
const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ========== ITEMS MANAGEMENT ==========

// Get all items (admin view)
router.get('/items', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.item.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  } catch (error) {
    console.error('Admin get items error:', error);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

// Create item
router.post('/items', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, type, price, auraCost, imageUrl, effect } = req.body;
    
    const item = await prisma.item.create({
      data: {
        name,
        description,
        type: type || 'COSMETIC',
        price: parseInt(price) || 0,
        auraCost: parseInt(auraCost) || 0,
        imageUrl,
        effect: typeof effect === 'string' ? effect : JSON.stringify(effect),
      },
    });
    
    res.status(201).json({ item });
  } catch (error) {
    console.error('Admin create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update item
router.put('/items/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, type, price, auraCost, imageUrl, effect } = req.body;
    
    const item = await prisma.item.update({
      where: { id },
      data: {
        name,
        description,
        type,
        price: parseInt(price) || 0,
        auraCost: parseInt(auraCost) || 0,
        imageUrl,
        effect: typeof effect === 'string' ? effect : JSON.stringify(effect),
      },
    });
    
    res.json({ item });
  } catch (error) {
    console.error('Admin update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete item
router.delete('/items/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.item.delete({
      where: { id },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Get all users with full details (admin only)
router.get('/users', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        aura: true,
        money: true,
        isAdmin: true,
        dailyAuraGiven: true,
        dailyAuraLimit: true,
        lastDailyReset: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    res.json({ users });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user (aura, money, dailyAuraLimit) - admin only
router.put('/users/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { aura, money, dailyAuraLimit } = req.body;

    // Build update data
    const updateData: { aura?: number; money?: number; dailyAuraLimit?: number } = {};
    
    if (aura !== undefined) {
      updateData.aura = parseInt(aura);
    }
    if (money !== undefined) {
      updateData.money = parseInt(money);
    }
    if (dailyAuraLimit !== undefined) {
      updateData.dailyAuraLimit = parseInt(dailyAuraLimit);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        aura: true,
        money: true,
        isAdmin: true,
        dailyAuraGiven: true,
        dailyAuraLimit: true,
        lastDailyReset: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user completely - admin only
router.delete('/users/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Don't allow deleting yourself
    if (req.user?.id === id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow deleting other admins
    if (user.isAdmin) {
      return res.status(400).json({ error: 'Cannot delete admin users' });
    }

    // Delete user (cascades to related records due to onDelete: Cascade in schema)
    await prisma.user.delete({
      where: { id },
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Clear all chat messages - admin only
router.delete('/chat', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.chatMessage.deleteMany({});

    res.json({ 
      success: true, 
      message: `Deleted ${result.count} chat messages` 
    });
  } catch (error) {
    console.error('Admin clear chat error:', error);
    res.status(500).json({ error: 'Failed to clear chat' });
  }
});

// ========== BUG REPORTS MANAGEMENT ==========

// Create bug report (any authenticated user)
router.post('/bugs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    
    if (title.length > 100) {
      return res.status(400).json({ error: 'Title must be less than 100 characters' });
    }
    
    if (description.length > 2000) {
      return res.status(400).json({ error: 'Description must be less than 2000 characters' });
    }
    
    const bugReport = await prisma.bugReport.create({
      data: {
        userId: req.user!.id,
        title: title.trim(),
        description: description.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    res.status(201).json({ bugReport });
  } catch (error) {
    console.error('Create bug report error:', error);
    res.status(500).json({ error: 'Failed to create bug report' });
  }
});

// Get all bug reports (admin only)
router.get('/bugs', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const bugReports = await prisma.bugReport.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json({ bugReports });
  } catch (error) {
    console.error('Admin get bug reports error:', error);
    res.status(500).json({ error: 'Failed to get bug reports' });
  }
});

// Update bug report status (admin only)
router.put('/bugs/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['PENDING', 'DONE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be PENDING or DONE' });
    }
    
    const bugReport = await prisma.bugReport.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === 'DONE' ? new Date() : null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    res.json({ bugReport });
  } catch (error) {
    console.error('Admin update bug report error:', error);
    res.status(500).json({ error: 'Failed to update bug report' });
  }
});

// Delete bug report (admin only)
router.delete('/bugs/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.bugReport.delete({
      where: { id },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete bug report error:', error);
    res.status(500).json({ error: 'Failed to delete bug report' });
  }
});

export default router;
