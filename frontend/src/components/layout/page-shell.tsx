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
  padTop?: boolean;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageShell({ children, className, size = 'compact', padTop = false }: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        sizeClasses[size],
        padTop ? SPACING.PAGE_PADDING : SPACING.PAGE_BODY_PADDING,
        SPACING.PAGE_SPACING,
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-start md:justify-between', className)}>
      <div className="space-y-2">
        <div className="space-y-1">
          <h1 className={TYPOGRAPHY.PAGE_TITLE}>{title}</h1>
          {description ? <p className={cn(TYPOGRAPHY.PAGE_DESCRIPTION, 'max-w-2xl')}>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
