import { prisma } from '../server.js';

/**
 * Auto-update achievement badges based on current leaderboards
 * This should be called after significant events like:
 * - Money transfers
 * - Game completions (high scores)
 * - Daily resets
 */

export async function updateAchievementBadges() {
  try {
    // Get badge IDs for achievement badges (assuming they exist)
    const mostMoneyBadge = await prisma.badge.findFirst({
      where: { name: { contains: 'Most Money' } },
    });

    const topAuraBadge = await prisma.badge.findFirst({
      where: { name: { contains: 'Top Aura' } },
    });

    const bestScoreBadge = await prisma.badge.findFirst({
      where: { name: { contains: 'Best Score' } },
    });

    // Update "Most Money" badge
    if (mostMoneyBadge) {
      // Get user with most money
      const topMoneyUser = await prisma.user.findFirst({
        orderBy: { money: 'desc' },
        select: { id: true },
      });

      if (topMoneyUser) {
        // Remove badge from all users
        await prisma.userBadge.deleteMany({
          where: { badgeId: mostMoneyBadge.id },
        });

        // Assign to top user
        await prisma.userBadge.create({
          data: {
            userId: topMoneyUser.id,
            badgeId: mostMoneyBadge.id,
            isSelected: true, // Auto-select achievement badges
          },
        });
      }
    }

    // Update "Top Aura" badge
    if (topAuraBadge) {
      // Get user with most aura
      const topAuraUser = await prisma.user.findFirst({
        orderBy: { aura: 'desc' },
        select: { id: true },
      });

      if (topAuraUser) {
        // Remove badge from all users
        await prisma.userBadge.deleteMany({
          where: { badgeId: topAuraBadge.id },
        });

        // Assign to top user
        await prisma.userBadge.create({
          data: {
            userId: topAuraUser.id,
            badgeId: topAuraBadge.id,
            isSelected: true,
          },
        });
      }
    }

    // Update "Best Score" badge (highest doodle jump score)
    if (bestScoreBadge) {
      const topScoreGame = await prisma.gameStats.findFirst({
        where: { gameType: 'doodle_jump' },
        orderBy: { highScore: 'desc' },
        select: { userId: true },
      });

      if (topScoreGame) {
        // Remove badge from all users
        await prisma.userBadge.deleteMany({
          where: { badgeId: bestScoreBadge.id },
        });

        // Assign to top user
        await prisma.userBadge.create({
          data: {
            userId: topScoreGame.userId,
            badgeId: bestScoreBadge.id,
            isSelected: true,
          },
        });
      }
    }

    console.log('Achievement badges updated successfully');
  } catch (error) {
    console.error('Error updating achievement badges:', error);
  }
}

/**
 * Update achievement badges for a specific type
 * @param type - 'money' | 'aura' | 'score'
 */
export async function updateSpecificAchievementBadge(type: 'money' | 'aura' | 'score') {
  try {
    let badge;
    let topUser;

    switch (type) {
      case 'money':
        badge = await prisma.badge.findFirst({
          where: { name: { contains: 'Most Money' } },
        });
        topUser = await prisma.user.findFirst({
          orderBy: { money: 'desc' },
          select: { id: true },
        });
        break;

      case 'aura':
        badge = await prisma.badge.findFirst({
          where: { name: { contains: 'Top Aura' } },
        });
        topUser = await prisma.user.findFirst({
          orderBy: { aura: 'desc' },
          select: { id: true },
        });
        break;

      case 'score':
        badge = await prisma.badge.findFirst({
          where: { name: { contains: 'Best Score' } },
        });
        const topScoreGame = await prisma.gameStats.findFirst({
          where: { gameType: 'doodle_jump' },
          orderBy: { highScore: 'desc' },
          select: { userId: true },
        });
        topUser = topScoreGame ? { id: topScoreGame.userId } : null;
        break;
    }

    if (badge && topUser) {
      // Remove badge from all users
      await prisma.userBadge.deleteMany({
        where: { badgeId: badge.id },
      });

      // Assign to top user
      await prisma.userBadge.upsert({
        where: {
          userId_badgeId: {
            userId: topUser.id,
            badgeId: badge.id,
          },
        },
        create: {
          userId: topUser.id,
          badgeId: badge.id,
          isSelected: true,
        },
        update: {
          isSelected: true,
        },
      });

      console.log(`${type} achievement badge updated successfully`);
    }
  } catch (error) {
    console.error(`Error updating ${type} achievement badge:`, error);
  }
}
