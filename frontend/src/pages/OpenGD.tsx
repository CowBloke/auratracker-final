import { RotateCcw, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
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
    <PageShell>
      <div className={cn('grid gap-4', isFullscreen ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]')}>
        <div
          ref={containerRef}
          className={cn('flex flex-col gap-3', isFullscreen && 'min-h-screen w-screen bg-background px-4 py-4')}
        >
          <GameFullscreenToolbar isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} className="w-full">
            <GamePauseButton
              isPaused={isPaused}
              onToggle={() => setIsPaused((current) => !current)}
              disabled={!buildDetected}
            />
            <Button size="sm" variant="outline" onClick={restartSession} disabled={!buildDetected}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Recharger
            </Button>
          </GameFullscreenToolbar>

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
                description="La session reste affichée mais les interactions sont gelées par-dessus."
              />
            </GameFullscreenStage>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Build web manquant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Le dépôt OpenGD a été copié dans <code>{SOURCE_REPO_COPY}</code>, mais il ne contient pas de build navigateur prêt à lancer automatiquement.
                </p>
                <p>
                  Si tu ajoutes un build web avec un <code>index.html</code> dans <code>/frontend/public/opengd</code>, la page le détectera et le lancera directement.
                </p>
                <p>
                  Dépôt source: <a href={UPSTREAM_REPO} target="_blank" rel="noreferrer" className="underline underline-offset-4">{UPSTREAM_REPO}</a>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {!isFullscreen && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Square className="h-4 w-4 text-muted-foreground" />
                  OpenGD
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Intégration native au hub jeux AuraTracker avec le même shell UI que les autres jeux iframe (plein écran, pause, rechargement).
                </p>
                <p>
                  OpenGD est une implémentation open source de Geometry Dash; la page est prête et basculera automatiquement vers le mode jouable dès qu&apos;un build web sera disponible.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}