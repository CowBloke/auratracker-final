import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

type DefenseType = 'FORTRESS' | 'ARMORY' | 'BANNER' | 'STAR';

interface MemoryCard {
  id: number;
  type: DefenseType;
  isFlipped: boolean;
  isMatched: boolean;
}

const ICONS: Record<DefenseType, string> = {
  FORTRESS: '🏰',
  ARMORY: '⚔️',
  BANNER: '🚩',
  STAR: '⭐',
};

const CARD_COLORS: Record<DefenseType, string> = {
  FORTRESS: 'border-amber-500/60 bg-amber-500/15 text-amber-300',
  ARMORY: 'border-rose-500/60 bg-rose-500/15 text-rose-300',
  BANNER: 'border-sky-500/60 bg-sky-500/15 text-sky-300',
  STAR: 'border-purple-500/60 bg-purple-500/15 text-purple-300',
};

const PAIR_SEQUENCE: DefenseType[] = [
  'FORTRESS', 'FORTRESS',
  'ARMORY', 'ARMORY',
  'BANNER', 'BANNER',
  'FORTRESS', 'FORTRESS',
  'ARMORY', 'ARMORY',
  'BANNER', 'BANNER',
  'STAR', 'STAR',
  'STAR', 'STAR',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface MemoryGameProps {
  isPractice: boolean;
  onComplete: (result: { matchedPairs: Record<string, number>; score: number }) => void;
  onClose: () => void;
}

export function MemoryGame({ isPractice, onComplete }: MemoryGameProps) {
  const [cards, setCards] = useState<MemoryCard[]>(() =>
    shuffle(PAIR_SEQUENCE).map((type, i) => ({ id: i, type, isFlipped: false, isMatched: false }))
  );
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matched, setMatched] = useState<Record<string, number>>({ FORTRESS: 0, ARMORY: 0, BANNER: 0, STAR: 0 });
  const [timeLeft, setTimeLeft] = useState(90);
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isOver = done || timeLeft <= 0;

  useEffect(() => {
    if (isOver) return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [isOver]);

  const handleClick = useCallback(
    (id: number) => {
      if (checking || isOver) return;
      const card = cards.find((c) => c.id === id);
      if (!card || card.isFlipped || card.isMatched) return;
      if (flipped.length >= 2) return;

      const newFlipped = [...flipped, id];
      const updated = cards.map((c) => (c.id === id ? { ...c, isFlipped: true } : c));
      setCards(updated);
      setFlipped(newFlipped);

      if (newFlipped.length === 2) {
        setMoves((m) => m + 1);
        setChecking(true);
        const [id1, id2] = newFlipped;
        const c1 = updated.find((c) => c.id === id1)!;
        const c2 = updated.find((c) => c.id === id2)!;

        setTimeout(() => {
          if (c1.type === c2.type) {
            setCards((prev) => {
              const next = prev.map((c) =>
                c.id === id1 || c.id === id2 ? { ...c, isMatched: true } : c
              );
              if (next.every((c) => c.isMatched)) setDone(true);
              return next;
            });
            setMatched((prev) => ({ ...prev, [c1.type]: (prev[c1.type] ?? 0) + 1 }));
          } else {
            setCards((prev) =>
              prev.map((c) => (c.id === id1 || c.id === id2 ? { ...c, isFlipped: false } : c))
            );
          }
          setFlipped([]);
          setChecking(false);
        }, 700);
      }
    },
    [cards, flipped, checking, isOver]
  );

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    const totalMatched = Object.values(matched).reduce((a, b) => a + b, 0);
    const score = totalMatched * 100 + Math.floor(timeLeft * 2) - moves * 3;
    onComplete({
      matchedPairs: { FORTRESS: matched.FORTRESS, ARMORY: matched.ARMORY, BANNER: matched.BANNER },
      score: Math.max(0, score),
    });
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-2 text-sm">
        <span className="text-muted-foreground">
          ⏱ <span className={cn('font-mono font-semibold', timeLeft <= 15 && 'text-rose-400')}>{timeLeft}s</span>
        </span>
        <div className="flex gap-3">
          {(['FORTRESS', 'ARMORY', 'BANNER'] as const).map((t) => (
            <span key={t} className={cn('rounded-md px-2 py-0.5 text-xs font-medium', CARD_COLORS[t])}>
              {ICONS[t]} ×{matched[t]}
            </span>
          ))}
        </div>
        <span className="text-muted-foreground">{moves} {t('memory_moves')}</span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-4 gap-2">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => handleClick(card.id)}
            disabled={card.isMatched || card.isFlipped || checking || isOver}
            className={cn(
              'aspect-square rounded-xl border-2 text-2xl transition-all duration-200 select-none',
              card.isMatched
                ? cn('scale-95 opacity-70', CARD_COLORS[card.type])
                : card.isFlipped
                  ? cn('scale-105 shadow-lg', CARD_COLORS[card.type])
                  : 'cursor-pointer border-border/40 bg-muted/25 hover:bg-muted/50 hover:scale-105 active:scale-95'
            )}
          >
            {card.isFlipped || card.isMatched ? ICONS[card.type] : '?'}
          </button>
        ))}
      </div>

      {/* End state */}
      {isOver && (
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center space-y-3">
          <div className="text-base font-semibold">
            {done ? t('memory_win_message') : t('memory_timeout_message')}
          </div>
          <div className="flex justify-center gap-4 text-sm text-muted-foreground">
              {(['FORTRESS', 'ARMORY', 'BANNER'] as const).map((type) => (
                <span key={type}>{ICONS[type]} {matched[type]} {t('memory_pairs')}</span>
            ))}
          </div>
          {!isPractice ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitted}
              className="rounded-xl bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {t('memory_submit')}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">{t('memory_practice_note')}</p>
          )}
        </div>
      )}
    </div>
  );
}
