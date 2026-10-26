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
    snap('2026-10-20 0800', { onDuty: [{ train: 'Y123', backfill: [{ craft: 'CO', job: 'SR04', turn: 'B120' }] }] }),
    // Listed again two days later: a new vacancy.
    snap('2026-10-22 0600', { vacancies: [job] }),
  ]);
  const f = Insights.finish(st);
  assert.deepStrictEqual(f.runarounds.map((r) => [r.train, r.expected, r.actual, r.turn, r.taken]), [['M38261 20', 'SR', 'A', 'SA04', '2026-10-20 0600']]);
  assert.strictEqual(f.spareJobs.length, 2);
  assert.deepStrictEqual([f.spareJobs[0].predicted, f.spareJobs[0].filledBy, f.spareJobs[0].last], ['B119', 'B120', '2026-10-20 0700']);
  assert.strictEqual(f.spareJobs[1].filledBy, undefined);
});

test('archive: keeps what falls off the site, publishes only the older part', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'arch-')), 'a.json');
  const train = (id, onDuty) => ({ id, month: '2026-10', day: onDuty.slice(0, 10), onDuty, crew: 'CO SR03', events: [{}] });
  const turns = (at) => ({ SR03: { orders: [{ train: 'M1 01', onDuty: 'x', onDutyAt: at.slice(8, 10) + 'th ' + at.slice(11), onDutySeen: at }], spares: [{ seen: at }], rests: [] } });
  // First build: the site runs from the 1st.
  let a = Archive.update(Archive.load(file), { trains: [train('M1 01', '2026-10-01 0500')], turns: turns('2026-10-01 0500'),
    people: { h1: [{ turn: 'SR03', own: true, from: '2026-10-01 0400', to: '2026-10-01 0600' }] }, insights: { runarounds: [{ train: 'M1 01', taken: '2026-10-01 0500' }], spareJobs: [] } },
  '2026-10-01', { now: new Date('2026-10-02T12:00:00Z') });
  Archive.save(file, a);
  assert.deepStrictEqual(Archive.forSite(a, '2026-10-01').trains, []);
  // A month on, the 1st has fallen off the site: it comes from the archive.
  a = Archive.update(Archive.load(file), { trains: [train('M9 05', '2026-11-05 0500')], turns: {}, people: {}, insights: { runarounds: [], spareJobs: [] } },
    '2026-10-31', { now: new Date('2026-11-05T12:00:00Z') });
  const site = Archive.forSite(a, '2026-10-31');
  assert.deepStrictEqual(site.trains.map((r) => [r.id, r.events]), [['M1 01', undefined]]);
  assert.deepStrictEqual(site.work.SR03.map((o) => [o.train, o.at]), [['M1 01', '2026-10-01 0500']]);
  assert.deepStrictEqual([site.spares.SR03, site.people.h1.length, site.runarounds.length], [['2026-10-01 0500'], 1, 1]);
  assert.ok(Object.keys(a.trains).includes('M9 05 2026-10'));
  // Older than the keep time: gone.
  a = Archive.update(a, { trains: [], turns: {}, people: {}, insights: { runarounds: [], spareJobs: [] } }, '2027-10-31', { now: new Date('2027-12-01T12:00:00Z') });
  assert.deepStrictEqual(Object.keys(a.trains), []);
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
    snap('2026-10-20 1500', { onDuty: [{ train: 'M5 20', onDuty: '20th 1500', crew: 'CO SR05' }] }),
  ]);
  const z = Object.fromEntries(Insights.finish(st).sleep.map((x) => [x.turn, x]));
  assert.deepStrictEqual(Object.keys(z).sort(), ['B119', 'SD07', 'SR03', 'SR05']);
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
  assert.deepStrictEqual(A.sleepByTurn(list).map((t) => [t.turn, t.n, t.bad]), [['SR03', 3, 1], ['SR05', 1, 0]]);
});
