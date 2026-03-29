export type BlockablePage = {
  key: string;
  path: string;
  label: string;
  category: string;
  description: string;
};

export const BLOCKABLE_PAGES: BlockablePage[] = [
  { key: 'dashboard', path: '/', label: 'Tableau de bord', category: 'Général', description: 'Page d\'accueil principale, affichée à l\'arrivée sur le site.' },
  { key: 'game-market', path: '/market', label: 'Boutique', category: 'Général', description: 'Boutique d\'objets, cosmétiques et améliorations.' },
  { key: 'game-polymarket', path: '/polymarket', label: 'Polymarket', category: 'Général', description: 'Marché de prédiction — pariez sur des événements réels.' },
  { key: 'pass', path: '/pass', label: 'Pass', category: 'Général', description: 'Lootbox quotidienne avec série de connexion et récompenses aléatoires.' },
  { key: 'quests', path: '/quests', label: 'Quêtes', category: 'Général', description: 'Quêtes journalières et hebdomadaires pour gagner de l\'aura.' },
  { key: 'rules', path: '/rules', label: 'Règlement', category: 'Général', description: 'Règlement du site et conditions d\'utilisation.' },
  { key: 'inbox', path: '/inbox', label: 'Messagerie', category: 'Général', description: 'Centre de notifications et messages reçus.' },
  { key: 'support', path: '/support', label: 'Support', category: 'Général', description: 'Centre d\'aide — soumettez un ticket ou consultez vos échanges.' },
  { key: 'games-hub', path: '/games', label: 'Hub Jeux', category: 'Jeux', description: 'Hub centralisant l\'accès à tous les jeux disponibles.' },
  { key: 'game-2048', path: '/games/2048', label: '2048', category: 'Jeux', description: 'Jeu de puzzle — combinez des tuiles pour atteindre 2048.' },
  { key: 'game-doodle-jump', path: '/games/doodle-jump', label: 'Doodle Jump', category: 'Jeux', description: 'Jeu de plateforme — grimpez le plus haut possible.' },
  { key: 'game-logic-lab', path: '/games/logic-lab', label: 'Sudoku', category: 'Jeux', description: 'Jeu de Sudoku en plusieurs niveaux de difficulté.' },
  { key: 'game-minesweeper', path: '/games/minesweeper', label: 'Démineur', category: 'Jeux', description: 'Jeu du Démineur classique.' },
  { key: 'game-flappy-bird', path: '/games/flappy-bird', label: 'Flappy Bird', category: 'Jeux', description: 'Traversez les tuyaux sans toucher les obstacles.' },
  { key: 'game-chrome-dino', path: '/games/chrome-dino', label: 'Chrome Dino', category: 'Jeux', description: 'Le dino de Chrome — évitez les cactus le plus longtemps possible.' },
  { key: 'game-stack-tower', path: '/games/stack-tower', label: 'Tour empilée', category: 'Jeux', description: 'Empilez les blocs pour construire la tour la plus haute.' },
  { key: 'game-geometry-dash', path: '/games/geometry-dash', label: 'Geometry Dash', category: 'Jeux', description: 'Jeu de rythme — sautez au bon moment pour éviter les obstacles.' },
  { key: 'game-qs-watermelon', path: '/games/qs-watermelon', label: 'QS Watermelon', category: 'Jeux', description: 'Fusionnez des fruits pour créer une pastèque.' },
  { key: 'game-casino', path: '/games/casino', label: 'Casino', category: 'Jeux', description: 'Casino de jeux — misez votre aura sur des machines à sous.' },
  { key: 'game-aura-coin', path: '/games/aura-coin', label: 'Aura Coin', category: 'Jeux', description: 'Bourse virtuelle — achetez et vendez des Aura Coins.' },
  { key: 'game-russian-roulette', path: '/games/russian-roulette', label: 'Roulette russe', category: 'Jeux', description: 'Jeu de roulette russe — tentez votre chance.' },
  { key: 'game-bomb-party', path: '/games/bomb-party', label: 'Bombe de mots', category: 'Jeux', description: 'Jeu de mots multijoueur — trouvez des mots avant que la bombe explose.' },
  { key: 'game-poker', path: '/games/poker', label: 'Poker', category: 'Jeux', description: 'Poker Texas Hold\'em multijoueur.' },
  { key: 'game-petit-bac', path: '/games/petit-bac', label: 'Petit Bac', category: 'Jeux', description: 'Jeu du Petit Bac — trouvez des mots par catégorie.' },
  { key: 'game-bataille-navale', path: '/games/bataille-navale', label: 'Bataille Navale', category: 'Jeux', description: 'Jeu de Bataille Navale en 1v1.' },
  { key: 'game-solitaire', path: '/games/solitaire', label: 'Solitaire', category: 'Jeux', description: 'Jeu de Solitaire classique.' },
  { key: 'game-racer', path: '/games/racer', label: 'Racer', category: 'Jeux', description: 'Jeu de course — évitez les obstacles sur la piste.' },
  { key: 'game-tetris', path: '/games/tetris', label: 'Tetris', category: 'Jeux', description: 'Jeu de Tetris — empilez les pièces sans laisser d\'espace.' },
  { key: 'game-knife-hit', path: '/games/knife-hit', label: 'Knife Hit', category: 'Jeux', description: 'Lancez des couteaux sur une cible tournante sans en toucher d\'autres.' },
  { key: 'game-clash-village', path: '/games/clash-village', label: 'Clash Village', category: 'Jeux', description: 'Jeu de stratégie — construisez et défendez votre village.' },
  { key: 'game-echecs', path: '/games/echecs', label: 'Échecs', category: 'Jeux', description: 'Jeu d\'Échecs en 1v1.' },
  { key: 'game-morpion', path: '/games/morpion', label: 'Morpion', category: 'Jeux', description: 'Morpion (Tic-Tac-Toe) en 1v1.' },
  { key: 'game-goyave-empire', path: '/games/goyave-empire', label: 'Goyave Empire', category: 'Jeux', description: 'Jeu d\'empire — développez votre empire Goyave.' },
  { key: 'game-puissance-quatre', path: '/games/puissance-quatre', label: 'Puissance 4', category: 'Jeux', description: 'Puissance 4 en 1v1 — alignez 4 jetons.' },
  { key: 'game-fruit-ninja', path: '/games/fruit-ninja', label: 'Fruit Ninja', category: 'Jeux', description: 'Tranchez les fruits qui volent avant qu\'ils tombent.' },
  { key: 'game-ball-arena', path: '/games/ball-arena', label: 'Arène des balles', category: 'Jeux', description: 'Jeu d\'arène — faites tomber les adversaires hors du plateau.' },
  { key: 'game-uno', path: '/games/uno', label: 'Uno', category: 'Jeux', description: 'Jeu de cartes Uno multijoueur.' },
  { key: 'game-polytrack', path: '/games/polytrack', label: 'Polytrack', category: 'Jeux', description: 'Jeu de course sur piste — battez votre meilleur temps.' },
  { key: 'game-eaglercraft', path: '/games/eaglercraft', label: 'Eaglercraft', category: 'Jeux', description: 'Version navigateur de Minecraft jouable directement depuis le site.' },
  { key: 'game-subway-surfers', path: '/games/subway-surfers', label: 'Subway Surfers Clone', category: 'Jeux', description: 'Runner 3D style métro inspiré du clone Unity Subway Surfers.' },
  { key: 'game-hexgl', path: '/games/hexgl', label: 'HexGL', category: 'Jeux', description: 'Course futuriste WebGL antigravité inspirée de Wipeout.' },
  { key: 'leaderboards', path: '/leaderboards', label: 'Classements', category: 'Communauté', description: 'Classements généraux des joueurs par aura et par jeu.' },
  { key: 'leaderboards-numbers', path: '/leaderboards/nombres', label: 'Classement Nombres', category: 'Communauté', description: 'Classement spécial basé sur les scores de la section Nombres.' },
  { key: 'party', path: '/party', label: 'Groupe', category: 'Communauté', description: 'Salons de jeu en groupe — créez ou rejoignez un groupe.' },
  { key: 'clans', path: '/clans', label: 'Guildes', category: 'Communauté', description: 'Système de guildes — rejoignez ou créez votre guilde.' },
  { key: 'suggestions', path: '/suggestions', label: 'Suggestions', category: 'Communauté', description: 'Page de suggestions — soumettez et votez pour des idées.' },
  { key: 'inventory', path: '/inventory', label: 'Inventaire', category: 'Profil', description: 'Inventaire personnel — consultez et utilisez vos objets.' },
  { key: 'profile', path: '/profile', label: 'Profils', category: 'Profil', description: 'Profils publics des joueurs — stats, badges et historique.' },
  { key: 'settings', path: '/settings', label: 'Paramètres utilisateur', category: 'Profil', description: 'Page de paramètres personnels : thème, compte, parrainage.' },
];

export const getBlockablePageByKey = (key: string) =>
  BLOCKABLE_PAGES.find((page) => page.key === key);
