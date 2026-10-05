import { useEffect, useRef } from 'react';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

/** Aperçu canvas d'un skin Doodle Jump (illustration du jeu, pas de l'interface). */
const DJ_COLORS = {
  background: '#0a0a0a',
  platformNormal: '#e5e7eb',
  platformBounce: '#7c3aed',
  platformMoving: '#9ca3af',
};
const PW = 80;
const PH = 15;

function drawPlatform(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const r = 5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + PW - r, y);
  ctx.arcTo(x + PW, y, x + PW, y + PH, r);
  ctx.lineTo(x + PW, y + PH);
  ctx.arcTo(x + PW, y + PH, x, y + PH, r);
  ctx.lineTo(x + r, y + PH);
  ctx.arcTo(x, y + PH, x, y, r);
  ctx.arcTo(x, y, x + PW, y, r);
  ctx.closePath();
  ctx.fill();
}

export function DoodleJumpSkinPreview({ skinImageUrl, className, height = '180px' }: { skinImageUrl: string; className?: string; height?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const CW = 400;
  const CH = 220;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const draw = (skinImg: HTMLImageElement | null) => {
      ctx.fillStyle = DJ_COLORS.background;
      ctx.fillRect(0, 0, CW, CH);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CW; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
      }

      const platY1 = CH - 28;
      const platY2 = CH - 90;
      const platY3 = CH - 152;
      const p1x = 40;
      const p2x = CW / 2 - PW / 2;
      const p3x = CW - 40 - PW;

      drawPlatform(ctx, p1x, platY1, DJ_COLORS.platformNormal);
      drawPlatform(ctx, p2x, platY2, DJ_COLORS.platformBounce);
      drawPlatform(ctx, p3x, platY3, DJ_COLORS.platformMoving);

      // Jump arc
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const arcStartX = p2x + PW / 2;
      const arcEndX = p3x + PW / 2;
      ctx.moveTo(arcStartX, platY2);
      ctx.quadraticCurveTo((arcStartX + arcEndX) / 2, Math.min(platY2, platY3) - 50, arcEndX, platY3);
      ctx.stroke();
      ctx.setLineDash([]);

      // Character
      const charSize = 70;
      const charX = p2x + PW / 2 - charSize / 2;
      const charY = platY2 - charSize;
      if (skinImg && skinImg.complete && skinImg.naturalWidth > 0) {
        ctx.drawImage(skinImg, charX, charY, charSize, charSize);
      } else {
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.arc(p2x + PW / 2, platY2 - charSize / 2, charSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.textAlign = 'right';
      ctx.fillText('Doodle Jump', CW - 12, 18);
      ctx.textAlign = 'left';
    };

    draw(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => draw(img);
    img.src = resolveImageUrl(skinImageUrl);
  }, [skinImageUrl]);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className={cn('block w-full', className)}
      style={{ height }}
    />
  );
}
