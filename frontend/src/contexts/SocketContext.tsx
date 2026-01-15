import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { initSocket, connectSocket, disconnectSocket, chatEvents, partyEvents, gameEvents, bombPartyEvents } from '../services/socket';
import { useAuth } from './AuthContext';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  message: string;
  replyTo?: {
    id: string;
    userId: string;
    username: string;
    usernameColor?: string | null;
    message: string;
  } | null;
  timestamp: string;
}

interface OnlineUser {
  userId: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  currentPage?: string | null;
}

interface TypingUser {
  userId: string;
  username: string;
}

interface PartyMember {
  userId: string;
  username: string;
  usernameColor?: string | null;
  isLeader: boolean;
}

interface Party {
  id: string;
  name: string | null;
  isPublic: boolean;
  maxSize: number;
}

interface PartyInvite {
  partyId: string;
  partyName: string | null;
  inviterId: string;
  inviterUsername: string;
}

interface BombPartyPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  lives: number;
  isEliminated: boolean;
  wordsTypedCount: number;
}

interface BombPartyGameState {
  partyId: string;
  players: BombPartyPlayer[];
  currentPlayerIndex: number;
  currentPlayerId: string;
  currentPrompt: string;
  currentInput: string;
  difficulty: 'easy' | 'medium' | 'hard';
  turnDuration: number;
  turnStartTime: number;
  round: number;
  usedWords: string[];
}

interface BombPartyGameOver {
  winnerId: string | null;
  winnerUsername: string | null;
  players: Array<{
    userId: string;
    username: string;
    wordsTypedCount: number;
    isWinner: boolean;
    rewards: { aura: number; money: number };
  }>;
}

interface BombPartyJoinPrompt {
  partyId: string;
  leaderId: string;
  lives: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  startTime: number;
  members: Array<{
    userId: string;
    username: string;
    usernameColor?: string | null;
  }>;
  responses: Array<{
    userId: string;
    accepted: boolean;
  }>;
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  // Chat
  messages: ChatMessage[];
  onlineUsers: OnlineUser[];
  typingUsers: TypingUser[];
  sendMessage: (message: string, replyToId?: string | null) => void;
  setTyping: (isTyping: boolean) => void;
  setCurrentPage: (page: string) => void;
  // Party
  currentParty: Party | null;
  partyMembers: PartyMember[];
  partyInvites: PartyInvite[];
  publicParties: Array<{ id: string; name: string | null; memberCount: number; maxSize: number }>;
  createParty: (name?: string, isPublic?: boolean) => void;
  joinParty: (partyId: string) => void;
  leaveParty: () => void;
  deleteParty: () => void;
  inviteToParty: (targetUserId: string) => void;
  kickFromParty: (targetUserId: string) => void;
  fetchPublicParties: () => void;
  syncParty: () => void;
  // Balance updates
  balanceUpdate: { userId: string; aura: number; money: number } | null;
  // Bomb Party
  bombPartyGame: BombPartyGameState | null;
  bombPartyGameOver: BombPartyGameOver | null;
  bombPartyRejection: string | null;
  bombPartyJoinPrompt: BombPartyJoinPrompt | null;
  startBombParty: (lives: number, difficulty: 'easy' | 'medium' | 'hard') => void;
  respondToJoinPrompt: (accepted: boolean) => void;
  typeBombParty: (input: string) => void;
  submitBombParty: (word: string) => void;
  leaveBombParty: () => void;
  clearBombPartyGameOver: () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, updateBalance } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  // Party state
  const [currentParty, setCurrentParty] = useState<Party | null>(null);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [partyInvites, setPartyInvites] = useState<PartyInvite[]>([]);
  const [publicParties, setPublicParties] = useState<Array<{ id: string; name: string | null; memberCount: number; maxSize: number }>>([]);
  
  // Balance update state
  const [balanceUpdate, setBalanceUpdate] = useState<{ userId: string; aura: number; money: number } | null>(null);

  // Bomb Party state
  const [bombPartyGame, setBombPartyGame] = useState<BombPartyGameState | null>(null);
  const [bombPartyGameOver, setBombPartyGameOver] = useState<BombPartyGameOver | null>(null);
  const [bombPartyRejection, setBombPartyRejection] = useState<string | null>(null);
  const [bombPartyJoinPrompt, setBombPartyJoinPrompt] = useState<BombPartyJoinPrompt | null>(null);

  useEffect(() => {
    if (user) {
      const s = initSocket();
      setSocket(s);
      connectSocket();

      s.on('connect', () => {
        setConnected(true);
        const initialPage = typeof window !== 'undefined' ? window.location.pathname : '/';
        chatEvents.join(user.id, user.username, initialPage);
        partyEvents.register(user.id);
        partyEvents.sync(user.id);
        gameEvents.register(user.id);
      });

      s.on('disconnect', () => {
        setConnected(false);
      });

      // Chat events
      s.on('chat:history', (data: { messages: ChatMessage[] }) => {
        setMessages(data.messages);
      });

      s.on('chat:message', (message: ChatMessage) => {
        setMessages((prev) => [...prev, message]);
      });

      s.on('users:online-list', (data: { users: OnlineUser[] }) => {
        setOnlineUsers(data.users);
      });

      s.on('user:online', (user: OnlineUser) => {
        setOnlineUsers((prev) => {
          if (prev.find((u) => u.userId === user.userId)) return prev;
          return [...prev, user];
        });
      });

      s.on('user:offline', (user: { userId: string }) => {
        setOnlineUsers((prev) => prev.filter((u) => u.userId !== user.userId));
      });

      s.on('user:page', (data: { userId: string; currentPage: string }) => {
        setOnlineUsers((prev) =>
          prev.map((u) => (u.userId === data.userId ? { ...u, currentPage: data.currentPage } : u))
        );
      });

      s.on('chat:typing', (data: TypingUser & { isTyping: boolean }) => {
        if (data.isTyping) {
          setTypingUsers((prev) => {
            if (prev.find((u) => u.userId === data.userId)) return prev;
            return [...prev, { userId: data.userId, username: data.username }];
          });
        } else {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
        }
      });

      // Party events
      s.on('party:created', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
      });

      s.on('party:joined', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== data.party.id));
      });

      s.on('party:restored', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== data.party.id));
      });

      s.on('party:member-joined', (member: { userId: string; username: string; usernameColor?: string | null }) => {
        setPartyMembers((prev) => [...prev, { ...member, isLeader: false }]);
      });

      s.on('party:member-left', (data: { userId: string }) => {
        setPartyMembers((prev) => prev.filter((m) => m.userId !== data.userId));
      });

      s.on('party:disbanded', () => {
        setCurrentParty(null);
        setPartyMembers([]);
      });

      s.on('party:left', () => {
        setCurrentParty(null);
        setPartyMembers([]);
      });

      s.on('party:kicked', () => {
        setCurrentParty(null);
        setPartyMembers([]);
      });

      s.on('party:invite', (invite: PartyInvite) => {
        setPartyInvites((prev) => [...prev, invite]);
      });

      s.on('party:list', (data: { parties: typeof publicParties }) => {
        setPublicParties(data.parties);
      });

      s.on('party:leader-changed', (data: { newLeaderId: string }) => {
        setPartyMembers((prev) =>
          prev.map((m) => ({
            ...m,
            isLeader: m.userId === data.newLeaderId,
          }))
        );
      });

      // Economy events
      s.on('economy:balance-update', (data: { userId: string; aura: number; money: number }) => {
        setBalanceUpdate(data);
        if (data.userId === user.id) {
          updateBalance(data.aura, data.money);
        }
      });

      // Bomb Party events
      s.on('bombparty:started', (game: BombPartyGameState) => {
        setBombPartyGame(game);
        setBombPartyGameOver(null);
        setBombPartyJoinPrompt(null);
      });

      s.on('bombparty:typing', (data: { input: string; userId: string }) => {
        setBombPartyGame((prev) => prev ? { ...prev, currentInput: data.input } : null);
      });

      s.on('bombparty:word-accepted', (data: BombPartyGameState & { word: string; playerId: string }) => {
        setBombPartyGame(data);
      });

      s.on('bombparty:word-rejected', (data: { reason: string }) => {
        setBombPartyRejection(data.reason);
        // Auto-clear after 2 seconds
        setTimeout(() => setBombPartyRejection(null), 2000);
      });

      s.on('bombparty:bomb-exploded', (data: { playerId: string; username: string; livesRemaining: number }) => {
        setBombPartyGame((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.userId === data.playerId ? { ...p, lives: data.livesRemaining } : p
            ),
          };
        });
      });

      s.on('bombparty:player-eliminated', (data: { playerId: string; username: string; reason: string }) => {
        setBombPartyGame((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.userId === data.playerId ? { ...p, isEliminated: true, lives: 0 } : p
            ),
          };
        });
      });

      s.on('bombparty:turn-changed', (game: BombPartyGameState) => {
        setBombPartyGame(game);
      });

      s.on('bombparty:game-over', (data: BombPartyGameOver) => {
        setBombPartyGameOver(data);
        setBombPartyGame(null);
      });

      s.on('bombparty:error', (data: { message: string }) => {
        console.error('Bomb Party error:', data.message);
      });

      // Bomb Party join prompt events
      s.on('bombparty:join-prompt', (data: {
        partyId: string;
        leaderId: string;
        lives: number;
        difficulty: 'easy' | 'medium' | 'hard';
        timeLimit: number;
        members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
        responses?: Array<{ userId: string; accepted: boolean }>;
      }) => {
        setBombPartyJoinPrompt({
          ...data,
          startTime: Date.now(),
          responses: data.responses || [],
        });
      });

      s.on('bombparty:join-response-update', (data: {
        partyId: string;
        responses: Array<{ userId: string; accepted: boolean }>;
      }) => {
        setBombPartyJoinPrompt((prev) => prev ? { ...prev, responses: data.responses } : null);
      });

      s.on('bombparty:join-cancelled', () => {
        setBombPartyJoinPrompt(null);
      });

      return () => {
        disconnectSocket();
        s.removeAllListeners();
      };
    }
  }, [user, updateBalance]);

  const sendMessage = (message: string, replyToId?: string | null) => {
    if (user) {
      chatEvents.sendMessage(user.id, message, replyToId);
    }
  };

  const setTyping = (isTyping: boolean) => {
    if (user) {
      chatEvents.setTyping(user.id, isTyping);
    }
  };

  const setCurrentPage = (page: string) => {
    if (user) {
      chatEvents.setPage(user.id, page);
    }
  };

  const createParty = (name?: string, isPublic: boolean = false) => {
    if (user) {
      partyEvents.create(user.id, name, isPublic);
    }
  };

  const joinParty = (partyId: string) => {
    if (user) {
      partyEvents.join(user.id, partyId);
    }
  };

  const leaveParty = () => {
    if (user) {
      partyEvents.leave(user.id);
    }
  };

  const deleteParty = () => {
    if (user) {
      partyEvents.delete(user.id);
    }
  };

  const inviteToParty = (targetUserId: string) => {
    if (user) {
      partyEvents.invite(user.id, targetUserId);
    }
  };

  const kickFromParty = (targetUserId: string) => {
    if (user) {
      partyEvents.kick(user.id, targetUserId);
    }
  };

  const fetchPublicParties = () => {
    partyEvents.list();
  };

  const syncParty = () => {
    if (user) {
      partyEvents.sync(user.id);
    }
  };

  // Bomb Party actions
  const startBombParty = (lives: number, difficulty: 'easy' | 'medium' | 'hard') => {
    if (user && currentParty) {
      bombPartyEvents.start(user.id, currentParty.id, lives, difficulty);
    }
  };

  const respondToJoinPrompt = (accepted: boolean) => {
    if (user && bombPartyJoinPrompt) {
      bombPartyEvents.respondToJoin(bombPartyJoinPrompt.partyId, user.id, accepted);
    }
  };

  const typeBombParty = (input: string) => {
    if (user && currentParty) {
      bombPartyEvents.type(currentParty.id, user.id, input);
    }
  };

  const submitBombParty = (word: string) => {
    if (user && currentParty) {
      bombPartyEvents.submit(currentParty.id, user.id, word);
    }
  };

  const leaveBombParty = () => {
    if (user && currentParty) {
      bombPartyEvents.leave(currentParty.id, user.id);
    }
    // Always clear local game state to allow user to exit even if backend doesn't respond
    setBombPartyGame(null);
  };

  const clearBombPartyGameOver = () => {
    setBombPartyGameOver(null);
    setBombPartyGame(null); // Also clear game state to return to lobby
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        messages,
        onlineUsers,
        typingUsers,
        sendMessage,
        setTyping,
        setCurrentPage,
        currentParty,
        partyMembers,
        partyInvites,
        publicParties,
        createParty,
        joinParty,
        leaveParty,
        deleteParty,
        inviteToParty,
        kickFromParty,
        fetchPublicParties,
        syncParty,
        balanceUpdate,
        bombPartyGame,
        bombPartyGameOver,
        bombPartyRejection,
        bombPartyJoinPrompt,
        startBombParty,
        respondToJoinPrompt,
        typeBombParty,
        submitBombParty,
        leaveBombParty,
        clearBombPartyGameOver,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
