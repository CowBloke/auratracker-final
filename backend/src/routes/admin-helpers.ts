import path from 'path';
import { isAllowedImageUrl } from '../utils/uploads.js';

export const ANNOUNCEMENT_KEY = 'topbar_announcement';
export const ANNOUNCEMENT_MAX_LENGTH = 120;
export const AURACOIN_BUY_FEE_PERCENTAGE_KEY = 'auracoin_buy_fee_percentage';
export const STABLE_COIN_BUY_FEE_PERCENTAGE_KEY = 'stable_coin_buy_fee_percentage';
export const CHAOS_COIN_BUY_FEE_PERCENTAGE_KEY = 'chaos_coin_buy_fee_percentage';
export const DUEL_MATCHMAKING_ENABLED_SETTING_KEY = 'duel_matchmaking_enabled';
export const CLASH_ATTACK_COOLDOWN_MINUTES_KEY = 'clash_attack_cooldown_minutes';
export const DAILY_AURA_DISTRIBUTION_LIMIT_KEY = 'daily_aura_distribution_limit';
export const DAILY_GAME_AURA_LIMIT_KEY = 'daily_game_aura_limit';
export const DAILY_GAME_MONEY_LIMIT_KEY = 'daily_game_money_limit';
export const DEFAULT_LANDING_PAGE_SETTING_KEY = 'default_landing_page';
export const YOU_LOGO_ADMIN_ONLY_SETTING_KEY = 'you_logo_admin_only';
export const ALLOWED_DEFAULT_LANDING_PAGES = new Set([
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
export const ITEM_UPLOAD_DIR = path.resolve('uploads', 'items');
export const MAX_ITEM_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const ADMIN_CLAN_MAX_MEMBERS_LIMIT = 12;
export const LOG_EXPORT_BATCH_SIZE = 5000;
export const MAX_TAX_BRACKETS = 25;
export const FISC_FUND_RATE = 0.1;
export const SITE_RELOAD_TRIGGER_KEYS = new Set([
  'maintenance_enabled',
  'maintenance_message',
  'maintenance_pages',
  'maintenance_end_date',
  'maintenance_auto_weekend_enabled',
  'blocked_pages',
  'blocked_message',
  'blocked_page_messages',
]);

export type TaxBracketInput = {
  threshold: number;
  rate: number;
};

export type ClanEventQuestInput = {
  title: string;
  description?: string | null;
  activityType: string;
  targetValue: number;
  pointsReward: number;
  sortOrder: number;
  isActive: boolean;
};

export type ClanEventMiniGameInput = {
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

export type ClanEventRewardTierInput = {
  title: string;
  minRank: number;
  maxRank: number;
  moneyReward: number;
  auraReward: number;
  itemId: string | null;
};

export type ShopItemImportInput = {
  name: string;
  description: string;
  type: string;
  price: number;
  imageUrl?: string | null;
  effect?: string | Record<string, unknown> | null;
  expiresAt?: string | null;
};

export type ShopItemImportFile = {
  format?: string;
  version?: number;
  items?: ShopItemImportInput[];
};

export const SHOP_ITEMS_EXPORT_FORMAT = 'auratracker-shop-items';
export const SHOP_ITEMS_EXPORT_VERSION = 1;

export const normalizeImportedItem = (entry: unknown): { item: Omit<ShopItemImportInput, 'effect'> & { effect: string | null } } | { error: string } => {
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

export const normalizeTaxBracketsInput = (value: unknown): { brackets: TaxBracketInput[] } | { error: string } => {
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
      return { error: 'Thresholds must be unique' };
    }

    seenThresholds.add(threshold);
    brackets.push({ threshold, rate });
  }

  return { brackets };
};
