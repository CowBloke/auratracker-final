export interface PageMeta {
  title: string;
  description?: string;
  contentHeader?: boolean;
}

export interface SearchablePageEntry extends PageMeta {
  path: string;
}

const STATIC_PAGE_META: Record<string, PageMeta> = {
  '/you': { title: 'Moi', description: 'Simulateur de vie — traits, travail, famille, argent et relations.' },
  '/': { title: 'Tableau de bord', description: "Vue d'ensemble de ton activité et des parties en direct." },
  '/dashboard': { title: 'Tableau de bord', description: 'Les dernières nouveautés de la plateforme.' },
  '/games': { title: 'Jeux', description: 'Catalogue des jeux solo, multi et quotidiens.' },
  '/games/doodle-jump': { title: 'Doodle Jump', description: 'Mode score et classement en direct.' },
  '/games/logic-lab': { title: 'Sudoku', description: 'Sudoku 9x9 avec grilles générées et plusieurs niveaux.' },
  '/games/2048': { title: '2048', description: 'Fusionne les tuiles et améliore ton record.' },
  '/games/flappy-bird': { title: 'Flappy Bird', description: 'Session arcade rapide avec classement.' },
  '/games/chrome-dino': { title: 'Chrome Dino', description: 'Runner endless inspiré du jeu hors-ligne de Chrome.' },
  '/games/snake': { title: 'Snake', description: 'Arcade moderne avec combos, accélération et classement.' },
  '/games/fruit-ninja': { title: 'Fruit Ninja', description: 'Tranche les fruits avec ta souris, évite les bombes.' },
  '/games/qs-watermelon': { title: 'QS Watermelon', description: 'Fusionne les fruits dans la cuve sans dépasser la ligne.' },
  '/games/stack-tower': { title: 'Tour empilée', description: 'Empile les blocs avec précision pour faire la tour la plus haute.' },
  '/games/geometry-dash': { title: 'Geometry Dash', description: 'Arcade rythmée avec sauts millimétrés et progression rapide.' },
  '/games/casino': { title: 'Casino', description: 'Roulette, slots et blackjack.' },
  '/market': { title: 'Boutique', description: 'Cosmétiques, objets et améliorations à acheter avec ton argent.' },
  '/games/salle-de-marche': { title: 'Salle de marché', description: 'Hub crypto SaaS regroupant les trois terminaux de trading.' },
  '/games/aura-coin': { title: 'Aura Coin', description: 'Trading et positions à effet de levier.' },
  '/games/stable-coin': { title: 'Aura Stable', description: 'Stable coin avec volatilité réduite et spreads serrés.' },
  '/games/chaos-coin': { title: 'Chaos Coin', description: 'Coin très instable avec mouvements rapides et levier plus agressif.' },
  '/games/russian-roulette': { title: 'Roulette russe', description: 'Roulette russe multijoueur autour d\'une table sombre.' },
  '/games/uno': { title: 'UNO', description: 'Le classique jeu de cartes, de 2 à 4 joueurs.' },
  '/games/bomb-party': { title: 'Bombe de mots', description: 'Partie multijoueur basée sur les mots.' },
  '/games/poker': { title: 'Poker', description: "Table de poker avec paramètres de groupe." },
  '/games/petit-bac': { title: 'Petit Bac', description: 'Manches chronométrées par catégories.' },
  '/games/bataille-navale': { title: 'Bataille Navale', description: 'Duel tactique en groupe.' },
  '/games/solitaire': { title: 'Solitaire', description: 'Mode score avec classement.' },
  '/games/racer': { title: 'Racer', description: 'Course arcade style outrun.' },
  '/games/tetris': { title: 'Tetris', description: 'Session puzzle et classement.' },
  '/games/knife-hit': { title: 'Knife Hit', description: 'Timing arcade et classement.' },
  '/games/polytrack': { title: 'PolyTrack', description: 'Course low-poly time trial sur 14 circuits — soumets tes temps et grimpe au classement.' },
  '/games/minesweeper': { title: 'Démineur', description: 'Démineur classique avec parties rapides et grille à nettoyer.' },
  '/games/echecs': { title: 'Échecs', description: 'Duel complet avec règles officielles.' },
  '/games/ball-arena': { title: 'Arène des balles', description: "Duel physique : propulse ton adversaire hors de l'arène." },
  '/games/goyave-empire': { title: 'Goyave Empire', description: 'Idle farming : récolte des goyaves et bâtis ton empire.' },
  '/games/clash-village': { title: 'Clash Village', description: 'Construis ton village, défends-le et lance des raids asynchrones.' },
  '/games/puissance-quatre': { title: 'Puissance 4', description: 'Duel 1v1 classique où il faut aligner quatre jetons.' },
  '/games/morpion': { title: 'Morpion', description: 'Duel 3x3 rapide avec parties instantanées.' },
  '/games/eaglercraft': { title: 'Eaglercraft', description: 'Version navigateur de Minecraft jouable directement depuis AuraTracker.' },
  '/games/hexgl': { title: 'HexGL', description: 'Course futuriste WebGL antigravité à haute vitesse.' },
  '/games/crossy-road': { title: 'Crossy Road', description: 'Traverse routes et rails sans te faire percuter.' },
  '/polymarket': { title: 'Polymarket', description: 'Marché de prédictions communautaire.' },
  '/leaderboards': { title: 'Classement', description: 'Compare-toi aux autres joueurs, par catégorie et par période.' },
  '/leaderboards/nombres': { title: 'Nombres', description: 'Les chiffres clés de la communauté, de l\'économie et des jeux.' },
  '/party': { title: 'Groupe', description: 'Rejoins un groupe ouvert ou crée le tien pour jouer à plusieurs.' },
  '/clans': { title: 'Clans', description: 'Rejoins un clan, partage une banque commune et affronte d\'autres clans.' },
  '/inventory': { title: 'Inventaire', description: 'Tes objets, cosmétiques et achats.' },
  '/admin': { title: 'Admin', description: 'Outils de modération et d’administration.' },
  '/rules': { title: 'Règlement', description: 'Règles de la communauté et modération.' },
  '/pass': { title: 'Pass', description: 'Lootbox quotidienne, streak et récompenses aléatoires.' },
  '/quests': { title: 'Quêtes', description: 'Relève des défis quotidiens et gagne des récompenses.' },
  '/suggestions': { title: 'Suggestions', description: 'Propose des idées et vote pour celles de la communauté.' },
  '/settings': { title: 'Paramètres', description: 'Apparence, sons, notifications, compte, parrainage et raccourcis.' },
  '/inbox': { title: 'Boîte de réception', description: 'Notifications et messages reçus.' },
  '/support': { title: 'Support', description: 'Contacte l\'équipe pour toute question ou problème.' },
  '/marketplace': { title: 'Marché', description: 'Achète et vends des objets entre joueurs.' },
  '/forum': { title: 'Forum', description: 'Discute avec la communauté dans des forums thématiques.' },
  '/pixel-board': { title: 'Pixel Board', description: 'Grille de 100 × 100 pixels : un placement par cooldown, score des clans en fin d\'événement.' },
  '/messages': { title: 'Messages', description: 'Conversations privées et de groupe.' },
  '/tutoriels': { title: 'Tutoriels', description: "Guides pas à pas directement dans l'interface." },
  '/loto': { title: 'Loto', description: 'Achète des tickets par tier, alimente le pool, puis laisse le tirage désigner le gagnant.' },
  '/games/blockblast': { title: 'BlockBlast', description: 'Pose des blocs, casse des lignes et tiens le plus longtemps possible.' },
  '/games/hextris': { title: 'Hextris', description: 'Puzzle hexagonal inspiré de Tetris.' },
  '/games/paper-io': { title: 'Paper.io', description: 'Conquiers du territoire face à des bots.' },
  '/games/dotsandboxes': { title: 'Dots and Boxes', description: 'Relie les points pour fermer des carrés : le joueur qui en ferme le plus gagne.' },
  '/games/horse-race': { title: 'Hippodrome', description: 'Course de chevaux toutes les 5 minutes : paris et cotes en direct.' },
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

export function getSearchablePageEntries(): SearchablePageEntry[] {
  return Object.entries(STATIC_PAGE_META).map(([path, meta]) => ({
    path,
    ...meta,
  }));
}
