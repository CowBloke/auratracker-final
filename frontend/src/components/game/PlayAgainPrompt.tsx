import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';

interface PlayAgainPromptProps {
  open: boolean;
  title?: string;
  detail?: string;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
  timeLimit: number;
  startTime: number;
  onQuit: () => void;
  onPlayAgain: () => void;
}

export default function PlayAgainPrompt({
  open,
  title = 'Relancer une partie ?',
  detail,
  players,
  responses,
  timeLimit,
  startTime,
  onQuit,
  onPlayAgain,
}: PlayAgainPromptProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!open) {
      setProgress(100);
      return;
    }
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.max(0, 100 - (elapsed / timeLimit) * 100));
    }, 120);
    return () => clearInterval(interval);
  }, [open, startTime, timeLimit]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {detail && (
            <p className="text-sm text-muted-foreground">
              {detail}
            </p>
          )}
          <div className="space-y-2">
            {players.map((player) => {
              const response = responses.find((r) => r.userId === player.userId);
              return (
                <div key={player.userId} className="flex items-center justify-between text-sm">
                  <UsernameDisplay username={player.username} usernameColor={player.usernameColor} />
                  {response ? (
                    <span
                      className={cn(
                        'text-xs ',
                        response.playAgain ? 'text-green-500' : 'text-red-500'
                      )}
                    >
                      {response.playAgain ? 'OK' : 'Quitte'}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">En attente</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="h-1 rounded bg-muted">
            <div className="h-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <Button variant="outline" onClick={onQuit}>
              Quitter
            </Button>
            <Button onClick={onPlayAgain}>
              Relancer
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
