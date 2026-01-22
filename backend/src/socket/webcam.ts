import { Socket, Server } from 'socket.io';

interface WebcamUser {
  userId: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  currentPage?: string | null;
  socketId: string;
}

const webcamUsers = new Map<string, WebcamUser>(); // userId -> user info
const socketToUserId = new Map<string, string>(); // socketId -> userId

const getActiveUsers = (): WebcamUser[] => {
  return Array.from(webcamUsers.values());
};

export const setupWebcamHandlers = (socket: Socket, io: Server) => {
  // Émettre le nombre d'utilisateurs actifs à tous les clients
  const broadcastActiveCount = () => {
    const count = webcamUsers.size;
    console.log(`[Webcam] Broadcasting active count to all clients: ${count}`);
    io.emit('webcam:active-count', { count });
  };

  // Envoyer le compteur initial au nouveau client connecté
  const initialCount = webcamUsers.size;
  console.log(`[Webcam] New client connected (${socket.id}), sending initial count: ${initialCount}`);
  // Envoyer immédiatement et aussi avec un petit délai pour s'assurer que le client est prêt
  socket.emit('webcam:active-count', { count: initialCount });
  setTimeout(() => {
    socket.emit('webcam:active-count', { count: webcamUsers.size });
  }, 500);

  // Rejoindre la webcam
  socket.on('webcam:join', (data: {
    userId: string;
    username: string;
    usernameColor?: string | null;
    profilePicture?: string | null;
    currentPage?: string | null;
  }) => {
    const { userId, username, usernameColor, profilePicture, currentPage } = data;

    // Stocker l'utilisateur
    const userInfo: WebcamUser = {
      userId,
      username,
      usernameColor,
      profilePicture,
      currentPage,
      socketId: socket.id,
    };
    
    webcamUsers.set(userId, userInfo);
    socketToUserId.set(socket.id, userId);

    // Rejoindre la room webcam
    socket.join('webcam');

    // Notifier tous les autres utilisateurs
    const activeUsers = getActiveUsers();
    console.log(`[Webcam] User ${userId} joined. Active users:`, activeUsers.map(u => u.userId));
    socket.broadcast.to('webcam').emit('webcam:user-joined', {
      user: userInfo,
      activeUsers,
    });

    // Envoyer la liste des utilisateurs actifs au nouvel utilisateur
    const otherUsers = activeUsers.filter(u => u.userId !== userId);
    console.log(`[Webcam] Sending active users to ${userId}:`, otherUsers.map(u => u.userId));
    socket.emit('webcam:active-users', {
      users: otherUsers,
    });

    // Diffuser le nouveau nombre à tous
    broadcastActiveCount();
  });

  // Quitter la webcam
  socket.on('webcam:leave', (data: { userId: string }) => {
    const { userId } = data;
    
    webcamUsers.delete(userId);
    socketToUserId.delete(socket.id);
    socket.leave('webcam');

    // Notifier tous les autres utilisateurs
    socket.broadcast.to('webcam').emit('webcam:user-left', {
      userId,
    });

    // Diffuser le nouveau nombre
    broadcastActiveCount();
  });

  // WebRTC Offer
  socket.on('webcam:offer', (data: {
    targetUserId: string;
    targetSocketId: string;
    offer: RTCSessionDescriptionInit;
  }) => {
    const { targetUserId, targetSocketId, offer } = data;
    const senderUserId = socketToUserId.get(socket.id);
    
    console.log(`[Webcam] Offer from ${senderUserId} to ${targetUserId} (socket: ${targetSocketId})`);
    
    if (!senderUserId) {
      console.warn(`[Webcam] No sender userId found for socket ${socket.id}`);
      return;
    }

    // Envoyer l'offer au destinataire
    io.to(targetSocketId).emit('webcam:offer', {
      fromUserId: senderUserId,
      fromSocketId: socket.id,
      offer,
    });
  });

  // WebRTC Answer
  socket.on('webcam:answer', (data: {
    targetUserId: string;
    targetSocketId: string;
    answer: RTCSessionDescriptionInit;
  }) => {
    const { targetUserId, targetSocketId, answer } = data;
    const senderUserId = socketToUserId.get(socket.id);
    
    if (!senderUserId) return;

    // Envoyer la réponse au destinataire
    io.to(targetSocketId).emit('webcam:answer', {
      fromUserId: senderUserId,
      answer,
    });
  });

  // WebRTC ICE Candidate
  socket.on('webcam:ice-candidate', (data: {
    targetUserId: string;
    targetSocketId: string;
    candidate: RTCIceCandidateInit;
  }) => {
    const { targetUserId, targetSocketId, candidate } = data;
    const senderUserId = socketToUserId.get(socket.id);
    
    if (!senderUserId) return;

    // Envoyer le candidat ICE au destinataire
    io.to(targetSocketId).emit('webcam:ice-candidate', {
      fromUserId: senderUserId,
      candidate,
    });
  });

  // Mettre à jour la page actuelle
  socket.on('webcam:update-page', (data: { userId: string; currentPage: string }) => {
    const { userId, currentPage } = data;
    const userInfo = webcamUsers.get(userId);
    
    if (userInfo) {
      userInfo.currentPage = currentPage;
      webcamUsers.set(userId, userInfo);
      
      // Notifier les autres utilisateurs du changement de page
      socket.broadcast.to('webcam').emit('webcam:user-updated', {
        userId,
        currentPage,
      });
    }
  });

  // Demander le nombre d'utilisateurs actifs
  socket.on('webcam:get-count', () => {
    const count = webcamUsers.size;
    console.log(`[Webcam] Count requested, sending: ${count}`);
    socket.emit('webcam:count', { count });
  });

  // Nettoyer à la déconnexion
  socket.on('disconnect', () => {
    const userId = socketToUserId.get(socket.id);
    
    if (userId) {
      webcamUsers.delete(userId);
      socketToUserId.delete(socket.id);
      
      // Notifier tous les autres utilisateurs
      socket.broadcast.to('webcam').emit('webcam:user-left', {
        userId,
      });
      
      // Diffuser le nouveau nombre
      broadcastActiveCount();
    }
  });
};
