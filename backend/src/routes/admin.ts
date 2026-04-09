import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { adminPurgeAllBusinesses, adminResetBusinessUnlockLevels, forceDivorceRelationship } from '../modules/you/service.js';
import { validate, adminRareActionSchema } from '../middleware/validation.js';
import { logAdmin, logSuggestion, logBan } from '../utils/logger.js';
import { isAllowedImageUrl, writeBase64UploadImage } from '../utils/uploads.js';
import { listBombPartyLanguageFiles } from '../utils/bombpartyDictionary.js';
import { recalculateBombPartyPrompts } from '../utils/bombpartyPrompts.js';
import { getOnlineCount, getOnlineUsers } from '../socket/chat.js';
import { createNotification } from '../utils/notifications.js';
import { sendBugReportReplyEmail } from '../utils/email.js';
import { awardBadgeByKey } from '../utils/badgeAwards.js';
import {
  getReferralRewardAmount,
  isReferralEnabled,
  REFERRAL_ENABLED_SETTING_KEY,
  REFERRAL_REWARD_SETTING_KEY,
} from '../utils/referrals.js';
import {
  DAILY_AURA_LIMIT_SETTING_KEY,
} from '../utils/dailyAura.js';
import {
  DEFAULT_TAX_BRACKET_RATE,
  DEFAULT_TAX_BRACKET_THRESHOLD,
  LAST_TAX_RUN_KEY,
  runDailyTax,
} from '../utils/dailyTax.js';
import {
  CHAT_AUTO_BLOCK_ENABLED_KEY,
  CHAT_AUTO_BLOCK_END_KEY,
  CHAT_AUTO_BLOCK_START_KEY,
  CHAT_BLOCK_ENABLED_KEY,
  CHAT_BLOCK_MESSAGE_KEY,
  getDefaultChatBlockMessage,
  isValidChatBlockTimeValue,
} from '../utils/chatSettings.js';
import {
  buildClanEventSlug,
  clanEventAdminInclude,
  CLAN_EVENT_ACTIVITY_TYPES,
  CLAN_EVENT_MINI_GAME_TYPES,
  serializeClanEventAdmin,
  advanceClanEventsState,
  finalizeClanEvent,
} from '../utils/clanEvents.js';

const router = Router();
const ANNOUNCEMENT_KEY = 'topbar_announcement';
const ANNOUNCEMENT_MAX_LENGTH = 120;
const AURACOIN_BUY_FEE_PERCENTAGE_KEY = 'auracoin_buy_fee_percentage';
const STABLE_COIN_BUY_FEE_PERCENTAGE_KEY = 'stable_coin_buy_fee_percentage';
const CHAOS_COIN_BUY_FEE_PERCENTAGE_KEY = 'chaos_coin_buy_fee_percentage';
const DUEL_MATCHMAKING_ENABLED_SETTING_KEY = 'duel_matchmaking_enabled';
const CLASH_ATTACK_COOLDOWN_MINUTES_KEY = 'clash_attack_cooldown_minutes';
const DAILY_AURA_DISTRIBUTION_LIMIT_KEY = DAILY_AURA_LIMIT_SETTING_KEY;
const DEFAULT_LANDING_PAGE_SETTING_KEY = 'default_landing_page';
const YOU_LOGO_ADMIN_ONLY_SETTING_KEY = 'you_logo_admin_only';
const ALLOWED_DEFAULT_LANDING_PAGES = new Set([
  '/dashboard',
  '/games',
  '/market',
  '/party',
  '/clans',
  '/polymarket',
  '/leaderboards',
  '/inbox',
  '/quests',
  '/support',
]);
const UPDATE_POPUP_UPLOAD_DIR = path.resolve('uploads', 'update-popups');
const ITEM_UPLOAD_DIR = path.resolve('uploads', 'items');
const MAX_UPDATE_POPUP_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ITEM_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ADMIN_CLAN_MAX_MEMBERS_LIMIT = 12;
const LOG_EXPORT_BATCH_SIZE = 5000;
const MAX_TAX_BRACKETS = 25;
const SITE_RELOAD_TRIGGER_KEYS = new Set([
  'maintenance_enabled',
  'maintenance_message',
  'maintenance_pages',
  'maintenance_end_date',
  'blocked_pages',
  'blocked_message',
]);

type TaxBracketInput = {
  threshold: number;
  rate: number;
};

type ClanEventQuestInput = {
  title: string;
  description?: string | null;
  activityType: string;
  targetValue: number;
  pointsReward: number;
  sortOrder: number;
  isActive: boolean;
};

type ClanEventMiniGameInput = {
  title: string;
  description?: string | null;
  type: string;
  instructions?: string | null;
  scoreMultiplier: number;
  flatPointsBonus: number;
  maxPointsPerAttempt: number;
  maxAttemptsPerUser: number | null;
  cooldownMinutes: number;
  sortOrder: number;
  isActive: boolean;
  configJson: string | null;
};

type ClanEventRewardTierInput = {
  title: string;
  minRank: number;
  maxRank: number;
  moneyReward: number;
  auraReward: number;
  itemId: string | null;
};

type ShopItemImportInput = {
  name: string;
  description: string;
  type: string;
  price: number;
  imageUrl?: string | null;
  effect?: string | Record<string, unknown> | null;
  expiresAt?: string | null;
};

type ShopItemImportFile = {
  format?: string;
  version?: number;
  items?: ShopItemImportInput[];
};

const SHOP_ITEMS_EXPORT_FORMAT = 'auratracker-shop-items';
const SHOP_ITEMS_EXPORT_VERSION = 1;

const normalizeImportedItem = (entry: unknown): { item: Omit<ShopItemImportInput, 'effect'> & { effect: string | null } } | { error: string } => {
  if (!entry || typeof entry !== 'object') {
    return { error: 'Chaque objet importe doit être un objet valide' };
  }

  const raw = entry as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const type = typeof raw.type === 'string' ? raw.type.trim() : '';
  const price = Number.parseInt(String(raw.price ?? ''), 10);

  if (!name) {
    return { error: 'Chaque objet doit avoir un nom' };
  }

  if (!description) {
    return { error: `L'objet "${name}" doit avoir une description` };
  }

  if (!type) {
    return { error: `L'objet "${name}" doit avoir une catégorie` };
  }

  if (!Number.isInteger(price) || price < 0) {
    return { error: `L'objet "${name}" doit avoir un prix entier positif ou nul` };
  }

  const imageUrl = raw.imageUrl == null ? null : String(raw.imageUrl).trim();
  if (imageUrl && !isAllowedImageUrl(imageUrl)) {
    return { error: `L'image de "${name}" doit être une URL autorisée` };
  }

  let effect: string | null = null;
  if (raw.effect != null) {
    if (typeof raw.effect === 'string') {
      const trimmedEffect = raw.effect.trim();
      if (trimmedEffect) {
        try {
          JSON.parse(trimmedEffect);
          effect = trimmedEffect;
        } catch {
          return { error: `L'effet de "${name}" doit être un JSON valide` };
        }
      }
    } else if (typeof raw.effect === 'object') {
      try {
        effect = JSON.stringify(raw.effect);
      } catch {
        return { error: `Impossible de sérialiser l'effet de "${name}"` };
      }
    } else {
      return { error: `L'effet de "${name}" doit être un objet JSON ou une chaîne JSON` };
    }
  }

  let expiresAt: string | null = null;
  if (raw.expiresAt != null && String(raw.expiresAt).trim() !== '') {
    const parsedDate = new Date(String(raw.expiresAt));
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: `La date d'expiration de "${name}" est invalide` };
    }
    expiresAt = parsedDate.toISOString();
  }

  return {
    item: {
      name,
      description,
      type,
      price,
      imageUrl,
      effect,
      expiresAt,
    },
  };
};

const normalizeTaxBracketsInput = (value: unknown): { brackets: TaxBracketInput[] } | { error: string } => {
  if (!Array.isArray(value)) {
    return { error: 'Brackets must be an array' };
  }

  if (value.length > MAX_TAX_BRACKETS) {
    return { error: `A maximum of ${MAX_TAX_BRACKETS} tax brackets is allowed` };
  }

  const seenThresholds = new Set<number>();
  const brackets: TaxBracketInput[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      return { error: 'Each tax bracket must be an object' };
    }

    const rawThreshold = (entry as { threshold?: unknown }).threshold;
    const rawRate = (entry as { rate?: unknown }).rate;
    const threshold = Number.parseInt(String(rawThreshold), 10);
    const rate = Number.parseFloat(String(rawRate));

    if (!Number.isInteger(threshold) || threshold < 0) {
      return { error: 'Each threshold must be a positive integer or zero' };
    }

    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return { error: 'Each tax rate must be between 0 and 100' };
    }

    if (seenThresholds.has(threshold)) {
      return { error: 'Each tax threshold must be unique' };
    }

    seenThresholds.add(threshold);
    brackets.push({
      threshold,
      rate: Number(rate.toFixed(4)),
    });
  }

  brackets.sort((a, b) => a.threshold - b.threshold);

  return { brackets };
};

const toOptionalTrimmedString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const parseJsonString = (value: unknown): string | null | { error: string } => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return { error: 'Le JSON de configuration du mini-jeu est invalide.' };
    }
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return { error: 'Impossible de sérialiser la configuration du mini-jeu.' };
    }
  }
  return { error: 'La configuration du mini-jeu doit être un objet JSON ou une chaîne JSON.' };
};

const ensureUniqueClanEventSlug = async (title: string, excludeId?: string) => {
  const base = buildClanEventSlug(title);
  let slug = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.clanEvent.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    slug = `${base.slice(0, Math.max(1, 48 - String(suffix).length - 1))}-${suffix}`;
    suffix += 1;
  }
};

const normalizeClanEventInput = (body: Record<string, unknown>): (
  {
    title: string;
    description: string | null;
    bannerUrl: string | null;
    status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    highlightColor: string | null;
    rulesSummary: string | null;
    startsAt: Date;
    endsAt: Date;
    quests: ClanEventQuestInput[];
    miniGames: ClanEventMiniGameInput[];
    rewardTiers: ClanEventRewardTierInput[];
  } | { error: string }
) => {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length < 3 || title.length > 80) {
    return { error: 'Le titre de l’événement doit contenir entre 3 et 80 caractères.' };
  }

  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : 'DRAFT';
  if (!['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
    return { error: 'Statut d’événement invalide.' };
  }

  const startsAt = new Date(String(body.startsAt ?? ''));
  const endsAt = new Date(String(body.endsAt ?? ''));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { error: 'Les dates de début et de fin sont invalides.' };
  }
  if (endsAt <= startsAt) {
    return { error: 'La date de fin doit être après la date de début.' };
  }

  const description = toOptionalTrimmedString(body.description);
  if (description && description.length > 1200) {
    return { error: 'La description est trop longue (max 1200 caractères).' };
  }

  const bannerUrl = toOptionalTrimmedString(body.bannerUrl);
  if (bannerUrl && !isAllowedImageUrl(bannerUrl)) {
    return { error: 'La bannière doit être une image téléversée ou une URL valide.' };
  }

  const highlightColor = toOptionalTrimmedString(body.highlightColor);
  if (highlightColor && !/^#([0-9a-fA-F]{6})$/.test(highlightColor)) {
    return { error: 'La couleur d’accent doit être au format hexadécimal (#RRGGBB).' };
  }

  const rulesSummary = toOptionalTrimmedString(body.rulesSummary);
  if (rulesSummary && rulesSummary.length > 300) {
    return { error: 'Le résumé des règles est trop long (max 300 caractères).' };
  }

  if (!Array.isArray(body.quests) || body.quests.length === 0) {
    return { error: 'Ajoute au moins une quête à l’événement.' };
  }
  if (!Array.isArray(body.miniGames) || body.miniGames.length === 0) {
    return { error: 'Ajoute au moins un mini-jeu à l’événement.' };
  }
  if (!Array.isArray(body.rewardTiers) || body.rewardTiers.length === 0) {
    return { error: 'Ajoute au moins un palier de récompense.' };
  }

  const quests: ClanEventQuestInput[] = [];
  for (const [index, rawQuest] of body.quests.entries()) {
    if (!rawQuest || typeof rawQuest !== 'object') {
      return { error: `La quête #${index + 1} est invalide.` };
    }
    const quest = rawQuest as Record<string, unknown>;
    const questTitle = typeof quest.title === 'string' ? quest.title.trim() : '';
    const activityType = typeof quest.activityType === 'string' ? quest.activityType.trim().toUpperCase() : '';
    const targetValue = Number.parseInt(String(quest.targetValue ?? ''), 10);
    const pointsReward = Number.parseInt(String(quest.pointsReward ?? ''), 10);
    const sortOrder = Number.parseInt(String(quest.sortOrder ?? index), 10);
    const isActive = quest.isActive !== false;

    if (!questTitle) return { error: `La quête #${index + 1} doit avoir un titre.` };
    if (!CLAN_EVENT_ACTIVITY_TYPES.includes(activityType as typeof CLAN_EVENT_ACTIVITY_TYPES[number])) {
      return { error: `Le type d’activité de la quête "${questTitle}" est invalide.` };
    }
    if (!Number.isInteger(targetValue) || targetValue <= 0) {
      return { error: `La quête "${questTitle}" doit avoir un objectif entier supérieur à 0.` };
    }
    if (!Number.isInteger(pointsReward) || pointsReward <= 0) {
      return { error: `La quête "${questTitle}" doit attribuer un nombre entier de points supérieur à 0.` };
    }

    quests.push({
      title: questTitle,
      description: toOptionalTrimmedString(quest.description),
      activityType,
      targetValue,
      pointsReward,
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : index,
      isActive,
    });
  }

  const miniGames: ClanEventMiniGameInput[] = [];
  for (const [index, rawMiniGame] of body.miniGames.entries()) {
    if (!rawMiniGame || typeof rawMiniGame !== 'object') {
      return { error: `Le mini-jeu #${index + 1} est invalide.` };
    }
    const miniGame = rawMiniGame as Record<string, unknown>;
    const miniGameTitle = typeof miniGame.title === 'string' ? miniGame.title.trim() : '';
    const type = typeof miniGame.type === 'string' ? miniGame.type.trim().toUpperCase() : '';
    const scoreMultiplier = Number.parseFloat(String(miniGame.scoreMultiplier ?? '1'));
    const flatPointsBonus = Number.parseInt(String(miniGame.flatPointsBonus ?? '0'), 10);
    const maxPointsPerAttempt = Number.parseInt(String(miniGame.maxPointsPerAttempt ?? '100'), 10);
    const cooldownMinutes = Number.parseInt(String(miniGame.cooldownMinutes ?? '0'), 10);
    const sortOrder = Number.parseInt(String(miniGame.sortOrder ?? index), 10);
    const maxAttemptsRaw = miniGame.maxAttemptsPerUser;
    const maxAttemptsPerUser = maxAttemptsRaw == null || String(maxAttemptsRaw).trim() === ''
      ? null
      : Number.parseInt(String(maxAttemptsRaw), 10);
    const configJson = parseJsonString(miniGame.config);
    if (typeof configJson === 'object' && configJson && 'error' in configJson) {
      return configJson;
    }

    if (!miniGameTitle) return { error: `Le mini-jeu #${index + 1} doit avoir un titre.` };
    if (!CLAN_EVENT_MINI_GAME_TYPES.includes(type as typeof CLAN_EVENT_MINI_GAME_TYPES[number])) {
      return { error: `Le type du mini-jeu "${miniGameTitle}" est invalide.` };
    }
    if (!Number.isFinite(scoreMultiplier) || scoreMultiplier < 0) {
      return { error: `Le multiplicateur du mini-jeu "${miniGameTitle}" est invalide.` };
    }
    if (!Number.isInteger(flatPointsBonus) || flatPointsBonus < 0) {
      return { error: `Le bonus fixe du mini-jeu "${miniGameTitle}" est invalide.` };
    }
    if (!Number.isInteger(maxPointsPerAttempt) || maxPointsPerAttempt <= 0) {
      return { error: `Le cap de points du mini-jeu "${miniGameTitle}" est invalide.` };
    }
    if (!Number.isInteger(cooldownMinutes) || cooldownMinutes < 0) {
      return { error: `Le cooldown du mini-jeu "${miniGameTitle}" est invalide.` };
    }
    if (maxAttemptsPerUser !== null && (!Number.isInteger(maxAttemptsPerUser) || maxAttemptsPerUser <= 0)) {
      return { error: `Le nombre max de tentatives du mini-jeu "${miniGameTitle}" est invalide.` };
    }

    miniGames.push({
      title: miniGameTitle,
      description: toOptionalTrimmedString(miniGame.description),
      type,
      instructions: toOptionalTrimmedString(miniGame.instructions),
      scoreMultiplier: Number(scoreMultiplier.toFixed(4)),
      flatPointsBonus,
      maxPointsPerAttempt,
      maxAttemptsPerUser,
      cooldownMinutes,
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : index,
      isActive: miniGame.isActive !== false,
      configJson,
    });
  }

  const rewardTiers: ClanEventRewardTierInput[] = [];
  for (const [index, rawTier] of body.rewardTiers.entries()) {
    if (!rawTier || typeof rawTier !== 'object') {
      return { error: `Le palier #${index + 1} est invalide.` };
    }
    const tier = rawTier as Record<string, unknown>;
    const title = typeof tier.title === 'string' ? tier.title.trim() : '';
    const minRank = Number.parseInt(String(tier.minRank ?? ''), 10);
    const maxRank = Number.parseInt(String(tier.maxRank ?? ''), 10);
    const moneyReward = Number.parseInt(String(tier.moneyReward ?? '0'), 10);
    const auraReward = Number.parseInt(String(tier.auraReward ?? '0'), 10);
    const itemId = toOptionalTrimmedString(tier.itemId);

    if (!title) return { error: `Le palier #${index + 1} doit avoir un titre.` };
    if (!Number.isInteger(minRank) || !Number.isInteger(maxRank) || minRank <= 0 || maxRank < minRank) {
      return { error: `Le palier "${title}" doit avoir un intervalle de rang valide.` };
    }
    if (!Number.isInteger(moneyReward) || moneyReward < 0) {
      return { error: `Le reward money du palier "${title}" est invalide.` };
    }
    if (!Number.isInteger(auraReward) || auraReward < 0) {
      return { error: `Le reward aura du palier "${title}" est invalide.` };
    }

    rewardTiers.push({
      title,
      minRank,
      maxRank,
      moneyReward,
      auraReward,
      itemId,
    });
  }

  return {
    title,
    description,
    bannerUrl,
    status: status as 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
    highlightColor,
    rulesSummary,
    startsAt,
    endsAt,
    quests,
    miniGames,
    rewardTiers,
  };
};

const parseLogDateBoundary = (value: unknown, boundary: 'start' | 'end'): Date | null => {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const trimmed = value.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return boundary === 'start'
      ? new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0)
      : new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildLogWhereClause = (query: Record<string, unknown>) => {
  const { type, action, username, gameType, startDate, endDate } = query;
  const where: Record<string, unknown> = {};

  if (type && type !== 'ALL') {
    where.type = type as string;
  }

  if (action) {
    where.action = { contains: action as string };
  }

  if (username) {
    where.OR = [
      { username: { contains: username as string } },
      { targetName: { contains: username as string } },
    ];
  }

  if (gameType && gameType !== 'ALL') {
    where.metadata = { contains: `"gameType":"${gameType}"` };
  }

  const createdAt: Record<string, Date> = {};
  const parsedStartDate = parseLogDateBoundary(startDate, 'start');
  const parsedEndDate = parseLogDateBoundary(endDate, 'end');

  if (parsedStartDate) {
    createdAt.gte = parsedStartDate;
  }

  if (parsedEndDate) {
    createdAt.lte = parsedEndDate;
  }

  if (Object.keys(createdAt).length > 0) {
    where.createdAt = createdAt;
  }

  return where;
};

const WEEKDAY_LABELS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const UPDATE_POPUP_TYPES = new Set(['UPDATE', 'CLAN_PROMPT']);
const UPDATE_POPUP_AUDIENCES = new Set(['ALL', 'NO_CLAN', 'SELECTED_USERS']);

const parseUpdatePopupTargetUserIds = (value: unknown): string[] | null => {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
};

const serializeAdminUpdatePopup = <TPopup extends { targetUserIds: string }>(popup: TPopup) => {
  let targetUserIds: string[] = [];

  try {
    const parsed = JSON.parse(popup.targetUserIds);
    if (Array.isArray(parsed)) {
      targetUserIds = parsed.filter((entry): entry is string => typeof entry === 'string');
    }
  } catch {
    targetUserIds = [];
  }

  return {
    ...popup,
    targetUserIds,
  };
};

type HourBucket = {
  hour: number;
  hourLabel: string;
  total: number;
  sampleCount: number;
  values: Record<string, number>;
};

const createHourlyBuckets = (): HourBucket[] =>
  Array.from({ length: 24 }, (_, hour) => ({
    hour,
    hourLabel: `${String(hour).padStart(2, '0')}h`,
    total: 0,
    sampleCount: 0,
    values: {},
  }));

const roundToSingleDecimal = (value: number) => Math.round(value * 10) / 10;

const normalizeTrackedPagePath = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutHash = trimmed.split('#')[0] ?? trimmed;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  if (!withoutQuery) return null;

  let normalized = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, '');
  }

  if (normalized.startsWith('/profile/')) {
    return '/profile/:id';
  }

  return normalized;
};

const extractGameTypeFromMetadata = (metadata: string | null): string | null => {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    return typeof parsed.gameType === 'string' && parsed.gameType.trim() !== ''
      ? parsed.gameType
      : null;
  } catch {
    return null;
  }
};

type SnapshotUser = {
  userId?: string | null;
  username?: string | null;
  currentPage?: string | null;
};

const parseSnapshotUsers = (raw: string): SnapshotUser[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is SnapshotUser => typeof entry === 'object' && entry !== null)
      : [];
  } catch {
    return [];
  }
};

const GAME_PAGE_PATH_TO_TYPE: Record<string, string> = {
  '/games/2048': 'game_2048',
  '/games/ball-arena': 'ball_arena',
  '/games/bataille-navale': 'battleship',
  '/games/bomb-party': 'bombparty',
  '/games/casino': 'casino',
  '/games/chrome-dino': 'chrome_dino',
  '/games/crossy-road': 'crossy_road',
  '/games/doodle-jump': 'doodle_jump',
  '/games/eaglercraft': 'eaglercraft',
  '/games/echecs': 'chess',
  '/games/flappy-bird': 'flappy_bird',
  '/games/fruit-ninja': 'fruit_ninja',
  '/games/geometry-dash': 'geometry_dash',
  '/games/goyave-empire': 'goyave_empire',
  '/games/hexgl': 'hexgl',
  '/games/knife-hit': 'knife_hit',
  '/games/logic-lab': 'logic_lab',
  '/games/minesweeper': 'minesweeper',
  '/games/morpion': 'morpion',
  '/games/opengd': 'opengd',
  '/games/petit-bac': 'petit_bac',
  '/games/poker': 'poker',
  '/games/polytrack': 'polytrack',
  '/games/puissance-quatre': 'puissance_4',
  '/games/qs-watermelon': 'qs_watermelon',
  '/games/racer': 'racer',
  '/games/russian-roulette': 'russian_roulette',
  '/games/snake': 'snake',
  '/games/solitaire': 'solitaire',
  '/games/stack-tower': 'stack_tower',
  '/games/subway-surfers': 'subway_surfers',
  '/games/tetris': 'tetris',
  '/games/uno': 'uno',
};

const getGameTypeFromCurrentPage = (currentPage: unknown): string | null => {
  const normalizedPage = normalizeTrackedPagePath(currentPage);
  if (!normalizedPage) return null;
  return GAME_PAGE_PATH_TO_TYPE[normalizedPage] ?? null;
};

type SnapshotRecord = {
  createdAt: Date;
  usernames: string;
};

const buildSnapshotWindow = (
  snapshotBeforeStart: SnapshotRecord | null,
  snapshotsInRange: SnapshotRecord[],
  snapshotAfterEnd: SnapshotRecord | null,
) => (
  [snapshotBeforeStart, ...snapshotsInRange, snapshotAfterEnd]
    .filter((snapshot): snapshot is SnapshotRecord => Boolean(snapshot))
    .filter((snapshot, index, array) => (
      array.findIndex((entry) => entry.createdAt.getTime() === snapshot.createdAt.getTime()) === index
    ))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
);

const addSecondsToMap = (map: Map<string, number>, key: string, seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  map.set(key, (map.get(key) ?? 0) + seconds);
};

const addDurationToHourlyBuckets = (
  buckets: ReturnType<typeof createHourlyBuckets>,
  gameType: string,
  intervalStartMs: number,
  intervalEndMs: number,
) => {
  let cursor = intervalStartMs;

  while (cursor < intervalEndMs) {
    const current = new Date(cursor);
    const hourEnd = new Date(current);
    hourEnd.setMinutes(59, 59, 999);

    const segmentEnd = Math.min(intervalEndMs, hourEnd.getTime() + 1);
    const segmentSeconds = (segmentEnd - cursor) / 1000;

    if (segmentSeconds > 0) {
      const bucket = buckets[current.getHours()];
      bucket.values[gameType] = (bucket.values[gameType] ?? 0) + segmentSeconds;
      bucket.total += segmentSeconds;
    }

    cursor = segmentEnd;
  }
};

const collectGameTimeFromSnapshots = (
  snapshots: SnapshotRecord[],
  start: Date,
  end: Date,
) => {
  const totalSecondsByUser = new Map<string, number>();
  const totalSecondsByGame = new Map<string, number>();
  const gameDurationBuckets = createHourlyBuckets();

  for (let index = 0; index < snapshots.length - 1; index += 1) {
    const currentSnapshot = snapshots[index];
    const nextSnapshot = snapshots[index + 1];
    const intervalStartMs = Math.max(currentSnapshot.createdAt.getTime(), start.getTime());
    const intervalEndMs = Math.min(nextSnapshot.createdAt.getTime(), end.getTime());
    const durationSeconds = (intervalEndMs - intervalStartMs) / 1000;

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      continue;
    }

    for (const user of parseSnapshotUsers(currentSnapshot.usernames)) {
      if (typeof user.userId !== 'string' || user.userId === '') continue;

      const gameType = getGameTypeFromCurrentPage(user.currentPage);
      if (!gameType) continue;

      addSecondsToMap(totalSecondsByUser, user.userId, durationSeconds);
      addSecondsToMap(totalSecondsByGame, gameType, durationSeconds);
      addDurationToHourlyBuckets(gameDurationBuckets, gameType, intervalStartMs, intervalEndMs);
    }
  }

  return {
    totalSecondsByUser,
    totalSecondsByGame,
    gameDurationBuckets,
  };
};

// Middleware to check if user is admin
const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Middleware for routes accessible by admins OR fiscal inspectors (read-only access)
const requireAdminOrFiscal = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user?.isAdmin && !req.user?.isFiscalInspector) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const toUserRoleFlags = (role: 'USER' | 'BETA_TESTER' | 'ADMIN' | 'SUPER_ADMIN' | 'FISCAL_INSPECTOR') => ({
  isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN',
  isSuperAdmin: role === 'SUPER_ADMIN',
  isBetaTester: role === 'BETA_TESTER',
  isFiscalInspector: role === 'FISCAL_INSPECTOR',
});

const serializeRegistrationReview = (review: {
  id: string;
  registrationUserId: string;
  username: string;
  firstName: string | null;
  schoolLevel: string | null;
  classLetter: string | null;
  email: string;
  motivationMessage: string | null;
  registrationCreatedAt: Date;
  status: string;
  reviewedAt: Date;
  reviewedById: string | null;
  importedFromLegacy: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...review,
  registrationCreatedAt: review.registrationCreatedAt.toISOString(),
  reviewedAt: review.reviewedAt.toISOString(),
  createdAt: review.createdAt.toISOString(),
  updatedAt: review.updatedAt.toISOString(),
});

type RegistrationReviewImportEntry = {
  registrationUserId: string;
  username: string;
  firstName: string | null;
  schoolLevel: string | null;
  classLetter: string | null;
  email: string;
  motivationMessage: string | null;
  registrationCreatedAt: Date;
  status: 'APPROVED' | 'REJECTED';
  reviewedAt: Date;
  reviewedById: string;
  importedFromLegacy: true;
};

const adminClanMemberUserSelect = {
  id: true,
  username: true,
  usernameColor: true,
  profilePicture: true,
  aura: true,
} as const;

// ========== PENDING USERS MANAGEMENT ==========

// Get pending users (awaiting approval)
router.get('/pending-users', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { isApproved: false },
      select: {
        id: true,
        username: true,
        firstName: true,
        schoolLevel: true,
        classLetter: true,
        email: true,
        motivationMessage: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ pendingUsers });
  } catch (error) {
    console.error('Admin get pending users error:', error);
    res.status(500).json({ error: 'Failed to get pending users' });
  }
});

router.get('/registration-reviews', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const registrationReviews = await prisma.registrationReview.findMany({
      orderBy: { reviewedAt: 'desc' },
    });
    res.json({ registrationReviews: registrationReviews.map(serializeRegistrationReview) });
  } catch (error) {
    console.error('Admin get registration reviews error:', error);
    res.status(500).json({ error: 'Failed to get registration reviews' });
  }
});

router.post('/registration-reviews/import-local', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const rawEntries: unknown[] | null = Array.isArray(req.body?.entries) ? req.body.entries : null;
    if (!rawEntries) {
      return res.status(400).json({ error: 'entries must be an array' });
    }

    const reviewedAt = new Date();
    const entries = rawEntries
      .map((entry): RegistrationReviewImportEntry | null => {
        if (!entry || typeof entry !== 'object') return null;
        const candidate = entry as Record<string, unknown>;

        const status = candidate.registrationStatus === 'APPROVED' || candidate.registrationStatus === 'REJECTED'
          ? candidate.registrationStatus
          : null;
        const registrationUserId = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : null;
        const username = typeof candidate.username === 'string' && candidate.username.trim() ? candidate.username.trim() : null;
        const email = typeof candidate.email === 'string' && candidate.email.trim() ? candidate.email.trim() : null;
        const registrationCreatedAt = typeof candidate.createdAt === 'string' ? new Date(candidate.createdAt) : null;

        if (!status || !registrationUserId || !username || !email || !registrationCreatedAt || Number.isNaN(registrationCreatedAt.getTime())) {
          return null;
        }

        return {
          registrationUserId,
          username,
          firstName: typeof candidate.firstName === 'string' && candidate.firstName.trim() ? candidate.firstName.trim() : null,
          schoolLevel: typeof candidate.schoolLevel === 'string' && candidate.schoolLevel.trim() ? candidate.schoolLevel.trim() : null,
          classLetter: typeof candidate.classLetter === 'string' && candidate.classLetter.trim() ? candidate.classLetter.trim() : null,
          email,
          motivationMessage: typeof candidate.motivationMessage === 'string' && candidate.motivationMessage.trim() ? candidate.motivationMessage : null,
          registrationCreatedAt,
          status,
          reviewedAt,
          reviewedById: req.user!.id,
          importedFromLegacy: true,
        };
      })
      .filter((entry): entry is RegistrationReviewImportEntry => entry !== null);

    if (entries.length === 0) {
      return res.status(400).json({ error: 'No valid entries to import' });
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await tx.registrationReview.upsert({
          where: { registrationUserId: entry.registrationUserId },
          update: entry,
          create: entry,
        });
      }

      const registrationReviews = await tx.registrationReview.findMany({
        orderBy: { reviewedAt: 'desc' },
      });

      return { registrationReviews };
    });

    res.json({
      success: true,
      importedCount: entries.length,
      registrationReviews: result.registrationReviews.map(serializeRegistrationReview),
    });

    logAdmin('registration_reviews_import', req.user!.id, req.user!.username, undefined, undefined, {
      importedCount: entries.length,
      statuses: entries.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.status] = (acc[entry.status] ?? 0) + 1;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Admin import registration reviews error:', error);
    res.status(500).json({ error: 'Failed to import registration reviews' });
  }
});

router.get('/ads/pending', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const pendingAds = await prisma.ad.findMany({
      where: { status: 'PENDING' },
      include: {
        business: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ pendingAds });
  } catch (error) {
    console.error('Admin get pending ads error:', error);
    res.status(500).json({ error: 'Failed to get pending ads' });
  }
});

router.get('/ads', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const ads = await prisma.ad.findMany({
      include: {
        business: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
    });

    res.json({ ads });
  } catch (error) {
    console.error('Admin get all ads error:', error);
    res.status(500).json({ error: 'Failed to get all ads' });
  }
});

router.post('/ads/:id/approve', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ad = await prisma.ad.findUnique({
      where: { id: req.params.id },
      include: {
        business: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!ad) {
      return res.status(404).json({ error: 'AD_NOT_FOUND' });
    }

    if (ad.status !== 'PENDING') {
      return res.status(400).json({ error: 'AD_ALREADY_REVIEWED' });
    }

    const updated = await prisma.ad.update({
      where: { id: ad.id },
      data: {
        status: 'APPROVED',
        isActive: true,
        reviewedAt: new Date(),
        reviewedById: req.user!.id,
      },
      include: {
        business: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    logAdmin('ad_approve', req.user!.id, req.user!.username, ad.business.ownerId, ad.business.owner.username, {
      adId: ad.id,
      businessId: ad.businessId,
      title: ad.title,
      adType: ad.adType,
    });

    createNotification({
      userId: ad.business.ownerId,
      type: 'SYSTEM',
      title: 'Publicite approuvee',
      body: `Ta publicite "${ad.title}" a ete approuvee et peut maintenant apparaitre sur le site.`,
      data: { adId: ad.id, businessId: ad.businessId, status: 'APPROVED' },
      link: '/you?tab=publicites',
      icon: 'megaphone',
    }).catch(() => {});

    res.json({ ad: updated });
  } catch (error) {
    console.error('Admin approve ad error:', error);
    res.status(500).json({ error: 'Failed to approve ad' });
  }
});

router.post('/ads/:id/reject', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ad = await prisma.ad.findUnique({
      where: { id: req.params.id },
      include: {
        business: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!ad) {
      return res.status(404).json({ error: 'AD_NOT_FOUND' });
    }

    if (ad.status !== 'PENDING') {
      return res.status(400).json({ error: 'AD_ALREADY_REVIEWED' });
    }

    const updated = await prisma.ad.update({
      where: { id: ad.id },
      data: {
        status: 'REJECTED',
        isActive: false,
        reviewedAt: new Date(),
        reviewedById: req.user!.id,
      },
      include: {
        business: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    logAdmin('ad_reject', req.user!.id, req.user!.username, ad.business.ownerId, ad.business.owner.username, {
      adId: ad.id,
      businessId: ad.businessId,
      title: ad.title,
      adType: ad.adType,
    });

    createNotification({
      userId: ad.business.ownerId,
      type: 'SYSTEM',
      title: 'Publicite rejetee',
      body: `Ta publicite "${ad.title}" a ete rejetee par l'administration.`,
      data: { adId: ad.id, businessId: ad.businessId, status: 'REJECTED' },
      link: '/you?tab=publicites',
      icon: 'megaphone',
    }).catch(() => {});

    res.json({ ad: updated });
  } catch (error) {
    console.error('Admin reject ad error:', error);
    res.status(500).json({ error: 'Failed to reject ad' });
  }
});

router.delete('/ads/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ad = await prisma.ad.findUnique({
      where: { id: req.params.id },
      include: {
        business: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!ad) {
      return res.status(404).json({ error: 'AD_NOT_FOUND' });
    }

    await prisma.ad.delete({ where: { id: ad.id } });

    logAdmin('ad_delete_forever', req.user!.id, req.user!.username, ad.business.ownerId, ad.business.owner.username, {
      adId: ad.id,
      businessId: ad.businessId,
      title: ad.title,
      adType: ad.adType,
      previousStatus: ad.status,
      previousIsActive: ad.isActive,
    });

    createNotification({
      userId: ad.business.ownerId,
      type: 'SYSTEM',
      title: 'Publicite supprimee',
      body: `Ta publicite "${ad.title}" a ete supprimee definitivement par l'administration.`,
      data: { adId: ad.id, businessId: ad.businessId, status: 'DELETED' },
      link: '/you?tab=publicites',
      icon: 'megaphone',
    }).catch(() => {});

    res.json({ ok: true });
  } catch (error) {
    console.error('Admin delete ad error:', error);
    res.status(500).json({ error: 'Failed to delete ad' });
  }
});

router.patch('/ads/:id/toggle', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ad = await prisma.ad.findUnique({ where: { id: req.params.id } });
    if (!ad) return res.status(404).json({ error: 'AD_NOT_FOUND' });
    const updated = await prisma.ad.update({
      where: { id: ad.id },
      data: { isActive: !ad.isActive },
      include: {
        business: {
          include: {
            owner: { select: { id: true, username: true } },
          },
        },
      },
    });
    res.json({ ad: updated });
  } catch (error) {
    console.error('Admin toggle ad error:', error);
    res.status(500).json({ error: 'Failed to toggle ad visibility' });
  }
});

// Approve a user
router.post('/users/:id/approve', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        firstName: true,
        schoolLevel: true,
        classLetter: true,
        email: true,
        motivationMessage: true,
        createdAt: true,
        isApproved: true,
        referredById: true,
        referralRewardGrantedAt: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (existingUser.isApproved) {
      return res.status(400).json({ error: 'User already approved' });
    }

    const [rewardAmount, referralsEnabled] = await Promise.all([
      getReferralRewardAmount(),
      isReferralEnabled(),
    ]);

    const result = await prisma.$transaction(async (tx) => {
      let rewardGrantedToReferrer: { id: string; username: string } | null = null;
      const reviewedAt = new Date();

      await tx.user.update({
        where: { id },
        data: { isApproved: true },
      });

      await tx.registrationReview.upsert({
        where: { registrationUserId: id },
        update: {
          username: existingUser.username,
          firstName: existingUser.firstName,
          schoolLevel: existingUser.schoolLevel,
          classLetter: existingUser.classLetter,
          email: existingUser.email,
          motivationMessage: existingUser.motivationMessage,
          registrationCreatedAt: existingUser.createdAt,
          status: 'APPROVED',
          reviewedAt,
          reviewedById: req.user!.id,
          importedFromLegacy: false,
        },
        create: {
          registrationUserId: id,
          username: existingUser.username,
          firstName: existingUser.firstName,
          schoolLevel: existingUser.schoolLevel,
          classLetter: existingUser.classLetter,
          email: existingUser.email,
          motivationMessage: existingUser.motivationMessage,
          registrationCreatedAt: existingUser.createdAt,
          status: 'APPROVED',
          reviewedAt,
          reviewedById: req.user!.id,
          importedFromLegacy: false,
        },
      });

      if (existingUser.referredById && !existingUser.referralRewardGrantedAt) {
        const referrer = await tx.user.findUnique({
          where: { id: existingUser.referredById },
          select: { id: true, username: true },
        });

        if (referrer) {
          if (referralsEnabled && rewardAmount > 0) {
            rewardGrantedToReferrer = referrer;
            await tx.user.update({
              where: { id },
              data: {
                money: { increment: rewardAmount },
                referralRewardGrantedAt: new Date(),
              },
            });

            await tx.user.update({
              where: { id: referrer.id },
              data: {
                money: { increment: rewardAmount },
              },
            });
          } else {
            await tx.user.update({
              where: { id },
              data: {
                referralRewardGrantedAt: new Date(),
              },
            });
          }
        }
      }

      const approvedUser = await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          isApproved: true,
          createdAt: true,
        },
      });

      return { user: approvedUser, rewardGrantedToReferrer };
    });
    
    if (!result.user) {
      return res.status(404).json({ error: 'User not found after approval' });
    }

    logAdmin('user_approve', req.user!.id, undefined, id, result.user.username, {
      email: result.user.email,
      referralRewardAmount: result.rewardGrantedToReferrer ? rewardAmount : 0,
      referralRewardRecipient: result.rewardGrantedToReferrer?.username,
    });

    const user = result.user;

    createNotification({
      userId: id,
      type: 'SYSTEM',
      title: 'Compte approuvé',
      body: 'Ton compte a été approuvé. Tu peux maintenant te connecter.',
      data: {
        approvedAt: new Date().toISOString(),
      },
      link: '/login',
      icon: 'badge-check',
    }).catch(() => {});

    if (result.rewardGrantedToReferrer && rewardAmount > 0) {
      createNotification({
        userId: id,
        type: 'SYSTEM',
        title: 'Prime de parrainage',
        body: `Tu as recu ${rewardAmount} money apres validation de ton compte.`,
        data: {
          rewardAmount,
          referredById: result.rewardGrantedToReferrer.id,
        },
        link: '/dashboard',
        icon: 'coins',
      }).catch(() => {});

      createNotification({
        userId: result.rewardGrantedToReferrer.id,
        type: 'SYSTEM',
        title: 'Parrainage valide',
        body: `${result.user.username} a ete approuve. Tu recois ${rewardAmount} money.`,
        data: {
          referredUserId: result.user.id,
          referredUsername: result.user.username,
          rewardAmount,
        },
        link: '/dashboard',
        icon: 'sparkles',
      }).catch(() => {});
    }

    res.json({ success: true, user, message: 'Utilisateur approuvé' });
  } catch (error) {
    console.error('Admin approve user error:', error);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Reject (delete) a pending user
router.post('/users/:id/reject', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check that user is pending
    const user = await prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.isApproved) {
      return res.status(400).json({ error: 'Cannot reject an already approved user' });
    }
    
    // Log rejection
    logAdmin('user_reject', req.user!.id, undefined, id, user.username, { email: user.email });

    await prisma.$transaction(async (tx) => {
      const reviewedAt = new Date();

      await tx.registrationReview.upsert({
        where: { registrationUserId: id },
        update: {
          username: user.username,
          firstName: user.firstName,
          schoolLevel: user.schoolLevel,
          classLetter: user.classLetter,
          email: user.email,
          motivationMessage: user.motivationMessage,
          registrationCreatedAt: user.createdAt,
          status: 'REJECTED',
          reviewedAt,
          reviewedById: req.user!.id,
          importedFromLegacy: false,
        },
        create: {
          registrationUserId: id,
          username: user.username,
          firstName: user.firstName,
          schoolLevel: user.schoolLevel,
          classLetter: user.classLetter,
          email: user.email,
          motivationMessage: user.motivationMessage,
          registrationCreatedAt: user.createdAt,
          status: 'REJECTED',
          reviewedAt,
          reviewedById: req.user!.id,
          importedFromLegacy: false,
        },
      });

      await tx.user.delete({
        where: { id },
      });
    });

    res.json({ success: true, message: 'Demande rejetée' });
  } catch (error) {
    console.error('Admin reject user error:', error);
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

// ========== ITEMS MANAGEMENT ==========

// Get all items (admin view)
router.get('/items', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.item.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  } catch (error) {
    console.error('Admin get items error:', error);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

// Create item
router.post('/items', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, type, price, imageUrl, effect } = req.body;

    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }
    
    const item = await prisma.item.create({
      data: {
        name,
        description,
        type: type || 'COSMETIC',
        price: parseInt(price) || 0,
        imageUrl,
        effect: typeof effect === 'string' ? effect : JSON.stringify(effect),
      },
    });

    logAdmin('item_create', req.user!.id, req.user!.username, item.id, item.name, {
      type: item.type,
      price: item.price,
      imageUrl: item.imageUrl,
    });
    
    res.status(201).json({ item });
  } catch (error) {
    console.error('Admin create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

router.post('/items/import', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const payload = (req.body ?? {}) as Partial<ShopItemImportFile> & { items?: unknown };
    const items = Array.isArray(payload?.items) ? payload.items : null;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Le fichier doit contenir un tableau "items" non vide' });
    }

    if (payload.format && payload.format !== SHOP_ITEMS_EXPORT_FORMAT) {
      return res.status(400).json({ error: 'Format de fichier d’import non reconnu' });
    }

    if (payload.version != null && payload.version !== SHOP_ITEMS_EXPORT_VERSION) {
      return res.status(400).json({ error: 'Version de fichier d’import non supportée' });
    }

    const normalizedItems: Array<Omit<ShopItemImportInput, 'effect'> & { effect: string | null }> = [];

    for (const entry of items) {
      const normalized = normalizeImportedItem(entry);
      if ('error' in normalized) {
        return res.status(400).json({ error: normalized.error });
      }
      normalizedItems.push(normalized.item);
    }

    const createdItems = await prisma.$transaction(
      normalizedItems.map((item) => prisma.item.create({ data: item })),
    );

    logAdmin('item_import', req.user!.id, req.user!.username, undefined, undefined, {
      count: createdItems.length,
      names: createdItems.map((item) => item.name),
      format: SHOP_ITEMS_EXPORT_FORMAT,
      version: SHOP_ITEMS_EXPORT_VERSION,
    });

    res.status(201).json({ success: true, count: createdItems.length, items: createdItems });
  } catch (error) {
    console.error('Admin import items error:', error);
    res.status(500).json({ error: 'Failed to import items' });
  }
});

// Update item
router.put('/items/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, type, price, imageUrl, effect } = req.body;

    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }
    
    const existingItem = await prisma.item.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        price: true,
        imageUrl: true,
        effect: true,
      },
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = await prisma.item.update({
      where: { id },
      data: {
        name,
        description,
        type,
        price: parseInt(price) || 0,
        imageUrl,
        effect: typeof effect === 'string' ? effect : JSON.stringify(effect),
      },
    });

    logAdmin('item_update', req.user!.id, req.user!.username, item.id, item.name, {
      previousValues: {
        name: existingItem.name,
        description: existingItem.description,
        type: existingItem.type,
        price: existingItem.price,
        imageUrl: existingItem.imageUrl,
        effect: existingItem.effect,
      },
      newValues: {
        name: item.name,
        description: item.description,
        type: item.type,
        price: item.price,
        imageUrl: item.imageUrl,
        effect: item.effect,
      },
    });
    
    res.json({ item });
  } catch (error) {
    console.error('Admin update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete item
router.delete('/items/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const item = await prisma.item.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, price: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await prisma.item.delete({
      where: { id },
    });

    logAdmin('item_delete', req.user!.id, req.user!.username, item.id, item.name, {
      type: item.type,
      price: item.price,
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ========== SHOP CATEGORIES MANAGEMENT ==========

const DEFAULT_SHOP_CATEGORIES = [
  { id: 'COSMETIC', label: 'Cosmétiques' },
  { id: 'CONSUMABLE', label: 'Objets' },
  { id: 'UPGRADE', label: 'Améliorations' },
];

router.get('/shop-categories', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const setting = await prisma.gameSettings.findUnique({ where: { key: 'shop_categories' } });
    const categories = setting ? JSON.parse(setting.value) : DEFAULT_SHOP_CATEGORIES;
    res.json({ categories });
  } catch (error) {
    console.error('Admin get shop categories error:', error);
    res.status(500).json({ error: 'Failed to get shop categories' });
  }
});

router.put('/shop-categories', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'Categories must be an array' });
    }
    await prisma.gameSettings.upsert({
      where: { key: 'shop_categories' },
      create: { key: 'shop_categories', value: JSON.stringify(categories) },
      update: { value: JSON.stringify(categories) },
    });

    logAdmin('shop_categories_update', req.user!.id, req.user!.username, undefined, undefined, {
      count: categories.length,
      categories,
    });

    res.json({ categories });
  } catch (error) {
    console.error('Admin update shop categories error:', error);
    res.status(500).json({ error: 'Failed to update shop categories' });
  }
});

// ========== CLANS MANAGEMENT ==========

router.get('/clans', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const clans = await prisma.clan.findMany({
      include: {
        owner: {
          select: adminClanMemberUserSelect,
        },
        members: {
          include: {
            user: {
              select: adminClanMemberUserSelect,
            },
          },
          orderBy: [
            { isLeader: 'desc' },
            { joinedAt: 'asc' },
          ],
        },
        attackerWars: {
          where: { status: { in: ['PREPARING', 'ACTIVE'] } },
          select: { id: true, status: true, startsAt: true, endsAt: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        defenderWars: {
          where: { status: { in: ['PREPARING', 'ACTIVE'] } },
          select: { id: true, status: true, startsAt: true, endsAt: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      clans: clans.map((clan) => ({
        id: clan.id,
        name: clan.name,
        description: clan.description,
        imageUrl: clan.imageUrl,
        tagUnlocked: clan.tagUnlocked,
        isPublic: clan.isPublic,
        maxMembers: clan.maxMembers,
        clanBankMoney: clan.clanBankMoney,
        createdAt: clan.createdAt,
        updatedAt: clan.updatedAt,
        owner: clan.owner,
        members: clan.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          isLeader: member.isLeader,
          joinedAt: member.joinedAt,
          user: member.user,
        })),
        activeWar: clan.attackerWars[0] ?? clan.defenderWars[0] ?? null,
      })),
    });
  } catch (error) {
    console.error('Admin get clans error:', error);
    res.status(500).json({ error: 'Failed to get clans' });
  }
});

router.put('/clans/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rawName = typeof req.body.name === 'string' ? req.body.name.trim() : undefined;
    const rawDescription = typeof req.body.description === 'string' ? req.body.description.trim() : undefined;
    const rawImageUrl = typeof req.body.imageUrl === 'string' ? req.body.imageUrl.trim() : undefined;
    const isPublic = typeof req.body.isPublic === 'boolean' ? req.body.isPublic : undefined;
    const tagUnlocked = typeof req.body.tagUnlocked === 'boolean' ? req.body.tagUnlocked : undefined;
    const maxMembers = req.body.maxMembers !== undefined ? Number(req.body.maxMembers) : undefined;

    const clan = await prisma.clan.findUnique({
      where: { id },
      include: {
        members: {
          select: { id: true },
        },
      },
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    if (rawName !== undefined && (rawName.length < 3 || rawName.length > 32)) {
      return res.status(400).json({ error: 'Nom de clan invalide (3-32 caracteres).' });
    }

    if (rawDescription !== undefined && rawDescription.length > 300) {
      return res.status(400).json({ error: 'Description trop longue (max 300 caracteres).' });
    }

    if (rawImageUrl && !isAllowedImageUrl(rawImageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }

    if (maxMembers !== undefined) {
      if (!Number.isInteger(maxMembers) || maxMembers < clan.members.length || maxMembers > ADMIN_CLAN_MAX_MEMBERS_LIMIT) {
        return res.status(400).json({
          error: `maxMembers doit etre un entier entre ${clan.members.length} et ${ADMIN_CLAN_MAX_MEMBERS_LIMIT}.`,
        });
      }
    }

    const updatedClan = await prisma.clan.update({
      where: { id },
      data: {
        ...(rawName !== undefined ? { name: rawName } : {}),
        ...(rawDescription !== undefined ? { description: rawDescription || null } : {}),
        ...(rawImageUrl !== undefined ? { imageUrl: rawImageUrl || null } : {}),
        ...(isPublic !== undefined ? { isPublic } : {}),
        ...(tagUnlocked !== undefined ? { tagUnlocked } : {}),
        ...(maxMembers !== undefined ? { maxMembers } : {}),
      },
      include: {
        owner: { select: adminClanMemberUserSelect },
        members: {
          include: {
            user: { select: adminClanMemberUserSelect },
          },
          orderBy: [
            { isLeader: 'desc' },
            { joinedAt: 'asc' },
          ],
        },
      },
    });

    logAdmin('clan_update', req.user!.id, undefined, id, updatedClan.name, {
      maxMembers: updatedClan.maxMembers,
      isPublic: updatedClan.isPublic,
    });

    res.json({
      clan: {
        id: updatedClan.id,
        name: updatedClan.name,
        description: updatedClan.description,
        imageUrl: updatedClan.imageUrl,
        tagUnlocked: updatedClan.tagUnlocked,
        isPublic: updatedClan.isPublic,
        maxMembers: updatedClan.maxMembers,
        clanBankMoney: updatedClan.clanBankMoney,
        createdAt: updatedClan.createdAt,
        updatedAt: updatedClan.updatedAt,
        owner: updatedClan.owner,
        members: updatedClan.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          isLeader: member.isLeader,
          joinedAt: member.joinedAt,
          user: member.user,
        })),
      },
    });
  } catch (error) {
    console.error('Admin update clan error:', error);
    res.status(500).json({ error: 'Failed to update clan' });
  }
});

router.post('/clans/:id/transfer-leadership', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const targetUserId = typeof req.body.targetUserId === 'string' ? req.body.targetUserId : '';

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    const clan = await prisma.clan.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true } },
        members: {
          include: {
            user: { select: adminClanMemberUserSelect },
          },
        },
      },
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    const targetMember = clan.members.find((member) => member.userId === targetUserId);
    if (!targetMember) {
      return res.status(400).json({ error: 'Le nouveau chef doit deja etre membre du clan.' });
    }

    if (clan.ownerId === targetUserId) {
      return res.status(400).json({ error: 'Ce joueur est deja chef du clan.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.clanMember.updateMany({
        where: { clanId: id, isLeader: true },
        data: { isLeader: false },
      });

      await tx.clanMember.update({
        where: {
          clanId_userId: {
            clanId: id,
            userId: targetUserId,
          },
        },
        data: { isLeader: true },
      });

      await tx.clan.update({
        where: { id },
        data: { ownerId: targetUserId },
      });
    });

    logAdmin('clan_transfer_leadership', req.user!.id, undefined, id, clan.name, {
      previousLeaderId: clan.owner.id,
      previousLeaderUsername: clan.owner.username,
      newLeaderId: targetMember.user.id,
      newLeaderUsername: targetMember.user.username,
    });

    createNotification({
      userId: targetUserId,
      type: 'SYSTEM',
      title: 'Nouveau chef de clan',
      body: `Un administrateur vous a nomme chef du clan ${clan.name}.`,
      data: { clanId: clan.id, clanName: clan.name },
      link: '/clans',
      icon: 'crown',
    }).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Admin transfer clan leadership error:', error);
    res.status(500).json({ error: 'Failed to transfer clan leadership' });
  }
});

router.delete('/clans/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const clan = await prisma.clan.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    await prisma.clan.delete({
      where: { id },
    });

    logAdmin('clan_delete', req.user!.id, undefined, clan.id, clan.name);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete clan error:', error);
    res.status(500).json({ error: 'Failed to delete clan' });
  }
});

router.get('/clan-events', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    await advanceClanEventsState();
    const events = await prisma.clanEvent.findMany({
      include: clanEventAdminInclude,
      orderBy: [
        { endsAt: 'desc' },
        { startsAt: 'desc' },
      ],
    });

    res.json({ events: events.map(serializeClanEventAdmin) });
  } catch (error) {
    console.error('Admin get clan events error:', error);
    res.status(500).json({ error: 'Failed to get clan events' });
  }
});

router.post('/clan-events', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const normalized = normalizeClanEventInput(req.body as Record<string, unknown>);
    if ('error' in normalized) {
      return res.status(400).json({ error: normalized.error });
    }

    const rewardItemIds = normalized.rewardTiers
      .map((tier) => tier.itemId)
      .filter((itemId): itemId is string => Boolean(itemId));

    if (rewardItemIds.length > 0) {
      const foundItems = await prisma.item.findMany({
        where: { id: { in: rewardItemIds } },
        select: { id: true },
      });
      if (foundItems.length !== rewardItemIds.length) {
        return res.status(400).json({ error: 'Un objet de récompense est introuvable.' });
      }
    }

    const slug = await ensureUniqueClanEventSlug(normalized.title);
    const event = await prisma.clanEvent.create({
      data: {
        title: normalized.title,
        slug,
        description: normalized.description,
        bannerUrl: normalized.bannerUrl,
        status: normalized.status,
        highlightColor: normalized.highlightColor,
        rulesSummary: normalized.rulesSummary,
        startsAt: normalized.startsAt,
        endsAt: normalized.endsAt,
        createdById: req.user!.id,
        quests: {
          create: normalized.quests,
        },
        miniGames: {
          create: normalized.miniGames,
        },
        rewardTiers: {
          create: normalized.rewardTiers,
        },
      },
      include: clanEventAdminInclude,
    });

    if (normalized.status === 'COMPLETED') {
      await finalizeClanEvent(event.id);
    } else {
      await advanceClanEventsState();
    }
    res.status(201).json({ event: serializeClanEventAdmin(event) });
  } catch (error) {
    console.error('Admin create clan event error:', error);
    res.status(500).json({ error: 'Failed to create clan event' });
  }
});

router.put('/clan-events/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const normalized = normalizeClanEventInput(req.body as Record<string, unknown>);
    if ('error' in normalized) {
      return res.status(400).json({ error: normalized.error });
    }

    const existing = await prisma.clanEvent.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Événement introuvable.' });
    }

    const rewardItemIds = normalized.rewardTiers
      .map((tier) => tier.itemId)
      .filter((itemId): itemId is string => Boolean(itemId));

    if (rewardItemIds.length > 0) {
      const foundItems = await prisma.item.findMany({
        where: { id: { in: rewardItemIds } },
        select: { id: true },
      });
      if (foundItems.length !== rewardItemIds.length) {
        return res.status(400).json({ error: 'Un objet de récompense est introuvable.' });
      }
    }

    const slug = await ensureUniqueClanEventSlug(normalized.title, id);
    const event = await prisma.$transaction(async (tx) => {
      await tx.clanEventQuest.deleteMany({ where: { eventId: id } });
      await tx.clanEventMiniGame.deleteMany({ where: { eventId: id } });
      await tx.clanEventRewardTier.deleteMany({ where: { eventId: id } });

      return tx.clanEvent.update({
        where: { id },
        data: {
          title: normalized.title,
          slug,
          description: normalized.description,
          bannerUrl: normalized.bannerUrl,
          status: normalized.status,
          highlightColor: normalized.highlightColor,
          rulesSummary: normalized.rulesSummary,
          startsAt: normalized.startsAt,
          endsAt: normalized.endsAt,
          quests: {
            create: normalized.quests,
          },
          miniGames: {
            create: normalized.miniGames,
          },
          rewardTiers: {
            create: normalized.rewardTiers,
          },
        },
        include: clanEventAdminInclude,
      });
    });

    if (normalized.status === 'COMPLETED') {
      await finalizeClanEvent(event.id);
    } else {
      await advanceClanEventsState();
    }
    res.json({ event: serializeClanEventAdmin(event) });
  } catch (error) {
    console.error('Admin update clan event error:', error);
    res.status(500).json({ error: 'Failed to update clan event' });
  }
});

router.delete('/clan-events/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.clanEvent.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete clan event error:', error);
    res.status(500).json({ error: 'Failed to delete clan event' });
  }
});

// Get all approved users with full details (admin only)
router.get('/users', authMiddleware, requireAdminOrFiscal, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { isApproved: true }, // Only return approved users
      select: {
        id: true,
        username: true,
        firstName: true,
        email: true,
        aura: true,
        money: true,
        auraCoinBalance: true,
        isAdmin: true,
        isSuperAdmin: true,
        isBetaTester: true,
        isChatMuted: true,
        dailyAuraGiven: true,
        dailyAuraLimit: true,
        lastDailyReset: true,
        schoolLevel: true,
        classLetter: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const userIds = users.map((user) => user.id);
    const relationships = userIds.length > 0
      ? await prisma.relationship.findMany({
        where: {
          status: 'MARRIED',
          OR: [
            { userAId: { in: userIds } },
            { userBId: { in: userIds } },
          ],
        },
        select: {
          id: true,
          userAId: true,
          userBId: true,
          coupleBalance: true,
          marriedAt: true,
          userA: {
            select: {
              id: true,
              username: true,
              money: true,
            },
          },
          userB: {
            select: {
              id: true,
              username: true,
              money: true,
            },
          },
        },
      })
      : [];

    const sharedMoneyByUserId = new Map<string, {
      relationshipId: string;
      coupleBalance: number;
      marriedAt: string | null;
      partner: { id: string; username: string; money: number };
    }>();

    for (const relationship of relationships) {
      sharedMoneyByUserId.set(relationship.userAId, {
        relationshipId: relationship.id,
        coupleBalance: relationship.coupleBalance,
        marriedAt: relationship.marriedAt ? relationship.marriedAt.toISOString() : null,
        partner: {
          id: relationship.userB.id,
          username: relationship.userB.username,
          money: relationship.userB.money,
        },
      });
      sharedMoneyByUserId.set(relationship.userBId, {
        relationshipId: relationship.id,
        coupleBalance: relationship.coupleBalance,
        marriedAt: relationship.marriedAt ? relationship.marriedAt.toISOString() : null,
        partner: {
          id: relationship.userA.id,
          username: relationship.userA.username,
          money: relationship.userA.money,
        },
      });
    }

    res.json({
      users: users.map((user) => ({
        ...user,
        sharedMoney: sharedMoneyByUserId.get(user.id) ?? null,
      })),
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user (aura, money, dailyAuraLimit) - admin only
router.put('/users/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { aura, money, auraCoinBalance, dailyAuraLimit, username, firstName, password, isChatMuted, role } = req.body;

    // Build update data
    const updateData: {
      aura?: number;
      money?: number;
      auraCoinBalance?: number;
      dailyAuraLimit?: number;
      username?: string;
      firstName?: string | null;
      passwordHash?: string;
      isChatMuted?: boolean;
      isAdmin?: boolean;
      isSuperAdmin?: boolean;
      isBetaTester?: boolean;
    } = {};

    if (username !== undefined) {
      if (typeof username !== 'string') {
        return res.status(400).json({ error: 'Invalid username' });
      }
      const trimmedUsername = username.trim();
      if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
      }
      const existing = await prisma.user.findFirst({
        where: {
          username: trimmedUsername,
          NOT: { id },
        },
        select: { id: true },
      });
      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      updateData.username = trimmedUsername;
    }

    if (firstName !== undefined) {
      if (firstName === null) {
        updateData.firstName = null;
      } else if (typeof firstName === 'string') {
        const trimmedFirstName = firstName.trim();
        if (trimmedFirstName.length === 0) {
          updateData.firstName = null;
        } else if (trimmedFirstName.length > 50) {
          return res.status(400).json({ error: 'First name must be 50 characters or less' });
        } else {
          updateData.firstName = trimmedFirstName;
        }
      } else {
        return res.status(400).json({ error: 'Invalid first name' });
      }
    }
    
    if (aura !== undefined) {
      updateData.aura = parseInt(aura);
    }
    if (money !== undefined) {
      updateData.money = parseInt(money);
    }
    if (auraCoinBalance !== undefined) {
      updateData.auraCoinBalance = parseFloat(auraCoinBalance);
    }
    if (dailyAuraLimit !== undefined) {
      updateData.dailyAuraLimit = parseInt(dailyAuraLimit);
    }
    if (isChatMuted !== undefined) {
      if (typeof isChatMuted !== 'boolean') {
        return res.status(400).json({ error: 'Invalid chat mute status' });
      }
      updateData.isChatMuted = isChatMuted;
    }
    if (password !== undefined) {
      if (typeof password !== 'string') {
        return res.status(400).json({ error: 'Invalid password' });
      }
      const normalizedPassword = password.trim();
      if (normalizedPassword.length < 6 || normalizedPassword.length > 100) {
        return res.status(400).json({ error: 'Password must be between 6 and 100 characters' });
      }
      updateData.passwordHash = await bcrypt.hash(normalizedPassword, 10);
    }
    if (role !== undefined) {
      if (role !== 'USER' && role !== 'BETA_TESTER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'FISCAL_INSPECTOR') {
        return res.status(400).json({ error: 'Invalid role' });
      }
      if (req.user?.id === id) {
        return res.status(400).json({ error: 'Cannot change your own role' });
      }
      Object.assign(updateData, toUserRoleFlags(role));
    }

    // Get old user data for logging
    const oldUser = await prisma.user.findUnique({
      where: { id },
      select: {
        username: true,
        firstName: true,
        aura: true,
        money: true,
        auraCoinBalance: true,
        dailyAuraLimit: true,
        isChatMuted: true,
        isAdmin: true,
        isSuperAdmin: true,
        isBetaTester: true,
      },
    });

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        firstName: true,
        email: true,
        aura: true,
        money: true,
        auraCoinBalance: true,
        isAdmin: true,
        isSuperAdmin: true,
        isBetaTester: true,
        isChatMuted: true,
        dailyAuraGiven: true,
        dailyAuraLimit: true,
        lastDailyReset: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const sharedRelationship = await prisma.relationship.findFirst({
      where: {
        status: 'MARRIED',
        OR: [{ userAId: id }, { userBId: id }],
      },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        coupleBalance: true,
        marriedAt: true,
        userA: {
          select: {
            id: true,
            username: true,
            money: true,
          },
        },
        userB: {
          select: {
            id: true,
            username: true,
            money: true,
          },
        },
      },
    });

    const sharedMoney = sharedRelationship
      ? {
        relationshipId: sharedRelationship.id,
        coupleBalance: sharedRelationship.coupleBalance,
        marriedAt: sharedRelationship.marriedAt ? sharedRelationship.marriedAt.toISOString() : null,
        partner: sharedRelationship.userAId === id
          ? {
            id: sharedRelationship.userB.id,
            username: sharedRelationship.userB.username,
            money: sharedRelationship.userB.money,
          }
          : {
            id: sharedRelationship.userA.id,
            username: sharedRelationship.userA.username,
            money: sharedRelationship.userA.money,
          },
      }
      : null;

    // Log user update
    const logChanges = { ...updateData } as { [key: string]: unknown };
    if (logChanges.passwordHash) {
      delete logChanges.passwordHash;
    }

    logAdmin('user_update', req.user!.id, undefined, id, user.username, {
      changes: logChanges,
      passwordChanged: Boolean(updateData.passwordHash),
      oldValues: {
        username: oldUser?.username,
        firstName: oldUser?.firstName,
        aura: oldUser?.aura,
        money: oldUser?.money,
        auraCoinBalance: oldUser?.auraCoinBalance,
        dailyAuraLimit: oldUser?.dailyAuraLimit,
        isChatMuted: oldUser?.isChatMuted,
        isAdmin: oldUser?.isAdmin,
        isSuperAdmin: oldUser?.isSuperAdmin,
      },
    });

    res.json({ user: { ...user, sharedMoney } });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.post('/users/:id/force-divorce', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await forceDivorceRelationship(req.user!.id, id);
    res.json({ success: true, message: 'Divorce force applique.' });
  } catch (error) {
    if (error instanceof Error && error.message === 'RELATIONSHIP_NOT_MARRIED') {
      return res.status(400).json({ error: 'Cet utilisateur n est pas marie.' });
    }

    console.error('Admin force divorce error:', error);
    res.status(500).json({ error: 'Failed to force divorce' });
  }
});

// ========== USER INVENTORY MANAGEMENT ==========

// Get a user's inventory (admin only)
router.get('/users/:id/inventory', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const items = await prisma.userItem.findMany({
      where: { userId: id },
      include: { item: true },
      orderBy: { acquiredAt: 'desc' },
    });

    res.json({ items });
  } catch (error) {
    console.error('Admin get user inventory error:', error);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

// Add an item to a user's inventory (admin only)
router.post('/users/:id/inventory', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { itemId, quantity = 1 } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    if (parseInt(quantity) <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const [user, item] = await Promise.all([
      prisma.user.findUnique({ where: { id }, select: { id: true } }),
      prisma.item.findUnique({ where: { id: itemId }, select: { id: true } }),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const userItem = await prisma.userItem.upsert({
      where: {
        userId_itemId: {
          userId: id,
          itemId,
        },
      },
      create: {
        userId: id,
        itemId,
        quantity: parseInt(quantity),
      },
      update: {
        quantity: { increment: parseInt(quantity) },
      },
      include: { item: true },
    });

    // Get user info for logging
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { username: true },
    });

    // Log inventory add
    logAdmin('inventory_add', req.user!.id, undefined, id, targetUser?.username || undefined, {
      itemId,
      itemName: userItem.item.name,
      quantity: parseInt(quantity),
    });

    createNotification({
      userId: id,
      type: 'ITEM_RECEIVED',
      title: 'Objet ajouté à ton inventaire',
      body: `${userItem.item.name} x${parseInt(quantity)} a été ajouté à ton inventaire.`,
      data: {
        itemId,
        itemName: userItem.item.name,
        quantity: parseInt(quantity),
      },
      link: '/inventory',
      icon: 'package',
    }).catch(() => {});

    res.status(201).json({ item: userItem });
  } catch (error) {
    console.error('Admin add user inventory item error:', error);
    res.status(500).json({ error: 'Failed to add inventory item' });
  }
});

// Update a user's inventory item quantity (admin only)
router.patch('/users/:id/inventory/:userItemId', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id, userItemId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({ error: 'Quantity is required' });
    }

    const userItem = await prisma.userItem.findUnique({
      where: { id: userItemId },
      include: {
        item: {
          select: { id: true, name: true },
        },
        user: {
          select: { username: true },
        },
      },
    });

    if (!userItem || userItem.userId !== id) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const parsedQuantity = parseInt(quantity);

    if (parsedQuantity <= 0) {
      await prisma.userItem.delete({ where: { id: userItemId } });
      logAdmin('inventory_remove', req.user!.id, req.user!.username, id, userItem.user.username, {
        userItemId,
        itemId: userItem.item.id,
        itemName: userItem.item.name,
        previousQuantity: userItem.quantity,
        removedViaQuantityPatch: true,
      });
      return res.json({ removed: true });
    }

    const updatedItem = await prisma.userItem.update({
      where: { id: userItemId },
      data: { quantity: parsedQuantity },
      include: { item: true },
    });

    logAdmin('inventory_update', req.user!.id, req.user!.username, id, userItem.user.username, {
      userItemId,
      itemId: updatedItem.item.id,
      itemName: updatedItem.item.name,
      previousQuantity: userItem.quantity,
      newQuantity: updatedItem.quantity,
    });

    res.json({ item: updatedItem });
  } catch (error) {
    console.error('Admin update user inventory item error:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// Remove an item from a user's inventory (admin only)
router.delete('/users/:id/inventory/:userItemId', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id, userItemId } = req.params;

    const userItem = await prisma.userItem.findUnique({
      where: { id: userItemId },
      include: {
        item: {
          select: { id: true, name: true },
        },
        user: {
          select: { username: true },
        },
      },
    });

    if (!userItem || userItem.userId !== id) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    await prisma.userItem.delete({ where: { id: userItemId } });

    logAdmin('inventory_remove', req.user!.id, req.user!.username, id, userItem.user.username, {
      userItemId,
      itemId: userItem.item.id,
      itemName: userItem.item.name,
      previousQuantity: userItem.quantity,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user inventory item error:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

// Delete user completely - admin only
router.delete('/users/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Don't allow deleting yourself
    if (req.user?.id === id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow deleting other admins
    if (user.isAdmin) {
      return res.status(400).json({ error: 'Cannot delete admin users' });
    }

    // Log user deletion
    logAdmin('user_delete', req.user!.id, undefined, id, user.username, { email: user.email });

    // Delete user (cascades to related records due to onDelete: Cascade in schema)
    await prisma.user.delete({
      where: { id },
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.get('/chat/export', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const messages = await prisma.chatMessage.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
            profilePicture: true,
          },
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
                profilePicture: true,
              },
            },
          },
        },
        reactions: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    logAdmin('chat_export', req.user!.id, undefined, undefined, undefined, {
      messagesExported: messages.length,
    });

    const exportedAt = new Date();
    const payload = {
      exportedAt: exportedAt.toISOString(),
      messageCount: messages.length,
      messages: messages.map((message) => ({
        id: message.id,
        userId: message.userId,
        type: message.type,
        message: message.message,
        imageUrl: message.imageUrl,
        replyToId: message.replyToId,
        pinned: message.pinned,
        pinnedAt: message.pinnedAt?.toISOString() ?? null,
        createdAt: message.createdAt.toISOString(),
        user: message.user,
        replyTo: message.replyTo ? {
          id: message.replyTo.id,
          userId: message.replyTo.userId,
          type: message.replyTo.type,
          message: message.replyTo.message,
          imageUrl: message.replyTo.imageUrl,
          pinned: message.replyTo.pinned,
          pinnedAt: message.replyTo.pinnedAt?.toISOString() ?? null,
          createdAt: message.replyTo.createdAt.toISOString(),
          user: message.replyTo.user,
        } : null,
        reactions: message.reactions.map((reaction) => ({
          id: reaction.id,
          emoji: reaction.emoji,
          createdAt: reaction.createdAt.toISOString(),
          userId: reaction.userId,
          user: reaction.user,
        })),
      })),
    };

    const fileDate = exportedAt.toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="chat-export-${fileDate}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('Admin chat export error:', error);
    res.status(500).json({ error: 'Failed to export chat messages' });
  }
});

// Rare admin actions (grouped for cleanliness)
router.post('/rare', authMiddleware, requireAdmin, validate(adminRareActionSchema), async (req: AuthRequest, res: Response) => {
  const { action } = req.body;

  try {
    if (action === 'chat_clear') {
      const result = await prisma.chatMessage.deleteMany({});

      logAdmin('chat_clear', req.user!.id, undefined, undefined, undefined, {
        messagesDeleted: result.count,
      });

      return res.json({
        success: true,
        message: `Deleted ${result.count} chat messages`,
        messagesDeleted: result.count,
      });
    }

    if (action === 'reset_extreme_aura') {
      const threshold = typeof req.body.threshold === 'number' ? req.body.threshold : 1000000000;

      const usersToReset = await prisma.user.findMany({
        where: {
          aura: { gt: BigInt(threshold) }
        },
        select: {
          id: true,
          username: true,
          aura: true,
        },
      });

      if (usersToReset.length === 0) {
        return res.json({
          success: true,
          message: 'No users found with extreme aura values',
          usersReset: 0,
          users: []
        });
      }

      await prisma.user.updateMany({
        where: {
          aura: { gt: BigInt(threshold) }
        },
        data: {
          aura: BigInt(0)
        }
      });

      logAdmin('extreme_aura_reset', req.user!.id, undefined, undefined, undefined, {
        threshold,
        usersReset: usersToReset.length,
        users: usersToReset.map(u => ({ id: u.id, username: u.username, oldAura: u.aura.toString() })),
      });

      return res.json({
        success: true,
        message: `Reset aura for ${usersToReset.length} user(s) with values above ${threshold.toLocaleString()}`,
        usersReset: usersToReset.length,
        users: usersToReset.map(u => ({
          id: u.id,
          username: u.username,
          oldAura: u.aura.toString()
        }))
      });
    }

    if (action === 'deploy') {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        logAdmin('deploy_trigger', req.user!.id, req.user!.username, undefined, undefined, {
          timestamp: new Date().toISOString(),
        });

        const { stdout, stderr } = await execAsync('bash -l /var/scripts/deploy.sh', {
          timeout: 300000,
          cwd: '/',
          env: {
            ...process.env,
            HOME: process.env.HOME || '/root',
          },
        });

        return res.json({
          success: true,
          message: 'Deploy script executed successfully',
          stdout: stdout || '',
          stderr: stderr || '',
        });
      } catch (error: unknown) {
        console.error('Deploy script error:', error);
        const execErr = error as { message?: string; stdout?: string; stderr?: string };
        const errorMessage = execErr.message || 'Unknown error';
        return res.status(500).json({
          error: 'Deploy script failed',
          message: errorMessage,
          stdout: execErr.stdout || '',
          stderr: execErr.stderr || '',
        });
      }
    }

    return res.status(400).json({ error: 'Unknown admin action' });
  } catch (error) {
    console.error('Admin rare action error:', error);
    return res.status(500).json({ error: 'Failed to run admin action' });
  }
});

// ========== BUG REPORTS MANAGEMENT ==========

// Create bug report (any authenticated user)
router.post('/bugs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, images } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    
    if (title.length > 100) {
      return res.status(400).json({ error: 'Title must be less than 100 characters' });
    }
    
    if (description.length > 2000) {
      return res.status(400).json({ error: 'Description must be less than 2000 characters' });
    }

    // Validate images
    let imagesJson: string | undefined;
    if (images) {
      if (!Array.isArray(images)) {
        return res.status(400).json({ error: 'Images must be an array' });
      }
      if (images.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 images allowed' });
      }
      if (!images.every((img) => typeof img === 'string')) {
        return res.status(400).json({ error: 'All images must be strings' });
      }
      imagesJson = JSON.stringify(images);
    }
    
    const bugReport = await prisma.bugReport.create({
      data: {
        userId: req.user!.id,
        title: title.trim(),
        description: description.trim(),
        images: imagesJson,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Log bug report
    logSuggestion('bug_report', req.user!.id, bugReport.user.username, {
      bugReportId: bugReport.id,
      title: bugReport.title,
    });

    // BUG_REPORTER badge: track report and award badge
    await prisma.gameStats.upsert({
      where: { userId_gameType: { userId: req.user!.id, gameType: 'bug_report' } },
      create: { userId: req.user!.id, gameType: 'bug_report', wins: 1, losses: 0, highScore: 0, totalPlayed: 1 },
      update: { wins: { increment: 1 }, totalPlayed: { increment: 1 } },
    });
    void awardBadgeByKey(req.user!.id, 'BUG_REPORTER', 'A reporté un bug');

    res.status(201).json({ bugReport });
  } catch (error) {
    console.error('Create bug report error:', error);
    res.status(500).json({ error: 'Failed to create bug report' });
  }
});

// Get all bug reports (admin only)
router.get('/bugs', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const bugReports = await prisma.bugReport.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json({ bugReports });
  } catch (error) {
    console.error('Admin get bug reports error:', error);
    res.status(500).json({ error: 'Failed to get bug reports' });
  }
});

// Update bug report status (and optionally reply) (admin only)
router.put('/bugs/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminReply } = req.body;

    if (!['PENDING', 'DONE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be PENDING or DONE' });
    }

    if (adminReply !== undefined && typeof adminReply !== 'string') {
      return res.status(400).json({ error: 'adminReply must be a string' });
    }

    const existingBugReport = await prisma.bugReport.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        adminReply: true,
      },
    });

    if (!existingBugReport) {
      return res.status(404).json({ error: 'Bug report not found' });
    }

    const reply = adminReply?.trim();

    const bugReport = await prisma.bugReport.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === 'DONE' ? new Date() : null,
        ...(adminReply !== undefined ? { adminReply: adminReply.trim() || null } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    logAdmin('bug_report_update', req.user!.id, req.user!.username, bugReport.id, bugReport.title, {
      previousStatus: existingBugReport.status,
      newStatus: bugReport.status,
      replyAdded: Boolean(reply),
      previousReply: existingBugReport.adminReply,
      newReply: bugReport.adminReply,
    });

    // If there's a reply, notify the user in-app and by email
    if (reply) {
      const notifBody = status === 'DONE'
        ? `Votre bug "${bugReport.title}" a été résolu.\n\n${reply}`
        : `Mise à jour de votre bug "${bugReport.title}".\n\n${reply}`;

      await createNotification({
        userId: bugReport.userId,
        type: 'ADMIN',
        title: status === 'DONE' ? 'Bug résolu' : 'Mise à jour de votre signalement',
        body: notifBody,
        icon: 'Bug',
      });

      // Send email (no-op if SMTP not configured)
      sendBugReportReplyEmail({
        to: bugReport.user.email,
        username: bugReport.user.username,
        bugTitle: bugReport.title,
        adminReply: reply,
        status,
      }).catch(err => console.error('Bug report email error:', err));
    }

    // Return without email field
    const { user: { email: _email, ...userWithoutEmail }, ...rest } = bugReport as any;
    res.json({ bugReport: { ...rest, user: userWithoutEmail } });
  } catch (error) {
    console.error('Admin update bug report error:', error);
    res.status(500).json({ error: 'Failed to update bug report' });
  }
});

// Delete bug report (admin only)
router.delete('/bugs/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const bugReport = await prisma.bugReport.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        userId: true,
        user: {
          select: { username: true },
        },
      },
    });

    if (!bugReport) {
      return res.status(404).json({ error: 'Bug report not found' });
    }

    await prisma.bugReport.delete({
      where: { id },
    });

    logAdmin('bug_report_delete', req.user!.id, req.user!.username, bugReport.userId, bugReport.user.username, {
      bugReportId: bugReport.id,
      title: bugReport.title,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete bug report error:', error);
    res.status(500).json({ error: 'Failed to delete bug report' });
  }
});

// ========== ACTIVITY LOGS ==========

// Get activity logs (admin or fiscal inspector)
router.get('/logs', authMiddleware, requireAdminOrFiscal, async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      action,
      username,
      gameType,
      limit = '100',
      offset = '0',
      startDate,
      endDate,
    } = req.query;
    const where = buildLogWhereClause({ type, action, username, gameType, startDate, endDate });

    const [logs, total] = await Promise.all([
      prisma.log.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit as string), 500),
        skip: parseInt(offset as string),
      }),
      prisma.log.count({ where }),
    ]);

    // Parse JSON fields for response
    const parsedLogs = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    res.json({ logs: parsedLogs, total });
  } catch (error) {
    console.error('Admin get logs error:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Download activity logs as CSV (admin or fiscal inspector)
router.get('/logs/download', authMiddleware, requireAdminOrFiscal, async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      action,
      username,
      gameType,
      startDate,
      endDate,
    } = req.query;
    const where = buildLogWhereClause({ type, action, username, gameType, startDate, endDate });
    const logs = [];
    let skip = 0;

    while (true) {
      const batch = await prisma.log.findMany({
        where,
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take: LOG_EXPORT_BATCH_SIZE,
      });

      logs.push(...batch);

      if (batch.length < LOG_EXPORT_BATCH_SIZE) {
        break;
      }

      skip += batch.length;
    }

    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) {
        return '""';
      }
      const text = String(value).replace(/"/g, '""');
      return `"${text}"`;
    };

    const header = [
      'id',
      'type',
      'action',
      'userId',
      'username',
      'targetId',
      'targetName',
      'ipAddress',
      'createdAt',
      'details',
      'metadata',
    ].join(',');

    const rows = logs.map((log) => [
      escapeCsv(log.id),
      escapeCsv(log.type),
      escapeCsv(log.action),
      escapeCsv(log.userId),
      escapeCsv(log.username),
      escapeCsv(log.targetId),
      escapeCsv(log.targetName),
      escapeCsv(log.ipAddress),
      escapeCsv(log.createdAt.toISOString()),
      escapeCsv(log.details),
      escapeCsv(log.metadata),
    ].join(','));

    const csv = [header, ...rows].join('\n');
    const safeStart = typeof startDate === 'string' && startDate.trim() !== '' ? startDate.slice(0, 10) : 'all-time';
    const safeEnd = typeof endDate === 'string' && endDate.trim() !== '' ? endDate.slice(0, 10) : null;
    const fileLabel = safeEnd ? `${safeStart}_to_${safeEnd}` : safeStart;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="admin-logs-${fileLabel}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Admin download logs error:', error);
    res.status(500).json({ error: 'Failed to download logs' });
  }
});

// Get log stats (admin or fiscal inspector)
router.get('/logs/stats', authMiddleware, requireAdminOrFiscal, async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalLogs,
      authLogs,
      chatLogs,
      gameLogs,
      economyLogs,
      partyLogs,
      marketplaceLogs,
      adminLogs,
      banLogs,
      suggestionLogs,
      auraCoinLogs,
    ] = await Promise.all([
      prisma.log.count(),
      prisma.log.count({ where: { type: 'AUTH' } }),
      prisma.log.count({ where: { type: 'CHAT' } }),
      prisma.log.count({ where: { type: 'GAME' } }),
      prisma.log.count({ where: { type: 'ECONOMY' } }),
      prisma.log.count({ where: { type: 'PARTY' } }),
      prisma.log.count({ where: { type: 'MARKETPLACE' } }),
      prisma.log.count({ where: { type: 'ADMIN' } }),
      prisma.log.count({ where: { type: 'BAN' } }),
      prisma.log.count({ where: { type: 'SUGGESTION' } }),
      prisma.log.count({ where: { type: 'AURACOIN' } }),
    ]);

    res.json({
      total: totalLogs,
      byType: {
        AUTH: authLogs,
        CHAT: chatLogs,
        GAME: gameLogs,
        ECONOMY: economyLogs,
        PARTY: partyLogs,
        MARKETPLACE: marketplaceLogs,
        ADMIN: adminLogs,
        BAN: banLogs,
        SUGGESTION: suggestionLogs,
        AURACOIN: auraCoinLogs,
      },
    });
  } catch (error) {
    console.error('Admin get log stats error:', error);
    res.status(500).json({ error: 'Failed to get log stats' });
  }
});

// ========== BAN SYSTEM ==========

// Get all bans (admin only)
router.get('/bans', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const bans = await prisma.ban.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        admin: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ bans });
  } catch (error) {
    console.error('Admin get bans error:', error);
    res.status(500).json({ error: 'Failed to get bans' });
  }
});

// Create a ban (admin only)
router.post('/bans', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, reason, type, durationHours } = req.body;

    if (!userId || !reason || !type) {
      return res.status(400).json({ error: 'User ID, reason, and type are required' });
    }

    if (!['TEMPORARY', 'PERMANENT'].includes(type)) {
      return res.status(400).json({ error: 'Type must be TEMPORARY or PERMANENT' });
    }

    if (type === 'TEMPORARY' && (!durationHours || durationHours <= 0)) {
      return res.status(400).json({ error: 'Duration in hours is required for temporary bans' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isAdmin: true, username: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow banning admins
    if (user.isAdmin) {
      return res.status(400).json({ error: 'Cannot ban admin users' });
    }

    // Deactivate any existing active bans for this user
    await prisma.ban.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create the ban
    const expiresAt = type === 'TEMPORARY'
      ? new Date(Date.now() + parseInt(durationHours) * 60 * 60 * 1000)
      : null;

    const ban = await prisma.ban.create({
      data: {
        userId,
        bannedBy: req.user!.id,
        reason: reason.trim(),
        type,
        expiresAt,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        admin: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Log ban creation
    logBan('ban_create', req.user!.id, undefined, userId, user.username, {
      banType: type,
      reason: reason.trim(),
      expiresAt: expiresAt?.toISOString(),
      durationHours: type === 'TEMPORARY' ? parseInt(durationHours) : undefined,
    });

    const banMessage = type === 'PERMANENT'
      ? `Your account has been permanently banned. Reason: ${ban.reason}`
      : `Your account is temporarily banned until ${ban.expiresAt?.toISOString()}. Reason: ${ban.reason}`;
    io.to(`user:${userId}`).emit('ban:enforced', {
      message: banMessage,
      banned: true,
      ban: {
        reason: ban.reason,
        type: ban.type,
        expiresAt: ban.expiresAt ? ban.expiresAt.toISOString() : null,
      },
    });
    io.in(`user:${userId}`).disconnectSockets(true);

    res.status(201).json({ ban, message: `${user.username} has been banned` });
  } catch (error) {
    console.error('Admin create ban error:', error);
    res.status(500).json({ error: 'Failed to create ban' });
  }
});

// Unban a user (admin only)
router.delete('/bans/:userId', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    // Deactivate all active bans for this user
    const result = await prisma.ban.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'No active ban found for this user' });
    }

    // Get user info for logging
    const unbannedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    // Log unban
    logBan('ban_remove', req.user!.id, undefined, userId, unbannedUser?.username || undefined, {
      bansRemoved: result.count,
    });

    createNotification({
      userId,
      type: 'SYSTEM',
      title: 'Compte debanni',
      body: 'Ton bannissement a été levé. Tu peux de nouveau utiliser le site.',
      data: {
        bansRemoved: result.count,
      },
      link: '/login',
      icon: 'shield-check',
    }).catch(() => {});

    res.json({ success: true, message: 'User has been unbanned' });
  } catch (error) {
    console.error('Admin unban user error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// ========== GAME SETTINGS MANAGEMENT ==========

// Get all game settings (admin only)
router.get('/settings', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.gameSettings.findMany({
      orderBy: { key: 'asc' },
    });

    // Convert to key-value map for easier consumption
    const settingsMap: Record<string, string> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    res.json({ settings: settingsMap });
  } catch (error) {
    console.error('Admin get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Get a specific game setting (admin only)
router.get('/settings/:key', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;

    const setting = await prisma.gameSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ setting });
  } catch (error) {
    console.error('Admin get setting error:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

// Update a game setting (admin only)
router.put('/settings/:key', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const stringValue = String(value);
    const normalizedValue = key === ANNOUNCEMENT_KEY ? stringValue.trim() : stringValue;

    // Validate specific settings
    if (key === ANNOUNCEMENT_KEY && normalizedValue.length > ANNOUNCEMENT_MAX_LENGTH) {
      return res.status(400).json({ error: `Announcement must be ${ANNOUNCEMENT_MAX_LENGTH} characters or less` });
    }

    if (key.startsWith('bombparty_wpp_')) {
      const numValue = parseInt(normalizedValue);
      if (isNaN(numValue) || numValue < 1) {
        return res.status(400).json({ error: 'WPP values must be positive integers' });
      }
    }

    if (key === 'bombparty_3letter_start_round') {
      const numValue = parseInt(normalizedValue);
      if (isNaN(numValue) || numValue < 0) {
        return res.status(400).json({ error: 'Start round must be a non-negative integer' });
      }
    }

    if (key === 'bombparty_language') {
      const languages = listBombPartyLanguageFiles().map((lang) => lang.fileName);
      if (!languages.includes(normalizedValue)) {
        return res.status(400).json({ error: 'Invalid bombparty language selection' });
      }
    }

    if (key === REFERRAL_REWARD_SETTING_KEY) {
      const numValue = parseInt(normalizedValue, 10);
      if (isNaN(numValue) || numValue < 0) {
        return res.status(400).json({ error: 'Referral reward must be a non-negative integer' });
      }
    }

    if (key === REFERRAL_ENABLED_SETTING_KEY && !['true', 'false'].includes(normalizedValue)) {
      return res.status(400).json({ error: 'Referral enabled must be true or false' });
    }

    if (key === DUEL_MATCHMAKING_ENABLED_SETTING_KEY && !['true', 'false'].includes(normalizedValue)) {
      return res.status(400).json({ error: 'Duel matchmaking enabled must be true or false' });
    }

    if ([AURACOIN_BUY_FEE_PERCENTAGE_KEY, STABLE_COIN_BUY_FEE_PERCENTAGE_KEY, CHAOS_COIN_BUY_FEE_PERCENTAGE_KEY].includes(key)) {
      const numValue = Number.parseFloat(normalizedValue);
      if (!Number.isFinite(numValue) || numValue < 0 || numValue > 0.5) {
        return res.status(400).json({ error: 'Crypto buy fee must be between 0 and 0.5' });
      }
    }

    if (key === CLASH_ATTACK_COOLDOWN_MINUTES_KEY) {
      const numValue = Number.parseInt(normalizedValue, 10);
      if (!Number.isInteger(numValue) || numValue < 0 || numValue > 1440) {
        return res.status(400).json({ error: 'Clash attack cooldown must be an integer between 0 and 1440 minutes' });
      }
    }

    if (key === DAILY_AURA_DISTRIBUTION_LIMIT_KEY) {
      const numValue = Number.parseInt(normalizedValue, 10);
      if (!Number.isInteger(numValue) || numValue < 0 || numValue > 10000) {
        return res.status(400).json({ error: 'Daily aura distribution limit must be an integer between 0 and 10000' });
      }
    }

    if (key === DEFAULT_LANDING_PAGE_SETTING_KEY && !ALLOWED_DEFAULT_LANDING_PAGES.has(normalizedValue)) {
      return res.status(400).json({ error: 'Invalid default landing page selection' });
    }

    if (key === YOU_LOGO_ADMIN_ONLY_SETTING_KEY && !['true', 'false'].includes(normalizedValue)) {
      return res.status(400).json({ error: 'You logo admin only must be true or false' });
    }

    if (
      (key === CHAT_BLOCK_ENABLED_KEY || key === CHAT_AUTO_BLOCK_ENABLED_KEY) &&
      !['true', 'false'].includes(normalizedValue)
    ) {
      return res.status(400).json({ error: 'Chat block toggles must be true or false' });
    }

    if (
      (key === CHAT_AUTO_BLOCK_START_KEY || key === CHAT_AUTO_BLOCK_END_KEY) &&
      normalizedValue !== '' &&
      !isValidChatBlockTimeValue(normalizedValue)
    ) {
      return res.status(400).json({ error: 'Chat block schedule must use HH:mm format' });
    }

    if (key === CHAT_BLOCK_MESSAGE_KEY && normalizedValue.length > 240) {
      return res.status(400).json({ error: 'Chat block message must be 240 characters or less' });
    }

    const setting = await prisma.gameSettings.upsert({
      where: { key },
      create: {
        key,
        value: key === CHAT_BLOCK_MESSAGE_KEY && normalizedValue.trim() === ''
          ? getDefaultChatBlockMessage()
          : normalizedValue,
      },
      update: {
        value: key === CHAT_BLOCK_MESSAGE_KEY && normalizedValue.trim() === ''
          ? getDefaultChatBlockMessage()
          : normalizedValue,
      },
    });

    if (key === DUEL_MATCHMAKING_ENABLED_SETTING_KEY && normalizedValue === 'false') {
      try {
        const { clearDuelMatchmakingQueue } = await import('../socket/duel.js');
        await clearDuelMatchmakingQueue(io);
      } catch (clearError) {
        console.error('Failed to clear duel matchmaking queue:', clearError);
      }
    }

    // Log setting update
    logAdmin('setting_update', req.user!.id, undefined, undefined, undefined, {
      key,
      value: normalizedValue,
    });

    // Clear cached settings in bombparty module if needed
    if (key.startsWith('bombparty_')) {
      try {
        // Dynamic import to avoid circular dependencies
        const { clearBombPartySettingsCache } = await import('../socket/bombparty.js');
        clearBombPartySettingsCache();
      } catch {
        // Ignore if function not available
      }
    }

    if (SITE_RELOAD_TRIGGER_KEYS.has(key)) {
      io.emit('site:reload-required', { reason: 'settings-updated', keys: [key] });
    }

    res.json({ setting });
  } catch (error) {
    console.error('Admin update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Update multiple game settings at once (admin only)
router.put('/settings', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const updates: { key: string; value: string }[] = [];
    const errors: string[] = [];

    // Validate all settings first
    for (const [key, value] of Object.entries(settings)) {
      const stringValue = String(value);
      const normalizedValue = key === ANNOUNCEMENT_KEY ? stringValue.trim() : stringValue;

      if (key === ANNOUNCEMENT_KEY && normalizedValue.length > ANNOUNCEMENT_MAX_LENGTH) {
        errors.push(`${key}: Announcement must be ${ANNOUNCEMENT_MAX_LENGTH} characters or less`);
        continue;
      }

      if (key.startsWith('bombparty_wpp_')) {
        const numValue = parseInt(normalizedValue);
        if (isNaN(numValue) || numValue < 1) {
          errors.push(`${key}: WPP values must be positive integers`);
          continue;
        }
      }

      if (key === 'bombparty_3letter_start_round') {
        const numValue = parseInt(normalizedValue);
        if (isNaN(numValue) || numValue < 0) {
          errors.push(`${key}: Start round must be a non-negative integer`);
          continue;
        }
      }

      if (key === 'bombparty_language') {
        const languages = listBombPartyLanguageFiles().map((lang) => lang.fileName);
        if (!languages.includes(normalizedValue)) {
          errors.push(`${key}: Invalid bombparty language selection`);
          continue;
        }
      }

      if (key === REFERRAL_REWARD_SETTING_KEY) {
        const numValue = parseInt(normalizedValue, 10);
        if (isNaN(numValue) || numValue < 0) {
          errors.push(`${key}: Referral reward must be a non-negative integer`);
          continue;
        }
      }

      if (key === REFERRAL_ENABLED_SETTING_KEY && !['true', 'false'].includes(normalizedValue)) {
        errors.push(`${key}: Referral enabled must be true or false`);
        continue;
      }

      if (key === DUEL_MATCHMAKING_ENABLED_SETTING_KEY && !['true', 'false'].includes(normalizedValue)) {
        errors.push(`${key}: Duel matchmaking enabled must be true or false`);
        continue;
      }

      if ([AURACOIN_BUY_FEE_PERCENTAGE_KEY, STABLE_COIN_BUY_FEE_PERCENTAGE_KEY, CHAOS_COIN_BUY_FEE_PERCENTAGE_KEY].includes(key)) {
        const numValue = Number.parseFloat(normalizedValue);
        if (!Number.isFinite(numValue) || numValue < 0 || numValue > 0.5) {
          errors.push(`${key}: Crypto buy fee must be between 0 and 0.5`);
          continue;
        }
      }

      if (key === CLASH_ATTACK_COOLDOWN_MINUTES_KEY) {
        const numValue = Number.parseInt(normalizedValue, 10);
        if (!Number.isInteger(numValue) || numValue < 0 || numValue > 1440) {
          errors.push(`${key}: Clash attack cooldown must be an integer between 0 and 1440 minutes`);
          continue;
        }
      }

      if (key === DAILY_AURA_DISTRIBUTION_LIMIT_KEY) {
        const numValue = Number.parseInt(normalizedValue, 10);
        if (!Number.isInteger(numValue) || numValue < 0 || numValue > 10000) {
          errors.push(`${key}: Daily aura distribution limit must be an integer between 0 and 10000`);
          continue;
        }
      }

      if (key === DEFAULT_LANDING_PAGE_SETTING_KEY && !ALLOWED_DEFAULT_LANDING_PAGES.has(normalizedValue)) {
        errors.push(`${key}: Invalid default landing page selection`);
        continue;
      }

      if (key === YOU_LOGO_ADMIN_ONLY_SETTING_KEY && !['true', 'false'].includes(normalizedValue)) {
        errors.push(`${key}: You logo admin only must be true or false`);
        continue;
      }

      if (
        (key === CHAT_BLOCK_ENABLED_KEY || key === CHAT_AUTO_BLOCK_ENABLED_KEY) &&
        !['true', 'false'].includes(normalizedValue)
      ) {
        errors.push(`${key}: Chat block toggles must be true or false`);
        continue;
      }

      if (
        (key === CHAT_AUTO_BLOCK_START_KEY || key === CHAT_AUTO_BLOCK_END_KEY) &&
        normalizedValue !== '' &&
        !isValidChatBlockTimeValue(normalizedValue)
      ) {
        errors.push(`${key}: Chat block schedule must use HH:mm format`);
        continue;
      }

      if (key === CHAT_BLOCK_MESSAGE_KEY && normalizedValue.length > 240) {
        errors.push(`${key}: Chat block message must be 240 characters or less`);
        continue;
      }

      updates.push({
        key,
        value: key === CHAT_BLOCK_MESSAGE_KEY && normalizedValue.trim() === ''
          ? getDefaultChatBlockMessage()
          : normalizedValue,
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation errors', details: errors });
    }

    // Apply all updates
    for (const { key, value } of updates) {
      await prisma.gameSettings.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }

    const duelMatchmakingDisabled = updates.some(
      ({ key, value }) => key === DUEL_MATCHMAKING_ENABLED_SETTING_KEY && value === 'false'
    );
    if (duelMatchmakingDisabled) {
      try {
        const { clearDuelMatchmakingQueue } = await import('../socket/duel.js');
        await clearDuelMatchmakingQueue(io);
      } catch (clearError) {
        console.error('Failed to clear duel matchmaking queue:', clearError);
      }
    }

    // Log bulk setting update
    logAdmin('settings_bulk_update', req.user!.id, undefined, undefined, undefined, {
      updatedKeys: updates.map(u => u.key),
    });

    // Clear cached settings in bombparty module
    const hasBombPartySettings = updates.some(u => u.key.startsWith('bombparty_'));
    if (hasBombPartySettings) {
      try {
        const { clearBombPartySettingsCache } = await import('../socket/bombparty.js');
        clearBombPartySettingsCache();
      } catch {
        // Ignore if function not available
      }
    }

    const reloadKeys = updates
      .map(({ key }) => key)
      .filter((key) => SITE_RELOAD_TRIGGER_KEYS.has(key));
    if (reloadKeys.length > 0) {
      io.emit('site:reload-required', {
        reason: 'settings-updated',
        keys: reloadKeys,
      });
    }

    // Return updated settings
    const allSettings = await prisma.gameSettings.findMany({
      orderBy: { key: 'asc' },
    });

    const settingsMap: Record<string, string> = {};
    for (const setting of allSettings) {
      settingsMap[setting.key] = setting.value;
    }

    res.json({ settings: settingsMap });
  } catch (error) {
    console.error('Admin bulk update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ========== TAX MANAGEMENT ==========

router.get('/tax-settings', authMiddleware, requireAdminOrFiscal, async (_req: AuthRequest, res: Response) => {
  try {
    const [brackets, lastRunSetting] = await Promise.all([
      prisma.taxBracket.findMany({
        orderBy: { threshold: 'asc' },
      }),
      prisma.gameSettings.findUnique({
        where: { key: LAST_TAX_RUN_KEY },
        select: { value: true },
      }),
    ]);

    res.json({
      brackets,
      defaults: {
        threshold: DEFAULT_TAX_BRACKET_THRESHOLD,
        rate: DEFAULT_TAX_BRACKET_RATE,
      },
      lastRunDate: lastRunSetting?.value ?? null,
    });
  } catch (error) {
    console.error('Admin get tax settings error:', error);
    res.status(500).json({ error: 'Failed to get tax settings' });
  }
});

router.put('/tax-settings', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const normalized = normalizeTaxBracketsInput(req.body?.brackets);
    if ('error' in normalized) {
      return res.status(400).json({ error: normalized.error });
    }

    const { brackets } = normalized;

    await prisma.$transaction(async (tx) => {
      await tx.taxBracket.deleteMany();

      if (brackets.length > 0) {
        await tx.taxBracket.createMany({
          data: brackets,
        });
      }
    });

    const savedBrackets = await prisma.taxBracket.findMany({
      orderBy: { threshold: 'asc' },
    });

    logAdmin('tax_brackets_update', req.user!.id, undefined, undefined, undefined, {
      brackets: savedBrackets,
      fallbackDefaultAppliedWhenEmpty: savedBrackets.length === 0,
    });

    res.json({
      brackets: savedBrackets,
      defaults: {
        threshold: DEFAULT_TAX_BRACKET_THRESHOLD,
        rate: DEFAULT_TAX_BRACKET_RATE,
      },
    });
  } catch (error) {
    console.error('Admin update tax settings error:', error);
    res.status(500).json({ error: 'Failed to update tax settings' });
  }
});

router.post('/tax-settings/run', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const force = req.body?.force !== false;
    const result = await runDailyTax(prisma, force);

    logAdmin('tax_manual_run', req.user!.id, undefined, undefined, undefined, {
      force,
      ...result,
    });

    res.json({ result });
  } catch (error) {
    console.error('Admin run tax error:', error);
    res.status(500).json({ error: 'Failed to run tax collection' });
  }
});

// List available Bomb Party languages (admin only)
router.get('/bombparty/languages', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const languages = listBombPartyLanguageFiles();
    res.json({ languages });
  } catch (error) {
    console.error('Admin get Bomb Party languages error:', error);
    res.status(500).json({ error: 'Failed to get Bomb Party languages' });
  }
});

// Recalculate Bomb Party prompts (admin only)
router.post('/bombparty/recalculate-prompts', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await recalculateBombPartyPrompts(prisma);

    logAdmin('bombparty_prompts_recalculate', req.user!.id, undefined, undefined, undefined, {
      language: result.languageFile,
      totalPrompts: result.totalPrompts,
    });

    res.json({ result });
  } catch (error) {
    console.error('Admin recalculate Bomb Party prompts error:', error);
    res.status(500).json({ error: 'Failed to recalculate Bomb Party prompts' });
  }
});

// ========== UPDATE POPUP MANAGEMENT ==========

// Get all update popups (admin view)
router.get('/update-popups', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const popups = await prisma.updatePopup.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            views: true,
          },
        },
      },
      orderBy: [
        { releaseDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ popups: popups.map(serializeAdminUpdatePopup) });
  } catch (error) {
    console.error('Admin get update popups error:', error);
    res.status(500).json({ error: 'Failed to get update popups' });
  }
});

// Create update popup
router.post('/update-popups', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const summary = typeof req.body.summary === 'string' ? req.body.summary.trim() : '';
    const imageUrl = typeof req.body.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
    const type = typeof req.body.type === 'string' ? req.body.type.trim().toUpperCase() : 'UPDATE';
    const audience = typeof req.body.audience === 'string' ? req.body.audience.trim().toUpperCase() : 'ALL';
    const targetUserIds = parseUpdatePopupTargetUserIds(req.body.targetUserIds);
    const releaseDateInput = typeof req.body.releaseDate === 'string' ? req.body.releaseDate : '';
    const isPublished = req.body.isPublished !== false;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
    }

    if (!UPDATE_POPUP_TYPES.has(type)) {
      return res.status(400).json({ error: 'Invalid popup type' });
    }

    if (!UPDATE_POPUP_AUDIENCES.has(audience)) {
      return res.status(400).json({ error: 'Invalid popup audience' });
    }

    if (targetUserIds === null) {
      return res.status(400).json({ error: 'targetUserIds must be an array of user IDs' });
    }

    if (audience === 'SELECTED_USERS' && targetUserIds.length === 0) {
      return res.status(400).json({ error: 'At least one user must be selected' });
    }

    const releaseDate = releaseDateInput ? new Date(releaseDateInput) : new Date();
    if (isNaN(releaseDate.getTime())) {
      return res.status(400).json({ error: 'Invalid release date' });
    }

    const popup = await prisma.updatePopup.create({
      data: {
        title,
        message,
        summary: summary || null,
        imageUrl: imageUrl || null,
        type,
        audience,
        targetUserIds: JSON.stringify(targetUserIds),
        releaseDate,
        isPublished,
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            views: true,
          },
        },
      },
    });

    logAdmin('update_popup_create', req.user!.id, req.user!.username, popup.id, popup.title, {
      releaseDate: popup.releaseDate.toISOString(),
      isPublished: popup.isPublished,
      type: popup.type,
      audience: popup.audience,
    });

    res.status(201).json({ popup: serializeAdminUpdatePopup(popup) });
  } catch (error) {
    console.error('Admin create update popup error:', error);
    res.status(500).json({ error: 'Failed to create update popup' });
  }
});

// Update update popup
router.put('/update-popups/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data: {
      title?: string;
      message?: string;
      summary?: string | null;
      imageUrl?: string | null;
      type?: string;
      audience?: string;
      targetUserIds?: string;
      releaseDate?: Date;
      isPublished?: boolean;
    } = {};

    if (req.body.title !== undefined) {
      if (typeof req.body.title !== 'string' || !req.body.title.trim()) {
        return res.status(400).json({ error: 'Title must be a non-empty string' });
      }
      data.title = req.body.title.trim();
    }

    if (req.body.message !== undefined) {
      if (typeof req.body.message !== 'string' || !req.body.message.trim()) {
        return res.status(400).json({ error: 'Message must be a non-empty string' });
      }
      data.message = req.body.message.trim();
    }

    if (req.body.summary !== undefined) {
      if (req.body.summary === null) {
        data.summary = null;
      } else if (typeof req.body.summary === 'string') {
        const trimmedSummary = req.body.summary.trim();
        data.summary = trimmedSummary.length > 0 ? trimmedSummary : null;
      } else {
        return res.status(400).json({ error: 'Invalid summary value' });
      }
    }

    if (req.body.imageUrl !== undefined) {
      if (req.body.imageUrl === null) {
        data.imageUrl = null;
      } else if (typeof req.body.imageUrl === 'string') {
        const trimmedUrl = req.body.imageUrl.trim();
        if (trimmedUrl && !isAllowedImageUrl(trimmedUrl)) {
          return res.status(400).json({ error: 'Image must be uploaded or a valid URL' });
        }
        data.imageUrl = trimmedUrl || null;
      } else {
        return res.status(400).json({ error: 'Invalid image URL' });
      }
    }

    if (req.body.type !== undefined) {
      if (typeof req.body.type !== 'string') {
        return res.status(400).json({ error: 'Invalid popup type' });
      }
      const parsedType = req.body.type.trim().toUpperCase();
      if (!UPDATE_POPUP_TYPES.has(parsedType)) {
        return res.status(400).json({ error: 'Invalid popup type' });
      }
      data.type = parsedType;
    }

    if (req.body.audience !== undefined) {
      if (typeof req.body.audience !== 'string') {
        return res.status(400).json({ error: 'Invalid popup audience' });
      }
      const parsedAudience = req.body.audience.trim().toUpperCase();
      if (!UPDATE_POPUP_AUDIENCES.has(parsedAudience)) {
        return res.status(400).json({ error: 'Invalid popup audience' });
      }
      data.audience = parsedAudience;
    }

    if (req.body.targetUserIds !== undefined) {
      const parsedTargetUserIds = parseUpdatePopupTargetUserIds(req.body.targetUserIds);
      if (parsedTargetUserIds === null) {
        return res.status(400).json({ error: 'targetUserIds must be an array of user IDs' });
      }
      data.targetUserIds = JSON.stringify(parsedTargetUserIds);
    }

    if (req.body.releaseDate !== undefined) {
      if (typeof req.body.releaseDate !== 'string') {
        return res.status(400).json({ error: 'Invalid release date' });
      }
      const releaseDate = new Date(req.body.releaseDate);
      if (isNaN(releaseDate.getTime())) {
        return res.status(400).json({ error: 'Invalid release date' });
      }
      data.releaseDate = releaseDate;
    }

    if (req.body.isPublished !== undefined) {
      if (typeof req.body.isPublished !== 'boolean') {
        return res.status(400).json({ error: 'isPublished must be a boolean' });
      }
      data.isPublished = req.body.isPublished;
    }

    const existingPopup = await prisma.updatePopup.findUnique({
      where: { id },
      select: {
        audience: true,
        targetUserIds: true,
      },
    });

    if (!existingPopup) {
      return res.status(404).json({ error: 'Update popup not found' });
    }

    let parsedFinalTargetUserIds: string[] = [];
    try {
      parsedFinalTargetUserIds = JSON.parse(data.targetUserIds ?? existingPopup.targetUserIds);
    } catch {
      return res.status(400).json({ error: 'Invalid target user IDs' });
    }

    if (!Array.isArray(parsedFinalTargetUserIds) || parsedFinalTargetUserIds.some((entry) => typeof entry !== 'string')) {
      return res.status(400).json({ error: 'Invalid target user IDs' });
    }

    const finalAudience = data.audience ?? existingPopup.audience;
    if (finalAudience === 'SELECTED_USERS' && parsedFinalTargetUserIds.length === 0) {
      return res.status(400).json({ error: 'At least one user must be selected' });
    }

    const popup = await prisma.updatePopup.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            views: true,
          },
        },
      },
    });

    logAdmin('update_popup_update', req.user!.id, req.user!.username, popup.id, popup.title, {
      changedFields: Object.keys(data),
    });

    res.json({ popup: serializeAdminUpdatePopup(popup) });
  } catch (error) {
    console.error('Admin update update popup error:', error);
    res.status(500).json({ error: 'Failed to update update popup' });
  }
});

// Delete update popup
router.delete('/update-popups/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const popup = await prisma.updatePopup.findUnique({
      where: { id },
      select: { id: true, title: true, imageUrl: true },
    });

    if (!popup) {
      return res.status(404).json({ error: 'Update popup not found' });
    }

    await prisma.updatePopup.delete({ where: { id } });

    logAdmin('update_popup_delete', req.user!.id, req.user!.username, popup.id, popup.title);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete update popup error:', error);
    res.status(500).json({ error: 'Failed to delete update popup' });
  }
});

// Upload image for update popups (admin only)
router.post('/update-popups/upload-image', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const base64Data = typeof req.body.base64Data === 'string' ? req.body.base64Data : '';
    const mimeType = typeof req.body.mimeType === 'string' ? req.body.mimeType : '';

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required' });
    }

    const uploadedImage = await writeBase64UploadImage({
      base64Data,
      mimeType,
      uploadDir: UPDATE_POPUP_UPLOAD_DIR,
      maxBytes: MAX_UPDATE_POPUP_IMAGE_SIZE_BYTES,
    });

    if ('error' in uploadedImage) {
      return res.status(400).json({ error: uploadedImage.error });
    }

    const imageUrl = `/api/uploads/update-popups/${uploadedImage.fileName}`;

    logAdmin('update_popup_image_upload', req.user!.id, req.user!.username, undefined, uploadedImage.fileName, {
      imageUrl,
      mimeType: uploadedImage.mimeType,
      sizeBytes: uploadedImage.sizeBytes,
    });

    res.status(201).json({ imageUrl });
  } catch (error) {
    console.error('Admin upload update popup image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Upload image for items (admin only)
router.post('/items/upload-image', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const base64Data = typeof req.body.base64Data === 'string' ? req.body.base64Data : '';
    const mimeType = typeof req.body.mimeType === 'string' ? req.body.mimeType : '';

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required' });
    }

    const uploadedImage = await writeBase64UploadImage({
      base64Data,
      mimeType,
      uploadDir: ITEM_UPLOAD_DIR,
      maxBytes: MAX_ITEM_IMAGE_SIZE_BYTES,
    });

    if ('error' in uploadedImage) {
      return res.status(400).json({ error: uploadedImage.error });
    }

    const imageUrl = `/api/uploads/items/${uploadedImage.fileName}`;

    logAdmin('item_image_upload', req.user!.id, req.user!.username, undefined, uploadedImage.fileName, {
      imageUrl,
      mimeType: uploadedImage.mimeType,
      sizeBytes: uploadedImage.sizeBytes,
    });

    res.status(201).json({ imageUrl });
  } catch (error) {
    console.error('Admin upload item image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Suggest automatic summary from recent logs
router.get('/update-popups/suggest-summary', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const latestPopup = await prisma.updatePopup.findFirst({
      orderBy: { releaseDate: 'desc' },
      select: { releaseDate: true },
    });
    const sinceDate = latestPopup?.releaseDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [logCountsByType, recentAdminLogs] = await Promise.all([
      prisma.log.groupBy({
        by: ['type'],
        where: {
          createdAt: { gte: sinceDate },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.log.findMany({
        where: {
          type: 'ADMIN',
          createdAt: { gte: sinceDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          action: true,
          targetName: true,
          createdAt: true,
        },
      }),
    ]);

    const typeSummary = logCountsByType
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 4)
      .map((entry) => `${entry.type}: ${entry._count._all}`);

    const recentChanges = recentAdminLogs.map((log) => {
      const action = log.action.replace(/_/g, ' ');
      const target = log.targetName ? ` (${log.targetName})` : '';
      return `${action}${target}`;
    });

    const parts: string[] = [];
    if (typeSummary.length > 0) {
      parts.push(`Activité récente depuis le ${sinceDate.toISOString().slice(0, 10)}: ${typeSummary.join(', ')}.`);
    }
    if (recentChanges.length > 0) {
      parts.push(`Dernieres actions admin: ${recentChanges.join(' | ')}.`);
    }

    const suggestion = parts.join(' ').trim();
    res.json({
      suggestion: suggestion || 'Nouvelle mise a jour disponible.',
      sinceDate: sinceDate.toISOString(),
    });
  } catch (error) {
    console.error('Admin suggest update popup summary error:', error);
    res.status(500).json({ error: 'Failed to generate suggestion' });
  }
});

// ========== ONLINE ACTIVITY / PLAYER HISTORY ==========

// POST /api/admin/online-snapshot — take an immediate snapshot
router.post('/online-snapshot', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const count = getOnlineCount();
    const onlineUsers = getOnlineUsers();
    const usernames = JSON.stringify(onlineUsers);
    await prisma.onlineSnapshot.create({ data: { count, usernames } });

    logAdmin('online_snapshot_create', req.user!.id, req.user!.username, undefined, undefined, {
      count,
      userIds: onlineUsers.map((user) => user.userId),
      usernames: onlineUsers.map((user) => user.username),
    });

    res.json({ success: true, count });
  } catch (error) {
    console.error('Manual snapshot error:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

router.get('/activity-breakdown', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const rawDate = typeof req.query.date === 'string' ? req.query.date.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return res.status(400).json({ error: 'date must be provided in YYYY-MM-DD format' });
    }

    const start = new Date(`${rawDate}T00:00:00`);
    const end = new Date(`${rawDate}T23:59:59.999`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    const [snapshotBeforeStart, snapshotsInRange, snapshotAfterEnd, gameLogs] = await Promise.all([
      prisma.onlineSnapshot.findFirst({
        where: { createdAt: { lt: start } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, usernames: true },
      }),
      prisma.onlineSnapshot.findMany({
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, usernames: true },
      }),
      prisma.onlineSnapshot.findFirst({
        where: { createdAt: { gt: end } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, usernames: true },
      }),
      prisma.log.findMany({
        where: {
          type: 'GAME',
          action: { in: ['game_complete', 'game_reward', 'casino_bet'] },
          createdAt: { gte: start, lte: end },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, metadata: true, action: true },
      }),
    ]);

    const snapshots = buildSnapshotWindow(snapshotBeforeStart, snapshotsInRange, snapshotAfterEnd);

    const pageBuckets = createHourlyBuckets();
    const pageTotals = new Map<string, number>();

    for (const snapshot of snapshotsInRange) {
      let users: Array<{ currentPage?: string | null }> = [];
      try {
        const parsed = JSON.parse(snapshot.usernames) as unknown;
        if (Array.isArray(parsed)) {
          users = parsed.filter((entry): entry is { currentPage?: string | null } => (
            typeof entry === 'object' && entry !== null
          ));
        }
      } catch {
        users = [];
      }

      const bucket = pageBuckets[snapshot.createdAt.getHours()];
      bucket.sampleCount += 1;

      const counts = new Map<string, number>();
      for (const user of users) {
        const normalizedPage = normalizeTrackedPagePath(user.currentPage);
        if (!normalizedPage) continue;
        counts.set(normalizedPage, (counts.get(normalizedPage) ?? 0) + 1);
      }

      for (const [page, count] of counts.entries()) {
        bucket.values[page] = (bucket.values[page] ?? 0) + count;
        bucket.total += count;
        pageTotals.set(page, (pageTotals.get(page) ?? 0) + count);
      }
    }

    const topPages = Array.from(pageTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([page, total]) => ({ page, total: roundToSingleDecimal(total) }));
    const topPageSet = new Set(topPages.map((entry) => entry.page));

    const pageSeries = pageBuckets.map((bucket) => {
      const values: Record<string, number> = {};
      for (const page of topPageSet) {
        const rawValue = bucket.values[page] ?? 0;
        values[page] = bucket.sampleCount > 0 ? roundToSingleDecimal(rawValue / bucket.sampleCount) : 0;
      }
      return {
        hour: bucket.hour,
        hourLabel: bucket.hourLabel,
        total: bucket.sampleCount > 0 ? roundToSingleDecimal(bucket.total / bucket.sampleCount) : 0,
        values,
      };
    });

    const gameBuckets = createHourlyBuckets();
    const gameTotals = new Map<string, number>();
    const {
      totalSecondsByGame: gameDurationTotals,
      gameDurationBuckets,
    } = collectGameTimeFromSnapshots(snapshots, start, end);

    for (const log of gameLogs) {
      const gameType = extractGameTypeFromMetadata(log.metadata);
      if (!gameType) continue;

      const bucket = gameBuckets[log.createdAt.getHours()];
      bucket.values[gameType] = (bucket.values[gameType] ?? 0) + 1;
      bucket.total += 1;
      gameTotals.set(gameType, (gameTotals.get(gameType) ?? 0) + 1);
    }

    const topGames = Array.from(gameTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([gameType, total]) => ({ gameType, total }));
    const topGameSet = new Set(topGames.map((entry) => entry.gameType));

    const gameSeries = gameBuckets.map((bucket) => {
      const values: Record<string, number> = {};
      for (const gameType of topGameSet) {
        values[gameType] = bucket.values[gameType] ?? 0;
      }
      return {
        hour: bucket.hour,
        hourLabel: bucket.hourLabel,
        total: bucket.total,
        values,
      };
    });

    const topGameDurations = Array.from(gameDurationTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([gameType, totalSeconds]) => ({
        gameType,
        totalSeconds: Math.round(totalSeconds),
      }));
    const topGameDurationSet = new Set(topGameDurations.map((entry) => entry.gameType));

    const gameDurationSeries = gameDurationBuckets.map((bucket) => {
      const values: Record<string, number> = {};
      for (const gameType of topGameDurationSet) {
        values[gameType] = roundToSingleDecimal(bucket.values[gameType] ?? 0);
      }
      return {
        hour: bucket.hour,
        hourLabel: bucket.hourLabel,
        total: roundToSingleDecimal(bucket.total),
        values,
      };
    });

    res.json({
      date: rawDate,
      pageSeries,
      topPages,
      gameSeries,
      topGames,
      gameDurationSeries,
      topGameDurations,
    });
  } catch (error) {
    console.error('Admin activity breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch activity breakdown' });
  }
});

// GET /api/admin/online-history
// Query params:
//   period: 'day' | 'week' | 'month' | 'custom' (default: 'day')
//   startDate, endDate: ISO strings (for 'custom')
//   granularity: 'auto' | 'minute' | 'hour' | 'day' (default: 'auto')
router.get('/online-history', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'day', startDate, endDate } = req.query as Record<string, string>;

    let start: Date;
    let end: Date = new Date();

    switch (period) {
      case 'week':
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'startDate and endDate required for custom period' });
        }
        start = new Date(startDate);
        end = new Date(endDate);
        break;
      default: { // 'day' — start from today's midnight (local time)
        const d = new Date();
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
    }

    const [snapshots, loginLogs, gameLogs] = await Promise.all([
      prisma.onlineSnapshot.findMany({
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'asc' },
        select: { count: true, createdAt: true, usernames: true },
      }),
      prisma.log.findMany({
        where: {
          type: 'AUTH',
          action: 'login',
          createdAt: { gte: start, lte: end },
          userId: { not: null },
        },
        select: { userId: true },
      }),
      prisma.log.findMany({
        where: {
          type: 'GAME',
          action: { in: ['game_complete', 'casino_bet'] },
          createdAt: { gte: start, lte: end },
        },
        select: { createdAt: true, userId: true },
      }),
    ]);

    type SnapUser = { userId: string; username: string };
    const MAX_POINTS = 300;
    const parseUsernames = (raw: string): SnapUser[] =>
      parseSnapshotUsers(raw).flatMap((entry) => (
        typeof entry.userId === 'string' && typeof entry.username === 'string'
          ? [{ userId: entry.userId, username: entry.username }]
          : []
      ));

    let data: { timestamp: string; count: number; max: number; usernames: SnapUser[] }[];

    if (snapshots.length <= MAX_POINTS) {
      data = snapshots.map(s => ({
        timestamp: s.createdAt.toISOString(),
        count: s.count,
        max: s.count,
        usernames: parseUsernames(s.usernames),
      }));
    } else {
      // Downsample: divide range into MAX_POINTS equal slots, keep peak snapshot per slot
      const rangeMs = end.getTime() - start.getTime();
      const bucketMs = rangeMs / MAX_POINTS;
      const buckets = new Map<number, typeof snapshots[number]>();
      for (const snap of snapshots) {
        const bucket = Math.floor((snap.createdAt.getTime() - start.getTime()) / bucketMs);
        const existing = buckets.get(bucket);
        if (!existing || snap.count > existing.count) {
          buckets.set(bucket, snap);
        }
      }
      data = Array.from(buckets.entries())
        .sort(([a], [b]) => a - b)
        .map(([, snap]) => ({
          timestamp: snap.createdAt.toISOString(),
          count: snap.count,
          max: snap.count,
          usernames: parseUsernames(snap.usernames),
        }));
    }

    // Peak for the queried period
    const peak = snapshots.reduce((m, s) => (s.count > m ? s.count : m), 0);
    const peakSnapshot = snapshots.find(s => s.count === peak);
    const uniqueConnectedUserIds = new Set<string>();
    const hourStats = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      totalOnline: 0,
      peakOnline: 0,
      sampleCount: 0,
    }));
    const weekdayStats = Array.from({ length: 7 }, (_, day) => ({
      day,
      totalGames: 0,
      uniquePlayers: new Set<string>(),
    }));

    for (const log of loginLogs) {
      if (typeof log.userId === 'string' && log.userId) {
        uniqueConnectedUserIds.add(log.userId);
      }
    }

    for (const snapshot of snapshots) {
      const hourStat = hourStats[snapshot.createdAt.getHours()];
      hourStat.totalOnline += snapshot.count;
      hourStat.peakOnline = Math.max(hourStat.peakOnline, snapshot.count);
      hourStat.sampleCount += 1;

      for (const user of parseSnapshotUsers(snapshot.usernames)) {
        if (typeof user.userId === 'string' && user.userId) {
          uniqueConnectedUserIds.add(user.userId);
        }
      }
    }

    for (const log of gameLogs) {
      const weekdayStat = weekdayStats[log.createdAt.getDay()];
      weekdayStat.totalGames += 1;
      if (typeof log.userId === 'string' && log.userId) {
        weekdayStat.uniquePlayers.add(log.userId);
      }
    }

    const peakHours = hourStats
      .filter((entry) => entry.sampleCount > 0)
      .map((entry) => ({
        hour: entry.hour,
        label: `${String(entry.hour).padStart(2, '0')}h-${String((entry.hour + 1) % 24).padStart(2, '0')}h`,
        averageOnline: roundToSingleDecimal(entry.totalOnline / entry.sampleCount),
        peakOnline: entry.peakOnline,
        sampleCount: entry.sampleCount,
      }))
      .sort((a, b) => (
        b.averageOnline - a.averageOnline ||
        b.peakOnline - a.peakOnline ||
        b.sampleCount - a.sampleCount ||
        a.hour - b.hour
      ))
      .slice(0, 3);

    const busiestWeekdayEntry = [...weekdayStats]
      .sort((a, b) => (
        b.totalGames - a.totalGames ||
        b.uniquePlayers.size - a.uniquePlayers.size ||
        a.day - b.day
      ))
      .find((entry) => entry.totalGames > 0);

    res.json({
      data,
      peak,
      peakAt: peakSnapshot?.createdAt ?? null,
      insights: {
        uniqueConnectedUsers: uniqueConnectedUserIds.size,
        busiestWeekday: busiestWeekdayEntry
          ? {
              day: busiestWeekdayEntry.day,
              label: WEEKDAY_LABELS[busiestWeekdayEntry.day],
              totalGames: busiestWeekdayEntry.totalGames,
              uniquePlayers: busiestWeekdayEntry.uniquePlayers.size,
            }
          : null,
        peakHours,
      },
      period,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  } catch (error) {
    console.error('Online history error:', error);
    res.status(500).json({ error: 'Failed to fetch online history' });
  }
});

// GET /api/admin/online-stats
// Returns overall record, current count, and 24h/7d/30d averages
// ========== BAN APPEALS ==========

// Submit a ban appeal (public – no auth needed, verified by banId ownership)
router.post('/ban-appeals', async (req: AuthRequest, res: Response) => {
  try {
    const { banId, userId, message } = req.body;

    if (!banId || !userId || !message) {
      return res.status(400).json({ error: 'banId, userId and message are required' });
    }

    if (typeof message !== 'string' || message.trim().length < 10) {
      return res.status(400).json({ error: 'Le message doit faire au moins 10 caractères' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: 'Le message ne peut pas dépasser 1000 caractères' });
    }

    // Verify the ban belongs to this user
    const ban = await prisma.ban.findFirst({
      where: { id: banId, userId },
    });

    if (!ban) {
      return res.status(404).json({ error: 'Ban introuvable' });
    }

    // One appeal per ban
    const existingAppeal = await prisma.banAppeal.findFirst({
      where: { banId, userId },
    });

    if (existingAppeal) {
      return res.status(400).json({ error: 'Vous avez déjà soumis un appel pour ce bannissement' });
    }

    const appeal = await prisma.banAppeal.create({
      data: { userId, banId, message: message.trim() },
    });

    const admins = await prisma.user.findMany({
      where: { isAdmin: true, isApproved: true },
      select: { id: true },
    });

    await Promise.allSettled(admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: 'SYSTEM',
        title: 'Nouvel appel de ban',
        body: `Un utilisateur a soumis un appel de bannissement.`,
        data: {
          appealId: appeal.id,
          banId,
          userId,
        },
        link: '/admin',
        icon: 'shield-alert',
      })
    ));

    res.status(201).json({ appeal });
  } catch (error) {
    console.error('Submit ban appeal error:', error);
    res.status(500).json({ error: 'Failed to submit ban appeal' });
  }
});

// Get all ban appeals (admin only)
router.get('/ban-appeals', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const banAppeals = await prisma.banAppeal.findMany({
      include: {
        user: { select: { id: true, username: true, email: true } },
        ban: { select: { id: true, reason: true, type: true, expiresAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ banAppeals });
  } catch (error) {
    console.error('Get ban appeals error:', error);
    res.status(500).json({ error: 'Failed to get ban appeals' });
  }
});

// Review a ban appeal (admin only)
router.put('/ban-appeals/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }

    const appeal = await prisma.banAppeal.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true } }, ban: true },
    });

    if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
    if (appeal.status !== 'PENDING') return res.status(400).json({ error: 'Appeal already reviewed' });

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    const updated = await prisma.banAppeal.update({
      where: { id },
      data: { status: newStatus, reviewedAt: new Date(), reviewedBy: req.user!.id },
      include: {
        user: { select: { id: true, username: true, email: true } },
        ban: { select: { id: true, reason: true, type: true, expiresAt: true } },
      },
    });

    if (action === 'approve') {
      await prisma.ban.updateMany({
        where: { userId: appeal.userId, isActive: true },
        data: { isActive: false },
      });
      logBan('ban_remove', req.user!.id, undefined, appeal.userId, appeal.user.username, { via: 'appeal', appealId: id });
    } else {
      logAdmin('appeal_reject', req.user!.id, undefined, appeal.userId, appeal.user.username, { appealId: id });
    }

    createNotification({
      userId: appeal.userId,
      type: 'SYSTEM',
      title: action === 'approve' ? 'Appel accepté' : 'Appel refusé',
      body: action === 'approve'
        ? 'Ton appel a été accepté et ton bannissement a été levé.'
        : 'Ton appel a été refusé par l’administration.',
      data: {
        appealId: id,
        action,
        banId: appeal.banId,
      },
      link: action === 'approve' ? '/login' : '/banned',
      icon: action === 'approve' ? 'shield-check' : 'shield-x',
    }).catch(() => {});

    res.json({ banAppeal: updated });
  } catch (error) {
    console.error('Review ban appeal error:', error);
    res.status(500).json({ error: 'Failed to review ban appeal' });
  }
});

// ========== NAME CHANGE REQUESTS ==========

// Get all name change requests (admin only)
router.get('/name-change-requests', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const nameChangeRequests = await prisma.nameChangeRequest.findMany({
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ nameChangeRequests });
  } catch (error) {
    console.error('Get name change requests error:', error);
    res.status(500).json({ error: 'Failed to get name change requests' });
  }
});

// Review a name change request (admin only)
router.put('/name-change-requests/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }

    const request = await prisma.nameChangeRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true } } },
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Request already reviewed' });

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    const updated = await prisma.nameChangeRequest.update({
      where: { id },
      data: { status: newStatus, reviewedAt: new Date(), reviewedBy: req.user!.id },
      include: { user: { select: { id: true, username: true, email: true } } },
    });

    if (action === 'approve') {
      // Check if username is still available
      const taken = await prisma.user.findFirst({
        where: { username: request.requestedUsername, NOT: { id: request.userId } },
      });
      if (taken) {
        // Revert status to PENDING with a note – or just reject
        await prisma.nameChangeRequest.update({ where: { id }, data: { status: 'REJECTED' } });
        return res.status(400).json({ error: 'Ce pseudo est déjà pris, demande rejetée automatiquement' });
      }
      await prisma.user.update({
        where: { id: request.userId },
        data: { username: request.requestedUsername },
      });
      logAdmin('username_change', req.user!.id, undefined, request.userId, request.user.username, {
        from: request.currentUsername,
        to: request.requestedUsername,
      });
    } else {
      logAdmin('username_change_reject', req.user!.id, req.user!.username, request.userId, request.user.username, {
        from: request.currentUsername,
        requested: request.requestedUsername,
      });
    }

    createNotification({
      userId: request.userId,
      type: 'SYSTEM',
      title: action === 'approve' ? 'Changement de pseudo accepté' : 'Changement de pseudo refusé',
      body: action === 'approve'
        ? `Ton pseudo est maintenant ${request.requestedUsername}.`
        : `Ta demande pour ${request.requestedUsername} a été refusée.`,
      data: {
        requestId: request.id,
        action,
        currentUsername: request.currentUsername,
        requestedUsername: request.requestedUsername,
      },
      link: '/settings',
      icon: 'user-round-pen',
    }).catch(() => {});

    res.json({ nameChangeRequest: updated });
  } catch (error) {
    console.error('Review name change request error:', error);
    res.status(500).json({ error: 'Failed to review name change request' });
  }
});

router.get('/online-stats', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const day1Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [allTimeRecord, day1Snaps, days7Snaps, days30Snaps] = await Promise.all([
      prisma.onlineSnapshot.findFirst({ orderBy: { count: 'desc' }, select: { count: true, createdAt: true } }),
      prisma.onlineSnapshot.findMany({ where: { createdAt: { gte: day1Ago } }, select: { count: true } }),
      prisma.onlineSnapshot.findMany({ where: { createdAt: { gte: days7Ago } }, select: { count: true } }),
      prisma.onlineSnapshot.findMany({ where: { createdAt: { gte: days30Ago } }, select: { count: true } }),
    ]);

    const avg = (snaps: { count: number }[]) =>
      snaps.length ? Math.round(snaps.reduce((s, x) => s + x.count, 0) / snaps.length) : 0;

    const peak1d = day1Snaps.reduce((m, s) => (s.count > m ? s.count : m), 0);
    const peak7d = days7Snaps.reduce((m, s) => (s.count > m ? s.count : m), 0);
    const peak30d = days30Snaps.reduce((m, s) => (s.count > m ? s.count : m), 0);

    res.json({
      current: getOnlineCount(),
      allTimeRecord: allTimeRecord?.count ?? 0,
      allTimeRecordAt: allTimeRecord?.createdAt ?? null,
      avg1d: avg(day1Snaps),
      avg7d: avg(days7Snaps),
      avg30d: avg(days30Snaps),
      peak1d,
      peak7d,
      peak30d,
    });
  } catch (error) {
    console.error('Online stats error:', error);
    res.status(500).json({ error: 'Failed to fetch online stats' });
  }
});

// ========== ADMIN WARNING SYSTEM ==========

// Get all warnings (admin only)
router.get('/warnings', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const warnings = await prisma.adminWarning.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        issuedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ warnings });
  } catch (error) {
    console.error('Admin get warnings error:', error);
    res.status(500).json({ error: 'Failed to get warnings' });
  }
});

// Create a warning (admin only)
router.post('/warnings', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, message, severity, type, amount } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'User ID and message are required' });
    }

    const validSeverities = ['LOW', 'MEDIUM', 'HIGH'];
    const warningSeverity = severity && validSeverities.includes(severity) ? severity : 'MEDIUM';

    const validTypes = ['AVERTISSEMENT', 'AMENDE'];
    const warningType = type && validTypes.includes(type) ? type : 'AVERTISSEMENT';

    // Validate amende amount if it's an amende
    let amendeAmount = undefined;
    if (warningType === 'AMENDE') {
      if (amount && typeof amount === 'number' && amount > 0) {
        amendeAmount = amount;
      } else {
        return res.status(400).json({ error: 'Valid amount is required for amende' });
      }
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isAdmin: true, username: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create the warning
    const warning = await prisma.adminWarning.create({
      data: {
        userId,
        issuedById: req.user!.id,
        type: warningType,
        message: message.trim(),
        severity: warningSeverity,
        amount: amendeAmount,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        issuedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Log warning creation
    logAdmin('warning_create', req.user!.id, req.user!.username, userId, user.username, {
      type: warningType,
      severity: warningSeverity,
      message: message.trim(),
      amount: amendeAmount,
    });

    // Emit socket event to show warning modal to the user
    io.to(`user:${userId}`).emit('admin:warning', {
      id: warning.id,
      type: warning.type,
      message: warning.message,
      severity: warning.severity,
      amount: warning.amount,
      issuedBy: warning.issuedBy.username,
      createdAt: warning.createdAt.toISOString(),
    });

    res.status(201).json({ warning, message: `${warningType === 'AMENDE' ? 'Amende' : 'Warning'} sent to ${user.username}` });
  } catch (error) {
    console.error('Admin create warning error:', error);
    res.status(500).json({ error: 'Failed to create warning' });
  }
});

// Delete a warning (admin only)
router.delete('/warnings/:id', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const warning = await prisma.adminWarning.findUnique({
      where: { id },
      include: {
        user: {
          select: { username: true },
        },
      },
    });

    if (!warning) {
      return res.status(404).json({ error: 'Warning not found' });
    }

    await prisma.adminWarning.delete({
      where: { id },
    });

    // Log warning deletion
    logAdmin('warning_delete', req.user!.id, req.user!.username, warning.userId, warning.user.username, {
      warningId: id,
    });

    res.json({ success: true, message: 'Warning deleted' });
  } catch (error) {
    console.error('Admin delete warning error:', error);
    res.status(500).json({ error: 'Failed to delete warning' });
  }
});

// Backfill GameScoreHistory from game_complete logs
router.post('/backfill-score-history', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isSuperAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const logs = await prisma.log.findMany({
      where: { type: 'GAME', action: 'game_complete', userId: { not: null }, metadata: { not: null } },
      select: { userId: true, metadata: true, createdAt: true },
    });

    let inserted = 0;
    let skipped = 0;
    const records: { userId: string; gameType: string; score: number; createdAt: Date }[] = [];

    for (const log of logs) {
      try {
        const meta = JSON.parse(log.metadata!);
        const gameType = meta.gameType;
        const score = meta.score;
        if (!gameType || score == null || !log.userId) { skipped++; continue; }
        records.push({ userId: log.userId, gameType, score: Number(score), createdAt: log.createdAt });
      } catch { skipped++; }
    }

    if (records.length > 0) {
      const result = await prisma.gameScoreHistory.createMany({ data: records });
      inserted = result.count;
    }

    res.json({ success: true, inserted, skipped });
  } catch (error) {
    console.error('Backfill error:', error);
    res.status(500).json({ error: 'Backfill failed' });
  }
});

// ========== PLAYTIME LEADERBOARD ==========

// GET /api/admin/playtime-leaderboard
// Returns top players ranked by total playtime over a period
// Query params:
//   period: 'day' | 'week' | 'month' | 'custom' (default: 'day')
//   startDate, endDate: ISO strings (for 'custom')
//   limit: max results (default: 50, max: 200)
router.get('/playtime-leaderboard', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'day', startDate, endDate, limit = '50' } = req.query as Record<string, string>;

    let start: Date;
    let end: Date = new Date();

    switch (period) {
      case 'week':
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'startDate and endDate required for custom period' });
        }
        start = parseLogDateBoundary(startDate, 'start') ?? new Date('invalid');
        end = parseLogDateBoundary(endDate, 'end') ?? new Date('invalid');
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({ error: 'Invalid date format' });
        }
        break;
      default: { // 'day'
        const d = new Date();
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
    }

    const maxLimit = Math.min(parseInt(limit) || 50, 200);

    const [gameLogs, snapshotBeforeStart, snapshotsInRange, snapshotAfterEnd] = await Promise.all([
      prisma.log.findMany({
        where: {
          type: 'GAME',
          action: 'game_complete',
          createdAt: { gte: start, lte: end },
          userId: { not: null },
        },
        select: {
          userId: true,
        },
      }),
      prisma.onlineSnapshot.findFirst({
        where: { createdAt: { lt: start } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, usernames: true },
      }),
      prisma.onlineSnapshot.findMany({
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, usernames: true },
      }),
      prisma.onlineSnapshot.findFirst({
        where: { createdAt: { gt: end } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, usernames: true },
      }),
    ]);

    const snapshots = buildSnapshotWindow(snapshotBeforeStart, snapshotsInRange, snapshotAfterEnd);
    const { totalSecondsByUser: screenTimeByUser } = collectGameTimeFromSnapshots(snapshots, start, end);

    const gamesPlayedByUser = new Map<string, number>();
    for (const log of gameLogs) {
      if (typeof log.userId !== 'string' || log.userId === '') continue;
      gamesPlayedByUser.set(log.userId, (gamesPlayedByUser.get(log.userId) ?? 0) + 1);
    }

    const playtimeByUser = new Map<string, { totalSeconds: number; gamesPlayed: number }>();
    for (const [userId, totalSeconds] of screenTimeByUser.entries()) {
      if (totalSeconds <= 0) continue;
      playtimeByUser.set(userId, {
        totalSeconds,
        gamesPlayed: gamesPlayedByUser.get(userId) ?? 0,
      });
    }

    // Get user info for all users with playtime
    const userIds = Array.from(playtimeByUser.keys());
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        profilePicture: true,
        usernameColor: true,
      },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    // Build leaderboard
    const leaderboard = Array.from(playtimeByUser.entries())
      .map(([userId, { totalSeconds, gamesPlayed }]) => {
        const user = userMap.get(userId);
        return {
          userId,
          username: user?.username ?? 'Unknown',
          profilePicture: user?.profilePicture ?? null,
          usernameColor: user?.usernameColor ?? null,
          totalSeconds: Math.round(totalSeconds),
          gamesPlayed,
          averageGameDuration: gamesPlayed > 0
            ? Math.round((totalSeconds / gamesPlayed) * 100) / 100
            : 0,
        };
      })
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, maxLimit);

    // Add rank
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

    res.json({
      period,
      start: start.toISOString(),
      end: end.toISOString(),
      leaderboard: rankedLeaderboard,
      totalEntries: playtimeByUser.size,
      limit: maxLimit,
    });
  } catch (error) {
    console.error('Admin playtime leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch playtime leaderboard' });
  }
});

// ========== PLATFORM STATS ==========

// GET /api/admin/platform-stats
// Returns aggregated platform-wide stats for the admin statistics dashboard
router.get('/platform-stats', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      approvedUsers,
      userAuraMoney,
      gameStatsTotals,
      topGamesByPlays,
      bombPartyTotals,
      transferTotals,
      recentGameLogs,
    ] = await Promise.all([
      prisma.user.count({ where: { isSuperAdmin: false } }),
      prisma.user.count({ where: { isSuperAdmin: false, isApproved: true } }),
      prisma.user.aggregate({
        where: { isSuperAdmin: false },
        _sum: { aura: true, money: true },
      }),
      prisma.gameStats.aggregate({
        _sum: { totalPlayed: true, wins: true },
      }),
      prisma.gameStats.groupBy({
        by: ['gameType'],
        _sum: { totalPlayed: true, wins: true },
        orderBy: { _sum: { totalPlayed: 'desc' } },
      }),
      prisma.bombPartyStats.aggregate({
        _sum: { totalPlayed: true, wins: true, wordsTyped: true },
      }),
      prisma.transfer.aggregate({
        _count: { _all: true },
        _sum: { auraAmount: true, moneyAmount: true },
      }),
      prisma.log.findMany({
        where: {
          type: 'GAME',
          action: 'game_complete',
          createdAt: { gte: thirtyDaysAgo },
          userId: { not: null },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Build activity chart (last 30 days, per day)
    const activityByDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
      activityByDay[d.toISOString().slice(0, 10)] = 0;
    }
    for (const log of recentGameLogs) {
      const key = log.createdAt.toISOString().slice(0, 10);
      if (key in activityByDay) activityByDay[key]++;
    }
    const activityChart = Object.entries(activityByDay).map(([date, count]) => ({ date, count }));

    const totalGamesPlayed = (gameStatsTotals._sum.totalPlayed ?? 0) + (bombPartyTotals._sum.totalPlayed ?? 0);
    const totalWins = (gameStatsTotals._sum.wins ?? 0) + (bombPartyTotals._sum.wins ?? 0);

    return res.json({
      overview: {
        totalUsers,
        approvedUsers,
        totalAura: (userAuraMoney._sum.aura ?? BigInt(0)).toString(),
        totalMoney: userAuraMoney._sum.money ?? 0,
        totalGamesPlayed,
        totalWins,
        totalTransfers: transferTotals._count._all,
        totalAuraTransferred: transferTotals._sum.auraAmount ?? 0,
        totalMoneyTransferred: transferTotals._sum.moneyAmount ?? 0,
        totalWordsTyped: bombPartyTotals._sum.wordsTyped ?? 0,
      },
      topGames: topGamesByPlays.map((g) => ({
        gameType: g.gameType,
        totalPlayed: g._sum.totalPlayed ?? 0,
        wins: g._sum.wins ?? 0,
      })),
      activityChart,
    });
  } catch (error) {
    console.error('Admin platform stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});

// GET /api/admin/referrals/stats
// Returns referral funnel stats and top referrers for admin dashboard
router.get('/referrals/stats', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      rewardAmount,
      referralEnabled,
      totalUsersWithCode,
      totalReferredUsers,
      approvedReferredUsers,
      pendingReferredUsers,
      rewardedReferrals,
      neverApprovedReferredUsers,
      topReferrers,
    ] = await Promise.all([
      getReferralRewardAmount(),
      isReferralEnabled(),
      prisma.user.count({
        where: {
          isSuperAdmin: false,
          referralCode: { not: null },
        },
      }),
      prisma.user.count({
        where: {
          isSuperAdmin: false,
          referredById: { not: null },
        },
      }),
      prisma.user.count({
        where: {
          isSuperAdmin: false,
          referredById: { not: null },
          isApproved: true,
        },
      }),
      prisma.user.count({
        where: {
          isSuperAdmin: false,
          referredById: { not: null },
          isApproved: false,
        },
      }),
      prisma.user.count({
        where: {
          isSuperAdmin: false,
          referredById: { not: null },
          referralRewardGrantedAt: { not: null },
        },
      }),
      prisma.user.count({
        where: {
          isSuperAdmin: false,
          referredById: { not: null },
          isApproved: false,
          createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.user.groupBy({
        by: ['referredById'],
        where: {
          referredById: { not: null },
          isSuperAdmin: false,
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
    ]);

    const referrerIds = topReferrers
      .map((entry) => entry.referredById)
      .filter((value): value is string => Boolean(value));

    const [referrers, approvedByReferrer, pendingByReferrer, rewardedByReferrer] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: referrerIds } },
        select: {
          id: true,
          username: true,
          referralCode: true,
          isApproved: true,
        },
      }),
      prisma.user.groupBy({
        by: ['referredById'],
        where: {
          referredById: { in: referrerIds },
          isApproved: true,
          isSuperAdmin: false,
        },
        _count: { id: true },
      }),
      prisma.user.groupBy({
        by: ['referredById'],
        where: {
          referredById: { in: referrerIds },
          isApproved: false,
          isSuperAdmin: false,
        },
        _count: { id: true },
      }),
      prisma.user.groupBy({
        by: ['referredById'],
        where: {
          referredById: { in: referrerIds },
          referralRewardGrantedAt: { not: null },
          isSuperAdmin: false,
        },
        _count: { id: true },
      }),
    ]);

    const referrerById = new Map(referrers.map((referrer) => [referrer.id, referrer]));
    const approvedCountById = new Map(
      approvedByReferrer
        .filter((entry): entry is typeof entry & { referredById: string } => Boolean(entry.referredById))
        .map((entry) => [entry.referredById, entry._count.id ?? 0])
    );
    const pendingCountById = new Map(
      pendingByReferrer
        .filter((entry): entry is typeof entry & { referredById: string } => Boolean(entry.referredById))
        .map((entry) => [entry.referredById, entry._count.id ?? 0])
    );
    const rewardedCountById = new Map(
      rewardedByReferrer
        .filter((entry): entry is typeof entry & { referredById: string } => Boolean(entry.referredById))
        .map((entry) => [entry.referredById, entry._count.id ?? 0])
    );

    const top = topReferrers
      .map((entry) => {
        if (!entry.referredById) return null;
        const referrer = referrerById.get(entry.referredById);
        if (!referrer) return null;
        const approvedCount = approvedCountById.get(entry.referredById) ?? 0;
        const pendingCount = pendingCountById.get(entry.referredById) ?? 0;
        const rewardedCount = rewardedCountById.get(entry.referredById) ?? 0;
        return {
          userId: referrer.id,
          username: referrer.username,
          referralCode: referrer.referralCode,
          isApproved: referrer.isApproved,
          totalReferrals: entry._count.id ?? 0,
          approvedReferrals: approvedCount,
          pendingReferrals: pendingCount,
          rewardedReferrals: rewardedCount,
          totalRewardsGiven: rewardedCount * rewardAmount,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return res.json({
      overview: {
        referralEnabled,
        rewardAmount,
        totalUsersWithCode,
        totalReferredUsers,
        approvedReferredUsers,
        pendingReferredUsers,
        rewardedReferrals,
        rewardPayoutTotal: rewardedReferrals * rewardAmount,
        conversionRate: totalReferredUsers > 0 ? Number(((approvedReferredUsers / totalReferredUsers) * 100).toFixed(2)) : 0,
        pendingRate: totalReferredUsers > 0 ? Number(((pendingReferredUsers / totalReferredUsers) * 100).toFixed(2)) : 0,
        stalePendingOlderThan7Days: neverApprovedReferredUsers,
      },
      topReferrers: top,
    });
  } catch (error) {
    console.error('Admin referral stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
});

// --- Business Admin Controls ---
const BUSINESS_CREATION_ENABLED_KEY = 'business_creation_enabled';

router.post('/businesses/purge', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await adminPurgeAllBusinesses();
    res.json(result);
  } catch (error) {
    console.error('Admin purge businesses error:', error);
    res.status(500).json({ error: 'Failed to purge businesses' });
  }
});

router.post('/businesses/reset-unlock-levels', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await adminResetBusinessUnlockLevels();
    res.json(result);
  } catch (error) {
    console.error('Admin reset business unlock levels error:', error);
    res.status(500).json({ error: 'Failed to reset unlock levels' });
  }
});

router.get('/businesses/creation-enabled', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const setting = await prisma.gameSettings.findUnique({ where: { key: BUSINESS_CREATION_ENABLED_KEY } });
    const enabled = setting?.value !== 'false';
    res.json({ enabled });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

router.post('/businesses/creation-enabled', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const enabled = req.body?.enabled !== false;
  try {
    await prisma.gameSettings.upsert({
      where: { key: BUSINESS_CREATION_ENABLED_KEY },
      update: { value: enabled ? 'true' : 'false' },
      create: { key: BUSINESS_CREATION_ENABLED_KEY, value: enabled ? 'true' : 'false' },
    });
    res.json({ enabled });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
