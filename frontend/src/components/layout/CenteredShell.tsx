import type { ReactNode } from 'react';
import { SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';

interface CenteredShellProps {
  children: ReactNode;
  className?: string;
  widthClassName?: string;
}

export function CenteredShell({
  children,
  className,
  widthClassName = 'max-w-md',
}: CenteredShellProps) {
  return (
    <div className={cn('min-h-screen bg-background', SPACING.PAGE_PADDING, 'flex items-center justify-center', className)}>
      <div className={cn('w-full space-y-6', widthClassName)}>{children}</div>
    </div>
  );
}
