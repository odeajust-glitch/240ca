// Turn alerts on the line-up site (owner, 2026-10-22): the browser runs this
// in the background so an alert shows even when the page is closed. Published
// as /sw.js by lib/board/site.js. It only shows what the board checker sends
// and opens the site when the alert is tapped.
//
// Home Screen app (owner, 2026-11-11): it also keeps the last copy of the page
// itself (the shell: no line-up, no names, nothing from CATS) so the icon still
// opens to something with no signal. Network first, always: the saved copy is
// only used when the network fails. Nothing else is touched: data/, api/,
// auth/ and every other request go straight to the network, never saved.
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

const SHELL = 'board-shell-1';
const SHELL_PAGES = new Set(['/', '/index.html', '/board.html']);
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !SHELL_PAGES.has(url.pathname)) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok && res.type === 'basic' && !res.redirected) {
      const copy = res.clone();
      e.waitUntil(caches.open(SHELL).then((c) => c.put(url.pathname, copy)).catch(() => {}));
    }
    return res;
  }).catch(() => caches.open(SHELL).then((c) => c.match(url.pathname)).then((hit) => hit || new Response(
    '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font:16px system-ui;background:#12191b;color:#e2e9e8;padding:24px"><h1 style="font-size:20px">No connection</h1><p>The board needs a connection to show the line-up. Try again when you have signal.</p>',
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } }))));
});
