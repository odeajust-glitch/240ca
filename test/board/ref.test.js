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

test('yard jobs: on both sites for every member, and the search finds them', () => {
  const stub = () => ({ value: '', focus() {}, setSelectionRange() {}, querySelector: () => null, querySelectorAll: () => [] });
  const page = (state) => { const view = { innerHTML: '', querySelector: stub }; R.render(view, state); return view.innerHTML; };
  // The test site's first; every member since 2026-11-14 (owner, 2026-11-14: "Can you push the Job Aid tab and Page Health from the test to the main").
  assert.equal(page({ today: '2026-11-13' }), page({ preview: true, today: '2026-11-13' }));
  const html = page({ today: '2026-11-13' });
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

// A train's turns, for the pools' rotation: the Call Board's engineer and conductor; the Toronto
// bunkhouse's pairing only where the Call Board had none; a trainee is not a turn.
test('days out: the turns of a train out of Sarnia', () => {
  const t = (r) => R.crewTurns(r).sort().join(' ');
  assert.strictEqual(t({ crew: 'EN S106 · CO SA05' }), 'S106 SA05');
  assert.strictEqual(t({ crew: 'EN SD04 · CO SR08', awayCo: 'SA05', awayEn: 'SD04' }), 'SD04 SR08'); // the guess is not taken over the Call Board
  assert.strictEqual(t({ crew: 'EN S103', awayCo: 'SA02', awayEn: 'S103' }), 'S103 SA02'); // the Call Board had no conductor
  assert.strictEqual(t({ crew: 'EN S102 · ET S102 · CO SA01 · TT SA99' }), 'S102 SA01');
  assert.strictEqual(t({ crew: 'EN S108 · CO SA98' }), 'S108'); // a trainee slot
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

test('days out: on both sites; a download a pool, then the week from the day picked', () => {
  const trains = rotationTrains('2026-10-17', 28);
  let boxes = {};
  const stub = () => ({ value: '', focus() {}, setSelectionRange() {}, querySelector: () => null, querySelectorAll: () => [] });
  const page = (state) => { boxes = {}; const view = { innerHTML: '', querySelector: (s) => (s === '#duebox' ? { set innerHTML(v) { boxes[s] = v; }, get innerHTML() { return boxes[s]; }, querySelector: () => null, querySelectorAll: () => [] } : stub()) }; R.render(view, state); return view.innerHTML + Object.values(boxes).join(''); };
  // Every member since 2026-11-14 (owner, 2026-11-14: "Can you push the Job Aid tab and Page Health from the test to the main").
  assert.ok(/Days out of Sarnia/.test(page({ today: '2026-11-13', trains })));
  const html = page({ preview: true, today: '2026-11-13', trains });
  assert.ok(html.includes('Days out of Sarnia: add each pool to your calendar'));
  // The record of trips worked is gone (owner: "I dont want a calendar of what jobs were worked").
  assert.ok(!/outcal|data-outturn|trips home not seen/.test(html));
  assert.deepStrictEqual([...html.matchAll(/data-icspool="(\w+)"/g)].map((m) => m[1]), ['S1', 'S3', 'SA', 'SB', 'S5', 'all']);
  assert.ok(html.indexOf('data-icspool') < html.indexOf('class="reft duet"')); // the calendar files come first
  assert.strictEqual((html.match(/<tr( class="hit")?><td class="nw"><b>/g) || []).length, 7);
  assert.ok(html.includes('<tr class="hit"><td class="nw"><b>Fri, Nov 13</b>'));
  // A turn typed in the search is the one turn to download.
  const one = page({ preview: true, today: '2026-11-13', trains, q: 'sa05' });
  assert.ok(one.includes('data-icsturn="SA05"') && one.includes('<option selected>SA05</option>'));
  // Each file names its calendar.
  const fits = Object.fromEntries(R.OUT_POOLS.map(([k, , re]) => [k, R.fitRotation(trains, re)]));
  assert.ok(R.icsFor(fits, { from: '2026-11-14', days: 1, pools: ['SA'], name: 'Days out: A pool (SA)' }).includes('X-WR-CALNAME:Days out: A pool (SA)\r\n'));
});

// The yardmaster jobs (owner, 2026-11-13: "in the job aid test section add the YM Schedule like the other yard
// jobs, then have a line that says 'Next Yard Job' and show the job, then have a line that says 'If it was spare,
// who would work it' then have 2 answers, one with someone on the YM SB and one without"). Made-up people.
test('yard jobs: the yardmaster jobs in their own table, on the schedule the call order works from', () => {
  const Y = require('../../public/board-ym');
  assert.deepStrictEqual(R.YM_JOBS.map((j) => j[0]).sort(), Object.keys(Y.YA_JOBS).sort());
  for (const [job, start, hours, days] of R.YM_JOBS) {
    const ya = Y.YA_JOBS[job];
    assert.strictEqual(`${ya.start} ${ya.hours}`, `${start} ${hours}`, job);
    for (let k = 0; k < 28; k++) {
      const d = Y.addDays('2026-11-09', k);
      assert.strictEqual(ya.runs(d), days === 'week' ? !['Sat', 'Sun'].includes(Y.dowOf(d)) : R.towerOn(d) === days, `${job} ${d}`);
    }
  }
  const stub = () => ({ value: '', focus() {}, setSelectionRange() {}, querySelector: () => null, querySelectorAll: () => [] });
  const page = (state) => { const view = { innerHTML: '', querySelector: stub }; R.render(view, state); return view.innerHTML; };
  const html = page({ preview: true, today: '2026-11-13' });
  const each = html.slice(html.indexOf('<h4>Each job</h4>'), html.indexOf('<h4>Relief jobs'));
  assert.ok(each.includes('YEBS03') && !/YSTY01|YSBY06/.test(each)); // moved to their own table
  const ym = html.slice(html.indexOf('<h4>Yardmaster jobs (YA)</h4>'), html.indexOf('<h4>Tower'));
  assert.ok(ym.includes('<th>Job</th><th>On duty</th><th>Crew off</th>'));
  assert.ok(ym.includes('<b>YSTY01</b><div class="crew">Tower S/S</div></td><td class="num">0630</td><td>Sat, Sun</td>'));
  assert.ok(ym.includes('<b>YSBY01</b> <span class="chip">12 h</span><div class="crew">YDM Block 1</div></td><td class="num">0700</td><td><div class="nw">This week: Wed, Thu</div><div class="nw">Next week: Mon, Tue, Fri–Sun</div>'));
  assert.ok(ym.includes('<b>YSBY04</b> <span class="chip">12 h</span><div class="crew">YDM Block 4</div></td><td class="num">1900</td><td><div class="nw">This week: Mon, Tue, Fri–Sun</div><div class="nw">Next week: Wed, Thu</div>'));
  // "Next Yard Job" is on Page Health now (owner, 2026-11-14: "take this out of the job aid section, move it to
  // page health"): Job Aids has no box for it and no longer calls the page's hook.
  assert.ok(!html.includes('ymnext'));
  assert.ok(page({ today: '2026-11-13' }).includes('<h4>Yardmaster jobs (YA)</h4>')); // the main site too, since 2026-11-14
  assert.ok(page({ preview: true, today: '2026-11-13', q: 'ysby04' }).includes('<b>YSBY04</b>'));
  let drawn = 0;
  page({ preview: true, today: '2026-11-13', ymNext: () => { drawn++; } });
  assert.strictEqual(drawn, 0);
});

test('yard jobs: "Next Yard Job" and "If it was spare, who would work it", with and without the YM spareboard', () => {
  const Y = require('../../public/board-ym');
  const L = {
    read: '2026-11-13T20:46:29.689Z', source: 'cats',
    list: [{ rank: 10, assignment: 'YSBY01YA', status: '' }, { rank: 30, assignment: 'EXYA01YA', status: '' }, { rank: 65, assignment: 'XSAS01FO', status: '' }, { rank: 70, assignment: 'SRSR10CO', status: '' }],
    live: { taken: '2026-11-13 1754', byRank: { 10: { status: 'available', freeAt: '', text: 'YSBY01 YA: rested', src: 'crews in town' } } },
    byRank: { 10: 'Alder, T', 30: 'Dogwood, M', 65: 'Ivy, R', 70: 'Fir, K' },
  };
  const now = Y.toMin('2026-11-13', '1830');
  const html = R.ymNextHtml({ Y, L, now });
  assert.ok(html.startsWith('<h4>Next Yard Job</h4><p class="ymjob"><b class="num">YSBY01</b> YDM Block 1 · <b>Sat 14th 0700</b>, 12 h · call Sat 14th 0500 · its holder Alder, T</p>'));
  assert.ok(html.includes('<h4>If it was spare, who would work it</h4>'));
  // Someone on the spareboard: the spare. Nobody: XSAS01, on YBHS01 at 0800 that Saturday, moved up (not called yet).
  assert.ok(html.includes('<tr><td>Someone on it</td><td><b>Dogwood, M</b> <span class="muted">rank 30</span><div class="crew">Step 1: Spare yardmaster · 2-hour call · straight time</div></td></tr>'));
  assert.ok(html.includes('<tr><td>Nobody on it</td><td><b>Ivy, R</b> <span class="muted">rank 65</span><div class="crew">Step 3: Working in the yard that day, not called yet · 2-hour call · straight time</div></td></tr>'));
  assert.ok(html.includes('Everyone as the board check of 1754 on 13 Nov showed them'));
  assert.ok(html.includes('the seniority list as read 13 Nov, 15:46, by the call order page’s starting rules'));
  assert.ok(html.includes('<a href="ym.html">the call order test →</a>'));
  // The rules saved on the call order page on this phone, when there are some: a one-hour call.
  const saved = R.ymNextHtml({ Y, L, now, rules: { ...Y.startingRules(), leadMin: 60 } });
  assert.ok(saved.includes('call Sat 14th 0600') && saved.includes('by the rules saved on the call order page on this phone') && saved.includes('1-hour call'));
  // The names not opened: by rank, once. No list on the site yet, or it didn't load.
  assert.ok(R.ymNextHtml({ Y, L: { ...L, byRank: null }, now }).includes('<td><b>Rank 30</b><div class="crew">Step 1'));
  assert.ok(R.ymNextHtml({ Y, L: { error: 'none' }, now }).includes('isn’t on the site yet'));
  assert.ok(R.ymNextHtml({ Y, L: { error: 'data/ym-list.json: 500' }, now }).includes('didn’t load'));
  // Nothing from the board yet: by the list only, and said so.
  assert.ok(R.ymNextHtml({ Y, L: { ...L, live: null }, now }).includes('by their status on the seniority list only'));
  // The yardmaster spareboard read (owner, 2026-11-14: 2 → 16): the spare's turn on it, on rest until 0500 as in his
  // photo, so free at YSBY01's 0500 call: "Someone on it" is now, and the board is said with the name.
  const read = { ...L, live: { ...L.live, byRank: { ...L.live.byRank, 30: { status: 'available', freeAt: '2026-11-14T05:00', text: 'YA01 YA: rest until 14th 0500', src: 'Yardmaster spareboard' } },
    spareboard: [{ pos: '001', turn: 'YA01', status: 'rest until 14th 0500' }] } };
  const on = R.ymNextHtml({ Y, L: read, now });
  assert.ok(on.includes('<p class="ymjob">Yardmaster spareboard at the check of 1754: <b class="num">YA01</b> Dogwood, M · rest until 14th 0500.</p>'));
  assert.ok(on.includes('<tr><td>Someone on it <span class="chip">now</span></td><td><b>Dogwood, M</b>'));
  assert.ok(on.includes('<tr><td>Nobody on it</td>'));
  // On rest past the call (until 0501): skipped, so the next in line even with someone on the board.
  const late = { ...read, live: { ...read.live, byRank: { ...read.live.byRank, 30: { ...read.live.byRank[30], freeAt: '2026-11-14T05:01', text: 'YA01 YA: rest until 14th 0501' } } } };
  assert.ok(R.ymNextHtml({ Y, L: late, now }).includes('<tr><td>Someone on it <span class="chip">now</span></td><td><b>Ivy, R</b>'));
  // Read and empty: "Nobody on it" is now.
  const empty = R.ymNextHtml({ Y, L: { ...L, live: { ...L.live, spareboard: [] } }, now });
  assert.ok(empty.includes('Yardmaster spareboard at the check of 1754: nobody on it.') && empty.includes('<tr><td>Nobody on it <span class="chip">now</span></td>'));
  // The box is filled in place.
  const box = { innerHTML: '' };
  R.paintYmNext(box, { Y, L, now });
  assert.ok(box.innerHTML.includes('Dogwood, M'));
});

// Owner, 2026-11-14: "Yard jobs: start times, days off and relief / Days out of Sarnia: add each pool to your
// calendar / Track lengths: Mac Yard, B.I.T. Yard, Malport / CATS status and ECC codes / Job types for Eastern
// Canada / Held-away penalty (time off duty → penalty miles) — in Job Aids, make this the correct order".
// All six on both sites since 2026-11-14 (owner, 2026-11-14: "Can you push the Job Aid tab and Page Health from the test to the main"); state.preview no longer changes anything.
test('Job Aids: the sections in the owner\'s order, the held-away penalty last', () => {
  const draw = (preview) => {
    const view = { innerHTML: '', querySelector: (sel) => (sel === '#refq' ? {} : null) };
    R.render(view, { preview, today: '2026-11-14' });
    return [...view.innerHTML.matchAll(/<details class="refsec" id="ref-([a-z]+)"/g)].map((m) => m[1]);
  };
  assert.deepStrictEqual(draw(true), ['yardjobs', 'due', 'tracks', 'status', 'jobs', 'held']);
  assert.deepStrictEqual(draw(false), ['yardjobs', 'due', 'tracks', 'status', 'jobs', 'held']);
});
