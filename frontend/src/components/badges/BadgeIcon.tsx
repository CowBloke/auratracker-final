import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  isHidden?: boolean;
  obtainedAt?: string | null;
  obtainedReason?: string | null;
}

const RARITY_GLOW: Record<string, string> = {
  legendary: '0 0 8px 2px rgba(234,179,8,0.7)',
  epic:       '0 0 7px 1px rgba(168,85,247,0.6)',
  rare:       '0 0 6px 1px rgba(59,130,246,0.55)',
  uncommon:   '0 0 4px 1px rgba(34,197,94,0.45)',
};

const RARITY_TEXT_COLOR: Record<string, string> = {
  legendary: '#facc15',
  epic:      '#c084fc',
  rare:      '#60a5fa',
  uncommon:  '#4ade80',
  common:    '#9ca3af',
};

const RARITY_LABELS: Record<string, string> = {
  legendary: 'Légendaire',
  epic:      'Épique',
  rare:      'Rare',
  uncommon:  'Peu commun',
  common:    'Commun',
};

interface BadgeIconProps {
  badge: BadgeData;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  locked?: boolean; // True if user doesn't own this badge
}

const SIZES = {
  xs:  { box: 'w-5 h-5',           text: 'text-xs'     },
  sm:  { box: 'w-6 h-6',           text: 'text-sm'     },
  md:  { box: 'w-7 h-7',           text: 'text-base'   },
  lg:  { box: 'w-9 h-9',           text: 'text-lg'     },
  xl:  { box: 'w-12 h-12',         text: 'text-2xl'    },
  '2xl': { box: 'w-16 h-16',       text: 'text-3xl'    },
};

export function getBadgeBackground(badge: BadgeData): React.CSSProperties {
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

export function BadgeIcon({ badge, size = 'sm', className, tooltipSide = 'top', locked = false }: BadgeIconProps) {
  const { box, text } = SIZES[size];
  const boxShadow = !locked ? (RARITY_GLOW[badge.rarity] ?? undefined) : undefined;
  const rarityColor = RARITY_TEXT_COLOR[badge.rarity] ?? '#9ca3af';

  // Hidden locked badge: show as ???
  if (locked && badge.isHidden) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              box,
              'rounded-sm flex items-center justify-center cursor-help flex-shrink-0 select-none',
              className,
            )}
            style={{
              backgroundColor: '#1f2937',
              border: '1.5px solid #374151',
            }}
            aria-label="Badge mystère"
          >
            <span className={cn(text, 'leading-none pointer-events-none text-muted-foreground/40 font-bold')}>
              ?
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} sideOffset={6} className="p-0 overflow-hidden max-w-[260px] border-0">
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ backgroundColor: '#1f2937', borderBottom: '1px solid #37415155' }}>
            <div className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,0,0,0.4)', border: '1.5px solid #374151' }}>
              <span className="text-2xl leading-none select-none text-muted-foreground/40 font-bold">?</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight text-muted-foreground drop-shadow">???</p>
              <p className="text-[11px] font-medium mt-0.5 text-muted-foreground/50">Achievement caché</p>
            </div>
          </div>
          <div className="px-3 py-2 bg-popover">
            <p className="text-xs text-muted-foreground/50 italic">Continuez à jouer pour découvrir cet achievement.</p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Locked (non-hidden) badge: shown darkened with unlock condition
  if (locked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              box,
              'rounded-sm flex items-center justify-center cursor-help flex-shrink-0 select-none opacity-30 grayscale',
              className,
            )}
            style={{
              ...getBadgeBackground(badge),
              border: `1.5px solid ${badge.borderColor}`,
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
        <TooltipContent side={tooltipSide} sideOffset={6} className="p-0 overflow-hidden max-w-[260px] border-0" style={{ borderColor: badge.borderColor }}>
          <div
            className="flex items-center gap-3 px-3 py-2.5 opacity-60"
            style={{ ...getBadgeBackground(badge), borderBottom: `1px solid ${badge.borderColor}55` }}
          >
            <div
              className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(0,0,0,0.25)', border: `1.5px solid ${badge.borderColor}` }}
            >
              <span className="text-2xl leading-none select-none">{badge.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight text-white drop-shadow">{badge.name}</p>
              <p className="text-[11px] font-medium mt-0.5" style={{ color: rarityColor }}>
                {RARITY_LABELS[badge.rarity] ?? badge.rarity} · <span className="text-muted-foreground/70">Non obtenu</span>
              </p>
            </div>
          </div>
          <div className="px-3 py-2 space-y-1.5 bg-popover">
            <p className="text-xs text-muted-foreground leading-snug">{badge.description}</p>
            {badge.howToObtain && (
              <p className="text-[11px] text-muted-foreground/70 italic leading-snug">
                🔒 {badge.howToObtain}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Unlocked badge (normal)
  return (
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
            border: `1.5px solid ${badge.borderColor}`,
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
      <TooltipContent
        side={tooltipSide}
        sideOffset={6}
        className="p-0 overflow-hidden max-w-[260px] border-0"
        style={{ borderColor: badge.borderColor }}
      >
        {/* Coloured header strip */}
        <div
          className="flex items-center gap-3 px-3 py-2.5"
          style={{ ...getBadgeBackground(badge), borderBottom: `1px solid ${badge.borderColor}55` }}
        >
          {/* Large icon preview */}
          <div
            className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(0,0,0,0.25)',
              border: `1.5px solid ${badge.borderColor}`,
              boxShadow: RARITY_GLOW[badge.rarity] ?? undefined,
            }}
          >
            <span className="text-2xl leading-none select-none">{badge.icon}</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight text-white drop-shadow">{badge.name}</p>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: rarityColor }}>
              {RARITY_LABELS[badge.rarity] ?? badge.rarity}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2 space-y-1.5 bg-popover">
          <p className="text-xs text-muted-foreground leading-snug">{badge.description}</p>
          {badge.howToObtain && (
            <p className="text-[11px] text-muted-foreground/70 italic leading-snug">{badge.howToObtain}</p>
          )}
          {badge.obtainedAt && (
            <p className="text-[10px] text-muted-foreground/50 pt-0.5 border-t border-border/30">
              Obtenu le {new Date(badge.obtainedAt).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** An empty badge slot — neutral placeholder square */
export function BadgeSlotEmpty({ size = 'sm', className }: { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'; className?: string }) {
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
