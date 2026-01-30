import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { logChat } from '../utils/logger.js';

interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  currentPage?: string | null;
}

const onlineUsers = new Map<string, OnlineUser>();

const summarizeReactions = (reactions: Array<{ emoji: string }>) => {
  const counts = new Map<string, number>();
  reactions.forEach((reaction) => {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  });
  return Array.from(counts.entries()).map(([emoji, count]) => ({ emoji, count }));
};

const getTopLeaderboardIds = async () => {
  const [topMoney, topAura] = await Promise.all([
    prisma.user.findMany({
      where: { isAdmin: false },
      select: { id: true },
      orderBy: { money: 'desc' },
      take: 5,
    }),
    prisma.user.findMany({
      where: { isAdmin: false },
      select: { id: true },
      orderBy: { aura: 'desc' },
      take: 5,
    }),
  ]);

  return {
    topMoneyIds: new Set(topMoney.map((u) => u.id)),
    topAuraIds: new Set(topAura.map((u) => u.id)),
  };
};

export const startOnlineCountBroadcast = (io: Server) => {
  setInterval(() => {
    io.to('global-chat').emit('users:online-count', { count: onlineUsers.size });
  }, 5000);
};

export const setupChatHandlers = (socket: Socket, io: Server) => {
  // Join chat
  socket.on('chat:join', async (data: { currentPage?: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const currentPage = data?.currentPage;

    // Check if user is banned
    const activeBan = await prisma.ban.findFirst({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null }, // Permanent ban
          { expiresAt: { gt: new Date() } }, // Temporary ban not yet expired
        ],
      },
      select: {
        reason: true,
        type: true,
        expiresAt: true,
      },
    });

    if (activeBan) {
      const message = activeBan.type === 'PERMANENT'
        ? `Your account has been permanently banned. Reason: ${activeBan.reason}`
        : `Your account is temporarily banned until ${activeBan.expiresAt?.toISOString()}. Reason: ${activeBan.reason}`;

      socket.emit('ban:active', {
        message,
        banned: true,
        ban: {
          reason: activeBan.reason,
          type: activeBan.type,
          expiresAt: activeBan.expiresAt ? activeBan.expiresAt.toISOString() : null,
        },
      });
      return;
    }

    // Fetch user cosmetics from database
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        usernameColor: true,
        profilePicture: true,
        isChatMuted: true,
      },
    });
    if (!dbUser) return;

    if (dbUser?.isChatMuted) {
      socket.emit('chat:muted', { message: 'Vous avez été mute du chat par un admin.' });
    }

    // Store user info
    onlineUsers.set(userId, {
      userId,
      username: dbUser.username,
      socketId: socket.id,
      usernameColor: dbUser?.usernameColor,
      profilePicture: dbUser?.profilePicture,
      currentPage: currentPage ?? null,
    });
    socket.join(`user:${userId}`);

    // Join global chat room
    socket.join('global-chat');
    
    const { topMoneyIds, topAuraIds } = await getTopLeaderboardIds();

    // Send chat history with user cosmetics
    const messages = await prisma.chatMessage.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
            profilePicture: true,
            userBadges: {
              where: { isSelected: true },
              take: 2,
              select: {
                badge: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    color: true,
                  },
                },
              },
            },
          },
        },
        reactions: {
          select: {
            emoji: true,
          },
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
              },
            },
          },
        },
      },
    });
    
    socket.emit('chat:history', {
      messages: messages.reverse().map((m) => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        usernameColor: m.user.usernameColor,
        profilePicture: m.user.profilePicture,
        badges: m.user.userBadges.map((ub) => ub.badge),
        message: m.message,
        pinned: m.pinned,
        pinnedAt: m.pinnedAt ? m.pinnedAt.toISOString() : null,
        isTopMoney: topMoneyIds.has(m.userId),
        isTopAura: topAuraIds.has(m.userId),
        reactions: summarizeReactions(m.reactions),
        replyTo: m.replyTo
          ? {
              id: m.replyTo.id,
              userId: m.replyTo.userId,
              username: m.replyTo.user.username,
              usernameColor: m.replyTo.user.usernameColor,
              message: m.replyTo.message,
            }
          : null,
        timestamp: m.createdAt.toISOString(),
      })),
    });
    
    // Notify others with cosmetics
    socket.to('global-chat').emit('user:online', { 
      userId, 
      username: dbUser.username,
      usernameColor: dbUser?.usernameColor,
      profilePicture: dbUser?.profilePicture,
      currentPage: currentPage ?? null,
    });
    
    // Send current online users to the joining user with cosmetics
    const onlineList = Array.from(onlineUsers.values()).map((u) => ({
      userId: u.userId,
      username: u.username,
      usernameColor: u.usernameColor,
      profilePicture: u.profilePicture,
      currentPage: u.currentPage ?? null,
    }));
    socket.emit('users:online-list', { users: onlineList });
  });
  
  // Send message
  socket.on('chat:message', async (data: { message: string; replyToId?: string | null }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { message, replyToId } = data;

    const user = onlineUsers.get(userId);
    if (!user) return;

    // Check if user is banned before allowing message
    const activeBan = await prisma.ban.findFirst({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (activeBan) {
      socket.emit('ban:active', {
        banned: true,
        ban: {
          reason: activeBan.reason,
          type: activeBan.type,
          expiresAt: activeBan.expiresAt ? activeBan.expiresAt.toISOString() : null,
        },
      });
      return;
    }

    // Fetch latest cosmetics from database (in case they changed)
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        usernameColor: true,
        profilePicture: true,
        isChatMuted: true,
        userBadges: {
          where: { isSelected: true },
          take: 2,
          select: {
            badge: {
              select: {
                id: true,
                name: true,
                description: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (dbUser?.isChatMuted) {
      socket.emit('chat:muted', { message: 'Vous êtes mute du chat pour le moment.' });
      return;
    }
    
    // Update cached cosmetics
    if (dbUser) {
      user.usernameColor = dbUser.usernameColor;
      user.profilePicture = dbUser.profilePicture;
    }
    
    const replyTo = replyToId
      ? await prisma.chatMessage.findUnique({
          where: { id: replyToId },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
              },
            },
          },
        })
      : null;

    // Save message to database
    const savedMessage = await prisma.chatMessage.create({
      data: {
        userId,
        message,
        replyToId: replyTo?.id ?? null,
      },
    });
    
    // Log message sent
    logChat('message_sent', userId, user.username, {
      messageId: savedMessage.id,
      messageLength: message.length,
      hasReply: !!replyTo,
    });

    // Broadcast to all in chat with cosmetics
    const { topMoneyIds, topAuraIds } = await getTopLeaderboardIds();

    io.to('global-chat').emit('chat:message', {
      id: savedMessage.id,
      userId,
      username: user.username,
      usernameColor: dbUser?.usernameColor,
      profilePicture: dbUser?.profilePicture,
      badges: dbUser?.userBadges.map((ub) => ub.badge) ?? [],
      message,
      pinned: false,
      pinnedAt: null,
      isTopMoney: topMoneyIds.has(userId),
      isTopAura: topAuraIds.has(userId),
      reactions: [],
      replyTo: replyTo
        ? {
            id: replyTo.id,
            userId: replyTo.userId,
            username: replyTo.user.username,
            usernameColor: replyTo.user.usernameColor,
            message: replyTo.message,
          }
        : null,
      timestamp: savedMessage.createdAt.toISOString(),
    });
    
    // Cleanup old messages (keep last 1000)
    const messageCount = await prisma.chatMessage.count();
    if (messageCount > 1000) {
      const oldMessages = await prisma.chatMessage.findMany({
        take: messageCount - 1000,
        where: { pinned: false },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (oldMessages.length > 0) {
        await prisma.chatMessage.deleteMany({
          where: { id: { in: oldMessages.map((m) => m.id) } },
        });
      }
    }
  });
  
  // Typing indicator
  socket.on('chat:typing', (data: { userId: string; isTyping: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { isTyping } = data;
    const user = onlineUsers.get(userId);
    if (!user) return;
    
    socket.to('global-chat').emit('chat:typing', {
      userId,
      username: user.username,
      isTyping,
    });
  });

  socket.on('chat:page', (data: { currentPage: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { currentPage } = data;
    const user = onlineUsers.get(userId);
    if (!user) return;

    user.currentPage = currentPage;
  });

  // On-demand: client requests the full online users list (with pages)
  socket.on('chat:request-online-users', () => {
    const onlineList = Array.from(onlineUsers.values()).map((u) => ({
      userId: u.userId,
      username: u.username,
      usernameColor: u.usernameColor,
      profilePicture: u.profilePicture,
      currentPage: u.currentPage ?? null,
    }));
    socket.emit('users:online-list', { users: onlineList });
  });

  socket.on('chat:reaction', async (data: { messageId: string; emoji: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { messageId, emoji } = data;
    const user = onlineUsers.get(userId);
    if (!user) return;

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true },
    });
    if (!message) return;

    const existingReaction = await prisma.chatReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    if (existingReaction) {
      await prisma.chatReaction.delete({
        where: {
          id: existingReaction.id,
        },
      });
    } else {
      await prisma.chatReaction.create({
        data: {
          messageId,
          userId,
          emoji,
        },
      });
    }

    const reactionCounts = await prisma.chatReaction.groupBy({
      by: ['emoji'],
      where: { messageId },
      _count: { emoji: true },
    });

    io.to('global-chat').emit('chat:reactions-updated', {
      messageId,
      reactions: reactionCounts.map((entry) => ({
        emoji: entry.emoji,
        count: entry._count.emoji,
      })),
    });
  });

  socket.on('chat:pin', async (data: { messageId: string; pinned: boolean }) => {
    const adminId = socket.data.userId as string | undefined;
    if (!adminId) return;
    const { messageId, pinned } = data;

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { isAdmin: true },
    });

    if (!admin || !admin.isAdmin) {
      return;
    }

    try {
      const updated = await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          pinned,
          pinnedAt: pinned ? new Date() : null,
        },
        select: { pinned: true, pinnedAt: true },
      });

      io.to('global-chat').emit('chat:pin-updated', {
        messageId,
        pinned: updated.pinned,
        pinnedAt: updated.pinnedAt ? updated.pinnedAt.toISOString() : null,
      });
    } catch (error) {
      console.error('Error pinning message:', error);
    }
  });

  // Delete message (admin only)
  socket.on('chat:delete-message', async (data: { messageId: string }) => {
    const adminId = socket.data.userId as string | undefined;
    if (!adminId) return;
    const { messageId } = data;

    // Verify admin status
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { isAdmin: true },
    });

    if (!admin || !admin.isAdmin) {
      return; // Silently fail if not admin
    }

    try {
      // Get the message before deleting for logging
      const messageToDelete = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        include: { user: { select: { username: true } } },
      });

      // Delete the message from database
      await prisma.chatMessage.delete({
        where: { id: messageId },
      });

      // Log message deletion
      logChat('message_deleted', adminId, admin.isAdmin ? 'admin' : undefined, {
        deletedMessageId: messageId,
        originalAuthor: messageToDelete?.user.username,
        originalAuthorId: messageToDelete?.userId,
      });

      // Broadcast deletion to all users
      io.to('global-chat').emit('chat:message-deleted', { messageId });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    // Find and remove user from online list
    for (const [userId, user] of onlineUsers.entries()) {
      if (user.socketId === socket.id) {
        onlineUsers.delete(userId);
        io.to('global-chat').emit('user:offline', {
          userId,
          username: user.username,
        });
        break;
      }
    }
  });
};

export { onlineUsers };
