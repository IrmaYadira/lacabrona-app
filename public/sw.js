/* ── La Cabrona Push Notification Service Worker ── */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = {};
  }

  const title = data.title || 'La Cabrona Alitas & Beer';
  const options = {
    body: data.body || 'Tienes una actualización',
    icon: data.icon || 'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285',
    badge: data.badge || 'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285',
    image: data.image || undefined,
    tag: data.tag || 'la-cabrona-default',
    requireInteraction: true,
    renotify: data.renotify ?? true,
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    data: data.data || {},
    actions: data.actions || [],
  };

  // Remove undefined image to avoid issues
  if (!options.image) delete options.image;

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const action = event.action;

  // Handle specific actions
  if (action === 'view-ticket') {
    const url = notificationData.ticketUrl || notificationData.url || '/';
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url && client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
    );
    return;
  }

  if (action === 'whatsapp') {
    const url = notificationData.whatsappUrl || `https://wa.me/?text=${encodeURIComponent(notificationData.ticketText || 'Mi ticket de La Cabrona')}`;
    event.waitUntil(
      self.clients.openWindow(url)
    );
    return;
  }

  // Default click: open the main URL
  const url = notificationData.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});