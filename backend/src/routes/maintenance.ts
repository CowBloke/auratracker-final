import { Router } from 'express';
import { prisma } from '../server.js';

const router = Router();
const MAINTENANCE_MESSAGE_KEY = 'maintenance_message';
const MAINTENANCE_PAGES_KEY = 'maintenance_pages';

router.get('/', async (_req, res) => {
  try {
    const [messageSetting, pagesSetting] = await Promise.all([
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_MESSAGE_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_PAGES_KEY } }),
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

    res.json({ enabled: pages.length > 0, message, pages });
  } catch (error) {
    console.error('Get maintenance status error:', error);
    res.status(500).json({ error: 'Failed to get maintenance status' });
  }
});

export default router;
