// Turn alerts on the line-up site (owner, 2026-10-22): the browser runs this
// in the background so an alert shows even when the page is closed. Published
// as /sw.js by lib/board/site.js. It only shows what the board checker sends
// and opens the site when the alert is tapped; it caches nothing.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Line-up', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || './#current' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const open = wins.find((w) => w.url.startsWith(self.registration.scope));
    if (open) return open.navigate(url).then((w) => (w || open).focus());
    return self.clients.openWindow(url);
  }));
});
