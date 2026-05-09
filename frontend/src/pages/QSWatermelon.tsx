import { useCallback, useEffect, useRef, useState } from 'react';
import { GameTopBar } from '@/components/game/GameTopBar';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';
import { useHideGameLeaderboards } from '@/lib/game-preferences';
import { toast } from '@/hooks/use-toast';

const GAME_TYPE = 'qs_watermelon';
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 800;
const GAME_SOURCE = 'aura-qs-watermelon';
const DUPLICATE_SCORE_WINDOW_MS = 1500;

interface QSWatermelonMessage {
  source?: string;
  type?: 'game-over';
  score?: number;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function QSWatermelon() {
  const { user, refreshUser } = useAuth();
  const hideGameLeaderboards = useHideGameLeaderboards();
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const lastSubmitAttemptRef = useRef<{ score: number; at: number } | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch {
      // noop
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const submitScore = useCallback(async (score: number) => {
    if (!Number.isFinite(score) || score <= 0) return;

    const now = Date.now();
    const lastAttempt = lastSubmitAttemptRef.current;
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
        await fetchStats();
        await fetchLeaderboard();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await wait(300 * attempt);
        }
      }
    }

    console.error('Failed to submit QS Watermelon score after retries:', lastError);
    toast('Score non comptabilise', {
      description: "La fin de partie n'a pas pu etre enregistree. Rejoue une partie dans quelques secondes.",
      duration: 4500,
    });
  }, [fetchLeaderboard, fetchStats, refreshUser]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<QSWatermelonMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.source !== GAME_SOURCE) return;
      if (event.data.type !== 'game-over') return;

      const finalScore = Number.isFinite(event.data.score)
        ? Math.max(0, Math.floor(event.data.score ?? 0))
        : 0;

      void submitScore(finalScore);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [submitScore]);

  const handleDeleteScore = useCallback(async (userId: string, _username: string) => {
    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      await fetchLeaderboard();
      if (userId === user?.id) {
        setHighScore(0);
      }
    } catch {
      // noop
    }
  }, [fetchLeaderboard, user?.id]);

  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const leaderboardVisible = showLeaderboard && !hideGameLeaderboards;

  return (
    <div
      ref={gameContainerRef}
      className={`relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8 ${isFullscreen ? 'min-h-screen w-screen items-center bg-background px-4 py-4' : ''}`}
    >
      <GameTopBar
        title="QS Watermelon"
        score={highScore}
        highScore={highScore}
        isNewHighScore={false}
        rewards={null}
        controls={
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Garde le centre propre au debut pour t&apos;offrir plus de latitude.</p>
            <p className="text-xs text-muted-foreground">Ne force pas toutes les fusions en haut de pile.</p>
            <p className="text-xs text-muted-foreground">Les grosses chaines naissent d&apos;une base compacte.</p>
          </div>
        }
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showLeaderboard={leaderboardVisible}
        onToggleLeaderboard={() => setShowLeaderboard((v) => !v)}
      />

      <div className="flex items-start justify-center gap-4">
        <div className="flex w-full max-w-[480px] flex-col">
          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={CANVAS_WIDTH} baseHeight={CANVAS_HEIGHT}>
            <iframe
              src="/watermelon/index.html"
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block h-full w-full rounded-2xl border border-border/40 shadow-sm"
              style={{ display: 'block' }}
              allow="autoplay"
              title="Watermelon Game"
            />
          </GameFullscreenStage>
        </div>

        {leaderboardVisible && !isFullscreen && (
          <div className="w-[240px] shrink-0 hidden lg:block">
            <GameLeaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              isAdmin={user?.isAdmin}
              onDeleteScore={handleDeleteScore}
              title="Classement"
              maxHeight={420}
            />
          </div>
        )}
      </div>
    </div>
  );
}

