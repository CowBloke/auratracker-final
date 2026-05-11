import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Eye,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  type HorseRaceConfig,
  type HorseRaceStandingsResponse,
  type RecentRaceDto,
  type TopHorseDto,
} from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ---------- Fallback constants (overridden once config loads) ----------
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

// ---------- RNG (matches backend) ----------
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

// ---------- Helpers ----------
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

// ---------- Horse SVG ----------
const PATTERN_COLORS_DEFAULT: Record<string, string> = {
  solid: '#f8fafc',
  blaze: '#f8fafc',
  stockings: '#f8fafc',
  dapple: '#f8fafc',
  stripes: '#1f2937',
  splash: '#f8fafc',
  frost: '#e0f2fe',
  flame: '#fb923c',
  royal: '#facc15',
};

function HorseSilhouette({
  bodyColor,
  pattern,
  patternColor,
}: {
  bodyColor: string;
  pattern: string;
  patternColor: string;
}) {
  const uid = useId().replace(/:/g, '');
  const clipId = `hclip-${uid}`;
  const pc = patternColor || PATTERN_COLORS_DEFAULT[pattern] || '#f8fafc';

  return (
    <svg viewBox="0 0 110 70" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id={clipId}>
          <path d="M 12,46 Q 10,48 12,52 L 18,55 L 18,40 Q 22,32 30,32 L 70,32 Q 80,32 86,28 Q 92,24 95,18 L 99,12 Q 101,11 102,13 L 100,20 Q 99,26 96,30 L 95,33 L 100,33 L 102,38 Q 102,42 99,44 L 92,44 L 88,46 L 84,42 L 80,46 L 30,46 L 28,52 L 22,55 L 18,55 Z" />
        </clipPath>
      </defs>

      {/* Body */}
      <path
        d="M 12,46 Q 10,48 12,52 L 18,55 L 18,40 Q 22,32 30,32 L 70,32 Q 80,32 86,28 Q 92,24 95,18 L 99,12 Q 101,11 102,13 L 100,20 Q 99,26 96,30 L 95,33 L 100,33 L 102,38 Q 102,42 99,44 L 92,44 L 88,46 L 84,42 L 80,46 L 30,46 L 28,52 L 22,55 L 18,55 Z"
        fill={bodyColor}
      />

      {/* Mane */}
      <path
        d="M 78,30 Q 82,24 86,22 L 88,30 Q 86,32 82,32 Z M 84,26 Q 88,21 92,20 L 92,26 Q 89,28 86,28 Z"
        fill={bodyColor}
        style={{ filter: 'brightness(0.7)' }}
      />

      {/* Tail */}
      <path d="M 12,42 Q 6,40 4,46 Q 8,50 14,48 Z" fill={bodyColor} style={{ filter: 'brightness(0.75)' }} />

      {/* Pattern overlay */}
      <g clipPath={`url(#${clipId})`}>
        {pattern === 'blaze' && (
          <path d="M 96,16 L 97,30 L 99,30 L 100,16 Z" fill={pc} />
        )}
        {pattern === 'stockings' && (
          <>
            <rect x="29" y="48" width="5" height="14" fill={pc} />
            <rect x="38" y="48" width="5" height="14" fill={pc} />
            <rect x="62" y="48" width="5" height="14" fill={pc} />
            <rect x="74" y="48" width="5" height="14" fill={pc} />
          </>
        )}
        {pattern === 'dapple' && (
          <>
            <circle cx="35" cy="36" r="2" fill={pc} opacity="0.7" />
            <circle cx="45" cy="40" r="2.2" fill={pc} opacity="0.7" />
            <circle cx="55" cy="36" r="1.8" fill={pc} opacity="0.7" />
            <circle cx="65" cy="40" r="2.2" fill={pc} opacity="0.7" />
            <circle cx="74" cy="36" r="2" fill={pc} opacity="0.7" />
            <circle cx="40" cy="44" r="1.5" fill={pc} opacity="0.6" />
            <circle cx="60" cy="44" r="1.7" fill={pc} opacity="0.6" />
            <circle cx="70" cy="43" r="1.6" fill={pc} opacity="0.6" />
          </>
        )}
        {pattern === 'stripes' && (
          <>
            {[30, 38, 46, 54, 62, 70, 78].map((x) => (
              <rect key={x} x={x} y="32" width="3" height="16" fill={pc} opacity="0.7" />
            ))}
          </>
        )}
        {pattern === 'splash' && (
          <>
            <path d="M 35,33 Q 42,32 48,36 Q 44,42 36,42 Z" fill={pc} opacity="0.85" />
            <path d="M 60,34 Q 70,32 76,38 Q 70,44 62,44 Z" fill={pc} opacity="0.85" />
            <ellipse cx="50" cy="46" rx="6" ry="2.5" fill={pc} opacity="0.7" />
          </>
        )}
        {pattern === 'frost' && (
          <>
            <rect x="12" y="32" width="14" height="20" fill={pc} opacity="0.6" />
            <rect x="80" y="32" width="22" height="14" fill={pc} opacity="0.5" />
            <path d="M 30,32 L 80,32 L 80,38 L 30,38 Z" fill={pc} opacity="0.25" />
          </>
        )}
        {pattern === 'flame' && (
          <>
            <path d="M 12,38 Q 16,32 22,32 L 28,36 Q 26,42 22,44 Q 18,48 12,46 Z" fill={pc} opacity="0.9" />
            <path d="M 14,40 Q 18,36 22,36 L 26,40 Q 22,44 18,44 Z" fill="#fde047" opacity="0.85" />
          </>
        )}
        {pattern === 'royal' && (
          <>
            <path d="M 35,32 L 75,32 L 78,38 L 32,38 Z" fill={pc} opacity="0.85" />
            <rect x="48" y="36" width="14" height="3" fill={pc} opacity="0.9" />
            <circle cx="55" cy="40" r="2" fill={pc} />
          </>
        )}
      </g>

      {/* Legs */}
      <rect x="29" y="46" width="4" height="16" fill={bodyColor} rx="0.5" />
      <rect x="38" y="46" width="4" height="16" fill={bodyColor} rx="0.5" />
      <rect x="62" y="46" width="4" height="16" fill={bodyColor} rx="0.5" />
      <rect x="74" y="46" width="4" height="16" fill={bodyColor} rx="0.5" />
      {/* Hooves */}
      <rect x="29" y="60" width="4" height="2" fill="#1f2937" />
      <rect x="38" y="60" width="4" height="2" fill="#1f2937" />
      <rect x="62" y="60" width="4" height="2" fill="#1f2937" />
      <rect x="74" y="60" width="4" height="2" fill="#1f2937" />

      {/* Eye */}
      <circle cx="98" cy="22" r="1.2" fill="#0f172a" />
      {/* Ear */}
      <path d="M 90,18 L 92,12 L 94,18 Z" fill={bodyColor} style={{ filter: 'brightness(0.8)' }} />
    </svg>
  );
}

// ---------- Race simulation (matches backend) ----------
type SimHorse = {
  id: string;
  speed: number;
  stamina: number;
  consistency: number;
};
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
  const finishOrder = entrants.slice().sort((a, b) => finishTimes[a.id] - finishTimes[b.id]).map((h) => h.id);
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

// ---------- Race Track ----------
function RaceTrack({
  lineup,
  sim,
  elapsedMs,
  raceMs,
  isRacing,
  phase,
  betKeys,
  onLaneClick,
}: {
  lineup: HorseRaceLineupEntry[];
  sim: SimResult;
  elapsedMs: number;
  raceMs: number;
  isRacing: boolean;
  phase: string;
  betKeys: Set<string>;
  onLaneClick: (entry: HorseRaceLineupEntry) => void;
}) {
  const showFinishPos = phase !== 'betting';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.18),_transparent_60%),linear-gradient(180deg,_rgba(6,30,18,0.9),_rgba(2,16,10,0.95))] p-2 sm:p-2.5">
      <div className="space-y-1">
        {lineup.map((entry) => {
          const pos = (isRacing || phase === 'results' || phase === 'past')
            ? interpAt(sim.positions[entry.betKey] ?? [0], elapsedMs)
            : 0;
          const pct = (pos / TRACK_UNITS) * 100;
          const finishPos = showFinishPos && entry.finishPos ? entry.finishPos : 0;
          const isMyBet = betKeys.has(entry.betKey);
          return (
            <button
              key={entry.lane}
              type="button"
              onClick={() => onLaneClick(entry)}
              className={cn(
                'group relative flex h-12 w-full items-center gap-2 rounded-lg border px-1.5 text-left transition',
                'border-white/5 bg-black/30 hover:border-white/15 hover:bg-black/40',
                isMyBet && 'ring-1 ring-emerald-400/70',
              )}
            >
              <span className="w-4 shrink-0 text-center font-mono text-[9px] text-white/35">{entry.lane}</span>
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.bodyColor }} />
              <span className="w-24 shrink-0 truncate text-[11px] font-medium text-white/90 sm:w-32">
                {entry.name}
                {!entry.isComputer && (
                  <span className="ml-1 text-[8px] text-amber-300/80">🏠</span>
                )}
              </span>
              {entry.odds != null && (
                <span className="hidden shrink-0 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-200 sm:inline-block">
                  {formatOdds(entry.odds)}
                </span>
              )}
              {entry.wasDoped && phase !== 'betting' && (
                <span className={cn(
                  'hidden rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase md:inline-block',
                  entry.wasCaught ? 'bg-rose-500/30 text-rose-200' : 'bg-amber-500/30 text-amber-200',
                )}>
                  {entry.wasCaught ? 'DQ dopage' : 'Dopé'}
                </span>
              )}
              {finishPos > 0 && (
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                    finishPos === 1 && 'bg-amber-400/95 text-amber-950',
                    finishPos === 2 && 'bg-slate-300/85 text-slate-900',
                    finishPos === 3 && 'bg-amber-700/90 text-white',
                    finishPos > 3 && 'bg-white/15 text-white/70',
                  )}
                >
                  #{finishPos}
                </span>
              )}
              <div className="relative h-full flex-1">
                <div className="absolute inset-y-1.5 left-0 right-0 rounded bg-gradient-to-b from-emerald-700/25 to-emerald-900/20" />
                <div
                  className="absolute inset-y-2 left-0 right-0 opacity-40"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 18px, rgba(255,255,255,0.18) 18px 19px)',
                    backgroundPositionX: isRacing ? `${-(elapsedMs / 30) % 18}px` : '0',
                  }}
                />
                <div className="absolute inset-y-1 left-0.5 w-0.5 rounded-full bg-white/45" />
                <div className="absolute inset-y-0 right-0.5 w-1 rounded-sm bg-amber-300/85" />
                <div
                  className="absolute top-1/2"
                  style={{
                    left: `calc(${pct}% - 24px)`,
                    width: '48px',
                    height: '32px',
                    transform: 'translateY(-50%)',
                    transition: isRacing ? 'left 100ms linear' : 'none',
                    filter: isMyBet ? 'drop-shadow(0 0 6px rgba(52,211,153,0.85))' : undefined,
                  }}
                >
                  <HorseSilhouette
                    bodyColor={entry.bodyColor}
                    pattern={entry.pattern}
                    patternColor={entry.patternColor}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Reusable: tiny stat bar ----------
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

// ---------- Horse card (used in stable views) ----------
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
  config,
  onSelect,
  selected,
  showActions,
}: {
  horse: StableHorseDto;
  config: HorseRaceConfig;
  onSelect?: () => void;
  selected?: boolean;
  showActions?: boolean;
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
        showActions === false && 'cursor-default hover:border-border/40 hover:bg-card/70',
      )}
    >
      <div className="flex items-stretch">
        <div className="flex w-24 shrink-0 items-center justify-center bg-gradient-to-br from-emerald-950/40 to-slate-900/40 p-1">
          <div className="h-14 w-20">
            <HorseSilhouette
              bodyColor={horse.bodyColor}
              pattern={horse.pattern}
              patternColor={horse.patternColor}
            />
          </div>
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
        </div>
      </div>
    </button>
  );
}

// ---------- Create Stable modal ----------
function CreateStableModal({
  open,
  onClose,
  onCreated,
  config,
  userMoney,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
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
      onCreated();
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Créer une écurie</DialogTitle>
          <DialogDescription>
            Votre clan aura accès à toute l'écurie. Coût: {formatMoney(config.STABLE_CREATE_COST)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nom de l'écurie</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Les Galopants" maxLength={40} />
          </div>
          <div className="flex justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Votre solde</span>
            <span className={cn('font-semibold', userMoney < config.STABLE_CREATE_COST ? 'text-rose-300' : 'text-foreground')}>
              {formatMoney(userMoney)}
            </span>
          </div>
          <Button
            className="w-full"
            disabled={busy || userMoney < config.STABLE_CREATE_COST || name.trim().length < 3}
            onClick={submit}
          >
            {busy ? '...' : `Créer pour ${formatMoney(config.STABLE_CREATE_COST)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Place Bet modal ----------
function BetModal({
  open,
  onClose,
  state,
  config,
  userMoney,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  state: HorseRaceStateResponse | null;
  config: HorseRaceConfig;
  userMoney: number;
  onPlaced: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState('100');
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
      setAmount('100');
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
      setAmount('100');
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Placer un pari</DialogTitle>
          <DialogDescription>
            Jusqu'à {config.MAX_BETS_PER_USER} paris sur des chevaux différents. Cote × mise = gain potentiel.
          </DialogDescription>
        </DialogHeader>

        {/* Current bets list */}
        {state && state.myBets.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
              Mes paris ({state.myBets.length}/{config.MAX_BETS_PER_USER})
            </p>
            {state.myBets.map((b) => {
              const entry = state.lineup.find((e) => e.betKey === b.horseId);
              if (!entry) return null;
              return (
                <div key={b.id} className="flex items-center gap-2 rounded border border-border/40 bg-background/60 p-1.5 text-xs">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: entry.bodyColor }} />
                  <span className="flex-1 truncate font-medium">{entry.name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatMoney(b.amount)}</span>
                  <span className="tabular-nums text-amber-200">
                    {entry.odds != null ? `→ ${formatMoney(b.amount * entry.odds)}` : ''}
                  </span>
                  {isOpenForBets && !b.settled && (
                    <button
                      type="button"
                      onClick={() => cancelBet(b.id)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/10"
                      disabled={busy}
                    >
                      Annuler
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Lineup picker */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sélectionnez un cheval
          </p>
          <div className="grid max-h-[40vh] grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
            {state?.lineup.map((entry) => {
              const isAlreadyBet = myBetKeys.has(entry.betKey);
              const isSelected = selected === entry.betKey;
              return (
                <button
                  key={entry.lane}
                  type="button"
                  onClick={() => !isAlreadyBet && setSelected(entry.betKey)}
                  disabled={isAlreadyBet || !isOpenForBets || !canAddMore}
                  className={cn(
                    'flex items-center gap-2 rounded-md border border-border/40 bg-card p-2 text-left transition',
                    !isAlreadyBet && 'hover:border-amber-400/40',
                    isSelected && 'border-amber-400/70 ring-1 ring-amber-400/60',
                    isAlreadyBet && 'opacity-50',
                  )}
                >
                  <div className="h-10 w-14 shrink-0">
                    <HorseSilhouette
                      bodyColor={entry.bodyColor}
                      pattern={entry.pattern}
                      patternColor={entry.patternColor}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {entry.name}
                      {!entry.isComputer && <span className="ml-1 text-[10px] text-amber-300">🏠</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {entry.clanName ?? 'Cheval de l\'ordi'}
                      {entry.ageYears != null && ` · ${entry.ageYears.toFixed(1)} ans`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-semibold text-amber-200">
                      {entry.odds != null ? formatOdds(entry.odds) : '—'}
                    </p>
                    {isAlreadyBet && <p className="text-[9px] text-muted-foreground">parié</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount + place */}
        <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Mise (en €)</span>
            <span>Disponible: {formatMoney(userMoney)} · Plafond total: {formatMoney(remainingTotalCap)}</span>
          </div>
          <Input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!isOpenForBets || !canAddMore}
          />
          <div className="flex flex-wrap gap-1">
            {[100, 500, 1000, 5000, 10000].map((v) => (
              <Button
                key={v}
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                disabled={!isOpenForBets || !canAddMore}
                onClick={() => setAmount(String(v))}
              >
                ${v}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={!isOpenForBets || !canAddMore}
              onClick={() => setAmount(String(Math.min(userMoney, remainingTotalCap)))}
            >
              Max
            </Button>
          </div>
          {selected && (
            <div className="rounded border border-amber-400/30 bg-amber-500/10 p-2 text-xs">
              <p className="text-amber-200">
                Gain potentiel:{' '}
                <span className="font-semibold">
                  {(() => {
                    const e = state?.lineup.find((x) => x.betKey === selected);
                    const amt = Math.max(1, Math.floor(Number(amount) || 0));
                    return e?.odds ? formatMoney(amt * e.odds) : '—';
                  })()}
                </span>
              </p>
            </div>
          )}
          <Button
            className="w-full"
            disabled={!isOpenForBets || !canAddMore || !selected || busy || Number(amount) <= 0 || Number(amount) > userMoney}
            onClick={submit}
          >
            {busy ? '...' : 'Placer le pari'}
          </Button>
          {!isOpenForBets && (
            <p className="text-center text-[11px] text-rose-300">Les paris sont fermés pour cette course.</p>
          )}
          {!canAddMore && (
            <p className="text-center text-[11px] text-amber-300">Limite de {config.MAX_BETS_PER_USER} paris atteinte.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Stable Management modal ----------
function StableModal({
  open,
  onClose,
  stable,
  config,
  patterns,
  userMoney,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  stable: StableMeDto | null;
  config: HorseRaceConfig;
  patterns: PatternDto[];
  userMoney: number;
  onUpdated: () => void;
}) {
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);
  const [foalName, setFoalName] = useState('');
  const [breedH1, setBreedH1] = useState<string>('');
  const [breedH2, setBreedH2] = useState<string>('');
  const [newHorseName, setNewHorseName] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'horses' | 'buy' | 'breed'>('horses');

  const horses = stable?.stable?.horses ?? [];
  const selected = horses.find((h) => h.id === selectedHorseId);

  useEffect(() => {
    if (!open) setSelectedHorseId(null);
  }, [open]);

  const doRegister = async (count: number) => {
    if (!selected) return;
    try {
      setBusy(true);
      await horseRaceApi.registerHorse(selected.id, count);
      toast.success(`${count} inscription(s) ajoutée(s).`);
      onUpdated();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const doTrain = async (stat: 'speed' | 'stamina' | 'consistency') => {
    if (!selected) return;
    try {
      setBusy(true);
      await horseRaceApi.trainHorse(selected.id, stat);
      toast.success(`+${config.HORSE_TRAIN_INC} ${stat}`);
      onUpdated();
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
      onUpdated();
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
      onUpdated();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const doBuy = async () => {
    if (newHorseName.trim().length < 2) {
      toast.error('Nom invalide.');
      return;
    }
    try {
      setBusy(true);
      await horseRaceApi.buyHorse({ name: newHorseName.trim() });
      toast.success('Nouveau cheval !');
      setNewHorseName('');
      onUpdated();
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
      onUpdated();
      setTab('horses');
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Écurie {stable?.stable?.name ?? ''}
          </DialogTitle>
          <DialogDescription>
            {stable?.stable && (
              <>
                {stable.stable.totalWins} victoires · {stable.stable.totalRaces} courses · Réputation {stable.stable.reputation}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'horses' | 'buy' | 'breed')}>
          <TabsList>
            <TabsTrigger value="horses">Chevaux ({horses.length})</TabsTrigger>
            <TabsTrigger value="buy"><Plus className="mr-1 h-3 w-3" /> Acheter</TabsTrigger>
            <TabsTrigger value="breed"><Dna className="mr-1 h-3 w-3" /> Élevage</TabsTrigger>
          </TabsList>

          <TabsContent value="horses" className="space-y-3">
            {horses.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                Pas encore de chevaux. Allez dans l'onglet "Acheter" pour commencer.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
                <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                  {horses.map((h) => (
                    <HorseCard
                      key={h.id}
                      horse={h}
                      config={config}
                      onSelect={() => setSelectedHorseId(h.id)}
                      selected={selectedHorseId === h.id}
                    />
                  ))}
                </div>
                {selected ? (
                  <div className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-3">
                    <div>
                      <p className="text-sm font-semibold">{selected.name}</p>
                      <p className="text-[10px] text-muted-foreground">{selected.experience} XP · {selected.races} courses</p>
                    </div>

                    {/* Register */}
                    <div className="space-y-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
                        Inscriptions ({selected.pendingEntries} en file)
                      </p>
                      <div className="flex gap-1">
                        {[1, 3, 5, 10].map((n) => (
                          <Button
                            key={n}
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 px-1 text-[11px]"
                            disabled={busy || selected.ageYears < config.MIN_AGE_TO_RACE}
                            onClick={() => doRegister(n)}
                          >
                            +{n}
                          </Button>
                        ))}
                      </div>
                      {selected.ageYears < config.MIN_AGE_TO_RACE && (
                        <p className="text-[10px] text-rose-300">Trop jeune pour courir.</p>
                      )}
                    </div>

                    {/* Train */}
                    <div className="space-y-1.5 rounded-md border border-sky-500/25 bg-sky-500/5 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-200">
                        Entraînement · {formatMoney(config.HORSE_TRAIN_COST)} · +{config.HORSE_TRAIN_INC}
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy || selected.trainSpeed >= config.HORSE_TRAIN_CAP} onClick={() => doTrain('speed')}>
                          🏃 Vit. {selected.trainSpeed.toFixed(1)}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy || selected.trainStamina >= config.HORSE_TRAIN_CAP} onClick={() => doTrain('stamina')}>
                          🫁 End. {selected.trainStamina.toFixed(1)}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy || selected.trainConsistency >= config.HORSE_TRAIN_CAP} onClick={() => doTrain('consistency')}>
                          🎯 Cst. {selected.trainConsistency.toFixed(1)}
                        </Button>
                      </div>
                    </div>

                    {/* Customize */}
                    <CustomizeBlock
                      horse={selected}
                      patterns={patterns}
                      config={config}
                      onUpdated={onUpdated}
                    />

                    {/* Dope (danger) */}
                    <div className="space-y-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 p-2">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-rose-200">
                        <Skull className="h-3 w-3" /> Dopage · {formatMoney(config.DOPE_COST)}
                      </p>
                      <p className="text-[10px] text-rose-200/80">
                        Boost +{config.DOPE_SPEED_BOOST} vitesse, +{config.DOPE_STAMINA_BOOST} endurance.{' '}
                        <span className="font-semibold">{Math.round(config.DOPE_CATCH_PCT * 100)}% de chance de contrôle positif</span> — cheval confisqué si attrapé.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-[11px] border-rose-500/40 text-rose-200 hover:bg-rose-500/20"
                        disabled={busy || selected.dopedForCycle != null}
                        onClick={doDope}
                      >
                        {selected.dopedForCycle != null ? 'Dopé pour la prochaine' : 'Doper pour la prochaine course'}
                      </Button>
                    </div>

                    {/* Retire */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-[11px] text-muted-foreground hover:text-rose-300"
                      disabled={busy}
                      onClick={doRetire}
                    >
                      Vendre/retirer (rembours. {formatMoney(Math.floor(config.HORSE_BUY_COST * 0.3))})
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/40 bg-muted/10 p-4 text-center text-sm text-muted-foreground">
                    Sélectionnez un cheval pour le gérer.
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="buy" className="space-y-3">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-sm font-semibold">Acheter un poulain de base</p>
              <p className="text-[11px] text-muted-foreground">
                Gènes aléatoires (5.5-7.5 par stat). Coût: {formatMoney(config.HORSE_BUY_COST)}.
              </p>
            </div>
            <Input
              placeholder="Nom du cheval"
              value={newHorseName}
              onChange={(e) => setNewHorseName(e.target.value)}
              maxLength={30}
            />
            <Button
              className="w-full"
              disabled={busy || userMoney < config.HORSE_BUY_COST || newHorseName.trim().length < 2}
              onClick={doBuy}
            >
              {busy ? '...' : `Acheter pour ${formatMoney(config.HORSE_BUY_COST)}`}
            </Button>
          </TabsContent>

          <TabsContent value="breed" className="space-y-3">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-sm font-semibold">Croisement (élevage)</p>
              <p className="text-[11px] text-muted-foreground">
                Le poulain hérite des gènes des parents avec un peu d'aléatoire. Min. {config.MIN_AGE_TO_BREED} ans par parent.
                Coût: {formatMoney(config.BREED_COST)}.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Parent 1</label>
                <Select value={breedH1} onValueChange={setBreedH1}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {horses.filter((h) => h.ageYears >= config.MIN_AGE_TO_BREED).map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.name} ({h.ageYears.toFixed(1)}a)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Parent 2</label>
                <Select value={breedH2} onValueChange={setBreedH2}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {horses.filter((h) => h.ageYears >= config.MIN_AGE_TO_BREED && h.id !== breedH1).map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.name} ({h.ageYears.toFixed(1)}a)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input
              placeholder="Nom du poulain"
              value={foalName}
              onChange={(e) => setFoalName(e.target.value)}
              maxLength={30}
            />
            <Button
              className="w-full"
              disabled={busy || userMoney < config.BREED_COST || !breedH1 || !breedH2 || foalName.trim().length < 2}
              onClick={doBreed}
            >
              {busy ? '...' : `Croiser pour ${formatMoney(config.BREED_COST)}`}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CustomizeBlock({
  horse,
  patterns,
  config,
  onUpdated,
}: {
  horse: StableHorseDto;
  patterns: PatternDto[];
  config: HorseRaceConfig;
  onUpdated: () => void;
}) {
  const [bodyColor, setBodyColor] = useState(horse.bodyColor);
  const [patternColor, setPatternColor] = useState(horse.patternColor);
  const [pattern, setPattern] = useState(horse.pattern);
  const [name, setName] = useState(horse.name);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBodyColor(horse.bodyColor);
    setPatternColor(horse.patternColor);
    setPattern(horse.pattern);
    setName(horse.name);
  }, [horse.id, horse.bodyColor, horse.patternColor, horse.pattern, horse.name]);

  const customizeNeeded = bodyColor !== horse.bodyColor || pattern !== horse.pattern || patternColor !== horse.patternColor;
  const nameChanged = name !== horse.name && name.trim().length >= 2;

  const apply = async () => {
    try {
      setBusy(true);
      const data: { name?: string; bodyColor?: string; pattern?: string; patternColor?: string } = {};
      if (nameChanged) data.name = name.trim();
      if (customizeNeeded) {
        data.bodyColor = bodyColor;
        data.pattern = pattern;
        data.patternColor = patternColor;
      }
      await horseRaceApi.updateHorse(horse.id, data);
      toast.success('Cheval mis à jour.');
      onUpdated();
    } catch (err) {
      const m = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erreur.';
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-fuchsia-500/25 bg-fuchsia-500/5 p-2">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200">
        <Palette className="h-3 w-3" /> Customisation
        {customizeNeeded && <span className="ml-auto text-[10px] text-fuchsia-100">{formatMoney(config.CUSTOMIZE_COST)}</span>}
      </p>
      <div className="space-y-1.5">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="h-7 text-xs" placeholder="Nom (gratuit)" />
        <div className="flex items-center gap-2 text-xs">
          <label className="w-20 text-muted-foreground">Robe</label>
          <input
            type="color"
            value={bodyColor}
            onChange={(e) => setBodyColor(e.target.value)}
            className="h-6 w-12 cursor-pointer rounded border border-border bg-transparent"
          />
          <span className="font-mono text-[10px] text-muted-foreground">{bodyColor}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="w-20 text-muted-foreground">Motif col.</label>
          <input
            type="color"
            value={patternColor}
            onChange={(e) => setPatternColor(e.target.value)}
            className="h-6 w-12 cursor-pointer rounded border border-border bg-transparent"
          />
          <span className="font-mono text-[10px] text-muted-foreground">{patternColor}</span>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Motif</label>
          <div className="grid grid-cols-3 gap-1">
            {patterns.map((p) => (
              <button
                key={p.key}
                type="button"
                disabled={!p.unlocked}
                onClick={() => p.unlocked && setPattern(p.key)}
                className={cn(
                  'rounded border border-border/40 bg-card/60 px-1 py-1 text-[10px]',
                  pattern === p.key && 'border-amber-400 ring-1 ring-amber-400',
                  !p.unlocked && 'opacity-40',
                )}
                title={p.unlocked ? p.label : `Débloqué à ${p.unlockWins} victoires`}
              >
                <div className="mx-auto h-6 w-12">
                  <HorseSilhouette bodyColor={bodyColor} pattern={p.key} patternColor={patternColor} />
                </div>
                <div className="mt-0.5 truncate">{p.label}</div>
                {!p.unlocked && (
                  <div className="text-[8px] text-rose-300">🔒 {p.unlockWins}V</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Button
        size="sm"
        className="w-full h-7 text-[11px]"
        disabled={busy || (!customizeNeeded && !nameChanged)}
        onClick={apply}
      >
        {!customizeNeeded && nameChanged ? 'Renommer (gratuit)' : `Appliquer ${customizeNeeded ? formatMoney(config.CUSTOMIZE_COST) : ''}`}
      </Button>
    </div>
  );
}

// ---------- Explore Stables modal ----------
function ExploreStablesModal({
  open,
  onClose,
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Écuries de la communauté</DialogTitle>
          <DialogDescription>
            Triées par réputation (victoires & podiums cumulés).
          </DialogDescription>
        </DialogHeader>
        {selected ? (
          <div className="space-y-3">
            <button onClick={() => setSelected(null)} className="text-xs text-amber-300 hover:underline">
              ← Retour
            </button>
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-lg font-bold">{selected.name}</p>
              <p className="text-xs text-muted-foreground">
                Clan {selected.clanName} · Réputation {selected.reputation}
              </p>
              {selected.description && <p className="mt-1 text-xs">{selected.description}</p>}
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-amber-500/10 p-2">
                  <p className="text-[10px] uppercase text-amber-200/70">Victoires</p>
                  <p className="text-lg font-bold tabular-nums">{selected.totalWins}</p>
                </div>
                <div className="rounded bg-slate-500/10 p-2">
                  <p className="text-[10px] uppercase text-slate-200/70">Podiums</p>
                  <p className="text-lg font-bold tabular-nums">{selected.totalPodiums}</p>
                </div>
                <div className="rounded bg-sky-500/10 p-2">
                  <p className="text-[10px] uppercase text-sky-200/70">Courses</p>
                  <p className="text-lg font-bold tabular-nums">{selected.totalRaces}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold">Top chevaux ({selected.horseCount} au total)</p>
              <div className="space-y-1">
                {selected.topHorses.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 rounded-md border border-border/40 bg-card/50 p-2">
                    <div className="h-10 w-14">
                      <HorseSilhouette bodyColor={h.bodyColor} pattern={h.pattern} patternColor={h.patternColor} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{h.name}</p>
                      <p className="text-[10px] text-muted-foreground">{h.ageYears.toFixed(1)} ans · {h.races} courses · {h.wins} V</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
            {loading && <p className="text-center text-sm text-muted-foreground">Chargement...</p>}
            {!loading && stables.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">Aucune écurie pour l'instant.</p>
            )}
            {stables.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="flex w-full items-center gap-3 rounded-lg border border-border/40 bg-card p-2 text-left hover:border-amber-400/40"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-lg">
                  🏇
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">{s.clanName} · {s.horseCount} chevaux</p>
                </div>
                <div className="text-right text-[11px]">
                  <p className="font-semibold text-amber-200">{s.totalWins} V</p>
                  <p className="text-muted-foreground">Réput. {s.reputation}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Standings (palmarès) modal ----------
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
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<HorseRaceStandingsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    horseRaceApi.getStandings()
      .then((r) => setData(r.data))
      .catch(() => toast.error('Impossible de charger le palmarès.'))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Medal className="h-5 w-5 text-amber-300" /> Palmarès
          </DialogTitle>
          <DialogDescription>
            Derniers résultats et meilleurs chevaux.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="recent">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recent"><History className="mr-1 h-3 w-3" /> Derniers résultats</TabsTrigger>
            <TabsTrigger value="top"><Trophy className="mr-1 h-3 w-3" /> Top chevaux</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
            {loading && <p className="py-4 text-center text-sm text-muted-foreground">Chargement...</p>}
            {!loading && data && data.recentRaces.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Aucune course résolue.</p>
            )}
            {data?.recentRaces.map((r: RecentRaceDto) => (
              <div key={r.cycleIndex} className="rounded-lg border border-border/40 bg-card/50 p-2.5">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold">Course #{r.cycleIndex}</span>
                  <span className="text-muted-foreground">
                    {r.totalBets} paris · {formatMoney(r.totalPool)} pool
                  </span>
                </div>
                <div className="space-y-1">
                  {r.podium.map((p) => (
                    <div key={p.position} className="flex items-center gap-2 rounded-md border border-border/30 bg-muted/20 px-2 py-1 text-xs">
                      <span className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                        p.position === 1 && 'bg-amber-400 text-amber-950',
                        p.position === 2 && 'bg-slate-300 text-slate-900',
                        p.position === 3 && 'bg-orange-400 text-orange-950',
                      )}>
                        {p.position}
                      </span>
                      <div className="h-7 w-10 shrink-0">
                        <HorseSilhouette
                          bodyColor={p.bodyColor ?? '#94a3b8'}
                          pattern={p.pattern}
                          patternColor={p.patternColor}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.name ?? 'Cheval'}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {p.isComputer ? 'Cheval IA' : `${p.stableName ?? '—'}${p.clanName ? ' · ' + p.clanName : ''}`}
                        </p>
                      </div>
                      <div className="text-right text-[10px]">
                        <p className="font-mono tabular-nums">{(p.finishTimeMs / 1000).toFixed(2)}s</p>
                        {p.prize > 0 && <p className="text-emerald-300">+{formatMoney(p.prize)}</p>}
                      </div>
                      {p.wasCaught && <span className="rounded bg-rose-500/30 px-1 py-0.5 text-[9px] text-rose-200">DQ</span>}
                      {p.wasDoped && !p.wasCaught && <span className="rounded bg-amber-500/30 px-1 py-0.5 text-[9px] text-amber-200">D</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="top" className="max-h-[65vh] space-y-1.5 overflow-y-auto pr-1">
            {loading && <p className="py-4 text-center text-sm text-muted-foreground">Chargement...</p>}
            {!loading && data && data.topHorses.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Aucun cheval qualifié.</p>
            )}
            {data?.topHorses.map((h: TopHorseDto, i: number) => (
              <div key={h.id} className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/50 p-2">
                <span className="w-5 text-center font-mono text-sm text-muted-foreground">#{i + 1}</span>
                <div className="h-12 w-16 shrink-0">
                  <HorseSilhouette bodyColor={h.bodyColor} pattern={h.pattern} patternColor={h.patternColor} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{h.name}</p>
                    <span className="rounded bg-muted/40 px-1 py-0.5 text-[9px] text-muted-foreground">{h.ageYears.toFixed(1)} ans</span>
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {h.stableName ?? '—'}{h.clanName ? ' · ' + h.clanName : ''} · {h.experience} XP
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <StatChip label="VIT" value={h.stats.speed} />
                    <StatChip label="END" value={h.stats.stamina} />
                    <StatChip label="REG" value={h.stats.consistency} />
                  </div>
                </div>
                <div className="shrink-0 text-right text-[11px]">
                  <p className="font-semibold text-amber-200">{h.wins} V</p>
                  <p className="text-muted-foreground">{h.podiums} P · {h.races} C</p>
                  <p className="text-emerald-300">{formatMoney(h.earnings)}</p>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Confiscation notification modal ----------
function ConfiscationModal({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-300">
            <ShieldAlert className="h-5 w-5" /> Contrôle anti-dopage
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">{message}</p>
          <p className="text-xs text-muted-foreground">
            Les commissaires ont saisi votre cheval. Il n'est plus disponible dans votre écurie.
          </p>
          <Button className="w-full" onClick={onClose}>J'ai compris</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main page ----------
export default function HorseRace() {
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState<HorseRaceConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<HorseRaceStateResponse | null>(null);
  const [stable, setStable] = useState<StableMeDto | null>(null);
  const [patterns, setPatterns] = useState<PatternDto[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const [betModalOpen, setBetModalOpen] = useState(false);
  const [stableModalOpen, setStableModalOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [createStableOpen, setCreateStableOpen] = useState(false);
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [confiscationMsg, setConfiscationMsg] = useState<string | null>(null);
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

  // Load config once.
  useEffect(() => {
    horseRaceApi.getConfig()
      .then((r) => setConfig(r.data))
      .catch(() => { /* fall back to defaults */ });
  }, []);

  // Poll state + me/stable.
  const refreshState = useCallback(async () => {
    try {
      const r = await horseRaceApi.getState();
      setState(r.data);
    } catch { /* ignore */ }
  }, []);
  const refreshStable = useCallback(async () => {
    try {
      const r = await horseRaceApi.getMyStable();
      setStable(r.data);
    } catch { /* ignore */ }
  }, []);
  const refreshPatterns = useCallback(async () => {
    try {
      const r = await horseRaceApi.getPatterns();
      setPatterns(r.data.patterns);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void refreshState();
    void refreshStable();
    void refreshPatterns();
    const id = window.setInterval(() => { void refreshState(); }, 3000);
    return () => window.clearInterval(id);
  }, [refreshState, refreshStable, refreshPatterns]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  // After race resolution (cycle changed), refresh stable and user money/aura.
  useEffect(() => {
    if (state?.phase === 'results' && state.cycleIndex !== lastResolvedCycle.current) {
      lastResolvedCycle.current = state.cycleIndex;
      // Allow server a moment to settle then refresh
      const t1 = window.setTimeout(() => {
        void refreshUser();
        void refreshStable();
        void refreshPatterns();
      }, 1500);
      return () => window.clearTimeout(t1);
    }
  }, [state?.phase, state?.cycleIndex, refreshUser, refreshStable, refreshPatterns]);

  // Detect freshly confiscated horses (caught doping).
  useEffect(() => {
    if (!state || state.phase !== 'results') return;
    for (const e of state.lineup) {
      if (e.wasCaught && e.horseId && !seenConfiscatedHorses.current.has(e.horseId)) {
        seenConfiscatedHorses.current.add(e.horseId);
        // Only show modal if this horse belongs to my stable.
        const mine = stable?.stable?.horses.some((h) => h.id === e.horseId);
        // Use lineup data: even if removed from stable now, we can match horseId.
        // To make sure it's mine, prefer matching against my stable's prior horse list.
        if (mine === true || (stable?.stable && state.lineup.find((x) => x.horseId === e.horseId)?.stableId === stable.stable?.id)) {
          setConfiscationMsg(`${e.name} a été contrôlé positif au dopage. Le cheval est confisqué.`);
        }
      }
    }
  }, [state, stable]);

  // Build simulation from lineup for animation.
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

  return (
    <PageShell size="full">
      <style>{`
        @keyframes hr-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
      `}</style>

      <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-2.5 lg:h-[calc(100vh-7rem)]">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/40 bg-card/80 px-3 py-2 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏇</span>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">
                Hippodrome de Longchamp — Course #{cycleIndex}
              </h1>
              <p className="text-[10px] text-muted-foreground">
                Course toutes les 5 min · vos chevaux gagnent prizemoney + aura · paris × cote
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'gap-1 border-amber-400/40 bg-amber-500/10 text-amber-200',
                phase === 'racing' && 'border-rose-400/50 bg-rose-500/10 text-rose-200',
                phase === 'results' && 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
              )}
            >
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full bg-current', phase === 'racing' && 'animate-pulse')} />
              {phaseLabel}
            </Badge>
            <span className="hidden text-[11px] font-mono tabular-nums text-muted-foreground sm:inline-block">
              {phase === 'betting' && `Départ ${formatMs(phaseRemaining)}`}
              {phase === 'racing' && `${formatMs(elapsedInPhase)} / ${formatMs(config.RACE_MS)}`}
              {phase === 'results' && `Prochaine ${formatMs(phaseRemaining)}`}
            </span>
            <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-200">
              <Wallet className="h-3 w-3" />
              <span className="tabular-nums font-semibold">{formatMoney(userMoney)}</span>
            </div>
            <Button size="sm" variant="outline" className="h-7" onClick={() => setStandingsOpen(true)}>
              <Medal className="mr-1 h-3 w-3" /> Palmarès
            </Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => setExploreOpen(true)}>
              <Users className="mr-1 h-3 w-3" /> Écuries
            </Button>
            {stable?.stable ? (
              <Button size="sm" variant="outline" className="h-7" onClick={() => setStableModalOpen(true)}>
                <Building2 className="mr-1 h-3 w-3" /> Mon écurie ({stable.stable.horses.length})
              </Button>
            ) : stable?.hasClan ? (
              <Button size="sm" className="h-7" onClick={() => setCreateStableOpen(true)}>
                <Plus className="mr-1 h-3 w-3" /> Créer écurie
              </Button>
            ) : (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                Rejoignez un clan pour gérer une écurie
              </span>
            )}
          </div>
        </header>

        <Progress
          value={Math.min(100, (elapsedInPhase / totalPhase) * 100)}
          className={cn(
            'h-1 rounded-full',
            phase === 'racing' && '[&>div]:bg-rose-500',
            phase === 'results' && '[&>div]:bg-emerald-500',
            phase === 'betting' && '[&>div]:bg-amber-500',
          )}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Left: race track */}
          <div className="flex min-h-0 flex-col gap-2.5">
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Piste principale · 🏠 = cheval de joueur</span>
                  <span>{config.ENTRANTS} partants · ligne d'arrivée à droite</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {state && state.lineup.length > 0 ? (
                    <RaceTrack
                      lineup={state.lineup}
                      sim={sim}
                      elapsedMs={phase === 'racing' ? elapsedInPhase : phase === 'results' ? config.RACE_MS : 0}
                      raceMs={config.RACE_MS}
                      isRacing={phase === 'racing'}
                      phase={phase}
                      betKeys={myBetKeys}
                      onLaneClick={() => setBetModalOpen(true)}
                    />
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">Chargement du peloton...</p>
                  )}
                </div>

                {phase === 'results' && winner && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
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

          {/* Right column: my bets, my horses in race, history */}
          <div className="flex min-h-0 flex-col gap-2.5">
            {/* Big bet CTA */}
            <Button
              size="lg"
              className="w-full"
              disabled={phase !== 'betting'}
              onClick={() => setBetModalOpen(true)}
            >
              <Tag className="mr-2 h-4 w-4" />
              {phase === 'betting' ? 'Placer un pari' : 'Paris fermés'}
            </Button>

            {/* My bets summary */}
            <Card className="overflow-hidden">
              <CardContent className="space-y-1.5 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider">Mes paris</p>
                  <span className="text-[10px] text-muted-foreground">
                    {state?.myBets.length ?? 0}/{config.MAX_BETS_PER_USER}
                  </span>
                </div>
                {state && state.myBets.length > 0 ? (
                  state.myBets.map((b) => {
                    const entry = state.lineup.find((e) => e.betKey === b.horseId);
                    if (!entry) return null;
                    return (
                      <div key={b.id} className="flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-2 py-1 text-xs">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.bodyColor }} />
                        <span className="flex-1 truncate font-medium">{entry.name}</span>
                        <span className="tabular-nums text-muted-foreground">{formatMoney(b.amount)}</span>
                        {b.settled ? (
                          <span className={cn('tabular-nums font-semibold', b.payout > 0 ? 'text-emerald-300' : 'text-rose-300')}>
                            {b.payout > 0 ? `+${formatMoney(b.payout)}` : 'Perdu'}
                          </span>
                        ) : entry.odds ? (
                          <span className="tabular-nums text-amber-200">→ {formatMoney(b.amount * entry.odds)}</span>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-md border border-dashed border-border/60 bg-muted/30 px-2 py-1.5 text-[11px] italic text-muted-foreground">
                    Pas de paris pour cette course.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* My horses in this race */}
            {myHorsesInRace.length > 0 && (
              <Card>
                <CardContent className="space-y-1.5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider">Mes chevaux dans la course</p>
                  {myHorsesInRace.map((e) => (
                    <div key={e.lane} className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-xs">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.bodyColor }} />
                      <span className="flex-1 truncate font-medium">{e.name}</span>
                      <span className="font-mono text-[10px] text-amber-200">{e.odds ? formatOdds(e.odds) : '—'}</span>
                      {e.finishPos && <span className="rounded-full bg-amber-400/95 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">#{e.finishPos}</span>}
                      {e.prize > 0 && <span className="text-emerald-300">+{formatMoney(e.prize)}</span>}
                      {e.wasCaught && <span className="rounded bg-rose-500/30 px-1 py-0.5 text-[9px] text-rose-200">DQ</span>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Public pool snapshot */}
            <Card>
              <CardContent className="space-y-1 p-3">
                <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
                  <span>Pari mutuel</span>
                  <span className="text-[10px] text-muted-foreground">
                    {state?.totalBets ?? 0} paris · {formatMoney(state?.totalAmount ?? 0)}
                  </span>
                </p>
                {state && state.totalAmount > 0 ? (
                  state.lineup
                    .map((e) => ({ e, amt: state.entries[e.betKey]?.amount ?? 0 }))
                    .filter((x) => x.amt > 0)
                    .sort((a, b) => b.amt - a.amt)
                    .slice(0, 3)
                    .map(({ e, amt }) => {
                      const share = Math.round((amt / state.totalAmount) * 100);
                      return (
                        <div key={e.lane} className="flex items-center gap-1.5 text-[11px]">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.bodyColor }} />
                          <span className="flex-1 truncate">{e.name}</span>
                          <span className="tabular-nums text-sky-200">{share}%</span>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-[11px] italic text-muted-foreground">Aucun pari pour l'instant.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
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
        patterns={patterns}
        userMoney={userMoney}
        onUpdated={async () => {
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
