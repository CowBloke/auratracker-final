import { RotateCcw, Wifi } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameTopBar } from '@/components/game/GameTopBar';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { cn } from '@/lib/utils';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const GAME_SRC = '/eaglercraft/index.html';

export default function Eaglercraft() {
  const { containerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [multiplayerInput, setMultiplayerInput] = useState('');
  const [activeJoinServer, setActiveJoinServer] = useState<string | null>(null);

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

  const launchMultiplayer = () => {
    const trimmed = multiplayerInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('wss://') && !trimmed.startsWith('ws://')) return;

    setIsPaused(false);
    setActiveJoinServer(trimmed);
    setSessionKey((prev) => prev + 1);
  };

  const clearMultiplayer = () => {
    setMultiplayerInput('');
    setActiveJoinServer(null);
    setIsPaused(false);
    setSessionKey((prev) => prev + 1);
  };

  const gameSrc = (() => {
    const params = new URLSearchParams({
      k: String(sessionKey),
    });

    if (activeJoinServer) {
      params.set('joinServer', activeJoinServer);
      params.set('serverName', 'Serveur rapide AuraTracker');
    }

    return `${GAME_SRC}?${params.toString()}`;
  })();

  useEffect(() => {
    if (!isPaused) {
      focusGame();
    }
  }, [focusGame, isFullscreen, isPaused, sessionKey]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8',
        isFullscreen && 'min-h-screen w-screen items-center bg-background px-4 py-4'
      )}
    >
      <GameTopBar
        title="Eaglercraft"
        score={0}
        highScore={0}
        isNewHighScore={false}
        rewards={null}
        controls={(
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Version navigateur de Minecraft avec support multijoueur WebSocket.</p>
            <div className="space-y-1">
              <Label htmlFor="eaglercraft-server-ctrl" className="text-xs text-muted-foreground">Serveur multijoueur (wss://)</Label>
              <Input
                id="eaglercraft-server-ctrl"
                value={multiplayerInput}
                onChange={(event) => setMultiplayerInput(event.target.value)}
                placeholder="wss://exemple.serveur.com"
                autoComplete="off"
                spellCheck={false}
                className="h-7 text-xs"
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={launchMultiplayer}
                  disabled={!multiplayerInput.trim().startsWith('wss://') && !multiplayerInput.trim().startsWith('ws://')}
                >
                  <Wifi className="mr-1 h-3 w-3" />
                  Multijoueur
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={clearMultiplayer}>
                  Solo
                </Button>
              </div>
            </div>
          </div>
        )}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showLeaderboard={false}
        onToggleLeaderboard={() => {}}
      >
        <GamePauseButton isPaused={isPaused} onToggle={() => setIsPaused((current) => !current)} />
        <Button size="sm" variant="outline" onClick={restartSession}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Recharger
        </Button>
      </GameTopBar>

      <div className="flex items-start justify-center gap-4">
        <div className="flex w-full max-w-[1280px] flex-col">
          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={GAME_WIDTH} baseHeight={GAME_HEIGHT}>
            <iframe
              ref={iframeRef}
              key={sessionKey}
              src={gameSrc}
              title="Eaglercraft"
              className="block h-full w-full rounded-lg border border-border/30 bg-black"
              allow="fullscreen; autoplay; clipboard-read; clipboard-write; pointer-lock; keyboard-map"
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
        </div>
      </div>
    </div>
  );
}
