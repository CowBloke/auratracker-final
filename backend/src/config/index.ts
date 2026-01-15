import dotenv from 'dotenv';

dotenv.config();

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:5173'];

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@auratracker.com',
};
