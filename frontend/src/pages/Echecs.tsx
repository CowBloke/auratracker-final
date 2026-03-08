import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Crown, LogOut, Play, Swords, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
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

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const PROMOTION_OPTIONS: PromotionPiece[] = ['q', 'r', 'b', 'n'];

const PIECE_ICONS: Record<ChessColor, Record<PieceType, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

const PROMOTION_LABELS: Record<PromotionPiece, string> = {
  q: 'Dame',
  r: 'Tour',
  b: 'Fou',
  n: 'Cavalier',
};

const RESULT_LABELS: Record<ChessResult, string> = {
  checkmate: 'Échec et mat',
  stalemate: 'Pat',
  draw: 'Nulle',
  insufficient_material: 'Nulle par matériel insuffisant',
  threefold_repetition: 'Nulle par répétition',
  resignation: 'Abandon',
};

function getSquare(row: number, col: number) {
  return `${FILES[col]}${8 - row}`;
}

function isPromotionMove(piece: ChessPiece | null, targetSquare: string) {
  if (!piece || piece.type !== 'p') return false;
  const targetRank = Number(targetSquare[1]);
  return (piece.color === 'w' && targetRank === 8) || (piece.color === 'b' && targetRank === 1);
}

export default function Echecs() {
  const { user, refreshUser } = useAuth();
  const { currentParty, partyMembers, socket } = useSocket();

  const [gameState, setGameState] = useState<ChessState | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingPromotionMove, setPendingPromotionMove] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const isLeader = partyMembers.find((member) => member.userId === user?.id)?.isLeader;
  const myPlayer = gameState?.players.find((player) => player.userId === user?.id) ?? null;
  const opponent = gameState?.players.find((player) => player.userId !== user?.id) ?? null;
  const isMyTurn = gameState?.phase === 'playing' && gameState.turn === myPlayer?.color;
  const legalMoves = gameState?.legalMoves ?? {};

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('chess:register');

    const onState = (state: ChessState) => {
      setGameState(state);
      setSelectedSquare((current) => (current && state.legalMoves[current] ? current : null));
      setPendingPromotionMove(null);
      setError(null);
    };

    const onGameOver = (data: GameOverData) => {
      setGameOver(data);
      refreshUser();
    };

    const onLeft = () => {
      setGameState(null);
      setSelectedSquare(null);
      setPendingPromotionMove(null);
    };

    const onError = (data: { message: string }) => {
      setError(data.message);
      setPendingPromotionMove(null);
    };

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

  const boardRows = useMemo(() => {
    if (!gameState?.board) return [];
    const rows = gameState.board.map((row) => [...row]);
    if (myPlayer?.color === 'b') {
      return rows.reverse().map((row) => row.reverse());
    }
    return rows;
  }, [gameState?.board, myPlayer?.color]);

  const availableTargets = selectedSquare ? legalMoves[selectedSquare] ?? [] : [];

  const handleStart = () => {
    if (!socket || !currentParty) return;
    socket.emit('chess:start', { partyId: currentParty.id });
  };

  const sendMove = (from: string, to: string, promotion?: PromotionPiece) => {
    if (!socket || !currentParty) return;
    socket.emit('chess:move', { partyId: currentParty.id, from, to, promotion });
    setSelectedSquare(null);
  };

  const handleSquareClick = (square: string, piece: ChessPiece | null) => {
    if (!gameState || !myPlayer || !isMyTurn) return;

    if (selectedSquare && availableTargets.includes(square)) {
      const fromRow = myPlayer.color === 'b' ? 8 - Number(selectedSquare[1]) : 8 - Number(selectedSquare[1]);
      const fromCol = FILES.indexOf(selectedSquare[0] as (typeof FILES)[number]);
      const sourcePiece = gameState.board[fromRow]?.[fromCol] ?? null;

      if (isPromotionMove(sourcePiece, square)) {
        setPendingPromotionMove({ from: selectedSquare, to: square });
      } else {
        sendMove(selectedSquare, square);
      }
      return;
    }

    if (piece && piece.color === myPlayer.color && legalMoves[square]?.length) {
      setSelectedSquare(square);
      return;
    }

    setSelectedSquare(null);
  };

  const handleResign = () => {
    if (!socket || !currentParty || !gameState || gameState.phase !== 'playing') return;
    socket.emit('chess:resign', { partyId: currentParty.id });
  };

  const closeGameOver = () => {
    setGameOver(null);
  };

  const statusText = (() => {
    if (!gameState) return null;
    if (gameState.phase === 'finished' && gameState.result) {
      return RESULT_LABELS[gameState.result];
    }
    if (isMyTurn && gameState.inCheck) return 'À toi de jouer, tu es en échec.';
    if (isMyTurn) return 'À toi de jouer.';
    if (gameState.inCheck) return `${opponent?.username ?? 'L’adversaire'} est en échec.`;
    return `Tour des ${gameState.turn === 'w' ? 'blancs' : 'noirs'}.`;
  })();

  if (!currentParty) {
    return (
      <PageShell>
        <PageHeader
          title="Échecs"
          description="Duel complet avec toutes les règles standard."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="space-y-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">
              Rejoins ou crée un duel pour jouer aux échecs
            </p>
            <Button asChild>
              <Link to="/party">Aller aux duels</Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!gameState) {
    return (
      <PageShell>
        <PageHeader
          title="Échecs"
          description={`Duel : ${currentParty.name || 'Sans nom'}`}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
          }
        />
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
          <p className="text-center text-sm text-muted-foreground">
            Il faut 2 joueurs pour commencer
          </p>
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

  return (
    <PageShell>
      <PageHeader
        title="Échecs"
        description={statusText ?? 'Duel en cours'}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
            {gameState.phase === 'playing' && (
              <Button variant="outline" size="sm" onClick={handleResign}>
                <LogOut className="mr-2 h-4 w-4" />
                Abandonner
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="grid grid-cols-8 overflow-hidden rounded-xl border border-border/50">
              {boardRows.map((row, visualRow) =>
                row.map((piece, visualCol) => {
                  const rowIndex = myPlayer?.color === 'b' ? 7 - visualRow : visualRow;
                  const colIndex = myPlayer?.color === 'b' ? 7 - visualCol : visualCol;
                  const square = getSquare(rowIndex, colIndex);
                  const isDark = (visualRow + visualCol) % 2 === 1;
                  const isSelected = selectedSquare === square;
                  const isLegalTarget = availableTargets.includes(square);
                  const isLastMove =
                    gameState.lastMove?.from === square || gameState.lastMove?.to === square;

                  return (
                    <button
                      key={square}
                      type="button"
                      onClick={() => handleSquareClick(square, piece)}
                      className={cn(
                        'relative aspect-square min-h-10 transition-colors sm:min-h-14',
                        isDark ? 'bg-amber-900/80 text-amber-50' : 'bg-amber-100 text-slate-900',
                        isSelected && 'ring-4 ring-sky-400/70 ring-inset',
                        isLastMove && 'shadow-[inset_0_0_0_999px_rgba(250,204,21,0.18)]',
                        isMyTurn && 'hover:brightness-105'
                      )}
                    >
                      <span className="pointer-events-none absolute left-1 top-1 text-[10px] opacity-60 sm:text-xs">
                        {square}
                      </span>
                      {isLegalTarget && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="h-3 w-3 rounded-full bg-emerald-400/80 sm:h-4 sm:w-4" />
                        </span>
                      )}
                      {piece && (
                        <span className="pointer-events-none text-3xl sm:text-5xl">
                          {PIECE_ICONS[piece.color][piece.type]}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-5">
              {gameState.players.map((player) => {
                const isCurrent = gameState.turn === player.color && gameState.phase === 'playing';
                return (
                  <div
                    key={player.userId}
                    className={cn(
                      'rounded-lg border p-4',
                      isCurrent ? 'border-foreground bg-muted/40' : 'border-border/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          <UsernameDisplay username={player.username} usernameColor={player.usernameColor} />
                          {player.userId === user?.id && <span className="ml-2 text-xs text-muted-foreground">(toi)</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {player.color === 'w' ? 'Blancs' : 'Noirs'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {player.color === 'w' ? <Crown className="h-4 w-4" /> : <Swords className="h-4 w-4" />}
                        {isCurrent ? 'Au tour' : 'En attente'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="text-sm text-muted-foreground">Dernier coup</h2>
              {gameState.lastMove ? (
                <div className="space-y-1">
                  <p className="text-lg font-medium">{gameState.lastMove.san}</p>
                  <p className="text-xs text-muted-foreground">
                    {gameState.lastMove.from} → {gameState.lastMove.to}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">La partie n’a pas encore commencé.</p>
              )}

              <div className="rounded-lg border border-border/40 p-3 text-sm text-muted-foreground">
                {myPlayer ? `Tu joues les ${myPlayer.color === 'w' ? 'blancs' : 'noirs'}.` : null}
                {gameState.inCheck && gameState.phase === 'playing' ? ' Un roi est en échec.' : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!pendingPromotionMove} onOpenChange={() => setPendingPromotionMove(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choisir la promotion</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {PROMOTION_OPTIONS.map((piece) => (
              <Button
                key={piece}
                variant="outline"
                onClick={() => {
                  if (!pendingPromotionMove) return;
                  sendMove(pendingPromotionMove.from, pendingPromotionMove.to, piece);
                  setPendingPromotionMove(null);
                }}
                className="justify-between"
              >
                <span>{PROMOTION_LABELS[piece]}</span>
                <span className="text-xl">{PIECE_ICONS[myPlayer?.color ?? 'w'][piece]}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!gameOver} onOpenChange={closeGameOver}>
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
                  {gameOver?.winnerUsername ? (
                    <UsernameDisplay username={gameOver.winnerUsername} className="font-medium" />
                  ) : null}
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
            <Button variant="outline" onClick={closeGameOver} className="w-full border-foreground">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
