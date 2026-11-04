// Owner, 2026-11-04: "when I force a re auth I dont always get the number".
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../../lib/board/owner-notify');

const sleep = async () => {};

test('retry: a dropped connection is tried again until it goes', async () => {
  let n = 0;
  const r = await N.withRetry(async () => { n++; if (n < 3) throw Object.assign(new Error('fetch failed'), { cause: { code: 'ETIMEDOUT' } }); return { ok: true }; }, { sleep });
  assert.deepEqual([r.ok, r.tries], [true, 3]);
  // Never: gives up after the waits, with the reason.
  const never = await N.withRetry(async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'ETIMEDOUT' } }); }, { sleep });
  assert.deepEqual([never.ok, never.tries, never.message], [false, N.WAITS.length + 1, 'ETIMEDOUT']);
  // A refused key isn't tried again.
  let k = 0;
  const refused = await N.withRetry(async () => { k++; return { ok: false, message: 'Pushover answered 400', final: true }; }, { sleep });
  assert.deepEqual([refused.ok, k], [false, 1]);
});

test('ntfy and Pushover requests', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200 }; };
  assert.equal((await N.sendNtfy('Microsoft sign-in: enter 42 in Authenticator.', 'topic', { fetchImpl })).ok, true);
  assert.equal(calls[0].url, 'https://ntfy.sh/topic');
  assert.equal(calls[0].opts.headers.Priority, 'high');
  assert.equal((await N.sendPushover('enter 42', { token: 'a', user: 'u' }, { fetchImpl })).ok, true);
  assert.equal(calls[1].url, 'https://api.pushover.net/1/messages.json');
  assert.deepEqual(Object.fromEntries(calls[1].opts.body), { token: 'a', user: 'u', message: 'enter 42', title: 'Board checker', priority: '1' });
  // Not set up: says so, never sends.
  assert.equal((await N.sendPushover('x', {}, { fetchImpl })).final, true);
  assert.equal(calls.length, 2);
  // A wrong key (4xx) is final; a server error (5xx) is tried again.
  assert.equal((await N.sendPushover('x', { token: 'a', user: 'u' }, { fetchImpl: async () => ({ ok: false, status: 400 }) })).final, true);
  assert.equal((await N.sendPushover('x', { token: 'a', user: 'u' }, { fetchImpl: async () => ({ ok: false, status: 503 }) })).final, false);
});
