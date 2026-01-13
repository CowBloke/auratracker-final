import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { Play, RotateCcw, Trophy, X } from 'lucide-react';

// ============================================
// GAME CONSTANTS (from old implementation)
// ============================================
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;

// Physics (exact values from old implementation)
const GAME_SPEED = 1.3;
const GRAVITY = 0.4;
const JUMP_FORCE = -12;
const MOVEMENT_SPEED = 3.55;
const TRAMPOLINE_JUMP_FORCE = -20;
const CONVEYOR_SPEED = 2;
const MOVING_PLATFORM_SPEED = 1;

// Dimensions
const CHARACTER_WIDTH = 40;
const CHARACTER_HEIGHT = 40;
const PLATFORM_WIDTH = 80;
const PLATFORM_HEIGHT = 15;
const PLATFORM_COUNT = 7;

// Timing
const DISAPPEARING_PLATFORM_FADE_TIME = 1000;
const BROKEN_PLATFORM_FADE_TIME = 500;

// ============================================
// TYPES
// ============================================
type PlatformMovement = 'normal' | 'moving' | 'conveyor-left' | 'conveyor-right';
type PlatformEffect = 'bounce' | 'disappear' | 'instant-disappear' | null;

interface Platform {
  x: number;
  y: number;
  movement: PlatformMovement;
  effect: PlatformEffect;
  direction: number;
  touched: boolean;
  opacity: number;
  fadingOut: boolean;
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
// COLOR SCHEME (matching old CSS vars)
// ============================================
const COLORS = {
  background: '#0a0a0a',
  platformNormal: '#e0e0e0',
  platformMoving: '#888888',
  platformConveyor: '#666666',
  platformBounce: '#7c3aed',
  platformDisappear: '#8b5cf6',
  platformInstantDisappear: '#a78bfa',
  player: '#ffffff',
  text: '#ffffff',
  scoreBackground: 'rgba(30, 30, 30, 0.9)',
};

// ============================================
// COMPONENT
// ============================================
export default function DoodleJump() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Game state refs
  const platformsRef = useRef<Platform[]>([]);
  const scoreRef = useRef(0);
  const gameRunningRef = useRef(false);
  const velocityRef = useRef(0);
  const positionRef = useRef({ x: 175, y: 100 });
  const moveLeftRef = useRef(false);
  const moveRightRef = useRef(false);
  const facingLeftRef = useRef(false);

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
      const response = await gamesApi.getStats('doodle_jump', user!.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await gamesApi.getLeaderboard('doodle_jump', 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };

  // Admin: Delete a user's high score
  const handleDeleteScore = async (userId: string, username: string) => {
    if (!confirm(`Supprimer le score de ${username} ?`)) return;

    try {
      await gamesApi.deleteStats('doodle_jump', userId);
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
  // PLATFORM GENERATION (from old implementation)
  // ============================================
  const getRandomPlatformType = useCallback((): { movement: PlatformMovement; effect: PlatformEffect } => {
    const currentScore = scoreRef.current;
    const scoreFactor = Math.min(currentScore / 3000, 1);
    const random = Math.random();

    // Determine movement type
    let movement: PlatformMovement = 'normal';
    if (random < 0.4 * scoreFactor) movement = 'moving';
    else if (random < 0.6 * scoreFactor) movement = 'conveyor-left';
    else if (random < 0.8 * scoreFactor) movement = 'conveyor-right';

    // Determine effect type
    let effect: PlatformEffect = null;
    if (currentScore > 300 && random < 0.1 * scoreFactor) effect = 'instant-disappear';
    else if (currentScore > 350 && random < 0.4 * scoreFactor) effect = 'disappear';
    else if (currentScore > 500 && random < 0.6 * scoreFactor) effect = 'bounce';

    return { movement, effect };
  }, []);

  const createPlatform = useCallback((x: number, y: number, movement: PlatformMovement = 'normal', effect: PlatformEffect = null): Platform => {
    return {
      x,
      y,
      movement,
      effect,
      direction: 1,
      touched: false,
      opacity: 1,
      fadingOut: false,
    };
  }, []);

  const generateNewPlatforms = useCallback((count: number) => {
    if (!platformsRef.current.length) return;

    const highestPlatform = Math.max(...platformsRef.current.map(p => p.y), 0);

    for (let i = 0; i < count; i++) {
      const { movement, effect } = getRandomPlatformType();
      const newPlatformY = highestPlatform + 100 + (i * 50);
      const platform = createPlatform(
        Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        newPlatformY,
        movement,
        effect
      );
      platformsRef.current.push(platform);
    }
  }, [getRandomPlatformType, createPlatform]);

  // ============================================
  // GAME INITIALIZATION
  // ============================================
  const initGame = useCallback(() => {
    // Reset state
    platformsRef.current = [];
    scoreRef.current = 0;
    velocityRef.current = 0;
    positionRef.current = { x: CANVAS_WIDTH / 2 - CHARACTER_WIDTH / 2, y: 200 };
    gameRunningRef.current = true;
    lastTimeRef.current = 0;

    // Create initial platforms
    // Start platform under player
    platformsRef.current.push(createPlatform(160, 100, 'normal', null));

    for (let i = 1; i < PLATFORM_COUNT; i++) {
      const { movement, effect } = i < 3 ? { movement: 'normal' as PlatformMovement, effect: null } : getRandomPlatformType();
      const platform = createPlatform(
        Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH),
        100 + i * 100,
        movement,
        effect
      );
      platformsRef.current.push(platform);
    }

    setScore(0);
    setGameOver(false);
    setStarted(true);
    setRewards(null);
    setIsNewHighScore(false);
  }, [createPlatform, getRandomPlatformType]);

  // ============================================
  // GAME OVER HANDLING
  // ============================================
  const handleGameOver = useCallback(async () => {
    const finalScore = scoreRef.current;
    gameRunningRef.current = false;
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
      // Refresh leaderboard after game
      fetchLeaderboard();
    } catch (error) {
      console.error('Failed to submit score:', error);
    }
  }, [refreshUser]);

  // ============================================
  // GAME LOOP (physics from old implementation)
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

    // ========== UPDATE CHARACTER ==========
    // Apply gravity (with GAME_SPEED)
    velocityRef.current += (GRAVITY * GAME_SPEED) * timeScale;
    let deltaY = velocityRef.current * timeScale;
    let deltaX = 0;

    // Apply movement (with GAME_SPEED)
    if (moveLeftRef.current) {
      deltaX -= (MOVEMENT_SPEED * GAME_SPEED) * timeScale;
      facingLeftRef.current = true;
    }
    if (moveRightRef.current) {
      deltaX += (MOVEMENT_SPEED * GAME_SPEED) * timeScale;
      facingLeftRef.current = false;
    }

    // Sub-stepping for collision detection
    const maxStep = CHARACTER_HEIGHT / 2;
    const numSteps = Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaY)) / maxStep);
    const stepX = deltaX / numSteps;
    let stepY = deltaY / numSteps;

    let collisionOccurred = false;

    for (let i = 0; i < numSteps; i++) {
      positionRef.current.x += stepX;

      if (!collisionOccurred && typeof stepY === 'number' && !isNaN(stepY)) {
        positionRef.current.y -= stepY;
      }

      // Screen wrap X
      if (positionRef.current.x < -CHARACTER_WIDTH) positionRef.current.x = CANVAS_WIDTH;
      if (positionRef.current.x > CANVAS_WIDTH) positionRef.current.x = -CHARACTER_WIDTH;

      // Check platform collisions (only when falling)
      if (velocityRef.current > 0 && !collisionOccurred) {
        for (const platform of platformsRef.current) {
          if (platform.fadingOut && platform.opacity <= 0) continue;

          const characterLeft = positionRef.current.x + 5;
          const characterRight = positionRef.current.x + CHARACTER_WIDTH - 5;
          const characterBottom = positionRef.current.y;

          const platformLeft = platform.x;
          const platformRight = platform.x + PLATFORM_WIDTH;
          const platformTop = platform.y + PLATFORM_HEIGHT;
          const platformBottom = platform.y;

          if (
            characterRight > platformLeft &&
            characterLeft < platformRight &&
            characterBottom <= platformTop &&
            characterBottom >= platformBottom
          ) {
            collisionOccurred = true;

            // Apply jump force (bounce platforms jump higher)
            if (platform.effect === 'bounce') {
              velocityRef.current = TRAMPOLINE_JUMP_FORCE;
            } else {
              velocityRef.current = JUMP_FORCE;
            }
            positionRef.current.y = platformTop;

            // Handle disappearing platforms
            if ((platform.effect === 'disappear' || platform.effect === 'instant-disappear') && !platform.touched) {
              platform.touched = true;
              platform.fadingOut = true;
              const fadeTime = platform.effect === 'disappear' ? DISAPPEARING_PLATFORM_FADE_TIME : BROKEN_PLATFORM_FADE_TIME;
              const startTime = timestamp;

              const fadePlatform = (t: number) => {
                const elapsed = t - startTime;
                platform.opacity = Math.max(0, 1 - (elapsed / fadeTime));
                if (elapsed < fadeTime) {
                  requestAnimationFrame(fadePlatform);
                } else {
                  platformsRef.current = platformsRef.current.filter(p => p !== platform);
                  generateNewPlatforms(1);
                }
              };
              requestAnimationFrame(fadePlatform);
            }

            // Conveyor effect on player
            if (platform.movement === 'conveyor-left') {
              positionRef.current.x -= (CONVEYOR_SPEED * GAME_SPEED) * timeScale;
            }
            if (platform.movement === 'conveyor-right') {
              positionRef.current.x += (CONVEYOR_SPEED * GAME_SPEED) * timeScale;
            }

            stepY = 0;
            break;
          }
        }
      }
    }

    // ========== UPDATE PLATFORMS ==========
    if (positionRef.current.y > 300) {
      const diff = positionRef.current.y - 300;
      positionRef.current.y = 300;

      const platformsToRemove: Platform[] = [];

      for (const platform of platformsRef.current) {
        platform.y -= diff;

        if (platform.y < -20) {
          platformsToRemove.push(platform);
          scoreRef.current += 10;
          setScore(scoreRef.current);
        }

        // Update platform movement
        if (platform.movement === 'moving') {
          platform.x += (MOVING_PLATFORM_SPEED * GAME_SPEED) * platform.direction * timeScale;
          if (platform.x <= 0 || platform.x >= CANVAS_WIDTH - PLATFORM_WIDTH) {
            platform.direction *= -1;
          }
        }
        if (platform.movement === 'conveyor-left') {
          platform.x -= (CONVEYOR_SPEED * GAME_SPEED) * timeScale;
          if (platform.x < -PLATFORM_WIDTH) platform.x = CANVAS_WIDTH;
        }
        if (platform.movement === 'conveyor-right') {
          platform.x += (CONVEYOR_SPEED * GAME_SPEED) * timeScale;
          if (platform.x > CANVAS_WIDTH) platform.x = -PLATFORM_WIDTH;
        }
      }

      if (platformsToRemove.length > 0) {
        platformsRef.current = platformsRef.current.filter(p => !platformsToRemove.includes(p));
        generateNewPlatforms(platformsToRemove.length);
      }
    } else {
      // Just update platform movement
      for (const platform of platformsRef.current) {
        if (platform.movement === 'moving') {
          platform.x += (MOVING_PLATFORM_SPEED * GAME_SPEED) * platform.direction * timeScale;
          if (platform.x <= 0 || platform.x >= CANVAS_WIDTH - PLATFORM_WIDTH) {
            platform.direction *= -1;
          }
        }
        if (platform.movement === 'conveyor-left') {
          platform.x -= (CONVEYOR_SPEED * GAME_SPEED) * timeScale;
          if (platform.x < -PLATFORM_WIDTH) platform.x = CANVAS_WIDTH;
        }
        if (platform.movement === 'conveyor-right') {
          platform.x += (CONVEYOR_SPEED * GAME_SPEED) * timeScale;
          if (platform.x > CANVAS_WIDTH) platform.x = -PLATFORM_WIDTH;
        }
      }
    }

    // ========== CHECK GAME OVER ==========
    if (positionRef.current.y < -50) {
      handleGameOver();
      return;
    }

    // ========== RENDER ==========
    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw platforms
    for (const platform of platformsRef.current) {
      ctx.save();
      ctx.globalAlpha = platform.opacity;

      // Platform color based on type
      if (platform.effect === 'bounce') {
        ctx.fillStyle = COLORS.platformBounce;
      } else if (platform.effect === 'disappear') {
        ctx.fillStyle = COLORS.platformDisappear;
      } else if (platform.effect === 'instant-disappear') {
        ctx.fillStyle = COLORS.platformInstantDisappear;
      } else if (platform.movement === 'moving') {
        ctx.fillStyle = COLORS.platformMoving;
      } else if (platform.movement === 'conveyor-left' || platform.movement === 'conveyor-right') {
        ctx.fillStyle = COLORS.platformConveyor;
      } else {
        ctx.fillStyle = COLORS.platformNormal;
      }

      // Draw platform (bounce is round, others are rectangular)
      const platY = CANVAS_HEIGHT - platform.y - PLATFORM_HEIGHT;
      if (platform.effect === 'bounce') {
        ctx.beginPath();
        ctx.ellipse(
          platform.x + PLATFORM_WIDTH / 2,
          platY + PLATFORM_HEIGHT / 2,
          PLATFORM_WIDTH / 2,
          PLATFORM_HEIGHT / 2,
          0, 0, Math.PI * 2
        );
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.roundRect(platform.x, platY, PLATFORM_WIDTH, PLATFORM_HEIGHT, 5);
        ctx.fill();
      }

      // Conveyor animation stripes
      if (platform.movement === 'conveyor-left' || platform.movement === 'conveyor-right') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        const stripeOffset = (timestamp / 20) % 20;
        const dir = platform.movement === 'conveyor-left' ? -1 : 1;
        for (let i = -1; i < PLATFORM_WIDTH / 20 + 1; i++) {
          const sx = platform.x + i * 20 + (dir * stripeOffset);
          if (sx >= platform.x && sx + 10 <= platform.x + PLATFORM_WIDTH) {
            ctx.fillRect(sx, platY, 10, PLATFORM_HEIGHT);
          }
        }
      }

      ctx.restore();
    }

    // Draw player (ball)
    const playerScreenY = CANVAS_HEIGHT - positionRef.current.y - CHARACTER_HEIGHT;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(
      positionRef.current.x + CHARACTER_WIDTH / 2,
      playerScreenY + CHARACTER_HEIGHT / 2,
      CHARACTER_WIDTH / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Draw eyes
    ctx.fillStyle = COLORS.background;
    const eyeOffsetX = facingLeftRef.current ? -4 : 4;
    ctx.beginPath();
    ctx.arc(positionRef.current.x + CHARACTER_WIDTH / 2 - 6 + eyeOffsetX, playerScreenY + CHARACTER_HEIGHT / 2 - 5, 4, 0, Math.PI * 2);
    ctx.arc(positionRef.current.x + CHARACTER_WIDTH / 2 + 6 + eyeOffsetX, playerScreenY + CHARACTER_HEIGHT / 2 - 5, 4, 0, Math.PI * 2);
    ctx.fill();

    // Continue loop
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [handleGameOver, generateNewPlatforms]);

  // ============================================
  // INPUT HANDLING
  // ============================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        moveLeftRef.current = true;
        e.preventDefault();
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        moveRightRef.current = true;
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        moveLeftRef.current = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        moveRightRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

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
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/games"
              className="text-sm text-muted-foreground tracking-wide uppercase hover:text-foreground transition-colors"
            >
              &larr; Jeux
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

      {/* Game Area with Leaderboard */}
      <div className="flex justify-center gap-6">
        {/* Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border border-border/30 rounded-lg"
          />

          {/* Start Screen */}
          {!started && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg">
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
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg">
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

        {/* Leaderboard Panel */}
        <div
          className="w-64 border border-border/30 rounded-lg bg-card overflow-hidden"
          style={{ height: CANVAS_HEIGHT }}
        >
          <div className="p-4 border-b border-border/30 bg-muted/30">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h3 className="font-semibold">Classement</h3>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ height: CANVAS_HEIGHT - 60 }}>
            {leaderboard.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Aucun score enregistré
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 px-4 py-2.5 group ${
                      entry.user.id === user?.id ? 'bg-primary/10' : ''
                    }`}
                  >
                    <span className={`w-6 text-center font-mono text-sm ${
                      index === 0 ? 'text-yellow-500 font-bold' :
                      index === 1 ? 'text-gray-400 font-bold' :
                      index === 2 ? 'text-amber-600 font-bold' :
                      'text-muted-foreground'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate text-sm">
                      {entry.user.username}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      {entry.highScore.toLocaleString()}
                    </span>
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

      {/* Controls & Info */}
      <div className="flex justify-center gap-8 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded">←</kbd>
          <span>Gauche</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded">→</kbd>
          <span>Droite</span>
        </div>
      </div>

      {/* Platform Legend */}
      <div className="flex justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: COLORS.platformNormal }}></div>
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: COLORS.platformMoving }}></div>
          <span>Mobile</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: COLORS.platformConveyor }}></div>
          <span>Tapis</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-2 rounded-full" style={{ backgroundColor: COLORS.platformBounce }}></div>
          <span>Trampoline</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: COLORS.platformDisappear }}></div>
          <span>Fragile</span>
        </div>
      </div>
    </div>
  );
}
