import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n';

// Canvas dimensions
const W = 600;
const H = 400;

// World
const WORLD_W = 5000; // 5 km
const GROUND_Y = H - 38;

// Plane
const PLANE_SCREEN_X = 155; // fixed horizontal screen position
const PLANE_SPEED = 3.2;    // world px/frame (~30s run at 60fps)
const GRAVITY = 0.30;
const THRUST = 0.54;        // deceleration when holding UP
const VY_MAX_UP = -5;
const VY_MAX_DOWN = 6;
const PLANE_MIN_Y = 32;
const PLANE_MAX_Y = GROUND_Y - 22;

// Bombs
const MAX_BOMBS = 8; // 7 total HP in buildings + 1 spare
const BOMB_GRAVITY = 0.40;
const WIND = 0.58; // rightward px/frame force on bombs

const BCOLORS: Record<string, string> = {
  FORTRESS: '#a855f7',
  ARMORY: '#f43f5e',
  BANNER: '#22d3ee',
};
const BICONS: Record<string, string> = { FORTRESS: '🏰', ARMORY: '⚔️', BANNER: '🚩' };
const BPOINTS: Record<string, number> = { FORTRESS: 100, ARMORY: 60, BANNER: 40 };
const BHIT_POINTS: Record<string, number> = { FORTRESS: 40, ARMORY: 25, BANNER: 15 };

interface Building {
  worldX: number;
  w: number;
  h: number;
  type: 'FORTRESS' | 'ARMORY' | 'BANNER';
  hp: number;
  destroyed: boolean;
}

interface Bomb {
  worldX: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  exploding: boolean;
  explodeR: number;
  explodeWorldX: number;
  explodeY: number;
}

interface WindStreak {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

// 5 buildings, total HP = 2+1+2+1+1 = 7  → 8 bombs (one spare)
function makeBuildings(): Building[] {
  return [
    { worldX: 620,  w: 90, h: 90, type: 'FORTRESS', hp: 2, destroyed: false },
    { worldX: 1280, w: 70, h: 75, type: 'ARMORY',   hp: 1, destroyed: false },
    { worldX: 2080, w: 85, h: 85, type: 'FORTRESS', hp: 2, destroyed: false },
    { worldX: 2980, w: 60, h: 65, type: 'BANNER',   hp: 1, destroyed: false },
    { worldX: 3820, w: 75, h: 75, type: 'ARMORY',   hp: 1, destroyed: false },
  ];
}

// Deterministic wind streaks (no Math.random so they don't change on re-render)
function makeStreaks(): WindStreak[] {
  return Array.from({ length: 24 }, (_, i) => ({
    x: (i * 151 + 23) % W,
    y: 28 + ((i * 67 + 11) % (GROUND_Y - 55)),
    len: 13 + ((i * 31) % 22),
    speed: 2.6 + ((i * 19) % 18) / 10,
    alpha: 0.06 + ((i * 13) % 14) / 120,
  }));
}

function drawPlane(ctx: CanvasRenderingContext2D, sx: number, sy: number, vy: number) {
  ctx.save();
  ctx.translate(sx, sy);
  // Tilt nose up when climbing, down when diving
  const tilt = Math.max(-0.30, Math.min(0.30, vy * 0.058));
  ctx.rotate(tilt);

  // Drop shadow
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(3, 9, 26, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Main wing (lower)
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.moveTo(-5, 6);
  ctx.lineTo(14, 6);
  ctx.lineTo(5, 25);
  ctx.lineTo(-16, 25);
  ctx.closePath();
  ctx.fill();

  // Wing top highlight
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.moveTo(-4, 6);
  ctx.lineTo(12, 6);
  ctx.lineTo(4, 16);
  ctx.lineTo(-11, 16);
  ctx.closePath();
  ctx.fill();

  // Fuselage (dark base)
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.ellipse(4, 0, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fuselage (mid)
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.ellipse(4, -0.5, 22, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fuselage top highlight
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.ellipse(5, -1.5, 18, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose cone
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.moveTo(22, -2.5);
  ctx.lineTo(39, 0.5);
  ctx.lineTo(22, 5);
  ctx.closePath();
  ctx.fill();

  // Vertical tail fin
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.moveTo(-20, -1);
  ctx.lineTo(-10, -1);
  ctx.lineTo(-15, -15);
  ctx.closePath();
  ctx.fill();

  // Horizontal tail fin
  ctx.beginPath();
  ctx.moveTo(-22, 2);
  ctx.lineTo(-10, 2);
  ctx.lineTo(-15, 10);
  ctx.lineTo(-24, 10);
  ctx.closePath();
  ctx.fill();

  // Cockpit glass
  ctx.fillStyle = '#93c5fd';
  ctx.beginPath();
  ctx.ellipse(12, -3, 7.5, 4.5, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eff6ff';
  ctx.beginPath();
  ctx.ellipse(11, -4.5, 4, 2.5, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Engine nacelle
  ctx.fillStyle = '#1e40af';
  ctx.beginPath();
  ctx.ellipse(2, 9, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Exhaust glow
  ctx.fillStyle = '#f97316';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(-5, 9, 3.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.40;
  ctx.beginPath();
  ctx.ellipse(-9, 9, 5.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

interface BombDropGameProps {
  isPractice: boolean;
  onComplete: (result: { score: number; hits: number }) => void;
  onClose: () => void;
}

export function BombDropGame({ isPractice, onComplete }: BombDropGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // All mutable game state in refs (avoids stale closures, no re-render per frame)
  const worldXRef   = useRef(0);
  const planeYRef   = useRef(H / 2.8);
  const vyRef       = useRef(0);
  const bombsRef    = useRef<Bomb[]>([]);
  const bombsLeftRef = useRef(MAX_BOMBS);
  const buildingsRef = useRef<Building[]>(makeBuildings());
  const scoreRef    = useRef(0);
  const hitsRef     = useRef(0);
  const overRef     = useRef(false);
  const streaksRef  = useRef<WindStreak[]>(makeStreaks());

  // Input edge detection
  const upHeldRef    = useRef(false);
  const spaceEdgeRef = useRef(false);

  const rafRef = useRef<number>(0);

  const [display, setDisplay] = useState({ score: 0, bombsLeft: MAX_BOMBS, hits: 0 });
  const [over, setOver] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Keyboard listeners
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === ' ') e.preventDefault();
      if (e.key === 'ArrowUp') upHeldRef.current = true;
      if (e.key === ' ' && !e.repeat) spaceEdgeRef.current = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') upHeldRef.current = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const dropBomb = () => {
      if (bombsLeftRef.current <= 0 || overRef.current) return;
      bombsRef.current.push({
        worldX: worldXRef.current + 10,
        y: planeYRef.current + 20,
        vx: PLANE_SPEED,
        vy: 1.0,
        active: true,
        exploding: false,
        explodeR: 0,
        explodeWorldX: worldXRef.current + 10,
        explodeY: planeYRef.current + 20,
      });
      bombsLeftRef.current -= 1;
      setDisplay(d => ({ ...d, bombsLeft: bombsLeftRef.current }));
    };

    // Expose dropBomb so click handler can call it
    (canvas as HTMLCanvasElement & { _dropBomb?: () => void })._dropBomb = dropBomb;

    const loop = () => {
      if (overRef.current) return;

      // --- INPUT ---
      if (upHeldRef.current) vyRef.current -= THRUST;
      if (spaceEdgeRef.current) {
        spaceEdgeRef.current = false;
        dropBomb();
      }

      // --- PHYSICS ---
      vyRef.current += GRAVITY;
      vyRef.current = Math.max(VY_MAX_UP, Math.min(VY_MAX_DOWN, vyRef.current));
      planeYRef.current += vyRef.current;
      // Clamp to ceiling/ground and dampen bounce
      if (planeYRef.current < PLANE_MIN_Y) {
        planeYRef.current = PLANE_MIN_Y;
        vyRef.current = Math.abs(vyRef.current) * 0.2;
      }
      if (planeYRef.current > PLANE_MAX_Y) {
        planeYRef.current = PLANE_MAX_Y;
        vyRef.current = -Math.abs(vyRef.current) * 0.2;
      }

      worldXRef.current += PLANE_SPEED;
      const camX = worldXRef.current - PLANE_SCREEN_X;
      const progress = Math.min(1, worldXRef.current / WORLD_W);

      // --- UPDATE ACTIVE BOMBS ---
      for (const bomb of bombsRef.current) {
        if (!bomb.active) continue;
        bomb.worldX += bomb.vx + WIND;
        bomb.y += bomb.vy;
        bomb.vy += BOMB_GRAVITY;

        // Building collision
        for (const b of buildingsRef.current) {
          if (b.destroyed || !bomb.active) continue;
          const bTop = GROUND_Y - b.h;
          if (
            bomb.worldX >= b.worldX &&
            bomb.worldX <= b.worldX + b.w &&
            bomb.y >= bTop &&
            bomb.y <= GROUND_Y
          ) {
            bomb.active = false;
            bomb.exploding = true;
            bomb.explodeWorldX = b.worldX + b.w / 2;
            bomb.explodeY = bTop + b.h * 0.4;
            b.hp -= 1;
            hitsRef.current += 1;
            const pts = b.hp <= 0 ? BPOINTS[b.type] : BHIT_POINTS[b.type];
            scoreRef.current += pts;
            if (b.hp <= 0) b.destroyed = true;
            setDisplay(d => ({ ...d, score: scoreRef.current, hits: hitsRef.current }));
            break;
          }
        }

        if (!bomb.active) continue;
        // Off-world culling
        const bsx = bomb.worldX - camX;
        if (bomb.y > GROUND_Y + 20 || bsx < -80 || bsx > W + 80) {
          bomb.active = false;
        }
      }

      // --- UPDATE EXPLOSIONS ---
      for (const bomb of bombsRef.current) {
        if (!bomb.exploding) continue;
        bomb.explodeR += 3.8;
        if (bomb.explodeR >= 34) bomb.exploding = false;
      }

      // --- END CONDITION ---
      const allSettled = bombsLeftRef.current <= 0 && bombsRef.current.every(b => !b.active && !b.exploding);
      const reachedEnd = worldXRef.current > WORLD_W;
      if (allSettled || reachedEnd) {
        overRef.current = true;
        // Draw final frame then stop
      }

      // --- DRAW ---
      ctx.clearRect(0, 0, W, H);

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#030a18');
      sky.addColorStop(0.55, '#0b1628');
      sky.addColorStop(1, '#0e1f3e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Stars (deterministic, fixed on screen)
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 48; i++) {
        ctx.fillRect((i * 151 + 23) % W, (i * 67 + 11) % (H * 0.48), 1, 1);
      }

      // Distant mountains — slow parallax (8% of camera)
      const p1 = camX * 0.08;
      ctx.fillStyle = 'rgba(10,22,55,0.95)';
      for (let i = -1; i < 7; i++) {
        const mx = i * 210 - (p1 % 210);
        const mh = 34 + (((i + 10) * 31) % 28);
        ctx.beginPath();
        ctx.moveTo(mx, GROUND_Y);
        ctx.lineTo(mx + 65, GROUND_Y - mh);
        ctx.lineTo(mx + 105, GROUND_Y - mh * 0.55);
        ctx.lineTo(mx + 210, GROUND_Y);
        ctx.closePath();
        ctx.fill();
      }

      // Wind streaks (move left→right, wrap)
      ctx.lineWidth = 0.8;
      for (const s of streaksRef.current) {
        s.x += s.speed;
        if (s.x > W + s.len) s.x = -s.len;
        ctx.globalAlpha = s.alpha;
        ctx.strokeStyle = '#bae6fd';
        ctx.beginPath();
        ctx.moveTo(s.x - s.len, s.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;

      // Ground
      const gGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
      gGrad.addColorStop(0, '#374151');
      gGrad.addColorStop(1, '#111827');
      ctx.fillStyle = gGrad;
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      // Ground edge lines
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(0, GROUND_Y - 2, W, 2);
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(0, GROUND_Y - 4, W, 2);

      // Distance markers every 500m
      for (let km = 0; km <= WORLD_W; km += 500) {
        const sx = km - camX;
        if (sx < -4 || sx > W + 4) continue;
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(sx, GROUND_Y, 1, 8);
        if (km % 1000 === 0 && km > 0) {
          ctx.fillStyle = 'rgba(156,163,175,0.45)';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(`${km / 1000}km`, sx, GROUND_Y + 10);
        }
      }

      // Buildings
      for (const b of buildingsRef.current) {
        const bsx = b.worldX - camX;
        if (bsx < -b.w - 4 || bsx > W + 4) continue;
        const bTop = GROUND_Y - b.h;

        if (b.destroyed) {
          // Rubble
          ctx.fillStyle = '#374151';
          ctx.fillRect(bsx + 7, GROUND_Y - 13, b.w - 14, 13);
          // Smoke puffs
          ctx.globalAlpha = 0.32;
          ctx.fillStyle = '#9ca3af';
          ctx.beginPath();
          ctx.arc(bsx + b.w * 0.35, GROUND_Y - 20, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(bsx + b.w * 0.65, GROUND_Y - 26, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }

        ctx.fillStyle = BCOLORS[b.type];
        ctx.globalAlpha = b.hp < 2 ? 0.62 : 1;
        ctx.fillRect(bsx, bTop, b.w, b.h);

        // Damage crack on hit FORTRESS
        if (b.type === 'FORTRESS' && b.hp === 1) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(0,0,0,0.28)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bsx + b.w * 0.28, bTop + 4);
          ctx.lineTo(bsx + b.w * 0.44, bTop + b.h * 0.38);
          ctx.lineTo(bsx + b.w * 0.36, bTop + b.h * 0.68);
          ctx.stroke();
          ctx.lineWidth = 1;
        }

        // Door
        ctx.fillStyle = 'rgba(0,0,0,0.40)';
        ctx.globalAlpha = 1;
        ctx.fillRect(bsx + b.w / 2 - 7, GROUND_Y - 20, 14, 20);

        // Icon
        ctx.font = `${Math.min(b.w, b.h) * 0.40}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(BICONS[b.type], bsx + b.w / 2, bTop + b.h * 0.42);

        // HP bar for 2-HP buildings
        if (b.hp === 2) {
          ctx.fillStyle = '#111827';
          ctx.fillRect(bsx, bTop - 8, b.w, 5);
          ctx.fillStyle = '#10b981';
          ctx.fillRect(bsx + 1, bTop - 7, (b.w - 2) * 0.5, 3);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(bsx + 1 + (b.w - 2) * 0.5, bTop - 7, (b.w - 2) * 0.5, 3);
        }
      }

      // Bombs
      for (const bomb of bombsRef.current) {
        if (!bomb.active && !bomb.exploding) continue;

        if (bomb.exploding) {
          const ex = bomb.explodeWorldX - camX;
          const ey = bomb.explodeY;
          const alpha = Math.max(0, 1 - bomb.explodeR / 34);
          ctx.globalAlpha = alpha;
          const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, bomb.explodeR);
          g.addColorStop(0, '#fffbeb');
          g.addColorStop(0.22, '#fbbf24');
          g.addColorStop(0.55, '#f97316');
          g.addColorStop(1, 'rgba(239,68,68,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(ex, ey, bomb.explodeR, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }

        const bsx = bomb.worldX - camX;
        // Bomb silhouette
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.ellipse(bsx, bomb.y + 1, 4.5, 7, 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.ellipse(bsx, bomb.y, 4, 6.5, 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.ellipse(bsx - 1, bomb.y - 1.5, 1.5, 2, 0.28, 0, Math.PI * 2);
        ctx.fill();
        // Tail fin
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.moveTo(bsx - 3, bomb.y - 5.5);
        ctx.lineTo(bsx - 7, bomb.y - 10);
        ctx.lineTo(bsx + 1, bomb.y - 5.5);
        ctx.fill();
      }

      // Plane (always at PLANE_SCREEN_X)
      drawPlane(ctx, PLANE_SCREEN_X, planeYRef.current, vyRef.current);

      // === HUD ===
      // Top strip
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, 27);

      // Bomb count icons
      for (let i = 0; i < MAX_BOMBS; i++) {
        ctx.fillStyle = i < bombsLeftRef.current ? '#f97316' : '#374151';
        ctx.beginPath();
        ctx.ellipse(10 + i * 16, 13.5, 4, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Score
      ctx.fillStyle = 'rgba(255,255,255,0.90)';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${scoreRef.current} pts`, W / 2, 13.5);

      // Wind indicator
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#7dd3fc';
      ctx.fillText('Vent \u2192', W - 8, 13.5);

      // Progress bar (bottom edge)
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(0, H - 5, W, 5);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, H - 5, W * progress, 5);

      if (!overRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        setOver(true);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Click to drop bomb (delegates to the exposed fn on canvas)
  const handleCanvasClick = () => {
    const canvas = canvasRef.current as (HTMLCanvasElement & { _dropBomb?: () => void }) | null;
    canvas?._dropBomb?.();
  };

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    onComplete({ score: scoreRef.current, hits: hitsRef.current });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {t('bombdrop_bombs_label')} <span className="font-semibold text-orange-400">{display.bombsLeft}/{MAX_BOMBS}</span>
        </span>
        <span className="font-semibold text-primary">{t('bombdrop_score_label')}: {display.score}</span>
        <span className="text-muted-foreground">{t('bombdrop_hits_label')}: {display.hits}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full cursor-crosshair rounded-xl border border-border/50"
        onClick={handleCanvasClick}
      />
      {over ? (
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center space-y-2">
          <div className="text-base font-semibold">
            {display.hits > 0 ? `${t('bombdrop_mission_ended_prefix')} ${display.hits} ${t('bombdrop_hits_plural')}` : t('bombdrop_no_building_hit')}
          </div>
          <div className="text-2xl font-bold text-primary">{display.score} {t('bombdrop_points')}</div>
          {!isPractice ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitted}
              className="rounded-xl bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {t('bombdrop_submit')}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">{t('bombdrop_practice_note')}</p>
          )}
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">{t('bombdrop_controls_hint')}</p>
      )}
    </div>
  );
}
