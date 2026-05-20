import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Trophy,
  Wallet,
  Plus,
  Sparkles,
  Dna,
  Dumbbell,
  Skull,
  Palette,
  Tag,
  ShieldAlert,
  Building2,
  Users,
  Medal,
  History,
  X,
  BarChart2,
  Zap,
  Flame,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppModal } from '@/components/ui/app-modal';
import { BusinessSelectionModal } from '@/components/business/BusinessSelectionModal';
import { PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/contexts/AuthContext';
import {
  horseRaceApi,
  type HorseRaceStateResponse,
  type HorseRaceLineupEntry,
  type StableMeDto,
  type StableHorseDto,
  type PublicStableDto,
  type PatternDto,
  type AccessoryDto,
  type HorseRaceConfig,
  type HorseRaceStandingsResponse,
  type RecentRaceDto,
  type TopHorseDto,
  type HorseServiceBusinessDto,
  type HorseCosmetics,
  type HorseMarketListingDto,
} from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// =====================================================================
// Fallback config
// =====================================================================
const DEFAULT_CONFIG: HorseRaceConfig = {
  CYCLE_MS: 5 * 60 * 1000,
  RACE_MS: 60 * 1000,
  RESULTS_MS: 30 * 1000,
  BETTING_MS: 5 * 60 * 1000 - 60 * 1000 - 30 * 1000,
  ENTRANTS: 8,
  HOUSE_EDGE: 0.10,
  MAX_BETS_PER_USER: 3,
  MAX_BET_TOTAL: 100_000,
  STABLE_CREATE_COST: 25_000,
  HORSE_BUY_COST: 12_500,
  HORSE_TRAIN_COST: 2_500,
  HORSE_TRAIN_BASELINE_COST: 2_000,
  HORSE_PRODUCTION_COST: 10_000,
  HORSE_PRODUCTION_MS: 60 * 60 * 1000,
  HORSE_TRAIN_INC: 0.1,
  HORSE_TRAIN_CAP: 1.5,
  BREED_COST: 25_000,
  CUSTOMIZE_COST: 5_000,
  DOPE_COST: 2_500,
  DOPE_CATCH_PCT: 0.33,
  DOPE_SPEED_BOOST: 1.5,
  DOPE_STAMINA_BOOST: 1.0,
  CYCLES_PER_YEAR: 24,
  MIN_AGE_TO_RACE: 1,
  MIN_AGE_TO_BREED: 2,
  DECLINE_START_AGE: 12,
  PRIZE_BASE_1ST: 15_000,
  PRIZE_BASE_2ND: 8_000,
  PRIZE_BASE_3RD: 4_000,
  PRIZE_POOL_1ST_PCT: 0.30,
  PRIZE_POOL_2ND_PCT: 0.15,
  PRIZE_POOL_3RD_PCT: 0.05,
};

const POOL_SEED = 0x9e3779b9;
const TRACK_UNITS = 1000;
const SIM_DT_MS = 100;

// =====================================================================
// Cosmetic palettes
// =====================================================================
const COAT_SWATCHES = [
  '#3b2a1e', '#5a3a22', '#7a4a2a', '#a06b3a',
  '#d2a86a', '#e9d9b0', '#f4e9d2', '#9c8b7a',
  '#6b6360', '#2c2a28', '#c9c0b5', '#8b1f1f',
  '#1f3a5a', '#27262b',
];
const MANE_SWATCHES = [
  '#1a1410', '#2c2418', '#5a4023', '#8b6a3a',
  '#c89860', '#e8d9b8', '#f4ead3', '#9c8b7a',
  '#3a3530', '#4a2218',
];
const SILKS_SWATCHES = [
  '#dc2626', '#ea580c', '#facc15', '#16a34a',
  '#0ea5e9', '#2563eb', '#7c3aed', '#db2777',
  '#0f172a', '#f8fafc',
];
const PATTERN_COLOR_SWATCHES = ['#f8fafc', '#1a1410', '#e0f2fe', '#fde68a', '#a78bfa', '#fb923c'];

const SILKS_DESIGNS_LIST: Array<{ id: string; label: string }> = [
  { id: 'solid', label: 'Unie' },
  { id: 'sash', label: 'Bandoulière' },
  { id: 'hoops', label: 'Cerceaux' },
  { id: 'stripes', label: 'Rayures' },
  { id: 'quartered', label: 'Écartelé' },
  { id: 'diamond', label: 'Losange' },
  { id: 'star', label: 'Étoile' },
  { id: 'chevron', label: 'Chevron' },
];

const FALLBACK_ACCESSORIES: AccessoryDto[] = [
  { key: 'none', label: 'Aucun', unlockWins: null, unlocked: true },
  { key: 'rosette', label: 'Rosette', unlockWins: 1, unlocked: false },
  { key: 'shades', label: 'Lunettes', unlockWins: 10, unlocked: false },
  { key: 'wreath', label: "Couronne d'olivier", unlockWins: 25, unlocked: false },
  { key: 'flames', label: 'Aura de feu', unlockWins: 60, unlocked: false },
  { key: 'crown', label: 'Couronne royale', unlockWins: 120, unlocked: false },
];

const PATTERN_DEFAULT_INK: Record<string, string> = {
  solid: '#f8fafc',
  star: '#f8fafc',
  blaze: '#f8fafc',
  snip: '#f8fafc',
  socks: '#f8fafc',
  stockings: '#f8fafc',
  dapple: '#f8fafc',
  pinto: '#f8fafc',
  overo: '#f8fafc',
  leopard: '#1a1410',
  stripes: '#1a1410',
  roan: '#d1d5db',
  brindle: '#1a1410',
  splash: '#f8fafc',
  frost: '#e0f2fe',
  flame: '#fb923c',
  royal: '#facc15',
};

// =====================================================================
// Color utils
// =====================================================================
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  if (m.length === 3) {
    return [parseInt(m[0] + m[0], 16), parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16)];
  }
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}
function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}

// =====================================================================
// Helpers
// =====================================================================
function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function formatOdds(decimal: number): string {
  return `${decimal.toFixed(2)}x`;
}
function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function fallbackCosmetics(c: Partial<HorseCosmetics> | null | undefined): HorseCosmetics {
  return {
    bodyColor: c?.bodyColor ?? '#7a4a2a',
    pattern: c?.pattern ?? 'solid',
    patternColor: c?.patternColor ?? '#f8fafc',
    mane: c?.mane ?? '#1a1410',
    silks1: c?.silks1 ?? '#dc2626',
    silks2: c?.silks2 ?? '#facc15',
    silksDesign: c?.silksDesign ?? 'solid',
    helmet: c?.helmet ?? '#0f172a',
    accessory: c?.accessory ?? 'none',
  };
}

// =====================================================================
// Track condition (deterministic per cycle)
// =====================================================================
function getCycleCondition(cycleIndex: number) {
  const h = cycleIndex % 3;
  if (h === 0) return { label: 'Ferme', emoji: '☀️', color: 'text-amber-300', bgColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)' };
  if (h === 1) return { label: 'Souple', emoji: '🌤️', color: 'text-sky-300', bgColor: 'rgba(56,189,248,0.1)', borderColor: 'rgba(56,189,248,0.3)' };
  return { label: 'Lourd', emoji: '🌧️', color: 'text-blue-400', bgColor: 'rgba(96,165,250,0.1)', borderColor: 'rgba(96,165,250,0.3)' };
}

// =====================================================================
// Horse profile helpers
// =====================================================================
function getHorseFormBadges(id: string, wins: number, podiums: number, races: number): Array<'W' | 'P' | 'L'> {
  if (races === 0) return [];
  const n = Math.min(5, races);
  const seed = [...id].reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
  return Array.from({ length: n }, (_, i) => {
    const x = ((seed * 1664525 + i * 22695477) >>> 0) / 4294967296;
    return x < wins / races ? 'W' as const : x < podiums / races ? 'P' as const : 'L' as const;
  }).reverse();
}

function getHorseMilestones(wins: number, races: number, earnings: number): string[] {
  const m: string[] = [];
  if (wins >= 100) m.push('👑 Centurion');
  else if (wins >= 50) m.push('🥇 Champion');
  else if (wins >= 25) m.push('✨ Étoile montante');
  else if (wins >= 10) m.push('🏆 10 victoires');
  else if (wins >= 1) m.push('🎖️ Gagnant');
  if (races >= 100) m.push('🎗️ Centenaire');
  else if (races >= 50) m.push('🎗️ Vétéran 50');
  if (earnings >= 1_000_000) m.push('💰 Millionnaire');
  return m;
}

function computeHorseRating(effSpeed: number, effStamina: number, effCons: number): number {
  const avg = (effSpeed + effStamina + effCons) / 3;
  if (avg >= 8.5) return 5;
  if (avg >= 7.8) return 4;
  if (avg >= 7.2) return 3;
  if (avg >= 6.5) return 2;
  return 1;
}

// =====================================================================
// Geometry — anatomically faithful horse, side profile, head LEFT
// =====================================================================
const SILHOUETTE_PATH = 'M 14,90 C 11,84 14,78 24,76 L 40,72 C 52,68 62,68 68,70 L 72,64 C 80,56 96,56 116,66 C 130,72 144,80 162,86 L 196,88 C 215,86 228,86 240,94 C 250,102 254,116 252,134 C 250,148 244,156 234,158 L 224,158 C 218,154 214,150 210,144 C 200,148 180,150 158,150 C 138,150 120,148 110,144 C 102,146 96,146 92,144 L 92,128 C 92,118 88,108 80,104 L 60,104 C 46,106 32,104 22,100 C 14,96 12,94 14,90 Z';
const MANE_PATH = 'M 76,58 C 88,52 110,56 132,66 C 138,72 136,80 130,82 L 116,76 C 100,72 86,68 78,66 C 74,64 72,60 76,58 Z';
const FORELOCK_PATH = 'M 60,68 C 58,62 62,58 66,60 L 68,68 C 66,72 60,72 60,68 Z';
const EAR_PATH = 'M 64,64 L 70,48 L 76,64 Z';
const TAIL_PATH = 'M 248,104 C 268,98 296,98 316,112 C 312,124 300,130 290,134 C 304,140 314,152 312,170 C 296,168 280,162 268,150 C 256,142 250,128 248,104 Z';
const LEG_NEAR_FRONT = 'M 100,140 C 90,156 76,170 62,182 L 56,194 L 68,196 L 80,190 C 92,178 102,166 112,154 Z';
const LEG_FAR_FRONT = 'M 114,140 C 108,156 102,172 100,188 L 104,200 L 116,200 L 120,188 C 122,172 122,156 120,140 Z';
const LEG_NEAR_HIND = 'M 218,138 C 226,154 244,170 264,182 L 274,194 L 264,198 L 250,192 C 232,182 218,168 210,150 Z';
const LEG_FAR_HIND = 'M 204,138 C 202,154 198,172 196,192 L 204,202 L 214,200 L 218,188 C 220,170 218,154 216,138 Z';
const HOOVES = [
  { x: 58, y: 190, w: 18, h: 6 },
  { x: 102, y: 194, w: 18, h: 6 },
  { x: 256, y: 190, w: 18, h: 6 },
  { x: 200, y: 196, w: 18, h: 6 },
];
const SADDLE_PAD = 'M 116,90 C 124,86 152,86 170,88 L 174,108 C 152,112 122,112 114,108 Z';
const JOCKEY_VEST = 'M 122,60 C 128,52 142,48 152,48 C 162,48 174,52 176,62 L 178,98 C 158,104 134,104 122,98 Z';
const HELMET = 'M 130,36 C 132,24 152,20 168,24 C 178,28 180,40 178,48 L 124,48 C 124,42 126,38 130,36 Z';
const BELLY_SHADE = 'M 100,144 C 130,154 190,156 220,144 L 220,152 C 190,160 130,160 100,152 Z';

// =====================================================================
// HorseSvg — composable cosmetics
// =====================================================================
type HorseSvgProps = Partial<HorseCosmetics> & {
  animated?: boolean;
  showJockey?: boolean;
  glow?: 'leader' | 'my' | null;
  className?: string;
  /** Direction the horse faces. Default 'right' so racing horses run forward. */
  facing?: 'left' | 'right';
};
function HorseSvg({
  bodyColor = '#5a3a22',
  pattern = 'solid',
  patternColor,
  mane = '#1a1410',
  silks1 = '#dc2626',
  silks2 = '#facc15',
  silksDesign = 'solid',
  helmet = '#0f172a',
  accessory = 'none',
  animated = false,
  showJockey = true,
  glow = null,
  className = '',
  facing = 'right',
}: HorseSvgProps) {
  const uid = useId().replace(/:/g, '');
  const clipId = `body-clip-${uid}`;
  const pc = patternColor || PATTERN_DEFAULT_INK[pattern] || '#f8fafc';

  const coatLight = lighten(bodyColor, 0.18);
  const coatShadow = darken(bodyColor, 0.3);
  const maneShadow = darken(mane, 0.25);

  const glowFilter =
    glow === 'leader' ? 'drop-shadow(0 0 8px hsl(48,96%,53%,0.7))'
    : glow === 'my' ? 'drop-shadow(0 0 8px hsl(160,84%,39%,0.85))'
    : undefined;

  return (
    <svg
      viewBox="0 0 320 210"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        overflow: 'visible',
        filter: glowFilter,
        transform: facing === 'right' ? 'scaleX(-1)' : undefined,
      }}
    >
      <defs>
        <linearGradient id={`coat-${uid}`} x1="0" y1="0.1" x2="0" y2="1">
          <stop offset="0" stopColor={coatLight} />
          <stop offset="0.55" stopColor={bodyColor} />
          <stop offset="1" stopColor={coatShadow} />
        </linearGradient>
        <linearGradient id={`coat-leg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={darken(bodyColor, 0.05)} />
          <stop offset="1" stopColor={darken(bodyColor, 0.45)} />
        </linearGradient>
        <linearGradient id={`coat-far-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={darken(bodyColor, 0.12)} />
          <stop offset="1" stopColor={darken(bodyColor, 0.45)} />
        </linearGradient>
        <linearGradient id={`silks-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lighten(silks1, 0.18)} />
          <stop offset="1" stopColor={darken(silks1, 0.18)} />
        </linearGradient>

        <clipPath id={clipId}>
          <path d={SILHOUETTE_PATH} />
        </clipPath>

        <pattern id={`dapple-${uid}`} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.8" fill={pc} opacity="0.5" />
          <circle cx="10" cy="9" r="2.2" fill={pc} opacity="0.55" />
          <circle cx="6" cy="11" r="1.4" fill={pc} opacity="0.4" />
        </pattern>
        <pattern id={`leopard-${uid}`} x="0" y="0" width="20" height="16" patternUnits="userSpaceOnUse">
          <ellipse cx="6" cy="5" rx="2.2" ry="1.6" fill={pc} opacity="0.85" />
          <ellipse cx="15" cy="10" rx="2" ry="1.5" fill={pc} opacity="0.85" />
          <ellipse cx="10" cy="14" rx="1.4" ry="1.1" fill={pc} opacity="0.75" />
        </pattern>
        <pattern id={`brindle-${uid}`} x="0" y="0" width="22" height="6" patternUnits="userSpaceOnUse">
          <path d="M 0,3 Q 5,0 11,3 T 22,3" stroke={pc} strokeWidth="1.4" fill="none" opacity="0.65" />
        </pattern>
        <pattern id={`roan-${uid}`} x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.7" fill={pc} opacity="0.55" />
          <circle cx="4.5" cy="4" r="0.7" fill={pc} opacity="0.55" />
        </pattern>
        <pattern id={`frost-${uid}`} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="2.5" fill={pc} opacity="0.45" />
        </pattern>

        <pattern id={`silk-hoops-${uid}`} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="10" height="5" fill={silks1} />
          <rect x="0" y="5" width="10" height="5" fill={silks2} />
        </pattern>
        <pattern id={`silk-stripes-${uid}`} x="0" y="0" width="10" height="20" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="5" height="20" fill={silks1} />
          <rect x="5" y="0" width="5" height="20" fill={silks2} />
        </pattern>
      </defs>

      {/* Aura/flames behind everything */}
      {accessory === 'flames' && (
        <g opacity="0.8">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M ${110 + i * 22},185 q -6,-26 0,-46 q 5,14 12,20 q -2,-16 4,-30 q 6,22 0,48 z`}
              fill={i % 2 === 0 ? '#fb923c' : '#f59e0b'}
              opacity={0.55 - i * 0.07}
            />
          ))}
        </g>
      )}

      <g className={animated ? 'hr-gallop' : undefined} style={{ transformOrigin: '160px 130px' }}>
        {/* TAIL */}
        <path d={TAIL_PATH} fill={mane} />
        <path d="M 252,114 Q 270,108 290,114" stroke={maneShadow} strokeWidth="1" fill="none" opacity="0.6" />

        {/* FAR HIND LEG */}
        <path d={LEG_FAR_HIND} fill={`url(#coat-far-${uid})`} />
        <rect x={HOOVES[3].x} y={HOOVES[3].y} width={HOOVES[3].w} height={HOOVES[3].h} rx="1" fill="#0f172a" />

        {/* FAR FRONT LEG */}
        <path d={LEG_FAR_FRONT} fill={`url(#coat-far-${uid})`} />
        <rect x={HOOVES[1].x} y={HOOVES[1].y} width={HOOVES[1].w} height={HOOVES[1].h} rx="1" fill="#0f172a" />

        {/* BODY + HEAD silhouette */}
        <path d={SILHOUETTE_PATH} fill={`url(#coat-${uid})`} />

        {/* Pattern overlay clipped to silhouette */}
        <g clipPath={`url(#${clipId})`}>
          {pattern === 'dapple' && <rect x="0" y="0" width="320" height="210" fill={`url(#dapple-${uid})`} />}
          {pattern === 'leopard' && <rect x="0" y="0" width="320" height="210" fill={`url(#leopard-${uid})`} />}
          {pattern === 'brindle' && <rect x="0" y="0" width="320" height="210" fill={`url(#brindle-${uid})`} />}
          {pattern === 'roan' && <rect x="0" y="0" width="320" height="210" fill={`url(#roan-${uid})`} />}
          {pattern === 'frost' && <rect x="0" y="0" width="320" height="210" fill={`url(#frost-${uid})`} />}
          {pattern === 'stripes' && (
            <g opacity="0.55">
              {[110, 130, 150, 170, 190, 210, 230].map((x) => (
                <path key={x} d={`M ${x},80 Q ${x + 4},120 ${x - 2},160`} stroke={pc} strokeWidth="3" fill="none" />
              ))}
            </g>
          )}
          {pattern === 'pinto' && (
            <>
              <path d="M 125,92 Q 155,84 188,96 Q 210,118 200,142 Q 165,152 130,144 Q 118,128 125,92 Z" fill={pc} />
              <path d="M 215,100 Q 240,92 254,108 Q 250,128 234,132 Q 218,128 215,100 Z" fill={pc} />
              <ellipse cx="98" cy="138" rx="10" ry="6" fill={pc} />
            </>
          )}
          {pattern === 'overo' && (
            <>
              <path d="M 100,128 Q 140,118 178,128 Q 200,140 178,156 Q 132,158 102,152 Q 90,142 100,128 Z" fill={pc} />
              <path d="M 208,108 Q 230,100 248,112 Q 252,132 232,138 Q 215,130 208,108 Z" fill={pc} />
            </>
          )}
          {pattern === 'splash' && (
            <>
              <path d="M 100,128 Q 145,116 180,130 Q 200,142 175,154 Q 130,160 100,150 Z" fill={pc} opacity="0.85" />
              <ellipse cx="240" cy="120" rx="14" ry="6" fill={pc} opacity="0.7" />
            </>
          )}
          {pattern === 'flame' && (
            <g opacity="0.85">
              <path d="M 24,98 Q 38,82 56,90 L 50,108 Q 38,108 28,108 Z" fill={pc} />
              <path d="M 100,140 Q 130,128 160,140 L 152,150 Q 122,156 100,150 Z" fill={pc} opacity="0.7" />
            </g>
          )}
          {pattern === 'royal' && (
            <>
              <path d="M 116,90 Q 160,80 200,92 L 196,108 Q 152,118 118,108 Z" fill={pc} opacity="0.85" />
              <rect x="150" y="96" width="14" height="3" fill={pc} />
              <circle cx="157" cy="104" r="2" fill={pc} />
            </>
          )}
          {pattern === 'star' && <ellipse cx="48" cy="80" rx="4" ry="5" fill={pc} />}
          {pattern === 'blaze' && <path d="M 30,76 L 32,100 L 22,100 L 24,82 Z" fill={pc} />}
          {pattern === 'snip' && <ellipse cx="20" cy="94" rx="3" ry="2.4" fill={pc} />}
        </g>

        {/* Belly shading */}
        <path d={BELLY_SHADE} fill="rgba(0,0,0,0.18)" />

        {/* MANE */}
        <path d={MANE_PATH} fill={mane} />
        {[82, 96, 110, 122].map((x, i) => (
          <path
            key={i}
            d={`M ${x},${66 + i * 0.5} Q ${x - 2},74 ${x - 4},82`}
            stroke={maneShadow}
            strokeWidth="1.2"
            fill="none"
            opacity="0.7"
          />
        ))}

        {/* EAR + FORELOCK */}
        <path d={EAR_PATH} fill={darken(bodyColor, 0.25)} />
        <path d="M 67,60 L 70,52 L 73,60 Z" fill={maneShadow} opacity="0.6" />
        <path d={FORELOCK_PATH} fill={mane} />

        {/* SADDLE + JOCKEY */}
        {showJockey && (
          <>
            <path d={SADDLE_PAD} fill={darken(silks1, 0.4)} stroke={darken(silks1, 0.55)} strokeWidth="0.5" />
            <path
              d={JOCKEY_VEST}
              fill={
                silksDesign === 'hoops'
                  ? `url(#silk-hoops-${uid})`
                  : silksDesign === 'stripes'
                  ? `url(#silk-stripes-${uid})`
                  : `url(#silks-${uid})`
              }
              stroke={darken(silks1, 0.4)}
              strokeWidth="0.7"
            />
            {silksDesign === 'sash' && (
              <path d="M 124,62 L 178,96 L 173,103 L 122,72 Z" fill={silks2} />
            )}
            {silksDesign === 'quartered' && (
              <path
                d="M 150,48 L 152,102 L 178,98 L 176,62 C 174,52 162,48 150,48 Z"
                fill={silks2}
                opacity="0.95"
              />
            )}
            {silksDesign === 'diamond' && (
              <path d="M 150,60 L 168,76 L 150,92 L 132,76 Z" fill={silks2} />
            )}
            {silksDesign === 'star' && (
              <path
                d="M 150,62 L 154,74 L 166,74 L 156,82 L 160,94 L 150,86 L 140,94 L 144,82 L 134,74 L 146,74 Z"
                fill={silks2}
              />
            )}
            {silksDesign === 'chevron' && (
              <path
                d="M 122,68 L 150,84 L 178,68 L 178,78 L 150,94 L 122,78 Z"
                fill={silks2}
                opacity="0.95"
              />
            )}
            <path d="M 168,66 C 188,68 196,84 192,98 C 184,98 178,92 174,86 Z" fill={`url(#silks-${uid})`} />
            <ellipse cx="192" cy="96" rx="5" ry="4" fill="#fde68a" />
            <path d={HELMET} fill={helmet} stroke={darken(helmet, 0.35)} strokeWidth="0.6" />
            <ellipse cx="150" cy="30" rx="14" ry="3.5" fill={lighten(helmet, 0.3)} opacity="0.5" />
            <path d="M 124,48 L 178,48 L 178,52 L 124,52 Z" fill={darken(helmet, 0.3)} />
            <path d="M 134,48 C 134,56 168,56 168,48 Z" fill="#fde68a" />
            <ellipse cx="162" cy="52" rx="1.2" ry="1.2" fill="#0f172a" />
          </>
        )}

        {/* BRIDLE */}
        <path d="M 20,98 C 24,94 36,93 48,94 L 60,98" stroke="#1a1410" strokeWidth="1.5" fill="none" opacity="0.95" />
        <path d="M 50,80 L 56,98" stroke="#1a1410" strokeWidth="1.2" fill="none" opacity="0.95" />
        <path d="M 62,76 L 68,96" stroke="#1a1410" strokeWidth="1.2" fill="none" opacity="0.95" />
        {showJockey && (
          <path d="M 58,98 C 90,98 110,94 130,90" stroke="#1a1410" strokeWidth="1.4" fill="none" opacity="0.9" />
        )}

        {/* EYE + NOSTRIL */}
        <ellipse cx="44" cy="82" rx="2.6" ry="2.2" fill="#0f172a" />
        <circle cx="44.5" cy="81.2" r="0.9" fill="#f8fafc" opacity="0.9" />
        <ellipse cx="20" cy="92" rx="2.2" ry="1.5" fill="rgba(0,0,0,0.55)" />
        <path d="M 14,96 Q 22,98 30,96" stroke={darken(bodyColor, 0.5)} strokeWidth="0.7" fill="none" opacity="0.6" />

        {/* NEAR HIND LEG */}
        <path d={LEG_NEAR_HIND} fill={`url(#coat-leg-${uid})`} />
        <rect x={HOOVES[2].x} y={HOOVES[2].y} width={HOOVES[2].w} height={HOOVES[2].h} rx="1" fill="#0f172a" />
        {(pattern === 'socks' || pattern === 'stockings') && (
          <rect x={HOOVES[2].x - 1} y={HOOVES[2].y - 12} width={HOOVES[2].w + 2} height="12" fill={pc} opacity="0.9" />
        )}

        {/* NEAR FRONT LEG */}
        <path d={LEG_NEAR_FRONT} fill={`url(#coat-leg-${uid})`} />
        <rect x={HOOVES[0].x} y={HOOVES[0].y} width={HOOVES[0].w} height={HOOVES[0].h} rx="1" fill="#0f172a" />
        {(pattern === 'socks' || pattern === 'stockings') && (
          <>
            <rect x={HOOVES[0].x - 1} y={HOOVES[0].y - 12} width={HOOVES[0].w + 2} height="12" fill={pc} opacity="0.9" />
            <rect x={HOOVES[1].x} y={HOOVES[1].y - 12} width={HOOVES[1].w} height="12" fill={pc} opacity="0.75" />
            <rect x={HOOVES[3].x} y={HOOVES[3].y - 12} width={HOOVES[3].w} height="12" fill={pc} opacity="0.75" />
          </>
        )}

        {/* ACCESSORIES drawn last */}
        {accessory === 'crown' && (
          <g>
            <path d="M 132,24 L 138,8 L 150,18 L 162,8 L 168,24 Z" fill="#facc15" stroke="#a16207" strokeWidth="0.5" />
            <circle cx="138" cy="10" r="1.6" fill="#dc2626" />
            <circle cx="150" cy="20" r="1.6" fill="#7c3aed" />
            <circle cx="162" cy="10" r="1.6" fill="#0ea5e9" />
            <rect x="130" y="24" width="40" height="4" fill="#eab308" />
          </g>
        )}
        {accessory === 'wreath' && (
          <g opacity="0.95">
            <path d="M 124,36 C 110,22 124,8 138,12" stroke="#16a34a" strokeWidth="3" fill="none" />
            <path d="M 176,36 C 190,22 176,8 162,12" stroke="#16a34a" strokeWidth="3" fill="none" />
            {[0, 1, 2, 3, 4].map((i) => (
              <ellipse
                key={`l${i}`}
                cx={120 + i * 3}
                cy={28 - i * 4}
                rx="3.2"
                ry="1.5"
                fill="#22c55e"
                transform={`rotate(${-20 - i * 15} ${120 + i * 3} ${28 - i * 4})`}
              />
            ))}
            {[0, 1, 2, 3, 4].map((i) => (
              <ellipse
                key={`r${i}`}
                cx={180 - i * 3}
                cy={28 - i * 4}
                rx="3.2"
                ry="1.5"
                fill="#22c55e"
                transform={`rotate(${20 + i * 15} ${180 - i * 3} ${28 - i * 4})`}
              />
            ))}
          </g>
        )}
        {accessory === 'rosette' && (
          <g transform="translate(178, 92)">
            <circle r="9" fill="#dc2626" />
            <circle r="4.5" fill="#facc15" />
            <text x="0" y="2" textAnchor="middle" fontSize="6" fontWeight="700" fill="#7f1d1d">1</text>
            <path d="M -3,9 L -5,22 L 0,18 L 5,22 L 3,9 Z" fill="#dc2626" />
          </g>
        )}
        {accessory === 'shades' && (
          <g>
            <rect x="32" y="76" width="10" height="6" rx="2" fill="#0f172a" />
            <rect x="44" y="76" width="10" height="6" rx="2" fill="#0f172a" />
            <line x1="42" y1="79" x2="44" y2="79" stroke="#0f172a" strokeWidth="1" />
          </g>
        )}
      </g>
    </svg>
  );
}

// Wrapper: take a partial cosmetics object directly
function HorseAvatar(props: Partial<HorseCosmetics> & { animated?: boolean; showJockey?: boolean; glow?: 'leader' | 'my' | null; className?: string; facing?: 'left' | 'right' }) {
  return <HorseSvg {...fallbackCosmetics(props)} animated={props.animated} showJockey={props.showJockey} glow={props.glow} className={props.className} facing={props.facing} />;
}

// =====================================================================
// RNG / simulation (matches backend)
// =====================================================================
function mulberry32(seedIn: number) {
  let seed = seedIn | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SimHorse = { id: string; speed: number; stamina: number; consistency: number };
type SimResult = {
  positions: Record<string, number[]>;
  finishOrder: string[];
  finishTimes: Record<string, number>;
};
function simulateRaceClient(entrants: SimHorse[], cycleIndex: number, raceMs: number): SimResult {
  const rand = mulberry32((POOL_SEED * 31 + cycleIndex) | 0);
  const positions: Record<string, number[]> = {};
  const speeds: Record<string, { base: number; stamina: number; noiseAmp: number; mult: number }> = {};
  for (const h of entrants) {
    positions[h.id] = [0];
    const formNoise = (rand() - 0.5) * 1.4;
    speeds[h.id] = {
      base: h.speed + formNoise,
      stamina: h.stamina,
      noiseAmp: Math.max(0.35, (10 - h.consistency) * 0.55),
      mult: 1,
    };
  }
  const totalSteps = Math.ceil(raceMs / SIM_DT_MS);
  const finishTimes: Record<string, number> = {};
  const baseTickProgress = TRACK_UNITS / (raceMs / SIM_DT_MS);
  type ScheduledEvent = { step: number; type: 'injury' | 'stitch' | 'stumble' | 'boost' };
  const scheduled: ScheduledEvent[] = [];
  for (const frac of [0.08, 0.22, 0.4, 0.58, 0.78]) {
    if (rand() < 0.7) {
      const r = rand();
      let type: ScheduledEvent['type'];
      if (r < 0.2) type = 'injury';
      else if (r < 0.45) type = 'stitch';
      else if (r < 0.7) type = 'stumble';
      else type = 'boost';
      scheduled.push({ step: Math.floor(totalSteps * frac), type });
    }
  }
  let scheduledIdx = 0;
  for (let step = 1; step <= totalSteps; step++) {
    while (scheduledIdx < scheduled.length && scheduled[scheduledIdx].step === step) {
      const idx = Math.floor(rand() * entrants.length);
      const target = entrants[idx];
      const s = speeds[target.id];
      switch (scheduled[scheduledIdx].type) {
        case 'injury': s.mult *= 0.55; break;
        case 'stitch': s.mult *= 0.82; break;
        case 'stumble': s.mult *= 0.9; break;
        case 'boost': s.mult *= 1.13; break;
      }
      scheduledIdx++;
    }
    const tMs = step * SIM_DT_MS;
    const fatigue = Math.max(0, (tMs - 30_000) / 60_000);
    for (const h of entrants) {
      const prev = positions[h.id][step - 1];
      if (prev >= TRACK_UNITS) {
        positions[h.id].push(TRACK_UNITS);
        continue;
      }
      const s = speeds[h.id];
      const fatigueDrag = fatigue * (1 - s.stamina / 14);
      const noise = (rand() * 2 - 1) * s.noiseAmp;
      const tick = baseTickProgress * (s.base / 7) * s.mult * (1 - fatigueDrag * 0.18) + noise * 0.6;
      const next = Math.min(TRACK_UNITS, prev + Math.max(0.1, tick));
      positions[h.id].push(next);
      if (next >= TRACK_UNITS && finishTimes[h.id] === undefined) finishTimes[h.id] = tMs;
    }
  }
  for (const h of entrants) {
    if (finishTimes[h.id] === undefined) {
      finishTimes[h.id] = raceMs + (TRACK_UNITS - positions[h.id][positions[h.id].length - 1]) * 50;
    }
    while (positions[h.id].length < totalSteps + 1) {
      positions[h.id].push(positions[h.id][positions[h.id].length - 1]);
    }
  }
  const finishOrder = entrants
    .slice()
    .sort((a, b) => finishTimes[a.id] - finishTimes[b.id])
    .map((h) => h.id);
  return { positions, finishOrder, finishTimes };
}
function interpAt(positions: number[], elapsedMs: number): number {
  const stepFloat = elapsedMs / SIM_DT_MS;
  const stepIdx = Math.floor(stepFloat);
  const frac = stepFloat - stepIdx;
  const lastIdx = positions.length - 1;
  const a = positions[Math.min(stepIdx, lastIdx)];
  const b = positions[Math.min(stepIdx + 1, lastIdx)];
  return a + (b - a) * frac;
}

// =====================================================================
// CommentaryTicker — live race narration
// =====================================================================
const COMMENTARY_SCRIPTS: Array<{ progress: number; fn: (l: string, s: string) => string }> = [
  { progress: 0.0,  fn: (l)    => `🚩 Et c'est parti ! ${l} prend la tête au départ !` },
  { progress: 0.10, fn: (l, s) => `${l} en tête. ${s} cherche à revenir.` },
  { progress: 0.25, fn: (l, s) => `Premier quart franchi ! ${l} devant ${s}.` },
  { progress: 0.40, fn: (l, s) => `Mi-course ! ${l} maintient le cap, ${s} en chasse.` },
  { progress: 0.55, fn: (l, s) => `Les chevaux négocient le virage. ${l} et ${s} au coude à coude !` },
  { progress: 0.70, fn: (l)    => `Dernière ligne droite ! ${l} donne tout !` },
  { progress: 0.85, fn: (l, s) => `${s} tente de revenir sur ${l} ! Tout se joue maintenant !` },
  { progress: 0.95, fn: (l)    => `À quelques foulées de l'arrivée — ${l} vers la victoire !` },
];

function CommentaryTicker({
  lineup,
  sim,
  elapsedMs,
  raceDurationMs,
  phase,
}: {
  lineup: HorseRaceLineupEntry[];
  sim: SimResult;
  elapsedMs: number;
  raceDurationMs: number;
  phase: string;
}) {
  const text = useMemo(() => {
    if (phase !== 'racing' || lineup.length === 0) return null;
    const progress = Math.min(1, elapsedMs / raceDurationMs);
    const sorted = lineup
      .map((e) => ({ entry: e, pos: interpAt(sim.positions[e.betKey] ?? [0], elapsedMs) }))
      .sort((a, b) => b.pos - a.pos);
    const leader = sorted[0]?.entry.name ?? '—';
    const second = sorted[1]?.entry.name ?? '—';
    let chosen = COMMENTARY_SCRIPTS[0];
    for (const script of COMMENTARY_SCRIPTS) {
      if (progress >= script.progress) chosen = script;
    }
    return chosen.fn(leader, second);
  }, [lineup, sim, elapsedMs, raceDurationMs, phase]);

  if (!text) return null;

  return (
    <div
      className="flex items-center gap-2 overflow-hidden rounded-lg border px-3 py-1.5"
      style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(244,63,94,0.2)' }}
    >
      <span className="shrink-0 animate-pulse text-[9px] font-extrabold uppercase tracking-widest text-rose-500">LIVE</span>
      <span className="hr-commentary-text truncate text-[11.5px] font-medium text-white/80">
        {text}
      </span>
    </div>
  );
}

// =====================================================================
// RaceTrack — engagement reskin (grandstand, lanes, finish pole)
// =====================================================================
function RaceTrack({
  lineup,
  sim,
  elapsedMs,
  isRacing,
  phase,
  betKeys,
  onLaneClick,
  leaderKey,
}: {
  lineup: HorseRaceLineupEntry[];
  sim: SimResult;
  elapsedMs: number;
  isRacing: boolean;
  phase: string;
  betKeys: Set<string>;
  onLaneClick: (entry: HorseRaceLineupEntry) => void;
  leaderKey: string | null;
}) {
  const showFinishPos = phase !== 'betting';
  return (
    <div
      className="hr-track-bg relative flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 border-emerald-900/50 shadow-2xl"
      style={{ minHeight: 360 }}
    >
      {/* Grandstand / sky */}
      <div className="hr-grandstand relative h-16 flex-shrink-0 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="hr-crowd-row absolute bottom-1.5 left-0 right-0 h-3.5 opacity-80 mix-blend-screen" />
        <div className="hr-crowd-row absolute bottom-5 left-0 right-0 h-3.5 opacity-50 mix-blend-screen" style={{ backgroundPositionX: '14px' }} />
        <div className="hr-crowd-row absolute bottom-9 left-0 right-0 h-3 opacity-30 mix-blend-screen" style={{ backgroundPositionX: '6px' }} />
        <div className="hr-crowd-row absolute bottom-12 left-0 right-0 h-2.5 opacity-20 mix-blend-screen" style={{ backgroundPositionX: '20px' }} />
        <div className="pointer-events-none absolute left-4 top-3 right-4 flex items-center justify-between text-white/90">
          <div className="flex flex-col drop-shadow-md">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Hippodrome de Longchamp
            </div>
            <div className="text-[15px] font-extrabold tracking-tight">Prix de l'Arc de Triomphe · 2400m</div>
          </div>
          {isRacing && (
            <div className="flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-950/60 px-3 py-1 shadow-[0_0_15px_rgba(244,63,94,0.3)] backdrop-blur-md">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-200/80">Chronomètre</span>
              <span className="font-mono text-[14px] font-black text-rose-100">{(elapsedMs / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>
      </div>

      {/* Top rail */}
      <div className="hr-rail relative h-[4px] flex-shrink-0 z-20 shadow-[0_2px_10px_rgba(0,0,0,0.6)]" />

      {/* Lanes — flex column with each lane taking equal share, ensuring track is always visible */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 px-2.5 py-3 relative z-0">
        {/* Distance markers */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <div
            key={frac}
            className="pointer-events-none absolute bottom-0 top-8 z-[1]"
            style={{ left: `calc(${(frac * 92 + 3).toFixed(1)}%)` }}
          >
            <div className="absolute inset-0 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span
              className="absolute top-1 -translate-x-1/2 rounded px-1 py-px text-[7px] font-bold tabular-nums text-white/25"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              {Math.round(frac * 2400)}m
            </span>
          </div>
        ))}
        {lineup.map((entry) => {
          const positions = sim.positions[entry.betKey] ?? [0];
          const pos = isRacing || phase === 'results' || phase === 'past' ? interpAt(positions, elapsedMs) : 0;
          const pct = Math.min(96, (pos / TRACK_UNITS) * 95);
          const finishPos = showFinishPos && entry.finishPos ? entry.finishPos : 0;
          const isMyBet = betKeys.has(entry.betKey);
          const isLeader = entry.betKey === leaderKey;
          return (
            <button
              key={entry.lane}
              type="button"
              onClick={() => onLaneClick(entry)}
              className={cn(
                'group relative w-full min-h-[52px] flex-1 overflow-hidden rounded-xl border-y border-white/5 text-left transition-all duration-300',
                isMyBet ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20 z-10' : 'hover:border-white/20 hover:bg-white/[0.02]',
                isLeader && phase === 'racing' && 'shadow-[0_0_20px_rgba(251,191,36,0.15)] ring-1 ring-amber-500/20 z-10',
              )}
              style={{
                background: isMyBet
                  ? 'linear-gradient(90deg, rgba(16,185,129,0.15) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.6) 100%)'
                  : isLeader && phase === 'racing'
                  ? 'linear-gradient(90deg, rgba(251,191,36,0.1) 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.5) 100%)'
                  : 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.6) 100%)',
              }}
            >
              {/* Turf strip */}
              <div className="hr-turf-strip absolute inset-y-[3px] left-1.5 right-1.5 overflow-hidden rounded-lg shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                <div className={cn('hr-lane-stripe absolute inset-0', isRacing && 'hr-lane-stripe-fast')} />
              </div>

              {/* Lane number */}
              <div className="absolute left-2.5 top-1/2 z-[2] -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 font-mono text-[11px] font-bold text-white/90 shadow-md border border-white/10">
                {entry.lane}
              </div>

              {/* Clan color stripe */}
              <div
                className="absolute left-10 top-2 bottom-2 z-[2] w-1 rounded-full"
                style={{ background: entry.silks1, boxShadow: `0 0 10px ${entry.silks1}80` }}
              />

              {/* Name + odds + owner */}
              <div className="pointer-events-none absolute left-12 top-1.5 z-[2] flex flex-col justify-center h-[calc(100%-12px)]">
                <div className="flex items-center gap-2">
                  <span className="max-w-[140px] truncate text-[13px] font-extrabold text-white drop-shadow-md">{entry.name}</span>
                  {!entry.isComputer && (
                    <span className="rounded bg-emerald-500/30 border border-emerald-500/50 px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-wider text-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.4)]">Mien</span>
                  )}
                  {entry.wasDoped && phase !== 'betting' && (
                    <span
                      className={cn(
                        'rounded border px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-wider shadow-[0_0_8px_rgba(251,146,60,0.4)]',
                        entry.wasCaught ? 'bg-rose-500/30 border-rose-500/50 text-rose-100 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-amber-500/30 border-amber-500/50 text-amber-100',
                      )}
                    >
                      {entry.wasCaught ? 'DQ' : '💉 DOP'}
                    </span>
                  )}
                </div>
                <div className="truncate text-[10px] text-white/60 font-medium">{entry.clanName ?? entry.stableName ?? 'IA · Pari Mutuel'}</div>
              </div>

              {/* Odds */}
              {entry.odds != null && (
                <div className="absolute right-14 top-1/2 z-[2] -translate-y-1/2 rounded-lg border border-amber-400/40 bg-black/70 px-2 py-1 font-mono text-[11px] font-black text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.2)] backdrop-blur-sm">
                  {entry.odds.toFixed(2)}x
                </div>
              )}

              {/* Finish pole */}
              <div className="hr-finish-pole absolute right-3 top-0 bottom-0 z-[1] w-2 opacity-90" />

              {/* The horse */}
              <div
                className="absolute top-1/2 z-[3] drop-shadow-[0_8px_8px_rgba(0,0,0,0.5)]"
                style={{
                  left: `calc(${pct}% - 38px)`,
                  width: 85,
                  height: 56,
                  transform: 'translateY(-50%)',
                  transition: isRacing ? 'left 100ms linear' : 'left 350ms cubic-bezier(0.22,1,0.36,1)',
                }}
              >
                <HorseSvg
                  {...fallbackCosmetics(entry)}
                  animated={isRacing}
                  glow={isLeader ? 'leader' : isMyBet ? 'my' : null}
                />
              </div>

              {/* Finish position chip */}
              {finishPos > 0 && (
                <div
                  className={cn(
                    'absolute right-5 bottom-1 z-[4] rounded-full px-1.5 py-px font-mono text-[9.5px] font-bold',
                    finishPos === 1 && 'bg-amber-400 text-amber-950',
                    finishPos === 2 && 'bg-slate-300 text-slate-900',
                    finishPos === 3 && 'bg-amber-700 text-white',
                    finishPos > 3 && 'bg-white/15 text-white/70',
                  )}
                >
                  #{finishPos}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================================
// Common small UI bits
// =====================================================================
function StatBar({ label, value, max = 11 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
function StatBarSplit({ label, gene, trained, cap = 11 }: { label: string; gene: number; trained: number; cap?: number }) {
  const genePct = Math.min(100, (gene / cap) * 100);
  const trainPct = Math.min(Math.max(0, (trained / cap) * 100), 100 - genePct);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-semibold">{(gene + trained).toFixed(1)}</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/30">
        <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-700 to-emerald-500" style={{ width: `${genePct}%` }} />
        <div className="absolute top-0 h-full bg-gradient-to-r from-amber-500 to-amber-400" style={{ left: `${genePct}%`, width: `${trainPct}%` }} />
      </div>
      <div className="flex justify-between text-[8.5px] text-muted-foreground/50">
        <span className="text-emerald-600/80">Gènes {gene.toFixed(1)}</span>
        <span className="text-amber-500/70">+{trained.toFixed(1)} entr.</span>
      </div>
    </div>
  );
}
function AgeBadge({ age }: { age: number }) {
  let label = '';
  let cls = '';
  if (age < 1) { label = `Poulain · ${age.toFixed(1)} an`; cls = 'bg-sky-500/20 text-sky-200 border-sky-500/30'; }
  else if (age < 3) { label = `Jeune · ${age.toFixed(1)} ans`; cls = 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'; }
  else if (age < 12) { label = `Adulte · ${age.toFixed(1)} ans`; cls = 'bg-amber-500/20 text-amber-200 border-amber-500/30'; }
  else if (age < 20) { label = `Vétéran · ${age.toFixed(1)} ans`; cls = 'bg-orange-500/20 text-orange-200 border-orange-500/30'; }
  else { label = `Ancien · ${age.toFixed(1)} ans`; cls = 'bg-rose-500/20 text-rose-200 border-rose-500/30'; }
  return <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', cls)}>{label}</span>;
}

function HorseCard({
  horse,
  onSelect,
  selected,
  onOpenAtelier,
}: {
  horse: StableHorseDto;
  onSelect?: () => void;
  selected?: boolean;
  onOpenAtelier?: () => void;
}) {
  const winRate = horse.races > 0 ? Math.round((horse.wins / horse.races) * 100) : 0;
  const effSpeed = horse.geneSpeed + horse.trainSpeed;
  const effStamina = horse.geneStamina + horse.trainStamina;
  const effCons = horse.geneConsistency + horse.trainConsistency;
  const isDopedNext = horse.dopedForCycle != null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative w-full overflow-hidden rounded-xl border border-border/40 bg-card/70 text-left transition hover:border-amber-400/40 hover:bg-card',
        selected && 'border-amber-400/70 ring-2 ring-amber-400/60',
      )}
    >
      <div className="flex items-stretch">
        <div className="relative flex w-28 shrink-0 items-center justify-center bg-gradient-to-br from-emerald-950/40 to-slate-900/40 p-1">
          <div className="h-16 w-24">
            <HorseAvatar {...horse} />
          </div>
          {horse.accessory !== 'none' && (
            <span className="absolute right-1 top-1 rounded bg-black/55 px-1 py-0.5 text-[8px] font-bold text-amber-300">
              BONUS
            </span>
          )}
        </div>
        <div className="flex-1 p-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{horse.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <AgeBadge age={horse.ageYears} />
                {horse.pendingEntries > 0 && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                    {horse.pendingEntries} inscr.
                  </span>
                )}
                {isDopedNext && (
                  <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                    💉 dopé
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-[10px] tabular-nums text-muted-foreground">
              <p>{horse.races} courses</p>
              <p className="font-semibold text-amber-200">{horse.wins}V / {horse.podiums}P</p>
              {horse.races > 0 && <p className="text-emerald-300">{winRate}% V.</p>}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <StatBar label="Vitesse" value={effSpeed} />
            <StatBar label="Endurance" value={effStamina} />
            <StatBar label="Constance" value={effCons} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>XP: <span className="font-semibold text-foreground">{horse.experience}</span></span>
            <span>Gains: <span className="font-semibold text-emerald-300">{formatMoney(horse.earnings)}</span></span>
          </div>
          {onOpenAtelier && (
            <div className="mt-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenAtelier(); }}
                className="flex items-center gap-1 rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20"
              >
                <Palette className="h-3 w-3" /> Atelier
              </button>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// =====================================================================
// Atelier (deep customization) modal
// =====================================================================
type AtelierTab = 'robe' | 'motif' | 'soie' | 'casque' | 'bonus';

function ColorSwatchRow({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string;
  options: string[];
  onPick: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">{label}</span>
        <span className="font-mono text-[10.5px] text-muted-foreground">{value}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className={cn(
              'h-7 w-7 rounded-lg border border-border transition hover:-translate-y-px',
              c.toLowerCase() === value.toLowerCase() && 'ring-2 ring-foreground ring-offset-1 ring-offset-background',
            )}
            style={{ background: c }}
            aria-label={c}
          />
        ))}
        <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
          <input
            type="color"
            value={value}
            onChange={(e) => onPick(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <Plus className="h-3 w-3" />
        </label>
      </div>
    </div>
  );
}

function AtelierModal({
  open,
  horse,
  onClose,
  patterns,
  accessories,
  silksDesigns,
  config,
  userMoney,
  onSaved,
}: {
  open: boolean;
  horse: StableHorseDto | null;
  onClose: () => void;
  patterns: PatternDto[];
  accessories: AccessoryDto[];
  silksDesigns: string[];
  config: HorseRaceConfig;
  userMoney: number;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<StableHorseDto | null>(horse);
  const [tab, setTab] = useState<AtelierTab>('robe');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(horse?.name ?? '');

  useEffect(() => {
    if (horse) {
      setDraft(horse);
      setName(horse.name);
      setTab('robe');
    }
  }, [horse]);

  if (!open || !horse || !draft) return null;

  const set = <K extends keyof HorseCosmetics>(k: K, v: HorseCosmetics[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const cosmeticsDirty = (Object.keys(fallbackCosmetics(horse)) as Array<keyof HorseCosmetics>).some(
    (k) => draft[k] !== horse[k],
  );
  const nameDirty = name.trim() !== horse.name && name.trim().length >= 2 && name.length <= 30;
  const cost = cosmeticsDirty ? config.CUSTOMIZE_COST : 0;
  const canSave = !busy && (cosmeticsDirty || nameDirty) && userMoney >= cost;

  const designsList = silksDesigns.length > 0
    ? SILKS_DESIGNS_LIST.filter((d) => silksDesigns.includes(d.id))
    : SILKS_DESIGNS_LIST;

  const apply = async () => {
    try {
      setBusy(true);
      const data: Parameters<typeof horseRaceApi.updateHorse>[1] = {};
      if (nameDirty) data.name = name.trim();
      if (cosmeticsDirty) {
        data.bodyColor = draft.bodyColor;
        data.pattern = draft.pattern;
        data.patternColor = draft.patternColor;
        data.mane = draft.mane;
        data.silks1 = draft.silks1;
        data.silks2 = draft.silks2;
        data.silksDesign = draft.silksDesign;
        data.helmet = draft.helmet;
        data.accessory = draft.accessory;
      }
      await horseRaceApi.updateHorse(horse.id, data);
      toast.success('Cheval mis à jour.');
      await onSaved();
      onClose();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<{ id: AtelierTab; label: string }> = [
    { id: 'robe', label: '🐴 Robe' },
    { id: 'motif', label: '✨ Motif' },
    { id: 'soie', label: '🏁 Soie' },
    { id: 'casque', label: '🛡️ Casque' },
    { id: 'bonus', label: '👑 Bonus' },
  ];

  return (
    <AppModal open={open} onClose={onClose} tone="pink" size="xl">
      <AppModal.Header
        icon={<Palette />}
        tone="pink"
        title={`Atelier · ${horse.name}`}
        subtitle={`Personnalisation · ${formatMoney(config.CUSTOMIZE_COST)} par modification cosmétique`}
      />
      <AppModal.Divider />

      {/* Preview */}
      <div
        className="grid items-center gap-5 px-5 py-4"
        style={{
          gridTemplateColumns: '320px 1fr',
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(16,185,129,0.12), transparent 65%), linear-gradient(180deg, #0a1a12, #050a08)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="h-[200px] w-full">
          <HorseAvatar {...draft} animated />
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-white/50">Nom</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="mt-1 h-8 text-sm"
              placeholder="Nom du cheval"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatBar label="Vitesse" value={draft.geneSpeed + draft.trainSpeed} />
            <StatBar label="Endurance" value={draft.geneStamina + draft.trainStamina} />
            <StatBar label="Constance" value={draft.geneConsistency + draft.trainConsistency} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] font-semibold">
              {patterns.find((p) => p.key === draft.pattern)?.label ?? '—'}
            </span>
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] font-semibold">
              {SILKS_DESIGNS_LIST.find((d) => d.id === draft.silksDesign)?.label ?? '—'}
            </span>
            {draft.accessory !== 'none' && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-amber-200">
                {accessories.find((a) => a.key === draft.accessory)?.label ?? draft.accessory}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/40 px-4 pt-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-t-md border border-b-0 px-3 py-1.5 text-[12.5px] font-medium transition',
              tab === t.id
                ? 'border-border bg-card text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="max-h-[42vh] overflow-y-auto px-5 py-4">
        {tab === 'robe' && (
          <div className="space-y-4">
            <ColorSwatchRow label="Couleur principale" value={draft.bodyColor} options={COAT_SWATCHES} onPick={(v) => set('bodyColor', v)} />
            <div className="h-px bg-border/40" />
            <ColorSwatchRow label="Crinière et queue" value={draft.mane} options={MANE_SWATCHES} onPick={(v) => set('mane', v)} />
          </div>
        )}
        {tab === 'motif' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {patterns.map((p) => {
                const active = draft.pattern === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    disabled={!p.unlocked}
                    onClick={() => p.unlocked && set('pattern', p.key)}
                    className={cn(
                      'group relative aspect-[4/3] rounded-lg border bg-card p-1.5 transition',
                      active ? 'border-amber-400 ring-1 ring-amber-400 bg-amber-400/5' : 'border-border hover:border-ring',
                      !p.unlocked && 'opacity-40',
                    )}
                  >
                    <div className="flex h-[calc(100%-14px)] items-center justify-center">
                      <HorseAvatar {...draft} pattern={p.key} showJockey={false} />
                    </div>
                    <div className="mt-0.5 truncate text-center text-[9.5px]">
                      {p.label}
                      {!p.unlocked && p.unlockWins != null && (
                        <span className="ml-1 text-rose-300">🔒 {p.unlockWins}V</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="h-px bg-border/40" />
            <ColorSwatchRow
              label="Couleur du motif"
              value={draft.patternColor}
              options={PATTERN_COLOR_SWATCHES}
              onPick={(v) => set('patternColor', v)}
            />
          </div>
        )}
        {tab === 'soie' && (
          <div className="space-y-4">
            <ColorSwatchRow label="Couleur principale (soie)" value={draft.silks1} options={SILKS_SWATCHES} onPick={(v) => set('silks1', v)} />
            <ColorSwatchRow label="Couleur secondaire (soie)" value={draft.silks2} options={SILKS_SWATCHES} onPick={(v) => set('silks2', v)} />
            <div className="h-px bg-border/40" />
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground">Design</p>
              <div className="grid grid-cols-4 gap-2">
                {designsList.map((d) => {
                  const active = draft.silksDesign === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => set('silksDesign', d.id)}
                      className={cn(
                        'aspect-[4/3] rounded-lg border bg-card p-1.5 transition',
                        active ? 'border-amber-400 ring-1 ring-amber-400 bg-amber-400/5' : 'border-border hover:border-ring',
                      )}
                    >
                      <div className="flex h-[calc(100%-14px)] items-center justify-center">
                        <HorseAvatar {...draft} silksDesign={d.id} />
                      </div>
                      <div className="mt-0.5 truncate text-center text-[9.5px]">{d.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {tab === 'casque' && (
          <ColorSwatchRow label="Couleur du casque" value={draft.helmet} options={SILKS_SWATCHES} onPick={(v) => set('helmet', v)} />
        )}
        {tab === 'bonus' && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Bonus esthétiques — débloqués grâce aux victoires d&apos;un de vos chevaux.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {accessories.map((a) => {
                const active = draft.accessory === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    disabled={!a.unlocked}
                    onClick={() => a.unlocked && set('accessory', a.key)}
                    className={cn(
                      'aspect-[3/2] rounded-lg border bg-card p-1.5 transition',
                      active ? 'border-amber-400 ring-1 ring-amber-400 bg-amber-400/5' : 'border-border hover:border-ring',
                      !a.unlocked && 'opacity-40',
                    )}
                  >
                    <div className="flex h-[calc(100%-14px)] items-center justify-center">
                      <HorseAvatar {...draft} accessory={a.key} />
                    </div>
                    <div className="mt-0.5 truncate text-center text-[9.5px]">
                      {a.label}
                      {!a.unlocked && a.unlockWins != null && (
                        <span className="ml-1 text-rose-300">🔒 {a.unlockWins}V</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AppModal.Footer>
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Solde</span>
            <span className="font-mono text-[14px] font-bold text-amber-200">{formatMoney(userMoney)}</span>
          </div>
          <div className="flex gap-2">
            <AppModal.Button variant="ghost" onClick={onClose}>Annuler</AppModal.Button>
            <AppModal.Button
              tone="pink"
              variant="solid"
              disabled={!canSave}
              onClick={apply}
            >
              {busy ? 'Sauvegarde…' : cosmeticsDirty ? `Sauvegarder · ${formatMoney(cost)}` : 'Renommer'}
            </AppModal.Button>
          </div>
        </div>
      </AppModal.Footer>
    </AppModal>
  );
}

// =====================================================================
// Create Stable modal
// =====================================================================
function CreateStableModal({
  open, onClose, onCreated, config, userMoney,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
  config: HorseRaceConfig;
  userMoney: number;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (name.trim().length < 3) {
      toast.error('Nom trop court (3 caractères min).');
      return;
    }
    try {
      setBusy(true);
      await horseRaceApi.createStable({ name: name.trim() });
      toast.success('Écurie créée !');
      await onCreated();
      setName('');
      onClose();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppModal open={open} onClose={onClose} tone="money" size="sm">
      <AppModal.Header icon={<Building2 />} tone="money" title="Créer une écurie" subtitle="Votre clan aura accès à l'ensemble de l'écurie." />
      <AppModal.Body>
        <div className="space-y-3.5">
          <div
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)' }}
          >
            <span className="text-2xl leading-none">🏇</span>
            <div className="min-w-0">
              {name.trim() ? (
                <p className="truncate text-[13.5px] font-semibold">{name.trim()}</p>
              ) : (
                <p className="text-[13px] italic text-muted-foreground/40">Nom de l&apos;écurie…</p>
              )}
              <p className="text-[11px] text-muted-foreground">Écurie de votre clan</p>
            </div>
          </div>
          <AppModal.Field
            label="Nom de l'écurie"
            value={name}
            onChange={setName}
            placeholder="Ex: Les Galopants"
          />
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2.5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <span className="text-[12px] text-muted-foreground">Coût de création</span>
            <div className="flex items-center gap-3">
              <span className={cn('text-[12px] tabular-nums', userMoney < config.STABLE_CREATE_COST ? 'text-rose-300' : 'text-muted-foreground/60')}>
                Solde: {formatMoney(userMoney)}
              </span>
              <span className="text-[13.5px] font-bold text-amber-300">{formatMoney(config.STABLE_CREATE_COST)}</span>
            </div>
          </div>
          {userMoney < config.STABLE_CREATE_COST && (
            <p className="text-center text-[11.5px] text-rose-300">Solde insuffisant.</p>
          )}
          {userMoney >= config.STABLE_CREATE_COST && name.trim().length > 0 && name.trim().length < 3 && (
            <p className="text-center text-[11.5px] text-amber-300">Le nom doit faire au moins 3 caractères.</p>
          )}
        </div>
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose}>Annuler</AppModal.Button>
        <AppModal.Button tone="money" variant="solid" full disabled={busy || userMoney < config.STABLE_CREATE_COST || name.trim().length < 3} onClick={submit}>
          {busy ? 'Création…' : 'Créer l\'écurie'}
        </AppModal.Button>
      </AppModal.Footer>
    </AppModal>
  );
}

// =====================================================================
// Bet modal
// =====================================================================
function BetModal({
  open, onClose, state, config, userMoney, onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  state: HorseRaceStateResponse | null;
  config: HorseRaceConfig;
  userMoney: number;
  onPlaced: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState('500');
  const [busy, setBusy] = useState(false);

  const myBetsCount = state?.myBets.length ?? 0;
  const myBetKeys = new Set(state?.myBets.map((b) => b.horseId) ?? []);
  const totalCommitted = state?.myBets.reduce((s, b) => s + b.amount, 0) ?? 0;
  const remainingTotalCap = Math.max(0, config.MAX_BET_TOTAL - totalCommitted);
  const isOpenForBets = state?.phase === 'betting';
  const canAddMore = myBetsCount < config.MAX_BETS_PER_USER;

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setAmount('500');
    }
  }, [open]);

  const submit = async () => {
    if (!state || !selected) return;
    const amt = Math.max(1, Math.floor(Number(amount) || 0));
    if (amt > userMoney) {
      toast.error('Solde insuffisant.');
      return;
    }
    if (amt > remainingTotalCap) {
      toast.error(`Mise totale dépasserait ${formatMoney(config.MAX_BET_TOTAL)}.`);
      return;
    }
    try {
      setBusy(true);
      await horseRaceApi.placeBet({ cycleIndex: state.cycleIndex, horseId: selected, amount: amt });
      toast.success('Pari placé.');
      setSelected(null);
      setAmount('500');
      onPlaced();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };
  const cancelBet = async (betId: string) => {
    try {
      setBusy(true);
      await horseRaceApi.cancelBet(betId);
      toast.success('Pari annulé.');
      onPlaced();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const selectedEntry = state?.lineup.find((x) => x.betKey === selected) ?? null;
  const potentialGain = selectedEntry?.odds ? Math.max(1, Math.floor(Number(amount) || 0)) * selectedEntry.odds : 0;
  const presets = [100, 500, 1000, 5000, 10000];

  return (
    <AppModal open={open} onClose={onClose} tone="orange" size="lg">
      <AppModal.Header
        icon={<Tag />}
        tone="orange"
        title="Placer un pari"
        subtitle={
          !isOpenForBets ? 'Paris fermés pour cette course.' :
          !canAddMore ? `Limite de ${config.MAX_BETS_PER_USER} paris atteinte.` :
          `${myBetsCount}/${config.MAX_BETS_PER_USER} paris · Plafond restant: ${formatMoney(remainingTotalCap)}`
        }
      />
      <AppModal.Divider />
      <div className="grid" style={{ gridTemplateColumns: '1fr 240px', height: 440 }}>
        {/* Left: horse list */}
        <div className="overflow-y-auto p-3 space-y-1" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <AppModal.SectionTitle>Sélectionner un cheval</AppModal.SectionTitle>
          {state?.lineup.map((entry) => {
            const isAlreadyBet = myBetKeys.has(entry.betKey);
            const isSelected = selected === entry.betKey;
            return (
              <button
                key={entry.lane}
                type="button"
                onClick={() => !isAlreadyBet && canAddMore && isOpenForBets && setSelected(entry.betKey)}
                disabled={isAlreadyBet || !isOpenForBets || !canAddMore}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition',
                  isSelected
                    ? 'border-orange-400/50 bg-orange-500/10'
                    : isAlreadyBet
                    ? 'cursor-default border-emerald-500/20 bg-emerald-500/5'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]',
                  isAlreadyBet && 'opacity-70',
                )}
              >
                <span className="w-4 text-center font-mono text-[10px] text-muted-foreground">{entry.lane}</span>
                <div className="h-10 w-14 shrink-0">
                  <HorseAvatar {...entry} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold">
                    {entry.name}
                    {!entry.isComputer && <span className="ml-1 text-[9px] text-amber-300/80">🏠</span>}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {entry.clanName ?? entry.stableName ?? 'IA · Pari Mutuel'}
                    {entry.ageYears != null && ` · ${entry.ageYears.toFixed(1)} ans`}
                  </p>
                </div>
                {isAlreadyBet ? (
                  <span className="shrink-0 text-[10px] font-semibold text-emerald-300">✓</span>
                ) : (
                  <span className={cn('shrink-0 font-mono text-[13px] font-bold', isSelected ? 'text-orange-200' : 'text-amber-200/80')}>
                    {entry.odds != null ? formatOdds(entry.odds) : '—'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: bet form */}
        <div className="flex flex-col gap-2.5 p-3">
          {selected && selectedEntry ? (
            <>
              <div
                className="rounded-xl pb-2 pt-2 text-center"
                style={{ background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.18)' }}
              >
                <div className="mx-auto h-16 w-24">
                  <HorseAvatar {...selectedEntry} />
                </div>
                <p className="truncate px-2 text-[12px] font-semibold leading-tight">{selectedEntry.name}</p>
                <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: 'rgba(251,146,60,0.18)' }}>
                  <p className="font-mono text-xl font-bold text-amber-200">{selectedEntry.odds ? formatOdds(selectedEntry.odds) : '—'}</p>
                  <p className="text-[9.5px] text-muted-foreground/60">cote actuelle</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {presets.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(String(v))}
                    disabled={!isOpenForBets || !canAddMore}
                    className={cn(
                      'rounded-lg py-1 text-[11px] font-semibold transition',
                      amount === String(v) ? 'text-orange-200' : 'text-muted-foreground hover:text-foreground',
                    )}
                    style={{
                      background: amount === String(v) ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.04)',
                      border: amount === String(v) ? '1px solid rgba(251,146,60,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.min(userMoney, remainingTotalCap)))}
                  disabled={!isOpenForBets || !canAddMore}
                  className="rounded-lg py-1 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Max
                </button>
              </div>
              <AppModal.Field label="Mise" value={amount} onChange={setAmount} type="number" suffix="$" />
              {potentialGain > 0 && (
                <div
                  className="rounded-lg py-2 text-center"
                  style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)' }}
                >
                  <p className="text-[9.5px] text-muted-foreground/60">gain potentiel</p>
                  <p className="text-[15px] font-bold text-amber-200">{formatMoney(potentialGain)}</p>
                </div>
              )}
              <AppModal.Button
                tone="orange"
                variant="solid"
                full
                size="lg"
                style={{ marginTop: 'auto' }}
                disabled={!isOpenForBets || !canAddMore || busy || Number(amount) <= 0 || Number(amount) > userMoney}
                onClick={submit}
              >
                {busy ? 'Envoi…' : 'Confirmer le pari'}
              </AppModal.Button>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Tag className="h-7 w-7 opacity-15" />
              <p className="text-[12px] leading-snug">Sélectionnez<br />un cheval</p>
            </div>
          )}
          {state && state.myBets.length > 0 && (
            <div className="space-y-1 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: selected ? undefined : 'auto' }}>
              <p className="text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground/50">Mes paris</p>
              {state.myBets.map((b) => {
                const entry = state.lineup.find((e) => e.betKey === b.horseId);
                if (!entry) return null;
                return (
                  <div key={b.id} className="flex items-center gap-1.5 text-[11px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.silks1 }} />
                    <span className="flex-1 truncate text-muted-foreground">{entry.name}</span>
                    <span className="tabular-nums text-amber-200/80">{formatMoney(b.amount)}</span>
                    {isOpenForBets && !b.settled && (
                      <button
                        type="button"
                        onClick={() => cancelBet(b.id)}
                        disabled={busy}
                        className="text-[11px] text-rose-400/60 transition hover:text-rose-300"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppModal>
  );
}

// =====================================================================
// Stable Management modal
// =====================================================================
function StableModal({
  open, onClose, stable, config, userMoney, horseBusinesses, onUpdated, onOpenAtelier,
}: {
  open: boolean;
  onClose: () => void;
  stable: StableMeDto | null;
  config: HorseRaceConfig;
  userMoney: number;
  horseBusinesses: HorseServiceBusinessDto[];
  onUpdated: () => Promise<void>;
  onOpenAtelier: (horse: StableHorseDto) => void;
}) {
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);
  const [foalName, setFoalName] = useState('');
  const [breedH1, setBreedH1] = useState<string>('');
  const [breedH2, setBreedH2] = useState<string>('');
  const [newHorseName, setNewHorseName] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'horses' | 'buy' | 'breed'>('horses');
  const [businessPicker, setBusinessPicker] = useState<null | { action: 'buy' } | { action: 'train'; stat: 'speed' | 'stamina' | 'consistency' }>(null);

  const [salePriceInput, setSalePriceInput] = useState('');
  const [marketHorses, setMarketHorses] = useState<any[]>([]);
  const [horseStockListings, setHorseStockListings] = useState<HorseMarketListingDto[]>([]);
  const [buySubTab, setBuySubTab] = useState<'foals' | 'p2p'>('foals');
  const [selectedFoalId, setSelectedFoalId] = useState<string | null>(null);
  const [selectedFoalBusinessId, setSelectedFoalBusinessId] = useState<string | null>(null);
  const [selectedStockListingId, setSelectedStockListingId] = useState<string | null>(null);
  const [selectedMarketHorseId, setSelectedMarketHorseId] = useState<string | null>(null);

  const canManage = stable?.canManage ?? false;
  const horses = stable?.stable?.horses ?? [];
  const selected = horses.find((h) => h.id === selectedHorseId);
  const horseSellers = horseBusinesses.filter((business) => business.availableHorseCount > 0);

  const loadMarketHorses = async () => {
    try {
      const [marketRes, stockRes] = await Promise.all([
        horseRaceApi.listMarketHorses(),
        horseRaceApi.listHorseMarketListings(),
      ]);
      setMarketHorses(marketRes.data.horses);
      setHorseStockListings(stockRes.data.listings);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (tab === 'buy') {
      loadMarketHorses();
    }
  }, [tab]);

  useEffect(() => {
    if (!open) setSelectedHorseId(null);
  }, [open]);

  const doSell = async () => {
    if (!selected) return;
    const price = parseInt(salePriceInput, 10);
    if (isNaN(price) || price <= 0) {
      toast.error('Prix invalide.');
      return;
    }
    try {
      setBusy(true);
      await horseRaceApi.sellHorse(selected.id, { price });
      toast.success('Cheval mis en vente !');
      setSalePriceInput('');
      await onUpdated();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const doCancelSell = async () => {
    if (!selected) return;
    try {
      setBusy(true);
      await horseRaceApi.cancelSellHorse(selected.id);
      toast.success('Vente annulée.');
      await onUpdated();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async (count: number) => {
    if (!selected) return;
    try {
      setBusy(true);
      await horseRaceApi.registerHorse(selected.id, count);
      toast.success(`${count} inscription(s) ajoutée(s).`);
      await onUpdated();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };
  const doTrain = async (stat: 'speed' | 'stamina' | 'consistency', businessId: string) => {
    if (!selected) return;
    try {
      setBusy(true);
      await horseRaceApi.trainHorse(selected.id, stat, businessId);
      toast.success(`+${config.HORSE_TRAIN_INC} ${stat}`);
      setBusinessPicker(null);
      await onUpdated();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };
  const doDope = async () => {
    if (!selected) return;
    try {
      setBusy(true);
      await horseRaceApi.dopeHorse(selected.id);
      toast.success('Dopage administré. Pas vu pas pris…');
      await onUpdated();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };
  const doRetire = async () => {
    if (!selected) return;
    if (!confirm(`Vendre/retirer ${selected.name} ? Remboursement: ${formatMoney(Math.floor(config.HORSE_BUY_COST * 0.3))}`)) return;
    try {
      setBusy(true);
      await horseRaceApi.retireHorse(selected.id);
      toast.success('Cheval retiré.');
      setSelectedHorseId(null);
      await onUpdated();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };
  const doBuy = async (businessId: string) => {
    if (newHorseName.trim().length < 2) {
      toast.error('Nom invalide.');
      return;
    }
    try {
      setBusy(true);
      await horseRaceApi.buyHorse({ name: newHorseName.trim(), businessId });
      toast.success('Nouveau cheval !');
      setNewHorseName('');
      setBusinessPicker(null);
      await onUpdated();
      setTab('horses');
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };
  const doBreed = async () => {
    if (!breedH1 || !breedH2 || breedH1 === breedH2) {
      toast.error('Sélectionnez deux chevaux distincts.');
      return;
    }
    if (foalName.trim().length < 2) {
      toast.error('Nom du poulain invalide.');
      return;
    }
    try {
      setBusy(true);
      await horseRaceApi.breed({ horse1Id: breedH1, horse2Id: breedH2, foalName: foalName.trim() });
      toast.success('Un poulain est né !');
      setFoalName('');
      setBreedH1('');
      setBreedH2('');
      await onUpdated();
      setTab('horses');
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppModal open={open} onClose={onClose} tone="green" size="xl">
        <AppModal.Header
          icon={<Building2 />}
          tone="green"
          title={stable?.stable?.name ?? 'Mon écurie'}
          subtitle={stable?.stable
            ? `${stable.stable.totalWins} victoires · ${stable.stable.totalRaces} courses · Réputation ${stable.stable.reputation}`
            : undefined}
        />
        <div className="grid h-[530px]" style={{ gridTemplateColumns: '190px 1fr', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <AppModal.SidebarNav>
            <AppModal.Row
              icon={<Sparkles />}
              tone="green"
              title="Mes chevaux"
              sub={`${horses.length} cheval${horses.length !== 1 ? 'x' : ''}`}
              active={tab === 'horses'}
              onClick={() => setTab('horses')}
              chevron
            />
            {canManage && (
              <AppModal.Row
                icon={<Plus />}
                tone="cyan"
                title="Acheter"
                sub={formatMoney(config.HORSE_BUY_COST)}
                active={tab === 'buy'}
                onClick={() => setTab('buy')}
                chevron
              />
            )}
            {canManage && (
              <AppModal.Row
                icon={<Dna />}
                tone="pink"
                title="Élevage"
                sub={formatMoney(config.BREED_COST)}
                active={tab === 'breed'}
                onClick={() => setTab('breed')}
                chevron
              />
            )}
            <div className="mt-3 px-1 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="rounded-lg px-2 py-2 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Solde</p>
                <p className="text-[13px] font-semibold text-amber-200">{formatMoney(userMoney)}</p>
              </div>
            </div>
          </AppModal.SidebarNav>

          <AppModal.SidebarContent className="overflow-hidden p-0">
            {tab === 'horses' && (
              <div className="grid h-full" style={{ gridTemplateColumns: '1fr 260px' }}>
                <div className="overflow-y-auto p-3 space-y-1.5" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                  {horses.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                      <span className="text-4xl">🐴</span>
                      <p className="text-sm text-muted-foreground">Pas encore de chevaux.</p>
                      <button type="button" onClick={() => setTab('buy')} className="text-[12.5px] font-medium text-emerald-400 hover:underline">
                        Acheter un premier cheval →
                      </button>
                    </div>
                  ) : horses.map((h) => (
                    <HorseCard
                      key={h.id}
                      horse={h}
                      onSelect={() => setSelectedHorseId(h.id)}
                      selected={selectedHorseId === h.id}
                      onOpenAtelier={canManage ? () => onOpenAtelier(h) : undefined}
                    />
                  ))}
                </div>

                <div className="overflow-y-auto p-3">
                  {selected ? (() => {
                    const winRate = selected.races > 0 ? Math.round((selected.wins / selected.races) * 100) : 0;
                    const formBadges = getHorseFormBadges(selected.id, selected.wins, selected.podiums, selected.races);
                    const milestones = getHorseMilestones(selected.wins, selected.races, selected.earnings);
                    const rating = computeHorseRating(selected.geneSpeed + selected.trainSpeed, selected.geneStamina + selected.trainStamina, selected.geneConsistency + selected.trainConsistency);
                    return (
                      <div className="space-y-2.5">
                        {/* Hero: avatar + name + rating */}
                        <div className="overflow-hidden rounded-xl" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.13), transparent 70%), #050e09', border: '1px solid rgba(74,222,128,0.14)' }}>
                          <div className="flex h-[130px] items-center justify-center">
                            <HorseAvatar {...selected} animated className="h-full" />
                          </div>
                          <div className="px-3 pb-3 text-center">
                            <p className="text-[14px] font-bold leading-tight">{selected.name}</p>
                            <div className="mt-1 flex flex-wrap justify-center gap-1">
                              <AgeBadge age={selected.ageYears} />
                              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
                              </span>
                            </div>
                            {milestones.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                                {milestones.map((m) => (
                                  <span key={m} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[8.5px]">{m}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Career stats grid */}
                        <div className="grid grid-cols-3 gap-1">
                          {([
                            { label: 'Courses', value: selected.races, cls: 'text-white' },
                            { label: 'Victoires', value: selected.wins, cls: 'text-amber-300' },
                            { label: 'Podiums', value: selected.podiums, cls: 'text-slate-300' },
                          ] as const).map((s) => (
                            <div key={s.label} className="rounded-lg py-2 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <p className={cn('text-[16px] font-bold tabular-nums', s.cls)}>{s.value}</p>
                              <p className="text-[8.5px] uppercase tracking-wide text-muted-foreground/60">{s.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <div className="rounded-lg py-2 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p className="text-[14px] font-bold tabular-nums text-emerald-300">{winRate}%</p>
                            <p className="text-[8.5px] uppercase tracking-wide text-muted-foreground/60">Taux victoire</p>
                          </div>
                          <div className="rounded-lg py-2 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p className="text-[12px] font-bold tabular-nums text-emerald-300">{formatMoney(selected.earnings)}</p>
                            <p className="text-[8.5px] uppercase tracking-wide text-muted-foreground/60">Gains totaux</p>
                          </div>
                        </div>

                        {/* Form badges */}
                        {formBadges.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[9px] uppercase tracking-wider text-muted-foreground/50">Forme récente</p>
                            <div className="flex gap-1">
                              {formBadges.map((f, i) => (
                                <span key={i} className={cn(
                                  'flex h-6 w-6 items-center justify-center rounded text-[9.5px] font-bold',
                                  f === 'W' ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40' :
                                  f === 'P' ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40' :
                                  'bg-white/8 text-white/30 border border-white/10'
                                )}>{f}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Stats with gene / trained split */}
                        <div className="space-y-2 rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Aptitudes · <span className="text-emerald-600/80">gènes</span> + <span className="text-amber-500/70">entraînement</span></p>
                          <StatBarSplit label="Vitesse" gene={selected.geneSpeed} trained={selected.trainSpeed} />
                          <StatBarSplit label="Endurance" gene={selected.geneStamina} trained={selected.trainStamina} />
                          <StatBarSplit label="Constance" gene={selected.geneConsistency} trained={selected.trainConsistency} />
                          <p className="text-right text-[8.5px] text-muted-foreground/40">XP {selected.experience}</p>
                        </div>

                        {/* Actions */}
                        {canManage ? (
                          <div className="space-y-2">
                            <div className="space-y-1.5 rounded-lg p-2" style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)' }}>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                                Inscrire · {selected.pendingEntries} en file
                              </p>
                              <div className="flex gap-1">
                                {[1, 3, 5, 10].map((n) => (
                                  <AppModal.Button key={n} tone="green" variant="soft" size="sm" full disabled={busy || selected.ageYears < config.MIN_AGE_TO_RACE} onClick={() => doRegister(n)}>+{n}</AppModal.Button>
                                ))}
                              </div>
                              {selected.ageYears < config.MIN_AGE_TO_RACE && <p className="text-[10px] text-rose-300">Trop jeune pour courir.</p>}
                            </div>

                            <div className="space-y-1.5 rounded-lg p-2" style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)' }}>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                                Entraîner · {formatMoney(config.HORSE_TRAIN_COST)} / +{config.HORSE_TRAIN_INC}
                              </p>
                              <div className="grid grid-cols-3 gap-1">
                                <AppModal.Button tone="blue" variant="soft" size="sm" full disabled={busy || selected.trainSpeed >= config.HORSE_TRAIN_CAP || horseBusinesses.length === 0} onClick={() => setBusinessPicker({ action: 'train', stat: 'speed' })}>🏃 {selected.trainSpeed.toFixed(1)}</AppModal.Button>
                                <AppModal.Button tone="blue" variant="soft" size="sm" full disabled={busy || selected.trainStamina >= config.HORSE_TRAIN_CAP || horseBusinesses.length === 0} onClick={() => setBusinessPicker({ action: 'train', stat: 'stamina' })}>🫁 {selected.trainStamina.toFixed(1)}</AppModal.Button>
                                <AppModal.Button tone="blue" variant="soft" size="sm" full disabled={busy || selected.trainConsistency >= config.HORSE_TRAIN_CAP || horseBusinesses.length === 0} onClick={() => setBusinessPicker({ action: 'train', stat: 'consistency' })}>🎯 {selected.trainConsistency.toFixed(1)}</AppModal.Button>
                              </div>
                            </div>

                            <button type="button" onClick={() => onOpenAtelier(selected)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-2 text-[12px] font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20">
                              <Palette className="h-3.5 w-3.5" /> Atelier cosmétique
                            </button>

                            <div className="space-y-1.5 rounded-lg p-2" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)' }}>
                              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                                <Skull className="h-3 w-3" /> Dopage · {formatMoney(config.DOPE_COST)}
                              </p>
                              <p className="text-[9.5px] text-rose-200/60">+{config.DOPE_SPEED_BOOST} vit, +{config.DOPE_STAMINA_BOOST} end. · {Math.round(config.DOPE_CATCH_PCT * 100)}% risque confiscation.</p>
                              <AppModal.Button tone="red" variant="soft" size="sm" full disabled={busy || selected.dopedForCycle != null} onClick={doDope}>
                                {selected.dopedForCycle != null ? '💉 Déjà dopé' : 'Doper pour la prochaine'}
                              </AppModal.Button>
                            </div>

                            <div className="space-y-1.5 rounded-lg p-2" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)' }}>
                              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
                                <Tag className="h-3 w-3" /> Marché entre joueurs
                              </p>
                              {selected.isForSale ? (
                                <div className="space-y-1.5">
                                  <p className="text-[10.5px] text-purple-200">En vente pour <span className="font-bold text-amber-300">{formatMoney(selected.salePrice ?? 0)}</span></p>
                                  <AppModal.Button tone="aura" variant="soft" size="sm" full disabled={busy} onClick={doCancelSell}>
                                    Retirer de la vente
                                  </AppModal.Button>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex gap-1">
                                    <input
                                      type="number"
                                      placeholder="Prix de vente (€)"
                                      value={salePriceInput}
                                      onChange={(e) => setSalePriceInput(e.target.value)}
                                      className="flex-1 rounded border border-purple-500/30 bg-black/40 px-2 py-1 text-[11px] font-semibold text-white focus:outline-none focus:border-purple-500"
                                      style={{ minWidth: 0 }}
                                    />
                                    <AppModal.Button tone="aura" variant="solid" size="sm" disabled={busy} onClick={doSell}>
                                      Vendre
                                    </AppModal.Button>
                                  </div>
                                  <p className="text-[8.5px] text-muted-foreground/60">Le cheval restera dans votre écurie jusqu&apos;à son achat.</p>
                                </div>
                              )}
                            </div>

                            <AppModal.Button variant="ghost" size="sm" full style={{ color: 'var(--muted-foreground)', fontSize: 11 }} disabled={busy} onClick={doRetire}>
                              Vendre · rembours. {formatMoney(Math.floor(config.HORSE_BUY_COST * 0.3))}
                            </AppModal.Button>
                          </div>
                        ) : (
                          <div className="rounded-lg p-3 text-center text-[11px] text-muted-foreground" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            Seul le chef et les officiers peuvent gérer l&apos;écurie.
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                      <Sparkles className="h-7 w-7 opacity-15" />
                      <p className="text-[12px] leading-snug">Sélectionnez un cheval<br />pour son profil complet</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'buy' && (
              <div className="flex h-full flex-col">
                {/* Internal sub-tabs for Poulains (Foals) vs Marché (Market) */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-black/20">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setBuySubTab('foals'); setSelectedFoalId(null); setSelectedMarketHorseId(null); setSelectedStockListingId(null); }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-[12px] font-bold transition flex items-center gap-1.5',
                        buySubTab === 'foals'
                          ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                          : 'text-muted-foreground hover:text-white hover:bg-white/5'
                      )}
                    >
                      🐎 Stock de l&apos;haras
                    </button>
                    <button
                      type="button"
                      onClick={() => { setBuySubTab('p2p'); setSelectedFoalId(null); setSelectedMarketHorseId(null); setSelectedStockListingId(null); }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-[12px] font-bold transition flex items-center gap-1.5',
                        buySubTab === 'p2p'
                          ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                          : 'text-muted-foreground hover:text-white hover:bg-white/5'
                      )}
                    >
                      🤝 Marché d&apos;occasion
                    </button>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Votre solde: <span className="font-bold text-emerald-300">{formatMoney(userMoney)}</span>
                  </div>
                </div>

                {/* Main Split Pane */}
                <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                  {/* Left Column: Listings */}
                  <div className="w-[320px] border-r border-white/10 overflow-y-auto p-3 space-y-2 bg-black/10">
                    {buySubTab === 'foals' ? (
                      (() => {
                        if (horseStockListings.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                              <Sparkles className="h-6 w-6 opacity-20" />
                              <p className="text-[11.5px]">Aucune offre de chevaux disponible sur le marché pour le moment.</p>
                            </div>
                          );
                        }

                        return horseStockListings.map((listing) => {
                          const isSel = selectedStockListingId === listing.id;
                          return (
                            <div
                              key={listing.id}
                              onClick={() => setSelectedStockListingId(listing.id)}
                              className={cn(
                                'flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition border',
                                isSel
                                  ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md shadow-cyan-500/5'
                                  : 'bg-white/3 border-white/5 hover:bg-white/6 hover:border-white/10'
                              )}
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/40 border border-white/10 text-[22px]">
                                🐎
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold text-white truncate">{listing.businessName}</p>
                                <p className="text-[9.5px] text-cyan-300 truncate">Vendeur: {listing.sellerName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[9.5px] text-amber-200 font-semibold">{listing.quantity} dispo</span>
                                  <span className="text-[8.5px] text-emerald-300 font-bold">· {formatMoney(listing.unitPrice)}/cheval</span>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    ) : (
                      (() => {
                        if (marketHorses.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                              <Sparkles className="h-6 w-6 opacity-20" />
                              <p className="text-[11.5px]">Aucun cheval d&apos;occasion n&apos;est mis en vente par les écuries.</p>
                            </div>
                          );
                        }

                        return marketHorses.map((h) => {
                          const isSel = selectedMarketHorseId === h.id;
                          const stars = computeHorseRating(h.geneSpeed + h.trainSpeed, h.geneStamina + h.trainStamina, h.geneConsistency + h.trainConsistency);
                          return (
                            <div
                              key={h.id}
                              onClick={() => {
                                setSelectedMarketHorseId(h.id);
                              }}
                              className={cn(
                                'flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition border',
                                isSel
                                  ? 'bg-purple-500/10 border-purple-500/50 shadow-md shadow-purple-500/5'
                                  : 'bg-white/3 border-white/5 hover:bg-white/6 hover:border-white/10'
                              )}
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/40 border border-white/10">
                                <HorseAvatar
                                  bodyColor={h.bodyColor}
                                  pattern={h.pattern}
                                  patternColor={h.patternColor}
                                  mane={h.mane}
                                  silks1={h.silks1}
                                  silks2={h.silks2}
                                  silksDesign={h.silksDesign}
                                  helmet={h.helmet}
                                  accessory={h.accessory}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold text-white truncate">{h.name}</p>
                                <p className="text-[9.5px] text-purple-300 truncate">Écurie: {h.stableName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[9.5px] text-amber-200 font-semibold">{stars.toFixed(1)} ⭐</span>
                                  <span className="text-[8.5px] text-emerald-300 font-bold">· {formatMoney(h.salePrice)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>

                  {/* Right Column: Detailed View & Purchase Form */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {buySubTab === 'foals' ? (
                      (() => {
                        const listing = horseStockListings.find((l) => l.id === selectedStockListingId);

                        if (!listing) {
                          return (
                            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground gap-2 py-12">
                              <Sparkles className="h-8 w-8 opacity-15" />
                              <p className="text-[12px]">Sélectionnez une offre sur la gauche<br />pour acheter un cheval.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            {/* Listing Preview */}
                            <div className="flex items-center gap-4 p-3 rounded-lg border border-white/5 bg-white/2">
                              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-black/50 border border-white/10 shadow-inner text-[32px]">
                                🐎
                              </div>
                              <div>
                                <h3 className="text-[14px] font-bold text-white">{listing.businessName}</h3>
                                <p className="text-[11px] text-muted-foreground">Vendeur: <span className="text-cyan-300 font-semibold">{listing.sellerName}</span></p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{listing.quantity} cheval(aux) disponible(s) · Gènes aléatoires à l&apos;achat</p>
                              </div>
                            </div>

                            {/* Price Info */}
                            <div className="space-y-1.5 rounded-lg p-3 bg-white/2 border border-white/5">
                              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold">Détails de l&apos;offre</p>
                              <div className="flex justify-between text-[12px]">
                                <span className="text-muted-foreground">Prix unitaire</span>
                                <span className="font-bold text-emerald-300">{formatMoney(listing.unitPrice)}</span>
                              </div>
                              <div className="flex justify-between text-[12px]">
                                <span className="text-muted-foreground">Stock disponible</span>
                                <span className="font-bold text-white">{listing.quantity}</span>
                              </div>
                            </div>

                            {/* Purchase Name Input & Action */}
                            <div className="space-y-3 p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                              <AppModal.Field
                                label="Donner un nom à votre cheval"
                                value={newHorseName}
                                onChange={setNewHorseName}
                                placeholder="Ex: Éclair du Nord"
                              />

                              <AppModal.Button
                                tone="cyan"
                                variant="solid"
                                full
                                size="md"
                                disabled={busy || userMoney < listing.unitPrice || newHorseName.trim().length < 2}
                                onClick={async () => {
                                  if (newHorseName.trim().length < 2) {
                                    toast.error('Nom trop court.');
                                    return;
                                  }
                                  try {
                                    setBusy(true);
                                    await horseRaceApi.buyHorse({
                                      name: newHorseName.trim(),
                                      listingId: listing.id,
                                    });
                                    toast.success('Cheval acheté avec succès !');
                                    setNewHorseName('');
                                    setSelectedStockListingId(null);
                                    await loadMarketHorses();
                                    await onUpdated();
                                    setTab('horses');
                                  } catch (err) {
                                    const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
                                    toast.error(m);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                {busy ? 'Achat en cours…' : `Acheter pour ${formatMoney(listing.unitPrice)}`}
                              </AppModal.Button>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      (() => {
                        const h = marketHorses.find((x) => x.id === selectedMarketHorseId);

                        if (!h) {
                          return (
                            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground gap-2 py-12">
                              <Sparkles className="h-8 w-8 opacity-15" />
                              <p className="text-[12px]">Sélectionnez un cheval sur la gauche<br />pour afficher son profil complet.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            {/* Horse Preview */}
                            <div className="flex items-center gap-4 p-3 rounded-lg border border-white/5 bg-white/2">
                              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-black/50 border border-white/10 shadow-inner">
                                <HorseAvatar
                                  bodyColor={h.bodyColor}
                                  pattern={h.pattern}
                                  patternColor={h.patternColor}
                                  mane={h.mane}
                                  silks1={h.silks1}
                                  silks2={h.silks2}
                                  silksDesign={h.silksDesign}
                                  helmet={h.helmet}
                                  accessory={h.accessory}
                                />
                              </div>
                              <div>
                                <h3 className="text-[14px] font-bold text-white">{h.name}</h3>
                                <p className="text-[11px] text-muted-foreground">Écurie d&apos;origine: <span className="text-purple-300 font-semibold">{h.stableName}</span></p>
                                <div className="flex gap-2 text-[9.5px] text-muted-foreground/60 mt-1">
                                  <span>🏁 {h.races} courses</span>
                                  <span>🏆 {h.wins} victoires</span>
                                  <span>💰 {formatMoney(h.earnings)} gagnés</span>
                                </div>
                              </div>
                            </div>

                            {/* Gene & Train Stats */}
                            <div className="space-y-2.5 rounded-lg p-3 bg-white/2 border border-white/5">
                              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold">Performances · Gènes + Entraînement</p>
                              <div className="space-y-2">
                                <StatBarSplit label="Vitesse" gene={h.geneSpeed} trained={h.trainSpeed} />
                                <StatBarSplit label="Endurance" gene={h.geneStamina} trained={h.trainStamina} />
                                <StatBarSplit label="Constance" gene={h.geneConsistency} trained={h.trainConsistency} />
                              </div>
                            </div>

                            {/* P2P Purchase Action */}
                            <div className="space-y-3 p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                              <div className="text-center pb-1">
                                <p className="text-[11.5px] text-muted-foreground">Ce cheval est vendu directement par son écurie propriétaire.</p>
                                <p className="text-[16px] font-bold text-purple-300 mt-1">{formatMoney(h.salePrice)}</p>
                              </div>

                              <AppModal.Button
                                tone="aura"
                                variant="solid"
                                full
                                size="md"
                                disabled={busy || userMoney < h.salePrice}
                                onClick={async () => {
                                  if (!confirm(`Confirmer l'achat de ${h.name} pour ${formatMoney(h.salePrice)} ?`)) return;
                                  try {
                                    setBusy(true);
                                    await horseRaceApi.buyHorse({
                                      horseId: h.id,
                                    });
                                    toast.success(`${h.name} a rejoint votre écurie !`);
                                    setSelectedMarketHorseId(null);
                                    await onUpdated();
                                    await loadMarketHorses();
                                    setTab('horses');
                                  } catch (err) {
                                    const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
                                    toast.error(m);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                {busy ? 'Transfert en cours…' : `Acheter le cheval pour ${formatMoney(h.salePrice)}`}
                              </AppModal.Button>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'breed' && (
              <div className="flex h-full items-center justify-center p-6">
                <div className="w-full max-w-[340px] space-y-4">
                  <div className="text-center">
                    <p className="text-2xl">🧬</p>
                    <p className="mt-1 text-[14px] font-semibold">Croisement</p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      Le poulain hérite des gènes de ses parents · Min. {config.MIN_AGE_TO_BREED} ans · <span className="font-semibold text-amber-200">{formatMoney(config.BREED_COST)}</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Parent 1</label>
                      <Select value={breedH1} onValueChange={setBreedH1}>
                        <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                        <SelectContent>
                          {horses.filter((h) => h.ageYears >= config.MIN_AGE_TO_BREED).map((h) => (
                            <SelectItem key={h.id} value={h.id}>{h.name} ({h.ageYears.toFixed(1)}a)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Parent 2</label>
                      <Select value={breedH2} onValueChange={setBreedH2}>
                        <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                        <SelectContent>
                          {horses.filter((h) => h.ageYears >= config.MIN_AGE_TO_BREED && h.id !== breedH1).map((h) => (
                            <SelectItem key={h.id} value={h.id}>{h.name} ({h.ageYears.toFixed(1)}a)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <AppModal.Field label="Nom du poulain" value={foalName} onChange={setFoalName} placeholder="Ex: Tempête" />
                  {userMoney < config.BREED_COST && (
                    <p className="text-center text-[11.5px] text-rose-300">Solde insuffisant.</p>
                  )}
                  <AppModal.Button tone="pink" variant="solid" full size="lg"
                    disabled={busy || userMoney < config.BREED_COST || !breedH1 || !breedH2 || foalName.trim().length < 2}
                    onClick={doBreed}
                  >
                    {busy ? 'Croisement…' : `Croiser pour ${formatMoney(config.BREED_COST)}`}
                  </AppModal.Button>
                </div>
              </div>
            )}
          </AppModal.SidebarContent>
        </div>
      </AppModal>
      <BusinessSelectionModal
        open={businessPicker !== null}
        onClose={() => setBusinessPicker(null)}
        title={businessPicker?.action === 'buy' ? 'Choisir le haras vendeur' : 'Choisir le haras entraineur'}
        subtitle={businessPicker?.action === 'buy'
          ? 'Le cheval sera retire du stock du haras selectionne.'
          : `Le haras encaisse ${formatMoney(config.HORSE_TRAIN_COST)} et paie ${formatMoney(config.HORSE_TRAIN_BASELINE_COST)} de cout technique.`}
        businesses={businessPicker?.action === 'buy' ? horseSellers : horseBusinesses}
        confirmLabel={businessPicker?.action === 'buy' ? 'Acheter via ce haras' : 'Confier l entrainement'}
        emptyLabel={businessPicker?.action === 'buy' ? 'Aucun haras avec cheval disponible.' : 'Aucun haras disponible.'}
        renderMeta={(business) => (
          <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
            <span>{business.availableHorseCount} cheval{business.availableHorseCount !== 1 ? 'x' : ''}</span>
            {business.availableHorseRating != null && <span>stock {business.availableHorseRating.toFixed(1)}/5</span>}
            <span>{business.activeProductionCount}/{business.productionSlots} prod.</span>
          </div>
        )}
        onConfirm={(business) => {
          if (businessPicker?.action === 'buy') {
            void doBuy(business.id);
            return;
          }
          if (businessPicker?.action === 'train') {
            void doTrain(businessPicker.stat, business.id);
          }
        }}
      />
    </>
  );
}

// =====================================================================
// Explore stables modal
// =====================================================================
function ExploreStablesModal({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [stables, setStables] = useState<PublicStableDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PublicStableDto | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    horseRaceApi.listStables()
      .then((r) => setStables(r.data.stables))
      .catch(() => toast.error('Impossible de charger les écuries.'))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <AppModal open={open} onClose={onClose} tone="cyan" size="lg">
      {selected ? (
        <AppModal.Header
          iconSlot={
            <button type="button" onClick={() => setSelected(null)}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
              style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee' }}
            >
              ←
            </button>
          }
          tone="cyan"
          title={selected.name}
          subtitle={`${selected.clanName} · Réputation ${selected.reputation}`}
        />
      ) : (
        <AppModal.Header icon={<Users />} tone="cyan" title="Écuries de la communauté" subtitle="Triées par réputation." />
      )}
      <AppModal.Divider />

      {selected ? (
        <AppModal.Body scrollable maxHeight="60vh">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Victoires', value: selected.totalWins, color: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)', text: 'text-amber-200' },
                { label: 'Podiums', value: selected.totalPodiums, color: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', text: 'text-slate-300' },
                { label: 'Courses', value: selected.totalRaces, color: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.2)', text: 'text-cyan-300' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl py-3 text-center" style={{ background: stat.color, border: `1px solid ${stat.border}` }}>
                  <p className={cn('text-2xl font-bold tabular-nums', stat.text)}>{stat.value}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/60">{stat.label}</p>
                </div>
              ))}
            </div>
            {selected.description && <p className="text-[12.5px] text-muted-foreground">{selected.description}</p>}
            <div className="space-y-1.5">
              <AppModal.SectionTitle>Top chevaux ({selected.horseCount} au total)</AppModal.SectionTitle>
              {selected.topHorses.map((h) => (
                <div key={h.id} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
                  <div className="h-12 w-16 shrink-0">
                    <HorseAvatar {...h} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold">{h.name}</p>
                    <p className="text-[10.5px] text-muted-foreground">{h.ageYears.toFixed(1)} ans · {h.races} courses</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-bold text-amber-200">{h.wins} V</p>
                    <p className="text-[10px] text-muted-foreground">{h.podiums} podiums</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AppModal.Body>
      ) : (
        <AppModal.Body scrollable maxHeight="60vh">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm">Chargement…</p>
            </div>
          )}
          {!loading && stables.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune écurie pour l&apos;instant.</p>
          )}
          <div className="space-y-1.5">
            {stables.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-cyan-400/25 hover:bg-white/[0.04]"
              >
                <span className="w-5 shrink-0 text-center font-mono text-[11px] text-muted-foreground/40">#{i + 1}</span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
                  🏇
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{s.name}</p>
                  <p className="text-[10.5px] text-muted-foreground">{s.clanName} · {s.horseCount} cheval{s.horseCount !== 1 ? 'x' : ''}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-bold text-amber-200">{s.totalWins} V</p>
                  <p className="text-[10px] text-muted-foreground">Rép. {s.reputation}</p>
                </div>
              </button>
            ))}
          </div>
        </AppModal.Body>
      )}
    </AppModal>
  );
}

// =====================================================================
// Standings modal
// =====================================================================
function StatChip({ label, value, max = 12 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-1">
      <span className="w-12 text-[9px] uppercase text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
        <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 text-right font-mono text-[10px] tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}
function StandingsModal({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<HorseRaceStandingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'recent' | 'top'>('recent');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    horseRaceApi.getStandings()
      .then((r) => setData(r.data))
      .catch(() => toast.error('Impossible de charger le palmarès.'))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <AppModal open={open} onClose={onClose} tone="money" size="xl">
      <AppModal.Header icon={<Medal />} tone="money" title="Palmarès" subtitle="Résultats des courses et classement des chevaux." />
      <div className="grid h-[480px]" style={{ gridTemplateColumns: '190px 1fr', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <AppModal.SidebarNav>
          <AppModal.Row icon={<History />} tone="neutral" title="Résultats" sub="Dernières courses" active={tab === 'recent'} onClick={() => setTab('recent')} chevron />
          <AppModal.Row icon={<Trophy />} tone="money" title="Top chevaux" sub="Classement général" active={tab === 'top'} onClick={() => setTab('top')} chevron />
        </AppModal.SidebarNav>

        <AppModal.SidebarContent className="overflow-y-auto p-3">
          {loading && <div className="flex h-full items-center justify-center"><p className="text-sm text-muted-foreground">Chargement…</p></div>}

          {!loading && tab === 'recent' && (
            <div className="space-y-2.5">
              {data && data.recentRaces.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucune course résolue.</p>
              )}
              {data?.recentRaces.map((r: RecentRaceDto) => (
                <div key={r.cycleIndex} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12.5px] font-bold">Course #{r.cycleIndex}</span>
                    <span className="text-[10.5px] text-muted-foreground">{r.totalBets} paris · {formatMoney(r.totalPool)}</span>
                  </div>
                  <div className="space-y-1">
                    {r.podium.map((p) => (
                      <div key={p.position} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{
                        background: p.position === 1 ? 'rgba(251,191,36,0.07)' : p.position === 2 ? 'rgba(148,163,184,0.06)' : p.position === 3 ? 'rgba(251,146,60,0.06)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${p.position === 1 ? 'rgba(251,191,36,0.18)' : p.position === 2 ? 'rgba(148,163,184,0.15)' : p.position === 3 ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.05)'}`,
                      }}>
                        <span className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                          p.position === 1 && 'bg-amber-400 text-amber-950',
                          p.position === 2 && 'bg-slate-300 text-slate-900',
                          p.position === 3 && 'bg-orange-400 text-orange-950',
                          p.position > 3 && 'bg-white/10 text-muted-foreground',
                        )}>{p.position}</span>
                        <div className="h-10 w-14 shrink-0">
                          <HorseAvatar {...{ ...p, bodyColor: p.bodyColor ?? undefined }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium">{p.name ?? 'Cheval'}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {p.isComputer ? 'Cheval IA' : `${p.stableName ?? '—'}${p.clanName ? ' · ' + p.clanName : ''}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-[10.5px] tabular-nums text-muted-foreground">{(p.finishTimeMs / 1000).toFixed(2)}s</p>
                          {p.prize > 0 && <p className="text-[11px] font-semibold text-emerald-300">+{formatMoney(p.prize)}</p>}
                        </div>
                        {p.wasCaught && <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-rose-200" style={{ background: 'rgba(248,113,113,0.2)' }}>DQ</span>}
                        {p.wasDoped && !p.wasCaught && <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-amber-200" style={{ background: 'rgba(251,146,60,0.2)' }}>D</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && tab === 'top' && (
            <div className="space-y-1.5">
              {data && data.topHorses.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucun cheval qualifié.</p>
              )}
              {data?.topHorses.map((h: TopHorseDto, i: number) => (
                <div key={h.id} className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <span className="w-6 shrink-0 text-center font-mono text-[11px] font-bold text-muted-foreground/40">
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
                  </span>
                  <div className="h-12 w-16 shrink-0">
                    <HorseAvatar {...h} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold">{h.name}</p>
                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] text-muted-foreground" style={{ background: 'rgba(255,255,255,0.06)' }}>{h.ageYears.toFixed(1)} ans</span>
                    </div>
                    <p className="truncate text-[10.5px] text-muted-foreground">
                      {h.stableName ?? '—'}{h.clanName ? ' · ' + h.clanName : ''}
                    </p>
                    <div className="mt-1 space-y-0.5">
                      <StatChip label="VIT" value={h.stats.speed} />
                      <StatChip label="END" value={h.stats.stamina} />
                      <StatChip label="CST" value={h.stats.consistency} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14px] font-bold text-amber-200">{h.wins} V</p>
                    <p className="text-[10px] text-muted-foreground">{h.podiums} P · {h.races} C</p>
                    <p className="text-[11px] font-semibold text-emerald-300">{formatMoney(h.earnings)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AppModal.SidebarContent>
      </div>
    </AppModal>
  );
}

// =====================================================================
// Confiscation notification
// =====================================================================
function ConfiscationModal({
  message, onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  return (
    <AppModal open={!!message} onClose={onClose} tone="red" size="sm" accent="#f87171">
      <AppModal.Body>
        <div className="flex flex-col items-center gap-3 px-2 pb-1 pt-6 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', boxShadow: '0 0 32px rgba(248,113,113,0.18)' }}
          >
            <ShieldAlert className="h-7 w-7 text-rose-400" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground">Contrôle positif</p>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{message}</p>
          </div>
          <p className="rounded-lg px-3 py-2 text-[11.5px] text-rose-200/70" style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.18)' }}>
            Les commissaires ont saisi votre cheval. Il n&apos;est plus disponible dans votre écurie.
          </p>
        </div>
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button tone="red" variant="solid" full onClick={onClose}>J&apos;ai compris</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
  );
}

// =====================================================================
// InlineBetPanel — sits in the right column, full betting flow inline
// =====================================================================
function InlineBetPanel({
  state,
  config,
  userMoney,
  favorite,
  onPlaced,
}: {
  state: HorseRaceStateResponse | null;
  config: HorseRaceConfig;
  userMoney: number;
  favorite: HorseRaceLineupEntry | null;
  onPlaced: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState(500);
  const [busy, setBusy] = useState(false);

  const myBetKeys = useMemo(() => new Set(state?.myBets.map((b) => b.horseId) ?? []), [state?.myBets]);
  const myBetsCount = state?.myBets.length ?? 0;
  const totalCommitted = state?.myBets.reduce((s, b) => s + b.amount, 0) ?? 0;
  const remainingTotalCap = Math.max(0, config.MAX_BET_TOTAL - totalCommitted);
  const isOpenForBets = state?.phase === 'betting';
  const canAddMore = myBetsCount < config.MAX_BETS_PER_USER;
  const sel = state?.lineup.find((e) => e.betKey === selected) ?? null;
  const potential = sel?.odds ? Math.floor(amount * sel.odds) : 0;
  const canPlace = !!sel && isOpenForBets && canAddMore && !myBetKeys.has(sel.betKey) && amount > 0 && amount <= userMoney && amount <= remainingTotalCap && !busy;
  const presets = [100, 500, 1000, 5000, 10000];

  useEffect(() => {
    if (!isOpenForBets) setSelected(null);
  }, [isOpenForBets]);

  const submit = async () => {
    if (!state || !sel) return;
    try {
      setBusy(true);
      await horseRaceApi.placeBet({ cycleIndex: state.cycleIndex, horseId: sel.betKey, amount });
      toast.success('Pari placé.');
      setSelected(null);
      setAmount(500);
      await onPlaced();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const cancelBet = async (betId: string) => {
    try {
      setBusy(true);
      await horseRaceApi.cancelBet(betId);
      toast.success('Pari annulé.');
      await onPlaced();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Race metrics */}
      {state && (
        <div className="grid grid-cols-2 gap-px border-b border-border/30" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="px-2.5 py-2">
            <p className="text-[8.5px] uppercase tracking-wider text-muted-foreground/55">Cagnotte</p>
            <p className="font-mono text-[13px] font-bold text-emerald-300 tabular-nums">{formatMoney(state.totalAmount)}</p>
          </div>
          <div className="px-2.5 py-2">
            <p className="text-[8.5px] uppercase tracking-wider text-muted-foreground/55">1er Prix</p>
            <p className="font-mono text-[13px] font-bold text-amber-300 tabular-nums">{formatMoney(config.PRIZE_BASE_1ST + Math.floor(state.totalAmount * config.PRIZE_POOL_1ST_PCT))}</p>
          </div>
          <div className="px-2.5 py-1.5">
            <p className="text-[8.5px] uppercase tracking-wider text-muted-foreground/55">Parieurs</p>
            <p className="text-[12px] font-bold tabular-nums">{state.totalBets}</p>
          </div>
          {favorite && (
            <div className="px-2.5 py-1.5">
              <p className="text-[8.5px] uppercase tracking-wider text-muted-foreground/55">Favori</p>
              <p className="truncate text-[11px] font-semibold">{favorite.name} <span className="text-amber-300/70">{favorite.odds?.toFixed(2)}x</span></p>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <Tag className="h-3.5 w-3.5 text-emerald-300" />
        <span className="text-[13px] font-semibold">Paris</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {myBetsCount}/{config.MAX_BETS_PER_USER} · plafond {formatMoney(remainingTotalCap)}
        </span>
      </div>

      {/* Entrants list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <p className="mb-1 px-1 text-[9.5px] uppercase tracking-wider text-muted-foreground">Choisis ton cheval</p>
        <div className="flex flex-col gap-0.5">
          {state?.lineup.map((e) => {
            const isSel = selected === e.betKey;
            const isMine = myBetKeys.has(e.betKey);
            return (
              <button
                key={e.betKey}
                type="button"
                onClick={() => !isMine && isOpenForBets && setSelected(e.betKey)}
                disabled={isMine || !isOpenForBets}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-1.5 py-1 text-left transition',
                  isSel
                    ? 'border-amber-400/50 bg-amber-400/5'
                    : isMine
                    ? 'cursor-default border-emerald-500/30 bg-emerald-500/5'
                    : 'border-transparent bg-card/40 hover:border-white/10 hover:bg-card/60',
                  !isOpenForBets && !isMine && 'opacity-60',
                )}
              >
                <span className="w-3 text-center font-mono text-[9.5px] text-muted-foreground">{e.lane}</span>
                <div className="h-6 w-9 shrink-0 overflow-hidden rounded-sm bg-muted/30">
                  <HorseAvatar {...e} showJockey={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold">
                    {e.name}
                    {!e.isComputer && <span className="ml-1 text-emerald-300">●</span>}
                  </div>
                  <div className="truncate text-[9px] text-muted-foreground">
                    {e.clanName ?? e.stableName ?? 'IA · Pari Mutuel'}
                  </div>
                </div>
                <span
                  className={cn(
                    'font-mono text-[11px] font-bold',
                    isMine ? 'text-emerald-300' : isSel ? 'text-amber-200' : 'text-amber-200/80',
                  )}
                >
                  {isMine ? '✓' : e.odds != null ? `${e.odds.toFixed(2)}x` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bet form */}
      <div className="border-t border-border/40 bg-card/30 p-2.5">
        {sel ? (
          <>
            <div
              className="mb-2 flex items-center gap-2 rounded-lg p-1.5"
              style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}
            >
              <div className="h-9 w-14 shrink-0 overflow-hidden rounded-md bg-emerald-950/40">
                <HorseAvatar {...sel} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold">{sel.name}</div>
                <div className="text-[9.5px] text-muted-foreground">cote actuelle</div>
              </div>
              <div className="font-mono text-[16px] font-extrabold text-amber-200">
                {sel.odds != null ? `${sel.odds.toFixed(2)}x` : '—'}
              </div>
            </div>

            <div className="mb-1.5 grid grid-cols-3 gap-1">
              {presets.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  disabled={!isOpenForBets || !canAddMore}
                  className={cn(
                    'rounded-md py-1 text-[10.5px] font-semibold transition',
                    amount === v ? 'border border-amber-400/40 bg-amber-400/15 text-amber-200' : 'border border-white/8 bg-white/[0.04] text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v >= 1000 ? `${v / 1000}k` : v}$
                </button>
              ))}
            </div>
            <div className="mb-1.5 flex gap-1.5">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                disabled={!isOpenForBets || !canAddMore}
                className="h-7 flex-1 text-[12px]"
              />
              <button
                type="button"
                onClick={() => setAmount(Math.min(userMoney, remainingTotalCap))}
                disabled={!isOpenForBets || !canAddMore}
                className="rounded-md border border-white/8 bg-white/[0.04] px-2 text-[10.5px] font-semibold text-muted-foreground transition hover:text-foreground"
              >
                Max
              </button>
            </div>

            <div
              className="mb-2 flex items-center justify-between rounded-md px-2 py-1.5"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.22)' }}
            >
              <span className="text-[10.5px] text-muted-foreground">Gain potentiel</span>
              <span className="font-mono text-[13px] font-bold text-emerald-300">{formatMoney(potential)}</span>
            </div>

            <Button
              size="sm"
              className="w-full"
              disabled={!canPlace}
              onClick={submit}
            >
              {!isOpenForBets
                ? 'Paris fermés'
                : myBetKeys.has(sel.betKey)
                ? 'Déjà parié'
                : `Confirmer · ${formatMoney(amount)}`}
            </Button>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-muted-foreground">
            <Tag className="mx-auto h-4 w-4 opacity-30" />
            <p className="mt-1 text-[10.5px]">
              {isOpenForBets ? <>Sélectionne un cheval<br />pour parier.</> : 'Paris fermés pour cette course.'}
            </p>
          </div>
        )}

        {state && state.myBets.length > 0 && (
          <div className="mt-2 border-t border-border/40 pt-2">
            <p className="mb-1 text-[9.5px] uppercase tracking-wider text-muted-foreground">
              Mes paris ({state.myBets.length})
            </p>
            <div className="flex flex-col gap-0.5">
              {state.myBets.map((b) => {
                const e = state.lineup.find((x) => x.betKey === b.horseId);
                if (!e) return null;
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px]"
                    style={{ background: 'rgba(16,185,129,0.06)' }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.silks1 }} />
                    <span className="flex-1 truncate">{e.name}</span>
                    {b.settled ? (
                      <span className={cn('font-mono text-[10.5px] font-semibold', b.payout > 0 ? 'text-emerald-300' : 'text-rose-300')}>
                        {b.payout > 0 ? `+${formatMoney(b.payout)}` : '−'}
                      </span>
                    ) : (
                      <span className="font-mono text-[10.5px] text-emerald-300">{formatMoney(b.amount)}</span>
                    )}
                    {isOpenForBets && !b.settled && (
                      <button
                        type="button"
                        onClick={() => cancelBet(b.id)}
                        disabled={busy}
                        className="text-rose-400/60 transition hover:text-rose-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// =====================================================================
// PodiumOverlay — end-of-race podium with gain/loss summary and confetti
// =====================================================================
function PodiumOverlay({
  state,
  cycleIndex,
  onClose,
}: {
  state: HorseRaceStateResponse;
  cycleIndex: number;
  onClose: () => void;
}) {
  const podium = useMemo(() => {
    const byPos: Record<number, HorseRaceLineupEntry> = {};
    for (const e of state.lineup) if (e.finishPos && e.finishPos <= 3) byPos[e.finishPos] = e;
    return [byPos[1] ?? null, byPos[2] ?? null, byPos[3] ?? null];
  }, [state.lineup]);
  const settledBets = state.myBets;
  const totalStake = settledBets.reduce((s, b) => s + b.amount, 0);
  const totalPayout = settledBets.reduce((s, b) => s + (b.payout ?? 0), 0);
  const totalWin = totalPayout - totalStake;
  const isWin = totalWin > 0;
  const hasBets = totalStake > 0;
  if (!podium[0]) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(6px)',
        animation: 'hr-sheet-up 350ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Confetti when won */}
      {isWin &&
        Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="hr-confetti"
            style={{
              left: `${(i * 73) % 100}%`,
              background: ['#facc15', '#10b981', '#ef4444', '#3b82f6', '#a78bfa'][i % 5],
              animationDelay: `${(i * 137) % 2000}ms`,
              animationDuration: `${2400 + ((i * 91) % 1500)}ms`,
            }}
          />
        ))}

      <div
        className="relative w-[560px] max-w-[92%] rounded-2xl border border-border bg-card p-6 text-center"
        style={{ boxShadow: '0 20px 80px rgba(0,0,0,0.7)' }}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Résultat de la course #{cycleIndex}
        </p>
        <h2 className="mt-1 text-[26px] font-extrabold leading-tight">
          {isWin ? '🎉 Tu as gagné !' : hasBets ? 'Pas cette fois.' : 'Course terminée'}
        </h2>

        {/* Podium */}
        <div className="mt-5 grid items-end gap-3" style={{ gridTemplateColumns: '1fr 1.2fr 1fr' }}>
          {([1, 0, 2] as const).map((podiumIdx) => {
            const horse = podium[podiumIdx];
            if (!horse) return <div key={podiumIdx} />;
            const place = (podiumIdx + 1) as 1 | 2 | 3;
            const height = place === 1 ? 130 : place === 2 ? 100 : 80;
            const color = place === 1 ? '#facc15' : place === 2 ? '#cbd5e1' : '#b45309';
            return (
              <div key={podiumIdx} className="flex flex-col items-center gap-1.5">
                <div className="h-16 w-24">
                  <HorseAvatar {...horse} />
                </div>
                <div className="truncate text-[12.5px] font-semibold">{horse.name}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {horse.clanName ?? horse.stableName ?? 'IA · Pari Mutuel'}
                </div>
                <div
                  className="flex w-full items-center justify-center rounded-t-md border font-mono text-[28px] font-extrabold"
                  style={{
                    height,
                    background: `linear-gradient(180deg, ${color}, ${color}33)`,
                    borderColor: color,
                    color: '#0f172a',
                  }}
                >
                  {place}
                </div>
              </div>
            );
          })}
        </div>

        {hasBets && (
          <div
            className="mt-5 flex items-center justify-around rounded-xl border px-4 py-2.5"
            style={{
              background: isWin ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.03)',
              borderColor: isWin ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.12)',
            }}
          >
            <div>
              <div className="text-[10px] text-muted-foreground">Mise totale</div>
              <div className="font-mono text-[15px] font-bold">{formatMoney(totalStake)}</div>
            </div>
            <div className="text-muted-foreground">→</div>
            <div>
              <div className="text-[10px] text-muted-foreground">Gain</div>
              <div
                className="font-mono text-[17px] font-extrabold"
                style={{ color: isWin ? '#34d399' : '#f87171' }}
              >
                {isWin ? '+' : ''}
                {formatMoney(totalWin)}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex min-w-[200px] items-center justify-center rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
        >
          Prochaine course →
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Classements — sub-views
// =====================================================================
function ChevauXRankings({ horses }: { horses: TopHorseDto[] }) {
  return (
    <div className="space-y-2">
      <div className="mb-4">
        <h2 className="text-[20px] font-extrabold tracking-tight">Classement chevaux</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{horses.length} chevaux classés par victoires</p>
      </div>
      {horses.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Aucun cheval classé pour l&apos;instant.</p>}
      {horses.map((h, i) => {
        const formBadges = getHorseFormBadges(h.id, h.wins, h.podiums, h.races);
        const rating = computeHorseRating(h.stats.speed, h.stats.stamina, h.stats.consistency);
        const winRate = h.races > 0 ? Math.round((h.wins / h.races) * 100) : 0;
        const milestones = getHorseMilestones(h.wins, h.races, h.earnings);
        return (
          <div key={h.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:bg-white/[0.04]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[13px]" style={{ background: i < 3 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)', color: i < 3 ? '#fbbf24' : '#64748b' }}>
              {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
            </div>
            <div className="h-14 w-20 shrink-0">
              <HorseAvatar {...h} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] font-bold">{h.name}</p>
                <span className="text-[11px] text-amber-300">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
                {milestones.slice(0, 1).map((m) => (
                  <span key={m} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px]">{m}</span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {h.stableName ?? '—'}{h.clanName ? ' · ' + h.clanName : ''} · {h.ageYears.toFixed(1)} ans
              </p>
              <div className="mt-1 flex gap-3">
                <StatChip label="VIT" value={h.stats.speed} />
                <StatChip label="END" value={h.stats.stamina} />
                <StatChip label="CST" value={h.stats.consistency} />
              </div>
            </div>
            <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
              <div className="flex gap-0.5">
                {formBadges.map((f, fi) => (
                  <span key={fi} className={cn('flex h-5 w-5 items-center justify-center rounded text-[8.5px] font-bold',
                    f === 'W' ? 'bg-emerald-500/25 text-emerald-300' : f === 'P' ? 'bg-sky-500/25 text-sky-300' : 'bg-white/8 text-white/25'
                  )}>{f}</span>
                ))}
              </div>
              <p className="text-[15px] font-extrabold tabular-nums text-amber-200">{h.wins} V</p>
              <p className="text-[10px] text-muted-foreground">{h.podiums} P · {winRate}% win</p>
              <p className="text-[11px] font-semibold text-emerald-300">{formatMoney(h.earnings)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EcuriesRankings({ stables }: { stables: PublicStableDto[] }) {
  return (
    <div className="space-y-2">
      <div className="mb-4">
        <h2 className="text-[20px] font-extrabold tracking-tight">Classement écuries</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{stables.length} écuries triées par réputation</p>
      </div>
      {stables.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Aucune écurie pour l&apos;instant.</p>}
      {stables.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:bg-white/[0.04]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[13px]" style={{ background: i < 3 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)', color: i < 3 ? '#fbbf24' : '#64748b' }}>
            {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.14)' }}>🏇</div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold">{s.name}</p>
            <p className="text-[11px] text-muted-foreground">{s.clanName} · {s.horseCount} cheval{s.horseCount !== 1 ? 'x' : ''}</p>
            <div className="mt-1 flex gap-3 text-[10.5px] text-muted-foreground">
              <span><span className="font-semibold text-amber-200">{s.totalWins}</span> victoires</span>
              <span><span className="font-semibold text-slate-300">{s.totalPodiums}</span> podiums</span>
              <span><span className="font-semibold text-cyan-300">{s.totalRaces}</span> courses</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[14px] font-bold tabular-nums">Rép. {s.reputation}</p>
            {s.totalRaces > 0 && <p className="text-[10px] text-muted-foreground">{Math.round((s.totalWins / s.totalRaces) * 100)}% victoires</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoriqueRankings({ races }: { races: RecentRaceDto[] }) {
  return (
    <div className="space-y-3">
      <div className="mb-4">
        <h2 className="text-[20px] font-extrabold tracking-tight">Historique des courses</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{races.length} courses enregistrées</p>
      </div>
      {races.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Aucune course résolue.</p>}
      {races.map((r) => (
        <div key={r.cycleIndex} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[14px] font-bold">Course #{r.cycleIndex}</span>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{r.totalBets} paris</span>
              <span className="font-semibold text-emerald-300">{formatMoney(r.totalPool)} cagnotte</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {r.podium.map((p) => (
              <div key={p.position} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{
                background: p.position === 1 ? 'rgba(251,191,36,0.06)' : p.position === 2 ? 'rgba(148,163,184,0.05)' : p.position === 3 ? 'rgba(251,146,60,0.05)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${p.position === 1 ? 'rgba(251,191,36,0.15)' : p.position === 2 ? 'rgba(148,163,184,0.12)' : p.position === 3 ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.04)'}`,
              }}>
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  p.position === 1 && 'bg-amber-400 text-amber-950',
                  p.position === 2 && 'bg-slate-300 text-slate-900',
                  p.position === 3 && 'bg-orange-400 text-orange-950',
                  p.position > 3 && 'bg-white/10 text-muted-foreground',
                )}>{p.position}</span>
                <div className="h-10 w-14 shrink-0">
                  <HorseAvatar {...{ ...p, bodyColor: p.bodyColor ?? undefined }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold">{p.name ?? 'Cheval'}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {p.isComputer ? 'Cheval IA' : `${p.stableName ?? '—'}${p.clanName ? ' · ' + p.clanName : ''}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{(p.finishTimeMs / 1000).toFixed(2)}s</p>
                  {p.prize > 0 && <p className="text-[11px] font-semibold text-emerald-300">+{formatMoney(p.prize)}</p>}
                  {p.wasCaught && <span className="text-[9px] font-bold text-rose-300">DQ</span>}
                  {p.wasDoped && !p.wasCaught && <span className="text-[9px] font-bold text-amber-300">DOP</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecordsHall({ horses }: { horses: TopHorseDto[] }) {
  if (horses.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Aucun record pour l&apos;instant — courez !</p>;
  const mostWins     = [...horses].sort((a, b) => b.wins - a.wins)[0];
  const highEarner   = [...horses].sort((a, b) => b.earnings - a.earnings)[0];
  const mostRaces    = [...horses].sort((a, b) => b.races - a.races)[0];
  const qualified    = horses.filter((h) => h.races >= 10);
  const bestRate     = qualified.length > 0 ? [...qualified].sort((a, b) => (b.wins / b.races) - (a.wins / a.races))[0] : null;
  const bestSpeed    = [...horses].sort((a, b) => b.stats.speed - a.stats.speed)[0];
  const bestStamina  = [...horses].sort((a, b) => b.stats.stamina - a.stats.stamina)[0];
  const bestCons     = [...horses].sort((a, b) => b.stats.consistency - a.stats.consistency)[0];

  const records = [
    { icon: '🥇', title: 'Plus de victoires',     horse: mostWins,    value: `${mostWins.wins} victoires`,                     sub: `sur ${mostWins.races} courses` },
    { icon: '💰', title: 'Plus gros gains',        horse: highEarner,  value: formatMoney(highEarner.earnings),                  sub: `${highEarner.wins} victoires` },
    { icon: '🎖️', title: 'Plus expérimenté',       horse: mostRaces,   value: `${mostRaces.races} courses`,                     sub: `${mostRaces.wins} victoires` },
    bestRate && { icon: '📈', title: 'Meilleur taux',  horse: bestRate,    value: `${Math.round((bestRate.wins / bestRate.races) * 100)}%`, sub: 'min. 10 courses' },
    { icon: '⚡', title: 'Meilleure vitesse',      horse: bestSpeed,   value: `${bestSpeed.stats.speed.toFixed(1)} VIT`,         sub: 'statistique vitesse' },
    { icon: '🫁', title: 'Meilleure endurance',    horse: bestStamina, value: `${bestStamina.stats.stamina.toFixed(1)} END`,     sub: 'statistique endurance' },
    { icon: '🎯', title: 'Meilleure constance',    horse: bestCons,    value: `${bestCons.stats.consistency.toFixed(1)} CST`,   sub: 'statistique constance' },
  ].filter(Boolean) as Array<{ icon: string; title: string; horse: TopHorseDto; value: string; sub: string }>;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[20px] font-extrabold tracking-tight">Hall of Fame</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">Les meilleurs de tous les temps</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {records.map((rec) => (
          <div key={rec.title} className="rounded-xl border border-amber-500/12 bg-amber-500/4 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">{rec.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">{rec.title}</p>
                <p className="text-[15px] font-extrabold text-amber-200 leading-tight">{rec.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{rec.sub}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-7 w-10 shrink-0">
                    <HorseAvatar {...rec.horse} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-semibold">{rec.horse.name}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{rec.horse.stableName ?? '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassementsView({ config: _config }: { config: HorseRaceConfig }) {
  const [sub, setSub] = useState<'chevaux' | 'ecuries' | 'historique' | 'records'>('chevaux');
  const [standings, setStandings] = useState<HorseRaceStandingsResponse | null>(null);
  const [stables, setStables] = useState<PublicStableDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      horseRaceApi.getStandings().catch(() => null),
      horseRaceApi.listStables().catch(() => null),
    ]).then(([sRes, stRes]) => {
      if (sRes) setStandings(sRes.data);
      if (stRes) setStables(stRes.data.stables);
    }).finally(() => setLoading(false));
  }, []);

  const subItems: Array<{ id: typeof sub; emoji: string; label: string; count: string }> = [
    { id: 'chevaux',    emoji: '🏇', label: 'Chevaux',    count: `${standings?.topHorses.length ?? 0} classés` },
    { id: 'ecuries',    emoji: '🏠', label: 'Écuries',    count: `${stables.length} participantes` },
    { id: 'historique', emoji: '📅', label: 'Historique', count: `${standings?.recentRaces.length ?? 0} courses` },
    { id: 'records',    emoji: '🏆', label: 'Records',    count: 'Hall of Fame' },
  ];

  return (
    <div className="grid min-h-0 flex-1 gap-2.5 overflow-hidden" style={{ gridTemplateColumns: '200px 1fr' }}>
      <aside className="flex flex-col gap-1 overflow-y-auto rounded-2xl border border-white/[0.06] bg-card/50 p-2">
        <div className="px-2 py-2">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground/50">Classements</p>
        </div>
        {subItems.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSub(s.id)}
            className={cn(
              'flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition',
              sub === s.id
                ? 'border border-amber-500/25 bg-amber-500/10 text-amber-100'
                : 'border border-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
            )}
          >
            <span className="text-[13px] font-semibold">{s.emoji} {s.label}</span>
            <span className="text-[10px] opacity-55">{s.count}</span>
          </button>
        ))}
      </aside>
      <main className="min-h-0 overflow-y-auto rounded-2xl border border-white/[0.06] bg-card/50 p-5">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Chargement…</p>
          </div>
        )}
        {!loading && sub === 'chevaux'    && <ChevauXRankings horses={standings?.topHorses ?? []} />}
        {!loading && sub === 'ecuries'    && <EcuriesRankings stables={stables} />}
        {!loading && sub === 'historique' && <HistoriqueRankings races={standings?.recentRaces ?? []} />}
        {!loading && sub === 'records'    && <RecordsHall horses={standings?.topHorses ?? []} />}
      </main>
    </div>
  );
}

// =====================================================================
// Main page
// =====================================================================
export default function HorseRace() {
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState<HorseRaceConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<HorseRaceStateResponse | null>(null);
  const [stable, setStable] = useState<StableMeDto | null>(null);
  const [patterns, setPatterns] = useState<PatternDto[]>([]);
  const [accessories, setAccessories] = useState<AccessoryDto[]>(FALLBACK_ACCESSORIES);
  const [silksDesigns, setSilksDesigns] = useState<string[]>([]);
  const [horseBusinesses, setHorseBusinesses] = useState<HorseServiceBusinessDto[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const [activeTab, setActiveTab] = useState<'course' | 'classements'>('course');
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [stableModalOpen, setStableModalOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [createStableOpen, setCreateStableOpen] = useState(false);
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [atelierHorse, setAtelierHorse] = useState<StableHorseDto | null>(null);
  const [confiscationMsg, setConfiscationMsg] = useState<string | null>(null);
  const [showPodium, setShowPodium] = useState(false);
  const [podiumDismissedCycle, setPodiumDismissedCycle] = useState<number | null>(null);
  const seenConfiscatedHorses = useRef<Set<string>>(new Set());
  const lastResolvedCycle = useRef<number>(-1);

  const cycleIndex = state?.cycleIndex ?? Math.floor(now / config.CYCLE_MS);
  const cycleStart = cycleIndex * config.CYCLE_MS;
  const t = now - cycleStart;
  const phase: 'betting' | 'racing' | 'results' =
    t < config.BETTING_MS ? 'betting'
      : t < config.BETTING_MS + config.RACE_MS ? 'racing'
        : 'results';
  const elapsedInPhase =
    phase === 'betting' ? t
      : phase === 'racing' ? t - config.BETTING_MS
        : t - config.BETTING_MS - config.RACE_MS;
  const totalPhase = phase === 'betting' ? config.BETTING_MS : phase === 'racing' ? config.RACE_MS : config.RESULTS_MS;

  useEffect(() => {
    horseRaceApi.getConfig()
      .then((r) => setConfig(r.data))
      .catch(() => { /* fall back */ });
  }, []);

  const refreshState = useCallback(async () => {
    try { const r = await horseRaceApi.getState(); setState(r.data); } catch { /* ignore */ }
  }, []);
  const refreshStable = useCallback(async () => {
    try { const r = await horseRaceApi.getMyStable(); setStable(r.data); } catch { /* ignore */ }
  }, []);
  const refreshPatterns = useCallback(async () => {
    try {
      const r = await horseRaceApi.getPatterns();
      setPatterns(r.data.patterns);
      setAccessories(r.data.accessories ?? FALLBACK_ACCESSORIES);
      setSilksDesigns(r.data.silksDesigns ?? []);
    } catch { /* ignore */ }
  }, []);
  const refreshHorseBusinesses = useCallback(async () => {
    try { const r = await horseRaceApi.listHorseBusinesses(); setHorseBusinesses(r.data.businesses); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void refreshState();
    void refreshStable();
    void refreshPatterns();
    void refreshHorseBusinesses();
    const id = window.setInterval(() => { void refreshState(); }, 3000);
    return () => window.clearInterval(id);
  }, [refreshState, refreshStable, refreshPatterns, refreshHorseBusinesses]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (state?.phase === 'results' && state.cycleIndex !== lastResolvedCycle.current) {
      lastResolvedCycle.current = state.cycleIndex;
      const t1 = window.setTimeout(() => {
        void refreshUser();
        void refreshStable();
        void refreshPatterns();
      }, 1500);
      return () => window.clearTimeout(t1);
    }
  }, [state?.phase, state?.cycleIndex, refreshUser, refreshStable, refreshPatterns]);

  // Auto-show podium when results phase starts (once per cycle, until dismissed)
  useEffect(() => {
    if (
      state?.phase === 'results' &&
      state.lineup.some((e) => e.finishPos === 1) &&
      podiumDismissedCycle !== state.cycleIndex
    ) {
      setShowPodium(true);
    } else if (state?.phase !== 'results') {
      setShowPodium(false);
    }
  }, [state?.phase, state?.cycleIndex, state?.lineup, podiumDismissedCycle]);

  useEffect(() => {
    if (!state || state.phase !== 'results') return;
    for (const e of state.lineup) {
      if (e.wasCaught && e.horseId && !seenConfiscatedHorses.current.has(e.horseId)) {
        seenConfiscatedHorses.current.add(e.horseId);
        const mine = stable?.stable?.horses.some((h) => h.id === e.horseId);
        if (mine === true || (stable?.stable && state.lineup.find((x) => x.horseId === e.horseId)?.stableId === stable.stable?.id)) {
          setConfiscationMsg(`${e.name} a été contrôlé positif au dopage. Le cheval est confisqué.`);
        }
      }
    }
  }, [state, stable]);

  const sim = useMemo<SimResult>(() => {
    if (!state || state.lineup.length === 0) {
      return { positions: {}, finishOrder: [], finishTimes: {} };
    }
    const entrants: SimHorse[] = state.lineup.map((e) => ({
      id: e.betKey,
      speed: e.stats?.speed ?? 7,
      stamina: e.stats?.stamina ?? 7,
      consistency: e.stats?.consistency ?? 7,
    }));
    return simulateRaceClient(entrants, state.cycleIndex, config.RACE_MS);
  }, [state, config.RACE_MS]);

  const raceElapsedMs = phase === 'racing' ? elapsedInPhase : phase === 'results' ? config.RACE_MS : 0;
  const leaderKey = useMemo(() => {
    if (!state || (phase !== 'racing' && phase !== 'results')) return null;
    let best: string | null = null;
    let bestPos = -Infinity;
    for (const e of state.lineup) {
      const arr = sim.positions[e.betKey] ?? [0];
      const p = interpAt(arr, raceElapsedMs);
      if (p > bestPos) { bestPos = p; best = e.betKey; }
    }
    return best;
  }, [state, sim, raceElapsedMs, phase]);

  const phaseRemaining = totalPhase - elapsedInPhase;
  const phaseLabel = phase === 'betting' ? 'Paris' : phase === 'racing' ? 'En course' : 'Résultats';

  const myBetKeys = useMemo(() => new Set(state?.myBets.map((b) => b.horseId) ?? []), [state?.myBets]);
  const userMoney = Number(user?.money ?? 0);

  const myHorsesInRace = useMemo(() => {
    if (!state || !stable?.stable) return [];
    const myIds = new Set(stable.stable.horses.map((h) => h.id));
    return state.lineup.filter((e) => e.horseId && myIds.has(e.horseId));
  }, [state, stable]);

  const winner = useMemo(() => {
    if (!state) return null;
    return state.lineup.find((e) => e.finishPos === 1) ?? null;
  }, [state]);

  const favorite = useMemo(() => {
    if (!state || state.lineup.length === 0) return null;
    return [...state.lineup].filter((e) => e.odds != null).sort((a, b) => (a.odds ?? 99) - (b.odds ?? 99))[0] ?? null;
  }, [state]);

  return (
    <PageShell size="full">
      <style>{`
        @keyframes hr-marquee { from { transform: translateX(0); } to { transform: translateX(-100%); } }

        .hr-gallop { animation: hr-gallop-anim 220ms steps(2, end) infinite; }
        @keyframes hr-gallop-anim {
          0%   { transform: translateY(0px) rotate(-0.5deg); }
          50%  { transform: translateY(-2px) rotate(0.5deg); }
          100% { transform: translateY(0px) rotate(-0.5deg); }
        }

        .hr-track-bg {
          background:
            radial-gradient(ellipse 120% 50% at 50% -10%, rgba(14, 165, 233, 0.15), transparent 70%),
            radial-gradient(ellipse 120% 60% at 50% 110%, rgba(16, 185, 129, 0.25), transparent 65%),
            linear-gradient(180deg, #020617 0%, #064e3b 50%, #022c22 100%);
          box-shadow: inset 0 0 60px rgba(0,0,0,0.6);
        }
        .hr-grandstand {
          background:
            repeating-linear-gradient(180deg,
              rgba(255,255,255,0.04) 0 1px,
              transparent 1px 3px),
            linear-gradient(180deg, #1a1410 0%, #0b0907 100%);
        }
        .hr-crowd-row {
          background:
            radial-gradient(circle at 6px 8px, #1c1917 4px, transparent 5px),
            radial-gradient(circle at 14px 5px, #292524 4px, transparent 5px),
            radial-gradient(circle at 22px 8px, #1c1917 4px, transparent 5px);
          background-repeat: repeat-x;
          background-size: 28px 12px;
        }
        .hr-rail {
          background: linear-gradient(180deg, #f3f4f6 0%, #cbd5e1 50%, #94a3b8 100%);
          box-shadow: 0 1px 0 rgba(0,0,0,0.4), inset 0 -1px 0 rgba(0,0,0,0.2);
        }
        .hr-turf-strip {
          position: relative;
          background: linear-gradient(180deg, hsl(152 60% 16%) 0%, hsl(152 50% 9%) 100%);
        }
        .hr-turf-strip::before {
          content: '';
          position: absolute; inset: 0;
          background-image:
            radial-gradient(circle at 12% 30%, rgba(255,255,255,0.04) 0 1px, transparent 1px),
            radial-gradient(circle at 70% 60%, rgba(255,255,255,0.03) 0 1px, transparent 1px),
            radial-gradient(circle at 35% 80%, rgba(255,255,255,0.04) 0 1px, transparent 1px);
          background-size: 40px 40px, 60px 60px, 50px 50px;
        }
        .hr-lane-stripe {
          background:
            repeating-linear-gradient(90deg,
              transparent 0 22px,
              rgba(255,255,255,0.04) 22px 23px);
        }
        .hr-lane-stripe-fast { animation: hr-stripes 0.7s linear infinite; }
        @keyframes hr-stripes {
          from { background-position-x: 0; }
          to   { background-position-x: -23px; }
        }
        .hr-finish-pole {
          background:
            repeating-linear-gradient(180deg,
              #ffffff 0 8px,
              #ef4444 8px 16px);
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.6), inset 0 0 4px rgba(0,0,0,0.5);
          border-radius: 4px;
        }

        @keyframes hr-sheet-up {
          from { transform: translateY(40%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }

        .hr-confetti {
          position: absolute;
          width: 6px; height: 10px;
          top: -20px;
          animation: hr-confetti-fall linear infinite;
          pointer-events: none;
        }
        @keyframes hr-confetti-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120vh) rotate(720deg); opacity: 0.6; }
        }

        .hr-commentary-text {
          animation: hr-commentary-in 0.35s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes hr-commentary-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-2.5 lg:h-[calc(100vh-7rem)]">
        {/* Compact topbar */}
        {(() => {
          const condition = getCycleCondition(cycleIndex);
          return (
            <header className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-black/55 px-3 py-2 shadow-lg backdrop-blur-xl">
              {/* Left: identity */}
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-[22px] leading-none select-none">🏇</span>
                <div>
                  <h1 className="text-[13px] font-bold leading-tight text-white tracking-tight">
                    Hippodrome de Longchamp
                    <span className="ml-1.5 font-mono text-[10.5px] font-normal text-white/35">#{cycleIndex}</span>
                  </h1>
                  <p className={cn('text-[10px] font-medium leading-none mt-0.5', condition.color)}>
                    {condition.emoji} {condition.label} · Prix de l&apos;Arc
                  </p>
                </div>
              </div>

              {/* Center: phase pill + countdown */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest',
                  phase === 'betting' && 'border border-amber-500/30 bg-amber-500/12 text-amber-200',
                  phase === 'racing'  && 'border border-rose-500/30 bg-rose-500/12 text-rose-200 shadow-[0_0_14px_rgba(244,63,94,0.22)]',
                  phase === 'results' && 'border border-emerald-500/30 bg-emerald-500/12 text-emerald-200',
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full bg-current', phase === 'racing' && 'animate-pulse')} />
                  {phaseLabel}
                </div>
                <span className="w-14 text-center font-mono text-[15px] font-black tabular-nums text-white/90">
                  {phase === 'betting'
                    ? formatMs(phaseRemaining)
                    : phase === 'racing'
                    ? (elapsedInPhase / 1000).toFixed(1) + 's'
                    : formatMs(phaseRemaining)}
                </span>
              </div>

              {/* Right: wallet + nav icons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200">
                  <Wallet className="h-3 w-3 shrink-0" />
                  <span className="font-bold tabular-nums">{formatMoney(userMoney)}</span>
                </div>
                <div className="h-5 w-px bg-white/10" />
                <button
                  type="button"
                  title="Classements"
                  onClick={() => setActiveTab(activeTab === 'classements' ? 'course' : 'classements')}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg border transition',
                    activeTab === 'classements'
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                      : 'border-white/[0.07] bg-white/[0.04] text-white/45 hover:border-white/14 hover:text-white/80',
                  )}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Écuries de la communauté"
                  onClick={() => setExploreOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-white/45 transition hover:border-white/14 hover:text-white/80"
                >
                  <Users className="h-3.5 w-3.5" />
                </button>
                {stable?.stable ? (
                  <button
                    type="button"
                    onClick={() => setStableModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/12 px-2.5 py-1.5 text-[12px] font-semibold text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.12)] transition hover:bg-indigo-500/22"
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Écurie</span>
                    <span className="text-indigo-300/70">({stable.stable.horses.length})</span>
                  </button>
                ) : stable?.hasClan ? (
                  <button
                    type="button"
                    onClick={() => setCreateStableOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-200 transition hover:bg-emerald-500/22"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Créer écurie</span>
                  </button>
                ) : (
                  <span className="hidden rounded-lg border border-amber-500/20 bg-amber-500/7 px-2.5 py-1.5 text-[11px] text-amber-200/60 sm:inline">
                    Rejoindre un clan
                  </span>
                )}
              </div>
            </header>
          );
        })()}

        <Progress
          value={Math.min(100, (elapsedInPhase / totalPhase) * 100)}
          className={cn(
            'h-1.5 rounded-full bg-white/5 shadow-inner',
            phase === 'racing' && '[&>div]:bg-gradient-to-r [&>div]:from-rose-500 [&>div]:to-rose-400 [&>div]:shadow-[0_0_10px_rgba(244,63,94,0.5)]',
            phase === 'results' && '[&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-emerald-400 [&>div]:shadow-[0_0_10px_rgba(16,185,129,0.5)]',
            phase === 'betting' && '[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-amber-400 [&>div]:shadow-[0_0_10px_rgba(245,158,11,0.5)]',
          )}
        />

        {activeTab === 'classements' ? (
          <ClassementsView config={config} />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 overflow-hidden lg:grid-cols-[200px_minmax(0,1fr)_310px]">
            {/* Far left: my horses rail */}
            <aside className="hidden min-h-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-border/40 bg-card/60 p-2.5 lg:flex">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold">
                  Mes chevaux
                  <span className="ml-1 font-normal text-muted-foreground">
                    · {stable?.stable?.horses.length ?? 0}
                  </span>
                </span>
                {stable?.stable && (
                  <button
                    type="button"
                    onClick={() => setStableModalOpen(true)}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition hover:border-border hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
              {stable?.stable && stable.stable.horses.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {stable.stable.horses.map((h) => {
                    const effAvg = (h.geneSpeed + h.trainSpeed + h.geneStamina + h.trainStamina + h.geneConsistency + h.trainConsistency) / 3;
                    const inRace = state?.lineup.some((e) => e.horseId === h.id);
                    const formBadges = getHorseFormBadges(h.id, h.wins, h.podiums, h.races);
                    const lastForm = formBadges[0];
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setAtelierHorse(h)}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border bg-card/70 p-1.5 text-left transition hover:border-amber-400/40 hover:bg-card',
                          inRace ? 'border-amber-400/30' : 'border-border/40',
                        )}
                      >
                        <div className="h-9 w-14 shrink-0 overflow-hidden rounded-md bg-emerald-950/40">
                          <HorseAvatar {...h} showJockey={false} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[12px] font-semibold">{h.name}</span>
                            {lastForm === 'W' && <Flame className="h-3 w-3 shrink-0 text-amber-400" />}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground">
                            <span>{h.ageYears.toFixed(1)}a</span>
                            <span>·</span>
                            <span>{h.races}c</span>
                            {h.wins > 0 && <span className="font-semibold text-amber-300">{h.wins}V</span>}
                          </div>
                          <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" style={{ width: `${Math.min(100, Math.round(effAvg * 10))}%` }} />
                          </div>
                        </div>
                        {h.pendingEntries > 0 && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-1 py-0.5 text-[9px] font-semibold text-emerald-200">{h.pendingEntries}</span>
                        )}
                        {h.dopedForCycle != null && <span title="Dopé">💉</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-6 text-center text-[11px] text-muted-foreground">
                  {stable?.stable ? (
                    <>
                      <p>Aucun cheval.</p>
                      <Button size="sm" onClick={() => setStableModalOpen(true)}><Building2 className="mr-1 h-3 w-3" /> Gérer</Button>
                    </>
                  ) : stable?.hasClan ? (
                    <>
                      <p>Aucune écurie.</p>
                      <Button size="sm" onClick={() => setCreateStableOpen(true)}><Plus className="mr-1 h-3 w-3" /> Créer</Button>
                    </>
                  ) : (
                    <p>Rejoignez un clan<br />pour créer une écurie.</p>
                  )}
                </div>
              )}
            </aside>

            {/* Center: track + commentary */}
            <div className="flex min-h-0 flex-col gap-2">
              {/* Commentary ticker — only during race */}
              {phase === 'racing' && state && state.lineup.length > 0 && (
                <CommentaryTicker
                  lineup={state.lineup}
                  sim={sim}
                  elapsedMs={raceElapsedMs}
                  raceDurationMs={config.RACE_MS}
                  phase={phase}
                />
              )}

              {/* Track */}
              <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-2">
                  <div className="flex items-center justify-between text-[9.5px] uppercase tracking-wider text-muted-foreground/60">
                    <span>Piste · cliquez pour parier</span>
                    <span>{config.ENTRANTS} partants · arrivée à droite</span>
                  </div>
                  <div className="relative min-h-0 flex-1">
                    {state && state.lineup.length > 0 ? (
                      <RaceTrack
                        lineup={state.lineup}
                        sim={sim}
                        elapsedMs={raceElapsedMs}
                        isRacing={phase === 'racing'}
                        phase={phase}
                        betKeys={myBetKeys}
                        onLaneClick={() => setBetModalOpen(true)}
                        leaderKey={leaderKey}
                      />
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">Chargement du peloton...</p>
                    )}
                    {showPodium && state && state.phase === 'results' && (
                      <PodiumOverlay
                        state={state}
                        cycleIndex={state.cycleIndex}
                        onClose={() => {
                          setShowPodium(false);
                          setPodiumDismissedCycle(state.cycleIndex);
                        }}
                      />
                    )}
                  </div>
                  {phase === 'results' && winner && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm">
                      <p className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-300" />
                        <span className="font-semibold">{winner.name}</span> remporte la course #{cycleIndex}
                        {winner.stableName && <span className="text-amber-200/80"> — {winner.stableName}</span>}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column: inline bet panel + my horses in race */}
            <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
              <InlineBetPanel
                state={state}
                config={config}
                userMoney={userMoney}
                favorite={favorite}
                onPlaced={async () => {
                  await refreshState();
                  await refreshUser();
                }}
              />
              {myHorsesInRace.length > 0 && (
                <Card className="shrink-0">
                  <CardContent className="space-y-1 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mes chevaux en course</p>
                    {myHorsesInRace.map((e) => (
                      <div key={e.lane} className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-1.5 py-1 text-[11px]">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.silks1 }} />
                        <span className="flex-1 truncate font-medium">{e.name}</span>
                        <span className="font-mono text-[9.5px] text-amber-200">{e.odds ? formatOdds(e.odds) : '—'}</span>
                        {e.finishPos && <span className="rounded-full bg-amber-400/95 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">#{e.finishPos}</span>}
                        {e.prize > 0 && <span className="text-emerald-300">+{formatMoney(e.prize)}</span>}
                        {e.wasCaught && <span className="rounded bg-rose-500/30 px-1 py-0.5 text-[9px] text-rose-200">DQ</span>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <BetModal
        open={betModalOpen}
        onClose={() => setBetModalOpen(false)}
        state={state}
        config={config}
        userMoney={userMoney}
        onPlaced={async () => {
          await refreshState();
          await refreshUser();
        }}
      />

      <StableModal
        open={stableModalOpen}
        onClose={() => setStableModalOpen(false)}
        stable={stable}
        config={config}
        userMoney={userMoney}
        horseBusinesses={horseBusinesses}
        onUpdated={async () => {
          await refreshStable();
          await refreshUser();
          await refreshPatterns();
          await refreshHorseBusinesses();
        }}
        onOpenAtelier={(h) => { setStableModalOpen(false); setAtelierHorse(h); }}
      />

      <AtelierModal
        open={!!atelierHorse}
        horse={atelierHorse}
        onClose={() => setAtelierHorse(null)}
        patterns={patterns}
        accessories={accessories}
        silksDesigns={silksDesigns}
        config={config}
        userMoney={userMoney}
        onSaved={async () => {
          await refreshStable();
          await refreshUser();
          await refreshPatterns();
        }}
      />

      <ExploreStablesModal open={exploreOpen} onClose={() => setExploreOpen(false)} />
      <StandingsModal open={standingsOpen} onClose={() => setStandingsOpen(false)} />

      <CreateStableModal
        open={createStableOpen}
        onClose={() => setCreateStableOpen(false)}
        onCreated={async () => {
          await refreshStable();
          await refreshUser();
        }}
        config={config}
        userMoney={userMoney}
      />

      <ConfiscationModal message={confiscationMsg} onClose={() => setConfiscationMsg(null)} />
    </PageShell>
  );
}
