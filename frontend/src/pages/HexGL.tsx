import { RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { Button } from '@/components/ui/button';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameTopBar } from '@/components/game/GameTopBar';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const GAME_TYPE = 'hexgl';
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const GAME_SRC = '/hexgl/index.html';
const GAME_SOURCE = 'aura-hexgl';

interface HexGLMessage {
  source?: string;
  type?: 'ready' | 'finish' | 'destroyed';
  score?: number;
  lapTimes?: number[];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatHexGlTime = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return '--';
  }

  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const minutes = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;

  return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

export default function HexGL() {
  const { user, refreshUser } = useAuth();
  const { containerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const submittedRunRef = useRef<string | null>(null);

  const [sessionKey, setSessionKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScore] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);

  const focusGame = useCallback(() => {
    window.requestAnimationFrame(() => {
      const frame = iframeRef.current;
      if (!frame) return;

      frame.focus();
      frame.contentWindow?.focus();
    });
  }, []);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      const score = Number(response.data.stats?.highScore ?? 0);
      setHighScore(score > 0 ? score : null);
    } catch (error) {
      console.error('Failed to fetch HexGL stats:', error);
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch HexGL leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const restartSession = () => {
    setIsPaused(false);
    submittedRunRef.current = null;
    setSessionKey((prev) => prev + 1);
  };

  const submitScore = useCallback(async (score: number) => {
    if (!Number.isFinite(score) || score <= 0) return;

    const runKey = `${sessionKey}-${score}`;
    if (submittedRunRef.current === runKey) return;
    submittedRunRef.current = runKey;

    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await gamesApi.complete(GAME_TYPE, { score, won: true });

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

    submittedRunRef.current = null;
    console.error('Failed to submit HexGL score after retries:', lastError);
    toast('Score non enregistre', {
      description: "La course n'a pas pu etre sauvegardee. Rejoue dans quelques secondes.",
      duration: 4500,
    });
  }, [fetchLeaderboard, refreshUser, sessionKey]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<HexGLMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.source !== GAME_SOURCE) return;
      if (event.data.type !== 'finish') return;

      const nextScore = Number.isFinite(event.data.score)
        ? Math.max(0, event.data.score ?? 0)
        : 0;

      void submitScore(nextScore);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [submitScore]);

  useEffect(() => {
    if (!isPaused) {
      focusGame();
    }
  }, [focusGame, isFullscreen, isPaused, sessionKey]);

  const handleDeleteScore = useCallback(async (userId: string, _username: string) => {

    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      if (userId === user?.id) {
        setHighScore(null);
      }
      await fetchLeaderboard();
    } catch (error) {
      console.error('Failed to delete HexGL score:', error);
    }
  }, [fetchLeaderboard, user?.id]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8',
        isFullscreen && 'min-h-screen w-screen items-center bg-background px-4 py-4'
      )}
    >
      <GameTopBar
        title="HexGL"
        score={highScore ?? 0}
        highScore={highScore ?? 0}
        isNewHighScore={false}
        rewards={null}
        controls={(
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Course futuriste WebGL inspiree de Wipeout.</p>
            <p className="text-xs text-muted-foreground">Ton meilleur temps: {formatHexGlTime(highScore)}</p>
          </div>
        )}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showLeaderboard={showLeaderboard}
        onToggleLeaderboard={() => setShowLeaderboard((v) => !v)}
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
              src={`${GAME_SRC}?k=${sessionKey}`}
              title="HexGL"
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
              description="Le jeu continue en dessous, mais les interactions sont bloquees par-dessus."
            />
          </GameFullscreenStage>
        </div>

        {showLeaderboard && !isFullscreen && (
          <div className="w-[240px] shrink-0 hidden lg:block">
            <GameLeaderboard
              title="Classement HexGL"
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              scoreFormatter={formatHexGlTime}
              isAdmin={isAdmin}
              onDeleteScore={handleDeleteScore}
              maxHeight={480}
            />
          </div>
        )}
      </div>
    </div>
  );
}
