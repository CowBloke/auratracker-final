import { Socket, Server } from 'socket.io';

// Store active webcam users
const activeWebcamUsers = new Set<string>();
const userSocketMap = new Map<string, string>(); // userId -> socketId

export const setupWebcamHandlers = (socket: Socket, io: Server) => {
  // User starts webcam
  socket.on('webcam:start', (data: { userId: string }) => {
    const { userId } = data;
    activeWebcamUsers.add(userId);
    userSocketMap.set(userId, socket.id);

    // Notify all other users that this user started their webcam
    socket.broadcast.emit('webcam:user-started', { userId });
  });

  // User stops webcam
  socket.on('webcam:stop', (data: { userId: string }) => {
    const { userId } = data;
    activeWebcamUsers.delete(userId);
    userSocketMap.delete(userId);

    // Notify all other users that this user stopped their webcam
    socket.broadcast.emit('webcam:user-stopped', { userId });
  });

  // Get list of active webcam users
  socket.on('webcam:get-active-users', () => {
    const userIds = Array.from(activeWebcamUsers);
    socket.emit('webcam:active-users', { userIds });
  });

  // Forward WebRTC offer
  socket.on('webcam:offer', (data: { fromUserId: string; toUserId: string; offer: RTCSessionDescriptionInit }) => {
    const { fromUserId, toUserId, offer } = data;
    const targetSocketId = userSocketMap.get(toUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('webcam:offer', {
        fromUserId,
        offer,
      });
    }
  });

  // Forward WebRTC answer
  socket.on('webcam:answer', (data: { fromUserId: string; toUserId: string; answer: RTCSessionDescriptionInit }) => {
    const { fromUserId, toUserId, answer } = data;
    const targetSocketId = userSocketMap.get(toUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('webcam:answer', {
        fromUserId,
        answer,
      });
    }
  });

  // Forward ICE candidate
  socket.on('webcam:ice-candidate', (data: { fromUserId: string; toUserId: string; candidate: RTCIceCandidateInit }) => {
    const { fromUserId, toUserId, candidate } = data;
    const targetSocketId = userSocketMap.get(toUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('webcam:ice-candidate', {
        fromUserId,
        candidate,
      });
    }
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    // Find and remove user from active webcam users
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        activeWebcamUsers.delete(userId);
        userSocketMap.delete(userId);
        // Notify others that this user stopped (use io since socket is disconnected)
        io.emit('webcam:user-stopped', { userId });
        break;
      }
    }
  });
};
