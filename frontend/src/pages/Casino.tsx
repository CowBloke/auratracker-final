import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { cn } from '@/lib/utils';
import { Coins, Flame, History, RotateCcw, Sparkles, XCircle } from 'lucide-react';

type GameTab = 'roulette' | 'slots';

// -----------------------------
// Roulette setup
// -----------------------------
type RouletteColor = 'red' | 'black' | 'green';
type BetType = 'straight' | 'color' | 'parity' | 'range' | 'dozen' | 'column';

interface Bet {
  type: BetType;
  value: number | string;
  amount: number;
}

interface SpinOutcome {
  number: number;
  color: RouletteColor;
  payout: number;
  net: number;
  totalBet: number;
}

const WHEEL_NUMBERS: number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const CHIP_VALUES = [5, 10, 25, 50, 100, 250, 500, 1000];
const SPIN_DURATION = 4200;
const BALL_DURATION = 4600;
const SLICE_ANGLE = 360 / WHEEL_NUMBERS.length;
const WHEEL_OFFSET = -90;

const TABLE_ROWS = Array.from({ length: 12 }, (_, idx) => {
  const start = 3 * (12 - idx) - 2;
  return [start, start + 1, start + 2];
});

const getNumberColor = (num: number): RouletteColor => {
  if (num === 0) return 'green';
  return RED_NUMBERS.has(num) ? 'red' : 'black';
};

const getDozen = (num: number) => {
  if (num === 0) return null;
  if (num <= 12) return 1;
  if (num <= 24) return 2;
  return 3;
};

const getColumn = (num: number) => {
  if (num === 0) return null;
  return ((num - 1) % 3) + 1;
};

const getBetMultiplier = (bet: Bet, winningNumber: number) => {
  switch (bet.type) {
    case 'straight':
      return bet.value === winningNumber ? 36 : 0;
    case 'color': {
      const color = getNumberColor(winningNumber);
      return bet.value === color ? 2 : 0;
    }
    case 'parity': {
      if (winningNumber === 0) return 0;
      const parity = winningNumber % 2 === 0 ? 'even' : 'odd';
      return bet.value === parity ? 2 : 0;
    }
    case 'range': {
      if (winningNumber === 0) return 0;
      const range = winningNumber <= 18 ? 'low' : 'high';
      return bet.value === range ? 2 : 0;
    }
    case 'dozen': {
      const dozen = getDozen(winningNumber);
      return dozen && dozen === bet.value ? 3 : 0;
    }
    case 'column': {
      const column = getColumn(winningNumber);
      return column && column === bet.value ? 3 : 0;
    }
    default:
      return 0;
  }
};

// -----------------------------
// Slot machine setup (previous implementation)
// -----------------------------
type SlotSymbol = '🍒' | '🍋' | '🍊' | '🍇' | '🔔' | '⭐' | '💎' | '7️⃣';

interface SlotResult {
  reels: SlotSymbol[][];
  winAmount: number;
  multiplier: number;
  winningLines: number[];
}

const SLOT_SYMBOLS: SlotSymbol[] = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];
const SLOT_SYMBOL_VALUES: Record<SlotSymbol, number> = {
  '🍒': 2,
  '🍋': 3,
  '🍊': 4,
  '🍇': 5,
  '🔔': 10,
  '⭐': 15,
  '💎': 25,
  '7️⃣': 50,
};

const REEL_COUNT = 3;
const ROWS = 3;
const SLOT_SPIN_DURATION = 2000;
const BET_STEPS = [10, 25, 50, 100, 250, 500, 1000];

// -----------------------------
// Main Casino page
// -----------------------------
export default function Casino() {
  const [activeGame, setActiveGame] = useState<GameTab>('roulette');

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/games"
              className="text-sm text-muted-foreground tracking-wide uppercase hover:text-foreground transition-colors"
            >
              ← Jeux
            </Link>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Casino
            </h1>
            <p className="text-muted-foreground">
              Choisis ta table: machine à sous classique ou roulette animée.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'roulette', label: 'Roulette' },
            { id: 'slots', label: 'Machine à sous' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveGame(tab.id as GameTab)}
              className={cn(
                "rounded-full px-4 py-2 text-sm border transition-colors",
                activeGame === tab.id
                  ? "border-foreground text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {activeGame === 'roulette' ? <RouletteGame /> : <SlotMachineGame />}
    </div>
  );
}

// -----------------------------
// Roulette Game Component
// -----------------------------
function RouletteGame() {
  const { user, refreshUser } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [chipValue, setChipValue] = useState(25);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(WHEEL_OFFSET + SLICE_ANGLE / 2);
  const [lastResult, setLastResult] = useState<SpinOutcome | null>(null);
  const [history, setHistory] = useState<SpinOutcome[]>([]);
  const [stats, setStats] = useState({ wins: 0, losses: 0, highScore: 0 });
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalBet = useMemo(
    () => bets.reduce((sum, bet) => sum + bet.amount, 0),
    [bets]
  );

  const wheelGradient = useMemo(() => {
    const segments = WHEEL_NUMBERS.map((num, idx) => {
      const start = (idx * SLICE_ANGLE).toFixed(2);
      const end = ((idx + 1) * SLICE_ANGLE).toFixed(2);
      const color =
        getNumberColor(num) === 'red'
          ? '#b91c1c'
          : getNumberColor(num) === 'black'
            ? '#0b1224'
            : '#15803d';
      return `${color} ${start}deg ${end}deg`;
    }).join(', ');

    return `conic-gradient(from ${WHEEL_OFFSET}deg, ${segments})`;
  }, []);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const response = await gamesApi.getStats('casino', user.id);
      const gameStats = response.data.stats;
      setStats({
        wins: gameStats.wins || 0,
        losses: gameStats.losses || 0,
        highScore: gameStats.highScore || 0,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const calculatePayout = useCallback(
    (winningNumber: number) => {
      return bets.reduce((sum, bet) => {
        const multiplier = getBetMultiplier(bet, winningNumber);
        if (!multiplier) return sum;
        return sum + bet.amount * multiplier;
      }, 0);
    },
    [bets]
  );

  const placeBet = useCallback(
    (type: BetType, value: number | string) => {
      if (!user || spinning) return;
      const projected = totalBet + chipValue;

      if (projected > (user?.money || 0)) {
        setError('Fonds insuffisants pour cette mise');
        return;
      }

      setError(null);
      setBets((prev) => {
        const existingIndex = prev.findIndex(
          (bet) => bet.type === type && bet.value === value
        );
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            amount: updated[existingIndex].amount + chipValue,
          };
          return updated;
        }
        return [...prev, { type, value, amount: chipValue }];
      });
    },
    [chipValue, totalBet, user, spinning]
  );

  const clearBets = useCallback(() => {
    if (spinning) return;
    setBets([]);
    setError(null);
  }, [spinning]);

  const spinWheel = useCallback(async () => {
    if (!user || spinning || totalBet === 0) return;

    if (totalBet > user.money) {
      setError('Fonds insuffisants pour lancer la roue');
      return;
    }

    const targetIndex = Math.floor(Math.random() * WHEEL_NUMBERS.length);
    const winningNumber = WHEEL_NUMBERS[targetIndex];
    const pocketCenter = targetIndex * SLICE_ANGLE + SLICE_ANGLE / 2;

    const wheelExtraSpins = 3 + Math.floor(Math.random() * 3); // 3 to 5 turns
    const wheelWobble = Math.random() * 90 - 45;
    const targetWheelRotation =
      wheelRotation + wheelExtraSpins * 360 + wheelWobble;

    const ballExtraSpins = 5 + Math.floor(Math.random() * 3); // 5 to 7 turns, opposite direction
    const targetWorldAngle = targetWheelRotation + WHEEL_OFFSET + pocketCenter;
    const targetBallRotation = targetWorldAngle - ballExtraSpins * 360;

    setSpinning(true);
    setRewards(null);
    setLastResult(null);
    setBallRotation(targetBallRotation);
    setWheelRotation(targetWheelRotation);

    setTimeout(async () => {
      const payout = calculatePayout(winningNumber);
      const net = payout - totalBet;
      const spinResult: SpinOutcome = {
        number: winningNumber,
        color: getNumberColor(winningNumber),
        payout,
        net,
        totalBet,
      };

      setLastResult(spinResult);
      setHistory((prev) => [spinResult, ...prev].slice(0, 8));

      try {
        const response = await gamesApi.complete('casino', {
          score: payout,
          won: payout > 0,
          bet: totalBet,
          netGain: net,
        });

        setRewards({
          aura: response.data.auraReward || 0,
          money: response.data.moneyReward || 0,
        });

        await refreshUser();
        await fetchStats();
      } catch (err) {
        console.error('Failed to submit spin:', err);
      } finally {
        setSpinning(false);
      }
    }, BALL_DURATION + 200);
  }, [
    user,
    spinning,
    totalBet,
    wheelRotation,
    calculatePayout,
    refreshUser,
    fetchStats,
  ]);

  const renderChip = (amount: number) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-semibold shadow">
      <Coins className="h-3 w-3" />
      {amount}
    </span>
  );

  const getBetFor = (type: BetType, value: number | string) =>
    bets.find((bet) => bet.type === type && bet.value === value);

  const canSpin = user && totalBet > 0 && !spinning && (user.money >= totalBet);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Roulette</h2>
          <p className="text-muted-foreground">
            Mises multi-cases, roue animée et historique en direct.
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground tabular-nums space-y-1">
          <div className="text-lg text-foreground">Solde: ${user?.money.toLocaleString() || 0}</div>
          <div>Mises en cours: ${totalBet.toLocaleString()}</div>
          {lastResult && (
            <div className={cn("text-xs", lastResult.net >= 0 ? "text-green-500" : "text-destructive")}>
              Dernier tour: {lastResult.net >= 0 ? '+' : ''}{lastResult.net.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
        {/* Wheel + status */}
        <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-background to-background/40 p-6 shadow-2xl shadow-black/10">
          <div className="relative aspect-square w-full max-w-[420px] mx-auto">
            <div
              className="absolute inset-0 rounded-full overflow-hidden border border-border/40 shadow-2xl shadow-black/30"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: `transform ${SPIN_DURATION}ms cubic-bezier(0.21, 0.8, 0.34, 1)`,
              }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: wheelGradient }}
              />
              <div className="absolute inset-3 rounded-full border border-white/10 shadow-inner shadow-black/40" />
              <div className="absolute inset-6 rounded-full bg-gradient-to-b from-black/30 via-background/70 to-background/90 border border-white/5" />
              <div className="absolute inset-14 rounded-full bg-black/50 border border-white/10 backdrop-blur-sm" />
              {WHEEL_NUMBERS.map((num, idx) => {
                const angle = WHEEL_OFFSET + idx * SLICE_ANGLE + SLICE_ANGLE / 2;
                const color = getNumberColor(num);
                return (
                  <div
                    key={`${num}-${idx}`}
                    className="absolute left-1/2 top-1/2 text-[10px] font-semibold tracking-tight"
                    style={{
                      transform: `rotate(${angle}deg) translateY(-47%)`,
                      color:
                        color === 'red'
                          ? '#fecdd3'
                          : color === 'black'
                            ? '#e2e8f0'
                            : '#86efac',
                    }}
                  >
                    {num}
                  </div>
                );
              })}
            </div>

            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className="relative w-[88%] h-[88%]"
                style={{
                  transform: `rotate(${ballRotation}deg)`,
                  transition: `transform ${BALL_DURATION}ms cubic-bezier(0.17, 0.84, 0.44, 1.02)`,
                }}
              >
                <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-4 h-4 rounded-full bg-white shadow-xl shadow-black/40 border border-black/30" />
              </div>
            </div>

            <div className="absolute inset-[42%] rounded-full border border-white/10 bg-gradient-to-b from-white/10 via-white/5 to-black/40 shadow-inner shadow-black/50" />
            <div className="absolute inset-[48%] rounded-full bg-gradient-to-b from-foreground/80 to-black/90 shadow-2xl shadow-black/60" />
          </div>

          <div className="mt-6 space-y-3">
            {lastResult ? (
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center text-lg font-semibold shadow",
                      lastResult.color === 'red'
                        ? "bg-red-500/20 text-red-200 border border-red-400/50"
                        : lastResult.color === 'black'
                          ? "bg-slate-900 text-slate-100 border border-slate-700"
                          : "bg-emerald-500/20 text-emerald-100 border border-emerald-400/50"
                    )}
                  >
                    {lastResult.number}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-[0.18em]">
                      Dernier tirage
                    </p>
                    <p className="text-lg font-semibold">
                      {lastResult.color === 'red'
                        ? 'Rouge'
                        : lastResult.color === 'black'
                          ? 'Noir'
                          : 'Vert'}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm font-semibold">
                  {lastResult.net >= 0 ? (
                    <span className="text-green-500">+${lastResult.net.toLocaleString()}</span>
                  ) : (
                    <span className="text-destructive">${lastResult.net.toLocaleString()}</span>
                  )}
                  <div className="text-xs text-muted-foreground">Total gagné: ${lastResult.payout.toLocaleString()}</div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
                Place tes jetons et lance la roue pour voir le résultat ici.
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {bets.length > 0 ? `${bets.length} pari${bets.length > 1 ? 's' : ''} placés` : 'Aucune mise'}
              </div>
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                {history.slice(0, 4).map((spin, idx) => (
                  <span
                    key={`${spin.number}-${idx}`}
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                      spin.color === 'red'
                        ? "bg-red-500/20 text-red-100 border-red-500/40"
                        : spin.color === 'black'
                          ? "bg-slate-900 text-slate-100 border-slate-700"
                          : "bg-emerald-500/20 text-emerald-100 border-emerald-500/40"
                    )}
                  >
                    {spin.number}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Betting table */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-background/50 backdrop-blur-sm shadow-lg p-4 md:p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Jetons
              </p>
              <div className="flex flex-wrap gap-2">
                {CHIP_VALUES.map((value) => (
                  <button
                    key={value}
                    onClick={() => setChipValue(value)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                      chipValue === value
                        ? "border-foreground text-foreground shadow"
                        : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                    )}
                  >
                    ${value}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Coins className="h-4 w-4" />
                  Total: ${totalBet}
                </div>
                <div className="flex items-center gap-1">
                  <Flame className="h-4 w-4 text-orange-400" />
                  Mise sélection: ${chipValue}
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[96px_1fr]">
              <button
                onClick={() => placeBet('straight', 0)}
                className={cn(
                  "relative flex items-center justify-center rounded-xl border px-3 py-4 font-semibold text-lg shadow-sm transition-all",
                  "bg-emerald-900/50 text-emerald-50 border-emerald-500/40 hover:border-emerald-400",
                  spinning && "opacity-70 cursor-not-allowed"
                )}
                disabled={spinning}
              >
                <span>0</span>
                {getBetFor('straight', 0) && (
                  <div className="absolute right-2 top-2">
                    {renderChip(getBetFor('straight', 0)!.amount)}
                  </div>
                )}
              </button>

              <div
                className="grid grid-cols-3 gap-2"
                style={{ gridTemplateRows: 'repeat(12, minmax(0, 1fr))' }}
              >
                {TABLE_ROWS.map((row) =>
                  row.map((num) => {
                    const color = getNumberColor(num);
                    const bet = getBetFor('straight', num);
                    return (
                      <button
                        key={num}
                        onClick={() => placeBet('straight', num)}
                        className={cn(
                          "relative rounded-lg border px-2 py-3 text-center font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground",
                          color === 'red'
                            ? "bg-red-500/15 text-red-100 border-red-500/40 hover:border-red-300"
                            : "bg-slate-900 text-slate-100 border-slate-700 hover:border-slate-500",
                          spinning && "opacity-70 cursor-not-allowed"
                        )}
                        disabled={spinning}
                      >
                        <span>{num}</span>
                        {bet && (
                          <div className="absolute right-1.5 top-1.5">
                            {renderChip(bet.amount)}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <button
                onClick={() => placeBet('color', 'red')}
                className={cn(
                  "relative flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                  "bg-red-500/15 text-red-100 border-red-500/40 hover:border-red-300",
                  spinning && "opacity-70 cursor-not-allowed"
                )}
                disabled={spinning}
              >
                Rouge {getBetFor('color', 'red') && renderChip(getBetFor('color', 'red')!.amount)}
              </button>
              <button
                onClick={() => placeBet('color', 'black')}
                className={cn(
                  "relative flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                  "bg-slate-900 text-slate-100 border-slate-700 hover:border-slate-500",
                  spinning && "opacity-70 cursor-not-allowed"
                )}
                disabled={spinning}
              >
                Noir {getBetFor('color', 'black') && renderChip(getBetFor('color', 'black')!.amount)}
              </button>
              <button
                onClick={() => placeBet('parity', 'even')}
                className={cn(
                  "relative flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                  "bg-background text-foreground hover:border-foreground/40 border-border",
                  spinning && "opacity-70 cursor-not-allowed"
                )}
                disabled={spinning}
              >
                Pair {getBetFor('parity', 'even') && renderChip(getBetFor('parity', 'even')!.amount)}
              </button>
              <button
                onClick={() => placeBet('parity', 'odd')}
                className={cn(
                  "relative flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                  "bg-background text-foreground hover:border-foreground/40 border-border",
                  spinning && "opacity-70 cursor-not-allowed"
                )}
                disabled={spinning}
              >
                Impair {getBetFor('parity', 'odd') && renderChip(getBetFor('parity', 'odd')!.amount)}
              </button>
              <button
                onClick={() => placeBet('range', 'low')}
                className={cn(
                  "relative flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                  "bg-background text-foreground hover:border-foreground/40 border-border",
                  spinning && "opacity-70 cursor-not-allowed"
                )}
                disabled={spinning}
              >
                1 - 18 {getBetFor('range', 'low') && renderChip(getBetFor('range', 'low')!.amount)}
              </button>
              <button
                onClick={() => placeBet('range', 'high')}
                className={cn(
                  "relative flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                  "bg-background text-foreground hover:border-foreground/40 border-border",
                  spinning && "opacity-70 cursor-not-allowed"
                )}
                disabled={spinning}
              >
                19 - 36 {getBetFor('range', 'high') && renderChip(getBetFor('range', 'high')!.amount)}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((dozen) => (
                <button
                  key={dozen}
                  onClick={() => placeBet('dozen', dozen)}
                  className={cn(
                    "relative flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                    "bg-background text-foreground hover:border-foreground/40 border-border",
                    spinning && "opacity-70 cursor-not-allowed"
                  )}
                  disabled={spinning}
                >
                  {dozen === 1 ? '1 - 12' : dozen === 2 ? '13 - 24' : '25 - 36'}
                  {getBetFor('dozen', dozen) && renderChip(getBetFor('dozen', dozen)!.amount)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((column) => (
                <button
                  key={column}
                  onClick={() => placeBet('column', column)}
                  className={cn(
                    "relative flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                    "bg-background text-foreground hover:border-foreground/40 border-border",
                    spinning && "opacity-70 cursor-not-allowed"
                  )}
                  disabled={spinning}
                >
                  Colonne {column}
                  {getBetFor('column', column) && renderChip(getBetFor('column', column)!.amount)}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Mise totale: ${totalBet}
              </div>
              {rewards && (
                <div className="flex items-center gap-2 text-foreground">
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                  {rewards.aura > 0 && <span>+{rewards.aura} aura</span>}
                  {rewards.money !== 0 && <span>{rewards.money > 0 ? '+' : ''}${rewards.money}</span>}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={clearBets}
                disabled={spinning || bets.length === 0}
                className={cn(
                  "flex-1 sm:flex-none px-4 py-2 text-sm border transition-colors rounded-lg",
                  bets.length === 0 || spinning
                    ? "border-border/60 text-muted-foreground cursor-not-allowed"
                    : "border-border text-foreground hover:border-foreground"
                )}
              >
                Réinitialiser les mises
              </button>
              <button
                onClick={spinWheel}
                disabled={!canSpin}
                className={cn(
                  "flex-1 sm:flex-none px-5 py-3 rounded-lg text-base font-semibold flex items-center justify-center gap-2 transition-colors",
                  canSpin
                    ? "bg-foreground text-background hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {spinning ? <RotateCcw className="h-5 w-5 animate-spin" /> : 'Lancer la roue'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats & history */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-center shadow">
          <p className="text-3xl font-light tabular-nums">{stats.wins}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.18em]">Victoires</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-center shadow">
          <p className="text-3xl font-light tabular-nums">{stats.losses}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.18em]">Défaites</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-center shadow">
          <p className="text-3xl font-light tabular-nums">${stats.highScore.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.18em]">Meilleur gain</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/70 p-4 md:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-[0.2em]">
            <History className="h-4 w-4" />
            Historique
          </div>
          <div className="text-xs text-muted-foreground">
            Multi-mises: gain brut = mise x multiplicateur, net = gain - mise totale.
          </div>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun tour joué pour l&apos;instant.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {history.map((spin, idx) => (
              <div
                key={`${spin.number}-${idx}`}
                className="rounded-lg border border-border/60 bg-card/70 px-3 py-2 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold",
                      spin.color === 'red'
                        ? "bg-red-500/15 text-red-100 border-red-500/40"
                        : spin.color === 'black'
                          ? "bg-slate-900 text-slate-100 border-slate-700"
                          : "bg-emerald-500/20 text-emerald-100 border-emerald-500/40"
                    )}
                  >
                    {spin.number}
                  </span>
                  <div className="text-xs">
                    <div className="font-semibold">
                      {spin.color === 'red'
                        ? 'Rouge'
                        : spin.color === 'black'
                          ? 'Noir'
                          : 'Vert'}
                    </div>
                    <div className="text-muted-foreground">Mise: ${spin.totalBet}</div>
                  </div>
                </div>
                <div className="text-right text-xs font-semibold">
                  {spin.net >= 0 ? (
                    <span className="text-green-500">+${spin.net}</span>
                  ) : (
                    <span className="text-destructive">${spin.net}</span>
                  )}
                  <div className="text-[11px] text-muted-foreground">Gain: ${spin.payout}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------
// Slot Machine Component (previous experience)
// -----------------------------
function SlotMachineGame() {
  const { user, refreshUser } = useAuth();
  const [bet, setBet] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<SlotSymbol[][]>(
    Array(REEL_COUNT).fill(null).map(() => Array(ROWS).fill('🍒'))
  );
  const [winAmount, setWinAmount] = useState(0);
  const [lastResult, setLastResult] = useState<SlotResult | null>(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0, highScore: 0 });
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    if (!user) return;
    try {
      const response = await gamesApi.getStats('casino', user.id);
      const gameStats = response.data.stats;
      setStats({
        wins: gameStats.wins || 0,
        losses: gameStats.losses || 0,
        highScore: gameStats.highScore || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const generateReels = (): SlotSymbol[][] => {
    return Array(REEL_COUNT).fill(null).map(() =>
      Array(ROWS).fill(null).map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)])
    );
  };

  const calculateWin = (finalReels: SlotSymbol[][]): { winAmount: number; multiplier: number; winningLines: number[] } => {
    let totalWin = 0;
    let multiplier = 0;
    const winningLines: number[] = [];

    for (let row = 0; row < ROWS; row++) {
      const symbols = finalReels.map(reel => reel[row]);
      const firstSymbol = symbols[0];
      const count = symbols.filter(s => s === firstSymbol).length;

      if (count === REEL_COUNT) {
        const value = SLOT_SYMBOL_VALUES[firstSymbol];
        const lineWin = bet * value;
        totalWin += lineWin;
        multiplier += value;
        winningLines.push(row);
      }
    }

    const diag1 = [finalReels[0][0], finalReels[1][1], finalReels[2][2]];
    if (diag1[0] === diag1[1] && diag1[1] === diag1[2]) {
      const value = SLOT_SYMBOL_VALUES[diag1[0]];
      totalWin += bet * value;
      multiplier += value;
      winningLines.push(3);
    }

    const diag2 = [finalReels[0][2], finalReels[1][1], finalReels[2][0]];
    if (diag2[0] === diag2[1] && diag2[1] === diag2[2]) {
      const value = SLOT_SYMBOL_VALUES[diag2[0]];
      totalWin += bet * value;
      multiplier += value;
      winningLines.push(4);
    }

    return { winAmount: totalWin, multiplier, winningLines };
  };

  const spin = useCallback(async () => {
    if (spinning || !user || user.money < bet) return;

    setSpinning(true);
    setIsSpinning(true);
    setWinAmount(0);
    setLastResult(null);
    setRewards(null);

    const spinInterval = setInterval(() => {
      setReels(generateReels());
    }, 100);

    setTimeout(async () => {
      clearInterval(spinInterval);
      
      const finalReels = generateReels();
      const result = calculateWin(finalReels);
      
      setReels(finalReels);
      setWinAmount(result.winAmount);
      setLastResult({ reels: finalReels, ...result });
      setIsSpinning(false);

      try {
        const response = await gamesApi.complete('casino', {
          score: result.winAmount,
          won: result.winAmount > 0,
          bet,
          netGain: result.winAmount - bet,
        });

        setRewards({
          aura: response.data.auraReward || 0,
          money: response.data.moneyReward || 0,
        });

        await refreshUser();
        await fetchStats();
      } catch (error) {
        console.error('Failed to submit spin:', error);
      }

      setSpinning(false);
    }, SLOT_SPIN_DURATION);
  }, [bet, user, spinning, refreshUser]);

  const canSpin = user && user.money >= bet && !spinning;

  return (
    <div className="max-w-4xl space-y-12">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Machine à sous
            </h2>
          </div>
          <div className="text-right text-sm text-muted-foreground tabular-nums">
            <div>${user?.money.toLocaleString() || 0}</div>
            <div>Mise: ${bet}</div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap justify-center gap-2">
        {BET_STEPS.map((step) => (
          <button
            key={step}
            onClick={() => setBet(step)}
            disabled={spinning || (user && user.money < step)}
            className={cn(
              "px-4 py-2 text-sm border transition-colors rounded-lg",
              bet === step
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30",
              (user && user.money < step) && "opacity-30 cursor-not-allowed"
            )}
          >
            ${step}
          </button>
        ))}
      </div>

      <div className="border border-border/30 p-6 rounded-2xl">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {reels.map((reel, reelIndex) => (
            <div key={reelIndex} className="space-y-2">
              {reel.map((symbol, rowIndex) => {
                const isWinning = lastResult?.winningLines.some(line => {
                  if (line < 3) return line === rowIndex;
                  if (line === 3) return reelIndex === rowIndex;
                  if (line === 4) return reelIndex === 2 - rowIndex;
                  return false;
                });
                
                return (
                  <div
                    key={`${reelIndex}-${rowIndex}`}
                    className={cn(
                      "text-5xl text-center py-3 border transition-all rounded-lg",
                      isWinning && !isSpinning
                        ? 'border-foreground bg-muted/50'
                        : 'border-border/30'
                    )}
                  >
                    {symbol}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {!isSpinning && lastResult && (
          <p className={cn(
            "text-center text-lg mb-6",
            winAmount > 0 ? "text-foreground" : "text-muted-foreground"
          )}>
            {winAmount > 0 ? `+$${winAmount.toLocaleString()}` : `-$${bet.toLocaleString()}`}
          </p>
        )}

        <button
          onClick={spin}
          disabled={!canSpin}
          className={cn(
            "w-full h-14 border text-lg transition-colors flex items-center justify-center rounded-lg",
            canSpin
              ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
              : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
          )}
        >
          {spinning ? (
            <RotateCcw className="w-5 h-5 animate-spin" />
          ) : user && user.money < bet ? (
            'Fonds insuffisants'
          ) : (
            'LANCER'
          )}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-light tabular-nums">{stats.wins}</p>
          <p className="text-xs text-muted-foreground uppercase">Victoires</p>
        </div>
        <div>
          <p className="text-2xl font-light tabular-nums">{stats.losses}</p>
          <p className="text-xs text-muted-foreground uppercase">Défaites</p>
        </div>
        <div>
          <p className="text-2xl font-light tabular-nums">${stats.highScore.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground uppercase">Meilleur gain</p>
        </div>
      </div>
    </div>
  );
}
