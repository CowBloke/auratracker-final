import type { PrismaClient } from '@prisma/client';
import { getParisDayKey, getNextParisMidnight } from './daily-aura.js';
import { createNotification } from '../notifications.js';
import { logAdmin } from '../logger.js';

export const DEFAULT_TAX_BRACKET_THRESHOLD = 10_000;
export const DEFAULT_TAX_BRACKET_RATE = 1.0; // 1%
export const LAST_TAX_RUN_KEY = 'last_tax_run_date';

let _timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Returns the applicable tax rate (%) for a given money amount.
 * The highest qualifying bracket (by threshold) is used.
 * Falls back to the default 1% @ 10k if no brackets are configured.
 */
const getApplicableRate = (
  money: number,
  brackets: { threshold: number; rate: number }[],
): number => {
  if (brackets.length === 0) {
    return money >= DEFAULT_TAX_BRACKET_THRESHOLD ? DEFAULT_TAX_BRACKET_RATE : 0;
  }
  const sorted = [...brackets].sort((a, b) => b.threshold - a.threshold);
  const match = sorted.find((b) => money >= b.threshold);
  return match ? match.rate : 0;
};

export const runDailyTax = async (
  prisma: PrismaClient,
  force = false,
): Promise<{ skipped: boolean; usersAffected: number; totalCollected: number }> => {
  const todayKey = getParisDayKey(new Date());

  if (!force) {
    const lastRun = await prisma.gameSettings.findUnique({
      where: { key: LAST_TAX_RUN_KEY },
    });
    if (lastRun?.value === todayKey) {
      return { skipped: true, usersAffected: 0, totalCollected: 0 };
    }
  }

  const brackets = await prisma.taxBracket.findMany({
    orderBy: { threshold: 'asc' },
  });

  const effectiveBrackets =
    brackets.length > 0
      ? brackets
      : [{ threshold: DEFAULT_TAX_BRACKET_THRESHOLD, rate: DEFAULT_TAX_BRACKET_RATE }];

  const minThreshold = Math.min(...effectiveBrackets.map((b) => b.threshold));

  const users = await prisma.user.findMany({
    where: { isApproved: true, money: { gte: minThreshold } },
    select: { id: true, username: true, money: true },
  });

  let usersAffected = 0;
  let totalCollected = 0;

  for (const user of users) {
    const currentMoney = Number(user.money);
    const rate = getApplicableRate(currentMoney, effectiveBrackets);
    if (rate <= 0) continue;

    const taxAmount = Math.max(1, Math.floor(currentMoney * (rate / 100)));
    const newMoney = Math.max(0, currentMoney - taxAmount);

    await prisma.user.update({
      where: { id: user.id },
      data: { money: newMoney },
    });

    await createNotification({
      userId: user.id,
      type: 'TAX',
      title: 'Impôt journalier prélevé',
      body: `${taxAmount.toLocaleString('fr-FR')} $ ont été prélevés sur votre compte au titre de l'impôt journalier (taux appliqué : ${rate}%).`,
      icon: 'landmark',
      data: { taxAmount, rate, previousMoney: user.money, newMoney },
    });

    usersAffected++;
    totalCollected += taxAmount;
  }

  const businesses = await prisma.business.findMany({
    where: { treasuryMoney: { gte: minThreshold } },
    select: { id: true, name: true, ownerId: true, treasuryMoney: true },
  });

  let businessesAffected = 0;

  for (const business of businesses) {
    const currentTreasury = Number(business.treasuryMoney);
    const rate = getApplicableRate(currentTreasury, effectiveBrackets);
    if (rate <= 0) continue;

    const taxAmount = Math.max(1, Math.floor(currentTreasury * (rate / 100)));
    const newTreasury = Math.max(0, currentTreasury - taxAmount);

    await prisma.business.update({
      where: { id: business.id },
      data: { treasuryMoney: newTreasury },
    });

    await prisma.businessTransaction.create({
      data: {
        businessId: business.id,
        type: 'TAX',
        amount: BigInt(-taxAmount),
        label: `Impôt journalier : ${taxAmount.toLocaleString('fr-FR')}€ prélevés (taux ${rate}%)`,
      },
    });

    await createNotification({
      userId: business.ownerId,
      type: 'TAX',
      title: `Impôt journalier — ${business.name}`,
      body: `${taxAmount.toLocaleString('fr-FR')} € ont été prélevés sur la trésorerie de ${business.name} au titre de l'impôt journalier (taux appliqué : ${rate}%).`,
      icon: 'landmark',
      data: { taxAmount, rate, previousTreasury: currentTreasury, newTreasury, businessId: business.id },
    });

    businessesAffected++;
    totalCollected += taxAmount;
  }

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { balance: { gte: minThreshold } },
    include: { business: { select: { name: true } } },
  });

  let bankAccountsAffected = 0;

  for (const account of bankAccounts) {
    const currentBalance = account.balance;
    const rate = getApplicableRate(currentBalance, effectiveBrackets);
    if (rate <= 0) continue;

    const taxAmount = Math.max(1, Math.floor(currentBalance * (rate / 100)));
    const newBalance = Math.max(0, currentBalance - taxAmount);

    await prisma.bankAccount.update({
      where: { id: account.id },
      data: { balance: newBalance },
    });

    await prisma.businessTransaction.create({
      data: {
        businessId: account.businessId,
        type: 'TAX',
        amount: BigInt(-taxAmount),
        label: `Impôt journalier (compte ${account.accountType}) : ${taxAmount.toLocaleString('fr-FR')}€ prélevés (taux ${rate}%)`,
      },
    });

    await createNotification({
      userId: account.userId,
      type: 'TAX',
      title: `Impôt journalier — compte ${account.accountType}`,
      body: `${taxAmount.toLocaleString('fr-FR')} € ont été prélevés sur votre compte ${account.accountType} chez ${account.business.name} au titre de l'impôt journalier (taux appliqué : ${rate}%).`,
      icon: 'landmark',
      data: { taxAmount, rate, previousBalance: currentBalance, newBalance, accountId: account.id },
    });

    bankAccountsAffected++;
    totalCollected += taxAmount;
  }

  await prisma.gameSettings.upsert({
    where: { key: LAST_TAX_RUN_KEY },
    update: { value: todayKey },
    create: { key: LAST_TAX_RUN_KEY, value: todayKey },
  });

  await logAdmin('daily_tax_run', undefined, undefined, undefined, undefined, {
    dayKey: todayKey,
    forced: force,
    usersAffected,
    businessesAffected,
    bankAccountsAffected,
    totalCollected,
    bracketsCount: brackets.length,
  });

  console.log(
    `[daily-tax] ${todayKey}: taxed ${usersAffected} user(s), ${businessesAffected} business(es), and ${bankAccountsAffected} bank account(s), collected ${totalCollected}$`,
  );

  return { skipped: false, usersAffected, totalCollected };
};

const scheduleNextRun = (prisma: PrismaClient): void => {
  const now = new Date();
  const nextMidnight = getNextParisMidnight(now);
  const delay = Math.max(0, nextMidnight.getTime() - now.getTime());

  _timer = setTimeout(() => {
    void runDailyTax(prisma).then(() => scheduleNextRun(prisma));
  }, delay);
};

export const startDailyTaxScheduler = (prisma: PrismaClient): void => {
  if (_timer) return;
  scheduleNextRun(prisma);
  const next = getNextParisMidnight(new Date());
  console.log(`[daily-tax] Scheduler started — next run at ${next.toISOString()}`);
};

export const stopDailyTaxScheduler = (): void => {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
};
