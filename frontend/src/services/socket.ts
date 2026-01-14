import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const getSocket = (): Socket | null => socket;

export const connectSocket = (): void => {
  if (socket && !socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = (): void => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

// Chat events
export const chatEvents = {
  join: (userId: string, username: string) => {
    socket?.emit('chat:join', { userId, username });
  },
  sendMessage: (userId: string, message: string) => {
    socket?.emit('chat:message', { userId, message });
  },
  setTyping: (userId: string, isTyping: boolean) => {
    socket?.emit('chat:typing', { userId, isTyping });
  },
};

// Party events
export const partyEvents = {
  register: (userId: string) => {
    socket?.emit('party:register', { userId });
  },
  sync: (userId: string) => {
    socket?.emit('party:sync', { userId });
  },
  create: (userId: string, name?: string, isPublic: boolean = false) => {
    socket?.emit('party:create', { userId, name, isPublic });
  },
  join: (userId: string, partyId: string) => {
    socket?.emit('party:join', { userId, partyId });
  },
  leave: (userId: string) => {
    socket?.emit('party:leave', { userId });
  },
  invite: (userId: string, targetUserId: string) => {
    socket?.emit('party:invite', { userId, targetUserId });
  },
  kick: (userId: string, targetUserId: string) => {
    socket?.emit('party:kick', { userId, targetUserId });
  },
  list: () => {
    socket?.emit('party:list');
  },
};

// Game events
export const gameEvents = {
  register: (userId: string) => {
    socket?.emit('game:register', { userId });
  },
  invite: (userId: string, username: string, targetUserId: string, gameType: string) => {
    socket?.emit('game:invite', { userId, username, targetUserId, gameType });
  },
  acceptInvite: (userId: string, inviterId: string, gameType: string) => {
    socket?.emit('game:accept-invite', { userId, inviterId, gameType });
  },
  declineInvite: (userId: string, inviterId: string, gameType: string) => {
    socket?.emit('game:decline-invite', { userId, inviterId, gameType });
  },
  update: (roomId: string, gameState: unknown) => {
    socket?.emit('game:update', { roomId, gameState });
  },
  end: (roomId: string, winnerId?: string, scores?: Record<string, number>) => {
    socket?.emit('game:end', { roomId, winnerId, scores });
  },
};

// Bomb Party events
export const bombPartyEvents = {
  start: (userId: string, partyId: string, lives: number, difficulty: 'easy' | 'medium' | 'hard') => {
    socket?.emit('bombparty:start', { userId, partyId, lives, difficulty });
  },
  type: (partyId: string, userId: string, input: string) => {
    socket?.emit('bombparty:type', { partyId, userId, input });
  },
  submit: (partyId: string, userId: string, word: string) => {
    socket?.emit('bombparty:submit', { partyId, userId, word });
  },
  leave: (partyId: string, userId: string) => {
    socket?.emit('bombparty:leave', { partyId, userId });
  },
};

export default socket;
