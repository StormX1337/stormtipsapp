/*
 * STORM TIPS service worker.
 *
 * Two jobs, and deliberately no third: receive push messages, and open the
 * right screen when one is tapped. There is no offline cache here — a betting
 * feed served from yesterday's cache is worse than an error, because a price
 * that has moved reads exactly like one that has not.
 */

self.addEventListener('install', () => {
  // Take over straight away; there is no old cache to drain.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'STORM TIPS', body: event.data.text() };
  }

  const title = payload.title || 'STORM TIPS';
  event.waitUntil(Promise.all([notify(title, payload), tellOpenTabs(payload)]));
});

function notify(title, payload) {
  return self.registration.showNotification(title, {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    // Same collapse behaviour as the mobile apps: a second message about the
    // same match replaces the first rather than stacking.
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { deepLink: payload.deepLink || '/free', ...(payload.data || {}) },
  });
}

/*
 * A push that arrives while the reader is looking at the feed should not leave
 * a stale page behind the notification. Open tabs are told, and they refetch.
 */
async function tellOpenTabs(payload) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ source: 'storm-tips', type: 'push', payload });
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.deepLink || '/free', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reuse a tab that is already open rather than piling up windows.
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
