import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { gamesApi } from '../services/api';
import { Play, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================
// GAME CONSTANTS
// ============================================
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;

// Physics
const GRAVITY = 0.5;
const JUMP_FORCE = -8;
const PIPE_SPEED = 2;
const PIPE_GAP = 150;
const PIPE_WIDTH = 60;
const PIPE_SPACING = 200; // Distance between pipe pairs
const BIRD_SIZE = 30;
const BIRD_X = 80;

// ============================================
// TYPES
// ============================================
interface Pipe {
  x: number;
  topHeight: number;
  bottomY: number;
  passed: boolean;
}

interface LeaderboardEntry {
  id: string;
  highScore: number;
  user: {
    id: string;
    username: string;
  };
}

// ============================================
// COLOR SCHEME (theme-aware)
// ============================================
const getColors = (theme: 'light' | 'dark') => {
  if (theme === 'light') {
    return {
      background: '#87CEEB', // Sky blue
      bird: '#FFD700', // Gold
      birdEye: '#000000',
      pipe: '#228B22', // Forest green
      pipeCap: '#32CD32', // Lime green
      ground: '#8B4513', // Saddle brown
      text: '#0f172a',
      scoreBackground: 'rgba(255, 255, 255, 0.9)',
    };
  }

  return {
    background: '#1a1a2e', // Dark blue
    bird: '#FFD700', // Gold
    birdEye: '#ffffff',
    pipe: '#2d5016', // Dark green
    pipeCap: '#4a7c2a', // Medium green
    ground: '#3d2817', // Dark brown
    text: '#ffffff',
    scoreBackground: 'rgba(30, 30, 30, 0.9)',
  };
};

// ============================================
// COMPONENT
// ============================================
export default function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const { theme } = useTheme();
  const colors = useMemo(() => getColors(theme), [theme]);

  // Game state refs
  const pipesRef = useRef<Pipe[]>([]);
  const scoreRef = useRef(0);
  const gameRunningRef = useRef(false);
  const velocityRef = useRef(0);
  const positionRef = useRef({ x: BIRD_X, y: CANVAS_HEIGHT / 2 });
  const nextPipeXRef = useRef(CANVAS_WIDTH);

  const { user, refreshUser } = useAuth();
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Fetch stats and leaderboard on mount
  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await gamesApi.getStats('flappy_bird', user!.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await gamesApi.getLeaderboard('flappy_bird', 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };

  // Admin: Delete a user's high score
  const handleDeleteScore = async (userId: string, username: string) => {
    if (!confirm(`Supprimer le score de ${username} ?`)) return;

    try {
      await gamesApi.deleteStats('flappy_bird', userId);
      // Refresh leaderboard
      fetchLeaderboard();
      // If it was our own score, reset our high score display
      if (userId === user?.id) {
        setHighScore(0);
      }
    } catch (error) {
      console.error('Failed to delete score:', error);
    }
  };

  // ============================================
  // PIPE GENERATION
  // ============================================
  const createPipe = useCallback((x: number): Pipe => {
    const minTopHeight = 50;
    const maxTopHeight = CANVAS_HEIGHT - PIPE_GAP - 50 - 50; // -50 for ground, -50 for min bottom
    const topHeight = Math.random() * (maxTopHeight - minTopHeight) + minTopHeight;
    const bottomY = topHeight + PIPE_GAP;

    return {
      x,
      topHeight,
      bottomY,
      passed: false,
    };
  }, []);

  const generateInitialPipes = useCallback(() => {
    pipesRef.current = [];
    // Generate first few pipes
    for (let i = 0; i < 3; i++) {
      const pipe = createPipe(CANVAS_WIDTH + i * PIPE_SPACING);
      pipesRef.current.push(pipe);
    }
    // Set next pipe position after the last one
    nextPipeXRef.current = CANVAS_WIDTH + 3 * PIPE_SPACING;
  }, [createPipe]);

  // ============================================
  // GAME INITIALIZATION
  // ============================================
  const initGame = useCallback(() => {
    // Reset state
    pipesRef.current = [];
    scoreRef.current = 0;
    velocityRef.current = 0;
    positionRef.current = { x: BIRD_X, y: CANVAS_HEIGHT / 2 };
    gameRunningRef.current = true;
    lastTimeRef.current = 0;
    nextPipeXRef.current = CANVAS_WIDTH;

    // Generate initial pipes
    generateInitialPipes();

    setScore(0);
    setGameOver(false);
    setStarted(true);
    setRewards(null);
    setIsNewHighScore(false);
  }, [generateInitialPipes]);

  // ============================================
  // GAME OVER HANDLING
  // ============================================
  const handleGameOver = useCallback(async () => {
    const finalScore = scoreRef.current;
    gameRunningRef.current = false;
    setGameOver(true);

    try {
      const response = await gamesApi.complete('flappy_bird', {
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
      // Refresh leaderboard after game
      fetchLeaderboard();
    } catch (error) {
      console.error('Failed to submit score:', error);
    }
  }, [refreshUser]);

  // ============================================
  // GAME LOOP
  // ============================================
  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx || !gameRunningRef.current) return;

    // Calculate delta time
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const deltaTimeRaw = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Limit max delta to prevent huge jumps
    const deltaTime = Math.min(deltaTimeRaw, 50);
    const timeScale = deltaTime / (1000 / 60); // Target 60 FPS

    // ========== UPDATE BIRD ==========
    // Apply gravity
    velocityRef.current += GRAVITY * timeScale;
    positionRef.current.y += velocityRef.current * timeScale;

    // Rotate bird based on velocity
    const rotation = Math.min(Math.max(velocityRef.current * 3, -30), 90);

    // ========== UPDATE PIPES ==========
    for (const pipe of pipesRef.current) {
      pipe.x -= PIPE_SPEED * timeScale;

      // Check if bird passed the pipe
      if (!pipe.passed && pipe.x + PIPE_WIDTH < positionRef.current.x) {
        pipe.passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);
      }
    }

    // Remove pipes that are off screen
    pipesRef.current = pipesRef.current.filter(pipe => pipe.x + PIPE_WIDTH > -50);

    // Generate new pipes
    const lastPipe = pipesRef.current[pipesRef.current.length - 1];
    if (lastPipe && lastPipe.x < nextPipeXRef.current - PIPE_SPACING) {
      const newPipe = createPipe(nextPipeXRef.current);
      pipesRef.current.push(newPipe);
      nextPipeXRef.current += PIPE_SPACING;
    }

    // ========== COLLISION DETECTION ==========
    const birdTop = positionRef.current.y;
    const birdBottom = positionRef.current.y + BIRD_SIZE;
    const birdLeft = positionRef.current.x;
    const birdRight = positionRef.current.x + BIRD_SIZE;

    // Ground and ceiling collision
    if (birdBottom >= CANVAS_HEIGHT - 50 || birdTop <= 0) {
      handleGameOver();
      return;
    }

    // Pipe collision
    for (const pipe of pipesRef.current) {
      if (
        birdRight > pipe.x &&
        birdLeft < pipe.x + PIPE_WIDTH &&
        (birdTop < pipe.topHeight || birdBottom > pipe.bottomY)
      ) {
        handleGameOver();
        return;
      }
    }

    // ========== RENDER ==========
    // Clear canvas
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw pipes
    for (const pipe of pipesRef.current) {
      // Top pipe
      ctx.fillStyle = colors.pipe;
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
      
      // Top pipe cap
      ctx.fillStyle = colors.pipeCap;
      ctx.fillRect(pipe.x - 5, pipe.topHeight - 20, PIPE_WIDTH + 10, 20);
      
      // Bottom pipe
      ctx.fillStyle = colors.pipe;
      ctx.fillRect(pipe.x, pipe.bottomY, PIPE_WIDTH, CANVAS_HEIGHT - pipe.bottomY);
      
      // Bottom pipe cap
      ctx.fillStyle = colors.pipeCap;
      ctx.fillRect(pipe.x - 5, pipe.bottomY, PIPE_WIDTH + 10, 20);
    }

    // Draw ground
    ctx.fillStyle = colors.ground;
    ctx.fillRect(0, CANVAS_HEIGHT - 50, CANVAS_WIDTH, 50);

    // Draw bird
    ctx.save();
    ctx.translate(positionRef.current.x + BIRD_SIZE / 2, positionRef.current.y + BIRD_SIZE / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    
    // Bird body (ellipse)
    ctx.fillStyle = colors.bird;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_SIZE / 2, BIRD_SIZE / 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Bird eye
    ctx.fillStyle = colors.birdEye;
    ctx.beginPath();
    ctx.arc(5, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Bird beak
    ctx.fillStyle = '#FF8C00';
    ctx.beginPath();
    ctx.moveTo(BIRD_SIZE / 2 - 5, 0);
    ctx.lineTo(BIRD_SIZE / 2 + 5, -3);
    ctx.lineTo(BIRD_SIZE / 2 + 5, 3);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();

    // Draw score
    ctx.fillStyle = colors.scoreBackground;
    ctx.fillRect(10, 10, 100, 40);
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Score: ${scoreRef.current}`, 15, 35);

    // Continue loop
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [handleGameOver, createPipe, colors]);

  // ============================================
  // INPUT HANDLING
  // ============================================
  const handleJump = useCallback(() => {
    if (!gameRunningRef.current || gameOver) return;
    velocityRef.current = JUMP_FORCE;
  }, [gameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
        handleJump();
      }
    };

    const handleClick = () => {
      handleJump();
    };

    window.addEventListener('keydown', handleKeyDown);
    canvasRef.current?.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvasRef.current?.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationRef.current);
    };
  }, [handleJump]);

  // Start game loop when game starts
  useEffect(() => {
    if (started && !gameOver) {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [started, gameOver, gameLoop]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
      {/* Game Area */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Canvas */}
        <div className="flex-1 flex flex-col items-center space-y-4">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="border border-border rounded-lg cursor-pointer"
              style={{ imageRendering: 'pixelated' }}
            />
            {!started && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                <div className="text-center space-y-4">
                  <p className="text-lg font-medium">Appuie sur Espace ou clique pour sauter</p>
                  <Button onClick={initGame} variant="outline" className="border-foreground">
                    <Play className="h-4 w-4 mr-2" />
                    Commencer
                  </Button>
                </div>
              </div>
            )}
            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg">
                <div className="text-center space-y-4 p-6">
                  <p className="text-2xl font-bold">Game Over!</p>
                  <p className="text-lg">Score: {score}</p>
                  {isNewHighScore && (
                    <p className="text-yellow-500 font-medium">Nouveau record personnel!</p>
                  )}
                  {rewards && (
                    <div className="space-y-1">
                      {rewards.aura > 0 && (
                        <p className="text-purple-400">+{rewards.aura} aura</p>
                      )}
                      {rewards.money > 0 && (
                        <p className="text-green-400">+{rewards.money}$</p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 justify-center">
                    <Button onClick={initGame} variant="outline" className="border-foreground">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rejouer
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground text-center space-y-1">
            <p>Meilleur score: {highScore}</p>
            <p className="text-xs">Espace / Flèche haut / Clic pour sauter</p>
          </div>
        </div>

        {/* Stats and Leaderboard */}
        <div className="lg:w-80 space-y-6">
          {/* Stats */}
          <section className="space-y-2">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Statistiques
            </h2>
            <div className="space-y-2 border border-border/30 rounded-lg p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Meilleur score</span>
                <span className="font-medium">{highScore}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Score actuel</span>
                <span className="font-medium">{score}</span>
              </div>
            </div>
          </section>

          {/* Leaderboard */}
          <section className="space-y-2">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Classement
            </h2>
            <div className="border border-border/30 rounded-lg overflow-hidden">
              {leaderboard.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Aucun score pour le moment
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-center justify-between p-3",
                        entry.user.id === user?.id && "bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-6 tabular-nums">
                          {index + 1}
                        </span>
                        <span className="font-medium text-sm">
                          {entry.user.username}
                          {entry.user.id === user?.id && (
                            <span className="ml-2 text-xs text-muted-foreground">(toi)</span>
                          )}
                        </span>
                      </div>
                      <span className="text-sm tabular-nums">{entry.highScore}</span>
                      {user?.isAdmin && (
                        <button
                          onClick={() => handleDeleteScore(entry.user.id, entry.user.username)}
                          className="ml-2 text-xs text-destructive hover:underline"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
