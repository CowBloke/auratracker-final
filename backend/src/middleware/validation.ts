import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(400).json({ error: 'Invalid request body' });
    }
  };
};

// Auth schemas
export const registerSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string(),
});

// Economy schemas
export const transferSchema = z.object({
  receiverId: z.string().uuid(),
  auraAmount: z.number().int().min(0).optional(),
  moneyAmount: z.number().int().min(0).optional(),
}).refine(
  (data) => (data.auraAmount || 0) + (data.moneyAmount || 0) > 0,
  { message: 'At least one currency must be transferred' }
);

export const giftAuraSchema = z.object({
  receiverId: z.string().uuid(),
  amount: z.number().int().min(1).max(50),
  message: z.string().max(50).optional(),
});

// Marketplace schemas
export const createItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  type: z.enum(['CONSUMABLE', 'COSMETIC', 'UPGRADE']),
  price: z.number().int().min(0),
  imageUrl: z.string().min(1).optional(),
  effect: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const purchaseSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});

export const useItemSchema = z.object({
  userItemId: z.string().uuid(),
  effectData: z.object({
    color: z.string().optional(),
    imageUrl: z.string().optional(),
  }).optional(),
});

// NFT schemas
export const createNftSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  price: z.number().int().min(0),
  imageUrl: z.string().min(1),
  rarity: z.enum(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']),
});

export const purchaseNftSchema = z.object({
  nftId: z.string().uuid(),
});

export const displayNftSchema = z.object({
  userNftId: z.string().uuid().nullable().optional(),
});

// Game schemas
export const gameCompleteSchema = z.object({
  score: z.number().int().min(0),
  won: z.boolean(),
  duration: z.number().int().min(0).optional(),
  bet: z.number().int().min(0).optional(),
  netGain: z.number().int().optional(),
});
