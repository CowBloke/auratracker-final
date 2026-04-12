import type { PrismaClient } from '@prisma/client';
import { getParisDayKey } from './dailyAura.js';
import { logAdmin } from './logger.js';

export const BANK_BASE_DAILY_RATE = 0.002;       // 0.2% per day
export const BANK_LIVRET_DAILY_RATE = 0.005;     // 0.5% per day with livret épargne
export const BANK_ACCOUNT_EPARGNE_DAILY_RATE = 0.005; // 0.5% per day for savings accounts

let _timer: ReturnType<typeof setInterval> | null = null;
let _prisma: PrismaClient | null = null;

export const runDailyBankRevenue = async (prisma: PrismaClient): Promise<void> => {
  const todayKey = getParisDayKey(new Date());

  const banks = await prisma.business.findMany({
    where: { typeKey: 'bank' },
    select: {
      id: true,
      name: true,
      treasuryMoney: true,
      livretEpargneUnlocked: true,
      lastBankRevenueDate: true,
    },
  });

  const eligible = banks.filter((b) => b.lastBankRevenueDate !== todayKey);
  if (eligible.length === 0) return;

  const epargneAccounts = await prisma.bankAccount.findMany({
    where: {
      businessId: { in: eligible.map((bank) => bank.id) },
      accountType: 'EPARGNE',
      balance: { gt: 0 },
    },
    select: {
      id: true,
      businessId: true,
      balance: true,
    },
  });

  const epargneByBusiness = new Map<string, Array<{ id: string; balance: number }>>();
  for (const account of epargneAccounts) {
    const list = epargneByBusiness.get(account.businessId) ?? [];
    list.push({ id: account.id, balance: account.balance });
    epargneByBusiness.set(account.businessId, list);
  }

  const dailySummary: Array<{
    id: string;
    name: string;
    bankRevenue: number;
    bankRate: number;
    accountInterestPaid: number;
    accountCountCredited: number;
    livretEpargneUnlocked: boolean;
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const bank of eligible) {
      const bankRate = bank.livretEpargneUnlocked ? BANK_LIVRET_DAILY_RATE : BANK_BASE_DAILY_RATE;
      const bankRevenue = bank.treasuryMoney > 0 ? Math.max(1, Math.floor(bank.treasuryMoney * bankRate)) : 0;

      const accounts = epargneByBusiness.get(bank.id) ?? [];
      let accountInterestPaid = 0;

      for (const account of accounts) {
        const interest = Math.max(1, Math.floor(account.balance * BANK_ACCOUNT_EPARGNE_DAILY_RATE));
        accountInterestPaid += interest;
      }

      const claimed = await tx.business.updateMany({
        where: {
          id: bank.id,
          OR: [
            { lastBankRevenueDate: null },
            { lastBankRevenueDate: { not: todayKey } },
          ],
        },
        data: {
          treasuryMoney: { increment: bankRevenue + accountInterestPaid },
          lastBankRevenueDate: todayKey,
        },
      });

      if (claimed.count !== 1) {
        continue;
      }

      for (const account of accounts) {
        const interest = Math.max(1, Math.floor(account.balance * BANK_ACCOUNT_EPARGNE_DAILY_RATE));
        await tx.bankAccount.update({
          where: { id: account.id },
          data: { balance: { increment: interest } },
        });
      }

      dailySummary.push({
        id: bank.id,
        name: bank.name,
        bankRevenue,
        bankRate,
        accountInterestPaid,
        accountCountCredited: accounts.length,
        livretEpargneUnlocked: bank.livretEpargneUnlocked,
      });
    }
  });

  await Promise.all(
    dailySummary.map((bank) =>
      logAdmin('bank_daily_revenue', undefined, undefined, bank.id, bank.name, {
        revenue: bank.bankRevenue,
        rate: bank.bankRate,
        accountInterestRate: BANK_ACCOUNT_EPARGNE_DAILY_RATE,
        accountInterestPaid: bank.accountInterestPaid,
        accountCountCredited: bank.accountCountCredited,
        dayKey: todayKey,
        livretEpargneUnlocked: bank.livretEpargneUnlocked,
      })
    )
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
