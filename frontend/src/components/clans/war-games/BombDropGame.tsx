import { useEffect, useRef, useState } from 'react';

const W = 580;
const H = 380;
const PLANE_Y = 55;
const PLANE_SPEED = 2.2;
const BOMB_GRAVITY = 0.35;
const MAX_BOMBS = 8;

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'FORTRESS' | 'ARMORY' | 'BANNER';
  hp: number;
  destroyed: boolean;
}

interface Bomb {
  x: number;
  y: number;
  vy: number;
  active: boolean;
  exploding: boolean;
  explodeR: number;
}

interface GameState {
  planeX: number;
  planeDir: number;
  bombs: Bomb[];
  bombsLeft: number;
  buildings: Building[];
  score: number;
  hits: number;
  over: boolean;
}

const BCOLORS: Record<string, string> = {
  FORTRESS: '#a855f7',
  ARMORY: '#f43f5e',
  BANNER: '#22d3ee',
};

const BICONS: Record<string, string> = {
  FORTRESS: '🏰',
  ARMORY: '⚔️',
  BANNER: '🚩',
};

const BPOINTS: Record<string, number> = { FORTRESS: 100, ARMORY: 60, BANNER: 40 };
const BHIT_POINTS: Record<string, number> = { FORTRESS: 40, ARMORY: 25, BANNER: 15 };

function initBuildings(): Building[] {
  return [
    { x: 30, y: 290, w: 90, h: 90, type: 'FORTRESS', hp: 2, destroyed: false },
    { x: 160, y: 305, w: 70, h: 75, type: 'ARMORY', hp: 1, destroyed: false },
    { x: 265, y: 295, w: 85, h: 85, type: 'FORTRESS', hp: 2, destroyed: false },
    { x: 380, y: 315, w: 60, h: 65, type: 'BANNER', hp: 1, destroyed: false },
    { x: 465, y: 305, w: 75, h: 75, type: 'ARMORY', hp: 1, destroyed: false },
  ];
}

interface BombDropGameProps {
  isPractice: boolean;
  onComplete: (result: { score: number; hits: number }) => void;
  onClose: () => void;
}

export function BombDropGame({ isPractice, onComplete }: BombDropGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>({
    planeX: 0,
    planeDir: 1,
    bombs: [],
    bombsLeft: MAX_BOMBS,
    buildings: initBuildings(),
    score: 0,
    hits: 0,
    over: false,
  });
  const rafRef = useRef<number>(0);
  const [display, setDisplay] = useState({ score: 0, bombsLeft: MAX_BOMBS, hits: 0 });
  const [over, setOver] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current;

    const draw = () => {
      if (s.over) return;

      ctx.clearRect(0, 0, W, H);

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0f172a');
      sky.addColorStop(1, '#1e293b');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 30; i++) {
        // deterministic pseudo-stars
        const sx = ((i * 137 + 17) % W);
        const sy = ((i * 59 + 31) % (H / 2));
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Ground
      ctx.fillStyle = '#374151';
      ctx.fillRect(0, H - 30, W, 30);
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(0, H - 32, W, 2);

      // Buildings
      for (const b of s.buildings) {
        if (b.destroyed) {
          // rubble
          ctx.fillStyle = '#4b5563';
          ctx.fillRect(b.x + 4, H - 32, b.w - 8, 8);
          continue;
        }
        ctx.fillStyle = BCOLORS[b.type];
        ctx.globalAlpha = b.hp === 2 ? 1 : 0.65;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        // door
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h - 20, 16, 20);
        ctx.globalAlpha = 1;

        // icon
        ctx.font = `${Math.min(b.w, b.h) * 0.45}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(BICONS[b.type], b.x + b.w / 2, b.y + b.h / 2 - 4);

        // HP bar
        if (b.hp === 2) {
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(b.x, b.y - 7, b.w, 4);
          ctx.fillStyle = '#10b981';
          ctx.fillRect(b.x, b.y - 7, b.w / 2, 4);
          ctx.fillStyle = '#f97316';
          ctx.fillRect(b.x + b.w / 2, b.y - 7, b.w / 2, 4);
        }
      }

      // Bombs
      for (const bomb of s.bombs) {
        if (!bomb.active && !bomb.exploding) continue;
        if (bomb.exploding) {
          const alpha = Math.max(0, 1 - bomb.explodeR / 28);
          ctx.globalAlpha = alpha;
          const g = ctx.createRadialGradient(bomb.x, bomb.y, 0, bomb.x, bomb.y, bomb.explodeR);
          g.addColorStop(0, '#fbbf24');
          g.addColorStop(0.5, '#f97316');
          g.addColorStop(1, 'rgba(239,68,68,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(bomb.x, bomb.y, bomb.explodeR, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          bomb.explodeR += 3;
          if (bomb.explodeR >= 28) bomb.exploding = false;
          continue;
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(bomb.x, bomb.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(bomb.x - 1.5, bomb.y - 1.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Plane
      ctx.globalAlpha = 1;
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.planeDir > 0 ? '✈️' : '🛩️', s.planeX, PLANE_Y);

      // Bombs left HUD
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (let i = 0; i < MAX_BOMBS; i++) {
        ctx.fillStyle = i < s.bombsLeft ? '#fb923c' : '#374151';
        ctx.beginPath();
        ctx.arc(12 + i * 14, 12, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Score HUD
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${s.score} pts`, W - 10, 10);

      // Update plane
      s.planeX += PLANE_SPEED * s.planeDir;
      if (s.planeX > W + 20) { s.planeX = W + 20; s.planeDir = -1; }
      if (s.planeX < -20) { s.planeX = -20; s.planeDir = 1; }

      // Update bombs
      for (const bomb of s.bombs) {
        if (!bomb.active) continue;
        bomb.y += bomb.vy;
        bomb.vy += BOMB_GRAVITY;

        // Building collision
        for (const b of s.buildings) {
          if (b.destroyed || !bomb.active) continue;
          if (bomb.x >= b.x && bomb.x <= b.x + b.w && bomb.y >= b.y && bomb.y <= b.y + b.h) {
            bomb.active = false;
            bomb.exploding = true;
            b.hp -= 1;
            s.hits += 1;
            const pts = b.hp <= 0 ? BPOINTS[b.type] : BHIT_POINTS[b.type];
            s.score += pts;
            if (b.hp <= 0) b.destroyed = true;
            setDisplay({ score: s.score, bombsLeft: s.bombsLeft, hits: s.hits });
            break;
          }
        }

        if (!bomb.active) continue;
        if (bomb.y > H || bomb.x < -20 || bomb.x > W + 20) {
          bomb.active = false;
        }
      }

      // Check game over
      if (s.bombsLeft <= 0 && s.bombs.every((b) => !b.active && !b.exploding)) {
        s.over = true;
        setOver(true);
        return;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const dropBomb = () => {
    const s = stateRef.current;
    if (s.bombsLeft <= 0 || s.over) return;
    s.bombs.push({ x: s.planeX, y: PLANE_Y + 14, vy: 2, active: true, exploding: false, explodeR: 0 });
    s.bombsLeft -= 1;
    setDisplay((d) => ({ ...d, bombsLeft: s.bombsLeft }));
  };

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    onComplete({ score: stateRef.current.score, hits: stateRef.current.hits });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Bombes: <span className="font-semibold text-orange-400">{display.bombsLeft}/{MAX_BOMBS}</span>
        </span>
        <span className="font-semibold text-primary">Score: {display.score}</span>
        <span className="text-muted-foreground">Touches: {display.hits}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full cursor-crosshair rounded-xl border border-border/50"
        onClick={dropBomb}
        style={{ imageRendering: 'pixelated' }}
      />
      {over ? (
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center space-y-2">
          <div className="text-base font-semibold">
            {display.hits > 0 ? `💥 Mission accomplie ! ${display.hits} touche(s)` : '🎯 Aucun bâtiment touché'}
          </div>
          <div className="text-2xl font-bold text-primary">{display.score} pts</div>
          {!isPractice ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitted}
              className="rounded-xl bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              Valider l'attaque
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">Mode entraînement — aucun point enregistré.</p>
          )}
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Cliquez sur le terrain pour larguer une bombe · {display.bombsLeft} bombe(s) restante(s)
        </p>
      )}
    </div>
  );
}
