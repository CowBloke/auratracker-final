export interface PageMeta {
  title: string;
  description?: string;
  contentHeader?: boolean;
}

const STATIC_PAGE_META: Record<string, PageMeta> = {
  '/you': { title: 'Moi', description: 'Simulateur de vie — traits, travail, famille, argent et relations.' },
  '/': { title: 'Tableau de bord', description: "Vue d'ensemble de ton activité et des parties en direct." },
  '/dashboard': { title: 'Tableau de bord', description: "Vue d'ensemble de ton activité et des parties en direct." },
  '/games': { title: 'Jeux', description: 'Catalogue des jeux solo, multi et quotidiens.' },
  '/games/doodle-jump': { title: 'Doodle Jump', description: 'Mode score et classement en direct.' },
  '/games/logic-lab': { title: 'Sudoku', description: 'Sudoku 9x9 avec grilles générées et plusieurs niveaux.' },
  '/games/2048': { title: '2048', description: 'Fusionne les tuiles et améliore ton record.' },
  '/games/flappy-bird': { title: 'Flappy Bird', description: 'Session arcade rapide avec classement.' },
  '/games/chrome-dino': { title: 'Chrome Dino', description: 'Runner endless inspiré du jeu hors-ligne de Chrome.' },
  '/games/fruit-ninja': { title: 'Fruit Ninja', description: 'Tranche les fruits avec ta souris, évite les bombes.' },
  '/games/casino': { title: 'Casino', description: 'Roulette, slots et blackjack.' },
  '/market': { title: 'Boutique', description: 'Boutique des objets, cosmétiques et bonus.' },
  '/games/aura-coin': { title: 'Aura Coin', description: 'Trading et positions à effet de levier.' },
  '/games/russian-roulette': { title: 'Roulette russe', description: 'Roulette russe multijoueur autour d\'une table sombre.' },
  '/games/uno': { title: 'UNO', description: 'Classique jeu de cartes en 2-4 joueurs.' },
  '/games/bomb-party': { title: 'Bombe de mots', description: 'Partie multijoueur basée sur les mots.' },
  '/games/poker': { title: 'Poker', description: "Table de poker avec paramètres de groupe." },
  '/games/petit-bac': { title: 'Petit Bac', description: 'Manches chronométrées par catégories.' },
  '/games/bataille-navale': { title: 'Bataille navale', description: 'Duel tactique en groupe.' },
  '/games/solitaire': { title: 'Solitaire', description: 'Mode score avec classement.' },
  '/games/racer': { title: 'Racer', description: 'Course arcade style outrun.' },
  '/games/tetris': { title: 'Tetris', description: 'Session puzzle et classement.' },
  '/games/knife-hit': { title: 'Knife Hit', description: 'Timing arcade et classement.' },
  '/games/polytrack': { title: 'PolyTrack', description: 'Course low-poly time trial sur 14 circuits — soumets tes temps et grimpe au classement.' },
  '/games/opengd': { title: 'OpenGD', description: 'Implémentation open source de Geometry Dash intégrée au hub jeux AuraTracker.' },
  '/games/echecs': { title: 'Échecs', description: 'Duel complet avec règles officielles.' },
  '/games/ball-arena': { title: 'Arène des balles', description: "Duel physique : propulse ton adversaire hors de l'arène." },
  '/games/goyave-empire': { title: 'Goyave Empire', description: 'Idle farming : récolte des goyaves et bâtis ton empire.' },
  '/polymarket': { title: 'Polymarket', description: 'Marché de prédictions communautaire.' },
  '/leaderboards': { title: 'Classements', description: 'Classements économie et jeux.' },
  '/leaderboards/nombres': { title: 'Nombres', description: 'Indicateurs globaux et statistiques clés.' },
  '/party': { title: 'Groupe', description: 'Crée, gère et rejoins des groupes.' },
  '/clans': { title: 'Guildes', description: 'Communauté, membres et progression de guilde.' },
  '/inventory': { title: 'Inventaire', description: 'Objets, cosmétiques et améliorations.' },
  '/admin': { title: 'Admin', description: 'Outils de modération et d’administration.' },
  '/rules': { title: 'Règlement', description: 'Règles de la communauté et modération.' },
  '/pass': { title: 'Pass', description: 'Lootbox quotidienne, streak et récompenses aléatoires.' },
  '/quests': { title: 'Quêtes', description: 'Objectifs actifs et récompenses.' },
  '/suggestions': { title: 'Suggestions', description: "Idées en cours, votes et suivi d'avancement." },
  '/settings': { title: 'Paramètres', description: 'Thème et personnalisation de l’interface.' },
  '/inbox': { title: 'Boîte de réception', description: 'Notifications et messages reçus.' },
  '/support': { title: 'Support', description: 'Contacte l\'équipe pour toute question ou problème.' },
};

function humanizeSegment(segment: string) {
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveDynamicMeta(pathname: string): PageMeta | null {
  if (pathname.startsWith('/profile/')) {
    return { title: 'Profil', description: 'Statistiques, badges et activité joueur.' };
  }

  if (pathname === '/profile') {
    return { title: 'Profil', description: 'Statistiques, badges et activité joueur.' };
  }

  return null;
}

export function getPageMetaForPath(pathname: string): PageMeta {
  return resolveDynamicMeta(pathname) ??
    STATIC_PAGE_META[pathname] ?? {
      title: pathname
        .split('/')
        .filter(Boolean)
        .map(humanizeSegment)
        .join(' / ') || 'Tableau de bord',
    };
}
