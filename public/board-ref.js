// Job Aids tab, first called Reference (owner, 2026-11-03: "general useful
// information"; renamed 2026-11-11: "can we change reference to Job Aids"): CATS
// status and ECC codes, job types for Eastern Canada, Mac / B.I.T. / Malport
// track lengths and the held-away penalty (with a calculator). Typed in from
// the owner's photos of the CATS Eastern Canada Guide for Operating Crews and
// the sheets posted at work. On the test site only (2026-11-13): the yard jobs
// and their relief rotations (read off the checks once, kept below) and the
// road pools' days out of Sarnia for a calendar (from the site's trains, live).
(function (root) {
  const STATUS = [
    ['A', 'Available'], ['B', 'Working'], ['C', 'To Place'], ['D', 'Bereavement'],
    ['E', 'Excused Absence', [['45', 'Inclement'], ['48', 'Religion'], ['49', 'National Guard Duty']]],
    ['F', 'Off Duty Injury'],
    ['G', 'On Duty Injury', [['01', 'Accommodating Duties'], ['02', 'Compensation']]],
    ['H', 'Held Out of Service', [['04', 'Off Until Allow'], ['05', 'Discipline'], ['06', 'Pending Investigation'], ['07', 'Suspended'], ['08', 'Overdue Rules'], ['09', 'Overdue Medical'], ['10', 'Mileage Penalty']]],
    ['I', 'Investigation'], ['J', 'Jury Duty'],
    ['K', 'Absence Without Leave', [['11', 'Without Authority'], ['12', 'No Return Sickness'], ['13', 'No Return Vacation']]],
    ['L', 'Leave of Absence', [['15', 'Authorized'], ['16', 'Disability'], ['17', 'Education'], ['18', 'Maternity'], ['19', 'Family Leave'], ['20', 'Preventive Care'], ['21', 'Elected Position'], ['22', 'Union Position'], ['23', 'Promotion'], ['00', 'Miscellaneous']]],
    ['M', 'Off For Miles / Days In', [['24', 'Personal Miles (see notes)'], ['25', 'Days In'], ['26', 'Rest Days']]],
    ['N', 'Company Business', [['27', 'Conductor Exams'], ['28', 'Labour Management'], ['29', 'Company Rep.'], ['30', 'FRA Recertification'], ['31', 'On Course'], ['32', 'Rules'], ['33', 'Medical'], ['34', 'Health & Safety'], ['41', 'Yardmaster'], ['00', 'Miscellaneous']]],
    ['O', 'Personal Business'], ['P', 'Personal Leave Day'],
    ['Q', 'Hold For Vacancy', [['40', 'Foreman'], ['41', 'Yardmaster'], ['42', 'Engine Service Employee'], ['43', 'Conductor']]],
    ['R', 'Termination', [['35', 'Retired Early'], ['36', 'Retired Normal'], ['37', 'Retired Deferred'], ['38', 'Retired Disability'], ['39', 'Dismissed'], ['44', 'Deceased'], ['46', 'Resigned'], ['47', 'Resigned Not To Be Rehired']]],
    ['S', 'Sick', [['50', 'Sick'], ['51', 'Unfit'], ['52', 'Trauma'], ['53', 'National Life']]],
    ['T', 'Training', [['41', 'Yardmaster'], ['60', 'Locomotive Engineer'], ['61', 'Conductor/Foreman'], ['63', 'Brakeman/Helper'], ['64', 'LCS Belt Pack'], ['00', 'Miscellaneous']]],
    ['U', 'Union Business'], ['V', 'Vacation'],
    ['W', 'Laid Off/Furlough', [['96', 'Voluntary'], ['67', 'Company Imposed'], ['98', 'Cut-Off'], ['99', 'Laid-Off']]],
    ['X', 'Missed Calls'],
    ['Y', 'Transfer', [['80', 'Excepted Position'], ['81', 'VIA'], ['82', 'Another Union'], ['83', 'Another Terminal']]],
    ['Z', 'Strike'],
  ];
  const JOBS = [
    ['01', 'Through Freight Conductor Only or Full Crew'], ['02', 'Through Freight Full Crew Only'],
    ['03', 'Deadhead (Non Essential Assistant Conductor)'], ['04', 'Deadhead (Essential Assistant Conductor)'],
    ['05', 'MW - Maintenance of Way (Passenger Miles)'], ['06', 'MW - Maintenance of Way (Freight Miles)'],
    ['07', 'Through Freight Extended Run'], ['10', 'Wayfreight'], ['20', 'Roadswitcher'],
    ['25', 'Passenger (Road) and Deadhead Passenger Rate'], ['26', 'Passenger Commuters - Mtl.'], ['27', 'Passenger Go Trains'],
    ['28', 'Passenger Via'], ['29', 'ONR Train'], ['30', 'Snow Plow (Road)'], ['35', 'Work Train (Road)'],
    ['36', 'Conductor. Pilot (Crane Road)'], ['40', 'Auxiliary (Road)'], ['45', 'Operating Employees NQ'],
    ['46', 'Operating Employees NQ (Overtime)'], ['47', 'Operating Employees NQ (Deadhead)'], ['50', 'Yard Assignment'],
    ['51', 'Toronto Only'], ['52', 'Yard Hump Foreman'], ['53', 'Brakeman / Switch Tender'], ['54', 'Belt Pack Eastern Canada'],
    ['55', 'Transfers'], ['57', 'Utility Service'], ['60', 'Traffic Coordinator 1st Class'], ['61', 'Traffic Coordinator 2nd Class'],
    ['62', 'Traffic Coordinator 3rd Class'], ['65', 'Hostler'], ['70', 'Senior Switchtenders'], ['71', 'Junior Switchtenders'],
    ['80', 'Passenger (Yard)'], ['85', 'Work Train (Yard)'], ['90', 'Snow Removal (Yard)'], ['95', 'Auxiliary (Yard)'],
    ['99', 'Unassigned Employees'],
  ];
  // [track, length, note]. C yard has no CO45 on the sheet.
  const C = [2178, 2398, 2492, 2398, 2425, 2235, 2210, 2133, 2075, 1818, 2348, 2343, 2343, 2352, 2348, 2361, 2298, 2300, 2185, 2185, 2174, 2331, 2362, 2271, 2355, 2217,
    2266, 2131, 2140, 2046, 2049, 2055, 1985, 1992, 1901, 1878, 1770, 1762, 1673, 1672, 2056, 1945, 1937, 2027, null,
    1313, 2277, 7000, 7000, 7000, 7000, 2547, 2544, 2161, 1696, 1778, 1782, 1503, 1861, 1963, 2241, 2083, 2063, 2173, 2170, 2260, 2139, 2071, 2030, 2124, 2187, 2348, 2346, 2073, 2073, 1575, 1373, 900]
    .map((len, i) => [`CO${String(i + 1).padStart(2, '0')}`, len]).filter((x) => x[1] != null);
  const YARDS = [
    { name: 'Mac Yard: R yard', tracks: [['R001', 4645], ['R002', 5620], ['R004', 5590], ['R005', 5690], ['R007', 5525], ['R008', 5620], ['R010', 5950], ['R011', 6120], ['R013', 6220], ['R014', 6190], ['R016', 3780], ['R017', 3575], ['R019', 3400], ['R020', 3400], ['R022', 6250], ['R023', 6150], ['R025', 5950], ['R027', 5745], ['R028', 5490], ['R030', 5750, 'Blue Route']] },
    { name: 'Mac Yard: E yard', tracks: [['E001', 5950], ['E002', 5750], ['E003', 5650], ['E004', 5250], ['E005', 5250], ['E006', 4800], ['E007', 4650], ['E008', 4650], ['E009', 4450]] },
    { name: 'Mac Yard: L yard', tracks: [['L001', 6800], ['L002', 2200], ['L009', 2489], ['L010', 3800]] },
    { name: 'Mac Yard: W yard', tracks: [['W001', 5350], ['W002', 5700], ['W003', 5750], ['W004', 5550], ['W005', 5600], ['W006', 5200], ['W007', 4900], ['W008', 4800], ['W009', 4700]] },
    { name: 'B.I.T. Yard', tracks: [['Y197', 10800, '8300 clear of crossover'], ['Y198', 10200, '7650 clear of crossover'], ['Y199', 6600, '6250 clear of crossover'], ['Y200', 6800, '5800 clear of crossover'], ['Y201', 6200, '5500 clear of crossover'], ['Y202', 5100, '5200 clear of crossover'], ['Y203', 5700, '4800 clear of crossover'], ['Y204', 3650], ['Y210', 4000], ['Y211', 3850], ['Y212', 3800], ['Y213', 3600], ['Y214', 3600], ['Y215', 1100], ['Y216', 600],
      // The newer sheet calls Y217 and Y240–Y250 PAD 010–120 (same lengths).
      ['PAD 010', 3200, 'was Y217'], ['PAD 020', 3400, 'was Y240'], ['PAD 030', 3400, 'was Y241'], ['PAD 040', 2900, 'was Y242'], ['PAD 050', 3500, 'was Y243'], ['PAD 060', 3450, 'was Y244'], ['PAD 070', 3650, 'was Y245'], ['PAD 080', 1850, 'was Y246'],
      ['PAD 090', 1850, 'crossing 1850 · was Y247'], ['PAD 100', 1600, 'crossing 2400 · was Y248'], ['PAD 110', 1600, 'crossing 1000 · was Y249'], ['PAD 120', 1600, 'crossing 800 · was Y250']] },
    { name: 'Malport', tracks: [['C300', 5500], ['C301', 3000], ['C302', 3000], ['C305', 3500]] },
    // After Malport (owner, 2026-11-03).
    { name: 'Mac Yard: C yard', tracks: C },
  ];

  // Yard jobs: when each goes on duty, its crew's days off and who covers them, the relief
  // jobs' weeks, the tower's two-week turn about and the extras (owner, 2026-11-13: "I want
  // to add the yard jobs and their schedule and rotations. Can you pull all this info").
  // Not off a posted sheet: worked out from the board checks of 24 Oct to 12 Nov 2026 (each
  // job's on-duty times on the Call Board, and who held and who worked it), so a bulletin
  // or a change of card changes it. Days are the day a job goes on duty (a 2359 start is the
  // night into the next day). 8 h, 12 h in the tower: the lengths the site assumes.
  // [job, on duty, hours, { off: the crew's days off no relief job covers, note }]. The jobs'
  // table has no "covered by" column (owner, 2026-11-13: "get rid of the covered by column for
  // the non relief jobs"): the relief jobs' own table says which jobs they work.
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const YARD_JOBS = [
    ['YEBS03', '0600', 8],
    ['YSTY01', '0630', 8, { off: ['Sat', 'Sun'] }],
    ['YPRS02', '0645', 8],
    ['YBHS01', '0800', 8],
    ['YFLS01', '0800', 8, { off: ['Sun'] }],
    ['YSBY06', '1430', 12, { off: ['Sat', 'Sun'] }],
    ['YPRS30', '1445', 8],
    ['YMPS31', '1500', 8],
    ['YINS30', '1530', 8, { off: ['Sat', 'Sun'] }], // no "Runs Mon–Fri only" line under it (owner, 2026-11-14: "remove the test")
    ['YBHS31', '1600', 8],
    ['YEBS30', '1600', 8],
    ['YPRS60', '2245', 8],
    ['YBHS60', '2300', 8],
    ['YINS60', '2330', 8],
    ['YFLS60', '2359', 8],
    ['YMPS60', '2359', 8],
  ];
  // A relief crew's own name for the job it covers: Thu and Fri YEBS03 runs as YEBS04 at
  // 0700; Sat YBHS60 runs as YBHS61.
  const RUNS_AS = { YEBS04: { job: 'YEBS03', start: '0700' }, YBHS61: { job: 'YBHS60', start: '2300' } };
  // [relief job, its days off, the job it works each other day]. XSAS01 "TH/FR OFF" and
  // XSAS03 "MO/TU OFF" are CATS's own headings on the crews in town; the rest are read off
  // the checks the same way (each works five days and is off two).
  const RELIEF = [
    ['XSAS01', ['Thu', 'Fri'], { Mon: 'YPRS02', Tue: 'YPRS02', Wed: 'YPRS30', Sat: 'YBHS01', Sun: 'YBHS01' }],
    ['XSAS02', ['Tue', 'Wed'], { Mon: 'YFLS60', Thu: 'YPRS30', Fri: 'YPRS60', Sat: 'YPRS60', Sun: 'YFLS60' }],
    ['XSAS03', ['Mon', 'Tue'], { Wed: 'YBHS31', Thu: 'YBHS31', Fri: 'YBHS60', Sat: 'YINS60', Sun: 'YINS60' }],
    ['XSAS04', ['Thu', 'Fri'], { Mon: 'YEBS30', Tue: 'YMPS31', Wed: 'YMPS31', Sat: 'YFLS01', Sun: 'YEBS30' }],
    ['XSAS05', ['Tue', 'Wed'], { Mon: 'YMPS60', Thu: 'YEBS04', Fri: 'YEBS04', Sat: 'YBHS61', Sun: 'YMPS60' }],
  ];
  // The tower (YSBY, 12 h): YSBY01 (0700) and YSBY02 (1900) work the same days, YSBY03 and
  // YSBY04 the others, 2-2-3 over two weeks. Week A started Monday 26 Oct 2026 (and 9 Nov).
  const TOWER = { anchor: '2026-10-26', a: ['YSBY01', 'YSBY02'], b: ['YSBY03', 'YSBY04'], weekA: 'AABBAAA' };
  // The yardmaster jobs (craft YA; owner, 2026-11-13: "in the job aid test section add the YM Schedule like
  // the other yard jobs"), with their own table: [job, on duty, hours, the days it runs ('week': Mon to Fri; 'a'
  // or 'b': its side of the tower), what it is]. The same schedule the call order works from (public/board-ym.js
  // YA_JOBS); YSTY01 and YSBY06 moved here from the yard jobs' table.
  const YM_JOBS = [
    ['YSTY01', '0630', 8, 'week', 'Tower S/S'],
    ['YSBY01', '0700', 12, 'a', 'YDM Block 1'],
    ['YSBY02', '1900', 12, 'a', 'YDM Block 2'],
    ['YSBY03', '0700', 12, 'b', 'YDM Block 3'],
    ['YSBY04', '1900', 12, 'b', 'YDM Block 4'],
    ['YSBY06', '1430', 12, 'week', 'S/S Temp YA'],
  ];
  const EXTRAS = [['YFXS01', '1600', '7 times, mostly Thu and Fri'], ['YFXS03', '0900', 'once'], ['YHXS01', '0700', 'once'],
    ['YMXS01', '2359 or 0800', 'twice'], ['YMXS02', '1700', 'once'], ['YSBY05', '0700, 12 h', 'once']];

  const startOf = (job) => (RUNS_AS[job] ? RUNS_AS[job].start : (YARD_JOBS.find((j) => j[0] === job) || [])[1]);
  // Each job's crew: the days a relief covers (by its own name) and the days nothing does.
  function yardCover(job) {
    const by = [];
    for (const [rel, , week] of RELIEF) {
      for (const d of DAYS) {
        const w = week[d];
        if (w && (w === job || (RUNS_AS[w] && RUNS_AS[w].job === job))) by.push({ day: d, relief: rel, as: w === job ? null : w });
      }
    }
    const j = YARD_JOBS.find((x) => x[0] === job);
    const extra = (j && j[3]) || {};
    const set = DAYS.filter((d) => by.some((b) => b.day === d) || (extra.off || []).includes(d));
    // In week order from the first of a run, so Sunday and Monday read "Sun, Mon".
    const first = set.findIndex((d) => !set.includes(DAYS[(DAYS.indexOf(d) + 6) % 7]));
    const off = first > 0 ? [...set.slice(first), ...set.slice(0, first)] : set;
    return { off, by, none: (extra.off || []).length ? { days: extra.off } : null, note: extra.note || '' };
  }
  // 'a' (YSBY01 / YSBY02) or 'b' (YSBY03 / YSBY04) on a date ('YYYY-MM-DD').
  function towerOn(day) {
    const ms = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) - Date.UTC(+TOWER.anchor.slice(0, 4), +TOWER.anchor.slice(5, 7) - 1, +TOWER.anchor.slice(8, 10));
    const n = Math.round(ms / 864e5);
    const i = ((n % 14) + 14) % 14;
    const inA = TOWER.weekA[i % 7] === 'A';
    return (i < 7) === inA ? 'a' : 'b';
  }
  // A relief job's week from the day after its days off: "Thu YPRS30 1445 · Fri–Sat YPRS60 2245 …".
  function reliefWeek(off, week) {
    const last = Math.max(...off.map((d) => DAYS.indexOf(d)));
    const order = [...DAYS.slice(last + 1), ...DAYS.slice(0, last + 1)].filter((d) => week[d]);
    const runs = [];
    for (const d of order) {
      const r = runs[runs.length - 1];
      if (r && r.job === week[d]) r.days.push(d); else runs.push({ job: week[d], days: [d] });
    }
    return runs;
  }
  function yardSection(q, hit, today) {
    const dash = (ds) => (ds.length > 2 ? `${ds[0]}–${ds[ds.length - 1]}` : ds.join(', '));
    const jobs = YARD_JOBS.filter(([job, start]) => !YM_JOBS.some((y) => y[0] === job) && hit(job, start, ...yardCover(job).off)).map(([job, start, hours]) => {
      const c = yardCover(job);
      return `<tr><td class="num"><b>${esc(job)}</b>${hours !== 8 ? ` <span class="chip">${hours} h</span>` : ''}${c.note ? `<div class="crew">${esc(c.note)}</div>` : ''}</td><td class="num">${esc(start)}</td><td>${esc(c.off.join(', '))}</td></tr>`;
    }).join('');
    const relief = RELIEF.filter(([rel, off, week]) => hit(rel, ...off, ...Object.values(week), ...Object.values(week).map((w) => (RUNS_AS[w] ? RUNS_AS[w].job : '')))).map(([rel, off, week]) =>
      `<tr><td class="num"><b>${esc(rel)}</b></td><td>${esc(off.join(', '))}</td><td>${reliefWeek(off, week).map((r) => `<div class="nw">${esc(dash(r.days))} <b class="num">${esc(r.job)}</b> ${esc(startOf(r.job) || '')}</div>`).join('')}</td></tr>`).join('');
    const monday = (() => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; })();
    const iso = (d) => d.toISOString().slice(0, 10);
    const label = (d) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const towerWeeks = [0, 7].map((add) => {
      const start = new Date(monday); start.setUTCDate(start.getUTCDate() + add);
      const days = DAYS.map((d, i) => { const x = new Date(start); x.setUTCDate(x.getUTCDate() + i); return { d, side: towerOn(iso(x)) }; });
      const runs = [];
      for (const x of days) { const r = runs[runs.length - 1]; if (r && r.side === x.side) r.days.push(x.d); else runs.push({ side: x.side, days: [x.d] }); }
      return `<tr><td class="nw">${add ? 'Next week' : 'This week'}<div class="crew">from ${esc(label(start))}</div></td><td>${runs.map((r) => `<div class="nw">${esc(dash(r.days))}: <b class="num">${esc(TOWER[r.side].join(' / '))}</b></div>`).join('')}</td></tr>`;
    }).join('');
    const towerHit = hit('tower', 'YSBY', 'yardmaster', ...TOWER.a, ...TOWER.b);
    const extras = EXTRAS.filter(([job, start]) => hit(job, start, 'extra')).map(([job, start, seen]) => `<tr><td class="num"><b>${esc(job)}</b></td><td class="num">${esc(start)}</td><td class="muted">${esc(seen)}</td></tr>`).join('');
    // A tower job's days off, this week or next: the days the other side works ("Mon, Tue, Fri–Sun").
    const towerOff = (side, add) => {
      const off = DAYS.filter((d, i) => { const x = new Date(monday); x.setUTCDate(x.getUTCDate() + add + i); return towerOn(iso(x)) !== side; });
      const runs = [];
      for (const d of off) { const r = runs[runs.length - 1]; if (r && DAYS.indexOf(d) === DAYS.indexOf(r[r.length - 1]) + 1) r.push(d); else runs.push([d]); }
      return runs.map(dash).join(', ');
    };
    const ym = YM_JOBS.filter(([job, start, , days, what]) => hit(job, start, what, 'yardmaster', 'YM', days === 'week' ? 'Sat' : 'tower')).map(([job, start, hours, days, what]) => {
      const off = days === 'week' ? 'Sat, Sun' : [0, 7].map((add) => `<div class="nw">${add ? 'Next' : 'This'} week: ${esc(towerOff(days, add))}</div>`).join('');
      return `<tr><td class="num"><b>${esc(job)}</b>${hours !== 8 ? ` <span class="chip">${hours} h</span>` : ''}<div class="crew">${esc(what)}</div></td><td class="num">${esc(start)}</td><td>${off}</td></tr>`;
    }).join('');
    const ymHit = ym || towerHit || hit('next yard job', 'spare', 'YM SB', 'spareboard');
    if (q && !jobs && !relief && !towerHit && !extras && !ymHit) return '';
    return `${jobs ? `<h4>Each job</h4><table class="reft"><thead><tr><th>Job</th><th>On duty</th><th>Crew off</th></tr></thead><tbody>${jobs}</tbody></table>` : ''}
      ${relief ? `<h4>Relief jobs: their week</h4><table class="reft"><thead><tr><th>Relief</th><th>Off</th><th>Works</th></tr></thead><tbody>${relief}</tbody></table>` : ''}
      ${extras ? `<h4>Extra jobs</h4><p class="muted" style="margin:0 0 6px">Called now and then and filled from the spareboard. Seen in the checks:</p><table class="reft"><thead><tr><th>Job</th><th>On duty</th><th>Seen</th></tr></thead><tbody>${extras}</tbody></table>` : ''}
      ${ym ? `<h4>Yardmaster jobs (YA)</h4><table class="reft"><thead><tr><th>Job</th><th>On duty</th><th>Crew off</th></tr></thead><tbody>${ym}</tbody></table>` : ''}
      ${towerHit ? `<h4>Tower (YSBY, 12 h)</h4><p class="muted" style="margin:0 0 6px">YSBY01 (0700) and YSBY02 (1900) work the same days, YSBY03 (0700) and YSBY04 (1900) the others: 2 on, 2 off, 3 on, then the other way round the next week. YSBY06 (1430) is in the table above.</p><table class="reft"><tbody>${towerWeeks}</tbody></table>` : ''}
      <p class="muted">Worked out from the board checks of 24 Oct to 12 Nov 2026 (which jobs went on duty each day, and who held and worked them), not from a posted sheet: a bulletin or a change of card changes it. Days are the day a job goes on duty (a 2359 start is the night into the next day). 8 h unless marked.</p>`;
  }

  // "Next Yard Job" and "If it was spare, who would work it" (owner, 2026-11-13: "then have a line that says 'Next
  // Yard Job' and show the job, then have a line that says 'If it was spare, who would work it' then have 2 answers,
  // one with someone on the YM SB and one without"). On Page Health since 2026-11-14 (owner: "take this out of the
  // job aid section, move it to page health"); board.html draws it there (paintYmNext):
  // Y the call order's logic (public/board-ym.js), L the site's list (data/ym-list.json, its names opened), now
  // (railway minutes) and the rules saved on the call order page on this phone (null: its starting rules).
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // link: the call order page (on the main site, the test site's: ym.html is the test site's for now).
  function ymNextHtml({ Y, L, now, rules = null, link = 'ym.html' }) {
    const head = '<h4>Next Yard Job</h4>';
    if (!L || L.error) return `${head}<p class="muted">${L && L.error === 'none' ? 'The yardmaster seniority list isn’t on the site yet, so who would work it can’t be worked out.' : 'The yardmaster seniority list didn’t load. Try again in a minute.'}</p>`;
    const r = Y.normalize(rules || Y.startingRules());
    const j = Y.upcoming(now, r.leadMin)[0];
    if (!j) return `${head}<p class="muted">No yardmaster job in the next week.</p>`;
    const people = Y.peopleFrom(L, L.byRank);
    const name = (p) => (p.first ? `${p.surname}, ${p.first}` : p.surname); // "Rank N" without the names
    const holder = people.find((p) => { const c = Y.parseCode(p.perm); return c && c.craft === 'YA' && c.turn === j.job; });
    const a = Y.ifSpare(j, people, r);
    const who = (x) => (x ? `<b>${esc(name(x.p))}</b>${x.p.first ? ` <span class="muted">rank ${esc(x.rank)}</span>` : ''}<div class="crew">Step ${x.step}: ${esc(x.label)}</div>` : '<span class="muted">Nobody on the list</span>');
    const live = L.live && L.live.taken ? L.live.taken : '';
    const day = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
    // The yardmaster spareboard as the newest check read it (owner, 2026-11-14: 2 → 16), no names in the file: each
    // turn named by whose job it is on the list. Read: the answer that applies now is marked.
    const sb = L.live && Array.isArray(L.live.spareboard) ? L.live.spareboard : null;
    const onSb = sb ? sb.filter((t) => !t.left) : [];
    const whose = (turn) => { const p = people.find((x) => { const c = Y.parseCode(x.perm); return c && c.turn === turn; }); return p ? ` ${esc(name(p))}` : ''; };
    const sbLine = !sb ? '' : `<p class="ymjob">Yardmaster spareboard at the check of ${esc(live.slice(11))}: ${onSb.length ? onSb.map((t) => `<b class="num">${esc(t.turn)}</b>${whose(t.turn)} · ${esc(t.status)}`).join('; ') : 'nobody on it'}${sb.filter((t) => t.left).map((t) => `; <b class="num">${esc(t.turn)}</b>${whose(t.turn)} left it after ${esc(t.viewTime || 'the view time')}`).join('')}.</p>`;
    const nowTag = (someone) => (sb && (onSb.length > 0) === someone ? ' <span class="chip">now</span>' : '');
    const read = L.read ? new Date(L.read).toLocaleString('en-GB', { timeZone: 'America/Toronto', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    return `${head}<p class="ymjob"><b class="num">${esc(j.job)}</b> ${esc(Y.YA_JOBS[j.job].label)} · <b>${esc(Y.fmt(j.s))}</b>, ${j.hours} h · call ${esc(Y.fmt(j.s - r.leadMin))}${holder ? ` · its holder ${esc(name(holder))}` : ''}</p>
      <h4>If it was spare, who would work it</h4>${sbLine}
      <table class="reft"><thead><tr><th>YM spareboard</th><th>Who would work it</th></tr></thead><tbody>
        <tr><td>Someone on it${nowTag(true)}</td><td>${who(a.yes)}</td></tr>
        <tr><td>Nobody on it${nowTag(false)}</td><td>${who(a.no)}</td></tr></tbody></table>
      <p class="muted" style="margin:0 0 12px">${live ? `Everyone as the board check of ${esc(live.slice(11))} on ${esc(day(live))} showed them (on rest, on duty, away, days off)` : 'Everyone by their status on the seniority list only (no board check with them yet)'}, the seniority list as read ${esc(read)}, by ${rules ? 'the rules saved on the call order page on this phone' : 'the call order page’s starting rules'}. The whole order and why: <a href="${esc(link)}">the call order test →</a></p>`;
  }
  const paintYmNext = (box, o) => { if (box) box.innerHTML = ymNextHtml(o); };

  // The road pools whose days out of Sarnia go on a calendar (owner, 2026-11-13: "S1, s3, A
  // pool, B pool and 502/501 turns"; then "I dont want a calendar of what jobs were worked for
  // pools in job aids, I want there to be a way to add the days out for each pool to your
  // calendar": the record of trips worked that was here first is gone).
  const OUT_POOLS = [['S1', '1st Manifest (S1)', /^S1\d\d$/], ['S3', '3rd Manifest (S3)', /^S3\d\d$/], ['SA', 'A pool (SA)', /^SA\d\d$/],
    ['SB', 'B pool (SB)', /^SB\d\d$/], ['S5', '501/502', /^S50[12]$/]];
  // A train's turns as the Call Board gives them: engineer and conductor (a trainee, ET /
  // TT, is not a turn of its own). Where the Call Board had no conductor (or engineer), the
  // one the Toronto bunkhouse paired with it (awayCo / awayEn); never in place of one the
  // Call Board named (that pairing is a guess: RM39491 10, 11 Nov, named SA05, who had gone
  // out ten minutes before on M30241 09).
  const crewTurns = (r) => {
    const crew = String(r.crew || '');
    const own = [...crew.matchAll(/\b(?:EN|CO|LE)\s+([A-Z][A-Z0-9]\d{2})\b/g)].map((m) => m[1]);
    const fill = [!/\bCO\s/.test(crew) && r.awayCo, !/\b(?:EN|LE)\s/.test(crew) && r.awayEn].filter(Boolean);
    return [...new Set([...own, ...fill])].filter((t) => !/9[89]$/.test(t));
  };
  const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  // Due out of Sarnia: the pools' rotation, for any day, and as a calendar file (owner,
  // 2026-11-13, with a photo of his own Google Calendar of the S1 and A pool turns by day:
  // "I want you to be able to export something like this so you can see what pool jobs are
  // due out of Sarnia on a particular day"). Each pool sends the same number of turns out a
  // day, in turn-number order, round and round: S1 3 of 10, A pool 3 of 9, S3 2 of 6, B pool
  // 2 of 6, 501/502 1 of 2 (every trip of 16 Oct to 13 Nov fitted it: 284 of 284). Worked out
  // again from the trains file each time (the last 21 days: the turns seen twice or more, the
  // trips a day, where the order stands), so it follows a pool that changes.
  const EPOCH = '2026-01-05';
  const dayNo = (day) => Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${EPOCH}T12:00:00Z`)) / 864e5);
  function fitRotation(trains, re) {
    const seenDay = new Set();
    const deps = [];
    for (const r of trains || []) {
      if (r.from !== 'sarnia' || !r.onDuty) continue;
      for (const t of crewTurns(r)) {
        const k = `${t}|${r.onDuty.slice(0, 10)}`;
        if (re.test(t) && !seenDay.has(k)) { seenDay.add(k); deps.push({ turn: t, day: r.onDuty.slice(0, 10) }); }
      }
    }
    if (!deps.length) return null;
    const last = deps.map((d) => d.day).sort().pop();
    const since = addDays(last, -20);
    const win = deps.filter((d) => d.day >= since);
    const count = {};
    for (const d of win) count[d.turn] = (count[d.turn] || 0) + 1;
    // A turn seen once (an old turn, a stray) is not one of the pool's, nor are its trips.
    const turns = Object.keys(count).filter((t) => count[t] >= 2).sort();
    const mine = win.filter((d) => turns.includes(d.turn));
    const per = Math.max(1, Math.round(mine.length / new Set(mine.map((d) => d.day)).size));
    if (turns.length < 2 || per >= turns.length) return null;
    const n = turns.length;
    const on = (off, day) => Array.from({ length: per }, (_, i) => turns[(((per * dayNo(day) + off + i) % n) + n) % n]);
    let best = null;
    for (let off = 0; off < n; off++) {
      const hit = mine.filter((d) => on(off, d.day).includes(d.turn)).length;
      if (!best || hit > best.hit) best = { off, hit };
    }
    return { turns, per, hit: best.hit, total: mine.length, since, last, due: (day) => on(best.off, day) };
  }
  const fitsOf = (state) => state.fits || (state.fits = Object.fromEntries(OUT_POOLS.map(([k, , re]) => [k, fitRotation(state.trains, re)])));
  const dayLabel = (day, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-CA', { ...opts, timeZone: 'UTC' });
  // The calendar file: an all-day event a turn, named by the turn (as on his own calendar).
  function icsFor(fits, { from, days, pools = OUT_POOLS.map((p) => p[0]), turn = null, name = 'Days out of Sarnia', now = new Date() }) {
    const ymd = (d) => d.replace(/-/g, '');
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const text = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
    const fold = (line) => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ` ${s.slice(74)}`; } out.push(s); return out.join('\r\n'); };
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sarnia Board//Days out of Sarnia//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${text(name)}`];
    for (let i = 0; i < days; i++) {
      const day = addDays(from, i);
      for (const [key, label] of OUT_POOLS) {
        const f = fits[key];
        if (!f || !pools.includes(key)) continue;
        for (const t of f.due(day)) {
          if (turn && t !== turn) continue;
          lines.push('BEGIN:VEVENT', `UID:${t}-${ymd(day)}@sarnia-board`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(day)}`, `DTEND;VALUE=DATE:${ymd(addDays(day, 1))}`,
            `SUMMARY:${text(t)}`, `CATEGORIES:${text(label)}`,
            `DESCRIPTION:${text(`Due out of Sarnia: ${label}, ${f.per} a day in turn order. From the board's rotation, not CATS: a cancelled train or a turn added or taken off moves it.`)}`,
            'TRANSP:TRANSPARENT', 'END:VEVENT');
        }
      }
    }
    lines.push('END:VCALENDAR');
    return `${lines.map(fold).join('\r\n')}\r\n`;
  }
  function dueBox(state) {
    const trains = state.trains;
    if (trains === undefined) return '<p class="muted">Loading the trains…</p>';
    if (!trains || !trains.length) return '<p class="muted">The trains aren’t available right now.</p>';
    const today = state.today || new Date().toLocaleDateString('en-CA');
    const fits = fitsOf(state);
    const from = state.dueDay || today;
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(from, i);
      rows.push(`<tr${day === today ? ' class="hit"' : ''}><td class="nw"><b>${esc(dayLabel(day))}</b></td><td>${OUT_POOLS.map(([k]) => (fits[k] ? `<span class="duegrp p${k}">${fits[k].due(day).map((t) => `<b class="num">${esc(t)}</b>`).join(' ')}</span>` : '')).join('')}</td></tr>`);
    }
    const fitLine = OUT_POOLS.map(([k, label]) => {
      const f = fits[k];
      return f ? `<div><span class="duegrp p${k}">${esc(label)}</span> ${f.per} a day of ${f.turns.length} (${esc(f.turns[0])}–${esc(f.turns[f.turns.length - 1])}) · matched <b>${f.hit} of ${f.total}</b> trips since ${esc(dayLabel(f.since, { month: 'short', day: 'numeric' }))}${f.hit < f.total * 0.9 ? ' <b>⚠ not holding</b>' : ''}</div>` : `<div>${esc(label)}: not enough trips to tell.</div>`;
    }).join('');
    const allTurns = OUT_POOLS.flatMap(([k]) => (fits[k] ? fits[k].turns : []));
    const months = state.icsMonths || 3;
    return `<p class="muted" style="margin:0 0 8px">Tap a pool to download its days out as a calendar file: an all-day event for each turn on each day it’s due out of Sarnia, named by the turn.</p>
      <div class="refpick duedl" role="group" aria-label="Download a pool's days out">${OUT_POOLS.map(([k, label]) => (fits[k] ? `<button type="button" class="p${k}" data-icspool="${k}">${esc(label)}</button>` : '')).join('')}<button type="button" data-icspool="all">All pools</button></div>
      <div class="refcalc"><label>One turn only <select id="icsturn"><option value="">Choose a turn</option>${allTurns.map((t) => `<option${t === state.icsTurn ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      ${state.icsTurn && allTurns.includes(state.icsTurn) ? `<span class="refpick duedl"><button type="button" data-icsturn="${esc(state.icsTurn)}">Download ${esc(state.icsTurn)}’s days out</button></span>` : ''}
      <label>Starting <input id="dueday" type="date" value="${esc(from)}"></label>
      <label>For <select id="icsmonths">${[1, 3, 6, 12].map((m) => `<option value="${m}"${m === months ? ' selected' : ''}>${m} month${m === 1 ? '' : 's'}</option>`).join('')}</select></label></div>
      <p class="muted">Google Calendar: on a computer, Settings → Import &amp; export → Import, and pick the calendar to put it in (a calendar for each pool gives each pool its own colour). iPhone: open the downloaded file, then Add All. A newer file goes into a fresh calendar (or delete the old one first), so no day shows twice.</p>
      <h4>Due out, the week from ${esc(dayLabel(from, { month: 'short', day: 'numeric' }))}</h4>
      <table class="reft duet"><tbody>${rows.join('')}</tbody></table>
      <h4>The rotation</h4><div class="duefit">${fitLine}</div>
      <p class="muted">The days come from the pools’ rotation as the board has seen it, not from CATS. A cancelled train, an extra one, or a turn added or taken off moves the order: check here, and download it again after a change.</p>`;
  }
  function wireDue(view, state) {
    const box = view.querySelector('#duebox');
    if (!box) return;
    box.innerHTML = dueBox(state);
    const again = () => wireDue(view, state);
    const day = box.querySelector('#dueday');
    if (day) day.onchange = () => { if (/^\d{4}-\d{2}-\d{2}$/.test(day.value)) { state.dueDay = day.value; again(); } };
    const turn = box.querySelector('#icsturn');
    if (turn) turn.onchange = () => { state.icsTurn = turn.value || null; again(); };
    const months = box.querySelector('#icsmonths');
    if (months) months.onchange = () => { state.icsMonths = +months.value; };
    const download = (pools, one, label, slug) => {
      const from = state.dueDay || state.today || new Date().toLocaleDateString('en-CA');
      const to = new Date(`${from}T12:00:00Z`); to.setUTCMonth(to.getUTCMonth() + (state.icsMonths || 3));
      const days = Math.round((to - Date.parse(`${from}T12:00:00Z`)) / 864e5);
      const body = icsFor(fitsOf(state), { from, days, pools, turn: one, name: `Days out: ${label}` });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
      a.download = `days-out-${slug}-from-${from}.ics`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    box.querySelectorAll('[data-icspool]').forEach((b) => {
      const k = b.dataset.icspool;
      const pool = OUT_POOLS.find((x) => x[0] === k);
      b.onclick = () => (pool ? download([k], null, pool[1], k) : download(OUT_POOLS.map((x) => x[0]), null, 'all pools', 'all-pools'));
    });
    box.querySelectorAll('[data-icsturn]').forEach((b) => { b.onclick = () => download(OUT_POOLS.map((x) => x[0]), b.dataset.icsturn, b.dataset.icsturn, b.dataset.icsturn); });
  }

  // Held-away penalty miles for the total time off duty, in minutes (the
  // posted "Held-Away Penalty" sheet): nothing to 10:00; 12.5 miles an hour
  // (by the minute) to 12:00; 12:01–13:00 and 13:01–14:00 start 12.5 higher;
  // 18.75 an hour from 14:00 to 16:00 (112.50); then 100 more for each
  // started hour, to 712.50 for 21:01–22:00. Past 22:00: not on the sheet.
  function penalty(mins) {
    const m = Math.round(mins);
    if (!(m > 600)) return 0;
    const at = (x) => Math.round(x * 100 + 1e-6) / 100;
    if (m <= 720) return at((m - 600) * 12.5 / 60);
    if (m <= 780) return at(37.5 + (m - 721) * 12.5 / 60 + 12.5 / 60);
    if (m <= 840) return at(62.5 + (m - 781) * 12.5 / 60 + 12.5 / 60);
    if (m <= 960) return at(75 + (m - 840) * 18.75 / 60);
    if (m <= 1320) return 112.5 + 100 * Math.ceil((m - 960) / 60);
    return null;
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const parseHM = (s) => { const x = /^\s*(\d{1,2})\s*[:h. ]?\s*(\d{2})\s*$/.exec(s || ''); return x && +x[2] < 60 ? +x[1] * 60 + +x[2] : null; };

  function render(view, state = {}) {
    const q = (state.q || '').trim().toUpperCase();
    const hit = (...xs) => !q || xs.some((x) => String(x).toUpperCase().includes(q));
    const status = STATUS.map(([c, d, ecc]) => {
      const sub = (ecc || []).filter(([n, t]) => hit(c, d, n, t) );
      if (!hit(c, d) && !sub.length) return '';
      return `<tr><td class="num"><b>${esc(c)}</b></td><td>${esc(d)}${(hit(c, d) ? ecc || [] : sub).map(([n, t]) => `<div class="crew"><span class="num">${esc(n)}</span> ${esc(t)}</div>`).join('')}</td></tr>`;
    }).join('');
    const jobs = JOBS.filter(([n, d]) => hit(n, d)).map(([n, d]) => `<tr><td class="num"><b>${esc(n)}</b></td><td>${esc(d)}</td></tr>`).join('');
    const yards = YARDS.map((y) => {
      const rows = y.tracks.filter(([t, , note]) => hit(y.name, t, t.replace(/^CO/, 'C0'), note || ''));
      if (!rows.length) return '';
      return `<h4>${esc(y.name)}</h4><table class="reft"><thead><tr><th>Track</th><th>Length</th><th></th></tr></thead><tbody>${rows.map(([t, len, note]) =>
        `<tr><td class="num"><b>${esc(t)}</b></td><td class="num">${len}</td><td class="muted">${esc(note || '')}</td></tr>`).join('')}</tbody></table>`;
    }).join('');
    // A turn typed in the search is the one turn to download.
    const outTurnQ = q && OUT_POOLS.some((p) => p[2].test(q)) ? q : null;
    if (outTurnQ) state.icsTurn = outTurnQ;
    const sec = (id, title, body, open) => `<details class="refsec" id="ref-${id}"${open || q ? ' open' : ''}><summary>${title}</summary>${body || '<p class="empty" style="padding:0">Nothing matches.</p>'}</details>`;
    const penaltyRows = [];
    for (let m = 600; m <= 960; m += 1) penaltyRows.push(`<tr><td class="num">${hm(m)}</td><td class="num">${penalty(m).toFixed(2)}</td></tr>`);
    const steps = [[961, 1020], [1021, 1080], [1081, 1140], [1141, 1200], [1201, 1260], [1261, 1320]].map(([a, b]) => `<tr><td class="num">${hm(a)} – ${hm(b)}</td><td class="num">${penalty(b).toFixed(2)}</td></tr>`).join('');
    // The sections' order (owner, 2026-11-14): yard jobs, days out of Sarnia, track lengths, CATS status and ECC
    // codes, job types, then the held-away penalty last. Every section for every member, both sites, since
    // 2026-11-14 (owner: "Can you push the Job Aid tab and Page Health from the test to the main"); the yard jobs
    // and days out of Sarnia had been the test site's (state.preview, gone).
    view.innerHTML = `<div class="thead"><div class="when">Job Aids</div>
        <div class="turnpick"><label for="refq">Search (a track, a code, a word)</label><div class="row"><input id="refq" placeholder="e.g. R013, 33, vacation" autocomplete="off" spellcheck="false" value="${esc(state.q || '')}"></div></div></div>
      <section class="sheet refpage">
      ${sec('yardjobs', 'Yard jobs: start times, days off and relief', yardSection(q, hit, state.today || new Date().toLocaleDateString('en-CA')))}
      ${sec('due', 'Days out of Sarnia: add each pool to your calendar', !q || outTurnQ || hit('days out of Sarnia', 'due out', 'calendar', ...OUT_POOLS.map((p) => p[1])) ? '<div id="duebox"></div>' : '')}
      ${sec('tracks', 'Track lengths: Mac Yard, B.I.T. Yard, Malport', yards)}
      ${sec('status', 'CATS status and ECC codes', status && `<table class="reft"><thead><tr><th>Status</th><th>Meaning · ECC codes</th></tr></thead><tbody>${status}</tbody></table>`)}
      ${sec('jobs', 'Job types for Eastern Canada', jobs && `<table class="reft"><thead><tr><th>Type</th><th>Description</th></tr></thead><tbody>${jobs}</tbody></table>`)}
      ${q ? '' : sec('held', 'Held-away penalty (time off duty → penalty miles)', `<div class="refcalc">
          <label>Held for (h:mm) <input id="refheld" inputmode="numeric" placeholder="e.g. 13:25" value="${esc(state.held || '')}"></label>
          <span>or off duty <input id="refoff" type="time" value="${esc(state.off || '')}"> to on duty <input id="refon" type="time" value="${esc(state.on || '')}"></span>
          <p id="refout" class="refout"></p></div>
        <p class="muted">From the posted sheet (B-Force Timekeeping 1-888-878-1111). The times are total time off duty.</p>
        <details><summary>The whole table</summary><table class="reft"><thead><tr><th>Off duty</th><th>Miles</th></tr></thead><tbody>${penaltyRows.join('')}${steps}</tbody></table></details>`, true)}
      <p class="muted" style="padding:10px 14px">From the CATS Eastern Canada Guide for Operating Crews and the sheets posted at work. Check the posted sheet if anything here looks off.</p>
      </section>`;
    wireDue(view, state);
    const box = view.querySelector('#refq');
    box.oninput =() => { state.q = box.value; const pos = box.selectionStart; render(view, state); const b = view.querySelector('#refq'); b.focus(); try { b.setSelectionRange(pos, pos); } catch (e) { /* not a text box */ } };
    const out = view.querySelector('#refout');
    if (!out) return;
    const calc = () => {
      const held = view.querySelector('#refheld');
      const off = view.querySelector('#refoff');
      const on = view.querySelector('#refon');
      Object.assign(state, { held: held.value, off: off.value, on: on.value });
      let mins = parseHM(held.value);
      if (mins == null && off.value && on.value) {
        mins = parseHM(on.value) - parseHM(off.value);
        if (mins <= 0) mins += 24 * 60; // on duty the next day
      }
      if (mins == null) { out.innerHTML = '<span class="muted">Type how long you were held, or your off-duty and on-duty times.</span>'; return; }
      const p = penalty(mins);
      out.innerHTML = p == null ? `Held <b>${hm(mins)}</b>: past 22:00, not on the sheet.`
        : `Held <b>${hm(mins)}</b> → <b>${p.toFixed(2)}</b> penalty miles${p === 0 ? ' (nothing under 10:01)' : ''}.`;
    };
    ['#refheld', '#refoff', '#refon'].forEach((s) => { view.querySelector(s).oninput = calc; });
    calc();
  }

  const api = { STATUS, JOBS, YARDS, YARD_JOBS, YM_JOBS, ymNextHtml, paintYmNext, RELIEF, RUNS_AS, TOWER, EXTRAS, yardCover, towerOn, reliefWeek, OUT_POOLS, crewTurns, fitRotation, icsFor, dueBox, paintOut: wireDue, penalty, render };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoardRef = api;
})(typeof window !== 'undefined' ? window : globalThis);
