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
    id: '2026-04-27-global-adblock',
    date: '2026-04-27',
    title: 'Adblock global',
    summary: 'Les effets adblock ne sont plus limités à la page You et s appliquent maintenant sur tout le site.',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          { id: '2026-04-27-global-adblock-1', text: '**Adblock · Globalisé** — L effet adblock s applique désormais à toutes les pages du site, et les libellés affichés côté joueur parlent maintenant d un adblock global plutôt que d un effet lié à You.' },
        ],
      },
    ],
  },
  {
    id: '2026-04-27-login-error-no-reload',
    date: '2026-04-27',
    title: 'Connexion — erreurs conservées à l’écran',
    summary: 'Les mauvais identifiants n’entraînent plus de rechargement complet de la page de connexion, ce qui permet de voir le message d’erreur.',
    sections: [
      {
        category: 'BUG_FIX',
        items: [
          { id: '2026-04-27-login-error-no-reload-1', text: '**Connexion · Erreur visible** — Un échec de connexion reste maintenant sur la page de login avec son message d’erreur, au lieu de relancer un chargement complet du navigateur.' },
        ],
      },
    ],
  },
  {
    id: '2026-04-09-epicerie-items',
    date: '2026-04-09',
    title: 'Épiceries — articles personnalisables & inventaire',
    summary: 'Les gérants d\'épicerie peuvent maintenant personnaliser entièrement leurs articles (nom, catégorie, prix, emoji ou image). Les articles achetés apparaissent dans l\'inventaire des acheteurs.',
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          { id: '2026-04-09-epicerie-items-1', text: '**Image par article** — En plus de l\'emoji, vous pouvez désormais ajouter une **photo** personnalisée à chaque article de votre menu (épicerie, restaurant, limonade).' },
          { id: '2026-04-09-epicerie-items-2', text: '**Inventaire achats** — Les articles achetés en boutique apparaissent dans l\'onglet **Achats** de votre inventaire, avec la quantité et la boutique d\'origine.' },
        ],
      },
      {
        category: 'SMALL_FEATURE',
        items: [
          { id: '2026-04-09-lawfirm-roles', text: '**Cabinets d\'avocats — Titre & Expertise** — Le titre d\'un membre (Associé, Collaborateur, Stagiaire, Of Counsel…) est maintenant clairement affiché et modifiable depuis Gérer l\'équipe. Les Associé(e)s ont accès à la gestion du cabinet. L\'expertise (Droit pénal, etc.) est distincte et purement indicative.' },
        ],
      },
    ],
  },
  {
    id: '2026-04-08-business-ads',
    date: '2026-04-08',
    title: 'Publicites des entreprises',
    summary: 'Les entreprises peuvent maintenant creer des pubs visibles dans plusieurs zones du site, y compris avant le lancement de certains jeux.',
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          { id: '2026-04-08-business-ads-1', text: '**Publicites entreprises** — Les entreprises peuvent creer des **publicites** depuis l onglet Travail -> Gerer mes publicites.' },
          { id: '2026-04-08-business-ads-2', text: '**Placements pub** — Les pubs apparaissent dans la grille des jeux, dans l apercu You, et en **interstitiel** avant de lancer un jeu.' },
        ],
      },
    ],
  },
  {
    id: '2026-04-07-court-lawyers',
    date: '2026-04-07',
    title: 'Justice — Avocats plus lisibles',
    summary: 'Les messages de tribunal affichent maintenant le nom de la partie associée aux avocats, avec des couleurs plus proches de leur camp.',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          { id: '2026-04-07-court-lawyers-1', text: '**Justice · Avocats identifiés** — Dans les conversations de tribunal, les messages des avocats affichent désormais le nom du plaignant ou du coupable associé, au lieu d’un simple "Avocat".' },
          { id: '2026-04-07-court-lawyers-2', text: '**Justice · Couleurs de camp** — Les avocats utilisent maintenant une nuance distincte de la couleur du plaignant ou du coupable, pour mieux les différencier sans casser le code couleur du procès.' },
          { id: '2026-04-07-admin-shared-money-1', text: '**Admin · Comptes communs** — Dans la liste des utilisateurs, les admins voient désormais d’un coup d’œil le solde du compte commun des personnes mariées, avec un panneau de détail pour vérifier l’argent personnel et le total du foyer.' },
          { id: '2026-04-07-frontend-i18n-1', text: '**Frontend · Localisation i18n** — Mise en place d’un utilitaire de traduction centralisé pour regrouper les textes UI en français et stabiliser l’encodage des caractères accentués.' },
        ],
      },
    ],
  },
  {
    id: '2026-04-06-carte-ville',
    date: '2026-04-06',
    title: 'Carte de la ville',
    summary: "Un onglet Carte permet de voir tous les businesses de la ville sur une carte interactive organisée par quartier.",
    sections: [
      {
        category: 'BIG_FEATURE',
        items: [
          { id: '2026-04-06-carte-1', text: "**Carte · Nouvel onglet** — Visualise tous les businesses de tous les joueurs sur une carte de la ville, organisée par quartier thématique." },
          { id: '2026-04-06-carte-2', text: "**Carte · 5 quartiers** — Quartier commercial (food/retail), District financier (banque/transfert), Silicon Quarter (startup/agence), Zone des services (formation), Palais de Justice (avocats/cour)." },
          { id: '2026-04-06-carte-3', text: "**Carte · Ton empire** — Tes propres businesses sont mis en valeur avec un anneau lumineux doré. Clique sur n'importe quel marqueur pour voir les infos du business." },
        ],
      },
    ],
  },
  {
    id: '2026-04-05-explore-ux',
    date: '2026-04-05',
    title: 'Explorateur & Formations — UX améliorée',
    summary: 'Plusieurs améliorations visuelles dans l\'explorateur de businesses, le catalogue de formations et le panel de gestion des équipes (cabinets d\'avocats).',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          { id: '2026-04-05-explore-ux-1', text: '**Explorateur · Note** — Le bouton "Donner un avis" disparaît du bas de la fiche. À la place, un **+** s\'affiche directement à côté de la pastille de note. Si tu n\'as pas encore interagi avec le business, survole le + pour voir quand la note se débloque.' },
          { id: '2026-04-05-explore-ux-2', text: '**Explorateur · Formations** — Le bouton "Catalogue" a été remplacé par un bloc action cohérent avec les autres actions disponibles sur la fiche.' },
          { id: '2026-04-05-explore-ux-3', text: '**Catalogue formations · Avis** — Les avis produit s\'affichent désormais comme une pastille étoile compacte (identique à la fiche principale), avec un + pour noter directement.' },
          { id: '2026-04-05-explore-ux-4', text: '**Gérer l\'équipe · Cabinets d\'avocats** — La section "Profil avocat" est maintenant clairement délimitée avec une icône, des champs étiquetés et la case "Avocat principal" plus lisible. Les rôles s\'affichent en français.' },
        ],
      },
    ],
  },
  {
    id: '2026-04-05-clans-war-sidebar',
    date: '2026-04-05',
    title: 'Clans — Statut de guerre redessiné',
    summary: 'Le panneau latéral des clans affiche maintenant clairement le statut de guerre de ton clan et le nombre de guerres actives en cours sur le serveur.',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          { id: '2026-04-05-clans-war-sidebar-1', text: '**Clans · Mon clan** — Le panneau gauche indique maintenant si tu es sans clan, pas en guerre, ou en guerre active. Si tu es en guerre, tu vois ton adversaire et le score, et tu peux cliquer pour lancer tes parties restantes.' },
          { id: '2026-04-05-clans-war-sidebar-2', text: '**Clans · Autres guerres** — Un second élément indique le nombre de guerres actives sur le serveur (hors la tienne). Clique dessus pour voir la liste complète et accéder directement à un clan en guerre.' },
        ],
      },
    ],
  },
  {
    id: '2026-04-04-sidebar-cleanup',
    date: '2026-04-04',
    title: 'Barre latérale allégée',
    summary: 'La barre latérale ne contient plus que les liens de navigation essentiels. Recherche, messagerie, changelog et signalement de bug ont été déplacés vers la barre du haut.',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          { id: '2026-04-04-sidebar-cleanup-1', text: '**Navigation · Barre latérale** — La barre de navigation est maintenant plus compacte : recherche, messagerie, changelog et "Reporter un bug" ne s\'y trouvent plus.' },
          { id: '2026-04-04-sidebar-cleanup-2', text: '**Barre du haut · Raccourcis** — Recherche (loupe), messagerie (avec badge de messages non lus) et changelog (avec badge de mises à jour) sont désormais accessibles directement depuis la barre supérieure.' },
          { id: '2026-04-04-sidebar-cleanup-3', text: '**Menu compte · Outils** — "Reporter un bug" et le lien d\'administration (admins) sont maintenant dans le menu de compte (icône avatar en haut à droite).' },
        ],
      },
    ],
  },
  {
    id: '2026-04-03-you-ux',
    date: '2026-04-03',
    title: 'Explorer — Notes, filtres et tutoriel',
    summary: 'La liste des entreprises est maintenant scrollable indépendamment du panneau de détail. Les filtres latéraux ont été compactés. Un système de notation 5 étoiles permet d\'évaluer les services utilisés, et les entreprises sont triées par note. Un tutoriel de démarrage s\'affiche dans le tableau de bord pour les nouveaux joueurs.',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          { id: '2026-04-03-business-ratings-1', text: '**Notes · Évaluation des services** — Après avoir utilisé un service (investissement, transfert, formation, achat...) une modale apparaît pour noter l\'expérience de 1 à 5 étoiles. La note moyenne s\'affiche sur chaque business dans l\'explorateur.' },
          { id: '2026-04-03-business-ratings-2', text: '**Explorateur · Tri par note** — Les entreprises sont désormais triées par note décroissante (puis par revenu en cas d\'égalité) dans chaque catégorie.' },
          { id: '2026-04-03-explore-scroll-1', text: '**Explorateur · Liste scrollable** — La liste centrale des entreprises défile indépendamment du panneau de détail à droite, ce qui permet d\'interagir avec un business tout en parcourant la liste.' },
          { id: '2026-04-03-explore-filters-1', text: '**Explorateur · Filtres compacts** — Le panneau de filtres a été redessiné en liste compacte, plus lisible et moins encombrant.' },
          { id: '2026-04-03-you-tutorial-1', text: '**Tableau de bord · Tutoriel** — Quand le fil d\'actualité est vide, un guide interactif en 3 étapes explique comment créer une entreprise, explorer les businesses et nouer des relations. Il est ignorable en un clic.' },
        ],
      },
    ],
  },
  {
    id: '2026-04-02-bank-loan-rate',
    date: '2026-04-02',
    title: 'Banques, prêts et mariage',
    summary: 'Les banques peuvent fixer leur taux d\'emprunt, les prêts acceptent n\'importe quelle durée en jours, et accepter un mariage affiche les conséquences avant confirmation.',
    sections: [
      {
        category: 'SMALL_FEATURE',
        items: [
          { id: '2026-04-02-profile-marriage-business-1', text: '**Profil** — Le profil affiche désormais le statut matrimonial (avec lien vers le profil du conjoint) et les entreprises possédées dans la barre latérale.' },
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
