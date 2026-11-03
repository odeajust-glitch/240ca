// The line-up snapshot website on Cloudflare (owner, 2026-10-22). Serves the
// files the board checker uploads to the R2 bucket bound as SITE, and keeps
// phones' turn-alert subscriptions there (POST /push/subscribe), which the
// board checker reads to send the alerts. Subscriptions are never served.
// On a schedule (Settings → Triggers → Cron, every 10 min) it checks the
// board checker is still publishing and, if not for DOWN_MINUTES (default
// 30), alerts the owner's phone through ntfy (variable NTFY_TOPIC); again
// when it's back. Cloudflare Access (Settings → Domains & Routes → workers.dev →
// Enable Cloudflare Access) asks each visitor for an allowed email and a
// one-time code before a request reaches this code.
//
// Visitors (owner, 2026-11-01, option B): the page says "opened" once per
// visit (POST /stats/hit, { phone: true } the first time that phone opens it
// that day) and the Worker adds it to that day's two numbers in
// stats/YYYY-MM-DD.json (Toronto days). Nothing about who: no address, no
// phone id. GET /stats/days gives the last 30 days for Settings, to the
// owner only (OWNER_EMAIL, like /health below; owner, 2026-11-02).
//
// Health (owner, 2026-11-02: "can this be set up so only I see it"): GET
// /health gives the laptop's status/health.json plus this Worker's own
// "down" note, but only to the email Cloudflare Access signed in, when it's
// one in the OWNER_EMAIL variable (Settings → Variables; commas for more
// than one). Anyone else, or no OWNER_EMAIL: 404, and the page shows nothing.
// The email comes from Access's header or, failing that, its signed token
// (accessEmail). With the site open (no Access; owner, 2026-11-02: "leave
// the site open"), the owner's phone sends the OWNER_KEY variable's value
// instead (header x-owner-key; at least 16 characters). GET /whoami shows
// what the Worker sees, to check the setup (opened in the address bar it
// never has the key: only the page sends it).
//
// Down 3 h+ (owner, 2026-11-03): see watchChecker; needs the VAPID_KEYS secret.
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
// A turn (SR03; S501-CO / S501-EN where one number is two turns), or a
// followed person: '@' + the hash of their code (owner, 2026-10-25), never a name.
const TURN = /^([A-Z0-9]{2,6}(-(EN|CO))?|@[0-9a-f]{16})$/;
const MAX_TURNS = 12;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function subKey(endpoint) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return `subs/${[...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')}.json`;
}

// { subscription: { endpoint, keys: { p256dh, auth } }, turns: ["SR03"],
//   prefs: { SR03: { lineup, ordered, onDuty, aheadRest, aheadBack, reset, position, rescue, mayCall: true/false, time: minutes (0 = off), before: minutes before the call (0 = off) } } }.
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
  const turns = [...new Set((Array.isArray(body.turns) ? body.turns : []).map((t) => (String(t).startsWith('@') ? String(t).toLowerCase() : String(t).toUpperCase())))].filter((t) => TURN.test(t)).slice(0, MAX_TURNS);
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
      lineup: p.lineup !== false, ordered: p.ordered !== false, onDuty: p.onDuty !== false, aheadRest: p.aheadRest !== false, aheadBack: p.aheadBack !== false, reset: p.reset !== false, position: p.position !== false, rescue: p.rescue !== false, mayCall: p.mayCall !== false,
      // Off unless asked for (owner, 2026-11-02): a train past its call and not ordered.
      stale: p.stale === true,
      time: Number.isFinite(time) && time >= 0 && time <= 24 * 60 ? time : 30,
      before: [30, 45, 60, 90].includes(Number(p.before)) ? Number(p.before) : 0,
    };
  }
  await env.SITE.put(key, JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, turns, prefs, updated: new Date().toISOString() }),
    { httpMetadata: { contentType: 'application/json' } });
  return json({ ok: true, turns, prefs });
}

// The board checker is down when the site hasn't been published for a while
// (it publishes after every check). status/down.json remembers what was
// sent, so each message goes once: ntfy to the owner after DOWN_MINUTES
// (default 30) and "back" when it is; and (owner, 2026-11-03: "lets people
// know if the board tracker has been down for more than 3 hours") a phone
// alert to every phone with turn alerts after PUSH_DOWN_MINUTES (default
// 180), and "back" to them too, when the VAPID_KEYS secret is set (the
// laptop's BoardChecker\push-keys.json, pasted whole). The owner's own
// phones (owner, 2026-11-03: "a page notification like everyone gets at 3
// hours, but just to me") hear it after OWNER_DOWN_MINUTES (default 60): the
// phones following the OWNER_CODE person (default JUOD), as on the site.
// Each run also leaves status/watch.json, so Page Health shows the timer runs.
async function personHashOf(code) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`240ca-person:${String(code).toUpperCase()}`));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
async function watchChecker(env) {
  const idx = await env.SITE.get('data/index.json');
  if (!idx) return;
  let at;
  try { at = Date.parse((await idx.json()).generatedAt); } catch { return; }
  const mins = Math.round((Date.now() - at) / 60000);
  const limit = Number(env.DOWN_MINUTES) || 30;
  const pushLimit = Number(env.PUSH_DOWN_MINUTES) || 180;
  const ownerLimit = Number(env.OWNER_DOWN_MINUTES) || 60;
  const ownerTag = `@${await personHashOf(env.OWNER_CODE || 'JUOD')}`;
  const owners = (sub) => (sub.turns || []).includes(ownerTag);
  await env.SITE.put('status/watch.json', JSON.stringify({ at: Date.now(), mins, ntfy: !!env.NTFY_TOPIC, push: !!env.VAPID_KEYS }));
  const o = await env.SITE.get('status/down.json');
  let down = null;
  if (o) { try { down = JSON.parse(typeof o.text === 'function' ? await o.text() : o.body); } catch { down = {}; } }
  const when = new Date(at).toLocaleString('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', month: 'short', day: 'numeric' });
  const say = (title, body) => (env.NTFY_TOPIC ? fetch(`https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`, { method: 'POST', body, headers: { Title: title, Priority: 'high' } }) : null);
  const save = (d) => env.SITE.put('status/down.json', JSON.stringify(d));
  if (mins >= Math.min(limit, ownerLimit) && !down) {
    down = { since: at, alerted: null };
    await save(down);
  }
  if (down && !down.alerted && mins >= limit) {
    down.alerted = Date.now();
    await say('Board checker is down', `No board check since ${when} (${mins} min). The laptop may be off, stuck, or waiting for a Microsoft sign-in.`);
    await save(down);
  }
  if (down && mins >= ownerLimit && mins < pushLimit && !down.ownerPushed && env.VAPID_KEYS) {
    down.ownerPushed = Date.now();
    await save(down);
    down.ownerPhones = await pushAll(env, { title: 'Board checker down', body: `No board check since ${when} (${Math.floor(mins / 60)} h). The laptop may be off, stuck, or waiting for a Microsoft sign-in.`, tag: 'board-down', url: './#current' }, { only: owners });
    await save(down);
  }
  if (down && mins >= pushLimit && !down.pushed && env.VAPID_KEYS) {
    const h = Math.floor(mins / 60);
    // Marked first: a run cut short never sends it twice.
    down.pushed = Date.now();
    await save(down);
    down.phones = await pushAll(env, { title: 'Board checker down', body: `No board check since ${when} (${h} h). The board and turn alerts are out of date; check CATS yourself.`, tag: 'board-down', url: './#current' });
    await save(down);
  }
  if (mins < Math.min(limit, ownerLimit) && down) {
    if (down.alerted) await say('Board checker is back', `Checking again (last check ${when}).`);
    const back = { title: 'Board checker back', body: `Checking CATS again (last check ${when}). Turn alerts are back on.`, tag: 'board-down', url: './#current' };
    if (down.pushed && env.VAPID_KEYS) await pushAll(env, back);
    else if (down.ownerPushed && env.VAPID_KEYS) await pushAll(env, back, { only: owners });
    await env.SITE.delete('status/down.json');
  }
}

// Web push from the Worker (RFC 8291 aes128gcm + RFC 8292 VAPID), the same
// messages the laptop's lib/board/webpush.js sends, with WebCrypto. Only
// real push services (PUSH_HOSTS). One sender key per run (each message
// still has its own salt); one VAPID signature per push service.
const ub64 = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));
const b64 = (u8) => btoa(String.fromCharCode(...new Uint8Array(u8))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const cat = (...parts) => { const n = parts.reduce((a, p) => a + p.length, 0); const out = new Uint8Array(n); let i = 0; for (const p of parts) { out.set(p, i); i += p.length; } return out; };
const utf8 = (t) => new TextEncoder().encode(t);
async function hmac256(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
async function encryptPush(payload, sub, sender) {
  const ua = ub64(sub.keys.p256dh);
  const auth = ub64(sub.keys.auth);
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, sender.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hmac256(await hmac256(auth, secret), cat(utf8('WebPush: info\0'), ua, sender.publicRaw, new Uint8Array([1])));
  const prk = await hmac256(salt, ikm);
  const cek = (await hmac256(prk, cat(utf8('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac256(prk, cat(utf8('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(utf8(payload), new Uint8Array([2]))));
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = sender.publicRaw.length;
  return cat(header, sender.publicRaw, sealed);
}
async function vapidFor(endpoint, keys, signer, cache, subject) {
  const aud = new URL(endpoint).origin;
  if (cache.has(aud)) return cache.get(aud);
  const head = b64(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64(utf8(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer, utf8(`${head}.${claims}`));
  const v = `vapid t=${head}.${claims}.${b64(sig)}, k=${keys.publicKey}`;
  cache.set(aud, v);
  return v;
}
// Every phone with turn alerts (subs/), one message each. → { sent, failed, dropped }.
async function pushAll(env, message, { fetchImpl = fetch, only = null } = {}) {
  const out = { sent: 0, failed: 0, dropped: 0 };
  let keys;
  try { keys = JSON.parse(env.VAPID_KEYS); } catch { return { ...out, error: 'VAPID_KEYS is not the push-keys.json text' }; }
  if (!keys || !keys.publicKey || !keys.privateJwk) return { ...out, error: 'VAPID_KEYS has no publicKey / privateJwk' };
  const { d, x, y } = keys.privateJwk;
  const signer = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d, x, y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const sender = { privateKey: pair.privateKey, publicRaw: new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)) };
  const subject = env.SITE_URL || 'https://board.sarniaboard.workers.dev';
  const cache = new Map();
  let cursor;
  do {
    const page = await env.SITE.list({ prefix: 'subs/', cursor });
    for (const obj of page.objects || []) {
      try {
        const g = await env.SITE.get(obj.key);
        if (!g) continue;
        const sub = JSON.parse(typeof g.text === 'function' ? await g.text() : g.body);
        let host = '';
        try { host = new URL(sub.endpoint).hostname; } catch { /* checked below */ }
        if (!PUSH_HOSTS.some((re) => re.test(host)) || !sub.keys || (only && !only(sub))) continue;
        const res = await fetchImpl(sub.endpoint, {
          method: 'POST',
          headers: { 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(6 * 3600), urgency: 'high',
            authorization: await vapidFor(sub.endpoint, keys, signer, cache, subject) },
          body: await encryptPush(JSON.stringify(message), sub, sender),
        });
        if (res.status === 404 || res.status === 410) { await env.SITE.delete(obj.key); out.dropped++; } else if (res.ok) out.sent++; else out.failed++;
      } catch { out.failed++; }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

const torontoDay = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
const STATS_DAYS = 30;

async function readDay(env, day) {
  const o = await env.SITE.get(`stats/${day}.json`);
  if (!o) return { opens: 0, phones: 0 };
  try { const d = JSON.parse(typeof o.text === 'function' ? await o.text() : o.body); return { opens: +d.opens || 0, phones: +d.phones || 0 }; } catch { return { opens: 0, phones: 0 }; }
}

// Two visits at the same moment can lose one count (no locking): fine for a
// rough daily number.
async function statsHit(request, env) {
  const text = await request.text();
  if (text.length > 200) return json({ error: 'too big' }, 413);
  let body = {};
  try { body = JSON.parse(text || '{}'); } catch { return json({ error: 'not JSON' }, 400); }
  const day = torontoDay(Date.now());
  const d = await readDay(env, day);
  d.opens += 1;
  if (body && body.phone === true) d.phones += 1;
  await env.SITE.put(`stats/${day}.json`, JSON.stringify(d), { httpMetadata: { contentType: 'application/json' } });
  return json({ ok: true });
}

async function statsDays(env) {
  const now = Date.now();
  const days = [];
  for (let i = 0; i < STATS_DAYS; i++) days.push(torontoDay(now - i * 864e5));
  const counts = await Promise.all([...new Set(days)].map(async (day) => ({ day, ...(await readDay(env, day)) })));
  return json({ days: counts });
}

// Who's looking, as Cloudflare Access signed them in: its email header, or
// else its sign-in token (the Cf-Access-Jwt-Assertion header or the
// CF_Authorization cookie), whose signature is checked against Access's own
// keys so it can't be made up. → { email, via } (email null if unknown).
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function accessEmail(request) {
  const header = (request.headers.get('cf-access-authenticated-user-email') || '').trim().toLowerCase();
  if (header) return { email: header, via: 'header' };
  let jwt = request.headers.get('cf-access-jwt-assertion');
  if (!jwt) { const m = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(request.headers.get('cookie') || ''); jwt = m && m[1]; }
  if (!jwt) return { email: null, via: 'no sign-in token' };
  try {
    const [h64, p64, s64] = jwt.split('.');
    const dec = (x) => JSON.parse(new TextDecoder().decode(b64u(x)));
    const head = dec(h64);
    const claims = dec(p64);
    if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(claims.iss || '')) return { email: null, via: 'token not from Access' };
    if (!(claims.exp * 1000 > Date.now())) return { email: null, via: 'token expired' };
    const certs = await (await fetch(`${claims.iss}/cdn-cgi/access/certs`)).json();
    const jwk = (certs.keys || []).find((k) => k.kid === head.kid);
    if (!jwk) return { email: null, via: 'token key not found' };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s64), new TextEncoder().encode(`${h64}.${p64}`));
    if (!ok || !claims.email) return { email: null, via: 'token not valid' };
    return { email: String(claims.email).trim().toLowerCase(), via: 'token' };
  } catch (err) {
    return { email: null, via: `token unreadable (${err.message})` };
  }
}

const owners = (env) => String(env.OWNER_EMAIL || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
// The owner key, compared without giving away how much of it matched.
function keyMatches(request, env) {
  const want = String(env.OWNER_KEY || '');
  const got = String(request.headers.get('x-owner-key') || '');
  if (want.length < 16 || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
async function isOwner(request, env) {
  if (keyMatches(request, env)) return true;
  const { email } = await accessEmail(request);
  return !!email && owners(env).includes(email);
}

// What the Worker sees of the person asking (owner, 2026-11-02: the health
// line didn't show): their own email, and whether OWNER_EMAIL is set.
async function whoami(request, env) {
  const { email, via } = await accessEmail(request);
  return json({ email, via, ownerEmailSet: owners(env).length > 0, ownerKeySet: String(env.OWNER_KEY || '').length >= 16, ownerKey: keyMatches(request, env), owner: await isOwner(request, env) });
}

async function healthFor(request, env) {
  if (!(await isOwner(request, env))) return json({ error: 'not found' }, 404);
  const read = async (k) => { const o = await env.SITE.get(k); if (!o) return null; try { return JSON.parse(typeof o.text === 'function' ? await o.text() : o.body); } catch { return null; } };
  const [laptop, down, watch] = await Promise.all([read('status/health.json'), read('status/down.json'), read('status/watch.json')]);
  return json({ laptop, down, watch });
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(watchChecker(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/stats/hit') {
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
      return statsHit(request, env);
    }
    if (url.pathname === '/stats/days') return (await isOwner(request, env)) ? statsDays(env) : json({ error: 'not found' }, 404);
    if (url.pathname === '/whoami') return whoami(request, env);
    if (url.pathname === '/health') return healthFor(request, env);
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
    if (key.split('/').includes('..') || key.startsWith('subs/') || key.startsWith('status/') || key.startsWith('stats/') || key.startsWith('backups/')) return new Response('Not found', { status: 404 });

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
