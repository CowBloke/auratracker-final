import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Brain, Eraser, RefreshCcw, Sparkles, Target, Trophy } from 'lucide-react';

type LeaderboardEntry = {
  id: string;
  highScore: number;
  user: {
    id: string;
    username: string;
  };
};

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

function countFilledCells(grid: Grid) {
  return grid.reduce((total, row) => total + row.filter((value) => value !== 0).length, 0);
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

export default function LogicLab() {
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [mistakesFound, setMistakesFound] = useState(0);
  const [showConflicts, setShowConflicts] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const filledCells = countFilledCells(draftGrid);
  const progressValue = (filledCells / (GRID_SIZE * GRID_SIZE)) * 100;
  const currentScore = completed ? getCompletionScore(difficulty, elapsedSeconds, hintsUsed, mistakesFound) : 0;

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
      setElapsedSeconds((previous) => (completed ? previous : previous + 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [completed]);

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
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
  }, [completed, initialGrid, selectedCell]);

  const updateCell = (value: number) => {
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
    if (completed) {
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

  return (
    <PageShell size="wide">
      <PageHeader
        title="Sudoku"
        description="Un vrai Sudoku 9x9 avec generation aleatoire, plusieurs niveaux et un classement base sur tes meilleures resolutions."
        actions={
          <Button type="button" variant="outline" onClick={() => generateNewPuzzle(difficulty)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Nouvelle grille
          </Button>
        }
      />

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start px-4 pb-6">
        {/* LEFT: Options / Score */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Difficulte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2">
                {(Object.keys(difficultyConfig) as Difficulty[]).map((level) => (
                  <Button
                    key={level}
                    type="button"
                    variant={difficulty === level ? 'default' : 'outline'}
                    onClick={() => generateNewPuzzle(level)}
                    className="justify-start"
                  >
                    {difficultyConfig[level].label}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{difficultyConfig[difficulty].description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Partie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Temps</p>
                  <p className="text-xl font-semibold">{formatDuration(elapsedSeconds)}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Record</p>
                  <p className="text-xl font-semibold">{highScore}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Indices</p>
                  <p className="text-xl font-semibold">{hintsUsed}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Erreurs</p>
                  <p className="text-xl font-semibold">{mistakesFound}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Cases {filledCells}/81</span>
                <span>{Math.round(progressValue)}%</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {/* CENTER: Game Board */}
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-[2rem] border border-stone-300 bg-[linear-gradient(180deg,#fdfcf8,#f4efe4)] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-6">
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
          </div>

          <div className="w-full space-y-3">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {range(9).map((index) => (
                <Button key={index + 1} type="button" variant="outline" onClick={() => updateCell(index + 1)}>
                  {index + 1}
                </Button>
              ))}
              <Button type="button" variant="outline" onClick={() => updateCell(0)}>
                <Eraser className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={validateGrid} disabled={completed}>
                <Target className="mr-2 h-4 w-4" />
                Verifier
              </Button>
              <Button type="button" variant="outline" onClick={useHint} disabled={completed}>
                <Brain className="mr-2 h-4 w-4" />
                Indice
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraftGrid(cloneGrid(initialGrid));
                  setShowConflicts(false);
                  setMistakesFound(0);
                  setHintsUsed(0);
                  setElapsedSeconds(0);
                  setCompleted(false);
                  setRewards(null);
                  submitLockRef.current = false;
                }}
              >
                Recommencer
              </Button>
            </div>
          </div>

          {completed ? (
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
          ) : (
            <div className="w-full rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              Utilise les fleches du clavier pour naviguer, les touches 1 a 9 pour remplir et Suppr pour vider.
            </div>
          )}
        </div>

        {/* RIGHT: Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun score enregistre pour le moment.</p>
            ) : (
              leaderboard.slice(0, 10).map((entry, index) => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
                  <p className="text-sm font-medium">#{index + 1} {entry.user.username}</p>
                  <p className="text-sm text-muted-foreground">{entry.highScore}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
