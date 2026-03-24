import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 14 tracks from the polytrack.3 repo (version 0.3)
export const POLYTRACK_TRACKS = Array.from({ length: 14 }, (_, i) => ({
  number: i + 1,
  name: `Track ${i + 1}`,
}));

// Format milliseconds to mm:ss.mmm or ss.mmm
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  const secStr = seconds.toString().padStart(2, '0');
  const millisStr = millis.toString().padStart(3, '0');
  if (minutes > 0) {
    return `${minutes}:${secStr}.${millisStr}`;
  }
  return `${secStr}.${millisStr}`;
}

// GET /polytrack/tracks — all tracks with global record + user's personal best
router.get('/tracks', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // All global records (one per track = lowest time)
    const globalRecords = await prisma.polytrackRecord.groupBy({
      by: ['trackNumber'],
      _min: { timeMs: true },
    });

    // Map trackNumber → min timeMs
    const globalMap = new Map<number, number>();
    for (const r of globalRecords) {
      if (r._min.timeMs !== null) globalMap.set(r.trackNumber, r._min.timeMs);
    }

    // Holder of each global record (username)
    const holderQueries = await Promise.all(
      Array.from(globalMap.entries()).map(([trackNumber, timeMs]) =>
        prisma.polytrackRecord.findFirst({
          where: { trackNumber, timeMs },
          select: {
            userId: true,
            user: { select: { username: true, usernameColor: true, profilePicture: true } },
          },
        })
      )
    );
    const holderMap = new Map<number, { userId: string; username: string; usernameColor: string | null; profilePicture: string | null }>();
    Array.from(globalMap.entries()).forEach(([trackNumber], idx) => {
      const h = holderQueries[idx];
      if (h) holderMap.set(trackNumber, { userId: h.userId, ...h.user });
    });

    // User's personal bests for all tracks
    const userRecords = await prisma.polytrackRecord.findMany({
      where: { userId },
      select: { trackNumber: true, timeMs: true },
    });
    const userMap = new Map<number, number>();
    for (const r of userRecords) userMap.set(r.trackNumber, r.timeMs);

    const tracks = POLYTRACK_TRACKS.map((t) => {
      const globalTimeMs = globalMap.get(t.number) ?? null;
      const holder = holderMap.get(t.number) ?? null;
      const personalTimeMs = userMap.get(t.number) ?? null;
      return {
        number: t.number,
        name: t.name,
        globalRecord: globalTimeMs !== null
          ? { timeMs: globalTimeMs, timeDisplay: formatTime(globalTimeMs), holder }
          : null,
        personalBest: personalTimeMs !== null
          ? { timeMs: personalTimeMs, timeDisplay: formatTime(personalTimeMs) }
          : null,
      };
    });

    res.json({ tracks });
  } catch (error) {
    console.error('Get polytrack tracks error:', error);
    res.status(500).json({ error: 'Failed to get tracks' });
  }
});

// POST /polytrack/records — submit a personal best time for a track
router.post('/records', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { trackNumber, timeMs } = req.body as { trackNumber: unknown; timeMs: unknown };

    const trackNum = parseInt(String(trackNumber), 10);
    const timeMsNum = parseInt(String(timeMs), 10);

    if (!Number.isInteger(trackNum) || trackNum < 1 || trackNum > 14) {
      return res.status(400).json({ error: 'trackNumber must be an integer between 1 and 14' });
    }
    if (!Number.isInteger(timeMsNum) || timeMsNum <= 0 || timeMsNum > 600_000) {
      return res.status(400).json({ error: 'timeMs must be a positive integer under 600000' });
    }

    // Only save if it's a new personal best (lower time)
    const existing = await prisma.polytrackRecord.findUnique({
      where: { userId_trackNumber: { userId, trackNumber: trackNum } },
    });

    if (existing && existing.timeMs <= timeMsNum) {
      return res.json({
        saved: false,
        message: 'Not a new personal best',
        personalBest: { timeMs: existing.timeMs, timeDisplay: formatTime(existing.timeMs) },
      });
    }

    const record = await prisma.polytrackRecord.upsert({
      where: { userId_trackNumber: { userId, trackNumber: trackNum } },
      create: { userId, trackNumber: trackNum, timeMs: timeMsNum },
      update: { timeMs: timeMsNum, createdAt: new Date() },
    });

    // Check if this is a new global record
    const globalBest = await prisma.polytrackRecord.findFirst({
      where: { trackNumber: trackNum, timeMs: { lt: timeMsNum } },
      orderBy: { timeMs: 'asc' },
    });
    const isGlobalRecord = !globalBest;

    res.json({
      saved: true,
      isGlobalRecord,
      isNewPB: !existing || timeMsNum < existing.timeMs,
      personalBest: { timeMs: record.timeMs, timeDisplay: formatTime(record.timeMs) },
    });
  } catch (error) {
    console.error('Submit polytrack record error:', error);
    res.status(500).json({ error: 'Failed to submit record' });
  }
});

// GET /polytrack/leaderboard/:trackNumber — top times for a specific track
router.get('/leaderboard/:trackNumber', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const trackNum = parseInt(req.params.trackNumber, 10);
    if (!Number.isInteger(trackNum) || trackNum < 1 || trackNum > 14) {
      return res.status(400).json({ error: 'Invalid trackNumber' });
    }

    const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10), 100);

    const records = await prisma.polytrackRecord.findMany({
      where: {
        trackNumber: trackNum,
        user: { isSuperAdmin: false },
      },
      orderBy: { timeMs: 'asc' },
      take: limit,
      include: {
        user: {
          select: { id: true, username: true, usernameColor: true, profilePicture: true },
        },
      },
    });

    const rankings = records.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      username: r.user.username,
      usernameColor: r.user.usernameColor,
      profilePicture: r.user.profilePicture,
      timeMs: r.timeMs,
      timeDisplay: formatTime(r.timeMs),
      createdAt: r.createdAt,
    }));

    // User's own rank
    let userRank = null;
    if (req.user) {
      const userRecord = await prisma.polytrackRecord.findUnique({
        where: { userId_trackNumber: { userId: req.user.id, trackNumber: trackNum } },
      });
      if (userRecord) {
        const fasterCount = await prisma.polytrackRecord.count({
          where: { trackNumber: trackNum, timeMs: { lt: userRecord.timeMs }, user: { isSuperAdmin: false } },
        });
        userRank = {
          rank: fasterCount + 1,
          timeMs: userRecord.timeMs,
          timeDisplay: formatTime(userRecord.timeMs),
        };
      }
    }

    res.json({ trackNumber: trackNum, rankings, userRank });
  } catch (error) {
    console.error('Get polytrack leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

export default router;
