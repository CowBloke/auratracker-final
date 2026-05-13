import type { PrismaClient } from '@prisma/client';
import { io, prisma } from '../../server.js';
import { emitSharedBalanceUpdatesForUserIds } from '../../utils/shared-balance.js';
import { BUSINESS_TYPE_MAP } from './config.js';
import {
  getBusinessInputRequirements,
  getGlobalMarketUnitPrice,
  getResourceBasePrice,
  getSupplyProfiles,
  type YouEconomyResourceType,
} from './economy.js';
import { isBusinessManager } from './service.js';

type ResourceType = YouEconomyResourceType;

type ResourceActionKind = 'PRODUCE' | 'OPERATE' | 'MAINTAIN';

type ResourceCost = {
  resourceType: ResourceType;
  quantity: number;
};

type ResourceOutput = {
  resourceType: ResourceType;
  quantity: number;
};

type ResourceActionDefinition = {
  key: string;
  kind: ResourceActionKind;
  label: string;
  description: string;
  moneyCost: number;
  resourceCosts: ResourceCost[];
  outputs: ResourceOutput[];
  rewardMoney: number;
  satisfactionDelta: number;
};

type ActionSourceInput =
  | { kind: 'inventory'; businessId: string }
  | { kind: 'offer'; offerId: string };

const USER_PREVIEW_SELECT = {
  id: true,
  username: true,
  firstName: true,
  profilePicture: true,
  bio: true,
  aura: true,
  money: true,
} as const;

const RAW_RESOURCES = new Set<ResourceType>(['WOOD', 'STONE', 'IRON', 'FOOD', 'CLOTH']);

const BUSINESS_FALLBACK_INPUTS: Record<string, ResourceCost[]> = {
  farm: [{ resourceType: 'FUEL', quantity: 1 }],
  sawmill: [{ resourceType: 'FUEL', quantity: 1 }],
  quarry: [{ resourceType: 'FUEL', quantity: 1 }],
  iron_mine: [{ resourceType: 'FUEL', quantity: 2 }],
  fuel_refinery: [{ resourceType: 'IRON', quantity: 1 }],
  textile_mill: [{ resourceType: 'FUEL', quantity: 1 }],
  bank: [{ resourceType: 'DATA', quantity: 2 }, { resourceType: 'PAPER', quantity: 1 }],
  transfer: [{ resourceType: 'DATA', quantity: 1 }],
  law_firm: [{ resourceType: 'PAPER', quantity: 2 }],
  supreme_court: [{ resourceType: 'PAPER', quantity: 3 }],
};

const RESOURCE_INPUT_RECIPES: Partial<Record<ResourceType, Array<{ resourceType: ResourceType; ratio: number }>>> = {
  CONCRETE: [{ resourceType: 'STONE', ratio: 0.5 }],
  STEEL: [{ resourceType: 'IRON', ratio: 0.5 }],
  FUEL: [{ resourceType: 'IRON', ratio: 0.2 }],
  PAPER: [{ resourceType: 'WOOD', ratio: 0.4 }],
  LUXURY_GOODS: [{ resourceType: 'CLOTH', ratio: 0.5 }, { resourceType: 'PAPER', ratio: 0.2 }],
  MEDICINE: [{ resourceType: 'FOOD', ratio: 0.4 }],
  DATA: [{ resourceType: 'PAPER', ratio: 0.25 }],
  CONTRABAND: [{ resourceType: 'FUEL', ratio: 0.4 }],
};

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function mergeResourceCosts(costs: ResourceCost[]) {
  const byResource = new Map<ResourceType, number>();
  for (const cost of costs) {
    if (cost.quantity <= 0) continue;
    byResource.set(cost.resourceType, (byResource.get(cost.resourceType) ?? 0) + cost.quantity);
  }
  return Array.from(byResource.entries()).map(([resourceType, quantity]) => ({ resourceType, quantity }));
}

function getProductionInputs(resourceType: ResourceType, outputQuantity: number) {
  const recipe = RESOURCE_INPUT_RECIPES[resourceType] ?? [];
  return mergeResourceCosts(recipe.map((entry) => ({
    resourceType: entry.resourceType,
    quantity: Math.max(1, Math.ceil(outputQuantity * entry.ratio)),
  })));
}

function getOperationInputs(typeKey: string, level: number): ResourceCost[] {
  const configured = getBusinessInputRequirements(typeKey).map((entry) => ({
    resourceType: toResourceType(entry.resourceType),
    quantity: Math.max(1, entry.dailyQuantity),
  }));
  if (configured.length > 0) return mergeResourceCosts(configured);

  const fallback = BUSINESS_FALLBACK_INPUTS[typeKey];
  if (fallback) return fallback.map((entry) => ({
    resourceType: entry.resourceType,
    quantity: Math.max(1, entry.quantity),
  }));

  return [{ resourceType: 'PAPER', quantity: Math.max(1, level) }];
}

function getActionMoneyBase(business: { monthlyRevenue: number; monthlyExpenses: number; typeKey: string }) {
  const type = BUSINESS_TYPE_MAP.get(business.typeKey);
  const monthlyRevenue = business.monthlyRevenue || type?.monthlyRevenue || 0;
  const monthlyExpenses = business.monthlyExpenses || type?.monthlyExpenses || 0;
  return Math.max(25, Math.round(monthlyExpenses / 30) + Math.round(monthlyRevenue / 90));
}

async function ensureResourceActionInventories(db: PrismaClient, businesses: Array<{ id: string; typeKey: string }>) {
  const writes = businesses.flatMap((business) => {
    const profilesByResource = new Map<ResourceType, { resourceType: ResourceType; rate: number; capacity: number }>();

    for (const profile of getSupplyProfiles(business.typeKey)) {
      profilesByResource.set(profile.resourceType, {
        resourceType: profile.resourceType,
        rate: profile.rate,
        capacity: profile.capacity,
      });
      for (const input of getProductionInputs(profile.resourceType, Math.max(4, profile.rate * 4))) {
        const existing = profilesByResource.get(input.resourceType);
        profilesByResource.set(input.resourceType, {
          resourceType: input.resourceType,
          rate: existing?.rate ?? 0,
          capacity: Math.max(existing?.capacity ?? 0, input.quantity * 12, 40),
        });
      }
    }

    for (const input of getOperationInputs(business.typeKey, BUSINESS_TYPE_MAP.get(business.typeKey)?.level ?? 1)) {
      const existing = profilesByResource.get(input.resourceType);
      profilesByResource.set(input.resourceType, {
        resourceType: input.resourceType,
        rate: existing?.rate ?? 0,
        capacity: Math.max(existing?.capacity ?? 0, input.quantity * 14, 40),
      });
    }

    return Array.from(profilesByResource.values()).map((profile) =>
      db.businessResourceInventory.upsert({
        where: {
          businessId_resourceType: {
            businessId: business.id,
            resourceType: profile.resourceType,
          },
        },
        update: {
          capacity: profile.capacity,
          productionRatePerHour: profile.rate,
        },
        create: {
          businessId: business.id,
          resourceType: profile.resourceType,
          quantity: 0,
          capacity: profile.capacity,
          productionRatePerHour: profile.rate,
        },
      }),
    );
  });

  if (writes.length > 0) await Promise.all(writes);
}

function buildResourceActions(business: {
  typeKey: string;
  monthlyRevenue: number;
  monthlyExpenses: number;
  satisfaction: number;
}) {
  const type = BUSINESS_TYPE_MAP.get(business.typeKey);
  const level = type?.level ?? 1;
  const actions: ResourceActionDefinition[] = [];

  for (const profile of getSupplyProfiles(business.typeKey)) {
    if (profile.rate <= 0) continue;
    const outputQuantity = Math.max(4, Math.min(60, profile.rate * 4));
    const unitCostMultiplier = RAW_RESOURCES.has(profile.resourceType) ? 0.42 : 0.34;
    const setupFee = Math.max(15, Math.round(getActionMoneyBase(business) * 0.35));
    const moneyCost = Math.max(10, Math.round((profile.price * outputQuantity * unitCostMultiplier) + setupFee));
    actions.push({
      key: `produce:${profile.resourceType}`,
      kind: 'PRODUCE',
      label: `Produire ${profile.resourceType}`,
      description: `Ajoute ${outputQuantity} unites au stock du business. La production coute maintenant de la tresorerie.`,
      moneyCost,
      resourceCosts: getProductionInputs(profile.resourceType, outputQuantity),
      outputs: [{ resourceType: profile.resourceType, quantity: outputQuantity }],
      rewardMoney: 0,
      satisfactionDelta: 0,
    });
  }

  const operationInputs = getOperationInputs(business.typeKey, level);
  const operationMoneyCost = getActionMoneyBase(business);
  const operationReward = Math.max(0, Math.round((business.monthlyRevenue || type?.monthlyRevenue || 0) / 30));
  actions.push({
    key: 'operate:daily',
    kind: 'OPERATE',
    label: 'Faire tourner le business',
    description: 'Consomme les intrants choisis, paie les frais du jour et encaisse les recettes immediates.',
    moneyCost: operationMoneyCost,
    resourceCosts: operationInputs,
    outputs: [],
    rewardMoney: operationReward,
    satisfactionDelta: 0,
  });

  const maintainCost = Math.max(20, Math.round(operationMoneyCost * 0.65));
  actions.push({
    key: 'maintain:quality',
    kind: 'MAINTAIN',
    label: 'Ameliorer le service',
    description: 'Consomme quelques fournitures pour stabiliser la qualite et la satisfaction.',
    moneyCost: maintainCost,
    resourceCosts: operationInputs.slice(0, 1).map((entry) => ({
      resourceType: entry.resourceType,
      quantity: Math.max(1, Math.ceil(entry.quantity / 2)),
    })),
    outputs: [],
    rewardMoney: 0,
    satisfactionDelta: business.satisfaction >= 100 ? 0 : 1,
  });

  return actions;
}

function serializeInventory(entry: any) {
  return {
    id: entry.id,
    businessId: entry.businessId,
    resourceType: entry.resourceType,
    quantity: entry.quantity,
    capacity: entry.capacity,
    productionRatePerHour: entry.productionRatePerHour,
    globalMarketUnitPrice: getGlobalMarketUnitPrice(entry.business?.typeKey ?? '', entry.resourceType),
    lastProducedAt: serializeDate(entry.lastProducedAt),
  };
}

function serializeActionBusiness(business: any) {
  const type = BUSINESS_TYPE_MAP.get(business.typeKey);
  return {
    id: business.id,
    name: business.name,
    typeKey: business.typeKey,
    typeLabel: type?.label ?? business.typeKey,
    ownerId: business.ownerId,
    owner: business.owner,
    treasuryMoney: Number(business.treasuryMoney ?? 0),
    monthlyRevenue: business.monthlyRevenue,
    monthlyExpenses: business.monthlyExpenses,
    satisfaction: business.satisfaction,
    underConstruction: Boolean(business.constructionProject && business.constructionProject.status === 'UNDER_CONSTRUCTION'),
    inventories: business.resourceInventories.map(serializeInventory),
    actions: buildResourceActions(business),
  };
}

function serializeSourceOptions(businesses: any[], offers: any[]) {
  const options = [];
  for (const business of businesses) {
    for (const inventory of business.resourceInventories) {
      options.push({
        id: `inventory:${business.id}:${inventory.resourceType}`,
        kind: 'inventory' as const,
        resourceType: inventory.resourceType,
        businessId: business.id,
        businessName: business.name,
        ownerName: business.owner?.username ?? 'vous',
        quantity: inventory.quantity,
        unitPrice: Math.max(1, Math.floor(getResourceBasePrice(business.typeKey, inventory.resourceType) * 0.05)),
        autoAccept: true,
      });
    }
  }

  for (const offer of offers) {
    const inventory = offer.business?.resourceInventories.find((entry: any) => entry.resourceType === offer.resourceType);
    options.push({
      id: offer.id,
      kind: 'offer' as const,
      resourceType: offer.resourceType,
      businessId: offer.businessId,
      businessName: offer.business?.name ?? 'Business',
      ownerName: offer.business?.owner?.username ?? 'joueur',
      quantity: inventory?.quantity ?? 0,
      unitPrice: offer.unitPrice,
      autoAccept: offer.autoAccept,
    });
  }

  return options.sort((a, b) =>
    String(a.resourceType).localeCompare(String(b.resourceType))
      || a.unitPrice - b.unitPrice
      || String(a.businessName).localeCompare(String(b.businessName))
  );
}

export async function getResourceActionState(userId: string) {
  const accessibleBusinesses = await prisma.business.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId, status: 'ACTIVE' } } },
      ],
    },
    select: { id: true, typeKey: true },
  });
  await ensureResourceActionInventories(prisma, accessibleBusinesses);

  const businesses = await prisma.business.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId, status: 'ACTIVE' } } },
      ],
    },
    include: {
      owner: { select: USER_PREVIEW_SELECT },
      resourceInventories: { orderBy: { resourceType: 'asc' } },
      constructionProject: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const offers = await prisma.businessSupplyOffer.findMany({
    where: { isActive: true },
    include: {
      business: {
        include: {
          owner: { select: USER_PREVIEW_SELECT },
          resourceInventories: true,
        },
      },
    },
    orderBy: [{ resourceType: 'asc' }, { unitPrice: 'asc' }],
  });

  return {
    businesses: businesses.map(serializeActionBusiness),
    sourceOptions: serializeSourceOptions(businesses, offers),
  };
}

function parseActionSources(input: unknown): Record<string, ActionSourceInput> {
  if (!input || typeof input !== 'object') return {};
  const sources: Record<string, ActionSourceInput> = {};
  for (const [resourceType, value] of Object.entries(input as Record<string, any>)) {
    if (!value || typeof value !== 'object') continue;
    if (value.kind === 'inventory') {
      sources[resourceType] = { kind: 'inventory', businessId: String(value.businessId ?? '') };
    }
    if (value.kind === 'offer') {
      sources[resourceType] = { kind: 'offer', offerId: String(value.offerId ?? '') };
    }
  }
  return sources;
}

function toResourceType(value: string): ResourceType {
  return value as ResourceType;
}

export async function runResourceAction(userId: string, businessId: string, input: { actionKey: string; sources?: unknown }) {
  const actionBusiness = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, typeKey: true },
  });
  if (actionBusiness) {
    await ensureResourceActionInventories(prisma, [actionBusiness]);
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: { select: USER_PREVIEW_SELECT },
      resourceInventories: true,
      constructionProject: true,
    },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('BUSINESS_EDIT_FORBIDDEN');
  if (business.constructionProject?.status === 'UNDER_CONSTRUCTION') throw new Error('BUSINESS_UNDER_CONSTRUCTION');

  const action = buildResourceActions({
    typeKey: business.typeKey,
    monthlyRevenue: business.monthlyRevenue,
    monthlyExpenses: business.monthlyExpenses,
    satisfaction: business.satisfaction,
  }).find((entry) => entry.key === input.actionKey);
  if (!action) throw new Error('RESOURCE_ACTION_NOT_FOUND');

  const sources = parseActionSources(input.sources);
  const resourceCosts = mergeResourceCosts(action.resourceCosts);
  for (const cost of resourceCosts) {
    if (!sources[cost.resourceType]) {
      const ownInventory = business.resourceInventories.find((entry) => entry.resourceType === cost.resourceType);
      if (ownInventory && ownInventory.quantity >= cost.quantity) {
        sources[cost.resourceType] = { kind: 'inventory', businessId: business.id };
      } else {
        throw new Error('RESOURCE_ACTION_SOURCE_REQUIRED');
      }
    }
  }

  const balanceUserIds = new Set<string>();
  let sourceMoneyCost = 0;
  const consumed: ResourceCost[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.business.findUnique({
      where: { id: business.id },
      select: { treasuryMoney: true, satisfaction: true, ownerId: true },
    });
    if (!target) throw new Error('BUSINESS_NOT_FOUND');

    const inventoryUpdates: Array<Promise<unknown>> = [];
    const supplierBusinessPayments = new Map<string, number>();
    const supplierUserIds = new Set<string>();

    for (const cost of resourceCosts) {
      const source = sources[cost.resourceType];
      if (!source) throw new Error('RESOURCE_ACTION_SOURCE_REQUIRED');

      if (source.kind === 'inventory') {
        const sourceBusiness = await tx.business.findUnique({
          where: { id: source.businessId },
          select: { id: true, ownerId: true, typeKey: true },
        });
        if (!sourceBusiness || !(await isBusinessManager(sourceBusiness.id, userId, sourceBusiness.ownerId))) {
          throw new Error('RESOURCE_ACTION_SOURCE_INVALID');
        }
        const inventory = await tx.businessResourceInventory.findUnique({
          where: {
            businessId_resourceType: {
              businessId: source.businessId,
              resourceType: cost.resourceType,
            },
          },
        });
        if (!inventory || inventory.quantity < cost.quantity) throw new Error('RESOURCE_ACTION_SOURCE_SHORTAGE');

        inventoryUpdates.push(tx.businessResourceInventory.update({
          where: { id: inventory.id },
          data: { quantity: { decrement: cost.quantity } },
        }));

        if (source.businessId !== business.id) {
          sourceMoneyCost += Math.max(1, Math.floor(getResourceBasePrice(sourceBusiness.typeKey, cost.resourceType) * 0.05)) * cost.quantity;
        }
        consumed.push({ resourceType: cost.resourceType, quantity: cost.quantity });
        continue;
      }

      const offer = await tx.businessSupplyOffer.findUnique({
        where: { id: source.offerId },
        include: {
          business: { select: { id: true, ownerId: true, name: true } },
        },
      });
      if (!offer || !offer.isActive || offer.resourceType !== cost.resourceType || offer.businessId === business.id) {
        throw new Error('RESOURCE_ACTION_SOURCE_INVALID');
      }
      const inventory = await tx.businessResourceInventory.findUnique({
        where: {
          businessId_resourceType: {
            businessId: offer.businessId,
            resourceType: offer.resourceType,
          },
        },
      });
      if (!inventory || inventory.quantity < cost.quantity) throw new Error('RESOURCE_ACTION_SOURCE_SHORTAGE');

      const payment = offer.unitPrice * cost.quantity;
      sourceMoneyCost += payment;
      supplierBusinessPayments.set(offer.businessId, (supplierBusinessPayments.get(offer.businessId) ?? 0) + payment);
      supplierUserIds.add(offer.business.ownerId);
      inventoryUpdates.push(tx.businessResourceInventory.update({
        where: { id: inventory.id },
        data: { quantity: { decrement: cost.quantity } },
      }));
      consumed.push({ resourceType: cost.resourceType, quantity: cost.quantity });
    }

    const totalMoneyCost = action.moneyCost + sourceMoneyCost;
    if (Number(target.treasuryMoney) < totalMoneyCost) throw new Error('BUSINESS_TREASURY_TOO_LOW');

    for (const output of action.outputs) {
      const existing = await tx.businessResourceInventory.findUnique({
        where: {
          businessId_resourceType: {
            businessId: business.id,
            resourceType: output.resourceType,
          },
        },
      });
      const capacity = existing?.capacity ?? Math.max(80, output.quantity * 5);
      const currentQuantity = existing?.quantity ?? 0;
      if (currentQuantity + output.quantity > capacity) throw new Error('RESOURCE_ACTION_OUTPUT_FULL');
    }

    await Promise.all(inventoryUpdates);
    await tx.business.update({
      where: { id: business.id },
      data: {
        treasuryMoney: { decrement: totalMoneyCost },
        ...(action.satisfactionDelta !== 0
          ? { satisfaction: Math.max(0, Math.min(100, target.satisfaction + action.satisfactionDelta)) }
          : {}),
      },
    });

    for (const [supplierBusinessId, payment] of supplierBusinessPayments.entries()) {
      await tx.business.update({
        where: { id: supplierBusinessId },
        data: { treasuryMoney: { increment: payment } },
      });
      await tx.businessTransaction.create({
        data: {
          businessId: supplierBusinessId,
          type: 'RESOURCE_ACTION_SALE',
          amount: BigInt(payment),
          label: `Vente de ressources pour ${action.label}`,
          actorId: userId,
        },
      });
    }

    for (const output of action.outputs) {
      const profile = getSupplyProfiles(business.typeKey).find((entry) => entry.resourceType === output.resourceType);
      await tx.businessResourceInventory.upsert({
        where: {
          businessId_resourceType: {
            businessId: business.id,
            resourceType: output.resourceType,
          },
        },
        update: { quantity: { increment: output.quantity } },
        create: {
          businessId: business.id,
          resourceType: output.resourceType,
          quantity: output.quantity,
          capacity: profile?.capacity ?? Math.max(80, output.quantity * 5),
          productionRatePerHour: profile?.rate ?? 0,
        },
      });
    }

    if (action.rewardMoney > 0) {
      await tx.business.update({
        where: { id: business.id },
        data: { treasuryMoney: { increment: action.rewardMoney } },
      });
    }

    const netAmount = action.rewardMoney - totalMoneyCost;
    await tx.businessTransaction.create({
      data: {
        businessId: business.id,
        type: 'RESOURCE_ACTION',
        amount: BigInt(netAmount),
        label: `${action.label}: cout ${totalMoneyCost.toLocaleString('fr-FR')}, gain ${action.rewardMoney.toLocaleString('fr-FR')}`,
        actorId: userId,
      },
    });

    balanceUserIds.add(target.ownerId);
    for (const userIdToNotify of supplierUserIds) balanceUserIds.add(userIdToNotify);

    return {
      businessId: business.id,
      actionKey: action.key,
      moneyCost: action.moneyCost,
      sourceMoneyCost,
      totalMoneyCost,
      rewardMoney: action.rewardMoney,
      satisfactionDelta: action.satisfactionDelta,
      consumed,
      outputs: action.outputs,
    };
  });

  io.emit('you:supply-updated', { businessId: business.id });
  await emitSharedBalanceUpdatesForUserIds(prisma as PrismaClient, Array.from(balanceUserIds));
  return result;
}
