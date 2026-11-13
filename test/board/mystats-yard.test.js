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

test('yard: a shift ends halfway between the last check that listed its job and the first that did not, where that can be trusted', () => {
  const on = m('2026-11-04 0800');
  const run = (first, last, gone) => ({ on, first: m(first), last: m(last), ...(gone ? { gone: m(gone) } : {}) });
  assert.equal(MyStats.boardEnd(run('2026-11-04 0600', '2026-11-04 1712', '2026-11-04 1720'), on, 'YQQS01'), m('2026-11-04 1716'));
  assert.equal(MyStats.boardEnd(run('2026-11-04 0600', '2026-11-04 1712'), on, 'YQQS01'), null, 'still listed: no end yet');
  assert.equal(MyStats.boardEnd(run('2026-11-04 0600', '2026-11-04 1600', '2026-11-04 1645'), on, 'YQQS01'), null, 'a gap of over 30 min in the checks');
  assert.equal(MyStats.boardEnd(run('2026-11-04 0900', '2026-11-04 1600', '2026-11-04 1608'), on, 'YQQS01'), null, 'the checks missed its start');
  assert.equal(MyStats.boardEnd(run('2026-11-04 0600', '2026-11-04 0930', '2026-11-04 0938'), on, 'YQQS01'), null, 'under 2 h');
  assert.equal(MyStats.boardEnd(run('2026-11-04 0600', '2026-11-05 0100', '2026-11-05 0108'), on, 'YQQS01'), null, 'over its 8 h + 4 h: listed far too long');
  assert.notEqual(MyStats.boardEnd(run('2026-11-04 0600', '2026-11-04 2330', '2026-11-04 2338'), on, 'YSBY01'), null, 'a YSBY job: 12 h + 4 h');
});

test('yard: a shift keeps the 8 h the site goes by and carries its Call Board end, craft and crew; capped at the next shift; none when they left early', () => {
  const y = {};
  Files.collectYard(y, week({ '2026-11-04': '1712', '2026-11-05': '1712', '2026-11-06': '1712' }));
  // A second job on the 5th, on duty at 1630 (named on both: moved over in the same day).
  Files.collectYard(y, [{ taken: '2026-11-05 1500', yardJobs: [{ job: 'YQQS02', station: 'SARNIA', onDuty: '5th 1630', hours: 8, crew: '' }] }]);
  const acc = tracker0('2026-11-11 2352');
  named(acc, ME, 'YQQS01', '2026-11-04', '0600', '1712', { cc: 'FO' });
  named(acc, ME, 'YQQS01', '2026-11-05', '0600', '1712', { cc: 'FO' });
  acc.trips[ME][`YQQS02/${m('2026-11-05 1630')}`] = { train: 'YQQS02', on: m('2026-11-05 1630'), job: 'YQQS02', first: m('2026-11-05 1500'), last: m('2026-11-05 1700'), yard: true, sure: true };
  named(acc, ME, 'YQQS01', '2026-11-06', '0600', '1200'); // off the crew lines at 1200 while the job ran on to 1712: left then
  const stretches = [{ turn: 'YQQS01', own: true, from: '2026-11-04 0000', to: '2026-11-11 2352' }];
  const rec = build(stretches, acc, y);
  const shift = (day, job = 'YQQS01') => rec.trips.find((t) => t.id === job && t.at.startsWith(day));
  assert.deepEqual(shift('2026-11-04'), { id: 'YQQS01', at: '2026-11-04 0800', turn: 'YQQS01', st: 'SARNIA', yard: true, off: '2026-11-04 1600', est: true, nm: 1, cb: '2026-11-04 1716', cc: 'FO', yw: ['S1 B901'] });
  assert.equal(shift('2026-11-05').cb, '2026-11-05 1630', 'never runs into the next shift');
  assert.equal(shift('2026-11-06').off, '2026-11-06 1200');
  assert.equal(shift('2026-11-06').cb, undefined, 'left early: their own last, no Call Board end');
  // The page with the yard view: the Call Board end; without it, the 8 h as before.
  const s = MyStats.stats(MyStats.yardView(rec));
  assert.equal(s.trips.find((t) => t.at === '2026-11-04 0800').dur, 9 * 60 + 16);
  assert.equal(MyStats.stats(rec).trips.find((t) => t.at === '2026-11-04 0800').dur, 8 * 60);
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

test('yard: how each yard job runs is the job\'s own runs, its length from them, and nobody\'s figures', () => {
  const y = {};
  const runDay = (job, onDuty, day, from, to) => {
    const out = [];
    for (let t = m(`${day} ${from}`); t <= m(`${day} ${to}`); t += 8) out.push({ taken: T.fromMin(t), yardJobs: [{ job, station: 'SARNIA', onDuty: dayOn(day, onDuty), hours: 8, crew: '' }] });
    out.push({ taken: T.fromMin(m(`${day} ${to}`) + 8), yardJobs: [] });
    return out;
  };
  // Checks every 8 minutes. An 8 h job: 7 h 58, 9 h 16 (1 h 16 over), 8 h 04. A YSBY job that runs 8 h, and one that runs 12.
  for (const [day, to] of [['2026-11-04', '1556'], ['2026-11-05', '1712'], ['2026-11-06', '1600']]) Files.collectYard(y, runDay('YQQS01', '0800', day, '0600', to));
  for (const day of ['2026-11-07', '2026-11-08', '2026-11-09']) Files.collectYard(y, runDay('YSBY09', '1430', day, '1230', '2236'));
  for (const day of ['2026-11-07', '2026-11-08', '2026-11-09']) Files.collectYard(y, runDay('YSBY12', '0700', day, '0500', '1904'));
  const out = Files.yardJobs(y);
  assert.deepEqual(out.jobs.map((j) => [j.job, j.start, j.length, j.runs, j.timed, j.median, j.over, j.early, j.longest]), [
    ['YQQS01', '0800', 480, 3, 3, 8 * 60 + 4, 1, 0, 9 * 60 + 16],
    ['YSBY09', '1430', 480, 3, 3, 8 * 60 + 7, 0, 0, 8 * 60 + 7], // a YSBY job that runs 8 h is an 8 h job (last listed 2230, gone 2244)
    ['YSBY12', '0700', 720, 3, 3, 12 * 60 + 6, 0, 0, 12 * 60 + 6], // last listed 1900, gone 1912
  ]);
  assert.deepEqual(Object.keys(out).sort(), ['from', 'jobs', 'to']);
  for (const j of out.jobs) assert.deepEqual(Object.keys(j).sort(), ['early', 'job', 'length', 'longest', 'median', 'over', 'runs', 'start', 'timed']);
  assert.equal(MyStats.lengthFrom('YSBY09', [480, 490]), 12 * 60, 'under 3 runs timed: the 8 / 12 h rule');
});

test('yard: "You and the yard" is given only with 5 yard workers, each end of the band halfway between two of them', () => {
  // Made-up yard workers, each 14 days on job YQQS01 with n shifts of 8 h 30 by the Call Board.
  const worker = (n) => {
    const trips = [];
    for (let i = 0; i < n; i++) { const day = T.fromMin(m('2026-11-01 0800') + i * 1440).slice(0, 10); trips.push({ id: 'YQQS01', at: `${day} 0800`, turn: 'YQQS01', st: 'SARNIA', yard: true, off: `${day} 1600`, est: true, nm: 1, cb: `${day} 1630` }); }
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
  for (const [day, cb] of [['2026-11-04', '1716'], ['2026-11-05', '1830'], ['2026-11-06', '1556'], ['2026-11-07', '']]) {
    trips.push({ id: 'YQQS01', at: `${day} 0800`, turn: 'YQQS01', st: 'SARNIA', yard: true, off: `${day} 1600`, est: true, nm: 1, ...(cb ? { cb: `${day} ${cb}` } : {}), cc: 'FO', yw: ['S1 B901'] });
  }
  return { v: MyStats.V, from: '2026-11-03', to: '2026-11-10', turns: [{ turn: 'YQQS01', own: true, from: '2026-11-03', to: '2026-11-10' }], trips, rests: [], spares: [{ seen: '2026-11-08 0600', turn: 'YQQS01', text: 'job YQQS01 on the vacancy list' }], pos: [], resets: [], due: null, passed: [], stale: [],
    yoff: [{ d: '2026-11-08', why: 'booked', job: 'YQQS01', cc: 'FO' }, { d: '2026-11-09', why: 'spare', job: 'YQQS01', cc: 'FO' }] };
}
const strip = (rec) => JSON.parse(JSON.stringify(rec, (k, v) => (['cb', 'cc', 'yw', 'yoff'].includes(k) ? undefined : v)));
const JOBS = { from: '2026-11-03', to: '2026-11-10', jobs: [{ job: 'YQQS01', start: '0800', length: 480, runs: 7, timed: 6, median: 500, over: 3, early: 0, longest: 630 }, { job: 'YQQS09', start: '1600', length: 480, runs: 7, timed: 7, median: 485, over: 1, early: 0, longest: 520 }] };

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
  assert.match(h, /Ran 15 min or more past its length<\/dt><dd>2 of 3/); // 1716 is 1 h 16 over, 1830 2 h 30, 1556 on time
  assert.match(h, /YQQS01 · FO/);
  assert.match(h, /ms-offday"[^>]*data-tip="[^"]*booked off/);
  assert.match(h, /ms-offday"[^>]*data-tip="[^"]*your job YQQS01 went spare for FO/);
  assert.match(h, /Spares on your yard crews<\/dt><dd>S1 B901/);
  assert.match(h, /Days your job went spare for your craft<\/dt><dd>1</);
  assert.doesNotMatch(h, /Goes-spare notes on your turn|Held away 14 h or more|Held away from home|Called under 8 h|Usual call miss/);
  assert.match(h, /You and the yard/);
  assert.match(h, /<b>YQQS09<\/b><small>an 8 h job<\/small>/); // the jobs they did not work, folded
  // The spreadsheet with the yard view: the Call Board end.
  assert.match(MyStats.csv(yardRec(), 'all', { yard: true }), /"2026-11-05 1830","yes","10:30"/);
  // The owner looking at someone else's page: said at the top.
  assert.match(MyStats.html(yardRec(), { more: true, yard: true, code: 'ABCD', other: true }), /ABCD's page, opened with the owner key/);
  // A road worker with the yard view: their page, with no yard pieces.
  const road = { ...strip(yardRec()), turns: [{ turn: 'SR04', own: true, from: '2026-11-03', to: '2026-11-10' }], trips: [{ id: 'M30241 04', at: '2026-11-04 0400', off: '2026-11-04 1200', turn: 'SR04', st: 'SARNIA' }], spares: [] };
  const r = MyStats.html(road, { more: true, yard: true, yardJobs: JOBS });
  assert.doesNotMatch(r, /ms-yardjob|ms-overtime|id="ms-yardjobs"/);
  assert.match(r, /<h3>Every trip<\/h3>/);
});

test('yard: only the test site asks for the yard view and the yard jobs, and only the owner there can open another code', () => {
  const tab = page.slice(page.indexOf('async function renderMine()'), page.indexOf('// Who gets alerts (owner, 2026-11-02)'));
  assert.match(tab, /const yardJobsAsked = PREVIEW \? getJSON\('data\/yardjobs\.json'\)/);
  assert.match(tab, /\.\.\.\(PREVIEW \? \{ yard: true, yardJobs, other: !!d\.other \} : \{\}\)/);
  assert.match(tab, /BoardMyStats\.csv\(d\.stats, mineRange, \{ yard: PREVIEW \}\)/);
  assert.match(tab, /const lookBox = \(\) => \{\n      if \(!PREVIEW\) return;/);
  assert.match(tab, /const look = PREVIEW \? mineLook : '';/);
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
