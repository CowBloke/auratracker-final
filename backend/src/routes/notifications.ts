import { Router, Response } from 'express';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import {
  emitNotificationDeleted,
  emitNotificationUpdated,
  serializeNotification,
} from '../utils/notifications.js';

const router = Router();

const PAGE_SIZE = 20;

function serialize(n: any) {
  return serializeNotification(n);
}

// ─── GET /notifications ───────────────────────────────────────────────────────
// ?page=1&limit=20&unreadOnly=false&archived=false
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),       10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? PAGE_SIZE), 10)));
    const unreadOnly = req.query.unreadOnly === 'true';
    const archived   = req.query.archived   === 'true';

    const where = {
      userId: req.user.id,
      isArchived: archived,
      ...(unreadOnly && !archived ? { isRead: false } : {}),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.notification.count({ where }),
    ]);

    res.json({ notifications: notifications.map(serialize), total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// ─── GET /notifications/unread/count ─────────────────────────────────────────
router.get('/unread/count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const count = await prisma.notification.count({ where: { userId: req.user.id, isRead: false, isArchived: false } });
    res.json({ count });
  } catch (error) {
    console.error('Get notification count error:', error);
    res.status(500).json({ error: 'Failed to get notification count' });
  }
});

// ─── POST /notifications/read-all ────────────────────────────────────────────
router.post('/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const idsToMarkRead = await prisma.notification.findMany({
      where: { userId: req.user.id, isRead: false, isArchived: false },
      select: { id: true },
    });
    const readAt = new Date();
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false, isArchived: false },
      data: { isRead: true, readAt },
    });
    if (idsToMarkRead.length > 0) {
      const { io: socketIo } = await import('../server.js');
      socketIo.to(`user:${req.user.id}`).emit('notification:read-all', {
        ids: idsToMarkRead.map((notification) => notification.id),
        readAt: readAt.toISOString(),
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// ─── POST /notifications/archive-all-read ────────────────────────────────────
router.post('/archive-all-read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const idsToArchive = await prisma.notification.findMany({
      where: { userId: req.user.id, isRead: true, isArchived: false },
      select: { id: true },
    });
    const archivedAt = new Date();
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: true, isArchived: false },
      data: { isArchived: true, archivedAt },
    });
    if (idsToArchive.length > 0) {
      const { io: socketIo } = await import('../server.js');
      socketIo.to(`user:${req.user.id}`).emit('notification:archive-all-read', {
        ids: idsToArchive.map((notification) => notification.id),
        archivedAt: archivedAt.toISOString(),
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Archive all read error:', error);
    res.status(500).json({ error: 'Failed to archive notifications' });
  }
});

// ─── POST /notifications/:id/read ────────────────────────────────────────────
router.post('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true, readAt: new Date() } });
    emitNotificationUpdated(updated);
    res.json({ notification: serialize(updated) });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// ─── POST /notifications/:id/archive ─────────────────────────────────────────
// Toggles the archived state.
router.post('/:id/archive', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const nowArchived = !notification.isArchived;
    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isArchived: nowArchived, archivedAt: nowArchived ? new Date() : null },
    });
    emitNotificationUpdated(updated);
    res.json({ notification: serialize(updated) });
  } catch (error) {
    console.error('Archive notification error:', error);
    res.status(500).json({ error: 'Failed to archive notification' });
  }
});

// ─── DELETE /notifications/:id ────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await prisma.notification.delete({ where: { id: req.params.id } });
    emitNotificationDeleted(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// ─── DELETE /notifications ─────────────────────────────────────────────────────
router.delete('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    await prisma.notification.deleteMany({ where: { userId: req.user.id, isRead: true } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete all read notifications error:', error);
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
});

// ─── Admin: POST /notifications/broadcast ─────────────────────────────────────
router.post('/broadcast', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const { title, body, link, icon } = req.body as { title: string; body: string; link?: string; icon?: string };
    if (!title || !body) return res.status(400).json({ error: 'title and body are required' });

    const users = await prisma.user.findMany({ where: { isApproved: true }, select: { id: true } });
    await prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, type: 'ADMIN', title, body, link: link ?? null, icon: icon ?? 'megaphone' })),
    });

    const { io: socketIo } = await import('../server.js');
    socketIo.emit('notification:broadcast', { title, body, link, icon });

    res.json({ success: true, sent: users.length });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

export default router;
