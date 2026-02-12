import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BombPartyPlayAgainPrompt() {
  const { user } = useAuth();
  const { bombPartyPlayAgainPrompt, respondToBombPartyPlayAgainPrompt } = useSocket();

  const [secondsLeft, setSecondsLeft] = useState(10);
  const [hiddenForMe, setHiddenForMe] = useState(false);

  const myResponse = useMemo(
    () => bombPartyPlayAgainPrompt?.responses.find((r) => r.userId === user?.id),
    [bombPartyPlayAgainPrompt?.responses, user?.id],
  );

  const isParticipant = useMemo(
    () => !!bombPartyPlayAgainPrompt?.players.some((p) => p.userId === user?.id),
    [bombPartyPlayAgainPrompt?.players, user?.id],
  );

  useEffect(() => {
    if (!bombPartyPlayAgainPrompt) {
      setSecondsLeft(10);
      setHiddenForMe(false);
      return;
    }

    const tick = () => {
      const elapsed = Date.now() - bombPartyPlayAgainPrompt.startTime;
      const remaining = Math.max(0, Math.ceil((bombPartyPlayAgainPrompt.timeLimit - elapsed) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [bombPartyPlayAgainPrompt?.partyId, bombPartyPlayAgainPrompt?.startTime, bombPartyPlayAgainPrompt?.timeLimit]);

  useEffect(() => {
    if (myResponse?.playAgain === false) {
      setHiddenForMe(true);
    }
  }, [myResponse?.playAgain]);

  if (!bombPartyPlayAgainPrompt || !isParticipant || hiddenForMe) {
    return null;
  }

  const hasResponded = !!myResponse;
  const detail = `${bombPartyPlayAgainPrompt.lives} vies - ${
    bombPartyPlayAgainPrompt.difficulty === 'easy'
      ? 'Facile'
      : bombPartyPlayAgainPrompt.difficulty === 'medium'
        ? 'Moyen'
        : 'Difficile'
  }`;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Rejouer une partie ?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">{detail}</div>

          <div className="rounded border border-border/60 p-3 space-y-2">
            {bombPartyPlayAgainPrompt.gameOverData?.winnerUsername ? (
              <p className="text-sm">
                Gagnant: <span className="font-medium">{bombPartyPlayAgainPrompt.gameOverData.winnerUsername}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun gagnant</p>
            )}
            <div className="text-xs text-muted-foreground">
              Replay: {bombPartyPlayAgainPrompt.playAgainCount} | Leave: {bombPartyPlayAgainPrompt.leaveCount}
            </div>
          </div>

          <div className="space-y-2">
            {bombPartyPlayAgainPrompt.players.map((player) => {
              const response = bombPartyPlayAgainPrompt.responses.find((r) => r.userId === player.userId);
              return (
                <div key={player.userId} className="flex items-center justify-between text-sm">
                  <span style={{ color: player.usernameColor || undefined }}>
                    {player.username}
                    {player.userId === user?.id ? ' (toi)' : ''}
                  </span>
                  {response ? (
                    <span className={cn('text-xs uppercase', response.playAgain ? 'text-green-500' : 'text-red-500')}>
                      {response.playAgain ? 'Replay' : 'Leave'}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">En attente</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className={cn(secondsLeft <= 3 && 'text-red-500')}>{secondsLeft}s</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {hasResponded ? (
            <div className="w-full text-center text-sm text-muted-foreground">
              {myResponse.playAgain ? 'Tu as choisi Replay.' : 'Tu as choisi Leave.'}
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  respondToBombPartyPlayAgainPrompt(false);
                  setHiddenForMe(true);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Leave
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  respondToBombPartyPlayAgainPrompt(true);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Replay
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
