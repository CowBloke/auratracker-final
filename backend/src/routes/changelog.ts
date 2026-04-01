import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

type UpdateCategory = 'BIG_FEATURE' | 'SMALL_FEATURE' | 'BUG_FIX';
const CATEGORIES: UpdateCategory[] = ['BIG_FEATURE', 'SMALL_FEATURE', 'BUG_FIX'];
const LEGACY_IMAGE_UPLOAD_ENTRY_ID = '2026-04-01-image-upload-reliability';
const CANONICAL_APRIL_FIRST_ENTRY_ID = '2026-04-01-ui-toasts-fixes';

type EntryWithItems = {
  id: string;
  date: string;
  title: string;
  summary: string;
  createdAt: Date;
  items: { id: string; category: string; text: string; order: number }[];
};

const SEED_ENTRIES = [
  {
    id: '2026-04-01-party-dropdown-members',
    date: '2026-04-01',
    title: 'Groupes plus lisibles',
    summary: "Les cartes de groupe deviennent des menus deroulants pour afficher les utilisateurs seulement quand on en a besoin.",
    items: [
      { category: 'SMALL_FEATURE', text: "**Page groupe** — La liste des membres du groupe actuel est maintenant repliee dans un menu deroulant 'Utilisateurs du groupe' pour alleger la page.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Groupes ouverts** — Chaque groupe public peut maintenant etre ouvert pour voir les utilisateurs qu'il contient sans afficher toutes les listes en permanence.", order: 1 },
      { category: 'SMALL_FEATURE', text: "**Widget groupe** — Le widget du header utilise lui aussi une section deroulante pour afficher les utilisateurs du groupe actif.", order: 2 },
    ],
  },
  {
    id: '2026-04-01-clans-wording',
    date: '2026-04-01',
    title: 'Terminologie des clans',
    summary: "Le site affiche maintenant 'clan' a la place de 'guilde' dans l'interface.",
    items: [
      { category: 'SMALL_FEATURE', text: "**Terminologie unifiee** — Les libelles de navigation, statistiques, metadonnees de page et messages visibles utilisent maintenant 'clan' et 'clans' au lieu de 'guilde' et 'guildes'.", order: 0 },
    ],
  },
  {
    id: '2026-04-01-clan-banner-item',
    date: '2026-04-01',
    title: 'Bannière de clan',
    summary: "Un nouvel objet de clan permet d'acheter, téléverser et afficher une bannière de clan.",
    items: [
      { category: 'BIG_FEATURE', text: "**Objet banniere de clan** — Un objet `CLAN_BANNER` peut maintenant etre cree depuis l'admin, achete avec la banque du clan, puis active par le chef pour televerser l'image de banniere.", order: 0 },
      { category: 'SMALL_FEATURE', text: "**Activation guidee** — Depuis la page clan, l'objet affiche un bouton dedie au choix de l'image et ouvre directement une fenetre d'upload avec apercu.", order: 1 },
      { category: 'SMALL_FEATURE', text: "**Affichage du clan** — La banniere televersee s'affiche en haut de la page clan quand ce clan est selectionne.", order: 2 },
    ],
  },
  {
    id: CANONICAL_APRIL_FIRST_ENTRY_ID,
    date: '2026-04-01',
    title: 'Corrections UI & Notifications',
    summary: "Toasts unifiés, badge changelog rouge, doublons de notifications corrigés, uploads d'images plus fiables, top bar persistante, page Pass refondue, Fruit Ninja rééquilibré, Snake ajouté au hub, HexGL intégré au catalogue jeux et nouveaux filtres du hub jeux.",
    items: [
      { category: 'BUG_FIX', text: '**Badge changelog** — La pastille de notifications non lues dans la sidebar passe au rouge, cohérent avec les autres badges.', order: 0 },
      { category: 'BUG_FIX', text: '**Toasts en double** — Les achats en boutique, claims de quêtes, ouverture du pass et investissements business ne déclenchaient plus deux toasts simultanément.', order: 1 },
      { category: 'BUG_FIX', text: "**Formats d'image mieux geres** — Les uploads acceptent maintenant aussi l'AVIF et reconnaissent mieux certains MIME types courants comme `image/jpg`.", order: 2 },
      { category: 'BUG_FIX', text: "**Uploads d'images plus robustes** — La validation et l'ecriture des images sont centralisees cote serveur pour eviter les comportements differents selon la page ou le type d'upload.", order: 3 },
      { category: 'BUG_FIX', text: "**Conversion automatique d'images** — Sur les navigateurs compatibles, certains formats comme HEIC/HEIF ou SVG sont convertis automatiquement vers un format supporte avant envoi.", order: 4 },
      { category: 'BUG_FIX', text: "**Une carte par jour** — Le backend fusionne les entrees de changelog ayant la meme date et evite maintenant la creation de doublons sur une meme journee.", order: 5 },
      { category: 'BUG_FIX', text: "**Fruit Ninja reequilibre** — La difficulte monte moins brutalement: les fruits arrivent moins vite, les doubles vagues commencent plus tard et les triples vagues ne peuvent plus saturer l'ecran trop tot.", order: 6 },
      { category: 'BUG_FIX', text: "**Top bar persistante** — Le layout garde maintenant toujours la barre du haut visible pendant le scroll en contraignant correctement la zone de contenu et en maintenant le header au-dessus des pages.", order: 7 },
      { category: 'BUG_FIX', text: "**Inventaire trie comme la boutique** — La page inventaire reprend maintenant le meme ordre de types que la boutique et regroupe correctement les objets par categorie dans l'onglet `Tous`.", order: 8 },
      { category: 'BUG_FIX', text: "**Inbox de bienvenue** — Un message de bienvenue est maintenant envoye automatiquement dans l'inbox lors de la premiere connexion reussie d'un compte, sans doublon aux connexions suivantes.", order: 9 },
      { category: 'BUG_FIX', text: "**Cards de jeux cliquables** — Le calque de navigation passe maintenant au-dessus du contenu des cartes pour que tout le bloc ouvre bien le jeu au clic.", order: 10 },
      { category: 'SMALL_FEATURE', text: '**Fermer un toast** — Un bouton ✕ permet maintenant de fermer manuellement chaque toast.', order: 0 },
      { category: 'SMALL_FEATURE', text: '**Toasts unifiés** — Tous les toasts du site (y compris la page Admin) passent par le même système visuel.', order: 1 },
      { category: 'SMALL_FEATURE', text: "**Selection d'images plus claire** — Les zones d'upload affichent des formats explicitement supportes pour mieux guider les utilisateurs avant l'envoi.", order: 2 },
      { category: 'SMALL_FEATURE', text: '**Page Pass refondue** — L’interface de la page Pass a ete entierement retravaillee pour retrouver la meme direction visuelle que le reste du site, avec un hero plus propre, des cartes plus coherentes et une meilleure mise en avant des recompenses.', order: 3 },
      { category: 'SMALL_FEATURE', text: "**Filtres du hub jeux** — La page Jeux propose maintenant des filtres pour les recompenses et les jeux beta, avec des controles admin pour gerer le catalogue.", order: 4 },
      { category: 'SMALL_FEATURE', text: "**Classements HexGL** — La page Classements affiche maintenant la categorie HexGL avec ses statistiques associees.", order: 5 },
      { category: 'SMALL_FEATURE', text: "**Profil mis a jour** — HexGL apparait aussi dans le catalogue de jeux du profil.", order: 6 },
      { category: 'SMALL_FEATURE', text: "**Stats de clan** — Les statistiques de participants aux guerres de clans sont maintenant exposees pour alimenter les vues concernees.", order: 7 },
      { category: 'BIG_FEATURE', text: '**Snake dans le hub jeux** — Un nouveau Snake natif a ete ajoute avec interface coherente, plein ecran, pause, difficultes, classement, recompenses et integration complete dans le catalogue, la sidebar et les profils.', order: 4 },
      { category: 'BIG_FEATURE', text: '**HexGL dans le hub jeux** — HexGL est maintenant integre au catalogue jeux avec statistiques, soumission des scores et classement dedie.', order: 5 },
    ],
  },
  {
    id: '2026-03-30-chess-promotion',
    date: '2026-03-30',
    title: 'Échecs',
    summary: 'Promotion des pions corrigée.',
    items: [
      { category: 'BUG_FIX', text: '**Promotion aux échecs** — La promotion par glisser-déposer fonctionne désormais correctement, et le choix de la pièce (dame, tour, fou, cavalier) est bien pris en compte.', order: 0 },
    ],
  },
  {
    id: '2026-03-29-updates-page',
    date: '2026-03-29',
    title: 'Centre de mises à jour',
    summary: "Nouvelle page d'historique avec suivi des nouveautés non lues.",
    items: [
      { category: 'BIG_FEATURE', text: '**Page Mises à jour** — Nouvelle page listant les changements par date, accessible depuis la barre latérale.', order: 0 },
      { category: 'BIG_FEATURE', text: "**Compteur de nouveautés** — Un badge apparaît sur le lien tant que des mises à jour n'ont pas été consultées.", order: 1 },
      { category: 'BIG_FEATURE', text: "**OpenGD dans le hub jeux** — Une nouvelle page OpenGD est disponible dans le catalogue et la barre latérale, avec le même mode plein écran/pause/rechargement que les autres jeux web.", order: 3 },
      { category: 'SMALL_FEATURE', text: '**Thème appliqué** — La page respecte le thème de couleur actif.', order: 0 },
      { category: 'BUG_FIX', text: "**Polymarket multi-choix** — Les événements créés avec des options personnalisées (3-4 choix) s'affichaient incorrectement en Oui/Non. Les options personnalisées sont désormais correctement transmises et affichées.", order: 0 },
      { category: 'BIG_FEATURE', text: '**Classement global dans les classements** — Le classement global combiné est maintenant accessible directement depuis la page Classements, avec un panneau explicatif sur le mode de calcul.', order: 2 },
      { category: 'SMALL_FEATURE', text: "**Badge classement global amélioré** — L'infobulle du badge sur les profils affiche désormais le tier, le rang, le top %, et une explication du score combiné.", order: 1 },
      { category: 'SMALL_FEATURE', text: "**Inventaire amélioré** — Ajout d'une barre de recherche, d'un tri via menu déroulant, et d'un basculement entre affichage liste et grille.", order: 2 },
    ],
  },
];

async function mergeDuplicateEntriesByDate() {
  const entries = await prisma.updateEntry.findMany({
    include: { items: true },
    orderBy: [{ createdAt: 'asc' }],
  });

  const entriesByDate = new Map<string, EntryWithItems[]>();
  for (const entry of entries) {
    const group = entriesByDate.get(entry.date);
    if (group) {
      group.push(entry);
    } else {
      entriesByDate.set(entry.date, [entry]);
    }
  }

  for (const sameDateEntries of entriesByDate.values()) {
    if (sameDateEntries.length <= 1) {
      continue;
    }

    const [entryToKeep, ...entriesToDelete] = sameDateEntries;
    const existingKeys = new Set(entryToKeep.items.map((item) => `${item.category}:${item.text}`));
    const maxOrderByCategory = new Map<string, number>();

    for (const item of entryToKeep.items) {
      const current = maxOrderByCategory.get(item.category) ?? -1;
      maxOrderByCategory.set(item.category, Math.max(current, item.order));
    }

    const itemsToCreate: { entryId: string; category: string; text: string; order: number }[] = [];

    for (const duplicateEntry of entriesToDelete) {
      for (const item of duplicateEntry.items) {
        const key = `${item.category}:${item.text}`;
        if (existingKeys.has(key)) {
          continue;
        }

        const nextOrder = (maxOrderByCategory.get(item.category) ?? -1) + 1;
        maxOrderByCategory.set(item.category, nextOrder);
        existingKeys.add(key);

        itemsToCreate.push({
          entryId: entryToKeep.id,
          category: item.category,
          text: item.text,
          order: nextOrder,
        });
      }
    }

    if (itemsToCreate.length > 0) {
      await prisma.updateItem.createMany({ data: itemsToCreate });
    }

    await prisma.updateEntry.deleteMany({
      where: { id: { in: entriesToDelete.map((entry) => entry.id) } },
    });
  }
}

async function ensureSeeded() {
  const canonicalEntry = SEED_ENTRIES.find((entry) => entry.id === CANONICAL_APRIL_FIRST_ENTRY_ID);
  if (canonicalEntry) {
    const legacyEntry = await prisma.updateEntry.findUnique({
      where: { id: LEGACY_IMAGE_UPLOAD_ENTRY_ID },
      include: { items: true },
    });

    if (legacyEntry) {
      const canonicalExists = await prisma.updateEntry.findUnique({
        where: { id: CANONICAL_APRIL_FIRST_ENTRY_ID },
        include: { items: true },
      });

      if (!canonicalExists) {
        await prisma.updateEntry.create({
          data: {
            id: canonicalEntry.id,
            date: canonicalEntry.date,
            title: canonicalEntry.title,
            summary: canonicalEntry.summary,
            items: { create: canonicalEntry.items },
          },
        });
      }

      await prisma.updateItem.deleteMany({
        where: { entryId: LEGACY_IMAGE_UPLOAD_ENTRY_ID },
      });
      await prisma.updateEntry.delete({
        where: { id: LEGACY_IMAGE_UPLOAD_ENTRY_ID },
      });
    }
  }

  const existingEntries = await prisma.updateEntry.findMany({
    include: { items: true },
    orderBy: [{ createdAt: 'asc' }],
  });
  const existingEntriesById = new Map(existingEntries.map((entry) => [entry.id, entry]));
  const existingEntriesByDate = new Map<string, EntryWithItems>();
  for (const entry of existingEntries) {
    if (!existingEntriesByDate.has(entry.date)) {
      existingEntriesByDate.set(entry.date, entry);
    }
  }

  const itemKeysByEntryId = new Map<string, Set<string>>();
  for (const entry of existingEntries) {
    itemKeysByEntryId.set(
      entry.id,
      new Set(entry.items.map((item) => `${item.category}:${item.text}`))
    );
  }

  for (const entry of SEED_ENTRIES) {
    const existingEntry = existingEntriesById.get(entry.id);

    if (!existingEntry) {
      const existingForDate = existingEntriesByDate.get(entry.date);

      if (!existingForDate) {
        const createdEntry = await prisma.updateEntry.create({
          data: {
            id: entry.id,
            date: entry.date,
            title: entry.title,
            summary: entry.summary,
            items: { create: entry.items },
          },
          include: { items: true },
        });

        existingEntriesById.set(entry.id, createdEntry);
        existingEntriesByDate.set(entry.date, createdEntry);
        itemKeysByEntryId.set(
          entry.id,
          new Set(entry.items.map((item) => `${item.category}:${item.text}`))
        );
      } else {
        const existingItemKeys = itemKeysByEntryId.get(existingForDate.id) ?? new Set<string>();
        const missingItems = entry.items.filter((item) => !existingItemKeys.has(`${item.category}:${item.text}`));

        if (missingItems.length > 0) {
          await prisma.updateItem.createMany({
            data: missingItems.map((item) => ({
              entryId: existingForDate.id,
              category: item.category,
              text: item.text,
              order: item.order,
            })),
          });

          for (const item of missingItems) {
            existingItemKeys.add(`${item.category}:${item.text}`);
          }
          itemKeysByEntryId.set(existingForDate.id, existingItemKeys);
        }
      }

      continue;
    }

    const existingItemKeys = itemKeysByEntryId.get(existingEntry.id) ?? new Set<string>();
    const missingItems = entry.items.filter((item) => !existingItemKeys.has(`${item.category}:${item.text}`));

    if (existingEntry.date !== entry.date || existingEntry.title !== entry.title || existingEntry.summary !== entry.summary) {
      await prisma.updateEntry.update({
        where: { id: entry.id },
        data: {
          date: entry.date,
          title: entry.title,
          summary: entry.summary,
        },
      });
    }

    if (missingItems.length > 0) {
      await prisma.updateItem.createMany({
        data: missingItems.map((item) => ({
          entryId: entry.id,
          category: item.category,
          text: item.text,
          order: item.order,
        })),
      });

      for (const item of missingItems) {
        existingItemKeys.add(`${item.category}:${item.text}`);
      }
      itemKeysByEntryId.set(existingEntry.id, existingItemKeys);
    }
  }

  await mergeDuplicateEntriesByDate();
}

async function notifyNewChangelogEntry(entry: { id: string; title: string; summary: string }) {
  const approvedUsers = await prisma.user.findMany({
    where: { isApproved: true },
    select: { id: true },
  });

  await Promise.all(
    approvedUsers.map((user) =>
      createNotification({
        userId: user.id,
        type: 'SYSTEM',
        title: `Nouvelle mise a jour: ${entry.title}`,
        body: entry.summary,
        link: '/changelog',
        icon: 'megaphone',
      })
    )
  );
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
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
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
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
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

  const existingEntryForDate = await prisma.updateEntry.findFirst({
    where: { date },
    orderBy: [{ createdAt: 'asc' }],
    include: { items: true },
  });

  if (existingEntryForDate) {
    return res.status(200).json({
      id: existingEntryForDate.id,
      date: existingEntryForDate.date,
      title: existingEntryForDate.title,
      summary: existingEntryForDate.summary,
      sections: groupItems(existingEntryForDate.items),
    });
  }

  const entry = await prisma.updateEntry.create({
    data: { date, title, summary },
    include: { items: true },
  });

  void notifyNewChangelogEntry({
    id: entry.id,
    title: entry.title,
    summary: entry.summary,
  }).catch((error) => {
    console.error('Failed to send changelog notifications:', error);
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


export default router;
