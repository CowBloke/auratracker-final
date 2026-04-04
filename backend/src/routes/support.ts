import { Router, Response } from 'express';
import { io, prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { isAllowedImageUrl } from '../utils/uploads.js';

const router = Router();

const SUPPORT_CONVERSATION_ID = 'support';
const MAX_MESSAGE_LENGTH = 1000;
const MAX_REPORT_REASON_LENGTH = 280;
const REPORT_SNAPSHOT_LIMIT = 8;

const USER_PREVIEW_SELECT = {
  id: true,
  username: true,
  profilePicture: true,
  usernameColor: true,
} as const;

type BasicUser = {
  id: string;
  username: string;
  profilePicture: string | null;
  usernameColor: string | null;
};

type ConversationParticipantWithUser = {
  user: BasicUser;
  role: string;
  lastReadAt: Date | null;
};

function requireUser(req: AuthRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return req.user;
}

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin only' });
    return false;
  }
  return true;
}

function normalizeSupportImages(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const cleaned = input
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  if (cleaned.length > 5) {
    throw new Error('Maximum 5 images allowed');
  }

  if (!cleaned.every((value) => isAllowedImageUrl(value))) {
    throw new Error('Invalid image URL');
  }

  return cleaned;
}

function serializeBasicUser(user: BasicUser) {
  return {
    id: user.id,
    username: user.username,
    profilePicture: user.profilePicture,
    usernameColor: user.usernameColor,
  };
}

function serializeSupportMessage(msg: { id: string; userId: string; body: string; images?: string | null; fromAdmin: boolean; isRead: boolean; createdAt: Date }) {
  return {
    id: msg.id,
    userId: msg.userId,
    body: msg.body,
    images: msg.images ?? null,
    fromAdmin: msg.fromAdmin,
    isRead: msg.isRead,
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
  };
}

function serializeConversationMessage(message: {
  id: string;
  conversationId: string;
  senderId: string | null;
  body: string;
  type: string;
  createdAt: Date;
  sender?: BasicUser | null;
}) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    type: message.type,
    createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
    sender: message.sender ? serializeBasicUser(message.sender) : null,
  };
}

function buildConversationName(type: string, title: string | null, participants: ConversationParticipantWithUser[], currentUserId: string) {
  if (type === 'GROUP') {
    return title?.trim() || participants.map((participant) => participant.user.username).join(', ');
  }

  const other = participants.find((participant) => participant.user.id !== currentUserId);
  return other?.user.username ?? 'Discussion';
}

function parseSnapshotJson(snapshotJson: string) {
  try {
    const parsed = JSON.parse(snapshotJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function notifyAdminsOfSupportMessage(messageBody: string, actingUserId: string, username: string) {
  const admins = await prisma.user.findMany({
    where: { isAdmin: true },
    select: { id: true },
  });

  await Promise.all(
    admins
      .filter((admin) => admin.id !== actingUserId)
      .map((admin) =>
        createNotification({
          userId: admin.id,
          type: 'SUPPORT_MESSAGE',
          title: 'Nouveau message de support',
          body: `${username} : "${messageBody.slice(0, 80)}${messageBody.length > 80 ? '...' : ''}"`,
          data: { userId: actingUserId, username },
          link: '/admin?tab=support',
          icon: 'message-circle',
        }).catch(() => {})
      )
  );
}

async function notifyUserOfSupportReply(userId: string, body: string) {
  await createNotification({
    userId,
    type: 'SUPPORT_MESSAGE',
    title: 'Reponse du support',
    body: `Support : "${body.slice(0, 80)}${body.length > 80 ? '...' : ''}"`,
    data: { fromAdmin: true },
    link: '/support',
    icon: 'message-circle',
  }).catch(() => {});
}

async function buildSupportConversationSummary(userId: string) {
  const [lastMessage, unreadCount] = await Promise.all([
    prisma.supportMessage.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supportMessage.count({
      where: { userId, fromAdmin: true, isRead: false },
    }),
  ]);

  return {
    id: SUPPORT_CONVERSATION_ID,
    type: 'SUPPORT',
    title: 'Support',
    displayName: 'Support',
    isPinned: true,
    unreadCount,
    lastMessage: lastMessage
      ? {
          body: lastMessage.body || (lastMessage.images ? 'Images' : ''),
          createdAt: lastMessage.createdAt.toISOString(),
          senderId: lastMessage.fromAdmin ? 'support' : userId,
        }
      : null,
    participants: [],
  };
}

async function emitConversationToParticipants(conversationId: string, event: string, payload: Record<string, unknown>) {
  const participants = await prisma.messageConversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });

  participants.forEach((participant) => {
    io.to(`user:${participant.userId}`).emit(event, payload);
  });
}

async function buildConversationSummaryForUser(conversationId: string, currentUserId: string) {
  const participant = await prisma.messageConversationParticipant.findFirst({
    where: { conversationId, userId: currentUserId },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: USER_PREVIEW_SELECT } },
          },
          messages: {
            include: { sender: { select: USER_PREVIEW_SELECT } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!participant) {
    return null;
  }

  const unreadCount = await prisma.messageConversationMessage.count({
    where: {
      conversationId,
      createdAt: participant.lastReadAt ? { gt: participant.lastReadAt } : undefined,
      senderId: { not: currentUserId },
    },
  });

  const participants = participant.conversation.participants as ConversationParticipantWithUser[];
  const lastMessage = participant.conversation.messages[0];

  return {
    id: participant.conversation.id,
    type: participant.conversation.type,
    title: participant.conversation.title,
    icon: participant.conversation.icon ?? null,
    displayName: buildConversationName(participant.conversation.type, participant.conversation.title, participants, currentUserId),
    isPinned: false,
    unreadCount,
    lastMessage: lastMessage
      ? serializeConversationMessage({
          id: lastMessage.id,
          conversationId: lastMessage.conversationId,
          senderId: lastMessage.senderId,
          body: lastMessage.body,
          type: lastMessage.type,
          createdAt: lastMessage.createdAt,
          sender: lastMessage.sender,
        })
      : null,
    participants: participants.map((entry) => ({
      user: serializeBasicUser(entry.user),
      role: entry.role,
      lastReadAt: entry.lastReadAt?.toISOString() ?? null,
    })),
  };
}

async function listMessagingConversationsForUser(userId: string) {
  const membershipRows = await prisma.messageConversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: USER_PREVIEW_SELECT } },
          },
          messages: {
            include: { sender: { select: USER_PREVIEW_SELECT } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const conversations = await Promise.all(
    membershipRows.map(async (membership) => {
      const unreadCount = await prisma.messageConversationMessage.count({
        where: {
          conversationId: membership.conversationId,
          createdAt: membership.lastReadAt ? { gt: membership.lastReadAt } : undefined,
          senderId: { not: userId },
        },
      });

      const participants = membership.conversation.participants as ConversationParticipantWithUser[];
      const lastMessage = membership.conversation.messages[0];

      return {
        id: membership.conversation.id,
        type: membership.conversation.type,
        title: membership.conversation.title,
        icon: membership.conversation.icon ?? null,
        displayName: buildConversationName(membership.conversation.type, membership.conversation.title, participants, userId),
        isPinned: false,
        unreadCount,
        lastMessage: lastMessage
          ? serializeConversationMessage({
              id: lastMessage.id,
              conversationId: lastMessage.conversationId,
              senderId: lastMessage.senderId,
              body: lastMessage.body,
              type: lastMessage.type,
              createdAt: lastMessage.createdAt,
              sender: lastMessage.sender,
            })
          : null,
        participants: participants.map((entry) => ({
          user: serializeBasicUser(entry.user),
          role: entry.role,
          lastReadAt: entry.lastReadAt?.toISOString() ?? null,
        })),
      };
    })
  );

  return conversations.sort((a, b) => {
    const aDate = a.lastMessage?.createdAt ?? '';
    const bDate = b.lastMessage?.createdAt ?? '';
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

router.get('/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const messages = await prisma.supportMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ messages: messages.map(serializeSupportMessage) });
  } catch (error) {
    console.error('Get support messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

router.post('/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const images = normalizeSupportImages(req.body?.images);

    if (body.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'Message must be 1000 characters or less' });
    }
    if (!body && images.length === 0) {
      return res.status(400).json({ error: 'Message body or at least one image is required' });
    }

    const message = await prisma.supportMessage.create({
      data: {
        userId: user.id,
        body,
        fromAdmin: false,
        images: images.length ? JSON.stringify(images) : null,
      },
    });

    const serialized = serializeSupportMessage(message);
    io.to('admin:support').emit('support:message', {
      message: serialized,
      username: user.username,
    });

    await notifyAdminsOfSupportMessage(body || 'Images', user.id, user.username);

    res.json({ message: serialized });
  } catch (error) {
    console.error('Send support message error:', error);
    if (error instanceof Error && (error.message === 'Maximum 5 images allowed' || error.message === 'Invalid image URL')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/messages/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    await prisma.supportMessage.updateMany({
      where: { userId: user.id, fromAdmin: true, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark support read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.get('/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const [supportConversation, conversations] = await Promise.all([
      buildSupportConversationSummary(user.id),
      listMessagingConversationsForUser(user.id),
    ]);

    res.json({ conversations: [supportConversation, ...conversations] });
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

router.get('/conversations/:conversationId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const { conversationId } = req.params;

    if (conversationId === SUPPORT_CONVERSATION_ID) {
      const [messages, conversation] = await Promise.all([
        prisma.supportMessage.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' },
        }),
        buildSupportConversationSummary(user.id),
      ]);

      return res.json({
        conversation,
        messages: messages.map(serializeSupportMessage).map((message) => ({
          ...message,
          conversationId: SUPPORT_CONVERSATION_ID,
          type: 'TEXT',
          sender: message.fromAdmin
            ? { id: 'support', username: 'Support', profilePicture: null, usernameColor: null }
            : { id: user.id, username: user.username, profilePicture: null, usernameColor: null },
        })),
      });
    }

    const membership = await prisma.messageConversationParticipant.findFirst({
      where: { conversationId, userId: user.id },
      include: {
        conversation: {
          include: {
            messages: {
              include: { sender: { select: USER_PREVIEW_SELECT } },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!membership) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversation = await buildConversationSummaryForUser(conversationId, user.id);

    res.json({
      conversation,
      messages: membership.conversation.messages.map((message) =>
        serializeConversationMessage({
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          body: message.body,
          type: message.type,
          createdAt: message.createdAt,
          sender: message.sender,
        })
      ),
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

router.post('/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const type = req.body?.type === 'GROUP' ? 'GROUP' : 'DM';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const participantIds = Array.isArray(req.body?.participantIds)
      ? req.body.participantIds.filter((value: unknown): value is string => typeof value === 'string')
      : [];
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const uniqueParticipantIds = [...new Set([user.id, ...participantIds])];

    if (uniqueParticipantIds.length < 2) {
      return res.status(400).json({ error: 'At least one other participant is required' });
    }
    if (type === 'DM' && uniqueParticipantIds.length !== 2) {
      return res.status(400).json({ error: 'DM conversations require exactly two participants' });
    }
    if (type === 'GROUP' && uniqueParticipantIds.length < 3) {
      return res.status(400).json({ error: 'Group conversations require at least three participants' });
    }
    if (body.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'Message must be 1000 characters or less' });
    }

    const existingUsers = await prisma.user.findMany({
      where: { id: { in: uniqueParticipantIds }, isApproved: true },
      select: { id: true },
    });
    if (existingUsers.length !== uniqueParticipantIds.length) {
      return res.status(400).json({ error: 'One or more participants were not found' });
    }

    if (type === 'DM') {
      const otherUserId = uniqueParticipantIds.find((id) => id !== user.id)!;
      const existingConversation = await prisma.messageConversationParticipant.findMany({
        where: {
          userId: user.id,
          conversation: {
            type: 'DM',
            participants: { some: { userId: otherUserId } },
          },
        },
        include: {
          conversation: {
            include: {
              participants: { select: { userId: true } },
            },
          },
        },
      });

      const matched = existingConversation.find((entry) => {
        const ids = entry.conversation.participants.map((participant) => participant.userId).sort();
        const expected = [...uniqueParticipantIds].sort();
        return ids.length === 2 && ids[0] === expected[0] && ids[1] === expected[1];
      });

      if (matched) {
        const conversation = await buildConversationSummaryForUser(matched.conversationId, user.id);
        return res.json({ conversation, alreadyExisted: true });
      }
    }

    const now = new Date();
    const conversation = await prisma.$transaction(async (tx) => {
      const created = await tx.messageConversation.create({
        data: {
          type,
          title: type === 'GROUP' ? title || null : null,
          createdById: user.id,
          lastMessageAt: now,
          participants: {
            create: uniqueParticipantIds.map((participantId) => ({
              userId: participantId,
              role: participantId === user.id ? 'OWNER' : 'MEMBER',
              lastReadAt: participantId === user.id ? now : null,
            })),
          },
        },
      });

      if (body) {
        await tx.messageConversationMessage.create({
          data: {
            conversationId: created.id,
            senderId: user.id,
            body,
            type: 'TEXT',
          },
        });
      }

      return created;
    });

    const summary = await buildConversationSummaryForUser(conversation.id, user.id);
    await emitConversationToParticipants(conversation.id, 'messaging:conversation', { conversationId: conversation.id });

    res.json({ conversation: summary, alreadyExisted: false });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.post('/conversations/:conversationId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const { conversationId } = req.params;
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';

    if (!body) {
      return res.status(400).json({ error: 'Message body is required' });
    }
    if (body.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'Message must be 1000 characters or less' });
    }

    if (conversationId === SUPPORT_CONVERSATION_ID) {
      const message = await prisma.supportMessage.create({
        data: { userId: user.id, body, fromAdmin: false },
      });

      const serializedMessage = {
        ...serializeSupportMessage(message),
        conversationId: SUPPORT_CONVERSATION_ID,
        type: 'TEXT',
        sender: {
          id: user.id,
          username: user.username,
          profilePicture: null,
          usernameColor: null,
        },
      };

      io.to('admin:support').emit('support:message', {
        message: serializeSupportMessage(message),
        username: user.username,
      });
      await notifyAdminsOfSupportMessage(body, user.id, user.username);

      return res.json({ message: serializedMessage });
    }

    const membership = await prisma.messageConversationParticipant.findFirst({
      where: { conversationId, userId: user.id },
      select: { conversationId: true },
    });

    if (!membership) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const now = new Date();
    const message = await prisma.$transaction(async (tx) => {
      const createdMessage = await tx.messageConversationMessage.create({
        data: {
          conversationId,
          senderId: user.id,
          body,
          type: 'TEXT',
        },
      });

      await tx.messageConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      });

      await tx.messageConversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: user.id,
          },
        },
        data: { lastReadAt: now },
      });

      return createdMessage;
    });

    const serializedMessage = serializeConversationMessage({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      type: message.type,
      createdAt: message.createdAt,
      sender: {
        id: user.id,
        username: user.username,
        profilePicture: null,
        usernameColor: null,
      },
    });

    await emitConversationToParticipants(conversationId, 'messaging:message', {
      conversationId,
      message: serializedMessage,
    });

    res.json({ message: serializedMessage });
  } catch (error) {
    console.error('Send conversation message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/conversations/:conversationId/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const { conversationId } = req.params;

    if (conversationId === SUPPORT_CONVERSATION_ID) {
      await prisma.supportMessage.updateMany({
        where: { userId: user.id, fromAdmin: true, isRead: false },
        data: { isRead: true },
      });
      return res.json({ success: true });
    }

    await prisma.messageConversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
      data: { lastReadAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark conversation read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.post('/conversations/:conversationId/report', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const { conversationId } = req.params;
    if (conversationId === SUPPORT_CONVERSATION_ID) {
      return res.status(400).json({ error: 'Support cannot be reported' });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length > MAX_REPORT_REASON_LENGTH) {
      return res.status(400).json({ error: 'Reason is too long' });
    }

    const membership = await prisma.messageConversationParticipant.findFirst({
      where: { conversationId, userId: user.id },
      select: { conversationId: true },
    });
    if (!membership) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const recentMessages = await prisma.messageConversationMessage.findMany({
      where: { conversationId },
      include: { sender: { select: USER_PREVIEW_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: REPORT_SNAPSHOT_LIMIT,
    });

    const snapshot = recentMessages.reverse().map((message) =>
      serializeConversationMessage({
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        body: message.body,
        type: message.type,
        createdAt: message.createdAt,
        sender: message.sender,
      })
    );

    const report = await prisma.messageConversationReport.create({
      data: {
        conversationId,
        reporterId: user.id,
        reason: reason || null,
        snapshotJson: JSON.stringify(snapshot),
      },
      include: {
        reporter: { select: USER_PREVIEW_SELECT },
      },
    });

    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: 'MESSAGE_REPORT',
          title: 'Conversation signalee',
          body: `${user.username} a signale une conversation.`,
          data: { reportId: report.id, conversationId },
          link: '/admin?tab=support',
          icon: 'shield-alert',
        }).catch(() => {})
      )
    );

    io.to('admin:support').emit('messaging:report', { reportId: report.id });

    res.json({
      report: {
        id: report.id,
        conversationId: report.conversationId,
        reporter: serializeBasicUser(report.reporter),
        status: report.status,
        reason: report.reason,
        snapshot,
        createdAt: report.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Report conversation error:', error);
    res.status(500).json({ error: 'Failed to report conversation' });
  }
});

router.patch('/conversations/:conversationId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const { conversationId } = req.params;

    const membership = await prisma.messageConversationParticipant.findFirst({
      where: { conversationId, userId: user.id },
      include: { conversation: true },
    });
    if (!membership) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (membership.conversation.type !== 'GROUP') {
      return res.status(400).json({ error: 'Only group conversations can be updated' });
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 80) : undefined;
    const icon = typeof req.body?.icon === 'string' ? req.body.icon.trim().slice(0, 8) : undefined;

    const updated = await prisma.messageConversation.update({
      where: { id: conversationId },
      data: {
        ...(title !== undefined ? { title: title || null } : {}),
        ...(icon !== undefined ? { icon: icon || null } : {}),
      },
    });

    await emitConversationToParticipants(conversationId, 'messaging:conversation', { conversationId });

    res.json({ conversation: { id: updated.id, title: updated.title, icon: updated.icon } });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const [supportUnreadCount, memberships] = await Promise.all([
      prisma.supportMessage.count({
        where: { userId: user.id, fromAdmin: true, isRead: false },
      }),
      prisma.messageConversationParticipant.findMany({
        where: { userId: user.id },
        select: { conversationId: true, lastReadAt: true },
      }),
    ]);

    const unreadCounts = await Promise.all(
      memberships.map((membership) =>
        prisma.messageConversationMessage.count({
          where: {
            conversationId: membership.conversationId,
            createdAt: membership.lastReadAt ? { gt: membership.lastReadAt } : undefined,
            senderId: { not: user.id },
          },
        })
      )
    );

    res.json({ count: supportUnreadCount + unreadCounts.reduce((sum, count) => sum + count, 0) });
  } catch (error) {
    console.error('Support unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

router.get('/admin/threads', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const threads = await prisma.$queryRaw<
      Array<{
        userId: string;
        lastBody: string;
        lastFromAdmin: number;
        lastCreatedAt: string;
        unreadCount: number;
      }>
    >`
      SELECT
        sm.userId,
        (SELECT body FROM SupportMessage WHERE userId = sm.userId ORDER BY createdAt DESC LIMIT 1) as lastBody,
        (SELECT fromAdmin FROM SupportMessage WHERE userId = sm.userId ORDER BY createdAt DESC LIMIT 1) as lastFromAdmin,
        (SELECT createdAt FROM SupportMessage WHERE userId = sm.userId ORDER BY createdAt DESC LIMIT 1) as lastCreatedAt,
        SUM(CASE WHEN sm.fromAdmin = 0 AND sm.isRead = 0 THEN 1 ELSE 0 END) as unreadCount
      FROM SupportMessage sm
      GROUP BY sm.userId
      ORDER BY lastCreatedAt DESC
    `;

    if (!threads.length) {
      return res.json({ threads: [] });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: threads.map((thread) => thread.userId) } },
      select: USER_PREVIEW_SELECT,
    });
    const userMap = new Map(users.map((entry) => [entry.id, entry]));

    res.json({
      threads: threads.map((thread) => ({
        userId: thread.userId,
        user: userMap.get(thread.userId) ?? null,
        lastBody: thread.lastBody,
        lastFromAdmin: Boolean(thread.lastFromAdmin),
        lastCreatedAt: thread.lastCreatedAt,
        unreadCount: Number(thread.unreadCount),
      })),
    });
  } catch (error) {
    console.error('Get support threads error:', error);
    res.status(500).json({ error: 'Failed to get threads' });
  }
});

router.get('/admin/threads/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { userId } = req.params;
    const [messages, user] = await Promise.all([
      prisma.supportMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: USER_PREVIEW_SELECT,
      }),
    ]);

    res.json({ messages: messages.map(serializeSupportMessage), user });
  } catch (error) {
    console.error('Get support thread error:', error);
    res.status(500).json({ error: 'Failed to get thread' });
  }
});

router.post('/admin/reply/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { userId } = req.params;
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const images = normalizeSupportImages(req.body?.images);

    if (body.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'Message must be 1000 characters or less' });
    }
    if (!body && images.length === 0) {
      return res.status(400).json({ error: 'Message body or at least one image is required' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const message = await prisma.supportMessage.create({
      data: {
        userId,
        body,
        fromAdmin: true,
        images: images.length ? JSON.stringify(images) : null,
      },
    });

    io.to(`user:${userId}`).emit('support:message', {
      message: serializeSupportMessage(message),
    });
    io.to('admin:support').emit('support:message', {
      message: serializeSupportMessage(message),
      username: req.user!.username,
    });

    await notifyUserOfSupportReply(userId, body || 'Images');

    res.json({ message: serializeSupportMessage(message) });
  } catch (error) {
    console.error('Admin support reply error:', error);
    if (error instanceof Error && (error.message === 'Maximum 5 images allowed' || error.message === 'Invalid image URL')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

router.post('/admin/threads/:userId/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { userId } = req.params;
    await prisma.supportMessage.updateMany({
      where: { userId, fromAdmin: false, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin mark support read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.get('/admin/reports', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const reports = await prisma.messageConversationReport.findMany({
      include: {
        reporter: { select: USER_PREVIEW_SELECT },
        reviewedBy: { select: { id: true, username: true } },
        conversation: {
          include: {
            participants: {
              include: { user: { select: USER_PREVIEW_SELECT } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      reports: reports.map((report) => ({
        id: report.id,
        conversationId: report.conversationId,
        conversationType: report.conversation.type,
        conversationTitle: report.conversation.title,
        participants: report.conversation.participants.map((participant) => ({
          user: serializeBasicUser(participant.user),
          role: participant.role,
        })),
        reporter: serializeBasicUser(report.reporter),
        reason: report.reason,
        status: report.status,
        snapshot: parseSnapshotJson(report.snapshotJson),
        reviewerNote: report.reviewerNote,
        reviewedAt: report.reviewedAt?.toISOString() ?? null,
        reviewedBy: report.reviewedBy
          ? { id: report.reviewedBy.id, username: report.reviewedBy.username }
          : null,
        createdAt: report.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get messaging reports error:', error);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

router.post('/admin/reports/:reportId/review', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { reportId } = req.params;
    const action = req.body?.action === 'ACTION_TAKEN' ? 'ACTION_TAKEN' : req.body?.action === 'DISMISSED' ? 'DISMISSED' : null;
    const reviewerNote = typeof req.body?.reviewerNote === 'string' ? req.body.reviewerNote.trim() : '';

    if (!action) {
      return res.status(400).json({ error: 'A valid review action is required' });
    }

    const report = await prisma.messageConversationReport.update({
      where: { id: reportId },
      data: {
        status: action,
        reviewerNote: reviewerNote || null,
        reviewedAt: new Date(),
        reviewedById: req.user!.id,
      },
    });

    io.to('admin:support').emit('messaging:report', { reportId: report.id });

    res.json({
      report: {
        id: report.id,
        status: report.status,
        reviewerNote: report.reviewerNote,
        reviewedAt: report.reviewedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('Review messaging report error:', error);
    res.status(500).json({ error: 'Failed to review report' });
  }
});

export default router;
