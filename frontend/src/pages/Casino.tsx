import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { cn } from '@/lib/utils';
import { Coins, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-shell';

type GameTab = 'roulette' | 'slots' | 'blackjack';

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
// Blackjack setup
// -----------------------------
type BlackjackStatus = 'idle' | 'player' | 'dealer' | 'finished';
type BlackjackOutcome = 'win' | 'lose' | 'push' | 'blackjack';
type BlackjackSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
type BlackjackRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface BlackjackCard {
  id: string;
  rank: BlackjackRank;
  suit: BlackjackSuit;
  value: number;
  isRed: boolean;
}

interface BlackjackHand {
  id: string;
  cards: BlackjackCard[];
  bet: number;
  doubled: boolean;
  state: 'playing' | 'stood' | 'bust' | 'blackjack';
  outcome: BlackjackOutcome | null;
}

const BLACKJACK_BET_STEPS = [25, 50, 100, 250, 500, 1000];
const BLACKJACK_MIN_BET = 5;
const BLACKJACK_SUITS: BlackjackSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const BLACKJACK_RANKS: BlackjackRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const BLACKJACK_MIN_DECK = 15;

const BLACKJACK_SUIT_META: Record<BlackjackSuit, { symbol: string; isRed: boolean }> = {
  spades: { symbol: '♠', isRed: false },
  hearts: { symbol: '♥', isRed: true },
  diamonds: { symbol: '♦', isRed: true },
  clubs: { symbol: '♣', isRed: false },
};

const BLACKJACK_RANK_VALUES: Record<BlackjackRank, number> = {
  A: 11,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 10,
  Q: 10,
  K: 10,
};

const createBlackjackDeck = (): BlackjackCard[] => {
  const deck: BlackjackCard[] = [];
  BLACKJACK_SUITS.forEach((suit) => {
    BLACKJACK_RANKS.forEach((rank) => {
      deck.push({
        id: `${rank}-${suit}-${deck.length}`,
        rank,
        suit,
        value: BLACKJACK_RANK_VALUES[rank],
        isRed: BLACKJACK_SUIT_META[suit].isRed,
      });
    });
  });
  return deck;
};

const shuffleDeck = (deck: BlackjackCard[]) => {
  const shuffled = [...deck];
  for (let idx = shuffled.length - 1; idx > 0; idx -= 1) {
    const swapIndex = Math.floor(Math.random() * (idx + 1));
    [shuffled[idx], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[idx]];
  }
  return shuffled;
};

const getHandTotal = (hand: BlackjackCard[]) => {
  let total = 0;
  let aces = 0;

  hand.forEach((card) => {
    total += card.value;
    if (card.rank === 'A') aces += 1;
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
};
// -----------------------------
// Main Casino page
// -----------------------------
export default function Casino() {
  const { user } = useAuth();
  const [activeGame, setActiveGame] = useState<GameTab | null>(null);
  const [rouletteTotalBet, setRouletteTotalBet] = useState(0);
  const [slotBet, setSlotBet] = useState(50);
  const [blackjackBet, setBlackjackBet] = useState(100);

  const activeBet =
    activeGame === 'roulette'
      ? rouletteTotalBet
      : activeGame === 'slots'
        ? slotBet
        : blackjackBet;

  const gameCards: Array<{
    id: GameTab;
    title: string;
    subtitle: string;
    image: string;
  }> = [
    {
      id: 'roulette',
      title: 'Roulette',
      subtitle: 'Tirage instantane',
      image: '/images/games/casino.png',
    },
    {
      id: 'slots',
      title: 'Machine a sous',
      subtitle: 'Partie rapide',
      image: '/images/games/cashmachine.png',
    },
    {
      id: 'blackjack',
      title: 'Blackjack',
      subtitle: 'Jeu de cartes',
      image: '/images/games/blackjack.png',
    },
  ];

  return (
    <PageShell size="wide">
      <PageHeader
        title="Casino"
        actions={(
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-border/60 bg-card px-4 py-2 text-right">
              <div className="text-xs text-muted-foreground">Solde</div>
              <div className="text-sm font-semibold tabular-nums text-foreground">
                ${user?.money.toLocaleString() || 0}
              </div>
            </div>
            {activeGame ? (
              <>
                <div className="rounded-lg border border-border/60 bg-card px-4 py-2 text-right">
                  <div className="text-xs text-muted-foreground">Mises en cours</div>
                  <div className="text-sm font-semibold tabular-nums text-foreground">
                    ${activeBet.toLocaleString()}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setActiveGame(null)}
                  className="h-10"
                >
                  Changer de jeu
                </Button>
              </>
            ) : null}
          </div>
        )}
      />

      {activeGame ? (
        <section className="space-y-4">
          {activeGame === 'roulette' ? (
            <RouletteGame onTotalBetChange={setRouletteTotalBet} />
          ) : activeGame === 'slots' ? (
            <SlotMachineGame onBetChange={setSlotBet} />
          ) : (
            <BlackjackGame onBetChange={setBlackjackBet} />
          )}
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {gameCards.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => setActiveGame(game.id)}
              className="group block text-left"
            >
              <Card className="relative aspect-square overflow-hidden transition hover:border-foreground/40 hover:shadow-md">
                <img
                  src={game.image}
                  alt={game.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <CardContent className="relative z-10 flex h-full flex-col justify-end p-5 text-white">
                  <h2 className="text-lg font-semibold tracking-tight">{game.title}</h2>
                  <p className="mt-1 text-xs text-white/85">{game.subtitle}</p>
                </CardContent>
              </Card>
            </button>
          ))}
        </section>
      )}
    </PageShell>
  );
}

// -----------------------------
// Roulette Game Component
// -----------------------------
function RouletteGame({ onTotalBetChange }: { onTotalBetChange?: (value: number) => void }) {
  const { user, refreshUser } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [chipValue, setChipValue] = useState(25);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(WHEEL_OFFSET + SLICE_ANGLE / 2);
  const [lastResult, setLastResult] = useState<SpinOutcome | null>(null);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalBet = useMemo(
    () => bets.reduce((sum, bet) => sum + bet.amount, 0),
    [bets]
  );

  useEffect(() => {
    onTotalBetChange?.(totalBet);
  }, [onTotalBetChange, totalBet]);

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
  ]);

  const renderChip = (amount: number) => (
    <span className="inline-flex items-center gap-1 border border-border/30 px-2 py-0.5 text-[11px] font-medium">
      <Coins className="h-3 w-3" />
      {amount}
    </span>
  );

  const getBetFor = (type: BetType, value: number | string) =>
    bets.find((bet) => bet.type === type && bet.value === value);

  const canSpin = user && totalBet > 0 && !spinning && (user.money >= totalBet);

  return (
    <div className="space-y-4">
      {/* Chip selection and controls at top */}
      <div className="border border-border/30 p-3">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <p className="text-xs   text-muted-foreground">
            Jetons
          </p>
          <div className="flex flex-wrap gap-2">
            {CHIP_VALUES.map((value) => (
              <Button variant="ghost"
                key={value}
                onClick={() => setChipValue(value)}
                className={cn(
                  "border px-3 py-1 text-xs transition-colors",
                  chipValue === value
                    ? "border-foreground text-foreground"
                    : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
              >
                ${value}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <div>
              Total: ${totalBet}
            </div>
            <div>
              Mise sélection: ${chipValue}
            </div>
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 text-sm text-muted-foreground border border-border/30 mb-3">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="ghost"
            onClick={clearBets}
            disabled={spinning || bets.length === 0}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 text-sm border transition-colors",
              bets.length === 0 || spinning
                ? "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            Réinitialiser les mises
          </Button>
          <Button variant="ghost"
            onClick={spinWheel}
            disabled={!canSpin}
            className={cn(
              "flex-1 sm:flex-none px-5 py-3 text-sm border flex items-center justify-center gap-2 transition-colors",
              canSpin
                ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            {spinning ? <RotateCcw className="h-5 w-5 animate-spin" /> : 'Lancer la roue'}
          </Button>
        </div>
      </div>

      {/* Main game area: Wheel + Betting table side by side */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Wheel + status */}
        <div className="space-y-3">
          <div className="border border-border/30 p-4">
            <div className="relative aspect-square w-full max-w-[280px] mx-auto">
            <div
              className="absolute inset-0 rounded-full overflow-hidden border shadow-2xl shadow-black/30"
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
              <div className="absolute inset-6 rounded-full bg-gradient-to-b from-black/30 to-black/60 border border-white/5" />
              <div className="absolute inset-14 rounded-full bg-black/50 border border-white/10 backdrop-blur-sm" />
              {WHEEL_NUMBERS.map((num, idx) => {
                const angle = WHEEL_OFFSET + idx * SLICE_ANGLE + SLICE_ANGLE / 2;
                const color = getNumberColor(num);
                return (
                  <div
                    key={`${num}-${idx}`}
                    className="absolute inset-0"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <div
                      className="absolute left-1/2 -translate-x-1/2 text-[9px] font-semibold tracking-tight"
                      style={{
                        top: '6%',
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
                <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-3 h-3 rounded-full bg-white shadow-xl shadow-black/40 border border-black/30" />
              </div>
            </div>

            <div className="absolute inset-[42%] rounded-full border border-white/10 bg-gradient-to-b from-black/20 to-black/40 shadow-inner shadow-black/50" />
            <div className="absolute inset-[48%] rounded-full bg-gradient-to-b from-black/60 to-black/90 shadow-2xl shadow-black/60" />
          </div>

            <div className="space-y-2">
            {lastResult ? (
              <div className="flex items-center justify-between border border-border/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 border border-border/30 flex items-center justify-center text-sm font-medium">
                    {lastResult.number}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground  ">
                      Dernier tirage
                    </p>
                    <p className="text-xs font-medium">
                      {lastResult.color === 'red'
                        ? 'Rouge'
                        : lastResult.color === 'black'
                          ? 'Noir'
                          : 'Vert'}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <span className={lastResult.net >= 0 ? 'text-foreground' : 'text-muted-foreground'}>
                    {lastResult.net >= 0 ? '+' : ''}${lastResult.net.toLocaleString()}
                  </span>
                  <div className="text-[10px] text-muted-foreground">Total: ${lastResult.payout.toLocaleString()}</div>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-border/30 px-3 py-2 text-xs text-muted-foreground">
                Place tes jetons et lance la roue.
              </div>
            )}

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{bets.length > 0 ? `${bets.length} pari${bets.length > 1 ? 's' : ''}` : 'Aucune mise'}</span>
                <div className="flex items-center gap-2">
                  <Coins className="h-3 w-3" />
                  <span>Mise totale: ${totalBet}</span>
                </div>
                {rewards && (
                  <div className="flex items-center gap-1 text-[10px]">
                    {rewards.aura > 0 && <span>+{rewards.aura} aura</span>}
                    {rewards.money !== 0 && <span>{rewards.money > 0 ? '+' : ''}${rewards.money}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Betting table */}
        <div className="border border-border/30 p-3">
          <div className="grid gap-2 lg:grid-cols-[60px_1fr_auto]">
            {/* Zero column */}
            <Button variant="ghost"
              onClick={() => placeBet('straight', 0)}
              className={cn(
                "relative flex items-center justify-center border px-1 py-2 font-medium text-xs transition-colors",
                "border-border/30 hover:border-foreground/30",
                spinning && "opacity-70 cursor-not-allowed"
              )}
              disabled={spinning}
            >
              <span>0</span>
              {getBetFor('straight', 0) && (
                <div className="absolute right-1 top-1">
                  {renderChip(getBetFor('straight', 0)!.amount)}
                </div>
              )}
            </Button>

            {/* Main number grid */}
            <div className="grid grid-cols-3 gap-1" style={{ gridTemplateRows: 'repeat(12, minmax(0, 1fr))' }}>
              {TABLE_ROWS.map((row) =>
                row.map((num) => {
                  const bet = getBetFor('straight', num);
                  return (
                    <Button variant="ghost"
                      key={num}
                      onClick={() => placeBet('straight', num)}
                      className={cn(
                        "relative border px-1 py-1.5 text-center text-[11px] font-medium transition-colors",
                        "border-border/30 hover:border-foreground/30",
                        spinning && "opacity-70 cursor-not-allowed"
                      )}
                      disabled={spinning}
                    >
                      <span>{num}</span>
                      {bet && (
                        <div className="absolute right-1 top-1">
                          {renderChip(bet.amount)}
                        </div>
                      )}
                    </Button>
                  );
                })
              )}
            </div>

            {/* Outside bets - placed to the right of the grid */}
            <div className="space-y-1.5">
              {/* Colors and parity */}
              <div className="grid grid-cols-2 gap-1">
                <Button variant="ghost"
                  onClick={() => placeBet('color', 'red')}
                  className={cn(
                    "relative flex items-center justify-between border px-2 py-1.5 text-[10px] font-medium transition-colors",
                    "border-border/30 hover:border-foreground/30",
                    spinning && "opacity-70 cursor-not-allowed"
                  )}
                  disabled={spinning}
                >
                  <span>Rouge</span>
                  {getBetFor('color', 'red') && renderChip(getBetFor('color', 'red')!.amount)}
                </Button>
                <Button variant="ghost"
                  onClick={() => placeBet('color', 'black')}
                  className={cn(
                    "relative flex items-center justify-between border px-2 py-1.5 text-[10px] font-medium transition-colors",
                    "border-border/30 hover:border-foreground/30",
                    spinning && "opacity-70 cursor-not-allowed"
                  )}
                  disabled={spinning}
                >
                  <span>Noir</span>
                  {getBetFor('color', 'black') && renderChip(getBetFor('color', 'black')!.amount)}
                </Button>
                <Button variant="ghost"
                  onClick={() => placeBet('parity', 'even')}
                  className={cn(
                    "relative flex items-center justify-between border px-2 py-1.5 text-[10px] font-medium transition-colors",
                    "border-border/30 hover:border-foreground/30",
                    spinning && "opacity-70 cursor-not-allowed"
                  )}
                  disabled={spinning}
                >
                  <span>Pair</span>
                  {getBetFor('parity', 'even') && renderChip(getBetFor('parity', 'even')!.amount)}
                </Button>
                <Button variant="ghost"
                  onClick={() => placeBet('parity', 'odd')}
                  className={cn(
                    "relative flex items-center justify-between border px-2 py-1.5 text-[10px] font-medium transition-colors",
                    "border-border/30 hover:border-foreground/30",
                    spinning && "opacity-70 cursor-not-allowed"
                  )}
                  disabled={spinning}
                >
                  <span>Impair</span>
                  {getBetFor('parity', 'odd') && renderChip(getBetFor('parity', 'odd')!.amount)}
                </Button>
              </div>

              {/* Ranges */}
              <div className="grid grid-cols-2 gap-1">
                <Button variant="ghost"
                  onClick={() => placeBet('range', 'low')}
                  className={cn(
                    "relative flex items-center justify-between border px-2 py-1.5 text-[10px] font-medium transition-colors",
                    "border-border/30 hover:border-foreground/30",
                    spinning && "opacity-70 cursor-not-allowed"
                  )}
                  disabled={spinning}
                >
                  <span>1-18</span>
                  {getBetFor('range', 'low') && renderChip(getBetFor('range', 'low')!.amount)}
                </Button>
                <Button variant="ghost"
                  onClick={() => placeBet('range', 'high')}
                  className={cn(
                    "relative flex items-center justify-between border px-2 py-1.5 text-[10px] font-medium transition-colors",
                    "border-border/30 hover:border-foreground/30",
                    spinning && "opacity-70 cursor-not-allowed"
                  )}
                  disabled={spinning}
                >
                  <span>19-36</span>
                  {getBetFor('range', 'high') && renderChip(getBetFor('range', 'high')!.amount)}
                </Button>
              </div>

              {/* Dozens */}
              <div className="grid grid-cols-1 gap-1">
                {[1, 2, 3].map((dozen) => (
                  <Button variant="ghost"
                    key={dozen}
                    onClick={() => placeBet('dozen', dozen)}
                    className={cn(
                      "relative flex items-center justify-between border px-2 py-1.5 text-[10px] font-medium transition-colors",
                      "border-border/30 hover:border-foreground/30",
                      spinning && "opacity-70 cursor-not-allowed"
                    )}
                    disabled={spinning}
                  >
                    <span>{dozen === 1 ? '1-12' : dozen === 2 ? '13-24' : '25-36'}</span>
                    {getBetFor('dozen', dozen) && renderChip(getBetFor('dozen', dozen)!.amount)}
                  </Button>
                ))}
              </div>

              {/* Columns */}
              <div className="grid grid-cols-1 gap-1">
                {[1, 2, 3].map((column) => (
                  <Button variant="ghost"
                    key={column}
                    onClick={() => placeBet('column', column)}
                    className={cn(
                      "relative flex items-center justify-between border px-2 py-1.5 text-[10px] font-medium transition-colors",
                      "border-border/30 hover:border-foreground/30",
                      spinning && "opacity-70 cursor-not-allowed"
                    )}
                    disabled={spinning}
                  >
                    <span>Col {column}</span>
                    {getBetFor('column', column) && renderChip(getBetFor('column', column)!.amount)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Blackjack Component
// -----------------------------
function BlackjackGame({ onBetChange }: { onBetChange?: (value: number) => void }) {
  const { user, refreshUser } = useAuth();
  const [bet, setBet] = useState(100);
  const [betDraft, setBetDraft] = useState('100');
  const [status, setStatus] = useState<BlackjackStatus>('idle');
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
  const [hands, setHands] = useState<BlackjackHand[]>([]);
  const [activeHandIndex, setActiveHandIndex] = useState(0);
  const [netGain, setNetGain] = useState(0);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deckRef = useRef<BlackjackCard[]>(shuffleDeck(createBlackjackDeck()));

  const dealerTotal = useMemo(() => getHandTotal(dealerHand), [dealerHand]);
  const revealDealer = status !== 'player';
  const totalBet = useMemo(() => {
    if (hands.length === 0) return bet;
    return hands.reduce((sum, hand) => sum + hand.bet, 0);
  }, [hands, bet]);
  const activeHand = hands[activeHandIndex];

  useEffect(() => {
    onBetChange?.(totalBet);
  }, [onBetChange, totalBet]);

  useEffect(() => {
    setBetDraft(bet.toString());
  }, [bet]);

  const drawCard = useCallback(() => {
    if (deckRef.current.length < BLACKJACK_MIN_DECK) {
      deckRef.current = shuffleDeck(createBlackjackDeck());
    }
    return deckRef.current.pop()!;
  }, []);

  const finishRound = useCallback(
    async (finalHands: BlackjackHand[], payoutAmount: number, totalRoundBet: number) => {
      const net = payoutAmount - totalRoundBet;
      setHands(finalHands);
      setNetGain(net);
      setStatus('finished');

      if (!user) return;

      try {
        const response = await gamesApi.complete('casino', {
          score: payoutAmount,
          won: net > 0,
          bet: totalRoundBet,
          netGain: net,
        });

        setRewards({
          aura: response.data.auraReward || 0,
          money: response.data.moneyReward || 0,
        });

        await refreshUser();
      } catch (err) {
        console.error('Failed to submit blackjack:', err);
      }
    },
    [refreshUser, user]
  );

  const getHandPayout = useCallback((hand: BlackjackHand) => {
    if (!hand.outcome) return 0;
    if (hand.outcome === 'blackjack') {
      return hand.bet + Math.round(hand.bet * 1.5);
    }
    if (hand.outcome === 'win') return hand.bet * 2;
    if (hand.outcome === 'push') return hand.bet;
    return 0;
  }, []);

  const resolveRound = useCallback(
    (roundHands: BlackjackHand[], dealerCards: BlackjackCard[]) => {
      const dealerScore = getHandTotal(dealerCards);
      const dealerBlackjack = dealerScore === 21 && dealerCards.length === 2;
      const roundWasSplit = roundHands.length > 1;

      const updatedHands = roundHands.map((hand) => {
        const playerScore = getHandTotal(hand.cards);
        let result: BlackjackOutcome = 'push';

        if (hand.state === 'bust' || playerScore > 21) {
          result = 'lose';
        } else if (dealerBlackjack) {
          result = !roundWasSplit && hand.state === 'blackjack' ? 'push' : 'lose';
        } else if (!roundWasSplit && hand.state === 'blackjack') {
          result = 'blackjack';
        } else if (dealerScore > 21) {
          result = 'win';
        } else if (playerScore > dealerScore) {
          result = 'win';
        } else if (playerScore < dealerScore) {
          result = 'lose';
        }

        return {
          ...hand,
          outcome: result,
          state: hand.state === 'playing' ? 'stood' : hand.state,
        };
      });

      const payoutAmount = updatedHands.reduce((sum, hand) => sum + getHandPayout(hand), 0);
      const totalRoundBet = updatedHands.reduce((sum, hand) => sum + hand.bet, 0);
      finishRound(updatedHands, payoutAmount, totalRoundBet);
    },
    [finishRound, getHandPayout]
  );

  const playDealer = useCallback(
    (roundHands: BlackjackHand[]) => {
      if (roundHands.every((hand) => hand.state === 'bust')) {
        const totalRoundBet = roundHands.reduce((sum, hand) => sum + hand.bet, 0);
        finishRound(roundHands, 0, totalRoundBet);
        return;
      }

      setStatus('dealer');
      let dealerCards = [...dealerHand];
      let total = getHandTotal(dealerCards);

      while (total < 17) {
        dealerCards = [...dealerCards, drawCard()];
        total = getHandTotal(dealerCards);
      }

      setDealerHand(dealerCards);
      resolveRound(roundHands, dealerCards);
    },
    [dealerHand, drawCard, finishRound, resolveRound]
  );

  const deal = useCallback(() => {
    if (!user) return;
    if (status === 'player' || status === 'dealer') return;
    if (user.money < bet) {
      setError('Fonds insuffisants pour cette mise');
      return;
    }

    setError(null);
    setRewards(null);
    setNetGain(0);
    setHands([]);
    setActiveHandIndex(0);

    const playerCards = [drawCard(), drawCard()];
    const dealerCards = [drawCard(), drawCard()];

    setDealerHand(dealerCards);

    const playerScore = getHandTotal(playerCards);
    const dealerScore = getHandTotal(dealerCards);
    const playerBlackjack = playerScore === 21 && playerCards.length === 2;
    const dealerBlackjack = dealerScore === 21 && dealerCards.length === 2;

    const initialHand: BlackjackHand = {
      id: 'hand-1',
      cards: playerCards,
      bet,
      doubled: false,
      state: playerBlackjack ? 'blackjack' : 'playing',
      outcome: null,
    };

    setHands([initialHand]);

    if (playerBlackjack || dealerBlackjack) {
      setStatus('dealer');
      resolveRound([initialHand], dealerCards);
    } else {
      setStatus('player');
    }
  }, [bet, drawCard, resolveRound, status, user]);

  const hit = useCallback(() => {
    if (status !== 'player' || !activeHand) return;
    const nextCards = [...activeHand.cards, drawCard()];
    const total = getHandTotal(nextCards);

    let nextState: BlackjackHand['state'] = activeHand.state;
    let nextOutcome = activeHand.outcome;
    if (total > 21) {
      nextState = 'bust';
      nextOutcome = 'lose';
    } else if (total === 21) {
      nextState = 'stood';
    }

    const updatedHands: BlackjackHand[] = hands.map((hand, index): BlackjackHand =>
      index === activeHandIndex
        ? { ...hand, cards: nextCards, state: nextState, outcome: nextOutcome }
        : hand
    );

    setHands(updatedHands);

    if (nextState === 'bust' || nextState === 'stood') {
      const nextIndex = updatedHands.findIndex(
        (hand, index) => index > activeHandIndex && hand.state === 'playing'
      );
      if (nextIndex >= 0) {
        setActiveHandIndex(nextIndex);
      } else {
        playDealer(updatedHands);
      }
    }
  }, [activeHand, activeHandIndex, drawCard, hands, playDealer, status]);

  const stand = useCallback(() => {
    if (status !== 'player' || !activeHand) return;
    const updatedHands: BlackjackHand[] = hands.map((hand, index): BlackjackHand =>
      index === activeHandIndex
        ? { ...hand, state: 'stood' }
        : hand
    );
    setHands(updatedHands);

    const nextIndex = updatedHands.findIndex(
      (hand, index) => index > activeHandIndex && hand.state === 'playing'
    );
    if (nextIndex >= 0) {
      setActiveHandIndex(nextIndex);
    } else {
      playDealer(updatedHands);
    }
  }, [activeHand, activeHandIndex, hands, playDealer, status]);

  const doubleDown = useCallback(() => {
    if (status !== 'player' || !activeHand) return;
    const additionalBet = activeHand.bet;
    if (user && user.money < totalBet + additionalBet) {
      setError('Fonds insuffisants pour doubler');
      return;
    }

    setError(null);
    const nextCards = [...activeHand.cards, drawCard()];
    const total = getHandTotal(nextCards);
    const nextState: BlackjackHand['state'] = total > 21 ? 'bust' : 'stood';
    const nextOutcome = total > 21 ? 'lose' : activeHand.outcome;

    const updatedHands: BlackjackHand[] = hands.map((hand, index): BlackjackHand =>
      index === activeHandIndex
        ? {
            ...hand,
            cards: nextCards,
            bet: hand.bet * 2,
            doubled: true,
            state: nextState,
            outcome: nextOutcome,
          }
        : hand
    );

    setHands(updatedHands);

    const nextIndex = updatedHands.findIndex(
      (hand, index) => index > activeHandIndex && hand.state === 'playing'
    );
    if (nextIndex >= 0) {
      setActiveHandIndex(nextIndex);
    } else {
      playDealer(updatedHands);
    }
  }, [activeHand, activeHandIndex, drawCard, hands, playDealer, status, totalBet, user]);

  const splitHand = useCallback(() => {
    if (status !== 'player' || !activeHand) return;
    if (hands.length !== 1) return;
    if (activeHand.cards.length !== 2) return;
    if (activeHand.cards[0].rank !== activeHand.cards[1].rank) return;
    if (user && user.money < totalBet + activeHand.bet) {
      setError('Fonds insuffisants pour splitter');
      return;
    }

    setError(null);

    const handOneCards = [activeHand.cards[0], drawCard()];
    const handTwoCards = [activeHand.cards[1], drawCard()];

    const handOne: BlackjackHand = {
      id: 'hand-1',
      cards: handOneCards,
      bet: activeHand.bet,
      doubled: false,
      state: getHandTotal(handOneCards) === 21 ? 'stood' : 'playing',
      outcome: null,
    };
    const handTwo: BlackjackHand = {
      id: 'hand-2',
      cards: handTwoCards,
      bet: activeHand.bet,
      doubled: false,
      state: getHandTotal(handTwoCards) === 21 ? 'stood' : 'playing',
      outcome: null,
    };

    const updatedHands = [handOne, handTwo];
    setHands(updatedHands);

    const nextIndex = updatedHands.findIndex((hand) => hand.state === 'playing');
    if (nextIndex >= 0) {
      setActiveHandIndex(nextIndex);
    } else {
      playDealer(updatedHands);
    }
  }, [activeHand, drawCard, hands.length, playDealer, status, totalBet, user]);

  const selectBet = useCallback((value: number) => {
    if (status === 'player' || status === 'dealer') return;
    setError(null);
    setBet(value);
    setBetDraft(value.toString());
  }, [status]);

  const applyCustomBet = useCallback(() => {
    if (status === 'player' || status === 'dealer') return;
    const parsed = Math.floor(Number(betDraft));
    if (!Number.isFinite(parsed)) {
      setBetDraft(bet.toString());
      return;
    }

    const normalized = Math.max(BLACKJACK_MIN_BET, parsed);
    if (user && normalized > user.money) {
      setError('Fonds insuffisants pour cette mise');
      return;
    }

    setError(null);
    setBet(normalized);
    setBetDraft(normalized.toString());
  }, [bet, betDraft, status, user]);

  const canDeal = user && (status === 'idle' || status === 'finished') && user.money >= bet;
  const canPlay = status === 'player' && hands.length > 0;
  const canSplit =
    canPlay &&
    hands.length === 1 &&
    !!activeHand &&
    activeHand.cards.length === 2 &&
    activeHand.cards[0].rank === activeHand.cards[1].rank &&
    !!user &&
    user.money >= totalBet + activeHand.bet;
  const canDouble =
    canPlay &&
    !!activeHand &&
    activeHand.cards.length === 2 &&
    !activeHand.doubled &&
    !!user &&
    user.money >= totalBet + activeHand.bet;

  const getOutcomeLabel = (value: BlackjackOutcome | null) =>
    value === 'blackjack'
      ? 'Blackjack'
      : value === 'win'
        ? 'Gagne'
        : value === 'lose'
          ? 'Perdu'
          : value === 'push'
            ? 'Egalite'
            : null;

  const renderCard = (card: BlackjackCard | null, hidden = false, key?: string) => {
    const suitMeta = card ? BLACKJACK_SUIT_META[card.suit] : null;
    return (
    <div
      key={key}
      className={cn(
        "relative flex h-32 w-24 items-center justify-center border text-2xl font-semibold",
        "sm:h-36 sm:w-28 sm:text-3xl",
        hidden && "bg-muted/30 text-muted-foreground",
        card && !hidden && (card.isRed ? "text-rose-500" : "text-foreground")
      )}
    >
      {hidden || !card ? (
        <span className="text-muted-foreground">??</span>
      ) : (
        <>
          <span className="absolute left-2 top-1 text-sm">{card.rank}</span>
          <span className="text-4xl">{suitMeta?.symbol}</span>
          <span className="absolute bottom-1 right-2 text-sm">{card.rank}</span>
        </>
      )}
    </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs   text-muted-foreground">
            Mise
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BLACKJACK_BET_STEPS.map((step) => (
              <Button variant="ghost"
                key={step}
                onClick={() => selectBet(step)}
                disabled={status === 'player' || status === 'dealer' || !!(user && user.money < step)}
                className={cn(
                  "px-4 py-2 text-base border transition-colors",
                  bet === step
                    ? "border-foreground text-foreground"
                    : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  (status === 'player' || status === 'dealer') && "opacity-40 cursor-not-allowed",
                  (user && user.money < step) && "opacity-30 cursor-not-allowed"
                )}
              >
                ${step}
              </Button>
            ))}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={BLACKJACK_MIN_BET}
                step={5}
                value={betDraft}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBetDraft(event.target.value)}
                onBlur={applyCustomBet}
                disabled={status === 'player' || status === 'dealer'}
                className={cn(
                  "h-10 w-28 text-base",
                  status === 'player' || status === 'dealer'
                    ? "opacity-40 cursor-not-allowed"
                    : ""
                )}
              />
              <Button variant="ghost"
                onClick={applyCustomBet}
                disabled={status === 'player' || status === 'dealer'}
                className={cn(
                  "h-10 px-3 text-sm border transition-colors",
                  status === 'player' || status === 'dealer'
                    ? "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                    : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                )}
              >
                Valider
              </Button>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs   text-muted-foreground">
            Total
          </p>
          <p className="text-2xl font-semibold">${totalBet.toLocaleString()}</p>
        </div>
      </div>

      {error && (
        <div className="border border-border/30 px-4 py-3 text-sm text-muted-foreground">
          {error}
        </div>
      )}

      <div className="border border-border/30 p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs   text-muted-foreground">
              Dealer
            </p>
            <div className="flex flex-wrap gap-3">
              {dealerHand.length === 0
                ? renderCard(null, true)
                : dealerHand.map((card, index) =>
                    index === 1 && !revealDealer
                      ? renderCard(null, true, `dealer-${index}`)
                      : renderCard(card, false, `dealer-${index}`)
                  )}
            </div>
            <div className="text-2xl font-semibold">
              Total: {revealDealer ? dealerTotal : '??'}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs   text-muted-foreground">
              Toi
            </p>
            {hands.length === 0 ? (
              <div className="flex flex-wrap gap-3">
                {renderCard(null)}
              </div>
            ) : (
              <div className="space-y-4">
                {hands.map((hand, index) => {
                  const handTotal = getHandTotal(hand.cards);
                  const isActive = status === 'player' && index === activeHandIndex;
                  return (
                    <div
                      key={hand.id}
                      className={cn(
                        "border border-border/30 p-3",
                        isActive && "border-foreground"
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs   text-muted-foreground">
                        <span>Main {index + 1}</span>
                        <span>
                          ${hand.bet.toLocaleString()}
                          {hand.doubled ? ' (Double)' : ''}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {hand.cards.map((card, cardIndex) =>
                          renderCard(card, false, `player-${hand.id}-${cardIndex}`)
                        )}
                      </div>
                      <div className="mt-2 text-lg font-semibold">
                        Total: {handTotal}
                      </div>
                      {hand.outcome && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          {getOutcomeLabel(hand.outcome)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="ghost"
            onClick={deal}
            disabled={!canDeal}
            className={cn(
              "h-14 px-6 text-lg border transition-colors",
              canDeal
                ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            {status === 'finished' ? 'Nouvelle main' : 'Distribuer'}
          </Button>
          <Button variant="ghost"
            onClick={hit}
            disabled={!canPlay}
            className={cn(
              "h-14 px-6 text-lg border transition-colors",
              canPlay
                ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            Tirer
          </Button>
          <Button variant="ghost"
            onClick={stand}
            disabled={!canPlay}
            className={cn(
              "h-14 px-6 text-lg border transition-colors",
              canPlay
                ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            Rester
          </Button>
          <Button variant="ghost"
            onClick={doubleDown}
            disabled={!canDouble}
            className={cn(
              "h-14 px-6 text-lg border transition-colors",
              canDouble
                ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            Doubler
          </Button>
          <Button variant="ghost"
            onClick={splitHand}
            disabled={!canSplit}
            className={cn(
              "h-14 px-6 text-lg border transition-colors",
              canSplit
                ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            Splitter
          </Button>
        </div>

        {status === 'finished' && hands.length > 0 && (
          <div className="mt-6 border border-border/30 px-4 py-3 text-lg flex flex-wrap items-center justify-between gap-3">
            <div className="font-semibold">
              {hands.length === 1 ? getOutcomeLabel(hands[0].outcome) : 'Mains terminées'}
            </div>
            <div className={netGain >= 0 ? 'text-foreground' : 'text-muted-foreground'}>
              {netGain >= 0 ? '+' : '-'}${Math.abs(netGain).toLocaleString()}
            </div>
          </div>
        )}

        {status === 'finished' && hands.length > 1 && (
          <div className="mt-3 border border-border/30 px-4 py-3 text-sm text-muted-foreground space-y-1">
            {hands.map((hand, index) => {
              const payout = getHandPayout(hand);
              const net = payout - hand.bet;
              return (
                <div key={`result-${hand.id}`}>
                  Main {index + 1}: {getOutcomeLabel(hand.outcome)} ({net >= 0 ? '+' : '-'}$
                  {Math.abs(net).toLocaleString()})
                </div>
              );
            })}
          </div>
        )}

        {rewards && (
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-3">
            {rewards.aura > 0 && <span>+{rewards.aura} aura</span>}
            {rewards.money !== 0 && <span>{rewards.money > 0 ? '+' : ''}${rewards.money}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------
// Slot Machine Component (previous experience)
// -----------------------------
function SlotMachineGame({ onBetChange }: { onBetChange?: (value: number) => void }) {
  const { user, refreshUser } = useAuth();
  const [bet, setBet] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<SlotSymbol[][]>(
    Array(REEL_COUNT).fill(null).map(() => Array(ROWS).fill('🍒'))
  );
  const [winAmount, setWinAmount] = useState(0);
  const [lastResult, setLastResult] = useState<SlotResult | null>(null);
  const [_rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    onBetChange?.(bet);
  }, [bet, onBetChange]);

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
      } catch (error) {
        console.error('Failed to submit spin:', error);
      }

      setSpinning(false);
    }, SLOT_SPIN_DURATION);
  }, [bet, user, spinning, refreshUser]);

  const canSpin = user && user.money >= bet && !spinning;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-center gap-2">
        {BET_STEPS.map((step) => (
          <Button variant="ghost"
            key={step}
            onClick={() => setBet(step)}
            disabled={spinning || !!(user && user.money < step)}
            className={cn(
              "px-3 py-1.5 text-sm border transition-colors",
              bet === step
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30",
              (user && user.money < step) && "opacity-30 cursor-not-allowed"
            )}
          >
            ${step}
          </Button>
        ))}
      </div>

      <div className="border border-border/30 p-5">
        <div className="grid grid-cols-3 gap-3 mb-5">
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
                      "text-4xl text-center py-3 border transition-all",
                      isWinning && !isSpinning
                        ? 'border-foreground bg-muted/30'
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

        <Button variant="ghost"
          onClick={spin}
          disabled={!canSpin}
          className={cn(
            "w-full h-14 border text-sm transition-colors flex items-center justify-center",
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
            'Lancer'
          )}
        </Button>
      </div>

    </div>
  );
}
