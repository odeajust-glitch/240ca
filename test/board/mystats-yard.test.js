// My stats for yard workers: the test site's pieces (owner, 2026-11-13: "Review my stats tab for someone working
// just yard jobs and see if we need more data points so they have a more complete picture there", then, shown
// eight additions: "Let's do that. Push to the test site. Also build in the ability to search other name codes so
// I can see other My Stats pages so I can verify the information"). Made-up jobs, turns and people: a person is a
// hash, as on the site.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const MyStats = require('../../public/board-mystats');
const Files = require('../../lib/board/mystats');
const R = require('../../lib/board/resets');
const T = require('../../public/board-trains');

const page = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const ME = 'a'.repeat(16);
const m = (stamp) => T.toMin(stamp);
const nth = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
const dayOn = (d, hhmm) => `${nth(+d.slice(8))} ${hhmm}`;

// A week of checks every 8 minutes. A run of job YQQS01 (on duty 0800) is on the Call Board from 0600 until `ends`
// (the last check that lists it) on each day in `runs`; vacancies and days off lines as given, read at 0600.
function week(runs, { vacancies = {}, daysOff = [], crew = 'S1 B901' } = {}) {
  const snaps = [];
  for (let d = m('2026-11-04 0000'); d < m('2026-11-12 0000'); d += 1440) {
    const day = T.fromMin(d).slice(0, 10);
    for (let t = d; t < d + 1440; t += 8) {
      const at = T.fromMin(t); const hhmm = at.slice(11);
      const end = runs[day];
      const yardJobs = end && hhmm >= '0600' && hhmm <= end ? [{ job: 'YQQS01', station: 'SARNIA', onDuty: dayOn(day, '0800'), hours: 8, crew }] : [];
      const extra = hhmm === '0600' ? { vacancies: (vacancies[day] || []).map((cc) => ({ train: 'YQQS01', at: dayOn(day, '0800'), cc, yard: true })), daysOff: daysOff.filter((x) => x.read === day).map(({ read, ...x }) => x) } : {};
      snaps.push({ taken: at, yardJobs, ...extra });
    }
  }
  return snaps;
}
// yardFrom: the checker marks who is on duty on a yard job from the start (no days a job's list could not say).
function tracker0(last) { const acc = R.empty(); acc.since = m('2026-11-04 0000'); acc.last = m(last); acc.yardFrom = acc.since; return acc; }
function named(acc, h, job, day, first, last, extra = {}) {
  const trips = acc.trips[h] || (acc.trips[h] = {});
  trips[`${job}/${m(`${day} 0800`)}`] = { train: job, on: m(`${day} 0800`), job, first: m(`${day} ${first}`), last: m(`${day} ${last}`), yard: true, sure: true, ...extra };
}
const build = (stretches, acc, yard, extra = {}) => MyStats.build({ stretches, turns: {}, ...extra, tracker: Files.trackerOf(acc, { yard, people: { [ME]: stretches } })(ME, stretches) });

test('yard: the collector keeps when a run left the Call Board, its crew turns, its spare crafts, the days off lines and when the checks ran', () => {
  const y = {};
  const job = (crew = 'S1 B901') => ({ job: 'YQQS01', station: 'SARNIA', onDuty: '4th 0800', hours: 8, crew });
  Files.collectYard(y, [
    { taken: '2026-11-04 0600', yardJobs: [job()], vacancies: [{ train: 'YQQS01', at: '5th 0800', cc: 'FO', yard: true }, { train: 'YQQS01', at: '5th 0800', cc: 'S1', yard: true }, { train: 'M30241', at: '5th 0800', cc: 'CO', yard: false }],
      daysOff: [{ from: '6th 0001', until: '7th 0001', turn: 'YQQS01', craft: 'FO', yard: true }, { from: '6th 1800', turn: 'SR04', craft: 'CO', yard: false }] },
    { taken: '2026-11-04 0608', sameUntil: '2026-11-04 1612', yardJobs: [job('S1 B901 · FO SD02')] },
    { taken: '2026-11-04 1620', yardJobs: [] }, // gone by this check
    { taken: '2026-11-04 1628', yardJobs: [job()] }, // listed again (a blip): it had not gone
    { taken: '2026-11-04 1636', yardJobs: [] },
  ]);
  const on = m('2026-11-04 0800');
  assert.deepEqual(y.runs.YQQS01[on], { on, first: m('2026-11-04 0600'), last: m('2026-11-04 1628'), gone: m('2026-11-04 1636'), crew: ['S1 B901', 'FO SD02'] });
  assert.deepEqual(y.spare, { YQQS01: { [m('2026-11-05 0800')]: ['FO', 'S1'] } }, 'yard vacancies only, by craft');
  assert.deepEqual(Object.values(y.booked).sort((a, b) => a.from - b.from), [
    { turn: 'YQQS01', craft: 'FO', from: m('2026-11-06 0001'), until: m('2026-11-07 0001') },
    { turn: 'SR04', craft: 'CO', from: m('2026-11-06 1800'), until: m('2026-11-07 1800') }, // no end shown: a day
  ]);
  assert.deepEqual(y.cover, [[m('2026-11-04 0600'), m('2026-11-04 1636')]]);
  Files.collectYard(y, [{ taken: '2026-11-04 1800', yardJobs: [] }]); // over 30 min since the last check: a new span
  assert.equal(y.cover.length, 2);
  // The turns on its crew lines, as before.
  assert.deepEqual(Object.keys(y.byTurn).sort(), ['B901', 'SD02']);
});

// Owner, 2026-11-13: "Do not use the call board to determine off duty since if they forget to tie up it will sit
// there. We have to manually close our ticket in the computer, untill we do the job will stay on the call board",
// then "We wont need to assume yard off duty times building 3 - 7 YD read".
test('yard: a shift\'s O-T is CATS\'s; a blank is none only once the ticket was closed (the job had left the Call Board)', () => {
  const on = m('2026-11-04 0800');
  const k = `YQQS01/${on}`;
  const gone = { on, first: m('2026-11-04 0600'), last: m('2026-11-04 1712'), gone: m('2026-11-04 1720') };
  const listed = { on, first: m('2026-11-04 0600'), last: m('2026-11-05 0900') };
  assert.equal(MyStats.otOf({ [k]: { ot: 130, seen: m('2026-11-04 1900') } }, 'YQQS01', on, listed), 130, 'filled in: CATS\'s, whatever the Call Board shows');
  assert.equal(MyStats.otOf({ [k]: { ot: null, seen: m('2026-11-04 1800') } }, 'YQQS01', on, gone), 0, 'blank, read after it left the Call Board: no overtime');
  assert.equal(MyStats.otOf({ [k]: { ot: null, seen: m('2026-11-04 1700') } }, 'YQQS01', on, gone), null, 'blank, read before the ticket was closed: not known');
  assert.equal(MyStats.otOf({ [k]: { ot: null, seen: m('2026-11-05 0900') } }, 'YQQS01', on, listed), null, 'blank, still on the Call Board: not known');
  assert.equal(MyStats.otOf({ [k]: { ot: null, seen: m('2026-11-05 0900') } }, 'YQQS01', on, null), null, 'blank, the Call Board never seen: not known');
  assert.equal(MyStats.otOf({}, 'YQQS01', on, gone), null, 'not read');
  assert.equal(MyStats.otOf({ [`YQQS01/${on + 15}`]: { ot: 45, seen: m('2026-11-05 0900') } }, 'YQQS01', on, gone), 45, 'the same run within 30 minutes');
  assert.equal(MyStats.otOf({ [`YQQS01/${on + 45}`]: { ot: 45, seen: m('2026-11-05 0900') } }, 'YQQS01', on, gone), null);
  assert.equal(MyStats.otOf({ [k]: { ot: 45, seen: m('2026-11-05 0900') } }, 'YQQS02', on, gone), null, 'another job');
});

test('yard: the reset tracker keeps each yard job\'s O-T as last read', () => {
  const on = m('2026-11-11 0700');
  const acc = R.empty();
  R.collect(acc, { callBoard: [], yardJobs: [], yardHistory: [{ job: 'YQQS03', on, ot: null }] }, [], m('2026-11-11 1200'));
  R.collect(acc, { callBoard: [], yardJobs: [], yardHistory: [{ job: 'YQQS03', on, ot: 240 }] }, [], m('2026-11-11 2000'));
  assert.deepEqual(acc.yardOT, { [`YQQS03/${on}`]: { ot: 240, seen: m('2026-11-11 2000') } });
  // Day files joined in any order: the latest read wins.
  const into = R.empty();
  R.merge(into, acc);
  R.merge(into, { yardOT: { [`YQQS03/${on}`]: { ot: null, seen: m('2026-11-11 1200') } } });
  assert.deepEqual(into.yardOT[`YQQS03/${on}`], { ot: 240, seen: m('2026-11-11 2000') });
  // The summary takes the rows off the saved screens labelled yardHistory (lib/board/summary.js).
  const { loadSummary } = require('../../lib/board/summary');
  const grid = ['100 | 0:ASSIGNMENT | 100:HISTORY', '120 | 0:X | 40:ASSIGNMENT | 150:AAA-AAAA/AAAA | 300:AAAAAAAAAAA | 560:O-T',
    '140 | 0:[] | 40:YQQS03 | 150:261111 | 230:0700 | 300:0700 | 345:AAA | 380:AAAAA | 440:3 | 560:0400',
    '160 | 0:[] | 40:YQQS04 | 150:261111 | 230:0800 | 300:0800 | 345:AAAAAA'];
  const sum = loadSummary({ probedAt: '2026-11-12T14:11:00Z', screens: [{ label: 'yardHistory', screenGrid: grid }] });
  assert.deepEqual(sum.yardHistory.map((y) => [y.job, T.fromMin(y.on), y.ot]), [['YQQS03', '2026-11-11 0700', 240], ['YQQS04', '2026-11-11 0800', null]]);
});

test('yard: a shift keeps the 8 h the site goes by and carries its end by CATS (8 h and its O-T), craft and crew; none past the next shift or when they left early', () => {
  const y = {};
  Files.collectYard(y, week({ '2026-11-04': '1712', '2026-11-05': '1712', '2026-11-06': '1712' }));
  // A second job on the 5th, on duty at 1630 (named on both: moved over in the same day), gone from the Call Board by 2300.
  Files.collectYard(y, [{ taken: '2026-11-05 1500', yardJobs: [{ job: 'YQQS02', station: 'SARNIA', onDuty: '5th 1630', hours: 8, crew: '' }] }, { taken: '2026-11-05 2300', yardJobs: [] }]);
  const acc = tracker0('2026-11-11 2352');
  // The assignment history with YD: O-T 1 h 16 on the 4th, 2 h on the 5th (that would run into YQQS02 at 1630),
  // blank on YQQS02 read after it left the Call Board (none), 30 min on the 6th (they left at 1200: not theirs).
  acc.yardOT = { [`YQQS01/${m('2026-11-04 0800')}`]: { ot: 76, seen: m('2026-11-05 0900') }, [`YQQS01/${m('2026-11-05 0800')}`]: { ot: 120, seen: m('2026-11-06 0900') },
    [`YQQS02/${m('2026-11-05 1630')}`]: { ot: null, seen: m('2026-11-06 0900') }, [`YQQS01/${m('2026-11-06 0800')}`]: { ot: 30, seen: m('2026-11-07 0900') } };
  named(acc, ME, 'YQQS01', '2026-11-04', '0600', '1712', { cc: 'FO' });
  named(acc, ME, 'YQQS01', '2026-11-05', '0600', '1712', { cc: 'FO' });
  acc.trips[ME][`YQQS02/${m('2026-11-05 1630')}`] = { train: 'YQQS02', on: m('2026-11-05 1630'), job: 'YQQS02', first: m('2026-11-05 1500'), last: m('2026-11-05 1700'), yard: true, sure: true };
  named(acc, ME, 'YQQS01', '2026-11-06', '0600', '1200'); // off the crew lines at 1200 while the job ran on to 1712: left then
  const stretches = [{ turn: 'YQQS01', own: true, from: '2026-11-04 0000', to: '2026-11-11 2352' }];
  const rec = build(stretches, acc, y);
  const shift = (day, job = 'YQQS01') => rec.trips.find((t) => t.id === job && t.at.startsWith(day));
  assert.deepEqual(shift('2026-11-04'), { id: 'YQQS01', at: '2026-11-04 0800', turn: 'YQQS01', st: 'SARNIA', yard: true, off: '2026-11-04 1600', est: true, nm: 1, oe: '2026-11-04 1716', cc: 'FO', yw: ['S1 B901'] });
  assert.equal(shift('2026-11-05').oe, undefined, 'would run into the next shift: not theirs');
  assert.equal(shift('2026-11-05', 'YQQS02').oe, '2026-11-06 0030', 'a blank once the ticket was closed: 8 h');
  assert.equal(shift('2026-11-06').off, '2026-11-06 1200');
  assert.equal(shift('2026-11-06').oe, undefined, 'left early: their own last, not the job\'s O-T');
  // The page with the yard view: CATS's end, not an estimate; without it, the 8 h as before.
  const s = MyStats.stats(MyStats.yardView(rec));
  const four = s.trips.find((t) => t.at === '2026-11-04 0800');
  assert.deepEqual([four.dur, four.durEst], [9 * 60 + 16, false]);
  assert.equal(s.trips.find((t) => t.at === '2026-11-05 0800').durEst, true, 'no end by CATS: still the 8 h, an estimate');
  assert.equal(MyStats.stats(rec).trips.find((t) => t.at === '2026-11-04 0800').dur, 8 * 60);
  // Nothing from the Call Board's end is left on a shift (cb, ob: the build before).
  assert.ok(rec.trips.every((t) => !('cb' in t) && !('ob' in t)));
  const kept = MyStats.merge({ ...rec, trips: rec.trips.map((t) => (t.yard ? { ...t, cb: t.off, ob: t.off } : t)) }, { ...rec, trips: rec.trips.filter((t) => t.at >= '2026-11-06') }, '2026-11-06');
  assert.ok(kept.trips.every((t) => !('cb' in t) && !('ob' in t)), 'not kept from an earlier build either');
});

test('yard: days off are said only where the board says why: booked off, the job spare for their craft, the job not on duty', () => {
  const runs = { '2026-11-04': '1712', '2026-11-05': '1712', '2026-11-06': '1712', '2026-11-08': '1712', '2026-11-09': '1712', '2026-11-10': '1712', '2026-11-11': '1712' }; // none on the 7th
  const opts = {
    vacancies: { '2026-11-05': ['FO', 'S1'], '2026-11-08': ['S1'], '2026-11-10': ['FO'] },
    daysOff: [{ read: '2026-11-05', from: '6th 0001', until: '7th 0001', turn: 'YQQS01', craft: 'FO', yard: true }, { read: '2026-11-05', from: '9th 0001', until: '10th 0001', turn: 'YQQS01', craft: 'TT', yard: true }],
  };
  const y = {};
  Files.collectYard(y, week(runs, opts));
  const acc = tracker0('2026-11-11 2352');
  named(acc, ME, 'YQQS01', '2026-11-04', '0600', '1712', { cc: 'FO' });
  named(acc, ME, 'YQQS01', '2026-11-11', '0600', '1712');
  const stretches = [{ turn: 'YQQS01', own: true, from: '2026-11-04 0000', to: '2026-11-11 2352' }];
  const rec = build(stretches, acc, y);
  // The 4th and 11th worked; the 8th only the S1 went spare and the 9th only a trainee's line: no reason given.
  assert.deepEqual(rec.yoff, [
    { d: '2026-11-05', why: 'spare', job: 'YQQS01', cc: 'FO' },
    { d: '2026-11-06', why: 'booked', job: 'YQQS01', cc: 'FO' },
    { d: '2026-11-07', why: 'norun', job: 'YQQS01', cc: 'FO' },
    { d: '2026-11-10', why: 'spare', job: 'YQQS01', cc: 'FO' },
  ]);
  // Their craft never read: a job spare counts only when two crafts went spare, a booked line never.
  const acc2 = tracker0('2026-11-11 2352');
  named(acc2, ME, 'YQQS01', '2026-11-04', '0600', '1712');
  assert.deepEqual(build(stretches, acc2, y).yoff.map((x) => `${x.d} ${x.why}`), ['2026-11-05 spare', '2026-11-07 norun']);
  // The craft they are on it as now (the newest check), when no shift said.
  assert.deepEqual(build(stretches, acc2, y, { yardCraft: (job) => (job === 'YQQS01' ? 'S1' : '') }).yoff.map((x) => `${x.d} ${x.why}`), ['2026-11-05 spare', '2026-11-07 norun', '2026-11-08 spare']);
  // Kept from one build to the next, like the trips.
  const later = MyStats.merge(rec, { ...rec, from: '2026-11-08', trips: rec.trips.filter((t) => t.at >= '2026-11-08'), yoff: rec.yoff.filter((x) => x.d >= '2026-11-08') }, '2026-11-08');
  assert.deepEqual(later.yoff, rec.yoff);
});

test('yard: how each yard job runs is the job\'s own runs by their O-T in CATS, its length from them, and nobody\'s figures', () => {
  const y = {};
  const runDay = (job, onDuty, day, from, to) => {
    const out = [];
    for (let t = m(`${day} ${from}`); t <= m(`${day} ${to}`); t += 8) out.push({ taken: T.fromMin(t), yardJobs: [{ job, station: 'SARNIA', onDuty: dayOn(day, onDuty), hours: 8, crew: '' }] });
    out.push({ taken: T.fromMin(m(`${day} ${to}`) + 8), yardJobs: [] });
    return out;
  };
  // On the Call Board long past its end, as a job is until its ticket is closed: never its length.
  for (const day of ['2026-11-04', '2026-11-05', '2026-11-06']) Files.collectYard(y, runDay('YQQS01', '0800', day, '0600', '2104'));
  for (const day of ['2026-11-07', '2026-11-08', '2026-11-09']) Files.collectYard(y, runDay('YSBY09', '1430', day, '1230', '2236'));
  for (const day of ['2026-11-07', '2026-11-08', '2026-11-09']) Files.collectYard(y, runDay('YSBY12', '0700', day, '0500', '1904'));
  Files.collectYard(y, runDay('YQQS01', '0800', '2026-11-07', '0600', '2352').slice(0, -1)); // the 7th: still listed at the last check
  const ot = {};
  const read = (job, day, hhmm, x, seen = '2026-11-10 0900') => { ot[`${job}/${m(`${day} ${hhmm}`)}`] = { ot: x, seen: m(seen) }; };
  // An 8 h job: none (blank, read after it left), 1 h 16 over, 4 min; the 3rd only on the list (30 min); the 7th blank while still listed.
  read('YQQS01', '2026-11-04', '0800', null); read('YQQS01', '2026-11-05', '0800', 76); read('YQQS01', '2026-11-06', '0800', 4); read('YQQS01', '2026-11-03', '0800', 30); read('YQQS01', '2026-11-07', '0800', null, '2026-11-07 2300');
  // A YSBY job that runs 8 h is an 8 h job; one with 4 h of O-T every day a 12 h job.
  for (const day of ['2026-11-07', '2026-11-08', '2026-11-09']) { read('YSBY09', day, '1430', null); read('YSBY12', day, '0700', 240); }
  const out = Files.yardJobs(y, { ot });
  assert.deepEqual(out.jobs.map((j) => [j.job, j.start, j.length, j.runs, j.timed, j.median, j.over, j.longest]), [
    ['YQQS01', '0800', 480, 5, 4, 8 * 60 + 17, 2, 9 * 60 + 16], // 8 h, 8 h 04, 8 h 30, 9 h 16
    ['YSBY09', '1430', 480, 3, 3, 8 * 60, 0, 8 * 60],
    ['YSBY12', '0700', 720, 3, 3, 12 * 60, 0, 12 * 60],
  ]);
  assert.equal(out.from, '2026-11-03', 'from the first run on either list');
  assert.deepEqual(Object.keys(out).sort(), ['from', 'jobs', 'to']);
  for (const j of out.jobs) assert.deepEqual(Object.keys(j).sort(), ['job', 'length', 'longest', 'median', 'over', 'runs', 'start', 'timed']);
  // No O-T read: runs, nothing timed, the 8 / 12 h rule.
  assert.deepEqual(Files.yardJobs(y).jobs.map((j) => [j.job, j.timed, j.length]), [['YQQS01', 0, 480], ['YSBY09', 0, 720], ['YSBY12', 0, 720]]);
  assert.equal(MyStats.lengthFrom('YSBY09', [480, 490]), 12 * 60, 'under 3 runs timed: the 8 / 12 h rule');
});

test('yard: "You and the yard" is given only with 5 yard workers, each end of the band halfway between two of them', () => {
  // Made-up yard workers, each 14 days on job YQQS01 with n shifts of 8 h 30 by CATS (30 min of O-T).
  const worker = (n) => {
    const trips = [];
    for (let i = 0; i < n; i++) { const day = T.fromMin(m('2026-11-01 0800') + i * 1440).slice(0, 10); trips.push({ id: 'YQQS01', at: `${day} 0800`, turn: 'YQQS01', st: 'SARNIA', yard: true, off: `${day} 1600`, est: true, nm: 1, oe: `${day} 1630` }); }
    return { v: MyStats.V, from: '2026-11-01', to: '2026-11-14', turns: [{ turn: 'YQQS01', own: true, from: '2026-11-01', to: '2026-11-14' }], trips, rests: [], spares: [], pos: [], resets: [], due: null, passed: [], stale: [] };
  };
  const kept = (ns) => ({ v: MyStats.V, people: Object.fromEntries(ns.map((n, i) => [String(i).repeat(16).slice(0, 16), worker(n)])) });
  assert.equal(Files.pools(kept([6, 7, 8, 9])).yard, null, 'four people: nothing');
  const yard = Files.pools(kept([6, 7, 8, 9, 10])).yard;
  assert.equal(yard.people, 5);
  const per = (n) => (n / 14) * 7;
  assert.deepEqual(yard.m.shifts, { n: 5, avg: Math.round(per(8) * 10) / 10, q1: Math.round(((per(6) + per(7)) / 2) * 10) / 10, q3: Math.round(((per(10) + per(9)) / 2) * 10) / 10 });
  assert.deepEqual(yard.m.shift, { n: 5, avg: 510, q1: 510, q3: 510 });
  assert.equal(yard.m.over.avg, Math.round(((per(6) + per(7) + per(8) + per(9) + per(10)) / 5) * 30 / 5) * 5, '30 min past the 8 h, a shift');
  // The pools themselves are as they were.
  assert.deepEqual(Object.keys(Files.pools(kept([6, 7, 8, 9, 10])).pools).sort(), Object.keys(MyStats.poolSummary(Object.values(kept([6, 7, 8, 9, 10]).people).map((r) => MyStats.poolFigures(r, { from: '2026-10-18', to: '2026-11-14' })))).sort());
});

// A yard-only record, as the build makes it, and the same without the new fields.
function yardRec() {
  const trips = [];
  for (const [day, oe] of [['2026-11-04', '1716'], ['2026-11-05', '1830'], ['2026-11-06', '1600'], ['2026-11-07', '']]) {
    trips.push({ id: 'YQQS01', at: `${day} 0800`, turn: 'YQQS01', st: 'SARNIA', yard: true, off: `${day} 1600`, est: true, nm: 1, ...(oe ? { oe: `${day} ${oe}` } : {}), cc: 'FO', yw: ['S1 B901'] });
  }
  return { v: MyStats.V, from: '2026-11-03', to: '2026-11-10', turns: [{ turn: 'YQQS01', own: true, from: '2026-11-03', to: '2026-11-10' }], trips, rests: [], spares: [{ seen: '2026-11-08 0600', turn: 'YQQS01', text: 'job YQQS01 on the vacancy list' }], pos: [], resets: [], due: null, passed: [], stale: [],
    yoff: [{ d: '2026-11-08', why: 'booked', job: 'YQQS01', cc: 'FO' }, { d: '2026-11-09', why: 'spare', job: 'YQQS01', cc: 'FO' }] };
}
const strip = (rec) => JSON.parse(JSON.stringify(rec, (k, v) => (['oe', 'cc', 'yw', 'yoff', 'ru'].includes(k) ? undefined : v)));
const JOBS = { from: '2026-11-03', to: '2026-11-10', jobs: [{ job: 'YQQS01', start: '0800', length: 480, runs: 7, timed: 6, median: 500, over: 3, longest: 630 }, { job: 'YQQS09', start: '1600', length: 480, runs: 7, timed: 7, median: 485, over: 1, longest: 520 }] };

test('yard: without the yard view every page is drawn exactly as before, whatever the record carries', () => {
  const rec = yardRec();
  for (const range of ['30', '90', 'all']) for (const more of [true, false]) {
    const o = { range, code: 'ABCD', more, pools: { from: '2026-10-14', to: '2026-11-10', pools: {} }, now: '2026-11-10 1200' };
    assert.equal(MyStats.html(rec, o), MyStats.html(strip(rec), o));
    assert.equal(MyStats.csv(rec, range), MyStats.csv(strip(rec), range));
  }
  assert.doesNotMatch(MyStats.html(rec, { more: true }), /ms-yardjob|ms-overtime|ms-yardjobs|ms-offday|Every shift/);
});

test('yard: with the yard view a yard worker reads shifts, their job, the ends, the days off and the yard jobs, and no road rows', () => {
  const h = MyStats.html(yardRec(), { range: 'all', code: 'ABCD', more: true, pools: { from: '2026-10-14', to: '2026-11-10', pools: {} }, now: '2026-11-10 1200', yard: true, yardJobs: JOBS });
  for (const id of ['yardjob', 'overtime', 'yardjobs', 'pool', 'log']) assert.match(h, new RegExp(`id="ms-${id}"`), id);
  assert.match(h, /<h3>Every shift<\/h3>/);
  assert.match(h, /4<\/b><span>shifts on duty/);
  assert.match(h, /Ran 15 min or more past its length<\/dt><dd>2 of 3/); // 1716 is 1 h 16 over, 1830 2 h 30, 1600 none
  assert.match(h, /Shifts with their end from CATS<\/dt><dd>3 of 4<small>1 taken as 8 h/);
  assert.match(h, /Not timed yet<\/dt><dd>1</);
  assert.doesNotMatch(h, /left the Call Board|ended by the Call Board|when you booked off|good to about 5 minutes/);
  assert.match(h, /YQQS01 · FO/);
  assert.match(h, /ms-offday"[^>]*data-tip="[^"]*booked off/);
  assert.match(h, /ms-offday"[^>]*data-tip="[^"]*your job YQQS01 went spare for FO/);
  assert.match(h, /Spares on your yard crews<\/dt><dd>S1 B901/);
  assert.match(h, /Days your job went spare for your craft<\/dt><dd>1</);
  assert.doesNotMatch(h, /Goes-spare notes on your turn|Held away 14 h or more|Held away from home|Called under 8 h|Usual call miss/);
  assert.match(h, /You and the yard/);
  assert.match(h, /<b>YQQS09<\/b><small>an 8 h job<\/small>/); // the jobs they did not work, folded
  // The spreadsheet with the yard view: CATS's end, not an estimate; the one with no O-T yet, the 8 h estimate.
  assert.match(MyStats.csv(yardRec(), 'all', { yard: true }), /"2026-11-05 1830","","10:30"/);
  assert.match(MyStats.csv(yardRec(), 'all', { yard: true }), /"2026-11-07 1600","yes","8:00"/);
  // The owner looking at someone else's page: said at the top.
  assert.match(MyStats.html(yardRec(), { more: true, yard: true, code: 'ABCD', other: true }), /ABCD's page, opened with the owner key/);
  // A road worker with the yard view: their page, with no yard pieces.
  const road = { ...strip(yardRec()), turns: [{ turn: 'SR04', own: true, from: '2026-11-03', to: '2026-11-10' }], trips: [{ id: 'M30241 04', at: '2026-11-04 0400', off: '2026-11-04 1200', turn: 'SR04', st: 'SARNIA' }], spares: [] };
  const r = MyStats.html(road, { more: true, yard: true, yardJobs: JOBS });
  assert.doesNotMatch(r, /ms-yardjob|ms-overtime|id="ms-yardjobs"/);
  assert.match(r, /<h3>Every trip<\/h3>/);
});

// Owner, 2026-11-14, shown what was still on the test site: "do 1-3 5" (1 the yard pieces, 2 the owner's look at
// another code's page, 3 the reset tracker by CATS's O-T, 5 the wrong-turn log).
test('yard: every member gets the yard view and the yard jobs, both sites; the owner key opens another code, either site', () => {
  const tab = page.slice(page.indexOf('async function renderMine()'), page.indexOf('// Who gets alerts (owner, 2026-11-02)'));
  assert.match(tab, /const yardJobsAsked = getJSON\('data\/yardjobs\.json'\)\.catch/);
  assert.match(tab, /now, yard: true, yardJobs, other: !!d\.other \}\);/);
  assert.match(tab, /BoardMyStats\.csv\(d\.stats, mineRange, \{ yard: true \}\)/);
  assert.match(tab, /const lookBox = \(\) => \{\n      if \(!membersOwner\) return;/);
  assert.match(tab, /const look = membersOwner \? mineLook : '';/);
  assert.doesNotMatch(tab.replace('const more = MINE_MORE || PREVIEW;', ''), /\bPREVIEW\b/); // that one: on for everyone already (MINE_MORE)
  assert.match(page, /\n    membersOwner = !!\(h && OwnerKey\.has\(\)\);\n/, 'the owner key the Worker accepted');
  assert.equal((tab.match(/fetch\(/g) || []).length, 1, 'one request for the record: the code goes in only when look is set');
  // The site build writes the jobs file and the yard figures.
  const check = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/board/2026-10-15.json'), 'utf8'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'board-mystats-yard-'));
  fs.mkdirSync(path.join(root, 'history', '2026-10-15'), { recursive: true });
  fs.writeFileSync(path.join(root, 'history', '2026-10-15', '0143.json'), JSON.stringify(check));
  require('../../lib/board/site').buildSite({ historyDir: path.join(root, 'history'), outDir: path.join(root, 'site'), days: 0, now: new Date('2026-10-16T12:00:00Z') });
  const jobs = JSON.parse(fs.readFileSync(path.join(root, 'site', 'data', 'yardjobs.json'), 'utf8'));
  assert.ok(Array.isArray(jobs.jobs));
  assert.ok('yard' in JSON.parse(fs.readFileSync(path.join(root, 'site', 'data', 'pools.json'), 'utf8')));
  // One reset tracker, by the yard O-T ends (none read in this fixture), and no test-site copy beside it.
  const main = JSON.parse(fs.readFileSync(path.join(root, 'site', 'data', 'resets.json'), 'utf8'));
  assert.ok('turns' in main && 'people' in main && 'offs' in main && main.yardEnds === 0);
  assert.ok(!fs.existsSync(path.join(root, 'site', 'data', 'resets-test.json')));
});

test('yard: the reset tracker keeps the craft someone was on a yard job as', () => {
  const acc = R.empty();
  const input = { callBoard: [], yardJobs: [{ job: 'YQQS01', onDuty: m('2026-11-04 0800') }] };
  R.collect(acc, input, [{ h: ME, turn: 'YQQS01', craft: 'FO', duty: true }], m('2026-11-04 0900'), [], { yardDuty: true });
  const key = `YQQS01/${m('2026-11-04 0800')}`;
  assert.equal(acc.trips[ME][key].cc, 'FO');
  const into = R.empty();
  R.merge(into, { trips: { [ME]: { [key]: { ...acc.trips[ME][key], cc: undefined } } } });
  R.merge(into, acc);
  assert.equal(into.trips[ME][key].cc, 'FO', 'kept when a later day file has it');
});

// Each person's own end and the rest they booked (owner, 2026-11-13: "Yes", offered "time each crew member's own end
// from their status, so one person going home early shows up for them" and "show the rest each person booked after
// a yard shift").
function townDay(day, lines) {
  // lines: { 'FO': [[from, to, text]], … } → a check every 8 minutes with the crews in town for job YQQS01.
  const snaps = [];
  for (let t = m(`${day} 0600`); t <= m(`${day} 2352`); t += 8) {
    const hhmm = T.fromMin(t).slice(11);
    const town = [];
    for (const [line, spans] of Object.entries(lines)) {
      const sp = spans.find(([a, b]) => hhmm >= a && hhmm <= b);
      if (sp) town.push({ turn: 'YQQS01', craft: line.slice(0, 2), pool: 'YARD YQQS01', text: `${line}: ${sp[2]}` });
    }
    snaps.push({ taken: T.fromMin(t), town, yardJobs: hhmm >= '0600' && hhmm <= '1712' ? [{ job: 'YQQS01', station: 'SARNIA', onDuty: dayOn(day, '0800'), hours: 8, crew: 'S1 B901' }] : [] });
  }
  return snaps;
}

test('yard: the collector keeps each crew line going from working to "on rest until", and nothing else', () => {
  const y = {};
  Files.collectYard(y, townDay('2026-11-04', {
    FO: [['0600', '0752', 'rested'], ['0800', '1712', 'status not known'], ['1720', '2352', 'on rest until 5th 0300']],
    'S1 (temporary)': [['0800', '1352', 'status not known'], ['1400', '2352', 'on rest until 5th 0000']], // went home at 1356
    'TT trainee': [['0800', '1712', 'status not known'], ['1720', '2352', 'rested']], // no rest booked: no event
  }));
  assert.deepEqual(y.bookoff.YQQS01, [
    { line: 'S1 (temporary)', w: m('2026-11-04 1352'), at: m('2026-11-04 1400'), until: m('2026-11-05 0000') },
    { line: 'FO', w: m('2026-11-04 1712'), at: m('2026-11-04 1720'), until: m('2026-11-05 0300') },
  ]);
});

test('yard: the rest they booked comes from their own crew line, after the end CATS gives; someone filling in by the temporary line', () => {
  const y = {};
  Files.collectYard(y, townDay('2026-11-04', {
    FO: [['0800', '1712', 'status not known'], ['1720', '2352', 'on rest until 5th 0300']],
    S1: [['0800', '1712', 'status not known'], ['1720', '2352', 'on rest until 5th 0230']],
    'S1 (temporary)': [['0800', '1352', 'status not known'], ['1400', '2352', 'on rest until 5th 0000']],
  }));
  const acc = tracker0('2026-11-05 2352');
  // CATS: 1 h of O-T, so off at 1700 (the crew lines went on rest when the ticket was closed, at about 1716).
  acc.yardOT = { [`YQQS01/${m('2026-11-04 0800')}`]: { ot: 60, seen: m('2026-11-05 0900') } };
  const holder = [{ turn: 'YQQS01', own: true, from: '2026-11-04 0000', to: '2026-11-05 2352' }];
  // The holder, craft read: their own line.
  named(acc, ME, 'YQQS01', '2026-11-04', '0600', '1712', { cc: 'FO' });
  let t = build(holder, acc, y).trips[0];
  assert.deepEqual([t.oe, t.ru, t.off], ['2026-11-04 1700', '2026-11-05 0300', '2026-11-04 1600']);
  // The holder, craft not read on the shift: the craft they are on their job as now.
  const acc2 = tracker0('2026-11-05 2352');
  named(acc2, ME, 'YQQS01', '2026-11-04', '0600', '1712');
  t = build(holder, acc2, y, { yardCraft: () => 'S1' }).trips[0];
  assert.deepEqual([t.oe, t.ru], [undefined, '2026-11-05 0230'], 'no O-T read: no end by CATS, the rest booked still said');
  // No craft at all: no rest (the own lines booked different ones).
  t = build(holder, acc2, y).trips[0];
  assert.equal(t.ru, undefined);
  // A spare filling the S1 in (their own turn B901 beside the craft): the temporary line, home at 1356.
  const acc3 = tracker0('2026-11-05 2352');
  acc3.yardOT = acc.yardOT;
  named(acc3, ME, 'YQQS01', '2026-11-04', '0600', '1352', { cc: 'S1' });
  const spare = [{ turn: 'B901', own: true, from: '2026-11-04 0000', to: '2026-11-05 2352' }];
  t = build(spare, acc3, y).trips[0];
  assert.deepEqual([t.turn, t.off, t.oe, t.ru], ['B901', '2026-11-04 1352', undefined, '2026-11-05 0000'], 'gone home early: not the job\'s O-T');
  // The yard view takes CATS's end, and the page says the rest booked: 10 h after the 1700 end.
  assert.deepEqual(MyStats.yardView({ trips: [{ id: 'YQQS01', at: '2026-11-04 0800', yard: true, off: '2026-11-04 1600', est: true, oe: '2026-11-04 1700' }] }).trips[0], { id: 'YQQS01', at: '2026-11-04 0800', yard: true, off: '2026-11-04 1700', oe: '2026-11-04 1700', rb: 1 });
  const rec = build(holder, acc, y);
  const h = MyStats.html(rec, { more: true, yard: true, code: 'ABCD' });
  assert.match(h, /Rest you booked after a shift<\/dt><dd>usually 10 h 00/);
  assert.match(h, /rest booked to 5 Nov 0300/);
  assert.match(h, /Shifts with their end from CATS<\/dt><dd>1 of 1<small>every one</);
  assert.match(h, /usually on duty 0800 · usually 9 h 00 a shift/, 'by CATS: no ~');
  assert.match(MyStats.csv(rec, 'all', { yard: true }), /"Rest booked until"\r\n.*"2026-11-05 0300"$/s);
  assert.doesNotMatch(MyStats.csv(rec, 'all'), /Rest booked until/);
  assert.doesNotMatch(MyStats.html(rec, { more: true }), /rest booked to|Rest you booked/);
});

test('yard: back on duty before the rest they booked was up is said, with a check mark', () => {
  const day = (d, ru) => ({ id: 'YQQS01', at: `${d} 0800`, turn: 'YQQS01', st: 'SARNIA', yard: true, off: `${d} 1600`, est: true, nm: 1, oe: `${d} 1600`, ru });
  const rec = { ...yardRec(), trips: [day('2026-11-04', '2026-11-05 0900'), day('2026-11-05', '2026-11-06 0200')], yoff: [] };
  const h = MyStats.html(rec, { more: true, yard: true, code: 'ABCD' });
  assert.match(h, /Back on duty before your booked rest was up<\/dt><dd>1 of 2 <span class="ms-pill ms-bad">check<\/span>/);
  assert.match(h, /YQQS01, on duty 5 Nov 0800, rest booked to 5 Nov 0900 \(1 h 00 early\)/);
});

// Owner, 2026-11-13: yes to the reset tracker going by real yard ends, then "We wont need to assume yard off duty
// times building 3 - 7 YD read". The test site's tracker first (data/resets-test.json); both sites since 2026-11-14
// ("do 1-3 5"): resets.json itself, which the boards, the reset alerts and My stats all go by.
test('yard: the reset tracker ends a yard shift 8 h and its O-T after on duty, where CATS has it', () => {
  const on = m('2026-11-04 0800');
  const acc = R.empty();
  acc.trips[ME] = { [`YQQS01/${on}`]: { train: 'YQQS01', on, job: 'YQQS01', first: on - 120, last: on + 600, yard: true, sure: true },
    [`YSBY03/${on + 1440}`]: { train: 'YSBY03', on: on + 1440, job: 'YSBY03', first: on + 1320, last: on + 2160, yard: true, sure: true } };
  acc.yardOT = { [`YQQS01/${on}`]: { ot: 130, seen: on + 900 }, [`YSBY03/${on + 1440}`]: { ot: null, seen: on + 2200 } };
  // YSBY03 was still on the Call Board when its blank was read: not closed, so no end by CATS.
  const yard = { runs: { YSBY03: { [on + 1440]: { on: on + 1440, first: on + 1320, last: on + 2300 } } } };
  const ends = Files.yardEnds(acc, yard);
  assert.deepEqual(ends, { [`YQQS01/${on}`]: on + 480 + 130 });
  const trip = { train: 'YQQS01', on, last: on + 600, job: 'YQQS01', yard: true };
  assert.deepEqual(R.offDuty(trip, null, { ...acc, yardEnds: ends }), { off: on + 610, how: 'yard O-T' });
  assert.deepEqual(R.offDuty(trip, null, acc), { off: on + 480, how: 'yard' }, 'no O-T read: 8 h');
  assert.deepEqual(R.offDuty({ ...trip, train: 'YSBY03', job: 'YSBY03', on: on + 1440 }, null, { ...acc, yardEnds: ends }).off, on + 1440 + 720, 'no O-T yet: 12 h on a YSBY job');
  // The page reads one tracker, on both sites; the laptop builds it with the yard ends and hands My stats the same.
  const loader = page.slice(page.indexOf('const resetsFile = '), page.indexOf('// The resets file for Person search'));
  assert.match(loader, /^const resetsFile = \(\) => getJSON\('data\/resets\.json'\);/);
  assert.doesNotMatch(page, /resets-test\.json'\)/);
  const site = fs.readFileSync(path.join(__dirname, '../../lib/board/site.js'), 'utf8');
  assert.ok(site.includes("  try { accT = { ...resets, yardEnds: MyStatsFiles.yardEnds(resets, yardRuns) }; }"));
  assert.ok(site.includes("resetsOut = { turns: Resets.byTurn(accT, people, resets.last), people: Resets.personResets(accT, people, resets.last), offs: Resets.trainOffs(accT) };"));
  assert.ok(site.includes('nowSeen, acc: accT, yard: yardRuns }'));
  assert.ok(!site.includes("'resets-test.json'"));
  assert.doesNotMatch(page, /getJSON\('data\/resets\.json'\)\.then/, 'every other read goes through resetsFile');
});
