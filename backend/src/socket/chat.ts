import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';

interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
}

const onlineUsers = new Map<string, OnlineUser>();

export const setupChatHandlers = (socket: Socket, io: Server) => {
  // Join chat
  socket.on('chat:join', async (data: { userId: string; username: string }) => {
    const { userId, username } = data;
    
    // Store user info
    onlineUsers.set(userId, {
      userId,
      username,
      socketId: socket.id,
    });
    
    // Join global chat room
    socket.join('global-chat');
    
    // Send chat history
    const messages = await prisma.chatMessage.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    socket.emit('chat:history', {
      messages: messages.reverse().map((m) => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        message: m.message,
        timestamp: m.createdAt.toISOString(),
      })),
    });
    
    // Notify others
    socket.to('global-chat').emit('user:online', { userId, username });
    
    // Send current online users to the joining user
    const onlineList = Array.from(onlineUsers.values()).map((u) => ({
      userId: u.userId,
      username: u.username,
    }));
    socket.emit('users:online-list', { users: onlineList });
  });
  
  // Send message
  socket.on('chat:message', async (data: { message: string; userId: string }) => {
    const { message, userId } = data;
    
    const user = onlineUsers.get(userId);
    if (!user) return;
    
    // Save message to database
    const savedMessage = await prisma.chatMessage.create({
      data: {
        userId,
        message,
      },
    });
    
    // Broadcast to all in chat
    io.to('global-chat').emit('chat:message', {
      id: savedMessage.id,
      userId,
      username: user.username,
      message,
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
