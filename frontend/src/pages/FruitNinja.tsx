import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';

// ============================================
// CONSTANTS
// ============================================
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const GAME_TYPE = 'fruit_ninja';
const GRAVITY = 0.28;
const MAX_LIVES = 3;
const FRUIT_RADIUS = 44;
const MIN_SLICE_SPEED = 3;
const COMBO_TIMEOUT_MS = 1400;
const TRAIL_DURATION_MS = 110;
const MAX_ACTIVE_FRUITS = 12;
const MAX_PARTICLES = 160;
const WOOD_PLANK_MIN_WIDTH = 60;
const WOOD_PLANK_MAX_WIDTH = 96;

const FRUIT_DATA = [
  { emoji: '🍉', color: '#e03030', juice: '#ff5555' },
  { emoji: '🍊', color: '#e07020', juice: '#ff9922' },
  { emoji: '🍋', color: '#c8a800', juice: '#ffdd00' },
  { emoji: '🍇', color: '#7733bb', juice: '#aa44ee' },
  { emoji: '🍓', color: '#dd1133', juice: '#ff3355' },
  { emoji: '🍑', color: '#dd5533', juice: '#ff8855' },
  { emoji: '🍍', color: '#bb8800', juice: '#ffcc00' },
  { emoji: '🥭', color: '#dd6600', juice: '#ffaa22' },
  { emoji: '🍌', color: '#c8aa00', juice: '#ffdd22' },
  { emoji: '🍎', color: '#bb0000', juice: '#dd2222' },
  { emoji: '🍈', color: '#55aa44', juice: '#77cc55' },
  { emoji: '🫐', color: '#3344aa', juice: '#5566cc' },
];

// ============================================
// TYPES
// ============================================
interface Vec2 { x: number; y: number }

interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; alpha: number; size: number;
  life: number; maxLife: number;
}

interface FruitHalf {
  x: number; y: number; vx: number; vy: number;
  emoji: string; rotation: number; rotSpeed: number;
  alpha: number; rightHalf: boolean;
}

interface ScorePopup {
  x: number; y: number; text: string; alpha: number; vy: number; scale: number;
}

interface Fruit {
  id: number;
  x: number; y: number; vx: number; vy: number;
  radius: number;
  emoji: string; color: string; juice: string;
  isBomb: boolean;
  state: 'flying' | 'sliced';
  rotation: number; rotSpeed: number;
}

interface Splatter {
  x: number; y: number; color: string; size: number; alpha: number;
}

interface TrailPoint { x: number; y: number; time: number }

// ============================================
// HELPERS
// ============================================
function segmentIntersectsCircle(p1: Vec2, p2: Vec2, cx: number, cy: number, r: number): boolean {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const fx = p1.x - cx, fy = p1.y - cy;
  const a = dx * dx + dy * dy;
  if (a < 0.0001) return Math.hypot(fx, fy) <= r;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

// ============================================
// COMPONENT
// ============================================
export default function FruitNinja() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animRef = useRef<number>(0);
  const scaleRef = useRef(1);
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();

  // Input
  const mouseRef = useRef<Vec2>({ x: -999, y: -999 });
  const prevMouseRef = useRef<Vec2>({ x: -999, y: -999 });
  const trailRef = useRef<TrailPoint[]>([]);
  const onCanvasRef = useRef(false);

  // Game state refs (used inside RAF loop)
  const fruitsRef = useRef<Fruit[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const halvesRef = useRef<FruitHalf[]>([]);
  const popupsRef = useRef<ScorePopup[]>([]);
  const splattersRef = useRef<Splatter[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const comboRef = useRef(0);
  const lastSliceTimeRef = useRef(0);
  const fruitsSlicedRef = useRef(0);
  const fruitIdRef = useRef(0);
  const gameRunRef = useRef(false);
  const lastSpawnRef = useRef(0);
  const lastTimeRef = useRef(0);
  const shakeAmtRef = useRef(0);
  const woodBgRef = useRef<HTMLCanvasElement | null>(null);
  const vignetteGradRef = useRef<CanvasGradient | null>(null);
  const fpsModeRef = useRef(false);

  // React state (UI)
  const { user, refreshUser } = useAuth();
  const [fpsMode, setFpsMode] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [fruitsSliced, setFruitsSliced] = useState(0);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const r = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(r.data.stats.highScore || 0);
    } catch { /* */ }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const r = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(r.data.rankings || []);
    } catch { /* */ }
  }, []);

  useEffect(() => { fetchStats(); fetchLeaderboard(); }, [fetchStats, fetchLeaderboard]);

  useEffect(() => {
    fpsModeRef.current = fpsMode;
    if (fpsMode) particlesRef.current = [];
  }, [fpsMode]);

  const handleDeleteScore = useCallback(async (userId: string, username: string) => {
    if (!confirm(`Supprimer le score de ${username} ?`)) return;
    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      fetchLeaderboard();
      if (userId === user?.id) setHighScore(0);
    } catch { /* */ }
  }, [fetchLeaderboard, user?.id]);

  // ---- Spawn ----
  const spawnFruit = useCallback(() => {
    if (fruitsRef.current.filter(f => f.state === 'flying').length >= MAX_ACTIVE_FRUITS) return;
    const bombChance = Math.min(0.15, 0.03 + scoreRef.current / 4000);
    const isBomb = Math.random() < bombChance;
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft
      ? FRUIT_RADIUS + Math.random() * 100
      : CANVAS_WIDTH - FRUIT_RADIUS - Math.random() * 100;
    const vx = (fromLeft ? 1 : -1) * (1.8 + Math.random() * 3.4);
    const peakFrac = 0.34 + Math.random() * 0.32;
    const peak = CANVAS_HEIGHT * peakFrac;
    const vy = -Math.sqrt(2 * GRAVITY * peak);
    const fd = FRUIT_DATA[Math.floor(Math.random() * FRUIT_DATA.length)];
    fruitsRef.current.push({
      id: fruitIdRef.current++,
      x, y: CANVAS_HEIGHT + FRUIT_RADIUS + 5,
      vx, vy,
      radius: FRUIT_RADIUS,
      emoji: isBomb ? '💣' : fd.emoji,
      color: isBomb ? '#333' : fd.color,
      juice: isBomb ? '#666' : fd.juice,
      isBomb,
      state: 'flying',
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.06,
    });
  }, []);

  // ---- Particle effects ----
  const createJuiceParticles = useCallback((x: number, y: number, color: string, juice: string, count: number) => {
    if (fpsModeRef.current || particlesRef.current.length >= MAX_PARTICLES) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 5.5;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 1.5,
        color: Math.random() < 0.6 ? juice : color,
        alpha: 0.9 + Math.random() * 0.1,
        size: 3 + Math.random() * 7,
        life: 0, maxLife: 25 + Math.random() * 35,
      });
    }
    // White sparkles
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * 5;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
        color: '#ffffff',
        alpha: 1, size: 1.5 + Math.random() * 3,
        life: 0, maxLife: 12 + Math.random() * 10,
      });
    }
  }, []);

  const createSplatter = useCallback((x: number, y: number, juice: string) => {
    for (let i = 0; i < 5; i++) {
      splattersRef.current.push({
        x: x + (Math.random() - 0.5) * 90,
        y: y + (Math.random() - 0.5) * 90,
        color: juice, size: 5 + Math.random() * 18,
        alpha: 0.45 + Math.random() * 0.3,
      });
    }
    if (splattersRef.current.length > 45) splattersRef.current.splice(0, splattersRef.current.length - 45);
  }, []);

  const createHalves = useCallback((fruit: Fruit, sliceAngle: number) => {
    for (let side = 0; side < 2; side++) {
      const dir = side === 0 ? -1 : 1;
      const perpAngle = sliceAngle + Math.PI / 2;
      halvesRef.current.push({
        x: fruit.x + Math.cos(perpAngle) * dir * 10,
        y: fruit.y + Math.sin(perpAngle) * dir * 10,
        vx: fruit.vx * 0.4 + Math.cos(perpAngle) * dir * 2.5,
        vy: fruit.vy * 0.3,
        emoji: fruit.emoji,
        rotation: fruit.rotation,
        rotSpeed: (Math.random() - 0.5) * 0.2 * dir,
        alpha: 1,
        rightHalf: side === 1,
      });
    }
  }, []);

  // ---- Slice logic ----
  const sliceFruit = useCallback((fruit: Fruit, sliceAngle: number, timestamp: number) => {
    if (fruit.state !== 'flying') return;
    fruit.state = 'sliced';

    if (fruit.isBomb) {
      shakeAmtRef.current = 380;
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      comboRef.current = 0;
      setCombo(0);
      lastSliceTimeRef.current = 0;
      // Dark smoke + fire
      if (!fpsModeRef.current && particlesRef.current.length < MAX_PARTICLES) for (let i = 0; i < 28; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 7;
        particlesRef.current.push({
          x: fruit.x, y: fruit.y,
          vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 3,
          color: i < 16
            ? `hsl(0,0%,${15 + Math.random() * 25}%)`
            : `hsl(${20 + Math.random() * 25},100%,55%)`,
          alpha: 1, size: 5 + Math.random() * 10,
          life: 0, maxLife: 30 + Math.random() * 25,
        });
      }
      createHalves(fruit, sliceAngle);
      popupsRef.current.push({ x: fruit.x, y: fruit.y - 30, text: '💥 -❤️', alpha: 1, vy: -2.5, scale: 1.3 });
      return;
    }

    createJuiceParticles(fruit.x, fruit.y, fruit.color, fruit.juice, 20);
    createSplatter(fruit.x, fruit.y, fruit.juice);
    createHalves(fruit, sliceAngle);

    // Combo
    const dt = timestamp - lastSliceTimeRef.current;
    if (lastSliceTimeRef.current > 0 && dt < COMBO_TIMEOUT_MS) {
      comboRef.current = Math.min(comboRef.current + 1, 10);
    } else {
      comboRef.current = 1;
    }
    lastSliceTimeRef.current = timestamp;
    setCombo(comboRef.current);

    const mult = comboRef.current >= 5 ? 3 : comboRef.current >= 3 ? 2 : 1;
    const pts = 10 * mult;
    scoreRef.current += pts;
    setScore(scoreRef.current);
    fruitsSlicedRef.current++;
    setFruitsSliced(fruitsSlicedRef.current);

    popupsRef.current.push({
      x: fruit.x, y: fruit.y - 20,
      text: mult > 1 ? `+${pts} ×${mult} 🔥` : `+${pts}`,
      alpha: 1, vy: -2.2, scale: mult > 1 ? 1.3 : 1,
    });

    // Ring burst for combo
    if (comboRef.current >= 3 && !fpsModeRef.current) {
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        particlesRef.current.push({
          x: fruit.x, y: fruit.y,
          vx: Math.cos(angle) * 4.5, vy: Math.sin(angle) * 4.5,
          color: `hsl(${Math.random() * 360},100%,65%)`,
          alpha: 1, size: 3 + Math.random() * 4,
          life: 0, maxLife: 28,
        });
      }
    }
  }, [createHalves, createJuiceParticles, createSplatter]);

  // ---- Game over ----
  const handleGameOver = useCallback(async () => {
    gameRunRef.current = false;
    setGameOver(true);
    const final = scoreRef.current;
    try {
      const r = await gamesApi.complete(GAME_TYPE, { score: final, won: false });
      setRewards({ aura: r.data.auraReward, money: r.data.moneyReward });
      setIsNewHighScore(r.data.isNewHighScore);
      if (r.data.isNewHighScore) setHighScore(final);
      await refreshUser();
      fetchLeaderboard();
    } catch { /* */ }
  }, [fetchLeaderboard, refreshUser]);

  // ---- Init ----
  const initGame = useCallback(() => {
    fruitsRef.current = [];
    particlesRef.current = [];
    halvesRef.current = [];
    popupsRef.current = [];
    splattersRef.current = [];
    scoreRef.current = 0;
    livesRef.current = MAX_LIVES;
    comboRef.current = 0;
    fruitsSlicedRef.current = 0;
    lastSliceTimeRef.current = 0;
    lastSpawnRef.current = 0;
    fruitIdRef.current = 0;
    shakeAmtRef.current = 0;
    gameRunRef.current = true;
    lastTimeRef.current = 0;
    setScore(0); setLives(MAX_LIVES); setCombo(0);
    setFruitsSliced(0); setGameOver(false); setStarted(true);
    setRewards(null); setIsNewHighScore(false);
  }, []);

  const getWoodBackground = useCallback(() => {
    if (woodBgRef.current) return woodBgRef.current;

    const off = document.createElement('canvas');
    off.width = CANVAS_WIDTH;
    off.height = CANVAS_HEIGHT;
    const c = off.getContext('2d');
    if (!c) return off;

    c.fillStyle = '#7b4f2e';
    c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    let x = 0;
    while (x < CANVAS_WIDTH) {
      const plankW = WOOD_PLANK_MIN_WIDTH + Math.random() * (WOOD_PLANK_MAX_WIDTH - WOOD_PLANK_MIN_WIDTH);
      const plankX = x;
      const plankRight = Math.min(CANVAS_WIDTH, plankX + plankW);
      const grad = c.createLinearGradient(plankX, 0, plankRight, 0);
      const hueShift = (Math.random() - 0.5) * 10;
      grad.addColorStop(0, `hsl(${27 + hueShift}, 48%, 33%)`);
      grad.addColorStop(0.5, `hsl(${30 + hueShift}, 45%, 38%)`);
      grad.addColorStop(1, `hsl(${24 + hueShift}, 50%, 31%)`);
      c.fillStyle = grad;
      c.fillRect(plankX, 0, plankRight - plankX, CANVAS_HEIGHT);

      // Vertical seams between planks.
      c.fillStyle = 'rgba(35, 20, 10, 0.5)';
      c.fillRect(plankRight - 1.5, 0, 3, CANVAS_HEIGHT);
      c.fillStyle = 'rgba(255, 220, 170, 0.07)';
      c.fillRect(plankX + 1, 0, 1, CANVAS_HEIGHT);

      // Horizontal wood grain bands.
      for (let y = 0; y < CANVAS_HEIGHT; y += 8) {
        const jitter = (Math.random() - 0.5) * 2;
        const alpha = 0.035 + Math.random() * 0.035;
        c.fillStyle = `rgba(40, 22, 10, ${alpha})`;
        c.fillRect(plankX, y + jitter, plankRight - plankX, 1);
      }

      // Knots.
      const knotCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < knotCount; i++) {
        const kx = plankX + 10 + Math.random() * Math.max(10, plankRight - plankX - 20);
        const ky = 20 + Math.random() * (CANVAS_HEIGHT - 40);
        const kr = 5 + Math.random() * 11;
        const knot = c.createRadialGradient(kx, ky, kr * 0.2, kx, ky, kr);
        knot.addColorStop(0, 'rgba(72, 40, 18, 0.42)');
        knot.addColorStop(0.65, 'rgba(48, 26, 12, 0.3)');
        knot.addColorStop(1, 'rgba(28, 16, 8, 0.08)');
        c.fillStyle = knot;
        c.beginPath();
        c.ellipse(kx, ky, kr * 1.15, kr * 0.85, Math.random() * Math.PI, 0, Math.PI * 2);
        c.fill();
      }

      x = plankRight;
    }

    // Subtle scratch marks to mimic sliced board texture.
    c.strokeStyle = 'rgba(30, 16, 8, 0.22)';
    c.lineWidth = 1.2;
    for (let i = 0; i < 24; i++) {
      const sx = Math.random() * CANVAS_WIDTH;
      const sy = Math.random() * CANVAS_HEIGHT;
      const len = 25 + Math.random() * 90;
      const ang = -0.75 + Math.random() * 1.5;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      c.stroke();
    }

    // Soft center highlight.
    const light = c.createRadialGradient(
      CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.44, 30,
      CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.44, CANVAS_HEIGHT * 0.8,
    );
    light.addColorStop(0, 'rgba(255, 215, 165, 0.14)');
    light.addColorStop(1, 'rgba(255, 215, 165, 0)');
    c.fillStyle = light;
    c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    woodBgRef.current = off;
    return off;
  }, []);

  // ---- Draw ----
  const drawScene = useCallback((ctx: CanvasRenderingContext2D, timestamp: number) => {
    ctx.setTransform(scaleRef.current, 0, 0, scaleRef.current, 0, 0);

    if (shakeAmtRef.current > 0) {
      const intensity = (shakeAmtRef.current / 380) * 9;
      ctx.translate((Math.random() - 0.5) * intensity * 2, (Math.random() - 0.5) * intensity * 2);
    }

    // Wooden board background inspired by the original game.
    ctx.drawImage(getWoodBackground(), 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle vignette (cached)
    if (!vignetteGradRef.current) {
      const vignette = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.25,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.75,
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.34)');
      vignetteGradRef.current = vignette;
    }
    ctx.fillStyle = vignetteGradRef.current;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Splatters
    for (const s of splattersRef.current) {
      ctx.globalAlpha = s.alpha * 0.6;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Fruit halves
    ctx.font = `${FRUIT_RADIUS * 1.8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const h of halvesRef.current) {
      ctx.save();
      ctx.globalAlpha = h.alpha;
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rotation);
      ctx.beginPath();
      if (h.rightHalf) {
        ctx.rect(0, -FRUIT_RADIUS * 2, FRUIT_RADIUS * 2, FRUIT_RADIUS * 4);
      } else {
        ctx.rect(-FRUIT_RADIUS * 2, -FRUIT_RADIUS * 2, FRUIT_RADIUS * 2, FRUIT_RADIUS * 4);
      }
      ctx.clip();
      ctx.fillText(h.emoji, 0, 2);
      ctx.restore();
    }

    // Particles
    if (!fpsModeRef.current) {
      for (const p of particlesRef.current) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Flying fruits
    for (const f of fruitsRef.current) {
      if (f.state !== 'flying') continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);
      // Drop shadow
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(4, 7, f.radius * 0.75, f.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillText(f.emoji, 0, 2);
      ctx.restore();
    }

    // Blade trail
    const now = timestamp;
    const activeTrail = trailRef.current.filter(p => now - p.time < TRAIL_DURATION_MS);
    if (activeTrail.length >= 2 && onCanvasRef.current) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < activeTrail.length; i++) {
        const a = activeTrail[i - 1];
        const b = activeTrail[i];
        const age = (now - b.time) / TRAIL_DURATION_MS;
        const alpha = 1 - age;
        const w = Math.max(1.5, 7 * alpha);
        // Outer glow
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(255, 110, 15, ${alpha * 0.45})`;
        ctx.lineWidth = w * 3.5;
        ctx.stroke();
        // Mid glow
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(255, 220, 80, ${alpha * 0.65})`;
        ctx.lineWidth = w * 1.8;
        ctx.stroke();
        // Core
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(255, 255, 210, ${alpha * 0.95})`;
        ctx.lineWidth = w * 0.7;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Cursor dot
    if (onCanvasRef.current) {
      const { x, y } = mouseRef.current;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 210, 1)';
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 190, 50, 0.8)';
      ctx.fill();
      ctx.restore();
    }

    // Score popups
    ctx.save();
    for (const p of popupsRef.current) {
      ctx.globalAlpha = p.alpha;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale, p.scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 17px sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3.5;
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = '#ffee44';
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }, [getWoodBackground]);

  // ---- Game loop ----
  const gameLoop = useCallback((timestamp: number) => {
    const ctx = ctxRef.current;
    if (!ctx || !gameRunRef.current) return;

    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = Math.min(timestamp - lastTimeRef.current, 50);
    lastTimeRef.current = timestamp;
    const ts = dt / (1000 / 60);

    // Combo decay
    if (comboRef.current > 0 && lastSliceTimeRef.current > 0 &&
        timestamp - lastSliceTimeRef.current > COMBO_TIMEOUT_MS) {
      comboRef.current = 0;
      setCombo(0);
    }

    // Shake decay
    if (shakeAmtRef.current > 0) shakeAmtRef.current = Math.max(0, shakeAmtRef.current - dt);

    // Spawn
    const spawnInt = Math.max(500, 1900 - scoreRef.current * 0.75);
    if (timestamp - lastSpawnRef.current > spawnInt) {
      const multiSpawnChance = scoreRef.current > 80
        ? Math.min(0.65, 0.12 + scoreRef.current / 1100)
        : 0;
      const batch = scoreRef.current > 400 && Math.random() < 0.22
        ? 3
        : Math.random() < multiSpawnChance
          ? 2
          : 1;
      for (let i = 0; i < batch; i++) spawnFruit();
      lastSpawnRef.current = timestamp;
    }

    // Update fruits
    const deadIdx: number[] = [];
    for (let i = 0; i < fruitsRef.current.length; i++) {
      const f = fruitsRef.current[i];
      if (f.state !== 'flying') { deadIdx.push(i); continue; }
      f.x += f.vx * ts;
      f.y += f.vy * ts;
      f.vy += GRAVITY * ts;
      f.rotation += f.rotSpeed * ts;
      if (f.y > CANVAS_HEIGHT + FRUIT_RADIUS + 10) {
        if (!f.isBomb) {
          livesRef.current = Math.max(0, livesRef.current - 1);
          setLives(livesRef.current);
          comboRef.current = 0;
          setCombo(0);
          popupsRef.current.push({
            x: Math.max(30, Math.min(CANVAS_WIDTH - 30, f.x)),
            y: CANVAS_HEIGHT - 40,
            text: '❌', alpha: 1, vy: -1.5, scale: 1,
          });
          if (livesRef.current === 0) { handleGameOver(); return; }
        }
        deadIdx.push(i);
      }
    }
    for (let i = deadIdx.length - 1; i >= 0; i--) fruitsRef.current.splice(deadIdx[i], 1);

    // Update particles (swap-remove: O(1) per deletion vs O(n) splice)
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.18;
      p.life++;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.alpha <= 0) {
        particlesRef.current[i] = particlesRef.current[particlesRef.current.length - 1];
        particlesRef.current.pop();
      }
    }

    // Update halves (swap-remove)
    for (let i = halvesRef.current.length - 1; i >= 0; i--) {
      const h = halvesRef.current[i];
      h.x += h.vx; h.y += h.vy; h.vy += GRAVITY * 0.9;
      h.rotation += h.rotSpeed;
      h.alpha -= 0.011;
      if (h.alpha <= 0 || h.y > CANVAS_HEIGHT + 100) {
        halvesRef.current[i] = halvesRef.current[halvesRef.current.length - 1];
        halvesRef.current.pop();
      }
    }

    // Update popups (swap-remove)
    for (let i = popupsRef.current.length - 1; i >= 0; i--) {
      const p = popupsRef.current[i];
      p.y += p.vy; p.alpha -= 0.022;
      if (p.alpha <= 0) {
        popupsRef.current[i] = popupsRef.current[popupsRef.current.length - 1];
        popupsRef.current.pop();
      }
    }

    // Fade splatters (swap-remove)
    for (let i = splattersRef.current.length - 1; i >= 0; i--) {
      splattersRef.current[i].alpha -= 0.0009;
      if (splattersRef.current[i].alpha <= 0) {
        splattersRef.current[i] = splattersRef.current[splattersRef.current.length - 1];
        splattersRef.current.pop();
      }
    }

    // Slice detection
    const prev = prevMouseRef.current;
    const curr = mouseRef.current;
    const sliceSpd = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (sliceSpd >= MIN_SLICE_SPEED && onCanvasRef.current) {
      const sliceAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      for (const f of fruitsRef.current) {
        if (f.state !== 'flying') continue;
        if (segmentIntersectsCircle(prev, curr, f.x, f.y, f.radius)) {
          sliceFruit(f, sliceAngle, timestamp);
          if (livesRef.current <= 0) { handleGameOver(); return; }
        }
      }
    }
    prevMouseRef.current.x = curr.x;
    prevMouseRef.current.y = curr.y;

    drawScene(ctx, timestamp);
    animRef.current = requestAnimationFrame(gameLoop);
  }, [drawScene, handleGameOver, sliceFruit, spawnFruit]);

  // ---- Canvas setup ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      scaleRef.current = w / CANVAS_WIDTH;
    };
    ctxRef.current = canvas.getContext('2d', { alpha: false });
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener('resize', resize);
    return () => { ro.disconnect(); window.removeEventListener('resize', resize); };
  }, [isFullscreen]);

  // ---- Mouse tracking ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const toGame = (e: MouseEvent): Vec2 => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (CANVAS_WIDTH / r.width),
        y: (e.clientY - r.top) * (CANVAS_HEIGHT / r.height),
      };
    };
    const onMove = (e: MouseEvent) => {
      mouseRef.current = toGame(e);
      trailRef.current.push({ ...mouseRef.current, time: performance.now() });
      if (trailRef.current.length > 40) trailRef.current = trailRef.current.slice(-32);
    };
    const onEnter = () => { onCanvasRef.current = true; };
    const onLeave = () => { onCanvasRef.current = false; };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseenter', onEnter);
    canvas.addEventListener('mouseleave', onLeave);
    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseenter', onEnter);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // ---- Start/stop loop ----
  useEffect(() => {
    if (started && !gameOver) {
      animRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [started, gameOver, gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && (gameOver || !started)) {
        e.preventDefault();
        initGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, started, initGame]);

  const isPlaying = started && !gameOver;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start px-4 pb-6 lg:px-6 lg:pb-8">

      {/* ── Left column ── */}
      <div className="flex flex-col gap-3">

        {/* Score */}
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Score</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div>
              <p className="text-3xl font-light tabular-nums">{score.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Score actuel</p>
            </div>
            <Separator />
            <div>
              <p className="text-xl font-medium tabular-nums">{highScore.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Record</p>
            </div>
            {isNewHighScore && <p className="text-sm text-foreground">Nouveau record !</p>}
            {rewards && (rewards.money > 0 || rewards.aura > 0) && (
              <p className="text-sm text-muted-foreground">
                {rewards.money > 0 && `+$${rewards.money}`}
                {rewards.money > 0 && rewards.aura > 0 && ' · '}
                {rewards.aura > 0 && `+${rewards.aura} aura`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Lives */}
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Vies</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex gap-2 text-2xl">
              {Array.from({ length: MAX_LIVES }, (_, i) => (
                <span key={i} style={{ opacity: i < lives ? 1 : 0.2 }}>❤️</span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Stats</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Fruits tranchés</span>
              <span className="text-sm tabular-nums">🍉 {fruitsSliced}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Combo</span>
              <span className={`text-sm tabular-nums font-medium ${
                combo >= 5 ? 'text-red-400' : combo >= 3 ? 'text-orange-400' : combo >= 2 ? 'text-yellow-400' : ''
              }`}>
                {combo >= 2 ? `×${combo} 🔥` : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Contrôles</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2 text-xs text-muted-foreground">
            <p>🖱️ Déplace la souris rapidement à travers les fruits pour les trancher.</p>
            <p><kbd className="px-1 py-0.5 border border-border/50 rounded">R</kbd> pour rejouer.</p>
            <Separator />
            <p>💣 Évite les bombes — elles coûtent une vie.</p>
            <p>❌ Laisser tomber un fruit coûte une vie.</p>
            <p>🔥 Enchaîne les tranches pour un multiplicateur ×2 / ×3.</p>
            <Separator />
            <div className="flex items-center justify-between">
              <label htmlFor="fps-mode" className="text-xs text-muted-foreground cursor-pointer select-none">
                Mode FPS <span className="text-muted-foreground/60">(sans particules)</span>
              </label>
              <Switch
                id="fps-mode"
                checked={fpsMode}
                onCheckedChange={setFpsMode}
              />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── Center column — canvas ── */}
      <div
        ref={gameContainerRef}
        className={`relative flex flex-col gap-3 ${isFullscreen ? 'min-h-screen w-screen items-center bg-background px-4 py-4' : ''}`}
      >
        <GameFullscreenToolbar
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          className="w-full max-w-[400px]"
        />

        <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={CANVAS_WIDTH} baseHeight={CANVAS_HEIGHT}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block h-full w-full rounded-lg border border-border/30"
            style={{ cursor: isPlaying ? 'none' : 'default' }}
          />

          {/* Start screen */}
          {!started && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 rounded-lg bg-background/90">
              <div className="text-5xl tracking-widest select-none">🍉🍊🍋🍇🍓</div>
              <h2 className="text-2xl font-light">Fruit Ninja</h2>
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

          {/* Game over */}
          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/90">
              <div className="text-center space-y-6">
                <div>
                  <h2 className="text-2xl font-light mb-2">Fin de partie</h2>
                  <p className="text-3xl tabular-nums">{score.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">🍉 {fruitsSliced} fruits tranchés</p>
                </div>
                {isNewHighScore && <p className="text-sm text-foreground">✨ Nouveau record !</p>}
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

      {/* ── Right column ── */}
      <div className="flex flex-col gap-3">
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
  );
}
