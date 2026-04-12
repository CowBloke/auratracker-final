import type { PrismaClient } from '@prisma/client';
import { getParisDayKey } from './dailyAura.js';
import { logAdmin } from './logger.js';

export const BANK_BASE_DAILY_RATE = 0.002;       // 0.2% per day
export const BANK_LIVRET_DAILY_RATE = 0.005;     // 0.5% per day with livret épargne
export const BANK_ACCOUNT_COURANT_DAILY_RATE = 0.002; // 0.2% per day for checking accounts
export const BANK_ACCOUNT_EPARGNE_DAILY_RATE = 0.005; // 0.5% per day for savings accounts

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseDayKeyToUtcDate = (dayKey: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
};

const getDaysToCredit = (lastDayKey: string | null, todayKey: string): number => {
  if (!lastDayKey) {
    return 1;
  }

  const lastDate = parseDayKeyToUtcDate(lastDayKey);
  const todayDate = parseDayKeyToUtcDate(todayKey);
  if (!lastDate || !todayDate) {
    return 1;
  }

  const dayDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / MS_PER_DAY);
  return Math.max(0, dayDiff);
};

const computeCompoundedDailyGain = (principal: number, dailyRate: number, days: number): number => {
  if (principal <= 0 || days <= 0) {
    return 0;
  }

  let currentBalance = principal;
  let totalGain = 0;

  for (let day = 0; day < days; day += 1) {
    const gain = Math.max(1, Math.floor(currentBalance * dailyRate));
    totalGain += gain;
    currentBalance += gain;
  }

  return totalGain;
};

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

  const bankAccounts = await prisma.bankAccount.findMany({
    where: {
      businessId: { in: eligible.map((bank) => bank.id) },
      accountType: { in: ['COURANT', 'EPARGNE'] },
      balance: { gt: 0 },
    },
    select: {
      id: true,
      businessId: true,
      accountType: true,
      balance: true,
    },
  });

  const accountsByBusiness = new Map<string, Array<{ id: string; balance: number; accountType: string }>>();
  for (const account of bankAccounts) {
    const list = accountsByBusiness.get(account.businessId) ?? [];
    list.push({ id: account.id, balance: account.balance, accountType: account.accountType });
    accountsByBusiness.set(account.businessId, list);
  }

  const dailySummary: Array<{
    id: string;
    name: string;
    bankRevenue: number;
    bankRate: number;
    accountInterestPaid: number;
    accountCountCredited: number;
    creditedDays: number;
    livretEpargneUnlocked: boolean;
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const bank of eligible) {
      const creditedDays = getDaysToCredit(bank.lastBankRevenueDate, todayKey);
      if (creditedDays <= 0) {
        continue;
      }

      const bankRate = bank.livretEpargneUnlocked ? BANK_LIVRET_DAILY_RATE : BANK_BASE_DAILY_RATE;
      const bankRevenue = computeCompoundedDailyGain(bank.treasuryMoney, bankRate, creditedDays);

      const accounts = accountsByBusiness.get(bank.id) ?? [];
      let accountInterestPaid = 0;
      const accountCredits: Array<{ id: string; interest: number }> = [];

      for (const account of accounts) {
        const accountRate = account.accountType === 'EPARGNE'
          ? BANK_ACCOUNT_EPARGNE_DAILY_RATE
          : BANK_ACCOUNT_COURANT_DAILY_RATE;
        const interest = computeCompoundedDailyGain(account.balance, accountRate, creditedDays);
        if (interest <= 0) {
          continue;
        }

        accountInterestPaid += interest;
        accountCredits.push({ id: account.id, interest });
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

      for (const account of accountCredits) {
        await tx.bankAccount.update({
          where: { id: account.id },
          data: { balance: { increment: account.interest } },
        });
      }

      dailySummary.push({
        id: bank.id,
        name: bank.name,
        bankRevenue,
        bankRate,
        accountInterestPaid,
        accountCountCredited: accountCredits.length,
        creditedDays,
        livretEpargneUnlocked: bank.livretEpargneUnlocked,
      });
    }
  });

  await Promise.allSettled(
    dailySummary.map((bank) =>
      logAdmin('bank_daily_revenue', undefined, undefined, bank.id, bank.name, {
        revenue: bank.bankRevenue,
        rate: bank.bankRate,
        accountCourantInterestRate: BANK_ACCOUNT_COURANT_DAILY_RATE,
        accountInterestRate: BANK_ACCOUNT_EPARGNE_DAILY_RATE,
        accountInterestPaid: bank.accountInterestPaid,
        accountCountCredited: bank.accountCountCredited,
        creditedDays: bank.creditedDays,
        dayKey: todayKey,
        livretEpargneUnlocked: bank.livretEpargneUnlocked,
      })
    )
  );

  console.log(`[daily-bank-revenue] Credited ${dailySummary.length} bank(s) for ${todayKey}`);
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
