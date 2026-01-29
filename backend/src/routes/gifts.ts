import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logEconomy } from '../utils/logger.js';

const router = Router();

const MAX_MONEY_PER_GIFT = 1000;
const MAX_AURA_PER_GIFT = 50;
const MAX_AURA_GIFTS_PER_DAY = 5;
const DEFAULT_DAILY_AURA_LIMIT = 50;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const checkAndResetDailyAllowance = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyAuraGiven: true, dailyAuraLimit: true, lastDailyReset: true },
  });

  if (!user) return null;

  const now = new Date();
  const lastReset = new Date(user.lastDailyReset);
  const timeSinceReset = now.getTime() - lastReset.getTime();

  if (timeSinceReset >= DAY_IN_MS) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyAuraGiven: 0,
        dailyAuraLimit: DEFAULT_DAILY_AURA_LIMIT,
        lastDailyReset: now,
      },
    });
    return {
      dailyAuraGiven: 0,
      dailyAuraLimit: DEFAULT_DAILY_AURA_LIMIT,
      lastDailyReset: now,
      remaining: DEFAULT_DAILY_AURA_LIMIT,
    };
  }

  const userLimit = user.dailyAuraLimit ?? DEFAULT_DAILY_AURA_LIMIT;
  return {
    dailyAuraGiven: user.dailyAuraGiven,
    dailyAuraLimit: userLimit,
    lastDailyReset: user.lastDailyReset,
    remaining: Math.max(0, userLimit - user.dailyAuraGiven),
  };
};

// Get all available gift templates
router.get('/templates', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const templates = await prisma.giftTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ templates });
  } catch (error) {
    console.error('Get gift templates error:', error);
    res.status(500).json({ error: 'Failed to get gift templates' });
  }
});

// Get current user's unopened gifts (inbox)
router.get('/inbox', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const gifts = await prisma.gift.findMany({
      where: { receiverId: req.user.id, isOpened: false },
      include: {
        sender: { select: { id: true, username: true, profilePicture: true } },
        items: { include: { giftTemplate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ gifts });
  } catch (error) {
    console.error('Get gift inbox error:', error);
    res.status(500).json({ error: 'Failed to get gift inbox' });
  }
});

// Get count of unopened gifts
router.get('/inbox/count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const count = await prisma.gift.count({
      where: { receiverId: req.user.id, isOpened: false },
    });
    res.json({ count });
  } catch (error) {
    console.error('Get gift inbox count error:', error);
    res.status(500).json({ error: 'Failed to get gift count' });
  }
});

// Get all received gifts (history, opened ones)
router.get('/received', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const gifts = await prisma.gift.findMany({
      where: { receiverId: req.user.id, isOpened: true },
      include: {
        sender: { select: { id: true, username: true, profilePicture: true } },
        items: { include: { giftTemplate: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
    res.json({ gifts });
  } catch (error) {
    console.error('Get received gifts error:', error);
    res.status(500).json({ error: 'Failed to get received gifts' });
  }
});

// Send a gift to another user
router.post('/send', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { receiverId, moneyAmount = 0, auraAmount = 0, templateIds = [], message } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver is required' });
    }

    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot send a gift to yourself' });
    }

    if (moneyAmount < 0 || moneyAmount > MAX_MONEY_PER_GIFT) {
      return res.status(400).json({ error: `Money must be between 0 and ${MAX_MONEY_PER_GIFT}` });
    }

    if (auraAmount < 0 || auraAmount > MAX_AURA_PER_GIFT) {
      return res.status(400).json({ error: `Aura must be between 0 and ${MAX_AURA_PER_GIFT}` });
    }

    if (message && message.length > 200) {
      return res.status(400).json({ error: 'Message must be 200 characters or less' });
    }

    // Verify receiver exists
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Calculate total money cost: money in gift + cost of template items
    let templateCost = 0;
    if (templateIds.length > 0) {
      const templates = await prisma.giftTemplate.findMany({
        where: { id: { in: templateIds } },
      });
      if (templates.length !== templateIds.length) {
        return res.status(400).json({ error: 'One or more gift items not found' });
      }
      templateCost = templates.reduce((sum: number, t: { price: number }) => sum + t.price, 0);
    }

    const totalMoneyCost = moneyAmount + templateCost;

    if (totalMoneyCost <= 0 && auraAmount <= 0) {
      return res.status(400).json({ error: 'Gift must contain money, aura, or at least one item' });
    }

    // Check sender has enough money
    const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }
    if (sender.money < totalMoneyCost) {
      return res.status(400).json({ error: 'Insufficient money' });
    }

    let allowanceInfo: { dailyAuraGiven: number; dailyAuraLimit: number; lastDailyReset: Date; remaining: number } | null = null;
    if (auraAmount > 0) {
      allowanceInfo = await checkAndResetDailyAllowance(req.user.id);
      if (!allowanceInfo) {
        return res.status(404).json({ error: 'Sender not found' });
      }
      if (auraAmount > allowanceInfo.remaining) {
        return res.status(400).json({
          error: `Insufficient daily allowance. You have ${allowanceInfo.remaining} aura left to give today.`,
        });
      }
      const auraGiftCount = await prisma.gift.count({
        where: {
          senderId: req.user.id,
          auraAmount: { gt: 0 },
          createdAt: { gte: allowanceInfo.lastDailyReset },
        },
      });
      if (auraGiftCount >= MAX_AURA_GIFTS_PER_DAY) {
        return res.status(400).json({ error: `Daily aura gifts limit reached (${MAX_AURA_GIFTS_PER_DAY}/day).` });
      }
    }

    // Create gift in a transaction
    const gift = await prisma.$transaction(async (tx) => {
      // Deduct money cost from sender
      const updateData: Record<string, unknown> = {};
      if (totalMoneyCost > 0) {
        updateData.money = { decrement: totalMoneyCost };
      }
      if (auraAmount > 0) {
        updateData.dailyAuraGiven = { increment: auraAmount };
      }
      await tx.user.update({
        where: { id: req.user!.id },
        data: updateData,
      });

      // Create the gift
      const newGift = await tx.gift.create({
        data: {
          senderId: req.user!.id,
          receiverId,
          message: message || null,
          moneyAmount,
          auraAmount,
          items: templateIds.length > 0 ? {
            create: templateIds.map((templateId: string) => ({
              giftTemplateId: templateId,
            })),
          } : undefined,
        },
        include: {
          sender: { select: { id: true, username: true, profilePicture: true } },
          items: { include: { giftTemplate: true } },
        },
      });

      return newGift;
    });

    // Emit balance update to sender
    const updatedSender = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { aura: true, money: true },
    });
    if (updatedSender) {
      io.emit('economy:balance-update', {
        userId: req.user.id,
        aura: updatedSender.aura,
        money: updatedSender.money,
      });
    }

    // Emit gift notification to receiver
    io.emit('gift:received', {
      receiverId,
      gift: {
        id: gift.id,
        sender: gift.sender,
        createdAt: gift.createdAt,
      },
    });

    // Log the gift
    logEconomy('transfer', req.user.id, sender.username, receiverId, receiver.username, {
      type: 'gift',
      moneyAmount,
      auraAmount,
      templateCost,
      totalMoneyCost,
      templateIds,
      dailyAuraUsed: auraAmount > 0,
    });

    res.json({ gift });
  } catch (error) {
    console.error('Send gift error:', error);
    res.status(500).json({ error: 'Failed to send gift' });
  }
});

// Open a gift
router.post('/:id/open', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;

    const gift = await prisma.gift.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, username: true, profilePicture: true } },
        items: { include: { giftTemplate: true } },
      },
    });

    if (!gift) {
      return res.status(404).json({ error: 'Gift not found' });
    }

    if (gift.receiverId !== req.user.id) {
      return res.status(403).json({ error: 'This gift is not for you' });
    }

    if (gift.isOpened) {
      return res.status(400).json({ error: 'Gift already opened' });
    }

    // Open the gift and credit money + aura in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.gift.update({
        where: { id },
        data: { isOpened: true, openedAt: new Date() },
      });

      const creditData: Record<string, unknown> = {};
      if (gift.moneyAmount > 0) {
        creditData.money = { increment: gift.moneyAmount };
      }
      if (gift.auraAmount > 0) {
        creditData.aura = { increment: gift.auraAmount };
      }
      if (Object.keys(creditData).length > 0) {
        await tx.user.update({
          where: { id: req.user!.id },
          data: creditData,
        });
      }
    });

    // Emit balance update to receiver
    if (gift.moneyAmount > 0 || gift.auraAmount > 0) {
      const updatedReceiver = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { aura: true, money: true },
      });
      if (updatedReceiver) {
        io.emit('economy:balance-update', {
          userId: req.user.id,
          aura: updatedReceiver.aura,
          money: updatedReceiver.money,
        });
      }
    }

    res.json({ gift });
  } catch (error) {
    console.error('Open gift error:', error);
    res.status(500).json({ error: 'Failed to open gift' });
  }
});

export default router;
