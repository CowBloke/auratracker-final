import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface GamePauseOverlayProps {
  visible: boolean;
  onResume: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
}

export function GamePauseOverlay({
  visible,
  onResume,
  title = 'Jeu en pause',
  description = 'La partie est gelée jusqu\'à la reprise.',
  children,
}: GamePauseOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/88 backdrop-blur-sm">
      <div className="space-y-4 p-6 text-center">
        <div>
          <p className="text-2xl font-light">{title}</p>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
        <Button type="button" variant="outline" onClick={onResume}>
          Reprendre
        </Button>
      </div>
    </div>
  );
}
