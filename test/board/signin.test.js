const test = require('node:test');
const assert = require('node:assert/strict');
const { dueOnDuty, sinceLast, RECENT_MS } = require('../../lib/board/signin');
const { at } = require('../../lib/board/time');

// Owner, 2026-10-22: sign in to Microsoft fresh once their turn shows on
// duty on the Sarnia Call Board (not before the call), so the ~24 h covers the trip.
test("a fresh sign-in is due once the owner's turn is on duty on the Sarnia Call Board", () => {
  const train = (station, co) => ({ symbol: 'M39671', originDay: '22', station, onDuty: at(2026, 10, 22, 16, 0),
    crew: [{ craft: 'EN', turn: 'SD04' }, { craft: 'CO', turn: co }] });
  const nowMs = Date.UTC(2026, 9, 22, 20, 0);
  assert.deepEqual(dueOnDuty([train('SARNIA', 'SR03')], 'SR03', {}, { nowMs }),
    { train: 'M39671 22', why: "you're on duty on M39671 22 at 22nd 1600" });
  assert.equal(dueOnDuty([train('SARNIA', 'SR07')], 'SR03', {}, { nowMs }), null); // someone else's
  assert.equal(dueOnDuty([train('TORONTO', 'SR03')], 'SR03', {}, { nowMs }), null); // the trip home
  assert.equal(dueOnDuty([], 'SR03', {}, { nowMs }), null); // lined up or waiting: not yet
  assert.equal(dueOnDuty([train('SARNIA', 'SR03')], 'SR03', { doneFor: 'M39671 22' }, { nowMs }), null); // once per train
  assert.equal(dueOnDuty([train('SARNIA', 'SR03')], 'SR03', { lastAt: nowMs - RECENT_MS + 60000 }, { nowMs }), null); // just signed in (R)
  assert.ok(dueOnDuty([train('SARNIA', 'SR03')], 'SR03', { lastAt: nowMs - RECENT_MS - 60000 }, { nowMs }));
});

test('time since the last sign-in reads as hours and minutes', () => {
  assert.equal(sinceLast({}), null);
  assert.equal(sinceLast({ lastAt: 0 }, (23 * 60 + 58) * 60000), null); // 0 = none known
  assert.equal(sinceLast({ lastAt: 1000 }, 1000 + (23 * 60 + 58) * 60000), '23 h 58 m');
});
