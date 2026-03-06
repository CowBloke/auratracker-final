import { cn } from '@/lib/utils';

interface UsernameDisplayProps {
  username: string;
  firstName?: string | null;
  usernameColor?: string | null;
  className?: string;
  usernameClassName?: string;
  labelClassName?: string;
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
      {label ? (
        <span className={cn('shrink-0 text-xs text-muted-foreground', labelClassName)}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
