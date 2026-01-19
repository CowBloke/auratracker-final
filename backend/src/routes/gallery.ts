import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { z } from 'zod';
import { isAllowedImageUrl } from '../utils/uploads.js';

const router = Router();

// Validation schemas
const createPaintingSchema = z.object({
  title: z.string().min(1).max(100),
  artist: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  imageUrl: z.string().min(1),
});

const purchasePackageSchema = z.object({
  tier: z.number().int().min(1).max(3),
});

const updateGallerySchema = z.object({
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  paintings: z.array(z.object({
    copyId: z.string().uuid(),
    position: z.number().int().min(0).max(19),
  })).max(20).optional(),
});

const movePaintingSchema = z.object({
  copyId: z.string().uuid(),
  toGallery: z.boolean(),
  position: z.number().int().min(0).max(19).optional(),
});

// Package prices
const PACKAGE_PRICES = {
  1: 500,
  2: 1000,
  3: 1500,
};

// Rarity weights for art packages (hidden from players)
const RARITY_WEIGHTS = {
  COMMON: 70,
  RARE: 25,
  GOLDEN: 5,
};

// Revenue per painting in gallery (base values)
const REVENUE_PER_RARITY = {
  COMMON: 10,
  RARE: 25,
  GOLDEN: 50,
};

// Golden painting multiplier for total income
const GOLDEN_MULTIPLIER = 1.5;

// Helper to get random rarity based on weights
function getRandomRarity(): 'COMMON' | 'RARE' | 'GOLDEN' {
  const total = RARITY_WEIGHTS.COMMON + RARITY_WEIGHTS.RARE + RARITY_WEIGHTS.GOLDEN;
  const random = Math.random() * total;

  if (random < RARITY_WEIGHTS.COMMON) return 'COMMON';
  if (random < RARITY_WEIGHTS.COMMON + RARITY_WEIGHTS.RARE) return 'RARE';
  return 'GOLDEN';
}

// Helper to check if it's a new day (UTC)
function isNewDay(lastDate: Date | null): boolean {
  if (!lastDate) return true;
  const now = new Date();
  const last = new Date(lastDate);
  return now.toDateString() !== last.toDateString();
}

// ============================================
// GALLERY ENDPOINTS
// ============================================

// Get user's gallery (public)
router.get('/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const [gallery, paintings] = await Promise.all([
      prisma.userGallery.findUnique({
        where: { userId },
      }),
      prisma.paintingCopy.findMany({
        where: {
          ownerId: userId,
          inGallery: true,
        },
        include: {
          painting: true,
        },
        orderBy: { galleryPosition: 'asc' },
      }),
    ]);

    res.json({
      gallery: gallery || { backgroundColor: '#1a1a2e' },
      paintings: paintings.map(p => ({
        id: p.id,
        paintingId: p.paintingId,
        title: p.painting.title,
        artist: p.painting.artist,
        description: p.painting.description,
        imageUrl: p.painting.imageUrl,
        rarity: p.rarity,
        copyNumber: p.copyNumber,
        position: p.galleryPosition,
        maxCopies: p.rarity === 'GOLDEN' ? 1 : p.rarity === 'RARE' ? 2 : 3,
      })),
    });
  } catch (error) {
    console.error('Get gallery error:', error);
    res.status(500).json({ error: 'Failed to get gallery' });
  }
});

// Get user's warehouse (owned paintings not in gallery)
router.get('/warehouse/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const paintings = await prisma.paintingCopy.findMany({
      where: {
        ownerId: req.user.id,
        inGallery: false,
      },
      include: {
        painting: true,
        marketListing: {
          where: { soldAt: null },
        },
      },
      orderBy: { acquiredAt: 'desc' },
    });

    res.json({
      paintings: paintings.map(p => ({
        id: p.id,
        paintingId: p.paintingId,
        title: p.painting.title,
        artist: p.painting.artist,
        description: p.painting.description,
        imageUrl: p.painting.imageUrl,
        rarity: p.rarity,
        copyNumber: p.copyNumber,
        maxCopies: p.rarity === 'GOLDEN' ? 1 : p.rarity === 'RARE' ? 2 : 3,
        acquiredAt: p.acquiredAt,
        isListed: p.marketListing !== null,
      })),
    });
  } catch (error) {
    console.error('Get warehouse error:', error);
    res.status(500).json({ error: 'Failed to get warehouse' });
  }
});

// Get my gallery settings
router.get('/settings/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let gallery = await prisma.userGallery.findUnique({
      where: { userId: req.user.id },
    });

    if (!gallery) {
      gallery = await prisma.userGallery.create({
        data: { userId: req.user.id },
      });
    }

    res.json({ gallery });
  } catch (error) {
    console.error('Get gallery settings error:', error);
    res.status(500).json({ error: 'Failed to get gallery settings' });
  }
});

// Update gallery settings
router.put('/settings/my', authMiddleware, validate(updateGallerySchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { backgroundColor, paintings } = req.body;

    // Update or create gallery settings
    const gallery = await prisma.userGallery.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        backgroundColor: backgroundColor || '#1a1a2e',
      },
      update: {
        ...(backgroundColor && { backgroundColor }),
      },
    });

    // Update painting positions if provided
    if (paintings && paintings.length > 0) {
      // Verify all paintings belong to user
      const userPaintings = await prisma.paintingCopy.findMany({
        where: {
          id: { in: paintings.map((p: { copyId: string }) => p.copyId) },
          ownerId: req.user.id,
        },
      });

      if (userPaintings.length !== paintings.length) {
        return res.status(403).json({ error: 'Some paintings do not belong to you' });
      }

      // Check for duplicate positions
      const positions = paintings.map((p: { position: number }) => p.position);
      if (new Set(positions).size !== positions.length) {
        return res.status(400).json({ error: 'Duplicate positions not allowed' });
      }

      // Update each painting position
      await prisma.$transaction(
        paintings.map((p: { copyId: string; position: number }) =>
          prisma.paintingCopy.update({
            where: { id: p.copyId },
            data: {
              inGallery: true,
              galleryPosition: p.position,
            },
          })
        )
      );
    }

    res.json({ success: true, gallery });
  } catch (error) {
    console.error('Update gallery error:', error);
    res.status(500).json({ error: 'Failed to update gallery' });
  }
});

// Move painting to/from gallery
router.post('/move', authMiddleware, validate(movePaintingSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { copyId, toGallery, position } = req.body;

    // Verify painting belongs to user and is not listed
    const painting = await prisma.paintingCopy.findFirst({
      where: {
        id: copyId,
        ownerId: req.user.id,
      },
      include: {
        marketListing: {
          where: { soldAt: null },
        },
      },
    });

    if (!painting) {
      return res.status(404).json({ error: 'Painting not found' });
    }

    if (painting.marketListing) {
      return res.status(400).json({ error: 'Cannot move a painting that is listed on the market' });
    }

    if (toGallery) {
      // Check gallery limit
      const galleryCount = await prisma.paintingCopy.count({
        where: {
          ownerId: req.user.id,
          inGallery: true,
        },
      });

      if (galleryCount >= 20 && !painting.inGallery) {
        return res.status(400).json({ error: 'Gallery is full (max 20 paintings)' });
      }

      // Check position is not taken
      if (position !== undefined) {
        const existingAtPosition = await prisma.paintingCopy.findFirst({
          where: {
            ownerId: req.user.id,
            inGallery: true,
            galleryPosition: position,
            id: { not: copyId },
          },
        });

        if (existingAtPosition) {
          return res.status(400).json({ error: 'Position already taken' });
        }
      }

      // Move to gallery
      await prisma.paintingCopy.update({
        where: { id: copyId },
        data: {
          inGallery: true,
          galleryPosition: position ?? null,
        },
      });
    } else {
      // Move to warehouse
      await prisma.paintingCopy.update({
        where: { id: copyId },
        data: {
          inGallery: false,
          galleryPosition: null,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Move painting error:', error);
    res.status(500).json({ error: 'Failed to move painting' });
  }
});

// ============================================
// ART PACKAGES
// ============================================

// Get today's packages status
router.get('/packages/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const purchases = await prisma.artPackagePurchase.findMany({
      where: {
        userId: req.user.id,
        purchasedAt: { gte: today },
      },
      select: { packageTier: true },
    });

    const purchasedTiers = purchases.map(p => p.packageTier);

    res.json({
      packages: [
        { tier: 1, price: PACKAGE_PRICES[1], purchased: purchasedTiers.includes(1) },
        { tier: 2, price: PACKAGE_PRICES[2], purchased: purchasedTiers.includes(2) },
        { tier: 3, price: PACKAGE_PRICES[3], purchased: purchasedTiers.includes(3) },
      ],
    });
  } catch (error) {
    console.error('Get packages status error:', error);
    res.status(500).json({ error: 'Failed to get packages status' });
  }
});

// Purchase art package
router.post('/packages/purchase', authMiddleware, validate(purchasePackageSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { tier } = req.body as { tier: 1 | 2 | 3 };
    const price = PACKAGE_PRICES[tier];

    // Check if already purchased today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingPurchase = await prisma.artPackagePurchase.findFirst({
      where: {
        userId: req.user.id,
        packageTier: tier,
        purchasedAt: { gte: today },
      },
    });

    if (existingPurchase) {
      return res.status(400).json({ error: 'Already purchased this package today' });
    }

    // Check user has enough money
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user || user.money < price) {
      return res.status(400).json({ error: 'Insufficient money' });
    }

    // Find an available painting copy
    const rarity = getRandomRarity();

    // Get available copies of this rarity that no one owns yet
    const availableCopy = await prisma.paintingCopy.findFirst({
      where: {
        rarity,
        ownerId: null,
        painting: { isVaulted: false },
      },
      include: { painting: true },
      orderBy: { id: 'asc' }, // Deterministic order
    });

    if (!availableCopy) {
      // Try other rarities if this one is sold out
      const fallbackCopy = await prisma.paintingCopy.findFirst({
        where: {
          ownerId: null,
          painting: { isVaulted: false },
        },
        include: { painting: true },
        orderBy: { id: 'asc' },
      });

      if (!fallbackCopy) {
        return res.status(400).json({ error: 'No paintings available' });
      }

      // Use fallback
      const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
          where: { id: req.user.id },
          data: { money: { decrement: price } },
        }),
        prisma.paintingCopy.update({
          where: { id: fallbackCopy.id },
          data: {
            ownerId: req.user.id,
            acquiredAt: new Date(),
          },
        }),
        prisma.artPackagePurchase.create({
          data: {
            userId: req.user.id,
            packageTier: tier,
            cost: price,
            paintingCopyId: fallbackCopy.id,
          },
        }),
      ]);

      return res.json({
        success: true,
        painting: {
          id: fallbackCopy.id,
          paintingId: fallbackCopy.paintingId,
          title: fallbackCopy.painting.title,
          artist: fallbackCopy.painting.artist,
          description: fallbackCopy.painting.description,
          imageUrl: fallbackCopy.painting.imageUrl,
          rarity: fallbackCopy.rarity,
          copyNumber: fallbackCopy.copyNumber,
          maxCopies: fallbackCopy.rarity === 'GOLDEN' ? 1 : fallbackCopy.rarity === 'RARE' ? 2 : 3,
        },
        newBalance: updatedUser.money,
      });
    }

    // Purchase the available copy
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { money: { decrement: price } },
      }),
      prisma.paintingCopy.update({
        where: { id: availableCopy.id },
        data: {
          ownerId: req.user.id,
          acquiredAt: new Date(),
        },
      }),
      prisma.artPackagePurchase.create({
        data: {
          userId: req.user.id,
          packageTier: tier,
          cost: price,
          paintingCopyId: availableCopy.id,
        },
      }),
    ]);

    res.json({
      success: true,
      painting: {
        id: availableCopy.id,
        paintingId: availableCopy.paintingId,
        title: availableCopy.painting.title,
        artist: availableCopy.painting.artist,
        description: availableCopy.painting.description,
        imageUrl: availableCopy.painting.imageUrl,
        rarity: availableCopy.rarity,
        copyNumber: availableCopy.copyNumber,
        maxCopies: availableCopy.rarity === 'GOLDEN' ? 1 : availableCopy.rarity === 'RARE' ? 2 : 3,
      },
      newBalance: updatedUser.money,
    });
  } catch (error) {
    console.error('Purchase package error:', error);
    res.status(500).json({ error: 'Failed to purchase package' });
  }
});

// ============================================
// NPC VISITS
// ============================================

// Get NPC visit status
router.get('/npc/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const gallery = await prisma.userGallery.findUnique({
      where: { userId: req.user.id },
    });

    const canVisit = !gallery?.lastNpcVisit || isNewDay(gallery.lastNpcVisit);

    // Calculate potential revenue
    const galleryPaintings = await prisma.paintingCopy.findMany({
      where: {
        ownerId: req.user.id,
        inGallery: true,
      },
    });

    let baseRevenue = 0;
    let hasGolden = false;

    for (const p of galleryPaintings) {
      baseRevenue += REVENUE_PER_RARITY[p.rarity as keyof typeof REVENUE_PER_RARITY] || 0;
      if (p.rarity === 'GOLDEN') hasGolden = true;
    }

    const totalRevenue = hasGolden ? Math.floor(baseRevenue * GOLDEN_MULTIPLIER) : baseRevenue;

    res.json({
      canVisit,
      lastVisit: gallery?.lastNpcVisit || null,
      paintingsInGallery: galleryPaintings.length,
      potentialRevenue: totalRevenue,
    });
  } catch (error) {
    console.error('Get NPC status error:', error);
    res.status(500).json({ error: 'Failed to get NPC status' });
  }
});

// Trigger NPC visit
router.post('/npc/visit', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if can visit
    let gallery = await prisma.userGallery.findUnique({
      where: { userId: req.user.id },
    });

    if (gallery?.lastNpcVisit && !isNewDay(gallery.lastNpcVisit)) {
      return res.status(400).json({ error: 'NPCs have already visited today' });
    }

    // Get gallery paintings
    const galleryPaintings = await prisma.paintingCopy.findMany({
      where: {
        ownerId: req.user.id,
        inGallery: true,
      },
    });

    if (galleryPaintings.length === 0) {
      return res.status(400).json({ error: 'Gallery is empty, no revenue generated' });
    }

    // Calculate revenue
    let baseRevenue = 0;
    let hasGolden = false;

    for (const p of galleryPaintings) {
      baseRevenue += REVENUE_PER_RARITY[p.rarity as keyof typeof REVENUE_PER_RARITY] || 0;
      if (p.rarity === 'GOLDEN') hasGolden = true;
    }

    const totalRevenue = hasGolden ? Math.floor(baseRevenue * GOLDEN_MULTIPLIER) : baseRevenue;

    // Update user and gallery
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { money: { increment: totalRevenue } },
      }),
      prisma.userGallery.upsert({
        where: { userId: req.user.id },
        create: {
          userId: req.user.id,
          lastNpcVisit: new Date(),
        },
        update: {
          lastNpcVisit: new Date(),
        },
      }),
    ]);

    res.json({
      success: true,
      revenue: totalRevenue,
      paintingsCount: galleryPaintings.length,
      hadGoldenBonus: hasGolden,
      newBalance: updatedUser.money,
    });
  } catch (error) {
    console.error('NPC visit error:', error);
    res.status(500).json({ error: 'Failed to process NPC visit' });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// Get all paintings (admin)
router.get('/admin/paintings', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const paintings = await prisma.painting.findMany({
      include: {
        copies: {
          include: {
            owner: {
              select: { id: true, username: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      paintings: paintings.map(p => ({
        id: p.id,
        title: p.title,
        artist: p.artist,
        description: p.description,
        imageUrl: p.imageUrl,
        isVaulted: p.isVaulted,
        createdAt: p.createdAt,
        copies: p.copies.map(c => ({
          id: c.id,
          rarity: c.rarity,
          copyNumber: c.copyNumber,
          owner: c.owner,
          inGallery: c.inGallery,
        })),
      })),
    });
  } catch (error) {
    console.error('Get paintings error:', error);
    res.status(500).json({ error: 'Failed to get paintings' });
  }
});

// Create painting (admin)
router.post('/admin/paintings', authMiddleware, adminMiddleware, validate(createPaintingSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { title, artist, description, imageUrl } = req.body;

    if (!isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }

    // Create painting with all 6 copies
    const painting = await prisma.painting.create({
      data: {
        title,
        artist,
        description,
        imageUrl,
        copies: {
          create: [
            // 3 common copies
            { rarity: 'COMMON', copyNumber: 1 },
            { rarity: 'COMMON', copyNumber: 2 },
            { rarity: 'COMMON', copyNumber: 3 },
            // 2 rare copies
            { rarity: 'RARE', copyNumber: 1 },
            { rarity: 'RARE', copyNumber: 2 },
            // 1 golden copy
            { rarity: 'GOLDEN', copyNumber: 1 },
          ],
        },
      },
      include: {
        copies: true,
      },
    });

    res.status(201).json({ painting });
  } catch (error) {
    console.error('Create painting error:', error);
    res.status(500).json({ error: 'Failed to create painting' });
  }
});

// Vault/unvault painting (admin)
router.put('/admin/paintings/:id/vault', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isVaulted } = req.body;

    const painting = await prisma.painting.update({
      where: { id },
      data: { isVaulted },
    });

    res.json({ painting });
  } catch (error) {
    console.error('Vault painting error:', error);
    res.status(500).json({ error: 'Failed to vault painting' });
  }
});

// Get gallery analytics (admin)
router.get('/admin/analytics', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalPaintings,
      ownedCopies,
      copiesByRarity,
      topCollectors,
    ] = await Promise.all([
      prisma.painting.count(),
      prisma.paintingCopy.count({ where: { ownerId: { not: null } } }),
      prisma.paintingCopy.groupBy({
        by: ['rarity'],
        _count: { id: true },
        where: { ownerId: { not: null } },
      }),
      prisma.paintingCopy.groupBy({
        by: ['ownerId'],
        _count: { id: true },
        where: { ownerId: { not: null } },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    // Get usernames for top collectors
    const collectorIds = topCollectors
      .map(c => c.ownerId)
      .filter((id): id is string => id !== null);

    const collectors = await prisma.user.findMany({
      where: { id: { in: collectorIds } },
      select: { id: true, username: true },
    });

    const collectorsMap = new Map(collectors.map(c => [c.id, c.username]));

    res.json({
      totalPaintings,
      totalCopies: totalPaintings * 6,
      ownedCopies,
      availableCopies: totalPaintings * 6 - ownedCopies,
      copiesByRarity: copiesByRarity.map(r => ({
        rarity: r.rarity,
        count: r._count.id,
      })),
      topCollectors: topCollectors.map(c => ({
        userId: c.ownerId,
        username: c.ownerId ? collectorsMap.get(c.ownerId) : null,
        count: c._count.id,
      })),
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

export default router;
