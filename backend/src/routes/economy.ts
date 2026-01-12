import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, transferSchema, giftAuraSchema } from '../middleware/validation.js';

const router = Router();

const DEFAULT_DAILY_AURA_LIMIT = 50;
const DAY_IN_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Helper to check and reset daily allowance
const checkAndResetDailyAllowance = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyAuraGiven: true, dailyAuraLimit: true, lastDailyReset: true },
  });
  
  if (!user) return null;
  
  const now = new Date();
  const lastReset = new Date(user.lastDailyReset);
  const timeSinceReset = now.getTime() - lastReset.getTime();
  
  // Reset if more than 24 hours have passed (both dailyAuraGiven AND dailyAuraLimit back to defaults)
  if (timeSinceReset >= DAY_IN_MS) {
    await prisma.user.update({
      where: { id: userId },
      data: { 
        dailyAuraGiven: 0, 
        dailyAuraLimit: DEFAULT_DAILY_AURA_LIMIT,
        lastDailyReset: now 
      },
    });
    return { dailyAuraGiven: 0, dailyAuraLimit: DEFAULT_DAILY_AURA_LIMIT, lastDailyReset: now, remaining: DEFAULT_DAILY_AURA_LIMIT };
  }
  
  const userLimit = user.dailyAuraLimit ?? DEFAULT_DAILY_AURA_LIMIT;
  return {
    dailyAuraGiven: user.dailyAuraGiven,
    dailyAuraLimit: userLimit,
    lastDailyReset: user.lastDailyReset,
    remaining: Math.max(0, userLimit - user.dailyAuraGiven),
  };
};

// Transfer currency
router.post('/transfer', authMiddleware, validate(transferSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { receiverId, auraAmount = 0, moneyAmount = 0 } = req.body;
    
    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }
    
    // Get sender's current balance
    const sender = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }
    
    // Check sufficient balance
    if (sender.aura < auraAmount) {
      return res.status(400).json({ error: 'Insufficient aura' });
    }
    
    if (sender.money < moneyAmount) {
      return res.status(400).json({ error: 'Insufficient money' });
    }
    
    // Check receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });
    
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }
    
    // Perform transfer in transaction
    const [updatedSender, updatedReceiver, transfer] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          aura: { decrement: auraAmount },
          money: { decrement: moneyAmount },
        },
      }),
      prisma.user.update({
        where: { id: receiverId },
        data: {
          aura: { increment: auraAmount },
          money: { increment: moneyAmount },
        },
      }),
      prisma.transfer.create({
        data: {
          senderId: req.user.id,
          receiverId,
          auraAmount,
          moneyAmount,
        },
      }),
    ]);
    
    // Emit real-time updates
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
    
    const { userId, limit = '50', offset = '0' } = req.query;
    const targetUserId = (userId as string) || req.user.id;
    
    const transfers = await prisma.transfer.findMany({
      where: {
        OR: [
          { senderId: targetUserId },
          { receiverId: targetUserId },
        ],
      },
      include: {
        sender: {
          select: { id: true, username: true },
        },
        receiver: {
          select: { id: true, username: true },
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

// Get daily aura gift allowance status
router.get('/daily-allowance', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const allowanceInfo = await checkAndResetDailyAllowance(req.user.id);
    
    if (!allowanceInfo) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      dailyLimit: allowanceInfo.dailyAuraLimit,
      used: allowanceInfo.dailyAuraGiven,
      remaining: allowanceInfo.remaining,
      lastReset: allowanceInfo.lastDailyReset,
      nextReset: new Date(new Date(allowanceInfo.lastDailyReset).getTime() + DAY_IN_MS),
    });
  } catch (error) {
    console.error('Get daily allowance error:', error);
    res.status(500).json({ error: 'Failed to get daily allowance' });
  }
});

// Gift aura to another user (uses daily allowance, not own aura)
router.post('/gift-aura', authMiddleware, validate(giftAuraSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { receiverId, amount, message } = req.body;
    
    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot gift aura to yourself' });
    }
    
    // Check and reset daily allowance if needed
    const allowanceInfo = await checkAndResetDailyAllowance(req.user.id);
    
    if (!allowanceInfo) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (amount > allowanceInfo.remaining) {
      return res.status(400).json({ 
        error: `Insufficient daily allowance. You have ${allowanceInfo.remaining} aura left to give today.` 
      });
    }
    
    // Check receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });
    
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }
    
    const sender = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }
    
    // Perform gift in transaction
    const [updatedSender, updatedReceiver, transfer] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          dailyAuraGiven: { increment: amount },
        },
      }),
      prisma.user.update({
        where: { id: receiverId },
        data: {
          aura: { increment: amount },
        },
      }),
      prisma.transfer.create({
        data: {
          senderId: req.user.id,
          receiverId,
          auraAmount: amount,
          moneyAmount: 0,
          isGift: true,
          message: message?.trim() || null,
        },
      }),
    ]);
    
    // Emit real-time updates
    io.emit('economy:balance-update', {
      userId: receiverId,
      aura: updatedReceiver.aura,
      money: updatedReceiver.money,
    });
    
    io.emit('economy:transfer', {
      transfer: { ...transfer, isGift: true },
      sender: { id: sender.id, username: sender.username },
      receiver: { id: receiver.id, username: receiver.username },
    });
    
    res.json({
      success: true,
      remaining: Math.max(0, (allowanceInfo.dailyAuraLimit ?? DEFAULT_DAILY_AURA_LIMIT) - updatedSender.dailyAuraGiven),
      transfer,
    });
  } catch (error) {
    console.error('Gift aura error:', error);
    res.status(500).json({ error: 'Failed to gift aura' });
  }
});

export default router;
