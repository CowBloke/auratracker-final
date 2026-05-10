import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { gamesApi } from '../services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameTopBar } from '@/components/game/GameTopBar';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, RotateCcw, SlidersHorizontal, Users } from 'lucide-react';
import { useHideGameLeaderboards, useHideGameLeftInfo } from '@/lib/game-preferences';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const GROUND_HEIGHT = 92;
const TILE = 48;
const PLAYER_X = 180;
const PLAYER_SIZE = 34;
const PLAYER_HALF = PLAYER_SIZE / 2;
const PLAYER_START_Y = CANVAS_HEIGHT - GROUND_HEIGHT - PLAYER_HALF;
const GRAVITY = 5400;
const JUMP_VELOCITY = -1180;
const PAD_BOOST = -1480;
const COYOTE_TIME = 0.11;
const INPUT_BUFFER = 0.12;
const START_SPEED = 430;
const MAX_SPEED = 760;
const SPEED_GAIN = 6.5;
const GAME_TYPE = 'geometry_dash';

type ObstacleType = 'spike' | 'block' | 'platform' | 'pad';

interface Obstacle {
  id: number;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  triggered?: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface Palette {
  bgTop: string;
  bgBottom: string;
  sun: string;
  sunGlow: string;
  mountainFar: string;
  mountainNear: string;
  grid: string;
  track: string;
  lane: string;
  cube: string;
  cubeFace: string;
  cubeDetail: string;
  cubeGlow: string;
  spike: string;
  blockTop: string;
  blockSide: string;
  platformTop: string;
  platformSide: string;
  pad: string;
  padGlow: string;
  text: string;
  hudBg: string;
  progressTrack: string;
  progressFill: string;
  particle: string;
}

const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    bgTop: '#fdf2f8',
    bgBottom: '#dbeafe',
    sun: '#f97316',
    sunGlow: 'rgba(249,115,22,0.22)',
    mountainFar: '#f9a8d4',
    mountainNear: '#60a5fa',
    grid: 'rgba(15,23,42,0.08)',
    track: '#0f172a',
    lane: '#1d4ed8',
    cube: '#facc15',
    cubeFace: '#111827',
    cubeDetail: '#ffffff',
    cubeGlow: 'rgba(250,204,21,0.24)',
    spike: '#ef4444',
    blockTop: '#22c55e',
    blockSide: '#166534',
    platformTop: '#38bdf8',
    platformSide: '#0369a1',
    pad: '#a855f7',
    padGlow: 'rgba(168,85,247,0.28)',
    text: '#0f172a',
    hudBg: 'rgba(255,255,255,0.72)',
    progressTrack: 'rgba(15,23,42,0.12)',
    progressFill: '#2563eb',
    particle: '#fde047',
  },
  dark: {
    bgTop: '#0f172a',
    bgBottom: '#172554',
    sun: '#22d3ee',
    sunGlow: 'rgba(34,211,238,0.24)',
    mountainFar: '#1d4ed8',
    mountainNear: '#0f766e',
    grid: 'rgba(255,255,255,0.07)',
    track: '#020617',
    lane: '#1e40af',
    cube: '#facc15',
    cubeFace: '#0f172a',
    cubeDetail: '#f8fafc',
    cubeGlow: 'rgba(250,204,21,0.28)',
    spike: '#fb7185',
    blockTop: '#34d399',
    blockSide: '#047857',
    platformTop: '#60a5fa',
    platformSide: '#1d4ed8',
    pad: '#c084fc',
    padGlow: 'rgba(192,132,252,0.3)',
    text: '#f8fafc',
    hudBg: 'rgba(15,23,42,0.72)',
    progressTrack: 'rgba(255,255,255,0.12)',
    progressFill: '#22d3ee',
    particle: '#fde047',
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const rectsOverlap = (
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const isSolidSurface = (obstacle: Obstacle) => obstacle.type === 'block' || obstacle.type === 'platform' || obstacle.type === 'pad';

const createPattern = (choice: number, startX: number): Obstacle[] => {
  const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;

  switch (choice % 10) {
    case 0:
      return [{ id: 0, type: 'spike', x: startX, y: groundY - 26, width: TILE, height: 26 }];
    case 1:
      return [
        { id: 0, type: 'spike', x: startX, y: groundY - 26, width: TILE, height: 26 },
        { id: 0, type: 'spike', x: startX + TILE * 1.15, y: groundY - 26, width: TILE, height: 26 },
      ];
    case 2:
      return [
        { id: 0, type: 'block', x: startX, y: groundY - TILE, width: TILE, height: TILE },
        { id: 0, type: 'spike', x: startX + TILE * 1.8, y: groundY - 26, width: TILE, height: 26 },
      ];
    case 3:
      return [
        { id: 0, type: 'block', x: startX, y: groundY - TILE, width: TILE, height: TILE },
        { id: 0, type: 'platform', x: startX + TILE * 2.1, y: groundY - TILE * 2.15, width: TILE * 1.8, height: 16 },
      ];
    case 4:
      return [
        { id: 0, type: 'pad', x: startX, y: groundY - 18, width: TILE * 0.9, height: 18 },
        { id: 0, type: 'spike', x: startX + TILE * 2.8, y: groundY - 26, width: TILE, height: 26 },
        { id: 0, type: 'spike', x: startX + TILE * 4.05, y: groundY - 26, width: TILE, height: 26 },
      ];
    case 5:
      return [
        { id: 0, type: 'platform', x: startX, y: groundY - TILE * 2.05, width: TILE * 1.8, height: 16 },
        { id: 0, type: 'spike', x: startX + TILE * 3.2, y: groundY - 26, width: TILE, height: 26 },
      ];
    case 6:
      return [
        { id: 0, type: 'spike', x: startX, y: groundY - 26, width: TILE, height: 26 },
        { id: 0, type: 'block', x: startX + TILE * 2.2, y: groundY - TILE, width: TILE * 1.2, height: TILE },
        { id: 0, type: 'spike', x: startX + TILE * 4, y: groundY - 26, width: TILE, height: 26 },
      ];
    case 7:
      return [
        { id: 0, type: 'block', x: startX, y: groundY - TILE, width: TILE * 2.1, height: TILE },
        { id: 0, type: 'spike', x: startX + TILE * 3.1, y: groundY - 26, width: TILE, height: 26 },
        { id: 0, type: 'spike', x: startX + TILE * 4.35, y: groundY - 26, width: TILE, height: 26 },
      ];
    case 8:
      return [
        { id: 0, type: 'platform', x: startX, y: groundY - TILE * 1.7, width: TILE * 1.4, height: 16 },
        { id: 0, type: 'platform', x: startX + TILE * 2.6, y: groundY - TILE * 2.35, width: TILE * 1.6, height: 16 },
      ];
    default:
      return [
        { id: 0, type: 'spike', x: startX, y: groundY - 26, width: TILE, height: 26 },
        { id: 0, type: 'spike', x: startX + TILE * 1.2, y: groundY - 26, width: TILE, height: 26 },
        { id: 0, type: 'spike', x: startX + TILE * 2.4, y: groundY - 26, width: TILE, height: 26 },
      ];
  }
};

export default function GeometryDash() {
  const { user, refreshUser } = useAuth();
  const hideGameLeaderboards = useHideGameLeaderboards();
  const hideGameLeftInfo = useHideGameLeftInfo();
  const { theme } = useTheme();
  const palette = useMemo(() => palettes[theme], [theme]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const obstacleIdRef = useRef(1);
  const particleIdRef = useRef(1);
  const nextPatternXRef = useRef(CANVAS_WIDTH + 220);
  const scoreRef = useRef(0);
  const gameRunningRef = useRef(false);
  const distanceRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const cameraOffsetRef = useRef(0);
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();

  const playerRef = useRef({
    x: PLAYER_X,
    y: PLAYER_START_Y,
    vy: 0,
    rotation: 0,
    grounded: true,
    coyote: COYOTE_TIME,
    jumpBuffer: 0,
  });

  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const canPause = started && !gameOver;

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch geometry dash stats:', error);
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch geometry dash leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const handleDeleteScore = useCallback(async (userId: string, _username: string) => {

    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      if (userId === user?.id) {
        setHighScore(0);
      }
      fetchLeaderboard();
    } catch (error) {
      console.error('Failed to delete geometry dash score:', error);
    }
  }, [fetchLeaderboard, user?.id]);

  const spawnBurst = useCallback((x: number, y: number, amount: number) => {
    const next: Particle[] = [];
    for (let index = 0; index < amount; index += 1) {
      next.push({
        id: particleIdRef.current++,
        x,
        y,
        vx: (Math.random() - 0.5) * 260,
        vy: -60 - Math.random() * 240,
        life: 0.2 + Math.random() * 0.35,
        maxLife: 0.2 + Math.random() * 0.35,
        size: 4 + Math.random() * 6,
      });
    }
    particlesRef.current.push(...next);
  }, []);

  const addObstaclePattern = useCallback(() => {
    const spacing = TILE * (4 + Math.random() * 3.2);
    const pattern = createPattern(obstacleIdRef.current, nextPatternXRef.current);
    const withIds = pattern.map((obstacle) => ({
      ...obstacle,
      id: obstacleIdRef.current++,
    }));

    obstaclesRef.current.push(...withIds);
    const maxX = Math.max(...withIds.map((obstacle) => obstacle.x + obstacle.width));
    nextPatternXRef.current = maxX + spacing;
  }, []);

  const resetWorld = useCallback(() => {
    obstacleIdRef.current = 1;
    particleIdRef.current = 1;
    nextPatternXRef.current = CANVAS_WIDTH + 220;
    scoreRef.current = 0;
    distanceRef.current = 0;
    cameraOffsetRef.current = 0;
    particlesRef.current = [];
    obstaclesRef.current = [];
    playerRef.current = {
      x: PLAYER_X,
      y: PLAYER_START_Y,
      vy: 0,
      rotation: 0,
      grounded: true,
      coyote: COYOTE_TIME,
      jumpBuffer: 0,
    };

    for (let index = 0; index < 9; index += 1) {
      addObstaclePattern();
    }
  }, [addObstaclePattern]);

  const initGame = useCallback(() => {
    lastTimeRef.current = 0;
    resetWorld();
    setStarted(true);
    setGameOver(false);
    setIsPaused(false);
    setScore(0);
    setRewards(null);
    setIsNewHighScore(false);
    gameRunningRef.current = true;
  }, [resetWorld]);

  const submitScore = useCallback(async () => {
    const finalScore = scoreRef.current;
    try {
      const response = await gamesApi.complete(GAME_TYPE, {
        score: finalScore,
        won: true,
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
      console.error('Failed to submit geometry dash score:', error);
    }
  }, [fetchLeaderboard, refreshUser]);

  const endGame = useCallback(() => {
    if (!gameRunningRef.current) return;
    gameRunningRef.current = false;
    setGameOver(true);
    spawnBurst(PLAYER_X, playerRef.current.y, 18);
    submitScore();
  }, [spawnBurst, submitScore]);

  const queueJump = useCallback(() => {
    if (!started || gameOver || isPaused) return;
    playerRef.current.jumpBuffer = INPUT_BUFFER;
  }, [gameOver, isPaused, started]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyP' || event.code === 'Escape') {
        if (!canPause) return;
        event.preventDefault();
        setIsPaused((current) => !current);
        return;
      }

      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyZ') {
        event.preventDefault();
        if (!started) {
          initGame();
          return;
        }
        queueJump();
      }

      if (event.code === 'KeyR' && (gameOver || !started)) {
        event.preventDefault();
        initGame();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canPause, gameOver, initGame, queueJump, started]);

  const drawScene = useCallback((ctx: CanvasRenderingContext2D) => {
    const player = playerRef.current;
    const progress = clamp(scoreRef.current / 5000, 0, 1);

    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, palette.bgTop);
    gradient.addColorStop(1, palette.bgBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.fillStyle = palette.sunGlow;
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH * 0.78, 115, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH * 0.78, 115, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    const gridOffset = -(cameraOffsetRef.current * 0.2) % TILE;
    for (let x = gridOffset - TILE; x < CANVAS_WIDTH + TILE; x += TILE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT - GROUND_HEIGHT; y += TILE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();

    const drawMountains = (baseline: number, amplitude: number, width: number, color: string, speedFactor: number) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT);
      const offset = (cameraOffsetRef.current * speedFactor) % width;
      for (let x = -width; x <= CANVAS_WIDTH + width; x += width) {
        const peakX = x + width / 2 - offset;
        ctx.lineTo(peakX - width / 2, baseline);
        ctx.lineTo(peakX, baseline - amplitude);
        ctx.lineTo(peakX + width / 2, baseline);
      }
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    drawMountains(CANVAS_HEIGHT - GROUND_HEIGHT - 20, 110, 220, palette.mountainFar, 0.18);
    drawMountains(CANVAS_HEIGHT - GROUND_HEIGHT + 10, 150, 260, palette.mountainNear, 0.36);

    ctx.fillStyle = palette.track;
    ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
    ctx.fillStyle = palette.lane;
    for (let x = -(cameraOffsetRef.current % 120); x < CANVAS_WIDTH + 120; x += 120) {
      ctx.fillRect(x, CANVAS_HEIGHT - GROUND_HEIGHT + 44, 72, 10);
    }

    obstaclesRef.current.forEach((obstacle) => {
      if (obstacle.type === 'spike') {
        ctx.fillStyle = palette.spike;
        ctx.beginPath();
        ctx.moveTo(obstacle.x, obstacle.y + obstacle.height);
        ctx.lineTo(obstacle.x + obstacle.width / 2, obstacle.y);
        ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
        ctx.closePath();
        ctx.fill();
      } else {
        const topColor = obstacle.type === 'platform' ? palette.platformTop : obstacle.type === 'pad' ? palette.pad : palette.blockTop;
        const sideColor = obstacle.type === 'platform' ? palette.platformSide : obstacle.type === 'pad' ? palette.pad : palette.blockSide;
        ctx.fillStyle = sideColor;
        ctx.fillRect(obstacle.x, obstacle.y + 8, obstacle.width, obstacle.height - 8);
        ctx.fillStyle = topColor;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, Math.min(12, obstacle.height));
        if (obstacle.type === 'pad') {
          ctx.fillStyle = palette.padGlow;
          ctx.fillRect(obstacle.x + 6, obstacle.y + 2, obstacle.width - 12, obstacle.height - 6);
        }
      }
    });

    particlesRef.current.forEach((particle) => {
      const alpha = clamp(1 - particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = palette.particle;
      ctx.globalAlpha = alpha;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      ctx.globalAlpha = 1;
    });

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.rotation);
    ctx.shadowColor = palette.cubeGlow;
    ctx.shadowBlur = 24;
    ctx.fillStyle = palette.cube;
    ctx.fillRect(-PLAYER_HALF, -PLAYER_HALF, PLAYER_SIZE, PLAYER_SIZE);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = palette.cubeFace;
    ctx.lineWidth = 3;
    ctx.strokeRect(-PLAYER_HALF + 2, -PLAYER_HALF + 2, PLAYER_SIZE - 4, PLAYER_SIZE - 4);
    ctx.fillStyle = palette.cubeDetail;
    ctx.fillRect(-8, -8, 6, 6);
    ctx.fillRect(2, -8, 6, 6);
    ctx.fillStyle = palette.cubeFace;
    ctx.fillRect(-9, 5, 18, 4);
    ctx.restore();

    ctx.fillStyle = palette.hudBg;
    ctx.fillRect(24, 20, 240, 72);
    ctx.fillStyle = palette.text;
    ctx.font = '600 18px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`Distance ${scoreRef.current}`, 42, 49);
    ctx.font = '500 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`Vitesse ${Math.round(START_SPEED + progress * (MAX_SPEED - START_SPEED))}`, 42, 72);

    ctx.fillStyle = palette.progressTrack;
    ctx.fillRect(CANVAS_WIDTH - 220, 30, 170, 12);
    ctx.fillStyle = palette.progressFill;
    ctx.fillRect(CANVAS_WIDTH - 220, 30, 170 * progress, 12);
    ctx.fillStyle = palette.text;
    ctx.fillText(`${Math.round(progress * 100)}%`, CANVAS_WIDTH - 220, 62);
  }, [palette]);

  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (canvas && !ctxRef.current) ctxRef.current = canvas.getContext('2d');
    const ctx = ctxRef.current;

    if (!canvas || !ctx) return;

    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp;
    }

    const delta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.033);
    lastTimeRef.current = timestamp;

    if (isPaused) {
      drawScene(ctx);
      animationRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (gameRunningRef.current) {
      const player = playerRef.current;
      const speed = Math.min(MAX_SPEED, START_SPEED + distanceRef.current * SPEED_GAIN);
      const moveAmount = speed * delta;
      const groundTop = CANVAS_HEIGHT - GROUND_HEIGHT;
      const previousBottom = player.y + PLAYER_HALF;

      distanceRef.current += delta;
      cameraOffsetRef.current += moveAmount;
      scoreRef.current = Math.floor(cameraOffsetRef.current / 18);
      setScore(scoreRef.current);

      player.jumpBuffer = Math.max(0, player.jumpBuffer - delta);
      player.coyote = player.grounded ? COYOTE_TIME : Math.max(0, player.coyote - delta);

      if (player.jumpBuffer > 0 && player.coyote > 0) {
        player.vy = JUMP_VELOCITY;
        player.grounded = false;
        player.coyote = 0;
        player.jumpBuffer = 0;
        spawnBurst(player.x - 10, player.y + PLAYER_HALF, 6);
      }

      player.vy += GRAVITY * delta;
      player.y += player.vy * delta;
      player.rotation += (player.grounded ? 0 : 5.8) * delta;

      obstaclesRef.current = obstaclesRef.current
        .map((obstacle) => ({ ...obstacle, x: obstacle.x - moveAmount }))
        .filter((obstacle) => obstacle.x + obstacle.width > -120);
      nextPatternXRef.current -= moveAmount;

      while (nextPatternXRef.current < CANVAS_WIDTH + 260) {
        addObstaclePattern();
      }

      let landed = false;
      const playerRect = {
        left: player.x - PLAYER_HALF + 4,
        right: player.x + PLAYER_HALF - 4,
        top: player.y - PLAYER_HALF + 4,
        bottom: player.y + PLAYER_HALF,
      };

      for (const obstacle of obstaclesRef.current) {
        if (obstacle.type === 'spike') {
          const spikeRect = {
            left: obstacle.x + 6,
            right: obstacle.x + obstacle.width - 6,
            top: obstacle.y + 4,
            bottom: obstacle.y + obstacle.height,
          };
          if (rectsOverlap(playerRect, spikeRect)) {
            endGame();
            break;
          }
          continue;
        }

        const solidRect = {
          left: obstacle.x,
          right: obstacle.x + obstacle.width,
          top: obstacle.y,
          bottom: obstacle.y + obstacle.height,
        };

        if (!rectsOverlap(playerRect, solidRect)) continue;

        const landingThreshold = previousBottom <= obstacle.y + 10 && player.vy >= 0;
        if (landingThreshold && isSolidSurface(obstacle)) {
          player.y = obstacle.y - PLAYER_HALF;
          player.vy = 0;
          player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
          player.grounded = true;
          landed = true;

          if (obstacle.type === 'pad' && !obstacle.triggered) {
            obstacle.triggered = true;
            player.vy = PAD_BOOST;
            player.grounded = false;
            spawnBurst(player.x, obstacle.y, 12);
          }
        } else {
          endGame();
          break;
        }
      }

      if (!landed) {
        if (player.y + PLAYER_HALF >= groundTop) {
          player.y = groundTop - PLAYER_HALF;
          player.vy = 0;
          player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
          player.grounded = true;
        } else {
          player.grounded = false;
        }
      }

      if (player.y - PLAYER_HALF > CANVAS_HEIGHT + 60) {
        endGame();
      }

      particlesRef.current = particlesRef.current
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx * delta,
          y: particle.y + particle.vy * delta,
          vy: particle.vy + 680 * delta,
          life: particle.life + delta,
        }))
        .filter((particle) => particle.life < particle.maxLife);

      if (!gameOver && player.grounded && Math.random() < 0.25) {
        particlesRef.current.push({
          id: particleIdRef.current++,
          x: player.x - PLAYER_HALF + Math.random() * PLAYER_SIZE,
          y: player.y + PLAYER_HALF - 6,
          vx: -80 - Math.random() * 80,
          vy: -30 - Math.random() * 40,
          life: 0,
          maxLife: 0.2 + Math.random() * 0.15,
          size: 3 + Math.random() * 3,
        });
      }
    } else {
      particlesRef.current = particlesRef.current
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx * delta,
          y: particle.y + particle.vy * delta,
          vy: particle.vy + 680 * delta,
          life: particle.life + delta,
        }))
        .filter((particle) => particle.life < particle.maxLife);
    }

    drawScene(ctx);
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [addObstaclePattern, drawScene, endGame, gameOver, isPaused, spawnBurst]);

  useEffect(() => {
    if (!canPause && isPaused) {
      setIsPaused(false);
    }
  }, [canPause, isPaused]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop]);

  useEffect(() => () => cancelAnimationFrame(animationRef.current), []);

  const isPlaying = started && !gameOver;
  const topBarControls = (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <kbd className="px-2 py-0.5 border border-border/50 rounded">Espace</kbd>
        <span>Sauter</span>
      </div>
      <Separator className="my-2" />
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/60 p-2 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vitesse</p>
          <p className="text-sm font-semibold tabular-nums">{Math.round(START_SPEED + (score / 5000) * (MAX_SPEED - START_SPEED))}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-2 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Record</p>
          <p className="text-sm font-semibold tabular-nums">{highScore}</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
        Le cube avance seul. Le timing du saut fait tout. Pads violets, plateformes, blocs et triples pics.
      </p>
    </div>
  );

  return (
    <div
      ref={gameContainerRef}
      className={`relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8 ${isFullscreen ? 'min-h-screen w-screen items-center bg-background px-4 py-4' : ''}`}
    >
      <GameTopBar
        title="Geometry Dash"
        score={score}
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
            <DialogTitle>Parametres Geometry Dash</DialogTitle>
          </DialogHeader>
          {topBarControls}
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-center gap-6">
        <div className="flex w-full max-w-[960px] flex-col">
          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={CANVAS_WIDTH} baseHeight={CANVAS_HEIGHT}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block h-full w-full rounded-lg border border-border/30 bg-[#0f172a]"
              onClick={queueJump}
            />
            
            <GamePauseOverlay visible={isPaused} onResume={() => setIsPaused(false)} />

            {!started && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/90">
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

            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/90">
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
          </GameFullscreenStage>
        </div>

        {showLeaderboard && !isFullscreen && (
          <div className="w-[280px] shrink-0 hidden lg:block">
            <GameLeaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              isAdmin={user?.isAdmin}
              onDeleteScore={handleDeleteScore}
              maxHeight={540}
              hidden={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
