import { prisma } from '../../server.js';
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
import { debitSharedMoney, emitSharedBalanceUpdates, ensureSharedMoneyAvailable } from '../../utils/sharedBalance.js';

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
    startupProducts,
  };
}

function serializeRelationship(relationship: any, viewerId: string) {
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

  return {
    id: relationship.id,
    status: relationship.status,
    connectionLevel: relationship.connectionLevel,
    createdAt: relationship.createdAt.toISOString(),
    marriedAt: relationship.marriedAt ? relationship.marriedAt.toISOString() : null,
    otherUser,
    canProposeMarriage: relationship.status === 'DATING' && relationship.connectionLevel >= 70 && !pendingMarriageProposal,
    canDivorce: canRequestDivorce,
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

  const relatedUserIds = new Set<string>();
  relationships.forEach((relationship) => {
    if (relationship.status !== 'DIVORCED') {
      relatedUserIds.add(relationship.userAId);
      relatedUserIds.add(relationship.userBId);
    }
  });

  const [players, ownedBusinesses, exploreBusinesses, pendingInvitations, skills] = await Promise.all([
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
    prisma.userSkill.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const startupBusinessIds = [...ownedBusinesses, ...exploreBusinesses]
    .filter((business) => business.typeKey === 'startup')
    .map((business) => business.id);

  if (startupBusinessIds.length > 0) {
    await Promise.all(startupBusinessIds.map((businessId) => ensureStartupProducts(businessId)));
  }

  const [ownedBusinessesWithProducts, exploreBusinessesWithProducts] = startupBusinessIds.length > 0
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
      ])
    : [ownedBusinesses, exploreBusinesses];

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
    relationships: relationships.map((relationship) => serializeRelationship(relationship, userId)),
    ownedBusinesses: ownedBusinessesWithProducts.map((business) => serializeBusiness(business, userId)),
    exploreBusinesses: exploreBusinessesWithProducts.map((business) => serializeBusiness(business, userId)),
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

  const interestRate = 4;

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

  return { amount };
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

export async function createRelationship(userId: string, targetUserId: string) {
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

    return serializeRelationship(revivedRelationship, userId);
  }

  const relationship = await prisma.relationship.create({
    data: {
      ...pair,
      initiatedById: userId,
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

  return {
    proposal: {
      id: acceptedProposal.id,
      status: acceptedProposal.status,
      respondedAt: acceptedProposal.respondedAt?.toISOString() ?? null,
    },
    relationship: serializeRelationship(updatedRelationship, userId),
  };
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
      },
      include: RELATIONSHIP_INCLUDE,
    }),
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

  return {
    proposal: {
      id: acceptedProposal.id,
      status: acceptedProposal.status,
      respondedAt: acceptedProposal.respondedAt?.toISOString() ?? null,
    },
    relationship: serializeRelationship(updatedRelationship, userId),
  };
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
