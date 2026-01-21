import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logEconomy } from '../utils/logger.js';

const router = Router();

// Quest templates with different types
const QUEST_TEMPLATES = [
  {
    questType: 'JOIN_PARTIES',
    title: 'Rejoindre des parties',
    description: 'Rejoins {target} parties aujourd\'hui',
    targetValues: [3, 5, 7],
    moneyRewards: [100, 200, 300],
    auraRewards: [5, 10, 15],
  },
  {
    questType: 'DOODLE_JUMP_SCORE',
    title: 'Score sur Doodle Jump',
    description: 'Atteins un score de {target} sur Doodle Jump',
    targetValues: [500, 1000, 2000],
    moneyRewards: [150, 300, 500],
    auraRewards: [10, 20, 30],
  },
  {
    questType: 'GAME_2048_SCORE',
    title: 'Score sur 2048',
    description: 'Atteins un score de {target} sur 2048',
    targetValues: [1024, 2048, 4096],
    moneyRewards: [150, 300, 500],
    auraRewards: [10, 20, 30],
  },
  {
    questType: 'FLAPPY_BIRD_SCORE',
    title: 'Score sur Flappy Bird',
    description: 'Atteins un score de {target} sur Flappy Bird',
    targetValues: [25, 50, 100],
    moneyRewards: [150, 300, 500],
    auraRewards: [10, 20, 30],
  },
  {
    questType: 'BOMB_PARTY_PLAYS',
    title: 'Jouer à Bomb Party',
    description: 'Joue {target} parties de Bomb Party',
    targetValues: [2, 3, 5],
    moneyRewards: [100, 200, 300],
    auraRewards: [5, 10, 15],
  },
  {
    questType: 'POKER_PLAYS',
    title: 'Jouer au Poker',
    description: 'Joue {target} parties de Poker',
    targetValues: [2, 3, 5],
    moneyRewards: [100, 200, 300],
    auraRewards: [5, 10, 15],
  },
  {
    questType: 'PETIT_BAC_PLAYS',
    title: 'Jouer au Petit Bac',
    description: 'Joue {target} parties de Petit Bac',
    targetValues: [2, 3, 5],
    moneyRewards: [100, 200, 300],
    auraRewards: [5, 10, 15],
  },
  {
    questType: 'BATTLESHIP_PLAYS',
    title: 'Jouer à Bataille Navale',
    description: 'Joue {target} parties de Bataille Navale',
    targetValues: [2, 3, 5],
    moneyRewards: [100, 200, 300],
    auraRewards: [5, 10, 15],
  },
  {
    questType: 'WIN_GAMES',
    title: 'Gagner des parties',
    description: 'Gagne {target} parties',
    targetValues: [2, 3, 5],
    moneyRewards: [150, 300, 500],
    auraRewards: [15, 30, 50],
  },
  {
    questType: 'PLAY_GAMES',
    title: 'Jouer à des jeux',
    description: 'Joue {target} parties de jeux',
    targetValues: [5, 10, 15],
    moneyRewards: [100, 200, 300],
    auraRewards: [5, 10, 15],
  },
];

// Generate 10 daily quests for a specific date
async function generateDailyQuests(date: Date): Promise<void> {
  try {
    // Normalize date to start of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Check if quests already exist for this date
    const existingQuests = await prisma.dailyQuest.findMany({
      where: {
        questDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    if (existingQuests.length > 0) {
      console.log(`Quests already exist for ${startOfDay.toISOString()}, skipping generation`);
      return; // Quests already generated for this date
    }

    // Shuffle templates and pick 10
    const shuffled = [...QUEST_TEMPLATES].sort(() => Math.random() - 0.5);
    const selectedTemplates = shuffled.slice(0, 10);

    // Create quests with random difficulty
    const quests = selectedTemplates.map((template) => {
      const difficultyIndex = Math.floor(Math.random() * template.targetValues.length);
      const targetValue = template.targetValues[difficultyIndex];
      const moneyReward = template.moneyRewards[difficultyIndex];
      const auraReward = template.auraRewards[difficultyIndex];

      return {
        questType: template.questType,
        title: template.title,
        description: template.description.replace('{target}', targetValue.toString()),
        targetValue,
        moneyReward,
        auraReward,
        questDate: startOfDay,
      };
    });

    const result = await prisma.dailyQuest.createMany({
      data: quests,
    });
    console.log(`Generated ${result.count} daily quests for ${startOfDay.toISOString()}`);
  } catch (error) {
    console.error('Error generating daily quests:', error);
    throw error;
  }
}

// Get or generate daily quests for today
router.get('/daily', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate quests if they don't exist
    await generateDailyQuests(today);

    const endOfDay = new Date(today);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const quests = await prisma.dailyQuest.findMany({
      where: {
        questDate: {
          gte: today,
          lt: endOfDay,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${quests.length} quests for today (${today.toISOString()})`);
    res.json({ quests });
  } catch (error: any) {
    console.error('Get daily quests error:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ 
      error: 'Failed to get daily quests',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Select 3 quests for the user
router.post('/select', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { questIds } = req.body;

    if (!Array.isArray(questIds) || questIds.length !== 3) {
      return res.status(400).json({ error: 'You must select exactly 3 quests' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Check if user already selected quests today
    const existingSelections = await prisma.userDailyQuest.findMany({
      where: {
        userId: req.user.id,
        questDate: {
          gte: today,
          lt: endOfDay,
        },
      },
    });

    if (existingSelections.length > 0) {
      return res.status(400).json({ error: 'You have already selected quests for today' });
    }

    // Verify quests exist and are for today
    const quests = await prisma.dailyQuest.findMany({
      where: {
        id: { in: questIds },
        questDate: {
          gte: today,
          lt: endOfDay,
        },
      },
    });

    if (quests.length !== 3) {
      return res.status(400).json({ error: 'Invalid quest selection' });
    }

    // Create user quest selections and progress
    const userQuests = await prisma.$transaction(
      quests.map((quest) =>
        prisma.userDailyQuest.create({
          data: {
            userId: req.user.id,
            questId: quest.id,
            questDate: today,
          },
          include: {
            quest: true,
          },
        }).then((userQuest) =>
          prisma.userQuestProgress.create({
            data: {
              userQuestId: userQuest.id,
              currentValue: 0,
            },
          }).then(() => userQuest)
        )
      )
    );

    res.json({ success: true, userQuests });
  } catch (error) {
    console.error('Select quests error:', error);
    res.status(500).json({ error: 'Failed to select quests' });
  }
});

// Get user's selected quests for today
router.get('/my-quests', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const userQuests = await prisma.userDailyQuest.findMany({
      where: {
        userId: req.user.id,
        questDate: {
          gte: today,
          lt: endOfDay,
        },
      },
      include: {
        quest: true,
        progress: true,
      },
      orderBy: { selectedAt: 'asc' },
    });

    res.json({ userQuests });
  } catch (error: any) {
    console.error('Get my quests error:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ 
      error: 'Failed to get my quests',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Claim rewards for completed quests
router.post('/claim', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { questIds } = req.body;

    if (!Array.isArray(questIds) || questIds.length === 0) {
      return res.status(400).json({ error: 'Invalid quest IDs' });
    }

    // Get user quests
    const userQuests = await prisma.userDailyQuest.findMany({
      where: {
        id: { in: questIds },
        userId: req.user.id,
        isCompleted: true,
        isClaimed: false,
      },
      include: {
        quest: true,
      },
    });

    if (userQuests.length === 0) {
      return res.status(400).json({ error: 'No completed quests to claim' });
    }

    // Calculate total rewards
    let totalMoney = 0;
    let totalAura = 0;

    for (const userQuest of userQuests) {
      totalMoney += userQuest.quest.moneyReward;
      totalAura += userQuest.quest.auraReward;
    }

    // Update user quests and user balance in transaction
    const [updatedUser, updatedQuests] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          money: { increment: totalMoney },
          aura: { increment: totalAura },
        },
      }),
      ...userQuests.map((uq) =>
        prisma.userDailyQuest.update({
          where: { id: uq.id },
          data: {
            isClaimed: true,
            claimedAt: new Date(),
          },
        })
      ),
    ]);

    // Emit balance update
    io.emit('economy:balance-update', {
      userId: req.user.id,
      aura: updatedUser.aura,
      money: updatedUser.money,
    });

    // Log rewards
    logEconomy('quest_reward', req.user.id, req.user.username || '', undefined, undefined, {
      questIds: userQuests.map((uq) => uq.id),
      totalMoney,
      totalAura,
    });

    res.json({
      success: true,
      rewards: {
        money: totalMoney,
        aura: totalAura,
      },
      claimedQuests: userQuests.length,
    });
  } catch (error) {
    console.error('Claim quests error:', error);
    res.status(500).json({ error: 'Failed to claim quests' });
  }
});

// Helper function to check and update quest progress
export async function checkQuestProgress(
  userId: string,
  questType: string,
  value: number = 1
): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Get user's active quests of this type
    const userQuests = await prisma.userDailyQuest.findMany({
      where: {
        userId,
        questDate: {
          gte: today,
          lt: endOfDay,
        },
        isCompleted: false,
        quest: {
          questType,
        },
      },
      include: {
        quest: true,
        progress: true,
      },
    });

    for (const userQuest of userQuests) {
      if (userQuest.isCompleted) continue;

      const progress = userQuest.progress;
      if (!progress) continue;

      let newValue = progress.currentValue;

      // Handle different quest types
      if (questType === 'DOODLE_JUMP_SCORE' || questType === 'GAME_2048_SCORE' || questType === 'FLAPPY_BIRD_SCORE') {
        // For score quests, update if new value is higher
        newValue = Math.max(progress.currentValue, value);
      } else {
        // For count quests, increment
        newValue = progress.currentValue + value;
      }

      // Update progress
      await prisma.userQuestProgress.update({
        where: { id: progress.id },
        data: {
          currentValue: newValue,
          lastUpdated: new Date(),
        },
      });

      // Check if quest is completed
      if (newValue >= userQuest.quest.targetValue) {
        await prisma.userDailyQuest.update({
          where: { id: userQuest.id },
          data: {
            isCompleted: true,
            completedAt: new Date(),
          },
        });

        // Notify user via socket
        io.emit('quest:completed', {
          userId,
          questId: userQuest.id,
          questTitle: userQuest.quest.title,
        });
      }
    }
  } catch (error) {
    console.error('Check quest progress error:', error);
  }
}

export default router;
