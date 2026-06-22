import type { PrismaClient } from '@prisma/client';
import { io, prisma } from '../../server.js';
import { emitSharedBalanceUpdatesForUserIds } from '../../utils/shared-balance.js';
import { BUSINESS_TYPES, BUSINESS_TYPE_MAP } from './config.js';
import {
  CONSTRUCTION_STATUS_UNDER_CONSTRUCTION,
  getConstructionRecipe,
  isConstructionActive,
  serializeConstructionProject,
} from './construction.js';
import {
  getBusinessInputRequirements,
  getBusinessSupplyProfiles,
  getGlobalMarketUnitPrice,
  getResourceBasePrice,
  getSupplyProfiles,
  type YouEconomyResourceType,
} from './economy.js';
import { autoListOutput } from './resource-market.js';
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

export type ResourceActionDefinition = {
  key: string;
  kind: ResourceActionKind;
  label: string;
  description: string;
  moneyCost: number;
  resourceCosts: ResourceCost[];
  outputs: ResourceOutput[];
  rewardMoney: number;
  satisfactionDelta: number;
  durationMs?: number;
};

export interface ActiveResourceAction {
  id: string;
  businessId: string;
  ownerId: string;
  actionKey: string;
  startedAt: Date;
  endsAt: Date;
  outputs: ResourceOutput[];
  rewardMoney: number;
  label: string;
  userId: string;
}

export interface QueuedResourceAction {
  businessId: string;
  actionKey: string;
  outputs: ResourceOutput[];
  rewardMoney: number;
  label: string;
  userId: string;
  durationMs: number;
}

export const activeResourceActions = new Map<string, ActiveResourceAction>();
export const queuedResourceActions = new Map<string, QueuedResourceAction[]>();

export interface BusinessUpgrades {
  productionSpeedLvl: number;
  stockSizeLvl: number;
  queueLvl: number;
}

export const UPGRADE_CONFIGS = {
  productionSpeed: [
    { level: 0, label: 'Standard', multiplier: 1.0, cost: 0, desc: 'Vitesse de production normale.' },
    { level: 1, label: 'Optimisé (+100%)', multiplier: 2.0, cost: 15000, desc: 'Production 2x plus rapide.' },
    { level: 2, label: 'Turbine (+200%)', multiplier: 3.0, cost: 45000, desc: 'Production 3x plus rapide (300% au total).' },
  ],
  stockSize: [
    { level: 0, label: 'Standard', multiplier: 1.0, cost: 0, desc: 'Capacité de stockage par défaut.' },
    { level: 1, label: 'Élargi (+50%)', multiplier: 1.5, cost: 10000, desc: 'Augmente le stockage de 50%.' },
    { level: 2, label: 'Entrepôt (+100%)', multiplier: 2.0, cost: 25000, desc: 'Augmente le stockage de 100% (2x).' },
    { level: 3, label: 'Hangar Géant (+200%)', multiplier: 3.0, cost: 60000, desc: 'Augmente le stockage de 200% (3x).' },
  ],
  queue: [
    { level: 0, label: 'Manuel', queueSize: 1, cost: 0, desc: 'Une action à la fois.' },
    { level: 1, label: 'Double queue', queueSize: 2, cost: 20000, desc: "Permet de lancer 1 action et d'en mettre 1 en attente." },
    { level: 2, label: 'Série (5 actions)', queueSize: 5, cost: 50000, desc: "Permet d'enfiler jusqu'à 5 actions à la suite." },
    { level: 3, label: 'Production Continue', queueSize: 20, cost: 120000, desc: 'Production en continu (redémarrage auto si ingrédients disponibles).' },
  ],
};

export function getBusinessUpgrades(customDataStr: string | null | undefined): BusinessUpgrades {
  const defaultUpgrades: BusinessUpgrades = {
    productionSpeedLvl: 0,
    stockSizeLvl: 0,
    queueLvl: 0,
  };
  if (!customDataStr) return defaultUpgrades;
  try {
    const parsed = JSON.parse(customDataStr);
    return {
      productionSpeedLvl: typeof parsed.productionSpeedLvl === 'number' ? parsed.productionSpeedLvl : 0,
      stockSizeLvl: typeof parsed.stockSizeLvl === 'number' ? parsed.stockSizeLvl : 0,
      queueLvl: typeof parsed.queueLvl === 'number' ? parsed.queueLvl : 0,
    };
  } catch {
    return defaultUpgrades;
  }
}

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

// Resource inputs needed to craft each item type
const ITEM_INPUT_RECIPES: Partial<Record<string, Array<{ resourceType: ResourceType; ratio: number }>>> = {
  JUICE_ABRICOT:    [{ resourceType: 'FOOD', ratio: 0.5 }],
  JUICE_GINGEMBRE:  [{ resourceType: 'FOOD', ratio: 0.5 }],
  JUICE_PAPAYE:     [{ resourceType: 'FOOD', ratio: 0.5 }, { resourceType: 'LUXURY_GOODS', ratio: 0.25 }],
  JUICE_MALAKOUKOU: [{ resourceType: 'FOOD', ratio: 0.6 }, { resourceType: 'LUXURY_GOODS', ratio: 0.4 }],
  JUICE_GOYAVE:     [{ resourceType: 'FOOD', ratio: 0.8 }, { resourceType: 'LUXURY_GOODS', ratio: 0.5 }, { resourceType: 'MEDICINE', ratio: 0.2 }],
  ADBLOCK_TOKEN:    [{ resourceType: 'DATA', ratio: 0.5 }, { resourceType: 'PAPER', ratio: 0.3 }],
};

const PRODUCE_ACTION_LABELS: Record<string, Record<string, string>> = {
  farm:           { FOOD:         'Récolte journalière' },
  sawmill:        { WOOD:         'Coupe de bois' },
  quarry:         { STONE:        'Extraction de pierre', CONCRETE: 'Bétonner' },
  iron_mine:      { IRON:         'Extraction de fer',    STEEL:    'Fonderie (Fer → Acier)' },
  fuel_refinery:  { FUEL:         'Raffiner du carburant' },
  textile_mill:   { CLOTH:        'Production textile' },
  lemonade:       { FOOD:         'Préparer la limonade' },
  epicerie:       { LUXURY_GOODS: 'Remplir les rayons' },
  restaurant:     { FOOD:         'Service du jour' },
  coffee_shop:    { FOOD:         'Préparer les commandes', LUXURY_GOODS: 'Offre premium' },
  startup:        { DATA:         'Sprint data' },
  agency:         { LUXURY_GOODS: 'Campagne premium' },
  formation:      { PAPER:        'Créer une formation' },
  youtube:        { DATA:         'Tourner une vidéo', PAPER: 'Rédiger un script' },
  medecins:       { MEDICINE:     'Préparer les ordonnances' },
  illegal_market: { CONTRABAND:   'Gérer les stocks' },
  horse_business: { HORSES:       'Élever des chevaux' },
  juterie: {
    JUICE_ABRICOT:    "Presser des abricots",
    JUICE_GINGEMBRE:  'Presser du gingembre',
    JUICE_PAPAYE:     'Presser des papayes',
    JUICE_MALAKOUKOU: 'Préparer le jus de malakoukou',
    JUICE_GOYAVE:     'Presser les goyaves (rare)',
  },
  labo_pub: {
    ADBLOCK_TOKEN: 'Compiler un ADblock',
  },
};

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
  CONCRETE:     [{ resourceType: 'STONE', ratio: 0.5 }],
  STEEL:        [{ resourceType: 'IRON', ratio: 0.5 }],
  FUEL:         [{ resourceType: 'IRON', ratio: 0.2 }],
  PAPER:        [{ resourceType: 'WOOD', ratio: 0.4 }],
  LUXURY_GOODS: [{ resourceType: 'CLOTH', ratio: 0.5 }, { resourceType: 'PAPER', ratio: 0.2 }],
  MEDICINE:     [{ resourceType: 'FOOD', ratio: 0.4 }],
  DATA:         [{ resourceType: 'PAPER', ratio: 0.25 }],
  CONTRABAND:   [{ resourceType: 'FUEL', ratio: 0.4 }],
  HORSES:       [{ resourceType: 'FOOD', ratio: 0.5 }],
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
  const recipe = ITEM_INPUT_RECIPES[resourceType] ?? RESOURCE_INPUT_RECIPES[resourceType] ?? [];
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

async function ensureResourceActionInventories(db: PrismaClient, businesses: Array<{ id: string; typeKey: string; customData?: string | null }>) {
  const writes = businesses.flatMap((business) => {
    const profilesByResource = new Map<ResourceType, { resourceType: ResourceType; rate: number; capacity: number }>();

    for (const profile of getBusinessSupplyProfiles(business.typeKey, business.customData)) {
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
  customData?: string | null;
}) {
  const actions: ResourceActionDefinition[] = [];
  const upgrades = getBusinessUpgrades(business.customData);
  const speedConfig = UPGRADE_CONFIGS.productionSpeed[upgrades.productionSpeedLvl] ?? UPGRADE_CONFIGS.productionSpeed[0];

  for (const profile of getBusinessSupplyProfiles(business.typeKey, business.customData)) {
    if (profile.rate <= 0) continue;
    
    let outputQuantity = Math.max(4, Math.min(60, profile.rate * 4));
    let rewardMoney = 0;
    
    if (profile.resourceType === 'HORSES') {
      outputQuantity = 2;
      rewardMoney = 10000;
    }
    
    const unitCostMultiplier = RAW_RESOURCES.has(profile.resourceType) ? 0.42 : 0.34;
    const setupFee = Math.max(15, Math.round(getActionMoneyBase(business) * 0.35));
    const moneyCost = Math.max(1000, Math.round((profile.price * outputQuantity * unitCostMultiplier) + setupFee));
    const label = PRODUCE_ACTION_LABELS[business.typeKey]?.[profile.resourceType]
      ?? `Produire ${profile.resourceType}`;

    const baseDuration = profile.resourceType === 'HORSES' ? 60000 : 30000;
    const finalDurationMs = Math.round(baseDuration / speedConfig.multiplier);

    actions.push({
      key: `produce:${profile.resourceType}`,
      kind: 'PRODUCE',
      label,
      description: profile.resourceType === 'HORSES'
        ? `Ajoute ${outputQuantity} chevaux au stock et offre ${rewardMoney.toLocaleString('fr-FR')}€.`
        : `Ajoute ${outputQuantity} unites au stock.`,
      moneyCost,
      resourceCosts: getProductionInputs(profile.resourceType, outputQuantity),
      outputs: [{ resourceType: profile.resourceType, quantity: outputQuantity }],
      rewardMoney,
      satisfactionDelta: 0,
      durationMs: finalDurationMs,
    });
  }

  return actions;
}

function serializeInventory(entry: any, business?: any) {
  const customData = business?.customData ?? entry.business?.customData;
  const upgrades = getBusinessUpgrades(customData);
  const stockConfig = UPGRADE_CONFIGS.stockSize[upgrades.stockSizeLvl] ?? UPGRADE_CONFIGS.stockSize[0];
  const upgradedCapacity = Math.round(entry.capacity * stockConfig.multiplier);

  return {
    id: entry.id,
    businessId: entry.businessId,
    resourceType: entry.resourceType,
    quantity: entry.quantity,
    capacity: upgradedCapacity,
    productionRatePerHour: entry.productionRatePerHour,
    autoSellEnabled: Boolean(entry.autoSellEnabled),
    autoSellPrice: Number(entry.autoSellPrice ?? 0),
    globalMarketUnitPrice: getGlobalMarketUnitPrice(business?.typeKey ?? entry.business?.typeKey ?? '', entry.resourceType),
    lastProducedAt: serializeDate(entry.lastProducedAt),
  };
}

function serializeActionBusiness(business: any) {
  const type = BUSINESS_TYPE_MAP.get(business.typeKey);
  const activeActions = Array.from(activeResourceActions.values())
    .filter((a) => a.businessId === business.id)
    .map((a) => ({
      id: a.id,
      actionKey: a.actionKey,
      startedAt: a.startedAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      label: a.label,
    }));

  const queue = queuedResourceActions.get(business.id) ?? [];
  const queuedActions = queue.map((q) => ({
    actionKey: q.actionKey,
    label: q.label,
  }));

  const upgrades = getBusinessUpgrades(business.customData);
  const avgRating = business.ratings && business.ratings.length > 0
    ? Math.round((business.ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / business.ratings.length) * 10) / 10
    : null;

  const cp = business.constructionProject;
  if (cp?.status === CONSTRUCTION_STATUS_UNDER_CONSTRUCTION && cp.completesAt && cp.completesAt <= new Date()) {
    prisma.businessConstructionProject.update({
      where: { id: cp.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    }).catch(() => {});
  }

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
    avgRating,
    description: business.description,
    underConstruction: isConstructionActive(business.constructionProject),
    constructionProject: serializeConstructionProject(business.constructionProject),
    inventories: business.resourceInventories.map((inv: any) => serializeInventory(inv, business)),
    actions: buildResourceActions(business),
    activeActions,
    queuedActions,
    upgrades,
    customData: business.customData,
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
        businessTypeKey: business.typeKey,
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
    const qty = inventory?.quantity ?? 0;
    if (qty <= 0) continue;
    options.push({
      id: offer.id,
      kind: 'offer' as const,
      resourceType: offer.resourceType,
      businessId: offer.businessId,
      businessTypeKey: offer.business?.typeKey ?? '',
      businessName: offer.business?.name ?? 'Business',
      ownerName: offer.business?.owner?.username ?? 'joueur',
      quantity: qty,
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

function serializeConstructionCatalog(unlockedBusinessLevel = 0, viewerIsAdmin = false) {
  return BUSINESS_TYPES
    .filter((type) =>
      (type.level === 1 || type.level <= unlockedBusinessLevel + 1)
      && (!type.isAdminOnly || viewerIsAdmin)
    )
    .map((type) => {
      const recipe = getConstructionRecipe(type.key);
      return {
        typeKey: type.key,
        label: type.label,
        category: type.category,
        description: type.description,
        minCapital: type.minCapital,
        creationFee: type.creationFee,
        totalMoneyCost: type.creationFee + (type.key === 'bank' ? 0 : type.minCapital),
        materials: recipe?.materials.map((material) => ({
          resourceType: material.resourceType,
          quantity: material.quantity,
        })) ?? [],
      };
    });
}

export async function settleActiveResourceActions() {
  const now = Date.now();
  const completedList: ActiveResourceAction[] = [];
  for (const [id, active] of activeResourceActions.entries()) {
    if (active.endsAt.getTime() <= now) {
      completedList.push(active);
      activeResourceActions.delete(id);
    }
  }

  if (completedList.length === 0) return;

  for (const active of completedList) {
    try {
      await prisma.$transaction(async (tx) => {
        const biz = await tx.business.findUnique({ where: { id: active.businessId } });
        if (!biz) return;

        for (const output of active.outputs) {
          {
            const profile = getBusinessSupplyProfiles(biz.typeKey, biz.customData).find((entry) => entry.resourceType === output.resourceType);
            const existingInv = await tx.businessResourceInventory.findUnique({
              where: { businessId_resourceType: { businessId: biz.id, resourceType: output.resourceType } },
            });
            const autoSell = existingInv?.autoSellEnabled && (existingInv.autoSellPrice ?? 0) > 0;
            if (autoSell) {
              await autoListOutput(tx, active.ownerId, biz.id, output.resourceType, output.quantity, existingInv!.autoSellPrice);
            } else {
              const baseCapacity = profile?.capacity ?? Math.max(80, output.quantity * 5);
              const upgrades = getBusinessUpgrades(biz.customData);
              const stockConfig = UPGRADE_CONFIGS.stockSize[upgrades.stockSizeLvl] ?? UPGRADE_CONFIGS.stockSize[0];
              const upgradedCapacity = Math.round(baseCapacity * stockConfig.multiplier);

              await tx.businessResourceInventory.upsert({
                where: { businessId_resourceType: { businessId: biz.id, resourceType: output.resourceType } },
                update: { quantity: { increment: output.quantity } },
                create: {
                  businessId: biz.id,
                  resourceType: output.resourceType,
                  quantity: output.quantity,
                  capacity: upgradedCapacity,
                  productionRatePerHour: profile?.rate ?? 0,
                },
              });
            }
          }
        }

        if (active.rewardMoney > 0) {
          await tx.business.update({
            where: { id: biz.id },
            data: { treasuryMoney: { increment: active.rewardMoney } },
          });
        }
      });

      // Process queue or constant production
      const queue = queuedResourceActions.get(active.businessId);
      if (queue && queue.length > 0) {
        const next = queue.shift()!;
        if (queue.length === 0) {
          queuedResourceActions.delete(active.businessId);
        } else {
          queuedResourceActions.set(active.businessId, queue);
        }

        const actionRunId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const endsAt = new Date(Date.now() + next.durationMs);
        activeResourceActions.set(actionRunId, {
          id: actionRunId,
          businessId: next.businessId,
          ownerId: active.ownerId,
          actionKey: next.actionKey,
          startedAt: new Date(),
          endsAt,
          outputs: next.outputs,
          rewardMoney: next.rewardMoney,
          label: next.label,
          userId: next.userId,
        });
      } else {
        const biz = await prisma.business.findUnique({
          where: { id: active.businessId },
          select: { customData: true, ownerId: true },
        });
        if (biz) {
          const upgrades = getBusinessUpgrades(biz.customData);
          if (upgrades.queueLvl >= 3) {
            const parsed = biz.customData ? JSON.parse(biz.customData) : {};
            const constantProductionEnabled = parsed.constantProduction?.[active.actionKey];
            if (constantProductionEnabled) {
              const lastSources = parsed.lastActionSources?.[active.actionKey];
              const payFromPersonal = parsed.lastActionPayFromPersonal?.[active.actionKey] ?? false;
              if (lastSources) {
                try {
                  await runResourceAction(active.userId, active.businessId, {
                    actionKey: active.actionKey,
                    sources: lastSources,
                    payFromPersonal,
                  });
                } catch (err: any) {
                  console.log(`Constant production stopped for ${active.businessId} action ${active.actionKey}:`, err.message);
                  const latestBiz = await prisma.business.findUnique({ where: { id: active.businessId } });
                  if (latestBiz) {
                    const latestParsed = latestBiz.customData ? JSON.parse(latestBiz.customData) : {};
                    if (!latestParsed.constantProduction) latestParsed.constantProduction = {};
                    latestParsed.constantProduction[active.actionKey] = false;
                    await prisma.business.update({
                      where: { id: active.businessId },
                      data: { customData: JSON.stringify(latestParsed) },
                    });
                  }
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to settle active resource action:', active, err);
    }
  }

  const ownerIds = Array.from(new Set(completedList.map((a) => a.ownerId)));
  await emitSharedBalanceUpdatesForUserIds(prisma as PrismaClient, ownerIds);
  io.emit('you_state_changed');
}

setInterval(() => {
  settleActiveResourceActions().catch((err) => console.error('setInterval settle active action error:', err));
}, 5000);

export async function getResourceActionState(userId: string) {
  await settleActiveResourceActions();
  const accessibleBusinesses = await prisma.business.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId, status: 'ACTIVE' } } },
      ],
    },
    select: { id: true, typeKey: true, customData: true },
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
      constructionProject: { include: { materials: true } },
      ratings: true,
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

  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { unlockedBusinessLevel: true, isAdmin: true, isSuperAdmin: true },
  });
  const unlockedBusinessLevel = viewer?.unlockedBusinessLevel ?? 0;
  const viewerIsAdmin = Boolean(viewer?.isAdmin || viewer?.isSuperAdmin);

  return {
    businesses: businesses.map(serializeActionBusiness),
    sourceOptions: serializeSourceOptions(businesses, offers),
    constructionCatalog: serializeConstructionCatalog(unlockedBusinessLevel, viewerIsAdmin),
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

export async function runResourceAction(userId: string, businessId: string, input: { actionKey: string; sources?: unknown; payFromPersonal?: boolean }) {
  await settleActiveResourceActions();
  const actionBusiness = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, typeKey: true, customData: true },
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
    customData: business.customData,
  }).find((entry) => entry.key === input.actionKey);
  if (!action) throw new Error('RESOURCE_ACTION_NOT_FOUND');

  const upgrades = getBusinessUpgrades(business.customData);
  const queueConfig = UPGRADE_CONFIGS.queue[upgrades.queueLvl] ?? UPGRADE_CONFIGS.queue[0];
  const maxQueueSize = queueConfig.queueSize - 1;

  const isAlreadyActive = Array.from(activeResourceActions.values()).some(
    (a) => a.businessId === business.id && a.actionKey === action.key
  );

  if (isAlreadyActive) {
    if (maxQueueSize <= 0) {
      throw new Error('RESOURCE_ACTION_ALREADY_ACTIVE');
    }
    const currentQueue = queuedResourceActions.get(business.id) ?? [];
    const currentQueueForAction = currentQueue.filter((q) => q.actionKey === action.key);
    if (currentQueueForAction.length >= maxQueueSize) {
      throw new Error('QUEUE_FULL');
    }
  }

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
    if (input.payFromPersonal) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { money: true },
      });
      if (!user || Number(user.money) < totalMoneyCost) throw new Error('USER_MONEY_TOO_LOW');
    } else {
      if (Number(target.treasuryMoney) < totalMoneyCost) throw new Error('BUSINESS_TREASURY_TOO_LOW');
    }

    for (const output of action.outputs) {
      const existing = await tx.businessResourceInventory.findUnique({
        where: {
          businessId_resourceType: {
            businessId: business.id,
            resourceType: output.resourceType,
          },
        },
      });
      
      const baseCapacity = existing?.capacity ?? Math.max(80, output.quantity * 5);
      const stockConfig = UPGRADE_CONFIGS.stockSize[upgrades.stockSizeLvl] ?? UPGRADE_CONFIGS.stockSize[0];
      const upgradedCapacity = Math.round(baseCapacity * stockConfig.multiplier);

      const currentQuantity = existing?.quantity ?? 0;
      if (currentQuantity + output.quantity > upgradedCapacity) throw new Error('RESOURCE_ACTION_OUTPUT_FULL');
    }

    await Promise.all(inventoryUpdates);
    if (input.payFromPersonal) {
      await tx.user.update({
        where: { id: userId },
        data: { money: { decrement: BigInt(totalMoneyCost) } },
      });
      if (action.satisfactionDelta !== 0) {
        await tx.business.update({
          where: { id: business.id },
          data: {
            satisfaction: Math.max(0, Math.min(100, target.satisfaction + action.satisfactionDelta)),
          },
        });
      }
    } else {
      await tx.business.update({
        where: { id: business.id },
        data: {
          treasuryMoney: { decrement: totalMoneyCost },
          ...(action.satisfactionDelta !== 0
            ? { satisfaction: Math.max(0, Math.min(100, target.satisfaction + action.satisfactionDelta)) }
            : {}),
        },
      });
    }

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

    const isInstant = !action.durationMs || action.durationMs <= 0;

    if (isInstant) {
      for (const output of action.outputs) {
        const profile = getBusinessSupplyProfiles(business.typeKey, business.customData).find((entry) => entry.resourceType === output.resourceType);
        const existingInv = await tx.businessResourceInventory.findUnique({
          where: { businessId_resourceType: { businessId: business.id, resourceType: output.resourceType } },
        });
        const autoSell = existingInv?.autoSellEnabled && (existingInv.autoSellPrice ?? 0) > 0;
        if (autoSell) {
          await autoListOutput(tx, business.ownerId, business.id, output.resourceType, output.quantity, existingInv!.autoSellPrice);
        } else {
          const baseCapacity = profile?.capacity ?? Math.max(80, output.quantity * 5);
          const stockConfig = UPGRADE_CONFIGS.stockSize[upgrades.stockSizeLvl] ?? UPGRADE_CONFIGS.stockSize[0];
          const upgradedCapacity = Math.round(baseCapacity * stockConfig.multiplier);

          await tx.businessResourceInventory.upsert({
            where: { businessId_resourceType: { businessId: business.id, resourceType: output.resourceType } },
            update: { quantity: { increment: output.quantity } },
            create: {
              businessId: business.id,
              resourceType: output.resourceType,
              quantity: output.quantity,
              capacity: upgradedCapacity,
              productionRatePerHour: profile?.rate ?? 0,
            },
          });
        }
      }

      if (action.rewardMoney > 0) {
        await tx.business.update({
          where: { id: business.id },
          data: { treasuryMoney: { increment: action.rewardMoney } },
        });
      }
    } else {
      if (isAlreadyActive) {
        const queue = queuedResourceActions.get(business.id) ?? [];
        queue.push({
          businessId: business.id,
          actionKey: action.key,
          outputs: action.outputs,
          rewardMoney: action.rewardMoney,
          label: action.label,
          userId,
          durationMs: action.durationMs!,
        });
        queuedResourceActions.set(business.id, queue);
      } else {
        const endsAt = new Date(Date.now() + action.durationMs!);
        const actionRunId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        activeResourceActions.set(actionRunId, {
          id: actionRunId,
          businessId: business.id,
          ownerId: business.ownerId,
          actionKey: action.key,
          startedAt: new Date(),
          endsAt,
          outputs: action.outputs,
          rewardMoney: action.rewardMoney,
          label: action.label,
          userId,
        });
      }
    }

    // Save last action sources for constant production
    const latestBiz = await tx.business.findUnique({ where: { id: business.id } });
    if (latestBiz) {
      const parsed = latestBiz.customData ? JSON.parse(latestBiz.customData) : {};
      if (!parsed.lastActionSources) parsed.lastActionSources = {};
      if (!parsed.lastActionPayFromPersonal) parsed.lastActionPayFromPersonal = {};
      parsed.lastActionSources[action.key] = input.sources;
      parsed.lastActionPayFromPersonal[action.key] = input.payFromPersonal || false;
      await tx.business.update({
        where: { id: business.id },
        data: { customData: JSON.stringify(parsed) },
      });
    }

    const netAmount = isInstant ? (action.rewardMoney - totalMoneyCost) : -totalMoneyCost;
    await tx.businessTransaction.create({
      data: {
        businessId: business.id,
        type: 'RESOURCE_ACTION',
        amount: BigInt(netAmount),
        label: isInstant
          ? `${action.label}: cout ${totalMoneyCost.toLocaleString('fr-FR')}€ ${input.payFromPersonal ? '(poche)' : '(trésorerie)'}, gain ${action.rewardMoney.toLocaleString('fr-FR')}€`
          : (isAlreadyActive
              ? `${action.label} (mis en file d'attente): cout ${totalMoneyCost.toLocaleString('fr-FR')}€ ${input.payFromPersonal ? '(poche)' : '(trésorerie)'}`
              : `${action.label} (lance): cout ${totalMoneyCost.toLocaleString('fr-FR')}€ ${input.payFromPersonal ? '(poche)' : '(trésorerie)'}, duree ${Math.round(action.durationMs! / 1000)}s`),
        actorId: userId,
      },
    });

    balanceUserIds.add(target.ownerId);
    for (const userIdToNotify of supplierUserIds) balanceUserIds.add(userIdToNotify);

    const endsAtString = (isInstant || isAlreadyActive) ? null : new Date(Date.now() + action.durationMs!).toISOString();

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
      running: !isInstant && !isAlreadyActive,
      queued: isAlreadyActive,
      endsAt: endsAtString,
    };
  });

  io.emit('you:supply-updated', { businessId: business.id });
  await emitSharedBalanceUpdatesForUserIds(prisma as PrismaClient, Array.from(balanceUserIds));
  return result;
}

export async function buyBusinessUpgrade(userId: string, businessId: string, upgradeType: 'productionSpeed' | 'stockSize' | 'queue', targetLevel: number) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, treasuryMoney: true, customData: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('BUSINESS_EDIT_FORBIDDEN');

  const config = UPGRADE_CONFIGS[upgradeType];
  if (!config) throw new Error('BUSINESS_UPGRADE_UNAVAILABLE');
  
  const upgradeLevelDef = config.find((c) => c.level === targetLevel);
  if (!upgradeLevelDef) throw new Error('BUSINESS_UPGRADE_UNAVAILABLE');

  const upgrades = getBusinessUpgrades(business.customData);
  const currentLvl = upgradeType === 'productionSpeed' 
    ? upgrades.productionSpeedLvl 
    : upgradeType === 'stockSize'
      ? upgrades.stockSizeLvl
      : upgrades.queueLvl;

  if (targetLevel <= currentLvl) throw new Error('UPGRADE_ALREADY_OWNED');
  if (targetLevel !== currentLvl + 1) throw new Error('BUSINESS_UPGRADE_UNAVAILABLE');

  const cost = upgradeLevelDef.cost;
  if (Number(business.treasuryMoney) < cost) throw new Error('BUSINESS_TREASURY_TOO_LOW');

  const parsed = business.customData ? JSON.parse(business.customData) : {};
  if (upgradeType === 'productionSpeed') parsed.productionSpeedLvl = targetLevel;
  else if (upgradeType === 'stockSize') parsed.stockSizeLvl = targetLevel;
  else if (upgradeType === 'queue') parsed.queueLvl = targetLevel;

  const result = await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: business.id },
      data: {
        treasuryMoney: { decrement: cost },
        customData: JSON.stringify(parsed),
      },
    });

    await tx.businessTransaction.create({
      data: {
        businessId: business.id,
        type: 'UPGRADE_PURCHASE',
        amount: BigInt(-cost),
        label: `Achat amélioration: ${upgradeType} (Niveau ${targetLevel})`,
        actorId: userId,
      },
    });

    return {
      upgradeType,
      level: targetLevel,
      newTreasury: Number(business.treasuryMoney) - cost,
    };
  });

  io.emit('you_state_changed');
  return result;
}

export async function toggleConstantProduction(userId: string, businessId: string, actionKey: string, enabled: boolean) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, customData: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('BUSINESS_EDIT_FORBIDDEN');

  const upgrades = getBusinessUpgrades(business.customData);
  if (upgrades.queueLvl < 3) throw new Error('BUSINESS_UPGRADE_UNAVAILABLE');

  const parsed = business.customData ? JSON.parse(business.customData) : {};
  if (!parsed.constantProduction) parsed.constantProduction = {};
  parsed.constantProduction[actionKey] = enabled;

  await prisma.business.update({
    where: { id: business.id },
    data: { customData: JSON.stringify(parsed) },
  });

  io.emit('you_state_changed');
  return { actionKey, enabled };
}
