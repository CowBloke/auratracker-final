import type { PrismaClient } from '@prisma/client';
import { getBusinessRevenueSnapshot } from '../modules/you/service.js';
import { getParisDayKey } from './dailyAura.js';

let _timer: ReturnType<typeof setInterval> | null = null;

export const runDailyBusinessRevenue = async (prisma: PrismaClient): Promise<void> => {
  const todayKey = getParisDayKey(new Date());

  const businesses = await prisma.business.findMany({
    where: {
      typeKey: { not: 'bank' },
      OR: [
        { lastBusinessRevenueDate: null },
        { lastBusinessRevenueDate: { not: todayKey } },
      ],
    },
    select: {
      id: true,
      name: true,
      typeKey: true,
      treasuryMoney: true,
      monthlyRevenue: true,
      monthlyExpenses: true,
      customData: true,
      lastBusinessRevenueDate: true,
      startupProducts: {
        orderBy: { slotIndex: 'asc' },
        select: {
          id: true,
          slotIndex: true,
          name: true,
          deployedLevel: true,
          activeResearchLevel: true,
          researchStartedAt: true,
          researchEndsAt: true,
          researchCost: true,
        },
      },
      members: {
        select: { id: true },
      },
    },
  });

  if (businesses.length === 0) return;

  const results = await prisma.$transaction(async (tx) => {
    const creditedBusinessIds: string[] = [];

    for (const business of businesses) {
      const revenueSnapshot = getBusinessRevenueSnapshot(business);
      if (revenueSnapshot.dailyRevenue <= 0) {
        continue;
      }

      const updateResult = await tx.business.updateMany({
        where: {
          id: business.id,
          OR: [
            { lastBusinessRevenueDate: null },
            { lastBusinessRevenueDate: { not: todayKey } },
          ],
        },
        data: {
          treasuryMoney: { increment: revenueSnapshot.dailyRevenue },
          lastBusinessRevenueDate: todayKey,
        },
      });

      if (updateResult.count !== 1) {
        continue;
      }

      creditedBusinessIds.push(business.id);

      await tx.businessTransaction.create({
        data: {
          businessId: business.id,
          type: 'DAILY_REVENUE',
          amount: revenueSnapshot.dailyRevenue,
          label: `Revenu quotidien de ${business.name}`,
          actorId: null,
        },
      });
    }

    return creditedBusinessIds;
  });

  if (results.length === 0) return;

  console.log(`[daily-business-revenue] Credited ${results.length} business(es) for ${todayKey}`);
};

export const startDailyBusinessRevenueScheduler = (prisma: PrismaClient): void => {
  if (_timer) return;
  void runDailyBusinessRevenue(prisma);
  _timer = setInterval(() => {
    void runDailyBusinessRevenue(prisma);
  }, 60 * 60_000);
};

export const stopDailyBusinessRevenueScheduler = (): void => {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
};