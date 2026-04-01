export type BusinessActionKey = 'invite' | 'loan' | 'invest' | 'deposit' | 'withdraw';

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

export const BUSINESS_TYPES: BusinessTypeDefinition[] = [
  {
    key: 'startup',
    label: 'Startup Tech',
    category: 'Tech',
    description: 'Produits SaaS, services web et outils numeriques.',
    minCapital: 10000,
    creationFee: 10000,
    monthlyRevenue: 8400,
    monthlyExpenses: 5200,
    satisfaction: 86,
    actions: ['invite', 'deposit', 'withdraw'],
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

export type InvestmentRiskLevel = keyof typeof INVESTMENT_RISK_RANGES;
