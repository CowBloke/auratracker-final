import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ArrowLeft, Play, Heart, Crown, Trophy, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Render word with highlighted prompt letters
function HighlightedWord({ word, prompt }: { word: string; prompt: string }) {
  if (!word || !prompt) return <span className="text-muted-foreground">_</span>;

  const upperWord = word.toUpperCase();
  const upperPrompt = prompt.toUpperCase();
  const promptIndex = upperWord.indexOf(upperPrompt);

  if (promptIndex === -1) {
    return <span>{word}</span>;
  }

  return (
    <span>
      {word.slice(0, promptIndex)}
      <span className="text-yellow-400 font-bold">{word.slice(promptIndex, promptIndex + prompt.length)}</span>
      {word.slice(promptIndex + prompt.length)}
    </span>
  );
}

export default function BombParty() {
  const { user, refreshUser } = useAuth();
  const {
    currentParty,
    partyMembers,
    bombPartyGame,
    bombPartyGameOver,
    bombPartyRejection,
    startBombParty,
    typeBombParty,
    submitBombParty,
    leaveBombParty,
    clearBombPartyGameOver,
  } = useSocket();

  const [lives, setLives] = useState(3);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [localInput, setLocalInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(100);
  const [showSettings, setShowSettings] = useState(false);

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const isMyTurn = bombPartyGame?.currentPlayerId === user?.id;
  const currentPlayer = bombPartyGame?.players[bombPartyGame.currentPlayerIndex];
  const myPlayer = bombPartyGame?.players.find((p) => p.userId === user?.id);

  // Timer countdown
  useEffect(() => {
    if (!bombPartyGame) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - bombPartyGame.turnStartTime;
      const remaining = Math.max(0, 100 - (elapsed / bombPartyGame.turnDuration) * 100);
      setTimeLeft(remaining);
    }, 50);

    return () => clearInterval(interval);
  }, [bombPartyGame?.turnStartTime, bombPartyGame?.turnDuration]);

  // Reset local input when turn changes
  useEffect(() => {
    if (isMyTurn) {
      setLocalInput('');
    }
  }, [isMyTurn, bombPartyGame?.round]);

  // Handle game over - refresh user data for updated balance
  useEffect(() => {
    if (bombPartyGameOver) {
      refreshUser();
    }
  }, [bombPartyGameOver, refreshUser]);

  // Handle keyboard input (direct typing, no text box)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!bombPartyGame || !isMyTurn || myPlayer?.isEliminated) return;

    // Ignore if modifier keys are held
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (localInput.trim()) {
        submitBombParty(localInput.trim());
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const newInput = localInput.slice(0, -1);
      setLocalInput(newInput);
      typeBombParty(newInput);
    } else if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      const newInput = localInput + e.key.toUpperCase();
      setLocalInput(newInput);
      typeBombParty(newInput);
    }
  }, [bombPartyGame, isMyTurn, myPlayer, localInput, submitBombParty, typeBombParty]);

  useEffect(() => {
    if (bombPartyGame && isMyTurn && !myPlayer?.isEliminated) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [bombPartyGame, isMyTurn, myPlayer, handleKeyDown]);

  const handleStartGame = () => {
    startBombParty(lives, difficulty);
    setShowSettings(false);
  };

  const handleCloseGameOver = () => {
    clearBombPartyGameOver();
  };

  // Not in a party - show message
  if (!currentParty) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
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
              Rejoins ou cree une party pour jouer a Bomb Party
            </p>
          </div>
          <Link
            to="/party"
            className="inline-flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            <Users className="h-4 w-4" />
            Aller aux parties
          </Link>
        </div>
      </div>
    );
  }

  // Lobby state (no game active)
  if (!bombPartyGame) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6 space-y-16">
        {/* Players in party */}
        <section className="space-y-4">
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Joueurs dans la party ({partyMembers.length})
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
                    <Crown className="inline-block ml-2 h-4 w-4 text-yellow-500" />
                  )}
                  {member.userId === user?.id && (
                    <span className="ml-2 text-xs text-muted-foreground">(toi)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Start button (leader only) */}
        {isLeader ? (
          <div className="flex justify-center">
            <button
              onClick={() => setShowSettings(true)}
              disabled={partyMembers.length < 2}
              className={cn(
                "flex items-center gap-3 px-8 py-4 text-lg border transition-colors",
                partyMembers.length < 2
                  ? "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  : "border-foreground text-foreground hover:bg-foreground hover:text-background"
              )}
            >
              <Play className="h-5 w-5" />
              Lancer la partie
            </button>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            En attente que le leader lance la partie...
          </div>
        )}

        {partyMembers.length < 2 && (
          <p className="text-center text-muted-foreground text-sm">
            Il faut au moins 2 joueurs pour commencer
          </p>
        )}

        {/* Game Settings Modal */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-normal">Options de partie</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Lives */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Vies</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map((l) => (
                    <button
                      key={l}
                      onClick={() => setLives(l)}
                      className={cn(
                        "flex-1 py-3 border transition-colors",
                        lives === l
                          ? "border-foreground bg-foreground text-background"
                          : "border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground"
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Difficulte</label>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "flex-1 py-3 border transition-colors capitalize",
                        difficulty === d
                          ? "border-foreground bg-foreground text-background"
                          : "border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground"
                      )}
                    >
                      {d === 'easy' ? 'Facile' : d === 'medium' ? 'Moyen' : 'Difficile'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="border-border/30"
              >
                Annuler
              </Button>
              <Button
                onClick={handleStartGame}
                variant="outline"
                className="border-foreground"
              >
                Commencer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


    </div>
    );
  }

  // Get the current display input (my local input if my turn, or the synced input)
  const displayInput = isMyTurn ? localInput : (bombPartyGame?.currentInput || '');

  // Game active
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
      <div className="flex items-center justify-end">
        <button
          onClick={leaveBombParty}
          className="px-4 py-2 text-sm border border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          Quitter
        </button>
      </div>

      {/* Players */}
      <section className="space-y-2">
        <div className="flex flex-wrap gap-4 justify-center">
          {bombPartyGame?.players.map((player, index) => (
            <div
              key={player.userId}
              className={cn(
                "flex flex-col items-center p-4 border transition-all min-w-[120px]",
                player.isEliminated
                  ? "border-border/20 opacity-40"
                  : index === bombPartyGame.currentPlayerIndex
                    ? "border-yellow-500 bg-yellow-500/5 scale-105"
                    : "border-border/30"
              )}
            >
              <span
                className="font-medium text-sm mb-2 truncate max-w-[100px]"
                style={player.usernameColor ? { color: player.usernameColor } : undefined}
              >
                {player.username}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: bombPartyGame.maxLives }).map((_, i) => (
                  <Heart
                    key={i}
                    className={cn(
                      "h-4 w-4",
                      i < player.lives ? "fill-red-500 text-red-500" : "text-border/30"
                    )}
                  />
                ))}
              </div>
              {player.isEliminated && (
                <span className="text-xs text-muted-foreground mt-1">Elimine</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Game Area */}
      <section className="space-y-6 py-8">
        {/* Timer bar */}
        <div className="w-full max-w-lg mx-auto h-2 bg-border/30 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full transition-all duration-100 rounded-full",
              timeLeft > 50 ? "bg-green-500" : timeLeft > 25 ? "bg-yellow-500" : "bg-red-500"
            )}
            style={{ width: `${timeLeft}%` }}
          />
        </div>

        {/* Current prompt */}
        <div className="text-center">
          <div className="inline-block px-10 py-6 border-2 border-yellow-500 bg-yellow-500/5 rounded-lg">
            <span className="text-5xl md:text-7xl font-mono font-bold tracking-widest text-yellow-400">
              {bombPartyGame?.currentPrompt}
            </span>
          </div>
        </div>

        {/* Current input display with highlighted prompt */}
        <div className="text-center min-h-[60px]">
          <span className="text-3xl md:text-4xl font-mono tracking-wide">
            <HighlightedWord
              word={displayInput}
              prompt={bombPartyGame?.currentPrompt || ''}
            />
          </span>
          {isMyTurn && !myPlayer?.isEliminated && (
            <span className="animate-pulse text-3xl md:text-4xl">|</span>
          )}
        </div>

        {/* Rejection message */}
        {bombPartyRejection && (
          <div className="text-center text-red-500 text-sm animate-pulse">
            {bombPartyRejection}
          </div>
        )}

        {/* Status message */}
        {isMyTurn && !myPlayer?.isEliminated ? (
          <div className="text-center text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Ton tour!</span> Tape un mot contenant <span className="text-yellow-400 font-bold">{bombPartyGame?.currentPrompt}</span> puis appuie sur Entree
          </div>
        ) : myPlayer?.isEliminated ? (
          <div className="text-center text-muted-foreground py-4">
            Tu as ete elimine. Tu regardes la partie...
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            C'est le tour de <span className="text-foreground font-medium">{currentPlayer?.username}</span>
          </div>
        )}
      </section>

      {/* Used words */}
      {bombPartyGame && bombPartyGame.usedWords.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm text-muted-foreground tracking-wide uppercase">
            Mots utilises ({bombPartyGame.usedWords.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {bombPartyGame.usedWords.slice(-20).map((word, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs border border-border/30 text-muted-foreground rounded"
              >
                {word}
              </span>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!bombPartyGameOver} onOpenChange={handleCloseGameOver}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Partie terminee
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {bombPartyGameOver?.winnerId && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Gagnant</p>
                <p className="text-2xl font-light">{bombPartyGameOver.winnerUsername}</p>
              </div>
            )}

            <div className="space-y-2">
              {bombPartyGameOver?.players.map((player) => (
                <div
                  key={player.userId}
                  className={cn(
                    "flex items-center justify-between py-3 px-3 border rounded",
                    player.isWinner
                      ? "border-yellow-500/50 bg-yellow-500/5"
                      : "border-border/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {player.isWinner && <Trophy className="h-4 w-4 text-yellow-500" />}
                    <span className="font-medium">{player.username}</span>
                    <span className="text-xs text-muted-foreground">
                      ({player.wordsTypedCount} mots)
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {player.rewards.aura > 0 && (
                      <span className="text-purple-400">+{player.rewards.aura} aura </span>
                    )}
                    {player.rewards.money > 0 && (
                      <span className="text-green-400">+{player.rewards.money}$</span>
                    )}
                  </div>
                </div>
              ))}
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
    </div>
  );
}
