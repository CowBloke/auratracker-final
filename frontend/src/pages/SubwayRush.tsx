import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Play, RotateCcw, Trophy, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const CANVAS_WIDTH = 440;
const CANVAS_HEIGHT = 720;
const TRACK_TOP_Y = 120;
const TRACK_BOTTOM_Y = 660;
const PLAYER_BASE_Y = 610;
const PLAYER_WIDTH = 42;
const PLAYER_HEIGHT = 84;
const GRAVITY = 1800;
const JUMP_FORCE = 780;
const BASE_SPEED = 7.2;
const MAX_SPEED = 16;
const SLIDE_DURATION = 0.7;

type ObstacleKind = 'barrier' | 'train' | 'overhead' | 'coins';

interface Obstacle {
  id: number;
  lane: number;
  kind: ObstacleKind;
  progress: number;
  taken?: boolean;
}

interface LeaderboardEntry {
  id: string;
  highScore: number;
  user: {
    id: string;
    username: string;
  };
}

const laneOrder = [-1, 0, 1] as const;

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function laneCenterForProgress(lane: number, progress: number) {
  const spread = lerp(28, 126, progress);
  return CANVAS_WIDTH / 2 + lane * spread;
}

function trackY(progress: number) {
  return lerp(TRACK_TOP_Y, TRACK_BOTTOM_Y, Math.pow(progress, 1.12));
}

function obstacleScale(progress: number) {
  return lerp(0.24, 1.18, Math.pow(progress, 1.1));
}

function choosePattern(rng: () => number): Obstacle[] {
  const roll = rng();
  const lanes = [...laneOrder];
  const pickLane = () => lanes.splice(Math.floor(rng() * lanes.length), 1)[0];

  if (roll < 0.18) {
    return [{ id: 0, lane: pickLane(), kind: 'coins', progress: 0 }];
  }

  if (roll < 0.5) {
    const lane = pickLane();
    const typeRoll = rng();
    const kind: ObstacleKind = typeRoll < 0.35 ? 'barrier' : typeRoll < 0.7 ? 'overhead' : 'train';
    return [{ id: 0, lane, kind, progress: 0 }];
  }

  const firstLane = pickLane();
  const secondLane = pickLane();
  const kinds: ObstacleKind[] = ['barrier', 'overhead', 'train'];

  return [
    { id: 0, lane: firstLane, kind: kinds[Math.floor(rng() * kinds.length)], progress: 0 },
    { id: 1, lane: secondLane, kind: rng() < 0.3 ? 'coins' : kinds[Math.floor(rng() * kinds.length)], progress: 0 },
  ];
}

export default function SubwayRush() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const submittedRef = useRef(false);
  const spawnCooldownRef = useRef(0);
  const obstacleIdRef = useRef(1);

  const obstaclesRef = useRef<Obstacle[]>([]);
  const laneRef = useRef(0);
  const runnerXRef = useRef(CANVAS_WIDTH / 2);
  const jumpOffsetRef = useRef(0);
  const jumpVelocityRef = useRef(0);
  const slideTimerRef = useRef(0);
  const speedRef = useRef(BASE_SPEED);
  const distanceRef = useRef(0);
  const coinsRef = useRef(0);
  const scoreRef = useRef(0);
  const gameRunningRef = useRef(false);
  const rngRef = useRef(() => Math.random());

  const { user, refreshUser } = useAuth();
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [speedDisplay, setSpeedDisplay] = useState(BASE_SPEED);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const palette = useMemo(
    () => ({
      skyTop: '#031525',
      skyBottom: '#14532d',
      railGlow: 'rgba(56, 189, 248, 0.35)',
      laneLine: 'rgba(255,255,255,0.18)',
      sleeper: '#4b5563',
      track: '#1f2937',
      trackEdge: '#0f172a',
      train: '#ef4444',
      trainWindow: '#fde68a',
      barrier: '#f59e0b',
      overhead: '#38bdf8',
      coin: '#facc15',
      player: '#f8fafc',
      playerAccent: '#22d3ee',
      text: '#e2e8f0',
      panel: 'rgba(15, 23, 42, 0.78)',
    }),
    []
  );

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const response = await gamesApi.getStats('subway_rush', user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch subway rush stats:', error);
    }
  }, [user]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard('subway_rush', 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch subway rush leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const resetRun = useCallback(() => {
    obstaclesRef.current = [];
    obstacleIdRef.current = 1;
    spawnCooldownRef.current = 0.6;
    laneRef.current = 0;
    runnerXRef.current = CANVAS_WIDTH / 2;
    jumpOffsetRef.current = 0;
    jumpVelocityRef.current = 0;
    slideTimerRef.current = 0;
    speedRef.current = BASE_SPEED;
    distanceRef.current = 0;
    coinsRef.current = 0;
    scoreRef.current = 0;
    gameRunningRef.current = true;
    submittedRef.current = false;
    lastTimeRef.current = 0;
    rngRef.current = () => Math.random();

    setStarted(true);
    setGameOver(false);
    setScore(0);
    setCoins(0);
    setSpeedDisplay(BASE_SPEED);
    setRewards(null);
    setIsNewHighScore(false);
  }, []);

  const handleGameOver = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    gameRunningRef.current = false;
    setGameOver(true);

    try {
      const response = await gamesApi.complete('subway_rush', {
        score: scoreRef.current,
        won: scoreRef.current >= 120,
      });

      setRewards({
        aura: response.data.auraReward,
        money: response.data.moneyReward,
      });
      setIsNewHighScore(response.data.isNewHighScore);

      if (response.data.isNewHighScore) {
        setHighScore(scoreRef.current);
      }

      await refreshUser();
      fetchLeaderboard();
    } catch (error) {
      console.error('Failed to submit subway rush score:', error);
    }
  }, [fetchLeaderboard, refreshUser]);

  const moveLane = useCallback((direction: -1 | 1) => {
    if (!gameRunningRef.current) return;
    laneRef.current = clamp(laneRef.current + direction, -1, 1);
  }, []);

  const jump = useCallback(() => {
    if (!gameRunningRef.current || jumpOffsetRef.current > 6 || slideTimerRef.current > 0) return;
    jumpVelocityRef.current = JUMP_FORCE;
  }, []);

  const slide = useCallback(() => {
    if (!gameRunningRef.current || jumpOffsetRef.current > 8) return;
    slideTimerRef.current = SLIDE_DURATION;
  }, []);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, palette.skyTop);
    gradient.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 12; i++) {
      const width = 18 + (i % 3) * 8;
      const x = 20 + i * 36;
      const height = 45 + (i % 4) * 24;
      ctx.fillRect(x, 90 - height, width, height);
      ctx.fillRect(CANVAS_WIDTH - x - width, 90 - height * 0.8, width, height * 0.8);
    }

    ctx.beginPath();
    ctx.moveTo(84, TRACK_TOP_Y);
    ctx.lineTo(CANVAS_WIDTH - 84, TRACK_TOP_Y);
    ctx.lineTo(CANVAS_WIDTH - 20, TRACK_BOTTOM_Y);
    ctx.lineTo(20, TRACK_BOTTOM_Y);
    ctx.closePath();
    ctx.fillStyle = palette.track;
    ctx.fill();

    ctx.strokeStyle = palette.trackEdge;
    ctx.lineWidth = 4;
    ctx.stroke();

    for (const divider of [-0.5, 0.5]) {
      ctx.beginPath();
      for (let step = 0; step <= 16; step++) {
        const progress = step / 16;
        const x = laneCenterForProgress(divider, progress);
        const y = trackY(progress);
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = palette.laneLine;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.strokeStyle = palette.railGlow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(74, TRACK_TOP_Y + 6);
    ctx.lineTo(14, TRACK_BOTTOM_Y);
    ctx.moveTo(CANVAS_WIDTH - 74, TRACK_TOP_Y + 6);
    ctx.lineTo(CANVAS_WIDTH - 14, TRACK_BOTTOM_Y);
    ctx.stroke();

    for (let i = 0; i < 14; i++) {
      const progress = i / 13;
      const y = trackY(progress);
      const halfWidth = lerp(58, 178, progress);
      ctx.fillStyle = palette.sleeper;
      ctx.fillRect(CANVAS_WIDTH / 2 - halfWidth, y, halfWidth * 2, 5 + progress * 7);
    }

    const orderedObstacles = [...obstaclesRef.current].sort((a, b) => a.progress - b.progress);
    for (const obstacle of orderedObstacles) {
      const progress = clamp(obstacle.progress, 0, 1);
      const y = trackY(progress);
      const x = laneCenterForProgress(obstacle.lane, progress);
      const scale = obstacleScale(progress);

      if (obstacle.kind === 'coins') {
        ctx.save();
        ctx.translate(x, y - 22 * scale);
        ctx.scale(scale, scale);
        ctx.fillStyle = palette.coin;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(-4, -4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      if (obstacle.kind === 'train') {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.fillStyle = palette.train;
        ctx.fillRect(-28, -104, 56, 104);
        ctx.fillStyle = palette.trainWindow;
        ctx.fillRect(-18, -88, 14, 18);
        ctx.fillRect(4, -88, 14, 18);
        ctx.restore();
        continue;
      }

      if (obstacle.kind === 'overhead') {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.fillStyle = palette.overhead;
        ctx.fillRect(-34, -108, 68, 18);
        ctx.fillRect(-28, -90, 10, 44);
        ctx.fillRect(18, -90, 10, 44);
        ctx.restore();
        continue;
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = palette.barrier;
      ctx.fillRect(-30, -56, 60, 44);
      ctx.fillStyle = 'rgba(15,23,42,0.28)';
      ctx.fillRect(-22, -48, 14, 28);
      ctx.fillRect(8, -48, 14, 28);
      ctx.restore();
    }

    const sliding = slideTimerRef.current > 0;
    const playerHeight = sliding ? PLAYER_HEIGHT * 0.62 : PLAYER_HEIGHT;
    const playerY = PLAYER_BASE_Y - jumpOffsetRef.current;
    const playerX = runnerXRef.current;

    ctx.save();
    ctx.translate(playerX, playerY);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.player;
    ctx.fillRect(-PLAYER_WIDTH / 2, -playerHeight, PLAYER_WIDTH, playerHeight);
    ctx.fillStyle = palette.playerAccent;
    ctx.fillRect(-PLAYER_WIDTH / 2 + 6, -playerHeight + 8, PLAYER_WIDTH - 12, 18);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-PLAYER_WIDTH / 2 + 8, -playerHeight + 34, 10, playerHeight - 42);
    ctx.fillRect(PLAYER_WIDTH / 2 - 18, -playerHeight + 34, 10, playerHeight - 42);
    ctx.restore();

    ctx.fillStyle = palette.panel;
    ctx.fillRect(16, 16, 154, 90);
    ctx.fillStyle = palette.text;
    ctx.font = '700 24px Arial';
    ctx.fillText(`Score ${scoreRef.current}`, 28, 48);
    ctx.font = '600 15px Arial';
    ctx.fillText(`Pieces ${coinsRef.current}`, 28, 74);
    ctx.fillText(`Vitesse ${speedRef.current.toFixed(1)}`, 28, 96);
  }, [palette]);

  const gameLoop = useCallback((timestamp: number) => {
    if (!gameRunningRef.current) return;

    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const delta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.032);
    lastTimeRef.current = timestamp;

    speedRef.current = clamp(speedRef.current + delta * 0.35, BASE_SPEED, MAX_SPEED);
    distanceRef.current += speedRef.current * delta * 22;
    scoreRef.current = Math.floor(distanceRef.current + coinsRef.current * 25);

    runnerXRef.current = lerp(runnerXRef.current, laneCenterForProgress(laneRef.current, 1), 0.18);

    if (jumpOffsetRef.current > 0 || jumpVelocityRef.current > 0) {
      jumpVelocityRef.current -= GRAVITY * delta;
      jumpOffsetRef.current += jumpVelocityRef.current * delta;
      if (jumpOffsetRef.current <= 0) {
        jumpOffsetRef.current = 0;
        jumpVelocityRef.current = 0;
      }
    }

    if (slideTimerRef.current > 0) {
      slideTimerRef.current = Math.max(0, slideTimerRef.current - delta);
    }

    spawnCooldownRef.current -= delta;
    if (spawnCooldownRef.current <= 0) {
      const pattern = choosePattern(rngRef.current);
      for (const obstacle of pattern) {
        obstaclesRef.current.push({
          ...obstacle,
          id: obstacleIdRef.current++,
        });
      }
      spawnCooldownRef.current = clamp(1.05 - speedRef.current * 0.03 + Math.random() * 0.28, 0.34, 1.05);
    }

    let collided = false;
    const nextObstacles: Obstacle[] = [];

    for (const obstacle of obstaclesRef.current) {
      const nextProgress = obstacle.progress + delta * (0.32 + speedRef.current * 0.05);
      const nextObstacle = { ...obstacle, progress: nextProgress };

      if (nextObstacle.kind === 'coins' && !nextObstacle.taken && nextProgress > 0.83 && nextProgress < 0.93 && nextObstacle.lane === laneRef.current) {
        nextObstacle.taken = true;
        coinsRef.current += 1;
      }

      if (nextProgress > 0.84 && nextProgress < 0.96 && nextObstacle.kind !== 'coins' && nextObstacle.lane === laneRef.current) {
        const jumping = jumpOffsetRef.current > 48;
        const sliding = slideTimerRef.current > 0.05;

        if (
          (nextObstacle.kind === 'barrier' && !jumping) ||
          (nextObstacle.kind === 'overhead' && !sliding) ||
          (nextObstacle.kind === 'train')
        ) {
          collided = true;
        }
      }

      if (nextProgress <= 1.08 && !nextObstacle.taken) {
        nextObstacles.push(nextObstacle);
      }
    }

    obstaclesRef.current = nextObstacles;
    setScore(scoreRef.current);
    setCoins(coinsRef.current);
    setSpeedDisplay(speedRef.current);
    drawScene();

    if (collided) {
      handleGameOver();
      return;
    }

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [drawScene, handleGameOver]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!started && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        resetRun();
        return;
      }

      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault();
        moveLane(-1);
      } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault();
        moveLane(1);
      } else if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w' || event.key === ' ') {
        event.preventDefault();
        jump();
      } else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        event.preventDefault();
        slide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump, moveLane, resetRun, slide, started]);

  useEffect(() => {
    if (!started || gameOver) return;
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop, gameOver, started]);

  useEffect(() => () => cancelAnimationFrame(animationRef.current), []);

  return (
    <div className="grid items-start gap-4 px-4 pb-6 lg:grid-cols-[280px_minmax(0,1fr)_320px] lg:px-6 lg:pb-8">
      <div className="flex flex-col gap-3">
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Subway Rush</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4">
            <div>
              <p className="text-3xl font-light tabular-nums">{score}</p>
              <p className="text-xs text-muted-foreground">Score actuel</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xl font-medium tabular-nums">{highScore}</p>
                <p className="text-xs text-muted-foreground">Record</p>
              </div>
              <div>
                <p className="text-xl font-medium tabular-nums">{coins}</p>
                <p className="text-xs text-muted-foreground">Pieces</p>
              </div>
            </div>
            <div>
              <p className="text-xl font-medium tabular-nums">{speedDisplay.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Vitesse</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Contrôles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <kbd className="rounded border border-border/50 px-2 py-0.5">←</kbd>
              <kbd className="rounded border border-border/50 px-2 py-0.5">→</kbd>
              <span>changer de voie</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <kbd className="rounded border border-border/50 px-2 py-0.5">↑</kbd>
              <kbd className="rounded border border-border/50 px-2 py-0.5">Espace</kbd>
              <span>sauter</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <kbd className="rounded border border-border/50 px-2 py-0.5">↓</kbd>
              <span>glisser</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Saute les barrières, glisse sous les portiques et évite les trains.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="relative mx-auto w-fit">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block rounded-xl border border-border bg-slate-950 shadow-xl"
          />

          {!started && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/84">
              <div className="space-y-4 p-6 text-center">
                <p className="text-sm text-muted-foreground">Runner endless en 3 voies, style Subway Surfers.</p>
                <Button onClick={resetRun} variant="outline" className="border-foreground">
                  <Play className="mr-2 h-4 w-4" />
                  Commencer
                </Button>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/90">
              <div className="space-y-4 p-6 text-center">
                <p className="text-2xl font-light">Course terminée</p>
                <p className="text-3xl tabular-nums">{score}</p>
                {isNewHighScore && <p className="text-sm text-foreground">Nouveau record</p>}
                {rewards && (
                  <p className="text-sm text-muted-foreground">
                    {rewards.aura > 0 && `+${rewards.aura} aura`}
                    {rewards.aura > 0 && rewards.money > 0 && ' · '}
                    {rewards.money > 0 && `+${rewards.money}$`}
                  </p>
                )}
                <Button onClick={resetRun} variant="outline" className="border-foreground">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Rejouer
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" onClick={() => moveLane(-1)} className="h-11">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={jump} className="h-11">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={slide} className="h-11">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => moveLane(1)} className="h-11">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            Classement
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {leaderboard.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun score</p>
          ) : (
            <div className="max-h-[720px] divide-y divide-border/20 overflow-y-auto">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className={cn('group flex items-center gap-3 px-4 py-2.5', entry.user.id === user?.id && 'bg-muted/30')}
                >
                  <span
                    className={cn(
                      'w-5 shrink-0 text-center text-xs tabular-nums',
                      index === 0
                        ? 'font-bold text-yellow-500'
                        : index === 1
                          ? 'text-muted-foreground'
                          : index === 2
                            ? 'font-bold text-amber-600'
                            : 'text-muted-foreground'
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-sm">
                    {entry.user.username}
                    {entry.user.id === user?.id && <span className="ml-1 text-xs text-muted-foreground">(toi)</span>}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{entry.highScore}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
