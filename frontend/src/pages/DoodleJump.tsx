import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { ArrowLeft, Play, RotateCcw, Trophy, Sparkles, Coins, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Platform {
  x: number;
  y: number;
  width: number;
  type: 'normal' | 'moving' | 'breaking';
  broken?: boolean;
  direction?: number;
}

interface GameState {
  playerX: number;
  playerY: number;
  velocityY: number;
  velocityX: number;
  platforms: Platform[];
  score: number;
  gameOver: boolean;
  started: boolean;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 40;
const PLATFORM_WIDTH = 70;
const PLATFORM_HEIGHT = 15;
const GRAVITY = 0.4;
const JUMP_FORCE = -12;
const MOVE_SPEED = 6;

export default function DoodleJump() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animationRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  
  const { user, refreshUser } = useAuth();
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await gamesApi.getStats('doodle_jump', user!.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const initGame = useCallback(() => {
    const platforms: Platform[] = [];
    
    // Generate initial platforms
    for (let i = 0; i < 10; i++) {
      platforms.push({
        x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        y: CANVAS_HEIGHT - (i * 70) - 50,
        width: PLATFORM_WIDTH,
        type: i < 3 ? 'normal' : Math.random() > 0.8 ? 'moving' : Math.random() > 0.9 ? 'breaking' : 'normal',
        direction: Math.random() > 0.5 ? 1 : -1,
      });
    }

    gameStateRef.current = {
      playerX: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      playerY: CANVAS_HEIGHT - 100,
      velocityY: JUMP_FORCE,
      velocityX: 0,
      platforms,
      score: 0,
      gameOver: false,
      started: true,
    };

    setScore(0);
    setGameOver(false);
    setStarted(true);
    setRewards(null);
    setIsNewHighScore(false);
  }, []);

  const handleGameOver = useCallback(async () => {
    const finalScore = gameStateRef.current?.score || 0;
    setGameOver(true);
    
    try {
      const response = await gamesApi.complete('doodle_jump', {
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
    } catch (error) {
      console.error('Failed to submit score:', error);
    }
  }, [refreshUser]);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const state = gameStateRef.current;
    
    if (!canvas || !ctx || !state || state.gameOver) return;

    // Clear canvas
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Handle input
    if (keysRef.current.has('ArrowLeft') || keysRef.current.has('a')) {
      state.velocityX = -MOVE_SPEED;
    } else if (keysRef.current.has('ArrowRight') || keysRef.current.has('d')) {
      state.velocityX = MOVE_SPEED;
    } else {
      state.velocityX *= 0.9;
    }

    // Update player position
    state.playerX += state.velocityX;
    state.velocityY += GRAVITY;
    state.playerY += state.velocityY;

    // Screen wrap
    if (state.playerX < -PLAYER_WIDTH) {
      state.playerX = CANVAS_WIDTH;
    } else if (state.playerX > CANVAS_WIDTH) {
      state.playerX = -PLAYER_WIDTH;
    }

    // Move platforms down when player goes up
    if (state.playerY < CANVAS_HEIGHT / 2) {
      const diff = CANVAS_HEIGHT / 2 - state.playerY;
      state.playerY = CANVAS_HEIGHT / 2;
      state.score += Math.floor(diff);
      setScore(state.score);

      state.platforms.forEach((platform) => {
        platform.y += diff;
      });

      // Remove platforms below screen and add new ones
      state.platforms = state.platforms.filter((p) => p.y < CANVAS_HEIGHT + 50);
      
      while (state.platforms.length < 10) {
        const highestY = Math.min(...state.platforms.map((p) => p.y));
        const newPlatform: Platform = {
          x: Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
          y: highestY - 60 - Math.random() * 40,
          width: PLATFORM_WIDTH,
          type: state.score > 1000 
            ? (Math.random() > 0.6 ? 'moving' : Math.random() > 0.7 ? 'breaking' : 'normal')
            : 'normal',
          direction: Math.random() > 0.5 ? 1 : -1,
        };
        state.platforms.push(newPlatform);
      }
    }

    // Platform collision and movement
    state.platforms.forEach((platform) => {
      // Move moving platforms
      if (platform.type === 'moving') {
        platform.x += (platform.direction || 1) * 2;
        if (platform.x <= 0 || platform.x >= CANVAS_WIDTH - platform.width) {
          platform.direction = -(platform.direction || 1);
        }
      }

      // Check collision (only when falling)
      if (state.velocityY > 0 && !platform.broken) {
        if (
          state.playerX + PLAYER_WIDTH > platform.x &&
          state.playerX < platform.x + platform.width &&
          state.playerY + PLAYER_HEIGHT > platform.y &&
          state.playerY + PLAYER_HEIGHT < platform.y + PLATFORM_HEIGHT + state.velocityY
        ) {
          if (platform.type === 'breaking') {
            platform.broken = true;
          } else {
            state.velocityY = JUMP_FORCE;
          }
        }
      }
    });

    // Game over check
    if (state.playerY > CANVAS_HEIGHT) {
      state.gameOver = true;
      handleGameOver();
      return;
    }

    // Draw platforms
    state.platforms.forEach((platform) => {
      if (platform.broken) return;
      
      ctx.fillStyle = platform.type === 'moving' 
        ? '#22d3ee' 
        : platform.type === 'breaking' 
        ? '#f472b6' 
        : '#6366f1';
      ctx.fillRect(platform.x, platform.y, platform.width, PLATFORM_HEIGHT);
      
      // Platform highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(platform.x, platform.y, platform.width, 3);
    });

    // Draw player
    const gradient = ctx.createLinearGradient(
      state.playerX,
      state.playerY,
      state.playerX + PLAYER_WIDTH,
      state.playerY + PLAYER_HEIGHT
    );
    gradient.addColorStop(0, '#a855f7');
    gradient.addColorStop(1, '#d946ef');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(
      state.playerX + PLAYER_WIDTH / 2,
      state.playerY + PLAYER_HEIGHT / 2,
      PLAYER_WIDTH / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Eyes
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(state.playerX + 12, state.playerY + 15, 6, 0, Math.PI * 2);
    ctx.arc(state.playerX + 28, state.playerY + 15, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#0a0e17';
    ctx.beginPath();
    ctx.arc(state.playerX + 12 + state.velocityX * 0.3, state.playerY + 15, 3, 0, Math.PI * 2);
    ctx.arc(state.playerX + 28 + state.velocityX * 0.3, state.playerY + 15, 3, 0, Math.PI * 2);
    ctx.fill();

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [handleGameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if (started && !gameOver) {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [started, gameOver, gameLoop]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/games"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Games
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="text-lg">High: {highScore.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Game Container */}
      <div className="flex justify-center">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <TrendingUp className="w-6 h-6" />
              Doodle Jump
            </CardTitle>
            <CardDescription>Use arrow keys or A/D to move</CardDescription>
          </CardHeader>
          <CardContent>

          {/* Score Display */}
          <div className="flex justify-center mb-4">
            <Badge variant="secondary" className="px-6 py-2 text-2xl">
              {score.toLocaleString()}
            </Badge>
          </div>

          {/* Canvas */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="rounded-lg border border-border"
            />

            {/* Start Screen */}
            {!started && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-4">Ready to Jump?</h2>
                  <Button onClick={initGame}>
                    <Play className="w-4 h-4" />
                    Start Game
                  </Button>
                </div>
              </div>
            )}

            {/* Game Over Screen */}
            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-2">Game Over!</h2>
                  <p className="text-xl text-muted-foreground mb-4">
                    Score: {score.toLocaleString()}
                  </p>
                  
                  {isNewHighScore && (
                    <div className="mb-4 px-4 py-2 rounded-lg bg-primary/20 border border-primary/30">
                      <Trophy className="w-6 h-6 text-primary mx-auto mb-1" />
                      <p className="text-primary font-bold">New High Score!</p>
                    </div>
                  )}

                  {rewards && (
                    <div className="mb-4 space-y-2">
                      {rewards.money > 0 && (
                        <div className="flex items-center justify-center gap-2">
                          <Coins className="w-5 h-5 text-primary" />
                          <Badge variant="secondary">+${rewards.money}</Badge>
                        </div>
                      )}
                      {rewards.aura > 0 && (
                        <div className="flex items-center justify-center gap-2">
                          <Sparkles className="w-5 h-5 text-primary" />
                          <Badge variant="secondary">+{rewards.aura} Aura</Badge>
                        </div>
                      )}
                    </div>
                  )}

                  <Button onClick={initGame}>
                    <RotateCcw className="w-4 h-4" />
                    Play Again
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Controls Info */}
          <div className="mt-4 flex justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-muted border border-border">←</kbd>
              <span>Move Left</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-muted border border-border">→</kbd>
              <span>Move Right</span>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
