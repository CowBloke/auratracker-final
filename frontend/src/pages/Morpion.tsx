import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocketBase } from '../contexts/SocketContext';
import { useChatSocket } from '../contexts/ChatSocketContext';
import { usePartySocket } from '../contexts/PartySocketContext';
import { useDuelSocket } from '../contexts/DuelSocketContext';
import { ArrowLeft, Bot, Play, LogOut, Search, Swords, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';

type Cell = 0 | 1 | 2;

interface MorpionPlayerInfo {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: 0 | 1;
}

interface MorpionState {
  partyId: string;
  board: Cell[];
  currentPlayerId: string;
  turnDuration?: number;
  turnStartTime?: number;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  winCells: number[] | null;
  lastMove: { index: number; playerId: string } | null;
  players: MorpionPlayerInfo[];
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

const GRID_SIZE = 3;

export default function Morpion() {
  const { user, refreshUser } = useAuth();
  const { socket } = useSocketBase();
  const { onlineUsers, requestOnlineUsers } = useChatSocket();
  const { currentParty, partyMembers } = usePartySocket();
  const { challengeUserToDuel, outgoingDuelChallenge, startVsAiDuel } = useDuelSocket();

  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [challengeSearch, setChallengeSearch] = useState('');
  const [showAIPicker, setShowAIPicker] = useState(false);
  const [gameState, setGameState] = useState<MorpionState | null>(null);
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

    socket.emit('morpion:register');

    const onState = (state: MorpionState) => {
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

    socket.on('morpion:state', onState);
    socket.on('morpion:game-over', onGameOver);
    socket.on('morpion:left', onLeft);
    socket.on('morpion:error', onError);

    return () => {
      socket.off('morpion:state', onState);
      socket.off('morpion:game-over', onGameOver);
      socket.off('morpion:left', onLeft);
      socket.off('morpion:error', onError);
    };
  }, [socket, user, refreshUser]);

  const handleStart = () => {
    if (!socket || !currentParty) return;
    socket.emit('morpion:start', { partyId: currentParty.id });
  };

  const handleMove = (index: number) => {
    const partyId = gameState?.partyId ?? currentParty?.id;
    if (!socket || !partyId || !isMyTurn || !gameState) return;
    if (gameState.board[index] !== 0) return;
    socket.emit('morpion:move', { partyId, index });
  };

  const handleLeave = () => {
    const partyId = gameState?.partyId ?? currentParty?.id;
    if (!socket || !partyId) return;
    socket.emit('morpion:leave', { partyId });
    setGameState(null);
  };

  const getCellLabel = (cell: Cell) => {
    if (cell === 1) return 'X';
    if (cell === 2) return 'O';
    return '';
  };

  const isWinCell = (index: number) => gameState?.winCells?.includes(index) ?? false;

  if (!currentParty && !gameState) {
    const challengeableUsers = onlineUsers.filter(
      (onlineUser) =>
        onlineUser.userId !== user?.id &&
        onlineUser.username.toLowerCase().includes(challengeSearch.toLowerCase())
    );

    return (
      <PageShell>
        <PageHeader
          title="Morpion"
          description="Duel tactique rapide: aligne 3 symboles avant ton adversaire."
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
            <p className="text-sm text-muted-foreground">Joue en 1v1 contre un autre joueur ou contre l'IA.</p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <Button onClick={() => setShowAIPicker(true)}>
                <Bot className="h-4 w-4 mr-2" />
                Jouer contre l'IA
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setChallengeSearch('');
                  requestOnlineUsers();
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

        <Dialog open={showAIPicker} onOpenChange={setShowAIPicker}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle className="font-normal flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Jouer contre l'IA — Morpion
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Choisis la difficulte :</p>
            <div className="flex flex-col gap-2">
              {(['easy', 'medium', 'hard'] as const).map((diff) => (
                <Button
                  key={diff}
                  variant="outline"
                  onClick={() => { setShowAIPicker(false); startVsAiDuel('morpion', diff); }}
                >
                  {diff === 'easy' ? 'Facile' : diff === 'medium' ? 'Normal' : 'Expert'}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showChallengePicker} onOpenChange={setShowChallengePicker}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-normal flex items-center gap-2">
                <Swords className="h-4 w-4" />
                Defier en Morpion
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un joueur..."
                  value={challengeSearch}
                  onChange={(event) => setChallengeSearch(event.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {challengeableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {onlineUsers.filter((onlineUser) => onlineUser.userId !== user?.id).length === 0
                      ? 'Aucun joueur en ligne'
                      : 'Aucun resultat'}
                  </p>
                ) : (
                  challengeableUsers.map((onlineUser) => {
                    const isPending =
                      outgoingDuelChallenge?.targetId === onlineUser.userId &&
                      outgoingDuelChallenge.gameType === 'morpion';

                    return (
                      <div
                        key={onlineUser.userId}
                        className="flex items-center justify-between py-2 px-3 rounded-md border border-border/40 hover:border-border/80 transition-colors"
                      >
                        <UsernameDisplay
                          username={onlineUser.username}
                          usernameColor={onlineUser.usernameColor}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          variant={isPending ? 'outline' : 'default'}
                          disabled={isPending}
                          onClick={() => {
                            challengeUserToDuel(onlineUser.userId, onlineUser.username, 'morpion');
                            setShowChallengePicker(false);
                          }}
                        >
                          {isPending ? 'Envoye...' : 'Defier'}
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

  if (!gameState) {
    return (
      <PageShell>
        <PageHeader
          title="Morpion"
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

        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm text-muted-foreground">Joueurs dans le duel ({partyMembers.length}/2)</h2>
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
          <p className="text-center text-muted-foreground text-sm">Il faut 2 joueurs pour commencer.</p>
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
          <div className="text-center text-muted-foreground py-8">En attente que le leader lance la partie...</div>
        )}

        <PostGameModals gameOver={gameOver} setGameOver={setGameOver} gameState={gameState} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Morpion"
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

      {error && <p className="text-center text-sm text-red-500 animate-pulse">{error}</p>}

      <Card>
        <CardContent className="p-4">
          <div className="flex justify-center gap-6 flex-wrap">
            {gameState.players.map((player) => {
              const isMe = player.userId === user?.id;
              const isCurrentTurn = gameState.currentPlayerId === player.userId && gameState.phase === 'playing';
              const symbol = player.playerIndex === 0 ? 'X' : 'O';
              return (
                <div
                  key={player.userId}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-2 border rounded-lg transition-colors',
                    isCurrentTurn ? 'border-foreground/60 bg-muted/40' : 'border-border/30'
                  )}
                >
                  <span className="text-sm font-semibold">{symbol}</span>
                  <span className="text-sm font-medium">
                    <UsernameDisplay username={player.username} usernameColor={player.usernameColor} />
                    {isMe && <span className="ml-1 text-xs text-muted-foreground">(toi)</span>}
                  </span>
                  {isCurrentTurn && <span className="text-xs text-muted-foreground">→</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground space-y-1">
        <p>
          {gameState.phase === 'finished'
            ? gameState.winnerId
              ? gameState.winnerId === user?.id
                ? 'Tu as gagne !'
                : `${opponent?.username} a gagne.`
              : 'Egalite !'
            : isMyTurn
              ? 'C\'est ton tour - choisis une case'
              : `Au tour de ${opponent?.username ?? '...'}`}
        </p>
        {gameState.phase === 'playing' && (
          <p className={cn('text-xs', turnSecondsLeft <= 3 ? 'text-red-500' : 'text-muted-foreground')}>
            Temps restant: {turnSecondsLeft}s
          </p>
        )}
      </div>

      <div className="mx-auto grid gap-3" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`, maxWidth: 360 }}>
        {gameState.board.map((cell, index) => {
          const canClick = isMyTurn && gameState.phase === 'playing' && cell === 0;
          const isLastMove = gameState.lastMove?.index === index;
          const isWinningCell = isWinCell(index);

          return (
            <button
              key={index}
              onClick={() => canClick && handleMove(index)}
              disabled={!canClick}
              className={cn(
                'h-24 rounded-xl border text-4xl font-semibold transition-colors',
                canClick
                  ? 'border-border/50 hover:border-foreground/60 hover:bg-muted/30 cursor-pointer'
                  : 'border-border/30 cursor-default',
                isLastMove && 'bg-muted/40',
                isWinningCell && 'border-emerald-500 bg-emerald-500/10'
              )}
            >
              {getCellLabel(cell)}
            </button>
          );
        })}
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
  gameState: MorpionState | null;
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
