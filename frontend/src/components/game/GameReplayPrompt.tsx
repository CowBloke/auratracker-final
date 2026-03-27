import { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';

interface GameReplayPromptProps {
  settingsText?: string;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
  timeLimit: number;
  startTime: number;
  currentUserId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export default function GameReplayPrompt({
  settingsText,
  players,
  responses,
  timeLimit,
  startTime,
  currentUserId,
  onPlayAgain,
  onLeave,
}: GameReplayPromptProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.max(0, 100 - (elapsed / timeLimit) * 100));
    }, 120);
    return () => clearInterval(interval);
  }, [startTime, timeLimit]);

  const myResponse = responses.find((r) => r.userId === currentUserId);
  const hasResponded = !!myResponse;
  const isParticipant = players.some((p) => p.userId === currentUserId);

  if (!isParticipant) return null;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Rejouer une partie ?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {settingsText && (
            <div className="text-sm text-muted-foreground">{settingsText}</div>
          )}

          <div className="space-y-2">
            {players.map((player) => {
              const response = responses.find((r) => r.userId === player.userId);
              return (
                <div key={player.userId} className="flex items-center justify-between text-sm">
                  <span>
                    <UsernameDisplay username={player.username} usernameColor={player.usernameColor} />
                    {player.userId === currentUserId ? ' (toi)' : ''}
                  </span>
                  {response ? (
                    <span className={cn('text-xs', response.playAgain ? 'text-green-500' : 'text-red-500')}>
                      {response.playAgain ? 'Rejouer' : 'Quitter'}
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
        </div>

        <DialogFooter className="gap-2">
          {hasResponded ? (
            <div className="w-full text-center text-sm text-muted-foreground">
              {myResponse.playAgain ? 'Tu as choisi de rejouer.' : 'Tu as choisi de quitter.'}
            </div>
          ) : (
            <>
              <Button variant="outline" className="flex-1" onClick={onLeave}>
                <X className="h-4 w-4 mr-2" />
                Quitter
              </Button>
              <Button className="flex-1" onClick={onPlayAgain}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Rejouer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
