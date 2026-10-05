import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageShellSize = 'default' | 'wide' | 'full';

const sizeClasses: Record<PageShellSize, string> = {
  default: 'max-w-7xl',
  wide: 'max-w-screen-2xl',
  full: 'max-w-none',
};

interface PageShellProps extends ComponentProps<'div'> {
  size?: PageShellSize;
}

/** Conteneur unique de toutes les pages applicatives : largeur, marges et espacement verticaux identiques. */
export function PageShell({ children, className, size = 'default', ...props }: PageShellProps) {
  return (
    <div className={cn('mx-auto flex w-full flex-col gap-6 p-4 md:p-6', sizeClasses[size], className)} {...props}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/** En-tête unique de page : titre, description et actions principales. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
