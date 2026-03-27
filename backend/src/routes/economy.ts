import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, transferSchema } from '../middleware/validation.js';
import { logEconomy } from '../utils/logger.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

// Transfer currency
router.post('/transfer', authMiddleware, validate(transferSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { receiverId, moneyAmount = 0 } = req.body;

    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }

    const sender = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    if (sender.money < moneyAmount) {
      return res.status(400).json({ error: 'Insufficient money' });
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    const [updatedSender, updatedReceiver, transfer] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          money: { decrement: moneyAmount },
        },
      }),
      prisma.user.update({
        where: { id: receiverId },
        data: {
          money: { increment: moneyAmount },
        },
      }),
      prisma.transfer.create({
        data: {
          senderId: req.user.id,
          receiverId,
          auraAmount: 0,
          moneyAmount,
        },
      }),
    ]);

    io.emit('economy:balance-update', {
      userId: req.user.id,
      aura: updatedSender.aura,
      money: updatedSender.money,
    });

    io.emit('economy:balance-update', {
      userId: receiverId,
      aura: updatedReceiver.aura,
      money: updatedReceiver.money,
    });

    io.emit('economy:transfer', {
      transfer,
      sender: { id: sender.id, username: sender.username },
      receiver: { id: receiver.id, username: receiver.username },
    });

    createNotification({
      userId: receiverId,
      type: 'MONEY_RECEIVED',
      title: `+$${moneyAmount} reçus`,
      body: `${sender.username} vous a transféré $${moneyAmount}.`,
      data: { senderId: sender.id, senderUsername: sender.username, amount: moneyAmount },
      link: `/profile/${sender.id}`,
      icon: 'dollar-sign',
    }).catch(() => {});

    logEconomy('transfer', req.user.id, sender.username, receiverId, receiver.username, {
      moneyAmount,
      transferId: transfer.id,
    });

    res.json({
      success: true,
      newBalances: {
        aura: updatedSender.aura,
        money: updatedSender.money,
      },
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'Failed to transfer' });
  }
});

// Get transfer history
router.get('/transfers', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userId, limit = '50', offset = '0', all } = req.query;
    const includeAll = all === 'true';
    const targetUserId = (userId as string) || req.user.id;
    const whereClause = includeAll
      ? undefined
      : {
          OR: [
            { senderId: targetUserId },
            { receiverId: targetUserId },
          ],
        };

    const transfers = await prisma.transfer.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { id: true, username: true, usernameColor: true },
        },
        receiver: {
          select: { id: true, username: true, usernameColor: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json({ transfers });
  } catch (error) {
    console.error('Get transfers error:', error);
    res.status(500).json({ error: 'Failed to get transfers' });
  }
});

// Get balance
router.get('/balance/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        aura: true,
        money: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

export default router;
