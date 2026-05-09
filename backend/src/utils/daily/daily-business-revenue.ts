import type { PrismaClient } from '@prisma/client';
import { getBusinessRevenueSnapshot } from '../../modules/you/service.js';
import { CONSTRUCTION_STATUS_UNDER_CONSTRUCTION } from '../../modules/you/construction.js';
import { getParisDayKey } from './daily-aura.js';
import { createNotification } from '../notifications.js';
import { emitSharedBalanceUpdatesForUserIds } from '../shared-balance.js';

let _timer: ReturnType<typeof setInterval> | null = null;

export const runDailyBusinessRevenue = async (prisma: PrismaClient): Promise<void> => {
  const todayKey = getParisDayKey(new Date());
  const notificationsToSend: Array<{
    userId: string;
    amount: number;
    businessName: string;
  }> = [];
  const ownerRevenueNotifications: Array<{
    userId: string;
    amount: number;
    businessName: string;
  }> = [];

  const businesses = await prisma.business.findMany({
    where: {
      typeKey: { not: 'bank' },
      OR: [
        { constructionProject: { is: null } },
        { constructionProject: { is: { status: { not: CONSTRUCTION_STATUS_UNDER_CONSTRUCTION } } } },
      ],
      AND: [
        {
          OR: [
            { lastBusinessRevenueDate: null },
            { lastBusinessRevenueDate: { not: todayKey } },
          ],
        },
      ],
    },
    select: {
      id: true,
      ownerId: true,
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
      resourceInventories: {
        select: {
          resourceType: true,
          quantity: true,
        },
      },
      shareholders: {
        select: {
          userId: true,
          sharePercent: true,
        },
      },
    },
  });

  if (businesses.length === 0) return;

  const creditedBusinessIds: string[] = [];
  const balanceUserIds = new Set<string>();

  for (const business of businesses) {
    const revenueSnapshot = getBusinessRevenueSnapshot(business);
    if (revenueSnapshot.dailyRevenue <= 0) {
      continue;
    }

    // Split daily revenue to shareholders first, then keep the remainder in treasury.
    const payoutPlan: Array<{ userId: string; amount: number }> = [];
    let remainingRevenue = revenueSnapshot.dailyRevenue;

    const validShareholders = (business.shareholders ?? []).filter((shareholder) => shareholder.sharePercent > 0);
    for (const shareholder of validShareholders) {
      if (remainingRevenue <= 0) break;

      const rawShareAmount = Math.floor((revenueSnapshot.dailyRevenue * shareholder.sharePercent) / 100);
      const shareAmount = Math.min(remainingRevenue, Math.max(0, rawShareAmount));
      if (shareAmount <= 0) {
        continue;
      }

      payoutPlan.push({ userId: shareholder.userId, amount: shareAmount });
      remainingRevenue -= shareAmount;
    }

    try {
      const applied = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.business.updateMany({
          where: {
            id: business.id,
            OR: [
              { lastBusinessRevenueDate: null },
              { lastBusinessRevenueDate: { not: todayKey } },
            ],
          },
          data: {
            treasuryMoney: { increment: remainingRevenue },
            lastBusinessRevenueDate: todayKey,
          },
        });

        if (updateResult.count !== 1) {
          return false;
        }

        for (const payout of payoutPlan) {
          await tx.user.update({
            where: { id: payout.userId },
            data: { money: { increment: payout.amount } },
          });
        }

        const totalShareholderPayout = payoutPlan.reduce((sum, payout) => sum + payout.amount, 0);

        await tx.businessTransaction.create({
          data: {
            businessId: business.id,
            type: 'DAILY_REVENUE',
            amount: remainingRevenue,
            label: totalShareholderPayout > 0
              ? `Revenu quotidien de ${business.name} (actionnaires: ${totalShareholderPayout.toLocaleString('fr-FR')})`
              : `Revenu quotidien de ${business.name}`,
            actorId: null,
          },
        });

        return true;
      });

      if (!applied) {
        continue;
      }

      creditedBusinessIds.push(business.id);
      balanceUserIds.add(business.ownerId);
      for (const payout of payoutPlan) {
        notificationsToSend.push({
          userId: payout.userId,
          amount: payout.amount,
          businessName: business.name,
        });
        balanceUserIds.add(payout.userId);
      }

      ownerRevenueNotifications.push({
        userId: business.ownerId,
        amount: remainingRevenue,
        businessName: business.name,
      });
    } catch (error) {
      console.error(`[daily-business-revenue] Failed for business ${business.id}:`, error);
    }
  }

  if (creditedBusinessIds.length === 0) return;

  await Promise.allSettled(
    [
      ...notificationsToSend.map((entry) =>
        createNotification({
          userId: entry.userId,
          type: 'MONEY_RECEIVED',
          title: 'Dividende quotidien recu',
          body: `${entry.amount.toLocaleString('fr-FR')} money ont ete verses sur ton wallet pour tes parts de ${entry.businessName}.`,
          link: '/you?tab=travail',
          icon: 'briefcase-business',
          data: {
            source: 'business_shareholder_daily_revenue',
            amount: entry.amount,
            businessName: entry.businessName,
          },
        }),
      ),
      ...ownerRevenueNotifications.map((entry) =>
        createNotification({
          userId: entry.userId,
          type: 'SYSTEM',
          title: 'Revenu quotidien credite',
          body: `${entry.amount.toLocaleString('fr-FR')} money ont ete ajoutes a la tresorerie de ${entry.businessName}.`,
          link: '/you?tab=travail',
          icon: 'briefcase-business',
          data: {
            source: 'business_owner_daily_revenue',
            amount: entry.amount,
            businessName: entry.businessName,
          },
        }),
      ),
    ],
  );

  if (balanceUserIds.size > 0) {
    await emitSharedBalanceUpdatesForUserIds(prisma, Array.from(balanceUserIds));
  }

  console.log(`[daily-business-revenue] Credited ${creditedBusinessIds.length} business(es) for ${todayKey}`);
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
