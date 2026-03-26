import { RotateCcw, Swords } from 'lucide-react';
import { useState } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { cn } from '@/lib/utils';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const GAME_SRC = '/eaglercraft/index.html';

export default function Eaglercraft() {
  const { containerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const [sessionKey, setSessionKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const restartSession = () => {
    setIsPaused(false);
    setSessionKey((prev) => prev + 1);
  };

  return (
    <PageShell>
      <div className={cn('grid gap-4', isFullscreen ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]')}>
        <div
          ref={containerRef}
          className={cn('flex flex-col gap-3', isFullscreen && 'min-h-screen w-screen bg-background px-4 py-4')}
        >
          <GameFullscreenToolbar isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} className="w-full">
            <GamePauseButton isPaused={isPaused} onToggle={() => setIsPaused((current) => !current)} />
            <Button size="sm" variant="outline" onClick={restartSession}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Recharger
            </Button>
          </GameFullscreenToolbar>

          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={GAME_WIDTH} baseHeight={GAME_HEIGHT}>
            <iframe
              key={sessionKey}
              src={`${GAME_SRC}?k=${sessionKey}`}
              title="Eaglercraft"
              className="block h-full w-full rounded-lg border border-border/30 bg-black"
              allow="fullscreen; autoplay; clipboard-read; clipboard-write; pointer-lock"
            />
            <GamePauseOverlay
              visible={isPaused}
              onResume={() => setIsPaused(false)}
              description="La session reste affichée mais les interactions sont gelées par-dessus."
            />
          </GameFullscreenStage>
        </div>

        {!isFullscreen && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Swords className="h-4 w-4 text-muted-foreground" />
                  Eaglercraft
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Version offline intégrée directement au site pour lancer une session depuis le hub.
                </p>
                <p>
                  Si l&apos;écran reste noir ou si le jeu fige, recharge la session avec le bouton ci-dessus.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}
