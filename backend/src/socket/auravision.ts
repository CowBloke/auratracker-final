import { Server, Socket } from 'socket.io';

type QueueEntry = {
  userId: string;
  username: string;
  socketId: string;
  joinedAt: number;
};

type AuraVisionSignalPayload =
  | { type: 'offer'; sdp: { type: 'offer'; sdp: string } }
  | { type: 'answer'; sdp: { type: 'answer'; sdp: string } }
  | { type: 'ice-candidate'; candidate: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } };

type SessionMember = {
  userId: string;
  username: string;
  socketId: string;
};

type AuraVisionSession = {
  id: string;
  members: [SessionMember, SessionMember];
  createdAt: number;
};

const MAX_MESSAGE_LENGTH = 280;

const matchmakingQueue: QueueEntry[] = [];
const sessions = new Map<string, AuraVisionSession>();
const sessionByUserId = new Map<string, string>();

const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const removeFromQueue = (userId: string) => {
  const index = matchmakingQueue.findIndex((entry) => entry.userId === userId);
  if (index >= 0) {
    matchmakingQueue.splice(index, 1);
  }
};

const getQueueSize = () => matchmakingQueue.length;

const emitQueueSize = (io: Server) => {
  io.emit('auravision:queue-size', { count: getQueueSize() });
};

const getActiveUserCount = () => {
  const uniqueUserIds = new Set<string>();

  for (const entry of matchmakingQueue) {
    uniqueUserIds.add(entry.userId);
  }

  for (const session of sessions.values()) {
    for (const member of session.members) {
      uniqueUserIds.add(member.userId);
    }
  }

  return uniqueUserIds.size;
};

const emitActiveUserCount = (io: Server) => {
  io.emit('auravision:active-count', { count: getActiveUserCount() });
};

const getPeer = (session: AuraVisionSession, userId: string) =>
  session.members.find((member) => member.userId !== userId) ?? null;

const endSession = (
  io: Server,
  userId: string,
  reason: 'left' | 'next' | 'disconnect' = 'left',
) => {
  const sessionId = sessionByUserId.get(userId);
  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    sessionByUserId.delete(userId);
    return null;
  }

  sessions.delete(sessionId);
  for (const member of session.members) {
    sessionByUserId.delete(member.userId);
  }

  const peer = getPeer(session, userId);
  if (peer) {
    io.to(peer.socketId).emit('auravision:partner-left', {
      sessionId,
      reason,
    });
  }

  return session;
};

const attemptMatchmaking = (io: Server) => {
  while (matchmakingQueue.length >= 2) {
    const first = matchmakingQueue.shift();
    const second = matchmakingQueue.shift();

    if (!first || !second) {
      break;
    }

    if (first.userId === second.userId) {
      matchmakingQueue.unshift(second);
      continue;
    }

    const session: AuraVisionSession = {
      id: randomId(),
      members: [
        {
          userId: first.userId,
          username: first.username,
          socketId: first.socketId,
        },
        {
          userId: second.userId,
          username: second.username,
          socketId: second.socketId,
        },
      ],
      createdAt: Date.now(),
    };

    sessions.set(session.id, session);
    sessionByUserId.set(first.userId, session.id);
    sessionByUserId.set(second.userId, session.id);

    io.to(first.socketId).emit('auravision:matched', {
      sessionId: session.id,
      initiator: true,
      peer: {
        id: second.userId,
        username: second.username,
      },
    });

    io.to(second.socketId).emit('auravision:matched', {
      sessionId: session.id,
      initiator: false,
      peer: {
        id: first.userId,
        username: first.username,
      },
    });
  }

  emitQueueSize(io);
  emitActiveUserCount(io);
};

export const setupAuraVisionHandlers = (socket: Socket, io: Server) => {
  socket.on('auravision:queue-size', () => {
    socket.emit('auravision:queue-size', { count: getQueueSize() });
  });

  socket.on('auravision:active-count', () => {
    socket.emit('auravision:active-count', { count: getActiveUserCount() });
  });

  socket.on('auravision:join-queue', () => {
    const userId = socket.data.userId as string | undefined;
    const username = socket.data.username as string | undefined;

    if (!userId || !username) {
      socket.emit('auravision:error', { message: 'Utilisateur introuvable.' });
      return;
    }

    endSession(io, userId, 'next');
    removeFromQueue(userId);

    matchmakingQueue.push({
      userId,
      username,
      socketId: socket.id,
      joinedAt: Date.now(),
    });

    socket.emit('auravision:queued', {
      queuedAt: Date.now(),
      position: matchmakingQueue.length,
    });

    attemptMatchmaking(io);
  });

  socket.on('auravision:leave-queue', () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) {
      return;
    }

    removeFromQueue(userId);
    emitQueueSize(io);
    emitActiveUserCount(io);
  });

  socket.on('auravision:next', () => {
    const userId = socket.data.userId as string | undefined;
    const username = socket.data.username as string | undefined;

    if (!userId || !username) {
      return;
    }

    removeFromQueue(userId);
    endSession(io, userId, 'next');

    matchmakingQueue.push({
      userId,
      username,
      socketId: socket.id,
      joinedAt: Date.now(),
    });

    socket.emit('auravision:queued', {
      queuedAt: Date.now(),
      position: matchmakingQueue.length,
    });

    attemptMatchmaking(io);
  });

  socket.on('auravision:leave-session', () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) {
      return;
    }

    endSession(io, userId, 'left');
    emitActiveUserCount(io);
  });

  socket.on(
    'auravision:message',
    (payload: { sessionId: string; body: string }) => {
      const userId = socket.data.userId as string | undefined;
      const username = socket.data.username as string | undefined;

      if (!userId || !username) {
        return;
      }

      const session = sessions.get(payload.sessionId);
      if (!session || !session.members.some((member) => member.userId === userId)) {
        socket.emit('auravision:error', { message: 'Session AuraVision introuvable.' });
        return;
      }

      const body = typeof payload.body === 'string' ? payload.body.trim() : '';
      if (!body) {
        return;
      }

      if (body.length > MAX_MESSAGE_LENGTH) {
        socket.emit('auravision:error', { message: 'Message AuraVision trop long.' });
        return;
      }

      io.to(session.members[0].socketId).to(session.members[1].socketId).emit('auravision:message', {
        id: randomId(),
        sessionId: payload.sessionId,
        senderId: userId,
        sender: username,
        body,
        createdAt: new Date().toISOString(),
      });
    },
  );

  socket.on(
    'auravision:signal',
    (payload: { sessionId: string; targetUserId: string; signal: AuraVisionSignalPayload }) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) {
        return;
      }

      const session = sessions.get(payload.sessionId);
      if (!session) {
        socket.emit('auravision:error', { message: 'Session AuraVision introuvable.' });
        return;
      }

      if (!session.members.some((member) => member.userId === userId)) {
        socket.emit('auravision:error', { message: 'Acces non autorise a cette session.' });
        return;
      }

      const target = session.members.find((member) => member.userId === payload.targetUserId);
      if (!target) {
        socket.emit('auravision:error', { message: 'Joueur cible introuvable.' });
        return;
      }

      io.to(target.socketId).emit('auravision:signal', {
        sessionId: payload.sessionId,
        fromUserId: userId,
        signal: payload.signal,
      });
    },
  );

  socket.on('disconnect', () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) {
      return;
    }

    removeFromQueue(userId);
    endSession(io, userId, 'disconnect');
    emitQueueSize(io);
    emitActiveUserCount(io);
  });
};
