const test = require('node:test');
const assert = require('node:assert');
const A = require('../../public/board-analytics');

// trains.json rows, as BoardTrains.summarize gives them (only what's used).
const row = (id, onDuty, extra = {}) => ({ id, month: '2026-10', day: (onDuty || '2026-10-20').slice(0, 10), onDuty, crew: '', orderChanges: 0, ...extra });

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
  assert.strictEqual(A.numberOf('DHT211B 05'), 'DHT211');
});
