import { Router } from 'express';
import { spawn, ChildProcess } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';

export const prismaStudioRouter = Router();

let prismaStudioProcess: ChildProcess | null = null;
let isStarting = false;

prismaStudioRouter.post('/start', (req, res) => {
  if (prismaStudioProcess) {
    return res.json({ ok: true, message: 'Already running' });
  }
  
  if (isStarting) {
    return res.json({ ok: true, message: 'Starting currently' });
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
      res.json({ ok: true });
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
    pathRewrite: {
      '^/api/admin/prisma-studio': ''
    }
  });
};
