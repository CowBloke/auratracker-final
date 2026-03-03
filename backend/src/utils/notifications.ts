import { prisma, io } from '../server.js';

export type NotificationType =
  | 'AURA_RECEIVED'
  | 'MONEY_RECEIVED'
  | 'GIFT_RECEIVED'
  | 'ITEM_RECEIVED'
  | 'CLAN_INVITE'
  | 'CLAN_JOIN_REQUEST'
  | 'CLAN_JOIN_ACCEPTED'
  | 'CLAN_JOIN_REJECTED'
  | 'BADGE_EARNED'
  | 'QUEST_COMPLETED'
  | 'POLYMARKET_WIN'
  | 'POLYMARKET_LOSS'
  | 'PARTY_INVITE'
  | 'SYSTEM'
  | 'ADMIN';

export interface CreateNotificationOptions {
  userId: string;
  type: NotificationType | string;
  title: string;
  body: string;
  /** Flexible JSON-serialisable payload (sender info, amounts, etc.) */
  data?: Record<string, unknown>;
  /** Front-end route to navigate to when the notification is clicked */
  link?: string;
  /** Lucide icon name shown on the front-end */
  icon?: string;
}

/**
 * Persist a notification in the database and push it in real-time via Socket.io.
 * Returns the created notification record.
 */
export async function createNotification(opts: CreateNotificationOptions) {
  const { userId, type, title, body, data, link, icon } = opts;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data ? JSON.stringify(data) : null,
      link: link ?? null,
      icon: icon ?? null,
    },
  });

  // Real-time push — the front-end joins its own user room on socket connect
  io.to(`user:${userId}`).emit('notification:new', {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: data ?? null,
    link: notification.link,
    icon: notification.icon,
    isRead: false,
    createdAt: notification.createdAt.toISOString(),
  });

  return notification;
}
