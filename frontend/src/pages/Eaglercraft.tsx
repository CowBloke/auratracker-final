import { RotateCcw, Swords, Wifi } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
                  Version navigateur intégrée avec support multijoueur via adresse serveur WebSocket.
                </p>
                <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3">
                  <Label htmlFor="eaglercraft-server" className="text-xs uppercase tracking-wide text-muted-foreground">
                    Adresse serveur multijoueur
                  </Label>
                  <Input
                    id="eaglercraft-server"
                    value={multiplayerInput}
                    onChange={(event) => setMultiplayerInput(event.target.value)}
                    placeholder="wss://exemple.serveur.com"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={launchMultiplayer}
                      disabled={!multiplayerInput.trim().startsWith('wss://') && !multiplayerInput.trim().startsWith('ws://')}
                    >
                      <Wifi className="mr-2 h-4 w-4" />
                      Lancer multijoueur
                    </Button>
                    <Button size="sm" variant="outline" onClick={clearMultiplayer}>
                      Session solo
                    </Button>
                  </div>
                </div>
                <div className="space-y-1 text-xs leading-relaxed">
                  <p>1. Colle une adresse serveur en <strong>wss://</strong> (ou <strong>ws://</strong> si ton serveur le demande).</p>
                  <p>2. Clique <strong>Lancer multijoueur</strong> pour ouvrir le client avec connexion rapide.</p>
                  <p>3. Si ça bloque, utilise <strong>Recharger</strong>, puis vérifie l&apos;adresse serveur.</p>
                  <p>4. Clique <strong>Session solo</strong> pour revenir à une session offline classique.</p>
                </div>
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
