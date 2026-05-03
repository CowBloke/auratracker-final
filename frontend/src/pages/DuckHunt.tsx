import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { GameTopBar } from '@/components/game/GameTopBar';

const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;

export default function DuckHunt() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { containerRef: fullscreenContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();

  const { user, refreshUser } = useAuth();
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  // Load high score on mount
  useEffect(() => {
    if (!user?.id) return;
    const fetchHighScore = async () => {
      try {
        const response = await gamesApi.getStats('duck_hunt', user.id);
        setHighScore(response.data.maxScore || 0);
      } catch (error) {
        console.error('Failed to fetch high score:', error);
      }
    };
    fetchHighScore();
  }, [user?.id]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard('duck_hunt');
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleGameOver = useCallback(
    async (finalScore: number) => {
      setGameOver(true);
      setStarted(false);

      try {
        const response = await gamesApi.complete('duck_hunt', {
          score: finalScore,
          won: true,
        });

        setRewards({
          aura: response.data.auraReward,
          money: response.data.moneyReward,
        });
        setIsNewHighScore(response.data.isNewHighScore);

        if (response.data.isNewHighScore) {
          setHighScore(finalScore);
        }

        await refreshUser();
        fetchLeaderboard();
      } catch (error) {
        console.error('Failed to submit score:', error);
      }
    },
    [refreshUser, fetchLeaderboard]
  );

  // Listen for messages from the game iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from our iframe
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;

      if (event.data.type === 'scoreUpdate') {
        setScore(event.data.score);
      } else if (event.data.type === 'gameEnded') {
        handleGameOver(event.data.score);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleGameOver]);

  const handleStart = () => {
    setStarted(true);
    setGameOver(false);
    setScore(0);
    setRewards(null);
    setIsNewHighScore(false);
    try {
      iframeRef.current?.contentWindow?.postMessage({ command: 'startGame' }, '*');
    } catch (e) {
      console.error('Failed to start game:', e);
    }
  };

  const handleRestart = () => {
    setSessionKey((prev) => prev + 1);
    setStarted(false);
    setGameOver(false);
    setScore(0);
    setRewards(null);
    setIsNewHighScore(false);
  };

  const topBarControls = (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Tire les canards pour gagner des récompenses!</span>
      </div>
    </div>
  );

  const isPlaying = started && !gameOver;

  return (
    <div
      ref={fullscreenContainerRef}
      className={`relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8 ${isFullscreen ? 'min-h-screen w-screen items-center bg-background px-4 py-4' : ''}`}
    >
      <GameTopBar
        title="Duck Hunt"
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

      <div className="flex items-start justify-center gap-4">
        <div className="flex w-full flex-col" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={GAME_WIDTH} baseHeight={GAME_HEIGHT}>
            <div style={{ width: '100%', height: '100%', backgroundColor: '#000' }}>
              <iframe
                key={sessionKey}
                ref={iframeRef}
                src="/duckhunt/index.html"
                title="Duck Hunt"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  border: 'none',
                  backgroundColor: '#000'
                }}
                allow="autoplay"
              />
            </div>
          </GameFullscreenStage>

          {!started && !gameOver && (
            <div className="mt-4 flex gap-2">
              <Button onClick={handleStart} className="flex-1">
                <Play className="mr-2 h-4 w-4" />
                Commencer
              </Button>
            </div>
          )}

          {isPlaying && (
            <div className="mt-4 flex gap-2">
              <Button onClick={() => handleGameOver(score)} className="flex-1" variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                Arrêter et soumettre ({score})
              </Button>
            </div>
          )}

          {gameOver && (
            <div className="mt-4 flex gap-2">
              <Button onClick={handleRestart} className="flex-1" variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                Rejeu
              </Button>
            </div>
          )}
        </div>

        {showLeaderboard && !isFullscreen && (
          <div className="flex-shrink-0">
            <GameLeaderboard entries={leaderboard} title="Classement" />
          </div>
        )}
      </div>
    </div>
  );
}
