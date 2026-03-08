import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { RotateCcw, Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { GameFullscreenButton } from '@/components/game/GameFullscreenButton';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';

interface LeaderboardEntry {
  id: string;
  highScore: number;
  user: {
    id: string;
    username: string;
  };
}

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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
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
    setSessionKey((prev) => prev + 1);
  };

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
          'relative',
          isFullscreen && 'flex min-h-screen w-screen items-center justify-center bg-background'
        )}
      >
        <GameFullscreenButton
          isFullscreen={isFullscreen}
          onClick={toggleFullscreen}
          className="absolute right-2 top-2 z-30"
        />

        {isFullscreen && (
          <Button
            size="sm"
            variant="outline"
            onClick={restartSession}
            className="absolute left-2 top-2 z-30"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Recharger
          </Button>
        )}

        <iframe
          key={sessionKey}
          src={`/tetrjs/index.html?k=${sessionKey}`}
          title="Tetris"
          className="border border-border/30 rounded-lg bg-black block"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        />
      </div>

      {/* ── Right column — leaderboard ── */}
      <Card className={cn(isFullscreen && 'hidden')}>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            Classement
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {leaderboard.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun score enregistré</p>
          ) : (
            <div className="divide-y divide-border/20" style={{ maxHeight: GAME_HEIGHT - 56, overflowY: 'auto' }}>
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className={cn('flex items-center gap-3 px-4 py-2.5 group', entry.user.id === user?.id && 'bg-muted/30')}
                >
                  <span className={cn('w-5 text-center text-xs tabular-nums shrink-0',
                    index === 0 ? 'text-yellow-500 font-bold' :
                    index === 1 ? 'text-muted-foreground' :
                    index === 2 ? 'text-amber-600 font-bold' : 'text-muted-foreground'
                  )}>
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-sm">{entry.user.username}</span>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground shrink-0">{entry.highScore.toLocaleString()}</span>
                  {user?.isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteScore(entry.user.id, entry.user.username)}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0"
                      title="Supprimer ce score"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
