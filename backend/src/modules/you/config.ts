export type BusinessActionKey = 'invite' | 'loan' | 'invest' | 'deposit' | 'withdraw' | 'start_research' | 'deploy_product';
export type YouSkillKey = 'affaires' | 'social' | 'intelligence' | 'charisme' | 'finance';

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
  actions: BusinessActionKey[];
}

export interface StartupProductDefinition {
  slotIndex: number;
  name: string;
}

export const BUSINESS_TYPES: BusinessTypeDefinition[] = [
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
    actions: ['invite', 'deposit', 'withdraw', 'start_research', 'deploy_product'],
  },
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
    actions: ['loan', 'invest', 'invite', 'deposit', 'withdraw'],
  },
  {
    key: 'agency',
    label: 'Agence',
    category: 'Services',
    description: 'Campagnes, design et accompagnement business.',
    minCapital: 5000,
    creationFee: 5000,
    monthlyRevenue: 6800,
    monthlyExpenses: 3900,
    satisfaction: 82,
    actions: ['invite', 'deposit', 'withdraw'],
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
  color: 'emerald' | 'purple' | 'sky' | 'pink' | 'amber';
  description: string;
  trainingCost: number;
  xpPerTraining: number;
  unlocks: string[];
}

export const YOU_SKILLS: YouSkillDefinition[] = [
  {
    key: 'affaires',
    label: 'Affaires',
    color: 'emerald',
    description: "Gestion d'entreprise et commerce.",
    trainingCost: 2500,
    xpPerTraining: 25,
    unlocks: ['1 slot business par niveau', 'Ouverture de secteurs plus rares plus tard', 'Gestion d equipes plus large a haut niveau'],
  },
  {
    key: 'social',
    label: 'Social',
    color: 'purple',
    description: 'Relations et influence sociale.',
    trainingCost: 1800,
    xpPerTraining: 25,
    unlocks: ['Reseau social plus solide', 'Interactions sociales plus riches plus tard', 'Synergies relationnelles a haut niveau'],
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    color: 'sky',
    description: 'Apprentissage et adaptabilite.',
    trainingCost: 2200,
    xpPerTraining: 25,
    unlocks: ['Lecture plus rapide des opportunites', 'Progression specialisee future', 'Acces aux postes plus pointus a haut niveau'],
  },
  {
    key: 'charisme',
    label: 'Charisme',
    color: 'pink',
    description: 'Persuasion et presence sociale.',
    trainingCost: 2000,
    xpPerTraining: 25,
    unlocks: ['Negociation plus forte plus tard', 'Meilleure image publique', 'Partenariats plus simples a haut niveau'],
  },
  {
    key: 'finance',
    label: 'Finance',
    color: 'amber',
    description: 'Investissements et gestion de capital.',
    trainingCost: 3000,
    xpPerTraining: 25,
    unlocks: ['Optimisation financiere future', 'Conditions de financement plus souples plus tard', 'Meilleur rendement a haut niveau'],
  },
];

export const YOU_SKILL_MAP = new Map(YOU_SKILLS.map((skill) => [skill.key, skill]));
export const YOU_SKILL_MAX_LEVEL = 10;
export const YOU_SKILL_XP_PER_LEVEL = 100;
