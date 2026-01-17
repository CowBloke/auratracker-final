import { Router } from 'express';
import { prisma } from '../server.js';

const router = Router();
const MAINTENANCE_ENABLED_KEY = 'maintenance_enabled';
const MAINTENANCE_MESSAGE_KEY = 'maintenance_message';

router.get('/', async (_req, res) => {
  try {
    const [enabledSetting, messageSetting] = await Promise.all([
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_ENABLED_KEY } }),
      prisma.gameSettings.findUnique({ where: { key: MAINTENANCE_MESSAGE_KEY } }),
    ]);

    const enabledValue = enabledSetting?.value?.toLowerCase() ?? 'false';
    const enabled = enabledValue === 'true' || enabledValue === '1';
    const message = messageSetting?.value ?? '';

    res.json({ enabled, message });
  } catch (error) {
    console.error('Get maintenance status error:', error);
    res.status(500).json({ error: 'Failed to get maintenance status' });
  }
});

export default router;
