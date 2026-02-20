import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import { gamesApi } from '../services/api';
import { Play, RotateCcw, Trophy, X, Palette, Eye, EyeOff, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

// ============================================
// GAME CONSTANTS (from old implementation)
// ============================================
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;

// Physics (exact values from old implementation)
const GAME_SPEED = 1.85;
const GRAVITY = 0.4;
const JUMP_FORCE = -13.5;
const MOVEMENT_SPEED = 3.55;
const TRAMPOLINE_JUMP_FORCE = -22;
const CONVEYOR_SPEED = 2;
const MOVING_PLATFORM_SPEED = 1;

// Dimensions
const CHARACTER_WIDTH = 40;
const CHARACTER_HEIGHT = 40;
const PLATFORM_WIDTH = 80;
const PLATFORM_HEIGHT = 15;
const PLATFORM_COUNT = 7;
const PLAYER_IMAGE_SRC = '/assets/doodle-player.png';

// Timing
const DISAPPEARING_PLATFORM_FADE_TIME = 1000;
const BROKEN_PLATFORM_FADE_TIME = 500;

// ============================================
// SKINS
// ============================================
export type SkinId = 'default' | 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'pink';

export interface Skin {
  id: SkinId;
  name: string;
  color: string;
  eyeColor: string;
}

export const SKINS: Skin[] = [
  { id: 'default', name: 'Classique', color: '#111827', eyeColor: '#ffffff' },
  { id: 'red', name: 'Rouge', color: '#ef4444', eyeColor: '#ffffff' },
  { id: 'blue', name: 'Bleu', color: '#3b82f6', eyeColor: '#ffffff' },
  { id: 'green', name: 'Vert', color: '#22c55e', eyeColor: '#ffffff' },
  { id: 'yellow', name: 'Jaune', color: '#eab308', eyeColor: '#000000' },
  { id: 'purple', name: 'Violet', color: '#a855f7', eyeColor: '#ffffff' },
  { id: 'orange', name: 'Orange', color: '#f97316', eyeColor: '#ffffff' },
  { id: 'pink', name: 'Rose', color: '#ec4899', eyeColor: '#ffffff' },
];

const SKIN_STORAGE_KEY = 'doodle-jump-skin';
const MORT_SUBITE_PLATFORM_COLOR = '#dc2626';

// ============================================
// TYPES
// ============================================
type PlatformMovement = 'normal' | 'moving' | 'conveyor-left' | 'conveyor-right';
type PlatformEffect = 'bounce' | 'disappear' | 'instant-disappear' | null;
type DoodleGameType = 'doodle_jump' | 'doodle_jump_mort_subite';
type DoodleGameMode = 'classic' | 'mort_subite';

interface Platform {
  id?: string;
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

interface DoodleSpectateFrame {
  timestamp: number;
  score: number;
  mode: DoodleGameMode;
  gameRunning: boolean;
  gameOver: boolean;
  selectedSkin: SkinId;
  facingLeft: boolean;
  player: {
    x: number;
    y: number;
    velocity: number;
  };
  platforms: Platform[];
}

interface DoodleMultiplayerNetState {
  userId: string;
  username: string;
  usernameColor?: string | null;
  score: number;
  x: number;
  worldY: number;
  velocity: number;
  facingLeft: boolean;
  selectedSkin: SkinId;
  isDead: boolean;
  updatedAt: number;
}

interface DoodleMultiplayerDisplayState extends DoodleMultiplayerNetState {
  displayX: number;
  displayWorldY: number;
  displayVelocity: number;
  deadFallStarted: boolean;
}

interface DoodleMultiplayerRosterItem {
  userId: string;
  username: string;
  usernameColor?: string | null;
  score: number;
  isDead: boolean;
}

const seededRandom = (seed: number, index: number, channel: number) => {
  let value = seed ^ Math.imul(index + 1, 374761393) ^ Math.imul(channel + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
};

// ============================================
// COLOR SCHEME (theme-aware)
// ============================================
const getColors = (theme: 'light' | 'dark') => {
  if (theme === 'light') {
    return {
      background: '#f8fafc',
      platformNormal: '#1f2937',
      platformMoving: '#374151',
      platformConveyor: '#4b5563',
      platformBounce: '#7c3aed',
      platformDisappear: '#a855f7',
      platformInstantDisappear: '#c084fc',
      player: '#111827',
      text: '#0f172a',
      scoreBackground: 'rgba(255, 255, 255, 0.9)',
    };
  }

  return {
    background: '#0a0a0a',
    platformNormal: '#e5e7eb',
    platformMoving: '#9ca3af',
    platformConveyor: '#6b7280',
    platformBounce: '#7c3aed',
    platformDisappear: '#8b5cf6',
    platformInstantDisappear: '#a78bfa',
    player: '#ffffff',
    text: '#ffffff',
    scoreBackground: 'rgba(30, 30, 30, 0.9)',
  };
};

// ============================================
// COMPONENT
// ============================================
export default function DoodleJump() {
  const location = useLocation();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const { theme } = useTheme();
  const colors = useMemo(() => getColors(theme), [theme]);

  // Game state refs
  const platformsRef = useRef<Platform[]>([]);
  const scoreRef = useRef(0);
  const worldOffsetRef = useRef(0);
  const gameRunningRef = useRef(false);
  const velocityRef = useRef(0);
  const positionRef = useRef({ x: 175, y: 100 });
  const moveLeftRef = useRef(false);
  const moveRightRef = useRef(false);
  const facingLeftRef = useRef(false);
  const playerImageRef = useRef<HTMLImageElement | null>(null);
  const activeGameTypeRef = useRef<DoodleGameType>('doodle_jump');
  const activeModeRef = useRef<DoodleGameMode>('classic');
  const lastBroadcastAtRef = useRef(0);
  const spectatingRef = useRef(false);
  const spectateTargetFrameRef = useRef<DoodleSpectateFrame | null>(null);
  const spectateReplayQueueRef = useRef<DoodleSpectateFrame[]>([]);
  const spectateSkinRef = useRef<SkinId>('default');
  const multiplayerSeedRef = useRef<number | null>(null);
  const multiplayerPlatformIndexRef = useRef(0);
  const platformIdCounterRef = useRef(0);
  const multiplayerRoomIdRef = useRef<string | null>(null);
  const multiplayerSocketIdRef = useRef<string | null>(null);
  const multiplayerDisplayPlayersRef = useRef<Map<string, DoodleMultiplayerDisplayState>>(new Map());
  const pendingMultiplayerStartRef = useRef(false);

  const { user, refreshUser } = useAuth();
  const { socket } = useSocket();
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerImageLoaded, setPlayerImageLoaded] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState<SkinId>(() => {
    const saved = localStorage.getItem(SKIN_STORAGE_KEY);
    return (saved as SkinId) || 'default';
  });
  const [showSkinSelector, setShowSkinSelector] = useState(false);
  const [isMortSubite, setIsMortSubite] = useState(false);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [spectatingHost, setSpectatingHost] = useState<{ hostUserId: string; hostUsername: string } | null>(null);
  const [multiplayerRoster, setMultiplayerRoster] = useState<DoodleMultiplayerRosterItem[]>([]);
  const spectateHostUserIdFromRoute = ((location.state as { spectateHostUserId?: string } | null)?.spectateHostUserId) ?? null;
  const selectedGameType: DoodleGameType = isMortSubite ? 'doodle_jump_mort_subite' : 'doodle_jump';
  const selectedMode: DoodleGameMode = isMortSubite ? 'mort_subite' : 'classic';
  const displayMode: DoodleGameMode = started ? activeModeRef.current : selectedMode;

  useEffect(() => {
    const img = new Image();
    img.src = PLAYER_IMAGE_SRC;
    img.onload = () => setPlayerImageLoaded(true);
    img.onerror = () => setPlayerImageLoaded(false);
    playerImageRef.current = img;

    return () => {
      playerImageRef.current = null;
    };
  }, []);

  // Save skin selection to localStorage
  useEffect(() => {
    localStorage.setItem(SKIN_STORAGE_KEY, selectedSkin);
  }, [selectedSkin]);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await gamesApi.getStats(selectedGameType, user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [selectedGameType, user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(selectedGameType, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  }, [selectedGameType]);

  // Fetch stats and leaderboard when mode changes
  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchStats, fetchLeaderboard]);

  // Admin: Delete a user's high score
  const handleDeleteScore = async (userId: string, username: string) => {
    if (!confirm(`Supprimer le score de ${username} ?`)) return;

    try {
      await gamesApi.deleteStats(selectedGameType, userId);
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

  const applyMortSubiteRules = useCallback((movement: PlatformMovement, effect: PlatformEffect): { movement: PlatformMovement; effect: PlatformEffect } => {
    if (activeModeRef.current !== 'mort_subite') {
      return { movement, effect };
    }

    // In mort subite, everything disappears instantly except moving and bounce platforms.
    if (movement === 'moving' || effect === 'bounce') {
      return { movement, effect };
    }

    return { movement, effect: 'instant-disappear' };
  }, []);

  const getPlatformSequenceIndex = useCallback(() => {
    const nextIndex = multiplayerPlatformIndexRef.current;
    multiplayerPlatformIndexRef.current += 1;
    return nextIndex;
  }, []);

  const getSeededValue = useCallback((index: number, channel: number) => {
    if (multiplayerSeedRef.current === null) {
      return Math.random();
    }
    return seededRandom(multiplayerSeedRef.current, index, channel);
  }, []);

  const clearMultiplayerRoom = useCallback(() => {
    if (socket && multiplayerRoomIdRef.current) {
      socket.emit('doodle:multiplayer-leave');
    }
    multiplayerRoomIdRef.current = null;
    multiplayerSocketIdRef.current = null;
    multiplayerSeedRef.current = null;
    multiplayerPlatformIndexRef.current = 0;
    pendingMultiplayerStartRef.current = false;
    multiplayerDisplayPlayersRef.current.clear();
    setMultiplayerRoster([]);
  }, [socket]);

  // ============================================
  // PLATFORM GENERATION (from old implementation)
  // ============================================
  const getRandomPlatformType = useCallback((platformIndex: number): { movement: PlatformMovement; effect: PlatformEffect } => {
    const currentScore = multiplayerSeedRef.current === null ? scoreRef.current : platformIndex * 10;
    const scoreFactor = Math.min(currentScore / 3000, 1);
    const random = getSeededValue(platformIndex, 1);

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

    return applyMortSubiteRules(movement, effect);
  }, [applyMortSubiteRules, getSeededValue]);

  const createPlatform = useCallback((x: number, y: number, movement: PlatformMovement = 'normal', effect: PlatformEffect = null): Platform => {
    return {
      id: `platform-${platformIdCounterRef.current++}`,
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
      const platformIndex = getPlatformSequenceIndex();
      const { movement, effect } = getRandomPlatformType(platformIndex);
      const newPlatformY = highestPlatform + 100 + (i * 50);
      const platform = createPlatform(
        getSeededValue(platformIndex, 2) * (CANVAS_WIDTH - PLATFORM_WIDTH),
        newPlatformY,
        movement,
        effect
      );
      platformsRef.current.push(platform);
    }
  }, [createPlatform, getPlatformSequenceIndex, getRandomPlatformType, getSeededValue]);

  // ============================================
  // GAME INITIALIZATION
  // ============================================
  const initGame = useCallback(() => {
    if (spectatingRef.current) {
      socket?.emit('doodle:spectate-leave');
      spectatingRef.current = false;
      spectateTargetFrameRef.current = null;
      spectateReplayQueueRef.current = [];
      setSpectatingHost(null);
      setSpectatorCount(0);
    }

    if (socket && user && isMultiplayer && !spectatingRef.current) {
      const expectedRoomId = `doodle:multiplayer:${selectedMode}:${new Date().toISOString().slice(0, 10)}`;
      const needsJoin =
        !socket.connected ||
        !multiplayerRoomIdRef.current ||
        multiplayerRoomIdRef.current !== expectedRoomId ||
        multiplayerSeedRef.current === null ||
        multiplayerSocketIdRef.current !== socket.id;
      if (needsJoin) {
        pendingMultiplayerStartRef.current = true;
        socket.emit('doodle:multiplayer-join', { mode: selectedMode });
        return;
      }
    }

    activeModeRef.current = selectedMode;
    activeGameTypeRef.current = selectedGameType;
    multiplayerPlatformIndexRef.current = 0;
    platformIdCounterRef.current = 0;

    // Reset state
    platformsRef.current = [];
    scoreRef.current = 0;
    worldOffsetRef.current = 0;
    velocityRef.current = 0;
    positionRef.current = { x: CANVAS_WIDTH / 2 - CHARACTER_WIDTH / 2, y: 200 };
    gameRunningRef.current = true;
    lastTimeRef.current = 0;

    // Create initial platforms
    // Start platform under player
    const startType = applyMortSubiteRules('normal', null);
    platformsRef.current.push(createPlatform(160, 100, startType.movement, startType.effect));

    for (let i = 1; i < PLATFORM_COUNT; i++) {
      const platformIndex = getPlatformSequenceIndex();
      const { movement, effect } = i < 3
        ? { movement: 'normal' as PlatformMovement, effect: null }
        : getRandomPlatformType(platformIndex);
      const adjustedType = applyMortSubiteRules(movement, effect);
      const platform = createPlatform(
        getSeededValue(platformIndex, 3) * (CANVAS_WIDTH - PLATFORM_WIDTH),
        100 + i * 100,
        adjustedType.movement,
        adjustedType.effect
      );
      platformsRef.current.push(platform);
    }

    setScore(0);
    setGameOver(false);
    setStarted(true);
    setRewards(null);
    setIsNewHighScore(false);
    setSpectatorCount(0);
    lastBroadcastAtRef.current = 0;

    socket?.emit('doodle:spectate-start', { mode: selectedMode });
    if (!isMultiplayer) {
      clearMultiplayerRoom();
    } else if (socket && user && multiplayerRoomIdRef.current && !spectatingRef.current) {
      socket.emit('doodle:multiplayer-state', {
        mode: activeModeRef.current,
        state: {
          score: scoreRef.current,
          x: positionRef.current.x,
          worldY: worldOffsetRef.current + positionRef.current.y,
          velocity: velocityRef.current,
          facingLeft: facingLeftRef.current,
          selectedSkin,
          isDead: false,
        },
      });
    }
  }, [applyMortSubiteRules, clearMultiplayerRoom, createPlatform, getPlatformSequenceIndex, getRandomPlatformType, getSeededValue, isMultiplayer, selectedGameType, selectedMode, selectedSkin, socket, user]);

  const stopSpectateBroadcast = useCallback(() => {
    socket?.emit('doodle:spectate-stop');
    setSpectatorCount(0);
  }, [socket]);

  const buildSpectateFrame = useCallback((timestamp: number, ended: boolean): DoodleSpectateFrame => {
    return {
      timestamp,
      score: scoreRef.current,
      mode: activeModeRef.current,
      gameRunning: gameRunningRef.current && !ended,
      gameOver: ended,
      selectedSkin,
      facingLeft: facingLeftRef.current,
      player: {
        x: positionRef.current.x,
        y: positionRef.current.y,
        velocity: velocityRef.current,
      },
      platforms: platformsRef.current.map((platform) => ({ ...platform })),
    };
  }, [selectedSkin]);

  const emitMultiplayerState = useCallback((isDead: boolean) => {
    if (!socket || !user || !multiplayerRoomIdRef.current || spectatingRef.current) return;
    socket.emit('doodle:multiplayer-state', {
      mode: activeModeRef.current,
      state: {
        score: scoreRef.current,
        x: positionRef.current.x,
        worldY: worldOffsetRef.current + positionRef.current.y,
        velocity: velocityRef.current,
        facingLeft: facingLeftRef.current,
        selectedSkin,
        isDead,
      },
    });
  }, [selectedSkin, socket, user]);

  // ============================================
  // GAME OVER HANDLING
  // ============================================
  const handleGameOver = useCallback(async () => {
    const finalScore = scoreRef.current;
    gameRunningRef.current = false;
    setGameOver(true);
    if (socket) {
      socket.emit('doodle:spectate-frame', { frame: buildSpectateFrame(performance.now(), true) });
    }
    emitMultiplayerState(true);
    stopSpectateBroadcast();

    try {
      const response = await gamesApi.complete(activeGameTypeRef.current, {
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
  }, [buildSpectateFrame, emitMultiplayerState, fetchLeaderboard, refreshUser, socket, stopSpectateBroadcast]);

  const drawCurrentScene = useCallback((ctx: CanvasRenderingContext2D, timestamp: number, skinId: SkinId) => {
    // Clear canvas
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw platforms
    for (const platform of platformsRef.current) {
      ctx.save();
      ctx.globalAlpha = platform.opacity;

      if (activeModeRef.current === 'mort_subite') {
        ctx.fillStyle = MORT_SUBITE_PLATFORM_COLOR;
      } else {
        if (platform.effect === 'bounce') {
          ctx.fillStyle = colors.platformBounce;
        } else if (platform.effect === 'disappear') {
          ctx.fillStyle = colors.platformDisappear;
        } else if (platform.effect === 'instant-disappear') {
          ctx.fillStyle = colors.platformInstantDisappear;
        } else if (platform.movement === 'moving') {
          ctx.fillStyle = colors.platformMoving;
        } else if (platform.movement === 'conveyor-left' || platform.movement === 'conveyor-right') {
          ctx.fillStyle = colors.platformConveyor;
        } else {
          ctx.fillStyle = colors.platformNormal;
        }
      }

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

    const playerScreenY = CANVAS_HEIGHT - positionRef.current.y - CHARACTER_HEIGHT;
    const skin = SKINS.find((s) => s.id === skinId) || SKINS[0];

    if (playerImageLoaded && playerImageRef.current && skinId === 'default') {
      ctx.save();
      if (facingLeftRef.current) {
        ctx.translate(positionRef.current.x + CHARACTER_WIDTH, playerScreenY);
        ctx.scale(-1, 1);
        ctx.drawImage(playerImageRef.current, 0, 0, CHARACTER_WIDTH, CHARACTER_HEIGHT);
      } else {
        ctx.drawImage(
          playerImageRef.current,
          positionRef.current.x,
          playerScreenY,
          CHARACTER_WIDTH,
          CHARACTER_HEIGHT
        );
      }
      ctx.restore();
    } else {
      ctx.fillStyle = skin.color;
      ctx.beginPath();
      ctx.arc(
        positionRef.current.x + CHARACTER_WIDTH / 2,
        playerScreenY + CHARACTER_HEIGHT / 2,
        CHARACTER_WIDTH / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.fillStyle = skin.eyeColor;
      const eyeOffsetX = facingLeftRef.current ? -4 : 4;
      ctx.beginPath();
      ctx.arc(positionRef.current.x + CHARACTER_WIDTH / 2 - 6 + eyeOffsetX, playerScreenY + CHARACTER_HEIGHT / 2 - 5, 4, 0, Math.PI * 2);
      ctx.arc(positionRef.current.x + CHARACTER_WIDTH / 2 + 6 + eyeOffsetX, playerScreenY + CHARACTER_HEIGHT / 2 - 5, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw multiplayer players in the same world space
    for (const remote of multiplayerDisplayPlayersRef.current.values()) {
      if (user && remote.userId === user.id) continue;
      const liveLerp = remote.isDead ? 0.2 : 0.3;
      remote.displayX += (remote.x - remote.displayX) * liveLerp;
      if (remote.isDead) {
        if (!remote.deadFallStarted) {
          remote.deadFallStarted = true;
          remote.displayVelocity = Math.max(1, remote.velocity);
        }
        remote.displayVelocity += GRAVITY * GAME_SPEED * 0.9;
        remote.displayWorldY -= remote.displayVelocity * 0.7;
      } else {
        remote.deadFallStarted = false;
        remote.displayWorldY += (remote.worldY - remote.displayWorldY) * liveLerp;
        remote.displayVelocity = remote.velocity;
      }

      const remoteLocalY = remote.displayWorldY - worldOffsetRef.current;
      const remoteScreenY = CANVAS_HEIGHT - remoteLocalY - CHARACTER_HEIGHT;
      if (remoteScreenY < -80) {
        const markerX = Math.max(10, Math.min(CANVAS_WIDTH - 10, remote.displayX + CHARACTER_WIDTH / 2));
        ctx.fillStyle = remote.usernameColor || '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(markerX, 6);
        ctx.lineTo(markerX - 6, 16);
        ctx.lineTo(markerX + 6, 16);
        ctx.closePath();
        ctx.fill();
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = remote.usernameColor || '#e5e7eb';
        ctx.fillText(remote.username, markerX, 26);
        continue;
      }
      if (remoteScreenY > CANVAS_HEIGHT + 80) {
        continue;
      }

      const remoteSkin = SKINS.find((item) => item.id === remote.selectedSkin) ?? SKINS[0];
      ctx.fillStyle = remoteSkin.color;
      ctx.globalAlpha = remote.isDead ? 0.7 : 0.9;
      ctx.beginPath();
      ctx.arc(
        remote.displayX + CHARACTER_WIDTH / 2,
        remoteScreenY + CHARACTER_HEIGHT / 2,
        CHARACTER_WIDTH / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, [colors, playerImageLoaded, user]);

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
    // Use smaller max step to prevent phasing through platforms at low framerates
    const maxStep = Math.min(CHARACTER_HEIGHT / 4, PLATFORM_HEIGHT / 2);
    const numSteps = Math.max(1, Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaY)) / maxStep));
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
          // Also check previous position to catch platforms we may have passed through
          const prevCharacterBottom = characterBottom + stepY;

          const platformLeft = platform.x;
          const platformRight = platform.x + PLATFORM_WIDTH;
          const platformTop = platform.y + PLATFORM_HEIGHT;
          const platformBottom = platform.y;

          // Standard collision OR swept collision (character passed through platform this step)
          const standardCollision = characterBottom <= platformTop && characterBottom >= platformBottom;
          const sweptCollision = prevCharacterBottom > platformTop && characterBottom < platformBottom;

          if (
            characterRight > platformLeft &&
            characterLeft < platformRight &&
            (standardCollision || sweptCollision)
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

              // In mort subite, most platforms vanish immediately on contact.
              // Award points on consume so score progression does not stall at 0.
              if (activeModeRef.current === 'mort_subite' && platform.effect === 'instant-disappear') {
                scoreRef.current += 10;
                setScore(scoreRef.current);
              }

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
      worldOffsetRef.current += diff;

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

    if (socket && user && timestamp - lastBroadcastAtRef.current >= 50) {
      socket.emit('doodle:spectate-frame', { frame: buildSpectateFrame(timestamp, false) });
      emitMultiplayerState(false);
      lastBroadcastAtRef.current = timestamp;
    }

    drawCurrentScene(ctx, timestamp, selectedSkin);

    // Continue loop
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [handleGameOver, generateNewPlatforms, socket, user, buildSpectateFrame, emitMultiplayerState, drawCurrentScene, selectedSkin]);

  const applySpectateFrame = useCallback((frame: DoodleSpectateFrame, smooth: boolean) => {
    const lerp = smooth ? 0.35 : 1;

    activeModeRef.current = frame.mode;
    facingLeftRef.current = frame.facingLeft;
    spectateSkinRef.current = frame.selectedSkin;

    if (!smooth) {
      platformsRef.current = frame.platforms.map((platform) => ({ ...platform }));
    } else {
      const previousById = new Map(
        platformsRef.current
          .filter((platform) => typeof platform.id === 'string' && platform.id.length > 0)
          .map((platform) => [platform.id as string, platform])
      );
      platformsRef.current = frame.platforms.map((next, index) => {
        const previous = next.id ? previousById.get(next.id) : platformsRef.current[index];
        if (!previous) {
          return { ...next };
        }
        return {
          ...next,
          x: previous.x + (next.x - previous.x) * lerp,
          y: previous.y + (next.y - previous.y) * lerp,
          opacity: previous.opacity + (next.opacity - previous.opacity) * lerp,
        };
      });
    }

    positionRef.current = {
      x: positionRef.current.x + (frame.player.x - positionRef.current.x) * lerp,
      y: positionRef.current.y + (frame.player.y - positionRef.current.y) * lerp,
    };
    velocityRef.current = velocityRef.current + (frame.player.velocity - velocityRef.current) * lerp;

    if (scoreRef.current !== frame.score) {
      scoreRef.current = frame.score;
      setScore(frame.score);
    }
    setStarted(true);
    if (gameOver !== frame.gameOver) {
      setGameOver(frame.gameOver);
    }
  }, [gameOver]);

  useEffect(() => {
    if (!socket) return;

    const handleJoined = (data: {
      hostUserId: string;
      hostUsername: string;
      frame: DoodleSpectateFrame | null;
      replayFrames: DoodleSpectateFrame[];
      spectatorCount: number;
    }) => {
      stopSpectateBroadcast();
      clearMultiplayerRoom();
      spectatingRef.current = true;
      setSpectatingHost({ hostUserId: data.hostUserId, hostUsername: data.hostUsername });
      setRewards(null);
      setIsNewHighScore(false);
      setSpectatorCount(data.spectatorCount ?? 0);
      spectateReplayQueueRef.current = Array.isArray(data.replayFrames) ? data.replayFrames : [];
      spectateTargetFrameRef.current = data.frame;
      if (data.frame) {
        applySpectateFrame(data.frame, false);
      }
      gameRunningRef.current = false;
      navigate(location.pathname, { replace: true, state: null });
    };

    const handleFrame = (data: { hostUserId: string; frame: DoodleSpectateFrame }) => {
      if (!spectatingRef.current || !spectatingHost || data.hostUserId !== spectatingHost.hostUserId) return;
      spectateTargetFrameRef.current = data.frame;
    };

    const handleSpectatorCount = (data: { hostUserId: string; spectatorCount: number }) => {
      if (user && data.hostUserId === user.id) {
        setSpectatorCount(data.spectatorCount);
      }
      if (spectatingHost && data.hostUserId === spectatingHost.hostUserId) {
        setSpectatorCount(data.spectatorCount);
      }
    };

    const handleStopped = (data: { hostUserId: string }) => {
      if (!spectatingRef.current || !spectatingHost || data.hostUserId !== spectatingHost.hostUserId) return;
      spectatingRef.current = false;
      setSpectatingHost(null);
      spectateTargetFrameRef.current = null;
      spectateReplayQueueRef.current = [];
      setStarted(false);
      setGameOver(false);
      setScore(0);
      scoreRef.current = 0;
      setSpectatorCount(0);
    };

    const handleError = () => {
      spectatingRef.current = false;
      setSpectatingHost(null);
      setSpectatorCount(0);
    };

    socket.on('doodle:spectate-joined', handleJoined);
    socket.on('doodle:spectate-frame', handleFrame);
    socket.on('doodle:spectator-count', handleSpectatorCount);
    socket.on('doodle:spectate-stopped', handleStopped);
    socket.on('doodle:spectate-error', handleError);

    return () => {
      socket.off('doodle:spectate-joined', handleJoined);
      socket.off('doodle:spectate-frame', handleFrame);
      socket.off('doodle:spectator-count', handleSpectatorCount);
      socket.off('doodle:spectate-stopped', handleStopped);
      socket.off('doodle:spectate-error', handleError);
    };
  }, [applySpectateFrame, clearMultiplayerRoom, location.pathname, navigate, socket, spectatingHost, stopSpectateBroadcast, user]);

  useEffect(() => {
    if (!socket || !user || !spectateHostUserIdFromRoute) return;
    if (spectateHostUserIdFromRoute === user.id) {
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    socket.emit('doodle:spectate-join', { hostUserId: spectateHostUserIdFromRoute });
  }, [location.pathname, navigate, socket, spectateHostUserIdFromRoute, user]);

  useEffect(() => {
    if (!spectatingHost) return;
    const loop = (timestamp: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !spectatingRef.current) return;

      const replayFrame = spectateReplayQueueRef.current.length > 0
        ? spectateReplayQueueRef.current.shift() ?? null
        : null;
      const frame = replayFrame ?? spectateTargetFrameRef.current;
      if (frame) {
        applySpectateFrame(frame, replayFrame === null);
        drawCurrentScene(ctx, timestamp, spectateSkinRef.current);
      }
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [applySpectateFrame, drawCurrentScene, spectatingHost]);

  useEffect(() => {
    if (!socket || !user) return;

    const upsertDisplayPlayer = (player: DoodleMultiplayerNetState) => {
      if (player.userId === user.id) return;
      const existing = multiplayerDisplayPlayersRef.current.get(player.userId);
      if (!existing) {
        multiplayerDisplayPlayersRef.current.set(player.userId, {
          ...player,
          displayX: player.x,
          displayWorldY: player.worldY,
          displayVelocity: player.velocity,
          deadFallStarted: player.isDead,
        });
        return;
      }
      const wasDead = existing.isDead;
      existing.username = player.username;
      existing.usernameColor = player.usernameColor ?? null;
      existing.score = player.score;
      existing.x = player.x;
      existing.worldY = player.worldY;
      existing.velocity = player.velocity;
      existing.facingLeft = player.facingLeft;
      existing.selectedSkin = player.selectedSkin;
      existing.updatedAt = player.updatedAt;
      existing.isDead = player.isDead;
      if (!wasDead && player.isDead) {
        existing.deadFallStarted = false;
        existing.displayVelocity = Math.max(player.velocity, 1);
      }
      if (!player.isDead) {
        existing.displayWorldY = player.worldY;
      }
    };

    const handleJoined = (data: {
      roomId: string;
      mode: DoodleGameMode;
      dayKey: string;
      seed: number;
      players: DoodleMultiplayerNetState[];
    }) => {
      multiplayerRoomIdRef.current = data.roomId;
      multiplayerSocketIdRef.current = socket.id ?? null;
      multiplayerSeedRef.current = data.seed;
      multiplayerPlatformIndexRef.current = 0;
      multiplayerDisplayPlayersRef.current.clear();
      (data.players ?? []).forEach((player) => upsertDisplayPlayer(player));
      setMultiplayerRoster(
        (data.players ?? [])
          .map((player) => ({
            userId: player.userId,
            username: player.username,
            usernameColor: player.usernameColor ?? null,
            score: player.score,
            isDead: player.isDead,
          }))
          .sort((a, b) => b.score - a.score)
      );
      if (pendingMultiplayerStartRef.current) {
        pendingMultiplayerStartRef.current = false;
        initGame();
      }
    };

    const handleState = (data: { roomId: string; player: DoodleMultiplayerNetState }) => {
      if (!multiplayerRoomIdRef.current || data.roomId !== multiplayerRoomIdRef.current) return;
      upsertDisplayPlayer(data.player);
    };

    const handleRoster = (data: {
      roomId: string;
      players: DoodleMultiplayerRosterItem[];
    }) => {
      if (!multiplayerRoomIdRef.current || data.roomId !== multiplayerRoomIdRef.current) return;
      setMultiplayerRoster((data.players ?? []).sort((a, b) => b.score - a.score));
    };

    const handlePlayerJoined = (player: DoodleMultiplayerNetState) => {
      upsertDisplayPlayer(player);
    };

    const handlePlayerLeft = (data: { userId: string }) => {
      multiplayerDisplayPlayersRef.current.delete(data.userId);
      setMultiplayerRoster((prev) => prev.filter((player) => player.userId !== data.userId));
    };

    socket.on('doodle:multiplayer-joined', handleJoined);
    socket.on('doodle:multiplayer-state', handleState);
    socket.on('doodle:multiplayer-players', handleRoster);
    socket.on('doodle:multiplayer-player-joined', handlePlayerJoined);
    socket.on('doodle:multiplayer-player-left', handlePlayerLeft);

    return () => {
      socket.off('doodle:multiplayer-joined', handleJoined);
      socket.off('doodle:multiplayer-state', handleState);
      socket.off('doodle:multiplayer-players', handleRoster);
      socket.off('doodle:multiplayer-player-joined', handlePlayerJoined);
      socket.off('doodle:multiplayer-player-left', handlePlayerLeft);
    };
  }, [initGame, socket, user]);

  // ============================================
  // INPUT HANDLING
  // ============================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (spectatingRef.current) return;
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
      if (spectatingRef.current) return;
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
    if (started && !gameOver && !spectatingHost) {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [started, gameOver, gameLoop, spectatingHost]);

  // Close skin selector when game starts
  useEffect(() => {
    if (started) {
      setShowSkinSelector(false);
    }
  }, [started]);

  useEffect(() => {
    if (!socket || !user || spectatingRef.current || !isMultiplayer) return;

    const handleReconnect = () => {
      pendingMultiplayerStartRef.current = true;
      socket.emit('doodle:multiplayer-join', { mode: started ? activeModeRef.current : selectedMode });
    };

    socket.on('connect', handleReconnect);
    return () => {
      socket.off('connect', handleReconnect);
    };
  }, [isMultiplayer, selectedMode, socket, started, user]);

  useEffect(() => {
    if (!isMultiplayer) {
      clearMultiplayerRoom();
    }
  }, [clearMultiplayerRoom, isMultiplayer]);

  useEffect(() => {
    return () => {
      stopSpectateBroadcast();
      socket?.emit('doodle:spectate-leave');
      clearMultiplayerRoom();
    };
  }, [clearMultiplayerRoom, socket, stopSpectateBroadcast]);

  // Close skin selector when clicking outside
  useEffect(() => {
    if (!showSkinSelector) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-skin-selector]')) {
        setShowSkinSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSkinSelector]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
      <div className="flex items-center justify-end gap-4">
            {spectatingHost && (
              <button
                type="button"
                onClick={() => {
                  socket?.emit('doodle:spectate-leave');
                  spectatingRef.current = false;
                  setSpectatingHost(null);
                  spectateTargetFrameRef.current = null;
                  spectateReplayQueueRef.current = [];
                  setStarted(false);
                  setGameOver(false);
                  setScore(0);
                  scoreRef.current = 0;
                  setSpectatorCount(0);
                }}
                className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <EyeOff className="h-4 w-4" />
                Quitter spectate
              </button>
            )}
            <div className="relative" data-skin-selector>
              <button
                onClick={() => setShowSkinSelector(!showSkinSelector)}
                disabled={(started && !gameOver) || !!spectatingHost}
                className="flex items-center gap-2 px-4 py-2 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Choisir un skin"
              >
                <Palette className="w-4 h-4" />
                <span className="text-sm">Skin</span>
              </button>
              
              {showSkinSelector && !started && (
                <div className="absolute top-full right-0 mt-2 bg-card border border-border/50 rounded-lg shadow-lg p-4 z-50 w-[320px]" data-skin-selector>
                  <h3 className="text-sm font-semibold mb-3">Choisir un skin</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {SKINS.map((skin) => (
                      <button
                        key={skin.id}
                        onClick={() => {
                          setSelectedSkin(skin.id);
                          setShowSkinSelector(false);
                        }}
                        className={`relative p-2 rounded-lg border-2 transition-all hover:scale-105 ${
                          selectedSkin === skin.id
                            ? 'border-foreground bg-muted ring-2 ring-foreground/20'
                            : 'border-border/30 hover:border-border/60'
                        }`}
                        title={skin.name}
                      >
                        <div
                          className="w-full h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: skin.color }}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: skin.eyeColor,
                              boxShadow: `-5px 0 0 0 ${skin.eyeColor}, 5px 0 0 0 ${skin.eyeColor}`,
                            }}
                          />
                        </div>
                        <span className="text-xs mt-1.5 block text-center text-muted-foreground">{skin.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="text-right text-sm text-muted-foreground tabular-nums">
              <div className="text-3xl font-light text-foreground">{score.toLocaleString()}</div>
              <div>Record: {highScore.toLocaleString()}</div>
              {isMultiplayer && !spectatingHost && (
                <div className="text-xs">Daily seed active</div>
              )}
              {started && !spectatingHost && (
                <div className="flex items-center justify-end gap-1 text-xs">
                  <Eye className="h-3 w-3" />
                  <span>{spectatorCount} spectateurs</span>
                </div>
              )}
              {spectatingHost && (
                <div className="text-xs">Spectate: {spectatingHost.hostUsername}</div>
              )}
            </div>
          </div>

      {/* Game Area with Leaderboard */}
      <div className="flex justify-center gap-6">
        {/* Canvas */}
        <div className="relative">
          {started && isMultiplayer && !spectatingHost && (
            <div className="absolute left-2 right-2 top-2 z-20 rounded-md border border-border/40 bg-background/80 px-2 py-1 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Users className="h-3 w-3" />
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                  {multiplayerRoster.length === 0 ? (
                    <span>Connexion...</span>
                  ) : (
                    multiplayerRoster.map((player) => (
                      <span
                        key={player.userId}
                        className={`whitespace-nowrap ${player.isDead ? 'line-through opacity-70' : ''}`}
                        style={player.usernameColor ? { color: player.usernameColor } : undefined}
                      >
                        {player.username} ({player.score})
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border border-border/30 rounded-lg"
          />

          {/* Start Screen */}
          {!started && !spectatingHost && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg">
              <div className="flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsMortSubite((prev) => !prev)}
                  className={`w-56 px-3 py-2 rounded-md border transition-colors text-sm ${
                    isMortSubite
                      ? 'border-red-500 bg-red-500/10 text-red-500'
                      : 'border-border/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Mort subite: {isMortSubite ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMultiplayer((prev) => !prev)}
                  className={`w-56 px-3 py-2 rounded-md border transition-colors text-sm ${
                    isMultiplayer
                      ? 'border-sky-500 bg-sky-500/10 text-sky-500'
                      : 'border-border/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Multijoueur quotidien: {isMultiplayer ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={initGame}
                  className="flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Jouer
                </button>
              </div>
            </div>
          )}

          {/* Game Over Screen */}
          {gameOver && !spectatingHost && (
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
              <h3 className="font-semibold">
                Classement {displayMode === 'mort_subite' ? 'Mort subite' : 'Classique'}
              </h3>
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
      {displayMode === 'mort_subite' ? (
        <div className="flex justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: MORT_SUBITE_PLATFORM_COLOR }}></div>
            <span>Mort subite: plateformes rouges, disparition instantanée</span>
          </div>
        </div>
      ) : (
        <div className="flex justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: colors.platformNormal }}></div>
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: colors.platformMoving }}></div>
            <span>Mobile</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: colors.platformConveyor }}></div>
            <span>Tapis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-full" style={{ backgroundColor: colors.platformBounce }}></div>
            <span>Trampoline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: colors.platformDisappear }}></div>
            <span>Fragile</span>
          </div>
        </div>
      )}
    </div>
  );
}
