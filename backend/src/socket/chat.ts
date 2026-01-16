import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';

interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  currentPage?: string | null;
}

const onlineUsers = new Map<string, OnlineUser>();

export const setupChatHandlers = (socket: Socket, io: Server) => {
  // Join chat
  socket.on('chat:join', async (data: { userId: string; username: string; currentPage?: string }) => {
    const { userId, username, currentPage } = data;

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

      socket.emit('ban:active', { message, banned: true });
      return;
    }

    // Fetch user cosmetics from database
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        usernameColor: true,
        profilePicture: true,
      },
    });

    // Store user info
    onlineUsers.set(userId, {
      userId,
      username,
      socketId: socket.id,
      usernameColor: dbUser?.usernameColor,
      profilePicture: dbUser?.profilePicture,
      currentPage: currentPage ?? null,
    });

    // Join global chat room
    socket.join('global-chat');
    
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
        message: m.message,
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
      username,
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
  socket.on('chat:message', async (data: { message: string; userId: string; replyToId?: string | null }) => {
    const { message, userId, replyToId } = data;

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
      socket.emit('ban:active', { banned: true });
      return;
    }

    // Fetch latest cosmetics from database (in case they changed)
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        usernameColor: true,
        profilePicture: true,
      },
    });
    
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
    
    // Broadcast to all in chat with cosmetics
    io.to('global-chat').emit('chat:message', {
      id: savedMessage.id,
      userId,
      username: user.username,
      usernameColor: dbUser?.usernameColor,
      profilePicture: dbUser?.profilePicture,
      message,
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
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      await prisma.chatMessage.deleteMany({
        where: { id: { in: oldMessages.map((m) => m.id) } },
      });
    }
  });
  
  // Typing indicator
  socket.on('chat:typing', (data: { userId: string; isTyping: boolean }) => {
    const { userId, isTyping } = data;
    const user = onlineUsers.get(userId);
    if (!user) return;
    
    socket.to('global-chat').emit('chat:typing', {
      userId,
      username: user.username,
      isTyping,
    });
  });

  socket.on('chat:page', (data: { userId: string; currentPage: string }) => {
    const { userId, currentPage } = data;
    const user = onlineUsers.get(userId);
    if (!user) return;

    user.currentPage = currentPage;
    io.to('global-chat').emit('user:page', { userId, currentPage });
  });

  // Delete message (admin only)
  socket.on('chat:delete-message', async (data: { messageId: string; adminId: string }) => {
    const { messageId, adminId } = data;

    // Verify admin status
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { isAdmin: true },
    });

    if (!admin || !admin.isAdmin) {
      return; // Silently fail if not admin
    }

    try {
      // Delete the message from database
      await prisma.chatMessage.delete({
        where: { id: messageId },
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
