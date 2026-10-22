const test = require('node:test');
const assert = require('node:assert/strict');
const { stuckReason } = require('../../lib/board/watchdog');

// Owner, 2026-10-22: it hung a few times a day and needed Ctrl+C + restart.
test('watchdog: busy is fine, stuck is caught, a sign-in gets longer', () => {
  const t0 = Date.UTC(2026, 9, 22, 12, 0);
  const min = 60000;
  const opts = { startedAt: t0, every: 5 };
  const at = (state, ago, now = t0 + 60 * min) => stuckReason({ at: now - ago * min, state }, now, opts);
  assert.equal(at('checking', 3), null);
  assert.equal(at('checking', 15), 'a check has been running for 15 min');
  assert.equal(at('idle', 14), null); // napping 5 min + 10 grace
  assert.equal(at('idle', 15), 'no new check has started for 15 min');
  assert.equal(at('signin', 30), null);
  assert.equal(at('signin', 45), 'it has been waiting on a sign-in for 45 min');
  // No heartbeat yet (or one left from before this start): counts from the start.
  assert.equal(stuckReason(null, t0 + 10 * min, opts), null);
  assert.equal(stuckReason({ at: t0 - 99 * min, state: 'idle' }, t0 + 20 * min, opts), 'it hasn\'t finished starting for 20 min');
});
