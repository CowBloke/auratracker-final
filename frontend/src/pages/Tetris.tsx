import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { RotateCcw, Trophy, X } from 'lucide-react';

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
    <div className="max-w-6xl mx-auto py-12 px-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tetris</h1>
          <p className="text-sm text-muted-foreground">Version tetr.js avec mode Sprint simple.</p>
        </div>
        <div className="text-right text-sm text-muted-foreground tabular-nums">
          <div className="text-3xl font-light text-foreground">{highScore.toLocaleString()}</div>
          <div>Record personnel</div>
        </div>
      </div>

      <div className="flex justify-center gap-6 items-start flex-nowrap overflow-x-auto pb-2">
        <div className="space-y-3">
          <div className="flex gap-2 justify-end">
            <button
              onClick={restartSession}
              className="flex items-center gap-2 px-4 py-2 border border-border/50 rounded-md hover:bg-muted transition-colors text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Recharger
            </button>
            </div>

          <iframe
            key={sessionKey}
            src={`/tetrjs/index.html?k=${sessionKey}`}
            title="Tetris"
            className="border border-border/30 rounded-lg bg-black"
            style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          />

          {(lastScore !== null || rewards || isNewHighScore) && (
            <div className="border border-border/30 rounded-lg bg-card p-4 text-sm space-y-1">
              {lastScore !== null && <div>Dernier score: <span className="font-mono">{lastScore.toLocaleString()}</span></div>}
              {isNewHighScore && <div className="text-foreground">Nouveau record personnel.</div>}
              {rewards && (rewards.money > 0 || rewards.aura > 0) && (
                <div className="text-muted-foreground">
                  {rewards.money > 0 && `+$${rewards.money}`}
                  {rewards.money > 0 && rewards.aura > 0 && ' · '}
                  {rewards.aura > 0 && `+${rewards.aura} aura`}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-72 border border-border/30 rounded-lg bg-card overflow-hidden" style={{ height: GAME_HEIGHT }}>
          <div className="p-4 border-b border-border/30 bg-muted/30">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h3 className="font-semibold">Classement</h3>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ height: GAME_HEIGHT - 72 }}>
            {leaderboard.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Aucun score enregistre</div>
            ) : (
              <div className="divide-y divide-border/20">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 px-4 py-2.5 group ${entry.user.id === user?.id ? 'bg-primary/10' : ''}`}
                  >
                    <span
                      className={`w-6 text-center font-mono text-sm ${
                        index === 0
                          ? 'text-yellow-500 font-bold'
                          : index === 1
                            ? 'text-gray-400 font-bold'
                            : index === 2
                              ? 'text-amber-600 font-bold'
                              : 'text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate text-sm">{entry.user.username}</span>
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">{entry.highScore.toLocaleString()}</span>
                    {user?.isAdmin && (
                      <button
                        onClick={() => handleDeleteScore(entry.user.id, entry.user.username)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                        title="Supprimer ce score"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

