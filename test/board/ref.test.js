// Reference tab (owner, 2026-11-03): the held-away penalty sheet.
const test = require('node:test');
const assert = require('node:assert');
const R = require('../../public/board-ref');

test('held-away penalty matches the posted sheet', () => {
  const t = (h, m) => R.penalty(h * 60 + m);
  const sheet = [[10, 0, 0], [10, 1, 0.21], [10, 3, 0.63], [10, 33, 6.88], [10, 59, 12.29], [11, 0, 12.5], [11, 59, 24.79], [12, 0, 25],
    [12, 1, 37.71], [12, 59, 49.79], [13, 0, 50], [13, 1, 62.71], [13, 59, 74.79], [14, 0, 75], [14, 1, 75.31], [14, 6, 76.88],
    [14, 59, 93.44], [15, 0, 93.75], [15, 20, 100], [15, 59, 112.19], [16, 0, 112.5], [16, 1, 212.5], [17, 0, 212.5], [17, 1, 312.5], [22, 0, 712.5]];
  for (const [h, m, want] of sheet) assert.strictEqual(t(h, m), want, `${h}:${m}`);
  assert.strictEqual(t(9, 30), 0);
  assert.strictEqual(t(22, 1), null);
});

test('reference lists: every status letter, C yard without CO45', () => {
  assert.strictEqual(R.STATUS.map((s) => s[0]).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const c = R.YARDS.find((y) => y.name === 'Mac Yard: C yard').tracks;
  assert.strictEqual(R.YARDS[R.YARDS.length - 1].name, 'Mac Yard: C yard'); // after Malport
  assert.strictEqual(c.length, 77);
  assert.ok(!c.some((x) => x[0] === 'CO45'));
  assert.deepStrictEqual(c.find((x) => x[0] === 'CO78'), ['CO78', 900]);
});

test('yard jobs: YSBY is a 12-hour shift (owner, 2026-11-03)', () => {
  const BoardTurns = require('../../public/board-turns');
  const s = { taken: '2026-11-03 0500', lineup: [], onDuty: [], away: [], returning: [], sequence: [], bunkhouse: [], vacancies: [], pools: [],
    yardJobs: [{ job: 'YSBY04', station: 'SARNIA', onDuty: '2nd 1900', off: '3rd 0700', hours: 12, crew: 'FO B126' }] };
  assert.ok(BoardTurns.facts(s, 'B126').some((f) => /off ~3rd 0700, 12 h assumed/.test(f.text)));
});

// Yard jobs, days off and relief (owner, 2026-11-13: "I want to add the yard jobs and their
// schedule and rotations"), read off the checks of 24 Oct to 12 Nov 2026. Test site only.
test('yard jobs: each relief job works five days and is off two, on jobs the table has', () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const known = new Set([...R.YARD_JOBS.map((j) => j[0]), ...Object.keys(R.RUNS_AS)]);
  for (const [rel, off, week] of R.RELIEF) {
    assert.strictEqual(off.length, 2, rel);
    assert.deepStrictEqual(days.filter((d) => !week[d]), days.filter((d) => off.includes(d)), rel);
    for (const job of Object.values(week)) assert.ok(known.has(job), `${rel} works ${job}`);
  }
  // CATS's own headings on the crews in town.
  assert.deepStrictEqual(R.RELIEF.find((r) => r[0] === 'XSAS01')[1], ['Thu', 'Fri']);
  assert.deepStrictEqual(R.RELIEF.find((r) => r[0] === 'XSAS03')[1], ['Mon', 'Tue']);
  // The owner's own reading of XSAS01 (2026-11-11): Sat/Sun YBHS01, Mon/Tue YPRS02, Wed YPRS30.
  assert.deepStrictEqual(R.reliefWeek(['Thu', 'Fri'], R.RELIEF[0][2]).map((r) => `${r.days.join('/')} ${r.job}`), ['Sat/Sun YBHS01', 'Mon/Tue YPRS02', 'Wed YPRS30']);
});

test('yard jobs: every crew is off two days, and who covers them', () => {
  for (const [job] of R.YARD_JOBS) assert.strictEqual(R.yardCover(job).off.length, 2, job);
  const c = (job) => { const x = R.yardCover(job); return `${x.off.join(',')} ${x.by.map((b) => `${b.day}:${b.relief}${b.as ? `=${b.as}` : ''}`).join(' ')}`; };
  assert.strictEqual(c('YBHS01'), 'Sat,Sun Sat:XSAS01 Sun:XSAS01');
  assert.strictEqual(c('YFLS60'), 'Sun,Mon Mon:XSAS02 Sun:XSAS02'); // read in week order from the first day off
  assert.strictEqual(c('YPRS30'), 'Wed,Thu Wed:XSAS01 Thu:XSAS02');
  assert.strictEqual(c('YBHS60'), 'Fri,Sat Fri:XSAS03 Sat:XSAS05=YBHS61');
  assert.strictEqual(c('YEBS03'), 'Thu,Fri Thu:XSAS05=YEBS04 Fri:XSAS05=YEBS04');
  assert.strictEqual(c('YFLS01'), 'Sat,Sun Sat:XSAS04');
  assert.deepStrictEqual(R.yardCover('YFLS01').none.days, ['Sun']);
  assert.strictEqual(c('YINS30'), 'Sat,Sun ');
});

test('yard jobs: the tower turn about matches every day the checks saw', () => {
  const seen = { b: ['2026-10-24', '2026-10-25', '2026-10-28', '2026-10-29', '2026-11-02', '2026-11-03', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-11', '2026-11-12'],
    a: ['2026-10-26', '2026-10-27', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-04', '2026-11-05', '2026-11-09', '2026-11-10', '2026-11-13'] };
  for (const [side, list] of Object.entries(seen)) for (const day of list) assert.strictEqual(R.towerOn(day), side, day);
  assert.strictEqual(R.towerOn('2027-01-04'), R.towerOn('2026-10-26')); // ten weeks on: the same week
});

test('yard jobs: only on the test site (preview), and the search finds them', () => {
  const stub = () => ({ value: '', focus() {}, setSelectionRange() {} });
  const page = (state) => { const view = { innerHTML: '', querySelector: stub }; R.render(view, state); return view.innerHTML; };
  assert.ok(!/XSAS|Yard jobs: start/.test(page({})));
  const html = page({ preview: true, today: '2026-11-13' });
  assert.ok(html.includes('Yard jobs: start times, days off and relief'));
  assert.ok(/This week<div class="crew">from Nov 9<\/div><\/td><td><div class="nw">Mon, Tue: <b class="num">YSBY01 \/ YSBY02/.test(html));
  const found = page({ preview: true, today: '2026-11-13', q: 'xsas02' });
  assert.ok(found.includes('YFLS60') && found.includes('YPRS60') && !found.includes('YBHS01'));
  // A job finds the relief that covers it under its own name (XSAS05 works YBHS60's Saturday as YBHS61).
  const job = page({ preview: true, today: '2026-11-13', q: 'ybhs60' });
  assert.ok(job.includes('XSAS03') && job.includes('XSAS05'));
});
