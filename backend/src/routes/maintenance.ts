import { Router } from 'express';
import { prisma } from '../server.js';
import { getChatBlockState } from '../utils/chatSettings.js';

const router = Router();
const MAINTENANCE_ENABLED_KEY = 'maintenance_enabled';
const MAINTENANCE_MESSAGE_KEY = 'maintenance_message';
const MAINTENANCE_PAGES_KEY = 'maintenance_pages';
const MAINTENANCE_END_DATE_KEY = 'maintenance_end_date';
const BLOCKED_PAGES_KEY = 'blocked_pages';
const BLOCKED_MESSAGE_KEY = 'blocked_message';
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

router.get('/', async (_req, res) => {
  try {
    const [
      enabledSetting,
      messageSetting,
      pagesSetting,
      endDateSetting,
      blockedPagesSetting,
      blockedMessageSetting,
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
      prisma.gameSettings.findUnique({ where: { key: BLOCKED_PAGES_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: BLOCKED_MESSAGE_KEY } }),
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
    const enabled = enabledFromSetting || enabledFromLegacyPages;

    // Ne retourner endDate que si elle n'est pas vide
    const endDate = endDateSetting?.value && endDateSetting.value.trim() !== '' 
      ? endDateSetting.value 
      : null;

    // Garder le champ pages pour compat avec d'anciens front, mais il est désormais global
    const responsePages = enabled ? ['/'] : [];

    res.json({
      enabled,
      message,
      pages: responsePages,
      endDate,
      blockedPages,
      blockedMessage: blockedMessageSetting?.value ?? '',
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
