import { Router } from 'express';
import { prisma } from '../server.js';
import { getChatBlockState } from '../utils/chat-settings.js';

const router = Router();
const MAINTENANCE_ENABLED_KEY = 'maintenance_enabled';
const MAINTENANCE_MESSAGE_KEY = 'maintenance_message';
const MAINTENANCE_PAGES_KEY = 'maintenance_pages';
const MAINTENANCE_END_DATE_KEY = 'maintenance_end_date';
const MAINTENANCE_AUTO_WEEKEND_ENABLED_KEY = 'maintenance_auto_weekend_enabled';
const BLOCKED_PAGES_KEY = 'blocked_pages';
const BLOCKED_MESSAGE_KEY = 'blocked_message';
const BLOCKED_PAGE_MESSAGES_KEY = 'blocked_page_messages';
const LOGIN_MESSAGE_KEY = 'login_message';
const LOGIN_REGISTER_CTA_ENABLED_KEY = 'login_register_cta_enabled';
const REFERRAL_ENABLED_KEY = 'referral_enabled';
const REFERRAL_DASHBOARD_CARD_ENABLED_KEY = 'referral_dashboard_card_enabled';
const DUEL_MATCHMAKING_ENABLED_KEY = 'duel_matchmaking_enabled';
const DEFAULT_LANDING_PAGE_KEY = 'default_landing_page';
const YOU_LOGO_ADMIN_ONLY_KEY = 'you_logo_admin_only';
const BETA_GAME_IDS_KEY = 'games_beta_ids';
const NEW_GAME_IDS_KEY = 'games_new_ids';

function parseStringArraySetting(rawValue?: string | null): string[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

function parseStringRecordSetting(rawValue?: string | null): Record<string, string> {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value.length > 0);

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

router.get('/', async (_req, res) => {
  try {
    const [
      enabledSetting,
      messageSetting,
      pagesSetting,
      endDateSetting,
      autoWeekendEnabledSetting,
      blockedPagesSetting,
      blockedMessageSetting,
      blockedPageMessagesSetting,
      loginMessageSetting,
      loginRegisterCtaEnabledSetting,
      referralEnabledSetting,
      referralDashboardCardEnabledSetting,
      duelMatchmakingEnabledSetting,
      defaultLandingPageSetting,
      youLogoAdminOnlySetting,
      betaGameIdsSetting,
      newGameIdsSetting,
      chatBlockState,
    ] = await Promise.all([
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_ENABLED_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_MESSAGE_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_PAGES_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_END_DATE_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_AUTO_WEEKEND_ENABLED_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: BLOCKED_PAGES_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: BLOCKED_MESSAGE_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: BLOCKED_PAGE_MESSAGES_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: LOGIN_MESSAGE_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: LOGIN_REGISTER_CTA_ENABLED_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: REFERRAL_ENABLED_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: REFERRAL_DASHBOARD_CARD_ENABLED_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: DUEL_MATCHMAKING_ENABLED_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: DEFAULT_LANDING_PAGE_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: YOU_LOGO_ADMIN_ONLY_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: BETA_GAME_IDS_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: NEW_GAME_IDS_KEY } }),
      getChatBlockState(),
    ]);

    const message = messageSetting?.value ?? '';
    let pages: string[] = [];
    const blockedPages = parseStringArraySetting(blockedPagesSetting?.value);
    const blockedPageMessages = parseStringRecordSetting(blockedPageMessagesSetting?.value);
    const betaGameIds = parseStringArraySetting(betaGameIdsSetting?.value);
    const newGameIds = parseStringArraySetting(newGameIdsSetting?.value);
    
    if (pagesSetting?.value) {
      try {
        pages = JSON.parse(pagesSetting.value);
        if (!Array.isArray(pages)) {
          pages = [];
        }
      } catch {
        pages = [];
      }
    }

    const enabledFromSetting = enabledSetting?.value === 'true';
    const enabledFromLegacyPages = pages.length > 0;

    // Ne retourner endDate que si elle n'est pas vide
    const endDate = endDateSetting?.value && endDateSetting.value.trim() !== '' 
      ? endDateSetting.value 
      : null;

    const endDateMs = endDate ? new Date(endDate).getTime() : Number.NaN;
    const isExpired = Number.isFinite(endDateMs) && endDateMs <= Date.now();
    const manualMaintenanceEnabled = (enabledFromSetting || enabledFromLegacyPages) && !isExpired;
    const autoWeekendEnabled = autoWeekendEnabledSetting?.value === 'true';
    const currentDay = new Date().getDay();
    const autoWeekendActive = autoWeekendEnabled && (currentDay === 0 || currentDay === 6);
    const enabled = manualMaintenanceEnabled || autoWeekendActive;

    if (isExpired && (enabledFromSetting || enabledFromLegacyPages)) {
      await Promise.all([
        prisma.gameSettings.upsert({
          where: { key: MAINTENANCE_ENABLED_KEY },
          create: { key: MAINTENANCE_ENABLED_KEY, value: 'false' },
          update: { value: 'false' },
        }),
        prisma.gameSettings.upsert({
          where: { key: MAINTENANCE_PAGES_KEY },
          create: { key: MAINTENANCE_PAGES_KEY, value: '[]' },
          update: { value: '[]' },
        }),
      ]);
    }

    // Garder le champ pages pour compat avec d'anciens front, mais il est désormais global
    const responsePages = enabled ? ['/'] : [];

    res.json({
      enabled,
      message,
      pages: responsePages,
      endDate,
      autoWeekendEnabled,
      autoWeekendActive,
      blockedPages,
      blockedMessage: blockedMessageSetting?.value ?? '',
      blockedPageMessages,
      loginMessage: loginMessageSetting?.value ?? '',
      loginRegisterCtaEnabled: loginRegisterCtaEnabledSetting?.value !== 'false',
      referralEnabled: referralEnabledSetting?.value !== 'false',
      referralDashboardCardEnabled: referralDashboardCardEnabledSetting?.value !== 'false',
      duelMatchmakingEnabled: duelMatchmakingEnabledSetting?.value !== 'false',
      defaultLandingPage: defaultLandingPageSetting?.value ?? '/dashboard',
      youLogoAdminOnly: youLogoAdminOnlySetting?.value === 'true',
      betaGameIds,
      newGameIds,
      chatBlocked: chatBlockState.blocked,
      chatBlockReason: chatBlockState.activeReason,
      chatBlockMessage: chatBlockState.blockMessage,
      chatAutoBlockEnabled: chatBlockState.autoBlockEnabled,
      chatAutoBlockStart: chatBlockState.autoBlockStart,
      chatAutoBlockEnd: chatBlockState.autoBlockEnd,
      chatAutoBlockActive: chatBlockState.autoBlockActive,
      chatBlockTimezone: chatBlockState.timezone,
    });
  } catch (error) {
    console.error('Get maintenance status error:', error);
    res.status(500).json({ error: 'Failed to get maintenance status' });
  }
});

export default router;
