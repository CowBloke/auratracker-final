import { Bird, Coins, Play, RotateCcw, Trophy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const GAME_SRC = '/crossy-road/index.html';
const GAME_TYPE = 'crossy_road';
const HOST_SOURCE = 'aura-crossy-road-host';
const GAME_SOURCE = 'aura-crossy-road';
const DUPLICATE_SCORE_WINDOW_MS = 1500;

type RunnerStatus = 'idle' | 'running' | 'paused' | 'crashed';
type CrossyMode = 'classic' | 'money';

const MODE_META: Record<CrossyMode, {
  label: string;
  title: string;
  summary: string;
  accent: string;
  detail: string;
}> = {
  classic: {
    label: 'Classique',
    title: 'Crossy Road original',
    summary: 'Traverse le plus loin possible et score chaque ligne franchie.',
    accent: 'from-lime-500/30 via-emerald-500/20 to-transparent',
    detail: 'Mode fidèle: routes, rails, rivières, pièces et score distance.',
  },
  money: {
    label: 'Dollar Run',
    title: 'Mission Uncrossable vibe',
    summary: 'Chaque palier augmente ta cagnotte. Si tu meurs, tu repars avec 0.',
    accent: 'from-amber-500/30 via-orange-500/20 to-transparent',
    detail: 'Fais monter le combo, prends le risque, puis cash out avant de te faire écraser.',
  },
};

interface CrossyRoadMessage {
  source?: string;
  type?: 'ready' | 'state' | 'game-over';
  status?: RunnerStatus;
  score?: number;
  highScore?: number;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function CrossyRoad() {
  const { user, refreshUser } = useAuth();
  const { containerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSubmitAttemptRef = useRef<{ score: number; at: number } | null>(null);

  const [sessionKey, setSessionKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [buildDetected, setBuildDetected] = useState<boolean | null>(null);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [highScore, setHighScore] = useState(0);
  const [status, setStatus] = useState<RunnerStatus>('idle');
  const [selectedMode, setSelectedMode] = useState<CrossyMode>('classic');
  const [showModeSelector, setShowModeSelector] = useState(true);

  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);
  const canPause = buildDetected === true && status === 'running';
  const currentMode = MODE_META[selectedMode];
  const gameSrc = `${GAME_SRC}?mode=${selectedMode}&k=${sessionKey}`;

  const postToGame = useCallback((type: 'pause' | 'resume' | 'restart' | 'focus') => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: HOST_SOURCE,
        type,
      },
      window.location.origin
    );
  }, []);

  const focusGame = useCallback(() => {
    window.requestAnimationFrame(() => {
      const frame = iframeRef.current;
      if (!frame) return;

      frame.focus();
      frame.contentWindow?.focus();
      postToGame('focus');
    });
  }, [postToGame]);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch crossy road stats:', error);
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch crossy road leaderboard:', error);
      setLeaderboard([]);
    }
  }, []);

  useEffect(() => {
    if (!buildDetected) return;
    void fetchStats();
    void fetchLeaderboard();
  }, [buildDetected, fetchLeaderboard, fetchStats]);

  const submitScore = useCallback(async (score: number) => {
    if (!Number.isFinite(score) || score <= 0) return;
    const now = Date.now();
    const lastAttempt = lastSubmitAttemptRef.current;

    // Ignore near-instant duplicate events from the same game-over frame.
    if (lastAttempt && lastAttempt.score === score && now - lastAttempt.at < DUPLICATE_SCORE_WINDOW_MS) {
      return;
    }

    lastSubmitAttemptRef.current = { score, at: now };

    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await gamesApi.complete(GAME_TYPE, {
          score,
          won: true,
        });

        if (response.data.isNewHighScore) {
          setHighScore(score);
        }
        await refreshUser();
        await fetchLeaderboard();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await wait(300 * attempt);
        }
      }
    }

    console.error('Failed to submit crossy road score after retries:', lastError);
    toast('Run non comptabilise', {
      description: "La recompense n'a pas pu etre enregistree. Rejoue une run dans quelques secondes.",
      duration: 4500,
    });
  }, [fetchLeaderboard, refreshUser]);

  const restartSession = () => {
    setIsPaused(false);
    setStatus('running');
    postToGame('restart');
    window.setTimeout(focusGame, 50);
  };

  const hardReloadSession = () => {
    setIsPaused(false);
    setStatus('idle');
    setSessionKey((prev) => prev + 1);
  };

  const selectMode = (mode: CrossyMode) => {
    setSelectedMode(mode);
    setShowModeSelector(false);
    setIsPaused(false);
    setStatus('idle');
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
        const isPlayableWebBuild = html.includes('<canvas') || html.includes('WebAssembly') || html.includes('Phaser');

        setBuildDetected(isPlayableWebBuild);
      } catch {
        setBuildDetected(false);
      }
    };

    void detectBuild();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<CrossyRoadMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.source !== GAME_SOURCE) return;

      const nextScore = Number.isFinite(event.data.score)
        ? Math.max(0, Math.floor(event.data.score ?? 0))
        : 0;
      const nextHighScore = Number.isFinite(event.data.highScore)
        ? Math.max(0, Math.floor(event.data.highScore ?? 0))
        : 0;

      if (event.data.type === 'ready' || event.data.type === 'state') {
        const nextStatus = event.data.status ?? 'idle';
        setStatus(nextStatus);
        setIsPaused(nextStatus === 'paused');
        if (nextHighScore > 0) {
          setHighScore((current) => Math.max(current, nextHighScore));
        }
      }

      if (event.data.type === 'game-over') {
        setStatus('crashed');
        setIsPaused(false);
        if (nextHighScore > 0) {
          setHighScore((current) => Math.max(current, nextHighScore));
        }
        void submitScore(nextScore);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [submitScore]);

  useEffect(() => {
    if (buildDetected && !isPaused) {
      focusGame();
    }
  }, [buildDetected, focusGame, isFullscreen, isPaused, sessionKey]);

  const handlePauseToggle = () => {
    if (!canPause && !isPaused) return;

    if (isPaused) {
      setIsPaused(false);
      setStatus('running');
      postToGame('resume');
      focusGame();
      return;
    }

    setIsPaused(true);
    setStatus('paused');
    postToGame('pause');
  };

  const handleDeleteScore = useCallback(async (userId: string, username: string) => {
    if (!confirm(`Supprimer le score de ${username} ?`)) return;

    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      if (userId === user?.id) {
        setHighScore(0);
      }
      await fetchLeaderboard();
    } catch (error) {
      console.error('Failed to delete crossy road score:', error);
    }
  }, [fetchLeaderboard, user?.id]);

  return (
    <PageShell>
      <div className={cn('grid gap-4', isFullscreen ? 'grid-cols-1' : 'grid-cols-1')}>
        <div
          ref={containerRef}
          className={cn('flex flex-col gap-3', isFullscreen && 'min-h-screen w-screen bg-background px-4 py-4')}
        >
          <GameFullscreenToolbar isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} className="w-full">
            <GamePauseButton
              isPaused={isPaused}
              onToggle={handlePauseToggle}
              disabled={!canPause && !isPaused}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowModeSelector(true);
                setIsPaused(false);
                setStatus('idle');
              }}
              disabled={!buildDetected}
            >
              <Trophy className="mr-2 h-4 w-4" />
              Choisir la version
            </Button>
            <Button size="sm" variant="outline" onClick={restartSession} disabled={!buildDetected}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Relancer
            </Button>
            <Button size="sm" variant="outline" onClick={hardReloadSession} disabled={!buildDetected}>
              <Play className="mr-2 h-4 w-4" />
              Recharger
            </Button>
          </GameFullscreenToolbar>

          {buildDetected ? (
            <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={GAME_WIDTH} baseHeight={GAME_HEIGHT}>
              {showModeSelector ? (
                <div className="flex h-full w-full items-center justify-center rounded-lg border border-border/30 bg-black px-4 py-5">
                  <div className="grid w-full max-w-5xl gap-4 md:grid-cols-2">
                    {(['classic', 'money'] as CrossyMode[]).map((mode) => {
                      const meta = MODE_META[mode];
                      const active = selectedMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => selectMode(mode)}
                          className={cn(
                            'group relative overflow-hidden rounded-3xl border p-6 text-left transition hover:-translate-y-1 hover:border-primary/50 hover:bg-accent/40',
                            active ? 'border-primary/60 bg-accent/30' : 'border-border/50 bg-background/80'
                          )}
                        >
                          <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80', meta.accent)} />
                          <div className="relative space-y-4">
                            <Badge variant="outline" className="border-white/20 bg-black/20 text-white">
                              {meta.label}
                            </Badge>
                            <div className="space-y-2">
                              <h3 className="text-2xl font-black tracking-tight text-foreground">{meta.title}</h3>
                              <p className="text-sm text-muted-foreground">{meta.summary}</p>
                            </div>
                            <p className="text-sm text-foreground/80">{meta.detail}</p>
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                              {mode === 'classic' ? <Bird className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
                              Lancer cette version
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  key={sessionKey}
                  src={gameSrc}
                  title={`Crossy Road - ${currentMode.label}`}
                  className="block h-full w-full rounded-lg border border-border/30 bg-black"
                  allow="fullscreen; autoplay; clipboard-read; clipboard-write; pointer-lock; keyboard-map; gamepad"
                  tabIndex={0}
                  onLoad={focusGame}
                  onMouseDown={focusGame}
                />
              )}
              <GamePauseOverlay
                visible={isPaused && !showModeSelector}
                onResume={() => {
                  handlePauseToggle();
                }}
                description="La session reste affichée mais le jeu est suspendu."
              />
            </GameFullscreenStage>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Build web manquant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Crossy Road est déjà intégré au hub jeux avec le même shell UI. Il suffit d&apos;ajouter un build web dans <code>/frontend/public/crossy-road</code> avec un <code>index.html</code> pour le rendre jouable.
                </p>
              </CardContent>
            </Card>
          )}

          {!isFullscreen && buildDetected && (
            <GameLeaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              isAdmin={isAdmin}
              onDeleteScore={handleDeleteScore}
              title={`Classement ${currentMode.label}`}
            />
          )}
        </div>

        {!isFullscreen && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Bird className="h-4 w-4 text-muted-foreground" />
                Crossy Road
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{currentMode.label}</Badge>
                {selectedMode === 'money' && <Badge variant="outline">Cash out pour valider</Badge>}
              </div>
              <p>{currentMode.summary}</p>
              <p>
                Ton meilleur score est enregistré automatiquement à chaque fin de run. En mode Dollar Run, seule une sortie avec cash out valide la récompense.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
