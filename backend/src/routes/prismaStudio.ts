import { Router, type NextFunction, type Response } from 'express';
import { spawn, ChildProcess } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import net from 'net';
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
    isFiscalInspector: false,
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

  // Poll port 5555 until Prisma Studio is accepting connections (max ~20s)
  const waitForPort = (port: number, timeoutMs: number): Promise<void> =>
    new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const attempt = () => {
        const sock = net.connect(port, '127.0.0.1');
        sock.once('connect', () => { sock.destroy(); resolve(); });
        sock.once('error', () => {
          sock.destroy();
          if (Date.now() >= deadline) return reject(new Error(`Port ${port} not ready within ${timeoutMs}ms`));
          setTimeout(attempt, 500);
        });
      };
      attempt();
    });

  try {
    const isWindows = /^win/.test(process.platform);
    const cmd = isWindows ? 'npx.cmd' : 'npx';

    prismaStudioProcess = spawn(
      cmd,
      ['prisma', 'studio', '--hostname', 'localhost', '--port', '5555'],
      {
        detached: true,
        stdio: 'ignore',
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

    prismaStudioProcess.unref();

    // Wait until port 5555 is actually accepting connections (up to 20s)
    waitForPort(5555, 20_000)
      .then(() => {
        isStarting = false;
        const studioToken = jwt.sign(
          { userId: req.user!.id, isAdmin: true, type: STUDIO_TOKEN_TYPE },
          config.jwtSecret,
          { expiresIn: STUDIO_TOKEN_TTL }
        );
        res.json({ ok: true, studioToken });
      })
      .catch((err) => {
        isStarting = false;
        prismaStudioProcess = null;
        console.error('Prisma Studio did not become ready:', err.message);
        res.status(504).json({ error: 'Prisma Studio failed to start in time. Check that Prisma CLI is installed.' });
      });
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
    // app.use() already strips the mount prefix from req.url, so no pathRewrite needed.
    // Error handler: give a clear message when Prisma Studio is not running.
    on: {
      error: (_err: Error, _req: any, res: any) => {
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Prisma Studio is not running. Start it first via the admin panel.',
          });
        }
      },
    },
  });
};
