export type ConstructionResourceType =
  | 'WOOD' | 'STONE' | 'IRON' | 'FOOD' | 'CLOTH'
  | 'CONCRETE' | 'STEEL' | 'FUEL' | 'PAPER'
  | 'LUXURY_GOODS' | 'MEDICINE' | 'DATA' | 'CONTRABAND';

export interface ConstructionRecipe {
  key: string;
  typeKey: string;
  materials: Array<{ resourceType: ConstructionResourceType; quantity: number }>;
}

export const CONSTRUCTION_STATUS_UNDER_CONSTRUCTION = 'UNDER_CONSTRUCTION';
export const CONSTRUCTION_STATUS_COMPLETED = 'COMPLETED';

export const CONSTRUCTION_DURATIONS_MINUTES: Record<string, number> = {
  lemonade: 5,
  epicerie: 15,
  juterie: 10,
  restaurant: 30,
  coffee_shop: 20,
  startup: 45,
  agency: 40,
  formation: 25,
  transfer: 30,
  youtube: 20,
  medecins: 35,
  horse_business: 45,
  bank: 90,
  illegal_market: 15,
  law_firm: 50,
};

export function getConstructionDurationMs(typeKey: string): number {
  return (CONSTRUCTION_DURATIONS_MINUTES[typeKey] ?? 30) * 60 * 1000;
}

const BASE_COMMERCE = [
  { resourceType: 'WOOD', quantity: 12 },
  { resourceType: 'STONE', quantity: 8 },
] satisfies ConstructionRecipe['materials'];

export const BUSINESS_CONSTRUCTION_RECIPES: Record<string, ConstructionRecipe> = {
  lemonade: {
    key: 'build_lemonade',
    typeKey: 'lemonade',
    materials: [
      { resourceType: 'WOOD', quantity: 8 },
      { resourceType: 'FOOD', quantity: 10 },
    ],
  },
  epicerie: {
    key: 'build_epicerie',
    typeKey: 'epicerie',
    materials: [
      ...BASE_COMMERCE,
      { resourceType: 'FOOD', quantity: 18 },
      { resourceType: 'PAPER', quantity: 6 },
    ],
  },
  restaurant: {
    key: 'build_restaurant',
    typeKey: 'restaurant',
    materials: [
      { resourceType: 'WOOD', quantity: 18 },
      { resourceType: 'STONE', quantity: 14 },
      { resourceType: 'CONCRETE', quantity: 8 },
      { resourceType: 'FOOD', quantity: 20 },
    ],
  },
  coffee_shop: {
    key: 'build_coffee_shop',
    typeKey: 'coffee_shop',
    materials: [
      ...BASE_COMMERCE,
      { resourceType: 'CLOTH', quantity: 8 },
      { resourceType: 'FOOD', quantity: 16 },
    ],
  },
  startup: {
    key: 'build_startup',
    typeKey: 'startup',
    materials: [
      { resourceType: 'CONCRETE', quantity: 18 },
      { resourceType: 'STEEL', quantity: 10 },
      { resourceType: 'DATA', quantity: 12 },
      { resourceType: 'FUEL', quantity: 6 },
    ],
  },
  agency: {
    key: 'build_agency',
    typeKey: 'agency',
    materials: [
      { resourceType: 'CONCRETE', quantity: 14 },
      { resourceType: 'PAPER', quantity: 14 },
      { resourceType: 'LUXURY_GOODS', quantity: 6 },
    ],
  },
  formation: {
    key: 'build_formation',
    typeKey: 'formation',
    materials: [
      { resourceType: 'WOOD', quantity: 10 },
      { resourceType: 'PAPER', quantity: 22 },
      { resourceType: 'DATA', quantity: 6 },
    ],
  },
  transfer: {
    key: 'build_transfer',
    typeKey: 'transfer',
    materials: [
      { resourceType: 'CONCRETE', quantity: 10 },
      { resourceType: 'STEEL', quantity: 8 },
      { resourceType: 'PAPER', quantity: 12 },
    ],
  },
  youtube: {
    key: 'build_youtube',
    typeKey: 'youtube',
    materials: [
      { resourceType: 'WOOD', quantity: 8 },
      { resourceType: 'DATA', quantity: 12 },
      { resourceType: 'PAPER', quantity: 10 },
    ],
  },
  medecins: {
    key: 'build_medecins',
    typeKey: 'medecins',
    materials: [
      { resourceType: 'CONCRETE', quantity: 12 },
      { resourceType: 'STEEL', quantity: 6 },
      { resourceType: 'MEDICINE', quantity: 14 },
    ],
  },
  horse_business: {
    key: 'build_horse_business',
    typeKey: 'horse_business',
    materials: [
      { resourceType: 'WOOD', quantity: 22 },
      { resourceType: 'STONE', quantity: 12 },
      { resourceType: 'FOOD', quantity: 18 },
      { resourceType: 'CLOTH', quantity: 8 },
    ],
  },
  bank: {
    key: 'build_bank',
    typeKey: 'bank',
    materials: [
      { resourceType: 'CONCRETE', quantity: 30 },
      { resourceType: 'STEEL', quantity: 18 },
      { resourceType: 'PAPER', quantity: 20 },
      { resourceType: 'DATA', quantity: 12 },
    ],
  },
  illegal_market: {
    key: 'build_illegal_market',
    typeKey: 'illegal_market',
    materials: [
      { resourceType: 'WOOD', quantity: 12 },
      { resourceType: 'CLOTH', quantity: 8 },
      { resourceType: 'CONTRABAND', quantity: 10 },
    ],
  },
  law_firm: {
    key: 'build_law_firm',
    typeKey: 'law_firm',
    materials: [
      { resourceType: 'CONCRETE', quantity: 10 },
      { resourceType: 'PAPER', quantity: 24 },
      { resourceType: 'DATA', quantity: 4 },
    ],
  },
};

export function getConstructionRecipe(typeKey: string): ConstructionRecipe | null {
  return BUSINESS_CONSTRUCTION_RECIPES[typeKey] ?? null;
}

export function isConstructionActive(project: { status?: string | null; completesAt?: Date | null } | null | undefined) {
  if (!project) return false;
  if (project.status !== CONSTRUCTION_STATUS_UNDER_CONSTRUCTION) return false;
  if (project.completesAt && project.completesAt <= new Date()) return false;
  return true;
}

export function getConstructionProgress(project: { materials?: Array<{ requiredQuantity: number; deliveredQuantity: number }> } | null | undefined) {
  const materials = project?.materials ?? [];
  const required = materials.reduce((sum, material) => sum + material.requiredQuantity, 0);
  const delivered = materials.reduce((sum, material) => sum + Math.min(material.deliveredQuantity, material.requiredQuantity), 0);
  return {
    required,
    delivered,
    percent: required > 0 ? Math.min(100, Math.round((delivered / required) * 100)) : 100,
    complete: required > 0 && delivered >= required,
  };
}

export function serializeConstructionProject(project: any) {
  if (!project) return null;
  const materials = (project.materials ?? []).map((material: any) => ({
    id: material.id,
    projectId: material.projectId,
    resourceType: material.resourceType,
    requiredQuantity: material.requiredQuantity,
    deliveredQuantity: material.deliveredQuantity,
  }));
  const progress = getConstructionProgress({ materials });
  return {
    id: project.id,
    businessId: project.businessId,
    typeKey: project.typeKey,
    recipeKey: project.recipeKey,
    status: project.status,
    startedAt: project.startedAt ? project.startedAt.toISOString() : null,
    completesAt: project.completesAt ? project.completesAt.toISOString() : null,
    completedAt: project.completedAt ? project.completedAt.toISOString() : null,
    materials,
    progress,
  };
}
