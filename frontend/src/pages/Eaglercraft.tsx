import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Play, RotateCcw, SlidersHorizontal, Swords, Wifi } from 'lucide-react';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameTopBar } from '@/components/game/GameTopBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  const topBarControls = (
    <div className="space-y-4 text-xs">
      <div className="rounded-lg border border-border/60 p-3 bg-muted/30 space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Swords className="h-3 w-3" />
          Multijoueur
        </p>
        <div className="space-y-2 pt-1">
          <Label htmlFor="eaglercraft-server" className="text-[10px] text-muted-foreground">ADRESSE SERVEUR (WSS://)</Label>
          <Input
            id="eaglercraft-server"
            value={multiplayerInput}
            onChange={(e) => setMultiplayerInput(e.target.value)}
            placeholder="wss://exemple.com"
            className="h-8 text-xs bg-background/50"
          />
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 h-8 text-[11px]"
              onClick={launchMultiplayer}
              disabled={!multiplayerInput.trim().startsWith('wss://') && !multiplayerInput.trim().startsWith('ws://')}
            >
              <Wifi className="mr-1.5 h-3 w-3" />
              Join
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 text-[11px]" onClick={clearMultiplayer}>
              Solo
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 space-y-1.5 text-[10px] text-muted-foreground leading-relaxed">
        <p>1. Colle une adresse serveur en <strong>wss://</strong>.</p>
        <p>2. Clique <strong>Join</strong> pour connexion rapide.</p>
        <p>3. <strong>Solo</strong> pour revenir au mode offline.</p>
      </div>

      <Separator />

      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center h-8 text-xs"
        onClick={restartSession}
      >
        <RotateCcw className="mr-2 h-3 w-3" />
        Reload Game
      </Button>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8 ${isFullscreen ? 'min-h-screen w-screen items-center bg-background px-4 py-4' : ''}`}
    >
      <GameTopBar
        title="Eaglercraft"
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
            <DialogTitle>Parametres Eaglercraft</DialogTitle>
          </DialogHeader>
          {topBarControls}
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-center gap-6">
        <div className="flex w-full max-w-[1280px] flex-col overflow-hidden">
          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={GAME_WIDTH} baseHeight={GAME_HEIGHT}>
            <iframe
              ref={iframeRef}
              key={sessionKey}
              src={gameSrc}
              title="Eaglercraft"
              className="block h-full w-full rounded-[28px] border border-border/30 bg-black shadow-2xl"
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
              description="La session reste affichée mais les interactions sont gelées par-dessus."
            />
          </GameFullscreenStage>
        </div>
      </div>
    </div>
  );
}
