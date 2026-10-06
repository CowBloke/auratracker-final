import type { ComponentType, ReactNode } from 'react';
import { Play, RotateCcw, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatRewards } from '@/lib/format';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

interface GameOverlayProps {
  visible?: boolean;
  title: string;
  description?: ReactNode;
  icon?: ComponentType;
  children?: ReactNode;
}

/** Voile au-dessus de la zone de jeu : prêt à jouer, pause, fin de partie. */
export function GameOverlay({ visible = true, title, description, icon: Icon, children }: GameOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-sm">
        <CardContent>
          <Empty className="p-0">
            <EmptyHeader>
              {Icon ? (
                <EmptyMedia variant="icon">
                  <Icon />
                </EmptyMedia>
              ) : null}
              <EmptyTitle>{title}</EmptyTitle>
              {description ? <EmptyDescription>{description}</EmptyDescription> : null}
            </EmptyHeader>
            {children ? <EmptyContent className="flex-row justify-center">{children}</EmptyContent> : null}
          </Empty>
        </CardContent>
      </Card>
    </div>
  );
}

interface GameStartOverlayProps {
  visible?: boolean;
  onPlay: () => void;
  title?: string;
  description?: ReactNode;
  playLabel?: string;
}

/** Écran de démarrage standard : un seul bouton pour lancer la partie. */
export function GameStartOverlay({
  visible = true,
  onPlay,
  title = 'Prêt à jouer',
  description,
  playLabel = 'Jouer',
}: GameStartOverlayProps) {
  return (
    <GameOverlay visible={visible} icon={Play} title={title} description={description}>
      <Button onClick={onPlay}>
        <Play />
        {playLabel}
      </Button>
    </GameOverlay>
  );
}

interface GameOverOverlayProps {
  visible?: boolean;
  score: number;
  onReplay?: () => void;
  title?: string;
  /** Ligne complémentaire sous le score (ex. « 12 fruits tranchés »). */
  detail?: ReactNode;
  isNewHighScore?: boolean;
  rewards?: { money: number; aura: number } | null;
  scoreFormatter?: (value: number) => string;
  scoreLabel?: string;
  replayLabel?: string;
}

/** Écran de fin de partie standard : score, record, récompenses et bouton pour rejouer. */
export function GameOverOverlay({
  visible = true,
  score,
  onReplay,
  title = 'Partie terminée',
  detail,
  isNewHighScore,
  rewards,
  scoreFormatter = (value) => value.toLocaleString('fr-FR'),
  scoreLabel = 'Score',
  replayLabel = 'Rejouer',
}: GameOverOverlayProps) {
  const rewardsText = formatRewards(rewards);

  return (
    <GameOverlay
      visible={visible}
      icon={Trophy}
      title={title}
      description={
        <span className="flex flex-col items-center gap-2">
          <span>
            {scoreLabel} : <span className="font-medium tabular-nums text-foreground">{scoreFormatter(score)}</span>
          </span>
          {detail ? <span>{detail}</span> : null}
          {isNewHighScore || rewardsText ? (
            <span className="flex flex-wrap items-center justify-center gap-2">
              {isNewHighScore ? <Badge>Nouveau record</Badge> : null}
              {rewardsText ? (
                <Badge variant="secondary" className="tabular-nums">
                  {rewardsText}
                </Badge>
              ) : null}
            </span>
          ) : null}
        </span>
      }
    >
      {onReplay ? (
        <Button onClick={onReplay}>
          <RotateCcw />
          {replayLabel}
        </Button>
      ) : null}
    </GameOverlay>
  );
}
