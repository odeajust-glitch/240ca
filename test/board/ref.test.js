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
  const stub = () => ({ value: '', focus() {}, setSelectionRange() {}, querySelector: () => null, querySelectorAll: () => [] });
  const page = (state) => { const view = { innerHTML: '', querySelector: stub }; R.render(view, state); return view.innerHTML; };
  assert.ok(!/XSAS|Yard jobs: start/.test(page({})));
  const html = page({ preview: true, today: '2026-11-13' });
  assert.ok(html.includes('Yard jobs: start times, days off and relief'));
  // No "covered by" column on the jobs' table (owner, 2026-11-13: "get rid of the covered by column for the non relief jobs").
  const jobsTable = html.slice(html.indexOf('<h4>Each job</h4>'), html.indexOf('<h4>Relief jobs'));
  assert.ok(jobsTable.includes('<th>Crew off</th></tr>') && !/Covered by|XSAS/.test(jobsTable));
  assert.ok(jobsTable.includes('Runs Mon–Fri only'));
  assert.ok(/This week<div class="crew">from Nov 9<\/div><\/td><td><div class="nw">Mon, Tue: <b class="num">YSBY01 \/ YSBY02/.test(html));
  const found = page({ preview: true, today: '2026-11-13', q: 'xsas02' });
  assert.ok(found.includes('YFLS60') && found.includes('YPRS60') && !found.includes('YBHS01'));
  // A job finds the relief that covers it under its own name (XSAS05 works YBHS60's Saturday as YBHS61).
  const job = page({ preview: true, today: '2026-11-13', q: 'ybhs60' });
  assert.ok(job.includes('XSAS03') && job.includes('XSAS05'));
});

// Days out of Sarnia, a calendar for each turn (owner, 2026-11-13: "add a thing that will add a
// calendar showing each turns days out of sarnia, So s1, s3, A pool, B pool and 502/501 turns").
const TRAINS = [
  // SA05 + S106 out on the 9th, home on the 10th (the trip's own `back`).
  { id: 'M30241 09', from: 'sarnia', onDuty: '2026-11-09 0545', crew: 'EN S106 · CO SA05', back: { id: 'E27531 10', onDuty: '2026-11-10 0145', crew: 'EN S106 · CO SA05' } },
  // The same trip seen again under another id ten minutes later: the first is kept.
  { id: 'M30241 09B', from: 'sarnia', onDuty: '2026-11-09 0555', crew: 'EN S106 · CO SA05' },
  // A bunkhouse guess naming SA05 on a train whose Call Board had a conductor: not SA05's.
  { id: 'RM39491 11', from: 'sarnia', onDuty: '2026-11-11 0555', crew: 'EN SD04 · CO SR08', awayCo: 'SA05', awayEn: 'SD04' },
  // A trainee slot named as a conductor is not a turn of its own.
  { id: 'X27861 07', from: 'sarnia', onDuty: '2026-11-07 0800', crew: 'EN S108 · CO SA98' },
  // SA02 on a train whose Call Board had only the engineer: the bunkhouse's conductor counts.
  { id: 'M39491 09', from: 'sarnia', onDuty: '2026-11-10 0500', crew: 'EN S103', awayCo: 'SA02', awayEn: 'S103' },
  // SB03 + S303 out on the 6th; the trip's `back` is the engineer's only, so SB03's is found
  // among the trains from Toronto (two days later).
  { id: 'A42431 06', from: 'sarnia', onDuty: '2026-11-06 1045', crew: 'EN S303 · CO SB03 · TT SB99', back: { id: 'M30131 07', onDuty: '2026-11-07 1030', crew: 'EN S303 · CO SB01' } },
  { id: 'M30131 08', from: 'mac', onDuty: '2026-11-08 2200', crew: 'EN S305 · CO SB03' },
  // SB03 out again on the 12th, not home yet.
  { id: 'A42431 12', from: 'sarnia', onDuty: '2026-11-12 1015', crew: 'EN S303 · CO SB03' },
  // 501/502: L502 out, home from Garnet the same day; a trainee alone is not the turn.
  { id: 'L50231 10', from: 'sarnia', onDuty: '2026-11-10 0245', crew: 'EN S501 · CO S501' },
  { id: 'L50231 11', from: 'sarnia', onDuty: '2026-11-11 0245', crew: 'EN MU01 · CO MU01 · TT S502' },
];

test('days out: each turn from going on duty in Sarnia to going on duty in Toronto for home', () => {
  const out = (turn) => { const d = R.daysOut(TRAINS, turn, '2026-11-13'); return Object.keys(d.days).filter((k) => d.days[k].isOut).sort().join(' '); };
  assert.strictEqual(out('SA05'), '2026-11-09 2026-11-10');
  assert.deepStrictEqual(R.tripsOut(TRAINS, 'SA05', '2026-11-13').map((t) => t.id), ['M30241 09']); // not M30241 09B, not RM39491 11
  assert.strictEqual(out('SA98'), '');
  assert.strictEqual(out('SA02'), '2026-11-10 2026-11-11 2026-11-12 2026-11-13'); // its last trip, three days ago: still away
  assert.strictEqual(out('SB03'), '2026-11-06 2026-11-07 2026-11-08 2026-11-12 2026-11-13'); // home on the 8th; out again, still away
  assert.strictEqual(R.tripsOut(TRAINS, 'SB03', '2026-11-13')[1].away, true);
  assert.strictEqual(out('S303'), '2026-11-06 2026-11-07 2026-11-12 2026-11-13');
  assert.strictEqual(out('S501'), '2026-11-10');
  assert.strictEqual(out('S502'), '');
  assert.strictEqual(out('SB99'), ''); // a trainee slot
  const d = R.daysOut(TRAINS, 'SA05', '2026-11-13');
  assert.deepStrictEqual([d.days['2026-11-09'].out, d.days['2026-11-10'].home], [['0545'], ['0145']]);
  // Last out a week ago with no trip home seen: only that day, counted as not seen.
  const old = R.daysOut([{ id: 'Z14891 05', from: 'sarnia', onDuty: '2026-11-06 0930', crew: 'EN S101 · CO SA01' }], 'SA01', '2026-11-13');
  assert.deepStrictEqual([old.count, old.unseen], [1, 1]);
});

test('days out: the calendar, only on the test site, a turn typed in the search opens it', () => {
  const stub = () => ({ value: '', focus() {}, setSelectionRange() {}, querySelector: () => null, querySelectorAll: () => [] });
  const page = (state) => { let box = ''; const view = { innerHTML: '', querySelector: (s) => (s === '#outbox' ? { set innerHTML(v) { box = v; }, get innerHTML() { return box; }, querySelectorAll: () => [] } : stub()) }; R.render(view, state); return view.innerHTML + box; };
  assert.ok(!/Days out of Sarnia/.test(page({ trains: TRAINS })));
  const html = page({ preview: true, today: '2026-11-13', trains: TRAINS, q: 'sb03' });
  assert.ok(html.includes('Days out of Sarnia'));
  assert.ok(/data-outpool="SB" aria-pressed="true"/.test(html) && /data-outturn="SB03" aria-pressed="true"/.test(html));
  assert.strictEqual((html.match(/<td class="out/g) || []).length, 5);
  assert.ok(html.includes('↑1045') && html.includes('↓2200') && /out <b>5<\/b> of 8 days/.test(html));
  // Before the trains arrive.
  assert.ok(page({ preview: true, today: '2026-11-13' }).includes('Loading the trains'));
});

// Due out of Sarnia (owner, 2026-11-13, with a photo of his own Google Calendar: "I want you to be
// able to export something like this so you can see what pool jobs are due out of Sarnia on a
// particular day"). Trains made from the rotation the board saw (16 Oct to 13 Nov: 284 of 284).
function rotationTrains(from, days, skip = () => false) {
  const add = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const pools = [['S1', 10, 3, 0], ['SA', 9, 3, 1], ['S3', 6, 2, 4], ['SB', 6, 2, 4], ['S5', 2, 1, 0]];
  const turn = (p, i) => ({ S1: `S1${String(i + 1).padStart(2, '0')}`, S3: `S3${String(i + 1).padStart(2, '0')}`, SA: `SA${String(i + 1).padStart(2, '0')}`, SB: `SB${String(i + 1).padStart(2, '0')}`, S5: `S50${i + 1}` }[p]);
  const out = [];
  for (let n = 0; n < days; n++) {
    const day = add(from, n);
    for (const [p, size, per, off] of pools) {
      for (let i = 0; i < per; i++) {
        const t = turn(p, (per * n + off + i) % size);
        if (!skip(t, day)) out.push({ id: `X${p}${n}${i}`, from: 'sarnia', onDuty: `${day} 0${i + 5}00`, crew: `${p === 'SA' || p === 'SB' ? 'CO' : 'EN'} ${t}` });
      }
    }
  }
  return out;
}

test('due out: the rotation fitted from the trains gives his own calendar back', () => {
  const trains = rotationTrains('2026-10-17', 28, (t, d) => t === 'SA04' && d === '2026-11-01'); // a trip not seen
  trains.push({ id: 'Z1', from: 'sarnia', onDuty: '2026-11-02 0900', crew: 'EN S111 · CO SA10' }); // a stray turn, seen once: not in the pool
  const fit = (re) => R.fitRotation(trains, re);
  const s1 = fit(/^S1\d\d$/); const sa = fit(/^SA\d\d$/); const s5 = fit(/^S50[12]$/);
  assert.deepStrictEqual([s1.per, s1.turns.length, s1.hit === s1.total], [3, 10, true]);
  assert.deepStrictEqual([sa.per, sa.turns.length, sa.hit === sa.total], [3, 9, true]);
  // His Google Calendar: 8 Oct S104 S105 S106, SA02 SA03 …; 10 Oct S101 S102 S110, SA01 SA08 …
  assert.deepStrictEqual(s1.due('2026-10-08'), ['S104', 'S105', 'S106']);
  assert.deepStrictEqual(sa.due('2026-10-08'), ['SA02', 'SA03', 'SA04']);
  assert.deepStrictEqual(s1.due('2026-10-10').sort(), ['S101', 'S102', 'S110']);
  assert.deepStrictEqual(sa.due('2026-10-10').sort(), ['SA01', 'SA08', 'SA09']);
  assert.deepStrictEqual(s1.due('2026-11-07').includes('S104'), true); // his last row
  assert.deepStrictEqual([s5.due('2026-11-12'), s5.due('2026-11-13')], [['S501'], ['S502']]);
  // The board's own: SB03 and S303 left on 12 Nov; SA05 on 11 Nov.
  assert.deepStrictEqual(fit(/^SB\d\d$/).due('2026-11-12'), ['SB03', 'SB04']);
  assert.deepStrictEqual(fit(/^S3\d\d$/).due('2026-11-12'), ['S303', 'S304']);
  assert.ok(sa.due('2026-11-11').includes('SA05'));
  // Too few trips to tell: nothing projected.
  assert.strictEqual(R.fitRotation(trains.slice(0, 3), /^SB\d\d$/), null);
});

test('due out: the calendar file, an all-day event a turn a day', () => {
  const trains = rotationTrains('2026-10-17', 28);
  const fits = Object.fromEntries(R.OUT_POOLS.map(([k, , re]) => [k, R.fitRotation(trains, re)]));
  const ics = R.icsFor(fits, { from: '2026-11-14', days: 7, now: new Date('2026-11-13T12:00:00Z') });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 7 * (3 + 3 + 2 + 2 + 1));
  assert.ok(!ics.split('\r\n').some((l) => l.length > 75), 'lines folded');
  assert.ok(/\r\nBEGIN:VEVENT\r\nUID:S501-20261114@sarnia-board\r\nDTSTAMP:20261113T120000Z\r\nDTSTART;VALUE=DATE:20261114\r\nDTEND;VALUE=DATE:20261115\r\nSUMMARY:S501\r\n/.test(ics));
  const mine = R.icsFor(fits, { from: '2026-11-14', days: 30, turn: 'SA05' });
  assert.deepStrictEqual(mine.match(/DTSTART;VALUE=DATE:\d+/g).map((x) => x.slice(-4)), ['1114', '1117', '1120', '1123', '1126', '1129', '1202', '1205', '1208', '1211']);
  const one = R.icsFor(fits, { from: '2026-11-14', days: 1, pools: ['S5'] });
  assert.strictEqual((one.match(/SUMMARY:/g) || []).length, 1);
});

test('due out: on the test site only; seven days from the day picked', () => {
  const trains = rotationTrains('2026-10-17', 28);
  let boxes = {};
  const stub = () => ({ value: '', focus() {}, setSelectionRange() {}, querySelector: () => null, querySelectorAll: () => [] });
  const page = (state) => { boxes = {}; const view = { innerHTML: '', querySelector: (s) => (/^#(due|out)box$/.test(s) ? { set innerHTML(v) { boxes[s] = v; }, get innerHTML() { return boxes[s]; }, querySelector: () => null, querySelectorAll: () => [] } : stub()) }; R.render(view, state); return view.innerHTML + Object.values(boxes).join(''); };
  assert.ok(!/Due out of Sarnia/.test(page({ trains })));
  const html = page({ preview: true, today: '2026-11-13', trains });
  assert.strictEqual((html.match(/<tr( class="hit")?><td class="nw"><b>/g) || []).length, 7);
  assert.ok(html.includes('<tr class="hit"><td class="nw"><b>Fri, Nov 13</b>'));
  assert.ok(/matched <b>78 of 78<\/b>|matched <b>\d+ of \d+<\/b>/.test(html) && html.includes('Download the calendar file (.ics)'));
});
