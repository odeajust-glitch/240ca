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

test('his week: resets where CATS logged them, next one due 7 days after going back on duty', () => {
  const { acc, people } = week();
  const r = R.finish(acc, people, t(3, 933)).me;
  assert.deepEqual(r.duty.map((d) => `${d.train} ${fmt(d.off)} ${d.how}`), [
    'Z14931 23 24th 0220 rest', // REST 25th 0220 booked 24 h (CATS 02:20)
    'E27861 26 27th 0429 bunkhouse', 'Z14931 27 28th 0040 rest', 'DHT065C 29 29th 0629 bunkhouse',
    'M38331 29 30th 0245 rest', 'M39671 30 1st 0554 bunkhouse', 'Z14931 01 1st 2355 rest',
  ]);
  assert.deepEqual(r.resets.filter((x) => x.at > t(24, 0)).map((x) => `${fmt(x.at)} ${x.kind}`), ['26th 0559 natural', '3rd 0755 natural']);
  // Off since the reset: the 7 days haven't started (owner: "the 7 days
  // start when I go on duty").
  assert.equal(r.due, null);
  assert.equal(R.byTurn(acc, people, t(3, 933)).SR03, undefined);
  // Called tonight: due 7 days after going on duty.
  acc.trips.me[`L50231 04/${t(4, 200)}`] = { train: 'L50231 04', on: t(4, 200), job: 'SR03', first: t(4, 100), last: t(4, 300) };
  people.me[0].to = '2026-11-04 0300';
  const after = R.byTurn(acc, people, t(4, 300)).SR03;
  assert.deepEqual([after.dueText, after.level], ['11th 0159', '']); // CATS: a minute short of 7 days
});

test('yellow 2 days before the reset is needed, red 24 h before; none once put on one', () => {
  // Off since 24th 0220 (reset 26th 0559), then a night yard job every night.
  const acc = R.empty();
  acc.since = t(24, 220); acc.last = t(1, 2000);
  acc.trips.me = Object.fromEntries([26, 27, 28, 29, 30, 31].map((d) => [`Y/${d}`, { train: 'YSTY01', on: t(d, 2200), job: 'SR03', first: t(d, 2200), last: t(d, 2300), yard: true }]));
  const people = (to) => ({ me: [{ turn: 'SR03', own: true, from: '2026-10-24 0300', to }] });
  const at = (p, now) => R.byTurn(acc, p, now).SR03;
  // Reset 26th 0559, back on duty 26th 2200: needed by 2nd 2200.
  assert.equal(at(people('2026-10-31 1200'), t(31, 1200)).level, ''); // 58 h
  assert.equal(at(people('2026-11-01 0400'), t(1, 400)).level, 'yellow'); // 42 h
  assert.equal(at(people('2026-11-02 0800'), t(2, 800)).level, 'red'); // 14 h
  assert.equal(at(people('2026-11-02 0800'), t(2, 800)).dueText, '2nd 2159');
  // Put on a reset (rest until 3rd 0559 on his turn): no colour.
  acc.manual.SR03 = { [t(3, 559)]: t(2, 700) };
  assert.equal(at(people('2026-11-02 0800'), t(2, 800)).level, '');
});

// One name code on two turns at once = two people (owner's data: SR11 and
// SB06): each turn gets only its own person's trains.
test('a name code on two turns at once is two people', () => {
  const acc = R.empty();
  acc.since = t(24, 220); acc.last = t(2, 800);
  acc.turnTrips = {
    SR11: Object.fromEntries([26, 27, 28, 29, 30, 31, 1].map((d) => [`A/${d}`, { train: `A ${d}`, on: t(d, 2200), job: 'SR11', first: t(d, 2100), last: t(d, 2300) }])),
    SB06: { 'B/30': { train: 'B 30', on: t(30, 1200), job: 'SB06', first: t(30, 1100), last: t(30, 1700) } },
  };
  const people = { x: [{ turn: 'SR11', own: true, from: '2026-10-24 0300', to: '2026-11-02 0800' }, { turn: 'SB06', own: true, from: '2026-10-24 0300', to: '2026-11-02 0800' }] };
  const turns = R.byTurn(acc, people, t(2, 800));
  assert.equal(turns.SR11.level, 'red'); // back 26th 2200 → 2nd 2200
  // SB06's person: one trip on the 30th, off since: reset 2nd 0559 and not
  // back on duty, so nothing due (not mixed up with SR11's trains).
  assert.equal(turns.SB06, undefined);
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
  assert.equal(fmt(r.last.at), '3rd 0755');
  // A long stretch off keeps the reset fresh: off since 16th, now 3rd 0933.
  assert.equal(fmt(R.naturalReset(at(2026, 10, 16, 0, 0), t(3, 933))), '3rd 0559');
});

test('collect: each turn\'s trains, and jobs a spare filled in', () => {
  const acc = R.empty();
  const input = { callBoard: [{ symbol: 'A42431', originDay: '03', onDuty: t(3, 1000), crew: [{ craft: 'EN', turn: 'S104' }, { craft: 'CO', turn: 'SA07' }] },
    { symbol: 'L50231', originDay: '03', onDuty: t(3, 400), crew: [{ craft: 'EN', turn: 'S502' }] }] };
  R.collect(acc, input, [], t(3, 1010), [{ train: 'A42431 03', craft: 'EN', job: 'S104', turn: 'B108' }]);
  // B108 filled in on S104: the trip is on B108's list too (for B108's person).
  assert.deepEqual(Object.keys(acc.turnTrips).sort(), ['B108', 'S104', 'S502-EN', 'SA07']);
  assert.equal(acc.turnTrips.B108[`A42431 03/${t(3, 1000)}`].job, 'S104');
  assert.deepEqual(acc.filled[`A42431 03/${t(3, 1000)}`], ['S104']);
});

// Owner, 2026-11-03: "anyone on a regular yard job should be reset cause
// they have set days off. Its the people on the boards that matter."
test('regular yard jobs are left out', () => {
  const acc = R.empty();
  acc.since = t(24, 220); acc.last = t(2, 800);
  acc.trips.y = Object.fromEntries([26, 27, 28, 29, 30, 31, 1].map((d) => [`Y/${d}`, { train: 'YFLS01', on: t(d, 2200), job: 'YFLS01', first: t(d, 2200), last: t(d, 2300), yard: true }]));
  acc.trips.b = { ...acc.trips.y };
  const people = { y: [{ turn: 'YFLS01', own: true, from: '2026-10-24 0300', to: '2026-11-02 0800' }], b: [{ turn: 'B111', own: true, from: '2026-10-24 0300', to: '2026-11-02 0800' }] };
  const turns = R.byTurn(acc, people, t(2, 800));
  assert.equal(turns.YFLS01, undefined);
  assert.equal(turns.B111.level, 'red');
});

// Owner asked about COBO (SD08), who filled in on S301 for M38261 27 and
// M39731 28 while not seen on SD08: those trips are COBO's.
test('trips filling in on another turn count for the spare', () => {
  const acc = R.empty();
  acc.since = t(26, 0); acc.last = t(28, 2100);
  acc.turnTrips = { SD08: {
    [`M38261 27/${t(27, 1715)}`]: { train: 'M38261 27', on: t(27, 1715), job: 'S301', first: t(27, 1530), last: t(28, 100) },
    [`M39731 28/${t(28, 1050)}`]: { train: 'M39731 28', on: t(28, 1050), job: 'S301', first: t(28, 900), last: t(28, 1650) },
  } };
  const people = { c: [{ turn: 'SD08', own: true, from: '2026-10-26 0000', to: '2026-10-27 1515' },
    { turn: 'S301', own: false, from: '2026-10-27 1522', to: '2026-10-28 1950' }, { turn: 'SD08', own: true, from: '2026-10-28 1958', to: '2026-10-28 2100' }] };
  const r = R.finish(acc, people, t(28, 2100)).c;
  assert.deepEqual(r.duty.map((d) => d.train), ['M38261 27', 'M39731 28']);
  assert.equal(fmt(r.due), '3rd 1714'); // reset 27th 0559, back 27th 1715
});

// Owner, 2026-11-04: WADE, a TT on S501, showed as S501's conductor.
test('a trainee rides on the turn\'s trains but never colours the holder\'s row', () => {
  assert.equal(R.keyOf('S501', 'TT'), 'S501-TT');
  assert.equal(R.keyOf('S102', 'ET'), 'S102-ET');
  const acc = R.empty();
  acc.since = t(24, 220); acc.last = t(2, 800);
  acc.turnTrips = { 'S501-CO': Object.fromEntries([26, 27, 28, 29, 30, 31, 1].map((d) => [`L/${d}`, { train: `L ${d}`, on: t(d, 2200), job: 'S501-CO', first: t(d, 2100), last: t(d, 2300) }])) };
  const people = {
    me: [{ turn: 'S501', craft: 'CO', own: true, from: '2026-10-24 0300', to: '2026-11-02 0800' }],
    tt: [{ turn: 'S501-TT', own: true, from: '2026-10-30 0300', to: '2026-11-02 0800' }],
  };
  const turns = R.byTurn(acc, people, t(2, 800));
  assert.equal(turns['S501-CO'].h, 'me');
  assert.equal(turns['S501-TT'], undefined); // not a board row
  // The trainee's own work: the S501 conductor's trains while on it.
  const tt = R.finish(acc, people, t(2, 800)).tt;
  assert.deepEqual(tt.duty.map((d) => d.train), ['L 30', 'L 31', 'L 1']);
});

// The owner's CATS PSTS05Y, 2026-11-04 1116: RESETM32 3rd 0754, L50231 04
// on duty 4th 0245 → "7DY RESET: 261111 0244".
test('next reset as CATS shows it: 7 days after the first shift, less a minute', () => {
  const acc = R.empty();
  acc.since = t(1, 0); acc.last = t(4, 1116);
  acc.trips.me = {
    a: { train: 'Z14931 01', on: t(1, 1645), job: 'SR03', first: t(1, 1500), last: t(2, 25) },
    b: { train: 'L50231 04', on: t(4, 245), job: 'S501-CO', first: t(4, 100), last: t(4, 1131) },
  };
  acc.rest.SR03 = { [t(2, 955)]: t(2, 30) };
  const r = R.finish(acc, { me: [{ turn: 'SR03', own: true, from: '2026-11-01 0000', to: '2026-11-02 2300' }, { turn: 'S501', craft: 'CO', own: true, from: '2026-11-03 0500', to: '2026-11-04 1116' }] }, t(4, 1116)).me;
  assert.equal(fmt(r.last.at), '3rd 0755');
  assert.equal(fmt(r.due), '11th 0244');
});

// Owner's SR11, 2026-11-04: one code on SR01, SB03, SA07, SB06 and SR11 for
// days at a time: several people. Only SR11's own stretch counts, and the
// time before it isn't known (no made-up reset from someone else's trips).
test('a code on two turns for hours at a time: only that turn, nothing before', () => {
  const acc = R.empty();
  acc.since = t(24, 0); acc.last = t(4, 1641);
  acc.turnTrips = { SB06: { b: { train: 'B 30', on: t(30, 1200), job: 'SB06', first: t(30, 1100), last: t(30, 2000) } },
    SR11: { s: { train: 'S 03', on: t(3, 100), job: 'SR11', first: t(3, 0), last: t(3, 800) } } };
  const people = { x: [{ turn: 'SB06', own: true, from: '2026-10-26 1200', to: '2026-11-04 1641' }, { turn: 'SR11', own: true, from: '2026-11-02 1454', to: '2026-11-04 1641' }] };
  assert.equal(R.byTurn(acc, people, t(4, 1641)).SR11, undefined);
  // A bump seen on both turns for 40 min is one person (owner's SR03 → S501).
  const one = { me: [{ turn: 'SR03', own: true, from: '2026-10-24 0300', to: '2026-10-25 1400' }, { turn: 'S501', craft: 'CO', own: true, from: '2026-10-25 1320', to: '2026-10-25 1400' }] };
  assert.equal(R.onTurn(one.me, {}, 'SR03').shared, false);
});

// Owner, 2026-11-04: off at 2355 gave a reset (RESETM32 3rd 0754); after
// 0000 it would have needed another night. With the off duty only an
// estimate, that reset is "possible".
test('a reset that hangs on an estimated off duty near midnight is possible', () => {
  const run = (how) => {
    const { acc, people } = week(); // his real week, Z14931 01 off 1st 2355
    acc.last = t(4, 1116);
    acc.trips.me.l = { train: 'L50231 04', on: t(4, 245), job: 'S501-CO', first: t(4, 100), last: t(4, 1100) };
    if (how !== 'rest') delete acc.rest.SR03[t(2, 955)]; // only the Call Board: 2nd 0045 − 30 min = 0015
    people.me = [{ turn: 'SR03', own: true, from: '2026-10-23 0000', to: '2026-11-02 2300' }, { turn: 'S501', craft: 'CO', own: true, from: '2026-11-03 0500', to: '2026-11-04 1116' }];
    return { r: R.finish(acc, people, t(4, 1116)).me, turn: R.byTurn(acc, people, t(4, 1116))['S501-CO'], all: R.personResets(acc, people, t(4, 1116)).me };
  };
  // Exact (REST): a sure reset, needed by 11th 0244, as CATS.
  const exact = run('rest');
  assert.deepEqual([fmt(exact.r.last.at), exact.r.last.possible, exact.turn.dueText, exact.turn.possible], ['3rd 0755', undefined, '11th 0244', undefined]);
  // Estimated (Call Board): possible; the board goes by the earlier deadline
  // (26th 0559 reset, back 26th 2045 → 2nd 2044) and says the later one too.
  // Estimated off 0015: 30 min earlier (2345) would give 3rd 0745.
  const est = run('callboard');
  assert.equal(est.r.last.possible, true);
  assert.deepEqual([est.turn.dueText, est.turn.laterText, est.turn.possibleText, est.turn.level], ['2nd 2044', '11th 0244', '3rd 0745', 'red']);
  assert.deepEqual(est.all.filter((x) => x.at > '2026-10-25').map((x) => `${x.at} ${x.possible ? 'possible' : 'sure'}`), ['2026-10-26 0559 sure', est.all[est.all.length - 1].at + ' possible']);
});

test('off duty from CATS\'s assignment history comes first, and is exact', () => {
  const acc = R.empty();
  R.collect(acc, { assignHistory: [{ train: 'Z14931 01', on: t(1, 1645), off: t(1, 2355) }] }, [], t(2, 100));
  // Call Board alone would say 2nd 0015; the history says 1st 2355.
  assert.deepEqual(R.offDuty({ train: 'Z14931 01', on: t(1, 1645), last: t(2, 45), job: 'SR03' }, 'SR03', acc), { off: t(1, 2355), how: 'history' });
  // Merged across days too.
  const all = R.merge(R.empty(), acc);
  assert.equal(R.offDuty({ train: 'Z14931 01', on: t(1, 1650), last: t(2, 45), job: 'SR03' }, 'SR03', all).how, 'history');
});

test('a rest shown while away (Garnet) is 8 h, like the bunkhouse', () => {
  const acc = R.empty();
  // Owner's CATS: L50231 04 on 4th 0245, off 1101; S501 at Garnet "rest until 4th 1901".
  R.collect(acc, { s5: [{ turn: 'S501', craft: 'CO', terminal: 1, restUntil: t(4, 1901) }] }, [], t(4, 1131));
  assert.deepEqual(R.offDuty({ train: 'L50231 04', on: t(4, 245), last: t(4, 1120), job: 'S501-CO' }, 'S501-CO', acc), { off: t(4, 1101), how: 'bunkhouse' });
});
