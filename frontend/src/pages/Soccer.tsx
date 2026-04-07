import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';
import { cn } from '@/lib/utils';

type GoalZone = {
  id: string;
  label: string;
  multiplier: number;
};

type ShotResult = {
  zoneId: string;
  keeperZoneId: string;
  won: boolean;
  payout: number;
};

const GOAL_ZONES: GoalZone[] = [
  { id: 'top-left', label: 'Haut gauche', multiplier: 3 },
  { id: 'top-center', label: 'Haut centre', multiplier: 3 },
  { id: 'top-right', label: 'Haut droite', multiplier: 3 },
  { id: 'bottom-left', label: 'Bas gauche', multiplier: 3 },
  { id: 'bottom-center', label: 'Bas centre', multiplier: 3 },
  { id: 'bottom-right', label: 'Bas droite', multiplier: 3 },
];

const DEFAULT_BET = 100;
const LOSS_RATE = 0.7;

export default function Soccer() {
  const { user, refreshUser } = useAuth();
  const [bet, setBet] = useState(DEFAULT_BET);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(GOAL_ZONES[0].id);
  const [shooting, setShooting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShotResult | null>(null);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);

  const selectedZone = useMemo(
    () => GOAL_ZONES.find((zone) => zone.id === selectedZoneId) ?? GOAL_ZONES[0],
    [selectedZoneId]
  );

  const handleShoot = async () => {
    if (!user || shooting) return;

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
    setResult(null);

    try {
      await gamesApi.startCasino(bet);
      await refreshUser();
    } catch {
      setError('Impossible de lancer le tir. Verifie ton solde.');
      return;
    }

    setShooting(true);

    window.setTimeout(async () => {
      const won = Math.random() > LOSS_RATE;
      const keeperZoneId = won
        ? GOAL_ZONES.filter((zone) => zone.id !== selectedZone.id)[Math.floor(Math.random() * (GOAL_ZONES.length - 1))].id
        : selectedZone.id;
      const payout = won ? Math.round(bet * selectedZone.multiplier) : 0;

      setResult({
        zoneId: selectedZone.id,
        keeperZoneId,
        won,
        payout,
      });

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
        setError('Le resultat du tir n a pas pu etre synchronise.');
        try {
          await refreshUser();
        } catch {}
      } finally {
        setShooting(false);
      }
    }, 1400);
  };

  const statusLabel = shooting
    ? 'Le gardien lit ta course...'
    : result
      ? result.won
        ? `But dans la zone ${selectedZone.label.toLowerCase()}`
        : `Arret du gardien sur ${selectedZone.label.toLowerCase()}`
      : 'Choisis une zone puis frappe.';

  return (
    <PageShell size="wide">
      <div className="space-y-6">
        <PageHeader
          title="Soccer"
          description="Tu choisis une zone du but. Le gardien a environ 70% de chances d arreter ton tir."
        />

        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <Card className="border-emerald-500/20 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Ticket</span>
                <Badge variant="secondary">x{selectedZone.multiplier.toFixed(2)}</Badge>
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
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 250].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={bet === value ? 'default' : 'outline'}
                    onClick={() => setBet(value)}
                    disabled={shooting}
                  >
                    {value}$
                  </Button>
                ))}
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
                <p className="font-medium">Zone choisie</p>
                <p className="mt-1 text-muted-foreground">{selectedZone.label}</p>
                <p className="mt-3 text-muted-foreground">Gain brut si tu marques</p>
                <p className="text-lg font-semibold text-foreground">{Math.round(bet * selectedZone.multiplier)}$</p>
              </div>

              <Button className="w-full" size="lg" onClick={handleShoot} disabled={!user || shooting}>
                {shooting ? 'Tir en cours...' : 'Tirer'}
              </Button>

              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Solde actuel</p>
                <p className="font-semibold">{user?.money ?? 0}$</p>
              </div>

              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {rewards ? (
                <p className="text-sm text-emerald-400">
                  Bonus: +{rewards.money}$ et +{rewards.aura} aura
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-emerald-500/20 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(7,12,22,1))]">
            <CardContent className="space-y-6 p-5 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">Penalty arena</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Vise un coin et bats le gardien</h2>
                </div>
                <Badge className="border-red-400/30 bg-red-500/15 text-red-100">70% de perte</Badge>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-black/20 p-4 sm:p-6">
                <div className="relative mx-auto aspect-[7/4] max-w-4xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(34,197,94,0.12),_rgba(8,47,73,0.24))] p-4">
                  <div className="absolute inset-x-[8%] top-[8%] h-[72%] rounded-t-[1.5rem] border-[6px] border-b-0 border-white/80" />
                  <div className="absolute inset-x-[8%] top-[8%] h-[72%] bg-[linear-gradient(180deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0.02))]" />
                  <div className="absolute inset-x-[8%] top-[8%] h-[72%]">
                    <div className="grid h-full grid-cols-3 grid-rows-2 gap-2 p-2">
                      {GOAL_ZONES.map((zone) => {
                        const isSelected = zone.id === selectedZone.id;
                        const isKeeper = result?.keeperZoneId === zone.id;
                        const isGoal = result?.zoneId === zone.id && result.won;
                        const isSaved = result?.zoneId === zone.id && !result.won;

                        return (
                          <button
                            key={zone.id}
                            type="button"
                            onClick={() => setSelectedZoneId(zone.id)}
                            disabled={shooting}
                            className={cn(
                              'rounded-xl border text-left transition',
                              isSelected ? 'border-emerald-300 bg-emerald-400/20 shadow-[0_0_0_1px_rgba(110,231,183,0.4)]' : 'border-white/15 bg-white/5 hover:bg-white/10',
                              isGoal && 'border-emerald-200 bg-emerald-300/25',
                              isSaved && 'border-red-300 bg-red-400/20'
                            )}
                          >
                            <div className="flex h-full flex-col justify-between p-3">
                              <span className="text-sm font-medium text-white">{zone.label}</span>
                              <span className="text-xs text-white/60">x{zone.multiplier.toFixed(2)}</span>
                              {isKeeper ? <span className="text-[11px] font-semibold text-amber-200">Gardien</span> : null}
                              {isGoal ? <span className="text-[11px] font-semibold text-emerald-200">BUT</span> : null}
                              {isSaved ? <span className="text-[11px] font-semibold text-red-200">ARRET</span> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-[24%] bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.12)_2px,transparent_2px,transparent_84px)] opacity-30" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Probabilite</p>
                  <p className="mt-2 text-xl font-semibold text-white">30% de marquer</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Mise active</p>
                  <p className="mt-2 text-xl font-semibold text-white">{bet}$</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Statut</p>
                  <p className="mt-2 text-sm font-medium text-white">{statusLabel}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
