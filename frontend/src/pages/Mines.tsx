import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';
import { cn } from '@/lib/utils';

const GRID_SIZE = 5;
const TILE_COUNT = GRID_SIZE * GRID_SIZE;
const HOUSE_EDGE = 0.94;
const DEFAULT_BET = 100;

type RoundStatus = 'idle' | 'active' | 'lost' | 'cashed';

function combination(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const picks = Math.min(k, n - k);
  let result = 1;
  for (let index = 1; index <= picks; index += 1) {
    result = (result * (n - picks + index)) / index;
  }
  return result;
}

function getMultiplier(revealedSafeTiles: number, mines: number) {
  if (revealedSafeTiles <= 0) return 1;
  const fairMultiplier =
    combination(TILE_COUNT, revealedSafeTiles) /
    combination(TILE_COUNT - mines, revealedSafeTiles);
  return Number((fairMultiplier * HOUSE_EDGE).toFixed(2));
}

function pickMinePositions(mines: number, safeIndex: number) {
  const available = Array.from({ length: TILE_COUNT }, (_, index) => index).filter((index) => index !== safeIndex);
  const picked = new Set<number>();

  while (picked.size < mines) {
    const randomIndex = Math.floor(Math.random() * available.length);
    picked.add(available[randomIndex]);
    available.splice(randomIndex, 1);
  }

  return picked;
}

export default function Mines() {
  const { user, refreshUser } = useAuth();
  const [bet, setBet] = useState(DEFAULT_BET);
  const [mineCount, setMineCount] = useState(5);
  const [status, setStatus] = useState<RoundStatus>('idle');
  const [revealedTiles, setRevealedTiles] = useState<number[]>([]);
  const [minePositions, setMinePositions] = useState<Set<number>>(new Set());
  const [explodedMine, setExplodedMine] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);

  const revealedSet = useMemo(() => new Set(revealedTiles), [revealedTiles]);
  const safeHits = revealedTiles.filter((tile) => !minePositions.has(tile)).length;
  const currentMultiplier = getMultiplier(safeHits, mineCount);
  const potentialPayout = Math.floor(bet * currentMultiplier);

  const resetBoard = () => {
    if (busy) return;
    setStatus('idle');
    setRevealedTiles([]);
    setMinePositions(new Set());
    setExplodedMine(null);
    setError(null);
    setRewards(null);
  };

  const finalizeRound = async (payout: number, won: boolean) => {
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
      setError('La manche a ete jouee mais le serveur n a pas confirme le resultat.');
      try {
        await refreshUser();
      } catch {}
    }
  };

  const openTile = async (index: number) => {
    if (!user || busy || revealedSet.has(index) || status === 'lost' || status === 'cashed') return;

    let roundMines = minePositions;
    let nextStatus = status;

    if (status === 'idle') {
      if (!Number.isFinite(bet) || bet <= 0) {
        setError('Entre une mise valide.');
        return;
      }

      if (bet > user.money) {
        setError('Tu n as pas assez d argent pour cette mise.');
        return;
      }

      setBusy(true);
      setError(null);
      setRewards(null);

      try {
        await gamesApi.startCasino(bet);
        await refreshUser();
      } catch {
        setBusy(false);
        setError('Impossible de demarrer la manche.');
        return;
      }

      roundMines = pickMinePositions(mineCount, index);
      setMinePositions(roundMines);
      setStatus('active');
      nextStatus = 'active';
      setBusy(false);
    }

    if (nextStatus !== 'active') return;

    if (roundMines.has(index)) {
      const fullReveal = Array.from(new Set([...revealedTiles, index, ...Array.from(roundMines)]));
      setRevealedTiles(fullReveal);
      setExplodedMine(index);
      setStatus('lost');
      setBusy(true);
      await finalizeRound(0, false);
      setBusy(false);
      return;
    }

    setRevealedTiles((current) => [...current, index]);
  };

  const cashOut = async () => {
    if (busy || status !== 'active' || safeHits === 0) return;

    setBusy(true);
    setStatus('cashed');
    await finalizeRound(potentialPayout, true);
    setBusy(false);
  };

  const helperText =
    status === 'lost'
      ? 'Tu as clique sur une mine.'
      : status === 'cashed'
        ? `Cashout valide a x${currentMultiplier.toFixed(2)}.`
        : status === 'active'
          ? 'Continue ou cashout avant de tomber sur une mine.'
          : 'Clique sur une case pour lancer la manche.';

  return (
    <PageShell size="wide">
      <div className="space-y-6">
        <PageHeader
          title="Mines"
          description="Version classique sur grille 5x5. Plus tu reveles de cases sures, plus le multiplicateur monte."
        />

        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <Card className="border-amber-500/20 bg-card/80">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Parametres</span>
                <Badge variant="secondary">{mineCount} mines</Badge>
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
                  disabled={status === 'active' || busy}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Nombre de mines</p>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 5, 7, 10].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={mineCount === value ? 'default' : 'outline'}
                      onClick={() => setMineCount(value)}
                      disabled={status === 'active' || busy}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
                <p className="text-muted-foreground">Multiplicateur actuel</p>
                <p className="mt-1 text-2xl font-semibold">x{currentMultiplier.toFixed(2)}</p>
                <p className="mt-3 text-muted-foreground">Cashout potentiel</p>
                <p className="text-lg font-semibold text-foreground">{potentialPayout}$</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={cashOut} disabled={status !== 'active' || safeHits === 0 || busy}>
                  Cashout
                </Button>
                <Button variant="outline" onClick={resetBoard} disabled={busy}>
                  Reset
                </Button>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Cases sures ouvertes</p>
                <p className="font-semibold">{safeHits}</p>
                <p className="text-muted-foreground">Solde</p>
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

          <Card className="border-amber-500/20 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_45%),linear-gradient(180deg,_rgba(17,24,39,0.96),_rgba(10,14,24,1))]">
            <CardContent className="space-y-6 p-5 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-amber-100/65">Classic board</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Ouvre, grimpe, cashout</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="border-white/10 bg-white/10 text-white">{safeHits} safe</Badge>
                  <Badge className="border-amber-300/20 bg-amber-400/15 text-amber-50">x{currentMultiplier.toFixed(2)}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {Array.from({ length: TILE_COUNT }, (_, index) => {
                  const isRevealed = revealedSet.has(index);
                  const isMine = minePositions.has(index);
                  const isExploded = explodedMine === index;

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => void openTile(index)}
                      disabled={busy || isRevealed || status === 'cashed' || status === 'lost'}
                      className={cn(
                        'aspect-square rounded-2xl border text-lg font-semibold transition',
                        !isRevealed && 'border-white/10 bg-white/5 hover:bg-white/10',
                        isRevealed && !isMine && 'border-emerald-300/30 bg-emerald-400/20 text-emerald-50',
                        isMine && 'border-red-300/30 bg-red-400/20 text-red-100',
                        isExploded && 'scale-[0.97] shadow-[0_0_0_1px_rgba(252,165,165,0.4)]'
                      )}
                    >
                      {isRevealed ? (isMine ? 'X' : 'G') : '?'}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Etat</p>
                  <p className="mt-2 text-sm font-medium text-white">{helperText}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Mise active</p>
                  <p className="mt-2 text-xl font-semibold text-white">{bet}$</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">Mines</p>
                  <p className="mt-2 text-xl font-semibold text-white">{mineCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
