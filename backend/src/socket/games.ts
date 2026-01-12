import { Socket, Server } from 'socket.io';

interface GameInvite {
  gameType: string;
  inviterId: string;
  inviterUsername: string;
}

const gameInvites = new Map<string, GameInvite[]>(); // userId -> invites
const userGameSockets = new Map<string, string>(); // userId -> socketId

export const setupGameHandlers = (socket: Socket, io: Server) => {
  // Register socket for game events
  socket.on('game:register', (data: { userId: string }) => {
    userGameSockets.set(data.userId, socket.id);
  });
  
  // Invite to game
  socket.on('game:invite', (data: {
    userId: string;
    username: string;
    targetUserId: string;
    gameType: string;
  }) => {
    const { userId, username, targetUserId, gameType } = data;
    
    // Store invite
    const invites = gameInvites.get(targetUserId) || [];
    invites.push({
      gameType,
      inviterId: userId,
      inviterUsername: username,
    });
    gameInvites.set(targetUserId, invites);
    
    // Notify target user
    const targetSocketId = userGameSockets.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('game:invite', {
        gameType,
        inviterId: userId,
        inviterUsername: username,
      });
    }
    
    socket.emit('game:invite-sent', { targetUserId, gameType });
  });
  
  // Accept game invite
  socket.on('game:accept-invite', (data: {
    userId: string;
    inviterId: string;
    gameType: string;
  }) => {
    const { userId, inviterId, gameType } = data;
    
    // Clear invite
    const invites = gameInvites.get(userId) || [];
    gameInvites.set(
      userId,
      invites.filter((i) => i.inviterId !== inviterId || i.gameType !== gameType)
    );
    
    // Notify inviter
    const inviterSocketId = userGameSockets.get(inviterId);
    if (inviterSocketId) {
      io.to(inviterSocketId).emit('game:invite-accepted', {
        userId,
        gameType,
      });
    }
    
    // Create game room
    const gameRoomId = `game:${gameType}:${Date.now()}`;
    socket.join(gameRoomId);
    
    if (inviterSocketId) {
      const inviterSocket = io.sockets.sockets.get(inviterSocketId);
      if (inviterSocket) {
        inviterSocket.join(gameRoomId);
      }
    }
    
    // Emit game start to both players
    io.to(gameRoomId).emit('game:start', {
      gameType,
      roomId: gameRoomId,
      players: [userId, inviterId],
    });
  });
  
  // Decline game invite
  socket.on('game:decline-invite', (data: {
    userId: string;
    inviterId: string;
    gameType: string;
  }) => {
    const { userId, inviterId, gameType } = data;
    
    // Clear invite
    const invites = gameInvites.get(userId) || [];
    gameInvites.set(
      userId,
      invites.filter((i) => i.inviterId !== inviterId || i.gameType !== gameType)
    );
    
    // Notify inviter
    const inviterSocketId = userGameSockets.get(inviterId);
    if (inviterSocketId) {
      io.to(inviterSocketId).emit('game:invite-declined', {
        userId,
        gameType,
      });
    }
  });
  
  // Game update (for real-time multiplayer)
  socket.on('game:update', (data: {
    roomId: string;
    gameState: any;
  }) => {
    const { roomId, gameState } = data;
    socket.to(roomId).emit('game:update', { gameState });
  });
  
  // Game end
  socket.on('game:end', (data: {
    roomId: string;
    winnerId?: string;
    scores?: Record<string, number>;
  }) => {
    const { roomId, winnerId, scores } = data;
    io.to(roomId).emit('game:end', { winnerId, scores });
    
    // Clean up room
    io.in(roomId).socketsLeave(roomId);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    for (const [userId, socketId] of userGameSockets.entries()) {
      if (socketId === socket.id) {
        userGameSockets.delete(userId);
        break;
      }
    }
  });
};
