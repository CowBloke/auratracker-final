import { prisma, io } from '../server.js';
import { sendWebPushForNotification } from './web-push.js';

export type NotificationType =
  | 'AURA_RECEIVED'
  | 'MONEY_RECEIVED'
  | 'GIFT_RECEIVED'
  | 'ITEM_RECEIVED'
  | 'CLAN_MESSAGE'
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

export function normalizeNotificationLink(link?: string | null) {
  if (link === '/games/polymarket') return '/polymarket';
  return link ?? null;
}

interface NotificationLike {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: string | Record<string, unknown> | null;
  link: string | null;
  icon: string | null;
  isRead: boolean;
  readAt: Date | string | null;
  isArchived: boolean;
  archivedAt: Date | string | null;
  createdAt: Date | string;
}

export function serializeNotification(notification: NotificationLike) {
  const parsedData = typeof notification.data === 'string'
    ? JSON.parse(notification.data)
    : notification.data ?? null;

  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: parsedData,
    link: normalizeNotificationLink(notification.link),
    icon: notification.icon,
    isRead: notification.isRead,
    readAt: notification.readAt
      ? (notification.readAt instanceof Date ? notification.readAt.toISOString() : notification.readAt)
      : null,
    isArchived: notification.isArchived,
    archivedAt: notification.archivedAt
      ? (notification.archivedAt instanceof Date ? notification.archivedAt.toISOString() : notification.archivedAt)
      : null,
    createdAt: notification.createdAt instanceof Date
      ? notification.createdAt.toISOString()
      : notification.createdAt,
  };
}

export function emitNotificationCreated(notification: NotificationLike) {
  io.to(`user:${notification.userId}`).emit('notification:new', serializeNotification(notification));
}

export function emitNotificationUpdated(notification: NotificationLike) {
  io.to(`user:${notification.userId}`).emit('notification:updated', serializeNotification(notification));
}

export function emitNotificationDeleted(userId: string, id: string) {
  io.to(`user:${userId}`).emit('notification:deleted', { id });
}

/**
 * Persist a notification in the database and push it in real-time via Socket.io.
 * Returns the created notification record.
 */
export async function createNotification(opts: CreateNotificationOptions) {
  const { userId, type, title, body, data, link, icon } = opts;
  const normalizedLink = normalizeNotificationLink(link);

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data ? JSON.stringify(data) : null,
      link: normalizedLink,
      icon: icon ?? null,
    },
  });

  emitNotificationCreated(notification);

  const serialized = serializeNotification(notification);
  void sendWebPushForNotification({
    id: serialized.id,
    userId: serialized.userId,
    title: serialized.title,
    body: serialized.body,
    link: serialized.link,
    icon: serialized.icon,
    data: serialized.data,
  }).catch(() => {});

  return notification;
}
