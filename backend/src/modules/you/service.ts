import { io, prisma } from '../../server.js';
import { createNotification } from '../../utils/notifications.js';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_MAP,
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
} from '../../utils/sharedBalance.js';
import { logAdmin } from '../../utils/logger.js';

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
    take: 8,
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
  },
  ratings: {
    orderBy: { updatedAt: 'desc' as const },
    include: {
      user: {
        select: USER_PREVIEW_SELECT,
      },
    },
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
  const affairesSkill = skills.find((skill) => skill.key === 'affaires');
  return Math.max(1, affairesSkill?.level ?? 1);
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

  return {
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
    direction: proposal.investorId === viewerId ? 'sent' : 'received',
    investor: proposal.investor,
    owner: proposal.owner,
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

function serializeBusiness(business: any, viewerId: string) {
  const type = BUSINESS_TYPE_MAP.get(business.typeKey);
  const ownerKind = business.ownerId === viewerId ? 'you' : 'player';
  const treasuryMoney = business.treasuryMoney;
  const startupProducts = business.typeKey === 'startup'
    ? business.startupProducts.map((product: any) => serializeStartupProduct(product))
    : [];
  const monthlyRevenue = business.typeKey === 'bank'
    ? Math.max(0, Math.floor(treasuryMoney * 0.04))
    : business.typeKey === 'startup'
      ? startupProducts.reduce((total: number, product: any) => total + product.currentRevenue, 0)
    : business.typeKey === 'formation'
      ? business.monthlyRevenue + business.members.length * 250
    : business.monthlyRevenue;
  const monthlyExpenses = business.typeKey === 'bank'
    ? 0
    : business.monthlyExpenses;
  const shareholders = (business.shareholders ?? []).map((shareholder: any) => serializeShareholder(shareholder));
  const soldSharePercent = shareholders.reduce((sum: number, shareholder: any) => sum + shareholder.sharePercent, 0);
  const ownerSharePercent = Math.max(0, Math.round((100 - soldSharePercent) * 100) / 100);
  const viewerShareholding = shareholders.find((shareholder: any) => shareholder.user.id === viewerId) ?? null;
  const suggestedShareAmount = computeBusinessSuggestedShareAmount({
    startingCapital: business.startingCapital,
    treasuryMoney,
    monthlyRevenue,
    monthlyExpenses,
  }, 10);

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
    foundedAt: business.createdAt.toISOString(),
    foundedLabel: business.createdAt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    hiring: business.hiring,
    startingCapital: business.startingCapital,
    treasuryMoney,
    monthlyRevenue,
    monthlyExpenses,
    satisfaction: business.satisfaction,
    memberCount: business.members.length,
    actions: type?.actions ?? [],
    members: business.members.map((member: any) => ({
      id: member.id,
      role: member.role,
      status: member.status,
      salary: member.salary ?? 0,
      user: member.user,
    })),
    pendingInvitations: business.invitations.map((invite: any) => ({
      ...serializeEmploymentInvitation(invite, viewerId),
    })),
    recentLoans: business.loans.map((loan: any) => ({
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
    })),
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
    pendingBuyoutOffers: business.buyoutOffers
      .filter((offer: any) => offer.status === 'PENDING')
      .map((offer: any) => serializeBuyoutOffer(offer, viewerId)),
    startupProducts,
    livretEpargneUnlocked: business.typeKey === 'bank' ? (business.livretEpargneUnlocked ?? false) : undefined,
    loanInterestRate: business.typeKey === 'bank' ? (business.loanInterestRate ?? 4) : undefined,
    transferFeeRate: business.typeKey === 'transfer' ? (business.transferFeeRate ?? 2) : undefined,
    formationUrl: business.typeKey === 'formation' ? (business.formationUrl ?? null) : undefined,
    formationPrice: business.typeKey === 'formation' ? (business.formationPrice ?? 500) : undefined,
    formationProducts: business.typeKey === 'formation' ? (business.formationProducts ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description ?? null,
      price: p.price,
      url: p.url,
      imageUrl: p.imageUrl ?? null,
      createdAt: p.createdAt.toISOString(),
    })) : undefined,
    npcLastCollectedAt: (business.typeKey === 'lemonade' || business.typeKey === 'epicerie')
      ? (business.npcLastCollectedAt ? new Date(business.npcLastCollectedAt).toISOString() : null)
      : undefined,
    level: type?.level ?? 1,
    avgRating: business.ratings && business.ratings.length > 0
      ? Math.round((business.ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / business.ratings.length) * 10) / 10
      : null,
    ratingCount: business.ratings?.length ?? 0,
    ratings: (business.ratings ?? []).map((entry: any) => ({
      id: entry.id,
      rating: entry.rating,
      comment: entry.comment ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      user: entry.user,
    })),
  };
}

async function rateBusiness(userId: string, businessId: string, rating: number, comment?: string | null) {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error('Rating must be an integer between 1 and 5');
  }
  const normalizedComment = typeof comment === 'string'
    ? comment.trim().slice(0, 500)
    : null;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  if (!business) {
    throw new Error('BUSINESS_NOT_FOUND');
  }
  await prisma.businessRating.upsert({
    where: { businessId_userId: { businessId, userId } },
    update: { rating, comment: normalizedComment || null },
    create: { businessId, userId, rating, comment: normalizedComment || null },
  });
  logYouAdmin('business_rate', userId, undefined, business.id, business.name, {
    rating,
    comment: normalizedComment || null,
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

  const [players, ownedBusinesses, exploreBusinesses, memberBusinesses, shareholderBusinesses, pendingInvitations, pendingBuyoutOffers, sentBuyoutOffers, sentShareholderProposals, skills] = await Promise.all([
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
    prisma.userSkill.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
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
  const businessSlots = getBusinessSlots(skills);

  const viewerUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { unlockedBusinessLevel: true },
  });
  const unlockedBusinessLevel = viewerUser?.unlockedBusinessLevel ?? 0;

  return {
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
    relationships: relationships.map((relationship) => serializeRelationship(relationship, userId, { viewerIsMarried, pendingCourtCaseIds })),
    courtCases: pendingCourtCases.map((c: any) => ({
      id: c.id,
      accuserId: c.accuserId,
      accuser: c.accuser,
      createdAt: c.createdAt.toISOString(),
    })),
    ownedBusinesses: ownedBusinessesWithProducts.map((business) => serializeBusiness(business, userId)),
    exploreBusinesses: exploreBusinessesWithProducts.map((business) => serializeBusiness(business, userId)),
    memberBusinesses: memberBusinessesWithProducts.map((business) => serializeBusiness(business, userId)),
    shareholderBusinesses: shareholderBusinessesWithProducts.map((business) => serializeBusiness(business, userId)),
  };
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

export async function createBusiness(userId: string, input: { name: string; typeKey: string; capital: number; description?: string; location?: string }) {
  await ensureUserSkills(userId);

  const type = BUSINESS_TYPE_MAP.get(input.typeKey);
  if (!type) {
    throw new Error('INVALID_BUSINESS_TYPE');
  }

  const name = input.name.trim();
  if (name.length < 3) {
    throw new Error('INVALID_BUSINESS_NAME');
  }

  if (input.capital < type.minCapital) {
    throw new Error('BUSINESS_CAPITAL_TOO_LOW');
  }

  const creationCost = type.creationFee;
  const startingCapital = type.key === 'bank' ? 0 : input.capital;
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
      select: { unlockedBusinessLevel: true },
    }),
  ]);
  const businessSlots = getBusinessSlots(skills);
  if (ownedBusinessCount >= businessSlots) {
    throw new Error('BUSINESS_SLOT_LIMIT_REACHED');
  }

  const unlockedLevel = viewer?.unlockedBusinessLevel ?? 0;
  const requiredUnlock = type.level - 1; // to create level N, must have unlocked N-1
  if (type.level > 1 && unlockedLevel < requiredUnlock) {
    throw new Error('BUSINESS_LEVEL_LOCKED');
  }

  const totalCost = creationCost + startingCapital;
  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, totalCost);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  const business = await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, totalCost);
    const createdBusiness = await tx.business.create({
      data: {
        ownerId: userId,
        name,
        typeKey: type.key,
        description: input.description?.trim() || type.description,
        location: input.location?.trim() || 'Quartier joueur',
        startingCapital,
        treasuryMoney: startingCapital,
        monthlyRevenue: type.monthlyRevenue,
        monthlyExpenses: type.monthlyExpenses,
        satisfaction: type.satisfaction,
        verified: false,
        hiring: true,
      },
    });

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
  if (type.level > unlockedLevel) {
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

  return serializeBusiness(business, userId);
}

async function handleInviteAction(userId: string, business: any, input: { inviteeIds: string[]; role: string; salary?: number; message?: string }) {
  if (!isBusinessParticipant(userId, business)) {
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

  if (loan.business.ownerId !== userId) {
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
          role: invitation.role,
          salary: invitation.salary ?? 0,
          status: 'ACTIVE',
        },
        create: {
          businessId: invitation.businessId,
          userId: invitation.employeeId,
          role: invitation.role,
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
  });

  await emitSharedBalanceUpdatesForUserIds(prisma, [proposal.ownerId]);

  await Promise.allSettled([
    createNotification({
      userId: proposal.investorId,
      type: 'SYSTEM',
      title: 'Tu deviens actionnaire',
      body: `${proposal.owner.username} a accepte. Tu possedes maintenant une part de ${proposal.business.name}.`,
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
  ]);

  logYouAdmin('business_share_proposal_review', userId, proposal.owner.username, proposal.business.id, proposal.business.name, {
    proposalId,
    decision,
    sharePercent: proposal.sharePercent,
    amount: proposal.amount,
    investorId: proposal.investorId,
    investorName: proposal.investor.username,
  });

  return { id: proposal.id, status: 'ACCEPTED', decidedAt: decidedAt.toISOString() };
}

async function handleCollectNpcAction(userId: string, business: any, _input: unknown) {
  if (business.ownerId !== userId) {
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

  const amount = balancing.npcCollectAmount as number;

  await prisma.$transaction([
    prisma.business.update({
      where: { id: business.id },
      data: { treasuryMoney: { increment: amount }, npcLastCollectedAt: new Date() },
    }),
  ]);

  await logBusinessTransaction(business.id, 'NPC_COLLECT', amount, `Recettes clients collectees`, userId);

  logYouAdmin('business_collect', userId, undefined, business.id, business.name, {
    amount,
  });

  // Affaires XP: +5 par collecte NPC (récompense la gestion active de l'entreprise)
  void grantSkillXp(userId, 'affaires', 5);

  return { amount };
}

async function handlePurchaseItemAction(userId: string, business: any, input: { itemKey: string }) {
  if (business.ownerId === userId) {
    throw new Error('PURCHASE_SELF_FORBIDDEN');
  }

  const { getBusinessBalancing } = await import('../../config/balancing.js');
  const balancing = getBusinessBalancing(business.typeKey);
  if (!balancing || !('items' in balancing)) {
    throw new Error('BUSINESS_ACTION_UNAVAILABLE');
  }

  const items = balancing.items as unknown as Array<{ key: string; label: string; price: number }>;
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
  });

  await emitSharedBalanceUpdates(prisma, userId);
  await logBusinessTransaction(business.id, 'ITEM_SALE', item.price, `Achat de ${item.label} par un client`, userId);

  logYouAdmin('business_sale', userId, undefined, business.id, business.name, {
    itemKey: item.key,
    itemLabel: item.label,
    price: item.price,
  });

  // Social XP: achat immobilier via agence (+1 XP par tranche de 500 EUR, min 5)
  if (business.typeKey === 'agency') {
    void grantSkillXp(userId, 'social', Math.max(5, Math.floor(item.price / 500)));
  }

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

  const type = BUSINESS_TYPE_MAP.get(business.typeKey);
  if (!type || !type.actions.includes(actionKey)) {
    throw new Error('BUSINESS_ACTION_UNAVAILABLE');
  }

  const handler = BUSINESS_ACTION_HANDLERS[actionKey];
  return handler(userId, business, input);
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

  const alreadyOwns = await prisma.business.findFirst({
    where: { ownerId: userId },
  });
  if (alreadyOwns) {
    throw new Error('BUYOUT_ALREADY_OWNS_BUSINESS');
  }

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
        },
      },
    },
  });

  if (!offer) {
    throw new Error('BUYOUT_OFFER_NOT_FOUND');
  }

  if (offer.ownerId !== userId || offer.business.ownerId !== userId) {
    throw new Error('BUYOUT_OFFER_REVIEW_FORBIDDEN');
  }

  if (offer.status !== 'PENDING') {
    throw new Error('BUYOUT_OFFER_ALREADY_RESOLVED');
  }

  const decidedAt = new Date();

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

  const bidderAlreadyOwns = await prisma.business.findFirst({
    where: { ownerId: offer.bidderId },
  });
  if (bidderAlreadyOwns) {
    throw new Error('BUYOUT_ALREADY_OWNS_BUSINESS');
  }

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

  return {
    proposal: {
      id: acceptedProposal.id,
      status: acceptedProposal.status,
      respondedAt: acceptedProposal.respondedAt?.toISOString() ?? null,
    },
    relationship: serializeRelationship(updatedRelationship, userId),
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
    where: { status: 'MISTRESS', OR: [{ userAId: accusedId }, { userBId: accusedId }] },
  });

  if (mistressRelationship) {
    const [viewerUser, accusedUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { money: true } }),
      prisma.user.findUnique({ where: { id: accusedId }, select: { money: true } }),
    ]);
    const coupleBalance = relationship.coupleBalance ?? 0;
    const totalMoney = (viewerUser?.money ?? 0) + (accusedUser?.money ?? 0) + coupleBalance;

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { money: totalMoney } }),
      prisma.user.update({ where: { id: accusedId }, data: { money: 0 } }),
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
  const totalMoney = (accuserUser?.money ?? 0) + (accusedUser?.money ?? 0) + coupleBalance;

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { money: totalMoney } }),
    prisma.user.update({ where: { id: accusation.accuserId }, data: { money: 0 } }),
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
    },
  });

  if (!business) {
    throw new Error('BUSINESS_NOT_FOUND');
  }

  const requester = await prisma.user.findUnique({
    where: { id: requestUserId },
    select: { isAdmin: true },
  });
  const isOwner = business.ownerId === requestUserId;
  const isAdmin = Boolean(requester?.isAdmin);

  if (!isOwner && !isAdmin) {
    throw new Error('BUSINESS_LIQUIDATION_FORBIDDEN');
  }

  await prisma.business.delete({
    where: { id: businessId },
  });

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

export async function buyLivretEpargneUpgrade(userId: string, businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, ownerId: true, typeKey: true, treasuryMoney: true, livretEpargneUnlocked: true },
  });

  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (business.ownerId !== userId) throw new Error('BUSINESS_UPGRADE_FORBIDDEN');
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
  if (business.ownerId !== userId) throw new Error('BANK_RATE_FORBIDDEN');
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

export async function setTransferFeeRate(userId: string, businessId: string, rate: number) {
  if (!Number.isFinite(rate) || rate < 0 || rate > 25) {
    throw new Error('INVALID_TRANSFER_FEE_RATE');
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, typeKey: true, name: true },
  });

  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (business.ownerId !== userId) throw new Error('TRANSFER_FEE_FORBIDDEN');
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
  if (business.ownerId !== userId) throw new Error('BUSINESS_NOT_FOUND');

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
  const actualAmount = Math.min(requestedAmount, balance.money);

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
  if (loan.business.ownerId !== userId) throw new Error('BUSINESS_LOAN_REVIEW_FORBIDDEN');
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
  if (business.ownerId !== userId) throw new Error('FORMATION_EDIT_FORBIDDEN');

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
  if (business.ownerId === userId) throw new Error('FORMATION_SELF_BUY_FORBIDDEN');
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
  data: { name?: string; description?: string | null; logoUrl?: string | null },
) {
  if (data.name !== undefined && !data.name.trim()) throw new Error('INVALID_BUSINESS_NAME');

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, name: true, description: true, logoUrl: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (business.ownerId !== userId) throw new Error('BUSINESS_EDIT_FORBIDDEN');

  const updated = await prisma.business.update({
    where: { id: businessId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl?.trim() || null } : {}),
    },
  });

  logYouAdmin('business_profile_update', userId, undefined, businessId, updated.name, {
    previousName: business.name,
    previousDescription: business.description,
    previousLogoUrl: business.logoUrl,
    name: updated.name,
    description: updated.description,
    logoUrl: updated.logoUrl,
  });

  return { name: updated.name, description: updated.description, logoUrl: updated.logoUrl };
}

// --- Formation Product System (multi-formation) ---

export async function listFormationProducts(businessId: string) {
  const products = await prisma.formationProduct.findMany({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
  });
  return products;
}

export async function addFormationProduct(
  userId: string,
  businessId: string,
  data: { title: string; description?: string; price: number; url: string; imageUrl?: string },
) {
  if (!data.title?.trim()) throw new Error('INVALID_FORMATION_TITLE');
  if (!Number.isFinite(data.price) || data.price < 0) throw new Error('INVALID_FORMATION_PRICE');
  if (!data.url?.trim()) throw new Error('INVALID_FORMATION_URL');

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, typeKey: true },
  });
  if (!business || business.typeKey !== 'formation') throw new Error('BUSINESS_NOT_FOUND');
  if (business.ownerId !== userId) throw new Error('FORMATION_EDIT_FORBIDDEN');

  const product = await prisma.formationProduct.create({
    data: {
      businessId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      price: data.price,
      url: data.url.trim(),
      imageUrl: data.imageUrl?.trim() || null,
    },
  });

  logYouAdmin('formation_product_create', userId, undefined, businessId, product.title, {
    productId: product.id,
    price: product.price,
    url: product.url,
  });

  return product;
}

export async function updateFormationProduct(
  userId: string,
  businessId: string,
  productId: string,
  data: { title?: string; description?: string | null; price?: number; url?: string; imageUrl?: string | null },
) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, typeKey: true },
  });
  if (!business || business.typeKey !== 'formation') throw new Error('BUSINESS_NOT_FOUND');
  if (business.ownerId !== userId) throw new Error('FORMATION_EDIT_FORBIDDEN');

  const product = await prisma.formationProduct.findUnique({ where: { id: productId } });
  if (!product || product.businessId !== businessId) throw new Error('FORMATION_PRODUCT_NOT_FOUND');

  if (data.price !== undefined && (!Number.isFinite(data.price) || data.price < 0)) throw new Error('INVALID_FORMATION_PRICE');
  if (data.title !== undefined && !data.title.trim()) throw new Error('INVALID_FORMATION_TITLE');
  if (data.url !== undefined && !data.url.trim()) throw new Error('INVALID_FORMATION_URL');

  const updated = await prisma.formationProduct.update({
    where: { id: productId },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.url !== undefined ? { url: data.url.trim() } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl?.trim() || null } : {}),
    },
  });

  logYouAdmin('formation_product_update', userId, undefined, businessId, updated.title, {
    productId,
    previousTitle: product.title,
    previousPrice: product.price,
    previousUrl: product.url,
    title: updated.title,
    price: updated.price,
    url: updated.url,
  });

  return updated;
}

export async function deleteFormationProduct(userId: string, businessId: string, productId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, typeKey: true },
  });
  if (!business || business.typeKey !== 'formation') throw new Error('BUSINESS_NOT_FOUND');
  if (business.ownerId !== userId) throw new Error('FORMATION_EDIT_FORBIDDEN');

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
  if (business.ownerId === userId) throw new Error('FORMATION_SELF_BUY_FORBIDDEN');

  const product = await prisma.formationProduct.findUnique({ where: { id: productId } });
  if (!product || product.businessId !== businessId) throw new Error('FORMATION_PRODUCT_NOT_FOUND');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true, username: true } });
  if (!user || user.money < product.price) throw new Error('INSUFFICIENT_MONEY');

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { money: { decrement: product.price } } }),
    prisma.business.update({ where: { id: businessId }, data: { treasuryMoney: { increment: product.price } } }),
  ]);

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

// --- Team Management ---

export async function updateMemberSalary(ownerId: string, businessId: string, memberId: string, salary: number) {
  if (!Number.isInteger(salary) || salary < 0) throw new Error('INVALID_SALARY');

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (business.ownerId !== ownerId) throw new Error('BUSINESS_INVITE_FORBIDDEN');

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

export async function sackMember(ownerId: string, businessId: string, memberId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true },
  });
  if (!business) throw new Error('BUSINESS_NOT_FOUND');
  if (business.ownerId !== ownerId) throw new Error('BUSINESS_INVITE_FORBIDDEN');

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

export async function runDailyBusinessSalaryPayments(db = prisma) {
  const { getParisDayKey } = await import('../../utils/dailyAura.js');
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
    if (member.business.treasuryMoney < member.salary) {
      continue;
    }

    await db.$transaction(async (tx: any) => {
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
        return;
      }

      await tx.user.update({
        where: { id: member.userId },
        data: { money: { increment: member.salary } },
      });

      await tx.businessMember.update({
        where: { id: member.id },
        data: { lastSalaryPaymentDate: todayKey },
      });
    });

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
