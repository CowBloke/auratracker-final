import { Prisma } from '@prisma/client';
import { Router, Response } from 'express';
import { io, prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { isAllowedImageUrl } from '../utils/uploads.js';

const router = Router();

const SUPPORT_CONVERSATION_ID = 'support';
const ADMIN_SUPPORT_CONVERSATION_PREFIX = 'admin-support:';
const MAX_MESSAGE_LENGTH = 1000;
const MAX_REPORT_REASON_LENGTH = 280;
const GROUP_DESCRIPTION_MAX_LENGTH = 280;
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

type AdminFlagUser = {
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

function isAdminUser(user: AdminFlagUser | null | undefined): boolean {
  return Boolean(user?.isAdmin || user?.isSuperAdmin);
}

type CourtConversationParticipant = {
  userId: string;
  courtRole: string | null;
};

function canManageCourtConversation(
  user: (AdminFlagUser & { id: string }) | null | undefined,
  conversation: { courtCaseId?: string | null; participants?: CourtConversationParticipant[] },
): boolean {
  if (!conversation.courtCaseId) {
    return true;
  }

  if (isAdminUser(user)) {
    return true;
  }

  return Boolean(conversation.participants?.some((entry) => entry.userId === user?.id && entry.courtRole === 'JUDGE'));
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

function groupSupportReactions(reactions: Array<{ emoji: string; userId: string; user: { id: string; username: string } }>, viewerId: string) {
  const grouped: Record<string, { emoji: string; count: number; users: string[]; myReaction: boolean }> = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [], myReaction: false };
    grouped[r.emoji].count++;
    grouped[r.emoji].users.push(r.user.username);
    if (r.userId === viewerId) grouped[r.emoji].myReaction = true;
  }
  return Object.values(grouped);
}

function serializeSupportMessage(msg: {
  id: string;
  userId: string;
  body: string;
  images?: string | null;
  fromAdmin: boolean;
  isRead: boolean;
  deletedAt?: Date | null;
  deletedByUserId?: string | null;
  createdAt: Date;
}) {
  return {
    id: msg.id,
    userId: msg.userId,
    body: msg.body,
    images: msg.images ?? null,
    fromAdmin: msg.fromAdmin,
    isRead: msg.isRead,
    deletedAt: msg.deletedAt?.toISOString() ?? null,
    deletedByUserId: msg.deletedByUserId ?? null,
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
  };
}

function serializeConversationMessage(message: {
  id: string;
  conversationId: string;
  senderId: string | null;
  body: string;
  type: string;
  imageUrl?: string | null;
  courtRole?: string | null;
  deletedAt?: Date | null;
  deletedByUserId?: string | null;
  replyTo?: {
    id: string;
    body: string;
    senderId: string | null;
    sender?: BasicUser | null;
  } | null;
  createdAt: Date;
  sender?: BasicUser | null;
}) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    type: message.type,
    imageUrl: message.imageUrl ?? null,
    courtRole: message.courtRole ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
    deletedByUserId: message.deletedByUserId ?? null,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          body: message.replyTo.body,
          senderId: message.replyTo.senderId,
          sender: message.replyTo.sender ? serializeBasicUser(message.replyTo.sender) : null,
        }
      : null,
    createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
    sender: message.sender ? serializeBasicUser(message.sender) : null,
  };
}

function normalizeConversationText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || null;
}

function buildConversationName(type: string, title: string | null, participants: ConversationParticipantWithUser[], currentUserId: string) {
  if (type === 'GROUP') {
    return title?.trim() || participants.map((participant) => participant.user.username).join(', ');
  }

  const other = participants.find((participant) => participant.user.id !== currentUserId);
  return other?.user.username ?? 'Discussion';
}

async function recordConversationSystemMessage(
  tx: Prisma.TransactionClient,
  conversationId: string,
  senderId: string,
  body: string,
) {
  await tx.messageConversationMessage.create({
    data: {
      conversationId,
      senderId,
      body,
      type: 'SYSTEM',
    },
  });

  await tx.messageConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });
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
          link: `/messages?conversation=${ADMIN_SUPPORT_CONVERSATION_PREFIX}${actingUserId}`,
          icon: 'message-circle',
        }).catch((e) => console.error('Notification failed (support):', e))
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
    link: `/messages?conversation=${SUPPORT_CONVERSATION_ID}`,
    icon: 'message-circle',
  }).catch((e) => console.error('Notification failed (support):', e));
}

async function buildSupportConversationSummary(userId: string) {
  const [lastMessage, unreadCount] = await Promise.all([
    prisma.supportMessage.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supportMessage.count({
      where: { userId, fromAdmin: true, isRead: false, deletedAt: null },
    }),
  ]);

  return {
    id: SUPPORT_CONVERSATION_ID,
    type: 'SUPPORT',
    title: 'Support',
    description: null,
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
            where: { deletedAt: null },
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
      deletedAt: null,
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
    description: participant.conversation.description ?? null,
    icon: participant.conversation.icon ?? null,
    imageUrl: participant.conversation.imageUrl ?? null,
    courtCaseId: (participant.conversation as any).courtCaseId ?? null,
    tagType: (participant.conversation as any).tagType ?? null,
    tagLabel: (participant.conversation as any).tagLabel ?? null,
    isFavorite: participant.isFavorite,
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
            imageUrl: (lastMessage as any).imageUrl ?? null,
          createdAt: lastMessage.createdAt,
          sender: lastMessage.sender,
        })
      : null,
    participants: participants.map((entry) => ({
      user: serializeBasicUser(entry.user),
      role: entry.role,
      courtRole: (entry as any).courtRole ?? null,
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
            // courtRole is a scalar, automatically included
          },
          messages: {
            include: { sender: { select: USER_PREVIEW_SELECT } },
            where: { deletedAt: null },
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
          deletedAt: null,
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
        description: membership.conversation.description ?? null,
        icon: membership.conversation.icon ?? null,
        imageUrl: membership.conversation.imageUrl ?? null,
        courtCaseId: (membership.conversation as any).courtCaseId ?? null,
        tagType: (membership.conversation as any).tagType ?? null,
        tagLabel: (membership.conversation as any).tagLabel ?? null,
        isFavorite: membership.isFavorite,
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
            imageUrl: (lastMessage as any).imageUrl ?? null,
              createdAt: lastMessage.createdAt,
              sender: lastMessage.sender,
            })
          : null,
        participants: participants.map((entry) => ({
          user: serializeBasicUser(entry.user),
          role: entry.role,
          courtRole: (entry as any).courtRole ?? null,
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
              include: {
                sender: { select: USER_PREVIEW_SELECT },
                reactions: {
                  include: { user: { select: { id: true, username: true } } },
                },
                replyTo: {
                  include: { sender: { select: USER_PREVIEW_SELECT } },
                },
              },
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
      messages: membership.conversation.messages.map((message) => ({
        ...serializeConversationMessage({
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          body: message.body,
          type: message.type,
            imageUrl: (message as any).imageUrl ?? null,
          courtRole: (message as any).courtRole ?? null,
          deletedAt: (message as any).deletedAt ?? null,
          deletedByUserId: (message as any).deletedByUserId ?? null,
          replyTo: (message as any).replyTo ?? null,
          createdAt: message.createdAt,
          sender: message.sender,
        }),
        reactions: (() => {
          const grouped: Record<string, { emoji: string; count: number; users: string[]; myReaction: boolean }> = {};
          for (const r of message.reactions) {
            if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [], myReaction: false };
            grouped[r.emoji].count++;
            grouped[r.emoji].users.push(r.user.username);
            if (r.userId === user.id) grouped[r.emoji].myReaction = true;
          }
          return Object.values(grouped);
        })(),
      })),
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
    const description = normalizeConversationText(req.body?.description, GROUP_DESCRIPTION_MAX_LENGTH);
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : null;
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
          description: type === 'GROUP' ? description ?? null : null,
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

if (body || imageUrl) {
          await tx.messageConversationMessage.create({
            data: {
              conversationId: created.id,
              senderId: user.id,
              body: body || '',
              type: 'TEXT',
              imageUrl: imageUrl || null,
          },
        });

        if (type === 'GROUP') {
          await recordConversationSystemMessage(
            tx,
            created.id,
            user.id,
            title
              ? `${user.username} a créé le groupe «${title}».`
              : `${user.username} a créé le groupe.`,
          );
        }
      }

      return created;
    }, { timeout: 15000, maxWait: 5000 });

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
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : null;
    const courtRole = typeof req.body?.courtRole === 'string' ? req.body.courtRole : null;
    const replyToId = typeof req.body?.replyToId === 'string' ? req.body.replyToId : null;

    if (!body && !imageUrl) {
      return res.status(400).json({ error: 'Message body or image is required' });
    }
    if (body.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'Message must be 1000 characters or less' });
    }

    // Non-admin users cannot choose arbitrary court roles.
    // For court conversations, we assign their persisted participant court role automatically.

    if (conversationId === SUPPORT_CONVERSATION_ID) {
      const images = normalizeSupportImages(imageUrl ? [imageUrl] : []);
      const message = await prisma.supportMessage.create({
        data: {
          userId: user.id,
          body,
          fromAdmin: false,
          images: images.length ? JSON.stringify(images) : null,
        },
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
      await notifyAdminsOfSupportMessage(body || 'Images', user.id, user.username);

      return res.json({ message: serializedMessage });
    }

    const membership = await prisma.messageConversationParticipant.findFirst({
      where: { conversationId, userId: user.id },
      select: { conversationId: true },
    });

    if (!membership) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const courtConversation = await prisma.messageConversation.findUnique({
      where: { id: conversationId },
      select: {
        courtCaseId: true,
        participants: {
          select: {
            userId: true,
            courtRole: true,
          },
        },
      },
    });

    let effectiveCourtRole: string | null = null;

    if (courtConversation?.courtCaseId) {
      const myCourtParticipant = courtConversation.participants.find((entry) => entry.userId === user.id) ?? null;
      effectiveCourtRole = req.user?.isAdmin ? courtRole : (myCourtParticipant?.courtRole ?? null);

      const linkedCase = await prisma.courtCase.findUnique({
        where: { id: courtConversation.courtCaseId },
        select: {
          status: true,
        },
      });

      if (linkedCase) {
        if (linkedCase.status !== 'OPEN') {
          return res.status(403).json({ error: 'Cette affaire n est pas en cours. Le chat est verrouille.' });
        }
      }
    } else if (req.user?.isAdmin) {
      effectiveCourtRole = courtRole;
    }

    const now = new Date();
    const message = await prisma.$transaction(async (tx) => {
      const createdMessage = await tx.messageConversationMessage.create({
        data: {
          conversationId,
          senderId: user.id,
          body: body || '',
          type: 'TEXT',
          imageUrl: imageUrl || null,
          ...(effectiveCourtRole ? { courtRole: effectiveCourtRole } : {}),
          ...(replyToId ? { replyToId } : {}),
        },
        include: {
          replyTo: {
            include: { sender: { select: USER_PREVIEW_SELECT } },
          },
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
    }, { timeout: 15000, maxWait: 5000 });

    const serializedMessage = serializeConversationMessage({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      type: message.type,
            imageUrl: (message as any).imageUrl ?? null,
      courtRole: (message as any).courtRole ?? null,
      replyTo: (message as any).replyTo ?? null,
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
            imageUrl: (message as any).imageUrl ?? null,
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
          link: '/messages',
          icon: 'shield-alert',
        }).catch((e) => console.error('Notification failed (support):', e))
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
      include: {
        conversation: {
          include: {
            participants: {
              select: {
                userId: true,
                courtRole: true,
              },
            },
          },
        },
      },
    });
    if (!membership) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (membership.conversation.type !== 'GROUP') {
      return res.status(400).json({ error: 'Only group conversations can be updated' });
    }
    if (!canManageCourtConversation(user, membership.conversation)) {
      return res.status(403).json({ error: 'Only judges or admins can rename court case groups' });
    }

    const title = normalizeConversationText(req.body?.title, 80);
    const description = normalizeConversationText(req.body?.description, GROUP_DESCRIPTION_MAX_LENGTH);
    const icon = normalizeConversationText(req.body?.icon, 8);
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() || null : undefined;

    const changedFields: string[] = [];
    if (title !== undefined && title !== (membership.conversation.title ?? null)) changedFields.push('nom');
    if (description !== undefined && description !== (membership.conversation.description ?? null)) changedFields.push('description');
    if (icon !== undefined && icon !== (membership.conversation.icon ?? null)) changedFields.push('icône');
    if (imageUrl !== undefined && imageUrl !== (membership.conversation.imageUrl ?? null)) changedFields.push('photo');

    const updated = await prisma.$transaction(async (tx) => {
      const conversation = await tx.messageConversation.update({
        where: { id: conversationId },
        data: {
          ...(title !== undefined ? { title: title || null } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(icon !== undefined ? { icon: icon || null } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
      });

      if (changedFields.length > 0) {
        await recordConversationSystemMessage(
          tx,
          conversationId,
          user.id,
          `${user.username} a mis à jour ${changedFields.length === 1 ? `le ${changedFields[0]}` : `les infos du groupe : ${changedFields.join(', ')}`}.`,
        );
      }

      return conversation;
    }, { timeout: 15000, maxWait: 5000 });

    await emitConversationToParticipants(conversationId, 'messaging:conversation', { conversationId });

    res.json({ conversation: { id: updated.id, title: updated.title, description: updated.description, icon: updated.icon, imageUrl: updated.imageUrl } });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// Toggle favorite for a conversation
router.patch('/conversations/:conversationId/favorite', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    const { conversationId } = req.params;
    const membership = await prisma.messageConversationParticipant.findFirst({
      where: { conversationId, userId: user.id },
    });
    if (!membership) return res.status(404).json({ error: 'Conversation not found' });
    const updated = await prisma.messageConversationParticipant.update({
      where: { id: membership.id },
      data: { isFavorite: !membership.isFavorite },
    });
    res.json({ isFavorite: updated.isFavorite });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Add member to group conversation
router.post('/conversations/:conversationId/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    const { conversationId } = req.params;
    const targetUserId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    if (!targetUserId) return res.status(400).json({ error: 'userId required' });

    const membership = await prisma.messageConversationParticipant.findFirst({
      where: { conversationId, userId: user.id },
      include: {
        conversation: {
          include: {
            participants: {
              select: {
                userId: true,
                courtRole: true,
              },
            },
          },
        },
      },
    });
    if (!membership) return res.status(404).json({ error: 'Conversation not found' });
    if (membership.conversation.type !== 'GROUP') return res.status(400).json({ error: 'Not a group' });
    if (!canManageCourtConversation(user, membership.conversation)) {
      return res.status(403).json({ error: 'Only judges or admins can add people to a court case group' });
    }

    const existing = await prisma.messageConversationParticipant.findFirst({
      where: { conversationId, userId: targetUserId },
    });
    if (existing) return res.status(400).json({ error: 'User already in group' });

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: USER_PREVIEW_SELECT });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    await prisma.$transaction(async (tx) => {
      await tx.messageConversationParticipant.create({
        data: { conversationId, userId: targetUserId, role: 'MEMBER' },
      });

      await recordConversationSystemMessage(
        tx,
        conversationId,
        user.id,
        `${user.username} a ajouté ${targetUser.username} au groupe.`,
      );
    }, { timeout: 15000, maxWait: 5000 });
    await emitConversationToParticipants(conversationId, 'messaging:conversation', { conversationId });
    io.to(`user:${targetUserId}`).emit('messaging:conversation', { conversationId });
    res.json({ success: true });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.post('/conversations/:conversationId/witness-requests', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const { conversationId } = req.params;
    const witnessUserId = typeof req.body?.witnessUserId === 'string' ? req.body.witnessUserId.trim() : '';
    const anonymous = Boolean(req.body?.anonymous);

    if (!witnessUserId) {
      return res.status(400).json({ error: 'witnessUserId required' });
    }
    if (isAdminUser(user)) {
      return res.status(400).json({ error: 'Admins can directly manage participants without witness requests' });
    }

    const membership = await prisma.messageConversationParticipant.findFirst({
      where: { conversationId, userId: user.id },
      include: {
        conversation: {
          select: {
            id: true,
            courtCaseId: true,
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    isAdmin: true,
                    isSuperAdmin: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (!membership.conversation.courtCaseId) {
      return res.status(400).json({ error: 'Witness requests are only available in court case conversations' });
    }

    const existingMember = await prisma.messageConversationParticipant.findFirst({
      where: { conversationId, userId: witnessUserId },
      select: { id: true },
    });
    if (existingMember) {
      return res.status(400).json({ error: 'This witness is already in the case conversation' });
    }

    const witnessUser = await prisma.user.findUnique({
      where: { id: witnessUserId },
      select: { id: true, username: true, isApproved: true },
    });
    if (!witnessUser?.isApproved) {
      return res.status(404).json({ error: 'Witness not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.messageConversationMessage.create({
        data: {
          conversationId,
          senderId: user.id,
          type: 'COURT_SYSTEM',
          body: `${anonymous
            ? `${user.username} demande l'ajout d'un temoin anonyme.`
            : `${user.username} demande l'ajout du temoin ${witnessUser.username}.`} [[WITNESS_REQUEST:${witnessUser.id}:${anonymous ? '1' : '0'}]]`,
        },
      });

      await tx.messageConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });
    }, { timeout: 15000, maxWait: 5000 });

    const adminParticipants = membership.conversation.participants.filter((entry) => isAdminUser(entry.user));

    await Promise.all(
      adminParticipants
        .filter((entry) => entry.userId !== user.id)
        .map((entry) =>
          createNotification({
            userId: entry.userId,
            type: 'SUPPORT_MESSAGE',
            title: 'Demande de temoin',
            body: anonymous
              ? `${user.username} demande un temoin anonyme sur un dossier.`
              : `${user.username} demande ${witnessUser.username} comme temoin sur un dossier.`,
            data: {
              conversationId,
              witnessUserId: witnessUser.id,
              anonymous,
            },
            link: `/messages?conversation=${conversationId}`,
            icon: 'scale',
          }).catch((e) => console.error('Notification failed (support):', e))
        )
    );

    await emitConversationToParticipants(conversationId, 'messaging:conversation', { conversationId });

    res.json({ success: true });
  } catch (error) {
    console.error('Witness request error:', error);
    res.status(500).json({ error: 'Failed to request witness' });
  }
});

// Remove (kick) member from group conversation
router.delete('/conversations/:conversationId/members/:memberId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    const { conversationId, memberId } = req.params;

    const [actorMembership, targetMembership] = await Promise.all([
      prisma.messageConversationParticipant.findFirst({
        where: { conversationId, userId: user.id },
        include: { conversation: true },
      }),
      prisma.messageConversationParticipant.findFirst({
        where: { conversationId, userId: memberId },
      }),
    ]);

    if (!actorMembership) return res.status(404).json({ error: 'Conversation not found' });
    if (actorMembership.conversation.type !== 'GROUP') return res.status(400).json({ error: 'Not a group' });
    if (!targetMembership) return res.status(404).json({ error: 'Member not found' });
    // Only OWNER can kick, or user can leave themselves
    if (memberId !== user.id && actorMembership.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only group owner can kick members' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: memberId }, select: USER_PREVIEW_SELECT });
    if (!targetUser) return res.status(404).json({ error: 'Member not found' });

    await prisma.$transaction(async (tx) => {
      await tx.messageConversationParticipant.delete({ where: { id: targetMembership.id } });
      await recordConversationSystemMessage(
        tx,
        conversationId,
        user.id,
        memberId === user.id
          ? `${user.username} a quitté le groupe.`
          : `${user.username} a retiré ${targetUser.username} du groupe.`,
      );
    }, { timeout: 15000, maxWait: 5000 });
    await emitConversationToParticipants(conversationId, 'messaging:conversation', { conversationId });
    res.json({ success: true });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Toggle reaction on a message
router.post('/conversations/:conversationId/messages/:messageId/react', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    const { conversationId, messageId } = req.params;
    const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji.trim().slice(0, 8) : '';
    if (!emoji) return res.status(400).json({ error: 'emoji required' });

    const membership = await prisma.messageConversationParticipant.findFirst({
      where: { conversationId, userId: user.id },
    });
    if (!membership) return res.status(404).json({ error: 'Conversation not found' });

    const message = await prisma.messageConversationMessage.findFirst({
      where: { id: messageId, conversationId },
      select: { id: true },
    });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const existing = await prisma.messageConversationReaction.findFirst({
      where: { messageId, userId: user.id, emoji },
    });

    let added: boolean;
    if (existing) {
      await prisma.messageConversationReaction.delete({ where: { id: existing.id } });
      added = false;
    } else {
      await prisma.messageConversationReaction.create({
        data: { messageId, conversationId, userId: user.id, emoji },
      });
      added = true;
    }

    await emitConversationToParticipants(conversationId, 'messaging:message', { conversationId, messageId });
    res.json({ added });
  } catch (error) {
    console.error('React to message error:', error);
    res.status(500).json({ error: 'Failed to react' });
  }
});

// Delete a message from a conversation (admin moderation)
router.delete('/conversations/:conversationId/messages/:messageId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    const { conversationId, messageId } = req.params;
    const isAdminActor = Boolean(user.isAdmin || user.isSuperAdmin);

    if (!isAdminActor) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const isAdminSupportConversation = conversationId.startsWith(ADMIN_SUPPORT_CONVERSATION_PREFIX);
    if (conversationId === SUPPORT_CONVERSATION_ID || isAdminSupportConversation) {
      const supportMessage = await prisma.supportMessage.findUnique({
        where: { id: messageId },
        select: { id: true, userId: true, deletedAt: true },
      });

      if (!supportMessage) {
        return res.status(404).json({ error: 'Message not found' });
      }

      if (isAdminSupportConversation) {
        const expectedUserId = conversationId.slice(ADMIN_SUPPORT_CONVERSATION_PREFIX.length);
        if (supportMessage.userId !== expectedUserId) {
          return res.status(404).json({ error: 'Message not found in this conversation' });
        }
      }

      if (!supportMessage.deletedAt) {
        await prisma.supportMessage.update({
          where: { id: supportMessage.id },
          data: {
            deletedAt: new Date(),
            deletedByUserId: user.id,
          },
        });
      }

      io.to('admin:support').emit('support:message', {
        message: null,
        deletedMessageId: supportMessage.id,
        userId: supportMessage.userId,
      });

      return res.json({ success: true });
    }

    const targetMessage = await prisma.messageConversationMessage.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, deletedAt: true },
    });

    if (!targetMessage || targetMessage.conversationId !== conversationId) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (!targetMessage.deletedAt) {
      await prisma.messageConversationMessage.update({
        where: { id: targetMessage.id },
        data: {
          deletedAt: new Date(),
          deletedByUserId: user.id,
        },
      });
    }

    await emitConversationToParticipants(conversationId, 'messaging:conversation', { conversationId });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Block a user
router.post('/block/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    const { userId } = req.params;
    if (userId === user.id) return res.status(400).json({ error: 'Cannot block yourself' });
    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: userId } },
      create: { blockerId: user.id, blockedId: userId },
      update: {},
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock a user
router.delete('/block/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    const { userId } = req.params;
    await prisma.userBlock.deleteMany({
      where: { blockerId: user.id, blockedId: userId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Get blocked users
router.get('/blocked', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId: user.id },
      include: { blocked: { select: USER_PREVIEW_SELECT } },
    });
    res.json({ blockedUsers: blocks.map((b) => serializeBasicUser(b.blocked)) });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'Failed to get blocked users' });
  }
});

router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const [supportUnreadCount, memberships] = await Promise.all([
      prisma.supportMessage.count({
        where: { userId: user.id, fromAdmin: true, isRead: false, deletedAt: null },
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
            deletedAt: null,
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

    const userRows = await prisma.supportMessage.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });

    const threads = (await Promise.all(
      userRows.map(async ({ userId }) => {
        const [lastVisibleMessage, unreadCount] = await Promise.all([
          prisma.supportMessage.findFirst({
            where: { userId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { body: true, fromAdmin: true, createdAt: true },
          }),
          prisma.supportMessage.count({
            where: { userId, fromAdmin: false, isRead: false, deletedAt: null },
          }),
        ]);

        if (!lastVisibleMessage) {
          return null;
        }

        return {
          userId,
          lastBody: lastVisibleMessage.body,
          lastFromAdmin: lastVisibleMessage.fromAdmin,
          lastCreatedAt: lastVisibleMessage.createdAt.toISOString(),
          unreadCount,
        };
      })
    )).filter((thread): thread is {
      userId: string;
      lastBody: string;
      lastFromAdmin: boolean;
      lastCreatedAt: string;
      unreadCount: number;
    } => thread !== null);

    threads.sort((a, b) => Date.parse(b.lastCreatedAt) - Date.parse(a.lastCreatedAt));

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
        lastFromAdmin: thread.lastFromAdmin,
        lastCreatedAt: thread.lastCreatedAt,
        unreadCount: thread.unreadCount,
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

    const adminId = req.user!.id;
    const { userId } = req.params;
    const [messages, user] = await Promise.all([
      prisma.supportMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: {
          reactions: { include: { user: { select: { id: true, username: true } } } },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: USER_PREVIEW_SELECT,
      }),
    ]);

    res.json({
      messages: messages.map((msg) => ({
        ...serializeSupportMessage(msg),
        reactions: groupSupportReactions(msg.reactions, adminId),
      })),
      user,
    });
  } catch (error) {
    console.error('Get support thread error:', error);
    res.status(500).json({ error: 'Failed to get thread' });
  }
});

router.post('/admin/threads/:userId/messages/:messageId/react', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const adminId = req.user!.id;
    const { messageId } = req.params;
    const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji.trim().slice(0, 8) : '';
    if (!emoji) return res.status(400).json({ error: 'emoji required' });

    const message = await prisma.supportMessage.findUnique({ where: { id: messageId }, select: { id: true } });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const existing = await prisma.supportMessageReaction.findFirst({
      where: { messageId, userId: adminId, emoji },
    });

    let added: boolean;
    if (existing) {
      await prisma.supportMessageReaction.delete({ where: { id: existing.id } });
      added = false;
    } else {
      await prisma.supportMessageReaction.create({ data: { messageId, userId: adminId, emoji } });
      added = true;
    }

    res.json({ added });
  } catch (error) {
    console.error('React to support message error:', error);
    res.status(500).json({ error: 'Failed to react' });
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
