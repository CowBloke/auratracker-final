import { prisma } from '../server.js';

type SeedSection = {
  category: 'BIG_FEATURE' | 'SMALL_FEATURE' | 'BUG_FIX';
  items: string[];
};

type SeedReactions = {
  fire: number;
  heart: number;
  zap: number;
};

type SeedEntry = {
  id: string;
  date: string;
  title: string;
  summary: string;
  body: string;
  feedCategory: 'GAME' | 'PATCH' | 'COMMUNITY' | 'DEV';
  imageUrl: string | null;
  accentColor: string;
  isFeatured: boolean;
  reactionSeed: SeedReactions;
  ctaLabel: string | null;
  ctaHref: string | null;
  authorName: string;
  authorRole: string | null;
  authorAvatarUrl: string | null;
  publishedAt: string;
  sections: SeedSection[];
};

const DASHBOARD_SEED_ENTRIES: SeedEntry[] = [];

export async function ensureDashboardSeedEntries() {
  await prisma.$transaction(async (tx) => {
    for (const entry of DASHBOARD_SEED_ENTRIES) {
      await tx.updateEntry.upsert({
        where: { id: entry.id },
        create: {
          id: entry.id,
          date: entry.date,
          title: entry.title,
          summary: entry.summary,
          body: entry.body,
          feedCategory: entry.feedCategory,
          imageUrl: entry.imageUrl,
          accentColor: entry.accentColor,
          isFeatured: entry.isFeatured,
          reactionSeedFire: entry.reactionSeed.fire,
          reactionSeedHeart: entry.reactionSeed.heart,
          reactionSeedZap: entry.reactionSeed.zap,
          ctaLabel: entry.ctaLabel,
          ctaHref: entry.ctaHref,
          authorName: entry.authorName,
          authorRole: entry.authorRole,
          authorAvatarUrl: entry.authorAvatarUrl,
          isPublished: true,
          publishedAt: new Date(entry.publishedAt),
        },
        update: {
          date: entry.date,
          title: entry.title,
          summary: entry.summary,
          body: entry.body,
          feedCategory: entry.feedCategory,
          imageUrl: entry.imageUrl,
          accentColor: entry.accentColor,
          isFeatured: entry.isFeatured,
          reactionSeedFire: entry.reactionSeed.fire,
          reactionSeedHeart: entry.reactionSeed.heart,
          reactionSeedZap: entry.reactionSeed.zap,
          ctaLabel: entry.ctaLabel,
          ctaHref: entry.ctaHref,
          authorName: entry.authorName,
          authorRole: entry.authorRole,
          authorAvatarUrl: entry.authorAvatarUrl,
          isPublished: true,
          publishedAt: new Date(entry.publishedAt),
        },
      });

      await tx.updateItem.deleteMany({
        where: { entryId: entry.id },
      });

      const items = entry.sections.flatMap((section) =>
        section.items.map((text, order) => ({
          entryId: entry.id,
          category: section.category,
          text,
          order,
        }))
      );

      if (items.length > 0) {
        await tx.updateItem.createMany({
          data: items,
        });
      }
    }
  });
}
