import { Router, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

type BuildingType = 'cannon' | 'archer' | 'mortar' | 'tesla';
type BuildingInstance = {
  id: string;
  type: BuildingType;
  slot: number;
};

const ATTACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SHIELD_MS = 11 * 60 * 60 * 1000;
const SLOT_LAYOUT_COUNT = 8;

const BUILDINGS: Record<BuildingType, { name: string; cost: number; defense: number; limit: number }> = {
  cannon: { name: 'Canon', cost: 500, defense: 30, limit: 2 },
  archer: { name: "Tour d'archers", cost: 900, defense: 52, limit: 2 },
  mortar: { name: 'Mortier', cost: 1500, defense: 85, limit: 1 },
  tesla: { name: 'Tesla', cost: 2400, defense: 130, limit: 1 },
};

function constructionLimit(townHallLevel: number) {
  return Math.min(SLOT_LAYOUT_COUNT, 2 + townHallLevel * 2);
}

function townHallUpgradeCost(level: number) {
  return 1500 * level * 2;
}

function sellPrice(type: BuildingType) {
  return Math.floor(BUILDINGS[type].cost / 2);
}

function parseBuildings(buildingsJson: string): BuildingInstance[] {
  try {
    const parsed = JSON.parse(buildingsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is BuildingInstance =>
      item &&
      typeof item.id === 'string' &&
      typeof item.slot === 'number' &&
      typeof item.type === 'string' &&
      Object.hasOwn(BUILDINGS, item.type)
    );
  } catch {
    return [];
  }
}

function defenseScore(townHallLevel: number, buildings: BuildingInstance[]) {
  return townHallLevel * 45 + buildings.reduce((sum, item) => sum + BUILDINGS[item.type].defense, 0);
}

async function ensureVillage(userId: string) {
  return prisma.clashVillage.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      buildingsJson: '[]',
    },
  });
}

async function createHistoryEntries(tx: Prisma.TransactionClient, entries: Array<{
  villageId: string;
  eventType: string;
  title: string;
  detail: string;
  deltaMoney: number;
  relatedUserId?: string;
}>) {
  if (entries.length === 0) return;
  await tx.clashHistory.createMany({
    data: entries.map((entry) => ({
      villageId: entry.villageId,
      eventType: entry.eventType,
      title: entry.title,
      detail: entry.detail,
      deltaMoney: entry.deltaMoney,
      relatedUserId: entry.relatedUserId ?? null,
    })),
  });
}

async function trimHistory(tx: Prisma.TransactionClient, villageId: string) {
  const stale = await tx.clashHistory.findMany({
    where: { villageId },
    orderBy: { createdAt: 'desc' },
    skip: 30,
    select: { id: true },
  });

  if (stale.length > 0) {
    await tx.clashHistory.deleteMany({
      where: { id: { in: stale.map((entry) => entry.id) } },
    });
  }
}

function serializeVillage(
  village: { id: string; townHallLevel: number; buildingsJson: string; lastAttackAt: Date | null; shieldUntil: Date | null },
  money: number,
  history: Array<{ id: string; eventType: string; title: string; detail: string; deltaMoney: number; createdAt: Date; relatedUserId: string | null }>
) {
  return {
    id: village.id,
    money,
    townHallLevel: village.townHallLevel,
    buildings: parseBuildings(village.buildingsJson),
    lastAttackAt: village.lastAttackAt ? village.lastAttackAt.toISOString() : null,
    shieldUntil: village.shieldUntil ? village.shieldUntil.toISOString() : null,
    history: history.map((entry) => ({
      id: entry.id,
      kind: entry.eventType,
      title: entry.title,
      detail: entry.detail,
      deltaMoney: entry.deltaMoney,
      timestamp: entry.createdAt.toISOString(),
      relatedUserId: entry.relatedUserId,
    })),
  };
}

router.get('/state', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [user, village] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { money: true },
      }),
      ensureVillage(userId),
    ]);

    const history = await prisma.clashHistory.findMany({
      where: { villageId: village.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    res.json({
      village: serializeVillage(village, user?.money ?? 0, history),
    });
  } catch (error) {
    console.error('Clash state error:', error);
    res.status(500).json({ error: 'Failed to load clash state' });
  }
});

router.get('/opponents', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await ensureVillage(userId);

    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        isAdmin: false,
        isApproved: true,
      },
      select: {
        id: true,
        username: true,
        money: true,
        clashVillage: {
          select: {
            townHallLevel: true,
            buildingsJson: true,
            shieldUntil: true,
          },
        },
      },
      orderBy: { money: 'desc' },
      take: 20,
    });

    res.json({
      opponents: users.map((entry) => {
        const buildings = parseBuildings(entry.clashVillage?.buildingsJson ?? '[]');
        const level = entry.clashVillage?.townHallLevel ?? 1;
        return {
          id: entry.id,
          name: entry.username,
          money: entry.money,
          townHallLevel: level,
          defenseScore: defenseScore(level, buildings),
          shieldUntil: entry.clashVillage?.shieldUntil ? entry.clashVillage.shieldUntil.toISOString() : null,
        };
      }),
    });
  } catch (error) {
    console.error('Clash opponents error:', error);
    res.status(500).json({ error: 'Failed to load clash opponents' });
  }
});

router.post('/build', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const type = req.body?.type as BuildingType;
    if (!Object.hasOwn(BUILDINGS, type)) {
      return res.status(400).json({ error: 'Invalid building type' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const [user, village] = await Promise.all([
        tx.user.findUnique({ where: { id: userId }, select: { money: true } }),
        tx.clashVillage.upsert({
          where: { userId },
          update: {},
          create: { userId, buildingsJson: '[]' },
        }),
      ]);

      if (!user) throw new Error('USER_NOT_FOUND');

      const buildings = parseBuildings(village.buildingsJson);
      const counts = buildings.reduce<Record<BuildingType, number>>((acc, item) => {
        acc[item.type] += 1;
        return acc;
      }, { cannon: 0, archer: 0, mortar: 0, tesla: 0 });

      if (counts[type] >= BUILDINGS[type].limit) throw new Error('LIMIT_REACHED');
      if (buildings.length >= constructionLimit(village.townHallLevel)) throw new Error('NO_SLOT_AVAILABLE');
      if (user.money < BUILDINGS[type].cost) throw new Error('INSUFFICIENT_MONEY');

      const usedSlots = new Set(buildings.map((item) => item.slot));
      const slot = [...Array(constructionLimit(village.townHallLevel)).keys()].find((value) => !usedSlots.has(value));
      if (slot === undefined) throw new Error('NO_SLOT_AVAILABLE');

      buildings.push({ id: crypto.randomUUID(), type, slot });

      const [updatedUser, updatedVillage] = await Promise.all([
        tx.user.update({
          where: { id: userId },
          data: { money: { decrement: BUILDINGS[type].cost } },
          select: { money: true },
        }),
        tx.clashVillage.update({
          where: { id: village.id },
          data: { buildingsJson: JSON.stringify(buildings) },
        }),
      ]);

      await createHistoryEntries(tx, [{
        villageId: village.id,
        eventType: 'build',
        title: `${BUILDINGS[type].name} construit`,
        detail: `${BUILDINGS[type].name} posé sur l'emplacement ${slot + 1}.`,
        deltaMoney: -BUILDINGS[type].cost,
      }]);
      await trimHistory(tx, village.id);

      const history = await tx.clashHistory.findMany({
        where: { villageId: village.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      return serializeVillage(updatedVillage, updatedUser.money, history);
    });

    res.json({ village: result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'LIMIT_REACHED') return res.status(400).json({ error: 'Construction limit reached for this defense' });
      if (error.message === 'NO_SLOT_AVAILABLE') return res.status(400).json({ error: 'No construction slot available' });
      if (error.message === 'INSUFFICIENT_MONEY') return res.status(400).json({ error: 'Insufficient money' });
    }
    console.error('Clash build error:', error);
    res.status(500).json({ error: 'Failed to build defense' });
  }
});

router.post('/sell', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const buildingId = typeof req.body?.buildingId === 'string' ? req.body.buildingId : '';
    if (!buildingId) {
      return res.status(400).json({ error: 'Missing buildingId' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const [user, village] = await Promise.all([
        tx.user.findUnique({ where: { id: userId }, select: { money: true } }),
        tx.clashVillage.upsert({
          where: { userId },
          update: {},
          create: { userId, buildingsJson: '[]' },
        }),
      ]);

      if (!user) throw new Error('USER_NOT_FOUND');

      const buildings = parseBuildings(village.buildingsJson);
      const building = buildings.find((entry) => entry.id === buildingId);
      if (!building) throw new Error('BUILDING_NOT_FOUND');

      const refund = sellPrice(building.type);
      const remaining = buildings.filter((entry) => entry.id !== buildingId);

      const [updatedUser, updatedVillage] = await Promise.all([
        tx.user.update({
          where: { id: userId },
          data: { money: { increment: refund } },
          select: { money: true },
        }),
        tx.clashVillage.update({
          where: { id: village.id },
          data: { buildingsJson: JSON.stringify(remaining) },
        }),
      ]);

      await createHistoryEntries(tx, [{
        villageId: village.id,
        eventType: 'sell',
        title: `${BUILDINGS[building.type].name} vendu`,
        detail: `Revente à moitié prix: ${refund} or récupéré.`,
        deltaMoney: refund,
      }]);
      await trimHistory(tx, village.id);

      const history = await tx.clashHistory.findMany({
        where: { villageId: village.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      return serializeVillage(updatedVillage, updatedUser.money, history);
    });

    res.json({ village: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'BUILDING_NOT_FOUND') {
      return res.status(404).json({ error: 'Building not found' });
    }
    console.error('Clash sell error:', error);
    res.status(500).json({ error: 'Failed to sell defense' });
  }
});

router.post('/town-hall/upgrade', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await prisma.$transaction(async (tx) => {
      const [user, village] = await Promise.all([
        tx.user.findUnique({ where: { id: userId }, select: { money: true } }),
        tx.clashVillage.upsert({
          where: { userId },
          update: {},
          create: { userId, buildingsJson: '[]' },
        }),
      ]);

      if (!user) throw new Error('USER_NOT_FOUND');

      const cost = townHallUpgradeCost(village.townHallLevel);
      if (user.money < cost) throw new Error('INSUFFICIENT_MONEY');

      const [updatedUser, updatedVillage] = await Promise.all([
        tx.user.update({
          where: { id: userId },
          data: { money: { decrement: cost } },
          select: { money: true },
        }),
        tx.clashVillage.update({
          where: { id: village.id },
          data: { townHallLevel: { increment: 1 } },
        }),
      ]);

      await createHistoryEntries(tx, [{
        villageId: village.id,
        eventType: 'upgrade',
        title: `Hôtel de Ville niv. ${updatedVillage.townHallLevel}`,
        detail: `Capacité de construction portée à ${constructionLimit(updatedVillage.townHallLevel)} bâtiments.`,
        deltaMoney: -cost,
      }]);
      await trimHistory(tx, village.id);

      const history = await tx.clashHistory.findMany({
        where: { villageId: village.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      return serializeVillage(updatedVillage, updatedUser.money, history);
    });

    res.json({ village: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_MONEY') {
      return res.status(400).json({ error: 'Insufficient money' });
    }
    console.error('Clash town hall upgrade error:', error);
    res.status(500).json({ error: 'Failed to upgrade town hall' });
  }
});

router.post('/attack', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const attackerId = req.user!.id;
    const targetUserId = typeof req.body?.targetUserId === 'string' ? req.body.targetUserId : '';
    if (!targetUserId || targetUserId === attackerId) {
      return res.status(400).json({ error: 'Invalid target user' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const [attacker, target] = await Promise.all([
        tx.user.findUnique({
          where: { id: attackerId },
          select: {
            id: true,
            username: true,
            money: true,
            clashVillage: true,
          },
        }),
        tx.user.findUnique({
          where: { id: targetUserId },
          select: {
            id: true,
            username: true,
            money: true,
            clashVillage: true,
          },
        }),
      ]);

      if (!attacker || !target) throw new Error('USER_NOT_FOUND');

      const attackerVillage = attacker.clashVillage ?? await tx.clashVillage.create({ data: { userId: attacker.id, buildingsJson: '[]' } });
      const targetVillage = target.clashVillage ?? await tx.clashVillage.create({ data: { userId: target.id, buildingsJson: '[]' } });

      if (attackerVillage.lastAttackAt && now.getTime() - attackerVillage.lastAttackAt.getTime() < ATTACK_COOLDOWN_MS) {
        throw new Error('ATTACK_COOLDOWN');
      }
      if (targetVillage.shieldUntil && targetVillage.shieldUntil > now) {
        throw new Error('TARGET_SHIELDED');
      }

      const attackerBuildings = parseBuildings(attackerVillage.buildingsJson);
      const targetBuildings = parseBuildings(targetVillage.buildingsJson);
      const attackPower = 210 + attackerVillage.townHallLevel * 35 + attackerBuildings.length * 18 + Math.floor(Math.random() * 80);
      const targetDefense = defenseScore(targetVillage.townHallLevel, targetBuildings);
      const raidSucceeded = attackPower >= targetDefense * (0.82 + Math.random() * 0.16);
      const plunder = raidSucceeded
        ? Math.min(target.money, Math.max(220, Math.floor(target.money * (0.16 + Math.random() * 0.18))))
        : 0;

      const updatedShield = new Date(now.getTime() + SHIELD_MS);

      await Promise.all([
        tx.clashVillage.update({
          where: { id: attackerVillage.id },
          data: { lastAttackAt: now },
        }),
        tx.clashVillage.update({
          where: { id: targetVillage.id },
          data: { shieldUntil: updatedShield },
        }),
      ]);

      if (raidSucceeded && plunder > 0) {
        await Promise.all([
          tx.user.update({
            where: { id: attacker.id },
            data: { money: { increment: plunder } },
          }),
          tx.user.update({
            where: { id: target.id },
            data: { money: { decrement: plunder } },
          }),
        ]);
      }

      await createHistoryEntries(tx, [
        {
          villageId: attackerVillage.id,
          eventType: raidSucceeded ? 'attack-win' : 'attack-loss',
          title: raidSucceeded ? `Raid réussi sur ${target.username}` : `Raid raté sur ${target.username}`,
          detail: raidSucceeded
            ? `${plunder} or pillé. Le défenseur reçoit un bouclier de 11 heures.`
            : `${target.username} reçoit un bouclier de 11 heures après l'attaque.`,
          deltaMoney: raidSucceeded ? plunder : 0,
          relatedUserId: target.id,
        },
        {
          villageId: targetVillage.id,
          eventType: 'defense',
          title: raidSucceeded ? `Base attaquée par ${attacker.username}` : `Défense réussie contre ${attacker.username}`,
          detail: raidSucceeded
            ? `${attacker.username} a pillé ${plunder} or. Bouclier actif pendant 11 heures.`
            : `Les défenses ont tenu. Bouclier actif pendant 11 heures.`,
          deltaMoney: raidSucceeded ? -plunder : 0,
          relatedUserId: attacker.id,
        },
      ]);
      await Promise.all([trimHistory(tx, attackerVillage.id), trimHistory(tx, targetVillage.id)]);

      const [freshAttackerVillage, attackerHistory] = await Promise.all([
        tx.clashVillage.findUniqueOrThrow({ where: { id: attackerVillage.id } }),
        tx.clashHistory.findMany({
          where: { villageId: attackerVillage.id },
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
      ]);

      const freshAttackerUser = await tx.user.findUnique({
        where: { id: attacker.id },
        select: { money: true },
      });

      return {
        village: serializeVillage(freshAttackerVillage, freshAttackerUser?.money ?? attacker.money, attackerHistory),
        attack: {
          success: raidSucceeded,
          plunder,
          targetUserId: target.id,
          targetUsername: target.username,
          targetShieldUntil: updatedShield.toISOString(),
        },
      };
    });

    createNotification({
      userId: targetUserId,
      type: 'SYSTEM',
      title: 'Ta base Clash a été attaquée',
      body: result.attack.success
        ? `${req.user!.username} a pillé ${result.attack.plunder} or. Ton bouclier dure 11 heures.`
        : `${req.user!.username} a tenté un raid. Ton bouclier dure 11 heures.`,
      data: {
        attackerId,
        attackerUsername: req.user!.username,
        plunder: result.attack.plunder,
      },
      link: '/games/clash',
      icon: 'shield',
    }).catch((notificationError) => {
      console.error('Clash notification error:', notificationError);
    });

    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'ATTACK_COOLDOWN') return res.status(400).json({ error: 'Attack cooldown still active' });
      if (error.message === 'TARGET_SHIELDED') return res.status(400).json({ error: 'Target is currently shielded' });
      if (error.message === 'USER_NOT_FOUND') return res.status(404).json({ error: 'User not found' });
    }
    console.error('Clash attack error:', error);
    res.status(500).json({ error: 'Failed to attack target' });
  }
});

export default router;
