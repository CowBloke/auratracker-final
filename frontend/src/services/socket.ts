import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: {
        token: localStorage.getItem('token'),
      },
    });
  }
  return socket;
};

export const getSocket = (): Socket | null => socket;

export const connectSocket = (): void => {
  if (socket && !socket.connected) {
    socket.auth = {
      token: localStorage.getItem('token'),
    };
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
  join: (userId: string, username: string, currentPage?: string) => {
    socket?.emit('chat:join', { userId, username, currentPage });
  },
  sendMessage: (userId: string, message: string, replyToId?: string | null) => {
    socket?.emit('chat:message', { userId, message, replyToId });
  },
  react: (userId: string, messageId: string, emoji: string) => {
    socket?.emit('chat:reaction', { userId, messageId, emoji });
  },
  pinMessage: (adminId: string, messageId: string, pinned: boolean) => {
    socket?.emit('chat:pin', { adminId, messageId, pinned });
  },
  setTyping: (userId: string, isTyping: boolean) => {
    socket?.emit('chat:typing', { userId, isTyping });
  },
  setPage: (userId: string, currentPage: string) => {
    socket?.emit('chat:page', { userId, currentPage });
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
  create: (userId: string, name?: string, isPublic: boolean = false, maxSize: number = 8) => {
    socket?.emit('party:create', { userId, name, isPublic, maxSize });
  },
  join: (userId: string, partyId: string) => {
    socket?.emit('party:join', { userId, partyId });
  },
  requestJoin: (userId: string, partyId: string) => {
    socket?.emit('party:request-join', { userId, partyId });
  },
  respondToJoinRequest: (userId: string, targetUserId: string, accepted: boolean) => {
    socket?.emit('party:join-request-response', { userId, targetUserId, accepted });
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
  delete: (userId: string) => {
    socket?.emit('party:delete', { userId });
  },
  list: () => {
    socket?.emit('party:list');
  },
  suggestGame: (userId: string, gameId: string, gameName: string) => {
    socket?.emit('party:game-suggest', { userId, gameId, gameName });
  },
  selectGame: (userId: string, gameId: string, gameName: string) => {
    socket?.emit('party:game-select', { userId, gameId, gameName });
  },
  sendChatMessage: (message: string) => {
    socket?.emit('party:chat-message', { message });
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
  respondToJoin: (partyId: string, userId: string, accepted: boolean) => {
    socket?.emit('bombparty:join-response', { partyId, userId, accepted });
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
  respondToPlayAgain: (partyId: string, userId: string, playAgain: boolean) => {
    socket?.emit('bombparty:play-again-response', { partyId, userId, playAgain });
  },
};

// Poker events
export const pokerEvents = {
  register: (userId: string) => {
    socket?.emit('poker:register', { userId });
  },
  start: (userId: string, partyId: string, startStack: number, bigBlind: number) => {
    socket?.emit('poker:start', { userId, partyId, startStack, bigBlind });
  },
  respondToJoin: (partyId: string, userId: string, accepted: boolean) => {
    socket?.emit('poker:join-response', { partyId, userId, accepted });
  },
  action: (partyId: string, userId: string, action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in', amount?: number) => {
    socket?.emit('poker:action', { partyId, userId, action, amount });
  },
  leave: (partyId: string, userId: string) => {
    socket?.emit('poker:leave', { partyId, userId });
  },
  respondToPlayAgain: (partyId: string, userId: string, playAgain: boolean) => {
    socket?.emit('poker:play-again-response', { partyId, userId, playAgain });
  },
};

// Petit Bac events
export const petitBacEvents = {
  start: (userId: string, partyId: string, rounds: number, roundDuration: number, categories: string[]) => {
    socket?.emit('petitbac:start', { userId, partyId, rounds, roundDuration, categories });
  },
  respondToJoin: (partyId: string, userId: string, accepted: boolean) => {
    socket?.emit('petitbac:join-response', { partyId, userId, accepted });
  },
  submit: (partyId: string, userId: string, answers: Record<string, string>) => {
    socket?.emit('petitbac:submit', { partyId, userId, answers });
  },
  leave: (partyId: string, userId: string) => {
    socket?.emit('petitbac:leave', { partyId, userId });
  },
  respondToPlayAgain: (partyId: string, userId: string, playAgain: boolean) => {
    socket?.emit('petitbac:play-again-response', { partyId, userId, playAgain });
  },
};

// Battleship events
export const battleshipEvents = {
  register: (userId: string) => {
    socket?.emit('battleship:register', { userId });
  },
  start: (userId: string, partyId: string) => {
    socket?.emit('battleship:start', { userId, partyId });
  },
  placeShip: (userId: string, partyId: string, x: number, y: number, length: number, horizontal: boolean) => {
    socket?.emit('battleship:place-ship', { userId, partyId, x, y, length, horizontal });
  },
  shoot: (userId: string, partyId: string, x: number, y: number) => {
    socket?.emit('battleship:shoot', { userId, partyId, x, y });
  },
  leave: (userId: string, partyId: string) => {
    socket?.emit('battleship:leave', { userId, partyId });
  },
};

// Duel events
export const duelEvents = {
  challenge: (targetId: string, gameType: 'chess' | 'battleship' | 'p4' | 'ballarena') => {
    socket?.emit('duel:challenge', { targetId, gameType });
  },
  accept: (challengerId: string, gameType: 'chess' | 'battleship' | 'p4' | 'ballarena') => {
    socket?.emit('duel:accept', { challengerId, gameType });
  },
  decline: (challengerId: string, gameType: 'chess' | 'battleship' | 'p4' | 'ballarena') => {
    socket?.emit('duel:decline', { challengerId, gameType });
  },
  cancel: (targetId: string, gameType: 'chess' | 'battleship' | 'p4' | 'ballarena') => {
    socket?.emit('duel:cancel', { targetId, gameType });
  },
};

export default socket;
