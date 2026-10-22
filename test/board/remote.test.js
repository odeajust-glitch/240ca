const test = require('node:test');
const assert = require('node:assert/strict');
const { commandTopic, readCommands, pollSignIn, asksSignIn } = require('../../lib/board/remote');

// Owner, 2026-10-22: force a fresh Microsoft sign-in from the phone by
// publishing "signin" to an ntfy topic the checker polls.
test('the sign-in command topic is the alert topic + "-signin" unless set', () => {
  assert.equal(commandTopic({}), null);
  assert.equal(commandTopic({ BOARD_NTFY_TOPIC: ' sr03-board-x7 ' }), 'sr03-board-x7-signin');
  assert.equal(commandTopic({ BOARD_NTFY_TOPIC: 'a', BOARD_NTFY_COMMAND_TOPIC: 'other' }), 'other');
});

test('only a short "signin" style message asks for a sign-in', () => {
  for (const t of ['signin', 'Sign in', 'sign-in', 'SIGNIN!', 'reauth', 'Re-authenticate', 'login', 'R']) assert.ok(asksSignIn(t), t);
  for (const t of ['', 'hello', 'did the sign in work?', 'test']) assert.ok(!asksSignIn(t), t);
});

test('ntfy poll: new, recent "signin" messages count; old or repeated ones don\'t', () => {
  const now = 1_800_000_000;
  const line = (time, message, event = 'message') => JSON.stringify({ id: String(time), time, event, message });
  const body = [line(now - 30, 'signin'), line(now - 20, 'test'), line(now - 10, 'x', 'keepalive'), 'not json'].join('\n');
  assert.deepEqual(readCommands(body, now - 60, now), { asked: true, last: now - 20 });
  assert.deepEqual(readCommands(body, now - 30, now), { asked: false, last: now - 20 }); // already seen
  assert.deepEqual(readCommands(line(now - 3600, 'signin'), now - 7200, now), { asked: false, last: now - 3600 }); // stale
});

test('a failed ntfy poll never throws and keeps its place', async () => {
  const down = await pollSignIn({ topic: 't', since: 5, fetchImpl: async () => { throw new Error('offline'); } });
  assert.deepEqual(down, { asked: false, last: 5, error: 'offline' });
  let url;
  const ok = await pollSignIn({ topic: 'my topic', since: 5.7, fetchImpl: async (u) => { url = u; return { ok: true, text: async () => '' }; } });
  assert.equal(url, 'https://ntfy.sh/my%20topic/json?poll=1&since=5');
  assert.deepEqual(ok, { asked: false, last: 5.7 });
});
