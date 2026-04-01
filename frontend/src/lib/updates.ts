// Kept only for localStorage-based unread tracking.
// Display data is now served from the API (/updates).

const UPDATE_SEEN_STORAGE_KEY = 'auratracker:updates-last-seen-entry-id';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getSeenUpdateEntryId(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(UPDATE_SEEN_STORAGE_KEY);
}

export function markUpdatesSeen(entryId?: string): void {
  if (!canUseStorage()) return;
  if (entryId) {
    window.localStorage.setItem(UPDATE_SEEN_STORAGE_KEY, entryId);
  }
}

/** Returns how many entries in the given sorted (newest-first) ID list are newer than the last seen. */
export function computeNewUpdatesCount(entryIds: string[]): number {
  if (entryIds.length === 0) return 0;
  const seenId = getSeenUpdateEntryId();
  if (!seenId) return entryIds.length;
  const seenIndex = entryIds.indexOf(seenId);
  if (seenIndex < 0) return entryIds.length;
  return seenIndex;
}

export type UpdateCategory = 'BIG_FEATURE' | 'SMALL_FEATURE' | 'BUG_FIX';

export type UpdateEntrySection = {
  category: UpdateCategory;
  items: { id: string; text: string }[];
};

export type UpdateEntry = {
  id: string;
  date: string;
  title: string;
  summary: string;
  sections: UpdateEntrySection[];
};

export const UPDATE_ENTRIES: UpdateEntry[] = [
  {
    id: '2026-04-01-polymarket-sort',
    date: '2026-04-01',
    title: 'Polymarket : tri, historique et corrections',
    summary: 'Tri des événements, nouveau dashboard "Mes paris" avec stats et gains/pertes, et correction des options dans les suggestions.',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          {
            id: '2026-04-01-polymarket-sort-1',
            text: '**Polymarket** – Tri des événements ouverts : Plus récents, Fin proche, Plus populaires, Meilleures cotes.',
          },
          {
            id: '2026-04-01-polymarket-my-bets-1',
            text: '**Polymarket – Mes paris** – Nouveau dashboard avec stats (paris total, W/L, total misé, résultat net) et cartes détaillées par pari avec gain/perte net visible.',
          },
        ],
      },
      {
        category: 'BUG_FIX',
        items: [
          {
            id: '2026-04-01-polymarket-options-fix-1',
            text: '**Polymarket** – Les options personnalisées suggérées par les utilisateurs sont maintenant correctement pré-remplies dans la fenêtre d\'approbation admin.',
          },
        ],
      },
    ],
  },
  {
    id: '2026-03-30-hexgl-image',
    date: '2026-03-30',
    title: 'Nouveautes du hub jeux',
    summary: 'Crossy Road est maintenant jouable et la vignette HexGL a ete amelioree.',
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          {
            id: '2026-03-30-crossy-road-1',
            text: '**Crossy Road** - Le jeu est maintenant jouable avec trafic, trains, rivieres, collisions, score, et controles clavier/mobile dans la meme interface que les autres jeux.',
          },
        ],
      },
      {
        category: 'BUG_FIX',
        items: [
          {
            id: '2026-03-30-crossy-road-green-screen-1',
            text: '**Crossy Road** - Le jeu ne reste plus bloque sur un ecran vert et se lance correctement.',
          },
          {
            id: '2026-03-30-polymarket-admin-odds-edit-1',
            text: '**Polymarket** - Les admins peuvent a nouveau modifier correctement les cotes d\'un evenement depuis l\'edition.',
          },
        ],
      },
      {
        category: 'SMALL_FEATURE',
        items: [
          {
            id: '2026-03-30-hexgl-image-1',
            text: '**HexGL** - La carte du jeu affiche desormais la nouvelle image dans le catalogue et la barre laterale.',
          },
        ],
      },
    ],
  },
];
