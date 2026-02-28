import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ArrowLeft, Play, LogOut, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BOARD_SIZE = 10;
const SHIPS = [5, 4, 3, 3, 2]; // Ship lengths

interface BattleshipState {
  partyId: string;
  phase: 'placement' | 'playing' | 'finished';
  currentPlayerId: string;
  myBoard: number[][];
  opponentBoard: number[][];
  myShips: Array<{ x: number; y: number; length: number; horizontal: boolean }>;
  myReady: boolean;
  myShipsPlaced: boolean;
  opponentReady: boolean;
  opponentShipsPlaced: boolean;
  winnerId: string | null;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
}

interface BattleshipPlayAgainPrompt {
  partyId: string;
  timeLimit: number;
  startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
  playAgainCount?: number;
  leaveCount?: number;
}

export default function BatailleNavale() {
  const { user, refreshUser } = useAuth();
  const {
    currentParty,
    partyMembers,
    socket,
  } = useSocket();

  const [gameState, setGameState] = useState<BattleshipState | null>(null);
  const [selectedShipLength, setSelectedShipLength] = useState<number | null>(null);
  const [selectedHorizontal, setSelectedHorizontal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState<{
    winnerId: string;
    winnerUsername: string;
    rewards: { winner: { aura: number; money: number }; loser: { aura: number; money: number } };
  } | null>(null);
  const [playAgainPrompt, setPlayAgainPrompt] = useState<BattleshipPlayAgainPrompt | null>(null);
  const [hasQuitPlayAgain, setHasQuitPlayAgain] = useState(false);
  const [playAgainProgress, setPlayAgainProgress] = useState(100);

  const handleCloseGameOver = () => {
    setGameOver(null);
  };

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const isMyTurn = gameState?.currentPlayerId === user?.id;
  const opponent = gameState?.players.find((p) => p.userId !== user?.id);
  const myPlayAgainResponse = playAgainPrompt?.responses.find((r) => r.userId === user?.id);
  const hasQuit = hasQuitPlayAgain || (!!myPlayAgainResponse && !myPlayAgainResponse.playAgain);
  const showPlayAgainPrompt = !!playAgainPrompt && !hasQuit;

  useEffect(() => {
    if (!showPlayAgainPrompt || !playAgainPrompt) {
      setPlayAgainProgress(100);
      return;
    }
    const interval = setInterval(() => {
      const elapsed = Date.now() - playAgainPrompt.startTime;
      setPlayAgainProgress(Math.max(0, 100 - (elapsed / playAgainPrompt.timeLimit) * 100));
    }, 120);
    return () => clearInterval(interval);
  }, [showPlayAgainPrompt, playAgainPrompt]);

  const postGameModals = (
    <>
      {playAgainPrompt && (
        <Dialog open={showPlayAgainPrompt} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Relancer une partie ?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Duel 2 joueurs</p>
              <div className="space-y-2">
                {playAgainPrompt.players.map((player) => {
                  const response = playAgainPrompt.responses.find((r) => r.userId === player.userId);
                  return (
                    <div key={player.userId} className="flex items-center justify-between text-sm">
                      <span style={{ color: player.usernameColor || undefined }}>{player.username}</span>
                      {response ? (
                        <span className={cn('text-xs ', response.playAgain ? 'text-green-500' : 'text-red-500')}>
                          {response.playAgain ? 'OK' : 'Quitte'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">En attente</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="h-1 rounded bg-muted">
                <div className="h-full bg-foreground transition-all" style={{ width: `${playAgainProgress}%` }} />
              </div>
              <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!socket || !user || !currentParty) return;
                    socket.emit('battleship:play-again-response', {
                      userId: user.id,
                      partyId: currentParty.id,
                      playAgain: false,
                    });
                    setHasQuitPlayAgain(true);
                  }}
                >
                  Quitter
                </Button>
                <Button
                  onClick={() => {
                    if (!socket || !user || !currentParty) return;
                    socket.emit('battleship:play-again-response', {
                      userId: user.id,
                      partyId: currentParty.id,
                      playAgain: true,
                    });
                  }}
                >
                  Relancer
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!gameOver} onOpenChange={handleCloseGameOver}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Partie terminee
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Gagnant</p>
              <p className="text-2xl font-light">{gameOver?.winnerUsername}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between py-3 px-3 border rounded border-yellow-500/50 bg-yellow-500/5">
                <span className="font-medium">{gameOver?.winnerUsername}</span>
                <div className="text-sm">
                  <span className="text-purple-400">+{gameOver?.rewards.winner.aura} aura </span>
                  <span className="text-green-400">+{gameOver?.rewards.winner.money}$</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-3 px-3 border rounded border-border/30">
                <span className="font-medium">
                  {gameState?.players.find((p) => p.userId !== gameOver?.winnerId)?.username}
                </span>
                <div className="text-sm">
                  <span className="text-green-400">+{gameOver?.rewards.loser.money}$</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseGameOver}
              className="w-full border-foreground"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // Get remaining ships to place
  const getRemainingShips = () => {
    if (!gameState) return [];
    const placedLengths = gameState.myShips.map((s) => s.length);
    const remaining = [...SHIPS];
    for (const placedLength of placedLengths) {
      const index = remaining.indexOf(placedLength);
      if (index !== -1) {
        remaining.splice(index, 1);
      }
    }
    return remaining;
  };

  const remainingShips = getRemainingShips();

  useEffect(() => {
    if (!socket || !user) return;

    const handleState = (state: BattleshipState) => {
      setGameState(state);
      setError(null);
      if (state.phase === 'placement' && !state.winnerId) {
        setPlayAgainPrompt(null);
        setHasQuitPlayAgain(false);
      }
    };

    const handleError = (data: { message: string }) => {
      setError(data.message);
    };

    const handleGameOver = (data: {
      winnerId: string;
      winnerUsername: string;
      rewards: { winner: { aura: number; money: number }; loser: { aura: number; money: number } };
    }) => {
      setGameOver(data);
      refreshUser();
    };

    const handleShotResult = (_data: { shooterId: string; x: number; y: number; hit: boolean }) => {
      // State will be updated via battleship:state
    };

    const handlePlayAgainPrompt = (data: {
      partyId: string;
      timeLimit: number;
      startTime?: number;
      players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
      responses?: Array<{ userId: string; playAgain: boolean }>;
      playAgainCount?: number;
      leaveCount?: number;
    }) => {
      const responses = data.responses || [];
      setPlayAgainPrompt({
        ...data,
        startTime: data.startTime ?? Date.now(),
        responses,
        playAgainCount: data.playAgainCount ?? responses.filter((r) => r.playAgain).length,
        leaveCount: data.leaveCount ?? responses.filter((r) => !r.playAgain).length,
      });
      setHasQuitPlayAgain(false);
    };

    const handlePlayAgainResponseUpdate = (data: {
      partyId: string;
      responses: Array<{ userId: string; playAgain: boolean }>;
      playAgainCount: number;
      leaveCount: number;
    }) => {
      setPlayAgainPrompt((prev) =>
        prev
          ? {
              ...prev,
              responses: data.responses,
              playAgainCount: data.playAgainCount,
              leaveCount: data.leaveCount,
            }
          : null
      );
    };

    const handlePlayAgainCancelled = () => {
      setPlayAgainPrompt(null);
    };

    socket.on('battleship:state', handleState);
    socket.on('battleship:error', handleError);
    socket.on('battleship:game-over', handleGameOver);
    socket.on('battleship:shot-result', handleShotResult);
    socket.on('battleship:play-again-prompt', handlePlayAgainPrompt);
    socket.on('battleship:play-again-response-update', handlePlayAgainResponseUpdate);
    socket.on('battleship:play-again-cancelled', handlePlayAgainCancelled);

    socket.emit('battleship:register', { userId: user.id });

    return () => {
      socket.off('battleship:state', handleState);
      socket.off('battleship:error', handleError);
      socket.off('battleship:game-over', handleGameOver);
      socket.off('battleship:shot-result', handleShotResult);
      socket.off('battleship:play-again-prompt', handlePlayAgainPrompt);
      socket.off('battleship:play-again-response-update', handlePlayAgainResponseUpdate);
      socket.off('battleship:play-again-cancelled', handlePlayAgainCancelled);
    };
  }, [socket, user, refreshUser]);

  const handleStartGame = () => {
    if (!socket || !user || !currentParty) return;
    socket.emit('battleship:start', { userId: user.id, partyId: currentParty.id });
  };

  const handlePlaceShip = (x: number, y: number) => {
    if (!socket || !user || !currentParty || !selectedShipLength) return;
    socket.emit('battleship:place-ship', {
      userId: user.id,
      partyId: currentParty.id,
      x,
      y,
      length: selectedShipLength,
      horizontal: selectedHorizontal,
    });
    setSelectedShipLength(null);
  };

  const handleShoot = (x: number, y: number) => {
    if (!socket || !user || !currentParty || !isMyTurn) return;
    socket.emit('battleship:shoot', {
      userId: user.id,
      partyId: currentParty.id,
      x,
      y,
    });
  };

  const handleLeave = () => {
    if (!socket || !user || !currentParty) return;
    socket.emit('battleship:leave', { userId: user.id, partyId: currentParty.id });
    setGameState(null);
  };

  const renderCell = (
    board: number[][],
    x: number,
    y: number,
    isMyBoard: boolean,
    onClick?: () => void
  ) => {
    const cell = board[x][y];
    const isClickable = onClick !== undefined;
    let bgColor = 'bg-transparent';
    let borderColor = 'border-border/30';

    if (isMyBoard) {
      if (cell === 1) {
        bgColor = 'bg-blue-500/30';
        borderColor = 'border-blue-500/50';
      } else if (cell === 2) {
        bgColor = 'bg-red-500';
        borderColor = 'border-red-600';
      } else if (cell === 3) {
        bgColor = 'bg-gray-400/30';
        borderColor = 'border-gray-400/50';
      }
    } else {
      if (cell === 2) {
        bgColor = 'bg-red-500';
        borderColor = 'border-red-600';
      } else if (cell === 3) {
        bgColor = 'bg-gray-400/30';
        borderColor = 'border-gray-400/50';
      }
    }

    return (
      <Button variant="ghost"
        key={`${x}-${y}`}
        onClick={onClick}
        disabled={!isClickable}
        className={cn(
          'h-8 w-8 border transition-colors',
          bgColor,
          borderColor,
          isClickable && 'hover:border-foreground cursor-pointer',
          !isClickable && 'cursor-not-allowed'
        )}
      />
    );
  };

  // Not in a party
  if (!currentParty) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8 space-y-8">
        <Link
          to="/games"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Jeux
        </Link>

        <div className="text-center py-20 space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              Rejoins ou crée un duel pour jouer à la Bataille Navale
            </p>
          </div>
          <Link
            to="/party"
            className="inline-flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            Aller aux duels
          </Link>
        </div>
      </div>
    );
  }

  // Lobby (no game active)
  if (!gameState) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8 space-y-16">
        <section className="space-y-4">
          <h2 className="text-sm text-muted-foreground  ">
            Joueurs dans le duel ({partyMembers.length}/2)
          </h2>
          <div className="space-y-0">
            {partyMembers.map((member) => (
              <div
                key={member.userId}
                className={cn(
                  "flex items-center justify-between py-4 border-b border-border/30 last:border-0",
                  member.userId === user?.id && "bg-muted/30 -mx-4 px-4"
                )}
              >
                <span className="font-medium">
                  <span style={member.usernameColor ? { color: member.usernameColor } : undefined}>
                    {member.username}
                  </span>
                  {member.isLeader && (
                    <span className="ml-2 text-xs text-muted-foreground">leader</span>
                  )}
                  {member.userId === user?.id && (
                    <span className="ml-2 text-xs text-muted-foreground">(toi)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>

        {partyMembers.length < 2 && (
          <p className="text-center text-muted-foreground text-sm">
            Il faut 2 joueurs pour commencer
          </p>
        )}

        {isLeader && partyMembers.length === 2 && (
          <div className="flex justify-center">
            <Button variant="ghost"
              onClick={handleStartGame}
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
      {postGameModals}
    </div>
    );
  }

  // Game active
  return (
    <div className="mx-auto max-w-5xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8 space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost"
          onClick={handleLeave}
          className="px-4 py-2 text-sm border border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 inline mr-2" />
          Quitter
        </Button>
      </div>

      {error && (
        <div className="text-center text-red-500 text-sm animate-pulse">
          {error}
        </div>
      )}

      {/* Players info */}
      <div className="flex justify-center gap-8">
        {gameState.players.map((player) => {
          const isMe = player.userId === user?.id;
          const isCurrentTurn = gameState.currentPlayerId === player.userId;
          return (
            <div
              key={player.userId}
              className={cn(
                "px-4 py-2 border rounded",
                isCurrentTurn && gameState.phase === 'playing' && "border-yellow-500 bg-yellow-500/5",
                !isCurrentTurn && "border-border/30"
              )}
            >
              <span
                className="font-medium"
                style={player.usernameColor ? { color: player.usernameColor } : undefined}
              >
                {player.username}
                {isMe && ' (toi)'}
                {isCurrentTurn && gameState.phase === 'playing' && ' →'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Placement phase */}
      {gameState.phase === 'placement' && (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Place tes bateaux sur la grille
            </p>
            {remainingShips.length > 0 && (
              <div className="flex gap-2 justify-center mb-4">
                {remainingShips.map((length) => (
                  <Button variant="ghost"
                    key={length}
                    onClick={() => {
                      setSelectedShipLength(length);
                      setSelectedHorizontal(true);
                    }}
                    className={cn(
                      "px-3 py-1 border text-sm transition-colors",
                      selectedShipLength === length
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground"
                    )}
                  >
                    {length} cases
                  </Button>
                ))}
              </div>
            )}
            {selectedShipLength && (
              <div className="flex gap-2 justify-center mb-4">
                <Button variant="ghost"
                  onClick={() => setSelectedHorizontal(true)}
                  className={cn(
                    "px-3 py-1 border text-sm transition-colors",
                    selectedHorizontal
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground"
                  )}
                >
                  Horizontal
                </Button>
                <Button variant="ghost"
                  onClick={() => setSelectedHorizontal(false)}
                  className={cn(
                    "px-3 py-1 border text-sm transition-colors",
                    !selectedHorizontal
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground"
                  )}
                >
                  Vertical
                </Button>
              </div>
            )}
            {gameState.myShipsPlaced && (
              <p className="text-sm text-green-500">
                ✓ Tous tes bateaux sont placés. En attente de l'adversaire...
              </p>
            )}
            {gameState.opponentShipsPlaced && !gameState.myShipsPlaced && (
              <p className="text-sm text-muted-foreground">
                L'adversaire a placé ses bateaux. Place les tiens !
              </p>
            )}
          </div>

          <div className="flex justify-center">
            <div className="grid grid-cols-10 gap-0 border-2 border-foreground/30 p-2">
              {Array.from({ length: BOARD_SIZE }).map((_, x) =>
                Array.from({ length: BOARD_SIZE }).map((_, y) =>
                  renderCell(
                    gameState.myBoard,
                    x,
                    y,
                    true,
                    selectedShipLength
                      ? () => handlePlaceShip(x, y)
                      : undefined
                  )
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Playing phase */}
      {gameState.phase === 'playing' && (
        <div className="space-y-8">
          <div className="text-center">
            {isMyTurn ? (
              <p className="text-lg font-medium text-yellow-500">
                C'est ton tour ! Tire sur la grille de l'adversaire.
              </p>
            ) : (
              <p className="text-lg text-muted-foreground">
                C'est le tour de <span className="font-medium">{opponent?.username}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* My board */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-center">Ta grille</h3>
              <div className="flex justify-center">
                <div className="grid grid-cols-10 gap-0 border-2 border-foreground/30 p-2">
                  {Array.from({ length: BOARD_SIZE }).map((_, x) =>
                    Array.from({ length: BOARD_SIZE }).map((_, y) =>
                      renderCell(gameState.myBoard, x, y, true)
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Opponent board */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-center">
                Grille de {opponent?.username}
              </h3>
              <div className="flex justify-center">
                <div className="grid grid-cols-10 gap-0 border-2 border-foreground/30 p-2">
                  {Array.from({ length: BOARD_SIZE }).map((_, x) =>
                    Array.from({ length: BOARD_SIZE }).map((_, y) =>
                      renderCell(
                        gameState.opponentBoard,
                        x,
                        y,
                        false,
                        isMyTurn && gameState.opponentBoard[x][y] === 0
                          ? () => handleShoot(x, y)
                          : undefined
                      )
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {postGameModals}
    </div>
  );
}
