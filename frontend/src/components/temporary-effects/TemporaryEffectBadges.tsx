import { Clock3, ShieldOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { YouTemporaryEffect } from '@/services/api';

function formatRemaining(expiresAt: string, nowTs: number) {
  const remainingMs = new Date(expiresAt).getTime() - nowTs;
  if (remainingMs <= 0) return 'Expiré';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function getEffectIcon(effect: YouTemporaryEffect) {
  if (effect.key === 'YOU_ADBLOCK') return ShieldOff;
  return Clock3;
}

function getEffectBadgeClass(effect: YouTemporaryEffect) {
  if (effect.key === 'YOU_ADBLOCK') {
    return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-500';
  }

  return 'border-border/60 bg-background/80 text-foreground';
}

function getEffectTypeLabel(effect: YouTemporaryEffect) {
  if (effect.key === 'YOU_ADBLOCK') {
    return 'Adblock';
  }

  return effect.key;
}

export function TemporaryEffectBadges({
  effects,
  nowTs,
  className,
}: {
  effects: YouTemporaryEffect[];
  nowTs: number;
  className?: string;
}) {
  const activeEffects = effects.filter((effect) => new Date(effect.expiresAt).getTime() > nowTs);

  if (activeEffects.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {activeEffects.map((effect) => {
        const Icon = getEffectIcon(effect);
        const title = `${effect.label} | Type: ${getEffectTypeLabel(effect)} | Restant: ${formatRemaining(effect.expiresAt, nowTs)}`;

        return (
          <Badge
            key={`${effect.key}-${effect.expiresAt}`}
            variant="outline"
            title={title}
            aria-label={title}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full p-0 shadow-sm',
              getEffectBadgeClass(effect)
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
          </Badge>
        );
      })}
    </div>
  );
}