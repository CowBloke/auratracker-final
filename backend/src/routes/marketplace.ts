import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, createItemSchema, purchaseSchema, useItemSchema, createMarketplaceListingSchema, marketplaceListingActionSchema } from '../middleware/validation.js';
import { logMarketplace } from '../utils/logger.js';
import { isAllowedImageUrl } from '../utils/uploads.js';
import { createNotification } from '../utils/notifications.js';
import { awardBadge } from '../utils/badgeAwards.js';
import {
  buildClanEffectActivation,
  CLAN_EFFECT_GAME_MONEY_BOOST,
  isClanGameMoneyBoostEffect,
  parseClanEffectPayload,
} from '../utils/clanEffects.js';

const router = Router();

const DEFAULT_SHOP_CATEGORIES = [
  { id: 'COSMETIC', label: 'Cosmétiques' },
  { id: 'CONSUMABLE', label: 'Objets' },
  { id: 'UPGRADE', label: 'Améliorations' },
];

const CLAN_BASE_MAX_MEMBERS = 5;

const parseItemEffect = parseClanEffectPayload;

const MARKETPLACE_LISTING_STATUSES = ['ACTIVE', 'SOLD', 'CANCELLED'] as const;

type MarketplaceListingStatus = (typeof MARKETPLACE_LISTING_STATUSES)[number];

const getMarketplaceListingStatus = (value: unknown): MarketplaceListingStatus | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.toUpperCase();
  return MARKETPLACE_LISTING_STATUSES.includes(normalized as MarketplaceListingStatus)
    ? (normalized as MarketplaceListingStatus)
    : null;
};

const serializeMarketplaceListing = (listing: {
  id: string;
  sellerId: string;
  seller: { id: string; username: string; usernameColor: string | null; profilePicture: string | null };
  item: { id: string; name: string; description: string; type: string; price: number; imageUrl: string | null; effect: string | null };
  quantity: number;
  unitPrice: number;
  status: MarketplaceListingStatus | string;
  createdAt: Date;
  updatedAt: Date;
  soldAt: Date | null;
  cancelledAt: Date | null;
}) => ({
  id: listing.id,
  sellerId: listing.sellerId,
  seller: listing.seller,
  item: listing.item,
  quantity: listing.quantity,
  unitPrice: listing.unitPrice,
  totalPrice: listing.unitPrice * listing.quantity,
  status: listing.status,
  createdAt: listing.createdAt.toISOString(),
  updatedAt: listing.updatedAt.toISOString(),
  soldAt: listing.soldAt ? listing.soldAt.toISOString() : null,
  cancelledAt: listing.cancelledAt ? listing.cancelledAt.toISOString() : null,
});

const isDoodleJumpSkinItem = (item: { effect: string | null }) =>
  parseItemEffect(item.effect)?.type === 'DOODLE_JUMP_SKIN';

// Get shop categories (public)
router.get('/categories', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const setting = await prisma.gameSettings.findUnique({ where: { key: 'shop_categories' } });
    const categories = setting ? JSON.parse(setting.value) : DEFAULT_SHOP_CATEGORIES;
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Get all items
router.get('/items', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type, page = '1', limit = '20' } = req.query;
    
    const where = type
      ? { type: type as string }
      : { type: { not: 'GIFT' } };
    
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

    if (item.type === 'GIFT') {
      return res.status(410).json({ error: 'This item is no longer available' });
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

    if (isDoodleJumpSkinItem(item)) {
      if (quantity !== 1) {
        return res.status(400).json({ error: 'Skin purchases are limited to one at a time' });
      }

      const existingSkin = await prisma.userItem.findUnique({
        where: {
          userId_itemId: {
            userId: req.user.id,
            itemId,
          },
        },
      });

      if (existingSkin) {
        return res.status(400).json({ error: 'You already own this skin' });
      }
    }
    
    const effect = parseItemEffect(item.effect);

    if (effect?.type === 'CUSTOM_BADGE') {
      const existingCustomBadge = await prisma.customBadgeRequest.findFirst({
        where: { userId: req.user.id, status: { in: ['pending', 'approved'] } },
      });
      if (existingCustomBadge) {
        return res.status(400).json({ error: 'Tu as déjà un badge personnalisé ou une demande en cours.' });
      }
    }

    const isClanTagUnlock = effect?.type === 'CLAN_TAG_UNLOCK';
    const isClanSlotUpgrade = effect?.type === 'CLAN_SLOT_UPGRADE';
    const isClanGameMoneyBoost = effect?.type === CLAN_EFFECT_GAME_MONEY_BOOST;
    const isClanBanner = effect?.type === 'CLAN_BANNER';
    const isClanProfilePicture = effect?.type === 'CLAN_PROFILE_PICTURE';
    const isClanUpgrade = isClanTagUnlock || isClanSlotUpgrade || isClanGameMoneyBoost || isClanBanner || isClanProfilePicture;
    const totalPrice = item.price * quantity;
    let clanUpgradeMembership: { clanId: string; isLeader: boolean } | null = null;

    if (isClanUpgrade) {
      if (quantity !== 1) {
        return res.status(400).json({ error: 'Cette amélioration de clan ne peut être achetée qu\'à l\'unité.' });
      }

      const membership = await prisma.clanMember.findUnique({
        where: { userId: req.user.id },
        select: { clanId: true, isLeader: true },
      });
      clanUpgradeMembership = membership ?? null;

      if (!membership) {
        return res.status(400).json({ error: 'Tu dois etre dans un clan pour acheter cette amélioration.' });
      }


      const clan = await prisma.clan.findUnique({
        where: { id: membership.clanId },
        select: {
          tagUnlocked: true,
          maxMembers: true,
          clanBankMoney: true,
          activeEffects: isClanGameMoneyBoost
            ? {
                where: {
                  type: CLAN_EFFECT_GAME_MONEY_BOOST,
                  activeUntil: { gt: new Date() },
                },
                take: 1,
              }
            : false,
        },
      });

      if (isClanTagUnlock && clan?.tagUnlocked) {
        return res.status(400).json({ error: 'Le tag est déjà débloqué pour ce clan.' });
      }

      if (isClanSlotUpgrade && typeof clan?.maxMembers === 'number' && clan.maxMembers > CLAN_BASE_MAX_MEMBERS) {
        return res.status(400).json({ error: 'Le slot supplémentaire est déjà débloqué pour ce clan.' });
      }

      if (isClanGameMoneyBoost && clan?.activeEffects && clan.activeEffects.length > 0) {
        return res.status(400).json({ error: 'Le boost de gains du clan est déjà actif.' });
      }

      if (!clan || clan.clanBankMoney < totalPrice) {
        return res.status(400).json({ error: 'La banque de clan n\'a pas assez d\'argent pour cette amélioration.' });
      }
    }

    // Check sufficient balance
    if (!isClanUpgrade && user.money < totalPrice) {
      return res.status(400).json({ error: 'Insufficient money' });
    }
    
    let updatedUser: { money: number; aura: bigint };
    let userItem: {
      id: string;
      quantity: number;
      acquiredAt: Date;
      item: typeof item;
    } | null = null;

    if (isClanUpgrade) {
      if (!clanUpgradeMembership) {
        return res.status(400).json({ error: 'Tu dois etre dans un clan pour acheter cette amélioration.' });
      }

      const txResult = await prisma.$transaction(async (tx) => {
        const clan = await tx.clan.findUnique({
          where: { id: clanUpgradeMembership.clanId },
          select: {
            tagUnlocked: true,
            maxMembers: true,
            clanBankMoney: true,
            activeEffects: isClanGameMoneyBoost
              ? {
                  where: {
                    type: CLAN_EFFECT_GAME_MONEY_BOOST,
                    activeUntil: { gt: new Date() },
                  },
                  take: 1,
                }
              : false,
          },
        });

        if (!clan) {
          throw new Error('CLAN_NOT_FOUND');
        }

        if (isClanTagUnlock && clan.tagUnlocked) {
          throw new Error('CLAN_TAG_ALREADY_UNLOCKED');
        }

        if (isClanSlotUpgrade && clan.maxMembers > CLAN_BASE_MAX_MEMBERS) {
          throw new Error('CLAN_SLOT_ALREADY_UPGRADED');
        }

        if (isClanGameMoneyBoost && clan.activeEffects.length > 0) {
          throw new Error('CLAN_EFFECT_ALREADY_ACTIVE');
        }

        if (clan.clanBankMoney < totalPrice) {
          throw new Error('CLAN_BANK_INSUFFICIENT_FUNDS');
        }

        if (isClanTagUnlock) {
          await tx.clan.update({
            where: { id: clanUpgradeMembership.clanId },
            data: {
              tagUnlocked: true,
              clanBankMoney: { decrement: totalPrice },
            },
          });
        }

        let newMaxMembers: number | null = null;
        if (isClanSlotUpgrade) {
          const updatedClan = await tx.clan.update({
            where: { id: clanUpgradeMembership.clanId },
            data: {
              maxMembers: { increment: 1 },
              slotUpgraded: true,
              clanBankMoney: { decrement: totalPrice },
            },
            select: { maxMembers: true },
          });
          newMaxMembers = updatedClan.maxMembers;
        }

        if (isClanGameMoneyBoost || isClanBanner || isClanProfilePicture) {
          await tx.clan.update({
            where: { id: clanUpgradeMembership.clanId },
            data: {
              clanBankMoney: { decrement: totalPrice },
            },
          });

          await tx.clanOwnedItem.upsert({
            where: {
              clanId_itemId: {
                clanId: clanUpgradeMembership.clanId,
                itemId,
              },
            },
            create: {
              clanId: clanUpgradeMembership.clanId,
              itemId,
              quantity: 1,
            },
            update: {
              quantity: { increment: 1 },
            },
          });
        }

        const nextUser = await tx.user.findUnique({
          where: { id: user.id },
          select: {
            aura: true,
            money: true,
          },
        });

        if (!nextUser) {
          throw new Error('USER_NOT_FOUND');
        }

        return { user: nextUser, newMaxMembers };
      });

      updatedUser = txResult.user;

      if (isClanSlotUpgrade && txResult.newMaxMembers !== null) {
        // Notify all clan members in real-time so the Clans page updates immediately
        const clanMembers = await prisma.clanMember.findMany({
          where: { clanId: clanUpgradeMembership.clanId },
          select: { userId: true },
        });
        for (const member of clanMembers) {
          io.to(`user:${member.userId}`).emit('clan:slot_upgraded', {
            clanId: clanUpgradeMembership.clanId,
            maxMembers: txResult.newMaxMembers,
          });
        }
      }

      if (isClanGameMoneyBoost) {
        const clanMembers = await prisma.clanMember.findMany({
          where: { clanId: clanUpgradeMembership.clanId },
          select: { userId: true },
        });
        for (const member of clanMembers) {
          io.to(`user:${member.userId}`).emit('clan:effects-updated', {
            clanId: clanUpgradeMembership.clanId,
          });
        }
      }
    } else {
      // Purchase regular item into inventory.
      const txResult = await prisma.$transaction([
        prisma.user.update({
          where: { id: req.user.id },
          data: {
            money: { decrement: totalPrice },
          },
          select: {
            aura: true,
            money: true,
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

      updatedUser = txResult[0];
      userItem = txResult[1];
    }
    
    // Log purchase
    logMarketplace('item_purchase', req.user.id, user.username, {
      itemId,
      itemName: item.name,
      quantity,
      totalPrice,
    });

    createNotification({
      userId: req.user.id,
      type: 'SYSTEM',
      title: 'Achat confirme',
      body: `Tu as achete ${item.name} x${quantity} pour $${totalPrice}.`,
      data: {
        itemId,
        itemName: item.name,
        quantity,
        totalPrice,
        silent: true,
      },
      link: '/inventory',
      icon: 'shopping-bag',
    }).catch(() => {});

    res.json({
      success: true,
      item: userItem,
      effect: isClanTagUnlock
        ? { type: 'CLAN_TAG_UNLOCK' }
        : isClanSlotUpgrade
          ? { type: 'CLAN_SLOT_UPGRADE' }
          : isClanGameMoneyBoost
            ? { type: CLAN_EFFECT_GAME_MONEY_BOOST }
            : isClanBanner
              ? { type: 'CLAN_BANNER' }
              : isClanProfilePicture
                ? { type: 'CLAN_PROFILE_PICTURE' }
              : null,
      newBalance: {
        aura: updatedUser.aura,
        money: updatedUser.money,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'CLAN_BANK_INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: 'La banque de clan n\'a pas assez d\'argent pour cette amélioration.' });
      }
      if (error.message === 'CLAN_TAG_ALREADY_UNLOCKED') {
        return res.status(400).json({ error: 'Le tag est déjà débloqué pour ce clan.' });
      }
      if (error.message === 'CLAN_SLOT_ALREADY_UPGRADED') {
        return res.status(400).json({ error: 'Le slot supplémentaire est déjà débloqué pour ce clan.' });
      }
      if (error.message === 'CLAN_EFFECT_ALREADY_ACTIVE') {
        return res.status(400).json({ error: 'Le boost de gains du clan est déjà actif.' });
      }
    }
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
      
      if ((effect.type === 'PROFILE_PICTURE' || effect.type === 'PROFILE_BANNER') && effectData?.imageUrl) {
        if (!isAllowedImageUrl(effectData.imageUrl)) {
          return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
        }
        const profileImageField = effect.type === 'PROFILE_BANNER' ? 'profileBanner' : 'profilePicture';

        // Apply profile image cosmetic
        await prisma.user.update({
          where: { id: req.user.id },
          data: { [profileImageField]: effectData.imageUrl },
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
          effectType: effect.type,
        });

        return res.json({
          success: true,
          effect: { type: effect.type, imageUrl: effectData.imageUrl },
        });
      }
      
      // CUSTOM_BADGE — fall through to the dedicated handler below
      if (effect.type !== 'CUSTOM_BADGE') {
        // Unknown cosmetic effect type - just return the effect info
        return res.json({
          success: false,
          needsInput: true,
          effect,
        });
      }
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
    
    // Clan upgrades — works regardless of item type
    if (effect?.type === 'CLAN_TAG_UNLOCK' || effect?.type === 'CLAN_SLOT_UPGRADE') {
      const membership = await prisma.clanMember.findUnique({
        where: { userId: req.user.id },
        select: { clanId: true },
      });

      if (!membership) {
        return res.status(400).json({ error: 'Tu n\'es pas dans un clan.' });
      }

      const clan = await prisma.clan.findUnique({
        where: { id: membership.clanId },
        select: { tagUnlocked: true, maxMembers: true },
      });
      if (effect.type === 'CLAN_TAG_UNLOCK' && clan?.tagUnlocked) {
        return res.status(400).json({ error: 'Le tag est déjà débloqué pour ce clan.' });
      }
      if (effect.type === 'CLAN_SLOT_UPGRADE' && typeof clan?.maxMembers === 'number' && clan.maxMembers > CLAN_BASE_MAX_MEMBERS) {
        return res.status(400).json({ error: 'Le slot supplémentaire est déjà débloqué pour ce clan.' });
      }

      await prisma.$transaction(async (tx) => {
        if (effect.type === 'CLAN_TAG_UNLOCK') {
          await tx.clan.update({ where: { id: membership.clanId }, data: { tagUnlocked: true } });
        } else {
          await tx.clan.update({
            where: { id: membership.clanId },
            data: {
              maxMembers: { increment: 1 },
              slotUpgraded: true,
            },
          });
        }
        if (userItem.quantity > 1) {
          await tx.userItem.update({ where: { id: userItemId }, data: { quantity: { decrement: 1 } } });
        } else {
          await tx.userItem.delete({ where: { id: userItemId } });
        }
      });

      return res.json({ success: true, effect: { type: effect.type } });
    }

    // UPGRADE items
    if (userItem.item.type === 'UPGRADE' && effect) {
      if (effect.type === 'CLAN_TAG_UNLOCK') { // handled above, kept for safety
        return res.json({ success: true, effect: { type: 'CLAN_TAG_UNLOCK' } });
      }

      if (effect.type === 'CLAN_SLOT_UPGRADE') { // handled above, kept for safety
        return res.json({ success: true, effect: { type: 'CLAN_SLOT_UPGRADE' } });
      }

      if (effect.type === 'AWARD_BADGE') {
        const { badgeId } = effect;
        if (!badgeId) {
          return res.status(400).json({ error: 'Badge non configuré.' });
        }

        const badge = await prisma.badge.findUnique({ where: { id: badgeId }, select: { id: true, name: true } });
        if (!badge) {
          return res.status(404).json({ error: 'Badge introuvable.' });
        }

        await prisma.$transaction(async (tx) => {
          if (userItem.quantity > 1) {
            await tx.userItem.update({ where: { id: userItemId }, data: { quantity: { decrement: 1 } } });
          } else {
            await tx.userItem.delete({ where: { id: userItemId } });
          }
        });

        await awardBadge(req.user.id, badgeId, `shop:${userItem.item.name}`);

        return res.json({ success: true, effect: { type: 'AWARD_BADGE', badgeName: badge.name } });
      }
    }

    // Custom badge request
    if (effect?.type === 'CUSTOM_BADGE') {
      const { name, description, icon, backgroundColor, borderColor, rarity } = effectData || {};

      if (!name?.trim() || !description?.trim()) {
        return res.status(400).json({ error: 'name and description are required' });
      }

      const existing = await prisma.customBadgeRequest.findFirst({
        where: { userId: req.user.id, status: { in: ['pending', 'approved'] } },
      });
      if (existing) {
        return res.status(409).json({ error: 'Tu as déjà un badge personnalisé ou une demande en cours.' });
      }

      const request = await prisma.$transaction(async (tx) => {
        if (userItem.quantity > 1) {
          await tx.userItem.update({ where: { id: userItemId }, data: { quantity: { decrement: 1 } } });
        } else {
          await tx.userItem.delete({ where: { id: userItemId } });
        }
        return tx.customBadgeRequest.create({
          data: {
            userId: req.user!.id,
            name: name.trim(),
            description: description.trim(),
            icon: icon ?? '⭐',
            backgroundColor: backgroundColor ?? '#374151',
            borderColor: borderColor ?? '#6b7280',
            rarity: rarity ?? 'common',
            pricePaid: userItem.item.price,
          },
        });
      });

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
            data: { requestId: request.id, requesterId: req.user!.id, requesterUsername: req.user!.username },
          }),
        ),
      );

      logMarketplace('item_use', req.user.id, req.user.username, {
        itemId: userItem.item.id,
        itemName: userItem.item.name,
        effectType: 'CUSTOM_BADGE',
        badgeName: name.trim(),
      });

      return res.json({ success: true, pending: true, effect: { type: 'CUSTOM_BADGE', requestId: request.id } });
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

// Marketplace listings
router.get('/listings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const status = getMarketplaceListingStatus(req.query.status);
    const sellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId : null;

    const listings = await prisma.marketplaceListing.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(sellerId ? { sellerId } : {}),
      },
      include: {
        seller: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
            profilePicture: true,
          },
        },
        item: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            price: true,
            imageUrl: true,
            effect: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ listings: listings.map(serializeMarketplaceListing) });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Failed to get marketplace listings' });
  }
});

router.post('/listings', authMiddleware, validate(createMarketplaceListingSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userItemId, quantity, unitPrice } = req.body;
    const userItem = await prisma.userItem.findUnique({
      where: { id: userItemId },
      include: { item: true },
    });

    if (!userItem || userItem.userId !== req.user.id) {
      return res.status(404).json({ error: 'Item not found in inventory' });
    }

    if (userItem.item.type === 'GIFT') {
      return res.status(400).json({ error: 'This item cannot be sold' });
    }

    if (quantity > userItem.quantity) {
      return res.status(400).json({ error: 'Quantity exceeds inventory amount' });
    }

    const now = new Date();

    const listing = await prisma.$transaction(async (tx) => {
      if (quantity === userItem.quantity) {
        await tx.userItem.delete({ where: { id: userItemId } });
      } else {
        await tx.userItem.update({
          where: { id: userItemId },
          data: { quantity: { decrement: quantity } },
        });
      }

      return tx.marketplaceListing.create({
        data: {
          sellerId: req.user!.id,
          itemId: userItem.itemId,
          quantity,
          unitPrice,
          status: 'ACTIVE',
        },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              usernameColor: true,
              profilePicture: true,
            },
          },
          item: {
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              price: true,
              imageUrl: true,
              effect: true,
            },
          },
        },
      });
    });

    logMarketplace('listing_create', req.user.id, req.user.username, {
      listingId: listing.id,
      itemId: userItem.itemId,
      itemName: userItem.item.name,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
    });

    res.status(201).json({ listing: serializeMarketplaceListing(listing) });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Failed to create marketplace listing' });
  }
});

router.post('/listings/buy', authMiddleware, validate(marketplaceListingActionSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { listingId } = req.body;
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: {
        seller: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
            profilePicture: true,
          },
        },
        item: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            price: true,
            imageUrl: true,
            effect: true,
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Listing is no longer active' });
    }

    if (listing.sellerId === req.user.id) {
      return res.status(400).json({ error: 'You cannot buy your own listing' });
    }

    const totalPrice = listing.unitPrice * listing.quantity;
    const buyer = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { money: true, aura: true, username: true },
    });

    if (!buyer) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (buyer.money < totalPrice) {
      return res.status(400).json({ error: 'Insufficient money' });
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const currentListing = await tx.marketplaceListing.findUnique({
        where: { id: listingId },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              usernameColor: true,
              profilePicture: true,
            },
          },
          item: {
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              price: true,
              imageUrl: true,
              effect: true,
            },
          },
        },
      });
      if (!currentListing || currentListing.status !== 'ACTIVE') {
        throw new Error('LISTING_UNAVAILABLE');
      }

      await tx.user.update({
        where: { id: req.user!.id },
        data: { money: { decrement: totalPrice } },
      });

      await tx.user.update({
        where: { id: currentListing.sellerId },
        data: { money: { increment: totalPrice } },
      });

      await tx.userItem.upsert({
        where: {
          userId_itemId: {
            userId: req.user!.id,
            itemId: currentListing.itemId,
          },
        },
        create: {
          userId: req.user!.id,
          itemId: currentListing.itemId,
          quantity: currentListing.quantity,
        },
        update: {
          quantity: { increment: currentListing.quantity },
        },
      });

      return tx.marketplaceListing.update({
        where: { id: listingId },
        data: {
          status: 'SOLD',
          soldAt: now,
        },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              usernameColor: true,
              profilePicture: true,
            },
          },
          item: {
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              price: true,
              imageUrl: true,
              effect: true,
            },
          },
        },
      });
    });

    logMarketplace('listing_sold', req.user.id, buyer.username, {
      listingId,
      itemId: result.itemId,
      itemName: result.itemName,
      sellerId: result.sellerId,
      quantity: result.quantity,
      unitPrice: result.unitPrice,
      totalPrice,
    });

    res.json({
      listing: {
        ...serializeMarketplaceListing(result),
        status: 'SOLD',
        soldAt: now.toISOString(),
      },
      newBalance: {
        aura: buyer.aura,
        money: buyer.money - totalPrice,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'LISTING_UNAVAILABLE') {
      return res.status(400).json({ error: 'Listing is no longer active' });
    }
    console.error('Buy listing error:', error);
    res.status(500).json({ error: 'Failed to buy marketplace listing' });
  }
});

router.delete('/listings/:listingId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.listingId },
      include: {
        seller: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
            profilePicture: true,
          },
        },
        item: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            price: true,
            imageUrl: true,
            effect: true,
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.sellerId !== req.user.id) {
      return res.status(403).json({ error: 'You cannot cancel this listing' });
    }

    if (listing.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Listing is no longer active' });
    }

    const now = new Date();

    const restoredListing = await prisma.$transaction(async (tx) => {
      const currentListing = await tx.marketplaceListing.findUnique({
        where: { id: req.params.listingId },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              usernameColor: true,
              profilePicture: true,
            },
          },
          item: {
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              price: true,
              imageUrl: true,
              effect: true,
            },
          },
        },
      });

      if (!currentListing || currentListing.status !== 'ACTIVE') {
        throw new Error('LISTING_UNAVAILABLE');
      }

      await tx.userItem.upsert({
        where: {
          userId_itemId: {
            userId: req.user!.id,
            itemId: currentListing.itemId,
          },
        },
        create: {
          userId: req.user!.id,
          itemId: currentListing.itemId,
          quantity: currentListing.quantity,
        },
        update: {
          quantity: { increment: currentListing.quantity },
        },
      });

      return tx.marketplaceListing.update({
        where: { id: currentListing.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
        },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              usernameColor: true,
              profilePicture: true,
            },
          },
          item: {
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              price: true,
              imageUrl: true,
              effect: true,
            },
          },
        },
      });
    });

    logMarketplace('listing_cancel', req.user.id, req.user.username, {
      listingId: restoredListing.id,
      itemId: restoredListing.itemId,
      itemName: restoredListing.itemName,
      quantity: restoredListing.quantity,
      unitPrice: restoredListing.unitPrice,
    });

    res.json({
      listing: {
        ...serializeMarketplaceListing(restoredListing),
        status: 'CANCELLED',
        cancelledAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Cancel listing error:', error);
    res.status(500).json({ error: 'Failed to cancel marketplace listing' });
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

// GET /doodle-skins — returns static + daily rotating DJ skins
router.get('/doodle-skins', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const allItems = await prisma.item.findMany({
      where: { effect: { contains: 'DOODLE_JUMP_SKIN' } },
    });

    const staticItems: typeof allItems = [];
    const rotatingPool: typeof allItems = [];

    for (const item of allItems) {
      try {
        const effect = JSON.parse(item.effect || '{}');
        if (effect.type === 'DOODLE_JUMP_SKIN') {
          if (effect.shopType === 'static') staticItems.push(item);
          else if (effect.shopType === 'rotating') rotatingPool.push(item);
        }
      } catch { /* skip invalid JSON */ }
    }

    // Deterministic daily rotation seeded by YYYY-M-D
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    let seed = 0;
    for (const ch of dateKey) seed = ((seed * 31 + ch.charCodeAt(0)) >>> 0);

    const seededRandom = () => {
      seed = ((seed * 1664525 + 1013904223) >>> 0);
      return seed / 4294967296;
    };

    // Fisher-Yates shuffle with seeded random
    const shuffled = [...rotatingPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let daily = shuffled.slice(0, 3);

    // Forced skin: inject into rotation if not already present
    const forcedSetting = await prisma.gameSettings.findUnique({ where: { key: 'dj_skin_forced_id' } });
    if (forcedSetting?.value) {
      const forcedId = forcedSetting.value;
      const forced = rotatingPool.find(i => i.id === forcedId);
      if (forced && !daily.find(i => i.id === forcedId)) {
        daily = [forced, ...daily.slice(0, 2)];
      }
    }

    // Next refresh: midnight tonight (local server time → UTC)
    const nextRefresh = new Date();
    nextRefresh.setDate(nextRefresh.getDate() + 1);
    nextRefresh.setHours(0, 0, 0, 0);

    res.json({ static: staticItems, rotating: daily, nextRefresh: nextRefresh.toISOString() });
  } catch (error) {
    console.error('Get doodle skins error:', error);
    res.status(500).json({ error: 'Failed to get doodle skins' });
  }
});

// Admin: Get forced DJ skin
router.get('/admin/dj-forced-skin', authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const setting = await prisma.gameSettings.findUnique({ where: { key: 'dj_skin_forced_id' } });
    res.json({ itemId: setting?.value || null });
  } catch (error) {
    console.error('Get DJ forced skin error:', error);
    res.status(500).json({ error: 'Failed to get forced skin' });
  }
});

// Admin: Set or clear forced DJ skin
router.post('/admin/dj-force-skin', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.body;

    if (!itemId) {
      await prisma.gameSettings.deleteMany({ where: { key: 'dj_skin_forced_id' } });
      return res.json({ success: true, itemId: null });
    }

    await prisma.gameSettings.upsert({
      where: { key: 'dj_skin_forced_id' },
      create: { key: 'dj_skin_forced_id', value: itemId },
      update: { value: itemId },
    });

    res.json({ success: true, itemId });
  } catch (error) {
    console.error('Set DJ forced skin error:', error);
    res.status(500).json({ error: 'Failed to set forced skin' });
  }
});

export default router;
