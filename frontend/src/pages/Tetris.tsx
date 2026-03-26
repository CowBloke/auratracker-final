import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';

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

  const handleDeleteScore = async (userId: string, username: string) => {
    if (!confirm(`Supprimer le score de ${username} ?`)) return;

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
    <div className={cn(
      'grid items-start gap-4 px-4 pb-6 lg:px-6 lg:pb-8',
      isFullscreen ? 'grid-cols-1 justify-items-center' : 'grid-cols-[1fr_auto_1fr]'
    )}>

      {/* ── Left column ── */}
      <div className={cn('flex flex-col gap-3', isFullscreen && 'hidden')}>
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Statistiques</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div>
              <p className="text-3xl font-light tabular-nums">{highScore.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Record personnel</p>
            </div>
            {lastScore !== null && (
              <>
                <Separator />
                <div>
                  <p className="text-xl font-medium tabular-nums">{lastScore.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Dernier score</p>
                </div>
              </>
            )}
            {isNewHighScore && <p className="text-sm text-foreground">Nouveau record !</p>}
            {rewards && (rewards.money > 0 || rewards.aura > 0) && (
              <p className="text-sm text-muted-foreground">
                {rewards.money > 0 && `+$${rewards.money}`}
                {rewards.money > 0 && rewards.aura > 0 && ' · '}
                {rewards.aura > 0 && `+${rewards.aura} aura`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Mode</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-muted-foreground">Sprint — tetr.js</p>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          onClick={restartSession}
          className="flex items-center gap-2 w-full"
        >
          <RotateCcw className="w-4 h-4" />
          Recharger
        </Button>
      </div>

      {/* ── Center column — iframe ── */}
      <div
        ref={gameContainerRef}
        className={cn(
          'flex flex-col gap-3',
          isFullscreen && 'min-h-screen w-screen items-center bg-background px-4 py-4'
        )}
      >
        <GameFullscreenToolbar isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} className="w-full">
          <GamePauseButton isPaused={isPaused} onToggle={() => setIsPaused((current) => !current)} />
          {isFullscreen && (
            <Button size="sm" variant="outline" onClick={restartSession}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Recharger
            </Button>
          )}
        </GameFullscreenToolbar>

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

      {/* ── Right column — leaderboard ── */}
      <GameLeaderboard
        entries={leaderboard}
        currentUserId={user?.id}
        personalHighScore={highScore}
        isAdmin={user?.isAdmin}
        onDeleteScore={handleDeleteScore}
        maxHeight={GAME_HEIGHT - 56}
        hidden={isFullscreen}
      />

    </div>
  );
}
