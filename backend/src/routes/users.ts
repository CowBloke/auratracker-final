import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import {
  SOCIAL_USER_SELECT,
  getFriendIds,
  getRelationshipWithViewer,
  getUserSocialStats,
} from '../utils/social.js';
import { getParisDayKey, getParisDayStart } from '../utils/dailyAura.js';

const router = Router();
const ANNOUNCEMENT_KEY = 'topbar_announcement';
const SURVEY_AUDIENCE_TYPES = ['ALL_USERS', 'BETA_TESTERS', 'ADMINS', 'SELECTED_USERS'] as const;
type SurveyAudienceType = typeof SURVEY_AUDIENCE_TYPES[number];

const buildSurveyAudienceEligibility = (user: {
  id: string;
  isApproved?: boolean;
  isBetaTester?: boolean;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}) => ({
  ALL_USERS: Boolean(user.isApproved ?? true),
  BETA_TESTERS: Boolean(user.isApproved ?? true) && Boolean(user.isBetaTester),
  ADMINS: Boolean(user.isApproved ?? true) && Boolean(user.isAdmin || user.isSuperAdmin),
});

const serializePendingSurvey = (survey: {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  popupDelaySeconds: number;
  createdAt: Date;
  options: Array<{
    id: string;
    label: string;
    color: string;
    imageUrl: string | null;
    sortOrder: number;
  }>;
}) => ({
  id: survey.id,
  title: survey.title,
  description: survey.description,
  imageUrl: survey.imageUrl,
  popupDelaySeconds: survey.popupDelaySeconds,
  createdAt: survey.createdAt.toISOString(),
  options: survey.options
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((option) => ({
      id: option.id,
      label: option.label,
      color: option.color,
      imageUrl: option.imageUrl,
    })),
});

const toNumericValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const parseLogMetadata = (raw: string | null): Record<string, unknown> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

const extractEconomyDeltaForUser = (
  log: { type: string; action: string; userId: string | null; targetId: string | null; metadata: string | null },
  userId: string,
) => {
  const metadata = parseLogMetadata(log.metadata);
  let auraDelta = 0;
  let moneyDelta = 0;

  if (log.type === 'GAME' && log.userId === userId) {
    if (log.action === 'game_complete') {
      auraDelta += toNumericValue(metadata.auraReward);
      moneyDelta += toNumericValue(metadata.moneyReward);
    } else if (log.action === 'casino_start') {
      moneyDelta -= toNumericValue(metadata.bet);
    }
  }

  if (log.type === 'ECONOMY') {
    if ((log.action === 'quest_reward' || log.action === 'pass_reward') && log.userId === userId) {
      auraDelta += toNumericValue(metadata.auraReward);
      moneyDelta += toNumericValue(metadata.moneyReward);
    }

    if (log.action === 'transfer' && log.targetId === userId) {
      auraDelta += toNumericValue(metadata.auraAmount);
    }

    if (log.action === 'balance_change' && log.userId === userId) {
      auraDelta += toNumericValue(metadata.auraDelta ?? metadata.deltaAura);
      moneyDelta += toNumericValue(metadata.moneyDelta ?? metadata.deltaMoney);
    }
  }

  if (log.type === 'AURACOIN' && log.userId === userId) {
    if (log.action === 'auracoin_buy') {
      moneyDelta -= toNumericValue(metadata.moneySpent);
    } else if (log.action === 'auracoin_sell') {
      moneyDelta += toNumericValue(metadata.moneyReceived);
    }
  }

  return {
    auraDelta,
    moneyDelta,
  };
};

// Get all users (for the 40-user community)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const [users, outgoing, incoming] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          firstName: true,
          schoolLevel: true,
          classLetter: true,
          aura: true,
          money: true,
          auraCoinBalance: true,
          usernameColor: true,
          profilePicture: true,
          profileBanner: true,
          bio: true,
          createdAt: true,
          _count: {
            select: {
              followers: true,
              following: true,
            },
          },
        },
        orderBy: {
          aura: 'desc',
        },
      }),
      prisma.userFollow.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true },
      }),
      prisma.userFollow.findMany({
        where: { followingId: currentUserId },
        select: { followerId: true },
      }),
    ]);

    const followingIds = new Set(outgoing.map((entry) => entry.followingId));
    const followerIds = new Set(incoming.map((entry) => entry.followerId));

    const sortedUsers = [...users].sort((a, b) => {
      const aIsConnection = followingIds.has(a.id) && followerIds.has(a.id);
      const bIsConnection = followingIds.has(b.id) && followerIds.has(b.id);
      if (aIsConnection !== bIsConnection) return aIsConnection ? -1 : 1;

      const aIsFollowing = followingIds.has(a.id);
      const bIsFollowing = followingIds.has(b.id);
      if (aIsFollowing !== bIsFollowing) return aIsFollowing ? -1 : 1;

      return Number(b.aura) - Number(a.aura);
    });
    
    res.json({
      users: sortedUsers.map((user) => {
        const isFollowing = followingIds.has(user.id);
        const isFollowedBy = followerIds.has(user.id);

        return {
          ...user,
          social: {
            isFollowing,
            isFollowedBy,
            isConnection: isFollowing && isFollowedBy,
            followerCount: user._count.followers,
            followingCount: user._count.following,
          },
        };
      }),
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/social/overview', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friendIds = await getFriendIds(userId);

    const friends = await prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: {
        ...SOCIAL_USER_SELECT,
        _count: {
          select: {
            followers: true,
            following: true,
          },
        },
      },
      orderBy: { username: 'asc' },
    });

    const stats = await getUserSocialStats(userId);

    res.json({
      stats,
      friends: friends.map((friend) => ({
        ...friend,
        createdAt: friend.createdAt.toISOString(),
        social: {
          isFollowing: true,
          isFollowedBy: true,
          isConnection: true,
          followerCount: friend._count.followers,
          followingCount: friend._count.following,
        },
      })),
    });
  } catch (error) {
    console.error('Get social overview error:', error);
    res.status(500).json({ error: 'Failed to get social overview' });
  }
});

router.post('/social/follow/:targetUserId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const followerId = req.user!.id;
    const { targetUserId } = req.params;

    if (followerId === targetUserId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, isApproved: true },
    });

    if (!target?.isApproved) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.userFollow.upsert({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetUserId,
        },
      },
      create: {
        followerId,
        followingId: targetUserId,
      },
      update: {},
    });

    const relationship = await getRelationshipWithViewer(followerId, targetUserId);
    const stats = await getUserSocialStats(targetUserId);

    if (relationship.isConnection) {
      await createNotification({
        userId: targetUserId,
        type: 'SOCIAL_CONNECTION',
        title: 'Nouvelle connexion',
        body: `${req.user!.username} fait maintenant partie de tes connexions.`,
        link: `/profile/${followerId}`,
        icon: 'users',
      });
    } else {
      await createNotification({
        userId: targetUserId,
        type: 'SOCIAL_FOLLOW',
        title: 'Nouveau follow',
        body: `${req.user!.username} suit maintenant ton profil.`,
        link: `/profile/${followerId}`,
        icon: 'user-round-pen',
      });
    }

    res.json({
      relationship,
      stats,
    });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

router.delete('/social/follow/:targetUserId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const followerId = req.user!.id;
    const { targetUserId } = req.params;

    await prisma.userFollow.deleteMany({
      where: {
        followerId,
        followingId: targetUserId,
      },
    });

    const relationship = await getRelationshipWithViewer(followerId, targetUserId);
    const stats = await getUserSocialStats(targetUserId);

    res.json({
      relationship,
      stats,
    });
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get top bar announcement (all authenticated users)
router.get('/announcement', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const setting = await prisma.gameSettings.findUnique({
      where: { key: ANNOUNCEMENT_KEY },
    });

    res.json({ message: setting?.value || '' });
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ error: 'Failed to get announcement' });
  }
});

router.get('/:id/economy-history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const daysParam = Number.parseInt(String(req.query.days ?? '30'), 10);
    const days = Number.isInteger(daysParam) ? Math.min(90, Math.max(7, daysParam)) : 30;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, aura: true, money: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const todayStart = getParisDayStart(new Date());
    const startDate = new Date(todayStart);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const logs = await prisma.log.findMany({
      where: {
        createdAt: { gte: startDate },
        type: { in: ['GAME', 'ECONOMY', 'AURACOIN'] },
        OR: [
          { userId: id },
          { targetId: id },
        ],
      },
      select: {
        type: true,
        action: true,
        userId: true,
        targetId: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const dayKeysDescending: string[] = [];
    for (let offset = 0; offset < days; offset += 1) {
      const day = new Date(todayStart);
      day.setUTCDate(day.getUTCDate() - offset);
      dayKeysDescending.push(getParisDayKey(day));
    }

    const deltasByDay = new Map<string, { aura: number; money: number }>();
    for (const key of dayKeysDescending) {
      deltasByDay.set(key, { aura: 0, money: 0 });
    }

    for (const log of logs) {
      const dayKey = getParisDayKey(log.createdAt);
      const dayDelta = deltasByDay.get(dayKey);
      if (!dayDelta) continue;

      const { auraDelta, moneyDelta } = extractEconomyDeltaForUser(log, id);
      dayDelta.aura += auraDelta;
      dayDelta.money += moneyDelta;
    }

    let runningAura = Number(user.aura);
    let runningMoney = user.money;
    const historyByDay = new Map<string, { aura: number; money: number }>();

    for (const dayKey of dayKeysDescending) {
      historyByDay.set(dayKey, {
        aura: Math.round(runningAura),
        money: Math.round(runningMoney),
      });

      const dayDelta = deltasByDay.get(dayKey);
      if (!dayDelta) continue;

      runningAura -= dayDelta.aura;
      runningMoney -= dayDelta.money;
    }

    const history = [...dayKeysDescending]
      .reverse()
      .map((date) => ({
        date,
        aura: historyByDay.get(date)?.aura ?? 0,
        money: historyByDay.get(date)?.money ?? 0,
      }));

    res.json({
      days,
      history,
    });
  } catch (error) {
    console.error('Get user economy history error:', error);
    res.status(500).json({ error: 'Failed to get user economy history' });
  }
});

// Get user by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const [user, auraCoinAggregate, clanMembership, socialStats, relationship, connections, totalRankedUsers, marriageRel, ownedBusinesses] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          firstName: true,
          schoolLevel: true,
          classLetter: true,
          aura: true,
          money: true,
          auraCoinBalance: true,
          usernameColor: true,
          profilePicture: true,
          profileBanner: true,
          bio: true,
          totalScore: true,
          overallRank: true,
          lastScoreUpdate: true,
          createdAt: true,
          gameStats: {
            select: {
              gameType: true,
              wins: true,
              losses: true,
              highScore: true,
              totalPlayed: true,
            },
          },
          youSkills: {
            select: { key: true, level: true, xp: true },
            orderBy: { createdAt: 'asc' as const },
          },
          _count: {
            select: {
              followers: true,
              following: true,
            },
          },
        },
      }),
      prisma.auraCoinTransaction.aggregate({
        where: { userId: id },
        _count: { _all: true },
        _sum: { moneyAmount: true },
      }),
      prisma.clanMember.findUnique({
        where: { userId: id },
        select: { clan: { select: { tagUnlocked: true, tagText: true, tagStyle: true } } },
      }),
      getUserSocialStats(id),
      getRelationshipWithViewer(req.user!.id, id),
      prisma.user.findMany({
        where: {
          id: {
            in: await getFriendIds(id),
          },
        },
        select: SOCIAL_USER_SELECT,
        orderBy: { username: 'asc' },
        take: 12,
      }),
      prisma.user.count({
        where: { isSuperAdmin: false },
      }),
      prisma.relationship.findFirst({
        where: {
          OR: [{ userAId: id }, { userBId: id }],
          status: 'MARRIED',
        },
        select: {
          userAId: true,
          userBId: true,
          marriedAt: true,
          userA: { select: { id: true, username: true, usernameColor: true } },
          userB: { select: { id: true, username: true, usernameColor: true } },
        },
      }),
      prisma.business.findMany({
        where: { ownerId: id },
        select: { id: true, name: true, typeKey: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const clanTag = (clanMembership?.clan?.tagUnlocked && clanMembership?.clan?.tagText)
      ? { text: clanMembership.clan.tagText, style: clanMembership.clan.tagStyle }
      : null;

    res.json({
      user: {
        ...user,
        clanTag,
        social: {
          ...relationship,
          followerCount: user._count.followers,
          followingCount: user._count.following,
          connectionCount: socialStats.connectionCount,
          connections: connections.map((connection) => ({
            ...connection,
            createdAt: connection.createdAt.toISOString(),
          })),
        },
        auraCoinStats: {
          transactionCount: auraCoinAggregate._count._all,
          totalMoney: auraCoinAggregate._sum.moneyAmount ?? 0,
        },
        overallRankTotalPlayers: totalRankedUsers,
        marriage: marriageRel
          ? {
              partner: marriageRel.userAId === id ? marriageRel.userB : marriageRel.userA,
              marriedAt: marriageRel.marriedAt?.toISOString() ?? null,
            }
          : null,
        ownedBusinesses: ownedBusinesses.map((b) => ({ id: b.id, name: b.name, typeKey: b.typeKey })),
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Only allow users to update their own profile
    if (req.user?.id !== id && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { username, bio } = req.body;

    if (username) {
      // Check if username is taken
      const existing = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id },
        },
      });

      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const updateData: { username?: string; bio?: string | null } = {};
    if (username) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio?.trim() || null;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        schoolLevel: true,
        classLetter: true,
        aura: true,
        money: true,
        auraCoinBalance: true,
        isAdmin: true,
        usernameColor: true,
        profilePicture: true,
        profileBanner: true,
        bio: true,
        createdAt: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /users/name-change-request – request a username change (authenticated)
router.post('/name-change-request', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { requestedUsername, reason } = req.body;

    if (!requestedUsername || typeof requestedUsername !== 'string') {
      return res.status(400).json({ error: 'requestedUsername is required' });
    }

    const trimmed = requestedUsername.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      return res.status(400).json({ error: 'Le pseudo doit faire entre 3 et 20 caractères' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return res.status(400).json({ error: 'Le pseudo ne peut contenir que des lettres, chiffres et underscores' });
    }

    const userId = req.user!.id;

    // Check if username is already taken
    const existing = await prisma.user.findFirst({ where: { username: trimmed, NOT: { id: userId } } });
    if (existing) {
      return res.status(400).json({ error: 'Ce pseudo est déjà pris' });
    }

    // Block if there's already a pending request from this user
    const pending = await prisma.nameChangeRequest.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (pending) {
      return res.status(400).json({ error: 'Vous avez déjà une demande en attente' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });

    const request = await prisma.nameChangeRequest.create({
      data: {
        userId,
        currentUsername: currentUser!.username,
        requestedUsername: trimmed,
        reason: reason?.trim() || null,
      },
    });

    const admins = await prisma.user.findMany({
      where: { isAdmin: true, isApproved: true },
      select: { id: true },
    });

    await Promise.allSettled(admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: 'SYSTEM',
        title: 'Nouvelle demande de pseudo',
        body: `${currentUser!.username} demande le pseudo ${trimmed}.`,
        data: {
          requestId: request.id,
          userId,
          currentUsername: currentUser!.username,
          requestedUsername: trimmed,
        },
        link: '/admin',
        icon: 'user-round-pen',
      })
    ));

    res.status(201).json({ request });
  } catch (error) {
    console.error('Name change request error:', error);
    res.status(500).json({ error: 'Failed to submit name change request' });
  }
});

// ========== SURVEYS ==========

router.get('/surveys/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const viewer = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        isApproved: true,
        isBetaTester: true,
        isAdmin: true,
        isSuperAdmin: true,
      },
    });

    if (!viewer) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const audienceEligibility = buildSurveyAudienceEligibility(viewer);

    const pendingSurvey = await prisma.survey.findFirst({
      where: {
        status: 'ACTIVE',
        responses: {
          none: {
            userId: viewer.id,
          },
        },
        OR: [
          ...(audienceEligibility.ALL_USERS ? [{ audienceType: 'ALL_USERS' }] : []),
          ...(audienceEligibility.BETA_TESTERS ? [{ audienceType: 'BETA_TESTERS' }] : []),
          ...(audienceEligibility.ADMINS ? [{ audienceType: 'ADMINS' }] : []),
          {
            audienceType: 'SELECTED_USERS',
            targetUsers: {
              some: {
                userId: viewer.id,
              },
            },
          },
        ],
      },
      include: {
        options: true,
      },
      orderBy: [
        { createdAt: 'asc' },
      ],
    });

    res.json({ survey: pendingSurvey ? serializePendingSurvey(pendingSurvey) : null });
  } catch (error) {
    console.error('Get pending survey error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement du sondage.' });
  }
});

router.post('/surveys/:id/respond', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const surveyId = req.params.id;
    const optionId = typeof req.body?.optionId === 'string' ? req.body.optionId.trim() : '';
    if (!optionId) {
      return res.status(400).json({ error: 'Option requise.' });
    }

    const viewer = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        isApproved: true,
        isBetaTester: true,
        isAdmin: true,
        isSuperAdmin: true,
      },
    });

    if (!viewer) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        options: true,
        targetUsers: {
          where: {
            userId: viewer.id,
          },
          select: {
            userId: true,
          },
        },
      },
    });

    if (!survey || survey.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Sondage introuvable ou archivé.' });
    }

    const typedAudience = (survey.audienceType.toUpperCase() as SurveyAudienceType);
    const audienceEligibility = buildSurveyAudienceEligibility(viewer);
    const canAnswer = typedAudience === 'SELECTED_USERS'
      ? survey.targetUsers.length > 0
      : audienceEligibility[typedAudience];

    if (!canAnswer) {
      return res.status(403).json({ error: 'Ce sondage ne vous est pas destiné.' });
    }

    const selectedOption = survey.options.find((option) => option.id === optionId);
    if (!selectedOption) {
      return res.status(400).json({ error: 'Option de sondage invalide.' });
    }

    const existingResponse = await prisma.surveyResponse.findUnique({
      where: {
        surveyId_userId: {
          surveyId,
          userId: viewer.id,
        },
      },
    });

    if (existingResponse) {
      return res.json({ success: true, alreadyAnswered: true });
    }

    await prisma.surveyResponse.create({
      data: {
        surveyId,
        userId: viewer.id,
        optionId: selectedOption.id,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Respond survey error:', error);
    res.status(500).json({ error: 'Erreur lors de la réponse au sondage.' });
  }
});

// ========== ADMIN WARNINGS ==========

// Get unacknowledged warnings for current user
router.get('/warnings/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const warnings = await prisma.adminWarning.findMany({
      where: {
        userId: req.user!.id,
        isAcknowledged: false,
      },
      include: {
        issuedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ warnings });
  } catch (error) {
    console.error('Get pending warnings error:', error);
    res.status(500).json({ error: 'Failed to get pending warnings' });
  }
});

// Acknowledge a warning
router.post('/warnings/:id/acknowledge', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const warning = await prisma.adminWarning.findUnique({
      where: { id },
      select: { id: true, userId: true, isAcknowledged: true },
    });

    if (!warning) {
      return res.status(404).json({ error: 'Warning not found' });
    }

    // Ensure user can only acknowledge their own warnings
    if (warning.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Cannot acknowledge another user\'s warning' });
    }

    if (warning.isAcknowledged) {
      return res.json({ success: true, message: 'Warning already acknowledged' });
    }

    await prisma.adminWarning.update({
      where: { id },
      data: {
        isAcknowledged: true,
        acknowledgedAt: new Date(),
      },
    });

    res.json({ success: true, message: 'Warning acknowledged' });
  } catch (error) {
    console.error('Acknowledge warning error:', error);
    res.status(500).json({ error: 'Failed to acknowledge warning' });
  }
});

export default router;
