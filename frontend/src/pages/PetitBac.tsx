import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ArrowLeft, Users, Play, Send, LogOut, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const DEFAULT_CATEGORIES = ['Prenom', 'Ville', 'Pays', 'Animal', 'Objet', 'Metier'];

export default function PetitBac() {
  const { user } = useAuth();
  const {
    currentParty,
    partyMembers,
    petitBacGame,
    petitBacRoundResult,
    petitBacPlayAgainPrompt,
    startPetitBac,
    submitPetitBac,
    leavePetitBac,
    respondToPetitBacPlayAgainPrompt,
  } = useSocket();

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const myPlayer = petitBacGame?.players.find((p) => p.userId === user?.id);

  const [rounds, setRounds] = useState(5);
  const [roundDuration, setRoundDuration] = useState(60);
  const [categoriesInput, setCategoriesInput] = useState(DEFAULT_CATEGORIES.join(', '));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [playAgainTimeLeft, setPlayAgainTimeLeft] = useState(100);
  const [hasRespondedPlayAgain, setHasRespondedPlayAgain] = useState(false);

  const categories = useMemo(() => {
    return categoriesInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }, [categoriesInput]);

  useEffect(() => {
    if (!petitBacGame || petitBacGame.phase !== 'playing') return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - petitBacGame.roundStartTime;
      const remainingMs = Math.max(0, petitBacGame.roundDuration - elapsed);
      setTimeLeft(Math.ceil(remainingMs / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [petitBacGame?.roundStartTime, petitBacGame?.roundDuration, petitBacGame?.phase]);

  useEffect(() => {
    if (!petitBacGame || petitBacGame.phase !== 'playing') return;
    const nextAnswers: Record<string, string> = {};
    for (const category of petitBacGame.categories) {
      nextAnswers[category] = '';
    }
    setAnswers(nextAnswers);
  }, [petitBacGame?.roundStartTime, petitBacGame?.categories, petitBacGame?.phase]);

  useEffect(() => {
    if (!petitBacPlayAgainPrompt) return;
    setHasRespondedPlayAgain(false);
  }, [petitBacPlayAgainPrompt]);

  useEffect(() => {
    if (!petitBacPlayAgainPrompt) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - petitBacPlayAgainPrompt.startTime;
      const remaining = Math.max(0, 100 - (elapsed / petitBacPlayAgainPrompt.timeLimit) * 100);
      setPlayAgainTimeLeft(remaining);
    }, 50);

    return () => clearInterval(interval);
  }, [petitBacPlayAgainPrompt?.startTime, petitBacPlayAgainPrompt?.timeLimit]);

  const handleStart = () => {
    const safeRounds = Math.min(Math.max(rounds, 1), 10);
    const safeDuration = Math.min(Math.max(roundDuration, 15), 120);
    startPetitBac(safeRounds, safeDuration * 1000, categories.length > 0 ? categories : DEFAULT_CATEGORIES);
  };

  const handleSubmit = () => {
    if (!petitBacGame || petitBacGame.phase !== 'playing') return;
    submitPetitBac(answers);
  };

  const handlePlayAgain = (playAgain: boolean) => {
    respondToPetitBacPlayAgainPrompt(playAgain);
    setHasRespondedPlayAgain(true);
  };

  const myPlayAgainResponse = petitBacPlayAgainPrompt?.responses.find((r) => r.userId === user?.id);
  const hasAlreadyResponded = hasRespondedPlayAgain || !!myPlayAgainResponse;

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
              Rejoins ou cree une party pour jouer au Petit Bac
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

  if (!petitBacGame) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
        <Link
          to="/games"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Jeux
        </Link>

        <div className="grid gap-6">
          <div className="text-sm text-muted-foreground">
            Party: <span className="text-foreground">{currentParty.name || 'Sans nom'}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Manches</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={rounds}
                onChange={(e) => setRounds(parseInt(e.target.value || '1', 10))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Temps (s)</label>
              <Input
                type="number"
                min={15}
                max={120}
                value={roundDuration}
                onChange={(e) => setRoundDuration(parseInt(e.target.value || '60', 10))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Categories</label>
              <Input
                value={categoriesInput}
                onChange={(e) => setCategoriesInput(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isLeader ? (
              <Button onClick={handleStart} className="gap-2">
                <Play className="h-4 w-4" />
                Lancer
              </Button>
            ) : (
              <div className="text-sm text-muted-foreground">
                En attente du leader pour lancer.
              </div>
            )}
            <Button variant="outline" onClick={leavePetitBac} className="gap-2">
              <LogOut className="h-4 w-4" />
              Quitter
            </Button>
          </div>
        </div>

        <Dialog open={!!petitBacPlayAgainPrompt} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md" hideCloseButton>
            <DialogHeader>
              <DialogTitle className="font-normal flex items-center gap-2">
                Fin de partie
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="text-sm text-muted-foreground">
                Gagnant{(petitBacPlayAgainPrompt?.gameOverData.winnerUsernames.length || 0) > 1 ? 's' : ''} :
                <span className="text-foreground ml-2">
                  {petitBacPlayAgainPrompt?.gameOverData.winnerUsernames.join(', ') || '—'}
                </span>
              </div>
              <div className="space-y-2">
                {petitBacPlayAgainPrompt?.gameOverData.players.map((player) => {
                  const response = petitBacPlayAgainPrompt.responses.find((r) => r.userId === player.userId);
                  return (
                    <div key={player.userId} className="flex items-center justify-between text-sm">
                      <span>{player.username}</span>
                      <span className="text-muted-foreground">
                        {player.score}
                        {response ? (response.playAgain ? ' · rejoue' : ' · quitte') : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-foreground" style={{ width: `${playAgainTimeLeft}%` }} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              {!hasAlreadyResponded ? (
                <>
                  <Button variant="outline" onClick={() => handlePlayAgain(false)} className="flex-1 gap-2">
                    <LogOut className="h-4 w-4" />
                    Quitter
                  </Button>
                  <Button onClick={() => handlePlayAgain(true)} className="flex-1 gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Rejouer
                  </Button>
                </>
              ) : (
                <div className="w-full text-center text-sm text-muted-foreground">
                  En attente des autres...
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
      <div className="flex items-center justify-between">
        <Link
          to="/games"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Jeux
        </Link>
        <Button variant="outline" onClick={leavePetitBac} className="gap-2">
          <LogOut className="h-4 w-4" />
          Quitter
        </Button>
      </div>

      <div className="grid gap-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Manche {petitBacGame.round}/{petitBacGame.maxRounds}
          </div>
          <div className="text-6xl font-light tracking-tight">
            {petitBacGame.currentLetter}
          </div>
          <div className="text-sm text-muted-foreground">
            {petitBacGame.phase === 'playing' ? `${timeLeft}s` : 'Scores'}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            {petitBacGame.categories.map((category) => (
              <div key={category} className="grid gap-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  {category}
                </label>
                <Input
                  value={answers[category] || ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [category]: e.target.value }))}
                  disabled={petitBacGame.phase !== 'playing' || myPlayer?.submitted}
                />
              </div>
            ))}
            <Button
              onClick={handleSubmit}
              disabled={petitBacGame.phase !== 'playing' || myPlayer?.submitted}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Valider
            </Button>
          </div>

          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Scores</div>
            <div className="space-y-2">
              {petitBacGame.players.map((player) => (
                <div
                  key={player.userId}
                  className="flex items-center justify-between border border-border/40 rounded px-3 py-2"
                >
                  <span
                    className={cn('text-sm', player.userId === user?.id && 'font-medium')}
                    style={player.usernameColor ? { color: player.usernameColor } : undefined}
                  >
                    {player.username}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{player.score}</span>
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        player.submitted ? 'bg-green-500' : 'bg-yellow-500'
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {petitBacRoundResult && (
          <div className="border border-border/40 rounded-lg p-4 space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Resultats manche {petitBacRoundResult.round}
            </div>
            <div className="grid gap-3">
              {petitBacRoundResult.submissions.map((submission) => (
                <div key={submission.userId} className="border border-border/30 rounded p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{submission.username}</span>
                    <span className="text-muted-foreground">
                      +{submission.score} / {submission.totalScore}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                    {petitBacRoundResult.categories.map((category) => (
                      <div key={category} className="flex items-center justify-between">
                        <span>{category}</span>
                        <span>{submission.answers[category] || '—'} · {submission.perCategoryScores[category] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
