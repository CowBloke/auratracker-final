import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameTopBar } from '@/components/game/GameTopBar';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { cn } from '@/lib/utils';

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

export default function Hextris() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { user, refreshUser } = useAuth();
  const { containerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Fetch high score and leaderboard
  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await gamesApi.getStats('hextris', user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard('hextris', 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchStats, fetchLeaderboard]);

  // Listen for messages from the iframe (score updates)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Only accept messages from our own origin
      if (event.origin !== window.location.origin) return;

      const { type, data } = event.data;

      if (type === 'HEXTRIS_SCORE_UPDATE') {
        setScore(data.score);
      }

      if (type === 'HEXTRIS_GAME_OVER') {
        const finalScore = data.score;
        setScore(finalScore);
        setGameOver(true);

        // Check if new high score
        const isNew = finalScore > highScore;
        if (isNew) {
          setIsNewHighScore(true);
          setHighScore(finalScore);
        }

        // Submit score
        if (user?.id) {
          try {
            const response = await gamesApi.complete('hextris', {
              score: finalScore,
              won: true,
            });
            setRewards({
              aura: response.data.auraReward || 0,
              money: response.data.moneyReward || 0,
            });
            refreshUser();
            fetchLeaderboard();
          } catch (error) {
            console.error('Failed to submit score:', error);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user?.id, refreshUser, fetchLeaderboard]);

  const handleRestart = () => {
    setGameOver(false);
    setScore(0);
    setRewards(null);
    setIsNewHighScore(false);
    // Send restart message to iframe
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'RESTART_GAME' },
        window.location.origin
      );
    }
  };

  const topBarControls = (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground">
        Assemble les blocs en hexagone pour les supprimer et obtenir le score maximum.
      </p>
    </div>
  );

  return (
    <div className={cn('grid gap-4', isFullscreen ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px]')}>
      <div
        ref={containerRef}
        className={cn('flex flex-col gap-3', isFullscreen && 'min-h-screen w-screen items-center bg-background px-4 py-4')}
      >
        <GameTopBar
          title="Hextris"
          score={score}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          rewards={rewards}
          controls={topBarControls}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          showLeaderboard={showLeaderboard}
          onToggleLeaderboard={() => setShowLeaderboard((v) => !v)}
        />

        <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={GAME_WIDTH} baseHeight={GAME_HEIGHT}>
          <iframe
            ref={iframeRef}
            src="/hextris/index.html"
            className="h-full w-full rounded-lg"
            style={{
              border: 'none',
            }}
            title="Hextris"
            sandbox="allow-same-origin allow-scripts allow-forms"
          />

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-background/90">
              <div className="text-center">
                <h2 className="mb-2 text-xl font-bold">Game Over!</h2>
                <p className="mb-4 text-sm">Score: {score}</p>
                {highScore > 0 && <p className="mb-2 text-xs text-muted-foreground">Meilleur score: {highScore}</p>}
                {isNewHighScore && (
                  <p className="mb-2 text-lg font-semibold text-yellow-500">
                    🎉 Nouveau meilleur score !
                  </p>
                )}
                {rewards && (
                  <div className="space-y-1 text-sm">
                    <p className="text-green-500">+{rewards.money} Pièces</p>
                    <p className="text-blue-500">+{rewards.aura} Aura</p>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                onClick={handleRestart}
                className="flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Rejouer
              </Button>
            </div>
          )}
        </GameFullscreenStage>
      </div>

      {showLeaderboard && !isFullscreen && (
        <div className="w-[240px] shrink-0 hidden xl:block">
          <GameLeaderboard
            entries={leaderboard}
            currentUserId={user?.id}
            personalHighScore={highScore}
            isAdmin={user?.isAdmin}
            onDeleteScore={async (userId) => {
              try {
                await gamesApi.deleteStats('hextris', userId);
                fetchLeaderboard();
              } catch (error) {
                console.error('Failed to delete score:', error);
              }
            }}
            maxHeight={500}
            hidden={false}
          />
        </div>
      )}
    </div>
  );
}
