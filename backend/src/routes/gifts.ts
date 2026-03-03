import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logEconomy } from '../utils/logger.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

const MAX_AURA_PER_GIFT = 50;
const MAX_AURA_PER_DAY = 50;

const getTodayWindow = () => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const nextResetAt = new Date(startOfToday);
  nextResetAt.setDate(nextResetAt.getDate() + 1);

  return { startOfToday, nextResetAt };
};

const getGiftCooldownStatus = async (userId: string) => {
  const { startOfToday, nextResetAt } = getTodayWindow();
  const sentGifts = await prisma.gift.findMany({
    where: {
      senderId: userId,
      auraAmount: { gt: 0 },
      createdAt: { gte: startOfToday },
    },
    select: {
      auraAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const sentToday = sentGifts.reduce((sum, gift) => sum + gift.auraAmount, 0);
  const remainingAura = Math.max(0, MAX_AURA_PER_DAY - sentToday);

  return {
    limit: MAX_AURA_PER_DAY,
    sentLast24h: sentToday,
    remainingAura,
    nextRefillAt: nextResetAt,
  };
};

router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const status = await getGiftCooldownStatus(req.user.id);
    res.json(status);
  } catch (error) {
    console.error('Get gift status error:', error);
    res.status(500).json({ error: 'Failed to get gift status' });
  }
});

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
        giftedItem: { select: { id: true, name: true, imageUrl: true, price: true } },
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
        giftedItem: { select: { id: true, name: true, imageUrl: true, price: true } },
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

    const { receiverId, auraAmount = 0, message } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver is required' });
    }

    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot send a gift to yourself' });
    }

    if (!Number.isInteger(auraAmount) || auraAmount <= 0 || auraAmount > MAX_AURA_PER_GIFT) {
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

    const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    const cooldownStatus = await getGiftCooldownStatus(req.user.id);
    const auraSentLast24h = cooldownStatus.sentLast24h;
    const remainingAura = cooldownStatus.remainingAura;

    if (auraAmount > remainingAura) {
      return res.status(400).json({
        error: `Aura limit reached. You can still send ${remainingAura} aura before midnight.`,
      });
    }

    // Create gift in a transaction
    const gift = await prisma.$transaction(async (tx) => {
      // Create the gift
      const newGift = await tx.gift.create({
        data: {
          senderId: req.user!.id,
          receiverId,
          message: message || null,
          moneyAmount: 0,
          auraAmount,
        },
        include: {
          sender: { select: { id: true, username: true, profilePicture: true } },
          items: { include: { giftTemplate: true } },
        },
      });

      return newGift;
    });

    // Emit gift notification to receiver
    io.emit('gift:received', {
      receiverId,
      gift: {
        id: gift.id,
        sender: gift.sender,
        createdAt: gift.createdAt,
      },
    });

    // Inbox notification
    createNotification({
      userId: receiverId,
      type: 'GIFT_RECEIVED',
      title: 'Cadeau reçu !',
      body: gift.message
        ? `${gift.sender.username} : "${gift.message}"`
        : `${gift.sender.username} vous a envoyé un cadeau (${auraAmount} aura).`,
      data: { senderId: gift.sender.id, senderUsername: gift.sender.username, auraAmount, giftId: gift.id },
      link: '/inbox',
      icon: 'gift',
    }).catch(() => {});

    // Log the gift
    logEconomy('transfer', req.user.id, sender.username, receiverId, receiver.username, {
      type: 'gift',
      auraAmount,
      auraSentLast24h: auraSentLast24h + auraAmount,
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
        giftedItem: { select: { id: true, name: true, imageUrl: true, price: true } },
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

    if (gift.giftedItemId) {
      // Shop item gift — add the item to the receiver's inventory
      await prisma.$transaction(async (tx) => {
        await tx.gift.update({
          where: { id },
          data: { isOpened: true, openedAt: new Date() },
        });
        await tx.userItem.upsert({
          where: { userId_itemId: { userId: req.user!.id, itemId: gift.giftedItemId! } },
          create: { userId: req.user!.id, itemId: gift.giftedItemId!, quantity: 1 },
          update: { quantity: { increment: 1 } },
        });
      });
    } else {
      // Aura/money gift — credit directly
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
    }

    res.json({ gift });
  } catch (error) {
    console.error('Open gift error:', error);
    res.status(500).json({ error: 'Failed to open gift' });
  }
});

// Purchase a GIFT shop item and send it to another user
router.post('/send-item', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { itemId, receiverId, message } = req.body;

    if (!itemId || !receiverId) {
      return res.status(400).json({ error: 'itemId and receiverId are required' });
    }

    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot send a gift to yourself' });
    }

    if (message && message.length > 200) {
      return res.status(400).json({ error: 'Message must be 200 characters or less' });
    }

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item || item.type !== 'GIFT') {
      return res.status(404).json({ error: 'Gift item not found' });
    }

    if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'This gift is no longer available' });
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) return res.status(404).json({ error: 'Receiver not found' });

    const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!sender) return res.status(404).json({ error: 'Sender not found' });

    if (sender.money < item.price) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const gift = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.user!.id },
        data: { money: { decrement: item.price } },
      });

      return tx.gift.create({
        data: {
          senderId: req.user!.id,
          receiverId,
          message: message || null,
          moneyAmount: 0,
          auraAmount: 0,
          giftedItemId: itemId,
        },
        include: {
          sender: { select: { id: true, username: true, profilePicture: true } },
          items: { include: { giftTemplate: true } },
          giftedItem: { select: { id: true, name: true, imageUrl: true, price: true } },
        },
      });
    });

    const updatedSender = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { money: true, aura: true },
    });

    io.emit('gift:received', {
      receiverId,
      gift: { id: gift.id, sender: gift.sender, createdAt: gift.createdAt },
    });

    createNotification({
      userId: receiverId,
      type: 'GIFT_RECEIVED',
      title: 'Cadeau reçu !',
      body: gift.message
        ? `${gift.sender.username} t'a envoyé "${item.name}" : "${gift.message}"`
        : `${gift.sender.username} t'a envoyé "${item.name}" — à récupérer dans ton inventaire.`,
      data: { senderId: gift.sender.id, senderUsername: gift.sender.username, itemName: item.name, giftId: gift.id },
      link: '/inventory',
      icon: 'gift',
    }).catch(() => {});

    logEconomy('transfer', req.user.id, sender.username, receiverId, receiver.username, {
      type: 'gift_item',
      itemId: item.id,
      itemName: item.name,
      moneySpent: item.price,
    });

    res.json({ gift, newBalance: updatedSender });
  } catch (error) {
    console.error('Send gift item error:', error);
    res.status(500).json({ error: 'Failed to send gift item' });
  }
});

export default router;
