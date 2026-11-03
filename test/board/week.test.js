const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../../public/board-week');

// Owner, 2026-11-03: a weekly summary (page + Sunday alert, JUOD first).
test('week: Sunday to Saturday, and the week before', () => {
  assert.deepEqual(W.weekOf('2026-11-03'), { from: '2026-11-01', to: '2026-11-07' }); // a Tuesday
  assert.deepEqual(W.weekOf('2026-11-01'), { from: '2026-11-01', to: '2026-11-07' }); // the Sunday itself
  assert.deepEqual(W.weekBefore('2026-11-01'), { from: '2026-10-25', to: '2026-10-31' });
  assert.equal(W.label({ from: '2026-10-25', to: '2026-10-31' }), 'Oct 25–31');
  assert.equal(W.label({ from: '2026-11-29', to: '2026-12-05' }), 'Nov 29 – Dec 5');
});

test('week: a turn\'s week in numbers and in a line', () => {
  const rec = {
    orders: [
      { train: 'M38261 27', onDuty: true, onDutyAt: '27th 1630', onDutySeen: '2026-10-27 1630', crew: 'EN SD06 · CO SR03' },
      { train: 'M38331 29', onDuty: true, onDutyAt: '29th 1800', onDutySeen: '2026-10-29 1800', crew: 'EN SD06 · CO SR03', station: 'TORONTO' },
      { train: 'Y123', onDuty: true, onDutyAt: '30th 0700', onDutySeen: '2026-10-30 0700', crew: 'CO SR03', yard: true },
      { train: 'M39671 01', onDuty: true, onDutyAt: '1st 2300', onDutySeen: '2026-11-01 2300', crew: 'CO SR03' }, // next week
      { train: 'E27861 26', onDuty: true, onDutyAt: '26th 2045', onDutySeen: '2026-10-26 2045', crew: 'CO SR07', workedBy: 'SR07' },
    ],
    rests: [{ seen: '2026-10-28 0300', until: '28th 1100', kind: 'rest' }],
    spares: [],
  };
  const trains = [{ id: 'M38261 27', month: '2026-10', day: '2026-10-27', onDuty: '2026-10-27 1630', crew: 'EN SD06 · CO SR03', timeOnDuty: 540, heldMin: 900, events: [] }];
  const s = W.weekSummary({
    rec, turns: ['SR03'], trains, week: { from: '2026-10-25', to: '2026-10-31' },
    sleep: [{ turn: 'SR03', onDuty: '2026-10-27 1630', off: 20 }, { turn: 'SR03', onDuty: '2026-10-29 1800', off: -95 }, { turn: 'SD06', onDuty: '2026-10-27 1630', off: 300 }],
    runLog: [{ passed: 'SR03', went: 'SR07', result: 'likely', seen: '2026-10-28 1200' }, { passed: 'SR03', result: 'explained', seen: '2026-10-28 1300' }],
    stale: [{ crew: 'SR03 + SD06', from: '2026-10-27 1500' }],
    catsErrors: [], runarounds: [],
  });
  assert.deepEqual([s.trips, s.yard, s.onDutyMin, s.held14, s.rests.length, s.calls.n, s.calls.ok, s.calls.bad, s.runarounds.length, s.stale.length],
    [2, 1, 540, 1, 1, 2, 1, 1, 1, 1]);
  assert.equal(W.weekText(s), 'Week of Oct 25–31: 2 trips + 1 yard job, 9 h on duty to Toronto; 1 held 14 h+ in Toronto; 1 rest/hold; calls vs the one you slept on: 1 within 30 min, 1 over 1 h; 1 possible runaround, 1 train left stale.');
  // A quiet week.
  assert.equal(W.weekText(W.weekSummary({ rec: { orders: [], rests: [], spares: [] }, turns: ['SR03'], week: { from: '2026-10-25', to: '2026-10-31' } })), 'Week of Oct 25–31: no trips worked.');
});

test('week: a person\'s week from the site files (the Sunday alert, JUOD first)', () => {
  const h = 'aaaaaaaaaaaaaaaa';
  const people = { [h]: [
    { turn: 'S501', own: true, from: '2026-10-20 0800', to: '2026-10-25 2300' },
    { turn: 'SR03', own: true, from: '2026-10-26 0700', to: '2026-11-02 1200' },
  ] };
  const turns = { SR03: { changes: [], rests: [], spares: [], orders: [{ train: 'M38261 27', first: '2026-10-27 0500', onDuty: true, onDutyAt: '27th 1630', onDutySeen: '2026-10-27 1630', crew: 'EN SD06 · CO SR03' }] },
    S501: { changes: [], rests: [], spares: [], orders: [{ train: 'L50231 21', first: '2026-10-21 0100', onDuty: true, onDutyAt: '21st 0400', onDutySeen: '2026-10-21 0400', crew: 'CO S501' }] } };
  const s = W.personWeek(h, { people, turns, trains: [], analytics: {} }, { from: '2026-10-25', to: '2026-10-31' });
  assert.deepEqual(s.runs.map((r) => r.id), ['M38261 27']); // S501's train was the week before
  assert.equal(W.weekText(W.personWeek('bbbbbbbbbbbbbbbb', { people }, { from: '2026-10-25', to: '2026-10-31' })), 'Week of Oct 25–31: no trips worked.');
});
