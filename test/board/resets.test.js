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
  assert.equal(R.byTurn(acc, people, t(3, 933)).SR03.level, '');
  assert.equal(R.byTurn(acc, people, t(3, 933)).SR03.dueText, '10th 0755');
});

test('yellow 2 days before the reset is needed, red 24 h before; none once put on one', () => {
  // Off since 24th 0220 (reset 26th 0559), then a night yard job every night.
  const acc = R.empty();
  acc.since = t(24, 220); acc.last = t(1, 2000);
  acc.trips.me = Object.fromEntries([26, 27, 28, 29, 30, 31].map((d) => [`Y/${d}`, { train: 'YSTY01', on: t(d, 2200), job: 'SR03', first: t(d, 2200), last: t(d, 2300), yard: true }]));
  const people = (to) => ({ me: [{ turn: 'SR03', own: true, from: '2026-10-24 0300', to }] });
  const at = (p, now) => R.byTurn(acc, p, now).SR03;
  assert.equal(at(people('2026-10-30 1200'), t(30, 1200)).level, ''); // due 2nd 0559: 66 h
  assert.equal(at(people('2026-10-31 1200'), t(31, 1200)).level, 'yellow'); // 42 h
  assert.equal(at(people('2026-11-01 2000'), t(1, 2000)).level, 'red'); // 10 h
  assert.equal(at(people('2026-11-01 2000'), t(1, 2000)).dueText, '2nd 0559');
  // Put on a reset (rest until 3rd 0559 on his turn): no colour.
  acc.manual.SR03 = { [t(3, 559)]: t(1, 1900) };
  assert.equal(at(people('2026-11-01 2000'), t(1, 2000)).level, '');
});

// One name code on two turns at once = two people (owner's data: SR11 and
// SB06): each turn gets only its own person's trains.
test('a name code on two turns at once is two people', () => {
  const acc = R.empty();
  acc.since = t(24, 220); acc.last = t(1, 2000);
  acc.turnTrips = {
    SR11: Object.fromEntries([26, 27, 28, 29, 30, 31].map((d) => [`A/${d}`, { train: `A ${d}`, on: t(d, 2200), job: 'SR11', first: t(d, 2100), last: t(d, 2300) }])),
    SB06: { 'B/30': { train: 'B 30', on: t(30, 1200), job: 'SB06', first: t(30, 1100), last: t(30, 1700) } },
  };
  const people = { x: [{ turn: 'SR11', own: true, from: '2026-10-24 0300', to: '2026-11-01 2000' }, { turn: 'SB06', own: true, from: '2026-10-24 0300', to: '2026-11-01 2000' }] };
  const turns = R.byTurn(acc, people, t(1, 2000));
  assert.equal(turns.SR11.level, 'red');
  assert.equal(turns.SB06.level, ''); // off since the 30th: reset 1st 0559
  assert.equal(turns.SB06.dueText, '8th 0559');
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

// Before 2026-11-03 the checks kept no train with each name: a person's
// trips come from their own turn's trains while they held it, except a job
// a spare filled in on (owner's real data: everyone came out "due 25th").
test('trips from the turn they held; a spare filling in is not theirs', () => {
  const { acc, people } = week();
  acc.turnTrips = { SR03: acc.trips.me };
  acc.trips = {};
  // A spare worked SR03 on this one while he was off.
  acc.turnTrips.SR03[`X1 25/${t(25, 1200)}`] = { train: 'X1 25', on: t(25, 1200), job: 'SR03', first: t(25, 1000), last: t(25, 2000) };
  acc.filled = { [`X1 25/${t(25, 1200)}`]: ['SR03'] };
  const r = R.finish(acc, people, t(3, 933)).me;
  assert.equal(r.duty.length, 7);
  assert.ok(!r.duty.some((d) => d.train === 'X1 25'));
  assert.equal(fmt(r.due), '10th 0755');
  // A long stretch off keeps the reset fresh: off since 16th, now 3rd 0933.
  assert.equal(fmt(R.naturalReset(at(2026, 10, 16, 0, 0), t(3, 933))), '3rd 0559');
});

test('collect: each turn\'s trains, and jobs a spare filled in', () => {
  const acc = R.empty();
  const input = { callBoard: [{ symbol: 'A42431', originDay: '03', onDuty: t(3, 1000), crew: [{ craft: 'EN', turn: 'S104' }, { craft: 'CO', turn: 'SA07' }] },
    { symbol: 'L50231', originDay: '03', onDuty: t(3, 400), crew: [{ craft: 'EN', turn: 'S502' }] }] };
  R.collect(acc, input, [], t(3, 1010), [{ train: 'A42431 03', craft: 'EN', job: 'S104', turn: 'B108' }]);
  assert.deepEqual(Object.keys(acc.turnTrips).sort(), ['S104', 'S502-EN', 'SA07']);
  assert.deepEqual(acc.filled[`A42431 03/${t(3, 1000)}`], ['S104']);
});
