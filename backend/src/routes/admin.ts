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

// ========== PENDING USERS MANAGEMENT ==========

// Get pending users (awaiting approval)
router.get('/pending-users', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { isApproved: false },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ pendingUsers });
  } catch (error) {
    console.error('Admin get pending users error:', error);
    res.status(500).json({ error: 'Failed to get pending users' });
  }
});

// Approve a user
router.post('/users/:id/approve', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.update({
      where: { id },
      data: { isApproved: true },
      select: {
        id: true,
        username: true,
        email: true,
        isApproved: true,
        createdAt: true,
      },
    });
    
    res.json({ success: true, user, message: 'Utilisateur approuvé' });
  } catch (error) {
    console.error('Admin approve user error:', error);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Reject (delete) a pending user
router.post('/users/:id/reject', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check that user is pending
    const user = await prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.isApproved) {
      return res.status(400).json({ error: 'Cannot reject an already approved user' });
    }
    
    await prisma.user.delete({
      where: { id },
    });
    
    res.json({ success: true, message: 'Demande rejetée' });
  } catch (error) {
    console.error('Admin reject user error:', error);
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

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

// Get all approved users with full details (admin only)
router.get('/users', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { isApproved: true }, // Only return approved users
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
    const { aura, money, dailyAuraLimit, username } = req.body;

    // Build update data
    const updateData: { aura?: number; money?: number; dailyAuraLimit?: number; username?: string } = {};

    if (username !== undefined) {
      if (typeof username !== 'string') {
        return res.status(400).json({ error: 'Invalid username' });
      }
      const trimmedUsername = username.trim();
      if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
      }
      const existing = await prisma.user.findFirst({
        where: {
          username: trimmedUsername,
          NOT: { id },
        },
        select: { id: true },
      });
      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      updateData.username = trimmedUsername;
    }
    
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

// ========== USER INVENTORY MANAGEMENT ==========

// Get a user's inventory (admin only)
router.get('/users/:id/inventory', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const items = await prisma.userItem.findMany({
      where: { userId: id },
      include: { item: true },
      orderBy: { acquiredAt: 'desc' },
    });

    res.json({ items });
  } catch (error) {
    console.error('Admin get user inventory error:', error);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

// Add an item to a user's inventory (admin only)
router.post('/users/:id/inventory', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { itemId, quantity = 1 } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    if (parseInt(quantity) <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const [user, item] = await Promise.all([
      prisma.user.findUnique({ where: { id }, select: { id: true } }),
      prisma.item.findUnique({ where: { id: itemId }, select: { id: true } }),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const userItem = await prisma.userItem.upsert({
      where: {
        userId_itemId: {
          userId: id,
          itemId,
        },
      },
      create: {
        userId: id,
        itemId,
        quantity: parseInt(quantity),
      },
      update: {
        quantity: { increment: parseInt(quantity) },
      },
      include: { item: true },
    });

    res.status(201).json({ item: userItem });
  } catch (error) {
    console.error('Admin add user inventory item error:', error);
    res.status(500).json({ error: 'Failed to add inventory item' });
  }
});

// Update a user's inventory item quantity (admin only)
router.patch('/users/:id/inventory/:userItemId', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id, userItemId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({ error: 'Quantity is required' });
    }

    const userItem = await prisma.userItem.findUnique({
      where: { id: userItemId },
      select: { id: true, userId: true },
    });

    if (!userItem || userItem.userId !== id) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const parsedQuantity = parseInt(quantity);

    if (parsedQuantity <= 0) {
      await prisma.userItem.delete({ where: { id: userItemId } });
      return res.json({ removed: true });
    }

    const updatedItem = await prisma.userItem.update({
      where: { id: userItemId },
      data: { quantity: parsedQuantity },
      include: { item: true },
    });

    res.json({ item: updatedItem });
  } catch (error) {
    console.error('Admin update user inventory item error:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// Remove an item from a user's inventory (admin only)
router.delete('/users/:id/inventory/:userItemId', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id, userItemId } = req.params;

    const userItem = await prisma.userItem.findUnique({
      where: { id: userItemId },
      select: { id: true, userId: true },
    });

    if (!userItem || userItem.userId !== id) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    await prisma.userItem.delete({ where: { id: userItemId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user inventory item error:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
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

// ========== BAN SYSTEM ==========

// Get all bans (admin only)
router.get('/bans', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const bans = await prisma.ban.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        admin: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ bans });
  } catch (error) {
    console.error('Admin get bans error:', error);
    res.status(500).json({ error: 'Failed to get bans' });
  }
});

// Create a ban (admin only)
router.post('/bans', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, reason, type, durationHours } = req.body;

    if (!userId || !reason || !type) {
      return res.status(400).json({ error: 'User ID, reason, and type are required' });
    }

    if (!['TEMPORARY', 'PERMANENT'].includes(type)) {
      return res.status(400).json({ error: 'Type must be TEMPORARY or PERMANENT' });
    }

    if (type === 'TEMPORARY' && (!durationHours || durationHours <= 0)) {
      return res.status(400).json({ error: 'Duration in hours is required for temporary bans' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isAdmin: true, username: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow banning admins
    if (user.isAdmin) {
      return res.status(400).json({ error: 'Cannot ban admin users' });
    }

    // Deactivate any existing active bans for this user
    await prisma.ban.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create the ban
    const expiresAt = type === 'TEMPORARY'
      ? new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000)
      : null;

    const ban = await prisma.ban.create({
      data: {
        userId,
        bannedBy: req.user!.id,
        reason: reason.trim(),
        type,
        expiresAt,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        admin: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    res.status(201).json({ ban, message: `${user.username} has been banned` });
  } catch (error) {
    console.error('Admin create ban error:', error);
    res.status(500).json({ error: 'Failed to create ban' });
  }
});

// Unban a user (admin only)
router.delete('/bans/:userId', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    // Deactivate all active bans for this user
    const result = await prisma.ban.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'No active ban found for this user' });
    }

    res.json({ success: true, message: 'User has been unbanned' });
  } catch (error) {
    console.error('Admin unban user error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

export default router;
