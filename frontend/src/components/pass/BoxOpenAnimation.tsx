import { useEffect, useState } from 'react';
import { Gem, Gift, Wallet, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { resolveImageUrl } from '@/lib/images';
import type { PassRewardEntry } from '@/services/api';

interface BoxOpenAnimationProps {
  open: boolean;
  rewards: PassRewardEntry[] | null;
  onClose: () => void;
}

type Phase = 'entering' | 'ready' | 'burst' | 'reveal' | 'done';

const rarityCard: Record<PassRewardEntry['rarity'], string> = {
  common: 'border-white/10 bg-white/5 text-white',
  rare: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  epic: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-100',
  legendary: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
};

const rarityGlow: Record<PassRewardEntry['rarity'], string> = {
  common: '',
  rare: 'shadow-[0_0_24px_rgba(14,165,233,0.35)]',
  epic: 'shadow-[0_0_24px_rgba(217,70,239,0.35)]',
  legendary: 'shadow-[0_0_32px_rgba(245,158,11,0.5)]',
};

export default function BoxOpenAnimation({ open, rewards, onClose }: BoxOpenAnimationProps) {
  const [phase, setPhase] = useState<Phase>('entering');
  const [revealIndex, setRevealIndex] = useState(0);

  // Reset & kick off enter animation when opened
  useEffect(() => {
    if (!open) {
      setPhase('entering');
      setRevealIndex(0);
      return;
    }
    const t = window.setTimeout(() => setPhase('ready'), 1200);
    return () => window.clearTimeout(t);
  }, [open]);

  // Auto-advance to done when all rewards revealed
  useEffect(() => {
    if (phase === 'reveal' && rewards && revealIndex >= rewards.length) {
      const t = window.setTimeout(() => setPhase('done'), 350);
      return () => window.clearTimeout(t);
    }
  }, [phase, rewards, revealIndex]);

  // ESC closes when safe
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (phase === 'done' || phase === 'ready')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  if (!open) return null;

  const canOpen = phase === 'ready' && rewards !== null;

  const handleBoxClick = () => {
    if (!canOpen) return;
    setPhase('burst');
    window.setTimeout(() => {
      setRevealIndex(0);
      setPhase('reveal');
    }, 700);
  };

  const handleOverlayClick = () => {
    if (phase !== 'reveal' || !rewards || revealIndex >= rewards.length) return;
    setRevealIndex((i) => i + 1);
  };

  const remaining = rewards ? Math.max(0, rewards.length - revealIndex) : 0;

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
      onClick={phase === 'reveal' ? handleOverlayClick : undefined}
    >
      {/* ── BOX PHASE ───────────────────────────────────────────────────────── */}
      {(phase === 'entering' || phase === 'ready' || phase === 'burst') && (
        <div className="flex flex-col items-center gap-8">
          {/* Prompt text */}
          <p
            className={cn(
              'text-sm font-medium tracking-[0.26em] uppercase transition-opacity duration-500',
              phase === 'entering' && 'opacity-0',
              phase === 'ready' && 'opacity-100',
              phase === 'burst' && 'opacity-0',
              canOpen ? 'text-amber-200' : 'text-white/40',
            )}
          >
            {phase === 'ready' && !canOpen ? 'Chargement…' : 'Cliquez pour ouvrir'}
          </p>

          {/* Perspective container */}
          <div
            style={{ perspective: 720, perspectiveOrigin: '50% 38%', width: 280, height: 280, position: 'relative' }}
            className={cn(canOpen ? 'cursor-pointer' : 'cursor-default')}
            onClick={handleBoxClick}
          >
            {/* Animation wrapper */}
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center',
                phase === 'entering' && 'animate-box-fall',
                phase === 'ready' && 'animate-box-float',
                phase === 'burst' && 'animate-box-burst',
              )}
            >
              {/* Ground shadow / glow */}
              <div
                className={cn(
                  'absolute bottom-8 left-1/2 h-5 w-44 rounded-full blur-2xl',
                  canOpen ? 'animate-box-glow' : 'bg-black/30',
                  phase === 'burst' && 'opacity-0',
                )}
              />

              {/* CSS 3D Cube — 150×150×150 */}
              <div
                style={{
                  transformStyle: 'preserve-3d',
                  transform: 'rotateX(-18deg) rotateY(22deg)',
                  width: 150,
                  height: 150,
                  position: 'relative',
                }}
              >
                {/* FRONT */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: 'translateZ(75px)',
                    background: 'linear-gradient(145deg, #fbbf24 0%, #f59e0b 45%, #d97706 100%)',
                    borderRadius: 10,
                    backfaceVisibility: 'hidden',
                    overflow: 'hidden',
                  }}
                >
                  {/* Ribbon H */}
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 20, background: 'rgba(92,40,0,0.55)' }} />
                  {/* Ribbon V */}
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 20, background: 'rgba(92,40,0,0.55)' }} />
                  {canOpen && (
                    <div
                      className="animate-box-overlay absolute inset-0"
                      style={{ background: 'radial-gradient(circle, rgba(255,210,50,0.38) 0%, transparent 65%)' }}
                    />
                  )}
                </div>

                {/* TOP (lid) */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: 'rotateX(-90deg) translateZ(75px)',
                    background: 'linear-gradient(160deg, #fde68a 0%, #fbbf24 55%, #f59e0b 100%)',
                    borderRadius: 10,
                    backfaceVisibility: 'hidden',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 18, background: 'rgba(92,40,0,0.42)' }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 18, background: 'rgba(92,40,0,0.42)' }} />
                  {/* Bow knot */}
                  <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 34, height: 34, borderRadius: '50%', background: '#b45309', boxShadow: '0 0 0 5px rgba(92,40,0,0.35)' }} />
                </div>

                {/* RIGHT */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: 'rotateY(90deg) translateZ(75px)',
                    background: 'linear-gradient(145deg, #b45309 0%, #92400e 100%)',
                    borderRadius: 10,
                    backfaceVisibility: 'hidden',
                  }}
                />

                {/* LEFT */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: 'rotateY(-90deg) translateZ(75px)',
                    background: '#78350f',
                    borderRadius: 10,
                    backfaceVisibility: 'hidden',
                  }}
                />

                {/* BOTTOM */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: 'rotateX(90deg) translateZ(75px)',
                    background: '#713f12',
                    borderRadius: 10,
                    backfaceVisibility: 'hidden',
                  }}
                />

                {/* BACK */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: 'rotateY(180deg) translateZ(75px)',
                    background: '#92400e',
                    borderRadius: 10,
                    backfaceVisibility: 'hidden',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bounce dots when ready */}
          {canOpen && (
            <div className="flex gap-2">
              {([0, 150, 300] as const).map((delay) => (
                <div
                  key={delay}
                  className="h-2 w-2 rounded-full bg-amber-400"
                  style={{ animation: `bounce 1s infinite ${delay}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BURST FLASH ─────────────────────────────────────────────────────── */}
      {phase === 'burst' && (
        <div className="animate-burst-flash pointer-events-none fixed inset-0 bg-amber-300/20" />
      )}

      {/* ── REVEAL PHASE ────────────────────────────────────────────────────── */}
      {(phase === 'reveal' || phase === 'done') && rewards && (
        <div
          className="w-full max-w-xl space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-200">
              {remaining > 0
                ? `${remaining} restant${remaining > 1 ? 's' : ''}`
                : 'Tous révélés !'}
            </p>
            {phase === 'done' && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Cards grid */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Revealed rewards */}
            {rewards.slice(0, revealIndex).map((reward, i) => (
              <div
                key={`r-${i}`}
                className={cn(
                  'animate-reward-in rounded-2xl border p-4',
                  rarityCard[reward.rarity],
                  rarityGlow[reward.rarity],
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="secondary" className="bg-black/20 text-xs text-current">
                    {reward.rarity}
                  </Badge>
                  {reward.type === 'money' ? (
                    <Wallet className="h-4 w-4" />
                  ) : reward.type === 'aura' ? (
                    <Gem className="h-4 w-4" />
                  ) : (
                    <Gift className="h-4 w-4" />
                  )}
                </div>
                {reward.item ? (
                  <div className="space-y-2">
                    {reward.item.imageUrl && (
                      <img
                        src={resolveImageUrl(reward.item.imageUrl)}
                        alt={reward.item.name}
                        className="h-20 w-full rounded-xl object-cover"
                      />
                    )}
                    <div className="text-sm font-semibold">{reward.item.name}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-xl font-bold">{reward.label}</div>
                )}
              </div>
            ))}

            {/* Hidden placeholder cards */}
            {phase === 'reveal' &&
              rewards.slice(revealIndex).map((_, i) => (
                <div
                  key={`h-${i}`}
                  className={cn(
                    'flex h-28 flex-col items-center justify-center rounded-2xl border p-4',
                    i === 0
                      ? 'animate-pulse cursor-pointer border-amber-500/40 bg-amber-500/10'
                      : 'cursor-default border-white/8 bg-white/5',
                  )}
                >
                  <Gift className={cn('h-7 w-7 mb-1', i === 0 ? 'text-amber-400' : 'text-white/15')} />
                  {i === 0 && (
                    <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-amber-300/80">
                      Cliquez
                    </span>
                  )}
                </div>
              ))}
          </div>

          {phase === 'done' && (
            <Button onClick={onClose} className="w-full bg-amber-500 text-black hover:bg-amber-400">
              Fermer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
