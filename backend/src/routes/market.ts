import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { z } from 'zod';
import { logMarketplace } from '../utils/logger.js';

const router = Router();

// Validation schemas
const listPaintingSchema = z.object({
  paintingCopyId: z.string().uuid(),
  price: z.number().int().min(1),
});

const listItemSchema = z.object({
  userItemId: z.string().uuid(),
  price: z.number().int().min(1),
  quantity: z.number().int().min(1).optional(),
});

const buyListingSchema = z.object({
  listingId: z.string().uuid(),
});

const cancelListingSchema = z.object({
  listingId: z.string().uuid(),
});

// Market fee percentage (5%)
const MARKET_FEE_PERCENT = 5;

// ============================================
// BROWSE LISTINGS
// ============================================

// Get all active listings
router.get('/listings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type, page = '1', limit = '20', sort = 'newest' } = req.query;

    const where = {
      soldAt: null,
      ...(type && { listingType: type as string }),
    };

    const orderBy = sort === 'price_asc'
      ? { price: 'asc' as const }
      : sort === 'price_desc'
        ? { price: 'desc' as const }
        : { createdAt: 'desc' as const };

    const [listings, total] = await Promise.all([
      prisma.marketListing.findMany({
        where,
        orderBy,
        take: parseInt(limit as string),
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        include: {
          seller: {
            select: { id: true, username: true },
          },
          paintingCopy: {
            include: {
              painting: true,
            },
          },
          userItem: {
            include: {
              item: true,
            },
          },
        },
      }),
      prisma.marketListing.count({ where }),
    ]);

    res.json({
      listings: listings.map(l => ({
        id: l.id,
        type: l.listingType,
        price: l.price,
        quantity: l.quantity,
        createdAt: l.createdAt,
        seller: l.seller,
        // Painting details
        painting: l.paintingCopy ? {
          copyId: l.paintingCopy.id,
          paintingId: l.paintingCopy.paintingId,
          title: l.paintingCopy.painting.title,
          artist: l.paintingCopy.painting.artist,
          description: l.paintingCopy.painting.description,
          imageUrl: l.paintingCopy.painting.imageUrl,
          rarity: l.paintingCopy.rarity,
          copyNumber: l.paintingCopy.copyNumber,
          maxCopies: l.paintingCopy.rarity === 'GOLDEN' ? 1 : l.paintingCopy.rarity === 'RARE' ? 2 : 3,
        } : null,
        // Item details
        item: l.userItem ? {
          userItemId: l.userItem.id,
          itemId: l.userItem.item.id,
          name: l.userItem.item.name,
          description: l.userItem.item.description,
          type: l.userItem.item.type,
          imageUrl: l.userItem.item.imageUrl,
          effect: l.userItem.item.effect,
        } : null,
      })),
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

// Get my listings
router.get('/my-listings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const listings = await prisma.marketListing.findMany({
      where: {
        sellerId: req.user.id,
        soldAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        paintingCopy: {
          include: {
            painting: true,
          },
        },
        userItem: {
          include: {
            item: true,
          },
        },
      },
    });

    res.json({
      listings: listings.map(l => ({
        id: l.id,
        type: l.listingType,
        price: l.price,
        quantity: l.quantity,
        createdAt: l.createdAt,
        painting: l.paintingCopy ? {
          copyId: l.paintingCopy.id,
          title: l.paintingCopy.painting.title,
          rarity: l.paintingCopy.rarity,
          copyNumber: l.paintingCopy.copyNumber,
          imageUrl: l.paintingCopy.painting.imageUrl,
        } : null,
        item: l.userItem ? {
          name: l.userItem.item.name,
          imageUrl: l.userItem.item.imageUrl,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Get my listings error:', error);
    res.status(500).json({ error: 'Failed to get my listings' });
  }
});

// Get sales history
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { page = '1', limit = '20' } = req.query;

    const [sales, purchases] = await Promise.all([
      prisma.marketListing.findMany({
        where: {
          sellerId: req.user.id,
          soldAt: { not: null },
        },
        orderBy: { soldAt: 'desc' },
        take: parseInt(limit as string),
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        include: {
          buyer: {
            select: { id: true, username: true },
          },
          paintingCopy: {
            include: { painting: true },
          },
          userItem: {
            include: { item: true },
          },
        },
      }),
      prisma.marketListing.findMany({
        where: {
          buyerId: req.user.id,
          soldAt: { not: null },
        },
        orderBy: { soldAt: 'desc' },
        take: parseInt(limit as string),
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        include: {
          seller: {
            select: { id: true, username: true },
          },
          paintingCopy: {
            include: { painting: true },
          },
          userItem: {
            include: { item: true },
          },
        },
      }),
    ]);

    res.json({ sales, purchases });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ============================================
// LIST ITEMS
// ============================================

// List a painting for sale
router.post('/list/painting', authMiddleware, validate(listPaintingSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { paintingCopyId, price } = req.body;

    // Verify ownership and not already listed
    const copy = await prisma.paintingCopy.findFirst({
      where: {
        id: paintingCopyId,
        ownerId: req.user.id,
      },
      include: {
        painting: true,
        marketListing: {
          where: { soldAt: null },
        },
      },
    });

    if (!copy) {
      return res.status(404).json({ error: 'Painting not found in your collection' });
    }

    if (copy.marketListing) {
      return res.status(400).json({ error: 'Painting is already listed' });
    }

    if (copy.inGallery) {
      return res.status(400).json({ error: 'Remove painting from gallery before listing' });
    }

    // Create listing
    const listing = await prisma.marketListing.create({
      data: {
        sellerId: req.user.id,
        listingType: 'PAINTING',
        price,
        paintingCopyId,
      },
      include: {
        paintingCopy: {
          include: { painting: true },
        },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { username: true },
    });

    logMarketplace('listing_create', req.user.id, user?.username || undefined, {
      listingId: listing.id,
      type: 'PAINTING',
      paintingTitle: copy.painting.title,
      rarity: copy.rarity,
      price,
    });

    res.status(201).json({
      success: true,
      listing: {
        id: listing.id,
        type: listing.listingType,
        price: listing.price,
        painting: {
          copyId: listing.paintingCopy!.id,
          title: listing.paintingCopy!.painting.title,
          rarity: listing.paintingCopy!.rarity,
        },
      },
    });
  } catch (error) {
    console.error('List painting error:', error);
    res.status(500).json({ error: 'Failed to list painting' });
  }
});

// List an item for sale
router.post('/list/item', authMiddleware, validate(listItemSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userItemId, price, quantity = 1 } = req.body;

    // Verify ownership and sufficient quantity
    const userItem = await prisma.userItem.findFirst({
      where: {
        id: userItemId,
        userId: req.user.id,
      },
      include: {
        item: true,
        marketListing: {
          where: { soldAt: null },
        },
      },
    });

    if (!userItem) {
      return res.status(404).json({ error: 'Item not found in your inventory' });
    }

    if (userItem.marketListing) {
      return res.status(400).json({ error: 'Item is already listed' });
    }

    if (userItem.quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient quantity' });
    }

    // Create listing
    const listing = await prisma.marketListing.create({
      data: {
        sellerId: req.user.id,
        listingType: 'ITEM',
        price,
        userItemId,
        quantity,
      },
      include: {
        userItem: {
          include: { item: true },
        },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { username: true },
    });

    logMarketplace('listing_create', req.user.id, user?.username || undefined, {
      listingId: listing.id,
      type: 'ITEM',
      itemName: userItem.item.name,
      quantity,
      price,
    });

    res.status(201).json({
      success: true,
      listing: {
        id: listing.id,
        type: listing.listingType,
        price: listing.price,
        quantity: listing.quantity,
        item: {
          name: listing.userItem!.item.name,
          imageUrl: listing.userItem!.item.imageUrl,
        },
      },
    });
  } catch (error) {
    console.error('List item error:', error);
    res.status(500).json({ error: 'Failed to list item' });
  }
});

// ============================================
// BUY & CANCEL
// ============================================

// Buy a listing
router.post('/buy', authMiddleware, validate(buyListingSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { listingId } = req.body;

    // Get listing
    const listing = await prisma.marketListing.findUnique({
      where: { id: listingId },
      include: {
        seller: {
          select: { id: true, username: true },
        },
        paintingCopy: {
          include: { painting: true },
        },
        userItem: {
          include: { item: true },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.soldAt) {
      return res.status(400).json({ error: 'Listing already sold' });
    }

    if (listing.sellerId === req.user.id) {
      return res.status(400).json({ error: 'Cannot buy your own listing' });
    }

    // Check buyer has enough money
    const buyer = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!buyer || buyer.money < listing.price) {
      return res.status(400).json({ error: 'Insufficient money' });
    }

    // Calculate fee
    const fee = Math.floor(listing.price * MARKET_FEE_PERCENT / 100);
    const sellerReceives = listing.price - fee;

    // Process transaction
    if (listing.listingType === 'PAINTING' && listing.paintingCopyId) {
      // Transfer painting ownership
      await prisma.$transaction([
        // Deduct money from buyer
        prisma.user.update({
          where: { id: req.user.id },
          data: { money: { decrement: listing.price } },
        }),
        // Add money to seller (minus fee)
        prisma.user.update({
          where: { id: listing.sellerId },
          data: { money: { increment: sellerReceives } },
        }),
        // Transfer painting ownership
        prisma.paintingCopy.update({
          where: { id: listing.paintingCopyId },
          data: {
            ownerId: req.user.id,
            acquiredAt: new Date(),
          },
        }),
        // Mark listing as sold
        prisma.marketListing.update({
          where: { id: listingId },
          data: {
            soldAt: new Date(),
            buyerId: req.user.id,
          },
        }),
      ]);

      logMarketplace('listing_sold', req.user.id, buyer.username, {
        listingId,
        type: 'PAINTING',
        paintingTitle: listing.paintingCopy?.painting.title,
        rarity: listing.paintingCopy?.rarity,
        price: listing.price,
        fee,
        sellerId: listing.sellerId,
        sellerUsername: listing.seller.username,
      });

      const updatedBuyer = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      res.json({
        success: true,
        type: 'PAINTING',
        painting: {
          copyId: listing.paintingCopy!.id,
          title: listing.paintingCopy!.painting.title,
          rarity: listing.paintingCopy!.rarity,
        },
        pricePaid: listing.price,
        fee,
        newBalance: updatedBuyer?.money || 0,
      });
    } else if (listing.listingType === 'ITEM' && listing.userItemId) {
      // Transfer item ownership
      const sellerItem = await prisma.userItem.findUnique({
        where: { id: listing.userItemId },
      });

      if (!sellerItem || sellerItem.quantity < listing.quantity) {
        return res.status(400).json({ error: 'Item no longer available' });
      }

      await prisma.$transaction([
        // Deduct money from buyer
        prisma.user.update({
          where: { id: req.user.id },
          data: { money: { decrement: listing.price } },
        }),
        // Add money to seller (minus fee)
        prisma.user.update({
          where: { id: listing.sellerId },
          data: { money: { increment: sellerReceives } },
        }),
        // Remove item from seller (or decrease quantity)
        sellerItem.quantity === listing.quantity
          ? prisma.userItem.delete({ where: { id: listing.userItemId! } })
          : prisma.userItem.update({
              where: { id: listing.userItemId! },
              data: { quantity: { decrement: listing.quantity } },
            }),
        // Add item to buyer
        prisma.userItem.upsert({
          where: {
            userId_itemId: {
              userId: req.user.id,
              itemId: sellerItem.itemId,
            },
          },
          create: {
            userId: req.user.id,
            itemId: sellerItem.itemId,
            quantity: listing.quantity,
          },
          update: {
            quantity: { increment: listing.quantity },
          },
        }),
        // Mark listing as sold
        prisma.marketListing.update({
          where: { id: listingId },
          data: {
            soldAt: new Date(),
            buyerId: req.user.id,
          },
        }),
      ]);

      logMarketplace('listing_sold', req.user.id, buyer.username, {
        listingId,
        type: 'ITEM',
        itemName: listing.userItem?.item.name,
        quantity: listing.quantity,
        price: listing.price,
        fee,
        sellerId: listing.sellerId,
        sellerUsername: listing.seller.username,
      });

      const updatedBuyer = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      res.json({
        success: true,
        type: 'ITEM',
        item: {
          name: listing.userItem!.item.name,
          quantity: listing.quantity,
        },
        pricePaid: listing.price,
        fee,
        newBalance: updatedBuyer?.money || 0,
      });
    } else {
      return res.status(400).json({ error: 'Invalid listing' });
    }
  } catch (error) {
    console.error('Buy listing error:', error);
    res.status(500).json({ error: 'Failed to buy listing' });
  }
});

// Cancel a listing
router.post('/cancel', authMiddleware, validate(cancelListingSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { listingId } = req.body;

    // Get listing
    const listing = await prisma.marketListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.sellerId !== req.user.id) {
      return res.status(403).json({ error: 'Not your listing' });
    }

    if (listing.soldAt) {
      return res.status(400).json({ error: 'Listing already sold' });
    }

    // Delete listing
    await prisma.marketListing.delete({
      where: { id: listingId },
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { username: true },
    });

    logMarketplace('listing_cancel', req.user.id, user?.username || undefined, {
      listingId,
      type: listing.listingType,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel listing error:', error);
    res.status(500).json({ error: 'Failed to cancel listing' });
  }
});

// ============================================
// MARKET STATS
// ============================================

// Get market statistics
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [
      activeListings,
      totalSales,
      recentSales,
    ] = await Promise.all([
      prisma.marketListing.count({ where: { soldAt: null } }),
      prisma.marketListing.count({ where: { soldAt: { not: null } } }),
      prisma.marketListing.findMany({
        where: { soldAt: { not: null } },
        orderBy: { soldAt: 'desc' },
        take: 10,
        include: {
          seller: { select: { username: true } },
          buyer: { select: { username: true } },
          paintingCopy: { include: { painting: true } },
          userItem: { include: { item: true } },
        },
      }),
    ]);

    res.json({
      activeListings,
      totalSales,
      recentSales: recentSales.map(s => ({
        type: s.listingType,
        price: s.price,
        soldAt: s.soldAt,
        seller: s.seller.username,
        buyer: s.buyer?.username,
        itemName: s.listingType === 'PAINTING'
          ? s.paintingCopy?.painting.title
          : s.userItem?.item.name,
      })),
    });
  } catch (error) {
    console.error('Get market stats error:', error);
    res.status(500).json({ error: 'Failed to get market stats' });
  }
});

export default router;
