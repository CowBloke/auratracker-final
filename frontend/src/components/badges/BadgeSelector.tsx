import { Badge, UserBadgeEntry } from '@/services/api';
import { BadgeIcon, BadgeData } from './BadgeIcon';
import { cn } from '@/lib/utils';

// Categories whose badges are excluded from the "all badges" catalog
// (leaderboard/top-N badges that only a few people can hold at a time, and custom personal badges)
const EXCLUDED_CATALOG_CATEGORIES = ['leaderboard', 'admin', 'custom'];
const EXCLUDED_CATALOG_CONDITION_PREFIXES = ['TOP_', 'CLASS_', 'GAME_HIGHSCORE_', 'BOMBPARTY_TOP_', 'MEMBER'];

function isExcludedFromCatalog(badge: Badge): boolean {
  if (EXCLUDED_CATALOG_CATEGORIES.includes(badge.category)) return true;
  if (!badge.autoConditionKey) return false;
  return EXCLUDED_CATALOG_CONDITION_PREFIXES.some((prefix) =>
    badge.autoConditionKey!.startsWith(prefix),
  );
}

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

/**
 * Full badge catalog showing all obtainable badges.
 * Earned badges shown normally; unearned shown locked (darkened or ???).
 * Leaderboard/top-N badges excluded — only shown in user's earned section.
 */
export function BadgeCatalog({
  allBadges,
  earnedBadges,
  totalUsers,
  className,
}: {
  allBadges: Badge[];
  earnedBadges: UserBadgeEntry[];
  totalUsers?: number;
  className?: string;
}) {
  const earnedIds = new Set(earnedBadges.map((b) => b.id));

  // ownerCount lookup from allBadges (user badges don't include it)
  const ownerCountMap = new Map(allBadges.map((b) => [b.id, b.ownerCount]));
  const withCount = (b: UserBadgeEntry) => ({ ...b, ownerCount: ownerCountMap.get(b.id) ?? b.ownerCount });

  // Badges earned (shown first, ordered by obtainedAt desc — preserved from earnedBadges)
  const earned = earnedBadges.filter((b) => !isExcludedFromCatalog(b)).map(withCount);

  // Leaderboard/top-N badges the user has earned (shown separately)
  const earnedLeaderboard = earnedBadges.filter((b) => isExcludedFromCatalog(b)).map(withCount);

  // All catalog badges (non-leaderboard), not yet earned
  const locked = allBadges.filter((b) => !isExcludedFromCatalog(b) && !earnedIds.has(b.id));

  const hasEarned = earned.length > 0 || earnedLeaderboard.length > 0;
  const hasLocked = locked.length > 0;

  if (!hasEarned && !hasLocked) return null;

  return (
    <div className={cn('space-y-4', className)}>
      {(earned.length > 0 || earnedLeaderboard.length > 0) && (
        <div>
          <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-2">Obtenus</p>
          <div className="flex flex-wrap gap-1">
            {earned.map((badge) => (
              <BadgeIcon key={badge.id} badge={badge as BadgeData} size="lg" tooltipSide="bottom" totalUsers={totalUsers} />
            ))}
            {earnedLeaderboard.map((badge) => (
              <BadgeIcon key={badge.id} badge={badge as BadgeData} size="lg" tooltipSide="bottom" totalUsers={totalUsers} />
            ))}
          </div>
        </div>
      )}
      {hasLocked && (
        <div>
          <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-2">À débloquer</p>
          <div className="flex flex-wrap gap-1">
            {locked.map((badge) => (
              <BadgeIcon
                key={badge.id}
                badge={badge as BadgeData}
                size="lg"
                tooltipSide="bottom"
                locked
                totalUsers={totalUsers}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
