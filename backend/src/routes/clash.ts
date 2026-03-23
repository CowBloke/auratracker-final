import { Prisma, type PrismaClient } from '@prisma/client';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { logGame } from '../utils/logger.js';
import { prisma } from '../server.js';

const router = Router();

const ATTACK_COOLDOWN_MINUTES = 10;
const DEFENDER_SHIELD_MINUTES = 30;
const STEAL_COEFFICIENT = 0.35;
const MATCHMAKING_TARGET_COUNT = 6;
const MATCHMAKING_PRIMARY_RANGE = 200;
const MATCHMAKING_FALLBACK_RANGE = 500;

const BUILDING_TYPES = ['townHall', 'goldStorage', 'vault', 'cannon', 'wall'] as const;
type BuildingType = (typeof BUILDING_TYPES)[number];

type ClashBuilding = {
  id: string;
  type: BuildingType;
  level: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  storageCapacity?: number;
  defensePower?: number;
  protectionPct?: number;
};

type ClashTroop = {
  type: 'barbarian' | 'archer' | 'giant';
  count: number;
};

type ClashLayoutTile = {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const upgradeSchema = z.object({
  buildingType: z.enum(BUILDING_TYPES),
});

const attackSchema = z.object({
  defenderUserId: z.string().uuid(),
  attackPlan: z.array(
    z.object({
      troopType: z.enum(['barbarian', 'archer', 'giant']),
      count: z.number().int().min(0).max(100),
    }),
  ).max(10).optional(),
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function storageCapacityForLevel(level: number) {
  return 2_000 + (level - 1) * 1_500;
}

function townHallCapacityForLevel(level: number) {
  return 3_000 + (level - 1) * 2_000;
}

function buildingMaxHp(type: BuildingType, level: number) {
  switch (type) {
    case 'townHall':
      return 900 + (level - 1) * 240;
    case 'goldStorage':
      return 620 + (level - 1) * 160;
    case 'vault':
      return 520 + (level - 1) * 120;
    case 'cannon':
      return 560 + (level - 1) * 150;
    case 'wall':
      return 750 + (level - 1) * 190;
    default:
      return 500;
  }
}

function cannonDefensePower(level: number) {
  return 14 + (level - 1) * 8;
}

function wallDefensePower(level: number) {
  return 8 + (level - 1) * 6;
}

function vaultProtectionPct(level: number) {
  return clamp(0.08 + (level - 1) * 0.06, 0.08, 0.5);
}

function buildingWeight(type: BuildingType) {
  switch (type) {
    case 'townHall':
      return 3;
    case 'goldStorage':
      return 1.5;
    case 'vault':
      return 1.25;
    case 'cannon':
      return 1.75;
    case 'wall':
      return 1.5;
    default:
      return 1;
  }
}

function createBuilding(type: BuildingType, level: number, x: number, y: number): ClashBuilding {
  const maxHp = buildingMaxHp(type, level);
  return {
    id: `${type}-${x}-${y}`,
    type,
    level,
    x,
    y,
    hp: maxHp,
    maxHp,
    storageCapacity: type === 'goldStorage' ? storageCapacityForLevel(level) : undefined,
    defensePower: type === 'cannon' ? cannonDefensePower(level) : type === 'wall' ? wallDefensePower(level) : undefined,
    protectionPct: type === 'vault' ? vaultProtectionPct(level) : undefined,
  };
}

function createDefaultBuildings(): ClashBuilding[] {
  return [
    createBuilding('townHall', 1, 4, 1),
    createBuilding('goldStorage', 1, 2, 3),
    createBuilding('vault', 1, 6, 3),
    createBuilding('cannon', 1, 2, 1),
    createBuilding('wall', 1, 5, 4),
  ];
}

function createDefaultLayout(buildings: ClashBuilding[]): ClashLayoutTile[] {
  return buildings.map((building) => ({
    id: building.id,
    type: building.type,
    x: building.x,
    y: building.y,
  }));
}

function createDefaultTroops(): ClashTroop[] {
  return [
    { type: 'barbarian', count: 16 },
    { type: 'archer', count: 10 },
    { type: 'giant', count: 4 },
  ];
}

function parseBuildings(raw: string): ClashBuilding[] {
  const parsed = safeJsonParse<ClashBuilding[]>(raw, []);
  return parsed.filter((entry): entry is ClashBuilding => BUILDING_TYPES.includes(entry.type));
}

function parseTroops(raw: string): ClashTroop[] {
  const parsed = safeJsonParse<ClashTroop[]>(raw, []);
  return parsed.map((troop) => ({
    type: troop.type,
    count: Math.max(0, Math.floor(troop.count || 0)),
  }));
}

function getBuilding(buildings: ClashBuilding[], type: BuildingType) {
  return buildings.find((building) => building.type === type);
}

function getStorageCapacity(buildings: ClashBuilding[], townHallLevel: number) {
  const storage = getBuilding(buildings, 'goldStorage');
  return townHallCapacityForLevel(townHallLevel) + (storage?.storageCapacity ?? storageCapacityForLevel(1));
}

function getVaultProtection(buildings: ClashBuilding[]) {
  return getBuilding(buildings, 'vault')?.protectionPct ?? vaultProtectionPct(1);
}

function getDefenseRating(buildings: ClashBuilding[], townHallLevel: number) {
  const cannon = getBuilding(buildings, 'cannon');
  const wall = getBuilding(buildings, 'wall');
  return townHallLevel * 12 + (cannon?.defensePower ?? 0) * 1.5 + (wall?.defensePower ?? 0) * 1.2;
}

function getUpgradeCost(type: BuildingType, level: number) {
  switch (type) {
    case 'townHall':
      return 700 + (level - 1) * 900;
    case 'goldStorage':
      return 450 + (level - 1) * 550;
    case 'vault':
      return 350 + (level - 1) * 450;
    case 'cannon':
      return 550 + (level - 1) * 650;
    case 'wall':
      return 300 + (level - 1) * 400;
    default:
      return 500;
  }
}

function getTroopPower(plan: ClashTroop[]) {
  return plan.reduce((sum, troop) => {
    switch (troop.type) {
      case 'barbarian':
        return sum + troop.count * 2.6;
      case 'archer':
        return sum + troop.count * 2.2;
      case 'giant':
        return sum + troop.count * 6.5;
      default:
        return sum;
    }
  }, 0);
}

function deterministicRatio(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

function computeDestructionPercent(input: {
  attackerId: string;
  defenderId: string;
  attackerTrophies: number;
  defenderTrophies: number;
  townHallLevel: number;
  defenseRating: number;
  troops: ClashTroop[];
}) {
  const attackPower = getTroopPower(input.troops);
  const trophySwing = clamp((input.attackerTrophies - input.defenderTrophies) / 30, -12, 12);
  const seed = [
    input.attackerId,
    input.defenderId,
    input.attackerTrophies,
    input.defenderTrophies,
    input.townHallLevel,
    Math.round(attackPower),
  ].join(':');
  const noise = deterministicRatio(seed) * 18;
  const raw = 28 + attackPower * 1.45 - input.defenseRating * 0.72 - input.townHallLevel * 3 + trophySwing + noise;
  return Math.round(clamp(raw, 0, 100));
}

function getTrophyDelta(destructionPercent: number) {
  if (destructionPercent >= 75) return { attacker: 16, defender: -14, result: 'big_win' as const };
  if (destructionPercent >= 50) return { attacker: 10, defender: -10, result: 'win' as const };
  if (destructionPercent >= 25) return { attacker: 4, defender: -4, result: 'minor_win' as const };
  return { attacker: -8, defender: 5, result: 'fail' as const };
}

function getDestroyedBuildings(buildings: ClashBuilding[], destructionPercent: number) {
  const totalWeight = buildings.reduce((sum, building) => sum + buildingWeight(building.type), 0);
  const targetWeight = totalWeight * (destructionPercent / 100);
  let accumulatedWeight = 0;
  const ordered = [...buildings].sort((a, b) => buildingWeight(b.type) - buildingWeight(a.type));
  return ordered.filter((building) => {
    if (accumulatedWeight >= targetWeight) return false;
    accumulatedWeight += buildingWeight(building.type);
    return true;
  });
}

function serializeVillage(village: {
  id: string;
  townHallLevel: number;
  moneyInStorage: number;
  trophies: number;
  shieldUntil: Date | null;
  attackCooldownUntil: Date | null;
  layoutJson: string;
  buildingsJson: string;
  troopsJson: string;
  user?: { id: string; username: string; usernameColor: string | null; profilePicture: string | null } | null;
}) {
  const buildings = parseBuildings(village.buildingsJson);
  const troops = parseTroops(village.troopsJson);
  const layout = safeJsonParse<ClashLayoutTile[]>(village.layoutJson, createDefaultLayout(buildings));
  return {
    id: village.id,
    townHallLevel: village.townHallLevel,
    moneyInStorage: village.moneyInStorage,
    trophies: village.trophies,
    shieldUntil: village.shieldUntil?.toISOString() ?? null,
    attackCooldownUntil: village.attackCooldownUntil?.toISOString() ?? null,
    storageCapacity: getStorageCapacity(buildings, village.townHallLevel),
    defenseRating: Math.round(getDefenseRating(buildings, village.townHallLevel)),
    vaultProtectionPct: getVaultProtection(buildings),
    layout,
    buildings,
    troops,
    user: village.user
      ? {
          id: village.user.id,
          username: village.user.username,
          usernameColor: village.user.usernameColor,
          profilePicture: village.user.profilePicture,
        }
      : null,
  };
}

async function ensureVillage(db: PrismaClient | Prisma.TransactionClient, userId: string) {
  const existing = await db.clashVillage.findUnique({ where: { userId } });
  if (existing) return existing;

  const buildings = createDefaultBuildings();
  const created = await db.clashVillage.create({
    data: {
      userId,
      townHallLevel: 1,
      moneyInStorage: 900,
      trophies: 100,
      layoutJson: JSON.stringify(createDefaultLayout(buildings)),
      buildingsJson: JSON.stringify(buildings),
      troopsJson: JSON.stringify(createDefaultTroops()),
    },
  });

  await db.clashActivity.create({
    data: {
      villageId: created.id,
      type: 'SYSTEM',
      title: 'Village fondé',
      detail: 'Ton village Clash est prêt à être amélioré et défendu.',
    },
  });

  return created;
}

async function fetchVillageState(userId: string) {
  const village = await ensureVillage(prisma, userId);
  const [withUser, activities, attacks, defenses] = await Promise.all([
    prisma.clashVillage.findUnique({
      where: { id: village.id },
      include: {
        user: {
          select: { id: true, username: true, usernameColor: true, profilePicture: true },
        },
      },
    }),
    prisma.clashActivity.findMany({
      where: { villageId: village.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    prisma.clashBattle.findMany({
      where: { attackerUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        defender: { select: { id: true, username: true, usernameColor: true, profilePicture: true } },
      },
    }),
    prisma.clashBattle.findMany({
      where: { defenderUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        attacker: { select: { id: true, username: true, usernameColor: true, profilePicture: true } },
      },
    }),
  ]);

  if (!withUser) {
    throw new HttpError(404, 'Village introuvable');
  }

  return {
    village: serializeVillage(withUser),
    activities: activities.map((activity) => ({
      ...activity,
      createdAt: activity.createdAt.toISOString(),
    })),
    recentAttacks: attacks.map((battle) => ({
      id: battle.id,
      createdAt: battle.createdAt.toISOString(),
      opponent: battle.defender,
      destructionPercent: battle.destructionPercent,
      moneyStolen: battle.moneyStolen,
      trophiesDelta: battle.trophiesDeltaAttacker,
      result: safeJsonParse<Record<string, unknown>>(battle.resultJson, {}),
    })),
    recentDefenses: defenses.map((battle) => ({
      id: battle.id,
      createdAt: battle.createdAt.toISOString(),
      opponent: battle.attacker,
      destructionPercent: battle.destructionPercent,
      moneyStolen: battle.moneyStolen,
      trophiesDelta: battle.trophiesDeltaDefender,
      result: safeJsonParse<Record<string, unknown>>(battle.resultJson, {}),
    })),
  };
}

router.post('/bootstrap', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await ensureVillage(prisma, req.user!.id);
    res.json(await fetchVillageState(req.user!.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to bootstrap clash village';
    res.status(500).json({ error: message });
  }
});

router.get('/state', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    res.json(await fetchVillageState(req.user!.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load clash state';
    res.status(500).json({ error: message });
  }
});

router.post('/upgrade', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { buildingType } = upgradeSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const village = await ensureVillage(tx, req.user!.id);
      const user = await tx.user.findUnique({ where: { id: req.user!.id }, select: { id: true, username: true, money: true } });
      if (!user) throw new HttpError(404, 'Utilisateur introuvable');

      const buildings = parseBuildings(village.buildingsJson);
      const target = getBuilding(buildings, buildingType);
      if (!target) throw new HttpError(400, 'Bâtiment introuvable');

      const cost = getUpgradeCost(buildingType, target.level);
      if (user.money < cost) {
        throw new HttpError(400, 'Argent insuffisant pour cette amélioration');
      }

      target.level += 1;
      target.maxHp = buildingMaxHp(target.type, target.level);
      target.hp = target.maxHp;
      if (target.type === 'goldStorage') target.storageCapacity = storageCapacityForLevel(target.level);
      if (target.type === 'vault') target.protectionPct = vaultProtectionPct(target.level);
      if (target.type === 'cannon') target.defensePower = cannonDefensePower(target.level);
      if (target.type === 'wall') target.defensePower = wallDefensePower(target.level);

      const nextTownHallLevel = buildingType === 'townHall' ? target.level : village.townHallLevel;
      const maxStorage = getStorageCapacity(buildings, nextTownHallLevel);

      const updatedVillage = await tx.clashVillage.update({
        where: { id: village.id },
        data: {
          townHallLevel: nextTownHallLevel,
          buildingsJson: JSON.stringify(buildings),
          moneyInStorage: Math.min(village.moneyInStorage, maxStorage),
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { money: { decrement: cost } },
        select: { money: true },
      });

      await tx.clashActivity.create({
        data: {
          villageId: village.id,
          type: 'UPGRADE',
          title: `Amélioration ${buildingType}`,
          detail: `${buildingType} passe au niveau ${target.level}.`,
          deltaMoney: -cost,
        },
      });

      logGame('game_reward', req.user!.id, req.user!.username, {
        gameType: 'clash_village',
        action: 'upgrade',
        buildingType,
        level: target.level,
        cost,
      });

      return {
        village: updatedVillage,
        newBalance: updatedUser,
        buildingType,
        cost,
      };
    });

    const state = await fetchVillageState(req.user!.id);
    res.json({
      ...state,
      upgrade: {
        buildingType: result.buildingType,
        cost: result.cost,
        newBalance: result.newBalance,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Requête invalide' });
    }
    const message = error instanceof Error ? error.message : 'Failed to upgrade clash village';
    return res.status(500).json({ error: message });
  }
});

router.get('/matchmaking', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const village = await ensureVillage(prisma, req.user!.id);
    const now = new Date();

    const fetchCandidates = async (range: number) => prisma.clashVillage.findMany({
      where: {
        userId: { not: req.user!.id },
        moneyInStorage: { gt: 0 },
        OR: [
          { shieldUntil: null },
          { shieldUntil: { lte: now } },
        ],
        trophies: {
          gte: village.trophies - range,
          lte: village.trophies + range,
        },
      },
      include: {
        user: {
          select: { id: true, username: true, usernameColor: true, profilePicture: true },
        },
      },
      take: MATCHMAKING_TARGET_COUNT * 3,
      orderBy: { updatedAt: 'desc' },
    });

    const primary = await fetchCandidates(MATCHMAKING_PRIMARY_RANGE);
    const fallback = primary.length >= MATCHMAKING_TARGET_COUNT
      ? primary
      : await fetchCandidates(MATCHMAKING_FALLBACK_RANGE);

    const targets = fallback
      .sort((a, b) => Math.abs(a.trophies - village.trophies) - Math.abs(b.trophies - village.trophies))
      .slice(0, MATCHMAKING_TARGET_COUNT)
      .map((target) => {
        const serialized = serializeVillage(target);
        const availableLoot = Math.floor(target.moneyInStorage * STEAL_COEFFICIENT * (1 - serialized.vaultProtectionPct));
        return {
          user: serialized.user,
          village: serialized,
          availableLoot: Math.max(0, availableLoot),
        };
      });

    return res.json({ targets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load matchmaking';
    return res.status(500).json({ error: message });
  }
});

router.post('/attack', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const payload = attackSchema.parse(req.body);
    if (payload.defenderUserId === req.user!.id) {
      throw new HttpError(400, 'Impossible de s’attaquer soi-même');
    }

    const battle = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const attackerVillage = await ensureVillage(tx, req.user!.id);
      const defenderVillage = await tx.clashVillage.findUnique({
        where: { userId: payload.defenderUserId },
        include: {
          user: {
            select: { id: true, username: true, usernameColor: true, profilePicture: true },
          },
        },
      });

      if (!defenderVillage) throw new HttpError(404, 'Village cible introuvable');
      if (attackerVillage.attackCooldownUntil && attackerVillage.attackCooldownUntil > now) {
        throw new HttpError(400, 'Ton armée est encore en cooldown');
      }
      if (defenderVillage.shieldUntil && defenderVillage.shieldUntil > now) {
        throw new HttpError(400, 'Cette cible est encore protégée par un bouclier');
      }
      if (defenderVillage.moneyInStorage <= 0) {
        throw new HttpError(400, 'Cette cible n’a plus de butin disponible');
      }

      const attackerBuildings = parseBuildings(attackerVillage.buildingsJson);
      const defenderBuildings = parseBuildings(defenderVillage.buildingsJson);
      const attackerTroops = payload.attackPlan?.map((entry) => ({
        type: entry.troopType,
        count: entry.count,
      })) ?? parseTroops(attackerVillage.troopsJson);

      const destructionPercent = computeDestructionPercent({
        attackerId: req.user!.id,
        defenderId: defenderVillage.userId,
        attackerTrophies: attackerVillage.trophies,
        defenderTrophies: defenderVillage.trophies,
        townHallLevel: defenderVillage.townHallLevel,
        defenseRating: getDefenseRating(defenderBuildings, defenderVillage.townHallLevel),
        troops: attackerTroops,
      });

      const vaultProtection = getVaultProtection(defenderBuildings);
      const cappedByCurrentBalance = Math.floor(defenderVillage.moneyInStorage * STEAL_COEFFICIENT);
      const cappedByVault = Math.floor(defenderVillage.moneyInStorage * (1 - vaultProtection));
      const theoreticalLoot = Math.floor(defenderVillage.moneyInStorage * (destructionPercent / 100) * STEAL_COEFFICIENT);
      const moneyStolen = Math.max(0, Math.min(theoreticalLoot, cappedByCurrentBalance, cappedByVault, defenderVillage.moneyInStorage));
      const trophyDelta = getTrophyDelta(destructionPercent);
      const destroyedBuildings = getDestroyedBuildings(defenderBuildings, destructionPercent);
      const result = {
        result: trophyDelta.result,
        troops: attackerTroops,
        destroyedBuildings: destroyedBuildings.map((building) => ({
          id: building.id,
          type: building.type,
          level: building.level,
        })),
      };

      const updatedAttackerVillage = await tx.clashVillage.update({
        where: { id: attackerVillage.id },
        data: {
          moneyInStorage: { increment: moneyStolen },
          trophies: { increment: trophyDelta.attacker },
          attackCooldownUntil: addMinutes(now, ATTACK_COOLDOWN_MINUTES),
        },
      });

      const updatedDefenderVillage = await tx.clashVillage.update({
        where: { id: defenderVillage.id },
        data: {
          moneyInStorage: { decrement: moneyStolen },
          trophies: { increment: trophyDelta.defender },
          shieldUntil: addMinutes(now, DEFENDER_SHIELD_MINUTES),
        },
      });

      const createdBattle = await tx.clashBattle.create({
        data: {
          attackerUserId: req.user!.id,
          defenderUserId: payload.defenderUserId,
          destructionPercent,
          moneyStolen,
          trophiesDeltaAttacker: trophyDelta.attacker,
          trophiesDeltaDefender: trophyDelta.defender,
          resultJson: JSON.stringify(result),
        },
      });

      await tx.clashActivity.createMany({
        data: [
          {
            villageId: attackerVillage.id,
            type: trophyDelta.attacker > 0 ? 'ATTACK_WIN' : 'ATTACK_LOSS',
            title: trophyDelta.attacker > 0 ? 'Raid réussi' : 'Raid raté',
            detail: `Tu as infligé ${destructionPercent}% de destruction à ${defenderVillage.user.username}.`,
            deltaMoney: moneyStolen,
            deltaTrophies: trophyDelta.attacker,
            relatedUserId: defenderVillage.userId,
          },
          {
            villageId: defenderVillage.id,
            type: 'DEFENSE',
            title: 'Village attaqué',
            detail: `${req.user!.username} a infligé ${destructionPercent}% de destruction.`,
            deltaMoney: -moneyStolen,
            deltaTrophies: trophyDelta.defender,
            relatedUserId: req.user!.id,
          },
          {
            villageId: defenderVillage.id,
            type: 'SHIELD',
            title: 'Bouclier activé',
            detail: `Protection défensive active pendant ${DEFENDER_SHIELD_MINUTES} minutes.`,
            relatedUserId: req.user!.id,
          },
          {
            villageId: attackerVillage.id,
            type: 'COOLDOWN',
            title: 'Armée en récupération',
            detail: `Prochaine attaque disponible dans ${ATTACK_COOLDOWN_MINUTES} minutes.`,
            relatedUserId: defenderVillage.userId,
          },
        ],
      });

      return {
        battle: createdBattle,
        attackerVillage: updatedAttackerVillage,
        defenderVillage: updatedDefenderVillage,
        defenderUser: defenderVillage.user,
        result,
      };
    });

    void createNotification({
      userId: payload.defenderUserId,
      type: 'SYSTEM',
      title: 'Village attaqué',
      body: `${req.user!.username} a pillé ${battle.battle.moneyStolen.toLocaleString('fr-FR')} money et causé ${battle.battle.destructionPercent}% de destruction.`,
      link: '/games/clash-village',
      icon: 'Swords',
      data: {
        attackerUserId: req.user!.id,
        attackerUsername: req.user!.username,
        moneyStolen: battle.battle.moneyStolen,
        destructionPercent: battle.battle.destructionPercent,
      },
    }).catch(() => undefined);

    logGame('game_complete', req.user!.id, req.user!.username, {
      gameType: 'clash_village',
      mode: 'attack',
      defenderUserId: payload.defenderUserId,
      moneyStolen: battle.battle.moneyStolen,
      destructionPercent: battle.battle.destructionPercent,
    });

    const [state, defenderSummary] = await Promise.all([
      fetchVillageState(req.user!.id),
      prisma.clashVillage.findUnique({
        where: { userId: payload.defenderUserId },
        include: {
          user: {
            select: { id: true, username: true, usernameColor: true, profilePicture: true },
          },
        },
      }),
    ]);

    return res.json({
      ...state,
      attack: {
        id: battle.battle.id,
        createdAt: battle.battle.createdAt.toISOString(),
        defender: defenderSummary ? serializeVillage(defenderSummary) : null,
        destructionPercent: battle.battle.destructionPercent,
        moneyStolen: battle.battle.moneyStolen,
        trophiesDeltaAttacker: battle.battle.trophiesDeltaAttacker,
        trophiesDeltaDefender: battle.battle.trophiesDeltaDefender,
        result: battle.result,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Requête invalide' });
    }
    const message = error instanceof Error ? error.message : 'Failed to resolve attack';
    return res.status(500).json({ error: message });
  }
});

router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await ensureVillage(prisma, req.user!.id);
    const [attacks, defenses, activities] = await Promise.all([
      prisma.clashBattle.findMany({
        where: { attackerUserId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          defender: { select: { id: true, username: true, usernameColor: true, profilePicture: true } },
        },
      }),
      prisma.clashBattle.findMany({
        where: { defenderUserId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          attacker: { select: { id: true, username: true, usernameColor: true, profilePicture: true } },
        },
      }),
      prisma.clashActivity.findMany({
        where: {
          village: { userId: req.user!.id },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    return res.json({
      attacks: attacks.map((battle) => ({
        id: battle.id,
        createdAt: battle.createdAt.toISOString(),
        opponent: battle.defender,
        destructionPercent: battle.destructionPercent,
        moneyStolen: battle.moneyStolen,
        trophiesDelta: battle.trophiesDeltaAttacker,
        result: safeJsonParse<Record<string, unknown>>(battle.resultJson, {}),
      })),
      defenses: defenses.map((battle) => ({
        id: battle.id,
        createdAt: battle.createdAt.toISOString(),
        opponent: battle.attacker,
        destructionPercent: battle.destructionPercent,
        moneyStolen: battle.moneyStolen,
        trophiesDelta: battle.trophiesDeltaDefender,
        result: safeJsonParse<Record<string, unknown>>(battle.resultJson, {}),
      })),
      activities: activities.map((activity) => ({
        ...activity,
        createdAt: activity.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load clash history';
    return res.status(500).json({ error: message });
  }
});

router.get('/leaderboard', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const [topTrophies, villages, allBattles] = await Promise.all([
      prisma.clashVillage.findMany({
        include: {
          user: {
            select: { id: true, username: true, usernameColor: true, profilePicture: true },
          },
        },
        orderBy: [{ trophies: 'desc' }, { moneyInStorage: 'desc' }],
        take: 20,
      }),
      prisma.clashVillage.findMany({
        include: {
          user: {
            select: { id: true, username: true, usernameColor: true, profilePicture: true },
          },
        },
      }),
      prisma.clashBattle.findMany(),
    ]);

    const lootByUser = new Map<string, number>();
    const defenseByUser = new Map<string, { total: number; count: number }>();

    for (const battle of allBattles) {
      lootByUser.set(battle.attackerUserId, (lootByUser.get(battle.attackerUserId) ?? 0) + battle.moneyStolen);
      const previous = defenseByUser.get(battle.defenderUserId) ?? { total: 0, count: 0 };
      defenseByUser.set(battle.defenderUserId, {
        total: previous.total + (100 - battle.destructionPercent),
        count: previous.count + 1,
      });
    }

    const serializedVillages = villages.map((village) => serializeVillage(village));

    return res.json({
      trophies: topTrophies.map((village, index) => ({
        rank: index + 1,
        user: serializeVillage(village).user,
        trophies: village.trophies,
        moneyInStorage: village.moneyInStorage,
        townHallLevel: village.townHallLevel,
      })),
      loot: serializedVillages
        .map((village) => ({
          user: village.user,
          totalLoot: lootByUser.get(village.user?.id ?? '') ?? 0,
          trophies: village.trophies,
        }))
        .sort((a, b) => b.totalLoot - a.totalLoot)
        .slice(0, 20)
        .map((entry, index) => ({ ...entry, rank: index + 1 })),
      defense: serializedVillages
        .map((village) => {
          const defense = defenseByUser.get(village.user?.id ?? '');
          return {
            user: village.user,
            averageDefense: defense ? Math.round((defense.total / defense.count) * 10) / 10 : null,
            defenseCount: defense?.count ?? 0,
            trophies: village.trophies,
          };
        })
        .filter((entry) => entry.averageDefense !== null)
        .sort((a, b) => (b.averageDefense ?? 0) - (a.averageDefense ?? 0))
        .slice(0, 20)
        .map((entry, index) => ({ ...entry, rank: index + 1 })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load clash leaderboard';
    return res.status(500).json({ error: message });
  }
});

export default router;
