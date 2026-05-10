import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Eraser, RefreshCcw, SlidersHorizontal, Target } from 'lucide-react';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { GameTopBar } from '@/components/game/GameTopBar';

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
type Grid = number[][];
type CellPosition = { row: number; column: number };

type DifficultyConfig = {
  label: string;
  description: string;
  blanks: number;
  scoreMultiplier: number;
};

type GeneratedPuzzle = {
  puzzle: Grid;
  solution: Grid;
};

const GRID_SIZE = 9;
const BOX_SIZE = 3;

const difficultyConfig: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: 'Facile',
    description: 'Plus d indices, parfait pour jouer vite.',
    blanks: 38,
    scoreMultiplier: 1,
  },
  medium: {
    label: 'Moyen',
    description: 'Equilibre entre deduction et rythme.',
    blanks: 46,
    scoreMultiplier: 1.35,
  },
  hard: {
    label: 'Difficile',
    description: 'Moins d indices, plus de contraintes.',
    blanks: 52,
    scoreMultiplier: 1.75,
  },
  expert: {
    label: 'Expert',
    description: 'Grilles denses a resoudre proprement.',
    blanks: 58,
    scoreMultiplier: 2.2,
  },
};

function cloneGrid(grid: Grid) {
  return grid.map((row) => [...row]);
}

function shuffle<T>(items: T[]) {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
}

function range(size: number) {
  return Array.from({ length: size }, (_, index) => index);
}

function generateSolvedGrid() {
  const rows = shuffle(range(BOX_SIZE)).flatMap((group) =>
    shuffle(range(BOX_SIZE)).map((row) => group * BOX_SIZE + row)
  );
  const columns = shuffle(range(BOX_SIZE)).flatMap((group) =>
    shuffle(range(BOX_SIZE)).map((column) => group * BOX_SIZE + column)
  );
  const digits = shuffle(range(GRID_SIZE).map((value) => value + 1));

  return rows.map((row) =>
    columns.map((column) => digits[(BOX_SIZE * (row % BOX_SIZE) + Math.floor(row / BOX_SIZE) + column) % GRID_SIZE])
  );
}

function isPlacementValid(grid: Grid, row: number, column: number, value: number) {
  for (let index = 0; index < GRID_SIZE; index += 1) {
    if (index !== column && grid[row][index] === value) {
      return false;
    }
    if (index !== row && grid[index][column] === value) {
      return false;
    }
  }

  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxColumn = Math.floor(column / BOX_SIZE) * BOX_SIZE;

  for (let currentRow = boxRow; currentRow < boxRow + BOX_SIZE; currentRow += 1) {
    for (let currentColumn = boxColumn; currentColumn < boxColumn + BOX_SIZE; currentColumn += 1) {
      if ((currentRow !== row || currentColumn !== column) && grid[currentRow][currentColumn] === value) {
        return false;
      }
    }
  }

  return true;
}

function findBestEmptyCell(grid: Grid) {
  let bestCell: CellPosition | null = null;
  let bestCandidates: number[] | null = null;

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      if (grid[row][column] !== 0) {
        continue;
      }

      const candidates = range(GRID_SIZE)
        .map((value) => value + 1)
        .filter((value) => isPlacementValid(grid, row, column, value));

      if (candidates.length === 0) {
        return { row, column, candidates };
      }

      if (!bestCandidates || candidates.length < bestCandidates.length) {
        bestCell = { row, column };
        bestCandidates = candidates;
      }
    }
  }

  if (!bestCell || !bestCandidates) {
    return null;
  }

  return { ...bestCell, candidates: bestCandidates };
}

function countSolutions(grid: Grid, limit = 2): number {
  const nextCell = findBestEmptyCell(grid);
  if (!nextCell) {
    return 1;
  }

  if (nextCell.candidates.length === 0) {
    return 0;
  }

  let solutions = 0;

  for (const candidate of shuffle(nextCell.candidates)) {
    grid[nextCell.row][nextCell.column] = candidate;
    solutions += countSolutions(grid, limit - solutions);
    if (solutions >= limit) {
      break;
    }
  }

  grid[nextCell.row][nextCell.column] = 0;
  return solutions;
}

function carvePuzzle(solution: Grid, blanks: number) {
  const puzzle = cloneGrid(solution);
  const positions = shuffle(
    range(GRID_SIZE).flatMap((row) => range(GRID_SIZE).map((column) => ({ row, column })))
  );

  let removed = 0;

  for (const position of positions) {
    if (removed >= blanks) {
      break;
    }

    const previousValue = puzzle[position.row][position.column];
    puzzle[position.row][position.column] = 0;

    const hasUniqueSolution = countSolutions(cloneGrid(puzzle), 2) === 1;
    if (!hasUniqueSolution) {
      puzzle[position.row][position.column] = previousValue;
      continue;
    }

    removed += 1;
  }

  return puzzle;
}

function generatePuzzle(difficulty: Difficulty): GeneratedPuzzle {
  const solution = generateSolvedGrid();
  const puzzle = carvePuzzle(solution, difficultyConfig[difficulty].blanks);
  return { puzzle, solution };
}


function isSolved(grid: Grid, solution: Grid) {
  return grid.every((row, rowIndex) => row.every((value, columnIndex) => value === solution[rowIndex][columnIndex]));
}

function hasConflict(grid: Grid, row: number, column: number) {
  const value = grid[row][column];
  if (value === 0) {
    return false;
  }

  return !isPlacementValid(grid, row, column, value);
}

function getCompletionScore(difficulty: Difficulty, elapsedSeconds: number, hintsUsed: number, mistakesFound: number) {
  const base = 1000 * difficultyConfig[difficulty].scoreMultiplier;
  const timePenalty = elapsedSeconds * 2.2;
  const hintPenalty = hintsUsed * 120;
  const mistakePenalty = mistakesFound * 35;
  return Math.max(150, Math.round(base - timePenalty - hintPenalty - mistakePenalty));
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getCellBorderStyle(row: number, column: number) {
  return {
    borderTopWidth: row === 0 ? '0px' : row % BOX_SIZE === 0 ? '2.5px' : '1px',
    borderLeftWidth: column === 0 ? '0px' : column % BOX_SIZE === 0 ? '2.5px' : '1px',
    borderRightWidth: column === GRID_SIZE - 1 ? '0px' : '0px',
    borderBottomWidth: row === GRID_SIZE - 1 ? '0px' : '0px',
  };
}

function createInitialSudokuState() {
  const generated = generatePuzzle('medium');
  return {
    initialGrid: cloneGrid(generated.puzzle),
    solutionGrid: cloneGrid(generated.solution),
    draftGrid: cloneGrid(generated.puzzle),
  };
}

export default function Sudoku() {
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const { user, refreshUser } = useAuth();
  const submitLockRef = useRef(false);
  const [startingState] = useState(createInitialSudokuState);

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [initialGrid, setInitialGrid] = useState<Grid>(() => startingState.initialGrid);
  const [solutionGrid, setSolutionGrid] = useState<Grid>(() => startingState.solutionGrid);
  const [draftGrid, setDraftGrid] = useState<Grid>(() => startingState.draftGrid);
  const [selectedCell, setSelectedCell] = useState<CellPosition>({ row: 0, column: 0 });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [mistakesFound, setMistakesFound] = useState(0);
  const [showConflicts, setShowConflicts] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const currentScore = getCompletionScore(difficulty, elapsedSeconds, hintsUsed, mistakesFound);
  const canPause = !completed;

  useEffect(() => {
    if (!user) {
      return;
    }

    const fetchStats = async () => {
      try {
        const [statsResponse, leaderboardResponse] = await Promise.all([
          gamesApi.getStats('logic_lab', user.id),
          gamesApi.getLeaderboard('logic_lab', 20),
        ]);
        setHighScore(statsResponse.data.stats.highScore || 0);
        setLeaderboard(leaderboardResponse.data.rankings || []);
      } catch (error) {
        console.error('Failed to fetch sudoku data:', error);
      }
    };

    void fetchStats();
  }, [user]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedSeconds((previous) => (completed || isPaused ? previous : previous + 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [completed, isPaused]);

  const generateNewPuzzle = (nextDifficulty: Difficulty = difficulty) => {
    submitLockRef.current = false;
    const generated = generatePuzzle(nextDifficulty);
    setDifficulty(nextDifficulty);
    setInitialGrid(cloneGrid(generated.puzzle));
    setSolutionGrid(cloneGrid(generated.solution));
    setDraftGrid(cloneGrid(generated.puzzle));
    setSelectedCell({ row: 0, column: 0 });
    setElapsedSeconds(0);
    setHintsUsed(0);
    setMistakesFound(0);
    setShowConflicts(false);
    setCompleted(false);
    setRewards(null);
    setIsNewHighScore(false);
    setIsPaused(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
        if (!canPause) return;
        event.preventDefault();
        setIsPaused((current) => !current);
        return;
      }
      if (isPaused) return;
      if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        setSelectedCell((previous) => {
          if (event.key === 'ArrowUp') {
            return { row: Math.max(0, previous.row - 1), column: previous.column };
          }
          if (event.key === 'ArrowDown') {
            return { row: Math.min(GRID_SIZE - 1, previous.row + 1), column: previous.column };
          }
          if (event.key === 'ArrowLeft') {
            return { row: previous.row, column: Math.max(0, previous.column - 1) };
          }
          return { row: previous.row, column: Math.min(GRID_SIZE - 1, previous.column + 1) };
        });
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const value = Number(event.key);
        setDraftGrid((previous) =>
          previous.map((row, rowIndex) =>
            row.map((cell, columnIndex) => {
              if (rowIndex !== selectedCell.row || columnIndex !== selectedCell.column) {
                return cell;
              }
              if (initialGrid[rowIndex][columnIndex] !== 0 || completed) {
                return cell;
              }
              return value;
            })
          )
        );
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
        event.preventDefault();
        setDraftGrid((previous) =>
          previous.map((row, rowIndex) =>
            row.map((cell, columnIndex) => {
              if (rowIndex !== selectedCell.row || columnIndex !== selectedCell.column) {
                return cell;
              }
              if (initialGrid[rowIndex][columnIndex] !== 0 || completed) {
                return cell;
              }
              return 0;
            })
          )
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canPause, completed, initialGrid, isPaused, selectedCell]);

  const updateCell = (value: number) => {
    if (isPaused) return;
    setDraftGrid((previous) =>
      previous.map((row, rowIndex) =>
        row.map((cell, columnIndex) => {
          if (rowIndex !== selectedCell.row || columnIndex !== selectedCell.column) {
            return cell;
          }
          if (initialGrid[rowIndex][columnIndex] !== 0 || completed) {
            return cell;
          }
          return value;
        })
      )
    );
  };

  const validateGrid = () => {
    if (isPaused) return;
    let nextMistakes = 0;
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let column = 0; column < GRID_SIZE; column += 1) {
        if (draftGrid[row][column] !== 0 && draftGrid[row][column] !== solutionGrid[row][column]) {
          nextMistakes += 1;
        }
      }
    }
    setShowConflicts(true);
    setMistakesFound(nextMistakes);
  };

  const useHint = () => {
    if (completed || hintsUsed >= 3 || isPaused) {
      return;
    }

    const empties = range(GRID_SIZE).flatMap((row) =>
      range(GRID_SIZE)
        .filter((column) => draftGrid[row][column] !== solutionGrid[row][column])
        .map((column) => ({ row, column }))
    );

    if (empties.length === 0) {
      return;
    }

    const hintCell = empties[Math.floor(Math.random() * empties.length)];
    setDraftGrid((previous) =>
      previous.map((row, rowIndex) =>
        row.map((cell, columnIndex) =>
          rowIndex === hintCell.row && columnIndex === hintCell.column
            ? solutionGrid[rowIndex][columnIndex]
            : cell
        )
      )
    );
    setSelectedCell(hintCell);
    setHintsUsed((previous) => previous + 1);
  };

  useEffect(() => {
    if (!canPause && isPaused) {
      setIsPaused(false);
    }
  }, [canPause, isPaused]);

  const submitCompletedPuzzle = async (finalScore: number) => {
    if (!user || submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;

    try {
      const response = await gamesApi.complete('logic_lab', {
        score: finalScore,
        won: true,
        duration: elapsedSeconds,
        difficulty,
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

      const leaderboardResponse = await gamesApi.getLeaderboard('logic_lab', 20);
      setLeaderboard(leaderboardResponse.data.rankings || []);
    } catch (error) {
      console.error('Failed to submit sudoku score:', error);
    }
  };

  useEffect(() => {
    if (!completed && isSolved(draftGrid, solutionGrid)) {
      const finalScore = getCompletionScore(difficulty, elapsedSeconds, hintsUsed, mistakesFound);
      setCompleted(true);
      void submitCompletedPuzzle(finalScore);
    }
  }, [completed, difficulty, draftGrid, elapsedSeconds, hintsUsed, mistakesFound, solutionGrid]);

  const handleDeleteScore = async (userId: string, _username: string) => {
    if (!user?.isAdmin) {
      return;
    }

    try {
      await gamesApi.deleteStats('logic_lab', userId);
      if (userId === user.id) {
        setHighScore(0);
      }
      const leaderboardResponse = await gamesApi.getLeaderboard('logic_lab', 20);
      setLeaderboard(leaderboardResponse.data.rankings || []);
    } catch (error) {
      console.error('Failed to delete sudoku score:', error);
    }
  };

  const topBarControls = (
    <div className="space-y-2 text-xs">
      <p className="font-medium text-foreground">Difficulte: {difficultyConfig[difficulty].label}</p>
      <Select value={difficulty} onValueChange={(value) => setDifficulty(value as Difficulty)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(difficultyConfig) as Difficulty[]).map((level) => (
            <SelectItem key={level} value={level}>
              {difficultyConfig[level].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={validateGrid} disabled={completed}>
          <Target className="mr-1 h-3 w-3" />
          Verifier
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={useHint}
          disabled={completed || hintsUsed >= 3}
        >
          <Brain className="mr-1 h-3 w-3" />
          Indice
        </Button>
      </div>
    </div>
  );

return (
    <PageShell size="wide">

      <div
        ref={gameContainerRef}
        className={cn(
          'flex flex-col items-center gap-4 px-4 pb-6',
          isFullscreen && 'min-h-screen w-screen justify-center bg-background px-4 py-6'
        )}
      >
        <GameTopBar
          title="Sudoku"
          score={completed ? currentScore : 0}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          rewards={rewards}
          controls={topBarControls}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          showLeaderboard={showLeaderboard}
          onToggleLeaderboard={() => setShowLeaderboard(v => !v)}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => setShowSettingsDialog(true)}
            title="Parametres"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </GameTopBar>

        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Parametres Sudoku</DialogTitle>
            </DialogHeader>
            {topBarControls}
          </DialogContent>
        </Dialog>

        <div className="flex w-full max-w-[42rem] justify-between gap-2">
          {isFullscreen && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={validateGrid} disabled={completed}>
                <Target className="mr-2 h-4 w-4" />
                Verifier
              </Button>
              <Button type="button" variant="outline" onClick={useHint} disabled={completed || hintsUsed >= 3}>
                <Brain className="mr-2 h-4 w-4" />
                Indice
              </Button>
              <Button type="button" variant="outline" onClick={() => generateNewPuzzle(difficulty)}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Nouvelle grille
              </Button>
            </div>
          )}
        </div>

        <div className="relative rounded-[2rem] border border-stone-300 bg-[linear-gradient(180deg,#fdfcf8,#f4efe4)] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-6">
          <GamePauseOverlay visible={isPaused} onResume={() => setIsPaused(false)} />
          <div className="rounded-sm border-[3px] border-stone-900 bg-white shadow-[0_8px_18px_rgba(0,0,0,0.08)]">
            <div className="grid grid-cols-9">
              {draftGrid.map((row, rowIndex) =>
                row.map((value, columnIndex) => {
                  const isGiven = initialGrid[rowIndex][columnIndex] !== 0;
                  const isSelected = selectedCell.row === rowIndex && selectedCell.column === columnIndex;
                    const isPeer = selectedCell.row === rowIndex || selectedCell.column === columnIndex ||
                      (
                        Math.floor(selectedCell.row / BOX_SIZE) === Math.floor(rowIndex / BOX_SIZE) &&
                        Math.floor(selectedCell.column / BOX_SIZE) === Math.floor(columnIndex / BOX_SIZE)
                      );
                    const isConflict = showConflicts && value !== 0 && hasConflict(draftGrid, rowIndex, columnIndex);
                    const sameValue = value !== 0 && value === draftGrid[selectedCell.row][selectedCell.column];

                    return (
                      <button
                        key={`${rowIndex}-${columnIndex}`}
                        type="button"
                        onClick={() => setSelectedCell({ row: rowIndex, column: columnIndex })}
                        style={getCellBorderStyle(rowIndex, columnIndex)}
                        className={cn(
                          'aspect-square min-h-[2.45rem] border-stone-400 text-[1.35rem] leading-none transition sm:min-h-[3.55rem] sm:text-[1.8rem]',
                          isGiven ? 'bg-stone-100 font-bold text-stone-900' : 'bg-white font-medium text-stone-700 hover:bg-amber-50/70',
                          isPeer && !isSelected && 'bg-amber-50',
                          sameValue && 'text-amber-700',
                          isSelected && 'bg-amber-200/80 text-stone-950 ring-2 ring-inset ring-amber-500',
                          isConflict && 'bg-red-100 text-red-700',
                          !isSelected && !isConflict && 'focus-visible:bg-amber-100'
                        )}
                      >
                        {value === 0 ? '' : value}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

          <div className={cn('space-y-3', isFullscreen ? 'w-auto max-w-[28rem]' : 'w-full')}>
            <div className={cn('grid gap-2', isFullscreen ? 'grid-cols-5' : 'grid-cols-5 sm:grid-cols-10')}>
              {range(9).map((index) => (
                <Button key={index + 1} type="button" variant="outline" onClick={() => updateCell(index + 1)}>
                  {index + 1}
                </Button>
              ))}
              <Button type="button" variant="outline" onClick={() => updateCell(0)}>
                <Eraser className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {completed && (
            <div className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="font-medium">Grille resolue.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Score {currentScore} • temps {formatDuration(elapsedSeconds)} • {hintsUsed} indice{hintsUsed > 1 ? 's' : ''} • {mistakesFound} erreur{mistakesFound > 1 ? 's' : ''}
              </p>
              {rewards ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Recompenses: +{rewards.money}$ et +{rewards.aura} aura{isNewHighScore ? ' • nouveau record' : ''}.
                </p>
              ) : null}
            </div>
          )}
        </div>

        {showLeaderboard && !isFullscreen && (
          <div className="w-[240px] shrink-0 hidden lg:block">
            <GameLeaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              isAdmin={user?.isAdmin}
              onDeleteScore={handleDeleteScore}
              maxHeight={500}
              hidden={false}
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
