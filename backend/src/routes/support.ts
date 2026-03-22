import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

// ─── User endpoints ────────────────────────────────────────────────────────────

// GET /support/messages — user's own thread
router.get('/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const messages = await prisma.supportMessage.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ messages });
  } catch (error) {
    console.error('Get support messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// POST /support/messages — user sends a message
router.post('/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const { body } = req.body;
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ error: 'Message body is required' });
    }
    if (body.trim().length > 1000) {
      return res.status(400).json({ error: 'Message must be 1000 characters or less' });
    }

    const message = await prisma.supportMessage.create({
      data: { userId: req.user.id, body: body.trim(), fromAdmin: false },
    });

    // Notify all admins via socket (they're in admin:support room)
    io.to('admin:support').emit('support:message', {
      message: serializeMessage(message),
      username: req.user.username,
    });

    // Also create inbox notification for each admin
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
    });
    for (const admin of admins) {
      createNotification({
        userId: admin.id,
        type: 'SUPPORT_MESSAGE',
        title: 'Nouveau message de support',
        body: `${req.user.username} : "${body.trim().slice(0, 80)}${body.trim().length > 80 ? '…' : ''}"`,
        data: { userId: req.user.id, username: req.user.username },
        link: '/admin',
        icon: 'message-circle',
      }).catch(() => {});
    }

    res.json({ message: serializeMessage(message) });
  } catch (error) {
    console.error('Send support message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /support/unread-count — unread admin replies for the current user
router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const count = await prisma.supportMessage.count({
      where: { userId: req.user.id, fromAdmin: true, isRead: false },
    });

    res.json({ count });
  } catch (error) {
    console.error('Support unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// POST /support/messages/read — mark all admin replies as read (user side)
router.post('/messages/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    await prisma.supportMessage.updateMany({
      where: { userId: req.user.id, fromAdmin: true, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark support read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// ─── Admin endpoints ───────────────────────────────────────────────────────────

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin only' });
    return false;
  }
  return true;
}

// GET /support/admin/threads — list of all user threads with last message & unread count
router.get('/admin/threads', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    // Aggregate: for each userId that has support messages, get last message + unread count
    const threads = await prisma.$queryRaw<
      Array<{
        userId: string;
        lastBody: string;
        lastFromAdmin: number;
        lastCreatedAt: string;
        unreadCount: number;
      }>
    >`
      SELECT
        sm.userId,
        (SELECT body FROM SupportMessage WHERE userId = sm.userId ORDER BY createdAt DESC LIMIT 1) as lastBody,
        (SELECT fromAdmin FROM SupportMessage WHERE userId = sm.userId ORDER BY createdAt DESC LIMIT 1) as lastFromAdmin,
        (SELECT createdAt FROM SupportMessage WHERE userId = sm.userId ORDER BY createdAt DESC LIMIT 1) as lastCreatedAt,
        SUM(CASE WHEN sm.fromAdmin = 0 AND sm.isRead = 0 THEN 1 ELSE 0 END) as unreadCount
      FROM SupportMessage sm
      GROUP BY sm.userId
      ORDER BY lastCreatedAt DESC
    `;

    if (!threads.length) {
      return res.json({ threads: [] });
    }

    const userIds = threads.map((t) => t.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, profilePicture: true, usernameColor: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const result = threads.map((t) => ({
      userId: t.userId,
      user: userMap.get(t.userId) ?? null,
      lastBody: t.lastBody,
      lastFromAdmin: Boolean(t.lastFromAdmin),
      lastCreatedAt: t.lastCreatedAt,
      unreadCount: Number(t.unreadCount),
    }));

    res.json({ threads: result });
  } catch (error) {
    console.error('Get support threads error:', error);
    res.status(500).json({ error: 'Failed to get threads' });
  }
});

// GET /support/admin/threads/:userId — full thread for a specific user
router.get('/admin/threads/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { userId } = req.params;

    const [messages, user] = await Promise.all([
      prisma.supportMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, profilePicture: true, usernameColor: true },
      }),
    ]);

    res.json({ messages: messages.map(serializeMessage), user });
  } catch (error) {
    console.error('Get support thread error:', error);
    res.status(500).json({ error: 'Failed to get thread' });
  }
});

// POST /support/admin/reply/:userId — admin sends reply
router.post('/admin/reply/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { userId } = req.params;
    const { body } = req.body;

    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ error: 'Message body is required' });
    }
    if (body.trim().length > 1000) {
      return res.status(400).json({ error: 'Message must be 1000 characters or less' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const message = await prisma.supportMessage.create({
      data: { userId, body: body.trim(), fromAdmin: true },
    });

    // Push to user in real-time
    io.to(`user:${userId}`).emit('support:message', {
      message: serializeMessage(message),
    });

    // Inbox notification for the user
    createNotification({
      userId,
      type: 'SUPPORT_MESSAGE',
      title: 'Réponse du support',
      body: `Support : "${body.trim().slice(0, 80)}${body.trim().length > 80 ? '…' : ''}"`,
      data: { fromAdmin: true },
      link: '/support',
      icon: 'message-circle',
    }).catch(() => {});

    // Also notify other admins in the room so their thread list updates
    io.to('admin:support').emit('support:message', {
      message: serializeMessage(message),
      username: req.user!.username,
    });

    res.json({ message: serializeMessage(message) });
  } catch (error) {
    console.error('Admin support reply error:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// POST /support/admin/threads/:userId/read — admin marks user messages as read
router.post('/admin/threads/:userId/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { userId } = req.params;

    await prisma.supportMessage.updateMany({
      where: { userId, fromAdmin: false, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin mark support read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function serializeMessage(msg: { id: string; userId: string; body: string; fromAdmin: boolean; isRead: boolean; createdAt: Date }) {
  return {
    id: msg.id,
    userId: msg.userId,
    body: msg.body,
    fromAdmin: msg.fromAdmin,
    isRead: msg.isRead,
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
  };
}

export default router;
