import type { ReactNode } from 'react';
import { GameFullscreenButton } from '@/components/game/GameFullscreenButton';
import { cn } from '@/lib/utils';

interface GameFullscreenToolbarProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  children?: ReactNode;
  className?: string;
}

export function GameFullscreenToolbar({
  isFullscreen,
  onToggleFullscreen,
  children,
  className,
}: GameFullscreenToolbarProps) {
  return (
    <div className={cn('flex w-full items-center justify-between gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {children}
      </div>
      <GameFullscreenButton isFullscreen={isFullscreen} onClick={onToggleFullscreen} />
    </div>
  );
}
