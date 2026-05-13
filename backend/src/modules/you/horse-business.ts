import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../server.js';
import { emitSharedBalanceUpdatesForUserIds } from '../../utils/shared-balance.js';
import { isConstructionActive } from './construction.js';
import { isBusinessManager } from './service.js';

export const HORSE_BUSINESS_TYPE_KEY = 'horse_business';
export const HORSE_PRODUCTION_COST = 10_000;
export const HORSE_PRODUCTION_MS = 60 * 60 * 1000;
export const HORSE_BASE_PRODUCTION_SLOTS = 2;
export const HORSE_MAX_PRODUCTION_SLOTS = 8;
export const HORSE_TRAIN_BASELINE_COST = 2_000;
export const HORSE_PRODUCTION_STATUS_PENDING = 'PENDING';
export const HORSE_PRODUCTION_STATUS_COMPLETED = 'COMPLETED';

type DbClient = PrismaClient | Prisma.TransactionClient;

const HORSE_COLORS = [
  '#92400e', '#a16207', '#78350f', '#44403c', '#57534e',
  '#854d0e', '#b45309', '#d6d3d1', '#292524', '#78716c',
];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function generateHorseBusinessUnit() {
  return {
    bodyColor: HORSE_COLORS[Math.floor(Math.random() * HORSE_COLORS.length)],
    pattern: 'solid',
    patternColor: '#f8fafc',
    geneSpeed: randomBetween(5.5, 7.5),
    geneStamina: randomBetween(5.5, 7.5),
    geneConsistency: randomBetween(6, 8.5),
  };
}

export function horseUnitStars(unit: { geneSpeed: number; geneStamina: number; geneConsistency: number }) {
  const avg = (unit.geneSpeed + unit.geneStamina + unit.geneConsistency) / 3;
  return Math.round(Math.max(1, Math.min(5, (avg / 10) * 5)) * 10) / 10;
}

export function getHorseBusinessUpgradeRequirements(capacityLevel: number) {
  const nextLevel = capacityLevel + 1;
  return [
    { resourceType: 'WOOD', quantity: 20 + nextLevel * 10 },
    { resourceType: 'FOOD', quantity: 30 + nextLevel * 12 },
    { resourceType: 'CLOTH', quantity: 10 + nextLevel * 5 },
    { resourceType: 'MEDICINE', quantity: 4 + nextLevel * 2 },
  ];
}

export async function ensureHorseBusinessProfile(db: DbClient, businessId: string) {
  return db.horseBusinessProfile.upsert({
    where: { businessId },
    update: {},
    create: {
      businessId,
      productionSlots: HORSE_BASE_PRODUCTION_SLOTS,
      capacityLevel: 0,
    },
  });
}

export async function ensureHorseBusinessProfiles(db: DbClient, businessIds: string[]) {
  if (businessIds.length === 0) return;
  await Promise.all(businessIds.map((businessId) => ensureHorseBusinessProfile(db, businessId)));
}

export async function settleHorseBusinessProductions(db: PrismaClient = prisma, businessIds?: string[]) {
  const productions = await db.horseBusinessProduction.findMany({
    where: {
      status: HORSE_PRODUCTION_STATUS_PENDING,
      endsAt: { lte: new Date() },
      ...(businessIds && businessIds.length > 0 ? { businessId: { in: businessIds } } : {}),
    },
    orderBy: { endsAt: 'asc' },
  });

  for (const production of productions) {
    await db.$transaction(async (tx) => {
      const claimed = await tx.horseBusinessProduction.updateMany({
        where: { id: production.id, status: HORSE_PRODUCTION_STATUS_PENDING },
        data: { status: HORSE_PRODUCTION_STATUS_COMPLETED, completedAt: new Date() },
      });
      if (claimed.count !== 1) return;
      await tx.horseBusinessHorse.create({
        data: {
          businessId: production.businessId,
          bodyColor: production.bodyColor,
          pattern: production.pattern,
          patternColor: production.patternColor,
          geneSpeed: production.geneSpeed,
          geneStamina: production.geneStamina,
          geneConsistency: production.geneConsistency,
        },
      });
    });
  }
}

function assertHorseBusinessReady(business: { typeKey: string; constructionProject?: { status?: string | null } | null } | null) {
  if (!business || business.typeKey !== HORSE_BUSINESS_TYPE_KEY) {
    throw new Error('HORSE_BUSINESS_NOT_FOUND');
  }
  if (isConstructionActive(business.constructionProject)) {
    throw new Error('BUSINESS_UNDER_CONSTRUCTION');
  }
}

export async function startHorseBusinessProduction(userId: string, businessId: string) {
  await settleHorseBusinessProductions(prisma, [businessId]);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      typeKey: true,
      treasuryMoney: true,
      constructionProject: { select: { status: true } },
    },
  });
  assertHorseBusinessReady(business);
  if (!(await isBusinessManager(business!.id, userId, business!.ownerId))) {
    throw new Error('HORSE_BUSINESS_FORBIDDEN');
  }

  const production = await prisma.$transaction(async (tx) => {
    const profile = await ensureHorseBusinessProfile(tx, businessId);
    const activeCount = await tx.horseBusinessProduction.count({
      where: { businessId, status: HORSE_PRODUCTION_STATUS_PENDING },
    });
    if (activeCount >= profile.productionSlots) {
      throw new Error('HORSE_PRODUCTION_SLOTS_FULL');
    }

    const freshBusiness = await tx.business.findUnique({
      where: { id: businessId },
      select: { treasuryMoney: true, name: true },
    });
    if (!freshBusiness || Number(freshBusiness.treasuryMoney) < HORSE_PRODUCTION_COST) {
      throw new Error('HORSE_BUSINESS_TREASURY_LOW');
    }

    const unit = generateHorseBusinessUnit();
    await tx.business.update({
      where: { id: businessId },
      data: { treasuryMoney: { decrement: HORSE_PRODUCTION_COST } },
    });
    await tx.businessTransaction.create({
      data: {
        businessId,
        type: 'HORSE_PRODUCTION_START',
        amount: BigInt(-HORSE_PRODUCTION_COST),
        label: 'Production d un cheval lancee',
        actorId: userId,
      },
    });
    return tx.horseBusinessProduction.create({
      data: {
        businessId,
        ...unit,
        endsAt: new Date(Date.now() + HORSE_PRODUCTION_MS),
      },
    });
  });

  await emitSharedBalanceUpdatesForUserIds(prisma, [business!.ownerId]);
  return serializeHorseProduction(production);
}

export async function upgradeHorseBusinessCapacity(userId: string, businessId: string) {
  await settleHorseBusinessProductions(prisma, [businessId]);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      typeKey: true,
      constructionProject: { select: { status: true } },
    },
  });
  assertHorseBusinessReady(business);
  if (!(await isBusinessManager(business!.id, userId, business!.ownerId))) {
    throw new Error('HORSE_BUSINESS_FORBIDDEN');
  }

  const result = await prisma.$transaction(async (tx) => {
    const profile = await ensureHorseBusinessProfile(tx, businessId);
    if (profile.productionSlots >= HORSE_MAX_PRODUCTION_SLOTS) {
      throw new Error('HORSE_BUSINESS_MAX_CAPACITY');
    }

    const inventories = await tx.businessResourceInventory.findMany({ where: { businessId } });
    const requirements = getHorseBusinessUpgradeRequirements(profile.capacityLevel);
    const missing = requirements.filter((requirement) => {
      const available = inventories.find((entry) => entry.resourceType === requirement.resourceType)?.quantity ?? 0;
      return available < requirement.quantity;
    });
    if (missing.length > 0) {
      throw new Error('HORSE_BUSINESS_RESOURCE_SHORTAGE');
    }

    for (const requirement of requirements) {
      await tx.businessResourceInventory.update({
        where: {
          businessId_resourceType: {
            businessId,
            resourceType: requirement.resourceType,
          },
        },
        data: { quantity: { decrement: requirement.quantity } },
      });
    }

    const updatedProfile = await tx.horseBusinessProfile.update({
      where: { businessId },
      data: {
        productionSlots: { increment: 1 },
        capacityLevel: { increment: 1 },
      },
    });
    await tx.businessTransaction.create({
      data: {
        businessId,
        type: 'HORSE_CAPACITY_UPGRADE',
        amount: BigInt(0),
        label: `Slot de production cheval debloque (${updatedProfile.productionSlots})`,
        actorId: userId,
      },
    });
    return updatedProfile;
  });

  await emitSharedBalanceUpdatesForUserIds(prisma, [business!.ownerId]);
  return result;
}

function serializeHorseProduction(production: any) {
  const now = Date.now();
  const startedAt = production.startedAt ? new Date(production.startedAt).getTime() : now;
  const endsAt = production.endsAt ? new Date(production.endsAt).getTime() : now;
  const totalMs = Math.max(1, endsAt - startedAt);
  const remainingMs = Math.max(0, endsAt - now);
  return {
    id: production.id,
    businessId: production.businessId,
    status: production.status,
    startedAt: production.startedAt ? new Date(production.startedAt).toISOString() : null,
    endsAt: production.endsAt ? new Date(production.endsAt).toISOString() : null,
    completedAt: production.completedAt ? new Date(production.completedAt).toISOString() : null,
    remainingMs,
    progressPercent: Math.max(0, Math.min(100, Math.round(((totalMs - remainingMs) / totalMs) * 100))),
    stars: horseUnitStars(production),
  };
}

export function serializeHorseBusinessState(business: any) {
  const profile = business.horseBusinessProfile ?? {
    productionSlots: HORSE_BASE_PRODUCTION_SLOTS,
    capacityLevel: 0,
  };
  const availableHorses = (business.horseBusinessHorses ?? []).filter((horse: any) => !horse.soldAt);
  const pendingProductions = (business.horseBusinessProductions ?? [])
    .filter((production: any) => production.status === HORSE_PRODUCTION_STATUS_PENDING)
    .map((production: any) => serializeHorseProduction(production));
  const inventories = business.resourceInventories ?? [];
  const requirements = getHorseBusinessUpgradeRequirements(profile.capacityLevel).map((requirement) => {
    const available = inventories.find((entry: any) => entry.resourceType === requirement.resourceType)?.quantity ?? 0;
    return {
      ...requirement,
      available,
      missing: Math.max(0, requirement.quantity - available),
    };
  });
  const canUpgrade = profile.productionSlots < HORSE_MAX_PRODUCTION_SLOTS
    && requirements.every((requirement) => requirement.available >= requirement.quantity);
  const availableHorseRating = availableHorses.length > 0
    ? Math.round((availableHorses.reduce((sum: number, horse: any) => sum + horseUnitStars(horse), 0) / availableHorses.length) * 10) / 10
    : null;

  return {
    productionCost: HORSE_PRODUCTION_COST,
    productionDurationMs: HORSE_PRODUCTION_MS,
    trainBaselineCost: HORSE_TRAIN_BASELINE_COST,
    productionSlots: profile.productionSlots,
    capacityLevel: profile.capacityLevel,
    maxProductionSlots: HORSE_MAX_PRODUCTION_SLOTS,
    availableHorseCount: availableHorses.length,
    availableHorseRating,
    activeProductionCount: pendingProductions.length,
    pendingProductions,
    upgrade: {
      nextProductionSlots: Math.min(HORSE_MAX_PRODUCTION_SLOTS, profile.productionSlots + 1),
      canUpgrade,
      maxed: profile.productionSlots >= HORSE_MAX_PRODUCTION_SLOTS,
      requirements,
    },
  };
}

export function serializeHorseServiceBusiness(business: any) {
  const horseState = serializeHorseBusinessState(business);
  const ratings = business.ratings ?? [];
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((sum: number, rating: any) => sum + rating.rating, 0) / ratings.length) * 10) / 10
    : null;
  return {
    id: business.id,
    name: business.name,
    typeKey: business.typeKey,
    ownerId: business.ownerId,
    owner: business.owner ?? null,
    treasuryMoney: Number(business.treasuryMoney ?? 0),
    avgRating,
    ratingCount: ratings.length,
    availableHorseCount: horseState.availableHorseCount,
    availableHorseRating: horseState.availableHorseRating,
    productionSlots: horseState.productionSlots,
    activeProductionCount: horseState.activeProductionCount,
  };
}

export async function listHorseServiceBusinesses() {
  await settleHorseBusinessProductions(prisma);

  const businesses = await prisma.business.findMany({
    where: { typeKey: HORSE_BUSINESS_TYPE_KEY },
    include: {
      owner: { select: { id: true, username: true, firstName: true, profilePicture: true, bio: true, aura: true, money: true } },
      ratings: true,
      resourceInventories: true,
      horseBusinessProfile: true,
      horseBusinessHorses: { where: { soldAt: null } },
      horseBusinessProductions: { where: { status: HORSE_PRODUCTION_STATUS_PENDING } },
      constructionProject: true,
    },
    orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }],
  });

  return businesses
    .filter((business) => !isConstructionActive(business.constructionProject))
    .map((business) => serializeHorseServiceBusiness(business));
}
