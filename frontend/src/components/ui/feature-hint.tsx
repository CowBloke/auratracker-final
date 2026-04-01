/*
 * FeatureHint — dismissible "NEW" bubble pointing at any element
 *
 * Usage:
 *   import { FeatureHint } from '@/components/ui/feature-hint';
 *
 *   <FeatureHint id="my-feature" label="Découvre cette nouvelle fonctionnalité !">
 *     <Button>Click me</Button>
 *   </FeatureHint>
 *
 * Props:
 *   id       — unique string per hint; used as the localStorage key (required)
 *   label    — text shown in the bubble (required)
 *   side     — where the bubble appears relative to the element: 'top' | 'bottom' | 'left' | 'right'  (default: 'top')
 *   children — the element the hint points at (required)
 *
 * Dismissal:
 *   Clicking × saves `hint_dismissed_<id> = "1"` in localStorage.
 *   The hint will never appear again for that id, even after page reload.
 *
 * Examples:
 *   <FeatureHint id="inbox-v2" label="Tes notifications sont ici" side="bottom">
 *     <InboxButton />
 *   </FeatureHint>
 *
 *   <FeatureHint id="new-filter" label="Filtre par genre !" side="right">
 *     <FilterIcon />
 *   </FeatureHint>
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_PREFIX = 'hint_dismissed_';

interface FeatureHintProps {
  /** Unique key — stored in localStorage to remember dismissal */
  id: string;
  /** Short label shown in the hint bubble */
  label: string;
  /** Which side of the wrapped element the hint appears on (default: top) */
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps any element and shows a dismissible "NEW" hint bubble pointing at it.
 * Dismissal is persisted in localStorage — never shown again once closed.
 *
 * Usage:
 *   <FeatureHint id="inbox-button" label="Retrouve tes notifications ici">
 *     <Button>Inbox</Button>
 *   </FeatureHint>
 */
export function FeatureHint({ id, label, side = 'top', children, className }: FeatureHintProps) {
  const key = STORAGE_PREFIX + id;
  const [visible, setVisible] = useState(() => localStorage.getItem(key) !== '1');

  function dismiss() {
    localStorage.setItem(key, '1');
    setVisible(false);
  }

  return (
    <div className={cn('relative inline-flex', className)}>
      {children}

      {visible && (
        <div
          className={cn(
            'absolute z-50 pointer-events-auto',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            side === 'top'    && 'bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2',
            side === 'bottom' && 'top-[calc(100%+10px)] left-1/2 -translate-x-1/2',
            side === 'left'   && 'right-[calc(100%+10px)] top-1/2 -translate-y-1/2',
            side === 'right'  && 'left-[calc(100%+10px)] top-1/2 -translate-y-1/2',
          )}
        >
          <div className="relative flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 backdrop-blur-sm px-2.5 py-1.5 shadow-lg">
            <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground leading-none tracking-wide">
              NEW
            </span>
            <span className="text-xs font-medium text-primary/90 whitespace-nowrap">{label}</span>
            <button
              onClick={dismiss}
              className="ml-0.5 rounded p-0.5 hover:bg-primary/20 transition-colors text-primary/50 hover:text-primary"
              aria-label="Fermer l'indice"
            >
              <X className="w-3 h-3" />
            </button>

            {/* Arrow caret pointing toward the wrapped element */}
            <div
              className={cn(
                'absolute w-2.5 h-2.5 bg-primary/10 rotate-45',
                'border-primary/40',
                side === 'top'    && 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-b border-r',
                side === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-t border-l',
                side === 'left'   && 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-t border-r',
                side === 'right'  && 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 border-b border-l',
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
