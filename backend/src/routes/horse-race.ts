import { Router, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../server.js';
import { logGame } from '../utils/logger.js';
import { emitSharedBalanceUpdatesForUserIds } from '../utils/shared-balance.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

// ---------- Constants ----------
const CYCLE_MS = 5 * 60 * 1000;
const RACE_MS = 60 * 1000;
const RESULTS_MS = 30 * 1000;
const BETTING_MS = CYCLE_MS - RACE_MS - RESULTS_MS;

const ENTRANTS = 8;
const HOUSE_EDGE = 0.10;
const POOL_SEED = 0x9e3779b9;

const MAX_BETS_PER_USER = 3;
const MAX_BET_TOTAL = 100_000;
const MIN_BET = 1;
const MAX_PAYOUT_MULTIPLIER = 50;
const KEEP_BETS_CYCLES = 24;

const STABLE_CREATE_COST = 50_000;
const HORSE_BUY_COST = 25_000;
const HORSE_TRAIN_COST = 5_000;
const HORSE_TRAIN_INC = 0.1;
const HORSE_TRAIN_CAP = 1.5;
const BREED_COST = 50_000;
const CUSTOMIZE_COST = 10_000;
const DOPE_COST = 5_000;
const DOPE_CATCH_PCT = 0.33;
const DOPE_SPEED_BOOST = 1.5;
const DOPE_STAMINA_BOOST = 1.0;

const PRIZE_BASE_1ST = 15_000;
const PRIZE_BASE_2ND = 8_000;
const PRIZE_BASE_3RD = 4_000;
const PRIZE_POOL_1ST_PCT = 0.30;
const PRIZE_POOL_2ND_PCT = 0.15;
const PRIZE_POOL_3RD_PCT = 0.05;

const REGISTRATION_MAX_PENDING = 20; // can't queue more than 20 entries per horse
const CYCLES_PER_YEAR = 24; // 24 cycles = ~2h = "1 year"
const MIN_AGE_TO_RACE = 1; // years
const MIN_AGE_TO_BREED = 2;
const DECLINE_START_AGE = 12;
const MAX_AGE = 25;

// ---------- Computer horse pool (deterministic) ----------
const COMP_NAMES = [
  ['Brave', 'Galop'], ['Fougueux', 'Éclair'], ['Royal', 'Vent'], ['Sauvage', 'Tonnerre'],
  ['Mystique', 'Mistral'], ['Noir', 'Sabot'], ['Doré', 'Foudre'], ['Rapide', 'Cavalier'],
  ['Furieux', 'Mustang'], ['Léger', 'Pégase'], ['Fier', 'Orage'], ['Lunaire', 'Crépuscule'],
  ['Nocturne', 'Dragon'], ['Argenté', 'Soleil'], ['Vif', 'Ouragan'], ['Sombre', 'Tourbillon'],
  ['Brillant', 'Phénix'], ['Audacieux', 'Comète'], ['Indompté', 'Tempête'], ['Rusé', 'Météore'],
];
const COMP_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#a855f7',
  '#14b8a6', '#22c55e', '#dc2626', '#2563eb', '#db2777',
  '#0ea5e9', '#65a30d', '#9333ea', '#e11d48', '#0d9488',
];

// ---------- Patterns catalog ----------
export type PatternDef = {
  key: string;
  label: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockWins?: number; // null/undefined => unlocked by default
};
const PATTERNS: PatternDef[] = [
  { key: 'solid', label: 'Uni', rarity: 'common' },
  { key: 'blaze', label: 'Liste (front)', rarity: 'common' },
  { key: 'stockings', label: 'Chaussettes', rarity: 'common' },
  { key: 'dapple', label: 'Pommelé', rarity: 'common' },
  { key: 'stripes', label: 'Rayé', rarity: 'rare', unlockWins: 5 },
  { key: 'splash', label: 'Éclaboussé', rarity: 'rare', unlockWins: 15 },
  { key: 'frost', label: 'Givré', rarity: 'epic', unlockWins: 35 },
  { key: 'flame', label: 'Flamme', rarity: 'epic', unlockWins: 75 },
  { key: 'royal', label: 'Royal', rarity: 'legendary', unlockWins: 150 },
];
const PATTERN_KEYS = new Set(PATTERNS.map((p) => p.key));
const DEFAULT_PATTERNS = new Set(PATTERNS.filter((p) => !p.unlockWins).map((p) => p.key));

// ---------- RNG ----------
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
function shuffleSeeded<T>(arr: readonly T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Phase helpers ----------
function currentCycleIndex(): number {
  return Math.floor(Date.now() / CYCLE_MS);
}
function cyclePhase(cycleIndex: number, now: number = Date.now()): 'future' | 'betting' | 'racing' | 'results' | 'past' {
  const cycleStart = cycleIndex * CYCLE_MS;
  const cur = Math.floor(now / CYCLE_MS);
  if (cycleIndex > cur) return 'future';
  if (cycleIndex < cur) return 'past';
  const t = now - cycleStart;
  if (t < BETTING_MS) return 'betting';
  if (t < BETTING_MS + RACE_MS) return 'racing';
  return 'results';
}
function isBettingOpen(cycleIndex: number, now: number = Date.now()): boolean {
  return cyclePhase(cycleIndex, now) === 'betting';
}
function isRaceLockedIn(cycleIndex: number, now: number = Date.now()): boolean {
  const p = cyclePhase(cycleIndex, now);
  return p === 'racing' || p === 'results' || p === 'past';
}

// ---------- Age & stats ----------
function ageYears(birthCycle: number, atCycle: number): number {
  return Math.max(0, (atCycle - birthCycle) / CYCLES_PER_YEAR);
}
function effectiveStat(gene: number, train: number, ageY: number): number {
  let base = gene + train;
  if (ageY < MIN_AGE_TO_RACE) base *= 0.6;
  else if (ageY > DECLINE_START_AGE) {
    const declineFactor = Math.max(0.5, 1 - (ageY - DECLINE_START_AGE) * 0.04);
    base *= declineFactor;
  }
  return Math.max(0.5, base);
}

type RaceableHorse = {
  id: string;
  name: string;
  bodyColor: string;
  pattern: string;
  patternColor: string;
  speed: number;
  stamina: number;
  consistency: number;
  isComputer: boolean;
  ownerStableId?: string | null;
  ownerStableName?: string | null;
  ageYears: number;
  doped: boolean;
};

// ---------- Computer horse generator for a cycle ----------
function pickComputerHorses(cycleIndex: number, count: number): RaceableHorse[] {
  if (count <= 0) return [];
  const rand = mulberry32((POOL_SEED ^ (cycleIndex * 0x9e3779b1)) | 0);
  const namesShuffled = shuffleSeeded(COMP_NAMES, rand);
  const colorsShuffled = shuffleSeeded(COMP_COLORS, rand);
  const out: RaceableHorse[] = [];
  for (let i = 0; i < count; i++) {
    const [adj, noun] = namesShuffled[i % namesShuffled.length];
    out.push({
      id: `comp-${cycleIndex}-${i}`,
      name: `${adj} ${noun}`,
      bodyColor: colorsShuffled[i % colorsShuffled.length],
      pattern: 'solid',
      patternColor: '#f8fafc',
      speed: 6.5 + rand() * 1.6,
      stamina: 6.5 + rand() * 1.6,
      consistency: 7 + rand() * 2,
      isComputer: true,
      ageYears: 5 + rand() * 8,
      doped: false,
    });
  }
  return out;
}

// ---------- Lineup creation (round robin) ----------
type LockedEntry = {
  cycleIndex: number;
  lane: number;
  horseId: string | null;
  isComputer: boolean;
  computerName: string | null;
  computerColor: string | null;
  computerPattern: string;
  computerPatternColor: string;
  registeredByUserId: string | null;
};

const lockInFlight = new Map<number, Promise<void>>();

async function ensureLineupForCycle(cycleIndex: number): Promise<void> {
  // Don't lock in future races (still betting on prior cycle); lock current cycle once.
  const now = Date.now();
  if (cycleIndex > currentCycleIndex()) return;
  // Single flight per cycle.
  const inflight = lockInFlight.get(cycleIndex);
  if (inflight) {
    await inflight;
    return;
  }
  const p = doEnsureLineupForCycle(cycleIndex, now);
  lockInFlight.set(cycleIndex, p);
  try { await p; } finally { lockInFlight.delete(cycleIndex); }
}

async function doEnsureLineupForCycle(cycleIndex: number, now: number): Promise<void> {
  const existing = await prisma.horseRaceEntry.count({ where: { cycleIndex } });
  if (existing >= ENTRANTS) return;
  if (existing > 0) return; // partial state is unexpected; bail rather than mix

  // Round-robin: gather all horses with pendingEntries > 0, by stable.
  const eligible = await prisma.horse.findMany({
    where: {
      pendingEntries: { gt: 0 },
      isConfiscated: false,
      isRetired: false,
    },
    select: {
      id: true,
      stableId: true,
      name: true,
      bodyColor: true,
      pattern: true,
      patternColor: true,
      birthCycle: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  // Filter: must be old enough to race.
  const racable = eligible.filter((h) => ageYears(h.birthCycle, cycleIndex) >= MIN_AGE_TO_RACE);

  // Group by stable.
  const byStable = new Map<string, typeof racable>();
  for (const h of racable) {
    const arr = byStable.get(h.stableId) ?? [];
    arr.push(h);
    byStable.set(h.stableId, arr);
  }
  // Sort horses inside each stable by createdAt (fairness within stable).
  for (const arr of byStable.values()) {
    arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  // Shuffle stable order deterministically by cycle.
  const stableIds = shuffleSeeded(Array.from(byStable.keys()), mulberry32((cycleIndex * 7919) | 0));

  const selected: typeof racable = [];
  let round = 0;
  while (selected.length < ENTRANTS) {
    let added = 0;
    for (const sid of stableIds) {
      const arr = byStable.get(sid)!;
      if (arr.length > round) {
        selected.push(arr[round]);
        added++;
        if (selected.length >= ENTRANTS) break;
      }
    }
    if (added === 0) break;
    round++;
  }

  // We need entry ownership info too — fetch latest "registered by" hint. To keep it
  // simple, we'll resolve registeredByUserId from the stable's clan owner if nothing
  // smarter is tracked. For real attribution, registeredByUserId is set in the registration
  // endpoint via a queue. We mirror it onto the most recent registration log.
  // For simplicity here, fetch the clan owner so prizes go somewhere sensible.
  const stableOwnerMap = new Map<string, string | null>();
  if (selected.length > 0) {
    const sIds = Array.from(new Set(selected.map((h) => h.stableId)));
    const stables = await prisma.stable.findMany({
      where: { id: { in: sIds } },
      select: { id: true, clan: { select: { ownerId: true } } },
    });
    for (const s of stables) stableOwnerMap.set(s.id, s.clan.ownerId);
  }

  const compNeeded = Math.max(0, ENTRANTS - selected.length);
  const computers = pickComputerHorses(cycleIndex, compNeeded);

  // Lane assignment: shuffle final list deterministically.
  const finalList: Array<{
    horseId: string | null;
    computer: RaceableHorse | null;
    stableId?: string;
    name: string;
    pattern: string;
    patternColor: string;
    color: string;
    registeredByUserId: string | null;
  }> = [];
  for (const h of selected) {
    finalList.push({
      horseId: h.id,
      computer: null,
      stableId: h.stableId,
      name: h.name,
      pattern: h.pattern,
      patternColor: h.patternColor,
      color: h.bodyColor,
      registeredByUserId: stableOwnerMap.get(h.stableId) ?? null,
    });
  }
  for (const c of computers) {
    finalList.push({
      horseId: null,
      computer: c,
      name: c.name,
      pattern: c.pattern,
      patternColor: c.patternColor,
      color: c.bodyColor,
      registeredByUserId: null,
    });
  }
  const shuffled = shuffleSeeded(finalList, mulberry32((cycleIndex * 314159) | 0));

  // Persist + decrement pendingEntries in a transaction.
  try {
    await prisma.$transaction(async (tx) => {
      const recount = await tx.horseRaceEntry.count({ where: { cycleIndex } });
      if (recount > 0) return; // someone else won the race

      for (let i = 0; i < shuffled.length; i++) {
        const e = shuffled[i];
        await tx.horseRaceEntry.create({
          data: {
            cycleIndex,
            lane: i + 1,
            horseId: e.horseId,
            isComputer: e.horseId == null,
            computerName: e.horseId == null ? e.name : null,
            computerColor: e.horseId == null ? e.color : null,
            computerPattern: e.horseId == null ? e.pattern : 'solid',
            computerPatternColor: e.horseId == null ? e.patternColor : '#f8fafc',
            registeredByUserId: e.registeredByUserId,
          },
        });
      }
      // Decrement pendingEntries on player horses (exactly once).
      const playerIds = shuffled.map((e) => e.horseId).filter((x): x is string => !!x);
      if (playerIds.length > 0) {
        await tx.horse.updateMany({
          where: { id: { in: playerIds } },
          data: { pendingEntries: { decrement: 1 } },
        });
      }
    });
  } catch (err: unknown) {
    // Unique constraint races are expected; silently retry-on-read.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
      throw err;
    }
  }
}

// ---------- Race simulation (deterministic; uses stats) ----------
async function buildRaceableEntries(cycleIndex: number): Promise<RaceableHorse[]> {
  const entries = await prisma.horseRaceEntry.findMany({
    where: { cycleIndex },
    include: {
      horse: {
        include: {
          stable: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { lane: 'asc' },
  });
  const result: RaceableHorse[] = [];
  for (const e of entries) {
    if (e.isComputer || !e.horse) {
      // Reconstruct computer horse stats from its lane + cycle (deterministic).
      const seedRand = mulberry32(((POOL_SEED * 13 + cycleIndex * 17 + e.lane * 31) | 0));
      result.push({
        id: `comp-${cycleIndex}-${e.lane}`,
        name: e.computerName ?? 'Inconnu',
        bodyColor: e.computerColor ?? '#888',
        pattern: e.computerPattern,
        patternColor: e.computerPatternColor,
        speed: 6.5 + seedRand() * 1.6,
        stamina: 6.5 + seedRand() * 1.6,
        consistency: 7 + seedRand() * 2,
        isComputer: true,
        ageYears: 5,
        doped: false,
      });
    } else {
      const h = e.horse;
      const ageY = ageYears(h.birthCycle, cycleIndex);
      const doped = h.dopedForCycle === cycleIndex;
      result.push({
        id: h.id,
        name: h.name,
        bodyColor: h.bodyColor,
        pattern: h.pattern,
        patternColor: h.patternColor,
        speed: effectiveStat(h.geneSpeed, h.trainSpeed, ageY) + (doped ? DOPE_SPEED_BOOST : 0),
        stamina: effectiveStat(h.geneStamina, h.trainStamina, ageY) + (doped ? DOPE_STAMINA_BOOST : 0),
        consistency: effectiveStat(h.geneConsistency, h.trainConsistency, ageY),
        isComputer: false,
        ownerStableId: h.stable?.id ?? null,
        ownerStableName: h.stable?.name ?? null,
        ageYears: ageY,
        doped,
      });
    }
  }
  return result;
}

function computeWinProbs(entrants: RaceableHorse[], cycleIndex: number): Record<string, number> {
  const SAMPLES = 600;
  const wins: Record<string, number> = {};
  for (const h of entrants) wins[h.id] = 0;
  for (let s = 0; s < SAMPLES; s++) {
    const rand = mulberry32(((POOL_SEED * 17) + cycleIndex * 1009 + s * 31) | 0);
    let bestId = entrants[0]?.id;
    let bestTime = Infinity;
    for (const h of entrants) {
      const noise = (rand() - 0.5) * Math.max(0.4, (10 - h.consistency) * 0.6);
      const formNoise = (rand() - 0.5) * 1.4;
      const incidentRoll = rand();
      const incidentMult = incidentRoll < 0.04 ? 0.6 : incidentRoll < 0.12 ? 0.85 : 1;
      const effSpeed = Math.max(1, (h.speed + formNoise + noise) * incidentMult);
      const staminaMult = 1 + (5 - h.stamina) * 0.02;
      const time = (1000 / effSpeed) * staminaMult;
      if (time < bestTime) { bestTime = time; bestId = h.id; }
    }
    if (bestId) wins[bestId]++;
  }
  const probs: Record<string, number> = {};
  for (const h of entrants) probs[h.id] = Math.max(0.005, wins[h.id] / SAMPLES);
  const sum = Object.values(probs).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(probs)) probs[k] /= sum;
  return probs;
}

function computeOdds(probs: Record<string, number>): Record<string, number> {
  const odds: Record<string, number> = {};
  for (const k of Object.keys(probs)) odds[k] = Math.max(1.05, (1 - HOUSE_EDGE) / probs[k]);
  return odds;
}

function simulateFinish(entrants: RaceableHorse[], cycleIndex: number): { order: string[]; times: Record<string, number> } {
  const rand = mulberry32((POOL_SEED * 31 + cycleIndex) | 0);
  const finishTimes: Record<string, number> = {};
  const SIM_DT_MS = 100;
  const TRACK_UNITS = 1000;
  const positions: Record<string, number> = {};
  const speeds: Record<string, { base: number; stamina: number; noiseAmp: number; mult: number }> = {};
  for (const h of entrants) {
    positions[h.id] = 0;
    const formNoise = (rand() - 0.5) * 1.4;
    speeds[h.id] = {
      base: h.speed + formNoise,
      stamina: h.stamina,
      noiseAmp: Math.max(0.35, (10 - h.consistency) * 0.55),
      mult: 1,
    };
  }
  const totalSteps = Math.ceil(RACE_MS / SIM_DT_MS);
  const baseTick = TRACK_UNITS / (RACE_MS / SIM_DT_MS);
  // Pre-rolled incidents.
  const incidents: { step: number; type: 'injury' | 'stitch' | 'stumble' | 'boost' }[] = [];
  for (const frac of [0.08, 0.22, 0.4, 0.58, 0.78]) {
    if (rand() < 0.7) {
      const r = rand();
      let type: 'injury' | 'stitch' | 'stumble' | 'boost';
      if (r < 0.2) type = 'injury';
      else if (r < 0.45) type = 'stitch';
      else if (r < 0.7) type = 'stumble';
      else type = 'boost';
      incidents.push({ step: Math.floor(totalSteps * frac), type });
    }
  }
  let incIdx = 0;
  for (let step = 1; step <= totalSteps; step++) {
    while (incIdx < incidents.length && incidents[incIdx].step === step) {
      const idx = Math.floor(rand() * entrants.length);
      const target = entrants[idx];
      const s = speeds[target.id];
      switch (incidents[incIdx].type) {
        case 'injury': s.mult *= 0.55; break;
        case 'stitch': s.mult *= 0.82; break;
        case 'stumble': s.mult *= 0.9; break;
        case 'boost': s.mult *= 1.13; break;
      }
      incIdx++;
    }
    const tMs = step * SIM_DT_MS;
    const fatigue = Math.max(0, (tMs - 30_000) / 60_000);
    for (const h of entrants) {
      const prev = positions[h.id];
      if (prev >= TRACK_UNITS) continue;
      const s = speeds[h.id];
      const fatigueDrag = fatigue * (1 - s.stamina / 14);
      const noise = (rand() * 2 - 1) * s.noiseAmp;
      const tick = baseTick * (s.base / 7) * s.mult * (1 - fatigueDrag * 0.18) + noise * 0.6;
      const next = Math.min(TRACK_UNITS, prev + Math.max(0.1, tick));
      positions[h.id] = next;
      if (next >= TRACK_UNITS && finishTimes[h.id] === undefined) finishTimes[h.id] = tMs;
    }
  }
  for (const h of entrants) {
    if (finishTimes[h.id] === undefined) {
      finishTimes[h.id] = RACE_MS + (1000 - positions[h.id]) * 50;
    }
  }
  const order = entrants.slice().sort((a, b) => finishTimes[a.id] - finishTimes[b.id]).map((h) => h.id);
  return { order, times: finishTimes };
}

// ---------- Race resolution (resolves entries + pays out prizes) ----------
const resolveInFlight = new Map<number, Promise<void>>();

async function ensureRaceResolved(cycleIndex: number): Promise<void> {
  if (!isRaceLockedIn(cycleIndex)) return;
  const inflight = resolveInFlight.get(cycleIndex);
  if (inflight) { await inflight; return; }
  const p = doResolveRace(cycleIndex);
  resolveInFlight.set(cycleIndex, p);
  try { await p; } finally { resolveInFlight.delete(cycleIndex); }
}

async function doResolveRace(cycleIndex: number): Promise<void> {
  const existing = await prisma.horseRaceResolution.findUnique({ where: { cycleIndex } });
  if (existing) return;

  // Make sure lineup exists.
  await ensureLineupForCycle(cycleIndex);

  const entrants = await buildRaceableEntries(cycleIndex);
  if (entrants.length === 0) return;

  const { order, times } = simulateFinish(entrants, cycleIndex);
  const probs = computeWinProbs(entrants, cycleIndex);
  const odds = computeOdds(probs);

  // Compute totals.
  const allBets = await prisma.horseRaceBet.findMany({
    where: { cycleIndex, settled: false },
  });
  const totalPool = allBets.reduce((s, b) => s + b.amount, 0);

  // Determine prizes for top 3 horses (player-owned only — computer horses get no money).
  const prize1 = PRIZE_BASE_1ST + Math.floor(totalPool * PRIZE_POOL_1ST_PCT);
  const prize2 = PRIZE_BASE_2ND + Math.floor(totalPool * PRIZE_POOL_2ND_PCT);
  const prize3 = PRIZE_BASE_3RD + Math.floor(totalPool * PRIZE_POOL_3RD_PCT);
  const prizes = [prize1, prize2, prize3];

  // Per-entrant exp gains.
  const expByPos = (pos: number) => (pos === 1 ? 50 : pos === 2 ? 30 : pos === 3 ? 20 : pos <= 5 ? 12 : 8);

  // Doping checks & catches must happen here (deterministic per cycle).
  const catchRand = mulberry32((cycleIndex * 991 + 7) | 0);
  const horseDopingResults = new Map<string, { caught: boolean }>();
  for (const h of entrants) {
    if (!h.isComputer && h.doped) {
      const caught = catchRand() < DOPE_CATCH_PCT;
      horseDopingResults.set(h.id, { caught });
    }
  }

  const winnerName = entrants.find((h) => h.id === order[0])?.name ?? 'Inconnu';

  const userPrizeUpdates = new Map<string, number>(); // userId -> moneyDelta
  const userAuraUpdates = new Map<string, number>(); // userId -> auraDelta
  const userNotifications: Array<{ userId: string; title: string; body: string; data?: Record<string, unknown> }> = [];
  const horseUpdates: Array<{
    id: string; finishPos: number; expGain: number; prize: number; isWinner: boolean; isPodium: boolean;
    wasDoped: boolean; wasCaught: boolean;
  }> = [];

  await prisma.$transaction(async (tx) => {
    // Update each entry with finishPos / time / prize / exp.
    const entries = await tx.horseRaceEntry.findMany({ where: { cycleIndex } });
    for (const e of entries) {
      const horseUid = e.horseId ?? `comp-${cycleIndex}-${e.lane}`;
      const finishPos = order.indexOf(horseUid) + 1;
      const isHorse = !!e.horseId;
      const isPodium = finishPos >= 1 && finishPos <= 3;
      const prize = isHorse && isPodium ? prizes[finishPos - 1] : 0;
      const expGain = isHorse ? expByPos(finishPos) : 0;
      const dop = e.horseId ? horseDopingResults.get(e.horseId) : null;
      const wasDoped = !!dop;
      const wasCaught = !!dop?.caught;

      await tx.horseRaceEntry.update({
        where: { id: e.id },
        data: {
          finishPos,
          finishTimeMs: Math.round(times[horseUid] ?? 0),
          prize: wasCaught ? 0 : prize, // caught dopers get no prize
          expGained: wasCaught ? 0 : expGain,
          wasDoped,
          wasCaught,
        },
      });

      if (e.horseId) {
        horseUpdates.push({
          id: e.horseId,
          finishPos,
          expGain: wasCaught ? 0 : expGain,
          prize: wasCaught ? 0 : prize,
          isWinner: finishPos === 1 && !wasCaught,
          isPodium: isPodium && !wasCaught,
          wasDoped,
          wasCaught,
        });
        if (prize > 0 && !wasCaught && e.registeredByUserId) {
          userPrizeUpdates.set(
            e.registeredByUserId,
            (userPrizeUpdates.get(e.registeredByUserId) ?? 0) + prize,
          );
          // bonus aura to the registering user: 1st=100, 2nd=50, 3rd=25
          const aura = finishPos === 1 ? 100 : finishPos === 2 ? 50 : 25;
          userAuraUpdates.set(
            e.registeredByUserId,
            (userAuraUpdates.get(e.registeredByUserId) ?? 0) + aura,
          );
        }
      }
    }

    // Update horses (races/wins/podiums/earnings/experience).
    for (const u of horseUpdates) {
      await tx.horse.update({
        where: { id: u.id },
        data: {
          races: { increment: 1 },
          wins: { increment: u.isWinner ? 1 : 0 },
          podiums: { increment: u.isPodium ? 1 : 0 },
          earnings: { increment: u.prize },
          experience: { increment: u.expGain },
          dopedForCycle: null, // clear flag
          isConfiscated: u.wasCaught ? true : undefined,
        },
      });
    }

    // Bump stable stats.
    const playerEntries = horseUpdates;
    if (playerEntries.length > 0) {
      // Fetch stable IDs for these horses.
      const horseRecords = await tx.horse.findMany({
        where: { id: { in: playerEntries.map((p) => p.id) } },
        select: { id: true, stableId: true },
      });
      const stableTotals = new Map<string, { wins: number; podiums: number; races: number; rep: number }>();
      for (const h of horseRecords) {
        const p = playerEntries.find((x) => x.id === h.id)!;
        const cur = stableTotals.get(h.stableId) ?? { wins: 0, podiums: 0, races: 0, rep: 0 };
        cur.races += 1;
        if (p.isWinner) cur.wins += 1;
        if (p.isPodium) cur.podiums += 1;
        cur.rep += p.isWinner ? 10 : p.isPodium ? 4 : 1;
        stableTotals.set(h.stableId, cur);
      }
      for (const [sid, t] of stableTotals) {
        await tx.stable.update({
          where: { id: sid },
          data: {
            totalRaces: { increment: t.races },
            totalWins: { increment: t.wins },
            totalPodiums: { increment: t.podiums },
            reputation: { increment: t.rep },
          },
        });
      }
    }

    // Apply prize money to users.
    for (const [userId, delta] of userPrizeUpdates) {
      await tx.user.update({
        where: { id: userId },
        data: { money: { increment: BigInt(delta) } },
      });
    }
    for (const [userId, delta] of userAuraUpdates) {
      await tx.user.update({
        where: { id: userId },
        data: { aura: { increment: BigInt(delta) } },
      });
    }

    // Mark resolution.
    await tx.horseRaceResolution.create({
      data: {
        cycleIndex,
        winnerName,
        totalBets: allBets.length,
        totalPool,
      },
    });
  });

  // Confiscation notifications.
  for (const u of horseUpdates) {
    if (u.wasCaught) {
      const h = await prisma.horse.findUnique({
        where: { id: u.id },
        include: { stable: { include: { clan: { include: { members: { select: { userId: true } } } } } } },
      });
      if (h) {
        const memberIds = h.stable.clan.members.map((m) => m.userId);
        for (const uid of memberIds) {
          userNotifications.push({
            userId: uid,
            title: 'Cheval confisqué ⚠️',
            body: `${h.name} a été contrôlé positif au dopage et confisqué par les commissaires.`,
            data: { horseId: u.id, cycleIndex },
          });
        }
      }
    }
  }

  // Settle bets for this cycle.
  await settleBetsForCycle(cycleIndex, order, odds);

  // Send notifications & emit balance updates for all touched users.
  const touchedUserIds = new Set<string>([
    ...userPrizeUpdates.keys(),
    ...userAuraUpdates.keys(),
  ]);
  // Also notify horse winners.
  for (const u of horseUpdates) {
    if (u.isWinner) {
      const h = await prisma.horse.findUnique({
        where: { id: u.id },
        include: { stable: { include: { clan: { include: { members: { select: { userId: true } } } } } } },
      });
      if (h) {
        for (const m of h.stable.clan.members) {
          userNotifications.push({
            userId: m.userId,
            title: 'Victoire à l\'hippodrome 🏆',
            body: `${h.name} a remporté la course #${cycleIndex} ! Prix : ${u.prize.toLocaleString()}€`,
            data: { horseId: u.id, cycleIndex },
          });
          touchedUserIds.add(m.userId);
        }
      }
    }
  }

  // Persist notifications.
  for (const n of userNotifications) {
    try {
      await createNotification({
        userId: n.userId,
        type: 'horse_race',
        title: n.title,
        body: n.body,
        data: n.data,
        link: '/horse-race',
      });
    } catch { /* ignore */ }
  }

  if (touchedUserIds.size > 0) {
    await emitSharedBalanceUpdatesForUserIds(prisma, Array.from(touchedUserIds));
  }

  // Cleanup: delete very old bets/entries to keep DB lean.
  const cutoff = currentCycleIndex() - KEEP_BETS_CYCLES * 4;
  await prisma.horseRaceBet.deleteMany({ where: { cycleIndex: { lt: cutoff }, settled: true } });
}

async function settleBetsForCycle(cycleIndex: number, order: string[], odds: Record<string, number>): Promise<void> {
  const bets = await prisma.horseRaceBet.findMany({ where: { cycleIndex, settled: false } });
  const winnerHorseId = order[0];
  // Map entry horseId (string) — for player horses it's horse.id; for computer it's "comp-XX-Y"
  // bets are placed on either real horseIds or computer placeholders. We need to match correctly.
  // For real horses, the bet.horseId equals horse.id. For computer entries, we expose stable IDs like
  // "comp-{cycle}-{lane}" through state. The bets API will accept those strings too.
  const userTotals = new Map<string, number>(); // userId -> money to add
  await prisma.$transaction(async (tx) => {
    for (const b of bets) {
      const won = b.horseId === winnerHorseId;
      const o = odds[b.horseId] ?? 1.05;
      let payout = won ? Math.min(b.amount * o, b.amount * MAX_PAYOUT_MULTIPLIER) : 0;
      payout = Math.floor(payout);
      await tx.horseRaceBet.update({
        where: { id: b.id },
        data: { payout, settled: true },
      });
      if (payout > 0) {
        userTotals.set(b.userId, (userTotals.get(b.userId) ?? 0) + payout);
      }
    }
    for (const [userId, delta] of userTotals) {
      await tx.user.update({ where: { id: userId }, data: { money: { increment: BigInt(delta) } } });
    }
  });
  if (userTotals.size > 0) {
    await emitSharedBalanceUpdatesForUserIds(prisma, Array.from(userTotals.keys()));
  }
}

// ---------- Pattern unlock check ----------
async function getUnlockedPatterns(stableId: string): Promise<Set<string>> {
  const unlocked = new Set<string>(DEFAULT_PATTERNS);
  const records = await prisma.stablePatternUnlock.findMany({ where: { stableId } });
  for (const r of records) unlocked.add(r.pattern);
  return unlocked;
}

// ---------- Clan/Stable helpers ----------
async function getUserStable(userId: string) {
  const member = await prisma.clanMember.findUnique({
    where: { userId },
    select: { clanId: true, isLeader: true, clan: { select: { ownerId: true } } },
  });
  if (!member) return null;
  const stable = await prisma.stable.findUnique({
    where: { clanId: member.clanId },
    include: {
      horses: {
        where: { isRetired: false, isConfiscated: false },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  return stable
    ? {
        stable,
        clanId: member.clanId,
        canManage: true, // any clan member can manage
        isLeader: member.isLeader || member.clan.ownerId === userId,
      }
    : { stable: null, clanId: member.clanId, canManage: true, isLeader: member.isLeader || member.clan.ownerId === userId };
}

// ---------- Endpoints ----------

// State endpoint - one stop shop.
router.get('/state', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const userId = req.user.id;
  const cycleParam = Number(req.query.cycle);
  const cycleIndex = Number.isFinite(cycleParam) ? cycleParam : currentCycleIndex();

  await ensureLineupForCycle(cycleIndex);

  // Lazily resolve past races whose state is requested.
  const phaseNow = cyclePhase(cycleIndex);
  if (phaseNow === 'results' || phaseNow === 'past') {
    await ensureRaceResolved(cycleIndex);
  }

  const entries = await prisma.horseRaceEntry.findMany({
    where: { cycleIndex },
    orderBy: { lane: 'asc' },
    include: {
      horse: {
        include: {
          stable: { select: { id: true, name: true, clanId: true, clan: { select: { name: true } } } },
        },
      },
    },
  });

  // Build raceable list (for odds).
  const raceable = await buildRaceableEntries(cycleIndex);
  const probs = computeWinProbs(raceable, cycleIndex);
  const odds = computeOdds(probs);

  const lineup = entries.map((e) => {
    const raceableId = e.horseId ?? `comp-${cycleIndex}-${e.lane}`;
    const h = e.horse;
    return {
      lane: e.lane,
      betKey: raceableId,
      isComputer: e.isComputer || !e.horseId,
      horseId: e.horseId,
      name: e.isComputer || !h ? e.computerName : h.name,
      bodyColor: e.isComputer || !h ? e.computerColor : h.bodyColor,
      pattern: e.isComputer || !h ? e.computerPattern : h.pattern,
      patternColor: e.isComputer || !h ? e.computerPatternColor : h.patternColor,
      stableId: h?.stableId ?? null,
      stableName: h?.stable?.name ?? null,
      clanName: h?.stable?.clan?.name ?? null,
      ageYears: h ? ageYears(h.birthCycle, cycleIndex) : null,
      experience: h?.experience ?? null,
      stats: h
        ? {
            speed: effectiveStat(h.geneSpeed, h.trainSpeed, ageYears(h.birthCycle, cycleIndex)),
            stamina: effectiveStat(h.geneStamina, h.trainStamina, ageYears(h.birthCycle, cycleIndex)),
            consistency: effectiveStat(h.geneConsistency, h.trainConsistency, ageYears(h.birthCycle, cycleIndex)),
          }
        : null,
      odds: odds[raceableId] ?? null,
      finishPos: e.finishPos,
      finishTimeMs: e.finishTimeMs,
      prize: e.prize,
      wasDoped: e.wasDoped,
      wasCaught: e.wasCaught,
    };
  });

  // Bets summary (aggregated public).
  const aggregateBets = await prisma.horseRaceBet.groupBy({
    by: ['horseId'],
    where: { cycleIndex },
    _count: { _all: true },
    _sum: { amount: true },
  });
  const entriesMap: Record<string, { count: number; amount: number }> = {};
  let totalBets = 0;
  let totalAmount = 0;
  for (const a of aggregateBets) {
    entriesMap[a.horseId] = { count: a._count._all, amount: a._sum.amount ?? 0 };
    totalBets += a._count._all;
    totalAmount += a._sum.amount ?? 0;
  }

  // My bets.
  const myBets = await prisma.horseRaceBet.findMany({
    where: { userId, cycleIndex },
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    cycleIndex,
    serverNow: Date.now(),
    phase: phaseNow,
    lineup,
    entries: entriesMap,
    totalBets,
    totalAmount,
    myBets: myBets.map((b) => ({
      id: b.id,
      horseId: b.horseId,
      amount: b.amount,
      payout: b.payout,
      settled: b.settled,
    })),
  });
});

// Get my stable (or info if none).
router.get('/me/stable', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const info = await getUserStable(req.user.id);
  if (!info) return res.json({ stable: null, clanId: null, canManage: false, hasClan: false });
  if (!info.stable) return res.json({ stable: null, clanId: info.clanId, canManage: info.canManage, hasClan: true });

  const cycleIndex = currentCycleIndex();
  const unlocked = await getUnlockedPatterns(info.stable.id);
  return res.json({
    stable: {
      id: info.stable.id,
      clanId: info.stable.clanId,
      name: info.stable.name,
      description: info.stable.description,
      logoUrl: info.stable.logoUrl,
      money: info.stable.money,
      totalWins: info.stable.totalWins,
      totalPodiums: info.stable.totalPodiums,
      totalRaces: info.stable.totalRaces,
      reputation: info.stable.reputation,
      horses: info.stable.horses.map((h) => ({
        id: h.id,
        name: h.name,
        bodyColor: h.bodyColor,
        pattern: h.pattern,
        patternColor: h.patternColor,
        geneSpeed: h.geneSpeed,
        geneStamina: h.geneStamina,
        geneConsistency: h.geneConsistency,
        trainSpeed: h.trainSpeed,
        trainStamina: h.trainStamina,
        trainConsistency: h.trainConsistency,
        birthCycle: h.birthCycle,
        ageYears: ageYears(h.birthCycle, cycleIndex),
        experience: h.experience,
        races: h.races,
        wins: h.wins,
        podiums: h.podiums,
        earnings: h.earnings,
        pendingEntries: h.pendingEntries,
        dopedForCycle: h.dopedForCycle,
        parent1Id: h.parent1Id,
        parent2Id: h.parent2Id,
      })),
    },
    clanId: info.clanId,
    canManage: info.canManage,
    hasClan: true,
    unlockedPatterns: Array.from(unlocked),
  });
});

// Create stable for the user's clan.
router.post('/stable', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 3 || name.length > 40) {
    return res.status(400).json({ error: 'Nom invalide (3-40 caractères).' });
  }
  const info = await getUserStable(req.user.id);
  if (!info) return res.status(400).json({ error: 'Vous devez rejoindre un clan pour créer une écurie.' });
  if (info.stable) return res.status(400).json({ error: 'Votre clan a déjà une écurie.' });

  try {
    const stable = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.user!.id }, select: { money: true } });
      if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
      if (Number(user.money) < STABLE_CREATE_COST) {
        throw Object.assign(new Error(`Coût ${STABLE_CREATE_COST.toLocaleString()}€ requis.`), { status: 400 });
      }
      await tx.user.update({ where: { id: req.user!.id }, data: { money: { decrement: BigInt(STABLE_CREATE_COST) } } });
      const s = await tx.stable.create({
        data: {
          clanId: info.clanId!,
          name: name.trim(),
        },
      });
      // Unlock default patterns explicitly (for clarity).
      // They're also implicit defaults, so we don't actually need to insert; skip.
      return s;
    });
    await emitSharedBalanceUpdatesForUserIds(prisma, [req.user.id]);
    logGame('horse_race_create_stable', req.user.id, req.user.username, { stableId: stable.id, name: stable.name });
    return res.json({ success: true, stable });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = (err as Error).message ?? 'Erreur inattendue.';
    return res.status(status).json({ error: message });
  }
});

// Update stable info.
router.patch('/stable', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const info = await getUserStable(req.user.id);
  if (!info?.stable) return res.status(404).json({ error: 'Pas d\'écurie.' });
  const { name, description, logoUrl } = req.body ?? {};
  const data: Prisma.StableUpdateInput = {};
  if (typeof name === 'string' && name.trim().length >= 3 && name.length <= 40) data.name = name.trim();
  if (typeof description === 'string' && description.length <= 300) data.description = description;
  if (typeof logoUrl === 'string' || logoUrl === null) data.logoUrl = logoUrl;
  await prisma.stable.update({ where: { id: info.stable.id }, data });
  return res.json({ success: true });
});

// List public stables.
router.get('/stables', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const stables = await prisma.stable.findMany({
    include: {
      clan: { select: { name: true, ownerId: true } },
      horses: {
        where: { isRetired: false, isConfiscated: false },
        select: { id: true, name: true, bodyColor: true, pattern: true, patternColor: true, wins: true, races: true, birthCycle: true },
        orderBy: { wins: 'desc' },
        take: 8,
      },
      _count: { select: { horses: true } },
    },
    orderBy: { reputation: 'desc' },
    take: 50,
  });
  const cycleIndex = currentCycleIndex();
  res.json({
    stables: stables.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      logoUrl: s.logoUrl,
      clanName: s.clan.name,
      totalWins: s.totalWins,
      totalPodiums: s.totalPodiums,
      totalRaces: s.totalRaces,
      reputation: s.reputation,
      horseCount: s._count.horses,
      topHorses: s.horses.map((h) => ({
        id: h.id,
        name: h.name,
        bodyColor: h.bodyColor,
        pattern: h.pattern,
        patternColor: h.patternColor,
        wins: h.wins,
        races: h.races,
        ageYears: ageYears(h.birthCycle, cycleIndex),
      })),
    })),
  });
});

// Buy a foal.
router.post('/horses/buy', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 30) {
    return res.status(400).json({ error: 'Nom invalide (2-30 caractères).' });
  }
  const info = await getUserStable(req.user.id);
  if (!info?.stable) return res.status(400).json({ error: 'Créez une écurie d\'abord.' });

  // Random genes for a basic foal.
  const rand = mulberry32(((Date.now() + Math.floor(Math.random() * 1e9)) | 0));
  const geneSpeed = 5.5 + rand() * 2;
  const geneStamina = 5.5 + rand() * 2;
  const geneConsistency = 6 + rand() * 2.5;
  const cycleIndex = currentCycleIndex();

  try {
    const horse = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.user!.id }, select: { money: true } });
      if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
      if (Number(user.money) < HORSE_BUY_COST) {
        throw Object.assign(new Error(`Coût ${HORSE_BUY_COST.toLocaleString()}€ requis.`), { status: 400 });
      }
      await tx.user.update({ where: { id: req.user!.id }, data: { money: { decrement: BigInt(HORSE_BUY_COST) } } });
      return tx.horse.create({
        data: {
          stableId: info.stable!.id,
          name: name.trim(),
          bodyColor: COMP_COLORS[Math.floor(rand() * COMP_COLORS.length)],
          pattern: 'solid',
          patternColor: '#f8fafc',
          geneSpeed,
          geneStamina,
          geneConsistency,
          birthCycle: cycleIndex,
        },
      });
    });
    await emitSharedBalanceUpdatesForUserIds(prisma, [req.user.id]);
    logGame('horse_race_buy_horse', req.user.id, req.user.username, { horseId: horse.id, name: horse.name });
    return res.json({ success: true, horse });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return res.status(status).json({ error: (err as Error).message ?? 'Erreur inattendue.' });
  }
});

// Customize horse (color, pattern, name).
router.patch('/horses/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const info = await getUserStable(req.user.id);
  if (!info?.stable) return res.status(404).json({ error: 'Pas d\'écurie.' });
  const horse = await prisma.horse.findUnique({ where: { id: req.params.id } });
  if (!horse || horse.stableId !== info.stable.id) return res.status(404).json({ error: 'Cheval introuvable.' });
  if (horse.isConfiscated || horse.isRetired) return res.status(400).json({ error: 'Cheval indisponible.' });

  const { name, bodyColor, pattern, patternColor } = req.body ?? {};
  const data: Prisma.HorseUpdateInput = {};
  const wantsCustomize =
    (typeof bodyColor === 'string' && bodyColor !== horse.bodyColor) ||
    (typeof pattern === 'string' && pattern !== horse.pattern) ||
    (typeof patternColor === 'string' && patternColor !== horse.patternColor);

  if (typeof name === 'string' && name.trim().length >= 2 && name.length <= 30) {
    data.name = name.trim();
  }
  if (typeof bodyColor === 'string' && /^#[0-9a-f]{6}$/i.test(bodyColor)) data.bodyColor = bodyColor;
  if (typeof patternColor === 'string' && /^#[0-9a-f]{6}$/i.test(patternColor)) data.patternColor = patternColor;
  if (typeof pattern === 'string') {
    if (!PATTERN_KEYS.has(pattern)) return res.status(400).json({ error: 'Pattern inconnu.' });
    const unlocked = await getUnlockedPatterns(info.stable.id);
    if (!unlocked.has(pattern)) return res.status(403).json({ error: 'Pattern verrouillé. Débloquez-le via les victoires.' });
    data.pattern = pattern;
  }

  if (wantsCustomize) {
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: req.user!.id }, select: { money: true } });
        if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
        if (Number(user.money) < CUSTOMIZE_COST) {
          throw Object.assign(new Error(`Coût ${CUSTOMIZE_COST.toLocaleString()}€ requis.`), { status: 400 });
        }
        await tx.user.update({ where: { id: req.user!.id }, data: { money: { decrement: BigInt(CUSTOMIZE_COST) } } });
        await tx.horse.update({ where: { id: horse.id }, data });
      });
      await emitSharedBalanceUpdatesForUserIds(prisma, [req.user.id]);
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      return res.status(status).json({ error: (err as Error).message ?? 'Erreur inattendue.' });
    }
  } else if (Object.keys(data).length > 0) {
    // Just renaming - free.
    await prisma.horse.update({ where: { id: horse.id }, data });
  }

  return res.json({ success: true });
});

// Train a horse.
router.post('/horses/:id/train', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { stat } = req.body ?? {};
  if (!['speed', 'stamina', 'consistency'].includes(stat)) {
    return res.status(400).json({ error: 'Statistique invalide.' });
  }
  const info = await getUserStable(req.user.id);
  if (!info?.stable) return res.status(404).json({ error: 'Pas d\'écurie.' });
  const horse = await prisma.horse.findUnique({ where: { id: req.params.id } });
  if (!horse || horse.stableId !== info.stable.id) return res.status(404).json({ error: 'Cheval introuvable.' });
  if (horse.isConfiscated || horse.isRetired) return res.status(400).json({ error: 'Cheval indisponible.' });
  const field = stat === 'speed' ? 'trainSpeed' : stat === 'stamina' ? 'trainStamina' : 'trainConsistency';
  if (horse[field] + HORSE_TRAIN_INC > HORSE_TRAIN_CAP + 0.0001) {
    return res.status(400).json({ error: 'Plafond d\'entraînement atteint.' });
  }
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.user!.id }, select: { money: true } });
      if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
      if (Number(user.money) < HORSE_TRAIN_COST) {
        throw Object.assign(new Error(`Coût ${HORSE_TRAIN_COST.toLocaleString()}€ requis.`), { status: 400 });
      }
      await tx.user.update({ where: { id: req.user!.id }, data: { money: { decrement: BigInt(HORSE_TRAIN_COST) } } });
      await tx.horse.update({ where: { id: horse.id }, data: { [field]: { increment: HORSE_TRAIN_INC } } });
    });
    await emitSharedBalanceUpdatesForUserIds(prisma, [req.user.id]);
    logGame('horse_race_train', req.user.id, req.user.username, { horseId: horse.id, stat });
    return res.json({ success: true });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return res.status(status).json({ error: (err as Error).message ?? 'Erreur inattendue.' });
  }
});

// Register a horse for N upcoming races.
router.post('/horses/:id/register', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { count } = req.body ?? {};
  const n = Math.floor(Number(count) || 0);
  if (n < 1 || n > 10) return res.status(400).json({ error: 'Nombre d\'inscriptions invalide (1-10).' });

  const info = await getUserStable(req.user.id);
  if (!info?.stable) return res.status(404).json({ error: 'Pas d\'écurie.' });
  const horse = await prisma.horse.findUnique({ where: { id: req.params.id } });
  if (!horse || horse.stableId !== info.stable.id) return res.status(404).json({ error: 'Cheval introuvable.' });
  if (horse.isConfiscated || horse.isRetired) return res.status(400).json({ error: 'Cheval indisponible.' });
  const cycleIndex = currentCycleIndex();
  if (ageYears(horse.birthCycle, cycleIndex) < MIN_AGE_TO_RACE) {
    return res.status(400).json({ error: 'Le cheval est trop jeune pour courir.' });
  }
  if (horse.pendingEntries + n > REGISTRATION_MAX_PENDING) {
    return res.status(400).json({ error: `Maximum ${REGISTRATION_MAX_PENDING} inscriptions en file.` });
  }
  await prisma.horse.update({ where: { id: horse.id }, data: { pendingEntries: { increment: n } } });
  logGame('horse_race_register', req.user.id, req.user.username, { horseId: horse.id, count: n });
  // Note: registeredByUserId is set as clan owner in lineup logic; here we could track latest registrar
  // by storing it as a separate column on Horse. For now we accept the clan-owner fallback.
  return res.json({ success: true, pendingEntries: horse.pendingEntries + n });
});

// Dope a horse for the next race.
router.post('/horses/:id/dope', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const info = await getUserStable(req.user.id);
  if (!info?.stable) return res.status(404).json({ error: 'Pas d\'écurie.' });
  const horse = await prisma.horse.findUnique({ where: { id: req.params.id } });
  if (!horse || horse.stableId !== info.stable.id) return res.status(404).json({ error: 'Cheval introuvable.' });
  if (horse.isConfiscated || horse.isRetired) return res.status(400).json({ error: 'Cheval indisponible.' });

  // Dope applies to the next race the horse is scheduled to run in.
  // Find the next entry (current cycle if betting still open, else next cycle).
  const cycleIndex = currentCycleIndex();
  // Look up the soonest entry for this horse (next race it's in).
  const nextEntry = await prisma.horseRaceEntry.findFirst({
    where: { horseId: horse.id, cycleIndex: { gte: cycleIndex }, finishPos: null },
    orderBy: { cycleIndex: 'asc' },
  });
  if (!nextEntry) {
    return res.status(400).json({ error: 'Le cheval n\'est pas inscrit à une course à venir.' });
  }
  if (!isBettingOpen(nextEntry.cycleIndex)) {
    return res.status(400).json({ error: 'Trop tard : la course de ce cheval est verrouillée.' });
  }
  if (horse.dopedForCycle === nextEntry.cycleIndex) {
    return res.status(400).json({ error: 'Déjà dopé pour cette course.' });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.user!.id }, select: { money: true } });
      if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
      if (Number(user.money) < DOPE_COST) {
        throw Object.assign(new Error(`Coût ${DOPE_COST.toLocaleString()}€ requis.`), { status: 400 });
      }
      await tx.user.update({ where: { id: req.user!.id }, data: { money: { decrement: BigInt(DOPE_COST) } } });
      await tx.horse.update({ where: { id: horse.id }, data: { dopedForCycle: nextEntry.cycleIndex } });
    });
    await emitSharedBalanceUpdatesForUserIds(prisma, [req.user.id]);
    logGame('horse_race_dope', req.user.id, req.user.username, { horseId: horse.id, cycleIndex: nextEntry.cycleIndex });
    return res.json({ success: true, dopedForCycle: nextEntry.cycleIndex });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return res.status(status).json({ error: (err as Error).message ?? 'Erreur inattendue.' });
  }
});

// Retire / sell a horse (refund 30% of buy cost).
router.delete('/horses/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const info = await getUserStable(req.user.id);
  if (!info?.stable) return res.status(404).json({ error: 'Pas d\'écurie.' });
  const horse = await prisma.horse.findUnique({ where: { id: req.params.id } });
  if (!horse || horse.stableId !== info.stable.id) return res.status(404).json({ error: 'Cheval introuvable.' });
  const refund = Math.floor(HORSE_BUY_COST * 0.3);
  await prisma.$transaction(async (tx) => {
    await tx.horse.update({ where: { id: horse.id }, data: { isRetired: true, pendingEntries: 0 } });
    await tx.user.update({ where: { id: req.user!.id }, data: { money: { increment: BigInt(refund) } } });
  });
  await emitSharedBalanceUpdatesForUserIds(prisma, [req.user.id]);
  return res.json({ success: true, refund });
});

// Breed two horses.
router.post('/breed', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { horse1Id, horse2Id, foalName } = req.body ?? {};
  if (typeof foalName !== 'string' || foalName.trim().length < 2 || foalName.length > 30) {
    return res.status(400).json({ error: 'Nom du poulain invalide (2-30 caractères).' });
  }
  if (!horse1Id || !horse2Id || horse1Id === horse2Id) {
    return res.status(400).json({ error: 'Deux chevaux distincts requis.' });
  }
  const info = await getUserStable(req.user.id);
  if (!info?.stable) return res.status(404).json({ error: 'Pas d\'écurie.' });
  const h1 = await prisma.horse.findUnique({ where: { id: horse1Id } });
  const h2 = await prisma.horse.findUnique({ where: { id: horse2Id } });
  if (!h1 || !h2 || h1.stableId !== info.stable.id || h2.stableId !== info.stable.id) {
    return res.status(404).json({ error: 'Chevaux introuvables.' });
  }
  if (h1.isConfiscated || h1.isRetired || h2.isConfiscated || h2.isRetired) {
    return res.status(400).json({ error: 'Cheval indisponible.' });
  }
  const cycleIndex = currentCycleIndex();
  if (ageYears(h1.birthCycle, cycleIndex) < MIN_AGE_TO_BREED || ageYears(h2.birthCycle, cycleIndex) < MIN_AGE_TO_BREED) {
    return res.status(400).json({ error: `Les deux parents doivent avoir au moins ${MIN_AGE_TO_BREED} ans.` });
  }

  const rand = mulberry32(((Date.now() + Math.floor(Math.random() * 1e9)) | 0));
  // Genetics: average of parents ± noise, slight elitism toward higher stat.
  const mix = (a: number, b: number) => {
    const pick = rand() < 0.5 ? a : b;
    const avg = (a + b) / 2;
    const baseline = (pick * 0.6) + (avg * 0.4);
    const noise = (rand() - 0.5) * 1.2;
    return Math.max(4, Math.min(9.8, baseline + noise));
  };
  const geneSpeed = mix(h1.geneSpeed, h2.geneSpeed);
  const geneStamina = mix(h1.geneStamina, h2.geneStamina);
  const geneConsistency = mix(h1.geneConsistency, h2.geneConsistency);
  const bodyColor = rand() < 0.5 ? h1.bodyColor : h2.bodyColor;

  try {
    const foal = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.user!.id }, select: { money: true } });
      if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
      if (Number(user.money) < BREED_COST) {
        throw Object.assign(new Error(`Coût ${BREED_COST.toLocaleString()}€ requis.`), { status: 400 });
      }
      await tx.user.update({ where: { id: req.user!.id }, data: { money: { decrement: BigInt(BREED_COST) } } });
      return tx.horse.create({
        data: {
          stableId: info.stable!.id,
          name: foalName.trim(),
          bodyColor,
          pattern: 'solid',
          patternColor: '#f8fafc',
          geneSpeed,
          geneStamina,
          geneConsistency,
          birthCycle: cycleIndex,
          parent1Id: h1.id,
          parent2Id: h2.id,
        },
      });
    });
    await emitSharedBalanceUpdatesForUserIds(prisma, [req.user.id]);
    logGame('horse_race_breed', req.user.id, req.user.username, { foalId: foal.id });
    return res.json({ success: true, foal });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return res.status(status).json({ error: (err as Error).message ?? 'Erreur inattendue.' });
  }
});

// Place a single bet (caller can place up to 3 different horses).
router.post('/bets', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const userId = req.user.id;
  const { cycleIndex, horseId, amount } = req.body ?? {};
  if (typeof cycleIndex !== 'number' || !Number.isFinite(cycleIndex)) {
    return res.status(400).json({ error: 'Cycle invalide.' });
  }
  if (typeof horseId !== 'string' || horseId.length === 0 || horseId.length > 64) {
    return res.status(400).json({ error: 'Cheval invalide.' });
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return res.status(400).json({ error: 'Mise invalide.' });
  }
  const amt = Math.floor(amount);
  if (amt < MIN_BET || amt > MAX_BET_TOTAL) {
    return res.status(400).json({ error: 'Mise hors limites.' });
  }
  if (!isBettingOpen(cycleIndex)) {
    return res.status(400).json({ error: 'Phase de paris fermée.' });
  }

  // Ensure lineup is locked in and the horseId is valid.
  await ensureLineupForCycle(cycleIndex);
  const entries = await prisma.horseRaceEntry.findMany({ where: { cycleIndex } });
  const valid = new Set(entries.map((e) => e.horseId ?? `comp-${cycleIndex}-${e.lane}`));
  if (!valid.has(horseId)) {
    return res.status(400).json({ error: 'Cheval absent de la course.' });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const mine = await tx.horseRaceBet.findMany({ where: { userId, cycleIndex } });
      if (mine.find((b) => b.horseId === horseId)) {
        throw Object.assign(new Error('Vous avez déjà un pari sur ce cheval.'), { status: 400 });
      }
      if (mine.length >= MAX_BETS_PER_USER) {
        throw Object.assign(new Error(`Maximum ${MAX_BETS_PER_USER} paris par course.`), { status: 400 });
      }
      const totalSoFar = mine.reduce((s, b) => s + b.amount, 0);
      if (totalSoFar + amt > MAX_BET_TOTAL) {
        throw Object.assign(new Error(`Mise totale dépasse ${MAX_BET_TOTAL.toLocaleString()}€.`), { status: 400 });
      }
      const user = await tx.user.findUnique({ where: { id: userId }, select: { money: true } });
      if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
      if (Number(user.money) < amt) {
        throw Object.assign(new Error('Solde insuffisant.'), { status: 400 });
      }
      await tx.user.update({ where: { id: userId }, data: { money: { decrement: BigInt(amt) } } });
      await tx.horseRaceBet.create({
        data: { userId, cycleIndex, horseId, amount: amt },
      });
    });
    await emitSharedBalanceUpdatesForUserIds(prisma, [userId]);
    logGame('horse_race_place_bet', userId, req.user.username, { cycleIndex, horseId, amount: amt });
    return res.json({ success: true });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return res.status(status).json({ error: (err as Error).message ?? 'Erreur inattendue.' });
  }
});

// Cancel a single bet.
router.delete('/bets/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const userId = req.user.id;
  const bet = await prisma.horseRaceBet.findUnique({ where: { id: req.params.id } });
  if (!bet || bet.userId !== userId) return res.status(404).json({ error: 'Pari introuvable.' });
  if (bet.settled) return res.status(400).json({ error: 'Pari déjà liquidé.' });
  if (!isBettingOpen(bet.cycleIndex)) return res.status(400).json({ error: 'Phase de paris fermée.' });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { money: { increment: BigInt(bet.amount) } } });
    await tx.horseRaceBet.delete({ where: { id: bet.id } });
  });
  await emitSharedBalanceUpdatesForUserIds(prisma, [userId]);
  logGame('horse_race_cancel_bet', userId, req.user.username, { cycleIndex: bet.cycleIndex, horseId: bet.horseId });
  return res.json({ success: true });
});

// Get patterns catalog with unlock status.
router.get('/patterns', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const info = await getUserStable(req.user.id);
  const unlocked = info?.stable ? await getUnlockedPatterns(info.stable.id) : new Set(DEFAULT_PATTERNS);
  const totalWins = info?.stable?.totalWins ?? 0;
  res.json({
    patterns: PATTERNS.map((p) => ({
      key: p.key,
      label: p.label,
      rarity: p.rarity,
      unlockWins: p.unlockWins ?? null,
      unlocked: unlocked.has(p.key) || (p.unlockWins ? totalWins >= p.unlockWins : true),
    })),
    totalWins,
  });
});

// Unlock a pattern (when win threshold reached). Auto-unlock retroactively if missed.
router.post('/patterns/unlock', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { pattern } = req.body ?? {};
  if (typeof pattern !== 'string' || !PATTERN_KEYS.has(pattern)) {
    return res.status(400).json({ error: 'Pattern inconnu.' });
  }
  const info = await getUserStable(req.user.id);
  if (!info?.stable) return res.status(404).json({ error: 'Pas d\'écurie.' });
  const def = PATTERNS.find((p) => p.key === pattern)!;
  if (!def.unlockWins) return res.json({ success: true, alreadyDefault: true });
  if (info.stable.totalWins < def.unlockWins) {
    return res.status(400).json({ error: `${def.unlockWins} victoires requises (actuel: ${info.stable.totalWins}).` });
  }
  await prisma.stablePatternUnlock.upsert({
    where: { stableId_pattern: { stableId: info.stable.id, pattern } },
    update: {},
    create: { stableId: info.stable.id, pattern },
  });
  return res.json({ success: true });
});

// Constants exposed for the frontend.
router.get('/config', authMiddleware, async (_req: AuthRequest, res: Response) => {
  res.json({
    CYCLE_MS,
    RACE_MS,
    RESULTS_MS,
    BETTING_MS,
    ENTRANTS,
    HOUSE_EDGE,
    MAX_BETS_PER_USER,
    MAX_BET_TOTAL,
    STABLE_CREATE_COST,
    HORSE_BUY_COST,
    HORSE_TRAIN_COST,
    HORSE_TRAIN_INC,
    HORSE_TRAIN_CAP,
    BREED_COST,
    CUSTOMIZE_COST,
    DOPE_COST,
    DOPE_CATCH_PCT,
    DOPE_SPEED_BOOST,
    DOPE_STAMINA_BOOST,
    CYCLES_PER_YEAR,
    MIN_AGE_TO_RACE,
    MIN_AGE_TO_BREED,
    DECLINE_START_AGE,
    PRIZE_BASE_1ST,
    PRIZE_BASE_2ND,
    PRIZE_BASE_3RD,
    PRIZE_POOL_1ST_PCT,
    PRIZE_POOL_2ND_PCT,
    PRIZE_POOL_3RD_PCT,
  });
});

// Background ticker: resolve cycles that have just finished, so prizes/notifications fire
// even when no one is actively watching.
let tickerStarted = false;
function startTicker() {
  if (tickerStarted) return;
  tickerStarted = true;
  setInterval(() => {
    void (async () => {
      try {
        const curCycle = currentCycleIndex();
        const phaseNow = cyclePhase(curCycle);
        if (phaseNow === 'results') {
          await ensureRaceResolved(curCycle);
        }
        // Also resolve cycle-1 if it's lingering unresolved.
        const prev = curCycle - 1;
        const unresolved = await prisma.horseRaceResolution.findUnique({ where: { cycleIndex: prev } });
        if (!unresolved) {
          await ensureRaceResolved(prev);
        }
      } catch { /* ignore */ }
    })();
  }, 10_000);
}
startTicker();

export default router;
