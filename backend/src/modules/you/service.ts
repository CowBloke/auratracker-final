import { io, prisma } from '../../server.js';
import { createNotification, emitNotificationUpdated } from '../../utils/notifications.js';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_MAP,
  ILLEGAL_BUSINESS_UPGRADE_MAP,
  ILLEGAL_BUSINESS_UPGRADES,
  INVESTMENT_RISK_RANGES,
  STARTUP_PRODUCTS,
  STARTUP_PRODUCT_MAX_LEVEL,
  YOU_SKILLS,
  YOU_SKILL_MAP,
  YOU_SKILL_MAX_LEVEL,
  YOU_SKILL_XP_PER_LEVEL,
  getStartupProductRevenue,
  getStartupResearchCost,
  getStartupResearchDurationMinutes,
  type BusinessActionKey,
  type InvestmentRiskLevel,
  type YouSkillKey,
} from './config.js';
import {
  debitSharedMoney,
  emitSharedBalanceUpdates,
  emitSharedBalanceUpdatesForUserIds,
  ensureSharedMoneyAvailable,
  getSharedBalance,
} from '../../utils/shared-balance.js';
import { logAdmin } from '../../utils/logger.js';
import { writeBase64UploadFile, writeBase64UploadVideo } from '../../utils/uploads.js';
import { BALANCING, getBusinessBalancing } from '../../config/balancing.js';
import {
  BUSINESS_SHARE_PROPOSAL_CANCEL_DELAY_MS,
  getBusinessSaleItems,
  getBusinessShareProposalCancelAvailableAt,
  getDefaultIllegalBusinessCustomData,
  getIllegalBusinessCustomData,
  safeJsonParse,
  type IllegalBusinessCustomData,
  type YouMenuItem,
} from './helpers.js';
import {
  CONSTRUCTION_STATUS_UNDER_CONSTRUCTION,
  getConstructionRecipe,
  isConstructionActive,
  serializeConstructionProject,
} from './construction.js';
import {
  getBusinessCreditScore,
  getBusinessFinancialEvent,
  getBusinessInputCoverage,
  getGlobalMarketUnitPrice,
  getRunwayDays,
  getSupplierReliability,
} from './economy.js';

const FORMATION_FILE_UPLOAD_DIR = 'uploads/formation-files';
const MAX_FORMATION_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const YOUTUBE_VIDEO_UPLOAD_DIR = 'uploads/youtube-videos';
const MAX_YOUTUBE_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const YOU_CACHE_TTL_MS = 10_000;
const _youStateCache = new Map<string, { data: any; expiresAt: number }>();
const _startupProductCache = new Map<string, { data: any; expiresAt: number }>();
const _formationProductCache = new Map<string, { data: any; expiresAt: number }>();
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const USER_PREVIEW_SELECT = {
  id: true,
  username: true,
  firstName: true,
  profilePicture: true,
  bio: true,
  aura: true,
  money: true,
} as const;

const BUSINESS_BASE_INCLUDE = {
  owner: { select: USER_PREVIEW_SELECT },
  supportAgent: { select: USER_PREVIEW_SELECT },
  members: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      user: {
        select: USER_PREVIEW_SELECT,
      },
    },
  },
  invitations: {
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' as const },
    include: {
      inviter: {
        select: USER_PREVIEW_SELECT,
      },
      invitee: {
        select: USER_PREVIEW_SELECT,
      },
    },
  },
  loans: {
    orderBy: { createdAt: 'desc' as const },
    take: 100,
    include: {
      borrower: {
        select: USER_PREVIEW_SELECT,
      },
    },
  },
  investments: {
    orderBy: { createdAt: 'desc' as const },
    take: 8,
    include: {
      investor: {
        select: USER_PREVIEW_SELECT,
      },
    },
  },
  shareholders: {
    orderBy: { sharePercent: 'desc' as const },
    include: {
      user: {
        select: USER_PREVIEW_SELECT,
      },
    },
  },
  shareholderProposals: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      investor: {
        select: USER_PREVIEW_SELECT,
      },
      owner: {
        select: USER_PREVIEW_SELECT,
      },
    },
  },
  transferHistory: {
    orderBy: { createdAt: 'desc' as const },
    take: 12,
    include: {
      sender: {
        select: USER_PREVIEW_SELECT,
      },
      recipient: {
        select: USER_PREVIEW_SELECT,
      },
    },
  },
  transactions: {
    orderBy: { createdAt: 'desc' as const },
    take: 30,
  },
  buyoutOffers: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      bidder: {
        select: USER_PREVIEW_SELECT,
      },
      owner: {
        select: USER_PREVIEW_SELECT,
      },
    },
  },
  startupProducts: {
    orderBy: { slotIndex: 'asc' as const },
  },
  formationProducts: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      purchases: {
        orderBy: { purchasedAt: 'desc' as const },
      },
      ratings: {
        orderBy: { updatedAt: 'desc' as const },
        include: {
          user: {
            select: USER_PREVIEW_SELECT,
          },
        },
      },
      reviewEligibilities: {
        orderBy: { updatedAt: 'desc' as const },
      },
    },
  },
  ratings: {
    orderBy: { updatedAt: 'desc' as const },
    include: {
      user: {
        select: USER_PREVIEW_SELECT,
      },
    },
  },
  reviewEligibilities: {
    orderBy: { updatedAt: 'desc' as const },
  },
  lawyerRatings: {
    orderBy: { updatedAt: 'desc' as const },
  },
  constructionProject: {
    include: {
      materials: {
        orderBy: { resourceType: 'asc' as const },
      },
    },
  },
  resourceInventories: {
    orderBy: { resourceType: 'asc' as const },
  },
  supplyOffers: {
    orderBy: { resourceType: 'asc' as const },
  },
  supplyContractsAsSupplier: {
    orderBy: { createdAt: 'desc' as const },
    take: 30,
  },
  supplyContractsAsBuyer: {
    orderBy: { createdAt: 'desc' as const },
    take: 30,
  },
  youtubeVideos: {
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

const RELATIONSHIP_INCLUDE = {
  userA: { select: USER_PREVIEW_SELECT },
  userB: { select: USER_PREVIEW_SELECT },
  marriageProposals: {
    orderBy: { createdAt: 'desc' as const },
  },
  divorceProposals: {
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

const logYouAdmin = (...args: Parameters<typeof logAdmin>) => {
  void logAdmin(...args);
};

const USER_SKILL_DEFAULTS = YOU_SKILLS.map((skill) => ({
  key: skill.key,
  level: 1,
  xp: 0,
}));

function getCanonicalPair(userIdA: string, userIdB: string) {
  return userIdA < userIdB
    ? { userAId: userIdA, userBId: userIdB }
    : { userAId: userIdB, userBId: userIdA };
}

function isBusinessParticipant(userId: string, business: { ownerId: string }) {
  return business.ownerId === userId;
}

function getLoanDueDateFromEntry(loan: { decidedAt: Date | null; createdAt: Date; termMonths: number }) {
  const dueDate = new Date(loan.decidedAt ?? loan.createdAt);
  dueDate.setDate(dueDate.getDate() + Math.max(0, loan.termMonths));
  return dueDate;
}

export function isBusinessManagerSync(business: any, userId: string) {
  if (business.ownerId === userId) return true;
  if (!business.members) return false;
  return business.members.some((m: any) => 
    m.userId === userId && ['associé', 'associée', 'associe', 'associee', 'partner'].includes((m.role || '').toLowerCase())
  );
}

export async function isBusinessManager(businessId: string, userId: string, businessOwnerId?: string): Promise<boolean> {
  if (businessOwnerId && businessOwnerId === userId) return true;
  const members = await prisma.businessMember.findMany({
    where: { businessId, userId }
  });
  return members.some(m => ['associé', 'associée', 'associe', 'associee', 'partner'].includes((m.role || '').toLowerCase()));
}

export async function grantSkillXp(userId: string, skillKey: YouSkillKey, xpAmount: number) {
  if (xpAmount <= 0) return;
  try {
    await ensureUserSkills(userId);
    const skill = await prisma.userSkill.findUnique({
      where: { userId_key: { userId, key: skillKey } },
    });
    if (!skill || skill.level >= YOU_SKILL_MAX_LEVEL) return;

    let nextLevel = skill.level;
    let nextXp = skill.xp + xpAmount;

    while (nextLevel < YOU_SKILL_MAX_LEVEL && nextXp >= YOU_SKILL_XP_PER_LEVEL) {
      nextXp -= YOU_SKILL_XP_PER_LEVEL;
      nextLevel += 1;
    }

    if (nextLevel >= YOU_SKILL_MAX_LEVEL) {
      nextLevel = YOU_SKILL_MAX_LEVEL;
      nextXp = YOU_SKILL_XP_PER_LEVEL;
    }

    await prisma.userSkill.update({
      where: { id: skill.id },
      data: { level: nextLevel, xp: nextXp },
    });
  } catch {
    // Silent failure — XP grants must never break the main action flow
  }
}

export async function penalizeSkillXp(userId: string, skillKey: YouSkillKey, xpAmount: number) {
  if (xpAmount <= 0) return;
  try {
    await ensureUserSkills(userId);
    const skill = await prisma.userSkill.findUnique({
      where: { userId_key: { userId, key: skillKey } },
    });
    if (!skill) return;
    if (skill.level <= 1 && skill.xp <= 0) return;

    let nextLevel = skill.level;
    let nextXp = skill.xp - xpAmount;

    while (nextXp < 0 && nextLevel > 1) {
      nextLevel -= 1;
      nextXp += YOU_SKILL_XP_PER_LEVEL;
    }
    if (nextXp < 0) nextXp = 0;

    await prisma.userSkill.update({
      where: { id: skill.id },
      data: { level: nextLevel, xp: nextXp },
    });
  } catch {
    // Silent failure — XP penalties must never break the main action flow
  }
}

async function ensureUserSkills(userId: string) {
  await Promise.all(
    USER_SKILL_DEFAULTS.map((skill) =>
      prisma.userSkill.upsert({
        where: {
          userId_key: {
            userId,
            key: skill.key,
          },
        },
        update: {},
        create: {
          userId,
          key: skill.key,
          level: skill.level,
          xp: skill.xp,
        },
      })
    )
  );
}

function serializeSkill(skill: { key: string; level: number; xp: number }) {
  const definition = YOU_SKILL_MAP.get(skill.key as YouSkillKey);
  if (!definition) {
    return null;
  }

  const level = Math.max(1, Math.min(YOU_SKILL_MAX_LEVEL, skill.level));
  const xp = level >= YOU_SKILL_MAX_LEVEL
    ? YOU_SKILL_XP_PER_LEVEL
    : Math.max(0, Math.min(YOU_SKILL_XP_PER_LEVEL, skill.xp));
  const trainingCost = definition.trainingCost * level;

  return {
    key: definition.key,
    label: definition.label,
    color: definition.color,
    description: definition.description,
    level,
    xp,
    maxXp: YOU_SKILL_XP_PER_LEVEL,
    trainingCost,
    trainable: definition.trainable,
    canTrain: definition.trainable && level < YOU_SKILL_MAX_LEVEL,
    unlocks: definition.unlocks,
  };
}

function getBusinessSlots(skills: Array<{ key: string; level: number }>) {
  const { businessLimits } = BALANCING;
  const affairesSkill = skills.find((skill) => skill.key === 'affaires');
  return Math.max(businessLimits.minSlots, affairesSkill?.level ?? businessLimits.minSlots);
}

async function ensureCanOwnAdditionalBusiness(userId: string) {
  const [skills, ownedBusinessCount, viewer] = await Promise.all([
    prisma.userSkill.findMany({
      where: { userId },
      select: { key: true, level: true },
    }),
    prisma.business.count({
      where: { ownerId: userId },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isSuperAdmin: true },
    }),
  ]);

  const bypassBusinessSlotLimit = Boolean(viewer?.isAdmin || viewer?.isSuperAdmin);
  if (bypassBusinessSlotLimit) {
    return;
  }

  const businessSlots = getBusinessSlots(skills);
  if (ownedBusinessCount >= businessSlots) {
    throw new Error('BUSINESS_SLOT_LIMIT_REACHED');
  }
}

async function ensureStartupProducts(businessId: string) {
  await Promise.all(
    STARTUP_PRODUCTS.map((product) =>
      prisma.businessStartupProduct.upsert({
        where: {
          businessId_slotIndex: {
            businessId,
            slotIndex: product.slotIndex,
          },
        },
        update: {},
        create: {
          businessId,
          slotIndex: product.slotIndex,
          name: product.name,
        },
      })
    )
  );
}

function serializeStartupProduct(product: any) {
  const now = Date.now();
  const cacheKey = String(product.id);
  const cached = _startupProductCache.get(cacheKey);
  if (cached && now < cached.expiresAt) return cached.data;
  const researchEndsAt = product.researchEndsAt ? new Date(product.researchEndsAt).toISOString() : null;
  const researchStartedAt = product.researchStartedAt ? new Date(product.researchStartedAt).toISOString() : null;
  const isResearchActive = Boolean(product.activeResearchLevel && product.researchEndsAt && new Date(product.researchEndsAt).getTime() > now);
  const canDeploy = Boolean(product.activeResearchLevel && product.researchEndsAt && new Date(product.researchEndsAt).getTime() <= now);
  const nextLevel = product.activeResearchLevel ?? (product.deployedLevel + 1);
  const nextLevelCapped = Math.min(nextLevel, STARTUP_PRODUCT_MAX_LEVEL);
  const progressPercent = product.researchStartedAt && product.researchEndsAt
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((now - new Date(product.researchStartedAt).getTime()) / Math.max(1, new Date(product.researchEndsAt).getTime() - new Date(product.researchStartedAt).getTime())) * 100
          )
        )
      )
    : 0;

  const result = {
    id: product.id,
    slotIndex: product.slotIndex,
    name: product.name,
    deployedLevel: product.deployedLevel,
    currentRevenue: getStartupProductRevenue(product.deployedLevel),
    isResearchActive,
    canDeploy,
    activeResearchLevel: product.activeResearchLevel,
    researchStartedAt,
    researchEndsAt,
    researchCost: product.researchCost ?? (product.deployedLevel >= STARTUP_PRODUCT_MAX_LEVEL ? null : getStartupResearchCost(nextLevelCapped)),
    nextResearchCost: product.deployedLevel >= STARTUP_PRODUCT_MAX_LEVEL || product.activeResearchLevel ? null : getStartupResearchCost(nextLevelCapped),
    nextResearchDurationMinutes: product.deployedLevel >= STARTUP_PRODUCT_MAX_LEVEL || product.activeResearchLevel ? null : getStartupResearchDurationMinutes(nextLevelCapped),
    progressPercent,
    canStartResearch: !product.activeResearchLevel && product.deployedLevel < STARTUP_PRODUCT_MAX_LEVEL,
    isMaxLevel: product.deployedLevel >= STARTUP_PRODUCT_MAX_LEVEL,
  };
  _startupProductCache.set(cacheKey, { data: result, expiresAt: now + YOU_CACHE_TTL_MS });
  return result;
}

function serializeBuyoutOffer(offer: any, viewerId: string) {
  return {
    id: offer.id,
    businessId: offer.businessId,
    amount: offer.amount,
    message: offer.message,
    status: offer.status,
    createdAt: offer.createdAt.toISOString(),
    decidedAt: offer.decidedAt ? offer.decidedAt.toISOString() : null,
    direction: offer.bidderId === viewerId ? 'sent' : 'received',
    bidder: offer.bidder,
    owner: offer.owner,
  };
}

function serializeTransferHistoryEntry(entry: any) {
  return {
    id: entry.id,
    amount: entry.amount,
    fee: entry.fee,
    feeRate: entry.feeRate,
    createdAt: entry.createdAt.toISOString(),
    sender: entry.sender,
    recipient: entry.recipient,
  };
}

function serializeShareholder(shareholder: any) {
  return {
    id: shareholder.id,
    sharePercent: shareholder.sharePercent,
    investedAmount: shareholder.investedAmount,
    averagePrice: shareholder.averagePrice,
    createdAt: shareholder.createdAt.toISOString(),
    user: shareholder.user,
  };
}

function serializeShareProposal(proposal: any, viewerId: string) {
  const cancelAvailableAt = getBusinessShareProposalCancelAvailableAt(proposal.createdAt);
  return {
    id: proposal.id,
    businessId: proposal.businessId,
    sharePercent: proposal.sharePercent,
    amount: proposal.amount,
    suggestedAmount: proposal.suggestedAmount,
    message: proposal.message ?? null,
    status: proposal.status,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
    decidedAt: proposal.decidedAt ? proposal.decidedAt.toISOString() : null,
    cancelAvailableAt: cancelAvailableAt.toISOString(),
    direction: proposal.investorId === viewerId ? 'sent' : 'received',
    investor: proposal.investor,
    owner: proposal.owner,
  };
}

function serializeShareMarketListing(listing: any, viewerId: string) {
  return {
    id: listing.id,
    businessId: listing.businessId,
    sharePercent: listing.sharePercent,
    price: listing.price,
    status: listing.status,
    createdAt: listing.createdAt.toISOString(),
    soldAt: listing.soldAt ? listing.soldAt.toISOString() : null,
    cancelledAt: listing.cancelledAt ? listing.cancelledAt.toISOString() : null,
    direction: listing.sellerId === viewerId ? 'selling' : listing.buyerId === viewerId ? 'bought' : 'market',
    seller: listing.seller,
    buyer: listing.buyer ?? null,
    business: listing.business,
  };
}

function serializeBusinessLoan(loan: any) {
  return {
    id: loan.id,
    amount: loan.amount,
    termDays: loan.termMonths,
    interestRate: loan.interestRate,
    motivationMessage: loan.motivationMessage ?? null,
    collateralAura: loan.collateralAura ?? 0,
    collateralAuraHeld: loan.collateralAuraHeld ?? 0,
    status: loan.status,
    repaidAmount: loan.repaidAmount ?? 0,
    decidedAt: loan.decidedAt ? loan.decidedAt.toISOString() : null,
    collateralClaimedAt: loan.collateralClaimedAt ? loan.collateralClaimedAt.toISOString() : null,
    createdAt: loan.createdAt.toISOString(),
    borrower: loan.borrower,
  };
}

function computeBusinessSuggestedShareAmount(business: {
  startingCapital: number;
  treasuryMoney: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
}, sharePercent: number) {
  const safeSharePercent = Math.max(1, Math.min(95, sharePercent));
  const valuationBase = Math.max(
    1000,
    business.startingCapital + business.treasuryMoney + Math.max(0, (business.monthlyRevenue - business.monthlyExpenses) * 6),
  );
  return Math.max(500, Math.round((valuationBase * safeSharePercent) / 100));
}

export function getBusinessRevenueSnapshot(business: {
  id?: string;
  typeKey: string;
  treasuryMoney: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  customData?: string | null;
  startupProducts?: any[];
  members?: any[];
  resourceInventories?: Array<{ resourceType: string; quantity: number }>;
}) {
  const startupProducts = business.typeKey === 'startup'
    ? (business.startupProducts ?? []).map((product: any) => serializeStartupProduct(product))
    : [];
  const inputCoverage = getBusinessInputCoverage(business.typeKey, business.resourceInventories ?? []);
  const event = business.id ? getBusinessFinancialEvent(business.id, business.typeKey) : {
    revenueMultiplier: 1,
    expenseMultiplier: 1,
  };
  const rawMonthlyRevenue = business.typeKey === 'bank'
    ? Math.max(0, Math.floor(business.treasuryMoney * 0.04))
    : business.typeKey === 'startup'
      ? startupProducts.reduce((total: number, product: any) => total + product.currentRevenue, 0)
      : business.typeKey === 'youtube'
        ? business.monthlyRevenue + Math.min(2200, Math.floor((safeJsonParse<{ totalViews?: number }>(business.customData, { totalViews: 0 }).totalViews ?? 0) / 200))
        : business.typeKey === 'formation'
          ? business.monthlyRevenue + (business.members?.length ?? 0) * 250
          : business.monthlyRevenue;
  const rawMonthlyExpenses = business.typeKey === 'bank'
    ? 0
    : business.monthlyExpenses;
  const monthlyRevenue = Math.floor(rawMonthlyRevenue * inputCoverage.multiplier * event.revenueMultiplier);
  const monthlyExpenses = Math.floor(rawMonthlyExpenses * event.expenseMultiplier);
  const dailyRevenue = monthlyRevenue > 0 ? Math.max(1, Math.round(monthlyRevenue / 30)) : 0;

  return {
    monthlyRevenue,
    monthlyExpenses,
    dailyRevenue,
    startupProducts,
    inputCoverage,
  };
}

function getBusinessFinancialSnapshot(business: any, monthlyRevenue: number, monthlyExpenses: number) {
  const payrollDaily = (business.members ?? [])
    .filter((member: any) => member.status === 'ACTIVE')
    .reduce((sum: number, member: any) => sum + Math.max(0, member.salary ?? 0), 0);
  const dailyRevenue = monthlyRevenue > 0 ? Math.max(1, Math.round(monthlyRevenue / 30)) : 0;
  const dailyOperatingExpenses = monthlyExpenses > 0 ? Math.max(1, Math.round(monthlyExpenses / 30)) : 0;
  const dailyExpenses = dailyOperatingExpenses + payrollDaily;
  const netDaily = dailyRevenue - dailyExpenses;
  const inventories = business.resourceInventories ?? [];
  const offers = business.supplyOffers ?? [];
  const stockValueGlobal = inventories.reduce((sum: number, inventory: any) =>
    sum + inventory.quantity * getGlobalMarketUnitPrice(business.typeKey, inventory.resourceType), 0);
  const stockValueOffer = inventories.reduce((sum: number, inventory: any) => {
    const offer = offers.find((entry: any) => entry.resourceType === inventory.resourceType && entry.isActive);
    return sum + inventory.quantity * (offer?.unitPrice ?? getGlobalMarketUnitPrice(business.typeKey, inventory.resourceType));
  }, 0);
  const liveStatuses = new Set(['PENDING', 'ACTIVE']);
  const contractExposure = (business.supplyContractsAsBuyer ?? [])
    .filter((contract: any) => liveStatuses.has(contract.status))
    .reduce((sum: number, contract: any) => sum + Math.max(0, contract.totalQuantity - contract.deliveredQuantity) * contract.unitPrice, 0);
  const receivables = (business.supplyContractsAsSupplier ?? [])
    .filter((contract: any) => liveStatuses.has(contract.status))
    .reduce((sum: number, contract: any) => sum + Math.max(0, contract.totalQuantity - contract.deliveredQuantity) * contract.unitPrice, 0);
  const activeDebt = (business.loans ?? [])
    .filter((loan: any) => loan.status === 'ACTIVE')
    .reduce((sum: number, loan: any) => {
      const totalOwed = Math.round(loan.amount * (1 + (loan.interestRate ?? 0) / 100));
      return sum + Math.max(0, totalOwed - (loan.repaidAmount ?? 0));
    }, 0);
  const inputCoverage = getBusinessInputCoverage(business.typeKey, inventories);
  const event = getBusinessFinancialEvent(business.id, business.typeKey);
  const supplierReliability = getSupplierReliability(business.supplyContractsAsSupplier ?? []);
  const runwayDays = getRunwayDays(business.treasuryMoney, Math.max(0, dailyExpenses - dailyRevenue));
  const creditScore = getBusinessCreditScore({
    treasuryMoney: business.treasuryMoney,
    monthlyRevenue,
    monthlyExpenses: monthlyExpenses + payrollDaily * 30,
    satisfaction: business.satisfaction ?? 70,
    activeDebt,
    reliabilityPercent: supplierReliability.percent,
    runwayDays,
  });
  const riskScore = Math.max(0, Math.min(100,
    100
      - Math.round((creditScore - 300) / 5.5)
      + Math.max(0, 70 - inputCoverage.percent)
      + event.riskDelta,
  ));

  return {
    dailyRevenue,
    dailyExpenses,
    payrollDaily,
    netDaily,
    runwayDays,
    stockValueGlobal,
    stockValueOffer,
    contractExposure,
    receivables,
    activeDebt,
    creditScore,
    riskScore,
    inputCoverage,
    supplierReliability,
    event,
  };
}

function serializeEmploymentInvitation(invitation: any, viewerId: string) {
  const viewerRole = invitation.employerId === viewerId ? 'EMPLOYER' : invitation.employeeId === viewerId ? 'EMPLOYEE' : null;
  const needsViewerAcceptance = viewerRole === 'EMPLOYER'
    ? !invitation.employerAcceptedAt
    : viewerRole === 'EMPLOYEE'
      ? !invitation.employeeAcceptedAt
      : false;
  const waitingOn = invitation.employerAcceptedAt && !invitation.employeeAcceptedAt
    ? 'EMPLOYEE'
    : invitation.employeeAcceptedAt && !invitation.employerAcceptedAt
      ? 'EMPLOYER'
      : invitation.employerAcceptedAt && invitation.employeeAcceptedAt
        ? 'NONE'
        : 'BOTH';

  return {
    id: invitation.id,
    role: invitation.role,
    salary: invitation.salary ?? 0,
    message: invitation.message ?? null,
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
    updatedAt: invitation.updatedAt.toISOString(),
    respondedAt: invitation.respondedAt ? invitation.respondedAt.toISOString() : null,
    initiatedByRole: invitation.initiatedByRole,
    employerAcceptedAt: invitation.employerAcceptedAt ? invitation.employerAcceptedAt.toISOString() : null,
    employeeAcceptedAt: invitation.employeeAcceptedAt ? invitation.employeeAcceptedAt.toISOString() : null,
    viewerRole,
    needsViewerAcceptance,
    waitingOn,
    inviter: invitation.inviter,
    invitee: invitation.invitee,
    employee: invitation.employeeId === invitation.inviterId ? invitation.inviter : invitation.invitee,
    employer: invitation.employerId === invitation.inviterId ? invitation.inviter : invitation.invitee,
  };
}

const REVIEW_PROMPT_DELAY_MS = 15_000;

function getReviewPromptAt(date = new Date()) {
  return new Date(date.getTime() + REVIEW_PROMPT_DELAY_MS);
}

function getBusinessReviewEligibilityEntry(business: any, viewerId: string) {
  return (business.reviewEligibilities ?? []).find((entry: any) => entry.userId === viewerId && entry.targetType === 'BUSINESS') ?? null;
}

function getFormationReviewEligibilityEntry(product: any, viewerId: string) {
  return (product.reviewEligibilities ?? []).find((entry: any) => entry.userId === viewerId && entry.targetType === 'FORMATION_PRODUCT') ?? null;
}

function getBusinessReviewStatus(business: any, viewerId: string) {
  const entry = getBusinessReviewEligibilityEntry(business, viewerId);
  return {
    canRate: Boolean(entry && !entry.reviewedAt && business.ownerId !== viewerId),
    reviewPromptAt: entry?.promptAt ? new Date(entry.promptAt).toISOString() : null,
    reviewPromptedAt: entry?.promptedAt ? new Date(entry.promptedAt).toISOString() : null,
  };
}

function serializeFormationProduct(product: any, viewerId: string, options?: { viewerIsAdmin?: boolean; viewerOwnsBusiness?: boolean }) {
  const cacheKey = `${product.id}:${viewerId}:${options?.viewerIsAdmin ?? false}:${options?.viewerOwnsBusiness ?? false}`;
  const cached = _formationProductCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const viewerPurchase = (product.purchases ?? []).find((purchase: any) => purchase.userId === viewerId) ?? null;
  const reviewEligibility = getFormationReviewEligibilityEntry(product, viewerId);
  const ratings = (product.ratings ?? []).map((entry: any) => ({
    id: entry.id,
    rating: entry.rating,
    comment: entry.comment ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    user: entry.user,
  }));
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((sum: number, entry: any) => sum + entry.rating, 0) / ratings.length) * 10) / 10
    : null;
  const viewerIsAdmin = Boolean(options?.viewerIsAdmin);
  const viewerOwnsBusiness = Boolean(options?.viewerOwnsBusiness);

  const result = {
    id: product.id,
    title: product.title,
    description: product.description ?? null,
    price: product.price,
    url: product.url ?? null,
    imageUrl: product.imageUrl ?? null,
    createdAt: product.createdAt.toISOString(),
    status: product.status ?? 'APPROVED',
    reviewedAt: product.reviewedAt ? product.reviewedAt.toISOString() : null,
    reviewedBy: product.reviewedBy ?? null,
    reviewerNote: product.reviewerNote ?? null,
    attachmentOriginalName: product.attachmentOriginalName ?? null,
    attachmentMimeType: product.attachmentMimeType ?? null,
    attachmentPath: product.attachmentPath ?? null,
    attachmentSizeBytes: product.attachmentSizeBytes ?? null,
    hasAttachment: Boolean(product.attachmentPath),
    accessMode: product.attachmentPath ? 'FILE' : 'EXTERNAL_URL',
    avgRating,
    ratingCount: ratings.length,
    ratings,
    viewerHasPurchased: Boolean(viewerPurchase),
    viewerPurchasedAt: viewerPurchase?.purchasedAt ? new Date(viewerPurchase.purchasedAt).toISOString() : null,
    viewerLastAccessedAt: viewerPurchase?.lastAccessedAt ? new Date(viewerPurchase.lastAccessedAt).toISOString() : null,
    canReview: Boolean(reviewEligibility && !reviewEligibility.reviewedAt && !viewerOwnsBusiness),
    reviewPromptAt: reviewEligibility?.promptAt ? new Date(reviewEligibility.promptAt).toISOString() : null,
    reviewPromptedAt: reviewEligibility?.promptedAt ? new Date(reviewEligibility.promptedAt).toISOString() : null,
    canModerate: viewerIsAdmin,
  };
  _formationProductCache.set(cacheKey, { data: result, expiresAt: Date.now() + YOU_CACHE_TTL_MS });
  return result;
}

function serializeBusiness(business: any, viewerId: string, options?: { viewerIsAdmin?: boolean }) {
  const type = BUSINESS_TYPE_MAP.get(business.typeKey);
  const viewerIsAdmin = Boolean(options?.viewerIsAdmin);
  const ownerKind = isBusinessManagerSync(business, viewerId) ? 'you' : 'player';
  const treasuryMoney = business.treasuryMoney;
  const businessRevenue = getBusinessRevenueSnapshot(business);
  const startupProducts = businessRevenue.startupProducts;
  const monthlyRevenue = businessRevenue.monthlyRevenue;
  const monthlyExpenses = businessRevenue.monthlyExpenses;
  const shareholders = (business.shareholders ?? []).map((shareholder: any) => serializeShareholder(shareholder));
  const soldSharePercent = shareholders.reduce((sum: number, shareholder: any) => sum + shareholder.sharePercent, 0);
  const ownerSharePercent = Math.max(0, Math.round((100 - soldSharePercent) * 100) / 100);
  const viewerShareholding = shareholders.find((shareholder: any) => shareholder.user.id === viewerId) ?? null;
  const formationProducts = business.typeKey === 'formation'
    ? (business.formationProducts ?? [])
      .filter((p: any) => viewerIsAdmin || business.ownerId === viewerId || p.status === 'APPROVED')
      .map((p: any) => serializeFormationProduct(p, viewerId, { viewerIsAdmin, viewerOwnsBusiness: business.ownerId === viewerId }))
    : [];
  const allFormationRatings = formationProducts.flatMap((product: any) => product.ratings ?? []);
  const businessReviewStatus = getBusinessReviewStatus(business, viewerId);
  const suggestedShareAmount = computeBusinessSuggestedShareAmount({
    startingCapital: business.startingCapital,
    treasuryMoney,
    monthlyRevenue,
    monthlyExpenses,
  }, 10);
  const illegalData = business.typeKey === 'illegal_market'
    ? getIllegalBusinessCustomData(business.customData)
    : null;
  const constructionProject = serializeConstructionProject(business.constructionProject);
  const underConstruction = isConstructionActive(business.constructionProject);
  const financials = getBusinessFinancialSnapshot(business, underConstruction ? 0 : monthlyRevenue, underConstruction ? 0 : monthlyExpenses);

  return {
    id: business.id,
    name: business.name,
    typeKey: business.typeKey,
    type: type ?? null,
    ownerId: business.ownerId,
    owner: business.owner,
    ownerKind,
    verified: business.verified,
    description: business.description,
    logoUrl: business.logoUrl ?? null,
    location: business.location,
    mapX: business.mapX ?? null,
    mapY: business.mapY ?? null,
    foundedAt: business.createdAt.toISOString(),
    foundedLabel: business.createdAt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    hiring: business.hiring,
    startingCapital: business.startingCapital,
    treasuryMoney,
    monthlyRevenue: underConstruction ? 0 : monthlyRevenue,
    monthlyExpenses: underConstruction ? 0 : monthlyExpenses,
    financials,
    satisfaction: business.satisfaction,
    constructionProject,
    underConstruction,
    memberCount: business.members.length,
    actions: underConstruction ? [] : (type?.actions ?? []),
    members: business.members.map((member: any) => {
      const today = new Date().toISOString().slice(0, 10);
      return {
        id: member.id,
        role: member.role,
        specialty: member.specialty ?? null,
        isPrimaryLawyer: Boolean(member.isPrimaryLawyer),
        displayOrder: member.displayOrder ?? 0,
        status: member.status,
        salary: member.salary ?? 0,
        workedToday: member.lastWorkDate === today,
        user: member.user,
      };
    }),
    pendingInvitations: business.invitations.map((invite: any) => ({
      ...serializeEmploymentInvitation(invite, viewerId),
    })),
    recentLoans: business.loans.map((loan: any) => serializeBusinessLoan(loan)),
    recentInvestments: business.investments.map((investment: any) => ({
      id: investment.id,
      amount: investment.amount,
      riskLevel: investment.riskLevel,
      expectedReturnMin: investment.expectedReturnMin,
      expectedReturnMax: investment.expectedReturnMax,
      createdAt: investment.createdAt.toISOString(),
      investor: investment.investor,
    })),
    shareholders,
    ownerSharePercent,
    isShared: shareholders.length > 0,
    viewerSharePercent: viewerShareholding?.sharePercent ?? 0,
    viewerInvestedAmount: viewerShareholding?.investedAmount ?? 0,
    suggestedShareAmount,
    pendingShareholderProposals: (business.shareholderProposals ?? [])
      .filter((proposal: any) => proposal.status === 'PENDING')
      .map((proposal: any) => serializeShareProposal(proposal, viewerId)),
    transferHistory: business.transferHistory.map((entry: any) => serializeTransferHistoryEntry(entry)),
    revenueHistory: (business.transactions ?? [])
      .filter((tx: any) => tx.type === 'DAILY_REVENUE')
      .reverse()
      .map((tx: any) => tx.amount),
    pendingBuyoutOffers: business.buyoutOffers
      .filter((offer: any) => offer.status === 'PENDING')
      .map((offer: any) => serializeBuyoutOffer(offer, viewerId)),
    startupProducts,
    livretEpargneUnlocked: business.typeKey === 'bank' ? (business.livretEpargneUnlocked ?? false) : undefined,
    loanInterestRate: business.typeKey === 'bank' ? (business.loanInterestRate ?? 4) : undefined,
    transferFeeRate: business.typeKey === 'transfer' ? (business.transferFeeRate ?? 2) : undefined,
    formationUrl: business.typeKey === 'formation' ? (business.formationUrl ?? null) : undefined,
    formationPrice: business.typeKey === 'formation' ? (business.formationPrice ?? 500) : undefined,
    customData: business.typeKey === 'illegal_market'
      ? illegalData?.items
      : business.customData ? JSON.parse(business.customData) : undefined,
    illegalUpgrades: business.typeKey === 'illegal_market'
      ? ILLEGAL_BUSINESS_UPGRADES.map((upgrade) => {
          const purchased = illegalData?.unlockedUpgradeKeys.includes(upgrade.key) ?? false;
          return {
            key: upgrade.key,
            label: upgrade.label,
            description: upgrade.description,
            cost: upgrade.cost,
            revenueBonus: upgrade.revenueBonus,
            satisfactionBonus: upgrade.satisfactionBonus,
            purchased,
            purchasedAt: purchased ? (illegalData?.upgradedAtByKey?.[upgrade.key] ?? null) : null,
          };
        })
      : undefined,
    formationProducts: business.typeKey === 'formation' ? formationProducts : undefined,
    npcLastCollectedAt: (business.typeKey === 'lemonade' || business.typeKey === 'epicerie' || business.typeKey === 'restaurant')
      ? (business.npcLastCollectedAt ? new Date(business.npcLastCollectedAt).toISOString() : null)
      : undefined,
    level: type?.level ?? 1,
    avgRating: business.typeKey === 'formation'
      ? (allFormationRatings.length > 0
        ? Math.round((allFormationRatings.reduce((sum: number, r: any) => sum + r.rating, 0) / allFormationRatings.length) * 10) / 10
        : null)
      : business.ratings && business.ratings.length > 0
        ? Math.round((business.ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / business.ratings.length) * 10) / 10
        : null,
    ratingCount: business.typeKey === 'formation' ? allFormationRatings.length : business.ratings?.length ?? 0,
    ratings: (business.ratings ?? []).map((entry: any) => ({
      id: entry.id,
      rating: entry.rating,
      comment: entry.comment ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      user: entry.user,
    })),
    canRate: business.typeKey === 'formation' ? false : businessReviewStatus.canRate,
    reviewPromptAt: business.typeKey === 'formation' ? null : businessReviewStatus.reviewPromptAt,
    reviewPromptedAt: business.typeKey === 'formation' ? null : businessReviewStatus.reviewPromptedAt,
    supportAgent: business.supportAgent ?? null,
    supportEnabled: Boolean(business.supportAgentId),
    isStateOwned: business.isStateOwned ?? false,
  };
}

async function rateBusiness(userId: string, businessId: string, rating: number, comment?: string | null) {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error('INVALID_BUSINESS_RATING');
  }
  const normalizedComment = typeof comment === 'string'
    ? comment.trim().slice(0, 500)
    : null;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { reviewEligibilities: true },
  });
  if (!business) {
    throw new Error('BUSINESS_NOT_FOUND');
  }
  if (business.typeKey === 'formation') {
    throw new Error('BUSINESS_RATING_NOT_ALLOWED');
  }
  const eligibility = getBusinessReviewEligibilityEntry(business, userId);
  if (!eligibility || business.ownerId === userId) {
    throw new Error('BUSINESS_RATING_NOT_ALLOWED');
  }
  await prisma.$transaction(async (tx) => {
    await tx.businessRating.upsert({
      where: { businessId_userId: { businessId, userId } },
      update: { rating, comment: normalizedComment || null },
      create: { businessId, userId, rating, comment: normalizedComment || null },
    });
    await tx.reviewEligibility.update({
      where: { id: eligibility.id },
      data: {
        reviewedAt: new Date(),
        promptedAt: eligibility.promptedAt ?? new Date(),
      },
    });
  });
  logYouAdmin('business_rate', userId, undefined, business.id, business.name, {
    rating,
    comment: normalizedComment || null,
  });
}

export async function rateFormationProduct(userId: string, businessId: string, productId: string, rating: number, comment?: string | null) {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error('INVALID_BUSINESS_RATING');
  }
  const normalizedComment = typeof comment === 'string'
    ? comment.trim().slice(0, 500)
    : null;
  const product = await prisma.formationProduct.findUnique({
    where: { id: productId },
    include: {
      business: {
        select: { id: true, ownerId: true, typeKey: true, name: true },
      },
      reviewEligibilities: true,
    },
  });
  if (!product || product.businessId !== businessId || product.business.typeKey !== 'formation') {
    throw new Error('FORMATION_PRODUCT_NOT_FOUND');
  }
  const eligibility = getFormationReviewEligibilityEntry(product, userId);
  if (!eligibility || product.business.ownerId === userId) {
    throw new Error('BUSINESS_RATING_NOT_ALLOWED');
  }

  await prisma.$transaction(async (tx) => {
    await tx.formationProductRating.upsert({
      where: { productId_userId: { productId: product.id, userId } },
      update: { rating, comment: normalizedComment || null },
      create: {
        productId: product.id,
        businessId,
        userId,
        rating,
        comment: normalizedComment || null,
      },
    });
    await tx.formationProductPurchase.updateMany({
      where: { userId, productId: product.id },
      data: {
        reviewedAt: new Date(),
        reviewPromptedAt: new Date(),
      },
    });
    await tx.reviewEligibility.update({
      where: { id: eligibility.id },
      data: {
        reviewedAt: new Date(),
        promptedAt: eligibility.promptedAt ?? new Date(),
      },
    });
  });

  logYouAdmin('business_rate', userId, undefined, businessId, product.title, {
    rating,
    comment: normalizedComment || null,
    productId: product.id,
    targetType: 'FORMATION_PRODUCT',
  });
}

export { rateBusiness };

function serializeRelationship(relationship: any, viewerId: string, ctx?: { viewerIsMarried: boolean; pendingCourtCaseIds: Set<string> }) {
  const otherUser = relationship.userAId === viewerId ? relationship.userB : relationship.userA;
  const pendingMarriageProposal = relationship.marriageProposals.find((proposal: any) => proposal.status === 'PENDING') ?? null;
  const pendingMarriageProposalDirection = pendingMarriageProposal
    ? (pendingMarriageProposal.proposerId === viewerId ? 'sent' : 'received')
    : null;
  const pendingDivorceProposal = relationship.divorceProposals.find((proposal: any) => proposal.status === 'PENDING') ?? null;
  const pendingDivorceProposalDirection = pendingDivorceProposal
    ? (pendingDivorceProposal.proposerId === viewerId ? 'sent' : 'received')
    : null;
  const canRequestDivorce = relationship.status === 'MARRIED' && !pendingDivorceProposal;
  const isActive = ['DATING', 'FRIEND', 'MISTRESS'].includes(relationship.status);
  const canForget = relationship.status !== 'MARRIED' && !pendingMarriageProposal && !pendingDivorceProposal;
  const canMakeMistress = isActive && relationship.status !== 'MISTRESS' && (ctx?.viewerIsMarried ?? false);
  const canSuspectCheating = relationship.status === 'MARRIED';
  const hasPendingCourtCase = ctx?.pendingCourtCaseIds.has(otherUser.id) ?? false;

  return {
    id: relationship.id,
    status: relationship.status,
    connectionLevel: relationship.connectionLevel,
    coupleBalance: relationship.coupleBalance ?? 0,
    createdAt: relationship.createdAt.toISOString(),
    marriedAt: relationship.marriedAt ? relationship.marriedAt.toISOString() : null,
    otherUser,
    canProposeMarriage: (relationship.status === 'DATING' || relationship.status === 'FRIEND') && relationship.connectionLevel >= 70 && !pendingMarriageProposal,
    canDivorce: canRequestDivorce,
    canForget,
    canMakeMistress,
    canSuspectCheating,
    hasPendingCourtCase,
    pendingProposal: pendingMarriageProposal
      ? {
          id: pendingMarriageProposal.id,
          proposerId: pendingMarriageProposal.proposerId,
          recipientId: pendingMarriageProposal.recipientId,
          status: pendingMarriageProposal.status,
          message: pendingMarriageProposal.message,
          createdAt: pendingMarriageProposal.createdAt.toISOString(),
          respondedAt: pendingMarriageProposal.respondedAt ? pendingMarriageProposal.respondedAt.toISOString() : null,
          direction: pendingMarriageProposalDirection,
          canRespond: pendingMarriageProposal.recipientId === viewerId,
        }
      : null,
    pendingDivorceProposal: pendingDivorceProposal
      ? {
          id: pendingDivorceProposal.id,
          proposerId: pendingDivorceProposal.proposerId,
          recipientId: pendingDivorceProposal.recipientId,
          status: pendingDivorceProposal.status,
          message: pendingDivorceProposal.message,
          createdAt: pendingDivorceProposal.createdAt.toISOString(),
          respondedAt: pendingDivorceProposal.respondedAt ? pendingDivorceProposal.respondedAt.toISOString() : null,
          direction: pendingDivorceProposalDirection,
          canRespond: pendingDivorceProposal.recipientId === viewerId,
        }
      : null,
  };
}

export async function getYouState(userId: string) {
  const now = Date.now();
  const cached = _youStateCache.get(userId);
  if (cached && now < cached.expiresAt) return cached.data;

  await ensureUserSkills(userId);

  const relationships = await prisma.relationship.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: RELATIONSHIP_INCLUDE,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });

  const viewerIsMarried = relationships.some((r) => r.status === 'MARRIED');

  // Court cases where viewer is the accused (pending)
  const pendingCourtCases = await prisma.cheatingAccusation.findMany({
    where: { accusedId: userId, status: 'PENDING' },
    include: { accuser: { select: USER_PREVIEW_SELECT } },
  });

  // Build set of accuser IDs for quick lookup in serializeRelationship
  const pendingCourtCaseIds = new Set(pendingCourtCases.map((c: any) => c.accuserId));

  const relatedUserIds = new Set<string>();
  relationships.forEach((relationship) => {
    if (relationship.status !== 'DIVORCED') {
      relatedUserIds.add(relationship.userAId);
      relatedUserIds.add(relationship.userBId);
    }
  });

  const [
    players,
    ownedBusinesses,
    exploreBusinesses,
    memberBusinesses,
    shareholderBusinesses,
    pendingInvitations,
    pendingBuyoutOffers,
    sentBuyoutOffers,
    sentShareholderProposals,
    shareMarketListings,
    myShareMarketListings,
    skills,
    viewerUser,
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        isApproved: true,
        id: { not: userId },
      },
      select: USER_PREVIEW_SELECT,
      orderBy: [{ aura: 'desc' }, { username: 'asc' }],
    }),
    prisma.business.findMany({
      where: { ownerId: userId },
      include: BUSINESS_BASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.business.findMany({
      where: {
        ownerId: { not: userId },
        owner: {
          isApproved: true,
        },
      },
      include: BUSINESS_BASE_INCLUDE,
      orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.business.findMany({
      where: {
        ownerId: { not: userId },
        members: { some: { userId, status: 'ACTIVE' } },
      },
      include: BUSINESS_BASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.business.findMany({
      where: {
        ownerId: { not: userId },
        shareholders: { some: { userId } },
      },
      include: BUSINESS_BASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.businessInvitation.findMany({
      where: {
        status: 'PENDING',
        OR: [
          { employerId: userId },
          { employeeId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        business: {
          include: {
            owner: { select: USER_PREVIEW_SELECT },
          },
        },
        inviter: {
          select: USER_PREVIEW_SELECT,
        },
      },
    }),
    prisma.businessBuyoutOffer.findMany({
      where: {
        ownerId: userId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        bidder: { select: USER_PREVIEW_SELECT },
        owner: { select: USER_PREVIEW_SELECT },
        business: {
          select: {
            id: true,
            name: true,
            typeKey: true,
          },
        },
      },
    }),
    prisma.businessBuyoutOffer.findMany({
      where: {
        bidderId: userId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        bidder: { select: USER_PREVIEW_SELECT },
        owner: { select: USER_PREVIEW_SELECT },
        business: {
          select: {
            id: true,
            name: true,
            typeKey: true,
          },
        },
      },
    }),
    prisma.businessShareProposal.findMany({
      where: {
        investorId: userId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        investor: { select: USER_PREVIEW_SELECT },
        owner: { select: USER_PREVIEW_SELECT },
        business: {
          select: {
            id: true,
            name: true,
            typeKey: true,
          },
        },
      },
    }),
    prisma.businessShareMarketListing.findMany({
      where: {
        status: 'ACTIVE',
        sellerId: { not: userId },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: USER_PREVIEW_SELECT },
        buyer: { select: USER_PREVIEW_SELECT },
        business: {
          select: {
            id: true,
            name: true,
            typeKey: true,
            ownerId: true,
            owner: { select: USER_PREVIEW_SELECT },
          },
        },
      },
    }),
    prisma.businessShareMarketListing.findMany({
      where: {
        status: 'ACTIVE',
        sellerId: userId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: USER_PREVIEW_SELECT },
        buyer: { select: USER_PREVIEW_SELECT },
        business: {
          select: {
            id: true,
            name: true,
            typeKey: true,
            ownerId: true,
            owner: { select: USER_PREVIEW_SELECT },
          },
        },
      },
    }),
    prisma.userSkill.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { unlockedBusinessLevel: true, isAdmin: true, isSuperAdmin: true, youAdblockExpiresAt: true },
    }),
  ]);

  const startupBusinessIds = [...ownedBusinesses, ...exploreBusinesses, ...memberBusinesses, ...shareholderBusinesses]
    .filter((business) => business.typeKey === 'startup')
    .map((business) => business.id);

  if (startupBusinessIds.length > 0) {
    await Promise.all(startupBusinessIds.map((businessId) => ensureStartupProducts(businessId)));
  }

  const [ownedBusinessesWithProducts, exploreBusinessesWithProducts, memberBusinessesWithProducts, shareholderBusinessesWithProducts] = startupBusinessIds.length > 0
    ? await Promise.all([
        prisma.business.findMany({
          where: { id: { in: ownedBusinesses.map((business) => business.id) } },
          include: BUSINESS_BASE_INCLUDE,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.business.findMany({
          where: { id: { in: exploreBusinesses.map((business) => business.id) } },
          include: BUSINESS_BASE_INCLUDE,
          orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.business.findMany({
          where: { id: { in: memberBusinesses.map((business) => business.id) } },
          include: BUSINESS_BASE_INCLUDE,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.business.findMany({
          where: { id: { in: shareholderBusinesses.map((business) => business.id) } },
          include: BUSINESS_BASE_INCLUDE,
          orderBy: { createdAt: 'desc' },
        }),
      ])
    : [ownedBusinesses, exploreBusinesses, memberBusinesses, shareholderBusinesses];

  const serializedSkills = skills
    .map((skill) => serializeSkill(skill))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));
  const viewerIsAdmin = Boolean(viewerUser?.isAdmin || viewerUser?.isSuperAdmin);
  const baseBusinessSlots = getBusinessSlots(skills);
  const businessSlots = viewerIsAdmin
    ? Math.max(baseBusinessSlots, ownedBusinessesWithProducts.length + 1)
    : baseBusinessSlots;
  const unlockedBusinessLevel = viewerUser?.unlockedBusinessLevel ?? 0;
  const temporaryEffects = serializeGlobalTemporaryEffects(viewerUser?.youAdblockExpiresAt ?? null);

  const data = {
    businessTypes: BUSINESS_TYPES,
    skills: serializedSkills,
    businessSlots,
    unlockedBusinessLevel,
    players: players.map((player) => ({
      ...player,
      alreadyInRelationship: relatedUserIds.has(player.id),
    })),
    jobOffers: pendingInvitations.map((invitation) => ({
      ...serializeEmploymentInvitation(invitation, userId),
      business: {
        id: invitation.business.id,
        name: invitation.business.name,
        typeKey: invitation.business.typeKey,
        owner: invitation.business.owner,
      },
    })),
    pendingBuyoutOffers: pendingBuyoutOffers.map((offer) => ({
      ...serializeBuyoutOffer(offer, userId),
      business: offer.business,
    })),
    sentBuyoutOffers: sentBuyoutOffers.map((offer) => ({
      ...serializeBuyoutOffer(offer, userId),
      business: offer.business,
    })),
    sentShareholderProposals: sentShareholderProposals.map((proposal) => ({
      ...serializeShareProposal(proposal, userId),
      business: proposal.business,
    })),
    shareMarketListings: shareMarketListings.map((listing) => serializeShareMarketListing(listing, userId)),
    myShareMarketListings: myShareMarketListings.map((listing) => serializeShareMarketListing(listing, userId)),
    relationships: relationships.map((relationship) => serializeRelationship(relationship, userId, { viewerIsMarried, pendingCourtCaseIds })),
    courtCases: pendingCourtCases.map((c: any) => ({
      id: c.id,
      accuserId: c.accuserId,
      accuser: c.accuser,
      createdAt: c.createdAt.toISOString(),
    })),
    ownedBusinesses: ownedBusinessesWithProducts.map((business) => serializeBusiness(business, userId, { viewerIsAdmin })),
    exploreBusinesses: exploreBusinessesWithProducts.map((business) => serializeBusiness(business, userId, { viewerIsAdmin })),
    memberBusinesses: memberBusinessesWithProducts.map((business) => serializeBusiness(business, userId, { viewerIsAdmin })),
    shareholderBusinesses: shareholderBusinessesWithProducts.map((business) => serializeBusiness(business, userId, { viewerIsAdmin })),
    temporaryEffects,
  };
  _youStateCache.set(userId, { data, expiresAt: Date.now() + YOU_CACHE_TTL_MS });
  return data;
}

function serializeGlobalTemporaryEffects(adblockExpiresAt: Date | null) {
  const now = Date.now();
  const effects: Array<{ key: string; label: string; description: string; expiresAt: string; remainingMs: number }> = [];

  if (adblockExpiresAt) {
    const remainingMs = adblockExpiresAt.getTime() - now;
    if (remainingMs > 0) {
      effects.push({
        key: 'GLOBAL_ADBLOCK',
        label: 'Adblock global actif',
        description: 'Masque les interfaces publicitaires sur tout le site.',
        expiresAt: adblockExpiresAt.toISOString(),
        remainingMs,
      });
    }
  }

  return effects;
}

export async function getGlobalTemporaryEffects(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { youAdblockExpiresAt: true },
  });

  return serializeGlobalTemporaryEffects(user?.youAdblockExpiresAt ?? null);
}

export async function getYouSkills(userId: string) {
  await ensureUserSkills(userId);
  const skills = await prisma.userSkill.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  return skills
    .map((skill) => serializeSkill(skill))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));
}

export async function trainUserSkill(userId: string, skillKey: string) {
  const definition = YOU_SKILL_MAP.get(skillKey as YouSkillKey);
  if (!definition) {
    throw new Error('INVALID_SKILL_KEY');
  }

  await ensureUserSkills(userId);

  const existingSkill = await prisma.userSkill.findUnique({
    where: {
      userId_key: {
        userId,
        key: definition.key,
      },
    },
  });

  if (!existingSkill) {
    throw new Error('INVALID_SKILL_KEY');
  }

  if (!definition.trainable) {
    throw new Error('SKILL_NOT_TRAINABLE');
  }

  if (existingSkill.level >= YOU_SKILL_MAX_LEVEL) {
    throw new Error('SKILL_ALREADY_MAXED');
  }

  const trainingCost = definition.trainingCost * existingSkill.level;
  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, trainingCost);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  const skill = await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, trainingCost);

    let nextLevel = existingSkill.level;
    let nextXp = existingSkill.xp + definition.xpPerTraining;

    while (nextLevel < YOU_SKILL_MAX_LEVEL && nextXp >= YOU_SKILL_XP_PER_LEVEL) {
      nextXp -= YOU_SKILL_XP_PER_LEVEL;
      nextLevel += 1;
    }

    if (nextLevel >= YOU_SKILL_MAX_LEVEL) {
      nextLevel = YOU_SKILL_MAX_LEVEL;
      nextXp = YOU_SKILL_XP_PER_LEVEL;
    }

    return tx.userSkill.update({
      where: { id: existingSkill.id },
      data: {
        level: nextLevel,
        xp: nextXp,
      },
    });
  });

  await emitSharedBalanceUpdates(prisma, userId);

  logYouAdmin('skill_train', userId, undefined, definition.key, definition.key, {
    skillKey: definition.key,
    trainingCost,
    levelBefore: existingSkill.level,
    levelAfter: skill.level,
  });

  const serialized = serializeSkill(skill);
  if (!serialized) {
    throw new Error('INVALID_SKILL_KEY');
  }

  return serialized;
}

export async function createBusiness(userId: string, input: { name: string; typeKey: string; capital: number; description?: string; location?: string }, callerIsAdmin = false) {
  await ensureUserSkills(userId);

  const type = BUSINESS_TYPE_MAP.get(input.typeKey);
  if (!type) {
    throw new Error('INVALID_BUSINESS_TYPE');
  }

  // Admin-only business types
  if (type.isAdminOnly && !callerIsAdmin) {
    throw new Error('BUSINESS_TYPE_ADMIN_ONLY');
  }

  const name = input.name.trim();
  if (name.length < 3) {
    throw new Error('INVALID_BUSINESS_NAME');
  }

  if (input.capital < type.minCapital) {
    throw new Error('BUSINESS_CAPITAL_TOO_LOW');
  }

  const creationCost = callerIsAdmin ? 0 : type.creationFee;
  const startingCapital = type.key === 'bank' ? 0 : input.capital;
  const constructionRecipe = callerIsAdmin || type.isStateOwned ? null : getConstructionRecipe(type.key);
  let unlockedBusinessLevel = 0;

  if (!callerIsAdmin) {
    const [skills, ownedBusinessCount, viewer] = await Promise.all([
      prisma.userSkill.findMany({
        where: { userId },
        select: { key: true, level: true },
      }),
      prisma.business.count({
        where: { ownerId: userId },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { unlockedBusinessLevel: true, isAdmin: true, isSuperAdmin: true },
      }),
    ]);
    const bypassBusinessSlotLimit = Boolean(viewer?.isAdmin || viewer?.isSuperAdmin);
    const businessSlots = getBusinessSlots(skills);
    if (!bypassBusinessSlotLimit && ownedBusinessCount >= businessSlots) {
      throw new Error('BUSINESS_SLOT_LIMIT_REACHED');
    }

    unlockedBusinessLevel = viewer?.unlockedBusinessLevel ?? 0;
    const socialSkillLevel = skills.find((skill) => skill.key === 'social')?.level ?? 1;
    if (type.key === 'youtube' && socialSkillLevel < 3) {
      throw new Error('YOUTUBE_SOCIAL_LEVEL_REQUIRED');
    }
    const requiredUnlock = type.level - 1; // to create level N, must have unlocked N-1
    if (type.level > 1 && unlockedBusinessLevel < requiredUnlock) {
      throw new Error('BUSINESS_LEVEL_LOCKED');
    }
  }

  const totalCost = creationCost + startingCapital;
  if (totalCost > 0) {
    const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, totalCost);
    if (!hasSharedMoney) {
      throw new Error('INSUFFICIENT_MONEY');
    }
  }

  const business = await prisma.$transaction(async (tx) => {
    if (totalCost > 0) {
      await debitSharedMoney(tx, userId, totalCost);
    }
    const createdBusiness = await tx.business.create({
      data: {
        ownerId: userId,
        name,
        typeKey: type.key,
        description: input.description?.trim() || type.description,
        location: input.location?.trim() || 'Institution de l\'Etat',
        startingCapital,
        treasuryMoney: startingCapital,
        monthlyRevenue: type.monthlyRevenue,
        monthlyExpenses: type.monthlyExpenses,
        satisfaction: type.satisfaction,
        verified: type.isStateOwned ? true : false,
        hiring: type.isAdminOnly ? false : true,
        isStateOwned: type.isStateOwned ?? false,
        customData: type.key === 'youtube'
          ? JSON.stringify({ videos: [], totalViews: 0, sponsors: [] })
          : type.key === 'illegal_market'
            ? JSON.stringify(getDefaultIllegalBusinessCustomData())
          : null,
      },
    });

    if (constructionRecipe) {
      await tx.businessConstructionProject.create({
        data: {
          businessId: createdBusiness.id,
          typeKey: type.key,
          recipeKey: constructionRecipe.key,
          materials: {
            create: constructionRecipe.materials.map((material) => ({
              resourceType: material.resourceType,
              requiredQuantity: material.quantity,
              deliveredQuantity: 0,
            })),
          },
        },
      });
    }

    if (type.key === 'startup') {
      await Promise.all(
        STARTUP_PRODUCTS.map((product) =>
          tx.businessStartupProduct.create({
            data: {
              businessId: createdBusiness.id,
              slotIndex: product.slotIndex,
              name: product.name,
            },
          })
        )
      );
    }

    return tx.business.findUniqueOrThrow({
      where: { id: createdBusiness.id },
      include: BUSINESS_BASE_INCLUDE,
    });
  });

  await emitSharedBalanceUpdates(prisma, userId);

  // Update unlocked level (only goes up, never down)
  if (type.level > unlockedBusinessLevel) {
    await prisma.user.update({
      where: { id: userId },
      data: { unlockedBusinessLevel: type.level },
    });
  }

  logYouAdmin('business_create', userId, undefined, business.id, business.name, {
    businessType: business.typeKey,
    creationCost,
    startingCapital,
  });

  // Affaires XP: créer une entreprise (proportionnel aux frais de création, min 2)
  void grantSkillXp(userId, 'affaires', Math.max(2, Math.floor(creationCost / 500)));
  if (type.key === 'illegal_market') {
    void grantSkillXp(userId, 'illegalite', 20);
  }

  return serializeBusiness(business, userId);
}

async function handleInviteAction(userId: string, business: any, input: { inviteeIds: string[]; role: string; salary?: number; message?: string }) {
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) {
    throw new Error('BUSINESS_INVITE_FORBIDDEN');
  }

  const inviteeIds = Array.from(new Set((input.inviteeIds || []).filter((inviteeId) => inviteeId && inviteeId !== userId)));
  const salary = Number(input.salary ?? 0);
  const message = typeof input.message === 'string' && input.message.trim() ? input.message.trim().slice(0, 240) : null;
  if (inviteeIds.length === 0) {
    throw new Error('INVITEE_REQUIRED');
  }
  if (!Number.isInteger(salary) || salary < 0) {
    throw new Error('INVALID_SALARY');
  }

  const approvedInvitees = await prisma.user.findMany({
    where: {
      id: { in: inviteeIds },
      isApproved: true,
    },
    select: { id: true, username: true },
  });

  const existingMembers = await prisma.businessMember.findMany({
    where: {
      businessId: business.id,
      userId: { in: inviteeIds },
    },
    select: { userId: true },
  });

  const existingInvitations = await prisma.businessInvitation.findMany({
    where: {
      businessId: business.id,
      employeeId: { in: inviteeIds },
      status: 'PENDING',
    },
    select: { employeeId: true },
  });

  const memberIds = new Set(existingMembers.map((member) => member.userId));
  const pendingIds = new Set(existingInvitations.map((invite) => invite.employeeId));

  const creatableInvitees = approvedInvitees.filter((invitee) => !memberIds.has(invitee.id) && !pendingIds.has(invitee.id));

  if (creatableInvitees.length === 0) {
    throw new Error('NO_NEW_INVITATIONS');
  }

  const invitations = await Promise.all(
    creatableInvitees.map((invitee) =>
      prisma.businessInvitation.create({
        data: {
          businessId: business.id,
          inviterId: userId,
          inviteeId: invitee.id,
          employerId: business.ownerId,
          employeeId: invitee.id,
          initiatedByRole: 'EMPLOYER',
          role: input.role || 'employee',
          salary,
          message,
          employerAcceptedAt: new Date(),
        },
      })
    )
  );

  const invitationByInviteeId = new Map(invitations.map((invitation) => [invitation.inviteeId, invitation]));

  await Promise.allSettled(
    creatableInvitees.map((invitee) =>
      createNotification({
        userId: invitee.id,
        type: 'SYSTEM',
        title: 'Proposition de contrat',
        body: `${business.owner.username} te propose un poste chez ${business.name} comme ${input.role || 'employee'} pour ${salary.toLocaleString('fr-FR')} money/jour.`,
        data: {
          invitationId: invitationByInviteeId.get(invitee.id)?.id ?? null,
          businessId: business.id,
          businessName: business.name,
          role: input.role || 'employee',
          salary,
          actionType: 'BUSINESS_INVITATION',
        },
        link: '/you?tab=travail',
        icon: 'briefcase-business',
      })
    )
  );

  logYouAdmin('business_invite', userId, business.owner.username, business.id, business.name, {
    invitedCount: creatableInvitees.length,
    inviteeIds: creatableInvitees.map((invitee) => invitee.id),
    inviteeNames: creatableInvitees.map((invitee) => invitee.username),
    role: input.role || 'employee',
    salary,
  });

  return {
    invited: creatableInvitees.length,
  };
}

export async function applyToBusiness(userId: string, businessId: string, input: { role?: string; salary?: number; message?: string }) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: { select: USER_PREVIEW_SELECT },
    },
  });

  if (!business) {
    throw new Error('BUSINESS_NOT_FOUND');
  }

  if (business.ownerId === userId) {
    throw new Error('BUSINESS_INVITE_FORBIDDEN');
  }
  if (!business.hiring) {
    throw new Error('BUSINESS_ACTION_UNAVAILABLE');
  }

  const role = typeof input.role === 'string' && input.role.trim() ? input.role.trim().slice(0, 40) : 'employee';
  const salary = Number(input.salary ?? 0);
  const message = typeof input.message === 'string' && input.message.trim() ? input.message.trim().slice(0, 240) : null;

  if (!Number.isInteger(salary) || salary < 0) {
    throw new Error('INVALID_SALARY');
  }

  const [existingMember, existingPendingInvitation, applicant] = await Promise.all([
    prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId,
        },
      },
      select: { id: true },
    }),
    prisma.businessInvitation.findFirst({
      where: {
        businessId,
        employeeId: userId,
        status: 'PENDING',
      },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: USER_PREVIEW_SELECT,
    }),
  ]);

  if (!applicant) {
    throw new Error('USER_NOT_FOUND');
  }

  if (existingMember || existingPendingInvitation) {
    throw new Error('NO_NEW_INVITATIONS');
  }

  const invitation = await prisma.businessInvitation.create({
    data: {
      businessId,
      inviterId: userId,
      inviteeId: business.ownerId,
      employerId: business.ownerId,
      employeeId: userId,
      initiatedByRole: 'EMPLOYEE',
      role,
      salary,
      message,
      employeeAcceptedAt: new Date(),
    },
  });

  await Promise.allSettled([
    createNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      title: 'Nouvelle candidature',
      body: `${applicant.username} candidate chez ${business.name} comme ${role} pour ${salary.toLocaleString('fr-FR')} money/jour.`,
      data: {
        invitationId: invitation.id,
        businessId: business.id,
        businessName: business.name,
        role,
        salary,
        actionType: 'BUSINESS_INVITATION',
      },
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Candidature envoyee',
      body: `Ta candidature chez ${business.name} est en attente de validation.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
  ]);

  logYouAdmin('business_invite', userId, applicant.username, business.id, business.name, {
    application: true,
    role,
    salary,
  });

  return { id: invitation.id };
}

async function handleLoanAction(
  userId: string,
  business: any,
  input: { amount: number; durationDays: number; collateralAura?: number; motivationMessage?: string }
) {
  if (business.ownerId === userId) {
    throw new Error('BUSINESS_LOAN_SELF_FORBIDDEN');
  }

  const amount = Number(input.amount);
  const durationDays = Number(input.durationDays);
  if (!Number.isFinite(amount) || amount < 500) {
    throw new Error('INVALID_LOAN_AMOUNT');
  }

  if (!Number.isFinite(durationDays) || durationDays < 1) {
    throw new Error('INVALID_LOAN_DURATION');
  }

  const collateralAura = Math.floor(Number(input.collateralAura ?? 0));
  if (!Number.isFinite(collateralAura) || collateralAura < 0) {
    throw new Error('INVALID_LOAN_COLLATERAL');
  }

  const motivationMessage = typeof input.motivationMessage === 'string' ? input.motivationMessage.trim() : '';
  if (motivationMessage.length > 400) {
    throw new Error('LOAN_MOTIVATION_TOO_LONG');
  }

  const [borrower, owner] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, aura: true, money: true },
    }),
    prisma.user.findUnique({
      where: { id: business.ownerId },
      select: { id: true, username: true, aura: true, money: true },
    }),
  ]);

  if (!borrower || !owner) {
    throw new Error('USER_NOT_FOUND');
  }

  if (collateralAura > Number(borrower.aura ?? 0)) {
    throw new Error('LOAN_COLLATERAL_AURA_TOO_LOW');
  }

  const interestRate = business.loanInterestRate ?? 4;

  const loan = await prisma.businessLoan.create({
    data: {
      businessId: business.id,
      borrowerId: userId,
      amount,
      termMonths: durationDays,
      interestRate,
      motivationMessage: motivationMessage || null,
      collateralAura,
      status: 'PENDING',
    },
  });

  await Promise.allSettled([
    createNotification({
      userId: owner.id,
      type: 'SYSTEM',
      title: 'Nouvelle demande de pret',
      body: `${borrower.username} demande ${amount.toLocaleString('fr-FR')} money via ${business.name}${collateralAura > 0 ? ` avec ${collateralAura.toLocaleString('fr-FR')} aura en hypothèque` : ''}.`,
      link: '/you?tab=travail',
      icon: 'credit-card',
    }),
    createNotification({
      userId: borrower.id,
      type: 'SYSTEM',
      title: 'Demande de pret envoyee',
      body: `Ta demande de ${amount.toLocaleString('fr-FR')} money attend la validation de ${owner.username}${collateralAura > 0 ? ` avec ${collateralAura.toLocaleString('fr-FR')} aura mises en garantie` : ''}.`,
      link: '/you?tab=explore',
      icon: 'landmark',
    }),
  ]);

  logYouAdmin('business_loan_request', userId, borrower.username, business.id, business.name, {
    amount,
    durationDays,
    interestRate,
    collateralAura,
    motivationMessage: motivationMessage || null,
  });

  return {
    id: loan.id,
    amount,
    durationDays,
    interestRate,
    collateralAura,
    motivationMessage: motivationMessage || null,
    status: loan.status,
  };
}

async function handleDepositAction(userId: string, business: any, input: { amount: number }) {
  if (!isBusinessParticipant(userId, business)) {
    throw new Error('BUSINESS_DEPOSIT_FORBIDDEN');
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('INVALID_DEPOSIT_AMOUNT');
  }

  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, amount);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, amount);
    await tx.business.update({
      where: { id: business.id },
      data: { treasuryMoney: { increment: amount } },
    });
  });

  await emitSharedBalanceUpdates(prisma, userId);
  await logBusinessTransaction(business.id, 'DEPOSIT', amount, `Depot par proprietaire`, userId);

  logYouAdmin('business_deposit', userId, undefined, business.id, business.name, {
    amount,
  });

  return { amount };
}

async function handleWithdrawAction(userId: string, business: any, input: { amount: number }) {
  if (!isBusinessParticipant(userId, business)) {
    throw new Error('BUSINESS_WITHDRAW_FORBIDDEN');
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('INVALID_WITHDRAW_AMOUNT');
  }

  if (business.treasuryMoney < amount) {
    throw new Error('BUSINESS_TREASURY_TOO_LOW');
  }

  await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: business.id },
      data: { treasuryMoney: { decrement: amount } },
    });
    await tx.user.update({
      where: { id: userId },
      data: { money: { increment: amount } },
    });
  });

  await emitSharedBalanceUpdates(prisma, userId);
  await logBusinessTransaction(business.id, 'WITHDRAW', -amount, `Retrait par proprietaire`, userId);

  logYouAdmin('business_withdraw', userId, undefined, business.id, business.name, {
    amount,
  });

  return { amount };
}

export async function runTransferBusinessAction(userId: string, businessId: string, input: { recipientId: string; amount: number }) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: { select: USER_PREVIEW_SELECT },
    },
  });

  if (!business) {
    throw new Error('BUSINESS_NOT_FOUND');
  }

  if (business.typeKey !== 'transfer') {
    throw new Error('BUSINESS_TRANSFER_UNAVAILABLE');
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('INVALID_TRANSFER_AMOUNT');
  }

  const recipientId = String(input.recipientId ?? '');
  if (!recipientId || recipientId === userId) {
    throw new Error('TRANSFER_RECIPIENT_INVALID');
  }

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, username: true, isApproved: true },
  });

  if (!recipient?.isApproved) {
    throw new Error('TARGET_NOT_FOUND');
  }

  const feeRate = Math.max(0, business.transferFeeRate ?? 2);
  const fee = Math.max(0, Math.round(amount * (feeRate / 100)));
  const totalDebit = amount + fee;
  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, totalDebit);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, totalDebit);
    await tx.user.update({
      where: { id: recipientId },
      data: { money: { increment: amount } },
    });
    await tx.business.update({
      where: { id: business.id },
      data: { treasuryMoney: { increment: fee } },
    });
    await tx.businessTransferTransaction.create({
      data: {
        businessId: business.id,
        senderId: userId,
        recipientId,
        amount,
        fee,
        feeRate,
      },
    });
  });

  await emitSharedBalanceUpdatesForUserIds(prisma, [userId, recipientId]);

  io.to(`user:${userId}`).emit('you:business-transfer', { businessId: business.id, amount, fee, recipientId });
  io.to(`user:${recipientId}`).emit('you:business-transfer', { businessId: business.id, amount, fee, senderId: userId });
  io.to(`user:${business.ownerId}`).emit('you:business-transfer', { businessId: business.id, amount, fee, senderId: userId, recipientId });

  await Promise.allSettled([
    createNotification({
      userId: recipientId,
      type: 'MONEY_RECEIVED',
      title: 'Transfert recu',
      body: `${amount.toLocaleString('fr-FR')} money recu via ${business.name}.`,
      link: '/you?tab=explore',
      icon: 'arrow-left-right',
    }),
    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Transfert envoye',
      body: `${amount.toLocaleString('fr-FR')} money envoye a ${recipient.username} via ${business.name}. Frais: ${fee.toLocaleString('fr-FR')}.`,
      link: '/you?tab=explore',
      icon: 'arrow-left-right',
    }),
  ]);

  logYouAdmin('business_transfer', userId, undefined, business.id, business.name, {
    recipientId,
    recipientUsername: recipient.username,
    amount,
    fee,
    feeRate,
  });

  return {
    recipientId,
    amount,
    fee,
    feeRate,
    debited: totalDebit,
  };
}

async function handleStartResearchAction(userId: string, business: any, input: { slotIndex: number }) {
  if (!isBusinessParticipant(userId, business)) {
    throw new Error('BUSINESS_RESEARCH_FORBIDDEN');
  }

  if (business.typeKey !== 'startup') {
    throw new Error('BUSINESS_RESEARCH_UNAVAILABLE');
  }

  const slotIndex = Number(input.slotIndex);
  if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > STARTUP_PRODUCTS.length) {
    throw new Error('INVALID_STARTUP_PRODUCT_SLOT');
  }

  await ensureStartupProducts(business.id);

  const product = await prisma.businessStartupProduct.findUnique({
    where: {
      businessId_slotIndex: {
        businessId: business.id,
        slotIndex,
      },
    },
  });

  if (!product) {
    throw new Error('INVALID_STARTUP_PRODUCT_SLOT');
  }

  if (product.activeResearchLevel && product.researchEndsAt && new Date(product.researchEndsAt).getTime() > Date.now()) {
    throw new Error('STARTUP_RESEARCH_ALREADY_RUNNING');
  }

  if (product.activeResearchLevel && product.researchEndsAt && new Date(product.researchEndsAt).getTime() <= Date.now()) {
    throw new Error('STARTUP_RESEARCH_READY_TO_DEPLOY');
  }

  if (product.deployedLevel >= STARTUP_PRODUCT_MAX_LEVEL) {
    throw new Error('STARTUP_PRODUCT_MAXED');
  }

  const nextLevel = product.deployedLevel + 1;
  const researchCost = getStartupResearchCost(nextLevel);
  if (business.treasuryMoney < researchCost) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + getStartupResearchDurationMinutes(nextLevel) * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: business.id },
      data: { treasuryMoney: { decrement: researchCost } },
    });
    await tx.businessStartupProduct.update({
      where: { id: product.id },
      data: {
        activeResearchLevel: nextLevel,
        researchStartedAt: startedAt,
        researchEndsAt: endsAt,
        researchCost,
      },
    });
  });

  logYouAdmin('business_research_start', userId, undefined, business.id, business.name, {
    slotIndex,
    nextLevel,
    researchCost,
  });

  // Affaires + Intelligence XP: lancer une recherche = effort entrepreneurial et intellectuel
  void grantSkillXp(userId, 'affaires', 5);
  void grantSkillXp(userId, 'intelligence', 5);

  return {
    slotIndex,
    nextLevel,
    researchCost,
    researchStartedAt: startedAt.toISOString(),
    researchEndsAt: endsAt.toISOString(),
  };
}

async function handleDeployProductAction(userId: string, business: any, input: { slotIndex: number }) {
  if (!isBusinessParticipant(userId, business)) {
    throw new Error('BUSINESS_RESEARCH_FORBIDDEN');
  }

  if (business.typeKey !== 'startup') {
    throw new Error('BUSINESS_RESEARCH_UNAVAILABLE');
  }

  const slotIndex = Number(input.slotIndex);
  if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > STARTUP_PRODUCTS.length) {
    throw new Error('INVALID_STARTUP_PRODUCT_SLOT');
  }

  const product = await prisma.businessStartupProduct.findUnique({
    where: {
      businessId_slotIndex: {
        businessId: business.id,
        slotIndex,
      },
    },
  });

  if (!product || !product.activeResearchLevel || !product.researchEndsAt) {
    throw new Error('STARTUP_RESEARCH_NOT_READY');
  }

  if (new Date(product.researchEndsAt).getTime() > Date.now()) {
    throw new Error('STARTUP_RESEARCH_NOT_READY');
  }

  const deployed = await prisma.businessStartupProduct.update({
    where: { id: product.id },
    data: {
      deployedLevel: product.activeResearchLevel,
      activeResearchLevel: null,
      researchStartedAt: null,
      researchEndsAt: null,
      researchCost: null,
    },
  });

  logYouAdmin('business_product_deploy', userId, undefined, business.id, business.name, {
    slotIndex: deployed.slotIndex,
    deployedLevel: deployed.deployedLevel,
    productName: deployed.name,
  });

  // Affaires XP: déployer un produit = milestone business (plus le niveau est haut, plus c'est récompensé)
  void grantSkillXp(userId, 'affaires', deployed.deployedLevel * 3);

  return {
    slotIndex: deployed.slotIndex,
    deployedLevel: deployed.deployedLevel,
  };
}

export async function respondToBusinessLoan(userId: string, loanId: string, decision: 'accept' | 'reject') {
  const loan = await prisma.businessLoan.findUnique({
    where: { id: loanId },
    include: {
      borrower: { select: USER_PREVIEW_SELECT },
      business: {
        include: {
          owner: { select: USER_PREVIEW_SELECT },
        },
      },
    },
  });

  if (!loan) {
    throw new Error('BUSINESS_LOAN_NOT_FOUND');
  }

  if (!(await isBusinessManager(loan.businessId, userId, loan.business.ownerId))) {
    throw new Error('BUSINESS_LOAN_REVIEW_FORBIDDEN');
  }

  if (loan.status !== 'PENDING') {
    throw new Error('BUSINESS_LOAN_ALREADY_DECIDED');
  }

  const now = new Date();

  if (decision === 'reject') {
    const rejected = await prisma.businessLoan.update({
      where: { id: loan.id },
      data: {
        status: 'REJECTED',
        decidedAt: now,
      },
    });

    await createNotification({
      userId: loan.borrowerId,
      type: 'SYSTEM',
      title: 'Pret refuse',
      body: `${loan.business.name} a refuse ta demande de pret.`,
      link: '/you?tab=explore',
      icon: 'credit-card',
    });

    logYouAdmin('business_loan_decision', userId, loan.business.owner.username, loan.business.id, loan.business.name, {
      loanId: loan.id,
      borrowerId: loan.borrowerId,
      borrowerName: loan.borrower.username,
      amount: loan.amount,
      decision: 'reject',
    });

    return {
      id: rejected.id,
      status: rejected.status,
      decidedAt: rejected.decidedAt?.toISOString() ?? null,
    };
  }

  if (loan.business.treasuryMoney < loan.amount) {
    throw new Error('BUSINESS_TREASURY_TOO_LOW');
  }

  const result = await prisma.$transaction(async (tx) => {
    const borrowerBalance = await tx.user.findUnique({
      where: { id: loan.borrowerId },
      select: { aura: true },
    });

    if (!borrowerBalance || Number(borrowerBalance.aura ?? 0) < (loan.collateralAura ?? 0)) {
      throw new Error('LOAN_COLLATERAL_AURA_TOO_LOW');
    }

    const updatedLoan = await tx.businessLoan.update({
      where: { id: loan.id },
      data: {
        status: 'ACTIVE',
        decidedAt: now,
        collateralAuraHeld: loan.collateralAura ?? 0,
      },
    });

    await tx.business.update({
      where: { id: loan.businessId },
      data: { treasuryMoney: { decrement: loan.amount } },
    });

    await tx.user.update({
      where: { id: loan.borrowerId },
      data: {
        money: { increment: loan.amount },
        aura: { decrement: loan.collateralAura ?? 0 },
      },
    });

    const existingEligibility = await tx.reviewEligibility.findFirst({
      where: {
        userId: loan.borrowerId,
        businessId: loan.businessId,
        targetType: 'BUSINESS',
      },
    });

    if (existingEligibility) {
      await tx.reviewEligibility.update({
        where: { id: existingEligibility.id },
        data: {
          sourceType: 'LOAN_ACCEPTED',
          promptAt: getReviewPromptAt(),
          promptedAt: null,
          reviewedAt: null,
        },
      });
    } else {
      await tx.reviewEligibility.create({
        data: {
          userId: loan.borrowerId,
          businessId: loan.businessId,
          targetType: 'BUSINESS',
          sourceType: 'LOAN_ACCEPTED',
          promptAt: getReviewPromptAt(),
        },
      });
    }

    return updatedLoan;
  });

  await Promise.all([
    emitSharedBalanceUpdates(prisma, loan.borrowerId),
    emitSharedBalanceUpdates(prisma, userId),
  ]);

  await logBusinessTransaction(loan.businessId, 'LOAN_ISSUE', -loan.amount, `Pret accorde a ${loan.borrower.username}`, loan.borrowerId);

  await Promise.allSettled([
    createNotification({
      userId: loan.borrowerId,
      type: 'MONEY_RECEIVED',
      title: 'Pret accepte',
      body: `${loan.amount.toLocaleString('fr-FR')} money recu depuis ${loan.business.name}${(loan.collateralAuraHeld || loan.collateralAura) > 0 ? ` ; ${(loan.collateralAuraHeld || loan.collateralAura).toLocaleString('fr-FR')} aura sont bloquees jusqu'au remboursement` : ''}.`,
      link: '/you?tab=explore',
      icon: 'landmark',
    }),
    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Pret accorde',
      body: `${loan.borrower.username} a recu ${loan.amount.toLocaleString('fr-FR')} money depuis ${loan.business.name}${(loan.collateralAuraHeld || loan.collateralAura) > 0 ? ` avec ${(loan.collateralAuraHeld || loan.collateralAura).toLocaleString('fr-FR')} aura bloquees en garantie` : ''}.`,
      link: '/you?tab=travail',
      icon: 'credit-card',
    }),
  ]);

  logYouAdmin('business_loan_decision', userId, loan.business.owner.username, loan.business.id, loan.business.name, {
    loanId: loan.id,
    borrowerId: loan.borrowerId,
    borrowerName: loan.borrower.username,
    amount: loan.amount,
    collateralAura: loan.collateralAura ?? 0,
    decision: 'accept',
  });

  // Finance XP pour l'emprunteur: proportionnel au montant du prêt (plus gros prêt = plus d'XP, évite le spam de petits prêts)
  void grantSkillXp(loan.borrowerId, 'finance', Math.min(15, Math.max(3, Math.floor(loan.amount / 1000))));
  // Affaires XP pour la banque: gérer des prêts = activité bancaire
  void grantSkillXp(userId, 'affaires', 3);

  return {
    id: result.id,
    status: result.status,
    decidedAt: result.decidedAt?.toISOString() ?? now.toISOString(),
  };
}

export async function respondToBusinessInvitation(userId: string, invitationId: string, decision: 'accept' | 'reject') {
  const invitation = await prisma.businessInvitation.findUnique({
    where: { id: invitationId },
    include: {
      inviter: { select: USER_PREVIEW_SELECT },
      invitee: { select: USER_PREVIEW_SELECT },
      business: {
        include: {
          owner: { select: USER_PREVIEW_SELECT },
        },
      },
    },
  });

  if (!invitation) {
    throw new Error('BUSINESS_INVITATION_NOT_FOUND');
  }

  if (invitation.employerId !== userId && invitation.employeeId !== userId) {
    throw new Error('BUSINESS_INVITATION_FORBIDDEN');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('BUSINESS_INVITATION_ALREADY_RESOLVED');
  }

  const respondedAt = new Date();
  const actingRole = invitation.employerId === userId ? 'EMPLOYER' : 'EMPLOYEE';

  if (decision === 'reject') {
    const rejectedInvitation = await prisma.businessInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'REJECTED',
        respondedAt,
      },
    });

    await syncBusinessInvitationNotificationState({
      invitationId: invitation.id,
      employerId: invitation.employerId,
      employeeId: invitation.employeeId,
      status: rejectedInvitation.status,
      employerAcceptedAt: invitation.employerAcceptedAt,
      employeeAcceptedAt: invitation.employeeAcceptedAt,
      respondedAt: rejectedInvitation.respondedAt,
    });

    const targetUserId = actingRole === 'EMPLOYER' ? invitation.employeeId : invitation.employerId;
    const actorUser = actingRole === 'EMPLOYER' ? invitation.business.owner : invitation.inviterId === invitation.employeeId ? invitation.inviter : invitation.invitee;

    await createNotification({
      userId: targetUserId,
      type: 'SYSTEM',
      title: 'Contrat refuse',
      body: `${actorUser.username} a refuse la proposition pour ${invitation.business.name}.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    });

    logYouAdmin('business_invitation_respond', userId, invitation.invitee.username, invitation.business.id, invitation.business.name, {
      invitationId,
      decision: 'reject',
      role: invitation.role,
      ownerId: invitation.business.ownerId,
      ownerName: invitation.business.owner.username,
    });

    return {
      id: rejectedInvitation.id,
      status: rejectedInvitation.status,
      respondedAt: rejectedInvitation.respondedAt?.toISOString() ?? null,
    };
  }

  const acceptedInvitation = await prisma.$transaction(async (tx) => {
    const assignedMemberRole = 'EMPLOYEE';

    const updatedInvitation = await tx.businessInvitation.update({
      where: { id: invitation.id },
      data: {
        employerAcceptedAt: actingRole === 'EMPLOYER' ? respondedAt : invitation.employerAcceptedAt,
        employeeAcceptedAt: actingRole === 'EMPLOYEE' ? respondedAt : invitation.employeeAcceptedAt,
        respondedAt,
      },
    });

    const employerAcceptedAt = actingRole === 'EMPLOYER' ? respondedAt : invitation.employerAcceptedAt;
    const employeeAcceptedAt = actingRole === 'EMPLOYEE' ? respondedAt : invitation.employeeAcceptedAt;
    const isFullyAccepted = Boolean(employerAcceptedAt && employeeAcceptedAt);

    if (isFullyAccepted) {
      await tx.businessMember.upsert({
        where: {
          businessId_userId: {
            businessId: invitation.businessId,
            userId: invitation.employeeId,
          },
        },
        update: {
          role: assignedMemberRole,
          salary: invitation.salary ?? 0,
          status: 'ACTIVE',
        },
        create: {
          businessId: invitation.businessId,
          userId: invitation.employeeId,
          role: assignedMemberRole,
          salary: invitation.salary ?? 0,
          status: 'ACTIVE',
        },
      });

      return tx.businessInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          respondedAt,
        },
      });
    }

    return updatedInvitation;
  });

  await syncBusinessInvitationNotificationState({
    invitationId: invitation.id,
    employerId: invitation.employerId,
    employeeId: invitation.employeeId,
    status: acceptedInvitation.status,
    employerAcceptedAt: acceptedInvitation.employerAcceptedAt,
    employeeAcceptedAt: acceptedInvitation.employeeAcceptedAt,
    respondedAt: acceptedInvitation.respondedAt,
  });

  await Promise.allSettled([
    createNotification({
      userId: invitation.employerId,
      type: 'SYSTEM',
      title: acceptedInvitation.status === 'ACCEPTED' ? 'Contrat valide' : 'Contrat partiellement accepte',
      body: acceptedInvitation.status === 'ACCEPTED'
        ? `${(invitation.inviterId === invitation.employeeId ? invitation.inviter : invitation.invitee).username} rejoint ${invitation.business.name} pour ${invitation.salary.toLocaleString('fr-FR')} money/jour.`
        : `Le contrat de ${invitation.business.name} attend encore la validation de l'autre partie.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
    createNotification({
      userId: invitation.employeeId,
      type: 'SYSTEM',
      title: acceptedInvitation.status === 'ACCEPTED' ? 'Contrat signe' : 'Accord enregistre',
      body: acceptedInvitation.status === 'ACCEPTED'
        ? `Tu fais maintenant partie de ${invitation.business.name} avec un salaire de ${invitation.salary.toLocaleString('fr-FR')} money/jour.`
        : `Ton accord a bien ete pris en compte pour ${invitation.business.name}.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
  ]);

  logYouAdmin('business_invitation_respond', userId, invitation.invitee.username, invitation.business.id, invitation.business.name, {
    invitationId,
    decision: 'accept',
    role: invitation.role,
    ownerId: invitation.business.ownerId,
    ownerName: invitation.business.owner.username,
    salary: invitation.salary ?? 0,
    actingRole,
  });

  return {
    id: acceptedInvitation.id,
    status: acceptedInvitation.status,
    respondedAt: acceptedInvitation.respondedAt?.toISOString() ?? null,
  };
}

async function syncBusinessInvitationNotificationState(input: {
  invitationId: string;
  employerId: string;
  employeeId: string;
  status: string;
  employerAcceptedAt: Date | null;
  employeeAcceptedAt: Date | null;
  respondedAt: Date | null;
}) {
  const {
    invitationId,
    employerId,
    employeeId,
    status,
    employerAcceptedAt,
    employeeAcceptedAt,
    respondedAt,
  } = input;

  const notificationCandidates = await prisma.notification.findMany({
    where: {
      userId: { in: [employerId, employeeId] },
      data: { contains: `\"invitationId\":\"${invitationId}\"` },
    },
  });

  if (notificationCandidates.length === 0) return;

  const respondedAtIso = respondedAt ? respondedAt.toISOString() : null;

  for (const notification of notificationCandidates) {
    const currentData = safeJsonParse<Record<string, unknown>>(notification.data, {});
    const needsViewerAcceptance = status === 'PENDING'
      && (
        (notification.userId === employerId && !employerAcceptedAt)
        || (notification.userId === employeeId && !employeeAcceptedAt)
      );

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: {
        data: JSON.stringify({
          ...currentData,
          actionType: 'BUSINESS_INVITATION',
          invitationId,
          invitationStatus: status,
          invitationRespondedAt: respondedAtIso,
          invitationNeedsViewerAcceptance: needsViewerAcceptance,
        }),
      },
    });

    emitNotificationUpdated(updated);
  }
}

async function handleInvestAction(userId: string, business: any, input: { amount: number; riskLevel: InvestmentRiskLevel }) {
  if (business.ownerId === userId) {
    throw new Error('BUSINESS_INVEST_SELF_FORBIDDEN');
  }

  const amount = Number(input.amount);
  const riskLevel = input.riskLevel in INVESTMENT_RISK_RANGES ? input.riskLevel : 'medium';
  const riskRange = INVESTMENT_RISK_RANGES[riskLevel];

  if (!Number.isFinite(amount) || amount < 100) {
    throw new Error('INVALID_INVEST_AMOUNT');
  }

  const [investor, owner] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, aura: true, money: true },
    }),
    prisma.user.findUnique({
      where: { id: business.ownerId },
      select: { id: true, username: true, aura: true, money: true },
    }),
  ]);

  if (!investor || !owner) {
    throw new Error('USER_NOT_FOUND');
  }

  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, amount);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, amount);
    await tx.businessInvestment.create({
      data: {
        businessId: business.id,
        investorId: investor.id,
        amount,
        riskLevel,
        expectedReturnMin: riskRange.min,
        expectedReturnMax: riskRange.max,
      },
    });
    await tx.business.update({
      where: { id: business.id },
      data: { treasuryMoney: { increment: amount } },
    });
  });

  await emitSharedBalanceUpdates(prisma, userId);

  await Promise.allSettled([
    createNotification({
      userId: owner.id,
      type: 'MONEY_RECEIVED',
      title: 'Nouvel investissement',
      body: `${investor.username} a investi ${amount.toLocaleString('fr-FR')} money dans ${business.name}.`,
      link: '/you?tab=travail',
      icon: 'trending-up',
    }),
    createNotification({
      userId: investor.id,
      type: 'SYSTEM',
      title: 'Investissement place',
      body: `Tu as investi ${amount.toLocaleString('fr-FR')} money dans ${business.name}.`,
      data: { silent: true },
      link: '/you?tab=explore',
      icon: 'trending-up',
    }),
  ]);

  logYouAdmin('business_invest', investor.id, investor.username, business.id, business.name, {
    amount,
    riskLevel,
    expectedReturnMin: riskRange.min,
    expectedReturnMax: riskRange.max,
  });

  // Finance XP pour l'investisseur: proportionnel au montant (plus on investit, plus on gagne)
  void grantSkillXp(investor.id, 'finance', Math.min(10, Math.max(2, Math.floor(amount / 1000))));
  // Affaires XP pour le propriétaire: recevoir des investisseurs = succès business
  void grantSkillXp(business.ownerId, 'affaires', 3);

  return {
    amount,
    riskLevel,
    expectedReturnMin: riskRange.min,
    expectedReturnMax: riskRange.max,
  };
}

export async function createBusinessShareProposal(
  userId: string,
  businessId: string,
  input: { sharePercent: number; amount: number; message?: string },
) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: { select: USER_PREVIEW_SELECT },
      shareholders: {
        include: {
          user: { select: USER_PREVIEW_SELECT },
        },
      },
    },
  });

  if (!business) {
    throw new Error('BUSINESS_NOT_FOUND');
  }

  if (business.ownerId === userId) {
    throw new Error('SHARE_SELF_FORBIDDEN');
  }

  const sharePercent = Math.round(Number(input.sharePercent) * 100) / 100;
  const amount = Number(input.amount);

  if (!Number.isFinite(sharePercent) || sharePercent <= 0 || sharePercent >= 100) {
    throw new Error('INVALID_SHARE_PERCENT');
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('INVALID_SHARE_AMOUNT');
  }

  const existingPendingProposal = await prisma.businessShareProposal.findFirst({
    where: {
      businessId,
      investorId: userId,
      status: 'PENDING',
    },
    select: { id: true },
  });

  if (existingPendingProposal) {
    throw new Error('SHARE_PROPOSAL_ALREADY_PENDING');
  }

  const soldSharePercent = business.shareholders.reduce((sum, shareholder) => sum + shareholder.sharePercent, 0);
  if (soldSharePercent + sharePercent > 100) {
    throw new Error('BUSINESS_SHARE_CAP_EXCEEDED');
  }

  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, amount);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  const suggestedAmount = computeBusinessSuggestedShareAmount(business, sharePercent);

  const proposal = await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, amount);
    return tx.businessShareProposal.create({
      data: {
        businessId,
        investorId: userId,
        ownerId: business.ownerId,
        sharePercent,
        amount,
        suggestedAmount,
        message: input.message?.trim() ? input.message.trim() : null,
      },
      include: {
        investor: { select: USER_PREVIEW_SELECT },
        owner: { select: USER_PREVIEW_SELECT },
      },
    });
  });

  await emitSharedBalanceUpdates(prisma, userId);

  await Promise.allSettled([
    createNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      title: 'Nouvelle proposition d actionnariat',
      body: `${proposal.investor.username} propose ${sharePercent.toLocaleString('fr-FR')} % de ${business.name} pour ${amount.toLocaleString('fr-FR')} money.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Proposition envoyee',
      body: `Ta proposition pour ${business.name} est en attente. ${amount.toLocaleString('fr-FR')} money est bloque.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
  ]);

  logYouAdmin('business_share_proposal_create', userId, proposal.investor.username, business.id, business.name, {
    sharePercent,
    amount,
    suggestedAmount,
  });

  return serializeShareProposal(proposal, userId);
}

export async function createShareMarketListing(
  userId: string,
  input: { businessId: string; sharePercent: number; price: number },
) {
  const businessId = String(input.businessId ?? '').trim();
  const sharePercent = Math.round(Number(input.sharePercent) * 100) / 100;
  const price = Math.round(Number(input.price));

  if (!businessId) {
    throw new Error('BUSINESS_NOT_FOUND');
  }

  if (!Number.isFinite(sharePercent) || sharePercent <= 0 || sharePercent >= 100) {
    throw new Error('SHARE_MARKET_INVALID_SHARE_PERCENT');
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('SHARE_MARKET_INVALID_PRICE');
  }

  const [shareholding, business, existingActiveListings] = await Promise.all([
    prisma.businessShareholder.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId,
        },
      },
    }),
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        typeKey: true,
        ownerId: true,
        owner: { select: USER_PREVIEW_SELECT },
      },
    }),
    prisma.businessShareMarketListing.findMany({
      where: {
        businessId,
        sellerId: userId,
        status: 'ACTIVE',
      },
      select: {
        sharePercent: true,
      },
    }),
  ]);

  const alreadyListedSharePercent = existingActiveListings.reduce((sum, listing) => sum + listing.sharePercent, 0);

  if (!shareholding || shareholding.sharePercent < sharePercent + alreadyListedSharePercent) {
    throw new Error('SHARE_MARKET_INSUFFICIENT_SHARES');
  }

  if (!business) {
    throw new Error('BUSINESS_NOT_FOUND');
  }

  const listing = await prisma.businessShareMarketListing.create({
    data: {
      businessId,
      sellerId: userId,
      sharePercent,
      price,
    },
    include: {
      seller: { select: USER_PREVIEW_SELECT },
      buyer: { select: USER_PREVIEW_SELECT },
      business: {
        select: {
          id: true,
          name: true,
          typeKey: true,
          ownerId: true,
          owner: { select: USER_PREVIEW_SELECT },
        },
      },
    },
  });

  return serializeShareMarketListing(listing, userId);
}

export async function buyShareMarketListing(userId: string, listingId: string) {
  const listing = await prisma.businessShareMarketListing.findUnique({
    where: { id: listingId },
    include: {
      seller: { select: USER_PREVIEW_SELECT },
      buyer: { select: USER_PREVIEW_SELECT },
      business: {
        select: {
          id: true,
          name: true,
          typeKey: true,
          ownerId: true,
          owner: { select: USER_PREVIEW_SELECT },
        },
      },
    },
  });

  if (!listing) {
    throw new Error('SHARE_MARKET_LISTING_NOT_FOUND');
  }

  if (listing.status !== 'ACTIVE') {
    throw new Error('SHARE_MARKET_ALREADY_RESOLVED');
  }

  if (listing.sellerId === userId) {
    throw new Error('SHARE_MARKET_BUY_OWN_LISTING');
  }

  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, listing.price);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  const soldAt = new Date();

  await prisma.$transaction(async (tx) => {
    const freshListing = await tx.businessShareMarketListing.findUnique({
      where: { id: listing.id },
      select: {
        id: true,
        status: true,
        businessId: true,
        sellerId: true,
        sharePercent: true,
        price: true,
      },
    });

    if (!freshListing) {
      throw new Error('SHARE_MARKET_LISTING_NOT_FOUND');
    }

    if (freshListing.status !== 'ACTIVE') {
      throw new Error('SHARE_MARKET_ALREADY_RESOLVED');
    }

    const sellerShareholding = await tx.businessShareholder.findUnique({
      where: {
        businessId_userId: {
          businessId: freshListing.businessId,
          userId: freshListing.sellerId,
        },
      },
    });

    if (!sellerShareholding || sellerShareholding.sharePercent < freshListing.sharePercent) {
      throw new Error('SHARE_MARKET_SELLER_NO_LONGER_HAS_SHARES');
    }

    await debitSharedMoney(tx, userId, freshListing.price);

    await tx.user.update({
      where: { id: freshListing.sellerId },
      data: { money: { increment: freshListing.price } },
    });

    const soldCostBasis = Math.round(sellerShareholding.averagePrice * freshListing.sharePercent);
    const nextSellerShare = Math.max(0, sellerShareholding.sharePercent - freshListing.sharePercent);
    const nextSellerInvestedAmount = Math.max(0, sellerShareholding.investedAmount - soldCostBasis);

    if (nextSellerShare <= 0.0001) {
      await tx.businessShareholder.delete({
        where: {
          businessId_userId: {
            businessId: freshListing.businessId,
            userId: freshListing.sellerId,
          },
        },
      });
    } else {
      await tx.businessShareholder.update({
        where: {
          businessId_userId: {
            businessId: freshListing.businessId,
            userId: freshListing.sellerId,
          },
        },
        data: {
          sharePercent: nextSellerShare,
          investedAmount: nextSellerInvestedAmount,
        },
      });
    }

    if (userId !== listing.business.ownerId) {
      const existingBuyerShareholding = await tx.businessShareholder.findUnique({
        where: {
          businessId_userId: {
            businessId: freshListing.businessId,
            userId,
          },
        },
      });

      await tx.businessShareholder.upsert({
        where: {
          businessId_userId: {
            businessId: freshListing.businessId,
            userId,
          },
        },
        update: {
          sharePercent: { increment: freshListing.sharePercent },
          investedAmount: { increment: freshListing.price },
          averagePrice: existingBuyerShareholding
            ? ((existingBuyerShareholding.averagePrice * existingBuyerShareholding.sharePercent) + freshListing.price)
              / Math.max(0.01, existingBuyerShareholding.sharePercent + freshListing.sharePercent)
            : freshListing.price / freshListing.sharePercent,
        },
        create: {
          businessId: freshListing.businessId,
          userId,
          sharePercent: freshListing.sharePercent,
          investedAmount: freshListing.price,
          averagePrice: freshListing.price / freshListing.sharePercent,
        },
      });
    }

    await tx.businessShareMarketListing.update({
      where: { id: freshListing.id },
      data: {
        status: 'SOLD',
        buyerId: userId,
        soldAt,
      },
    });
  });

  await emitSharedBalanceUpdatesForUserIds(prisma, [userId, listing.sellerId]);

  await Promise.allSettled([
    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Achat d actions confirme',
      body: `Tu as achete ${listing.sharePercent.toLocaleString('fr-FR')} % de ${listing.business.name} pour ${listing.price.toLocaleString('fr-FR')} money.`,
      link: '/you?tab=marche-actions',
      icon: 'briefcase-business',
    }),
    createNotification({
      userId: listing.sellerId,
      type: 'MONEY_RECEIVED',
      title: 'Actions revendues',
      body: `${listing.sharePercent.toLocaleString('fr-FR')} % de ${listing.business.name} vendu pour ${listing.price.toLocaleString('fr-FR')} money.`,
      link: '/you?tab=marche-actions',
      icon: 'briefcase-business',
    }),
  ]);

  return {
    id: listing.id,
    status: 'SOLD',
    soldAt: soldAt.toISOString(),
  };
}

export async function cancelShareMarketListing(userId: string, listingId: string) {
  const listing = await prisma.businessShareMarketListing.findUnique({
    where: { id: listingId },
    include: {
      seller: { select: USER_PREVIEW_SELECT },
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!listing) {
    throw new Error('SHARE_MARKET_LISTING_NOT_FOUND');
  }

  if (listing.sellerId !== userId) {
    throw new Error('SHARE_MARKET_LISTING_FORBIDDEN');
  }

  if (listing.status !== 'ACTIVE') {
    throw new Error('SHARE_MARKET_ALREADY_RESOLVED');
  }

  const cancelledAt = new Date();

  await prisma.businessShareMarketListing.update({
    where: { id: listing.id },
    data: {
      status: 'CANCELLED',
      cancelledAt,
    },
  });

  return {
    id: listing.id,
    status: 'CANCELLED',
    cancelledAt: cancelledAt.toISOString(),
  };
}

export async function respondToBusinessShareProposal(userId: string, proposalId: string, decision: 'accept' | 'reject') {
  const proposal = await prisma.businessShareProposal.findUnique({
    where: { id: proposalId },
    include: {
      business: {
        include: {
          owner: { select: USER_PREVIEW_SELECT },
          shareholders: {
            include: {
              user: { select: USER_PREVIEW_SELECT },
            },
          },
        },
      },
      investor: { select: USER_PREVIEW_SELECT },
      owner: { select: USER_PREVIEW_SELECT },
    },
  });

  if (!proposal) {
    throw new Error('SHARE_PROPOSAL_NOT_FOUND');
  }

  if (proposal.ownerId !== userId) {
    throw new Error('SHARE_PROPOSAL_REVIEW_FORBIDDEN');
  }

  if (proposal.status !== 'PENDING') {
    throw new Error('SHARE_PROPOSAL_ALREADY_RESOLVED');
  }

  const decidedAt = new Date();

  if (decision === 'reject') {
    await prisma.$transaction(async (tx) => {
      await tx.businessShareProposal.update({
        where: { id: proposal.id },
        data: { status: 'REJECTED', decidedAt },
      });
      await tx.user.update({
        where: { id: proposal.investorId },
        data: { money: { increment: proposal.amount } },
      });
    });

    await emitSharedBalanceUpdates(prisma, proposal.investorId);

    await Promise.allSettled([
      createNotification({
        userId: proposal.investorId,
        type: 'SYSTEM',
        title: 'Proposition refusee',
        body: `${proposal.business.name} a refuse ta proposition. ${proposal.amount.toLocaleString('fr-FR')} money t a ete rendu.`,
        link: '/you?tab=travail',
        icon: 'briefcase-business',
      }),
    ]);

    logYouAdmin('business_share_proposal_review', userId, proposal.owner.username, proposal.business.id, proposal.business.name, {
      proposalId,
      decision,
      sharePercent: proposal.sharePercent,
      amount: proposal.amount,
    });

    return { id: proposal.id, status: 'REJECTED', decidedAt: decidedAt.toISOString() };
  }

  const existingShareholder = proposal.business.shareholders.find((shareholder) => shareholder.userId === proposal.investorId);
  const soldSharePercentExcludingInvestor = proposal.business.shareholders
    .filter((shareholder) => shareholder.userId !== proposal.investorId)
    .reduce((sum, shareholder) => sum + shareholder.sharePercent, 0);
  const currentInvestorShare = existingShareholder?.sharePercent ?? 0;
  const nextInvestorShare = currentInvestorShare + proposal.sharePercent;
  const shouldTransferFounderRole = proposal.business.ownerId !== proposal.investorId && nextInvestorShare > 50;

  if (soldSharePercentExcludingInvestor + currentInvestorShare + proposal.sharePercent > 100) {
    throw new Error('BUSINESS_SHARE_CAP_EXCEEDED');
  }

  await prisma.$transaction(async (tx) => {
    await tx.businessShareProposal.update({
      where: { id: proposal.id },
      data: { status: 'ACCEPTED', decidedAt },
    });
    await tx.user.update({
      where: { id: proposal.ownerId },
      data: { money: { increment: proposal.amount } },
    });
    await tx.businessShareholder.upsert({
      where: {
        businessId_userId: {
          businessId: proposal.businessId,
          userId: proposal.investorId,
        },
      },
      update: {
        sharePercent: { increment: proposal.sharePercent },
        investedAmount: { increment: proposal.amount },
        averagePrice: existingShareholder
          ? ((existingShareholder.averagePrice * existingShareholder.sharePercent) + proposal.amount)
            / Math.max(0.01, existingShareholder.sharePercent + proposal.sharePercent)
          : proposal.amount / proposal.sharePercent,
      },
      create: {
        businessId: proposal.businessId,
        userId: proposal.investorId,
        sharePercent: proposal.sharePercent,
        investedAmount: proposal.amount,
        averagePrice: proposal.amount / proposal.sharePercent,
      },
    });

    if (shouldTransferFounderRole) {
      await tx.business.update({
        where: { id: proposal.businessId },
        data: { ownerId: proposal.investorId },
      });

      await tx.businessShareProposal.updateMany({
        where: {
          businessId: proposal.businessId,
          ownerId: proposal.ownerId,
          status: 'PENDING',
        },
        data: {
          ownerId: proposal.investorId,
        },
      });

      await tx.businessBuyoutOffer.updateMany({
        where: {
          businessId: proposal.businessId,
          ownerId: proposal.ownerId,
          status: 'PENDING',
        },
        data: {
          ownerId: proposal.investorId,
        },
      });
    }
  });

  await emitSharedBalanceUpdatesForUserIds(prisma, [proposal.ownerId, proposal.investorId]);

  await Promise.allSettled([
    createNotification({
      userId: proposal.investorId,
      type: 'SYSTEM',
      title: shouldTransferFounderRole ? 'Tu deviens fondateur' : 'Tu deviens actionnaire',
      body: shouldTransferFounderRole
        ? `${proposal.owner.username} a accepte. Avec ${nextInvestorShare.toLocaleString('fr-FR')} % de parts, tu deviens le fondateur de ${proposal.business.name}.`
        : `${proposal.owner.username} a accepte. Tu possedes maintenant une part de ${proposal.business.name}.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
    createNotification({
      userId: proposal.ownerId,
      type: 'MONEY_RECEIVED',
      title: 'Actionnariat partage',
      body: `${proposal.amount.toLocaleString('fr-FR')} money recu pour ${proposal.sharePercent.toLocaleString('fr-FR')} % de ${proposal.business.name}.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
    ...(shouldTransferFounderRole
      ? [
          createNotification({
            userId: proposal.ownerId,
            type: 'SYSTEM',
            title: 'Fondateur transfere',
            body: `${proposal.investor.username} detient maintenant ${nextInvestorShare.toLocaleString('fr-FR')} % de ${proposal.business.name} et devient fondateur.`,
            link: '/you?tab=travail',
            icon: 'briefcase-business',
          }),
        ]
      : []),
  ]);

  logYouAdmin('business_share_proposal_review', userId, proposal.owner.username, proposal.business.id, proposal.business.name, {
    proposalId,
    decision,
    sharePercent: proposal.sharePercent,
    amount: proposal.amount,
    investorId: proposal.investorId,
    investorName: proposal.investor.username,
    founderChanged: shouldTransferFounderRole,
    nextInvestorShare,
  });

  return { id: proposal.id, status: 'ACCEPTED', decidedAt: decidedAt.toISOString() };
}

async function handleCollectNpcAction(userId: string, business: any, _input: unknown) {
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) {
    throw new Error('BUSINESS_COLLECT_FORBIDDEN');
  }

  const { getBusinessBalancing } = await import('../../config/balancing.js');
  const balancing = getBusinessBalancing(business.typeKey);
  if (!balancing || !('npcCollectAmount' in balancing)) {
    throw new Error('BUSINESS_ACTION_UNAVAILABLE');
  }

  const cooldownMs = (balancing.npcCollectCooldownHours as number) * 60 * 60 * 1000;
  if (business.npcLastCollectedAt) {
    const last = new Date(business.npcLastCollectedAt).getTime();
    if (Date.now() - last < cooldownMs) {
      throw new Error('COLLECT_ON_COOLDOWN');
    }
  }

  let amount = balancing.npcCollectAmount as number;
  let transactionLabel = 'Recettes clients collectees';
  let updatedCustomData = business.customData;

  if (business.typeKey === 'youtube') {
    const data = business.customData ? JSON.parse(business.customData) : { videos: [], totalViews: 0, sponsors: [] };
    const views = randomInt(800, 6500);
    const sponsorBonus = Array.isArray(data.sponsors) ? data.sponsors.length * 120 : 0;
    amount += Math.floor(views / 12) + sponsorBonus;
    data.totalViews = (data.totalViews ?? 0) + views;
    data.videos = [
      {
        title: `Video #${(data.videos?.length ?? 0) + 1}`,
        views,
        createdAt: new Date().toISOString(),
      },
      ...(data.videos ?? []),
    ].slice(0, 12);
    updatedCustomData = JSON.stringify(data);
    transactionLabel = `${views.toLocaleString('fr-FR')} vues monetisees sur la chaine`;
  }

  await prisma.$transaction([
    prisma.business.update({
      where: { id: business.id },
      data: { treasuryMoney: { increment: amount }, npcLastCollectedAt: new Date(), customData: updatedCustomData },
    }),
  ]);

  await logBusinessTransaction(business.id, 'NPC_COLLECT', amount, transactionLabel, userId);

  logYouAdmin('business_collect', userId, undefined, business.id, business.name, {
    amount,
    transactionLabel,
  });

  // Affaires XP: +5 par collecte NPC (récompense la gestion active de l'entreprise)
  void grantSkillXp(userId, 'affaires', 5);

  return { amount };
}

async function handlePurchaseItemAction(userId: string, business: any, input: { itemKey: string }) {
  if (business.ownerId === userId) {
    throw new Error('PURCHASE_SELF_FORBIDDEN');
  }

  const balancing = getBusinessBalancing(business.typeKey);
  if (!balancing || !('items' in balancing)) {
    throw new Error('BUSINESS_ACTION_UNAVAILABLE');
  }

  const items = getBusinessSaleItems(business);
  const item = items.find((i) => i.key === input.itemKey);
  if (!item) {
    throw new Error('ITEM_NOT_FOUND');
  }

  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, item.price);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, item.price);
    await tx.business.update({
      where: { id: business.id },
      data: { treasuryMoney: { increment: item.price } },
    });
    const existingEligibility = await tx.reviewEligibility.findFirst({
      where: {
        userId,
        businessId: business.id,
        targetType: 'BUSINESS',
      },
    });
    if (existingEligibility) {
      await tx.reviewEligibility.update({
        where: { id: existingEligibility.id },
        data: {
          sourceType: 'ITEM_PURCHASE',
          promptAt: getReviewPromptAt(),
          promptedAt: null,
          reviewedAt: null,
        },
      });
    } else {
      await tx.reviewEligibility.create({
        data: {
          userId,
          businessId: business.id,
          targetType: 'BUSINESS',
          sourceType: 'ITEM_PURCHASE',
          promptAt: getReviewPromptAt(),
        },
      });
    }
  });

  await emitSharedBalanceUpdates(prisma, userId);
  await logBusinessTransaction(business.id, 'ITEM_SALE', item.price, `Achat de ${item.label} par un client`, userId);

  // Add item to buyer's inventory
  const existingPurchase = await prisma.businessPurchasedItem.findFirst({
    where: { userId, businessId: business.id, itemKey: item.key },
  });
  if (existingPurchase) {
    await prisma.businessPurchasedItem.update({
      where: { id: existingPurchase.id },
      data: { quantity: { increment: 1 }, acquiredAt: new Date() },
    });
  } else {
    await prisma.businessPurchasedItem.create({
      data: {
        userId,
        businessId: business.id,
        businessName: business.name,
        itemKey: item.key,
        itemLabel: item.label,
        itemEmoji: item.emoji ?? null,
        itemImageUrl: item.imageUrl ?? null,
        price: item.price,
        quantity: 1,
      },
    });
  }

  if (business.typeKey === 'medecins') {
    const clanMembership = await prisma.clanMember.findUnique({
      where: { userId },
      select: { clanId: true },
    });
    if (clanMembership) {
      const clan = await prisma.clan.findUnique({
        where: { id: clanMembership.clanId },
        select: { injuriesJson: true },
      });
      if (clan) {
        const injuries = safeJsonParse<Array<{ userId: string; username: string; severity: number; createdAt: string }>>(clan.injuriesJson, []);
        const healPower = item.key === 'regen_totale' ? 5 : item.key === 'soin_tactique' ? 3 : 1;
        const healed = injuries
          .map((entry) => ({ ...entry, severity: Math.max(0, entry.severity - healPower) }))
          .filter((entry) => entry.severity > 0);
        await prisma.clan.update({
          where: { id: clanMembership.clanId },
          data: { injuriesJson: JSON.stringify(healed) },
        });
      }
    }
  }

  logYouAdmin('business_sale', userId, undefined, business.id, business.name, {
    itemKey: item.key,
    itemLabel: item.label,
    price: item.price,
  });

  // XP pour l'acheteur selon le type de business
  if (business.typeKey === 'agency') {
    // Social XP: achat immobilier via agence (+1 XP par tranche de 500 EUR, min 5)
    void grantSkillXp(userId, 'social', Math.max(5, Math.floor(item.price / 500)));
  } else if (business.typeKey === 'medecins') {
    // Intelligence XP: se soigner = prendre soin de soi intelligemment
    void grantSkillXp(userId, 'intelligence', 2);
  } else {
    // Social XP: acheter dans une business locale = participation à l'économie sociale (proportionnel, min 1)
    void grantSkillXp(userId, 'social', Math.max(1, Math.floor(item.price / 200)));
  }

  if (business.typeKey === 'illegal_market') {
    void grantSkillXp(userId, 'illegalite', Math.max(2, Math.floor(item.price / 120)));
    void grantSkillXp(business.ownerId, 'illegalite', Math.max(3, Math.floor(item.price / 90)));
  }

  // Affaires XP pour le vendeur: réaliser une vente = activité commerciale
  void grantSkillXp(business.ownerId, 'affaires', 1);

  return { item: item.label, price: item.price };
}

const BUSINESS_ACTION_HANDLERS: Record<BusinessActionKey, (userId: string, business: any, input: any) => Promise<any>> = {
  invite: handleInviteAction,
  loan: handleLoanAction,
  invest: handleInvestAction,
  deposit: handleDepositAction,
  withdraw: handleWithdrawAction,
  start_research: handleStartResearchAction,
  deploy_product: handleDeployProductAction,
  collect_npc: handleCollectNpcAction,
  purchase_item: handlePurchaseItemAction,
};

export async function executeBusinessAction(userId: string, businessId: string, actionKey: BusinessActionKey, input: Record<string, unknown>) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      ...BUSINESS_BASE_INCLUDE,
      owner: {
        select: USER_PREVIEW_SELECT,
      },
    },
  });

  if (!business) {
    throw new Error('BUSINESS_NOT_FOUND');
  }
  if (isConstructionActive(business.constructionProject)) {
    throw new Error('BUSINESS_UNDER_CONSTRUCTION');
  }

  const type = BUSINESS_TYPE_MAP.get(business.typeKey);
  if (!type || !type.actions.includes(actionKey)) {
    throw new Error('BUSINESS_ACTION_UNAVAILABLE');
  }

  const handler = BUSINESS_ACTION_HANDLERS[actionKey];
  return handler(userId, business, input);
}

export async function createBusinessShareBuybackOffer(
  userId: string,
  businessId: string,
  input: { shareholderId: string; amount: number; message?: string },
) {
  const targetShareholderId = String(input.shareholderId ?? '');
  if (!targetShareholderId || targetShareholderId === userId) {
    throw new Error('SHARE_BUYBACK_TARGET_INVALID');
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: { select: USER_PREVIEW_SELECT },
      shareholders: {
        include: {
          user: { select: USER_PREVIEW_SELECT },
        },
      },
    },
  });

  if (!business) {
    throw new Error('BUSINESS_NOT_FOUND');
  }

  if (!(await isBusinessManager(business.id, userId, business.ownerId))) {
    throw new Error('SHARE_BUYBACK_FORBIDDEN');
  }

  const targetShareholder = business.shareholders.find((shareholder) => shareholder.userId === targetShareholderId);
  if (!targetShareholder) {
    throw new Error('SHARE_BUYBACK_TARGET_NOT_FOUND');
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('INVALID_BUYOUT_AMOUNT');
  }

  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, amount);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  const existingPendingOffer = await prisma.businessBuyoutOffer.findFirst({
    where: {
      businessId,
      bidderId: userId,
      ownerId: targetShareholderId,
      status: 'PENDING',
    },
    select: { id: true },
  });

  if (existingPendingOffer) {
    throw new Error('SHARE_BUYBACK_ALREADY_PENDING');
  }

  const offer = await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, amount);
    return tx.businessBuyoutOffer.create({
      data: {
        businessId,
        bidderId: userId,
        ownerId: targetShareholderId,
        amount,
        message: input.message?.trim() || null,
      },
      include: {
        bidder: { select: USER_PREVIEW_SELECT },
        owner: { select: USER_PREVIEW_SELECT },
        business: {
          select: {
            id: true,
            name: true,
            typeKey: true,
          },
        },
      },
    });
  });

  await emitSharedBalanceUpdates(prisma, userId);

  io.to(`user:${userId}`).emit('you:business-buyout-updated', { businessId, offerId: offer.id, status: offer.status });
  io.to(`user:${targetShareholderId}`).emit('you:business-buyout-updated', { businessId, offerId: offer.id, status: offer.status });

  await createNotification({
    userId: targetShareholderId,
    type: 'SYSTEM',
    title: 'Demande de rachat de parts',
    body: `${business.owner.username} propose ${amount.toLocaleString('fr-FR')} money pour racheter tes ${targetShareholder.sharePercent.toLocaleString('fr-FR')} % de parts dans ${business.name}.`,
    data: {
      offerId: offer.id,
      businessId,
      amount,
      actionType: 'BUSINESS_SHARE_BUYBACK_OFFER',
    },
    link: '/you?tab=travail',
    icon: 'briefcase-business',
  });

  logYouAdmin('business_buyout_offer_create', userId, business.owner.username, business.id, business.name, {
    amount,
    targetShareholderId,
    targetShareholderName: targetShareholder.user.username,
    targetSharePercent: targetShareholder.sharePercent,
  });

  return {
    ...serializeBuyoutOffer(offer, userId),
    business: offer.business,
  };
}

export async function createBusinessBuyoutOffer(userId: string, businessId: string, input: { amount: number; message?: string }) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: { select: USER_PREVIEW_SELECT },
    },
  });

  if (!business) {
    throw new Error('BUSINESS_NOT_FOUND');
  }

  if (business.ownerId === userId) {
    throw new Error('BUYOUT_SELF_FORBIDDEN');
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('INVALID_BUYOUT_AMOUNT');
  }

  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, amount);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  await ensureCanOwnAdditionalBusiness(userId);

  const existingPendingOffer = await prisma.businessBuyoutOffer.findFirst({
    where: {
      businessId,
      bidderId: userId,
      status: 'PENDING',
    },
  });
  if (existingPendingOffer) {
    throw new Error('BUYOUT_OFFER_ALREADY_PENDING');
  }

  const offer = await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, amount);
    return tx.businessBuyoutOffer.create({
      data: {
        businessId,
        bidderId: userId,
        ownerId: business.ownerId,
        amount,
        message: input.message?.trim() || null,
      },
      include: {
        bidder: { select: USER_PREVIEW_SELECT },
        owner: { select: USER_PREVIEW_SELECT },
        business: {
          select: {
            id: true,
            name: true,
            typeKey: true,
          },
        },
      },
    });
  });

  await emitSharedBalanceUpdates(prisma, userId);

  io.to(`user:${userId}`).emit('you:business-buyout-updated', { businessId, offerId: offer.id, status: offer.status });
  io.to(`user:${business.ownerId}`).emit('you:business-buyout-updated', { businessId, offerId: offer.id, status: offer.status });

  await createNotification({
    userId: business.ownerId,
    type: 'SYSTEM',
    title: 'Nouvelle offre de rachat',
    body: `${offer.bidder.username} propose ${amount.toLocaleString('fr-FR')} money pour ${business.name}.`,
    data: {
      offerId: offer.id,
      businessId,
      amount,
      actionType: 'BUSINESS_BUYOUT_OFFER',
    },
    link: '/you?tab=travail',
    icon: 'briefcase-business',
  });

  logYouAdmin('business_buyout_offer_create', userId, offer.bidder.username, business.id, business.name, {
    amount,
    ownerId: business.ownerId,
  });

  return {
    ...serializeBuyoutOffer(offer, userId),
    business: offer.business,
  };
}

export async function respondToBusinessBuyoutOffer(userId: string, offerId: string, decision: 'accept' | 'reject') {
  const offer = await prisma.businessBuyoutOffer.findUnique({
    where: { id: offerId },
    include: {
      bidder: { select: USER_PREVIEW_SELECT },
      owner: { select: USER_PREVIEW_SELECT },
      business: {
        include: {
          owner: { select: USER_PREVIEW_SELECT },
          shareholders: {
            include: {
              user: { select: USER_PREVIEW_SELECT },
            },
          },
        },
      },
    },
  });

  if (!offer) {
    throw new Error('BUYOUT_OFFER_NOT_FOUND');
  }

  if (offer.status !== 'PENDING') {
    throw new Error('BUYOUT_OFFER_ALREADY_RESOLVED');
  }

  const decidedAt = new Date();
  const isBusinessOwnerSellOffer = offer.ownerId === offer.business.ownerId;

  if (isBusinessOwnerSellOffer && (offer.ownerId !== userId || !(await isBusinessManager(offer.businessId, userId, offer.business.ownerId)))) {
    throw new Error('BUYOUT_OFFER_REVIEW_FORBIDDEN');
  }

  if (!isBusinessOwnerSellOffer && offer.ownerId !== userId) {
    throw new Error('BUYOUT_OFFER_REVIEW_FORBIDDEN');
  }

  if (decision === 'reject') {
    const rejected = await prisma.$transaction(async (tx) => {
      const updated = await tx.businessBuyoutOffer.update({
        where: { id: offer.id },
        data: {
          status: 'REJECTED',
          decidedAt,
        },
      });
      await tx.user.update({
        where: { id: offer.bidderId },
        data: { money: { increment: offer.amount } },
      });
      return updated;
    });

    await emitSharedBalanceUpdates(prisma, offer.bidderId);

    io.to(`user:${offer.bidderId}`).emit('you:business-buyout-updated', { businessId: offer.businessId, offerId: offer.id, status: rejected.status });
    io.to(`user:${userId}`).emit('you:business-buyout-updated', { businessId: offer.businessId, offerId: offer.id, status: rejected.status });

    await createNotification({
      userId: offer.bidderId,
      type: 'SYSTEM',
      title: 'Offre de rachat refusee',
      body: `${offer.business.name} a refuse ton offre de ${offer.amount.toLocaleString('fr-FR')} money.`,
      link: '/you?tab=explore',
      icon: 'briefcase-business',
    });

    logYouAdmin('business_buyout_offer_respond', userId, offer.owner.username, offer.business.id, offer.business.name, {
      offerId,
      bidderId: offer.bidderId,
      bidderName: offer.bidder.username,
      amount: offer.amount,
      decision: 'reject',
    });

    return {
      id: rejected.id,
      status: rejected.status,
      decidedAt: rejected.decidedAt?.toISOString() ?? null,
    };
  }

  if (!isBusinessOwnerSellOffer) {
    if (offer.bidderId !== offer.business.ownerId) {
      throw new Error('BUYOUT_OFFER_REVIEW_FORBIDDEN');
    }

    const shareholder = offer.business.shareholders.find((entry) => entry.userId === offer.ownerId);
    if (!shareholder) {
      throw new Error('SHARE_BUYBACK_TARGET_NOT_FOUND');
    }

    await prisma.$transaction(async (tx) => {
      await tx.businessBuyoutOffer.update({
        where: { id: offer.id },
        data: {
          status: 'ACCEPTED',
          decidedAt,
        },
      });

      await tx.businessShareholder.delete({
        where: {
          businessId_userId: {
            businessId: offer.businessId,
            userId: offer.ownerId,
          },
        },
      });

      await tx.user.update({
        where: { id: offer.ownerId },
        data: { money: { increment: offer.amount } },
      });
    });

    await emitSharedBalanceUpdatesForUserIds(prisma, [offer.ownerId, offer.bidderId]);

    io.to(`user:${offer.bidderId}`).emit('you:business-buyout-updated', { businessId: offer.businessId, offerId: offer.id, status: 'ACCEPTED' });
    io.to(`user:${offer.ownerId}`).emit('you:business-buyout-updated', { businessId: offer.businessId, offerId: offer.id, status: 'ACCEPTED' });

    await Promise.allSettled([
      createNotification({
        userId: offer.bidderId,
        type: 'SYSTEM',
        title: 'Rachat de parts accepte',
        body: `${offer.owner.username} a accepte. Tu recuperes ${shareholder.sharePercent.toLocaleString('fr-FR')} % de parts de ${offer.business.name}.`,
        link: '/you?tab=travail',
        icon: 'briefcase-business',
      }),
      createNotification({
        userId: offer.ownerId,
        type: 'MONEY_RECEIVED',
        title: 'Vente de parts acceptee',
        body: `Tu as vendu tes ${shareholder.sharePercent.toLocaleString('fr-FR')} % de parts de ${offer.business.name} pour ${offer.amount.toLocaleString('fr-FR')} money.`,
        link: '/you?tab=travail',
        icon: 'briefcase-business',
      }),
    ]);

    logYouAdmin('business_buyout_offer_respond', userId, offer.owner.username, offer.business.id, offer.business.name, {
      offerId,
      bidderId: offer.bidderId,
      bidderName: offer.bidder.username,
      amount: offer.amount,
      decision,
      soldSharePercent: shareholder.sharePercent,
    });

    return {
      id: offer.id,
      status: 'ACCEPTED',
      decidedAt: decidedAt.toISOString(),
    };
  }

  await ensureCanOwnAdditionalBusiness(offer.bidderId);

  await prisma.$transaction(async (tx) => {
    await tx.businessBuyoutOffer.update({
      where: { id: offer.id },
      data: {
        status: 'ACCEPTED',
        decidedAt,
      },
    });
    await tx.business.update({
      where: { id: offer.businessId },
      data: { ownerId: offer.bidderId },
    });
    await tx.user.update({
      where: { id: userId },
      data: { money: { increment: offer.amount } },
    });
  });

  await emitSharedBalanceUpdatesForUserIds(prisma, [userId, offer.bidderId]);

  io.to(`user:${offer.bidderId}`).emit('you:business-buyout-updated', { businessId: offer.businessId, offerId: offer.id, status: 'ACCEPTED' });
  io.to(`user:${userId}`).emit('you:business-buyout-updated', { businessId: offer.businessId, offerId: offer.id, status: 'ACCEPTED' });

  await createNotification({
    userId: offer.bidderId,
    type: 'SYSTEM',
    title: 'Offre de rachat acceptee',
    body: `Tu deviens proprietaire de ${offer.business.name}.`,
    link: '/you?tab=travail',
    icon: 'briefcase-business',
  });

  logYouAdmin('business_buyout_offer_respond', userId, offer.owner.username, offer.business.id, offer.business.name, {
    offerId,
    bidderId: offer.bidderId,
    amount: offer.amount,
    decision,
  });

  return {
    id: offer.id,
    status: 'ACCEPTED',
    decidedAt: decidedAt.toISOString(),
  };
}

export async function cancelBusinessShareProposal(userId: string, proposalId: string) {
  const proposal = await prisma.businessShareProposal.findUnique({
    where: { id: proposalId },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          typeKey: true,
          ownerId: true,
        },
      },
      investor: { select: USER_PREVIEW_SELECT },
      owner: { select: USER_PREVIEW_SELECT },
    },
  });

  if (!proposal) {
    throw new Error('SHARE_PROPOSAL_NOT_FOUND');
  }

  if (proposal.investorId !== userId) {
    throw new Error('SHARE_PROPOSAL_CANCEL_FORBIDDEN');
  }

  if (proposal.status !== 'PENDING') {
    throw new Error('SHARE_PROPOSAL_ALREADY_RESOLVED');
  }

  const cancelAvailableAt = getBusinessShareProposalCancelAvailableAt(proposal.createdAt);
  if (Date.now() < cancelAvailableAt.getTime()) {
    throw new Error('SHARE_PROPOSAL_CANCEL_TOO_EARLY');
  }

  const cancelledAt = new Date();
  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.businessShareProposal.update({
      where: { id: proposal.id },
      data: {
        status: 'CANCELLED',
        decidedAt: cancelledAt,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { money: { increment: proposal.amount } },
    });

    return updated;
  });

  await emitSharedBalanceUpdates(prisma, userId);

  io.to(`user:${userId}`).emit('you:business-share-proposal-updated', { businessId: proposal.businessId, proposalId: proposal.id, status: cancelled.status });
  io.to(`user:${proposal.ownerId}`).emit('you:business-share-proposal-updated', { businessId: proposal.businessId, proposalId: proposal.id, status: cancelled.status });

  await Promise.allSettled([
    createNotification({
      userId,
      type: 'MONEY_RECEIVED',
      title: 'Proposition annulee',
      body: `Ta proposition pour ${proposal.business.name} a ete annulee et ${proposal.amount.toLocaleString('fr-FR')} money t a ete rendu.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
    createNotification({
      userId: proposal.ownerId,
      type: 'SYSTEM',
      title: 'Proposition actionnaire annulee',
      body: `${proposal.investor.username} a annule sa proposition pour ${proposal.business.name}.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
  ]);

  logYouAdmin('business_share_proposal_cancel', userId, undefined, proposal.businessId, proposal.business.name, {
    proposalId,
    amount: proposal.amount,
    ownerId: proposal.ownerId,
  });

  return {
    id: cancelled.id,
    status: cancelled.status,
    decidedAt: cancelled.decidedAt?.toISOString() ?? null,
  };
}

export async function cancelBusinessBuyoutOffer(userId: string, offerId: string) {
  const offer = await prisma.businessBuyoutOffer.findUnique({
    where: { id: offerId },
  });

  if (!offer) {
    throw new Error('BUYOUT_OFFER_NOT_FOUND');
  }

  if (offer.bidderId !== userId) {
    throw new Error('BUYOUT_OFFER_CANCEL_FORBIDDEN');
  }

  if (offer.status !== 'PENDING') {
    throw new Error('BUYOUT_OFFER_ALREADY_RESOLVED');
  }

  const cancelledAt = new Date();
  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.businessBuyoutOffer.update({
      where: { id: offer.id },
      data: {
        status: 'CANCELLED',
        decidedAt: cancelledAt,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { money: { increment: offer.amount } },
    });
    return updated;
  });

  await emitSharedBalanceUpdates(prisma, userId);

  io.to(`user:${userId}`).emit('you:business-buyout-updated', { businessId: offer.businessId, offerId: offer.id, status: cancelled.status });
  io.to(`user:${offer.ownerId}`).emit('you:business-buyout-updated', { businessId: offer.businessId, offerId: offer.id, status: cancelled.status });

  logYouAdmin('business_buyout_offer_cancel', userId, undefined, offer.businessId, offerId, {
    offerId,
    amount: offer.amount,
    ownerId: offer.ownerId,
  });

  return {
    id: cancelled.id,
    status: cancelled.status,
    decidedAt: cancelled.decidedAt?.toISOString() ?? null,
  };
}

export async function createRelationship(userId: string, targetUserId: string, type: 'FRIEND' | 'DATING' = 'DATING') {
  if (userId === targetUserId) {
    throw new Error('RELATIONSHIP_SELF_FORBIDDEN');
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, username: true, isApproved: true },
  });

  if (!target?.isApproved) {
    throw new Error('TARGET_NOT_FOUND');
  }

  const pair = getCanonicalPair(userId, targetUserId);
  const existing = await prisma.relationship.findUnique({
    where: {
      userAId_userBId: pair,
    },
    include: RELATIONSHIP_INCLUDE,
  });

  if (existing) {
    if (existing.status !== 'DIVORCED') {
      throw new Error('RELATIONSHIP_ALREADY_EXISTS');
    }

    const revivedRelationship = await prisma.relationship.update({
      where: { id: existing.id },
      data: {
        status: 'DATING',
        marriedAt: null,
        connectionLevel: Math.max(existing.connectionLevel, 72),
      },
      include: RELATIONSHIP_INCLUDE,
    });

    await createNotification({
      userId: targetUserId,
      type: 'SYSTEM',
      title: 'Relation reprise',
      body: `${revivedRelationship.userAId === userId ? revivedRelationship.userA.username : revivedRelationship.userB.username} relance votre relation.`,
      link: '/you?tab=social',
      icon: 'heart',
    });

    logYouAdmin('relationship_reactivate', userId, undefined, revivedRelationship.id, `${revivedRelationship.userA.username} / ${revivedRelationship.userB.username}`, {
      targetUserId,
      relationshipStatus: revivedRelationship.status,
      connectionLevel: revivedRelationship.connectionLevel,
    });

    return serializeRelationship(revivedRelationship, userId);
  }

  const relationship = await prisma.relationship.create({
    data: {
      ...pair,
      initiatedById: userId,
      status: type,
      connectionLevel: 72,
    },
    include: RELATIONSHIP_INCLUDE,
  });

  await createNotification({
    userId: targetUserId,
    type: 'SYSTEM',
    title: 'Nouvelle relation',
    body: `${relationship.userAId === userId ? relationship.userA.username : relationship.userB.username} t'a ajoute dans ses relations.`,
    link: '/you?tab=social',
    icon: 'heart',
  });

  logYouAdmin('relationship_create', userId, undefined, relationship.id, `${relationship.userA.username} / ${relationship.userB.username}`, {
    targetUserId,
    relationshipType: type,
  });

  // Social + Charisme XP: créer une relation = investissement social et charme
  void grantSkillXp(userId, 'social', 5);
  void grantSkillXp(userId, 'charisme', 3);

  return serializeRelationship(relationship, userId);
}

export async function proposeMarriage(userId: string, relationshipId: string, message?: string) {
  const relationship = await prisma.relationship.findUnique({
    where: { id: relationshipId },
    include: RELATIONSHIP_INCLUDE,
  });

  if (!relationship) {
    throw new Error('RELATIONSHIP_NOT_FOUND');
  }

  if (relationship.userAId !== userId && relationship.userBId !== userId) {
    throw new Error('RELATIONSHIP_FORBIDDEN');
  }

  if (relationship.status === 'MARRIED') {
    throw new Error('RELATIONSHIP_ALREADY_MARRIED');
  }

  if (relationship.connectionLevel < 70) {
    throw new Error('RELATIONSHIP_LEVEL_TOO_LOW');
  }

  const pending = relationship.marriageProposals.find((proposal: any) => proposal.status === 'PENDING');
  if (pending) {
    throw new Error('MARRIAGE_PROPOSAL_ALREADY_PENDING');
  }

  const recipientId = relationship.userAId === userId ? relationship.userBId : relationship.userAId;
  const proposer = relationship.userAId === userId ? relationship.userA : relationship.userB;

  const proposal = await prisma.marriageProposal.create({
    data: {
      relationshipId: relationship.id,
      proposerId: userId,
      recipientId,
      message: message?.trim() || null,
    },
  });

  await createNotification({
    userId: recipientId,
    type: 'SYSTEM',
    title: 'Demande en mariage',
    body: `${proposer.username} t'a demande en mariage.`,
    link: '/you?tab=social',
    icon: 'heart',
  });

  logYouAdmin('marriage_proposal', userId, proposer.username, relationship.id, `${relationship.userA.username} / ${relationship.userB.username}`, {
    recipientId,
    message: message?.trim() || null,
  });

  // Charisme XP pour le demandeur: faire une demande en mariage est un acte courageux et charismatique
  void grantSkillXp(userId, 'charisme', 5);

  return {
    id: proposal.id,
    relationshipId: proposal.relationshipId,
    proposerId: proposal.proposerId,
    recipientId: proposal.recipientId,
    message: proposal.message,
    status: proposal.status,
    createdAt: proposal.createdAt.toISOString(),
  };
}

export async function respondToMarriageProposal(userId: string, proposalId: string, decision: 'accept' | 'reject') {
  const proposal = await prisma.marriageProposal.findUnique({
    where: { id: proposalId },
    include: {
      relationship: {
        include: RELATIONSHIP_INCLUDE,
      },
    },
  });

  if (!proposal) {
    throw new Error('MARRIAGE_PROPOSAL_NOT_FOUND');
  }

  if (proposal.recipientId !== userId) {
    throw new Error('MARRIAGE_PROPOSAL_FORBIDDEN');
  }

  if (proposal.status !== 'PENDING') {
    throw new Error('MARRIAGE_PROPOSAL_ALREADY_RESOLVED');
  }

  const responderUsername = proposal.relationship.userAId === userId
    ? proposal.relationship.userA.username
    : proposal.relationship.userB.username;

  const now = new Date();

  if (decision === 'reject') {
    const rejectedProposal = await prisma.marriageProposal.update({
      where: { id: proposalId },
      data: {
        status: 'REJECTED',
        respondedAt: now,
      },
    });

    await createNotification({
      userId: proposal.proposerId,
      type: 'SYSTEM',
      title: 'Demande refusee',
      body: 'Ta demande en mariage a ete refusee.',
      link: '/you?tab=social',
      icon: 'heart-crack',
    });

    logYouAdmin('marriage_response', userId, responderUsername, proposal.relationship.id, `${proposal.relationship.userA.username} / ${proposal.relationship.userB.username}`, {
      proposalId,
      decision: 'reject',
    });

    return {
      proposal: {
        id: rejectedProposal.id,
        status: rejectedProposal.status,
        respondedAt: rejectedProposal.respondedAt?.toISOString() ?? null,
      },
      relationship: serializeRelationship(proposal.relationship, userId),
    };
  }

  const [acceptedProposal, updatedRelationship] = await prisma.$transaction([
    prisma.marriageProposal.update({
      where: { id: proposalId },
      data: {
        status: 'ACCEPTED',
        respondedAt: now,
      },
    }),
    prisma.relationship.update({
      where: { id: proposal.relationshipId },
      data: {
        status: 'MARRIED',
        marriedAt: now,
      },
      include: RELATIONSHIP_INCLUDE,
    }),
  ]);

  await Promise.allSettled([
    createNotification({
      userId: proposal.proposerId,
      type: 'SYSTEM',
      title: 'Mariage accepte',
      body: 'Ta demande en mariage a ete acceptee.',
      link: '/you?tab=social',
      icon: 'heart',
    }),
    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Mariage valide',
      body: 'Votre relation est maintenant marquee comme mariee.',
      link: '/you?tab=social',
      icon: 'heart',
    }),
  ]);

  await Promise.all([
    emitSharedBalanceUpdates(prisma, proposal.proposerId),
    emitSharedBalanceUpdates(prisma, proposal.recipientId),
  ]);

  // Social XP pour les deux: le mariage est le sommet du capital social
  void grantSkillXp(proposal.proposerId, 'social', 20);
  void grantSkillXp(userId, 'social', 20);
  // Charisme XP pour le demandeur: sa demande a été acceptée
  void grantSkillXp(proposal.proposerId, 'charisme', 10);

  logYouAdmin('marriage_response', userId, responderUsername, updatedRelationship.id, `${updatedRelationship.userA.username} / ${updatedRelationship.userB.username}`, {
    proposalId,
    decision: 'accept',
  });

  return {
    proposal: {
      id: acceptedProposal.id,
      status: acceptedProposal.status,
      respondedAt: acceptedProposal.respondedAt?.toISOString() ?? null,
    },
    relationship: serializeRelationship(updatedRelationship, userId),
  };
}

export async function depositToCouple(userId: string, relationshipId: string, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('INVALID_COUPLE_AMOUNT');

  const relationship = await prisma.relationship.findUnique({ where: { id: relationshipId } });
  if (!relationship) throw new Error('RELATIONSHIP_NOT_FOUND');
  if (relationship.userAId !== userId && relationship.userBId !== userId) throw new Error('RELATIONSHIP_FORBIDDEN');
  if (relationship.status !== 'MARRIED') throw new Error('RELATIONSHIP_NOT_MARRIED');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  if ((user?.money ?? 0) < amount) throw new Error('INSUFFICIENT_MONEY');

  const [updatedRelationship] = await prisma.$transaction([
    prisma.relationship.update({
      where: { id: relationshipId },
      data: { coupleBalance: { increment: amount } },
      include: RELATIONSHIP_INCLUDE,
    }),
    prisma.user.update({ where: { id: userId }, data: { money: { decrement: amount } } }),
  ]);

  await emitSharedBalanceUpdates(prisma, userId);

  logYouAdmin('couple_deposit', userId, undefined, updatedRelationship.id, `${updatedRelationship.userA.username} / ${updatedRelationship.userB.username}`, {
    amount,
    coupleBalance: updatedRelationship.coupleBalance,
  });

  return { relationship: serializeRelationship(updatedRelationship, userId) };
}

export async function withdrawFromCouple(userId: string, relationshipId: string, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('INVALID_COUPLE_AMOUNT');

  const relationship = await prisma.relationship.findUnique({ where: { id: relationshipId } });
  if (!relationship) throw new Error('RELATIONSHIP_NOT_FOUND');
  if (relationship.userAId !== userId && relationship.userBId !== userId) throw new Error('RELATIONSHIP_FORBIDDEN');
  if (relationship.status !== 'MARRIED') throw new Error('RELATIONSHIP_NOT_MARRIED');
  if ((relationship.coupleBalance ?? 0) < amount) throw new Error('COUPLE_BALANCE_TOO_LOW');

  const [updatedRelationship] = await prisma.$transaction([
    prisma.relationship.update({
      where: { id: relationshipId },
      data: { coupleBalance: { decrement: amount } },
      include: RELATIONSHIP_INCLUDE,
    }),
    prisma.user.update({ where: { id: userId }, data: { money: { increment: amount } } }),
  ]);

  await emitSharedBalanceUpdates(prisma, userId);

  logYouAdmin('couple_withdraw', userId, undefined, updatedRelationship.id, `${updatedRelationship.userA.username} / ${updatedRelationship.userB.username}`, {
    amount,
    coupleBalance: updatedRelationship.coupleBalance,
  });

  return { relationship: serializeRelationship(updatedRelationship, userId) };
}

export async function divorceRelationship(userId: string, relationshipId: string, message?: string) {
  const relationship = await prisma.relationship.findUnique({
    where: { id: relationshipId },
    include: RELATIONSHIP_INCLUDE,
  });

  if (!relationship) {
    throw new Error('RELATIONSHIP_NOT_FOUND');
  }

  if (relationship.userAId !== userId && relationship.userBId !== userId) {
    throw new Error('RELATIONSHIP_FORBIDDEN');
  }

  if (relationship.status !== 'MARRIED') {
    throw new Error('RELATIONSHIP_NOT_MARRIED');
  }

  const existingProposal = relationship.divorceProposals.find((proposal: any) => proposal.status === 'PENDING');
  if (existingProposal) {
    throw new Error('DIVORCE_PROPOSAL_ALREADY_PENDING');
  }

  const recipientId = relationship.userAId === userId ? relationship.userBId : relationship.userAId;
  const proposer = relationship.userAId === userId ? relationship.userA : relationship.userB;

  const proposal = await prisma.divorceProposal.create({
    data: {
      relationshipId: relationship.id,
      proposerId: userId,
      recipientId,
      message: message?.trim() || null,
    },
  });

  await Promise.allSettled([
    createNotification({
      userId: recipientId,
      type: 'SYSTEM',
      title: 'Demande de divorce',
      body: `${proposer.username} souhaite valider un divorce.`,
      link: '/you?tab=social',
      icon: 'heart-crack',
    }),
  ]);

  logYouAdmin('divorce_proposal', userId, proposer.username, relationship.id, `${relationship.userA.username} / ${relationship.userB.username}`, {
    recipientId,
    message: message?.trim() || null,
  });

  return {
    id: proposal.id,
    relationshipId: proposal.relationshipId,
    proposerId: proposal.proposerId,
    recipientId: proposal.recipientId,
    message: proposal.message,
    status: proposal.status,
    createdAt: proposal.createdAt.toISOString(),
    respondedAt: proposal.respondedAt?.toISOString() ?? null,
  };
}

export async function respondToDivorceProposal(userId: string, proposalId: string, decision: 'accept' | 'reject') {
  const proposal = await prisma.divorceProposal.findUnique({
    where: { id: proposalId },
    include: {
      relationship: {
        include: RELATIONSHIP_INCLUDE,
      },
    },
  });

  if (!proposal) {
    throw new Error('DIVORCE_PROPOSAL_NOT_FOUND');
  }

  if (proposal.recipientId !== userId) {
    throw new Error('DIVORCE_PROPOSAL_FORBIDDEN');
  }

  if (proposal.status !== 'PENDING') {
    throw new Error('DIVORCE_PROPOSAL_ALREADY_RESOLVED');
  }

  const responderUsername = proposal.relationship.userAId === userId
    ? proposal.relationship.userA.username
    : proposal.relationship.userB.username;

  const now = new Date();

  if (decision === 'reject') {
    const rejectedProposal = await prisma.divorceProposal.update({
      where: { id: proposalId },
      data: {
        status: 'REJECTED',
        respondedAt: now,
      },
    });

    await createNotification({
      userId: proposal.proposerId,
      type: 'SYSTEM',
      title: 'Divorce refuse',
      body: 'La demande de divorce a ete refusee.',
      link: '/you?tab=social',
      icon: 'heart-crack',
    });

    logYouAdmin('divorce_response', userId, responderUsername, proposal.relationship.id, `${proposal.relationship.userA.username} / ${proposal.relationship.userB.username}`, {
      proposalId,
      decision: 'reject',
    });

    return {
      proposal: {
        id: rejectedProposal.id,
        status: rejectedProposal.status,
        respondedAt: rejectedProposal.respondedAt?.toISOString() ?? null,
      },
      relationship: serializeRelationship(proposal.relationship, userId),
    };
  }

  // Split couple balance 50/50 on divorce; individual money stays untouched
  const coupleBalance = proposal.relationship.coupleBalance ?? 0;
  const halfA = Math.floor(coupleBalance / 2);
  const halfB = coupleBalance - halfA;

  const [acceptedProposal, updatedRelationship] = await prisma.$transaction([
    prisma.divorceProposal.update({
      where: { id: proposalId },
      data: {
        status: 'ACCEPTED',
        respondedAt: now,
      },
    }),
    prisma.relationship.update({
      where: { id: proposal.relationshipId },
      data: {
        status: 'DIVORCED',
        marriedAt: null,
        coupleBalance: 0,
      },
      include: RELATIONSHIP_INCLUDE,
    }),
    prisma.user.update({ where: { id: proposal.relationship.userAId }, data: { money: { increment: halfA } } }),
    prisma.user.update({ where: { id: proposal.relationship.userBId }, data: { money: { increment: halfB } } }),
  ]);

  await Promise.allSettled([
    createNotification({
      userId: proposal.proposerId,
      type: 'SYSTEM',
      title: 'Divorce accepte',
      body: 'Le divorce a ete valide par les deux personnes.',
      link: '/you?tab=social',
      icon: 'heart-crack',
    }),
    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Divorce valide',
      body: 'Votre relation est maintenant marquee comme divorcee.',
      link: '/you?tab=social',
      icon: 'heart-crack',
    }),
  ]);

  logYouAdmin('divorce_response', userId, responderUsername, updatedRelationship.id, `${updatedRelationship.userA.username} / ${updatedRelationship.userB.username}`, {
    proposalId,
    decision: 'accept',
    coupleBalanceSplit: {
      userA: halfA,
      userB: halfB,
    },
  });

  // Social XP pénalité pour les deux: le divorce dégrade le capital social
  void penalizeSkillXp(proposal.proposerId, 'social', 15);
  void penalizeSkillXp(userId, 'social', 15);

  return {
    proposal: {
      id: acceptedProposal.id,
      status: acceptedProposal.status,
      respondedAt: acceptedProposal.respondedAt?.toISOString() ?? null,
    },
    relationship: serializeRelationship(updatedRelationship, userId),
  };
}

export async function forceDivorceRelationship(adminUserId: string, targetUserId: string) {
  const relationship = await prisma.relationship.findFirst({
    where: {
      status: 'MARRIED',
      OR: [{ userAId: targetUserId }, { userBId: targetUserId }],
    },
    include: RELATIONSHIP_INCLUDE,
  });

  if (!relationship) {
    throw new Error('RELATIONSHIP_NOT_MARRIED');
  }

  const coupleBalance = relationship.coupleBalance ?? 0;
  const halfA = Math.floor(coupleBalance / 2);
  const halfB = coupleBalance - halfA;
  const now = new Date();

  const [updatedRelationship] = await prisma.$transaction([
    prisma.marriageProposal.updateMany({
      where: {
        relationshipId: relationship.id,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        respondedAt: now,
      },
    }),
    prisma.divorceProposal.updateMany({
      where: {
        relationshipId: relationship.id,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        respondedAt: now,
      },
    }),
    prisma.relationship.update({
      where: { id: relationship.id },
      data: {
        status: 'DIVORCED',
        marriedAt: null,
        coupleBalance: 0,
      },
      include: RELATIONSHIP_INCLUDE,
    }),
    prisma.user.update({ where: { id: relationship.userAId }, data: { money: { increment: halfA } } }),
    prisma.user.update({ where: { id: relationship.userBId }, data: { money: { increment: halfB } } }),
  ]);

  await Promise.allSettled([
    createNotification({
      userId: relationship.userAId,
      type: 'SYSTEM',
      title: 'Divorce force',
      body: 'Un administrateur a force la dissolution de votre mariage.',
      link: '/you?tab=social',
      icon: 'heart-crack',
    }),
    createNotification({
      userId: relationship.userBId,
      type: 'SYSTEM',
      title: 'Divorce force',
      body: 'Un administrateur a force la dissolution de votre mariage.',
      link: '/you?tab=social',
      icon: 'heart-crack',
    }),
  ]);

  await emitSharedBalanceUpdatesForUserIds(prisma, [relationship.userAId, relationship.userBId]);

  void penalizeSkillXp(relationship.userAId, 'social', 15);
  void penalizeSkillXp(relationship.userBId, 'social', 15);

  logYouAdmin('relationship_force_divorce', adminUserId, undefined, relationship.id, `${relationship.userA.username} / ${relationship.userB.username}`, {
    targetUserId,
    forcedBy: adminUserId,
    coupleBalanceSplit: {
      userA: halfA,
      userB: halfB,
    },
  });

  return {
    relationship: serializeRelationship(updatedRelationship, adminUserId),
  };
}

export async function forgetRelationship(userId: string, relationshipId: string) {
  const relationship = await prisma.relationship.findUnique({
    where: { id: relationshipId },
    include: RELATIONSHIP_INCLUDE,
  });
  if (!relationship) throw new Error('RELATIONSHIP_NOT_FOUND');
  if (relationship.userAId !== userId && relationship.userBId !== userId) throw new Error('RELATIONSHIP_FORBIDDEN');
  if (relationship.status === 'MARRIED') throw new Error('RELATIONSHIP_NOT_MARRIED');
  await prisma.relationship.delete({ where: { id: relationshipId } });

  logYouAdmin('relationship_forget', userId, undefined, relationship.id, `${relationship.userA.username} / ${relationship.userB.username}`, {
    previousStatus: relationship.status,
  });
}

export async function makeMistress(userId: string, relationshipId: string) {
  const relationship = await prisma.relationship.findUnique({
    where: { id: relationshipId },
    include: RELATIONSHIP_INCLUDE,
  });
  if (!relationship) throw new Error('RELATIONSHIP_NOT_FOUND');
  if (relationship.userAId !== userId && relationship.userBId !== userId) throw new Error('RELATIONSHIP_FORBIDDEN');
  if (!['DATING', 'FRIEND'].includes(relationship.status)) throw new Error('RELATIONSHIP_NOT_ACTIVE');

  const viewerMarried = await prisma.relationship.findFirst({
    where: { status: 'MARRIED', OR: [{ userAId: userId }, { userBId: userId }], id: { not: relationshipId } },
  });
  if (!viewerMarried) throw new Error('NOT_MARRIED');

  const otherUserId = relationship.userAId === userId ? relationship.userBId : relationship.userAId;
  const updated = await prisma.relationship.update({
    where: { id: relationshipId },
    data: { status: 'MISTRESS' },
    include: RELATIONSHIP_INCLUDE,
  });

  await createNotification({
    userId: otherUserId,
    type: 'SYSTEM',
    title: 'Liaison secrete',
    body: 'Votre relation a ete transformee en liaison secrete.',
    link: '/you?tab=social',
    icon: 'heart',
  });

  logYouAdmin('relationship_mistress', userId, undefined, updated.id, `${relationship.userA.username} / ${relationship.userB.username}`, {
    otherUserId,
  });

  return serializeRelationship(updated, userId);
}

export async function suspectCheating(userId: string, relationshipId: string) {
  const relationship = await prisma.relationship.findUnique({
    where: { id: relationshipId },
    include: RELATIONSHIP_INCLUDE,
  });
  if (!relationship) throw new Error('RELATIONSHIP_NOT_FOUND');
  if (relationship.userAId !== userId && relationship.userBId !== userId) throw new Error('RELATIONSHIP_FORBIDDEN');
  if (relationship.status !== 'MARRIED') throw new Error('RELATIONSHIP_NOT_MARRIED');

  const accusedId = relationship.userAId === userId ? relationship.userBId : relationship.userAId;

  const existingAccusation = await prisma.cheatingAccusation.findFirst({
    where: { accuserId: userId, accusedId, status: 'PENDING' },
  });
  if (existingAccusation) throw new Error('CHEATING_ACCUSATION_ALREADY_PENDING');

  const mistressRelationship = await prisma.relationship.findFirst({
    where: { 
      id: { not: relationshipId },
      status: { in: ['MISTRESS', 'DATING', 'MARRIED'] },
      OR: [{ userAId: accusedId }, { userBId: accusedId }] 
    },
  });

  if (mistressRelationship) {
    const [viewerUser, accusedUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { money: true } }),
      prisma.user.findUnique({ where: { id: accusedId }, select: { money: true } }),
    ]);
    const coupleBalance = relationship.coupleBalance ?? 0;
    const totalMoney =
      (viewerUser?.money ?? BigInt(0)) + (accusedUser?.money ?? BigInt(0)) + BigInt(coupleBalance);

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { money: totalMoney } }),
      prisma.user.update({ where: { id: accusedId }, data: { money: BigInt(0) } }),
      prisma.relationship.update({ where: { id: relationshipId }, data: { status: 'DIVORCED', marriedAt: null, coupleBalance: 0 } }),
    ]);

    await createNotification({
      userId: accusedId,
      type: 'SYSTEM',
      title: 'Tricherie decouverte',
      body: 'Ta liaison a ete prouvee. Ton conjoint a pris tout l argent et vous etes divorces.',
      link: '/you?tab=social',
      icon: 'heart-crack',
    });

    await emitSharedBalanceUpdatesForUserIds(prisma, [userId, accusedId]);

    logYouAdmin('relationship_cheating_report', userId, undefined, relationship.id, `${relationship.userA.username} / ${relationship.userB.username}`, {
      accusedId,
      correct: true,
      seizedMoney: totalMoney,
      coupleBalance,
    });

    return { correct: true };
  }

  await prisma.cheatingAccusation.create({ data: { accuserId: userId, accusedId } });

  await createNotification({
    userId: accusedId,
    type: 'SYSTEM',
    title: 'Suspicion de tricherie',
    body: 'Ton conjoint te soupçonne de tricherie. Tu peux aller en justice depuis l onglet social.',
    link: '/you?tab=social',
    icon: 'gavel',
  });

  logYouAdmin('relationship_cheating_report', userId, undefined, relationship.id, `${relationship.userA.username} / ${relationship.userB.username}`, {
    accusedId,
    correct: false,
  });

  return { correct: false };
}

export async function respondToCourtCase(userId: string, accusationId: string, decision: 'court' | 'drop') {
  const accusation = await prisma.cheatingAccusation.findUnique({
    where: { id: accusationId },
    include: { accuser: { select: USER_PREVIEW_SELECT } },
  });
  if (!accusation) throw new Error('CHEATING_ACCUSATION_NOT_FOUND');
  if (accusation.accusedId !== userId) throw new Error('CHEATING_ACCUSATION_FORBIDDEN');
  if (accusation.status !== 'PENDING') throw new Error('CHEATING_ACCUSATION_ALREADY_RESOLVED');

  if (decision === 'drop') {
    await prisma.cheatingAccusation.update({ where: { id: accusationId }, data: { status: 'DROPPED' } });
    logYouAdmin('relationship_court_case', userId, undefined, accusationId, accusation.accuser.username, {
      accusationId,
      decision: 'drop',
    });
    return { decision: 'drop' };
  }

  const [accuserUser, accusedUser, marriageRel] = await Promise.all([
    prisma.user.findUnique({ where: { id: accusation.accuserId }, select: { money: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { money: true } }),
    prisma.relationship.findFirst({
      where: {
        status: 'MARRIED',
        OR: [
          { userAId: accusation.accuserId, userBId: userId },
          { userAId: userId, userBId: accusation.accuserId },
        ],
      },
      select: { id: true, coupleBalance: true },
    }),
  ]);
  const coupleBalance = marriageRel?.coupleBalance ?? 0;
  const totalMoney =
    (accuserUser?.money ?? BigInt(0)) + (accusedUser?.money ?? BigInt(0)) + BigInt(coupleBalance);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { money: totalMoney } }),
    prisma.user.update({ where: { id: accusation.accuserId }, data: { money: BigInt(0) } }),
    prisma.cheatingAccusation.update({ where: { id: accusationId }, data: { status: 'COURT_TAKEN' } }),
    ...(marriageRel ? [prisma.relationship.update({ where: { id: marriageRel.id }, data: { coupleBalance: 0 } })] : []),
  ]);

  await createNotification({
    userId: accusation.accuserId,
    type: 'SYSTEM',
    title: 'Jugement rendu',
    body: 'Ta suspicion etait infondee. Le tribunal t a condamne et ton conjoint a pris tout l argent.',
    link: '/you?tab=social',
    icon: 'gavel',
  });

  await emitSharedBalanceUpdatesForUserIds(prisma, [userId, accusation.accuserId]);

  logYouAdmin('relationship_court_case', userId, accusation.accuser.username, marriageRel?.id ?? accusationId, marriageRel ? `${accusation.accuser.username} / ${userId}` : accusation.accuser.username, {
    accusationId,
    decision: 'court',
    seizedMoney: totalMoney,
    coupleBalance,
  });

  return { decision: 'court' };
}

export async function deleteBusiness(requestUserId: string, businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: { select: USER_PREVIEW_SELECT },
      bankAccounts: true,
    },
  });

  if (!business) {
    throw new Error('BUSINESS_NOT_FOUND');
  }

  const requester = await prisma.user.findUnique({
    where: { id: requestUserId },
    select: { isAdmin: true },
  });
  const isOwner = await isBusinessManager(businessId, requestUserId, business.ownerId);
  const isAdmin = Boolean(requester?.isAdmin);

  if (!isOwner && !isAdmin) {
    throw new Error('BUSINESS_LIQUIDATION_FORBIDDEN');
  }

  await prisma.$transaction(async (tx) => {
    // Refund users their bank deposits when a bank is liquidated
    if (business.bankAccounts && business.bankAccounts.length > 0) {
      for (const account of business.bankAccounts) {
        if (account.balance > 0) {
          await tx.user.update({
            where: { id: account.userId },
            data: { money: { increment: account.balance } },
          });
        }
      }
    }

    await tx.business.delete({
      where: { id: businessId },
    });
  });

  const refundedUserIds = business.bankAccounts?.filter(a => a.balance > 0).map(a => a.userId) ?? [];
  if (refundedUserIds.length > 0) {
    await emitSharedBalanceUpdatesForUserIds(prisma, refundedUserIds);
  }

  if (isAdmin && !isOwner) {
    await createNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      title: 'Business supprime',
      body: `${business.name} a ete supprime par un admin.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    });
  }

  logYouAdmin('business_delete', requestUserId, undefined, business.id, business.name, {
    ownerId: business.ownerId,
    ownerName: business.owner.username,
    deletedByAdmin: isAdmin && !isOwner,
  });

  return { id: businessId };
}

export const LIVRET_EPARGNE_COST = 5000;

export async function buyIllegalBusinessUpgrade(userId: string, businessId: string, upgradeKey: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      ownerId: true,
      typeKey: true,
      name: true,
      treasuryMoney: true,
      monthlyRevenue: true,
      satisfaction: true,
      customData: true,
    },
  });

  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('BUSINESS_UPGRADE_FORBIDDEN');
  if (business.typeKey !== 'illegal_market') throw new Error('BUSINESS_UPGRADE_UNAVAILABLE');

  const upgrade = ILLEGAL_BUSINESS_UPGRADE_MAP.get(upgradeKey);
  if (!upgrade) throw new Error('BUSINESS_UPGRADE_UNAVAILABLE');

  const customData = getIllegalBusinessCustomData(business.customData);
  if (customData.unlockedUpgradeKeys.includes(upgradeKey)) {
    throw new Error('UPGRADE_ALREADY_OWNED');
  }
  if (business.treasuryMoney < upgrade.cost) {
    throw new Error('UPGRADE_INSUFFICIENT_FUNDS');
  }

  const nowIso = new Date().toISOString();
  const nextCustomData: IllegalBusinessCustomData = {
    ...customData,
    unlockedUpgradeKeys: [...customData.unlockedUpgradeKeys, upgradeKey],
    upgradedAtByKey: {
      ...(customData.upgradedAtByKey ?? {}),
      [upgradeKey]: nowIso,
    },
  };

  await prisma.business.update({
    where: { id: business.id },
    data: {
      treasuryMoney: { decrement: upgrade.cost },
      monthlyRevenue: { increment: upgrade.revenueBonus },
      satisfaction: Math.max(1, Math.min(100, business.satisfaction + upgrade.satisfactionBonus)),
      customData: JSON.stringify(nextCustomData),
    },
  });

  await logBusinessTransaction(business.id, 'UPGRADE_PURCHASE', -upgrade.cost, `Amelioration: ${upgrade.label}`, userId);

  logYouAdmin('bank_upgrade_purchase', userId, undefined, business.id, business.name, {
    upgradeKey: upgrade.key,
    cost: upgrade.cost,
    revenueBonus: upgrade.revenueBonus,
    satisfactionBonus: upgrade.satisfactionBonus,
  });

  void grantSkillXp(userId, 'illegalite', upgrade.xpReward);

  return {
    upgradeKey: upgrade.key,
    unlockedUpgradeKeys: nextCustomData.unlockedUpgradeKeys,
  };
}

export async function buyLivretEpargneUpgrade(userId: string, businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, ownerId: true, typeKey: true, treasuryMoney: true, livretEpargneUnlocked: true },
  });

  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('BUSINESS_UPGRADE_FORBIDDEN');
  if (business.typeKey !== 'bank') throw new Error('BUSINESS_UPGRADE_UNAVAILABLE');
  if (business.livretEpargneUnlocked) throw new Error('UPGRADE_ALREADY_OWNED');
  if (business.treasuryMoney < LIVRET_EPARGNE_COST) throw new Error('UPGRADE_INSUFFICIENT_FUNDS');

  await prisma.business.update({
    where: { id: businessId },
    data: {
      livretEpargneUnlocked: true,
      treasuryMoney: { decrement: LIVRET_EPARGNE_COST },
    },
  });

  logYouAdmin('bank_upgrade_purchase', userId, undefined, business.id, business.name, {
    cost: LIVRET_EPARGNE_COST,
  });

  return { livretEpargneUnlocked: true };
}

export async function setLoanRate(userId: string, businessId: string, rate: number) {
  if (!Number.isFinite(rate) || rate < 1 || rate > 50) {
    throw new Error('INVALID_LOAN_RATE');
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, typeKey: true, name: true },
  });

  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('BANK_RATE_FORBIDDEN');
  if (business.typeKey !== 'bank') throw new Error('BUSINESS_NOT_FOUND');

  await prisma.business.update({
    where: { id: businessId },
    data: { loanInterestRate: rate },
  });

  logYouAdmin('bank_rate_update', userId, undefined, business.id, business.name, {
    loanInterestRate: rate,
  });

  return { loanInterestRate: rate };
}

export async function updateBusinessMenu(userId: string, businessId: string, menu: Array<{ key: string; label: string; price: number; emoji?: string; imageUrl?: string; section?: string }>) {
  if (!Array.isArray(menu)) throw new Error('INVALID_MENU_FORMAT');
  if (menu.length > 20) throw new Error('MAX_MENU_ITEMS_EXCEEDED');

  const { isAllowedImageUrl } = await import('../../utils/uploads.js');

  for (const item of menu) {
    if (typeof item.key !== 'string' || !item.key || item.key.length > 30) throw new Error('INVALID_ITEM_KEY');
    if (typeof item.label !== 'string' || !item.label || item.label.length > 50) throw new Error('INVALID_ITEM_LABEL');
    if (typeof item.price !== 'number' || item.price <= 0 || item.price > 100000) throw new Error('INVALID_ITEM_PRICE');
    if (item.emoji && (typeof item.emoji !== 'string' || item.emoji.length > 10)) throw new Error('INVALID_ITEM_EMOJI');
    if (item.imageUrl && (typeof item.imageUrl !== 'string' || !isAllowedImageUrl(item.imageUrl))) throw new Error('INVALID_ITEM_IMAGE_URL');
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, typeKey: true, customData: true },
  });

  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('UPDATE_MENU_FORBIDDEN');
  if (business.typeKey !== 'restaurant' && business.typeKey !== 'lemonade' && business.typeKey !== 'epicerie' && business.typeKey !== 'illegal_market') {
    throw new Error('BUSINESS_CANNOT_HAVE_MENU');
  }

  const nextCustomData = business.typeKey === 'illegal_market'
    ? JSON.stringify({
        ...getIllegalBusinessCustomData(business.customData),
        items: menu,
      })
    : JSON.stringify(menu);

  await prisma.business.update({
    where: { id: businessId },
    data: { customData: nextCustomData },
  });

  return { success: true };
}

export async function getUserBusinessPurchases(userId: string) {
  const items = await prisma.businessPurchasedItem.findMany({
    where: { userId },
    orderBy: { acquiredAt: 'desc' },
    take: 100,
  });
  return items;
}

export async function setTransferFeeRate(userId: string, businessId: string, rate: number) {
  if (!Number.isFinite(rate) || rate < 0 || rate > 25) {
    throw new Error('INVALID_TRANSFER_FEE_RATE');
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, typeKey: true, name: true },
  });

  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('TRANSFER_FEE_FORBIDDEN');
  if (business.typeKey !== 'transfer') throw new Error('BUSINESS_NOT_FOUND');

  await prisma.business.update({
    where: { id: businessId },
    data: { transferFeeRate: rate },
  });

  logYouAdmin('business_transfer_fee_update', userId, undefined, business.id, business.name, {
    transferFeeRate: rate,
  });

  return { transferFeeRate: rate };
}

// --- Business Transaction Log ---

async function logBusinessTransaction(
  businessId: string,
  type: string,
  amount: number,
  label: string,
  actorId?: string,
) {
  await prisma.businessTransaction.create({
    data: { businessId, type, amount, label, actorId: actorId ?? null },
  });
}

export async function getBusinessTransactions(userId: string, businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('BUSINESS_NOT_FOUND');

  const transactions = await prisma.businessTransaction.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    label: tx.label,
    actorId: tx.actorId,
    createdAt: tx.createdAt.toISOString(),
  }));
}

export async function getBusinessLoansHistory(userId: string, businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('BUSINESS_NOT_FOUND');

  const loans = await prisma.businessLoan.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    include: {
      borrower: {
        select: USER_PREVIEW_SELECT,
      },
    },
  });

  return loans.map((loan) => serializeBusinessLoan(loan));
}

// --- Loan Repayment ---

// Called by the borrower: voluntary repayment (full or partial) at any time
export async function repayLoanByBorrower(userId: string, loanId: string, percentage: number = 100) {
  const loan = await prisma.businessLoan.findUnique({
    where: { id: loanId },
    include: {
      borrower: { select: USER_PREVIEW_SELECT },
      business: { select: { id: true, name: true, ownerId: true, treasuryMoney: true } },
    },
  });

  if (!loan) throw new Error('BUSINESS_LOAN_NOT_FOUND');
  if (loan.borrowerId !== userId) throw new Error('BUSINESS_LOAN_REVIEW_FORBIDDEN');
  if (loan.status !== 'ACTIVE') throw new Error('LOAN_NOT_ACTIVE');

  const totalOwed = Math.round(loan.amount * (1 + loan.interestRate / 100));
  const remaining = totalOwed - (loan.repaidAmount ?? 0);
  const collateralAuraHeld = loan.collateralAuraHeld ?? 0;

  if (remaining <= 0) throw new Error('LOAN_ALREADY_REPAID');

  const requestedAmount = Math.min(Math.round(remaining * percentage / 100), remaining);
  const balance = await getSharedBalance(prisma, userId);
  const actualAmount = Math.min(requestedAmount, Number(balance.money));

  if (actualAmount <= 0) throw new Error('BORROWER_INSUFFICIENT_MONEY');

  const newRepaidTotal = (loan.repaidAmount ?? 0) + actualAmount;
  const isFullyRepaid = newRepaidTotal >= totalOwed;

  await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, actualAmount);
    await tx.business.update({
      where: { id: loan.businessId },
      data: { treasuryMoney: { increment: actualAmount } },
    });
    await tx.businessLoan.update({
      where: { id: loanId },
      data: {
        status: isFullyRepaid ? 'REPAID' : 'ACTIVE',
        repaidAmount: newRepaidTotal,
        ...(isFullyRepaid ? { collateralAuraHeld: 0 } : {}),
      },
    });
    if (isFullyRepaid && collateralAuraHeld > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { aura: { increment: collateralAuraHeld } },
      });
    }
  });

  await emitSharedBalanceUpdates(prisma, userId);
  await logBusinessTransaction(loan.businessId, 'LOAN_REPAY', actualAmount, `Remboursement${!isFullyRepaid ? ' partiel' : ''} de ${loan.borrower.username}`, userId);

  // Finance XP pour l'emprunteur: rembourser son prêt = comportement financier responsable
  void grantSkillXp(userId, 'finance', isFullyRepaid ? 10 : 3);

  await Promise.allSettled([
    createNotification({
      userId,
      type: 'SYSTEM',
      title: isFullyRepaid ? 'Pret rembourse' : 'Remboursement partiel',
      body: isFullyRepaid
        ? `Tu as rembourse le pret de ${loan.business.name}${collateralAuraHeld > 0 ? ` et tes ${collateralAuraHeld.toLocaleString('fr-FR')} aura te sont rendues` : ''}.`
        : `Tu as rembourse ${actualAmount.toLocaleString('fr-FR')} sur ${remaining.toLocaleString('fr-FR')} dus a ${loan.business.name}.`,
      link: '/you?tab=explore',
      icon: 'credit-card',
    }),
    createNotification({
      userId: loan.business.ownerId,
      type: 'SYSTEM',
      title: isFullyRepaid ? 'Pret rembourse' : 'Remboursement partiel recu',
      body: isFullyRepaid
        ? `${loan.borrower.username} a rembourse le pret de ${loan.business.name}.`
        : `${loan.borrower.username} a rembourse ${actualAmount.toLocaleString('fr-FR')} sur ${remaining.toLocaleString('fr-FR')} dus.`,
      link: '/you?tab=travail',
      icon: 'credit-card',
    }),
  ]);

  logYouAdmin('business_loan_repay', userId, undefined, loan.business.id, loan.business.name, {
    loanId,
    borrowerId: userId,
    borrowerName: loan.borrower.username,
    repaid: actualAmount,
    totalOwed,
    collateralAuraReturned: isFullyRepaid ? collateralAuraHeld : 0,
    status: isFullyRepaid ? 'REPAID' : 'ACTIVE',
    initiatedBy: 'borrower',
  });

  return { repaid: actualAmount, totalOwed, collateralClaimed: 0, status: isFullyRepaid ? 'REPAID' : 'ACTIVE' };
}

// Called by the bank owner: claim collateral after the borrower defaults (past due date)
export async function repayLoan(userId: string, loanId: string) {
  const loan = await prisma.businessLoan.findUnique({
    where: { id: loanId },
    include: {
      borrower: { select: USER_PREVIEW_SELECT },
      business: { select: { id: true, name: true, ownerId: true, treasuryMoney: true } },
    },
  });

  if (!loan) throw new Error('BUSINESS_LOAN_NOT_FOUND');
  if (!(await isBusinessManager(loan.businessId, userId, loan.business.ownerId))) throw new Error('BUSINESS_LOAN_REVIEW_FORBIDDEN');
  if (loan.status !== 'ACTIVE') throw new Error('LOAN_NOT_ACTIVE');

  const totalOwed = Math.round(loan.amount * (1 + loan.interestRate / 100));
  const remaining = totalOwed - (loan.repaidAmount ?? 0);
  const collateralAuraHeld = loan.collateralAuraHeld ?? 0;
  const dueDate = getLoanDueDateFromEntry(loan);

  if (remaining <= 0) throw new Error('LOAN_ALREADY_REPAID');

  if (new Date() < dueDate) throw new Error('LOAN_COLLATERAL_NOT_CLAIMABLE_YET');
  if (collateralAuraHeld <= 0) throw new Error('BORROWER_INSUFFICIENT_MONEY');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { aura: { increment: collateralAuraHeld } },
    });
    await tx.businessLoan.update({
      where: { id: loanId },
      data: {
        status: 'DEFAULTED',
        collateralAuraHeld: 0,
        collateralClaimedAt: new Date(),
      },
    });
  });

  await Promise.all([
    emitSharedBalanceUpdates(prisma, loan.borrowerId),
    emitSharedBalanceUpdates(prisma, userId),
  ]);

  await Promise.allSettled([
    createNotification({
      userId: loan.borrowerId,
      type: 'SYSTEM',
      title: 'Hypotheque saisie',
      body: `Tu n as pas rembourse a temps le pret de ${loan.business.name}. Tes ${collateralAuraHeld.toLocaleString('fr-FR')} aura en garantie ont ete saisies.`,
      link: '/you?tab=explore',
      icon: 'credit-card',
    }),
    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Hypotheque recuperee',
      body: `${collateralAuraHeld.toLocaleString('fr-FR')} aura ont ete recuperees sur ${loan.borrower.username} suite au defaut du pret ${loan.business.name}.`,
      link: '/you?tab=travail',
      icon: 'credit-card',
    }),
  ]);

  logYouAdmin('business_loan_repay', userId, undefined, loan.business.id, loan.business.name, {
    loanId,
    borrowerId: loan.borrowerId,
    borrowerName: loan.borrower.username,
    repaid: 0,
    totalOwed,
    collateralAuraClaimed: collateralAuraHeld,
    status: 'DEFAULTED',
  });

  return { repaid: 0, totalOwed, collateralClaimed: collateralAuraHeld, status: 'DEFAULTED' };
}

// --- Bank Account System ---

export async function getBankAccounts(userId: string, businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, typeKey: true },
  });
  if (!business || business.typeKey !== 'bank') throw new Error('BUSINESS_NOT_FOUND');

  const accounts = await prisma.bankAccount.findMany({
    where: { businessId, userId },
    orderBy: { createdAt: 'asc' },
  });
  return accounts.map((a) => ({
    id: a.id,
    accountType: a.accountType,
    balance: a.balance,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function openBankAccount(userId: string, businessId: string, accountType: 'COURANT' | 'EPARGNE') {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, typeKey: true, livretEpargneUnlocked: true, ownerId: true },
  });
  if (!business || business.typeKey !== 'bank') throw new Error('BUSINESS_NOT_FOUND');
  if (business.ownerId === userId) throw new Error('BANK_SELF_ACCOUNT_FORBIDDEN');
  if (accountType === 'EPARGNE' && !business.livretEpargneUnlocked) throw new Error('BANK_EPARGNE_LOCKED');

  const existing = await prisma.bankAccount.findUnique({
    where: { businessId_userId_accountType: { businessId, userId, accountType } },
  });
  if (existing) throw new Error('BANK_ACCOUNT_ALREADY_EXISTS');

  const account = await prisma.bankAccount.create({
    data: { businessId, userId, accountType, balance: 0 },
  });

  logYouAdmin('bank_account_open', userId, undefined, business.id, business.name, {
    accountId: account.id,
    accountType,
  });

  return { id: account.id, accountType: account.accountType, balance: account.balance, createdAt: account.createdAt.toISOString() };
}

export async function bankAccountDeposit(userId: string, accountId: string, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('INVALID_BANK_AMOUNT');

  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
    include: { business: { select: { id: true, typeKey: true, name: true } }, user: { select: { username: true } } },
  });
  if (!account || account.userId !== userId) throw new Error('BANK_ACCOUNT_NOT_FOUND');
  if (account.business.typeKey !== 'bank') throw new Error('BUSINESS_NOT_FOUND');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  if (!user || user.money < amount) throw new Error('INSUFFICIENT_MONEY');

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { money: { decrement: amount } } }),
    prisma.bankAccount.update({ where: { id: accountId }, data: { balance: { increment: amount } } }),
    prisma.business.update({ where: { id: account.businessId }, data: { treasuryMoney: { increment: amount } } }),
  ]);

  await logBusinessTransaction(account.businessId, 'BANK_DEPOSIT', amount, `Depot compte de ${account.user.username}`, userId);

  logYouAdmin('bank_account_deposit', userId, account.user.username, account.business.id, account.business.name, {
    accountId,
    accountType: account.accountType,
    amount,
    newBalance: account.balance + amount,
  });

  // Finance XP: +1 par tranche de 500 EUR deposee (max 20 par depot)
  void grantSkillXp(userId, 'finance', Math.min(20, Math.max(1, Math.floor(amount / 500))));

  return { newBalance: account.balance + amount };
}

export async function bankAccountWithdraw(userId: string, accountId: string, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('INVALID_BANK_AMOUNT');

  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
    include: { business: { select: { id: true, typeKey: true, name: true, treasuryMoney: true } }, user: { select: { username: true } } },
  });
  if (!account || account.userId !== userId) throw new Error('BANK_ACCOUNT_NOT_FOUND');
  if (account.business.typeKey !== 'bank') throw new Error('BUSINESS_NOT_FOUND');
  if (account.balance < amount) throw new Error('BANK_BALANCE_TOO_LOW');
  if (account.business.treasuryMoney < amount) throw new Error('BUSINESS_TREASURY_TOO_LOW');

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { money: { increment: amount } } }),
    prisma.bankAccount.update({ where: { id: accountId }, data: { balance: { decrement: amount } } }),
    prisma.business.update({ where: { id: account.businessId }, data: { treasuryMoney: { decrement: amount } } }),
  ]);

  await logBusinessTransaction(account.businessId, 'BANK_WITHDRAW', -amount, `Retrait compte de ${account.user.username}`, userId);

  logYouAdmin('bank_account_withdraw', userId, account.user.username, account.business.id, account.business.name, {
    accountId,
    accountType: account.accountType,
    amount,
    newBalance: account.balance - amount,
  });

  return { newBalance: account.balance - amount };
}

// --- Formation System ---

export async function setFormationDetails(userId: string, businessId: string, formationUrl: string | null, formationPrice: number) {
  if (!Number.isFinite(formationPrice) || formationPrice < 0) throw new Error('INVALID_FORMATION_PRICE');

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, ownerId: true, typeKey: true },
  });
  if (!business || business.typeKey !== 'formation') throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('FORMATION_EDIT_FORBIDDEN');

  await prisma.business.update({
    where: { id: businessId },
    data: { formationUrl: formationUrl || null, formationPrice },
  });

  logYouAdmin('formation_update', userId, undefined, business.id, business.name, {
    formationUrl: formationUrl || null,
    formationPrice,
  });

  return { formationUrl, formationPrice };
}

export async function buyFormation(userId: string, businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, ownerId: true, typeKey: true, formationPrice: true, formationUrl: true },
  });
  if (!business || business.typeKey !== 'formation') throw new Error('BUSINESS_NOT_FOUND');
  if (await isBusinessManager(businessId, userId, business.ownerId)) throw new Error('FORMATION_SELF_BUY_FORBIDDEN');
  if (!business.formationUrl) throw new Error('FORMATION_URL_NOT_SET');

  const price = business.formationPrice ?? 500;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true, username: true } });
  if (!user || user.money < price) throw new Error('INSUFFICIENT_MONEY');

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { money: { decrement: price } } }),
    prisma.business.update({ where: { id: businessId }, data: { treasuryMoney: { increment: price } } }),
  ]);

  await logBusinessTransaction(businessId, 'FORMATION_SALE', price, `Achat formation par ${user.username}`, userId);

  logYouAdmin('formation_purchase', userId, user.username, business.id, business.name, {
    price,
    formationUrl: business.formationUrl,
  });

  // Intelligence XP: +1 par tranche de 100 EUR de formation (min 3)
  void grantSkillXp(userId, 'intelligence', Math.max(3, Math.floor(price / 100)));

  return { formationUrl: business.formationUrl, price };
}

// --- Business Profile ---

export async function updateBusinessProfile(
  userId: string,
  businessId: string,
  data: { name?: string; description?: string | null; logoUrl?: string | null; mapX?: number | null; mapY?: number | null },
) {
  if (data.name !== undefined && !data.name.trim()) throw new Error('INVALID_BUSINESS_NAME');

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, name: true, description: true, logoUrl: true, mapX: true, mapY: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('BUSINESS_EDIT_FORBIDDEN');

  const nextMapX = data.mapX === undefined ? undefined : (data.mapX === null ? null : Number(data.mapX));
  const nextMapY = data.mapY === undefined ? undefined : (data.mapY === null ? null : Number(data.mapY));
  if (nextMapX != null && (!Number.isFinite(nextMapX) || nextMapX < -180 || nextMapX > 180)) {
    throw new Error('INVALID_BUSINESS_MAP_POSITION');
  }
  if (nextMapY != null && (!Number.isFinite(nextMapY) || nextMapY < -85.05112878 || nextMapY > 85.05112878)) {
    throw new Error('INVALID_BUSINESS_MAP_POSITION');
  }

  const updated = await prisma.business.update({
    where: { id: businessId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl?.trim() || null } : {}),
      ...(nextMapX !== undefined ? { mapX: nextMapX } : {}),
      ...(nextMapY !== undefined ? { mapY: nextMapY } : {}),
    },
  });

  logYouAdmin('business_profile_update', userId, undefined, businessId, updated.name, {
    previousName: business.name,
    previousDescription: business.description,
    previousLogoUrl: business.logoUrl,
    previousMapX: business.mapX,
    previousMapY: business.mapY,
    name: updated.name,
    description: updated.description,
    logoUrl: updated.logoUrl,
    mapX: updated.mapX,
    mapY: updated.mapY,
  });

  return { name: updated.name, description: updated.description, logoUrl: updated.logoUrl, mapX: updated.mapX, mapY: updated.mapY };
}

// --- Formation Product System (multi-formation) ---

async function ensureFormationBusinessOwner(userId: string, businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, typeKey: true, name: true },
  });
  if (!business || business.typeKey !== 'formation') throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('FORMATION_EDIT_FORBIDDEN');
  return business;
}

async function writeFormationAttachment(attachment?: {
  base64Data?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
} | null) {
  if (!attachment?.base64Data || !attachment?.mimeType) return null;
  const uploaded = await writeBase64UploadFile({
    base64Data: attachment.base64Data,
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
    uploadDir: FORMATION_FILE_UPLOAD_DIR,
    maxBytes: MAX_FORMATION_FILE_SIZE_BYTES,
  });
  if ('error' in uploaded) {
    if (uploaded.error.startsWith('Unsupported file type')) throw new Error('INVALID_FORMATION_FILE_TYPE');
    if (uploaded.error.startsWith('File too large')) throw new Error('INVALID_FORMATION_FILE_SIZE');
    throw new Error('INVALID_FORMATION_FILE');
  }
  return {
    attachmentOriginalName: uploaded.originalName,
    attachmentMimeType: uploaded.mimeType,
    attachmentPath: `${FORMATION_FILE_UPLOAD_DIR}/${uploaded.fileName}`,
    attachmentSizeBytes: uploaded.sizeBytes,
  };
}

async function upsertReviewEligibility(input: {
  userId: string;
  targetType: 'BUSINESS' | 'FORMATION_PRODUCT' | 'LAWYER';
  sourceType: string;
  businessId?: string | null;
  formationProductId?: string | null;
  lawyerUserId?: string | null;
  courtCaseId?: string | null;
}) {
  const existing = await prisma.reviewEligibility.findFirst({
    where: {
      userId: input.userId,
      targetType: input.targetType,
      businessId: input.businessId ?? null,
      formationProductId: input.formationProductId ?? null,
      lawyerUserId: input.lawyerUserId ?? null,
      courtCaseId: input.courtCaseId ?? null,
    },
  });

  if (existing) {
    return existing;
  }

  const payload = {
    userId: input.userId,
    businessId: input.businessId ?? null,
    formationProductId: input.formationProductId ?? null,
    lawyerUserId: input.lawyerUserId ?? null,
    courtCaseId: input.courtCaseId ?? null,
    targetType: input.targetType,
    sourceType: input.sourceType,
    promptAt: getReviewPromptAt(),
    promptedAt: null,
    reviewedAt: null,
  };

  return prisma.reviewEligibility.create({ data: payload });
}

export async function listFormationProducts(businessId: string) {
  const products = await prisma.formationProduct.findMany({
    where: { businessId },
    include: BUSINESS_BASE_INCLUDE.formationProducts.include,
    orderBy: { createdAt: 'asc' },
  });
  return products;
}

export async function addFormationProduct(
  userId: string,
  businessId: string,
  data: {
    title: string;
    description?: string;
    price: number;
    url?: string | null;
    imageUrl?: string;
    attachment?: { base64Data?: string | null; mimeType?: string | null; fileName?: string | null } | null;
  },
) {
  if (!data.title?.trim()) throw new Error('INVALID_FORMATION_TITLE');
  if (!Number.isFinite(data.price) || data.price < 0) throw new Error('INVALID_FORMATION_PRICE');
  const business = await ensureFormationBusinessOwner(userId, businessId);
  const attachment = await writeFormationAttachment(data.attachment);
  const normalizedUrl = typeof data.url === 'string' ? data.url.trim() || null : null;
  if (!normalizedUrl && !attachment) throw new Error('INVALID_FORMATION_URL');

  const product = await prisma.formationProduct.create({
    data: {
      businessId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      price: data.price,
      url: normalizedUrl,
      imageUrl: data.imageUrl?.trim() || null,
      ...attachment,
      status: 'PENDING',
      reviewedAt: null,
      reviewedBy: null,
      reviewerNote: null,
    },
  });

  logYouAdmin('formation_product_create', userId, undefined, businessId, product.title, {
    productId: product.id,
    price: product.price,
    url: product.url,
    attachmentPath: product.attachmentPath,
  });

  return product;
}

export async function updateFormationProduct(
  userId: string,
  businessId: string,
  productId: string,
  data: {
    title?: string;
    description?: string | null;
    price?: number;
    url?: string | null;
    imageUrl?: string | null;
    attachment?: { base64Data?: string | null; mimeType?: string | null; fileName?: string | null } | null;
    removeAttachment?: boolean;
  },
) {
  await ensureFormationBusinessOwner(userId, businessId);

  const product = await prisma.formationProduct.findUnique({ where: { id: productId } });
  if (!product || product.businessId !== businessId) throw new Error('FORMATION_PRODUCT_NOT_FOUND');

  if (data.price !== undefined && (!Number.isFinite(data.price) || data.price < 0)) throw new Error('INVALID_FORMATION_PRICE');
  if (data.title !== undefined && !data.title.trim()) throw new Error('INVALID_FORMATION_TITLE');
  const nextAttachment = data.attachment ? await writeFormationAttachment(data.attachment) : null;
  const nextUrl = data.url !== undefined ? (data.url?.trim() || null) : product.url;
  const removingAttachment = Boolean(data.removeAttachment);
  const willHaveAttachment = nextAttachment ?? (!removingAttachment && product.attachmentPath ? {
    attachmentOriginalName: product.attachmentOriginalName,
    attachmentMimeType: product.attachmentMimeType,
    attachmentPath: product.attachmentPath,
    attachmentSizeBytes: product.attachmentSizeBytes,
  } : null);
  if (!nextUrl && !willHaveAttachment) throw new Error('INVALID_FORMATION_URL');

  const updated = await prisma.formationProduct.update({
    where: { id: productId },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.url !== undefined ? { url: nextUrl } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl?.trim() || null } : {}),
      ...(nextAttachment ?? {}),
      ...(removingAttachment ? {
        attachmentOriginalName: null,
        attachmentMimeType: null,
        attachmentPath: null,
        attachmentSizeBytes: null,
      } : {}),
      status: 'PENDING',
      reviewedAt: null,
      reviewedBy: null,
      reviewerNote: null,
    },
  });

  logYouAdmin('formation_product_update', userId, undefined, businessId, updated.title, {
    productId,
    previousTitle: product.title,
    previousPrice: product.price,
    previousUrl: product.url,
    previousAttachmentPath: product.attachmentPath,
    title: updated.title,
    price: updated.price,
    url: updated.url,
    attachmentPath: updated.attachmentPath,
  });

  return updated;
}

export async function deleteFormationProduct(userId: string, businessId: string, productId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, typeKey: true },
  });
  if (!business || business.typeKey !== 'formation') throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('FORMATION_EDIT_FORBIDDEN');

  const product = await prisma.formationProduct.findUnique({ where: { id: productId } });
  if (!product || product.businessId !== businessId) throw new Error('FORMATION_PRODUCT_NOT_FOUND');

  await prisma.formationProduct.delete({ where: { id: productId } });
  logYouAdmin('formation_product_delete', userId, undefined, businessId, product.title, {
    productId,
    price: product.price,
    url: product.url,
  });
  return { ok: true };
}

export async function buyFormationProduct(userId: string, businessId: string, productId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, typeKey: true },
  });
  if (!business || business.typeKey !== 'formation') throw new Error('BUSINESS_NOT_FOUND');
  if (await isBusinessManager(businessId, userId, business.ownerId)) throw new Error('FORMATION_SELF_BUY_FORBIDDEN');

  const product = await prisma.formationProduct.findUnique({
    where: { id: productId },
    include: {
      purchases: {
        where: { userId },
        take: 1,
      },
    },
  });
  if (!product || product.businessId !== businessId) throw new Error('FORMATION_PRODUCT_NOT_FOUND');
  if (product.status !== 'APPROVED') throw new Error('FORMATION_PRODUCT_NOT_APPROVED');
  if (!product.url && !product.attachmentPath) throw new Error('INVALID_FORMATION_URL');

  const existingPurchase = product.purchases[0] ?? null;
  if (existingPurchase) {
    await upsertReviewEligibility({
      userId,
      businessId,
      formationProductId: product.id,
      targetType: 'FORMATION_PRODUCT',
      sourceType: 'FORMATION_ACCESS',
    });
    return {
      url: product.url,
      title: product.title,
      price: existingPurchase.pricePaid,
      hasAttachment: Boolean(product.attachmentPath),
      attachmentOriginalName: product.attachmentOriginalName,
      attachmentMimeType: product.attachmentMimeType,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true, username: true } });
  if (!user || user.money < product.price) throw new Error('INSUFFICIENT_MONEY');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { money: { decrement: product.price } } });
    await tx.business.update({ where: { id: businessId }, data: { treasuryMoney: { increment: product.price } } });
    await tx.formationProductPurchase.create({
      data: {
        userId,
        businessId,
        productId: product.id,
        pricePaid: product.price,
        reviewPromptAt: getReviewPromptAt(),
      },
    });
    const existingEligibility = await tx.reviewEligibility.findFirst({
      where: {
        userId,
        businessId,
        formationProductId: product.id,
        targetType: 'FORMATION_PRODUCT',
      },
    });
    if (existingEligibility) {
      await tx.reviewEligibility.update({
        where: { id: existingEligibility.id },
        data: {
          sourceType: 'FORMATION_PURCHASE',
          promptAt: getReviewPromptAt(),
          promptedAt: null,
          reviewedAt: null,
        },
      });
    } else {
      await tx.reviewEligibility.create({
        data: {
          userId,
          businessId,
          formationProductId: product.id,
          targetType: 'FORMATION_PRODUCT',
          sourceType: 'FORMATION_PURCHASE',
          promptAt: getReviewPromptAt(),
        },
      });
    }
  });

  await logBusinessTransaction(businessId, 'FORMATION_SALE', product.price, `Achat "${product.title}" par ${user.username}`, userId);

  logYouAdmin('business_formation_product_buy', userId, user.username, businessId, product.title, {
    productId,
    businessOwnerId: business.ownerId,
    price: product.price,
    url: product.url,
  });

  // Intelligence XP: +1 par tranche de 100 EUR de formation (min 3)
  void grantSkillXp(userId, 'intelligence', Math.max(3, Math.floor(product.price / 100)));

  return { url: product.url, title: product.title, price: product.price };
}

export async function accessFormationProduct(userId: string, businessId: string, productId: string) {
  const product = await prisma.formationProduct.findUnique({
    where: { id: productId },
    include: {
      business: {
        select: { id: true, ownerId: true, typeKey: true },
      },
      purchases: {
        where: { userId },
        take: 1,
      },
    },
  });
  if (!product || product.businessId !== businessId || product.business.typeKey !== 'formation') {
    throw new Error('FORMATION_PRODUCT_NOT_FOUND');
  }

  const isManager = await isBusinessManager(businessId, userId, product.business.ownerId);
  const canAccess = isManager || Boolean(product.purchases[0]);
  if (!canAccess) throw new Error('FORMATION_ACCESS_FORBIDDEN');

  if (product.purchases[0]) {
    await prisma.formationProductPurchase.update({
      where: { id: product.purchases[0].id },
      data: { lastAccessedAt: new Date() },
    });
    await upsertReviewEligibility({
      userId,
      businessId,
      formationProductId: product.id,
      targetType: 'FORMATION_PRODUCT',
      sourceType: 'FORMATION_ACCESS',
    });
  }

  return {
    productId: product.id,
    title: product.title,
    url: product.url,
    attachmentOriginalName: product.attachmentOriginalName,
    attachmentMimeType: product.attachmentMimeType,
    attachmentPath: product.attachmentPath,
    hasAttachment: Boolean(product.attachmentPath),
  };
}

export async function listPendingFormationProductsForAdmin() {
  const products = await prisma.formationProduct.findMany({
    where: {
      status: 'PENDING',
      business: {
        typeKey: 'formation',
      },
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          owner: {
            select: USER_PREVIEW_SELECT,
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return products.map((product) => ({
    id: product.id,
    businessId: product.businessId,
    title: product.title,
    description: product.description ?? null,
    price: product.price,
    url: product.url ?? null,
    imageUrl: product.imageUrl ?? null,
    createdAt: product.createdAt.toISOString(),
    status: product.status,
    reviewerNote: product.reviewerNote ?? null,
    attachmentOriginalName: product.attachmentOriginalName ?? null,
    attachmentMimeType: product.attachmentMimeType ?? null,
    attachmentPath: product.attachmentPath ?? null,
    attachmentSizeBytes: product.attachmentSizeBytes ?? null,
    business: {
      id: product.business.id,
      name: product.business.name,
      ownerId: product.business.ownerId,
      owner: product.business.owner,
    },
  }));
}

export async function reviewFormationProduct(
  reviewerId: string,
  businessId: string,
  productId: string,
  decision: 'approve' | 'reject',
  reviewerNote?: string | null,
) {
  const product = await prisma.formationProduct.findUnique({
    where: { id: productId },
    include: {
      business: {
        select: { id: true, name: true, typeKey: true, ownerId: true },
      },
    },
  });
  if (!product || product.businessId !== businessId || product.business.typeKey !== 'formation') {
    throw new Error('FORMATION_PRODUCT_NOT_FOUND');
  }

  const reviewed = await prisma.formationProduct.update({
    where: { id: product.id },
    data: {
      status: decision === 'approve' ? 'APPROVED' : 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      reviewerNote: reviewerNote?.trim() || null,
    },
  });

  logYouAdmin('formation_product_review', reviewerId, undefined, businessId, reviewed.title, {
    productId: reviewed.id,
    ownerId: product.business.ownerId,
    decision,
    reviewerNote: reviewerNote?.trim() || null,
  });

  return reviewed;
}

export async function markReviewPromptShown(
  userId: string,
  input: { businessId?: string; productId?: string },
) {
  const eligibility = await prisma.reviewEligibility.findFirst({
    where: {
      userId,
      ...(input.businessId ? { businessId: input.businessId, targetType: 'BUSINESS' } : {}),
      ...(input.productId ? { formationProductId: input.productId, targetType: 'FORMATION_PRODUCT' } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (!eligibility) return { ok: true };
  await prisma.reviewEligibility.update({
    where: { id: eligibility.id },
    data: { promptedAt: new Date() },
  });
  return { ok: true };
}

export async function setBusinessSupportAgent(userId: string, businessId: string, supportAgentId: string | null) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, name: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, userId, business.ownerId))) throw new Error('BUSINESS_EDIT_FORBIDDEN');

  if (supportAgentId) {
    const agent = await prisma.user.findUnique({
      where: { id: supportAgentId },
      select: { id: true, isApproved: true },
    });
    if (!agent?.isApproved) throw new Error('TARGET_NOT_FOUND');
  }

  const updated = await prisma.business.update({
    where: { id: businessId },
    data: { supportAgentId: supportAgentId || null },
    include: { supportAgent: { select: USER_PREVIEW_SELECT } },
  });

  return {
    supportAgent: updated.supportAgent ?? null,
    supportEnabled: Boolean(updated.supportAgentId),
  };
}

export async function updateLawFirmMemberMetadata(
  ownerId: string,
  businessId: string,
  memberId: string,
  data: { specialty?: string | null; isPrimaryLawyer?: boolean; displayOrder?: number; role?: string },
) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, typeKey: true },
  });
  if (!business || business.typeKey !== 'law_firm') throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, ownerId, business.ownerId))) throw new Error('BUSINESS_EDIT_FORBIDDEN');

  const member = await prisma.businessMember.findUnique({
    where: { id: memberId },
    include: { user: { select: USER_PREVIEW_SELECT } },
  });
  if (!member || member.businessId !== businessId) throw new Error('MEMBER_NOT_FOUND');

  const ALLOWED_LAW_ROLES = ['Associé', 'Associée', 'Collaborateur', 'Collaboratrice', 'Stagiaire', 'Of Counsel'];
  const roleUpdate = data.role && ALLOWED_LAW_ROLES.includes(data.role) ? data.role : undefined;

  const displayOrder = data.displayOrder === undefined ? undefined : Math.max(0, Math.floor(data.displayOrder));

  await prisma.$transaction(async (tx) => {
    if (data.isPrimaryLawyer) {
      await tx.businessMember.updateMany({
        where: { businessId, isPrimaryLawyer: true },
        data: { isPrimaryLawyer: false },
      });
    }
    await tx.businessMember.update({
      where: { id: memberId },
      data: {
        ...(data.specialty !== undefined ? { specialty: data.specialty?.trim() || null } : {}),
        ...(data.isPrimaryLawyer !== undefined ? { isPrimaryLawyer: data.isPrimaryLawyer } : {}),
        ...(displayOrder !== undefined ? { displayOrder } : {}),
        ...(roleUpdate !== undefined ? { role: roleUpdate } : {}),
      },
    });
  });

  return {
    memberId,
    role: roleUpdate ?? member.role,
    specialty: data.specialty?.trim() || null,
    isPrimaryLawyer: Boolean(data.isPrimaryLawyer),
    displayOrder: displayOrder ?? member.displayOrder ?? 0,
    user: member.user,
  };
}

export async function openBusinessSupportConversation(userId: string, businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      supportAgentId: true,
    },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!business.supportAgentId) throw new Error('TARGET_NOT_FOUND');

  const participantIds = Array.from(new Set([userId, business.ownerId, business.supportAgentId]));
  const title = `[${business.name}] Support`;
  const existing = await prisma.messageConversation.findFirst({
    where: {
      businessId,
      title,
      participants: { some: { userId } },
    },
    include: {
      participants: {
        select: { userId: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    const existingIds = existing.participants.map((participant) => participant.userId).sort();
    const expectedIds = [...participantIds].sort();
    if (existingIds.length === expectedIds.length && existingIds.every((id, index) => id === expectedIds[index])) {
      return { conversationId: existing.id };
    }
  }

  const now = new Date();
  const conversation = await prisma.messageConversation.create({
    data: {
      type: 'GROUP',
      title,
      businessId,
      tagType: 'Professionnel',
      tagLabel: 'Professionnel',
      createdById: userId,
      lastMessageAt: now,
      participants: {
        create: participantIds.map((participantId) => ({
          userId: participantId,
          role: participantId === business.ownerId ? 'OWNER' : 'MEMBER',
          lastReadAt: participantId === userId ? now : null,
        })),
      },
      messages: {
        create: {
          senderId: null,
          body: `Support ${business.name} ouvert.`,
          type: 'SYSTEM',
        },
      },
    },
    select: { id: true },
  });

  return { conversationId: conversation.id };
}

export async function rateLawyerForCase(
  userId: string,
  caseId: string,
  lawyerUserId: string,
  rating: number,
  comment?: string | null,
) {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error('INVALID_BUSINESS_RATING');
  }

  const courtCase = await prisma.courtCase.findUnique({
    where: { id: caseId },
    include: {
      plaintif: { select: USER_PREVIEW_SELECT },
      defendant: { select: USER_PREVIEW_SELECT },
      reviewEligibilities: true,
    },
  });
  if (!courtCase) throw new Error('BUSINESS_NOT_FOUND');
  if (courtCase.status !== 'CLOSED') throw new Error('BUSINESS_RATING_NOT_ALLOWED');

  const isPlaintiffClient = courtCase.plaintifId === userId && courtCase.plaintiffLawyerId === lawyerUserId && courtCase.plaintiffLawFirmId;
  const isDefendantClient = courtCase.defendantId === userId && courtCase.defendantLawyerId === lawyerUserId && courtCase.defendantLawFirmId;
  if (!isPlaintiffClient && !isDefendantClient) throw new Error('BUSINESS_RATING_NOT_ALLOWED');

  const lawFirmBusinessId = (isPlaintiffClient ? courtCase.plaintiffLawFirmId : courtCase.defendantLawFirmId)!;
  const eligibility = (courtCase.reviewEligibilities ?? []).find((entry: any) => entry.userId === userId && entry.lawyerUserId === lawyerUserId && entry.targetType === 'LAWYER') ?? null;
  if (!eligibility) throw new Error('BUSINESS_RATING_NOT_ALLOWED');

  const normalizedComment = typeof comment === 'string' ? comment.trim().slice(0, 500) : null;

  await prisma.$transaction(async (tx) => {
    await tx.lawyerRating.upsert({
      where: {
        courtCaseId_authorUserId: {
          courtCaseId: caseId,
          authorUserId: userId,
        },
      },
      update: {
        lawyerUserId,
        lawFirmBusinessId,
        rating,
        comment: normalizedComment || null,
      },
      create: {
        courtCaseId: caseId,
        authorUserId: userId,
        lawyerUserId,
        lawFirmBusinessId,
        rating,
        comment: normalizedComment || null,
      },
    });
    await tx.reviewEligibility.update({
      where: { id: eligibility.id },
      data: {
        reviewedAt: new Date(),
        promptedAt: eligibility.promptedAt ?? new Date(),
      },
    });
  });

  return { ok: true };
}

// --- Team Management ---

export async function updateMemberProfile(ownerId: string, businessId: string, memberId: string, data: { title?: string | null }) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, ownerId, business.ownerId))) throw new Error('BUSINESS_EDIT_FORBIDDEN');

  const member = await prisma.businessMember.findUnique({ where: { id: memberId } });
  if (!member || member.businessId !== businessId) throw new Error('MEMBER_NOT_FOUND');

  const title = typeof data.title === 'string' ? data.title.trim() || null : null;
  await prisma.businessMember.update({ where: { id: memberId }, data: { specialty: title } });
  return { memberId, title };
}

export async function updateMemberRole(ownerId: string, businessId: string, memberId: string, role: string) {
  const nextRole = String(role ?? '').trim();
  if (!nextRole || nextRole.length > 40) throw new Error('INVALID_ROLE');

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, ownerId, business.ownerId))) throw new Error('BUSINESS_EDIT_FORBIDDEN');

  const member = await prisma.businessMember.findUnique({
    where: { id: memberId },
    include: { user: { select: USER_PREVIEW_SELECT } },
  });
  if (!member || member.businessId !== businessId) throw new Error('MEMBER_NOT_FOUND');

  await prisma.businessMember.update({
    where: { id: memberId },
    data: { role: nextRole },
  });

  await createNotification({
    userId: member.user.id,
    type: 'SYSTEM',
    title: 'Role modifie',
    body: `${member.user.username}, ton role devient ${nextRole}.`,
    link: '/you?tab=travail',
    icon: 'briefcase-business',
  });

  return { memberId, role: nextRole };
}

export async function updateMemberSalary(ownerId: string, businessId: string, memberId: string, salary: number) {
  if (!Number.isInteger(salary) || salary < 0) throw new Error('INVALID_SALARY');

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, ownerId, business.ownerId))) throw new Error('BUSINESS_INVITE_FORBIDDEN');

  const member = await prisma.businessMember.findUnique({
    where: { id: memberId },
    include: { user: { select: USER_PREVIEW_SELECT } },
  });
  if (!member || member.businessId !== businessId) throw new Error('MEMBER_NOT_FOUND');

  const previousSalary = member.salary;
  await prisma.businessMember.update({ where: { id: memberId }, data: { salary } });
  await createNotification({
    userId: member.user.id,
    type: 'SYSTEM',
    title: 'Salaire modifie',
    body: `${member.user.username}, ton salaire chez cette entreprise passe a ${salary.toLocaleString('fr-FR')} money/jour.`,
    link: '/you?tab=travail',
    icon: 'briefcase-business',
  });
  logYouAdmin('business_member_salary_update', ownerId, undefined, businessId, member.user.username, {
    memberId,
    previousSalary,
    salary,
  });
  return { salary };
}

export async function sendLoanRepaymentReminder(userId: string, loanId: string) {
  const loan = await prisma.businessLoan.findUnique({
    where: { id: loanId },
    include: {
      borrower: { select: USER_PREVIEW_SELECT },
      business: {
        include: {
          owner: { select: USER_PREVIEW_SELECT },
        },
      },
    },
  });
  if (!loan) throw new Error('BUSINESS_LOAN_NOT_FOUND');
  if (!(await isBusinessManager(loan.businessId, userId, loan.business.ownerId))) {
    throw new Error('BUSINESS_EDIT_FORBIDDEN');
  }

  const totalOwed = Math.ceil(loan.amount * (1 + (loan.interestRate ?? 0) / 100));
  const remaining = Math.max(0, totalOwed - (loan.repaidAmount ?? 0));

  await createNotification({
    userId: loan.borrower.id,
    type: 'SYSTEM',
    title: `Rappel de remboursement · ${loan.business.name}`,
    body: `Il reste ${remaining.toLocaleString('fr-FR')} money a rembourser a ${loan.business.name}.`,
    link: '/you?tab=travail',
    icon: 'landmark',
  });

  return { ok: true, remaining };
}

export async function sackMember(ownerId: string, businessId: string, memberId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (!(await isBusinessManager(business.id, ownerId, business.ownerId))) throw new Error('BUSINESS_INVITE_FORBIDDEN');

  const member = await prisma.businessMember.findUnique({
    where: { id: memberId },
    include: { user: { select: USER_PREVIEW_SELECT } },
  });
  if (!member || member.businessId !== businessId) throw new Error('MEMBER_NOT_FOUND');

  await prisma.businessMember.delete({ where: { id: memberId } });
  await Promise.allSettled([
    createNotification({
      userId: member.user.id,
      type: 'SYSTEM',
      title: 'Contrat termine',
      body: `Tu ne fais plus partie de cette entreprise.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
    prisma.businessInvitation.updateMany({
      where: {
        businessId,
        employeeId: member.userId,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        respondedAt: new Date(),
      },
    }),
  ]);
  logYouAdmin('business_member_sack', ownerId, undefined, businessId, member.user.username, {
    memberId,
    role: member.role,
    salary: member.salary,
  });
  return { ok: true };
}

export async function leaveBusinessJob(userId: string, businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      owner: { select: USER_PREVIEW_SELECT },
    },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (business.ownerId === userId) throw new Error('CANNOT_LEAVE_OWN_BUSINESS');

  const member = await prisma.businessMember.findFirst({
    where: {
      businessId,
      userId,
      status: 'ACTIVE',
    },
    include: {
      user: { select: USER_PREVIEW_SELECT },
    },
  });
  if (!member) throw new Error('MEMBER_NOT_FOUND');

  await prisma.businessMember.delete({ where: { id: member.id } });

  await Promise.allSettled([
    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Contrat termine',
      body: `Tu as quitte ${business.name}.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
    createNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      title: 'Depart employe',
      body: `${member.user.username} a quitte ${business.name}.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
    prisma.businessInvitation.updateMany({
      where: {
        businessId,
        employeeId: userId,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        respondedAt: new Date(),
      },
    }),
  ]);

  return { ok: true };
}

export async function runDailyBusinessSalaryPayments(db = prisma) {
  const { getParisDayKey } = await import('../../utils/daily/daily-aura.js');
  const todayKey = getParisDayKey(new Date());

  const members = await db.businessMember.findMany({
    where: {
      status: 'ACTIVE',
      salary: { gt: 0 },
      OR: [
        { lastSalaryPaymentDate: null },
        { lastSalaryPaymentDate: { not: todayKey } },
      ],
    },
    include: {
      user: { select: USER_PREVIEW_SELECT },
      business: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          treasuryMoney: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const paidUserIds = new Set<string>();

  for (const member of members) {
    let paymentApplied = false;

    try {
      paymentApplied = await db.$transaction(async (tx: any) => {
        const memberUpdate = await tx.businessMember.updateMany({
          where: {
            id: member.id,
            OR: [
              { lastSalaryPaymentDate: null },
              { lastSalaryPaymentDate: { not: todayKey } },
            ],
          },
          data: { lastSalaryPaymentDate: todayKey },
        });

        if (memberUpdate.count !== 1) {
          throw new Error('SALARY_ALREADY_PAID');
        }

        const businessUpdate = await tx.business.updateMany({
          where: {
            id: member.businessId,
            treasuryMoney: { gte: member.salary },
          },
          data: {
            treasuryMoney: { decrement: member.salary },
          },
        });

        if (businessUpdate.count !== 1) {
          throw new Error('BUSINESS_TREASURY_TOO_LOW');
        }

        await tx.user.update({
          where: { id: member.userId },
          data: { money: { increment: member.salary } },
        });

        return true;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message !== 'SALARY_ALREADY_PAID' && message !== 'BUSINESS_TREASURY_TOO_LOW') {
        console.error('Daily salary payment error:', error);
      }
      paymentApplied = false;
    }

    if (!paymentApplied) {
      continue;
    }

    await Promise.allSettled([
      createNotification({
        userId: member.userId,
        type: 'MONEY_RECEIVED',
        title: 'Salaire verse',
        body: `${member.salary.toLocaleString('fr-FR')} money recus de ${member.business.name}.`,
        link: '/you?tab=travail',
        icon: 'briefcase-business',
      }),
    ]);

    await logBusinessTransaction(member.businessId, 'SALARY_PAYMENT', -member.salary, `Salaire verse a ${member.user.username}`, member.userId);
    paidUserIds.add(member.userId);
    paidUserIds.add(member.business.ownerId);
  }

  if (paidUserIds.size > 0) {
    await emitSharedBalanceUpdatesForUserIds(db, Array.from(paidUserIds));
  }

  return { paidCount: paidUserIds.size };
}

// --- Admin Business Controls ---

export async function adminPurgeAllBusinesses() {
  const businesses = await prisma.business.findMany({
    select: { id: true, ownerId: true, startingCapital: true },
  });

  await prisma.$transaction(async (tx) => {
    // Reimburse each owner with their creation cost
    for (const biz of businesses) {
      await tx.user.update({
        where: { id: biz.ownerId },
        data: { money: { increment: biz.startingCapital } },
      });
    }
    await tx.business.deleteMany({});
  });

  await emitSharedBalanceUpdatesForUserIds(prisma, [...new Set(businesses.map((b) => b.ownerId))]);

  return { purged: businesses.length };
}

export async function adminResetBusinessUnlockLevels() {
  await prisma.user.updateMany({ data: { unlockedBusinessLevel: 0 } });
  return { ok: true };
}

// --- Youtube Business ---

export async function uploadYoutubeVideo(userId: string, businessId: string, data: {
  title: string;
  description?: string;
  videoBase64: string;
  mimeType: string;
}) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true, typeKey: true },
  });

  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (business.typeKey !== 'youtube') throw new Error('INVALID_BUSINESS_TYPE');
  if (business.ownerId !== userId) throw new Error('BUSINESS_EDIT_FORBIDDEN');
  
  if (!data.title || data.title.trim().length < 3) {
    throw new Error('INVALID_FORMATION_TITLE'); // reusing error code for title length
  }

  const uploadResult = await writeBase64UploadVideo({
    base64Data: data.videoBase64,
    mimeType: data.mimeType,
    uploadDir: YOUTUBE_VIDEO_UPLOAD_DIR,
    maxBytes: MAX_YOUTUBE_VIDEO_SIZE_BYTES,
  });

  if ('error' in uploadResult) {
    throw new Error(uploadResult.error);
  }

  const videoPath = `/${YOUTUBE_VIDEO_UPLOAD_DIR}/${uploadResult.fileName}`;

  const video = await prisma.youtubeVideo.create({
    data: {
      businessId,
      title: data.title.trim(),
      description: data.description?.trim(),
      videoPath,
    },
  });

  return video;
}

export async function getYoutubeVideos(businessId: string) {
  const videos = await prisma.youtubeVideo.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  });
  return videos;
}

export async function getGlobalYoutubeVideos() {
  const videos = await prisma.youtubeVideo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      business: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        }
      }
    }
  });
  return videos;
}

export async function incrementVideoViews(videoId: string) {
  const video = await prisma.youtubeVideo.update({
    where: { id: videoId },
    data: { views: { increment: 1 } },
  });
  return video;
}

export async function checkReviewEligibilityOnExit(userId: string, businessId: string) {
  const existingReview = await prisma.businessRating.findUnique({
    where: { businessId_userId: { businessId, userId } },
  });

  if (existingReview) {
    return { eligible: false }; // Already reviewed
  }

  const existingEligibility = await prisma.reviewEligibility.findFirst({
    where: {
      userId,
      businessId,
      targetType: 'BUSINESS',
    },
  });

  if (existingEligibility) {
    if (!existingEligibility.promptedAt && !existingEligibility.reviewedAt) {
       await prisma.reviewEligibility.update({
          where: { id: existingEligibility.id },
          data: { promptAt: new Date() } // Prompt immediately on exit
       });
       return { eligible: true };
    }
    return { eligible: !existingEligibility.reviewedAt };
  }

  await prisma.reviewEligibility.create({
    data: {
      userId,
      businessId,
      targetType: 'BUSINESS',
      sourceType: 'YOUTUBE_VIDEO',
      promptAt: new Date(), // Prompt immediately
    },
  });

  return { eligible: true };
}
