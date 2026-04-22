import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, X, SkipForward, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTutorial } from './TutorialContext';
import type { TutorialPlacement } from './types';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_WIDTH = 300;
const TOOLTIP_GAP = 16;
const VIEWPORT_MARGIN = 12;

type ResolvedPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

function computePlacement(
  rect: SpotlightRect,
  desired: TutorialPlacement
): ResolvedPlacement {
  if (desired !== 'auto') return desired as ResolvedPlacement;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceRight = vw - rect.left - rect.width;
  const spaceLeft = rect.left;
  const spaceBottom = vh - rect.top - rect.height;
  const spaceTop = rect.top;
  const spaces: [ResolvedPlacement, number][] = [
    ['right', spaceRight],
    ['left', spaceLeft],
    ['bottom', spaceBottom],
    ['top', spaceTop],
  ];
  return spaces.sort((a, b) => b[1] - a[1])[0][0];
}

function tooltipStyle(
  rect: SpotlightRect,
  placement: ResolvedPlacement,
  tooltipHeight: number
): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (placement === 'center') {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: TOOLTIP_WIDTH,
    };
  }

  let top: number;
  let left: number;

  if (placement === 'right') {
    left = rect.left + rect.width + TOOLTIP_GAP;
    top = rect.top + rect.height / 2 - tooltipHeight / 2;
  } else if (placement === 'left') {
    left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
    top = rect.top + rect.height / 2 - tooltipHeight / 2;
  } else if (placement === 'bottom') {
    left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    top = rect.top + rect.height + TOOLTIP_GAP;
  } else {
    left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    top = rect.top - tooltipHeight - TOOLTIP_GAP;
  }

  left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN));
  top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - tooltipHeight - VIEWPORT_MARGIN));

  return { position: 'fixed', top, left, width: TOOLTIP_WIDTH };
}

function arrowStyle(placement: ResolvedPlacement): React.CSSProperties {
  const size = 8;
  if (placement === 'center') return { display: 'none' };
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  };
  if (placement === 'right') {
    return { ...base, top: '50%', left: -size, transform: 'translateY(-50%)', borderWidth: `${size}px ${size}px ${size}px 0`, borderColor: `transparent hsl(var(--popover)) transparent transparent` };
  }
  if (placement === 'left') {
    return { ...base, top: '50%', right: -size, transform: 'translateY(-50%)', borderWidth: `${size}px 0 ${size}px ${size}px`, borderColor: `transparent transparent transparent hsl(var(--popover))` };
  }
  if (placement === 'bottom') {
    return { ...base, top: -size, left: '50%', transform: 'translateX(-50%)', borderWidth: `0 ${size}px ${size}px ${size}px`, borderColor: `transparent transparent hsl(var(--popover)) transparent` };
  }
  return { ...base, bottom: -size, left: '50%', transform: 'translateX(-50%)', borderWidth: `${size}px ${size}px 0 ${size}px`, borderColor: `hsl(var(--popover)) transparent transparent transparent` };
}

function waitForElement(targetId: string, maxMs = 3000): Promise<Element | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const el = document.querySelector(`[data-tutorial-id="${targetId}"]`);
      if (el) { resolve(el); return; }
      if (Date.now() - start > maxMs) { resolve(null); return; }
      requestAnimationFrame(check);
    };
    check();
  });
}

export function TutorialOverlay() {
  const { active, currentStep, stepIndex, totalSteps, currentSection, isFirstStepOfSection, next, prev, stop, skipSection } = useTutorial();
  const navigate = useNavigate();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [resolvedPlacement, setResolvedPlacement] = useState<ResolvedPlacement>('center');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Element | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const updateSpotlight = useCallback((el: Element, pad: number) => {
    const r = el.getBoundingClientRect();
    setSpotlight({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
  }, []);

  const cleanupStep = useCallback(() => {
    targetRef.current = null;
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  useEffect(() => {
    if (!active || !currentStep) {
      cleanupStep();
      setSpotlight(null);
      return;
    }

    let cancelled = false;

    const setupStep = async () => {
      cleanupStep();

      if (currentStep.route) {
        navigate(currentStep.route, { replace: true });
      }

      const placement = currentStep.placement ?? 'auto';

      if (!currentStep.targetId) {
        setSpotlight(null);
        setResolvedPlacement('center');
        return;
      }

      const el = await waitForElement(currentStep.targetId);
      if (cancelled || !el) {
        setSpotlight(null);
        setResolvedPlacement('center');
        return;
      }

      targetRef.current = el;

      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;

      const pad = currentStep.spotlightPadding ?? 6;
      updateSpotlight(el, pad);

      const r = el.getBoundingClientRect();
      const synthetic: SpotlightRect = { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
      setResolvedPlacement(computePlacement(synthetic, placement));

      observerRef.current?.disconnect();
      observerRef.current = new ResizeObserver(() => {
        if (cancelled) return;
        updateSpotlight(el, pad);
      });
      observerRef.current.observe(el);
      observerRef.current.observe(document.body);
    };

    void setupStep();

    return () => {
      cancelled = true;
    };
  }, [active, currentStep, navigate, cleanupStep, updateSpotlight]);

  useEffect(() => {
    return () => cleanupStep();
  }, [cleanupStep]);

  if (!active || !currentStep) return null;

  const tooltipHeight = tooltipRef.current?.offsetHeight ?? 200;
  const tStyle = spotlight
    ? tooltipStyle(spotlight, resolvedPlacement, tooltipHeight)
    : { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: TOOLTIP_WIDTH };
  const aStyle = arrowStyle(spotlight ? resolvedPlacement : 'center');

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <>
      {/* Spotlight: pointer-events-none so all page interactions work normally */}
      {spotlight && (
        <div
          className="pointer-events-none rounded-lg transition-all duration-200"
          style={{
            position: 'fixed',
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            zIndex: 999995,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
            borderRadius: 8,
            outline: '2px solid rgba(255,255,255,0.12)',
          }}
        />
      )}

      {/* Dark overlay for center steps (no target) — pointer-events-none */}
      {!spotlight && (
        <div
          className="pointer-events-none fixed inset-0 bg-black/60"
          style={{ zIndex: 999990 }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-2xl"
        style={{ ...tStyle, zIndex: 999999 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={aStyle} />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/30 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {currentSection && (
              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                {currentSection.title}
              </span>
            )}
            <span className="truncate text-sm font-semibold">{currentStep.title}</span>
          </div>
          <button
            onClick={stop}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Quitter le tutoriel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 text-sm leading-relaxed">
          {currentStep.content}
        </div>

        {/* Action hint */}
        {currentStep.actionText && (
          <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-primary/10 px-3 py-2">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="text-xs font-medium text-primary">{currentStep.actionText}</p>
          </div>
        )}

        {/* Skip section banner */}
        {isFirstStepOfSection && currentSection && (
          <div className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Passer « {currentSection.title} »</span>
            <button
              onClick={skipSection}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <SkipForward className="h-3 w-3" />
              Passer
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-border/30 px-4 py-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {stepIndex + 1} / {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button size="sm" variant="ghost" onClick={prev} className="h-7 gap-1 px-2 text-xs">
                <ArrowLeft className="h-3 w-3" />
                Précédent
              </Button>
            )}
            <Button
              size="sm"
              onClick={isLast ? stop : next}
              className={cn('h-7 gap-1 px-3 text-xs', isLast && 'bg-primary text-primary-foreground hover:bg-primary/90')}
            >
              {isLast ? 'Terminer' : 'Suivant'}
              {!isLast && <ArrowRight className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
