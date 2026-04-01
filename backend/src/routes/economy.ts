import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, transferSchema } from '../middleware/validation.js';
import { logEconomy } from '../utils/logger.js';
import { createNotification } from '../utils/notifications.js';
import { syncUserDailyAuraState } from '../utils/dailyAura.js';
import { getSharedBalance } from '../utils/sharedBalance.js';

const router = Router();

const serializeAuraTransfer = <TTransfer extends {
  auraAmount: number;
  sender?: { id: string; username: string; usernameColor: string | null } | null;
  receiver?: { id: string; username: string; usernameColor: string | null } | null;
}>(transfer: TTransfer) => ({
  ...transfer,
  direction: transfer.auraAmount >= 0 ? 'GIVE' : 'TAKE',
  sender: transfer.sender ?? null,
  receiver: transfer.receiver ?? null,
});

router.get('/state', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const senderState = await syncUserDailyAuraState(prisma, req.user.id);
    if (!senderState) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      state: {
        dailyAuraGiven: senderState.dailyAuraGiven,
        dailyAuraLimit: senderState.dailyAuraLimit,
        remainingAura: senderState.remainingAura,
        lastDailyReset: senderState.lastDailyReset,
        nextResetAt: senderState.nextResetAt,
      },
    });
  } catch (error) {
    console.error('Get aura distribution state error:', error);
    res.status(500).json({ error: 'Failed to get aura distribution state' });
  }
});

router.post('/transfer', authMiddleware, validate(transferSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { receiverId, auraAmount, message } = req.body as {
      receiverId: string;
      auraAmount: number;
      message: string;
    };

    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }

    const sender = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true },
    });

    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, username: true },
    });

    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    const senderState = await syncUserDailyAuraState(prisma, req.user.id);
    if (!senderState) {
      return res.status(404).json({ error: 'Sender state not found' });
    }

    const amount = Math.abs(auraAmount);
    if (amount > senderState.remainingAura) {
      return res.status(400).json({
        error: `Il ne te reste que ${senderState.remainingAura} aura a distribuer aujourd'hui.`,
      });
    }

    const trimmedMessage = message.trim();

    const transferResult = await prisma.$transaction(async (tx) => {
      const updatedSender = await tx.user.update({
        where: { id: req.user!.id },
        data: {
          dailyAuraGiven: { increment: amount },
        },
        select: {
          id: true,
          aura: true,
          money: true,
          dailyAuraGiven: true,
          dailyAuraLimit: true,
          lastDailyReset: true,
        },
      });

      const updatedReceiver = await tx.user.update({
        where: { id: receiverId },
        data: {
          aura: { increment: BigInt(auraAmount) },
        },
        select: { id: true, aura: true, money: true },
      });

      const transfer = await tx.transfer.create({
        data: {
          senderId: req.user!.id,
          receiverId,
          auraAmount,
          moneyAmount: 0,
          isGift: true,
          message: trimmedMessage,
        },
        include: {
          sender: {
            select: { id: true, username: true, usernameColor: true },
          },
          receiver: {
            select: { id: true, username: true, usernameColor: true },
          },
        },
      });

      return { updatedSender, updatedReceiver, transfer };
    });

    io.emit('economy:balance-update', {
      userId: receiverId,
      aura: Number(transferResult.updatedReceiver.aura),
      money: transferResult.updatedReceiver.money,
    });

    const notificationTitle = auraAmount >= 0
      ? `+${auraAmount} aura recue`
      : `${auraAmount} aura`;
    const notificationBody = auraAmount >= 0
      ? `${sender.username} t'a donne ${auraAmount} aura. Motif: ${trimmedMessage}`
      : `${sender.username} t'a retire ${amount} aura. Motif: ${trimmedMessage}`;

    createNotification({
      userId: receiverId,
      type: 'AURA_RECEIVED',
      title: notificationTitle,
      body: notificationBody,
      data: {
        senderId: sender.id,
        senderUsername: sender.username,
        amount: auraAmount,
        absoluteAmount: amount,
        message: trimmedMessage,
      },
      link: `/profile/${sender.id}`,
      icon: 'star',
    }).catch(() => {});

    logEconomy('transfer', req.user.id, sender.username, receiverId, receiver.username, {
      auraAmount,
      absoluteAmount: amount,
      remainingAura: Math.max(0, transferResult.updatedSender.dailyAuraLimit - transferResult.updatedSender.dailyAuraGiven),
      transferId: transferResult.transfer.id,
      message: trimmedMessage,
    });

    res.json({
      success: true,
      transfer: serializeAuraTransfer(transferResult.transfer),
      state: {
        dailyAuraGiven: transferResult.updatedSender.dailyAuraGiven,
        dailyAuraLimit: transferResult.updatedSender.dailyAuraLimit,
        remainingAura: Math.max(0, transferResult.updatedSender.dailyAuraLimit - transferResult.updatedSender.dailyAuraGiven),
        lastDailyReset: transferResult.updatedSender.lastDailyReset,
      },
    });
  } catch (error) {
    console.error('Aura transfer error:', error);
    res.status(500).json({ error: 'Failed to transfer aura' });
  }
});

router.get('/transfers', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userId, limit = '50', offset = '0', all } = req.query;
    const includeAll = all === 'true';
    const targetUserId = (userId as string) || req.user.id;
    const whereClause = includeAll
      ? { auraAmount: { not: 0 } }
      : {
          auraAmount: { not: 0 },
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
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
    });

    res.json({ transfers: transfers.map(serializeAuraTransfer) });
  } catch (error) {
    console.error('Get transfers error:', error);
    res.status(500).json({ error: 'Failed to get transfers' });
  }
});

router.get('/balance/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sharedBalance = await getSharedBalance(prisma, userId);

    res.json({
      aura: Number(sharedBalance.aura),
      money: sharedBalance.money,
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

export default router;
