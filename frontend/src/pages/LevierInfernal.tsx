import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Flame, Play, Trophy, Users, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartySocket } from '@/contexts/PartySocketContext';
import { useGameSocket } from '@/contexts/GameSocketContext';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';

const leverButtonGradients = [
  'from-red-400 via-red-500 to-red-700',
  'from-pink-300 via-fuchsia-400 to-fuchsia-600',
  'from-amber-300 via-yellow-400 to-orange-500',
  'from-emerald-300 via-green-400 to-green-600',
  'from-sky-300 via-cyan-400 to-blue-600',
];

const formatCountdown = (ms: number) => {
  if (ms <= 0) return '0.0';
  return (ms / 1000).toFixed(1);
};

export default function LevierInfernal() {
  const { user } = useAuth();
  const { currentParty, partyMembers } = usePartySocket();
  const {
    leverBlastGame,
    leverBlastGameOver,
    leverBlastPlayAgainPrompt,
    startLeverBlast,
    pullLeverBlastLever,
    respondToLeverBlastPlayAgainPrompt,
    clearLeverBlastGameOver,
  } = useGameSocket();

  const [countdownMs, setCountdownMs] = useState(0);
  const [playAgainResponded, setPlayAgainResponded] = useState(false);

  useEffect(() => {
    if (!leverBlastGame?.turnEndsAt) {
      setCountdownMs(0);
      return;
    }

    const updateCountdown = () => setCountdownMs(Math.max(0, leverBlastGame.turnEndsAt - Date.now()));
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 100);
    return () => window.clearInterval(interval);
  }, [leverBlastGame?.turnEndsAt]);

  useEffect(() => {
    setPlayAgainResponded(false);
  }, [leverBlastPlayAgainPrompt?.startTime]);

  const isLeader = partyMembers.find((member) => member.userId === user?.id)?.isLeader ?? false;
  const myPlayer = leverBlastGame?.players.find((player) => player.userId === user?.id) ?? null;
  const myResponse = leverBlastPlayAgainPrompt?.responses.find((response) => response.userId === user?.id);
  const isMyTurn = leverBlastGame?.currentPlayerId === user?.id;
  const alivePlayers = useMemo(
    () => leverBlastGame?.players.filter((player) => player.isAlive) ?? [],
    [leverBlastGame?.players],
  );

  const lastEventText = useMemo(() => {
    if (!leverBlastGame?.lastEvent) return 'Tire un levier, serre les dents, et espère éviter l’explosion.';
    const { lastEvent } = leverBlastGame;
    if (lastEvent.type === 'safe') return `${lastEvent.username} a survécu avec le levier ${lastEvent.leverColor.toLowerCase()}.`;
    if (lastEvent.type === 'auto-safe') return `${lastEvent.username} a trop tardé: le levier ${lastEvent.leverColor.toLowerCase()} a été tiré automatiquement et c’était safe.`;
    if (lastEvent.type === 'auto-boom') return `${lastEvent.username} a laissé le chrono filer. Le levier ${lastEvent.leverColor.toLowerCase()} a explosé tout seul.`;
    return `${lastEvent.username} a déclenché l’explosion avec le levier ${lastEvent.leverColor.toLowerCase()}.`;
  }, [leverBlastGame?.lastEvent]);

  if (!currentParty) {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <Link to="/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Retour aux jeux
          </Link>
          <div className="rounded-3xl border border-border/50 bg-card p-8 text-center">
            <p className="text-lg font-semibold">Levier Infernal se joue en party.</p>
            <p className="mt-2 text-sm text-muted-foreground">Crée ou rejoins une party avant de lancer la manche.</p>
            <Button asChild className="mt-6">
              <Link to="/party">Aller à la party</Link>
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-red-200">
              <Flame className="h-3.5 w-3.5" />
              Party Mario-like
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Levier Infernal</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Chacun choisit un levier. L’un d’eux déclenche l’explosion. Le dernier survivant gagne la manche et ajoute une victoire à ses stats.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/party">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour party
              </Link>
            </Button>
            {isLeader && !leverBlastGame && !leverBlastPlayAgainPrompt && (
              <Button onClick={startLeverBlast}>
                <Play className="mr-2 h-4 w-4" />
                Lancer
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
          <section className="overflow-hidden rounded-[28px] border border-red-500/20 bg-[radial-gradient(circle_at_top,#7f1d1d_0%,#2a0a0a_35%,#130607_100%)] p-5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-red-200/80">Arène</p>
                <p className="mt-1 text-sm text-red-100/80">{lastEventText}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
                <p className="text-[11px] uppercase tracking-[0.24em] text-red-100/60">Round</p>
                <p className="text-2xl font-semibold">{leverBlastGame?.round ?? 0}</p>
              </div>
            </div>

            <div className="relative mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-black/20 p-6">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-orange-300/10 via-transparent to-transparent" />
              <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
                <div className="text-center">
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-orange-300/20 bg-[radial-gradient(circle,#f97316_0%,#991b1b_55%,#3f0b0c_100%)] shadow-[0_0_60px_rgba(249,115,22,0.3)]">
                    <Zap className="h-10 w-10 text-yellow-100" />
                  </div>
                  <p className="mt-4 text-lg font-semibold">
                    {leverBlastGame?.currentPlayerId
                      ? <>
                          Tour de{' '}
                          <UsernameDisplay
                            username={leverBlastGame.players.find((player) => player.userId === leverBlastGame.currentPlayerId)?.username ?? '...'}
                            usernameColor={leverBlastGame.players.find((player) => player.userId === leverBlastGame.currentPlayerId)?.usernameColor}
                            usernameClassName="font-semibold"
                          />
                        </>
                      : 'En attente de joueurs'}
                  </p>
                  <p className="mt-2 text-sm text-red-100/75">
                    {leverBlastGame
                      ? `${leverBlastGame.alivePlayers} survivants • ${formatCountdown(countdownMs)}s`
                      : 'Le boss attend sa victime.'}
                  </p>
                </div>

                <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-5">
                  {(leverBlastGame?.levers ?? Array.from({ length: 5 }, (_, id) => ({ id, color: '', isPulled: false }))).map((lever, index) => {
                    const disabled = !leverBlastGame || lever.isPulled || !isMyTurn || !myPlayer?.isAlive;
                    return (
                      <button
                        key={lever.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => pullLeverBlastLever(lever.id)}
                        className={cn(
                          'group relative overflow-hidden rounded-[22px] border border-white/10 px-4 pb-5 pt-4 text-left transition-all duration-200',
                          lever.isPulled
                            ? 'scale-[0.98] bg-white/10 opacity-45'
                            : disabled
                              ? 'bg-black/20 opacity-60'
                              : 'bg-black/25 hover:-translate-y-1 hover:border-orange-200/50 hover:bg-black/35',
                        )}
                      >
                        <div className={cn('mx-auto h-24 w-4 rounded-full bg-gradient-to-b shadow-[0_10px_20px_rgba(0,0,0,0.25)] transition-transform duration-200 group-hover:translate-y-1', leverButtonGradients[index % leverButtonGradients.length], lever.isPulled && 'translate-y-8')} />
                        <div className="mt-4 rounded-2xl bg-black/20 px-3 py-2">
                          <p className="text-xs uppercase tracking-[0.24em] text-red-100/60">Levier</p>
                          <p className="mt-1 text-sm font-semibold">{lever.color || `#${lever.id + 1}`}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!myPlayer?.isAlive && (
                  <div className="rounded-2xl border border-red-300/20 bg-red-950/40 px-4 py-3 text-sm text-red-100/85">
                    Tu as explosé. Tu peux maintenant regarder le reste de la manche et voter pour un replay.
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[24px] border border-border/50 bg-card p-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Joueurs</p>
              </div>
              <div className="mt-4 space-y-3">
                {(leverBlastGame?.players ?? partyMembers.map((member) => ({
                  userId: member.userId,
                  username: member.username,
                  usernameColor: member.usernameColor,
                  isAlive: true,
                  pulls: 0,
                  safePulls: 0,
                  explodedAtRound: null,
                }))).map((player) => (
                  <div
                    key={player.userId}
                    className={cn(
                      'flex items-center justify-between rounded-2xl border px-3 py-3',
                      leverBlastGame?.currentPlayerId === player.userId
                        ? 'border-orange-400/30 bg-orange-500/10'
                        : 'border-border/50 bg-muted/20',
                    )}
                  >
                    <div>
                      <UsernameDisplay username={player.username} usernameColor={player.usernameColor} usernameClassName="font-medium" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {player.isAlive ? `${player.safePulls} safe · ${player.pulls} tirages` : `Explosé au round ${player.explodedAtRound ?? '?'}`}
                      </p>
                    </div>
                    <div className={cn('h-2.5 w-2.5 rounded-full', player.isAlive ? 'bg-emerald-400' : 'bg-red-500')} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-border/50 bg-card p-5">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Fin de manche</p>
              </div>
              {!leverBlastGameOver ? (
                <p className="mt-4 text-sm text-muted-foreground">Le classement final apparaîtra ici, comptabilisé en victoires totales pour le gagnant.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Vainqueur</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-50">{leverBlastGameOver.winnerUsername ?? 'Personne'}</p>
                  </div>
                  {leverBlastGameOver.standings.map((player, index) => (
                    <div key={player.userId} className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/20 px-3 py-3">
                      <div>
                        <p className="text-sm font-medium">#{index + 1} <UsernameDisplay username={player.username} usernameColor={player.usernameColor} usernameClassName="font-medium" /></p>
                        <p className="mt-1 text-xs text-muted-foreground">{player.safePulls} leviers sûrs · {player.pulls} tirages</p>
                      </div>
                      {player.isWinner && <div className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-600">WIN</div>}
                    </div>
                  ))}
                  <Button variant="outline" onClick={clearLeverBlastGameOver}>Fermer le classement</Button>
                </div>
              )}
            </div>

            {leverBlastPlayAgainPrompt && (
              <div className="rounded-[24px] border border-border/50 bg-card p-5">
                <p className="text-sm font-semibold">Rejouer ?</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {leverBlastPlayAgainPrompt.playAgainCount ?? 0}/{leverBlastPlayAgainPrompt.players.length} veulent relancer.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    disabled={!!myResponse || playAgainResponded}
                    onClick={() => {
                      setPlayAgainResponded(true);
                      respondToLeverBlastPlayAgainPrompt(true);
                    }}
                  >
                    Rejouer
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!!myResponse || playAgainResponded}
                    onClick={() => {
                      setPlayAgainResponded(true);
                      respondToLeverBlastPlayAgainPrompt(false);
                    }}
                  >
                    Quitter
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-[24px] border border-border/50 bg-card p-5">
              <p className="text-sm font-semibold">Règles rapides</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Un joueur vivant tire un levier à son tour.</li>
                <li>Un seul levier explose par round.</li>
                <li>Après une explosion, un nouveau panel apparaît.</li>
                <li>Le dernier survivant gagne la manche.</li>
              </ul>
            </div>
          </aside>
        </div>

        {alivePlayers.length === 1 && leverBlastGame && (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
            <span className="font-semibold">{alivePlayers[0]?.username}</span> tient encore debout. Fin de manche imminente.
          </div>
        )}
      </div>
    </PageShell>
  );
}
