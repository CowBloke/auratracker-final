import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Bomb, Flag, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { GameTopBar } from '@/components/game/GameTopBar';

type DifficultyKey = 'debutant' | 'intermediaire' | 'expert';
type GameStatus = 'ready' | 'playing' | 'won' | 'lost';
type MinesweeperMode = 'score' | 'speedrun';
type MinesweeperGameType = 'minesweeper' | 'minesweeper_speedrun';

interface DifficultyConfig {
  label: string;
  rows: number;
  columns: number;
  mines: number;
  description: string;
}

interface Cell {
  row: number;
  column: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
}

const GAME_TYPES: Record<MinesweeperMode, MinesweeperGameType> = {
  score: 'minesweeper',
  speedrun: 'minesweeper_speedrun',
};

const DIFFICULTIES: Record<DifficultyKey, DifficultyConfig> = {
  debutant: {
    label: 'Debutant',
    rows: 9,
    columns: 9,
    mines: 10,
    description: 'Une petite grille pour des parties rapides et propres.',
  },
  intermediaire: {
    label: 'Intermediaire',
    rows: 12,
    columns: 12,
    mines: 24,
    description: 'Le bon equilibre entre lecture du plateau et prise de risque.',
  },
  expert: {
    label: 'Expert',
    rows: 16,
    columns: 16,
    mines: 40,
    description: 'Plus dense, plus long, plus punitif si tu lis mal les chiffres.',
  },
};

const NUMBER_COLORS: Record<number, string> = {
  1: 'text-sky-600',
  2: 'text-emerald-600',
  3: 'text-red-600',
  4: 'text-indigo-700',
  5: 'text-amber-700',
  6: 'text-cyan-700',
  7: 'text-slate-800 dark:text-slate-100',
  8: 'text-zinc-500',
};

function createEmptyBoard(rows: number, columns: number): Cell[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => ({
      row,
      column,
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0,
    }))
  );
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function getNeighbors(board: Cell[][], row: number, column: number): Cell[] {
  const neighbors: Cell[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (nextRow < 0 || nextRow >= board.length || nextColumn < 0 || nextColumn >= board[0].length) continue;
      neighbors.push(board[nextRow][nextColumn]);
    }
  }

  return neighbors;
}

function seedBoard(config: DifficultyConfig, safeRow: number, safeColumn: number): Cell[][] {
  const board = createEmptyBoard(config.rows, config.columns);
  const forbidden = new Set<string>();

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const row = safeRow + rowOffset;
      const column = safeColumn + columnOffset;
      if (row < 0 || row >= config.rows || column < 0 || column >= config.columns) continue;
      forbidden.add(`${row}:${column}`);
    }
  }

  let minesPlaced = 0;
  while (minesPlaced < config.mines) {
    const row = Math.floor(Math.random() * config.rows);
    const column = Math.floor(Math.random() * config.columns);
    const key = `${row}:${column}`;
    if (forbidden.has(key) || board[row][column].isMine) continue;
    board[row][column].isMine = true;
    minesPlaced += 1;
  }

  for (let row = 0; row < config.rows; row += 1) {
    for (let column = 0; column < config.columns; column += 1) {
      if (board[row][column].isMine) continue;
      board[row][column].adjacentMines = getNeighbors(board, row, column).filter((cell) => cell.isMine).length;
    }
  }

  return board;
}

function revealCluster(board: Cell[][], startRow: number, startColumn: number): { board: Cell[][]; revealed: number } {
  const nextBoard = cloneBoard(board);
  const queue: Array<[number, number]> = [[startRow, startColumn]];
  const visited = new Set<string>();
  let revealed = 0;

  while (queue.length > 0) {
    const [row, column] = queue.shift() as [number, number];
    const key = `${row}:${column}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = nextBoard[row][column];
    if (cell.isRevealed || cell.isFlagged) continue;

    cell.isRevealed = true;
    revealed += 1;

    if (cell.isMine || cell.adjacentMines > 0) continue;

    for (const neighbor of getNeighbors(nextBoard, row, column)) {
      if (!neighbor.isRevealed && !neighbor.isMine && !neighbor.isFlagged) {
        queue.push([neighbor.row, neighbor.column]);
      }
    }
  }

  return { board: nextBoard, revealed };
}

function revealAllMines(board: Cell[][]): Cell[][] {
  return board.map((row) =>
    row.map((cell) =>
      cell.isMine
        ? { ...cell, isRevealed: true }
        : cell
    )
  );
}

function countFlagsAround(board: Cell[][], row: number, column: number): number {
  return getNeighbors(board, row, column).filter((cell) => cell.isFlagged).length;
}

function computeScore(config: DifficultyConfig, elapsedSeconds: number, wrongFlags: number): number {
  const boardValue = config.rows * config.columns * 8;
  const mineValue = config.mines * 55;
  const speedBonus = Math.max(0, 1400 - elapsedSeconds * 6);
  const precisionBonus = Math.max(0, 220 - wrongFlags * 30);
  return Math.max(100, boardValue + mineValue + speedBonus + precisionBonus);
}

function getCellSize(columns: number): string {
  if (columns <= 9) return 'clamp(2rem, 5vw, 3rem)';
  if (columns <= 12) return 'clamp(1.6rem, 4vw, 2.5rem)';
  return 'clamp(1.25rem, 3.1vw, 2rem)';
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default function Minesweeper() {
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const { user, refreshUser } = useAuth();
  const [mode, setMode] = useState<MinesweeperMode>('score');
  const [difficulty, setDifficulty] = useState<DifficultyKey>('intermediaire');
  const [board, setBoard] = useState<Cell[][]>(() => createEmptyBoard(DIFFICULTIES.intermediaire.rows, DIFFICULTIES.intermediaire.columns));
  const [status, setStatus] = useState<GameStatus>('ready');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [minesLeft, setMinesLeft] = useState(DIFFICULTIES.intermediaire.mines);
  const [flagsUsed, setFlagsUsed] = useState(0);
  const [revealedSafeCells, setRevealedSafeCells] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [totalPlayed, setTotalPlayed] = useState(0);
  const [wins, setWins] = useState(0);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const submitLockRef = useRef(false);
  const activeModeRef = useRef<MinesweeperMode>('score');
  const activeGameTypeRef = useRef<MinesweeperGameType>('minesweeper');

  const selectedMode = mode;
  const selectedGameType = GAME_TYPES[selectedMode];
  const displayMode = hasStarted ? activeModeRef.current : selectedMode;
  const isSpeedrunDisplay = displayMode === 'speedrun';

  const config = DIFFICULTIES[difficulty];
  const totalSafeCells = config.rows * config.columns - config.mines;
  const progress = Math.min(100, Math.round((revealedSafeCells / totalSafeCells) * 100));
  const winRate = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0;

  const wrongFlags = useMemo(
    () => board.flat().filter((cell) => cell.isFlagged && !cell.isMine).length,
    [board]
  );

  const resetBoard = useCallback((nextDifficulty: DifficultyKey = difficulty) => {
    const nextConfig = DIFFICULTIES[nextDifficulty];
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    startTimeRef.current = null;
    submitLockRef.current = false;
    setBoard(createEmptyBoard(nextConfig.rows, nextConfig.columns));
    setStatus('ready');
    setElapsedSeconds(0);
    setMinesLeft(nextConfig.mines);
    setFlagsUsed(0);
    setRevealedSafeCells(0);
    setRewards(null);
    setIsNewHighScore(false);
    setLastScore(0);
    setHasStarted(false);
  }, [difficulty]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const response = await gamesApi.getStats(selectedGameType, user.id);
      setHighScore(response.data.stats.highScore || 0);
      setTotalPlayed(response.data.stats.totalPlayed || 0);
      setWins(response.data.stats.wins || 0);
    } catch (error) {
      console.error('Failed to fetch minesweeper stats:', error);
    }
  }, [selectedGameType, user]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(selectedGameType, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch minesweeper leaderboard:', error);
    }
  }, [selectedGameType]);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  useEffect(() => {
    resetBoard(difficulty);
  }, [difficulty, mode, resetBoard]);

  useEffect(() => {
    if (status !== 'playing') {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = window.setInterval(() => {
      if (!startTimeRef.current) return;
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 200);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  const submitResult = useCallback(async (gameType: MinesweeperGameType, won: boolean, score: number, duration: number) => {
    if (!user || submitLockRef.current) return;
    submitLockRef.current = true;

    try {
      const response = await gamesApi.complete(gameType, {
        score,
        won,
        duration,
        difficulty,
      });

      setRewards({
        aura: response.data.auraReward || 0,
        money: response.data.moneyReward || 0,
      });
      setIsNewHighScore(Boolean(response.data.isNewHighScore));
      setHighScore(response.data.newStats?.highScore || 0);
      setTotalPlayed(response.data.newStats?.totalPlayed || 0);
      setWins(response.data.newStats?.wins || 0);
      await refreshUser();
      fetchLeaderboard();
    } catch (error) {
      console.error('Failed to submit minesweeper result:', error);
      submitLockRef.current = false;
    }
  }, [difficulty, fetchLeaderboard, refreshUser, user]);

  const finishGame = useCallback((won: boolean, nextBoard: Cell[][]) => {
    const duration = startTimeRef.current ? Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000)) : elapsedSeconds;
    const activeMode = activeModeRef.current;
    const activeGameType = activeGameTypeRef.current;
    const score = won
      ? (activeMode === 'speedrun' ? duration : computeScore(config, duration, wrongFlags))
      : 0;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setBoard(nextBoard);
    setStatus(won ? 'won' : 'lost');
    setElapsedSeconds(duration);
    setLastScore(score);
    submitResult(activeGameType, won, score, duration);
  }, [config, elapsedSeconds, submitResult, wrongFlags]);

  const tryWinCheck = useCallback((nextBoard: Cell[][], nextRevealedSafeCells: number) => {
    if (nextRevealedSafeCells >= totalSafeCells) {
      const revealedBoard = nextBoard.map((row) =>
        row.map((cell) => (cell.isMine ? { ...cell, isFlagged: true } : cell))
      );
      setMinesLeft(0);
      finishGame(true, revealedBoard);
      return true;
    }
    return false;
  }, [finishGame, totalSafeCells]);

  const revealAt = useCallback((row: number, column: number) => {
    if (status === 'won' || status === 'lost') return;

    let workingBoard = board;
    let nextStatus = status;

    if (status === 'ready') {
      workingBoard = seedBoard(config, row, column);
      startTimeRef.current = Date.now();
      activeModeRef.current = selectedMode;
      activeGameTypeRef.current = selectedGameType;
      nextStatus = 'playing';
      setStatus('playing');
      setHasStarted(true);
    }

    const targetCell = workingBoard[row][column];
    if (targetCell.isFlagged) return;

    if (targetCell.isRevealed) {
      if (targetCell.adjacentMines === 0) return;
      const flaggedAround = countFlagsAround(workingBoard, row, column);
      if (flaggedAround !== targetCell.adjacentMines) return;

      let chordBoard = cloneBoard(workingBoard);
      let chordRevealCount = 0;

      for (const neighbor of getNeighbors(chordBoard, row, column)) {
        if (neighbor.isFlagged || neighbor.isRevealed) continue;
        if (neighbor.isMine) {
          finishGame(false, revealAllMines(chordBoard));
          return;
        }

        const result = revealCluster(chordBoard, neighbor.row, neighbor.column);
        chordBoard = result.board;
        chordRevealCount += result.revealed;
      }

      if (chordRevealCount > 0) {
        const nextRevealedSafeCells = revealedSafeCells + chordRevealCount;
        setBoard(chordBoard);
        setRevealedSafeCells(nextRevealedSafeCells);
        tryWinCheck(chordBoard, nextRevealedSafeCells);
      }
      return;
    }

    if (targetCell.isMine) {
      finishGame(false, revealAllMines(workingBoard));
      return;
    }

    const result = revealCluster(workingBoard, row, column);
    const nextRevealedSafeCells = revealedSafeCells + result.revealed;
    setBoard(result.board);
    setRevealedSafeCells(nextRevealedSafeCells);

    if (nextStatus === 'playing') {
      tryWinCheck(result.board, nextRevealedSafeCells);
    }
  }, [board, config, finishGame, revealedSafeCells, selectedGameType, selectedMode, status, tryWinCheck]);

  const toggleFlagAt = useCallback((row: number, column: number) => {
    if (status === 'won' || status === 'lost') return;

    if (status === 'ready' && !hasStarted) {
      setHasStarted(true);
    }

    const nextBoard = cloneBoard(board);
    const cell = nextBoard[row][column];
    if (cell.isRevealed) return;

    cell.isFlagged = !cell.isFlagged;
    const nextFlagsUsed = flagsUsed + (cell.isFlagged ? 1 : -1);
    setBoard(nextBoard);
    setFlagsUsed(nextFlagsUsed);
    setMinesLeft(config.mines - nextFlagsUsed);
  }, [board, config.mines, flagsUsed, hasStarted, status]);

  const handleCellAction = useCallback((row: number, column: number) => {
    if (flagMode) {
      toggleFlagAt(row, column);
      return;
    }
    revealAt(row, column);
  }, [flagMode, revealAt, toggleFlagAt]);

  const handleDeleteScore = useCallback(async (userId: string) => {
    if (!user?.isAdmin) return;
    try {
      await gamesApi.deleteStats(selectedGameType, userId);
      fetchLeaderboard();
      fetchStats();
    } catch (error) {
      console.error('Failed to delete minesweeper score:', error);
    }
  }, [fetchLeaderboard, fetchStats, selectedGameType, user?.isAdmin]);

  const boardStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${config.columns}, minmax(0, ${getCellSize(config.columns)}))`,
    }),
    [config.columns]
  );

  const topBarControls = (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/60 p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Temps</p>
          <p className="text-sm font-semibold tabular-nums">{elapsedSeconds}s</p>
        </div>
        <div className="rounded-lg border border-border/60 p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Mines</p>
          <p className="text-sm font-semibold tabular-nums">{minesLeft}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Record</p>
          <p className="text-sm font-semibold tabular-nums">{isSpeedrunDisplay ? (highScore > 0 ? formatDuration(highScore) : '--') : highScore}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Win</p>
          <p className="text-sm font-semibold tabular-nums">{winRate}%</p>
        </div>
      </div>
      <Separator className="my-2" />
      <div className="space-y-1">
        <Button
          type="button"
          size="sm"
          variant={mode === 'score' ? 'default' : 'outline'}
          className="w-full justify-start text-xs"
          disabled={status === 'playing'}
          onClick={() => setMode('score')}
        >
          Score classique
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'speedrun' ? 'default' : 'outline'}
          className="w-full justify-start text-xs"
          disabled={status === 'playing'}
          onClick={() => setMode('speedrun')}
        >
          Speedrun
        </Button>
      </div>
      <Select value={difficulty} onValueChange={(value) => setDifficulty(value as DifficultyKey)}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((level) => (
            <SelectItem key={level} value={level} className="text-xs">
              {DIFFICULTIES[level].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant={flagMode ? 'default' : 'outline'}
        className="w-full justify-start text-xs"
        onClick={() => setFlagMode((current) => !current)}
      >
        <Flag className="mr-1 h-3 w-3" />
        {flagMode ? 'Drapeau' : 'Reveler'}
      </Button>
    </div>
  );

return (
    <PageShell size="full">
      <div
        ref={gameContainerRef}
        className={cn(
          'flex flex-col items-center gap-4 px-4 pb-4',
          isFullscreen && 'min-h-screen w-screen justify-center bg-background px-4 py-6'
        )}
      >
        <GameTopBar
          title="Démineur"
          score={status === 'won' || status === 'lost' ? lastScore : 0}
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
              <DialogTitle>Parametres Démineur</DialogTitle>
            </DialogHeader>
            {topBarControls}
          </DialogContent>
        </Dialog>

        <div className="flex w-full max-w-[42rem] justify-between gap-2">
          {isFullscreen && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => resetBoard()}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Nouvelle partie
              </Button>
              <Button
                type="button"
                variant={flagMode ? 'default' : 'outline'}
                onClick={() => setFlagMode((current) => !current)}
              >
                <Flag className="mr-2 h-4 w-4" />
                {flagMode ? 'Mode drapeau' : 'Mode reveal'}
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-stone-300 bg-[linear-gradient(180deg,#f8fafc,#e2e8f0)] p-3 shadow-[0_24px_70px_rgba(15,23,42,0.14)] sm:p-4">
          <div className="relative rounded-[1.25rem] border border-slate-300 bg-slate-100 p-2 shadow-inner">
            <div className="grid gap-1" style={boardStyle}>
              {board.flat().map((cell) => {
                const isExplodedMine = status === 'lost' && cell.isMine;
                return (
                  <button
                    key={`${cell.row}-${cell.column}`}
                    type="button"
                    onClick={() => handleCellAction(cell.row, cell.column)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      toggleFlagAt(cell.row, cell.column);
                    }}
                    disabled={status === 'won' || status === 'lost'}
                    className={cn(
                      'relative flex items-center justify-center text-xs font-bold transition-all',
                      cell.isRevealed
                        ? cell.isMine
                          ? 'bg-red-500 text-white'
                          : cell.adjacentMines === 0
                            ? 'bg-slate-200 text-transparent'
                            : NUMBER_COLORS[cell.adjacentMines as keyof typeof NUMBER_COLORS] || 'bg-slate-300'
                        : cell.isFlagged
                          ? 'bg-yellow-100'
                          : isExplodedMine
                            ? 'bg-red-600'
                            : 'bg-gradient-to-b from-slate-300 to-slate-400 hover:from-slate-200 hover:to-slate-300',
                      cell.isRevealed && cell.isMine && !isExplodedMine && 'bg-red-500'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute inset-0 rounded-sm',
                        cell.isRevealed && cell.adjacentMines > 0 && 'bg-transparent'
                      )}
                    />
                    {cell.isFlagged && !cell.isRevealed && (
                      <Flag className="h-3 w-3 text-yellow-500" />
                    )}
                    {cell.isRevealed && cell.adjacentMines > 0 && !cell.isMine && (
                      <span>{cell.adjacentMines}</span>
                    )}
                    {isExplodedMine && <Bomb className="h-4 w-4" />}
                    {cell.isRevealed && cell.isMine && !isExplodedMine && <Bomb className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {status === 'won' && (
          <div className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <p className="font-medium">Grille nettoyee.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {isSpeedrunDisplay
                ? `Temps ${formatDuration(lastScore)} · ${wrongFlags} erreur${wrongFlags !== 1 ? 's' : ''} de drapeau.`
                : `Score ${lastScore} · temps ${elapsedSeconds}s · ${wrongFlags} erreur${wrongFlags !== 1 ? 's' : ''} de drapeau.`}
            </p>
            {rewards && (
              <p className="mt-2 text-sm text-muted-foreground">
                Recompenses: +${rewards.money} · +${rewards.aura} aura{isNewHighScore ? ' · nouveau record' : ''}.
              </p>
            )}
          </div>
        )}

        {status === 'lost' && (
          <div className="w-full rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
            <p className="font-medium">Bombe declenchee.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {progress}% de progression apres {elapsedSeconds}s.
            </p>
          </div>
        )}

        {showLeaderboard && !isFullscreen && (
          <div className="w-[240px] shrink-0 hidden lg:block">
            <GameLeaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              scoreFormatter={isSpeedrunDisplay ? formatDuration : undefined}
              isAdmin={user?.isAdmin}
              onDeleteScore={(userId) => handleDeleteScore(userId)}
              maxHeight={500}
              hidden={false}
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
