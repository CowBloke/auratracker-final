import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';
import { Bomb, Flag, RotateCcw, ShieldAlert, Timer, Trophy, Wand2, X } from 'lucide-react';

type DifficultyKey = 'debutant' | 'intermediaire' | 'expert';
type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

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

interface LeaderboardEntry {
  id: string;
  highScore: number;
  user: {
    id: string;
    username: string;
    usernameColor?: string | null;
  };
}

const GAME_TYPE = 'minesweeper';

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

export default function Minesweeper() {
  const { user, refreshUser } = useAuth();
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const submitLockRef = useRef(false);

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
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(response.data.stats.highScore || 0);
      setTotalPlayed(response.data.stats.totalPlayed || 0);
      setWins(response.data.stats.wins || 0);
    } catch (error) {
      console.error('Failed to fetch minesweeper stats:', error);
    }
  }, [user]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch minesweeper leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  useEffect(() => {
    resetBoard(difficulty);
  }, [difficulty, resetBoard]);

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

  const submitResult = useCallback(async (won: boolean, score: number, duration: number) => {
    if (!user || submitLockRef.current) return;
    submitLockRef.current = true;

    try {
      const response = await gamesApi.complete(GAME_TYPE, {
        score,
        won,
        duration,
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
  }, [fetchLeaderboard, refreshUser, user]);

  const finishGame = useCallback((won: boolean, nextBoard: Cell[][]) => {
    const duration = startTimeRef.current ? Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000)) : elapsedSeconds;
    const score = won ? computeScore(config, duration, wrongFlags) : 0;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setBoard(nextBoard);
    setStatus(won ? 'won' : 'lost');
    setElapsedSeconds(duration);
    setLastScore(score);
    submitResult(won, score, duration);
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
  }, [board, config, finishGame, revealedSafeCells, status, tryWinCheck]);

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
      await gamesApi.deleteStats(GAME_TYPE, userId);
      fetchLeaderboard();
      fetchStats();
    } catch (error) {
      console.error('Failed to delete minesweeper score:', error);
    }
  }, [fetchLeaderboard, fetchStats, user?.isAdmin]);

  const boardStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${config.columns}, minmax(0, ${getCellSize(config.columns)}))`,
    }),
    [config.columns]
  );

  return (
    <PageShell size="full">
      <PageHeader
        title="Démineur"
        description="Version AuraTracker du classique Minesweeper: premier clic securise, drapeaux, reveal rapide et classement sur le meilleur score."
        actions={
          <Button type="button" variant="outline" onClick={() => resetBoard()}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Nouvelle partie
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Partie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Temps</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{elapsedSeconds}s</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Mines</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{minesLeft}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Record</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{highScore}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Winrate</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{winRate}%</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Etat</span>
                  <Badge variant="secondary" className="capitalize">
                    {status === 'ready' && 'Pret'}
                    {status === 'playing' && 'En cours'}
                    {status === 'won' && 'Victoire'}
                    {status === 'lost' && 'Explose'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cases sûres</span>
                  <span className="tabular-nums">{revealedSafeCells}/{totalSafeCells}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Drapeaux poses</span>
                  <span className="tabular-nums">{flagsUsed}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Erreurs de flag</span>
                  <span className="tabular-nums">{wrongFlags}</span>
                </div>
              </div>

              {isNewHighScore ? <p className="text-sm">Nouveau record personnel.</p> : null}
              {rewards && (rewards.money > 0 || rewards.aura > 0) ? (
                <p className="text-sm text-muted-foreground">
                  Recompenses: {rewards.money > 0 ? `+$${rewards.money}` : '$0'}
                  {` · `}
                  {rewards.aura > 0 ? `+${rewards.aura} aura` : '+0 aura'}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Difficulte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={cn(
                    'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                    difficulty === level
                      ? 'border-foreground bg-muted'
                      : 'border-border/60 hover:border-foreground/30 hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{DIFFICULTIES[level].label}</span>
                    <span className="text-xs text-muted-foreground">
                      {DIFFICULTIES[level].rows}x{DIFFICULTIES[level].columns} · {DIFFICULTIES[level].mines}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{DIFFICULTIES[level].description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Controles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                type="button"
                variant={flagMode ? 'default' : 'outline'}
                className="w-full justify-start"
                onClick={() => setFlagMode((current) => !current)}
              >
                <Flag className="mr-2 h-4 w-4" />
                Mode mobile: {flagMode ? 'Drapeau' : 'Reveal'}
              </Button>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Clic: revele une case.</p>
                <p>Clic droit: pose ou retire un drapeau.</p>
                <p>Clic sur un chiffre deja ouvert: reveal rapide si les drapeaux autour sont corrects.</p>
                <p>Le premier clic est toujours securise.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-border/60">
          <div className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.94))] text-white">
            <CardContent className="space-y-5 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="border-0 bg-white/12 text-white">
                  {config.label}
                </Badge>
                <Badge variant="secondary" className="border-0 bg-white/12 text-white">
                  <Timer className="mr-1 h-3.5 w-3.5" />
                  {elapsedSeconds}s
                </Badge>
                <Badge variant="secondary" className="border-0 bg-white/12 text-white">
                  <Bomb className="mr-1 h-3.5 w-3.5" />
                  {config.mines} mines
                </Badge>
                <Badge variant="secondary" className="border-0 bg-white/12 text-white">
                  Progression {progress}%
                </Badge>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">Lis les chiffres, ferme les angles morts et nettoie la grille sans toucher une bombe.</h2>
                <p className="text-sm text-white/80">
                  Le score favorise les grilles denses resolues vite et proprement. Les erreurs de drapeau reduisent le bonus final.
                </p>
              </div>
            </CardContent>
          </div>

          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => resetBoard()}>
                <Wand2 className="mr-2 h-4 w-4" />
                Regenerer
              </Button>
              <Button type="button" variant="outline" onClick={() => setFlagMode((current) => !current)}>
                <Flag className="mr-2 h-4 w-4" />
                {flagMode ? 'Passer en reveal' : 'Passer en drapeau'}
              </Button>
              {(status === 'won' || status === 'lost') && (
                <Badge variant="outline" className="ml-auto">
                  Score final {lastScore}
                </Badge>
              )}
            </div>

            <div className="overflow-x-auto">
              <div className="mx-auto w-max rounded-[1.75rem] border border-stone-300 bg-[linear-gradient(180deg,#f8fafc,#e2e8f0)] p-3 shadow-[0_24px_70px_rgba(15,23,42,0.14)] sm:p-4">
                <div className="rounded-[1.25rem] border border-slate-300 bg-slate-100 p-2 shadow-inner">
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
                          className={cn(
                            'flex aspect-square items-center justify-center rounded-md border text-sm font-black transition-all select-none',
                            cell.isRevealed
                              ? 'border-slate-300 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
                              : 'border-slate-400 bg-[linear-gradient(180deg,#e2e8f0,#cbd5e1)] hover:-translate-y-px hover:shadow-sm',
                            !cell.isRevealed && 'active:translate-y-0',
                            isExplodedMine && 'border-red-400 bg-red-100 text-red-700',
                            status === 'won' && cell.isMine && 'border-emerald-400 bg-emerald-100 text-emerald-700'
                          )}
                          style={{ width: getCellSize(config.columns) }}
                        >
                          {cell.isRevealed ? (
                            cell.isMine ? (
                              <Bomb className="h-4 w-4" />
                            ) : cell.adjacentMines > 0 ? (
                              <span className={NUMBER_COLORS[cell.adjacentMines]}>{cell.adjacentMines}</span>
                            ) : null
                          ) : cell.isFlagged ? (
                            <Flag className="h-4 w-4 text-rose-600" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {status === 'ready' && (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                La grille est prete. Premier clic securise, puis le chrono se lance automatiquement.
              </div>
            )}

            {status === 'won' && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                <p className="font-medium">Grille nettoyee.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Score {lastScore} · temps {elapsedSeconds}s · {wrongFlags} erreur{wrongFlags > 1 ? 's' : ''} de drapeau.
                </p>
              </div>
            )}

            {status === 'lost' && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                <p className="font-medium">Bombe declenchee.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tu etais a {progress}% de progression apres {elapsedSeconds}s. Relance une grille pour repartir.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                Classement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun score enregistre pour le moment.</p>
              ) : (
                leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2',
                      entry.user.id === user?.id && 'bg-muted/40'
                    )}
                  >
                    <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                    <UsernameDisplay
                      username={entry.user.username}
                      usernameColor={entry.user.usernameColor}
                      className="min-w-0 flex-1 truncate text-sm"
                    />
                    <span className="text-sm font-medium tabular-nums">{entry.highScore}</span>
                    {user?.isAdmin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteScore(entry.user.id)}
                        title="Supprimer ce score"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Lecture de grille
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Un chiffre indique le nombre exact de mines dans les 8 cases autour.</p>
              <p>Si un 1 est deja satisfait par un drapeau voisin, les autres voisins sont surs.</p>
              <p>Le reveal rapide sur un chiffre ouvert fait gagner du temps quand ton marquage est propre.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
