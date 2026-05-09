import { RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameTopBar } from '@/components/game/GameTopBar';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { cn } from '@/lib/utils';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const GAME_SRC = '/opengd/index.html';
const SOURCE_REPO_COPY = '/opengd';
const UPSTREAM_REPO = 'https://github.com/Open-GD/OpenGD';

export default function OpenGD() {
  const { containerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [sessionKey, setSessionKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [buildDetected, setBuildDetected] = useState<boolean | null>(null);

  const focusGame = useCallback(() => {
    window.requestAnimationFrame(() => {
      const frame = iframeRef.current;
      if (!frame) return;

      frame.focus();
      frame.contentWindow?.focus();
    });
  }, []);

  const restartSession = () => {
    setIsPaused(false);
    setSessionKey((prev) => prev + 1);
  };

  useEffect(() => {
    const detectBuild = async () => {
      try {
        const response = await fetch(`${GAME_SRC}?t=${Date.now()}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          setBuildDetected(false);
          return;
        }

        const html = await response.text();
        const isPlayableWebBuild =
          html.includes('<canvas') ||
          html.includes('Module') ||
          html.includes('WebAssembly');

        setBuildDetected(isPlayableWebBuild);
      } catch {
        setBuildDetected(false);
      }
    };

    void detectBuild();
  }, []);

  useEffect(() => {
    if (buildDetected && !isPaused) {
      focusGame();
    }
  }, [buildDetected, focusGame, isFullscreen, isPaused, sessionKey]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8',
        isFullscreen && 'min-h-screen w-screen items-center bg-background px-4 py-4'
      )}
    >
      <GameTopBar
        title="OpenGD"
        score={0}
        highScore={0}
        isNewHighScore={false}
        rewards={null}
        controls={(
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Implementation open source de Geometry Dash.</p>
            <p className="text-xs text-muted-foreground">Depot source: <a href={UPSTREAM_REPO} target="_blank" rel="noreferrer" className="underline underline-offset-4">{UPSTREAM_REPO}</a></p>
          </div>
        )}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showLeaderboard={false}
        onToggleLeaderboard={() => {}}
      >
        <GamePauseButton
          isPaused={isPaused}
          onToggle={() => setIsPaused((current) => !current)}
          disabled={!buildDetected}
        />
        <Button size="sm" variant="outline" onClick={restartSession} disabled={!buildDetected}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Recharger
        </Button>
      </GameTopBar>

      <div className="flex items-start justify-center gap-4">
        <div className="flex w-full max-w-[1280px] flex-col">
          {buildDetected ? (
            <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={GAME_WIDTH} baseHeight={GAME_HEIGHT}>
              <iframe
                ref={iframeRef}
                key={sessionKey}
                src={`${GAME_SRC}?k=${sessionKey}`}
                title="OpenGD"
                className="block h-full w-full rounded-lg border border-border/30 bg-black"
                allow="fullscreen; autoplay; clipboard-read; clipboard-write; pointer-lock; keyboard-map; gamepad"
                tabIndex={0}
                onLoad={focusGame}
                onMouseDown={focusGame}
              />
              <GamePauseOverlay
                visible={isPaused}
                onResume={() => {
                  setIsPaused(false);
                  focusGame();
                }}
                description="La session reste affichee mais les interactions sont gelees par-dessus."
              />
            </GameFullscreenStage>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Build web manquant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Le depot OpenGD a ete copie dans <code>{SOURCE_REPO_COPY}</code>, mais il ne contient pas de build navigateur pret a lancer automatiquement.
                </p>
                <p>
                  Si tu ajoutes un build web avec un <code>index.html</code> dans <code>/frontend/public/opengd</code>, la page le detectera et le lancera directement.
                </p>
                <p>
                  Depot source: <a href={UPSTREAM_REPO} target="_blank" rel="noreferrer" className="underline underline-offset-4">{UPSTREAM_REPO}</a>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
