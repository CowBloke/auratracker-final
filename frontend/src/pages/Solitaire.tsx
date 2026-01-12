import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { ArrowLeft, RotateCcw, Undo } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Color = 'red' | 'black';

interface Card {
  suit: Suit;
  rank: number;
  faceUp: boolean;
  id: string;
}

interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
  selectedCards: { cards: Card[]; source: string; sourceIndex: number } | null;
  moves: number;
  startTime: number;
  gameOver: boolean;
  won: boolean;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const getColor = (suit: Suit): Color => {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
};

const getRankDisplay = (rank: number): string => {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return rank.toString();
};

const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank, faceUp: false, id: `${suit}-${rank}` });
    }
  }
  return deck;
};

const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function Solitaire() {
  const { refreshUser } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [history, setHistory] = useState<GameState[]>([]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (gameState && !gameState.gameOver) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - gameState.startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  const initGame = useCallback(() => {
    const deck = shuffleDeck(createDeck());
    const tableau: Card[][] = [[], [], [], [], [], [], []];
    let cardIndex = 0;

    for (let col = 0; col < 7; col++) {
      for (let row = col; row < 7; row++) {
        const card = { ...deck[cardIndex++] };
        if (row === col) card.faceUp = true;
        tableau[row].push(card);
      }
    }

    const newState: GameState = {
      stock: deck.slice(cardIndex),
      waste: [],
      foundations: [[], [], [], []],
      tableau,
      selectedCards: null,
      moves: 0,
      startTime: Date.now(),
      gameOver: false,
      won: false,
    };

    setGameState(newState);
    setElapsedTime(0);
    setRewards(null);
    setHistory([]);
  }, []);

  const saveHistory = () => {
    if (gameState) {
      setHistory((prev) => [...prev.slice(-10), JSON.parse(JSON.stringify(gameState))]);
    }
  };

  const undo = () => {
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setGameState(previousState);
      setHistory((prev) => prev.slice(0, -1));
    }
  };

  const checkWin = useCallback((state: GameState): boolean => {
    return state.foundations.every((f) => f.length === 13);
  }, []);

  const handleWin = useCallback(async () => {
    const duration = Math.floor((Date.now() - (gameState?.startTime || 0)) / 1000);
    
    try {
      const response = await gamesApi.complete('solitaire', {
        score: Math.max(10000 - duration * 10, 0),
        won: true,
        duration,
      });
      
      setRewards({
        aura: response.data.auraReward,
        money: response.data.moneyReward,
      });
      
      await refreshUser();
    } catch (error) {
      console.error('Failed to submit score:', error);
    }
  }, [gameState, refreshUser]);

  const drawFromStock = () => {
    if (!gameState) return;
    saveHistory();

    const newState = { ...gameState };
    
    if (newState.stock.length === 0) {
      newState.stock = newState.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      newState.waste = [];
    } else {
      const drawn = newState.stock.splice(0, 1);
      drawn.forEach((c) => (c.faceUp = true));
      newState.waste.push(...drawn);
    }
    
    newState.moves++;
    setGameState(newState);
  };

  const canMoveToFoundation = (card: Card, foundation: Card[]): boolean => {
    if (foundation.length === 0) return card.rank === 1;
    const topCard = foundation[foundation.length - 1];
    return card.suit === topCard.suit && card.rank === topCard.rank + 1;
  };

  const canMoveToTableau = (card: Card, pile: Card[]): boolean => {
    if (pile.length === 0) return card.rank === 13;
    const topCard = pile[pile.length - 1];
    return topCard.faceUp && getColor(card.suit) !== getColor(topCard.suit) && card.rank === topCard.rank - 1;
  };

  const handleCardClick = (source: string, sourceIndex: number, cardIndex?: number) => {
    if (!gameState || gameState.gameOver) return;

    if (gameState.selectedCards && gameState.selectedCards.source === source && 
        gameState.selectedCards.sourceIndex === sourceIndex) {
      setGameState({ ...gameState, selectedCards: null });
      return;
    }

    if (gameState.selectedCards) {
      saveHistory();
      const newState = { ...gameState };
      const { cards, source: srcType, sourceIndex: srcIdx } = gameState.selectedCards;

      let moved = false;

      if (source === 'foundation' && cards.length === 1) {
        if (canMoveToFoundation(cards[0], newState.foundations[sourceIndex])) {
          newState.foundations[sourceIndex].push(...cards);
          moved = true;
        }
      } else if (source === 'tableau') {
        if (canMoveToTableau(cards[0], newState.tableau[sourceIndex])) {
          newState.tableau[sourceIndex].push(...cards);
          moved = true;
        }
      }

      if (moved) {
        if (srcType === 'waste') {
          newState.waste = newState.waste.filter((c) => !cards.includes(c));
        } else if (srcType === 'tableau') {
          newState.tableau[srcIdx] = newState.tableau[srcIdx].filter((c) => !cards.includes(c));
          const pile = newState.tableau[srcIdx];
          if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
            pile[pile.length - 1].faceUp = true;
          }
        }
        newState.moves++;
      }

      newState.selectedCards = null;

      if (checkWin(newState)) {
        newState.gameOver = true;
        newState.won = true;
        handleWin();
      }

      setGameState(newState);
      return;
    }

    let cards: Card[] = [];
    
    if (source === 'waste' && gameState.waste.length > 0) {
      cards = [gameState.waste[gameState.waste.length - 1]];
    } else if (source === 'tableau' && cardIndex !== undefined) {
      const pile = gameState.tableau[sourceIndex];
      if (pile[cardIndex]?.faceUp) {
        cards = pile.slice(cardIndex);
      }
    }

    if (cards.length > 0) {
      setGameState({
        ...gameState,
        selectedCards: { cards, source, sourceIndex },
      });
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderCard = (card: Card | null, onClick?: () => void, isSelected?: boolean) => {
    if (!card) {
      return (
        <div className="w-14 h-20 border border-dashed border-border/30" onClick={onClick} />
      );
    }

    if (!card.faceUp) {
      return (
        <div
          className="w-14 h-20 border border-border/50 bg-muted/30 cursor-pointer hover:border-foreground/30 transition-colors"
          onClick={onClick}
        />
      );
    }

    const color = getColor(card.suit);
    
    return (
      <div
        className={cn(
          "w-14 h-20 bg-background border cursor-pointer hover:border-foreground/50 transition-colors",
          isSelected ? 'border-foreground' : 'border-border/50'
        )}
        onClick={onClick}
      >
        <div className={cn("p-1 text-xs", color === 'red' ? 'text-red-500' : 'text-foreground')}>
          <div className="font-medium">{getRankDisplay(card.rank)}</div>
          <div className="text-base">{SUIT_SYMBOLS[card.suit]}</div>
        </div>
      </div>
    );
  };

  if (!gameState) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-12">
        <Link
          to="/games"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>

        <div className="text-center space-y-6">
          <h1 className="text-4xl font-light tracking-tight">Solitaire</h1>
          <p className="text-sm text-muted-foreground">Klondike classique</p>
          <button
            onClick={initGame}
            className="px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            Jouer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/games"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span className="tabular-nums">{formatTime(elapsedTime)}</span>
          <span className="tabular-nums">{gameState.moves} coups</span>
          <button
            onClick={undo}
            disabled={history.length === 0}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={initGame}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Game Board */}
      <div className="overflow-x-auto">
        {/* Top Row */}
        <div className="flex justify-between mb-6 min-w-[500px]">
          <div className="flex gap-2">
            {/* Stock */}
            <div onClick={drawFromStock}>
              {gameState.stock.length > 0 ? (
                renderCard({ ...gameState.stock[0], faceUp: false })
              ) : (
                <div className="w-14 h-20 border border-dashed border-border/30 flex items-center justify-center cursor-pointer hover:border-foreground/30">
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Waste */}
            <div onClick={() => handleCardClick('waste', 0)}>
              {gameState.waste.length > 0 ? (
                renderCard(
                  gameState.waste[gameState.waste.length - 1],
                  undefined,
                  gameState.selectedCards?.source === 'waste'
                )
              ) : (
                renderCard(null)
              )}
            </div>
          </div>

          {/* Foundations */}
          <div className="flex gap-2">
            {gameState.foundations.map((foundation, i) => (
              <div key={i} onClick={() => handleCardClick('foundation', i)}>
                {foundation.length > 0 ? (
                  renderCard(foundation[foundation.length - 1])
                ) : (
                  <div className="w-14 h-20 border border-dashed border-border/30 flex items-center justify-center text-lg text-muted-foreground/30">
                    {SUIT_SYMBOLS[SUITS[i]]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tableau */}
        <div className="flex gap-2 min-w-[500px]">
          {gameState.tableau.map((pile, pileIndex) => (
            <div
              key={pileIndex}
              className="relative w-14"
              style={{ minHeight: '20rem' }}
              onClick={() => pile.length === 0 && handleCardClick('tableau', pileIndex)}
            >
              {pile.length === 0 ? (
                <div className="w-14 h-20 border border-dashed border-border/30" />
              ) : (
                pile.map((card, cardIndex) => (
                  <div
                    key={card.id}
                    className="absolute"
                    style={{ top: cardIndex * 20 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick('tableau', pileIndex, cardIndex);
                    }}
                  >
                    {renderCard(
                      card,
                      undefined,
                      gameState.selectedCards?.source === 'tableau' &&
                      gameState.selectedCards?.sourceIndex === pileIndex &&
                      gameState.selectedCards?.cards.includes(card)
                    )}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Win Modal */}
      <Dialog open={gameState.won} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-light">
              Victoire!
            </DialogTitle>
          </DialogHeader>
          
          <div className="text-center space-y-2 text-sm text-muted-foreground">
            <p>{formatTime(elapsedTime)} · {gameState.moves} coups</p>
            {rewards && (
              <p>
                {rewards.money > 0 && `+$${rewards.money}`}
                {rewards.money > 0 && rewards.aura > 0 && ' · '}
                {rewards.aura > 0 && `+${rewards.aura} aura`}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={initGame} variant="outline" className="w-full border-foreground">
              Rejouer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
