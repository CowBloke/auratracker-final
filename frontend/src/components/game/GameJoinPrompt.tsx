import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Clock, Crown } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';

interface GameJoinPromptProps {
  title: string;
  settingsText?: string;
  navigateTo: string;
  leaderId: string;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
  timeLimit: number;
  startTime: number;
  currentUserId: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function GameJoinPrompt({
  title,
  settingsText,
  navigateTo,
  leaderId,
  members,
  responses,
  timeLimit,
  startTime,
  currentUserId,
  onAccept,
  onDecline,
}: GameJoinPromptProps) {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(Math.ceil(timeLimit / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setTimeLeft(Math.max(0, Math.ceil((timeLimit - elapsed) / 1000)));
    }, 100);
    return () => clearInterval(interval);
  }, [startTime, timeLimit]);

  const myResponse = responses.find((r) => r.userId === currentUserId);
  const hasResponded = !!myResponse;

  useEffect(() => {
    if (timeLeft === 0 && myResponse?.accepted === true) {
      navigate(navigateTo);
    }
  }, [timeLeft, myResponse?.accepted, navigate, navigateTo]);

  const handleAccept = () => {
    onAccept();
    navigate(navigateTo);
  };

  const handleDecline = () => {
    onDecline();
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-normal flex items-center gap-2">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className={cn('text-3xl font-mono font-bold', timeLeft <= 3 ? 'text-red-500' : 'text-foreground')}>
              {timeLeft}s
            </span>
          </div>

          {settingsText && (
            <div className="text-center text-sm text-muted-foreground">
              <p>{settingsText}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Joueurs</p>
            {members.map((member) => {
              const response = responses.find((r) => r.userId === member.userId);
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
                    {member.userId === currentUserId && (
                      <span className="ml-2 text-xs text-muted-foreground">(toi)</span>
                    )}
                    {member.userId === leaderId && (
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
          {!hasResponded ? (
            <>
              <Button
                variant="outline"
                onClick={handleDecline}
                className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white"
              >
                <X className="h-4 w-4 mr-2" />
                Refuser
              </Button>
              <Button
                variant="outline"
                onClick={handleAccept}
                className="flex-1 border-green-500/50 text-green-500 hover:bg-green-500 hover:text-white"
              >
                <Check className="h-4 w-4 mr-2" />
                Rejoindre
              </Button>
            </>
          ) : (
            <div className="w-full text-center text-sm text-muted-foreground">
              {myResponse.accepted ? (
                <span className="text-green-500">Tu as accepté. En attente des autres...</span>
              ) : (
                <span className="text-red-500">Tu as refusé.</span>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
