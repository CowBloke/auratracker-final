import type { ReactNode } from 'react';
import { Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameOverlay } from '@/components/game/GameOverlay';

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
  description = "La partie est gelée jusqu'à la reprise.",
  children,
}: GamePauseOverlayProps) {
  return (
    <GameOverlay visible={visible} title={title} description={description} icon={Pause}>
      {children}
      <Button type="button" variant="outline" onClick={onResume}>
        Reprendre
      </Button>
    </GameOverlay>
  );
}
