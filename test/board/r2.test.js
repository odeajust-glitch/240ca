const test = require('node:test');
const assert = require('node:assert/strict');
const { signRequest } = require('../../lib/board/r2');

// AWS's published Signature V4 examples for S3 (R2 signs the same way).
test('R2 request signing matches the AWS SigV4 S3 examples', () => {
  const base = { host: 'examplebucket.s3.amazonaws.com', keyId: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1', now: new Date('2013-05-24T00:00:00Z') };
  const get = signRequest({ ...base, method: 'GET', path: '/test.txt', headers: { range: 'bytes=0-9' } });
  assert.match(get.headers.authorization, /SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/);
  const list = signRequest({ ...base, method: 'GET', path: '/', query: { 'max-keys': '2', prefix: 'J' } });
  assert.match(list.headers.authorization, /Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7$/);
  assert.equal(list.url, 'https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J');
});

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { deployR2 } = require('../../lib/board/r2');

// A fake R2 bucket speaking just enough of the S3 API.
function fakeBucket(start = {}) {
  const objects = new Map(Object.entries(start).map(([k, v]) => [k, Buffer.from(v)]));
  const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url);
    const method = opts.method || 'GET';
    calls.push(`${method} ${u.pathname}`);
    assert.match(opts.headers.authorization, /^AWS4-HMAC-SHA256 Credential=KEY\/\d{8}\/auto\/s3\/aws4_request/);
    assert.equal(u.host, 'acct.r2.cloudflarestorage.com');
    const key = decodeURIComponent(u.pathname.replace(/^\/board-site\/?/, ''));
    if (method === 'GET' && u.searchParams.get('list-type') === '2') {
      const items = [...objects].map(([k, b]) => `<Contents><Key>${k}</Key><ETag>&quot;${md5(b)}&quot;</ETag></Contents>`).join('');
      return { ok: true, status: 200, text: async () => `<ListBucketResult>${items}<IsTruncated>false</IsTruncated></ListBucketResult>` };
    }
    if (method === 'PUT') { objects.set(key, Buffer.from(opts.body)); return { ok: true, status: 200 }; }
    if (method === 'DELETE') { objects.delete(key); return { ok: true, status: 204 }; }
    return { ok: false, status: 400 };
  };
  return { objects, calls, fetchImpl };
}

test('R2 publish uploads only changed files and removes ones the site dropped', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-site-'));
  fs.mkdirSync(path.join(dir, 'data'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<p>page</p>');
  fs.writeFileSync(path.join(dir, 'data', 'index.json'), '{"days":[]}');
  const bucket = fakeBucket({ 'index.html': '<p>page</p>', 'data/2026-09-01.json': 'old', 'subs/abc.json': '{"turns":["SR03"]}', 'status/down.json': '{}' });
  const r2 = { accountId: 'acct', bucket: 'board-site', keyId: 'KEY', secret: 'SECRET' };
  const sent = await deployR2({ dir, r2, fetchImpl: bucket.fetchImpl });
  assert.deepEqual(sent, { ok: true, uploaded: 1, removed: 1 });
  // Phones' alert subscriptions (subs/) are never touched by the site mirror.
  assert.deepEqual([...bucket.objects.keys()].sort(), ['data/index.json', 'index.html', 'status/down.json', 'subs/abc.json']);
  assert.ok(bucket.calls.includes('PUT /board-site/data/index.json'));
  // Nothing changed: nothing goes up.
  assert.deepEqual(await deployR2({ dir, r2, fetchImpl: bucket.fetchImpl }), { ok: true, uploaded: 0, removed: 0 });
  // A refused key is reported, never thrown.
  const refused = await deployR2({ dir, r2, fetchImpl: async () => ({ ok: false, status: 403 }) });
  assert.equal(refused.ok, false);
  assert.match(refused.message, /R2_ACCESS_KEY_ID/);
});

// The Worker (cloudflare/board-worker.js) against a fake R2 binding.
test('the Cloudflare Worker serves the bucket read-only', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../cloudflare/board-worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
  const files = { 'index.html': ['<p>hi</p>', 'text/html; charset=utf-8'], 'data/index.json': ['{}', 'application/json'] };
  const obj = (k) => files[k] && { httpEtag: `"e-${k}"`, writeHttpMetadata: (h) => h.set('content-type', files[k][1]), body: files[k][0] };
  const env = { SITE: { head: async (k) => obj(k) || null, get: async (k) => obj(k) || null } };
  const get = (p, init) => worker.fetch(new Request(`https://board.x.workers.dev${p}`, init), env);

  let res = await get('/');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '<p>hi</p>');
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  res = await get('/data/index.json', { headers: { 'if-none-match': '"e-data/index.json"' } });
  assert.equal(res.status, 304);
  assert.equal((await get('/nope.json')).status, 404);
  assert.equal((await get('/index.html', { method: 'PUT', body: 'x' })).status, 405);
});

test('the Worker keeps turn-alert subscriptions and never serves them', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../cloudflare/board-worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
  const store = new Map();
  const env = { SITE: {
    put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
    head: async (k) => (store.has(k) ? { httpEtag: '"e"', writeHttpMetadata: () => {} } : null),
    get: async (k) => (store.has(k) ? { body: store.get(k) } : null),
  } };
  const post = (body) => worker.fetch(new Request('https://board.x.workers.dev/push/subscribe', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), env);
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BPk', auth: 'au' } };

  let res = await post({ subscription, turns: ['sr03', 'SD05', 'bad turn!', 'SR03'] });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).turns, ['SR03', 'SD05']);
  assert.equal(store.size, 1);
  const [key, saved] = [...store][0];
  assert.match(key, /^subs\/[0-9a-f]{64}\.json$/);
  assert.deepEqual(JSON.parse(saved).turns, ['SR03', 'SD05']);
  // Each turn's choices, cleaned up; missing ones are the defaults.
  res = await post({ subscription, turns: ['SR03'], prefs: { SR03: { lineup: false, ordered: true, onDuty: 'x', time: 60, evil: 1 } } });
  assert.deepEqual((await res.json()).prefs, { SR03: { lineup: false, ordered: true, onDuty: true, aheadRest: true, aheadBack: true, reset: true, position: true, rescue: true, mayCall: true, stale: false, time: 60, before: 0 } });
  assert.deepEqual(JSON.parse([...store.values()][0]).prefs.SR03.time, 60);
  res = await post({ subscription, turns: ['SR03', 'SD05'] });
  assert.deepEqual((await res.json()).prefs.SD05, { lineup: true, ordered: true, onDuty: true, aheadRest: true, aheadBack: true, reset: true, position: true, rescue: true, mayCall: true, stale: false, time: 30, before: 0 });
  // A followed person: '@' + a 16-hex hash (never a name); anything else isn't kept.
  res = await post({ subscription, turns: ['@0123456789ABCDEF', '@JUOD', 'SR03'] });
  assert.deepEqual((await res.json()).turns, ['@0123456789abcdef', 'SR03']);
  // One number, two turns: S501-CO / S501-EN.
  res = await post({ subscription, turns: ['s501-co', 'S501-EN', 'S501-XX'] });
  assert.deepEqual((await res.json()).turns, ['S501-CO', 'S501-EN']);
  // Never served, however it's asked for.
  for (const p of [`/${key}`, `/${key.replace('/', '%2F')}`, `//${key}`]) {
    assert.equal((await worker.fetch(new Request(`https://board.x.workers.dev${p}`), env)).status, 404, p);
  }
  // Not a push service, not JSON, or too big: refused.
  assert.equal((await post({ subscription: { ...subscription, endpoint: 'https://evil.example/x' }, turns: ['SR03'] })).status, 400);
  assert.equal((await post('nope')).status, 400);
  assert.equal((await post({ subscription, turns: ['SR03'], pad: 'x'.repeat(9000) })).status, 413);
  // No turns left: removed.
  res = await post({ subscription, turns: [] });
  assert.equal(res.status, 200);
  assert.equal(store.size, 0);
});

// Owner, 2026-10-22: alert my phone when the board checker stops checking.
test('the Worker alerts once when the checker is down, and once when it is back', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../cloudflare/board-worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
  const store = new Map();
  const obj = (k) => store.has(k) && { httpEtag: '"e"', writeHttpMetadata: () => {}, body: store.get(k), json: async () => JSON.parse(store.get(k)) };
  const env = { NTFY_TOPIC: 'my-topic', SITE: {
    get: async (k) => obj(k) || null, head: async (k) => obj(k) || null,
    put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  } };
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { sent.push([url, opts.headers.Title, opts.body]); return { ok: true }; };
  const run = async () => { let p; await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } }); await p; };
  try {
    const published = (minsAgo) => store.set('data/index.json', JSON.stringify({ generatedAt: new Date(Date.now() - minsAgo * 60000).toISOString() }));
    published(10); await run();
    assert.deepEqual(sent, []); // fine
    published(45); await run(); await run();
    assert.equal(sent.length, 1); // down: said once
    assert.equal(sent[0][0], 'https://ntfy.sh/my-topic');
    assert.equal(sent[0][1], 'Board checker is down');
    assert.match(sent[0][2], /No board check since .* \(45 min\)/);
    published(2); await run();
    assert.equal(sent.length, 2);
    assert.equal(sent[1][1], 'Board checker is back');
    assert.ok(!store.has('status/down.json'));
    // The note is never served.
    store.set('status/down.json', '{}');
    assert.equal((await worker.fetch(new Request('https://b.x.workers.dev/status/down.json'), env)).status, 404);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// Owner, 2026-11-01 (option B): how many times the page was opened each day,
// and on how many phones; nothing about who.
test('the Worker counts visits per day and never serves the files', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../cloudflare/board-worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
  const store = new Map();
  const env = { OWNER_EMAIL: 'odeajust@gmail.com', SITE: {
    put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
    head: async (k) => (store.has(k) ? { httpEtag: '"e"', writeHttpMetadata: () => {} } : null),
    get: async (k) => (store.has(k) ? { body: store.get(k), text: async () => store.get(k) } : null),
  } };
  const call = (p, init) => worker.fetch(new Request(`https://board.x.workers.dev${p}`, init), env);
  const owner = { headers: { 'cf-access-authenticated-user-email': 'odeajust@gmail.com' } };
  const hit = (phone) => call('/stats/hit', { method: 'POST', body: JSON.stringify({ phone }) });
  for (const phone of [true, false, false, true]) assert.equal((await hit(phone)).status, 200);
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  assert.deepEqual(JSON.parse(store.get(`stats/${day}.json`)), { opens: 4, phones: 2 });
  // The numbers: the owner only (owner, 2026-11-02); everyone's visits count.
  assert.equal((await call('/stats/days')).status, 404);
  assert.equal((await call('/stats/days', { headers: { 'cf-access-authenticated-user-email': 'someone@else.ca' } })).status, 404);
  const days = (await (await call('/stats/days', owner)).json()).days;
  assert.equal(days.length, 30);
  assert.deepEqual(days[0], { day, opens: 4, phones: 2 });
  assert.deepEqual(days[1].opens, 0);
  assert.equal((await call('/stats/hit')).status, 405);
  assert.equal((await call('/stats/hit', { method: 'POST', body: 'x'.repeat(300) })).status, 413);
  assert.equal((await call(`/stats/${day}.json`)).status, 404);
  assert.equal((await call('/backups/state/2026-11-02.zip')).status, 404); // the laptop's backups: never served
});

// Owner, 2026-11-02: the health line is only for the owner's email.
test('the Worker gives the health line only to the owner', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../cloudflare/board-worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
  const store = new Map([['status/health.json', JSON.stringify({ lastCheck: 1, phones: 4 })], ['status/down.json', JSON.stringify({ since: 1, alerted: 2 })]]);
  const env = { OWNER_EMAIL: 'Odeajust@gmail.com, other@x.ca', SITE: {
    head: async (k) => (store.has(k) ? { httpEtag: '"e"', writeHttpMetadata: () => {} } : null),
    get: async (k) => (store.has(k) ? { text: async () => store.get(k) } : null),
  } };
  const as = (email) => worker.fetch(new Request('https://board.x.workers.dev/health', { headers: email ? { 'cf-access-authenticated-user-email': email } : {} }), env);
  let res = await as('odeajust@gmail.com');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { laptop: { lastCheck: 1, phones: 4 }, down: { since: 1, alerted: 2 }, watch: null });
  assert.equal((await as('someone@else.ca')).status, 404);
  assert.equal((await as(null)).status, 404);
  assert.equal((await worker.fetch(new Request('https://board.x.workers.dev/health', { headers: { 'cf-access-authenticated-user-email': 'odeajust@gmail.com' } }), { ...env, OWNER_EMAIL: '' })).status, 404);
  // Never as a file.
  assert.equal((await as('odeajust@gmail.com').then(() => worker.fetch(new Request('https://board.x.workers.dev/status/health.json'), env))).status, 404);
});

// Owner, 2026-11-02: the health line didn't show; the Worker also reads the
// owner's email from Access's signed token, and /whoami says what it sees.
test('the Worker knows the owner from Access\'s signed token too', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../cloudflare/board-worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256' };
  const b64u = (x) => Buffer.from(x).toString('base64url');
  const iss = 'https://sarnia.cloudflareaccess.com';
  const token = (claims) => {
    const body = `${b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' }))}.${b64u(JSON.stringify({ iss, exp: Math.floor(Date.now() / 1000) + 3600, ...claims }))}`;
    return `${body}.${crypto.sign('sha256', Buffer.from(body), privateKey).toString('base64url')}`;
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => { assert.equal(String(u), `${iss}/cdn-cgi/access/certs`); return { json: async () => ({ keys: [jwk] }) }; };
  try {
    const env = { OWNER_EMAIL: 'odeajust@gmail.com', SITE: { get: async () => null, head: async () => null } };
    const ask = async (p, headers) => worker.fetch(new Request(`https://board.x.workers.dev${p}`, { headers }), env);
    let me = await (await ask('/whoami', { cookie: `a=1; CF_Authorization=${token({ email: 'Odeajust@gmail.com' })}` })).json();
    assert.deepEqual(me, { email: 'odeajust@gmail.com', via: 'token', ownerEmailSet: true, ownerKeySet: false, ownerKey: false, owner: true });
    assert.equal((await ask('/health', { 'cf-access-jwt-assertion': token({ email: 'odeajust@gmail.com' }) })).status, 200);
    // Someone else's token, a changed one, or none.
    assert.equal((await ask('/health', { 'cf-access-jwt-assertion': token({ email: 'someone@else.ca' }) })).status, 404);
    const forged = token({ email: 'someone@else.ca' }).split('.');
    forged[1] = b64u(JSON.stringify({ iss, exp: Math.floor(Date.now() / 1000) + 3600, email: 'odeajust@gmail.com' }));
    me = await (await ask('/whoami', { 'cf-access-jwt-assertion': forged.join('.') })).json();
    assert.deepEqual([me.email, me.owner], [null, false]);
    me = await (await ask('/whoami', {})).json();
    assert.deepEqual(me, { email: null, via: 'no sign-in token', ownerEmailSet: true, ownerKeySet: false, ownerKey: false, owner: false });
    me = await (await ask('/whoami', { 'cf-access-authenticated-user-email': 'odeajust@gmail.com' })).json();
    assert.equal(me.via, 'header');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// Owner, 2026-11-02: "leave the site open" (no email login): the owner's
// phone sends the OWNER_KEY instead.
test('the Worker knows the owner by the owner key', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../cloudflare/board-worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
  const store = new Map([['status/health.json', '{"phones":4}']]);
  const env = { OWNER_KEY: 'tr41n-B0ard-k3y-2026', SITE: { get: async (k) => (store.has(k) ? { text: async () => store.get(k) } : null), head: async () => null } };
  const ask = (p, key) => worker.fetch(new Request(`https://board.x.workers.dev${p}`, { headers: key ? { 'x-owner-key': key } : {} }), env);
  assert.equal((await ask('/health', 'tr41n-B0ard-k3y-2026')).status, 200);
  assert.equal((await ask('/stats/days', 'tr41n-B0ard-k3y-2026')).status, 200);
  for (const k of [null, 'wrong', 'tr41n-B0ard-k3y-2027', 'tr41n-B0ard-k3y-2026x']) assert.equal((await ask('/health', k)).status, 404, String(k));
  const me = await (await ask('/whoami', 'tr41n-B0ard-k3y-2026')).json();
  assert.deepEqual([me.ownerKeySet, me.ownerKey, me.owner], [true, true, true]);
  // Too short a key is never accepted.
  const weak = await worker.fetch(new Request('https://board.x.workers.dev/health', { headers: { 'x-owner-key': 'short' } }), { ...env, OWNER_KEY: 'short' });
  assert.equal(weak.status, 404);
});

// Owner, 2026-11-03: every phone with turn alerts hears when the checker
// has been down 3 h+ (and when it's back), sent by the Worker itself.
test('the Worker pushes "down 3 h" and "back" to every phone, readable by the phone', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../cloudflare/board-worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
  const { loadOrCreateKeys } = require('../../lib/board/webpush');
  const keys = loadOrCreateKeys(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vk-')), 'push-keys.json'));
  // A phone: its own key pair and auth secret.
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/phone1', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') }, turns: ['SR03'] };
  const gone = { ...sub, endpoint: 'https://fcm.googleapis.com/fcm/send/gone' };
  const store = new Map([['subs/a.json', JSON.stringify(sub)], ['subs/b.json', JSON.stringify(gone)]]);
  const setIndex = (minsAgo) => store.set('data/index.json', JSON.stringify({ generatedAt: new Date(Date.now() - minsAgo * 60000).toISOString() }));
  const obj = (k) => store.has(k) && { text: async () => store.get(k), json: async () => JSON.parse(store.get(k)), httpEtag: '"e"', writeHttpMetadata: () => {} };
  const env = { VAPID_KEYS: JSON.stringify(keys), NTFY_TOPIC: 'me', SITE: {
    get: async (k) => obj(k) || null, head: async (k) => obj(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
    list: async ({ prefix }) => ({ objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
  } };
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => { sent.push({ url: String(url), init }); return { ok: !String(url).endsWith('/gone'), status: String(url).endsWith('/gone') ? 410 : 201 }; };
  const run = async () => { let p; await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } }); await p; };
  // What the phone would read.
  const open = (body) => {
    const b = Buffer.from(body);
    const salt = b.subarray(0, 16);
    const as = b.subarray(21, 21 + b[20]);
    const secret = ua.computeSecret(as);
    const h = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
    const prk = h(salt, h(h(auth, secret), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), as, Buffer.from([1])])));
    const cek = h(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
    const nonce = h(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
    const rest = b.subarray(21 + b[20]);
    const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
    d.setAuthTag(rest.subarray(rest.length - 16));
    const plain = Buffer.concat([d.update(rest.subarray(0, rest.length - 16)), d.final()]);
    return JSON.parse(plain.subarray(0, plain.length - 1).toString());
  };
  try {
    setIndex(100); // 1 h 40 m: the owner's ntfy, no phones yet
    await run();
    assert.deepEqual(sent.map((x) => x.url), ['https://ntfy.sh/me']);
    sent.length = 0;
    setIndex(185); // 3 h+: every phone
    await run();
    const push = sent.find((x) => x.url.endsWith('/phone1'));
    assert.ok(push);
    const msg = open(push.init.body);
    assert.equal(msg.title, 'Board checker down');
    assert.match(msg.body, /^No board check since .* \(3 h\)\. The board and turn alerts are out of date; check CATS yourself\.$/);
    // Signed with the board checker's own key (the one phones subscribed with).
    const [, t, k] = /^vapid t=(\S+), k=(\S+)$/.exec(push.init.headers.authorization);
    assert.equal(k, keys.publicKey);
    const [h64, c64, s64] = t.split('.');
    const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: keys.privateJwk.x, y: keys.privateJwk.y }, format: 'jwk' });
    assert.ok(crypto.verify('sha256', Buffer.from(`${h64}.${c64}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(s64, 'base64url')));
    assert.equal(JSON.parse(Buffer.from(c64, 'base64url')).aud, 'https://fcm.googleapis.com');
    assert.ok(!store.has('subs/b.json')); // that phone unsubscribed: dropped
    assert.deepEqual(JSON.parse(store.get('status/down.json')).phones, { sent: 1, failed: 0, dropped: 1 });
    sent.length = 0;
    await run(); // still down: not sent again
    assert.equal(sent.length, 0);
    setIndex(3); // back
    await run();
    assert.deepEqual(sent.map((x) => x.url), ['https://ntfy.sh/me', 'https://fcm.googleapis.com/fcm/send/phone1']);
    assert.equal(open(sent[1].init.body).title, 'Board checker back');
    assert.ok(!store.has('status/down.json'));
  } finally {
    globalThis.fetch = realFetch;
  }
});

// Owner, 2026-11-03: "a page notification like everyone gets at 3 hours, but
// just to me": after 1 h, only the phones following JUOD; "back" to them too.
test('the Worker pushes "down 1 h" only to the owner\'s phones', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../cloudflare/board-worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
  const { loadOrCreateKeys } = require('../../lib/board/webpush');
  const { personHash } = require('../../lib/board/people');
  const keys = loadOrCreateKeys(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vk-')), 'push-keys.json'));
  const phone = (name, turns) => {
    const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
    return JSON.stringify({ endpoint: `https://fcm.googleapis.com/fcm/send/${name}`, keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') }, turns });
  };
  const store = new Map([['subs/a.json', phone('mine', ['SR03', `@${personHash('JUOD')}`])], ['subs/b.json', phone('theirs', ['SR03', `@${personHash('EN03')}`])]]);
  const setIndex = (minsAgo) => store.set('data/index.json', JSON.stringify({ generatedAt: new Date(Date.now() - minsAgo * 60000).toISOString() }));
  const obj = (k) => store.has(k) && { text: async () => store.get(k), json: async () => JSON.parse(store.get(k)), httpEtag: '"e"', writeHttpMetadata: () => {} };
  const env = { VAPID_KEYS: JSON.stringify(keys), SITE: {
    get: async (k) => obj(k) || null, head: async (k) => obj(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
    list: async ({ prefix }) => ({ objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
  } };
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { sent.push(String(url).split('/').pop()); return { ok: true, status: 201 }; };
  const run = async () => { let p; await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } }); await p; };
  try {
    setIndex(40); await run();
    assert.deepEqual(sent, []); // 40 min: no phones (and no ntfy topic set)
    assert.equal(JSON.parse(store.get('status/watch.json')).ntfy, false); // Page Health: the timer ran
    setIndex(65); await run(); await run();
    assert.deepEqual(sent, ['mine']); // 1 h: only the owner's phone, once
    assert.deepEqual(JSON.parse(store.get('status/down.json')).ownerPhones, { sent: 1, failed: 0, dropped: 0 });
    sent.length = 0;
    setIndex(185); await run();
    assert.deepEqual(sent.sort(), ['mine', 'theirs']); // 3 h: everyone
    sent.length = 0;
    setIndex(2); await run();
    assert.deepEqual(sent.sort(), ['mine', 'theirs']); // back: everyone told it was down
    // Back before 3 h: only the owner hears "back".
    sent.length = 0;
    setIndex(70); await run();
    setIndex(2); await run();
    assert.deepEqual(sent, ['mine', 'mine']);
    assert.ok(!store.has('status/down.json'));
    // Someone else as the owner (OWNER_CODE).
    sent.length = 0;
    env.OWNER_CODE = 'en03';
    setIndex(70); await run();
    assert.deepEqual(sent, ['theirs']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// Owner, 2026-11-03: the RailroadTracker relay moved from Render to the Worker.
test('the Worker relays the latest board check to the app, with the key', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../../cloudflare/board-worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
  const store = new Map();
  const obj = (k) => store.has(k) && { httpEtag: '"e"', writeHttpMetadata: () => {}, body: store.get(k), text: async () => store.get(k) };
  const env = { BOARD_KEY: 'k'.repeat(24), SITE: { get: async (k) => obj(k) || null, head: async (k) => obj(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } } };
  const call = (p, init = {}, key = env.BOARD_KEY) => worker.fetch(new Request(`https://board.x.workers.dev${p}`, { ...init, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' } }), env);
  const check = { checkedAt: '2026-11-03T10:00:00Z', me: ['SR03: 5th up'], report: 'text', changes: [], mine: { turn: 'SR03', state: 'waiting', ahead: ['SR05'], myRestUntil: null }, extra: 'dropped' };
  assert.equal((await call('/api/board/latest')).status, 204);
  let res = await call('/api/board', { method: 'POST', body: JSON.stringify(check) });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, checkedAt: '2026-11-03T10:00:00.000Z' });
  const latest = await (await call('/api/board/latest')).json();
  assert.equal(latest.mine.turn, 'SR03');
  assert.equal(latest.extra, undefined);
  // An older check arriving late doesn't replace it.
  await call('/api/board', { method: 'POST', body: JSON.stringify({ ...check, checkedAt: '2026-11-03T09:00:00Z', me: ['old'] }) });
  assert.deepEqual((await (await call('/api/board/latest')).json()).me, ['SR03: 5th up']);
  // Wrong key, no key on the Worker, or a bad check.
  assert.equal((await call('/api/board/latest', {}, 'wrong')).status, 404);
  assert.equal((await worker.fetch(new Request('https://board.x.workers.dev/api/board/latest', { headers: { authorization: 'Bearer x' } }), { ...env, BOARD_KEY: '' })).status, 404);
  assert.equal((await call('/api/board', { method: 'POST', body: JSON.stringify({ ...check, me: 'nope' }) })).status, 400);
  // Never served as a file.
  assert.equal((await worker.fetch(new Request('https://board.x.workers.dev/relay/board-latest.json'), env)).status, 404);
});
