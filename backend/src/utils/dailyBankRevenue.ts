import type { PrismaClient } from '@prisma/client';
import { getParisDayKey } from './dailyAura.js';

export const BANK_BASE_DAILY_RATE = 0.002;       // 0.2% per day
export const BANK_LIVRET_DAILY_RATE = 0.005;     // 0.5% per day with livret épargne

let _timer: ReturnType<typeof setInterval> | null = null;
let _prisma: PrismaClient | null = null;

export const runDailyBankRevenue = async (prisma: PrismaClient): Promise<void> => {
  const todayKey = getParisDayKey(new Date());

  const banks = await prisma.business.findMany({
    where: { typeKey: 'bank' },
    select: {
      id: true,
      treasuryMoney: true,
      livretEpargneUnlocked: true,
      lastBankRevenueDate: true,
    },
  });

  const eligible = banks.filter((b) => b.lastBankRevenueDate !== todayKey && b.treasuryMoney > 0);
  if (eligible.length === 0) return;

  await prisma.$transaction(
    eligible.map((bank) => {
      const rate = bank.livretEpargneUnlocked ? BANK_LIVRET_DAILY_RATE : BANK_BASE_DAILY_RATE;
      const revenue = Math.max(1, Math.floor(bank.treasuryMoney * rate));
      return prisma.business.update({
        where: { id: bank.id },
        data: {
          treasuryMoney: { increment: revenue },
          lastBankRevenueDate: todayKey,
        },
      });
    })
  );

  console.log(`[daily-bank-revenue] Credited ${eligible.length} bank(s) for ${todayKey}`);
};

export const startDailyBankRevenueScheduler = (prisma: PrismaClient): void => {
  if (_timer) return;
  _prisma = prisma;
  void runDailyBankRevenue(prisma);
  // Check every hour; the per-bank date guard prevents double-crediting
  _timer = setInterval(() => {
    void runDailyBankRevenue(prisma);
  }, 60 * 60_000);
};

export const stopDailyBankRevenueScheduler = (): void => {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    _prisma = null;
  }
};
