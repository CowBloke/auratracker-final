export type UpdateCategory = 'BIG_FEATURE' | 'SMALL_FEATURE' | 'BUG_FIX';

export interface UpdateSection {
  category: UpdateCategory;
  items: string[];
}

export interface UpdateEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  sections: UpdateSection[];
}

const UPDATE_SEEN_STORAGE_KEY = 'auratracker:updates-last-seen-entry-id';

// Keep entries sorted newest -> oldest so unread counts are easy to compute.
export const UPDATE_ENTRIES: UpdateEntry[] = [
  {
    id: '2026-03-29-updates-page',
    date: '2026-03-29',
    title: 'Centre de mises à jour',
    summary: 'Nouvelle page d\'historique avec suivi des nouveautés non lues.',
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          '**Page Mises à jour** — Nouvelle page listant les changements par date, accessible depuis la barre latérale.',
          '**Compteur de nouveautés** — Un badge apparaît sur le lien tant que des mises à jour n\'ont pas été consultées.',
        ],
      },
      {
        category: 'SMALL_FEATURE',
        items: [
          'Ouverture de la page = **marquage automatique** des entrées comme vues.',
          'Changements classés en trois catégories : **grandes fonctionnalités**, petites fonctionnalités et correctifs.',
          'Historique présenté sous forme d\'**accordéons journaliers** avec compteurs par catégorie.',
          'Design allégé : liste simple avec couleurs issues du **thème actif**.',
        ],
      },
      {
        category: 'BUG_FIX',
        items: [
          '**Polymarket multi-choix** — Les événements créés avec des options personnalisées (3-4 choix) s\'affichaient incorrectement en Oui/Non. Les options personnalisées sont désormais correctement transmises et affichées.',
        ],
      },
    ],
  },
];

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getLatestUpdateEntryId(): string | null {
  return UPDATE_ENTRIES[0]?.id ?? null;
}

export function getSeenUpdateEntryId(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(UPDATE_SEEN_STORAGE_KEY);
}

export function markUpdatesSeen(entryId?: string): void {
  if (!canUseStorage()) {
    return;
  }

  const targetEntryId = entryId ?? getLatestUpdateEntryId();
  if (!targetEntryId) {
    return;
  }

  window.localStorage.setItem(UPDATE_SEEN_STORAGE_KEY, targetEntryId);
}

export function getNewUpdatesCount(): number {
  const total = UPDATE_ENTRIES.length;
  if (total === 0) {
    return 0;
  }

  const seenEntryId = getSeenUpdateEntryId();
  if (!seenEntryId) {
    return total;
  }

  const seenIndex = UPDATE_ENTRIES.findIndex((entry) => entry.id === seenEntryId);
  if (seenIndex < 0) {
    return total;
  }

  return seenIndex;
}
