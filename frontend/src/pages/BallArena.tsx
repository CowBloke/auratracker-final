import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocketBase } from '../contexts/SocketContext';
import { useChatSocket } from '../contexts/ChatSocketContext';
import { usePartySocket } from '../contexts/PartySocketContext';
import { useDuelSocket } from '../contexts/DuelSocketContext';
import { ArrowLeft, LogOut, Pause, Play, RotateCcw, Search, Swords, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';

// ─── Constants (must match server) ───────────────────────────────────────────
const ARENA_CX = 300;
const ARENA_CY = 300;
const ARENA_RADIUS = 240;
const BALL_RADIUS = 22;
const MAX_SPEED = 400;
const MAX_DRAG_DIST = 120;
const FRICTION = 0.984;
const SIM_STEP_MS = 16;
const EXIT_THRESHOLD = ARENA_RADIUS - BALL_RADIUS; // 218

const PLAYER_COLORS = ['#3b82f6', '#f97316'] as const;
const PLAYER_GLOW = ['rgba(59,130,246,0.5)', 'rgba(249,115,22,0.5)'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface BallArenaPlayerState {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: 0 | 1;
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
  playerIndex: 0 | 1;
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
}

// ─── Client-side physics (mirrors server exactly) ─────────────────────────────
interface SimBall { x: number; y: number; vx: number; vy: number; isOut: boolean }

interface ClientSim {
  balls: SimBall[];
  prevBalls: { x: number; y: number; isOut: boolean }[];
  accumMs: number;
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
  const [b0, b1] = balls;
  if (!b0.isOut && !b1.isOut) {
    const d = simDist(b0.x, b0.y, b1.x, b1.y);
    if (d < BALL_RADIUS * 2 && d > 0.001) {
      const nx = (b1.x - b0.x) / d;
      const ny = (b1.y - b0.y) / d;
      const dvx = b0.vx - b1.vx;
      const dvy = b0.vy - b1.vy;
      const p = dvx * nx + dvy * ny;
      if (p > 0) {
        b0.vx -= p * nx; b0.vy -= p * ny;
        b1.vx += p * nx; b1.vy += p * ny;
        const overlap = BALL_RADIUS * 2 - d;
        b0.x -= nx * overlap * 0.5; b0.y -= ny * overlap * 0.5;
        b1.x += nx * overlap * 0.5; b1.y += ny * overlap * 0.5;
      }
    }
  }
  for (const ball of balls) {
    if (ball.isOut) continue;
    if (simDist(ball.x, ball.y, ARENA_CX, ARENA_CY) > EXIT_THRESHOLD) ball.isOut = true;
  }
}

// ─── Canvas rendering ─────────────────────────────────────────────────────────
interface RenderBall {
  x: number; y: number; isOut: boolean; playerIndex: 0 | 1;
  hasSetDirection: boolean; plannedVx: number; plannedVy: number;
}

function drawScene(
  canvas: HTMLCanvasElement,
  balls: RenderBall[],
  dragArrow: { ballIdx: number; ex: number; ey: number } | null,
  phase: 'prep' | 'playing' | 'finished',
  myPlayerIndex: 0 | 1 | null,
) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  ctx.clearRect(0, 0, 600, 600);

  // Background
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, 600, 600);

  // Arena fill
  const bg = ctx.createRadialGradient(ARENA_CX, ARENA_CY, 0, ARENA_CX, ARENA_CY, ARENA_RADIUS);
  bg.addColorStop(0, '#111827');
  bg.addColorStop(1, '#0a0f1a');
  ctx.save();
  ctx.beginPath();
  ctx.arc(ARENA_CX, ARENA_CY, ARENA_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();

  // Grid rings
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

  // Arena border
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

  // ── Drag arrow (cartoony, big) ────────────────────────────────────────────
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
        const col = PLAYER_COLORS[dragArrow.ballIdx];
        const angle = Math.atan2(ey - ball.y, ex - ball.x);

        // Dashed trajectory line
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

        // Thick outline shaft (cartoon border)
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 11;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Colored shaft
        ctx.strokeStyle = col;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();

        // Arrowhead outline
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

        // Arrowhead fill
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

        // Speed % label with outline
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

  // ── Own confirmed direction arrow (only show your own) ────────────────────
  if (phase === 'prep') {
    for (const ball of balls) {
      const p = ball.playerIndex;
      // Only show your own planned arrow (hide opponent's until game starts)
      if (p !== myPlayerIndex) continue;
      const isDraggingThis = dragArrow !== null && dragArrow.ballIdx === p;
      if (ball.hasSetDirection && !isDraggingThis && !ball.isOut) {
        const vSpeed = Math.sqrt(ball.plannedVx ** 2 + ball.plannedVy ** 2);
        if (vSpeed > 0.1) {
          const normX = ball.plannedVx / vSpeed;
          const normY = ball.plannedVy / vSpeed;
          const arrowLen = (vSpeed / MAX_SPEED) * MAX_DRAG_DIST;
          const ex = ball.x + normX * arrowLen;
          const ey = ball.y + normY * arrowLen;
          const col = PLAYER_COLORS[p];
          const angle = Math.atan2(normY, normX);
          const headLen = 18;
          const headAngle = 0.45;

          // Outline shaft
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

          // Arrowhead
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

  // ── Balls ──────────────────────────────────────────────────────────────────
  for (const ball of balls) {
    const col = PLAYER_COLORS[ball.playerIndex];
    const glow = PLAYER_GLOW[ball.playerIndex];

    ctx.save();
    if (ball.isOut) ctx.globalAlpha = 0.25;

    ctx.shadowColor = glow;
    ctx.shadowBlur = ball.isOut ? 0 : 18;

    const ballGrad = ctx.createRadialGradient(
      ball.x - BALL_RADIUS * 0.3, ball.y - BALL_RADIUS * 0.3, BALL_RADIUS * 0.1,
      ball.x, ball.y, BALL_RADIUS,
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
    ctx.font = `bold ${BALL_RADIUS * 0.9}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(ball.playerIndex + 1), ball.x, ball.y + 1);
    ctx.restore();
  }

  // ── "Set!" checkmark ──────────────────────────────────────────────────────
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

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BallArena() {
  const { user, refreshUser } = useAuth();
  const { socket } = useSocketBase();
  const { onlineUsers, requestOnlineUsers } = useChatSocket();
  const { currentParty, partyMembers } = usePartySocket();
  const { challengeUserToDuel, outgoingDuelChallenge } = useDuelSocket();

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

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const myPlayer = gameState?.players.find((p) => p.userId === user?.id);

  // ── Client sim helpers ────────────────────────────────────────────────────
  const stopClientSim = () => { clientSimRef.current = null; };

  const seedClientSim = (balls: Array<{ x: number; y: number; vx: number; vy: number; isOut?: boolean }>) => {
    const simBalls: SimBall[] = balls.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, isOut: b.isOut ?? false }));
    clientSimRef.current = {
      balls: simBalls,
      prevBalls: simBalls.map((b) => ({ x: b.x, y: b.y, isOut: b.isOut })),
      accumMs: 0,
    };
  };

  // ── Socket events ─────────────────────────────────────────────────────────
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
        // Round ended or game done — stop local sim
        stopClientSim();
      } else if (!clientSimRef.current) {
        // Reconnect mid-game: re-seed sim from server state
        seedClientSim(state.players.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, isOut: p.isOut })));
      }
      // Otherwise: sim is running, trust it completely — no corrections
    };

    const onGameOver = (data: GameOverData) => {
      stopClientSim();
      setGameOver(data);
      refreshUser();
    };

    const onLeft = () => { stopClientSim(); setGameState(null); };
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

  // ── Prep countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState || gameState.phase !== 'prep') return;
    const iv = setInterval(() => {
      const elapsed = Date.now() - gameState.prepStartTime;
      const left = Math.max(0, Math.ceil((gameState.prepTimeMs - elapsed) / 1000));
      setPrepSecsLeft(left);
    }, 100);
    return () => clearInterval(iv);
  }, [gameState?.phase, gameState?.prepStartTime, gameState?.prepTimeMs]);

  // ── Canvas animation loop ─────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !gameState) return;
    const canvas = canvasRef.current;
    const myPlayerIndex = myPlayer?.playerIndex ?? null;
    let lastRafTime = performance.now();

    const render = (now: number) => {
      const ref = lastStateRef.current;
      if (!ref) { animFrameRef.current = requestAnimationFrame(render); return; }

      const { state, receivedAt } = ref;
      let renderedBalls: RenderBall[];

      const sim = clientSimRef.current;
      if (state.phase === 'playing' && sim) {
        // Advance client physics using elapsed time accumulator
        const elapsed = now - lastRafTime;
        lastRafTime = now;
        sim.accumMs = Math.min(sim.accumMs + elapsed, SIM_STEP_MS * 8); // cap to prevent spiral

        while (sim.accumMs >= SIM_STEP_MS) {
          sim.prevBalls = sim.balls.map((b) => ({ x: b.x, y: b.y, isOut: b.isOut }));
          clientSimStep(sim.balls);
          sim.accumMs -= SIM_STEP_MS;
        }

        // Sub-step interpolation for smooth 60fps between physics ticks
        const alpha = sim.accumMs / SIM_STEP_MS;
        renderedBalls = sim.balls.map((b, i) => {
          const prev = sim.prevBalls[i];
          return {
            x: prev.x + (b.x - prev.x) * alpha,
            y: prev.y + (b.y - prev.y) * alpha,
            isOut: b.isOut,
            playerIndex: (state.players[i]?.playerIndex ?? i) as 0 | 1,
            hasSetDirection: true,
            plannedVx: 0, plannedVy: 0,
          };
        });
      } else if (state.phase === 'playing') {
        // Fallback: linear extrapolation until sim-start arrives
        lastRafTime = now;
        const dt = Math.min((Date.now() - receivedAt) / 1000, 0.5);
        renderedBalls = state.players.map((p) => ({
          x: p.isOut ? p.x : p.x + p.vx * dt,
          y: p.isOut ? p.y : p.y + p.vy * dt,
          isOut: p.isOut, playerIndex: p.playerIndex,
          hasSetDirection: p.hasSetDirection, plannedVx: p.plannedVx, plannedVy: p.plannedVy,
        }));
      } else {
        lastRafTime = now;
        renderedBalls = state.players.map((p) => ({
          x: p.x, y: p.y, isOut: p.isOut, playerIndex: p.playerIndex,
          hasSetDirection: p.hasSetDirection, plannedVx: p.plannedVx, plannedVy: p.plannedVy,
        }));
      }

      const drag = dragRef.current;
      drawScene(
        canvas, renderedBalls,
        drag?.active ? { ballIdx: drag.ballIdx, ex: drag.ex, ey: drag.ey } : null,
        state.phase, myPlayerIndex,
      );
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, dragTick]);

  // ── Drag helpers ──────────────────────────────────────────────────────────
  function getGameCoords(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 600 / rect.width;
    const scaleY = 600 / rect.height;
    let clientX: number, clientY: number;
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
    if (!canvasRef.current || !gameState || gameState.phase !== 'prep' || !myPlayer) return;
    const { x, y } = getGameCoords(e, canvasRef.current);
    const dx = x - myPlayer.x;
    const dy = y - myPlayer.y;
    if (Math.sqrt(dx * dx + dy * dy) <= BALL_RADIUS * 2.5) {
      dragRef.current = { active: true, ballIdx: myPlayer.playerIndex, ex: x, ey: y };
      setDragTick((t) => t + 1);
    }
  }, [gameState, myPlayer]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current || !dragRef.current?.active) return;
    e.preventDefault();
    const { x, y } = getGameCoords(e, canvasRef.current);
    dragRef.current.ex = x;
    dragRef.current.ey = y;
    setDragTick((t) => t + 1);
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current?.active || !socket || !currentParty || !myPlayer || !gameState || gameState.phase !== 'prep') {
      dragRef.current = null;
      return;
    }
    const drag = dragRef.current;
    const ball = gameState.players[drag.ballIdx];
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
    setDragTick((t) => t + 1);
  }, [socket, currentParty, myPlayer, gameState]);

  const handleStart = () => {
    if (!socket || !currentParty) return;
    socket.emit('ballarena:start', { partyId: currentParty.id });
  };

  const handleLeave = () => {
    if (!socket || !currentParty) return;
    socket.emit('ballarena:leave', { partyId: currentParty.id });
    setGameState(null);
  };

  // ── No party ──────────────────────────────────────────────────────────────
  if (!currentParty) {
    const challengeableUsers = onlineUsers.filter(
      (u) => u.userId !== user?.id && u.username.toLowerCase().includes(challengeSearch.toLowerCase())
    );

    return (
      <PageShell>
        <PageHeader
          title="Ball Arena"
          description="Propulse ton adversaire hors de l'arène."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />Jeux
              </Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="py-10 px-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Duel 1v1 — Vise et propulse ton adversaire hors de l'arène</p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <Button onClick={() => { setChallengeSearch(''); requestOnlineUsers(); setShowChallengePicker(true); }}>
                <Swords className="h-4 w-4 mr-2" />Défier un joueur
              </Button>
              <Button asChild variant="outline"><Link to="/party">Via une party</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showChallengePicker} onOpenChange={setShowChallengePicker}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-normal flex items-center gap-2">
                <Swords className="h-4 w-4" />Défier en Ball Arena
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher un joueur..." value={challengeSearch}
                  onChange={(e) => setChallengeSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {challengeableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {onlineUsers.filter((u) => u.userId !== user?.id).length === 0 ? 'Aucun joueur en ligne' : 'Aucun résultat'}
                  </p>
                ) : (
                  challengeableUsers.map((u) => {
                    const isPending = outgoingDuelChallenge?.targetId === u.userId && outgoingDuelChallenge.gameType === 'ballarena';
                    return (
                      <div key={u.userId} className="flex items-center justify-between py-2 px-3 rounded-md border border-border/40 hover:border-border/80 transition-colors">
                        <UsernameDisplay username={u.username} usernameColor={u.usernameColor} className="text-sm" />
                        <Button size="sm" variant={isPending ? 'outline' : 'default'} disabled={isPending}
                          onClick={() => { challengeUserToDuel(u.userId, u.username, 'ballarena'); setShowChallengePicker(false); }}>
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

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (!gameState) {
    return (
      <PageShell>
        <PageHeader title="Ball Arena" description={`Duel : ${currentParty.name || 'Sans nom'}`}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />Jeux
              </Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm text-muted-foreground">Joueurs dans le duel ({partyMembers.length}/2)</h2>
            <div className="space-y-0">
              {partyMembers.map((member) => (
                <div key={member.userId} className={cn('flex items-center justify-between py-4 border-b border-border/30 last:border-0', member.userId === user?.id && 'bg-muted/30 -mx-4 px-4')}>
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

        {partyMembers.length < 2 && (
          <p className="text-center text-muted-foreground text-sm">Il faut 2 joueurs pour commencer</p>
        )}
        {isLeader && partyMembers.length === 2 && (
          <div className="flex justify-center">
            <Button variant="ghost" onClick={handleStart}
              className="flex items-center gap-3 px-8 py-4 text-lg border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors">
              <Play className="h-5 w-5" />Lancer la partie
            </Button>
          </div>
        )}
        {!isLeader && partyMembers.length === 2 && (
          <div className="text-center text-muted-foreground py-8">En attente que le leader lance la partie...</div>
        )}

        <PostGameModals gameOver={gameOver} setGameOver={setGameOver} gameState={gameState} />
      </PageShell>
    );
  }

  // ── Game active ────────────────────────────────────────────────────────────
  const opponent = gameState.players.find((p) => p.userId !== user?.id);

  return (
    <PageShell>
      <PageHeader title="Ball Arena" description={`Duel : ${currentParty.name || 'Sans nom'}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />Jeux
              </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLeave}>
              <LogOut className="h-4 w-4 mr-2" />Quitter
            </Button>
          </>
        }
      />

      {error && <p className="text-center text-sm text-red-500 animate-pulse">{error}</p>}

      <Card>
        <CardContent className="p-4">
          <div className="flex justify-center gap-6 flex-wrap">
            {gameState.players.map((player) => {
              const col = PLAYER_COLORS[player.playerIndex];
              const isMe = player.userId === user?.id;
              return (
                <div key={player.userId} className="flex items-center gap-2.5 px-4 py-2 border rounded-lg border-border/30">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: col }} />
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

      <div className="text-center text-sm text-muted-foreground space-y-1">
        {gameState.phase === 'prep' && (
          <>
            <p className={cn('text-2xl font-mono font-bold tabular-nums', prepSecsLeft <= 3 ? 'text-red-500' : 'text-foreground')}>
              {prepSecsLeft}s
              {gameState.round > 1 && <span className="ml-3 text-base font-normal text-muted-foreground">Manche {gameState.round}</span>}
            </p>
            {myPlayer && !myPlayer.hasSetDirection && <p>Glisse depuis ta balle pour choisir direction et vitesse</p>}
            {myPlayer?.hasSetDirection && (
              <p className="text-green-500">
                Direction confirmée
                {gameState.players.every((p) => p.hasSetDirection)
                  ? ' — lancement imminent !'
                  : ' — attente de l\'adversaire'}
              </p>
            )}
          </>
        )}
        {gameState.phase === 'playing' && (
          <p>
            Les balles sont lancées !
            {gameState.round > 1 && <span className="ml-2 text-muted-foreground text-xs">Manche {gameState.round}</span>}
          </p>
        )}
        {gameState.phase === 'finished' && (
          <p>
            {gameState.isDraw ? 'Égalité !' : gameState.winnerId === user?.id ? 'Tu as gagné !' : `${opponent?.username ?? '?'} a gagné.`}
          </p>
        )}
      </div>

      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={600}
          height={600}
          className={cn(
            'rounded-full border border-border/20 touch-none select-none',
            'w-full max-w-[520px] aspect-square',
            gameState.phase === 'prep' && !myPlayer?.hasSetDirection && 'cursor-crosshair',
            gameState.phase === 'prep' && myPlayer?.hasSetDirection && 'cursor-pointer',
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
        <p className="text-center text-xs text-muted-foreground">
          Joueur 1 = <span style={{ color: PLAYER_COLORS[0] }}>●</span> &nbsp;&nbsp; Joueur 2 = <span style={{ color: PLAYER_COLORS[1] }}>●</span>
        </p>
      )}

      <PostGameModals gameOver={gameOver} setGameOver={setGameOver} gameState={gameState} />
    </PageShell>
  );
}

// ─── Post-game modals ──────────────────────────────────────────────────────────
function PostGameModals({
  gameOver,
  setGameOver,
  gameState,
}: {
  gameOver: GameOverData | null;
  setGameOver: (v: GameOverData | null) => void;
  gameState: BallArenaState | null;
}) {
  const { user } = useAuth();
  const [showReplay, setShowReplay] = useState(false);

  return (
    <>
      <Dialog open={!!gameOver && !showReplay} onOpenChange={() => setGameOver(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Partie terminée
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {gameOver?.isDraw ? (
              <div className="text-center">
                <p className="text-2xl font-light">Égalité !</p>
                {gameOver.rewards.draw && (
                  <p className="text-sm text-muted-foreground mt-2">
                    +{gameOver.rewards.draw.aura} aura · +{gameOver.rewards.draw.money}$
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Gagnant</p>
                  {gameOver?.winnerUsername && (
                    <UsernameDisplay username={gameOver.winnerUsername} className="justify-center text-2xl font-light" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-3 px-3 border rounded border-yellow-500/50 bg-yellow-500/5">
                    {gameOver?.winnerUsername && (
                      <UsernameDisplay username={gameOver.winnerUsername} className="font-medium" />
                    )}
                    <div className="text-sm">
                      {gameOver?.rewards.winner && (
                        <>
                          <span className="text-purple-400">+{gameOver.rewards.winner.aura} aura </span>
                          <span className="text-green-400">+{gameOver.rewards.winner.money}$</span>
                        </>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const loser = gameState?.players.find((p) => p.userId !== gameOver?.winnerId);
                    return loser ? (
                      <div className="flex items-center justify-between py-3 px-3 border rounded border-border/30">
                        <UsernameDisplay username={loser.username} usernameColor={loser.usernameColor} className="font-medium" />
                        <div className="text-sm">
                          {gameOver?.rewards.loser && <span className="text-green-400">+{gameOver.rewards.loser.money}$</span>}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
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

// ─── Replay modal ──────────────────────────────────────────────────────────────
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
  const [playing, setPlaying] = useState(false); // start false; deferred to true after canvas mounts
  const [speed, setSpeed] = useState(1);

  const totalFrames = replayFrames.length;

  const drawFrame = useCallback((frameIdx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = replayFrames[Math.min(frameIdx, totalFrames - 1)];
    if (!frame) return;
    const balls: RenderBall[] = [
      { x: frame[0], y: frame[1], isOut: frame[2] === 1, playerIndex: 0, hasSetDirection: true, plannedVx: 0, plannedVy: 0 },
      { x: frame[3], y: frame[4], isOut: frame[5] === 1, playerIndex: 1, hasSetDirection: true, plannedVx: 0, plannedVy: 0 },
    ];
    drawScene(canvas, balls, null, 'playing', null);
  }, [replayFrames, totalFrames]);

  // Defer initial draw + autoplay until canvas is mounted in the Dialog
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
    const f = Number(e.target.value);
    frameRef.current = f;
    setCurrentFrame(f);
    drawFrame(f);
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
      <DialogContent className="sm:max-w-lg p-4">
        <DialogHeader>
          <DialogTitle className="font-normal text-sm flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Replay
            <span className="text-xs text-muted-foreground ml-auto">
              {players.map((p, i) => (
                <span key={p.userId}>
                  {i > 0 && ' · '}
                  <span style={{ color: PLAYER_COLORS[p.playerIndex] }}>●</span>{' '}
                  {p.userId === myUserId ? <strong>{p.username}</strong> : p.username}
                </span>
              ))}
            </span>
          </DialogTitle>
        </DialogHeader>

        <canvas
          ref={canvasRef}
          width={600}
          height={600}
          className="rounded-full w-full aspect-square"
          style={{ imageRendering: 'pixelated' }}
        />

        <div className="space-y-2 pt-1">
          <input
            type="range" min={0} max={Math.max(0, totalFrames - 1)} value={currentFrame}
            onChange={handleScrub} className="w-full h-1 accent-blue-500"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPlaying((p) => !p)} className="gap-1.5 px-3">
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleRestart} className="gap-1.5 px-3">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant={speed === 2 ? 'secondary' : 'ghost'}
              onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))} className="px-3 ml-1">
              {speed}×
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">{currentFrame + 1} / {totalFrames}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
