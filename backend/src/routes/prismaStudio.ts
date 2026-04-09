import { Router, type NextFunction, type Response } from 'express';
import { spawn, ChildProcess } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import type { AuthRequest } from '../middleware/auth.js';

export const prismaStudioRouter = Router();

let prismaStudioProcess: ChildProcess | null = null;
let isStarting = false;

const STUDIO_TOKEN_TYPE = 'prisma-studio';
const STUDIO_TOKEN_TTL = '10m';

type StudioTokenPayload = {
  userId: string;
  isAdmin: boolean;
  type: typeof STUDIO_TOKEN_TYPE;
};

const extractStudioToken = (url?: string): string | null => {
  if (!url) {
    return null;
  }

  const [, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  const token = params.get('studioToken');
  return token || null;
};

const verifyStudioToken = (token: string): StudioTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as StudioTokenPayload;
    if (decoded.type !== STUDIO_TOKEN_TYPE || !decoded.isAdmin || !decoded.userId) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
};

export const prismaStudioAccessMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractStudioToken(req.originalUrl || req.url);
  if (!token) {
    return res.status(401).json({ error: 'No studio token provided' });
  }

  const decoded = verifyStudioToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid studio token' });
  }

  req.user = {
    id: decoded.userId,
    email: '',
    username: '',
    isAdmin: decoded.isAdmin,
    isSuperAdmin: false,
    isBetaTester: false,
    referralCode: null,
  };

  return next();
};

export const canUpgradePrismaStudio = (url?: string): boolean => {
  const token = extractStudioToken(url);
  if (!token) {
    return false;
  }
  return !!verifyStudioToken(token);
};

prismaStudioRouter.post('/start', (req: AuthRequest, res) => {
  if (prismaStudioProcess) {
    const studioToken = jwt.sign(
      {
        userId: req.user!.id,
        isAdmin: true,
        type: STUDIO_TOKEN_TYPE,
      },
      config.jwtSecret,
      { expiresIn: STUDIO_TOKEN_TTL }
    );
    return res.json({ ok: true, message: 'Already running', studioToken });
  }
  
  if (isStarting) {
    const studioToken = jwt.sign(
      {
        userId: req.user!.id,
        isAdmin: true,
        type: STUDIO_TOKEN_TYPE,
      },
      config.jwtSecret,
      { expiresIn: STUDIO_TOKEN_TTL }
    );
    return res.json({ ok: true, message: 'Starting currently', studioToken });
  }

  isStarting = true;

  try {
    const isWindows = /^win/.test(process.platform);
    const cmd = isWindows ? 'npx.cmd' : 'npx';
    
    prismaStudioProcess = spawn(
      cmd, 
      ['prisma', 'studio', '--hostname', 'localhost', '--port', '5555'], 
      {
        detached: true,
        stdio: 'ignore', // Detach completely
      }
    );

    prismaStudioProcess.on('error', (err) => {
      console.error('Failed to start Prisma Studio proxy process', err);
      prismaStudioProcess = null;
      isStarting = false;
    });

    prismaStudioProcess.on('exit', () => {
      prismaStudioProcess = null;
      isStarting = false;
    });

    // Unref allows the parent process to exit independently of the child
    prismaStudioProcess.unref();

    // Give Prisma Studio a few seconds to boot up before returning success
    setTimeout(() => {
      isStarting = false;
      const studioToken = jwt.sign(
        {
          userId: req.user!.id,
          isAdmin: true,
          type: STUDIO_TOKEN_TYPE,
        },
        config.jwtSecret,
        { expiresIn: STUDIO_TOKEN_TTL }
      );
      res.json({ ok: true, studioToken });
    }, 3500);
  } catch (error) {
    isStarting = false;
    res.status(500).json({ error: 'Failed to start Prisma Studio process' });
  }
});

export const createPrismaStudioProxy = () => {
  return createProxyMiddleware({
    target: 'http://localhost:5555',
    changeOrigin: true,
    ws: true,
    // Ensure empty path rewrites to "/" so Prisma Studio's root is served correctly
    pathRewrite: (path: string) => path.replace(/^\/api\/admin\/prisma-studio/, '') || '/',
  });
};
