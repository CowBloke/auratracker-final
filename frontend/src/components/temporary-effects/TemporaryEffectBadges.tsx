import { Clock3, ShieldOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

const isAdblockEffect = (effect: YouTemporaryEffect) =>
  effect.key === 'YOU_ADBLOCK' || effect.key === 'GLOBAL_ADBLOCK';

export function TemporaryEffectBadges({
  effects,
  nowTs,
}: {
  effects: YouTemporaryEffect[];
  nowTs: number;
}) {
  const activeEffects = effects.filter((effect) => new Date(effect.expiresAt).getTime() > nowTs);

  if (activeEffects.length === 0) {
    return null;
  }

  return (
    <>
      {activeEffects.map((effect) => {
        const Icon = isAdblockEffect(effect) ? ShieldOff : Clock3;
        const typeLabel = isAdblockEffect(effect) ? 'Adblock global' : effect.key;

        return (
          <Tooltip key={`${effect.key}-${effect.expiresAt}`}>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1" aria-label={effect.label}>
                <Icon />
                <span className="tabular-nums">{formatRemaining(effect.expiresAt, nowTs)}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {effect.label} · {typeLabel}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );
}
