import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import {
  computePixelBoardAnalysis,
  ensurePixelBoardSettings,
  getPixelBoardSnapshot,
  PIXEL_BOARD_ROOM,
  serializePixelBoardSettings,
} from '../pixel-board/core.js';
import { io } from '../server.js';

const router = Router();

const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user?.isAdmin && !req.user?.isSuperAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

router.get('/state', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    res.json(await getPixelBoardSnapshot(prisma, req.user?.id));
  } catch (error) {
    console.error('Pixel board state error:', error);
    res.status(500).json({ error: 'Failed to load pixel board' });
  }
});

router.get('/analysis', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    res.json(await computePixelBoardAnalysis(prisma));
  } catch (error) {
    console.error('Pixel board analysis error:', error);
    res.status(500).json({ error: 'Failed to compute pixel board analysis' });
  }
});

router.patch('/admin/settings', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const current = await ensurePixelBoardSettings(prisma);
    const data: {
      cooldownSeconds?: number;
      durationSeconds?: number;
      endsAt?: Date | null;
      isPaused?: boolean;
      isEnded?: boolean;
      isLocked?: boolean;
      lockedMessage?: string;
    } = {};

    if (req.body.cooldownSeconds !== undefined) {
      const cooldown = Number(req.body.cooldownSeconds);
      if (!Number.isInteger(cooldown) || cooldown < 1 || cooldown > 3600) {
        return res.status(400).json({ error: 'Cooldown invalide.' });
      }
      data.cooldownSeconds = cooldown;
    }

    if (req.body.durationSeconds !== undefined) {
      const duration = Number(req.body.durationSeconds);
      if (!Number.isInteger(duration) || duration < 60 || duration > 31 * 24 * 60 * 60) {
        return res.status(400).json({ error: 'Duree invalide.' });
      }
      data.durationSeconds = duration;
      data.endsAt = new Date(current.startsAt.getTime() + duration * 1000);
    }

    if (req.body.isPaused !== undefined) {
      data.isPaused = Boolean(req.body.isPaused);
    }
    if (req.body.isLocked !== undefined) {
      data.isLocked = Boolean(req.body.isLocked);
    }
    if (req.body.lockedMessage !== undefined) {
      const message = String(req.body.lockedMessage).trim();
      if (message.length < 3 || message.length > 240) {
        return res.status(400).json({ error: 'Message de blocage invalide.' });
      }
      data.lockedMessage = message;
    }
    if (req.body.forceEnd === true) {
      data.isEnded = true;
      data.endsAt = new Date();
    }

    const settings = await prisma.pixelBoardSettings.update({
      where: { id: current.id },
      data,
    });
    const payload = serializePixelBoardSettings(settings);
    io.to(PIXEL_BOARD_ROOM).emit('pixel-board:settings', payload);
    res.json({ settings: payload });
  } catch (error) {
    console.error('Pixel board settings error:', error);
    res.status(500).json({ error: 'Failed to update pixel board settings' });
  }
});

router.post('/admin/reset', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    await prisma.pixelBoardPixel.deleteMany();
    io.to(PIXEL_BOARD_ROOM).emit('pixel-board:reset');
    res.json({ success: true });
  } catch (error) {
    console.error('Pixel board reset error:', error);
    res.status(500).json({ error: 'Failed to reset pixel board' });
  }
});

export default router;
