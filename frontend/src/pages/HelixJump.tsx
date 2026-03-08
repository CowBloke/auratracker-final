import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoveHorizontal, RotateCcw, ShieldAlert, Trophy } from 'lucide-react';

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 640;
const TOWER_X = CANVAS_WIDTH / 2;
const BALL_SCREEN_Y = 150;
const BALL_RADIUS = 15;
const SHAFT_WIDTH = 44;
const RING_RADIUS = 118;
const RING_THICKNESS = 22;
const RING_SCALE_Y = 0.38;
const RING_DEPTH = 11;
const LEVEL_SPACING = 146;
const LEVEL_COUNT = 18;
const GAP_SIZE = Math.PI * 0.74;
const DANGER_SIZE = Math.PI * 0.3;
const BALL_TRACK_ANGLE = -Math.PI / 2;
const GRAVITY = 0.42;
const BOUNCE_FORCE = -9.5;
const MAX_FALL_SPEED = 19;
const ROTATION_SPEED_KEYBOARD = 0.05;
const ROTATION_SPEED_DRAG = 0.0105;
const SMASH_THRESHOLD = 3;

type SurfaceType = 'gap' | 'safe' | 'danger';

interface Level {
  id: number;
  y: number;
  rotation: number;
  gapStart: number;
  dangerStart: number;
}

interface ArcRange {
  start: number;
  end: number;
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
  let value = angle % (Math.PI * 2);
  if (value < 0) value += Math.PI * 2;
  return value;
}

function isAngleInArc(angle: number, start: number, size: number) {
  const normalizedAngle = normalizeAngle(angle);
  const normalizedStart = normalizeAngle(start);
  const normalizedEnd = normalizeAngle(start + size);

  if (normalizedStart <= normalizedEnd) {
    return normalizedAngle >= normalizedStart && normalizedAngle <= normalizedEnd;
  }

  return normalizedAngle >= normalizedStart || normalizedAngle <= normalizedEnd;
}

function arcToRanges(start: number, size: number): ArcRange[] {
  const normalizedStart = normalizeAngle(start);
  const normalizedEnd = normalizeAngle(start + size);

  if (size >= Math.PI * 2) {
    return [{ start: 0, end: Math.PI * 2 }];
  }

  if (normalizedStart <= normalizedEnd) {
    return [{ start: normalizedStart, end: normalizedEnd }];
  }

  return [
    { start: normalizedStart, end: Math.PI * 2 },
    { start: 0, end: normalizedEnd },
  ];
}

function randomRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function createLevel(id: number, y: number): Level {
  const gapStart = randomRange(0, Math.PI * 2);
  const minDistance = GAP_SIZE + 0.55;
  const maxDistance = Math.PI * 2 - DANGER_SIZE - 0.55;
  const dangerStart = normalizeAngle(gapStart + randomRange(minDistance, maxDistance));

  return {
    id,
    y,
    rotation: randomRange(-Math.PI, Math.PI),
    gapStart,
    dangerStart,
  };
}

function getSurfaceAtAngle(localAngle: number, level: Level): SurfaceType {
  if (isAngleInArc(localAngle, level.gapStart, GAP_SIZE)) {
    return 'gap';
  }

  if (isAngleInArc(localAngle, level.dangerStart, DANGER_SIZE)) {
    return 'danger';
  }

  return 'safe';
}

function getSafeRanges(levelRotation: number, level: Level): ArcRange[] {
  const safeStart = normalizeAngle(levelRotation + level.gapStart + GAP_SIZE);
  const safeSize = Math.PI * 2 - GAP_SIZE;
  const dangerRanges = arcToRanges(levelRotation + level.dangerStart, DANGER_SIZE);
  const fullSafeRanges = arcToRanges(safeStart, safeSize);
  const result: ArcRange[] = [];

  for (const safeRange of fullSafeRanges) {
    let pending: ArcRange[] = [safeRange];

    for (const danger of dangerRanges) {
      const nextPending: ArcRange[] = [];

      for (const current of pending) {
        const overlapStart = Math.max(current.start, danger.start);
        const overlapEnd = Math.min(current.end, danger.end);

        if (overlapStart >= overlapEnd) {
          nextPending.push(current);
          continue;
        }

        if (current.start < overlapStart) {
          nextPending.push({ start: current.start, end: overlapStart });
        }

        if (overlapEnd < current.end) {
          nextPending.push({ start: overlapEnd, end: current.end });
        }
      }

      pending = nextPending;
    }

    result.push(...pending.filter((range) => range.end - range.start > 0.001));
  }

  return result;
}

export default function HelixJump() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const submittedRef = useRef(false);

  const levelsRef = useRef<Level[]>([]);
  const ballYRef = useRef(0);
  const velocityRef = useRef(0);
  const towerRotationRef = useRef(0);
  const keyboardRotationRef = useRef(0);
  const dragRef = useRef({ active: false, lastX: 0 });
  const runningRef = useRef(false);
  const cameraYRef = useRef(0);
  const scoreRef = useRef(0);
  const highestPassedRef = useRef(-1);
  const comboRef = useRef(0);

  const { user, refreshUser } = useAuth();
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const palette = useMemo(
    () => ({
      bgTop: '#09111d',
      bgMid: '#172554',
      bgBottom: '#0f766e',
      shaftDark: '#64748b',
      shaftLight: '#e2e8f0',
      safeTop: '#f8fafc',
      safeSide: '#94a3b8',
      dangerTop: '#fb7185',
      dangerSide: '#be123c',
      safeShadow: 'rgba(15,23,42,0.24)',
      ball: '#facc15',
      ballHighlight: '#fef3c7',
      ballShadow: 'rgba(250,204,21,0.42)',
      smash: '#22c55e',
      smashSide: '#15803d',
    }),
    []
  );

  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      const response = await gamesApi.getStats('helix_jump', user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch helix jump stats:', error);
    }
  }, [user]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard('helix_jump', 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch helix jump leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const drawArc = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      screenY: number,
      range: ArcRange,
      color: string,
      options?: { yOffset?: number; lineWidth?: number; shadow?: boolean }
    ) => {
      ctx.save();
      ctx.translate(TOWER_X, screenY + (options?.yOffset ?? 0));
      ctx.scale(1, RING_SCALE_Y);
      ctx.beginPath();
      ctx.arc(0, 0, RING_RADIUS, range.start, range.end);
      ctx.lineWidth = options?.lineWidth ?? RING_THICKNESS;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      if (options?.shadow) {
        ctx.shadowColor = palette.safeShadow;
        ctx.shadowBlur = 10;
      }
      ctx.stroke();
      ctx.restore();
    },
    [palette.safeShadow]
  );

  const drawLevel = useCallback(
    (ctx: CanvasRenderingContext2D, level: Level, screenY: number) => {
      const worldRotation = towerRotationRef.current + level.rotation;
      const safeRanges = getSafeRanges(worldRotation, level);
      const dangerRanges = arcToRanges(worldRotation + level.dangerStart, DANGER_SIZE);
      const smashActive = comboRef.current >= SMASH_THRESHOLD;

      for (const range of safeRanges) {
        drawArc(ctx, screenY, range, palette.safeSide, {
          yOffset: RING_DEPTH,
          lineWidth: RING_THICKNESS + 1,
        });
        drawArc(ctx, screenY, range, palette.safeTop, {
          shadow: true,
        });
      }

      for (const range of dangerRanges) {
        drawArc(ctx, screenY, range, smashActive ? palette.smashSide : palette.dangerSide, {
          yOffset: RING_DEPTH,
          lineWidth: RING_THICKNESS + 1,
        });
        drawArc(ctx, screenY, range, smashActive ? palette.smash : palette.dangerTop);
      }
    },
    [drawArc, palette.dangerSide, palette.dangerTop, palette.safeSide, palette.safeTop, palette.smash, palette.smashSide]
  );

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, palette.bgTop);
    gradient.addColorStop(0.46, palette.bgMid);
    gradient.addColorStop(1, palette.bgBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 16; i += 1) {
      ctx.beginPath();
      ctx.arc(28 + (i * 53) % CANVAS_WIDTH, 44 + ((i * 71) % 560), 1.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }

    const shaftGradient = ctx.createLinearGradient(TOWER_X - SHAFT_WIDTH / 2, 0, TOWER_X + SHAFT_WIDTH / 2, 0);
    shaftGradient.addColorStop(0, palette.shaftDark);
    shaftGradient.addColorStop(0.5, palette.shaftLight);
    shaftGradient.addColorStop(1, palette.shaftDark);
    ctx.fillStyle = shaftGradient;
    ctx.fillRect(TOWER_X - SHAFT_WIDTH / 2, 0, SHAFT_WIDTH, CANVAS_HEIGHT);

    for (const level of levelsRef.current) {
      const screenY = level.y - cameraYRef.current + BALL_SCREEN_Y;
      if (screenY < -120 || screenY > CANVAS_HEIGHT + 120) continue;
      drawLevel(ctx, level, screenY);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(TOWER_X, BALL_SCREEN_Y + BALL_RADIUS + 18, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = comboRef.current >= SMASH_THRESHOLD ? palette.smash : palette.ballShadow;
    ctx.shadowBlur = comboRef.current >= SMASH_THRESHOLD ? 26 : 18;
    ctx.fillStyle = comboRef.current >= SMASH_THRESHOLD ? palette.smash : palette.ball;
    ctx.beginPath();
    ctx.arc(TOWER_X, BALL_SCREEN_Y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = palette.ballHighlight;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(TOWER_X - 5, BALL_SCREEN_Y - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }, [drawLevel, palette]);

  const recycleLevels = useCallback(() => {
    if (levelsRef.current.length === 0) return;

    const threshold = cameraYRef.current - BALL_SCREEN_Y - 140;
    let nextId = Math.max(...levelsRef.current.map((level) => level.id)) + 1;
    let nextY = levelsRef.current[levelsRef.current.length - 1].y;

    for (let index = 0; index < levelsRef.current.length; index += 1) {
      if (levelsRef.current[index].y < threshold) {
        nextY += LEVEL_SPACING;
        levelsRef.current[index] = createLevel(nextId, nextY);
        nextId += 1;
      }
    }

    levelsRef.current.sort((a, b) => a.y - b.y);
  }, []);

  const submitScore = useCallback(
    async (finalScore: number) => {
      if (!user || submittedRef.current) return;
      submittedRef.current = true;

      try {
        const response = await gamesApi.complete('helix_jump', {
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
        console.error('Failed to submit helix jump score:', error);
      }
    },
    [fetchLeaderboard, refreshUser, user]
  );

  const endGame = useCallback(() => {
    runningRef.current = false;
    setGameOver(true);
    void submitScore(scoreRef.current);
  }, [submitScore]);

  const startGame = useCallback(() => {
    submittedRef.current = false;
    levelsRef.current = Array.from({ length: LEVEL_COUNT }, (_, index) => createLevel(index, index * LEVEL_SPACING));
    ballYRef.current = 0;
    velocityRef.current = 0;
    towerRotationRef.current = 0;
    keyboardRotationRef.current = 0;
    dragRef.current = { active: false, lastX: 0 };
    runningRef.current = true;
    cameraYRef.current = 0;
    scoreRef.current = 0;
    highestPassedRef.current = -1;
    comboRef.current = 0;
    lastTimeRef.current = 0;

    setStarted(true);
    setGameOver(false);
    setScore(0);
    setCombo(0);
    setRewards(null);
    setIsNewHighScore(false);
  }, []);

  const setLiveScore = useCallback((value: number) => {
    scoreRef.current = value;
    setScore(value);
  }, []);

  const gameLoop = useCallback(
    (timestamp: number) => {
      if (!runningRef.current) {
        drawScene();
        return;
      }

      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaMs = Math.min(timestamp - lastTimeRef.current, 34);
      const timeScale = deltaMs / (1000 / 60);
      lastTimeRef.current = timestamp;

      towerRotationRef.current += keyboardRotationRef.current * ROTATION_SPEED_KEYBOARD * timeScale;

      const previousBallY = ballYRef.current;
      velocityRef.current = Math.min(velocityRef.current + GRAVITY * timeScale, MAX_FALL_SPEED);
      ballYRef.current += velocityRef.current * timeScale;

      if (velocityRef.current > 0) {
        for (const level of levelsRef.current) {
          const collisionY = level.y - BALL_RADIUS;
          if (previousBallY > collisionY || ballYRef.current < collisionY) continue;

          const localAngle = normalizeAngle(BALL_TRACK_ANGLE - towerRotationRef.current - level.rotation);
          const surface = getSurfaceAtAngle(localAngle, level);
          const smashActive = comboRef.current >= SMASH_THRESHOLD;

          if (surface === 'gap') {
            continue;
          }

          if (surface === 'danger' && !smashActive) {
            drawScene();
            endGame();
            return;
          }

          if (surface === 'danger' && smashActive) {
            continue;
          }

          ballYRef.current = collisionY;
          velocityRef.current = BOUNCE_FORCE;
          comboRef.current = 0;
          setCombo(0);
          break;
        }
      }

      const passedLevel = Math.floor(ballYRef.current / LEVEL_SPACING) - 1;
      if (passedLevel > highestPassedRef.current) {
        const gained = passedLevel - highestPassedRef.current;
        highestPassedRef.current = passedLevel;
        comboRef.current += gained;
        setCombo(comboRef.current);
        setLiveScore(scoreRef.current + gained);
      }

      if (ballYRef.current < cameraYRef.current) {
        cameraYRef.current = ballYRef.current;
      } else {
        cameraYRef.current += (ballYRef.current - cameraYRef.current) * 0.12;
      }

      recycleLevels();
      drawScene();
    },
    [drawScene, endGame, recycleLevels, setLiveScore]
  );

  useEffect(() => {
    drawScene();
  }, [drawScene, started]);

  useEffect(() => {
    const tick = (timestamp: number) => {
      gameLoop(timestamp);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [gameLoop]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        keyboardRotationRef.current = -1;
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        keyboardRotationRef.current = 1;
      }
      if (event.key === ' ' && !started) {
        event.preventDefault();
        startGame();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if ((event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') && keyboardRotationRef.current < 0) {
        keyboardRotationRef.current = 0;
      }
      if ((event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') && keyboardRotationRef.current > 0) {
        keyboardRotationRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startGame, started]);

  const handlePointerMove = useCallback((clientX: number) => {
    if (!dragRef.current.active) return;
    const deltaX = clientX - dragRef.current.lastX;
    dragRef.current.lastX = clientX;
    towerRotationRef.current += deltaX * ROTATION_SPEED_DRAG;
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
      <Card className="overflow-hidden border-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_rgba(2,6,23,0.94)_44%,_rgba(2,6,23,1)_100%)] text-slate-50 shadow-[0_30px_80px_rgba(15,23,42,0.42)] lg:flex-[1.2]">
        <CardHeader className="border-b border-white/10 bg-white/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-3xl font-semibold tracking-tight">Helix Jump</CardTitle>
              <p className="mt-2 max-w-xl text-sm text-slate-300">
                Implémentation refaite de zéro: la balle est fixe, la tour tourne, et chaque collision décide clairement entre vide, rebond ou mort.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-2 text-right backdrop-blur-sm">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Score</div>
                <div className="text-2xl font-semibold">{score}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-2 text-right backdrop-blur-sm">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Record</div>
                <div className="text-2xl font-semibold">{highScore}</div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-4 md:p-5">
          <div
            className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            onPointerDown={(event) => {
              dragRef.current = { active: true, lastX: event.clientX };
            }}
            onPointerMove={(event) => handlePointerMove(event.clientX)}
            onPointerUp={() => {
              dragRef.current.active = false;
            }}
            onPointerLeave={() => {
              dragRef.current.active = false;
            }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="h-auto w-full max-w-full touch-none"
            />

            {!started && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/72 px-6 text-center backdrop-blur-md">
                <div className="rounded-full bg-cyan-400/15 p-4 text-cyan-200">
                  <MoveHorizontal className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">Version refaite</h2>
                  <p className="mt-2 max-w-md text-sm text-slate-300">
                    Glisse horizontalement ou utilise les flèches. Le jeu a été réécrit pour repartir sur une base stable.
                  </p>
                </div>
                <Button size="lg" className="rounded-full px-8" onClick={startGame}>
                  Lancer la partie
                </Button>
              </div>
            )}

            {gameOver && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/78 px-6 text-center backdrop-blur-md">
                <div className="rounded-full bg-rose-400/15 p-4 text-rose-200">
                  <ShieldAlert className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">Partie terminée</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Score final: <span className="font-semibold text-white">{score}</span>
                    {isNewHighScore ? ' • Nouveau record' : ''}
                  </p>
                  {rewards && (
                    <p className="mt-2 text-sm text-slate-300">
                      Récompenses: +{rewards.money}$, +{rewards.aura} aura
                    </p>
                  )}
                </div>
                <Button className="rounded-full px-8" onClick={startGame}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Rejouer
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2 text-cyan-100">
                <MoveHorizontal className="h-4 w-4" />
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Contrôles</div>
              </div>
              <div className="text-sm text-slate-200">Glisser horizontalement ou `A` / `D` / flèches.</div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2 text-emerald-100">
                <RotateCcw className="h-4 w-4" />
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Règle</div>
              </div>
              <div className="text-sm text-slate-200">Blanc = rebond, vide = chute, rouge = mort. Rien d’autre.</div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2 text-rose-100">
                <ShieldAlert className="h-4 w-4" />
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Smash</div>
              </div>
              <div className="text-sm text-slate-200">
                {combo >= SMASH_THRESHOLD
                  ? 'Smash actif: tu traverses le rouge.'
                  : `Encore ${SMASH_THRESHOLD - combo} étages de chute continue pour activer le smash.`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex w-full flex-col gap-6 lg:max-w-sm">
        <Card className="border-slate-200/70 bg-white/80 shadow-xl backdrop-blur-sm">
          <CardHeader className="border-b border-slate-200/70">
            <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
              <Trophy className="h-5 w-5 text-amber-500" />
              Classement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun score enregistré pour l’instant.</p>
            ) : (
              leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-3xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-sm"
                >
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">#{index + 1}</div>
                    <div className="font-medium text-slate-900">{entry.user.username}</div>
                  </div>
                  <div className="text-lg font-semibold text-slate-900">{entry.highScore}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
