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
// Accounts (owner, 2026-11-09): LOCK=on shows the site only to people the
// owner approved; /account, /auth/*, /health/accounts. See "Accounts" below
// and docs/board-checker/ACCOUNTS.md.
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
      resetAhead: p.resetAhead !== false, held: p.held !== false,
      // Off unless asked for (owner, 2026-11-02): a train past its call and not ordered.
      stale: p.stale === true,
      time: Number.isFinite(time) && time >= 0 && time <= 24 * 60 ? time : 30,
      before: [30, 45, 60, 90].includes(Number(p.before)) ? Number(p.before) : 0,
    };
  }
  // Whose phone (owner, 2026-11-10: "show who's following what turn on the
  // members page"): the signed-in member's account id, kept with the
  // follows. A save while signed out keeps the id already there.
  let account;
  const who = await sessionOf(request, env);
  if (who && who.status === 'approved' && who.id !== 'owner') account = who.id;
  else { const old = await readJson(env, key); if (old && typeof old.account === 'string') account = old.account; }
  await env.SITE.put(key, JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, turns, prefs, account, updated: new Date().toISOString() }),
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

// Article 18.6(b) claims sent to the union rep (owner, 2026-11-06: "They
// can either export this info as a text file or hit submit, and it will be
// sent to the appropriate union rep email address"; "different email for
// conductors and engineers. put an option on the page health page to input
// and update the emails"; "an optional box to enter their email to get a
// copy"). The rep addresses (and the crew-names passcode, so the owner key
// unlocks the names) are kept in R2 settings/held186.json, set from Page
// Health. The mail goes out through a Google Apps Script on the owner's
// Gmail (docs/board-checker/EMAIL.md): MAIL_SCRIPT_URL + MAIL_SCRIPT_KEY
// (secrets). 30 a day, for the owner's Gmail's sake.
const HELD186_KEY = 'settings/held186.json';
const HELD186_DAY_MAX = 30;
// Per sender and per claim (owner, 2026-11-06: "limits the amount of
// grievances that can be sent, just so no one spams the button"): 5 a day
// from one address (kept as a hash, never the address), and the same
// claim (craft + name + train out) once in 30 days.
const HELD186_IP_MAX = 5;
const HELD186_SENT_KEY = 'stats/held186/sent.json';
const HELD186_SENT_DAYS = 30;
const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const mailReady = (env) => !!(env.MAIL_SCRIPT_URL && env.MAIL_SCRIPT_KEY);
async function held186Ready(env) {
  const s = (await readJson(env, HELD186_KEY)) || {};
  return json({ CO: !!s.co && mailReady(env), EN: !!s.en && mailReady(env) });
}
async function held186Settings(request, env) {
  if (!(await isOwner(request, env))) return json({ error: 'not found' }, 404);
  const s = (await readJson(env, HELD186_KEY)) || {};
  if (request.method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch { return json({ error: 'not JSON' }, 400); }
    for (const k of ['co', 'en']) {
      if (b[k] === undefined) continue;
      const v = String(b[k] || '').trim();
      if (v && !EMAIL_RE.test(v)) return json({ error: `That doesn't look like an email address: ${v}` }, 400);
      s[k] = v;
    }
    if (typeof b.namesPass === 'string' && b.namesPass) s.namesPass = b.namesPass.slice(0, 200);
    if (b.clearNamesPass) delete s.namesPass;
    await env.SITE.put(HELD186_KEY, JSON.stringify(s), { httpMetadata: { contentType: 'application/json' } });
  }
  return json({ co: s.co || '', en: s.en || '', namesPass: s.namesPass || '', mail: mailReady(env) });
}
async function held186Submit(request, env) {
  const text0 = await request.text();
  if (text0.length > 12000) return json({ error: 'Too long.' }, 413);
  let b = {};
  try { b = JSON.parse(text0); } catch { return json({ error: 'not JSON' }, 400); }
  const craft = b.craft === 'EN' ? 'EN' : 'CO';
  const s = (await readJson(env, HELD186_KEY)) || {};
  const to = craft === 'EN' ? s.en : s.co;
  if (!to || !mailReady(env)) return json({ error: 'Sending isn\'t set up yet: export the text file and send it to your rep.' }, 503);
  const name = String(b.name || '').trim().slice(0, 80);
  const body = String(b.text || '').slice(0, 8000);
  const copy = String(b.copy || '').trim();
  if (!name || !body) return json({ error: 'Fill in your name.' }, 400);
  if (copy && !EMAIL_RE.test(copy)) return json({ error: 'Your email for a copy doesn\'t look right.' }, 400);
  const now = Date.now();
  const day = torontoDay(now);
  const countKey = `stats/held186/${day}.json`;
  const today = (await readJson(env, countKey)) || { n: 0, ips: {} };
  today.ips = today.ips || {};
  if (today.n >= HELD186_DAY_MAX) return json({ error: 'Too many sent today: export the text file and send it to your rep.' }, 429);
  const ip = await sha(`held186:${request.headers.get('cf-connecting-ip') || 'unknown'}`);
  if ((today.ips[ip] || 0) >= HELD186_IP_MAX) return json({ error: `That's ${HELD186_IP_MAX} sent from here today, the most allowed: export the text file for any more.` }, 429);
  const claim = await sha(`${craft}|${name.toLowerCase().replace(/\s+/g, ' ')}|${String(b.out || '').toUpperCase().replace(/\s+/g, ' ').trim()}`);
  const sentAll = (await readJson(env, HELD186_SENT_KEY)) || {};
  const sent = Object.fromEntries(Object.entries(sentAll).filter(([, at]) => now - at < HELD186_SENT_DAYS * 86400000));
  if (sent[claim]) return json({ error: 'This one was already sent to the rep. If something changed, export the text file and send it yourself.' }, 409);
  const subject = `${craft === 'EN' ? 'Engineer' : 'Conductor'}: held 14 h+ at the away terminal · ${name} · ${String(b.out || '').slice(0, 20)}`;
  let res;
  try {
    res = await fetch(env.MAIL_SCRIPT_URL, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: env.MAIL_SCRIPT_KEY, to, cc: copy || '', replyTo: copy || '', subject, body }) });
  } catch (e) {
    return json({ error: `The email didn't go (couldn't reach the Google script: ${e.message}). Export the text file instead.` }, 502);
  }
  // Why it didn't go, in words the owner can act on (owner, 2026-11-06:
  // nothing arrived and the page said nothing).
  const raw = await res.text().catch(() => '');
  let out = {};
  try { out = JSON.parse(raw); } catch { out = null; }
  if (!res.ok || !out || !out.ok) {
    const why = !out
      ? (/accounts\.google\.com|ServiceLogin|sign in/i.test(raw) ? 'Google asked to sign in: the script\'s "Who has access" must be Anyone'
        : res.status === 404 ? 'Google says there\'s no script at that address: check MAIL_SCRIPT_URL is the Web app URL ending in /exec'
          : /authoriz|permission/i.test(raw) ? 'the script isn\'t allowed to send email yet: run it once in the editor and allow it'
            : `the Google script answered ${res.status} with a page, not a result`)
      : out.error === 'key' ? 'the key in the script doesn\'t match MAIL_SCRIPT_KEY'
        : `the Google script said: ${String(out.error || 'no').slice(0, 120)}`;
    return json({ error: `The email didn't go: ${why}. Export the text file instead.` }, 502);
  }
  today.n += 1;
  today.ips[ip] = (today.ips[ip] || 0) + 1;
  sent[claim] = now;
  await env.SITE.put(countKey, JSON.stringify(today), { httpMetadata: { contentType: 'application/json' } });
  await env.SITE.put(HELD186_SENT_KEY, JSON.stringify(sent), { httpMetadata: { contentType: 'application/json' } });
  return json({ ok: true, copy: !!copy });
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

// --- Accounts (owner, 2026-11-09: "the information is only visible if you
// have an account"; "I have to approve each person. Sign Up I need name,
// email, pin and hire date"; the pin is their CN employee number; "I check
// by eye") ---
// Cloudflare Access was tried first (board-test) and dropped: its free plan
// stops at 50 people. So the accounts live here.
//   LOCK=on (variable): everything needs a signed-in, approved account,
//     except /account, /auth/*, the app icons/manifest/service worker, the
//     relay (its own BOARD_KEY) and requests carrying the owner key.
//     Pages are sent to /account?next=…; anything else gets 401.
//   SIGNUP_NOTICE=on (variable): /auth/me says so, for the page's "sign up
//     to keep access" line before the lock goes on.
//   AUTH_SECRET (secret, optional): signs the sign-in cookie; else OWNER_KEY.
// A sign-up is kept in R2 accounts/users/<id>.json (never served). Its
// email is confirmed with a code first ("can we verify emails"); the device
// that entered the code holds a cookie that starts working the moment the
// owner approves. The page names no place or company ("non descript"). Other devices sign
// in with a 6-digit code emailed through the Gmail script (EMAIL.md). The
// employee number and hire date are deleted when the owner approves or
// declines; only the owner key (never the Access email header, which a
// stranger could send once Access is off) opens GET/POST /health/accounts.
const ACC = 'accounts/';
const SESSION_COOKIE = 'bsess';
// Signed in until the device goes 30 days without opening the site (owner,
// 2026-11-10: "every 30 days if they do not use it"): each visit a day or
// more after the last renews the cookie (/auth/me, which the page asks on
// every load).
const SESSION_DAYS = 30;
const SESSION_RENEW_MS = 86400000;
const CODE_MINUTES = 10;
const CODE_TRIES = 5;
const CODE_DAY_MAX = 20;
const ACC_MAIL_DAY_MAX = 70; // Gmail allows about 100 a day; 18.6(b) has its own 30
// Per internet address. 40, not 5: a crew room's Wi-Fi or a phone company
// puts many people behind one address (found planning the lock, 2026-11-10).
const SIGNUP_IP_MAX = 40;
const SIGNUP_DAY_MAX = 150;
const USER_CACHE_MS = 60 * 1000;
const switchOn = (v) => /^(on|1|true|yes)$/i.test(String(v || '').trim());
const lockOn = (env) => switchOn(env.LOCK);
const authSecret = (env) => { const s = String(env.AUTH_SECRET || env.OWNER_KEY || ''); return s.length >= 16 ? s : ''; };
const shaHex = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(t)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const uidOf = async (email) => (await shaHex(`account:${email}`)).slice(0, 32);
const userKey = (id) => `${ACC}users/${id}.json`;
const putJson = (env, key, value) => env.SITE.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json' } });
const sameText = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const bodyJson = async (request) => { const t = await request.text(); if (t.length > 4000) return null; try { const b = JSON.parse(t); return b && typeof b === 'object' ? b : null; } catch { return null; } };

const userCache = new Map();
async function userById(env, id, now = Date.now(), fresh = false) {
  const hit = fresh ? null : userCache.get(id);
  // Only an approved member is remembered: someone waiting is looked up
  // every time, so an approval lets them in at once (owner, 2026-11-10:
  // "Not approved yet" a moment after he had approved the account).
  if (hit && hit.user && hit.user.status === 'approved' && now - hit.at < USER_CACHE_MS) return hit.user;
  const user = await readJson(env, userKey(id));
  userCache.set(id, { at: now, user });
  return user;
}
async function saveUser(env, id, user, now = Date.now()) {
  if (user) await putJson(env, userKey(id), user); else await env.SITE.delete(userKey(id));
  userCache.set(id, { at: now, user });
}

async function sessionCookie(env, payload) {
  const body = b64(utf8(JSON.stringify(payload)));
  const sig = b64(await hmac256(utf8(authSecret(env)), utf8(body)));
  return `${SESSION_COOKIE}=${body}.${sig}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}
const CLEAR_COOKIE = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
// Who the cookie says this is: { id, status, name } or null. The account is
// looked up each time (kept a minute), so Remove works at once.
// fresh: read the account itself, not the minute-old copy (who am I, and
// the Members list: a new Admin sees the tab on the next reload, and one
// who is no longer Admin loses it at once).
async function sessionOf(request, env, now = Date.now(), fresh = false) {
  const secret = authSecret(env);
  if (!secret) return null;
  const m = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]+)`).exec(request.headers.get('cookie') || '');
  if (!m) return null;
  if (!sameText(b64(await hmac256(utf8(secret), utf8(m[1]))), m[2])) return null;
  let p;
  try { p = JSON.parse(new TextDecoder().decode(ub64(m[1]))); } catch { return null; }
  if (!p || typeof p.u !== 'string' || !(now - p.t < SESSION_DAYS * 86400000)) return null;
  if (p.u === 'owner') return { id: 'owner', status: 'approved', name: 'Owner', role: 'member', t: p.t };
  let user = await userById(env, p.u, now, fresh);
  // One device at a time (owner, 2026-11-10: "only one device can be logged
  // in per account … that will make sure they don't share their account"):
  // signing in elsewhere changes the account's key, so this cookie's key no
  // longer matches. Checked against the account itself, not the kept copy.
  if (user && user.key !== p.k && !fresh) user = await userById(env, p.u, now, true);
  if (!user || user.status === 'removed') return null;
  if (user.key !== p.k) return user.status === 'approved' ? { id: p.u, status: 'elsewhere' } : null;
  return { id: p.u, key: p.k, t: p.t, status: user.status, name: user.name, email: user.email, role: user.role === 'admin' ? 'admin' : 'member' };
}

// One email through the Gmail script, counted against the day's allowance:
// 'sent', or why not ('off', 'cap', 'failed').
async function accountMail(env, to, subject, body, now = Date.now()) {
  if (!mailReady(env)) return 'off';
  const key = `${ACC}mail/${torontoDay(now)}.json`;
  const count = (await readJson(env, key)) || { n: 0 };
  if (count.n >= ACC_MAIL_DAY_MAX) return 'cap';
  try {
    const res = await fetch(env.MAIL_SCRIPT_URL, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: env.MAIL_SCRIPT_KEY, to, cc: '', replyTo: '', subject, body, name: 'Account' }) });
    const out = JSON.parse(await res.text());
    if (!res.ok || !out || !out.ok) return 'failed';
  } catch { return 'failed'; }
  count.n += 1;
  await putJson(env, key, count);
  return 'sent';
}

async function authSignup(request, env, now = Date.now()) {
  if (!authSecret(env) || !mailReady(env)) return json({ error: 'Sign-up isn\'t set up yet.' }, 503);
  const b = await bodyJson(request);
  if (!b) return json({ error: 'That didn\'t come through. Try again.' }, 400);
  const name = String(b.name || '').replace(/\s+/g, ' ').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const pin = String(b.pin || '').replace(/[\s-]+/g, '');
  const hireDate = String(b.hireDate || '').trim();
  if (name.length < 3 || name.length > 80) return json({ error: 'Enter your full name.' }, 400);
  if (email.length > 120 || !EMAIL_RE.test(email)) return json({ error: 'That email doesn\'t look right.' }, 400);
  if (!/^\d{4,9}$/.test(pin)) return json({ error: 'Enter your PIN: digits only.' }, 400);
  if (!/^\d{4}-\d\d-\d\d$/.test(hireDate) || Number.isNaN(Date.parse(hireDate)) || hireDate < '1960-01-01' || hireDate > torontoDay(now)) return json({ error: 'Enter your hire date.' }, 400);
  const dayKey = `${ACC}signups/${torontoDay(now)}.json`;
  const today = (await readJson(env, dayKey)) || { n: 0, ips: {} };
  today.ips = today.ips || {};
  const ip = await sha(`signup:${request.headers.get('cf-connecting-ip') || 'unknown'}`);
  if (today.n >= SIGNUP_DAY_MAX || (today.ips[ip] || 0) >= SIGNUP_IP_MAX) return json({ error: 'Too many sign-ups from here today. Try again tomorrow.' }, 429);
  today.n += 1;
  today.ips[ip] = (today.ips[ip] || 0) + 1;
  await putJson(env, dayKey, today);
  // The email is confirmed with a code (owner, 2026-11-09: "can we verify
  // emails") before the owner sees it. The page says plainly why no code
  // goes (owner, twice: "I'm requesting a new email code and it's not being
  // sent"): clear beats hiding who has an account.
  const id = await uidOf(email);
  const old = await readJson(env, userKey(id));
  if (old && old.status !== 'declined' && old.status !== 'unverified') return json({ error: NO_CODE[old.status] || NO_CODE.removed, use: old.status === 'approved' ? 'signin' : undefined }, 409);
  const sent = await sendCode(env, id, email, now);
  if (NO_CODE[sent]) return json({ error: NO_CODE[sent] }, 429);
  if (sent !== 'sent') return json({ error: 'The confirmation email couldn\'t be sent right now. Try again later.' }, 503);
  await saveUser(env, id, { email, name, pin, hireDate, status: 'unverified', key: b64(crypto.getRandomValues(new Uint8Array(12))), requestedAt: now }, now);
  return json({ ok: true });
}

// Why no code went, in words for the page.
const NO_CODE = {
  soon: 'A code was emailed to that address less than a minute ago. Check your inbox and junk mail, or wait a minute and ask again.',
  max: 'Too many codes have gone to that address today. Try again tomorrow.',
  none: 'There\'s no account with that email. Check the spelling, or use Sign up.',
  pending: 'That email is still waiting for approval. You get an email once you\'re approved.',
  approved: 'That email already has an account. Use Sign in.',
  declined: 'That sign-up wasn\'t approved. Use Sign up to try again.',
  removed: 'That email can\'t be used here. Ask whoever gave you this address.',
};
// A 6-digit code to that address: 'sent', 'soon' (one a minute), 'max' (twenty
// a day) or why the email didn't go.
async function sendCode(env, id, email, now = Date.now()) {
  const codeKey = `${ACC}codes/${id}.json`;
  const rec = (await readJson(env, codeKey)) || {};
  const day = torontoDay(now);
  const n = rec.day === day ? rec.n || 0 : 0;
  if (n >= CODE_DAY_MAX) return 'max';
  if (rec.sentAt && now - rec.sentAt < 60000) return 'soon';
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  const sent = await accountMail(env, email, `${code} is your code`,
    `Your code is ${code}\n\nIt works for ${CODE_MINUTES} minutes. If you didn't ask for it, ignore this email.`, now);
  if (sent !== 'sent') return sent;
  await putJson(env, codeKey, { hash: await shaHex(`${id}:${code}:${authSecret(env)}`), exp: now + CODE_MINUTES * 60000, tries: 0, sentAt: now, day, n: n + 1 });
  return 'sent';
}

async function authCode(request, env, now = Date.now()) {
  if (!authSecret(env) || !mailReady(env)) return json({ error: 'Email sign-in isn\'t set up yet.' }, 503);
  const b = await bodyJson(request);
  const email = String((b && b.email) || '').trim().toLowerCase();
  if (email.length > 120 || !EMAIL_RE.test(email)) return json({ error: 'That email doesn\'t look right.' }, 400);
  const id = await uidOf(email);
  const user = await readJson(env, userKey(id));
  if (!user || user.status !== 'approved') { const why = !user || user.status === 'unverified' ? 'none' : user.status; return json({ error: NO_CODE[why] || NO_CODE.removed, use: why === 'none' || why === 'declined' ? 'signup' : undefined }, 404); }
  const sent = await sendCode(env, id, email, now);
  if (NO_CODE[sent]) return json({ error: NO_CODE[sent] }, 429);
  if (sent !== 'sent') return json({ error: 'The sign-in email couldn\'t be sent right now. Try again later.' }, 503);
  return json({ ok: true });
}

async function authVerify(request, env, now = Date.now()) {
  const secret = authSecret(env);
  if (!secret) return json({ error: 'Accounts aren\'t set up yet.' }, 503);
  const b = await bodyJson(request);
  const email = String((b && b.email) || '').trim().toLowerCase();
  const code = String((b && b.code) || '').replace(/\D/g, '');
  const bad = () => json({ error: 'That code isn\'t right, or it ran out. Check it, or ask for a new one.' }, 400);
  if (!EMAIL_RE.test(email) || code.length !== 6) return bad();
  const id = await uidOf(email);
  const codeKey = `${ACC}codes/${id}.json`;
  const rec = await readJson(env, codeKey);
  if (!rec || !rec.hash || now > rec.exp || rec.tries >= CODE_TRIES) return bad();
  if (!sameText(await shaHex(`${id}:${code}:${secret}`), rec.hash)) {
    await putJson(env, codeKey, { ...rec, tries: rec.tries + 1 });
    return bad();
  }
  await putJson(env, codeKey, { sentAt: rec.sentAt, day: rec.day, n: rec.n });
  const user = await readJson(env, userKey(id));
  if (!user || (user.status !== 'approved' && user.status !== 'unverified')) return bad();
  if (user.status === 'unverified') {
    // Email confirmed: now it waits for the owner.
    user.status = 'pending';
    user.requestedAt = now;
    if (env.NTFY_TOPIC) {
      try { await fetch(`https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`, { method: 'POST', body: 'Someone is waiting for approval. Open the account page to check them.', headers: { Title: 'New sign-up', Priority: 'default' } }); } catch { /* the list still shows it */ }
    }
  } else {
    user.lastSignIn = now;
    // Signs the other device out. Not for an Admin (owner, 2026-11-10:
    // "admin accounts don't have the 1 device restriction").
    if (user.role !== 'admin') user.key = b64(crypto.getRandomValues(new Uint8Array(12)));
  }
  await saveUser(env, id, user, now);
  const res = json({ ok: true, status: user.status });
  res.headers.append('set-cookie', await sessionCookie(env, { u: id, k: user.key, t: now }));
  return res;
}

// The Members list, and Approve / Decline / Remove / Delete. The owner key,
// or a signed-in member the owner made an Admin (owner, 2026-11-09: "an
// access button (Member, Admin)"). An Admin approves, declines and removes
// members; only the owner key changes who is an Admin or removes one.
async function accountsAdmin(request, env, url, now = Date.now()) {
  let you = keyMatches(request, env) ? 'owner' : null;
  if (!you) { const who = await sessionOf(request, env, now, true); if (who && who.status === 'approved' && who.role === 'admin') you = 'admin'; }
  if (!you) return json({ error: 'not found' }, 404);
  if (request.method === 'GET') {
    const users = [];
    let cursor;
    do {
      const page = await env.SITE.list({ prefix: `${ACC}users/`, cursor });
      const got = await Promise.all(page.objects.map(async (o) => { const u = await readJson(env, o.key); return u && { id: o.key.slice(`${ACC}users/`.length, -5), ...u, key: undefined }; }));
      for (const u of got.filter(Boolean)) {
        if (u.status !== 'unverified') users.push(u);
        else if (now - (u.requestedAt || 0) > 2 * 86400000) await saveUser(env, u.id, null, now); // never confirmed their email
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    users.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
    // What each member's phones follow (subs/ stamped by subscribe()).
    const follows = new Map();
    let unknownPhones = 0;
    let subCursor;
    do {
      const page = await env.SITE.list({ prefix: 'subs/', cursor: subCursor });
      const subs = await Promise.all((page.objects || []).map((o) => readJson(env, o.key)));
      for (const sub of subs.filter(Boolean)) {
        if (!sub.account) { unknownPhones += 1; continue; }
        const f = follows.get(sub.account) || { phones: 0, turns: new Set(), people: new Set() };
        f.phones += 1;
        for (const t of sub.turns || []) (String(t).startsWith('@') ? f.people : f.turns).add(String(t));
        follows.set(sub.account, f);
      }
      subCursor = page.truncated ? page.cursor : undefined;
    } while (subCursor);
    for (const u of users) { const f = follows.get(u.id); if (f) u.follows = { phones: f.phones, turns: [...f.turns].sort(), people: f.people.size }; }
    const mail = (await readJson(env, `${ACC}mail/${torontoDay(now)}.json`)) || { n: 0 };
    return json({ you, users, unknownPhones, lock: lockOn(env), notice: switchOn(env.SIGNUP_NOTICE), mailReady: mailReady(env), mailToday: mail.n, mailMax: ACC_MAIL_DAY_MAX });
  }
  if (request.method !== 'POST') return json({ error: 'GET or POST' }, 405);
  const b = await bodyJson(request);
  const id = String((b && b.id) || '');
  const action = String((b && b.action) || '');
  if (!/^[0-9a-f]{32}$/.test(id)) return json({ error: 'No such account.' }, 400);
  const user = await readJson(env, userKey(id));
  if (!user) return json({ error: 'That account is gone already.' }, 404);
  const site = String(env.SITE_URL || url.origin).replace(/\/+$/, '');
  let mail = null;
  if (action === 'approve' && user.status === 'pending') {
    const { pin, hireDate, ...rest } = user;
    await saveUser(env, id, { ...rest, status: 'approved', approvedAt: now }, now);
    mail = await accountMail(env, user.email, 'You\'re approved',
      `Hi ${user.name},\n\nYour sign-up is approved.\n\nThe phone or computer you signed up on is already signed in. Just open ${site}/\n\nOn any other device, open ${site}/account, pick Sign in and enter this email address. A 6-digit code comes by email.`, now);
  } else if (action === 'decline' && user.status === 'pending') {
    const { pin, hireDate, ...rest } = user;
    await saveUser(env, id, { ...rest, status: 'declined', declinedAt: now }, now);
    mail = await accountMail(env, user.email, 'Your sign-up couldn\'t be confirmed',
      `Hi ${user.name},\n\nYour sign-up couldn't be confirmed: the details didn't match.\n\nIf that's a mistake, sign up again at ${site}/account and check your name, PIN and hire date.`, now);
  } else if (action === 'role' && user.status === 'approved') {
    if (you !== 'owner') return json({ error: 'Only the owner changes who is an Admin.' }, 403);
    await saveUser(env, id, { ...user, role: b.role === 'admin' ? 'admin' : 'member' }, now);
  } else if (action === 'remove' && user.status === 'approved') {
    if (you !== 'owner' && user.role === 'admin') return json({ error: 'Only the owner removes an Admin.' }, 403);
    await saveUser(env, id, { ...user, role: 'member', status: 'removed', removedAt: now, key: b64(crypto.getRandomValues(new Uint8Array(12))) }, now);
  } else if (action === 'delete' && user.status !== 'approved') {
    await saveUser(env, id, null, now);
    await env.SITE.delete(`${ACC}codes/${id}.json`);
  } else return json({ error: 'That can\'t be done to this account now. Reload the list.' }, 409);
  return json({ ok: true, mail });
}

const OPEN_FILES = /^\/(manifest\.webmanifest|board\.webmanifest|board-icon-\d+\.png|board-sw\.js|sw\.js|favicon\.ico|robots\.txt)$/;
// Every request comes through here first: an answer, or null to carry on.
async function accounts(request, env, url) {
  const p = url.pathname;
  if (p === '/account') return new Response(ACCOUNT_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'same-origin' } });
  if (p === '/health/accounts') return accountsAdmin(request, env, url);
  if (p === '/auth/me') {
    const s = await sessionOf(request, env, Date.now(), true);
    const res = json({ ready: !!authSecret(env), mailReady: mailReady(env), lock: lockOn(env), notice: switchOn(env.SIGNUP_NOTICE), signedIn: !!s && s.status === 'approved', status: s ? s.status : null, name: (s && s.name) || null, email: (s && s.email) || null, role: s && s.status === 'approved' ? s.role || 'member' : null });
    if (s && s.status === 'approved' && Date.now() - s.t > SESSION_RENEW_MS) res.headers.append('set-cookie', await sessionCookie(env, s.id === 'owner' ? { u: 'owner', t: Date.now() } : { u: s.id, k: s.key, t: Date.now() }));
    return res;
  }
  if (p.startsWith('/auth/')) {
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (p === '/auth/signup') return authSignup(request, env);
    if (p === '/auth/code') return authCode(request, env);
    if (p === '/auth/verify') return authVerify(request, env);
    if (p === '/auth/logout') { const res = json({ ok: true }); res.headers.append('set-cookie', CLEAR_COOKIE); return res; }
    if (p === '/auth/owner') {
      // The owner's device: its key gets it in without an email.
      if (!keyMatches(request, env)) return json({ error: 'not found' }, 404);
      const res = json({ ok: true });
      res.headers.append('set-cookie', await sessionCookie(env, { u: 'owner', t: Date.now() }));
      return res;
    }
    return json({ error: 'not found' }, 404);
  }
  if (!lockOn(env)) return null;
  if (p === '/whoami' || p === '/api/board' || p === '/api/board/latest' || OPEN_FILES.test(p)) return null;
  if (keyMatches(request, env) || bearerMatches(request, env.BOARD_KEY)) return null;
  const s = await sessionOf(request, env);
  if (s && s.status === 'approved') return null;
  if (request.method === 'GET' && /text\/html/.test(request.headers.get('accept') || '')) {
    return new Response(null, { status: 302, headers: { location: `/account?next=${encodeURIComponent(p + url.search)}`, 'cache-control': 'no-store' } });
  }
  return json({ error: 'Sign in to see this.', signIn: '/account' }, 401);
}

// The sign-in / sign-up page, and the owner's approval list on a device
// that holds the owner key. String.raw: its script has no template text.
const ACCOUNT_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sign in</title>
<link rel="icon" type="image/png" sizes="192x192" href="board-icon-192.png">
<style>
:root { --bg: #eceeea; --sheet: #ffffff; --ink: #1d2a2e; --muted: #56676c; --line: #cdd5d2; --accent: #0f5c63; --accent-ink: #ffffff; --tint: #dcebec; --bad: #9c2b2b; --badbg: #f7e3e1; }
:root[data-theme="dark"] { --bg: #12191b; --sheet: #1a2326; --ink: #e2e9e8; --muted: #9eaeb1; --line: #2d3b3f; --accent: #5fb3ba; --accent-ink: #0c1416; --tint: #1f3539; --bad: #ffaaa3; --badbg: #3a2020; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 30rem; margin: 0 auto; padding: 1.25rem 1rem 3rem; }
h1 { font-size: 1.35rem; margin: .5rem 0 1rem; }
h2 { font-size: 1.1rem; margin: 0 0 .5rem; }
h3 { font-size: .95rem; margin: 1.25rem 0 .4rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
section { background: var(--sheet); border: 1px solid var(--line); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; }
label { display: block; font-weight: 600; margin: .8rem 0 .25rem; }
.hint { font-weight: 400; color: var(--muted); font-size: .9rem; }
input { width: 100%; padding: .65rem .7rem; font: inherit; color: inherit; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; }
input:focus-visible, button:focus-visible, a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
button, a.btn { display: inline-block; font: inherit; font-weight: 600; padding: .65rem 1rem; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: var(--accent-ink); cursor: pointer; text-decoration: none; margin: .9rem .4rem 0 0; }
button.plain { background: transparent; color: var(--accent); }
button.small { padding: .4rem .7rem; margin-top: .5rem; font-size: .92rem; }
button:disabled { opacity: .55; cursor: default; }
.tabs { display: flex; gap: .5rem; margin-bottom: .25rem; }
.tabs button { flex: 1; margin: 0; background: transparent; color: var(--accent); }
.tabs button[aria-pressed="true"] { background: var(--tint); color: var(--ink); }
#msg { padding: .7rem .9rem; border-radius: 8px; background: var(--tint); margin-bottom: 1rem; }
#msg.bad { background: var(--badbg); color: var(--bad); }
.person { border-top: 1px solid var(--line); padding: .7rem 0 .8rem; overflow-wrap: anywhere; }
.person b { font-size: 1.05rem; }
.person dl { margin: .3rem 0 0; display: grid; grid-template-columns: auto 1fr; gap: .1rem .7rem; }
.person dt { color: var(--muted); }
.person dd { margin: 0; font-variant-numeric: tabular-nums; }
.none { color: var(--muted); margin: .3rem 0; }
p { margin: .4rem 0; }
[hidden] { display: none !important; }
</style>
</head>
<body>
<main>
<h1>Members</h1>
<div id="msg" role="status" hidden></div>

<section id="in" hidden>
  <h2>You're signed in</h2>
  <p id="who"></p>
  <a class="btn" id="go" href="/">Open the site</a>
  <button type="button" class="plain" id="out">Sign out</button>
</section>

<section id="wait" hidden>
  <h2>Waiting for approval</h2>
  <p>Each sign-up is checked by hand, so this can take a day or so. Once you're approved, this phone or computer opens the site by itself, and you get an email.</p>
  <button type="button" id="again">Check again</button>
  <button type="button" class="plain" id="out2">Start over</button>
</section>

<section id="forms" hidden>
  <div class="tabs">
    <button type="button" id="tabIn" aria-pressed="true">Sign in</button>
    <button type="button" id="tabUp" aria-pressed="false">Sign up</button>
  </div>
  <form id="fIn">
    <label for="inEmail">Email</label>
    <input id="inEmail" type="email" autocomplete="email" required>
    <button type="submit">Email me a sign-in code</button>
  </form>
  <form id="fCode" hidden>
    <p id="codeNote"></p>
    <label for="inCode">Code</label>
    <input id="inCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
    <button type="submit">Continue</button>
    <button type="button" class="plain" id="back">Go back</button>
  </form>
  <form id="fUp" hidden>
    <p>Each sign-up is approved by hand.</p>
    <label for="upName">Full name</label>
    <input id="upName" autocomplete="name" maxlength="80" required>
    <label for="upEmail">Email</label>
    <input id="upEmail" type="email" autocomplete="email" required>
    <label for="upPin">PIN</label>
    <input id="upPin" inputmode="numeric" autocomplete="off" maxlength="12" required>
    <label for="upHire">Hire date</label>
    <input id="upHire" type="date" required>
    <p class="hint">Your PIN and hire date are only used to confirm who you are. They are deleted as soon as your sign-up is approved or declined, and never shown on the site.</p>
    <button type="submit">Send for approval</button>
  </form>
</section>

<section id="owner" hidden>
  <h2>Sign-ups</h2>
  <p class="hint" id="ownerNote">Only this device sees this list.</p>
  <h3>Waiting for you</h3>
  <div id="pending"></div>
  <h3>Approved</h3>
  <div id="approved"></div>
  <h3>Declined or removed</h3>
  <div id="other"></div>
</section>
</main>
<script>
(function () {
  try {
    var t = localStorage.getItem('boardTheme') || '';
    var dark = t ? (t === 'dark' || t === 'tablet') : matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.dataset.theme = 'dark';
  } catch (e) { /* light */ }
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'boardOwnerKey';
  var m = /^#ownerkey=([^&]+)$/.exec(location.hash);
  if (m) {
    try { localStorage.setItem(KEY, decodeURIComponent(m[1])); } catch (e) { /* not kept */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
  }
  function ownerKey() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  var next = new URLSearchParams(location.search).get('next') || '';
  if (!/^\/(?!\/)/.test(next) || next.indexOf('/account') === 0) next = '';
  if (next) $('go').setAttribute('href', next);

  function api(path, body, headers) {
    var h = headers || {};
    var o = { headers: h, credentials: 'same-origin', cache: 'no-store' };
    if (body !== undefined) { o.method = 'POST'; h['content-type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch(path, o).then(function (r) {
      return r.json().then(function (j) { j.http = r.status; return j; }, function () { return { http: r.status, error: 'The site gave an answer that could not be read (' + r.status + '). Try again.' }; });
    }, function () { return { http: 0, error: 'Could not reach the site. Check your connection and try again.' }; });
  }
  function say(text, bad) { var el = $('msg'); el.textContent = text || ''; el.hidden = !text; el.className = bad ? 'bad' : ''; }
  function show(id) { ['in', 'wait', 'forms'].forEach(function (s) { $(s).hidden = s !== id; }); }
  function busy(form, on) { Array.prototype.forEach.call(form.querySelectorAll('button'), function (b) { b.disabled = on; }); }
  function tab(up) {
    $('tabIn').setAttribute('aria-pressed', String(!up)); $('tabUp').setAttribute('aria-pressed', String(up));
    $('fUp').hidden = !up; $('fIn').hidden = up; $('fCode').hidden = true;
  }
  $('tabIn').onclick = function () { say(''); tab(false); };
  $('tabUp').onclick = function () { say(''); tab(true); };

  var triedOwner = false;
  var codeEmail = '';
  function askCode(email, note) { codeEmail = email; $('codeNote').textContent = note; $('fIn').hidden = true; $('fUp').hidden = true; $('fCode').hidden = false; $('inCode').value = ''; $('inCode').focus(); }
  function refresh(follow) {
    return api('/auth/me').then(function (me) {
      if (me.error) { say(me.error, true); show('forms'); return; }
      if (me.signedIn) {
        if (follow && next) { location.replace(next); return; }
        $('who').textContent = me.name === 'Owner' ? 'This is your owner device.' : 'Signed in as ' + me.name + '.';
        show('in');
      } else if (me.status === 'pending') {
        show('wait');
      } else {
        show('forms');
        if (me.status === 'elsewhere') say('This device was signed out because your account signed in on another device. Only one device can be signed in at a time. Sign in here to use this one instead.', true);
        else if (me.status === 'declined') { say('Your sign-up could not be confirmed: the details did not match. You can sign up again.', true); tab(true); }
        else if (!me.ready) say('Accounts are not set up on this site yet.', true);
        else if (location.hash === '#signup') tab(true);
      }
      if (ownerKey() && !me.signedIn && !triedOwner) {
        triedOwner = true;
        return api('/auth/owner', {}, { 'x-owner-key': ownerKey() }).then(function (r) { if (r.ok) return refresh(false); });
      }
    });
  }

  $('fIn').onsubmit = function (e) {
    e.preventDefault(); say(''); busy(this, true); var f = this;
    api('/auth/code', { email: $('inEmail').value }).then(function (r) {
      busy(f, false);
      if (r.error) { if (r.use === 'signup') { tab(true); $('upEmail').value = $('inEmail').value; } say(r.error, true); return; }
      askCode($('inEmail').value, 'A 6-digit code is on its way to your email. Give it a minute, and look in junk mail too.');
    });
  };
  $('back').onclick = function () { say(''); tab($('tabUp').getAttribute('aria-pressed') === 'true'); };
  $('fCode').onsubmit = function (e) {
    e.preventDefault(); say(''); busy(this, true); var f = this;
    api('/auth/verify', { email: codeEmail, code: $('inCode').value }).then(function (r) {
      busy(f, false);
      if (r.error) { say(r.error, true); return; }
      if (r.status === 'pending') { $('fUp').reset(); refresh(false).then(function () { say('Email confirmed. Your sign-up has been sent for approval.'); }); return; }
      if (next) location.replace(next); else location.replace('/');
    });
  };
  $('fUp').onsubmit = function (e) {
    e.preventDefault(); say(''); busy(this, true); var f = this;
    api('/auth/signup', { name: $('upName').value, email: $('upEmail').value, pin: $('upPin').value, hireDate: $('upHire').value }).then(function (r) {
      busy(f, false);
      if (r.error) { if (r.use === 'signin') { tab(false); $('inEmail').value = $('upEmail').value; } say(r.error, true); return; }
      askCode($('upEmail').value, 'Almost done: a 6-digit code was emailed to you to confirm your address. Enter it here. Give it a minute, and look in junk mail too.');
    });
  };
  function signOut() { api('/auth/logout', {}).then(function () { say(''); triedOwner = true; refresh(false); }); }
  $('out').onclick = signOut;
  $('out2').onclick = signOut;
  $('again').onclick = function () { say(''); refresh(true).then(function () { if (!$('wait').hidden) say('Not approved yet. Nothing more to do: it opens by itself once you are.'); }); };

  // The owner's list.
  function el(tag, text, cls) { var n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
  function day(ms) { return ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'never'; }
  function act(id, action, ask) {
    if (ask && !confirm(ask)) return;
    say('');
    api('/health/accounts', { id: id, action: action }, { 'x-owner-key': ownerKey() }).then(function (r) {
      if (r.error) say(r.error, true);
      else if (r.mail === 'sent') say('Done. They have been emailed.');
      else if (r.mail) say('Done, but the email did not go (' + (r.mail === 'cap' ? 'today\'s email allowance is used up' : r.mail === 'off' ? 'the email sender is not set up' : 'the Gmail script failed') + '). Let them know yourself.', true);
      else say('Done.');
      loadOwner();
    });
  }
  function person(u) {
    var box = el('div', undefined, 'person');
    box.appendChild(el('b', u.name));
    var dl = el('dl');
    function row(k, v) { dl.appendChild(el('dt', k)); dl.appendChild(el('dd', v)); }
    row('Email', u.email);
    if (u.status === 'pending') { row('PIN', u.pin || ''); row('Hire date', u.hireDate || ''); row('Asked', day(u.requestedAt)); }
    else if (u.status === 'approved') { row('Approved', day(u.approvedAt)); row('Last code sign-in', day(u.lastSignIn)); }
    else row('Status', u.status === 'declined' ? 'Declined ' + day(u.declinedAt) : 'Removed ' + day(u.removedAt));
    box.appendChild(dl);
    function btn(label, action, ask, plain) { var b = el('button', label, 'small' + (plain ? ' plain' : '')); b.type = 'button'; b.onclick = function () { act(u.id, action, ask); }; box.appendChild(b); }
    if (u.status === 'pending') { btn('Approve', 'approve'); btn('Decline', 'decline', 'Decline ' + u.name + '? They are emailed that the details did not match.', true); }
    else if (u.status === 'approved') btn('Remove access', 'remove', 'Remove ' + u.name + '? They are signed out everywhere and cannot sign up again unless you delete them from the list below.', true);
    else btn('Delete from list', 'delete', 'Delete ' + u.name + ' from the list? They could then sign up again.', true);
    return box;
  }
  function fill(id, list, none) { var box = $(id); box.textContent = ''; if (!list.length) box.appendChild(el('p', none, 'none')); list.forEach(function (u) { box.appendChild(person(u)); }); }
  function loadOwner() {
    if (!ownerKey()) return;
    api('/health/accounts', undefined, { 'x-owner-key': ownerKey() }).then(function (r) {
      $('owner').hidden = false;
      if (r.error) { $('ownerNote').textContent = r.http === 404 ? 'The owner key kept on this device was not accepted by the site.' : r.error; return; }
      $('ownerNote').textContent = 'Only this device sees this list. The site is ' + (r.lock ? 'LOCKED: only approved people get in.' : 'open to everyone (not locked yet).') + ' Emails sent today: ' + r.mailToday + ' of ' + r.mailMax + (r.mailReady ? '.' : '. The email sender is NOT set up.');
      fill('pending', r.users.filter(function (u) { return u.status === 'pending'; }), 'Nobody is waiting.');
      fill('approved', r.users.filter(function (u) { return u.status === 'approved'; }), 'Nobody yet.');
      fill('other', r.users.filter(function (u) { return u.status !== 'pending' && u.status !== 'approved'; }), 'Nobody.');
    });
  }

  refresh(true).then(loadOwner);
})();
</script>
</body>
</html>`;

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([watchChecker(env), pruneAskLog(env).catch(() => {})]));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const early = await accounts(request, env, url);
    if (early) return early;
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
    if (url.pathname === '/health/held186') return held186Settings(request, env);
    if (url.pathname === '/api/held186') return request.method === 'POST' ? held186Submit(request, env) : held186Ready(env);
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
    if (key.split('/').includes('..') || key.startsWith('subs/') || key.startsWith('status/') || key.startsWith('stats/') || key.startsWith('backups/') || key.startsWith('relay/') || key.startsWith('search/') || key.startsWith('ask/') || key.startsWith('settings/') || key.startsWith('accounts/')) return new Response('Not found', { status: 404 });

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
