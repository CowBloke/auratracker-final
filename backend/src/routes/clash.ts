import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { z } from 'zod';

const router = Router();

// Constants
const ATTACK_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const SHIELD_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
const GRID_SIZE = 15;

// Building types with their properties
const BUILDING_TYPES = {
  townhall: { maxLevel: 5, baseHp: 1000, cost: 0, size: 3 },
  cannon: { maxLevel: 5, baseHp: 400, damage: 50, cost: 100, size: 2 },
  archer_tower: { maxLevel: 5, baseHp: 350, damage: 40, cost: 150, size: 2 },
  wall: { maxLevel: 5, baseHp: 200, cost: 25, size: 1 },
  gold_mine: { maxLevel: 5, baseHp: 300, production: 50, cost: 100, size: 2 },
  elixir_collector: { maxLevel: 5, baseHp: 300, production: 50, cost: 100, size: 2 },
  gold_storage: { maxLevel: 5, baseHp: 500, capacity: 5000, cost: 200, size: 2 },
  elixir_storage: { maxLevel: 5, baseHp: 500, capacity: 5000, cost: 200, size: 2 },
  barracks: { maxLevel: 3, baseHp: 400, cost: 300, size: 3 },
  mortar: { maxLevel: 3, baseHp: 350, damage: 80, splashRadius: 2, cost: 500, size: 3 },
};

// Troop types
const TROOP_TYPES = {
  barbarian: { hp: 50, damage: 20, speed: 1.5, cost: 25, trainTime: 20 },
  archer: { hp: 30, damage: 15, speed: 1.2, range: 3, cost: 50, trainTime: 25 },
  giant: { hp: 200, damage: 30, speed: 0.8, targetDefenses: true, cost: 100, trainTime: 60 },
  goblin: { hp: 25, damage: 15, speed: 2, targetResources: true, cost: 30, trainTime: 15 },
};

// Validation schemas
const saveBaseSchema = z.object({
  buildings: z.array(z.object({
    id: z.string(),
    type: z.string(),
    level: z.number().int().min(1).max(5),
    x: z.number().int().min(0).max(GRID_SIZE - 1),
    y: z.number().int().min(0).max(GRID_SIZE - 1),
  })),
});

const executeAttackSchema = z.object({
  defenderId: z.string().uuid(),
  troops: z.array(z.object({
    type: z.string(),
    x: z.number(),
    y: z.number(),
    deployTime: z.number(),
  })),
  duration: z.number().int().min(0).max(180), // max 3 minutes
  destruction: z.number().int().min(0).max(100),
  starsEarned: z.number().int().min(0).max(3),
});

// Helper to generate default base layout
function generateDefaultBase(): string {
  const buildings = [
    { id: 'th1', type: 'townhall', level: 1, x: 6, y: 6 },
    { id: 'c1', type: 'cannon', level: 1, x: 3, y: 3 },
    { id: 'c2', type: 'cannon', level: 1, x: 10, y: 3 },
    { id: 'at1', type: 'archer_tower', level: 1, x: 3, y: 10 },
    { id: 'gm1', type: 'gold_mine', level: 1, x: 11, y: 10 },
    { id: 'ec1', type: 'elixir_collector', level: 1, x: 1, y: 6 },
  ];
  return JSON.stringify({ buildings, version: 1 });
}

// Calculate defense rating from base layout
function calculateDefenseRating(baseLayout: string): number {
  try {
    const layout = JSON.parse(baseLayout);
    let rating = 0;
    
    for (const building of layout.buildings || []) {
      const type = BUILDING_TYPES[building.type as keyof typeof BUILDING_TYPES];
      if (type) {
        const baseRating = type.baseHp / 10;
        const levelMultiplier = 1 + (building.level - 1) * 0.25;
        rating += Math.floor(baseRating * levelMultiplier);
        
        // Bonus for defensive buildings
        if ('damage' in type) {
          rating += Math.floor(type.damage * building.level * 0.5);
        }
      }
    }
    
    return Math.max(100, rating);
  } catch {
    return 100;
  }
}

// Get or create user's clash base
router.get('/base/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    let base = await prisma.clashBase.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            aura: true,
            money: true,
          },
        },
      },
    });
    
    // Auto-create base if doesn't exist
    if (!base) {
      base = await prisma.clashBase.create({
        data: {
          userId,
          baseLayout: generateDefaultBase(),
          defenseRating: 100,
          trophies: 0,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              aura: true,
              money: true,
            },
          },
        },
      });
    }
    
    res.json({ 
      base: {
        ...base,
        baseLayout: JSON.parse(base.baseLayout),
      },
      buildingTypes: BUILDING_TYPES,
      gridSize: GRID_SIZE,
    });
  } catch (error) {
    console.error('Get clash base error:', error);
    res.status(500).json({ error: 'Failed to get base' });
  }
});

// Save base layout
router.put('/base', authMiddleware, validate(saveBaseSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { buildings } = req.body;
    const baseLayout = JSON.stringify({ buildings, version: 1 });
    const defenseRating = calculateDefenseRating(baseLayout);
    
    const base = await prisma.clashBase.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        baseLayout,
        defenseRating,
      },
      update: {
        baseLayout,
        defenseRating,
        updatedAt: new Date(),
      },
    });
    
    res.json({ 
      success: true, 
      base: {
        ...base,
        baseLayout: JSON.parse(base.baseLayout),
      },
      defenseRating,
    });
  } catch (error) {
    console.error('Save clash base error:', error);
    res.status(500).json({ error: 'Failed to save base' });
  }
});

// Get available targets for attack
router.get('/targets', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const now = new Date();
    
    // Get user's base for trophy matching
    const userBase = await prisma.clashBase.findUnique({
      where: { userId: req.user.id },
    });
    
    const userTrophies = userBase?.trophies || 0;
    
    // Find targets: not shielded, not the attacker, within trophy range
    const targets = await prisma.clashBase.findMany({
      where: {
        userId: { not: req.user.id },
        OR: [
          { shieldUntil: null },
          { shieldUntil: { lt: now } },
        ],
        trophies: {
          gte: Math.max(0, userTrophies - 200),
          lte: userTrophies + 200,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            aura: true,
            money: true,
          },
        },
      },
      take: 10,
      orderBy: { trophies: 'desc' },
    });
    
    // Calculate potential loot for each target
    const targetsWithLoot = targets.map((target) => ({
      id: target.userId,
      username: target.user.username,
      trophies: target.trophies,
      defenseRating: target.defenseRating,
      potentialMoney: Math.floor(target.user.money * 0.2), // Can steal up to 20%
      potentialAura: Math.floor(target.user.aura * 0.1), // Can steal up to 10%
    }));
    
    res.json({ targets: targetsWithLoot });
  } catch (error) {
    console.error('Get targets error:', error);
    res.status(500).json({ error: 'Failed to get targets' });
  }
});

// Check if can attack (cooldown check)
router.post('/attack/check', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { defenderId } = req.body;
    const now = new Date();
    
    // Check attacker's cooldown
    const attackerBase = await prisma.clashBase.findUnique({
      where: { userId: req.user.id },
    });
    
    if (attackerBase?.attackCooldown && attackerBase.attackCooldown > now) {
      const cooldownRemaining = Math.ceil((attackerBase.attackCooldown.getTime() - now.getTime()) / 1000);
      return res.json({ 
        canAttack: false, 
        reason: 'cooldown',
        cooldownRemaining,
      });
    }
    
    // Check if defender is shielded
    const defenderBase = await prisma.clashBase.findUnique({
      where: { userId: defenderId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            aura: true,
            money: true,
          },
        },
      },
    });
    
    if (!defenderBase) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    if (defenderBase.shieldUntil && defenderBase.shieldUntil > now) {
      const shieldRemaining = Math.ceil((defenderBase.shieldUntil.getTime() - now.getTime()) / 1000);
      return res.json({ 
        canAttack: false, 
        reason: 'shield',
        shieldRemaining,
      });
    }
    
    res.json({ 
      canAttack: true,
      defender: {
        id: defenderBase.userId,
        username: defenderBase.user.username,
        baseLayout: JSON.parse(defenderBase.baseLayout),
        defenseRating: defenderBase.defenseRating,
        trophies: defenderBase.trophies,
        potentialMoney: Math.floor(defenderBase.user.money * 0.2),
        potentialAura: Math.floor(defenderBase.user.aura * 0.1),
      },
      troopTypes: TROOP_TYPES,
    });
  } catch (error) {
    console.error('Attack check error:', error);
    res.status(500).json({ error: 'Failed to check attack' });
  }
});

// Execute attack
router.post('/attack/execute', authMiddleware, validate(executeAttackSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { defenderId, troops, duration, destruction, starsEarned } = req.body;
    const now = new Date();
    
    // Get both users and their bases
    const [attacker, defender, attackerBase, defenderBase] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id } }),
      prisma.user.findUnique({ where: { id: defenderId } }),
      prisma.clashBase.findUnique({ where: { userId: req.user.id } }),
      prisma.clashBase.findUnique({ where: { userId: defenderId } }),
    ]);
    
    if (!attacker || !defender || !defenderBase) {
      return res.status(404).json({ error: 'User or base not found' });
    }
    
    // Calculate rewards based on destruction and stars
    const success = starsEarned >= 1;
    const destructionMultiplier = destruction / 100;
    
    // Loot calculation
    const maxMoneyLoot = Math.floor(defender.money * 0.2);
    const maxAuraLoot = Math.floor(defender.aura * 0.1);
    const moneyTaken = success ? Math.floor(maxMoneyLoot * destructionMultiplier) : 0;
    const auraTaken = success ? Math.floor(maxAuraLoot * destructionMultiplier * (starsEarned / 3)) : 0;
    
    // Trophy calculation
    const trophyBase = 30;
    let trophiesWon = 0;
    let trophiesLost = 0;
    
    if (success) {
      trophiesWon = Math.floor(trophyBase * (starsEarned / 3) * (1 + (defenderBase.trophies - (attackerBase?.trophies || 0)) / 500));
      trophiesWon = Math.max(5, Math.min(50, trophiesWon));
    } else {
      trophiesLost = Math.floor(trophyBase * 0.5);
    }
    
    // Execute the attack in a transaction
    const [attack, updatedAttacker, updatedDefender] = await prisma.$transaction([
      // Create attack record
      prisma.attack.create({
        data: {
          attackerId: req.user.id,
          defenderId,
          success,
          starsEarned,
          destruction,
          auraTaken,
          moneyTaken,
          trophiesWon: success ? trophiesWon : 0,
          trophiesLost: !success ? trophiesLost : 0,
          replayData: JSON.stringify({ troops, duration }),
        },
      }),
      // Update attacker
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          aura: { increment: auraTaken - (!success ? Math.floor(attacker.aura * 0.05) : 0) },
          money: { increment: moneyTaken },
        },
      }),
      // Update defender
      prisma.user.update({
        where: { id: defenderId },
        data: {
          aura: { decrement: auraTaken },
          money: { decrement: moneyTaken },
        },
      }),
    ]);
    
    // Update bases (cooldown for attacker, shield for defender)
    await prisma.$transaction([
      prisma.clashBase.upsert({
        where: { userId: req.user.id },
        create: {
          userId: req.user.id,
          baseLayout: generateDefaultBase(),
          attackCooldown: new Date(now.getTime() + ATTACK_COOLDOWN_MS),
          trophies: success ? trophiesWon : -trophiesLost,
        },
        update: {
          attackCooldown: new Date(now.getTime() + ATTACK_COOLDOWN_MS),
          trophies: { increment: success ? trophiesWon : -trophiesLost },
        },
      }),
      prisma.clashBase.update({
        where: { userId: defenderId },
        data: {
          lastAttackedAt: now,
          shieldUntil: new Date(now.getTime() + SHIELD_DURATION_MS),
          trophies: { decrement: success ? trophiesWon : 0 },
        },
      }),
    ]);
    
    // Emit socket events
    io.emit('economy:balance-update', {
      userId: req.user.id,
      aura: updatedAttacker.aura,
      money: updatedAttacker.money,
    });
    
    io.emit('economy:balance-update', {
      userId: defenderId,
      aura: updatedDefender.aura,
      money: updatedDefender.money,
    });
    
    io.emit('clash:attack-complete', {
      attackerId: req.user.id,
      attackerName: attacker.username,
      defenderId,
      defenderName: defender.username,
      success,
      starsEarned,
      auraTaken,
      moneyTaken,
    });
    
    res.json({
      success,
      starsEarned,
      destruction,
      auraTaken,
      moneyTaken,
      trophiesWon: success ? trophiesWon : 0,
      trophiesLost: !success ? trophiesLost : 0,
      auraLostOnFail: !success ? Math.floor(attacker.aura * 0.05) : 0,
      newBalance: {
        aura: updatedAttacker.aura,
        money: updatedAttacker.money,
      },
      cooldownUntil: new Date(now.getTime() + ATTACK_COOLDOWN_MS),
    });
  } catch (error) {
    console.error('Execute attack error:', error);
    res.status(500).json({ error: 'Failed to execute attack' });
  }
});

// Get attack history
router.get('/attacks', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { type = 'all', limit = '20' } = req.query;
    
    const where = type === 'made' 
      ? { attackerId: req.user.id }
      : type === 'received'
        ? { defenderId: req.user.id }
        : { OR: [{ attackerId: req.user.id }, { defenderId: req.user.id }] };
    
    const attacks = await prisma.attack.findMany({
      where,
      orderBy: { attackedAt: 'desc' },
      take: parseInt(limit as string),
      include: {
        attacker: {
          select: { id: true, username: true },
        },
        defender: {
          select: { id: true, username: true },
        },
      },
    });
    
    res.json({ attacks });
  } catch (error) {
    console.error('Get attacks error:', error);
    res.status(500).json({ error: 'Failed to get attacks' });
  }
});

// Get clash leaderboard
router.get('/leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '20' } = req.query;
    
    const rankings = await prisma.clashBase.findMany({
      orderBy: { trophies: 'desc' },
      take: parseInt(limit as string),
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    res.json({ 
      rankings: rankings.map((r, index) => ({
        rank: index + 1,
        userId: r.userId,
        username: r.user.username,
        trophies: r.trophies,
        defenseRating: r.defenseRating,
      })),
    });
  } catch (error) {
    console.error('Get clash leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Buy/upgrade building
router.post('/building/upgrade', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { buildingId, buildingType, currentLevel } = req.body;
    
    const type = BUILDING_TYPES[buildingType as keyof typeof BUILDING_TYPES];
    if (!type) {
      return res.status(400).json({ error: 'Invalid building type' });
    }
    
    if (currentLevel >= type.maxLevel) {
      return res.status(400).json({ error: 'Building already at max level' });
    }
    
    const upgradeCost = Math.floor(type.cost * Math.pow(1.5, currentLevel));
    
    // Check user balance
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    
    if (!user || user.money < upgradeCost) {
      return res.status(400).json({ error: 'Insufficient funds', required: upgradeCost });
    }
    
    // Deduct cost
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { money: { decrement: upgradeCost } },
    });
    
    io.emit('economy:balance-update', {
      userId: req.user.id,
      aura: updatedUser.aura,
      money: updatedUser.money,
    });
    
    res.json({
      success: true,
      newLevel: currentLevel + 1,
      cost: upgradeCost,
      newBalance: updatedUser.money,
    });
  } catch (error) {
    console.error('Upgrade building error:', error);
    res.status(500).json({ error: 'Failed to upgrade building' });
  }
});

export default router;
