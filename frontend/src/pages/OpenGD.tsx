import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, SlidersHorizontal, Square } from 'lucide-react';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameTopBar } from '@/components/game/GameTopBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

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
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

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

  const topBarControls = (
    <div className="space-y-4 text-xs">
      <div className="rounded-lg border border-border/60 p-3 bg-muted/30 space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Square className="h-3 w-3" />
          À propos
        </p>
        <p className="text-muted-foreground leading-relaxed italic">
          OpenGD est une implémentation open source de Geometry Dash. Intégration native au hub jeux Aura avec le même shell UI.
        </p>
      </div>

      <Separator />

      <div className="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider">Liens</p>
        <p className="text-muted-foreground break-all">
          Repo: <a href={UPSTREAM_REPO} target="_blank" rel="noreferrer" className="underline">{UPSTREAM_REPO}</a>
        </p>
      </div>

      <Separator />

      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center h-8 text-xs"
        onClick={restartSession}
        disabled={!buildDetected}
      >
        <RotateCcw className="mr-2 h-3 w-3" />
        Recharger le jeu
      </Button>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8 ${isFullscreen ? 'min-h-screen w-screen items-center bg-background px-4 py-4' : ''}`}
    >
      <GameTopBar
        title="OpenGD"
        score={0}
        highScore={0}
        controls={topBarControls}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      >
        <div className="flex items-center gap-2">
          <GamePauseButton
            isPaused={isPaused}
            onToggle={() => setIsPaused(v => !v)}
            disabled={!buildDetected}
            className="h-7 w-7"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => setShowSettingsDialog(true)}
            title="Parametres"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </GameTopBar>

      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Parametres OpenGD</DialogTitle>
          </DialogHeader>
          {topBarControls}
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-center gap-6">
        <div className="flex w-full max-w-[1280px] flex-col overflow-hidden">
          {buildDetected ? (
            <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={GAME_WIDTH} baseHeight={GAME_HEIGHT}>
              <iframe
                ref={iframeRef}
                key={sessionKey}
                src={`${GAME_SRC}?k=${sessionKey}`}
                title="OpenGD"
                className="block h-full w-full rounded-[28px] border border-border/30 bg-black shadow-2xl"
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
            <div className="rounded-[28px] border border-border/50 bg-card p-12 text-center space-y-4">
              <Square className="h-12 w-12 mx-auto text-muted-foreground/20" />
              <h3 className="text-xl font-bold">Build web manquant</h3>
              <div className="text-sm text-muted-foreground max-w-md mx-auto space-y-2">
                <p>
                  Le dépôt OpenGD a été copié dans <code>{SOURCE_REPO_COPY}</code>, mais il ne contient pas de build navigateur prêt.
                </p>
                <p>
                  Ajoute un build web avec un <code>index.html</code> dans <code>/frontend/public/opengd</code> pour le rendre jouable.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
