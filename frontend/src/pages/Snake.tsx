import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { cn } from '@/lib/utils';
import { Play, RotateCcw, SlidersHorizontal, Trophy, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause } from 'lucide-react';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameTopBar } from '@/components/game/GameTopBar';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

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

  const currentDifficulty = DIFFICULTIES[difficulty]; const topBarControls = (
    <div className="space-y-4 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/60 p-2 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</p>
          <p className="text-sm font-semibold tabular-nums">{game.score}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-2 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Record</p>
          <p className="text-sm font-semibold tabular-nums">{highScore}</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Difficulté</p>
        <Select value={difficulty} onValueChange={changeDifficulty}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DIFFICULTIES).map(([key, value]) => (
              <SelectItem key={key} value={key} className="text-xs">
                {value.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground leading-relaxed italic">{currentDifficulty.description}</p>
      </div>

      <Separator />

      <div className="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider">Contrôles</p>
        <div className="grid grid-cols-3 gap-2">
          <span />
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => queueDirection('up')}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <span />
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => queueDirection('left')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => queueDirection('down')}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => queueDirection('right')}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-2">
          Utilise les flèches ou ZQSD
        </p>
      </div>

      <Separator />

      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center h-8 text-xs"
        onClick={() => restartGame()}
      >
        <RotateCcw className="mr-2 h-3 w-3" />
        Rejouer
      </Button>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8 ${isFullscreen ? 'min-h-screen w-screen items-center bg-background px-4 py-4' : ''}`}
    >
      <GameTopBar
        title="Snake"
        score={game.score}
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
            <DialogTitle>Parametres Snake</DialogTitle>
          </DialogHeader>
          {topBarControls}
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-center gap-6">
        <div className="flex w-full max-w-[800px] flex-col">
          <GameFullscreenStage
            isFullscreen={isFullscreen}
            baseWidth={BOARD_PIXEL_SIZE}
            baseHeight={BOARD_PIXEL_SIZE}
            contentClassName="rounded-[28px] border border-emerald-500/20 bg-[#07140d] shadow-2xl"
          >
            <div className="relative flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_45%),linear-gradient(180deg,_rgba(5,15,10,0.96),_rgba(4,12,8,1))] p-4 sm:p-5">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.02)_100%)]" />

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

              <div className="mt-4 grid grid-cols-4 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-white/40">Pommes</p>
                  <p className="text-xs font-bold text-white tabular-nums">{game.foodsEaten}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-white/40">Combo</p>
                  <p className="text-xs font-bold text-white tabular-nums">x{game.combo}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-white/40">Mode</p>
                  <p className="text-xs font-bold text-white truncate px-1">{currentDifficulty.label}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-white/40">Vitesse</p>
                  <p className="text-xs font-bold text-white tabular-nums">{game.speedMs}ms</p>
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
                      {game.status === 'game-over' ? 'Run terminée' : 'Prêt à jouer'}
                    </h2>
                    <p className="mt-2 text-sm text-white/70">
                      {game.status === 'game-over'
                        ? game.reason ?? 'Le serpent a fini sa course.'
                        : 'Prends une direction pour lancer la première boucle ou clique sur démarrer.'}
                    </p>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <Button className="flex-1" onClick={() => (game.status === 'game-over' ? startFreshRun() : setGame((current) => ({ ...current, status: 'running' })))}>
                        <Play className="mr-2 h-4 w-4" />
                        Jouer
                      </Button>
                      <Button className="flex-1" variant="outline" onClick={() => restartGame()}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </GameFullscreenStage>
        </div>

        {showLeaderboard && !isFullscreen && (
          <div className="w-[280px] shrink-0 hidden lg:block h-full">
            <GameLeaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              isAdmin={isAdmin}
              onDeleteScore={handleDeleteScore}
              title="Classement"
              maxHeight={600}
            />
          </div>
        )}
      </div>
    </div>
  );
}

