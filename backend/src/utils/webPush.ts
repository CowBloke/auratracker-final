import webpush, { type PushSubscription } from 'web-push';
import { prisma } from '../server.js';
import { config } from '../config/index.js';

export interface PushNotificationPayload {
  id: string;
  userId: string;
  title: string;
  body: string;
  link: string | null;
  icon: string | null;
  data: Record<string, unknown> | null;
}

const webPushConfigured = Boolean(config.webPushPublicKey && config.webPushPrivateKey);

if (webPushConfigured) {
  webpush.setVapidDetails(
    config.webPushSubject,
    config.webPushPublicKey,
    config.webPushPrivateKey,
  );
}

export function isWebPushConfigured() {
  return webPushConfigured;
}

export function getWebPushPublicKey() {
  return config.webPushPublicKey;
}

function toPushSubscription(endpoint: string, p256dh: string, auth: string): PushSubscription {
  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  };
}

function buildPayload(notification: PushNotificationPayload) {
  return JSON.stringify({
    title: notification.title,
    body: notification.body,
    link: notification.link,
    icon: '/aura-icon.svg',
    badge: '/aura-icon-white.svg',
    tag: `aura-notification-${notification.id}`,
    data: {
      notificationId: notification.id,
      type: notification.data?.type ?? null,
    },
  });
}

export async function sendWebPushForNotification(notification: PushNotificationPayload) {
  if (!webPushConfigured) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: notification.userId },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (subscriptions.length === 0) return;

  const payload = buildPayload(notification);
  const staleIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          toPushSubscription(subscription.endpoint, subscription.p256dh, subscription.auth),
          payload,
          { TTL: 60 },
        );

        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: { lastUsedAt: new Date() },
        });
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(subscription.id);
          return;
        }
        console.error('Web push delivery failed:', error);
      }
    }),
  );

  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    });
  }
}
