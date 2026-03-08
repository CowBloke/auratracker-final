import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

const rewardSteps = [25, 40, 60, 90, 130, 180, 250];
const rewardStepGrowth = 50;

const getRewardForDay = (day: number) => {
  if (day <= rewardSteps.length) return rewardSteps[day - 1];
  return rewardSteps[rewardSteps.length - 1] + (day - rewardSteps.length) * rewardStepGrowth;
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

// Get pass status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { dailyPassStreak: true, lastDailyPassClaim: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = new Date();
    const todayKey = getLocalDateKey(now);
    const lastClaimKey = user.lastDailyPassClaim ? getLocalDateKey(user.lastDailyPassClaim) : null;

    let streak = user.dailyPassStreak || 0;
    let status: 'available' | 'claimed' = 'available';
    let resetNotice = false;

    if (!lastClaimKey) {
      // Never claimed before
      status = 'available';
    } else {
      const dayDiff = getDayDiff(lastClaimKey, todayKey);
      
      if (dayDiff === 0) {
        // Already claimed today
        status = 'claimed';
      } else if (dayDiff === 1) {
        // Can claim today (consecutive day)
        status = 'available';
      } else {
        // Streak broken (more than 1 day difference)
        streak = 0;
        status = 'available';
        resetNotice = true;
        
        // Reset streak in database
        await prisma.user.update({
          where: { id: req.user.id },
          data: { dailyPassStreak: 0, lastDailyPassClaim: null },
        });
      }
    }

    const claimDay = status === 'claimed' ? streak : streak + 1;
    const claimReward = getRewardForDay(claimDay);
    const nextReward = getRewardForDay(claimDay + 1);

    // Calculate next reset time (midnight of next day)
    const nextReset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

    res.json({
      streak,
      status,
      resetNotice,
      claimDay,
      claimReward,
      nextReward,
      nextReset: nextReset.toISOString(),
    });
  } catch (error) {
    console.error('Get pass status error:', error);
    res.status(500).json({ error: 'Failed to get pass status' });
  }
});

// Claim daily pass reward
router.post('/claim', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { dailyPassStreak: true, lastDailyPassClaim: true, money: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = new Date();
    const todayKey = getLocalDateKey(now);
    const lastClaimKey = user.lastDailyPassClaim ? getLocalDateKey(user.lastDailyPassClaim) : null;

    // Check if already claimed today
    if (lastClaimKey && getDayDiff(lastClaimKey, todayKey) === 0) {
      return res.status(400).json({ error: 'Reward already claimed today' });
    }

    // Check if streak should be reset (more than 1 day difference)
    let newStreak = user.dailyPassStreak || 0;
    if (lastClaimKey) {
      const dayDiff = getDayDiff(lastClaimKey, todayKey);
      if (dayDiff === 1) {
        // Consecutive day - increment streak
        newStreak = newStreak + 1;
      } else if (dayDiff > 1) {
        // Streak broken - reset to 1
        newStreak = 1;
      } else {
        // Same day - should not happen, but handle it
        return res.status(400).json({ error: 'Reward already claimed today' });
      }
    } else {
      // First claim ever
      newStreak = 1;
    }

    const reward = getRewardForDay(newStreak);

    // Update user in transaction
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        dailyPassStreak: newStreak,
        lastDailyPassClaim: now,
        money: { increment: reward },
      },
      select: { money: true, aura: true },
    });

    // Emit balance update
    io.emit('economy:balance-update', {
      userId: req.user.id,
      aura: updatedUser.aura,
      money: updatedUser.money,
    });

    const claimDay = newStreak;
    const nextReward = getRewardForDay(claimDay + 1);

    createNotification({
      userId: req.user.id,
      type: 'SYSTEM',
      title: 'Pass quotidien réclamé',
      body: `Tu as reçu $${reward} pour le jour ${claimDay} de ta série.`,
      data: {
        reward,
        streak: newStreak,
        claimDay,
        nextReward,
      },
      link: '/pass',
      icon: 'calendar-check',
    }).catch(() => {});

    res.json({
      success: true,
      reward,
      streak: newStreak,
      claimDay,
      nextReward,
      newBalance: {
        money: updatedUser.money,
        aura: updatedUser.aura,
      },
    });
  } catch (error) {
    console.error('Claim pass reward error:', error);
    res.status(500).json({ error: 'Failed to claim reward' });
  }
});

export default router;
