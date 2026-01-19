import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, createNftSchema, adminRareActionSchema } from '../middleware/validation.js';
import { logAdmin, logSuggestion, logBan } from '../utils/logger.js';
import { isAllowedImageUrl } from '../utils/uploads.js';
import { BASE_MONOPOLY_BOARD, getMonopolyBoardNames } from '../socket/monopoly.js';

const router = Router();
const ANNOUNCEMENT_KEY = 'topbar_announcement';
const ANNOUNCEMENT_MAX_LENGTH = 120;
const MONOPOLY_BOARD_NAMES_KEY = 'monopoly_board_names';

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

// ========== NFT MANAGEMENT ==========

// Get all NFTs (admin view)
router.get('/nfts', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const nfts = await prisma.nft.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ nfts });
  } catch (error) {
    console.error('Admin get NFTs error:', error);
    res.status(500).json({ error: 'Failed to get NFTs' });
  }
});

// Create NFT
router.post('/nfts', authMiddleware, requireAdmin, validate(createNftSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, price, imageUrl, rarity } = req.body;

    if (!isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }

    const nft = await prisma.nft.create({
      data: {
        name,
        description,
        price: parseInt(price) || 0,
        imageUrl,
        rarity,
      },
    });

    res.status(201).json({ nft });
  } catch (error) {
    console.error('Admin create NFT error:', error);
    res.status(500).json({ error: 'Failed to create NFT' });
  }
});

// Update NFT
router.put('/nfts/:id', authMiddleware, requireAdmin, validate(createNftSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, price, imageUrl, rarity } = req.body;

    if (!isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }

    const nft = await prisma.nft.update({
      where: { id },
      data: {
        name,
        description,
        price: parseInt(price) || 0,
        imageUrl,
        rarity,
      },
    });

    res.json({ nft });
  } catch (error) {
    console.error('Admin update NFT error:', error);
    res.status(500).json({ error: 'Failed to update NFT' });
  }
});

// Delete NFT
router.delete('/nfts/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.nft.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete NFT error:', error);
    res.status(500).json({ error: 'Failed to delete NFT' });
  }
});

// ========== BADGES MANAGEMENT ==========

// Get all badges
router.get('/badges', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const badges = await prisma.badge.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ badges });
  } catch (error) {
    console.error('Admin get badges error:', error);
    res.status(500).json({ error: 'Failed to get badges' });
  }
});

// Create badge
router.post('/badges', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const color = typeof req.body.color === 'string' ? req.body.color.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : null;

    if (!name) {
      return res.status(400).json({ error: 'Badge name is required' });
    }

    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
      return res.status(400).json({ error: 'Badge color must be a hex value' });
    }

    const badge = await prisma.badge.create({
      data: { name, color, description: description || null },
    });

    logAdmin('badge_create', req.user!.id, undefined, badge.id, badge.name, { color: badge.color, description: badge.description });

    res.status(201).json({ badge });
  } catch (error) {
    console.error('Admin create badge error:', error);
    res.status(500).json({ error: 'Failed to create badge' });
  }
});

// Get a user's badges
router.get('/users/:id/badges', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const badges = await prisma.userBadge.findMany({
      where: { userId: id },
      include: { badge: true },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({ badges });
  } catch (error) {
    console.error('Admin get user badges error:', error);
    res.status(500).json({ error: 'Failed to get user badges' });
  }
});

// Assign a badge to a user
router.post('/users/:id/badges', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { badgeId } = req.body;

    if (!badgeId || typeof badgeId !== 'string') {
      return res.status(400).json({ error: 'Badge ID is required' });
    }

    const [user, badge] = await Promise.all([
      prisma.user.findUnique({ where: { id }, select: { id: true, username: true } }),
      prisma.badge.findUnique({ where: { id: badgeId }, select: { id: true, name: true, color: true } }),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    const existing = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId: id,
          badgeId,
        },
      },
      include: { badge: true },
    });

    if (existing) {
      return res.json({ userBadge: existing, alreadyAssigned: true });
    }

    const userBadge = await prisma.userBadge.create({
      data: {
        userId: id,
        badgeId,
      },
      include: { badge: true },
    });

    logAdmin('badge_assign', req.user!.id, undefined, id, user.username, {
      badgeId: badge.id,
      badgeName: badge.name,
    });

    res.status(201).json({ userBadge });
  } catch (error) {
    console.error('Admin assign badge error:', error);
    res.status(500).json({ error: 'Failed to assign badge' });
  }
});

// Remove a badge from a user
router.delete('/users/:id/badges/:badgeId', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id, badgeId } = req.params;

    const userBadge = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId: id,
          badgeId,
        },
      },
      include: { badge: true, user: { select: { username: true } } },
    });

    if (!userBadge) {
      return res.status(404).json({ error: 'Badge assignment not found' });
    }

    await prisma.userBadge.delete({
      where: {
        userId_badgeId: {
          userId: id,
          badgeId,
        },
      },
    });

    logAdmin('badge_remove', req.user!.id, undefined, id, userBadge.user.username, {
      badgeId,
      badgeName: userBadge.badge.name,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin remove badge error:', error);
    res.status(500).json({ error: 'Failed to remove badge' });
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
    const { aura, money, auraCoinBalance, dailyAuraLimit, username, password, isChatMuted } = req.body;

    // Build update data
    const updateData: { aura?: number; money?: number; auraCoinBalance?: number; dailyAuraLimit?: number; username?: string; passwordHash?: string; isChatMuted?: boolean } = {};

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
      select: { username: true, aura: true, money: true, auraCoinBalance: true, dailyAuraLimit: true, isChatMuted: true },
    });

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

    if (action === 'nft_refund_all') {
      const result = await prisma.$transaction(async (tx) => {
        const refundTotals = await tx.userNft.groupBy({
          by: ['userId'],
          _sum: { purchasePrice: true },
        });

        const refundUpdates = refundTotals
          .map((refund) => ({
            userId: refund.userId,
            total: refund._sum.purchasePrice ?? 0,
          }))
          .filter((refund) => refund.total > 0)
          .map((refund) =>
            tx.user.update({
              where: { id: refund.userId },
              data: { money: { increment: refund.total } },
              select: { id: true },
            })
          );

        await Promise.all(refundUpdates);

        const deletedUserNfts = await tx.userNft.deleteMany({});
        const deletedNfts = await tx.nft.deleteMany({});
        const totalRefunded = refundTotals.reduce((sum, refund) => sum + (refund._sum.purchasePrice ?? 0), 0);

        return {
          totalRefunded,
          usersRefunded: refundUpdates.length,
          userNftsDeleted: deletedUserNfts.count,
          nftsDeleted: deletedNfts.count,
        };
      });

      logAdmin('nft_refund_all', req.user!.id, req.user!.username, undefined, undefined, {
        totalRefunded: result.totalRefunded,
        usersRefunded: result.usersRefunded,
        nftsDeleted: result.nftsDeleted,
        userNftsDeleted: result.userNftsDeleted,
      });

      return res.json({
        success: true,
        message: `Refunded ${result.totalRefunded} and removed ${result.userNftsDeleted} user NFT(s).`,
        ...result,
      });
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
      clashLogs,
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
      prisma.log.count({ where: { type: 'CLASH' } }),
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
        CLASH: clashLogs,
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

// ========== MONOPOLY BOARD MANAGEMENT ==========

router.get('/monopoly/board', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const boardNames = await getMonopolyBoardNames();
    const tiles = BASE_MONOPOLY_BOARD.map((tile, index) => ({
      index: tile.index,
      name: boardNames[index] || tile.name,
      type: tile.type,
      color: tile.color || null,
    }));

    res.json({ tiles });
  } catch (error) {
    console.error('Admin get monopoly board error:', error);
    res.status(500).json({ error: 'Failed to load monopoly board' });
  }
});

router.put('/monopoly/board', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { names, tiles } = req.body as {
      names?: string[];
      tiles?: Array<{ index: number; name: string }>;
    };

    const overrides = new Map<number, string>();

    if (Array.isArray(names)) {
      names.forEach((name, index) => {
        if (typeof name === 'string') {
          overrides.set(index, name);
        }
      });
    }

    if (Array.isArray(tiles)) {
      tiles.forEach((tile) => {
        if (typeof tile?.index === 'number' && typeof tile?.name === 'string') {
          overrides.set(tile.index, tile.name);
        }
      });
    }

    const sanitized = BASE_MONOPOLY_BOARD.map((tile, index) => {
      const candidate = overrides.get(index);
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.length > 0) {
          return trimmed.slice(0, 60);
        }
      }
      return tile.name;
    });

    const setting = await prisma.gameSettings.upsert({
      where: { key: MONOPOLY_BOARD_NAMES_KEY },
      create: { key: MONOPOLY_BOARD_NAMES_KEY, value: JSON.stringify(sanitized) },
      update: { value: JSON.stringify(sanitized) },
    });

    logAdmin('monopoly_board_update', req.user!.id, req.user!.username, undefined, undefined, {
      key: setting.key,
    });

    res.json({ names: sanitized });
  } catch (error) {
    console.error('Admin update monopoly board error:', error);
    res.status(500).json({ error: 'Failed to update monopoly board' });
  }
});

export default router;
