import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ArrowLeft, Play, Skull, Crown, Trophy, LogOut, Check, X, Target } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PlayAgainPrompt from '@/components/game/PlayAgainPrompt';
import { cn } from '@/lib/utils';

interface RussianRoulettePlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  isAlive: boolean;
  roundsSurvived: number;
  isEliminated: boolean;
}

interface RussianRouletteState {
  players: RussianRoulettePlayer[];
  currentPlayerIndex: number;
  round: number;
  isActive: boolean;
  isYourTurn?: boolean;
  lastShot?: {
    playerId: string;
    playerUsername: string;
    fired: boolean;
  };
}

export default function RussianRoulette() {
  const { user, refreshUser } = useAuth();
  const {
    currentParty,
    partyMembers,
    russianRouletteGame,
    russianRouletteGameOver,
    russianRouletteJoinPrompt,
    russianRoulettePlayAgainPrompt,
    startRussianRoulette,
    pullTriggerRussianRoulette,
    leaveRussianRoulette,
    clearRussianRouletteGameOver,
    respondToRussianRouletteJoin,
    respondToRussianRoulettePlayAgain,
  } = useSocket();

  const [gameState, setGameState] = useState<RussianRouletteState | null>(null);
  const [error] = useState<string | null>(null);
  const [hasRespondedJoin, setHasRespondedJoin] = useState(false);
  const [joinTimeLeft, setJoinTimeLeft] = useState(100);
  const [hasQuitPlayAgain, setHasQuitPlayAgain] = useState(false);

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const myPlayer = gameState?.players.find((p) => p.userId === user?.id);
  const isMyTurn = gameState?.isYourTurn || false;

  // Update game state from socket
  useEffect(() => {
    if (russianRouletteGame) {
      setGameState(russianRouletteGame);
    }
  }, [russianRouletteGame]);

  // Handle game over - refresh user data
  useEffect(() => {
    if (russianRouletteGameOver) {
      refreshUser();
    }
  }, [russianRouletteGameOver, refreshUser]);

  // Handle play again prompt
  useEffect(() => {
    if (russianRoulettePlayAgainPrompt) {
      refreshUser();
      setHasQuitPlayAgain(false);
    }
  }, [russianRoulettePlayAgainPrompt?.partyId, russianRoulettePlayAgainPrompt?.startTime, refreshUser]);

  // Join prompt timer
  useEffect(() => {
    if (!russianRouletteJoinPrompt) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - russianRouletteJoinPrompt.startTime;
      const remaining = Math.max(0, 100 - (elapsed / russianRouletteJoinPrompt.timeout) * 100);
      setJoinTimeLeft(remaining);
    }, 50);

    return () => clearInterval(interval);
  }, [russianRouletteJoinPrompt?.startTime, russianRouletteJoinPrompt?.timeout]);

  const handleStartGame = () => {
    if (!currentParty) return;
    startRussianRoulette();
  };

  const handlePullTrigger = () => {
    if (!currentParty || !isMyTurn) return;
    pullTriggerRussianRoulette();
  };

  const handleLeaveGame = () => {
    if (!currentParty) return;
    leaveRussianRoulette();
    setGameState(null);
  };

  const handleAcceptJoin = () => {
    if (!russianRouletteJoinPrompt) return;
    respondToRussianRouletteJoin(true);
    setHasRespondedJoin(true);
  };

  const handleDeclineJoin = () => {
    if (!russianRouletteJoinPrompt) return;
    respondToRussianRouletteJoin(false);
    setHasRespondedJoin(true);
  };

  const myPlayAgainResponse = russianRoulettePlayAgainPrompt?.responses.find((r) => r.userId === user?.id);
  const hasQuit = hasQuitPlayAgain || (!!myPlayAgainResponse && !myPlayAgainResponse.playAgain);
  const showPlayAgainPrompt = !!russianRoulettePlayAgainPrompt && !hasQuit;

  if (!currentParty) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center py-12 px-6">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">You must be in a party to play Russian Roulette</p>
          <Link to="/party">
            <Button>Go to Party</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/party">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="text-3xl font-bold flex items-center gap-2">
                <Target className="h-8 w-8 text-red-500" />
                Roulette Russe
              </div>
              <p className="text-muted-foreground">1/6 chance de perdre à chaque tour</p>
            </div>
          </div>
          {gameState?.isActive && (
            <Button variant="destructive" onClick={handleLeaveGame}>
              <LogOut className="h-4 w-4 mr-2" />
              Quitter
            </Button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}

        {/* Join Prompt */}
        {russianRouletteJoinPrompt && !hasRespondedJoin && (
          <Dialog open={true}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Rejoindre la partie?</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Le leader de la party veut lancer une partie de Roulette Russe.
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-100"
                      style={{ width: `${joinTimeLeft}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {Math.ceil((joinTimeLeft / 100) * (russianRouletteJoinPrompt.timeout / 1000))}s
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleDeclineJoin}>
                  <X className="h-4 w-4 mr-2" />
                  Refuser
                </Button>
                <Button onClick={handleAcceptJoin}>
                  <Check className="h-4 w-4 mr-2" />
                  Rejoindre
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Game Over Dialog */}
        {russianRouletteGameOver && (
          <Dialog open={true} onOpenChange={handleCloseGameOver}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Partie terminée
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="text-2xl font-bold mb-2">
                    {russianRouletteGameOver.winnerUsername} a gagné!
                  </div>
                  <p className="text-muted-foreground">
                    {russianRouletteGameOver.winnerUsername} a survécu {russianRouletteGameOver.players.find(p => p.isWinner)?.roundsSurvived || 0} tours
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Résultats:</h3>
                  {russianRouletteGameOver.players.map((player) => (
                    <div
                      key={player.userId}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        player.isWinner
                          ? 'bg-yellow-500/10 border-yellow-500/20'
                          : 'bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {player.isWinner && <Crown className="h-5 w-5 text-yellow-500" />}
                        <span className={cn('font-medium', player.isWinner && 'text-yellow-500')}>
                          {player.username}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {player.roundsSurvived} tour{player.roundsSurvived > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          +{player.rewards.aura} Aura
                        </div>
                        <div className="text-xs text-muted-foreground">
                          +{player.rewards.money} Money
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseGameOver}>
                  Fermer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Play Again Prompt */}
        {russianRoulettePlayAgainPrompt && (
          <PlayAgainPrompt
            open={showPlayAgainPrompt}
            detail="Parametres identiques a la partie precedente"
            players={russianRoulettePlayAgainPrompt.players}
            responses={russianRoulettePlayAgainPrompt.responses}
            timeLimit={russianRoulettePlayAgainPrompt.timeLimit}
            startTime={russianRoulettePlayAgainPrompt.startTime}
            onQuit={() => {
              respondToRussianRoulettePlayAgain(false);
              setHasQuitPlayAgain(true);
            }}
            onPlayAgain={() => respondToRussianRoulettePlayAgain(true)}
          />
        )}

        {/* Lobby / Waiting */}
        {!gameState && !russianRouletteJoinPrompt && (
          <div className="space-y-6">
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Règles du jeu</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Chaque joueur tire à tour de rôle</li>
                <li>• 1 chance sur 6 de perdre à chaque tour</li>
                <li>• Le dernier survivant gagne</li>
                <li>• Plus vous survivez longtemps, plus vous gagnez de récompenses</li>
              </ul>
            </div>

            {isLeader && (
              <div className="flex justify-center">
                <Button size="lg" onClick={handleStartGame} className="gap-2">
                  <Play className="h-5 w-5" />
                  Lancer une partie
                </Button>
              </div>
            )}

            {!isLeader && (
              <div className="text-center text-muted-foreground">
                En attente que le leader lance une partie...
              </div>
            )}
          </div>
        )}

        {/* Active Game */}
        {gameState && gameState.isActive && (
          <div className="space-y-6">
            {/* Round Info */}
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Tour</div>
                  <div className="text-2xl font-bold">{gameState.round}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Joueurs restants</div>
                  <div className="text-2xl font-bold">
                    {gameState.players.filter((p) => p.isAlive).length} / {gameState.players.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Players */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gameState.players.map((player, index) => {
                const isCurrentPlayer = index === gameState.currentPlayerIndex;
                const isMe = player.userId === user?.id;

                return (
                  <div
                    key={player.userId}
                    className={cn(
                      'bg-card border rounded-lg p-4 transition-all',
                      isCurrentPlayer && 'ring-2 ring-primary',
                      !player.isAlive && 'opacity-50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isCurrentPlayer && (
                          <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                        )}
                        <span
                          className="font-semibold"
                          style={player.usernameColor ? { color: player.usernameColor } : {}}
                        >
                          {player.username}
                        </span>
                        {isMe && <span className="text-xs text-muted-foreground">(Vous)</span>}
                      </div>
                      {!player.isAlive && <Skull className="h-5 w-5 text-destructive" />}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {player.roundsSurvived} tour{player.roundsSurvived > 1 ? 's' : ''} survécu
                      {player.roundsSurvived > 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Last Shot Result */}
            {gameState.lastShot && (
              <div
                className={cn(
                  'bg-card border rounded-lg p-4 text-center',
                  gameState.lastShot.fired
                    ? 'border-destructive bg-destructive/10'
                    : 'border-green-500/20 bg-green-500/10'
                )}
              >
                <div className="text-lg font-semibold mb-1">
                  {gameState.lastShot.playerUsername}
                </div>
                <div className={cn('text-2xl font-bold', gameState.lastShot.fired ? 'text-destructive' : 'text-green-500')}>
                  {gameState.lastShot.fired ? '💥 BANG!' : '💨 Click...'}
                </div>
                {gameState.lastShot.fired && (
                  <div className="text-sm text-muted-foreground mt-2">
                    {gameState.lastShot.playerUsername} a été éliminé
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            {isMyTurn && myPlayer?.isAlive && (
              <div className="flex justify-center">
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handlePullTrigger}
                  className="gap-2 text-lg px-8 py-6"
                >
                  <Target className="h-6 w-6" />
                  Tirer
                </Button>
              </div>
            )}

            {!isMyTurn && myPlayer?.isAlive && (
              <div className="text-center text-muted-foreground py-8">
                En attente du tour de {currentPlayer?.username}...
              </div>
            )}

            {!myPlayer?.isAlive && (
              <div className="text-center py-8">
                <div className="text-xl font-semibold text-destructive mb-2">Vous avez été éliminé</div>
                <p className="text-muted-foreground">
                  Vous avez survécu {myPlayer?.roundsSurvived || 0} tour{myPlayer?.roundsSurvived !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  function handleCloseGameOver() {
    clearRussianRouletteGameOver();
  }
}
