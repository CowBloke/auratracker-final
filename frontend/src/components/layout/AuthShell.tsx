import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AuthShellProps {
  children: ReactNode;
  size?: 'sm' | 'lg';
}

/** Conteneur unique des pages hors application (connexion, inscription, bannissement, maintenance). */
export function AuthShell({ children, size = 'sm' }: AuthShellProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className={cn('flex w-full flex-col gap-6', size === 'sm' ? 'max-w-sm' : 'max-w-2xl')}>
        <div className="flex items-center justify-center gap-2 self-center font-semibold">
          <img src="/aura-icon.svg" alt="" className="size-6 dark:hidden" />
          <img src="/aura-icon-white.svg" alt="" className="hidden size-6 dark:block" />
          Aura Tracker
        </div>
        {children}
      </div>
    </div>
  );
}
