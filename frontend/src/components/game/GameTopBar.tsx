import { useState, useEffect, type ReactNode } from 'react';
import { Maximize2, Minimize2, Trophy, HelpCircle, Zap, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gamesApi, type DailyGameRewardState } from '@/services/api';
import { cn } from '@/lib/utils';

interface GameTopBarProps {
  title: string;
  score: number;
  highScore: number;
  scoreSuffix?: string;
  scoreFormatter?: (value: number) => string;
  isNewHighScore?: boolean;
  rewards?: { aura: number; money: number } | null;
  controls: ReactNode;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  showLeaderboard?: boolean;
  onToggleLeaderboard?: () => void;
  children?: ReactNode;
  className?: string;
}

export function GameTopBar({
  title,
  score,
  highScore,
  scoreSuffix,
  scoreFormatter,
  isNewHighScore,
  rewards,
  controls,
  isFullscreen = false,
  onToggleFullscreen,
  showLeaderboard = false,
  onToggleLeaderboard,
  children,
  className,
}: GameTopBarProps) {
  const [showControls, setShowControls] = useState(false);
  const [showLimits, setShowLimits] = useState(false);
  const [dailyState, setDailyState] = useState<DailyGameRewardState | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    let active = true;

    const load = () => {
      void gamesApi.getDailyRewardState()
        .then(r => { if (active) setDailyState(r.data.state); })
        .catch(() => { if (active) setDailyState(null); });
    };

    load();
    const id = window.setInterval(load, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const formatScore = scoreFormatter ?? ((value: number) => value.toLocaleString());

  return (
    <div className={cn(
      'relative z-20 flex w-full items-center justify-between gap-3 rounded-2xl border border-border/40 bg-card/80 px-4 py-2.5 shadow-xl backdrop-blur-md',
      className
    )}>
      {/* Left: title + tutorial */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-semibold tracking-tight truncate">{title}</span>
        <div
          className="relative"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0">
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          {showControls && (
            <div className="absolute left-0 top-full z-50 mt-2 min-w-[190px] rounded-xl border border-border/50 bg-card p-3 shadow-2xl">
              {controls}
            </div>
          )}
        </div>
      </div>

      {/* Center: score */}
      <div className="flex items-center gap-5 shrink-0">
        <div className="text-center">
          <p className={cn('text-3xl font-semibold tabular-nums leading-none sm:text-[2.5rem]', isNewHighScore && 'text-amber-500')}>
            {formatScore(score)}
            {scoreSuffix ?? ''}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">Score</p>
        </div>
        <div className="h-6 w-px bg-border/50" />
        <div className="text-center">
          <p className="text-[10px] font-medium tabular-nums leading-none text-gray-500">{formatScore(highScore)}</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">Meilleur</p>
        </div>
        {rewards && (rewards.money > 0 || rewards.aura > 0) && (
          <>
            <div className="h-6 w-px bg-border/50" />
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
              {rewards.money > 0 && `+$${rewards.money}`}
              {rewards.money > 0 && rewards.aura > 0 && ' · '}
              {rewards.aura > 0 && `+${rewards.aura} aura`}
            </p>
          </>
        )}
      </div>

      {/* Right: limits, children, leaderboard, fullscreen */}
      <div className="flex items-center gap-1">
        {dailyState && (
          <div
            className="relative"
            onMouseEnter={() => setShowLimits(true)}
            onMouseLeave={() => setShowLimits(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
              <span className="tabular-nums">{dailyState.dailyGameAuraGiven}/{dailyState.dailyGameAuraLimit}</span>
            </button>
            {showLimits && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-xl border border-border/50 bg-card p-3 shadow-2xl space-y-2">
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Zap className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                    Aura aujourd&apos;hui
                  </span>
                  <span className="font-semibold tabular-nums">{dailyState.dailyGameAuraGiven}/{dailyState.dailyGameAuraLimit}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Coins className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    Argent jeux
                  </span>
                  <span className="font-semibold tabular-nums">{dailyState.dailyGameMoneyGiven} / {dailyState.dailyGameMoneyLimit}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {children}

        {onToggleLeaderboard && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onToggleLeaderboard}
            title={showLeaderboard ? 'Masquer le classement' : 'Afficher le classement'}
          >
            <Trophy className={cn('h-3.5 w-3.5 transition-colors', showLeaderboard ? 'text-foreground' : 'text-muted-foreground')} />
          </Button>
        )}

        {onToggleFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          >
            {isFullscreen
              ? <Minimize2 className="h-3.5 w-3.5" />
              : <Maximize2 className="h-3.5 w-3.5" />
            }
          </Button>
        )}
      </div>
    </div>
  );
}
