import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Play, Check, X, Clock, Crown } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function BombPartyJoinPrompt() {
  const { user } = useAuth();
  const { bombPartyJoinPrompt, respondToJoinPrompt } = useSocket();
  const navigate = useNavigate();

  const [joinPromptTimeLeft, setJoinPromptTimeLeft] = useState(10);
  const [hasResponded, setHasResponded] = useState(false);

  // Join prompt countdown
  useEffect(() => {
    if (!bombPartyJoinPrompt) {
      setJoinPromptTimeLeft(10);
      setHasResponded(false);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - bombPartyJoinPrompt.startTime;
      const remaining = Math.max(0, Math.ceil((bombPartyJoinPrompt.timeLimit - elapsed) / 1000));
      setJoinPromptTimeLeft(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [bombPartyJoinPrompt]);

  const handleJoinResponse = (accepted: boolean) => {
    respondToJoinPrompt(accepted);
    setHasResponded(true);
    // Navigate to bomb party page if accepted
    if (accepted) {
      navigate('/games/bomb-party');
    }
  };

  // Check if current user has responded to join prompt
  const myJoinResponse = bombPartyJoinPrompt?.responses.find((r) => r.userId === user?.id);

  if (!bombPartyJoinPrompt) return null;

  return (
    <Dialog open={!!bombPartyJoinPrompt} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="font-normal flex items-center gap-2">
            <Play className="h-5 w-5 text-yellow-500" />
            Rejoindre Bomb Party ?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Timer */}
          <div className="flex items-center justify-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className={cn(
              "text-3xl font-mono font-bold",
              joinPromptTimeLeft <= 3 ? "text-red-500" : "text-foreground"
            )}>
              {joinPromptTimeLeft}s
            </span>
          </div>

          {/* Game settings */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              {bombPartyJoinPrompt.lives} vies · Difficulte{' '}
              {bombPartyJoinPrompt.difficulty === 'easy' ? 'Facile' :
               bombPartyJoinPrompt.difficulty === 'medium' ? 'Moyen' : 'Difficile'}
            </p>
          </div>

          {/* Members and their responses */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Joueurs</p>
            {bombPartyJoinPrompt.members.map((member) => {
              const response = bombPartyJoinPrompt.responses.find((r) => r.userId === member.userId);
              return (
                <div
                  key={member.userId}
                  className={cn(
                    "flex items-center justify-between py-2 px-3 border rounded",
                    response?.accepted === true
                      ? "border-green-500/50 bg-green-500/5"
                      : response?.accepted === false
                        ? "border-red-500/50 bg-red-500/5"
                        : "border-border/30"
                  )}
                >
                  <span
                    className="font-medium"
                    style={member.usernameColor ? { color: member.usernameColor } : undefined}
                  >
                    {member.username}
                    {member.userId === user?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(toi)</span>
                    )}
                    {member.userId === bombPartyJoinPrompt.leaderId && (
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
                onClick={() => handleJoinResponse(false)}
                className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white"
              >
                <X className="h-4 w-4 mr-2" />
                Refuser
              </Button>
              <Button
                variant="outline"
                onClick={() => handleJoinResponse(true)}
                className="flex-1 border-green-500/50 text-green-500 hover:bg-green-500 hover:text-white"
              >
                <Check className="h-4 w-4 mr-2" />
                Rejoindre
              </Button>
            </>
          ) : (
            <div className="w-full text-center text-sm text-muted-foreground">
              {myJoinResponse?.accepted || (hasResponded && bombPartyJoinPrompt.leaderId === user?.id) ? (
                <span className="text-green-500">Tu as accepte. En attente des autres...</span>
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
