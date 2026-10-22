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
  const bucket = fakeBucket({ 'index.html': '<p>page</p>', 'data/2026-09-01.json': 'old', 'subs/abc.json': '{"turns":["SR03"]}' });
  const r2 = { accountId: 'acct', bucket: 'board-site', keyId: 'KEY', secret: 'SECRET' };
  const sent = await deployR2({ dir, r2, fetchImpl: bucket.fetchImpl });
  assert.deepEqual(sent, { ok: true, uploaded: 1, removed: 1 });
  // Phones' alert subscriptions (subs/) are never touched by the site mirror.
  assert.deepEqual([...bucket.objects.keys()].sort(), ['data/index.json', 'index.html', 'subs/abc.json']);
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
  assert.deepEqual((await res.json()).prefs, { SR03: { lineup: false, ordered: true, onDuty: true, time: 60 } });
  assert.deepEqual(JSON.parse([...store.values()][0]).prefs.SR03.time, 60);
  res = await post({ subscription, turns: ['SR03', 'SD05'] });
  assert.deepEqual((await res.json()).prefs.SD05, { lineup: true, ordered: true, onDuty: true, time: 30 });
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
