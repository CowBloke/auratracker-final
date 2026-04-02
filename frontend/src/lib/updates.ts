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
    id: '2026-04-02-bank-loan-rate',
    date: '2026-04-02',
    title: 'Banques, prêts et mariage',
    summary: 'Les banques peuvent fixer leur taux d\'emprunt, les prêts acceptent n\'importe quelle durée en jours, et accepter un mariage affiche les conséquences avant confirmation.',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          { id: '2026-04-02-bank-loan-rate-1', text: '**Banques · Taux d\'emprunt** — Le propriétaire d\'une banque peut modifier son taux d\'intérêt (entre 1% et 50%) depuis la fiche de sa banque dans l\'explorateur. Le taux s\'affiche dans la liste et dans le détail pour tous les joueurs.' },
          { id: '2026-04-02-loan-days-input-1', text: '**Prêts · Durée libre** — La durée d\'un prêt est maintenant saisie librement en jours (minimum 1 jour) au lieu d\'être limitée à une liste fixe. Le récapitulatif affiche le taux, le remboursement journalier et le total estimé.' },
          { id: '2026-04-02-marriage-consequences-1', text: '**Mariage · Confirmation** — Avant d\'accepter une demande en mariage (depuis l\'onglet Social ou le fil d\'actualité), un panneau affiche les conséquences : compte commun partagé, partage 50/50 en cas de divorce, risque judiciaire en cas de suspicion de tricherie.' },
        ],
      },
    ],
  },
  {
    id: '2026-04-01-you-v2',
    date: '2026-04-01',
    title: 'Section Moi — compétences, entreprises et services',
    summary: 'Refonte de la section Moi : compétences dans la barre du haut, gestion multi-entreprise, onglet Services & Argent fusionné, onglet Santé supprimé.',
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          { id: '2026-04-01-social-relations-v2', text: '**Moi · Social** — Refonte de l\'onglet relations : liste à gauche (avatar, nom, statut), panneau d\'actions à droite. Nouveaux types de relation : ami(e), en relation, marié(e), liaison secrète (mistress), ex. Bouton "Oublier" pour supprimer une relation. Le divorce partage désormais l\'argent du foyer en deux. Mécanique de suspicion de tricherie : si confirmée, tout l\'argent passe au conjoint suspicieux ; si infondée, l\'accusé peut aller en justice et prendre tout l\'argent de l\'accusateur.' },
          { id: '2026-04-01-you-v2-skills',    text: '**Moi · Compétences** — La barre supérieure affiche désormais 5 compétences (Affaires, Social, Intelligence, Charisme, Finance) avec niveau, XP et déblocages visibles au survol.' },
          { id: '2026-04-01-you-v2-multibiz',  text: '**Moi · Travail** — Gestion multi-entreprise et multi-emploi : chaque entreprise possédée est affichable et contrôlable. Les banques ont un tableau de bord dédié (demandes de prêt, taux d\'intérêt).' },
          { id: '2026-04-01-you-v2-bizpicker', text: '**Moi · Créateur d\'entreprise** — La liste des types d\'entreprises est réorganisée par catégorie (1 par ligne) avec description du fonctionnement et mode de contrôle.' },
          { id: '2026-04-01-you-v2-services',  text: '**Moi · Services & Argent** — L\'onglet Services absorbe désormais toutes les finances (solde, revenus, dépenses, banque principale, emprunt, investissement).' },
        ],
      },
      {
        category: 'SMALL_FEATURE',
        items: [
          { id: '2026-04-01-you-overview-feed', text: '**Moi · Vue d\'ensemble** — Le tableau de bord est maintenant un fil d\'actualité unifié : toutes les notifications, offres d\'emploi, demandes de mariage/divorce, relations et remboursements apparaissent dans une seule liste chronologique, du plus récent au plus ancien.' },
          { id: '2026-04-01-you-v2-topbar', text: '**Moi · Interface** — Barre supérieure plus compacte, sans texte sous les icônes de compétences. Onglets Santé et Argent supprimés.' },
          { id: '2026-04-01-you-logo-admin-toggle-1', text: '**Barre laterale · Acces Moi** — Un nouveau parametre admin permet de reserver le clic sur le logo (en haut a gauche) a l ouverture de la section Moi uniquement pour les admins.' },
          { id: '2026-04-01-you-logo-hint-entrepreneur-relations-1', text: '**Barre laterale · Indice logo** — Sur le tableau de bord, un indice visuel apparait sur le logo pour signaler l acces au centre Entrepreneur & Relations.' },
        ],
      },
      {
        category: 'BUG_FIX',
        items: [
          { id: '2026-04-01-you-topbar-skills-left-clip-1', text: '**Moi · Barre du haut** — Les icones de competences sont legerement decalees vers la droite pour eviter la coupe visuelle sur le bord gauche.' },
          { id: '2026-04-01-you-topbar-skills-overflow-1', text: '**Moi · Barre du haut** — Les icones de competences restent maintenant dans leur zone sans afficher de barre de defilement parasite.' },
          { id: '2026-04-01-sidebar-logo-align-1', text: '**Barre laterale** — Le bouton logo est aligne avec les autres boutons, avec une icone legerement plus grande pour rester lisible.' },
          { id: '2026-04-01-you-admin-only-enforced-1', text: '**Moi · Acces admin** — Quand l option admin est activee, l acces a la section Moi est maintenant bien bloque pour les non-admins (clic logo et acces direct).' },
        ],
      },
    ],
  },
  {
    id: '2026-04-01-you-section',
    date: '2026-04-01',
    title: 'Section Moi et fiabilite Crossy Road',
    summary: 'Une nouvelle section "Moi" accessible depuis le logo, et un enregistrement de score Crossy Road plus fiable.',
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          {
            id: '2026-04-01-you-section-1',
            text: '**Moi** - Nouvelle section accessible en cliquant sur le logo AuraTracker : simulateur de vie avec tableau de bord, traits (bonheur, popularite, sante, intelligence, charisme, richesse), et onglets Travail, Famille, Argent, Relations, Sante.',
          },
        ],
      },
      {
        category: 'BUG_FIX',
        items: [
          {
            id: '2026-04-01-crossy-road-score-save-1',
            text: '**Crossy Road** - Les scores de fin de run se sauvegardent de facon plus fiable, y compris quand deux parties consecutives finissent avec le meme score.',
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
