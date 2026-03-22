import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RotateCcw, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';

const CANVAS_SIZE = 420;
const CENTER = CANVAS_SIZE / 2;
const TARGET_RADIUS = 78;
const KNIFE_TOTAL_LENGTH = 92;
const KNIFE_BLADE_LENGTH = 64;
const IMPACT_ANGLE = Math.PI / 2;
const COLLISION_GAP = 0.17;
const THROW_START_Y = CANVAS_SIZE - 46;
const THROW_SPEED = 1.42;
const MIN_SPAWN_GAP = 0.48;
const HUD_PILL_RADIUS = 18;

type KnifeFlightState = 'ready' | 'flying';
type FeintPattern = 'none' | 'pulse' | 'snap' | 'stutter' | 'chaos';
type KnifeProfile = 'spike' | 'toothpick' | 'pen' | 'screwdriver' | 'wand';
type LogProfile = 'donut' | 'lifebuoy' | 'vinyl' | 'planet' | 'cassette';

interface KnifeOnTarget {
  offset: number;
}

interface ActiveKnife {
  state: KnifeFlightState;
  y: number;
}

interface WorldPalette {
  name: string;
  bgA: string;
  bgB: string;
  ring: string;
  core: string;
  knife: string;
  knifeHandle: string;
  accent: string;
  danger: string;
  text: string;
  subtext: string;
  track: string;
  glow: string;
  barkA: string;
  barkB: string;
  barkLine: string;
  skyGlow: string;
}

interface KnifeSkin {
  name: string;
  profile: KnifeProfile;
  blade: string;
  edge: string;
  handle: string;
  pommel: string;
  guard: string;
  detail: string;
}

interface LogSkin {
  name: string;
  profile: LogProfile;
  rim: string;
  core: string;
  barkA: string;
  barkB: string;
  rings: string;
  crack: string;
  sprinkle?: string;
}

const WORLD_PALETTES: WorldPalette[] = [
  {
    name: 'Nuit polaire',
    bgA: '#0f172a',
    bgB: '#1a2e4a',
    ring: '#cbd5e1',
    core: '#1e293b',
    knife: '#e2e8f0',
    knifeHandle: '#0f172a',
    accent: '#94a3b8',
    danger: '#fb7185',
    text: '#f8fafc',
    subtext: 'rgba(248,250,252,0.55)',
    track: 'rgba(255,255,255,0.08)',
    glow: 'rgba(148,163,184,0.3)',
    barkA: '#475569',
    barkB: '#1e293b',
    barkLine: 'rgba(226,232,240,0.16)',
    skyGlow: 'rgba(148,163,184,0.18)',
  },
  {
    name: 'Lave neon',
    bgA: '#2b0a0a',
    bgB: '#7c2d12',
    ring: '#fdba74',
    core: '#431407',
    knife: '#ffedd5',
    knifeHandle: '#3b0a00',
    accent: '#fb7185',
    danger: '#fef08a',
    text: '#fff7ed',
    subtext: 'rgba(255,247,237,0.6)',
    track: 'rgba(255,237,213,0.12)',
    glow: 'rgba(251,113,133,0.28)',
    barkA: '#7c2d12',
    barkB: '#431407',
    barkLine: 'rgba(255,237,213,0.15)',
    skyGlow: 'rgba(251,146,60,0.2)',
  },
  {
    name: 'Jungle toxique',
    bgA: '#052e16',
    bgB: '#14532d',
    ring: '#86efac',
    core: '#166534',
    knife: '#ecfccb',
    knifeHandle: '#1a2e05',
    accent: '#bef264',
    danger: '#facc15',
    text: '#f7fee7',
    subtext: 'rgba(247,254,231,0.62)',
    track: 'rgba(190,242,100,0.12)',
    glow: 'rgba(190,242,100,0.25)',
    barkA: '#3f6212',
    barkB: '#1a2e05',
    barkLine: 'rgba(236,252,203,0.14)',
    skyGlow: 'rgba(134,239,172,0.18)',
  },
  {
    name: 'Cyber ocean',
    bgA: '#082f49',
    bgB: '#0f766e',
    ring: '#67e8f9',
    core: '#164e63',
    knife: '#ecfeff',
    knifeHandle: '#083344',
    accent: '#22d3ee',
    danger: '#a5f3fc',
    text: '#ecfeff',
    subtext: 'rgba(236,254,255,0.62)',
    track: 'rgba(103,232,249,0.12)',
    glow: 'rgba(34,211,238,0.28)',
    barkA: '#155e75',
    barkB: '#083344',
    barkLine: 'rgba(236,254,255,0.16)',
    skyGlow: 'rgba(103,232,249,0.18)',
  },
  {
    name: 'Crépuscule royal',
    bgA: '#3b0764',
    bgB: '#581c87',
    ring: '#e9d5ff',
    core: '#4c1d95',
    knife: '#faf5ff',
    knifeHandle: '#2e1065',
    accent: '#c084fc',
    danger: '#f9a8d4',
    text: '#faf5ff',
    subtext: 'rgba(250,245,255,0.62)',
    track: 'rgba(233,213,255,0.12)',
    glow: 'rgba(192,132,252,0.24)',
    barkA: '#6b21a8',
    barkB: '#2e1065',
    barkLine: 'rgba(250,245,255,0.14)',
    skyGlow: 'rgba(233,213,255,0.18)',
  },
  {
    name: 'Aurore sucree',
    bgA: '#4c0519',
    bgB: '#9d174d',
    ring: '#fbcfe8',
    core: '#831843',
    knife: '#fff1f2',
    knifeHandle: '#500724',
    accent: '#f9a8d4',
    danger: '#fda4af',
    text: '#fff1f2',
    subtext: 'rgba(255,241,242,0.62)',
    track: 'rgba(251,207,232,0.12)',
    glow: 'rgba(249,168,212,0.26)',
    barkA: '#db2777',
    barkB: '#831843',
    barkLine: 'rgba(255,241,242,0.16)',
    skyGlow: 'rgba(253,164,175,0.18)',
  },
  {
    name: 'Temple solaire',
    bgA: '#422006',
    bgB: '#a16207',
    ring: '#fde68a',
    core: '#713f12',
    knife: '#fffbeb',
    knifeHandle: '#3f2a05',
    accent: '#facc15',
    danger: '#fb7185',
    text: '#fffbeb',
    subtext: 'rgba(255,251,235,0.62)',
    track: 'rgba(250,204,21,0.12)',
    glow: 'rgba(253,224,71,0.22)',
    barkA: '#ca8a04',
    barkB: '#713f12',
    barkLine: 'rgba(255,251,235,0.16)',
    skyGlow: 'rgba(254,240,138,0.2)',
  },
  {
    name: 'Brume alpine',
    bgA: '#0f172a',
    bgB: '#334155',
    ring: '#dbeafe',
    core: '#1e293b',
    knife: '#f8fafc',
    knifeHandle: '#1f2937',
    accent: '#93c5fd',
    danger: '#c084fc',
    text: '#f8fafc',
    subtext: 'rgba(248,250,252,0.62)',
    track: 'rgba(219,234,254,0.12)',
    glow: 'rgba(147,197,253,0.24)',
    barkA: '#64748b',
    barkB: '#1e293b',
    barkLine: 'rgba(248,250,252,0.14)',
    skyGlow: 'rgba(191,219,254,0.16)',
  },
  {
    name: 'Desert mirage',
    bgA: '#451a03',
    bgB: '#c2410c',
    ring: '#fed7aa',
    core: '#7c2d12',
    knife: '#fff7ed',
    knifeHandle: '#431407',
    accent: '#fb923c',
    danger: '#fdba74',
    text: '#fff7ed',
    subtext: 'rgba(255,247,237,0.62)',
    track: 'rgba(254,215,170,0.12)',
    glow: 'rgba(251,146,60,0.24)',
    barkA: '#ea580c',
    barkB: '#7c2d12',
    barkLine: 'rgba(255,247,237,0.16)',
    skyGlow: 'rgba(254,215,170,0.18)',
  },
  {
    name: 'Paradis corail',
    bgA: '#083344',
    bgB: '#0f766e',
    ring: '#99f6e4',
    core: '#115e59',
    knife: '#f0fdfa',
    knifeHandle: '#134e4a',
    accent: '#5eead4',
    danger: '#fda4af',
    text: '#f0fdfa',
    subtext: 'rgba(240,253,250,0.62)',
    track: 'rgba(153,246,228,0.12)',
    glow: 'rgba(94,234,212,0.24)',
    barkA: '#14b8a6',
    barkB: '#115e59',
    barkLine: 'rgba(240,253,250,0.16)',
    skyGlow: 'rgba(153,246,228,0.18)',
  },
  {
    name: 'Musee neon',
    bgA: '#111827',
    bgB: '#312e81',
    ring: '#c7d2fe',
    core: '#1f1b4b',
    knife: '#eef2ff',
    knifeHandle: '#111827',
    accent: '#818cf8',
    danger: '#22d3ee',
    text: '#eef2ff',
    subtext: 'rgba(238,242,255,0.62)',
    track: 'rgba(199,210,254,0.12)',
    glow: 'rgba(129,140,248,0.24)',
    barkA: '#4338ca',
    barkB: '#1f1b4b',
    barkLine: 'rgba(238,242,255,0.16)',
    skyGlow: 'rgba(165,180,252,0.18)',
  },
  {
    name: 'Foret lunaire',
    bgA: '#0a1f1a',
    bgB: '#1f4d3a',
    ring: '#bbf7d0',
    core: '#14532d',
    knife: '#f7fee7',
    knifeHandle: '#0f2b1e',
    accent: '#4ade80',
    danger: '#a7f3d0',
    text: '#f7fee7',
    subtext: 'rgba(247,254,231,0.62)',
    track: 'rgba(187,247,208,0.12)',
    glow: 'rgba(74,222,128,0.24)',
    barkA: '#15803d',
    barkB: '#14532d',
    barkLine: 'rgba(247,254,231,0.16)',
    skyGlow: 'rgba(134,239,172,0.18)',
  },
];

const KNIFE_SKINS: KnifeSkin[] = [
  { name: 'Pic glacier', profile: 'spike', blade: '#e0f2fe', edge: '#f8fafc', handle: '#475569', pommel: '#94a3b8', guard: '#cbd5e1', detail: '#f8fafc' },
  { name: 'Cure-dent', profile: 'toothpick', blade: '#fde68a', edge: '#fef3c7', handle: '#d97706', pommel: '#b45309', guard: '#f59e0b', detail: '#92400e' },
  { name: 'Stylo comète', profile: 'pen', blade: '#e0f2fe', edge: '#38bdf8', handle: '#1d4ed8', pommel: '#f8fafc', guard: '#0ea5e9', detail: '#ef4444' },
  { name: 'Tournevis turbo', profile: 'screwdriver', blade: '#d1d5db', edge: '#f8fafc', handle: '#dc2626', pommel: '#7f1d1d', guard: '#f87171', detail: '#111827' },
  { name: 'Baguette astrale', profile: 'wand', blade: '#f5d0fe', edge: '#faf5ff', handle: '#6b21a8', pommel: '#fde68a', guard: '#e879f9', detail: '#f9a8d4' },
  { name: 'Epine magma', profile: 'spike', blade: '#fb923c', edge: '#ffedd5', handle: '#7c2d12', pommel: '#f97316', guard: '#fdba74', detail: '#fff7ed' },
  { name: 'Mikado menthe', profile: 'toothpick', blade: '#bbf7d0', edge: '#f0fdf4', handle: '#16a34a', pommel: '#166534', guard: '#4ade80', detail: '#14532d' },
  { name: 'Stylo eclipse', profile: 'pen', blade: '#c7d2fe', edge: '#eef2ff', handle: '#312e81', pommel: '#f8fafc', guard: '#818cf8', detail: '#38bdf8' },
  { name: 'Clef garage', profile: 'screwdriver', blade: '#9ca3af', edge: '#f9fafb', handle: '#f59e0b', pommel: '#78350f', guard: '#fcd34d', detail: '#1f2937' },
  { name: 'Sceptre iris', profile: 'wand', blade: '#ddd6fe', edge: '#faf5ff', handle: '#7c3aed', pommel: '#fef08a', guard: '#a78bfa', detail: '#e879f9' },
  { name: 'Aiguille perlee', profile: 'spike', blade: '#fce7f3', edge: '#ffffff', handle: '#9d174d', pommel: '#f9a8d4', guard: '#fbcfe8', detail: '#fff1f2' },
  { name: 'Mikado abyssal', profile: 'toothpick', blade: '#93c5fd', edge: '#eff6ff', handle: '#1d4ed8', pommel: '#1e3a8a', guard: '#60a5fa', detail: '#0f172a' },
  { name: 'Stylo arcade', profile: 'pen', blade: '#fef08a', edge: '#fefce8', handle: '#db2777', pommel: '#ffffff', guard: '#f472b6', detail: '#22d3ee' },
  { name: 'Tournevis zenith', profile: 'screwdriver', blade: '#dbeafe', edge: '#ffffff', handle: '#0f766e', pommel: '#134e4a', guard: '#5eead4', detail: '#0f172a' },
  { name: 'Baguette opera', profile: 'wand', blade: '#fde68a', edge: '#fffbeb', handle: '#7c2d12', pommel: '#fca5a5', guard: '#fb7185', detail: '#fff7ed' },
];

const LOG_SKINS: LogSkin[] = [
  { name: 'Donut rose', profile: 'donut', rim: '#f472b6', core: '#f59e0b', barkA: '#fbbf24', barkB: '#92400e', rings: 'rgba(255,255,255,0.35)', crack: 'rgba(251,191,36,0.34)', sprinkle: '#34d399' },
  { name: 'Bouée pop', profile: 'lifebuoy', rim: '#ef4444', core: '#f8fafc', barkA: '#fb7185', barkB: '#fee2e2', rings: 'rgba(255,255,255,0.9)', crack: 'rgba(239,68,68,0.3)', sprinkle: '#fb7185' },
  { name: 'Vinyle neon', profile: 'vinyl', rim: '#111827', core: '#1f2937', barkA: '#111827', barkB: '#374151', rings: 'rgba(148,163,184,0.3)', crack: 'rgba(244,114,182,0.4)', sprinkle: '#22d3ee' },
  { name: 'Planète gel', profile: 'planet', rim: '#67e8f9', core: '#1d4ed8', barkA: '#38bdf8', barkB: '#1e3a8a', rings: 'rgba(236,254,255,0.35)', crack: 'rgba(125,211,252,0.34)', sprinkle: '#fde68a' },
  { name: 'Cassette retro', profile: 'cassette', rim: '#eab308', core: '#0f172a', barkA: '#1e293b', barkB: '#334155', rings: 'rgba(226,232,240,0.3)', crack: 'rgba(250,204,21,0.38)', sprinkle: '#f8fafc' },
  { name: 'Donut menthe', profile: 'donut', rim: '#34d399', core: '#fef3c7', barkA: '#6ee7b7', barkB: '#047857', rings: 'rgba(255,255,255,0.34)', crack: 'rgba(16,185,129,0.34)', sprinkle: '#f472b6' },
  { name: 'Bouee pastel', profile: 'lifebuoy', rim: '#fb7185', core: '#fff7ed', barkA: '#fdba74', barkB: '#fed7aa', rings: 'rgba(255,255,255,0.9)', crack: 'rgba(251,113,133,0.28)', sprinkle: '#38bdf8' },
  { name: 'Vinyle orage', profile: 'vinyl', rim: '#020617', core: '#111827', barkA: '#111827', barkB: '#1e293b', rings: 'rgba(148,163,184,0.26)', crack: 'rgba(96,165,250,0.42)', sprinkle: '#f59e0b' },
  { name: 'Planete corail', profile: 'planet', rim: '#fca5a5', core: '#fb7185', barkA: '#fdba74', barkB: '#9a3412', rings: 'rgba(255,245,245,0.34)', crack: 'rgba(255,255,255,0.24)', sprinkle: '#fde68a' },
  { name: 'Cassette chrome', profile: 'cassette', rim: '#94a3b8', core: '#0f172a', barkA: '#334155', barkB: '#64748b', rings: 'rgba(226,232,240,0.44)', crack: 'rgba(148,163,184,0.34)', sprinkle: '#e2e8f0' },
  { name: 'Bouee lagon', profile: 'lifebuoy', rim: '#06b6d4', core: '#ecfeff', barkA: '#67e8f9', barkB: '#a5f3fc', rings: 'rgba(255,255,255,0.85)', crack: 'rgba(34,211,238,0.28)', sprinkle: '#facc15' },
  { name: 'Donut galaxie', profile: 'donut', rim: '#8b5cf6', core: '#1e1b4b', barkA: '#c084fc', barkB: '#4c1d95', rings: 'rgba(255,255,255,0.34)', crack: 'rgba(216,180,254,0.32)', sprinkle: '#22d3ee' },
];

function normalizeAngle(angle: number) {
  let result = angle % (Math.PI * 2);
  if (result < 0) {
    result += Math.PI * 2;
  }
  return result;
}

function angleDistance(a: number, b: number) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, Math.PI * 2 - diff);
}

function getLevelConfig(level: number) {
  const normalizedLevel = Math.max(1, level);
  const turnBias = normalizedLevel % 2 === 0 ? -1 : 1;
  const baseSpeed = Math.min(0.00092 + normalizedLevel * 0.00008, 0.00175);
  const existingKnives = Math.min(Math.floor((normalizedLevel - 1) / 4), 5);
  const knivesToThrow = Math.min(3 + Math.floor((normalizedLevel - 1) / 2), 7);
  const feintPattern: FeintPattern =
    normalizedLevel >= 20 ? 'chaos'
      : normalizedLevel >= 15 ? 'stutter'
        : normalizedLevel >= 10 ? 'snap'
          : normalizedLevel >= 6 ? 'pulse'
            : 'none';

  return {
    speed: baseSpeed * turnBias,
    existingKnives,
    knivesToThrow,
    directionChanges: normalizedLevel >= 4,
    switchIntervalMs: Math.max(4200 - normalizedLevel * 110, 2200),
    feintPattern,
  };
}

function pickRandomIndex(length: number, previousIndex: number | null) {
  if (length <= 1) return 0;
  let nextIndex = Math.floor(Math.random() * length);
  if (previousIndex === null) return nextIndex;
  while (nextIndex === previousIndex) {
    nextIndex = Math.floor(Math.random() * length);
  }
  return nextIndex;
}

export default function KnifeHit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const submittedRef = useRef(false);
  const canvasScaleRef = useRef(1);
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();

  const wheelRotationRef = useRef(0);
  const wheelSpeedRef = useRef(0.001);
  const wheelTargetSpeedRef = useRef(0.001);
  const directionSignRef = useRef<1 | -1>(1);
  const knivesOnTargetRef = useRef<KnifeOnTarget[]>([]);
  const activeKnifeRef = useRef<ActiveKnife>({ state: 'ready', y: THROW_START_Y });
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const knivesLeftRef = useRef(0);
  const gameRunningRef = useRef(false);
  const switchTimerRef = useRef(0);
  const directionCountdownRef = useRef<number | null>(null);
  const worldIndexRef = useRef<number | null>(null);
  const knifeSkinIndexRef = useRef<number | null>(null);
  const logSkinIndexRef = useRef<number | null>(null);

  const { user, refreshUser } = useAuth();
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [knivesLeft, setKnivesLeft] = useState(0);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [directionLabel, setDirectionLabel] = useState<'Horaire' | 'Antihoraire'>('Horaire');
  const [directionChangeInMs, setDirectionChangeInMs] = useState<number | null>(null);
  const [worldIndex, setWorldIndex] = useState(0);
  const [knifeSkinIndex, setKnifeSkinIndex] = useState(0);
  const [logSkinIndex, setLogSkinIndex] = useState(0);

  const palette = useMemo(() => WORLD_PALETTES[worldIndex], [worldIndex]);
  const knifeSkin = useMemo(() => KNIFE_SKINS[knifeSkinIndex], [knifeSkinIndex]);
  const logSkin = useMemo(() => LOG_SKINS[logSkinIndex], [logSkinIndex]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const response = await gamesApi.getStats('knife_hit', user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch (error) {
      console.error('Failed to fetch knife hit stats:', error);
    }
  }, [user]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard('knife_hit', 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch knife hit leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const setupLevel = useCallback((levelNumber: number, keepScore: boolean) => {
    const config = getLevelConfig(levelNumber);
    wheelRotationRef.current = 0;
    directionSignRef.current = config.speed >= 0 ? 1 : -1;
    wheelSpeedRef.current = config.speed;
    wheelTargetSpeedRef.current = config.speed;
    switchTimerRef.current = 0;
    knivesLeftRef.current = config.knivesToThrow;
    activeKnifeRef.current = { state: 'ready', y: THROW_START_Y };
    if (!keepScore) {
      scoreRef.current = 0;
    }

    const usedOffsets: number[] = [];
    while (usedOffsets.length < config.existingKnives) {
      const candidate = Math.random() * Math.PI * 2;
      const hasCollision = usedOffsets.some((offset) => angleDistance(offset, candidate) < MIN_SPAWN_GAP);
      if (!hasCollision) {
        usedOffsets.push(candidate);
      }
    }
    knivesOnTargetRef.current = usedOffsets.map((offset) => ({ offset }));
    levelRef.current = levelNumber;
    worldIndexRef.current = pickRandomIndex(WORLD_PALETTES.length, worldIndexRef.current);
    knifeSkinIndexRef.current = pickRandomIndex(KNIFE_SKINS.length, knifeSkinIndexRef.current);
    logSkinIndexRef.current = pickRandomIndex(LOG_SKINS.length, logSkinIndexRef.current);

    setLevel(levelNumber);
    setKnivesLeft(config.knivesToThrow);
    setScore(scoreRef.current);
    setWorldIndex(worldIndexRef.current);
    setKnifeSkinIndex(knifeSkinIndexRef.current);
    setLogSkinIndex(logSkinIndexRef.current);
    setDirectionLabel(config.speed >= 0 ? 'Horaire' : 'Antihoraire');
    directionCountdownRef.current = config.directionChanges ? config.switchIntervalMs : null;
    setDirectionChangeInMs(directionCountdownRef.current);
  }, []);

  const startGame = useCallback(() => {
    submittedRef.current = false;
    setStarted(true);
    setGameOver(false);
    setRewards(null);
    setIsNewHighScore(false);
    setupLevel(1, false);
    gameRunningRef.current = true;
    lastTimeRef.current = 0;
  }, [setupLevel]);

  const submitScore = useCallback(async (finalScore: number) => {
    if (!user || submittedRef.current) return;
    submittedRef.current = true;
    try {
      const response = await gamesApi.complete('knife_hit', {
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
      console.error('Failed to submit knife hit score:', error);
    }
  }, [fetchLeaderboard, refreshUser, user]);

  const endGame = useCallback(() => {
    gameRunningRef.current = false;
    setGameOver(true);
    void submitScore(scoreRef.current);
  }, [submitScore]);

  const advanceLevel = useCallback(() => {
    const nextLevel = levelRef.current + 1;
    setupLevel(nextLevel, true);
  }, [setupLevel]);

  const throwKnife = useCallback(() => {
    if (!gameRunningRef.current) return;
    if (activeKnifeRef.current.state !== 'ready') return;
    activeKnifeRef.current = {
      state: 'flying',
      y: THROW_START_Y,
    };
  }, []);

  const drawKnifeFromTip = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    const bladeGradient = ctx.createLinearGradient(0, 0, 0, KNIFE_BLADE_LENGTH);
    bladeGradient.addColorStop(0, knifeSkin.edge);
    bladeGradient.addColorStop(0.4, knifeSkin.blade);
    bladeGradient.addColorStop(1, knifeSkin.edge);
    if (knifeSkin.profile === 'spike') {
      ctx.fillStyle = bladeGradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-5, 18);
      ctx.lineTo(-2, KNIFE_BLADE_LENGTH + 10);
      ctx.lineTo(2, KNIFE_BLADE_LENGTH + 10);
      ctx.lineTo(5, 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = knifeSkin.handle;
      ctx.beginPath();
      ctx.roundRect(-4, KNIFE_BLADE_LENGTH + 4, 8, 18, 4);
      ctx.fill();
      ctx.fillStyle = knifeSkin.detail;
      ctx.beginPath();
      ctx.arc(0, KNIFE_BLADE_LENGTH + 13, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `${knifeSkin.detail}cc`;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(0, KNIFE_BLADE_LENGTH + 2);
      ctx.stroke();
    } else if (knifeSkin.profile === 'toothpick') {
      ctx.fillStyle = knifeSkin.blade;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-2.5, 14);
      ctx.lineTo(-2, KNIFE_TOTAL_LENGTH - 4);
      ctx.lineTo(0, KNIFE_TOTAL_LENGTH + 2);
      ctx.lineTo(2, KNIFE_TOTAL_LENGTH - 4);
      ctx.lineTo(2.5, 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = knifeSkin.detail;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(0, KNIFE_TOTAL_LENGTH - 4);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(-0.5, 12);
      ctx.lineTo(-0.5, KNIFE_TOTAL_LENGTH - 10);
      ctx.stroke();
    } else if (knifeSkin.profile === 'pen') {
      ctx.fillStyle = knifeSkin.edge;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-5, 12);
      ctx.lineTo(5, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = knifeSkin.handle;
      ctx.beginPath();
      ctx.roundRect(-6, 12, 12, 54, 4);
      ctx.fill();
      ctx.fillStyle = knifeSkin.guard;
      ctx.fillRect(-6, 12, 12, 8);
      ctx.fillStyle = knifeSkin.detail;
      ctx.fillRect(2, 18, 2, 36);
      ctx.fillRect(-3, 20, 2, 24);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-3, 18);
      ctx.lineTo(-3, 58);
      ctx.stroke();
      ctx.fillStyle = knifeSkin.pommel;
      ctx.beginPath();
      ctx.roundRect(-4, 66, 8, 14, 3);
      ctx.fill();
    } else if (knifeSkin.profile === 'screwdriver') {
      ctx.fillStyle = bladeGradient;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(-6, 8);
      ctx.lineTo(-2, 18);
      ctx.lineTo(-2, 34);
      ctx.lineTo(2, 34);
      ctx.lineTo(2, 18);
      ctx.lineTo(6, 8);
      ctx.lineTo(2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = knifeSkin.handle;
      ctx.beginPath();
      ctx.roundRect(-8, 30, 16, 40, 7);
      ctx.fill();
      ctx.fillStyle = knifeSkin.detail;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(-7, 38 + i * 10, 14, 3);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-4, 33);
      ctx.lineTo(-4, 67);
      ctx.moveTo(4, 33);
      ctx.lineTo(4, 67);
      ctx.stroke();
      ctx.fillStyle = knifeSkin.pommel;
      ctx.beginPath();
      ctx.arc(0, 74, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (knifeSkin.profile === 'wand') {
      ctx.fillStyle = knifeSkin.handle;
      ctx.beginPath();
      ctx.roundRect(-3, 8, 6, 66, 3);
      ctx.fill();
      ctx.fillStyle = knifeSkin.pommel;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 1; i < 10; i++) {
        const angle = i * Math.PI / 5 - Math.PI / 2;
        const radius = i % 2 === 0 ? 8 : 3.6;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = knifeSkin.detail;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-2, 18);
      ctx.lineTo(2, 18);
      ctx.moveTo(-2, 34);
      ctx.lineTo(2, 34);
      ctx.moveTo(-2, 50);
      ctx.lineTo(2, 50);
      ctx.stroke();
      ctx.fillStyle = `${knifeSkin.detail}88`;
      ctx.beginPath();
      ctx.arc(0, 26, 2.2, 0, Math.PI * 2);
      ctx.arc(0, 42, 2.2, 0, Math.PI * 2);
      ctx.arc(0, 58, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(15,23,42,0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }, [knifeSkin]);

  const drawHudPill = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    align: CanvasTextAlign = 'left'
  ) => {
    const pillX = align === 'right' ? x - width : x;
    ctx.save();
    ctx.fillStyle = 'rgba(6,10,18,0.4)';
    ctx.beginPath();
    ctx.roundRect(pillX, y, width, 52, HUD_PILL_RADIUS);
    ctx.fill();
    ctx.strokeStyle = `${palette.ring}55`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = align;
    ctx.fillStyle = palette.subtext;
    ctx.font = '600 11px system-ui';
    ctx.fillText(label, x + (align === 'right' ? 0 : 14), y + 18);
    ctx.fillStyle = palette.text;
    ctx.font = '700 16px system-ui';
    ctx.fillText(value, x + (align === 'right' ? 0 : 14), y + 36);
    ctx.restore();
  }, [palette]);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;

    ctx.setTransform(canvasScaleRef.current, 0, 0, canvasScaleRef.current, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const gradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    gradient.addColorStop(0, palette.bgA);
    gradient.addColorStop(1, palette.bgB);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const halo = ctx.createRadialGradient(CENTER, CENTER - 70, 24, CENTER, CENTER - 70, 220);
    halo.addColorStop(0, palette.skyGlow);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 === 0 ? palette.track : palette.glow;
      ctx.beginPath();
      ctx.arc(50 + i * 88, 70 + (i % 2) * 28, 2 + i, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(CENTER, CENTER - 58);
    ctx.rotate(wheelRotationRef.current);

    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 26;
    if (logSkin.profile === 'donut') {
      ctx.fillStyle = logSkin.core;
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS + 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = logSkin.rim;
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 18; i++) {
        const angle = (Math.PI * 2 * i) / 18;
        ctx.save();
        ctx.translate(Math.cos(angle) * 54, Math.sin(angle) * 54);
        ctx.rotate(angle);
        ctx.fillStyle = i % 2 === 0 ? (logSkin.sprinkle || logSkin.crack) : logSkin.crack;
        ctx.fillRect(-1.5, -6, 3, 12);
        ctx.restore();
      }
    } else if (logSkin.profile === 'lifebuoy') {
      ctx.fillStyle = logSkin.core;
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS + 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = logSkin.rim;
      ctx.lineWidth = 32;
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS - 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 16;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, TARGET_RADIUS - 2, i * Math.PI / 2 - 0.32, i * Math.PI / 2 + 0.32);
        ctx.stroke();
      }
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
    } else if (logSkin.profile === 'vinyl') {
      ctx.fillStyle = logSkin.core;
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS + 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = logSkin.rings;
      for (let i = 0; i < 6; i++) {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 22 + i * 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = logSkin.rim;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = logSkin.sprinkle || '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (logSkin.profile === 'planet') {
      const planetGradient = ctx.createRadialGradient(-18, -24, 10, 0, 0, TARGET_RADIUS + 18);
      planetGradient.addColorStop(0, logSkin.barkA);
      planetGradient.addColorStop(1, logSkin.barkB);
      ctx.fillStyle = planetGradient;
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS + 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = logSkin.rings;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.ellipse(0, 0, TARGET_RADIUS + 34, 30, -0.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = logSkin.crack;
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 34, Math.sin(angle) * 22, 7 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (logSkin.profile === 'cassette') {
      ctx.fillStyle = logSkin.core;
      ctx.beginPath();
      ctx.roundRect(-92, -60, 184, 120, 20);
      ctx.fill();
      ctx.strokeStyle = logSkin.rim;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.fillStyle = logSkin.barkB;
      ctx.beginPath();
      ctx.roundRect(-58, -34, 116, 68, 16);
      ctx.fill();
      ctx.fillStyle = logSkin.rings;
      ctx.beginPath();
      ctx.arc(-26, 0, 18, 0, Math.PI * 2);
      ctx.arc(26, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = logSkin.crack;
      ctx.fillRect(-44, -46, 88, 10);
      ctx.fillStyle = logSkin.sprinkle || '#f8fafc';
      ctx.fillRect(-18, -10, 36, 6);
    }
    ctx.shadowBlur = 0;

    for (const knife of knivesOnTargetRef.current) {
      drawKnifeFromTip(
        ctx,
        Math.cos(knife.offset) * (logSkin.profile === 'cassette' ? TARGET_RADIUS + 8 : TARGET_RADIUS),
        Math.sin(knife.offset) * (logSkin.profile === 'cassette' ? TARGET_RADIUS + 8 : TARGET_RADIUS),
        knife.offset - Math.PI / 2
      );
    }
    ctx.restore();

    if (activeKnifeRef.current.state === 'ready' || activeKnifeRef.current.state === 'flying') {
      drawKnifeFromTip(ctx, CENTER, activeKnifeRef.current.y, 0);
    }

    drawHudPill(ctx, 18, 16, 116, 'Niveau', `${levelRef.current}`);
    drawHudPill(ctx, CANVAS_SIZE - 18, 16, 120, 'Restants', `${knivesLeftRef.current}`, 'right');

    const timerLabel = directionChangeInMs !== null
      ? `${directionLabel} · ${(directionChangeInMs / 1000).toFixed(1)}s`
      : directionLabel;
    drawHudPill(ctx, 18, CANVAS_SIZE - 68, 190, 'Rotation', timerLabel);

    ctx.fillStyle = palette.text;
    ctx.font = '700 30px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${scoreRef.current}`, CENTER, 44);
  }, [directionChangeInMs, directionLabel, drawHudPill, drawKnifeFromTip, logSkin, palette]);

  const gameLoop = useCallback((timestamp: number) => {
    if (!gameRunningRef.current) {
      drawScene();
      animationRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp;
    }

    const delta = Math.min(timestamp - lastTimeRef.current, 34);
    lastTimeRef.current = timestamp;

    const config = getLevelConfig(levelRef.current);
    let targetSpeed = Math.abs(config.speed) * directionSignRef.current;
    if (config.feintPattern !== 'none') {
      const now = timestamp;
      const pulse = Math.sin(now * 0.0035 + levelRef.current * 0.45);

      if (config.feintPattern === 'pulse') {
        targetSpeed *= 1 + pulse * 0.18;
      } else if (config.feintPattern === 'snap') {
        const snapWindow = now % 1900;
        const snapBoost = snapWindow > 1380 && snapWindow < 1510 ? 1.72 : 1 + pulse * 0.16;
        targetSpeed *= snapBoost;
      } else if (config.feintPattern === 'stutter') {
        const step = Math.floor(now / 170) % 7;
        const multipliers = [1, 1.55, 0.82, 1.74, 0.76, 1.48, 1];
        targetSpeed *= multipliers[step];
      } else if (config.feintPattern === 'chaos') {
        const step = Math.floor(now / 135) % 8;
        const multipliers = [1.15, 1.92, 0.68, 1.88, 0.74, 1.66, 0.9, 1.42];
        targetSpeed *= multipliers[step];
      }
    }
    wheelTargetSpeedRef.current = targetSpeed;

    const easing = config.feintPattern === 'none' ? 0.075 : config.feintPattern === 'pulse' ? 0.1 : 0.18;
    wheelSpeedRef.current += (wheelTargetSpeedRef.current - wheelSpeedRef.current) * easing;
    wheelRotationRef.current = normalizeAngle(wheelRotationRef.current + wheelSpeedRef.current * delta);
    if (config.directionChanges) {
      switchTimerRef.current += delta;
      const remaining = Math.max(0, config.switchIntervalMs - switchTimerRef.current);
      const roundedRemaining = Math.ceil(remaining / 100) * 100;
      if (directionCountdownRef.current !== roundedRemaining) {
        directionCountdownRef.current = roundedRemaining;
        setDirectionChangeInMs(roundedRemaining);
      }

      if (switchTimerRef.current >= config.switchIntervalMs) {
        switchTimerRef.current = 0;
        directionSignRef.current = directionSignRef.current === 1 ? -1 : 1;
        wheelTargetSpeedRef.current = Math.abs(config.speed) * directionSignRef.current;
        setDirectionLabel(directionSignRef.current >= 0 ? 'Horaire' : 'Antihoraire');
        directionCountdownRef.current = config.switchIntervalMs;
        setDirectionChangeInMs(config.switchIntervalMs);
      }
    } else if (directionCountdownRef.current !== null) {
      directionCountdownRef.current = null;
      setDirectionChangeInMs(null);
    }

    if (activeKnifeRef.current.state === 'flying') {
      activeKnifeRef.current.y -= THROW_SPEED * delta;
      const hitY = CENTER - 58 + TARGET_RADIUS;
      if (activeKnifeRef.current.y <= hitY) {
        const impactOffset = normalizeAngle(IMPACT_ANGLE - wheelRotationRef.current);
        const collided = knivesOnTargetRef.current.some((knife) => angleDistance(knife.offset, impactOffset) < COLLISION_GAP);

        if (collided) {
          endGame();
        } else {
          knivesOnTargetRef.current.push({ offset: impactOffset });
          activeKnifeRef.current = { state: 'ready', y: THROW_START_Y };
          knivesLeftRef.current -= 1;
          scoreRef.current += 1;
          setScore(scoreRef.current);
          setKnivesLeft(knivesLeftRef.current);

          if (knivesLeftRef.current <= 0) {
            advanceLevel();
          }
        }
      }
    }

    drawScene();
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [advanceLevel, drawScene, endGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      canvasScaleRef.current = width / CANVAS_SIZE;
      drawScene();
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    window.addEventListener('resize', resizeCanvas);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [drawScene, isFullscreen]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      event.preventDefault();
      if (!started || gameOver) {
        startGame();
        return;
      }
      throwKnife();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, started, startGame, throwKnife]);

  return (
    <PageShell size="wide">
      <div className={cn(
        'grid items-start gap-4 px-4 pb-4',
        isFullscreen ? 'grid-cols-1 justify-items-center' : 'grid-cols-[1fr_auto_1fr]'
      )}>
        <div className={cn('flex flex-col gap-4', isFullscreen && 'hidden')}>
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="text-xl font-semibold">{score}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Record</p>
                  <p className="text-xl font-semibold">{highScore}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Niveau</p>
                  <p className="text-xl font-semibold">{level}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Restants</p>
                  <p className="text-xl font-semibold">{knivesLeft}</p>
                </div>
              </div>
              <div
                className="rounded-xl border p-3 text-center transition-colors"
                style={{
                  borderColor: `${palette.accent}55`,
                  background: `linear-gradient(135deg, ${palette.bgA}, ${palette.bgB})`,
                  color: palette.text,
                }}
              >
                <p className="text-xs" style={{ color: palette.subtext }}>
                  Monde
                </p>
                <p className="text-sm font-semibold">{palette.name}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">Rotation</p>
                <p className="text-sm font-semibold">{directionLabel}</p>
                {directionChangeInMs !== null && (
                  <p className="text-xs text-muted-foreground">change dans {(directionChangeInMs / 1000).toFixed(1)}s</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-2">
              <Button
                className="w-full justify-start"
                onClick={started && !gameOver ? throwKnife : startGame}
              >
                {started && !gameOver ? <Zap className="mr-2 h-4 w-4" /> : <Target className="mr-2 h-4 w-4" />}
                {started && !gameOver ? 'Lancer' : 'Commencer'}
              </Button>
              {(started || gameOver) && (
                <Button variant="outline" className="w-full justify-start" onClick={startGame}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Rejouer
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div
          ref={gameContainerRef}
          className={cn(
            'flex flex-col items-center gap-4',
            isFullscreen && 'min-h-screen w-screen justify-start bg-background px-4 py-4'
          )}
        >
          <GameFullscreenToolbar
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            className="w-full max-w-[420px]"
          >
            {isFullscreen && (
              <Button size="sm" variant="outline" onClick={started && !gameOver ? throwKnife : startGame}>
                {started && !gameOver ? <Zap className="mr-2 h-4 w-4" /> : <Target className="mr-2 h-4 w-4" />}
                {started && !gameOver ? 'Lancer' : 'Commencer'}
              </Button>
            )}
            {isFullscreen && (started || gameOver) && (
              <Button size="sm" variant="outline" onClick={startGame}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Rejouer
              </Button>
            )}
          </GameFullscreenToolbar>

          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={CANVAS_SIZE} baseHeight={CANVAS_SIZE}>
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="h-full w-full rounded-[28px] border border-border/40"
              onClick={() => {
                if (!started || gameOver) {
                  startGame();
                  return;
                }
                throwKnife();
              }}
            />

            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-black/50 backdrop-blur-sm">
                <div className="w-full max-w-xs rounded-2xl border border-border/60 bg-background/95 p-6 text-center shadow-xl">
                  <p className="text-sm text-muted-foreground">Run terminee</p>
                  <p className="mt-1 text-4xl font-bold">{score}</p>
                  <p className="mt-1 text-sm text-muted-foreground">couteaux places avant collision</p>
                  {isNewHighScore && <p className="mt-3 text-sm font-medium text-amber-500">Nouveau record</p>}
                  {rewards && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      +${rewards.money} · +{rewards.aura} aura
                    </p>
                  )}
                  <Button className="mt-4 w-full" onClick={startGame}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Nouvelle run
                  </Button>
                </div>
              </div>
            )}
          </GameFullscreenStage>
        </div>

        <GameLeaderboard
          entries={leaderboard}
          currentUserId={user?.id}
          personalHighScore={highScore}
          maxHeight={420}
          hidden={isFullscreen}
        />
      </div>
    </PageShell>
  );
}
