import { useEffect, useState } from 'react';
import { Swords, X, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';

const GAME_NAMES: Record<string, string> = {
  chess: 'Échecs',
  battleship: 'Bataille Navale',
  p4: 'Puissance 4',
  ballarena: 'Ball Arena',
};

interface DuelChallengePopupProps {
  challengerUsername: string;
  challengerUsernameColor?: string | null;
  gameType: 'chess' | 'battleship' | 'p4' | 'ballarena';
  timeLimit: number;
  sentAt: number;
  onAccept: () => void;
  onDecline: () => void;
}

export default function DuelChallengePopup({
  challengerUsername,
  challengerUsernameColor,
  gameType,
  timeLimit,
  sentAt,
  onAccept,
  onDecline,
}: DuelChallengePopupProps) {
  const [timeLeft, setTimeLeft] = useState(Math.ceil(timeLimit / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - sentAt;
      setTimeLeft(Math.max(0, Math.ceil((timeLimit - elapsed) / 1000)));
    }, 200);
    return () => clearInterval(interval);
  }, [sentAt, timeLimit]);

  const progress = (timeLeft / (timeLimit / 1000)) * 100;
  const isUrgent = timeLeft <= 8;

  return (
    <div className="fixed bottom-24 right-6 z-40 w-72 shadow-lg rounded-lg overflow-hidden border border-border bg-background animate-in slide-in-from-right-4 duration-300">
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className={cn('h-full transition-all duration-200', isUrgent ? 'bg-red-500' : 'bg-primary')}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Défi de duel</span>
          </div>
          <div className={cn('flex items-center gap-1 text-xs tabular-nums', isUrgent ? 'text-red-500 font-bold' : 'text-muted-foreground')}>
            <Clock className="h-3 w-3" />
            {timeLeft}s
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-snug">
          <UsernameDisplay
            username={challengerUsername}
            usernameColor={challengerUsernameColor}
            className="inline font-medium"
          />
          {' '}vous défie en{' '}
          <span className="text-foreground font-medium">{GAME_NAMES[gameType] ?? gameType}</span>
        </p>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-red-500/40 text-red-500 hover:bg-red-500/10 hover:border-red-500"
            onClick={onDecline}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Refuser
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={onAccept}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Accepter
          </Button>
        </div>
      </div>
    </div>
  );
}
