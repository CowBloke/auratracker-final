import { cn } from '@/lib/utils';
import { ClanTag, ClanTagData } from '@/components/clans/ClanTag';

interface UsernameDisplayProps {
  username: string;
  firstName?: string | null;
  usernameColor?: string | null;
  className?: string;
  usernameClassName?: string;
  labelClassName?: string;
  clanTagClassName?: string;
  clanTag?: ClanTagData | null;
  /** @deprecated label is now driven by firstName prop */
  showLabel?: boolean;
}

export function UsernameDisplay({
  username,
  firstName,
  usernameColor,
  className,
  usernameClassName,
  labelClassName,
  clanTagClassName,
  clanTag,
}: UsernameDisplayProps) {
  const label = firstName?.trim() || null;
  return (
    <span className={cn('inline-flex min-w-0 items-baseline gap-1', className)}>
      <span
        className={cn('truncate', usernameClassName)}
        style={usernameColor ? { color: usernameColor } : undefined}
      >
        {username}
      </span>
      {clanTag ? <ClanTag tag={clanTag} className={clanTagClassName} /> : null}
      {label ? (
        <span className={cn('shrink-0 text-[10px] text-muted-foreground', labelClassName)}>
          {' '}{label}
        </span>
      ) : null}
    </span>
  );
}
