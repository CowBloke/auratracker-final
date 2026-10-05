import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GamePauseButtonProps {
  isPaused: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function GamePauseButton({ isPaused, onToggle, disabled = false, size = 'sm' }: GamePauseButtonProps) {
  return (
    <Button type="button" size={size} variant="outline" onClick={onToggle} disabled={disabled}>
      {isPaused ? <Play /> : <Pause />}
      {isPaused ? 'Reprendre' : 'Pause'}
    </Button>
  );
}
