const test = require('node:test');
const assert = require('node:assert/strict');
const { reminderDue, sinceLast } = require('../../lib/board/signin');

// Owner, 2026-11-02: no automatic fresh sign-in when going on duty; a
// reminder 12 h before the ~24 h sign-in runs out, and again at 2 h.
test('reminders 12 h and 2 h before the Microsoft sign-in runs out', () => {
  const H = 3600000;
  const lastAt = Date.UTC(2026, 10, 1, 20, 30); // 1st 1530 Toronto (EST)
  const st = { lastAt };
  assert.equal(reminderDue(st, lastAt + 11 * H, { hours: 24 }), null); // 13 h left
  const r12 = reminderDue(st, lastAt + 12 * H + 60000, { hours: 24 });
  assert.equal(r12.hours, 12);
  assert.match(r12.text, /runs out in about 12 h \(around 2nd 1530\)/);
  const after12 = { ...st, remindedFor: lastAt, reminded: r12.reminded };
  assert.equal(reminderDue(after12, lastAt + 15 * H, { hours: 24 }), null); // once
  const r2 = reminderDue(after12, lastAt + 22 * H + 60000, { hours: 24 });
  assert.equal(r2.hours, 2);
  assert.match(r2.text, /about 2 h/);
  assert.equal(reminderDue({ ...after12, reminded: r2.reminded }, lastAt + 23 * H, { hours: 24 }), null);
  assert.equal(reminderDue(st, lastAt + 25 * H, { hours: 24 }), null); // already out: Microsoft asks anyway
  // Checker off at the 12 h mark, back with 1 h left: only the 2 h one.
  const late = reminderDue(st, lastAt + 23 * H, { hours: 24 });
  assert.equal(late.hours, 2);
  assert.equal(reminderDue({ ...st, remindedFor: lastAt, reminded: late.reminded }, lastAt + 23.5 * H, { hours: 24 }), null);
  // A new sign-in starts over.
  assert.equal(reminderDue({ lastAt: lastAt + 23 * H, remindedFor: lastAt, reminded: [12, 2] }, lastAt + 35 * H + 60000, { hours: 24 }).hours, 12);
  assert.equal(reminderDue({}, lastAt), null);
});

test('time since the last sign-in reads as hours and minutes', () => {
  assert.equal(sinceLast({}), null);
  assert.equal(sinceLast({ lastAt: 0 }, (23 * 60 + 58) * 60000), null); // 0 = none known
  assert.equal(sinceLast({ lastAt: 1000 }, 1000 + (23 * 60 + 58) * 60000), '23 h 58 m');
});
