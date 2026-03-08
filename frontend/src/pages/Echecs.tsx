import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Crown, LogOut, Play, Search, Swords, Trophy } from 'lucide-react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';

type ChessColor = 'w' | 'b';
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
type PromotionPiece = 'q' | 'r' | 'b' | 'n';
type ChessResult =
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'insufficient_material'
  | 'threefold_repetition'
  | 'resignation';

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
  legalMoves: Record<string, string[]>;
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
};

const PROMO_MAP: Record<string, PromotionPiece> = {
  wQ: 'q', bQ: 'q', wR: 'r', bR: 'r', wB: 'b', bB: 'b', wN: 'n', bN: 'n',
};

export default function Echecs() {
  const { user, refreshUser } = useAuth();
  const { currentParty, partyMembers, socket, onlineUsers, requestOnlineUsers, challengeUserToDuel, outgoingDuelChallenge } = useSocket();

  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [challengeSearch, setChallengeSearch] = useState('');

  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(480);
  const [gameState, setGameState] = useState<ChessState | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const myPlayer = gameState?.players.find((p) => p.userId === user?.id) ?? null;
  const opponent = gameState?.players.find((p) => p.userId !== user?.id) ?? null;
  const isMyTurn = gameState?.phase === 'playing' && gameState.turn === myPlayer?.color;

  // chess.js instance for piece queries (memoized from FEN)
  const chess = useMemo(() => {
    if (!gameState?.fen) return null;
    try { return new Chess(gameState.fen); } catch { return null; }
  }, [gameState?.fen]);

  // Responsive board: fill container width up to viewport height
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
  }, [gameState != null]); // re-attach when game starts (layout changes)

  // Socket events
  useEffect(() => {
    if (!socket || !user) return;
    socket.emit('chess:register');

    const onState = (state: ChessState) => {
      setGameState(state);
      setSelectedSquare(null);
      setPendingPromotion(null);
      setError(null);
    };
    const onGameOver = (data: GameOverData) => { setGameOver(data); refreshUser(); };
    const onLeft = () => { setGameState(null); setSelectedSquare(null); setPendingPromotion(null); };
    const onError = (data: { message: string }) => { setError(data.message); setPendingPromotion(null); };

    socket.on('chess:state', onState);
    socket.on('chess:game-over', onGameOver);
    socket.on('chess:left', onLeft);
    socket.on('chess:error', onError);
    return () => {
      socket.off('chess:state', onState);
      socket.off('chess:game-over', onGameOver);
      socket.off('chess:left', onLeft);
      socket.off('chess:error', onError);
    };
  }, [socket, user, refreshUser]);

  const sendMove = useCallback((from: string, to: string, promotion?: PromotionPiece) => {
    if (!socket || !currentParty) return;
    socket.emit('chess:move', { partyId: currentParty.id, from, to, promotion });
    setSelectedSquare(null);
  }, [socket, currentParty]);

  // Drag & drop handler
  const onPieceDrop = useCallback((source: string, target: string, piece: string): boolean => {
    if (!gameState || !myPlayer || !isMyTurn) return false;
    if (!gameState.legalMoves[source]?.includes(target)) return false;
    // Promotion: show dialog, snap back piece until chosen
    const isPromo = (piece === 'wP' && target[1] === '8') || (piece === 'bP' && target[1] === '1');
    if (isPromo) {
      setPendingPromotion({ from: source, to: target });
      return false;
    }
    sendMove(source, target);
    return true;
  }, [gameState, myPlayer, isMyTurn, sendMove]);

  // Click-to-move handler
  const onSquareClick = useCallback((square: string) => {
    if (!gameState || !myPlayer || !isMyTurn) return;

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
  }, [gameState, myPlayer, isMyTurn, selectedSquare, chess, sendMove]);

  // Promotion piece selected from built-in dialog
  const onPromotionPieceSelect = useCallback((piece?: string): boolean => {
    if (!pendingPromotion || !piece) return false;
    sendMove(pendingPromotion.from, pendingPromotion.to, PROMO_MAP[piece] ?? 'q');
    setPendingPromotion(null);
    return true;
  }, [pendingPromotion, sendMove]);

  // Square highlight styles
  const customSquareStyles = useMemo((): Record<string, Record<string, string | number>> => {
    const styles: Record<string, Record<string, string | number>> = {};

    if (gameState?.lastMove) {
      styles[gameState.lastMove.from] = { backgroundColor: 'rgba(155, 199, 0, 0.41)' };
      styles[gameState.lastMove.to] = { backgroundColor: 'rgba(155, 199, 0, 0.41)' };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: 'rgba(20, 85, 255, 0.35)' };
      for (const sq of (gameState?.legalMoves[selectedSquare] ?? [])) {
        const hasPiece = !!chess?.get(sq as Square);
        styles[sq] = hasPiece
          ? { boxShadow: 'inset 0 0 0 4px rgba(20, 85, 255, 0.5)' }
          : { background: 'radial-gradient(circle, rgba(0,0,0,0.22) 36%, transparent 36%)' };
      }
    }

    if (gameState?.inCheck && gameState.phase === 'playing' && chess) {
      // Highlight king in check
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      for (let rank = 1; rank <= 8; rank++) {
        for (const file of files) {
          const sq = `${file}${rank}` as Square;
          const p = chess.get(sq);
          if (p?.type === 'k' && p.color === gameState.turn) {
            styles[sq] = { backgroundColor: 'rgba(220, 38, 38, 0.55)' };
          }
        }
      }
    }

    return styles;
  }, [selectedSquare, gameState, chess]);

  const handleStart = () => {
    if (!socket || !currentParty) return;
    socket.emit('chess:start', { partyId: currentParty.id });
  };

  const handleResign = () => {
    if (!socket || !currentParty || !gameState || gameState.phase !== 'playing') return;
    socket.emit('chess:resign', { partyId: currentParty.id });
  };

  const statusText = (() => {
    if (!gameState) return null;
    if (gameState.phase === 'finished' && gameState.result) return RESULT_LABELS[gameState.result];
    if (isMyTurn && gameState.inCheck) return 'À toi — tu es en échec !';
    if (isMyTurn) return 'À toi de jouer.';
    if (gameState.inCheck) return `${opponent?.username ?? "L'adversaire"} est en échec.`;
    return `Tour des ${gameState.turn === 'w' ? 'blancs' : 'noirs'}.`;
  })();

  // ── No party ──────────────────────────────────────────────────────────────
  if (!currentParty) {
    const challengeableUsers = onlineUsers.filter(
      (u) => u.userId !== user?.id && u.username.toLowerCase().includes(challengeSearch.toLowerCase())
    );

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
              <Button onClick={() => { setChallengeSearch(''); requestOnlineUsers(); setShowChallengePicker(true); }}>
                <Swords className="h-4 w-4 mr-2" />
                Défier un joueur
              </Button>
              <Button asChild variant="outline">
                <Link to="/party">Via une party</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showChallengePicker} onOpenChange={setShowChallengePicker}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-normal flex items-center gap-2">
                <Swords className="h-4 w-4" />
                Défier en Échecs
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un joueur..."
                  value={challengeSearch}
                  onChange={(e) => setChallengeSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {challengeableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {onlineUsers.filter((u) => u.userId !== user?.id).length === 0
                      ? 'Aucun joueur en ligne'
                      : 'Aucun résultat'}
                  </p>
                ) : (
                  challengeableUsers.map((u) => {
                    const isPending = outgoingDuelChallenge?.targetId === u.userId && outgoingDuelChallenge.gameType === 'chess';
                    return (
                      <div
                        key={u.userId}
                        className="flex items-center justify-between py-2 px-3 rounded-md border border-border/40 hover:border-border/80 transition-colors"
                      >
                        <UsernameDisplay username={u.username} usernameColor={u.usernameColor} className="text-sm" />
                        <Button
                          size="sm"
                          variant={isPending ? 'outline' : 'default'}
                          disabled={isPending}
                          onClick={() => {
                            challengeUserToDuel(u.userId, u.username, 'chess');
                            setShowChallengePicker(false);
                          }}
                        >
                          {isPending ? 'Envoyé...' : 'Défier'}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-sm text-muted-foreground">
              Joueurs dans le duel ({partyMembers.length}/2)
            </h2>
            <div className="space-y-0">
              {partyMembers.map((member) => (
                <div
                  key={member.userId}
                  className={cn(
                    'flex items-center justify-between border-b border-border/30 py-4 last:border-0',
                    member.userId === user?.id && 'bg-muted/30 -mx-4 px-4'
                  )}
                >
                  <span className="font-medium">
                    <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                    {member.isLeader && <span className="ml-2 text-xs text-muted-foreground">leader</span>}
                    {member.userId === user?.id && <span className="ml-2 text-xs text-muted-foreground">(toi)</span>}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {partyMembers.length < 2 && (
          <p className="text-center text-sm text-muted-foreground">Il faut 2 joueurs pour commencer</p>
        )}
        {isLeader && partyMembers.length === 2 && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={handleStart}
              className="flex items-center gap-3 border border-foreground px-8 py-4 text-lg text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              <Play className="h-5 w-5" />
              Lancer la partie
            </Button>
          </div>
        )}
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </PageShell>
    );
  }

  // ── Active game ───────────────────────────────────────────────────────────
  return (
    <PageShell size="wide">
      <div className="flex flex-col gap-4">
        {/* Compact toolbar — no title, just action buttons + status */}
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
          {statusText && (
            <span className="text-sm text-muted-foreground ml-1">{statusText}</span>
          )}
        </div>

        {/* Board + sidebar */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          {/* Board container: fills available width, capped by viewport height */}
          <div ref={boardContainerRef} className="w-full flex justify-center lg:justify-start">
            <Chessboard
              boardWidth={boardWidth}
              position={gameState.fen}
              boardOrientation={myPlayer?.color === 'b' ? 'black' : 'white'}
              onPieceDrop={onPieceDrop as any}
              onSquareClick={onSquareClick as any}
              customSquareStyles={customSquareStyles as any}
              isDraggablePiece={({ piece }: { piece: string }) => {
                if (!isMyTurn || !myPlayer) return false;
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

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                {gameState.players.map((player) => {
                  const isCurrent = gameState.turn === player.color && gameState.phase === 'playing';
                  return (
                    <div
                      key={player.userId}
                      className={cn(
                        'rounded-lg border p-3 transition-colors',
                        isCurrent ? 'border-foreground bg-muted/40' : 'border-border/40'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium flex items-center gap-1 flex-wrap">
                            <UsernameDisplay username={player.username} usernameColor={player.usernameColor} />
                            {player.userId === user?.id && (
                              <span className="text-xs text-muted-foreground">(toi)</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {player.color === 'w' ? 'Blancs' : 'Noirs'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                          {player.color === 'w' ? <Crown className="h-4 w-4" /> : <Swords className="h-4 w-4" />}
                          <span>{isCurrent ? 'Au tour' : 'En attente'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h2 className="text-sm text-muted-foreground">Dernier coup</h2>
                {gameState.lastMove ? (
                  <div className="space-y-0.5">
                    <p className="text-lg font-medium">{gameState.lastMove.san}</p>
                    <p className="text-xs text-muted-foreground">
                      {gameState.lastMove.from} → {gameState.lastMove.to}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Partie non commencée.</p>
                )}
                {myPlayer && (
                  <div className="rounded-lg border border-border/40 px-3 py-2 text-sm text-muted-foreground">
                    Tu joues les {myPlayer.color === 'w' ? 'blancs' : 'noirs'}.
                    {gameState.inCheck && gameState.phase === 'playing' && ' Un roi est en échec.'}
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
