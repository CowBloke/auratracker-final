import { Router, Response } from 'express';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { writeBase64UploadImage } from '../utils/uploads.js';

const router = Router();

const USER_IMAGE_UPLOAD_DIR = path.resolve('uploads', 'user-images');
const MAX_USER_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

// Upload image for authenticated users (suggestions, clans, profile, polymarket, etc.)
router.post('/image', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const base64Data = typeof req.body.base64Data === 'string' ? req.body.base64Data : '';
    const mimeType = typeof req.body.mimeType === 'string' ? req.body.mimeType : '';

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required' });
    }

    const uploadedImage = await writeBase64UploadImage({
      base64Data,
      mimeType,
      uploadDir: USER_IMAGE_UPLOAD_DIR,
      maxBytes: MAX_USER_IMAGE_SIZE_BYTES,
    });

    if ('error' in uploadedImage) {
      return res.status(400).json({ error: uploadedImage.error });
    }

    const imageUrl = `/api/uploads/user-images/${uploadedImage.fileName}`;
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
