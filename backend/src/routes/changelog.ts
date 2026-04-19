import path from 'path';
import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { isAllowedImageUrl, writeBase64UploadImage } from '../utils/uploads.js';

const router = Router();

const UPDATE_SECTION_CATEGORIES = ['BIG_FEATURE', 'SMALL_FEATURE', 'BUG_FIX'] as const;
const UPDATE_FEED_CATEGORIES = ['GAME', 'PATCH', 'COMMUNITY', 'DEV'] as const;
const UPDATE_IMAGE_UPLOAD_DIR = path.resolve('uploads', 'updates');
const MAX_UPDATE_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

type UpdateSectionCategory = typeof UPDATE_SECTION_CATEGORIES[number];
type UpdateFeedCategory = typeof UPDATE_FEED_CATEGORIES[number];

type NormalizedSection = {
  category: UpdateSectionCategory;
  items: string[];
};

type UpdateEntryWithItems = Awaited<ReturnType<typeof getEntryQuery>>[number];

const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const getEntryQuery = () => prisma.updateEntry.findMany({
  include: { items: true },
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toOptionalTrimmedString = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isValidHexColor = (value: string) => /^#([0-9a-fA-F]{6})$/.test(value);

const isValidUpdateHref = (value: string) =>
  value.startsWith('/') || value.startsWith('#') || /^https?:\/\//i.test(value);

const normalizeSections = (value: unknown): { sections: NormalizedSection[] } | { error: string } => {
  if (!Array.isArray(value)) {
    return { error: 'Les sections doivent être un tableau.' };
  }

  const seenCategories = new Set<string>();
  const normalized: NormalizedSection[] = [];

  for (const rawSection of value) {
    if (!isObject(rawSection)) {
      return { error: 'Chaque section doit être un objet.' };
    }

    const category = typeof rawSection.category === 'string'
      ? rawSection.category.trim().toUpperCase()
      : '';
    if (!UPDATE_SECTION_CATEGORIES.includes(category as UpdateSectionCategory)) {
      return { error: `Catégorie de section invalide: ${category || 'inconnue'}.` };
    }
    if (seenCategories.has(category)) {
      return { error: `La catégorie ${category} est dupliquée.` };
    }

    if (!Array.isArray(rawSection.items)) {
      return { error: `La section ${category} doit contenir une liste d'éléments.` };
    }

    const items = rawSection.items
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }
        if (isObject(item) && typeof item.text === 'string') {
          return item.text.trim();
        }
        return '';
      })
      .filter(Boolean);

    if (items.some((item) => item.length > 600)) {
      return { error: `Une ligne de la section ${category} dépasse 600 caractères.` };
    }

    seenCategories.add(category);
    normalized.push({
      category: category as UpdateSectionCategory,
      items,
    });
  }

  return { sections: normalized };
};

const normalizeEntryPayload = (
  body: Record<string, unknown>
): (
  {
    date: string;
    title: string;
    summary: string;
    body: string | null;
    feedCategory: UpdateFeedCategory;
    imageUrl: string | null;
    accentColor: string | null;
    isFeatured: boolean;
    ctaLabel: string | null;
    ctaHref: string | null;
    authorName: string;
    authorRole: string | null;
    authorAvatarUrl: string | null;
    isPublished: boolean;
    publishedAt: Date;
    sections: NormalizedSection[];
  } | { error: string }
) => {
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: 'La date doit être au format YYYY-MM-DD.' };
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length < 3 || title.length > 140) {
    return { error: 'Le titre doit contenir entre 3 et 140 caractères.' };
  }

  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  if (summary.length < 8 || summary.length > 320) {
    return { error: 'Le résumé doit contenir entre 8 et 320 caractères.' };
  }

  const fullBody = toOptionalTrimmedString(body.body);
  if (fullBody && fullBody.length > 5000) {
    return { error: 'Le contenu détaillé est trop long (max 5000 caractères).' };
  }

  const feedCategory = typeof body.feedCategory === 'string'
    ? body.feedCategory.trim().toUpperCase()
    : 'DEV';
  if (!UPDATE_FEED_CATEGORIES.includes(feedCategory as UpdateFeedCategory)) {
    return { error: 'La catégorie de dashboard est invalide.' };
  }

  const imageUrl = toOptionalTrimmedString(body.imageUrl);
  if (imageUrl && !isAllowedImageUrl(imageUrl)) {
    return { error: 'L’image doit être une URL autorisée ou un fichier uploadé.' };
  }

  const accentColor = toOptionalTrimmedString(body.accentColor);
  if (accentColor && !isValidHexColor(accentColor)) {
    return { error: 'La couleur d’accent doit être au format #RRGGBB.' };
  }

  const ctaLabel = toOptionalTrimmedString(body.ctaLabel);
  if (ctaLabel && ctaLabel.length > 40) {
    return { error: 'Le libellé du bouton est trop long (max 40 caractères).' };
  }

  const ctaHref = toOptionalTrimmedString(body.ctaHref);
  if (ctaHref && !isValidUpdateHref(ctaHref)) {
    return { error: 'Le lien du bouton doit être une URL http(s), un chemin interne ou une ancre.' };
  }

  const authorName = typeof body.authorName === 'string' ? body.authorName.trim() : '';
  if (authorName.length < 2 || authorName.length > 80) {
    return { error: 'Le nom d’auteur doit contenir entre 2 et 80 caractères.' };
  }

  const authorRole = toOptionalTrimmedString(body.authorRole);
  if (authorRole && authorRole.length > 80) {
    return { error: 'Le rôle auteur est trop long (max 80 caractères).' };
  }

  const authorAvatarUrl = toOptionalTrimmedString(body.authorAvatarUrl);
  if (authorAvatarUrl && !isAllowedImageUrl(authorAvatarUrl)) {
    return { error: 'L’avatar auteur doit être une URL autorisée ou un fichier uploadé.' };
  }

  const isPublished = body.isPublished !== false;
  const publishedAt = new Date(String(body.publishedAt ?? body.date));
  if (Number.isNaN(publishedAt.getTime())) {
    return { error: 'La date de publication est invalide.' };
  }

  const normalizedSections = normalizeSections(body.sections ?? []);
  if ('error' in normalizedSections) {
    return normalizedSections;
  }

  return {
    date,
    title,
    summary,
    body: fullBody,
    feedCategory: feedCategory as UpdateFeedCategory,
    imageUrl,
    accentColor,
    isFeatured: body.isFeatured === true,
    ctaLabel,
    ctaHref,
    authorName,
    authorRole,
    authorAvatarUrl,
    isPublished,
    publishedAt,
    sections: normalizedSections.sections,
  };
};

function groupItems(items: { id: string; category: string; text: string; order: number }[]) {
  const grouped = new Map<UpdateSectionCategory, { id: string; text: string }[]>();

  for (const category of UPDATE_SECTION_CATEGORIES) {
    grouped.set(category, []);
  }

  for (const item of [...items].sort((a, b) => a.order - b.order)) {
    if (!UPDATE_SECTION_CATEGORIES.includes(item.category as UpdateSectionCategory)) {
      continue;
    }

    grouped.get(item.category as UpdateSectionCategory)?.push({
      id: item.id,
      text: item.text,
    });
  }

  return UPDATE_SECTION_CATEGORIES
    .map((category) => ({
      category,
      items: grouped.get(category) ?? [],
    }))
    .filter((section) => section.items.length > 0);
}

const inferAccentColor = (feedCategory: UpdateFeedCategory, accentColor: string | null) => {
  if (accentColor) {
    return accentColor;
  }

  switch (feedCategory) {
    case 'GAME':
      return '#3b82f6';
    case 'PATCH':
      return '#10b981';
    case 'COMMUNITY':
      return '#a855f7';
    case 'DEV':
    default:
      return '#f59e0b';
  }
};

const serializeUpdateEntry = (entry: UpdateEntryWithItems) => ({
  id: entry.id,
  date: entry.date,
  title: entry.title,
  summary: entry.summary,
  body: entry.body,
  feedCategory: entry.feedCategory,
  imageUrl: entry.imageUrl,
  accentColor: inferAccentColor(entry.feedCategory as UpdateFeedCategory, entry.accentColor),
  isFeatured: entry.isFeatured,
  ctaLabel: entry.ctaLabel,
  ctaHref: entry.ctaHref,
  author: {
    name: entry.authorName,
    role: entry.authorRole,
    avatarUrl: entry.authorAvatarUrl,
  },
  isPublished: entry.isPublished,
  publishedAt: entry.publishedAt.toISOString(),
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString(),
  sections: groupItems(entry.items),
});

async function notifyNewUpdate(entry: { title: string; summary: string }) {
  const approvedUsers = await prisma.user.findMany({
    where: { isApproved: true },
    select: { id: true },
  });

  await Promise.allSettled(
    approvedUsers.map((user) =>
      createNotification({
        userId: user.id,
        type: 'SYSTEM',
        title: `Nouvelle mise a jour: ${entry.title}`,
        body: entry.summary,
        link: '/dashboard',
        icon: 'megaphone',
      })
    )
  );
}

// Public feed
router.get('/', async (_req, res: Response) => {
  const now = new Date();
  const entries = await prisma.updateEntry.findMany({
    where: {
      isPublished: true,
      publishedAt: { lte: now },
    },
    orderBy: [
      { date: 'desc' },
      { isFeatured: 'desc' },
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    include: { items: true },
  });

  return res.json(entries.map(serializeUpdateEntry));
});

router.get('/ids', async (_req, res: Response) => {
  const now = new Date();
  const entries = await prisma.updateEntry.findMany({
    where: {
      isPublished: true,
      publishedAt: { lte: now },
    },
    orderBy: [
      { date: 'desc' },
      { isFeatured: 'desc' },
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    select: { id: true },
  });

  return res.json({ ids: entries.map((entry) => entry.id) });
});

// Admin feed
router.get('/admin', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const entries = await prisma.updateEntry.findMany({
    orderBy: [
      { date: 'desc' },
      { isFeatured: 'desc' },
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    include: { items: true },
  });

  return res.json({ entries: entries.map(serializeUpdateEntry) });
});

router.post('/upload-image', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const base64Data = typeof req.body.base64Data === 'string' ? req.body.base64Data : '';
    const mimeType = typeof req.body.mimeType === 'string' ? req.body.mimeType : '';

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required' });
    }

    const uploadedImage = await writeBase64UploadImage({
      base64Data,
      mimeType,
      uploadDir: UPDATE_IMAGE_UPLOAD_DIR,
      maxBytes: MAX_UPDATE_IMAGE_SIZE_BYTES,
    });

    if ('error' in uploadedImage) {
      return res.status(400).json({ error: uploadedImage.error });
    }

    return res.status(201).json({
      imageUrl: `/api/uploads/updates/${uploadedImage.fileName}`,
    });
  } catch (error) {
    console.error('Update image upload error:', error);
    return res.status(500).json({ error: 'Failed to upload image' });
  }
});

router.post('/', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const normalized = normalizeEntryPayload(req.body as Record<string, unknown>);
    if ('error' in normalized) {
      return res.status(400).json({ error: normalized.error });
    }

    const entry = await prisma.updateEntry.create({
      data: {
        date: normalized.date,
        title: normalized.title,
        summary: normalized.summary,
        body: normalized.body,
        feedCategory: normalized.feedCategory,
        imageUrl: normalized.imageUrl,
        accentColor: normalized.accentColor,
        isFeatured: normalized.isFeatured,
        ctaLabel: normalized.ctaLabel,
        ctaHref: normalized.ctaHref,
        authorName: normalized.authorName,
        authorRole: normalized.authorRole,
        authorAvatarUrl: normalized.authorAvatarUrl,
        isPublished: normalized.isPublished,
        publishedAt: normalized.publishedAt,
        items: {
          create: normalized.sections.flatMap((section) =>
            section.items.map((text, order) => ({
              category: section.category,
              text,
              order,
            }))
          ),
        },
      },
      include: { items: true },
    });

    if (normalized.isPublished && normalized.publishedAt.getTime() <= Date.now()) {
      void notifyNewUpdate({
        title: entry.title,
        summary: entry.summary,
      }).catch((error) => {
        console.error('Failed to send update notifications:', error);
      });
    }

    return res.status(201).json({ entry: serializeUpdateEntry(entry) });
  } catch (error) {
    console.error('Create update entry error:', error);
    return res.status(500).json({ error: 'Failed to create update entry' });
  }
});

router.put('/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const normalized = normalizeEntryPayload(req.body as Record<string, unknown>);
    if ('error' in normalized) {
      return res.status(400).json({ error: normalized.error });
    }

    const existing = await prisma.updateEntry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Update entry not found' });
    }

    const entry = await prisma.$transaction(async (tx) => {
      await tx.updateItem.deleteMany({ where: { entryId: id } });

      return tx.updateEntry.update({
        where: { id },
        data: {
          date: normalized.date,
          title: normalized.title,
          summary: normalized.summary,
          body: normalized.body,
          feedCategory: normalized.feedCategory,
          imageUrl: normalized.imageUrl,
          accentColor: normalized.accentColor,
          isFeatured: normalized.isFeatured,
          ctaLabel: normalized.ctaLabel,
          ctaHref: normalized.ctaHref,
          authorName: normalized.authorName,
          authorRole: normalized.authorRole,
          authorAvatarUrl: normalized.authorAvatarUrl,
          isPublished: normalized.isPublished,
          publishedAt: normalized.publishedAt,
          items: {
            create: normalized.sections.flatMap((section) =>
              section.items.map((text, order) => ({
                category: section.category,
                text,
                order,
              }))
            ),
          },
        },
        include: { items: true },
      });
    });

    return res.json({ entry: serializeUpdateEntry(entry) });
  } catch (error) {
    console.error('Update update entry error:', error);
    return res.status(500).json({ error: 'Failed to update update entry' });
  }
});

router.delete('/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.updateEntry.delete({
      where: { id: req.params.id },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete update entry error:', error);
    return res.status(500).json({ error: 'Failed to delete update entry' });
  }
});

export default router;
