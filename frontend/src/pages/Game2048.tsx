import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { gamesApi } from '../services/api';
import { Play, RotateCcw, Trophy, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// GAME CONSTANTS
// ============================================
const GRID_SIZE = 4;
const CELL_SIZE = 80;
const CELL_GAP = 10;
const BOARD_SIZE = GRID_SIZE * CELL_SIZE + (GRID_SIZE + 1) * CELL_GAP;

// ============================================
// TYPES
// ============================================
type Direction = 'up' | 'down' | 'left' | 'right';

interface LeaderboardEntry {
  id: string;
  highScore: number;
  user: {
    id: string;
    username: string;
  };
}

// ============================================
// GAME LOGIC
// ============================================
const createEmptyBoard = (): number[][] => {
  return Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
};

const addRandomTile = (board: number[][]): number[][] => {
  const emptyCells: [number, number][] = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      if (board[i][j] === 0) {
        emptyCells.push([i, j]);
      }
    }
  }
  
  if (emptyCells.length === 0) return board;
  
  const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const newBoard = board.map(row => [...row]);
  newBoard[row][col] = Math.random() < 0.9 ? 2 : 4;
  return newBoard;
};

const rotateBoard = (board: number[][], times: number): number[][] => {
  let rotated = board.map(row => [...row]);
  for (let i = 0; i < times; i++) {
    rotated = rotated[0].map((_, colIndex) =>
      rotated.map(row => row[colIndex]).reverse()
    );
  }
  return rotated;
};

const moveLeft = (board: number[][]): { board: number[][]; score: number } => {
  const newBoard = board.map(row => {
    // Remove zeros
    const filtered = row.filter(cell => cell !== 0);
    // Merge adjacent equal cells
    const merged: number[] = [];
    for (let i = 0; i < filtered.length; i++) {
      if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
        merged.push(filtered[i] * 2);
        i++; // Skip next cell
      } else {
        merged.push(filtered[i]);
      }
    }
    // Pad with zeros
    while (merged.length < GRID_SIZE) {
      merged.push(0);
    }
    return merged;
  });
  
  // Calculate score from merged cells
  let score = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      if (board[i][j] !== newBoard[i][j] && newBoard[i][j] !== 0) {
        score += newBoard[i][j];
      }
    }
  }
  
  return { board: newBoard, score };
};

const move = (board: number[][], direction: Direction): { board: number[][]; score: number } => {
  let rotated = board;
  let rotation = 0;
  
  // Rotate board so we can always move left
  switch (direction) {
    case 'right':
      rotated = rotateBoard(board, 2);
      rotation = 2;
      break;
    case 'up':
      rotated = rotateBoard(board, 3);
      rotation = 3;
      break;
    case 'down':
      rotated = rotateBoard(board, 1);
      rotation = 1;
      break;
    case 'left':
    default:
      rotated = board;
      rotation = 0;
  }
  
  const { board: movedBoard, score } = moveLeft(rotated);
  
  // Rotate back
  let finalBoard = movedBoard;
  if (rotation > 0) {
    finalBoard = rotateBoard(movedBoard, 4 - rotation);
  }
  
  return { board: finalBoard, score };
};

const canMove = (board: number[][]): boolean => {
  // Check for empty cells
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      if (board[i][j] === 0) return true;
    }
  }
  
  // Check for possible merges
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      const current = board[i][j];
      if (
        (i < GRID_SIZE - 1 && board[i + 1][j] === current) ||
        (j < GRID_SIZE - 1 && board[i][j + 1] === current)
      ) {
        return true;
      }
    }
  }
  
  return false;
};

const getHighestTile = (board: number[][]): number => {
  let highest = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      if (board[i][j] > highest) {
        highest = board[i][j];
      }
    }
  }
  return highest;
};

// ============================================
// COLOR SCHEME (theme-aware)
// ============================================
const getTileColor = (value: number, theme: 'light' | 'dark'): string => {
  const colors: Record<number, { light: string; dark: string }> = {
    2: { light: '#eee4da', dark: '#3c3a32' },
    4: { light: '#ede0c8', dark: '#3c3a32' },
    8: { light: '#f2b179', dark: '#f59563' },
    16: { light: '#f59563', dark: '#f67c5f' },
    32: { light: '#f67c5f', dark: '#f65e3b' },
    64: { light: '#f65e3b', dark: '#edcf72' },
    128: { light: '#edcf72', dark: '#edcc61' },
    256: { light: '#edcc61', dark: '#edc850' },
    512: { light: '#edc850', dark: '#edc53f' },
    1024: { light: '#edc53f', dark: '#edc22e' },
    2048: { light: '#edc22e', dark: '#3c3a32' },
  };
  
  const colorSet = colors[value] || { light: '#3c3a32', dark: '#3c3a32' };
  return theme === 'light' ? colorSet.light : colorSet.dark;
};

const getTextColor = (value: number, theme: 'light' | 'dark'): string => {
  if (value <= 4) {
    return theme === 'light' ? '#776e65' : '#f9f6f2';
  }
  return '#f9f6f2';
};

// ============================================
// COMPONENT
// ============================================
export default function Game2048() {
  const { theme } = useTheme();
  const { user, refreshUser } = useAuth();
  
  const [board, setBoard] = useState<number[][]>(createEmptyBoard());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [won, setWon] = useState(false);
  
  const boardRef = useRef<number[][]>(board);
  const scoreRef = useRef(0);
  
  // Fetch stats and leaderboard on mount
  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, []);
  
  useEffect(() => {
    boardRef.current = board;
    scoreRef.current = score;
  }, [board, score]);
  
  const fetchStats = async () => {
    try {
      const response = await gamesApi.getStats('game_2048', user!.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };
  
  const fetchLeaderboard = async () => {
    try {
      const response = await gamesApi.getLeaderboard('game_2048', 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };
  
  // Admin: Delete a user's high score
  const handleDeleteScore = async (userId: string, username: string) => {
    if (!confirm(`Supprimer le score de ${username} ?`)) return;
    
    try {
      await gamesApi.deleteStats('game_2048', userId);
      fetchLeaderboard();
      if (userId === user?.id) {
        setHighScore(0);
      }
    } catch (error) {
      console.error('Failed to delete score:', error);
    }
  };
  
  // Initialize game
  const initGame = useCallback(() => {
    const newBoard = createEmptyBoard();
    const withTiles = addRandomTile(addRandomTile(newBoard));
    setBoard(withTiles);
    setScore(0);
    setGameOver(false);
    setStarted(true);
    setRewards(null);
    setIsNewHighScore(false);
    setWon(false);
  }, []);
  
  // Handle game over
  const handleGameOver = useCallback(async () => {
    const finalScore = scoreRef.current;
    setGameOver(true);
    
    try {
      const response = await gamesApi.complete('game_2048', {
        score: finalScore,
        won: won, // Only true if player reached 2048 tile
      });
      
      setRewards({
        aura: response.data.auraReward,
        money: response.data.moneyReward,
      });
      setIsNewHighScore(response.data.isNewHighScore);
      
      if (response.data.isNewHighScore) {
        setHighScore(finalScore);
      }
      
      await refreshUser();
      fetchLeaderboard();
    } catch (error) {
      console.error('Failed to submit score:', error);
    }
  }, [won, refreshUser]);
  
  // Handle move
  const handleMove = useCallback((direction: Direction) => {
    if (!started || gameOver) return;
    
    const currentBoard = boardRef.current;
    const { board: newBoard, score: moveScore } = move(currentBoard, direction);
    
    // Check if board changed
    const boardChanged = JSON.stringify(currentBoard) !== JSON.stringify(newBoard);
    
    if (!boardChanged) return;
    
    // Add new tile
    const withNewTile = addRandomTile(newBoard);
    setBoard(withNewTile);
    setScore(prev => prev + moveScore);
    
    // Check for win (2048 tile)
    if (!won && getHighestTile(withNewTile) >= 2048) {
      setWon(true);
    }
    
    // Check for game over
    if (!canMove(withNewTile)) {
      setTimeout(() => handleGameOver(), 300);
    }
  }, [started, gameOver, won, handleGameOver]);
  
  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!started || gameOver) return;
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          handleMove('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          handleMove('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          handleMove('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          handleMove('right');
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [started, gameOver, handleMove]);
  
  // Touch/swipe controls
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };
    
    const dx = touchEnd.x - touchStartRef.current.x;
    const dy = touchEnd.y - touchStartRef.current.y;
    const minSwipeDistance = 30;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal swipe
      if (Math.abs(dx) > minSwipeDistance) {
        handleMove(dx > 0 ? 'right' : 'left');
      }
    } else {
      // Vertical swipe
      if (Math.abs(dy) > minSwipeDistance) {
        handleMove(dy > 0 ? 'down' : 'up');
      }
    }
    
    touchStartRef.current = null;
  };
  
  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/games"
              className="text-sm text-muted-foreground tracking-wide uppercase hover:text-foreground transition-colors"
            >
              &larr; Jeux
            </Link>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              2048
            </h1>
          </div>
          <div className="text-right text-sm text-muted-foreground tabular-nums">
            <div className="text-3xl font-light text-foreground">{score.toLocaleString()}</div>
            <div>Record: {highScore.toLocaleString()}</div>
          </div>
        </div>
      </header>
      
      {/* Game Area with Leaderboard */}
      <div className="flex justify-center gap-6 flex-wrap">
        {/* Game Board */}
        <div className="relative">
          <div
            className="relative border border-border/30 rounded-lg bg-muted/20 p-2"
            style={{
              width: BOARD_SIZE,
              height: BOARD_SIZE,
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Background grid */}
            <div className="absolute inset-2 grid grid-cols-4 gap-2.5">
              {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted/30 rounded"
                />
              ))}
            </div>
            
            {/* Tiles */}
            <div className="relative grid grid-cols-4 gap-2.5 p-2.5">
              {board.flat().map((value, index) => {
                const row = Math.floor(index / GRID_SIZE);
                const col = index % GRID_SIZE;
                return (
                  <div
                    key={`${row}-${col}`}
                    className={cn(
                      "rounded flex items-center justify-center font-bold text-2xl transition-all duration-200",
                      value === 0 ? "opacity-0" : "opacity-100"
                    )}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      backgroundColor: value === 0 ? 'transparent' : getTileColor(value, theme),
                      color: value === 0 ? 'transparent' : getTextColor(value, theme),
                      fontSize: value >= 1024 ? '1.5rem' : value >= 128 ? '1.75rem' : '2rem',
                    }}
                  >
                    {value > 0 && value}
                  </div>
                );
              })}
            </div>
            
            {/* Start Screen */}
            {!started && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg">
                <button
                  onClick={initGame}
                  className="flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Jouer
                </button>
              </div>
            )}
            
            {/* Win Screen (non-blocking) */}
            {won && !gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                <div className="text-center space-y-4 bg-card border border-border/50 rounded-lg p-6">
                  <h2 className="text-2xl font-light">Tu as atteint 2048!</h2>
                  <p className="text-sm text-muted-foreground">Continue pour un meilleur score</p>
                  <button
                    onClick={() => setWon(false)}
                    className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                  >
                    Continuer
                  </button>
                </div>
              </div>
            )}
            
            {/* Game Over Screen */}
            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg">
                <div className="text-center space-y-6">
                  <div>
                    <h2 className="text-2xl font-light mb-2">Fin de partie</h2>
                    <p className="text-3xl tabular-nums">{score.toLocaleString()}</p>
                  </div>
                  
                  {isNewHighScore && (
                    <p className="text-sm text-foreground">Nouveau record !</p>
                  )}
                  
                  {rewards && (rewards.money > 0 || rewards.aura > 0) && (
                    <p className="text-sm text-muted-foreground">
                      {rewards.money > 0 && `+$${rewards.money}`}
                      {rewards.money > 0 && rewards.aura > 0 && ' · '}
                      {rewards.aura > 0 && `+${rewards.aura} aura`}
                    </p>
                  )}
                  
                  <button
                    onClick={initGame}
                    className="flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors mx-auto"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Rejouer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Leaderboard Panel */}
        <div
          className="w-64 border border-border/30 rounded-lg bg-card overflow-hidden"
          style={{ height: BOARD_SIZE }}
        >
          <div className="p-4 border-b border-border/30 bg-muted/30">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h3 className="font-semibold">Classement</h3>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ height: BOARD_SIZE - 60 }}>
            {leaderboard.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Aucun score enregistré
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 group",
                      entry.user.id === user?.id && "bg-primary/10"
                    )}
                  >
                    <span className={cn(
                      "w-6 text-center font-mono text-sm",
                      index === 0 ? "text-yellow-500 font-bold" :
                      index === 1 ? "text-gray-400 font-bold" :
                      index === 2 ? "text-amber-600 font-bold" :
                      "text-muted-foreground"
                    )}>
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate text-sm">
                      {entry.user.username}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      {entry.highScore.toLocaleString()}
                    </span>
                    {user?.isAdmin && (
                      <button
                        onClick={() => handleDeleteScore(entry.user.id, entry.user.username)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                        title="Supprimer ce score"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Controls & Info */}
      <div className="flex justify-center gap-8 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded flex items-center gap-1">
            <ArrowUp className="w-3 h-3" />
          </kbd>
          <span>Haut</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded flex items-center gap-1">
            <ArrowDown className="w-3 h-3" />
          </kbd>
          <span>Bas</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
          </kbd>
          <span>Gauche</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
          </kbd>
          <span>Droite</span>
        </div>
        <div className="flex items-center gap-2">
          <span>ou</span>
          <kbd className="px-2 py-1 border border-border/50 rounded">WASD</kbd>
        </div>
        <div className="flex items-center gap-2">
          <span>ou</span>
          <span>Glisser sur mobile</span>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
        <p>
          Utilise les flèches pour déplacer les tuiles. Quand deux tuiles avec le même nombre se touchent, elles fusionnent en une seule !
        </p>
        <p className="mt-2">
          Objectif : atteindre la tuile 2048 (ou plus) pour gagner des récompenses !
        </p>
      </div>
    </div>
  );
}
