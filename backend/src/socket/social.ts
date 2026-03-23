import { Server, Socket } from 'socket.io';
import { prisma } from '../server.js';
import { createNotification } from '../utils/notifications.js';
import {
  SOCIAL_USER_SELECT,
  buildConversationSummaryForViewer,
  getCanonicalConversationPair,
} from '../utils/social.js';

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

const emitConversationSummary = async (io: Server, conversationId: string, participantIds: string[]) => {
  const conversation = await prisma.privateConversation.findUnique({
    where: { id: conversationId },
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

  if (!conversation) return;

  participantIds.forEach((participantId) => {
    io.to(`user:${participantId}`).emit('social:conversation-updated', {
      conversation: buildConversationSummaryForViewer(conversation, participantId),
    });
  });
};

export const setupSocialHandlers = (socket: Socket, io: Server) => {
  socket.on('social:conversation:join', async ({ conversationId }: { conversationId?: string }) => {
    if (!conversationId || !socket.data.userId) return;

    const conversation = await prisma.privateConversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { participantOneId: socket.data.userId },
          { participantTwoId: socket.data.userId },
        ],
      },
      select: { id: true },
    });

    if (!conversation) return;
    socket.join(`social:conversation:${conversationId}`);
  });

  socket.on('social:conversation:leave', ({ conversationId }: { conversationId?: string }) => {
    if (!conversationId) return;
    socket.leave(`social:conversation:${conversationId}`);
  });

  socket.on('social:message', async ({ targetUserId, body }: { targetUserId?: string; body?: string }) => {
    const senderId = socket.data.userId as string | undefined;
    const senderUsername = socket.data.username as string | undefined;
    const trimmedBody = body?.trim();

    if (!senderId || !senderUsername || !targetUserId || !trimmedBody || senderId === targetUserId) {
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isApproved: true },
    });

    if (!targetUser?.isApproved) {
      return;
    }

    const [participantOneId, participantTwoId] = getCanonicalConversationPair(senderId, targetUserId);
    const conversation = await prisma.privateConversation.upsert({
      where: {
        participantOneId_participantTwoId: {
          participantOneId,
          participantTwoId,
        },
      },
      create: {
        participantOneId,
        participantTwoId,
        lastMessageAt: new Date(),
      },
      update: {
        lastMessageAt: new Date(),
      },
    });

    const message = await prisma.privateMessage.create({
      data: {
        conversationId: conversation.id,
        senderId,
        body: trimmedBody,
      },
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

    const serializedMessage = serializePrivateMessage(message);
    const conversationRoom = `social:conversation:${conversation.id}`;

    io.to(`user:${senderId}`).emit('social:message', { message: serializedMessage });
    io.to(`user:${targetUserId}`).emit('social:message', { message: serializedMessage });
    io.to(conversationRoom).emit('social:message', { message: serializedMessage });

    await emitConversationSummary(io, conversation.id, [senderId, targetUserId]);

    await createNotification({
      userId: targetUserId,
      type: 'DIRECT_MESSAGE',
      title: 'Nouveau message privé',
      body: `${senderUsername} vous a écrit en privé.`,
      link: `/messages?userId=${senderId}`,
      icon: 'message-square',
    });
  });

  socket.on('social:conversation:read', async ({ conversationId }: { conversationId?: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!conversationId || !userId) return;

    const conversation = await prisma.privateConversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      select: {
        id: true,
        participantOneId: true,
        participantTwoId: true,
      },
    });

    if (!conversation) return;

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

    const participantIds = [conversation.participantOneId, conversation.participantTwoId];
    await emitConversationSummary(io, conversation.id, participantIds);
    participantIds.forEach((participantId) => {
      io.to(`user:${participantId}`).emit('social:conversation-read', { conversationId });
    });
  });
};
