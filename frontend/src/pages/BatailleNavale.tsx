import { type DragEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocketBase } from '../contexts/SocketContext';
import { useChatSocket } from '../contexts/ChatSocketContext';
import { usePartySocket } from '../contexts/PartySocketContext';
import { useDuelSocket } from '../contexts/DuelSocketContext';
import { ArrowLeft, Play, LogOut, Swords, Trophy, RotateCw } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';
import { DuelPlayerSelectionModal } from '@/components/game/DuelPlayerSelectionModal';

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

interface ShipSegment {
  horizontal: boolean;
  isStart: boolean;
  isEnd: boolean;
  length: number;
}

function buildShipSegmentMap(
  ships: BattleshipState['myShips']
): Map<string, ShipSegment> {
  const segments = new Map<string, ShipSegment>();

  for (const ship of ships) {
    for (let index = 0; index < ship.length; index += 1) {
      const x = ship.horizontal ? ship.x : ship.x + index;
      const y = ship.horizontal ? ship.y + index : ship.y;
      segments.set(`${x}-${y}`, {
        horizontal: ship.horizontal,
        isStart: index === 0,
        isEnd: index === ship.length - 1,
        length: ship.length,
      });
    }
  }

  return segments;
}

export default function BatailleNavale() {
  const { user, refreshUser } = useAuth();
  const { socket } = useSocketBase();
  const { onlineUsers, requestOnlineUsers } = useChatSocket();
  const { currentParty, partyMembers } = usePartySocket();
  const { challengeUserToDuel, outgoingDuelChallenge } = useDuelSocket();

  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [gameState, setGameState] = useState<BattleshipState | null>(null);
  const [selectedShipLength, setSelectedShipLength] = useState<number | null>(null);
  const [selectedHorizontal, setSelectedHorizontal] = useState(true);
  const [draggingShipLength, setDraggingShipLength] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState<{
    winnerId: string;
    winnerUsername: string;
    rewards: { winner: { aura: number; money: number }; loser: { aura: number; money: number } };
  } | null>(null);
  const handleCloseGameOver = () => {
    setGameOver(null);
  };

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const isMyTurn = gameState?.currentPlayerId === user?.id;
  const opponent = gameState?.players.find((p) => p.userId !== user?.id);
  const myShipSegments = gameState ? buildShipSegmentMap(gameState.myShips) : new Map<string, ShipSegment>();

  const postGameModals = (
    <>
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
              {gameOver?.winnerUsername ? (
                <UsernameDisplay username={gameOver.winnerUsername} className="justify-center text-2xl font-light" />
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between py-3 px-3 border rounded border-yellow-500/50 bg-yellow-500/5">
                {gameOver?.winnerUsername ? (
                  <UsernameDisplay username={gameOver.winnerUsername} className="font-medium" />
                ) : null}
                <div className="text-sm">
                  <span className="text-purple-400">+{gameOver?.rewards.winner.aura} aura </span>
                  <span className="text-green-400">+{gameOver?.rewards.winner.money}$</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-3 px-3 border rounded border-border/30">
                {(() => {
                  const loser = gameState?.players.find((p) => p.userId !== gameOver?.winnerId);
                  return loser ? (
                    <UsernameDisplay username={loser.username} usernameColor={loser.usernameColor} className="font-medium" />
                  ) : null;
                })()}
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

    socket.on('battleship:state', handleState);
    socket.on('battleship:error', handleError);
    socket.on('battleship:game-over', handleGameOver);
    socket.on('battleship:shot-result', handleShotResult);

    socket.emit('battleship:register', { userId: user.id });

    return () => {
      socket.off('battleship:state', handleState);
      socket.off('battleship:error', handleError);
      socket.off('battleship:game-over', handleGameOver);
      socket.off('battleship:shot-result', handleShotResult);
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
    setDraggingShipLength(null);
  };

  const handleRotate = () => {
    setSelectedHorizontal((prev) => !prev);
  };

  const handleDropShip = (x: number, y: number, droppedLength?: number) => {
    const lengthToPlace = droppedLength ?? selectedShipLength;
    if (!lengthToPlace) return;

    setSelectedShipLength(lengthToPlace);

    if (!socket || !user || !currentParty) return;
    socket.emit('battleship:place-ship', {
      userId: user.id,
      partyId: currentParty.id,
      x,
      y,
      length: lengthToPlace,
      horizontal: selectedHorizontal,
    });

    setSelectedShipLength(null);
    setDraggingShipLength(null);
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

  useEffect(() => {
    if (gameState?.phase !== 'placement') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        setSelectedHorizontal((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState?.phase]);

  const renderCell = (
    board: number[][],
    x: number,
    y: number,
    isMyBoard: boolean,
    onClick?: () => void,
    onDragOver?: (event: DragEvent<HTMLButtonElement>) => void,
    onDrop?: (event: DragEvent<HTMLButtonElement>) => void
  ) => {
    const cell = board[x][y];
    const shipSegment = isMyBoard ? myShipSegments.get(`${x}-${y}`) : undefined;
    const isClickable = onClick !== undefined;
    const isDroppable = onDrop !== undefined;
    let bgColor = 'bg-sky-950/20';
    let borderColor = 'border-border/30';

    if (isMyBoard) {
      if (cell === 2) {
        bgColor = 'bg-red-500/20';
        borderColor = 'border-red-600';
      } else if (cell === 3) {
        bgColor = 'bg-slate-400/20';
        borderColor = 'border-slate-300/40';
      } else if (shipSegment) {
        borderColor = 'border-cyan-200/40';
      }
    } else {
      if (cell === 2) {
        bgColor = 'bg-red-500/20';
        borderColor = 'border-red-600';
      } else if (cell === 3) {
        bgColor = 'bg-slate-400/20';
        borderColor = 'border-slate-300/40';
      }
    }

    const shipShape = shipSegment
      ? cn(
          'pointer-events-none absolute inset-[2px] border border-slate-950/30 bg-gradient-to-b from-slate-200 via-slate-400 to-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]',
          shipSegment.horizontal
            ? [
                'top-[6px] bottom-[6px]',
                shipSegment.length === 1 && 'rounded-full',
                shipSegment.isStart && 'rounded-l-full',
                shipSegment.isEnd && 'rounded-r-full',
              ]
            : [
                'left-[6px] right-[6px]',
                shipSegment.length === 1 && 'rounded-full',
                shipSegment.isStart && 'rounded-t-full',
                shipSegment.isEnd && 'rounded-b-full',
              ]
        )
      : null;

    return (
      <Button variant="ghost"
        key={`${x}-${y}`}
        onClick={onClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        disabled={!isClickable && !isDroppable}
        className={cn(
          'relative h-8 w-8 overflow-hidden rounded-none border p-0 transition-colors',
          bgColor,
          borderColor,
          (isClickable || isDroppable) && 'hover:border-foreground hover:bg-sky-900/30 cursor-pointer',
          !isClickable && !isDroppable && 'cursor-not-allowed'
        )}
      >
        {shipShape ? <span className={shipShape} /> : null}
        {shipSegment && cell !== 2 ? (
          <span
            className={cn(
              'pointer-events-none absolute bg-slate-100/35',
              shipSegment.horizontal
                ? 'left-1/2 top-[9px] h-[2px] w-3 -translate-x-1/2 rounded-full'
                : 'left-[9px] top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-full'
            )}
          />
        ) : null}
        {cell === 2 ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="h-4 w-4 rounded-full border border-red-200/70 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
          </span>
        ) : null}
        {cell === 3 ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200/80" />
          </span>
        ) : null}
      </Button>
    );
  };

  // Not in a party
  if (!currentParty) {
    return (
      <PageShell>
        <PageHeader
          title="Bataille Navale"
          description="Place tes bateaux et coule ceux de ton adversaire."
          actions={(
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
          )}
        />
        <Card>
          <CardContent className="py-10 px-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Joue en 1v1 contre un autre joueur
            </p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <Button onClick={() => setShowChallengePicker(true)}>
                <Swords className="h-4 w-4 mr-2" />
                Défier un joueur
              </Button>
              <Button asChild variant="outline">
                <Link to="/party">Via un groupe</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <DuelPlayerSelectionModal
          open={showChallengePicker}
          onOpenChange={setShowChallengePicker}
          title="Défier en Bataille Navale"
          gameType="battleship"
          onlineUsers={onlineUsers}
          currentUserId={user?.id}
          outgoingDuelChallenge={outgoingDuelChallenge}
          challengeUserToDuel={challengeUserToDuel}
          requestOnlineUsers={requestOnlineUsers}
        />
      </PageShell>
    );
  }

  // Lobby (no game active)
  if (!gameState) {
    return (
      <PageShell>
        <PageHeader
          title="Bataille Navale"
          description={`Groupe : ${currentParty.name || 'Sans nom'}`}
          actions={(
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
          )}
        />
        <Card>
          <CardContent className="p-6 space-y-4">
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
                  <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
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
          </CardContent>
        </Card>

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
    </PageShell>
    );
  }

  // Game active
  return (
    <PageShell>
      <PageHeader
        title="Bataille Navale"
        description={`Groupe : ${currentParty.name || 'Sans nom'}`}
        actions={(
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
        )}
      />

      {error && (
        <div className="text-center text-red-500 text-sm animate-pulse">
          {error}
        </div>
      )}

      {/* Players info */}
      <Card>
        <CardContent className="p-6">
      <div className="flex justify-center gap-8 flex-wrap">
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
              <span className="font-medium">
                <UsernameDisplay username={player.username} usernameColor={player.usernameColor} />
                {isMe && ' (toi)'}
                {isCurrentTurn && gameState.phase === 'playing' && ' →'}
              </span>
            </div>
          );
        })}
      </div>
        </CardContent>
      </Card>

      {/* Placement phase */}
      {gameState.phase === 'placement' && (
        <Card>
          <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Place tes bateaux sur la grille
            </p>
            {remainingShips.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {remainingShips.map((length, index) => (
                  <Button variant="ghost"
                    key={`${length}-${index}`}
                    draggable
                    onClick={() => {
                      setSelectedShipLength(length);
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', String(length));
                      setSelectedShipLength(length);
                      setDraggingShipLength(length);
                    }}
                    onDragEnd={() => setDraggingShipLength(null)}
                    className={cn(
                      "px-3 py-1 border text-sm transition-colors cursor-grab active:cursor-grabbing",
                      selectedShipLength === length
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground"
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span>{length} cases</span>
                      <span className="inline-flex gap-0.5">
                        {Array.from({ length }).map((_, segmentIndex) => (
                          <span
                            key={segmentIndex}
                            className="h-2 w-2 rounded-sm bg-current/70"
                          />
                        ))}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            )}
            {selectedShipLength && (
              <div className="flex flex-wrap items-center gap-2 justify-center mb-4">
                <Button variant="ghost" onClick={handleRotate}
                  className={cn(
                    "px-3 py-1 border text-sm transition-colors",
                    "border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground"
                  )}
                >
                  <RotateCw className="h-4 w-4 mr-1" />
                  Rotation: {selectedHorizontal ? 'Horizontal' : 'Vertical'}
                </Button>
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
                <span className="text-xs text-muted-foreground">R pour pivoter</span>
              </div>
            )}
            {draggingShipLength && (
              <p className="text-xs text-muted-foreground mb-4">
                Glisse le bateau de {draggingShipLength} cases sur la grille
              </p>
            )}
            {gameState.myShipsPlaced && (
              <p className="text-sm text-green-500">
                Tous tes bateaux sont placés. En attente de l'adversaire...
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
                      : undefined,
                    remainingShips.length > 0
                      ? (event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                        }
                      : undefined,
                    remainingShips.length > 0
                      ? (event) => {
                          event.preventDefault();
                          const droppedLength = Number(event.dataTransfer.getData('text/plain'));
                          handleDropShip(x, y, Number.isFinite(droppedLength) ? droppedLength : undefined);
                        }
                      : undefined
                  )
                )
              )}
            </div>
          </div>
          </CardContent>
        </Card>
      )}

      {/* Playing phase */}
      {gameState.phase === 'playing' && (
        <Card>
          <CardContent className="p-6 space-y-8">
          <div className="text-center">
            {isMyTurn ? (
              <p className="text-lg font-medium text-yellow-500">
                C'est ton tour ! Tire sur la grille de l'adversaire.
              </p>
            ) : (
              <p className="text-lg text-muted-foreground">
                C'est le tour de {opponent?.username ? (
                  <UsernameDisplay username={opponent.username} usernameColor={opponent.usernameColor} className="font-medium" />
                ) : null}
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
                Grille de {opponent?.username ? (
                  <UsernameDisplay username={opponent.username} usernameColor={opponent.usernameColor} />
                ) : null}
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
          </CardContent>
        </Card>
      )}

      {postGameModals}
    </PageShell>
  );
}
