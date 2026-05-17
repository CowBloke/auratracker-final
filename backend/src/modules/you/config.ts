export type BusinessActionKey = 'invite' | 'loan' | 'invest' | 'deposit' | 'withdraw' | 'start_research' | 'deploy_product' | 'collect_npc' | 'purchase_item';
export type YouSkillKey = 'affaires' | 'social' | 'intelligence' | 'charisme' | 'finance' | 'illegalite';

export interface BusinessTypeDefinition {
  key: string;
  label: string;
  category: string;
  description: string;
  minCapital: number;
  creationFee: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  satisfaction: number;
  level: number; // 1 = always available; 2 = requires having owned a level 1; 3 = requires level 2
  actions: BusinessActionKey[];
  isAdminOnly?: boolean;   // only admins can create
  isStateOwned?: boolean;  // automatically marked as state institution
}

export interface StartupProductDefinition {
  slotIndex: number;
  name: string;
}

export interface IllegalBusinessUpgradeDefinition {
  key: string;
  label: string;
  description: string;
  cost: number;
  revenueBonus: number;
  satisfactionBonus: number;
  xpReward: number;
}

export const BUSINESS_TYPES: BusinessTypeDefinition[] = [
  // --- Level 1 ---
  {
    key: 'lemonade',
    label: 'Stand de limonade',
    category: 'Commerce',
    description: 'Un petit stand de boissons fraiches. Premier pas dans le monde des affaires.',
    minCapital: 0,
    creationFee: 500,
    monthlyRevenue: 300,
    monthlyExpenses: 50,
    satisfaction: 75,
    level: 1,
    actions: ['deposit', 'withdraw', 'collect_npc', 'purchase_item'],
  },
  {
    key: 'epicerie',
    label: 'Epicerie',
    category: 'Commerce',
    description: 'Une petite epicerie de quartier. Les clients achètent directement vos produits.',
    minCapital: 0,
    creationFee: 1500,
    monthlyRevenue: 600,
    monthlyExpenses: 200,
    satisfaction: 78,
    level: 1,
    actions: ['deposit', 'withdraw', 'collect_npc', 'purchase_item'],
  },
  {
    key: 'restaurant',
    label: 'Restaurant',
    category: 'Restauration',
    description: 'Un restaurant servant divers plats comme des burgers, pizzas et poulet frit.',
    minCapital: 0,
    creationFee: 2000,
    monthlyRevenue: 800,
    monthlyExpenses: 250,
    satisfaction: 80,
    level: 1,
    actions: ['deposit', 'withdraw', 'collect_npc', 'purchase_item'],
  },
  // --- Level 1 — Extraction ---
  {
    key: 'farm',
    label: 'Ferme',
    category: 'Extraction',
    description: 'La ferme genere de la nourriture en continu, base de toute la chaine alimentaire.',
    minCapital: 0,
    creationFee: 800,
    monthlyRevenue: 400,
    monthlyExpenses: 100,
    satisfaction: 72,
    level: 1,
    actions: ['invite', 'deposit', 'withdraw'],
  },
  {
    key: 'sawmill',
    label: 'Scierie',
    category: 'Extraction',
    description: 'La scierie transforme les ressources naturelles en bois pour la construction.',
    minCapital: 0,
    creationFee: 1000,
    monthlyRevenue: 500,
    monthlyExpenses: 150,
    satisfaction: 70,
    level: 1,
    actions: ['invite', 'deposit', 'withdraw'],
  },
  {
    key: 'quarry',
    label: 'Carriere',
    category: 'Extraction',
    description: 'La carriere extrait pierre et beton, materiaux essentiels pour batir l avenir.',
    minCapital: 0,
    creationFee: 1200,
    monthlyRevenue: 600,
    monthlyExpenses: 180,
    satisfaction: 68,
    level: 1,
    actions: ['invite', 'deposit', 'withdraw'],
  },
  // --- Level 2 — Industrie ---
  {
    key: 'iron_mine',
    label: 'Mine de fer',
    category: 'Industrie',
    description: 'La mine produit fer et acier, piliers de l industrie lourde.',
    minCapital: 2000,
    creationFee: 2500,
    monthlyRevenue: 800,
    monthlyExpenses: 300,
    satisfaction: 65,
    level: 2,
    actions: ['invite', 'deposit', 'withdraw'],
  },
  {
    key: 'fuel_refinery',
    label: 'Raffinerie',
    category: 'Industrie',
    description: 'La raffinerie produit le carburant qui fait tourner l ensemble de l economie.',
    minCapital: 3000,
    creationFee: 4000,
    monthlyRevenue: 1000,
    monthlyExpenses: 400,
    satisfaction: 63,
    level: 2,
    actions: ['invite', 'deposit', 'withdraw'],
  },
  {
    key: 'textile_mill',
    label: 'Manufacture textile',
    category: 'Industrie',
    description: 'La manufacture transforme les fibres en tissus pour le commerce.',
    minCapital: 1500,
    creationFee: 2000,
    monthlyRevenue: 700,
    monthlyExpenses: 250,
    satisfaction: 67,
    level: 2,
    actions: ['invite', 'deposit', 'withdraw'],
  },
  // --- Level 2 ---
  {
    key: 'coffee_shop',
    label: 'Coffee Shop',
    category: 'Commerce',
    description: 'Un cafe tendance avec une clientele fidèle et des revenus stables.',
    minCapital: 1000,
    creationFee: 3000,
    monthlyRevenue: 1200,
    monthlyExpenses: 600,
    satisfaction: 83,
    level: 2,
    actions: ['invite', 'invest', 'deposit', 'withdraw'],
  },
  {
    key: 'startup',
    label: 'Startup Tech',
    category: 'Tech',
    description: 'Produits SaaS, services web et outils numeriques.',
    minCapital: 10000,
    creationFee: 10000,
    monthlyRevenue: 0,
    monthlyExpenses: 1800,
    satisfaction: 86,
    level: 2,
    actions: ['invite', 'invest', 'deposit', 'withdraw', 'start_research', 'deploy_product'],
  },
  {
    key: 'agency',
    label: 'Agence Immobiliere',
    category: 'Services',
    description: 'Transactions immobilieres, gestion de biens et conseil patrimonial.',
    minCapital: 5000,
    creationFee: 5000,
    monthlyRevenue: 6800,
    monthlyExpenses: 3900,
    satisfaction: 82,
    level: 2,
    actions: ['invite', 'deposit', 'withdraw', 'purchase_item'],
  },
  {
    key: 'formation',
    label: 'Centre de formation',
    category: 'Services',
    description: 'Des eleves paient des cours et les revenus evoluent avec la taille de l equipe.',
    minCapital: 2000,
    creationFee: 1500,
    monthlyRevenue: 800,
    monthlyExpenses: 450,
    satisfaction: 80,
    level: 2,
    actions: ['invite', 'deposit', 'withdraw'],
  },
  {
    key: 'transfer',
    label: 'Service de transfert',
    category: 'Finance',
    description: 'Des frais sont factures sur les transferts d argent entre joueurs.',
    minCapital: 5000,
    creationFee: 3000,
    monthlyRevenue: 0,
    monthlyExpenses: 700,
    satisfaction: 78,
    level: 2,
    actions: ['invite', 'deposit', 'withdraw'],
  },
  {
    key: 'youtube',
    label: 'Chaîne YouTube',
    category: 'Media',
    description: 'Publie des videos, cumule des vues et vends des placements de produit.',
    minCapital: 1500,
    creationFee: 2500,
    monthlyRevenue: 450,
    monthlyExpenses: 120,
    satisfaction: 84,
    level: 2,
    actions: ['invest', 'deposit', 'withdraw', 'collect_npc'],
  },
  {
    key: 'medecins',
    label: 'Cabinet de médecins',
    category: 'Sante',
    description: 'Soigne les blesses apres les guerres et facture differents niveaux de regeneration.',
    minCapital: 3000,
    creationFee: 3500,
    monthlyRevenue: 600,
    monthlyExpenses: 200,
    satisfaction: 88,
    level: 2,
    actions: ['invite', 'invest', 'deposit', 'withdraw', 'purchase_item'],
  },
  {
    key: 'horse_business',
    label: 'Haras',
    category: 'Sport',
    description: 'Produit des chevaux de course et facture les entrainements des ecuries.',
    minCapital: 5000,
    creationFee: 4000,
    monthlyRevenue: 900,
    monthlyExpenses: 350,
    satisfaction: 82,
    level: 2,
    actions: ['invite', 'invest', 'deposit', 'withdraw'],
  },
  // --- Level 3 ---
  {
    key: 'bank',
    label: 'Banque',
    category: 'Finance',
    description: 'Depots, prets et services bancaires entre joueurs.',
    minCapital: 0,
    creationFee: 10000,
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    satisfaction: 91,
    level: 3,
    actions: ['loan', 'invest', 'invite', 'deposit', 'withdraw'],
  },
  {
    key: 'illegal_market',
    label: 'Point de vente illegal',
    category: 'Marche noir',
    description: 'Vente de drogue et de puff. Activite risquee mais rentable pour les joueurs experimentes.',
    minCapital: 4000,
    creationFee: 7000,
    monthlyRevenue: 1200,
    monthlyExpenses: 450,
    satisfaction: 62,
    level: 3,
    actions: ['invite', 'deposit', 'withdraw', 'purchase_item'],
  },
  // --- Production d'Items ---
  {
    key: 'juterie',
    label: 'Juterie',
    category: "Production d'Items",
    description: 'Fabrique des jus à effets spéciaux vendables sur le marché des items : abricot, gingembre, papaye, malakoukou, goyave.',
    minCapital: 1000,
    creationFee: 2000,
    monthlyRevenue: 450,
    monthlyExpenses: 150,
    satisfaction: 77,
    level: 2,
    actions: ['invite', 'deposit', 'withdraw'],
  },
  {
    key: 'labo_pub',
    label: 'Labo Pub',
    category: "Production d'Items",
    description: 'Produit des tokens ADblock vendables sur le marché. Bloquent les pubs 60 min pour l\'acheteur.',
    minCapital: 2000,
    creationFee: 3000,
    monthlyRevenue: 550,
    monthlyExpenses: 200,
    satisfaction: 75,
    level: 2,
    actions: ['invite', 'deposit', 'withdraw'],
  },
  // --- Justice ---
  {
    key: 'law_firm',
    label: "Cabinet d'avocats",
    category: 'Justice',
    description: "Representez des clients lors de proces. Les plaideurs peuvent vous engager comme avocat prive.",
    minCapital: 2000,
    creationFee: 2000,
    monthlyRevenue: 1500,
    monthlyExpenses: 500,
    satisfaction: 85,
    level: 2,
    actions: ['invite', 'deposit', 'withdraw'],
  },
  // --- Etat (admin only) ---
  {
    key: 'supreme_court',
    label: 'Cour Supreme',
    category: 'Etat',
    description: "Institution judiciaire d'Etat. Les joueurs peuvent y deposer des plaintes formelles.",
    minCapital: 0,
    creationFee: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    satisfaction: 100,
    level: 1,
    actions: [],
    isAdminOnly: true,
    isStateOwned: true,
  },
];

export const BUSINESS_TYPE_MAP = new Map(BUSINESS_TYPES.map((type) => [type.key, type]));

export const INVESTMENT_RISK_RANGES = {
  low: { min: 2, max: 5 },
  medium: { min: 5, max: 15 },
  high: { min: 10, max: 40 },
} as const;

export const STARTUP_PRODUCTS: StartupProductDefinition[] = [
  { slotIndex: 1, name: 'Produit Alpha' },
  { slotIndex: 2, name: 'Produit Nova' },
  { slotIndex: 3, name: 'Produit Pulse' },
];

export const STARTUP_PRODUCT_MAX_LEVEL = 10;
export const STARTUP_RESEARCH_MINUTES_CAP = 8 * 60;

export const ILLEGAL_BUSINESS_UPGRADES: IllegalBusinessUpgradeDefinition[] = [
  {
    key: 'supply_network',
    label: 'Reseau de fournisseurs',
    description: 'Ameliore l approvisionnement pour augmenter les volumes de vente.',
    cost: 5000,
    revenueBonus: 350,
    satisfactionBonus: 4,
    xpReward: 18,
  },
  {
    key: 'hidden_storage',
    label: 'Cache securisee',
    description: 'Stockage discret et mieux organise pour eviter les pertes.',
    cost: 7500,
    revenueBonus: 500,
    satisfactionBonus: 5,
    xpReward: 24,
  },
  {
    key: 'street_marketing',
    label: 'Marketing de rue',
    description: 'Rend le point de vente plus visible dans les circuits informels.',
    cost: 9000,
    revenueBonus: 650,
    satisfactionBonus: 6,
    xpReward: 30,
  },
];

export const ILLEGAL_BUSINESS_UPGRADE_MAP = new Map(ILLEGAL_BUSINESS_UPGRADES.map((upgrade) => [upgrade.key, upgrade]));

export function getStartupResearchDurationMinutes(nextLevel: number) {
  return Math.min(30 * (2 ** Math.max(0, nextLevel - 1)), STARTUP_RESEARCH_MINUTES_CAP);
}

export function getStartupResearchCost(nextLevel: number) {
  return Math.round(4000 * (1.6 ** Math.max(0, nextLevel - 1)));
}

export function getStartupProductRevenue(level: number) {
  return level * 2200;
}

export type InvestmentRiskLevel = keyof typeof INVESTMENT_RISK_RANGES;

export interface YouSkillDefinition {
  key: YouSkillKey;
  label: string;
  color: 'emerald' | 'purple' | 'sky' | 'pink' | 'amber' | 'rose';
  description: string;
  trainingCost: number;
  xpPerTraining: number;
  trainable: boolean;
  unlocks: string[];
}

export const YOU_SKILLS: YouSkillDefinition[] = [
  {
    key: 'affaires',
    label: 'Affaires',
    color: 'emerald',
    description: "Gestion d'entreprise et commerce. XP gagne en faisant tourner son entreprise.",
    trainingCost: 2500,
    xpPerTraining: 25,
    trainable: true,
    unlocks: ['1 slot business par niveau', 'Ouverture de secteurs plus rares plus tard', 'Gestion d equipes plus large a haut niveau'],
  },
  {
    key: 'social',
    label: 'Social',
    color: 'purple',
    description: "Relations et influence sociale. XP gagne en achetant des biens immobiliers via une agence.",
    trainingCost: 1800,
    xpPerTraining: 25,
    trainable: true,
    unlocks: ['Reseau social plus solide', 'Interactions sociales plus riches plus tard', 'Synergies relationnelles a haut niveau'],
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    color: 'sky',
    description: 'Apprentissage et adaptabilite. XP gagne en achetant des formations.',
    trainingCost: 2200,
    xpPerTraining: 25,
    trainable: true,
    unlocks: ['Lecture plus rapide des opportunites', 'Progression specialisee future', 'Acces aux postes plus pointus a haut niveau'],
  },
  {
    key: 'charisme',
    label: 'Charisme',
    color: 'pink',
    description: 'Persuasion et presence sociale. XP gagne en recevant de l\'aura.',
    trainingCost: 2000,
    xpPerTraining: 25,
    trainable: true,
    unlocks: ['Negociation plus forte plus tard', 'Meilleure image publique', 'Partenariats plus simples a haut niveau'],
  },
  {
    key: 'finance',
    label: 'Finance',
    color: 'amber',
    description: 'Investissements et gestion de capital. XP gagne en depositant de l\'argent en banque.',
    trainingCost: 3000,
    xpPerTraining: 25,
    trainable: true,
    unlocks: ['Optimisation financiere future', 'Conditions de financement plus souples plus tard', 'Meilleur rendement a haut niveau'],
  },
  {
    key: 'illegalite',
    label: 'Illegalite',
    color: 'rose',
    description: 'Activites au marche noir et manoeuvres douteuses. XP gagne via des activites illegales.',
    trainingCost: 0,
    xpPerTraining: 0,
    trainable: false,
    unlocks: ['Acces au marche noir', 'Arnaques et manoeuvres illegales', 'Reputation dans le milieu a haut niveau'],
  },
];

export const YOU_SKILL_MAP = new Map(YOU_SKILLS.map((skill) => [skill.key, skill]));
export const YOU_SKILL_MAX_LEVEL = 10;
export const YOU_SKILL_XP_PER_LEVEL = 100;
