import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameFullscreenButtonProps {
  isFullscreen: boolean;
  onClick: () => void;
  className?: string;
}

export function GameFullscreenButton({
  isFullscreen,
  onClick,
  className,
}: GameFullscreenButtonProps) {
  const label = isFullscreen ? 'Quitter' : 'Plein ecran';
  const title = isFullscreen ? 'Quitter le plein écran' : 'Plein écran';
  const Icon = isFullscreen ? Minimize2 : Maximize2;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-[0_12px_30px_rgba(0,0,0,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
