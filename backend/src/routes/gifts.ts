import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logEconomy } from '../utils/logger.js';

const router = Router();

const MAX_MONEY_PER_GIFT = 1000;

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

    const { receiverId, moneyAmount = 0, templateIds = [], message } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver is required' });
    }

    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot send a gift to yourself' });
    }

    if (moneyAmount < 0 || moneyAmount > MAX_MONEY_PER_GIFT) {
      return res.status(400).json({ error: `Money must be between 0 and ${MAX_MONEY_PER_GIFT}` });
    }

    if (message && message.length > 200) {
      return res.status(400).json({ error: 'Message must be 200 characters or less' });
    }

    // Verify receiver exists
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Calculate total cost: money in gift + cost of template items
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

    const totalCost = moneyAmount + templateCost;

    if (totalCost <= 0) {
      return res.status(400).json({ error: 'Gift must contain money or at least one item' });
    }

    // Check sender has enough money
    const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!sender || sender.money < totalCost) {
      return res.status(400).json({ error: 'Insufficient money' });
    }

    // Create gift in a transaction
    const gift = await prisma.$transaction(async (tx) => {
      // Deduct total cost from sender
      await tx.user.update({
        where: { id: req.user!.id },
        data: { money: { decrement: totalCost } },
      });

      // Create the gift
      const newGift = await tx.gift.create({
        data: {
          senderId: req.user!.id,
          receiverId,
          message: message || null,
          moneyAmount,
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
      templateCost,
      totalCost,
      templateIds,
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

    // Open the gift and credit money in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.gift.update({
        where: { id },
        data: { isOpened: true, openedAt: new Date() },
      });

      if (gift.moneyAmount > 0) {
        await tx.user.update({
          where: { id: req.user!.id },
          data: { money: { increment: gift.moneyAmount } },
        });
      }
    });

    // Emit balance update to receiver
    if (gift.moneyAmount > 0) {
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
