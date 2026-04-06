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
    actions: ['invite', 'deposit', 'withdraw'],
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
    actions: ['invite', 'deposit', 'withdraw', 'start_research', 'deploy_product'],
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
