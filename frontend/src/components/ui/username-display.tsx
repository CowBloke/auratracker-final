import { cn } from '@/lib/utils';

interface UsernameDisplayProps {
  username: string;
  usernameColor?: string | null;
  className?: string;
  usernameClassName?: string;
  labelClassName?: string;
  label?: string;
  showLabel?: boolean;
}

export function UsernameDisplay({
  username,
  usernameColor,
  className,
  usernameClassName,
  labelClassName,
  label = '(prénom)',
  showLabel = true,
}: UsernameDisplayProps) {
  return (
    <span className={cn('inline-flex min-w-0 items-baseline gap-1', className)}>
      <span
        className={cn('truncate', usernameClassName)}
        style={usernameColor ? { color: usernameColor } : undefined}
      >
        {username}
      </span>
      {showLabel ? (
        <span className={cn('shrink-0 text-xs text-muted-foreground', labelClassName)}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
