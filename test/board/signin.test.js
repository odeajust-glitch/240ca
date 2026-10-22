const test = require('node:test');
const assert = require('node:assert/strict');
const { dueForCall, sinceLast, RECENT_MS } = require('../../lib/board/signin');
const { at } = require('../../lib/board/time');

// Owner, 2026-10-22: sign in to Microsoft fresh when their own train is
// ordered and the call is near, so the ~24 h covers the trip.
test('a fresh sign-in is due once the owner\'s ordered train is called within 3 h', () => {
  const me = { turn: 'SR03', train: 'M39671 22', status: 'ORD', call: at(2026, 10, 22, 14, 0), onDuty: at(2026, 10, 22, 16, 0) };
  const nowMs = Date.UTC(2026, 9, 22, 15, 0);
  assert.equal(dueForCall(me, at(2026, 10, 22, 10, 0), {}, { nowMs }), null); // call 4 h off
  assert.match(dueForCall(me, at(2026, 10, 22, 11, 30), {}, { nowMs }), /M39671 22 is ordered \(called ~22nd 1400\)/);
  assert.ok(dueForCall(me, at(2026, 10, 22, 15, 0), {}, { nowMs })); // called, not on duty yet
  assert.equal(dueForCall(me, at(2026, 10, 22, 16, 0), {}, { nowMs }), null); // on duty: too late
  assert.equal(dueForCall({ ...me, status: 'PLN' }, at(2026, 10, 22, 12, 0), {}, { nowMs }), null); // only planned
  assert.equal(dueForCall(me, at(2026, 10, 22, 12, 0), { doneFor: 'M39671 22' }, { nowMs }), null); // once per train
  assert.equal(dueForCall(me, at(2026, 10, 22, 12, 0), { lastAt: nowMs - RECENT_MS + 60000 }, { nowMs }), null); // signed in lately
  assert.ok(dueForCall(me, at(2026, 10, 22, 12, 0), { lastAt: nowMs - RECENT_MS - 60000 }, { nowMs }));
  assert.ok(dueForCall(me, at(2026, 10, 22, 9, 30), {}, { nowMs, beforeCall: 300 })); // BOARD_SIGNIN_BEFORE_CALL
  assert.equal(dueForCall({ turn: 'SR03', ahead: [] }, at(2026, 10, 22, 12, 0), {}, { nowMs }), null); // not lined up
});

test('time since the last sign-in reads as hours and minutes', () => {
  assert.equal(sinceLast({}), null);
  assert.equal(sinceLast({ lastAt: 0 }, (23 * 60 + 58) * 60000), null); // 0 = none known
  assert.equal(sinceLast({ lastAt: 1000 }, 1000 + (23 * 60 + 58) * 60000), '23 h 58 m');
});
