import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { logEconomy } from '../utils/logger.js';

const router = Router();

const ITEM_DROP_CHANCE = 0.82;
const MONEY_RANGE = { min: 80, max: 260 };
const AURA_RANGE = { min: 3, max: 16 };
const FEATURED_ITEM_COUNT = 6;

type PassRarity = 'common' | 'rare' | 'epic' | 'legendary';

type LootItem = {
  id: string;
  name: string;
  description: string;
  type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE' | 'GIFT';
  price: number;
  imageUrl: string | null;
  effect: string | null;
  expiresAt: Date | null;
};

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getDayDiff = (fromKey: string, toKey: string) => {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const parseItemEffect = (effect: string | null) => {
  if (!effect) return null;
  try {
    return JSON.parse(effect) as { type?: string };
  } catch {
    return null;
  }
};

const serializeLootItem = (item: LootItem) => ({
  id: item.id,
  name: item.name,
  description: item.description,
  type: item.type === 'GIFT' ? 'CONSUMABLE' : item.type,
  price: item.price,
  imageUrl: item.imageUrl,
});

const getItemRarity = (price: number): PassRarity => {
  if (price >= 4000) return 'legendary';
  if (price >= 2200) return 'epic';
  if (price >= 900) return 'rare';
  return 'common';
};

const getCurrencyRarity = (amount: number, ranges: { min: number; max: number }): PassRarity => {
  const ratio = (amount - ranges.min) / Math.max(1, ranges.max - ranges.min);
  if (ratio >= 0.9) return 'legendary';
  if (ratio >= 0.7) return 'epic';
  if (ratio >= 0.45) return 'rare';
  return 'common';
};

const getItemWeight = (item: LootItem) =>
  Math.max(1, Math.round(28000 / Math.max(250, item.price + 200)));

const pickWeightedItem = (items: LootItem[]) => {
  const totalWeight = items.reduce((sum, item) => sum + getItemWeight(item), 0);
  if (totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;
  for (const item of items) {
    roll -= getItemWeight(item);
    if (roll <= 0) return item;
  }

  return items[items.length - 1] ?? null;
};

const pickFeaturedItems = (items: LootItem[], count: number) => {
  const pool = [...items];
  const featured: LootItem[] = [];

  while (pool.length > 0 && featured.length < count) {
    const picked = pickWeightedItem(pool);
    if (!picked) break;
    featured.push(picked);
    const index = pool.findIndex((candidate) => candidate.id === picked.id);
    if (index >= 0) pool.splice(index, 1);
  }

  return featured;
};

const isEligibleLootItem = (item: LootItem, ownedItemIds: Set<string>, now: Date) => {
  if (item.type === 'GIFT') return false;
  if (item.expiresAt && item.expiresAt < now) return false;

  const effect = parseItemEffect(item.effect);
  const effectType = effect?.type ?? null;

  if (effectType === 'CUSTOM_BADGE') return false;
  if (effectType === 'CLAN_TAG_UNLOCK') return false;
  if (effectType === 'CLAN_SLOT_UPGRADE') return false;
  if (effectType === 'CLAN_GAME_MONEY_BOOST') return false;
  if (effectType === 'CLAN_BANNER') return false;
  if (effectType === 'DOODLE_JUMP_SKIN' && ownedItemIds.has(item.id)) return false;

  return true;
};

const buildRewardSummary = (rewards: Array<{ type: 'money' | 'aura' | 'item'; amount?: number; item?: LootItem }>) =>
  rewards.map((reward) => {
    if (reward.type === 'money') return `$${reward.amount}`;
    if (reward.type === 'aura') return `${reward.amount} aura`;
    return reward.item?.name ?? 'objet';
  }).join(', ');

const getPassContext = async (userId: string) => {
  const now = new Date();

  const [user, ownedItems, items] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { dailyPassStreak: true, lastDailyPassClaim: true, money: true, aura: true },
    }),
    prisma.userItem.findMany({
      where: { userId },
      select: { itemId: true },
    }),
    prisma.item.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        price: true,
        imageUrl: true,
        effect: true,
        expiresAt: true,
      },
    }),
  ]);

  if (!user) return null;

  const ownedItemIds = new Set(ownedItems.map((entry) => entry.itemId));
  const eligibleItems = items.filter((item) => isEligibleLootItem(item as LootItem, ownedItemIds, now)) as LootItem[];

  return { now, user, eligibleItems };
};

router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const context = await getPassContext(req.user.id);
    if (!context) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { now, user, eligibleItems } = context;
    const todayKey = getLocalDateKey(now);
    const lastClaimKey = user.lastDailyPassClaim ? getLocalDateKey(user.lastDailyPassClaim) : null;

    let streak = user.dailyPassStreak || 0;
    let status: 'available' | 'claimed' = 'available';
    let resetNotice = false;

    if (lastClaimKey) {
      const dayDiff = getDayDiff(lastClaimKey, todayKey);

      if (dayDiff === 0) {
        status = 'claimed';
      } else if (dayDiff > 1) {
        streak = 0;
        resetNotice = true;
        await prisma.user.update({
          where: { id: req.user.id },
          data: { dailyPassStreak: 0, lastDailyPassClaim: null },
        });
      }
    }

    const nextReset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

    res.json({
      streak,
      status,
      resetNotice,
      nextReset: nextReset.toISOString(),
      itemDropChance: eligibleItems.length > 0 ? Math.round(ITEM_DROP_CHANCE * 100) : 0,
      moneyRange: MONEY_RANGE,
      auraRange: AURA_RANGE,
      featuredItems: pickFeaturedItems(eligibleItems, FEATURED_ITEM_COUNT).map(serializeLootItem),
    });
  } catch (error) {
    console.error('Get pass status error:', error);
    res.status(500).json({ error: 'Failed to get pass status' });
  }
});

router.post('/claim', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const context = await getPassContext(req.user.id);
    if (!context) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { now, user, eligibleItems } = context;
    const todayKey = getLocalDateKey(now);
    const lastClaimKey = user.lastDailyPassClaim ? getLocalDateKey(user.lastDailyPassClaim) : null;

    if (lastClaimKey && getDayDiff(lastClaimKey, todayKey) === 0) {
      return res.status(400).json({ error: 'Reward already claimed today' });
    }

    let newStreak = user.dailyPassStreak || 0;
    if (lastClaimKey) {
      const dayDiff = getDayDiff(lastClaimKey, todayKey);
      if (dayDiff === 1) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const baseMoney = randomInt(MONEY_RANGE.min, MONEY_RANGE.max);
    const baseAura = randomInt(AURA_RANGE.min, AURA_RANGE.max);
    const rewards: Array<{
      type: 'money' | 'aura' | 'item';
      rarity: PassRarity;
      label: string;
      amount?: number;
      quantity?: number;
      item?: LootItem;
    }> = [
      {
        type: 'money',
        rarity: getCurrencyRarity(baseMoney, MONEY_RANGE),
        label: `+$${baseMoney}`,
        amount: baseMoney,
      },
      {
        type: 'aura',
        rarity: getCurrencyRarity(baseAura, AURA_RANGE),
        label: `+${baseAura} aura`,
        amount: baseAura,
      },
    ];

    let bonusItem: LootItem | null = null;
    if (eligibleItems.length > 0 && Math.random() < ITEM_DROP_CHANCE) {
      bonusItem = pickWeightedItem(eligibleItems);
    }

    if (bonusItem) {
      rewards.push({
        type: 'item',
        rarity: getItemRarity(bonusItem.price),
        label: bonusItem.name,
        quantity: 1,
        item: bonusItem,
      });
    } else {
      const bonusIsMoney = Math.random() < 0.6;
      if (bonusIsMoney) {
        const bonusMoney = randomInt(35, 110);
        rewards.push({
          type: 'money',
          rarity: getCurrencyRarity(bonusMoney, { min: 35, max: 110 }),
          label: `Bonus +$${bonusMoney}`,
          amount: bonusMoney,
        });
      } else {
        const bonusAura = randomInt(2, 7);
        rewards.push({
          type: 'aura',
          rarity: getCurrencyRarity(bonusAura, { min: 2, max: 7 }),
          label: `Bonus +${bonusAura} aura`,
          amount: bonusAura,
        });
      }
    }

    const totalMoney = rewards
      .filter((reward) => reward.type === 'money')
      .reduce((sum, reward) => sum + (reward.amount ?? 0), 0);
    const totalAura = rewards
      .filter((reward) => reward.type === 'aura')
      .reduce((sum, reward) => sum + (reward.amount ?? 0), 0);

    const updatedUser = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: req.user!.id },
        data: {
          dailyPassStreak: newStreak,
          lastDailyPassClaim: now,
          money: { increment: totalMoney },
          aura: { increment: BigInt(totalAura) },
        },
        select: { money: true, aura: true },
      });

      if (bonusItem) {
        await tx.userItem.upsert({
          where: {
            userId_itemId: {
              userId: req.user!.id,
              itemId: bonusItem.id,
            },
          },
          create: {
            userId: req.user!.id,
            itemId: bonusItem.id,
            quantity: 1,
          },
          update: {
            quantity: { increment: 1 },
          },
        });
      }

      return nextUser;
    });

    io.emit('economy:balance-update', {
      userId: req.user.id,
      aura: updatedUser.aura,
      money: updatedUser.money,
    });

    createNotification({
      userId: req.user.id,
      type: 'SYSTEM',
      title: 'Pass quotidien ouvert',
      body: `Tu as obtenu ${buildRewardSummary(rewards)}.`,
      data: {
        streak: newStreak,
        rewards: rewards.map((reward) => ({
          type: reward.type,
          rarity: reward.rarity,
          amount: reward.amount ?? null,
          itemId: reward.item?.id ?? null,
          itemName: reward.item?.name ?? null,
        })),
        silent: true,
      },
      link: '/pass',
      icon: 'gift',
    }).catch(() => {});

    logEconomy('pass_reward', req.user.id, req.user.username, undefined, undefined, {
      streak: newStreak,
      totalMoney,
      totalAura,
      rewards: rewards.map((reward) => ({
        type: reward.type,
        rarity: reward.rarity,
        amount: reward.amount ?? null,
        itemId: reward.item?.id ?? null,
        itemName: reward.item?.name ?? null,
        itemPrice: reward.item?.price ?? null,
      })),
      claimedAt: now.toISOString(),
    });

    res.json({
      success: true,
      streak: newStreak,
      boxName: 'Boite du jour',
      rewards: rewards.map((reward) => ({
        type: reward.type,
        rarity: reward.rarity,
        label: reward.label,
        amount: reward.amount,
        quantity: reward.quantity,
        item: reward.item ? serializeLootItem(reward.item) : undefined,
      })),
      newBalance: {
        money: updatedUser.money,
        aura: Number(updatedUser.aura),
      },
    });
  } catch (error) {
    console.error('Claim pass reward error:', error);
    res.status(500).json({ error: 'Failed to claim reward' });
  }
});

export default router;
