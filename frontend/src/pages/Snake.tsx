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
import { GameOverlay } from '@/components/game/GameOverlay';
import { GameShell } from '@/components/game/GameShell';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
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

  const currentDifficulty = DIFFICULTIES[difficulty];

  const settingsPanel = (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="snake-difficulty">Difficulté</FieldLabel>
        <Select value={difficulty} onValueChange={changeDifficulty}>
          <SelectTrigger id="snake-difficulty" className="w-full">
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
        <FieldDescription>{currentDifficulty.description}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Contrôles</FieldLabel>
        <div className="flex flex-col items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Haut" onClick={() => queueDirection('up')}>
            <ArrowUp />
          </Button>
          <ButtonGroup>
            <Button variant="outline" size="icon" aria-label="Gauche" onClick={() => queueDirection('left')}>
              <ArrowLeft />
            </Button>
            <Button variant="outline" size="icon" aria-label="Bas" onClick={() => queueDirection('down')}>
              <ArrowDown />
            </Button>
            <Button variant="outline" size="icon" aria-label="Droite" onClick={() => queueDirection('right')}>
              <ArrowRight />
            </Button>
          </ButtonGroup>
        </div>
        <FieldDescription>Utilisez les flèches ou ZQSD.</FieldDescription>
      </Field>
      <Button variant="outline" onClick={() => restartGame()}>
        <RotateCcw />
        Rejouer
      </Button>
    </div>
  );

  return (
    <GameShell
      containerRef={containerRef}
      isFullscreen={isFullscreen}
      topBar={
        <GameTopBar
          score={game.score}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          rewards={rewards}
          controls={settingsPanel}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          showLeaderboard={showLeaderboard}
          onToggleLeaderboard={() => setShowLeaderboard((value) => !value)}
        >
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowSettingsDialog(true)} aria-label="Paramètres">
            <SlidersHorizontal />
          </Button>
        </GameTopBar>
      }
      aside={
        showLeaderboard ? (
          <GameLeaderboard
            entries={leaderboard}
            currentUserId={user?.id}
            personalHighScore={highScore}
            isAdmin={isAdmin}
            onDeleteScore={handleDeleteScore}
            maxHeight={600}
          />
        ) : null
      }
    >
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Paramètres Snake</DialogTitle>
            <DialogDescription>Difficulté et contrôles de la partie.</DialogDescription>
          </DialogHeader>
          {settingsPanel}
        </DialogContent>
      </Dialog>

      <div className="w-full max-w-[800px]">
        <GameFullscreenStage
          isFullscreen={isFullscreen}
          baseWidth={BOARD_PIXEL_SIZE}
          baseHeight={BOARD_PIXEL_SIZE}
          contentClassName="rounded-xl border bg-[#07140d]"
        >
          <div className="relative flex size-full flex-col overflow-hidden bg-[#0b1f13] p-4">
            <div
              className="grid flex-1 rounded-lg bg-[#0b1f13]"
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
                    'relative rounded-[8px] transition-colors',
                    (index + Math.floor(index / BOARD_SIZE)) % 2 === 0 ? 'bg-emerald-950/45' : 'bg-emerald-900/35',
                    cell.isBody && 'bg-gradient-to-br from-emerald-400 to-lime-500',
                    cell.isHead && 'bg-gradient-to-br from-lime-300 via-emerald-300 to-emerald-500',
                    cell.isFood && 'bg-gradient-to-br from-rose-400 via-orange-400 to-amber-300',
                  )}
                >
                  {cell.isHead ? (
                    <>
                      <span className="absolute left-[24%] top-[28%] h-[16%] w-[16%] rounded-full bg-slate-950/70" />
                      <span className="absolute right-[24%] top-[28%] h-[16%] w-[16%] rounded-full bg-slate-950/70" />
                    </>
                  ) : null}
                  {cell.isFood ? <span className="absolute inset-[18%] rounded-full bg-white/20" /> : null}
                </div>
              ))}
            </div>

            <GamePauseOverlay
              visible={game.status === 'paused'}
              onResume={handlePauseToggle}
              title="Pause"
              description="Le serpent garde sa trajectoire jusqu'à votre reprise."
            />

            <GameOverlay
              visible={game.status === 'idle' || game.status === 'game-over'}
              icon={game.status === 'game-over' ? Trophy : Play}
              title={game.status === 'game-over' ? 'Run terminée' : 'Prêt à jouer'}
              description={
                game.status === 'game-over'
                  ? game.reason ?? 'Le serpent a fini sa course.'
                  : 'Prenez une direction pour lancer la partie ou cliquez sur Jouer.'
              }
            >
              <Button onClick={() => (game.status === 'game-over' ? startFreshRun() : setGame((current) => ({ ...current, status: 'running' })))}>
                <Play />
                Jouer
              </Button>
              <Button variant="outline" onClick={() => restartGame()}>
                <RotateCcw />
                Reset
              </Button>
            </GameOverlay>
          </div>
        </GameFullscreenStage>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Pommes', value: game.foodsEaten },
            { label: 'Combo', value: `x${game.combo}` },
            { label: 'Mode', value: currentDifficulty.label },
            { label: 'Vitesse', value: `${game.speedMs} ms` },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center rounded-lg border p-2">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </GameShell>
  );
}
