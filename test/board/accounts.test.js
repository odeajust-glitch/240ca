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
const codeIn = (mails) => /code is (\d{6})/.exec(mails[mails.length - 1].body)[1];
const person = (n) => ({ name: `Pat Example ${n}`, email: `pat${n}@example.com`, pin: '123456', hireDate: '2015-06-01' });

test('unlocked, the site is open, the account page works and account files are never served', async () => {
  const { call, store } = await setup();
  assert.equal((await call('/')).status, 200);
  let res = await call('/account');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Send for approval/);
  res = await call('/auth/me');
  assert.deepEqual(await res.json(), { ready: true, mailReady: true, lock: false, notice: false, signedIn: false, status: null, name: null, email: null, role: null });
  res = await call('/auth/signup', { body: person('a') });
  assert.equal(res.status, 200);
  assert.doesNotMatch(await (await call('/account')).text(), /Sarnia|CN |employee/i);
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
  assert.equal(res.headers.get('set-cookie'), null);
  // Not on the owner's list, and no alert, until the email is confirmed.
  assert.equal((await (await call('/health/accounts', { key: OWNER_KEY })).json()).users.length, 0);
  assert.equal(pings.length, 0);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'patb@example.com');
  assert.doesNotMatch(JSON.stringify(mails[0]), /Sarnia|CN /);
  res = await call('/auth/verify', { body: { email: 'patb@example.com', code: codeIn(mails) } });
  assert.deepEqual(await res.json(), { ok: true, status: 'pending' });
  const cookie = cookieOf(res);
  assert.match(cookie, /^bsess=/);
  assert.match(res.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(pings.length, 1);
  assert.doesNotMatch(pings[0], /Pat|123456/);
  assert.equal((await (await call('/auth/me', { cookie })).json()).status, 'pending');
  assert.equal((await call('/data/index.json', { cookie })).status, 401);
  // The same email again: told why, no way in and nothing changed.
  res = await call('/auth/signup', { body: { ...person('b'), name: 'Someone Else' } });
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /waiting for approval/);
  assert.equal(res.headers.get('set-cookie'), null);
  // No sign-in code for someone not approved yet, and the page says so.
  res = await call('/auth/code', { body: { email: 'patb@example.com' } });
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /waiting for approval/);
  assert.equal(mails.length, 1);

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
  assert.equal(mails[1].to, 'patb@example.com');
  assert.match(mails[1].body, /https:\/\/board\.example\/account/);
  store.delete(`accounts/codes/${u.id}.json`); // (a minute later)
  const saved = JSON.parse(store.get(`accounts/users/${u.id}.json`));
  assert.equal(saved.status, 'approved');
  assert.equal(saved.pin, undefined);
  assert.equal(saved.hireDate, undefined);
  assert.equal((await call('/data/index.json', { cookie })).status, 200);
  assert.equal((await call('/', { cookie, html: true })).status, 200);
  const me = await (await call('/auth/me', { cookie })).json();
  assert.deepEqual([me.signedIn, me.name, me.email, me.role], [true, 'Pat Example b', 'patb@example.com', 'member']);
  // A cookie that's been altered is no cookie.
  assert.equal((await call('/data/index.json', { cookie: `${cookie.slice(0, -2)}xx` })).status, 401);

  // Another device: a code by email.
  res = await call('/auth/code', { body: { email: 'PatB@example.com ' } });
  assert.equal(res.status, 200);
  assert.equal(mails.length, 3);
  const code = codeIn(mails);
  assert.equal((await call('/auth/verify', { body: { email: 'patb@example.com', code: code === '000000' ? '000001' : '000000' } })).status, 400);
  res = await call('/auth/verify', { body: { email: 'patb@example.com', code } });
  assert.equal(res.status, 200);
  const second = cookieOf(res);
  assert.equal((await call('/data/index.json', { cookie: second })).status, 200);
  // One device at a time: the first one is signed out, and told why.
  assert.equal((await call('/data/index.json', { cookie })).status, 401);
  const out = await (await call('/auth/me', { cookie })).json();
  assert.deepEqual([out.signedIn, out.status, out.name, out.email], [false, 'elsewhere', null, null]);
  assert.equal((await call('/auth/verify', { body: { email: 'patb@example.com', code } })).status, 400); // once only
  // A second code within the minute isn't sent, and the page says so.
  res = await call('/auth/code', { body: { email: 'patb@example.com' } });
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /less than a minute ago/);
  assert.equal(mails.length, 3);
  // Unknown email: sent to Sign up, no email.
  res = await call('/auth/code', { body: { email: 'nobody@example.com' } });
  assert.deepEqual([res.status, (await res.json()).use], [404, 'signup']);
  assert.equal(mails.length, 3);

  // Removed: out on every device at once, and can't sign up again.
  res = await call('/health/accounts', { key: OWNER_KEY, body: { id: u.id, action: 'remove' } });
  assert.equal(res.status, 200);
  assert.equal((await call('/data/index.json', { cookie })).status, 401);
  assert.equal((await call('/data/index.json', { cookie: second })).status, 401);
  res = await call('/auth/signup', { body: person('b') });
  assert.equal(res.status, 409);
  assert.equal(res.headers.get('set-cookie'), null);
  assert.equal((await call('/auth/code', { body: { email: 'patb@example.com' } })).status, 404);
  assert.equal((await call('/health/accounts', { key: OWNER_KEY, body: { id: u.id, action: 'approve' } })).status, 409);
  assert.equal((await call('/health/accounts', { key: OWNER_KEY, body: { id: u.id, action: 'delete' } })).status, 200);
  assert.equal(store.has(`accounts/users/${u.id}.json`), false);
});

test('a declined sign-up loses its details and can try again; the owner key signs the owner in', async () => {
  const { call, cookieOf, store, mails } = await setup({ LOCK: 'on' });
  const join = async (body, ip) => {
    const r = await call('/auth/signup', { body, ip });
    if (r.status !== 200) return r;
    const id0 = [...store.keys()].find((k) => k.startsWith('accounts/users/') && JSON.parse(store.get(k)).email === body.email).slice(15, -5);
    const out = await call('/auth/verify', { body: { email: body.email, code: codeIn(mails) } });
    store.delete(`accounts/codes/${id0}.json`);
    return out;
  };
  let res = await join(person('c'));
  const first = cookieOf(res);
  const { users } = await (await call('/health/accounts', { key: OWNER_KEY })).json();
  const id = users.find((x) => x.email === 'patc@example.com').id;
  res = await call('/health/accounts', { key: OWNER_KEY, body: { id, action: 'decline' } });
  assert.equal((await res.json()).mail, 'sent');
  assert.match(mails[mails.length - 1].subject, /couldn't be confirmed/);
  assert.equal(JSON.parse(store.get(`accounts/users/${id}.json`)).pin, undefined);
  assert.equal((await (await call('/auth/me', { cookie: first })).json()).status, 'declined');
  res = await join({ ...person('c'), pin: '654321' });
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

  // Forty sign-ups a day from one address.
  for (let i = 0; i < 38; i++) await call('/auth/signup', { body: person(`d${i}`) });
  assert.equal((await call('/auth/signup', { body: person('dz') })).status, 429);
  assert.equal((await call('/auth/signup', { body: person('dz'), ip: '2.2.2.2' })).status, 200);
});

test('an Admin approves and removes members; only the owner key makes or removes an Admin', async () => {
  const { call, cookieOf, store, mails } = await setup({ LOCK: 'on' });
  const join = async (n, ip) => {
    const body = person(n);
    await call('/auth/signup', { body, ip });
    const res = await call('/auth/verify', { body: { email: body.email, code: codeIn(mails) } });
    const { users } = await (await call('/health/accounts', { key: OWNER_KEY })).json();
    return { cookie: cookieOf(res), id: users.find((u) => u.email === body.email).id };
  };
  const act = (who, id, action, extra = {}) => call('/health/accounts', { ...who, body: { id, action, ...extra } });
  const owner = { key: OWNER_KEY };
  const a = await join('e1', '3.3.3.1');
  const b = await join('e2', '3.3.3.2');
  await act(owner, a.id, 'approve');
  const helper = { cookie: a.cookie };
  // A plain member sees no list and can't make themselves an Admin.
  assert.equal((await call('/health/accounts', helper)).status, 404);
  assert.equal((await act(helper, a.id, 'role', { role: 'admin' })).status, 404);
  assert.equal((await act(owner, a.id, 'role', { role: 'admin' })).status, 200);
  assert.equal((await (await call('/auth/me', helper)).json()).role, 'admin');
  let list = await (await call('/health/accounts', helper)).json();
  assert.equal(list.you, 'admin');
  assert.equal(list.users.find((u) => u.id === a.id).role, 'admin');
  // The Admin approves the other sign-up, but can't hand out Admin.
  assert.equal((await act(helper, b.id, 'approve')).status, 200);
  assert.equal((await act(helper, b.id, 'role', { role: 'admin' })).status, 403);
  assert.equal((await act(owner, b.id, 'role', { role: 'admin' })).status, 200);
  assert.equal((await act(helper, b.id, 'remove')).status, 403); // one Admin can't remove another
  assert.equal((await act(owner, b.id, 'role', { role: 'member' })).status, 200);
  assert.equal((await act(helper, b.id, 'remove')).status, 200);
  assert.equal((await call('/data/index.json', { cookie: b.cookie })).status, 401);
  // An Admin may be signed in on more than one device.
  store.delete(`accounts/codes/${a.id}.json`);
  await call('/auth/code', { body: { email: 'pate1@example.com' } });
  const other = cookieOf(await call('/auth/verify', { body: { email: 'pate1@example.com', code: codeIn(mails) } }));
  assert.equal((await call('/data/index.json', { cookie: other })).status, 200);
  assert.equal((await call('/data/index.json', helper)).status, 200);
  // Removed Admin: no list any more.
  assert.equal((await act(owner, a.id, 'remove')).status, 200);
  assert.equal((await call('/health/accounts', helper)).status, 404);
  assert.equal(JSON.parse(store.get(`accounts/users/${a.id}.json`)).role, 'member');
});

// Owner, 2026-11-10: members vanished. The laptop's site update deletes what
// isn't a site file, and accounts/ wasn't on its keep list.
test('the laptop site update never deletes account files', async () => {
  const os = require('os');
  const crypto = require('crypto');
  const { deployR2, KEEP_PREFIXES } = require('../../lib/board/r2');
  assert.ok(KEEP_PREFIXES.includes('accounts/'));
  const objects = new Map(Object.entries({ 'accounts/users/abc.json': '{}', 'accounts/codes/abc.json': '{}', 'old.html': 'x' }).map(([k, v]) => [k, Buffer.from(v)]));
  const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url);
    const method = opts.method || 'GET';
    const key = decodeURIComponent(u.pathname.replace(/^\/board-site\/?/, ''));
    if (method === 'GET' && u.searchParams.get('list-type') === '2') {
      const items = [...objects].map(([k, b]) => `<Contents><Key>${k}</Key><ETag>&quot;${md5(b)}&quot;</ETag></Contents>`).join('');
      return { ok: true, status: 200, text: async () => `<ListBucketResult>${items}<IsTruncated>false</IsTruncated></ListBucketResult>` };
    }
    if (method === 'PUT') { objects.set(key, Buffer.from(opts.body)); return { ok: true, status: 200 }; }
    if (method === 'DELETE') { objects.delete(key); return { ok: true, status: 204 }; }
    return { ok: false, status: 400 };
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<p>hi</p>');
  await deployR2({ dir, r2: { accountId: 'acct', bucket: 'board-site', keyId: 'KEY', secret: 'S' }, fetchImpl });
  assert.deepEqual([...objects.keys()].sort(), ['accounts/codes/abc.json', 'accounts/users/abc.json', 'index.html']);
});

// Owner, 2026-11-10: approved in one window, the other still said "Not
// approved yet". Another copy of the Worker had remembered the waiting state.
test('an approval made elsewhere lets a waiting device in at once', async () => {
  const { call, cookieOf, store, mails } = await setup({ LOCK: 'on' });
  const body = person('f1');
  await call('/auth/signup', { body, ip: '4.4.4.1' });
  const cookie = cookieOf(await call('/auth/verify', { body: { email: body.email, code: codeIn(mails) } }));
  assert.equal((await (await call('/auth/me', { cookie })).json()).status, 'pending');
  // Approved by another copy of the Worker: only the stored file changes.
  const key = [...store.keys()].find((k) => k.startsWith('accounts/users/') && JSON.parse(store.get(k)).email === body.email);
  store.set(key, JSON.stringify({ ...JSON.parse(store.get(key)), status: 'approved' }));
  assert.equal((await (await call('/auth/me', { cookie })).json()).signedIn, true);
  assert.equal((await call('/data/index.json', { cookie })).status, 200);
  // Made an Admin by another copy of the Worker: seen on the next look.
  assert.equal((await (await call('/auth/me', { cookie })).json()).role, 'member');
  store.set(key, JSON.stringify({ ...JSON.parse(store.get(key)), role: 'admin' }));
  assert.equal((await (await call('/auth/me', { cookie })).json()).role, 'admin');
  assert.equal((await call('/health/accounts', { cookie })).status, 200);
  store.set(key, JSON.stringify({ ...JSON.parse(store.get(key)), role: 'member' }));
  assert.equal((await call('/health/accounts', { cookie })).status, 404);
});

// Owner, 2026-11-10: "every 30 days if they do not use it".
test('a sign-in lasts until the device goes 30 days without a visit', async () => {
  const { call, cookieOf, store, mails } = await setup({ LOCK: 'on' });
  const body = person('g1');
  await call('/auth/signup', { body, ip: '5.5.5.1' });
  const first = cookieOf(await call('/auth/verify', { body: { email: body.email, code: codeIn(mails) } }));
  const key = [...store.keys()].find((k) => k.startsWith('accounts/users/') && JSON.parse(store.get(k)).email === body.email);
  store.set(key, JSON.stringify({ ...JSON.parse(store.get(key)), status: 'approved' }));
  const realNow = Date.now;
  const at = (days) => { Date.now = () => realNow() + days * 86400000; };
  try {
    let res = await call('/auth/me', { cookie: first });
    assert.equal(res.headers.get('set-cookie'), null); // same day: nothing to renew
    at(20);
    res = await call('/auth/me', { cookie: first });
    assert.match(res.headers.get('set-cookie'), /^bsess=.*Max-Age=2592000/);
    const renewed = cookieOf(res);
    at(45); // 25 days after that visit, 45 after signing in
    assert.equal((await call('/data/index.json', { cookie: renewed })).status, 200);
    assert.equal((await call('/data/index.json', { cookie: first })).status, 401);
    at(51); // 31 days with no visit
    assert.equal((await call('/data/index.json', { cookie: renewed })).status, 401);
    assert.equal((await (await call('/auth/me', { cookie: renewed })).json()).signedIn, false);
  } finally { Date.now = realNow; }
});

// Owner, 2026-11-10: "show who's following what turn on the members page".
test('a signed-in member\'s follows are kept with their account and listed for the owner', async () => {
  const { call, cookieOf, store, mails } = await setup({ LOCK: 'on' });
  const body = person('h1');
  await call('/auth/signup', { body, ip: '6.6.6.1' });
  const cookie = cookieOf(await call('/auth/verify', { body: { email: body.email, code: codeIn(mails) } }));
  let list = await (await call('/health/accounts', { key: OWNER_KEY })).json();
  const id = list.users.find((u) => u.email === body.email).id;
  await call('/health/accounts', { key: OWNER_KEY, body: { id, action: 'approve' } });
  const sub = (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: 'BPk', auth: 'au' } });
  let res = await call('/push/subscribe', { cookie, body: { subscription: sub('m'), turns: ['SR03', 'SD05', '@0123456789abcdef'] } });
  assert.equal(res.status, 200);
  // The owner's own phone and a phone from before accounts carry no member.
  await call('/push/subscribe', { key: OWNER_KEY, body: { subscription: sub('o'), turns: ['SR01'] } });
  const mine = [...store.keys()].find((k) => k.startsWith('subs/') && JSON.parse(store.get(k)).account === id);
  assert.ok(mine);
  // The phone's choices are kept as before, so the laptop reads them unchanged.
  assert.deepEqual(JSON.parse(store.get(mine)).turns, ['SR03', 'SD05', '@0123456789abcdef']);
  list = await (await call('/health/accounts', { key: OWNER_KEY })).json();
  assert.deepEqual(list.users.find((u) => u.id === id).follows, { phones: 1, turns: ['SD05', 'SR03'], people: 1 });
  assert.equal(list.unknownPhones, 1);
});

// Owner, 2026-11-10: more emails on lock night, by a setting.
test('MAIL_DAY_MAX sets how many account emails go in a day', async () => {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  for (const [setting, sent, want] of [[undefined, 70, 503], [undefined, 69, 200], ['95', 70, 200], ['95', 95, 503], ['nonsense', 70, 503]]) {
    const { call, store } = await setup(setting === undefined ? {} : { MAIL_DAY_MAX: setting });
    store.set(`accounts/mail/${day}.json`, JSON.stringify({ n: sent }));
    assert.equal((await call('/auth/signup', { body: person(`m${sent}${setting || ''}`), ip: '7.7.7.7' })).status, want, `${setting} at ${sent}`);
  }
  const { call } = await setup({ MAIL_DAY_MAX: '95' });
  assert.equal((await (await call('/health/accounts', { key: OWNER_KEY })).json()).mailMax, 95);
});
