self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = null;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = payload?.title || 'Nouvelle notification';
  const body = payload?.body || '';
  const icon = payload?.icon || '/aura-icon.svg';
  const badge = payload?.badge || '/aura-icon-white.svg';
  const tag = payload?.tag || undefined;
  const link = typeof payload?.link === 'string' && payload.link.length > 0 ? payload.link : '/inbox';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: {
        link,
      },
      renotify: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const relativeLink = event.notification?.data?.link || '/inbox';
  const targetUrl = new URL(relativeLink, self.location.origin).toString();

  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          await client.navigate(targetUrl);
        }
        return;
      }
    }

    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});
