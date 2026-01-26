import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { Play, RotateCcw, Trophy, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

// ============================================
// GAME CONSTANTS
// ============================================
const KEY = {
  ESC: 27,
  SPACE: 32,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
};

const DIR = {
  UP: 0,
  RIGHT: 1,
  DOWN: 2,
  LEFT: 3,
  MIN: 0,
  MAX: 3,
};

const SPEED = {
  start: 0.6,
  decrement: 0.005,
  min: 0.1,
};

const NX = 10; // width of tetris court (in blocks)
const NY = 20; // height of tetris court (in blocks)
const NU = 5; // width/height of upcoming preview (in blocks)

const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 600;
const UPCOMING_SIZE = 150;

// ============================================
// TETRIS PIECES
// ============================================
const I = { size: 4, blocks: [0x0f00, 0x2222, 0x00f0, 0x4444], color: 'cyan' };
const J = { size: 3, blocks: [0x44c0, 0x8e00, 0x6440, 0x0e20], color: 'blue' };
const L = { size: 3, blocks: [0x4460, 0x0e80, 0xc440, 0x2e00], color: 'orange' };
const O = { size: 2, blocks: [0xcc00, 0xcc00, 0xcc00, 0xcc00], color: 'yellow' };
const S = { size: 3, blocks: [0x06c0, 0x8c40, 0x6c00, 0x4620], color: 'green' };
const T = { size: 3, blocks: [0x0e40, 0x4c40, 0x4e00, 0x4640], color: 'purple' };
const Z = { size: 3, blocks: [0x0c60, 0x4c80, 0xc600, 0x2640], color: 'red' };

// ============================================
// UTILITIES
// ============================================
function eachblock(type: any, x: number, y: number, dir: number, fn: (x: number, y: number) => void) {
  let bit, row = 0, col = 0;
  const blocks = type.blocks[dir];
  for (bit = 0x8000; bit > 0; bit = bit >> 1) {
    if (blocks & bit) {
      fn(x + col, y + row);
    }
    if (++col === 4) {
      col = 0;
      ++row;
    }
  }
}

// ============================================
// TYPES
// ============================================
interface Piece {
  type: any;
  dir: number;
  x: number;
  y: number;
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
// COMPONENT
// ============================================
export default function Tetris() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const upcomingCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const { user, refreshUser } = useAuth();
  const [score, setScore] = useState(0);
  const [vscore, setVscore] = useState(0); // Visual score (catches up)
  const [rows, setRows] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Game state refs
  const blocksRef = useRef<(any | null)[][]>([]);
  const actionsRef = useRef<number[]>([]);
  const playingRef = useRef<boolean>(false);
  const dtRef = useRef<number>(0);
  const currentRef = useRef<Piece | null>(null);
  const nextRef = useRef<Piece | null>(null);
  const scoreRef = useRef<number>(0);
  const rowsRef = useRef<number>(0);
  const stepRef = useRef<number>(SPEED.start);
  const dxRef = useRef<number>(CANVAS_WIDTH / NX);
  const dyRef = useRef<number>(CANVAS_HEIGHT / NY);
  const textureRef = useRef<HTMLImageElement | null>(null);

  // Initialize
  useEffect(() => {
    const img = new Image();
    img.src = '/images/tetris/texture.jpg';
    img.onload = () => {
      textureRef.current = img;
    };
    img.onerror = () => {
      textureRef.current = null;
    };
  }, []);

  // Fetch stats and leaderboard
  useEffect(() => {
    if (user) {
      fetchStats();
      fetchLeaderboard();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const response = await gamesApi.getStats('tetris', user!.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await gamesApi.getLeaderboard('tetris', 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };

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

  // Random piece generator (bag system)
  const piecesRef = useRef<any[]>([]);
  const randomPiece = useCallback((): Piece => {
    if (piecesRef.current.length === 0) {
      piecesRef.current = [I, I, I, I, J, J, J, J, L, L, L, L, O, O, O, O, S, S, S, S, T, T, T, T, Z, Z, Z, Z];
    }
    const type = piecesRef.current.splice(Math.floor(Math.random() * piecesRef.current.length), 1)[0];
    return { type, dir: DIR.UP, x: Math.round(Math.random() * (NX - type.size)), y: 0 };
  }, []);

  // Game logic
  const getBlock = useCallback((x: number, y: number): any | null => {
    return blocksRef.current[x]?.[y] || null;
  }, []);

  const setBlock = useCallback((x: number, y: number, type: any | null) => {
    if (!blocksRef.current[x]) {
      blocksRef.current[x] = [];
    }
    blocksRef.current[x][y] = type;
  }, []);

  const occupied = useCallback((type: any, x: number, y: number, dir: number): boolean => {
    let result = false;
    eachblock(type, x, y, dir, (bx, by) => {
      if (bx < 0 || bx >= NX || by < 0 || by >= NY || getBlock(bx, by)) {
        result = true;
      }
    });
    return result;
  }, [getBlock]);

  const unoccupied = useCallback((type: any, x: number, y: number, dir: number): boolean => {
    return !occupied(type, x, y, dir);
  }, [occupied]);

  const move = useCallback((dir: number): boolean => {
    if (!currentRef.current) return false;
    const current = currentRef.current;
    let x = current.x;
    let y = current.y;

    switch (dir) {
      case DIR.RIGHT:
        x = x + 1;
        break;
      case DIR.LEFT:
        x = x - 1;
        break;
      case DIR.DOWN:
        y = y + 1;
        break;
    }

    if (unoccupied(current.type, x, y, current.dir)) {
      current.x = x;
      current.y = y;
      return true;
    }
    return false;
  }, [unoccupied]);

  const rotate = useCallback(() => {
    if (!currentRef.current) return;
    const newdir = currentRef.current.dir === DIR.MAX ? DIR.MIN : currentRef.current.dir + 1;
    if (unoccupied(currentRef.current.type, currentRef.current.x, currentRef.current.y, newdir)) {
      currentRef.current.dir = newdir;
    }
  }, [unoccupied]);

  const dropPiece = useCallback(() => {
    if (!currentRef.current) return;
    eachblock(currentRef.current.type, currentRef.current.x, currentRef.current.y, currentRef.current.dir, (x, y) => {
      setBlock(x, y, currentRef.current!.type);
    });
  }, [setBlock]);

  const removeLines = useCallback(() => {
    let n = 0;
    for (let y = NY; y > 0; --y) {
      let complete = true;
      for (let x = 0; x < NX; ++x) {
        if (!getBlock(x, y)) {
          complete = false;
        }
      }
      if (complete) {
        // Remove line
        for (let yy = y; yy >= 0; --yy) {
          for (let x = 0; x < NX; ++x) {
            setBlock(x, yy, yy === 0 ? null : getBlock(x, yy - 1));
          }
        }
        y = y + 1; // recheck same line
        n++;
      }
    }
    if (n > 0) {
      rowsRef.current += n;
      setRows(rowsRef.current);
      stepRef.current = Math.max(SPEED.min, SPEED.start - SPEED.decrement * rowsRef.current);
      scoreRef.current += 100 * Math.pow(2, n - 1); // 1: 100, 2: 200, 3: 400, 4: 800
      setScore(scoreRef.current);
    }
  }, [getBlock, setBlock]);

  const drop = useCallback(() => {
    if (!move(DIR.DOWN)) {
      scoreRef.current += 10;
      setScore(scoreRef.current);
      dropPiece();
      removeLines();
      if (nextRef.current) {
        currentRef.current = nextRef.current;
        nextRef.current = randomPiece();
      } else {
        currentRef.current = randomPiece();
        nextRef.current = randomPiece();
      }
      actionsRef.current = [];
      if (currentRef.current && occupied(currentRef.current.type, currentRef.current.x, currentRef.current.y, currentRef.current.dir)) {
        lose();
      }
    }
  }, [move, dropPiece, removeLines, randomPiece, occupied]);

  const handle = useCallback((action: number | undefined) => {
    if (action === undefined) return;
    switch (action) {
      case DIR.LEFT:
        move(DIR.LEFT);
        break;
      case DIR.RIGHT:
        move(DIR.RIGHT);
        break;
      case DIR.UP:
        rotate();
        break;
      case DIR.DOWN:
        drop();
        break;
    }
  }, [move, rotate, drop]);

  // Initialize game
  const reset = useCallback(() => {
    dtRef.current = 0;
    actionsRef.current = [];
    blocksRef.current = [];
    rowsRef.current = 0;
    setRows(0);
    scoreRef.current = 0;
    setScore(0);
    setVscore(0);
    stepRef.current = SPEED.start;
    currentRef.current = nextRef.current || randomPiece();
    nextRef.current = randomPiece();
  }, [randomPiece]);

  const play = useCallback(() => {
    reset();
    setGameOver(false);
    setStarted(true);
    setRewards(null);
    setIsNewHighScore(false);
    playingRef.current = true;
    lastTimeRef.current = 0;
  }, [reset]);

  const lose = useCallback(() => {
    playingRef.current = false;
    setGameOver(true);
    handleGameOver();
  }, []);

  // Handle game over
  const handleGameOver = useCallback(async () => {
    const finalScore = scoreRef.current;
    playingRef.current = false;

    try {
      const response = await gamesApi.complete('tetris', {
        score: finalScore,
        won: false, // Tetris doesn't have a win condition, just score
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
      fetchStats();
    } catch (error) {
      console.error('Failed to submit score:', error);
    }
  }, [refreshUser]);

  // Update visual score
  useEffect(() => {
    if (vscore < score) {
      const timer = setTimeout(() => {
        setVscore((prev) => Math.min(prev + 1, score));
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [vscore, score]);

  // Rendering
  const drawBlock = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * dxRef.current, y * dyRef.current, dxRef.current, dyRef.current);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * dxRef.current, y * dyRef.current, dxRef.current, dyRef.current);
  }, []);

  const drawPiece = useCallback((ctx: CanvasRenderingContext2D, type: any, x: number, y: number, dir: number) => {
    eachblock(type, x, y, dir, (bx, by) => {
      drawBlock(ctx, bx, by, type.color);
    });
  }, [drawBlock]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const upcomingCanvas = upcomingCanvasRef.current;
    const uctx = upcomingCanvas?.getContext('2d');

    if (!canvas || !ctx) return;

    // Draw court
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background texture if available
    if (textureRef.current) {
      ctx.drawImage(textureRef.current, 0, 0, canvas.width, canvas.height);
    }

    // Draw current piece
    if (playingRef.current && currentRef.current) {
      drawPiece(ctx, currentRef.current.type, currentRef.current.x, currentRef.current.y, currentRef.current.dir);
    }

    // Draw placed blocks
    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const block = getBlock(x, y);
        if (block) {
          drawBlock(ctx, x, y, block.color);
        }
      }
    }

    // Draw court boundary
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, NX * dxRef.current - 1, NY * dyRef.current - 1);

    // Draw next piece
    if (uctx && nextRef.current) {
      const padding = (NU - nextRef.current.type.size) / 2;
      uctx.save();
      uctx.translate(0.5, 0.5);
      uctx.clearRect(0, 0, NU * dxRef.current, NU * dyRef.current);
      drawPiece(uctx, nextRef.current.type, padding, padding, nextRef.current.dir);
      uctx.strokeStyle = 'black';
      uctx.strokeRect(0, 0, NU * dxRef.current - 1, NU * dyRef.current - 1);
      uctx.restore();
    }
  }, [drawPiece, drawBlock, getBlock]);

  // Game loop
  useEffect(() => {
    if (!started || gameOver) return;

    const frame = (timestamp: number) => {
      if (!playingRef.current) return;

      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min(1, (timestamp - lastTimeRef.current) / 1000.0);
      lastTimeRef.current = timestamp;

      // Handle actions
      handle(actionsRef.current.shift());

      // Update visual score
      if (vscore < score) {
        setVscore((prev) => Math.min(prev + 1, score));
      }

      // Drop piece
      dtRef.current += dt;
      if (dtRef.current > stepRef.current) {
        dtRef.current -= stepRef.current;
        drop();
      }

      draw();
      animationRef.current = requestAnimationFrame(frame);
    };

    animationRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [started, gameOver, handle, drop, draw, vscore, score]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!started || gameOver) {
        if (e.keyCode === KEY.SPACE) {
          play();
          e.preventDefault();
        }
        return;
      }

      if (!playingRef.current) return;

      let handled = false;
      switch (e.keyCode) {
        case KEY.LEFT:
          actionsRef.current.push(DIR.LEFT);
          handled = true;
          break;
        case KEY.RIGHT:
          actionsRef.current.push(DIR.RIGHT);
          handled = true;
          break;
        case KEY.UP:
          actionsRef.current.push(DIR.UP);
          handled = true;
          break;
        case KEY.DOWN:
          actionsRef.current.push(DIR.DOWN);
          handled = true;
          break;
        case KEY.ESC:
          lose();
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [started, gameOver, play, lose]);

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
      <div className="flex items-center justify-end gap-4">
        <div className="text-right text-sm text-muted-foreground tabular-nums">
          <div className="text-3xl font-light text-foreground">{Math.floor(vscore).toLocaleString()}</div>
          <div>Lignes: {rows}</div>
          <div>Record: {highScore.toLocaleString()}</div>
        </div>
      </div>

      {/* Game Area with Leaderboard */}
      <div className="flex justify-center gap-6">
        {/* Game Canvas */}
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
                onClick={play}
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

                {isNewHighScore && <p className="text-sm text-foreground">Nouveau record !</p>}

                {rewards && (rewards.money > 0 || rewards.aura > 0) && (
                  <p className="text-sm text-muted-foreground">
                    {rewards.money > 0 && `+$${rewards.money}`}
                    {rewards.money > 0 && rewards.aura > 0 && ' · '}
                    {rewards.aura > 0 && `+${rewards.aura} aura`}
                  </p>
                )}

                <button
                  onClick={play}
                  className="flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors mx-auto"
                >
                  <RotateCcw className="w-4 h-4" />
                  Rejouer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="flex flex-col gap-4">
          {/* Next Piece */}
          <div className="border border-border/30 rounded-lg bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Suivant</h3>
            <canvas
              ref={upcomingCanvasRef}
              width={UPCOMING_SIZE}
              height={UPCOMING_SIZE}
              className="border border-border/30 rounded"
            />
          </div>

          {/* Leaderboard Panel */}
          <div
            className="w-64 border border-border/30 rounded-lg bg-card overflow-hidden"
            style={{ height: CANVAS_HEIGHT - UPCOMING_SIZE - 32 }}
          >
            <div className="p-4 border-b border-border/30 bg-muted/30">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h3 className="font-semibold">Classement</h3>
              </div>
            </div>
            <div className="overflow-y-auto" style={{ height: CANVAS_HEIGHT - UPCOMING_SIZE - 100 }}>
              {leaderboard.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Aucun score enregistré</div>
              ) : (
                <div className="divide-y divide-border/20">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-3 px-4 py-2.5 group ${
                        entry.user.id === user?.id ? 'bg-primary/10' : ''
                      }`}
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
      </div>

      {/* Controls & Info */}
      <div className="flex justify-center gap-8 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
          </kbd>
          <span>Gauche</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
          </kbd>
          <span>Droite</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded flex items-center gap-1">
            <ArrowUp className="w-3 h-3" />
          </kbd>
          <span>Tourner</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded flex items-center gap-1">
            <ArrowDown className="w-3 h-3" />
          </kbd>
          <span>Descendre</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded">ESC</kbd>
          <span>Abandonner</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
        <p>Utilise les flèches pour déplacer et tourner les pièces. Complète des lignes pour gagner des points !</p>
      </div>
    </div>
  );
}
