import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, createItemSchema, purchaseSchema, useItemSchema } from '../middleware/validation.js';
import { logMarketplace } from '../utils/logger.js';

const router = Router();

// Get all items
router.get('/items', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type, page = '1', limit = '20' } = req.query;
    
    const where = type ? { type: type as 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE' } : {};
    
    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      }),
      prisma.item.count({ where }),
    ]);
    
    res.json({ items, total });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

// Purchase item
router.post('/purchase', authMiddleware, validate(purchaseSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { itemId, quantity = 1 } = req.body;
    
    // Get item
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Check if expired
    if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Item is no longer available' });
    }
    
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const totalPrice = item.price * quantity;
    const totalAuraCost = item.auraCost * quantity;
    
    // Check sufficient balance
    if (user.money < totalPrice) {
      return res.status(400).json({ error: 'Insufficient money' });
    }
    
    if (user.aura < totalAuraCost) {
      return res.status(400).json({ error: 'Insufficient aura' });
    }
    
    // Purchase in transaction
    const [updatedUser, userItem] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          money: { decrement: totalPrice },
          aura: { decrement: totalAuraCost },
        },
      }),
      prisma.userItem.upsert({
        where: {
          userId_itemId: {
            userId: req.user.id,
            itemId,
          },
        },
        create: {
          userId: req.user.id,
          itemId,
          quantity,
        },
        update: {
          quantity: { increment: quantity },
        },
        include: {
          item: true,
        },
      }),
    ]);
    
    // Log purchase
    logMarketplace('item_purchase', req.user.id, user.username, {
      itemId,
      itemName: item.name,
      quantity,
      totalPrice,
      totalAuraCost,
    });

    res.json({
      success: true,
      item: userItem,
      newBalance: {
        aura: updatedUser.aura,
        money: updatedUser.money,
      },
    });
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Failed to purchase item' });
  }
});

// Get user inventory
router.get('/inventory/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    const items = await prisma.userItem.findMany({
      where: { userId },
      include: {
        item: true,
      },
      orderBy: { acquiredAt: 'desc' },
    });
    
    res.json({ items });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

// Use item
router.post('/use-item', authMiddleware, validate(useItemSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { userItemId, effectData } = req.body;
    
    const userItem = await prisma.userItem.findUnique({
      where: { id: userItemId },
      include: { item: true },
    });
    
    if (!userItem) {
      return res.status(404).json({ error: 'Item not found in inventory' });
    }
    
    if (userItem.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not your item' });
    }
    
    // Parse effect from item
    let effect = null;
    if (userItem.item.effect) {
      try {
        effect = JSON.parse(userItem.item.effect);
      } catch (e) {
        // Invalid effect JSON
      }
    }
    
    // Handle different item types
    if (userItem.item.type === 'COSMETIC' && effect) {
      // Cosmetic items - apply the effect with user-provided data
      if (effect.type === 'USERNAME_COLOR' && effectData?.color) {
        // Apply username color
        await prisma.user.update({
          where: { id: req.user.id },
          data: { usernameColor: effectData.color },
        });
        
        // Decrement or remove item
        if (userItem.quantity > 1) {
          await prisma.userItem.update({
            where: { id: userItemId },
            data: { quantity: { decrement: 1 } },
          });
        } else {
          await prisma.userItem.delete({
            where: { id: userItemId },
          });
        }
        
        // Log item use
        const usernameColorUser = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { username: true },
        });
        logMarketplace('item_use', req.user.id, usernameColorUser?.username || undefined, {
          itemId: userItem.item.id,
          itemName: userItem.item.name,
          effectType: 'USERNAME_COLOR',
          effectData: { color: effectData.color },
        });

        return res.json({
          success: true,
          effect: { type: 'USERNAME_COLOR', color: effectData.color },
        });
      }
      
      if (effect.type === 'PROFILE_PICTURE' && effectData?.imageUrl) {
        // Apply profile picture
        await prisma.user.update({
          where: { id: req.user.id },
          data: { profilePicture: effectData.imageUrl },
        });
        
        // Decrement or remove item
        if (userItem.quantity > 1) {
          await prisma.userItem.update({
            where: { id: userItemId },
            data: { quantity: { decrement: 1 } },
          });
        } else {
          await prisma.userItem.delete({
            where: { id: userItemId },
          });
        }
        
        // Log item use
        const profilePicUser = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { username: true },
        });
        logMarketplace('item_use', req.user.id, profilePicUser?.username || undefined, {
          itemId: userItem.item.id,
          itemName: userItem.item.name,
          effectType: 'PROFILE_PICTURE',
        });

        return res.json({
          success: true,
          effect: { type: 'PROFILE_PICTURE', imageUrl: effectData.imageUrl },
        });
      }
      
      // Unknown cosmetic effect type - just return the effect info
      return res.json({
        success: false,
        needsInput: true,
        effect,
      });
    }
    
    // Consumable items
    if (userItem.item.type === 'CONSUMABLE') {
      // Decrement quantity or delete if last one
      if (userItem.quantity > 1) {
        await prisma.userItem.update({
          where: { id: userItemId },
          data: { quantity: { decrement: 1 } },
        });
      } else {
        await prisma.userItem.delete({
          where: { id: userItemId },
        });
      }
      
      // Apply effects like bonus aura, money, etc.
      if (effect) {
        if (effect.bonusAura) {
          await prisma.user.update({
            where: { id: req.user.id },
            data: { aura: { increment: effect.bonusAura } },
          });
        }
        if (effect.bonusMoney) {
          await prisma.user.update({
            where: { id: req.user.id },
            data: { money: { increment: effect.bonusMoney } },
          });
        }
      }

      // Log consumable item use
      const consumableUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { username: true },
      });
      logMarketplace('item_use', req.user.id, consumableUser?.username || undefined, {
        itemId: userItem.item.id,
        itemName: userItem.item.name,
        itemType: 'CONSUMABLE',
        effect,
      });

      return res.json({
        success: true,
        effect,
      });
    }
    
    // Other item types
    res.json({
      success: true,
      effect,
    });
  } catch (error) {
    console.error('Use item error:', error);
    res.status(500).json({ error: 'Failed to use item' });
  }
});

// Admin: Create item
router.post('/admin/item', authMiddleware, adminMiddleware, validate(createItemSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, type, price, auraCost, imageUrl, effect, expiresAt } = req.body;
    
    const item = await prisma.item.create({
      data: {
        name,
        description,
        type,
        price,
        auraCost: auraCost || 0,
        imageUrl,
        effect,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    
    res.status(201).json({ item });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Admin: Update item
router.put('/admin/item/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, type, price, auraCost, imageUrl, effect, expiresAt } = req.body;
    
    const item = await prisma.item.update({
      where: { id },
      data: {
        name,
        description,
        type,
        price,
        auraCost,
        imageUrl,
        effect,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    
    res.json({ item });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Admin: Delete item
router.delete('/admin/item/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.item.delete({
      where: { id },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
