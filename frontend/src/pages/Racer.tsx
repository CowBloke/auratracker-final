import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi, DailyRacerLeaderboardEntry } from '../services/api';
import { Play, RotateCcw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useHideGameLeaderboards } from '@/lib/game-preferences';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';

// ============================================
// GAME CONSTANTS
// ============================================
const FPS = 60;
const STEP = 1 / FPS;
const WIDTH = 1024;
const HEIGHT = 768;
const CENTRIFUGAL = 0.3;
const SKY_SPEED = 0.001;
const HILL_SPEED = 0.002;
const TREE_SPEED = 0.003;
const ROAD_WIDTH = 2000;
const SEGMENT_LENGTH = 200;
const RUMBLE_LENGTH = 3;
const LANES = 3;
const FIELD_OF_VIEW = 100;
const CAMERA_HEIGHT = 1000;
const DRAW_DISTANCE = 300;
const FOG_DENSITY = 5;
const TOTAL_CARS = 200;

const KEY = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  D: 68,
  Q: 81,
  S: 83,
  Z: 90,
};

const COLORS = {
  SKY: '#72D7EE',
  TREE: '#005108',
  FOG: '#005108',
  LIGHT: { road: '#6B6B6B', grass: '#10AA10', rumble: '#555555', lane: '#CCCCCC' },
  DARK: { road: '#696969', grass: '#009A00', rumble: '#BBBBBB' },
  START: { road: 'white', grass: 'white', rumble: 'white' },
  FINISH: { road: 'black', grass: 'black', rumble: 'black' },
};

const BACKGROUND = {
  HILLS: { x: 5, y: 5, w: 1280, h: 480 },
  SKY: { x: 5, y: 495, w: 1280, h: 480 },
  TREES: { x: 5, y: 985, w: 1280, h: 480 },
};

const SPRITES = {
  PALM_TREE: { x: 5, y: 5, w: 215, h: 540 },
  BILLBOARD08: { x: 230, y: 5, w: 385, h: 265 },
  TREE1: { x: 625, y: 5, w: 360, h: 360 },
  DEAD_TREE1: { x: 5, y: 555, w: 135, h: 332 },
  BILLBOARD09: { x: 150, y: 555, w: 328, h: 282 },
  BOULDER3: { x: 230, y: 280, w: 320, h: 220 },
  COLUMN: { x: 995, y: 5, w: 200, h: 315 },
  BILLBOARD01: { x: 625, y: 375, w: 300, h: 170 },
  BILLBOARD06: { x: 488, y: 555, w: 298, h: 190 },
  BILLBOARD05: { x: 5, y: 897, w: 298, h: 190 },
  BILLBOARD07: { x: 313, y: 897, w: 298, h: 190 },
  BOULDER2: { x: 621, y: 897, w: 298, h: 140 },
  TREE2: { x: 1205, y: 5, w: 282, h: 295 },
  BILLBOARD04: { x: 1205, y: 310, w: 268, h: 170 },
  DEAD_TREE2: { x: 1205, y: 490, w: 150, h: 260 },
  BOULDER1: { x: 1205, y: 760, w: 168, h: 248 },
  BUSH1: { x: 5, y: 1097, w: 240, h: 155 },
  CACTUS: { x: 929, y: 897, w: 235, h: 118 },
  BUSH2: { x: 255, y: 1097, w: 232, h: 152 },
  BILLBOARD03: { x: 5, y: 1262, w: 230, h: 220 },
  BILLBOARD02: { x: 245, y: 1262, w: 215, h: 220 },
  STUMP: { x: 995, y: 330, w: 195, h: 140 },
  SEMI: { x: 1365, y: 490, w: 122, h: 144 },
  TRUCK: { x: 1365, y: 644, w: 100, h: 78 },
  CAR03: { x: 1383, y: 760, w: 88, h: 55 },
  CAR02: { x: 1383, y: 825, w: 80, h: 59 },
  CAR04: { x: 1383, y: 894, w: 80, h: 57 },
  CAR01: { x: 1205, y: 1018, w: 80, h: 56 },
  PLAYER_UPHILL_LEFT: { x: 1383, y: 961, w: 80, h: 45 },
  PLAYER_UPHILL_STRAIGHT: { x: 1295, y: 1018, w: 80, h: 45 },
  PLAYER_UPHILL_RIGHT: { x: 1385, y: 1018, w: 80, h: 45 },
  PLAYER_LEFT: { x: 995, y: 480, w: 80, h: 41 },
  PLAYER_STRAIGHT: { x: 1085, y: 480, w: 80, h: 41 },
  PLAYER_RIGHT: { x: 995, y: 531, w: 80, h: 41 },
  get SCALE(): number {
    return 0.3 * (1 / this.PLAYER_STRAIGHT.w);
  },
};

const BILLBOARDS = [
  SPRITES.BILLBOARD01,
  SPRITES.BILLBOARD02,
  SPRITES.BILLBOARD03,
  SPRITES.BILLBOARD04,
  SPRITES.BILLBOARD05,
  SPRITES.BILLBOARD06,
  SPRITES.BILLBOARD07,
  SPRITES.BILLBOARD08,
  SPRITES.BILLBOARD09,
];
const PLANTS = [
  SPRITES.TREE1,
  SPRITES.TREE2,
  SPRITES.DEAD_TREE1,
  SPRITES.DEAD_TREE2,
  SPRITES.PALM_TREE,
  SPRITES.BUSH1,
  SPRITES.BUSH2,
  SPRITES.CACTUS,
  SPRITES.STUMP,
  SPRITES.BOULDER1,
  SPRITES.BOULDER2,
  SPRITES.BOULDER3,
];
const CARS = [SPRITES.CAR01, SPRITES.CAR02, SPRITES.CAR03, SPRITES.CAR04, SPRITES.SEMI, SPRITES.TRUCK];

const ROAD = {
  LENGTH: { NONE: 0, SHORT: 25, MEDIUM: 50, LONG: 100 },
  HILL: { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60 },
  CURVE: { NONE: 0, EASY: 2, MEDIUM: 4, HARD: 6 },
};

const TRACK_TIMEZONE = 'UTC';

const getTodayTrackKey = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TRACK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

const createSeededRng = (seed: number) => {
  let state = seed >>> 0;
  if (state === 0) state = 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ============================================
// UTILITIES
// ============================================
const Util = {
  toInt: (obj: any, def: number): number => {
    if (obj !== null) {
      const x = parseInt(obj, 10);
      if (!isNaN(x)) return x;
    }
    return Util.toInt(def, 0);
  },
  toFloat: (obj: any, def: number): number => {
    if (obj !== null) {
      const x = parseFloat(obj);
      if (!isNaN(x)) return x;
    }
    return Util.toFloat(def, 0.0);
  },
  limit: (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(value, max));
  },
  randomInt: (min: number, max: number): number => {
    return Math.round(Util.interpolate(min, max, Math.random()));
  },
  randomChoice: <T,>(options: T[]): T => {
    return options[Util.randomInt(0, options.length - 1)];
  },
  percentRemaining: (n: number, total: number): number => {
    return (n % total) / total;
  },
  accelerate: (v: number, accel: number, dt: number): number => {
    return v + accel * dt;
  },
  interpolate: (a: number, b: number, percent: number): number => {
    return a + (b - a) * percent;
  },
  easeIn: (a: number, b: number, percent: number): number => {
    return a + (b - a) * Math.pow(percent, 2);
  },
  easeInOut: (a: number, b: number, percent: number): number => {
    return a + (b - a) * ((-Math.cos(percent * Math.PI) / 2) + 0.5);
  },
  exponentialFog: (distance: number, density: number): number => {
    return 1 / Math.pow(Math.E, distance * distance * density);
  },
  increase: (start: number, increment: number, max: number): number => {
    let result = start + increment;
    while (result >= max) result -= max;
    while (result < 0) result += max;
    return result;
  },
  project: (
    p: any,
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    cameraDepth: number,
    width: number,
    height: number,
    roadWidth: number
  ) => {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    p.camera.z = (p.world.z || 0) - cameraZ;
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round(width / 2 + (p.screen.scale * p.camera.x * width) / 2);
    p.screen.y = Math.round(height / 2 - (p.screen.scale * p.camera.y * height) / 2);
    p.screen.w = Math.round((p.screen.scale * roadWidth * width) / 2);
  },
  overlap: (x1: number, w1: number, x2: number, w2: number, percent?: number): boolean => {
    const half = (percent || 1) / 2;
    const min1 = x1 - w1 * half;
    const max1 = x1 + w1 * half;
    const min2 = x2 - w2 * half;
    const max2 = x2 + w2 * half;
    return !(max1 < min2 || min1 > max2);
  },
};

// ============================================
// RENDER UTILITIES
// ============================================
const Render = {
  polygon: (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number,
    color: string
  ) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  },
  segment: (
    ctx: CanvasRenderingContext2D,
    width: number,
    lanes: number,
    x1: number,
    y1: number,
    w1: number,
    x2: number,
    y2: number,
    w2: number,
    fog: number,
    color: any
  ) => {
    const r1 = Render.rumbleWidth(w1, lanes);
    const r2 = Render.rumbleWidth(w2, lanes);
    const l1 = Render.laneMarkerWidth(w1, lanes);
    const l2 = Render.laneMarkerWidth(w2, lanes);

    ctx.fillStyle = color.grass;
    ctx.fillRect(0, y2, width, y1 - y2);

    Render.polygon(ctx, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, color.rumble);
    Render.polygon(ctx, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, color.rumble);
    Render.polygon(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, color.road);

    if (color.lane) {
      let lanew1 = (w1 * 2) / lanes;
      let lanew2 = (w2 * 2) / lanes;
      let lanex1 = x1 - w1 + lanew1;
      let lanex2 = x2 - w2 + lanew2;
      for (let lane = 1; lane < lanes; lanex1 += lanew1, lanex2 += lanew2, lane++) {
        Render.polygon(ctx, lanex1 - l1 / 2, y1, lanex1 + l1 / 2, y1, lanex2 + l2 / 2, y2, lanex2 - l2 / 2, y2, color.lane);
      }
    }

    Render.fog(ctx, 0, y1, width, y2 - y1, fog);
  },
  background: (
    ctx: CanvasRenderingContext2D,
    background: HTMLImageElement,
    width: number,
    height: number,
    layer: any,
    rotation: number,
    offset: number
  ) => {
    rotation = rotation || 0;
    offset = offset || 0;

    const imageW = layer.w / 2;
    const imageH = layer.h;

    const sourceX = layer.x + Math.floor(layer.w * rotation);
    const sourceY = layer.y;
    const sourceW = Math.min(imageW, layer.x + layer.w - sourceX);
    const sourceH = imageH;

    const destX = 0;
    const destY = offset;
    const destW = Math.floor(width * (sourceW / imageW));
    const destH = height;

    ctx.drawImage(background, sourceX, sourceY, sourceW, sourceH, destX, destY, destW, destH);
    if (sourceW < imageW) {
      ctx.drawImage(background, layer.x, sourceY, imageW - sourceW, sourceH, destW - 1, destY, width - destW, destH);
    }
  },
  sprite: (
    ctx: CanvasRenderingContext2D,
    width: number,
    _height: number,
    _resolution: number,
    roadWidth: number,
    sprites: HTMLImageElement,
    sprite: any,
    scale: number,
    destX: number,
    destY: number,
    offsetX: number,
    offsetY: number,
    clipY?: number
  ) => {
    const destW = (sprite.w * scale * width) / 2 * (SPRITES.SCALE * roadWidth);
    const destH = (sprite.h * scale * width) / 2 * (SPRITES.SCALE * roadWidth);

    destX = destX + destW * (offsetX || 0);
    destY = destY + destH * (offsetY || 0);

    const clipH = clipY ? Math.max(0, destY + destH - clipY) : 0;
    if (clipH < destH) {
      ctx.drawImage(
        sprites,
        sprite.x,
        sprite.y,
        sprite.w,
        sprite.h - (sprite.h * clipH) / destH,
        destX,
        destY,
        destW,
        destH - clipH
      );
    }
  },
  player: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    resolution: number,
    roadWidth: number,
    sprites: HTMLImageElement,
    speedPercent: number,
    scale: number,
    destX: number,
    destY: number,
    steer: number,
    updown: number
  ) => {
    const bounce = Math.sin(Date.now() / 60) * speedPercent * resolution;
    let sprite;
    if (steer < 0) {
      sprite = updown > 0 ? SPRITES.PLAYER_UPHILL_LEFT : SPRITES.PLAYER_LEFT;
    } else if (steer > 0) {
      sprite = updown > 0 ? SPRITES.PLAYER_UPHILL_RIGHT : SPRITES.PLAYER_RIGHT;
    } else {
      sprite = updown > 0 ? SPRITES.PLAYER_UPHILL_STRAIGHT : SPRITES.PLAYER_STRAIGHT;
    }

    Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY + bounce, -0.5, -1);
  },
  fog: (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, fog: number) => {
    if (fog < 1) {
      ctx.globalAlpha = 1 - fog;
      ctx.fillStyle = COLORS.FOG;
      ctx.fillRect(x, y, width, height);
      ctx.globalAlpha = 1;
    }
  },
  rumbleWidth: (projectedRoadWidth: number, lanes: number): number => {
    return projectedRoadWidth / Math.max(6, 2 * lanes);
  },
  laneMarkerWidth: (projectedRoadWidth: number, lanes: number): number => {
    return projectedRoadWidth / Math.max(32, 8 * lanes);
  },
};

// ============================================
// TYPES
// ============================================
interface Segment {
  index: number;
  p1: {
    world: { y: number; z: number };
    camera: { x?: number; y?: number; z?: number };
    screen: { x?: number; y?: number; w?: number; scale?: number };
  };
  p2: {
    world: { y: number; z: number };
    camera: { x?: number; y?: number; z?: number };
    screen: { x?: number; y?: number; w?: number; scale?: number };
  };
  curve: number;
  sprites: Array<{ source: any; offset: number }>;
  cars: Car[];
  color: any;
  looped?: boolean;
  fog?: number;
  clip?: number;
}

interface Car {
  offset: number;
  z: number;
  sprite: any;
  speed: number;
  percent?: number;
}

// ============================================
// COMPONENT
// ============================================
export default function Racer() {
  const hideGameLeaderboards = useHideGameLeaderboards();
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const { user, refreshUser } = useAuth();
  const [score, setScore] = useState(0); // Lap time in seconds (lower is better)
  const [dailyBestLapTimeMs, setDailyBestLapTimeMs] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewDailyBest, setIsNewDailyBest] = useState(false);
  const [rewardSummary, setRewardSummary] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<DailyRacerLeaderboardEntry[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [currentLapTime, setCurrentLapTime] = useState(0);
  const [trackDateLabel, setTrackDateLabel] = useState(getTodayTrackKey());
  const [dailyRunCount, setDailyRunCount] = useState(0);

  // Game state refs
  const segmentsRef = useRef<Segment[]>([]);
  const carsRef = useRef<Car[]>([]);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const spritesRef = useRef<HTMLImageElement | null>(null);
  const resolutionRef = useRef<number>(1);
  const trackLengthRef = useRef<number>(0);
  const playerXRef = useRef<number>(0);
  const playerZRef = useRef<number>(0);
  const positionRef = useRef<number>(0);
  const speedRef = useRef<number>(0);
  const maxSpeedRef = useRef<number>(SEGMENT_LENGTH / STEP);
  const accelRef = useRef<number>(0);
  const breakingRef = useRef<number>(0);
  const decelRef = useRef<number>(0);
  const offRoadDecelRef = useRef<number>(0);
  const offRoadLimitRef = useRef<number>(0);
  const cameraDepthRef = useRef<number>(0);
  const skyOffsetRef = useRef<number>(0);
  const hillOffsetRef = useRef<number>(0);
  const treeOffsetRef = useRef<number>(0);
  const currentLapTimeRef = useRef<number>(0);
  const lastLapTimeRef = useRef<number | null>(null);
  const fastestLapTimeRef = useRef<number>(180);
  const dailySeedRef = useRef<number>(1);
  const keyLeftRef = useRef<boolean>(false);
  const keyRightRef = useRef<boolean>(false);
  const keyFasterRef = useRef<boolean>(false);
  const keySlowerRef = useRef<boolean>(false);
  const gameRunningRef = useRef<boolean>(false);
  const hasCrossedStartLineRef = useRef<boolean>(false);

  // Initialize game constants
  useEffect(() => {
    maxSpeedRef.current = SEGMENT_LENGTH / STEP;
    accelRef.current = maxSpeedRef.current / 5;
    breakingRef.current = -maxSpeedRef.current;
    decelRef.current = -maxSpeedRef.current / 5;
    offRoadDecelRef.current = -maxSpeedRef.current / 2;
    offRoadLimitRef.current = maxSpeedRef.current / 4;
    cameraDepthRef.current = 1 / Math.tan((FIELD_OF_VIEW / 2) * (Math.PI / 180));
    playerZRef.current = CAMERA_HEIGHT * cameraDepthRef.current;
    resolutionRef.current = HEIGHT / 480;

  }, []);

  // Load images
  useEffect(() => {
    const background = new Image();
    const sprites = new Image();
    let loaded = 0;

    const onLoad = () => {
      loaded++;
      if (loaded === 2) {
        backgroundRef.current = background;
        spritesRef.current = sprites;
        setImagesLoaded(true);
      }
    };

    background.src = '/images/racer/background.png';
    sprites.src = '/images/racer/sprites.png';
    background.onload = onLoad;
    sprites.onload = onLoad;
    background.onerror = () => console.error('Failed to load background');
    sprites.onerror = () => console.error('Failed to load sprites');
  }, []);

  // Fetch daily track state and leaderboard
  useEffect(() => {
    if (user) {
      fetchDailyRacerState();
    }
  }, [user]);

  const fetchDailyRacerState = useCallback(async () => {
    try {
      const response = await gamesApi.getDailyRacerState(20);
      setLeaderboard(response.data.leaderboard);
      setDailyBestLapTimeMs(response.data.userBestLapTimeMs);
      setDailyRunCount(response.data.userRunCount);
      dailySeedRef.current = response.data.seed || 1;
      const trackDate = new Date(response.data.trackDate);
      if (!Number.isNaN(trackDate.getTime())) {
        setTrackDateLabel(
          new Intl.DateTimeFormat('en-CA', {
            timeZone: TRACK_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(trackDate)
        );
      }
      if (response.data.userBestLapTimeMs && response.data.userBestLapTimeMs > 0) {
        fastestLapTimeRef.current = response.data.userBestLapTimeMs / 1000;
      }
    } catch (error) {
      console.error('Failed to fetch daily racer state:', error);
    }
  }, []);

  // Road building functions
  const lastY = useCallback((): number => {
    return segmentsRef.current.length === 0 ? 0 : segmentsRef.current[segmentsRef.current.length - 1].p2.world.y;
  }, []);

  const addSegment = useCallback((curve: number, y: number) => {
    const n = segmentsRef.current.length;
    segmentsRef.current.push({
      index: n,
      p1: { world: { y: lastY(), z: n * SEGMENT_LENGTH }, camera: {}, screen: {} },
      p2: { world: { y, z: (n + 1) * SEGMENT_LENGTH }, camera: {}, screen: {} },
      curve,
      sprites: [],
      cars: [],
      color: Math.floor(n / RUMBLE_LENGTH) % 2 ? COLORS.DARK : COLORS.LIGHT,
    });
  }, [lastY]);

  const addSprite = useCallback((n: number, sprite: any, offset: number) => {
    if (segmentsRef.current[n]) {
      segmentsRef.current[n].sprites.push({ source: sprite, offset });
    }
  }, []);

  const addRoad = useCallback(
    (enter: number, hold: number, leave: number, curve: number, y: number) => {
      const startY = lastY();
      const endY = startY + Util.toInt(y, 0) * SEGMENT_LENGTH;
      const total = enter + hold + leave;
      for (let n = 0; n < enter; n++) {
        addSegment(Util.easeIn(0, curve, n / enter), Util.easeInOut(startY, endY, n / total));
      }
      for (let n = 0; n < hold; n++) {
        addSegment(curve, Util.easeInOut(startY, endY, (enter + n) / total));
      }
      for (let n = 0; n < leave; n++) {
        addSegment(Util.easeInOut(curve, 0, n / leave), Util.easeInOut(startY, endY, (enter + hold + n) / total));
      }
    },
    [lastY, addSegment]
  );

  const addStraight = useCallback(
    (num?: number) => {
      num = num || ROAD.LENGTH.MEDIUM;
      addRoad(num, num, num, 0, 0);
    },
    [addRoad]
  );

  const addHill = useCallback(
    (num?: number, height?: number) => {
      num = num || ROAD.LENGTH.MEDIUM;
      height = height || ROAD.HILL.MEDIUM;
      addRoad(num, num, num, 0, height);
    },
    [addRoad]
  );

  const addCurve = useCallback(
    (num?: number, curve?: number, height?: number) => {
      num = num || ROAD.LENGTH.MEDIUM;
      curve = curve || ROAD.CURVE.MEDIUM;
      height = height || ROAD.HILL.NONE;
      addRoad(num, num, num, curve, height);
    },
    [addRoad]
  );

  const addLowRollingHills = useCallback(
    (num?: number, height?: number) => {
      num = num || ROAD.LENGTH.SHORT;
      height = height || ROAD.HILL.LOW;
      addRoad(num, num, num, 0, height / 2);
      addRoad(num, num, num, 0, -height);
      addRoad(num, num, num, ROAD.CURVE.EASY, height);
      addRoad(num, num, num, 0, 0);
      addRoad(num, num, num, -ROAD.CURVE.EASY, height / 2);
      addRoad(num, num, num, 0, 0);
    },
    [addRoad]
  );

  const addSCurves = useCallback(() => {
    addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, -ROAD.CURVE.EASY, ROAD.HILL.NONE);
    addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
    addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.CURVE.EASY, -ROAD.HILL.LOW);
    addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, -ROAD.CURVE.EASY, ROAD.HILL.MEDIUM);
    addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, -ROAD.CURVE.MEDIUM, -ROAD.HILL.MEDIUM);
  }, [addRoad]);

  const addBumps = useCallback(() => {
    addRoad(10, 10, 10, 0, 5);
    addRoad(10, 10, 10, 0, -2);
    addRoad(10, 10, 10, 0, -5);
    addRoad(10, 10, 10, 0, 8);
    addRoad(10, 10, 10, 0, 5);
    addRoad(10, 10, 10, 0, -7);
    addRoad(10, 10, 10, 0, 5);
    addRoad(10, 10, 10, 0, -2);
  }, [addRoad]);

  const addDownhillToEnd = useCallback(
    (num?: number) => {
      num = num || 200;
      addRoad(num, num, num, -ROAD.CURVE.EASY, -lastY() / SEGMENT_LENGTH);
    },
    [addRoad, lastY]
  );

  const findSegment = useCallback((z: number): Segment => {
    return segmentsRef.current[Math.floor(z / SEGMENT_LENGTH) % segmentsRef.current.length];
  }, []);

  const randomChoiceWithRng = useCallback(<T,>(rng: () => number, options: T[]): T => {
    return options[Math.floor(rng() * options.length)];
  }, []);

  const randomIntWithRng = useCallback((rng: () => number, min: number, max: number): number => {
    return Math.floor(rng() * (max - min + 1)) + min;
  }, []);

  const resetSprites = useCallback((rng: () => number) => {
    addSprite(20, SPRITES.BILLBOARD07, -1);
    addSprite(40, SPRITES.BILLBOARD06, -1);
    addSprite(60, SPRITES.BILLBOARD08, -1);
    addSprite(80, SPRITES.BILLBOARD09, -1);
    addSprite(100, SPRITES.BILLBOARD01, -1);
    addSprite(120, SPRITES.BILLBOARD02, -1);
    addSprite(140, SPRITES.BILLBOARD03, -1);
    addSprite(160, SPRITES.BILLBOARD04, -1);
    addSprite(180, SPRITES.BILLBOARD05, -1);

    addSprite(240, SPRITES.BILLBOARD07, -1.2);
    addSprite(240, SPRITES.BILLBOARD06, 1.2);
    addSprite(segmentsRef.current.length - 25, SPRITES.BILLBOARD07, -1.2);
    addSprite(segmentsRef.current.length - 25, SPRITES.BILLBOARD06, 1.2);

    for (let n = 10; n < 200; n += 4 + Math.floor(n / 100)) {
      addSprite(n, SPRITES.PALM_TREE, 0.5 + rng() * 0.5);
      addSprite(n, SPRITES.PALM_TREE, 1 + rng() * 2);
    }

    for (let n = 250; n < 1000; n += 5) {
      addSprite(n, SPRITES.COLUMN, 1.1);
      addSprite(n + randomIntWithRng(rng, 0, 5), SPRITES.TREE1, -1 - rng() * 2);
      addSprite(n + randomIntWithRng(rng, 0, 5), SPRITES.TREE2, -1 - rng() * 2);
    }

    for (let n = 200; n < segmentsRef.current.length; n += 3) {
      addSprite(n, randomChoiceWithRng(rng, PLANTS), randomChoiceWithRng(rng, [1, -1]) * (2 + rng() * 5));
    }

    for (let n = 1000; n < segmentsRef.current.length - 50; n += 100) {
      const side = randomChoiceWithRng(rng, [1, -1]);
      addSprite(n + randomIntWithRng(rng, 0, 50), randomChoiceWithRng(rng, BILLBOARDS), -side);
      for (let i = 0; i < 20; i++) {
        const sprite = randomChoiceWithRng(rng, PLANTS);
        const offset = side * (1.5 + rng());
        addSprite(n + randomIntWithRng(rng, 0, 50), sprite, offset);
      }
    }
  }, [addSprite, randomChoiceWithRng, randomIntWithRng]);

  const resetCars = useCallback((rng: () => number) => {
    carsRef.current = [];
    for (let n = 0; n < TOTAL_CARS; n++) {
      const offset = rng() * randomChoiceWithRng(rng, [-0.8, 0.8]);
      const z = Math.floor(rng() * segmentsRef.current.length) * SEGMENT_LENGTH;
      const sprite = randomChoiceWithRng(rng, CARS);
      const carSpeed = maxSpeedRef.current / 4 + (rng() * maxSpeedRef.current) / (sprite === SPRITES.SEMI ? 4 : 2);
      const car: Car = { offset, z, sprite, speed: carSpeed };
      const segment = findSegment(car.z);
      segment.cars.push(car);
      carsRef.current.push(car);
    }
  }, [findSegment, randomChoiceWithRng]);

  const resetRoad = useCallback(() => {
    segmentsRef.current = [];
    const rng = createSeededRng(dailySeedRef.current);

    addStraight(ROAD.LENGTH.SHORT);
    addLowRollingHills();
    addSCurves();
    addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM, ROAD.HILL.LOW);
    addBumps();
    addLowRollingHills();
    addCurve(ROAD.LENGTH.LONG * 2, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
    addStraight();
    addHill(ROAD.LENGTH.MEDIUM, ROAD.HILL.HIGH);
    addSCurves();
    addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.MEDIUM, ROAD.HILL.NONE);
    addHill(ROAD.LENGTH.LONG, ROAD.HILL.HIGH);
    addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM, -ROAD.HILL.LOW);
    addBumps();
    addHill(ROAD.LENGTH.LONG, -ROAD.HILL.MEDIUM);
    addStraight();
    addSCurves();
    addDownhillToEnd();

    resetSprites(rng);
    resetCars(rng);

    const startSegment = findSegment(playerZRef.current);
    segmentsRef.current[startSegment.index + 2].color = COLORS.START;
    segmentsRef.current[startSegment.index + 3].color = COLORS.START;
    for (let n = 0; n < RUMBLE_LENGTH; n++) {
      segmentsRef.current[segmentsRef.current.length - 1 - n].color = COLORS.FINISH;
    }

    trackLengthRef.current = segmentsRef.current.length * SEGMENT_LENGTH;
  }, [
    addStraight,
    addLowRollingHills,
    addSCurves,
    addCurve,
    addBumps,
    addHill,
    addDownhillToEnd,
    resetSprites,
    resetCars,
    findSegment,
  ]);

  // Initialize game
  const initGame = useCallback(() => {
    if (!imagesLoaded || !backgroundRef.current || !spritesRef.current) return;

    resetRoad();

    positionRef.current = 0;
    speedRef.current = 0;
    playerXRef.current = 0;
    currentLapTimeRef.current = 0;
    lastLapTimeRef.current = null;
    skyOffsetRef.current = 0;
    hillOffsetRef.current = 0;
    treeOffsetRef.current = 0;
    hasCrossedStartLineRef.current = false;
    keyLeftRef.current = false;
    keyRightRef.current = false;
    keyFasterRef.current = false;
    keySlowerRef.current = false;

    setScore(0);
    setCurrentLapTime(0);
    setGameOver(false);
    setStarted(true);
    setRewards(null);
    setIsNewDailyBest(false);
    setRewardSummary(null);
    gameRunningRef.current = true;
    lastTimeRef.current = 0;
  }, [imagesLoaded, resetRoad]);

  // Update cars
  const updateCarOffset = useCallback(
    (car: Car, carSegment: Segment, playerSegment: Segment, playerW: number): number => {
      const lookahead = 20;
      const carW = car.sprite.w * SPRITES.SCALE;

      if (carSegment.index - playerSegment.index > DRAW_DISTANCE) return 0;

      for (let i = 1; i < lookahead; i++) {
        const segment = segmentsRef.current[(carSegment.index + i) % segmentsRef.current.length];

        if (
          segment === playerSegment &&
          car.speed > speedRef.current &&
          Util.overlap(playerXRef.current, playerW, car.offset, carW, 1.2)
        ) {
          let dir;
          if (playerXRef.current > 0.5) dir = -1;
          else if (playerXRef.current < -0.5) dir = 1;
          else dir = car.offset > playerXRef.current ? 1 : -1;
          return (dir * (1 / i) * (car.speed - speedRef.current)) / maxSpeedRef.current;
        }

        for (let j = 0; j < segment.cars.length; j++) {
          const otherCar = segment.cars[j];
          const otherCarW = otherCar.sprite.w * SPRITES.SCALE;
          if (car.speed > otherCar.speed && Util.overlap(car.offset, carW, otherCar.offset, otherCarW, 1.2)) {
            let dir;
            if (otherCar.offset > 0.5) dir = -1;
            else if (otherCar.offset < -0.5) dir = 1;
            else dir = car.offset > otherCar.offset ? 1 : -1;
            return (dir * (1 / i) * (car.speed - otherCar.speed)) / maxSpeedRef.current;
          }
        }
      }

      if (car.offset < -0.9) return 0.1;
      else if (car.offset > 0.9) return -0.1;
      else return 0;
    },
    []
  );

  const updateCars = useCallback(
    (dt: number, playerSegment: Segment, playerW: number) => {
      for (let n = 0; n < carsRef.current.length; n++) {
        const car = carsRef.current[n];
        const oldSegment = findSegment(car.z);
        car.offset = car.offset + updateCarOffset(car, oldSegment, playerSegment, playerW);
        car.z = Util.increase(car.z, dt * car.speed, trackLengthRef.current);
        car.percent = Util.percentRemaining(car.z, SEGMENT_LENGTH);
        const newSegment = findSegment(car.z);
        if (oldSegment !== newSegment) {
          const index = oldSegment.cars.indexOf(car);
          oldSegment.cars.splice(index, 1);
          newSegment.cars.push(car);
        }
      }
    },
    [findSegment, updateCarOffset]
  );

  // Game update
  const update = useCallback(
    (dt: number) => {
      if (!gameRunningRef.current) return;

      const playerSegment = findSegment(positionRef.current + playerZRef.current);
      const playerW = SPRITES.PLAYER_STRAIGHT.w * SPRITES.SCALE;
      const speedPercent = speedRef.current / maxSpeedRef.current;
      const dx = dt * 2 * speedPercent;
      const startPosition = positionRef.current;

      updateCars(dt, playerSegment, playerW);

      positionRef.current = Util.increase(positionRef.current, dt * speedRef.current, trackLengthRef.current);

      if (keyLeftRef.current) {
        playerXRef.current = playerXRef.current - dx;
      } else if (keyRightRef.current) {
        playerXRef.current = playerXRef.current + dx;
      }

      playerXRef.current = playerXRef.current - dx * speedPercent * playerSegment.curve * CENTRIFUGAL;

      if (keyFasterRef.current) {
        speedRef.current = Util.accelerate(speedRef.current, accelRef.current, dt);
      } else if (keySlowerRef.current) {
        speedRef.current = Util.accelerate(speedRef.current, breakingRef.current, dt);
      } else {
        speedRef.current = Util.accelerate(speedRef.current, decelRef.current, dt);
      }

      if (playerXRef.current < -1 || playerXRef.current > 1) {
        if (speedRef.current > offRoadLimitRef.current) {
          speedRef.current = Util.accelerate(speedRef.current, offRoadDecelRef.current, dt);
        }

        for (let n = 0; n < playerSegment.sprites.length; n++) {
          const sprite = playerSegment.sprites[n];
          const spriteW = sprite.source.w * SPRITES.SCALE;
          if (
            Util.overlap(
              playerXRef.current,
              playerW,
              sprite.offset + (spriteW / 2) * (sprite.offset > 0 ? 1 : -1),
              spriteW
            )
          ) {
            speedRef.current = maxSpeedRef.current / 5;
            positionRef.current = Util.increase(
              playerSegment.p1.world.z,
              -playerZRef.current,
              trackLengthRef.current
            );
            break;
          }
        }
      }

      for (let n = 0; n < playerSegment.cars.length; n++) {
        const car = playerSegment.cars[n];
        const carW = car.sprite.w * SPRITES.SCALE;
        if (speedRef.current > car.speed) {
          if (Util.overlap(playerXRef.current, playerW, car.offset, carW, 0.8)) {
            speedRef.current = car.speed * (car.speed / speedRef.current);
            positionRef.current = Util.increase(car.z, -playerZRef.current, trackLengthRef.current);
            break;
          }
        }
      }

      playerXRef.current = Util.limit(playerXRef.current, -3, 3);
      speedRef.current = Util.limit(speedRef.current, 0, maxSpeedRef.current);

      skyOffsetRef.current = Util.increase(
        skyOffsetRef.current,
        (SKY_SPEED * playerSegment.curve * (positionRef.current - startPosition)) / SEGMENT_LENGTH,
        1
      );
      hillOffsetRef.current = Util.increase(
        hillOffsetRef.current,
        (HILL_SPEED * playerSegment.curve * (positionRef.current - startPosition)) / SEGMENT_LENGTH,
        1
      );
      treeOffsetRef.current = Util.increase(
        treeOffsetRef.current,
        (TREE_SPEED * playerSegment.curve * (positionRef.current - startPosition)) / SEGMENT_LENGTH,
        1
      );

      // Lap time tracking
      // Check if we've crossed the start line (position > playerZ means we're past the start)
      const justCrossedStartLine = positionRef.current > playerZRef.current && startPosition <= playerZRef.current;
      
      if (justCrossedStartLine) {
        if (!hasCrossedStartLineRef.current) {
          // First time crossing the start line - start the lap timer
          hasCrossedStartLineRef.current = true;
          currentLapTimeRef.current = 0;
        } else {
          // Second time crossing the start line - completed a lap!
          if (!gameOver && gameRunningRef.current && currentLapTimeRef.current > 0.1) {
            lastLapTimeRef.current = currentLapTimeRef.current;
            const lapTime = lastLapTimeRef.current;

            if (lapTime <= fastestLapTimeRef.current || fastestLapTimeRef.current === 0 || fastestLapTimeRef.current >= 1000) {
              fastestLapTimeRef.current = lapTime;
            }

            // End game after completing one lap
            handleGameOver(lapTime);
          }
          // Reset lap time for next lap (if we continue)
          currentLapTimeRef.current = 0;
        }
      }
      
      // Always increment lap time if we've started the lap
      if (hasCrossedStartLineRef.current) {
        currentLapTimeRef.current += dt;
        setCurrentLapTime(currentLapTimeRef.current);
      }

      setSpeed(Math.round((speedRef.current / 500) * 5));
    },
    [findSegment, updateCars, gameOver]
  );

  // Handle game over
  const handleGameOver = useCallback(
    async (lapTime: number) => {
      gameRunningRef.current = false;
      setGameOver(true);
      setScore(lapTime);

      const lapTimeMs = Math.max(1, Math.round(lapTime * 1000));
      const preciseLapSeconds = lapTimeMs / 1000;
      const roundedLapSeconds = Math.max(1, Math.round(lapTime));

      try {
        const [rewardResponse, dailyResponse] = await Promise.all([
          gamesApi.complete('racer', {
            score: preciseLapSeconds,
            won: true,
            duration: roundedLapSeconds,
          }),
          gamesApi.submitDailyRacerRun(lapTimeMs),
        ]);

        const totalMoneyReward = rewardResponse.data.moneyReward + (dailyResponse.data.rewards?.money ?? 0);
        const totalAuraReward = rewardResponse.data.auraReward + (dailyResponse.data.rewards?.aura ?? 0);
        setRewards({
          aura: totalAuraReward,
          money: totalMoneyReward,
        });
        setIsNewDailyBest(dailyResponse.data.isNewDailyBest);
        setDailyBestLapTimeMs(dailyResponse.data.bestLapTimeMs);
        setDailyRunCount((prev) => prev + 1);
        setRewardSummary(
          [
            rewardResponse.data.moneyReward > 0 || rewardResponse.data.auraReward > 0 ? 'tour complete' : null,
            dailyResponse.data.rewards?.isFirstRunToday ? 'premiere tentative du jour' : null,
            dailyResponse.data.rewards?.isNewDailyBest ? 'meilleur tour perso du jour' : null,
          ]
            .filter(Boolean)
            .join(' + ')
        );

        if (dailyResponse.data.bestLapTimeMs > 0) {
          fastestLapTimeRef.current = dailyResponse.data.bestLapTimeMs / 1000;
        }

        await refreshUser();
        fetchDailyRacerState();
      } catch (error) {
        console.error('Failed to submit score:', error);
      }
    },
    [refreshUser, fetchDailyRacerState]
  );

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const background = backgroundRef.current;
    const sprites = spritesRef.current;

    if (!canvas || !ctx || !background || !sprites || !gameRunningRef.current) return;

    const baseSegment = findSegment(positionRef.current);
    const basePercent = Util.percentRemaining(positionRef.current, SEGMENT_LENGTH);
    const playerSegment = findSegment(positionRef.current + playerZRef.current);
    const playerPercent = Util.percentRemaining(positionRef.current + playerZRef.current, SEGMENT_LENGTH);
    const playerY = Util.interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);
    let maxy = HEIGHT;

    let x = 0;
    let dx = -(baseSegment.curve * basePercent);

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    Render.background(
      ctx,
      background,
      WIDTH,
      HEIGHT,
      BACKGROUND.SKY,
      skyOffsetRef.current,
      resolutionRef.current * SKY_SPEED * playerY
    );
    Render.background(
      ctx,
      background,
      WIDTH,
      HEIGHT,
      BACKGROUND.HILLS,
      hillOffsetRef.current,
      resolutionRef.current * HILL_SPEED * playerY
    );
    Render.background(
      ctx,
      background,
      WIDTH,
      HEIGHT,
      BACKGROUND.TREES,
      treeOffsetRef.current,
      resolutionRef.current * TREE_SPEED * playerY
    );

    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const segment = segmentsRef.current[(baseSegment.index + n) % segmentsRef.current.length];
      segment.looped = segment.index < baseSegment.index;
      segment.fog = Util.exponentialFog(n / DRAW_DISTANCE, FOG_DENSITY);
      segment.clip = maxy;

      Util.project(
        segment.p1,
        playerXRef.current * ROAD_WIDTH - x,
        playerY + CAMERA_HEIGHT,
        positionRef.current - (segment.looped ? trackLengthRef.current : 0),
        cameraDepthRef.current,
        WIDTH,
        HEIGHT,
        ROAD_WIDTH
      );
      Util.project(
        segment.p2,
        playerXRef.current * ROAD_WIDTH - x - dx,
        playerY + CAMERA_HEIGHT,
        positionRef.current - (segment.looped ? trackLengthRef.current : 0),
        cameraDepthRef.current,
        WIDTH,
        HEIGHT,
        ROAD_WIDTH
      );

      x = x + dx;
      dx = dx + segment.curve;

      if (
        (segment.p1.camera.z! <= cameraDepthRef.current) ||
        (segment.p2.screen.y! >= segment.p1.screen.y!) ||
        (segment.p2.screen.y! >= maxy)
      ) {
        continue;
      }

      Render.segment(
        ctx,
        WIDTH,
        LANES,
        segment.p1.screen.x!,
        segment.p1.screen.y!,
        segment.p1.screen.w!,
        segment.p2.screen.x!,
        segment.p2.screen.y!,
        segment.p2.screen.w!,
        segment.fog!,
        segment.color
      );

      maxy = segment.p1.screen.y!;
    }

    for (let n = DRAW_DISTANCE - 1; n > 0; n--) {
      const segment = segmentsRef.current[(baseSegment.index + n) % segmentsRef.current.length];

      for (let i = 0; i < segment.cars.length; i++) {
        const car = segment.cars[i];
        const spriteScale = Util.interpolate(segment.p1.screen.scale!, segment.p2.screen.scale!, car.percent!);
        const spriteX =
          Util.interpolate(segment.p1.screen.x!, segment.p2.screen.x!, car.percent!) +
          spriteScale * car.offset * ROAD_WIDTH * (WIDTH / 2);
        const spriteY = Util.interpolate(segment.p1.screen.y!, segment.p2.screen.y!, car.percent!);
        Render.sprite(
          ctx,
          WIDTH,
          HEIGHT,
          resolutionRef.current,
          ROAD_WIDTH,
          sprites,
          car.sprite,
          spriteScale,
          spriteX,
          spriteY,
          -0.5,
          -1,
          segment.clip
        );
      }

      for (let i = 0; i < segment.sprites.length; i++) {
        const sprite = segment.sprites[i];
        const spriteScale = segment.p1.screen.scale!;
        const spriteX = segment.p1.screen.x! + spriteScale * sprite.offset * ROAD_WIDTH * (WIDTH / 2);
        const spriteY = segment.p1.screen.y!;
        Render.sprite(
          ctx,
          WIDTH,
          HEIGHT,
          resolutionRef.current,
          ROAD_WIDTH,
          sprites,
          sprite.source,
          spriteScale,
          spriteX,
          spriteY,
          sprite.offset < 0 ? -1 : 0,
          -1,
          segment.clip
        );
      }

      if (segment === playerSegment) {
        Render.player(
          ctx,
          WIDTH,
          HEIGHT,
          resolutionRef.current,
          ROAD_WIDTH,
          sprites,
          speedRef.current / maxSpeedRef.current,
          cameraDepthRef.current / playerZRef.current,
          WIDTH / 2,
          HEIGHT / 2 -
            ((cameraDepthRef.current / playerZRef.current) *
              Util.interpolate(playerSegment.p1.camera.y!, playerSegment.p2.camera.y!, playerPercent) *
              HEIGHT) /
              2,
          speedRef.current * (keyLeftRef.current ? -1 : keyRightRef.current ? 1 : 0),
          playerSegment.p2.world.y - playerSegment.p1.world.y
        );
      }
    }
  }, [findSegment, gameOver]);

  // Game loop
  useEffect(() => {
    if (!started || gameOver || !imagesLoaded) return;

    let gdt = 0;
    let last = performance.now();

    const frame = (timestamp: number) => {
      if (!gameRunningRef.current) return;

      const now = timestamp;
      const dt = Math.min(1, (now - last) / 1000);
      gdt = gdt + dt;

      while (gdt > STEP) {
        gdt = gdt - STEP;
        update(STEP);
      }

      render();
      last = now;
      animationRef.current = requestAnimationFrame(frame);
    };

    animationRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [started, gameOver, imagesLoaded, update, render]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && gameOver) {
        e.preventDefault();
        initGame();
        return;
      }
      if (!started || gameOver) return;

      const keyCode = e.keyCode || e.which;
      if (keyCode === KEY.LEFT || keyCode === KEY.Q) {
        keyLeftRef.current = true;
        e.preventDefault();
      }
      if (keyCode === KEY.RIGHT || keyCode === KEY.D) {
        keyRightRef.current = true;
        e.preventDefault();
      }
      if (keyCode === KEY.UP || keyCode === KEY.Z) {
        keyFasterRef.current = true;
        e.preventDefault();
      }
      if (keyCode === KEY.DOWN || keyCode === KEY.S) {
        keySlowerRef.current = true;
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyCode = e.keyCode || e.which;
      if (keyCode === KEY.LEFT || keyCode === KEY.Q) {
        keyLeftRef.current = false;
      }
      if (keyCode === KEY.RIGHT || keyCode === KEY.D) {
        keyRightRef.current = false;
      }
      if (keyCode === KEY.UP || keyCode === KEY.Z) {
        keyFasterRef.current = false;
      }
      if (keyCode === KEY.DOWN || keyCode === KEY.S) {
        keySlowerRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [started, gameOver, initGame]);

  const formatTime = (dt: number): string => {
    const totalMs = Math.max(0, Math.round(dt * 1000));
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const milliseconds = totalMs % 1000;

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const formatMsTime = (lapTimeMs: number): string => {
    return formatTime(lapTimeMs / 1000);
  };

  return (
    <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
      <div className={cn('flex items-center justify-end gap-4', isFullscreen && 'hidden')}>
        <div className="text-right text-sm text-muted-foreground tabular-nums">
          <div className="text-2xl font-light text-foreground">{speed} mph</div>
          <div>Temps: {formatTime(currentLapTime)}</div>
          <div>Piste du jour (temps universel) : {trackDateLabel}</div>
          <div>Meilleur du jour: {dailyBestLapTimeMs ? formatMsTime(dailyBestLapTimeMs) : '--'}</div>
          <div>Tentatives du jour: {dailyRunCount}</div>
        </div>
      </div>

      <div className={cn('flex flex-col items-center gap-6 2xl:flex-row 2xl:items-start', isFullscreen && 'min-h-screen')}>
        <div
          ref={gameContainerRef}
          className={cn('flex flex-col gap-3', isFullscreen && 'min-h-screen w-screen items-center bg-background px-4 py-4')}
        >
          <div className="flex w-full max-w-[1024px] items-center justify-between gap-2">
            <GameFullscreenToolbar
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              className="w-auto"
            />
            {imagesLoaded && (
              <Button
                variant="ghost"
                onClick={initGame}
                className="flex items-center gap-2 border border-border/60 px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Rejouer
              </Button>
            )}
          </div>

          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={WIDTH} baseHeight={HEIGHT}>
            <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="h-full w-full rounded-lg border border-border/30" />

            {!started && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/90">
                {!imagesLoaded ? (
                  <div className="text-center">
                    <div className="text-lg mb-2">Chargement...</div>
                  </div>
                ) : (
                  <Button variant="ghost"
                    onClick={initGame}
                    className="flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Jouer
                  </Button>
                )}
              </div>
            )}

            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/90">
                <div className="text-center space-y-6">
                  <div>
                    <h2 className="text-2xl font-light mb-2">Tour termine</h2>
                    <p className="text-3xl tabular-nums">{formatTime(score)}</p>
                  </div>

                  {isNewDailyBest && <p className="text-sm text-foreground">Nouveau record du jour !</p>}

                  {rewardSummary && <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{rewardSummary}</p>}

                  {rewards && (rewards.money > 0 || rewards.aura > 0) && (
                    <p className="text-sm text-muted-foreground">
                      {rewards.money > 0 && `+$${rewards.money}`}
                      {rewards.money > 0 && rewards.aura > 0 && ' - '}
                      {rewards.aura > 0 && `+${rewards.aura} aura`}
                    </p>
                  )}

                  <Button variant="ghost"
                    onClick={initGame}
                    className="mx-auto flex items-center gap-2 px-6 py-3 border border-foreground text-foreground transition-colors hover:bg-foreground hover:text-background"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Rejouer
                  </Button>
                </div>
              </div>
            )}
          </GameFullscreenStage>
        </div>

        {!hideGameLeaderboards && (
        <div
          className={cn(
            'w-full max-w-[1024px] border border-border/30 rounded-lg bg-card overflow-hidden shadow-sm 2xl:w-80 2xl:max-w-none',
            isFullscreen && 'hidden'
          )}
        >
          <div className="p-4 border-b border-border/30 bg-muted/30">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h3 className="text-base font-semibold">Classement quotidien</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-b border-border/20 px-4 py-3">
            <div className="rounded-md bg-muted/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Record perso</p>
              <p className="text-sm font-medium tabular-nums">
                {dailyBestLapTimeMs ? formatMsTime(dailyBestLapTimeMs) : '--'}
              </p>
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Record du jeu</p>
              <p className="text-sm font-medium tabular-nums">
                {leaderboard[0]?.bestLapTimeMs ? formatMsTime(leaderboard[0].bestLapTimeMs) : '--'}
              </p>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto 2xl:max-h-[708px]">
            {leaderboard.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Aucun temps enregistre aujourd'hui</div>
            ) : (
              <div className="divide-y divide-border/20">
                {leaderboard.map((entry, index) => (
                  <div
                    key={`${entry.userId}-${entry.bestLapTimeMs}`}
                    className={`flex items-center gap-3 px-4 py-3 ${entry.userId === user?.id ? 'bg-primary/10' : ''}`}
                  >
                    <span
                      className={`w-7 text-center font-mono text-base ${
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
                    <span className="flex-1 truncate text-base">{entry.username}</span>
                    <span className="font-mono text-base tabular-nums text-muted-foreground">
                      {formatMsTime(entry.bestLapTimeMs)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      <div className={cn('flex justify-center gap-8 text-xs text-muted-foreground', isFullscreen && 'hidden')}>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded">Left</kbd>
          <span>Gauche</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded">Right</kbd>
          <span>Droite</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded">Up</kbd>
          <span>Accel</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 border border-border/50 rounded">Down</kbd>
          <span>Freiner</span>
        </div>
        <div className="flex items-center gap-2">
          <span>ou</span>
          <kbd className="px-2 py-1 border border-border/50 rounded">zqsd</kbd>
        </div>
      </div>
    </div>
  );
}
