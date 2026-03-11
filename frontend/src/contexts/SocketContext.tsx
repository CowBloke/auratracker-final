import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { initSocket, connectSocket, disconnectSocket, chatEvents, partyEvents, gameEvents, bombPartyEvents, pokerEvents, petitBacEvents, duelEvents } from '../services/socket';
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

interface DoodleSpectateSession {
  hostUserId: string;
  hostUsername: string;
  mode: 'classic' | 'mort_subite';
  spectatorCount: number;
  score: number;
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
  members?: Array<{
    userId: string;
    username: string;
    usernameColor?: string | null;
    isLeader: boolean;
  }>;
  selectedGame?: {
    gameId: string;
    gameName: string;
    selectedById: string;
    selectedByName: string;
    selectedByColor?: string | null;
    selectedAt: number;
  } | null;
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

interface PartyChatMessage {
  id: string;
  partyId: string;
  userId: string;
  username: string;
  usernameColor?: string | null;
  message: string;
  timestamp: string;
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
  lives: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  startTime: number;
  players: Array<{
    userId: string;
    username: string;
    usernameColor?: string | null;
  }>;
  gameOverData?: BombPartyGameOver;
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

interface PetitBacGameOver {
  winnerIds: string[];
  winnerUsernames: string[];
  players: Array<{
    userId: string;
    username: string;
    score: number;
    isWinner: boolean;
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
  rounds: number;
  roundDuration: number;
  categories: string[];
  gameOverData?: {
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

interface P4JoinPrompt {
  partyId: string;
  leaderId: string;
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

interface P4PlayAgainPrompt {
  partyId: string;
  timeLimit: number;
  startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
}

interface BattleshipPlayAgainPrompt {
  partyId: string;
  timeLimit: number;
  startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
}

interface ChessJoinPrompt {
  partyId: string;
  leaderId: string;
  timeLimit: number;
  startTime: number;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
}

interface ChessPlayAgainPrompt {
  partyId: string;
  timeLimit: number;
  startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
}

// Russian Roulette
interface RRPlayerState {
  userId: string;
  username: string;
  usernameColor?: string | null;
  isAlive: boolean;
  pullCount: number;
  passedOut: boolean;
}

export interface RRGameState {
  partyId: string;
  players: RRPlayerState[];
  currentPlayerId: string | null;
  cylinderPosition: number;
  round: number;
  isActive: boolean;
  lastEvent: { type: 'click' | 'bang' | 'pass'; playerId: string; username: string } | null;
  turnEndsAt: number;
  alivePlayers: number;
  totalPlayers: number;
}

export interface RRGameOver {
  winnerId: string | null;
  winnerUsername: string | null;
  standings: Array<{ userId: string; username: string; usernameColor?: string | null; isAlive: boolean; pullCount: number; passedOut: boolean }>;
}

interface RRJoinPrompt {
  partyId: string;
  leaderId: string;
  timeLimit: number;
  startTime: number;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
}

interface RRPlayAgainPrompt {
  partyId: string;
  timeLimit: number;
  startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
  playAgainCount?: number;
}

interface IncomingDuelChallenge {
  challengerId: string;
  challengerUsername: string;
  challengerUsernameColor?: string | null;
  gameType: 'chess' | 'battleship' | 'p4';
  timeLimit: number;
  sentAt: number;
}

interface OutgoingDuelChallenge {
  targetId: string;
  targetUsername: string;
  gameType: 'chess' | 'battleship' | 'p4';
}

interface ActiveJoinPrompt {
  gameType: string;
  title: string;
  settingsText?: string;
  navigateTo: string;
  partyId: string;
  leaderId: string;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
  timeLimit: number;
  startTime: number;
}

interface ActiveReplayPrompt {
  gameType: string;
  settingsText?: string;
  partyId: string;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
  timeLimit: number;
  startTime: number;
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
  doodleSpectateSessions: DoodleSpectateSession[];
  requestDoodleSpectateSessions: () => void;
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
  partyMessages: PartyChatMessage[];
  sendPartyMessage: (message: string) => void;
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
  respondToBombPartyPlayAgainPrompt: (playAgain: boolean) => void;
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
  petitBacGameOver: PetitBacGameOver | null;
  petitBacJoinPrompt: PetitBacJoinPrompt | null;
  petitBacPlayAgainPrompt: PetitBacPlayAgainPrompt | null;
  startPetitBac: (rounds: number, roundDuration: number, categories: string[]) => void;
  respondToPetitBacJoinPrompt: (accepted: boolean) => void;
  submitPetitBac: (answers: Record<string, string>) => void;
  leavePetitBac: () => void;
  respondToPetitBacPlayAgainPrompt: (playAgain: boolean) => void;
  clearPetitBacGameOver: () => void;
  // Puissance 4
  p4JoinPrompt: P4JoinPrompt | null;
  startP4: () => void;
  respondToP4JoinPrompt: (accepted: boolean) => void;
  p4PlayAgainPrompt: P4PlayAgainPrompt | null;
  respondToP4PlayAgainPrompt: (playAgain: boolean) => void;
  // Battleship
  battleshipPlayAgainPrompt: BattleshipPlayAgainPrompt | null;
  respondToBattleshipPlayAgainPrompt: (playAgain: boolean) => void;
  // Chess
  chessJoinPrompt: ChessJoinPrompt | null;
  respondToChessJoinPrompt: (accepted: boolean) => void;
  chessPlayAgainPrompt: ChessPlayAgainPrompt | null;
  respondToChessPlayAgainPrompt: (playAgain: boolean) => void;
  // Russian Roulette
  rouletteGame: RRGameState | null;
  rouletteGameOver: RRGameOver | null;
  rouletteJoinPrompt: RRJoinPrompt | null;
  roulettePlayAgainPrompt: RRPlayAgainPrompt | null;
  startRoulette: () => void;
  pullRouletteTrigger: () => void;
  passRoulette: () => void;
  respondToRoulettePlayAgainPrompt: (playAgain: boolean) => void;
  clearRouletteGameOver: () => void;
  // Unified prompts
  activeJoinPrompt: ActiveJoinPrompt | null;
  activeReplayPrompt: ActiveReplayPrompt | null;
  respondToGameJoinPrompt: (accepted: boolean) => void;
  respondToGameReplayPrompt: (playAgain: boolean) => void;
  // Duel challenges
  incomingDuelChallenge: IncomingDuelChallenge | null;
  outgoingDuelChallenge: OutgoingDuelChallenge | null;
  challengeUserToDuel: (targetId: string, targetUsername: string, gameType: 'chess' | 'battleship' | 'p4') => void;
  acceptDuelChallenge: () => void;
  declineDuelChallenge: () => void;
  cancelDuelChallenge: () => void;
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
  const [doodleSpectateSessions, setDoodleSpectateSessions] = useState<DoodleSpectateSession[]>([]);
  
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
  const [partyMessages, setPartyMessages] = useState<PartyChatMessage[]>([]);
  
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
  const [petitBacGameOver, setPetitBacGameOver] = useState<PetitBacGameOver | null>(null);
  const [petitBacJoinPrompt, setPetitBacJoinPrompt] = useState<PetitBacJoinPrompt | null>(null);
  const [petitBacPlayAgainPrompt, setPetitBacPlayAgainPrompt] = useState<PetitBacPlayAgainPrompt | null>(null);

  // Puissance 4 state
  const [p4JoinPrompt, setP4JoinPrompt] = useState<P4JoinPrompt | null>(null);
  const [p4PlayAgainPrompt, setP4PlayAgainPrompt] = useState<P4PlayAgainPrompt | null>(null);

  // Battleship state
  const [battleshipPlayAgainPrompt, setBattleshipPlayAgainPrompt] = useState<BattleshipPlayAgainPrompt | null>(null);

  // Chess state
  const [chessJoinPrompt, setChessJoinPrompt] = useState<ChessJoinPrompt | null>(null);
  const [chessPlayAgainPrompt, setChessPlayAgainPrompt] = useState<ChessPlayAgainPrompt | null>(null);

  // Russian Roulette state
  const [rouletteGame, setRouletteGame] = useState<RRGameState | null>(null);
  const [rouletteGameOver, setRouletteGameOver] = useState<RRGameOver | null>(null);
  const [rouletteJoinPrompt, setRouletteJoinPrompt] = useState<RRJoinPrompt | null>(null);
  const [roulettePlayAgainPrompt, setRoulettePlayAgainPrompt] = useState<RRPlayAgainPrompt | null>(null);

  // Duel state
  const [incomingDuelChallenge, setIncomingDuelChallenge] = useState<IncomingDuelChallenge | null>(null);
  const [outgoingDuelChallenge, setOutgoingDuelChallenge] = useState<OutgoingDuelChallenge | null>(null);

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
        partyEvents.list();
        gameEvents.register(user.id);
        s.emit('doodle:spectate-list-request');
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

      s.on('doodle:spectate-sessions', (data: { sessions: DoodleSpectateSession[] }) => {
        setDoodleSpectateSessions(Array.isArray(data.sessions) ? data.sessions : []);
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
        setPartyMessages([]);
        setBombPartyPlayAgainPrompt(null);
        setPendingJoinRequests([]);
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
        setPokerGame(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
        setPokerGameOver(null);
        partyEvents.list();
      });

      s.on('party:joined', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPartyMessages([]);
        setBombPartyPlayAgainPrompt(null);
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
        partyEvents.list();
      });

      s.on('party:restored', (data: { party: Party; members: PartyMember[] }) => {
        setCurrentParty(data.party);
        setPartyMembers(data.members);
        setPartyMessages([]);
        setBombPartyPlayAgainPrompt((prev) =>
          prev && prev.partyId === data.party.id ? prev : null
        );
        setPartyInvites((prev) => prev.filter((invite) => invite.partyId !== data.party.id));
        setPendingJoinRequests([]);
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
        setPokerGame(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
        setPokerGameOver(null);
        setRouletteGame(null);
        setRouletteGameOver(null);
        setRouletteJoinPrompt(null);
        setRoulettePlayAgainPrompt(null);
      });

      s.on('party:member-joined', (member: { userId: string; username: string; usernameColor?: string | null }) => {
        setPartyMembers((prev) => [...prev, { ...member, isLeader: false }]);
        partyEvents.list();
      });

      s.on('party:member-left', (data: { userId: string }) => {
        setPartyMembers((prev) => prev.filter((m) => m.userId !== data.userId));
        partyEvents.list();
      });

      s.on('party:disbanded', () => {
        setCurrentParty(null);
        setPartyMembers([]);
        setPartyMessages([]);
        setBombPartyPlayAgainPrompt(null);
        setPartyJoinRequests([]);
        setPendingJoinRequests([]);
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
        setPokerGame(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
        setPokerGameOver(null);
        setRouletteGame(null);
        setRouletteGameOver(null);
        setRouletteJoinPrompt(null);
        setRoulettePlayAgainPrompt(null);
        partyEvents.list();
      });

      s.on('party:left', () => {
        setCurrentParty(null);
        setPartyMembers([]);
        setPartyMessages([]);
        setBombPartyPlayAgainPrompt(null);
        setPartyJoinRequests([]);
        setPendingJoinRequests([]);
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
        setPokerGame(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
        setPokerGameOver(null);
        setRouletteGame(null);
        setRouletteGameOver(null);
        setRouletteJoinPrompt(null);
        setRoulettePlayAgainPrompt(null);
        partyEvents.list();
      });

      s.on('party:kicked', () => {
        setCurrentParty(null);
        setPartyMembers([]);
        setPartyMessages([]);
        setBombPartyPlayAgainPrompt(null);
        setPartyJoinRequests([]);
        setPendingJoinRequests([]);
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
        setPokerGame(null);
        setPokerJoinPrompt(null);
        setPokerPlayAgainPrompt(null);
        setPokerGameOver(null);
        setRouletteGame(null);
        setRouletteGameOver(null);
        setRouletteJoinPrompt(null);
        setRoulettePlayAgainPrompt(null);
        partyEvents.list();
      });

      s.on('party:not-in-party', () => {
        setCurrentParty(null);
        setPartyMembers([]);
        setPartyMessages([]);
        setPartyJoinRequests([]);
        setPendingJoinRequests([]);
        setPartyGameSuggestions([]);
        setPartySelectedGame(null);
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

      s.on('party:chat-history', (data: { partyId: string; messages: PartyChatMessage[] }) => {
        setPartyMessages(data.messages);
      });

      s.on('party:chat-message', (message: PartyChatMessage) => {
        setPartyMessages((prev) => {
          if (prev.some((entry) => entry.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
      });

      s.on('party:chat-error', (data: { message: string }) => {
        import('sonner').then(({ toast }) => {
          toast.error(data.message);
        });
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

      s.on('bombparty:play-again-prompt', (data: {
        partyId: string;
        lives: number;
        difficulty: 'easy' | 'medium' | 'hard';
        timeLimit: number;
        startTime?: number;
        players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
        gameOverData?: BombPartyGameOver;
        responses?: Array<{ userId: string; playAgain: boolean }>;
        playAgainCount?: number;
        leaveCount?: number;
      }) => {
        const responses = data.responses || [];
        setBombPartyPlayAgainPrompt({
          ...data,
          startTime: data.startTime ?? Date.now(),
          responses,
          playAgainCount: data.playAgainCount ?? responses.filter((r) => r.playAgain).length,
          leaveCount: data.leaveCount ?? responses.filter((r) => !r.playAgain).length,
        });
      });

      s.on('bombparty:play-again-response-update', (data: {
        partyId: string;
        responses: Array<{ userId: string; playAgain: boolean }>;
        playAgainCount: number;
        leaveCount: number;
      }) => {
        setBombPartyPlayAgainPrompt((prev) =>
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
        setPetitBacGameOver(null);
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

      s.on('petitbac:game-over', (data: PetitBacGameOver) => {
        setPetitBacGameOver(data);
        setPetitBacGame(null);
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
        startTime?: number;
        rounds: number;
        roundDuration: number;
        categories: string[];
        players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
        responses?: Array<{ userId: string; playAgain: boolean }>;
        playAgainCount?: number;
        leaveCount?: number;
      }) => {
        const responses = data.responses || [];
        setPetitBacPlayAgainPrompt({
          ...data,
          startTime: data.startTime ?? Date.now(),
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

      // Puissance 4 join prompt events
      s.on('p4:join-prompt', (data: {
        partyId: string;
        leaderId: string;
        timeLimit: number;
        startTime: number;
        members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
        responses: Array<{ userId: string; accepted: boolean }>;
      }) => {
        setP4JoinPrompt({ ...data });
      });

      s.on('p4:join-response-update', (data: {
        partyId: string;
        responses: Array<{ userId: string; accepted: boolean }>;
      }) => {
        setP4JoinPrompt((prev) => (prev ? { ...prev, responses: data.responses } : null));
      });

      s.on('p4:join-cancelled', () => {
        setP4JoinPrompt(null);
      });

      s.on('p4:state', () => {
        setP4JoinPrompt(null);
        setP4PlayAgainPrompt(null);
      });

      s.on('p4:play-again-prompt', (data: {
        partyId: string;
        timeLimit: number;
        startTime?: number;
        players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
        responses?: Array<{ userId: string; playAgain: boolean }>;
      }) => {
        setP4PlayAgainPrompt({
          partyId: data.partyId,
          timeLimit: data.timeLimit,
          startTime: data.startTime ?? Date.now(),
          players: data.players,
          responses: data.responses || [],
        });
      });

      s.on('p4:play-again-response-update', (data: {
        partyId: string;
        responses: Array<{ userId: string; playAgain: boolean }>;
      }) => {
        setP4PlayAgainPrompt((prev) => prev ? { ...prev, responses: data.responses } : null);
      });

      s.on('p4:play-again-cancelled', () => {
        setP4PlayAgainPrompt(null);
      });

      // Battleship play-again events
      s.on('battleship:play-again-prompt', (data: {
        partyId: string;
        timeLimit: number;
        startTime?: number;
        players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
        responses?: Array<{ userId: string; playAgain: boolean }>;
      }) => {
        setBattleshipPlayAgainPrompt({
          partyId: data.partyId,
          timeLimit: data.timeLimit,
          startTime: data.startTime ?? Date.now(),
          players: data.players,
          responses: data.responses || [],
        });
      });

      s.on('battleship:play-again-response-update', (data: {
        partyId: string;
        responses: Array<{ userId: string; playAgain: boolean }>;
      }) => {
        setBattleshipPlayAgainPrompt((prev) => prev ? { ...prev, responses: data.responses } : null);
      });

      s.on('battleship:play-again-cancelled', () => {
        setBattleshipPlayAgainPrompt(null);
      });

      s.on('battleship:state', () => {
        setBattleshipPlayAgainPrompt(null);
      });

      s.on('chess:join-prompt', (data: ChessJoinPrompt) => {
        setChessJoinPrompt(data);
      });

      s.on('chess:join-response-update', (data: {
        partyId: string;
        responses: Array<{ userId: string; accepted: boolean }>;
      }) => {
        setChessJoinPrompt((prev) => (prev ? { ...prev, responses: data.responses } : null));
      });

      s.on('chess:join-cancelled', () => {
        setChessJoinPrompt(null);
      });

      s.on('chess:state', () => {
        setChessJoinPrompt(null);
        setChessPlayAgainPrompt(null);
      });

      s.on('chess:play-again-prompt', (data: ChessPlayAgainPrompt) => {
        setChessPlayAgainPrompt(data);
      });

      s.on('chess:play-again-response-update', (data: {
        partyId: string;
        responses: Array<{ userId: string; playAgain: boolean }>;
      }) => {
        setChessPlayAgainPrompt((prev) => (prev ? { ...prev, responses: data.responses } : null));
      });

      s.on('chess:play-again-cancelled', () => {
        setChessPlayAgainPrompt(null);
      });

      // Russian Roulette events
      s.on('roulette:state', (game: RRGameState) => {
        setRouletteGame(game);
        setRouletteGameOver(null);
        setRouletteJoinPrompt(null);
        setRoulettePlayAgainPrompt(null);
      });

      s.on('roulette:join-prompt', (data: RRJoinPrompt) => {
        setRouletteJoinPrompt({ ...data, startTime: Date.now(), responses: data.responses || [] });
      });

      s.on('roulette:join-response-update', (data: { partyId: string; responses: Array<{ userId: string; accepted: boolean }> }) => {
        setRouletteJoinPrompt((prev) => prev ? { ...prev, responses: data.responses } : null);
      });

      s.on('roulette:join-cancelled', () => {
        setRouletteJoinPrompt(null);
      });

      s.on('roulette:game-over', (data: RRGameOver) => {
        setRouletteGame(null);
        setRouletteGameOver(data);
      });

      s.on('roulette:play-again-prompt', (data: RRPlayAgainPrompt) => {
        const responses = data.responses || [];
        setRoulettePlayAgainPrompt({
          ...data,
          startTime: data.startTime ?? Date.now(),
          responses,
          playAgainCount: data.playAgainCount ?? responses.filter((r) => r.playAgain).length,
        });
      });

      s.on('roulette:play-again-response-update', (data: { partyId: string; responses: Array<{ userId: string; playAgain: boolean }>; playAgainCount: number }) => {
        setRoulettePlayAgainPrompt((prev) => prev ? { ...prev, responses: data.responses, playAgainCount: data.playAgainCount } : null);
      });

      s.on('roulette:play-again-cancelled', () => {
        setRoulettePlayAgainPrompt(null);
      });

      s.on('roulette:error', (data: { message: string }) => {
        console.error('Roulette error:', data.message);
      });

      // Duel events
      s.on('duel:challenge-received', (data: IncomingDuelChallenge) => {
        setIncomingDuelChallenge(data);
      });

      s.on('duel:challenge-sent', () => {
        // outgoing challenge state is set optimistically in challengeUserToDuel
      });

      s.on('duel:challenge-accepted', (data: { targetId: string; targetUsername: string; gameType: string }) => {
        setOutgoingDuelChallenge(null);
        import('sonner').then(({ toast }) => {
          toast(`Défi accepté !`, { description: `${data.targetUsername} a accepté. Redirection en cours...` });
        });
      });

      s.on('duel:challenge-declined', (data: { targetId: string; targetUsername: string; gameType: string }) => {
        setOutgoingDuelChallenge(null);
        import('sonner').then(({ toast }) => {
          toast(`Défi refusé`, { description: `${data.targetUsername} a refusé le défi.` });
        });
      });

      s.on('duel:challenge-expired', () => {
        setOutgoingDuelChallenge(null);
        import('sonner').then(({ toast }) => {
          toast('Défi expiré', { description: "Le joueur n'a pas répondu à temps." });
        });
      });

      s.on('duel:challenge-cancelled', () => {
        setIncomingDuelChallenge(null);
      });

      s.on('duel:challenge-error', (data: { message: string }) => {
        setIncomingDuelChallenge(null);
        setOutgoingDuelChallenge(null);
        import('sonner').then(({ toast }) => {
          toast.error(data.message);
        });
      });

      s.on('duel:redirect', (data: { gameType: string; partyId: string; path: string }) => {
        setIncomingDuelChallenge(null);
        setOutgoingDuelChallenge(null);
        navigate(data.path);
      });

      return () => {
        disconnectSocket();
        s.removeAllListeners();
      };
    }
  }, [user?.id, user?.username, logout, navigate]);

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

  const requestDoodleSpectateSessions = () => {
    if (socket) {
      socket.emit('doodle:spectate-list-request');
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
    const activeSocket = socket ?? initSocket();
    if (!socket) {
      setSocket(activeSocket);
    }

    if (activeSocket.connected) {
      partyEvents.list();
      return;
    }

    activeSocket.once('connect', () => {
      partyEvents.list();
    });
    connectSocket();
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

  const sendPartyMessage = (message: string) => {
    if (user && currentParty) {
      partyEvents.sendChatMessage(message);
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

  const respondToBombPartyPlayAgainPrompt = (playAgain: boolean) => {
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

  const clearPetitBacGameOver = () => {
    setPetitBacGameOver(null);
  };

  // Puissance 4 actions
  const startP4 = () => {
    if (socket && currentParty) {
      socket.emit('p4:start', { partyId: currentParty.id });
    }
  };

  const respondToP4JoinPrompt = (accepted: boolean) => {
    if (socket && p4JoinPrompt) {
      socket.emit('p4:join-response', { partyId: p4JoinPrompt.partyId, accepted });
      if (!accepted) setP4JoinPrompt(null);
    }
  };

  const respondToP4PlayAgainPrompt = (playAgain: boolean) => {
    if (socket && p4PlayAgainPrompt) {
      socket.emit('p4:play-again-response', { partyId: p4PlayAgainPrompt.partyId, playAgain });
    }
  };

  const respondToBattleshipPlayAgainPrompt = (playAgain: boolean) => {
    if (socket && battleshipPlayAgainPrompt && user) {
      socket.emit('battleship:play-again-response', {
        userId: user.id,
        partyId: battleshipPlayAgainPrompt.partyId,
        playAgain,
      });
    }
  };

  const respondToChessJoinPrompt = (accepted: boolean) => {
    if (socket && chessJoinPrompt) {
      socket.emit('chess:join-response', { partyId: chessJoinPrompt.partyId, accepted });
      if (!accepted) setChessJoinPrompt(null);
    }
  };

  const respondToChessPlayAgainPrompt = (playAgain: boolean) => {
    if (socket && chessPlayAgainPrompt) {
      socket.emit('chess:play-again-response', { partyId: chessPlayAgainPrompt.partyId, playAgain });
    }
  };

  // Russian Roulette actions
  const startRoulette = () => {
    if (socket && currentParty) {
      socket.emit('roulette:start', { partyId: currentParty.id });
    }
  };

  const pullRouletteTrigger = () => {
    if (socket && currentParty) {
      socket.emit('roulette:pull', { partyId: currentParty.id });
    }
  };

  const passRoulette = () => {
    if (socket && currentParty) {
      socket.emit('roulette:pass', { partyId: currentParty.id });
    }
  };

  const respondToRoulettePlayAgainPrompt = (playAgain: boolean) => {
    if (socket && roulettePlayAgainPrompt) {
      socket.emit('roulette:play-again-response', { partyId: roulettePlayAgainPrompt.partyId, playAgain });
    }
  };

  const clearRouletteGameOver = () => {
    setRouletteGameOver(null);
    setRouletteGame(null);
  };

  const challengeUserToDuel = (targetId: string, targetUsername: string, gameType: 'chess' | 'battleship' | 'p4') => {
    if (!user) return;
    setOutgoingDuelChallenge({ targetId, targetUsername, gameType });
    duelEvents.challenge(targetId, gameType);
  };

  const acceptDuelChallenge = () => {
    if (!incomingDuelChallenge) return;
    duelEvents.accept(incomingDuelChallenge.challengerId, incomingDuelChallenge.gameType);
    setIncomingDuelChallenge(null);
  };

  const declineDuelChallenge = () => {
    if (!incomingDuelChallenge) return;
    duelEvents.decline(incomingDuelChallenge.challengerId, incomingDuelChallenge.gameType);
    setIncomingDuelChallenge(null);
  };

  const cancelDuelChallenge = () => {
    if (!outgoingDuelChallenge) return;
    duelEvents.cancel(outgoingDuelChallenge.targetId, outgoingDuelChallenge.gameType);
    setOutgoingDuelChallenge(null);
  };

  const respondToGameJoinPrompt = (accepted: boolean) => {
    if (!user) return;
    if (bombPartyJoinPrompt) {
      bombPartyEvents.respondToJoin(bombPartyJoinPrompt.partyId, user.id, accepted);
    } else if (pokerJoinPrompt) {
      pokerEvents.respondToJoin(pokerJoinPrompt.partyId, user.id, accepted);
    } else if (petitBacJoinPrompt) {
      petitBacEvents.respondToJoin(petitBacJoinPrompt.partyId, user.id, accepted);
    } else if (p4JoinPrompt && socket) {
      socket.emit('p4:join-response', { partyId: p4JoinPrompt.partyId, accepted });
      if (!accepted) setP4JoinPrompt(null);
    } else if (chessJoinPrompt && socket) {
      socket.emit('chess:join-response', { partyId: chessJoinPrompt.partyId, accepted });
      if (!accepted) setChessJoinPrompt(null);
    } else if (rouletteJoinPrompt && socket) {
      socket.emit('roulette:join-response', { partyId: rouletteJoinPrompt.partyId, accepted });
      if (!accepted) setRouletteJoinPrompt(null);
    }
  };

  const respondToGameReplayPrompt = (playAgain: boolean) => {
    if (!user) return;
    if (bombPartyPlayAgainPrompt) {
      bombPartyEvents.respondToPlayAgain(bombPartyPlayAgainPrompt.partyId, user.id, playAgain);
    } else if (pokerPlayAgainPrompt) {
      pokerEvents.respondToPlayAgain(pokerPlayAgainPrompt.partyId, user.id, playAgain);
    } else if (petitBacPlayAgainPrompt) {
      petitBacEvents.respondToPlayAgain(petitBacPlayAgainPrompt.partyId, user.id, playAgain);
    } else if (p4PlayAgainPrompt && socket) {
      socket.emit('p4:play-again-response', { partyId: p4PlayAgainPrompt.partyId, playAgain });
    } else if (battleshipPlayAgainPrompt && socket) {
      socket.emit('battleship:play-again-response', {
        userId: user.id,
        partyId: battleshipPlayAgainPrompt.partyId,
        playAgain,
      });
    } else if (chessPlayAgainPrompt && socket) {
      socket.emit('chess:play-again-response', {
        partyId: chessPlayAgainPrompt.partyId,
        playAgain,
      });
    } else if (roulettePlayAgainPrompt && socket) {
      socket.emit('roulette:play-again-response', { partyId: roulettePlayAgainPrompt.partyId, playAgain });
    }
  };

  const activeJoinPrompt = useMemo((): ActiveJoinPrompt | null => {
    if (bombPartyJoinPrompt) {
      const diff = bombPartyJoinPrompt.difficulty === 'easy' ? 'Facile'
        : bombPartyJoinPrompt.difficulty === 'medium' ? 'Moyen' : 'Difficile';
      return {
        gameType: 'bombparty',
        title: 'Rejoindre Bomb Party ?',
        settingsText: `${bombPartyJoinPrompt.lives} vies · Difficulté ${diff}`,
        navigateTo: '/games/bomb-party',
        partyId: bombPartyJoinPrompt.partyId,
        leaderId: bombPartyJoinPrompt.leaderId,
        members: bombPartyJoinPrompt.members,
        responses: bombPartyJoinPrompt.responses,
        timeLimit: bombPartyJoinPrompt.timeLimit,
        startTime: bombPartyJoinPrompt.startTime,
      };
    }
    if (pokerJoinPrompt) {
      return {
        gameType: 'poker',
        title: 'Rejoindre Poker ?',
        settingsText: `Stack ${pokerJoinPrompt.startStack} · Blindes ${pokerJoinPrompt.bigBlind / 2}/${pokerJoinPrompt.bigBlind}`,
        navigateTo: '/games/poker',
        partyId: pokerJoinPrompt.partyId,
        leaderId: pokerJoinPrompt.leaderId,
        members: pokerJoinPrompt.members,
        responses: pokerJoinPrompt.responses,
        timeLimit: pokerJoinPrompt.timeLimit,
        startTime: pokerJoinPrompt.startTime,
      };
    }
    if (petitBacJoinPrompt) {
      return {
        gameType: 'petitbac',
        title: 'Rejoindre Petit Bac ?',
        settingsText: `${petitBacJoinPrompt.rounds} manches · ${Math.round(petitBacJoinPrompt.roundDuration / 1000)}s · ${petitBacJoinPrompt.categories.join(' · ')}`,
        navigateTo: '/games/petit-bac',
        partyId: petitBacJoinPrompt.partyId,
        leaderId: petitBacJoinPrompt.leaderId,
        members: petitBacJoinPrompt.members,
        responses: petitBacJoinPrompt.responses,
        timeLimit: petitBacJoinPrompt.timeLimit,
        startTime: petitBacJoinPrompt.startTime,
      };
    }
    if (p4JoinPrompt) {
      return {
        gameType: 'p4',
        title: 'Rejoindre Puissance 4 ?',
        navigateTo: '/games/puissance-quatre',
        partyId: p4JoinPrompt.partyId,
        leaderId: p4JoinPrompt.leaderId,
        members: p4JoinPrompt.members,
        responses: p4JoinPrompt.responses,
        timeLimit: p4JoinPrompt.timeLimit,
        startTime: p4JoinPrompt.startTime,
      };
    }
    if (chessJoinPrompt) {
      return {
        gameType: 'chess',
        title: 'Rejoindre Échecs ?',
        navigateTo: '/games/echecs',
        partyId: chessJoinPrompt.partyId,
        leaderId: chessJoinPrompt.leaderId,
        members: chessJoinPrompt.members,
        responses: chessJoinPrompt.responses,
        timeLimit: chessJoinPrompt.timeLimit,
        startTime: chessJoinPrompt.startTime,
      };
    }
    if (rouletteJoinPrompt) {
      return {
        gameType: 'roulette',
        title: 'Rejoindre Russian Roulette ?',
        navigateTo: '/games/russian-roulette',
        partyId: rouletteJoinPrompt.partyId,
        leaderId: rouletteJoinPrompt.leaderId,
        members: rouletteJoinPrompt.members,
        responses: rouletteJoinPrompt.responses,
        timeLimit: rouletteJoinPrompt.timeLimit,
        startTime: rouletteJoinPrompt.startTime,
      };
    }
    return null;
  }, [bombPartyJoinPrompt, pokerJoinPrompt, petitBacJoinPrompt, p4JoinPrompt, chessJoinPrompt, rouletteJoinPrompt]);

  const activeReplayPrompt = useMemo((): ActiveReplayPrompt | null => {
    if (bombPartyPlayAgainPrompt) {
      const diff = bombPartyPlayAgainPrompt.difficulty === 'easy' ? 'Facile'
        : bombPartyPlayAgainPrompt.difficulty === 'medium' ? 'Moyen' : 'Difficile';
      return {
        gameType: 'bombparty',
        settingsText: `${bombPartyPlayAgainPrompt.lives} vies · Difficulté ${diff}`,
        partyId: bombPartyPlayAgainPrompt.partyId,
        players: bombPartyPlayAgainPrompt.players,
        responses: bombPartyPlayAgainPrompt.responses,
        timeLimit: bombPartyPlayAgainPrompt.timeLimit,
        startTime: bombPartyPlayAgainPrompt.startTime,
      };
    }
    if (pokerPlayAgainPrompt) {
      return {
        gameType: 'poker',
        settingsText: `Stack ${pokerPlayAgainPrompt.startStack} · Blindes ${pokerPlayAgainPrompt.bigBlind / 2}/${pokerPlayAgainPrompt.bigBlind}`,
        partyId: pokerPlayAgainPrompt.partyId,
        players: pokerPlayAgainPrompt.players,
        responses: pokerPlayAgainPrompt.responses,
        timeLimit: pokerPlayAgainPrompt.timeLimit,
        startTime: pokerPlayAgainPrompt.startTime,
      };
    }
    if (petitBacPlayAgainPrompt) {
      return {
        gameType: 'petitbac',
        settingsText: `${petitBacPlayAgainPrompt.rounds} manches · ${Math.round(petitBacPlayAgainPrompt.roundDuration / 1000)}s`,
        partyId: petitBacPlayAgainPrompt.partyId,
        players: petitBacPlayAgainPrompt.players,
        responses: petitBacPlayAgainPrompt.responses,
        timeLimit: petitBacPlayAgainPrompt.timeLimit,
        startTime: petitBacPlayAgainPrompt.startTime,
      };
    }
    if (p4PlayAgainPrompt) {
      return {
        gameType: 'p4',
        settingsText: 'Puissance 4',
        partyId: p4PlayAgainPrompt.partyId,
        players: p4PlayAgainPrompt.players,
        responses: p4PlayAgainPrompt.responses,
        timeLimit: p4PlayAgainPrompt.timeLimit,
        startTime: p4PlayAgainPrompt.startTime,
      };
    }
    if (battleshipPlayAgainPrompt) {
      return {
        gameType: 'battleship',
        settingsText: 'Bataille Navale',
        partyId: battleshipPlayAgainPrompt.partyId,
        players: battleshipPlayAgainPrompt.players,
        responses: battleshipPlayAgainPrompt.responses,
        timeLimit: battleshipPlayAgainPrompt.timeLimit,
        startTime: battleshipPlayAgainPrompt.startTime,
      };
    }
    if (chessPlayAgainPrompt) {
      return {
        gameType: 'chess',
        settingsText: 'Échecs',
        partyId: chessPlayAgainPrompt.partyId,
        players: chessPlayAgainPrompt.players,
        responses: chessPlayAgainPrompt.responses,
        timeLimit: chessPlayAgainPrompt.timeLimit,
        startTime: chessPlayAgainPrompt.startTime,
      };
    }
    if (roulettePlayAgainPrompt) {
      return {
        gameType: 'roulette',
        settingsText: 'Russian Roulette',
        partyId: roulettePlayAgainPrompt.partyId,
        players: roulettePlayAgainPrompt.players,
        responses: roulettePlayAgainPrompt.responses,
        timeLimit: roulettePlayAgainPrompt.timeLimit,
        startTime: roulettePlayAgainPrompt.startTime,
      };
    }
    return null;
  }, [bombPartyPlayAgainPrompt, pokerPlayAgainPrompt, petitBacPlayAgainPrompt, p4PlayAgainPrompt, battleshipPlayAgainPrompt, chessPlayAgainPrompt, roulettePlayAgainPrompt]);

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
        doodleSpectateSessions,
        requestDoodleSpectateSessions,
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
        partyMessages,
        sendPartyMessage,
        balanceUpdate,
        bombPartyGame,
        bombPartyGameOver,
        bombPartyRejection,
        bombPartyJoinPrompt,
        bombPartyPlayAgainPrompt,
        startBombParty,
        respondToJoinPrompt,
        respondToBombPartyPlayAgainPrompt,
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
        petitBacGameOver,
        petitBacJoinPrompt,
        petitBacPlayAgainPrompt,
        startPetitBac,
        respondToPetitBacJoinPrompt,
        submitPetitBac,
        leavePetitBac,
        respondToPetitBacPlayAgainPrompt,
        clearPetitBacGameOver,
        p4JoinPrompt,
        startP4,
        respondToP4JoinPrompt,
        p4PlayAgainPrompt,
        respondToP4PlayAgainPrompt,
        battleshipPlayAgainPrompt,
        respondToBattleshipPlayAgainPrompt,
        chessJoinPrompt,
        respondToChessJoinPrompt,
        chessPlayAgainPrompt,
        respondToChessPlayAgainPrompt,
        rouletteGame,
        rouletteGameOver,
        rouletteJoinPrompt,
        roulettePlayAgainPrompt,
        startRoulette,
        pullRouletteTrigger,
        passRoulette,
        respondToRoulettePlayAgainPrompt,
        clearRouletteGameOver,
        activeJoinPrompt,
        activeReplayPrompt,
        respondToGameJoinPrompt,
        respondToGameReplayPrompt,
        incomingDuelChallenge,
        outgoingDuelChallenge,
        challengeUserToDuel,
        acceptDuelChallenge,
        declineDuelChallenge,
        cancelDuelChallenge,
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
