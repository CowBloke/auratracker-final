import type { PrismaClient } from '@prisma/client';
import { io, prisma } from '../../server.js';
import { createNotification } from '../../utils/notifications.js';
import { emitSharedBalanceUpdatesForUserIds } from '../../utils/sharedBalance.js';
import { isBusinessManager } from './service.js';
import {
  CONSTRUCTION_STATUS_COMPLETED,
  CONSTRUCTION_STATUS_UNDER_CONSTRUCTION,
  getConstructionProgress,
  isConstructionActive,
  serializeConstructionProject,
} from './construction.js';

type ResourceType =
  | 'WOOD' | 'STONE' | 'IRON' | 'FOOD' | 'CLOTH'
  | 'CONCRETE' | 'STEEL' | 'FUEL' | 'PAPER'
  | 'LUXURY_GOODS' | 'MEDICINE' | 'DATA' | 'CONTRABAND';

const HOUR_MS = 60 * 60 * 1000;
const USER_PREVIEW_SELECT = {
  id: true,
  username: true,
  firstName: true,
  profilePicture: true,
  bio: true,
  aura: true,
  money: true,
} as const;

const SUPPLY_PROFILES: Record<string, Array<{ resourceType: ResourceType; rate: number; capacity: number; price: number }>> = {
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

const CONTRACT_TERMINAL_STATUSES = new Set(['COMPLETED', 'REJECTED', 'CANCELLED']);

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function getProfiles(typeKey: string) {
  return SUPPLY_PROFILES[typeKey] ?? [];
}

function sanitizeQuantity(value: number) {
  return Math.max(1, Math.min(10000, Math.floor(Number(value))));
}

function sanitizeUnitPrice(value: number) {
  return Math.max(1, Math.min(100000, Math.floor(Number(value))));
}

async function ensureSupplyForBusinesses(db: PrismaClient, businesses: Array<{ id: string; typeKey: string }>) {
  const now = new Date();
  const writes = businesses.flatMap((business) =>
    getProfiles(business.typeKey).map((profile) =>
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
          quantity: Math.floor(profile.capacity * 0.25),
          capacity: profile.capacity,
          productionRatePerHour: profile.rate,
          lastProducedAt: now,
        },
      }),
    )
  );
  if (writes.length > 0) {
    await Promise.all(writes);
  }
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getWorkRatio(db: PrismaClient, businessId: string): Promise<number> {
  const today = getTodayDate();
  const members = await db.businessMember.findMany({
    where: { businessId, status: 'ACTIVE' },
    select: { lastWorkDate: true },
  });
  if (members.length === 0) return 1.0;
  const workedCount = members.filter((m) => m.lastWorkDate === today).length;
  if (workedCount >= 4) return 1.25;
  return workedCount / members.length;
}

export async function submitBusinessWork(userId: string, businessId: string) {
  const member = await prisma.businessMember.findFirst({
    where: { businessId, userId, status: 'ACTIVE' },
  });
  if (!member) throw new Error('NOT_BUSINESS_MEMBER');

  const today = getTodayDate();
  if (member.lastWorkDate === today) throw new Error('WORK_ALREADY_DONE');

  await prisma.businessMember.update({
    where: { id: member.id },
    data: { lastWorkDate: today },
  });

  const workRatio = await getWorkRatio(prisma, businessId);
  return { workedToday: true, workRatio };
}

export async function sendWorkReminder(userId: string, businessId: string, memberId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, ownerId: userId },
    select: { id: true, name: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');

  const member = await prisma.businessMember.findFirst({
    where: { id: memberId, businessId },
    select: { userId: true, user: { select: { username: true } } },
  });
  if (!member) throw new Error('MEMBER_NOT_FOUND');

  await createNotification({
    userId: member.userId,
    type: 'SYSTEM',
    title: `🔥 ${business.name} vous attend !`,
    body: 'Le patron s\'impatiente. Faites votre travail quotidien maintenant.',
    data: { businessId },
    link: '/you',
    icon: 'Flame',
  });
}

export async function accrueBusinessSupply(db: PrismaClient = prisma) {
  const businesses = await db.business.findMany({
    where: {
      typeKey: { in: Object.keys(SUPPLY_PROFILES) },
      OR: [
        { constructionProject: { is: null } },
        { constructionProject: { is: { status: { not: CONSTRUCTION_STATUS_UNDER_CONSTRUCTION } } } },
      ],
    },
    select: { id: true, typeKey: true },
  });
  await ensureSupplyForBusinesses(db, businesses);

  const inventories = await db.businessResourceInventory.findMany({
    where: { productionRatePerHour: { gt: 0 } },
  });
  const now = new Date();

  // Batch-fetch work ratios for all businesses that have inventories
  const businessIdsWithInventory = [...new Set(inventories.map((inv) => inv.businessId))];
  const today = getTodayDate();
  const memberRows = await db.businessMember.findMany({
    where: { businessId: { in: businessIdsWithInventory }, status: 'ACTIVE' },
    select: { businessId: true, lastWorkDate: true },
  });
  const workRatioMap = new Map<string, number>();
  for (const bizId of businessIdsWithInventory) {
    const members = memberRows.filter((m) => m.businessId === bizId);
    if (members.length === 0) { workRatioMap.set(bizId, 1.0); continue; }
    const workedCount = members.filter((m) => m.lastWorkDate === today).length;
    workRatioMap.set(bizId, workedCount >= 4 ? 1.25 : workedCount / members.length);
  }

  for (const inventory of inventories) {
    const elapsedMs = now.getTime() - inventory.lastProducedAt.getTime();
    if (elapsedMs < HOUR_MS / Math.max(1, inventory.productionRatePerHour)) continue;

    const workMultiplier = workRatioMap.get(inventory.businessId) ?? 1.0;
    const produced = Math.floor((elapsedMs / HOUR_MS) * inventory.productionRatePerHour * workMultiplier);
    if (produced <= 0) continue;

    const nextQuantity = Math.min(inventory.capacity, inventory.quantity + produced);
    const nextProducedAt = nextQuantity >= inventory.capacity
      ? now
      : new Date(inventory.lastProducedAt.getTime() + Math.floor((produced / inventory.productionRatePerHour) * HOUR_MS));

    await db.businessResourceInventory.update({
      where: { id: inventory.id },
      data: {
        quantity: nextQuantity,
        lastProducedAt: nextProducedAt,
      },
    });
  }

  await fulfillActiveSupplyContracts(db);
}

export async function fulfillActiveSupplyContracts(db: PrismaClient = prisma) {
  const contracts = await db.businessSupplyContract.findMany({
    where: { status: 'ACTIVE' },
    include: {
      supplier: { select: { id: true, name: true, ownerId: true } },
      buyer: { select: { id: true, name: true, ownerId: true, treasuryMoney: true } },
      constructionProject: {
        include: {
          materials: true,
        },
      },
    },
    orderBy: { acceptedAt: 'asc' },
  });

  const balanceUserIds = new Set<string>();
  for (const contract of contracts) {
    const remaining = contract.totalQuantity - contract.deliveredQuantity;
    if (remaining <= 0) {
      await db.businessSupplyContract.update({
        where: { id: contract.id },
        data: { status: 'COMPLETED', completedAt: contract.completedAt ?? new Date() },
      });
      continue;
    }

    const inventory = await db.businessResourceInventory.findUnique({
      where: {
        businessId_resourceType: {
          businessId: contract.supplierBusinessId,
          resourceType: contract.resourceType,
        },
      },
    });
    if (!inventory || inventory.quantity <= 0) continue;

    const affordable = contract.unitPrice > 0
      ? Math.floor(contract.buyer.treasuryMoney / contract.unitPrice)
      : remaining;
    const constructionMaterial = contract.constructionProject?.materials.find((material) => material.resourceType === contract.resourceType) ?? null;
    const constructionRemaining = constructionMaterial
      ? Math.max(0, constructionMaterial.requiredQuantity - constructionMaterial.deliveredQuantity)
      : remaining;
    if (contract.constructionProjectId && (!constructionMaterial || constructionRemaining <= 0)) {
      await db.businessSupplyContract.update({
        where: { id: contract.id },
        data: { status: 'COMPLETED', completedAt: contract.completedAt ?? new Date() },
      });
      continue;
    }
    const deliverNow = Math.min(remaining, inventory.quantity, affordable, constructionRemaining);
    if (deliverNow <= 0) continue;

    const payment = deliverNow * contract.unitPrice;
    const completed = deliverNow >= remaining;
    await db.$transaction(async (tx) => {
      await tx.businessResourceInventory.update({
        where: { id: inventory.id },
        data: { quantity: { decrement: deliverNow } },
      });
      await tx.business.update({
        where: { id: contract.buyerBusinessId },
        data: { treasuryMoney: { decrement: payment } },
      });
      await tx.business.update({
        where: { id: contract.supplierBusinessId },
        data: { treasuryMoney: { increment: payment } },
      });
      await tx.businessSupplyContract.update({
        where: { id: contract.id },
        data: {
          deliveredQuantity: { increment: deliverNow },
          ...(completed ? { status: 'COMPLETED', completedAt: new Date() } : {}),
        },
      });
      if (constructionMaterial) {
        await tx.businessConstructionMaterial.update({
          where: { id: constructionMaterial.id },
          data: { deliveredQuantity: { increment: deliverNow } },
        });
        const project = await tx.businessConstructionProject.findUnique({
          where: { id: contract.constructionProjectId! },
          include: { materials: true },
        });
        if (project && getConstructionProgress({ materials: project.materials }).complete) {
          await tx.businessConstructionProject.update({
            where: { id: project.id },
            data: { status: CONSTRUCTION_STATUS_COMPLETED, completedAt: new Date() },
          });
        }
      }
      await tx.businessTransaction.create({
        data: {
          businessId: contract.supplierBusinessId,
          type: 'SUPPLY_DELIVERY',
          amount: payment,
          label: `${deliverNow} ${contract.resourceType} livres a ${contract.buyer.name}`,
          actorId: contract.requesterId,
        },
      });
      await tx.businessTransaction.create({
        data: {
          businessId: contract.buyerBusinessId,
          type: 'SUPPLY_PURCHASE',
          amount: -payment,
          label: `${deliverNow} ${contract.resourceType} recus de ${contract.supplier.name}`,
          actorId: contract.requesterId,
        },
      });
    });

    balanceUserIds.add(contract.supplier.ownerId);
    balanceUserIds.add(contract.buyer.ownerId);
    if (completed) {
      await Promise.allSettled([
        createNotification({
          userId: contract.supplier.ownerId,
          type: 'SYSTEM',
          title: 'Contrat termine',
          body: `${contract.supplier.name} a livre tout le contrat ${contract.resourceType} a ${contract.buyer.name}.`,
          link: '/you?tab=supply',
          icon: 'package-check',
        }),
        createNotification({
          userId: contract.buyer.ownerId,
          type: 'SYSTEM',
          title: 'Approvisionnement termine',
          body: `${contract.buyer.name} a recu toutes les ressources du contrat ${contract.resourceType}.`,
          link: '/you?tab=supply',
          icon: 'package-check',
        }),
      ]);
    }
  }

  if (balanceUserIds.size > 0) {
    await emitSharedBalanceUpdatesForUserIds(db, Array.from(balanceUserIds));
  }
}

export async function completeReadyConstructionProjects(db: PrismaClient = prisma) {
  const projects = await db.businessConstructionProject.findMany({
    where: { status: CONSTRUCTION_STATUS_UNDER_CONSTRUCTION },
    include: { materials: true },
  });
  const ready = projects.filter((project) => getConstructionProgress(project).complete);
  if (ready.length === 0) return;

  await db.businessConstructionProject.updateMany({
    where: { id: { in: ready.map((project) => project.id) } },
    data: { status: CONSTRUCTION_STATUS_COMPLETED, completedAt: new Date() },
  });
}

function serializeInventory(entry: any) {
  return {
    id: entry.id,
    businessId: entry.businessId,
    resourceType: entry.resourceType,
    quantity: entry.quantity,
    capacity: entry.capacity,
    productionRatePerHour: entry.productionRatePerHour,
    lastProducedAt: serializeDate(entry.lastProducedAt),
  };
}

function serializeOffer(offer: any) {
  return {
    id: offer.id,
    businessId: offer.businessId,
    resourceType: offer.resourceType,
    unitPrice: offer.unitPrice,
    autoAccept: offer.autoAccept,
    isActive: offer.isActive,
    business: offer.business ? {
      id: offer.business.id,
      name: offer.business.name,
      typeKey: offer.business.typeKey,
      ownerId: offer.business.ownerId,
      owner: offer.business.owner,
    } : undefined,
  };
}

function serializeContract(contract: any) {
  return {
    id: contract.id,
    supplierBusinessId: contract.supplierBusinessId,
    buyerBusinessId: contract.buyerBusinessId,
    constructionProjectId: contract.constructionProjectId ?? null,
    requesterId: contract.requesterId,
    resourceType: contract.resourceType,
    totalQuantity: contract.totalQuantity,
    deliveredQuantity: contract.deliveredQuantity,
    unitPrice: contract.unitPrice,
    status: contract.status,
    createdAt: serializeDate(contract.createdAt),
    acceptedAt: serializeDate(contract.acceptedAt),
    completedAt: serializeDate(contract.completedAt),
    rejectedAt: serializeDate(contract.rejectedAt),
    supplier: contract.supplier ? {
      id: contract.supplier.id,
      name: contract.supplier.name,
      typeKey: contract.supplier.typeKey,
      ownerId: contract.supplier.ownerId,
      owner: contract.supplier.owner,
    } : null,
    buyer: contract.buyer ? {
      id: contract.buyer.id,
      name: contract.buyer.name,
      typeKey: contract.buyer.typeKey,
      ownerId: contract.buyer.ownerId,
      owner: contract.buyer.owner,
    } : null,
    requester: contract.requester ?? null,
  };
}

function serializeLoanNode(loan: any) {
  const totalOwed = Math.ceil(loan.amount * (1 + (loan.interestRate ?? 0) / 100));
  return {
    id: loan.id,
    businessId: loan.businessId,
    kind: 'loan',
    title: `Pret ${loan.borrower?.username ?? 'joueur'}`,
    status: loan.status,
    amount: loan.amount,
    totalOwed,
    repaidAmount: loan.repaidAmount ?? 0,
    interestRate: loan.interestRate,
    collateralAura: loan.collateralAura ?? 0,
    collateralAuraHeld: loan.collateralAuraHeld ?? 0,
    termDays: loan.termMonths,
    createdAt: serializeDate(loan.createdAt),
    decidedAt: serializeDate(loan.decidedAt),
    borrower: loan.borrower ?? null,
  };
}

function serializeCaseNode(courtCase: any, businessId: string) {
  const side = courtCase.plainte?.courtId === businessId
    ? 'COURT'
    : courtCase.plaintiffLawFirmId === businessId ? 'PLAINTIFF' : 'DEFENDANT';
  return {
    id: courtCase.id,
    businessId,
    kind: 'case',
    title: courtCase.caseNumber,
    status: courtCase.status,
    side,
    verdict: courtCase.verdict ?? null,
    sentencing: courtCase.sentencing ?? null,
    createdAt: serializeDate(courtCase.createdAt),
    plaintif: courtCase.plaintif ?? null,
    defendant: courtCase.defendant ?? null,
    lawyer: side === 'PLAINTIFF' ? (courtCase.plaintiffLawyer ?? null) : (courtCase.defendantLawyer ?? null),
    plainte: courtCase.plainte ? {
      id: courtCase.plainte.id,
      courtId: courtCase.plainte.courtId,
      title: courtCase.plainte.title,
      description: courtCase.plainte.description,
    } : null,
  };
}

export async function getSupplyState(userId: string) {
  await completeReadyConstructionProjects(prisma);
  await accrueBusinessSupply(prisma);

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
      supplyOffers: { orderBy: { resourceType: 'asc' } },
      loans: {
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: { borrower: { select: USER_PREVIEW_SELECT } },
      },
      formationProducts: { orderBy: { createdAt: 'desc' }, take: 30 },
      startupProducts: { orderBy: { slotIndex: 'asc' } },
      bankAccounts: { orderBy: { createdAt: 'desc' }, take: 30, include: { user: { select: USER_PREVIEW_SELECT } } },
      transferHistory: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          sender: { select: USER_PREVIEW_SELECT },
          recipient: { select: USER_PREVIEW_SELECT },
        },
      },
      members: {
        where: { status: 'ACTIVE' },
        include: { user: { select: USER_PREVIEW_SELECT } },
        orderBy: [{ isPrimaryLawyer: 'desc' }, { displayOrder: 'asc' }],
      },
      constructionProject: {
        include: {
          materials: { orderBy: { resourceType: 'asc' } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  await ensureSupplyForBusinesses(
    prisma,
    businesses
      .filter((business) => !isConstructionActive(business.constructionProject))
      .map((business) => ({ id: business.id, typeKey: business.typeKey })),
  );

  const businessIds = businesses.map((business) => business.id);
  const [contracts, marketOffers, courtCases] = await Promise.all([
    prisma.businessSupplyContract.findMany({
      where: {
        OR: [
          { supplierBusinessId: { in: businessIds } },
          { buyerBusinessId: { in: businessIds } },
        ],
      },
      include: {
        supplier: { include: { owner: { select: USER_PREVIEW_SELECT } } },
        buyer: { include: { owner: { select: USER_PREVIEW_SELECT } } },
        requester: { select: USER_PREVIEW_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.businessSupplyOffer.findMany({
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
    }),
    prisma.courtCase.findMany({
      where: {
        OR: [
          { plaintiffLawFirmId: { in: businessIds } },
          { defendantLawFirmId: { in: businessIds } },
          { plainte: { courtId: { in: businessIds } } },
        ],
      },
      include: {
        plaintif: { select: USER_PREVIEW_SELECT },
        defendant: { select: USER_PREVIEW_SELECT },
        plaintiffLawyer: { select: USER_PREVIEW_SELECT },
        defendantLawyer: { select: USER_PREVIEW_SELECT },
        plainte: { select: { id: true, courtId: true, title: true, description: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const caseNodes = courtCases.flatMap((courtCase) => {
    const nodes = [];
    if (courtCase.plaintiffLawFirmId && businessIds.includes(courtCase.plaintiffLawFirmId)) {
      nodes.push(serializeCaseNode(courtCase, courtCase.plaintiffLawFirmId));
    }
    if (courtCase.defendantLawFirmId && businessIds.includes(courtCase.defendantLawFirmId)) {
      nodes.push(serializeCaseNode(courtCase, courtCase.defendantLawFirmId));
    }
    if (courtCase.plainte?.courtId && businessIds.includes(courtCase.plainte.courtId)) {
      nodes.push(serializeCaseNode(courtCase, courtCase.plainte.courtId));
    }
    return nodes;
  });

  const accessibleMarketOffers = marketOffers.map((offer: any) => {
    const inventory = offer.business.resourceInventories.find((entry: any) => entry.resourceType === offer.resourceType);
    return {
      ...serializeOffer(offer),
      availableQuantity: inventory?.quantity ?? 0,
    };
  });

  return {
    businesses: businesses.map((business) => ({
      id: business.id,
      name: business.name,
      typeKey: business.typeKey,
      ownerId: business.ownerId,
      owner: business.owner,
      treasuryMoney: business.treasuryMoney,
      monthlyRevenue: business.monthlyRevenue,
      monthlyExpenses: business.monthlyExpenses,
      satisfaction: business.satisfaction,
      constructionProject: serializeConstructionProject(business.constructionProject),
      underConstruction: isConstructionActive(business.constructionProject),
      inventories: business.resourceInventories.map(serializeInventory),
      offers: business.supplyOffers.map(serializeOffer),
      loans: business.loans.map(serializeLoanNode),
      cases: caseNodes.filter((node) => node.businessId === business.id),
      formationProducts: business.formationProducts.map((product) => ({
        id: product.id,
        title: product.title,
        status: product.status,
        price: product.price,
        createdAt: serializeDate(product.createdAt),
      })),
      startupProducts: business.startupProducts.map((product) => ({
        id: product.id,
        slotIndex: product.slotIndex,
        name: product.name,
        deployedLevel: product.deployedLevel,
        activeResearchLevel: product.activeResearchLevel,
        researchEndsAt: serializeDate(product.researchEndsAt),
      })),
      bankAccounts: business.bankAccounts.map((account) => ({
        id: account.id,
        accountType: account.accountType,
        balance: account.balance,
        user: account.user,
        createdAt: serializeDate(account.createdAt),
      })),
      transferHistory: business.transferHistory.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        fee: entry.fee,
        feeRate: entry.feeRate,
        sender: entry.sender,
        recipient: entry.recipient,
        createdAt: serializeDate(entry.createdAt),
      })),
      members: business.members.map((member) => {
        const today = getTodayDate();
        return {
          id: member.id,
          role: member.role,
          specialty: member.specialty,
          isPrimaryLawyer: member.isPrimaryLawyer,
          displayOrder: member.displayOrder,
          salary: member.salary,
          workedToday: member.lastWorkDate === today,
          user: member.user,
        };
      }),
      workRatio: (() => {
        const today = getTodayDate();
        const activeMembers = business.members;
        if (activeMembers.length === 0) return 1.0;
        const workedCount = activeMembers.filter((m) => m.lastWorkDate === today).length;
        return workedCount >= 4 ? 1.25 : workedCount / activeMembers.length;
      })(),
    })),
    marketOffers: accessibleMarketOffers,
    contracts: contracts.map(serializeContract),
  };
}

export async function upsertSupplyOffer(userId: string, businessId: string, input: {
  resourceType: string;
  unitPrice: number;
  autoAccept?: boolean;
  isActive?: boolean;
}) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, name: true, constructionProject: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('BUSINESS_EDIT_FORBIDDEN');
  if (isConstructionActive(business.constructionProject)) throw new Error('BUSINESS_UNDER_CONSTRUCTION');

  const inventory = await prisma.businessResourceInventory.findUnique({
    where: {
      businessId_resourceType: {
        businessId,
        resourceType: String(input.resourceType ?? ''),
      },
    },
  });
  if (!inventory) throw new Error('SUPPLY_RESOURCE_NOT_FOUND');

  const offer = await prisma.businessSupplyOffer.upsert({
    where: {
      businessId_resourceType: {
        businessId,
        resourceType: inventory.resourceType,
      },
    },
    update: {
      unitPrice: sanitizeUnitPrice(input.unitPrice),
      autoAccept: Boolean(input.autoAccept),
      ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
    },
    create: {
      businessId,
      resourceType: inventory.resourceType,
      unitPrice: sanitizeUnitPrice(input.unitPrice),
      autoAccept: Boolean(input.autoAccept),
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
    },
    include: { business: { include: { owner: { select: USER_PREVIEW_SELECT } } } },
  });

  io.to(`user:${business.ownerId}`).emit('you:supply-updated', { businessId });
  return serializeOffer(offer);
}

export async function requestSupplyContract(userId: string, buyerBusinessId: string, input: {
  offerId: string;
  quantity: number;
  constructionProjectId?: string | null;
}) {
  const [buyer, offer] = await Promise.all([
    prisma.business.findUnique({
      where: { id: buyerBusinessId },
      select: { id: true, ownerId: true, name: true },
    }),
    prisma.businessSupplyOffer.findUnique({
      where: { id: String(input.offerId ?? '') },
      include: {
        business: {
          include: { owner: { select: USER_PREVIEW_SELECT } },
        },
      },
    }),
  ]);
  if (!buyer || !offer?.business || !offer.isActive) throw new Error('SUPPLY_OFFER_NOT_FOUND');
  if (!(await isBusinessManager(buyer.id, userId, buyer.ownerId))) throw new Error('BUSINESS_EDIT_FORBIDDEN');
  if (buyer.id === offer.businessId) throw new Error('SUPPLY_CONTRACT_SELF_FORBIDDEN');

  const quantity = sanitizeQuantity(input.quantity);
  const constructionProjectId = input.constructionProjectId ? String(input.constructionProjectId) : null;
  if (constructionProjectId) {
    const project = await prisma.businessConstructionProject.findUnique({
      where: { id: constructionProjectId },
      include: { materials: true },
    });
    if (!project || project.businessId !== buyer.id || project.status !== CONSTRUCTION_STATUS_UNDER_CONSTRUCTION) {
      throw new Error('CONSTRUCTION_PROJECT_NOT_FOUND');
    }
    const material = project.materials.find((entry) => entry.resourceType === offer.resourceType);
    if (!material || material.deliveredQuantity >= material.requiredQuantity) {
      throw new Error('CONSTRUCTION_RESOURCE_NOT_REQUIRED');
    }
  }

  const contract = await prisma.businessSupplyContract.create({
    data: {
      supplierBusinessId: offer.businessId,
      buyerBusinessId,
      constructionProjectId,
      requesterId: userId,
      resourceType: offer.resourceType,
      totalQuantity: quantity,
      unitPrice: offer.unitPrice,
      status: offer.autoAccept ? 'ACTIVE' : 'PENDING',
      acceptedAt: offer.autoAccept ? new Date() : null,
    },
    include: {
      supplier: { include: { owner: { select: USER_PREVIEW_SELECT } } },
      buyer: { include: { owner: { select: USER_PREVIEW_SELECT } } },
      requester: { select: USER_PREVIEW_SELECT },
    },
  });

  await createNotification({
    userId: offer.business.ownerId,
    type: 'SYSTEM',
    title: offer.autoAccept ? 'Contrat auto-accepte' : 'Nouvelle demande de ressource',
    body: `${buyer.name} demande ${quantity} ${offer.resourceType} a ${offer.unitPrice.toLocaleString('fr-FR')} money/u.`,
    link: '/you?tab=supply',
    icon: 'package',
  });
  if (offer.autoAccept) {
    await fulfillActiveSupplyContracts(prisma);
  }
  io.to(`user:${offer.business.ownerId}`).emit('you:supply-updated', { businessId: offer.businessId });
  io.to(`user:${buyer.ownerId}`).emit('you:supply-updated', { businessId: buyer.id });
  return serializeContract(contract);
}

export async function respondToSupplyContract(userId: string, contractId: string, decision: 'accept' | 'reject') {
  const contract = await prisma.businessSupplyContract.findUnique({
    where: { id: contractId },
    include: {
      supplier: { include: { owner: { select: USER_PREVIEW_SELECT } } },
      buyer: { include: { owner: { select: USER_PREVIEW_SELECT } } },
      requester: { select: USER_PREVIEW_SELECT },
    },
  });
  if (!contract) throw new Error('SUPPLY_CONTRACT_NOT_FOUND');
  if (!(await isBusinessManager(contract.supplierBusinessId, userId, contract.supplier.ownerId))) {
    throw new Error('BUSINESS_EDIT_FORBIDDEN');
  }
  if (contract.status !== 'PENDING') throw new Error('SUPPLY_CONTRACT_ALREADY_DECIDED');

  const updated = await prisma.businessSupplyContract.update({
    where: { id: contract.id },
    data: decision === 'accept'
      ? { status: 'ACTIVE', acceptedAt: new Date() }
      : { status: 'REJECTED', rejectedAt: new Date() },
    include: {
      supplier: { include: { owner: { select: USER_PREVIEW_SELECT } } },
      buyer: { include: { owner: { select: USER_PREVIEW_SELECT } } },
      requester: { select: USER_PREVIEW_SELECT },
    },
  });

  await createNotification({
    userId: contract.buyer.ownerId,
    type: 'SYSTEM',
    title: decision === 'accept' ? 'Demande de ressource acceptee' : 'Demande de ressource refusee',
    body: `${contract.supplier.name} a ${decision === 'accept' ? 'accepte' : 'refuse'} ${contract.totalQuantity} ${contract.resourceType}.`,
    link: '/you?tab=supply',
    icon: decision === 'accept' ? 'package-check' : 'package-x',
  });
  if (decision === 'accept') {
    await fulfillActiveSupplyContracts(prisma);
  }
  io.to(`user:${contract.supplier.ownerId}`).emit('you:supply-updated', { businessId: contract.supplierBusinessId });
  io.to(`user:${contract.buyer.ownerId}`).emit('you:supply-updated', { businessId: contract.buyerBusinessId });
  return serializeContract(updated);
}

export async function cancelSupplyContract(userId: string, contractId: string) {
  const contract = await prisma.businessSupplyContract.findUnique({
    where: { id: contractId },
    include: {
      supplier: { select: { ownerId: true } },
      buyer: { select: { ownerId: true } },
    },
  });
  if (!contract) throw new Error('SUPPLY_CONTRACT_NOT_FOUND');
  const canCancel = await isBusinessManager(contract.buyerBusinessId, userId, contract.buyer.ownerId)
    || await isBusinessManager(contract.supplierBusinessId, userId, contract.supplier.ownerId);
  if (!canCancel) throw new Error('BUSINESS_EDIT_FORBIDDEN');
  if (CONTRACT_TERMINAL_STATUSES.has(contract.status)) throw new Error('SUPPLY_CONTRACT_ALREADY_DECIDED');

  const updated = await prisma.businessSupplyContract.update({
    where: { id: contract.id },
    data: { status: 'CANCELLED' },
    include: {
      supplier: { include: { owner: { select: USER_PREVIEW_SELECT } } },
      buyer: { include: { owner: { select: USER_PREVIEW_SELECT } } },
      requester: { select: USER_PREVIEW_SELECT },
    },
  });
  io.to(`user:${contract.supplier.ownerId}`).emit('you:supply-updated', { businessId: contract.supplierBusinessId });
  io.to(`user:${contract.buyer.ownerId}`).emit('you:supply-updated', { businessId: contract.buyerBusinessId });
  return serializeContract(updated);
}
