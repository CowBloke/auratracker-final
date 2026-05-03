import { useNavigate } from 'react-router-dom';
import { BadgeIcon, type BadgeData } from '@/components/badges/BadgeIcon';
import { cn } from '@/lib/utils';
import { ClanTag, ClanTagData } from '@/components/clans/ClanTag';

type UsernameDisplayPreset = 'full' | 'no-badge' | 'minimal';

export interface UsernameDisplayProps {
  username: string;
  userId?: string | null;
  firstName?: string | null;
  usernameColor?: string | null;
  badges?: BadgeData[] | null;
  preset?: UsernameDisplayPreset;
  clickable?: boolean;
  className?: string;
  usernameClassName?: string;
  labelClassName?: string;
  badgesClassName?: string;
  badgeIconClassName?: string;
  clanTagClassName?: string;
  clanTag?: ClanTagData | null;
  badgeSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  showColor?: boolean;
  showBadges?: boolean;
  showLabel?: boolean;
  showClanTag?: boolean;
}

const PRESETS: Record<UsernameDisplayPreset, {
  showColor: boolean;
  showBadges: boolean;
  showLabel: boolean;
  showClanTag: boolean;
}> = {
  full: { showColor: true, showBadges: true, showLabel: true, showClanTag: true },
  'no-badge': { showColor: true, showBadges: false, showLabel: true, showClanTag: true },
  minimal: { showColor: false, showBadges: false, showLabel: false, showClanTag: false },
};

export function UsernameDisplay({
  username,
  userId,
  firstName,
  usernameColor,
  badges,
  preset = 'full',
  clickable = false,
  className,
  usernameClassName,
  labelClassName,
  badgesClassName,
  badgeIconClassName,
  clanTagClassName,
  clanTag,
  badgeSize = 'xs',
  tooltipSide = 'top',
  showColor,
  showBadges,
  showLabel,
  showClanTag,
}: UsernameDisplayProps) {
  const navigate = useNavigate();
  const resolved = PRESETS[preset];
  const shouldShowColor = showColor ?? resolved.showColor;
  const shouldShowBadges = showBadges ?? resolved.showBadges;
  const shouldShowLabel = showLabel ?? resolved.showLabel;
  const shouldShowClanTag = showClanTag ?? resolved.showClanTag;
  const label = firstName?.trim() || null;
  const visibleBadges = shouldShowBadges ? (badges ?? []).slice(0, 2) : [];
  const isClickable = clickable && Boolean(userId);

  return (
    <span
      role={isClickable ? 'link' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? (event) => {
        event.stopPropagation();
        navigate(`/profile/${userId}`);
      } : undefined}
      onKeyDown={isClickable ? (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        navigate(`/profile/${userId}`);
      } : undefined}
      className={cn(
        'inline-flex min-w-0 items-baseline gap-1',
        isClickable && 'cursor-pointer',
        className,
      )}
    >
      {visibleBadges.length > 0 ? (
        <span className={cn('inline-flex shrink-0 items-center gap-0.5', badgesClassName)}>
          {visibleBadges.map((badge) => (
            <BadgeIcon
              key={badge.id}
              badge={badge}
              size={badgeSize}
              tooltipSide={tooltipSide}
              className={badgeIconClassName}
            />
          ))}
        </span>
      ) : null}
      <span
        className={cn('truncate', usernameClassName)}
        style={shouldShowColor && usernameColor ? { color: usernameColor } : undefined}
      >
        {username}
      </span>
      {shouldShowClanTag && clanTag ? <ClanTag tag={clanTag} className={clanTagClassName} /> : null}
      {shouldShowLabel && label ? (
        <span className={cn('shrink-0 text-[10px] text-muted-foreground', labelClassName)}>
          {' '}{label}
        </span>
      ) : null}
    </span>
  );
}

export type { BadgeData, UsernameDisplayPreset };
