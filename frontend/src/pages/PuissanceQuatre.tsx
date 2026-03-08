import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ArrowLeft, Play, LogOut, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';

// ─── Constants ─────────────────────────────────────────────────────────────
const ROWS = 6;
const COLS = 7;
const CELL_SIZE = 72;
const CELL_GAP = 8;
const BOARD_WIDTH = COLS * CELL_SIZE + (COLS + 1) * CELL_GAP;
const BOARD_HEIGHT = ROWS * CELL_SIZE + (ROWS + 1) * CELL_GAP;

// ─── Types ──────────────────────────────────────────────────────────────────
type Cell = 0 | 1 | 2;

interface P4PlayerInfo {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: 0 | 1;
}

interface P4State {
  partyId: string;
  board: Cell[][];
  currentPlayerId: string;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  winCells: [number, number][] | null;
  lastMove: { col: number; row: number; playerId: string } | null;
  players: P4PlayerInfo[];
}

interface GameOverData {
  winnerId: string | null;
  winnerUsername: string | null;
  isDraw: boolean;
  rewards: {
    winner?: { aura: number; money: number };
    loser?: { aura: number; money: number };
    draw?: { aura: number; money: number };
  };
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function PuissanceQuatre() {
  const { user, refreshUser } = useAuth();
  const { currentParty, partyMembers, socket } = useSocket();

  const [gameState, setGameState] = useState<P4State | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [droppingCell, setDroppingCell] = useState<{ row: number; col: number; playerIndex: 0 | 1 } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastMoveKeyRef = useRef<string>('');
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const myInfo = gameState?.players.find((p) => p.userId === user?.id);
  const opponent = gameState?.players.find((p) => p.userId !== user?.id);
  const isMyTurn = gameState?.currentPlayerId === user?.id && gameState?.phase === 'playing';

  // Animate last move
  useEffect(() => {
    if (!gameState?.lastMove) return;
    const lm = gameState.lastMove;
    const key = `${lm.row}-${lm.col}-${lm.playerId}`;
    if (key === lastMoveKeyRef.current) return;
    lastMoveKeyRef.current = key;

    const player = gameState.players.find((p) => p.userId === lm.playerId);
    if (!player) return;

    setDroppingCell({ row: lm.row, col: lm.col, playerIndex: player.playerIndex });
    if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
    dropTimerRef.current = setTimeout(() => setDroppingCell(null), 500);
  }, [gameState]);

  useEffect(() => () => { if (dropTimerRef.current) clearTimeout(dropTimerRef.current); }, []);

  // Socket events
  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('p4:register');

    const onState = (state: P4State) => {
      setGameState(state);
      setError(null);
    };

    const onGameOver = (data: GameOverData) => {
      setGameOver(data);
      refreshUser();
    };

    const onLeft = () => {
      setGameState(null);
    };

    const onError = (data: { message: string }) => setError(data.message);

    socket.on('p4:state', onState);
    socket.on('p4:game-over', onGameOver);
    socket.on('p4:left', onLeft);
    socket.on('p4:error', onError);

    return () => {
      socket.off('p4:state', onState);
      socket.off('p4:game-over', onGameOver);
      socket.off('p4:left', onLeft);
      socket.off('p4:error', onError);
    };
  }, [socket, user, refreshUser]);

  const handleStart = () => {
    if (!socket || !currentParty) return;
    socket.emit('p4:start', { partyId: currentParty.id });
  };

  const handleDrop = (col: number) => {
    if (!socket || !currentParty || !isMyTurn || droppingCell !== null) return;
    socket.emit('p4:drop', { partyId: currentParty.id, col });
    setHoverCol(null);
  };

  const handleLeave = () => {
    if (!socket || !currentParty) return;
    socket.emit('p4:leave', { partyId: currentParty.id });
    setGameState(null);
  };

  const isWinCell = (row: number, col: number) =>
    gameState?.winCells?.some(([r, c]) => r === row && c === col) ?? false;

  const isDropping = (row: number, col: number) =>
    droppingCell?.row === row && droppingCell?.col === col;

  const getFallStyle = (row: number): React.CSSProperties => ({
    '--fall-from': `-${(row + 1) * (CELL_SIZE + CELL_GAP)}px`,
    '--fall-duration': `${Math.min(0.08 + row * 0.055, 0.42)}s`,
  } as React.CSSProperties);

  const getCellColor = (cell: Cell, row: number, col: number) => {
    if (cell === 0) return null;
    const win = isWinCell(row, col);
    if (cell === 1) return win
      ? 'bg-red-400 animate-win-pulse shadow-[0_0_20px_rgba(239,68,68,0.9),inset_0_-3px_0_rgba(0,0,0,0.15)]'
      : 'bg-red-500 shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]';
    return win
      ? 'bg-yellow-300 animate-win-pulse shadow-[0_0_20px_rgba(250,204,21,0.9),inset_0_-3px_0_rgba(0,0,0,0.15)]'
      : 'bg-yellow-400 shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]';
  };

  const getDropColor = (playerIndex: 0 | 1) =>
    playerIndex === 0
      ? 'bg-red-500 shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]'
      : 'bg-yellow-400 shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]';

  // ── Not in a party ──────────────────────────────────────────────────────
  if (!currentParty) {
    return (
      <PageShell>
        <PageHeader
          title="Puissance 4"
          description="Aligne 4 jetons avant ton adversaire."
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
          <CardContent className="py-14 text-center space-y-6">
            <p className="text-sm text-muted-foreground">
              Rejoins ou crée un duel pour jouer au Puissance 4
            </p>
            <Button asChild>
              <Link to="/party">Aller aux duels</Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── Lobby ───────────────────────────────────────────────────────────────
  if (!gameState) {
    return (
      <PageShell>
        <PageHeader
          title="Puissance 4"
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
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm text-muted-foreground">
              Joueurs dans le duel ({partyMembers.length}/2)
            </h2>
            <div className="space-y-0">
              {partyMembers.map((member) => (
                <div
                  key={member.userId}
                  className={cn(
                    'flex items-center justify-between py-4 border-b border-border/30 last:border-0',
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
          <p className="text-center text-muted-foreground text-sm">
            Il faut 2 joueurs pour commencer
          </p>
        )}

        {isLeader && partyMembers.length === 2 && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={handleStart}
              className="flex items-center gap-3 px-8 py-4 text-lg border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              <Play className="h-5 w-5" />
              Lancer la partie
            </Button>
          </div>
        )}

        {!isLeader && partyMembers.length === 2 && (
          <div className="text-center text-muted-foreground py-8">
            En attente que le leader lance la partie...
          </div>
        )}

        {/* Game-over modal */}
        <PostGameModals
          gameOver={gameOver}
          setGameOver={setGameOver}
          gameState={gameState}
        />
      </PageShell>
    );
  }

  // ── Game active ─────────────────────────────────────────────────────────
  return (
    <PageShell>
      <style>{`
        @keyframes piece-fall {
          0%   { transform: translateY(var(--fall-from)); opacity: 0.8; }
          80%  { transform: translateY(4px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes win-pulse {
          0%, 100% { transform: scale(1);    filter: brightness(1); }
          50%       { transform: scale(1.12); filter: brightness(1.3); }
        }
        @keyframes hover-drop {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 0.7; transform: translateY(0); }
        }
        .animate-piece-fall {
          animation: piece-fall var(--fall-duration, 0.35s) cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .animate-win-pulse {
          animation: win-pulse 0.65s ease-in-out infinite;
        }
        .animate-hover-drop {
          animation: hover-drop 0.12s ease-out forwards;
        }
      `}</style>

      <PageHeader
        title="Puissance 4"
        description={`Duel : ${currentParty.name || 'Sans nom'}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLeave}>
              <LogOut className="h-4 w-4 mr-2" />
              Quitter
            </Button>
          </>
        }
      />

      {error && (
        <p className="text-center text-sm text-red-500 animate-pulse">{error}</p>
      )}

      {/* Players header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-center gap-6 flex-wrap">
            {gameState.players.map((player) => {
              const isMe = player.userId === user?.id;
              const isCurrentTurn = gameState.currentPlayerId === player.userId && gameState.phase === 'playing';
              const color = player.playerIndex === 0 ? 'bg-red-500' : 'bg-yellow-400';
              return (
                <div
                  key={player.userId}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-2 border rounded-lg transition-colors',
                    isCurrentTurn ? 'border-foreground/60 bg-muted/40' : 'border-border/30'
                  )}
                >
                  <div className={cn('w-3 h-3 rounded-full shrink-0', color)} />
                  <span className="text-sm font-medium">
                    <UsernameDisplay username={player.username} usernameColor={player.usernameColor} />
                    {isMe && <span className="ml-1 text-xs text-muted-foreground">(toi)</span>}
                  </span>
                  {isCurrentTurn && (
                    <span className="text-xs text-muted-foreground">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Turn indicator */}
      <p className="text-center text-sm text-muted-foreground">
        {gameState.phase === 'finished'
          ? gameState.winnerId
            ? gameState.winnerId === user?.id ? 'Tu as gagné !' : `${opponent?.username} a gagné.`
            : 'Égalité !'
          : isMyTurn
          ? 'C\'est ton tour — clique sur une colonne'
          : `Au tour de ${opponent?.username ?? '...'}`}
      </p>

      {/* Board */}
      <div className="flex flex-col items-center gap-1.5">
        {/* Column hover indicators */}
        <div className="flex" style={{ gap: CELL_GAP, paddingLeft: CELL_GAP, paddingRight: CELL_GAP }}>
          {Array.from({ length: COLS }, (_, col) => (
            <div key={col} style={{ width: CELL_SIZE, height: 22 }} className="flex items-center justify-center">
              {hoverCol === col && isMyTurn && droppingCell === null && myInfo && (
                <div
                  className={cn(
                    'w-5 h-5 rounded-full animate-hover-drop',
                    myInfo.playerIndex === 0 ? 'bg-red-500' : 'bg-yellow-400'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Board */}
        <div
          className="relative rounded-2xl bg-accent shadow-xl"
          style={{
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            padding: CELL_GAP,
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${CELL_SIZE}px)`,
            gap: CELL_GAP,
            overflow: 'visible',
          }}
          onMouseLeave={() => setHoverCol(null)}
        >
          {Array.from({ length: ROWS }, (_, row) =>
            Array.from({ length: COLS }, (_, col) => {
              const cell = (gameState.board[row]?.[col] ?? 0) as Cell;
              const droppingHere = isDropping(row, col);
              const displayCell: Cell = droppingHere ? 0 : cell;
              const winHere = isWinCell(row, col) && !droppingHere;
              const colorClass = getCellColor(displayCell, row, col);
              const canClick = isMyTurn && droppingCell === null && gameState.board[0]?.[col] === 0;

              return (
                <div
                  key={`${row}-${col}`}
                  className={cn(
                    'rounded-full transition-colors duration-100',
                    displayCell === 0 && 'bg-foreground/10',
                    colorClass,
                    !winHere && displayCell === 0 && canClick && hoverCol === col && myInfo?.playerIndex === 0 && 'bg-red-500/25',
                    !winHere && displayCell === 0 && canClick && hoverCol === col && myInfo?.playerIndex === 1 && 'bg-yellow-400/25',
                    canClick ? 'cursor-pointer' : 'cursor-default',
                  )}
                  onClick={() => canClick && handleDrop(col)}
                  onMouseEnter={() => { if (canClick) setHoverCol(col); }}
                />
              );
            })
          )}

          {/* Dropping piece overlay */}
          {droppingCell && (
            <div
              className={cn(
                'absolute rounded-full pointer-events-none animate-piece-fall',
                getDropColor(droppingCell.playerIndex)
              )}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                left: CELL_GAP + droppingCell.col * (CELL_SIZE + CELL_GAP),
                top: CELL_GAP + droppingCell.row * (CELL_SIZE + CELL_GAP),
                zIndex: 20,
                ...getFallStyle(droppingCell.row),
              }}
            />
          )}
        </div>
      </div>

      {/* Post-game modals */}
      <PostGameModals
        gameOver={gameOver}
        setGameOver={setGameOver}
        gameState={gameState}
      />
    </PageShell>
  );
}

// ─── Post-game modals ───────────────────────────────────────────────────────
function PostGameModals({
  gameOver,
  setGameOver,
  gameState,
}: {
  gameOver: GameOverData | null;
  setGameOver: (v: GameOverData | null) => void;
  gameState: P4State | null;
}) {
  return (
    <>
      {/* Game over */}
      <Dialog open={!!gameOver} onOpenChange={() => setGameOver(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Partie terminée
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {gameOver?.isDraw ? (
              <div className="text-center">
                <p className="text-2xl font-light">Égalité !</p>
                {gameOver.rewards.draw && (
                  <p className="text-sm text-muted-foreground mt-2">
                    +{gameOver.rewards.draw.aura} aura · +{gameOver.rewards.draw.money}$
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Gagnant</p>
                  {gameOver?.winnerUsername && (
                    <UsernameDisplay
                      username={gameOver.winnerUsername}
                      className="justify-center text-2xl font-light"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  {/* Winner row */}
                  <div className="flex items-center justify-between py-3 px-3 border rounded border-yellow-500/50 bg-yellow-500/5">
                    {gameOver?.winnerUsername && (
                      <UsernameDisplay username={gameOver.winnerUsername} className="font-medium" />
                    )}
                    <div className="text-sm">
                      {gameOver?.rewards.winner && (
                        <>
                          <span className="text-purple-400">+{gameOver.rewards.winner.aura} aura </span>
                          <span className="text-green-400">+{gameOver.rewards.winner.money}$</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Loser row */}
                  {(() => {
                    const loser = gameState?.players.find((p) => p.userId !== gameOver?.winnerId);
                    return loser ? (
                      <div className="flex items-center justify-between py-3 px-3 border rounded border-border/30">
                        <UsernameDisplay username={loser.username} usernameColor={loser.usernameColor} className="font-medium" />
                        <div className="text-sm">
                          {gameOver?.rewards.loser && (
                            <span className="text-green-400">+{gameOver.rewards.loser.money}$</span>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGameOver(null)} className="w-full border-foreground">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
