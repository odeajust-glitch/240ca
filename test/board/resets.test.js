// The reset tracker against the owner's CATS "EMPLOYEE TIME ON DUTY LOG"
// (PSTS05Y, 2026-11-03 0933): his trips on SR03, RESETSYS 26th 0559,
// RESETM32 3rd 0754.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../lib/board/resets');
const { at, fmt } = require('../../lib/board/time');

const t = (d, hhmm) => at(2026, d > 20 ? 10 : 11, d, Math.floor(hhmm / 100), hhmm % 100);

test('natural reset: 32 h off and two free nights, at whichever comes later', () => {
  // Off 24th 0220, next on 26th 2045: RESETSYS 26th 0559.
  assert.equal(fmt(R.naturalReset(t(24, 220), t(26, 2045))), '26th 0559');
  // Off 1st 2355, still off at 3rd 0933: RESETM32 3rd 0754 (+ a minute: CATS had 2354:xx).
  assert.equal(fmt(R.naturalReset(t(1, 2355), t(3, 933))), '3rd 0755');
  // 28th 0040 → 29th 0400 (on duty): 27 h, not a reset.
  assert.equal(R.naturalReset(t(28, 40), t(29, 400)), null);
  // 50 h but back on duty at 0400 on the second morning: only one free night.
  assert.equal(R.naturalReset(t(26, 200), t(28, 400)), null);
});

test('off duty: Toronto bunkhouse, home REST − 10 h or − 24 h, yard 8/12 h, else the Call Board', () => {
  const acc = R.empty();
  acc.bunk.SR03 = { [t(27, 429)]: t(27, 501) };
  acc.rest.SR03 = { [t(28, 1040)]: t(28, 131), [t(31, 245)]: t(30, 348) };
  // E27861 26 to Toronto: the bunkhouse (CATS 04:29).
  assert.deepEqual(R.offDuty({ train: 'E27861 26', on: t(26, 2045), last: t(27, 445), job: 'SR03' }, 'SR03', acc), { off: t(27, 429), how: 'bunkhouse' });
  // Z14931 27 home, REST 28th 1040 → 0040 (CATS 00:40; the Call Board said ~0124).
  assert.deepEqual(R.offDuty({ train: 'Z14931 27', on: t(27, 1630), last: t(28, 124), job: 'SR03' }, 'SR03', acc), { off: t(28, 40), how: 'rest' });
  // M38331 29 home, booked 24 h: REST 31st 0245 → 30th 0245 (CATS 02:45).
  assert.deepEqual(R.offDuty({ train: 'M38331 29', on: t(29, 1800), last: t(30, 303), job: 'SR03' }, 'SR03', acc), { off: t(30, 245), how: 'rest' });
  assert.equal(R.offDuty({ train: 'YSBY06', on: t(2, 1430), last: t(2, 1500), yard: true }, null, acc).off, t(3, 230));
  assert.deepEqual(R.offDuty({ train: 'X1 01', on: t(1, 1000), last: t(1, 1900), job: 'B111' }, null, acc), { off: t(1, 1830), how: 'call board' });
});

// His week as the checker would have seen it: trips from the Call Board,
// offs from the bunkhouse and the Chain Gang's REST.
function week() {
  const acc = R.empty();
  acc.since = t(23, 0); acc.last = t(3, 933);
  const trips = [['Z14931 23', 23, 1715, 24, 251], ['E27861 26', 26, 2045, 27, 445], ['Z14931 27', 27, 1630, 28, 124], ['DHT065C 29', 29, 400, 29, 641],
    ['M38331 29', 29, 1800, 30, 303], ['M39671 30', 1, 1, 1, 600], ['Z14931 01', 1, 1645, 2, 45]];
  acc.trips.me = Object.fromEntries(trips.map(([train, d1, h1, d2, h2]) => [`${train}/${t(d1, h1)}`, { train, on: t(d1, h1), job: 'SR03', first: t(d1, h1) - 120, last: t(d2, h2) }]));
  acc.bunk.SR03 = { [t(27, 429)]: t(27, 501), [t(29, 629)]: t(29, 649), [t(1, 554)]: t(1, 610) };
  acc.rest.SR03 = { [t(25, 220)]: t(24, 304), [t(28, 1040)]: t(28, 131), [t(31, 245)]: t(30, 348), [t(2, 955)]: t(2, 122) };
  const people = { me: [{ turn: 'SR03', own: true, from: '2026-10-23 0000', to: '2026-11-03 0933' }] };
  return { acc, people };
}

test('his week: resets where CATS logged them, next one due 7 days on', () => {
  const { acc, people } = week();
  const r = R.finish(acc, people, t(3, 933)).me;
  assert.deepEqual(r.duty.map((d) => `${d.train} ${fmt(d.off)} ${d.how}`), [
    'Z14931 23 24th 0220 rest', // REST 25th 0220 booked 24 h (CATS 02:20)
    'E27861 26 27th 0429 bunkhouse', 'Z14931 27 28th 0040 rest', 'DHT065C 29 29th 0629 bunkhouse',
    'M38331 29 30th 0245 rest', 'M39671 30 1st 0554 bunkhouse', 'Z14931 01 1st 2355 rest',
  ]);
  assert.deepEqual(r.resets.filter((x) => x.at > t(24, 0)).map((x) => `${fmt(x.at)} ${x.kind}`), ['26th 0559 natural', '3rd 0755 natural']);
  assert.equal(fmt(r.due), '10th 0755');
  // Not close: no colour.
  assert.equal(R.byTurn({ me: r }, people, t(3, 933)).SR03.level, '');
});

test('yellow 2 days before the reset is needed, red 24 h before; none once put on one', () => {
  const people = { me: [{ turn: 'SR03', own: true, from: '2026-10-26 0000', to: '2026-10-31 1200' }] };
  const r = { last: { at: t(26, 559) }, due: t(26, 559) + 7 * 1440, ahead: null };
  assert.equal(R.byTurn({ me: r }, people, t(31, 1200)).SR03.level, 'yellow'); // due 2nd 0559: 42 h
  people.me[0].to = '2026-10-30 1200';
  assert.equal(R.byTurn({ me: r }, people, t(30, 1200)).SR03.level, ''); // 66 h
  people.me[0].to = '2026-11-01 2000';
  assert.equal(R.byTurn({ me: r }, people, t(1, 2000)).SR03.level, 'red'); // 10 h
  assert.equal(R.byTurn({ me: { ...r, ahead: { at: t(3, 559) } } }, people, t(1, 2000)).SR03.level, '');
});

test('manual reset: a 0559 rest or hold on their own turn', () => {
  const acc = R.empty();
  acc.since = t(10 + 13, 0); acc.last = t(25, 1200);
  // Working every day (no natural reset), put on hold until 26th 0559 at 24th 0304.
  acc.trips.me = Object.fromEntries([23, 24, 25].map((d) => [`T/${d}`, { train: `T ${d}`, on: t(d, 1000), job: 'SR03', first: t(d, 900), last: t(d, 2000) }]));
  acc.manual.SR03 = { [t(26, 559)]: t(24, 304) };
  const people = { me: [{ turn: 'SR03', own: true, from: '2026-10-23 0000', to: '2026-10-25 1200' }] };
  const r = R.finish(acc, people, t(25, 1200)).me;
  assert.equal(fmt(r.ahead.at), '26th 0559');
  assert.equal(r.ahead.kind, 'manual');
});

test('collect: trips by name code from the Call Board, REST and 0559 holds per turn', () => {
  const acc = R.empty();
  const input = {
    callBoard: [{ symbol: 'Z14931', originDay: '27', onDuty: t(27, 1630) }],
    yardJobs: [{ job: 'YPRS60', onDuty: t(27, 2245) }],
    chainGangHome: [{ turn: 'SR03', restUntil: t(28, 1040) }, { turn: 'SR05', rn: 'HT', statusUntil: t(29, 559) }],
    s5: [{ turn: 'S501', craft: 'CO', restUntil: t(28, 1500) }],
    bunkhouse: [{ co: 'SR04', en: 'SD13', restUntil: t(28, 900) }],
  };
  R.collect(acc, input, [{ h: 'me', turn: 'SR03', own: true, craft: 'CO', train: 'Z14931 27' }, { h: 'yd', turn: 'YPRS60', own: false }, { h: 'x', turn: 'SR09', own: true }], t(28, 100));
  assert.deepEqual(Object.keys(acc.trips).sort(), ['me', 'yd']);
  assert.equal(acc.trips.yd[`YPRS60/${t(27, 2245)}`].yard, true);
  assert.ok(acc.rest['S501-CO'][t(28, 1500)]);
  assert.ok(acc.manual.SR05[t(29, 559)]);
  assert.equal(acc.bunk.SD13[t(28, 100)], t(28, 100));
});
