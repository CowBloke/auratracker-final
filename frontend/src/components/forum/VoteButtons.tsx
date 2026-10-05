import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoteButtonsProps {
  score: number;
  userVote: number;
  onVote: (value: number) => void;
  orientation?: 'horizontal' | 'vertical';
}

/** Vote pour/contre avec score, partagé par les posts et commentaires du forum. */
export function VoteButtons({ score, userVote, onVote, orientation = 'horizontal' }: VoteButtonsProps) {
  return (
    <div className={cn('inline-flex items-center rounded-md border', orientation === 'vertical' && 'flex-col')}>
      <Button
        variant={userVote === 1 ? 'secondary' : 'ghost'}
        size="icon-sm"
        aria-label="Voter pour"
        aria-pressed={userVote === 1}
        onClick={() => onVote(userVote === 1 ? 0 : 1)}
      >
        <ChevronUp />
      </Button>
      <span
        className={cn(
          'min-w-8 text-center text-sm font-semibold tabular-nums',
          userVote === 1 && 'text-success',
          userVote === -1 && 'text-destructive'
        )}
      >
        {score}
      </span>
      <Button
        variant={userVote === -1 ? 'secondary' : 'ghost'}
        size="icon-sm"
        aria-label="Voter contre"
        aria-pressed={userVote === -1}
        onClick={() => onVote(userVote === -1 ? 0 : -1)}
      >
        <ChevronDown />
      </Button>
    </div>
  );
}
