import dotenv from 'dotenv';

dotenv.config();

const rawCorsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:5173'];

const expandAuratrackerOrigins = (origins: string[]): string[] => {
  const expanded = new Set<string>(origins);

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      const isAuraTracker = url.hostname === 'auratracker.xyz' || url.hostname === 'www.auratracker.xyz';

      if (isAuraTracker) {
        const altHost = url.hostname.startsWith('www.')
          ? url.hostname.slice(4)
          : `www.${url.hostname}`;
        expanded.add(`${url.protocol}//${altHost}`);
      }
    } catch {
      // Ignore invalid origins; keep as-is.
    }
  }

  return Array.from(expanded);
};

const corsOrigin = expandAuratrackerOrigins(rawCorsOrigins);

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@auratracker.com',
};
