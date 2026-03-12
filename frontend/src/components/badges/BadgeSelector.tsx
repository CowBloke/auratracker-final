import { UserBadgeEntry } from '@/services/api';
import { BadgeIcon, BadgeData } from './BadgeIcon';
import { cn } from '@/lib/utils';

/** Read-only list of all badges a user has earned, used as history. */
export function BadgeHistory({
  badges,
  className,
}: {
  badges: UserBadgeEntry[];
  className?: string;
}) {
  if (badges.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {badges.map((badge) => (
        <BadgeIcon key={badge.id} badge={badge as BadgeData} size="lg" tooltipSide="bottom" />
      ))}
    </div>
  );
}
