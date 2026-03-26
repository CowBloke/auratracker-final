import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const USER_IMAGE_UPLOAD_DIR = path.resolve('uploads', 'user-images');
const MAX_USER_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const inferImageExtension = (mimeType: string) => {
  switch (mimeType.toLowerCase()) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    default: return null;
  }
};

// Upload image for authenticated users (suggestions, clans, profile, polymarket, etc.)
router.post('/image', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const base64Data = typeof req.body.base64Data === 'string' ? req.body.base64Data : '';
    const mimeType = typeof req.body.mimeType === 'string' ? req.body.mimeType : '';

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required' });
    }

    const extension = inferImageExtension(mimeType);
    if (!extension) {
      return res.status(400).json({ error: 'Unsupported image type. Allowed: png, jpg, webp, gif' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.byteLength === 0) {
      return res.status(400).json({ error: 'Invalid image payload' });
    }

    if (buffer.byteLength > MAX_USER_IMAGE_SIZE_BYTES) {
      return res.status(400).json({ error: 'Image too large (max 10MB)' });
    }

    if (!fs.existsSync(USER_IMAGE_UPLOAD_DIR)) {
      fs.mkdirSync(USER_IMAGE_UPLOAD_DIR, { recursive: true });
    }

    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const absolutePath = path.join(USER_IMAGE_UPLOAD_DIR, fileName);
    fs.writeFileSync(absolutePath, buffer);

    const imageUrl = `/api/uploads/user-images/${fileName}`;
    res.status(201).json({ imageUrl });
  } catch (error) {
    console.error('User image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Deprecated: old multipart upload route
router.post('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  return res.status(410).json({ error: 'File uploads are no longer supported. Please use image URLs instead.' });
});

export default router;
