import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { initSocket, connectSocket, disconnectSocket, chatEvents, partyEvents, gameEvents, bombPartyEvents, pokerEvents, petitBacEvents, russianRouletteEvents } from '../services/socket';
import { storeBanInfo } from '../services/ban';
import { useAuth } from './AuthContext';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  message: string;
  pinned: boolean;
  pinnedAt?: string | null;
  isTopMoney?: boolean;
  isTopAura?: boolean;
  badges?: Array<{
    id: string;
    name: string;
    description?: string | null;
    color: string;
  }>;
  reactions: Array<{ emoji: string; count: number }>;
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

interface PartyGameSuggestion {
  id: string;
  gameId: string;
  gameName: string;
  suggestedById: string;
  suggestedByName: string;
  suggestedByColor?: string | null;
  suggestedAt: number;
}

interface PartySelectedGame {
  gameId: string;
  gameName: string;
  selectedById: string;
  selectedByName: string;
  selectedByColor?: string | null;
  selectedAt: number;
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

type PokerStage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
type PokerAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';

interface PokerPlayerState {
  userId: string;
  username: string;
  usernameColor?: string | null;
  chips: number;
  bet: number;
  totalBet: number;
  hasFolded: boolean;
  isAllIn: boolean;
  isEliminated: boolean;
  lastAction: string | null;
  hand: string[];
}

interface PokerHandResult {
  winners: Array<{ userId: string; username: string; amountWon: number; handRank: string }>;
  showdown: Array<{ userId: string; username: string; hand: string[]; handRank: string }>;
  pot: number;
}

interface PokerGameState {
  partyId: string;
  stage: PokerStage;
  communityCards: string[];
  pot: number;
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
  highestBet: number;
  dealerId?: string;
  smallBlindId?: string;
  bigBlindId?: string;
  currentPlayerId?: string;
  turnEndsAt: number | null;
  handNumber: number;
  maxHands: number;
  startingStack: number;
  lastHandResult?: PokerHandResult;
  players: PokerPlayerState[];
  yourHand: string[];
  availableActions: PokerAction[];
  callAmount: number;
  minRaiseTo: number;
}

interface PokerJoinPrompt {
  partyId: string;
  leaderId: string;
  startStack: number;
  bigBlind: number;
  timeLimit: number;
  startTime: number;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
}

interface PokerPlayAgainPrompt {
  partyId: string;
  startStack: number;
  bigBlind: number;
  timeLimit: number;
  startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
  playAgainCount?: number;
  leaveCount?: number;
}

interface PokerGameOver {
  winnerId: string | null;
  winnerUsername: string | null;
  standings: Array<{ userId: string; username: string; chips: number }>;
}

interface PetitBacPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  score: number;
  submitted: boolean;
}

interface PetitBacGameState {
  partyId: string;
  players: PetitBacPlayer[];
  categories: string[];
  currentLetter: string;
  round: number;
  maxRounds: number;
  roundDuration: number;
  roundStartTime: number;
  phase: 'playing' | 'scoring';
  submittedCount: number;
}

interface PetitBacRoundResult {
  round: number;
  letter: string;
  categories: string[];
  submissions: Array<{
    userId: string;
    username: string;
    answers: Record<string, string>;
    perCategoryScores: Record<string, number>;
    score: number;
    totalScore: number;
  }>;
}

interface PetitBacJoinPrompt {
  partyId: string;
  leaderId: string;
  rounds: number;
  roundDuration: number;
  categories: string[];
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

interface PetitBacPlayAgainPrompt {
  partyId: string;
  timeLimit: number;
  startTime: number;
  gameOverData: {
    winnerIds: string[];
    winnerUsernames: string[];
    players: Array<{
      userId: string;
      username: string;
      score: number;
      isWinner: boolean;
    }>;
  };
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

interface RussianRoulettePlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  isAlive: boolean;
  roundsSurvived: number;
  isEliminated: boolean;
}

interface RussianRouletteGameState {
  players: RussianRoulettePlayer[];
  currentPlayerIndex: number;
  round: number;
  isActive: boolean;
  isYourTurn?: boolean;
  lastShot?: {
    playerId: string;
    playerUsername: string;
    fired: boolean;
  };
}

interface RussianRouletteGameOver {
  winnerId: string | null;
  winnerUsername: string | null;
  players: Array<{
    userId: string;
    username: string;
    roundsSurvived: number;
    isWinner: boolean;
    rewards: { aura: number; money: number };
  }>;
}

interface RussianRouletteJoinPrompt {
  partyId: string;
  timeout: number;
  startTime: number;
}

interface RussianRoulettePlayAgainPrompt {
  partyId: string;
  timeout: number;
  startTime: number;
  gameOverData: RussianRouletteGameOver;
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  // Chat
  messages: ChatMessage[];
  onlineUsers: OnlineUser[];
  onlineCount: number;
  typingUsers: TypingUser[];
  sendMessage: (message: string, replyToId?: string | null) => void;
  reactToMessage: (messageId: string, emoji: string) => void;
  setTyping: (isTyping: boolean) => void;
  setCurrentPage: (page: string) => void;
  deleteMessage: (messageId: string) => void;
  pinMessage: (messageId: string, pinned: boolean) => void;
  requestOnlineUsers: () => void;
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
  partyGameSuggestions: PartyGameSuggestion[];
  partySelectedGame: PartySelectedGame | null;
  suggestPartyGame: (gameId: string, gameName: string) => void;
  selectPartyGame: (gameId: string, gameName: string) => void;
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
  // Poker
  pokerGame: PokerGameState | null;
  pokerJoinPrompt: PokerJoinPrompt | null;
  pokerPlayAgainPrompt: PokerPlayAgainPrompt | null;
  pokerGameOver: PokerGameOver | null;
  startPoker: (startStack: number, bigBlind: number) => void;
  respondToPokerJoinPrompt: (accepted: boolean) => void;
  actInPoker: (action: PokerAction, amount?: number) => void;
  leavePoker: () => void;
  respondToPokerPlayAgainPrompt: (playAgain: boolean) => void;
  clearPokerGameOver: () => void;
  // Petit Bac
  petitBacGame: PetitBacGameState | null;
  petitBacRoundResult: PetitBacRoundResult | null;
  petitBacJoinPrompt: PetitBacJoinPrompt | null;
  petitBacPlayAgainPrompt: PetitBacPlayAgainPrompt | null;
  startPetitBac: (rounds: number, roundDuration: number, categories: string[]) => void;
  respondToPetitBacJoinPrompt: (accepted: boolean) => void;
  submitPetitBac: (answers: Record<string, string>) => void;
  leavePetitBac: () => void;
  respondToPetitBacPlayAgainPrompt: (playAgain: boolean) => void;
  // Russian Roulette
  russianRouletteGame: RussianRouletteGameState | null;
  russianRouletteGameOver: RussianRouletteGameOver | null;
  russianRouletteJoinPrompt: RussianRouletteJoinPrompt | null;
  russianRoulettePlayAgainPrompt: RussianRoulettePlayAgainPrompt | null;
  startRussianRoulette: () => void;
  respondToRussianRouletteJoin: (accepted: boolean) => void;
  pullTriggerRussianRoulette: () => void;
  leaveRussianRoulette: () => void;
  respondToRussianRoulettePlayAgain: (playAgain: boolean) => void;
  clearRussianRouletteGameOver: () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, updateBalance, logout } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  // Party state
  const [currentParty, setCurrentParty] = useState<Party | null>(null);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [partyInvites, setPartyInvites] = useState<PartyInvite[]>([]);
  const [partyJoinRequests, setPartyJoinRequests] = useState<PartyJoinRequest[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<string[]>([]);
  const [publicParties, setPublicParties] = useState<PartyDirectoryItem[]>([]);
  const [partyGameSuggestions, setPartyGameSuggestions] = useState<PartyGameSuggestion[]>([]);
  const [partySelectedGame, setPartySelectedGame] = useState<PartySelectedGame | null>(null);
  const [pendingJoinRedirectPartyId, setPendingJoinRedirectPartyId] = useState<string | null>(null);
  
  // Balance update state
  const [balanceUpdate, setBalanceUpdate] = useState<{ userId: string; aura: number; money: number } | null>(null);

  // Bomb Party state
  const [bombPartyGame, setBombPartyGame] = useState<BombPartyGameState | null>(null);
  const [bombPartyGameOver, setBombPartyGameOver] = useState<BombPartyGameOver | null>(null);
  const [bombPartyRejection, setBombPartyRejection] = useState<string | null>(null);
  const [bombPartyJoinPrompt, setBombPartyJoinPrompt] = useState<BombPartyJoinPrompt | null>(null);
  const [bombPartyPlayAgainPrompt, setBombPartyPlayAgainPrompt] = useState<BombPartyPlayAgainPrompt | null>(null);

  // Poker state
  const [pokerGame, setPokerGame] = useState<PokerGameState | null>(null);
  const [pokerJoinPrompt, setPokerJoinPrompt] = useState<PokerJoinPrompt | null>(null);
  const [pokerPlayAgainPrompt, setPokerPlayAgainPrompt] = useState<PokerPlayAgainPrompt | null>(null);
  const [pokerGameOver, setPokerGameOver] = useState<PokerGameOver | null>(null);

  // Petit Bac state
  const [petitBacGame, setPetitBacGame] = useState<PetitBacGameState | null>(null);
  const [petitBacRoundResult, setPetitBacRoundResult] = useState<PetitBacRoundResult | null>(null);
  const [petitBacJoinPrompt, setPetitBacJoinPrompt] = useState<PetitBacJoinPrompt | null>(null);
  const [petitBacPlayAgainPrompt, setPetitBacPlayAgainPrompt] = useState<PetitBacPlayAgainPrompt | null>(null);

  // Russian Roulette state
  const [russianRouletteGame, setRussianRouletteGame] = useState<RussianRouletteGameState | null>(null);
  const [russianRouletteGameOver, setRussianRouletteGameOver] = useState<RussianRouletteGameOver | null>(null);
  const [russianRouletteJoinPrompt, setRussianRouletteJoinPrompt] = useState<RussianRouletteJoinPrompt | null>(null);
  const [russianRoulettePlayAgainPrompt, setRussianRoulettePlayAgainPrompt] = useState<RussianRoulettePlayAgainPrompt | null>(null);


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
        pokerEvents.register(user.id);
      });

      s.on('disconnect', () => {
        setConnected(false);
      });

      const handleBan = (data: { message?: string; ban?: { reason?: string; type?: string; expiresAt?: string | null } }) => {
        storeBanInfo({
          reason: data?.ban?.reason ?? null,
          type: (data?.ban?.type as 'TEMPORARY' | 'PERMANENT' | null) ?? null,
          expiresAt: data?.ban?.expiresAt ?? null,
          message: data?.message,
        });
        logout();
        disconnectSocket();
        navigate('/banned', { replace: true });
      };

      s.on('ban:enforced', handleBan);
      s.on('ban:active', handleBan);

      // Chat events
      s.on('chat:history', (data: { messages: ChatMessage[] }) => {
        setMessages(
          data.messages.map((message) => ({
            ...message,
            reactions: message.reactions ?? [],
            pinned: message.pinned ?? false,
            pinnedAt: message.pinnedAt ?? null,
          }))
        );
      });

      s.on('chat:message', (message: ChatMessage) => {
        setMessages((prev) => [
          ...prev,
          {
            ...message,
            reactions: message.reactions ?? [],
            pinned: message.pinned ?? false,
            pinnedAt: message.pinnedAt ?? null,
          },
        ]);
      });

      s.on('chat:muted', (data: { message?: string }) => {
        if (typeof window !== 'undefined') {
          import('sonner').then(({ toast }) => {
            toast(data.message || 'Vous êtes mute du chat.');
          });
        }
      });

      s.on('users:online-list', (data: { users: OnlineUser[] }) => {
        setOnlineUsers(data.users);
        setOnlineCount(data.users.length);
      });

      s.on('users:online-count', (data: { count: number }) => {
        setOnlineCount(data.count);
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

      s.on('chat:message-deleted', (data: { messageId: string }) => {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      });

      s.on('chat:reactions-updated', (data: { messageId: string; reactions: Array<{ emoji: string; count: number }> }) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === data.messageId
              ? { ...message, reactions: data.reactions }
              : message
          )
        );
      });

      s.on('chat:pin-updated', (data: { messageId: string; pinned: boolean; pinnedAt: string | null }) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === data.messageId
              ? { ...message, pinned: data.pinned, pinnedAt: data.pinnedAt }
              : message
          )
        );
      });

      // Party events
      s.on('party:created', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPendingJoinRequests([]);
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
        setPokerGame(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
        setPokerGameOver(null);
      });

      s.on('party:joined', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== data.party.id));
        setPendingJoinRequests([]);
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
        setPokerGame(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
        setPokerGameOver(null);
        if (
          typeof window !== 'undefined' &&
          pendingJoinRedirectPartyId === data.party.id &&
          window.location.pathname !== '/party'
        ) {
          navigate('/party');
        }
        setPendingJoinRedirectPartyId(null);
      });

      s.on('party:restored', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== data.party.id));
        setPendingJoinRequests([]);
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
        setPokerGame(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
        setPokerGameOver(null);
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
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
        setPokerGame(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
        setPokerGameOver(null);
      });

      s.on('party:left', () => {
        setCurrentParty(null);
        setPartyMembers([]);
        setPartyJoinRequests([]);
        setPendingJoinRequests([]);
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
        setPokerGame(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
        setPokerGameOver(null);
      });

      s.on('party:kicked', () => {
        setCurrentParty(null);
        setPartyMembers([]);
        setPartyJoinRequests([]);
        setPendingJoinRequests([]);
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
        setPokerGame(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
        setPokerGameOver(null);
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

      s.on('party:game-state', (data: { selectedGame: PartySelectedGame | null; suggestions: PartyGameSuggestion[] }) => {
        setPartySelectedGame(data.selectedGame);
        setPartyGameSuggestions(data.suggestions);
      });

      s.on('party:error', () => {
        setPendingJoinRedirectPartyId(null);
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

      // Poker events
      s.on('poker:state', (game: PokerGameState) => {
        setPokerGame(game);
        setPokerGameOver(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
      });

      s.on('poker:join-prompt', (data: PokerJoinPrompt) => {
        setPokerJoinPrompt({
          ...data,
          responses: data.responses || [],
        });
      });

      s.on('poker:join-response-update', (data: { partyId: string; responses: Array<{ userId: string; accepted: boolean }> }) => {
        setPokerJoinPrompt((prev) => (prev ? { ...prev, responses: data.responses } : null));
      });

      s.on('poker:join-cancelled', () => {
        setPokerJoinPrompt(null);
      });

      s.on('poker:game-over', (data: PokerGameOver) => {
        setPokerGame(null);
        setPokerGameOver(data);
      });

      s.on('poker:play-again-prompt', (data: PokerPlayAgainPrompt) => {
        const responses = data.responses || [];
        setPokerPlayAgainPrompt({
          ...data,
          responses,
          playAgainCount: data.playAgainCount ?? responses.filter((r) => r.playAgain).length,
          leaveCount: data.leaveCount ?? responses.filter((r) => !r.playAgain).length,
        });
      });

      s.on('poker:play-again-response-update', (data: {
        partyId: string;
        responses: Array<{ userId: string; playAgain: boolean }>;
        playAgainCount: number;
        leaveCount: number;
      }) => {
        setPokerPlayAgainPrompt((prev) => prev ? {
          ...prev,
          responses: data.responses,
          playAgainCount: data.playAgainCount,
          leaveCount: data.leaveCount,
        } : null);
      });

      s.on('poker:play-again-cancelled', () => {
        setPokerPlayAgainPrompt(null);
      });

      s.on('poker:error', (data: { message: string }) => {
        console.error('Poker error:', data.message);
      });

      // Petit Bac events
      s.on('petitbac:started', (game: PetitBacGameState) => {
        setPetitBacGame(game);
        setPetitBacRoundResult(null);
        setPetitBacJoinPrompt(null);
        setPetitBacPlayAgainPrompt(null);
      });

      s.on('petitbac:round-started', (game: PetitBacGameState) => {
        setPetitBacGame(game);
        setPetitBacRoundResult(null);
      });

      s.on('petitbac:player-submitted', (data: { userId: string; submittedCount: number }) => {
        setPetitBacGame((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            submittedCount: data.submittedCount,
            players: prev.players.map((p) =>
              p.userId === data.userId ? { ...p, submitted: true } : p
            ),
          };
        });
      });

      s.on('petitbac:player-left', (data: { userId: string }) => {
        setPetitBacGame((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            players: prev.players.filter((p) => p.userId !== data.userId),
          };
        });
      });

      s.on('petitbac:round-ended', (data: { game: PetitBacGameState; result: PetitBacRoundResult }) => {
        setPetitBacGame(data.game);
        setPetitBacRoundResult(data.result);
      });

      s.on('petitbac:error', (data: { message: string }) => {
        console.error('Petit Bac error:', data.message);
      });

      s.on('petitbac:join-prompt', (data: {
        partyId: string;
        leaderId: string;
        rounds: number;
        roundDuration: number;
        categories: string[];
        timeLimit: number;
        members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
        responses?: Array<{ userId: string; accepted: boolean }>;
      }) => {
        setPetitBacJoinPrompt({
          ...data,
          startTime: Date.now(),
          responses: data.responses || [],
        });
      });

      s.on('petitbac:join-response-update', (data: {
        partyId: string;
        responses: Array<{ userId: string; accepted: boolean }>;
      }) => {
        setPetitBacJoinPrompt((prev) => (prev ? { ...prev, responses: data.responses } : null));
      });

      s.on('petitbac:join-cancelled', () => {
        setPetitBacJoinPrompt(null);
      });

      s.on('petitbac:play-again-prompt', (data: {
        partyId: string;
        timeLimit: number;
        gameOverData: PetitBacPlayAgainPrompt['gameOverData'];
        players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
        responses?: Array<{ userId: string; playAgain: boolean }>;
        playAgainCount?: number;
        leaveCount?: number;
      }) => {
        const responses = data.responses || [];
        setPetitBacPlayAgainPrompt({
          ...data,
          startTime: Date.now(),
          responses,
          playAgainCount: data.playAgainCount ?? responses.filter((r) => r.playAgain).length,
          leaveCount: data.leaveCount ?? responses.filter((r) => !r.playAgain).length,
        });
        setPetitBacGame(null);
      });

      s.on('petitbac:play-again-response-update', (data: {
        partyId: string;
        responses: Array<{ userId: string; playAgain: boolean }>;
        playAgainCount: number;
        leaveCount: number;
      }) => {
        setPetitBacPlayAgainPrompt((prev) =>
          prev
            ? {
                ...prev,
                responses: data.responses,
                playAgainCount: data.playAgainCount,
                leaveCount: data.leaveCount,
              }
            : null
        );
      });

      s.on('petitbac:play-again-cancelled', () => {
        setPetitBacPlayAgainPrompt(null);
      });

      // Russian Roulette events
      s.on('russianroulette:game-started', (game: RussianRouletteGameState) => {
        setRussianRouletteGame(game);
        setRussianRouletteGameOver(null);
        setRussianRouletteJoinPrompt(null);
        setRussianRoulettePlayAgainPrompt(null);
      });

      s.on('russianroulette:state', (game: RussianRouletteGameState) => {
        setRussianRouletteGame(game);
      });

      s.on('russianroulette:game-over', (data: RussianRouletteGameOver) => {
        setRussianRouletteGameOver(data);
        setRussianRouletteGame(null);
      });

      s.on('russianroulette:game-cancelled', () => {
        setRussianRouletteGame(null);
        setRussianRouletteGameOver(null);
      });

      s.on('russianroulette:join-prompt', (data: { partyId: string; timeout: number }) => {
        setRussianRouletteJoinPrompt({
          ...data,
          startTime: Date.now(),
        });
      });

      s.on('russianroulette:join-cancelled', () => {
        setRussianRouletteJoinPrompt(null);
      });

      s.on('russianroulette:play-again-prompt', (data: {
        partyId: string;
        timeout: number;
        gameOverData: RussianRouletteGameOver;
      }) => {
        setRussianRoulettePlayAgainPrompt({
          ...data,
          startTime: Date.now(),
        });
      });

      s.on('russianroulette:play-again-resolved', () => {
        setRussianRoulettePlayAgainPrompt(null);
      });

      s.on('russianroulette:error', (data: { message: string }) => {
        console.error('Russian Roulette error:', data.message);
      });

      return () => {
        disconnectSocket();
        s.removeAllListeners();
      };
    }
  }, [user, updateBalance, logout, navigate]);

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

  const reactToMessage = (messageId: string, emoji: string) => {
    if (user) {
      chatEvents.react(user.id, messageId, emoji);
    }
  };

  const setCurrentPage = (page: string) => {
    if (user) {
      chatEvents.setPage(user.id, page);
    }
  };

  const requestOnlineUsers = () => {
    if (socket) {
      socket.emit('chat:request-online-users');
    }
  };

  const deleteMessage = (messageId: string) => {
    if (user && socket) {
      socket.emit('chat:delete-message', { messageId, adminId: user.id });
    }
  };

  const pinMessage = (messageId: string, pinned: boolean) => {
    if (user) {
      chatEvents.pinMessage(user.id, messageId, pinned);
    }
  };

  const createParty = (name?: string, isPublic: boolean = false, maxSize: number = 8) => {
    if (user) {
      partyEvents.create(user.id, name, isPublic, maxSize);
    }
  };

  const joinParty = (partyId: string) => {
    if (user) {
      setPendingJoinRedirectPartyId(partyId);
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

  const suggestPartyGame = (gameId: string, gameName: string) => {
    if (user && currentParty) {
      partyEvents.suggestGame(user.id, gameId, gameName);
    }
  };

  const selectPartyGame = (gameId: string, gameName: string) => {
    if (user && currentParty) {
      partyEvents.selectGame(user.id, gameId, gameName);
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

  // Poker actions
  const startPoker = (startStack: number, bigBlind: number) => {
    if (user && currentParty) {
      pokerEvents.start(user.id, currentParty.id, startStack, bigBlind);
    }
  };

  const respondToPokerJoinPrompt = (accepted: boolean) => {
    if (user && pokerJoinPrompt) {
      pokerEvents.respondToJoin(pokerJoinPrompt.partyId, user.id, accepted);
    }
  };

  const actInPoker = (action: PokerAction, amount?: number) => {
    if (user && currentParty) {
      pokerEvents.action(currentParty.id, user.id, action, amount);
    }
  };

  const leavePoker = () => {
    if (user && currentParty) {
      pokerEvents.leave(currentParty.id, user.id);
    }
    setPokerGame(null);
  };

  const respondToPokerPlayAgainPrompt = (playAgain: boolean) => {
    if (user && pokerPlayAgainPrompt) {
      pokerEvents.respondToPlayAgain(pokerPlayAgainPrompt.partyId, user.id, playAgain);
    }
  };

  const clearPokerGameOver = () => {
    setPokerGameOver(null);
    setPokerGame(null);
  };

  // Petit Bac actions
  const startPetitBac = (rounds: number, roundDuration: number, categories: string[]) => {
    if (user && currentParty) {
      petitBacEvents.start(user.id, currentParty.id, rounds, roundDuration, categories);
    }
  };

  const respondToPetitBacJoinPrompt = (accepted: boolean) => {
    if (user && petitBacJoinPrompt) {
      petitBacEvents.respondToJoin(petitBacJoinPrompt.partyId, user.id, accepted);
    }
  };

  const submitPetitBac = (answers: Record<string, string>) => {
    if (user && currentParty) {
      petitBacEvents.submit(currentParty.id, user.id, answers);
    }
  };

  const leavePetitBac = () => {
    if (user && currentParty) {
      petitBacEvents.leave(currentParty.id, user.id);
    }
    setPetitBacGame(null);
  };

  const respondToPetitBacPlayAgainPrompt = (playAgain: boolean) => {
    if (user && petitBacPlayAgainPrompt) {
      petitBacEvents.respondToPlayAgain(petitBacPlayAgainPrompt.partyId, user.id, playAgain);
    }
  };

  // Russian Roulette actions
  const startRussianRoulette = () => {
    if (user && currentParty) {
      russianRouletteEvents.start(user.id, currentParty.id);
    }
  };

  const respondToRussianRouletteJoin = (accepted: boolean) => {
    if (user && russianRouletteJoinPrompt) {
      russianRouletteEvents.respondToJoin(russianRouletteJoinPrompt.partyId, user.id, accepted);
    }
  };

  const pullTriggerRussianRoulette = () => {
    if (user && currentParty) {
      russianRouletteEvents.pullTrigger(currentParty.id, user.id);
    }
  };

  const leaveRussianRoulette = () => {
    if (user && currentParty) {
      russianRouletteEvents.leave(currentParty.id, user.id);
    }
    setRussianRouletteGame(null);
  };

  const respondToRussianRoulettePlayAgain = (playAgain: boolean) => {
    if (user && russianRoulettePlayAgainPrompt) {
      russianRouletteEvents.respondToPlayAgain(russianRoulettePlayAgainPrompt.partyId, user.id, playAgain);
    }
  };

  const clearRussianRouletteGameOver = () => {
    setRussianRouletteGameOver(null);
    setRussianRouletteGame(null);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        messages,
        onlineUsers,
        onlineCount,
        typingUsers,
        sendMessage,
        reactToMessage,
        setTyping,
        setCurrentPage,
        requestOnlineUsers,
        deleteMessage,
        pinMessage,
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
        partyGameSuggestions,
        partySelectedGame,
        suggestPartyGame,
        selectPartyGame,
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
        pokerGame,
        pokerJoinPrompt,
        pokerPlayAgainPrompt,
        pokerGameOver,
        startPoker,
        respondToPokerJoinPrompt,
        actInPoker,
        leavePoker,
        respondToPokerPlayAgainPrompt,
        clearPokerGameOver,
        petitBacGame,
        petitBacRoundResult,
        petitBacJoinPrompt,
        petitBacPlayAgainPrompt,
        startPetitBac,
        respondToPetitBacJoinPrompt,
        submitPetitBac,
        leavePetitBac,
        respondToPetitBacPlayAgainPrompt,
        russianRouletteGame,
        russianRouletteGameOver,
        russianRouletteJoinPrompt,
        russianRoulettePlayAgainPrompt,
        startRussianRoulette,
        respondToRussianRouletteJoin,
        pullTriggerRussianRoulette,
        leaveRussianRoulette,
        respondToRussianRoulettePlayAgain,
        clearRussianRouletteGameOver,
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
