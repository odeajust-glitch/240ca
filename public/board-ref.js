// Job Aids tab, first called Reference (owner, 2026-11-03: "general useful
// information"; renamed 2026-11-11: "can we change reference to Job Aids"): CATS
// status and ECC codes, job types for Eastern Canada, Mac / B.I.T. / Malport
// track lengths and the held-away penalty (with a calculator). Typed in from
// the owner's photos of the CATS Eastern Canada Guide for Operating Crews and
// the sheets posted at work. On the test site only (2026-11-13): the yard jobs
// and their relief rotations (read off the checks once, kept below) and each
// road turn's days out of Sarnia (from the site's trains file, live).
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
    ['YINS30', '1530', 8, { off: ['Sat', 'Sun'], note: 'Runs Mon–Fri only' }],
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
    const jobs = YARD_JOBS.filter(([job, start]) => hit(job, start, ...yardCover(job).off)).map(([job, start, hours]) => {
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
    const towerHit = hit('tower', 'YSBY', ...TOWER.a, ...TOWER.b);
    const extras = EXTRAS.filter(([job, start]) => hit(job, start, 'extra')).map(([job, start, seen]) => `<tr><td class="num"><b>${esc(job)}</b></td><td class="num">${esc(start)}</td><td class="muted">${esc(seen)}</td></tr>`).join('');
    if (q && !jobs && !relief && !towerHit && !extras) return '';
    return `${jobs ? `<h4>Each job</h4><table class="reft"><thead><tr><th>Job</th><th>On duty</th><th>Crew off</th></tr></thead><tbody>${jobs}</tbody></table>` : ''}
      ${relief ? `<h4>Relief jobs: their week</h4><table class="reft"><thead><tr><th>Relief</th><th>Off</th><th>Works</th></tr></thead><tbody>${relief}</tbody></table>` : ''}
      ${towerHit ? `<h4>Tower (YSBY, 12 h)</h4><p class="muted" style="margin:0 0 6px">YSBY01 (0700) and YSBY02 (1900) work the same days, YSBY03 (0700) and YSBY04 (1900) the others: 2 on, 2 off, 3 on, then the other way round the next week. YSBY06 (1430) is in the table above.</p><table class="reft"><tbody>${towerWeeks}</tbody></table>` : ''}
      ${extras ? `<h4>Extra jobs</h4><p class="muted" style="margin:0 0 6px">Called now and then and filled from the spareboard. Seen in the checks:</p><table class="reft"><thead><tr><th>Job</th><th>On duty</th><th>Seen</th></tr></thead><tbody>${extras}</tbody></table>` : ''}
      <p class="muted">Worked out from the board checks of 24 Oct to 12 Nov 2026 (which jobs went on duty each day, and who held and worked them), not from a posted sheet: a bulletin or a change of card changes it. Days are the day a job goes on duty (a 2359 start is the night into the next day). 8 h unless marked.</p>`;
  }

  // Days out of Sarnia, a calendar for each turn (owner, 2026-11-13: "add a thing that will
  // add a calendar showing each turns days out of sarnia, So s1, s3, A pool, B pool and
  // 502/501 turns"). From the site's own trains file (data/trains.json, the last 30 days or
  // so): a turn is out from going on duty in Sarnia to going on duty in Toronto for the trip
  // home (the trip's `back` when it has this turn, else the first train from Toronto with it
  // before its next one out). 501/502 come home from Garnet on L501 the same day; L501 is
  // not in that file, so a 501/502 day out is the day it took L502. These pools have no set
  // days, so it is a record, not a schedule.
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
  const minsBetween = (a, b) => (Date.parse(`${b.slice(0, 10)}T${b.slice(11, 13)}:${b.slice(13, 15)}:00Z`) - Date.parse(`${a.slice(0, 10)}T${a.slice(11, 13)}:${a.slice(13, 15)}:00Z`)) / 60000;
  const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  // A turn's trips out: [{ id, out: 'YYYY-MM-DD HHMM', home: { id, at } | null, garnet, away }].
  function tripsOut(trains, turn, today) {
    const has = (r) => crewTurns(r).includes(turn);
    const by = (a, b) => (a.onDuty < b.onDuty ? -1 : 1);
    // A second trip out within 8 h of the last can't be this turn's own: the first is kept.
    const outs = (trains || []).filter((r) => r.from === 'sarnia' && r.onDuty && has(r)).sort(by)
      .filter((r, i, all) => i === 0 || minsBetween(all[i - 1].onDuty, r.onDuty) >= 8 * 60);
    const homes = (trains || []).filter((r) => r.from === 'mac' && r.onDuty && has(r)).sort(by);
    return outs.map((r, i) => {
      const next = outs[i + 1];
      const garnet = /^S50[12]$/.test(turn) || /^L502/.test(r.id);
      let home = r.back && r.back.onDuty && (!r.back.crew || crewTurns({ crew: r.back.crew }).includes(turn) || r.awayCo === turn || r.awayEn === turn) ? { id: r.back.id, at: r.back.onDuty } : null;
      if (!home && !garnet) { const m = homes.find((h) => h.onDuty > r.onDuty && (!next || h.onDuty < next.onDuty)); if (m) home = { id: m.id, at: m.onDuty }; }
      // Not home yet: the last trip out, a few days ago at most.
      const away = !home && !garnet && !next && !!today && r.onDuty.slice(0, 10) >= addDays(today, -4);
      return { id: r.id, out: r.onDuty, home, garnet, away };
    });
  }
  // Each day of a turn's trips: { 'YYYY-MM-DD': { out: [HHMM], home: [HHMM] } } and the days out.
  function daysOut(trains, turn, today) {
    const trips = tripsOut(trains, turn, today);
    const days = {};
    const day = (d) => days[d] || (days[d] = { out: [], home: [] });
    for (const t of trips) {
      const from = t.out.slice(0, 10);
      const to = t.home ? t.home.at.slice(0, 10) : t.away ? today : from;
      day(from).out.push(t.out.slice(11));
      if (t.home) day(to).home.push(t.home.at.slice(11));
      for (let d = from; d <= to; d = addDays(d, 1)) day(d).isOut = true;
    }
    return { trips, days, count: Object.values(days).filter((d) => d.isOut).length, unseen: trips.filter((t) => !t.home && !t.garnet && !t.away).length };
  }
  function outBox(state) {
    const trains = state.trains;
    if (trains === undefined) return '<p class="muted">Loading the trains…</p>';
    if (!trains || !trains.length) return '<p class="muted">The trains aren’t available right now.</p>';
    const today = state.today || new Date().toLocaleDateString('en-CA');
    const firstDay = trains.map((r) => (r.from === 'sarnia' && r.onDuty ? r.onDuty.slice(0, 10) : null)).filter(Boolean).sort()[0] || today;
    const turnsIn = (re) => [...new Set(trains.flatMap((r) => (r.from === 'sarnia' && r.onDuty ? crewTurns(r) : [])).filter((t) => re.test(t)))].sort();
    const pool = OUT_POOLS.find((p) => p[0] === state.outPool) || OUT_POOLS.find((p) => state.outTurn && p[2].test(state.outTurn)) || OUT_POOLS[2];
    const turns = turnsIn(pool[2]);
    const turn = turns.includes(state.outTurn) ? state.outTurn : turns[0];
    const pick = (attr, list, on) => `<div class="refpick" role="group">${list.map(([v, label]) => `<button type="button" data-${attr}="${esc(v)}" aria-pressed="${v === on}">${esc(label)}</button>`).join('')}</div>`;
    let html = pick('outpool', OUT_POOLS.map((p) => [p[0], p[1]]), pool[0]) + (turns.length ? pick('outturn', turns.map((t) => [t, t]), turn) : '<p class="muted">No trips out for this pool in the trains file.</p>');
    if (!turn) return html;
    const d = daysOut(trains, turn, today);
    const start = addDays(firstDay, -((new Date(`${firstDay}T12:00:00Z`).getUTCDay() + 6) % 7));
    const label = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const rows = [];
    for (let w = start; w <= today; w = addDays(w, 7)) {
      rows.push(`<tr>${[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const day = addDays(w, i);
        if (day < firstDay || day > today) return '<td class="blank"></td>';
        const x = d.days[day] || {};
        const num = +day.slice(8, 10) === 1 || day === firstDay ? label(day) : String(+day.slice(8, 10));
        return `<td class="${x.isOut ? 'out' : ''}${day === today ? ' today' : ''}"><div class="dn">${esc(num)}</div>${(x.out || []).map((t) => `<div>↑${esc(t)}</div>`).join('')}${(x.home || []).map((t) => `<div>↓${esc(t)}</div>`).join('')}</td>`;
      }).join('')}</tr>`);
    }
    const span = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${firstDay}T12:00:00Z`)) / 864e5) + 1;
    const last = d.trips[d.trips.length - 1];
    html += `<p class="refout"><b class="num">${esc(turn)}</b>: out <b>${d.count}</b> of ${span} days · ${d.trips.length} trip${d.trips.length === 1 ? '' : 's'}${last ? ` · last out ${esc(label(last.out.slice(0, 10)))} ${esc(last.out.slice(11))}${last.away ? ', still away' : ''}` : ''}</p>
      <table class="outcal"><thead><tr>${DAYS.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>
      <p class="muted">Shaded: out of Sarnia. ↑ on duty in Sarnia, leaving · ↓ on duty in Toronto, coming home (home about 8 h later). ${pool[0] === 'S5' ? '501/502 come home from Garnet on L501 the same day. ' : ''}${d.unseen ? `${d.unseen} trip${d.unseen === 1 ? '' : 's'} home not seen: only the day out is shaded. ` : ''}From the site’s trains of the last ${span} days: what the turn worked. The days each turn is due out next are under “Due out of Sarnia”.</p>`;
    return html;
  }
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
  function icsFor(fits, { from, days, pools = OUT_POOLS.map((p) => p[0]), turn = null, now = new Date() }) {
    const ymd = (d) => d.replace(/-/g, '');
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const text = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
    const fold = (line) => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ` ${s.slice(74)}`; } out.push(s); return out.join('\r\n'); };
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sarnia Board//Due out of Sarnia//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Due out of Sarnia'];
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
    const pick = state.dueDay || today;
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(pick, i);
      rows.push(`<tr${day === today ? ' class="hit"' : ''}><td class="nw"><b>${esc(dayLabel(day))}</b></td><td>${OUT_POOLS.map(([k]) => (fits[k] ? `<span class="duegrp p${k}">${fits[k].due(day).map((t) => `<b class="num">${esc(t)}</b>`).join(' ')}</span>` : '')).join('')}</td></tr>`);
    }
    const fitLine = OUT_POOLS.map(([k, label]) => {
      const f = fits[k];
      return f ? `<div><span class="duegrp p${k}">${esc(label)}</span> ${f.per} a day of ${f.turns.length} (${esc(f.turns[0])}–${esc(f.turns[f.turns.length - 1])}) · matched <b>${f.hit} of ${f.total}</b> trips since ${esc(dayLabel(f.since, { month: 'short', day: 'numeric' }))}${f.hit < f.total * 0.9 ? ' <b>⚠ not holding</b>' : ''}</div>` : `<div>${esc(label)}: not enough trips to tell.</div>`;
    }).join('');
    const pools = state.icsPools || OUT_POOLS.map((p) => p[0]);
    const allTurns = OUT_POOLS.flatMap(([k]) => (fits[k] ? fits[k].turns : []));
    return `<div class="refcalc"><label>From <input id="dueday" type="date" value="${esc(pick)}"></label></div>
      <table class="reft duet"><tbody>${rows.join('')}</tbody></table>
      <h4>The rotation</h4><div class="duefit">${fitLine}</div>
      <h4>Put it on your calendar</h4>
      <div class="refpick" role="group" aria-label="Pools">${OUT_POOLS.map(([k, label]) => `<button type="button" data-icspool="${k}" aria-pressed="${pools.includes(k)}">${esc(label)}</button>`).join('')}</div>
      <div class="refcalc"><label>Turn <select id="icsturn"><option value="">Every turn</option>${allTurns.map((t) => `<option${t === state.icsTurn ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label>How far ahead <select id="icsmonths">${[1, 3, 6, 12].map((m) => `<option value="${m}"${m === (state.icsMonths || 3) ? ' selected' : ''}>${m} month${m === 1 ? '' : 's'}</option>`).join('')}</select></label>
      <button type="button" class="chg-toggle" id="icsget">Download the calendar file (.ics)</button></div>
      <p class="muted">An all-day event for each turn on each day it’s due out, named by the turn, from the day picked above. Google Calendar: on a computer, Settings → Import &amp; export → Import, and pick the calendar to put it in (one calendar a pool gives each pool its own colour). iPhone: open the downloaded file, then Add All. A newer file goes into a fresh calendar (or delete the old one first), so no day shows twice.</p>
      <p class="muted">The days come from the pools’ rotation as the board has seen it, not from CATS. A cancelled train, an extra one, or a turn added or taken off moves the order: check here, and download it again after a change.</p>`;
  }
  function wireDue(view, state) {
    const box = view.querySelector('#duebox');
    if (!box) return;
    box.innerHTML = dueBox(state);
    const again = () => wireDue(view, state);
    const day = box.querySelector('#dueday');
    if (day) day.onchange = () => { if (/^\d{4}-\d{2}-\d{2}$/.test(day.value)) { state.dueDay = day.value; again(); } };
    box.querySelectorAll('[data-icspool]').forEach((b) => {
      b.onclick = () => {
        const all = state.icsPools || OUT_POOLS.map((p) => p[0]);
        const k = b.dataset.icspool;
        state.icsPools = all.includes(k) ? all.filter((x) => x !== k) : [...all, k];
        again();
      };
    });
    const turn = box.querySelector('#icsturn');
    if (turn) turn.onchange = () => { state.icsTurn = turn.value || null; };
    const months = box.querySelector('#icsmonths');
    if (months) months.onchange = () => { state.icsMonths = +months.value; };
    const get = box.querySelector('#icsget');
    if (get) {
      get.onclick = () => {
        const from = state.dueDay || state.today || new Date().toLocaleDateString('en-CA');
        const m = state.icsMonths || 3;
        const to = new Date(`${from}T12:00:00Z`); to.setUTCMonth(to.getUTCMonth() + m);
        const days = Math.round((to - Date.parse(`${from}T12:00:00Z`)) / 864e5);
        const body = icsFor(fitsOf(state), { from, days, pools: state.icsPools || OUT_POOLS.map((p) => p[0]), turn: state.icsTurn || null });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
        a.download = `due-out-of-sarnia${state.icsTurn ? `-${state.icsTurn}` : ''}-${from}.ics`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      };
    }
  }
  function wireOut(view, state) {
    const box = view.querySelector('#outbox');
    if (!box) return;
    box.innerHTML = outBox(state);
    box.querySelectorAll('[data-outpool]').forEach((b) => { b.onclick = () => { state.outPool = b.dataset.outpool; state.outTurn = null; wireOut(view, state); }; });
    box.querySelectorAll('[data-outturn]').forEach((b) => { b.onclick = () => { state.outTurn = b.dataset.outturn; wireOut(view, state); }; });
  }

  // Both boxes that need the trains, drawn once they are in (and on every full draw).
  function paintLive(view, state) { wireDue(view, state); wireOut(view, state); }

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
    // A turn typed in the search opens its days out.
    const outTurnQ = q && OUT_POOLS.some((p) => p[2].test(q)) ? q : null;
    if (outTurnQ) { state.outTurn = outTurnQ; state.outPool = null; }
    const sec = (id, title, body, open) => `<details class="refsec" id="ref-${id}"${open || q ? ' open' : ''}><summary>${title}</summary>${body || '<p class="empty" style="padding:0">Nothing matches.</p>'}</details>`;
    const penaltyRows = [];
    for (let m = 600; m <= 960; m += 1) penaltyRows.push(`<tr><td class="num">${hm(m)}</td><td class="num">${penalty(m).toFixed(2)}</td></tr>`);
    const steps = [[961, 1020], [1021, 1080], [1081, 1140], [1141, 1200], [1201, 1260], [1261, 1320]].map(([a, b]) => `<tr><td class="num">${hm(a)} – ${hm(b)}</td><td class="num">${penalty(b).toFixed(2)}</td></tr>`).join('');
    view.innerHTML = `<div class="thead"><div class="when">Job Aids</div>
        <div class="turnpick"><label for="refq">Search (a track, a code, a word)</label><div class="row"><input id="refq" placeholder="e.g. R013, 33, vacation" autocomplete="off" spellcheck="false" value="${esc(state.q || '')}"></div></div></div>
      <section class="sheet refpage">
      ${q ? '' : sec('held', 'Held-away penalty (time off duty → penalty miles)', `<div class="refcalc">
          <label>Held for (h:mm) <input id="refheld" inputmode="numeric" placeholder="e.g. 13:25" value="${esc(state.held || '')}"></label>
          <span>or off duty <input id="refoff" type="time" value="${esc(state.off || '')}"> to on duty <input id="refon" type="time" value="${esc(state.on || '')}"></span>
          <p id="refout" class="refout"></p></div>
        <p class="muted">From the posted sheet (B-Force Timekeeping 1-888-878-1111). The times are total time off duty.</p>
        <details><summary>The whole table</summary><table class="reft"><thead><tr><th>Off duty</th><th>Miles</th></tr></thead><tbody>${penaltyRows.join('')}${steps}</tbody></table></details>`, true)}
      ${state.preview ? sec('yardjobs', 'Yard jobs: start times, days off and relief', yardSection(q, hit, state.today || new Date().toLocaleDateString('en-CA'))) : ''}
      ${state.preview ? sec('due', 'Due out of Sarnia: S1, S3, A pool, B pool, 501/502 by day', !q || outTurnQ || hit('due out of Sarnia', 'calendar', ...OUT_POOLS.map((p) => p[1])) ? '<div id="duebox"></div>' : '') : ''}
      ${state.preview ? sec('daysout', 'Days out of Sarnia: S1, S3, A pool, B pool, 501/502', !q || outTurnQ || hit('days out of Sarnia', ...OUT_POOLS.map((p) => p[1])) ? '<div id="outbox"></div>' : '') : ''}
      ${sec('tracks', 'Track lengths: Mac Yard, B.I.T. Yard, Malport', yards)}
      ${sec('status', 'CATS status and ECC codes', status && `<table class="reft"><thead><tr><th>Status</th><th>Meaning · ECC codes</th></tr></thead><tbody>${status}</tbody></table>`)}
      ${sec('jobs', 'Job types for Eastern Canada', jobs && `<table class="reft"><thead><tr><th>Type</th><th>Description</th></tr></thead><tbody>${jobs}</tbody></table>`)}
      <p class="muted" style="padding:10px 14px">From the CATS Eastern Canada Guide for Operating Crews and the sheets posted at work. Check the posted sheet if anything here looks off.</p>
      </section>`;
    if (state.preview) paintLive(view, state);
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

  const api = { STATUS, JOBS, YARDS, YARD_JOBS, RELIEF, RUNS_AS, TOWER, EXTRAS, yardCover, towerOn, reliefWeek, OUT_POOLS, crewTurns, tripsOut, daysOut, outBox, fitRotation, icsFor, dueBox, paintOut: paintLive, penalty, render };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoardRef = api;
})(typeof window !== 'undefined' ? window : globalThis);
