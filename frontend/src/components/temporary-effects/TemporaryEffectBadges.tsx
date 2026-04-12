import { Clock3, ShieldOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
    <TooltipProvider delayDuration={100}>
      <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
        {activeEffects.map((effect) => {
          const Icon = getEffectIcon(effect);

          return (
            <Tooltip key={`${effect.key}-${effect.expiresAt}`}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full p-0 shadow-sm',
                    getEffectBadgeClass(effect)
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-64 space-y-1.5 text-center">
                <p className="font-medium">{effect.label}</p>
                <p className="text-xs text-muted-foreground">Type : {getEffectTypeLabel(effect)}</p>
                <p className="text-xs text-muted-foreground/80">Restant : {formatRemaining(effect.expiresAt, nowTs)}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}