import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// This route is deprecated - image uploads via file are no longer supported
// Only URL-based image uploads are allowed
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  return res.status(410).json({ error: 'File uploads are no longer supported. Please use image URLs instead.' });
});

export default router;
