import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';

type CrashStatus = 'idle' | 'running' | 'crashed' | 'cashed';

const DEFAULT_BET = 100;

function generateCrashPoint() {
  const sample = Math.random();
  const value = 0.97 / (1 - sample);
  return Number(Math.min(25, Math.max(1.05, value)).toFixed(2));
}

function getLiveMultiplier(startedAt: number) {
  const elapsed = (Date.now() - startedAt) / 1000;
  return Number((1 + elapsed * 0.75 + elapsed * elapsed * 0.16).toFixed(2));
}

export default function Crash() {
  const { user, refreshUser } = useAuth();
  const [bet, setBet] = useState(DEFAULT_BET);
  const [status, setStatus] = useState<CrashStatus>('idle');
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const clearTicker = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => clearTicker, []);

  const finishRound = async (payout: number, won: boolean) => {
    try {
      const response = await gamesApi.complete('casino', {
        score: payout,
        won,
        bet,
        netGain: payout - bet,
        preDeducted: true,
      });

      setRewards({
        aura: response.data.auraReward || 0,
        money: response.data.moneyReward || 0,
      });

      await refreshUser();
    } catch {
      setError('Le resultat de la manche n a pas pu etre synchronise.');
      try {
        await refreshUser();
      } catch {}
    }
  };

  const startRound = async () => {
    if (!user || status === 'running') return;

    if (!Number.isFinite(bet) || bet <= 0) {
      setError('Entre une mise valide.');
      return;
    }

    if (bet > user.money) {
      setError('Tu n as pas assez d argent pour cette mise.');
      return;
    }

    setError(null);
    setRewards(null);

    try {
      await gamesApi.startCasino(bet);
      await refreshUser();
    } catch {
      setError('Impossible de demarrer la fusee.');
      return;
    }

    const nextCrashPoint = generateCrashPoint();
    const now = Date.now();
    startedAtRef.current = now;
    setCrashPoint(nextCrashPoint);
    setCurrentMultiplier(1);
    setStatus('running');

    clearTicker();
    intervalRef.current = window.setInterval(() => {
      if (!startedAtRef.current) return;

      const nextMultiplier = getLiveMultiplier(startedAtRef.current);
      setCurrentMultiplier(nextMultiplier);

      if (nextMultiplier >= nextCrashPoint) {
        clearTicker();
        setCurrentMultiplier(nextCrashPoint);
        setStatus('crashed');
        void finishRound(0, false);
      }
    }, 100);
  };

  const cashOut = async () => {
    if (status !== 'running') return;

    clearTicker();
    const payout = Math.floor(bet * currentMultiplier);
    setStatus('cashed');
    await finishRound(payout, true);
  };

  const potentialPayout = Math.floor(bet * currentMultiplier);

  return (
    <PageShell size="wide">
      <div className="space-y-6">
        <PageHeader
          title="Crash"
          description="Le multiplicateur grimpe jusqu au crash. Tu dois cashout avant la casse."
        />

        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <Card className="border-sky-500/20 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Pilotage</span>
                <Badge variant="secondary">{status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Mise</p>
                <Input
                  type="number"
                  min={1}
                  step={10}
                  value={bet}
                  onChange={(event) => setBet(Math.max(1, Number(event.target.value) || 0))}
                  disabled={status === 'running'}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 250].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={bet === value ? 'default' : 'outline'}
                    onClick={() => setBet(value)}
                    disabled={status === 'running'}
                  >
                    {value}$
                  </Button>
                ))}
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
                <p className="text-muted-foreground">Multiplicateur live</p>
                <p className="mt-1 text-3xl font-semibold text-foreground">x{currentMultiplier.toFixed(2)}</p>
                <p className="mt-3 text-muted-foreground">Cashout potentiel</p>
                <p className="text-lg font-semibold text-foreground">{potentialPayout}$</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={startRound} disabled={!user || status === 'running'}>
                  Lancer
                </Button>
                <Button variant="outline" onClick={() => void cashOut()} disabled={status !== 'running'}>
                  Cashout
                </Button>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Solde</p>
                <p className="font-semibold">{user?.money ?? 0}$</p>
                {crashPoint ? (
                  <>
                    <p className="text-muted-foreground">Dernier point de crash</p>
                    <p className="font-semibold">x{crashPoint.toFixed(2)}</p>
                  </>
                ) : null}
              </div>

              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {rewards ? (
                <p className="text-sm text-emerald-400">
                  Bonus: +{rewards.money}$ et +{rewards.aura} aura
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-sky-500/20 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(3,7,18,1))]">
            <CardContent className="space-y-6 p-5 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-100/65">Live round</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Monte haut, sors vite</h2>
                </div>
                <Badge className="border-white/10 bg-white/10 text-white">
                  {status === 'running' ? 'En vol' : status === 'cashed' ? 'Cashout' : status === 'crashed' ? 'Crash' : 'Pret'}
                </Badge>
              </div>

              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(14,165,233,0.08),_rgba(15,23,42,0.02))] px-6 py-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.22),transparent_55%)]" />
                <div className="relative flex min-h-[320px] flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-sky-100/60">Aura rocket</p>
                      <p className="mt-3 text-6xl font-black text-white">x{currentMultiplier.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">Payout</p>
                      <p className="mt-1 text-xl font-semibold text-white">{potentialPayout}$</p>
                    </div>
                  </div>

                  <div className="relative h-36 rounded-[1.5rem] border border-white/10 bg-black/10">
                    <div className="absolute inset-x-5 bottom-5 h-px bg-white/15" />
                    <div
                      className="absolute bottom-5 left-8 text-4xl transition-all duration-100"
                      style={{
                        transform: `translate(${Math.min(420, (currentMultiplier - 1) * 115)}px, -${Math.min(90, (currentMultiplier - 1) * 32)}px) rotate(12deg)`,
                        opacity: status === 'crashed' ? 0.45 : 1,
                      }}
                    >
                      {status === 'crashed' ? 'X' : 'A'}
                    </div>
                    <div className="absolute bottom-8 left-6 text-xs uppercase tracking-[0.2em] text-white/45">
                      {status === 'running'
                        ? 'La courbe grimpe...'
                        : status === 'crashed'
                          ? `Crash a x${(crashPoint ?? currentMultiplier).toFixed(2)}`
                          : status === 'cashed'
                            ? 'Cashout securise'
                            : 'En attente du depart'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Risque</p>
                  <p className="mt-2 text-sm font-medium text-white">Le crash peut arriver tres tot.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Mise</p>
                  <p className="mt-2 text-xl font-semibold text-white">{bet}$</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Action</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {status === 'running' ? 'Cashout avant que ca casse.' : 'Lance une nouvelle fusee.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
