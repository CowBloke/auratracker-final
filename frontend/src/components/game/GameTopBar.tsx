import { useEffect, useState, type ReactNode } from 'react';
import { Coins, HelpCircle, Maximize2, Minimize2, Trophy, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  const [dailyState, setDailyState] = useState<DailyGameRewardState | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    let active = true;

    const load = () => {
      void gamesApi
        .getDailyRewardState()
        .then((response) => {
          if (active) setDailyState(response.data.state);
        })
        .catch(() => {
          if (active) setDailyState(null);
        });
    };

    load();
    const interval = window.setInterval(load, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const formatScore = scoreFormatter ?? ((value: number) => value.toLocaleString());
  const hasRewards = Boolean(rewards && (rewards.money > 0 || rewards.aura > 0));

  return (
    <Card className={cn('py-3', className)}>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-base font-semibold">{title}</h1>
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Aide et contrôles">
                    <HelpCircle />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Aide et contrôles</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-64">
              {controls}
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-semibold tabular-nums leading-none">
              {formatScore(score)}
              {scoreSuffix ?? ''}
            </span>
            <span className="text-xs text-muted-foreground">Score</span>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium tabular-nums leading-none">{formatScore(highScore)}</span>
            <span className="text-xs text-muted-foreground">Meilleur</span>
          </div>
          {isNewHighScore ? <Badge>Nouveau record</Badge> : null}
          {hasRewards && rewards ? (
            <Badge variant="secondary" className="tabular-nums">
              {rewards.money > 0 ? `+${rewards.money} €` : null}
              {rewards.money > 0 && rewards.aura > 0 ? ' · ' : null}
              {rewards.aura > 0 ? `+${rewards.aura} aura` : null}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {dailyState ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button variant="ghost" size="sm" className="tabular-nums">
                  <Zap />
                  {dailyState.dailyGameAuraGiven}/{dailyState.dailyGameAuraLimit}
                </Button>
              </HoverCardTrigger>
              <HoverCardContent align="end" className="w-60">
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Zap className="size-4" />
                      Aura aujourd&apos;hui
                    </span>
                    <span className="font-medium tabular-nums">
                      {dailyState.dailyGameAuraGiven}/{dailyState.dailyGameAuraLimit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Coins className="size-4" />
                      Argent jeux
                    </span>
                    <span className="font-medium tabular-nums">
                      {dailyState.dailyGameMoneyGiven} / {dailyState.dailyGameMoneyLimit}
                    </span>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : null}

          {children}

          {onToggleLeaderboard ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={showLeaderboard}
                  onPressedChange={onToggleLeaderboard}
                  aria-label={showLeaderboard ? 'Masquer le classement' : 'Afficher le classement'}
                >
                  <Trophy />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>{showLeaderboard ? 'Masquer le classement' : 'Afficher le classement'}</TooltipContent>
            </Tooltip>
          ) : null}

          {onToggleFullscreen ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleFullscreen}
                  aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                >
                  {isFullscreen ? <Minimize2 /> : <Maximize2 />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
