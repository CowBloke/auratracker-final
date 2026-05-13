import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocketBase } from '../contexts/SocketContext';
import { useChatSocket } from '../contexts/ChatSocketContext';
import { usePartySocket } from '../contexts/PartySocketContext';
import { useDuelSocket } from '../contexts/DuelSocketContext';
import { ArrowLeft, LogOut, Swords, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';
import { DuelPlayerSelectionModal } from '@/components/game/DuelPlayerSelectionModal';
import { DuelLobbyPanel } from '@/components/game/DuelLobbyPanel';

interface DotsAndBoxesPlayerInfo {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: 0 | 1;
}

interface DotsAndBoxesState {
  partyId: string;
  gridSize: number;
  hLines: boolean[];
  vLines: boolean[];
  boxes: (0 | 1 | 2)[];
  scores: [number, number];
  currentPlayerId: string;
  turnDuration?: number;
  turnStartTime?: number;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  lastMove: { type: 'h' | 'v'; row: number; col: number; playerId: string } | null;
  players: DotsAndBoxesPlayerInfo[];
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

export default function DotsAndBoxes() {
  const { user, refreshUser } = useAuth();
  const { socket } = useSocketBase();
  const { onlineUsers, requestOnlineUsers } = useChatSocket();
  const { currentParty, partyMembers } = usePartySocket();
  const { challengeUserToDuel, outgoingDuelChallenge } = useDuelSocket();

  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [gameState, setGameState] = useState<DotsAndBoxesState | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnTimeLeftMs, setTurnTimeLeftMs] = useState(0);

  const isLeader = partyMembers.find((member) => member.userId === user?.id)?.isLeader;
  const opponent = gameState?.players.find((player) => player.userId !== user?.id);
  const isMyTurn = gameState?.currentPlayerId === user?.id && gameState?.phase === 'playing';
  const turnSecondsLeft = Math.max(0, Math.ceil(turnTimeLeftMs / 1000));

  useEffect(() => {
    if (gameState?.phase !== 'playing' || !gameState.turnDuration || !gameState.turnStartTime) {
      setTurnTimeLeftMs(0);
      return;
    }

    const updateRemaining = () => {
      const elapsed = Date.now() - gameState.turnStartTime!;
      setTurnTimeLeftMs(Math.max(0, gameState.turnDuration! - elapsed));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 100);
    return () => clearInterval(interval);
  }, [gameState?.phase, gameState?.turnDuration, gameState?.turnStartTime]);

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('dotsandboxes:register');

    const onState = (state: DotsAndBoxesState) => {
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

    socket.on('dotsandboxes:state', onState);
    socket.on('dotsandboxes:game-over', onGameOver);
    socket.on('dotsandboxes:left', onLeft);
    socket.on('dotsandboxes:error', onError);

    return () => {
      socket.off('dotsandboxes:state', onState);
      socket.off('dotsandboxes:game-over', onGameOver);
      socket.off('dotsandboxes:left', onLeft);
      socket.off('dotsandboxes:error', onError);
    };
  }, [socket, user, refreshUser]);

  const handleStart = () => {
    if (!socket || !currentParty) return;
    socket.emit('dotsandboxes:start', { partyId: currentParty.id });
  };

  const handleMove = (type: 'h' | 'v', row: number, col: number) => {
    const partyId = gameState?.partyId ?? currentParty?.id;
    if (!socket || !partyId || !isMyTurn || !gameState) return;
    socket.emit('dotsandboxes:move', { partyId, type, row, col });
  };

  const handleLeave = () => {
    const partyId = gameState?.partyId ?? currentParty?.id;
    if (!socket || !partyId) return;
    socket.emit('dotsandboxes:leave', { partyId });
    setGameState(null);
  };

  if (!currentParty && !gameState) {
    return (
      <PageShell>
        <PageHeader
          title="Dots and Boxes"
          description="Relie les points pour fermer des carres. Le joueur qui ferme le plus de carres gagne !"
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
          <CardContent className="py-10 px-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Joue en 1v1 contre un autre joueur.</p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setShowChallengePicker(true);
                }}
              >
                <Swords className="h-4 w-4 mr-2" />
                Defier un joueur
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
          title="Defier en Dots and Boxes"
          gameType="dotsandboxes"
          onlineUsers={onlineUsers}
          currentUserId={user?.id}
          outgoingDuelChallenge={outgoingDuelChallenge}
          challengeUserToDuel={challengeUserToDuel}
          requestOnlineUsers={requestOnlineUsers}
        />
      </PageShell>
    );
  }

  if (!gameState) {
    return (
      <PageShell>
        <PageHeader
          title="Dots and Boxes"
          description={`Duel : ${currentParty?.name || 'Sans nom'}`}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
          }
        />

        <DuelLobbyPanel
          members={partyMembers}
          currentUserId={user?.id}
          title={`Joueurs dans le duel (${partyMembers.length}/2)`}
          minimumPlayers={2}
          isLeader={isLeader}
          notEnoughPlayersText="Il faut 2 joueurs pour commencer."
          onStart={handleStart}
        />

        <PostGameModals gameOver={gameOver} setGameOver={setGameOver} gameState={gameState} />
      </PageShell>
    );
  }

  const { gridSize, hLines, vLines, boxes, scores } = gameState;
  const cellSize = 60; // size of each box in pixels
  const dotSize = 8;
  const padding = 20;
  const boardSize = (gridSize - 1) * cellSize + dotSize + padding * 2;

  return (
    <PageShell>
      <PageHeader
        title="Dots and Boxes"
        description={`Duel : ${currentParty?.name || 'Sans nom'}`}
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

      {error && <p className="text-center text-sm text-red-500 animate-pulse mb-4">{error}</p>}

      <div className="flex flex-col items-center gap-6">
        <div className="flex justify-center gap-6 flex-wrap w-full">
          {gameState.players.map((player) => {
            const isMe = player.userId === user?.id;
            const isCurrentTurn = gameState.currentPlayerId === player.userId && gameState.phase === 'playing';
            const color = player.playerIndex === 0 ? 'text-blue-400' : 'text-purple-400';
            const bgColor = player.playerIndex === 0 ? 'bg-blue-500/10' : 'bg-purple-500/10';
            const borderColor = player.playerIndex === 0 ? 'border-blue-500/30' : 'border-purple-500/30';

            return (
              <div
                key={player.userId}
                className={cn(
                  'flex flex-col items-center gap-1 px-6 py-3 border rounded-xl transition-all',
                  isCurrentTurn ? cn('border-foreground/40 bg-muted/30 scale-105 shadow-lg', color) : cn('border-border/30 opacity-70', bgColor, borderColor)
                )}
              >
                <span className="text-xs font-bold uppercase tracking-wider">Joueur {player.playerIndex + 1}</span>
                <span className="text-sm font-medium">
                  <UsernameDisplay username={player.username} usernameColor={player.usernameColor} />
                  {isMe && <span className="ml-1 text-xs text-muted-foreground">(toi)</span>}
                </span>
                <span className="text-2xl font-bold mt-1">{scores[player.playerIndex]}</span>
              </div>
            );
          })}
        </div>

        <div className="text-center text-sm text-muted-foreground h-10">
          <p>
            {gameState.phase === 'finished'
              ? gameState.winnerId
                ? gameState.winnerId === user?.id
                  ? 'Tu as gagne !'
                  : `${opponent?.username} a gagne.`
                : 'Egalite !'
              : isMyTurn
                ? 'C\'est ton tour - place une ligne'
                : `Au tour de ${opponent?.username ?? '...'}`}
          </p>
          {gameState.phase === 'playing' && (
            <p className={cn('text-xs mt-1', turnSecondsLeft <= 3 ? 'text-red-500 font-bold' : 'text-muted-foreground')}>
              Temps restant: {turnSecondsLeft}s
            </p>
          )}
        </div>

        {/* Game Board */}
        <div 
          className="relative bg-background/50 border border-border/50 rounded-2xl shadow-2xl p-4 overflow-hidden"
          style={{ width: boardSize, height: boardSize }}
        >
          {/* Boxes */}
          {boxes.map((playerIdx, idx) => {
            if (playerIdx === 0) return null;
            const r = Math.floor(idx / (gridSize - 1));
            const c = idx % (gridSize - 1);
            return (
              <div
                key={`box-${idx}`}
                className={cn(
                  'absolute transition-all duration-500 animate-in fade-in zoom-in-75',
                  playerIdx === 1 ? 'bg-blue-500/20' : 'bg-purple-500/20'
                )}
                style={{
                  top: padding + r * cellSize + dotSize / 2,
                  left: padding + c * cellSize + dotSize / 2,
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 4
                }}
              />
            );
          })}

          {/* Horizontal Lines */}
          {hLines.map((filled, idx) => {
            const r = Math.floor(idx / (gridSize - 1));
            const c = idx % (gridSize - 1);
            const canClick = isMyTurn && !filled && gameState.phase === 'playing';
            
            return (
              <div
                key={`h-${idx}`}
                onClick={() => canClick && handleMove('h', r, c)}
                className={cn(
                  'absolute cursor-pointer transition-all duration-200 group',
                  filled ? 'h-[4px] -translate-y-[2px]' : 'h-[12px] -translate-y-[6px] hover:bg-white/5'
                )}
                style={{
                  top: padding + r * cellSize + dotSize / 2,
                  left: padding + c * cellSize + dotSize,
                  width: cellSize - dotSize,
                }}
              >
                <div 
                  className={cn(
                    'w-full h-full rounded-full transition-all duration-300',
                    filled 
                      ? (gameState.lastMove?.type === 'h' && gameState.lastMove.row === r && gameState.lastMove.col === c 
                          ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' 
                          : 'bg-foreground/80')
                      : 'bg-foreground/5 opacity-0 group-hover:opacity-40'
                  )}
                />
              </div>
            );
          })}

          {/* Vertical Lines */}
          {vLines.map((filled, idx) => {
            const r = Math.floor(idx / gridSize);
            const c = idx % gridSize;
            const canClick = isMyTurn && !filled && gameState.phase === 'playing';

            return (
              <div
                key={`v-${idx}`}
                onClick={() => canClick && handleMove('v', r, c)}
                className={cn(
                  'absolute cursor-pointer transition-all duration-200 group',
                  filled ? 'w-[4px] -translate-x-[2px]' : 'w-[12px] -translate-x-[6px] hover:bg-white/5'
                )}
                style={{
                  top: padding + r * cellSize + dotSize,
                  left: padding + c * cellSize + dotSize / 2,
                  height: cellSize - dotSize,
                }}
              >
                <div 
                  className={cn(
                    'w-full h-full rounded-full transition-all duration-300',
                    filled 
                      ? (gameState.lastMove?.type === 'v' && gameState.lastMove.row === r && gameState.lastMove.col === c 
                          ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' 
                          : 'bg-foreground/80')
                      : 'bg-foreground/5 opacity-0 group-hover:opacity-40'
                  )}
                />
              </div>
            );
          })}

          {/* Dots */}
          {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
            const r = Math.floor(idx / gridSize);
            const c = idx % gridSize;
            return (
              <div
                key={`dot-${idx}`}
                className="absolute bg-foreground rounded-full shadow-[0_0_5px_rgba(255,255,255,0.3)]"
                style={{
                  top: padding + r * cellSize,
                  left: padding + c * cellSize,
                  width: dotSize,
                  height: dotSize,
                }}
              />
            );
          })}
        </div>
      </div>

      <PostGameModals gameOver={gameOver} setGameOver={setGameOver} gameState={gameState} />
    </PageShell>
  );
}

function PostGameModals({
  gameOver,
  setGameOver,
  gameState,
}: {
  gameOver: GameOverData | null;
  setGameOver: (value: GameOverData | null) => void;
  gameState: DotsAndBoxesState | null;
}) {
  return (
    <Dialog open={!!gameOver} onOpenChange={() => setGameOver(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-normal flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Partie terminee
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {gameOver?.isDraw ? (
            <div className="text-center">
              <p className="text-2xl font-light">Egalite !</p>
              {gameOver.rewards.draw && (
                <p className="text-sm text-muted-foreground mt-2">
                  +{gameOver.rewards.draw.aura} aura - +{gameOver.rewards.draw.money}$
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Gagnant</p>
                {gameOver?.winnerUsername && (
                  <UsernameDisplay username={gameOver.winnerUsername} className="justify-center text-2xl font-light" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-3 px-3 border rounded border-yellow-500/50 bg-yellow-500/5">
                  {gameOver?.winnerUsername && <UsernameDisplay username={gameOver.winnerUsername} className="font-medium" />}
                  <div className="text-sm">
                    {gameOver?.rewards.winner && (
                      <>
                        <span className="text-purple-400">+{gameOver.rewards.winner.aura} aura </span>
                        <span className="text-green-400">+{gameOver.rewards.winner.money}$</span>
                      </>
                    )}
                  </div>
                </div>
                {(() => {
                  const loser = gameState?.players.find((player) => player.userId !== gameOver?.winnerId);
                  return loser ? (
                    <div className="flex items-center justify-between py-3 px-3 border rounded border-border/30">
                      <UsernameDisplay
                        username={loser.username}
                        usernameColor={loser.usernameColor}
                        className="font-medium"
                      />
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
  );
}
