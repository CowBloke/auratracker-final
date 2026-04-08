import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ClanWarNavalShot } from '@/services/api';
import { t } from '@/lib/i18n';

const GRID = 6;

const BUILDING_ICONS: Record<string, string> = { FORTRESS: '🏰', ARMORY: '⚔️', BANNER: '🚩' };

interface NavalWarfareGameProps {
  boardId: string | null;
  shotsRemaining: number;
  shots: ClanWarNavalShot[];
  enemyClanName: string;
  onShoot: (x: number, y: number) => Promise<{ isHit: boolean; building: string | null; points: number }>;
}

export function NavalWarfareGame({
  shotsRemaining: initialShotsRemaining,
  shots: initialShots,
  enemyClanName,
  onShoot,
}: NavalWarfareGameProps) {
  const [shots, setShots] = useState<ClanWarNavalShot[]>(initialShots);
  const [shotsRemaining, setShotsRemaining] = useState(initialShotsRemaining);
  const [firing, setFiring] = useState(false);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [lastResult, setLastResult] = useState<{ isHit: boolean; building: string | null; points: number } | null>(null);

  const getCell = (x: number, y: number) => shots.find((s) => s.x === x && s.y === y) ?? null;

  const fire = async (x: number, y: number) => {
    if (firing || shotsRemaining <= 0) return;
    if (shots.some((s) => s.x === x && s.y === y)) return;

    setFiring(true);
    setPending({ x, y });
    try {
      const result = await onShoot(x, y);
      setLastResult(result);
      setShots((prev) => [
        ...prev,
        { x, y, isHit: result.isHit, building: result.building, points: result.points, isOwnShot: true },
      ]);
      setShotsRemaining((n) => Math.max(0, n - 1));
    } catch {
      // ignore — toast shown by parent
    } finally {
      setFiring(false);
      setPending(null);
    }
  };

  const hitCount = shots.filter((s) => s.isHit).length;
  const totalPoints = shots.filter((s) => s.isOwnShot).reduce((a, s) => a + s.points, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-2 text-sm">
        <div className="text-muted-foreground">
          Cible: <span className="font-semibold text-foreground">{enemyClanName}</span>
        </div>
        <div className="flex gap-4">
          <span>
            Tirs:{' '}
            <span className={cn('font-bold', shotsRemaining === 0 ? 'text-rose-400' : 'text-sky-400')}>
              {shotsRemaining}
            </span>{' '}
            restant(s)
          </span>
          <span className="text-muted-foreground">
            Touche(s): <span className="font-semibold text-orange-400">{hitCount}</span>
          </span>
          {totalPoints > 0 && (
            <span className="text-muted-foreground">
              +<span className="font-semibold text-primary">{totalPoints} pts</span>
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="relative">
        {/* Column labels */}
        <div className="mb-1 flex pl-7">
          {Array.from({ length: GRID }, (_, x) => (
            <div key={x} className="flex-1 text-center text-xs text-muted-foreground font-mono">
              {String.fromCharCode(65 + x)}
            </div>
          ))}
        </div>
        <div className="flex">
          {/* Row labels */}
          <div className="flex flex-col justify-around pr-1 w-6">
            {Array.from({ length: GRID }, (_, y) => (
              <div key={y} className="text-xs text-muted-foreground font-mono text-right leading-none" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {y + 1}
              </div>
            ))}
          </div>
          {/* Cells */}
          <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}>
            {Array.from({ length: GRID }, (_, y) =>
              Array.from({ length: GRID }, (_, x) => {
                const shot = getCell(x, y);
                const isPend = pending?.x === x && pending?.y === y;
                const canFire = !shot && shotsRemaining > 0 && !firing;

                return (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    onClick={() => fire(x, y)}
                    disabled={!!shot || shotsRemaining <= 0 || firing}
                    className={cn(
                      'aspect-square rounded-lg border-2 text-base transition-all duration-150 select-none',
                      shot
                        ? shot.isHit
                          ? 'border-orange-500/60 bg-orange-500/20 cursor-default'
                          : 'border-sky-900/40 bg-sky-950/50 cursor-default'
                        : canFire
                          ? 'border-border/40 bg-slate-800/50 hover:bg-slate-700/60 hover:border-sky-500/50 cursor-crosshair hover:scale-105'
                          : 'border-border/20 bg-slate-900/30 cursor-not-allowed opacity-40',
                      isPend && 'animate-pulse border-primary/60 bg-primary/10'
                    )}
                  >
                    {shot
                      ? shot.isHit
                        ? (BUILDING_ICONS[shot.building ?? ''] ?? '💥')
                        : '💧'
                      : isPend
                        ? '🎯'
                        : ''}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Last result */}
      {lastResult && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm font-medium transition-all',
            lastResult.isHit
              ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
              : 'border-sky-900/40 bg-sky-950/30 text-sky-400'
          )}
        >
          {lastResult.isHit
            ? `${t('naval_hit_prefix')} ${BUILDING_ICONS[lastResult.building ?? '']} ${lastResult.building ?? t('naval_building_generic')} +${lastResult.points} ${t('naval_war_points')}`
            : t('naval_miss_message')}
        </div>
      )}

      {/* Team shots summary */}
      {shots.filter((s) => !s.isOwnShot).length > 0 && (
        <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-2 text-xs text-muted-foreground">
          {shots.filter((s) => !s.isOwnShot && s.isHit).length} {t('naval_team_hits_suffix')}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{t('naval_legend_hit')}</span>
        <span>{t('naval_legend_miss')}</span>
        <span className="text-muted-foreground/60">{t('naval_legend_buildings')}</span>
      </div>

      {shotsRemaining <= 0 && (
        <div className="rounded-xl border border-border/40 bg-muted/15 p-3 text-center text-sm text-muted-foreground">
          {t('naval_no_shots_remaining')}
        </div>
      )}
    </div>
  );
}
