import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Check, X, Clock, Crown } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';

export default function PetitBacJoinPrompt() {
  const { user } = useAuth();
  const { petitBacJoinPrompt, respondToPetitBacJoinPrompt } = useSocket();
  const navigate = useNavigate();

  const [timeLeft, setTimeLeft] = useState(10);
  const [hasResponded, setHasResponded] = useState(false);

  useEffect(() => {
    if (!petitBacJoinPrompt) {
      setTimeLeft(10);
      setHasResponded(false);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - petitBacJoinPrompt.startTime;
      const remaining = Math.max(0, Math.ceil((petitBacJoinPrompt.timeLimit - elapsed) / 1000));
      setTimeLeft(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [petitBacJoinPrompt]);

  const handleResponse = (accepted: boolean) => {
    respondToPetitBacJoinPrompt(accepted);
    setHasResponded(true);
    if (accepted) {
      navigate('/games/petit-bac');
    }
  };

  const myJoinResponse = petitBacJoinPrompt?.responses.find((r) => r.userId === user?.id);

  if (!petitBacJoinPrompt) return null;

  return (
    <Dialog open={!!petitBacJoinPrompt} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-normal flex items-center gap-2">
            Petit Bac ?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span
              className={cn(
                'text-3xl font-mono font-bold',
                timeLeft <= 3 ? 'text-red-500' : 'text-foreground'
              )}
            >
              {timeLeft}s
            </span>
          </div>

          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p>{petitBacJoinPrompt.rounds} manches · {Math.round(petitBacJoinPrompt.roundDuration / 1000)}s</p>
            <p>{petitBacJoinPrompt.categories.join(' · ')}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Joueurs</p>
            {petitBacJoinPrompt.members.map((member) => {
              const response = petitBacJoinPrompt.responses.find((r) => r.userId === member.userId);
              return (
                <div
                  key={member.userId}
                  className={cn(
                    'flex items-center justify-between py-2 px-3 border rounded',
                    response?.accepted === true
                      ? 'border-green-500/50 bg-green-500/5'
                      : response?.accepted === false
                        ? 'border-red-500/50 bg-red-500/5'
                        : 'border-border/30'
                  )}
                >
                  <span className="font-medium">
                    <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                    {member.userId === user?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(toi)</span>
                    )}
                    {member.userId === petitBacJoinPrompt.leaderId && (
                      <Crown className="inline-block ml-2 h-3 w-3 text-yellow-500" />
                    )}
                  </span>
                  <span>
                    {response?.accepted === true ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : response?.accepted === false ? (
                      <X className="h-4 w-4 text-red-500" />
                    ) : (
                      <span className="text-xs text-muted-foreground">En attente...</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter className="gap-2">
          {!hasResponded && !myJoinResponse ? (
            <>
              <Button
                variant="outline"
                onClick={() => handleResponse(false)}
                className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white"
              >
                <X className="h-4 w-4 mr-2" />
                Refuser
              </Button>
              <Button
                variant="outline"
                onClick={() => handleResponse(true)}
                className="flex-1 border-green-500/50 text-green-500 hover:bg-green-500 hover:text-white"
              >
                <Check className="h-4 w-4 mr-2" />
                Rejoindre
              </Button>
            </>
          ) : (
            <div className="w-full text-center text-sm text-muted-foreground">
              {myJoinResponse?.accepted || (hasResponded && petitBacJoinPrompt.leaderId === user?.id) ? (
                <span className="text-green-500">Tu as accepte. En attente...</span>
              ) : myJoinResponse?.accepted === false ? (
                <span className="text-red-500">Tu as refuse.</span>
              ) : null}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
