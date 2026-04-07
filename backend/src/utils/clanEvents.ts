import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../server.js';
import { createNotification } from './notifications.js';
import { logEconomy } from './logger.js';

export const CLAN_EVENT_ACTIVITY_TYPES = [
  'PLAY_ANY_GAME',
  'WIN_ANY_GAME',
  'CLAN_CHAT_MESSAGE',
  'CLAN_BANK_DEPOSIT',
  'CLAN_WAR_ATTACK',
  'CLAN_WAR_SUPPORT',
  'EVENT_MINIGAME_PLAY',
  'EVENT_MINIGAME_POINTS',
] as const;

export const CLAN_EVENT_MINI_GAME_TYPES = [
  'REFLEX',
  'TAP_FRENZY',
] as const;

export type ClanEventActivityType = typeof CLAN_EVENT_ACTIVITY_TYPES[number];
export type ClanEventMiniGameType = typeof CLAN_EVENT_MINI_GAME_TYPES[number];

export const clanEventAdminInclude = Prisma.validator<Prisma.ClanEventInclude>()({
  createdBy: {
    select: {
      id: true,
      username: true,
      usernameColor: true,
      profilePicture: true,
    },
  },
  quests: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  miniGames: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  rewardTiers: {
    include: {
      item: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
    },
    orderBy: [{ minRank: 'asc' }, { createdAt: 'asc' }],
  },
  clanScores: {
    include: {
      clan: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
    },
    orderBy: [{ totalPoints: 'desc' }, { updatedAt: 'asc' }],
  },
});

const ACTIVE_EVENT_STATUSES = new Set(['SCHEDULED', 'ACTIVE']);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toIso = (value: Date | null | undefined) => value ? value.toISOString() : null;

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const minimalClanSelect = {
  id: true,
  name: true,
  imageUrl: true,
  warTrophies: true,
  members: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.ClanSelect;

export const buildClanEventSlug = (title: string) =>
  title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || `event-${Date.now()}`;

export const getClanEventRuntimeStatus = (event: {
  status: string;
  startsAt: Date;
  endsAt: Date;
}) => {
  if (event.status === 'DRAFT' || event.status === 'CANCELLED') {
    return event.status;
  }

  const now = Date.now();
  const startsAt = event.startsAt.getTime();
  const endsAt = event.endsAt.getTime();

  if (now < startsAt) return 'SCHEDULED';
  if (now >= endsAt) return 'COMPLETED';
  return 'ACTIVE';
};

const serializeClanScoreEntry = (entry: {
  rank: number | null;
  totalPoints: number;
  clan: {
    id: string;
    name: string;
    imageUrl: string | null;
    warTrophies?: number;
    level?: number;
    members?: Array<{ id: string }>;
  };
}) => ({
  rank: entry.rank,
  totalPoints: entry.totalPoints,
  clan: {
    id: entry.clan.id,
    name: entry.clan.name,
    imageUrl: entry.clan.imageUrl,
    warTrophies: entry.clan.warTrophies ?? 0,
    memberCount: entry.clan.members?.length ?? 0,
  },
});

export const serializeClanEventAdmin = (
  event: Prisma.ClanEventGetPayload<{ include: typeof clanEventAdminInclude }>
) => ({
  id: event.id,
  title: event.title,
  slug: event.slug,
  description: event.description,
  bannerUrl: event.bannerUrl,
  status: getClanEventRuntimeStatus(event),
  storedStatus: event.status,
  highlightColor: event.highlightColor,
  rulesSummary: event.rulesSummary,
  startsAt: event.startsAt.toISOString(),
  endsAt: event.endsAt.toISOString(),
  finalizedAt: toIso(event.finalizedAt),
  rewardsDistributedAt: toIso(event.rewardsDistributedAt),
  createdAt: event.createdAt.toISOString(),
  updatedAt: event.updatedAt.toISOString(),
  createdBy: event.createdBy,
  quests: event.quests.map((quest) => ({
    id: quest.id,
    title: quest.title,
    description: quest.description,
    activityType: quest.activityType,
    targetValue: quest.targetValue,
    pointsReward: quest.pointsReward,
    sortOrder: quest.sortOrder,
    isActive: quest.isActive,
    createdAt: quest.createdAt.toISOString(),
    updatedAt: quest.updatedAt.toISOString(),
  })),
  miniGames: event.miniGames.map((miniGame) => ({
    id: miniGame.id,
    title: miniGame.title,
    description: miniGame.description,
    type: miniGame.type,
    instructions: miniGame.instructions,
    scoreMultiplier: miniGame.scoreMultiplier,
    flatPointsBonus: miniGame.flatPointsBonus,
    maxPointsPerAttempt: miniGame.maxPointsPerAttempt,
    maxAttemptsPerUser: miniGame.maxAttemptsPerUser,
    cooldownMinutes: miniGame.cooldownMinutes,
    sortOrder: miniGame.sortOrder,
    isActive: miniGame.isActive,
    config: parseJson<Record<string, unknown> | null>(miniGame.configJson, null),
    createdAt: miniGame.createdAt.toISOString(),
    updatedAt: miniGame.updatedAt.toISOString(),
  })),
  rewardTiers: event.rewardTiers.map((tier) => ({
    id: tier.id,
    title: tier.title,
    minRank: tier.minRank,
    maxRank: tier.maxRank,
    moneyReward: tier.moneyReward,
    auraReward: tier.auraReward,
    item: tier.item,
    itemId: tier.itemId,
    createdAt: tier.createdAt.toISOString(),
    updatedAt: tier.updatedAt.toISOString(),
  })),
  leaderboard: event.clanScores.map(serializeClanScoreEntry),
});

async function awardClanEventPointsTx(
  tx: Prisma.TransactionClient,
  input: {
    eventId: string;
    clanId: string;
    userId?: string | null;
    points: number;
    sourceType: string;
    label: string;
    sourceId?: string | null;
    metadata?: Record<string, unknown> | null;
  }
) {
  const points = Math.max(0, Math.floor(input.points));
  if (points <= 0) {
    return null;
  }

  const score = await tx.clanEventClanScore.upsert({
    where: {
      eventId_clanId: {
        eventId: input.eventId,
        clanId: input.clanId,
      },
    },
    create: {
      eventId: input.eventId,
      clanId: input.clanId,
      totalPoints: points,
    },
    update: {
      totalPoints: { increment: points },
    },
    include: {
      clan: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          warTrophies: true,
          members: { select: { id: true } },
        },
      },
    },
  });

  await tx.clanEventActivity.create({
    data: {
      eventId: input.eventId,
      clanId: input.clanId,
      userId: input.userId ?? null,
      sourceType: input.sourceType,
      label: input.label,
      points,
      sourceId: input.sourceId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });

  return score;
}

const rankClanScores = async (tx: Prisma.TransactionClient, eventId: string) => {
  const scores = await tx.clanEventClanScore.findMany({
    where: { eventId },
    orderBy: [
      { totalPoints: 'desc' },
      { updatedAt: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  for (let index = 0; index < scores.length; index += 1) {
    await tx.clanEventClanScore.update({
      where: { id: scores[index].id },
      data: { rank: index + 1 },
    });
  }
};

export async function finalizeClanEvent(eventId: string) {
  const event = await prisma.clanEvent.findUnique({
    where: { id: eventId },
    include: {
      rewardTiers: {
        include: {
          item: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ minRank: 'asc' }, { createdAt: 'asc' }],
      },
      clanScores: {
        include: {
          clan: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { totalPoints: 'desc' },
          { updatedAt: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
  });

  if (!event || event.rewardsDistributedAt) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.clanEvent.update({
      where: { id: event.id },
      data: {
        status: 'COMPLETED',
        finalizedAt: new Date(),
      },
    });

    const rankedScores = [...event.clanScores]
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return a.clan.name.localeCompare(b.clan.name, 'fr');
      });

    for (let index = 0; index < rankedScores.length; index += 1) {
      const entry = rankedScores[index];
      const rank = index + 1;

      await tx.clanEventClanScore.update({
        where: { id: entry.id },
        data: { rank },
      });

      const rewardTier = event.rewardTiers.find((tier) => rank >= tier.minRank && rank <= tier.maxRank) ?? null;
      if (!rewardTier) {
        continue;
      }

      for (const member of entry.clan.members) {
        await tx.user.update({
          where: { id: member.userId },
          data: {
            money: { increment: rewardTier.moneyReward },
            aura: { increment: BigInt(rewardTier.auraReward) },
          },
        });

        if (rewardTier.itemId) {
          await tx.userItem.upsert({
            where: {
              userId_itemId: {
                userId: member.userId,
                itemId: rewardTier.itemId,
              },
            },
            create: {
              userId: member.userId,
              itemId: rewardTier.itemId,
              quantity: 1,
            },
            update: {
              quantity: { increment: 1 },
            },
          });
        }
      }
    }

    await tx.clanEvent.update({
      where: { id: event.id },
      data: {
        rewardsDistributedAt: new Date(),
      },
    });
  });

  for (let index = 0; index < event.clanScores.length; index += 1) {
    const entry = [...event.clanScores]
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return a.clan.name.localeCompare(b.clan.name, 'fr');
      })[index];

    const rank = index + 1;
    const rewardTier = event.rewardTiers.find((tier) => rank >= tier.minRank && rank <= tier.maxRank) ?? null;
    if (!rewardTier) continue;

    for (const member of entry.clan.members) {
      createNotification({
        userId: member.userId,
        type: 'SYSTEM',
        title: 'Récompense d’événement de clan',
        body: `${entry.clan.name} termine #${rank} sur ${event.title}. Récompense: ${rewardTier.moneyReward} money, ${rewardTier.auraReward} aura${rewardTier.item ? ` et ${rewardTier.item.name}` : ''}.`,
        data: {
          eventId: event.id,
          eventTitle: event.title,
          clanId: entry.clan.id,
          clanName: entry.clan.name,
          rank,
          moneyReward: rewardTier.moneyReward,
          auraReward: rewardTier.auraReward,
          itemId: rewardTier.itemId,
          itemName: rewardTier.item?.name ?? null,
        },
        link: '/clans',
        icon: 'trophy',
      }).catch(() => {});

      logEconomy('pass_reward', member.userId, member.user.username, undefined, undefined, {
        source: 'clan_event_reward',
        eventId: event.id,
        eventTitle: event.title,
        clanId: entry.clan.id,
        clanName: entry.clan.name,
        rank,
        moneyReward: rewardTier.moneyReward,
        auraReward: rewardTier.auraReward,
        itemId: rewardTier.itemId,
      });
    }
  }
}

export async function advanceClanEventsState() {
  const now = new Date();
  const toActivate = await prisma.clanEvent.findMany({
    where: {
      status: 'SCHEDULED',
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    select: { id: true },
  });

  if (toActivate.length > 0) {
    await prisma.clanEvent.updateMany({
      where: {
        id: {
          in: toActivate.map((event) => event.id),
        },
      },
      data: {
        status: 'ACTIVE',
      },
    });
  }

  const toFinalize = await prisma.clanEvent.findMany({
    where: {
      status: {
        in: ['SCHEDULED', 'ACTIVE'],
      },
      endsAt: {
        lte: now,
      },
    },
    select: { id: true },
  });

  for (const event of toFinalize) {
    await finalizeClanEvent(event.id);
  }
}

export async function trackClanEventActivity(
  userId: string,
  activityType: ClanEventActivityType,
  value = 1,
  metadata?: Record<string, unknown>
) {
  if (value <= 0) return;

  const membership = await prisma.clanMember.findUnique({
    where: { userId },
    select: {
      clanId: true,
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

  if (!membership) {
    return;
  }

  const now = new Date();
  const events = await prisma.clanEvent.findMany({
    where: {
      status: {
        in: ['SCHEDULED', 'ACTIVE'],
      },
      startsAt: { lte: now },
      endsAt: { gt: now },
      quests: {
        some: {
          isActive: true,
          activityType,
        },
      },
    },
    include: {
      quests: {
        where: {
          isActive: true,
          activityType,
        },
      },
    },
  });

  for (const event of events) {
    for (const quest of event.quests) {
      const existing = await prisma.clanEventQuestProgress.findUnique({
        where: {
          questId_userId: {
            questId: quest.id,
            userId,
          },
        },
      });

      if (existing?.completedAt) {
        continue;
      }

      const nextValue = (existing?.currentValue ?? 0) + value;

      await prisma.clanEventQuestProgress.upsert({
        where: {
          questId_userId: {
            questId: quest.id,
            userId,
          },
        },
        create: {
          questId: quest.id,
          userId,
          clanId: membership.clanId,
          currentValue: nextValue,
          completedAt: nextValue >= quest.targetValue ? now : null,
        },
        update: {
          clanId: membership.clanId,
          currentValue: nextValue,
          completedAt: nextValue >= quest.targetValue ? now : null,
        },
      });

      if (nextValue < quest.targetValue) {
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await awardClanEventPointsTx(tx, {
          eventId: event.id,
          clanId: membership.clanId,
          userId,
          points: quest.pointsReward,
          sourceType: 'QUEST_COMPLETION',
          label: `${membership.user.username} a terminé la quête ${quest.title}`,
          sourceId: quest.id,
          metadata: {
            activityType,
            progressValue: nextValue,
            targetValue: quest.targetValue,
            ...metadata,
          },
        });

        await rankClanScores(tx, event.id);
      });

      createNotification({
        userId,
        type: 'SYSTEM',
        title: 'Quête d’événement terminée',
        body: `${quest.title} rapporte ${quest.pointsReward} points à ${membership.clan.name}.`,
        data: {
          eventId: event.id,
          questId: quest.id,
          clanId: membership.clanId,
          pointsReward: quest.pointsReward,
        },
        link: '/clans',
        icon: 'target',
      }).catch(() => {});
    }
  }
}

export async function submitClanEventMiniGame(input: {
  eventId: string;
  miniGameId: string;
  userId: string;
  rawScore: number;
}) {
  const membership = await prisma.clanMember.findUnique({
    where: { userId: input.userId },
    select: {
      clanId: true,
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

  if (!membership) {
    throw new Error('Vous devez être dans un clan pour participer.');
  }

  const miniGame = await prisma.clanEventMiniGame.findFirst({
    where: {
      id: input.miniGameId,
      eventId: input.eventId,
      isActive: true,
    },
    include: {
      event: true,
    },
  });

  if (!miniGame) {
    throw new Error('Mini-jeu introuvable.');
  }

  if (getClanEventRuntimeStatus(miniGame.event) !== 'ACTIVE') {
    throw new Error('Cet événement n’est pas actif.');
  }

  const attempts = await prisma.clanEventMiniGameAttempt.findMany({
    where: {
      miniGameId: miniGame.id,
      userId: input.userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: Math.max(1, miniGame.maxAttemptsPerUser ?? 1),
  });

  if (miniGame.maxAttemptsPerUser && attempts.length >= miniGame.maxAttemptsPerUser) {
    throw new Error('Nombre maximal de tentatives atteint pour ce mini-jeu.');
  }

  const lastAttempt = attempts[0] ?? null;
  if (lastAttempt && miniGame.cooldownMinutes > 0) {
    const nextAllowedAt = new Date(lastAttempt.createdAt.getTime() + miniGame.cooldownMinutes * 60_000);
    if (nextAllowedAt.getTime() > Date.now()) {
      throw new Error('Ce mini-jeu est encore en recharge.');
    }
  }

  const rawScore = Math.max(0, Math.floor(input.rawScore));
  const pointsAwarded = clamp(
    Math.floor(rawScore * miniGame.scoreMultiplier) + miniGame.flatPointsBonus,
    0,
    Math.max(0, miniGame.maxPointsPerAttempt)
  );

  await prisma.$transaction(async (tx) => {
    await tx.clanEventMiniGameAttempt.create({
      data: {
        eventId: miniGame.eventId,
        miniGameId: miniGame.id,
        userId: input.userId,
        clanId: membership.clanId,
        rawScore,
        pointsAwarded,
      },
    });

    await awardClanEventPointsTx(tx, {
      eventId: miniGame.eventId,
      clanId: membership.clanId,
      userId: input.userId,
      points: pointsAwarded,
      sourceType: 'MINIGAME_ATTEMPT',
      label: `${membership.user.username} a joué à ${miniGame.title}`,
      sourceId: miniGame.id,
      metadata: {
        rawScore,
        miniGameType: miniGame.type,
      },
    });

    await rankClanScores(tx, miniGame.eventId);
  });

  await trackClanEventActivity(input.userId, 'EVENT_MINIGAME_PLAY', 1, {
    eventId: miniGame.eventId,
    miniGameId: miniGame.id,
    miniGameType: miniGame.type,
  });

  if (pointsAwarded > 0) {
    await trackClanEventActivity(input.userId, 'EVENT_MINIGAME_POINTS', pointsAwarded, {
      eventId: miniGame.eventId,
      miniGameId: miniGame.id,
      miniGameType: miniGame.type,
    });
  }

  const nextAvailableAt = miniGame.cooldownMinutes > 0
    ? new Date(Date.now() + miniGame.cooldownMinutes * 60_000)
    : null;

  return {
    rawScore,
    pointsAwarded,
    attemptsUsed: attempts.length + 1,
    maxAttemptsPerUser: miniGame.maxAttemptsPerUser,
    nextAvailableAt,
  };
}

export async function getFeaturedClanEvent(selectedClanId: string | null, viewerUserId: string | null) {
  await advanceClanEventsState();

  const event = await prisma.clanEvent.findFirst({
    where: {
      status: {
        in: ['SCHEDULED', 'ACTIVE', 'COMPLETED'],
      },
    },
    orderBy: [
      { endsAt: 'desc' },
      { startsAt: 'desc' },
    ],
    include: {
      quests: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      miniGames: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      rewardTiers: {
        include: {
          item: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
        orderBy: [{ minRank: 'asc' }, { createdAt: 'asc' }],
      },
      clanScores: {
        include: {
          clan: {
            select: minimalClanSelect,
          },
        },
        orderBy: [
          { totalPoints: 'desc' },
          { updatedAt: 'asc' },
          { createdAt: 'asc' },
        ],
      },
      activities: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              usernameColor: true,
              profilePicture: true,
            },
          },
          clan: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      },
    },
  });

  if (!event) {
    return null;
  }

  const runtimeStatus = getClanEventRuntimeStatus(event);
  const viewerMembership = viewerUserId
    ? await prisma.clanMember.findUnique({
        where: { userId: viewerUserId },
        select: { clanId: true },
      })
    : null;
  const viewerClanId = viewerMembership?.clanId ?? null;

  const questProgressMap = new Map<string, Prisma.ClanEventQuestProgressGetPayload<{}>>();
  if (viewerUserId && viewerClanId) {
    const progresses = await prisma.clanEventQuestProgress.findMany({
      where: {
        userId: viewerUserId,
        quest: {
          eventId: event.id,
        },
      },
    });
    for (const progress of progresses) {
      questProgressMap.set(progress.questId, progress);
    }
  }

  const viewerMiniGameAttempts = viewerUserId
    ? await prisma.clanEventMiniGameAttempt.findMany({
        where: {
          eventId: event.id,
          userId: viewerUserId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    : [];

  const attemptsByMiniGame = new Map<string, typeof viewerMiniGameAttempts>();
  for (const attempt of viewerMiniGameAttempts) {
    const current = attemptsByMiniGame.get(attempt.miniGameId) ?? [];
    current.push(attempt);
    attemptsByMiniGame.set(attempt.miniGameId, current);
  }

  const leaderboard = event.clanScores.map((entry, index) => ({
    rank: entry.rank ?? index + 1,
    totalPoints: entry.totalPoints,
    clan: {
      id: entry.clan.id,
      name: entry.clan.name,
      imageUrl: entry.clan.imageUrl,
      warTrophies: entry.clan.warTrophies,
      memberCount: entry.clan.members.length,
    },
  }));

  const selectedClanEntry = selectedClanId
    ? leaderboard.find((entry) => entry.clan.id === selectedClanId) ?? null
    : null;
  const viewerClanEntry = viewerClanId
    ? leaderboard.find((entry) => entry.clan.id === viewerClanId) ?? null
    : null;

  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    description: event.description,
    bannerUrl: event.bannerUrl,
    status: runtimeStatus,
    highlightColor: event.highlightColor,
    rulesSummary: event.rulesSummary,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    finalizedAt: toIso(event.finalizedAt),
    rewardsDistributedAt: toIso(event.rewardsDistributedAt),
    canParticipate: runtimeStatus === 'ACTIVE' && Boolean(viewerClanId && selectedClanId && viewerClanId === selectedClanId),
    selectedClanEntry,
    viewerClanEntry,
    leaderboard: leaderboard.slice(0, 10),
    rewardTiers: event.rewardTiers.map((tier) => ({
      id: tier.id,
      title: tier.title,
      minRank: tier.minRank,
      maxRank: tier.maxRank,
      moneyReward: tier.moneyReward,
      auraReward: tier.auraReward,
      item: tier.item,
    })),
    quests: event.quests.map((quest) => {
      const progress = questProgressMap.get(quest.id) ?? null;
      return {
        id: quest.id,
        title: quest.title,
        description: quest.description,
        activityType: quest.activityType,
        targetValue: quest.targetValue,
        pointsReward: quest.pointsReward,
        sortOrder: quest.sortOrder,
        progress: progress
          ? {
              currentValue: progress.currentValue,
              completedAt: toIso(progress.completedAt),
              isCompleted: Boolean(progress.completedAt),
            }
          : {
              currentValue: 0,
              completedAt: null,
              isCompleted: false,
            },
      };
    }),
    miniGames: event.miniGames.map((miniGame) => {
      const attempts = attemptsByMiniGame.get(miniGame.id) ?? [];
      const lastAttempt = attempts[0] ?? null;
      const nextAvailableAt = lastAttempt && miniGame.cooldownMinutes > 0
        ? new Date(lastAttempt.createdAt.getTime() + miniGame.cooldownMinutes * 60_000)
        : null;
      const bestScore = attempts.reduce((best, attempt) => Math.max(best, attempt.rawScore), 0);

      return {
        id: miniGame.id,
        title: miniGame.title,
        description: miniGame.description,
        type: miniGame.type,
        instructions: miniGame.instructions,
        scoreMultiplier: miniGame.scoreMultiplier,
        flatPointsBonus: miniGame.flatPointsBonus,
        maxPointsPerAttempt: miniGame.maxPointsPerAttempt,
        maxAttemptsPerUser: miniGame.maxAttemptsPerUser,
        cooldownMinutes: miniGame.cooldownMinutes,
        config: parseJson<Record<string, unknown> | null>(miniGame.configJson, null),
        viewerStats: {
          attemptsUsed: attempts.length,
          bestScore,
          lastPlayedAt: toIso(lastAttempt?.createdAt),
          nextAvailableAt: nextAvailableAt ? nextAvailableAt.toISOString() : null,
        },
      };
    }),
    recentActivity: event.activities.map((activity) => ({
      id: activity.id,
      sourceType: activity.sourceType,
      label: activity.label,
      points: activity.points,
      createdAt: activity.createdAt.toISOString(),
      clan: activity.clan,
      user: activity.user,
      metadata: parseJson<Record<string, unknown> | null>(activity.metadata, null),
    })),
  };
}
