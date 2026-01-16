import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { initSocket, connectSocket, disconnectSocket, chatEvents, partyEvents, gameEvents, bombPartyEvents, marioKartEvents } from '../services/socket';
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

interface PartyJoinRequest {
  partyId: string;
  partyName: string | null;
  userId: string;
  username: string;
  usernameColor?: string | null;
  requestedAt: number;
}

interface PartyDirectoryItem {
  id: string;
  name: string | null;
  memberCount: number;
  maxSize: number;
  isPublic: boolean;
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
  maxLives: number;
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

interface BombPartyPlayAgainPrompt {
  partyId: string;
  timeLimit: number;
  startTime: number;
  gameOverData: BombPartyGameOver;
  players: Array<{
    userId: string;
    username: string;
    usernameColor?: string | null;
  }>;
  responses: Array<{
    userId: string;
    playAgain: boolean;
  }>;
  playAgainCount: number;
  leaveCount: number;
}

interface MarioKartTrack {
  width: number;
  height: number;
  checkpoints: Array<{ x: number; y: number; radius: number }>;
  startPositions: Array<{ x: number; y: number }>;
  startAngle: number;
  pads: Array<{ x: number; y: number; width: number; height: number; boost: number }>;
  lapCount: number;
}

interface MarioKartPlayerState {
  userId: string;
  username: string;
  usernameColor?: string | null;
  color: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  lap: number;
  checkpointIndex: number;
  finished: boolean;
  finishTime?: number;
}

interface MarioKartState {
  partyId: string;
  status: 'countdown' | 'running' | 'finished';
  lapCount: number;
  countdownEndsAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  track?: MarioKartTrack;
  players: MarioKartPlayerState[];
}

interface MarioKartResult {
  partyId: string;
  reason: 'completed' | 'timeout';
  standings: Array<{
    userId: string;
    username: string;
    usernameColor?: string | null;
    color: string;
    rank: number | null;
    finishMs: number | null;
    lap: number;
    checkpoints: number;
    finished: boolean;
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
  deleteMessage: (messageId: string) => void;
  // Party
  currentParty: Party | null;
  partyMembers: PartyMember[];
  partyInvites: PartyInvite[];
  partyJoinRequests: PartyJoinRequest[];
  pendingJoinRequests: string[];
  publicParties: PartyDirectoryItem[];
  createParty: (name?: string, isPublic?: boolean, maxSize?: number) => void;
  joinParty: (partyId: string) => void;
  requestJoinParty: (partyId: string) => void;
  respondToJoinRequest: (targetUserId: string, accepted: boolean) => void;
  leaveParty: () => void;
  deleteParty: () => void;
  inviteToParty: (targetUserId: string) => void;
  rejectPartyInvite: (partyId: string) => void;
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
  bombPartyPlayAgainPrompt: BombPartyPlayAgainPrompt | null;
  startBombParty: (lives: number, difficulty: 'easy' | 'medium' | 'hard') => void;
  respondToJoinPrompt: (accepted: boolean) => void;
  respondToPlayAgainPrompt: (playAgain: boolean) => void;
  typeBombParty: (input: string) => void;
  submitBombParty: (word: string) => void;
  leaveBombParty: () => void;
  clearBombPartyGameOver: () => void;
  // Mario Kart
  marioKartState: MarioKartState | null;
  marioKartResult: MarioKartResult | null;
  marioKartError: string | null;
  startMarioKart: (laps?: number) => void;
  sendMarioKartInput: (input: { throttle: number; steer: number; drift?: boolean; brake?: boolean }) => void;
  requestMarioKartState: () => void;
  leaveMarioKart: () => void;
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
  const [partyJoinRequests, setPartyJoinRequests] = useState<PartyJoinRequest[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<string[]>([]);
  const [publicParties, setPublicParties] = useState<PartyDirectoryItem[]>([]);
  
  // Balance update state
  const [balanceUpdate, setBalanceUpdate] = useState<{ userId: string; aura: number; money: number } | null>(null);

  // Bomb Party state
  const [bombPartyGame, setBombPartyGame] = useState<BombPartyGameState | null>(null);
  const [bombPartyGameOver, setBombPartyGameOver] = useState<BombPartyGameOver | null>(null);
  const [bombPartyRejection, setBombPartyRejection] = useState<string | null>(null);
  const [bombPartyJoinPrompt, setBombPartyJoinPrompt] = useState<BombPartyJoinPrompt | null>(null);
  const [bombPartyPlayAgainPrompt, setBombPartyPlayAgainPrompt] = useState<BombPartyPlayAgainPrompt | null>(null);
  // Mario Kart state
  const [marioKartState, setMarioKartState] = useState<MarioKartState | null>(null);
  const [marioKartResult, setMarioKartResult] = useState<MarioKartResult | null>(null);
  const [marioKartError, setMarioKartError] = useState<string | null>(null);

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

      s.on('chat:message-deleted', (data: { messageId: string }) => {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      });

      // Party events
      s.on('party:created', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPendingJoinRequests([]);
      });

      s.on('party:joined', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== data.party.id));
        setPendingJoinRequests([]);
      });

      s.on('party:restored', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== data.party.id));
        setPendingJoinRequests([]);
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
        setPartyJoinRequests([]);
        setPendingJoinRequests([]);
      });

      s.on('party:left', () => {
        setCurrentParty(null);
        setPartyMembers([]);
        setPartyJoinRequests([]);
        setPendingJoinRequests([]);
      });

      s.on('party:kicked', () => {
        setCurrentParty(null);
        setPartyMembers([]);
        setPartyJoinRequests([]);
        setPendingJoinRequests([]);
      });

      s.on('party:invite', (invite: PartyInvite) => {
        setPartyInvites((prev) => [...prev, invite]);
        // Show toast notification for private party invites
        if (typeof window !== 'undefined') {
          import('sonner').then(({ toast }) => {
            toast(`Invitation de party`, {
              description: `${invite.inviterUsername} vous invite à rejoindre ${invite.partyName || 'leur party'}`,
              action: {
                label: 'Voir',
                onClick: () => {
                  // Navigate to party page if not already there
                  if (window.location.pathname !== '/party') {
                    window.location.href = '/party';
                  }
                },
              },
            });
          });
        }
      });

      s.on('party:list', (data: { parties: PartyDirectoryItem[] }) => {
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

      s.on('party:join-request', (request: PartyJoinRequest) => {
        setPartyJoinRequests((prev) => {
          if (prev.some((entry) => entry.userId === request.userId && entry.partyId === request.partyId)) {
            return prev;
          }
          return [...prev, request];
        });
      });

      s.on('party:join-request-list', (data: { requests: PartyJoinRequest[] }) => {
        setPartyJoinRequests(data.requests);
      });

      s.on('party:join-requested', (data: { partyId: string }) => {
        setPendingJoinRequests((prev) => (prev.includes(data.partyId) ? prev : [...prev, data.partyId]));
      });

      s.on('party:join-request-resolved', (data: { partyId: string; accepted: boolean }) => {
        setPendingJoinRequests((prev) => prev.filter((partyId) => partyId !== data.partyId));
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
        setBombPartyPlayAgainPrompt(null);
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

      // Bomb Party play again prompt events
      s.on('bombparty:play-again-prompt', (data: {
        partyId: string;
        timeLimit: number;
        gameOverData: BombPartyGameOver;
        players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
        responses?: Array<{ userId: string; playAgain: boolean }>;
        playAgainCount?: number;
        leaveCount?: number;
      }) => {
        const responses = data.responses || [];
        setBombPartyPlayAgainPrompt({
          ...data,
          startTime: Date.now(),
          responses,
          playAgainCount: data.playAgainCount ?? responses.filter(r => r.playAgain).length,
          leaveCount: data.leaveCount ?? responses.filter(r => !r.playAgain).length,
        });
        setBombPartyGame(null);
      });

      s.on('bombparty:play-again-response-update', (data: {
        partyId: string;
        responses: Array<{ userId: string; playAgain: boolean }>;
        playAgainCount: number;
        leaveCount: number;
      }) => {
        setBombPartyPlayAgainPrompt((prev) => prev ? {
          ...prev,
          responses: data.responses,
          playAgainCount: data.playAgainCount,
          leaveCount: data.leaveCount,
        } : null);
      });

      s.on('bombparty:play-again-cancelled', () => {
        setBombPartyPlayAgainPrompt(null);
      });

      // Mario Kart events
      s.on('mariokart:starting', (state: MarioKartState) => {
        setMarioKartState(state);
        setMarioKartResult(null);
        setMarioKartError(null);
      });

      s.on('mariokart:state', (state: MarioKartState) => {
        setMarioKartState((prev) => {
          const track = prev?.track || state.track;
          return { ...state, track: track || state.track };
        });
      });

      s.on('mariokart:finished', (data: MarioKartResult) => {
        setMarioKartResult(data);
        setMarioKartState((prev) => prev ? { ...prev, status: 'finished', finishedAt: Date.now() } : prev);
      });

      s.on('mariokart:error', (data: { message: string }) => {
        setMarioKartError(data.message);
        import('sonner').then(({ toast }) => toast.error(data.message));
      });

      return () => {
        disconnectSocket();
        s.removeAllListeners();
      };
    }
  }, [user, updateBalance]);

  // Keep Mario Kart state in sync when joining/leaving a party
  useEffect(() => {
    if (user && currentParty) {
      marioKartEvents.requestState(currentParty.id, user.id);
    } else if (!currentParty) {
      setMarioKartState(null);
      setMarioKartResult(null);
    }
  }, [user, currentParty]);

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

  const deleteMessage = (messageId: string) => {
    if (user && socket) {
      socket.emit('chat:delete-message', { messageId, adminId: user.id });
    }
  };

  const createParty = (name?: string, isPublic: boolean = false, maxSize: number = 8) => {
    if (user) {
      partyEvents.create(user.id, name, isPublic, maxSize);
    }
  };

  const joinParty = (partyId: string) => {
    if (user) {
      partyEvents.join(user.id, partyId);
    }
  };

  const requestJoinParty = (partyId: string) => {
    if (user) {
      partyEvents.requestJoin(user.id, partyId);
      setPendingJoinRequests((prev) => (prev.includes(partyId) ? prev : [...prev, partyId]));
    }
  };

  const respondToJoinRequest = (targetUserId: string, accepted: boolean) => {
    if (user) {
      partyEvents.respondToJoinRequest(user.id, targetUserId, accepted);
      setPartyJoinRequests((prev) => prev.filter((request) => request.userId !== targetUserId));
    }
  };

  const leaveParty = () => {
    if (user) {
      if (currentParty) {
        marioKartEvents.leave(currentParty.id, user.id);
        setMarioKartState(null);
        setMarioKartResult(null);
      }
      partyEvents.leave(user.id);
    }
  };

  const deleteParty = () => {
    if (user) {
      if (currentParty) {
        marioKartEvents.leave(currentParty.id, user.id);
        setMarioKartState(null);
        setMarioKartResult(null);
      }
      partyEvents.delete(user.id);
    }
  };

  const inviteToParty = (targetUserId: string) => {
    if (user) {
      partyEvents.invite(user.id, targetUserId);
    }
  };

  const rejectPartyInvite = (partyId: string) => {
    if (user && socket) {
      socket.emit('party:reject-invite', { userId: user.id, partyId });
      setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== partyId));
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

  const respondToPlayAgainPrompt = (playAgain: boolean) => {
    if (user && bombPartyPlayAgainPrompt) {
      bombPartyEvents.respondToPlayAgain(bombPartyPlayAgainPrompt.partyId, user.id, playAgain);
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

  // Mario Kart actions
  const startMarioKart = (laps?: number) => {
    if (user && currentParty) {
      marioKartEvents.start(user.id, currentParty.id, laps);
    }
  };

  const sendMarioKartInput = (input: { throttle: number; steer: number; drift?: boolean; brake?: boolean }) => {
    if (user && currentParty) {
      marioKartEvents.input(currentParty.id, user.id, input);
    }
  };

  const requestMarioKartState = () => {
    if (user && currentParty) {
      marioKartEvents.requestState(currentParty.id, user.id);
    }
  };

  const leaveMarioKart = () => {
    if (user && currentParty) {
      marioKartEvents.leave(currentParty.id, user.id);
    }
    setMarioKartState(null);
    setMarioKartResult(null);
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
        deleteMessage,
        currentParty,
        partyMembers,
        partyInvites,
        partyJoinRequests,
        pendingJoinRequests,
        publicParties,
        createParty,
        joinParty,
        requestJoinParty,
        respondToJoinRequest,
        leaveParty,
        deleteParty,
        inviteToParty,
        rejectPartyInvite,
        kickFromParty,
        fetchPublicParties,
        syncParty,
        balanceUpdate,
        bombPartyGame,
        bombPartyGameOver,
        bombPartyRejection,
        bombPartyJoinPrompt,
        bombPartyPlayAgainPrompt,
        startBombParty,
        respondToJoinPrompt,
        respondToPlayAgainPrompt,
        typeBombParty,
        submitBombParty,
        leaveBombParty,
        clearBombPartyGameOver,
        marioKartState,
        marioKartResult,
        marioKartError,
        startMarioKart,
        sendMarioKartInput,
        requestMarioKartState,
        leaveMarioKart,
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
