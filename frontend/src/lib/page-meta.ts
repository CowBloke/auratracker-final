export interface PageMeta {
  title: string;
  description?: string;
  contentHeader?: boolean;
}

const STATIC_PAGE_META: Record<string, PageMeta> = {
  '/': { title: 'Dashboard', description: "Vue d'ensemble de ton activité et des parties en direct." },
  '/games': { title: 'Jeux', description: 'Catalogue des jeux solo, multi et quotidiens.' },
  '/games/doodle-jump': { title: 'Doodle Jump', description: 'Mode score et classement en direct.' },
  '/games/2048': { title: '2048', description: 'Fusionne les tuiles et améliore ton record.' },
  '/games/flappy-bird': { title: 'Flappy Bird', description: 'Session arcade rapide avec classement.' },
  '/games/casino': { title: 'Casino', description: 'Roulette, slots et blackjack.' },
  '/games/market': { title: 'Shop', description: 'Boutique des objets, cosmetiques et bonus.' },
  '/games/aura-coin': { title: 'Aura Coin', description: 'Trading et positions à effet de levier.' },
  '/games/bomb-party': { title: 'Bomb Party', description: 'Partie multijoueur basée sur les mots.' },
  '/games/poker': { title: 'Poker', description: "Table de poker avec paramètres de party." },
  '/games/petit-bac': { title: 'Petit Bac', description: 'Manches chronométrées par catégories.' },
  '/games/bataille-navale': { title: 'Bataille Navale', description: 'Duel tactique en party.' },
  '/games/solitaire': { title: 'Solitaire', description: 'Mode score avec classement.' },
  '/games/racer': { title: 'Racer', description: 'Course arcade style outrun.' },
  '/games/tetris': { title: 'Tetris', description: 'Session puzzle et classement.' },
  '/games/goyave-empire': { title: 'Goyave Empire', description: 'Idle farming : récolte des goyaves et bâtis ton empire.' },
  '/games/polymarket': { title: 'Polymarket', description: 'Marché de prédictions communautaire.' },
  '/leaderboards': { title: 'Classements', description: 'Classements économie et jeux.' },
  '/leaderboards/nombres': { title: 'Nombres', description: 'Indicateurs globaux et statistiques clés.' },
  '/party': { title: 'Party', description: 'Crée, gère et rejoins des parties.' },
  '/clans': { title: 'Clans', description: 'Communauté, membres et progression de clan.' },
  '/inventory': { title: 'Inventaire', description: 'Objets, consommables et cosmétiques.' },
  '/admin': { title: 'Admin', description: 'Outils de modération et d’administration.' },
  '/rules': { title: 'Règlement', description: 'Règles de la communauté et modération.' },
  '/pass': { title: 'Pass', description: 'Récompenses journalières et progression de série.' },
  '/quests': { title: 'Quêtes', description: 'Objectifs actifs et récompenses.' },
  '/suggestions': { title: 'Suggestions', description: "Idées en cours, votes et suivi d'avancement." },
  '/settings': { title: 'Paramètres', description: 'Thème et personnalisation de l’interface.' },
  '/inbox': { title: 'Boîte de réception', description: 'Notifications et messages reçus.' },
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
        .join(' / ') || 'Dashboard',
    };
}
