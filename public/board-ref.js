// Reference tab (owner, 2026-11-03: "general useful information"): CATS
// status and ECC codes, job types for Eastern Canada, Mac / B.I.T. / Malport
// track lengths and the held-away penalty (with a calculator). Typed in from
// the owner's photos of the CATS Eastern Canada Guide for Operating Crews and
// the sheets posted at work. Nothing here comes from CATS checks.
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
    const sec = (id, title, body, open) => `<details class="refsec" id="ref-${id}"${open || q ? ' open' : ''}><summary>${title}</summary>${body || '<p class="empty" style="padding:0">Nothing matches.</p>'}</details>`;
    const penaltyRows = [];
    for (let m = 600; m <= 960; m += 1) penaltyRows.push(`<tr><td class="num">${hm(m)}</td><td class="num">${penalty(m).toFixed(2)}</td></tr>`);
    const steps = [[961, 1020], [1021, 1080], [1081, 1140], [1141, 1200], [1201, 1260], [1261, 1320]].map(([a, b]) => `<tr><td class="num">${hm(a)} – ${hm(b)}</td><td class="num">${penalty(b).toFixed(2)}</td></tr>`).join('');
    view.innerHTML = `<div class="thead"><div class="when">${esc(state.title || 'Reference')}</div>
        <div class="turnpick"><label for="refq">Search (a track, a code, a word)</label><div class="row"><input id="refq" placeholder="e.g. R013, 33, vacation" autocomplete="off" spellcheck="false" value="${esc(state.q || '')}"></div></div></div>
      <section class="sheet refpage">
      ${q ? '' : sec('held', 'Held-away penalty (time off duty → penalty miles)', `<div class="refcalc">
          <label>Held for (h:mm) <input id="refheld" inputmode="numeric" placeholder="e.g. 13:25" value="${esc(state.held || '')}"></label>
          <span>or off duty <input id="refoff" type="time" value="${esc(state.off || '')}"> to on duty <input id="refon" type="time" value="${esc(state.on || '')}"></span>
          <p id="refout" class="refout"></p></div>
        <p class="muted">From the posted sheet (B-Force Timekeeping 1-888-878-1111). The times are total time off duty.</p>
        <details><summary>The whole table</summary><table class="reft"><thead><tr><th>Off duty</th><th>Miles</th></tr></thead><tbody>${penaltyRows.join('')}${steps}</tbody></table></details>`, true)}
      ${sec('tracks', 'Track lengths: Mac Yard, B.I.T. Yard, Malport', yards)}
      ${sec('status', 'CATS status and ECC codes', status && `<table class="reft"><thead><tr><th>Status</th><th>Meaning · ECC codes</th></tr></thead><tbody>${status}</tbody></table>`)}
      ${sec('jobs', 'Job types for Eastern Canada', jobs && `<table class="reft"><thead><tr><th>Type</th><th>Description</th></tr></thead><tbody>${jobs}</tbody></table>`)}
      <p class="muted" style="padding:10px 14px">From the CATS Eastern Canada Guide for Operating Crews and the sheets posted at work. Check the posted sheet if anything here looks off.</p>
      </section>`;
    const box = view.querySelector('#refq');
    box.oninput = () => { state.q = box.value; const pos = box.selectionStart; render(view, state); const b = view.querySelector('#refq'); b.focus(); try { b.setSelectionRange(pos, pos); } catch (e) { /* not a text box */ } };
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

  const api = { STATUS, JOBS, YARDS, penalty, render };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoardRef = api;
})(typeof window !== 'undefined' ? window : globalThis);
