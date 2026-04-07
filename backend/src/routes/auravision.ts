import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../server.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

const MAX_REASON_LENGTH = 280;
const MAX_TRANSCRIPT_ITEMS = 8;
type TranscriptEntry = { sender: string; body: string };

router.post('/report', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const reporter = req.user;
    if (!reporter) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const peerUserId = typeof req.body?.peerUserId === 'string' ? req.body.peerUserId.trim() : '';
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const transcript: TranscriptEntry[] = Array.isArray(req.body?.transcript)
      ? req.body.transcript
          .filter((entry: unknown): entry is TranscriptEntry =>
            Boolean(entry) &&
            typeof (entry as TranscriptEntry).sender === 'string' &&
            typeof (entry as TranscriptEntry).body === 'string',
          )
          .slice(-MAX_TRANSCRIPT_ITEMS)
      : [];

    if (!peerUserId) {
      return res.status(400).json({ error: 'Missing peer user id' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'A reason is required' });
    }

    if (reason.length > MAX_REASON_LENGTH) {
      return res.status(400).json({ error: 'Reason is too long' });
    }

    const peer = await prisma.user.findUnique({
      where: { id: peerUserId },
      select: { id: true, username: true },
    });

    if (!peer) {
      return res.status(404).json({ error: 'Peer user not found' });
    }

    const transcriptBlock = transcript.length > 0
      ? `\n\nDerniers messages:\n${transcript.map((entry: TranscriptEntry) => `- ${entry.sender}: ${entry.body}`).join('\n')}`
      : '';

    const bugReport = await prisma.bugReport.create({
      data: {
        userId: reporter.id,
        title: `[AuraVision] Signalement contre ${peer.username}`,
        description: `Reporter: ${reporter.username} (${reporter.id})\nPeer: ${peer.username} (${peer.id})\nSession: ${sessionId || 'unknown'}\nReason: ${reason}${transcriptBlock}`,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    const admins = await prisma.user.findMany({
      where: {
        OR: [{ isAdmin: true }, { isSuperAdmin: true }],
      },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: 'AURAVISION_REPORT',
          title: 'Signalement AuraVision',
          body: `${reporter.username} a signale ${peer.username} sur AuraVision.`,
          data: {
            reportId: bugReport.id,
            peerUserId: peer.id,
            sessionId: sessionId || null,
          },
          link: '/admin',
          icon: 'shield-alert',
        }).catch(() => {}),
      ),
    );

    return res.status(201).json({
      report: {
        id: bugReport.id,
        title: bugReport.title,
        createdAt: bugReport.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('AuraVision report error:', error);
    return res.status(500).json({ error: 'Failed to create AuraVision report' });
  }
});

export default router;
