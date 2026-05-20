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

export type NotificationCategoryId =
  | 'aura'
  | 'clans'
  | 'social'
  | 'quetes'
  | 'polymarket'
  | 'systeme';

// Maps inbox categories to the notification types they group. Mirrors the
// categories shown on the frontend Inbox. Types not listed here have no
// category and are always delivered (cannot be disabled).
export const NOTIFICATION_CATEGORY_TYPES: Record<NotificationCategoryId, string[]> = {
  aura: ['AURA_RECEIVED'],
  clans: [
    'CLAN_MESSAGE',
    'CLAN_JOIN_REQUEST',
    'CLAN_JOIN_ACCEPTED',
    'CLAN_JOIN_REJECTED',
    'CLAN_WAR_DECLARED',
    'CLAN_WAR_COMPLETED',
    'CLAN_WAR_WON',
    'CLAN_WAR_LOST',
  ],
  social: ['SOCIAL_FOLLOW', 'SOCIAL_CONNECTION', 'DIRECT_MESSAGE'],
  quetes: ['QUEST_COMPLETED'],
  polymarket: ['POLYMARKET_WIN', 'POLYMARKET_LOSS'],
  systeme: ['SYSTEM', 'ADMIN'],
};

export const NOTIFICATION_CATEGORY_IDS = Object.keys(NOTIFICATION_CATEGORY_TYPES) as NotificationCategoryId[];

const TYPE_TO_CATEGORY: Record<string, NotificationCategoryId> = Object.fromEntries(
  NOTIFICATION_CATEGORY_IDS.flatMap((category) =>
    NOTIFICATION_CATEGORY_TYPES[category].map((type) => [type, category])
  )
);

export function getCategoryForType(type: string): NotificationCategoryId | null {
  return TYPE_TO_CATEGORY[type] ?? null;
}

/** Parse a stored preferences JSON string into a category→enabled map. */
export function parseNotificationPreferences(raw: string | null | undefined): Record<NotificationCategoryId, boolean> {
  const prefs = {} as Record<NotificationCategoryId, boolean>;
  let stored: Record<string, unknown> = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') stored = parsed as Record<string, unknown>;
    } catch {
      // Treat unparseable preferences as "all enabled".
    }
  }
  for (const category of NOTIFICATION_CATEGORY_IDS) {
    // Missing key defaults to enabled.
    prefs[category] = stored[category] !== false;
  }
  return prefs;
}

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

  // Respect the recipient's per-category inbox preferences. Types without a
  // category, or categories left enabled, are always delivered.
  const category = getCategoryForType(type);
  if (category) {
    const recipient = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });
    const prefs = parseNotificationPreferences(recipient?.notificationPreferences);
    if (!prefs[category]) return null;
  }

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
