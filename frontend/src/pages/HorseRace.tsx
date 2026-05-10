import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Trophy, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/contexts/AuthContext';
import { horseRaceApi, type HorseRaceStateResponse } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const CYCLE_MS = 5 * 60 * 1000;
const RACE_MS = 60 * 1000;
const RESULTS_MS = 30 * 1000;
const BETTING_MS = CYCLE_MS - RACE_MS - RESULTS_MS;
const POOL_SIZE = 20;
const ENTRANTS = 8;
const HOUSE_EDGE = 0.10;
const POOL_SEED = 0x9e3779b9;
const TRACK_UNITS = 1000;
const SIM_DT_MS = 100;
const RETRO_RACES = 25;
const STORAGE_KEY = 'horse-race:state:v2';

const ADJECTIVES = [
  'Brave', 'Fougueux', 'Royal', 'Sauvage', 'Mystique', 'Noir', 'Doré',
  'Rapide', 'Furieux', 'Léger', 'Fier', 'Lunaire', 'Nocturne', 'Argenté',
  'Vif', 'Sombre', 'Brillant', 'Audacieux', 'Indompté', 'Rusé', 'Vaillant',
  'Élégant', 'Glorieux', 'Rebelle', 'Tenace', 'Insaisissable',
];

const NOUNS = [
  'Galop', 'Éclair', 'Vent', 'Tonnerre', 'Mistral', 'Sabot', 'Foudre',
  'Cavalier', 'Mustang', 'Pégase', 'Orage', 'Crépuscule', 'Dragon',
  'Soleil', 'Ouragan', 'Tourbillon', 'Héritier', 'Phénix', 'Comète',
  'Tempête', 'Léopard', 'Aigle', 'Météore', 'Sphinx',
];

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#a855f7',
  '#14b8a6', '#22c55e', '#dc2626', '#2563eb', '#db2777',
  '#0ea5e9', '#65a30d', '#9333ea', '#e11d48', '#0d9488',
];

type Phase = 'betting' | 'racing' | 'results';
type EventTone = 'lead' | 'incident' | 'flavor' | 'finish' | 'paddock';

type HorseInnate = {
  id: string;
  name: string;
  color: string;
  speed: number;
  stamina: number;
  consistency: number;
};

type HorseRecord = {
  races: number;
  wins: number;
  podiums: number;
  recent: number[];
};

type Horse = HorseInnate & HorseRecord;

type RaceEvent = { tMs: number; text: string; tone: EventTone };

type RaceSim = {
  cycleIndex: number;
  entrants: HorseInnate[];
  positions: Record<string, number[]>;
  finishOrder: string[];
  finishTimes: Record<string, number>;
  events: RaceEvent[];
  trueWinProbs: Record<string, number>;
  odds: Record<string, number>;
};

type Bet = { cycleIndex: number; horseId: string; amount: number };

type StoredState = {
  records: Record<string, HorseRecord>;
  retroDoneFor: number;
  pendingBet: Bet | null;
  history: Array<{
    cycleIndex: number;
    winnerName: string;
    winnerColor: string;
    bet?: { horseName: string; amount: number; payout: number; odds: number };
  }>;
};

function mulberry32(seedIn: number) {
  let seed = seedIn | 0;
  return function() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded<T>(arr: readonly T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generatePool(): HorseInnate[] {
  const rand = mulberry32(POOL_SEED);
  const adjPool = shuffleSeeded(ADJECTIVES, rand);
  const nounPool = shuffleSeeded(NOUNS, rand);
  const colorPool = shuffleSeeded(COLORS, rand);

  const horses: HorseInnate[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    horses.push({
      id: `h${i}`,
      name: `${adjPool[i % adjPool.length]} ${nounPool[i % nounPool.length]}`,
      color: colorPool[i % colorPool.length],
      // Tight stat ranges → races are close, every horse is a contender.
      speed: 6.5 + rand() * 1.5,
      stamina: 6.5 + rand() * 1.5,
      consistency: 7 + rand() * 2,
    });
  }
  return horses;
}

function pickEntrants(pool: HorseInnate[], cycleIndex: number): HorseInnate[] {
  const rand = mulberry32(POOL_SEED ^ (cycleIndex * 0x9e3779b1));
  return shuffleSeeded(pool, rand).slice(0, ENTRANTS);
}

function computeWinProbs(entrants: HorseInnate[], cycleIndex: number): Record<string, number> {
  const SAMPLES = 600;
  const wins: Record<string, number> = {};
  for (const h of entrants) wins[h.id] = 0;

  for (let s = 0; s < SAMPLES; s++) {
    const rand = mulberry32(((POOL_SEED * 17) + cycleIndex * 1009 + s * 31) | 0);
    let bestId = entrants[0].id;
    let bestTime = Infinity;
    for (const h of entrants) {
      const noise = (rand() - 0.5) * Math.max(0.4, (10 - h.consistency) * 0.6);
      const formNoise = (rand() - 0.5) * 1.4;
      const incidentRoll = rand();
      const incidentMult = incidentRoll < 0.04 ? 0.6 : incidentRoll < 0.12 ? 0.85 : 1;
      const effSpeed = Math.max(1, (h.speed + formNoise + noise) * incidentMult);
      const staminaMult = 1 + (5 - h.stamina) * 0.02;
      const time = (TRACK_UNITS / effSpeed) * staminaMult;
      if (time < bestTime) {
        bestTime = time;
        bestId = h.id;
      }
    }
    wins[bestId]++;
  }

  const probs: Record<string, number> = {};
  for (const h of entrants) probs[h.id] = Math.max(0.005, wins[h.id] / SAMPLES);
  const sum = Object.values(probs).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(probs)) probs[k] /= sum;
  return probs;
}

const FLAVOR_EVENTS = [
  'Un nudiste se faufile sur le terrain !',
  'Un spectateur saute la barrière !',
  'Un pigeon survole le peloton !',
  'Une bourrasque traverse la piste !',
  'La fanfare improvise un solo de trompette !',
  'Un parieur agite frénétiquement son ticket en tribune !',
  'Un drone maladroit frôle la dernière ligne droite !',
];

function simulateRace(entrants: HorseInnate[], cycleIndex: number): RaceSim {
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

  const totalSteps = Math.ceil(RACE_MS / SIM_DT_MS);
  const finishTimes: Record<string, number> = {};
  let leaderId: string | null = null;
  const events: RaceEvent[] = [];
  const baseTickProgress = TRACK_UNITS / (RACE_MS / SIM_DT_MS);
  const negativeAffected = new Set<string>();

  // Pre-roll up to 5 events at predetermined fractions of the race.
  const eventFractions = [0.08, 0.22, 0.4, 0.58, 0.78];
  type ScheduledEvent = { step: number; type: string };
  const scheduled: ScheduledEvent[] = [];
  for (const frac of eventFractions) {
    if (rand() < 0.7) {
      const r = rand();
      let type: string;
      if (r < 0.16) type = 'injury';
      else if (r < 0.34) type = 'stitch';
      else if (r < 0.5) type = 'stumble';
      else if (r < 0.66) type = 'second-wind';
      else if (r < 0.8) type = 'nudist';
      else if (r < 0.9) type = 'spectator';
      else type = 'flavor';
      scheduled.push({ step: Math.floor(totalSteps * frac), type });
    }
  }

  const triggerEvent = (step: number, type: string) => {
    const tMs = step * SIM_DT_MS;
    const pickHorseAvoidingAffected = (allowAffected = false) => {
      const candidates = allowAffected
        ? entrants
        : entrants.filter(e => !negativeAffected.has(e.id));
      const pool = candidates.length > 0 ? candidates : entrants;
      return pool[Math.floor(rand() * pool.length)];
    };

    switch (type) {
      case 'injury': {
        const h = pickHorseAvoidingAffected();
        speeds[h.id].mult *= 0.55;
        negativeAffected.add(h.id);
        events.push({ tMs, text: `${h.name} se blesse et perd brutalement du terrain !`, tone: 'incident' });
        return;
      }
      case 'stitch': {
        const h = pickHorseAvoidingAffected();
        speeds[h.id].mult *= 0.82;
        negativeAffected.add(h.id);
        events.push({ tMs, text: `${h.name} a un point de côté et lève le pied...`, tone: 'incident' });
        return;
      }
      case 'stumble': {
        const h = pickHorseAvoidingAffected();
        speeds[h.id].mult *= 0.9;
        events.push({ tMs, text: `${h.name} trébuche dans le virage !`, tone: 'incident' });
        return;
      }
      case 'second-wind': {
        const h = pickHorseAvoidingAffected(true);
        speeds[h.id].mult *= 1.13;
        events.push({ tMs, text: `${h.name} trouve un second souffle et accélère !`, tone: 'lead' });
        return;
      }
      case 'nudist':
        events.push({ tMs, text: 'Un nudiste se faufile sur le terrain !', tone: 'flavor' });
        return;
      case 'spectator':
        events.push({ tMs, text: 'Un spectateur saute la barrière, les commissaires interviennent !', tone: 'flavor' });
        return;
      case 'flavor':
      default:
        events.push({
          tMs,
          text: FLAVOR_EVENTS[Math.floor(rand() * FLAVOR_EVENTS.length)],
          tone: 'flavor',
        });
        return;
    }
  };

  let scheduledIdx = 0;

  for (let step = 1; step <= totalSteps; step++) {
    while (scheduledIdx < scheduled.length && scheduled[scheduledIdx].step === step) {
      triggerEvent(step, scheduled[scheduledIdx].type);
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

    let curLeader = entrants[0].id;
    let curMax = positions[entrants[0].id][step];
    for (const h of entrants) {
      const p = positions[h.id][step];
      if (p > curMax) { curMax = p; curLeader = h.id; }
    }

    if (curLeader !== leaderId) {
      const leaderHorse = entrants.find(e => e.id === curLeader)!;
      if (leaderId === null) {
        events.push({ tMs, text: `${leaderHorse.name} prend la tête au départ !`, tone: 'lead' });
      } else {
        const prevHorse = entrants.find(e => e.id === leaderId)!;
        events.push({
          tMs,
          text: `${leaderHorse.name} dépasse ${prevHorse.name} et prend la 1ère place !`,
          tone: 'lead',
        });
      }
      leaderId = curLeader;
    }
  }

  for (const h of entrants) {
    if (finishTimes[h.id] === undefined) {
      finishTimes[h.id] = RACE_MS + (TRACK_UNITS - positions[h.id][positions[h.id].length - 1]) * 50;
    }
    while (positions[h.id].length < totalSteps + 1) {
      positions[h.id].push(positions[h.id][positions[h.id].length - 1]);
    }
  }

  const finishOrder = entrants.slice().sort((a, b) => finishTimes[a.id] - finishTimes[b.id]).map(h => h.id);
  const winner = entrants.find(e => e.id === finishOrder[0])!;
  events.push({
    tMs: finishTimes[winner.id],
    text: `${winner.name} dépasse tout le monde pour arriver en 1ère place !`,
    tone: 'finish',
  });

  events.sort((a, b) => a.tMs - b.tMs);

  const trueWinProbs = computeWinProbs(entrants, cycleIndex);
  const odds: Record<string, number> = {};
  for (const h of entrants) odds[h.id] = Math.max(1.05, (1 - HOUSE_EDGE) / trueWinProbs[h.id]);

  return { cycleIndex, entrants, positions, finishOrder, finishTimes, events, trueWinProbs, odds };
}

function getPhase(now: number): { phase: Phase; cycleIndex: number; elapsedInPhase: number; totalPhase: number } {
  const cycleIndex = Math.floor(now / CYCLE_MS);
  const t = now - cycleIndex * CYCLE_MS;
  if (t < BETTING_MS) return { phase: 'betting', cycleIndex, elapsedInPhase: t, totalPhase: BETTING_MS };
  if (t < BETTING_MS + RACE_MS) return { phase: 'racing', cycleIndex, elapsedInPhase: t - BETTING_MS, totalPhase: RACE_MS };
  return { phase: 'results', cycleIndex, elapsedInPhase: t - BETTING_MS - RACE_MS, totalPhase: RESULTS_MS };
}

function loadStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredState;
      if (parsed && typeof parsed === 'object') {
        return {
          records: parsed.records ?? {},
          retroDoneFor: parsed.retroDoneFor ?? 0,
          pendingBet: parsed.pendingBet ?? null,
          history: parsed.history ?? [],
        };
      }
    }
  } catch { /* ignore */ }
  return { records: {}, retroDoneFor: 0, pendingBet: null, history: [] };
}

function saveStoredState(state: StoredState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function emptyRecord(): HorseRecord {
  return { races: 0, wins: 0, podiums: 0, recent: [] };
}

function applyRaceToRecords(
  records: Record<string, HorseRecord>,
  entrants: HorseInnate[],
  finishOrder: string[],
): Record<string, HorseRecord> {
  const next = { ...records };
  finishOrder.forEach((id, idx) => {
    const cur = next[id] ? { ...next[id] } : emptyRecord();
    cur.races += 1;
    if (idx === 0) cur.wins += 1;
    if (idx < 3) cur.podiums += 1;
    cur.recent = [idx + 1, ...cur.recent].slice(0, 6);
    next[id] = cur;
  });
  for (const h of entrants) if (!next[h.id]) next[h.id] = emptyRecord();
  return next;
}

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

function interpAt(positions: number[], elapsedMs: number): number {
  const stepFloat = elapsedMs / SIM_DT_MS;
  const stepIdx = Math.floor(stepFloat);
  const frac = stepFloat - stepIdx;
  const lastIdx = positions.length - 1;
  const a = positions[Math.min(stepIdx, lastIdx)];
  const b = positions[Math.min(stepIdx + 1, lastIdx)];
  return a + (b - a) * frac;
}

function getPaddockChatter(sim: RaceSim, cycleIndex: number): RaceEvent[] {
  const rand = mulberry32((cycleIndex * 53 + 11) | 0);
  const sortedByOdds = [...sim.entrants].sort((a, b) => sim.odds[a.id] - sim.odds[b.id]);
  const fav = sortedByOdds[0];
  const outsider = sortedByOdds[sortedByOdds.length - 1];
  const wildcard = sim.entrants[Math.floor(rand() * sim.entrants.length)];
  return [
    { tMs: 0, text: `Favori du jour : ${fav.name} à ${formatOdds(sim.odds[fav.id])}.`, tone: 'paddock' },
    { tMs: 0, text: `Outsider à surveiller : ${outsider.name} à ${formatOdds(sim.odds[outsider.id])}.`, tone: 'paddock' },
    { tMs: 0, text: `${wildcard.name} a l'air en grande forme à l'échauffement.`, tone: 'paddock' },
    { tMs: 0, text: `Le bookmaker ajuste les cotes — marge maison ${Math.round(HOUSE_EDGE * 100)}%.`, tone: 'paddock' },
  ];
}

function deriveLiveBetItems(serverState: HorseRaceStateResponse | null, sim: RaceSim): RaceEvent[] {
  if (!serverState || serverState.totalBets === 0) {
    return [{
      tMs: 0,
      text: 'Sois le premier à placer un pari sur cette course !',
      tone: 'paddock',
    }];
  }
  const items: RaceEvent[] = [
    {
      tMs: 0,
      text: `Pari mutuel : ${serverState.totalBets} pari${serverState.totalBets > 1 ? 's' : ''} placé${serverState.totalBets > 1 ? 's' : ''} pour un total de ${formatMoney(serverState.totalAmount)}.`,
      tone: 'paddock',
    },
  ];
  const top = sim.entrants
    .map(h => ({ horse: h, entry: serverState.entries[h.id] ?? { count: 0, amount: 0 } }))
    .filter(x => x.entry.amount > 0)
    .sort((a, b) => b.entry.amount - a.entry.amount)
    .slice(0, 3);
  for (const t of top) {
    const share = serverState.totalAmount > 0
      ? Math.round((t.entry.amount / serverState.totalAmount) * 100)
      : 0;
    items.push({
      tMs: 0,
      text: `${t.horse.name} totalise ${formatMoney(t.entry.amount)} de paris (${share}% du pool).`,
      tone: 'paddock',
    });
  }
  return items;
}

const HorseSilhouette = ({ color }: { color: string }) => (
  <svg viewBox="0 0 64 36" className="h-full w-full">
    <ellipse cx="34" cy="22" rx="20" ry="8" fill={color} />
    <rect x="14" y="22" width="3" height="11" fill={color} rx="1" />
    <rect x="20" y="22" width="3" height="11" fill={color} rx="1" />
    <rect x="42" y="22" width="3" height="11" fill={color} rx="1" />
    <rect x="48" y="22" width="3" height="11" fill={color} rx="1" />
    <path d="M 50 22 Q 58 16 60 6 L 56 8 Q 56 18 48 20 Z" fill={color} />
    <circle cx="58" cy="9" r="1.6" fill="#0f172a" />
    <path d="M 13 22 Q 6 24 4 30 Q 10 28 16 26 Z" fill={color} opacity="0.8" />
    <path d="M 56 7 L 59 4 L 60 7 Z" fill={color} opacity="0.85" />
  </svg>
);

const RaceTrack = ({
  sim,
  elapsedMs,
  isRacing,
  phase,
  selectedId,
  betHorseId,
  publicShare,
  onLaneClick,
}: {
  sim: RaceSim;
  elapsedMs: number;
  isRacing: boolean;
  phase: Phase;
  selectedId: string | null;
  betHorseId: string | null;
  publicShare: Record<string, number>;
  onLaneClick: (id: string) => void;
}) => {
  const showFinishPos = phase !== 'betting';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.18),_transparent_60%),linear-gradient(180deg,_rgba(6,30,18,0.9),_rgba(2,16,10,0.95))] p-2 sm:p-2.5">
      <div className="space-y-1">
        {sim.entrants.map((h, lane) => {
          const pos = isRacing || phase === 'results' ? interpAt(sim.positions[h.id], elapsedMs) : 0;
          const pct = (pos / TRACK_UNITS) * 100;
          const odds = sim.odds[h.id];
          const finishPos = showFinishPos ? sim.finishOrder.indexOf(h.id) + 1 : 0;
          const isMyBet = betHorseId === h.id;
          const isSel = selectedId === h.id;
          const share = publicShare[h.id] ?? 0;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onLaneClick(h.id)}
              className={cn(
                'group relative flex h-10 w-full items-center gap-2 rounded-lg border px-1.5 text-left transition',
                isSel ? 'border-primary/80 bg-primary/10' : 'border-white/5 bg-black/30 hover:border-white/15 hover:bg-black/40',
                isMyBet && 'ring-1 ring-emerald-400/70',
              )}
            >
              <span className="w-4 shrink-0 text-center font-mono text-[9px] text-white/35">{lane + 1}</span>
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: h.color }} />
              <span className="w-24 shrink-0 truncate text-[11px] font-medium text-white/90 sm:w-28">{h.name}</span>
              <span className="hidden shrink-0 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-200 sm:inline-block">
                {formatOdds(odds)}
              </span>
              <span className="hidden shrink-0 rounded-md border border-white/5 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-sky-200 md:inline-block" title="Part du pari mutuel">
                {Math.round(share * 100)}%
              </span>
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
                    left: `calc(${pct}% - 18px)`,
                    width: '36px',
                    height: '24px',
                    transform: 'translateY(-50%)',
                    transition: isRacing ? 'left 100ms linear' : 'none',
                    filter: isMyBet ? 'drop-shadow(0 0 5px rgba(52,211,153,0.85))' : undefined,
                  }}
                >
                  <HorseSilhouette color={h.color} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const AerialTrack = ({
  sim,
  elapsedMs,
  isRacing,
  phase,
}: {
  sim: RaceSim;
  elapsedMs: number;
  isRacing: boolean;
  phase: Phase;
}) => {
  const ranking = useMemo(() => {
    return sim.entrants
      .map((h, idx) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        idx,
        p: isRacing || phase === 'results' ? interpAt(sim.positions[h.id], elapsedMs) : 0,
      }))
      .sort((a, b) => b.p - a.p);
  }, [sim, elapsedMs, isRacing, phase]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-[linear-gradient(180deg,_rgba(15,23,42,0.95),_rgba(2,6,23,1))] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/65">
          <Eye className="h-3 w-3" />
          Vue aérienne · tout le peloton
        </div>
        <span className={cn(
          'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white',
          isRacing ? 'bg-rose-500/90' : 'bg-white/10',
        )}>
          <span className={cn('inline-block h-1 w-1 rounded-full bg-white', isRacing && 'animate-pulse')} />
          {isRacing ? 'Live' : phase === 'results' ? 'Replay' : 'Paddock'}
        </span>
      </div>

      <div className="relative h-16 overflow-hidden rounded-md border border-white/5 bg-emerald-950/40">
        <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-white/15" />
        {[20, 40, 60, 80].map(p => (
          <div key={p} className="absolute top-2 bottom-2 w-px bg-white/10" style={{ left: `${p}%` }} />
        ))}
        <div className="absolute inset-y-1 left-2 w-0.5 bg-white/55" />
        <div className="absolute inset-y-1 right-2 w-1 rounded-sm bg-amber-300/85" />

        {sim.entrants.map((h, idx) => {
          const pos = isRacing || phase === 'results' ? interpAt(sim.positions[h.id], elapsedMs) : 0;
          const pct = (pos / TRACK_UNITS) * 100;
          const yOffset = ((idx % 4) - 1.5) * 11;
          return (
            <div
              key={h.id}
              className="absolute top-1/2 h-3 w-3 rounded-full border border-white/30 shadow-[0_0_6px_rgba(0,0,0,0.6)]"
              style={{
                left: `calc(2px + ${pct}% * 0.96 - 6px)`,
                transform: `translateY(calc(-50% + ${yOffset}px))`,
                background: h.color,
                transition: isRacing ? 'left 100ms linear' : 'none',
              }}
              title={h.name}
            />
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
        {ranking.slice(0, 3).map((r, i) => (
          <div key={r.id} className="flex items-center gap-1.5 rounded-md border border-white/5 bg-white/5 px-1.5 py-0.5">
            <span className={cn(
              'flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold',
              i === 0 && 'bg-amber-400/95 text-amber-950',
              i === 1 && 'bg-slate-300/85 text-slate-900',
              i === 2 && 'bg-amber-700/90 text-white',
            )}>
              {i + 1}
            </span>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
            <span className="truncate font-medium text-white/90">{r.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

function eventToneClass(tone: EventTone): string {
  switch (tone) {
    case 'lead': return 'text-amber-100';
    case 'incident': return 'text-rose-200';
    case 'flavor': return 'text-fuchsia-200';
    case 'finish': return 'text-emerald-200';
    case 'paddock': return 'text-sky-200';
  }
}

function eventToneAccent(tone: EventTone): string {
  switch (tone) {
    case 'lead': return 'bg-amber-400';
    case 'incident': return 'bg-rose-400';
    case 'flavor': return 'bg-fuchsia-400';
    case 'finish': return 'bg-emerald-400';
    case 'paddock': return 'bg-sky-400';
  }
}

const MarqueeCommentary = ({ items, isLive }: { items: RaceEvent[]; isLive: boolean }) => {
  const stableItems = items.length > 0 ? items : [{ tMs: 0, text: 'En attente du départ...', tone: 'paddock' as const }];
  const duration = Math.max(28, stableItems.length * 6);
  return (
    <div className="relative flex items-center gap-2 overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/65 via-rose-950/45 to-amber-950/65 px-2.5 py-1.5">
      <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-rose-200">
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full bg-rose-400', isLive && 'animate-pulse')} />
        Direct
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 left-[88px] z-10 w-8"
        style={{ background: 'linear-gradient(90deg, rgba(20,8,12,0.85), transparent)' }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10"
        style={{ background: 'linear-gradient(270deg, rgba(20,8,12,0.85), transparent)' }}
      />
      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        <div
          className="flex shrink-0 items-center gap-6 whitespace-nowrap will-change-transform"
          style={{ animation: `hr-marquee ${duration}s linear infinite` }}
        >
          {stableItems.map((ev, i) => (
            <span key={`a-${i}-${ev.tMs}`} className={cn('flex items-center gap-2 text-xs sm:text-sm', eventToneClass(ev.tone))}>
              <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', eventToneAccent(ev.tone))} />
              <span className="font-medium">{ev.text}</span>
            </span>
          ))}
        </div>
        <div
          className="flex shrink-0 items-center gap-6 whitespace-nowrap will-change-transform"
          style={{ animation: `hr-marquee ${duration}s linear infinite` }}
          aria-hidden
        >
          {stableItems.map((ev, i) => (
            <span key={`b-${i}-${ev.tMs}`} className={cn('flex items-center gap-2 text-xs sm:text-sm', eventToneClass(ev.tone))}>
              <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', eventToneAccent(ev.tone))} />
              <span className="font-medium">{ev.text}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(1)}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PlacePill({ pos }: { pos: number }) {
  return (
    <span
      className={cn(
        'flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold',
        pos === 1 && 'bg-amber-400/90 text-amber-950',
        pos === 2 && 'bg-slate-300/80 text-slate-900',
        pos === 3 && 'bg-amber-700/90 text-white',
        pos > 3 && 'bg-muted text-muted-foreground',
      )}
    >
      {pos}
    </span>
  );
}

const HorseDetailDialog = ({
  horse,
  onClose,
  inRace,
  odds,
  publicShare,
  finishPos,
  onSelectForBet,
  canBet,
}: {
  horse: Horse | null;
  onClose: () => void;
  inRace: boolean;
  odds?: number;
  publicShare?: number;
  finishPos: number;
  onSelectForBet: () => void;
  canBet: boolean;
}) => {
  if (!horse) return null;
  const winRate = horse.races > 0 ? Math.round((horse.wins / horse.races) * 100) : 0;
  const podiumRate = horse.races > 0 ? Math.round((horse.podiums / horse.races) * 100) : 0;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-full" style={{ background: horse.color }} />
            {horse.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Statut</span>
            {inRace ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-200">
                En piste
                {finishPos > 0 ? ` — arrivé #${finishPos}` : ''}
              </span>
            ) : (
              <span className="text-muted-foreground">Au paddock</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatBar label="Vitesse" value={horse.speed} />
            <StatBar label="Endurance" value={horse.stamina} />
            <StatBar label="Constance" value={horse.consistency} />
          </div>

          <div className="grid grid-cols-4 gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-center">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Courses</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{horse.races}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Victoires</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{horse.wins}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Podiums</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{horse.podiums}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">% Vict.</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{winRate}%</p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Forme récente</p>
            {horse.recent.length > 0 ? (
              <div className="flex gap-1">
                {horse.recent.slice(0, 6).map((pos, i) => <PlacePill key={i} pos={pos} />)}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">Pas encore de courses observées.</p>
            )}
            {horse.races > 0 && (
              <p className="mt-1 text-[10px] text-muted-foreground">Taux podium: {podiumRate}%</p>
            )}
          </div>

          {inRace && typeof odds === 'number' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-amber-200/70">Cote</p>
                <p className="mt-1 font-mono text-base font-semibold tabular-nums text-amber-100">{formatOdds(odds)}</p>
              </div>
              <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-sky-200/70">Pari mutuel</p>
                <p className="mt-1 font-mono text-base font-semibold tabular-nums text-sky-100">
                  {Math.round((publicShare ?? 0) * 100)}%
                </p>
              </div>
            </div>
          )}

          {inRace && canBet && (
            <Button className="w-full" onClick={onSelectForBet}>
              Sélectionner pour le pari
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const StableDialog = ({
  horses,
  entrantIds,
  open,
  onClose,
  onPickHorse,
}: {
  horses: Horse[];
  entrantIds: Set<string>;
  open: boolean;
  onClose: () => void;
  onPickHorse: (id: string) => void;
}) => (
  <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Écurie complète ({horses.length} chevaux)</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">
        Triés par taux de victoire. Cliquez sur un cheval pour ses détails complets.
      </p>
      <div className="grid max-h-[60vh] grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
        {horses.map((h) => {
          const winRate = h.races > 0 ? Math.round((h.wins / h.races) * 100) : 0;
          const podiumRate = h.races > 0 ? Math.round((h.podiums / h.races) * 100) : 0;
          const isRacingNow = entrantIds.has(h.id);
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onPickHorse(h.id)}
              className={cn(
                'flex items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-2 py-1.5 text-left text-[11px] transition hover:border-foreground/40 hover:bg-muted/30',
                isRacingNow && 'border-amber-500/50 bg-amber-500/5',
              )}
            >
              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: h.color }} />
              <span className="flex-1 truncate font-medium">{h.name}</span>
              {isRacingNow && (
                <span className="rounded-full bg-amber-500/30 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-200">
                  En piste
                </span>
              )}
              <div className="flex items-center gap-2 tabular-nums text-muted-foreground">
                <span>{winRate}%V</span>
                <span>{podiumRate}%P</span>
                <span>{h.races}c.</span>
              </div>
            </button>
          );
        })}
      </div>
    </DialogContent>
  </Dialog>
);

export default function HorseRace() {
  const { user, refreshUser } = useAuth();
  const pool = useMemo(() => generatePool(), []);
  const [stored, setStored] = useState<StoredState>(() => loadStoredState());
  const [now, setNow] = useState(() => Date.now());
  const [betSelection, setBetSelection] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState('25');
  const [busy, setBusy] = useState(false);
  const [resolvedCycles, setResolvedCycles] = useState<Set<number>>(new Set());
  const [staleHandled, setStaleHandled] = useState<Set<number>>(new Set());
  const [detailHorseId, setDetailHorseId] = useState<string | null>(null);
  const [stableOpen, setStableOpen] = useState(false);
  const settlingRef = useRef(false);

  const phaseInfo = getPhase(now);
  const { phase, cycleIndex, elapsedInPhase, totalPhase } = phaseInfo;

  const currentSim = useMemo(() => {
    const entrants = pickEntrants(pool, cycleIndex);
    return simulateRace(entrants, cycleIndex);
  }, [pool, cycleIndex]);

  const [serverState, setServerState] = useState<HorseRaceStateResponse | null>(null);

  const refreshServerState = useCallback(async () => {
    try {
      const r = await horseRaceApi.getState(cycleIndex);
      setServerState(r.data);
    } catch (err) {
      // Silent — polling will retry.
    }
  }, [cycleIndex]);

  useEffect(() => {
    void refreshServerState();
    const id = window.setInterval(() => { void refreshServerState(); }, 2500);
    return () => window.clearInterval(id);
  }, [refreshServerState]);

  const publicShareById: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    if (!serverState || serverState.totalAmount === 0) {
      currentSim.entrants.forEach(h => { out[h.id] = 0; });
      return out;
    }
    currentSim.entrants.forEach(h => {
      const e = serverState.entries[h.id];
      out[h.id] = e ? e.amount / serverState.totalAmount : 0;
    });
    return out;
  }, [serverState, currentSim]);

  const paddockChatter = useMemo(() => getPaddockChatter(currentSim, cycleIndex), [currentSim, cycleIndex]);

  const liveBetItems = useMemo(() => deriveLiveBetItems(serverState, currentSim), [serverState, currentSim]);

  const visibleEvents = useMemo(() => {
    if (phase === 'racing') {
      return currentSim.events.filter(e => e.tMs <= elapsedInPhase);
    }
    if (phase === 'results') return currentSim.events;
    return [...paddockChatter, ...liveBetItems];
  }, [phase, currentSim, elapsedInPhase, paddockChatter, liveBetItems]);

  // Retro-fill stats from past races for context.
  useEffect(() => {
    if (stored.retroDoneFor === cycleIndex) return;
    let records = { ...stored.records };
    const startFrom = Math.max(stored.retroDoneFor + 1, cycleIndex - RETRO_RACES);
    for (let c = startFrom; c < cycleIndex; c++) {
      const ents = pickEntrants(pool, c);
      const sim = simulateRace(ents, c);
      records = applyRaceToRecords(records, ents, sim.finishOrder);
    }
    const next = { ...stored, records, retroDoneFor: cycleIndex };
    setStored(next);
    saveStoredState(next);
  }, [cycleIndex, pool, stored]);

  useEffect(() => { saveStoredState(stored); }, [stored]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  // Race resolution settlement (server-side).
  useEffect(() => {
    if (phase !== 'results') return;
    if (resolvedCycles.has(cycleIndex)) return;
    if (settlingRef.current) return;

    const entrants = currentSim.entrants;
    const records = applyRaceToRecords(stored.records, entrants, currentSim.finishOrder);
    const winner = entrants.find(e => e.id === currentSim.finishOrder[0])!;

    const myBet = serverState?.myBet ?? null;
    let bet: StoredState['history'][number]['bet'] | undefined;

    const finalize = async (settlement: { amount: number; payout: number; won: boolean; horseName: string; odds: number } | null) => {
      if (settlement) {
        try {
          await horseRaceApi.settleBet({ cycleIndex, payout: settlement.payout });
          await refreshUser();
          await refreshServerState();
        } catch (err) {
          console.error('Horse race settlement failed:', err);
        }
        bet = {
          horseName: settlement.horseName,
          amount: settlement.amount,
          payout: settlement.payout,
          odds: settlement.odds,
        };
      }

      const history = [
        { cycleIndex, winnerName: winner.name, winnerColor: winner.color, bet },
        ...stored.history,
      ].slice(0, 12);

      const next: StoredState = { ...stored, records, pendingBet: null, history };
      setStored(next);
      saveStoredState(next);
      setResolvedCycles(prev => new Set(prev).add(cycleIndex));
      settlingRef.current = false;
    };

    if (myBet && !myBet.settled) {
      const horse = entrants.find(e => e.id === myBet.horseId);
      if (horse) {
        const won = currentSim.finishOrder[0] === horse.id;
        const odds = currentSim.odds[horse.id];
        const payout = won ? Math.round(myBet.amount * odds) : 0;
        settlingRef.current = true;
        void finalize({ amount: myBet.amount, payout, won, horseName: horse.name, odds });
        return;
      }
    }

    void finalize(null);
  }, [phase, cycleIndex, currentSim, stored, resolvedCycles, serverState, refreshUser, refreshServerState]);

  // Settle pending bets from past sessions (deterministic outcome based on cycle).
  useEffect(() => {
    if (!stored.pendingBet) return;
    if (stored.pendingBet.cycleIndex >= cycleIndex) return;
    if (staleHandled.has(stored.pendingBet.cycleIndex)) return;
    if (settlingRef.current) return;

    settlingRef.current = true;
    const stale = stored.pendingBet;
    const ents = pickEntrants(pool, stale.cycleIndex);
    const sim = simulateRace(ents, stale.cycleIndex);
    const horse = ents.find(e => e.id === stale.horseId);
    let payout = 0;
    let won = false;
    let bet: StoredState['history'][number]['bet'] | undefined;
    if (horse) {
      won = sim.finishOrder[0] === horse.id;
      const odds = sim.odds[horse.id];
      payout = won ? Math.round(stale.amount * odds) : 0;
      bet = { horseName: horse.name, amount: stale.amount, payout, odds };
    }

    const winner = ents.find(e => e.id === sim.finishOrder[0])!;

    const settle = async () => {
      try {
        await horseRaceApi.settleBet({ cycleIndex: stale.cycleIndex, payout });
        await refreshUser();
      } catch (err) {
        // Likely already settled or expired in-memory — proceed to clear local state.
      }
      const history = [
        { cycleIndex: stale.cycleIndex, winnerName: winner.name, winnerColor: winner.color, bet },
        ...stored.history,
      ].slice(0, 12);
      const next: StoredState = { ...stored, pendingBet: null, history };
      setStored(next);
      saveStoredState(next);
      setStaleHandled(prev => new Set(prev).add(stale.cycleIndex));
      settlingRef.current = false;
    };
    void settle();
  }, [cycleIndex, stored, pool, staleHandled, refreshUser]);

  const phaseRemaining = totalPhase - elapsedInPhase;

  const placeBet = useCallback(async () => {
    if (!user || phase !== 'betting' || !betSelection) return;
    if (busy || settlingRef.current) return;
    const amt = Math.max(1, Math.floor(Number(betAmount) || 0));

    try {
      setBusy(true);
      await horseRaceApi.placeBet({ cycleIndex, horseId: betSelection, amount: amt });
      await refreshUser();
      await refreshServerState();
      const next: StoredState = {
        ...stored,
        pendingBet: { cycleIndex, horseId: betSelection, amount: amt },
      };
      setStored(next); saveStoredState(next);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error
        ?? 'Impossible de placer le pari.';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [user, phase, betSelection, busy, betAmount, stored, cycleIndex, refreshUser, refreshServerState]);

  const cancelBet = useCallback(async () => {
    if (phase !== 'betting') return;
    if (busy || settlingRef.current) return;
    if (!serverState?.myBet || serverState.myBet.settled) return;
    try {
      setBusy(true);
      await horseRaceApi.cancelBet({ cycleIndex });
      await refreshUser();
      await refreshServerState();
      const next: StoredState = { ...stored, pendingBet: null };
      setStored(next); saveStoredState(next);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error
        ?? 'Impossible d\'annuler le pari.';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [phase, cycleIndex, busy, serverState, stored, refreshUser, refreshServerState]);

  const horsesWithRecords: Horse[] = useMemo(
    () => pool.map(h => ({ ...h, ...(stored.records[h.id] ?? emptyRecord()) })),
    [pool, stored.records],
  );

  const stableSorted = useMemo(
    () =>
      [...horsesWithRecords].sort((a, b) => {
        const wrA = a.races > 0 ? a.wins / a.races : 0;
        const wrB = b.races > 0 ? b.wins / b.races : 0;
        return wrB - wrA;
      }),
    [horsesWithRecords],
  );

  const entrantIds = useMemo(() => new Set(currentSim.entrants.map(e => e.id)), [currentSim]);

  const detailHorse = useMemo(
    () => detailHorseId ? horsesWithRecords.find(h => h.id === detailHorseId) ?? null : null,
    [detailHorseId, horsesWithRecords],
  );

  const phaseLabel = phase === 'betting' ? 'Paris' : phase === 'racing' ? 'En course' : 'Résultats';

  const myActiveBet = serverState?.myBet && !serverState.myBet.settled ? serverState.myBet : null;

  const userBetEntrant = myActiveBet
    ? currentSim.entrants.find(h => h.id === myActiveBet.horseId) ?? null
    : null;

  const currentSelectionEntrant = betSelection
    ? currentSim.entrants.find(h => h.id === betSelection) ?? null
    : null;

  const handleLaneClick = (id: string) => setDetailHorseId(id);
  const handleSelectForBet = (id: string) => {
    setBetSelection(id);
    setDetailHorseId(null);
  };

  const topPublic = useMemo(() => {
    if (!serverState || serverState.totalAmount === 0) return [];
    return currentSim.entrants
      .map((h) => {
        const e = serverState.entries[h.id] ?? { count: 0, amount: 0 };
        return { id: h.id, name: h.name, color: h.color, share: e.amount / serverState.totalAmount, amount: e.amount };
      })
      .filter(x => x.amount > 0)
      .sort((a, b) => b.share - a.share)
      .slice(0, 3);
  }, [currentSim, serverState]);

  const userMoney = Number(user?.money ?? 0);
  const availableForBet = userMoney + (myActiveBet ? myActiveBet.amount : 0);

  return (
    <PageShell size="full">
      <style>{`
        @keyframes hr-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
      `}</style>

      <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-2.5 lg:h-[calc(100vh-7rem)]">
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/40 bg-card/80 px-3 py-2 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏇</span>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Hippodrome de Longchamp — Course #{cycleIndex}</h1>
              <p className="text-[10px] text-muted-foreground">
                Course toutes les 5 minutes — paris en argent réel · marge maison {Math.round(HOUSE_EDGE * 100)}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              {phase === 'racing' && `${formatMs(elapsedInPhase)} / ${formatMs(RACE_MS)}`}
              {phase === 'results' && `Prochaine ${formatMs(phaseRemaining)}`}
            </span>
            <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-200">
              <Wallet className="h-3 w-3" />
              <span className="tabular-nums font-semibold">{formatMoney(userMoney)}</span>
            </div>
            <Button size="sm" variant="outline" className="h-7" onClick={() => setStableOpen(true)}>
              Écurie ({pool.length})
            </Button>
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

        <MarqueeCommentary items={visibleEvents} isLive={phase === 'racing'} />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-h-0 flex-col gap-2.5">
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Piste principale — clique un cheval pour ses détails</span>
                  <span>{ENTRANTS} partants · ligne d'arrivée à droite</span>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <RaceTrack
                    sim={currentSim}
                    elapsedMs={phase === 'racing' ? elapsedInPhase : phase === 'results' ? RACE_MS : 0}
                    isRacing={phase === 'racing'}
                    phase={phase}
                    selectedId={betSelection}
                    betHorseId={userBetEntrant?.id ?? null}
                    publicShare={publicShareById}
                    onLaneClick={handleLaneClick}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardContent className="p-2.5">
                <AerialTrack
                  sim={currentSim}
                  elapsedMs={phase === 'racing' ? elapsedInPhase : phase === 'results' ? RACE_MS : 0}
                  isRacing={phase === 'racing'}
                  phase={phase}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardContent className="flex h-full min-h-0 flex-col gap-3 p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider">Mon pari</h2>
                {phase === 'betting' && myActiveBet && (
                  <button
                    type="button"
                    onClick={cancelBet}
                    disabled={busy}
                    className="text-[10px] text-rose-300 hover:underline disabled:opacity-50"
                  >
                    Annuler
                  </button>
                )}
              </div>

              {userBetEntrant ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: userBetEntrant.color }} />
                    <span className="truncate text-sm font-semibold">{userBetEntrant.name}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Mise <span className="tabular-nums text-foreground">{formatMoney(myActiveBet?.amount ?? 0)}</span></span>
                    <span>Cote <span className="tabular-nums text-foreground">{formatOdds(currentSim.odds[userBetEntrant.id])}</span></span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-emerald-200">
                    Gain potentiel: {formatMoney((myActiveBet?.amount ?? 0) * currentSim.odds[userBetEntrant.id])}
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
                  {phase === 'betting'
                    ? 'Clique sur un cheval dans la piste, puis valide ta mise.'
                    : 'Pas de pari sur cette course.'}
                </p>
              )}

              {currentSelectionEntrant && currentSelectionEntrant.id !== userBetEntrant?.id && phase === 'betting' && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: currentSelectionEntrant.color }} />
                    <span className="truncate font-medium">Sélection: {currentSelectionEntrant.name}</span>
                    <span className="ml-auto rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono tabular-nums text-amber-200">
                      {formatOdds(currentSim.odds[currentSelectionEntrant.id])}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Mise</label>
                  <span className="text-[10px] text-muted-foreground">Disponible: {formatMoney(availableForBet)}</span>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value)}
                  disabled={phase !== 'betting' || busy}
                  className="h-8 text-sm"
                />
                <div className="flex flex-wrap gap-1">
                  {[10, 25, 100, 250].map(v => (
                    <Button
                      key={v}
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      disabled={phase !== 'betting' || busy}
                      onClick={() => setBetAmount(String(v))}
                    >
                      ${v}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    disabled={phase !== 'betting' || busy}
                    onClick={() => setBetAmount(String(Math.max(1, availableForBet)))}
                  >
                    Max
                  </Button>
                </div>
                <Button
                  className="w-full"
                  disabled={
                    phase !== 'betting'
                    || !betSelection
                    || busy
                    || Number(betAmount) <= 0
                    || Number(betAmount) > availableForBet
                  }
                  onClick={placeBet}
                >
                  {myActiveBet ? 'Modifier le pari' : 'Placer le pari'}
                </Button>
              </div>

              <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-sky-200/85">
                  <span>Pari mutuel · live</span>
                  <span className="tabular-nums">
                    {(serverState?.totalBets ?? 0)} pari{(serverState?.totalBets ?? 0) > 1 ? 's' : ''} · {formatMoney(serverState?.totalAmount ?? 0)}
                  </span>
                </div>
                <div className="mt-1.5 space-y-0.5">
                  {topPublic.length === 0 ? (
                    <p className="text-[11px] italic text-muted-foreground">Aucun pari pour l'instant — sois le premier !</p>
                  ) : (
                    topPublic.map((t) => (
                      <div key={t.id} className="flex items-center gap-1.5 text-[11px]">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: t.color }} />
                        <span className="flex-1 truncate font-medium">{t.name}</span>
                        <span className="tabular-nums text-sky-200">{Math.round(t.share * 100)}%</span>
                        <span className="hidden tabular-nums text-muted-foreground sm:inline-block">{formatMoney(t.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 border-t border-border/50 pt-2">
                <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Historique</span>
                  <span>{stored.history.length}</span>
                </div>
                <div className="max-h-full space-y-1 overflow-y-auto pr-1">
                  {stored.history.length === 0 ? (
                    <p className="text-[11px] italic text-muted-foreground">Aucune course observée.</p>
                  ) : (
                    stored.history.map(h => (
                      <div key={h.cycleIndex} className="rounded-md border border-border/40 bg-muted/30 px-2 py-1 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <Trophy className="h-3 w-3 text-amber-400" />
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: h.winnerColor }} />
                          <span className="truncate font-medium">{h.winnerName}</span>
                        </div>
                        {h.bet && (
                          <div className={cn(
                            'mt-0.5',
                            h.bet.payout > 0 ? 'text-emerald-300' : 'text-rose-300',
                          )}>
                            {h.bet.payout > 0
                              ? `+${formatMoney(h.bet.payout)} sur ${h.bet.horseName} (${formatOdds(h.bet.odds)})`
                              : `-${formatMoney(h.bet.amount)} sur ${h.bet.horseName}`}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <HorseDetailDialog
        horse={detailHorse}
        onClose={() => setDetailHorseId(null)}
        inRace={detailHorseId ? entrantIds.has(detailHorseId) : false}
        odds={detailHorseId && entrantIds.has(detailHorseId) ? currentSim.odds[detailHorseId] : undefined}
        publicShare={detailHorseId && entrantIds.has(detailHorseId) ? publicShareById[detailHorseId] : undefined}
        finishPos={detailHorseId && phase !== 'betting' && entrantIds.has(detailHorseId)
          ? currentSim.finishOrder.indexOf(detailHorseId) + 1
          : 0}
        canBet={phase === 'betting'}
        onSelectForBet={() => detailHorseId && handleSelectForBet(detailHorseId)}
      />

      <StableDialog
        horses={stableSorted}
        entrantIds={entrantIds}
        open={stableOpen}
        onClose={() => setStableOpen(false)}
        onPickHorse={(id) => {
          setStableOpen(false);
          setDetailHorseId(id);
        }}
      />
    </PageShell>
  );
}
