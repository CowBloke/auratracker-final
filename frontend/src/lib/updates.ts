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
    title: 'Centre de mises a jour',
    summary: 'Nouvelle page historique avec suivi des nouveautes non lues.',
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          'Ajout d une page Mises a jour qui regroupe les changements par jour.',
          'Ajout d un compteur de nouveautes dans la barre laterale.',
        ],
      },
      {
        category: 'SMALL_FEATURE',
        items: [
          'Ouverture de la page Mises a jour = marquage automatique des entrees comme vues.',
          'Affichage des changements classes par grandes fonctionnalites, petites fonctionnalites et correctifs.',
          'Mise en page harmonisee avec les couleurs de theme et composants shadcn (suppression des degrades).',
          'Historique journalier converti en sections accordions pour consulter les jours facilement.',
          'Chaque section affiche maintenant le jour en titre avec compteurs colores (grandes, petites et correctifs).',
          'Compteurs de categories passes en format icones + quantites, avec intensite de couleur decroissante (grande, petite, bug).',
          'Les points de changement sont regroupes dans un seul bloc colore par jour, sous forme de liste unique.',
          'Palette ajustee sur les tons du tab actif de la sidebar (famille muted) avec intensite decroissante par type.',
          'Les changements sont maintenant regroupes en un bloc par type (grandes, petites, correctifs) avec mise en forme lisible.',
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
