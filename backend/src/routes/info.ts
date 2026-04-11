import { Router } from 'express';
import type { Response, Request } from 'express';
import { prisma } from '../server.js';
import {
  DEFAULT_TAX_BRACKET_THRESHOLD,
  DEFAULT_TAX_BRACKET_RATE,
} from '../utils/dailyTax.js';

const router = Router();

/**
 * GET /api/info/tax-brackets
 * Public endpoint — returns the current tax brackets configured by admins.
 */
router.get('/tax-brackets', async (_req: Request, res: Response) => {
  try {
    const brackets = await prisma.taxBracket.findMany({
      orderBy: { threshold: 'asc' },
      select: { id: true, threshold: true, rate: true },
    });

    const effective =
      brackets.length > 0
        ? brackets
        : [
            {
              id: 'default',
              threshold: DEFAULT_TAX_BRACKET_THRESHOLD,
              rate: DEFAULT_TAX_BRACKET_RATE,
            },
          ];

    res.json({
      brackets: effective,
      isDefault: brackets.length === 0,
    });
  } catch {
    res.status(500).json({ error: 'Impossible de récupérer les paliers fiscaux.' });
  }
});

export default router;
