import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { cn } from '@/lib/utils';
import { RotateCcw, MousePointer2, Smartphone } from 'lucide-react';
import { gamesApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

const GAME_TYPE = 'qs_watermelon';
const WORLD_WIDTH = 400;
const WORLD_HEIGHT = 620;
const DROP_LINE_Y = 92;
const DANGER_LINE_Y = 126;
const GRAVITY = 0.22;
const AIR_DRAG = 0.996;
const FLOOR_BOUNCE = 0.18;
const WALL_BOUNCE = 0.32;
const RESTITUTION = 0.78;
const DROP_COOLDOWN_MS = 520;
const DANGER_DURATION_MS = 1200;
const MAX_SUBSTEP = 18;

type GamePhase = 'idle' | 'playing' | 'over';

interface FruitDefinition {
  key: string;
  label: string;
  radius: number;
  color: string;
  accent: string;
  text: string;
  score: number;
}

interface FruitBody {
  id: number;
  level: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  settledFrames: number;
  bornAt: number;
}

const FRUITS: FruitDefinition[] = [
  { key: 'cherry', label: 'Cerise', radius: 18, color: '#ff6b6b', accent: '#ffd6d6', text: 'C', score: 1 },
  { key: 'strawberry', label: 'Fraise', radius: 24, color: '#ff7a59', accent: '#ffe2d9', text: 'F', score: 3 },
  { key: 'grape', label: 'Raisin', radius: 30, color: '#8b5cf6', accent: '#e9ddff', text: 'R', score: 6 },
  { key: 'orange', label: 'Orange', radius: 37, color: '#fb923c', accent: '#ffedd5', text: 'O', score: 10 },
  { key: 'lemon', label: 'Citron', radius: 45, color: '#facc15', accent: '#fef9c3', text: 'Ci', score: 16 },
  { key: 'apple', label: 'Pomme', radius: 54, color: '#ef4444', accent: '#fee2e2', text: 'P', score: 28 },
  { key: 'pear', label: 'Poire', radius: 66, color: '#84cc16', accent: '#ecfccb', text: 'Po', score: 45 },
  { key: 'peach', label: 'Peche', radius: 80, color: '#fb7185', accent: '#ffe4ea', text: 'Pe', score: 72 },
  { key: 'pineapple', label: 'Ananas', radius: 96, color: '#f59e0b', accent: '#fef3c7', text: 'A', score: 110 },
  { key: 'melon', label: 'Melon', radius: 112, color: '#22c55e', accent: '#dcfce7', text: 'M', score: 170 },
  { key: 'watermelon', label: 'Pasteque', radius: 132, color: '#16a34a', accent: '#bbf7d0', text: 'W', score: 260 },
];

function randomSpawnLevel() {
  const roll = Math.random();
  if (roll < 0.38) return 0;
  if (roll < 0.68) return 1;
  if (roll < 0.88) return 2;
  if (roll < 0.97) return 3;
  return 4;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function drawFruit(ctx: CanvasRenderingContext2D, fruit: FruitBody) {
  const def = FRUITS[fruit.level];
  const gradient = ctx.createRadialGradient(
    fruit.x - fruit.radius * 0.35,
    fruit.y - fruit.radius * 0.45,
    fruit.radius * 0.15,
    fruit.x,
    fruit.y,
    fruit.radius
  );
  gradient.addColorStop(0, def.accent);
  gradient.addColorStop(1, def.color);

  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.arc(fruit.x, fruit.y, fruit.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = Math.max(2, fruit.radius * 0.08);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.stroke();

  const shadowY = fruit.y + fruit.radius * 0.18;
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(fruit.x, shadowY, fruit.radius * 0.56, fruit.radius * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  const eyeOffsetX = fruit.radius * 0.28;
  const eyeOffsetY = fruit.radius * 0.12;
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(fruit.x - eyeOffsetX, fruit.y - eyeOffsetY, Math.max(2.5, fruit.radius * 0.08), 0, Math.PI * 2);
  ctx.arc(fruit.x + eyeOffsetX, fruit.y - eyeOffsetY, Math.max(2.5, fruit.radius * 0.08), 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = Math.max(2, fruit.radius * 0.06);
  ctx.strokeStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(fruit.x, fruit.y + fruit.radius * 0.05, fruit.radius * 0.28, 0.18 * Math.PI, 0.82 * Math.PI);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(fruit.x - fruit.radius * 0.34, fruit.y - fruit.radius * 0.34, fruit.radius * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = Math.max(1.5, fruit.radius * 0.04);

  if (fruit.level === 0) {
    ctx.beginPath();
    ctx.moveTo(fruit.x, fruit.y - fruit.radius * 0.9);
    ctx.lineTo(fruit.x, fruit.y - fruit.radius * 1.15);
    ctx.strokeStyle = '#3f6212';
    ctx.stroke();
  } else if (fruit.level === 1) {
    ctx.strokeStyle = 'rgba(255, 236, 230, 0.55)';
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(
        fruit.x + i * fruit.radius * 0.16,
        fruit.y + Math.abs(i) * fruit.radius * 0.02,
        fruit.radius * 0.72,
        1.08 * Math.PI,
        1.92 * Math.PI
      );
      ctx.stroke();
    }
    ctx.fillStyle = '#3f6212';
    ctx.beginPath();
    ctx.ellipse(fruit.x, fruit.y - fruit.radius * 0.96, fruit.radius * 0.16, fruit.radius * 0.08, -0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (fruit.level === 2) {
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.arc(fruit.x + i * fruit.radius * 0.22, fruit.y + fruit.radius * 0.04, fruit.radius * 0.18, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (fruit.level === 3) {
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(fruit.x - fruit.radius * 0.78, fruit.y + i * fruit.radius * 0.22);
      ctx.lineTo(fruit.x + fruit.radius * 0.78, fruit.y + i * fruit.radius * 0.22);
      ctx.stroke();
    }
  } else if (fruit.level === 4) {
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.22)';
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(fruit.x + i * fruit.radius * 0.18, fruit.y - fruit.radius * 0.76);
      ctx.lineTo(fruit.x + i * fruit.radius * 0.18, fruit.y + fruit.radius * 0.76);
      ctx.stroke();
    }
  } else if (fruit.level === 5) {
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.moveTo(fruit.x, fruit.y - fruit.radius * 1.02);
    ctx.quadraticCurveTo(fruit.x + fruit.radius * 0.18, fruit.y - fruit.radius * 1.25, fruit.x + fruit.radius * 0.42, fruit.y - fruit.radius * 0.98);
    ctx.quadraticCurveTo(fruit.x + fruit.radius * 0.18, fruit.y - fruit.radius * 0.92, fruit.x, fruit.y - fruit.radius * 1.02);
    ctx.fill();
  } else if (fruit.level === 6) {
    ctx.strokeStyle = 'rgba(236, 252, 203, 0.28)';
    ctx.beginPath();
    ctx.arc(fruit.x, fruit.y, fruit.radius * 0.7, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(fruit.x, fruit.y + fruit.radius * 0.06, fruit.radius * 0.46, 0.14 * Math.PI, 0.86 * Math.PI);
    ctx.stroke();
  } else if (fruit.level === 7) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(fruit.x + i * fruit.radius * 0.18, fruit.y + Math.abs(i) * fruit.radius * 0.08, fruit.radius * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (fruit.level === 8) {
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.26)';
    ctx.lineWidth = Math.max(2, fruit.radius * 0.05);
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(fruit.x + i * fruit.radius * 0.18, fruit.y - fruit.radius * 0.76);
      ctx.lineTo(fruit.x + i * fruit.radius * 0.12, fruit.y + fruit.radius * 0.76);
      ctx.stroke();
    }
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.moveTo(fruit.x, fruit.y - fruit.radius * 1.05);
    ctx.lineTo(fruit.x - fruit.radius * 0.18, fruit.y - fruit.radius * 0.82);
    ctx.lineTo(fruit.x + fruit.radius * 0.18, fruit.y - fruit.radius * 0.82);
    ctx.closePath();
    ctx.fill();
  } else if (fruit.level === 9) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = Math.max(2, fruit.radius * 0.035);
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(fruit.x, fruit.y, fruit.radius * (0.34 + i * 0.09), 0.06 * Math.PI, 0.94 * Math.PI);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = 'rgba(22, 101, 52, 0.36)';
    ctx.lineWidth = Math.max(3, fruit.radius * 0.045);
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(fruit.x, fruit.y, fruit.radius * (0.42 + i * 0.08), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#166534';
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const seedX = fruit.x + Math.cos(angle) * fruit.radius * 0.55;
      const seedY = fruit.y + Math.sin(angle) * fruit.radius * 0.34;
      ctx.beginPath();
      ctx.ellipse(seedX, seedY, fruit.radius * 0.03, fruit.radius * 0.055, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.font = `600 ${Math.max(12, fruit.radius * 0.34)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.text, fruit.x, fruit.y + fruit.radius * 0.62);
  ctx.restore();
}

export default function QSWatermelon() {
  const { user, refreshUser } = useAuth();
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const fruitsRef = useRef<FruitBody[]>([]);
  const currentDropXRef = useRef<number>(WORLD_WIDTH / 2);
  const nextLevelRef = useRef<number>(randomSpawnLevel());
  const queueLevelRef = useRef<number>(randomSpawnLevel());
  const phaseRef = useRef<GamePhase>('idle');
  const lastDropAtRef = useRef<number>(0);
  const nextFruitIdRef = useRef<number>(1);
  const submitLockRef = useRef<boolean>(false);
  const dangerSinceRef = useRef<number | null>(null);
  const scoreRef = useRef<number>(0);

  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [totalPlayed, setTotalPlayed] = useState(0);
  const [wins, setWins] = useState(0);
  const [highestLevel, setHighestLevel] = useState(0);
  const [nextLevel, setNextLevel] = useState(nextLevelRef.current);
  const [queuedLevel, setQueuedLevel] = useState(queueLevelRef.current);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const winRate = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0;

  const highestFruitLabel = useMemo(
    () => FRUITS[Math.min(highestLevel, FRUITS.length - 1)]?.label ?? FRUITS[0].label,
    [highestLevel]
  );

  const syncFruitMeta = useCallback(() => {
    const maxLevel = fruitsRef.current.reduce((max, fruit) => Math.max(max, fruit.level), 0);
    setHighestLevel(maxLevel);
  }, []);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(response.data.stats.highScore || 0);
      setTotalPlayed(response.data.stats.totalPlayed || 0);
      setWins(response.data.stats.wins || 0);
    } catch (error) {
      console.error('Failed to fetch QS watermelon stats:', error);
    }
  }, [user]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch QS watermelon leaderboard:', error);
    }
  }, []);

  const submitResult = useCallback(async (finalScore: number, won: boolean) => {
    if (!user || submitLockRef.current) return;
    submitLockRef.current = true;

    try {
      const response = await gamesApi.complete(GAME_TYPE, {
        score: finalScore,
        won,
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
      console.error('Failed to submit QS watermelon result:', error);
      submitLockRef.current = false;
    }
  }, [fetchLeaderboard, refreshUser, user]);

  const endGame = useCallback((won: boolean) => {
    if (phaseRef.current === 'over') return;
    phaseRef.current = 'over';
    setPhase('over');
    submitResult(scoreRef.current, won);
  }, [submitResult]);

  const resetGame = useCallback(() => {
    fruitsRef.current = [];
    currentDropXRef.current = WORLD_WIDTH / 2;
    nextLevelRef.current = randomSpawnLevel();
    queueLevelRef.current = randomSpawnLevel();
    phaseRef.current = 'playing';
    lastDropAtRef.current = 0;
    dangerSinceRef.current = null;
    scoreRef.current = 0;
    nextFruitIdRef.current = 1;
    submitLockRef.current = false;
    setScore(0);
    setHighestLevel(0);
    setNextLevel(nextLevelRef.current);
    setQueuedLevel(queueLevelRef.current);
    setRewards(null);
    setIsNewHighScore(false);
    setPhase('playing');
  }, []);

  const spawnFruit = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const now = performance.now();
    if (now - lastDropAtRef.current < DROP_COOLDOWN_MS) return;

    const level = nextLevelRef.current;
    const def = FRUITS[level];
    const x = clamp(currentDropXRef.current, def.radius + 6, WORLD_WIDTH - def.radius - 6);

    fruitsRef.current.push({
      id: nextFruitIdRef.current++,
      level,
      x,
      y: DROP_LINE_Y,
      vx: 0,
      vy: 0,
      radius: def.radius,
      settledFrames: 0,
      bornAt: now,
    });

    nextLevelRef.current = queueLevelRef.current;
    queueLevelRef.current = randomSpawnLevel();
    lastDropAtRef.current = now;
    setNextLevel(nextLevelRef.current);
    setQueuedLevel(queueLevelRef.current);
    syncFruitMeta();
  }, [syncFruitMeta]);

  const handleDeleteScore = useCallback(async (userId: string) => {
    if (!user?.isAdmin) return;
    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      fetchLeaderboard();
      fetchStats();
    } catch (error) {
      console.error('Failed to delete QS watermelon score:', error);
    }
  }, [fetchLeaderboard, fetchStats, user?.isAdmin]);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const stepPhysics = (dt: number, now: number) => {
      const bodies = fruitsRef.current;
      const dtNorm = dt / (1000 / 60);

      for (const fruit of bodies) {
        fruit.vy += GRAVITY * dtNorm;
        fruit.x += fruit.vx * dtNorm;
        fruit.y += fruit.vy * dtNorm;
        fruit.vx *= AIR_DRAG;
        fruit.vy *= 0.999;

        if (fruit.x - fruit.radius < 0) {
          fruit.x = fruit.radius;
          fruit.vx = Math.abs(fruit.vx) * WALL_BOUNCE;
        }
        if (fruit.x + fruit.radius > WORLD_WIDTH) {
          fruit.x = WORLD_WIDTH - fruit.radius;
          fruit.vx = -Math.abs(fruit.vx) * WALL_BOUNCE;
        }
        if (fruit.y + fruit.radius > WORLD_HEIGHT) {
          fruit.y = WORLD_HEIGHT - fruit.radius;
          fruit.vy = -Math.abs(fruit.vy) * FLOOR_BOUNCE;
          fruit.vx *= 0.96;
        }

        const speed = Math.abs(fruit.vx) + Math.abs(fruit.vy);
        fruit.settledFrames = speed < 0.35 ? fruit.settledFrames + 1 : 0;
      }

      const toRemove = new Set<number>();
      const toAdd: FruitBody[] = [];
      let scoreDelta = 0;
      let maxLevel = highestLevel;

      for (let i = 0; i < bodies.length; i += 1) {
        const a = bodies[i];
        if (toRemove.has(a.id)) continue;

        for (let j = i + 1; j < bodies.length; j += 1) {
          const b = bodies[j];
          if (toRemove.has(b.id)) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 0.0001;
          const minDistance = a.radius + b.radius;

          if (distance >= minDistance) continue;

          if (a.level === b.level && a.level < FRUITS.length - 1) {
            const mergedLevel = a.level + 1;
            const mergedDef = FRUITS[mergedLevel];
            toRemove.add(a.id);
            toRemove.add(b.id);
            scoreDelta += mergedDef.score;
            maxLevel = Math.max(maxLevel, mergedLevel);
            toAdd.push({
              id: nextFruitIdRef.current++,
              level: mergedLevel,
              x: (a.x + b.x) / 2,
              y: (a.y + b.y) / 2,
              vx: (a.vx + b.vx) / 2,
              vy: Math.min(a.vy, b.vy) - 1.8,
              radius: mergedDef.radius,
              settledFrames: 0,
              bornAt: now,
            });
            break;
          }

          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = minDistance - distance;
          const push = overlap * 0.5;

          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;

          const relVx = b.vx - a.vx;
          const relVy = b.vy - a.vy;
          const velocityAlongNormal = relVx * nx + relVy * ny;

          if (velocityAlongNormal < 0) {
            const impulse = (-(1 + RESTITUTION) * velocityAlongNormal) / 2;
            a.vx -= impulse * nx;
            a.vy -= impulse * ny;
            b.vx += impulse * nx;
            b.vy += impulse * ny;
          }
        }
      }

      if (toRemove.size > 0 || toAdd.length > 0) {
        fruitsRef.current = bodies.filter((fruit) => !toRemove.has(fruit.id)).concat(toAdd);
      }

      if (scoreDelta > 0) {
        scoreRef.current += scoreDelta;
        setScore(scoreRef.current);
        setHighestLevel(maxLevel);
      }

      const dangerous = fruitsRef.current.some((fruit) => {
        if (now - fruit.bornAt < 850) return false;
        return fruit.settledFrames > 14 && fruit.y - fruit.radius <= DANGER_LINE_Y;
      });

      if (dangerous) {
        if (dangerSinceRef.current === null) {
          dangerSinceRef.current = now;
        } else if (now - dangerSinceRef.current >= DANGER_DURATION_MS) {
          endGame(maxLevel >= FRUITS.length - 1);
        }
      } else {
        dangerSinceRef.current = null;
      }
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
      sky.addColorStop(0, '#fff7ed');
      sky.addColorStop(0.45, '#ffedd5');
      sky.addColorStop(1, '#fed7aa');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.fillStyle = 'rgba(251, 146, 60, 0.12)';
      ctx.beginPath();
      ctx.arc(56, 76, 82, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(334, 134, 70, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.roundRect(14, 18, WORLD_WIDTH - 28, 68, 24);
      ctx.fill();

      ctx.strokeStyle = 'rgba(239, 68, 68, 0.42)';
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(18, DANGER_LINE_Y);
      ctx.lineTo(WORLD_WIDTH - 18, DANGER_LINE_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      const pulse = dangerSinceRef.current ? 0.45 + 0.25 * Math.sin(now / 120) : 0;
      if (pulse > 0) {
        ctx.fillStyle = `rgba(239,68,68,${pulse})`;
        ctx.fillRect(14, DANGER_LINE_Y - 6, WORLD_WIDTH - 28, 12);
      }

      const nextDef = FRUITS[nextLevelRef.current];
      const queueDef = FRUITS[queueLevelRef.current];
      ctx.fillStyle = '#7c2d12';
      ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Now', 26, 42);
      ctx.fillText('Next', 26, 66);

      ctx.fillStyle = nextDef.color;
      ctx.beginPath();
      ctx.arc(92, 42, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = queueDef.color;
      ctx.beginPath();
      ctx.arc(92, 66, 12, 0, Math.PI * 2);
      ctx.fill();

      if (phaseRef.current !== 'idle') {
        const previewRadius = nextDef.radius;
        const previewX = clamp(currentDropXRef.current, previewRadius + 6, WORLD_WIDTH - previewRadius - 6);
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(previewX, 20);
        ctx.lineTo(previewX, DROP_LINE_Y - 12);
        ctx.stroke();

        ctx.globalAlpha = 0.3;
        drawFruit(ctx, {
          id: -1,
          level: nextLevelRef.current,
          x: previewX,
          y: DROP_LINE_Y,
          vx: 0,
          vy: 0,
          radius: previewRadius,
          settledFrames: 0,
          bornAt: now,
        });
        ctx.globalAlpha = 1;
      }

      for (const fruit of fruitsRef.current) {
        drawFruit(ctx, fruit);
      }

      ctx.fillStyle = '#7c2d12';
      ctx.font = '700 16px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(scoreRef.current.toLocaleString(), WORLD_WIDTH - 24, 42);
      ctx.font = '500 12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(124, 45, 18, 0.75)';
      ctx.fillText(FRUITS[highestLevel]?.label ?? FRUITS[0].label, WORLD_WIDTH - 24, 66);
    };

    const frame = (timestamp: number) => {
      const prev = lastFrameRef.current || timestamp;
      const delta = Math.min(40, timestamp - prev);
      lastFrameRef.current = timestamp;

      if (phaseRef.current === 'playing') {
        const substeps = Math.max(1, Math.ceil(delta / MAX_SUBSTEP));
        for (let step = 0; step < substeps; step += 1) {
          stepPhysics(delta / substeps, timestamp);
        }
      }

      draw(timestamp);
      animationRef.current = window.requestAnimationFrame(frame);
    };

    animationRef.current = window.requestAnimationFrame(frame);

    return () => {
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
      }
    };
  }, [endGame, highestLevel]);

  useEffect(() => {
    const moveCursor = (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * WORLD_WIDTH;
      currentDropXRef.current = clamp(x, 20, WORLD_WIDTH - 20);
    };

    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tagName = element.tagName;
      return (
        element.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT'
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (phaseRef.current === 'idle' && event.code === 'Space') {
        event.preventDefault();
        resetGame();
        return;
      }

      if (phaseRef.current !== 'playing') return;

      if (event.code === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault();
        currentDropXRef.current = clamp(currentDropXRef.current - 18, 20, WORLD_WIDTH - 20);
      }

      if (event.code === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault();
        currentDropXRef.current = clamp(currentDropXRef.current + 18, 20, WORLD_WIDTH - 20);
      }

      if (event.code === 'Space' || event.code === 'ArrowDown') {
        event.preventDefault();
        spawnFruit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const canvas = canvasRef.current;
    if (!canvas) {
      return () => window.removeEventListener('keydown', handleKeyDown);
    }

    const onPointerMove = (event: PointerEvent) => moveCursor(event.clientX);
    canvas.addEventListener('pointermove', onPointerMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('pointermove', onPointerMove);
    };
  }, [resetGame, spawnFruit]);

  return (
    <PageShell size="full">
      <div className={cn(
        'grid items-start gap-4 px-4 pb-6',
        isFullscreen ? 'grid-cols-1 justify-items-center' : 'grid-cols-[1fr_auto_1fr]'
      )}>
        <div className={cn('flex flex-col gap-4', isFullscreen && 'hidden')}>
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-medium">Run</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 px-4 pb-4">
              <div className="rounded-2xl border border-border/60 bg-card/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Score</p>
                <p className="text-2xl font-semibold tabular-nums">{score.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Record</p>
                <p className="text-2xl font-semibold tabular-nums">{highScore.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Meilleur fruit</p>
                <p className="text-base font-semibold">{highestFruitLabel}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Winrate</p>
                <p className="text-2xl font-semibold tabular-nums">{winRate}%</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Maintenant</p>
                <p className="text-base font-semibold">{FRUITS[nextLevel].label}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Apres</p>
                <p className="text-base font-semibold">{FRUITS[queuedLevel].label}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-medium">Contrôles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <MousePointer2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                <p>Déplace la souris pour viser, clique pour lâcher. `A` / `D` et les flèches gauche / droite marchent aussi.</p>
              </div>
              <div className="flex items-start gap-2">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                <p>Sur mobile, glisse dans le bocal puis tape pour drop. Deux fruits identiques fusionnent automatiquement.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-4 py-4 text-sm text-muted-foreground">
              Garde la pile sous la ligne rouge. Plus tu fais des merges tardifs, plus la montée devient difficile a rattraper.
            </CardContent>
          </Card>
        </div>

        <div
          ref={gameContainerRef}
          className={cn('flex flex-col gap-3', isFullscreen && 'min-h-screen w-screen items-center bg-background px-4 py-4')}
        >
          <GameFullscreenToolbar
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            className="w-full max-w-[400px]"
          />

          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={WORLD_WIDTH} baseHeight={WORLD_HEIGHT}>
            <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-border/50 bg-card shadow-[0_24px_80px_rgba(251,146,60,0.18)]">
              <canvas
                ref={canvasRef}
                width={WORLD_WIDTH}
                height={WORLD_HEIGHT}
                className="h-full w-full touch-none"
                onPointerDown={(event) => {
                  currentDropXRef.current = clamp(
                    ((event.nativeEvent.offsetX || 0) / event.currentTarget.clientWidth) * WORLD_WIDTH,
                    20,
                    WORLD_WIDTH - 20,
                  );
                  if (phaseRef.current === 'idle') {
                    resetGame();
                    return;
                  }
                  if (phaseRef.current === 'playing') {
                    spawnFruit();
                    return;
                  }
                  resetGame();
                }}
                onPointerMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH;
                  currentDropXRef.current = clamp(x, 20, WORLD_WIDTH - 20);
                }}
              />

              {phase === 'idle' && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/35 backdrop-blur-[2px]">
                  <div className="rounded-3xl border border-white/40 bg-white/75 px-8 py-6 text-center shadow-xl">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-orange-700">QS Watermelon</p>
                    <h2 className="mt-2 text-3xl font-semibold text-zinc-900">Drop and merge</h2>
                    <p className="mt-2 max-w-[240px] text-sm text-zinc-600">Le gameplay Suika intégré au shell du site, avec score, fullscreen et leaderboard.</p>
                    <Button className="mt-5" onClick={resetGame}>Jouer</Button>
                  </div>
                </div>
              )}

              {phase === 'over' && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[3px]">
                  <div className="rounded-3xl border border-border bg-card px-8 py-6 text-center shadow-2xl">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Fin de partie</p>
                    <p className="mt-3 text-4xl font-semibold tabular-nums">{score.toLocaleString()}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Meilleur fruit: {highestFruitLabel}</p>
                    {isNewHighScore && <p className="mt-2 text-sm font-medium">Nouveau record</p>}
                    {rewards && (rewards.money > 0 || rewards.aura > 0) && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {rewards.money > 0 && `+$${rewards.money}`}
                        {rewards.money > 0 && rewards.aura > 0 && ' · '}
                        {rewards.aura > 0 && `+${rewards.aura} aura`}
                      </p>
                    )}
                    <Button className="mt-5 gap-2" onClick={resetGame}>
                      <RotateCcw className="h-4 w-4" />
                      Rejouer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </GameFullscreenStage>
        </div>

        <GameLeaderboard
          entries={leaderboard}
          currentUserId={user?.id}
          isAdmin={user?.isAdmin}
          onDeleteScore={(userId) => handleDeleteScore(userId)}
          maxHeight={420}
          hidden={isFullscreen}
        />
      </div>
    </PageShell>
  );
}
