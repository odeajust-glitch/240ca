const test = require('node:test');
const assert = require('node:assert');
const A = require('../../public/board-analytics');

// trains.json rows, as BoardTrains.summarize gives them (only what's used).
const row = (id, onDuty, extra = {}) => ({ id, month: '2026-10', day: (onDuty || '2026-10-20').slice(0, 10), onDuty, crew: '', orderChanges: 0, events: [], ...extra });

test('analytics: "148" matches every x148xx, any letter and origin day', () => {
  for (const id of ['M14831 26', 'Q14821 03', 'A148 01']) assert.ok(A.trainMatches(id, '148'), id);
  for (const id of ['M31482 26', 'M14931 26', 'M11482 01']) assert.ok(!A.trainMatches(id, '148'), id);
  assert.ok(A.trainMatches('M14831 26', 'm148'));
  assert.ok(!A.trainMatches('Q14821 03', 'M148'));
  assert.ok(A.trainMatches('M14831 26', 'M14831 26'));
  assert.ok(!A.trainMatches('M14831 25', 'M14831 26'));
});

test('analytics: works out a train number, a turn or a name code', () => {
  const trains = [row('M14831 26', null)];
  assert.strictEqual(A.kindOf('148', ['SR03']), 'train');
  assert.strictEqual(A.kindOf('M14831 26', ['SR03']), 'train');
  assert.strictEqual(A.kindOf('m148', ['SR03'], trains), 'train');
  assert.strictEqual(A.kindOf('sr03', ['SR03']), 'turn');
  assert.strictEqual(A.kindOf('S501-CO', ['S501']), 'turn');
  assert.strictEqual(A.kindOf('B119', []), 'turn');
  assert.strictEqual(A.kindOf('JUOD', ['SR03']), 'code');
  assert.strictEqual(A.kindOf('', []), null);
});

test('analytics: on-duty times read around the clock', () => {
  const t = A.timeOfDay(['2026-10-20 2330', '2026-10-21 0030', '2026-10-22 2350', '2026-10-23 0010']);
  assert.strictEqual(t.earliest, '2330');
  assert.strictEqual(t.latest, '0030');
  const d = A.timeOfDay(['2026-10-20 0500', '2026-10-21 0600', '2026-10-22 0700']);
  assert.deepStrictEqual([d.earliest, d.middle, d.latest], ['0500', '0600', '0700']);
  assert.strictEqual(A.timeOfDay([]), null);
});

test('analytics: stats for every 148', () => {
  const trains = [
    row('M14831 20', '2026-10-20 0500', { crew: 'EN SD07 · CO SR03', timeOnDuty: 540, heldMin: 900, offPlan: 30, firstPlan: '2026-10-20 0430', predHit: { co: true, en: false } }),
    row('Q14821 21', '2026-10-21 0600', { crew: 'EN SD07 · CO SA02', timeOnDuty: 480, heldMin: 600, offPlan: -20, orderChanges: 1, predHit: { co: false, en: true } }),
    row('M14831 22', null, { gone: '2026-10-22 0900', flag: 'deadhead' }),
    row('M38261 22', '2026-10-22 0700', { crew: 'EN SD01 · CO SR01' }),
  ];
  const runs = A.trainRuns(trains, '148');
  assert.strictEqual(runs.length, 3);
  // Newest first whatever order they came in (site rows, then the archive's oldest first).
  assert.deepStrictEqual(A.trainRuns([trains[0], trains[1], trains[2]].reverse().concat([row('M14831 01', '2026-10-01 0500')]), '148').map((r) => r.id), ['Q14821 21', 'M14831 20', 'M14831 22', 'M14831 01']);
  const st = A.stats(runs);
  assert.strictEqual(st.seen, 3);
  assert.strictEqual(st.ran, 2);
  assert.strictEqual(st.neverRan, 1);
  assert.deepStrictEqual(st.timeOnDuty, { n: 2, avg: 510, max: 540 });
  assert.strictEqual(st.held.over14, 1);
  assert.strictEqual(st.orderChanged, 1);
  assert.deepStrictEqual(st.offPlan, { n: 2, avg: 25, late: 1, early: 1 });
  assert.deepStrictEqual(st.pred.co, { hit: 1, n: 2 });
  assert.deepStrictEqual(st.engineers, [['SD07', 2]]);
  assert.deepStrictEqual(st.pools.map((p) => p[0]), ['SD', 'A pool (SA)', 'Chain Gang (SR)']);
  assert.deepStrictEqual(st.weekdays.filter(([, n]) => n).map(([d]) => d), ['Tue', 'Wed']);
  assert.strictEqual(st.first, '2026-10-20 0500');
});

test('analytics: a turn\'s work history joined to the trains it worked', () => {
  const trains = [row('M14831 20', '2026-10-20 0500', { crew: 'EN SD07 · CO SR03', timeOnDuty: 540 })];
  const work = [
    { train: 'M14831 20', at: '2026-10-20 0500', crew: 'EN SD07 · CO SR03' },
    { train: 'Y123', at: '2026-10-21 0700', crew: 'CO SR03 · EN B201', yard: true },
    // A person's history marks each train with the turn they were on.
    { train: 'Q14821 22 (B119)', at: '2026-10-22 0600', crew: 'EN SD07 · CO B119', turn: 'B119' },
  ];
  const runs = A.workRuns(work, trains, 'SR03');
  assert.deepStrictEqual(runs.map((r) => r.id), ['Q14821 22', 'Y123', 'M14831 20']);
  assert.strictEqual(runs[2].timeOnDuty, 540);
  assert.ok(runs[2].key);
  assert.strictEqual(runs[1].key, null);
  const st = A.stats(runs);
  assert.strictEqual(st.ran, 3);
  assert.strictEqual(st.yard, 1);
  assert.deepStrictEqual(st.partners, [['SD07', 2], ['B201', 1]]);
  assert.deepStrictEqual(st.numbers.slice(0, 2), [['148', 2], ['Y123', 1]]);
  assert.strictEqual(A.numberOf('DHT211B 05'), 'DH');
  assert.strictEqual(A.kindOf('dh', []), 'train');
  assert.ok(A.trainMatches('DHT042C 11', 'DH'));
});

// Owner picked A1–A5 and A8–A13 (2026-10-26).
test('analytics: dates, hours, weeks and time between trains', () => {
  const runs = [row('M14831 20', '2026-10-20 0500'), row('M14831 22', '2026-10-22 0530'), row('Q14821 31', '2026-10-31 2300'), row('M14831 23', null, { day: '2026-10-23' })].map(A.runOf);
  assert.deepStrictEqual(A.inRange(runs, { from: '2026-10-21', to: '2026-10-30' }).map((r) => r.id), ['M14831 22', 'M14831 23']);
  assert.strictEqual(A.inRange(runs, {}).length, 4);
  const h = A.byHour(runs);
  assert.deepStrictEqual([h[5], h[23], h.reduce((a, b) => a + b, 0)], [2, 1, 3]);
  // Weeks start Sunday; an empty week in between still shows.
  assert.deepStrictEqual(A.byWeek(runs), [{ week: '2026-10-18', n: 2 }, { week: '2026-10-25', n: 1 }]);
  assert.deepStrictEqual(A.byWeek(runs, (r) => (r.id === 'Q14821 31' ? 1 : 0)), [{ week: '2026-10-18', n: 0 }, { week: '2026-10-25', n: 1 }]);
  assert.deepStrictEqual(A.between(runs), { n: 2, avg: (2910 + 14010) / 2, min: 2910 });
});

test('analytics: train numbers ranked by plan, never ran, deadheads never called', () => {
  const runs = [
    row('M14831 20', '2026-10-20 0500', { offPlan: 60 }), row('M14831 21', '2026-10-21 0500', { offPlan: -120 }),
    row('M14831 22', null, { gone: '2026-10-22 0900' }), row('DHT211B 05', null, { gone: 'x', deadhead: true, flag: 'deadhead' }),
  ].map(A.runOf);
  const g = Object.fromEntries(A.byNumber(runs).map((x) => [x.number, x]));
  assert.deepStrictEqual([g['148'].seen, g['148'].ran, g['148'].neverRan, g['148'].planAvg, g['148'].planWorst, g['148'].late, g['148'].early], [3, 2, 1, 90, -120, 1, 1]);
  assert.deepStrictEqual([g.DH.deadheads, g.DH.dhNeverCalled], [1, 1]);
  // F1: cancelled vs a non-Sarnia crew.
  const t = Object.fromEntries(A.byNumber([row('M39431 20', null, { gone: 'x', from: 'mac', flag: 'nonSarnia' }), row('M39431 21', null, { gone: 'x' })].map(A.runOf)).map((x) => [x.number, x]));
  assert.deepStrictEqual([t['394'].neverRan, t['394'].nonSarnia, t['394'].cancelled], [2, 1, 1]);
});

test('analytics: a turn side by side, prediction by day and how early', () => {
  const trains = [row('M14831 20', '2026-10-20 0500', { crew: 'EN SD07 · CO SR03', timeOnDuty: 540, heldMin: 900, predHit: { co: true, en: false, coLead: 120 } }),
    row('M14831 22', '2026-10-22 0500', { crew: 'EN SD07 · CO SR03', timeOnDuty: 500, predHit: { co: true, en: true, coLead: 60, enLead: 30 } })];
  const runs = A.workRuns([{ train: 'M14831 20', at: '2026-10-20 0500', crew: 'EN SD07 · CO SR03' }, { train: 'M14831 22', at: '2026-10-22 0500', crew: 'EN SD07 · CO SR03' }], trains, 'SR03');
  assert.deepStrictEqual(A.turnRow('SR03', runs, { spares: 2, tookOutOfTurn: 1 }),
    { turn: 'SR03', trains: 2, yard: 0, todTotal: 1040, todAvg: 520, held14: 1, between: 2880, spares: 2, rests: 0, tookOutOfTurn: 1 });
  const all = trains.map(A.runOf);
  assert.deepStrictEqual(A.accuracyByDay(all).map((d) => [d.day, d.co.hit, d.en.hit]), [['2026-10-20', 1, 0], ['2026-10-22', 1, 1]]);
  assert.deepStrictEqual(A.predLead(all), { co: { n: 2, avg: 90, fromStart: 0 }, en: { n: 1, avg: 30, fromStart: 0 } });
});

test('analytics: runarounds and jobs going spare', () => {
  const ra = A.runaroundStats([{ train: 'M1 01', expected: 'SR', actual: 'A', turn: 'SA04' }, { train: 'M2 02', expected: 'SR', actual: 'B', turn: 'SB01' },
    { train: 'M3 03', expected: 'B', actual: 'A', turn: 'SA02', fixed: true, stretches: [{ from: '2026-10-03 0100', to: '2026-10-03 0200', checks: 13 }] }]);
  assert.deepStrictEqual([ra.shown, ra.n, ra.fixed, ra.shouldHave, ra.tookIt.length, ra.wrongFor], [3, 2, 1, [['Chain Gang (SR)', 2]], 2, 60]);
  const sp = A.spareJobStats([
    { train: 'Y1', pool: 'SR', cc: 'CO', first: '2026-10-20 0800', predicted: 'B119', filledBy: 'B119' },
    { train: 'Y2', pool: 'SR', cc: 'CO', first: '2026-10-20 0900', predicted: 'B120', filledBy: 'B121' },
    { train: 'Y3', pool: 'SA', cc: 'EN', first: '2026-10-21 0900' },
  ]);
  assert.deepStrictEqual([sp.n, sp.filled, sp.predicted, sp.perDay], [3, 2, { hit: 1, n: 2 }, [{ day: '2026-10-20', n: 2 }, { day: '2026-10-21', n: 1 }]]);
  assert.deepStrictEqual(A.everyDay(new Map([['2026-10-30', 1], ['2026-11-02', 2]])).map((d) => d.n), [1, 0, 0, 2]);
});

test('analytics: spreadsheet quotes commas and quotes', () => {
  const out = A.csv([A.runOf(row('M14831 20', '2026-10-20 0500', { crew: 'EN SD07 · CO "SR03", x' }))]);
  const [head, line] = out.trim().split('\r\n');
  assert.match(head, /^On duty,Train,Number,/);
  assert.match(line, /^2026-10-20 05:00,M14831 20,148,Sarnia,.*"EN SD07 · CO ""SR03"", x"/);
});
