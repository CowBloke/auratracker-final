import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, RotateCcw, Target, Zap } from 'lucide-react';

const CANVAS_SIZE = 420;
const CENTER = CANVAS_SIZE / 2;
const TARGET_RADIUS = 78;
const KNIFE_TOTAL_LENGTH = 92;
const KNIFE_BLADE_LENGTH = 64;
const KNIFE_HEAD = 18;
const KNIFE_WIDTH = 8;
const KNIFE_HANDLE_LENGTH = KNIFE_TOTAL_LENGTH - KNIFE_BLADE_LENGTH;
const IMPACT_ANGLE = Math.PI / 2;
const COLLISION_GAP = 0.24;
const THROW_START_Y = CANVAS_SIZE - 46;
const THROW_SPEED = 12;
const MIN_SPAWN_GAP = 0.62;

type KnifeFlightState = 'ready' | 'flying';

interface KnifeOnTarget {
  offset: number;
}

interface ActiveKnife {
  state: KnifeFlightState;
  y: number;
}

interface LeaderboardEntry {
  id: string;
  highScore: number;
  user: {
    id: string;
    username: string;
  };
}

function normalizeAngle(angle: number) {
  let result = angle % (Math.PI * 2);
  if (result < 0) {
    result += Math.PI * 2;
  }
  return result;
}

function angleDistance(a: number, b: number) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, Math.PI * 2 - diff);
}

function getLevelConfig(level: number) {
  const normalizedLevel = Math.max(1, level);
  const turnBias = normalizedLevel % 2 === 0 ? -1 : 1;
  const baseSpeed = Math.min(0.001 + normalizedLevel * 0.00012, 0.0021);
  const existingKnives = Math.min(1 + Math.floor((normalizedLevel - 1) / 3), 5);
  const knivesToThrow = Math.min(4 + Math.floor((normalizedLevel - 1) / 2), 8);

  return {
    speed: baseSpeed * turnBias,
    existingKnives,
    knivesToThrow,
    directionChanges: normalizedLevel >= 4,
    switchIntervalMs: Math.max(4200 - normalizedLevel * 140, 2200),
  };
}

export default function KnifeHit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const submittedRef = useRef(false);

  const wheelRotationRef = useRef(0);
  const wheelSpeedRef = useRef(0.001);
  const wheelTargetSpeedRef = useRef(0.001);
  const knivesOnTargetRef = useRef<KnifeOnTarget[]>([]);
  const activeKnifeRef = useRef<ActiveKnife>({ state: 'ready', y: THROW_START_Y });
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const knivesLeftRef = useRef(0);
  const gameRunningRef = useRef(false);
  const switchTimerRef = useRef(0);
  const directionCountdownRef = useRef<number | null>(null);

  const { user, refreshUser } = useAuth();
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [knivesLeft, setKnivesLeft] = useState(0);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [directionLabel, setDirectionLabel] = useState<'Horaire' | 'Antihoraire'>('Horaire');
  const [directionChangeInMs, setDirectionChangeInMs] = useState<number | null>(null);

  const palette = useMemo(
    () => ({
      bgA: '#0f172a',
      bgB: '#1a2e4a',
      ring: '#cbd5e1',
      core: '#1e293b',
      knife: '#e2e8f0',
      knifeHandle: '#0f172a',
      accent: '#94a3b8',
      danger: '#fb7185',
      text: '#f8fafc',
      subtext: 'rgba(248,250,252,0.55)',
      track: 'rgba(255,255,255,0.08)',
    }),
    []
  );

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const response = await gamesApi.getStats('knife_hit', user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch knife hit stats:', error);
    }
  }, [user]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard('knife_hit', 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch knife hit leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const setupLevel = useCallback((levelNumber: number, keepScore: boolean) => {
    const config = getLevelConfig(levelNumber);
    wheelRotationRef.current = 0;
    wheelSpeedRef.current = config.speed;
    wheelTargetSpeedRef.current = config.speed;
    switchTimerRef.current = 0;
    knivesLeftRef.current = config.knivesToThrow;
    activeKnifeRef.current = { state: 'ready', y: THROW_START_Y };
    if (!keepScore) {
      scoreRef.current = 0;
    }

    const usedOffsets: number[] = [];
    while (usedOffsets.length < config.existingKnives) {
      const candidate = Math.random() * Math.PI * 2;
      const hasCollision = usedOffsets.some((offset) => angleDistance(offset, candidate) < MIN_SPAWN_GAP);
      if (!hasCollision) {
        usedOffsets.push(candidate);
      }
    }
    knivesOnTargetRef.current = usedOffsets.map((offset) => ({ offset }));
    levelRef.current = levelNumber;

    setLevel(levelNumber);
    setKnivesLeft(config.knivesToThrow);
    setScore(scoreRef.current);
    setDirectionLabel(config.speed >= 0 ? 'Horaire' : 'Antihoraire');
    directionCountdownRef.current = config.directionChanges ? config.switchIntervalMs : null;
    setDirectionChangeInMs(directionCountdownRef.current);
  }, []);

  const startGame = useCallback(() => {
    submittedRef.current = false;
    setStarted(true);
    setGameOver(false);
    setRewards(null);
    setIsNewHighScore(false);
    setupLevel(1, false);
    gameRunningRef.current = true;
    lastTimeRef.current = 0;
  }, [setupLevel]);

  const submitScore = useCallback(async (finalScore: number) => {
    if (!user || submittedRef.current) return;
    submittedRef.current = true;
    try {
      const response = await gamesApi.complete('knife_hit', {
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
      console.error('Failed to submit knife hit score:', error);
    }
  }, [fetchLeaderboard, refreshUser, user]);

  const endGame = useCallback(() => {
    gameRunningRef.current = false;
    setGameOver(true);
    void submitScore(scoreRef.current);
  }, [submitScore]);

  const advanceLevel = useCallback(() => {
    const nextLevel = levelRef.current + 1;
    setupLevel(nextLevel, true);
  }, [setupLevel]);

  const throwKnife = useCallback(() => {
    if (!gameRunningRef.current) return;
    if (activeKnifeRef.current.state !== 'ready') return;
    activeKnifeRef.current = {
      state: 'flying',
      y: THROW_START_Y,
    };
  }, []);

  const drawKnifeFromTip = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.fillStyle = palette.knife;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-KNIFE_WIDTH / 2, KNIFE_HEAD);
    ctx.lineTo(KNIFE_WIDTH / 2, KNIFE_HEAD);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(-KNIFE_WIDTH / 2, KNIFE_HEAD, KNIFE_WIDTH, KNIFE_BLADE_LENGTH - KNIFE_HEAD, 3);
    ctx.fill();

    ctx.fillStyle = palette.knifeHandle;
    ctx.beginPath();
    ctx.roundRect(-KNIFE_WIDTH / 2 - 2, KNIFE_BLADE_LENGTH - 1, KNIFE_WIDTH + 4, KNIFE_HANDLE_LENGTH, 4);
    ctx.fill();

    ctx.fillStyle = palette.accent;
    ctx.fillRect(-1.5, KNIFE_BLADE_LENGTH + 2, 3, 8);
    ctx.restore();
  }, [palette]);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const gradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    gradient.addColorStop(0, palette.bgA);
    gradient.addColorStop(1, palette.bgB);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();
    ctx.translate(CENTER, CENTER - 58);
    ctx.rotate(wheelRotationRef.current);

    ctx.fillStyle = palette.core;
    ctx.beginPath();
    ctx.arc(0, 0, TARGET_RADIUS + 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = palette.ring;
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(0, 0, TARGET_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * TARGET_RADIUS, Math.sin(angle) * TARGET_RADIUS, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const knife of knivesOnTargetRef.current) {
      drawKnifeFromTip(
        ctx,
        Math.cos(knife.offset) * TARGET_RADIUS,
        Math.sin(knife.offset) * TARGET_RADIUS,
        knife.offset - Math.PI / 2
      );
    }
    ctx.restore();

    if (activeKnifeRef.current.state === 'ready' || activeKnifeRef.current.state === 'flying') {
      drawKnifeFromTip(ctx, CENTER, activeKnifeRef.current.y, 0);
    }

    ctx.fillStyle = palette.text;
    ctx.font = '700 28px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${knivesLeftRef.current}`, CENTER, CANVAS_SIZE - 26);

    ctx.font = '700 15px system-ui';
    ctx.fillStyle = palette.text;
    ctx.fillText(directionLabel, CENTER, 38);
  }, [directionLabel, drawKnifeFromTip, palette]);

  const gameLoop = useCallback((timestamp: number) => {
    if (!gameRunningRef.current) {
      drawScene();
      animationRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp;
    }

    const delta = Math.min(timestamp - lastTimeRef.current, 34);
    lastTimeRef.current = timestamp;

    const config = getLevelConfig(levelRef.current);
    wheelSpeedRef.current += (wheelTargetSpeedRef.current - wheelSpeedRef.current) * 0.08;
    wheelRotationRef.current = normalizeAngle(wheelRotationRef.current + wheelSpeedRef.current * delta);
    if (config.directionChanges) {
      switchTimerRef.current += delta;
      const remaining = Math.max(0, config.switchIntervalMs - switchTimerRef.current);
      const roundedRemaining = Math.ceil(remaining / 100) * 100;
      if (directionCountdownRef.current !== roundedRemaining) {
        directionCountdownRef.current = roundedRemaining;
        setDirectionChangeInMs(roundedRemaining);
      }

      if (switchTimerRef.current >= config.switchIntervalMs) {
        switchTimerRef.current = 0;
        wheelTargetSpeedRef.current = -wheelTargetSpeedRef.current;
        setDirectionLabel(wheelTargetSpeedRef.current >= 0 ? 'Horaire' : 'Antihoraire');
        directionCountdownRef.current = config.switchIntervalMs;
        setDirectionChangeInMs(config.switchIntervalMs);
      }
    } else if (directionCountdownRef.current !== null) {
      directionCountdownRef.current = null;
      setDirectionChangeInMs(null);
    }

    if (activeKnifeRef.current.state === 'flying') {
      activeKnifeRef.current.y -= THROW_SPEED;
      const hitY = CENTER - 58 + TARGET_RADIUS;
      if (activeKnifeRef.current.y <= hitY) {
        const impactOffset = normalizeAngle(IMPACT_ANGLE - wheelRotationRef.current);
        const collided = knivesOnTargetRef.current.some((knife) => angleDistance(knife.offset, impactOffset) < COLLISION_GAP);

        if (collided) {
          endGame();
        } else {
          knivesOnTargetRef.current.push({ offset: impactOffset });
          activeKnifeRef.current = { state: 'ready', y: THROW_START_Y };
          knivesLeftRef.current -= 1;
          scoreRef.current += 1;
          setScore(scoreRef.current);
          setKnivesLeft(knivesLeftRef.current);

          if (knivesLeftRef.current <= 0) {
            advanceLevel();
          }
        }
      }
    }

    drawScene();
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [advanceLevel, drawScene, endGame]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      event.preventDefault();
      if (!started || gameOver) {
        startGame();
        return;
      }
      throwKnife();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, started, startGame, throwKnife]);

  return (
    <PageShell size="wide">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start px-4 pb-4">
        {/* LEFT: Options / Score */}
        <div className="flex flex-col gap-4">
          {/* 1. Score + Record */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="text-xl font-semibold">{score}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Record</p>
                  <p className="text-xl font-semibold">{highScore}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Level info */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Niveau</p>
                  <p className="text-xl font-semibold">{level}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Restants</p>
                  <p className="text-xl font-semibold">{knivesLeft}</p>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Rotation</p>
                <p className="text-sm font-semibold">{directionLabel}</p>
                {directionChangeInMs !== null && (
                  <p className="text-xs text-muted-foreground">change dans {(directionChangeInMs / 1000).toFixed(1)}s</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 3. Actions */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Button
                className="w-full justify-start"
                onClick={started && !gameOver ? throwKnife : startGame}
              >
                {started && !gameOver ? <Zap className="mr-2 h-4 w-4" /> : <Target className="mr-2 h-4 w-4" />}
                {started && !gameOver ? 'Lancer' : 'Commencer'}
              </Button>
              {(started || gameOver) && (
                <Button variant="outline" className="w-full justify-start" onClick={startGame}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Rejouer
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CENTER: Canvas */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="rounded-[28px] border border-border/40"
              onClick={() => {
                if (!started || gameOver) {
                  startGame();
                  return;
                }
                throwKnife();
              }}
            />

            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-black/50 backdrop-blur-sm">
                <div className="w-full max-w-xs rounded-2xl border border-border/60 bg-background/95 p-6 text-center shadow-xl">
                  <p className="text-sm text-muted-foreground">Run terminee</p>
                  <p className="mt-1 text-4xl font-bold">{score}</p>
                  <p className="mt-1 text-sm text-muted-foreground">couteaux places avant collision</p>
                  {isNewHighScore && <p className="mt-3 text-sm font-medium text-amber-500">Nouveau record</p>}
                  {rewards && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      +${rewards.money} · +{rewards.aura} aura
                    </p>
                  )}
                  <Button className="mt-4 w-full" onClick={startGame}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Nouvelle run
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Classement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-y-auto space-y-2">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun score enregistre pour l’instant.</p>
              ) : (
                leaderboard.map((entry, index) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
                    <p className="text-sm font-medium">#{index + 1} {entry.user.username}</p>
                    <p className="text-sm text-muted-foreground">{entry.highScore}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
