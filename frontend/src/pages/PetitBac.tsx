import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePartySocket } from '../contexts/PartySocketContext';
import { useGameSocket } from '../contexts/GameSocketContext';
import { ArrowLeft, Users, Play, Send, LogOut, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';

const DEFAULT_CATEGORIES = ['Prenom', 'Ville', 'Pays', 'Animal', 'Objet', 'Metier'];

export default function PetitBac() {
  const { user } = useAuth();
  const { currentParty, partyMembers } = usePartySocket();
  const { petitBacGame, petitBacReviewState, petitBacRoundResult, petitBacGameOver, startPetitBac, submitPetitBac, submitPetitBacReview, leavePetitBac, clearPetitBacGameOver } = useGameSocket();

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const myPlayer = petitBacGame?.players.find((p) => p.userId === user?.id);

  const [rounds, setRounds] = useState(5);
  const [roundDuration, setRoundDuration] = useState(60);
  const [categoriesInput, setCategoriesInput] = useState(DEFAULT_CATEGORIES.join(', '));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reviewVotes, setReviewVotes] = useState<Record<string, Record<string, boolean>>>({});
  const [timeLeft, setTimeLeft] = useState(0);

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
    if (!petitBacReviewState || !user) return;
    const myAssignments = petitBacReviewState.reviewAssignments.find((entry) => entry.reviewerId === user.id)?.targets || [];
    const nextVotes: Record<string, Record<string, boolean>> = {};
    for (const assignment of myAssignments) {
      nextVotes[assignment.playerId] = nextVotes[assignment.playerId] || {};
      nextVotes[assignment.playerId][assignment.category] = true;
    }
    setReviewVotes(nextVotes);
  }, [petitBacReviewState, user?.id]);

  const myReviewAssignments = useMemo(() => {
    if (!petitBacReviewState || !user) return [];
    return petitBacReviewState.reviewAssignments.find((entry) => entry.reviewerId === user.id)?.targets || [];
  }, [petitBacReviewState, user?.id]);

  const myPendingReviewCount = useMemo(() => {
    return myReviewAssignments.filter((assignment) => typeof reviewVotes[assignment.playerId]?.[assignment.category] !== 'boolean').length;
  }, [myReviewAssignments, reviewVotes]);

  const hasSubmittedReview = !!(user && petitBacReviewState?.completedReviewerIds.includes(user.id));

  const handleStart = () => {
    const safeRounds = Math.min(Math.max(rounds, 1), 10);
    const safeDuration = Math.min(Math.max(roundDuration, 15), 120);
    startPetitBac(safeRounds, safeDuration * 1000, categories.length > 0 ? categories : DEFAULT_CATEGORIES);
  };

  const handleSubmit = () => {
    if (!petitBacGame || petitBacGame.phase !== 'playing') return;
    submitPetitBac(answers);
  };

  const handleSubmitReview = () => {
    if (!petitBacGame || petitBacGame.phase !== 'review' || myPendingReviewCount > 0 || hasSubmittedReview) return;
    submitPetitBacReview(reviewVotes);
  };

  const playAgainModals = (
    <>
      <Dialog open={!!petitBacGameOver} onOpenChange={clearPetitBacGameOver}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Fin de partie
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              Gagnant{(petitBacGameOver?.winnerUsernames.length || 0) > 1 ? 's' : ''} :
              <span className="text-foreground ml-2">
                {petitBacGameOver?.winnerUsernames.join(', ') || '-'}
              </span>
            </div>
            <div className="space-y-2">
              {petitBacGameOver?.players.map((player) => (
                <div key={player.userId} className="flex items-center justify-between text-sm">
                  <UsernameDisplay username={player.username} />
                  <span className="text-muted-foreground">{player.score}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={clearPetitBacGameOver} className="w-full">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (!currentParty) {
    return (
      <PageShell>
        <PageHeader
          title="Petit Bac"
          description="Remplis les catégories avec la bonne lettre avant la fin du chrono."
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
          <CardContent className="py-14 text-center space-y-6">
            <p className="text-sm text-muted-foreground">
              Rejoins ou cree une party pour jouer au Petit Bac
            </p>
            <Button asChild>
              <Link to="/party" className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                Aller aux parties
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!petitBacGame) {
    return (
      <PageShell>
        <PageHeader
          title="Petit Bac"
          description={`Party: ${currentParty.name || 'Sans nom'}`}
          actions={(
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/games" className="inline-flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Jeux
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={leavePetitBac} className="gap-2">
                <LogOut className="h-4 w-4" />
                Quitter
              </Button>
            </>
          )}
        />

        <Card>
          <CardContent className="p-6 grid gap-6">

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs   text-muted-foreground">Manches</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={rounds}
                onChange={(e) => setRounds(parseInt(e.target.value || '1', 10))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs   text-muted-foreground">Temps (s)</label>
              <Input
                type="number"
                min={15}
                max={120}
                value={roundDuration}
                onChange={(e) => setRoundDuration(parseInt(e.target.value || '60', 10))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs   text-muted-foreground">Categories</label>
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
          </div>
          </CardContent>
        </Card>

      {playAgainModals}
    </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Petit Bac"
        description={`Party: ${currentParty.name || 'Sans nom'}`}
        actions={(
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={leavePetitBac} className="gap-2">
              <LogOut className="h-4 w-4" />
              Quitter
            </Button>
          </>
        )}
      />

      <Card>
        <CardContent className="p-6 grid gap-6">
          <div className="flex flex-wrap items-center gap-6">
          <div className="text-xs   text-muted-foreground">
            Manche {petitBacGame.round}/{petitBacGame.maxRounds}
          </div>
          <div className="text-6xl font-light tracking-tight">
            {petitBacGame.currentLetter}
          </div>
          <div className="text-sm text-muted-foreground">
            {petitBacGame.phase === 'playing' ? `${timeLeft}s` : petitBacGame.phase === 'review' ? 'Verification' : 'Scores'}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            {petitBacGame.phase === 'playing' ? (
              <>
                {petitBacGame.categories.map((category) => (
                  <div key={category} className="grid gap-2">
                    <label className="text-xs   text-muted-foreground">
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
              </>
            ) : petitBacGame.phase === 'review' && petitBacReviewState ? (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  Verifie les reponses des autres joueurs. Une reponse compte seulement si tous les autres la valident.
                </div>
                {petitBacReviewState.submissions
                  .filter((submission) => submission.userId !== user?.id)
                  .map((submission) => (
                    <div key={submission.userId} className="rounded-lg border p-4 space-y-3">
                      <UsernameDisplay username={submission.username} className="font-medium" />
                      <div className="grid gap-2">
                        {petitBacReviewState.categories.map((category) => {
                          const rawValue = submission.answers[category] || '';
                          const needsReview = myReviewAssignments.some((assignment) => assignment.playerId === submission.userId && assignment.category === category);
                          const selectedVote = reviewVotes[submission.userId]?.[category];

                          return (
                            <div key={category} className="rounded border border-border/50 p-3 space-y-2">
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-muted-foreground">{category}</span>
                                <span>{rawValue || '—'}</span>
                              </div>
                              {needsReview ? (
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={selectedVote ? 'default' : 'outline'}
                                    onClick={() => setReviewVotes((prev) => ({
                                      ...prev,
                                      [submission.userId]: { ...(prev[submission.userId] || {}), [category]: true },
                                    }))}
                                    disabled={hasSubmittedReview}
                                  >
                                    Valide
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={selectedVote === false ? 'destructive' : 'outline'}
                                    onClick={() => setReviewVotes((prev) => ({
                                      ...prev,
                                      [submission.userId]: { ...(prev[submission.userId] || {}), [category]: false },
                                    }))}
                                    disabled={hasSubmittedReview}
                                  >
                                    Refuse
                                  </Button>
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  Pas de validation necessaire.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                <Button
                  onClick={handleSubmitReview}
                  disabled={hasSubmittedReview || myPendingReviewCount > 0}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {hasSubmittedReview ? 'Verification envoyee' : 'Envoyer ma verification'}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="text-xs   text-muted-foreground">Scores</div>
            <div className="space-y-2">
              {petitBacGame.players.map((player) => (
                <div
                  key={player.userId}
                  className="flex items-center justify-between border rounded px-3 py-2"
                >
                  <span className={cn('text-sm', player.userId === user?.id && 'font-medium')}>
                    <UsernameDisplay username={player.username} usernameColor={player.usernameColor} />
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{player.score}</span>
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        petitBacGame.phase === 'review'
                          ? petitBacReviewState?.completedReviewerIds.includes(player.userId)
                            ? 'bg-green-500'
                            : 'bg-yellow-500'
                          : player.submitted
                            ? 'bg-green-500'
                            : 'bg-yellow-500'
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
            {petitBacGame.phase === 'review' && (
              <div className="text-xs text-muted-foreground">
                Verifications: {petitBacGame.reviewProgress.completed}/{petitBacGame.reviewProgress.total}
              </div>
            )}
          </div>
        </div>

        {petitBacRoundResult && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="text-xs   text-muted-foreground">
              Resultats manche {petitBacRoundResult.round}
            </div>
            <div className="grid gap-3">
              {petitBacRoundResult.submissions.map((submission) => (
                <div key={submission.userId} className="border border-border/30 rounded p-3">
                  <div className="flex items-center justify-between text-sm">
                    <UsernameDisplay username={submission.username} className="font-medium" />
                    <span className="text-muted-foreground">
                      +{submission.score} / {submission.totalScore}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                    {petitBacRoundResult.categories.map((category) => (
                      <div key={category} className="flex items-center justify-between">
                        <span>{category}</span>
                        <span>
                          {submission.answers[category] || '—'} · {submission.perCategoryScores[category] ?? 0}
                          {' · '}
                          {submission.validationStatus[category] === 'accepted'
                            ? 'valide'
                            : submission.validationStatus[category] === 'rejected'
                              ? 'refuse'
                              : 'hors lettre'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </CardContent>
      </Card>

      {playAgainModals}
    </PageShell>
  );
}
