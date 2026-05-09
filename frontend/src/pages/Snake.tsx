import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pause,
  Play,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';

type Direction = 'up' | 'down' | 'left' | 'right';
type DifficultyKey = 'zen' | 'classic' | 'rush';
type GameStatus = 'idle' | 'running' | 'paused' | 'game-over';

interface Point {
  x: number;
  y: number;
}

interface SnakeGameState {
  snake: Point[];
  direction: Direction;
  pendingDirection: Direction | null;
  food: Point;
  score: number;
  foodsEaten: number;
  combo: number;
  bestCombo: number;
  status: GameStatus;
  reason: string | null;
  ticks: number;
  lastFoodTick: number;
  speedMs: number;
}

interface DifficultyConfig {
  label: string;
  description: string;
  initialSpeedMs: number;
  minSpeedMs: number;
  speedStepMs: number;
}

const GAME_TYPE = 'snake';
const BOARD_SIZE = 20;
const BOARD_PIXEL_SIZE = 720;
const COMBO_WINDOW_TICKS = 10;

const DIFFICULTIES: Record<DifficultyKey, DifficultyConfig> = {
  zen: {
    label: 'Zen',
    description: 'Plus lent, parfait pour prendre ses marques.',
    initialSpeedMs: 180,
    minSpeedMs: 95,
    speedStepMs: 4,
  },
  classic: {
    label: 'Classique',
    description: 'Le bon rythme pour une run standard.',
    initialSpeedMs: 140,
    minSpeedMs: 72,
    speedStepMs: 5,
  },
  rush: {
    label: 'Rush',
    description: 'Le serpent accélère vite et punit les hésitations.',
    initialSpeedMs: 108,
    minSpeedMs: 52,
    speedStepMs: 6,
  },
};

const DIRECTION_VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function createInitialSnake(): Point[] {
  const center = Math.floor(BOARD_SIZE / 2);
  return [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
}

function randomFreeCell(snake: Point[]): Point {
  const occupied = new Set(snake.map((segment) => `${segment.x}:${segment.y}`));
  const freeCells: Point[] = [];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const key = `${x}:${y}`;
      if (!occupied.has(key)) {
        freeCells.push({ x, y });
      }
    }
  }

  if (freeCells.length === 0) {
    return { x: 0, y: 0 };
  }

  return freeCells[Math.floor(Math.random() * freeCells.length)];
}

function createInitialGame(difficulty: DifficultyKey): SnakeGameState {
  const snake = createInitialSnake();
  return {
    snake,
    direction: 'right',
    pendingDirection: null,
    food: randomFreeCell(snake),
    score: 0,
    foodsEaten: 0,
    combo: 0,
    bestCombo: 0,
    status: 'idle',
    reason: null,
    ticks: 0,
    lastFoodTick: -999,
    speedMs: DIFFICULTIES[difficulty].initialSpeedMs,
  };
}

function getNextHead(head: Point, direction: Direction): Point {
  const vector = DIRECTION_VECTORS[direction];
  return {
    x: head.x + vector.x,
    y: head.y + vector.y,
  };
}

function isOutOfBounds(point: Point): boolean {
  return point.x < 0 || point.x >= BOARD_SIZE || point.y < 0 || point.y >= BOARD_SIZE;
}

function pointsMatch(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function getDirectionFromKey(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
    case 'z':
    case 'Z':
      return 'up';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'q':
    case 'Q':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    default:
      return null;
  }
}

function getSnakeCollision(snake: Point[], nextHead: Point, willGrow: boolean): boolean {
  const collisionBody = willGrow ? snake : snake.slice(0, -1);
  return collisionBody.some((segment) => pointsMatch(segment, nextHead));
}

function getGameOverReason(head: Point, snake: Point[], willGrow: boolean): string {
  if (isOutOfBounds(head)) {
    return 'Tu as percute un mur.';
  }
  if (getSnakeCollision(snake, head, willGrow)) {
    return 'Tu t es mordu la queue.';
  }
  return 'La run est terminee.';
}

export default function Snake() {
  const { user, refreshUser } = useAuth();
  const { containerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const [difficulty, setDifficulty] = useState<DifficultyKey>('classic');
  const [game, setGame] = useState<SnakeGameState>(() => createInitialGame('classic'));
  const [highScore, setHighScore] = useState(0);
  const [totalPlayed, setTotalPlayed] = useState(0);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const submittedThisRunRef = useRef(false);
  const runVersionRef = useRef(0);
  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);
  const canPause = game.status === 'running' || game.status === 'paused';
  const runStarted = game.ticks > 0 || game.foodsEaten > 0;

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(response.data.stats.highScore || 0);
      setTotalPlayed(response.data.stats.totalPlayed || 0);
    } catch (error) {
      console.error('Failed to fetch snake stats:', error);
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch snake leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    void fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const restartGame = useCallback((nextDifficulty: DifficultyKey = difficulty) => {
    runVersionRef.current += 1;
    submittedThisRunRef.current = false;
    setGame(createInitialGame(nextDifficulty));
    setRewards(null);
    setIsNewHighScore(false);
    setLastScore(null);
  }, [difficulty]);

  const startFreshRun = useCallback((nextDifficulty: DifficultyKey = difficulty) => {
    runVersionRef.current += 1;
    submittedThisRunRef.current = false;
    setRewards(null);
    setIsNewHighScore(false);
    setLastScore(null);
    setGame({
      ...createInitialGame(nextDifficulty),
      status: 'running',
    });
  }, [difficulty]);

  const changeDifficulty = (value: string) => {
    const nextDifficulty = value as DifficultyKey;
    setDifficulty(nextDifficulty);
    restartGame(nextDifficulty);
  };

  const queueDirection = useCallback((nextDirection: Direction) => {
    setGame((current) => {
      if (current.status === 'game-over') {
        return current;
      }

      const effectiveDirection = current.pendingDirection ?? current.direction;
      if (current.snake.length > 1 && OPPOSITE_DIRECTION[effectiveDirection] === nextDirection) {
        if (current.status === 'idle') {
          return { ...current, status: 'running' };
        }
        return current;
      }

      return {
        ...current,
        pendingDirection: nextDirection,
        status: current.status === 'idle' ? 'running' : current.status,
      };
    });
  }, []);

  useEffect(() => {
    if (game.status !== 'running') return;

    const interval = window.setInterval(() => {
      setGame((current) => {
        if (current.status !== 'running') {
          return current;
        }

        const nextDirection = current.pendingDirection ?? current.direction;
        const nextHead = getNextHead(current.snake[0], nextDirection);
        const willGrow = pointsMatch(nextHead, current.food);
        const didCrash = isOutOfBounds(nextHead) || getSnakeCollision(current.snake, nextHead, willGrow);

        if (didCrash) {
          return {
            ...current,
            direction: nextDirection,
            pendingDirection: null,
            status: 'game-over',
            reason: getGameOverReason(nextHead, current.snake, willGrow),
            ticks: current.ticks + 1,
            combo: 0,
          };
        }

        const grownSnake = [nextHead, ...current.snake];
        const nextSnake = willGrow ? grownSnake : grownSnake.slice(0, -1);

        if (!willGrow) {
          return {
            ...current,
            snake: nextSnake,
            direction: nextDirection,
            pendingDirection: null,
            ticks: current.ticks + 1,
          };
        }

        const nextTicks = current.ticks + 1;
        const combo = nextTicks - current.lastFoodTick <= COMBO_WINDOW_TICKS ? current.combo + 1 : 1;
        const scoreGain = 10 + Math.max(0, combo - 1) * 4;
        const difficultyConfig = DIFFICULTIES[difficulty];

        return {
          ...current,
          snake: nextSnake,
          direction: nextDirection,
          pendingDirection: null,
          food: randomFreeCell(nextSnake),
          score: current.score + scoreGain,
          foodsEaten: current.foodsEaten + 1,
          combo,
          bestCombo: Math.max(current.bestCombo, combo),
          ticks: nextTicks,
          lastFoodTick: nextTicks,
          speedMs: Math.max(difficultyConfig.minSpeedMs, current.speedMs - difficultyConfig.speedStepMs),
        };
      });
    }, game.speedMs);

    return () => window.clearInterval(interval);
  }, [difficulty, game.speedMs, game.status]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const nextDirection = getDirectionFromKey(event.key);
      if (nextDirection) {
        event.preventDefault();
        queueDirection(nextDirection);
        return;
      }

      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        setGame((current) => {
          if (current.status === 'idle') {
            return { ...current, status: 'running' };
          }
          if (current.status === 'running') {
            return { ...current, status: 'paused' };
          }
          if (current.status === 'paused') {
            return { ...current, status: 'running' };
          }
          return current;
        });
        return;
      }

      if (event.key === 'r' || event.key === 'R' || event.key === 'Enter') {
        event.preventDefault();
        restartGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queueDirection, restartGame]);

  useEffect(() => {
    if (game.status !== 'game-over' || submittedThisRunRef.current || !user?.id || !runStarted) {
      return;
    }

    submittedThisRunRef.current = true;
    const submittedRunVersion = runVersionRef.current;

    const submit = async () => {
      try {
        const response = await gamesApi.complete(GAME_TYPE, {
          score: game.score,
          won: game.score >= 60,
        });

        if (submittedRunVersion === runVersionRef.current) {
          setRewards({
            aura: response.data.auraReward,
            money: response.data.moneyReward,
          });
          setLastScore(game.score);
          setIsNewHighScore(Boolean(response.data.isNewHighScore));
        }
        if (response.data.isNewHighScore) {
          setHighScore((current) => Math.max(current, game.score));
        }

        await refreshUser();
        await Promise.all([fetchStats(), fetchLeaderboard()]);
      } catch (error) {
        console.error('Failed to submit snake score:', error);
      }
    };

    void submit();
  }, [fetchLeaderboard, fetchStats, game.score, game.status, refreshUser, runStarted, user?.id]);

  const handlePauseToggle = () => {
    setGame((current) => {
      if (current.status === 'running') {
        return { ...current, status: 'paused' };
      }
      if (current.status === 'paused') {
        return { ...current, status: 'running' };
      }
      return current;
    });
  };

  const handleDeleteScore = useCallback(async (userId: string, _username: string) => {

    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      if (userId === user?.id) {
        setHighScore(0);
      }
      await fetchLeaderboard();
    } catch (error) {
      console.error('Failed to delete snake score:', error);
    }
  }, [fetchLeaderboard, user?.id]);

  const gridCells = useMemo(() => {
    const snakeByCell = new Map<string, number>();
    game.snake.forEach((segment, index) => {
      snakeByCell.set(`${segment.x}:${segment.y}`, index);
    });

    return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
      const x = index % BOARD_SIZE;
      const y = Math.floor(index / BOARD_SIZE);
      const key = `${x}:${y}`;
      const snakeIndex = snakeByCell.get(key);
      const isFood = game.food.x === x && game.food.y === y;
      const isHead = snakeIndex === 0;
      const isBody = typeof snakeIndex === 'number' && snakeIndex > 0;

      return {
        key,
        isFood,
        isHead,
        isBody,
        bodyIndex: snakeIndex ?? -1,
      };
    });
  }, [game.food.x, game.food.y, game.snake]);

  const currentDifficulty = DIFFICULTIES[difficulty];

  return (
    <PageShell size="wide">
      <PageHeader
        title="Snake"
        description="Un Snake natif au hub Aura: score, combos, acceleration progressive et classement persistant."
      />

      <div className={cn('grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]', isFullscreen && 'grid-cols-1')}>
        <div className={cn('space-y-4', isFullscreen && 'hidden')}>
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-medium">Run</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="text-2xl font-semibold tabular-nums">{game.score}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Record</p>
                  <p className="text-2xl font-semibold tabular-nums">{highScore}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Pommes</p>
                  <p className="text-xl font-medium tabular-nums">{game.foodsEaten}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Combo max</p>
                  <p className="text-xl font-medium tabular-nums">x{Math.max(game.bestCombo, game.combo)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Difficulte</p>
                <Select value={difficulty} onValueChange={changeDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIFFICULTIES).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{currentDifficulty.description}</p>
              </div>

              <Separator />

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Statut: <span className="text-foreground">{game.status === 'idle' ? 'Pret' : game.status === 'running' ? 'En cours' : game.status === 'paused' ? 'En pause' : 'Termine'}</span></p>
                <p>Vitesse: <span className="font-mono text-foreground">{game.speedMs} ms</span></p>
                <p>Parties jouees: <span className="font-mono text-foreground">{totalPlayed}</span></p>
              </div>

              {lastScore !== null && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
                  <p className="font-medium text-foreground">Derniere run: {lastScore}</p>
                  <p className="mt-1 text-muted-foreground">
                    {rewards && (rewards.money > 0 || rewards.aura > 0)
                      ? `${rewards.money > 0 ? `+$${rewards.money}` : ''}${rewards.money > 0 && rewards.aura > 0 ? ' · ' : ''}${rewards.aura > 0 ? `+${rewards.aura} aura` : ''}`
                      : 'Aucune recompense sur cette run.'}
                  </p>
                  {isNewHighScore ? <p className="mt-1 text-emerald-600 dark:text-emerald-400">Nouveau record personnel.</p> : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-medium">Commandes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 text-sm text-muted-foreground">
              <p>Fleches ou ZQSD pour tourner.</p>
              <p>Espace pour pause/reprise.</p>
              <p>R ou Entree pour relancer la run.</p>
            </CardContent>
          </Card>
        </div>

        <div
          ref={containerRef}
          className={cn('flex flex-col gap-3', isFullscreen && 'min-h-screen w-screen bg-background px-4 py-4')}
        >
          <GameFullscreenToolbar isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} className="w-full">
            <GamePauseButton isPaused={game.status === 'paused'} onToggle={handlePauseToggle} disabled={!canPause} />
            {game.status === 'idle' ? (
              <Button size="sm" onClick={() => setGame((current) => ({ ...current, status: 'running' }))}>
                <Play className="mr-2 h-4 w-4" />
                Demarrer
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => restartGame()}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Rejouer
            </Button>
          </GameFullscreenToolbar>

          <GameFullscreenStage
            isFullscreen={isFullscreen}
            baseWidth={BOARD_PIXEL_SIZE}
            baseHeight={BOARD_PIXEL_SIZE}
            contentClassName="rounded-[28px] border border-emerald-500/20 bg-[#07140d] shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
          >
            <div className="relative flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_45%),linear-gradient(180deg,_rgba(5,15,10,0.96),_rgba(4,12,8,1))] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Score</p>
                  <p className="text-2xl font-semibold tabular-nums">{game.score}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Record</p>
                  <p className="text-2xl font-semibold tabular-nums">{highScore}</p>
                </div>
              </div>

              <div
                className="grid flex-1 rounded-[22px] border border-white/10 bg-[#0b1f13] p-2 shadow-inner"
                style={{
                  gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                  gap: '3px',
                }}
              >
                {gridCells.map((cell, index) => (
                  <div
                    key={cell.key}
                    className={cn(
                      'relative rounded-[8px] bg-emerald-950/45 transition-colors',
                      (index + Math.floor(index / BOARD_SIZE)) % 2 === 0 ? 'bg-emerald-950/45' : 'bg-emerald-900/35',
                      cell.isBody && 'bg-gradient-to-br from-emerald-400 to-lime-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
                      cell.isHead && 'bg-gradient-to-br from-lime-300 via-emerald-300 to-emerald-500 shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_22px_rgba(132,204,22,0.42)]',
                      cell.isFood && 'bg-gradient-to-br from-rose-400 via-orange-400 to-amber-300 shadow-[0_0_16px_rgba(251,146,60,0.45)]',
                    )}
                  >
                    {cell.isHead ? (
                      <>
                        <span className="absolute left-[24%] top-[28%] h-[16%] w-[16%] rounded-full bg-slate-950/70" />
                        <span className="absolute right-[24%] top-[28%] h-[16%] w-[16%] rounded-full bg-slate-950/70" />
                      </>
                    ) : null}
                    {cell.isFood ? (
                      <>
                        <span className="absolute inset-[18%] rounded-full bg-white/18" />
                        <span className="absolute left-[46%] top-[10%] h-[20%] w-[8%] -translate-x-1/2 rounded-full bg-emerald-200/80" />
                      </>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-white/78 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Pommes</p>
                  <p className="mt-1 font-semibold tabular-nums">{game.foodsEaten}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Combo</p>
                  <p className="mt-1 font-semibold tabular-nums">x{game.combo}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Mode</p>
                  <p className="mt-1 font-semibold">{currentDifficulty.label}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Tempo</p>
                  <p className="mt-1 font-semibold tabular-nums">{game.speedMs} ms</p>
                </div>
              </div>

              <GamePauseOverlay
                visible={game.status === 'paused'}
                onResume={handlePauseToggle}
                title="Pause"
                description="Le serpent garde sa trajectoire jusqu'a ta reprise."
              />

              {(game.status === 'idle' || game.status === 'game-over') && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
                  <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-slate-950/88 p-6 text-center text-white shadow-2xl">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/14">
                      {game.status === 'game-over' ? <Trophy className="h-7 w-7 text-emerald-300" /> : <Play className="h-7 w-7 text-emerald-300" />}
                    </div>
                    <h2 className="text-2xl font-semibold">
                      {game.status === 'game-over' ? 'Run terminee' : 'Pret a jouer'}
                    </h2>
                    <p className="mt-2 text-sm text-white/70">
                      {game.status === 'game-over'
                        ? game.reason ?? 'Le serpent a fini sa course.'
                        : 'Prends une direction pour lancer la premiere boucle ou clique sur demarrer.'}
                    </p>
                    {game.status === 'game-over' ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm">
                        <p>Score final: <span className="font-semibold tabular-nums">{game.score}</span></p>
                        <p>Pommes mangees: <span className="font-semibold tabular-nums">{game.foodsEaten}</span></p>
                        <p>Meilleur combo: <span className="font-semibold tabular-nums">x{Math.max(game.bestCombo, 1)}</span></p>
                      </div>
                    ) : null}
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <Button className="flex-1" onClick={() => (game.status === 'game-over' ? startFreshRun() : setGame((current) => ({ ...current, status: 'running' })))}>
                        <Play className="mr-2 h-4 w-4" />
                        {game.status === 'game-over' ? 'Relancer maintenant' : 'Demarrer'}
                      </Button>
                      <Button className="flex-1" variant="outline" onClick={() => restartGame()}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Nouvelle run
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </GameFullscreenStage>

          <Card className={cn('xl:hidden', isFullscreen && 'hidden')}>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-medium">Pad tactile</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="mx-auto grid w-[176px] grid-cols-3 gap-2">
                <span />
                <Button variant="outline" size="icon" onClick={() => queueDirection('up')}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <span />
                <Button variant="outline" size="icon" onClick={() => queueDirection('left')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePauseToggle}
                  disabled={!canPause && game.status !== 'idle'}
                >
                  {game.status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => queueDirection('right')}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <span />
                <Button variant="outline" size="icon" onClick={() => queueDirection('down')}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <span />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className={cn('space-y-4', isFullscreen && 'hidden')}>
          <GameLeaderboard
            entries={leaderboard}
            currentUserId={user?.id}
            personalHighScore={highScore}
            isAdmin={isAdmin}
            onDeleteScore={handleDeleteScore}
            title="Classement Snake"
            maxHeight={520}
          />

          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-medium">Conseils</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 text-sm text-muted-foreground">
              <p>Anticipe deux coups a l avance pour eviter les impasses au centre.</p>
              <p>Les pommes enchainees rapidement montent le combo et accelerent le score.</p>
              <p>Sur mobile, le pad tactile te permet de jouer sans clavier.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

