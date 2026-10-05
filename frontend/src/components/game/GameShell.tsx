import type { ComponentProps, ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

interface GameShellProps extends Omit<ComponentProps<'div'>, 'ref'> {
  containerRef?: Ref<HTMLDivElement>;
  isFullscreen?: boolean;
  /** Barre supérieure du jeu (titre, score, actions). */
  topBar: ReactNode;
  /** Contenu rendu à droite de la zone de jeu (ex. classement). Masqué en plein écran et sur mobile. */
  aside?: ReactNode;
}

/** Structure unique des pages de jeu : barre supérieure, zone de jeu, panneau latéral. */
export function GameShell({ containerRef, isFullscreen = false, topBar, aside, className, children, ...props }: GameShellProps) {
  const hasAside = Boolean(aside) && !isFullscreen;

  return (
    <div
      ref={containerRef}
      className={cn(
        'mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6',
        isFullscreen && 'min-h-screen max-w-none items-center bg-background',
        className
      )}
      {...props}
    >
      {topBar}
      <div className={cn('grid w-full items-start gap-6', hasAside && 'lg:grid-cols-[minmax(0,1fr)_20rem]')}>
        <div className="flex min-w-0 flex-col items-center">{children}</div>
        {hasAside ? <div className="hidden lg:block">{aside}</div> : null}
      </div>
    </div>
  );
}
