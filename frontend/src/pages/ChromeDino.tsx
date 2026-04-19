import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const GAME_TYPE = 'chrome_dino';
const GAME_SRC = '/chrome-dino/index.html';
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 420;
const HOST_SOURCE = 'aura-chrome-dino-host';
const GAME_SOURCE = 'aura-chrome-dino';
const MIN_REWARD_SCORE = 100;

type RunnerStatus = 'idle' | 'running' | 'paused' | 'crashed';

interface ChromeDinoMessage {
  source?: string;
  type?: 'ready' | 'state' | 'game-over';
  status?: RunnerStatus;
  score?: number;
  highScore?: number;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ChromeDino() {
  const { user, refreshUser } = useAuth();
  const { containerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSubmittedScoreRef = useRef<number | null>(null);

  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [highScore, setHighScore] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState<RunnerStatus>('idle');
  const [sessionKey, setSessionKey] = useState(0);

  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);
  const canPause = status === 'running';

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
      console.error('Failed to fetch chrome dino stats:', error);
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch chrome dino leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const submitScore = useCallback(async (score: number) => {
    if (!Number.isFinite(score) || score <= 0) return;
    if (lastSubmittedScoreRef.current === score) return;

    lastSubmittedScoreRef.current = score;

    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await gamesApi.complete(GAME_TYPE, {
          score,
          won: true,
        });

        setLastScore(score);
        setRewards({
          aura: response.data.auraReward,
          money: response.data.moneyReward,
        });
        setIsNewHighScore(response.data.isNewHighScore);
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

    lastSubmittedScoreRef.current = null;
    console.error('Failed to submit chrome dino score after retries:', lastError);
    toast('Run non comptabilise', {
      description: "La recompense n'a pas pu etre enregistree. Rejoue une run dans quelques secondes.",
      duration: 4500,
    });
  }, [fetchLeaderboard, refreshUser]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ChromeDinoMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.source !== GAME_SOURCE) return;

      const nextScore = Number.isFinite(event.data.score)
        ? Math.max(0, Math.floor(event.data.score ?? 0))
        : 0;
      const nextHighScore = Number.isFinite(event.data.highScore)
        ? Math.max(0, Math.floor(event.data.highScore ?? 0))
        : 0;

      if (event.data.type === 'ready' || event.data.type === 'state') {
        setStatus(event.data.status ?? 'idle');
        setIsPaused((event.data.status ?? 'idle') === 'paused');
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
    if (!isPaused) {
      focusGame();
    }
  }, [focusGame, isFullscreen, isPaused, sessionKey]);

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

  const resetUiSession = () => {
    setIsPaused(false);
    setStatus('idle');
    setLastScore(null);
    setRewards(null);
    setIsNewHighScore(false);
    lastSubmittedScoreRef.current = null;
  };

  const restartGame = () => {
    resetUiSession();
    postToGame('restart');
    window.setTimeout(focusGame, 50);
  };

  const hardReloadGame = () => {
    resetUiSession();
    setSessionKey((current) => current + 1);
  };

  const handleDeleteScore = useCallback(async (userId: string, username: string) => {

    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      if (userId === user?.id) {
        setHighScore(0);
      }
      await fetchLeaderboard();
    } catch (error) {
      console.error('Failed to delete chrome dino score:', error);
    }
  }, [fetchLeaderboard, user?.id]);

  return (
    <PageShell>
      <div className="grid gap-4 grid-cols-1">
        <div
          ref={containerRef}
          className={cn('flex flex-col gap-3', isFullscreen && 'min-h-screen w-screen bg-background px-4 py-4')}
        >
          <GameFullscreenToolbar isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} className="w-full">
            <GamePauseButton isPaused={isPaused} onToggle={handlePauseToggle} disabled={!canPause && !isPaused} />
            <Button size="sm" variant="outline" onClick={restartGame}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Relancer
            </Button>
            <Button size="sm" variant="outline" onClick={hardReloadGame}>
              <Play className="mr-2 h-4 w-4" />
              Recharger
            </Button>
          </GameFullscreenToolbar>

          <GameFullscreenStage
            isFullscreen={isFullscreen}
            baseWidth={GAME_WIDTH}
            baseHeight={GAME_HEIGHT}
            contentClassName="rounded-xl border border-border/50 bg-[#f3f3f3] shadow-sm"
          >
            <iframe
              ref={iframeRef}
              key={sessionKey}
              src={`${GAME_SRC}?k=${sessionKey}`}
              title="Chrome Dino"
              className="block h-full w-full"
              allow="fullscreen; autoplay"
              tabIndex={0}
              style={{ border: 'none' }}
              onLoad={focusGame}
              onMouseDown={focusGame}
            />
            <GamePauseOverlay
              visible={isPaused}
              onResume={handlePauseToggle}
              description="La run est mise en pause sans remplacer le jeu Chromium embarque."
            />
          </GameFullscreenStage>

          {!isFullscreen && (
            <Card className="border-border/60 bg-card/80">
              <CardContent className="flex flex-col gap-2 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div>
                  Score minimum récompensé: <span className="font-semibold text-foreground">{MIN_REWARD_SCORE}</span>.
                  Les gros runs et les nouveaux records paient un peu mieux.
                </div>
                <div className="text-right">
                  {lastScore !== null ? (
                    rewards && (rewards.money > 0 || rewards.aura > 0) ? (
                      <span className="font-medium text-foreground">
                        Dernière run {lastScore}: {rewards.money > 0 && `+$${rewards.money}`}
                        {rewards.money > 0 && rewards.aura > 0 && ' · '}
                        {rewards.aura > 0 && `+${rewards.aura} aura`}
                        {isNewHighScore ? ' · nouveau record' : ''}
                      </span>
                    ) : (
                      <span>
                        Dernière run {lastScore}: pas de récompense, il faut atteindre {MIN_REWARD_SCORE}.
                      </span>
                    )
                  ) : (
                    <span>Vise {MIN_REWARD_SCORE}+ pour commencer à gagner.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!isFullscreen && (
            <GameLeaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              isAdmin={isAdmin}
              onDeleteScore={handleDeleteScore}
              title="Classement Chrome Dino"
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}

