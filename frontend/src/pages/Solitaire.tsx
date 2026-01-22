import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { Play, RotateCcw, X, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Color = 'red' | 'black';

interface Card {
  suit: Suit;
  rank: number; // 1-13 (Ace to King)
  faceUp: boolean;
  id: string;
}

interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][]; // 4 piles (one per suit)
  tableau: Card[][]; // 7 piles
  moves: number;
  startTime: number;
}

interface DragState {
  cards: Card[];
  sourceType: 'waste' | 'tableau' | 'foundation';
  sourceIndex: number;
}

interface LeaderboardEntry {
  id: string;
  highScore: number;
  wins: number;
  totalPlayed: number;
  user: {
    id: string;
    username: string;
  };
}

// ============================================
// CONSTANTS
// ============================================
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};
const RANK_SYMBOLS: Record<number, string> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
};

// ============================================
// HELPERS
// ============================================
const getColor = (suit: Suit): Color => {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
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

const canPlaceOnTableau = (card: Card, targetPile: Card[]): boolean => {
  if (targetPile.length === 0) {
    return card.rank === 13; // Only Kings can be placed on empty tableau
  }
  const topCard = targetPile[targetPile.length - 1];
  if (!topCard.faceUp) return false;
  return (
    getColor(card.suit) !== getColor(topCard.suit) &&
    card.rank === topCard.rank - 1
  );
};

const canPlaceOnFoundation = (card: Card, foundationIndex: number, foundations: Card[][]): boolean => {
  const foundation = foundations[foundationIndex];
  const targetSuit = SUITS[foundationIndex];
  
  if (card.suit !== targetSuit) return false;
  
  if (foundation.length === 0) {
    return card.rank === 1; // Only Aces can start a foundation
  }
  
  const topCard = foundation[foundation.length - 1];
  return card.rank === topCard.rank + 1;
};

const calculateScore = (moves: number, timeSeconds: number, won: boolean): number => {
  if (!won) return 0;
  // Score formula: 10000 - time - moves*2
  // Higher score = faster time + fewer moves
  const score = Math.max(0, 10000 - timeSeconds - moves * 2);
  return Math.floor(score);
};

// ============================================
// COMPONENT
// ============================================
export default function Solitaire() {
  const { user, refreshUser } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [stats, setStats] = useState<{ wins: number; totalPlayed: number; winRate: number }>({ wins: 0, totalPlayed: 0, winRate: 0 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [history, setHistory] = useState<GameState[]>([]);

  // Timer
  useEffect(() => {
    if (!started || gameOver || !gameState) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - gameState.startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [started, gameOver, gameState]);

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await gamesApi.getStats('solitaire', user!.id);
      const s = response.data.stats;
      setHighScore(s.highScore || 0);
      setStats({
        wins: s.wins || 0,
        totalPlayed: s.totalPlayed || 0,
        winRate: s.totalPlayed > 0 ? Math.round((s.wins / s.totalPlayed) * 100) : 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await gamesApi.getLeaderboard('solitaire', 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };

  const handleDeleteScore = async (userId: string, username: string) => {
    if (!confirm(`Supprimer le score de ${username} ?`)) return;

    try {
      await gamesApi.deleteStats('solitaire', userId);
      fetchLeaderboard();
      if (userId === user?.id) {
        setHighScore(0);
      }
    } catch (error) {
      console.error('Failed to delete score:', error);
    }
  };

  // ============================================
  // GAME INITIALIZATION
  // ============================================
  const initGame = useCallback(() => {
    const deck = shuffleDeck(createDeck());
    
    // Deal tableau
    const tableau: Card[][] = [[], [], [], [], [], [], []];
    let deckIndex = 0;
    
    for (let col = 0; col < 7; col++) {
      for (let row = col; row < 7; row++) {
        const card = { ...deck[deckIndex++] };
        if (row === col) {
          card.faceUp = true; // Top card is face up
        }
        tableau[row].push(card);
      }
    }
    
    // Remaining cards go to stock
    const stock = deck.slice(deckIndex).map(c => ({ ...c, faceUp: false }));
    
    const newState: GameState = {
      stock,
      waste: [],
      foundations: [[], [], [], []],
      tableau,
      moves: 0,
      startTime: Date.now(),
    };
    
    setGameState(newState);
    setHistory([]);
    setGameOver(false);
    setWon(false);
    setStarted(true);
    setRewards(null);
    setIsNewHighScore(false);
    setElapsedTime(0);
  }, []);

  // ============================================
  // SAVE STATE FOR UNDO
  // ============================================
  const saveState = useCallback(() => {
    if (gameState) {
      setHistory(prev => [...prev.slice(-20), JSON.parse(JSON.stringify(gameState))]);
    }
  }, [gameState]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prevState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setGameState(prevState);
  }, [history]);

  // ============================================
  // CHECK WIN CONDITION
  // ============================================
  const checkWin = useCallback((state: GameState): boolean => {
    return state.foundations.every(f => f.length === 13);
  }, []);

  // ============================================
  // GAME OVER HANDLING
  // ============================================
  const handleGameEnd = useCallback(async (didWin: boolean) => {
    if (!gameState) return;
    
    const timeSeconds = Math.floor((Date.now() - gameState.startTime) / 1000);
    const score = calculateScore(gameState.moves, timeSeconds, didWin);
    
    setGameOver(true);
    setWon(didWin);

    try {
      const response = await gamesApi.complete('solitaire', {
        score,
        won: didWin,
        duration: timeSeconds,
      });

      setRewards({
        aura: response.data.auraReward,
        money: response.data.moneyReward,
      });
      setIsNewHighScore(response.data.isNewHighScore);

      if (response.data.isNewHighScore) {
        setHighScore(score);
      }

      await refreshUser();
      fetchLeaderboard();
      fetchStats();
    } catch (error) {
      console.error('Failed to submit score:', error);
    }
  }, [gameState, refreshUser]);

  // ============================================
  // GAME ACTIONS
  // ============================================
  const drawFromStock = useCallback(() => {
    if (!gameState) return;
    
    saveState();
    
    setGameState(prev => {
      if (!prev) return prev;
      
      if (prev.stock.length === 0) {
        // Reset stock from waste
        const newStock = [...prev.waste].reverse().map(c => ({ ...c, faceUp: false }));
        return {
          ...prev,
          stock: newStock,
          waste: [],
          moves: prev.moves + 1,
        };
      }
      
      // Draw one card
      const card = { ...prev.stock[prev.stock.length - 1], faceUp: true };
      return {
        ...prev,
        stock: prev.stock.slice(0, -1),
        waste: [...prev.waste, card],
        moves: prev.moves + 1,
      };
    });
  }, [gameState, saveState]);

  const moveCards = useCallback((
    cards: Card[],
    sourceType: 'waste' | 'tableau' | 'foundation',
    sourceIndex: number,
    targetType: 'tableau' | 'foundation',
    targetIndex: number
  ) => {
    if (!gameState) return;
    
    saveState();
    
    setGameState(prev => {
      if (!prev) return prev;
      
      const newState = JSON.parse(JSON.stringify(prev)) as GameState;
      
      // Remove cards from source
      if (sourceType === 'waste') {
        newState.waste = newState.waste.slice(0, -1);
      } else if (sourceType === 'tableau') {
        const cardIndex = newState.tableau[sourceIndex].findIndex(c => c.id === cards[0].id);
        newState.tableau[sourceIndex] = newState.tableau[sourceIndex].slice(0, cardIndex);
        // Flip the new top card if exists
        const pile = newState.tableau[sourceIndex];
        if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
          pile[pile.length - 1].faceUp = true;
        }
      } else if (sourceType === 'foundation') {
        newState.foundations[sourceIndex] = newState.foundations[sourceIndex].slice(0, -1);
      }
      
      // Add cards to target
      if (targetType === 'tableau') {
        newState.tableau[targetIndex].push(...cards);
      } else if (targetType === 'foundation') {
        newState.foundations[targetIndex].push(...cards);
      }
      
      newState.moves++;
      
      // Check win
      if (checkWin(newState)) {
        setTimeout(() => handleGameEnd(true), 100);
      }
      
      return newState;
    });
  }, [gameState, saveState, checkWin, handleGameEnd]);

  const autoMoveToFoundation = useCallback((card: Card, sourceType: 'waste' | 'tableau', sourceIndex: number) => {
    if (!gameState) return false;
    
    for (let i = 0; i < 4; i++) {
      if (canPlaceOnFoundation(card, i, gameState.foundations)) {
        moveCards([card], sourceType, sourceIndex, 'foundation', i);
        return true;
      }
    }
    return false;
  }, [gameState, moveCards]);

  // ============================================
  // DRAG AND DROP HANDLERS
  // ============================================
  const handleDragStart = useCallback((
    cards: Card[],
    sourceType: 'waste' | 'tableau' | 'foundation',
    sourceIndex: number
  ) => {
    setDragState({ cards, sourceType, sourceIndex });
  }, []);

  const handleDrop = useCallback((targetType: 'tableau' | 'foundation', targetIndex: number) => {
    if (!dragState || !gameState) return;
    
    const { cards, sourceType, sourceIndex } = dragState;
    const card = cards[0];
    
    if (targetType === 'foundation') {
      if (cards.length === 1 && canPlaceOnFoundation(card, targetIndex, gameState.foundations)) {
        moveCards(cards, sourceType, sourceIndex, 'foundation', targetIndex);
      }
    } else if (targetType === 'tableau') {
      if (canPlaceOnTableau(card, gameState.tableau[targetIndex])) {
        moveCards(cards, sourceType, sourceIndex, 'tableau', targetIndex);
      }
    }
    
    setDragState(null);
  }, [dragState, gameState, moveCards]);

  const handleDoubleClick = useCallback((
    card: Card,
    sourceType: 'waste' | 'tableau',
    sourceIndex: number
  ) => {
    autoMoveToFoundation(card, sourceType, sourceIndex);
  }, [autoMoveToFoundation]);

  // ============================================
  // RENDER HELPERS
  // ============================================
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const CardComponent = useMemo(() => {
    return ({ card, isDragging, onClick, onDoubleClick, onDragStart, stackOffset = 0 }: {
      card: Card;
      isDragging?: boolean;
      onClick?: () => void;
      onDoubleClick?: () => void;
      onDragStart?: () => void;
      stackOffset?: number;
    }) => {
      const isRed = getColor(card.suit) === 'red';
      
      if (!card.faceUp) {
        return (
          <div
            className={cn(
              "w-16 h-24 rounded-lg border-2 border-border/50 bg-gradient-to-br from-blue-900 to-blue-950 cursor-pointer select-none",
              "flex items-center justify-center"
            )}
            style={{ marginTop: stackOffset > 0 ? -80 : 0 }}
            onClick={onClick}
          >
            <div className="w-10 h-16 border border-blue-700 rounded opacity-50" />
          </div>
        );
      }
      
      return (
        <div
          className={cn(
            "w-16 h-24 rounded-lg border-2 bg-white dark:bg-zinc-900 cursor-pointer select-none transition-shadow",
            isDragging && "shadow-xl scale-105",
            isRed ? "text-red-500" : "text-zinc-900 dark:text-white",
            "border-border/50 hover:border-foreground/30"
          )}
          style={{ marginTop: stackOffset > 0 ? -80 : 0 }}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            onDragStart?.();
          }}
        >
          <div className="p-1.5 h-full flex flex-col justify-between">
            <div className="text-xs font-bold leading-none">
              {RANK_SYMBOLS[card.rank]}
              <span className="ml-0.5">{SUIT_SYMBOLS[card.suit]}</span>
            </div>
            <div className="text-2xl text-center">
              {SUIT_SYMBOLS[card.suit]}
            </div>
            <div className="text-xs font-bold leading-none text-right rotate-180">
              {RANK_SYMBOLS[card.rank]}
              <span className="ml-0.5">{SUIT_SYMBOLS[card.suit]}</span>
            </div>
          </div>
        </div>
      );
    };
  }, []);

  const EmptySlot = ({ onClick, onDrop, suit }: { onClick?: () => void; onDrop?: () => void; suit?: Suit }) => (
    <div
      className={cn(
        "w-16 h-24 rounded-lg border-2 border-dashed border-border/30 cursor-pointer",
        "flex items-center justify-center text-muted-foreground/30"
      )}
      onClick={onClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {suit && <span className="text-2xl opacity-30">{SUIT_SYMBOLS[suit]}</span>}
    </div>
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/games"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <X className="h-4 w-4" />
              Jeux
            </Link>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Jeu solo
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Solitaire
            </h1>
          </div>
        </div>
      </header>

      <div className="h-px bg-border" />

      {/* Game Area */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Game Board */}
        <div className="flex-1 flex flex-col items-center space-y-4">
          {!started ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <p className="text-lg font-medium text-center">
                Empile toutes les cartes sur les fondations<br />
                de l'As au Roi par couleur.
              </p>
              <Button onClick={initGame} variant="outline" className="border-foreground">
                <Play className="h-4 w-4 mr-2" />
                Nouvelle partie
              </Button>
            </div>
          ) : gameState && (
            <div className="space-y-4">
              {/* Top Row: Stock, Waste, Gap, Foundations */}
              <div className="flex gap-2 items-start">
                {/* Stock */}
                <div className="relative">
                  {gameState.stock.length > 0 ? (
                    <CardComponent
                      card={gameState.stock[gameState.stock.length - 1]}
                      onClick={drawFromStock}
                    />
                  ) : (
                    <EmptySlot onClick={drawFromStock} />
                  )}
                  {gameState.stock.length > 0 && (
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                      {gameState.stock.length}
                    </span>
                  )}
                </div>

                {/* Waste */}
                <div className="relative">
                  {gameState.waste.length > 0 ? (
                    <CardComponent
                      card={gameState.waste[gameState.waste.length - 1]}
                      onDragStart={() => handleDragStart(
                        [gameState.waste[gameState.waste.length - 1]],
                        'waste',
                        0
                      )}
                      onDoubleClick={() => handleDoubleClick(
                        gameState.waste[gameState.waste.length - 1],
                        'waste',
                        0
                      )}
                    />
                  ) : (
                    <EmptySlot />
                  )}
                </div>

                {/* Gap */}
                <div className="w-16" />

                {/* Foundations */}
                {gameState.foundations.map((foundation, i) => (
                  <div
                    key={i}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop('foundation', i)}
                  >
                    {foundation.length > 0 ? (
                      <CardComponent
                        card={foundation[foundation.length - 1]}
                        onDragStart={() => handleDragStart([foundation[foundation.length - 1]], 'foundation', i)}
                      />
                    ) : (
                      <EmptySlot suit={SUITS[i]} onDrop={() => handleDrop('foundation', i)} />
                    )}
                  </div>
                ))}
              </div>

              {/* Tableau */}
              <div className="flex gap-2 items-start pt-4">
                {gameState.tableau.map((pile, pileIndex) => (
                  <div
                    key={pileIndex}
                    className="relative min-h-[6rem]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop('tableau', pileIndex)}
                  >
                    {pile.length === 0 ? (
                      <EmptySlot onDrop={() => handleDrop('tableau', pileIndex)} />
                    ) : (
                      pile.map((card, cardIndex) => (
                        <div
                          key={card.id}
                          style={{ marginTop: cardIndex > 0 ? (card.faceUp ? -60 : -80) : 0 }}
                        >
                          <CardComponent
                            card={card}
                            onDragStart={() => {
                              if (card.faceUp) {
                                handleDragStart(pile.slice(cardIndex), 'tableau', pileIndex);
                              }
                            }}
                            onDoubleClick={() => {
                              if (card.faceUp && cardIndex === pile.length - 1) {
                                handleDoubleClick(card, 'tableau', pileIndex);
                              }
                            }}
                          />
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-4">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Temps: {formatTime(elapsedTime)}</span>
                  <span>Coups: {gameState.moves}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={undo}
                    disabled={history.length === 0}
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Annuler
                  </Button>
                  <Button variant="outline" size="sm" onClick={initGame}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Nouvelle partie
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGameEnd(false)}
                  >
                    Abandonner
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Game Over Modal */}
          {gameOver && (
            <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
              <div className="bg-card border border-border rounded-lg p-8 max-w-md text-center space-y-4">
                <p className="text-2xl font-bold">
                  {won ? 'Félicitations !' : 'Partie terminée'}
                </p>
                {won && (
                  <p className="text-lg text-green-500">Vous avez gagné !</p>
                )}
                <div className="space-y-1 text-muted-foreground">
                  <p>Temps: {formatTime(elapsedTime)}</p>
                  <p>Coups: {gameState?.moves || 0}</p>
                  {won && (
                    <p className="text-foreground font-medium">
                      Score: {calculateScore(gameState?.moves || 0, elapsedTime, won)}
                    </p>
                  )}
                </div>
                {isNewHighScore && (
                  <p className="text-yellow-500 font-medium">Nouveau record personnel !</p>
                )}
                {rewards && (rewards.aura > 0 || rewards.money > 0) && (
                  <div className="space-y-1">
                    {rewards.aura > 0 && (
                      <p className="text-purple-400">+{rewards.aura} aura</p>
                    )}
                    {rewards.money > 0 && (
                      <p className="text-green-400">+{rewards.money}$</p>
                    )}
                  </div>
                )}
                <Button onClick={initGame} variant="outline" className="border-foreground">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Rejouer
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Stats and Leaderboard */}
        <div className="lg:w-80 space-y-6">
          {/* Stats */}
          <section className="space-y-2">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Statistiques
            </h2>
            <div className="space-y-2 border border-border/30 rounded-lg p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Meilleur score</span>
                <span className="font-medium">{highScore}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Victoires</span>
                <span className="font-medium">{stats.wins}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parties jouées</span>
                <span className="font-medium">{stats.totalPlayed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taux de victoire</span>
                <span className="font-medium">{stats.winRate}%</span>
              </div>
            </div>
          </section>

          {/* Leaderboard */}
          <section className="space-y-2">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Classement
            </h2>
            <div className="border border-border/30 rounded-lg overflow-hidden">
              {leaderboard.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Aucun score pour le moment
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-center justify-between p-3",
                        entry.user.id === user?.id && "bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-6 tabular-nums">
                          {index + 1}
                        </span>
                        <span className="font-medium text-sm">
                          {entry.user.username}
                          {entry.user.id === user?.id && (
                            <span className="ml-2 text-xs text-muted-foreground">(toi)</span>
                          )}
                        </span>
                      </div>
                      <span className="text-sm tabular-nums">{entry.highScore}</span>
                      {user?.isAdmin && (
                        <button
                          onClick={() => handleDeleteScore(entry.user.id, entry.user.username)}
                          className="ml-2 text-xs text-destructive hover:underline"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Rules */}
          <section className="space-y-2">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Règles
            </h2>
            <div className="border border-border/30 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
              <p>• Empile les cartes de l'As au Roi sur les fondations</p>
              <p>• Les colonnes alternent rouge/noir en ordre décroissant</p>
              <p>• Seuls les Rois peuvent remplir une colonne vide</p>
              <p>• Double-clic pour envoyer automatiquement aux fondations</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
