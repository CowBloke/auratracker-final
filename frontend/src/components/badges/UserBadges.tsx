import { cn } from '@/lib/utils';
import { BadgeIcon, BadgeSlotEmpty, BadgeData } from './BadgeIcon';

interface UserBadgesProps {
  badges: BadgeData[];          // 0-2 equipped badges
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  /** If true, show both slots even when empty (always 2 squares visible) */
  showEmptySlots?: boolean;
}

/**
 * Renders exactly 2 badge slots next to each other.
 * Empty slots show as faint dashed squares when showEmptySlots is true.
 */
export function UserBadges({
  badges,
  size = 'sm',
  className,
  tooltipSide = 'top',
  showEmptySlots = true,
}: UserBadgesProps) {
  const slot1 = badges[0] ?? null;
  const slot2 = badges[1] ?? null;

  const hasAny = slot1 || slot2;
  if (!hasAny && !showEmptySlots) return null;

  return (
    <div className={cn('flex items-center gap-0.5 shrink-0', className)}>
      {slot1
        ? <BadgeIcon badge={slot1} size={size} tooltipSide={tooltipSide} />
        : showEmptySlots && <BadgeSlotEmpty size={size} />
      }
      {slot2
        ? <BadgeIcon badge={slot2} size={size} tooltipSide={tooltipSide} />
        : showEmptySlots && <BadgeSlotEmpty size={size} />
      }
    </div>
  );
}

export type { BadgeData };
