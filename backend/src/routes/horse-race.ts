import { Router, type Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../server.js';
import { logGame } from '../utils/logger.js';

const router = Router();

const CYCLE_MS = 5 * 60 * 1000;
const RACE_MS = 60 * 1000;
const RESULTS_MS = 30 * 1000;
const BETTING_MS = CYCLE_MS - RACE_MS - RESULTS_MS;
const MAX_BET = 100_000;
const MAX_PAYOUT_MULTIPLIER = 50;
const KEEP_CYCLES = 24; // ~2 hours of history retained in memory

type Bet = {
  userId: string;
  cycleIndex: number;
  horseId: string;
  amount: number;
  createdAt: number;
  settled: boolean;
};

// cycleIndex -> userId -> Bet
const bets: Map<number, Map<string, Bet>> = new Map();
// One in-flight mutation per user at a time.
const userLocks = new Set<string>();

function currentCycleIndex(): number {
  return Math.floor(Date.now() / CYCLE_MS);
}

function isBettingOpen(cycleIndex: number): boolean {
  if (cycleIndex !== currentCycleIndex()) return false;
  const cycleStart = cycleIndex * CYCLE_MS;
  return Date.now() - cycleStart < BETTING_MS;
}

function isRaceFinished(cycleIndex: number): boolean {
  return currentCycleIndex() > cycleIndex || (
    currentCycleIndex() === cycleIndex
    && Date.now() - cycleIndex * CYCLE_MS >= BETTING_MS + RACE_MS
  );
}

function getCycleMap(cycleIndex: number): Map<string, Bet> {
  let m = bets.get(cycleIndex);
  if (!m) {
    m = new Map();
    bets.set(cycleIndex, m);
  }
  return m;
}

function cleanupOldCycles() {
  const cutoff = currentCycleIndex() - KEEP_CYCLES;
  for (const k of Array.from(bets.keys())) {
    if (k < cutoff) bets.delete(k);
  }
}

async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  if (userLocks.has(userId)) {
    throw Object.assign(new Error('Une autre opération est en cours.'), { status: 409 });
  }
  userLocks.add(userId);
  try {
    return await fn();
  } finally {
    userLocks.delete(userId);
  }
}

router.post('/place-bet', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const userId = req.user.id;
  const { cycleIndex, horseId, amount } = req.body ?? {};

  if (typeof cycleIndex !== 'number' || !Number.isFinite(cycleIndex)) {
    return res.status(400).json({ error: 'Cycle invalide.' });
  }
  if (typeof horseId !== 'string' || horseId.length === 0 || horseId.length > 32) {
    return res.status(400).json({ error: 'Cheval invalide.' });
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return res.status(400).json({ error: 'Mise invalide.' });
  }
  const amt = Math.floor(amount);
  if (amt < 1 || amt > MAX_BET) {
    return res.status(400).json({ error: 'Mise hors limites.' });
  }
  if (!isBettingOpen(cycleIndex)) {
    return res.status(400).json({ error: 'Phase de paris fermée.' });
  }

  try {
    const result = await withUserLock(userId, async () => {
      const cycleMap = getCycleMap(cycleIndex);
      const prior = cycleMap.get(userId);
      if (prior?.settled) {
        throw Object.assign(new Error('Pari déjà liquidé.'), { status: 400 });
      }

      const newMoney = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { money: true } });
        if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
        const refund = prior ? prior.amount : 0;
        const newBalance = Number(user.money) + refund - amt;
        if (newBalance < 0) {
          throw Object.assign(new Error('Solde insuffisant.'), { status: 400 });
        }
        await tx.user.update({ where: { id: userId }, data: { money: BigInt(newBalance) } });
        return newBalance;
      });

      cycleMap.set(userId, {
        userId,
        cycleIndex,
        horseId,
        amount: amt,
        createdAt: Date.now(),
        settled: false,
      });

      cleanupOldCycles();
      return { money: newMoney };
    });

    logGame('horse_race_place_bet', userId, req.user.username, { cycleIndex, horseId, amount: amt });
    return res.json({ success: true, money: result.money });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = (err as Error).message ?? 'Erreur inattendue.';
    return res.status(status).json({ error: message });
  }
});

router.post('/cancel-bet', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const userId = req.user.id;
  const { cycleIndex } = req.body ?? {};

  if (typeof cycleIndex !== 'number' || !Number.isFinite(cycleIndex)) {
    return res.status(400).json({ error: 'Cycle invalide.' });
  }
  if (!isBettingOpen(cycleIndex)) {
    return res.status(400).json({ error: 'Phase de paris fermée.' });
  }

  try {
    const result = await withUserLock(userId, async () => {
      const cycleMap = bets.get(cycleIndex);
      const bet = cycleMap?.get(userId);
      if (!bet) throw Object.assign(new Error('Aucun pari à annuler.'), { status: 404 });
      if (bet.settled) throw Object.assign(new Error('Pari déjà liquidé.'), { status: 400 });

      const newMoney = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { money: true } });
        if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
        const newBalance = Number(user.money) + bet.amount;
        await tx.user.update({ where: { id: userId }, data: { money: BigInt(newBalance) } });
        return newBalance;
      });

      cycleMap!.delete(userId);
      return { money: newMoney };
    });

    logGame('horse_race_cancel_bet', userId, req.user.username, { cycleIndex });
    return res.json({ success: true, money: result.money });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = (err as Error).message ?? 'Erreur inattendue.';
    return res.status(status).json({ error: message });
  }
});

router.post('/settle-bet', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const userId = req.user.id;
  const { cycleIndex, payout } = req.body ?? {};

  if (typeof cycleIndex !== 'number' || !Number.isFinite(cycleIndex)) {
    return res.status(400).json({ error: 'Cycle invalide.' });
  }
  if (typeof payout !== 'number' || !Number.isFinite(payout) || payout < 0) {
    return res.status(400).json({ error: 'Gain invalide.' });
  }
  if (!isRaceFinished(cycleIndex)) {
    return res.status(400).json({ error: 'La course n\'est pas finie.' });
  }

  try {
    const result = await withUserLock(userId, async () => {
      const cycleMap = bets.get(cycleIndex);
      const bet = cycleMap?.get(userId);
      if (!bet) throw Object.assign(new Error('Aucun pari pour cette course.'), { status: 404 });
      if (bet.settled) throw Object.assign(new Error('Pari déjà liquidé.'), { status: 400 });

      const cap = bet.amount * MAX_PAYOUT_MULTIPLIER;
      const safePayout = Math.min(Math.floor(payout), cap);

      let newMoney = 0;
      if (safePayout > 0) {
        newMoney = await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({ where: { id: userId }, select: { money: true } });
          if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
          const newBalance = Number(user.money) + safePayout;
          await tx.user.update({ where: { id: userId }, data: { money: BigInt(newBalance) } });
          return newBalance;
        });
      } else {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
        newMoney = Number(user?.money ?? 0);
      }

      bet.settled = true;
      return { money: newMoney, payout: safePayout, won: safePayout > 0 };
    });

    logGame('horse_race_settle_bet', userId, req.user.username, { cycleIndex, payout: result.payout });
    return res.json({ success: true, money: result.money, payout: result.payout });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = (err as Error).message ?? 'Erreur inattendue.';
    return res.status(status).json({ error: message });
  }
});

router.get('/state', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const cycleParam = Number(req.query.cycle);
  const cycleIndex = Number.isFinite(cycleParam) ? cycleParam : currentCycleIndex();

  const cycleMap = bets.get(cycleIndex);
  const entries: Record<string, { count: number; amount: number }> = {};
  let totalBets = 0;
  let totalAmount = 0;
  let myBet: { horseId: string; amount: number; settled: boolean } | null = null;

  if (cycleMap) {
    for (const bet of cycleMap.values()) {
      const entry = entries[bet.horseId] ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += bet.amount;
      entries[bet.horseId] = entry;
      totalBets += 1;
      totalAmount += bet.amount;
      if (bet.userId === req.user.id) {
        myBet = { horseId: bet.horseId, amount: bet.amount, settled: bet.settled };
      }
    }
  }

  return res.json({
    cycleIndex,
    serverNow: Date.now(),
    entries,
    totalBets,
    totalAmount,
    myBet,
  });
});

export default router;
