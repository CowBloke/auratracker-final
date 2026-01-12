import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { Play, RotateCcw } from 'lucide-react';
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
    ctx.fillStyle = '#0a0a0a';
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
      if (platform.type === 'moving') {
        platform.x += (platform.direction || 1) * 2;
        if (platform.x <= 0 || platform.x >= CANVAS_WIDTH - platform.width) {
          platform.direction = -(platform.direction || 1);
        }
      }

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
        ? '#666' 
        : platform.type === 'breaking' 
        ? '#444' 
        : '#888';
      ctx.fillRect(platform.x, platform.y, platform.width, PLATFORM_HEIGHT);
    });

    // Draw player
    ctx.fillStyle = '#fff';
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
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(state.playerX + 14, state.playerY + 15, 4, 0, Math.PI * 2);
    ctx.arc(state.playerX + 26, state.playerY + 15, 4, 0, Math.PI * 2);
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
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/games"
              className="text-sm text-muted-foreground tracking-wide uppercase hover:text-foreground transition-colors"
            >
              ← Jeux
            </Link>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Doodle Jump
            </h1>
          </div>
          <div className="text-right text-sm text-muted-foreground tabular-nums">
            <div className="text-3xl font-light text-foreground">{score.toLocaleString()}</div>
            <div>Record: {highScore.toLocaleString()}</div>
          </div>
        </div>
      </header>

      {/* Canvas */}
      <div className="relative flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border border-border/30"
        />

        {/* Start Screen */}
        {!started && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90">
            <button
              onClick={initGame}
              className="flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              <Play className="w-4 h-4" />
              Jouer
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90">
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-light mb-2">Fin de partie</h2>
                <p className="text-3xl tabular-nums">{score.toLocaleString()}</p>
              </div>
              
              {isNewHighScore && (
                <p className="text-sm text-foreground">Nouveau record !</p>
              )}

              {rewards && (rewards.money > 0 || rewards.aura > 0) && (
                <p className="text-sm text-muted-foreground">
                  {rewards.money > 0 && `+$${rewards.money}`}
                  {rewards.money > 0 && rewards.aura > 0 && ' · '}
                  {rewards.aura > 0 && `+${rewards.aura} aura`}
                </p>
              )}

              <button
                onClick={initGame}
                className="flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors mx-auto"
              >
                <RotateCcw className="w-4 h-4" />
                Rejouer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-8 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50">←</kbd>
          <span>Gauche</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50">→</kbd>
          <span>Droite</span>
        </div>
      </div>
    </div>
  );
}
