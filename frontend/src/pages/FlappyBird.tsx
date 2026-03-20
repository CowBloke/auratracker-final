import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { gamesApi } from '../services/api';
import { Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';

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
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const canvasScaleRef = useRef(1);
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();

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
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);

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
    const ctx = ctxRef.current;

    if (!canvas || !ctx || !gameRunningRef.current) return;

    ctx.setTransform(canvasScaleRef.current, 0, 0, canvasScaleRef.current, 0, 0);
    ctx.imageSmoothingEnabled = true;

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      canvasScaleRef.current = width / CANVAS_WIDTH;
    };

    ctxRef.current = canvas.getContext('2d');
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    window.addEventListener('resize', resizeCanvas);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isFullscreen]);

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
    <div className={cn(
      'grid items-start gap-4 px-4 pb-6 lg:px-6 lg:pb-8',
      isFullscreen ? 'grid-cols-1 justify-items-center' : 'grid-cols-[1fr_auto_1fr]'
    )}>

      {/* ── Left column ── */}
      <div className={cn('flex flex-col gap-3', isFullscreen && 'hidden')}>
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Score</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div>
              <p className="text-3xl font-light tabular-nums">{score}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Score actuel</p>
            </div>
            <Separator />
            <div>
              <p className="text-xl font-medium tabular-nums">{highScore}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Meilleur score</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">Contrôles</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <kbd className="px-2 py-0.5 border border-border/50 rounded text-xs">Espace</kbd>
              <span className="text-xs text-muted-foreground">·</span>
              <kbd className="px-2 py-0.5 border border-border/50 rounded text-xs">↑</kbd>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">Clic</span>
            </div>
            <p className="text-xs text-muted-foreground">pour sauter</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Center column — canvas ── */}
      <div
        ref={gameContainerRef}
        className={cn(
          'flex flex-col gap-3',
          isFullscreen && 'min-h-screen w-screen items-center bg-background px-4 py-4'
        )}
      >
        <GameFullscreenToolbar
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          className="w-full max-w-[400px]"
        />

        <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={CANVAS_WIDTH} baseHeight={CANVAS_HEIGHT}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block h-full w-full cursor-pointer rounded-lg border border-border"
            style={{ imageRendering: 'auto' }}
          />
          {!started && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">Appuie sur Espace ou clique pour sauter</p>
                <Button onClick={initGame} variant="outline" className="border-foreground">
                  <Play className="h-4 w-4 mr-2" />
                  Commencer
                </Button>
              </div>
            </div>
          )}
          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/90">
              <div className="text-center space-y-4 p-6">
                <p className="text-2xl font-light">Game Over</p>
                <p className="text-3xl tabular-nums">{score}</p>
                {isNewHighScore && <p className="text-sm text-foreground">Nouveau record !</p>}
                {rewards && (
                  <p className="text-sm text-muted-foreground">
                    {rewards.aura > 0 && `+${rewards.aura} aura`}
                    {rewards.aura > 0 && rewards.money > 0 && ' · '}
                    {rewards.money > 0 && `+${rewards.money}$`}
                  </p>
                )}
                <Button onClick={initGame} variant="outline" className="border-foreground">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Rejouer
                </Button>
              </div>
            </div>
          )}
        </GameFullscreenStage>
      </div>

      {/* ── Right column — leaderboard ── */}
      <GameLeaderboard
        entries={leaderboard}
        currentUserId={user?.id}
        isAdmin={user?.isAdmin}
        onDeleteScore={handleDeleteScore}
        maxHeight={560}
        hidden={isFullscreen}
      />

    </div>
  );
}
