import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, adminRareActionSchema } from '../middleware/validation.js';
import { logAdmin, logSuggestion, logBan } from '../utils/logger.js';
import { isAllowedImageUrl } from '../utils/uploads.js';
import { listBombPartyLanguageFiles } from '../utils/bombpartyDictionary.js';
import { recalculateBombPartyPrompts } from '../utils/bombpartyPrompts.js';
import { getOnlineCount, getOnlineUsers } from '../socket/chat.js';

const router = Router();
const ANNOUNCEMENT_KEY = 'topbar_announcement';
const ANNOUNCEMENT_MAX_LENGTH = 120;
const UPDATE_POPUP_UPLOAD_DIR = path.resolve('uploads', 'update-popups');
const ITEM_UPLOAD_DIR = path.resolve('uploads', 'items');
const MAX_UPDATE_POPUP_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ITEM_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const ensureUpdatePopupUploadDir = () => {
  if (!fs.existsSync(UPDATE_POPUP_UPLOAD_DIR)) {
    fs.mkdirSync(UPDATE_POPUP_UPLOAD_DIR, { recursive: true });
  }
};

const inferImageExtension = (mimeType: string) => {
  switch (mimeType.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return null;
  }
};

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
        firstName: true,
        email: true,
        motivationMessage: true,
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
    
    // Log approval
    logAdmin('user_approve', req.user!.id, undefined, id, user.username, { email: user.email });

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
    
    // Log rejection
    logAdmin('user_reject', req.user!.id, undefined, id, user.username, { email: user.email });

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
    const { name, description, type, price, imageUrl, effect } = req.body;

    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }
    
    const item = await prisma.item.create({
      data: {
        name,
        description,
        type: type || 'COSMETIC',
        price: parseInt(price) || 0,
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
    const { name, description, type, price, imageUrl, effect } = req.body;

    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }
    
    const item = await prisma.item.update({
      where: { id },
      data: {
        name,
        description,
        type,
        price: parseInt(price) || 0,
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
        firstName: true,
        email: true,
        aura: true,
        money: true,
        auraCoinBalance: true,
        isAdmin: true,
        isChatMuted: true,
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
    const { aura, money, auraCoinBalance, dailyAuraLimit, username, firstName, password, isChatMuted } = req.body;

    // Build update data
    const updateData: { aura?: number; money?: number; auraCoinBalance?: number; dailyAuraLimit?: number; username?: string; firstName?: string | null; passwordHash?: string; isChatMuted?: boolean } = {};

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

    if (firstName !== undefined) {
      if (firstName === null) {
        updateData.firstName = null;
      } else if (typeof firstName === 'string') {
        const trimmedFirstName = firstName.trim();
        if (trimmedFirstName.length === 0) {
          updateData.firstName = null;
        } else if (trimmedFirstName.length > 50) {
          return res.status(400).json({ error: 'First name must be 50 characters or less' });
        } else {
          updateData.firstName = trimmedFirstName;
        }
      } else {
        return res.status(400).json({ error: 'Invalid first name' });
      }
    }
    
    if (aura !== undefined) {
      updateData.aura = parseInt(aura);
    }
    if (money !== undefined) {
      updateData.money = parseInt(money);
    }
    if (auraCoinBalance !== undefined) {
      updateData.auraCoinBalance = parseFloat(auraCoinBalance);
    }
    if (dailyAuraLimit !== undefined) {
      updateData.dailyAuraLimit = parseInt(dailyAuraLimit);
    }
    if (isChatMuted !== undefined) {
      if (typeof isChatMuted !== 'boolean') {
        return res.status(400).json({ error: 'Invalid chat mute status' });
      }
      updateData.isChatMuted = isChatMuted;
    }
    if (password !== undefined) {
      if (typeof password !== 'string') {
        return res.status(400).json({ error: 'Invalid password' });
      }
      const normalizedPassword = password.trim();
      if (normalizedPassword.length < 6 || normalizedPassword.length > 100) {
        return res.status(400).json({ error: 'Password must be between 6 and 100 characters' });
      }
      updateData.passwordHash = await bcrypt.hash(normalizedPassword, 10);
    }

    // Get old user data for logging
    const oldUser = await prisma.user.findUnique({
      where: { id },
      select: { username: true, firstName: true, aura: true, money: true, auraCoinBalance: true, dailyAuraLimit: true, isChatMuted: true },
    });

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        firstName: true,
        email: true,
        aura: true,
        money: true,
        auraCoinBalance: true,
        isAdmin: true,
        isChatMuted: true,
        dailyAuraGiven: true,
        dailyAuraLimit: true,
        lastDailyReset: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log user update
    const logChanges = { ...updateData } as { [key: string]: unknown };
    if (logChanges.passwordHash) {
      delete logChanges.passwordHash;
    }

    logAdmin('user_update', req.user!.id, undefined, id, user.username, {
      changes: logChanges,
      passwordChanged: Boolean(updateData.passwordHash),
      oldValues: {
        username: oldUser?.username,
        firstName: oldUser?.firstName,
        aura: oldUser?.aura,
        money: oldUser?.money,
        auraCoinBalance: oldUser?.auraCoinBalance,
        dailyAuraLimit: oldUser?.dailyAuraLimit,
        isChatMuted: oldUser?.isChatMuted,
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

    // Get user info for logging
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { username: true },
    });

    // Log inventory add
    logAdmin('inventory_add', req.user!.id, undefined, id, targetUser?.username || undefined, {
      itemId,
      itemName: userItem.item.name,
      quantity: parseInt(quantity),
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

    // Log user deletion
    logAdmin('user_delete', req.user!.id, undefined, id, user.username, { email: user.email });

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

// Rare admin actions (grouped for cleanliness)
router.post('/rare', authMiddleware, requireAdmin, validate(adminRareActionSchema), async (req: AuthRequest, res: Response) => {
  const { action } = req.body;

  try {
    if (action === 'chat_clear') {
      const result = await prisma.chatMessage.deleteMany({});

      logAdmin('chat_clear', req.user!.id, undefined, undefined, undefined, {
        messagesDeleted: result.count,
      });

      return res.json({
        success: true,
        message: `Deleted ${result.count} chat messages`,
        messagesDeleted: result.count,
      });
    }

    if (action === 'reset_extreme_aura') {
      const threshold = typeof req.body.threshold === 'number' ? req.body.threshold : 1000000000;

      const usersToReset = await prisma.user.findMany({
        where: {
          aura: { gt: BigInt(threshold) }
        },
        select: {
          id: true,
          username: true,
          aura: true,
        },
      });

      if (usersToReset.length === 0) {
        return res.json({
          success: true,
          message: 'No users found with extreme aura values',
          usersReset: 0,
          users: []
        });
      }

      await prisma.user.updateMany({
        where: {
          aura: { gt: BigInt(threshold) }
        },
        data: {
          aura: BigInt(0)
        }
      });

      logAdmin('extreme_aura_reset', req.user!.id, undefined, undefined, undefined, {
        threshold,
        usersReset: usersToReset.length,
        users: usersToReset.map(u => ({ id: u.id, username: u.username, oldAura: u.aura.toString() })),
      });

      return res.json({
        success: true,
        message: `Reset aura for ${usersToReset.length} user(s) with values above ${threshold.toLocaleString()}`,
        usersReset: usersToReset.length,
        users: usersToReset.map(u => ({
          id: u.id,
          username: u.username,
          oldAura: u.aura.toString()
        }))
      });
    }

    if (action === 'deploy') {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        logAdmin('deploy_trigger', req.user!.id, req.user!.username, undefined, undefined, {
          timestamp: new Date().toISOString(),
        });

        const { stdout, stderr } = await execAsync('/var/scripts/deploy.sh', {
          timeout: 120000,
          cwd: '/',
        });

        return res.json({
          success: true,
          message: 'Deploy script executed successfully',
          stdout: stdout || '',
          stderr: stderr || '',
        });
      } catch (error: unknown) {
        console.error('Deploy script error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorOutput = (error as { stderr?: string })?.stderr || '';
        return res.status(500).json({
          error: 'Deploy script failed',
          message: errorMessage,
          stderr: errorOutput,
        });
      }
    }

    return res.status(400).json({ error: 'Unknown admin action' });
  } catch (error) {
    console.error('Admin rare action error:', error);
    return res.status(500).json({ error: 'Failed to run admin action' });
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

    // Log bug report
    logSuggestion('bug_report', req.user!.id, bugReport.user.username, {
      bugReportId: bugReport.id,
      title: bugReport.title,
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

// ========== ACTIVITY LOGS ==========

// Get activity logs (admin only)
router.get('/logs', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      action,
      username,
      gameType,
      limit = '100',
      offset = '0',
      startDate,
      endDate,
    } = req.query;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (type && type !== 'ALL') {
      where.type = type as string;
    }

    if (action) {
      where.action = { contains: action as string };
    }

    if (username) {
      where.OR = [
        { username: { contains: username as string } },
        { targetName: { contains: username as string } },
      ];
    }

    // Filter by game type in metadata (for GAME type logs)
    if (gameType && gameType !== 'ALL') {
      where.metadata = { contains: `"gameType":"${gameType}"` };
    }

    if (startDate) {
      where.createdAt = { ...((where.createdAt as Record<string, Date>) || {}), gte: new Date(startDate as string) };
    }

    if (endDate) {
      where.createdAt = { ...((where.createdAt as Record<string, Date>) || {}), lte: new Date(endDate as string) };
    }

    const [logs, total] = await Promise.all([
      prisma.log.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit as string), 500),
        skip: parseInt(offset as string),
      }),
      prisma.log.count({ where }),
    ]);

    // Parse JSON fields for response
    const parsedLogs = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    res.json({ logs: parsedLogs, total });
  } catch (error) {
    console.error('Admin get logs error:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Download activity logs as CSV (admin only)
router.get('/logs/download', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      action,
      username,
      gameType,
      startDate,
      endDate,
    } = req.query;

    if (!startDate) {
      return res.status(400).json({ error: 'startDate is required' });
    }

    const where: Record<string, unknown> = {};

    if (type && type !== 'ALL') {
      where.type = type as string;
    }

    if (action) {
      where.action = { contains: action as string };
    }

    if (username) {
      where.OR = [
        { username: { contains: username as string } },
        { targetName: { contains: username as string } },
      ];
    }

    if (gameType && gameType !== 'ALL') {
      where.metadata = { contains: `"gameType":"${gameType}"` };
    }

    if (startDate) {
      where.createdAt = { ...((where.createdAt as Record<string, Date>) || {}), gte: new Date(startDate as string) };
    }

    if (endDate) {
      where.createdAt = { ...((where.createdAt as Record<string, Date>) || {}), lte: new Date(endDate as string) };
    }

    const logs = await prisma.log.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 10000,
    });

    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) {
        return '""';
      }
      const text = String(value).replace(/"/g, '""');
      return `"${text}"`;
    };

    const header = [
      'id',
      'type',
      'action',
      'userId',
      'username',
      'targetId',
      'targetName',
      'ipAddress',
      'createdAt',
      'details',
      'metadata',
    ].join(',');

    const rows = logs.map((log) => [
      escapeCsv(log.id),
      escapeCsv(log.type),
      escapeCsv(log.action),
      escapeCsv(log.userId),
      escapeCsv(log.username),
      escapeCsv(log.targetId),
      escapeCsv(log.targetName),
      escapeCsv(log.ipAddress),
      escapeCsv(log.createdAt.toISOString()),
      escapeCsv(log.details),
      escapeCsv(log.metadata),
    ].join(','));

    const csv = [header, ...rows].join('\n');
    const safeStart = new Date(startDate as string).toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="admin-logs-${safeStart}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Admin download logs error:', error);
    res.status(500).json({ error: 'Failed to download logs' });
  }
});

// Get log stats (admin only)
router.get('/logs/stats', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalLogs,
      authLogs,
      chatLogs,
      gameLogs,
      economyLogs,
      partyLogs,
      marketplaceLogs,
      adminLogs,
      banLogs,
      suggestionLogs,
      auraCoinLogs,
    ] = await Promise.all([
      prisma.log.count(),
      prisma.log.count({ where: { type: 'AUTH' } }),
      prisma.log.count({ where: { type: 'CHAT' } }),
      prisma.log.count({ where: { type: 'GAME' } }),
      prisma.log.count({ where: { type: 'ECONOMY' } }),
      prisma.log.count({ where: { type: 'PARTY' } }),
      prisma.log.count({ where: { type: 'MARKETPLACE' } }),
      prisma.log.count({ where: { type: 'ADMIN' } }),
      prisma.log.count({ where: { type: 'BAN' } }),
      prisma.log.count({ where: { type: 'SUGGESTION' } }),
      prisma.log.count({ where: { type: 'AURACOIN' } }),
    ]);

    res.json({
      total: totalLogs,
      byType: {
        AUTH: authLogs,
        CHAT: chatLogs,
        GAME: gameLogs,
        ECONOMY: economyLogs,
        PARTY: partyLogs,
        MARKETPLACE: marketplaceLogs,
        ADMIN: adminLogs,
        BAN: banLogs,
        SUGGESTION: suggestionLogs,
        AURACOIN: auraCoinLogs,
      },
    });
  } catch (error) {
    console.error('Admin get log stats error:', error);
    res.status(500).json({ error: 'Failed to get log stats' });
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

    // Log ban creation
    logBan('ban_create', req.user!.id, undefined, userId, user.username, {
      banType: type,
      reason: reason.trim(),
      expiresAt: expiresAt?.toISOString(),
      durationHours: type === 'TEMPORARY' ? parseInt(durationHours) : undefined,
    });

    const banMessage = type === 'PERMANENT'
      ? `Your account has been permanently banned. Reason: ${ban.reason}`
      : `Your account is temporarily banned until ${ban.expiresAt?.toISOString()}. Reason: ${ban.reason}`;
    io.to(`user:${userId}`).emit('ban:enforced', {
      message: banMessage,
      banned: true,
      ban: {
        reason: ban.reason,
        type: ban.type,
        expiresAt: ban.expiresAt ? ban.expiresAt.toISOString() : null,
      },
    });
    io.in(`user:${userId}`).disconnectSockets(true);

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

    // Get user info for logging
    const unbannedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    // Log unban
    logBan('ban_remove', req.user!.id, undefined, userId, unbannedUser?.username || undefined, {
      bansRemoved: result.count,
    });

    res.json({ success: true, message: 'User has been unbanned' });
  } catch (error) {
    console.error('Admin unban user error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// ========== GAME SETTINGS MANAGEMENT ==========

// Get all game settings (admin only)
router.get('/settings', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.gameSettings.findMany({
      orderBy: { key: 'asc' },
    });

    // Convert to key-value map for easier consumption
    const settingsMap: Record<string, string> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    res.json({ settings: settingsMap });
  } catch (error) {
    console.error('Admin get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Get a specific game setting (admin only)
router.get('/settings/:key', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;

    const setting = await prisma.gameSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ setting });
  } catch (error) {
    console.error('Admin get setting error:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

// Update a game setting (admin only)
router.put('/settings/:key', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const stringValue = String(value);
    const normalizedValue = key === ANNOUNCEMENT_KEY ? stringValue.trim() : stringValue;

    // Validate specific settings
    if (key === ANNOUNCEMENT_KEY && normalizedValue.length > ANNOUNCEMENT_MAX_LENGTH) {
      return res.status(400).json({ error: `Announcement must be ${ANNOUNCEMENT_MAX_LENGTH} characters or less` });
    }

    if (key.startsWith('bombparty_wpp_')) {
      const numValue = parseInt(normalizedValue);
      if (isNaN(numValue) || numValue < 1) {
        return res.status(400).json({ error: 'WPP values must be positive integers' });
      }
    }

    if (key === 'bombparty_3letter_start_round') {
      const numValue = parseInt(normalizedValue);
      if (isNaN(numValue) || numValue < 0) {
        return res.status(400).json({ error: 'Start round must be a non-negative integer' });
      }
    }

    if (key === 'bombparty_language') {
      const languages = listBombPartyLanguageFiles().map((lang) => lang.fileName);
      if (!languages.includes(normalizedValue)) {
        return res.status(400).json({ error: 'Invalid bombparty language selection' });
      }
    }

    const setting = await prisma.gameSettings.upsert({
      where: { key },
      create: { key, value: normalizedValue },
      update: { value: normalizedValue },
    });

    // Log setting update
    logAdmin('setting_update', req.user!.id, undefined, undefined, undefined, {
      key,
      value: normalizedValue,
    });

    // Clear cached settings in bombparty module if needed
    if (key.startsWith('bombparty_')) {
      try {
        // Dynamic import to avoid circular dependencies
        const { clearBombPartySettingsCache } = await import('../socket/bombparty.js');
        clearBombPartySettingsCache();
      } catch {
        // Ignore if function not available
      }
    }

    res.json({ setting });
  } catch (error) {
    console.error('Admin update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Update multiple game settings at once (admin only)
router.put('/settings', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const updates: { key: string; value: string }[] = [];
    const errors: string[] = [];

    // Validate all settings first
    for (const [key, value] of Object.entries(settings)) {
      const stringValue = String(value);
      const normalizedValue = key === ANNOUNCEMENT_KEY ? stringValue.trim() : stringValue;

      if (key === ANNOUNCEMENT_KEY && normalizedValue.length > ANNOUNCEMENT_MAX_LENGTH) {
        errors.push(`${key}: Announcement must be ${ANNOUNCEMENT_MAX_LENGTH} characters or less`);
        continue;
      }

      if (key.startsWith('bombparty_wpp_')) {
        const numValue = parseInt(normalizedValue);
        if (isNaN(numValue) || numValue < 1) {
          errors.push(`${key}: WPP values must be positive integers`);
          continue;
        }
      }

      if (key === 'bombparty_3letter_start_round') {
        const numValue = parseInt(normalizedValue);
        if (isNaN(numValue) || numValue < 0) {
          errors.push(`${key}: Start round must be a non-negative integer`);
          continue;
        }
      }

      if (key === 'bombparty_language') {
        const languages = listBombPartyLanguageFiles().map((lang) => lang.fileName);
        if (!languages.includes(normalizedValue)) {
          errors.push(`${key}: Invalid bombparty language selection`);
          continue;
        }
      }

      updates.push({ key, value: normalizedValue });
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation errors', details: errors });
    }

    // Apply all updates
    for (const { key, value } of updates) {
      await prisma.gameSettings.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }

    // Log bulk setting update
    logAdmin('settings_bulk_update', req.user!.id, undefined, undefined, undefined, {
      updatedKeys: updates.map(u => u.key),
    });

    // Clear cached settings in bombparty module
    const hasBombPartySettings = updates.some(u => u.key.startsWith('bombparty_'));
    if (hasBombPartySettings) {
      try {
        const { clearBombPartySettingsCache } = await import('../socket/bombparty.js');
        clearBombPartySettingsCache();
      } catch {
        // Ignore if function not available
      }
    }

    // Return updated settings
    const allSettings = await prisma.gameSettings.findMany({
      orderBy: { key: 'asc' },
    });

    const settingsMap: Record<string, string> = {};
    for (const setting of allSettings) {
      settingsMap[setting.key] = setting.value;
    }

    res.json({ settings: settingsMap });
  } catch (error) {
    console.error('Admin bulk update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// List available Bomb Party languages (admin only)
router.get('/bombparty/languages', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const languages = listBombPartyLanguageFiles();
    res.json({ languages });
  } catch (error) {
    console.error('Admin get Bomb Party languages error:', error);
    res.status(500).json({ error: 'Failed to get Bomb Party languages' });
  }
});

// Recalculate Bomb Party prompts (admin only)
router.post('/bombparty/recalculate-prompts', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await recalculateBombPartyPrompts(prisma);

    logAdmin('bombparty_prompts_recalculate', req.user!.id, undefined, undefined, undefined, {
      language: result.languageFile,
      totalPrompts: result.totalPrompts,
    });

    res.json({ result });
  } catch (error) {
    console.error('Admin recalculate Bomb Party prompts error:', error);
    res.status(500).json({ error: 'Failed to recalculate Bomb Party prompts' });
  }
});

// ========== UPDATE POPUP MANAGEMENT ==========

// Get all update popups (admin view)
router.get('/update-popups', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const popups = await prisma.updatePopup.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            views: true,
          },
        },
      },
      orderBy: [
        { releaseDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ popups });
  } catch (error) {
    console.error('Admin get update popups error:', error);
    res.status(500).json({ error: 'Failed to get update popups' });
  }
});

// Create update popup
router.post('/update-popups', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const summary = typeof req.body.summary === 'string' ? req.body.summary.trim() : '';
    const imageUrl = typeof req.body.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
    const releaseDateInput = typeof req.body.releaseDate === 'string' ? req.body.releaseDate : '';
    const isPublished = req.body.isPublished !== false;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }

    const releaseDate = releaseDateInput ? new Date(releaseDateInput) : new Date();
    if (isNaN(releaseDate.getTime())) {
      return res.status(400).json({ error: 'Invalid release date' });
    }

    const popup = await prisma.updatePopup.create({
      data: {
        title,
        message,
        summary: summary || null,
        imageUrl: imageUrl || null,
        releaseDate,
        isPublished,
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            views: true,
          },
        },
      },
    });

    logAdmin('update_popup_create', req.user!.id, req.user!.username, popup.id, popup.title, {
      releaseDate: popup.releaseDate.toISOString(),
      isPublished: popup.isPublished,
    });

    res.status(201).json({ popup });
  } catch (error) {
    console.error('Admin create update popup error:', error);
    res.status(500).json({ error: 'Failed to create update popup' });
  }
});

// Update update popup
router.put('/update-popups/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data: {
      title?: string;
      message?: string;
      summary?: string | null;
      imageUrl?: string | null;
      releaseDate?: Date;
      isPublished?: boolean;
    } = {};

    if (req.body.title !== undefined) {
      if (typeof req.body.title !== 'string' || !req.body.title.trim()) {
        return res.status(400).json({ error: 'Title must be a non-empty string' });
      }
      data.title = req.body.title.trim();
    }

    if (req.body.message !== undefined) {
      if (typeof req.body.message !== 'string' || !req.body.message.trim()) {
        return res.status(400).json({ error: 'Message must be a non-empty string' });
      }
      data.message = req.body.message.trim();
    }

    if (req.body.summary !== undefined) {
      if (req.body.summary === null) {
        data.summary = null;
      } else if (typeof req.body.summary === 'string') {
        const trimmedSummary = req.body.summary.trim();
        data.summary = trimmedSummary.length > 0 ? trimmedSummary : null;
      } else {
        return res.status(400).json({ error: 'Invalid summary value' });
      }
    }

    if (req.body.imageUrl !== undefined) {
      if (req.body.imageUrl === null) {
        data.imageUrl = null;
      } else if (typeof req.body.imageUrl === 'string') {
        const trimmedUrl = req.body.imageUrl.trim();
        if (trimmedUrl && !isAllowedImageUrl(trimmedUrl)) {
          return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
        }
        data.imageUrl = trimmedUrl || null;
      } else {
        return res.status(400).json({ error: 'Invalid image URL' });
      }
    }

    if (req.body.releaseDate !== undefined) {
      if (typeof req.body.releaseDate !== 'string') {
        return res.status(400).json({ error: 'Invalid release date' });
      }
      const releaseDate = new Date(req.body.releaseDate);
      if (isNaN(releaseDate.getTime())) {
        return res.status(400).json({ error: 'Invalid release date' });
      }
      data.releaseDate = releaseDate;
    }

    if (req.body.isPublished !== undefined) {
      if (typeof req.body.isPublished !== 'boolean') {
        return res.status(400).json({ error: 'isPublished must be a boolean' });
      }
      data.isPublished = req.body.isPublished;
    }

    const popup = await prisma.updatePopup.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            views: true,
          },
        },
      },
    });

    logAdmin('update_popup_update', req.user!.id, req.user!.username, popup.id, popup.title, {
      changedFields: Object.keys(data),
    });

    res.json({ popup });
  } catch (error) {
    console.error('Admin update update popup error:', error);
    res.status(500).json({ error: 'Failed to update update popup' });
  }
});

// Delete update popup
router.delete('/update-popups/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const popup = await prisma.updatePopup.findUnique({
      where: { id },
      select: { id: true, title: true, imageUrl: true },
    });

    if (!popup) {
      return res.status(404).json({ error: 'Update popup not found' });
    }

    await prisma.updatePopup.delete({ where: { id } });

    logAdmin('update_popup_delete', req.user!.id, req.user!.username, popup.id, popup.title);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete update popup error:', error);
    res.status(500).json({ error: 'Failed to delete update popup' });
  }
});

// Upload image for update popups (admin only)
router.post('/update-popups/upload-image', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const base64Data = typeof req.body.base64Data === 'string' ? req.body.base64Data : '';
    const mimeType = typeof req.body.mimeType === 'string' ? req.body.mimeType : '';

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required' });
    }

    const extension = inferImageExtension(mimeType);
    if (!extension) {
      return res.status(400).json({ error: 'Unsupported image type. Allowed: png, jpg, webp, gif' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.byteLength === 0) {
      return res.status(400).json({ error: 'Invalid image payload' });
    }

    if (buffer.byteLength > MAX_UPDATE_POPUP_IMAGE_SIZE_BYTES) {
      return res.status(400).json({ error: 'Image too large (max 5MB)' });
    }

    ensureUpdatePopupUploadDir();
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const absolutePath = path.join(UPDATE_POPUP_UPLOAD_DIR, fileName);
    fs.writeFileSync(absolutePath, buffer);

    const imageUrl = `/api/uploads/update-popups/${fileName}`;
    res.status(201).json({ imageUrl });
  } catch (error) {
    console.error('Admin upload update popup image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Upload image for items (admin only)
router.post('/items/upload-image', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const base64Data = typeof req.body.base64Data === 'string' ? req.body.base64Data : '';
    const mimeType = typeof req.body.mimeType === 'string' ? req.body.mimeType : '';

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required' });
    }

    const extension = inferImageExtension(mimeType);
    if (!extension) {
      return res.status(400).json({ error: 'Unsupported image type. Allowed: png, jpg, webp, gif' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.byteLength === 0) {
      return res.status(400).json({ error: 'Invalid image payload' });
    }

    if (buffer.byteLength > MAX_ITEM_IMAGE_SIZE_BYTES) {
      return res.status(400).json({ error: 'Image too large (max 5MB)' });
    }

    if (!fs.existsSync(ITEM_UPLOAD_DIR)) {
      fs.mkdirSync(ITEM_UPLOAD_DIR, { recursive: true });
    }
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const absolutePath = path.join(ITEM_UPLOAD_DIR, fileName);
    fs.writeFileSync(absolutePath, buffer);

    const imageUrl = `/api/uploads/items/${fileName}`;
    res.status(201).json({ imageUrl });
  } catch (error) {
    console.error('Admin upload item image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Suggest automatic summary from recent logs
router.get('/update-popups/suggest-summary', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const latestPopup = await prisma.updatePopup.findFirst({
      orderBy: { releaseDate: 'desc' },
      select: { releaseDate: true },
    });
    const sinceDate = latestPopup?.releaseDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [logCountsByType, recentAdminLogs] = await Promise.all([
      prisma.log.groupBy({
        by: ['type'],
        where: {
          createdAt: { gte: sinceDate },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.log.findMany({
        where: {
          type: 'ADMIN',
          createdAt: { gte: sinceDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          action: true,
          targetName: true,
          createdAt: true,
        },
      }),
    ]);

    const typeSummary = logCountsByType
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 4)
      .map((entry) => `${entry.type}: ${entry._count._all}`);

    const recentChanges = recentAdminLogs.map((log) => {
      const action = log.action.replace(/_/g, ' ');
      const target = log.targetName ? ` (${log.targetName})` : '';
      return `${action}${target}`;
    });

    const parts: string[] = [];
    if (typeSummary.length > 0) {
      parts.push(`Activite recente depuis le ${sinceDate.toISOString().slice(0, 10)}: ${typeSummary.join(', ')}.`);
    }
    if (recentChanges.length > 0) {
      parts.push(`Dernieres actions admin: ${recentChanges.join(' | ')}.`);
    }

    const suggestion = parts.join(' ').trim();
    res.json({
      suggestion: suggestion || 'Nouvelle mise a jour disponible.',
      sinceDate: sinceDate.toISOString(),
    });
  } catch (error) {
    console.error('Admin suggest update popup summary error:', error);
    res.status(500).json({ error: 'Failed to generate suggestion' });
  }
});

// ========== GIFT TEMPLATE MANAGEMENT ==========

// Get all gift templates
router.get('/gift-templates', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const templates = await prisma.giftTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ templates });
  } catch (error) {
    console.error('Admin get gift templates error:', error);
    res.status(500).json({ error: 'Failed to get gift templates' });
  }
});

// Create a gift template
router.post('/gift-templates', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, imageUrl, price } = req.body;

    if (!name || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ error: 'Name and valid price are required' });
    }

    const template = await prisma.giftTemplate.create({
      data: { name, description: description || null, imageUrl: imageUrl || null, price },
    });

    logAdmin('gift_template_create', req.user?.id, req.user?.username, template.id, name, { price });

    res.json({ template });
  } catch (error) {
    console.error('Admin create gift template error:', error);
    res.status(500).json({ error: 'Failed to create gift template' });
  }
});

// Update a gift template
router.put('/gift-templates/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl, price } = req.body;

    const template = await prisma.giftTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(price !== undefined && { price }),
      },
    });

    logAdmin('gift_template_update', req.user?.id, req.user?.username, id, name, { price });

    res.json({ template });
  } catch (error) {
    console.error('Admin update gift template error:', error);
    res.status(500).json({ error: 'Failed to update gift template' });
  }
});

// Delete a gift template
router.delete('/gift-templates/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.giftTemplate.delete({ where: { id } });

    logAdmin('gift_template_delete', req.user?.id, req.user?.username, id, null);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete gift template error:', error);
    res.status(500).json({ error: 'Failed to delete gift template' });
  }
});

// ========== ONLINE ACTIVITY / PLAYER HISTORY ==========

// POST /api/admin/online-snapshot — take an immediate snapshot
router.post('/online-snapshot', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const count = getOnlineCount();
    const usernames = JSON.stringify(getOnlineUsers());
    await prisma.onlineSnapshot.create({ data: { count, usernames } });
    res.json({ success: true, count });
  } catch (error) {
    console.error('Manual snapshot error:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

// GET /api/admin/online-history
// Query params:
//   period: 'day' | 'week' | 'month' | 'custom' (default: 'day')
//   startDate, endDate: ISO strings (for 'custom')
//   granularity: 'auto' | 'minute' | 'hour' | 'day' (default: 'auto')
router.get('/online-history', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'day', startDate, endDate } = req.query as Record<string, string>;

    let start: Date;
    let end: Date = new Date();

    switch (period) {
      case 'week':
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'startDate and endDate required for custom period' });
        }
        start = new Date(startDate);
        end = new Date(endDate);
        break;
      default: { // 'day' — start from today's midnight (local time)
        const d = new Date();
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
    }

    const snapshots = await prisma.onlineSnapshot.findMany({
      where: { createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
      select: { count: true, createdAt: true, usernames: true },
    });

    type SnapUser = { userId: string; username: string };
    const MAX_POINTS = 300;

    const parseUsernames = (raw: string): SnapUser[] => {
      try { return JSON.parse(raw) as SnapUser[]; } catch { return []; }
    };

    let data: { timestamp: string; count: number; max: number; usernames: SnapUser[] }[];

    if (snapshots.length <= MAX_POINTS) {
      data = snapshots.map(s => ({
        timestamp: s.createdAt.toISOString(),
        count: s.count,
        max: s.count,
        usernames: parseUsernames(s.usernames),
      }));
    } else {
      // Downsample: divide range into MAX_POINTS equal slots, keep peak snapshot per slot
      const rangeMs = end.getTime() - start.getTime();
      const bucketMs = rangeMs / MAX_POINTS;
      const buckets = new Map<number, typeof snapshots[number]>();
      for (const snap of snapshots) {
        const bucket = Math.floor((snap.createdAt.getTime() - start.getTime()) / bucketMs);
        const existing = buckets.get(bucket);
        if (!existing || snap.count > existing.count) {
          buckets.set(bucket, snap);
        }
      }
      data = Array.from(buckets.entries())
        .sort(([a], [b]) => a - b)
        .map(([, snap]) => ({
          timestamp: snap.createdAt.toISOString(),
          count: snap.count,
          max: snap.count,
          usernames: parseUsernames(snap.usernames),
        }));
    }

    // Peak for the queried period
    const peak = snapshots.reduce((m, s) => (s.count > m ? s.count : m), 0);
    const peakSnapshot = snapshots.find(s => s.count === peak);

    res.json({
      data,
      peak,
      peakAt: peakSnapshot?.createdAt ?? null,
      period,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  } catch (error) {
    console.error('Online history error:', error);
    res.status(500).json({ error: 'Failed to fetch online history' });
  }
});

// GET /api/admin/online-stats
// Returns overall record, current count, and 24h/7d/30d averages
router.get('/online-stats', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const day1Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [allTimeRecord, day1Snaps, days7Snaps, days30Snaps] = await Promise.all([
      prisma.onlineSnapshot.findFirst({ orderBy: { count: 'desc' }, select: { count: true, createdAt: true } }),
      prisma.onlineSnapshot.findMany({ where: { createdAt: { gte: day1Ago } }, select: { count: true } }),
      prisma.onlineSnapshot.findMany({ where: { createdAt: { gte: days7Ago } }, select: { count: true } }),
      prisma.onlineSnapshot.findMany({ where: { createdAt: { gte: days30Ago } }, select: { count: true } }),
    ]);

    const avg = (snaps: { count: number }[]) =>
      snaps.length ? Math.round(snaps.reduce((s, x) => s + x.count, 0) / snaps.length) : 0;

    const peak1d = day1Snaps.reduce((m, s) => (s.count > m ? s.count : m), 0);
    const peak7d = days7Snaps.reduce((m, s) => (s.count > m ? s.count : m), 0);
    const peak30d = days30Snaps.reduce((m, s) => (s.count > m ? s.count : m), 0);

    res.json({
      current: getOnlineCount(),
      allTimeRecord: allTimeRecord?.count ?? 0,
      allTimeRecordAt: allTimeRecord?.createdAt ?? null,
      avg1d: avg(day1Snaps),
      avg7d: avg(days7Snaps),
      avg30d: avg(days30Snaps),
      peak1d,
      peak7d,
      peak30d,
    });
  } catch (error) {
    console.error('Online stats error:', error);
    res.status(500).json({ error: 'Failed to fetch online stats' });
  }
});

export default router;
