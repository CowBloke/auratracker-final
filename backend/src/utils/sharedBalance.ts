import type { Prisma, PrismaClient } from '@prisma/client';
import { io } from '../server.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

const uniqueUserIds = (userIds: string[]) => Array.from(new Set(userIds));

async function getMarriageRelationship(db: DbClient, userId: string) {
  return db.relationship.findFirst({
    where: {
      status: 'MARRIED',
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: {
      userAId: true,
      userBId: true,
      coupleBalance: true,
    },
  });
}

async function getMarriagePartnerId(db: DbClient, userId: string) {
  const relationship = await getMarriageRelationship(db, userId);

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
  const [user, relationship] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, money: true, aura: true },
    }),
    getMarriageRelationship(db, userId),
  ]);

  if (!user) {
    return {
      userIds: [userId],
      money: 0,
      aura: BigInt(0),
    };
  }

  const userIds = relationship
    ? uniqueUserIds([userId, relationship.userAId, relationship.userBId])
    : [userId];
  const auraUsers = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { aura: true },
  });

  return {
    userIds,
    money: user.money,
    aura: auraUsers.reduce((sum, auraUser) => sum + BigInt(auraUser.aura), BigInt(0)),
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
    return [userId];
  }

  const result = await db.user.updateMany({
    where: {
      id: userId,
      money: { gte: amount },
    },
    data: {
      money: { decrement: amount },
    },
  });

  if (result.count !== 1) {
    throw new Error('INSUFFICIENT_MONEY');
  }

  return [userId];
}

export async function emitSharedBalanceUpdatesForUserIds(db: DbClient, userIds: string[]) {
  const uniqueIds = uniqueUserIds(userIds);
  if (uniqueIds.length === 0) {
    return new Map<string, { money: number; aura: bigint }>();
  }

  const emittedBalances = new Map<string, { money: number; aura: bigint }>();
  const balances = await Promise.all(uniqueIds.map(async (id) => ({ id, balance: await getSharedBalance(db, id) })));

  balances.forEach(({ id, balance }) => {
    emittedBalances.set(id, { money: balance.money, aura: balance.aura });
    io.to(`user:${id}`).emit('economy:balance-update', {
      userId: id,
      aura: Number(balance.aura),
      money: balance.money,
    });
  });

  return emittedBalances;
}

export async function emitSharedBalanceUpdates(db: DbClient, userId: string) {
  const emittedBalances = await emitSharedBalanceUpdatesForUserIds(db, [userId]);
  return emittedBalances.get(userId) ?? getSharedBalance(db, userId);
}
