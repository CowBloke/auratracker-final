import { Router } from 'express';
import { prisma } from '../server.js';

const router = Router();
const MAINTENANCE_ENABLED_KEY = 'maintenance_enabled';
const MAINTENANCE_MESSAGE_KEY = 'maintenance_message';
const MAINTENANCE_PAGES_KEY = 'maintenance_pages';
const MAINTENANCE_END_DATE_KEY = 'maintenance_end_date';

router.get('/', async (_req, res) => {
  try {
    const [enabledSetting, messageSetting, pagesSetting, endDateSetting] = await Promise.all([
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_ENABLED_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_MESSAGE_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_PAGES_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_END_DATE_KEY } }),
    ]);

    const message = messageSetting?.value ?? '';
    let pages: string[] = [];
    
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

    res.json({ enabled, message, pages: responsePages, endDate });
  } catch (error) {
    console.error('Get maintenance status error:', error);
    res.status(500).json({ error: 'Failed to get maintenance status' });
  }
});

export default router;
