const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Insights = require('../../lib/board/insights');
const Archive = require('../../lib/board/archive');

// For Analytics (owner, 2026-10-26).
test('insights: runarounds once per train, jobs going spare and who filled them', () => {
  const snap = (taken, extra) => ({ taken, sequence: [], vacancies: [], onDuty: [], ...extra });
  const job = { train: 'Y123', pool: 'SR', cc: 'CO', turn: 'SR04', at: '20th 0800', fill: { turn: 'B119' } };
  const st = Insights.collect([
    snap('2026-10-20 0600', { sequence: [{ order: '20th 0700', train: 'M38261 20', expected: 'SR', actual: 'A', turn: 'SA04' }, { train: 'M1 20', expected: 'SR', actual: 'MU' }], vacancies: [job] }),
    snap('2026-10-20 0700', { sequence: [{ order: '20th 0700', train: 'M38261 20', expected: 'SR', actual: 'A', turn: 'SA04' }], vacancies: [job] }),
    snap('2026-10-20 0800', { onDuty: [{ train: 'Y123', backfill: [{ craft: 'CO', job: 'SR04', turn: 'B120' }] }, { train: 'M38261 20', onDuty: '20th 0745', crew: 'EN S104 · CO SA04', station: 'SARNIA' }] }),
    // Listed again two days later: a new vacancy.
    snap('2026-10-22 0600', { vacancies: [job] }),
    // A blip: out of sequence once, then counted right.
    snap('2026-10-22 0700', { sequence: [{ train: 'M2 22', expected: 'SR', actual: 'A', turn: 'SA01' }] }),
    snap('2026-10-22 0705', { sequence: [{ train: 'M2 22', expected: 'SR', actual: 'SR', turn: 'SR01' }] }),
    // The same job the next morning (22 h later) is another one.
    snap('2026-10-23 0400', { vacancies: [job] }),
  ]);
  const f = Insights.finish(st);
  // Shown wrong twice in a row, then on duty: a runaround, with the crew that went.
  // The blip on M2 22 is kept but marked fixed.
  assert.deepStrictEqual(f.runarounds.map((r) => [r.train, r.expected, r.actual, r.turn, r.taken, r.fixed, r.wrongChecks]),
    [['M38261 20', 'SR', 'A', 'SA04', '2026-10-20 0600', false, 2], ['M2 22', 'SR', 'A', 'SA01', '2026-10-22 0700', true, 1]]);
  assert.deepStrictEqual(f.runarounds[0].stretches, [{ from: '2026-10-20 0600', to: '2026-10-20 0700', checks: 2, expected: 'SR', actual: 'A', turn: 'SA04' }]);
  assert.deepStrictEqual([f.runarounds[0].onDuty, f.runarounds[0].crew], ['2026-10-20 0745', 'EN S104 · CO SA04']);
  assert.deepStrictEqual(f.runarounds[1].final, { expected: 'SR', actual: 'SR', turn: 'SR01' });
  assert.strictEqual(f.spareJobs.length, 3);
  assert.deepStrictEqual([f.spareJobs[0].predicted, f.spareJobs[0].filledBy, f.spareJobs[0].last], ['B119', 'B120', '2026-10-20 0700']);
  assert.strictEqual(f.spareJobs[1].filledBy, undefined);
});

test('archive: keeps what falls off the site, publishes only the older part', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'arch-')), 'a.json');
  const train = (id, onDuty) => ({ id, month: '2026-10', day: onDuty.slice(0, 10), firstSeen: onDuty, onDuty, crew: 'CO SR03', events: [{}] });
  const turns = (at) => ({ SR03: { orders: [{ train: 'M1 01', onDuty: 'x', onDutyAt: at.slice(8, 10) + 'th ' + at.slice(11), onDutySeen: at }], spares: [{ seen: at, last: at, text: 'B0' }], rests: [] } });
  const none = { runarounds: [], spareJobs: [], sleep: [] };
  // First build: the site runs from the 1st.
  let a = Archive.update(Archive.load(file), { trains: [train('M1 01', '2026-10-01 0500')], turns: turns('2026-10-01 0500'),
    people: { h1: [{ turn: 'SR03', own: true, from: '2026-10-01 0400', to: '2026-10-01 0600' }] }, insights: { ...none, runarounds: [{ train: 'M1 01', taken: '2026-10-01 0500' }] } },
  '2026-10-01', { now: new Date('2026-10-02T12:00:00Z') });
  Archive.save(file, a);
  assert.deepStrictEqual(Archive.forSite(a, '2026-10-01').trains, []);
  // A month on, the 1st has fallen off the site: it comes from the archive.
  a = Archive.update(Archive.load(file), { trains: [train('M9 05', '2026-11-05 0500')], turns: {}, people: {}, insights: none },
    '2026-10-31', { now: new Date('2026-11-05T12:00:00Z') });
  const site = Archive.forSite(a, '2026-10-31');
  assert.deepStrictEqual(site.trains.map((r) => [r.id, r.events]), [['M1 01', undefined]]);
  assert.deepStrictEqual(site.work.SR03.map((o) => [o.train, o.at]), [['M1 01', '2026-10-01 0500']]);
  assert.deepStrictEqual([site.spares.SR03.map((x) => x.seen), site.people.h1.length, site.runarounds.length], [['2026-10-01 0500'], 1, 1]);
  assert.ok(a.trains.some((r) => r.id === 'M9 05'));
  // F7: published a month per file.
  const { index, parts } = Archive.byMonth(site);
  assert.deepStrictEqual(index, { since: '2026-10-31', months: ['2026-10'] });
  assert.deepStrictEqual([parts['2026-10'].trains.length, parts['2026-10'].work.SR03.length, parts['2026-10'].people.h1.length], [1, 1, 1]);
  // Older than the keep time: gone.
  a = Archive.update(a, { trains: [], turns: {}, people: {}, insights: none }, '2027-10-31', { now: new Date('2027-12-01T12:00:00Z') });
  assert.deepStrictEqual(a.trains, []);
});

// Fable review (2026-10-26): something running over the site's first day
// is in the archive and rebuilt by the site; it counts once.
test('archive: a rest, a goes-spare, a runaround and a spare job over the first day count once', () => {
  const A = require('../../public/board-analytics');
  const none = { runarounds: [], spareJobs: [], sleep: [] };
  const rest = { kind: 'Rest', until: '2nd 0600' };
  // Built on the 1st: seen from the evening of the 1st.
  let a = Archive.update(Archive.load('/nonexistent'), {
    trains: [{ id: 'M1 01', month: '2026-10', firstSeen: '2026-10-01 2100', onDuty: '2026-10-02 0100', events: [{}] }],
    turns: { SR03: { orders: [], spares: [{ seen: '2026-10-01 2200', last: '2026-10-01 2355', text: 'B0' }], rests: [{ ...rest, seen: '2026-10-01 2200' }] } },
    people: {}, insights: { ...none, runarounds: [{ train: 'M38261 01', taken: '2026-10-01 2100' }], spareJobs: [{ train: 'Y1', turn: 'SR04', first: '2026-10-01 2200', last: '2026-10-01 2355' }] },
  }, '2026-09-02', { now: new Date('2026-10-02T12:00:00Z') });
  // The next build starts on the 2nd: the same things, picked up at 0000.
  const live = {
    trains: [{ id: 'M1 01', month: '2026-10', firstSeen: '2026-10-02 0000', onDuty: '2026-10-02 0100', events: [{}] }],
    turns: { SR03: { orders: [], spares: [{ seen: '2026-10-02 0000', last: '2026-10-02 0200', text: 'B0' }], rests: [{ ...rest, seen: '2026-10-02 0000' }] } },
    people: {}, insights: { ...none, runarounds: [{ train: 'M38261 01', taken: '2026-10-02 0000' }], spareJobs: [{ train: 'Y1', turn: 'SR04', first: '2026-10-02 0000', last: '2026-10-02 0100', filledBy: 'B119' }] },
  };
  a = Archive.update(a, live, '2026-10-02', { now: new Date('2026-10-03T12:00:00Z') });
  assert.deepStrictEqual([a.trains.length, a.spares.SR03.length, a.rests.SR03.length, a.runarounds.length, a.spareJobs.length], [1, 1, 1, 1, 1]);
  assert.strictEqual(a.trains[0].firstSeen, '2026-10-01 2100'); // the copy that saw the start
  assert.strictEqual(a.spareJobs[0].filledBy, 'B119'); // learned later, kept
  // The page joins the published part to its own data the same way.
  const site = Archive.forSite(a, '2026-10-02');
  assert.strictEqual(A.joinOld('rests', site.rests.SR03, live.turns.SR03.rests).length, 1);
  assert.strictEqual(A.joinOld('spares', site.spares.SR03, live.turns.SR03.spares).length, 1);
  assert.strictEqual(A.joinOld('runarounds', site.runarounds, live.insights.runarounds).length, 1);
  assert.strictEqual(A.joinOld('trains', site.trains, live.trains).length, 1);
  assert.strictEqual(A.joinOld('spareJobs', site.spareJobs, live.insights.spareJobs).length, 1);
});

// Sleep tracker (owner, 2026-10-26).
test('insights: sleep tracker, the call they slept on vs the real call', () => {
  const snap = (taken, extra) => ({ taken, lineup: [], vacancies: [], onDuty: [], ...extra });
  const row = (train, call, co, en) => ({ train, call, crew: { co, en } });
  const st = Insights.collect([
    snap('2026-10-20 0000', { lineup: [row('M1 20', '20th 1200', 'SR03', 'SD07')] }), // 12 h out: still awake
    snap('2026-10-20 0400', { lineup: [row('M1 20', '20th 1200', 'SR03', 'SD07')] }), // 8 h out: asleep, call 1200
    snap('2026-10-20 0600', { lineup: [row('M1 20', '20th 1100', 'SR03', 'SD07'), row('M5 20', '20th 1300', 'SR05', '')] }), // moved; SR05 only 7 h out
    snap('2026-10-20 0900', { lineup: [row('M2 20', '20th 1030', 'SR03', 'SD07'), row('M5 20', '20th 1300', 'SR05', '')],
      vacancies: [{ train: 'Y1', fill: { turn: 'B119', call: '20th 1000' } }] }), // another train
    snap('2026-10-20 1100', { onDuty: [{ train: 'M2 20', onDuty: '20th 1245', crew: 'EN SD07 · CO SR03' },
      { train: 'Y1', onDuty: '20th 1205', crew: 'CO SR04', backfill: [{ job: 'SR04', turn: 'B119' }] }] }),
    snap('2026-10-20 1105', { onDuty: [{ train: 'M2 20', onDuty: '20th 1245', crew: 'EN SD07 · CO SR03' }] }), // seen again: not twice
    snap('2026-10-20 1500', { onDuty: [{ train: 'M5 20', onDuty: '20th 1500', crew: 'CO SR05' }], lineup: [row('L50220 20', '20th 1700', 'S501', 'S501')] }),
    snap('2026-10-20 1900', { onDuty: [{ train: 'L50220 20', onDuty: '20th 1900', crew: 'EN S501 · CO S501' }] }),
  ]);
  const z = Object.fromEntries(Insights.finish(st).sleep.map((x) => [x.turn, x]));
  // 501/502: conductor and engineer kept apart.
  assert.deepStrictEqual(Object.keys(z).sort(), ['B119', 'S501-CO', 'S501-EN', 'SD07', 'SR03', 'SR05']);
  assert.deepStrictEqual([z.SR03.sleepAt, z.SR03.expected, z.SR03.call, z.SR03.off, z.SR03.train, z.SR03.short], ['2026-10-20 0400', '2026-10-20 1200', '2026-10-20 1045', -75, 'M2 20', false]);
  assert.deepStrictEqual(z.SR03.shifts.map((x) => [x.call, x.train]), [['2026-10-20 1100', 'M1 20'], ['2026-10-20 1030', 'M2 20']]);
  assert.deepStrictEqual([z.SR05.short, z.SR05.notice, z.SR05.off], [true, 420, 0]);
  // The spare person filling the job, not the job's own turn.
  assert.deepStrictEqual([z.B119.train, z.B119.off, z.B119.short], ['Y1', 5, true]);
});

test('analytics: sleep scored green / yellow / red', () => {
  const A = require('../../public/board-analytics');
  const list = [{ turn: 'SR03', off: -30 }, { turn: 'SR03', off: 45 }, { turn: 'SR03', off: -75, shifts: [{}, {}] }, { turn: 'SR05', off: 0, short: true }];
  assert.deepStrictEqual(list.map((z) => A.sleepBand(z.off)), ['ok', 'warn', 'bad', 'ok']);
  const st = A.sleepStats(list);
  assert.deepStrictEqual([st.n, st.ok, st.warn, st.bad, st.earlier, st.later, st.short, st.avg], [4, 2, 1, 1, 1, 1, 1, 38]);
  assert.deepStrictEqual([st.earlierAvg, st.earlierAll, st.laterAvg, st.laterAll], [53, 2, 45, 1]);
  assert.deepStrictEqual(A.sleepByTurn(list).map((t) => [t.turn, t.n, t.bad]), [['SR03', 3, 1], ['SR05', 1, 0]]);
});

// Owner, 2026-10-26: "M38261 26 (ORD 26th 1700) is ordered for A but the
// sequence says B": every check it shows that, then the crew that went.
test('insights: a line-up train ordered for the wrong pool, then the crew that went', () => {
  const ahead = (taken) => ({ taken, sequenceAhead: [{ order: '26th 1700', train: 'M38261 26', expected: 'B', actual: 'A', turn: 'SA04' }] });
  const st = Insights.collect([ahead('2026-10-26 1300'), ahead('2026-10-26 1305'), ahead('2026-10-26 1310'),
    { taken: '2026-10-26 1500', onDuty: [{ train: 'M38261 26', onDuty: '26th 1445', crew: 'EN S104 · CO SA04', station: 'SARNIA' }],
      sequence: [{ order: '26th 1700', train: 'M38261 26', expected: 'B', actual: 'A', turn: 'SA04' }] }]);
  const [r] = Insights.finish(st).runarounds;
  // Four checks in a row showed it wrong (one stretch), and it went that way.
  assert.deepStrictEqual([r.train, r.wrongChecks, r.stretches.length, r.stretches[0].from, r.stretches[0].to, r.fixed, r.crew, r.onDuty],
    ['M38261 26', 4, 1, '2026-10-26 1300', '2026-10-26 1500', false, 'EN S104 · CO SA04', '2026-10-26 1445']);
});

// Owner, 2026-10-26 (option A): taken off the line-up after going to sleep
// ends that wait; the next line-up is a new one (no 14 h "miss").
test('insights: sleep wait ends when taken off the line-up', () => {
  const A = require('../../public/board-analytics');
  const snap = (taken, x) => ({ taken, lineup: [], vacancies: [], onDuty: [], ...x });
  const st = Insights.collect([
    snap('2026-10-20 0000', { lineup: [{ train: 'M1 20', call: '20th 0600', crew: { co: 'SR01', en: 'SD10' } }] }), // asleep for 0600
    snap('2026-10-20 0300', { lineup: [{ train: 'M1 20', call: '20th 0600', crew: { co: 'SR01', en: 'SD07' } }] }), // M1 has SD07 now
    snap('2026-10-20 1700', { lineup: [{ train: 'M9 20', call: '20th 2000', crew: { co: 'SR02', en: 'SD10' } }] }), // lined up again
    snap('2026-10-20 2100', { onDuty: [{ train: 'M9 20', onDuty: '20th 2215', crew: 'EN SD10 · CO SR02' }] }),
    // SR01 is off every line-up for 4 h (its train gone too): taken off.
    snap('2026-10-20 0700', { lineup: [{ train: 'M5 20', call: '20th 2300', crew: { co: 'SR05', en: '' } }] }),
  ].sort((a, b) => (a.taken < b.taken ? -1 : 1)));
  const list = Insights.finish(st).sleep.filter((z) => z.turn === 'SD10');
  assert.deepStrictEqual(list.map((z) => [!!z.takenOff, z.expected, z.off ?? null]),
    [[true, '2026-10-20 0600', null], [false, '2026-10-20 2000', 15]]);
  assert.strictEqual(list[0].lastListed, '2026-10-20 0000');
  const sr01 = Insights.finish(st).sleep.filter((z) => z.turn === 'SR01');
  assert.deepStrictEqual(sr01.map((z) => [!!z.takenOff, z.seen]), [[true, '2026-10-20 0700']]);
  const s = A.sleepStats(list);
  assert.deepStrictEqual([s.n, s.takenOff, s.ok, s.avg], [1, 1, 1, 15]);
});

// Owner, 2026-11-02: "track these errors in CATS" (option 5 vs the order).
test('insights: CATS option 5 errors, once each, with the crew that went', () => {
  const err = { train: 'E27861 02', craft: 'CO', cats: 'SA09', catsPool: 'SA', order: 'SR05', orderSpare: false, at: '2026-11-02 1920', wouldCall: 'B134', call: '2026-11-02 1705' };
  const blip = { ...err, train: 'M39671 01', cats: 'SA02', order: 'SR08' };
  const lineup = [{ train: 'E27861 02' }, { train: 'M39671 01' }];
  const snaps = [
    { taken: '2026-11-02 1215', lineup, catsErrors: [err, blip] },
    { taken: '2026-11-02 1220', lineup, catsErrors: [err] },
    { taken: '2026-11-02 1231', lineup, catsErrors: [err], sameUntil: '2026-11-02 1500' },
    { taken: '2026-11-02 1810', lineup: [], onDuty: [{ train: 'E27861 02', onDuty: '2nd 1720', crew: 'EN EN04 · CO SR05' }] },
  ];
  const found = Insights.finish(Insights.collect(snaps));
  assert.equal(found.catsErrors.length, 1); // the one-check blip isn't counted
  const r = found.catsErrors[0];
  assert.deepEqual([r.train, r.cats, r.order, r.wouldCall, r.first, r.last, r.checks, r.fixed, r.crew],
    ['E27861 02', 'SA09', 'SR05', 'B134', '2026-11-02 1215', '2026-11-02 1500', 3, null, 'EN EN04 · CO SR05']);
  // CATS correcting itself while the train is still on the line-up.
  const fixed = Insights.finish(Insights.collect([snaps[0], snaps[1], { taken: '2026-11-02 1240', lineup, catsErrors: [] }])).catsErrors[0];
  assert.equal(fixed.fixed, '2026-11-02 1240');
});

// Owner, 2026-11-02: "trains that should have been called according to the
// plan but haven't been ordered … how long it sits stale" (pause when the
// plan moves later; counted once 15 min past the call).
test('insights: stale trains, E27861 02 past its call and not ordered', () => {
  const row = (order, call, status = 'PLN') => ({ train: 'E27861 02', order, call, status, crew: { co: 'SR05', en: 'SD01' } });
  const snap = (taken, lineup, extra = {}) => ({ taken, lineup, ...extra });
  const snaps = [
    snap('2026-11-02 1231', [row('2nd 1920', '2nd 1705')]),
    snap('2026-11-02 1635', [row('2nd 1854', '2nd 1639')]),
    snap('2026-11-02 1640', [row('2nd 1854', '2nd 1639')], { sameUntil: '2026-11-02 1711' }), // the board unchanged till 17:11
    snap('2026-11-02 1745', [row('2nd 1930', '2nd 1715')]),
    snap('2026-11-02 1805', [row('2nd 1945', '2nd 1730', 'ORD')]),
    snap('2026-11-02 1930', [], { onDuty: [{ train: 'E27861 02', onDuty: '2nd 1930', crew: 'EN EN04 · CO SR05' }, { train: 'YFLS60', onDuty: '2nd 2359' }] }),
  ];
  const r = Insights.finish(Insights.collect(snaps)).stale;
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].train, r[0].from, r[0].minutes, r[0].maxPast, r[0].end, r[0].moves, r[0].crew, r[0].ordered, r[0].wentCrew],
    ['E27861 02', '2026-11-02 1640', 85, 32, 'ordered', 1, 'SR05 + SD01', '2026-11-02 1805', 'EN EN04 · CO SR05']);
  // The plan moved later and the call is ahead again: paused, then a second stretch.
  const paused = Insights.finish(Insights.collect([
    snap('2026-11-02 1700', [row('2nd 1854', '2nd 1639')]),
    snap('2026-11-02 1720', [row('2nd 2100', '2nd 1845')]),
    snap('2026-11-02 1905', [row('2nd 2100', '2nd 1845')]),
  ])).stale[0];
  assert.deepEqual(paused.stretches.map((x) => [x.from, x.to, x.end || 'open']), [['2026-11-02 1700', '2026-11-02 1720', 'pushed'], ['2026-11-02 1905', '2026-11-02 1905', 'open']]);
  // Only 5 min past before it was ordered: not counted.
  assert.equal(Insights.finish(Insights.collect([snap('2026-11-02 1644', [row('2nd 1854', '2nd 1639')]), snap('2026-11-02 1650', [row('2nd 1854', '2nd 1639', 'ORD')])])).stale.length, 0);
});

// Owner, 2026-11-02: the runaround log, all boards, no alerts yet.
test('insights: runaround log against the order at the last check before', () => {
  const lineRow = (train, co, en, rules) => ({ train, order: '2nd 1500', call: '2nd 1245', status: 'ORD', crew: { co, en }, rules });
  const pools = (rows) => [{ name: 'Chain Gang (SR) · conductors', turns: rows }, { name: 'Engineer slow board', turns: [{ pos: '003', turn: 'EN04', status: 'available' }] }];
  const snaps = [
    // M38261 02: the order has SR03 + SD05; SR07 went. SR03 was free: likely.
    // M39671 01: the order has SR08 + SD09 (goes spare, EN04 to fill); EN12 filled it: likely (spareboard).
    // E27861 02: the order has SR05; SR10 went, but SR05 was on rest past the call: explained.
    { taken: '2026-11-02 1230', pools: pools([{ pos: '001', turn: 'SR03', status: 'available' }, { pos: '002', turn: 'SR05', status: 'rest until 2nd 1400' }]),
      lineup: [lineRow('M38261 02', 'SR03', 'SD05', 'Chain Gang: SR03 + SD05'), lineRow('M39671 01', 'SR08', 'SD09', 'Chain Gang: SR08 + SD09 (goes spare)'), lineRow('E27861 02', 'SR05', 'SD01', 'Chain Gang: SR05 + SD01')],
      vacancies: [{ train: 'M39671', at: '2nd 1500', cc: 'EN', turn: 'SD09', fill: { turn: 'EN04', call: '2nd 1245' } }] },
    { taken: '2026-11-02 1300', lineup: [], onDuty: [
      { train: 'M38261 02', onDuty: '2nd 1500', crew: 'EN SD05 · CO SR07' },
      { train: 'M39671 01', onDuty: '2nd 1500', crew: 'EN SD09 · CO SR08', backfill: [{ craft: 'EN', job: 'SD09', turn: 'EN12' }] },
      { train: 'E27861 02', onDuty: '2nd 1500', crew: 'EN SD01 · CO SR10' },
    ] },
  ];
  const log = Insights.finish(Insights.collect(snaps)).runLog;
  const row = (train) => log.find((r) => r.train === train);
  assert.deepEqual(log.map((r) => [r.train, r.craft, r.passed, r.went, r.kind, r.result]), [
    ['M38261 02', 'CO', 'SR03', 'SR07', 'turn', 'likely'],
    ['M39671 01', 'EN', 'EN04', 'EN12', 'spare', 'likely'],
    ['E27861 02', 'CO', 'SR05', 'SR10', 'turn', 'explained'],
  ]);
  assert.equal(row('M38261 02').passedPos, '001');
  assert.match(row('E27861 02').reason, /^on rest until 2nd 1400, after the call/);
  // The same train seen again on the Call Board: not logged twice.
  const again = Insights.finish(Insights.collect([...snaps, { ...snaps[1], taken: '2026-11-02 1305' }])).runLog;
  assert.equal(again.length, 3);
  // The order last seen long before: only possible.
  const late = Insights.finish(Insights.collect([snaps[0], { ...snaps[1], taken: '2026-11-02 1700' }])).runLog;
  assert.equal(late.find((r) => r.train === 'M38261 02').result, 'possible');
});
