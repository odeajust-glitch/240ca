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
// RailroadTracker relay (owner, 2026-11-03: moved off Render): the laptop
// POSTs each check to /api/board, the app GETs /api/board/latest, both with
// "Authorization: Bearer <BOARD_KEY>" (a Worker secret, the laptop's
// BOARD_KEY). Only the newest check is kept (R2 relay/board-latest.json),
// never served as a file. Without BOARD_KEY both answer 404, as on Render.
//
// Agreement search (owner, 2026-11-03: moved off Render): POST /api/ask
// streams an answer (NDJSON, as server.js did) from the passages the search
// finds in R2 search/ (built and uploaded by scripts/search-upload.js on the
// laptop) and Moonshot's Kimi (secret KIMI_API_KEY; KIMI_MODEL_FAST /
// KIMI_MODEL_SLOW variables, else kimi-k2.6 / kimi-k3). Deeper answers
// (owner, 2026-11-04: "Kimi first, Opus on demand"; his own questions "just
// with Opus") come from Claude (secret ANTHROPIC_API_KEY): members' deeper
// searches from Sonnet (owner, 2026-11-04: "a cheaper anthropic model";
// CLAUDE_MODEL_DEEP variable, else claude-sonnet-5-5), the owner's from Opus
// (CLAUDE_MODEL, else claude-opus-5-5); Kimi's slow model if that key is
// missing or Claude fails before answering. The owner picks the three
// models on Page Health (owner, 2026-11-04: "so I can change the model the
// search uses myself"): GET/POST /health/models, kept in R2
// ask/models.json; a saved choice beats the variables. GET /health/spend:
// Kimi's live balance and what the site's Claude answers cost (R2
// ask/spend/). GET /health/questions[?day=]: the questions and answers kept
// 60 days for review (R2 ask/log/). GET /api/sources,
// /api/status, /api/stats?key=… (STATS_KEY, else OWNER_KEY). The PDFs are
// R2 docs/<id>.pdf, served like any file. 10 questions per 5 minutes each.
//
// Setup: docs/board-checker/CLOUDFLARE.md. Paste this whole file into the
// Worker's editor in the Cloudflare dashboard.

const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json',
  txt: 'text/plain; charset=utf-8', png: 'image/png', css: 'text/css; charset=utf-8',
  odt: 'application/vnd.oasis.opendocument.text', webmanifest: 'application/manifest+json',
  pdf: 'application/pdf', mjs: 'text/javascript; charset=utf-8',
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

// --- RailroadTracker relay (same checks as lib/board/relay.js on Render) ---
const RELAY_KEY = 'relay/board-latest.json';
const MAX_REPORT_CHARS = 20000;
const MAX_LINES = 200;
const RELAY_STATES = ['linedUp', 'waiting', 'comingHome', 'notFound'];
const isLines = (v) => Array.isArray(v) && v.length <= MAX_LINES && v.every((l) => typeof l === 'string' && l.length <= 500);
const isShort = (v) => typeof v === 'string' && v.length <= 40;
const isLocalTime = (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v);
function validateMine(m) {
  if (m == null) return { mine: null };
  if (typeof m !== 'object' || !isShort(m.turn) || !RELAY_STATES.includes(m.state)) return { error: 'mine must have a turn and a known state.' };
  const out = { turn: m.turn, state: m.state };
  if (m.state === 'linedUp') {
    if (!isShort(m.train) || !isShort(m.status) || !isLocalTime(m.callAt) || !isLocalTime(m.onDutyAt)) return { error: 'mine: a lined-up turn needs train, status, callAt and onDutyAt.' };
    Object.assign(out, { train: m.train, status: m.status, deadhead: !!m.deadhead, callAt: m.callAt, onDutyAt: m.onDutyAt });
  } else if (m.state === 'comingHome') {
    if (!isShort(m.train)) return { error: 'mine: coming home needs the train.' };
    out.train = m.train;
  } else if (m.state === 'waiting') {
    if (!Array.isArray(m.ahead) || m.ahead.length > MAX_LINES || !m.ahead.every(isShort)) return { error: 'mine.ahead must be a list of turns.' };
    if (m.myRestUntil != null && !isLocalTime(m.myRestUntil)) return { error: 'mine.myRestUntil must be a local time.' };
    Object.assign(out, { ahead: m.ahead, myRestUntil: m.myRestUntil ?? null });
  }
  return { mine: out };
}
function validateCheck(body) {
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object.' };
  const { checkedAt, me, report, changes, myAnswerChanged } = body;
  if (typeof checkedAt !== 'string' || Number.isNaN(Date.parse(checkedAt))) return { error: 'checkedAt must be an ISO time.' };
  if (!isLines(me)) return { error: 'me must be a list of lines.' };
  if (typeof report !== 'string' || report.length > MAX_REPORT_CHARS) return { error: 'report must be text.' };
  if (changes != null && !isLines(changes)) return { error: 'changes must be a list of lines.' };
  const { mine, error } = validateMine(body.mine);
  if (error) return { error };
  return { check: { checkedAt: new Date(checkedAt).toISOString(), me, report, changes: changes || [], myAnswerChanged: !!myAnswerChanged, mine } };
}
// The bearer key, compared without giving away how much of it matched.
function bearerMatches(request, want) {
  want = String(want || '');
  const m = /^Bearer (.+)$/.exec(request.headers.get('authorization') || '');
  const got = m ? m[1] : '';
  if (!want || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
async function relay(request, env, url) {
  if (!bearerMatches(request, env.BOARD_KEY)) return json({ error: 'Not found.' }, 404);
  if (url.pathname === '/api/board/latest') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'GET only' }, 405);
    const o = await env.SITE.get(RELAY_KEY);
    if (!o) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
    return new Response(typeof o.text === 'function' ? await o.text() : o.body, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const text = await request.text();
  if (text.length > 100000) return json({ error: 'too big' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'Body must be a JSON object.' }, 400); }
  const { check, error } = validateCheck(body);
  if (error) return json({ error }, 400);
  // An older check arriving late (laptop retry) mustn't replace a newer one.
  const o = await env.SITE.get(RELAY_KEY);
  let latest = null;
  if (o) { try { latest = JSON.parse(typeof o.text === 'function' ? await o.text() : o.body); } catch { latest = null; } }
  if (latest && Date.parse(latest.checkedAt) > Date.parse(check.checkedAt)) return json({ ok: true, checkedAt: latest.checkedAt });
  const saved = { ...check, receivedAt: new Date().toISOString() };
  await env.SITE.put(RELAY_KEY, JSON.stringify(saved), { httpMetadata: { contentType: 'application/json' } });
  return json({ ok: true, checkedAt: saved.checkedAt });
}

// --- Agreement search (same tokenizer and BM25 as lib/search.js) ---
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'be', 'was',
  'were', 'will', 'shall', 'with', 'as', 'by', 'at', 'from', 'that', 'this', 'it', 'its',
  'if', 'not', 'no', 'than', 'then', 'do', 'does', 'did', 'i', 'you', 'he', 'she',
  'they', 'we', 'what', 'when', 'where', 'why', 'how', 'can', 'could', 'would', 'should']);
const compoundArticleRefs = (text) => text.replace(/\b(article|art\.?|paragraph|para\.?|section|sec\.?)\s+(\d+(?:\.\d+)*)/gi, (_, word, num) => `article${num.replace(/\./g, '_')}`);
function foldPlural(t) {
  if (/\d/.test(t)) return t;
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}
const tokenize = (text) => (compoundArticleRefs(text).toLowerCase().match(/[a-z0-9_.]+/g) || []).filter((t) => t.length > 1 && !STOPWORDS.has(t)).map(foldPlural);
function bucketOf(term, buckets) {
  let h = 0x811c9dc5;
  for (let i = 0; i < term.length; i++) { h ^= term.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % buckets;
}
// Kept while the Worker stays warm; a new meta key (an upload) starts over.
const searchCache = { key: null, meta: null, files: new Map() };
async function searchFile(env, key) {
  if (searchCache.files.has(key)) return searchCache.files.get(key);
  const o = await env.SITE.get(key);
  const v = o ? JSON.parse(typeof o.text === 'function' ? await o.text() : o.body) : null;
  if (searchCache.files.size > 400) searchCache.files.clear();
  searchCache.files.set(key, v);
  return v;
}
async function searchMeta(env) {
  const o = await env.SITE.get('search/meta.json');
  if (!o) return null;
  const text = typeof o.text === 'function' ? await o.text() : o.body;
  const key = (/"key":"([0-9a-f]+)"/.exec(text) || [])[1];
  if (key && key === searchCache.key) return searchCache.meta;
  Object.assign(searchCache, { key, meta: JSON.parse(text), files: new Map() });
  return searchCache.meta;
}
const K1 = 1.5;
const B = 0.75;
async function searchShards(env, query, { topK = 8, sources = null, dateFrom = null, dateTo = null } = {}) {
  const meta = await searchMeta(env);
  if (!meta) return null;
  const q = tokenize(query);
  if (!q.length) return [];
  const freq = new Map();
  for (const t of q) freq.set(t, (freq.get(t) || 0) + 1);
  // Own keys only: "constructor" is a word, not Object's.
  const lists = await Promise.all([...freq.keys()].map(async (t) => { const b = (await searchFile(env, `search/t/${bucketOf(t, meta.buckets)}.json`)) || {}; return [t, Object.prototype.hasOwnProperty.call(b, t) ? b[t] : null]; }));
  const scores = new Map();
  for (const [t, list] of lists) {
    if (!list) continue;
    const qtf = freq.get(t);
    const df = list.length / 2;
    const idf = Math.log(1 + (meta.N - df + 0.5) / (df + 0.5));
    for (let p = 0; p < list.length; p += 2) {
      const d = list[p];
      const tf = list[p + 1];
      const denom = tf + K1 * (1 - B + B * (meta.docs[d][4] / meta.avgLength));
      scores.set(d, (scores.get(d) || 0) + qtf * idf * ((tf * (K1 + 1)) / denom));
    }
  }
  const results = [];
  for (const [d, score] of scores) {
    if (score <= 0) continue;
    const [source, , date] = meta.docs[d];
    if (sources && !sources.includes(source)) continue;
    if (date) {
      if (dateFrom && date < dateFrom) continue;
      if (dateTo && date > dateTo) continue;
    }
    results.push({ d, score });
  }
  // Ties keep the index's order, as the Map-based sort on Render did.
  results.sort((a, b) => b.score - a.score);
  return Promise.all(results.slice(0, topK).map(async ({ d }) => {
    const [source, page, date, url] = meta.docs[d];
    const texts = await searchFile(env, `search/c/${Math.floor(d / meta.perFile)}.json`);
    return { source, page, date, url, text: (texts || [])[d % meta.perFile] || '' };
  }));
}

// Kimi (lib/kimi.js on Render): streams the answer, retries a 429 / 5xx
// before the first token, 120 s cap per call.
const NOT_FOUND_PATTERN = /could not find/i;
const KIMI_API_URL = 'https://api.moonshot.ai/v1/chat/completions';
function kimiMessages(question, chunks, names) {
  const context = chunks.map((c, i) => `[${i + 1}] (${names[c.source] || c.source}, ${/^\d+$/.test(String(c.page)) ? `page ${c.page}` : c.page})\n${c.text}`).join('\n\n');
  const system = 'You are a search assistant for TCRC Division 240 railroad workers. '
    + 'Answer the question using ONLY the excerpts provided below, which come from '
    + 'the official Conductors and Locomotive Engineers collective agreements, and the '
    + 'Transport Canada Duty and Rest Period Rules for Railway Operating Employees, the Conductors '
    + 'Agreement addenda, the TCRC Sarnia Crew Calling Manual, and the Engineer Mileage Committee '
    + 'Operating Guidelines. '
    + 'If an excerpt comes from Agreement 4.3 or Agreement 1.2, note that those govern Western Canada, '
    + 'not Division 240, which works under Agreements 4.16 (conductors) and 1.1 (locomotive engineers). '
    + 'Always cite the source document and page number for every claim, using the '
    + 'bracketed excerpt numbers (e.g. "[2]"). '
    + 'If the excerpts do not contain the answer, say plainly that you could not find '
    + 'it in the agreement excerpts provided — do not guess, and do not use outside knowledge. '
    + 'This is not legal advice; tell the user to confirm with their Local Chairperson for anything that affects a grievance.';
  return [{ role: 'system', content: system }, { role: 'user', content: `Excerpts:\n\n${context}\n\nQuestion: ${question}` }];
}
async function streamKimi(env, { question, chunks, names, model, fast, onToken, signal, fetchImpl = fetch }) {
  if (!env.KIMI_API_KEY) throw new Error('KIMI_API_KEY is not set on the Worker.');
  const body = JSON.stringify({ model, messages: kimiMessages(question, chunks, names), stream: true,
    // Thinking stays on (owner, 2026-11-04: Kimi K3.1 Pro with thinking off
    // wrote its reasoning into the answer). Kimi then sends its reasoning
    // as reasoning_content, which is never shown; only content is.
    ...(/^kimi-k/.test(model) ? {} : { temperature: 0.2 }) });
  let res;
  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(120000);
    try {
      res = await fetchImpl(KIMI_API_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.KIMI_API_KEY}` }, body,
        signal: signal && AbortSignal.any ? AbortSignal.any([signal, timeout]) : timeout });
    } catch (err) {
      if (timeout.aborted && !(signal && signal.aborted)) throw new Error('The answer service did not respond within 120 seconds. Please try again.');
      throw err;
    }
    if (res.ok) break;
    const text = await res.text();
    if (!(res.status === 429 || res.status >= 500) || attempt === 3) throw new Error(`Kimi API error ${res.status}: ${text}`);
    const advised = Number(res.headers.get('retry-after')) || Number((/try again after (\d+) seconds?/i.exec(text) || [])[1]) || 0;
    await new Promise((r) => setTimeout(r, Math.min(advised ? advised * 1000 : 1000 * 2 ** attempt, 8000) * (0.5 + Math.random() / 2)));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let usage = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const obj = JSON.parse(payload);
        const u = obj.usage || obj.choices?.[0]?.usage;
        if (u) usage = u;
        const delta = obj.choices?.[0]?.delta?.content;
        if (delta) { full += delta; await onToken(delta); }
      } catch (err) { if (err && err.name === 'AbortError') throw err; /* a partial line */ }
    }
  }
  await recordSpend(env, model, usage).catch((err) => console.log(`usage not kept: ${err.message}`));
  return full;
}

// Claude (owner, 2026-11-04, after comparing models in tools/ca-model-compare:
// "I like opus answers"): the same instructions and excerpts as Kimi. Streams
// text_delta events; retries a 429 / 5xx / 529 before the first token.
// fallbacks "default": if Opus declines a question, Anthropic answers it
// with another Claude model in the same call.
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
async function streamClaude(env, { question, chunks, names, model, onToken, signal, fetchImpl = fetch }) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set on the Worker.');
  const [sys, user] = kimiMessages(question, chunks, names);
  // The refusal fallback (another Claude model answers if this one declines)
  // is a newer option: if Anthropic refuses the request (400), it's asked
  // again without it (owner, 2026-11-04: his first Opus question fell back
  // to Kimi).
  let plain = false;
  const bodyOf = () => JSON.stringify({ model, max_tokens: 8000, stream: true, system: sys.content,
    messages: [{ role: 'user', content: user.content }], output_config: { effort: 'medium' }, ...(plain ? {} : { fallbacks: 'default' }) });
  let res;
  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(120000);
    const headers = { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', ...(plain ? {} : { 'anthropic-beta': 'server-side-fallback-2026-07-01' }) };
    try {
      res = await fetchImpl(CLAUDE_API_URL, { method: 'POST', body: bodyOf(), headers,
        signal: signal && AbortSignal.any ? AbortSignal.any([signal, timeout]) : timeout });
    } catch (err) {
      if (timeout.aborted && !(signal && signal.aborted)) throw new Error('Claude did not respond within 120 seconds.');
      throw err;
    }
    if (res.ok) break;
    const text = await res.text();
    if (res.status === 400 && !plain) { console.log(`Claude 400, asking again without fallbacks: ${text.slice(0, 300)}`); plain = true; continue; }
    if (!(res.status === 429 || res.status >= 500) || attempt === 3) throw new Error(`Claude API error ${res.status}: ${text.slice(0, 300)}`);
    const advised = Number(res.headers.get('retry-after')) || 0;
    await new Promise((r) => setTimeout(r, Math.min(advised ? advised * 1000 : 1000 * 2 ** attempt, 8000) * (0.5 + Math.random() / 2)));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  const usage = {};
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      let e;
      try { e = JSON.parse(t.slice(5).trim()); } catch { continue; /* a partial line */ }
      if (e.type === 'message_start' && e.message && e.message.usage) Object.assign(usage, e.message.usage);
      if (e.type === 'message_delta' && e.usage) Object.assign(usage, e.usage);
      if (e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta' && e.delta.text) { full += e.delta.text; await onToken(e.delta.text); }
      else if (e.type === 'message_delta' && e.delta && e.delta.stop_reason === 'refusal' && !full) throw new Error('Claude declined this question.');
      else if (e.type === 'error') throw new Error(`Claude error: ${(e.error && e.error.message) || 'unknown'}`);
    }
  }
  await recordSpend(env, model, usage).catch((err) => console.log(`spend not kept: ${err.message}`));
  return full;
}
// The models the search can use, chosen on Page Health (owner only).
const MODEL_CHOICES = [
  { id: 'claude-opus-5-5', label: 'Claude Opus', cost: 'about 5–10¢' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet', cost: 'about 3–5¢' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku', cost: 'well under 1¢' },
  { id: 'kimi-k2.6', label: 'Kimi K2.6 (quick)', cost: 'under 1¢' },
  { id: 'kimi-k3.1-pro', label: 'Kimi K3.1 Pro (newest)', cost: 'about 3–5¢' },
  { id: 'kimi-k3', label: 'Kimi K3 (careful)', cost: 'about 5–6¢' },
];
const MODEL_ROLES = { owner: 'Your questions', first: "Members' first answer", deep: "Members' deeper search" };
const MODELS_KEY = 'ask/models.json';
function modelDefaults(env) {
  return { owner: env.CLAUDE_MODEL || 'claude-opus-5-5', first: env.KIMI_MODEL_FAST || 'kimi-k2.6', deep: env.CLAUDE_MODEL_DEEP || 'claude-sonnet-5-5' };
}
// Saved choices (Page Health) over the variables over the defaults.
async function searchModels(env) {
  const saved = (await readJson(env, MODELS_KEY)) || {};
  const out = modelDefaults(env);
  for (const role of Object.keys(MODEL_ROLES)) if (MODEL_CHOICES.some((c) => c.id === saved[role])) out[role] = saved[role];
  return out;
}
async function modelsApi(request, env) {
  if (!(await isOwner(request, env))) return json({ error: 'not found' }, 404);
  if (request.method === 'POST') {
    let body;
    try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Bad request' }, 400); }
    const saved = (await readJson(env, MODELS_KEY)) || {};
    for (const role of Object.keys(MODEL_ROLES)) {
      if (body[role] == null) continue;
      if (body[role] === 'default') delete saved[role];
      else if (MODEL_CHOICES.some((c) => c.id === body[role])) saved[role] = body[role];
      else return json({ error: `Unknown model for ${MODEL_ROLES[role]}` }, 400);
    }
    saved.at = Date.now();
    await env.SITE.put(MODELS_KEY, JSON.stringify(saved));
  }
  return json({ roles: MODEL_ROLES, choices: MODEL_CHOICES, current: await searchModels(env), defaults: modelDefaults(env), anthropicKey: !!env.ANTHROPIC_API_KEY, kimiKey: !!env.KIMI_API_KEY });
}
const modelLabel = (model) => { const c = MODEL_CHOICES.find((x) => x.id === model); if (c) return c.label.replace(/ \(.*\)$/, ''); if (/^claude-/.test(model)) return claudeLabel(model); return 'Kimi'; };
// One answer from the chosen model. A Claude model that fails before
// writing anything (no key, an error) hands over to Kimi (the quick one for
// a first answer, the careful one for a deeper answer).
const claudeLabel = (model) => { const m = /(opus|sonnet|haiku|fable)/i.exec(model); return m ? `Claude ${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}` : 'Claude'; };
async function streamModel(env, model, { question, chunks, names, onToken, signal, fetchImpl, send, fast }) {
  if (/^claude-/.test(model) && env.ANTHROPIC_API_KEY) {
    let wrote = false;
    try {
      await send({ type: 'model', label: modelLabel(model), model });
      return await streamClaude(env, { question, chunks, names, model, signal, fetchImpl,
        onToken: (t) => { wrote = true; return onToken(t); } });
    } catch (err) {
      if (wrote || (signal && signal.aborted)) throw err;
      console.log(`Claude failed, Kimi instead: ${err.message}`);
      await send({ type: 'fallback', from: modelLabel(model), reason: err.message });
    }
  }
  // Kimi K2.6 (thinking off) is the stand-in: the one the quick answers use.
  const kimi = /^claude-/.test(model) ? 'kimi-k2.6' : model;
  let wrote = false;
  try {
    await send({ type: 'model', label: modelLabel(kimi), model: kimi });
    return await streamKimi(env, { question, chunks, names, model: kimi, fast, signal, fetchImpl, onToken: (t) => { wrote = true; return onToken(t); } });
  } catch (err) {
    if (wrote || kimi === 'kimi-k2.6' || (signal && signal.aborted)) throw err;
    console.log(`${kimi} failed, Kimi K2.6 instead: ${err.message}`);
    await send({ type: 'fallback', from: modelLabel(kimi), reason: err.message });
    await send({ type: 'model', label: modelLabel('kimi-k2.6'), model: 'kimi-k2.6' });
    return streamKimi(env, { question, chunks, names, model: 'kimi-k2.6', fast, onToken, signal, fetchImpl });
  }
}

// What the site's own Claude answers cost (owner, 2026-11-04: "the api
// balances in the page health section"). Anthropic has no balance lookup
// for a normal key, so each answer's tokens are priced here (list prices,
// USD per 1M tokens) and added up per month in R2 ask/spend/YYYY-MM.json.
// Kimi answers are counted the same way (usage history, owner 2026-11-04:
// "so I can see how much is being used with questions"), priced when
// Moonshot sends the token counts with the answer.
const MODEL_PRICES = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'kimi-k2.6': { input: 0.95, output: 4 },
  'kimi-k3.1-pro': { input: 2, output: 10 },
  'kimi-k3': { input: 3, output: 15 },
};
// Anthropic's usage (input_tokens / output_tokens) or Moonshot's
// (prompt_tokens / completion_tokens).
function answerCost(model, u) {
  const p = MODEL_PRICES[model];
  if (!p || !u) return null;
  const inTok = u.prompt_tokens != null ? u.prompt_tokens
    : (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) * 0.1 + (u.cache_creation_input_tokens || 0) * 1.25;
  const outTok = u.completion_tokens != null ? u.completion_tokens : u.output_tokens || 0;
  if (!inTok && !outTok) return null;
  return (inTok * p.input + outTok * p.output) / 1e6;
}
async function recordSpend(env, model, usage, now = Date.now()) {
  const day = torontoDay(now);
  const key = `ask/spend/${day.slice(0, 7)}.json`;
  const was = (await readJson(env, key)) || { days: {} };
  const d = was.days[day] || (was.days[day] = {});
  const m = d[model] || (d[model] = { n: 0, cost: 0 });
  const cost = answerCost(model, usage);
  m.n += 1;
  if (cost == null) m.unpriced = (m.unpriced || 0) + 1; else m.cost += cost;
  await env.SITE.put(key, JSON.stringify(was));
}
// Kimi's balance, live from Moonshot with the Worker's Kimi key.
async function kimiBalance(env, fetchImpl = fetch) {
  if (!env.KIMI_API_KEY) return { error: 'KIMI_API_KEY is not set' };
  try {
    const r = await fetchImpl('https://api.moonshot.ai/v1/users/me/balance', { headers: { authorization: `Bearer ${env.KIMI_API_KEY}` }, signal: AbortSignal.timeout(10000) });
    const d = await r.json().catch(() => ({}));
    const b = d && d.data;
    if (!r.ok || !b || b.available_balance == null) return { error: `Moonshot answered ${r.status}` };
    return { available: +b.available_balance, voucher: +(b.voucher_balance || 0), cash: +(b.cash_balance || 0) };
  } catch (err) { return { error: err.message }; }
}
const HISTORY_DAYS = 30;
async function spendApi(request, env, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!(await isOwner(request, env))) return json({ error: 'not found' }, 404);
  const day = torontoDay(now);
  const days = [];
  for (let i = 0; i < HISTORY_DAYS; i++) days.push(torontoDay(now - i * 86400000));
  const months = {};
  for (const m of new Set(days.map((d) => d.slice(0, 7)))) months[m] = ((await readJson(env, `ask/spend/${m}.json`)) || { days: {} }).days;
  const answersOf = (d) => months[d.slice(0, 7)][d] || {};
  const claudeOnly = (o) => Object.fromEntries(Object.entries(o).filter(([m]) => /^claude-/.test(m)));
  const sum = (list) => {
    const out = { cost: 0, n: 0, models: {} };
    for (const d of list) for (const [model, m] of Object.entries(d || {})) {
      const o = out.models[model] || (out.models[model] = { label: modelLabel(model), cost: 0, n: 0 });
      o.cost += m.cost; o.n += m.n; out.cost += m.cost; out.n += m.n;
    }
    return out;
  };
  const thisMonth = Object.values(months[day.slice(0, 7)] || {});
  // Per day, newest first: questions asked, different people, answers by model.
  const history = [];
  for (const d of days) {
    const q = (await readJson(env, `ask/stats/${d}.json`)) || { questions: 0, visitors: [] };
    const a = sum([answersOf(d)]);
    if (!q.questions && !a.n) continue;
    history.push({ day: d, questions: q.questions || 0, people: (q.visitors || []).length, cost: a.cost,
      models: Object.values(a.models).map((m) => ({ label: m.label, n: m.n, cost: m.cost })) });
  }
  return json({ month: day.slice(0, 7),
    claude: { today: sum([claudeOnly(answersOf(day))]), month: sum(thisMonth.map(claudeOnly)) },
    all: { today: sum([answersOf(day)]), month: sum(thisMonth) },
    history, kimi: await kimiBalance(env, fetchImpl), anthropicKey: !!env.ANTHROPIC_API_KEY });
}

// Questions and answers kept for review (owner, 2026-11-04: "record what
// questions are being asked and what answers are being given, so I can
// review them and change the model"). Owner chose: members are told on the
// Agreements tab, kept 60 days, members' and his own (marked). No address,
// no name: only the question as typed, the documents searched and the ones
// the passages came from, and each answer with the model that wrote it. R2 ask/log/YYYY-MM-DD.json, one file a day.
const ASK_LOG_DAYS = 60;
async function askLog(env, entry, now = Date.now()) {
  if (!entry.question || !entry.answers.some((a) => a.text)) return;
  const key = `ask/log/${torontoDay(now)}.json`;
  const day = (await readJson(env, key)) || { entries: [] };
  day.entries.push({ at: now, ...entry });
  await env.SITE.put(key, JSON.stringify(day));
}
// Days past 60 are deleted by the 10-minute timer (a few days back, so a
// missed day still goes).
async function pruneAskLog(env, now = Date.now()) {
  for (let i = ASK_LOG_DAYS + 1; i <= ASK_LOG_DAYS + 7; i++) await env.SITE.delete(`ask/log/${torontoDay(now - i * 86400000)}.json`);
}
async function questionsApi(request, env, now = Date.now()) {
  if (!(await isOwner(request, env))) return json({ error: 'not found' }, 404);
  const want = new URL(request.url).searchParams.get('day');
  if (want) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(want)) return json({ error: 'Bad day' }, 400);
    return json({ day: want, entries: ((await readJson(env, `ask/log/${want}.json`)) || { entries: [] }).entries });
  }
  const days = [];
  for (let i = 0; i < ASK_LOG_DAYS; i++) {
    const d = torontoDay(now - i * 86400000);
    const f = await readJson(env, `ask/log/${d}.json`);
    if (f && f.entries.length) days.push({ day: d, n: f.entries.length });
  }
  return json({ keepDays: ASK_LOG_DAYS, days });
}

const sha16 = async (text) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
const readJson = async (env, key) => { const o = await env.SITE.get(key); if (!o) return null; try { return JSON.parse(typeof o.text === 'function' ? await o.text() : o.body); } catch { return null; } };
// 10 questions per 5 minutes per address (cost protection, as on Render).
// Two at the same moment can both get through: fine for this.
const ASK_WINDOW_MS = 5 * 60 * 1000;
const ASK_MAX = 10;
async function askAllowed(env, ip, now = Date.now()) {
  const key = `ask/rl/${await sha16(`${torontoDay(now)}:${ip}`)}.json`;
  const window = Math.floor(now / ASK_WINDOW_MS);
  const was = await readJson(env, key);
  const n = was && was.window === window ? was.n : 0;
  if (n >= ASK_MAX) return false;
  await env.SITE.put(key, JSON.stringify({ window, n: n + 1 }));
  return true;
}
// Per day: questions answered and how many different people (an opaque
// daily hash, as on Render: no address). The question and its answers are
// kept 60 days for the owner to review (askLog below).
async function askCount(env, ip, now = Date.now()) {
  const day = torontoDay(now);
  const key = `ask/stats/${day}.json`;
  const d = (await readJson(env, key)) || { questions: 0, visitors: [] };
  d.questions += 1;
  const h = await sha16(`${env.STATS_KEY || env.OWNER_KEY || ''}:${day}:${ip}`);
  if (!d.visitors.includes(h)) d.visitors.push(h);
  await env.SITE.put(key, JSON.stringify(d));
}
async function askStats(request, env) {
  const want = String(env.STATS_KEY || env.OWNER_KEY || '');
  const got = new URL(request.url).searchParams.get('key') || '';
  let diff = want.length === got.length && want.length > 0 ? 0 : 1;
  for (let i = 0; i < Math.min(want.length, got.length); i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  if (diff) return json({ error: 'Not found.' }, 404);
  const byDay = [];
  let cursor;
  do {
    const page = await env.SITE.list({ prefix: 'ask/stats/', cursor });
    for (const o of page.objects || []) {
      const d = await readJson(env, o.key);
      if (d) byDay.push({ date: o.key.slice(10, 20), questions: d.questions || 0, visitors: (d.visitors || []).length });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  byDay.sort((a, b) => (a.date < b.date ? -1 : 1));
  const today = torontoDay(Date.now());
  const since = (n) => { const r = byDay.slice(-n); return { questions: r.reduce((s, d) => s + d.questions, 0), visits: r.reduce((s, d) => s + d.visitors, 0) }; };
  return json({ firstSeen: byDay.length ? byDay[0].date : today, totalQuestions: byDay.reduce((s, d) => s + d.questions, 0),
    today: byDay.length && byDay[byDay.length - 1].date === today ? byDay[byDay.length - 1] : { date: today, questions: 0, visitors: 0 },
    last7: since(7), last30: since(30), byDay });
}

const TOP_K = 9;
const TOP_K_DEEP = 24;
async function ask(request, env, ctx, { fetchImpl = fetch } = {}) {
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Question is required.' }, 400); }
  const { question, sources: wanted, dateFrom, dateTo, tier } = body || {};
  if (!question || !String(question).trim()) return json({ error: 'Question is required.' }, 400);
  if (String(question).length > 500) return json({ error: 'Question is too long (maximum 500 characters).' }, 400);
  const list = await readJson(env, 'search/sources.json');
  if (!list || !(await searchMeta(env))) return json({ error: 'Index still building, try again shortly.' }, 503);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!(await askAllowed(env, ip))) return new Response('Too many questions in a short time — please wait a few minutes and try again.', { status: 429 });
  await askCount(env, ip);
  const owner = keyMatches(request, env);

  const names = Object.fromEntries(list.sources.map((x) => [x.id, x.name]));
  const all = list.sources.map((x) => x.id);
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const abort = new AbortController();
  // What this question got, for the owner's review (askLog).
  const entry = { question: String(question).trim(), owner, deeper: tier === 'slow' && !owner, answers: [] };
  const send = (obj) => {
    if (obj.type === 'model') entry.answers.push({ label: obj.label, model: obj.model, text: '' });
    else if (obj.type === 'citations') {
      // The documents the passages handed to the model came from.
      const used = entry.used || (entry.used = []);
      for (const c of obj.citations || []) { const n = names[c.source] || c.source; if (!used.includes(n)) used.push(n); }
    }
    else if (obj.type === 'chunk') { if (!entry.answers.length) entry.answers.push({ label: '', text: '' }); entry.answers[entry.answers.length - 1].text += obj.text; }
    else if (obj.type === 'escalating') entry.escalated = true;
    else if (obj.type === 'fallback') (entry.fallbacks || (entry.fallbacks = [])).push(`${obj.from}: ${obj.reason}`);
    else if (obj.type === 'error') entry.error = obj.error;
    return writer.write(enc.encode(JSON.stringify(obj) + '\n')).catch(() => abort.abort());
  };
  const work = (async () => {
    try {
      let sources = list.defaults;
      if (Array.isArray(wanted) && wanted.length) {
        const valid = wanted.filter((id) => all.includes(id));
        if (!valid.length) { await send({ type: 'chunk', text: 'No documents are selected to search. Enable at least one source.' }); await send({ type: 'done', citations: [] }); return; }
        const conflict = (() => { for (const x of list.sources) { if (!valid.includes(x.id)) continue; const o = (x.conflictsWith || []).find((id) => valid.includes(id)); if (o) return [x.id, o]; } return null; })();
        if (conflict) { await send({ type: 'chunk', text: `${names[conflict[0]]} can't be searched together with ${names[conflict[1]]}. Deselect one of them.` }); await send({ type: 'done', citations: [] }); return; }
        sources = valid;
      }
      // Which documents were searched: what the person picked, or the usual set.
      entry.searched = sources.map((id) => names[id] || id);
      // The page always sends its ticked list: "picked" = not the usual set.
      entry.picked = !(sources.length === list.defaults.length && sources.every((id) => list.defaults.includes(id)));
      if (sources.length === all.length) sources = null;
      const opts = { sources, dateFrom: typeof dateFrom === 'string' && dateFrom ? dateFrom : null, dateTo: typeof dateTo === 'string' && dateTo ? dateTo : null };
      // The owner's own questions (owner key on his phone) go straight to the
      // deeper search and Claude Opus (owner, 2026-11-04); members' deeper
      // searches use Sonnet.
      const slow = tier === 'slow' || owner;
      const chunks = await searchShards(env, question, { topK: slow ? TOP_K_DEEP : TOP_K, ...opts });
      if (!chunks || !chunks.length) { await send({ type: 'chunk', text: 'No matching passages were found in the selected document(s) for this question.' }); await send({ type: 'done', citations: [] }); return; }
      const cite = (cs) => send({ type: 'citations', citations: cs.map((c) => ({ source: c.source, page: c.page, snippet: c.text.slice(0, 220), fullText: c.text,
        url: c.url || (list.pdfs.includes(c.source) && /^\d+$/.test(String(c.page)) ? `/docs/${c.source}.pdf#page=${c.page}` : null) })) });
      await cite(chunks);
      const onToken = (text) => send({ type: 'chunk', text });
      const models = await searchModels(env);
      const base = { question, names, onToken, signal: abort.signal, fetchImpl, send };
      if (slow) {
        await streamModel(env, owner ? models.owner : models.deep, { ...base, chunks, fast: false });
        await send({ type: 'done' });
        return;
      }
      const first = await streamModel(env, models.first, { ...base, chunks, fast: true });
      if (NOT_FOUND_PATTERN.test(first)) {
        await send({ type: 'escalating' });
        const deep = await searchShards(env, question, { topK: TOP_K_DEEP, ...opts });
        await cite(deep);
        await streamModel(env, models.deep, { ...base, chunks: deep, fast: false });
        await send({ type: 'done', escalated: true });
      } else {
        await send({ type: 'done', canEscalate: true });
      }
    } catch (err) {
      if (!abort.signal.aborted) await send({ type: 'error', error: err.message });
    } finally {
      await writer.close().catch(() => {});
      await askLog(env, entry).catch((err) => console.log(`question not logged: ${err.message}`));
    }
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(work);
  return new Response(readable, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-cache' } });
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

// The Notifications tab (owner, 2026-11-05): every alert sent in the last
// 30 days with the logic behind it, from the laptop's status/alerts.json.
// Owner only, like /health.
async function alertsFor(request, env) {
  if (!(await isOwner(request, env))) return json({ error: 'not found' }, 404);
  const o = await env.SITE.get('status/alerts.json');
  if (!o) return json({ from: null, alerts: [] });
  try { return json(JSON.parse(typeof o.text === 'function' ? await o.text() : o.body)); } catch { return json({ from: null, alerts: [] }); }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([watchChecker(env), pruneAskLog(env).catch(() => {})]));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ask') {
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
      return ask(request, env, ctx);
    }
    if (url.pathname === '/api/sources') {
      const list = await readJson(env, 'search/sources.json');
      return list ? json({ sources: list.sources }) : json({ error: 'Not uploaded yet.' }, 503);
    }
    if (url.pathname === '/api/status') {
      const meta = await searchMeta(env).catch(() => null);
      return json({ ready: !!meta, chunkCount: meta ? meta.N : 0 });
    }
    if (url.pathname === '/api/stats') return askStats(request, env);
    if (url.pathname === '/stats/hit') {
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
      return statsHit(request, env);
    }
    if (url.pathname === '/stats/days') return (await isOwner(request, env)) ? statsDays(env) : json({ error: 'not found' }, 404);
    if (url.pathname === '/whoami') return whoami(request, env);
    if (url.pathname === '/api/board' || url.pathname === '/api/board/latest') return relay(request, env, url);
    if (url.pathname === '/health') return healthFor(request, env);
    if (url.pathname === '/health/models') return modelsApi(request, env);
    if (url.pathname === '/health/spend') return spendApi(request, env);
    if (url.pathname === '/health/questions') return questionsApi(request, env);
    if (url.pathname === '/health/alerts') return alertsFor(request, env);
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
    if (key.split('/').includes('..') || key.startsWith('subs/') || key.startsWith('status/') || key.startsWith('stats/') || key.startsWith('backups/') || key.startsWith('relay/') || key.startsWith('search/') || key.startsWith('ask/')) return new Response('Not found', { status: 404 });

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
