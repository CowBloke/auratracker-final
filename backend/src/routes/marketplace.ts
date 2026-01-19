import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, createItemSchema, purchaseSchema, useItemSchema, purchaseNftSchema, displayNftSchema } from '../middleware/validation.js';
import { logMarketplace } from '../utils/logger.js';
import { isAllowedImageUrl } from '../utils/uploads.js';

const router = Router();

// Get all NFTs
router.get('/nfts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rarity, page = '1', limit = '20' } = req.query;

    const where = rarity ? { rarity: rarity as string } : {};

    const [nfts, total] = await Promise.all([
      prisma.nft.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      }),
      prisma.nft.count({ where }),
    ]);

    res.json({ nfts, total });
  } catch (error) {
    console.error('Get NFTs error:', error);
    res.status(500).json({ error: 'Failed to get NFTs' });
  }
});

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

// Purchase NFT
router.post('/nfts/purchase', authMiddleware, validate(purchaseNftSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

  const { nftId } = req.body;

  const nft = await prisma.nft.findUnique({
    where: { id: nftId },
  });

    if (!nft) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const existing = await prisma.userNft.findFirst({
    where: {
      userId: req.user.id,
      nftId: nft.id,
    },
  });

  if (existing) {
    return res.status(400).json({ error: 'NFT already owned' });
  }

  if (user.money < nft.price) {
    return res.status(400).json({ error: 'Insufficient money' });
  }

    const [updatedUser, userNft] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { money: { decrement: nft.price } },
      }),
      prisma.userNft.create({
        data: {
          userId: req.user.id,
          nftId: nft.id,
          purchasePrice: nft.price,
        },
        include: { nft: true },
      }),
    ]);

    logMarketplace('nft_purchase', req.user.id, user.username, {
      nftId: nft.id,
      nftName: nft.name,
      price: nft.price,
      rarity: nft.rarity,
    });

    res.json({
      success: true,
      nft: userNft,
      newBalance: {
        aura: updatedUser.aura,
        money: updatedUser.money,
      },
    });
  } catch (error) {
    console.error('Purchase NFT error:', error);
    res.status(500).json({ error: 'Failed to purchase NFT' });
  }
});

// Get user NFT inventory
router.get('/nfts/inventory/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const [items, user] = await Promise.all([
      prisma.userNft.findMany({
        where: { userId },
        include: { nft: true },
        orderBy: { acquiredAt: 'desc' },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { displayedNftId: true },
      }),
    ]);

    res.json({ items, displayedNftId: user?.displayedNftId ?? null });
  } catch (error) {
    console.error('Get NFT inventory error:', error);
    res.status(500).json({ error: 'Failed to get NFT inventory' });
  }
});

// Display NFT on profile
router.post('/nfts/display', authMiddleware, validate(displayNftSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userNftId } = req.body as { userNftId?: string | null };

    if (!userNftId) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { displayedNftId: null },
      });
      return res.json({ success: true, displayedNftId: null });
    }

    const userNft = await prisma.userNft.findUnique({
      where: { id: userNftId },
      select: { id: true, userId: true },
    });

    if (!userNft || userNft.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not your NFT' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { displayedNftId: userNft.id },
    });

    res.json({ success: true, displayedNftId: userNft.id });
  } catch (error) {
    console.error('Display NFT error:', error);
    res.status(500).json({ error: 'Failed to display NFT' });
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
    
    // Check sufficient balance
    if (user.money < totalPrice) {
      return res.status(400).json({ error: 'Insufficient money' });
    }
    
    // Purchase in transaction
    const [updatedUser, userItem] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          money: { decrement: totalPrice },
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
        if (!isAllowedImageUrl(effectData.imageUrl)) {
          return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
        }
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
    const { name, description, type, price, imageUrl, effect, expiresAt } = req.body;

    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }
    
    const item = await prisma.item.create({
      data: {
        name,
        description,
        type,
        price,
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
    const { name, description, type, price, imageUrl, effect, expiresAt } = req.body;

    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }
    
    const item = await prisma.item.update({
      where: { id },
      data: {
        name,
        description,
        type,
        price,
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
