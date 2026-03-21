import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GameFullscreenStageProps {
  isFullscreen: boolean;
  baseWidth: number;
  baseHeight: number;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function GameFullscreenStage({
  isFullscreen,
  baseWidth,
  baseHeight,
  children,
  className,
  contentClassName,
}: GameFullscreenStageProps) {
  const aspectRatio = `${baseWidth} / ${baseHeight}`;
  const contentStyle: CSSProperties = isFullscreen
    ? {
        width: `min(calc(100vw - 2rem), calc((100vh - 7rem) * ${baseWidth / baseHeight}))`,
        height: `min(calc(100vh - 7rem), calc((100vw - 2rem) / ${baseWidth / baseHeight}))`,
      }
    : {
        width: '100%',
        maxWidth: baseWidth,
      };

  return (
    <div className={cn('flex w-full justify-center', isFullscreen && 'flex-1 items-center', className)}>
      <div
        className={cn('relative overflow-hidden', isFullscreen && 'shrink-0', contentClassName)}
        style={{
          ...contentStyle,
          aspectRatio,
        }}
      >
        {children}
      </div>
    </div>
  );
}
