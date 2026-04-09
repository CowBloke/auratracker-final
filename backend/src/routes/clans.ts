import { Prisma } from '@prisma/client';
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { io, prisma } from '../server.js';
import { createNotification, emitNotificationUpdated } from '../utils/notifications.js';
import { recheckBadgeForCondition } from '../utils/badgeAwards.js';
import {
  buildClanEffectActivation,
  CLAN_EFFECT_GAME_MONEY_BOOST,
  isClanGameMoneyBoostEffect,
  parseClanEffectPayload,
  serializeClanEffect,
} from '../utils/clanEffects.js';
import {
  getFeaturedClanEvent,
  submitClanEventMiniGame,
  trackClanEventActivity,
} from '../utils/clanEvents.js';
import { isAllowedImageUrl } from '../utils/uploads.js';

const router = Router();

const CLAN_CREATE_COST = 100;
const CLAN_MAX_MEMBERS = 5;
const CLAN_WAR_PREPARATION_HOURS = 12;
const CLAN_WAR_DURATION_HOURS = 24 * 7;
const CLAN_WAR_TARGET_SCORE = 180;
const CLAN_WAR_MIN_MEMBERS = 3;
const CLAN_WAR_STAMINA_PER_24H = 3;
const CLAN_WAR_FORTIFICATIONS_PER_MEMBER = 2;
const CLAN_WAR_HISTORY_LIMIT = 5;
const CLAN_WAR_STARTING_TROPHIES = 1000;
const CLAN_WAR_MIN_TROPHIES = 0;
const NATION_WEEKLY_BOOST_PRICE = 150000;
const BLACK_MARKET_WEAPONS = {
  PISTOL: { label: 'Pistolet', price: 500000, disabledSlots: 1, penaltyPoints: 12 },
  AK: { label: 'AK K7', price: 1000000, disabledSlots: 2, penaltyPoints: 24 },
  SNIPER: { label: 'Sniper', price: 1500000, disabledSlots: 3, penaltyPoints: 36 },
} as const;
const NATION_TERRITORIES = [
  { key: 'paris-fr', label: 'Paris', region: 'Europe', x: 50, y: 26, bonus: 'Influence commerciale' },
  { key: 'madrid-es', label: 'Madrid', region: 'Europe', x: 45, y: 31, bonus: 'Réseaux discrets' },
  { key: 'rome-it', label: 'Rome', region: 'Europe', x: 53, y: 33, bonus: 'Prestige historique' },
  { key: 'berlin-de', label: 'Berlin', region: 'Europe', x: 53, y: 23, bonus: 'Discipline logistique' },
  { key: 'london-uk', label: 'Londres', region: 'Europe', x: 44, y: 20, bonus: 'Finance offshore' },
  { key: 'stockholm-se', label: 'Stockholm', region: 'Europe', x: 56, y: 14, bonus: 'Technologie froide' },
  { key: 'warsaw-pl', label: 'Varsovie', region: 'Europe', x: 58, y: 22, bonus: 'Solidité militaire' },
  { key: 'istanbul-tr', label: 'Istanbul', region: 'Europe', x: 61, y: 31, bonus: 'Pont des marchés' },
  { key: 'newyork-us', label: 'New York', region: 'Amérique du Nord', x: 23, y: 25, bonus: 'Capitaux massifs' },
  { key: 'miami-us', label: 'Miami', region: 'Amérique du Nord', x: 20, y: 35, bonus: 'Transit clandestin' },
  { key: 'losangeles-us', label: 'Los Angeles', region: 'Amérique du Nord', x: 7, y: 30, bonus: 'Industrie médiatique' },
  { key: 'mexicocity-mx', label: 'Mexico', region: 'Amérique du Nord', x: 12, y: 39, bonus: 'Flux frontaliers' },
  { key: 'toronto-ca', label: 'Toronto', region: 'Amérique du Nord', x: 19, y: 22, bonus: 'Réserve de talents' },
  { key: 'bogota-co', label: 'Bogota', region: 'Amérique du Sud', x: 24, y: 49, bonus: 'Routes andines' },
  { key: 'lima-pe', label: 'Lima', region: 'Amérique du Sud', x: 18, y: 59, bonus: 'Contrôle côtier' },
  { key: 'saopaulo-br', label: 'São Paulo', region: 'Amérique du Sud', x: 30, y: 63, bonus: 'Marché géant' },
  { key: 'buenosaires-ar', label: 'Buenos Aires', region: 'Amérique du Sud', x: 28, y: 75, bonus: 'Pression du sud' },
  { key: 'casablanca-ma', label: 'Casablanca', region: 'Afrique', x: 44, y: 39, bonus: 'Accès atlantique' },
  { key: 'lagos-ng', label: 'Lagos', region: 'Afrique', x: 50, y: 54, bonus: 'Croissance explosive' },
  { key: 'nairobi-ke', label: 'Nairobi', region: 'Afrique', x: 58, y: 58, bonus: 'Corridors est-africains' },
  { key: 'johannesburg-za', label: 'Johannesburg', region: 'Afrique', x: 57, y: 78, bonus: 'Mainmise minière' },
  { key: 'dubai-ae', label: 'Dubaï', region: 'Moyen-Orient', x: 67, y: 40, bonus: 'Liquidités rapides' },
  { key: 'riyadh-sa', label: 'Riyad', region: 'Moyen-Orient', x: 64, y: 44, bonus: 'Influence énergétique' },
  { key: 'mumbai-in', label: 'Mumbai', region: 'Asie', x: 73, y: 47, bonus: 'Hub industriel' },
  { key: 'delhi-in', label: 'Delhi', region: 'Asie', x: 76, y: 40, bonus: 'Poids démographique' },
  { key: 'bangkok-th', label: 'Bangkok', region: 'Asie', x: 82, y: 50, bonus: 'Réseaux gris' },
  { key: 'singapore-sg', label: 'Singapour', region: 'Asie', x: 85, y: 58, bonus: 'Port stratégique' },
  { key: 'hongkong-cn', label: 'Hong Kong', region: 'Asie', x: 86, y: 42, bonus: 'Trading agressif' },
  { key: 'tokyo-jp', label: 'Tokyo', region: 'Asie', x: 94, y: 33, bonus: 'Puissance technologique' },
  { key: 'seoul-kr', label: 'Séoul', region: 'Asie', x: 91, y: 31, bonus: 'Coordination tactique' },
  { key: 'sydney-au', label: 'Sydney', region: 'Océanie', x: 92, y: 77, bonus: 'Expansion pacifique' },
  { key: 'auckland-nz', label: 'Auckland', region: 'Océanie', x: 98, y: 84, bonus: 'Repli sécurisé' },
] as const;

const parseNotificationData = (rawData: string | null) => {
  if (!rawData) return null;
  try {
    const parsed = JSON.parse(rawData);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const clanMemberUserSelect = {
  id: true,
  username: true,
  aura: true,
  usernameColor: true,
  profilePicture: true,
} satisfies Prisma.UserSelect;

const clanLeaderSelect = {
  id: true,
  username: true,
  usernameColor: true,
  profilePicture: true,
} satisfies Prisma.UserSelect;

const clanSummaryInclude = Prisma.validator<Prisma.ClanInclude>()({
  members: {
    include: {
      user: {
        select: clanMemberUserSelect,
      },
    },
  },
  owner: {
    select: clanLeaderSelect,
  },
});

const clanDetailInclude = Prisma.validator<Prisma.ClanInclude>()({
  members: {
    include: {
      user: {
        select: clanMemberUserSelect,
      },
    },
    orderBy: {
      user: { aura: 'desc' },
    },
  },
  owner: {
    select: clanLeaderSelect,
  },
  joinRequests: {
    include: {
      user: {
        select: clanMemberUserSelect,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
});

const currentWarInclude = Prisma.validator<Prisma.ClanWarInclude>()({
  attackerClan: {
    include: clanSummaryInclude,
  },
  defenderClan: {
    include: clanSummaryInclude,
  },
  winnerClan: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
  },
  winnerUser: {
    select: clanLeaderSelect,
  },
  attacks: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
      attackingClan: {
        select: {
          id: true,
          name: true,
        },
      },
      targetClan: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  defenses: {
    orderBy: [{ clanId: 'asc' }, { type: 'asc' }],
  },
  fortifications: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
      defense: {
        select: {
          id: true,
          type: true,
          clanId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  gameLogs: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
    },
    orderBy: {
      playedAt: 'desc',
    },
  },
  navalShots: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
});

const historyWarInclude = Prisma.validator<Prisma.ClanWarInclude>()({
  attackerClan: {
    include: clanSummaryInclude,
  },
  defenderClan: {
    include: clanSummaryInclude,
  },
  winnerClan: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
  },
  winnerUser: {
    select: clanLeaderSelect,
  },
  attacks: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
      attackingClan: {
        select: {
          id: true,
          name: true,
        },
      },
      targetClan: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  defenses: true,
  fortifications: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
      defense: {
        select: {
          id: true,
          type: true,
          clanId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  gameLogs: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
    },
    orderBy: {
      playedAt: 'desc',
    },
  },
  navalShots: {
    include: {
      user: {
        select: clanLeaderSelect,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
});

type ClanWithMembers = Prisma.ClanGetPayload<{ include: typeof clanSummaryInclude }>;
type ClanDetailPayload = Prisma.ClanGetPayload<{ include: typeof clanDetailInclude }>;
type ClanWarCurrentPayload = Prisma.ClanWarGetPayload<{ include: typeof currentWarInclude }>;
type ClanWarHistoryPayload = Prisma.ClanWarGetPayload<{ include: typeof historyWarInclude }>;
type ClanBankContributionPayload = Prisma.ClanBankContributionGetPayload<{
  include: {
    user: {
      select: typeof clanLeaderSelect;
    };
  };
}>;

type DefenseType = 'FORTRESS' | 'ARMORY' | 'BANNER';
type AttackType = 'RAID' | 'SIEGE' | 'SABOTAGE';

const defenseConfig: Record<DefenseType, {
  label: string;
  description: string;
  baseDurability: number;
  durabilityPerLevel: number;
}> = {
  FORTRESS: {
    label: 'Forteresse',
    description: 'Réduit les points des bombardements ennemis (-4 pts/niveau).',
    baseDurability: 60,
    durabilityPerLevel: 18,
  },
  ARMORY: {
    label: 'Armurerie',
    description: 'Augmente vos points de bombardement (+3 pts/niveau).',
    baseDurability: 48,
    durabilityPerLevel: 16,
  },
  BANNER: {
    label: 'Bannière',
    description: 'Booste vos points de tirs navals (+2 pts/niveau).',
    baseDurability: 42,
    durabilityPerLevel: 14,
  },
};

const attackConfig: Record<AttackType, {
  label: string;
  description: string;
  staminaCost: number;
  minPoints: number;
  maxPoints: number;
  structureDamage: number;
}> = {
  RAID: {
    label: 'Raid eclair',
    description: 'Attaque rapide et reguliere.',
    staminaCost: 1,
    minPoints: 18,
    maxPoints: 28,
    structureDamage: 10,
  },
  SIEGE: {
    label: 'Siege lourd',
    description: 'Lent mais ideal pour casser les lignes defensives.',
    staminaCost: 2,
    minPoints: 30,
    maxPoints: 44,
    structureDamage: 18,
  },
  SABOTAGE: {
    label: 'Sabotage',
    description: 'Frappe precise contre les structures ennemies.',
    staminaCost: 1,
    minPoints: 16,
    maxPoints: 24,
    structureDamage: 22,
  },
};

const getDefenseTypes = (): DefenseType[] => ['FORTRESS', 'ARMORY', 'BANNER'];
const getAttackTypes = (): AttackType[] => ['RAID', 'SIEGE', 'SABOTAGE'];

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000);
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRollingWindowStart = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
const getTrophyGap = (a: number, b: number) => Math.abs(a - b);
const getWeekKey = (date = new Date()) => {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};
const safeJsonParse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};
const serializeNationLayer = (clan: {
  nationTier: number;
  hierarchyName: string;
  influence: number;
  intimidation: number;
  marketControl: number;
  territoryKey: string;
  nationFlag: string;
  alliancesJson: string;
  allianceRequestsJson: string;
  arsenalJson: string;
  injuriesJson: string;
}) => ({
  tier: clan.nationTier,
  hierarchyName: clan.hierarchyName,
  influence: clan.influence,
  intimidation: clan.intimidation,
  marketControl: clan.marketControl,
  territoryKey: clan.territoryKey,
  territory: NATION_TERRITORIES.find((entry) => entry.key === clan.territoryKey) ?? NATION_TERRITORIES[0],
  flag: safeJsonParse<{ primary: string; secondary: string; accent: string; pattern: string; icon: string }>(
    clan.nationFlag,
    { primary: '#1d4ed8', secondary: '#f8fafc', accent: '#dc2626', pattern: 'tricolor', icon: 'star' }
  ),
  alliances: safeJsonParse<Array<{ clanId: string; name: string; status: 'ALLY' | 'BROKEN'; forgedAt: string; betrayedAt?: string | null }>>(clan.alliancesJson, []),
  allianceRequests: safeJsonParse<Array<{ clanId: string; name: string; requestedAt: string }>>(clan.allianceRequestsJson, []),
  arsenal: safeJsonParse<Record<string, number>>(clan.arsenalJson, { PISTOL: 0, AK: 0, SNIPER: 0 }),
  injuries: safeJsonParse<Array<{ userId: string; username: string; severity: number; createdAt: string }>>(clan.injuriesJson, []),
  blackMarketCatalog: Object.entries(BLACK_MARKET_WEAPONS).map(([key, value]) => ({ key, ...value })),
  territories: NATION_TERRITORIES,
});

const getWarMarginBonus = (scoreGap: number) => {
  if (scoreGap >= 90) return 18;
  if (scoreGap >= 65) return 14;
  if (scoreGap >= 40) return 10;
  if (scoreGap >= 20) return 6;
  if (scoreGap >= 10) return 3;
  return 0;
};

const calculateClanWarTrophyChanges = ({
  attackerScore,
  defenderScore,
  attackerTrophies,
  defenderTrophies,
}: {
  attackerScore: number;
  defenderScore: number;
  attackerTrophies: number;
  defenderTrophies: number;
}) => {
  const scoreGap = Math.abs(attackerScore - defenderScore);
  const marginBonus = getWarMarginBonus(scoreGap);

  if (attackerScore === defenderScore) {
    const diff = attackerTrophies - defenderTrophies;
    if (Math.abs(diff) < 50) {
      return {
        attackerChange: 0,
        defenderChange: 0,
      };
    }

    const swing = clamp(4 + Math.floor(Math.abs(diff) / 125), 4, 12);
    return diff > 0
      ? { attackerChange: -swing, defenderChange: swing }
      : { attackerChange: swing, defenderChange: -swing };
  }

  const attackerWon = attackerScore > defenderScore;
  const winnerTrophies = attackerWon ? attackerTrophies : defenderTrophies;
  const loserTrophies = attackerWon ? defenderTrophies : attackerTrophies;
  const trophyDiff = loserTrophies - winnerTrophies;
  const upsetBonus = trophyDiff > 0 ? clamp(Math.floor(trophyDiff / 40), 0, 16) : 0;
  const protection = trophyDiff < 0 ? clamp(Math.floor(Math.abs(trophyDiff) / 55), 0, 10) : 0;

  const winnerGain = 22 + marginBonus + upsetBonus;
  const loserLoss = clamp(16 + Math.floor(marginBonus * 0.8) - protection, 6, 32);

  return attackerWon
    ? { attackerChange: winnerGain, defenderChange: -loserLoss }
    : { attackerChange: -loserLoss, defenderChange: winnerGain };
};

const getDefenseMaxDurability = (type: DefenseType, level: number) =>
  defenseConfig[type].baseDurability + Math.max(0, level - 1) * defenseConfig[type].durabilityPerLevel;

const isDefenseType = (value: string): value is DefenseType => getDefenseTypes().includes(value as DefenseType);
const isAttackType = (value: string): value is AttackType => getAttackTypes().includes(value as AttackType);

const getClanTotalAura = (clan: ClanWithMembers | ClanDetailPayload) =>
  clan.members.reduce((sum, member) => sum + member.user.aura, BigInt(0));

const hasClanSlotUpgrade = (clan: { maxMembers: number; slotUpgraded?: boolean | null }) =>
  (clan.slotUpgraded ?? false) || clan.maxMembers > CLAN_MAX_MEMBERS;

const mapClanSummary = (clan: ClanWithMembers | ClanDetailPayload) => ({
  id: clan.id,
  name: clan.name,
  description: clan.description,
  imageUrl: clan.imageUrl,
  banner: clan.banner ?? null,
  isPublic: clan.isPublic,
  maxMembers: clan.maxMembers,
  memberCount: clan.members.length,
  totalAura: getClanTotalAura(clan),
  createdAt: clan.createdAt,
  leader: clan.owner,
  tagUnlocked: clan.tagUnlocked,
  tagText: clan.tagText ?? null,
  tagStyle: clan.tagStyle ?? null,
  slotUpgraded: hasClanSlotUpgrade(clan),
  warTrophies: clan.warTrophies,
  warWins: clan.warWins,
  warLosses: clan.warLosses,
  warDraws: clan.warDraws,
  clanBankMoney: clan.clanBankMoney,
  nation: serializeNationLayer(clan),
});

const mapClanOwnedItem = (entry: {
  id: string;
  quantity: number;
  acquiredAt: Date;
  item: {
    id: string;
    name: string;
    description: string;
    type: string;
    price: number;
    imageUrl: string | null;
    effect: string | null;
  };
}) => ({
  id: entry.id,
  quantity: entry.quantity,
  acquiredAt: entry.acquiredAt,
  item: entry.item,
});

const mapClanBankContribution = (entry: ClanBankContributionPayload) => ({
  id: entry.id,
  amount: entry.amount,
  createdAt: entry.createdAt,
  user: entry.user,
});

const getClanDefenseLevel = (defenses: ClanWarCurrentPayload['defenses'] | ClanWarHistoryPayload['defenses'], clanId: string, type: DefenseType) => {
  const defense = defenses.find((entry) => entry.clanId === clanId && entry.type === type && entry.durability > 0);
  return defense?.level ?? 0;
};

const selectDefenseTarget = (
  attackType: AttackType,
  defenses: ClanWarCurrentPayload['defenses'],
  targetClanId: string
) => {
  const activeDefenses = defenses
    .filter((entry) => entry.clanId === targetClanId && entry.durability > 0)
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.durability - a.durability;
    });

  if (activeDefenses.length === 0) {
    return null;
  }

  if (attackType === 'SIEGE') {
    return activeDefenses.find((entry) => entry.type === 'FORTRESS') ?? activeDefenses[0];
  }

  if (attackType === 'SABOTAGE') {
    return activeDefenses.find((entry) => entry.type === 'ARMORY')
      ?? activeDefenses.find((entry) => entry.type === 'BANNER')
      ?? activeDefenses[0];
  }

  return activeDefenses[0];
};

const mapWarDefenseState = (
  war: ClanWarCurrentPayload | ClanWarHistoryPayload,
  clanId: string
) =>
  getDefenseTypes().map((type) => {
    const defense = war.defenses.find((entry) => entry.clanId === clanId && entry.type === type) ?? null;
    const contributions = war.fortifications.filter((entry) => entry.clanId === clanId && entry.defense.type === type).length;

    return {
      type,
      label: defenseConfig[type].label,
      description: defenseConfig[type].description,
      level: defense?.level ?? 0,
      durability: defense?.durability ?? 0,
      maxDurability: defense?.maxDurability ?? 0,
      isActive: Boolean(defense && defense.durability > 0),
      contributions,
    };
  });

const mapWarScoreClan = (clan: ClanWithMembers) => ({
  ...mapClanSummary(clan),
});

const mapWarParticipantStats = (
  war: ClanWarCurrentPayload | ClanWarHistoryPayload
) => {
  const memberStats = new Map<string, {
    user: {
      id: string;
      username: string;
      usernameColor: string | null;
      profilePicture: string | null;
    };
    clanId: string;
    clanName: string;
    attackCount: number;
    attackPoints: number;
    staminaSpent: number;
    fortificationsUsed: number;
    fortificationLevelsAdded: number;
    fortificationDurabilityAdded: number;
    memoryRuns: number;
    bombRuns: number;
    bombPoints: number;
    navalShotsUsed: number;
    navalHits: number;
    navalPoints: number;
  }>();

  const upsertMember = (
    clanId: string,
    clanName: string,
    user: {
      id: string;
      username: string;
      usernameColor: string | null;
      profilePicture: string | null;
    }
  ) => {
    const existing = memberStats.get(user.id);
    if (existing) return existing;

    const created = {
      user,
      clanId,
      clanName,
      attackCount: 0,
      attackPoints: 0,
      staminaSpent: 0,
      fortificationsUsed: 0,
      fortificationLevelsAdded: 0,
      fortificationDurabilityAdded: 0,
      memoryRuns: 0,
      bombRuns: 0,
      bombPoints: 0,
      navalShotsUsed: 0,
      navalHits: 0,
      navalPoints: 0,
    };
    memberStats.set(user.id, created);
    return created;
  };

  for (const member of war.attackerClan.members) {
    upsertMember(war.attackerClan.id, war.attackerClan.name, member.user);
  }

  for (const member of war.defenderClan.members) {
    upsertMember(war.defenderClan.id, war.defenderClan.name, member.user);
  }

  for (const attack of war.attacks) {
    const stats = upsertMember(attack.clanId, attack.attackingClan.name, attack.user);
    stats.attackCount += 1;
    stats.attackPoints += attack.finalPoints;
    stats.staminaSpent += attack.staminaCost;
  }

  for (const fortification of war.fortifications) {
    const clanName = fortification.clanId === war.attackerClanId ? war.attackerClan.name : war.defenderClan.name;
    const stats = upsertMember(fortification.clanId, clanName, fortification.user);
    stats.fortificationsUsed += 1;
    stats.fortificationLevelsAdded += fortification.levelAdded;
    stats.fortificationDurabilityAdded += fortification.durabilityAdded;
  }

  for (const gameLog of war.gameLogs) {
    const clanName = gameLog.clanId === war.attackerClanId ? war.attackerClan.name : war.defenderClan.name;
    const stats = upsertMember(gameLog.clanId, clanName, gameLog.user);
    if (gameLog.gameType === 'MEMORY') {
      stats.memoryRuns += 1;
    }
    if (gameLog.gameType === 'BOMB') {
      stats.bombRuns += 1;
      stats.bombPoints += gameLog.pointsAwarded;
    }
  }

  for (const shot of war.navalShots) {
    const clanName = shot.clanId === war.attackerClanId ? war.attackerClan.name : war.defenderClan.name;
    const stats = upsertMember(shot.clanId, clanName, shot.user);
    stats.navalShotsUsed += 1;
    if (shot.isHit) {
      stats.navalHits += 1;
    }
    stats.navalPoints += shot.points;
  }

  const normalizeMember = (entry: typeof memberStats extends Map<string, infer T> ? T : never) => ({
    user: entry.user,
    clanId: entry.clanId,
    clanName: entry.clanName,
    attackCount: entry.attackCount,
    attackPoints: entry.attackPoints,
    staminaSpent: entry.staminaSpent,
    fortificationsUsed: entry.fortificationsUsed,
    fortificationLevelsAdded: entry.fortificationLevelsAdded,
    fortificationDurabilityAdded: entry.fortificationDurabilityAdded,
    memoryRuns: entry.memoryRuns,
    bombRuns: entry.bombRuns,
    bombPoints: entry.bombPoints,
    navalShotsUsed: entry.navalShotsUsed,
    navalHits: entry.navalHits,
    navalPoints: entry.navalPoints,
    totalCombatPoints: entry.attackPoints,
    totalSupportActions: entry.fortificationsUsed,
    hasCompletedCombat: entry.attackCount > 0 || entry.bombRuns > 0 || entry.navalShotsUsed > 0,
    hasCompletedSupport: entry.memoryRuns > 0 || entry.fortificationsUsed > 0,
  });

  const members = [...memberStats.values()].map(normalizeMember);
  const sortMembers = (items: typeof members) =>
    [...items].sort((a, b) => {
      if (b.totalCombatPoints !== a.totalCombatPoints) return b.totalCombatPoints - a.totalCombatPoints;
      if (b.fortificationLevelsAdded !== a.fortificationLevelsAdded) return b.fortificationLevelsAdded - a.fortificationLevelsAdded;
      if (b.navalHits !== a.navalHits) return b.navalHits - a.navalHits;
      return a.user.username.localeCompare(b.user.username, 'fr');
    });

  return {
    attacker: sortMembers(members.filter((entry) => entry.clanId === war.attackerClanId)),
    defender: sortMembers(members.filter((entry) => entry.clanId === war.defenderClanId)),
  };
};

const mapWar = async (
  war: ClanWarCurrentPayload | ClanWarHistoryPayload,
  viewerClanId: string | null,
  viewerUserId: string | null
) => {
  const isViewerAttacker = viewerClanId === war.attackerClanId;
  const viewerScore = isViewerAttacker ? war.attackerScore : war.defenderScore;
  const opponentScore = isViewerAttacker ? war.defenderScore : war.attackerScore;

  let staminaUsed = 0;
  let fortificationsUsed = 0;

  if (viewerUserId) {
    staminaUsed = war.attacks
      .filter((entry) => entry.userId === viewerUserId && entry.createdAt >= getRollingWindowStart(24))
      .reduce((sum, entry) => sum + entry.staminaCost, 0);
    fortificationsUsed = war.fortifications.filter((entry) => entry.userId === viewerUserId).length;
  }

  const participantStats = mapWarParticipantStats(war);

  return {
    id: war.id,
    status: war.status,
    startsAt: war.startsAt,
    endsAt: war.endsAt,
    completedAt: war.completedAt,
    targetScore: war.targetScore,
    attackerScore: war.attackerScore,
    defenderScore: war.defenderScore,
    scoreGap: Math.abs(war.attackerScore - war.defenderScore),
    trophyChanges: {
      attacker: war.attackerTrophyChange,
      defender: war.defenderTrophyChange,
    },
    viewerSide: viewerClanId
      ? isViewerAttacker
        ? 'ATTACKER'
        : viewerClanId === war.defenderClanId
          ? 'DEFENDER'
          : 'SPECTATOR'
      : 'SPECTATOR',
    viewerScore,
    opponentScore,
    attackerClan: mapWarScoreClan(war.attackerClan),
    defenderClan: mapWarScoreClan(war.defenderClan),
    winnerClan: war.winnerClan,
    winnerUser: war.winnerUser,
    rewardTable: {
      winner: {
        money: war.winnerRewardMoney,
        aura: war.winnerRewardAura,
        trophies: war.winnerClanId === null
          ? 0
          : war.winnerClanId === war.attackerClanId
            ? war.attackerTrophyChange
            : war.defenderTrophyChange,
      },
      loser: {
        money: war.loserRewardMoney,
        aura: war.loserRewardAura,
        trophies: war.winnerClanId === null
          ? Math.min(war.attackerTrophyChange, war.defenderTrophyChange)
          : war.winnerClanId === war.attackerClanId
            ? war.defenderTrophyChange
            : war.attackerTrophyChange,
      },
    },
    nationWar: {
      weekKey: war.declaredWeekKey ?? getWeekKey(war.createdAt),
      boosts: {
        attacker: war.attackerBoostMoney,
        defender: war.defenderBoostMoney,
      },
      penalties: {
        attacker: war.attackerPenaltyPoints,
        defender: war.defenderPenaltyPoints,
      },
      disabledSlots: {
        attacker: war.attackerDisabledSlots,
        defender: war.defenderDisabledSlots,
      },
      winnerBy: 'weekly_score',
    },
    defenses: {
      attacker: mapWarDefenseState(war, war.attackerClanId),
      defender: mapWarDefenseState(war, war.defenderClanId),
    },
    participantStats,
    viewerActions: {
      staminaCap: CLAN_WAR_STAMINA_PER_24H,
      staminaUsed,
      staminaRemaining: Math.max(0, CLAN_WAR_STAMINA_PER_24H - staminaUsed),
      fortificationsCap: CLAN_WAR_FORTIFICATIONS_PER_MEMBER,
      fortificationsUsed,
      fortificationsRemaining: Math.max(0, CLAN_WAR_FORTIFICATIONS_PER_MEMBER - fortificationsUsed),
    },
    recentAttacks: war.attacks.slice(0, war.status === 'COMPLETED' ? 8 : 20).map((attack) => ({
      id: attack.id,
      attackType: attack.attackType,
      attackLabel: attackConfig[attack.attackType as AttackType]?.label ?? attack.attackType,
      user: attack.user,
      attackingClan: attack.attackingClan,
      targetClan: attack.targetClan,
      staminaCost: attack.staminaCost,
      basePoints: attack.basePoints,
      bonusPoints: attack.bonusPoints,
      defenseMitigation: attack.defenseMitigation,
      structureDamage: attack.structureDamage,
      finalPoints: attack.finalPoints,
      createdAt: attack.createdAt,
    })),
    recentFortifications: war.fortifications.slice(0, war.status === 'COMPLETED' ? 12 : 30).map((entry) => ({
      id: entry.id,
      user: entry.user,
      clanId: entry.clanId,
      defenseType: entry.defense.type,
      defenseLabel: defenseConfig[entry.defense.type as DefenseType]?.label ?? entry.defense.type,
      levelAdded: entry.levelAdded,
      durabilityAdded: entry.durabilityAdded,
      createdAt: entry.createdAt,
    })),
  };
};

const getCurrentWarForClan = async (clanId: string) =>
  prisma.clanWar.findFirst({
    where: {
      status: {
        in: ['PREPARING', 'ACTIVE'],
      },
      OR: [
        { attackerClanId: clanId },
        { defenderClanId: clanId },
      ],
    },
    include: currentWarInclude,
    orderBy: {
      createdAt: 'desc',
    },
  });

const getClanCooldownEndsAt = async (clanId: string) => {
  return null;
};

const getClosestWarOpponents = async (clanId: string) => {
  const sourceClan = await prisma.clan.findUnique({
    where: { id: clanId },
    include: clanSummaryInclude,
  });

  if (!sourceClan) {
    return {
      sourceClan: null,
      opponents: [],
      closestGap: null,
    };
  }

  const clans = await prisma.clan.findMany({
    where: {
      id: { not: clanId },
    },
    include: clanSummaryInclude,
    orderBy: [
      { warTrophies: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  const availableCandidates: Array<ReturnType<typeof mapClanSummary> & { trophyGap: number }> = [];

  for (const candidate of clans) {
    if (candidate.members.length < CLAN_WAR_MIN_MEMBERS) continue;

    const [activeWar, cooldownEndsAt] = await Promise.all([
      getCurrentWarForClan(candidate.id),
      getClanCooldownEndsAt(candidate.id),
    ]);

    if (activeWar || cooldownEndsAt) continue;

    availableCandidates.push({
      ...mapClanSummary(candidate),
      trophyGap: getTrophyGap(sourceClan.warTrophies, candidate.warTrophies),
    });
  }

  if (availableCandidates.length === 0) {
    return {
      sourceClan,
      opponents: [],
      closestGap: null,
    };
  }

  const closestGap = Math.min(...availableCandidates.map((candidate) => candidate.trophyGap));
  const opponents = availableCandidates
    .filter((candidate) => candidate.trophyGap === closestGap)
    .sort((a, b) => {
      if (a.warTrophies !== b.warTrophies) {
        return a.warTrophies - b.warTrophies;
      }
      return a.name.localeCompare(b.name, 'fr');
    });

  return {
    sourceClan,
    opponents,
    closestGap,
  };
};

const notifyClanMembers = async (userIds: string[], payload: Omit<Parameters<typeof createNotification>[0], 'userId'>) => {
  await Promise.allSettled(
    userIds.map((userId) => createNotification({ userId, ...payload }))
  );
};

const finalizeClanWar = async (warId: string) => {
  const now = new Date();
  const war = await prisma.clanWar.findUnique({
    where: { id: warId },
    include: {
      attackerClan: {
        include: {
          members: true,
        },
      },
      defenderClan: {
        include: {
          members: true,
        },
      },
      attacks: {
        select: {
          userId: true,
          clanId: true,
          finalPoints: true,
        },
      },
    },
  });

  if (!war || war.status === 'COMPLETED' || war.status === 'CANCELLED') {
    return;
  }

  const effectiveAttackerScore = war.attackerScore + war.attackerBoostMoney - war.attackerPenaltyPoints;
  const effectiveDefenderScore = war.defenderScore + war.defenderBoostMoney - war.defenderPenaltyPoints;
  const attackerWon = effectiveAttackerScore > effectiveDefenderScore;
  const defenderWon = effectiveDefenderScore > effectiveAttackerScore;
  const winnerClanId = attackerWon ? war.attackerClanId : defenderWon ? war.defenderClanId : null;
  const trophyChanges = calculateClanWarTrophyChanges({
    attackerScore: effectiveAttackerScore,
    defenderScore: effectiveDefenderScore,
    attackerTrophies: war.attackerTrophiesBefore,
    defenderTrophies: war.defenderTrophiesBefore,
  });

  const winnerContribution = new Map<string, number>();
  for (const attack of war.attacks) {
    if (attack.clanId !== winnerClanId) continue;
    winnerContribution.set(attack.userId, (winnerContribution.get(attack.userId) ?? 0) + attack.finalPoints);
  }

  const winnerUserId = winnerClanId
    ? [...winnerContribution.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const attackerRewardMoney = winnerClanId === war.attackerClanId ? war.winnerRewardMoney : war.loserRewardMoney;
  const defenderRewardMoney = winnerClanId === war.defenderClanId ? war.winnerRewardMoney : war.loserRewardMoney;
  const attackerRewardAura = winnerClanId === war.attackerClanId ? war.winnerRewardAura : war.loserRewardAura;
  const defenderRewardAura = winnerClanId === war.defenderClanId ? war.winnerRewardAura : war.loserRewardAura;

  await prisma.$transaction(async (tx) => {
    await tx.clanWar.update({
      where: { id: war.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        winnerClanId,
        winnerUserId,
        attackerTrophyChange: trophyChanges.attackerChange,
        defenderTrophyChange: trophyChanges.defenderChange,
      },
    });

    await tx.clan.update({
      where: { id: war.attackerClanId },
      data: {
        warTrophies: Math.max(CLAN_WAR_MIN_TROPHIES, war.attackerTrophiesBefore + trophyChanges.attackerChange),
        warWins: { increment: attackerWon ? 1 : 0 },
        warLosses: { increment: defenderWon ? 1 : 0 },
        warDraws: { increment: winnerClanId ? 0 : 1 },
      },
    });

    await tx.clan.update({
      where: { id: war.defenderClanId },
      data: {
        warTrophies: Math.max(CLAN_WAR_MIN_TROPHIES, war.defenderTrophiesBefore + trophyChanges.defenderChange),
        warWins: { increment: defenderWon ? 1 : 0 },
        warLosses: { increment: attackerWon ? 1 : 0 },
        warDraws: { increment: winnerClanId ? 0 : 1 },
      },
    });

    for (const member of war.attackerClan.members) {
      await tx.user.update({
        where: { id: member.userId },
        data: {
          money: { increment: attackerRewardMoney },
          aura: { increment: BigInt(attackerRewardAura) },
        },
      });
    }

    for (const member of war.defenderClan.members) {
      await tx.user.update({
        where: { id: member.userId },
        data: {
          money: { increment: defenderRewardMoney },
          aura: { increment: BigInt(defenderRewardAura) },
        },
      });
    }

    if (winnerClanId) {
      const loserClan = winnerClanId === war.attackerClanId ? war.defenderClan : war.attackerClan;
      const severityBase = clamp(Math.ceil(Math.abs(effectiveAttackerScore - effectiveDefenderScore) / 30), 1, 4);
      const injuryPayload = loserClan.members.slice(0, 6).map((member, index) => ({
        userId: member.userId,
        username: `Membre ${index + 1}`,
        severity: clamp(severityBase + (index % 2), 1, 5),
        createdAt: now.toISOString(),
      }));
      await tx.clan.update({
        where: { id: loserClan.id },
        data: {
          injuriesJson: JSON.stringify(injuryPayload),
          intimidation: { increment: 4 },
        },
      });
      await tx.clan.update({
        where: { id: winnerClanId },
        data: {
          influence: { increment: 6 },
          marketControl: { increment: 5 },
        },
      });
    }
  });

  // Recheck clan war achievement badges now that this war is completed
  void recheckBadgeForCondition('CLAN_WARS_10');
  void recheckBadgeForCondition('CLAN_MVP_3');

  const attackerMemberIds = war.attackerClan.members.map((member) => member.userId);
  const defenderMemberIds = war.defenderClan.members.map((member) => member.userId);
  const winnerName = winnerClanId === war.attackerClanId
    ? war.attackerClan.name
    : winnerClanId === war.defenderClanId
      ? war.defenderClan.name
      : null;

  if (!winnerClanId) {
    await Promise.allSettled([
      notifyClanMembers(attackerMemberIds, {
        type: 'CLAN_WAR_COMPLETED',
        title: 'Guerre terminee',
        body: `Le conflit contre ${war.defenderClan.name} se termine sur une egalite (${trophyChanges.attackerChange >= 0 ? '+' : ''}${trophyChanges.attackerChange} trophées).`,
        data: { warId: war.id, clanId: war.attackerClanId },
        link: '/clans',
        icon: 'swords',
      }),
      notifyClanMembers(defenderMemberIds, {
        type: 'CLAN_WAR_COMPLETED',
        title: 'Guerre terminee',
        body: `Le conflit contre ${war.attackerClan.name} se termine sur une egalite (${trophyChanges.defenderChange >= 0 ? '+' : ''}${trophyChanges.defenderChange} trophées).`,
        data: { warId: war.id, clanId: war.defenderClanId },
        link: '/clans',
        icon: 'swords',
      }),
    ]);
    return;
  }

  await Promise.allSettled([
    notifyClanMembers(winnerClanId === war.attackerClanId ? attackerMemberIds : defenderMemberIds, {
      type: 'CLAN_WAR_WON',
      title: 'Victoire de clan',
      body: `${winnerName} remporte la guerre et gagne ${winnerClanId === war.attackerClanId ? trophyChanges.attackerChange : trophyChanges.defenderChange} trophées.`,
      data: { warId: war.id, clanId: winnerClanId },
      link: '/clans',
      icon: 'trophy',
    }),
    notifyClanMembers(winnerClanId === war.attackerClanId ? defenderMemberIds : attackerMemberIds, {
      type: 'CLAN_WAR_LOST',
      title: 'Défaite de clan',
      body: `${winnerName} a remporté la guerre. Votre clan perd ${Math.abs(winnerClanId === war.attackerClanId ? trophyChanges.defenderChange : trophyChanges.attackerChange)} trophées.`,
      data: { warId: war.id, clanId: winnerClanId },
      link: '/clans',
      icon: 'shield',
    }),
  ]);
};

export const advanceClanWarsState = async () => {
  const now = new Date();

  const warsToActivate = await prisma.clanWar.findMany({
    where: {
      status: 'PREPARING',
    },
    select: {
      id: true,
    },
  });

  if (warsToActivate.length > 0) {
    await prisma.clanWar.updateMany({
      where: {
        id: {
          in: warsToActivate.map((war) => war.id),
        },
      },
      data: {
        status: 'ACTIVE',
      },
    });
  }

  const warsToComplete = await prisma.clanWar.findMany({
    where: {
      status: {
        in: ['PREPARING', 'ACTIVE'],
      },
      OR: [
        { endsAt: { lte: now } },
        { attackerScore: { gte: CLAN_WAR_TARGET_SCORE } },
        { defenderScore: { gte: CLAN_WAR_TARGET_SCORE } },
      ],
    },
    select: {
      id: true,
    },
  });

  for (const war of warsToComplete) {
    await finalizeClanWar(war.id);
  }
};

const getEligibleOpponents = async (clanId: string) => {
  const { opponents, closestGap } = await getClosestWarOpponents(clanId);
  return {
    opponents,
    closestGap,
  };
};

const getClanMembership = (clanId: string, userId: string) =>
  prisma.clanMember.findUnique({
    where: {
      clanId_userId: {
        clanId,
        userId,
      },
    },
    select: {
      clanId: true,
      userId: true,
      isLeader: true,
    },
  });

// Get viewer's clan upgrade status (for shop page)
router.get('/me/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.json({ inClan: false, tagUnlocked: false, slotUpgraded: false, maxMembers: 0, clanBankMoney: 0 });

    const membership = await prisma.clanMember.findUnique({
      where: { userId },
      select: { clanId: true, isLeader: true },
    });

    if (!membership) return res.json({ inClan: false, tagUnlocked: false, slotUpgraded: false, maxMembers: 0, clanBankMoney: 0 });

    const clan = await prisma.clan.findUnique({
      where: { id: membership.clanId },
      select: { tagUnlocked: true, slotUpgraded: true, maxMembers: true, clanBankMoney: true },
    });

    res.json({
      inClan: true,
      isLeader: membership.isLeader,
      tagUnlocked: clan?.tagUnlocked ?? false,
      slotUpgraded: clan ? hasClanSlotUpgrade(clan) : false,
      maxMembers: clan?.maxMembers ?? 0,
      clanBankMoney: clan?.clanBankMoney ?? 0,
    });
  } catch (error) {
    console.error('Get clan status error:', error);
    res.status(500).json({ error: 'Failed to get clan status' });
  }
});

router.get('/events/featured', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const selectedClanId = typeof req.query.clanId === 'string' ? req.query.clanId : null;
    const event = await getFeaturedClanEvent(selectedClanId, req.user?.id ?? null);
    res.json({ event });
  } catch (error) {
    console.error('Get featured clan event error:', error);
    res.status(500).json({ error: 'Failed to get clan event' });
  }
});

router.post('/events/:eventId/minigames/:miniGameId/submit', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { eventId, miniGameId } = req.params;
    const rawScore = Number(req.body?.rawScore);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Number.isFinite(rawScore) || rawScore < 0) {
      return res.status(400).json({ error: 'Score invalide.' });
    }

    const result = await submitClanEventMiniGame({
      eventId,
      miniGameId,
      userId,
      rawScore,
    });

    res.json({
      success: true,
      result: {
        ...result,
        nextAvailableAt: result.nextAvailableAt ? result.nextAvailableAt.toISOString() : null,
      },
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to submit clan event mini-game';
    const status = /Unauthorized|introuvable|actif|recharge|tentatives|clan/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

// Deposit personal money into clan bank (members only)
router.post('/:id/bank/deposit', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const amount = Number(req.body?.amount);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const membership = await tx.clanMember.findUnique({
        where: {
          clanId_userId: {
            clanId: id,
            userId,
          },
        },
        select: {
          clanId: true,
        },
      });

      if (!membership) {
        throw new Error('NOT_MEMBER');
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { money: true },
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      if (user.money < amount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const [updatedUser, updatedClan] = await Promise.all([
        tx.user.update({
          where: { id: userId },
          data: {
            money: { decrement: amount },
          },
          select: {
            money: true,
            aura: true,
          },
        }),
        tx.clan.update({
          where: { id },
          data: {
            clanBankMoney: { increment: amount },
          },
          select: {
            clanBankMoney: true,
          },
        }),
        tx.clanBankContribution.create({
          data: {
            clanId: id,
            userId,
            amount,
          },
        }),
      ]);

      return {
        updatedUser,
        clanBankMoney: updatedClan.clanBankMoney,
      };
    });

    void trackClanEventActivity(userId, 'CLAN_BANK_DEPOSIT', amount, {
      clanId: id,
      amount,
    });

    res.json({
      success: true,
      deposited: amount,
      clanBankMoney: result.clanBankMoney,
      newBalance: {
        money: result.updatedUser.money,
        aura: result.updatedUser.aura,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_MEMBER') {
        return res.status(403).json({ error: 'Tu dois être membre du clan pour déposer.' });
      }
      if (error.message === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: 'Pas assez d\'argent.' });
      }
    }
    console.error('Clan bank deposit error:', error);
    res.status(500).json({ error: 'Failed to deposit to clan bank' });
  }
});

// Get all clans
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();

    const userId = req.user?.id;
    const [clans, membership, activeWars] = await Promise.all([
      prisma.clan.findMany({
        include: clanSummaryInclude,
        orderBy: { createdAt: 'desc' },
      }),
      userId
        ? prisma.clanMember.findUnique({
            where: { userId },
            select: { clanId: true, isLeader: true },
          })
        : null,
      prisma.clanWar.findMany({
        where: {
          status: {
            in: ['PREPARING', 'ACTIVE'],
          },
        },
        include: currentWarInclude,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    res.json({
      clans: clans.map(mapClanSummary),
      meta: {
        viewerClanId: membership?.clanId ?? null,
        viewerIsClanLeader: membership?.isLeader ?? false,
        activeWars: await Promise.all(activeWars.map((war) => mapWar(war, membership?.clanId ?? null, userId ?? null))),
      },
    });
  } catch (error) {
    console.error('Get clans error:', error);
    res.status(500).json({ error: 'Failed to get clans' });
  }
});

// Global completed clan wars history (all-time)
router.get('/wars/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();

    const userId = req.user?.id ?? null;
    const wars = await prisma.clanWar.findMany({
      where: {
        status: 'COMPLETED',
      },
      include: historyWarInclude,
      orderBy: {
        completedAt: 'desc',
      },
    });

    res.json({
      wars: await Promise.all(wars.map((war) => mapWar(war, null, userId))),
    });
  } catch (error) {
    console.error('Get global clan wars history error:', error);
    res.status(500).json({ error: 'Failed to get global clan wars history' });
  }
});

// Get clan detail
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();

    const { id } = req.params;
    const userId = req.user?.id ?? null;

    const clan = await prisma.clan.findUnique({
      where: { id },
      include: clanDetailInclude,
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    const isMember = clan.members.some((member) => member.userId === userId);
    const isLeader = clan.members.some((member) => member.userId === userId && member.isLeader);

    const [pendingRequest, currentWar, warHistory, cooldownEndsAt, eligibleOpponentsResult, clanOwnedItems, clanEffects, clanBankContributions] = await Promise.all([
      userId
        ? prisma.clanJoinRequest.findUnique({
            where: {
              clanId_userId: {
                clanId: clan.id,
                userId,
              },
            },
            select: { id: true },
          })
        : null,
      getCurrentWarForClan(clan.id),
      prisma.clanWar.findMany({
        where: {
          status: 'COMPLETED',
          OR: [{ attackerClanId: clan.id }, { defenderClanId: clan.id }],
        },
        include: historyWarInclude,
        orderBy: {
          completedAt: 'desc',
        },
        take: CLAN_WAR_HISTORY_LIMIT,
      }),
      getClanCooldownEndsAt(clan.id),
      isLeader ? getEligibleOpponents(clan.id) : Promise.resolve({ opponents: [], closestGap: null }),
      prisma.clanOwnedItem.findMany({
        where: { clanId: clan.id, quantity: { gt: 0 } },
        include: { item: true },
        orderBy: { acquiredAt: 'desc' },
      }),
      prisma.clanEffect.findMany({
        where: {
          clanId: clan.id,
          activeUntil: { gt: new Date() },
        },
        orderBy: [{ activeUntil: 'desc' }],
      }),
      prisma.clanBankContribution.findMany({
        where: { clanId: clan.id },
        include: {
          user: {
            select: clanLeaderSelect,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      }),
    ]);

    res.json({
      clan: {
        ...mapClanSummary(clan),
        members: clan.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          username: member.user.username,
          usernameColor: member.user.usernameColor,
          aura: member.user.aura,
          profilePicture: member.user.profilePicture,
          joinedAt: member.joinedAt,
          isLeader: member.isLeader,
        })),
        joinRequests: isLeader
          ? clan.joinRequests.map((request) => ({
              id: request.id,
              userId: request.userId,
              username: request.user.username,
              usernameColor: request.user.usernameColor,
              aura: request.user.aura,
              profilePicture: request.user.profilePicture,
              requestedAt: request.createdAt,
            }))
          : [],
        viewer: {
          isMember,
          isLeader,
          hasPendingRequest: Boolean(pendingRequest),
        },
        bankContributionHistory: isMember ? clanBankContributions.map(mapClanBankContribution) : [],
        ownedItems: isMember ? clanOwnedItems.map(mapClanOwnedItem) : [],
        activeEffects: isMember ? clanEffects.map(serializeClanEffect) : [],
        warHub: {
          currentWar: currentWar ? await mapWar(currentWar, isMember ? clan.id : null, userId) : null,
          history: await Promise.all(warHistory.map((war) => mapWar(war, isMember ? clan.id : null, userId))),
          eligibleOpponents: eligibleOpponentsResult.opponents,
          closestTrophyGap: eligibleOpponentsResult.closestGap,
          cooldownEndsAt,
          canDeclareWar: isLeader
            && clan.members.length >= CLAN_WAR_MIN_MEMBERS
            && !currentWar
            && !cooldownEndsAt
            && eligibleOpponentsResult.opponents.length > 0,
          minimumMembersRequired: CLAN_WAR_MIN_MEMBERS,
          attackTypes: getAttackTypes().map((type) => ({
            type,
            ...attackConfig[type],
          })),
          defenseTypes: getDefenseTypes().map((type) => ({
            type,
            ...defenseConfig[type],
            maxLevel: 3,
          })),
        },
        nationHub: {
          canManageAlliances: isLeader,
          canUseBlackMarket: isMember,
          weeklyWarCadenceDays: 7,
          weeklyBoostPrice: NATION_WEEKLY_BOOST_PRICE,
          blackMarketCatalog: Object.entries(BLACK_MARKET_WEAPONS).map(([key, value]) => ({ key, ...value })),
          mapTerritories: NATION_TERRITORIES,
        },
      },
    });
  } catch (error) {
    console.error('Get clan error:', error);
    res.status(500).json({ error: 'Failed to get clan' });
  }
});

router.post('/:id/nation/alliances/request', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const targetClanId = typeof req.body.targetClanId === 'string' ? req.body.targetClanId : '';
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!targetClanId || targetClanId === id) return res.status(400).json({ error: 'Nation cible invalide.' });

    const [leader, sourceClan, targetClan] = await Promise.all([
      prisma.clanMember.findUnique({ where: { clanId_userId: { clanId: id, userId } }, select: { isLeader: true } }),
      prisma.clan.findUnique({ where: { id }, select: { id: true, name: true, allianceRequestsJson: true, alliancesJson: true } }),
      prisma.clan.findUnique({ where: { id: targetClanId }, select: { id: true, name: true, allianceRequestsJson: true } }),
    ]);
    if (!leader?.isLeader || !sourceClan || !targetClan) return res.status(403).json({ error: 'Action interdite.' });

    const requests = safeJsonParse<Array<{ clanId: string; name: string; requestedAt: string }>>(targetClan.allianceRequestsJson, []);
    if (!requests.some((entry) => entry.clanId === id)) {
      requests.push({ clanId: id, name: sourceClan.name, requestedAt: new Date().toISOString() });
      await prisma.clan.update({
        where: { id: targetClanId },
        data: { allianceRequestsJson: JSON.stringify(requests) },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Nation alliance request error:', error);
    res.status(500).json({ error: 'Impossible d envoyer la demande d alliance.' });
  }
});

router.post('/:id/nation/alliances/respond', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const requestClanId = typeof req.body.requestClanId === 'string' ? req.body.requestClanId : '';
    const decision = req.body.decision === 'accept' ? 'accept' : 'reject';
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [leader, clan, requestClan] = await Promise.all([
      prisma.clanMember.findUnique({ where: { clanId_userId: { clanId: id, userId } }, select: { isLeader: true } }),
      prisma.clan.findUnique({ where: { id }, select: { id: true, name: true, allianceRequestsJson: true, alliancesJson: true } }),
      prisma.clan.findUnique({ where: { id: requestClanId }, select: { id: true, name: true, alliancesJson: true } }),
    ]);
    if (!leader?.isLeader || !clan || !requestClan) return res.status(403).json({ error: 'Action interdite.' });

    const pending = safeJsonParse<Array<{ clanId: string; name: string; requestedAt: string }>>(clan.allianceRequestsJson, []);
    const remaining = pending.filter((entry) => entry.clanId !== requestClanId);
    const updates: Promise<unknown>[] = [
      prisma.clan.update({ where: { id }, data: { allianceRequestsJson: JSON.stringify(remaining) } }),
    ];

    if (decision === 'accept') {
      const forgedAt = new Date().toISOString();
      const sourceAlliances = safeJsonParse<Array<{ clanId: string; name: string; status: 'ALLY' | 'BROKEN'; forgedAt: string }>>(clan.alliancesJson, []);
      const targetAlliances = safeJsonParse<Array<{ clanId: string; name: string; status: 'ALLY' | 'BROKEN'; forgedAt: string }>>(requestClan.alliancesJson, []);
      if (!sourceAlliances.some((entry) => entry.clanId === requestClanId)) {
        sourceAlliances.push({ clanId: requestClanId, name: requestClan.name, status: 'ALLY', forgedAt });
      }
      if (!targetAlliances.some((entry) => entry.clanId === id)) {
        targetAlliances.push({ clanId: id, name: clan.name, status: 'ALLY', forgedAt });
      }
      updates.push(
        prisma.clan.update({ where: { id }, data: { alliancesJson: JSON.stringify(sourceAlliances) } }),
        prisma.clan.update({ where: { id: requestClanId }, data: { alliancesJson: JSON.stringify(targetAlliances) } }),
      );
    }

    await Promise.all(updates);
    res.json({ success: true });
  } catch (error) {
    console.error('Nation alliance respond error:', error);
    res.status(500).json({ error: 'Impossible de traiter cette alliance.' });
  }
});

router.post('/:id/nation/alliances/betray', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const allyClanId = typeof req.body.allyClanId === 'string' ? req.body.allyClanId : '';
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const leader = await prisma.clanMember.findUnique({ where: { clanId_userId: { clanId: id, userId } }, select: { isLeader: true } });
    if (!leader?.isLeader) return res.status(403).json({ error: 'Seul le chef peut trahir une alliance.' });

    const [clan, ally] = await Promise.all([
      prisma.clan.findUnique({ where: { id }, select: { alliancesJson: true, influence: true, intimidation: true } }),
      prisma.clan.findUnique({ where: { id: allyClanId }, select: { alliancesJson: true, influence: true, intimidation: true } }),
    ]);
    if (!clan || !ally) return res.status(404).json({ error: 'Alliance introuvable.' });

    const betrayedAt = new Date().toISOString();
    const updateEntries = (value: string, targetId: string) =>
      safeJsonParse<Array<{ clanId: string; name: string; status: 'ALLY' | 'BROKEN'; forgedAt: string; betrayedAt?: string }>>(value, [])
        .map((entry) => entry.clanId === targetId ? { ...entry, status: 'BROKEN' as const, betrayedAt } : entry);

    await Promise.all([
      prisma.clan.update({ where: { id }, data: { alliancesJson: JSON.stringify(updateEntries(clan.alliancesJson, allyClanId)), intimidation: { increment: 8 } } }),
      prisma.clan.update({ where: { id: allyClanId }, data: { alliancesJson: JSON.stringify(updateEntries(ally.alliancesJson, id)), influence: { decrement: 4 } } }),
    ]);

    res.json({ success: true, betrayedAt });
  } catch (error) {
    console.error('Nation betrayal error:', error);
    res.status(500).json({ error: 'Impossible de trahir cette alliance.' });
  }
});

router.post('/:id/nation/black-market/buy', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();
    const { id } = req.params;
    const userId = req.user?.id;
    const itemKey = typeof req.body.itemKey === 'string' ? req.body.itemKey.toUpperCase() : '';
    const targetClanId = typeof req.body.targetClanId === 'string' ? req.body.targetClanId : null;
    const boost = Boolean(req.body.boost);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!(itemKey in BLACK_MARKET_WEAPONS)) return res.status(400).json({ error: 'Arme de marche noir invalide.' });

    const membership = await prisma.clanMember.findUnique({ where: { clanId_userId: { clanId: id, userId } }, select: { userId: true } });
    const clan = await prisma.clan.findUnique({ where: { id }, select: { clanBankMoney: true, arsenalJson: true } });
    if (!membership || !clan) return res.status(403).json({ error: 'Acces refuse.' });

    const weapon = BLACK_MARKET_WEAPONS[itemKey as keyof typeof BLACK_MARKET_WEAPONS];
    if (boost) {
      if (clan.clanBankMoney < NATION_WEEKLY_BOOST_PRICE) {
        return res.status(400).json({ error: 'Banque de nation insuffisante pour booster la semaine.' });
      }
      const war = await getCurrentWarForClan(id);
      if (!war) return res.status(400).json({ error: 'Aucune guerre active pour booster votre score.' });
      const field = war.attackerClanId === id ? 'attackerBoostMoney' : 'defenderBoostMoney';
      await prisma.$transaction([
        prisma.clan.update({ where: { id }, data: { clanBankMoney: { decrement: NATION_WEEKLY_BOOST_PRICE } } }),
        prisma.clanWar.update({ where: { id: war.id }, data: { [field]: { increment: 20 } } as never }),
      ]);
      return res.json({ success: true, type: 'boost' });
    }

    if (clan.clanBankMoney < weapon.price) {
      return res.status(400).json({ error: 'Banque de nation insuffisante.' });
    }

    const arsenal = safeJsonParse<Record<string, number>>(clan.arsenalJson, { PISTOL: 0, AK: 0, SNIPER: 0 });
    arsenal[itemKey] = (arsenal[itemKey] ?? 0) + 1;

    const txs: Promise<unknown>[] = [
      prisma.clan.update({
        where: { id },
        data: {
          clanBankMoney: { decrement: weapon.price },
          arsenalJson: JSON.stringify(arsenal),
          intimidation: { increment: weapon.disabledSlots * 2 },
        },
      }),
    ];

    const war = targetClanId ? await getCurrentWarForClan(id) : null;
    if (war && targetClanId && (war.attackerClanId === targetClanId || war.defenderClanId === targetClanId)) {
      const disabledField = war.attackerClanId === targetClanId ? 'attackerDisabledSlots' : 'defenderDisabledSlots';
      const penaltyField = war.attackerClanId === targetClanId ? 'attackerPenaltyPoints' : 'defenderPenaltyPoints';
      txs.push(prisma.clanWar.update({
        where: { id: war.id },
        data: {
          [disabledField]: { increment: weapon.disabledSlots },
          [penaltyField]: { increment: weapon.penaltyPoints },
        } as never,
      }));
    }

    await Promise.all(txs);
    res.json({ success: true, itemKey, weapon });
  } catch (error) {
    console.error('Nation black market error:', error);
    res.status(500).json({ error: 'Impossible de finaliser cette operation du marche noir.' });
  }
});

router.put('/:id/nation/foundation', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const territoryKey = typeof req.body.territoryKey === 'string' ? req.body.territoryKey : '';
    const flag = typeof req.body.flag === 'object' && req.body.flag ? req.body.flag as Record<string, string> : null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const leader = await prisma.clanMember.findUnique({
      where: { clanId_userId: { clanId: id, userId } },
      select: { isLeader: true },
    });
    if (!leader?.isLeader) {
      return res.status(403).json({ error: 'Seul le chef peut fonder la nation.' });
    }

    const territory = NATION_TERRITORIES.find((entry) => entry.key === territoryKey);
    if (!territory) {
      return res.status(400).json({ error: 'Territoire invalide.' });
    }

    const occupied = await prisma.clan.findFirst({
      where: {
        territoryKey,
        id: { not: id },
      },
      select: { id: true, name: true },
    });
    if (occupied) {
      return res.status(400).json({ error: `${occupied.name} occupe deja ce territoire.` });
    }

    const nextFlag = {
      primary: typeof flag?.primary === 'string' ? flag.primary : '#1d4ed8',
      secondary: typeof flag?.secondary === 'string' ? flag.secondary : '#f8fafc',
      accent: typeof flag?.accent === 'string' ? flag.accent : '#dc2626',
      pattern: typeof flag?.pattern === 'string' ? flag.pattern : 'tricolor',
      icon: typeof flag?.icon === 'string' ? flag.icon : 'star',
    };

    await prisma.clan.update({
      where: { id },
      data: {
        territoryKey,
        nationFlag: JSON.stringify(nextFlag),
      },
    });

    res.json({ success: true, territory, flag: nextFlag });
  } catch (error) {
    console.error('Nation foundation error:', error);
    res.status(500).json({ error: 'Impossible de mettre a jour le territoire ou le drapeau.' });
  }
});

router.post('/:id/items/:clanItemId/use', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id: clanId, clanItemId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const membership = await prisma.clanMember.findUnique({
      where: { userId },
      select: { clanId: true, isLeader: true },
    });

    if (!membership || membership.clanId !== clanId) {
      return res.status(403).json({ error: 'Tu dois appartenir à ce clan.' });
    }

    if (!membership.isLeader) {
      return res.status(403).json({ error: 'Seul le chef du clan peut utiliser cette amélioration.' });
    }

    const clanItem = await prisma.clanOwnedItem.findUnique({
      where: { id: clanItemId },
      include: { item: true },
    });

    if (!clanItem || clanItem.clanId !== clanId || clanItem.quantity <= 0) {
      return res.status(404).json({ error: 'Objet de clan introuvable.' });
    }

    // Clan image items: set either the clan emblem or the clan banner.
    let parsedEffect: { type?: string } | null = null;
    try { parsedEffect = clanItem.item.effect ? JSON.parse(clanItem.item.effect) : null; } catch {}

    if (parsedEffect?.type === 'CLAN_BANNER' || parsedEffect?.type === 'CLAN_PROFILE_PICTURE') {
      const { imageUrl } = req.body;
      if (!imageUrl || typeof imageUrl !== 'string') {
        return res.status(400).json({
          error: parsedEffect.type === 'CLAN_BANNER'
            ? 'Une URL d\'image est requise pour la bannière.'
            : 'Une URL d\'image est requise pour la photo de profil du clan.',
        });
      }
      if (!isAllowedImageUrl(imageUrl)) {
        return res.status(400).json({ error: 'URL d\'image invalide.' });
      }
      const trimmedImageUrl = imageUrl.trim();
      const clanImageField = parsedEffect.type === 'CLAN_BANNER' ? 'banner' : 'imageUrl';
      await prisma.$transaction(async (tx) => {
        await tx.clan.update({ where: { id: clanId }, data: { [clanImageField]: trimmedImageUrl } });
        if (clanItem.quantity > 1) {
          await tx.clanOwnedItem.update({ where: { id: clanItem.id }, data: { quantity: { decrement: 1 } } });
        } else {
          await tx.clanOwnedItem.delete({ where: { id: clanItem.id } });
        }
      });
      return res.json({
        success: true,
        effect: parsedEffect.type === 'CLAN_BANNER'
          ? { type: 'CLAN_BANNER', banner: trimmedImageUrl }
          : { type: 'CLAN_PROFILE_PICTURE', imageUrl: trimmedImageUrl },
      });
    }

    if (!isClanGameMoneyBoostEffect(clanItem.item.effect)) {
      return res.status(400).json({ error: 'Cet objet ne peut pas être activé depuis le clan.' });
    }

    const now = new Date();
    const payload = parseClanEffectPayload(clanItem.item.effect);
    const existingEffect = await prisma.clanEffect.findUnique({
      where: {
        clanId_type: {
          clanId,
          type: CLAN_EFFECT_GAME_MONEY_BOOST,
        },
      },
    });

    if (existingEffect?.activeUntil && existingEffect.activeUntil > now) {
      return res.status(400).json({ error: 'Le boost de gains du clan est déjà actif.' });
    }

    const activation = buildClanEffectActivation(payload, now);

    const activatedEffect = await prisma.$transaction(async (tx) => {
      if (clanItem.quantity > 1) {
        await tx.clanOwnedItem.update({
          where: { id: clanItem.id },
          data: { quantity: { decrement: 1 } },
        });
      } else {
        await tx.clanOwnedItem.delete({
          where: { id: clanItem.id },
        });
      }

      return tx.clanEffect.upsert({
        where: {
          clanId_type: {
            clanId,
            type: CLAN_EFFECT_GAME_MONEY_BOOST,
          },
        },
        create: {
          clanId,
          type: CLAN_EFFECT_GAME_MONEY_BOOST,
          name: clanItem.item.name,
          description: clanItem.item.description,
          value: activation.value,
          durationHours: activation.durationHours,
          cooldownHours: activation.cooldownHours,
          activatedAt: activation.activatedAt,
          activeUntil: activation.activeUntil,
          cooldownUntil: activation.cooldownUntil,
        },
        update: {
          name: clanItem.item.name,
          description: clanItem.item.description,
          value: activation.value,
          durationHours: activation.durationHours,
          cooldownHours: activation.cooldownHours,
          activatedAt: activation.activatedAt,
          activeUntil: activation.activeUntil,
          cooldownUntil: activation.cooldownUntil,
        },
      });
    });

    const clanMembers = await prisma.clanMember.findMany({
      where: { clanId },
      select: { userId: true },
    });

    for (const member of clanMembers) {
      io.to(`user:${member.userId}`).emit('clan:effects-updated', { clanId });
    }

    res.json({
      success: true,
      effect: serializeClanEffect(activatedEffect),
    });
  } catch (error) {
    console.error('Use clan item error:', error);
    res.status(500).json({ error: 'Impossible d\'utiliser cet objet de clan.' });
  }
});

router.get('/:id/chat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const rawLimit = Number.parseInt(String(req.query.limit ?? '50'), 10);
    const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [clan, membership] = await Promise.all([
      prisma.clan.findUnique({
        where: { id },
        select: { id: true },
      }),
      getClanMembership(id, userId),
    ]);

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    if (!membership) {
      return res.status(403).json({ error: 'Tu dois etre membre du clan pour acceder au chat.' });
    }

    const messages = await prisma.clanMessage.findMany({
      where: { clanId: id },
      include: {
        user: {
          select: clanLeaderSelect,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    res.json({
      messages: messages.reverse().map((message) => ({
        id: message.id,
        message: message.message,
        createdAt: message.createdAt,
        user: message.user,
      })),
    });
  } catch (error) {
    console.error('Get clan chat error:', error);
    res.status(500).json({ error: 'Failed to get clan chat' });
  }
});

router.post('/:id/chat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (message.length < 1 || message.length > 400) {
      return res.status(400).json({ error: 'Le message doit contenir entre 1 et 400 caracteres.' });
    }

    const [clan, membership] = await Promise.all([
      prisma.clan.findUnique({
        where: { id },
        select: { id: true },
      }),
      getClanMembership(id, userId),
    ]);

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    if (!membership) {
      return res.status(403).json({ error: 'Tu dois etre membre du clan pour ecrire dans ce chat.' });
    }

    const clanMembers = await prisma.clanMember.findMany({
      where: { clanId: id },
      select: {
        userId: true,
        user: {
          select: {
            username: true,
          },
        },
        clan: {
          select: {
            name: true,
          },
        },
      },
    });

    const createdMessage = await prisma.clanMessage.create({
      data: {
        clanId: id,
        userId,
        message,
      },
      include: {
        user: {
          select: clanLeaderSelect,
        },
      },
    });

    const messageCount = await prisma.clanMessage.count({
      where: { clanId: id },
    });

    if (messageCount > 200) {
      const oldMessages = await prisma.clanMessage.findMany({
        where: { clanId: id },
        orderBy: {
          createdAt: 'asc',
        },
        take: messageCount - 200,
        select: {
          id: true,
        },
      });

      if (oldMessages.length > 0) {
        await prisma.clanMessage.deleteMany({
          where: {
            id: {
              in: oldMessages.map((entry) => entry.id),
            },
          },
        });
      }
    }

    const sender = clanMembers.find((member) => member.userId === userId);
    const recipientIds = clanMembers
      .map((member) => member.userId)
      .filter((memberUserId) => memberUserId !== userId);

    if (sender && recipientIds.length > 0) {
      const preview = message.length > 120 ? `${message.slice(0, 117)}...` : message;

      Promise.all(
        recipientIds.map(async (recipientId) => {
          const openClanNotifications = await prisma.notification.findMany({
            where: {
              userId: recipientId,
              type: 'CLAN_MESSAGE',
              isRead: false,
              isArchived: false,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          });

          const existingClanNotification = openClanNotifications.find((notification) => {
            const data = parseNotificationData(notification.data);
            return data?.clanId === id;
          });

          if (existingClanNotification) {
            const existingData = parseNotificationData(existingClanNotification.data) ?? {};
            const existingMessageCount = typeof existingData.messageCount === 'number'
              ? existingData.messageCount
              : 1;
            const nextMessageCount = existingMessageCount + 1;

            const updated = await prisma.notification.update({
              where: { id: existingClanNotification.id },
              data: {
                title: `Nouveaux messages dans ${sender.clan.name}`,
                body: `${sender.user.username}: ${preview} (${nextMessageCount})`,
                data: JSON.stringify({
                  ...existingData,
                  clanId: id,
                  clanName: sender.clan.name,
                  senderId: userId,
                  senderUsername: sender.user.username,
                  messageId: createdMessage.id,
                  messageCount: nextMessageCount,
                }),
                link: '/clans',
                icon: 'message-square',
                createdAt: createdMessage.createdAt,
              },
            });

            emitNotificationUpdated(updated);
            return;
          }

          await createNotification({
            userId: recipientId,
            type: 'CLAN_MESSAGE',
            title: `Nouveau message dans ${sender.clan.name}`,
            body: `${sender.user.username}: ${preview}`,
            data: {
              clanId: id,
              clanName: sender.clan.name,
              senderId: userId,
              senderUsername: sender.user.username,
              messageId: createdMessage.id,
              messageCount: 1,
            },
            link: '/clans',
            icon: 'message-square',
          });
        })
      ).catch(() => {});
    }

    void trackClanEventActivity(userId, 'CLAN_CHAT_MESSAGE', 1, {
      clanId: id,
      messageId: createdMessage.id,
    });

    res.status(201).json({
      message: {
        id: createdMessage.id,
        message: createdMessage.message,
        createdAt: createdMessage.createdAt,
        user: createdMessage.user,
      },
    });
  } catch (error) {
    console.error('Create clan chat message error:', error);
    res.status(500).json({ error: 'Failed to create clan chat message' });
  }
});

// Create a clan
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rawName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const imageUrl = typeof req.body.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
    const isPublic = req.body.isPublic !== false;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (rawName.length < 3 || rawName.length > 32) {
      return res.status(400).json({ error: 'Nom de clan invalide (3-32 caracteres).' });
    }

    if (description.length > 300) {
      return res.status(400).json({ error: 'Description trop longue (max 300 caracteres).' });
    }

    const clan = await prisma.$transaction(async (tx) => {
      const [user, existingMembership] = await Promise.all([
        tx.user.findUnique({
          where: { id: userId },
          select: { money: true },
        }),
        tx.clanMember.findUnique({
          where: { userId },
          select: { id: true },
        }),
      ]);

      if (!user) throw new Error('USER_NOT_FOUND');
      if (existingMembership) throw new Error('ALREADY_IN_CLAN');
      if (user.money < CLAN_CREATE_COST) throw new Error('INSUFFICIENT_FUNDS');

      const created = await tx.clan.create({
        data: {
          name: rawName,
          description: description || null,
          imageUrl: imageUrl || null,
          isPublic,
          maxMembers: CLAN_MAX_MEMBERS,
          ownerId: userId,
          members: {
            create: {
              userId,
              isLeader: true,
            },
          },
        },
        include: clanSummaryInclude,
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          money: { decrement: CLAN_CREATE_COST },
        },
      });

      return created;
    });

    res.json({ clan: mapClanSummary(clan) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'ALREADY_IN_CLAN') {
        return res.status(400).json({ error: 'Tu es deja dans un clan.' });
      }
      if (error.message === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: 'Pas assez d\'argent pour creer un clan.' });
      }
    }
    console.error('Create clan error:', error);
    res.status(500).json({ error: 'Failed to create clans' });
  }
});

// Join or request to join a clan
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const clan = await prisma.clan.findUnique({
      where: { id },
      select: {
        id: true,
        isPublic: true,
        maxMembers: true,
      },
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    const existingMembership = await prisma.clanMember.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'Tu es deja dans un clan.' });
    }

    const memberCount = await prisma.clanMember.count({
      where: { clanId: clan.id },
    });

    if (memberCount >= clan.maxMembers) {
      return res.status(400).json({ error: 'Ce clan est complet.' });
    }

    if (clan.isPublic) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.clanMember.create({
          data: {
            clanId: clan.id,
            userId,
            isLeader: false,
          },
        });

        await tx.clanJoinRequest.deleteMany({
          where: { clanId: clan.id, userId },
        });

        return { status: 'joined' as const };
      });

      return res.json(result);
    }

    const request = await prisma.clanJoinRequest.create({
      data: {
        clanId: clan.id,
        userId,
      },
    });

    const [clanDetail, requester] = await Promise.all([
      prisma.clan.findUnique({ where: { id }, select: { name: true, ownerId: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { username: true } }),
    ]);

    if (clanDetail && requester) {
      createNotification({
        userId: clanDetail.ownerId,
        type: 'CLAN_JOIN_REQUEST',
        title: 'Demande d\'adhesion',
        body: `${requester.username} souhaite rejoindre ${clanDetail.name}.`,
        data: { requesterId: userId, requesterUsername: requester.username, clanId: id, requestId: request.id },
        link: '/clans',
        icon: 'users',
      }).catch(() => {});
    }

    res.json({ status: 'requested', requestId: request.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Demande deja envoyee.' });
    }
    console.error('Join clan error:', error);
    res.status(500).json({ error: 'Failed to join clan' });
  }
});

// Declare a clan war
router.post('/:id/war/declare', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();

    const { id } = req.params;
    const userId = req.user?.id;
    const targetClanId = typeof req.body.targetClanId === 'string' ? req.body.targetClanId : '';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!targetClanId || targetClanId === id) {
      return res.status(400).json({ error: 'Choisis un clan adverse valide.' });
    }

    const [leaderMembership, attackerClan, defenderClan, attackerWar, defenderWar, attackerCooldown, defenderCooldown, opponentSelection] = await Promise.all([
      prisma.clanMember.findUnique({
        where: {
          clanId_userId: {
            clanId: id,
            userId,
          },
        },
        select: {
          isLeader: true,
        },
      }),
      prisma.clan.findUnique({
        where: { id },
        include: clanSummaryInclude,
      }),
      prisma.clan.findUnique({
        where: { id: targetClanId },
        include: clanSummaryInclude,
      }),
      getCurrentWarForClan(id),
      getCurrentWarForClan(targetClanId),
      getClanCooldownEndsAt(id),
      getClanCooldownEndsAt(targetClanId),
      getClosestWarOpponents(id),
    ]);

    if (!leaderMembership?.isLeader) {
      return res.status(403).json({ error: 'Seul le chef peut declarer une guerre.' });
    }

    if (!attackerClan || !defenderClan) {
      return res.status(404).json({ error: 'Clan introuvable.' });
    }

    if (attackerClan.members.length < CLAN_WAR_MIN_MEMBERS || defenderClan.members.length < CLAN_WAR_MIN_MEMBERS) {
      return res.status(400).json({
        error: `Chaque clan doit avoir au moins ${CLAN_WAR_MIN_MEMBERS} membres pour entrer en guerre.`,
      });
    }

    if (attackerWar || defenderWar) {
      return res.status(400).json({ error: 'Un des deux clans est deja engage dans une guerre.' });
    }

    if (attackerCooldown || defenderCooldown) {
      return res.status(400).json({ error: 'Un des deux clans est encore en période de récupération.' });
    }

    const closestOpponentIds = new Set(opponentSelection.opponents.map((opponent) => opponent.id));
    if (!closestOpponentIds.has(targetClanId)) {
      const closestOpponent = opponentSelection.opponents[0] ?? null;
      if (!closestOpponent) {
        return res.status(400).json({ error: 'Aucun adversaire disponible pour lancer une guerre actuellement.' });
      }

      return res.status(400).json({
        error: `Tu peux seulement déclarer la guerre au clan disponible le plus proche en trophées. Match autorisé: ${closestOpponent.name} (${closestOpponent.warTrophies} trophées).`,
      });
    }

    const now = new Date();
    const endsAt = addHours(now, CLAN_WAR_DURATION_HOURS);

    await prisma.clanWar.create({
      data: {
        attackerClanId: id,
        defenderClanId: targetClanId,
        declaredByUserId: userId,
        status: 'ACTIVE',
        startsAt: now,
        endsAt,
        declaredWeekKey: getWeekKey(now),
        attackerTrophiesBefore: attackerClan.warTrophies ?? CLAN_WAR_STARTING_TROPHIES,
        defenderTrophiesBefore: defenderClan.warTrophies ?? CLAN_WAR_STARTING_TROPHIES,
        targetScore: CLAN_WAR_TARGET_SCORE,
      },
    });

    const war = await getCurrentWarForClan(id);

    createNotification({
      userId: defenderClan.owner.id,
      type: 'CLAN_WAR_DECLARED',
      title: 'Guerre déclarée',
      body: `${attackerClan.name} a déclaré la guerre à ${defenderClan.name}. La bataille commence maintenant !`,
      data: { warId: war!.id, clanId: targetClanId },
      link: '/clans',
      icon: 'swords',
    }).catch(() => {});

    res.json({ war: await mapWar(war!, id, userId) });
  } catch (error) {
    console.error('Declare clan war error:', error);
    res.status(500).json({ error: 'Failed to declare war' });
  }
});

// Fortify clan defenses
router.post('/:id/war/fortify', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();

    const { id } = req.params;
    const userId = req.user?.id;
    const rawDefenseType = typeof req.body.defenseType === 'string' ? req.body.defenseType.toUpperCase() : '';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isDefenseType(rawDefenseType)) {
      return res.status(400).json({ error: 'Type de defense invalide.' });
    }

    const [member, war] = await Promise.all([
      prisma.clanMember.findUnique({
        where: {
          clanId_userId: {
            clanId: id,
            userId,
          },
        },
        select: {
          userId: true,
        },
      }),
      getCurrentWarForClan(id),
    ]);

    if (!member) {
      return res.status(403).json({ error: 'Tu dois etre membre du clan pour fortifier.' });
    }

    if (!war) {
      return res.status(400).json({ error: 'Aucune guerre active ou en preparation pour ce clan.' });
    }

    if (!['PREPARING', 'ACTIVE'].includes(war.status)) {
      return res.status(400).json({ error: 'Cette guerre ne peut plus etre fortifiee.' });
    }

    const fortificationsUsed = await prisma.clanWarFortification.count({
      where: {
        warId: war.id,
        clanId: id,
        userId,
      },
    });

    if (fortificationsUsed >= CLAN_WAR_FORTIFICATIONS_PER_MEMBER) {
      return res.status(400).json({ error: 'Tu as deja utilise toutes tes fortifications pour cette guerre.' });
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.clanWarDefense.findUnique({
        where: {
          warId_clanId_type: {
            warId: war.id,
            clanId: id,
            type: rawDefenseType,
          },
        },
      });

      if (!existing) {
        const maxDurability = getDefenseMaxDurability(rawDefenseType, 1);
        const created = await tx.clanWarDefense.create({
          data: {
            warId: war.id,
            clanId: id,
            type: rawDefenseType,
            level: 1,
            durability: maxDurability,
            maxDurability,
          },
        });

        await tx.clanWarFortification.create({
          data: {
            warId: war.id,
            defenseId: created.id,
            clanId: id,
            userId,
            levelAdded: 1,
            durabilityAdded: maxDurability,
          },
        });

        return;
      }

      const canLevelUp = existing.level < 3;
      const newLevel = canLevelUp ? existing.level + 1 : existing.level;
      const newMaxDurability = getDefenseMaxDurability(rawDefenseType, newLevel);
      const repairedDurability = canLevelUp
        ? Math.min(newMaxDurability, existing.durability + 20 + newLevel * 6)
        : Math.min(existing.maxDurability, existing.durability + 28);
      const durabilityAdded = repairedDurability - existing.durability;

      const updated = await tx.clanWarDefense.update({
        where: { id: existing.id },
        data: {
          level: newLevel,
          maxDurability: newMaxDurability,
          durability: repairedDurability,
        },
      });

      await tx.clanWarFortification.create({
        data: {
          warId: war.id,
          defenseId: updated.id,
          clanId: id,
          userId,
          levelAdded: canLevelUp ? 1 : 0,
          durabilityAdded,
        },
      });
    });

    const refreshedWar = await getCurrentWarForClan(id);
    void trackClanEventActivity(userId, 'CLAN_WAR_SUPPORT', 1, {
      clanId: id,
      defenseType: rawDefenseType,
      warId: refreshedWar?.id ?? null,
    });
    res.json({ war: refreshedWar ? await mapWar(refreshedWar, id, userId) : null });
  } catch (error) {
    console.error('Fortify clan war error:', error);
    res.status(500).json({ error: 'Failed to fortify clan defenses' });
  }
});

// Attack during an active clan war
router.post('/:id/war/attack', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();

    const { id } = req.params;
    const userId = req.user?.id;
    const rawAttackType = typeof req.body.attackType === 'string' ? req.body.attackType.toUpperCase() : '';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isAttackType(rawAttackType)) {
      return res.status(400).json({ error: 'Type d\'attaque invalide.' });
    }

    const [member, war] = await Promise.all([
      prisma.clanMember.findUnique({
        where: {
          clanId_userId: {
            clanId: id,
            userId,
          },
        },
        select: {
          userId: true,
        },
      }),
      getCurrentWarForClan(id),
    ]);

    if (!member) {
      return res.status(403).json({ error: 'Tu dois etre membre du clan pour attaquer.' });
    }

    if (!war || !['PREPARING', 'ACTIVE'].includes(war.status)) {
      return res.status(400).json({ error: 'Aucune guerre en cours.' });
    }

    const attack = attackConfig[rawAttackType];
    const staminaUsed = await prisma.clanWarAttack.aggregate({
      where: {
        warId: war.id,
        userId,
        createdAt: {
          gte: getRollingWindowStart(24),
        },
      },
      _sum: {
        staminaCost: true,
      },
    });

    const staminaSpent = staminaUsed._sum.staminaCost ?? 0;
    if (staminaSpent + attack.staminaCost > CLAN_WAR_STAMINA_PER_24H) {
      return res.status(400).json({ error: 'Tu n\'as plus assez d\'endurance pour cette attaque.' });
    }

    const attackerClanId = id;
    const defenderClanId = war.attackerClanId === id ? war.defenderClanId : war.attackerClanId;
    const attackerFortress = getClanDefenseLevel(war.defenses, defenderClanId, 'FORTRESS');
    const attackerArmory = getClanDefenseLevel(war.defenses, attackerClanId, 'ARMORY');
    const attackerBanner = getClanDefenseLevel(war.defenses, attackerClanId, 'BANNER');
    const ownScore = war.attackerClanId === id ? war.attackerScore : war.defenderScore;
    const enemyScore = war.attackerClanId === id ? war.defenderScore : war.attackerScore;
    const scoreGap = enemyScore - ownScore;
    const moraleBonus = attackerBanner * (scoreGap >= 15 ? 4 : 2);
    const basePoints = randomInt(attack.minPoints, attack.maxPoints);
    const bonusPoints = attackerArmory * 4 + moraleBonus;
    const defenseMitigation = Math.max(0, attackerFortress * 5 - (rawAttackType === 'SIEGE' ? 8 : rawAttackType === 'SABOTAGE' ? 4 : 0));
    const finalPoints = clamp(basePoints + bonusPoints - defenseMitigation, 6, 60);
    const structureDamage = attack.structureDamage + attackerArmory * 2 + (rawAttackType === 'SABOTAGE' ? attackerBanner * 3 : 0);
    const targetedDefense = selectDefenseTarget(rawAttackType, war.defenses, defenderClanId);

    await prisma.$transaction(async (tx) => {
      await tx.clanWarAttack.create({
        data: {
          warId: war.id,
          userId,
          clanId: attackerClanId,
          targetClanId: defenderClanId,
          attackType: rawAttackType,
          staminaCost: attack.staminaCost,
          basePoints,
          bonusPoints,
          defenseMitigation,
          structureDamage: targetedDefense ? structureDamage : 0,
          finalPoints,
        },
      });

      if (war.attackerClanId === attackerClanId) {
        await tx.clanWar.update({
          where: { id: war.id },
          data: {
            attackerScore: { increment: finalPoints },
          },
        });
      } else {
        await tx.clanWar.update({
          where: { id: war.id },
          data: {
            defenderScore: { increment: finalPoints },
          },
        });
      }

      if (targetedDefense) {
        await tx.clanWarDefense.update({
          where: { id: targetedDefense.id },
          data: {
            durability: Math.max(0, targetedDefense.durability - structureDamage),
          },
        });
      }
    });

    await advanceClanWarsState();

    const refreshedWar = await getCurrentWarForClan(id);
    void trackClanEventActivity(userId, 'CLAN_WAR_ATTACK', 1, {
      clanId: id,
      attackType: rawAttackType,
      finalPoints,
      warId: war.id,
    });
    if (!refreshedWar) {
      const completedWar = await prisma.clanWar.findUnique({
        where: { id: war.id },
        include: historyWarInclude,
      });
      return res.json({
        war: completedWar ? await mapWar(completedWar, id, userId) : null,
        completed: true,
      });
    }

    res.json({
      war: await mapWar(refreshedWar, id, userId),
      completed: false,
      finalPoints,
      attackType: rawAttackType,
    });
  } catch (error) {
    console.error('Clan war attack error:', error);
    res.status(500).json({ error: 'Failed to attack in clan war' });
  }
});

// Accept a join request (leader only)
router.post('/:id/requests/:requestId/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, requestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leader = await prisma.clanMember.findFirst({
      where: {
        clanId: id,
        userId,
        isLeader: true,
      },
      select: { id: true },
    });

    if (!leader) {
      return res.status(403).json({ error: 'Seul le chef peut accepter.' });
    }

    const clan = await prisma.clan.findUnique({
      where: { id },
      select: { maxMembers: true, name: true },
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    const request = await prisma.clanJoinRequest.findUnique({
      where: { id: requestId },
      select: { id: true, clanId: true, userId: true },
    });

    if (!request || request.clanId !== id) {
      return res.status(404).json({ error: 'Demande introuvable.' });
    }

    await prisma.$transaction(async (tx) => {
      const memberCount = await tx.clanMember.count({
        where: { clanId: id },
      });
      if (memberCount >= clan.maxMembers) {
        throw new Error('CLAN_FULL');
      }

      await tx.clanMember.create({
        data: {
          clanId: id,
          userId: request.userId,
          isLeader: false,
        },
      });

      await tx.clanJoinRequest.delete({
        where: { id: request.id },
      });
    });

    createNotification({
      userId: request.userId,
      type: 'CLAN_JOIN_ACCEPTED',
      title: 'Demande acceptée',
      body: `Vous avez rejoint le clan ${clan.name}.`,
      data: { clanId: id, clanName: clan.name },
      link: '/clans',
      icon: 'users',
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'CLAN_FULL') {
      return res.status(400).json({ error: 'Ce clan est complet.' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Ce joueur est deja dans un clan.' });
    }
    console.error('Accept clan request error:', error);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Reject a join request (leader only)
router.post('/:id/requests/:requestId/reject', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, requestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leader = await prisma.clanMember.findFirst({
      where: {
        clanId: id,
        userId,
        isLeader: true,
      },
      select: { id: true },
    });

    if (!leader) {
      return res.status(403).json({ error: 'Seul le chef peut refuser.' });
    }

    const request = await prisma.clanJoinRequest.findUnique({
      where: { id: requestId },
      select: { id: true, clanId: true, userId: true },
    });

    if (!request || request.clanId !== id) {
      return res.status(404).json({ error: 'Demande introuvable.' });
    }

    await prisma.clanJoinRequest.delete({
      where: { id: request.id },
    });

    const clanInfo = await prisma.clan.findUnique({ where: { id }, select: { name: true } });
    if (clanInfo) {
      createNotification({
        userId: request.userId,
        type: 'CLAN_JOIN_REJECTED',
        title: 'Demande refusée',
        body: `Votre demande pour rejoindre ${clanInfo.name} a été refusée.`,
        data: { clanId: id, clanName: clanInfo.name },
        link: '/clans',
        icon: 'users',
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reject clan request error:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Promote a member to officer (leader permissions)
router.post('/:id/members/:targetUserId/promote', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, targetUserId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leader = await prisma.clanMember.findFirst({
      where: {
        clanId: id,
        userId,
        isLeader: true,
      },
      select: { id: true },
    });

    if (!leader) {
      return res.status(403).json({ error: 'Seul un chef/officier peut promouvoir.' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Tu ne peux pas te promouvoir toi-meme.' });
    }

    const [member, clanInfo] = await Promise.all([
      prisma.clanMember.findUnique({
        where: {
          clanId_userId: {
            clanId: id,
            userId: targetUserId,
          },
        },
        select: { id: true, isLeader: true },
      }),
      prisma.clan.findUnique({ where: { id }, select: { name: true } }),
    ]);

    if (!member) {
      return res.status(404).json({ error: 'Membre introuvable dans ce clan.' });
    }

    if (member.isLeader) {
      return res.status(400).json({ error: 'Ce membre est deja promu.' });
    }

    await prisma.clanMember.update({
      where: { id: member.id },
      data: { isLeader: true },
    });

    createNotification({
      userId: targetUserId,
      type: 'SYSTEM',
      title: 'Promotion de clan',
      body: clanInfo?.name
        ? `Tu as ete promu officier dans le clan ${clanInfo.name}.`
        : 'Tu as ete promu officier dans ton clan.',
      data: {
        clanId: id,
        clanName: clanInfo?.name ?? null,
        promotedByUserId: userId,
      },
      link: '/clans',
      icon: 'sparkles',
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Promote clan member error:', error);
    res.status(500).json({ error: 'Failed to promote member' });
  }
});

// Demote an officer/member with leader permissions
router.post('/:id/members/:targetUserId/demote', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, targetUserId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leader = await prisma.clanMember.findFirst({
      where: {
        clanId: id,
        userId,
        isLeader: true,
      },
      select: { id: true },
    });

    if (!leader) {
      return res.status(403).json({ error: 'Seul un chef/officier peut retrograder.' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Tu ne peux pas te retrograder toi-meme.' });
    }

    const [member, clanInfo] = await Promise.all([
      prisma.clanMember.findUnique({
        where: {
          clanId_userId: {
            clanId: id,
            userId: targetUserId,
          },
        },
        select: { id: true, isLeader: true },
      }),
      prisma.clan.findUnique({ where: { id }, select: { ownerId: true, name: true } }),
    ]);

    if (!member) {
      return res.status(404).json({ error: 'Membre introuvable dans ce clan.' });
    }

    if (!member.isLeader) {
      return res.status(400).json({ error: 'Ce membre est deja simple membre.' });
    }

    if (clanInfo?.ownerId === targetUserId) {
      return res.status(400).json({ error: 'Le chef ne peut pas etre retrograde. Transfere le role de chef avant.' });
    }

    await prisma.clanMember.update({
      where: { id: member.id },
      data: { isLeader: false },
    });

    createNotification({
      userId: targetUserId,
      type: 'SYSTEM',
      title: 'Retrogradation de clan',
      body: clanInfo?.name
        ? `Tu es repasse membre dans le clan ${clanInfo.name}.`
        : 'Tu es repasse membre dans ton clan.',
      data: {
        clanId: id,
        clanName: clanInfo?.name ?? null,
        demotedByUserId: userId,
      },
      link: '/clans',
      icon: 'shield',
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Demote clan member error:', error);
    res.status(500).json({ error: 'Failed to demote member' });
  }
});

// Transfer clan owner role to another member
router.post('/:id/members/:targetUserId/transfer-leadership', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, targetUserId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Tu es deja le chef de ce clan.' });
    }

    const [clan, currentMember, targetMember] = await Promise.all([
      prisma.clan.findUnique({ where: { id }, select: { id: true, ownerId: true, name: true } }),
      prisma.clanMember.findUnique({
        where: {
          clanId_userId: {
            clanId: id,
            userId,
          },
        },
        select: { id: true, isLeader: true },
      }),
      prisma.clanMember.findUnique({
        where: {
          clanId_userId: {
            clanId: id,
            userId: targetUserId,
          },
        },
        select: { id: true },
      }),
    ]);

    if (!clan) {
      return res.status(404).json({ error: 'Clan introuvable.' });
    }

    if (!currentMember || !currentMember.isLeader || clan.ownerId !== userId) {
      return res.status(403).json({ error: 'Seul le chef actuel peut transferer ce role.' });
    }

    if (!targetMember) {
      return res.status(404).json({ error: 'Membre cible introuvable dans ce clan.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.clan.update({
        where: { id },
        data: { ownerId: targetUserId },
      });

      await tx.clanMember.update({
        where: { id: currentMember.id },
        data: { isLeader: false },
      });

      await tx.clanMember.update({
        where: { id: targetMember.id },
        data: { isLeader: true },
      });
    });

    createNotification({
      userId: targetUserId,
      type: 'SYSTEM',
      title: 'Nouveau chef de clan',
      body: clan.name
        ? `Tu es maintenant le chef du clan ${clan.name}.`
        : 'Tu es maintenant le chef de ton clan.',
      data: {
        clanId: id,
        clanName: clan.name,
        previousLeaderUserId: userId,
      },
      link: '/clans',
      icon: 'crown',
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Transfer clan leadership error:', error);
    res.status(500).json({ error: 'Failed to transfer leadership' });
  }
});

// Leave a clan
router.delete('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    let promotedLeaderUserId: string | null = null;
    let promotedClanName: string | null = null;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const member = await prisma.clanMember.findUnique({
      where: {
        clanId_userId: {
          clanId: id,
          userId,
        },
      },
      select: {
        id: true,
        isLeader: true,
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Tu n\'es pas membre de ce clan.' });
    }

    await prisma.$transaction(async (tx) => {
      if (member.isLeader) {
        const remainingMembers = await tx.clanMember.findMany({
          where: {
            clanId: id,
            userId: { not: userId },
          },
          include: {
            user: {
              select: {
                aura: true,
              },
            },
          },
          orderBy: {
            user: { aura: 'desc' },
          },
        });

        if (remainingMembers.length > 0) {
          const newLeader = remainingMembers[0];
          promotedLeaderUserId = newLeader.userId;
          await tx.clanMember.update({
            where: { id: newLeader.id },
            data: { isLeader: true },
          });
          await tx.clan.update({
            where: { id },
            data: { ownerId: newLeader.userId },
          });
          const clan = await tx.clan.findUnique({
            where: { id },
            select: { name: true },
          });
          promotedClanName = clan?.name ?? null;
        } else {
          await tx.clan.delete({
            where: { id },
          });
          return;
        }
      }

      await tx.clanMember.delete({
        where: { id: member.id },
      });
    });

    if (promotedLeaderUserId) {
      createNotification({
        userId: promotedLeaderUserId,
        type: 'SYSTEM',
        title: 'Nouveau chef de clan',
        body: promotedClanName
          ? `Tu es maintenant le chef du clan ${promotedClanName}.`
          : 'Tu es maintenant le chef de ton clan.',
        data: {
          clanId: id,
          clanName: promotedClanName,
        },
        link: '/clans',
        icon: 'crown',
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Leave clan error:', error);
    res.status(500).json({ error: 'Failed to leave clan' });
  }
});

// Remove a member from the clan (leader only)
router.delete('/:id/members/:targetUserId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, targetUserId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leader = await prisma.clanMember.findFirst({
      where: {
        clanId: id,
        userId,
        isLeader: true,
      },
      select: { id: true },
    });

    if (!leader) {
      return res.status(403).json({ error: 'Seul le chef peut retirer des membres.' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Tu ne peux pas te retirer toi-meme. Quitte le clan a la place.' });
    }

    const [clanInfo, targetUser] = await Promise.all([
      prisma.clan.findUnique({ where: { id }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: targetUserId }, select: { username: true } }),
    ]);

    const member = await prisma.clanMember.findUnique({
      where: {
        clanId_userId: {
          clanId: id,
          userId: targetUserId,
        },
      },
      select: { id: true, isLeader: true },
    });

    if (!member) {
      return res.status(404).json({ error: 'Membre introuvable dans ce clan.' });
    }

    if (member.isLeader) {
      return res.status(400).json({ error: 'Retrograde ce membre avant de le retirer du clan.' });
    }

    await prisma.clanMember.delete({
      where: { id: member.id },
    });

    createNotification({
      userId: targetUserId,
      type: 'SYSTEM',
      title: 'Retire du clan',
      body: clanInfo?.name
        ? `Tu as été retiré du clan ${clanInfo.name}.`
        : 'Tu as été retiré de ton clan.',
      data: {
        clanId: id,
        clanName: clanInfo?.name ?? null,
        removedByUserId: userId,
        removedUserUsername: targetUser?.username ?? null,
      },
      link: '/clans',
      icon: 'shield-x',
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Remove clan member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Update clan image (leader only)
router.put('/:id/image', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const membership = await getClanMembership(id, userId);
    if (!membership) return res.status(403).json({ error: 'Not a member' });
    if (!membership.isLeader) return res.status(403).json({ error: 'Seul le chef peut modifier l\'image du clan.' });

    const { imageUrl } = req.body;

    const updated = await prisma.clan.update({
      where: { id },
      data: { imageUrl: typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null },
      select: { id: true, imageUrl: true },
    });

    res.json({ success: true, imageUrl: updated.imageUrl });
  } catch (error) {
    console.error('Update clan image error:', error);
    res.status(500).json({ error: 'Failed to update clan image' });
  }
});

// Update clan description (leader only)
router.put('/:id/description', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const membership = await getClanMembership(id, userId);
    if (!membership) return res.status(403).json({ error: 'Not a member' });
    if (!membership.isLeader) return res.status(403).json({ error: 'Seul le chef peut modifier la description du clan.' });

    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    if (description.length > 300) {
      return res.status(400).json({ error: 'Description trop longue (max 300 caracteres).' });
    }

    const updated = await prisma.clan.update({
      where: { id },
      data: { description: description || null },
      select: { id: true, description: true },
    });

    res.json({ success: true, description: updated.description });
  } catch (error) {
    console.error('Update clan description error:', error);
    res.status(500).json({ error: 'Failed to update clan description' });
  }
});

// Update clan tag text and style (leader only, requires tagUnlocked)
router.put('/:id/tag', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const membership = await getClanMembership(id, userId);
    if (!membership) return res.status(403).json({ error: 'Not a member' });
    if (!membership.isLeader) return res.status(403).json({ error: 'Seul le chef peut modifier le tag.' });

    const clan = await prisma.clan.findUnique({ where: { id }, select: { tagUnlocked: true } });
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    if (!clan.tagUnlocked) return res.status(400).json({ error: 'Tag non débloqué pour ce clan.' });

    const { tagText, tagStyle } = req.body;

    if (tagText !== undefined) {
      const text = typeof tagText === 'string' ? tagText.trim() : '';
      if (text.length < 1 || text.length > 6) {
        return res.status(400).json({ error: 'Le tag doit contenir entre 1 et 6 caractères.' });
      }
    }

    const updated = await prisma.clan.update({
      where: { id },
      data: {
        tagText: tagText !== undefined ? (tagText as string).trim() : undefined,
        tagStyle: tagStyle !== undefined ? JSON.stringify(tagStyle) : undefined,
      },
    });

    res.json({ success: true, tagText: updated.tagText, tagStyle: updated.tagStyle });
  } catch (error) {
    console.error('Update clan tag error:', error);
    res.status(500).json({ error: 'Failed to update clan tag' });
  }
});

// ─────────────────────────────────────────────
// WAR MINI-GAMES
// ─────────────────────────────────────────────

const NAVAL_SHOTS_PER_USER = 5;
const NAVAL_GRID_SIZE = 6;

type NavalCell = { type: DefenseType | null; hp: number };

const generateNavalGrid = (): NavalCell[][] => {
  const grid: NavalCell[][] = Array.from({ length: NAVAL_GRID_SIZE }, () =>
    Array.from({ length: NAVAL_GRID_SIZE }, () => ({ type: null, hp: 0 }))
  );
  const buildings: Array<{ type: DefenseType; hp: number }> = [
    { type: 'FORTRESS', hp: 2 },
    { type: 'FORTRESS', hp: 2 },
    { type: 'ARMORY', hp: 1 },
    { type: 'ARMORY', hp: 1 },
    { type: 'ARMORY', hp: 1 },
    { type: 'BANNER', hp: 1 },
    { type: 'BANNER', hp: 1 },
    { type: 'BANNER', hp: 1 },
  ];
  const placed = new Set<string>();
  for (const b of buildings) {
    let x: number, y: number;
    do {
      x = Math.floor(Math.random() * NAVAL_GRID_SIZE);
      y = Math.floor(Math.random() * NAVAL_GRID_SIZE);
    } while (placed.has(`${x},${y}`));
    placed.add(`${x},${y}`);
    grid[y][x] = { type: b.type, hp: b.hp };
  }
  return grid;
};

// GET /:id/war/games/status — game status for authenticated user
router.get('/:id/war/games/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const member = await prisma.clanMember.findUnique({
      where: { clanId_userId: { clanId: id, userId } },
      select: { userId: true },
    });
    if (!member) return res.status(403).json({ error: 'Non membre.' });

    const war = await getCurrentWarForClan(id);
    if (!war) return res.json({ war: null });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLogs = await prisma.clanWarGameLog.findMany({
      where: { warId: war.id, userId, isPractice: false, playedAt: { gte: today } },
    });

    const memoryPlayedToday = todayLogs.some((l) => l.gameType === 'MEMORY');
    const bombPlayedToday = todayLogs.some((l) => l.gameType === 'BOMB');

    const enemyClanId = war.attackerClanId === id ? war.defenderClanId : war.attackerClanId;

    let navalStatus = null;
    if (['PREPARING', 'ACTIVE'].includes(war.status)) {
      const board = await prisma.clanWarNavalBoard.findUnique({
        where: { warId_clanId: { warId: war.id, clanId: enemyClanId } },
        include: { shots: true },
      });
      const allShots = board?.shots ?? [];
      const myShots = allShots.filter((s) => s.userId === userId);
      navalStatus = {
        boardId: board?.id ?? null,
        shotsUsed: myShots.length,
        shotsRemaining: Math.max(0, NAVAL_SHOTS_PER_USER - myShots.length),
        shots: allShots.map((s) => ({
          x: s.x,
          y: s.y,
          isHit: s.isHit,
          building: s.building,
          points: s.points,
          isOwnShot: s.userId === userId,
        })),
      };
    }

    return res.json({
      warStatus: war.status,
      warId: war.id,
      memoryPlayedToday,
      bombPlayedToday,
      canPlayMemory: !memoryPlayedToday && ['PREPARING', 'ACTIVE'].includes(war.status),
      canPlayBomb: !bombPlayedToday && ['PREPARING', 'ACTIVE'].includes(war.status),
      naval: navalStatus,
    });
  } catch (error) {
    console.error('War games status error:', error);
    res.status(500).json({ error: 'Failed to get game status' });
  }
});

// POST /:id/war/games/memory — submit memory game result, apply fortifications
router.post('/:id/war/games/memory', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { matchedPairs, score, isPractice = false } = req.body as {
      matchedPairs: Record<string, number>;
      score: number;
      isPractice: boolean;
    };

    const member = await prisma.clanMember.findUnique({
      where: { clanId_userId: { clanId: id, userId } },
      select: { userId: true },
    });
    if (!member) return res.status(403).json({ error: 'Non membre.' });

    const war = await getCurrentWarForClan(id);
    if (!war) return res.status(400).json({ error: 'Aucune guerre active.' });
    if (!['PREPARING', 'ACTIVE'].includes(war.status)) {
      return res.status(400).json({ error: 'Fortifications non disponibles.' });
    }

    if (!isPractice) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const playedToday = await prisma.clanWarGameLog.findFirst({
        where: { warId: war.id, userId, gameType: 'MEMORY', isPractice: false, playedAt: { gte: today } },
      });
      if (playedToday) return res.status(400).json({ error: 'Jeu déjà joué aujourd\'hui.' });

      const fortificationsUsed = await prisma.clanWarFortification.count({
        where: { warId: war.id, clanId: id, userId },
      });
      const fortifCap = CLAN_WAR_FORTIFICATIONS_PER_MEMBER;

      const defenseTypes: DefenseType[] = ['FORTRESS', 'ARMORY', 'BANNER'];
      let totalFortifs = 0;

      await prisma.$transaction(async (tx) => {
        for (const type of defenseTypes) {
          const pairsMatched = Math.max(0, Math.floor(matchedPairs[type] ?? 0));
          for (let i = 0; i < pairsMatched; i++) {
            if (fortificationsUsed + totalFortifs >= fortifCap) break;
            const existing = await tx.clanWarDefense.findUnique({
              where: { warId_clanId_type: { warId: war.id, clanId: id, type } },
            });
            if (!existing) {
              const maxDurability = getDefenseMaxDurability(type, 1);
              const created = await tx.clanWarDefense.create({
                data: { warId: war.id, clanId: id, type, level: 1, durability: maxDurability, maxDurability },
              });
              await tx.clanWarFortification.create({
                data: { warId: war.id, defenseId: created.id, clanId: id, userId, levelAdded: 1, durabilityAdded: 0 },
              });
            } else {
              const newLevel = existing.level + 1;
              const durabilityAdd = defenseConfig[type].durabilityPerLevel;
              const newMaxDurability = getDefenseMaxDurability(type, newLevel);
              await tx.clanWarDefense.update({
                where: { id: existing.id },
                data: { level: newLevel, durability: { increment: durabilityAdd }, maxDurability: newMaxDurability },
              });
              await tx.clanWarFortification.create({
                data: { warId: war.id, defenseId: existing.id, clanId: id, userId, levelAdded: 1, durabilityAdded: durabilityAdd },
              });
            }
            totalFortifs++;
          }
        }
      });

      await prisma.clanWarGameLog.create({
        data: { warId: war.id, userId, clanId: id, gameType: 'MEMORY', score, pointsAwarded: totalFortifs, isPractice: false },
      });

      void trackClanEventActivity(userId, 'CLAN_WAR_SUPPORT', Math.max(1, totalFortifs), {
        clanId: id,
        warId: war.id,
        source: 'memory_game',
        fortificationsAdded: totalFortifs,
        score,
      });
    }

    return res.json({ success: true, isPractice });
  } catch (error) {
    console.error('Memory game error:', error);
    res.status(500).json({ error: 'Failed to submit memory game' });
  }
});

// POST /:id/war/games/bomb — submit bomb drop game result, apply attack points
router.post('/:id/war/games/bomb', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { score, hits, isPractice = false } = req.body as { score: number; hits: number; isPractice: boolean };

    const member = await prisma.clanMember.findUnique({
      where: { clanId_userId: { clanId: id, userId } },
      select: { userId: true },
    });
    if (!member) return res.status(403).json({ error: 'Non membre.' });

    const war = await getCurrentWarForClan(id);
    if (!war || !['PREPARING', 'ACTIVE'].includes(war.status)) {
      return res.status(400).json({ error: 'La guerre n\'est pas active.' });
    }

    let finalPoints = 0;

    if (!isPractice) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const playedToday = await prisma.clanWarGameLog.findFirst({
        where: { warId: war.id, userId, gameType: 'BOMB', isPractice: false, playedAt: { gte: today } },
      });
      if (playedToday) return res.status(400).json({ error: 'Jeu déjà joué aujourd\'hui.' });

      const safeScore = Math.max(0, Math.min(1000, Math.floor(score)));
      const rawPoints = Math.round(safeScore / 10);
      const targetClanId = war.attackerClanId === id ? war.defenderClanId : war.attackerClanId;
      const defenseLevel = getClanDefenseLevel(war.defenses, targetClanId, 'FORTRESS');
      const mitigation = defenseLevel * 4;
      const armoryLevel = getClanDefenseLevel(war.defenses, id, 'ARMORY');
      const armoryBonus = armoryLevel * 3;
      finalPoints = clamp(rawPoints - mitigation + armoryBonus, 4, 80);

      await prisma.$transaction(async (tx) => {
        await tx.clanWarAttack.create({
          data: {
            warId: war.id,
            userId,
            clanId: id,
            targetClanId,
            attackType: 'RAID',
            staminaCost: 0,
            basePoints: rawPoints,
            bonusPoints: 0,
            defenseMitigation: mitigation,
            structureDamage: hits * 6,
            finalPoints,
          },
        });
        if (war.attackerClanId === id) {
          await tx.clanWar.update({ where: { id: war.id }, data: { attackerScore: { increment: finalPoints } } });
        } else {
          await tx.clanWar.update({ where: { id: war.id }, data: { defenderScore: { increment: finalPoints } } });
        }
      });

      await prisma.clanWarGameLog.create({
        data: { warId: war.id, userId, clanId: id, gameType: 'BOMB', score, pointsAwarded: finalPoints, isPractice: false },
      });

      void trackClanEventActivity(userId, 'CLAN_WAR_ATTACK', 1, {
        clanId: id,
        warId: war.id,
        source: 'bomb_game',
        finalPoints,
        hits,
      });

      await advanceClanWarsState();
    }

    return res.json({ success: true, isPractice, finalPoints });
  } catch (error) {
    console.error('Bomb game error:', error);
    res.status(500).json({ error: 'Failed to submit bomb game' });
  }
});

// POST /:id/war/games/naval/shot — fire a shot in naval warfare
router.post('/:id/war/games/naval/shot', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await advanceClanWarsState();
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { x, y } = req.body as { x: number; y: number };
    if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || x >= NAVAL_GRID_SIZE || y < 0 || y >= NAVAL_GRID_SIZE) {
      return res.status(400).json({ error: 'Coordonnées invalides.' });
    }

    const member = await prisma.clanMember.findUnique({
      where: { clanId_userId: { clanId: id, userId } },
      select: { userId: true },
    });
    if (!member) return res.status(403).json({ error: 'Non membre.' });

    const war = await getCurrentWarForClan(id);
    if (!war || !['PREPARING', 'ACTIVE'].includes(war.status)) {
      return res.status(400).json({ error: 'La guerre n\'est pas active.' });
    }

    const enemyClanId = war.attackerClanId === id ? war.defenderClanId : war.attackerClanId;

    // Get or create enemy board
    let board = await prisma.clanWarNavalBoard.findUnique({
      where: { warId_clanId: { warId: war.id, clanId: enemyClanId } },
      include: { shots: { where: { userId } } },
    });

    if (!board) {
      const grid = generateNavalGrid();
      board = await prisma.clanWarNavalBoard.create({
        data: { warId: war.id, clanId: enemyClanId, grid: JSON.stringify(grid) },
        include: { shots: { where: { userId } } },
      });
    }

    if (board.shots.length >= NAVAL_SHOTS_PER_USER) {
      return res.status(400).json({ error: 'Plus de tirs disponibles pour cette guerre.' });
    }

    const existing = await prisma.clanWarNavalShot.findUnique({
      where: { boardId_x_y: { boardId: board.id, x, y } },
    });
    if (existing) return res.status(400).json({ error: 'Cette case a déjà été ciblée.' });

    const grid = JSON.parse(board.grid) as NavalCell[][];
    const cell = grid[y][x];
    const isHit = cell.type !== null && cell.hp > 0;
    let points = 0;
    let building: string | null = null;

    if (isHit) {
      building = cell.type as string;
      const buildingPoints: Record<string, number> = { FORTRESS: 25, ARMORY: 18, BANNER: 12 };
      points = buildingPoints[building] ?? 12;
      cell.hp -= 1;
      if (cell.hp <= 0) {
        points += 8; // destroy bonus
        cell.type = null;
      }
      grid[y][x] = cell;
      await prisma.clanWarNavalBoard.update({ where: { id: board.id }, data: { grid: JSON.stringify(grid) } });
      const bannerLevel = getClanDefenseLevel(war.defenses, id, 'BANNER');
      points += bannerLevel * 2;
    }

    await prisma.$transaction(async (tx) => {
      await tx.clanWarNavalShot.create({
        data: { boardId: board!.id, warId: war.id, userId, clanId: id, x, y, isHit, building, points },
      });
      if (isHit && points > 0) {
        await tx.clanWarAttack.create({
          data: {
            warId: war.id,
            userId,
            clanId: id,
            targetClanId: enemyClanId,
            attackType: 'SABOTAGE',
            staminaCost: 0,
            basePoints: points,
            bonusPoints: 0,
            defenseMitigation: 0,
            structureDamage: 15,
            finalPoints: points,
          },
        });
        if (war.attackerClanId === id) {
          await tx.clanWar.update({ where: { id: war.id }, data: { attackerScore: { increment: points } } });
        } else {
          await tx.clanWar.update({ where: { id: war.id }, data: { defenderScore: { increment: points } } });
        }
      }
    });

    if (isHit && points > 0) {
      void trackClanEventActivity(userId, 'CLAN_WAR_ATTACK', 1, {
        clanId: id,
        warId: war.id,
        source: 'naval_shot',
        points,
        building,
      });
      await advanceClanWarsState();
    }

    return res.json({ isHit, building, points, x, y });
  } catch (error) {
    console.error('Naval shot error:', error);
    res.status(500).json({ error: 'Failed to fire naval shot' });
  }
});

// ── Pump-up messages ──────────────────────────────────────────────────────────

router.get('/:id/pump-up', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const membership = await prisma.clanMember.findFirst({ where: { clanId: id, userId } });
  if (!membership) return res.status(403).json({ error: 'Not a member' });

  const messages = await prisma.clanPumpUpMessage.findMany({
    where: { clanId: id },
    orderBy: { createdAt: 'asc' },
  });

  return res.json({ messages });
});

router.post('/:id/pump-up', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { content, color } = req.body as { content: string; color?: string };

  const membership = await prisma.clanMember.findFirst({ where: { clanId: id, userId } });
  if (!membership?.isLeader) return res.status(403).json({ error: 'Leaders only' });

  const count = await prisma.clanPumpUpMessage.count({ where: { clanId: id } });
  if (count >= 5) return res.status(400).json({ error: 'Maximum 5 messages' });

  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  if (content.trim().length > 120) return res.status(400).json({ error: 'Max 120 characters' });

  const message = await prisma.clanPumpUpMessage.create({
    data: { clanId: id, content: content.trim(), color: color ?? '#ffffff' },
  });

  return res.json({ message });
});

router.put('/:id/pump-up/:msgId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id, msgId } = req.params;
  const userId = req.user!.id;
  const { content, color } = req.body as { content?: string; color?: string };

  const membership = await prisma.clanMember.findFirst({ where: { clanId: id, userId } });
  if (!membership?.isLeader) return res.status(403).json({ error: 'Leaders only' });

  const existing = await prisma.clanPumpUpMessage.findFirst({ where: { id: msgId, clanId: id } });
  if (!existing) return res.status(404).json({ error: 'Message not found' });

  if (content !== undefined && !content.trim()) return res.status(400).json({ error: 'Content required' });
  if (content !== undefined && content.trim().length > 120) return res.status(400).json({ error: 'Max 120 characters' });

  const message = await prisma.clanPumpUpMessage.update({
    where: { id: msgId },
    data: {
      ...(content !== undefined && { content: content.trim() }),
      ...(color !== undefined && { color }),
    },
  });

  return res.json({ message });
});

router.delete('/:id/pump-up/:msgId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id, msgId } = req.params;
  const userId = req.user!.id;

  const membership = await prisma.clanMember.findFirst({ where: { clanId: id, userId } });
  if (!membership?.isLeader) return res.status(403).json({ error: 'Leaders only' });

  const existing = await prisma.clanPumpUpMessage.findFirst({ where: { id: msgId, clanId: id } });
  if (!existing) return res.status(404).json({ error: 'Message not found' });

  await prisma.clanPumpUpMessage.delete({ where: { id: msgId } });

  return res.json({ success: true });
});

export default router;
