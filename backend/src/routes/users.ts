import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import {
  SOCIAL_USER_SELECT,
  buildConversationSummaryForViewer,
  getFriendIds,
  getOrCreatePrivateConversation,
  getRelationshipWithViewer,
  getUserSocialStats,
} from '../utils/social.js';

const router = Router();
const ANNOUNCEMENT_KEY = 'topbar_announcement';

const serializePrivateMessage = (message: {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  readAt: Date | null;
  sender: {
    id: string;
    username: string;
    firstName: string | null;
    usernameColor: string | null;
    profilePicture: string | null;
  };
}) => ({
  id: message.id,
  conversationId: message.conversationId,
  senderId: message.senderId,
  body: message.body,
  imageUrl: message.imageUrl,
  createdAt: message.createdAt.toISOString(),
  readAt: message.readAt ? message.readAt.toISOString() : null,
  sender: message.sender,
});

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

router.get('/social/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversations = await prisma.privateConversation.findMany({
      where: {
        OR: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      include: {
        participantOne: { select: SOCIAL_USER_SELECT },
        participantTwo: { select: SOCIAL_USER_SELECT },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            body: true,
            imageUrl: true,
            createdAt: true,
            readAt: true,
            senderId: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    res.json({
      conversations: conversations.map((conversation) =>
        buildConversationSummaryForViewer(conversation, userId)
      ),
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

router.post('/social/conversations/with/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const otherUserId = req.params.userId;

    if (currentUserId === otherUserId) {
      return res.status(400).json({ error: 'Cannot create a conversation with yourself' });
    }

    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, isApproved: true },
    });

    if (!otherUser?.isApproved) {
      return res.status(404).json({ error: 'User not found' });
    }

    const conversation = await getOrCreatePrivateConversation(currentUserId, otherUserId);

    const hydratedConversation = await prisma.privateConversation.findUnique({
      where: { id: conversation.id },
      include: {
        participantOne: { select: SOCIAL_USER_SELECT },
        participantTwo: { select: SOCIAL_USER_SELECT },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            body: true,
            imageUrl: true,
            createdAt: true,
            readAt: true,
            senderId: true,
          },
        },
      },
    });

    if (!hydratedConversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      conversation: buildConversationSummaryForViewer(hydratedConversation, currentUserId),
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.get('/social/conversations/:conversationId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 100, 200);

    const conversation = await prisma.privateConversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      select: { id: true },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await prisma.privateMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            usernameColor: true,
            profilePicture: true,
          },
        },
      },
    });

    res.json({
      messages: messages.map(serializePrivateMessage),
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({ error: 'Failed to get conversation messages' });
  }
});

router.post('/social/conversations/:conversationId/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    const conversation = await prisma.privateConversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      select: { id: true },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await prisma.privateMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Read conversation error:', error);
    res.status(500).json({ error: 'Failed to mark conversation as read' });
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

// Get pending update popups for the current user
router.get('/update-popups/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const popups = await prisma.updatePopup.findMany({
      where: {
        isPublished: true,
        releaseDate: { lte: now },
        views: {
          none: {
            userId: req.user!.id,
          },
        },
      },
      orderBy: [
        { releaseDate: 'asc' },
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        title: true,
        summary: true,
        message: true,
        imageUrl: true,
        releaseDate: true,
        createdAt: true,
      },
    });

    res.json({ popups });
  } catch (error) {
    console.error('Get pending update popups error:', error);
    res.status(500).json({ error: 'Failed to get pending update popups' });
  }
});

// Mark an update popup as viewed for current user
router.post('/update-popups/:id/viewed', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const popup = await prisma.updatePopup.findUnique({
      where: { id },
      select: { id: true, isPublished: true },
    });

    if (!popup || !popup.isPublished) {
      return res.status(404).json({ error: 'Update popup not found' });
    }

    await prisma.userUpdatePopupView.upsert({
      where: {
        userId_popupId: {
          userId: req.user!.id,
          popupId: id,
        },
      },
      create: {
        userId: req.user!.id,
        popupId: id,
      },
      update: {
        viewedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark update popup viewed error:', error);
    res.status(500).json({ error: 'Failed to mark popup as viewed' });
  }
});

// Get user by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const [user, auraCoinAggregate, clanMembership, socialStats, relationship, connections] = await Promise.all([
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
          bio: true,
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

    const updateData: { username?: string; bio?: string } = {};
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
