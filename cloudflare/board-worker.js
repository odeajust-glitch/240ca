// The line-up snapshot website on Cloudflare (owner, 2026-10-22). Serves the
// files the board checker uploads to the R2 bucket bound as SITE, and keeps
// phones' turn-alert subscriptions there (POST /push/subscribe), which the
// board checker reads to send the alerts. Subscriptions are never served. Cloudflare Access (Settings → Domains & Routes → workers.dev →
// Enable Cloudflare Access) asks each visitor for an allowed email and a
// one-time code before a request reaches this code.
//
// Setup: docs/board-checker/CLOUDFLARE.md. Paste this whole file into the
// Worker's editor in the Cloudflare dashboard.

const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json',
  txt: 'text/plain; charset=utf-8', png: 'image/png', css: 'text/css; charset=utf-8',
  odt: 'application/vnd.oasis.opendocument.text', webmanifest: 'application/manifest+json',
};

// Only real push services (Google, Apple, Mozilla, Microsoft).
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/, /\.notify\.windows\.com$/, /^push\.services\.mozilla\.com$/];
const TURN = /^[A-Z0-9]{2,6}$/;
const MAX_TURNS = 12;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function subKey(endpoint) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return `subs/${[...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')}.json`;
}

// { subscription: { endpoint, keys: { p256dh, auth } }, turns: ["SR03"],
//   prefs: { SR03: { lineup, ordered, onDuty: true/false, time: minutes (0 = off) } } }.
// An empty turns list removes the subscription.
async function subscribe(request, env) {
  const text = await request.text();
  if (text.length > 8192) return json({ error: 'too big' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'not JSON' }, 400); }
  const sub = body && body.subscription;
  let host = '';
  try { host = new URL(sub.endpoint).hostname; } catch { /* checked below */ }
  if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || !PUSH_HOSTS.some((re) => re.test(host))) {
    return json({ error: 'not a push subscription' }, 400);
  }
  const key = await subKey(sub.endpoint);
  const turns = [...new Set((Array.isArray(body.turns) ? body.turns : []).map((t) => String(t).toUpperCase()))].filter((t) => TURN.test(t)).slice(0, MAX_TURNS);
  if (!turns.length) {
    await env.SITE.delete(key);
    return json({ ok: true, turns: [] });
  }
  const keys = sub.keys || {};
  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || keys.p256dh.length > 200 || keys.auth.length > 100) {
    return json({ error: 'subscription keys missing' }, 400);
  }
  // What this phone wants per turn (owner: e.g. only orders, or only time
  // changes of an hour or more). Anything missing means the default.
  const prefs = {};
  for (const t of turns) {
    const p = (body.prefs && typeof body.prefs === 'object' && body.prefs[t]) || {};
    const time = Math.round(Number(p.time));
    prefs[t] = {
      lineup: p.lineup !== false, ordered: p.ordered !== false, onDuty: p.onDuty !== false,
      time: Number.isFinite(time) && time >= 0 && time <= 24 * 60 ? time : 30,
    };
  }
  await env.SITE.put(key, JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, turns, prefs, updated: new Date().toISOString() }),
    { httpMetadata: { contentType: 'application/json' } });
  return json({ ok: true, turns, prefs });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/push/subscribe') {
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
      return subscribe(request, env);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    let key;
    try {
      key = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch {
      return new Response('Bad address', { status: 400 });
    }
    if (key === '' || key.endsWith('/')) key += 'index.html';
    if (key.split('/').includes('..') || key.startsWith('subs/')) return new Response('Not found', { status: 404 });

    const head = await env.SITE.head(key);
    if (!head) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

    const headers = new Headers();
    head.writeHttpMetadata(headers);
    if (!headers.has('content-type')) headers.set('content-type', TYPES[key.split('.').pop().toLowerCase()] || 'application/octet-stream');
    // The page polls data/index.json for newer boards: always check back.
    headers.set('cache-control', 'no-cache');
    headers.set('etag', head.httpEtag);
    headers.set('x-robots-tag', 'noindex, nofollow');
    headers.set('x-content-type-options', 'nosniff');

    if (request.headers.get('if-none-match') === head.httpEtag) return new Response(null, { status: 304, headers });
    if (request.method === 'HEAD') return new Response(null, { headers });
    const obj = await env.SITE.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, { headers });
  },
};
