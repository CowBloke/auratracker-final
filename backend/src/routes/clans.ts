import { Prisma } from '@prisma/client';
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../server.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

const CLAN_CREATE_COST = 100;
const CLAN_MAX_MEMBERS = 5;
const CLAN_WAR_PREPARATION_HOURS = 12;
const CLAN_WAR_DURATION_HOURS = 36;
const CLAN_WAR_COOLDOWN_HOURS = 12;
const CLAN_WAR_TARGET_SCORE = 180;
const CLAN_WAR_MIN_MEMBERS = 3;
const CLAN_WAR_STAMINA_PER_24H = 3;
const CLAN_WAR_FORTIFICATIONS_PER_MEMBER = 2;
const CLAN_WAR_HISTORY_LIMIT = 5;

const clanMemberUserSelect = {
  id: true,
  username: true,
  aura: true,
  usernameColor: true,
  profilePicture: true,
} satisfies Prisma.UserSelect;

const clanLeaderSelect = {
  id: true,
  username: true,
  usernameColor: true,
  profilePicture: true,
} satisfies Prisma.UserSelect;

const clanSummaryInclude = Prisma.validator<Prisma.ClanInclude>()({
  members: {
    include: {
      user: {
        select: clanMemberUserSelect,
      },
    },
  },
  owner: {
    select: clanLeaderSelect,
  },
});

const clanDetailInclude = Prisma.validator<Prisma.ClanInclude>()({
  members: {
    include: {
      user: {
        select: clanMemberUserSelect,
      },
    },
    orderBy: {
      user: { aura: 'desc' },
    },
  },
  owner: {
    select: clanLeaderSelect,
  },
  joinRequests: {
    include: {
      user: {
        select: clanMemberUserSelect,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
});

const currentWarInclude = Prisma.validator<Prisma.ClanWarInclude>()({
  attackerClan: {
    include: clanSummaryInclude,
  },
  defenderClan: {
    include: clanSummaryInclude,
  },
  winnerClan: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
  },
  winnerUser: {
    select: clanLeaderSelect,
  },
  attacks: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
      attackingClan: {
        select: {
          id: true,
          name: true,
        },
      },
      targetClan: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  },
  defenses: {
    orderBy: [{ clanId: 'asc' }, { type: 'asc' }],
  },
  fortifications: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
      defense: {
        select: {
          id: true,
          type: true,
          clanId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 30,
  },
});

const historyWarInclude = Prisma.validator<Prisma.ClanWarInclude>()({
  attackerClan: {
    include: clanSummaryInclude,
  },
  defenderClan: {
    include: clanSummaryInclude,
  },
  winnerClan: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
  },
  winnerUser: {
    select: clanLeaderSelect,
  },
  attacks: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
      attackingClan: {
        select: {
          id: true,
          name: true,
        },
      },
      targetClan: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 8,
  },
  defenses: true,
  fortifications: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
      defense: {
        select: {
          id: true,
          type: true,
          clanId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 12,
  },
});

type ClanWithMembers = Prisma.ClanGetPayload<{ include: typeof clanSummaryInclude }>;
type ClanDetailPayload = Prisma.ClanGetPayload<{ include: typeof clanDetailInclude }>;
type ClanWarCurrentPayload = Prisma.ClanWarGetPayload<{ include: typeof currentWarInclude }>;
type ClanWarHistoryPayload = Prisma.ClanWarGetPayload<{ include: typeof historyWarInclude }>;

type DefenseType = 'FORTRESS' | 'ARMORY' | 'BANNER';
type AttackType = 'RAID' | 'SIEGE' | 'SABOTAGE';

const defenseConfig: Record<DefenseType, {
  label: string;
  description: string;
  baseDurability: number;
  durabilityPerLevel: number;
}> = {
  FORTRESS: {
    label: 'Forteresse',
    description: 'Reduit fortement les degats entrants.',
    baseDurability: 60,
    durabilityPerLevel: 18,
  },
  ARMORY: {
    label: 'Armurerie',
    description: 'Augmente les degats offensifs du clan.',
    baseDurability: 48,
    durabilityPerLevel: 16,
  },
  BANNER: {
    label: 'Banniere',
    description: 'Booste le moral et aide le clan à revenir dans la partie.',
    baseDurability: 42,
    durabilityPerLevel: 14,
  },
};

const attackConfig: Record<AttackType, {
  label: string;
  description: string;
  staminaCost: number;
  minPoints: number;
  maxPoints: number;
  structureDamage: number;
}> = {
  RAID: {
    label: 'Raid eclair',
    description: 'Attaque rapide et reguliere.',
    staminaCost: 1,
    minPoints: 18,
    maxPoints: 28,
    structureDamage: 10,
  },
  SIEGE: {
    label: 'Siege lourd',
    description: 'Lent mais ideal pour casser les lignes defensives.',
    staminaCost: 2,
    minPoints: 30,
    maxPoints: 44,
    structureDamage: 18,
  },
  SABOTAGE: {
    label: 'Sabotage',
    description: 'Frappe precise contre les structures ennemies.',
    staminaCost: 1,
    minPoints: 16,
    maxPoints: 24,
    structureDamage: 22,
  },
};

const getDefenseTypes = (): DefenseType[] => ['FORTRESS', 'ARMORY', 'BANNER'];
const getAttackTypes = (): AttackType[] => ['RAID', 'SIEGE', 'SABOTAGE'];

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000);
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRollingWindowStart = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

const getDefenseMaxDurability = (type: DefenseType, level: number) =>
  defenseConfig[type].baseDurability + Math.max(0, level - 1) * defenseConfig[type].durabilityPerLevel;

const isDefenseType = (value: string): value is DefenseType => getDefenseTypes().includes(value as DefenseType);
const isAttackType = (value: string): value is AttackType => getAttackTypes().includes(value as AttackType);

const getClanTotalAura = (clan: ClanWithMembers | ClanDetailPayload) =>
  clan.members.reduce((sum, member) => sum + member.user.aura, BigInt(0));

const mapClanSummary = (clan: ClanWithMembers | ClanDetailPayload) => ({
  id: clan.id,
  name: clan.name,
  description: clan.description,
  imageUrl: clan.imageUrl,
  isPublic: clan.isPublic,
  maxMembers: clan.maxMembers,
  memberCount: clan.members.length,
  totalAura: getClanTotalAura(clan),
  createdAt: clan.createdAt,
  leader: clan.owner,
  tagUnlocked: clan.tagUnlocked,
  tagText: clan.tagText ?? null,
  tagStyle: clan.tagStyle ?? null,
});

const getClanDefenseLevel = (defenses: ClanWarCurrentPayload['defenses'] | ClanWarHistoryPayload['defenses'], clanId: string, type: DefenseType) => {
  const defense = defenses.find((entry) => entry.clanId === clanId && entry.type === type && entry.durability > 0);
  return defense?.level ?? 0;
};

const selectDefenseTarget = (
  attackType: AttackType,
  defenses: ClanWarCurrentPayload['defenses'],
  targetClanId: string
) => {
  const activeDefenses = defenses
    .filter((entry) => entry.clanId === targetClanId && entry.durability > 0)
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.durability - a.durability;
    });

  if (activeDefenses.length === 0) {
    return null;
  }

  if (attackType === 'SIEGE') {
    return activeDefenses.find((entry) => entry.type === 'FORTRESS') ?? activeDefenses[0];
  }

  if (attackType === 'SABOTAGE') {
    return activeDefenses.find((entry) => entry.type === 'ARMORY')
      ?? activeDefenses.find((entry) => entry.type === 'BANNER')
      ?? activeDefenses[0];
  }

  return activeDefenses[0];
};

const mapWarDefenseState = (
  war: ClanWarCurrentPayload | ClanWarHistoryPayload,
  clanId: string
) =>
  getDefenseTypes().map((type) => {
    const defense = war.defenses.find((entry) => entry.clanId === clanId && entry.type === type) ?? null;
    const contributions = war.fortifications.filter((entry) => entry.clanId === clanId && entry.defense.type === type).length;

    return {
      type,
      label: defenseConfig[type].label,
      description: defenseConfig[type].description,
      level: defense?.level ?? 0,
      durability: defense?.durability ?? 0,
      maxDurability: defense?.maxDurability ?? 0,
      isActive: Boolean(defense && defense.durability > 0),
      contributions,
    };
  });

const mapWarScoreClan = (clan: ClanWithMembers) => ({
  ...mapClanSummary(clan),
});

const mapWar = async (
  war: ClanWarCurrentPayload | ClanWarHistoryPayload,
  viewerClanId: string | null,
  viewerUserId: string | null
) => {
  const isViewerAttacker = viewerClanId === war.attackerClanId;
  const viewerScore = isViewerAttacker ? war.attackerScore : war.defenderScore;
  const opponentScore = isViewerAttacker ? war.defenderScore : war.attackerScore;

  let staminaUsed = 0;
  let fortificationsUsed = 0;

  if (viewerUserId) {
    staminaUsed = war.attacks
      .filter((entry) => entry.userId === viewerUserId && entry.createdAt >= getRollingWindowStart(24))
      .reduce((sum, entry) => sum + entry.staminaCost, 0);
    fortificationsUsed = war.fortifications.filter((entry) => entry.userId === viewerUserId).length;
  }

  return {
    id: war.id,
    status: war.status,
    startsAt: war.startsAt,
    endsAt: war.endsAt,
    completedAt: war.completedAt,
    targetScore: war.targetScore,
    attackerScore: war.attackerScore,
    defenderScore: war.defenderScore,
    scoreGap: Math.abs(war.attackerScore - war.defenderScore),
    viewerSide: viewerClanId
      ? isViewerAttacker
        ? 'ATTACKER'
        : viewerClanId === war.defenderClanId
          ? 'DEFENDER'
          : 'SPECTATOR'
      : 'SPECTATOR',
    viewerScore,
    opponentScore,
    attackerClan: mapWarScoreClan(war.attackerClan),
    defenderClan: mapWarScoreClan(war.defenderClan),
    winnerClan: war.winnerClan,
    winnerUser: war.winnerUser,
    rewardTable: {
      winner: {
        money: war.winnerRewardMoney,
        aura: war.winnerRewardAura,
      },
      loser: {
        money: war.loserRewardMoney,
        aura: war.loserRewardAura,
      },
    },
    defenses: {
      attacker: mapWarDefenseState(war, war.attackerClanId),
      defender: mapWarDefenseState(war, war.defenderClanId),
    },
    viewerActions: {
      staminaCap: CLAN_WAR_STAMINA_PER_24H,
      staminaUsed,
      staminaRemaining: Math.max(0, CLAN_WAR_STAMINA_PER_24H - staminaUsed),
      fortificationsCap: CLAN_WAR_FORTIFICATIONS_PER_MEMBER,
      fortificationsUsed,
      fortificationsRemaining: Math.max(0, CLAN_WAR_FORTIFICATIONS_PER_MEMBER - fortificationsUsed),
    },
    recentAttacks: war.attacks.map((attack) => ({
      id: attack.id,
      attackType: attack.attackType,
      attackLabel: attackConfig[attack.attackType as AttackType]?.label ?? attack.attackType,
      user: attack.user,
      attackingClan: attack.attackingClan,
      targetClan: attack.targetClan,
      staminaCost: attack.staminaCost,
      basePoints: attack.basePoints,
      bonusPoints: attack.bonusPoints,
      defenseMitigation: attack.defenseMitigation,
      structureDamage: attack.structureDamage,
      finalPoints: attack.finalPoints,
      createdAt: attack.createdAt,
    })),
    recentFortifications: war.fortifications.map((entry) => ({
      id: entry.id,
      user: entry.user,
      clanId: entry.clanId,
      defenseType: entry.defense.type,
      defenseLabel: defenseConfig[entry.defense.type as DefenseType]?.label ?? entry.defense.type,
      levelAdded: entry.levelAdded,
      durabilityAdded: entry.durabilityAdded,
      createdAt: entry.createdAt,
    })),
  };
};

const getCurrentWarForClan = async (clanId: string) =>
  prisma.clanWar.findFirst({
    where: {
      status: {
        in: ['PREPARING', 'ACTIVE'],
      },
      OR: [
        { attackerClanId: clanId },
        { defenderClanId: clanId },
      ],
    },
    include: currentWarInclude,
    orderBy: {
      createdAt: 'desc',
    },
  });

const getClanCooldownEndsAt = async (clanId: string) => {
  const lastWar = await prisma.clanWar.findFirst({
    where: {
      status: 'COMPLETED',
      OR: [{ attackerClanId: clanId }, { defenderClanId: clanId }],
    },
    select: {
      completedAt: true,
    },
    orderBy: {
      completedAt: 'desc',
    },
  });

  if (!lastWar?.completedAt) {
    return null;
  }

  const cooldownEndsAt = addHours(lastWar.completedAt, CLAN_WAR_COOLDOWN_HOURS);
  return cooldownEndsAt > new Date() ? cooldownEndsAt : null;
};

const notifyClanMembers = async (userIds: string[], payload: Omit<Parameters<typeof createNotification>[0], 'userId'>) => {
  await Promise.allSettled(
    userIds.map((userId) => createNotification({ userId, ...payload }))
  );
};

const finalizeClanWar = async (warId: string) => {
  const now = new Date();
  const war = await prisma.clanWar.findUnique({
    where: { id: warId },
    include: {
      attackerClan: {
        include: {
          members: true,
        },
      },
      defenderClan: {
        include: {
          members: true,
        },
      },
      attacks: {
        select: {
          userId: true,
          clanId: true,
          finalPoints: true,
        },
      },
    },
  });

  if (!war || war.status === 'COMPLETED' || war.status === 'CANCELLED') {
    return;
  }

  const attackerWon = war.attackerScore > war.defenderScore;
  const defenderWon = war.defenderScore > war.attackerScore;
  const winnerClanId = attackerWon ? war.attackerClanId : defenderWon ? war.defenderClanId : null;

  const winnerContribution = new Map<string, number>();
  for (const attack of war.attacks) {
    if (attack.clanId !== winnerClanId) continue;
    winnerContribution.set(attack.userId, (winnerContribution.get(attack.userId) ?? 0) + attack.finalPoints);
  }

  const winnerUserId = winnerClanId
    ? [...winnerContribution.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const attackerRewardMoney = winnerClanId === war.attackerClanId ? war.winnerRewardMoney : war.loserRewardMoney;
  const defenderRewardMoney = winnerClanId === war.defenderClanId ? war.winnerRewardMoney : war.loserRewardMoney;
  const attackerRewardAura = winnerClanId === war.attackerClanId ? war.winnerRewardAura : war.loserRewardAura;
  const defenderRewardAura = winnerClanId === war.defenderClanId ? war.winnerRewardAura : war.loserRewardAura;

  await prisma.$transaction(async (tx) => {
    await tx.clanWar.update({
      where: { id: war.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        winnerClanId,
        winnerUserId,
      },
    });

    for (const member of war.attackerClan.members) {
      await tx.user.update({
        where: { id: member.userId },
        data: {
          money: { increment: attackerRewardMoney },
          aura: { increment: BigInt(attackerRewardAura) },
        },
      });
    }

    for (const member of war.defenderClan.members) {
      await tx.user.update({
        where: { id: member.userId },
        data: {
          money: { increment: defenderRewardMoney },
          aura: { increment: BigInt(defenderRewardAura) },
        },
      });
    }
  });

  const attackerMemberIds = war.attackerClan.members.map((member) => member.userId);
  const defenderMemberIds = war.defenderClan.members.map((member) => member.userId);
  const winnerName = winnerClanId === war.attackerClanId
    ? war.attackerClan.name
    : winnerClanId === war.defenderClanId
      ? war.defenderClan.name
      : null;

  if (!winnerClanId) {
    await Promise.allSettled([
      notifyClanMembers(attackerMemberIds, {
        type: 'CLAN_WAR_COMPLETED',
        title: 'Guerre terminee',
        body: `Le conflit contre ${war.defenderClan.name} se termine sur une egalite.`,
        data: { warId: war.id, clanId: war.attackerClanId },
        link: '/clans',
        icon: 'swords',
      }),
      notifyClanMembers(defenderMemberIds, {
        type: 'CLAN_WAR_COMPLETED',
        title: 'Guerre terminee',
        body: `Le conflit contre ${war.attackerClan.name} se termine sur une egalite.`,
        data: { warId: war.id, clanId: war.defenderClanId },
        link: '/clans',
        icon: 'swords',
      }),
    ]);
    return;
  }

  await Promise.allSettled([
    notifyClanMembers(winnerClanId === war.attackerClanId ? attackerMemberIds : defenderMemberIds, {
      type: 'CLAN_WAR_WON',
      title: 'Victoire de clan',
      body: `${winnerName} remporte la guerre et empoche les meilleures récompenses.`,
      data: { warId: war.id, clanId: winnerClanId },
      link: '/clans',
      icon: 'trophy',
    }),
    notifyClanMembers(winnerClanId === war.attackerClanId ? defenderMemberIds : attackerMemberIds, {
      type: 'CLAN_WAR_LOST',
      title: 'Défaite de clan',
      body: `${winnerName} a remporté la guerre. Les récompenses de consolation ont été versées.`,
      data: { warId: war.id, clanId: winnerClanId },
      link: '/clans',
      icon: 'shield',
    }),
  ]);
};

const advanceClanWarsState = async () => {
  const now = new Date();

  const warsToActivate = await prisma.clanWar.findMany({
    where: {
      status: 'PREPARING',
      startsAt: { lte: now },
    },
    select: {
      id: true,
    },
  });

  if (warsToActivate.length > 0) {
    await prisma.clanWar.updateMany({
      where: {
        id: {
          in: warsToActivate.map((war) => war.id),
        },
      },
      data: {
        status: 'ACTIVE',
      },
    });
  }

  const warsToComplete = await prisma.clanWar.findMany({
    where: {
      status: {
        in: ['PREPARING', 'ACTIVE'],
      },
      OR: [
        { endsAt: { lte: now } },
        { attackerScore: { gte: CLAN_WAR_TARGET_SCORE } },
        { defenderScore: { gte: CLAN_WAR_TARGET_SCORE } },
      ],
    },
    select: {
      id: true,
    },
  });

  for (const war of warsToComplete) {
    await finalizeClanWar(war.id);
  }
};

const getEligibleOpponents = async (clanId: string) => {
  const clans = await prisma.clan.findMany({
    include: clanSummaryInclude,
    orderBy: {
      createdAt: 'desc',
    },
  });

  const result = [];
  for (const candidate of clans) {
    if (candidate.id === clanId) continue;
    if (candidate.members.length < CLAN_WAR_MIN_MEMBERS) continue;
    const [activeWar, cooldownEndsAt] = await Promise.all([
      getCurrentWarForClan(candidate.id),
      getClanCooldownEndsAt(candidate.id),
    ]);
    if (activeWar || cooldownEndsAt) continue;
    result.push(mapClanSummary(candidate));
  }

  return result;
};

const getClanMembership = (clanId: string, userId: string) =>
  prisma.clanMember.findUnique({
    where: {
      clanId_userId: {
        clanId,
        userId,
      },
    },
    select: {
      clanId: true,
      userId: true,
      isLeader: true,
    },
  });

// Get all clans
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();

    const userId = req.user?.id;
    const [clans, membership, activeWars] = await Promise.all([
      prisma.clan.findMany({
        include: clanSummaryInclude,
        orderBy: { createdAt: 'desc' },
      }),
      userId
        ? prisma.clanMember.findUnique({
            where: { userId },
            select: { clanId: true, isLeader: true },
          })
        : null,
      prisma.clanWar.findMany({
        where: {
          status: {
            in: ['PREPARING', 'ACTIVE'],
          },
        },
        include: currentWarInclude,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    res.json({
      clans: clans.map(mapClanSummary),
      meta: {
        viewerClanId: membership?.clanId ?? null,
        viewerIsClanLeader: membership?.isLeader ?? false,
        activeWars: await Promise.all(activeWars.map((war) => mapWar(war, membership?.clanId ?? null, userId ?? null))),
      },
    });
  } catch (error) {
    console.error('Get clans error:', error);
    res.status(500).json({ error: 'Failed to get clans' });
  }
});

// Get clan detail
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();

    const { id } = req.params;
    const userId = req.user?.id ?? null;

    const clan = await prisma.clan.findUnique({
      where: { id },
      include: clanDetailInclude,
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    const isMember = clan.members.some((member) => member.userId === userId);
    const isLeader = clan.members.some((member) => member.userId === userId && member.isLeader);

    const [pendingRequest, currentWar, warHistory, cooldownEndsAt, eligibleOpponents] = await Promise.all([
      userId
        ? prisma.clanJoinRequest.findUnique({
            where: {
              clanId_userId: {
                clanId: clan.id,
                userId,
              },
            },
            select: { id: true },
          })
        : null,
      getCurrentWarForClan(clan.id),
      prisma.clanWar.findMany({
        where: {
          status: 'COMPLETED',
          OR: [{ attackerClanId: clan.id }, { defenderClanId: clan.id }],
        },
        include: historyWarInclude,
        orderBy: {
          completedAt: 'desc',
        },
        take: CLAN_WAR_HISTORY_LIMIT,
      }),
      getClanCooldownEndsAt(clan.id),
      isLeader ? getEligibleOpponents(clan.id) : Promise.resolve([]),
    ]);

    res.json({
      clan: {
        ...mapClanSummary(clan),
        members: clan.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          username: member.user.username,
          usernameColor: member.user.usernameColor,
          aura: member.user.aura,
          profilePicture: member.user.profilePicture,
          joinedAt: member.joinedAt,
          isLeader: member.isLeader,
        })),
        joinRequests: isLeader
          ? clan.joinRequests.map((request) => ({
              id: request.id,
              userId: request.userId,
              username: request.user.username,
              usernameColor: request.user.usernameColor,
              aura: request.user.aura,
              profilePicture: request.user.profilePicture,
              requestedAt: request.createdAt,
            }))
          : [],
        viewer: {
          isMember,
          isLeader,
          hasPendingRequest: Boolean(pendingRequest),
        },
        warHub: {
          currentWar: currentWar ? await mapWar(currentWar, isMember ? clan.id : null, userId) : null,
          history: await Promise.all(warHistory.map((war) => mapWar(war, isMember ? clan.id : null, userId))),
          eligibleOpponents,
          cooldownEndsAt,
          canDeclareWar: isLeader && clan.members.length >= CLAN_WAR_MIN_MEMBERS && !currentWar && !cooldownEndsAt,
          minimumMembersRequired: CLAN_WAR_MIN_MEMBERS,
          attackTypes: getAttackTypes().map((type) => ({
            type,
            ...attackConfig[type],
          })),
          defenseTypes: getDefenseTypes().map((type) => ({
            type,
            ...defenseConfig[type],
            maxLevel: 3,
          })),
        },
      },
    });
  } catch (error) {
    console.error('Get clan error:', error);
    res.status(500).json({ error: 'Failed to get clan' });
  }
});

router.get('/:id/chat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const rawLimit = Number.parseInt(String(req.query.limit ?? '50'), 10);
    const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [clan, membership] = await Promise.all([
      prisma.clan.findUnique({
        where: { id },
        select: { id: true },
      }),
      getClanMembership(id, userId),
    ]);

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    if (!membership) {
      return res.status(403).json({ error: 'Tu dois etre membre du clan pour acceder au chat.' });
    }

    const messages = await prisma.clanMessage.findMany({
      where: { clanId: id },
      include: {
        user: {
          select: clanLeaderSelect,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    res.json({
      messages: messages.reverse().map((message) => ({
        id: message.id,
        message: message.message,
        createdAt: message.createdAt,
        user: message.user,
      })),
    });
  } catch (error) {
    console.error('Get clan chat error:', error);
    res.status(500).json({ error: 'Failed to get clan chat' });
  }
});

router.post('/:id/chat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (message.length < 1 || message.length > 400) {
      return res.status(400).json({ error: 'Le message doit contenir entre 1 et 400 caracteres.' });
    }

    const [clan, membership] = await Promise.all([
      prisma.clan.findUnique({
        where: { id },
        select: { id: true },
      }),
      getClanMembership(id, userId),
    ]);

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    if (!membership) {
      return res.status(403).json({ error: 'Tu dois etre membre du clan pour ecrire dans ce chat.' });
    }

    const clanMembers = await prisma.clanMember.findMany({
      where: { clanId: id },
      select: {
        userId: true,
        user: {
          select: {
            username: true,
          },
        },
        clan: {
          select: {
            name: true,
          },
        },
      },
    });

    const createdMessage = await prisma.clanMessage.create({
      data: {
        clanId: id,
        userId,
        message,
      },
      include: {
        user: {
          select: clanLeaderSelect,
        },
      },
    });

    const messageCount = await prisma.clanMessage.count({
      where: { clanId: id },
    });

    if (messageCount > 200) {
      const oldMessages = await prisma.clanMessage.findMany({
        where: { clanId: id },
        orderBy: {
          createdAt: 'asc',
        },
        take: messageCount - 200,
        select: {
          id: true,
        },
      });

      if (oldMessages.length > 0) {
        await prisma.clanMessage.deleteMany({
          where: {
            id: {
              in: oldMessages.map((entry) => entry.id),
            },
          },
        });
      }
    }

    const sender = clanMembers.find((member) => member.userId === userId);
    const recipientIds = clanMembers
      .map((member) => member.userId)
      .filter((memberUserId) => memberUserId !== userId);

    if (sender && recipientIds.length > 0) {
      const preview = message.length > 120 ? `${message.slice(0, 117)}...` : message;

      Promise.all(
        recipientIds.map((recipientId) =>
          createNotification({
            userId: recipientId,
            type: 'CLAN_MESSAGE',
            title: `Nouveau message dans ${sender.clan.name}`,
            body: `${sender.user.username}: ${preview}`,
            data: {
              clanId: id,
              clanName: sender.clan.name,
              senderId: userId,
              senderUsername: sender.user.username,
              messageId: createdMessage.id,
            },
            link: '/clans',
            icon: 'message-square',
          })
        )
      ).catch(() => {});
    }

    res.status(201).json({
      message: {
        id: createdMessage.id,
        message: createdMessage.message,
        createdAt: createdMessage.createdAt,
        user: createdMessage.user,
      },
    });
  } catch (error) {
    console.error('Create clan chat message error:', error);
    res.status(500).json({ error: 'Failed to create clan chat message' });
  }
});

// Create a clan
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rawName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const imageUrl = typeof req.body.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
    const isPublic = req.body.isPublic !== false;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (rawName.length < 3 || rawName.length > 32) {
      return res.status(400).json({ error: 'Nom de clan invalide (3-32 caracteres).' });
    }

    if (description.length > 300) {
      return res.status(400).json({ error: 'Description trop longue (max 300 caracteres).' });
    }

    const clan = await prisma.$transaction(async (tx) => {
      const [user, existingMembership] = await Promise.all([
        tx.user.findUnique({
          where: { id: userId },
          select: { money: true },
        }),
        tx.clanMember.findUnique({
          where: { userId },
          select: { id: true },
        }),
      ]);

      if (!user) throw new Error('USER_NOT_FOUND');
      if (existingMembership) throw new Error('ALREADY_IN_CLAN');
      if (user.money < CLAN_CREATE_COST) throw new Error('INSUFFICIENT_FUNDS');

      const created = await tx.clan.create({
        data: {
          name: rawName,
          description: description || null,
          imageUrl: imageUrl || null,
          isPublic,
          maxMembers: CLAN_MAX_MEMBERS,
          ownerId: userId,
          members: {
            create: {
              userId,
              isLeader: true,
            },
          },
        },
        include: clanSummaryInclude,
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          money: { decrement: CLAN_CREATE_COST },
        },
      });

      return created;
    });

    res.json({ clan: mapClanSummary(clan) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'ALREADY_IN_CLAN') {
        return res.status(400).json({ error: 'Tu es deja dans un clan.' });
      }
      if (error.message === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: 'Pas assez d\'argent pour creer un clan.' });
      }
    }
    console.error('Create clan error:', error);
    res.status(500).json({ error: 'Failed to create clans' });
  }
});

// Join or request to join a clan
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const clan = await prisma.clan.findUnique({
      where: { id },
      select: {
        id: true,
        isPublic: true,
        maxMembers: true,
      },
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    const existingMembership = await prisma.clanMember.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'Tu es deja dans un clan.' });
    }

    const memberCount = await prisma.clanMember.count({
      where: { clanId: clan.id },
    });

    if (memberCount >= clan.maxMembers) {
      return res.status(400).json({ error: 'Ce clan est complet.' });
    }

    if (clan.isPublic) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.clanMember.create({
          data: {
            clanId: clan.id,
            userId,
            isLeader: false,
          },
        });

        await tx.clanJoinRequest.deleteMany({
          where: { clanId: clan.id, userId },
        });

        return { status: 'joined' as const };
      });

      return res.json(result);
    }

    const request = await prisma.clanJoinRequest.create({
      data: {
        clanId: clan.id,
        userId,
      },
    });

    const [clanDetail, requester] = await Promise.all([
      prisma.clan.findUnique({ where: { id }, select: { name: true, ownerId: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { username: true } }),
    ]);

    if (clanDetail && requester) {
      createNotification({
        userId: clanDetail.ownerId,
        type: 'CLAN_JOIN_REQUEST',
        title: 'Demande d\'adhesion',
        body: `${requester.username} souhaite rejoindre ${clanDetail.name}.`,
        data: { requesterId: userId, requesterUsername: requester.username, clanId: id, requestId: request.id },
        link: '/clans',
        icon: 'users',
      }).catch(() => {});
    }

    res.json({ status: 'requested', requestId: request.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Demande deja envoyee.' });
    }
    console.error('Join clan error:', error);
    res.status(500).json({ error: 'Failed to join clan' });
  }
});

// Declare a clan war
router.post('/:id/war/declare', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();

    const { id } = req.params;
    const userId = req.user?.id;
    const targetClanId = typeof req.body.targetClanId === 'string' ? req.body.targetClanId : '';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!targetClanId || targetClanId === id) {
      return res.status(400).json({ error: 'Choisis un clan adverse valide.' });
    }

    const [leaderMembership, attackerClan, defenderClan, attackerWar, defenderWar, attackerCooldown, defenderCooldown] = await Promise.all([
      prisma.clanMember.findUnique({
        where: {
          clanId_userId: {
            clanId: id,
            userId,
          },
        },
        select: {
          isLeader: true,
        },
      }),
      prisma.clan.findUnique({
        where: { id },
        include: clanSummaryInclude,
      }),
      prisma.clan.findUnique({
        where: { id: targetClanId },
        include: clanSummaryInclude,
      }),
      getCurrentWarForClan(id),
      getCurrentWarForClan(targetClanId),
      getClanCooldownEndsAt(id),
      getClanCooldownEndsAt(targetClanId),
    ]);

    if (!leaderMembership?.isLeader) {
      return res.status(403).json({ error: 'Seul le chef peut declarer une guerre.' });
    }

    if (!attackerClan || !defenderClan) {
      return res.status(404).json({ error: 'Clan introuvable.' });
    }

    if (attackerClan.members.length < CLAN_WAR_MIN_MEMBERS || defenderClan.members.length < CLAN_WAR_MIN_MEMBERS) {
      return res.status(400).json({
        error: `Chaque clan doit avoir au moins ${CLAN_WAR_MIN_MEMBERS} membres pour entrer en guerre.`,
      });
    }

    if (attackerWar || defenderWar) {
      return res.status(400).json({ error: 'Un des deux clans est deja engage dans une guerre.' });
    }

    if (attackerCooldown || defenderCooldown) {
      return res.status(400).json({ error: 'Un des deux clans est encore en période de récupération.' });
    }

    const now = new Date();
    const startsAt = addHours(now, CLAN_WAR_PREPARATION_HOURS);
    const endsAt = addHours(startsAt, CLAN_WAR_DURATION_HOURS);

    const war = await prisma.clanWar.create({
      data: {
        attackerClanId: id,
        defenderClanId: targetClanId,
        declaredByUserId: userId,
        status: 'PREPARING',
        startsAt,
        endsAt,
        targetScore: CLAN_WAR_TARGET_SCORE,
      },
      include: currentWarInclude,
    });

    createNotification({
      userId: defenderClan.owner.id,
      type: 'CLAN_WAR_DECLARED',
      title: 'Guerre declaree',
      body: `${attackerClan.name} a lance une guerre contre ${defenderClan.name}. La preparation commence maintenant.`,
      data: { warId: war.id, clanId: targetClanId },
      link: '/clans',
      icon: 'swords',
    }).catch(() => {});

    res.json({ war: await mapWar(war, id, userId) });
  } catch (error) {
    console.error('Declare clan war error:', error);
    res.status(500).json({ error: 'Failed to declare war' });
  }
});

// Fortify clan defenses
router.post('/:id/war/fortify', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();

    const { id } = req.params;
    const userId = req.user?.id;
    const rawDefenseType = typeof req.body.defenseType === 'string' ? req.body.defenseType.toUpperCase() : '';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isDefenseType(rawDefenseType)) {
      return res.status(400).json({ error: 'Type de defense invalide.' });
    }

    const [member, war] = await Promise.all([
      prisma.clanMember.findUnique({
        where: {
          clanId_userId: {
            clanId: id,
            userId,
          },
        },
        select: {
          userId: true,
        },
      }),
      getCurrentWarForClan(id),
    ]);

    if (!member) {
      return res.status(403).json({ error: 'Tu dois etre membre du clan pour fortifier.' });
    }

    if (!war) {
      return res.status(400).json({ error: 'Aucune guerre active ou en preparation pour ce clan.' });
    }

    if (!['PREPARING', 'ACTIVE'].includes(war.status)) {
      return res.status(400).json({ error: 'Cette guerre ne peut plus etre fortifiee.' });
    }

    const fortificationsUsed = await prisma.clanWarFortification.count({
      where: {
        warId: war.id,
        clanId: id,
        userId,
      },
    });

    if (fortificationsUsed >= CLAN_WAR_FORTIFICATIONS_PER_MEMBER) {
      return res.status(400).json({ error: 'Tu as deja utilise toutes tes fortifications pour cette guerre.' });
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.clanWarDefense.findUnique({
        where: {
          warId_clanId_type: {
            warId: war.id,
            clanId: id,
            type: rawDefenseType,
          },
        },
      });

      if (!existing) {
        const maxDurability = getDefenseMaxDurability(rawDefenseType, 1);
        const created = await tx.clanWarDefense.create({
          data: {
            warId: war.id,
            clanId: id,
            type: rawDefenseType,
            level: 1,
            durability: maxDurability,
            maxDurability,
          },
        });

        await tx.clanWarFortification.create({
          data: {
            warId: war.id,
            defenseId: created.id,
            clanId: id,
            userId,
            levelAdded: 1,
            durabilityAdded: maxDurability,
          },
        });

        return;
      }

      const canLevelUp = existing.level < 3;
      const newLevel = canLevelUp ? existing.level + 1 : existing.level;
      const newMaxDurability = getDefenseMaxDurability(rawDefenseType, newLevel);
      const repairedDurability = canLevelUp
        ? Math.min(newMaxDurability, existing.durability + 20 + newLevel * 6)
        : Math.min(existing.maxDurability, existing.durability + 28);
      const durabilityAdded = repairedDurability - existing.durability;

      const updated = await tx.clanWarDefense.update({
        where: { id: existing.id },
        data: {
          level: newLevel,
          maxDurability: newMaxDurability,
          durability: repairedDurability,
        },
      });

      await tx.clanWarFortification.create({
        data: {
          warId: war.id,
          defenseId: updated.id,
          clanId: id,
          userId,
          levelAdded: canLevelUp ? 1 : 0,
          durabilityAdded,
        },
      });
    });

    const refreshedWar = await getCurrentWarForClan(id);
    res.json({ war: refreshedWar ? await mapWar(refreshedWar, id, userId) : null });
  } catch (error) {
    console.error('Fortify clan war error:', error);
    res.status(500).json({ error: 'Failed to fortify clan defenses' });
  }
});

// Attack during an active clan war
router.post('/:id/war/attack', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();

    const { id } = req.params;
    const userId = req.user?.id;
    const rawAttackType = typeof req.body.attackType === 'string' ? req.body.attackType.toUpperCase() : '';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isAttackType(rawAttackType)) {
      return res.status(400).json({ error: 'Type d\'attaque invalide.' });
    }

    const [member, war] = await Promise.all([
      prisma.clanMember.findUnique({
        where: {
          clanId_userId: {
            clanId: id,
            userId,
          },
        },
        select: {
          userId: true,
        },
      }),
      getCurrentWarForClan(id),
    ]);

    if (!member) {
      return res.status(403).json({ error: 'Tu dois etre membre du clan pour attaquer.' });
    }

    if (!war || war.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'La guerre n\'est pas encore dans sa phase active.' });
    }

    const attack = attackConfig[rawAttackType];
    const staminaUsed = await prisma.clanWarAttack.aggregate({
      where: {
        warId: war.id,
        userId,
        createdAt: {
          gte: getRollingWindowStart(24),
        },
      },
      _sum: {
        staminaCost: true,
      },
    });

    const staminaSpent = staminaUsed._sum.staminaCost ?? 0;
    if (staminaSpent + attack.staminaCost > CLAN_WAR_STAMINA_PER_24H) {
      return res.status(400).json({ error: 'Tu n\'as plus assez d\'endurance pour cette attaque.' });
    }

    const attackerClanId = id;
    const defenderClanId = war.attackerClanId === id ? war.defenderClanId : war.attackerClanId;
    const attackerFortress = getClanDefenseLevel(war.defenses, defenderClanId, 'FORTRESS');
    const attackerArmory = getClanDefenseLevel(war.defenses, attackerClanId, 'ARMORY');
    const attackerBanner = getClanDefenseLevel(war.defenses, attackerClanId, 'BANNER');
    const ownScore = war.attackerClanId === id ? war.attackerScore : war.defenderScore;
    const enemyScore = war.attackerClanId === id ? war.defenderScore : war.attackerScore;
    const scoreGap = enemyScore - ownScore;
    const moraleBonus = attackerBanner * (scoreGap >= 15 ? 4 : 2);
    const basePoints = randomInt(attack.minPoints, attack.maxPoints);
    const bonusPoints = attackerArmory * 4 + moraleBonus;
    const defenseMitigation = Math.max(0, attackerFortress * 5 - (rawAttackType === 'SIEGE' ? 8 : rawAttackType === 'SABOTAGE' ? 4 : 0));
    const finalPoints = clamp(basePoints + bonusPoints - defenseMitigation, 6, 60);
    const structureDamage = attack.structureDamage + attackerArmory * 2 + (rawAttackType === 'SABOTAGE' ? attackerBanner * 3 : 0);
    const targetedDefense = selectDefenseTarget(rawAttackType, war.defenses, defenderClanId);

    await prisma.$transaction(async (tx) => {
      await tx.clanWarAttack.create({
        data: {
          warId: war.id,
          userId,
          clanId: attackerClanId,
          targetClanId: defenderClanId,
          attackType: rawAttackType,
          staminaCost: attack.staminaCost,
          basePoints,
          bonusPoints,
          defenseMitigation,
          structureDamage: targetedDefense ? structureDamage : 0,
          finalPoints,
        },
      });

      if (war.attackerClanId === attackerClanId) {
        await tx.clanWar.update({
          where: { id: war.id },
          data: {
            attackerScore: { increment: finalPoints },
          },
        });
      } else {
        await tx.clanWar.update({
          where: { id: war.id },
          data: {
            defenderScore: { increment: finalPoints },
          },
        });
      }

      if (targetedDefense) {
        await tx.clanWarDefense.update({
          where: { id: targetedDefense.id },
          data: {
            durability: Math.max(0, targetedDefense.durability - structureDamage),
          },
        });
      }
    });

    await advanceClanWarsState();

    const refreshedWar = await getCurrentWarForClan(id);
    if (!refreshedWar) {
      const completedWar = await prisma.clanWar.findUnique({
        where: { id: war.id },
        include: historyWarInclude,
      });
      return res.json({
        war: completedWar ? await mapWar(completedWar, id, userId) : null,
        completed: true,
      });
    }

    res.json({
      war: await mapWar(refreshedWar, id, userId),
      completed: false,
    });
  } catch (error) {
    console.error('Clan war attack error:', error);
    res.status(500).json({ error: 'Failed to attack in clan war' });
  }
});

// Accept a join request (leader only)
router.post('/:id/requests/:requestId/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, requestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leader = await prisma.clanMember.findFirst({
      where: {
        clanId: id,
        userId,
        isLeader: true,
      },
      select: { id: true },
    });

    if (!leader) {
      return res.status(403).json({ error: 'Seul le chef peut accepter.' });
    }

    const clan = await prisma.clan.findUnique({
      where: { id },
      select: { maxMembers: true, name: true },
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    const request = await prisma.clanJoinRequest.findUnique({
      where: { id: requestId },
      select: { id: true, clanId: true, userId: true },
    });

    if (!request || request.clanId !== id) {
      return res.status(404).json({ error: 'Demande introuvable.' });
    }

    await prisma.$transaction(async (tx) => {
      const memberCount = await tx.clanMember.count({
        where: { clanId: id },
      });
      if (memberCount >= clan.maxMembers) {
        throw new Error('CLAN_FULL');
      }

      await tx.clanMember.create({
        data: {
          clanId: id,
          userId: request.userId,
          isLeader: false,
        },
      });

      await tx.clanJoinRequest.delete({
        where: { id: request.id },
      });
    });

    createNotification({
      userId: request.userId,
      type: 'CLAN_JOIN_ACCEPTED',
      title: 'Demande acceptée',
      body: `Vous avez rejoint le clan ${clan.name}.`,
      data: { clanId: id, clanName: clan.name },
      link: '/clans',
      icon: 'users',
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'CLAN_FULL') {
      return res.status(400).json({ error: 'Ce clan est complet.' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Ce joueur est deja dans un clan.' });
    }
    console.error('Accept clan request error:', error);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Reject a join request (leader only)
router.post('/:id/requests/:requestId/reject', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, requestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leader = await prisma.clanMember.findFirst({
      where: {
        clanId: id,
        userId,
        isLeader: true,
      },
      select: { id: true },
    });

    if (!leader) {
      return res.status(403).json({ error: 'Seul le chef peut refuser.' });
    }

    const request = await prisma.clanJoinRequest.findUnique({
      where: { id: requestId },
      select: { id: true, clanId: true, userId: true },
    });

    if (!request || request.clanId !== id) {
      return res.status(404).json({ error: 'Demande introuvable.' });
    }

    await prisma.clanJoinRequest.delete({
      where: { id: request.id },
    });

    const clanInfo = await prisma.clan.findUnique({ where: { id }, select: { name: true } });
    if (clanInfo) {
      createNotification({
        userId: request.userId,
        type: 'CLAN_JOIN_REJECTED',
        title: 'Demande refusée',
        body: `Votre demande pour rejoindre ${clanInfo.name} a été refusée.`,
        data: { clanId: id, clanName: clanInfo.name },
        link: '/clans',
        icon: 'users',
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reject clan request error:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Leave a clan
router.delete('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    let promotedLeaderUserId: string | null = null;
    let promotedClanName: string | null = null;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const member = await prisma.clanMember.findUnique({
      where: {
        clanId_userId: {
          clanId: id,
          userId,
        },
      },
      select: {
        id: true,
        isLeader: true,
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Tu n\'es pas membre de ce clan.' });
    }

    await prisma.$transaction(async (tx) => {
      if (member.isLeader) {
        const remainingMembers = await tx.clanMember.findMany({
          where: {
            clanId: id,
            userId: { not: userId },
          },
          include: {
            user: {
              select: {
                aura: true,
              },
            },
          },
          orderBy: {
            user: { aura: 'desc' },
          },
        });

        if (remainingMembers.length > 0) {
          const newLeader = remainingMembers[0];
          promotedLeaderUserId = newLeader.userId;
          await tx.clanMember.update({
            where: { id: newLeader.id },
            data: { isLeader: true },
          });
          await tx.clan.update({
            where: { id },
            data: { ownerId: newLeader.userId },
          });
          const clan = await tx.clan.findUnique({
            where: { id },
            select: { name: true },
          });
          promotedClanName = clan?.name ?? null;
        } else {
          await tx.clan.delete({
            where: { id },
          });
          return;
        }
      }

      await tx.clanMember.delete({
        where: { id: member.id },
      });
    });

    if (promotedLeaderUserId) {
      createNotification({
        userId: promotedLeaderUserId,
        type: 'SYSTEM',
        title: 'Nouveau chef de clan',
        body: promotedClanName
          ? `Tu es maintenant le chef du clan ${promotedClanName}.`
          : 'Tu es maintenant le chef de ton clan.',
        data: {
          clanId: id,
          clanName: promotedClanName,
        },
        link: '/clans',
        icon: 'crown',
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Leave clan error:', error);
    res.status(500).json({ error: 'Failed to leave clan' });
  }
});

// Remove a member from the clan (leader only)
router.delete('/:id/members/:targetUserId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, targetUserId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leader = await prisma.clanMember.findFirst({
      where: {
        clanId: id,
        userId,
        isLeader: true,
      },
      select: { id: true },
    });

    if (!leader) {
      return res.status(403).json({ error: 'Seul le chef peut retirer des membres.' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Tu ne peux pas te retirer toi-meme. Quitte le clan a la place.' });
    }

    const [clanInfo, targetUser] = await Promise.all([
      prisma.clan.findUnique({ where: { id }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: targetUserId }, select: { username: true } }),
    ]);

    const member = await prisma.clanMember.findUnique({
      where: {
        clanId_userId: {
          clanId: id,
          userId: targetUserId,
        },
      },
      select: { id: true },
    });

    if (!member) {
      return res.status(404).json({ error: 'Membre introuvable dans ce clan.' });
    }

    await prisma.clanMember.delete({
      where: { id: member.id },
    });

    createNotification({
      userId: targetUserId,
      type: 'SYSTEM',
      title: 'Retire du clan',
      body: clanInfo?.name
        ? `Tu as été retiré du clan ${clanInfo.name}.`
        : 'Tu as été retiré de ton clan.',
      data: {
        clanId: id,
        clanName: clanInfo?.name ?? null,
        removedByUserId: userId,
        removedUserUsername: targetUser?.username ?? null,
      },
      link: '/clans',
      icon: 'shield-x',
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Remove clan member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Update clan tag text and style (leader only, requires tagUnlocked)
router.put('/:id/tag', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const membership = await getClanMembership(id, userId);
    if (!membership) return res.status(403).json({ error: 'Not a member' });
    if (!membership.isLeader) return res.status(403).json({ error: 'Seul le chef peut modifier le tag.' });

    const clan = await prisma.clan.findUnique({ where: { id }, select: { tagUnlocked: true } });
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    if (!clan.tagUnlocked) return res.status(400).json({ error: 'Tag non débloqué pour ce clan.' });

    const { tagText, tagStyle } = req.body;

    if (tagText !== undefined) {
      const text = typeof tagText === 'string' ? tagText.trim() : '';
      if (text.length < 1 || text.length > 6) {
        return res.status(400).json({ error: 'Le tag doit contenir entre 1 et 6 caractères.' });
      }
    }

    const updated = await prisma.clan.update({
      where: { id },
      data: {
        tagText: tagText !== undefined ? (tagText as string).trim() : undefined,
        tagStyle: tagStyle !== undefined ? JSON.stringify(tagStyle) : undefined,
      },
    });

    res.json({ success: true, tagText: updated.tagText, tagStyle: updated.tagStyle });
  } catch (error) {
    console.error('Update clan tag error:', error);
    res.status(500).json({ error: 'Failed to update clan tag' });
  }
});

export default router;
