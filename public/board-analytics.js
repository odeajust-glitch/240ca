// Analytics tab (owner, 2026-10-26): numbers across the saved checks for a
// train number, a turn or a person (name code). "148" means every 148, any
// letter in front and any digits after: M14831 26, Q14821 03, …
//
// Works on what the site already publishes: data/trains.json (each line-up
// train, BoardTrains.summarize) and the trains a turn or person worked
// (Turn History's work history). Shared by the page (window.BoardAnalytics)
// and the tests.
(function (root) {
  const T = typeof module !== 'undefined' && module.exports ? require('./board-trains') : root.BoardTrains;
  const pad = (n) => String(n).padStart(2, '0');
  const clean = (q) => String(q || '').trim().toUpperCase().replace(/\s+/g, ' ');

  // Does train id "M14831 26" match what was typed?
  //   "148"       → the number after the letters starts with 148
  //   "M148"      → the symbol starts with M148
  //   "M14831 26" → that one train (any month)
  function trainMatches(id, q) {
    q = clean(q);
    if (!q) return false;
    const symbol = String(id).split(' ')[0];
    const m = /^([A-Z]+)(\d+)/.exec(symbol);
    if (/^\d+$/.test(q)) return !!m && m[2].startsWith(q);
    if (/ /.test(q)) return String(id) === q;
    return symbol.startsWith(q);
  }

  // What was typed: 'train', 'turn' or 'code' (4 letters, a person).
  // knownTurns: the turns the site has a history for.
  function kindOf(q, knownTurns = [], trains = []) {
    q = clean(q);
    if (!q) return null;
    if (/^\d+$/.test(q) || / /.test(q) || q === 'DH') return 'train';
    const base = q.replace(/-(EN|CO)$/, '');
    if (knownTurns.includes(base)) return 'turn';
    if (/^[A-Z]{4}$/.test(q)) return 'code';
    if (/^[A-Z]{1,2}\d{4,}$/.test(q) || trains.some((r) => trainMatches(r.id, q))) return 'train';
    return 'turn';
  }

  // "M14831 26" → "148": the train number the way crews say it (any
  // letter). Every deadhead counts as one, "DH" (owner, 2026-10-26: simpler
  // to follow than each DHT211B, DHT042C…).
  const numberOf = (id) => { if (/^DH/.test(String(id))) return 'DH'; const m = /^([A-Z]+)(\d{3})/.exec(String(id)); return m ? m[2] : String(id).split(' ')[0]; };
  // "SR03" → "SR", "B119" → "B", "S102" → "S1".
  const poolOf = (turn) => { const m = /^(S[RABD135]|MU|[A-Z]+)/.exec(turn || ''); return m ? m[1] : ''; };
  const POOLS = { SR: 'Chain Gang (SR)', SA: 'A pool (SA)', SB: 'B pool (SB)', SD: 'SD', S1: 'S1', S3: 'S3', S5: '501/502', MU: 'make-up (MU)', B: 'spareboard (B)' };
  const crewTurn = (crew, crafts) => { const m = new RegExp(`(?:^|· )(?:${crafts}) ([A-Z0-9]+)`).exec(crew || ''); return m ? m[1] : null; };

  // One train from trains.json as a row.
  function runOf(r) {
    return {
      // Archived trains (data/archive.json) have no story to open.
      id: r.id, number: numberOf(r.id), key: r.events ? `${r.id} ${r.month}` : null, day: r.day, from: r.from || 'sarnia', deadhead: !!r.deadhead, yard: false,
      at: r.onDuty || null, ran: !!r.onDuty, gone: !!r.gone && !r.onDuty, station: r.station || '', crew: r.crew || '',
      co: crewTurn(r.crew, 'CO'), en: crewTurn(r.crew, 'EN|LE'),
      firstPlan: r.firstPlan || null, firstOrder: r.firstOrder || null, offPlan: r.offPlan, offOrder: r.offOrder, orderChanges: r.orderChanges || 0,
      timeOnDuty: r.timeOnDuty, heldMin: r.heldMin != null ? r.heldMin : null, stillHeld: !!r.stillHeld, flag: r.flag || null, predHit: r.predHit || null,
    };
  }

  // Every train matching the search, newest first.
  function trainRuns(trains, q) {
    return trains.filter((r) => trainMatches(r.id, q)).map(runOf);
  }

  // Trains (and yard jobs) a turn or person worked, from Turn History's work
  // history ({ train, at, yard, station, crew, job, turn }), each joined to
  // its trains.json row when there is one (plan, order, time on duty, held).
  // self: the turn searched (for "worked with").
  function workRuns(work, trains, self = '') {
    return work.map((o) => {
      const id = String(o.train).replace(/ \([A-Z0-9-]+\)$/, '');
      const near = o.at && trains.find((r) => r.id === id && r.onDuty && Math.abs(T.toMin(r.onDuty) - T.toMin(o.at)) <= 24 * 60);
      const base = near ? runOf(near) : {
        id, number: o.yard ? id : numberOf(id), key: null, day: (o.at || '').slice(0, 10), from: 'sarnia', deadhead: /^DH/.test(id), yard: !!o.yard,
        at: o.at || null, ran: true, gone: false, station: o.station || '', crew: o.crew || '', co: crewTurn(o.crew, 'CO'), en: crewTurn(o.crew, 'EN|LE'),
        firstPlan: null, firstOrder: null, offPlan: null, offOrder: null, orderChanges: 0, timeOnDuty: null, heldMin: null, stillHeld: false, flag: null, predHit: null,
      };
      const me = o.turn || self;
      const partners = (o.crew || '').split(' · ').filter(Boolean).map((c) => c.split(' ').pop()).filter((t) => t !== me && t !== o.job && t !== self);
      return { ...base, at: base.at || o.at || null, as: o.job ? `working ${o.job}` : '', turn: o.turn || '', partners };
    }).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }

  // On-duty times of day: earliest, latest and the middle half, read around
  // the clock (a train that goes 2330 and 0030 is "usually 2330–0030", not
  // spread over the whole day): start after the biggest gap between times.
  function timeOfDay(stamps) {
    const mins = stamps.filter(Boolean).map((s) => +s.slice(11, 13) * 60 + +s.slice(13, 15)).sort((a, b) => a - b);
    if (!mins.length) return null;
    let cut = 0;
    let gap = mins[0] + 1440 - mins[mins.length - 1];
    for (let i = 1; i < mins.length; i++) if (mins[i] - mins[i - 1] > gap) { gap = mins[i] - mins[i - 1]; cut = i; }
    const line = [...mins.slice(cut), ...mins.slice(0, cut).map((m) => m + 1440)];
    const at = (p) => line[Math.min(line.length - 1, Math.max(0, Math.round(p * (line.length - 1))))];
    const hhmm = (m) => `${pad(Math.floor((m % 1440) / 60))}${pad(m % 60)}`;
    return { n: mins.length, earliest: hhmm(line[0]), latest: hhmm(line[line.length - 1]), from: hhmm(at(0.25)), to: hhmm(at(0.75)), middle: hhmm(at(0.5)) };
  }

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = (stamp) => new Date(Date.UTC(+stamp.slice(0, 4), +stamp.slice(5, 7) - 1, +stamp.slice(8, 10))).getUTCDay();
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  // Most common first, ties by name: [[name, count], …].
  const top = (xs, n = 5) => {
    const c = new Map();
    for (const x of xs.filter(Boolean)) c.set(x, (c.get(x) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n);
  };

  // The numbers for a set of runs.
  function stats(runs) {
    const ran = runs.filter((r) => r.ran);
    const trains = ran.filter((r) => !r.yard);
    const tod = trains.map((r) => r.timeOnDuty).filter((x) => x != null);
    const plan = trains.map((r) => r.offPlan).filter((x) => x != null);
    const ord = trains.map((r) => r.offOrder).filter((x) => x != null);
    const held = trains.filter((r) => r.heldMin != null);
    const score = (k) => { const s = trains.map((r) => r.predHit && r.predHit[k]).filter((x) => x != null); return { hit: s.filter(Boolean).length, n: s.length }; };
    const days = WEEKDAYS.map(() => 0);
    for (const r of ran) if (r.at) days[weekday(r.at)]++;
    const dates = ran.map((r) => r.at).filter(Boolean).sort();
    return {
      seen: runs.length,
      ran: ran.length,
      yard: ran.length - trains.length,
      neverRan: runs.filter((r) => r.gone).length,
      waiting: runs.filter((r) => !r.ran && !r.gone).length,
      first: dates[0] || null,
      last: dates[dates.length - 1] || null,
      time: timeOfDay(ran.map((r) => r.at)),
      weekdays: WEEKDAYS.map((d, i) => [d, days[i]]),
      timeOnDuty: { n: tod.length, avg: avg(tod), max: tod.length ? Math.max(...tod) : null },
      offPlan: { n: plan.length, avg: avg(plan.map(Math.abs)), late: plan.filter((x) => x > 15).length, early: plan.filter((x) => x < -15).length },
      offOrder: { n: ord.length, avg: avg(ord.map(Math.abs)) },
      orderChanged: trains.filter((r) => r.orderChanges > 0).length,
      held: { n: held.length, over14: held.filter((r) => r.heldMin >= T.HELD_LIMIT).length, avg: avg(held.map((r) => r.heldMin)), max: held.length ? Math.max(...held.map((r) => r.heldMin)) : null },
      flags: top(runs.map((r) => r.flag), 9),
      deadheads: trains.filter((r) => r.deadhead).length,
      pred: { co: score('co'), en: score('en') },
      numbers: top(ran.map((r) => r.number), 10),
      conductors: top(trains.map((r) => r.co)),
      engineers: top(trains.map((r) => r.en)),
      pools: top(trains.flatMap((r) => [r.co, r.en]).filter(Boolean).map(poolOf), 9).map(([p, n]) => [POOLS[p] || p, n]),
      partners: top(ran.flatMap((r) => r.partners || [])),
    };
  }

  // --- More (owner picked A1–A5, A8–A13 on 2026-10-26) ----------------------

  // A11: runs on duty (or, not run, due) within { from, to } days, inclusive.
  // An empty end is open.
  function inRange(runs, range = {}) {
    if (!range.from && !range.to) return runs;
    return runs.filter((r) => {
      const d = (r.at || r.day || '').slice(0, 10);
      return d && (!range.from || d >= range.from) && (!range.to || d <= range.to);
    });
  }

  // A1: trains on duty in each hour of the day (0–23).
  function byHour(runs) {
    const h = Array(24).fill(0);
    for (const r of runs) if (r.ran && r.at) h[+r.at.slice(11, 13)]++;
    return h;
  }
  // A1: trains on duty per week (weeks start Sunday, like CATS days), every
  // week from the first to the last, empty ones included.
  function byWeek(runs) {
    const day = (st) => Date.UTC(+st.slice(0, 4), +st.slice(5, 7) - 1, +st.slice(8, 10)) / 864e5;
    const ran = runs.filter((r) => r.ran && r.at);
    if (!ran.length) return [];
    const weekOf = (d) => d - new Date(d * 864e5).getUTCDay();
    const counts = new Map();
    for (const r of ran) { const w = weekOf(day(r.at)); counts.set(w, (counts.get(w) || 0) + 1); }
    const ws = [...counts.keys()];
    const out = [];
    for (let w = Math.min(...ws); w <= Math.max(...ws); w += 7) out.push({ week: new Date(w * 864e5).toISOString().slice(0, 10), n: counts.get(w) || 0 });
    return out;
  }

  // A2: time from one train (or yard job) on duty to the next.
  function between(runs) {
    const at = runs.filter((r) => r.ran && r.at).map((r) => T.toMin(r.at)).sort((a, b) => a - b);
    const gaps = at.slice(1).map((m, i) => m - at[i]).filter((g) => g > 0);
    return { n: gaps.length, avg: avg(gaps), min: gaps.length ? Math.min(...gaps) : null };
  }

  // A3: one turn's line in "turns side by side".
  // extra: { spares, rests, tookOutOfTurn } counts in the same dates.
  function turnRow(turn, runs, extra = {}) {
    const st = stats(runs);
    const b = between(runs);
    return { turn, trains: st.ran - st.yard, yard: st.yard, todTotal: runs.reduce((n, r) => n + (r.timeOnDuty || 0), 0), todAvg: st.timeOnDuty.avg,
      held14: st.held.over14, between: b.avg, spares: extra.spares || 0, rests: extra.rests || 0, tookOutOfTurn: extra.tookOutOfTurn || 0 };
  }

  // A8 + A13: line-up trains by number: how reliable the plan was, how
  // many never ran, deadheads never called.
  function byNumber(runs) {
    const groups = new Map();
    for (const r of runs) {
      if (r.yard) continue;
      const g = groups.get(r.number) || { number: r.number, seen: 0, ran: 0, neverRan: 0, deadheads: 0, dhNeverCalled: 0, plan: [] };
      g.seen++;
      if (r.ran) g.ran++;
      if (r.gone) g.neverRan++;
      if (r.deadhead) g.deadheads++;
      if (r.flag === 'deadhead') g.dhNeverCalled++;
      if (r.offPlan != null) g.plan.push(r.offPlan);
      groups.set(r.number, g);
    }
    return [...groups.values()].map(({ plan, ...g }) => ({ ...g, planN: plan.length, planAvg: avg(plan.map(Math.abs)),
      planWorst: plan.length ? plan.reduce((w, x) => (Math.abs(x) > Math.abs(w) ? x : w), 0) : null,
      late: plan.filter((x) => x > 15).length, early: plan.filter((x) => x < -15).length }));
  }

  // A9: prediction right, day by day, and how early the right crew showed.
  function accuracyByDay(runs) {
    const days = new Map();
    for (const r of runs) {
      if (!r.ran || !r.predHit || !r.at) continue;
      const d = r.at.slice(0, 10);
      const x = days.get(d) || { day: d, co: { hit: 0, n: 0 }, en: { hit: 0, n: 0 } };
      for (const k of ['co', 'en']) if (r.predHit[k] != null) { x[k].n++; if (r.predHit[k]) x[k].hit++; }
      days.set(d, x);
    }
    return [...days.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  }
  function predLead(runs) {
    const lead = (k) => runs.map((r) => r.predHit && r.predHit[k + 'Lead']).filter((x) => x != null && x >= 0);
    return { co: { n: lead('co').length, avg: avg(lead('co')) }, en: { n: lead('en').length, avg: avg(lead('en')) } };
  }

  // A4: trains that went out of sequence (data/analytics.json runarounds),
  // by the pool the sequence said and the turn that took it.
  const SEQ_POOLS = { SR: 'Chain Gang (SR)', A: 'A pool', B: 'B pool', S5: '501/502' };
  function runaroundStats(list) {
    return {
      n: list.length,
      shouldHave: top(list.map((r) => SEQ_POOLS[r.expected] || r.expected), 9),
      wentTo: top(list.map((r) => SEQ_POOLS[r.actual] || r.actual), 9),
      tookIt: top(list.map((r) => r.turn), 10),
    };
  }

  // A5: jobs going spare (data/analytics.json spareJobs): per day, who
  // filled them, and how often the expected spare turn was the one.
  function spareJobStats(jobs) {
    const perDay = new Map();
    for (const j of jobs) perDay.set(j.first.slice(0, 10), (perDay.get(j.first.slice(0, 10)) || 0) + 1);
    const filled = jobs.filter((j) => j.filledBy);
    const checked = filled.filter((j) => j.predicted);
    return {
      n: jobs.length,
      perDay: [...perDay.entries()].sort().map(([day, n]) => ({ day, n })),
      filled: filled.length,
      filledBy: top(filled.map((j) => j.filledBy), 10),
      byPool: top(jobs.map((j) => `${j.pool} ${j.cc}`.trim()), 9),
      predicted: { hit: checked.filter((j) => j.predicted === j.filledBy).length, n: checked.length },
    };
  }

  // Sleep tracker (owner, 2026-10-26): they go to sleep once the expected
  // call is 8 h away; how far the real call landed from it. Within 30 min
  // either way green, within an hour yellow, more red.
  const SLEEP_GREEN = 30;
  const SLEEP_YELLOW = 60;
  const sleepBand = (off) => (Math.abs(off) <= SLEEP_GREEN ? 'ok' : Math.abs(off) <= SLEEP_YELLOW ? 'warn' : 'bad');
  function sleepStats(list) {
    const offs = list.map((z) => z.off);
    const bands = { ok: 0, warn: 0, bad: 0 };
    for (const o of offs) bands[sleepBand(o)]++;
    return {
      n: list.length, ...bands,
      earlier: offs.filter((o) => o < -SLEEP_GREEN).length,
      later: offs.filter((o) => o > SLEEP_GREEN).length,
      avg: avg(offs.map(Math.abs)),
      shifts: avg(list.map((z) => (z.shifts || []).length)),
      short: list.filter((z) => z.short || z.noWindow).length,
    };
  }
  // Each turn's line for "Sleep" with nothing searched, worst first.
  function sleepByTurn(list) {
    const by = new Map();
    for (const z of list) { if (!by.has(z.turn)) by.set(z.turn, []); by.get(z.turn).push(z); }
    return [...by.entries()].map(([turn, l]) => ({ turn, ...sleepStats(l) }))
      .sort((a, b) => b.bad / b.n - a.bad / a.n || b.n - a.n || (a.turn < b.turn ? -1 : 1));
  }

  // A10: any list of runs as a spreadsheet (CSV), newest first.
  function csv(runs) {
    const cols = [['On duty', (r) => r.at || ''], ['Train', (r) => r.id], ['Number', (r) => r.number], ['From', (r) => (r.from === 'mac' ? 'Toronto' : 'Sarnia')],
      ['Yard', (r) => (r.yard ? 'yes' : '')], ['Deadhead', (r) => (r.deadhead ? 'yes' : '')], ['Never ran', (r) => (r.gone ? 'yes' : '')],
      ['Turn', (r) => r.turn || ''], ['Working', (r) => (r.as || '').replace(/^working /, '')], ['Crew', (r) => r.crew], ['Worked with', (r) => (r.partners || []).join(' ')],
      ['First plan', (r) => r.firstPlan || ''], ['First order', (r) => r.firstOrder || ''], ['Plan off (min)', (r) => r.offPlan ?? ''], ['Order off (min)', (r) => r.offOrder ?? ''],
      ['Order changes', (r) => r.orderChanges || 0], ['Time on duty (min)', (r) => r.timeOnDuty ?? ''], ['Off duty in Toronto (min)', (r) => r.heldMin ?? ''],
      ['Flag', (r) => r.flag || ''], ['Conductor predicted right', (r) => (r.predHit && r.predHit.co != null ? (r.predHit.co ? 'yes' : 'no') : '')],
      ['Engineer predicted right', (r) => (r.predHit && r.predHit.en != null ? (r.predHit.en ? 'yes' : 'no') : '')]];
    const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [cols.map((c) => c[0]), ...runs.map((r) => cols.map((c) => c[1](r)))].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  const api = { trainMatches, kindOf, numberOf, poolOf, runOf, trainRuns, workRuns, timeOfDay, stats, WEEKDAYS,
    inRange, byHour, byWeek, between, turnRow, byNumber, accuracyByDay, predLead, runaroundStats, spareJobStats, csv, SEQ_POOLS,
    sleepBand, sleepStats, sleepByTurn, SLEEP_GREEN, SLEEP_YELLOW };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoardAnalytics = api;
})(this);
