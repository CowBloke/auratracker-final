import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { cn } from '@/lib/utils';
import { CircleDollarSign, Disc3, RotateCcw, Sparkles, Spade, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageShell } from '@/components/layout/page-shell';

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

type CasinoCelebrationGame = 'roulette' | 'slots' | 'blackjack';
type CasinoCelebrationTier = 'small' | 'big' | 'mega' | 'jackpot';

interface CasinoCelebration {
  id: number;
  game: CasinoCelebrationGame;
  tier: CasinoCelebrationTier;
  netGain: number;
  grossWin: number;
  bet: number;
  headline: string;
  subheadline: string;
  cathyLines: string[];
  popupBursts: string[];
  accentClass: string;
  glowClass: string;
  chipCount: number;
}

const CASINO_GAME_LABELS: Record<CasinoCelebrationGame, string> = {
  roulette: 'Roulette',
  slots: 'Machine a sous',
  blackjack: 'Blackjack',
};

const isGameTab = (value: string | null): value is GameTab =>
  value === 'roulette' || value === 'slots' || value === 'blackjack';

const CASINO_TABLES: Array<{
  id: GameTab;
  title: string;
  subtitle: string;
  caption: string;
  seatLabel: string;
  icon: typeof Disc3;
  accentClass: string;
  glowClass: string;
  feltClass: string;
  chips: Array<{ top: string; left: string; color: string }>;
}> = [
  {
    id: 'roulette',
    title: 'Roulette',
    subtitle: 'Roue centrale et tapis premium',
    caption: 'Table circulaire pour ceux qui aiment lire la chance depuis le balcon.',
    seatLabel: "S'asseoir a la roulette",
    icon: Disc3,
    accentClass: 'from-rose-400 via-red-500 to-amber-300',
    glowClass: 'shadow-[0_24px_70px_rgba(239,68,68,0.28)]',
    feltClass: 'from-emerald-950 via-emerald-900 to-emerald-950',
    chips: [
      { top: '16%', left: '19%', color: '#ef4444' },
      { top: '73%', left: '22%', color: '#f59e0b' },
      { top: '25%', left: '75%', color: '#facc15' },
      { top: '74%', left: '73%', color: '#fb7185' },
    ],
  },
  {
    id: 'slots',
    title: 'Machine a sous',
    subtitle: 'Batterie de leviers et pluie de jackpots',
    caption: 'Une alcove lumineuse, plus rapide, plus nerveuse, plus arcade.',
    seatLabel: "S'asseoir aux machines",
    icon: Sparkles,
    accentClass: 'from-cyan-300 via-sky-400 to-indigo-400',
    glowClass: 'shadow-[0_24px_70px_rgba(56,189,248,0.25)]',
    feltClass: 'from-slate-900 via-slate-800 to-slate-950',
    chips: [
      { top: '18%', left: '24%', color: '#38bdf8' },
      { top: '28%', left: '73%', color: '#f97316' },
      { top: '69%', left: '20%', color: '#e879f9' },
      { top: '78%', left: '68%', color: '#22c55e' },
    ],
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    subtitle: 'Grand tapis cartes et duel contre le croupier',
    caption: 'Le coin strategique, calme en apparence, dangereux pour le banquier.',
    seatLabel: "S'asseoir au blackjack",
    icon: Spade,
    accentClass: 'from-amber-300 via-yellow-400 to-lime-300',
    glowClass: 'shadow-[0_24px_70px_rgba(250,204,21,0.24)]',
    feltClass: 'from-emerald-900 via-teal-900 to-emerald-950',
    chips: [
      { top: '18%', left: '17%', color: '#facc15' },
      { top: '74%', left: '18%', color: '#14b8a6' },
      { top: '23%', left: '77%', color: '#ffffff' },
      { top: '76%', left: '77%', color: '#fb7185' },
    ],
  },
];

const getCelebrationTier = (netGain: number, grossWin: number, bet: number): CasinoCelebrationTier => {
  if (netGain >= 3000 || grossWin >= 6000 || netGain >= Math.max(1, bet) * 20) return 'jackpot';
  if (netGain >= 1200 || grossWin >= 2500 || netGain >= Math.max(1, bet) * 8) return 'mega';
  if (netGain >= 350 || grossWin >= 800 || netGain >= Math.max(1, bet) * 3) return 'big';
  return 'small';
};

const buildCelebration = (
  game: CasinoCelebrationGame,
  netGain: number,
  grossWin: number,
  bet: number,
): CasinoCelebration | null => {
  if (netGain <= 0) return null;

  const tier = getCelebrationTier(netGain, grossWin, bet);
  const gameLabel = CASINO_GAME_LABELS[game];

  if (tier === 'jackpot') {
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      game,
      tier,
      netGain,
      grossWin,
      bet,
      headline: 'Mega jackpot',
      subheadline: `${gameLabel} s'emballe, la salle explose et Cathy appelle presque la securite.`,
      cathyLines: [
        'Cathy: On le garde ou on le met en vitrine ce gain ?',
        'Cathy: Tout le casino te regarde, continue comme ca.',
        'Cathy: Sirenes, jetons, flashs... c est un vrai braquage legal.',
      ],
      popupBursts: ['Gain monstre', 'Table en fusion', 'Cathy en PLS', 'Jackpot x100'],
      accentClass: 'from-amber-200 via-yellow-300 to-orange-500',
      glowClass: 'shadow-[0_0_90px_rgba(251,191,36,0.55)]',
      chipCount: 24,
    };
  }

  if (tier === 'mega') {
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      game,
      tier,
      netGain,
      grossWin,
      bet,
      headline: 'Grosse victoire',
      subheadline: `${gameLabel} vient de sortir un gain enorme. Cathy declenche les lumieres VIP.`,
      cathyLines: [
        'Cathy: Ouh la, la machine chante pour toi.',
        'Cathy: C est le genre de coup qui rend jaloux la table d a cote.',
        'Cathy: On veut du bruit, on veut des popups, on veut du cash.',
      ],
      popupBursts: ['Belle gagne', 'Alerte VIP', 'Pluie de jetons'],
      accentClass: 'from-fuchsia-300 via-pink-400 to-orange-400',
      glowClass: 'shadow-[0_0_70px_rgba(244,114,182,0.42)]',
      chipCount: 18,
    };
  }

  if (tier === 'big') {
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      game,
      tier,
      netGain,
      grossWin,
      bet,
      headline: 'Belle montee',
      subheadline: `${gameLabel} t envoie un bon shot de dopamine et Cathy monte le volume.`,
      cathyLines: [
        'Cathy: Ouiii, ca commence a sentir la bonne soiree.',
        'Cathy: On garde la cadence, le casino adore ca.',
      ],
      popupBursts: ['Gain', 'Serie chaude'],
      accentClass: 'from-emerald-300 via-lime-300 to-yellow-300',
      glowClass: 'shadow-[0_0_56px_rgba(74,222,128,0.34)]',
      chipCount: 12,
    };
  }

  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    game,
    tier,
    netGain,
    grossWin,
    bet,
    headline: 'Petit gain',
    subheadline: `${gameLabel} paie. Cathy te glisse un petit "on continue".`,
    cathyLines: ['Cathy: Petit billet, grande confiance.'],
    popupBursts: ['+ cash'],
    accentClass: 'from-sky-300 via-cyan-300 to-teal-300',
    glowClass: 'shadow-[0_0_40px_rgba(34,211,238,0.26)]',
    chipCount: 8,
  };
};

function CasinoCelebrationLayer({
  celebration,
  onDismiss,
}: {
  celebration: CasinoCelebration | null;
  onDismiss: () => void;
}) {
  if (!celebration) return null;

  return (
    <>
      <style>{`
        @keyframes casinoPulse {
          0% { opacity: 0.28; transform: scale(0.94); }
          50% { opacity: 0.9; transform: scale(1.04); }
          100% { opacity: 0.28; transform: scale(0.94); }
        }
        @keyframes casinoFloat {
          0% { opacity: 0; transform: translateY(20px) scale(0.9); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-44px) scale(1.08); }
        }
        @keyframes casinoFall {
          0% { opacity: 0; transform: translate3d(0,-16vh,0) rotate(0deg); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(18px,88vh,0) rotate(540deg); }
        }
        @keyframes casinoBanner {
          0% { opacity: 0; transform: translateY(18px) scale(0.94); }
          12% { opacity: 1; transform: translateY(0) scale(1); }
          80% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-16px) scale(1.02); }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_55%)]" />
        <div
          className={cn(
            'absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br blur-3xl',
            celebration.accentClass,
            celebration.glowClass,
          )}
          style={{ animation: 'casinoPulse 1.8s ease-in-out infinite' }}
        />

        {Array.from({ length: celebration.chipCount }, (_, index) => {
          const left = 4 + ((index * 91) % 92);
          const delay = (index % 6) * 110;
          const duration = 1700 + (index % 5) * 180;
          const size = 20 + (index % 4) * 8;
          const tokens = ['💸', '🪙', '✨', '🎰'];
          return (
            <div
              key={`${celebration.id}-chip-${index}`}
              className="absolute top-0 text-center"
              style={{
                left: `${left}%`,
                fontSize: `${size}px`,
                animation: `casinoFall ${duration}ms linear ${delay}ms infinite`,
              }}
            >
              {tokens[index % tokens.length]}
            </div>
          );
        })}

        {celebration.popupBursts.map((message, index) => (
          <div
            key={`${celebration.id}-popup-${message}-${index}`}
            className={cn(
              'absolute rounded-full border border-white/30 bg-black/65 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-white backdrop-blur-md',
              celebration.glowClass,
            )}
            style={{
              left: `${10 + ((index * 23) % 70)}%`,
              top: `${18 + ((index * 17) % 40)}%`,
              animation: `casinoFloat ${2200 + index * 180}ms ease-out ${index * 120}ms infinite`,
            }}
          >
            {message}
          </div>
        ))}

        <div
          className="absolute left-1/2 top-[10%] w-[min(92vw,42rem)] -translate-x-1/2"
          style={{ animation: 'casinoBanner 4.6s ease-out forwards' }}
        >
          <div className={cn('rounded-[2rem] border border-white/20 bg-black/70 p-5 text-white backdrop-blur-xl', celebration.glowClass)}>
            <div className={cn('inline-flex rounded-full bg-gradient-to-r px-3 py-1 text-[10px] font-black uppercase tracking-[0.32em] text-black', celebration.accentClass)}>
              {CASINO_GAME_LABELS[celebration.game]}
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-black tracking-[0.08em] sm:text-4xl">{celebration.headline}</p>
                <p className="mt-2 max-w-2xl text-sm text-white/80">{celebration.subheadline}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Gain net</p>
                <p className="text-3xl font-black text-emerald-300 sm:text-5xl">+${celebration.netGain.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {celebration.cathyLines.map((line) => (
                <div key={line} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white/90">
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="pointer-events-auto absolute right-4 top-4 rounded-full border border-white/20 bg-black/60 px-3 py-2 text-xs font-semibold text-white/80 backdrop-blur"
        >
          Fermer les effets
        </button>
      </div>
    </>
  );
}

function CasinoFloor({ onChooseTable }: { onChooseTable: (game: GameTab) => void }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#120b08] px-4 py-5 text-white shadow-[0_30px_120px_rgba(0,0,0,0.45)] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,215,140,0.15),transparent_36%),linear-gradient(180deg,rgba(24,11,8,0.55),rgba(8,4,4,0.92)),repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_54px),repeating-linear-gradient(0deg,rgba(255,255,255,0.02)_0,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_54px)]" />
      <div className="absolute inset-x-[10%] top-[14%] h-px bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />
      <div className="absolute inset-x-[14%] bottom-[17%] h-px bg-gradient-to-r from-transparent via-amber-100/20 to-transparent" />
      <div className="absolute left-[50%] top-[10%] h-[80%] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-amber-100/15 to-transparent" />

      <div className="relative mb-6 flex flex-col gap-3 lg:mb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-100/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100/80">
            <CircleDollarSign className="h-3.5 w-3.5" />
            Etage casino
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[0.04em] text-amber-50 sm:text-4xl">
            Choisis une table vue du dessus
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-amber-50/72 sm:text-base">
            Plus de boutons plats. Tu entres dans la salle, tu repères l'ambiance, puis tu t'assois a la table qui te tente.
          </p>
        </div>

        <div className="rounded-[1.4rem] border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-sm">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">Mode d'emploi</p>
          <p className="mt-2 text-sm text-white/75">Clique directement sur une table pour rejoindre le jeu correspondant.</p>
        </div>
      </div>

      <div className="relative grid gap-5 lg:grid-cols-3">
        {CASINO_TABLES.map((table) => (
          <TopDownTableCard
            key={table.id}
            table={table}
            onChooseTable={onChooseTable}
            compact
          />
        ))}
      </div>
    </section>
  );
}

function TopDownTableCard({
  table,
  onChooseTable,
  compact = false,
}: {
  table: (typeof CASINO_TABLES)[number];
  onChooseTable: (game: GameTab) => void;
  compact?: boolean;
}) {
  const Icon = table.icon;

  return (
    <button
      type="button"
      onClick={() => onChooseTable(table.id)}
      className={cn(
        'group relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 text-left transition duration-300 hover:-translate-y-1 hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70',
        table.glowClass,
        compact ? 'min-h-[20rem] p-4 sm:p-5' : 'min-h-[29rem] p-5 sm:p-6',
      )}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-90', table.feltClass)} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_28%,rgba(0,0,0,0.2)_64%,rgba(0,0,0,0.52)_100%)]" />
      <div className="absolute inset-x-[9%] top-[14%] h-[72%] rounded-[2.3rem] border border-white/8 bg-white/4" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/52">Table ouverte</p>
            <h2 className="mt-2 text-2xl font-black tracking-[0.04em] text-white sm:text-3xl">{table.title}</h2>
            <p className="mt-2 text-sm text-white/72">{table.subtitle}</p>
          </div>
          <div className={cn('rounded-full bg-gradient-to-br p-3 text-slate-950 shadow-lg', table.accentClass)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className={cn('relative mx-auto w-full max-w-[30rem]', compact ? 'mt-4 aspect-[1.45/1]' : 'mt-6 aspect-[1.15/1]')}>
          {table.id === 'roulette' ? <RouletteTableIllustration table={table} /> : null}
          {table.id === 'slots' ? <SlotsTableIllustration table={table} /> : null}
          {table.id === 'blackjack' ? <BlackjackTableIllustration table={table} /> : null}
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <p className="max-w-md text-sm leading-6 text-white/70">{table.caption}</p>
          <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80 transition group-hover:bg-white/16 group-hover:text-white">
            {table.seatLabel}
          </div>
        </div>
      </div>
    </button>
  );
}

function RouletteTableIllustration({ table }: { table: (typeof CASINO_TABLES)[number] }) {
  return (
    <>
      <div className="absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[16px] border-[#4d2418] bg-[#5c2f21] shadow-[0_0_0_2px_rgba(255,255,255,0.08),0_30px_60px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-[10%] rounded-full border border-amber-200/15 bg-[radial-gradient(circle_at_center,#1f7a45_0%,#14532d_55%,#0b1f14_100%)]" />
        <div className="absolute inset-[18%] rounded-full border border-white/10" />
        <div className="absolute inset-[26%] rounded-full bg-[conic-gradient(from_-90deg,#15803d_0deg_12deg,#111827_12deg_24deg,#b91c1c_24deg_36deg,#111827_36deg_48deg,#b91c1c_48deg_60deg,#111827_60deg_72deg,#b91c1c_72deg_84deg,#111827_84deg_96deg,#b91c1c_96deg_108deg,#111827_108deg_120deg,#b91c1c_120deg_132deg,#111827_132deg_144deg,#b91c1c_144deg_156deg,#111827_156deg_168deg,#b91c1c_168deg_180deg,#111827_180deg_192deg,#b91c1c_192deg_204deg,#111827_204deg_216deg,#b91c1c_216deg_228deg,#111827_228deg_240deg,#b91c1c_240deg_252deg,#111827_252deg_264deg,#b91c1c_264deg_276deg,#111827_276deg_288deg,#b91c1c_288deg_300deg,#111827_300deg_312deg,#b91c1c_312deg_324deg,#111827_324deg_336deg,#b91c1c_336deg_348deg,#111827_348deg_360deg)] shadow-inner" />
        <div className="absolute inset-[39%] rounded-full border border-amber-200/20 bg-[#3f271d]" />
        <div className="absolute inset-[45%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#fde68a,#f59e0b_62%,#78350f)]" />
      </div>

      {table.chips.map((chip) => (
        <div
          key={`${chip.left}-${chip.top}`}
          className="absolute h-8 w-8 rounded-full border-[3px] border-white/70 shadow-[0_10px_18px_rgba(0,0,0,0.28)]"
          style={{ top: chip.top, left: chip.left, background: chip.color }}
        />
      ))}

      {[
        { top: '50%', left: '4%', rotate: '-90deg' },
        { top: '50%', right: '4%', rotate: '90deg' },
        { top: '4%', left: '50%', rotate: '0deg' },
        { bottom: '4%', left: '50%', rotate: '180deg' },
      ].map((seat, index) => (
        <div
          key={index}
          className="absolute h-14 w-14 rounded-full border border-white/10 bg-[#2a1511] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(0,0,0,0.35)]"
          style={{ ...seat, transform: `translate(-50%, -50%) rotate(${seat.rotate})` }}
        />
      ))}
    </>
  );
}

function SlotsTableIllustration({ table }: { table: (typeof CASINO_TABLES)[number] }) {
  return (
    <>
      <div className="absolute inset-x-[10%] top-[18%] h-[64%] rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,15,40,0.88),rgba(22,28,62,0.95))] shadow-[0_24px_44px_rgba(0,0,0,0.34)]">
        <div className="absolute inset-x-[7%] top-[14%] h-[44%] rounded-[1.4rem] border border-cyan-200/15 bg-[#0a1028] p-3">
          <div className="grid h-full grid-cols-3 gap-2">
            {['7', '★', '♦'].map((symbol, index) => (
              <div
                key={symbol}
                className="flex items-center justify-center rounded-[1rem] border border-white/10 bg-white/6 text-3xl font-black text-white shadow-inner"
                style={{ color: index === 0 ? '#facc15' : index === 1 ? '#ffffff' : '#fb7185' }}
              >
                {symbol}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute left-[11%] top-[67%] text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100/65">
          Jackpot Lane
        </div>
        <div className="absolute right-[11%] top-[60%] h-[22%] w-[10%] rounded-full border border-amber-200/25 bg-[linear-gradient(180deg,#f59e0b,#b45309)] shadow-[0_10px_20px_rgba(0,0,0,0.3)]" />
        <div className="absolute right-[4%] top-[47%] h-[8%] w-[14%] rounded-full bg-[#ef4444] shadow-[0_0_26px_rgba(239,68,68,0.45)]" />
      </div>

      {table.chips.map((chip) => (
        <div
          key={`${chip.left}-${chip.top}`}
          className="absolute h-7 w-7 rounded-full border-[3px] border-white/70 shadow-[0_10px_18px_rgba(0,0,0,0.28)]"
          style={{ top: chip.top, left: chip.left, background: chip.color }}
        />
      ))}

      <div className="absolute inset-x-[12%] bottom-[10%] h-[14%] rounded-full border border-white/8 bg-black/25" />
    </>
  );
}

function BlackjackTableIllustration({ table }: { table: (typeof CASINO_TABLES)[number] }) {
  return (
    <>
      <div className="absolute inset-x-[8%] bottom-[9%] top-[16%] rounded-[2.4rem] border-[14px] border-[#4d2418] bg-[#0f5132] shadow-[0_28px_54px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-[4%] rounded-[1.7rem] border border-amber-100/14" />
        <div className="absolute inset-x-[14%] top-[14%] h-[18%] rounded-full border border-white/10 bg-black/12" />
        <div className="absolute inset-x-[10%] bottom-[12%] h-[46%] rounded-t-[999px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_58%)]" />

        {[
          { left: '18%', top: '24%', rotate: '-8deg', label: 'A', suit: '♠' },
          { left: '66%', top: '26%', rotate: '9deg', label: '10', suit: '♦' },
          { left: '31%', top: '58%', rotate: '-10deg', label: 'K', suit: '♣' },
          { left: '57%', top: '60%', rotate: '10deg', label: '7', suit: '♥' },
        ].map((card) => (
          <div
            key={`${card.label}-${card.suit}`}
            className="absolute h-[24%] w-[18%] rounded-[1rem] border border-slate-300/50 bg-[linear-gradient(180deg,#ffffff,#f6f1ea)] p-2 shadow-[0_14px_22px_rgba(0,0,0,0.22)]"
            style={{ left: card.left, top: card.top, transform: `rotate(${card.rotate})` }}
          >
            <div className={cn('text-xs font-black leading-none', card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-slate-900')}>
              {card.label}
            </div>
            <div className={cn('mt-1 text-base', card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-slate-900')}>
              {card.suit}
            </div>
          </div>
        ))}
      </div>

      {table.chips.map((chip) => (
        <div
          key={`${chip.left}-${chip.top}`}
          className="absolute h-7 w-7 rounded-full border-[3px] border-white/70 shadow-[0_10px_18px_rgba(0,0,0,0.28)]"
          style={{ top: chip.top, left: chip.left, background: chip.color }}
        />
      ))}
    </>
  );
}

// -----------------------------
// Main Casino page
// -----------------------------
export default function Casino() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [celebration, setCelebration] = useState<CasinoCelebration | null>(null);
  const tableParam = searchParams.get('table');
  const activeGame: GameTab | null = isGameTab(tableParam) ? tableParam : null;

  useEffect(() => {
    if (!celebration) return undefined;

    const duration =
      celebration.tier === 'jackpot'
        ? 9000
        : celebration.tier === 'mega'
          ? 7500
          : celebration.tier === 'big'
            ? 6200
            : 4800;

    const timeout = window.setTimeout(() => {
      setCelebration((current) => (current?.id === celebration.id ? null : current));
    }, duration);

    return () => window.clearTimeout(timeout);
  }, [celebration]);

  const triggerCelebration = useCallback((game: CasinoCelebrationGame, netGain: number, grossWin: number, bet: number) => {
    const nextCelebration = buildCelebration(game, netGain, grossWin, bet);
    if (nextCelebration) {
      setCelebration(nextCelebration);
    }
  }, []);

  const openTable = useCallback((game: GameTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('table', game);
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  const leaveTable = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('table');
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  return (
    <PageShell size="wide">
      <CasinoCelebrationLayer celebration={celebration} onDismiss={() => setCelebration(null)} />
      {activeGame ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between rounded-[1.4rem] border border-border/70 bg-card/70 px-4 py-3 backdrop-blur-sm">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Table active</p>
              <p className="mt-1 text-lg font-semibold">{CASINO_GAME_LABELS[activeGame]}</p>
            </div>
            <Button variant="outline" size="sm" onClick={leaveTable}>
              Revenir au plan du casino
            </Button>
          </div>
          {activeGame === 'roulette' ? (
            <RouletteGame onExit={leaveTable} onCelebrate={triggerCelebration} />
          ) : activeGame === 'slots' ? (
            <SlotMachineGame onBetChange={() => {}} onCelebrate={triggerCelebration} />
          ) : (
            <BlackjackGame onBetChange={() => {}} onCelebrate={triggerCelebration} />
          )}
        </section>
      ) : (
        <CasinoFloor onChooseTable={openTable} />
      )}
    </PageShell>
  );
}

// -----------------------------
// Roulette Game Component
// -----------------------------
const getBetLabel = (bet: Bet): string => {
  switch (bet.type) {
    case 'straight': return `No. ${bet.value}`;
    case 'color': return bet.value === 'red' ? 'Rouge' : 'Noir';
    case 'parity': return bet.value === 'even' ? 'Pair' : 'Impair';
    case 'range': return bet.value === 'low' ? '1–18' : '19–36';
    case 'dozen': return `Douzaine ${bet.value}`;
    case 'column': return `Colonne ${bet.value}`;
    default: return String(bet.value);
  }
};

function RouletteGame({
  onExit,
  onCelebrate,
}: {
  onExit?: () => void;
  onCelebrate?: (game: CasinoCelebrationGame, netGain: number, grossWin: number, bet: number) => void;
}) {
  const { user, refreshUser } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [chipValue, setChipValue] = useState(25);
  const [customChipDraft, setCustomChipDraft] = useState('');
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

  const wheelGradient = useMemo(() => {
    const segments = WHEEL_NUMBERS.map((num, idx) => {
      const start = (idx * SLICE_ANGLE).toFixed(2);
      const end = ((idx + 1) * SLICE_ANGLE).toFixed(2);
      const color =
        getNumberColor(num) === 'red'
          ? '#b91c1c'
          : getNumberColor(num) === 'black'
            ? '#000000'
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

    const ballExtraSpins = 6 + Math.floor(Math.random() * 5); // 6 to 10 turns, opposite direction
    const targetWorldAngle = targetWheelRotation + WHEEL_OFFSET + pocketCenter;
    // Ensure ball always moves counter-clockwise (decreasing angle) regardless of cumulative rotation
    let targetBallRotation = targetWorldAngle - ballExtraSpins * 360;
    while (targetBallRotation >= ballRotation) {
      targetBallRotation -= 360;
    }

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
      onCelebrate?.('roulette', net, payout, totalBet);

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
    onCelebrate,
    refreshUser,
  ]);

  const getBetFor = (type: BetType, value: number | string) =>
    bets.find((bet) => bet.type === type && bet.value === value);

  const applyCustomChip = () => {
    const v = Math.floor(Number(customChipDraft));
    if (v >= 1) {
      setChipValue(v);
      setCustomChipDraft('');
    }
  };

  const canSpin = user && totalBet > 0 && !spinning && (user.money >= totalBet);

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr_300px]">

      {/* LEFT: Mise selection */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium">Valeur du jeton</CardTitle>
          <p className="text-xs text-muted-foreground">Sélectionné: <span className="font-semibold text-foreground">${chipValue}</span></p>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-2 gap-1.5">
            {CHIP_VALUES.map((value) => (
              <Button
                key={value}
                size="sm"
                variant={chipValue === value ? 'default' : 'outline'}
                onClick={() => setChipValue(value)}
                disabled={spinning}
                className="text-xs"
              >
                ${value}
              </Button>
            ))}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Mise personnalisée</p>
            <div className="flex gap-1.5">
              <Input
                type="number"
                min={1}
                placeholder="Ex: 75"
                value={customChipDraft}
                onChange={(e) => setCustomChipDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyCustomChip(); }}
                disabled={spinning}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={applyCustomChip} disabled={spinning}>
                OK
              </Button>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Separator />

          <div className="space-y-2">
            <Button className="w-full" onClick={spinWheel} disabled={!canSpin}>
              {spinning ? <RotateCcw className="mr-2 h-4 w-4 animate-spin" /> : null}
              {spinning ? 'En cours...' : 'Lancer la roue'}
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={clearBets}
              disabled={spinning || bets.length === 0}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CENTER: Wheel + info */}
      <div className="flex flex-col items-center gap-3">
        {/* Cash + mises */}
        <div className="flex gap-3 w-full justify-center items-center">
          {onExit && (
            <Button variant="outline" size="sm" onClick={onExit}>
              Changer de jeu
            </Button>
          )}
          <Card className="flex-1 max-w-[160px]">
            <CardContent className="px-4 py-2.5">
              <p className="text-xs text-muted-foreground">Solde</p>
              <p className="text-base font-semibold tabular-nums">${user?.money.toLocaleString() || 0}</p>
            </CardContent>
          </Card>
          <Card className="flex-1 max-w-[160px]">
            <CardContent className="px-4 py-2.5">
              <p className="text-xs text-muted-foreground">Mises en cours</p>
              <p className="text-base font-semibold tabular-nums">${totalBet.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Wheel */}
        <div className="relative aspect-square w-4/5 mx-auto">
          {/* Rotating wheel */}
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              transform: `rotate(${wheelRotation}deg)`,
              transition: `transform ${SPIN_DURATION}ms cubic-bezier(0.21, 0.8, 0.34, 1)`,
            }}
          >
            <div className="absolute inset-0" style={{ background: wheelGradient }} />
            {/* Pocket dividers */}
            {WHEEL_NUMBERS.map((_, idx) => {
              const angle = WHEEL_OFFSET + idx * SLICE_ANGLE;
              return (
                <div
                  key={`div-${idx}`}
                  className="absolute inset-0"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <div className="absolute left-1/2 top-0 h-[22%] w-px -translate-x-1/2 bg-white/25" />
                </div>
              );
            })}
            {/* Numbers — pushed to the very top of each pocket */}
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
                    className="absolute left-1/2 -translate-x-1/2 text-[15px] font-bold leading-none"
                    style={{
                      top: '3%',
                      color: color === 'red' ? '#ffd0d0' : '#ffffff',
                      textShadow: '0 2px 0 rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6), 1px 1px 0 rgba(0,0,0,0.8)',
                    }}
                  >
                    {num}
                  </div>
                </div>
              );
            })}

            {/* Inner hub background — inside rotating div (rotation doesn't matter for a circle) */}
            <div className="absolute inset-[22%] rounded-full bg-zinc-950 border border-white/10 shadow-inner" />
            <div className="absolute inset-[40%] rounded-full bg-zinc-900 border border-white/20 shadow-inner" />
            <div className="absolute inset-[46%] rounded-full bg-zinc-950" />

            {/* Cross handle — rendered last so it sits on top of the hub circles */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative" style={{ width: '14%', height: '14%' }}>
                <div
                  className="absolute top-1/2 inset-x-0 h-[16%] -translate-y-1/2 rounded-full"
                  style={{ background: 'linear-gradient(to bottom, #f5d060, #c8960c 50%, #7a5a0a)', boxShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
                />
                <div
                  className="absolute left-1/2 inset-y-0 w-[16%] -translate-x-1/2 rounded-full"
                  style={{ background: 'linear-gradient(to right, #7a5a0a, #c8960c 30%, #f5d060 50%, #c8960c 70%, #7a5a0a)', boxShadow: '1px 0 3px rgba(0,0,0,0.7)' }}
                />
                {[
                  { style: { left: 0, top: '50%', transform: 'translate(-50%, -50%)' } },
                  { style: { right: 0, top: '50%', transform: 'translate(50%, -50%)' } },
                  { style: { top: 0, left: '50%', transform: 'translate(-50%, -50%)' } },
                  { style: { bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' } },
                ].map((knob, i) => (
                  <div
                    key={i}
                    className="absolute w-[22%] h-[22%] rounded-full"
                    style={{
                      ...knob.style,
                      background: 'radial-gradient(circle at 35% 30%, #f5d060, #c8960c 55%, #7a5a0a)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    }}
                  />
                ))}
                <div
                  className="absolute inset-[28%] rounded-full"
                  style={{
                    background: 'radial-gradient(circle at 35% 30%, #f5d060, #c8960c 55%, #7a5a0a)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Golden outer rim (non-rotating) */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none z-10"
            style={{
              boxShadow: 'inset 0 0 0 4px #7a5a0a, inset 0 0 0 6px #c8960c, inset 0 0 0 8px #7a5a0a, 0 0 18px rgba(0,0,0,0.7)',
            }}
          />

          {/* Ball layer (counter-rotating) */}
          <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              transform: `rotate(${ballRotation}deg)`,
              transition: `transform ${BALL_DURATION}ms cubic-bezier(0.17, 0.84, 0.44, 1.02)`,
            }}
          >
            <div
              className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border border-zinc-300"
              style={{
                top: '8%',
                transform: 'translateX(-50%)',
                background: 'radial-gradient(circle at 35% 30%, #ffffff, #c8c8c8 60%, #888)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
              }}
            />
          </div>

          {/* Translucent gloss overlay (non-rotating) */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none z-30"
            style={{
              background: 'radial-gradient(ellipse at 38% 30%, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)',
            }}
          />

        </div>

        {/* Last result */}
        {lastResult ? (
          <Card className="w-full max-w-full">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded text-sm font-bold text-white',
                    lastResult.color === 'red' ? 'bg-red-700' : lastResult.color === 'black' ? 'bg-zinc-800 border border-zinc-600' : 'bg-green-700'
                  )}
                >
                  {lastResult.number}
                </div>
                <div>
                  <p className="text-xs font-medium">
                    {lastResult.color === 'red' ? 'Rouge' : lastResult.color === 'black' ? 'Noir' : 'Vert'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Dernier tirage</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-semibold', lastResult.net >= 0 ? 'text-green-500' : 'text-red-400')}>
                  {lastResult.net >= 0 ? '+' : ''}${lastResult.net.toLocaleString()}
                </p>
                {rewards && rewards.aura > 0 && (
                  <p className="text-[10px] text-muted-foreground">+{rewards.aura} aura</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-full border-dashed">
            <CardContent className="p-3 text-center text-xs text-muted-foreground">
              Place tes jetons et lance la roue
            </CardContent>
          </Card>
        )}

        {/* Active bets summary */}
        {bets.length > 0 && (
          <Card className="w-full max-w-full">
            <CardHeader className="px-3 pt-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">Mises placées ({bets.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1">
              {bets.map((bet, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{getBetLabel(bet)}</span>
                  <span className="font-medium">${bet.amount.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT: Betting table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-3">
          <CardTitle className="text-sm font-medium">Paris</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-4 space-y-3">
          {/* Large outside bets - rouge / noir */}
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="outline"
              onClick={() => placeBet('color', 'red')}
              disabled={spinning}
              className="relative h-14 bg-red-950/40 hover:bg-red-900/60 border-red-800/50 text-red-200 hover:text-red-100 font-semibold"
            >
              Rouge
              {getBetFor('color', 'red') && (
                <Badge className="absolute -top-1.5 -right-1.5 text-[9px] h-4 px-1 bg-yellow-500 text-black">
                  ${getBetFor('color', 'red')!.amount}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => placeBet('color', 'black')}
              disabled={spinning}
              className="relative h-14 bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-600/50 font-semibold"
            >
              Noir
              {getBetFor('color', 'black') && (
                <Badge className="absolute -top-1.5 -right-1.5 text-[9px] h-4 px-1 bg-yellow-500 text-black">
                  ${getBetFor('color', 'black')!.amount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Medium bets: pair/impair, ranges */}
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                { label: 'Pair', type: 'parity', value: 'even' },
                { label: 'Impair', type: 'parity', value: 'odd' },
                { label: '1–18', type: 'range', value: 'low' },
                { label: '19–36', type: 'range', value: 'high' },
              ] as const
            ).map(({ label, type, value }) => (
              <Button
                key={`${type}-${value}`}
                variant="outline"
                size="sm"
                onClick={() => placeBet(type, value)}
                disabled={spinning}
                className="relative h-9 text-xs font-medium"
              >
                {label}
                {getBetFor(type, value) && (
                  <Badge className="absolute -top-1.5 -right-1.5 text-[9px] h-4 px-1 bg-yellow-500 text-black">
                    ${getBetFor(type, value)!.amount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {/* Dozens + columns */}
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3].map((d) => (
              <Button
                key={`dozen-${d}`}
                variant="outline"
                size="sm"
                onClick={() => placeBet('dozen', d)}
                disabled={spinning}
                className="relative h-7 text-[10px] px-1"
              >
                {d === 1 ? '1-12' : d === 2 ? '13-24' : '25-36'}
                {getBetFor('dozen', d) && (
                  <Badge className="absolute -top-1.5 -right-1.5 text-[9px] h-4 px-1 bg-yellow-500 text-black">
                    ${getBetFor('dozen', d)!.amount}
                  </Badge>
                )}
              </Button>
            ))}
            {[1, 2, 3].map((c) => (
              <Button
                key={`col-${c}`}
                variant="outline"
                size="sm"
                onClick={() => placeBet('column', c)}
                disabled={spinning}
                className="relative h-7 text-[10px] px-1"
              >
                Col {c}
                {getBetFor('column', c) && (
                  <Badge className="absolute -top-1.5 -right-1.5 text-[9px] h-4 px-1 bg-yellow-500 text-black">
                    ${getBetFor('column', c)!.amount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          <Separator />

          {/* Number grid - compact 3-col */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5">Numéro plein (×36)</p>
            {/* Zero */}
            <div className="mb-0.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => placeBet('straight', 0)}
                disabled={spinning}
                className={cn(
                  'relative w-full h-6 text-[10px] bg-green-950/40 border-green-800/50 text-green-300 hover:bg-green-900/50',
                  getBetFor('straight', 0) && 'ring-1 ring-yellow-400'
                )}
              >
                0
                {getBetFor('straight', 0) && (
                  <Badge className="absolute -top-1.5 -right-1.5 text-[9px] h-4 px-1 bg-yellow-500 text-black">
                    ${getBetFor('straight', 0)!.amount}
                  </Badge>
                )}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-0.5">
              {TABLE_ROWS.map((row) =>
                row.map((num) => {
                  const color = getNumberColor(num);
                  const hasBet = getBetFor('straight', num);
                  return (
                    <Button
                      key={num}
                      variant="ghost"
                      size="sm"
                      onClick={() => placeBet('straight', num)}
                      disabled={spinning}
                      className={cn(
                        'relative h-6 p-0 text-[10px] font-medium border',
                        color === 'red'
                          ? 'bg-red-950/30 border-red-900/40 text-red-300 hover:bg-red-900/50'
                          : 'bg-zinc-900/30 border-zinc-800/40 text-zinc-300 hover:bg-zinc-800/50',
                        hasBet && 'ring-1 ring-yellow-400'
                      )}
                    >
                      {num}
                      {hasBet && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        </div>
                      )}
                    </Button>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------
// Blackjack Component
// -----------------------------
function BlackjackGame({
  onBetChange,
  onCelebrate,
}: {
  onBetChange?: (value: number) => void;
  onCelebrate?: (game: CasinoCelebrationGame, netGain: number, grossWin: number, bet: number) => void;
}) {
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
      onCelebrate?.('blackjack', net, payoutAmount, totalRoundBet);

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
    [onCelebrate, refreshUser, user]
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
function SlotMachineGame({
  onBetChange,
  onCelebrate,
}: {
  onBetChange?: (value: number) => void;
  onCelebrate?: (game: CasinoCelebrationGame, netGain: number, grossWin: number, bet: number) => void;
}) {
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
      const netGain = result.winAmount - bet;
      
      setReels(finalReels);
      setWinAmount(result.winAmount);
      setLastResult({ reels: finalReels, ...result });
      setIsSpinning(false);
      onCelebrate?.('slots', netGain, result.winAmount, bet);

      try {
        const response = await gamesApi.complete('casino', {
          score: result.winAmount,
          won: result.winAmount > 0,
          bet,
          netGain,
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
  }, [bet, user, spinning, refreshUser, onCelebrate]);

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
