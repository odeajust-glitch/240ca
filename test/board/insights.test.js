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

// Owner, 2026-11-03: jobs the order says go spare that option 5 doesn't
// list ("30 minutes is fine"), with CATS listing it later and the crew.
test('insights: jobs missing from option 5', () => {
  const row = { train: 'E27861 02', order: '2nd 1920', call: '2nd 1705', status: 'PLN', crew: { co: 'SR05', en: 'SD01' }, rules: 'Chain Gang: SR05 + SD01 (goes spare)' };
  const snaps = [
    { taken: '2026-11-02 1200', screens: ['terminal'], lineup: [row], vacanciesCats: [] },
    { taken: '2026-11-02 1210', screens: [], lineup: [row] }, // option 5 not read: says nothing
    { taken: '2026-11-02 1215', screens: ['terminal'], lineup: [row], vacanciesCats: [], sameUntil: '2026-11-02 1240' },
    { taken: '2026-11-02 1245', screens: ['terminal'], lineup: [row], vacanciesCats: [{ train: 'E27861', cc: 'EN', turn: 'SD01' }] },
    { taken: '2026-11-02 1730', screens: ['terminal'], lineup: [], onDuty: [{ train: 'E27861 02', onDuty: '2nd 1705', crew: 'EN SD01 · CO SR05' }] },
  ];
  const m = Insights.finish(Insights.collect(snaps)).catsMissing;
  assert.equal(m.length, 1);
  assert.deepEqual([m[0].train, m[0].craft, m[0].turn, m[0].first, m[0].listedAt, m[0].minutes, m[0].crew],
    ['E27861 02', 'EN', 'SD01', '2026-11-02 1200', '2026-11-02 1245', 45, 'EN SD01 · CO SR05']);
  // Listed within 30 min: just CATS being slow, not counted.
  const quick = Insights.finish(Insights.collect([snaps[0], { ...snaps[3], taken: '2026-11-02 1220' }])).catsMissing;
  assert.equal(quick.length, 0);
});

// Owner, 2026-11-03: SD01 "** goes spare, return 2nd 2359" passed on DHT024B 02 isn't a runaround.
test('insights: runaround log, ** goes spare until after the call is explained', () => {
  const lineRow = { train: 'DHT024B 02', order: '2nd 0900', call: '2nd 0700', status: 'ORD', crew: { co: 'SR03', en: 'SD01' }, rules: 'Chain Gang: SR03 + SD01' };
  const snap0 = (st) => ({ taken: '2026-11-02 0646', lineup: [lineRow], pools: [{ name: 'SD · engineers', turns: [{ pos: '001', turn: 'SD01', status: st }] }, { name: 'Chain Gang (SR) · conductors', turns: [{ pos: '001', turn: 'SR03', status: 'available' }] }] });
  const went = { taken: '2026-11-02 0653', lineup: [], onDuty: [{ train: 'DHT024B 02', onDuty: '2nd 0900', crew: 'EN SD02 · CO SR03' }] };
  const r = (st) => Insights.finish(Insights.collect([snap0(st), went])).runLog.find((x) => x.passed === 'SD01');
  assert.equal(r('** goes spare, return 2nd 2359').result, 'explained');
  // Back before the call: still a likely runaround.
  assert.equal(r('** goes spare, return 2nd 0500').result, 'likely');
});

// Owner, 2026-11-03: DHT040B 31 showed B111 at the fast board (004); the
// deadhead was expected from the slow board, where B111 was 001.
test('insights: runaround log shows the board the spare was expected from', () => {
  const lineRow = { train: 'DHT040B 31', order: '31st 0900', call: '31st 0700', status: 'ORD', crew: { co: 'SR08', en: 'SD09' }, rules: 'Chain Gang: SR08 (goes spare → spareboard) + SD09' };
  const snaps = [
    { taken: '2026-10-31 0643', lineup: [lineRow], vacancies: [{ train: 'DHT040B', at: '31st 0900', cc: 'CO', turn: 'SR08', fill: { turn: 'B111', board: 'Conductor slow board', call: '31st 0700' } }],
      pools: [{ name: 'Conductor fast board', turns: [{ pos: '001', turn: 'B133', status: 'available' }, { pos: '004', turn: 'B111', status: 'available' }] },
        { name: 'Conductor slow board', turns: [{ pos: '001', turn: 'B111', status: 'available' }, { pos: '010', turn: 'B133', status: 'available' }] }] },
    { taken: '2026-10-31 0652', lineup: [], onDuty: [{ train: 'DHT040B 31', onDuty: '31st 0900', crew: 'EN SD09 · CO SR08', backfill: [{ craft: 'CO', job: 'SR08', turn: 'B133' }] }] },
  ];
  const r = Insights.finish(Insights.collect(snaps)).runLog.find((x) => x.passed === 'B111');
  assert.deepEqual([r.board, r.passedPos], ['Conductor slow board', '001']);
});

// Owner, 2026-11-03: M30241 19 planned 0534 (A pool SA05 + S103), went at
// 0345 with SR02 + SD02 (order moved before 0459): not a runaround.
test('insights: runaround log, the whole crew from another pool is explained', () => {
  const lineRow = { train: 'M30241 19', order: '21st 0534', call: '21st 0319', status: 'PLN', crew: { co: 'SA05', en: 'S103' }, rules: 'A pool: SA05 + S103' };
  const snaps = [
    { taken: '2026-10-21 0300', lineup: [lineRow], pools: [{ name: 'A pool (SA) · conductors', turns: [{ pos: '001', turn: 'SA05', status: 'available' }] }, { name: 'S1 (A) · engineers', turns: [{ pos: '001', turn: 'S103', status: 'available' }] }] },
    { taken: '2026-10-21 0310', lineup: [], onDuty: [{ train: 'M30241 19', onDuty: '21st 0345', crew: 'EN SD02 · CO SR02' }] },
  ];
  const log = Insights.finish(Insights.collect(snaps)).runLog;
  assert.deepEqual(log.map((r) => [r.passed, r.result]), [['SA05', 'explained'], ['S103', 'explained']]);
  assert.match(log[0].reason, /went to the Chain Gang, not the A pool/);
  // Same pool, another turn: still checked.
  const same = [snaps[0], { ...snaps[1], onDuty: [{ train: 'M30241 19', onDuty: '21st 0345', crew: 'EN S105 · CO SA07' }] }];
  assert.ok(Insights.finish(Insights.collect(same)).runLog.every((r) => r.result === 'likely'));
});

// Owner, 2026-11-10: "the 502 / 501 call stability data is messed up". Live
// data, 5th / 8th / 9th Nov: the line-up swapped the two 501/502 crews
// minutes before the call, then the Call Board showed the first crew.
test('insights: a last-minute crew swap on the line-up is not "taken off"', () => {
  const snap = (taken, x) => ({ taken, lineup: [], vacancies: [], onDuty: [], ...x });
  const l502 = (call, turn, status = 'PLN') => ({ train: 'L50231 08', call, status, crew: { co: turn, en: turn } });
  const st = Insights.collect([
    snap('2026-11-07 1745', { lineup: [l502('8th 0145', 'S501')] }), // 8 h out: asleep for 0145
    snap('2026-11-08 0223', { lineup: [l502('8th 0245', 'S501', 'ORD')] }),
    snap('2026-11-08 0259', { lineup: [l502('8th 0245', 'S502', 'ORD')] }), // swapped
    // S501 went; its engineer's job was filled by SA07.
    snap('2026-11-08 0308', { onDuty: [{ train: 'L50231 08', onDuty: '8th 0450', crew: 'EN S501 · CO S501', backfill: [{ craft: 'EN', job: 'S501', turn: 'SA07' }] }] }),
    snap('2026-11-08 0401', { lineup: [{ train: 'L50231 09', call: '9th 0145', status: 'PLN', crew: { co: 'S502', en: 'S502' } }] }),
    // L501 home is not the call for the L502 they wait on.
    snap('2026-11-08 2052', { lineup: [{ train: 'L50231 09', call: '9th 0145', status: 'PLN', crew: { co: 'S502', en: 'S502' } }], onDuty: [{ train: 'L50131 08', onDuty: '8th 2230', crew: 'EN S502 · CO S502' }] }),
    snap('2026-11-09 0107', { onDuty: [{ train: 'L50231 09', onDuty: '9th 0245', crew: 'EN S502 · CO S502', backfill: [{ craft: 'CO', job: 'S502', turn: 'B119' }] }] }),
  ]);
  const list = Insights.finish(st).sleep.map((z) => [z.turn, z.train, !!z.takenOff, z.expected, z.call || null, z.off ?? null]).sort();
  assert.deepStrictEqual(list, [
    // The conductor's real call, against the call slept on.
    ['S501-CO', 'L50231 08', false, '2026-11-08 0145', '2026-11-08 0250', 65],
    // The engineer's job went to a spare: taken off, at the swap.
    ['S501-EN', 'L50231 08', true, '2026-11-08 0145', null, null],
    // S502 on the 8th's train for one check is nothing; the 9th is its own
    // wait, each craft apart (the conductor's job was filled by B119).
    ['S502-EN', 'L50231 09', false, '2026-11-09 0145', '2026-11-09 0045', -60],
    ['S502-CO', 'L50231 09', true, '2026-11-09 0145', null, null],
  ].sort());
});

// One check with someone else on the train, then back: one wait, not two.
test('insights: off a train for one check and back on it keeps the wait', () => {
  const snap = (taken, x) => ({ taken, lineup: [], vacancies: [], onDuty: [], ...x });
  const m1 = (en) => ({ train: 'M1 20', call: '20th 0600', crew: { co: 'SR01', en } });
  const st = Insights.collect([
    snap('2026-10-20 0000', { lineup: [m1('SD10')] }),
    snap('2026-10-20 0300', { lineup: [m1('SD07')] }),
    snap('2026-10-20 0310', { lineup: [m1('SD10')] }),
    snap('2026-10-20 0610', { onDuty: [{ train: 'M1 20', onDuty: '20th 0800', crew: 'EN SD10 · CO SR01' }] }),
  ]);
  const list = Insights.finish(st).sleep.filter((z) => z.turn === 'SD10');
  assert.deepStrictEqual(list.map((z) => [!!z.takenOff, z.sleepAt, z.expected, z.off]), [[false, '2026-10-20 0000', '2026-10-20 0600', 0]]);
});

// Owner, 2026-11-10: "fix why 501 doesn't have the call stability graph".
// Live, 8th Nov: L50131 08 ordered 2130 at Garnet, moved to 2245; on duty 2230.
test('insights: L501 home is scored against the Garnet line-up, for whoever took L502 out', () => {
  const snap = (taken, x) => ({ taken, lineup: [], vacancies: [], onDuty: [], ...x });
  const out = { train: 'L50231 08', onDuty: '8th 0450', crew: 'EN S501 · CO S501', backfill: [{ craft: 'EN', job: 'S501', turn: 'SA07' }] };
  const st = Insights.collect([
    snap('2026-11-08 0308', { onDuty: [out] }),
    snap('2026-11-08 0528', { onDuty: [out], garnetLineup: [{ train: 'L50131 08', status: 'ORD', order: '8th 2130' }] }),
    snap('2026-11-08 1200', { garnetLineup: [{ train: 'L50131 08', status: 'ORD', order: '8th 2130' }] }),
    snap('2026-11-08 1938', { garnetLineup: [{ train: 'L50131 08', status: 'ORD', order: '8th 2245' }] }),
    snap('2026-11-08 2052', { onDuty: [{ train: 'L50131 08', onDuty: '8th 2230', crew: 'EN S501 · CO S501', backfill: [{ craft: 'EN', job: 'S501', turn: 'SA07' }] }] }),
  ]);
  const list = Insights.finish(st).sleep.filter((z) => z.train === 'L50131 08').map((z) => [z.turn, z.expected, z.call, z.off, z.shifts.length]).sort();
  // Planned call 1915 (order 2130 − 15 min − 2 h); called 2030: 1 h 15 m late, one move.
  assert.deepStrictEqual(list, [['S501-CO', '2026-11-08 1915', '2026-11-08 2030', 75, 1], ['SA07', '2026-11-08 1915', '2026-11-08 2030', 75, 1]]);
});

// Owner, 2026-11-10: "have a reasoning. ie job showing spare before call
// time ... or a train or extra job showing up". Live, 8th Nov: EN09 expected
// to fill M39491 at 9th 0205, then YMXS02 showed going spare for 8th 1500.
test('insights: a call that moved says why (a job new on the spare list, who took the old one)', () => {
  const A = require('../../public/board-analytics');
  const snap = (taken, x) => ({ taken, lineup: [], onDuty: [], screens: ['terminal'], vacancies: [], ...x });
  const job = (train, at, call, turn) => ({ pos: '001', at, train, cc: 'EN', fill: { turn, call, skipped: [] } });
  const st = Insights.collect([
    snap('2026-11-08 1405'),
    snap('2026-11-08 1412', { vacancies: [job('M39491', '9th 0420', '9th 0205', 'EN09')] }),
    snap('2026-11-08 1421', { vacancies: [job('YMXS02', '8th 1700', '8th 1500', 'EN09'), job('M39491', '9th 0420', '9th 0205', 'EN06')] }),
    snap('2026-11-08 1510', { yardJobs: [{ job: 'YMXS02', onDuty: '8th 1700', crew: 'EN EN09' }] }),
  ]);
  const [z] = Insights.finish(st).sleep.filter((x) => x.turn === 'EN09');
  assert.deepStrictEqual([z.firstTrain, z.firstWhy], ['M39491', 'M39491 first showed going spare at this check']);
  assert.strictEqual(z.timelineChanges[0].why, 'YMXS02 first showed going spare at this check; EN06 is on M39491 now (not on a list the check before)');
  const r = A.callReasons(z);
  assert.strictEqual(r.what, 'Called 11 h 05 m earlier than first planned');
  assert.deepStrictEqual(r.lines.map((l) => l.text), ['First lined up for M39491, call 9th 0205, only 48 m before the actual call', 'Moved to YMXS02, call 8th 1500']);
  assert.ok(A.renderCallTimelineV2(z).includes('class="ct2-why"'));
  // On time with plenty of notice: no Why block.
  assert.strictEqual(A.callReasons({ ...z, firstSeen: '2026-11-08 0100', firstCall: '2026-11-08 1500', expected: '2026-11-08 1500', timelineChanges: [] }), null);
});

// Owner, 2026-11-10: "trains originating in mac yard don't have the data for
// the graph". Toronto's rows carry the crew as words, the pair in pred.
test('insights: a Toronto line-up train is tracked for its crew', () => {
  const snap = (taken, x) => ({ taken, lineup: [], vacancies: [], onDuty: [], ...x });
  const row = (order, call, extra) => ({ train: 'Z14931 29', status: 'PLN', order, call, crew: 'SD03 + SR08', ...extra });
  const st = Insights.collect([
    snap('2026-10-29 0700', { macLineup: [row('29th 1700', '29th 1500', { pred: { co: 'SR08', en: 'SD03' } })] }),
    snap('2026-10-29 1200', { macLineup: [row('29th 1730', '29th 1530')] }), // an older build: words only
    snap('2026-10-29 1500', { onDuty: [{ train: 'Z14931 29', station: 'TORONTO', onDuty: '29th 1645', crew: 'EN SD03 · CO SR08' }] }),
  ]);
  const list = Insights.finish(st).sleep.map((z) => [z.turn, z.train, z.expected, z.call, z.off]).sort();
  // Planned call: order 1700 − 15 min − 2 h = 1445; called 1445 (on duty 1645 − 2 h).
  assert.deepStrictEqual(list, [['SD03', 'Z14931 29', '2026-10-29 1445', '2026-10-29 1445', 0], ['SR08', 'Z14931 29', '2026-10-29 1445', '2026-10-29 1445', 0]]);
});

// Owner, 2026-11-10: out of Toronto "the first lined should start when the
// crew goes off duty at the bunkhouse".
test('insights: Toronto notice starts at off duty in the bunkhouse, not when the train showed', () => {
  const snap = (taken, x) => ({ taken, lineup: [], vacancies: [], onDuty: [], ...x });
  const row = (extra) => ({ train: 'M39731 08', status: 'PLN', order: '8th 0800', call: '8th 0600', crew: 'S305 + SB05', pred: { co: 'SB05', en: 'S305' }, ...extra });
  const st = Insights.collect([
    // Still on their way to Toronto: lined up, but no wait yet.
    snap('2026-11-07 1200', { macLineup: [row({ crewPos: '', crewExpected: { offDuty: '7th 1849' } })] }),
    snap('2026-11-07 1700', { macLineup: [row({ crewPos: '', crewExpected: { offDuty: '7th 1849' } })] }),
    // In the bunkhouse, off duty 1849; first seen there at the 1900 check.
    snap('2026-11-07 1900', { macLineup: [row({ crewPos: '003' })], bunkhouse: [{ pos: '003', en: 'S305', co: 'SB05', offDuty: '7th 1849' }] }),
    snap('2026-11-08 0400', { onDuty: [{ train: 'M39731 08', station: 'TORONTO', onDuty: '8th 0745', crew: 'EN S305 · CO SB05' }] }),
  ]);
  const [z] = Insights.finish(st).sleep.filter((x) => x.turn === 'SB05');
  assert.deepStrictEqual([z.firstSeen, z.firstFrom, z.call, z.off], ['2026-11-07 1849', 'offDuty', '2026-11-08 0545', 0]);
  assert.strictEqual(z.firstWhy, 'off duty at the Toronto bunkhouse; M39731 08 was already on the line-up');
});

// Owner, 2026-11-10: a spare working a pool turn to Toronto had no graph for
// the train home (the line-up lists the turn, the Call Board the spare).
test('insights: the spare who took a turn to Toronto gets the wait for the train home', () => {
  const snap = (taken, x) => ({ taken, lineup: [], vacancies: [], onDuty: [], ...x });
  const out = { train: 'DHT039C 09', station: 'SARNIA', onDuty: '9th 0530', crew: 'EN SD03 · CO SR07', backfill: [{ craft: 'EN', job: 'SD03', turn: 'EN02' }] };
  const home = (extra) => ({ train: 'B73111 08', status: 'PLN', order: '9th 2115', call: '9th 1915', crew: 'SD03 + SR07', pred: { co: 'SR07', en: 'SD03' }, ...extra });
  const st = Insights.collect([
    snap('2026-11-09 0323', { onDuty: [out], macLineup: [home({ crewPos: '', crewExpected: { offDuty: '9th 0830' } })] }),
    snap('2026-11-09 0840', { macLineup: [home({ crewPos: '002' })], bunkhouse: [{ pos: '002', en: 'SD03', co: 'SR07', offDuty: '9th 0829' }] }),
    snap('2026-11-09 1915', { onDuty: [{ train: 'B73111 08', station: 'TORONTO', onDuty: '9th 2100', crew: 'EN SD03 · CO SR07', backfill: [{ craft: 'EN', job: 'SD03', turn: 'EN02' }] }] }),
  ]);
  const list = Insights.finish(st).sleep.filter((z) => z.train === 'B73111 08').map((z) => [z.turn, z.firstSeen, z.firstFrom, z.call, z.off]).sort();
  assert.deepStrictEqual(list, [['EN02', '2026-11-09 0829', 'offDuty', '2026-11-09 1900', 0], ['SR07', '2026-11-09 0829', 'offDuty', '2026-11-09 1900', 0]]);
});

// Owner, 2026-11-10: a yard job's id has no day in it. B116 worked YPRS30 on
// the 7th; lined up for it again on the 9th, nothing was recorded.
test('insights: the same yard job again two days later is its own call', () => {
  const snap = (taken, x) => ({ taken, lineup: [], onDuty: [], screens: ['terminal'], vacancies: [], ...x });
  const job = (at, call) => ({ pos: '001', at, train: 'YPRS30', cc: 'CO', yard: true, fill: { turn: 'B116', call, skipped: [] } });
  const st = Insights.collect([
    snap('2026-11-07 0700', { vacancies: [job('7th 1445', '7th 1245')] }),
    snap('2026-11-07 1300', { yardJobs: [{ job: 'YPRS30', onDuty: '7th 1445', crew: 'CO B116' }] }),
    // Still on the board for its shift: the same call, not a second one.
    snap('2026-11-07 1800', { yardJobs: [{ job: 'YPRS30', onDuty: '7th 1445', crew: 'CO B116' }] }),
    snap('2026-11-09 0520', { vacancies: [job('9th 1445', '9th 1245')] }),
    snap('2026-11-09 1300', { yardJobs: [{ job: 'YPRS30', onDuty: '9th 1445', crew: 'CO B116' }] }),
  ]);
  const list = Insights.finish(st).sleep.filter((z) => z.turn === 'B116').map((z) => [z.train, z.onDuty, z.expected, z.off]);
  assert.deepStrictEqual(list, [['YPRS30', '2026-11-07 1445', '2026-11-07 1245', 0], ['YPRS30', '2026-11-09 1445', '2026-11-09 1245', 0]]);
});

// Owner, 2026-11-10: "anything that is dropped without being called it need
// to be noticable ... the graph should keep going. Only ... in the 8 hour
// window"; an ordered time that changes "needs to be noted"; and for a
// removed turn "who else is shown on the job and why".
test('insights: a job pulled without a call, an ordered time that moved, and who replaced a turn', () => {
  const A = require('../../public/board-analytics');
  const snap = (taken, x) => ({ taken, lineup: [], vacancies: [], onDuty: [], pools: [], ...x });
  const row = (train, call, co, status = 'PLN') => ({ train, call, status, crew: { co, en: '' } });
  const st = Insights.collect([
    snap('2026-11-09 1800', { lineup: [row('M1 09', '9th 2200', 'SR01'), row('M2 10', '10th 0200', 'SR02')] }),
    // M1 is gone from the line-up and from the Call Board: pulled. SR01 moves to M2, SR02 to M3.
    snap('2026-11-09 1900', { lineup: [row('M2 10', '10th 0200', 'SR01', 'ORD'), row('M3 10', '10th 0600', 'SR02')] }),
    // The ordered time moves.
    snap('2026-11-09 2000', { lineup: [row('M2 10', '10th 0300', 'SR01', 'ORD'), row('M3 10', '10th 0600', 'SR02')] }),
    // SR09 shows on M3 in SR02's place.
    snap('2026-11-10 0100', { lineup: [row('M3 10', '10th 0600', 'SR09')], onDuty: [{ train: 'M2 10', onDuty: '10th 0500', crew: 'CO SR01' }], pools: [{ name: 'Chain Gang', turns: [{ turn: 'SR02', status: 'rest until 10th 0900' }] }] }),
    snap('2026-11-10 0140', { lineup: [row('M3 10', '10th 0600', 'SR09')] }),
  ]);
  const list = Insights.finish(st).sleep;
  const z = list.find((x) => x.turn === 'SR01');
  assert.deepStrictEqual(z.timelineChanges.map((c) => [c.taken.slice(11), c.train, c.dropped || '', c.orderFrom ? c.orderFrom.slice(11) : '']), [['1900', 'M2 10', 'M1 09', ''], ['2000', 'M2 10', '', '0200']]);
  const html = A.renderCallTimelineV2(z);
  for (const text of ['Job pulled without a call', 'M1 09', 'then lined up for M2 10', 'Ordered time changed', 'job pulled without a call', 'ordered time changed']) assert.ok(html.includes(text), text);
  const off = list.find((x) => x.turn === 'SR02' && x.takenOff);
  assert.deepStrictEqual([off.train, off.replacedBy, off.replacedWhy, off.ownStatus], ['M3 10', 'SR09', 'not on a list the check before', 'rest until 10th 0900']);
  assert.ok(A.renderCallTimelineV2(off).includes('Now on M3 10'));
});

// A train that leaves the line-up and comes back was not pulled.
test('insights: a train off the line-up for a check and back is not a pulled job', () => {
  const snap = (taken, x) => ({ taken, lineup: [], vacancies: [], onDuty: [], ...x });
  const row = (train, call, co) => ({ train, call, status: 'PLN', crew: { co, en: '' } });
  const st = Insights.collect([
    snap('2026-11-09 1800', { lineup: [row('M1 09', '9th 2200', 'SR01'), row('M2 10', '10th 0200', 'SR02')] }),
    snap('2026-11-09 1900', { lineup: [row('M2 10', '10th 0200', 'SR01')] }),
    snap('2026-11-09 1910', { lineup: [row('M1 09', '9th 2200', 'SR01'), row('M2 10', '10th 0200', 'SR02')] }),
    snap('2026-11-09 2010', { onDuty: [{ train: 'M1 09', onDuty: '10th 0000', crew: 'CO SR01' }] }),
  ]);
  const z = Insights.finish(st).sleep.find((x) => x.turn === 'SR01');
  assert.ok(!z.timelineChanges.some((c) => c.dropped));
});

// Yardmaster jobs going spare (owner, 2026-11-13: "can you see YM jobs that go spare, if you have been
// recording them can you show me what you know"): option 5's CC YA rows, kept apart from the jobs above.
test('insights: yardmaster jobs going spare, one a job and start, and the shift on the Call Board', () => {
  const snap = (taken, extra) => ({ taken, sequence: [], vacancies: [], onDuty: [], yardJobs: [], ...extra });
  const ysty = { pos: '002', at: '15th 0630', status: 'PLANNED', train: 'YSTY01', pool: 'YD', cc: 'YA', st: '', returns: '', turn: 'YSTY01' };
  const ysby = { pos: '004', at: '15th 1900', status: 'PLANNED', train: 'YSBY04', pool: 'YD', cc: 'YA', st: '', returns: '', turn: 'YSBY04' };
  const f = Insights.finish(Insights.collect([
    snap('2026-11-14 2200', { yardmasterJobs: [ysty] }),
    snap('2026-11-15 0300', { yardmasterJobs: [ysty, ysby] }),
    snap('2026-11-15 0600', { yardmasterJobs: [{ ...ysty, status: 'ORDERED' }, ysby] }),
    // YSTY01 on duty with a turn named; YSBY01 (another job) is not YSBY04's shift.
    snap('2026-11-15 0700', { yardmasterJobs: [ysby], yardJobs: [{ job: 'YSTY01', onDuty: '15th 0630', crew: 'YA SA01' }, { job: 'YSBY01', onDuty: '15th 0700', crew: 'YA B105' }] }),
    // A later check whose Call Board names nobody on YSTY01 doesn't wipe SA01.
    snap('2026-11-15 0900', { yardJobs: [{ job: 'YSTY01', onDuty: '15th 0630', crew: '' }] }),
    // YSBY04 on duty at 1900 with nobody on a board: seen, no turn named.
    snap('2026-11-15 1930', { yardJobs: [{ job: 'YSBY04', onDuty: '15th 1900', crew: '' }] }),
    // The next day's YSTY01 is another one; a run 6 h off its start is not its shift.
    snap('2026-11-16 0400', { yardmasterJobs: [{ ...ysty, at: '16th 0630' }], yardJobs: [{ job: 'YSTY01', onDuty: '16th 1230', crew: 'YA SB02' }] }),
  ]));
  assert.deepStrictEqual(f.yardmasterJobs.map((j) => [j.train, j.at, j.first, j.last, j.checks, j.status, j.onDuty || null, j.crew ?? null]), [
    ['YSTY01', '2026-11-15 0630', '2026-11-14 2200', '2026-11-15 0600', 3, 'ORDERED', '2026-11-15 0630', 'YA SA01'],
    ['YSBY04', '2026-11-15 1900', '2026-11-15 0300', '2026-11-15 0700', 3, 'PLANNED', '2026-11-15 1900', ''],
    ['YSTY01', '2026-11-16 0630', '2026-11-16 0400', '2026-11-16 0400', 1, 'PLANNED', null, null],
  ]);
  // Never mixed into the jobs going spare.
  assert.deepStrictEqual(f.spareJobs, []);
});
