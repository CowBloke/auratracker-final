import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Check, X, Clock, Crown } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';

export default function P4JoinPrompt() {
  const { user } = useAuth();
  const { p4JoinPrompt, respondToP4JoinPrompt } = useSocket();
  const navigate = useNavigate();

  const [timeLeft, setTimeLeft] = useState(10);
  const [hasResponded, setHasResponded] = useState(false);

  useEffect(() => {
    if (!p4JoinPrompt) {
      setTimeLeft(10);
      setHasResponded(false);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - p4JoinPrompt.startTime;
      const remaining = Math.max(0, Math.ceil((p4JoinPrompt.timeLimit - elapsed) / 1000));
      setTimeLeft(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [p4JoinPrompt]);

  const handleResponse = (accepted: boolean) => {
    respondToP4JoinPrompt(accepted);
    setHasResponded(true);
    if (accepted) {
      navigate('/games/puissance-quatre');
    }
  };

  const myJoinResponse = p4JoinPrompt?.responses.find((r) => r.userId === user?.id);

  if (!p4JoinPrompt) return null;

  return (
    <Dialog open={!!p4JoinPrompt} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-normal flex items-center gap-2">
            Puissance 4 ?
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

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Joueurs</p>
            {p4JoinPrompt.members.map((member) => {
              const response = p4JoinPrompt.responses.find((r) => r.userId === member.userId);
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
                    {member.userId === p4JoinPrompt.leaderId && (
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
              {myJoinResponse?.accepted || (hasResponded && p4JoinPrompt.leaderId === user?.id) ? (
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
