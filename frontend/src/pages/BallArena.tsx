import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocketBase } from '../contexts/SocketContext';
import { useChatSocket } from '../contexts/ChatSocketContext';
import { usePartySocket } from '../contexts/PartySocketContext';
import { useDuelSocket } from '../contexts/DuelSocketContext';
import { ArrowLeft, LogOut, Pause, Play, RotateCcw, Search, Swords, Trophy, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';

const ARENA_CX = 300;
const ARENA_CY = 300;
const ARENA_RADIUS = 240;
const BALL_RADIUS = 22;
const MAX_SPEED = 400;
const MAX_DRAG_DIST = 120;
const FRICTION = 0.984;
const SIM_STEP_MS = 16;
const EXIT_THRESHOLD = ARENA_RADIUS - BALL_RADIUS;

const PLAYER_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#eab308', '#ec4899', '#14b8a6', '#a855f7', '#ef4444'] as const;
const PLAYER_GLOWS = ['rgba(59,130,246,0.45)', 'rgba(249,115,22,0.45)', 'rgba(34,197,94,0.45)', 'rgba(234,179,8,0.45)', 'rgba(236,72,153,0.45)', 'rgba(20,184,166,0.45)', 'rgba(168,85,247,0.45)', 'rgba(239,68,68,0.45)'] as const;

type BallArenaMode = 'duo' | 'multiplayer';

interface BallArenaPlayerState {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  plannedVx: number;
  plannedVy: number;
  hasSetDirection: boolean;
  isOut: boolean;
}

interface BallArenaState {
  partyId: string;
  mode: BallArenaMode;
  phase: 'prep' | 'playing' | 'finished';
  prepStartTime: number;
  prepTimeMs: number;
  playStartTime: number | null;
  winnerId: string | null;
  isDraw: boolean;
  players: BallArenaPlayerState[];
  round: number;
}

interface ReplayPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: number;
}

interface GameResult {
  userId: string;
  username: string;
  usernameColor?: string | null;
  isWinner: boolean;
  rewards: { aura: number; money: number };
}

interface GameOverData {
  winnerId: string | null;
  winnerUsername: string | null;
  isDraw: boolean;
  rewards: {
    winner?: { aura: number; money: number };
    loser?: { aura: number; money: number };
    draw?: { aura: number; money: number };
  };
  replayFrames?: number[][];
  players?: ReplayPlayer[];
  results?: GameResult[];
}

interface SimBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isOut: boolean;
}

interface ClientSim {
  balls: SimBall[];
  prevBalls: { x: number; y: number; isOut: boolean }[];
  accumMs: number;
}

interface RenderBall {
  x: number;
  y: number;
  isOut: boolean;
  playerIndex: number;
  hasSetDirection: boolean;
  plannedVx: number;
  plannedVy: number;
}

function getPlayerColor(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

function getPlayerGlow(index: number) {
  return PLAYER_GLOWS[index % PLAYER_GLOWS.length];
}

function getModeLabel(mode: BallArenaMode) {
  return mode === 'multiplayer' ? 'Multijoueur' : 'Duo';
}

function simDist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function clientSimStep(balls: SimBall[]): void {
  const dt = SIM_STEP_MS / 1000;

  for (const ball of balls) {
    if (ball.isOut) continue;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;
  }

  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const b0 = balls[i];
      const b1 = balls[j];
      if (b0.isOut || b1.isOut) continue;
      const d = simDist(b0.x, b0.y, b1.x, b1.y);
      if (d < BALL_RADIUS * 2 && d > 0.001) {
        const nx = (b1.x - b0.x) / d;
        const ny = (b1.y - b0.y) / d;
        const dvx = b0.vx - b1.vx;
        const dvy = b0.vy - b1.vy;
        const p = dvx * nx + dvy * ny;
        if (p > 0) {
          b0.vx -= p * nx;
          b0.vy -= p * ny;
          b1.vx += p * nx;
          b1.vy += p * ny;
          const overlap = BALL_RADIUS * 2 - d;
          b0.x -= nx * overlap * 0.5;
          b0.y -= ny * overlap * 0.5;
          b1.x += nx * overlap * 0.5;
          b1.y += ny * overlap * 0.5;
        }
      }
    }
  }

  for (const ball of balls) {
    if (ball.isOut) continue;
    if (simDist(ball.x, ball.y, ARENA_CX, ARENA_CY) > EXIT_THRESHOLD) ball.isOut = true;
  }
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function drawScene(
  canvas: HTMLCanvasElement,
  balls: RenderBall[],
  dragArrow: { ballIdx: number; ex: number; ey: number } | null,
  phase: 'prep' | 'playing' | 'finished',
  myPlayerIndex: number | null,
) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  ctx.clearRect(0, 0, 600, 600);
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, 600, 600);

  const bg = ctx.createRadialGradient(ARENA_CX, ARENA_CY, 0, ARENA_CX, ARENA_CY, ARENA_RADIUS);
  bg.addColorStop(0, '#111827');
  bg.addColorStop(1, '#0a0f1a');
  ctx.save();
  ctx.beginPath();
  ctx.arc(ARENA_CX, ARENA_CY, ARENA_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let r = 60; r < ARENA_RADIUS; r += 60) {
    ctx.beginPath();
    ctx.arc(ARENA_CX, ARENA_CY, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(ARENA_CX - ARENA_RADIUS, ARENA_CY);
  ctx.lineTo(ARENA_CX + ARENA_RADIUS, ARENA_CY);
  ctx.moveTo(ARENA_CX, ARENA_CY - ARENA_RADIUS);
  ctx.lineTo(ARENA_CX, ARENA_CY + ARENA_RADIUS);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(ARENA_CX, ARENA_CY, ARENA_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(59,130,246,0.15)';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();

  if (phase === 'prep' && dragArrow !== null) {
    const ball = balls[dragArrow.ballIdx];
    if (ball && !ball.isOut) {
      const dx = dragArrow.ex - ball.x;
      const dy = dragArrow.ey - ball.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const clampedLen = Math.min(len, MAX_DRAG_DIST);
      if (clampedLen > 4) {
        const scale = clampedLen / (len || 1);
        const ex = ball.x + dx * scale;
        const ey = ball.y + dy * scale;
        const col = getPlayerColor(ball.playerIndex);
        const angle = Math.atan2(ey - ball.y, ex - ball.x);

        ctx.save();
        ctx.setLineDash([8, 10]);
        ctx.strokeStyle = `${col}44`;
        ctx.lineWidth = 2;
        const dirX = dx / (len || 1);
        const dirY = dy / (len || 1);
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ball.x + dirX * 500, ball.y + dirY * 500);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 11;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.strokeStyle = col;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();

        const headLen = 26;
        const headAngle = 0.45;
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle - headAngle), ey - headLen * Math.sin(angle - headAngle));
        ctx.lineTo(ex - headLen * 0.55 * Math.cos(angle), ey - headLen * 0.55 * Math.sin(angle));
        ctx.lineTo(ex - headLen * Math.cos(angle + headAngle), ey - headLen * Math.sin(angle + headAngle));
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = col;
        ctx.strokeStyle = lighten(col, 0.35);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle - headAngle), ey - headLen * Math.sin(angle - headAngle));
        ctx.lineTo(ex - headLen * 0.55 * Math.cos(angle), ey - headLen * 0.55 * Math.sin(angle));
        ctx.lineTo(ex - headLen * Math.cos(angle + headAngle), ey - headLen * Math.sin(angle + headAngle));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const speedPct = Math.round((clampedLen / MAX_DRAG_DIST) * 100);
        ctx.save();
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeText(`${speedPct}%`, ex, ey - 22);
        ctx.fillStyle = '#fff';
        ctx.fillText(`${speedPct}%`, ex, ey - 22);
        ctx.restore();
      }
    }
  }

  if (phase === 'prep') {
    for (const ball of balls) {
      if (ball.playerIndex !== myPlayerIndex) continue;
      const isDraggingThis = dragArrow !== null && dragArrow.ballIdx === ball.playerIndex;
      if (ball.hasSetDirection && !isDraggingThis && !ball.isOut) {
        const vSpeed = Math.sqrt(ball.plannedVx ** 2 + ball.plannedVy ** 2);
        if (vSpeed > 0.1) {
          const normX = ball.plannedVx / vSpeed;
          const normY = ball.plannedVy / vSpeed;
          const arrowLen = (vSpeed / MAX_SPEED) * MAX_DRAG_DIST;
          const ex = ball.x + normX * arrowLen;
          const ey = ball.y + normY * arrowLen;
          const col = getPlayerColor(ball.playerIndex);
          const angle = Math.atan2(normY, normX);
          const headLen = 18;
          const headAngle = 0.45;

          ctx.save();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ball.x, ball.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = col;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(ball.x, ball.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.fillStyle = col;
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - headLen * Math.cos(angle - headAngle), ey - headLen * Math.sin(angle - headAngle));
          ctx.lineTo(ex - headLen * 0.5 * Math.cos(angle), ey - headLen * 0.5 * Math.sin(angle));
          ctx.lineTo(ex - headLen * Math.cos(angle + headAngle), ey - headLen * Math.sin(angle + headAngle));
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  for (const ball of balls) {
    const col = getPlayerColor(ball.playerIndex);
    const glow = getPlayerGlow(ball.playerIndex);

    ctx.save();
    if (ball.isOut) ctx.globalAlpha = 0.25;
    ctx.shadowColor = glow;
    ctx.shadowBlur = ball.isOut ? 0 : 18;

    const ballGrad = ctx.createRadialGradient(
      ball.x - BALL_RADIUS * 0.3,
      ball.y - BALL_RADIUS * 0.3,
      BALL_RADIUS * 0.1,
      ball.x,
      ball.y,
      BALL_RADIUS,
    );
    ballGrad.addColorStop(0, lighten(col, 0.3));
    ballGrad.addColorStop(1, col);
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = lighten(col, 0.5);
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${BALL_RADIUS * 0.8}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(ball.playerIndex + 1), ball.x, ball.y + 1);
    ctx.restore();
  }

  if (phase === 'prep') {
    for (const ball of balls) {
      if (ball.hasSetDirection && !ball.isOut && ball.playerIndex === myPlayerIndex) {
        ctx.save();
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓', ball.x, ball.y - BALL_RADIUS - 10);
        ctx.restore();
      }
    }
  }
}

function ModeSwitch({ mode, onChange }: { mode: BallArenaMode; onChange: (mode: BallArenaMode) => void }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
      <span className={cn('text-sm transition-colors', mode === 'duo' ? 'text-foreground font-medium' : 'text-muted-foreground')}>Duo</span>
      <Switch
        checked={mode === 'multiplayer'}
        onCheckedChange={(checked) => onChange(checked ? 'multiplayer' : 'duo')}
        aria-label="Basculer entre duo et multijoueur"
      />
      <span className={cn('text-sm transition-colors', mode === 'multiplayer' ? 'text-foreground font-medium' : 'text-muted-foreground')}>Multijoueur</span>
    </div>
  );
}

export default function BallArena() {
  const { user, refreshUser } = useAuth();
  const { socket } = useSocketBase();
  const { onlineUsers, requestOnlineUsers } = useChatSocket();
  const { currentParty, partyMembers } = usePartySocket();
  const { challengeUserToDuel, outgoingDuelChallenge } = useDuelSocket();

  const [selectedMode, setSelectedMode] = useState<BallArenaMode>('duo');
  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [challengeSearch, setChallengeSearch] = useState('');
  const [gameState, setGameState] = useState<BallArenaState | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [prepSecsLeft, setPrepSecsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastStateRef = useRef<{ state: BallArenaState; receivedAt: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const clientSimRef = useRef<ClientSim | null>(null);
  const dragRef = useRef<{ active: boolean; ballIdx: number; ex: number; ey: number } | null>(null);
  const [dragTick, setDragTick] = useState(0);

  const isLeader = partyMembers.find((member) => member.userId === user?.id)?.isLeader;
  const myPlayer = gameState?.players.find((player) => player.userId === user?.id);
  const alivePlayers = useMemo(() => gameState?.players.filter((player) => !player.isOut) ?? [], [gameState?.players]);
  const winnerPlayer = gameState?.players.find((player) => player.userId === gameState.winnerId);
  const currentMode = gameState?.mode ?? selectedMode;
  const requiredPlayerText = selectedMode === 'duo' ? 'exactement 2 joueurs' : 'au moins 2 joueurs';
  const canStartSelectedMode = selectedMode === 'duo' ? partyMembers.length === 2 : partyMembers.length >= 2;

  useEffect(() => {
    if (!currentParty || gameState) return;
    if (currentParty.maxSize > 2 && selectedMode === 'duo' && partyMembers.length > 2) {
      setSelectedMode('multiplayer');
    }
  }, [currentParty, gameState, partyMembers.length, selectedMode]);

  const stopClientSim = () => {
    clientSimRef.current = null;
  };

  const seedClientSim = (balls: Array<{ x: number; y: number; vx: number; vy: number; isOut?: boolean }>) => {
    const simBalls: SimBall[] = balls.map((ball) => ({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, isOut: ball.isOut ?? false }));
    clientSimRef.current = {
      balls: simBalls,
      prevBalls: simBalls.map((ball) => ({ x: ball.x, y: ball.y, isOut: ball.isOut })),
      accumMs: 0,
    };
  };

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('ballarena:register');

    const onSimStart = (data: { partyId: string; balls: Array<{ x: number; y: number; vx: number; vy: number; isOut: boolean }> }) => {
      seedClientSim(data.balls);
    };

    const onState = (state: BallArenaState) => {
      setGameState(state);
      lastStateRef.current = { state, receivedAt: Date.now() };
      setError(null);

      if (state.phase !== 'playing') {
        stopClientSim();
      } else if (!clientSimRef.current) {
        seedClientSim(state.players.map((player) => ({
          x: player.x,
          y: player.y,
          vx: player.vx,
          vy: player.vy,
          isOut: player.isOut,
        })));
      }
    };

    const onGameOver = (data: GameOverData) => {
      stopClientSim();
      setGameOver(data);
      refreshUser();
    };

    const onLeft = () => {
      stopClientSim();
      setGameState(null);
    };

    const onError = (data: { message: string }) => setError(data.message);

    socket.on('ballarena:sim-start', onSimStart);
    socket.on('ballarena:state', onState);
    socket.on('ballarena:game-over', onGameOver);
    socket.on('ballarena:left', onLeft);
    socket.on('ballarena:error', onError);

    return () => {
      socket.off('ballarena:sim-start', onSimStart);
      socket.off('ballarena:state', onState);
      socket.off('ballarena:game-over', onGameOver);
      socket.off('ballarena:left', onLeft);
      socket.off('ballarena:error', onError);
      stopClientSim();
    };
  }, [socket, user, refreshUser]);

  useEffect(() => {
    if (!gameState || gameState.phase !== 'prep') return;
    const iv = setInterval(() => {
      const elapsed = Date.now() - gameState.prepStartTime;
      const left = Math.max(0, Math.ceil((gameState.prepTimeMs - elapsed) / 1000));
      setPrepSecsLeft(left);
    }, 100);
    return () => clearInterval(iv);
  }, [gameState?.phase, gameState?.prepStartTime, gameState?.prepTimeMs]);

  useEffect(() => {
    if (!canvasRef.current || !gameState) return;
    const canvas = canvasRef.current;
    const myPlayerIndex = myPlayer?.playerIndex ?? null;
    let lastRafTime = performance.now();

    const render = (now: number) => {
      const ref = lastStateRef.current;
      if (!ref) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const { state, receivedAt } = ref;
      let renderedBalls: RenderBall[];
      const sim = clientSimRef.current;

      if (state.phase === 'playing' && sim) {
        const elapsed = now - lastRafTime;
        lastRafTime = now;
        sim.accumMs = Math.min(sim.accumMs + elapsed, SIM_STEP_MS * 8);

        while (sim.accumMs >= SIM_STEP_MS) {
          sim.prevBalls = sim.balls.map((ball) => ({ x: ball.x, y: ball.y, isOut: ball.isOut }));
          clientSimStep(sim.balls);
          sim.accumMs -= SIM_STEP_MS;
        }

        const alpha = sim.accumMs / SIM_STEP_MS;
        renderedBalls = sim.balls.map((ball, index) => {
          const prev = sim.prevBalls[index];
          return {
            x: prev.x + (ball.x - prev.x) * alpha,
            y: prev.y + (ball.y - prev.y) * alpha,
            isOut: ball.isOut,
            playerIndex: state.players[index]?.playerIndex ?? index,
            hasSetDirection: true,
            plannedVx: 0,
            plannedVy: 0,
          };
        });
      } else if (state.phase === 'playing') {
        lastRafTime = now;
        const dt = Math.min((Date.now() - receivedAt) / 1000, 0.5);
        renderedBalls = state.players.map((player) => ({
          x: player.isOut ? player.x : player.x + player.vx * dt,
          y: player.isOut ? player.y : player.y + player.vy * dt,
          isOut: player.isOut,
          playerIndex: player.playerIndex,
          hasSetDirection: player.hasSetDirection,
          plannedVx: player.plannedVx,
          plannedVy: player.plannedVy,
        }));
      } else {
        lastRafTime = now;
        renderedBalls = state.players.map((player) => ({
          x: player.x,
          y: player.y,
          isOut: player.isOut,
          playerIndex: player.playerIndex,
          hasSetDirection: player.hasSetDirection,
          plannedVx: player.plannedVx,
          plannedVy: player.plannedVy,
        }));
      }

      const drag = dragRef.current;
      drawScene(
        canvas,
        renderedBalls,
        drag?.active ? { ballIdx: drag.ballIdx, ex: drag.ex, ey: drag.ey } : null,
        state.phase,
        myPlayerIndex,
      );
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, dragTick, myPlayer?.playerIndex]);

  function getGameCoords(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 600 / rect.width;
    const scaleY = 600 / rect.height;
    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
      clientY = e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current || !gameState || gameState.phase !== 'prep' || !myPlayer || myPlayer.isOut) return;
    const { x, y } = getGameCoords(e, canvasRef.current);
    const dx = x - myPlayer.x;
    const dy = y - myPlayer.y;
    if (Math.sqrt(dx * dx + dy * dy) <= BALL_RADIUS * 2.5) {
      dragRef.current = { active: true, ballIdx: myPlayer.playerIndex, ex: x, ey: y };
      setDragTick((tick) => tick + 1);
    }
  }, [gameState, myPlayer]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current || !dragRef.current?.active) return;
    e.preventDefault();
    const { x, y } = getGameCoords(e, canvasRef.current);
    dragRef.current.ex = x;
    dragRef.current.ey = y;
    setDragTick((tick) => tick + 1);
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current?.active || !socket || !currentParty || !gameState || !myPlayer || myPlayer.isOut || gameState.phase !== 'prep') {
      dragRef.current = null;
      return;
    }

    const drag = dragRef.current;
    const ball = gameState.players.find((player) => player.playerIndex === drag.ballIdx);
    if (!ball) {
      dragRef.current = null;
      return;
    }

    const dx = drag.ex - ball.x;
    const dy = drag.ey - ball.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 2) {
      const clampedLen = Math.min(len, MAX_DRAG_DIST);
      const scale = clampedLen / (len || 1);
      const vx = (dx * scale / MAX_DRAG_DIST) * MAX_SPEED;
      const vy = (dy * scale / MAX_DRAG_DIST) * MAX_SPEED;
      socket.emit('ballarena:set-direction', { partyId: currentParty.id, vx, vy });
    }

    dragRef.current = null;
    setDragTick((tick) => tick + 1);
  }, [socket, currentParty, gameState, myPlayer]);

  const handleStart = () => {
    if (!socket || !currentParty) return;
    socket.emit('ballarena:start', { partyId: currentParty.id, mode: selectedMode });
  };

  const handleLeave = () => {
    if (!socket || !currentParty) return;
    socket.emit('ballarena:leave', { partyId: currentParty.id });
    setGameState(null);
  };

  const challengeableUsers = useMemo(() => (
    onlineUsers.filter((onlineUser) => (
      onlineUser.userId !== user?.id &&
      onlineUser.username.toLowerCase().includes(challengeSearch.toLowerCase())
    ))
  ), [onlineUsers, user?.id, challengeSearch]);

  if (!currentParty) {
    return (
      <PageShell>
        <PageHeader
          title="Ball Arena"
          description={selectedMode === 'multiplayer' ? "Arène libre en party, 2 joueurs ou plus." : "Propulse ton adversaire hors de l'arène."}
          actions={(
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />Jeux
              </Link>
            </Button>
          )}
        />

        <ModeSwitch mode={selectedMode} onChange={setSelectedMode} />

        <Card>
          <CardContent className="space-y-4 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {selectedMode === 'duo'
                ? 'Duel 1v1 avec invitation directe ou via une party.'
                : 'Mode libre à 2 joueurs ou plus. Lance-le depuis une party pour embarquer tout le groupe.'}
            </p>
            <div className="mx-auto flex max-w-xs flex-col gap-2">
              {selectedMode === 'duo' ? (
                <Button onClick={() => { setChallengeSearch(''); requestOnlineUsers(); setShowChallengePicker(true); }}>
                  <Swords className="mr-2 h-4 w-4" />Défier un joueur
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/party" className="inline-flex items-center justify-center gap-2">
                    <Users className="h-4 w-4" />Ouvrir une party
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/party">Via une party</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showChallengePicker} onOpenChange={setShowChallengePicker}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-normal">
                <Swords className="h-4 w-4" />Défier en Ball Arena
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un joueur..."
                  value={challengeSearch}
                  onChange={(e) => setChallengeSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {challengeableUsers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {onlineUsers.filter((onlineUser) => onlineUser.userId !== user?.id).length === 0 ? 'Aucun joueur en ligne' : 'Aucun résultat'}
                  </p>
                ) : (
                  challengeableUsers.map((onlineUser) => {
                    const isPending = outgoingDuelChallenge?.targetId === onlineUser.userId && outgoingDuelChallenge.gameType === 'ballarena';
                    return (
                      <div key={onlineUser.userId} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 transition-colors hover:border-border/80">
                        <UsernameDisplay username={onlineUser.username} usernameColor={onlineUser.usernameColor} className="text-sm" />
                        <Button
                          size="sm"
                          variant={isPending ? 'outline' : 'default'}
                          disabled={isPending}
                          onClick={() => {
                            challengeUserToDuel(onlineUser.userId, onlineUser.username, 'ballarena');
                            setShowChallengePicker(false);
                          }}
                        >
                          {isPending ? 'Envoyé...' : 'Défier'}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageShell>
    );
  }

  if (!gameState) {
    return (
      <PageShell>
        <PageHeader
          title="Ball Arena"
          description={`${getModeLabel(selectedMode)} : ${currentParty.name || 'Sans nom'}`}
          actions={(
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />Jeux
              </Link>
            </Button>
          )}
        />

        <ModeSwitch mode={selectedMode} onChange={setSelectedMode} />

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm text-muted-foreground">Joueurs dans la party ({partyMembers.length}/{currentParty.maxSize})</h2>
              <span className="text-xs text-muted-foreground">{selectedMode === 'duo' ? '1v1 strict' : 'FFA 2+'}</span>
            </div>
            <div className="space-y-0">
              {partyMembers.map((member) => (
                <div key={member.userId} className={cn('flex items-center justify-between border-b border-border/30 py-4 last:border-0', member.userId === user?.id && 'bg-muted/30 -mx-4 px-4')}>
                  <span className="font-medium">
                    <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                    {member.isLeader && <span className="ml-2 text-xs text-muted-foreground">leader</span>}
                    {member.userId === user?.id && <span className="ml-2 text-xs text-muted-foreground">(toi)</span>}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {selectedMode === 'duo'
            ? 'Le mode duo demande exactement 2 joueurs dans la party.'
            : 'Le mode multijoueur lance une arène libre avec tous les joueurs qui acceptent.'}
        </p>

        {!canStartSelectedMode && (
          <p className="text-center text-sm text-muted-foreground">Il faut {requiredPlayerText} pour commencer.</p>
        )}

        {isLeader && canStartSelectedMode && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={handleStart}
              className="flex items-center gap-3 border border-foreground px-8 py-4 text-lg text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              <Play className="h-5 w-5" />Lancer en {selectedMode === 'duo' ? 'duo' : 'multijoueur'}
            </Button>
          </div>
        )}

        {!isLeader && canStartSelectedMode && (
          <div className="py-8 text-center text-muted-foreground">En attente que le leader lance la partie...</div>
        )}

        <PostGameModals gameOver={gameOver} setGameOver={setGameOver} gameState={gameState} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Ball Arena"
        description={`${getModeLabel(currentMode)} : ${currentParty.name || 'Sans nom'}`}
        actions={(
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />Jeux
              </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLeave}>
              <LogOut className="mr-2 h-4 w-4" />Quitter
            </Button>
          </>
        )}
      />

      {error && <p className="animate-pulse text-center text-sm text-red-500">{error}</p>}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap justify-center gap-4">
            {gameState.players.map((player) => {
              const isMe = player.userId === user?.id;
              return (
                <div key={player.userId} className="flex items-center gap-2.5 rounded-lg border border-border/30 px-4 py-2">
                  <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: getPlayerColor(player.playerIndex) }} />
                  <span className="text-sm font-medium">
                    <UsernameDisplay username={player.username} usernameColor={player.usernameColor} />
                    {isMe && <span className="ml-1 text-xs text-muted-foreground">(toi)</span>}
                  </span>
                  {player.isOut && <span className="text-xs text-red-400">éliminé</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1 text-center text-sm text-muted-foreground">
        {gameState.phase === 'prep' && (
          <>
            <p className={cn('text-2xl font-mono font-bold tabular-nums', prepSecsLeft <= 3 ? 'text-red-500' : 'text-foreground')}>
              {prepSecsLeft}s
              {gameState.round > 1 && <span className="ml-3 text-base font-normal text-muted-foreground">Manche {gameState.round}</span>}
            </p>
            {myPlayer?.isOut && <p className="text-red-400">Tu es éliminé pour le reste de la partie.</p>}
            {myPlayer && !myPlayer.isOut && !myPlayer.hasSetDirection && <p>Glisse depuis ta balle pour choisir direction et vitesse.</p>}
            {myPlayer && !myPlayer.isOut && myPlayer.hasSetDirection && (
              <p className="text-green-500">
                Direction confirmée
                {alivePlayers.every((player) => player.hasSetDirection)
                  ? ' — lancement imminent !'
                  : ` — attente des ${alivePlayers.filter((player) => !player.hasSetDirection && player.userId !== myPlayer.userId).length} autre(s) joueur(s)`}
              </p>
            )}
          </>
        )}
        {gameState.phase === 'playing' && (
          <p>
            Les balles sont lancées !
            {gameState.round > 1 && <span className="ml-2 text-xs text-muted-foreground">Manche {gameState.round}</span>}
          </p>
        )}
        {gameState.phase === 'finished' && (
          <p>
            {gameState.isDraw
              ? 'Égalité !'
              : gameState.winnerId === user?.id
                ? 'Tu as gagné !'
                : `${winnerPlayer?.username ?? 'Un joueur'} a gagné.`}
          </p>
        )}
      </div>

      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={600}
          height={600}
          className={cn(
            'w-full max-w-[520px] aspect-square rounded-full border border-border/20 touch-none select-none',
            gameState.phase === 'prep' && !myPlayer?.isOut && !myPlayer?.hasSetDirection && 'cursor-crosshair',
            gameState.phase === 'prep' && !myPlayer?.isOut && myPlayer?.hasSetDirection && 'cursor-pointer',
          )}
          style={{ imageRendering: 'pixelated' }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />
      </div>

      {gameState.phase === 'prep' && (
        <div className="flex flex-wrap justify-center gap-3 text-center text-xs text-muted-foreground">
          {gameState.players.map((player) => (
            <span key={player.userId}>
              Joueur {player.playerIndex + 1} = <span style={{ color: getPlayerColor(player.playerIndex) }}>●</span>
            </span>
          ))}
        </div>
      )}

      <PostGameModals gameOver={gameOver} setGameOver={setGameOver} gameState={gameState} />
    </PageShell>
  );
}

function PostGameModals({
  gameOver,
  setGameOver,
  gameState,
}: {
  gameOver: GameOverData | null;
  setGameOver: (value: GameOverData | null) => void;
  gameState: BallArenaState | null;
}) {
  const { user } = useAuth();
  const [showReplay, setShowReplay] = useState(false);
  const orderedResults = useMemo(() => {
    const baseResults = gameOver?.results ?? [];
    return [...baseResults].sort((a, b) => Number(b.isWinner) - Number(a.isWinner));
  }, [gameOver?.results]);

  return (
    <>
      <Dialog open={!!gameOver && !showReplay} onOpenChange={() => setGameOver(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-normal">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Partie terminée
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {gameOver?.isDraw ? (
              <div className="text-center">
                <p className="text-2xl font-light">Égalité !</p>
                {gameOver.rewards.draw && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    +{gameOver.rewards.draw.aura} aura · +{gameOver.rewards.draw.money}$
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Gagnant</p>
                {gameOver?.winnerUsername && (
                  <UsernameDisplay username={gameOver.winnerUsername} className="justify-center text-2xl font-light" />
                )}
              </div>
            )}

            {orderedResults.length > 0 ? (
              <div className="space-y-2">
                {orderedResults.map((result) => (
                  <div
                    key={result.userId}
                    className={cn(
                      'flex items-center justify-between rounded border px-3 py-3',
                      result.isWinner ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border/30',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <UsernameDisplay username={result.username} usernameColor={result.usernameColor} className="font-medium" />
                      {result.userId === user?.id && <span className="text-xs text-muted-foreground">(toi)</span>}
                    </div>
                    <div className="text-sm">
                      {result.rewards.aura > 0 && <span className="text-purple-400">+{result.rewards.aura} aura </span>}
                      <span className="text-green-400">+{result.rewards.money}$</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : !gameOver?.isDraw && gameState ? (
              <div className="space-y-2">
                {gameState.players.map((player) => (
                  <div key={player.userId} className="flex items-center justify-between rounded border border-border/30 px-3 py-3">
                    <UsernameDisplay username={player.username} usernameColor={player.usernameColor} className="font-medium" />
                    <span className="text-xs text-muted-foreground">{player.userId === gameOver?.winnerId ? 'gagnant' : 'participant'}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
            {gameOver?.replayFrames && gameOver.replayFrames.length > 1 && (
              <Button variant="outline" onClick={() => setShowReplay(true)} className="w-full gap-2">
                <RotateCcw className="h-4 w-4" />Revoir le match
              </Button>
            )}
            <Button variant="outline" onClick={() => setGameOver(null)} className="w-full border-foreground">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {gameOver && showReplay && (
        <ReplayModal
          replayFrames={gameOver.replayFrames ?? []}
          players={gameOver.players ?? []}
          myUserId={user?.id ?? ''}
          onClose={() => setShowReplay(false)}
        />
      )}
    </>
  );
}

function ReplayModal({
  replayFrames,
  players,
  myUserId,
  onClose,
}: {
  replayFrames: number[][];
  players: ReplayPlayer[];
  myUserId: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const totalFrames = replayFrames.length;

  const drawFrame = useCallback((frameIdx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = replayFrames[Math.min(frameIdx, totalFrames - 1)];
    if (!frame) return;

    const balls: RenderBall[] = players.map((player, index) => ({
      x: frame[index * 3] ?? 0,
      y: frame[index * 3 + 1] ?? 0,
      isOut: frame[index * 3 + 2] === 1,
      playerIndex: player.playerIndex,
      hasSetDirection: true,
      plannedVx: 0,
      plannedVy: 0,
    }));
    drawScene(canvas, balls, null, 'playing', null);
  }, [players, replayFrames, totalFrames]);

  useEffect(() => {
    frameRef.current = 0;
    setCurrentFrame(0);
    const t = setTimeout(() => {
      drawFrame(0);
      setPlaying(true);
    }, 80);
    return () => clearTimeout(t);
  }, [drawFrame]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      const next = frameRef.current + 1;
      if (next >= totalFrames) {
        setPlaying(false);
        return;
      }
      frameRef.current = next;
      setCurrentFrame(next);
      drawFrame(next);
    }, Math.round(64 / speed));
    return () => clearInterval(interval);
  }, [playing, speed, drawFrame, totalFrames]);

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = Number(e.target.value);
    frameRef.current = frame;
    setCurrentFrame(frame);
    drawFrame(frame);
    setPlaying(false);
  };

  const handleRestart = () => {
    frameRef.current = 0;
    setCurrentFrame(0);
    drawFrame(0);
    setPlaying(true);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="p-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-normal">
            <RotateCcw className="h-4 w-4" />
            Replay
            <span className="ml-auto text-xs text-muted-foreground">
              {players.map((player, index) => (
                <span key={player.userId}>
                  {index > 0 && ' · '}
                  <span style={{ color: getPlayerColor(player.playerIndex) }}>●</span>{' '}
                  {player.userId === myUserId ? <strong>{player.username}</strong> : player.username}
                </span>
              ))}
            </span>
          </DialogTitle>
        </DialogHeader>

        <canvas
          ref={canvasRef}
          width={600}
          height={600}
          className="aspect-square w-full rounded-full"
          style={{ imageRendering: 'pixelated' }}
        />

        <div className="space-y-2 pt-1">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalFrames - 1)}
            value={currentFrame}
            onChange={handleScrub}
            className="h-1 w-full accent-blue-500"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPlaying((value) => !value)} className="gap-1.5 px-3">
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleRestart} className="gap-1.5 px-3">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant={speed === 2 ? 'secondary' : 'ghost'} onClick={() => setSpeed((value) => (value === 1 ? 2 : 1))} className="ml-1 px-3">
              {speed}×
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">{currentFrame + 1} / {totalFrames}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
