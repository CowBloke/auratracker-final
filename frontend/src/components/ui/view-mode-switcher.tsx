import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'grid';

interface ViewModeSwitcherProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
}

export function ViewModeSwitcher({ value, onChange, className }: ViewModeSwitcherProps) {
  return (
    <div className={cn('ml-auto inline-flex shrink-0 rounded-md border border-border/60 p-0.5', className)}>
      <Button
        type="button"
        variant={value === 'list' ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => onChange('list')}
        className="h-8 w-8"
        aria-label="Vue liste"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={value === 'grid' ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => onChange('grid')}
        className="h-8 w-8"
        aria-label="Vue grille"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}