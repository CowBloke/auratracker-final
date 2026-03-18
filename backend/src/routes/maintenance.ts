import { Router } from 'express';
import { prisma } from '../server.js';

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
    ]);

    const message = messageSetting?.value ?? '';
    let pages: string[] = [];
    let blockedPages: string[] = [];
    
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

    if (blockedPagesSetting?.value) {
      try {
        const parsed = JSON.parse(blockedPagesSetting.value);
        if (Array.isArray(parsed)) {
          blockedPages = parsed.filter((p): p is string => typeof p === 'string');
        }
      } catch {
        blockedPages = [];
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
    });
  } catch (error) {
    console.error('Get maintenance status error:', error);
    res.status(500).json({ error: 'Failed to get maintenance status' });
  }
});

export default router;
