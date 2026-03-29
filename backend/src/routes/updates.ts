import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

type UpdateCategory = 'BIG_FEATURE' | 'SMALL_FEATURE' | 'BUG_FIX';
const CATEGORIES: UpdateCategory[] = ['BIG_FEATURE', 'SMALL_FEATURE', 'BUG_FIX'];

const SEED_ENTRIES = [
  {
    id: '2026-03-29-updates-page',
    date: '2026-03-29',
    title: 'Centre de mises à jour',
    summary: "Nouvelle page d'historique avec suivi des nouveautés non lues.",
    items: [
      { category: 'BIG_FEATURE', text: '**Page Mises à jour** — Nouvelle page listant les changements par date, accessible depuis la barre latérale.', order: 0 },
      { category: 'BIG_FEATURE', text: "**Compteur de nouveautés** — Un badge apparaît sur le lien tant que des mises à jour n'ont pas été consultées.", order: 1 },
      { category: 'SMALL_FEATURE', text: '**Thème appliqué** — La page respecte le thème de couleur actif.', order: 0 },
      { category: 'BUG_FIX', text: "**Polymarket multi-choix** — Les événements créés avec des options personnalisées (3-4 choix) s'affichaient incorrectement en Oui/Non. Les options personnalisées sont désormais correctement transmises et affichées.", order: 0 },
      { category: 'BIG_FEATURE', text: '**Classement global dans les classements** — Le classement global combiné est maintenant accessible directement depuis la page Classements, avec un panneau explicatif sur le mode de calcul.', order: 2 },
      { category: 'SMALL_FEATURE', text: "**Badge classement global amélioré** — L'infobulle du badge sur les profils affiche désormais le tier, le rang, le top %, et une explication du score combiné.", order: 1 },
      { category: 'SMALL_FEATURE', text: "**Inventaire amélioré** — Ajout d'une barre de recherche, d'un tri via menu déroulant, et d'un basculement entre affichage liste et grille.", order: 2 },
    ],
  },
];

async function ensureSeeded() {
  for (const entry of SEED_ENTRIES) {
    const existing = await prisma.updateEntry.findUnique({ where: { id: entry.id } });
    if (!existing) {
      await prisma.updateEntry.create({
        data: {
          id: entry.id,
          date: entry.date,
          title: entry.title,
          summary: entry.summary,
          items: { create: entry.items },
        },
      });
    }
  }
}

function groupItems(items: { id: string; category: string; text: string; order: number }[]) {
  const map: Record<string, { id: string; text: string }[]> = {
    BIG_FEATURE: [],
    SMALL_FEATURE: [],
    BUG_FIX: [],
  };
  for (const item of [...items].sort((a, b) => a.order - b.order)) {
    if (map[item.category]) {
      map[item.category].push({ id: item.id, text: item.text });
    }
  }
  return CATEGORIES
    .filter((cat) => map[cat].length > 0)
    .map((cat) => ({ category: cat, items: map[cat] }));
}

const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET / — public, returns all entries with items
router.get('/', async (_req, res: Response) => {
  await ensureSeeded();
  const entries = await prisma.updateEntry.findMany({
    orderBy: { date: 'desc' },
    include: { items: true },
  });
  return res.json(entries.map((e) => ({
    id: e.id,
    date: e.date,
    title: e.title,
    summary: e.summary,
    sections: groupItems(e.items),
  })));
});

// GET /ids — cheap unread-count helper
router.get('/ids', async (_req, res: Response) => {
  await ensureSeeded();
  const entries = await prisma.updateEntry.findMany({
    orderBy: { date: 'desc' },
    select: { id: true },
  });
  return res.json({ ids: entries.map((e) => e.id) });
});

// POST / — admin, create entry
router.post('/', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { date, title, summary } = req.body as { date?: string; title?: string; summary?: string };
  if (!date || !title || !summary) {
    return res.status(400).json({ error: 'date, title et summary sont requis' });
  }
  const entry = await prisma.updateEntry.create({
    data: { date, title, summary },
    include: { items: true },
  });
  return res.status(201).json({ id: entry.id, date: entry.date, title: entry.title, summary: entry.summary, sections: [] });
});

// DELETE /:id — admin, delete entry
router.delete('/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await prisma.updateEntry.delete({ where: { id } });
  return res.json({ success: true });
});

// POST /:id/items — admin, add item to entry
router.post('/:id/items', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { category, text } = req.body as { category?: string; text?: string };
  if (!category || !text) {
    return res.status(400).json({ error: 'category et text sont requis' });
  }
  if (!CATEGORIES.includes(category as UpdateCategory)) {
    return res.status(400).json({ error: 'Catégorie invalide' });
  }
  const lastItem = await prisma.updateItem.findFirst({
    where: { entryId: id, category },
    orderBy: { order: 'desc' },
  });
  const item = await prisma.updateItem.create({
    data: { entryId: id, category, text, order: (lastItem?.order ?? -1) + 1 },
  });
  return res.status(201).json({ id: item.id, text: item.text, category: item.category });
});

// DELETE /:entryId/items/:itemId — admin, delete item
router.delete('/:entryId/items/:itemId', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { itemId } = req.params;
  await prisma.updateItem.delete({ where: { id: itemId } });
  return res.json({ success: true });
});

export default router;
