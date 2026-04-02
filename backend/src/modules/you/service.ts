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
    canTrain: level < YOU_SKILL_MAX_LEVEL,
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
      user: member.user,
    })),
    pendingInvitations: business.invitations.map((invite: any) => ({
      id: invite.id,
      role: invite.role,
      status: invite.status,
      createdAt: invite.createdAt.toISOString(),
      invitee: invite.invitee,
    })),
    recentLoans: business.loans.map((loan: any) => ({
      id: loan.id,
      amount: loan.amount,
      termDays: loan.termMonths,
      interestRate: loan.interestRate,
      status: loan.status,
      decidedAt: loan.decidedAt ? loan.decidedAt.toISOString() : null,
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
    transferHistory: business.transferHistory.map((entry: any) => serializeTransferHistoryEntry(entry)),
    pendingBuyoutOffers: business.buyoutOffers
      .filter((offer: any) => offer.status === 'PENDING')
      .map((offer: any) => serializeBuyoutOffer(offer, viewerId)),
    startupProducts,
    livretEpargneUnlocked: business.typeKey === 'bank' ? (business.livretEpargneUnlocked ?? false) : undefined,
    loanInterestRate: business.typeKey === 'bank' ? (business.loanInterestRate ?? 4) : undefined,
    transferFeeRate: business.typeKey === 'transfer' ? (business.transferFeeRate ?? 2) : undefined,
  };
}

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

  const [players, ownedBusinesses, exploreBusinesses, memberBusinesses, pendingInvitations, pendingBuyoutOffers, sentBuyoutOffers, skills] = await Promise.all([
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
    prisma.businessInvitation.findMany({
      where: {
        inviteeId: userId,
        status: 'PENDING',
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
    prisma.userSkill.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const startupBusinessIds = [...ownedBusinesses, ...exploreBusinesses, ...memberBusinesses]
    .filter((business) => business.typeKey === 'startup')
    .map((business) => business.id);

  if (startupBusinessIds.length > 0) {
    await Promise.all(startupBusinessIds.map((businessId) => ensureStartupProducts(businessId)));
  }

  const [ownedBusinessesWithProducts, exploreBusinessesWithProducts, memberBusinessesWithProducts] = startupBusinessIds.length > 0
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
      ])
    : [ownedBusinesses, exploreBusinesses, memberBusinesses];

  const serializedSkills = skills
    .map((skill) => serializeSkill(skill))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));
  const businessSlots = getBusinessSlots(skills);

  return {
    businessTypes: BUSINESS_TYPES,
    skills: serializedSkills,
    businessSlots,
    players: players.map((player) => ({
      ...player,
      alreadyInRelationship: relatedUserIds.has(player.id),
    })),
    jobOffers: pendingInvitations.map((invitation) => ({
      id: invitation.id,
      role: invitation.role,
      createdAt: invitation.createdAt.toISOString(),
      inviter: invitation.inviter,
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
  const [skills, ownedBusinessCount] = await Promise.all([
    prisma.userSkill.findMany({
      where: { userId },
      select: { key: true, level: true },
    }),
    prisma.business.count({
      where: { ownerId: userId },
    }),
  ]);
  const businessSlots = getBusinessSlots(skills);
  if (ownedBusinessCount >= businessSlots) {
    throw new Error('BUSINESS_SLOT_LIMIT_REACHED');
  }

  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, creationCost);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  const business = await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, creationCost);
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

  logYouAdmin('business_create', userId, undefined, business.id, business.name, {
    businessType: business.typeKey,
    creationCost,
    startingCapital,
  });

  return serializeBusiness(business, userId);
}

async function handleInviteAction(userId: string, business: any, input: { inviteeIds: string[]; role: string }) {
  if (!isBusinessParticipant(userId, business)) {
    throw new Error('BUSINESS_INVITE_FORBIDDEN');
  }

  const inviteeIds = Array.from(new Set((input.inviteeIds || []).filter((inviteeId) => inviteeId && inviteeId !== userId)));
  if (inviteeIds.length === 0) {
    throw new Error('INVITEE_REQUIRED');
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
      inviteeId: { in: inviteeIds },
      status: 'PENDING',
    },
    select: { inviteeId: true },
  });

  const memberIds = new Set(existingMembers.map((member) => member.userId));
  const pendingIds = new Set(existingInvitations.map((invite) => invite.inviteeId));

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
          role: input.role || 'employee',
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
        title: 'Invitation business',
        body: `${business.owner.username} t'invite a rejoindre ${business.name} comme ${input.role || 'employee'}.`,
        data: {
          invitationId: invitationByInviteeId.get(invitee.id)?.id ?? null,
          businessId: business.id,
          businessName: business.name,
          role: input.role || 'employee',
          actionType: 'BUSINESS_INVITATION',
        },
        link: '/you?tab=travail',
        icon: 'briefcase-business',
      })
    )
  );

  return {
    invited: creatableInvitees.length,
  };
}

async function handleLoanAction(userId: string, business: any, input: { amount: number; durationDays: number }) {
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

  const interestRate = business.loanInterestRate ?? 4;

  const loan = await prisma.businessLoan.create({
    data: {
      businessId: business.id,
      borrowerId: userId,
      amount,
      termMonths: durationDays,
      interestRate,
      status: 'PENDING',
    },
  });

  await Promise.allSettled([
    createNotification({
      userId: owner.id,
      type: 'SYSTEM',
      title: 'Nouvelle demande de pret',
      body: `${borrower.username} demande ${amount.toLocaleString('fr-FR')} money via ${business.name}.`,
      link: '/you?tab=travail',
      icon: 'credit-card',
    }),
    createNotification({
      userId: borrower.id,
      type: 'SYSTEM',
      title: 'Demande de pret envoyee',
      body: `Ta demande de ${amount.toLocaleString('fr-FR')} money attend la validation de ${owner.username}.`,
      link: '/you?tab=explore',
      icon: 'landmark',
    }),
  ]);

  logYouAdmin('business_loan_request', userId, borrower.username, business.id, business.name, {
    amount,
    durationDays,
    interestRate,
  });

  return {
    id: loan.id,
    amount,
    durationDays,
    interestRate,
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
  const hasSharedMoney = await ensureSharedMoneyAvailable(prisma, userId, researchCost);
  if (!hasSharedMoney) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + getStartupResearchDurationMinutes(nextLevel) * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await debitSharedMoney(tx, userId, researchCost);
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

  await emitSharedBalanceUpdates(prisma, userId);

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
    const updatedLoan = await tx.businessLoan.update({
      where: { id: loan.id },
      data: {
        status: 'ACTIVE',
        decidedAt: now,
      },
    });

    await tx.business.update({
      where: { id: loan.businessId },
      data: { treasuryMoney: { decrement: loan.amount } },
    });

    await tx.user.update({
      where: { id: loan.borrowerId },
      data: { money: { increment: loan.amount } },
    });

    return updatedLoan;
  });

  await Promise.all([
    emitSharedBalanceUpdates(prisma, loan.borrowerId),
    emitSharedBalanceUpdates(prisma, userId),
  ]);

  await Promise.allSettled([
    createNotification({
      userId: loan.borrowerId,
      type: 'MONEY_RECEIVED',
      title: 'Pret accepte',
      body: `${loan.amount.toLocaleString('fr-FR')} money recu depuis ${loan.business.name}.`,
      link: '/you?tab=explore',
      icon: 'landmark',
    }),
    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Pret accorde',
      body: `${loan.borrower.username} a recu ${loan.amount.toLocaleString('fr-FR')} money depuis ${loan.business.name}.`,
      link: '/you?tab=travail',
      icon: 'credit-card',
    }),
  ]);

  logYouAdmin('business_loan_decision', userId, loan.business.owner.username, loan.business.id, loan.business.name, {
    loanId: loan.id,
    borrowerId: loan.borrowerId,
    borrowerName: loan.borrower.username,
    amount: loan.amount,
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

  if (invitation.inviteeId !== userId) {
    throw new Error('BUSINESS_INVITATION_FORBIDDEN');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('BUSINESS_INVITATION_ALREADY_RESOLVED');
  }

  const respondedAt = new Date();

  if (decision === 'reject') {
    const rejectedInvitation = await prisma.businessInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'REJECTED',
        respondedAt,
      },
    });

    await createNotification({
      userId: invitation.business.ownerId,
      type: 'SYSTEM',
      title: 'Invitation refusee',
      body: `${invitation.invitee.username} a refuse l'invitation pour ${invitation.business.name}.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    });

    return {
      id: rejectedInvitation.id,
      status: rejectedInvitation.status,
      respondedAt: rejectedInvitation.respondedAt?.toISOString() ?? null,
    };
  }

  const acceptedInvitation = await prisma.$transaction(async (tx) => {
    await tx.businessMember.upsert({
      where: {
        businessId_userId: {
          businessId: invitation.businessId,
          userId,
        },
      },
      update: {
        role: invitation.role,
        status: 'ACTIVE',
      },
      create: {
        businessId: invitation.businessId,
        userId,
        role: invitation.role,
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
  });

  await Promise.allSettled([
    createNotification({
      userId: invitation.business.ownerId,
      type: 'SYSTEM',
      title: 'Invitation acceptee',
      body: `${invitation.invitee.username} rejoint ${invitation.business.name}.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Bienvenue dans le business',
      body: `Tu fais maintenant partie de ${invitation.business.name}.`,
      link: '/you?tab=travail',
      icon: 'briefcase-business',
    }),
  ]);

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

const BUSINESS_ACTION_HANDLERS: Record<BusinessActionKey, (userId: string, business: any, input: any) => Promise<any>> = {
  invite: handleInviteAction,
  loan: handleLoanAction,
  invest: handleInvestAction,
  deposit: handleDepositAction,
  withdraw: handleWithdrawAction,
  start_research: handleStartResearchAction,
  deploy_product: handleDeployProductAction,
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

    return {
      id: rejected.id,
      status: rejected.status,
      decidedAt: rejected.decidedAt?.toISOString() ?? null,
    };
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
  const relationship = await prisma.relationship.findUnique({ where: { id: relationshipId } });
  if (!relationship) throw new Error('RELATIONSHIP_NOT_FOUND');
  if (relationship.userAId !== userId && relationship.userBId !== userId) throw new Error('RELATIONSHIP_FORBIDDEN');
  if (relationship.status === 'MARRIED') throw new Error('RELATIONSHIP_NOT_MARRIED');
  await prisma.relationship.delete({ where: { id: relationshipId } });
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
