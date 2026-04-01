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
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(key) !== '1';
  });
  const anchorRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; arrowOffset: number } | null>(null);

  function dismiss() {
    localStorage.setItem(key, '1');
    setVisible(false);
  }

  useLayoutEffect(() => {
    if (!visible) {
      setPosition(null);
      return;
    }

    const gap = 10;
    const edgePadding = 8;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      let left = rect.left + rect.width / 2;
      let top = rect.top - gap;

      if (side === 'bottom') {
        top = rect.bottom + gap;
      } else if (side === 'left') {
        left = rect.left - gap;
        top = rect.top + rect.height / 2;
      } else if (side === 'right') {
        left = rect.right + gap;
        top = rect.top + rect.height / 2;
      }

      const bubble = bubbleRef.current;
      if (bubble) {
        const bubbleWidth = bubble.offsetWidth;
        const bubbleHeight = bubble.offsetHeight;

        if (side === 'top' || side === 'bottom') {
          const half = bubbleWidth / 2;
          const minLeft = edgePadding + half;
          const maxLeft = window.innerWidth - edgePadding - half;
          left = Math.min(maxLeft, Math.max(minLeft, left));
        } else {
          const half = bubbleHeight / 2;
          const minTop = edgePadding + half;
          const maxTop = window.innerHeight - edgePadding - half;
          top = Math.min(maxTop, Math.max(minTop, top));
        }
      }

      let arrowOffset = 0;

      if (bubble) {
        const bubbleWidth = bubble.offsetWidth;
        const bubbleHeight = bubble.offsetHeight;

        if (side === 'top' || side === 'bottom') {
          const bubbleLeft = left - bubbleWidth / 2;
          const anchorCenterX = rect.left + rect.width / 2;
          arrowOffset = Math.min(bubbleWidth - 14, Math.max(14, anchorCenterX - bubbleLeft));
        } else {
          const bubbleTop = top - bubbleHeight / 2;
          const anchorCenterY = rect.top + rect.height / 2;
          arrowOffset = Math.min(bubbleHeight - 14, Math.max(14, anchorCenterY - bubbleTop));
        }
      }

      setPosition({ top, left, arrowOffset });
    };

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible, side]);

  const placementClass =
    side === 'top'
      ? '-translate-x-1/2 -translate-y-full'
      : side === 'bottom'
        ? '-translate-x-1/2'
        : side === 'left'
          ? '-translate-x-full -translate-y-1/2'
          : '-translate-y-1/2';

  const bubble = (
    <div
      ref={bubbleRef}
      className={cn(
        'fixed z-[120] pointer-events-auto',
        'animate-in fade-in-0 zoom-in-95 duration-150',
        placementClass,
      )}
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      <div className="relative flex items-start gap-2 rounded-md border border-primary/40 bg-background px-2.5 py-1.5 shadow-lg max-w-[min(22rem,calc(100vw-16px))]">
        <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground leading-none tracking-wide">
          NEW
        </span>
        <span className="min-w-0 flex-1 text-xs font-medium text-foreground/90 whitespace-normal break-words leading-4">{label}</span>
        <button
          onClick={dismiss}
          className="ml-0.5 mt-0.5 rounded p-0.5 hover:bg-primary/20 transition-colors text-primary/50 hover:text-primary"
          aria-label="Fermer l'indice"
        >
          <X className="w-3 h-3" />
        </button>

        {/* Arrow caret pointing toward the wrapped element */}
        <div
          className={cn(
            'absolute w-2.5 h-2.5 bg-background rotate-45',
            'border-primary/40',
            side === 'top'    && 'bottom-0 -translate-x-1/2 translate-y-1/2 border-b border-r',
            side === 'bottom' && 'top-0 -translate-x-1/2 -translate-y-1/2 border-t border-l',
            side === 'left'   && 'right-0 -translate-y-1/2 translate-x-1/2 border-t border-r',
            side === 'right'  && 'left-0 -translate-y-1/2 -translate-x-1/2 border-b border-l',
          )}
          style={
            position
              ? side === 'top' || side === 'bottom'
                ? { left: `${position.arrowOffset}px` }
                : { top: `${position.arrowOffset}px` }
              : undefined
          }
        />
      </div>
    </div>
  );

  return (
    <div ref={anchorRef} className={cn('relative inline-flex', className)}>
      {children}
      {visible && typeof document !== 'undefined' && position ? createPortal(bubble, document.body) : null}
    </div>
  );
}
