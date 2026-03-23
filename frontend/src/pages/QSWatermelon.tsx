import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw, Trophy, MousePointer2 } from 'lucide-react';
import { PageShell, PageHeader } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';

const GAME_TYPE = 'qs_watermelon';
const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 680;
const BOWL_LEFT = 30;
const BOWL_RIGHT = CANVAS_WIDTH - 30;
const BOWL_BOTTOM = CANVAS_HEIGHT - 28;
const DANGER_LINE_Y = 132;
const SPAWN_Y = 76;
const GRAVITY = 0.23;
const AIR_DAMPING = 0.997;
const FLOOR_FRICTION = 0.992;
const WALL_RESTITUTION = 0.16;
const FRUIT_RESTITUTION = 0.08;
const MERGE_SPEED_THRESHOLD = 4.5;
const GAME_OVER_BUFFER_MS = 1700;
const PRE_SPAWN_DELAY_MS = 520;

type FruitDef = {
  name: string;
  emoji: string;
  radius: number;
  fill: string;
  stroke: string;
  score: number;
};

const FRUITS: FruitDef[] = [
  { name: 'Cerise', emoji: '🍒', radius: 18, fill: '#ff7a8f', stroke: '#b11e44', score: 2 },
  { name: 'Fraise', emoji: '🍓', radius: 24, fill: '#ff7180', stroke: '#b91c3b', score: 4 },
  { name: 'Raisin', emoji: '🍇', radius: 30, fill: '#9d71ff', stroke: '#5b2fa5', score: 8 },
  { name: 'Dekopon', emoji: '🍊', radius: 36, fill: '#ffb24c', stroke: '#d36a00', score: 16 },
  { name: 'Kaki', emoji: '🟠', radius: 42, fill: '#ff8f3d', stroke: '#bf4a00', score: 32 },
  { name: 'Pomme', emoji: '🍎', radius: 49, fill: '#ff6666', stroke: '#b72424', score: 64 },
  { name: 'Poire', emoji: '🍐', radius: 56, fill: '#b8d75e', stroke: '#6a8e1f', score: 128 },
  { name: 'Pêche', emoji: '🍑', radius: 64, fill: '#ffae8a', stroke: '#d06b48', score: 256 },
  { name: 'Ananas', emoji: '🍍', radius: 74, fill: '#f0c95e', stroke: '#9d7216', score: 512 },
  { name: 'Melon', emoji: '🍈', radius: 88, fill: '#9fd98f', stroke: '#50864d', score: 1024 },
  { name: 'Pastèque', emoji: '🍉', radius: 102, fill: '#69c46a', stroke: '#1e6a36', score: 2048 },
];

type FruitBody = {
  id: number;
  type: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVelocity: number;
  merged: boolean;
  aboveDangerMs: number;
};

type FloatingText = {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const randomStartType = () => {
  const roll = Math.random();
  if (roll < 0.45) return 0;
  if (roll < 0.75) return 1;
  if (roll < 0.93) return 2;
  return 3;
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export default function QSWatermelon() {
  const { user, refreshUser } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastFrameRef = useRef(0);
  const fruitsRef = useRef<FruitBody[]>([]);
  const currentFruitRef = useRef<FruitBody | null>(null);
  const nextFruitTypeRef = useRef<number>(randomStartType());
  const spawnAtRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const scoreRef = useRef(0);
  const idRef = useRef(1);
  const textIdRef = useRef(1);
  const floatingTextRef = useRef<FloatingText[]>([]);
  const pointerXRef = useRef(CANVAS_WIDTH / 2);
  const runningRef = useRef(false);
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();

  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [nextFruitType, setNextFruitType] = useState(nextFruitTypeRef.current);
  const [currentFruitType, setCurrentFruitType] = useState<number | null>(null);
  const [mergeCount, setMergeCount] = useState(0);
  const [bestFruitReached, setBestFruitReached] = useState(0);

  const isPlaying = started && !gameOver;
  const highestFruitLabel = useMemo(() => FRUITS[bestFruitReached]?.name ?? FRUITS[0].name, [bestFruitReached]);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch {
      // noop
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const handleDeleteScore = useCallback(async (userId: string, username: string) => {
    if (!confirm(`Supprimer le score de ${username} ?`)) return;
    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      await fetchLeaderboard();
      if (userId === user?.id) {
        setHighScore(0);
      }
    } catch {
      // noop
    }
  }, [fetchLeaderboard, user?.id]);

  const createFloatingText = useCallback((x: number, y: number, text: string, color: string) => {
    floatingTextRef.current.push({
      id: textIdRef.current++,
      x,
      y,
      text,
      color,
      life: 0,
      maxLife: 900,
    });
  }, []);

  const endGame = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    runningRef.current = false;
    setGameOver(true);

    try {
      const finalScore = Math.floor(scoreRef.current);
      const response = await gamesApi.complete(GAME_TYPE, {
        score: finalScore,
        won: false,
      });

      const nextRewards = {
        money: response.data.moneyReward ?? 0,
        aura: response.data.auraReward ?? 0,
      };
      setRewards(nextRewards);
      setIsNewHighScore(Boolean(response.data.isNewHighScore));
      if (response.data.newStats?.highScore) {
        setHighScore(response.data.newStats.highScore);
      }
      await Promise.all([fetchLeaderboard(), refreshUser()]);
    } catch {
      // noop
    }
  }, [fetchLeaderboard, refreshUser]);

  const spawnCurrentFruit = useCallback((type: number) => {
    const def = FRUITS[type];
    const x = clamp(pointerXRef.current, BOWL_LEFT + def.radius, BOWL_RIGHT - def.radius);
    currentFruitRef.current = {
      id: idRef.current++,
      type,
      x,
      y: SPAWN_Y,
      vx: 0,
      vy: 0,
      rotation: 0,
      angularVelocity: 0,
      merged: false,
      aboveDangerMs: 0,
    };
    setCurrentFruitType(type);
  }, []);

  const resetGameState = useCallback(() => {
    fruitsRef.current = [];
    floatingTextRef.current = [];
    scoreRef.current = 0;
    pointerXRef.current = CANVAS_WIDTH / 2;
    nextFruitTypeRef.current = randomStartType();
    spawnAtRef.current = null;
    submittedRef.current = false;
    lastFrameRef.current = 0;
    setScore(0);
    setRewards(null);
    setIsNewHighScore(false);
    setMergeCount(0);
    setBestFruitReached(0);
    setNextFruitType(nextFruitTypeRef.current);
    setCurrentFruitType(null);
    setGameOver(false);
  }, []);

  const initGame = useCallback(() => {
    resetGameState();
    setStarted(true);
    runningRef.current = true;
    spawnCurrentFruit(randomStartType());
  }, [resetGameState, spawnCurrentFruit]);

  const scheduleNextFruit = useCallback(() => {
    spawnAtRef.current = performance.now() + PRE_SPAWN_DELAY_MS;
    setCurrentFruitType(null);
  }, []);

  const dropCurrentFruit = useCallback(() => {
    if (!runningRef.current) return;
    const fruit = currentFruitRef.current;
    if (!fruit) return;

    fruitsRef.current.push({
      ...fruit,
      vx: 0,
      vy: 0.2,
      angularVelocity: (Math.random() - 0.5) * 0.035,
    });
    currentFruitRef.current = null;

    const nextType = nextFruitTypeRef.current;
    nextFruitTypeRef.current = randomStartType();
    setNextFruitType(nextFruitTypeRef.current);
    scheduleNextFruit();

    // Prevent impossible spawn positions when large fruit is next.
    pointerXRef.current = clamp(pointerXRef.current, BOWL_LEFT + FRUITS[nextType].radius, BOWL_RIGHT - FRUITS[nextType].radius);
  }, [scheduleNextFruit]);

  const updatePointer = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    pointerXRef.current = clamp((clientX - rect.left) * scaleX, BOWL_LEFT + 16, BOWL_RIGHT - 16);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') {
        initGame();
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (!started) {
          initGame();
          return;
        }
        if (!gameOver) {
          dropCurrentFruit();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dropCurrentFruit, gameOver, initGame, started]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      updatePointer(event.clientX);
    };

    const handlePointerDown = (event: PointerEvent) => {
      updatePointer(event.clientX);
      if (!started) {
        initGame();
        return;
      }
      if (!gameOver) {
        dropCurrentFruit();
      }
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [dropCurrentFruit, gameOver, initGame, started, updatePointer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const render = (timestamp: number) => {
      const dtMs = lastFrameRef.current ? Math.min(32, timestamp - lastFrameRef.current) : 16;
      lastFrameRef.current = timestamp;
      const dtScale = dtMs / 16.6667;

      if (runningRef.current) {
        if (!currentFruitRef.current && spawnAtRef.current !== null && timestamp >= spawnAtRef.current) {
          spawnCurrentFruit(nextFruitTypeRef.current);
          spawnAtRef.current = null;
        }

        const fruits = fruitsRef.current;

        for (const fruit of fruits) {
          fruit.vy += GRAVITY * dtScale;
          fruit.x += fruit.vx * dtScale;
          fruit.y += fruit.vy * dtScale;
          fruit.rotation += fruit.angularVelocity * dtScale;
          fruit.vx *= AIR_DAMPING;
          fruit.vy *= 0.999;
          fruit.angularVelocity *= 0.995;

          const radius = FRUITS[fruit.type].radius;

          if (fruit.x - radius < BOWL_LEFT) {
            fruit.x = BOWL_LEFT + radius;
            fruit.vx = Math.abs(fruit.vx) * WALL_RESTITUTION;
          } else if (fruit.x + radius > BOWL_RIGHT) {
            fruit.x = BOWL_RIGHT - radius;
            fruit.vx = -Math.abs(fruit.vx) * WALL_RESTITUTION;
          }

          if (fruit.y + radius > BOWL_BOTTOM) {
            fruit.y = BOWL_BOTTOM - radius;
            fruit.vy = -Math.abs(fruit.vy) * 0.12;
            fruit.vx *= FLOOR_FRICTION;
            if (Math.abs(fruit.vy) < 0.18) {
              fruit.vy = 0;
            }
          }
        }

        const mergedIds = new Set<number>();
        const additions: FruitBody[] = [];
        let mergesThisFrame = 0;
        let bestReachedThisFrame = bestFruitReached;

        for (let i = 0; i < fruits.length; i += 1) {
          const a = fruits[i];
          if (!a || mergedIds.has(a.id)) continue;

          for (let j = i + 1; j < fruits.length; j += 1) {
            const b = fruits[j];
            if (!b || mergedIds.has(b.id)) continue;

            const defA = FRUITS[a.type];
            const defB = FRUITS[b.type];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const minDist = defA.radius + defB.radius;
            const distSq = dx * dx + dy * dy;

            if (distSq <= 0.0001 || distSq >= minDist * minDist) continue;

            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            const correction = overlap * 0.5;
            a.x -= nx * correction;
            a.y -= ny * correction;
            b.x += nx * correction;
            b.y += ny * correction;

            const relativeVelocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (relativeVelocity < 0) {
              const impulse = -(1 + FRUIT_RESTITUTION) * relativeVelocity * 0.5;
              a.vx -= impulse * nx;
              a.vy -= impulse * ny;
              b.vx += impulse * nx;
              b.vy += impulse * ny;
            }

            if (
              a.type === b.type &&
              a.type < FRUITS.length - 1 &&
              Math.abs(relativeVelocity) <= MERGE_SPEED_THRESHOLD &&
              overlap > Math.min(12, minDist * 0.18)
            ) {
              mergedIds.add(a.id);
              mergedIds.add(b.id);

              const nextType = a.type + 1;
              const newFruit: FruitBody = {
                id: idRef.current++,
                type: nextType,
                x: (a.x + b.x) / 2,
                y: (a.y + b.y) / 2,
                vx: (a.vx + b.vx) / 2,
                vy: Math.min((a.vy + b.vy) / 2 - 1.8, -0.8),
                rotation: (a.rotation + b.rotation) / 2,
                angularVelocity: (Math.random() - 0.5) * 0.04,
                merged: false,
                aboveDangerMs: 0,
              };
              additions.push(newFruit);

              const gained = FRUITS[nextType].score;
              scoreRef.current += gained;
              mergesThisFrame += 1;
              bestReachedThisFrame = Math.max(bestReachedThisFrame, nextType);
              createFloatingText(newFruit.x, newFruit.y, `+${gained}`, FRUITS[nextType].stroke);
              break;
            }
          }
        }

        if (mergedIds.size > 0) {
          fruitsRef.current = fruitsRef.current.filter((fruit) => !mergedIds.has(fruit.id)).concat(additions);
          setScore(Math.floor(scoreRef.current));
          if (mergesThisFrame > 0) {
            setMergeCount((value) => value + mergesThisFrame);
            setBestFruitReached(bestReachedThisFrame);
          }
        }

        let shouldEndGame = false;
        for (const fruit of fruitsRef.current) {
          const radius = FRUITS[fruit.type].radius;
          const dangerTop = fruit.y - radius;
          const almostStill = Math.abs(fruit.vx) < 0.35 && Math.abs(fruit.vy) < 0.45;

          if (dangerTop <= DANGER_LINE_Y && almostStill) {
            fruit.aboveDangerMs += dtMs;
            if (fruit.aboveDangerMs >= GAME_OVER_BUFFER_MS) {
              shouldEndGame = true;
            }
          } else {
            fruit.aboveDangerMs = Math.max(0, fruit.aboveDangerMs - dtMs * 1.5);
          }
        }

        if (shouldEndGame) {
          void endGame();
        }
      }

      for (const item of floatingTextRef.current) {
        item.life += dtMs;
        item.y -= 0.03 * dtMs;
      }
      floatingTextRef.current = floatingTextRef.current.filter((item) => item.life < item.maxLife);

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      bgGradient.addColorStop(0, '#fff7ee');
      bgGradient.addColorStop(0.45, '#ffe7d6');
      bgGradient.addColorStop(1, '#ffd2aa');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const haze = ctx.createRadialGradient(CANVAS_WIDTH * 0.65, 120, 20, CANVAS_WIDTH * 0.65, 120, 260);
      haze.addColorStop(0, 'rgba(255,255,255,0.85)');
      haze.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawRoundedRect(ctx, BOWL_LEFT - 8, 102, BOWL_RIGHT - BOWL_LEFT + 16, BOWL_BOTTOM - 86, 32);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(168, 99, 37, 0.45)';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(BOWL_LEFT, DANGER_LINE_Y);
      ctx.lineTo(BOWL_RIGHT, DANGER_LINE_Y);
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 9]);
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.8)';
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(127, 29, 29, 0.85)';
      ctx.font = '12px sans-serif';
      ctx.fillText('Ligne de danger', BOWL_RIGHT - 104, DANGER_LINE_Y - 10);

      const currentFruit = currentFruitRef.current;
      if (currentFruit && isPlaying) {
        const def = FRUITS[currentFruit.type];
        currentFruit.x = clamp(pointerXRef.current, BOWL_LEFT + def.radius, BOWL_RIGHT - def.radius);

        ctx.beginPath();
        ctx.moveTo(currentFruit.x, 10);
        ctx.lineTo(currentFruit.x, currentFruit.y - def.radius - 6);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(126, 75, 34, 0.35)';
        ctx.stroke();
      }

      const allFruits = currentFruit ? [...fruitsRef.current, currentFruit] : fruitsRef.current;
      for (const fruit of allFruits) {
        const def = FRUITS[fruit.type];

        ctx.save();
        ctx.translate(fruit.x, fruit.y);
        ctx.rotate(fruit.rotation);

        const fruitGradient = ctx.createRadialGradient(-def.radius * 0.35, -def.radius * 0.4, 8, 0, 0, def.radius);
        fruitGradient.addColorStop(0, 'rgba(255,255,255,0.92)');
        fruitGradient.addColorStop(0.18, def.fill);
        fruitGradient.addColorStop(1, def.stroke);

        ctx.beginPath();
        ctx.arc(0, 0, def.radius, 0, Math.PI * 2);
        ctx.fillStyle = fruitGradient;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = def.stroke;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(-def.radius * 0.3, -def.radius * 0.34, def.radius * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();

        ctx.font = `${Math.round(def.radius * 0.95)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.emoji, 0, def.radius * 0.03);
        ctx.restore();
      }

      for (const text of floatingTextRef.current) {
        const alpha = 1 - text.life / text.maxLife;
        ctx.fillStyle = text.color.replace(')', `, ${alpha})`).startsWith('rgb')
          ? text.color
          : text.color;
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text.text, text.x, text.y);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = 'rgba(116, 63, 18, 0.9)';
      ctx.font = '600 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${Math.floor(scoreRef.current).toLocaleString()}`, 26, 34);

      const nextDef = FRUITS[nextFruitType];
      drawRoundedRect(ctx, 282, 18, 112, 74, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(168, 99, 37, 0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#8a4a16';
      ctx.font = '600 12px sans-serif';
      ctx.fillText('Suivant', 298, 38);
      ctx.font = '32px serif';
      ctx.fillText(nextDef.emoji, 350, 64);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [bestFruitReached, createFloatingText, endGame, isPlaying, nextFruitType, spawnCurrentFruit]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="QS Watermelon"
        description="Fusionne les fruits, fais grimper ton score et garde la pile sous la ligne rouge le plus longtemps possible."
      />

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-medium">Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Score</span>
                <span className="font-mono text-lg tabular-nums">{score.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Record</span>
                <span className="font-mono tabular-nums">{highScore.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fusions</span>
                <span className="font-mono tabular-nums">{mergeCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Meilleur fruit</span>
                <span>{FRUITS[bestFruitReached].emoji} {highestFruitLabel}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">En main</span>
                <span>{currentFruitType !== null ? `${FRUITS[currentFruitType].emoji} ${FRUITS[currentFruitType].name}` : '—'}</span>
              </div>
              <Separator />
              <Button onClick={initGame} className="w-full gap-2">
                {started ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {started ? 'Rejouer' : 'Jouer'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-medium">Règles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 text-xs text-muted-foreground">
              <p>Déplace le fruit avec la souris ou le doigt, puis clique pour le lâcher.</p>
              <p>Deux fruits identiques fusionnent pour créer un fruit supérieur.</p>
              <p>La partie se termine si la pile reste au-dessus de la ligne rouge trop longtemps.</p>
              <Separator />
              <p className="flex items-center gap-2"><MousePointer2 className="h-3.5 w-3.5" /> `Espace` ou `Entrée` pour lâcher. `R` pour recommencer.</p>
            </CardContent>
          </Card>
        </div>

        <div
          ref={gameContainerRef}
          className={`relative flex flex-col gap-3 ${isFullscreen ? 'min-h-screen w-screen items-center bg-background px-4 py-4' : ''}`}
        >
          <GameFullscreenToolbar
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            className="w-full max-w-[420px]"
          />

          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={CANVAS_WIDTH} baseHeight={CANVAS_HEIGHT}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block h-full w-full rounded-2xl border border-border/40 bg-background shadow-sm touch-none"
            />

            {!started && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 rounded-2xl bg-background/88 px-6 text-center">
                <div className="text-6xl">🍒🍓🍇🍊🍉</div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">QS Watermelon</h2>
                  <p className="text-sm text-muted-foreground">
                    Un clone fidèle du Watermelon Game, revu avec la patte Aura.
                  </p>
                </div>
                <Button onClick={initGame} className="gap-2">
                  <Play className="h-4 w-4" />
                  Lancer une partie
                </Button>
              </div>
            )}

            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/88 px-6">
                <div className="space-y-5 text-center">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold tracking-tight">Fin de partie</h2>
                    <p className="font-mono text-4xl tabular-nums">{score.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">
                      {FRUITS[bestFruitReached].emoji} Plus gros fruit atteint: {highestFruitLabel}
                    </p>
                  </div>
                  {isNewHighScore && <p className="text-sm font-medium text-emerald-600">Nouveau record personnel</p>}
                  {rewards && (rewards.money > 0 || rewards.aura > 0) && (
                    <p className="text-sm text-muted-foreground">
                      {rewards.money > 0 ? `+$${rewards.money}` : ''}
                      {rewards.money > 0 && rewards.aura > 0 ? ' · ' : ''}
                      {rewards.aura > 0 ? `+${rewards.aura} aura` : ''}
                    </p>
                  )}
                  <Button onClick={initGame} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Rejouer
                  </Button>
                </div>
              </div>
            )}
          </GameFullscreenStage>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                Conseils
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 text-xs text-muted-foreground">
              <p>Garde le centre propre au début pour t’offrir plus de latitude quand les gros fruits arrivent.</p>
              <p>Ne force pas toutes les fusions en haut de pile: sécurise d’abord ton espace.</p>
              <p>Les grosses chaînes naissent souvent d’une base compacte, pas d’un empilement trop agressif.</p>
            </CardContent>
          </Card>

          <GameLeaderboard
            entries={leaderboard}
            currentUserId={user?.id}
            personalHighScore={highScore}
            isAdmin={user?.isAdmin}
            onDeleteScore={handleDeleteScore}
            title="Classement"
            maxHeight={420}
          />
        </div>
      </div>
    </PageShell>
  );
}
