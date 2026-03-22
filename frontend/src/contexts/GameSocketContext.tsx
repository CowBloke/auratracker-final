import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { usePartySocket } from './PartySocketContext';
import {
  initSocket,
  getSocket,
  gameEvents,
  bombPartyEvents,
  pokerEvents,
  petitBacEvents,
} from '../services/socket';

// ─── Bomb Party ───────────────────────────────────────────────────────────────
interface BombPartyPlayer {
  userId: string; username: string; usernameColor?: string | null;
  lives: number; isEliminated: boolean; wordsTypedCount: number;
}
interface BombPartyGameState {
  partyId: string; players: BombPartyPlayer[]; currentPlayerIndex: number;
  currentPlayerId: string; currentPrompt: string; currentInput: string;
  difficulty: 'easy' | 'medium' | 'hard'; turnDuration: number;
  turnStartTime: number; round: number; usedWords: string[]; maxLives: number;
}
interface BombPartyGameOver {
  winnerId: string | null; winnerUsername: string | null;
  players: Array<{ userId: string; username: string; wordsTypedCount: number; isWinner: boolean; rewards: { aura: number; money: number } }>;
}
interface BombPartyJoinPrompt {
  partyId: string; leaderId: string; lives: number; difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number; startTime: number;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
}
interface BombPartyPlayAgainPrompt {
  partyId: string; lives: number; difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number; startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  gameOverData?: BombPartyGameOver;
  responses: Array<{ userId: string; playAgain: boolean }>;
  playAgainCount: number; leaveCount: number;
}

// ─── Poker ────────────────────────────────────────────────────────────────────
type PokerStage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type PokerAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';
interface PokerPlayerState {
  userId: string; username: string; usernameColor?: string | null;
  chips: number; bet: number; totalBet: number; hasFolded: boolean;
  isAllIn: boolean; isEliminated: boolean; lastAction: string | null; hand: string[];
}
interface PokerHandResult {
  winners: Array<{ userId: string; username: string; amountWon: number; handRank: string }>;
  showdown: Array<{ userId: string; username: string; hand: string[]; handRank: string }>;
  pot: number;
}
interface PokerGameState {
  partyId: string; stage: PokerStage; communityCards: string[]; pot: number;
  smallBlind: number; bigBlind: number; minRaise: number; highestBet: number;
  dealerId?: string; smallBlindId?: string; bigBlindId?: string; currentPlayerId?: string;
  turnEndsAt: number | null; handNumber: number; maxHands: number; startingStack: number;
  lastHandResult?: PokerHandResult; players: PokerPlayerState[]; yourHand: string[];
  availableActions: PokerAction[]; callAmount: number; minRaiseTo: number;
}
interface PokerJoinPrompt {
  partyId: string; leaderId: string; startStack: number; bigBlind: number;
  timeLimit: number; startTime: number;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
}
interface PokerPlayAgainPrompt {
  partyId: string; startStack: number; bigBlind: number; timeLimit: number; startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
  playAgainCount?: number; leaveCount?: number;
}
interface PokerGameOver {
  winnerId: string | null; winnerUsername: string | null;
  standings: Array<{ userId: string; username: string; chips: number }>;
}

// ─── Petit Bac ────────────────────────────────────────────────────────────────
interface PetitBacPlayer {
  userId: string; username: string; usernameColor?: string | null; score: number; submitted: boolean;
}
interface PetitBacGameState {
  partyId: string; players: PetitBacPlayer[]; categories: string[]; currentLetter: string;
  round: number; maxRounds: number; roundDuration: number; roundStartTime: number;
  phase: 'playing' | 'scoring'; submittedCount: number;
}
interface PetitBacRoundResult {
  round: number; letter: string; categories: string[];
  submissions: Array<{ userId: string; username: string; answers: Record<string, string>; perCategoryScores: Record<string, number>; score: number; totalScore: number }>;
}
interface PetitBacGameOver {
  winnerIds: string[]; winnerUsernames: string[];
  players: Array<{ userId: string; username: string; score: number; isWinner: boolean }>;
}
interface PetitBacJoinPrompt {
  partyId: string; leaderId: string; rounds: number; roundDuration: number; categories: string[];
  timeLimit: number; startTime: number;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
}
interface PetitBacPlayAgainPrompt {
  partyId: string; timeLimit: number; startTime: number; rounds: number; roundDuration: number;
  categories: string[];
  gameOverData?: { winnerIds: string[]; winnerUsernames: string[]; players: Array<{ userId: string; username: string; score: number; isWinner: boolean }> };
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
  playAgainCount: number; leaveCount: number;
}

// ─── P4 / Ball Arena / Battleship / Chess / Roulette ─────────────────────────
interface P4JoinPrompt {
  partyId: string; leaderId: string; timeLimit: number; startTime: number;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
}
interface P4PlayAgainPrompt {
  partyId: string; timeLimit: number; startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
}
interface MorpionJoinPrompt {
  partyId: string; leaderId: string; timeLimit: number; startTime: number;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
}
interface MorpionPlayAgainPrompt {
  partyId: string; timeLimit: number; startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
}
interface BallArenaPlayAgainPrompt {
  partyId: string; timeLimit: number; startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
}
interface BattleshipPlayAgainPrompt {
  partyId: string; timeLimit: number; startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
}
interface ChessJoinPrompt {
  partyId: string; leaderId: string; timeLimit: number; startTime: number;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
}
interface ChessPlayAgainPrompt {
  partyId: string; timeLimit: number; startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
}
export interface RRGameState {
  partyId: string; players: Array<{ userId: string; username: string; usernameColor?: string | null; isAlive: boolean; pullCount: number; passedOut: boolean }>;
  currentPlayerId: string | null; cylinderPosition: number; round: number; isActive: boolean;
  lastEvent: { type: 'click' | 'bang' | 'pass'; playerId: string; username: string } | null;
  turnEndsAt: number; alivePlayers: number; totalPlayers: number;
}
export interface RRGameOver {
  winnerId: string | null; winnerUsername: string | null;
  standings: Array<{ userId: string; username: string; usernameColor?: string | null; isAlive: boolean; pullCount: number; passedOut: boolean }>;
}
interface RRJoinPrompt {
  partyId: string; leaderId: string; timeLimit: number; startTime: number;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
}
interface RRPlayAgainPrompt {
  partyId: string; timeLimit: number; startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
  playAgainCount?: number;
}

// ─── Unified prompts ──────────────────────────────────────────────────────────
export interface ActiveJoinPrompt {
  gameType: string; title: string; settingsText?: string; navigateTo: string;
  partyId: string; leaderId: string;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
  timeLimit: number; startTime: number;
}
export interface ActiveReplayPrompt {
  gameType: string; settingsText?: string; partyId: string;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
  timeLimit: number; startTime: number;
}

interface GameSocketContextValue {
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
  p4JoinPrompt: P4JoinPrompt | null;
  startP4: () => void;
  respondToP4JoinPrompt: (accepted: boolean) => void;
  p4PlayAgainPrompt: P4PlayAgainPrompt | null;
  respondToP4PlayAgainPrompt: (playAgain: boolean) => void;
  morpionJoinPrompt: MorpionJoinPrompt | null;
  startMorpion: () => void;
  respondToMorpionJoinPrompt: (accepted: boolean) => void;
  morpionPlayAgainPrompt: MorpionPlayAgainPrompt | null;
  respondToMorpionPlayAgainPrompt: (playAgain: boolean) => void;
  ballArenaPlayAgainPrompt: BallArenaPlayAgainPrompt | null;
  respondToBallArenaPlayAgainPrompt: (playAgain: boolean) => void;
  battleshipPlayAgainPrompt: BattleshipPlayAgainPrompt | null;
  respondToBattleshipPlayAgainPrompt: (playAgain: boolean) => void;
  chessJoinPrompt: ChessJoinPrompt | null;
  respondToChessJoinPrompt: (accepted: boolean) => void;
  chessPlayAgainPrompt: ChessPlayAgainPrompt | null;
  respondToChessPlayAgainPrompt: (playAgain: boolean) => void;
  rouletteGame: RRGameState | null;
  rouletteGameOver: RRGameOver | null;
  rouletteJoinPrompt: RRJoinPrompt | null;
  roulettePlayAgainPrompt: RRPlayAgainPrompt | null;
  startRoulette: () => void;
  pullRouletteTrigger: () => void;
  passRoulette: () => void;
  respondToRoulettePlayAgainPrompt: (playAgain: boolean) => void;
  clearRouletteGameOver: () => void;
  activeJoinPrompt: ActiveJoinPrompt | null;
  activeReplayPrompt: ActiveReplayPrompt | null;
  respondToGameJoinPrompt: (accepted: boolean) => void;
  respondToGameReplayPrompt: (playAgain: boolean) => void;
}

const GameSocketContext = createContext<GameSocketContextValue | null>(null);

export function GameSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { currentParty } = usePartySocket();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  // Keep currentParty in a ref so game action callbacks don't need it as dep
  const currentPartyRef = useRef(currentParty);
  useEffect(() => { currentPartyRef.current = currentParty; }, [currentParty]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [bombPartyGame, setBombPartyGame] = useState<BombPartyGameState | null>(null);
  const [bombPartyGameOver, setBombPartyGameOver] = useState<BombPartyGameOver | null>(null);
  const [bombPartyRejection, setBombPartyRejection] = useState<string | null>(null);
  const [bombPartyJoinPrompt, setBombPartyJoinPrompt] = useState<BombPartyJoinPrompt | null>(null);
  const [bombPartyPlayAgainPrompt, setBombPartyPlayAgainPrompt] = useState<BombPartyPlayAgainPrompt | null>(null);

  const [pokerGame, setPokerGame] = useState<PokerGameState | null>(null);
  const [pokerJoinPrompt, setPokerJoinPrompt] = useState<PokerJoinPrompt | null>(null);
  const [pokerPlayAgainPrompt, setPokerPlayAgainPrompt] = useState<PokerPlayAgainPrompt | null>(null);
  const [pokerGameOver, setPokerGameOver] = useState<PokerGameOver | null>(null);

  const [petitBacGame, setPetitBacGame] = useState<PetitBacGameState | null>(null);
  const [petitBacRoundResult, setPetitBacRoundResult] = useState<PetitBacRoundResult | null>(null);
  const [petitBacGameOver, setPetitBacGameOver] = useState<PetitBacGameOver | null>(null);
  const [petitBacJoinPrompt, setPetitBacJoinPrompt] = useState<PetitBacJoinPrompt | null>(null);
  const [petitBacPlayAgainPrompt, setPetitBacPlayAgainPrompt] = useState<PetitBacPlayAgainPrompt | null>(null);

  const [p4JoinPrompt, setP4JoinPrompt] = useState<P4JoinPrompt | null>(null);
  const [p4PlayAgainPrompt, setP4PlayAgainPrompt] = useState<P4PlayAgainPrompt | null>(null);
  const [morpionJoinPrompt, setMorpionJoinPrompt] = useState<MorpionJoinPrompt | null>(null);
  const [morpionPlayAgainPrompt, setMorpionPlayAgainPrompt] = useState<MorpionPlayAgainPrompt | null>(null);
  const [ballArenaPlayAgainPrompt, setBallArenaPlayAgainPrompt] = useState<BallArenaPlayAgainPrompt | null>(null);
  const [battleshipPlayAgainPrompt, setBattleshipPlayAgainPrompt] = useState<BattleshipPlayAgainPrompt | null>(null);
  const [chessJoinPrompt, setChessJoinPrompt] = useState<ChessJoinPrompt | null>(null);
  const [chessPlayAgainPrompt, setChessPlayAgainPrompt] = useState<ChessPlayAgainPrompt | null>(null);
  const [rouletteGame, setRouletteGame] = useState<RRGameState | null>(null);
  const [rouletteGameOver, setRouletteGameOver] = useState<RRGameOver | null>(null);
  const [rouletteJoinPrompt, setRouletteJoinPrompt] = useState<RRJoinPrompt | null>(null);
  const [roulettePlayAgainPrompt, setRoulettePlayAgainPrompt] = useState<RRPlayAgainPrompt | null>(null);

  // ── Clear all game state when party changes ────────────────────────────────
  const clearAllGameState = useCallback(() => {
    setBombPartyPlayAgainPrompt(null);
    setPokerGame(null); setPokerJoinPrompt(null); setPokerPlayAgainPrompt(null); setPokerGameOver(null);
    setRouletteGame(null); setRouletteGameOver(null); setRouletteJoinPrompt(null); setRoulettePlayAgainPrompt(null);
  }, []);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const s = initSocket();

    const handleConnect = () => {
      gameEvents.register(user.id);
      pokerEvents.register(user.id);
    };

    if (s.connected) handleConnect();
    s.on('connect', handleConnect);

    // Party lifecycle — clear game state when party changes
    s.on('party:created', clearAllGameState);
    s.on('party:joined', clearAllGameState);
    s.on('party:disbanded', clearAllGameState);
    s.on('party:left', clearAllGameState);
    s.on('party:kicked', clearAllGameState);
    s.on('party:restored', clearAllGameState);

    // ── Bomb Party ──────────────────────────────────────────────────────────
    s.on('bombparty:started', (game: BombPartyGameState) => {
      setBombPartyGame(game);
      setBombPartyGameOver(null);
      setBombPartyJoinPrompt(null);
      setBombPartyPlayAgainPrompt(null);
      navigateRef.current('/games/bomb-party');
    });

    s.on('bombparty:typing', (data: { input: string; userId: string }) => {
      setBombPartyGame((prev) => (prev ? { ...prev, currentInput: data.input } : null));
    });

    s.on('bombparty:word-accepted', (data: BombPartyGameState & { word: string; playerId: string }) => {
      setBombPartyGame(data);
    });

    s.on('bombparty:word-rejected', (data: { reason: string }) => {
      setBombPartyRejection(data.reason);
      setTimeout(() => setBombPartyRejection(null), 2000);
    });

    s.on('bombparty:bomb-exploded', (data: { playerId: string; livesRemaining: number }) => {
      setBombPartyGame((prev) =>
        prev
          ? { ...prev, players: prev.players.map((p) => p.userId === data.playerId ? { ...p, lives: data.livesRemaining } : p) }
          : null
      );
    });

    s.on('bombparty:player-eliminated', (data: { playerId: string }) => {
      setBombPartyGame((prev) =>
        prev
          ? { ...prev, players: prev.players.map((p) => p.userId === data.playerId ? { ...p, isEliminated: true, lives: 0 } : p) }
          : null
      );
    });

    s.on('bombparty:turn-changed', (game: BombPartyGameState) => setBombPartyGame(game));

    s.on('bombparty:game-over', (data: BombPartyGameOver) => {
      setBombPartyGameOver(data);
      setBombPartyGame(null);
    });

    s.on('bombparty:join-prompt', (data: {
      partyId: string; leaderId: string; lives: number; difficulty: 'easy' | 'medium' | 'hard';
      timeLimit: number; members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
      responses?: Array<{ userId: string; accepted: boolean }>;
    }) => {
      setBombPartyJoinPrompt({ ...data, startTime: Date.now(), responses: data.responses || [] });
    });

    s.on('bombparty:join-response-update', (data: { responses: Array<{ userId: string; accepted: boolean }> }) => {
      setBombPartyJoinPrompt((prev) => prev ? { ...prev, responses: data.responses } : null);
    });

    s.on('bombparty:join-cancelled', () => setBombPartyJoinPrompt(null));

    s.on('bombparty:play-again-prompt', (data: {
      partyId: string; lives: number; difficulty: 'easy' | 'medium' | 'hard';
      timeLimit: number; startTime?: number;
      players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
      gameOverData?: BombPartyGameOver;
      responses?: Array<{ userId: string; playAgain: boolean }>;
      playAgainCount?: number; leaveCount?: number;
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

    s.on('bombparty:play-again-response-update', (data: { responses: Array<{ userId: string; playAgain: boolean }>; playAgainCount: number; leaveCount: number }) => {
      setBombPartyPlayAgainPrompt((prev) => prev ? { ...prev, ...data } : null);
    });

    s.on('bombparty:play-again-cancelled', () => setBombPartyPlayAgainPrompt(null));

    // ── Poker ───────────────────────────────────────────────────────────────
    s.on('poker:state', (game: PokerGameState) => {
      setPokerGame(game);
      setPokerGameOver(null);
      setPokerJoinPrompt(null);
      setPokerPlayAgainPrompt(null);
    });

    s.on('poker:join-prompt', (data: PokerJoinPrompt) => {
      setPokerJoinPrompt({ ...data, responses: data.responses || [] });
    });

    s.on('poker:join-response-update', (data: { responses: Array<{ userId: string; accepted: boolean }> }) => {
      setPokerJoinPrompt((prev) => (prev ? { ...prev, responses: data.responses } : null));
    });

    s.on('poker:join-cancelled', () => setPokerJoinPrompt(null));

    s.on('poker:game-over', (data: PokerGameOver) => {
      setPokerGame(null);
      setPokerGameOver(data);
    });

    s.on('poker:play-again-prompt', (data: PokerPlayAgainPrompt) => {
      const responses = data.responses || [];
      setPokerPlayAgainPrompt({
        ...data, responses,
        playAgainCount: data.playAgainCount ?? responses.filter((r) => r.playAgain).length,
        leaveCount: data.leaveCount ?? responses.filter((r) => !r.playAgain).length,
      });
    });

    s.on('poker:play-again-response-update', (data: { responses: Array<{ userId: string; playAgain: boolean }>; playAgainCount: number; leaveCount: number }) => {
      setPokerPlayAgainPrompt((prev) => prev ? { ...prev, ...data } : null);
    });

    s.on('poker:play-again-cancelled', () => setPokerPlayAgainPrompt(null));

    // ── Petit Bac ───────────────────────────────────────────────────────────
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
      setPetitBacGame((prev) =>
        prev
          ? { ...prev, submittedCount: data.submittedCount, players: prev.players.map((p) => p.userId === data.userId ? { ...p, submitted: true } : p) }
          : null
      );
    });

    s.on('petitbac:player-left', (data: { userId: string }) => {
      setPetitBacGame((prev) =>
        prev ? { ...prev, players: prev.players.filter((p) => p.userId !== data.userId) } : null
      );
    });

    s.on('petitbac:round-ended', (data: { game: PetitBacGameState; result: PetitBacRoundResult }) => {
      setPetitBacGame(data.game);
      setPetitBacRoundResult(data.result);
    });

    s.on('petitbac:game-over', (data: PetitBacGameOver) => {
      setPetitBacGameOver(data);
      setPetitBacGame(null);
    });

    s.on('petitbac:join-prompt', (data: { partyId: string; leaderId: string; rounds: number; roundDuration: number; categories: string[]; timeLimit: number; members: Array<{ userId: string; username: string; usernameColor?: string | null }>; responses?: Array<{ userId: string; accepted: boolean }> }) => {
      setPetitBacJoinPrompt({ ...data, startTime: Date.now(), responses: data.responses || [] });
    });

    s.on('petitbac:join-response-update', (data: { responses: Array<{ userId: string; accepted: boolean }> }) => {
      setPetitBacJoinPrompt((prev) => (prev ? { ...prev, responses: data.responses } : null));
    });

    s.on('petitbac:join-cancelled', () => setPetitBacJoinPrompt(null));

    s.on('petitbac:play-again-prompt', (data: {
      partyId: string; timeLimit: number; startTime?: number; rounds: number; roundDuration: number;
      categories: string[]; players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
      responses?: Array<{ userId: string; playAgain: boolean }>; playAgainCount?: number; leaveCount?: number;
    }) => {
      const responses = data.responses || [];
      setPetitBacPlayAgainPrompt({
        ...data, startTime: data.startTime ?? Date.now(), responses,
        playAgainCount: data.playAgainCount ?? responses.filter((r) => r.playAgain).length,
        leaveCount: data.leaveCount ?? responses.filter((r) => !r.playAgain).length,
      });
      setPetitBacGame(null);
    });

    s.on('petitbac:play-again-response-update', (data: { responses: Array<{ userId: string; playAgain: boolean }>; playAgainCount: number; leaveCount: number }) => {
      setPetitBacPlayAgainPrompt((prev) => prev ? { ...prev, ...data } : null);
    });

    s.on('petitbac:play-again-cancelled', () => setPetitBacPlayAgainPrompt(null));

    // ── Puissance 4 ─────────────────────────────────────────────────────────
    s.on('p4:join-prompt', (data: P4JoinPrompt) => setP4JoinPrompt({ ...data }));
    s.on('p4:join-response-update', (data: { responses: Array<{ userId: string; accepted: boolean }> }) => {
      setP4JoinPrompt((prev) => (prev ? { ...prev, responses: data.responses } : null));
    });
    s.on('p4:join-cancelled', () => setP4JoinPrompt(null));
    s.on('p4:state', () => { setP4JoinPrompt(null); setP4PlayAgainPrompt(null); });
    s.on('p4:play-again-prompt', (data: { partyId: string; timeLimit: number; startTime?: number; players: Array<{ userId: string; username: string; usernameColor?: string | null }>; responses?: Array<{ userId: string; playAgain: boolean }> }) => {
      setP4PlayAgainPrompt({ partyId: data.partyId, timeLimit: data.timeLimit, startTime: data.startTime ?? Date.now(), players: data.players, responses: data.responses || [] });
    });
    s.on('p4:play-again-response-update', (data: { responses: Array<{ userId: string; playAgain: boolean }> }) => {
      setP4PlayAgainPrompt((prev) => prev ? { ...prev, responses: data.responses } : null);
    });
    s.on('p4:play-again-cancelled', () => setP4PlayAgainPrompt(null));

    // ── Morpion ────────────────────────────────────────────────────────────
    s.on('morpion:join-prompt', (data: MorpionJoinPrompt) => setMorpionJoinPrompt({ ...data }));
    s.on('morpion:join-response-update', (data: { responses: Array<{ userId: string; accepted: boolean }> }) => {
      setMorpionJoinPrompt((prev) => (prev ? { ...prev, responses: data.responses } : null));
    });
    s.on('morpion:join-cancelled', () => setMorpionJoinPrompt(null));
    s.on('morpion:state', () => { setMorpionJoinPrompt(null); setMorpionPlayAgainPrompt(null); });
    s.on('morpion:play-again-prompt', (data: { partyId: string; timeLimit: number; startTime?: number; players: Array<{ userId: string; username: string; usernameColor?: string | null }>; responses?: Array<{ userId: string; playAgain: boolean }> }) => {
      setMorpionPlayAgainPrompt({ partyId: data.partyId, timeLimit: data.timeLimit, startTime: data.startTime ?? Date.now(), players: data.players, responses: data.responses || [] });
    });
    s.on('morpion:play-again-response-update', (data: { responses: Array<{ userId: string; playAgain: boolean }> }) => {
      setMorpionPlayAgainPrompt((prev) => prev ? { ...prev, responses: data.responses } : null);
    });
    s.on('morpion:play-again-cancelled', () => setMorpionPlayAgainPrompt(null));

    // ── Ball Arena ──────────────────────────────────────────────────────────
    s.on('ballarena:state', () => setBallArenaPlayAgainPrompt(null));
    s.on('ballarena:play-again-prompt', (data: { partyId: string; timeLimit: number; startTime?: number; players: Array<{ userId: string; username: string; usernameColor?: string | null }>; responses?: Array<{ userId: string; playAgain: boolean }> }) => {
      setBallArenaPlayAgainPrompt({ partyId: data.partyId, timeLimit: data.timeLimit, startTime: data.startTime ?? Date.now(), players: data.players, responses: data.responses || [] });
    });
    s.on('ballarena:play-again-response-update', (data: { responses: Array<{ userId: string; playAgain: boolean }> }) => {
      setBallArenaPlayAgainPrompt((prev) => prev ? { ...prev, responses: data.responses } : null);
    });
    s.on('ballarena:play-again-cancelled', () => setBallArenaPlayAgainPrompt(null));

    // ── Battleship ──────────────────────────────────────────────────────────
    s.on('battleship:state', () => setBattleshipPlayAgainPrompt(null));
    s.on('battleship:play-again-prompt', (data: { partyId: string; timeLimit: number; startTime?: number; players: Array<{ userId: string; username: string; usernameColor?: string | null }>; responses?: Array<{ userId: string; playAgain: boolean }> }) => {
      setBattleshipPlayAgainPrompt({ partyId: data.partyId, timeLimit: data.timeLimit, startTime: data.startTime ?? Date.now(), players: data.players, responses: data.responses || [] });
    });
    s.on('battleship:play-again-response-update', (data: { responses: Array<{ userId: string; playAgain: boolean }> }) => {
      setBattleshipPlayAgainPrompt((prev) => prev ? { ...prev, responses: data.responses } : null);
    });
    s.on('battleship:play-again-cancelled', () => setBattleshipPlayAgainPrompt(null));

    // ── Chess ───────────────────────────────────────────────────────────────
    s.on('chess:join-prompt', (data: ChessJoinPrompt) => setChessJoinPrompt(data));
    s.on('chess:join-response-update', (data: { responses: Array<{ userId: string; accepted: boolean }> }) => {
      setChessJoinPrompt((prev) => (prev ? { ...prev, responses: data.responses } : null));
    });
    s.on('chess:join-cancelled', () => setChessJoinPrompt(null));
    s.on('chess:state', () => { setChessJoinPrompt(null); setChessPlayAgainPrompt(null); });
    s.on('chess:play-again-prompt', (data: ChessPlayAgainPrompt) => setChessPlayAgainPrompt(data));
    s.on('chess:play-again-response-update', (data: { responses: Array<{ userId: string; playAgain: boolean }> }) => {
      setChessPlayAgainPrompt((prev) => (prev ? { ...prev, responses: data.responses } : null));
    });
    s.on('chess:play-again-cancelled', () => setChessPlayAgainPrompt(null));

    // ── Russian Roulette ────────────────────────────────────────────────────
    s.on('roulette:state', (game: RRGameState) => {
      setRouletteGame(game); setRouletteGameOver(null); setRouletteJoinPrompt(null); setRoulettePlayAgainPrompt(null);
    });
    s.on('roulette:join-prompt', (data: RRJoinPrompt) => {
      setRouletteJoinPrompt({ ...data, startTime: Date.now(), responses: data.responses || [] });
    });
    s.on('roulette:join-response-update', (data: { responses: Array<{ userId: string; accepted: boolean }> }) => {
      setRouletteJoinPrompt((prev) => prev ? { ...prev, responses: data.responses } : null);
    });
    s.on('roulette:join-cancelled', () => setRouletteJoinPrompt(null));
    s.on('roulette:game-over', (data: RRGameOver) => { setRouletteGame(null); setRouletteGameOver(data); });
    s.on('roulette:play-again-prompt', (data: RRPlayAgainPrompt) => {
      const responses = data.responses || [];
      setRoulettePlayAgainPrompt({ ...data, startTime: data.startTime ?? Date.now(), responses, playAgainCount: data.playAgainCount ?? responses.filter((r) => r.playAgain).length });
    });
    s.on('roulette:play-again-response-update', (data: { responses: Array<{ userId: string; playAgain: boolean }>; playAgainCount: number }) => {
      setRoulettePlayAgainPrompt((prev) => prev ? { ...prev, ...data } : null);
    });
    s.on('roulette:play-again-cancelled', () => setRoulettePlayAgainPrompt(null));

    return () => {
      s.off('connect', handleConnect);
      s.off('party:created', clearAllGameState);
      s.off('party:joined', clearAllGameState);
      s.off('party:disbanded', clearAllGameState);
      s.off('party:left', clearAllGameState);
      s.off('party:kicked', clearAllGameState);
      s.off('party:restored', clearAllGameState);
      ['bombparty:started','bombparty:typing','bombparty:word-accepted','bombparty:word-rejected',
       'bombparty:bomb-exploded','bombparty:player-eliminated','bombparty:turn-changed','bombparty:game-over',
       'bombparty:join-prompt','bombparty:join-response-update','bombparty:join-cancelled',
       'bombparty:play-again-prompt','bombparty:play-again-response-update','bombparty:play-again-cancelled',
       'poker:state','poker:join-prompt','poker:join-response-update','poker:join-cancelled',
       'poker:game-over','poker:play-again-prompt','poker:play-again-response-update','poker:play-again-cancelled',
       'petitbac:started','petitbac:round-started','petitbac:player-submitted','petitbac:player-left',
       'petitbac:round-ended','petitbac:game-over','petitbac:join-prompt','petitbac:join-response-update',
       'petitbac:join-cancelled','petitbac:play-again-prompt','petitbac:play-again-response-update','petitbac:play-again-cancelled',
       'p4:join-prompt','p4:join-response-update','p4:join-cancelled','p4:state',
       'p4:play-again-prompt','p4:play-again-response-update','p4:play-again-cancelled',
      'morpion:join-prompt','morpion:join-response-update','morpion:join-cancelled','morpion:state',
      'morpion:play-again-prompt','morpion:play-again-response-update','morpion:play-again-cancelled',
       'ballarena:state','ballarena:play-again-prompt','ballarena:play-again-response-update','ballarena:play-again-cancelled',
       'battleship:state','battleship:play-again-prompt','battleship:play-again-response-update','battleship:play-again-cancelled',
       'chess:join-prompt','chess:join-response-update','chess:join-cancelled','chess:state',
       'chess:play-again-prompt','chess:play-again-response-update','chess:play-again-cancelled',
       'roulette:state','roulette:join-prompt','roulette:join-response-update','roulette:join-cancelled',
       'roulette:game-over','roulette:play-again-prompt','roulette:play-again-response-update','roulette:play-again-cancelled',
      ].forEach((ev) => s.off(ev));
    };
  }, [user?.id, clearAllGameState]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const startBombParty = useCallback((lives: number, difficulty: 'easy' | 'medium' | 'hard') => {
    if (user && currentPartyRef.current) bombPartyEvents.start(user.id, currentPartyRef.current.id, lives, difficulty);
  }, [user?.id]);

  const respondToJoinPrompt = useCallback((accepted: boolean) => {
    if (user && bombPartyJoinPrompt) bombPartyEvents.respondToJoin(bombPartyJoinPrompt.partyId, user.id, accepted);
  }, [user?.id, bombPartyJoinPrompt]);

  const respondToBombPartyPlayAgainPrompt = useCallback((playAgain: boolean) => {
    if (user && bombPartyPlayAgainPrompt) bombPartyEvents.respondToPlayAgain(bombPartyPlayAgainPrompt.partyId, user.id, playAgain);
  }, [user?.id, bombPartyPlayAgainPrompt]);

  const typeBombParty = useCallback((input: string) => {
    if (user && currentPartyRef.current) bombPartyEvents.type(currentPartyRef.current.id, user.id, input);
  }, [user?.id]);

  const submitBombParty = useCallback((word: string) => {
    if (user && currentPartyRef.current) bombPartyEvents.submit(currentPartyRef.current.id, user.id, word);
  }, [user?.id]);

  const leaveBombParty = useCallback(() => {
    if (user && currentPartyRef.current) bombPartyEvents.leave(currentPartyRef.current.id, user.id);
    setBombPartyGame(null);
  }, [user?.id]);

  const clearBombPartyGameOver = useCallback(() => {
    setBombPartyGameOver(null);
    setBombPartyGame(null);
  }, []);

  const startPoker = useCallback((startStack: number, bigBlind: number) => {
    if (user && currentPartyRef.current) pokerEvents.start(user.id, currentPartyRef.current.id, startStack, bigBlind);
  }, [user?.id]);

  const respondToPokerJoinPrompt = useCallback((accepted: boolean) => {
    if (user && pokerJoinPrompt) pokerEvents.respondToJoin(pokerJoinPrompt.partyId, user.id, accepted);
  }, [user?.id, pokerJoinPrompt]);

  const actInPoker = useCallback((action: PokerAction, amount?: number) => {
    if (user && currentPartyRef.current) pokerEvents.action(currentPartyRef.current.id, user.id, action, amount);
  }, [user?.id]);

  const leavePoker = useCallback(() => {
    if (user && currentPartyRef.current) pokerEvents.leave(currentPartyRef.current.id, user.id);
    setPokerGame(null);
  }, [user?.id]);

  const respondToPokerPlayAgainPrompt = useCallback((playAgain: boolean) => {
    if (user && pokerPlayAgainPrompt) pokerEvents.respondToPlayAgain(pokerPlayAgainPrompt.partyId, user.id, playAgain);
  }, [user?.id, pokerPlayAgainPrompt]);

  const clearPokerGameOver = useCallback(() => { setPokerGameOver(null); setPokerGame(null); }, []);

  const startPetitBac = useCallback((rounds: number, roundDuration: number, categories: string[]) => {
    if (user && currentPartyRef.current) petitBacEvents.start(user.id, currentPartyRef.current.id, rounds, roundDuration, categories);
  }, [user?.id]);

  const respondToPetitBacJoinPrompt = useCallback((accepted: boolean) => {
    if (user && petitBacJoinPrompt) petitBacEvents.respondToJoin(petitBacJoinPrompt.partyId, user.id, accepted);
  }, [user?.id, petitBacJoinPrompt]);

  const submitPetitBac = useCallback((answers: Record<string, string>) => {
    if (user && currentPartyRef.current) petitBacEvents.submit(currentPartyRef.current.id, user.id, answers);
  }, [user?.id]);

  const leavePetitBac = useCallback(() => {
    if (user && currentPartyRef.current) petitBacEvents.leave(currentPartyRef.current.id, user.id);
    setPetitBacGame(null);
  }, [user?.id]);

  const respondToPetitBacPlayAgainPrompt = useCallback((playAgain: boolean) => {
    if (user && petitBacPlayAgainPrompt) petitBacEvents.respondToPlayAgain(petitBacPlayAgainPrompt.partyId, user.id, playAgain);
  }, [user?.id, petitBacPlayAgainPrompt]);

  const clearPetitBacGameOver = useCallback(() => setPetitBacGameOver(null), []);

  const startP4 = useCallback(() => {
    if (currentPartyRef.current) getSocket()?.emit('p4:start', { partyId: currentPartyRef.current.id });
  }, []);

  const respondToP4JoinPrompt = useCallback((accepted: boolean) => {
    if (p4JoinPrompt) {
      getSocket()?.emit('p4:join-response', { partyId: p4JoinPrompt.partyId, accepted });
      if (!accepted) setP4JoinPrompt(null);
    }
  }, [p4JoinPrompt]);

  const respondToP4PlayAgainPrompt = useCallback((playAgain: boolean) => {
    if (p4PlayAgainPrompt) getSocket()?.emit('p4:play-again-response', { partyId: p4PlayAgainPrompt.partyId, playAgain });
  }, [p4PlayAgainPrompt]);

  const startMorpion = useCallback(() => {
    if (currentPartyRef.current) getSocket()?.emit('morpion:start', { partyId: currentPartyRef.current.id });
  }, []);

  const respondToMorpionJoinPrompt = useCallback((accepted: boolean) => {
    if (morpionJoinPrompt) {
      getSocket()?.emit('morpion:join-response', { partyId: morpionJoinPrompt.partyId, accepted });
      if (!accepted) setMorpionJoinPrompt(null);
    }
  }, [morpionJoinPrompt]);

  const respondToMorpionPlayAgainPrompt = useCallback((playAgain: boolean) => {
    if (morpionPlayAgainPrompt) getSocket()?.emit('morpion:play-again-response', { partyId: morpionPlayAgainPrompt.partyId, playAgain });
  }, [morpionPlayAgainPrompt]);

  const respondToBallArenaPlayAgainPrompt = useCallback((playAgain: boolean) => {
    if (ballArenaPlayAgainPrompt) getSocket()?.emit('ballarena:play-again-response', { partyId: ballArenaPlayAgainPrompt.partyId, playAgain });
  }, [ballArenaPlayAgainPrompt]);

  const respondToBattleshipPlayAgainPrompt = useCallback((playAgain: boolean) => {
    if (battleshipPlayAgainPrompt && user) getSocket()?.emit('battleship:play-again-response', { userId: user.id, partyId: battleshipPlayAgainPrompt.partyId, playAgain });
  }, [battleshipPlayAgainPrompt, user?.id]);

  const respondToChessJoinPrompt = useCallback((accepted: boolean) => {
    if (chessJoinPrompt) {
      getSocket()?.emit('chess:join-response', { partyId: chessJoinPrompt.partyId, accepted });
      if (!accepted) setChessJoinPrompt(null);
    }
  }, [chessJoinPrompt]);

  const respondToChessPlayAgainPrompt = useCallback((playAgain: boolean) => {
    if (chessPlayAgainPrompt) getSocket()?.emit('chess:play-again-response', { partyId: chessPlayAgainPrompt.partyId, playAgain });
  }, [chessPlayAgainPrompt]);

  const startRoulette = useCallback(() => {
    if (currentPartyRef.current) getSocket()?.emit('roulette:start', { partyId: currentPartyRef.current.id });
  }, []);

  const pullRouletteTrigger = useCallback(() => {
    if (currentPartyRef.current) getSocket()?.emit('roulette:pull', { partyId: currentPartyRef.current.id });
  }, []);

  const passRoulette = useCallback(() => {
    if (currentPartyRef.current) getSocket()?.emit('roulette:pass', { partyId: currentPartyRef.current.id });
  }, []);

  const respondToRoulettePlayAgainPrompt = useCallback((playAgain: boolean) => {
    if (roulettePlayAgainPrompt) getSocket()?.emit('roulette:play-again-response', { partyId: roulettePlayAgainPrompt.partyId, playAgain });
  }, [roulettePlayAgainPrompt]);

  const clearRouletteGameOver = useCallback(() => { setRouletteGameOver(null); setRouletteGame(null); }, []);

  // ── Unified prompts (derived) ──────────────────────────────────────────────
  const activeJoinPrompt = useMemo((): ActiveJoinPrompt | null => {
    if (bombPartyJoinPrompt) {
      const diff = bombPartyJoinPrompt.difficulty === 'easy' ? 'Facile' : bombPartyJoinPrompt.difficulty === 'medium' ? 'Moyen' : 'Difficile';
      return { gameType: 'bombparty', title: 'Rejoindre Bomb Party ?', settingsText: `${bombPartyJoinPrompt.lives} vies · Difficulté ${diff}`, navigateTo: '/games/bomb-party', partyId: bombPartyJoinPrompt.partyId, leaderId: bombPartyJoinPrompt.leaderId, members: bombPartyJoinPrompt.members, responses: bombPartyJoinPrompt.responses, timeLimit: bombPartyJoinPrompt.timeLimit, startTime: bombPartyJoinPrompt.startTime };
    }
    if (pokerJoinPrompt) return { gameType: 'poker', title: 'Rejoindre Poker ?', settingsText: `Stack ${pokerJoinPrompt.startStack} · Blindes ${pokerJoinPrompt.bigBlind / 2}/${pokerJoinPrompt.bigBlind}`, navigateTo: '/games/poker', partyId: pokerJoinPrompt.partyId, leaderId: pokerJoinPrompt.leaderId, members: pokerJoinPrompt.members, responses: pokerJoinPrompt.responses, timeLimit: pokerJoinPrompt.timeLimit, startTime: pokerJoinPrompt.startTime };
    if (petitBacJoinPrompt) return { gameType: 'petitbac', title: 'Rejoindre Petit Bac ?', settingsText: `${petitBacJoinPrompt.rounds} manches · ${Math.round(petitBacJoinPrompt.roundDuration / 1000)}s · ${petitBacJoinPrompt.categories.join(' · ')}`, navigateTo: '/games/petit-bac', partyId: petitBacJoinPrompt.partyId, leaderId: petitBacJoinPrompt.leaderId, members: petitBacJoinPrompt.members, responses: petitBacJoinPrompt.responses, timeLimit: petitBacJoinPrompt.timeLimit, startTime: petitBacJoinPrompt.startTime };
    if (p4JoinPrompt) return { gameType: 'p4', title: 'Rejoindre Puissance 4 ?', navigateTo: '/games/puissance-quatre', partyId: p4JoinPrompt.partyId, leaderId: p4JoinPrompt.leaderId, members: p4JoinPrompt.members, responses: p4JoinPrompt.responses, timeLimit: p4JoinPrompt.timeLimit, startTime: p4JoinPrompt.startTime };
    if (morpionJoinPrompt) return { gameType: 'morpion', title: 'Rejoindre Morpion ?', navigateTo: '/games/morpion', partyId: morpionJoinPrompt.partyId, leaderId: morpionJoinPrompt.leaderId, members: morpionJoinPrompt.members, responses: morpionJoinPrompt.responses, timeLimit: morpionJoinPrompt.timeLimit, startTime: morpionJoinPrompt.startTime };
    if (chessJoinPrompt) return { gameType: 'chess', title: 'Rejoindre Échecs ?', navigateTo: '/games/echecs', partyId: chessJoinPrompt.partyId, leaderId: chessJoinPrompt.leaderId, members: chessJoinPrompt.members, responses: chessJoinPrompt.responses, timeLimit: chessJoinPrompt.timeLimit, startTime: chessJoinPrompt.startTime };
    if (rouletteJoinPrompt) return { gameType: 'roulette', title: 'Rejoindre Russian Roulette ?', navigateTo: '/games/russian-roulette', partyId: rouletteJoinPrompt.partyId, leaderId: rouletteJoinPrompt.leaderId, members: rouletteJoinPrompt.members, responses: rouletteJoinPrompt.responses, timeLimit: rouletteJoinPrompt.timeLimit, startTime: rouletteJoinPrompt.startTime };
    return null;
  }, [bombPartyJoinPrompt, pokerJoinPrompt, petitBacJoinPrompt, p4JoinPrompt, morpionJoinPrompt, chessJoinPrompt, rouletteJoinPrompt]);

  const activeReplayPrompt = useMemo((): ActiveReplayPrompt | null => {
    if (bombPartyPlayAgainPrompt) { const diff = bombPartyPlayAgainPrompt.difficulty === 'easy' ? 'Facile' : bombPartyPlayAgainPrompt.difficulty === 'medium' ? 'Moyen' : 'Difficile'; return { gameType: 'bombparty', settingsText: `${bombPartyPlayAgainPrompt.lives} vies · Difficulté ${diff}`, partyId: bombPartyPlayAgainPrompt.partyId, players: bombPartyPlayAgainPrompt.players, responses: bombPartyPlayAgainPrompt.responses, timeLimit: bombPartyPlayAgainPrompt.timeLimit, startTime: bombPartyPlayAgainPrompt.startTime }; }
    if (pokerPlayAgainPrompt) return { gameType: 'poker', settingsText: `Stack ${pokerPlayAgainPrompt.startStack} · Blindes ${pokerPlayAgainPrompt.bigBlind / 2}/${pokerPlayAgainPrompt.bigBlind}`, partyId: pokerPlayAgainPrompt.partyId, players: pokerPlayAgainPrompt.players, responses: pokerPlayAgainPrompt.responses, timeLimit: pokerPlayAgainPrompt.timeLimit, startTime: pokerPlayAgainPrompt.startTime };
    if (petitBacPlayAgainPrompt) return { gameType: 'petitbac', settingsText: `${petitBacPlayAgainPrompt.rounds} manches · ${Math.round(petitBacPlayAgainPrompt.roundDuration / 1000)}s`, partyId: petitBacPlayAgainPrompt.partyId, players: petitBacPlayAgainPrompt.players, responses: petitBacPlayAgainPrompt.responses, timeLimit: petitBacPlayAgainPrompt.timeLimit, startTime: petitBacPlayAgainPrompt.startTime };
    if (p4PlayAgainPrompt) return { gameType: 'p4', settingsText: 'Puissance 4', partyId: p4PlayAgainPrompt.partyId, players: p4PlayAgainPrompt.players, responses: p4PlayAgainPrompt.responses, timeLimit: p4PlayAgainPrompt.timeLimit, startTime: p4PlayAgainPrompt.startTime };
    if (morpionPlayAgainPrompt) return { gameType: 'morpion', settingsText: 'Morpion', partyId: morpionPlayAgainPrompt.partyId, players: morpionPlayAgainPrompt.players, responses: morpionPlayAgainPrompt.responses, timeLimit: morpionPlayAgainPrompt.timeLimit, startTime: morpionPlayAgainPrompt.startTime };
    if (battleshipPlayAgainPrompt) return { gameType: 'battleship', settingsText: 'Bataille Navale', partyId: battleshipPlayAgainPrompt.partyId, players: battleshipPlayAgainPrompt.players, responses: battleshipPlayAgainPrompt.responses, timeLimit: battleshipPlayAgainPrompt.timeLimit, startTime: battleshipPlayAgainPrompt.startTime };
    if (chessPlayAgainPrompt) return { gameType: 'chess', settingsText: 'Échecs', partyId: chessPlayAgainPrompt.partyId, players: chessPlayAgainPrompt.players, responses: chessPlayAgainPrompt.responses, timeLimit: chessPlayAgainPrompt.timeLimit, startTime: chessPlayAgainPrompt.startTime };
    if (roulettePlayAgainPrompt) return { gameType: 'roulette', settingsText: 'Russian Roulette', partyId: roulettePlayAgainPrompt.partyId, players: roulettePlayAgainPrompt.players, responses: roulettePlayAgainPrompt.responses, timeLimit: roulettePlayAgainPrompt.timeLimit, startTime: roulettePlayAgainPrompt.startTime };
    if (ballArenaPlayAgainPrompt) return { gameType: 'ballarena', settingsText: 'Ball Arena', partyId: ballArenaPlayAgainPrompt.partyId, players: ballArenaPlayAgainPrompt.players, responses: ballArenaPlayAgainPrompt.responses, timeLimit: ballArenaPlayAgainPrompt.timeLimit, startTime: ballArenaPlayAgainPrompt.startTime };
    return null;
  }, [bombPartyPlayAgainPrompt, pokerPlayAgainPrompt, petitBacPlayAgainPrompt, p4PlayAgainPrompt, morpionPlayAgainPrompt, battleshipPlayAgainPrompt, chessPlayAgainPrompt, roulettePlayAgainPrompt, ballArenaPlayAgainPrompt]);

  const respondToGameJoinPrompt = useCallback((accepted: boolean) => {
    if (!user) return;
    if (bombPartyJoinPrompt) bombPartyEvents.respondToJoin(bombPartyJoinPrompt.partyId, user.id, accepted);
    else if (pokerJoinPrompt) pokerEvents.respondToJoin(pokerJoinPrompt.partyId, user.id, accepted);
    else if (petitBacJoinPrompt) petitBacEvents.respondToJoin(petitBacJoinPrompt.partyId, user.id, accepted);
    else if (p4JoinPrompt) { getSocket()?.emit('p4:join-response', { partyId: p4JoinPrompt.partyId, accepted }); if (!accepted) setP4JoinPrompt(null); }
    else if (morpionJoinPrompt) { getSocket()?.emit('morpion:join-response', { partyId: morpionJoinPrompt.partyId, accepted }); if (!accepted) setMorpionJoinPrompt(null); }
    else if (chessJoinPrompt) { getSocket()?.emit('chess:join-response', { partyId: chessJoinPrompt.partyId, accepted }); if (!accepted) setChessJoinPrompt(null); }
    else if (rouletteJoinPrompt) { getSocket()?.emit('roulette:join-response', { partyId: rouletteJoinPrompt.partyId, accepted }); if (!accepted) setRouletteJoinPrompt(null); }
  }, [user?.id, bombPartyJoinPrompt, pokerJoinPrompt, petitBacJoinPrompt, p4JoinPrompt, morpionJoinPrompt, chessJoinPrompt, rouletteJoinPrompt]);

  const respondToGameReplayPrompt = useCallback((playAgain: boolean) => {
    if (!user) return;
    if (bombPartyPlayAgainPrompt) bombPartyEvents.respondToPlayAgain(bombPartyPlayAgainPrompt.partyId, user.id, playAgain);
    else if (pokerPlayAgainPrompt) pokerEvents.respondToPlayAgain(pokerPlayAgainPrompt.partyId, user.id, playAgain);
    else if (petitBacPlayAgainPrompt) petitBacEvents.respondToPlayAgain(petitBacPlayAgainPrompt.partyId, user.id, playAgain);
    else if (p4PlayAgainPrompt) getSocket()?.emit('p4:play-again-response', { partyId: p4PlayAgainPrompt.partyId, playAgain });
    else if (morpionPlayAgainPrompt) getSocket()?.emit('morpion:play-again-response', { partyId: morpionPlayAgainPrompt.partyId, playAgain });
    else if (battleshipPlayAgainPrompt) getSocket()?.emit('battleship:play-again-response', { userId: user.id, partyId: battleshipPlayAgainPrompt.partyId, playAgain });
    else if (chessPlayAgainPrompt) getSocket()?.emit('chess:play-again-response', { partyId: chessPlayAgainPrompt.partyId, playAgain });
    else if (roulettePlayAgainPrompt) getSocket()?.emit('roulette:play-again-response', { partyId: roulettePlayAgainPrompt.partyId, playAgain });
    else if (ballArenaPlayAgainPrompt) getSocket()?.emit('ballarena:play-again-response', { partyId: ballArenaPlayAgainPrompt.partyId, playAgain });
  }, [user?.id, bombPartyPlayAgainPrompt, pokerPlayAgainPrompt, petitBacPlayAgainPrompt, p4PlayAgainPrompt, morpionPlayAgainPrompt, battleshipPlayAgainPrompt, chessPlayAgainPrompt, roulettePlayAgainPrompt, ballArenaPlayAgainPrompt]);

  const value = useMemo(() => ({
    bombPartyGame, bombPartyGameOver, bombPartyRejection, bombPartyJoinPrompt, bombPartyPlayAgainPrompt,
    startBombParty, respondToJoinPrompt, respondToBombPartyPlayAgainPrompt, typeBombParty, submitBombParty, leaveBombParty, clearBombPartyGameOver,
    pokerGame, pokerJoinPrompt, pokerPlayAgainPrompt, pokerGameOver,
    startPoker, respondToPokerJoinPrompt, actInPoker, leavePoker, respondToPokerPlayAgainPrompt, clearPokerGameOver,
    petitBacGame, petitBacRoundResult, petitBacGameOver, petitBacJoinPrompt, petitBacPlayAgainPrompt,
    startPetitBac, respondToPetitBacJoinPrompt, submitPetitBac, leavePetitBac, respondToPetitBacPlayAgainPrompt, clearPetitBacGameOver,
    p4JoinPrompt, startP4, respondToP4JoinPrompt, p4PlayAgainPrompt, respondToP4PlayAgainPrompt,
    morpionJoinPrompt, startMorpion, respondToMorpionJoinPrompt, morpionPlayAgainPrompt, respondToMorpionPlayAgainPrompt,
    ballArenaPlayAgainPrompt, respondToBallArenaPlayAgainPrompt,
    battleshipPlayAgainPrompt, respondToBattleshipPlayAgainPrompt,
    chessJoinPrompt, respondToChessJoinPrompt, chessPlayAgainPrompt, respondToChessPlayAgainPrompt,
    rouletteGame, rouletteGameOver, rouletteJoinPrompt, roulettePlayAgainPrompt,
    startRoulette, pullRouletteTrigger, passRoulette, respondToRoulettePlayAgainPrompt, clearRouletteGameOver,
    activeJoinPrompt, activeReplayPrompt, respondToGameJoinPrompt, respondToGameReplayPrompt,
  }), [
    bombPartyGame, bombPartyGameOver, bombPartyRejection, bombPartyJoinPrompt, bombPartyPlayAgainPrompt,
    startBombParty, respondToJoinPrompt, respondToBombPartyPlayAgainPrompt, typeBombParty, submitBombParty, leaveBombParty, clearBombPartyGameOver,
    pokerGame, pokerJoinPrompt, pokerPlayAgainPrompt, pokerGameOver,
    startPoker, respondToPokerJoinPrompt, actInPoker, leavePoker, respondToPokerPlayAgainPrompt, clearPokerGameOver,
    petitBacGame, petitBacRoundResult, petitBacGameOver, petitBacJoinPrompt, petitBacPlayAgainPrompt,
    startPetitBac, respondToPetitBacJoinPrompt, submitPetitBac, leavePetitBac, respondToPetitBacPlayAgainPrompt, clearPetitBacGameOver,
    p4JoinPrompt, startP4, respondToP4JoinPrompt, p4PlayAgainPrompt, respondToP4PlayAgainPrompt,
    morpionJoinPrompt, startMorpion, respondToMorpionJoinPrompt, morpionPlayAgainPrompt, respondToMorpionPlayAgainPrompt,
    ballArenaPlayAgainPrompt, respondToBallArenaPlayAgainPrompt,
    battleshipPlayAgainPrompt, respondToBattleshipPlayAgainPrompt,
    chessJoinPrompt, respondToChessJoinPrompt, chessPlayAgainPrompt, respondToChessPlayAgainPrompt,
    rouletteGame, rouletteGameOver, rouletteJoinPrompt, roulettePlayAgainPrompt,
    startRoulette, pullRouletteTrigger, passRoulette, respondToRoulettePlayAgainPrompt, clearRouletteGameOver,
    activeJoinPrompt, activeReplayPrompt, respondToGameJoinPrompt, respondToGameReplayPrompt,
  ]);

  return <GameSocketContext.Provider value={value}>{children}</GameSocketContext.Provider>;
}

export function useGameSocket() {
  const ctx = useContext(GameSocketContext);
  if (!ctx) throw new Error('useGameSocket must be used within GameSocketProvider');
  return ctx;
}
