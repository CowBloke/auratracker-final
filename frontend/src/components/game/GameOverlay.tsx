import type { ComponentType, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

interface GameOverlayProps {
  visible?: boolean;
  title: string;
  description?: string;
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
