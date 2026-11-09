const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Owner, 2026-11-09: accounts built into the site, each approved by hand.
const OWNER_KEY = 'owner-key-0123456789';
async function setup(extra = {}) {
  const src = fs.readFileSync(path.join(__dirname, '../../cloudflare/board-worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
  const store = new Map([['index.html', '<p>board</p>'], ['data/index.json', '{}'], ['board-sw.js', '//sw']]);
  const obj = (k) => (store.has(k) ? { httpEtag: '"e"', writeHttpMetadata: () => {}, body: store.get(k) } : null);
  const env = { OWNER_KEY, MAIL_SCRIPT_URL: 'https://script.example/exec', MAIL_SCRIPT_KEY: 'mk', NTFY_TOPIC: 'topic', SITE_URL: 'https://board.example', ...extra, SITE: {
    get: async (k) => obj(k), head: async (k) => obj(k),
    put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
    list: async ({ prefix }) => ({ objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
  } };
  const mails = [];
  const pings = [];
  const fetchStub = async (url, opts) => {
    if (String(url).startsWith('https://ntfy.sh/')) { pings.push(opts.body); return { ok: true }; }
    mails.push(JSON.parse(opts.body));
    return { ok: true, text: async () => '{"ok":true}' };
  };
  const call = async (p, { body, cookie, key, html, ip = '1.1.1.1' } = {}) => {
    const headers = { 'cf-connecting-ip': ip };
    if (cookie) headers.cookie = cookie;
    if (key) headers['x-owner-key'] = key;
    if (html) headers.accept = 'text/html,application/xhtml+xml';
    const real = globalThis.fetch;
    globalThis.fetch = fetchStub;
    try {
      return await worker.fetch(new Request(`https://board.x.workers.dev${p}`, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers }), env);
    } finally { globalThis.fetch = real; }
  };
  const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];
  return { env, store, mails, pings, call, cookieOf };
}
const person = (n) => ({ name: `Pat Example ${n}`, email: `pat${n}@example.com`, pin: '123456', hireDate: '2015-06-01' });

test('unlocked, the site is open, the account page works and account files are never served', async () => {
  const { call, store } = await setup();
  assert.equal((await call('/')).status, 200);
  let res = await call('/account');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Send for approval/);
  res = await call('/auth/me');
  assert.deepEqual(await res.json(), { ready: true, mailReady: true, lock: false, notice: false, signedIn: false, status: null, name: null });
  res = await call('/auth/signup', { body: person('a') });
  assert.equal(res.status, 200);
  const key = [...store.keys()].find((k) => k.startsWith('accounts/users/'));
  assert.ok(key);
  assert.equal((await call(`/${key}`)).status, 404);
});

test('locked: strangers go to the sign-in page, a sign-up waits, and approval lets that device in', async () => {
  const { call, cookieOf, store, mails, pings } = await setup({ LOCK: 'on' });
  let res = await call('/?x=1', { html: true });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/account?next=%2F%3Fx%3D1');
  assert.equal((await call('/data/index.json')).status, 401);
  assert.equal((await call('/health')).status, 401);
  assert.equal((await call('/board-sw.js')).status, 200);
  assert.equal((await call('/account')).status, 200);
  assert.equal((await call('/data/index.json', { key: OWNER_KEY })).status, 200);
  assert.equal((await call('/data/index.json', { cookie: 'bsess=eyJ1Ijoib3duZXIifQ.AAAA' })).status, 401);

  // Bad details are turned back with a reason.
  assert.equal((await call('/auth/signup', { body: { ...person('b'), pin: 'abc' } })).status, 400);
  assert.equal((await call('/auth/signup', { body: { ...person('b'), hireDate: '2999-01-01' } })).status, 400);
  assert.equal((await call('/auth/signup', { body: { ...person('b'), email: 'nope' } })).status, 400);

  res = await call('/auth/signup', { body: person('b') });
  assert.equal(res.status, 200);
  const cookie = cookieOf(res);
  assert.match(cookie, /^bsess=/);
  assert.match(res.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(pings.length, 1);
  assert.doesNotMatch(pings[0], /Pat|123456/);
  assert.equal((await (await call('/auth/me', { cookie })).json()).status, 'pending');
  assert.equal((await call('/data/index.json', { cookie })).status, 401);
  // The same email again: the same answer, but no way in and nothing changed.
  res = await call('/auth/signup', { body: { ...person('b'), name: 'Someone Else' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('set-cookie'), null);
  // No sign-in code for someone not approved yet.
  assert.equal((await call('/auth/code', { body: { email: 'patb@example.com' } })).status, 200);
  assert.equal(mails.length, 0);

  // Only the owner key sees the list (not an Access email header).
  assert.equal((await call('/health/accounts')).status, 404);
  assert.equal((await call('/health/accounts', { cookie })).status, 404);
  res = await call('/health/accounts', { key: OWNER_KEY });
  const list = await res.json();
  assert.equal(list.lock, true);
  assert.equal(list.users.length, 1);
  const u = list.users[0];
  assert.deepEqual([u.name, u.email, u.pin, u.hireDate, u.status, u.key], ['Pat Example b', 'patb@example.com', '123456', '2015-06-01', 'pending', undefined]);

  res = await call('/health/accounts', { key: OWNER_KEY, body: { id: u.id, action: 'approve' } });
  assert.deepEqual(await res.json(), { ok: true, mail: 'sent' });
  assert.equal(mails[0].to, 'patb@example.com');
  assert.match(mails[0].body, /https:\/\/board\.example\/account/);
  const saved = JSON.parse(store.get(`accounts/users/${u.id}.json`));
  assert.equal(saved.status, 'approved');
  assert.equal(saved.pin, undefined);
  assert.equal(saved.hireDate, undefined);
  assert.equal((await call('/data/index.json', { cookie })).status, 200);
  assert.equal((await call('/', { cookie, html: true })).status, 200);
  assert.equal((await (await call('/auth/me', { cookie })).json()).signedIn, true);
  // A cookie that's been altered is no cookie.
  assert.equal((await call('/data/index.json', { cookie: `${cookie.slice(0, -2)}xx` })).status, 401);

  // Another device: a code by email.
  res = await call('/auth/code', { body: { email: 'PatB@example.com ' } });
  assert.equal(res.status, 200);
  assert.equal(mails.length, 2);
  const code = /code is (\d{6})/.exec(mails[1].body)[1];
  assert.equal((await call('/auth/verify', { body: { email: 'patb@example.com', code: code === '000000' ? '000001' : '000000' } })).status, 400);
  res = await call('/auth/verify', { body: { email: 'patb@example.com', code } });
  assert.equal(res.status, 200);
  const second = cookieOf(res);
  assert.equal((await call('/data/index.json', { cookie: second })).status, 200);
  assert.equal((await call('/auth/verify', { body: { email: 'patb@example.com', code } })).status, 400); // once only
  // A second code within the minute isn't sent.
  await call('/auth/code', { body: { email: 'patb@example.com' } });
  assert.equal(mails.length, 2);
  // Unknown email: the same answer, no email.
  assert.equal((await call('/auth/code', { body: { email: 'nobody@example.com' } })).status, 200);
  assert.equal(mails.length, 2);

  // Removed: out on every device at once, and can't sign up again.
  res = await call('/health/accounts', { key: OWNER_KEY, body: { id: u.id, action: 'remove' } });
  assert.equal(res.status, 200);
  assert.equal((await call('/data/index.json', { cookie })).status, 401);
  assert.equal((await call('/data/index.json', { cookie: second })).status, 401);
  res = await call('/auth/signup', { body: person('b') });
  assert.equal(res.headers.get('set-cookie'), null);
  assert.equal((await call('/health/accounts', { key: OWNER_KEY, body: { id: u.id, action: 'approve' } })).status, 409);
  assert.equal((await call('/health/accounts', { key: OWNER_KEY, body: { id: u.id, action: 'delete' } })).status, 200);
  assert.equal(store.has(`accounts/users/${u.id}.json`), false);
});

test('a declined sign-up loses its details and can try again; the owner key signs the owner in', async () => {
  const { call, cookieOf, store, mails } = await setup({ LOCK: 'on' });
  let res = await call('/auth/signup', { body: person('c') });
  const first = cookieOf(res);
  const { users } = await (await call('/health/accounts', { key: OWNER_KEY })).json();
  const id = users.find((x) => x.email === 'patc@example.com').id;
  res = await call('/health/accounts', { key: OWNER_KEY, body: { id, action: 'decline' } });
  assert.equal((await res.json()).mail, 'sent');
  assert.match(mails[0].subject, /couldn't be confirmed/);
  assert.equal(JSON.parse(store.get(`accounts/users/${id}.json`)).pin, undefined);
  assert.equal((await (await call('/auth/me', { cookie: first })).json()).status, 'declined');
  res = await call('/auth/signup', { body: { ...person('c'), pin: '654321' } });
  const again = cookieOf(res);
  assert.match(again, /^bsess=/);
  assert.equal(JSON.parse(store.get(`accounts/users/${id}.json`)).pin, '654321');
  await call('/health/accounts', { key: OWNER_KEY, body: { id, action: 'approve' } });
  assert.equal((await call('/data/index.json', { cookie: again })).status, 200);
  assert.equal((await call('/data/index.json', { cookie: first })).status, 401); // the old try's cookie stays dead

  assert.equal((await call('/auth/owner', { body: {} })).status, 404);
  res = await call('/auth/owner', { body: {}, key: OWNER_KEY });
  assert.equal(res.status, 200);
  assert.equal((await call('/', { cookie: cookieOf(res), html: true })).status, 200);

  // Five sign-ups a day from one address.
  for (let i = 0; i < 3; i++) await call('/auth/signup', { body: person(`d${i}`) });
  assert.equal((await call('/auth/signup', { body: person('d9') })).status, 429);
  assert.equal((await call('/auth/signup', { body: person('d9'), ip: '2.2.2.2' })).status, 200);
});
