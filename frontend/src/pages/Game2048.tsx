import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { gamesApi } from '../services/api';
import { Play, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { useHideGameLeaderboards, useHideGameLeftInfo } from '@/lib/game-preferences';

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

interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew: boolean;
  isMerged: boolean;
}

let tileIdCounter = 0;
const getNextTileId = () => ++tileIdCounter;

// ============================================
// GAME LOGIC
// ============================================
const createEmptyTiles = (): Tile[] => [];

const addRandomTile = (tiles: Tile[]): Tile[] => {
  const occupiedCells = new Set(tiles.map(t => `${t.row}-${t.col}`));
  const emptyCells: [number, number][] = [];

  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      if (!occupiedCells.has(`${i}-${j}`)) {
        emptyCells.push([i, j]);
      }
    }
  }

  if (emptyCells.length === 0) return tiles;

  const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const newTile: Tile = {
    id: getNextTileId(),
    value: Math.random() < 0.9 ? 2 : 4,
    row,
    col,
    isNew: true,
    isMerged: false,
  };

  return [...tiles, newTile];
};

const tilesToGrid = (tiles: Tile[]): number[][] => {
  const grid: number[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
  tiles.forEach(tile => {
    grid[tile.row][tile.col] = tile.value;
  });
  return grid;
};

const moveTiles = (tiles: Tile[], direction: Direction): { tiles: Tile[]; score: number; moved: boolean } => {
  // Clear isNew and isMerged flags
  let currentTiles = tiles.map(t => ({ ...t, isNew: false, isMerged: false }));
  let score = 0;
  let moved = false;

  // Determine movement direction
  const vectors: Record<Direction, { row: number; col: number }> = {
    up: { row: -1, col: 0 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
    right: { row: 0, col: 1 },
  };

  const vector = vectors[direction];

  // Get traversal order based on direction
  const getTraversalOrder = () => {
    const rows = Array.from({ length: GRID_SIZE }, (_, i) => i);
    const cols = Array.from({ length: GRID_SIZE }, (_, i) => i);

    if (vector.row === 1) rows.reverse(); // moving down, process bottom first
    if (vector.col === 1) cols.reverse(); // moving right, process right first

    return { rows, cols };
  };

  const { rows, cols } = getTraversalOrder();
  const mergedPositions = new Set<string>(); // Track merged positions to prevent double merging

  // Process each cell in order
  for (const row of rows) {
    for (const col of cols) {
      const tileIndex = currentTiles.findIndex(t => t.row === row && t.col === col);
      if (tileIndex === -1) continue;

      const tile = currentTiles[tileIndex];
      let newRow = row;
      let newCol = col;

      // Find furthest position
      while (true) {
        const nextRow = newRow + vector.row;
        const nextCol = newCol + vector.col;

        // Check bounds
        if (nextRow < 0 || nextRow >= GRID_SIZE || nextCol < 0 || nextCol >= GRID_SIZE) break;

        // Check for existing tile
        const targetTile = currentTiles.find(t => t.row === nextRow && t.col === nextCol && t.id !== tile.id);

        if (!targetTile) {
          // Empty cell, can move
          newRow = nextRow;
          newCol = nextCol;
        } else if (targetTile.value === tile.value && !mergedPositions.has(`${nextRow}-${nextCol}`)) {
          // Can merge
          newRow = nextRow;
          newCol = nextCol;
          break;
        } else {
          // Blocked
          break;
        }
      }

      // Check if we need to merge
      const mergeTileIndex = currentTiles.findIndex(
        t => t.row === newRow && t.col === newCol && t.id !== tile.id
      );

      if (mergeTileIndex !== -1) {
        // Merge tiles
        const mergeTile = currentTiles[mergeTileIndex];
        const newValue = tile.value * 2;
        score += newValue;
        moved = true;

        // Remove old tile and update merged tile
        currentTiles = currentTiles.filter((_, i) => i !== tileIndex);
        const updatedMergeIndex = currentTiles.findIndex(t => t.id === mergeTile.id);
        currentTiles[updatedMergeIndex] = {
          ...mergeTile,
          value: newValue,
          isMerged: true,
        };
        mergedPositions.add(`${newRow}-${newCol}`);
      } else if (newRow !== row || newCol !== col) {
        // Just move
        moved = true;
        currentTiles[tileIndex] = { ...tile, row: newRow, col: newCol };
      }
    }
  }

  return { tiles: currentTiles, score, moved };
};

const canMove = (tiles: Tile[]): boolean => {
  // Check for empty cells
  if (tiles.length < GRID_SIZE * GRID_SIZE) return true;

  // Check for possible merges
  const grid = tilesToGrid(tiles);
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      const current = grid[i][j];
      if (
        (i < GRID_SIZE - 1 && grid[i + 1][j] === current) ||
        (j < GRID_SIZE - 1 && grid[i][j + 1] === current)
      ) {
        return true;
      }
    }
  }

  return false;
};

const getHighestTile = (tiles: Tile[]): number => {
  return tiles.reduce((max, tile) => Math.max(max, tile.value), 0);
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
  const hideGameLeaderboards = useHideGameLeaderboards();
  const hideGameLeftInfo = useHideGameLeftInfo();
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();

  const [tiles, setTiles] = useState<Tile[]>(createEmptyTiles());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [won, setWon] = useState(false);
  const [showWinMessage, setShowWinMessage] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const tilesRef = useRef<Tile[]>(tiles);
  const scoreRef = useRef(0);
  const canPause = started && !gameOver;
  
  // Fetch stats and leaderboard on mount
  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, []);
  
  useEffect(() => {
    tilesRef.current = tiles;
    scoreRef.current = score;
  }, [tiles, score]);
  
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
    tileIdCounter = 0; // Reset tile ID counter
    const initialTiles = addRandomTile(addRandomTile(createEmptyTiles()));
    setTiles(initialTiles);
    setScore(0);
    setGameOver(false);
    setStarted(true);
    setIsPaused(false);
    setRewards(null);
    setIsNewHighScore(false);
    setWon(false);
    setShowWinMessage(false);
  }, []);
  
  // Handle game over
  const handleGameOver = useCallback(async () => {
    const finalScore = scoreRef.current;
    const finalMaxTile = getHighestTile(tilesRef.current);
    setGameOver(true);

    try {
      const response = await gamesApi.complete('game_2048', {
        score: finalScore,
        won: won, // Only true if player reached 2048 tile
        maxTile: finalMaxTile,
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
    if (!started || gameOver || isPaused) return;

    const currentTiles = tilesRef.current;
    const { tiles: movedTiles, score: moveScore, moved } = moveTiles(currentTiles, direction);

    if (!moved) return;

    // Update tiles first (for sliding animation)
    setTiles(movedTiles);
    setScore(prev => prev + moveScore);

    // Add new tile after a short delay (after slide animation completes)
    setTimeout(() => {
      setTiles(prevTiles => {
        const withNewTile = addRandomTile(prevTiles);

        // Check for win (2048 tile)
        if (!won && getHighestTile(withNewTile) >= 2048) {
          setWon(true);
          setShowWinMessage(true);
        }

        // Check for game over
        if (!canMove(withNewTile)) {
          setTimeout(() => handleGameOver(), 300);
        }

        return withNewTile;
      });
    }, 150); // Match this with CSS transition duration
  }, [started, gameOver, isPaused, won, handleGameOver]);
  
  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (!canPause) return;
        e.preventDefault();
        setIsPaused((current) => !current);
        return;
      }
      if ((e.key === 'r' || e.key === 'R') && gameOver) {
        e.preventDefault();
        initGame();
        return;
      }
      if (!started || gameOver || isPaused) return;

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
  }, [canPause, started, gameOver, isPaused, handleMove, initGame]);

  useEffect(() => {
    if (!canPause && isPaused) {
      setIsPaused(false);
    }
  }, [canPause, isPaused]);
  
  // Touch/swipe controls
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPaused) return;
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
    <div className={cn(
      'grid items-start gap-4 px-4 pb-6 lg:px-6 lg:pb-8',
      isFullscreen
        ? 'grid-cols-1 justify-items-center'
        : hideGameLeftInfo
          ? hideGameLeaderboards
            ? 'grid-cols-1 justify-items-center'
            : 'grid-cols-1 justify-items-center xl:grid-cols-[auto_minmax(220px,1fr)] xl:justify-items-stretch'
          : hideGameLeaderboards
            ? 'grid-cols-1 justify-items-center xl:grid-cols-[minmax(220px,1fr)_auto] xl:justify-items-stretch'
            : 'grid-cols-1 justify-items-center xl:grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)] xl:justify-items-stretch'
    )}>

      {/* ── Left column ── */}
      {!hideGameLeftInfo && (
      <div
        className={cn(
          'order-2 flex w-full max-w-[390px] flex-col gap-3 xl:order-1 xl:max-w-none',
          isFullscreen && 'hidden'
        )}
      >
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Score</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div>
              <p className="text-3xl font-light tabular-nums">{score.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Score actuel</p>
            </div>
            <Separator />
            <div>
              <p className="text-xl font-medium tabular-nums">{highScore.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Meilleur score</p>
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
            <CardTitle className="text-sm font-medium">Contrôles</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <kbd className="px-1.5 py-0.5 border border-border/50 rounded flex items-center"><ArrowUp className="w-3 h-3" /></kbd>
              <kbd className="px-1.5 py-0.5 border border-border/50 rounded flex items-center"><ArrowDown className="w-3 h-3" /></kbd>
              <kbd className="px-1.5 py-0.5 border border-border/50 rounded flex items-center"><ArrowLeft className="w-3 h-3" /></kbd>
              <kbd className="px-1.5 py-0.5 border border-border/50 rounded flex items-center"><ArrowRight className="w-3 h-3" /></kbd>
            </div>
            <p className="text-xs text-muted-foreground">ou <kbd className="px-1.5 py-0.5 border border-border/50 rounded">wasd</kbd></p>
            <p className="text-xs text-muted-foreground">ou glisser sur mobile</p>
            <p className="text-xs text-muted-foreground pt-1"><kbd className="px-1.5 py-0.5 border border-border/50 rounded">R</kbd> pour rejouer</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-4 py-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Fusionne les tuiles pour atteindre <span className="font-medium text-foreground">2048</span> et gagner des récompenses !
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* ── Center column — board ── */}
      <div
        ref={gameContainerRef}
        className={cn(
          'order-1 flex w-full max-w-[390px] flex-col gap-3 xl:order-2 xl:max-w-none',
          isFullscreen && 'min-h-screen w-screen items-center bg-background px-4 py-4'
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <GameFullscreenToolbar
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          className="w-full max-w-[390px]"
        >
          <GamePauseButton isPaused={isPaused} onToggle={() => setIsPaused((current) => !current)} disabled={!canPause} />
        </GameFullscreenToolbar>

        <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={BOARD_SIZE} baseHeight={BOARD_SIZE}>
          <div
            className="relative h-full w-full border border-border/30 rounded-lg bg-muted/20 p-2"
          >
          <GamePauseOverlay visible={isPaused} onResume={() => setIsPaused(false)} />
          {/* Background grid */}
          <div className="absolute inset-2 grid grid-cols-4 gap-2.5">
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => (
              <div key={i} className="bg-muted/30 rounded" />
            ))}
          </div>

          {/* Tiles */}
          <div className="absolute inset-2">
            {tiles.map((tile) => {
              const responsiveCellSize = `calc(${100 / GRID_SIZE}% - ${((GRID_SIZE - 1) * CELL_GAP) / GRID_SIZE}px)`;
              const left = `calc(${tile.col * (100 / GRID_SIZE)}% + ${tile.col * (CELL_GAP / GRID_SIZE)}px)`;
              const top = `calc(${tile.row * (100 / GRID_SIZE)}% + ${tile.row * (CELL_GAP / GRID_SIZE)}px)`;
              return (
                <div
                  key={tile.id}
                  className={cn(
                    'absolute rounded flex items-center justify-center font-bold',
                    'transition-all duration-150 ease-out',
                    tile.isNew && 'animate-tile-appear',
                    tile.isMerged && 'animate-tile-merge'
                  )}
                  style={{
                    top,
                    left,
                    width: responsiveCellSize,
                    height: responsiveCellSize,
                    backgroundColor: getTileColor(tile.value, theme),
                    color: getTextColor(tile.value, theme),
                    fontSize: tile.value >= 1024 ? '1.5rem' : tile.value >= 128 ? '1.75rem' : '2rem',
                    zIndex: tile.isMerged ? 10 : 1,
                  }}
                >
                  {tile.value}
                </div>
              );
            })}
          </div>

          {/* Start Screen */}
          {!started && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg">
              <Button
                variant="ghost"
                onClick={initGame}
                className="flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
              >
                <Play className="w-4 h-4" />
                Jouer
              </Button>
            </div>
          )}

          {/* Win Screen */}
          {showWinMessage && !gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
              <div className="text-center space-y-4 bg-card border border-border/50 rounded-lg p-6">
                <h2 className="text-2xl font-light">Tu as atteint 2048 !</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowWinMessage(false)}
                  className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                >
                  Continuer
                </Button>
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
                {isNewHighScore && <p className="text-sm text-foreground">Nouveau record !</p>}
                {rewards && (rewards.money > 0 || rewards.aura > 0) && (
                  <p className="text-sm text-muted-foreground">
                    {rewards.money > 0 && `+$${rewards.money}`}
                    {rewards.money > 0 && rewards.aura > 0 && ' · '}
                    {rewards.aura > 0 && `+${rewards.aura} aura`}
                  </p>
                )}
                <Button
                  variant="ghost"
                  onClick={initGame}
                  className="flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors mx-auto"
                >
                  <RotateCcw className="w-4 h-4" />
                  Rejouer
                </Button>
              </div>
            </div>
          )}
          </div>
        </GameFullscreenStage>
      </div>

      {/* ── Right column — leaderboard ── */}
      {!hideGameLeaderboards && (
      <div className={cn('order-3 w-full max-w-[390px] xl:max-w-none', isFullscreen && 'hidden')}>
        <GameLeaderboard
          entries={leaderboard}
          currentUserId={user?.id}
          personalHighScore={highScore}
          isAdmin={user?.isAdmin}
          onDeleteScore={handleDeleteScore}
          maxHeight={350}
          hidden={isFullscreen}
        />
      </div>
      )}

    </div>
  );
}
