import type { Prisma, PrismaClient } from '@prisma/client';
import { io } from '../server.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

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
  return partnerId ? [userId, partnerId] : [userId];
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
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
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
      await db.user.update({
        where: { id: user.id },
        data: { money: { decrement: debit } },
      });
      remaining -= debit;
    }
  }

  return userIds;
}

export async function emitSharedBalanceUpdates(db: DbClient, userId: string) {
  const userIds = await getSharedUserIds(db, userId);
  const balance = await getSharedBalanceByUserIds(db, userIds);

  userIds.forEach((id) => {
    io.emit('economy:balance-update', {
      userId: id,
      aura: balance.aura,
      money: balance.money,
    });
  });

  return balance;
}
