import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, ChevronLeft, ChevronRight, Eye, EyeOff, LogOut, SkipBack, SkipForward, Swords, Trophy } from 'lucide-react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useAuth } from '../contexts/AuthContext';
import { useSocketBase } from '../contexts/SocketContext';
import { useChatSocket } from '../contexts/ChatSocketContext';
import { usePartySocket } from '../contexts/PartySocketContext';
import { useDuelSocket } from '../contexts/DuelSocketContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';
import { SpectateEffectBar, type SpectateFloatingMessage } from '@/components/spectate/SpectateEffectBar';
import { DuelPlayerSelectionModal } from '@/components/game/DuelPlayerSelectionModal';
import { DuelLobbyPanel } from '@/components/game/DuelLobbyPanel';

type ChessColor = 'w' | 'b';
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
type PromotionPiece = 'q' | 'r' | 'b' | 'n';
type ChessResult =
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'insufficient_material'
  | 'threefold_repetition'
  | 'resignation'
  | 'timeout';

interface ChessPiece {
  type: PieceType;
  color: ChessColor;
}

interface ChessPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  color: ChessColor;
}

interface ChessMoveSummary {
  from: string;
  to: string;
  san: string;
  piece: PieceType;
  color: ChessColor;
  promotion?: string;
  captured?: string;
  ply?: number;
}

interface ChessState {
  partyId: string;
  board: Array<Array<ChessPiece | null>>;
  fen: string;
  turn: ChessColor;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  result: ChessResult | null;
  inCheck: boolean;
  isDraw: boolean;
  lastMove: ChessMoveSummary | null;
  moveHistory: ChessMoveSummary[];
  legalMoves: Record<string, string[]>;
  capturedPieces: { byWhite: string[]; byBlack: string[] };
  timeWhite: number;
  timeBlack: number;
  players: ChessPlayer[];
}

interface GameOverData {
  winnerId: string | null;
  winnerUsername: string | null;
  isDraw: boolean;
  result: ChessResult;
  rewards: {
    winner?: { aura: number; money: number };
    loser?: { aura: number; money: number };
    draw?: { aura: number; money: number };
  };
}

const RESULT_LABELS: Record<ChessResult, string> = {
  checkmate: 'Échec et mat',
  stalemate: 'Pat',
  draw: 'Nulle',
  insufficient_material: 'Nulle par matériel insuffisant',
  threefold_repetition: 'Nulle par répétition',
  resignation: 'Abandon',
  timeout: 'Temps écoulé',
};

const PROMO_MAP: Record<string, PromotionPiece> = {
  wQ: 'q', bQ: 'q', wR: 'r', bR: 'r', wB: 'b', bB: 'b', wN: 'n', bN: 'n',
};

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const SORT_ORDER: Record<string, number> = { q: 0, r: 1, b: 2, n: 3, p: 4 };

// Symbols for pieces captured by white (i.e. black pieces white took)
const BLACK_SYMBOLS: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
// Symbols for pieces captured by black (i.e. white pieces black took)
const WHITE_SYMBOLS: Record<string, string> = { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' };

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function materialAdvantage(mine: string[], theirs: string[]): number {
  const sum = (arr: string[]) => arr.reduce((acc, p) => acc + (PIECE_VALUES[p] ?? 0), 0);
  return sum(mine) - sum(theirs);
}

export default function Echecs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { socket } = useSocketBase();
  const { onlineUsers, requestOnlineUsers } = useChatSocket();
  const { currentParty, partyMembers } = usePartySocket();
  const { challengeUserToDuel, outgoingDuelChallenge, startVsAiDuel } = useDuelSocket();

  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [showAIPicker, setShowAIPicker] = useState(false);

  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(480);
  const [gameState, setGameState] = useState<ChessState | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [spectatingPartyId, setSpectatingPartyId] = useState<string | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [spectateMessages, setSpectateMessages] = useState<SpectateFloatingMessage[]>([]);
  const spectateMessageIdRef = useRef(0);
  const spectatingPartyIdRef = useRef<string | null>(null);

  // Premove state
  const [premove, setPremove] = useState<{ from: string; to: string; promotion?: PromotionPiece } | null>(null);
  const [premoveSource, setPremoveSource] = useState<string | null>(null);
  const premoveRef = useRef<{ from: string; to: string; promotion?: PromotionPiece } | null>(null);
  premoveRef.current = premove;

  // Timer display state
  const [displayTimeWhite, setDisplayTimeWhite] = useState(0);
  const [displayTimeBlack, setDisplayTimeBlack] = useState(0);
  const serverTimeRef = useRef<{ white: number; black: number; receivedAt: number } | null>(null);
  const timeoutSentRef = useRef(false);
  const promotionSentRef = useRef(false);

  const routeSpectatePartyId = ((location.state as { spectatePartyId?: string } | null)?.spectatePartyId) ?? null;
  const isSpectating = spectatingPartyId !== null;
  const isReviewMode = historyIndex !== null;
  const activePartyId = isSpectating ? spectatingPartyId : (currentParty?.id ?? gameState?.partyId ?? null);

  useEffect(() => {
    spectatingPartyIdRef.current = spectatingPartyId;
  }, [spectatingPartyId]);

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const myPlayer = gameState?.players.find((p) => p.userId === user?.id) ?? null;
  const opponent = gameState?.players.find((p) => p.userId !== user?.id) ?? null;
  const isMyTurn = !isSpectating && gameState?.phase === 'playing' && gameState.turn === myPlayer?.color;

  const totalHistoryPlies = gameState?.moveHistory.length ?? 0;
  const currentHistoryPly = historyIndex ?? totalHistoryPlies;

  const replayPositions = useMemo(() => {
    if (!gameState) return [] as string[];
    const engine = new Chess();
    const positions = [engine.fen()];
    for (const move of gameState.moveHistory ?? []) {
      try {
        engine.move({ from: move.from as Square, to: move.to as Square, promotion: (move.promotion as PromotionPiece | undefined) ?? undefined });
      } catch {
        break;
      }
      positions.push(engine.fen());
    }
    return positions;
  }, [gameState]);

  const displayFen = useMemo(() => {
    if (!gameState) return 'start';
    return replayPositions[currentHistoryPly] ?? gameState.fen;
  }, [replayPositions, currentHistoryPly, gameState]);

  const displayLastMove = useMemo(() => {
    if (!gameState || currentHistoryPly === 0) return null;
    return gameState.moveHistory[currentHistoryPly - 1] ?? null;
  }, [gameState, currentHistoryPly]);

  const replayChess = useMemo(() => {
    try {
      return new Chess(displayFen);
    } catch {
      return null;
    }
  }, [displayFen]);

  // chess.js instance for piece queries (memoized from FEN)
  const chess = useMemo(() => {
    if (!gameState?.fen) return null;
    try { return new Chess(gameState.fen); } catch { return null; }
  }, [gameState?.fen]);

  useEffect(() => {
    if (!gameState) {
      setHistoryIndex(null);
      return;
    }
    setHistoryIndex((prev) => {
      if (prev === null) return null;
      const maxPly = gameState.moveHistory.length;
      if (prev >= maxPly) return null;
      return prev;
    });
  }, [gameState]);

  const goToFirstMove = useCallback(() => {
    if (!gameState) return;
    setHistoryIndex(0);
    setSelectedSquare(null);
    setPremove(null);
    setPremoveSource(null);
  }, [gameState]);

  const goToPreviousMove = useCallback(() => {
    if (!gameState || totalHistoryPlies === 0) return;
    setHistoryIndex((prev) => {
      const current = prev ?? totalHistoryPlies;
      return Math.max(0, current - 1);
    });
    setSelectedSquare(null);
    setPremove(null);
    setPremoveSource(null);
  }, [gameState, totalHistoryPlies]);

  const goToNextMove = useCallback(() => {
    if (!gameState || totalHistoryPlies === 0) return;
    setHistoryIndex((prev) => {
      const current = prev ?? totalHistoryPlies;
      const next = Math.min(totalHistoryPlies, current + 1);
      return next === totalHistoryPlies ? null : next;
    });
  }, [gameState, totalHistoryPlies]);

  const goToLivePosition = useCallback(() => {
    setHistoryIndex(null);
  }, []);

  useEffect(() => {
    if (!gameState) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPreviousMove();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNextMove();
      } else if (event.key === 'Home') {
        event.preventDefault();
        goToFirstMove();
      } else if (event.key === 'End') {
        event.preventDefault();
        goToLivePosition();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, goToFirstMove, goToNextMove, goToPreviousMove, goToLivePosition]);

  // Order players: opponent first, me second (opponent at top like a chess board)
  const orderedPlayers = useMemo(() => {
    if (!gameState) return [];
    return [...gameState.players].sort((a, b) => {
      if (a.userId === user?.id) return 1;
      if (b.userId === user?.id) return -1;
      return 0;
    });
  }, [gameState?.players, user?.id]);

  // Responsive board
  useEffect(() => {
    const el = boardContainerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      const h = window.innerHeight - 150;
      setBoardWidth(Math.min(w, h, 720));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, [gameState != null]);

  // Socket events
  useEffect(() => {
    if (!socket || !user) return;
    socket.emit('chess:register');

    const onState = (state: ChessState) => {
      setGameState(state);
      setSpectatingPartyId(null);
      setSelectedSquare(null);
      setPendingPromotion(null);
      setError(null);
      serverTimeRef.current = {
        white: state.timeWhite,
        black: state.timeBlack,
        receivedAt: Date.now(),
      };
      setDisplayTimeWhite(state.timeWhite);
      setDisplayTimeBlack(state.timeBlack);
      if (state.phase === 'playing' && !state.lastMove) {
        // Fresh game — reset timeout flag
        timeoutSentRef.current = false;
      }
    };
    const onGameOver = (data: GameOverData) => { setGameOver(data); refreshUser(); };
    const onLeft = () => {
      setGameState(null);
      setSpectatingPartyId(null);
      setSpectatorCount(0);
      setSelectedSquare(null);
      setPendingPromotion(null);
      setPremove(null);
      setPremoveSource(null);
      timeoutSentRef.current = false;
    };

    const onSpectateJoined = (data: { partyId: string; state: ChessState; spectatorCount: number }) => {
      setSpectatingPartyId(data.partyId);
      setSpectatorCount(data.spectatorCount ?? 0);
      setGameState(data.state);
      setSelectedSquare(null);
      setPendingPromotion(null);
      setPremove(null);
      setPremoveSource(null);
      setError(null);
      navigate(location.pathname, { replace: true, state: null });
    };

    const onSpectateState = (data: { partyId: string; state: ChessState }) => {
      if (!spectatingPartyIdRef.current || data.partyId !== spectatingPartyIdRef.current) return;
      setGameState(data.state);
      setSelectedSquare(null);
      setPendingPromotion(null);
      setError(null);
    };

    const onSpectateStopped = (data: { partyId: string }) => {
      if (!spectatingPartyIdRef.current || data.partyId !== spectatingPartyIdRef.current) return;
      setGameState(null);
      setSpectatingPartyId(null);
      setSpectatorCount(0);
    };

    const onSpectatorCount = (data: { partyId: string; spectatorCount: number }) => {
      if (data.partyId === activePartyId) {
        setSpectatorCount(data.spectatorCount ?? 0);
      }
    };

    const onSpectateError = (data?: { message?: string }) => {
      setError(data?.message ?? 'Impossible de rejoindre le spectate.');
      setGameState(null);
      setSpectatingPartyId(null);
      setSpectatorCount(0);
    };
    const onError = (data: { message: string }) => { setError(data.message); setPendingPromotion(null); };

    socket.on('chess:state', onState);
    socket.on('chess:game-over', onGameOver);
    socket.on('chess:left', onLeft);
    socket.on('chess:error', onError);
    socket.on('chess:spectate-joined', onSpectateJoined);
    socket.on('chess:spectate-state', onSpectateState);
    socket.on('chess:spectate-stopped', onSpectateStopped);
    socket.on('chess:spectator-count', onSpectatorCount);
    socket.on('chess:spectate-error', onSpectateError);
    return () => {
      socket.off('chess:state', onState);
      socket.off('chess:game-over', onGameOver);
      socket.off('chess:left', onLeft);
      socket.off('chess:error', onError);
      socket.off('chess:spectate-joined', onSpectateJoined);
      socket.off('chess:spectate-state', onSpectateState);
      socket.off('chess:spectate-stopped', onSpectateStopped);
      socket.off('chess:spectator-count', onSpectatorCount);
      socket.off('chess:spectate-error', onSpectateError);
    };
  }, [socket, user, refreshUser, navigate, location.pathname, activePartyId]);

  useEffect(() => {
    if (!socket || !user || !routeSpectatePartyId) return;
    socket.emit('chess:spectate-join', { partyId: routeSpectatePartyId });
  }, [socket, user, routeSpectatePartyId]);

  useEffect(() => {
    return () => {
      if (spectatingPartyId) {
        socket?.emit('chess:spectate-leave');
      }
    };
  }, [socket, spectatingPartyId]);

  // Real-time timer countdown
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;
    const interval = setInterval(() => {
      if (!serverTimeRef.current) return;
      const elapsed = Date.now() - serverTimeRef.current.receivedAt;
      const turn = gameState.turn;
      if (turn === 'w') {
        const t = Math.max(0, serverTimeRef.current.white - elapsed);
        setDisplayTimeWhite(t);
        if (t === 0 && myPlayer?.color === 'w' && !timeoutSentRef.current && socket && activePartyId) {
          timeoutSentRef.current = true;
          socket.emit('chess:timeout', { partyId: activePartyId });
        }
      } else {
        const t = Math.max(0, serverTimeRef.current.black - elapsed);
        setDisplayTimeBlack(t);
        if (t === 0 && myPlayer?.color === 'b' && !timeoutSentRef.current && socket && activePartyId) {
          timeoutSentRef.current = true;
          socket.emit('chess:timeout', { partyId: activePartyId });
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [gameState?.turn, gameState?.phase, myPlayer?.color, socket, activePartyId]);

  // Execute premove when it becomes our turn
  const prevIsMyTurnRef = useRef(false);
  useEffect(() => {
    const wasMyTurn = prevIsMyTurnRef.current;
    prevIsMyTurnRef.current = !!isMyTurn;

    if (isMyTurn && !wasMyTurn) {
      const pm = premoveRef.current;
      if (pm && gameState && socket && activePartyId) {
        const legalMoves = gameState.legalMoves[pm.from] ?? [];
        if (legalMoves.includes(pm.to)) {
          socket.emit('chess:move', { partyId: activePartyId, from: pm.from, to: pm.to, promotion: pm.promotion ?? 'q' });
          setSelectedSquare(null);
        }
        setPremove(null);
        setPremoveSource(null);
      }
    }
  }, [isMyTurn, gameState, socket, activePartyId]);

  const sendMove = useCallback((from: string, to: string, promotion?: PromotionPiece) => {
    if (!socket || !activePartyId || isSpectating) return;
    socket.emit('chess:move', { partyId: activePartyId, from, to, promotion });
    setSelectedSquare(null);
  }, [socket, activePartyId, isSpectating]);

  // Drag & drop handler
  const onPieceDrop = useCallback((source: string, target: string, piece: string): boolean => {
    if (!gameState || !myPlayer || isSpectating || isReviewMode) return false;

    // After promotion dialog, library calls back with promoted piece — move already sent
    if (promotionSentRef.current) {
      promotionSentRef.current = false;
      return true;
    }

    if (!isMyTurn) {
      // Set premove via drag
      if (piece[0].toLowerCase() === myPlayer.color) {
        setPremove({ from: source, to: target });
        setPremoveSource(null);
      }
      return false;
    }

    // Clear premove on normal move
    setPremove(null);
    setPremoveSource(null);

    if (!gameState.legalMoves[source]?.includes(target)) return false;
    const isPromo = (piece === 'wP' && target[1] === '8') || (piece === 'bP' && target[1] === '1');
    if (isPromo) {
      setPendingPromotion({ from: source, to: target });
      return false;
    }
    sendMove(source, target);
    return true;
  }, [gameState, myPlayer, isMyTurn, sendMove, isSpectating, isReviewMode]);

  // Click-to-move handler
  const onSquareClick = useCallback((square: string) => {
    if (!gameState || !myPlayer || isSpectating || isReviewMode) return;

    if (!isMyTurn) {
      // Premove selection
      if (premoveSource) {
        if (square === premoveSource) {
          setPremoveSource(null);
        } else {
          const piece = chess?.get(premoveSource as Square);
          if (piece && piece.color === myPlayer.color) {
            const isPromo = piece.type === 'p' &&
              ((piece.color === 'w' && square[1] === '8') || (piece.color === 'b' && square[1] === '1'));
            setPremove({ from: premoveSource, to: square, promotion: isPromo ? 'q' : undefined });
          }
          setPremoveSource(null);
        }
      } else {
        const piece = chess?.get(square as Square);
        if (piece && piece.color === myPlayer.color) {
          setPremoveSource(square);
          setPremove(null);
        }
      }
      return;
    }

    // Clear premove when making a real move
    setPremove(null);
    setPremoveSource(null);

    if (selectedSquare && gameState.legalMoves[selectedSquare]?.includes(square)) {
      const piece = chess?.get(selectedSquare as Square);
      const isPromo = piece?.type === 'p' &&
        ((piece.color === 'w' && square[1] === '8') || (piece.color === 'b' && square[1] === '1'));
      if (isPromo) {
        setPendingPromotion({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        return;
      }
      sendMove(selectedSquare, square);
      setSelectedSquare(null);
      return;
    }

    const piece = chess?.get(square as Square);
    if (piece && piece.color === myPlayer.color && gameState.legalMoves[square]?.length) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  }, [gameState, myPlayer, isMyTurn, selectedSquare, chess, sendMove, premoveSource, isSpectating, isReviewMode]);

  // Promotion piece selected from built-in dialog
  const onPromotionPieceSelect = useCallback((piece?: string, promoteFromSquare?: string, promoteToSquare?: string): boolean => {
    if (!piece) return false;
    const from = pendingPromotion?.from ?? promoteFromSquare;
    const to = pendingPromotion?.to ?? promoteToSquare;
    if (!from || !to) return false;
    promotionSentRef.current = true;
    sendMove(from, to, PROMO_MAP[piece] ?? 'q');
    setPendingPromotion(null);
    return true;
  }, [pendingPromotion, sendMove]);

  // Square highlight styles
  const customSquareStyles = useMemo((): Record<string, Record<string, string | number>> => {
    const styles: Record<string, Record<string, string | number>> = {};

    if (displayLastMove) {
      styles[displayLastMove.from] = { backgroundColor: 'rgba(155, 199, 0, 0.41)' };
      styles[displayLastMove.to] = { backgroundColor: 'rgba(155, 199, 0, 0.41)' };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: 'rgba(20, 85, 255, 0.35)' };
      for (const sq of (gameState?.legalMoves[selectedSquare] ?? [])) {
        const hasPiece = !!replayChess?.get(sq as Square);
        styles[sq] = hasPiece
          ? { boxShadow: 'inset 0 0 0 4px rgba(20, 85, 255, 0.5)' }
          : { background: 'radial-gradient(circle, rgba(0,0,0,0.22) 36%, transparent 36%)' };
      }
    }

    // Premove highlights
    if (premoveSource) {
      styles[premoveSource] = { backgroundColor: 'rgba(0, 180, 200, 0.5)' };
    }
    if (premove) {
      styles[premove.from] = { backgroundColor: 'rgba(0, 180, 200, 0.4)' };
      styles[premove.to] = { backgroundColor: 'rgba(0, 180, 200, 0.4)' };
    }

    if (replayChess?.inCheck()) {
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      for (let rank = 1; rank <= 8; rank++) {
        for (const file of files) {
          const sq = `${file}${rank}` as Square;
          const p = replayChess.get(sq);
          if (p?.type === 'k' && p.color === replayChess.turn()) {
            styles[sq] = { backgroundColor: 'rgba(220, 38, 38, 0.55)' };
          }
        }
      }
    }

    return styles;
  }, [selectedSquare, gameState, replayChess, premove, premoveSource, displayLastMove]);

  const handleStart = () => {
    if (!socket || !currentParty || isSpectating) return;
    socket.emit('chess:start', { partyId: currentParty.id });
  };

  const handleResign = () => {
    if (!socket || !activePartyId || !gameState || gameState.phase !== 'playing' || isSpectating) return;
    socket.emit('chess:resign', { partyId: activePartyId });
  };

  const handleLeaveSpectate = () => {
    socket?.emit('chess:spectate-leave');
    setGameState(null);
    setSpectatingPartyId(null);
    setSpectatorCount(0);
    setSpectateMessages([]);
    setError(null);
  };

  const addSpectateMessage = useCallback((text: string, username: string) => {
    const id = spectateMessageIdRef.current++;
    const duration = 6000 + Math.random() * 3000;
    const msg: SpectateFloatingMessage = {
      id,
      text,
      username,
      y: 5 + Math.random() * 75,
      direction: Math.random() < 0.5 ? 'ltr' : 'rtl',
      duration,
    };
    setSpectateMessages((prev) => [...prev, msg]);
    setTimeout(() => {
      setSpectateMessages((prev) => prev.filter((m) => m.id !== id));
    }, duration + 200);
  }, []);

  const sendSpectateMessage = useCallback((text: string) => {
    if (!socket || !spectatingPartyId) return;
    socket.emit('chess:spectate-message', { partyId: spectatingPartyId, text });
  }, [socket, spectatingPartyId]);

  useEffect(() => {
    if (!socket) return;
    const onEffectMessage = (data: { partyId: string; username: string; text: string }) => {
      // Show for spectators AND for players (backend emits to player sockets too)
      const isInThisGame = spectatingPartyIdRef.current === data.partyId
        || activePartyId === data.partyId;
      if (isInThisGame) addSpectateMessage(data.text, data.username);
    };
    socket.on('chess:spectate-message-broadcast', onEffectMessage);
    return () => { socket.off('chess:spectate-message-broadcast', onEffectMessage); };
  }, [socket, addSpectateMessage, activePartyId]);

  const statusText = (() => {
    if (!gameState) return null;
    if (isReviewMode) {
      return `Navigation coups: ${currentHistoryPly}/${totalHistoryPlies}`;
    }
    if (gameState.phase === 'finished' && gameState.result) return RESULT_LABELS[gameState.result];
    if (isSpectating) return 'Mode spectateur';
    if (isMyTurn && gameState.inCheck) return 'À toi — tu es en échec !';
    if (isMyTurn) return 'À toi de jouer.';
    if (premove) return 'Pré-coup en attente…';
    if (gameState.inCheck) return `${opponent?.username ?? "L'adversaire"} est en échec.`;
    return `Tour des ${gameState.turn === 'w' ? 'blancs' : 'noirs'}.`;
  })();

  // ── No party ──────────────────────────────────────────────────────────────
  if (!currentParty && !isSpectating && !routeSpectatePartyId && !gameState) {
    return (
      <PageShell>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/games" className="inline-flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" />Jeux
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="space-y-4 py-10 px-6 text-center">
            <p className="text-sm text-muted-foreground">Joue aux échecs en 1v1 contre un autre joueur</p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <Button onClick={() => setShowAIPicker(true)}>
                <Bot className="h-4 w-4 mr-2" />
                Jouer contre l'IA
              </Button>
              <Button onClick={() => setShowChallengePicker(true)} variant="outline">
                <Swords className="h-4 w-4 mr-2" />
                Défier un joueur
              </Button>
              <Button asChild variant="outline">
                <Link to="/party">Via un groupe</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showAIPicker} onOpenChange={setShowAIPicker}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-normal flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Jouer contre l'IA
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Choisir la difficulté :</p>
              <div className="flex flex-col gap-2">
                {([['easy', 'Facile'], ['medium', 'Normal'], ['hard', 'Expert']] as const).map(([diff, label]) => (
                  <Button key={diff} variant="outline" onClick={() => { startVsAiDuel('chess', diff); setShowAIPicker(false); }}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <DuelPlayerSelectionModal
          open={showChallengePicker}
          onOpenChange={setShowChallengePicker}
          title="Défier en Échecs"
          gameType="chess"
          onlineUsers={onlineUsers}
          currentUserId={user?.id}
          outgoingDuelChallenge={outgoingDuelChallenge}
          challengeUserToDuel={challengeUserToDuel}
          requestOnlineUsers={requestOnlineUsers}
        />
      </PageShell>
    );
  }

  if ((isSpectating || routeSpectatePartyId) && !gameState) {
    return (
      <PageShell>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/games" className="inline-flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" />Jeux
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleLeaveSpectate}>
            <EyeOff className="h-4 w-4 mr-1" />Quitter spectate
          </Button>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            En attente de l'état de la partie...
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (!gameState) {
    return (
      <PageShell>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/games" className="inline-flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" />Jeux
            </Link>
          </Button>
        </div>
        <DuelLobbyPanel
          members={partyMembers}
          currentUserId={user?.id}
          title={`Joueurs dans le duel (${partyMembers.length}/2)`}
          minimumPlayers={2}
          isLeader={isLeader}
          notEnoughPlayersText="Il faut 2 joueurs pour commencer"
          onStart={handleStart}
        />
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </PageShell>
    );
  }

  // ── Active game ───────────────────────────────────────────────────────────
  return (
    <PageShell size="wide">
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link to="/games" className="inline-flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" />Jeux
            </Link>
          </Button>
          {gameState.phase === 'playing' && (
            <Button variant="outline" size="sm" onClick={handleResign}>
              <LogOut className="h-4 w-4 mr-1" />Abandonner
            </Button>
          )}
          {isSpectating && (
            <Button variant="outline" size="sm" onClick={handleLeaveSpectate}>
              <EyeOff className="h-4 w-4 mr-1" />Quitter spectate
            </Button>
          )}
          {statusText && (
            <span className="text-sm text-muted-foreground ml-1">{statusText}</span>
          )}
          {activePartyId && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />{spectatorCount} spectateur{spectatorCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Board + sidebar */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="relative overflow-hidden" style={{ minHeight: boardWidth }}>
            <div ref={boardContainerRef} className="w-full flex justify-center lg:justify-start">
              <Chessboard
                boardWidth={boardWidth}
                position={displayFen}
                boardOrientation={myPlayer?.color === 'b' ? 'black' : 'white'}
                onPieceDrop={onPieceDrop as any}
                onSquareClick={onSquareClick as any}
                customSquareStyles={customSquareStyles as any}
                isDraggablePiece={({ piece }: { piece: string }) => {
                  if (isSpectating || isReviewMode) return false;
                  if (!myPlayer) return false;
                  return piece[0] === myPlayer.color;
                }}
                animationDuration={180}
                showPromotionDialog={!!pendingPromotion}
                promotionToSquare={(pendingPromotion?.to ?? null) as any}
                onPromotionPieceSelect={onPromotionPieceSelect as any}
                promotionDialogVariant="modal"
                customBoardStyle={{
                  borderRadius: '8px',
                  boxShadow: '0 4px 28px rgba(0,0,0,0.22)',
                }}
                customDarkSquareStyle={{ backgroundColor: '#b58863' }}
                customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
                areArrowsAllowed={false}
              />
            </div>
            {/* Show floating messages for spectators (with input) and players (no input) */}
            {spectateMessages.length > 0 || isSpectating ? (
              <SpectateEffectBar
                messages={spectateMessages}
                onSend={sendSpectateMessage}
                showInput={isSpectating}
              />
            ) : null}
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            {/* Player cards (opponent first, me second) */}
            {orderedPlayers.map((player) => {
              const isCurrent = gameState.turn === player.color && gameState.phase === 'playing';
              const isMe = player.userId === user?.id;
              const timeMs = player.color === 'w' ? displayTimeWhite : displayTimeBlack;
              const timeStr = formatTime(timeMs);
              const lowTime = timeMs < 30000 && gameState.phase === 'playing';
              const captured = player.color === 'w'
                ? gameState.capturedPieces?.byWhite ?? []
                : gameState.capturedPieces?.byBlack ?? [];
              const otherCaptured = player.color === 'w'
                ? gameState.capturedPieces?.byBlack ?? []
                : gameState.capturedPieces?.byWhite ?? [];
              const adv = materialAdvantage(captured, otherCaptured);

              return (
                <div
                  key={player.userId}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    isCurrent ? 'border-foreground bg-muted/40' : 'border-border/40'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium flex items-center gap-1 flex-wrap">
                        <UsernameDisplay username={player.username} usernameColor={player.usernameColor} />
                        {isMe && <span className="text-xs text-muted-foreground">(toi)</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {player.color === 'w' ? 'Blancs' : 'Noirs'}
                      </p>
                      {captured.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {[...captured]
                            .sort((a, b) => (SORT_ORDER[a] ?? 5) - (SORT_ORDER[b] ?? 5))
                            .map((p, i) => (
                              <span key={i} className="text-xs text-muted-foreground">
                                {(player.color === 'w' ? BLACK_SYMBOLS : WHITE_SYMBOLS)[p] ?? p}
                              </span>
                            ))}
                          {adv > 0 && (
                            <span className="text-xs text-muted-foreground ml-0.5">+{adv}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={cn(
                          'text-xl font-mono font-semibold tabular-nums',
                          lowTime ? 'text-red-500' : 'text-foreground'
                        )}
                      >
                        {timeStr}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {isCurrent ? 'Au tour' : 'En attente'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Last move */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <h2 className="text-sm text-muted-foreground">Dernier coup</h2>
                {displayLastMove ? (
                  <div className="space-y-0.5">
                    <p className="text-lg font-medium">{displayLastMove.san}</p>
                    <p className="text-xs text-muted-foreground">
                      {displayLastMove.from} → {displayLastMove.to}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Partie non commencée.</p>
                )}
                <div className="rounded-lg border border-border/40 px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Historique des coups</span>
                    <span>{currentHistoryPly}/{totalHistoryPlies}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={goToFirstMove}
                      disabled={totalHistoryPlies === 0 || currentHistoryPly === 0}
                      title="Premier coup (Home)"
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={goToPreviousMove}
                      disabled={totalHistoryPlies === 0 || currentHistoryPly === 0}
                      title="Coup précédent (←)"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={goToNextMove}
                      disabled={totalHistoryPlies === 0 || currentHistoryPly >= totalHistoryPlies}
                      title="Coup suivant (→)"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={goToLivePosition}
                      disabled={currentHistoryPly >= totalHistoryPlies && !isReviewMode}
                      title="Revenir au direct (End)"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Raccourcis: ← / →, Home, End</p>
                </div>
                {myPlayer && !isSpectating && (
                  <div className="rounded-lg border border-border/40 px-3 py-2 text-sm text-muted-foreground">
                    Tu joues les {myPlayer.color === 'w' ? 'blancs' : 'noirs'}.
                    {gameState.inCheck && gameState.phase === 'playing' && ' Un roi est en échec.'}
                  </div>
                )}
                {isSpectating && (
                  <div className="rounded-lg border border-border/40 px-3 py-2 text-sm text-muted-foreground">
                    Tu regardes cette partie en direct.
                  </div>
                )}
                {premove && (
                  <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-400">
                    Pré-coup : {premove.from} → {premove.to}
                  </div>
                )}
              </CardContent>
            </Card>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
      </div>

      {/* Game over dialog */}
      <Dialog open={!!gameOver} onOpenChange={() => setGameOver(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-normal">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Partie terminée
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{gameOver ? RESULT_LABELS[gameOver.result] : ''}</p>
              {gameOver?.winnerUsername ? (
                <UsernameDisplay username={gameOver.winnerUsername} className="justify-center text-2xl font-light" />
              ) : (
                <p className="text-xl font-light">Match nul</p>
              )}
            </div>
            {gameOver?.isDraw ? (
              <div className="rounded border border-border/40 px-3 py-4 text-center">
                <span className="text-purple-400">+{gameOver.rewards.draw?.aura} aura </span>
                <span className="text-green-400">+{gameOver.rewards.draw?.money}$</span>
                <p className="mt-2 text-xs text-muted-foreground">Récompense pour chaque joueur</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded border border-yellow-500/50 bg-yellow-500/5 px-3 py-3">
                  {gameOver?.winnerUsername && (
                    <UsernameDisplay username={gameOver.winnerUsername} className="font-medium" />
                  )}
                  <div className="text-sm">
                    <span className="text-purple-400">+{gameOver?.rewards.winner?.aura} aura </span>
                    <span className="text-green-400">+{gameOver?.rewards.winner?.money}$</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded border border-border/30 px-3 py-3">
                  {opponent && gameOver?.winnerId === user?.id ? (
                    <UsernameDisplay username={opponent.username} usernameColor={opponent.usernameColor} className="font-medium" />
                  ) : myPlayer ? (
                    <UsernameDisplay username={myPlayer.username} usernameColor={myPlayer.usernameColor} className="font-medium" />
                  ) : null}
                  <div className="text-sm">
                    <span className="text-green-400">+{gameOver?.rewards.loser?.money}$</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGameOver(null)} className="w-full border-foreground">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
