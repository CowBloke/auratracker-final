import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

const MESSAGE_MAX_LENGTH = 1500;
const HISTORY_LIMIT = 200;

const OTHER_USER_SELECT = {
  id: true,
  username: true,
  firstName: true,
  usernameColor: true,
  profilePicture: true,
  bio: true,
} as const;

const getDirectKey = (userA: string, userB: string) => [userA, userB].sort().join(':');

const ensureAuthenticated = (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }

  return req.user;
};

const getConversationForUser = async (conversationId: string, userId: string) => {
  const conversation = await prisma.directConversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: {
            select: OTHER_USER_SELECT,
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              usernameColor: true,
              profilePicture: true,
            },
          },
        },
      },
    },
  });

  if (!conversation || !conversation.participants.some((participant) => participant.userId === userId)) {
    return null;
  }

  return conversation;
};

const serializeConversation = async (conversation: Awaited<ReturnType<typeof getConversationForUser>>, userId: string) => {
  if (!conversation) return null;

  const participant = conversation.participants.find((entry) => entry.userId === userId) ?? null;
  const otherParticipant = conversation.participants.find((entry) => entry.userId !== userId) ?? null;
  const lastMessage = conversation.messages[0] ?? null;

  const unreadCount = await prisma.directMessage.count({
    where: {
      conversationId: conversation.id,
      senderId: { not: userId },
      ...(participant?.lastReadAt
        ? { createdAt: { gt: participant.lastReadAt } }
        : {}),
    },
  });

  return {
    id: conversation.id,
    updatedAt: conversation.updatedAt.toISOString(),
    createdAt: conversation.createdAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    unreadCount,
    otherUser: otherParticipant
      ? {
          ...otherParticipant.user,
        }
      : null,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          body: lastMessage.body,
          createdAt: lastMessage.createdAt.toISOString(),
          sender: {
            id: lastMessage.sender.id,
            username: lastMessage.sender.username,
            usernameColor: lastMessage.sender.usernameColor,
            profilePicture: lastMessage.sender.profilePicture,
          },
        }
      : null,
  };
};

router.get('/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = ensureAuthenticated(req, res);
    if (!user) return;

    const conversations = await prisma.directConversation.findMany({
      where: {
        participants: {
          some: { userId: user.id },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: OTHER_USER_SELECT,
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
                profilePicture: true,
              },
            },
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const serialized = await Promise.all(
      conversations.map((conversation) => serializeConversation(conversation, user.id))
    );

    res.json({ conversations: serialized.filter(Boolean) });
  } catch (error) {
    console.error('Get direct conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = ensureAuthenticated(req, res);
    if (!user) return;

    const participants = await prisma.directConversationParticipant.findMany({
      where: { userId: user.id },
      select: {
        conversationId: true,
        lastReadAt: true,
      },
    });

    const counts = await Promise.all(
      participants.map((participant) =>
        prisma.directMessage.count({
          where: {
            conversationId: participant.conversationId,
            senderId: { not: user.id },
            ...(participant.lastReadAt
              ? { createdAt: { gt: participant.lastReadAt } }
              : {}),
          },
        })
      )
    );

    res.json({ count: counts.reduce((sum, value) => sum + value, 0) });
  } catch (error) {
    console.error('Get direct unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

router.post('/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = ensureAuthenticated(req, res);
    if (!user) return;

    const targetUserId = typeof req.body?.targetUserId === 'string' ? req.body.targetUserId.trim() : '';
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    if (targetUserId === user.id) {
      return res.status(400).json({ error: 'Cannot start a conversation with yourself' });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isApproved: true },
    });

    if (!target?.isApproved) {
      return res.status(404).json({ error: 'User not found' });
    }

    const directKey = getDirectKey(user.id, targetUserId);

    const conversation = await prisma.directConversation.upsert({
      where: { directKey },
      update: {},
      create: {
        directKey,
        participants: {
          create: [
            { userId: user.id, lastReadAt: new Date() },
            { userId: targetUserId },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: OTHER_USER_SELECT,
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    const serialized = await serializeConversation(conversation, user.id);
    res.json({ conversation: serialized });
  } catch (error) {
    console.error('Create direct conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.get('/conversations/:conversationId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = ensureAuthenticated(req, res);
    if (!user) return;

    const { conversationId } = req.params;
    const conversation = await getConversationForUser(conversationId, user.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await prisma.directMessage.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
    });

    const serializedConversation = await serializeConversation(conversation, user.id);

    res.json({
      conversation: serializedConversation,
      messages: messages.map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          usernameColor: message.sender.usernameColor,
          profilePicture: message.sender.profilePicture,
        },
      })),
    });
  } catch (error) {
    console.error('Get direct messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

router.post('/conversations/:conversationId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = ensureAuthenticated(req, res);
    if (!user) return;

    const { conversationId } = req.params;
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';

    if (!body) {
      return res.status(400).json({ error: 'Message body is required' });
    }

    if (body.length > MESSAGE_MAX_LENGTH) {
      return res.status(400).json({ error: `Message must be ${MESSAGE_MAX_LENGTH} characters or less` });
    }

    const conversation = await getConversationForUser(conversationId, user.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const otherParticipant = conversation.participants.find((participant) => participant.userId !== user.id) ?? null;
    if (!otherParticipant) {
      return res.status(400).json({ error: 'Conversation is invalid' });
    }

    const now = new Date();

    const message = await prisma.$transaction(async (tx) => {
      const createdMessage = await tx.directMessage.create({
        data: {
          conversationId,
          senderId: user.id,
          body,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              usernameColor: true,
              profilePicture: true,
            },
          },
        },
      });

      await tx.directConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      });

      await tx.directConversationParticipant.updateMany({
        where: {
          conversationId,
          userId: user.id,
        },
        data: {
          lastReadAt: now,
          lastReadMessageId: createdMessage.id,
        },
      });

      return createdMessage;
    });

    await createNotification({
      userId: otherParticipant.userId,
      type: 'DIRECT_MESSAGE',
      title: `Nouveau message de ${user.username}`,
      body: body.length > 90 ? `${body.slice(0, 90)}...` : body,
      link: `/messages?conversation=${conversationId}`,
      icon: 'message-square',
      data: {
        conversationId,
        senderId: user.id,
      },
    }).catch(() => {});

    res.json({
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          usernameColor: message.sender.usernameColor,
          profilePicture: message.sender.profilePicture,
        },
      },
    });
  } catch (error) {
    console.error('Send direct message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/conversations/:conversationId/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = ensureAuthenticated(req, res);
    if (!user) return;

    const { conversationId } = req.params;
    const conversation = await getConversationForUser(conversationId, user.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const latestMessage = await prisma.directMessage.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    await prisma.directConversationParticipant.updateMany({
      where: {
        conversationId,
        userId: user.id,
      },
      data: {
        lastReadAt: new Date(),
        lastReadMessageId: latestMessage?.id ?? null,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark direct conversation read error:', error);
    res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
});

export default router;
