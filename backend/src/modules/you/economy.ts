type ResourceType =
  | 'WOOD' | 'STONE' | 'IRON' | 'FOOD' | 'CLOTH'
  | 'CONCRETE' | 'STEEL' | 'FUEL' | 'PAPER'
  | 'LUXURY_GOODS' | 'MEDICINE' | 'DATA' | 'CONTRABAND';

export type YouEconomyResourceType = ResourceType;

export interface SupplyProfile {
  resourceType: ResourceType;
  rate: number;
  capacity: number;
  price: number;
}

export interface BusinessInputRequirement {
  resourceType: ResourceType;
  dailyQuantity: number;
  weight?: number;
}

export interface BusinessFinancialEvent {
  key: string;
  label: string;
  description: string;
  revenueMultiplier: number;
  expenseMultiplier: number;
  riskDelta: number;
}

export const SUPPLY_PROFILES: Record<string, SupplyProfile[]> = {
  lemonade: [{ resourceType: 'FOOD', rate: 3, capacity: 80, price: 8 }],
  epicerie: [{ resourceType: 'LUXURY_GOODS', rate: 2, capacity: 70, price: 45 }],
  restaurant: [{ resourceType: 'FOOD', rate: 4, capacity: 100, price: 14 }],
  coffee_shop: [
    { resourceType: 'FOOD', rate: 3, capacity: 90, price: 12 },
    { resourceType: 'LUXURY_GOODS', rate: 1, capacity: 45, price: 42 },
  ],
  startup: [{ resourceType: 'DATA', rate: 3, capacity: 90, price: 38 }],
  agency: [{ resourceType: 'LUXURY_GOODS', rate: 1, capacity: 50, price: 55 }],
  formation: [{ resourceType: 'PAPER', rate: 2, capacity: 80, price: 20 }],
  youtube: [
    { resourceType: 'DATA', rate: 2, capacity: 80, price: 34 },
    { resourceType: 'PAPER', rate: 1, capacity: 60, price: 18 },
  ],
  medecins: [{ resourceType: 'MEDICINE', rate: 2, capacity: 70, price: 50 }],
  illegal_market: [{ resourceType: 'CONTRABAND', rate: 2, capacity: 60, price: 90 }],
  farm: [{ resourceType: 'FOOD', rate: 8, capacity: 180, price: 10 }],
  sawmill: [{ resourceType: 'WOOD', rate: 7, capacity: 160, price: 24 }],
  quarry: [
    { resourceType: 'STONE', rate: 7, capacity: 160, price: 18 },
    { resourceType: 'CONCRETE', rate: 2, capacity: 80, price: 42 },
  ],
  iron_mine: [
    { resourceType: 'IRON', rate: 5, capacity: 140, price: 30 },
    { resourceType: 'STEEL', rate: 2, capacity: 75, price: 58 },
  ],
  fuel_refinery: [{ resourceType: 'FUEL', rate: 3, capacity: 100, price: 48 }],
  textile_mill: [{ resourceType: 'CLOTH', rate: 5, capacity: 130, price: 26 }],
};

export const BUSINESS_INPUT_REQUIREMENTS: Record<string, BusinessInputRequirement[]> = {
  lemonade: [{ resourceType: 'FOOD', dailyQuantity: 1, weight: 1 }],
  restaurant: [{ resourceType: 'FOOD', dailyQuantity: 4, weight: 1 }],
  coffee_shop: [
    { resourceType: 'FOOD', dailyQuantity: 2, weight: 0.45 },
    { resourceType: 'LUXURY_GOODS', dailyQuantity: 1, weight: 0.55 },
  ],
  epicerie: [{ resourceType: 'LUXURY_GOODS', dailyQuantity: 2, weight: 1 }],
  agency: [
    { resourceType: 'LUXURY_GOODS', dailyQuantity: 1, weight: 0.6 },
    { resourceType: 'CLOTH', dailyQuantity: 2, weight: 0.4 },
  ],
  startup: [
    { resourceType: 'DATA', dailyQuantity: 3, weight: 0.75 },
    { resourceType: 'PAPER', dailyQuantity: 1, weight: 0.25 },
  ],
  youtube: [
    { resourceType: 'DATA', dailyQuantity: 2, weight: 0.7 },
    { resourceType: 'PAPER', dailyQuantity: 1, weight: 0.3 },
  ],
  formation: [{ resourceType: 'PAPER', dailyQuantity: 2, weight: 1 }],
  medecins: [
    { resourceType: 'MEDICINE', dailyQuantity: 2, weight: 0.8 },
    { resourceType: 'FOOD', dailyQuantity: 1, weight: 0.2 },
  ],
  illegal_market: [{ resourceType: 'CONTRABAND', dailyQuantity: 1, weight: 1 }],
};

export const GLOBAL_MARKET_PRICE_MULTIPLIER = 0.55;

export function getSupplyProfiles(typeKey: string) {
  return SUPPLY_PROFILES[typeKey] ?? [];
}

export function getBusinessInputRequirements(typeKey: string) {
  return BUSINESS_INPUT_REQUIREMENTS[typeKey] ?? [];
}

export function getResourceBasePrice(typeKey: string, resourceType: string) {
  const exact = getSupplyProfiles(typeKey).find((entry) => entry.resourceType === resourceType);
  if (exact) return exact.price;
  for (const profiles of Object.values(SUPPLY_PROFILES)) {
    const match = profiles.find((entry) => entry.resourceType === resourceType);
    if (match) return match.price;
  }
  return 10;
}

export function getGlobalMarketUnitPrice(typeKey: string, resourceType: string) {
  return Math.max(1, Math.floor(getResourceBasePrice(typeKey, resourceType) * GLOBAL_MARKET_PRICE_MULTIPLIER));
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getBusinessFinancialEvent(businessId: string, typeKey: string, date = new Date()): BusinessFinancialEvent {
  const dayKey = date.toISOString().slice(0, 10);
  const roll = hashString(`${businessId}:${dayKey}`) % 100;
  if (typeKey === 'illegal_market' && roll < 18) {
    return {
      key: 'INSPECTION_RISK',
      label: 'Controle discret',
      description: 'Activite sous surveillance: la marge projetee reste forte, mais le risque legal monte.',
      revenueMultiplier: 0.94,
      expenseMultiplier: 1.08,
      riskDelta: 18,
    };
  }
  if (roll < 12) {
    return {
      key: 'DEMAND_SPIKE',
      label: 'Pic de demande',
      description: 'Les clients achetent plus vite aujourd hui. Bon moment pour augmenter les prix.',
      revenueMultiplier: 1.16,
      expenseMultiplier: 1,
      riskDelta: -2,
    };
  }
  if (roll < 23) {
    return {
      key: 'SUPPLIER_DELAY',
      label: 'Retard fournisseur',
      description: 'Les approvisionnements sont plus tendus. Les stocks de securite valent plus cher.',
      revenueMultiplier: 0.92,
      expenseMultiplier: 1.03,
      riskDelta: 7,
    };
  }
  if (roll < 33) {
    return {
      key: 'RENT_HIKE',
      label: 'Frais fixes en hausse',
      description: 'Les couts d exploitation augmentent legerement pour la journee.',
      revenueMultiplier: 1,
      expenseMultiplier: 1.12,
      riskDelta: 4,
    };
  }
  if (roll < 43) {
    return {
      key: 'QUIET_MARKET',
      label: 'Marche calme',
      description: 'La demande naturelle ralentit. Les contrats joueurs deviennent plus importants.',
      revenueMultiplier: 0.9,
      expenseMultiplier: 0.98,
      riskDelta: 3,
    };
  }
  return {
    key: 'NORMAL',
    label: 'Activite normale',
    description: 'Aucun choc majeur: les decisions de prix, stock et equipe dominent la journee.',
    revenueMultiplier: 1,
    expenseMultiplier: 1,
    riskDelta: 0,
  };
}

export function getBusinessInputCoverage(typeKey: string, inventories: Array<{ resourceType: string; quantity: number }> = []) {
  const requirements = getBusinessInputRequirements(typeKey);
  if (requirements.length === 0) {
    return {
      hasRequirements: false,
      percent: 100,
      multiplier: 1,
      shortages: [] as Array<{ resourceType: string; required: number; available: number; missing: number }>,
    };
  }

  const totalWeight = requirements.reduce((sum, entry) => sum + (entry.weight ?? 1), 0) || 1;
  let weightedCoverage = 0;
  const shortages: Array<{ resourceType: string; required: number; available: number; missing: number }> = [];

  for (const requirement of requirements) {
    const available = inventories.find((entry) => entry.resourceType === requirement.resourceType)?.quantity ?? 0;
    const coverage = Math.min(1, available / Math.max(1, requirement.dailyQuantity));
    weightedCoverage += coverage * ((requirement.weight ?? 1) / totalWeight);
    if (available < requirement.dailyQuantity) {
      shortages.push({
        resourceType: requirement.resourceType,
        required: requirement.dailyQuantity,
        available,
        missing: requirement.dailyQuantity - available,
      });
    }
  }

  const percent = Math.round(weightedCoverage * 100);
  return {
    hasRequirements: true,
    percent,
    multiplier: Math.max(0.35, Math.min(1, weightedCoverage)),
    shortages,
  };
}

export function getSupplierReliability(contracts: Array<{ status: string; totalQuantity: number; deliveredQuantity: number }> = []) {
  if (contracts.length === 0) {
    return { percent: 100, completed: 0, failed: 0, label: 'Neutre' };
  }

  let score = 0;
  let completed = 0;
  let failed = 0;
  for (const contract of contracts) {
    const total = Math.max(1, contract.totalQuantity);
    const fulfillment = Math.max(0, Math.min(1, contract.deliveredQuantity / total));
    if (contract.status === 'COMPLETED') {
      completed += 1;
      score += 1;
    } else if (contract.status === 'REJECTED' || contract.status === 'CANCELLED') {
      failed += 1;
      score += 0.2 * fulfillment;
    } else {
      score += 0.55 + fulfillment * 0.35;
    }
  }

  const percent = Math.round((score / contracts.length) * 100);
  return {
    percent,
    completed,
    failed,
    label: percent >= 90 ? 'Excellent' : percent >= 75 ? 'Solide' : percent >= 55 ? 'Fragile' : 'Risque',
  };
}

export function getBusinessCreditScore(input: {
  treasuryMoney: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  satisfaction: number;
  activeDebt: number;
  reliabilityPercent: number;
  runwayDays: number | null;
}) {
  const monthlyNet = input.monthlyRevenue - input.monthlyExpenses;
  const runwayScore = input.runwayDays == null ? 80 : Math.max(0, Math.min(110, input.runwayDays * 8));
  const liquidityScore = Math.max(0, Math.min(120, input.treasuryMoney / 90));
  const marginScore = Math.max(-80, Math.min(120, monthlyNet / 18));
  const debtPenalty = Math.max(0, Math.min(160, input.activeDebt / 80));
  const raw = 420
    + liquidityScore
    + marginScore
    + runwayScore
    + input.satisfaction * 0.9
    + input.reliabilityPercent * 0.8
    - debtPenalty;
  return Math.max(300, Math.min(850, Math.round(raw)));
}

export function getRunwayDays(treasuryMoney: number, dailyBurn: number) {
  if (dailyBurn <= 0) return null;
  return Math.max(0, Math.floor(treasuryMoney / dailyBurn));
}
