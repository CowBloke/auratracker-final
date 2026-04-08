import { Router, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../server.js';

const router = Router();

const AD_TYPES = ['CARD', 'BANNER', 'INTERSTITIAL'] as const;
type AdType = (typeof AD_TYPES)[number];

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const MAX_ADS_PER_BUSINESS = 2;

const ERROR_STATUS: Record<string, number> = {
  AD_NOT_FOUND: 404,
  AD_FORBIDDEN: 403,
  AD_LIMIT_REACHED: 400,
  AD_INVALID_TYPE: 400,
  AD_TAGLINE_TOO_LONG: 400,
};

function isAdType(value: unknown): value is AdType {
  return typeof value === 'string' && AD_TYPES.includes(value as AdType);
}

function parseLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function routeError(res: Response, code: keyof typeof ERROR_STATUS) {
  return res.status(ERROR_STATUS[code]).json({ error: code });
}

async function getOwnedAd(adId: string, ownerId: string) {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          verified: true,
          ownerId: true,
        },
      },
    },
  });

  if (!ad) return { ad: null, reason: 'AD_NOT_FOUND' as const };
  if (ad.business.ownerId !== ownerId) return { ad: null, reason: 'AD_FORBIDDEN' as const };

  const { business, ...rest } = ad;
  return {
    ad: {
      ...rest,
      business: {
        id: business.id,
        name: business.name,
        logoUrl: business.logoUrl,
        verified: business.verified,
      },
    },
    reason: null,
  };
}

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const {
      businessId,
      title,
      tagline,
      imageUrl,
      ctaText,
      ctaLink,
      adType,
    } = req.body as {
      businessId?: string;
      title?: string;
      tagline?: string;
      imageUrl?: string | null;
      ctaText?: string;
      ctaLink?: string;
      adType?: string;
    };

    if (!businessId || !title || !tagline || !ctaLink || !adType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (tagline.length > 100) {
      return routeError(res, 'AD_TAGLINE_TOO_LONG');
    }

    if (!isAdType(adType)) {
      return routeError(res, 'AD_INVALID_TYPE');
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true, name: true, logoUrl: true, verified: true },
    });

    if (!business) {
      return routeError(res, 'AD_NOT_FOUND');
    }

    if (business.ownerId !== req.user.id) {
      return routeError(res, 'AD_FORBIDDEN');
    }

    const adCount = await prisma.ad.count({ where: { businessId } });
    if (adCount >= MAX_ADS_PER_BUSINESS) {
      return routeError(res, 'AD_LIMIT_REACHED');
    }

    const ad = await prisma.ad.create({
      data: {
        businessId,
        title: title.trim(),
        tagline: tagline.trim(),
        imageUrl: imageUrl?.trim() || null,
        ctaText: ctaText?.trim() || 'En savoir plus',
        ctaLink: ctaLink.trim(),
        adType,
        status: 'PENDING',
        isActive: false,
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            verified: true,
          },
        },
      },
    });

    return res.status(201).json({ ad });
  } catch (error) {
    console.error('Create ad error:', error);
    return res.status(500).json({ error: 'Failed to create ad' });
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const ads = await prisma.ad.findMany({
      where: {
        business: {
          ownerId: req.user.id,
        },
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            verified: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ ads });
  } catch (error) {
    console.error('List own ads error:', error);
    return res.status(500).json({ error: 'Failed to list ads' });
  }
});

router.get('/public', async (req, res: Response) => {
  try {
    const type = req.query.type;
    const limit = parseLimit(req.query.limit);

    if (type !== undefined && !isAdType(type)) {
      return routeError(res, 'AD_INVALID_TYPE');
    }

    const ads = await prisma.ad.findMany({
      where: {
        isActive: true,
        status: 'APPROVED',
        ...(type ? { adType: type } : {}),
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            verified: true,
          },
        },
      },
    });

    return res.json({ ads: shuffleArray(ads).slice(0, limit) });
  } catch (error) {
    console.error('List public ads error:', error);
    return res.status(500).json({ error: 'Failed to list public ads' });
  }
});

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const ownership = await getOwnedAd(req.params.id, req.user.id);
    if (!ownership.ad) {
      return routeError(res, ownership.reason);
    }

    const {
      title,
      tagline,
      imageUrl,
      ctaText,
      ctaLink,
      adType,
      isActive,
    } = req.body as {
      title?: string;
      tagline?: string;
      imageUrl?: string | null;
      ctaText?: string;
      ctaLink?: string;
      adType?: string;
      isActive?: boolean;
    };

    if (tagline !== undefined && tagline.length > 100) {
      return routeError(res, 'AD_TAGLINE_TOO_LONG');
    }

    if (adType !== undefined && !isAdType(adType)) {
      return routeError(res, 'AD_INVALID_TYPE');
    }

    const ad = await prisma.ad.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(tagline !== undefined ? { tagline: tagline.trim() } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl?.trim() || null } : {}),
        ...(ctaText !== undefined ? { ctaText: ctaText.trim() || 'En savoir plus' } : {}),
        ...(ctaLink !== undefined ? { ctaLink: ctaLink.trim() } : {}),
        ...(adType !== undefined ? { adType } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(ad.tagline !== tagline || ad.adType !== adType ? { status: ad.status } : {}),
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            verified: true,
          },
        },
      },
    });

    return res.json({ ad });
  } catch (error) {
    console.error('Update ad error:', error);
    return res.status(500).json({ error: 'Failed to update ad' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const ownership = await getOwnedAd(req.params.id, req.user.id);
    if (!ownership.ad) {
      return routeError(res, ownership.reason);
    }

    if (ownership.ad.status === 'PENDING') {
      await prisma.ad.update({
        where: { id: req.params.id },
        data: { status: 'REJECTED', isActive: false, reviewedAt: new Date(), reviewedById: req.user.id },
      });
      return res.json({ ok: true });
    }

    await prisma.ad.delete({ where: { id: req.params.id } });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete ad error:', error);
    return res.status(500).json({ error: 'Failed to delete ad' });
  }
});

router.post('/:id/impression', async (req, res: Response) => {
  try {
    await prisma.ad.update({
      where: { id: req.params.id },
      data: {
        impressions: { increment: 1 },
      },
    });

    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return routeError(res, 'AD_NOT_FOUND');
    }

    console.error('Track ad impression error:', error);
    return res.status(500).json({ error: 'Failed to track impression' });
  }
});

router.post('/:id/click', async (req, res: Response) => {
  try {
    await prisma.ad.update({
      where: { id: req.params.id },
      data: {
        clicks: { increment: 1 },
      },
    });

    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return routeError(res, 'AD_NOT_FOUND');
    }

    console.error('Track ad click error:', error);
    return res.status(500).json({ error: 'Failed to track click' });
  }
});

export default router;
