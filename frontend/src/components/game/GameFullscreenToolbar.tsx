import { useEffect, useState, type ReactNode } from 'react';
import { Coins, Zap } from 'lucide-react';
import { GameFullscreenButton } from '@/components/game/GameFullscreenButton';
import { gamesApi, type DailyGameRewardState } from '@/services/api';
import { cn } from '@/lib/utils';

interface GameFullscreenToolbarProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  children?: ReactNode;
  className?: string;
}

export function GameFullscreenToolbar({
  isFullscreen,
  onToggleFullscreen,
  children,
  className,
}: GameFullscreenToolbarProps) {
  const [dailyGameRewardState, setDailyGameRewardState] = useState<DailyGameRewardState | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !localStorage.getItem('token')) {
      return;
    }

    let isActive = true;

    const loadDailyGameRewardState = () => {
      void gamesApi.getDailyRewardState()
        .then((response) => {
          if (isActive) {
            setDailyGameRewardState(response.data.state);
          }
        })
        .catch(() => {
          if (isActive) {
            setDailyGameRewardState(null);
          }
        });
    };

    loadDailyGameRewardState();
    const intervalId = window.setInterval(loadDailyGameRewardState, 30_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDailyGameRewardState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className={cn('flex w-full items-center justify-between gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {dailyGameRewardState && (
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Zap className="h-3.5 w-3.5 text-yellow-400" />
              <span>Aura aujourd&apos;hui</span>
              <span className="font-semibold tabular-nums text-foreground">
                {dailyGameRewardState.dailyGameAuraGiven}/{dailyGameRewardState.dailyGameAuraLimit}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Coins className="h-3.5 w-3.5 text-emerald-400" />
              <span>Argent aujourd&apos;hui</span>
              <span className="font-semibold tabular-nums text-foreground">
                {dailyGameRewardState.dailyGameMoneyGiven}/{dailyGameRewardState.dailyGameMoneyLimit}
              </span>
            </span>
          </div>
        )}
        {children}
      </div>
      <GameFullscreenButton isFullscreen={isFullscreen} onClick={onToggleFullscreen} />
    </div>
  );
}
