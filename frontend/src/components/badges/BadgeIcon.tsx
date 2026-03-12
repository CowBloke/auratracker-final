import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface BadgeData {
  id: string;
  name: string;
  description: string;
  howToObtain?: string | null;
  backgroundType: string; // "solid" | "gradient" | "image"
  backgroundColor: string;
  backgroundGradient?: string | null; // JSON: {"from":"#hex","to":"#hex","direction":"to right"}
  backgroundImage?: string | null;
  icon: string;
  iconColor: string;
  borderColor: string;
  category: string;
  rarity: string;
  obtainedAt?: string | null;
  obtainedReason?: string | null;
}

const RARITY_GLOW: Record<string, string> = {
  legendary: '0 0 6px 1px rgba(234,179,8,0.6)',
  epic:       '0 0 5px 1px rgba(168,85,247,0.5)',
  rare:       '0 0 4px 1px rgba(59,130,246,0.5)',
  uncommon:   '0 0 3px 1px rgba(34,197,94,0.4)',
};

interface BadgeIconProps {
  badge: BadgeData;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
}

const SIZES = {
  xs: { box: 'w-4 h-4', text: 'text-[8px]' },
  sm: { box: 'w-5 h-5', text: 'text-[10px]' },
  md: { box: 'w-6 h-6', text: 'text-xs'     },
  lg: { box: 'w-8 h-8', text: 'text-sm'     },
};

function getBadgeBackground(badge: BadgeData): React.CSSProperties {
  if (badge.backgroundType === 'image' && badge.backgroundImage) {
    return {
      backgroundImage: `url(${badge.backgroundImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  if (badge.backgroundType === 'gradient' && badge.backgroundGradient) {
    try {
      const g = JSON.parse(badge.backgroundGradient) as {
        from: string; to: string; direction: string;
      };
      return { background: `linear-gradient(${g.direction ?? 'to bottom right'}, ${g.from}, ${g.to})` };
    } catch {
      // fall through to solid
    }
  }
  return { backgroundColor: badge.backgroundColor };
}

export function BadgeIcon({ badge, size = 'sm', className, tooltipSide = 'top' }: BadgeIconProps) {
  const { box, text } = SIZES[size];
  const boxShadow = RARITY_GLOW[badge.rarity] ?? undefined;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              box,
              'rounded-sm flex items-center justify-center cursor-help flex-shrink-0 select-none',
              className,
            )}
            style={{
              ...getBadgeBackground(badge),
              border: `1px solid ${badge.borderColor}`,
              boxShadow,
            }}
            aria-label={badge.name}
          >
            <span
              className={cn(text, 'leading-none pointer-events-none')}
              style={{ color: badge.iconColor }}
            >
              {badge.icon}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className="max-w-[220px] space-y-1">
          <p className="font-semibold text-sm">{badge.name}</p>
          <p className="text-xs text-muted-foreground">{badge.description}</p>
          {badge.howToObtain && (
            <p className="text-xs text-muted-foreground/70 italic">{badge.howToObtain}</p>
          )}
          {badge.obtainedAt && (
            <p className="text-[10px] text-muted-foreground/50">
              Obtenu le {new Date(badge.obtainedAt).toLocaleDateString('fr-FR')}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** An empty badge slot — neutral placeholder square */
export function BadgeSlotEmpty({ size = 'sm', className }: { size?: BadgeIconProps['size']; className?: string }) {
  const { box } = SIZES[size ?? 'sm'];
  return (
    <div
      className={cn(
        box,
        'rounded-sm flex-shrink-0 border border-dashed border-border/30 bg-muted/20',
        className,
      )}
      aria-hidden
    />
  );
}
