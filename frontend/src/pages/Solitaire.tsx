import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';
import { cn } from '@/lib/utils';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  id: string;
  suit: Suit;
  rank: number;
  faceUp: boolean;
}

interface LeaderboardEntry {
  id: string;
  highScore: number;
  user: {
    id: string;
    username: string;
  };
}

interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Record<Suit, Card[]>;
  tableau: Card[][];
}

type DragSource =
  | { type: 'waste' }
  | { type: 'foundation'; suit: Suit }
  | { type: 'tableau'; pileIndex: number; cardIndex: number };

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};
const RANK_LABEL = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const isRed = (suit: Suit) => suit === 'hearts' || suit === 'diamonds';

const getCardColorClass = (suit: Suit) => (isRed(suit) ? 'text-rose-600' : 'text-slate-900');

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const createDeck = (): Card[] => {
  const deck: Card[] = [];
  SUITS.forEach((suit) => {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({
        id: `${suit}-${rank}-${Math.random().toString(36).slice(2, 8)}`,
        suit,
        rank,
        faceUp: false,
      });
    }
  });
  return shuffle(deck);
};

const createInitialGame = (): GameState => {
  const deck = createDeck();
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);

  for (let pile = 0; pile < 7; pile += 1) {
    for (let i = 0; i <= pile; i += 1) {
      const card = deck.pop();
      if (!card) {
        break;
      }
      tableau[pile].push({
        ...card,
        faceUp: i === pile,
      });
    }
  }

  return {
    stock: deck,
    waste: [],
    foundations: {
      hearts: [],
      diamonds: [],
      clubs: [],
      spades: [],
    },
    tableau,
  };
};

const canPlaceOnFoundation = (card: Card, foundation: Card[]) => {
  if (foundation.length === 0) {
    return card.rank === 1;
  }
  const top = foundation[foundation.length - 1];
  return top.suit === card.suit && card.rank === top.rank + 1;
};

const canPlaceOnTableau = (card: Card, pile: Card[]) => {
  if (pile.length === 0) {
    return card.rank === 13;
  }
  const top = pile[pile.length - 1];
  if (!top.faceUp) {
    return false;
  }
  return isRed(top.suit) !== isRed(card.suit) && card.rank === top.rank - 1;
};

const computeScore = (moves: number, seconds: number) => Math.max(0, 10000 - seconds - moves * 2);

function SolitaireCard({
  card,
  draggable,
  onDragStart,
  onDragEnd,
  onDoubleClick,
}: {
  card: Card;
  draggable: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDoubleClick?: () => void;
}) {
  if (!card.faceUp) {
    return (
      <div className="h-[calc(var(--card-w)*1.4)] w-[var(--card-w)] rounded-xl border border-blue-900/60 bg-gradient-to-br from-blue-500 via-indigo-700 to-blue-900 shadow-lg">
        <div className="h-full w-full rounded-xl border-2 border-blue-200/20 p-1">
          <div className="h-full w-full rounded-lg bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_42%),repeating-linear-gradient(45deg,rgba(255,255,255,0.16),rgba(255,255,255,0.16)_6px,transparent_6px,transparent_12px)]" />
        </div>
      </div>
    );
  }

  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable || !onDragStart) {
          return;
        }
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDoubleClick={onDoubleClick}
      onDragEnd={onDragEnd}
      className={cn(
        'h-[calc(var(--card-w)*1.4)] w-[var(--card-w)] rounded-xl border border-slate-300 bg-gradient-to-b from-white to-slate-100 p-2 shadow-md transition',
        draggable && 'cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-xl'
      )}
    >
      <div className="flex h-full flex-col justify-between">
        <div className={cn('text-sm font-bold leading-none', getCardColorClass(card.suit))}>
          <div>{RANK_LABEL[card.rank - 1]}</div>
          <div>{SUIT_SYMBOL[card.suit]}</div>
        </div>
        <div className={cn('text-center text-3xl', getCardColorClass(card.suit))}>{SUIT_SYMBOL[card.suit]}</div>
        <div className={cn('rotate-180 self-end text-sm font-bold leading-none', getCardColorClass(card.suit))}>
          <div>{RANK_LABEL[card.rank - 1]}</div>
          <div>{SUIT_SYMBOL[card.suit]}</div>
        </div>
      </div>
    </div>
  );
}

export default function Solitaire() {
  const { user, refreshUser } = useAuth();

  const [game, setGame] = useState<GameState>(() => createInitialGame());
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [hasSubmittedResult, setHasSubmittedResult] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const score = useMemo(() => computeScore(moves, seconds), [moves, seconds]);
  const completedCards = useMemo(
    () => SUITS.reduce((sum, suit) => sum + game.foundations[suit].length, 0),
    [game.foundations]
  );

  const fetchStats = async () => {
    if (!user) {
      return;
    }
    try {
      const response = await gamesApi.getStats('solitaire', user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch solitaire stats:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await gamesApi.getLeaderboard('solitaire', 12);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch solitaire leaderboard:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [user]);

  useEffect(() => {
    if (isWon) {
      return;
    }
    const interval = window.setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isWon]);

  const submitResult = async (won: boolean, finalScore: number) => {
    if (hasSubmittedResult || !user) {
      return;
    }

    setHasSubmittedResult(true);

    try {
      const response = await gamesApi.complete('solitaire', {
        score: finalScore,
        won,
      });

      setRewards({
        money: response.data.moneyReward,
        aura: response.data.auraReward,
      });
      setIsNewHighScore(response.data.isNewHighScore);
      if (response.data.isNewHighScore) {
        setHighScore(finalScore);
      }
      await refreshUser();
      fetchLeaderboard();
    } catch (error) {
      console.error('Failed to submit solitaire result:', error);
      setHasSubmittedResult(false);
    }
  };

  useEffect(() => {
    if (completedCards === 52 && !isWon) {
      setIsWon(true);
      submitResult(true, score);
    }
  }, [completedCards, isWon, score]);

  const getDraggedCards = (source: DragSource): Card[] => {
    if (source.type === 'waste') {
      const top = game.waste[game.waste.length - 1];
      return top ? [top] : [];
    }

    if (source.type === 'foundation') {
      const foundation = game.foundations[source.suit];
      const top = foundation[foundation.length - 1];
      return top ? [top] : [];
    }

    const pile = game.tableau[source.pileIndex];
    return pile.slice(source.cardIndex);
  };

  const canDropToFoundation = (targetSuit: Suit, sourceOverride?: DragSource) => {
    const source = sourceOverride ?? dragSource;
    if (!source) {
      return false;
    }

    const cards = getDraggedCards(source);
    if (cards.length !== 1) {
      return false;
    }

    const [card] = cards;
    if (card.suit !== targetSuit) {
      return false;
    }

    if (source.type === 'foundation' && source.suit === targetSuit) {
      return false;
    }

    return canPlaceOnFoundation(card, game.foundations[targetSuit]);
  };

  const canDropToTableau = (targetPileIndex: number, sourceOverride?: DragSource) => {
    const source = sourceOverride ?? dragSource;
    if (!source) {
      return false;
    }

    const cards = getDraggedCards(source);
    if (cards.length === 0) {
      return false;
    }

    if (source.type === 'tableau' && source.pileIndex === targetPileIndex) {
      return false;
    }

    return canPlaceOnTableau(cards[0], game.tableau[targetPileIndex]);
  };

  const applyMove = (
    target: { type: 'foundation'; suit: Suit } | { type: 'tableau'; pileIndex: number },
    sourceOverride?: DragSource
  ) => {
    const source = sourceOverride ?? dragSource;
    if (!source) {
      return;
    }

    const cards = getDraggedCards(source);
    if (cards.length === 0) {
      return;
    }

    if (target.type === 'foundation') {
      if (!canDropToFoundation(target.suit, source)) {
        return;
      }
    }

    if (target.type === 'tableau') {
      if (!canDropToTableau(target.pileIndex, source)) {
        return;
      }
    }

    setGame((prev) => {
      const next: GameState = {
        stock: [...prev.stock],
        waste: [...prev.waste],
        foundations: {
          hearts: [...prev.foundations.hearts],
          diamonds: [...prev.foundations.diamonds],
          clubs: [...prev.foundations.clubs],
          spades: [...prev.foundations.spades],
        },
        tableau: prev.tableau.map((pile) => [...pile]),
      };

      let movedCards: Card[] = [];

      if (source.type === 'waste') {
        const top = next.waste.pop();
        movedCards = top ? [top] : [];
      }

      if (source.type === 'foundation') {
        const top = next.foundations[source.suit].pop();
        movedCards = top ? [top] : [];
      }

      if (source.type === 'tableau') {
        const pile = next.tableau[source.pileIndex];
        movedCards = pile.splice(source.cardIndex);
        const newTop = pile[pile.length - 1];
        if (newTop && !newTop.faceUp) {
          pile[pile.length - 1] = { ...newTop, faceUp: true };
        }
      }

      if (target.type === 'foundation') {
        next.foundations[target.suit].push(movedCards[0]);
      } else {
        next.tableau[target.pileIndex].push(...movedCards);
      }

      return next;
    });

    setMoves((prev) => prev + 1);
    setDragSource(null);
  };

  const drawFromStock = () => {
    if (game.stock.length === 0 && game.waste.length === 0) {
      return;
    }

    setGame((prev) => {
      const next: GameState = {
        stock: [...prev.stock],
        waste: [...prev.waste],
        foundations: prev.foundations,
        tableau: prev.tableau,
      };

      if (next.stock.length > 0) {
        const top = next.stock.pop();
        if (top) {
          next.waste = [...next.waste, { ...top, faceUp: true }];
        }
      } else {
        next.stock = [...next.waste].reverse().map((card) => ({ ...card, faceUp: false }));
        next.waste = [];
      }

      return next;
    });

    setMoves((prev) => prev + 1);
  };

  const tryAutoMoveToFoundation = (source: DragSource) => {
    const cards = getDraggedCards(source);
    if (cards.length !== 1) {
      return;
    }

    const [card] = cards;
    if (canPlaceOnFoundation(card, game.foundations[card.suit])) {
      applyMove({ type: 'foundation', suit: card.suit }, source);
    }
  };

  const startNewGame = async () => {
    if (!isWon && moves > 0 && !hasSubmittedResult) {
      await submitResult(false, score);
    }

    setGame(createInitialGame());
    setMoves(0);
    setSeconds(0);
    setDragSource(null);
    setHasSubmittedResult(false);
    setIsWon(false);
    setRewards(null);
    setIsNewHighScore(false);
  };

  const formatTime = (value: number) => {
    const minutes = Math.floor(value / 60)
      .toString()
      .padStart(2, '0');
    const secs = (value % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 md:px-6 md:py-6" style={{ '--card-w': 'clamp(56px, 8vw, 96px)' } as CSSProperties}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-950/85 p-3 text-emerald-50 shadow-xl">
        <div className="flex flex-wrap gap-4 text-sm">
          <span>Score: <strong>{score}</strong></span>
          <span>Moves: <strong>{moves}</strong></span>
          <span>Time: <strong>{formatTime(seconds)}</strong></span>
          <span>Best: <strong>{highScore}</strong></span>
        </div>
        <button
          type="button"
          onClick={startNewGame}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/40 bg-emerald-800/60 px-3 py-2 text-sm font-medium transition hover:bg-emerald-700"
        >
          <RotateCcw className="h-4 w-4" />
          New Game
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <section className="rounded-2xl border border-emerald-400/20 bg-[radial-gradient(circle_at_20%_0%,rgba(110,231,183,0.25),rgba(6,78,59,0.95)_52%)] p-3 md:p-4">
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-cyan-300/40 bg-cyan-950/55 p-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-200">Draw Pile</div>
              <div
                onClick={drawFromStock}
                className="inline-block rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-300"
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    drawFromStock();
                  }
                }}
              >
                {game.stock.length > 0 ? (
                  <SolitaireCard card={{ ...game.stock[game.stock.length - 1], faceUp: false }} draggable={false} />
                ) : (
                  <div className="flex h-[calc(var(--card-w)*1.4)] w-[var(--card-w)] items-center justify-center rounded-xl border-2 border-dashed border-cyan-300/60 bg-cyan-900/20 text-xs text-cyan-100">
                    Reset
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs text-cyan-100/85">{game.stock.length} cards</div>
            </div>

            <div className="rounded-xl border border-cyan-300/40 bg-cyan-950/55 p-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-200">Waste</div>
              <div>
                {game.waste.length > 0 ? (
                  <SolitaireCard
                    card={game.waste[game.waste.length - 1]}
                    draggable={!isWon}
                    onDragStart={() => setDragSource({ type: 'waste' })}
                    onDragEnd={() => setDragSource(null)}
                    onDoubleClick={() => tryAutoMoveToFoundation({ type: 'waste' })}
                  />
                ) : (
                  <div className="flex h-[calc(var(--card-w)*1.4)] w-[var(--card-w)] items-center justify-center rounded-xl border-2 border-dashed border-cyan-300/50 bg-cyan-900/20 text-xs text-cyan-100">
                    Empty
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-2 rounded-xl border border-amber-300/40 bg-amber-950/45 p-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-100">Ace Foundations</div>
              <div className="grid grid-cols-4 gap-2">
                {SUITS.map((suit) => {
                  const pile = game.foundations[suit];
                  const top = pile[pile.length - 1];
                  const canDrop = canDropToFoundation(suit);

                  return (
                    <div
                      key={suit}
                      onDragOver={(event) => {
                        if (canDrop) {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        applyMove({ type: 'foundation', suit });
                      }}
                      className={cn(
                        'rounded-xl p-1 transition',
                        canDrop ? 'ring-2 ring-amber-300/90' : 'ring-1 ring-amber-100/20'
                      )}
                    >
                      {top ? (
                        <SolitaireCard
                          card={top}
                          draggable={!isWon}
                          onDragStart={() => setDragSource({ type: 'foundation', suit })}
                          onDragEnd={() => setDragSource(null)}
                        />
                      ) : (
                        <div className="flex h-[calc(var(--card-w)*1.4)] w-[var(--card-w)] flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-300/60 bg-amber-900/25">
                          <span className={cn('text-2xl', getCardColorClass(suit))}>{SUIT_SYMBOL[suit]}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-100">Ace</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 md:gap-3">
            {game.tableau.map((pile, pileIndex) => {
              const canDrop = canDropToTableau(pileIndex);

              return (
                <div
                  key={`pile-${pileIndex}`}
                  onDragOver={(event) => {
                    if (canDrop) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    applyMove({ type: 'tableau', pileIndex });
                  }}
                  className={cn(
                    'relative min-h-[calc(var(--card-w)*3.9)] rounded-xl border border-emerald-100/15 p-1 transition',
                    canDrop && 'ring-2 ring-emerald-200/80'
                  )}
                >
                  {pile.length === 0 ? (
                    <div className="flex h-[calc(var(--card-w)*1.4)] w-[var(--card-w)] items-center justify-center rounded-xl border-2 border-dashed border-emerald-200/35 bg-emerald-900/25 text-xs font-semibold text-emerald-100">
                      K
                    </div>
                  ) : (
                    pile.map((card, cardIndex) => {
                      const offset = card.faceUp ? 26 : 10;
                      const top = pile.slice(cardIndex);
                      const draggable = card.faceUp && top.every((item) => item.faceUp) && !isWon;

                      return (
                        <div
                          key={card.id}
                          className="absolute left-1"
                          style={{ top: `${pile.slice(0, cardIndex).reduce((sum, c) => sum + (c.faceUp ? 26 : 10), 0)}px` }}
                        >
                          <SolitaireCard
                            card={card}
                            draggable={draggable}
                            onDragStart={() => setDragSource({ type: 'tableau', pileIndex, cardIndex })}
                            onDragEnd={() => setDragSource(null)}
                            onDoubleClick={() => {
                              if (draggable) {
                                tryAutoMoveToFoundation({ type: 'tableau', pileIndex, cardIndex });
                              }
                            }}
                          />
                          {cardIndex === pile.length - 1 && (
                            <div style={{ height: `${offset}px` }} />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>

          {isWon && (
            <div className="mt-4 rounded-xl border border-emerald-200/40 bg-emerald-500/20 p-4 text-center text-emerald-50">
              <div className="text-lg font-semibold">You won this hand.</div>
              <div className="mt-1 text-sm">Final score: {score}</div>
              {isNewHighScore && <div className="mt-1 text-sm font-semibold">New high score</div>}
              {rewards && (rewards.money > 0 || rewards.aura > 0) && (
                <div className="mt-1 text-sm text-emerald-100/90">
                  {rewards.money > 0 && `+$${rewards.money}`}
                  {rewards.money > 0 && rewards.aura > 0 && ' | '}
                  {rewards.aura > 0 && `+${rewards.aura} aura`}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-border/40 bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/40 p-3">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <h3 className="text-sm font-semibold">Solitaire Leaderboard</h3>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {leaderboard.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No scores yet.</div>
            ) : (
              leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-center gap-2 border-b border-border/20 px-3 py-2 text-sm',
                    entry.user.id === user?.id && 'bg-primary/10'
                  )}
                >
                  <span className="w-5 text-center font-mono text-muted-foreground">{index + 1}</span>
                  <span className="flex-1 truncate">{entry.user.username}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{entry.highScore}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
