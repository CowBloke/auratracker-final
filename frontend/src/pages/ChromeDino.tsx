import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { gamesApi } from '../services/api';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { useHideGameLeaderboards, useHideGameLeftInfo } from '@/lib/game-preferences';
import { ArrowDown, ArrowUp, Gamepad2, Play, RotateCcw, Wind } from 'lucide-react';
import { toast } from 'sonner';

const GAME_TYPE = 'chrome_dino';
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const GROUND_Y = 420;
const PLAYER_X = 156;
const PLAYER_WIDTH = 46;
const PLAYER_HEIGHT = 58;
const PLAYER_DUCK_WIDTH = 66;
const PLAYER_DUCK_HEIGHT = 34;
const GRAVITY = 2750;
const JUMP_VELOCITY = -980;
const START_SPEED = 420;
const MAX_SPEED = 980;
const SPEED_GAIN = 28;
const SCORE_SCALE = 0.12;

type ObstacleType = 'cactus-small' | 'cactus-tall' | 'cactus-cluster' | 'bird';

interface Obstacle {
  id: number;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  bobPhase: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
}

interface Cloud {
  id: number;
  x: number;
  y: number;
  width: number;
  speed: number;
}

interface Palette {
  skyTop: string;
  skyBottom: string;
  glow: string;
  sun: string;
  moon: string;
  stars: string;
  mountainFar: string;
  mountainNear: string;
  groundTop: string;
  groundBottom: string;
  groundLine: string;
  player: string;
  playerDetail: string;
  playerEye: string;
  cactus: string;
  cactusDark: string;
  bird: string;
  birdWing: string;
  hud: string;
  hudText: string;
  accent: string;
  particle: string;
}

const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    skyTop: '#f3f3f3',
    skyBottom: '#ececec',
    glow: 'rgba(0, 0, 0, 0)',
    sun: '#d8d8d8',
    moon: '#d8d8d8',
    stars: 'rgba(0, 0, 0, 0)',
    mountainFar: '#e4e4e4',
    mountainNear: '#dddddd',
    groundTop: '#f1f1f1',
    groundBottom: '#ebebeb',
    groundLine: '#5b5b5b',
    player: '#8fb05f',
    playerDetail: '#ea9ca8',
    playerEye: '#5f3b3b',
    cactus: '#5d5d5d',
    cactusDark: '#545454',
    bird: '#5d5d5d',
    birdWing: '#666666',
    hud: 'rgba(241,241,241,0.9)',
    hudText: '#4a4a4a',
    accent: '#666666',
    particle: '#707070',
  },
  dark: {
    skyTop: '#f3f3f3',
    skyBottom: '#ececec',
    glow: 'rgba(0, 0, 0, 0)',
    sun: '#d8d8d8',
    moon: '#d8d8d8',
    stars: 'rgba(0, 0, 0, 0)',
    mountainFar: '#e4e4e4',
    mountainNear: '#dddddd',
    groundTop: '#f1f1f1',
    groundBottom: '#ebebeb',
    groundLine: '#5b5b5b',
    player: '#8fb05f',
    playerDetail: '#ea9ca8',
    playerEye: '#5f3b3b',
    cactus: '#5d5d5d',
    cactusDark: '#545454',
    bird: '#5d5d5d',
    birdWing: '#666666',
    hud: 'rgba(241,241,241,0.9)',
    hudText: '#4a4a4a',
    accent: '#666666',
    particle: '#707070',
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const rectsOverlap = (
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

function createObstacle(id: number, score: number, x: number): Obstacle {
  const roll = Math.random();

  if (score > 250 && roll > 0.72) {
    const flightLevel = Math.random() > 0.55 ? 74 : 112;
    return {
      id,
      type: 'bird',
      x,
      y: GROUND_Y - flightLevel,
      width: 54,
      height: 34,
      bobPhase: Math.random() * Math.PI * 2,
    };
  }

  if (roll > 0.5) {
    return {
      id,
      type: 'cactus-cluster',
      x,
      y: GROUND_Y - 56,
      width: 72,
      height: 56,
      bobPhase: 0,
    };
  }

  if (roll > 0.2) {
    return {
      id,
      type: 'cactus-tall',
      x,
      y: GROUND_Y - 76,
      width: 34,
      height: 76,
      bobPhase: 0,
    };
  }

  return {
    id,
    type: 'cactus-small',
    x,
    y: GROUND_Y - 52,
    width: 30,
    height: 52,
    bobPhase: 0,
  };
}

export default function ChromeDino() {
  const { user, refreshUser } = useAuth();
  const hideGameLeaderboards = useHideGameLeaderboards();
  const hideGameLeftInfo = useHideGameLeftInfo();
  const { theme } = useTheme();
  const palette = useMemo(() => palettes[theme], [theme]);
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const obstacleIdRef = useRef(1);
  const particleIdRef = useRef(1);
  const scoreRef = useRef(0);
  const distanceRef = useRef(0);
  const gameRunningRef = useRef(false);
  const spawnTimerRef = useRef(1.1);
  const speedRef = useRef(START_SPEED);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const canPause = started && !gameOver;

  const playerRef = useRef({
    y: GROUND_Y,
    vy: 0,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    targetHeight: PLAYER_HEIGHT,
    targetWidth: PLAYER_WIDTH,
    onGround: true,
    jumpQueued: false,
    ducking: false,
  });

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch chrome dino stats:', error);
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch chrome dino leaderboard:', error);
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
      if (userId === user?.id) {
        setHighScore(0);
      }
      fetchLeaderboard();
    } catch (error) {
      console.error('Failed to delete chrome dino score:', error);
    }
  }, [fetchLeaderboard, user?.id]);

  const spawnDust = useCallback((x: number, y: number, amount: number) => {
    const nextParticles: Particle[] = [];
    for (let index = 0; index < amount; index += 1) {
      nextParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        vx: -40 - Math.random() * 140,
        vy: -30 - Math.random() * 80,
        size: 3 + Math.random() * 5,
        life: 0,
        maxLife: 0.22 + Math.random() * 0.28,
      });
    }
    particlesRef.current.push(...nextParticles);
  }, []);

  const resetWorld = useCallback(() => {
    obstacleIdRef.current = 1;
    particleIdRef.current = 1;
    scoreRef.current = 0;
    distanceRef.current = 0;
    gameRunningRef.current = false;
    spawnTimerRef.current = 1.05;
    speedRef.current = START_SPEED;
    obstaclesRef.current = [];
    particlesRef.current = [];
    cloudsRef.current = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      x: 130 + index * 190 + Math.random() * 90,
      y: 72 + Math.random() * 140,
      width: 70 + Math.random() * 70,
      speed: 14 + Math.random() * 16,
    }));
    playerRef.current = {
      y: GROUND_Y,
      vy: 0,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      targetHeight: PLAYER_HEIGHT,
      targetWidth: PLAYER_WIDTH,
      onGround: true,
      jumpQueued: false,
      ducking: false,
    };
  }, []);

  const initGame = useCallback(() => {
    resetWorld();
    lastTimeRef.current = 0;
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

    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
        return;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await wait(300 * attempt);
        }
      }
    }

    console.error('Failed to submit chrome dino score after retries:', lastError);
    toast('Run non comptabilise', {
      description: 'La recompense n\'a pas pu etre enregistree. Rejoue une run dans quelques secondes.',
      duration: 4500,
    });
  }, [fetchLeaderboard, refreshUser]);

  const endGame = useCallback(() => {
    if (!gameRunningRef.current) return;
    gameRunningRef.current = false;
    setGameOver(true);
    const player = playerRef.current;
    spawnDust(PLAYER_X, player.y - player.height / 3, 16);
    submitScore();
  }, [spawnDust, submitScore]);

  const queueJump = useCallback(() => {
    if (!started) {
      initGame();
      return;
    }
    if (gameOver || isPaused) return;
    playerRef.current.jumpQueued = true;
  }, [gameOver, initGame, isPaused, started]);

  const setDuck = useCallback((ducking: boolean) => {
    playerRef.current.ducking = ducking;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyP' || event.code === 'Escape') {
        if (!canPause) return;
        event.preventDefault();
        setIsPaused((current) => !current);
        return;
      }

      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault();
        queueJump();
      }

      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        event.preventDefault();
        if (!started) {
          initGame();
          return;
        }
        if (!gameOver) {
          setDuck(true);
        }
      }

      if (event.code === 'KeyR' && (gameOver || !started)) {
        event.preventDefault();
        initGame();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        setDuck(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [canPause, gameOver, initGame, queueJump, setDuck, started]);

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = palette.skyTop;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const horizonOffset = -(distanceRef.current * 0.25 % 220);
    ctx.fillStyle = palette.mountainFar;
    for (let x = horizonOffset; x < CANVAS_WIDTH + 220; x += 220) {
      ctx.fillRect(x + 34, GROUND_Y - 18, 10, 18);
      ctx.fillRect(x + 26, GROUND_Y - 10, 6, 8);
      ctx.fillRect(x + 46, GROUND_Y - 12, 6, 8);
      ctx.fillRect(x + 118, GROUND_Y - 24, 12, 24);
      ctx.fillRect(x + 110, GROUND_Y - 16, 6, 8);
      ctx.fillRect(x + 132, GROUND_Y - 16, 6, 8);
    }
  }, [palette]);

  const drawGround = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = palette.groundTop;
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    ctx.fillStyle = palette.groundLine;
    ctx.fillRect(0, GROUND_Y - 2, CANVAS_WIDTH, 2);

    const crackOffset = -(distanceRef.current * 1.05 % 76);
    for (let x = crackOffset; x < CANVAS_WIDTH + 76; x += 76) {
      ctx.fillRect(x + 8, GROUND_Y - 1, 12, 2);
      ctx.fillRect(x + 26, GROUND_Y, 8, 2);
      ctx.fillRect(x + 44, GROUND_Y + 1, 10, 2);
    }

    const pebbleOffset = -(distanceRef.current * 0.92 % 32);
    ctx.fillStyle = palette.groundLine;
    for (let x = pebbleOffset; x < CANVAS_WIDTH + 32; x += 32) {
      ctx.globalAlpha = 0.26;
      ctx.fillRect(x + 2, GROUND_Y + 44 + (x % 3), 3, 3);
      ctx.fillRect(x + 16, GROUND_Y + 62 + ((x + 1) % 4), 2, 2);
      ctx.fillRect(x + 25, GROUND_Y + 50 + ((x + 2) % 5), 2, 2);
      ctx.globalAlpha = 1;
    }
  }, [palette]);

  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D) => {
    const player = playerRef.current;
    const left = PLAYER_X - player.width / 2;
    const top = player.y - player.height;
    const stride = Math.round(Math.sin(distanceRef.current * 0.14) * 2);
    const unit = 4;

    ctx.save();

    if (player.ducking && player.onGround) {
      const bodyX = Math.round(left + 7);
      const bodyY = Math.round(top + 20);
      const leafSwing = Math.round(Math.sin(distanceRef.current * 0.2) * 2);

      // Guava skin: wide flattened fruit while ducking.
      ctx.fillStyle = palette.player;
      ctx.fillRect(bodyX + unit * 2, bodyY + unit, unit * 9, unit * 6);
      ctx.fillRect(bodyX + unit, bodyY + unit * 2, unit, unit * 4);
      ctx.fillRect(bodyX + unit * 11, bodyY + unit * 2, unit, unit * 4);
      ctx.fillRect(bodyX + unit * 3, bodyY, unit * 7, unit);
      ctx.fillRect(bodyX + unit * 3, bodyY + unit * 7, unit * 7, unit);

      // Guava flesh + seeds.
      ctx.fillStyle = palette.playerDetail;
      ctx.fillRect(bodyX + unit * 4, bodyY + unit * 2, unit * 5, unit * 3);
      ctx.fillRect(bodyX + unit * 5, bodyY + unit * 5, unit * 3, unit);

      ctx.fillStyle = palette.playerEye;
      ctx.fillRect(bodyX + unit * 5, bodyY + unit * 3, 2, 2);
      ctx.fillRect(bodyX + unit * 7, bodyY + unit * 3, 2, 2);
      ctx.fillRect(bodyX + unit * 6, bodyY + unit * 4, 2, 2);

      // Small top crown/leaf.
      ctx.fillStyle = '#6d8f42';
      ctx.fillRect(bodyX + unit * 6 + leafSwing, bodyY - unit, unit * 2, unit);
      ctx.fillRect(bodyX + unit * 7 + leafSwing, bodyY - unit * 2, unit, unit);
    } else {
      const bodyX = Math.round(left + 6);
      const bodyY = Math.round(top + 8);
      const leafSwing = Math.round(Math.sin(distanceRef.current * 0.2) * 2);

      // Guava skin: rounded fruit silhouette.
      ctx.fillStyle = palette.player;
      ctx.fillRect(bodyX + unit * 2, bodyY + unit, unit * 6, unit * 10);
      ctx.fillRect(bodyX + unit, bodyY + unit * 2, unit, unit * 8);
      ctx.fillRect(bodyX + unit * 8, bodyY + unit * 2, unit, unit * 8);
      ctx.fillRect(bodyX + unit * 3, bodyY, unit * 4, unit);
      ctx.fillRect(bodyX + unit * 3, bodyY + unit * 11, unit * 4, unit);

      // Guava flesh center.
      ctx.fillStyle = palette.playerDetail;
      ctx.fillRect(bodyX + unit * 3, bodyY + unit * 3, unit * 4, unit * 4);
      ctx.fillRect(bodyX + unit * 4, bodyY + unit * 7, unit * 2, unit * 2);

      // Seeds.
      ctx.fillStyle = palette.playerEye;
      ctx.fillRect(bodyX + unit * 4, bodyY + unit * 4, 2, 2);
      ctx.fillRect(bodyX + unit * 5, bodyY + unit * 5, 2, 2);
      ctx.fillRect(bodyX + unit * 4, bodyY + unit * 6, 2, 2);
      ctx.fillRect(bodyX + unit * 6, bodyY + unit * 4, 2, 2);

      // Little stem + leaf and running feet blocks.
      ctx.fillStyle = '#6d8f42';
      ctx.fillRect(bodyX + unit * 4 + leafSwing, bodyY - unit * 2, unit * 2, unit);
      ctx.fillRect(bodyX + unit * 5 + leafSwing, bodyY - unit * 3, unit, unit);

      ctx.fillStyle = palette.player;
      ctx.fillRect(bodyX + unit * 2, bodyY + unit * 12, unit * 2, unit + Math.abs(stride));
      ctx.fillRect(bodyX + unit * 6, bodyY + unit * 12, unit * 2, unit + Math.abs(stride));
    }

    ctx.restore();
  }, [palette]);

  const drawObstacle = useCallback((ctx: CanvasRenderingContext2D, obstacle: Obstacle) => {
    if (obstacle.type === 'bird') {
      const flap = Math.sin(distanceRef.current * 0.08 + obstacle.bobPhase);
      ctx.save();
      ctx.fillStyle = palette.bird;
      ctx.fillRect(obstacle.x + 8, obstacle.y + 12, obstacle.width - 16, 10);
      ctx.fillRect(obstacle.x + obstacle.width - 16, obstacle.y + 9, 8, 8);
      ctx.fillStyle = palette.birdWing;
      ctx.beginPath();
      ctx.moveTo(obstacle.x + 22, obstacle.y + 16);
      ctx.lineTo(obstacle.x + 6, obstacle.y + 12 - flap * 10);
      ctx.lineTo(obstacle.x + 16, obstacle.y + 24);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(obstacle.x + 30, obstacle.y + 16);
      ctx.lineTo(obstacle.x + 46, obstacle.y + 12 + flap * 10);
      ctx.lineTo(obstacle.x + 36, obstacle.y + 24);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.fillStyle = palette.cactus;

    if (obstacle.type === 'cactus-cluster') {
      ctx.fillRect(obstacle.x + 4, obstacle.y + 18, 16, obstacle.height - 18);
      ctx.fillRect(obstacle.x + 26, obstacle.y + 8, 16, obstacle.height - 8);
      ctx.fillRect(obstacle.x + 48, obstacle.y + 22, 14, obstacle.height - 22);
      ctx.fillStyle = palette.cactusDark;
      ctx.fillRect(obstacle.x + 8, obstacle.y + 8, 10, 14);
      ctx.fillRect(obstacle.x + 32, obstacle.y - 4, 8, 20);
      ctx.fillRect(obstacle.x + 52, obstacle.y + 12, 8, 14);
    } else {
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      ctx.fillStyle = palette.cactusDark;
      ctx.fillRect(obstacle.x + 4, obstacle.y + 8, obstacle.width - 8, 6);
      ctx.fillRect(obstacle.x + obstacle.width - 8, obstacle.y + 22, 6, 14);
      if (obstacle.type === 'cactus-tall') {
        ctx.fillRect(obstacle.x - 6, obstacle.y + 28, 8, 18);
      }
    }

    ctx.restore();
  }, [palette]);

  const drawScene = useCallback((ctx: CanvasRenderingContext2D) => {
    drawBackground(ctx);
    drawGround(ctx);

    obstaclesRef.current.forEach((obstacle) => {
      drawObstacle(ctx, obstacle);
    });

    particlesRef.current.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = clamp(1 - particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = palette.particle;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      ctx.restore();
    });

    drawPlayer(ctx);

    ctx.fillStyle = palette.hud;
    ctx.fillRect(24, 22, 288, 78);
    ctx.fillStyle = palette.hudText;
    ctx.font = '700 22px "Courier New", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`SCORE ${scoreRef.current}`, 42, 56);
    ctx.font = '600 13px "Courier New", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`SPEED ${Math.round(speedRef.current)}  BEST ${highScore}`, 42, 80);

    ctx.fillStyle = palette.hud;
    ctx.fillRect(CANVAS_WIDTH - 232, 24, 192, 28);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(CANVAS_WIDTH - 232, 24, clamp((scoreRef.current / 1800) * 192, 12, 192), 28);
    ctx.fillStyle = palette.hudText;
    ctx.font = '600 13px "Courier New", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('INFINITE RUN', CANVAS_WIDTH - 206, 43);
  }, [drawBackground, drawGround, drawObstacle, drawPlayer, highScore, palette]);

  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

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

    cloudsRef.current = cloudsRef.current.map((cloud) => {
      const nextX = cloud.x - cloud.speed * delta;
      return {
        ...cloud,
        x: nextX < -cloud.width ? CANVAS_WIDTH + Math.random() * 140 : nextX,
        y: nextX < -cloud.width ? 72 + Math.random() * 140 : cloud.y,
        width: nextX < -cloud.width ? 70 + Math.random() * 70 : cloud.width,
      };
    });

    if (gameRunningRef.current) {
      const player = playerRef.current;

      speedRef.current = Math.min(MAX_SPEED, START_SPEED + scoreRef.current * SPEED_GAIN * 0.01);
      distanceRef.current += speedRef.current * delta;
      scoreRef.current = Math.floor(distanceRef.current * SCORE_SCALE);
      setScore(scoreRef.current);

      player.targetHeight = player.ducking && player.onGround ? PLAYER_DUCK_HEIGHT : PLAYER_HEIGHT;
      player.targetWidth = player.ducking && player.onGround ? PLAYER_DUCK_WIDTH : PLAYER_WIDTH;
      player.height += (player.targetHeight - player.height) * Math.min(1, 12 * delta);
      player.width += (player.targetWidth - player.width) * Math.min(1, 12 * delta);

      if (player.jumpQueued) {
        if (player.onGround) {
          player.vy = JUMP_VELOCITY;
          player.onGround = false;
          spawnDust(PLAYER_X - 8, GROUND_Y, 8);
        }
        player.jumpQueued = false;
      }

      player.vy += GRAVITY * delta * (player.ducking && !player.onGround ? 1.18 : 1);
      player.y += player.vy * delta;

      if (player.y >= GROUND_Y) {
        if (!player.onGround) {
          spawnDust(PLAYER_X - 6, GROUND_Y + 2, 6);
        }
        player.y = GROUND_Y;
        player.vy = 0;
        player.onGround = true;
      }

      spawnTimerRef.current -= delta;
      if (spawnTimerRef.current <= 0) {
        const spacingBase = clamp(1.1 - speedRef.current / 1800, 0.58, 1.02);
        obstaclesRef.current.push(createObstacle(obstacleIdRef.current++, scoreRef.current, CANVAS_WIDTH + 36));
        spawnTimerRef.current = spacingBase + Math.random() * 0.48;
      }

      obstaclesRef.current = obstaclesRef.current
        .map((obstacle) => ({
          ...obstacle,
          x: obstacle.x - speedRef.current * delta,
        }))
        .filter((obstacle) => obstacle.x + obstacle.width > -100);

      particlesRef.current = particlesRef.current
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx * delta,
          y: particle.y + particle.vy * delta,
          vy: particle.vy + 260 * delta,
          life: particle.life + delta,
        }))
        .filter((particle) => particle.life < particle.maxLife);

      if (player.onGround && Math.random() < 0.18) {
        spawnDust(PLAYER_X - 12, GROUND_Y + 2, 1);
      }

      const playerRect = {
        left: PLAYER_X - player.width / 2 + 8,
        right: PLAYER_X + player.width / 2 - 8,
        top: player.y - player.height + 6,
        bottom: player.y - 4,
      };

      for (const obstacle of obstaclesRef.current) {
        const obstacleRect = obstacle.type === 'bird'
          ? {
              left: obstacle.x + 8,
              right: obstacle.x + obstacle.width - 8,
              top: obstacle.y + 8,
              bottom: obstacle.y + obstacle.height - 2,
            }
          : {
              left: obstacle.x + 4,
              right: obstacle.x + obstacle.width - 4,
              top: obstacle.y + 4,
              bottom: obstacle.y + obstacle.height,
            };

        if (rectsOverlap(playerRect, obstacleRect)) {
          endGame();
          break;
        }
      }
    } else {
      particlesRef.current = particlesRef.current
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx * delta,
          y: particle.y + particle.vy * delta,
          vy: particle.vy + 260 * delta,
          life: particle.life + delta,
        }))
        .filter((particle) => particle.life < particle.maxLife);
    }

    drawScene(ctx);
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [drawScene, endGame, isPaused, spawnDust]);

  useEffect(() => {
    if (!canPause && isPaused) {
      setIsPaused(false);
    }
  }, [canPause, isPaused]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop]);

  useEffect(() => {
    resetWorld();
    return () => cancelAnimationFrame(animationRef.current);
  }, [resetWorld]);

  return (
    <PageShell size="wide">
      <div className={cn(
        'grid gap-6',
        isFullscreen
          ? '2xl:grid-cols-1'
          : hideGameLeftInfo
            ? hideGameLeaderboards
              ? '2xl:grid-cols-1'
              : '2xl:grid-cols-[minmax(0,1fr)_280px]'
            : hideGameLeaderboards
              ? '2xl:grid-cols-[280px_minmax(0,1fr)]'
              : '2xl:grid-cols-[280px_minmax(0,1fr)_280px]'
      )}>
        {!hideGameLeftInfo && (
        <div className={cn('space-y-4', isFullscreen && 'hidden')}>
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                Chrome Dino
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div>
                <p className="text-3xl font-semibold tabular-nums">{score}</p>
                <p className="text-xs text-muted-foreground">Distance actuelle</p>
              </div>
              <Separator />
              <div>
                <p className="text-xl font-medium tabular-nums">{highScore}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Meilleur run</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ArrowUp className="h-4 w-4 text-muted-foreground" />
                Contrôles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <kbd className="rounded border border-border/50 px-2 py-0.5 text-xs">Espace</kbd>
                <kbd className="rounded border border-border/50 px-2 py-0.5 text-xs">↑</kbd>
                <kbd className="rounded border border-border/50 px-2 py-0.5 text-xs">W</kbd>
                <span className="text-xs text-muted-foreground">pour sauter</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <kbd className="rounded border border-border/50 px-2 py-0.5 text-xs">↓</kbd>
                <kbd className="rounded border border-border/50 px-2 py-0.5 text-xs">S</kbd>
                <span className="text-xs text-muted-foreground">pour baisser la tête</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Les boutons tactiles sous le canvas reprennent exactement ces actions sur mobile.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Wind className="h-4 w-4 text-muted-foreground" />
                Run
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Cactus, clusters et ptérodactyles arrivent plus vite à mesure que le run avance, avec une DA désertique intégrée au thème du site.
              </p>
            </CardContent>
          </Card>
        </div>
        )}

        <div
          ref={gameContainerRef}
          className={cn(
            'flex flex-col gap-3',
            isFullscreen && 'min-h-screen w-screen items-center justify-center bg-background px-4 py-4'
          )}
        >
          <GameFullscreenToolbar
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            className="w-full max-w-[960px]"
          >
            <GamePauseButton isPaused={isPaused} onToggle={() => setIsPaused((current) => !current)} disabled={!canPause} />
          </GameFullscreenToolbar>

          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={CANVAS_WIDTH} baseHeight={CANVAS_HEIGHT}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block h-full w-full cursor-pointer rounded-none border border-neutral-500 bg-[#efefef]"
              onMouseDown={() => queueJump()}
              onTouchStart={(event) => {
                event.preventDefault();
                queueJump();
              }}
            />
            <GamePauseOverlay visible={isPaused} onResume={() => setIsPaused(false)} />

            {!started && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#efefef]/92">
                <div className="space-y-4 p-6 text-center">
                  <p className="font-mono text-3xl font-bold tracking-wide text-neutral-700">CHROME DINO RUN</p>
                  <p className="text-sm text-neutral-600">
                    Version Aura Tracker du runner hors ligne en style Chrome classique.
                  </p>
                  <Button onClick={initGame} variant="outline" className="border-neutral-700 text-neutral-700">
                    <Play className="mr-2 h-4 w-4" />
                    Lancer le run
                  </Button>
                </div>
              </div>
            )}

            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#efefef]/92">
                <div className="space-y-4 p-6 text-center">
                  <p className="font-mono text-2xl font-bold tracking-wide text-neutral-700">GAME OVER</p>
                  <p className="font-mono text-4xl tabular-nums text-neutral-700">{score}</p>
                  {isNewHighScore && <p className="text-sm text-neutral-700">Nouveau record.</p>}
                  {rewards && (rewards.aura > 0 || rewards.money > 0) && (
                    <p className="text-sm text-neutral-600">
                      {rewards.money > 0 && `+$${rewards.money}`}
                      {rewards.money > 0 && rewards.aura > 0 && ' · '}
                      {rewards.aura > 0 && `+${rewards.aura} aura`}
                    </p>
                  )}
                  <Button onClick={initGame} variant="outline" className="border-neutral-700 text-neutral-700">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Rejouer
                  </Button>
                </div>
              </div>
            )}
          </GameFullscreenStage>

          <div className="grid w-full max-w-[960px] grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => queueJump()}
              disabled={isPaused}
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Sauter
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              disabled={isPaused}
              onPointerDown={() => setDuck(true)}
              onPointerUp={() => setDuck(false)}
              onPointerLeave={() => setDuck(false)}
              onPointerCancel={() => setDuck(false)}
            >
              <ArrowDown className="mr-2 h-4 w-4" />
              Baisser
            </Button>
          </div>
        </div>

        {!hideGameLeaderboards && (
        <div className={cn('w-full', !isFullscreen && '2xl:max-w-[280px]')}>
          <GameLeaderboard
            entries={leaderboard}
            currentUserId={user?.id}
            personalHighScore={highScore}
            isAdmin={user?.isAdmin}
            onDeleteScore={handleDeleteScore}
            maxHeight={540}
            hidden={isFullscreen}
          />
        </div>
        )}
      </div>
    </PageShell>
  );
}
