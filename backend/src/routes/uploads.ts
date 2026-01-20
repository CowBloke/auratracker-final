import { Router, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const UPLOAD_ROOT = path.resolve('uploads');
const MAX_BYTES = 10 * 1024 * 1024;
const PURPOSE_DIR: Record<string, string> = {
  suggestion: 'suggestions',
  item: 'items',
  profile: 'profiles',
};
const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return null;
  }
  const mime = match[1];
  const base64 = match[2];
  const extension = ALLOWED_MIME[mime];
  if (!extension) {
    return null;
  }
  const buffer = Buffer.from(base64, 'base64');
  return { buffer, extension };
};

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { purpose, imageData } = req.body as { purpose?: string; imageData?: string };

    if (!purpose || !imageData) {
      return res.status(400).json({ error: 'Missing upload data' });
    }

    const directory = PURPOSE_DIR[purpose];
    if (!directory) {
      return res.status(400).json({ error: 'Invalid upload purpose' });
    }

    const parsed = parseDataUrl(imageData);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    if (parsed.buffer.byteLength > MAX_BYTES) {
      return res.status(400).json({ error: 'Image too large (max 5MB)' });
    }

    const uploadDir = path.join(UPLOAD_ROOT, directory);
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}.${parsed.extension}`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, parsed.buffer);

    return res.json({ url: `/uploads/${directory}/${filename}` });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload image' });
  }
});

export default router;
