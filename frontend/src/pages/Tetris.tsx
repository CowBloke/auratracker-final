import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { cn } from '@/lib/utils';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { GameTopBar } from '@/components/game/GameTopBar';

interface TetrisGameEndMessage {
  type: 'AURA_TETRIS_GAME_END';
  won: boolean;
  score: number;
  lines: number;
  pieces: number;
  elapsedMs: number;
}

const GAME_WIDTH = 640;
const GAME_HEIGHT = 760;

export default function Tetris() {
  const { user, refreshUser } = useAuth();
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();

  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const lastSubmittedRef = useRef<string>('');

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const response = await gamesApi.getStats('tetris', user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [user]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard('tetris', 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchStats();
    fetchLeaderboard();
  }, [user, fetchStats, fetchLeaderboard]);

  const handleDeleteScore = async (userId: string, _username: string) => {

    try {
      await gamesApi.deleteStats('tetris', userId);
      fetchLeaderboard();
      if (userId === user?.id) {
        setHighScore(0);
      }
    } catch (error) {
      console.error('Failed to delete score:', error);
    }
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent<TetrisGameEndMessage>) => {
      const data = event.data;
      if (!data || data.type !== 'AURA_TETRIS_GAME_END') return;
      if (!user) return;

      const dedupeKey = `${data.score}:${data.lines}:${data.pieces}:${data.elapsedMs}`;
      if (dedupeKey === lastSubmittedRef.current) return;
      lastSubmittedRef.current = dedupeKey;

      try {
        const response = await gamesApi.complete('tetris', {
          score: Math.max(0, Math.floor(data.score)),
          won: Boolean(data.won),
        });

        setLastScore(Math.max(0, Math.floor(data.score)));
        setRewards({
          aura: response.data.auraReward,
          money: response.data.moneyReward,
        });
        setIsNewHighScore(Boolean(response.data.isNewHighScore));

        if (response.data.isNewHighScore) {
          setHighScore(Math.max(0, Math.floor(data.score)));
        }

        await refreshUser();
        fetchLeaderboard();
        fetchStats();
      } catch (error) {
        console.error('Failed to submit score:', error);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [user, refreshUser, fetchLeaderboard, fetchStats]);

  const restartSession = () => {
    lastSubmittedRef.current = '';
    setRewards(null);
    setIsNewHighScore(false);
    setLastScore(null);
    setIsPaused(false);
    setSessionKey((prev) => prev + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        lastSubmittedRef.current = '';
        setRewards(null);
        setIsNewHighScore(false);
        setLastScore(null);
        setSessionKey((prev) => prev + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      ref={gameContainerRef}
      className={cn(
        'flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8',
        isFullscreen && 'min-h-screen w-screen bg-background px-4 py-4'
      )}
    >
      <GameTopBar
        title="Tetris"
        score={lastScore ?? 0}
        highScore={highScore}
        isNewHighScore={isNewHighScore}
        rewards={rewards}
        controls={
          <div className="space-y-2 text-xs">
            <p className="font-medium text-foreground">Sprint — tetr.js</p>
            <p className="text-muted-foreground">Complète les lignes le plus vite possible!</p>
          </div>
        }
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showLeaderboard={showLeaderboard}
        onToggleLeaderboard={() => setShowLeaderboard(v => !v)}
      >
        <GamePauseButton isPaused={isPaused} onToggle={() => setIsPaused((current) => !current)} disabled={!lastScore} />
      </GameTopBar>

      <div className="flex items-start justify-center gap-4">
        <div className="flex w-full max-w-[640px] flex-col">
          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={GAME_WIDTH} baseHeight={GAME_HEIGHT}>
            <iframe
              key={sessionKey}
              src={`/tetrjs/index.html?k=${sessionKey}`}
              title="Tetris"
              className="block h-full w-full rounded-lg border border-border/30 bg-black"
            />
            <GamePauseOverlay
              visible={isPaused}
              onResume={() => setIsPaused(false)}
              description="La surface du jeu est verrouillée jusqu'à la reprise."
            />
          </GameFullscreenStage>
        </div>
        {showLeaderboard && !isFullscreen && (
          <div className="w-[240px] shrink-0 hidden lg:block">
            <GameLeaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              isAdmin={user?.isAdmin}
              onDeleteScore={handleDeleteScore}
              maxHeight={500}
              hidden={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

