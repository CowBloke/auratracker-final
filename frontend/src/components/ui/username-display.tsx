import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import type { PublicBadge } from '@/services/api';
import { UserBadgesInline } from '@/components/ui/user-badges';
import { fetchCachedSelectedBadges, getCachedSelectedBadges } from '@/lib/selected-badges';

interface UsernameDisplayProps {
  userId?: string;
  username: string;
  firstName?: string | null;
  usernameColor?: string | null;
  badges?: PublicBadge[];
  showBadges?: boolean;
  className?: string;
  usernameClassName?: string;
  labelClassName?: string;
  /** @deprecated label is now driven by firstName prop */
  showLabel?: boolean;
}

export function UsernameDisplay({
  userId,
  username,
  firstName,
  usernameColor,
  badges,
  showBadges = true,
  className,
  usernameClassName,
  labelClassName,
}: UsernameDisplayProps) {
  const label = firstName?.trim() || null;
  const [resolvedBadges, setResolvedBadges] = useState<PublicBadge[] | null>(badges ?? null);

  useEffect(() => {
    if (!showBadges) return;
    if (badges) {
      setResolvedBadges(badges);
      return;
    }
    if (!userId) return;

    const cached = getCachedSelectedBadges(userId);
    if (cached) {
      setResolvedBadges(cached);
      return;
    }

    let cancelled = false;
    fetchCachedSelectedBadges(userId).then(() => {
      if (cancelled) return;
      setResolvedBadges(getCachedSelectedBadges(userId) ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [badges, showBadges, userId]);

  return (
    <span className={cn('inline-flex min-w-0 items-baseline gap-1', className)}>
      <span
        className={cn('truncate', usernameClassName)}
        style={usernameColor ? { color: usernameColor } : undefined}
      >
        {username}
      </span>
      {showBadges && resolvedBadges && resolvedBadges.length > 0 ? (
        <UserBadgesInline badges={resolvedBadges} />
      ) : null}
      {label ? (
        <span className={cn('shrink-0 text-[10px] text-muted-foreground', labelClassName)}>
          {' '}{label}
        </span>
      ) : null}
    </span>
  );
}
