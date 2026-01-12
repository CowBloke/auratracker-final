import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { ArrowLeft, RotateCcw, Trophy, Sparkles, Coins, Clock, Undo, Heart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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
      deck.push({
        suit,
        rank,
        faceUp: false,
        id: `${suit}-${rank}`,
      });
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

    // Deal tableau
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
      // Flip waste back to stock
      newState.stock = newState.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      newState.waste = [];
    } else {
      // Draw card(s)
      const drawn = newState.stock.splice(0, 1);
      drawn.forEach((c) => (c.faceUp = true));
      newState.waste.push(...drawn);
    }
    
    newState.moves++;
    setGameState(newState);
  };

  const canMoveToFoundation = (card: Card, foundation: Card[]): boolean => {
    if (foundation.length === 0) {
      return card.rank === 1; // Only Aces can start foundations
    }
    const topCard = foundation[foundation.length - 1];
    return card.suit === topCard.suit && card.rank === topCard.rank + 1;
  };

  const canMoveToTableau = (card: Card, pile: Card[]): boolean => {
    if (pile.length === 0) {
      return card.rank === 13; // Only Kings can go on empty piles
    }
    const topCard = pile[pile.length - 1];
    return (
      topCard.faceUp &&
      getColor(card.suit) !== getColor(topCard.suit) &&
      card.rank === topCard.rank - 1
    );
  };

  const handleCardClick = (source: string, sourceIndex: number, cardIndex?: number) => {
    if (!gameState || gameState.gameOver) return;

    // If clicking on selected cards' source, deselect
    if (gameState.selectedCards && gameState.selectedCards.source === source && 
        gameState.selectedCards.sourceIndex === sourceIndex) {
      setGameState({ ...gameState, selectedCards: null });
      return;
    }

    // If we have selected cards, try to move them
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
        // Remove cards from source
        if (srcType === 'waste') {
          newState.waste = newState.waste.filter((c) => !cards.includes(c));
        } else if (srcType === 'tableau') {
          newState.tableau[srcIdx] = newState.tableau[srcIdx].filter((c) => !cards.includes(c));
          // Flip top card if face down
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

    // Select cards
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

  const autoMoveToFoundation = () => {
    if (!gameState || gameState.gameOver) return;
    
    saveHistory();
    const newState = { ...gameState };
    let moved = false;

    // Check waste
    if (newState.waste.length > 0) {
      const card = newState.waste[newState.waste.length - 1];
      for (let i = 0; i < 4; i++) {
        if (canMoveToFoundation(card, newState.foundations[i])) {
          newState.foundations[i].push(newState.waste.pop()!);
          moved = true;
          break;
        }
      }
    }

    // Check tableau
    if (!moved) {
      for (let t = 0; t < 7; t++) {
        const pile = newState.tableau[t];
        if (pile.length > 0) {
          const card = pile[pile.length - 1];
          if (card.faceUp) {
            for (let i = 0; i < 4; i++) {
              if (canMoveToFoundation(card, newState.foundations[i])) {
                newState.foundations[i].push(pile.pop()!);
                // Flip next card
                if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
                  pile[pile.length - 1].faceUp = true;
                }
                moved = true;
                break;
              }
            }
          }
        }
        if (moved) break;
      }
    }

    if (moved) {
      newState.moves++;
      newState.selectedCards = null;
      
      if (checkWin(newState)) {
        newState.gameOver = true;
        newState.won = true;
        handleWin();
      }
      
      setGameState(newState);
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
        <div
          className="w-16 h-24 rounded-lg border-2 border-dashed border-muted bg-muted/50"
          onClick={onClick}
        />
      );
    }

    if (!card.faceUp) {
      return (
        <div
          className="w-16 h-24 rounded-lg bg-gradient-to-br from-primary to-aura border border-gray-600 cursor-pointer hover:scale-105 transition-transform"
          onClick={onClick}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-10 h-14 rounded border border-white/20" />
          </div>
        </div>
      );
    }

    const color = getColor(card.suit);
    
    return (
      <div
        className={`w-16 h-24 rounded-lg bg-white border-2 cursor-pointer hover:scale-105 transition-transform ${
          isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-gray-300'
        }`}
        onClick={onClick}
      >
        <div className={cn("p-1", color === 'red' ? 'text-destructive' : 'text-foreground')}>
          <div className="text-sm font-bold leading-none">
            {getRankDisplay(card.rank)}
          </div>
          <div className="text-lg leading-none">
            {SUIT_SYMBOLS[card.suit]}
          </div>
        </div>
      </div>
    );
  };

  if (!gameState) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Link
          to="/games"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Games
        </Link>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <h1 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
                <Heart className="w-8 h-8" />
                Solitaire
              </h1>
              <CardDescription className="mb-6">Classic Klondike Solitaire</CardDescription>
              <Button onClick={initGame} size="lg">
                Start Game
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/games"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formatTime(elapsedTime)}</span>
          </div>
          <div className="text-muted-foreground">
            Moves: <span>{gameState.moves}</span>
          </div>
          <Button
            onClick={undo}
            disabled={history.length === 0}
            variant="secondary"
            size="sm"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button onClick={initGame} variant="secondary" size="sm">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Game Board */}
      <Card>
        <CardContent className="p-4 overflow-x-auto">
        {/* Top Row: Stock, Waste, Foundations */}
        <div className="flex justify-between mb-6 min-w-[600px]">
          <div className="flex gap-4">
            {/* Stock */}
            <div onClick={drawFromStock}>
              {gameState.stock.length > 0 ? (
                renderCard({ ...gameState.stock[0], faceUp: false })
              ) : (
                <div className="w-16 h-24 rounded-lg border-2 border-dashed border-muted flex items-center justify-center cursor-pointer hover:border-primary">
                  <RotateCcw className="w-6 h-6 text-muted-foreground" />
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
              <div
                key={i}
                onClick={() => handleCardClick('foundation', i)}
              >
                {foundation.length > 0 ? (
                  renderCard(foundation[foundation.length - 1])
                ) : (
                  <div className="w-16 h-24 rounded-lg border-2 border-dashed border-primary/50 bg-primary/10 flex items-center justify-center text-2xl text-primary/50">
                    {SUIT_SYMBOLS[SUITS[i]]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tableau */}
        <div className="flex gap-2 min-w-[600px]">
          {gameState.tableau.map((pile, pileIndex) => (
            <div
              key={pileIndex}
              className="relative w-16"
              style={{ minHeight: '24rem' }}
              onClick={() => pile.length === 0 && handleCardClick('tableau', pileIndex)}
            >
              {pile.length === 0 ? (
                <div className="w-16 h-24 rounded-lg border-2 border-dashed border-muted bg-muted/50" />
              ) : (
                pile.map((card, cardIndex) => (
                  <div
                    key={card.id}
                    className="absolute"
                    style={{ top: cardIndex * 25 }}
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

        {/* Auto-move button */}
        <div className="mt-4 text-center">
          <Button
            onClick={autoMoveToFoundation}
            variant="secondary"
            size="sm"
          >
            Auto-move to Foundation
          </Button>
        </div>
        </CardContent>
      </Card>

      {/* Win Modal */}
      <Dialog open={gameState.won} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <div className="text-center">
              <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
              <DialogTitle className="text-3xl">You Win!</DialogTitle>
              <DialogDescription className="mt-2">
                Time: {formatTime(elapsedTime)} | Moves: {gameState.moves}
              </DialogDescription>
            </div>
          </DialogHeader>
          
          {rewards && (
            <div className="space-y-2">
              {rewards.money > 0 && (
                <div className="flex items-center justify-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  <Badge variant="secondary">+${rewards.money}</Badge>
                </div>
              )}
              {rewards.aura > 0 && (
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <Badge variant="secondary">+{rewards.aura} Aura</Badge>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={initGame} className="w-full">
              Play Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
