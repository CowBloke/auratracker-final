import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';
import { cn } from '@/lib/utils';
import { GameFullscreenButton } from '@/components/game/GameFullscreenButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { useHideGameLeaderboards, useHideGameLeftInfo } from '@/lib/game-preferences';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

interface Card {
  id: string;
  suit: Suit;
  rank: number;
  faceUp: boolean;
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
        <div className={cn('text-[clamp(10px,calc(var(--card-w)*0.15),14px)] font-bold leading-none', getCardColorClass(card.suit))}>
          <div>{RANK_LABEL[card.rank - 1]}</div>
          <div>{SUIT_SYMBOL[card.suit]}</div>
        </div>
        <div className={cn('text-center text-[clamp(20px,calc(var(--card-w)*0.34),34px)]', getCardColorClass(card.suit))}>{SUIT_SYMBOL[card.suit]}</div>
        <div className={cn('rotate-180 self-end text-[clamp(10px,calc(var(--card-w)*0.15),14px)] font-bold leading-none', getCardColorClass(card.suit))}>
          <div>{RANK_LABEL[card.rank - 1]}</div>
          <div>{SUIT_SYMBOL[card.suit]}</div>
        </div>
      </div>
    </div>
  );
}

export default function Solitaire() {
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const { user, refreshUser } = useAuth();
  const hideGameLeaderboards = useHideGameLeaderboards();
  const hideGameLeftInfo = useHideGameLeftInfo();
  const boardRef = useRef<HTMLDivElement | null>(null);

  const [game, setGame] = useState<GameState>(() => createInitialGame());
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [hasSubmittedResult, setHasSubmittedResult] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [cardWidth, setCardWidth] = useState(96);
  const [isPaused, setIsPaused] = useState(false);

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

  const handleDeleteScore = async (userId: string, _username: string) => {
    if (!user?.isAdmin) {
      return;
    }

    try {
      await gamesApi.deleteStats('solitaire', userId);
      if (userId === user.id) {
        setHighScore(0);
      }
      await fetchLeaderboard();
    } catch (error) {
      console.error('Failed to delete solitaire score:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [user]);

  useEffect(() => {
    if (isWon || isPaused) {
      return;
    }
    const interval = window.setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPaused, isWon]);

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

  useEffect(() => {
    const node = boardRef.current;
    if (!node) {
      return;
    }

    const minCardWidth = 46;
    const maxCardWidth = 96;
    const gapRatio = 0.12;
    const padRatio = 0.04;

    const updateCardWidth = (boardWidth: number) => {
      // Account for pilePadding (2 * padRatio per column) so tableau never overflows
      const computed = boardWidth / (7 * (1 + 2 * padRatio) + 6 * gapRatio);
      const nextCardWidth = Math.max(minCardWidth, Math.min(maxCardWidth, computed));
      setCardWidth((prev) => (Math.abs(prev - nextCardWidth) < 0.5 ? prev : nextCardWidth));
    };

    updateCardWidth(node.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      updateCardWidth(entry.contentRect.width);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
    if (isPaused) return;
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
    setIsPaused(false);
  };

  useEffect(() => {
    if (isWon && isPaused) {
      setIsPaused(false);
    }
  }, [isPaused, isWon]);

  const formatTime = (value: number) => {
    const minutes = Math.floor(value / 60)
      .toString()
      .padStart(2, '0');
    const secs = (value % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  };

  const boardGap = Math.max(6, Math.round(cardWidth * 0.12));
  const stackOffsetFaceUp = Math.max(12, Math.round(cardWidth * 0.27));
  const stackOffsetFaceDown = Math.max(8, Math.round(cardWidth * 0.1));
  const pilePadding = Math.max(2, Math.round(cardWidth * 0.04));

  return (
    <div className={cn(
      'grid grid-cols-1 gap-4 items-start px-4 pb-6 lg:px-6 lg:pb-8',
      isFullscreen
        ? 'justify-items-center'
        : hideGameLeftInfo
          ? hideGameLeaderboards
            ? 'justify-items-center'
            : 'xl:grid-cols-[1fr_320px]'
          : hideGameLeaderboards
            ? 'xl:grid-cols-[280px_1fr]'
            : 'xl:grid-cols-[280px_1fr_320px]'
    )}>
      {!hideGameLeftInfo && (
      <div className={cn('flex flex-col gap-3', isFullscreen && 'hidden')}>
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Statistiques</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div>
              <p className="text-3xl font-light tabular-nums">{score.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Score actuel</p>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Coups: <span className="font-medium text-foreground tabular-nums">{moves.toLocaleString()}</span></p>
              <p className="text-sm text-muted-foreground">Temps: <span className="font-medium text-foreground tabular-nums">{formatTime(seconds)}</span></p>
              <p className="text-sm text-muted-foreground">Record: <span className="font-medium text-foreground tabular-nums">{highScore.toLocaleString()}</span></p>
            </div>
            {isNewHighScore && <p className="text-sm text-foreground">Nouveau record !</p>}
            {rewards && (rewards.money > 0 || rewards.aura > 0) && (
              <p className="text-sm text-muted-foreground">
                {rewards.money > 0 && `+$${rewards.money}`}
                {rewards.money > 0 && rewards.aura > 0 && ' · '}
                {rewards.aura > 0 && `+${rewards.aura} aura`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Progression</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-muted-foreground">
              Cartes posées: <span className="font-medium text-foreground tabular-nums">{completedCards}/52</span>
            </p>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          type="button"
          onClick={startNewGame}
          className="inline-flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Nouvelle partie
        </Button>
      </div>
      )}

      <Card
        ref={gameContainerRef}
        className={cn(
          isFullscreen && 'w-screen min-h-screen rounded-none border-0 bg-background shadow-none'
        )}
      >
        <CardHeader className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium">Solitaire</CardTitle>
            <div className="flex items-center gap-2">
              {isFullscreen && (
                <Button variant="outline" size="sm" type="button" onClick={startNewGame}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Nouvelle partie
                </Button>
              )}
              <GameFullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <div
            ref={boardRef}
            style={
              {
                '--card-w': `${cardWidth}px`,
                '--pile-gap': `${boardGap}px`,
                '--stack-faceup': `${stackOffsetFaceUp}px`,
                '--stack-facedown': `${stackOffsetFaceDown}px`,
                '--pile-pad': `${pilePadding}px`,
                '--pile-col-w': `${cardWidth + pilePadding * 2}px`,
              } as CSSProperties
            }
            className="relative"
          >
          <GamePauseOverlay visible={isPaused} onResume={() => setIsPaused(false)} />
          <div className="mb-4 flex items-start justify-between gap-[var(--pile-gap)]">
            <div className="flex gap-[var(--pile-gap)]">
              <div className="rounded-xl border border-border/40 bg-muted/25 p-2">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Pioche</div>
                <div
                  onClick={drawFromStock}
                  className="inline-block rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
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
                    <div className="flex h-[calc(var(--card-w)*1.4)] w-[var(--card-w)] items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/10 text-xs text-muted-foreground">
                      Retourner
                    </div>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{game.stock.length} cartes</div>
              </div>

              <div className="rounded-xl border border-border/40 bg-muted/25 p-2">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Défausse</div>
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
                    <div className="flex h-[calc(var(--card-w)*1.4)] w-[var(--card-w)] items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/10 text-xs text-muted-foreground">
                      Vide
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-muted/25 p-2">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Fondations</div>
              <div
                className="grid gap-[var(--pile-gap)]"
                style={{ gridTemplateColumns: 'repeat(4, var(--pile-col-w))' }}
              >
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
                        'flex justify-center rounded-xl p-[var(--pile-pad)] transition',
                        canDrop ? 'ring-2 ring-primary/70' : 'ring-1 ring-border/30'
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
                        <div className="flex h-[calc(var(--card-w)*1.4)] w-[var(--card-w)] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/10">
                          <span className={cn('text-2xl', getCardColorClass(suit))}>{SUIT_SYMBOL[suit]}</span>
                          <span className="text-[10px] font-semibold text-muted-foreground">As</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            className="grid justify-center gap-[var(--pile-gap)]"
            style={{ gridTemplateColumns: 'repeat(7, var(--pile-col-w))' }}
          >
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
                    'relative min-h-[calc(var(--card-w)*3.9)] rounded-xl border border-border/40 p-[var(--pile-pad)] transition',
                    canDrop && 'ring-2 ring-primary/70'
                  )}
                >
                  {pile.length === 0 ? (
                    <div className="flex h-[calc(var(--card-w)*1.4)] w-[var(--card-w)] items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/10 text-xs font-semibold text-muted-foreground">
                      K
                    </div>
                  ) : (
                    pile.map((card, cardIndex) => {
                      const offset = card.faceUp ? stackOffsetFaceUp : stackOffsetFaceDown;
                      const top = pile.slice(cardIndex);
                      const draggable = card.faceUp && top.every((item) => item.faceUp) && !isWon;

                      return (
                        <div
                          key={card.id}
                          className="absolute left-[var(--pile-pad)]"
                          style={{
                            top: `${pile
                              .slice(0, cardIndex)
                              .reduce((sum, c) => sum + (c.faceUp ? stackOffsetFaceUp : stackOffsetFaceDown), 0)}px`,
                          }}
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
          </div>
          {isWon && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
              <div className="text-lg font-semibold">Partie gagnée</div>
              <div className="mt-1 text-sm text-muted-foreground">Score final: {score.toLocaleString()}</div>
              {isNewHighScore && <div className="mt-1 text-sm">Nouveau record !</div>}
              {rewards && (rewards.money > 0 || rewards.aura > 0) && (
                <div className="mt-1 text-sm text-muted-foreground">
                  {rewards.money > 0 && `+$${rewards.money}`}
                  {rewards.money > 0 && rewards.aura > 0 && ' · '}
                  {rewards.aura > 0 && `+${rewards.aura} aura`}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!hideGameLeaderboards && (
        <GameLeaderboard
          entries={leaderboard}
          currentUserId={user?.id}
          personalHighScore={highScore}
          isAdmin={user?.isAdmin}
          onDeleteScore={handleDeleteScore}
          maxHeight={720}
          hidden={isFullscreen}
        />
      )}

    </div>
  );
}
