import type { ReactNode } from 'react';
import { CONTAINER, SPACING, TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';

type PageShellSize = 'compact' | 'default' | 'wide' | 'full';

const sizeClasses: Record<PageShellSize, string> = {
  compact: CONTAINER.COMPACT,
  default: CONTAINER.DEFAULT,
  wide: CONTAINER.WIDE,
  full: CONTAINER.FULL,
};

interface PageShellProps {
  children: ReactNode;
  className?: string;
  size?: PageShellSize;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageShell({ children, className, size = 'compact' }: PageShellProps) {
  return (
    <div className={cn('mx-auto w-full', sizeClasses[size], SPACING.PAGE_PADDING, SPACING.PAGE_SPACING, className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-start md:justify-between', className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-1">
          <h1 className={TYPOGRAPHY.PAGE_TITLE}>{title}</h1>
          {description ? <p className={cn(TYPOGRAPHY.PAGE_DESCRIPTION, 'max-w-2xl')}>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

