import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Coins, Play, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGameSocket } from '@/contexts/GameSocketContext';
import { usePartySocket } from '@/contexts/PartySocketContext';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';

const REWARD_LINES = [
  { matches: 2, money: 25, aura: 1 },
  { matches: 3, money: 70, aura: 3 },
  { matches: 4, money: 180, aura: 7 },
  { matches: 5, money: 450, aura: 18 },
];

const DEFAULT_PICK = ['0', '0', '0', '0', '0'];

const formatCombo = (digits: Array<number | string> | null | undefined) =>
  digits && digits.length ? digits.join(' ') : 'Aucune';

export default function Jackpot5() {
  const { user } = useAuth();
  const { currentParty, partyMembers } = usePartySocket();
  const {
    jackpot5Game,
    jackpot5GameOver,
    jackpot5PlayAgainPrompt,
    startJackpot5,
    submitJackpot5,
    respondToJackpot5PlayAgainPrompt,
    clearJackpot5GameOver,
  } = useGameSocket();

  const [pick, setPick] = useState<string[]>(DEFAULT_PICK);
  const [pickLocked, setPickLocked] = useState(false);
  const [playAgainResponded, setPlayAgainResponded] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(0);

  const myUserId = user?.id ?? '';
  const isLeader = partyMembers.some((member) => member.userId === myUserId && member.isLeader);
  const hasSubmitted = jackpot5Game?.submittedUserIds.includes(myUserId) ?? false;

  useEffect(() => {
    if (!jackpot5Game) {
      setPickLocked(false);
      return;
    }

    setPickLocked(hasSubmitted);
  }, [jackpot5Game, hasSubmitted]);

  useEffect(() => {
    if (!jackpot5Game?.pickDeadline) {
      setTimeLeftMs(0);
      return;
    }

    const update = () => {
      setTimeLeftMs(Math.max(0, jackpot5Game.pickDeadline - Date.now()));
    };

    update();
    const interval = window.setInterval(update, 200);
    return () => window.clearInterval(interval);
  }, [jackpot5Game?.pickDeadline]);

  useEffect(() => {
    if (jackpot5PlayAgainPrompt) {
      setPlayAgainResponded(false);
    }
  }, [jackpot5PlayAgainPrompt]);

  const orderedResults = useMemo(
    () => jackpot5GameOver?.results ?? jackpot5PlayAgainPrompt?.results ?? [],
    [jackpot5GameOver?.results, jackpot5PlayAgainPrompt?.results],
  );

  const draw = jackpot5GameOver?.draw ?? jackpot5PlayAgainPrompt?.draw ?? null;

  const handleChangeDigit = (index: number, value: string) => {
    setPick((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = () => {
    submitJackpot5(pick.map((digit) => Number(digit)));
    setPickLocked(true);
  };

  const handlePlayAgain = (playAgain: boolean) => {
    respondToJackpot5PlayAgainPrompt(playAgain);
    setPlayAgainResponded(true);
  };

  if (!currentParty) {
    return (
      <PageShell>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/games"><ArrowLeft size={18} /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Jackpot 5</h1>
            <p className="text-sm text-muted-foreground">Un tirage commun, 5 chiffres, des gains selon les bons numéros.</p>
          </div>
        </div>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <p className="max-w-md text-sm text-muted-foreground">
            Tu dois être dans une party pour jouer à Jackpot 5.
          </p>
          <Button variant="outline" asChild>
            <Link to="/party">Ouvrir la party</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/games"><ArrowLeft size={18} /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Jackpot 5</h1>
            <p className="text-sm text-muted-foreground">
              Choisis 5 chiffres entre 0 et 9. Les correspondances comptent même dans un ordre différent.
            </p>
          </div>
        </div>

        {!jackpot5Game && !jackpot5GameOver && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Lobby
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Chaque joueur valide une grille de 5 chiffres. Une combinaison est tirée, puis chacun reçoit ses récompenses selon le nombre de chiffres présents dans le tirage.
                </p>
                <div className="flex flex-wrap gap-2">
                  {partyMembers.map((member) => (
                    <div key={member.userId} className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                      <UsernameDisplay username={member.username} usernameColor={member.usernameColor} usernameClassName="font-medium" />
                      {member.isLeader && <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Leader</span>}
                    </div>
                  ))}
                </div>
                {isLeader ? (
                  <Button onClick={startJackpot5} className="gap-2">
                    <Play className="h-4 w-4" />
                    Lancer Jackpot 5
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">En attente du leader pour lancer la manche.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Récompenses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {REWARD_LINES.map((line) => (
                  <div key={line.matches} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                    <span>{line.matches} chiffres corrects</span>
                    <span className="font-medium">+{line.money}$ · +{line.aura} aura</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  0 ou 1 bon chiffre: pas de gain. Les doublons sont autorisés.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {jackpot5Game && (
          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <Card className="border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
              <CardHeader>
                <CardTitle>Compose ta grille</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {jackpot5Game.submittedUserIds.length}/{jackpot5Game.players.length} validations
                  </span>
                  <span className={cn('font-medium', timeLeftMs < 10000 && 'text-destructive')}>
                    {Math.ceil(timeLeftMs / 1000)}s restantes
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-3">
                  {pick.map((digit, index) => (
                    <Select
                      key={index}
                      value={digit}
                      onValueChange={(value) => handleChangeDigit(index, value)}
                      disabled={pickLocked}
                    >
                      <SelectTrigger className="h-14 text-lg font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, value) => (
                          <SelectItem key={value} value={String(value)}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={handleSubmit} disabled={pickLocked}>
                    {pickLocked ? 'Grille validée' : 'Valider ma combinaison'}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {pickLocked ? 'Ta grille est verrouillée pour ce tirage.' : 'Tu peux choisir n’importe quelle combinaison de 5 chiffres.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Joueurs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {jackpot5Game.players.map((player) => {
                  const submitted = jackpot5Game.submittedUserIds.includes(player.userId);
                  return (
                    <div key={player.userId} className="flex items-center justify-between rounded-lg border bg-muted/25 px-3 py-3">
                      <div className="text-sm">
                        <UsernameDisplay username={player.username} usernameColor={player.usernameColor} usernameClassName="font-medium" />
                      </div>
                      <span className={cn('text-xs font-medium uppercase tracking-[0.18em]', submitted ? 'text-emerald-500' : 'text-muted-foreground')}>
                        {submitted ? 'Validé' : 'En attente'}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {!jackpot5Game && orderedResults.length > 0 && draw && (
          <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
            <Card>
              <CardHeader>
                <CardTitle>Tirage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {draw.map((digit, index) => (
                    <div key={`${digit}-${index}`} className="flex h-12 w-12 items-center justify-center rounded-xl border bg-primary/10 text-lg font-semibold">
                      {digit}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Les chiffres sont comparés comme une combinaison: seul le total de bons chiffres compte.
                </p>
                {jackpot5PlayAgainPrompt && !playAgainResponded && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Rejouer ? {jackpot5PlayAgainPrompt.responses.filter((response) => response.playAgain).length} joueur(x) prêt(s).
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={() => handlePlayAgain(true)}>Rejouer</Button>
                      <Button variant="outline" onClick={() => handlePlayAgain(false)}>Quitter</Button>
                    </div>
                  </div>
                )}
                {playAgainResponded && (
                  <p className="text-sm text-muted-foreground">Ta réponse est prise en compte, on attend les autres.</p>
                )}
                {!jackpot5PlayAgainPrompt && (
                  <Button variant="outline" onClick={clearJackpot5GameOver}>Fermer</Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Résultats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {orderedResults.map((result) => (
                  <div key={result.userId} className={cn('rounded-xl border px-4 py-3', result.isWinner ? 'border-primary/40 bg-primary/5' : 'bg-muted/20')}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <UsernameDisplay username={result.username} usernameColor={result.usernameColor} usernameClassName="font-medium" />
                        <p className="text-xs text-muted-foreground">Grille: {formatCombo(result.pick)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{result.matches} bon{result.matches > 1 ? 's' : ''} chiffre{result.matches > 1 ? 's' : ''}</p>
                        <p className="text-xs text-muted-foreground">+{result.moneyReward}$ · +{result.auraReward} aura</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}
