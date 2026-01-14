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
  timestamp: string;
}

interface OnlineUser {
  userId: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
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

type PartyGameType = 'hangman';
type PartyGamePhase = 'idle' | 'lobby' | 'choose-word' | 'playing' | 'ended';

interface PartyGameState {
  maskedWord: string;
  wrongGuesses: string[];
  correctGuesses: string[];
  remainingLives: number;
  maxWrongGuesses: number;
  currentTurnUserId: string | null;
  turnOrder: string[];
  word?: string;
}

interface PartyGame {
  gameType: PartyGameType;
  phase: PartyGamePhase;
  pickerId: string | null;
  readyUserIds: string[];
  state: PartyGameState;
}

interface PartyGameResult {
  gameType: PartyGameType;
  winnerId: string | null;
  word: string;
  reason: 'guessed' | 'failed';
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  // Chat
  messages: ChatMessage[];
  onlineUsers: OnlineUser[];
  typingUsers: TypingUser[];
  sendMessage: (message: string) => void;
  setTyping: (isTyping: boolean) => void;
  // Party
  currentParty: Party | null;
  partyMembers: PartyMember[];
  partyInvites: PartyInvite[];
  publicParties: Array<{ id: string; name: string | null; memberCount: number; maxSize: number }>;
  createParty: (name?: string, isPublic?: boolean) => void;
  joinParty: (partyId: string) => void;
  leaveParty: () => void;
  inviteToParty: (targetUserId: string) => void;
  kickFromParty: (targetUserId: string) => void;
  fetchPublicParties: () => void;
  partyGame: PartyGame | null;
  lastPartyGameResult: PartyGameResult | null;
  selectPartyGame: (gameType: PartyGameType) => void;
  setPartyReady: (isReady: boolean) => void;
  submitHangmanWord: (word: string) => void;
  submitHangmanGuess: (guess: string) => void;
  // Balance updates
  balanceUpdate: { userId: string; aura: number; money: number } | null;
  // Bomb Party
  bombPartyGame: BombPartyGameState | null;
  bombPartyGameOver: BombPartyGameOver | null;
  bombPartyRejection: string | null;
  startBombParty: (lives: number, difficulty: 'easy' | 'medium' | 'hard') => void;
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
  const [partyGame, setPartyGame] = useState<PartyGame | null>(null);
  const [lastPartyGameResult, setLastPartyGameResult] = useState<PartyGameResult | null>(null);
  
  // Balance update state
  const [balanceUpdate, setBalanceUpdate] = useState<{ userId: string; aura: number; money: number } | null>(null);

  // Bomb Party state
  const [bombPartyGame, setBombPartyGame] = useState<BombPartyGameState | null>(null);
  const [bombPartyGameOver, setBombPartyGameOver] = useState<BombPartyGameOver | null>(null);
  const [bombPartyRejection, setBombPartyRejection] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const s = initSocket();
      setSocket(s);
      connectSocket();

      s.on('connect', () => {
        setConnected(true);
        chatEvents.join(user.id, user.username);
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
        setPartyGame(null);
        setLastPartyGameResult(null);
      });

      s.on('party:joined', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPartyGame(null);
        setLastPartyGameResult(null);
        setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== data.party.id));
      });

      s.on('party:restored', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPartyGame(null);
        setLastPartyGameResult(null);
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
        setPartyGame(null);
        setLastPartyGameResult(null);
      });

      s.on('party:left', () => {
        setCurrentParty(null);
        setPartyMembers([]);
        setPartyGame(null);
        setLastPartyGameResult(null);
      });

      s.on('party:kicked', () => {
        setCurrentParty(null);
        setPartyMembers([]);
        setPartyGame(null);
        setLastPartyGameResult(null);
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

      // Party game events
      s.on('party:game:selected', (data: { gameType: PartyGameType; phase: PartyGamePhase; readyUserIds: string[] }) => {
        setPartyGame({
          gameType: data.gameType,
          phase: data.phase,
          pickerId: null,
          readyUserIds: data.readyUserIds,
          state: {
            maskedWord: '',
            wrongGuesses: [],
            correctGuesses: [],
            remainingLives: 0,
            maxWrongGuesses: 0,
            currentTurnUserId: null,
            turnOrder: [],
          },
        });
        setLastPartyGameResult(null);
      });

      s.on('party:game:ready-state', (data: { gameType: PartyGameType; readyUserIds: string[] }) => {
        setPartyGame((prev) =>
          prev
            ? {
                ...prev,
                readyUserIds: data.readyUserIds,
              }
            : prev
        );
      });

      s.on('party:game:picker', (data: { gameType: PartyGameType; pickerId: string; phase: PartyGamePhase }) => {
        setPartyGame((prev) =>
          prev
            ? {
                ...prev,
                phase: data.phase,
                pickerId: data.pickerId,
              }
            : prev
        );
      });

      s.on('party:game:state', (data: { gameType: PartyGameType; phase: PartyGamePhase; pickerId: string | null; state: PartyGameState }) => {
        setPartyGame((prev) => ({
          gameType: data.gameType,
          phase: data.phase,
          pickerId: data.pickerId,
          readyUserIds: prev?.readyUserIds || [],
          state: data.state,
        }));
      });

      s.on('party:game:end', (data: PartyGameResult) => {
        setPartyGame((prev) =>
          prev
            ? {
                ...prev,
                phase: 'ended',
              }
            : prev
        );
        setLastPartyGameResult(data);
      });

      s.on('party:game:reset', () => {
        setPartyGame(null);
      });

      s.on('party:game:error', (data: { message: string }) => {
        console.error('Party game error:', data.message);
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

      return () => {
        disconnectSocket();
        s.removeAllListeners();
      };
    }
  }, [user, updateBalance]);

  const sendMessage = (message: string) => {
    if (user) {
      chatEvents.sendMessage(user.id, message);
    }
  };

  const setTyping = (isTyping: boolean) => {
    if (user) {
      chatEvents.setTyping(user.id, isTyping);
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

  const selectPartyGame = (gameType: PartyGameType) => {
    if (user && currentParty) {
      partyEvents.gameSelect(user.id, currentParty.id, gameType);
    }
  };

  const setPartyReady = (isReady: boolean) => {
    if (user && currentParty) {
      partyEvents.gameReady(user.id, currentParty.id, isReady);
    }
  };

  const submitHangmanWord = (word: string) => {
    if (user && currentParty) {
      partyEvents.gameWord(user.id, currentParty.id, word);
    }
  };

  const submitHangmanGuess = (guess: string) => {
    if (user && currentParty) {
      partyEvents.gameGuess(user.id, currentParty.id, guess);
    }
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
        currentParty,
        partyMembers,
        partyInvites,
        publicParties,
        createParty,
        joinParty,
        leaveParty,
        inviteToParty,
        kickFromParty,
        fetchPublicParties,
        partyGame,
        lastPartyGameResult,
        selectPartyGame,
        setPartyReady,
        submitHangmanWord,
        submitHangmanGuess,
        balanceUpdate,
        bombPartyGame,
        bombPartyGameOver,
        bombPartyRejection,
        startBombParty,
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
