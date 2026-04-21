import { Router } from 'express';
import type { Response, Request } from 'express';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prisma } from '../server.js';
import {
  DEFAULT_TAX_BRACKET_THRESHOLD,
  DEFAULT_TAX_BRACKET_RATE,
} from '../utils/dailyTax.js';

const router = Router();
const isDevelopment = process.env.NODE_ENV === 'development';

function resolveBackendRoot() {
  const routeDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(routeDir, '../..'),
    path.resolve(routeDir, '../../..'),
    process.cwd(),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.resolve(candidate, 'prisma', 'seed.ts'))) {
      return candidate;
    }
  }

  return path.resolve(routeDir, '../..');
}

const backendRoot = resolveBackendRoot();
const seedScriptPath = path.resolve(backendRoot, 'prisma', 'seed.ts');
const seedVersionMarkerPath = path.resolve(backendRoot, 'prisma', '.seed-version.json');

type SeedVersionMarker = {
  version?: number;
  updatedAt?: string;
};

async function readSeedVersionState() {
  const scriptSource = await fs.readFile(seedScriptPath, 'utf8');
  const versionMatch = scriptSource.match(/const SEED_DATA_VERSION = (\d+);/);
  const currentVersion = versionMatch ? Number(versionMatch[1]) : 0;

  let appliedVersion = 0;
  try {
    const markerRaw = await fs.readFile(seedVersionMarkerPath, 'utf8');
    const marker = JSON.parse(markerRaw) as SeedVersionMarker;
    appliedVersion = Number(marker.version) || 0;
  } catch {
    appliedVersion = 0;
  }

  return {
    currentVersion,
    appliedVersion,
    needsUpdate: currentVersion > appliedVersion,
  };
}

async function runSeedScript() {
  await new Promise<void>((resolve, reject) => {
    const child = exec('npm run db:seed', { cwd: backendRoot }, (error, stdout, stderr) => {
      if (stdout) {
        process.stdout.write(stdout);
      }
      if (stderr) {
        process.stderr.write(stderr);
      }

      if (error) {
        reject(error);
        return;
      }

      resolve();
    });

    child.stdin?.end();
  });
}

/**
 * GET /api/info/tax-brackets
 * Public endpoint — returns the current tax brackets configured by admins.
 */
router.get('/tax-brackets', async (_req: Request, res: Response) => {
  try {
    const brackets = await prisma.taxBracket.findMany({
      orderBy: { threshold: 'asc' },
      select: { id: true, threshold: true, rate: true },
    });

    const effective =
      brackets.length > 0
        ? brackets
        : [
            {
              id: 'default',
              threshold: DEFAULT_TAX_BRACKET_THRESHOLD,
              rate: DEFAULT_TAX_BRACKET_RATE,
            },
          ];

    res.json({
      brackets: effective,
      isDefault: brackets.length === 0,
    });
  } catch {
    res.status(500).json({ error: 'Impossible de récupérer les paliers fiscaux.' });
  }
});

router.get('/seed/status', async (_req: Request, res: Response) => {
  if (!isDevelopment) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    res.json(await readSeedVersionState());
  } catch {
    res.status(500).json({ error: 'Impossible de lire la version du seed.' });
  }
});

router.post('/seed/run', async (_req: Request, res: Response) => {
  if (!isDevelopment) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    await runSeedScript();
    res.json(await readSeedVersionState());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de lancer le seed.';
    res.status(500).json({ error: message });
  }
});

export default router;
