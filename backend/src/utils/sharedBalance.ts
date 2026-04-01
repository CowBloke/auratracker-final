import type { Prisma, PrismaClient } from '@prisma/client';
import { io } from '../server.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

const uniqueUserIds = (userIds: string[]) => Array.from(new Set(userIds));

async function getMarriagePartnerId(db: DbClient, userId: string) {
  const relationship = await db.relationship.findFirst({
    where: {
      status: 'MARRIED',
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: {
      userAId: true,
      userBId: true,
    },
  });

  if (!relationship) {
    return null;
  }

  return relationship.userAId === userId ? relationship.userBId : relationship.userAId;
}

export async function getSharedUserIds(db: DbClient, userId: string) {
  const partnerId = await getMarriagePartnerId(db, userId);
  return partnerId ? uniqueUserIds([userId, partnerId]) : [userId];
}

export async function getSharedBalance(db: DbClient, userId: string) {
  const userIds = await getSharedUserIds(db, userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, money: true, aura: true },
  });

  return {
    userIds,
    money: users.reduce((sum, user) => sum + user.money, 0),
    aura: users.reduce((sum, user) => sum + BigInt(user.aura), BigInt(0)),
  };
}

export async function getSharedBalanceByUserIds(db: DbClient, userIds: string[]) {
  const uniqueIds = uniqueUserIds(userIds);
  const users = await db.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, money: true, aura: true },
  });

  return {
    money: users.reduce((sum, user) => sum + user.money, 0),
    aura: users.reduce((sum, user) => sum + BigInt(user.aura), BigInt(0)),
  };
}

export async function ensureSharedMoneyAvailable(db: DbClient, userId: string, amount: number) {
  const balance = await getSharedBalance(db, userId);
  return balance.money >= amount;
}

export async function debitSharedMoney(db: DbClient, userId: string, amount: number) {
  if (amount <= 0) {
    return getSharedUserIds(db, userId);
  }

  const userIds = await getSharedUserIds(db, userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, money: true },
  });

  const currentUser = users.find((user) => user.id === userId);
  const partner = users.find((user) => user.id !== userId);
  const orderedUsers = [currentUser, partner].filter(Boolean) as Array<{ id: string; money: number }>;

  const totalMoney = orderedUsers.reduce((sum, user) => sum + user.money, 0);
  if (totalMoney < amount) {
    throw new Error('INSUFFICIENT_SHARED_MONEY');
  }

  let remaining = amount;
  for (const user of orderedUsers) {
    if (remaining <= 0) break;
    const debit = Math.min(user.money, remaining);
    if (debit > 0) {
      const result = await db.user.updateMany({
        where: {
          id: user.id,
          money: { gte: debit },
        },
        data: {
          money: { decrement: debit },
        },
      });
      if (result.count !== 1) {
        throw new Error('INSUFFICIENT_SHARED_MONEY');
      }
      remaining -= debit;
    }
  }

  if (remaining > 0) {
    throw new Error('INSUFFICIENT_SHARED_MONEY');
  }

  return userIds;
}

export async function emitSharedBalanceUpdatesForUserIds(db: DbClient, userIds: string[]) {
  const uniqueIds = uniqueUserIds(userIds);
  if (uniqueIds.length === 0) {
    return new Map<string, { money: number; aura: bigint }>();
  }

  const households = await Promise.all(
    uniqueIds.map(async (id) => {
      const sharedUserIds = await getSharedUserIds(db, id);
      const balance = await getSharedBalanceByUserIds(db, sharedUserIds);
      return {
        sharedUserIds,
        balance,
      };
    })
  );

  const emittedBalances = new Map<string, { money: number; aura: bigint }>();

  households.forEach(({ sharedUserIds, balance }) => {
    sharedUserIds.forEach((id) => {
      if (emittedBalances.has(id)) {
        return;
      }

      emittedBalances.set(id, balance);
      io.to(`user:${id}`).emit('economy:balance-update', {
        userId: id,
        aura: Number(balance.aura),
        money: balance.money,
      });
    });
  });

  return emittedBalances;
}

export async function emitSharedBalanceUpdates(db: DbClient, userId: string) {
  const userIds = await getSharedUserIds(db, userId);
  const emittedBalances = await emitSharedBalanceUpdatesForUserIds(db, userIds);

  return emittedBalances.get(userId) ?? getSharedBalanceByUserIds(db, userIds);
}
