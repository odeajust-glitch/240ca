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
    if (/^[A-Z]{3}[A-Z1-9]$/.test(q)) return 'code';
    if (/^[A-Z]{1,2}\d{4,}$/.test(q) || trains.some((r) => trainMatches(r.id, q))) return 'train';
    return 'turn';
  }

  // "M14831 26" → "148": the train number the way crews say it (any
  // letter). Every deadhead counts as one, "DH" (owner, 2026-10-26: simpler
  // to follow than each DHT211B, DHT042C…).
  const numberOf = (id) => { if (/^DH/.test(String(id))) return 'DH'; const m = /^([A-Z]+)(\d{3})/.exec(String(id)); return m ? m[2] : String(id).split(' ')[0]; };
  // "SR03" → "SR", "B119" → "B", "S102" → "S1".
  const poolOf = (turn) => { const m = /^(S[RABD135]|MU|[A-Z]+)/.exec(turn || ''); return m ? m[1] : ''; };
  const POOLS = { SR: 'Chain Gang (SR)', SA: 'A pool (SA)', SB: 'B pool (SB)', SD: 'Drags (SD)', S1: '1st Manifest (S1)', S3: '3rd Manifest (S3)', S5: '501/502', MU: 'make-up (MU)', B: 'spareboard (B)' };
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

  // Every train matching the search, newest first (the site's trains and the
  // archive's arrive in different orders).
  const dueOf = (r) => r.at || r.day || '';
  const newestFirst = (runs) => runs.sort((a, b) => (dueOf(a) < dueOf(b) ? 1 : dueOf(a) > dueOf(b) ? -1 : 0));
  function trainRuns(trains, q) {
    return newestFirst(trains.filter((r) => trainMatches(r.id, q)).map(runOf));
  }
  // Train id → its rows, built once for workRuns (a year of trains, every turn).
  function indexTrains(trains) {
    const m = new Map();
    for (const r of trains) { if (!m.has(r.id)) m.set(r.id, []); m.get(r.id).push(r); }
    return m;
  }

  // Trains (and yard jobs) a turn or person worked, from Turn History's work
  // history ({ train, at, yard, station, crew, job, turn }), each joined to
  // its trains.json row when there is one (plan, order, time on duty, held).
  // self: the turn searched (for "worked with"). trains: a list, or
  // indexTrains() of it when called for many turns.
  function workRuns(work, trains, self = '') {
    const byId = trains instanceof Map ? trains : indexTrains(trains);
    return work.map((o) => {
      const id = String(o.train).replace(/ \([A-Z0-9-]+\)$/, '');
      const near = o.at && (byId.get(id) || []).find((r) => r.onDuty && Math.abs(T.toMin(r.onDuty) - T.toMin(o.at)) <= 24 * 60);
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
      // F1: why it never showed on the Call Board (BoardTrains flagOf).
      cancelled: runs.filter((r) => r.gone && !['nonSarnia', 'possible', 'deadhead'].includes(r.flag)).length,
      nonSarnia: runs.filter((r) => r.flag === 'nonSarnia').length,
      possibleNonSarnia: runs.filter((r) => r.flag === 'possible').length,
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
  // week from the first to the last, empty ones included. count: what each
  // run adds (F6: e.g. 1 when held 14 h+), over the same weeks.
  function byWeek(runs, count = () => 1) {
    const day = (st) => Date.UTC(+st.slice(0, 4), +st.slice(5, 7) - 1, +st.slice(8, 10)) / 864e5;
    const ran = runs.filter((r) => r.ran && r.at);
    if (!ran.length) return [];
    const weekOf = (d) => d - new Date(d * 864e5).getUTCDay();
    const counts = new Map();
    for (const r of ran) { const w = weekOf(day(r.at)); counts.set(w, (counts.get(w) || 0) + count(r)); }
    const ws = [...counts.keys()];
    const out = [];
    for (let w = Math.min(...ws); w <= Math.max(...ws); w += 7) out.push({ week: new Date(w * 864e5).toISOString().slice(0, 10), n: counts.get(w) || 0 });
    return out;
  }

  // Calendar-day rates cover the observed span, not seven days for edge weeks.
  // Missing held times are unknown, never zero-length stays.
  function whenSummary(runs) {
    const hours = byHour(runs);
    const windows = Array.from({ length: 8 }, (_, i) => ({ hour: i * 3, n: hours.slice(i * 3, i * 3 + 3).reduce((a, b) => a + b, 0) }));
    const ran = runs.filter((r) => r.ran && r.at);
    const dates = ran.map((r) => r.at.slice(0, 10)).sort();
    const day = (d) => Date.parse(d + 'T00:00:00Z') / 864e5;
    const weeks = byWeek(runs).map((w) => {
      const start = Math.max(day(w.week), day(dates[0]));
      const end = Math.min(day(w.week) + 6, day(dates[dates.length - 1]));
      const days = end - start + 1;
      const stays = ran.filter((r) => r.at.slice(0, 10) >= w.week && day(r.at.slice(0, 10)) <= day(w.week) + 6 && Number.isFinite(r.heldMin) && r.heldMin >= 0);
      const held = stays.filter((r) => r.heldMin >= T.HELD_LIMIT).length;
      return { ...w, days, perDay: w.n / days, partial: start === day(dates[0]) || end === day(dates[dates.length - 1]), stays: stays.length, held, ongoing: stays.filter((r) => r.stillHeld).length, percent: stays.length ? Math.round(100 * held / stays.length) : null };
    });
    return { hours, windows, weeks, total: ran.length };
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
      const g = groups.get(r.number) || { number: r.number, seen: 0, ran: 0, neverRan: 0, cancelled: 0, nonSarnia: 0, possible: 0, deadheads: 0, dhNeverCalled: 0, plan: [] };
      g.seen++;
      if (r.ran) g.ran++;
      if (r.gone) g.neverRan++;
      // F1: a Toronto train gone with no rested Sarnia crew went to a non-Sarnia crew.
      if (r.flag === 'nonSarnia') g.nonSarnia++;
      else if (r.flag === 'possible') g.possible++;
      else if (r.gone && r.flag !== 'deadhead') g.cancelled++;
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
  // fromStart: right from the first time the train was seen, so the site
  // may have known even earlier (the average is then at least that).
  function predLead(runs) {
    const one = (k) => {
      const hits = runs.filter((r) => r.predHit && r.predHit[k + 'Lead'] != null);
      const lead = hits.map((r) => Math.max(0, r.predHit[k + 'Lead']));
      return { n: lead.length, avg: avg(lead), fromStart: hits.filter((r) => r.predHit[k + 'FromStart']).length };
    };
    return { co: one('co'), en: one('en') };
  }

  // A4: trains that went out of sequence (data/analytics.json runarounds),
  // by the pool the sequence said and the turn that took it.
  const SEQ_POOLS = { SR: 'Chain Gang (SR)', A: 'A pool', B: 'B pool', S5: '501/502' };
  // Each train shown out of sequence counts; a runaround is one still out of
  // sequence the last time it showed (fixed ones were put right).
  function runaroundStats(list) {
    const uncertain = r => r.statusUncertain || !!(r.onDuty && r.last && r.last > r.onDuty);
    const runs = list.filter((r) => !r.fixed && !uncertain(r));
    const span = (r) => (r.stretches || []).reduce((n, x) => n + Math.max(0, T.toMin(x.to) - T.toMin(x.from)), 0);
    return {
      shown: list.length,
      n: runs.length,
      fixed: list.filter(r => r.fixed && !uncertain(r)).length,
      uncertain: list.filter(uncertain).length,
      wrongFor: avg(list.filter((r) => r.stretches).map(span)),
      shouldHave: top(runs.map((r) => SEQ_POOLS[r.expected] || r.expected), 9),
      wentTo: top(runs.map((r) => SEQ_POOLS[r.actual] || r.actual), 9),
      tookIt: top(runs.map((r) => r.turn), 10),
    };
  }

  // Every day from the first to the last in a Map(day → n), empty ones as 0 (F3).
  function everyDay(m) {
    const days = [...m.keys()].sort();
    if (!days.length) return [];
    const out = [];
    for (let d = Date.parse(days[0] + 'T12:00:00Z'); d <= Date.parse(days[days.length - 1] + 'T12:00:00Z'); d += 864e5) {
      const day = new Date(d).toISOString().slice(0, 10);
      out.push({ day, n: m.get(day) || 0 });
    }
    return out;
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
      perDay: everyDay(perDay),
      daysWithAny: perDay.size,
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
  // Calls only (a wait ended by being taken off the line-up has no call to
  // score); takenOff counts those on their own (owner, 2026-10-26).
  function sleepStats(all) {
    all = all.map(cleanCallRecord);
    const list = all.filter((z) => !z.takenOff && !z.comparisonUnavailable);
    const offs = list.map((z) => z.off);
    const bands = { ok: 0, warn: 0, bad: 0 };
    for (const o of offs) bands[sleepBand(o)]++;
    return {
      n: list.length, ...bands,
      takenOff: all.filter(z => z.takenOff).length,
      excluded: all.filter(z => !z.takenOff && z.comparisonUnavailable).length,
      earlier: offs.filter((o) => o < -SLEEP_GREEN).length,
      later: offs.filter((o) => o > SLEEP_GREEN).length,
      avg: avg(offs.map(Math.abs)),
      // Split (owner, 2026-10-26): early cuts into rest, late means waiting.
      earlierAvg: avg(offs.filter((o) => o < 0).map(Math.abs)), earlierAll: offs.filter((o) => o < 0).length,
      laterAvg: avg(offs.filter((o) => o > 0)), laterAll: offs.filter((o) => o > 0).length,
      shifts: avg(list.map((z) => (z.shifts || []).length)),
      short: list.filter((z) => z.short || z.noWindow).length,
    };
  }
  // Each turn's line for "Sleep" with nothing searched, worst first.
  function sleepByTurn(list) {
    const by = new Map();
    for (const z of list) { if (!by.has(z.turn)) by.set(z.turn, []); by.get(z.turn).push(z); }
    return [...by.entries()].map(([turn, l]) => ({ turn, ...sleepStats(l) }))
      .sort((a, b) => (b.n ? b.bad / b.n : 0) - (a.n ? a.bad / a.n : 0) || b.n - a.n || (a.turn < b.turn ? -1 : 1));
  }

  // The archive (data/archive.json) and the site's own data meet at the
  // site's first day: something that started before it (a rest, a train
  // first seen the night before) is in both. Each kind has one identity and
  // the older copy wins, since it saw the start (Fable review, 2026-10-26).
  const SPARE_GAP = 60; // a goes-spare stretch picked up again within this: the same one
  const JOB_GAP = 3 * 60; // as lib/board/insights.js SAME_JOB_MIN
  const IDS = {
    trains: (r) => `${r.id} ${r.month}`,
    work: (o) => `${String(o.train).replace(/ \([A-Z0-9-]+\)$/, '')}|${o.at}`,
    rests: (x) => `${x.kind}|${x.until}|${x.until ? '' : x.seen}`,
    runarounds: (r) => T.trainKey(r.train, r.taken),
    sleep: (z) => `${z.turn}|${z.train}|${z.onDuty}`,
    catsErrors: (r) => `${r.train}|${r.craft}|${r.cats}|${String(r.first).slice(0, 7)}`,
    stale: (r) => `${r.train}|${String(r.from).slice(0, 7)}`,
    catsMissing: (r) => `${r.train}|${r.craft}|${String(r.first).slice(0, 7)}`,
    runLog: (r) => `${r.train}|${r.craft}|${String(r.seen).slice(0, 7)}`,
    crewWrong: (r) => T.trainKey(r.train, r.first),
  };
  // older + newer as one list, each thing once.
  function joinOld(kind, older = [], newer = []) {
    if (kind === 'trains') { older = older.map(T.cleanTrip); newer = newer.map(T.cleanTrip); }
    if (kind === 'runarounds') {
      // The archive's copy saw it start; later checks (the site's) add their
      // stretches, the end state and the crew that went.
      const out = older.map((x) => ({ ...x }));
      const by = new Map(out.map((x) => [IDS.runarounds(x), x]));
      for (const n of newer) {
        const o = by.get(IDS.runarounds(n));
        if (!o) { out.push(n); continue; }
        if ((n.last || '') <= (o.last || '')) continue;
        const more = (n.stretches || []).filter((x) => x.from > (o.lastWrong || o.taken));
        Object.assign(o, { last: n.last, fixed: n.fixed, final: n.final, stretches: [...(o.stretches || []), ...more] });
        o.wrongChecks = o.stretches.reduce((t, x) => t + x.checks, 0);
        if (more.length) Object.assign(o, { expected: n.expected, actual: n.actual, turn: n.turn, lastWrong: n.lastWrong });
        if (n.onDuty && !o.onDuty) Object.assign(o, { onDuty: n.onDuty, crew: n.crew, station: n.station });
      }
      return out;
    }
    if (kind === 'crewWrong') {
      // The copy that followed the train longest wins (it saw the fix, if there was one).
      const out = older.map((x) => ({ ...x }));
      const by = new Map(out.map((x, i) => [IDS.crewWrong(x), i]));
      for (const n of newer) {
        const i = by.get(IDS.crewWrong(n));
        if (i == null) { by.set(IDS.crewWrong(n), out.length); out.push(n); } else if ((n.seen || '') > (out[i].seen || '')) out[i] = n;
      }
      return out;
    }
    if (kind === 'spares' || kind === 'spareJobs') {
      // Stretches: the same one if the newer starts while (or just after) the older ran.
      const idOf = kind === 'spares' ? (x) => x.text || '' : (x) => `${x.train}|${x.turn}`;
      const startOf = kind === 'spares' ? (x) => x.seen : (x) => x.first;
      const gap = kind === 'spares' ? SPARE_GAP : JOB_GAP;
      const out = older.map((x) => ({ ...x }));
      const by = new Map();
      for (const x of out) { if (!by.has(idOf(x))) by.set(idOf(x), []); by.get(idOf(x)).push(x); }
      for (const n of newer) {
        const o = (by.get(idOf(n)) || []).find((x) => T.toMin(startOf(n)) >= T.toMin(startOf(x)) && T.toMin(startOf(n)) <= T.toMin(x.last || startOf(x)) + gap);
        if (!o) { out.push(n); continue; }
        if ((n.last || '') > (o.last || '')) o.last = n.last;
        if (kind === 'spareJobs' && !o.filledBy && n.filledBy) Object.assign(o, { filledBy: n.filledBy, filledOn: n.filledOn, filledSeen: n.filledSeen });
      }
      return out;
    }
    const id = IDS[kind];
    const seen = new Set(older.map(id));
    return [...older, ...newer.filter((x) => !seen.has(id(x)))];
  }

  // A10: any list of runs as a spreadsheet (CSV), newest first.
  // F5: "2026-10-20 0500" → "2026-10-20 05:00", which spreadsheets read as a date.
  const xlTime = (st) => (st ? st.replace(/ (\d{2})(\d{2})$/, ' $1:$2') : '');
  function csv(runs) {
    const cols = [['On duty', (r) => xlTime(r.at)], ['Train', (r) => r.id], ['Number', (r) => r.number], ['From', (r) => (r.from === 'mac' ? 'Toronto' : 'Sarnia')],
      ['Yard', (r) => (r.yard ? 'yes' : '')], ['Deadhead', (r) => (r.deadhead ? 'yes' : '')], ['Never ran', (r) => (r.gone ? 'yes' : '')],
      ['Turn', (r) => r.turn || ''], ['Working', (r) => (r.as || '').replace(/^working /, '')], ['Crew', (r) => r.crew], ['Worked with', (r) => (r.partners || []).join(' ')],
      ['First plan', (r) => xlTime(r.firstPlan)], ['First order', (r) => xlTime(r.firstOrder)], ['Plan off (min)', (r) => r.offPlan ?? ''], ['Order off (min)', (r) => r.offOrder ?? ''],
      ['Order changes', (r) => r.orderChanges || 0], ['Time on duty (min)', (r) => r.timeOnDuty ?? ''], ['Off duty in Toronto (min)', (r) => r.heldMin ?? ''],
      ['Flag', (r) => r.flag || ''], ['Conductor predicted right', (r) => (r.predHit && r.predHit.co != null ? (r.predHit.co ? 'yes' : 'no') : '')],
      ['Engineer predicted right', (r) => (r.predHit && r.predHit.en != null ? (r.predHit.en ? 'yes' : 'no') : '')]];
    const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [cols.map((c) => c[0]), ...runs.map((r) => cols.map((c) => c[1](r)))].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  // One horizontal railway-clock timeline. Keep the planning block fixed
  // at the baseline expected call; moving plans never rewrite that block.
  function cleanCallRecord(z) {
    const cutoff = T.toMin(z.onDuty);
    const trim = list => (list || []).filter(c => cutoff == null || T.toMin(c.taken) <= cutoff);
    const changes = trim(z.timelineChanges || z.shifts).sort((a,b) => String(a.taken).localeCompare(String(b.taken)));
    const trainKind = t => /^L(501|502)/.exec(t || '')?.[1];
    const actual = trainKind(z.train), predicted = trainKind(z.expectedTrain);
    const trip = t => /^([A-Z]+\d+) (\d{2})$/.exec(t || '');
    const actualTrip = trip(z.train), expectedTrip = trip(z.expectedTrain);
    const wrongDate = actualTrip && expectedTrip && actualTrip[1] === expectedTrip[1] && actualTrip[2] !== expectedTrip[2];
    if ((actual && predicted && actual !== predicted) || wrongDate) {
      const same = changes.filter(c => c.train === z.train);
      if (!same.length) return { ...z, comparisonUnavailable: true, timelineChanges: [], shifts: [] };
      const first = same[0];
      return { ...z, comparisonUnavailable: false, firstSeen: first.taken, firstCall: first.call, expected: first.call, expectedTrain: z.train,
        off: T.toMin(z.call) - T.toMin(first.call), timelineComplete: false, timelineChanges: same, shifts: same };
    }
    return { ...z, timelineChanges: changes, shifts: trim(z.shifts) };
  }
  // The call timeline, tidier (owner, 2026-11-10: a call before the eight-hour
  // window began was a tick beside a red bar that didn't reach it). Red runs
  // from the actual call to the planned call whatever the window; the
  // headline is the notice given; the times sit under their points and in a
  // table with fixed rows; the key lists only what is drawn.
  function renderCallTimelineV2(z, opts = {}) {
    z = cleanCallRecord(z);
    if (z.comparisonUnavailable) return '<p class="anote">Original prediction unavailable: historical train/trip mismatch. Excluded from call comparisons.</p>';
    const m = callTimeline(z);
    if (!m) return '<p class="anote">No saved timeline.</p>';
    const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th','st','nd','rd'][n % 10] || 'th');
    const fmt = t => { const s = T.fromMin(t); return ord(+s.slice(8,10)) + ' ' + s.slice(11); };
    const d = n => { n = Math.round(Math.abs(n)); const h = Math.floor(n/60), mm = n % 60; return h ? `${h} h ${String(mm).padStart(2,'0')} m` : `${mm} m`; };
    const from = m.from, to = m.to, w0 = Math.max(from, m.block.from), exp = m.expected, end = m.end;
    const x = t => 3 + 94 * Math.max(0, Math.min(1, (t-from)/(to-from)));
    const off = !!z.takenOff, gap = end == null ? null : end - exp, called = !off && gap != null;
    const early = called && gap < 0, late = called && gap > 0, notice = end == null ? null : Math.max(0, end - m.first);
    const tone = off ? 'var(--amber)' : !called ? 'var(--soft)' : early ? (gap >= -30 ? 'var(--amber)' : 'var(--stop)') : gap > 30 ? '#a78bfa' : 'var(--go)';
    const head = off ? 'Removed from the line-up' : !called ? 'Call time unavailable' : early ? (notice < 480 ? `Called with ${d(notice)} notice` : `Called ${d(gap)} early`) : late ? `Called ${d(gap)} late` : 'Called at the planned time';
    const expectedNotice = exp > m.first ? `expected ${d(exp - m.first)} notice` : 'first lined at or after the planned call';
    const sub = off ? `Lined up ${d(notice)} before it was removed · ${expectedNotice}` : early ? `${d(gap)} earlier than planned · ${expectedNotice}`
      : called ? `${d(notice)} from first lined to the call · ${m.markers.length} change${m.markers.length === 1 ? '' : 's'} over 30 min` : '';
    const rect = (a, b, fill, y = 34, h = 22) => (x(b) > x(a) ? `<rect x="${x(a)}%" y="${y}" width="${x(b)-x(a)}%" height="${h}" fill="${fill}"/>` : '');
    const key = [];
    const stop = called || off ? end : exp; // where what happened ends
    let bands = '';
    const lined = rect(from, Math.min(w0, stop), 'var(--soft)', 41, 8);
    if (lined) { bands += lined; key.push(['var(--soft)', early && end <= w0 ? 'notice given' : 'lined up before the 8 h window']); }
    if (early || off) {
      const kept = rect(w0, Math.min(end, exp), 'var(--go)');
      if (kept) { bands += kept; key.push(['var(--go)', 'planned 8 h window, before the ' + (off ? 'removal' : 'call')]); }
      if (early) { bands += rect(end, exp, gap >= -30 ? 'var(--amber)' : 'var(--stop)'); key.push([gap >= -30 ? 'var(--amber)' : 'var(--stop)', 'lost to the early call']); }
      if (end < exp && (off || end < w0)) {
        bands += `<rect x="${x(Math.max(w0, off ? end : w0))}%" y="34" width="${x(exp)-x(Math.max(w0, off ? end : w0))}%" height="22" fill="none" stroke="var(--go)" stroke-width="2" stroke-dasharray="5 4"/>`;
        key.push(['dash', off ? 'planned 8 h window, not used' : 'planned 8 h window']);
      }
    } else {
      bands += rect(w0, exp, 'var(--go)'); if (x(exp) > x(w0)) key.push(['var(--go)', 'planned 8 h window']);
      if (late) { bands += rect(exp, end, '#a78bfa'); key.push(['#a78bfa', 'waiting past the plan']); }
    }
    const shown = m.markers.filter(c => c.at <= to);
    const dots = shown.map(c => `<circle cx="${x(c.at)}%" cy="45" r="3.5" fill="var(--ink)" stroke="var(--bg, #1b2227)" stroke-width="1"><title>${e(fmt(c.at))}: call ${e(c.call)}</title></circle>`).join('');
    if (shown.length) key.push(['dot', 'change over 30 min']);
    // A job pulled without a call: a red cross, and the graph carries on.
    // An ordered time that moved: a diamond (the square is when it was first seen ordered).
    const at = (px, inner) => `<svg x="${px}%" y="45" width="1" height="1" overflow="visible">${inner}</svg>`;
    const drops = m.changes.filter(c => c.dropped && c.at <= to);
    const crosses = drops.map(c => at(x(c.at), `<circle r="9" fill="var(--sheet, #1b2227)" stroke="var(--stop)" stroke-width="2"/><path d="M-4.5 -4.5 L4.5 4.5 M4.5 -4.5 L-4.5 4.5" stroke="var(--stop)" stroke-width="2.5" stroke-linecap="round"/><title>${e(c.dropped)} pulled without a call, ${e(fmt(c.at))}</title>`)).join('');
    if (drops.length) key.push(['cross', 'job pulled without a call']);
    const orderMoves = m.changes.filter(c => c.orderFrom && c.at <= to);
    const diamonds = orderMoves.map(c => at(x(c.at), `<path d="M0 -24 L6 -18 L0 -12 L-6 -18 Z" fill="var(--amber)" stroke="var(--sheet, #1b2227)" stroke-width="1"/><title>Ordered time changed ${e(fmt(T.toMin(c.orderFrom) + 0))} → ${e(fmt(T.toMin(c.call)))}, seen ${e(fmt(c.at))}</title>`)).join('');
    if (orderMoves.length) key.push(['diamond', 'ordered time changed']);
    // A spare's job coming off the spare list is the vacancy closing, said as that.
    const notes = drops.map(c => `<p class="ct2-drop">✕ ${c.droppedFrom === 'spare list' ? 'Job closed without a call' : 'Job pulled without a call'}: <b>${e(c.dropped)}</b> came off the ${e(c.droppedFrom || 'line-up')} at ${e(fmt(c.at))}${c.train && c.train !== c.dropped ? `; then lined up for ${e(c.train)}` : ''}.</p>`).join('')
      + orderMoves.map(c => `<p class="ct2-ordermove">◆ Ordered time changed: ${e(fmt(T.toMin(c.orderFrom)))} → <b>${e(fmt(T.toMin(c.call)))}</b>, seen ${e(fmt(c.at))}.</p>`).join('')
      + (off && z.replacedBy ? `<p class="ct2-drop">Now on ${e(z.train)}: <b>${e(z.replacedBy)}</b>${z.replacedWhy ? ` (${e(z.replacedWhy)})` : ''}.${z.ownStatus ? ` ${e(z.turn)} then showed: ${e(z.ownStatus)}.` : ''}</p>` : '')
      + (off && !z.replacedBy && z.jobDropped ? `<p class="ct2-drop">✕ ${e(z.jobDropped)} came off the line-up without being called, and nothing replaced it.</p>` : '');
    const ordered = m.changes.filter(c => c.ordered && c.at <= to);
    const squares = ordered.map(c => `<rect x="${x(c.at)}%" y="25" width="5" height="7" fill="var(--accent)"><title>Ordered, seen ${e(fmt(c.at))}</title></rect>`).join('');
    if (ordered.length) key.push(['var(--accent)', 'ordered (first seen)']);
    // The gap, written in its band when there is room and no dot under it.
    const span = called && gap ? [Math.min(end, exp), Math.max(end, exp)] : null;
    const mid = span ? (span[0] + span[1]) / 2 : 0;
    const clear = span && x(span[1]) - x(span[0]) > 30 && !shown.some(c => Math.abs(x(c.at) - x(mid)) < 16);
    const inside = clear ? `<text x="${x(mid)}%" y="50" text-anchor="middle" fill="#1b2227" style="font:700 12px sans-serif">${e(d(gap))} ${early ? 'early' : 'waiting'}</text>` : '';
    const anchor = t => (x(t) < 18 ? 'start' : x(t) > 82 ? 'end' : 'middle');
    const label = (t, y, text, bold, a) => `<text x="${x(t)}%" y="${y}" text-anchor="${a || anchor(t)}" fill="var(--ink)" style="font:${bold ? '700 ' : ''}12px sans-serif">${e(text)}</text>`;
    const firstName = z.firstFrom === 'offDuty' ? 'Off duty' : 'First lined';
    const under = [[from, firstName, 'start']];
    if (x(w0) - x(from) > 24 && x(exp) - x(w0) > 24) under.push([w0, '8 h before']);
    if (x(exp) - x(from) > 24) under.push([exp, 'Planned call', x(exp) > 70 ? 'end' : 'middle']);
    const below = under.map(([t, name, a]) => `<line x1="${x(t)}%" x2="${x(t)}%" y1="58" y2="64" stroke="var(--soft)"/>${label(t, 78, name, false, a)}${label(t, 93, fmt(t), true, a)}`).join('');
    const mark = end == null ? '' : `<line x1="${x(end)}%" x2="${x(end)}%" y1="22" y2="62" stroke="var(--ink)" stroke-width="3"/>${label(end, 16, (off ? 'Removed ' : 'Called ') + fmt(end), true)}`;
    const shapes = ['dash', 'dot', 'cross', 'diamond'];
    const keyHtml = key.map(([c, text]) => `<span><i class="${shapes.includes(c) ? c : ''}"${shapes.includes(c) ? '' : ` style="background:${c}"`}></i>${e(text)}</span>`).join('');
    const row = (name, value) => `<div><span>${e(name)}</span><b>${e(value)}</b></div>`;
    const facts = row(z.firstFrom === 'offDuty' ? 'Off duty at Toronto' : 'First lined', fmt(m.first)) + row('8 h window starts', fmt(m.block.from)) + row('Planned call', fmt(exp))
      + row(off ? 'Removed' : 'Actual call', end == null ? '—' : fmt(end)) + row(off ? 'Lined up for' : 'Notice given', notice == null ? '—' : d(notice))
      + (called ? row(early ? 'Earlier than planned' : late ? 'Later than planned' : 'Against the plan', gap ? d(gap) : 'on time') : '')
      + (drops.length ? row('Jobs pulled without a call', String(drops.length)) : '') + (orderMoves.length ? row('Ordered time changed', `${orderMoves.length} time${orderMoves.length === 1 ? '' : 's'}`) : '');
    const events = [...m.markers.map(c => ({ at: c.at, text: `Change: ${fmt(c.at)} → call ${c.call.slice(5)}` })), ...m.changes.filter(c => c.ordered).map(c => ({ at: c.at, text: `Ordered observed: ${fmt(c.at)} · call ${c.call.slice(5)}` }))];
    const list = m.changes.map(c => `<li><b>${e(fmt(c.at))}</b> → call <b>${e(c.call.slice(5))}</b>${c.ordered ? ' · ordered' : ''}${c.train ? ` · ${e(c.train)}` : ''}</li>`).join('');
    // The graph alone, for the "how to read it" examples.
    if (opts.bare) return `<div class="call-timeline ct2 ct2-bare"><p class="ct2-head" style="color:${tone}">${e(head)}</p><p class="ct2-sub">${e(sub)}</p>${notes}
      <svg width="100%" height="100" role="img" aria-label="${e(head)}. ${e(sub)}"><line x1="3%" x2="97%" y1="45" y2="45" stroke="var(--soft)"/>${bands}${inside}${dots}${squares}${diamonds}${mark}${below}${crosses}</svg><div class="ct2-key">${keyHtml}</div></div>`;
    return `<details class="call-timeline ct2"><summary>Show call timeline</summary><p class="ct2-who"><b>${e(z.turn)} · ${e(z.train || z.expectedTrain)}</b></p>
      <p class="ct2-head" style="color:${tone}">${e(head)}</p><p class="ct2-sub">${e(sub)}</p>${notes}
      <svg width="100%" height="100" role="img" aria-label="${e(head)}. ${e(sub)}"><line x1="3%" x2="97%" y1="45" y2="45" stroke="var(--soft)"/>${bands}${inside}${dots}${squares}${diamonds}${mark}${below}${crosses}</svg>
      <div class="ct2-key">${keyHtml}</div><div class="ct2-facts">${facts}</div>${renderCallReasons(z)}
      <details><summary>Marker times (${events.length})</summary><ul class="timeline-events">${events.map(c => `<li>${e(c.text)}</li>`).join('') || '<li>No saved marker times.</li>'}</ul></details>
      <details><summary>Recorded changes (${m.changes.length})</summary>${list ? `<ul class="timeline-events">${list}</ul>` : '<p class="anote">No saved changes.</p>'}</details>
      <details><summary>About this timeline</summary><p class="anote">The white bar is the actual call: on duty minus two hours. Green is the eight hours before the planned call. Red (yellow for 30 minutes or less) runs from an early call to the planned call: the time the plan said they still had. A dashed green box is a planned window the call came before. Purple is waiting past the planned call. A red cross is a job pulled without a call (off its line-up, nobody on it, not on the Call Board) in the eight hours before its call; the graph carries on to the job that replaced it. A square is the first check that saw it ordered, a diamond an ordered time that changed. Notice given is from the first check that lined the turn up to the call; out of Toronto it runs from the crew going off duty at the bunkhouse when the train was already on the line-up. Dots mark changes of the expected call over 30 minutes. This measures planning opportunity, not sleep. ${m.complete ? '' : 'Older history may be incomplete.'}</p></details></details>`;
  }
  // Why a call landed where it did (owner, 2026-11-10): for a call more than
  // an hour early or late, or with under 8 h notice, the reasons the tracker
  // saved at each change (lib/board/insights.js whyFor). Nothing is guessed
  // here: a change with no saved reason is listed without one.
  function callReasons(z0) {
    const z = cleanCallRecord(z0);
    if (z.comparisonUnavailable || z.takenOff) return null;
    const m = callTimeline(z);
    if (!m || m.end == null) return null;
    const gap = m.end - m.expected, notice = Math.max(0, m.end - m.first);
    if (!(gap < -60 || gap > 60 || notice < 480)) return null;
    const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th','st','nd','rd'][n % 10] || 'th');
    const fmt = t => { const s = typeof t === 'number' ? T.fromMin(t) : String(t || ''); return /^\d{4}-\d{2}-\d{2} \d{4}$/.test(s) ? ord(+s.slice(8,10)) + ' ' + s.slice(11) : s; };
    const d = n => { n = Math.round(Math.abs(n)); const h = Math.floor(n/60), mm = n % 60; return h ? `${h} h ${String(mm).padStart(2,'0')} m` : `${mm} m`; };
    const lines = [];
    if (notice < 480 || z.firstWhy) lines.push({ at: m.first, text: `${z.firstFrom === 'offDuty' ? 'Off duty, lined up' : 'First lined up'}${z.firstTrain ? ` for ${z.firstTrain}, call ${fmt(z.firstCall)}` : ''}${notice < 480 ? `, only ${d(notice)} before the actual call` : ''}`, why: z.firstWhy || '' });
    let prevCall = T.toMin(z.firstCall), prevTrain = z.firstTrain || null;
    for (const c of m.changes.filter(c => c.at <= m.end)) {
      const call = T.toMin(c.call);
      const moved = prevTrain != null && c.train && c.train !== prevTrain;
      const big = call != null && prevCall != null && Math.abs(call - prevCall) > 30;
      if (c.at > m.first && (moved || big)) lines.push({ at: c.at, text: (c.dropped ? `${c.dropped} was pulled without a call; ` : '') + (moved ? `${c.dropped ? 'moved' : 'Moved'} to ${c.train}, call ${fmt(c.call)}` : `${c.orderFrom ? 'Ordered time' : 'Call'} moved ${fmt(prevCall)} → ${fmt(c.call)}`), why: c.why || '' });
      else if (c.at > m.first && c.dropped) lines.push({ at: c.at, text: `${c.dropped} was pulled without a call`, why: 'nothing replaced it at that check' });
      else if (c.at > m.first && c.orderFrom) lines.push({ at: c.at, text: `Ordered time moved ${fmt(prevCall)} → ${fmt(c.call)}`, why: c.why || '' });
      if (call != null) prevCall = call;
      if (c.train) prevTrain = c.train;
    }
    if (z.calledWhy) lines.push({ at: m.end, text: 'The call', why: z.calledWhy });
    if (gap > 60 && prevCall != null && m.end - prevCall > 60) lines.push({ at: m.end, text: `Still not called ${d(m.end - prevCall)} after the last time it showed`, why: 'the train stayed on the line-up past its call until it was called' });
    const what = gap < -60 ? `Called ${d(gap)} earlier than first planned` : gap > 60 ? `Called ${d(gap)} later than first planned` : `Under 8 h notice (${d(notice)})`;
    return { what, lines: lines.map(l => ({ ...l, when: fmt(l.at) })) };
  }
  function renderCallReasons(z) {
    const r = callReasons(z);
    if (!r) return '';
    const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    const li = l => `<li><b>${e(l.when)}</b> ${e(l.text)}${l.why ? `: <span class="ct2-because">${e(l.why)}</span>` : ''}</li>`;
    // The first lining and the last changes before the call say the most;
    // a long run in between folds away.
    const many = r.lines.length > 6;
    const top = many ? r.lines.slice(0, 1) : r.lines, mid = many ? r.lines.slice(1, -4) : [], end = many ? r.lines.slice(-4) : [];
    return `<div class="ct2-why"><p><b>Why</b> · ${e(r.what)}</p>${r.lines.length ? `<ul>${top.map(li).join('')}</ul>${mid.length ? `<details><summary>${mid.length} changes in between</summary><ul>${mid.map(li).join('')}</ul></details>` : ''}${end.length ? `<ul>${end.map(li).join('')}</ul>` : ''}` : '<p class="anote">No reason was saved for this call.</p>'}</div>`;
  }
  function planReliability(list) {
    const rows = list.map(cleanCallRecord).filter(z => !z.comparisonUnavailable && !z.takenOff && T.toMin(z.firstCall) != null && T.toMin(z.call) != null)
      .map(z => {
        const planned = T.toMin(z.firstCall), actual = T.toMin(z.call);
        let previous = planned, changes = 0;
        for (const c of [...(z.timelineChanges || z.shifts || [])].sort((a,b) => String(a.taken).localeCompare(String(b.taken)))) {
          const next = T.toMin(c.call), at = T.toMin(c.taken);
          if (next == null || at == null) continue;
          if (at >= planned - 480 && at <= planned && Math.abs(next - previous) > 30) changes++;
          previous = next;
        }
        return { ...z, planGap: actual - planned, planLost: Math.min(480, Math.max(0, planned - actual)), planChanges: changes };
      });
    const early = rows.filter(z => z.planGap < 0);
    return { rows, stable: rows.filter(z => Math.abs(z.planGap) <= 30), early: rows.filter(z => z.planGap < -60),
      late: rows.filter(z => z.planGap > 60), earlyAll: early,
      lost: early.length ? early.reduce((a,z) => a + z.planLost, 0) / early.length : null,
      changed: rows.filter(z => z.planChanges > 0), excluded: list.length - rows.length };
  }

  function callTimeline(z) {
    z = cleanCallRecord(z);
    if (z.comparisonUnavailable) return null;
    const expected = T.toMin(z.firstCall || z.expected);
    const first = T.toMin(z.firstSeen);
    if (expected == null || first == null) return null;
    const changes = (z.timelineChanges || z.shifts || []).filter((x) => T.toMin(x.taken) != null && T.toMin(x.call) != null)
      .map((x) => ({ ...x, at: T.toMin(x.taken) })).sort((a, b) => a.at - b.at);
    const end = T.toMin(z.takenOff ? z.onDuty : z.call);
    const block = { from: expected - 480, to: expected };
    // Extend to the actual call inferred from confirmed on-duty history, even
    // when older records have no observed ordering marker.
    const from = first, to = Math.max(expected, !z.takenOff && end != null ? end : expected, ...changes.filter(c => c.ordered).map(c => T.toMin(c.call)));
    let previous = T.toMin(z.firstCall || z.expected);
    const markers = changes.filter(c => {
      const current = T.toMin(c.call), significant = Math.abs(current - previous) > 30;
      previous = current;
      return significant && c.at >= from && c.at <= to;
    });
    return { first, expected, block, end, changes, markers, complete: z.timelineComplete === true, from, to: Math.max(from + 1, to) };
  }

  function renderCallTimeline(z) {
    z = cleanCallRecord(z);
    if (z.comparisonUnavailable) return '<p class="anote">Original prediction unavailable: historical train/trip mismatch. Excluded from call comparisons.</p>';
    // Some older records remained open across later trips. Do not display those changes.
    const cutoff = T.toMin(z.onDuty);
    z = { ...z, timelineChanges: (z.timelineChanges || z.shifts || []).filter(c => cutoff == null || T.toMin(c.taken) <= cutoff) };
    const m = callTimeline(z);
    if (!m) return '<p class="anote">No saved timeline.</p>';
    const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    const fmt = t => { const s = T.fromMin(t); return s.slice(5,10) + ' ' + s.slice(11); };
    const duration = n => `${Math.floor(Math.abs(n)/60)}h ${Math.round(Math.abs(n)%60)}m`;
    const x = t => 4 + 92 * Math.max(0, Math.min(1, (t-m.from)/(m.to-m.from)));
    const gap = m.end == null ? null : m.end-m.expected;
    const result = z.takenOff ? 'Removed from lineup' : gap == null ? 'Call time unavailable' : gap < 0 ? `Called ${duration(gap)} early (short of plan)` : gap > 0 ? `Called ${duration(gap)} past planned time` : 'Called at planned time';
    const visible = m.changes.filter(c => c.at <= m.to);
    const lastChange = visible.filter(c => m.end == null || c.at <= m.end).at(-1);
    const stable = m.end == null ? null : Math.max(0, m.end - (lastChange ? lastChange.at : m.first));
    const elapsed = m.end == null ? null : Math.max(0, m.end - m.first);
    const seenBefore = t => t == null ? 'Unavailable' : t < m.first ? 'First seen after this call time' : duration(t - m.first);
    const leadTimes = `<div class="timeline-facts"><span>Time seen before Original expected call time: <b>${e(seenBefore(m.expected))}</b></span><span>Time seen before actual call time: <b>${z.takenOff ? 'Not called — removed' : e(seenBefore(m.end))}</b></span></div>`;

    const ticks = Array.from({ length: 5 }, (_, i) => {
      const at = m.from + Math.round((m.to-m.from)*i/4);
      const value = fmt(at);
      return `<line x1="${x(at)}%" x2="${x(at)}%" y1="36" y2="42" stroke="var(--soft)"/><text x="${x(at)}%" y="58" text-anchor="${i===0?'start':i===4?'end':'middle'}" fill="var(--ink)" style="font:11px sans-serif"><tspan x="${x(at)}%">${e(value.slice(0,5))}</tspan><tspan x="${x(at)}%" dy="14">${e(value.slice(6))}</tspan></text>`;
    }).join('');
    const rect = (a,b,colour) => `<rect x="${x(a)}%" y="20" width="${Math.max(0,x(b)-x(a))}%" height="16" fill="${colour}"/>`;
    const begin = Math.max(m.from,m.block.from);
    let bands = rect(begin,m.expected,'var(--go)');
    if (!z.takenOff && gap < 0) bands += rect(Math.max(begin,m.end),m.expected,Math.abs(gap)<=30?'var(--amber)':'var(--stop)');
    if (!z.takenOff && gap > 0) bands += rect(m.expected,m.end,'#a78bfa');
    const windowMarks = [{at:m.block.from,label:"Planning window starts"}, {at:m.expected,label:"Planning window ends"}].filter(c => c.at >= m.from && c.at <= m.to).map(c => `<line class="window-boundary" x1="${x(c.at)}%" x2="${x(c.at)}%" y1="8" y2="48" stroke="var(--go)" stroke-width="2"><title>${e(c.label)}: ${e(fmt(c.at))}</title></line>`).join('');
    const markers = m.markers.map(c => `<circle cx="${x(c.at)}%" cy="28" r="4" fill="var(--ink)"><title>${e(fmt(c.at))}: call ${e(c.call)}</title></circle>`).join('');
    const events = [...m.markers.map(c => ({ at: c.at, text: `Change: ${fmt(c.at)} → call ${c.call.slice(5)}` })), ...m.changes.filter(c => c.ordered).map(c => ({ at: c.at, text: `Ordered observed: ${fmt(c.at)} · call ${c.call.slice(5)}` }))];
    const eventLabels = events.map(c => `<li>${e(c.text)}</li>`).join('');
    const orderMarks = m.changes.filter(c => c.ordered && c.at <= m.to).map(c => `<rect x="${x(c.at)}%" y="10" width="5" height="8" fill="var(--accent)"/>`).join('');
    const list = m.changes.map(c => `<li><b>${e(fmt(c.at))}</b> → call <b>${e(c.call.slice(5))}</b>${c.ordered ? ' · ordered' : ''}${c.train ? ` · ${e(c.train)}` : ''}</li>`).join('');
    return `<details class="call-timeline"><summary>Show call timeline</summary><p><b>${e(z.turn)} · ${e(z.train || z.expectedTrain)}</b><br><strong>${e(result)}</strong></p>${leadTimes}
      <div class="timeline-facts"><span>First lined: <b>${e(fmt(m.first))}</b></span><span>Green starts: <b>${e(fmt(m.block.from))}</b></span><span>Original expected call time: <b>${e(fmt(m.expected))}</b></span><span>${z.takenOff ? 'Removed' : 'Actual call time'}: <b>${m.end == null ? '—' : e(fmt(m.end))}</b></span></div>
      <svg width="100%" height="85" role="img" aria-label="${e(result)}; dots mark changes greater than 30 minutes"><line x1="4%" x2="96%" y1="28" y2="28" stroke="var(--soft)"/>${bands}${markers}${orderMarks}${ticks}${windowMarks}${m.end == null ? '' : `<line x1="${x(m.end)}%" x2="${x(m.end)}%" y1="12" y2="44" stroke="var(--ink)" stroke-width="2"/>`}</svg>
      <div class="anote">Green: planned window and boundary bars · Called early: yellow ≤30 min early, red >30 min early · Purple: past expected call until actual call. Actual call: foreground bar. Dots: changes over 30 min · Squares: ordered.</div>
      <details><summary>Marker times (${events.length})</summary><ul class="timeline-events">${eventLabels || '<li>No saved marker times.</li>'}</ul></details>
      <p class="anote">${elapsed == null ? '' : `${duration(elapsed)} from first lined to ${z.takenOff ? 'removal' : 'actual call'} · `}${m.markers.length} changes over 30 min · ${stable == null ? '—' : duration(stable)} since last saved change before call.</p>
      <details><summary>Recorded changes (${m.changes.length})</summary>${list ? `<ul class="timeline-events">${list}</ul>` : '<p class="anote">No saved changes.</p>'}</details>
      <details><summary>About this timeline</summary><p class="anote">Green is the original eight-hour plan. An early call leaves yellow (30 minutes or less early) or red (more than 30 minutes early) through the original expected call (the call-time gap, not measured sleep); purple marks waiting past the original expected call until the actual call, inferred from confirmed on-duty time minus two hours. It ends at the call, not when ordering was first observed or when duty began. Dots mark successive changes over 30 minutes. Actual call time is calculated from on-duty minus two hours; ordering times are first observed, not exact. This measures planning opportunity, not sleep. ${m.complete ? '' : 'Older history may be incomplete.'} ${m.first > m.block.from ? 'Tracking began after the green window started.' : ''}</p></details></details>`;
  }

  // ─── The call card (owner, 2026-11-12) ─────────────────────────────────────
  // "A person should be able to tell at a glance: when they expected to be
  // called, when they were called, how much it moved, how much warning they
  // got, and why it moved if the board shows why. Plain words, no jargon."
  // A test-site preview first; on for every member since he said "Push these
  // changes to the main" the same day (CALL_CARD in board.html).
  // renderCallTimelineV2 above is untouched: it is what the page draws again
  // if that switch is turned off.
  //
  // "Expected" is the eight-hour figure the site has always kept: z.expected,
  // what the board showed at z.sleepAt, the first check with the call 8 h or
  // less away. A call that came before the board ever showed it that close
  // has no such figure and falls back to the first time shown. Neither
  // figure, the call (on duty − 2 h) nor the 30 / 60 minute bands is worked
  // out differently here: only which one leads.
  const CALL_PURPLE = '#a78bfa';
  const ordDay = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const whenWords = (t) => { const s = typeof t === 'number' ? T.fromMin(t) : String(t || ''); return /^\d{4}-\d{2}-\d{2} \d{4}$/.test(s) ? `${ordDay(+s.slice(8, 10))} ${s.slice(11)}` : s; };
  const spanWords = (n) => { n = Math.round(Math.abs(n)); const h = Math.floor(n / 60), mm = n % 60; return h ? (mm ? `${h} h ${String(mm).padStart(2, '0')} m` : `${h} h`) : `${mm} min`; };
  const timesWords = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  // The same job: a line-up sometimes shows a job without its day (DHT130B, then DHT130B 09).
  const jobBase = (t) => String(t || '').replace(/ \d\d$/, '');
  const jobDay = (t) => (/ (\d\d)$/.exec(String(t || '')) || [])[1] || '';
  const sameJob = (a, b) => !!a && !!b && (a === b || (jobBase(a) === jobBase(b) && (!jobDay(a) || !jobDay(b))));

  // One call, worked out once: every word and mark on the card comes from this.
  //
  // opts.rule says how "expected" is worked out:
  //   'eight' (the default, as the site works it out today): z.expected, what the board showed at
  //     z.sleepAt, the first check with the call 8 h or less away.
  //   'before' (the owner's pick, 2026-11-12: "Proposed"; what the page asks for everywhere, callRule in
  //     board.html; 'eight' is kept for the older figures and their tests): what the board was showing 8 hours
  //     before the call came; for a turn lined up later than that, what it showed when lined up. Three
  //     real calls show why it is offered. EN09 on YMXS02 (8 November, the owner's own example): lined
  //     up 1412 for 0205 the next morning, the board flipped to 1500 at 1421 and the call came at 1500;
  //     today's figure is that 1500, so the call reads as on time. SR02 on X39291 05 (7 November): a
  //     0241 that was on the board for 23 minutes became the figure, and a call 1 h 47 m after what the
  //     board had been saying reads as 14 h 29 m late. SB05 on X30241 17 (19 October): 20th 1055 on the
  //     board until the call at 19th 2300; the check ten minutes AFTER the call showed 2300 and became
  //     the figure, so it reads as on time.
  function callCard(z0, opts = {}) {
    const raw = z0 || {};
    const z = cleanCallRecord(raw);
    if (z.comparisonUnavailable) return { unavailable: true, z };
    const m = callTimeline(z);
    if (!m) return null;
    const rule = opts.rule === 'before' ? 'before' : 'eight';
    const off = !!z.takenOff, end = m.end, called = !off && end != null;
    // First seen lined up only after it had gone on duty: nothing was on the board to compare the call
    // with. Most are a later trip's line-up matched to a trip already under way (SD09 on M39671 23: on
    // duty 25th 0400, first seen lined up 25th 1134 for X27331 26), which read as 10 to 23 hours "early".
    if (!off && T.toMin(z.onDuty) != null && m.first > T.toMin(z.onDuty)) return { unscored: true, z, m };
    // The eight-hour figure, on the page's own terms for a recorded baseline (callReviewData in board.html).
    const eightAt = T.toMin(z.sleepAt), eightCall = T.toMin(z.expected);
    const recorded = raw.expectedTrain === z.expectedTrain && !z.noWindow && eightAt != null && eightCall != null;
    const shown = m.expected; // the first time the board gave
    // First seen lined up only after the call time (and before going on duty): the board gave no time
    // before the call, so there is no "expected" to measure against, only no warning.
    const unseen = called && m.first > end;
    let eight = recorded, lead = recorded ? eightCall : shown, asOf = recorded ? Math.max(eightAt, m.first) : m.first;
    if (rule === 'before' && called && !unseen) {
      // Every time the board is known to have shown, in order: the first, each change, and the
      // eight-hour figure itself (older records kept no changes before it).
      const points = [{ at: m.first, call: shown }, ...m.changes.map((ch) => ({ at: ch.at, call: T.toMin(ch.call) }))];
      if (recorded) points.push({ at: Math.max(eightAt, m.first), call: eightCall });
      points.sort((x, y) => x.at - y.at);
      asOf = Math.max(m.first, end - 480);
      for (const pt of points) { if (pt.at > asOf) break; lead = pt.call; }
      eight = m.first <= end - 480; // on the board a full 8 hours before the call
    }
    const gap = called && !unseen ? end - lead : null;
    const notice = end == null ? null : Math.max(0, end - m.first);
    const within = gap != null && Math.abs(gap) <= SLEEP_GREEN;
    const short = called && notice < 480;
    const upto = m.changes.filter((ch) => end == null || ch.at <= end);
    // Moves of the time shown by more than 30 minutes (today's dots), from the first lining on.
    let prev = shown;
    const moves = [];
    for (const ch of upto) { const call = T.toMin(ch.call); if (Math.abs(call - prev) > 30) moves.push({ at: ch.at, from: prev, to: call }); prev = call; }
    const last = prev; // what the board was showing when the call came
    // The ones after "expected" was set: the time moved while it was being counted on.
    let p = lead, after = 0;
    for (const ch of upto) { if (ch.at <= asOf) continue; const call = T.toMin(ch.call); if (Math.abs(call - p) > 30) after++; p = call; }
    const from = m.first, to = Math.max(from + 1, lead, end == null ? lead : end);
    return { z, m, rule, off, called, eight, lead, asOf, shown, end, gap, notice, within, short, unseen, after, moves, last,
      lastMove: moves.length ? moves[moves.length - 1] : null, drops: upto.filter((ch) => ch.dropped), from, to };
  }

  // The headline, and the few words a list row needs. One rule everywhere:
  // under 8 hours' warning leads; within 30 minutes is "when expected".
  function callWords(c) {
    if (!c || c.unavailable) return null;
    if (c.unscored) return { head: 'Not scored', tone: 'var(--soft)', moved: '', warning: '', result: 'not scored', resultTone: '' };
    const { off, called, gap, notice, within, short, after } = c;
    const moved = gap == null ? '' : gap === 0 ? 'right on time' : `${spanWords(gap)} ${gap < 0 ? 'earlier' : 'later'}`;
    const warning = short ? (notice < 1 ? 'no warning' : `${spanWords(notice)} warning`) : '';
    if (off) return { head: 'Taken off before the call', tone: 'var(--amber)', moved, warning, result: 'taken off before the call', resultTone: 'warn' };
    if (!called) return { head: 'Call time not known', tone: 'var(--soft)', moved, warning, result: '', resultTone: '' };
    if (c.unseen) return { head: 'Called with no warning', tone: 'var(--stop)', moved: '', warning, result: '', resultTone: '' };
    const result = within ? 'when expected' : moved;
    const resultTone = within ? 'ok' : gap < 0 ? (gap >= -SLEEP_YELLOW ? 'warn' : 'bad') : 'late';
    const head = short ? `Called with ${warning}`
      : within ? `Called when expected${after ? `, after ${after === 1 ? '1 change' : `${after} changes`}` : ''}`
        : `Called ${spanWords(gap)} ${gap < 0 ? 'earlier' : 'later'} than expected`;
    const tone = short ? 'var(--stop)' : within ? 'var(--go)' : gap < 0 ? 'var(--stop)' : CALL_PURPLE;
    return { head, tone, moved, warning, result, resultTone };
  }

  // What the board was saying at the end.
  function callLastWord(c) {
    if (!c || c.unavailable || c.unscored || !c.called || c.unseen) return '';
    if (Math.abs(c.end - c.last) > 30) return `the board still showed ${whenWords(c.last)} when the call came`;
    if (c.lastMove && c.end - c.lastMove.at < 480) return c.end - c.lastMove.at < 1 ? 'the time changed as the call came' : `the time last changed ${spanWords(c.end - c.lastMove.at)} before the call`;
    return '';
  }

  // "Called for X, not the Y they were lined up for; T was lined up for it, now on Z" (lib/board/insights.js).
  function calledFor(z) {
    const w = /^Called for (.+?)(?:, working (\S+))?, not the (.+?) they were lined up for(?:; (\S+) was lined up for it(.*))?$/.exec(String(z.calledWhy || ''));
    return w ? { train: w[1], working: w[2] || '', lined: w[3], had: w[4] || '', hadThen: w[5] || '', same: sameJob(w[1], w[3]) } : null;
  }

  // Why, in a sentence or two, from what the tracker saved at each change.
  // Nothing is guessed: a part with nothing saved for it is left out.
  function callWhy(c) {
    if (!c || c.unavailable || c.unscored) return '';
    const { z, m, off, end, notice, short } = c;
    const out = [];
    if (off) {
      if (z.ownStatus) out.push(`${z.turn} then showed: ${z.ownStatus}.`);
      // The other craft on a 501/502 was on the job all along: not a replacement.
      const mate = !!z.replacedBy && String(z.replacedBy).replace(/-(CO|EN)$/, '') === String(z.turn).replace(/-(CO|EN)$/, '');
      if (z.replacedBy && !mate) out.push(`${z.replacedBy} was lined up for ${z.train || 'the job'} instead${z.replacedWhy ? ` (${z.replacedWhy})` : ''}.`);
      else if (z.jobDropped) out.push(`${z.jobDropped} came off the line-up without being called, and nothing replaced it.`);
      return out.join(' ');
    }
    if (end == null) return '';
    const firstTrain = z.firstTrain || z.expectedTrain || z.train || '';
    const other = calledFor(z);
    if (c.unseen) {
      if (z.train && firstTrain && !sameJob(z.train, firstTrain)) out.push(`Called for ${z.train}, which the board had not shown for this turn.`);
      if (other && other.working) out.push(`Filled in for ${other.working}.`);
      return out.join(' ');
    }
    // Short warning: how the job first showed, when the tracker saved it.
    if (short) {
      const w = String(z.firstWhy || '');
      const had = /^(\S+) had it before(?:, now on ([^;:]+))?(?:: ([^;]+))?/.exec(w);
      const ago = `${spanWords(notice)} before the call`;
      const first = z.firstFrom === 'offDuty' ? `Went off duty at Toronto ${ago}, with the train already on the line-up.`
        : /first showed going spare/.test(w) ? `The job first showed as going spare ${ago}.`
          : /first showed on the (\w+ )?line-up/.test(w) ? `The train first showed on the line-up ${ago}.`
            : had ? `Lined up in place of ${had[1]}${had[2] ? `, who was moved to ${had[2].trim()}` : had[3] ? ` (${had[3].trim()})` : ''}, ${ago}.` : '';
      if (first) out.push(first);
    }
    if (other && other.working) out.push(`Filled in for ${other.working}.`);
    // The trains it was moved between and the time moving on its own, up to
    // the call: since "expected" was set, or since it was lined up when the
    // whole wait was under 8 hours. What the board did after the call (an
    // ordered train leaving the line-up) is not part of why.
    const since = short ? m.first : c.asOf;
    let cur = firstTrain;
    if (!short && c.rule === 'before') { for (const ch of m.changes) { if (ch.at > since) break; if (ch.train) cur = ch.train; } }
    else if (!short && c.eight) cur = z.expectedTrain || firstTrain;
    const path = [cur];
    let own = 0, ownOrdered = 0, small = 0, lastOwn = null, lastHop = null, p = short ? c.shown : c.lead, pulledMoves = 0;
    const pulledOnly = [];
    for (const ch of m.changes) {
      if (ch.at <= since || ch.at > end) continue;
      const hop = !!ch.train && !sameJob(ch.train, cur);
      if (hop) { path.push(ch.train); lastHop = ch.at; if (ch.dropped) pulledMoves++; } else if (ch.dropped) pulledOnly.push(ch);
      if (ch.train) cur = ch.train;
      const call = T.toMin(ch.call);
      if (!hop) { if (Math.abs(call - p) > 30) { own++; lastOwn = ch.at; if (ch.orderFrom) ownOrdered++; } else if (call !== p) small++; }
      p = call;
    }
    for (const ch of pulledOnly) out.push(`${ch.dropped} ${ch.droppedFrom === 'spare list' ? 'closed' : 'was pulled'} without a call.`);
    const hops = path.length - 1;
    const pulled = pulledMoves ? ` (${pulledMoves === 1 ? 'one job was' : `${pulledMoves} jobs were`} pulled without a call)` : '';
    const ago = (at, max) => (at == null || end - at > max ? '' : end - at < 1 ? ' as the call came' : ` ${spanWords(end - at)} before the call`);
    if (hops === 1) out.push(pulledMoves ? `${path[0]} was pulled without a call; moved to ${path[1]}${ago(lastHop, 480)}.` : `Moved from ${path[0]} to ${path[1]}${ago(lastHop, 480)}.`);
    else if (hops > 1) out.push(`Moved between trains ${timesWords(hops)}${sameJob(path[0], path[hops]) ? `, ending back on ${path[hops]}` : `: first ${path[0]}, last ${path[hops]}`}${pulled}${ago(lastHop, 120) ? `, the last move${ago(lastHop, 120)}` : ''}.`);
    // Called for a job the board was not showing for this turn when the call came.
    if (z.train && cur && !sameJob(z.train, cur)) out.push(`Called for ${z.train}; the board was still showing ${cur}${other && !other.same && other.had ? ` (${other.had} had been lined up for it)` : ''}.`);
    if (own) out.push(`${hops ? 'Its time also moved' : 'The time moved'} ${timesWords(own)}${ownOrdered ? ` (${ownOrdered === own ? '' : `${timesWords(ownOrdered)} `}after it was ordered)` : ''}${ago(lastOwn, 120) ? `, the last${ago(lastOwn, 120)}` : ''}.`);
    else if (small && !hops && Math.abs(c.gap) > 30) out.push(`The time moved ${timesWords(small)}, by 30 minutes or less each time.`);
    if (end - p > 30) out.push(`${out.length ? 'Then it' : 'It'} stayed on the line-up ${spanWords(end - p)} past its time before the call came.`);
    if (!out.length && Math.abs(c.gap) > 30) out.push('The board showed no change before the call.');
    return out.join(' ');
  }

  // Everything the board showed for this call, in order, each with the reason the tracker saved.
  function callStory(c) {
    if (!c || c.unavailable || c.unscored) return [];
    const { z, m, end, off } = c;
    const lines = [];
    const firstTrain = z.firstTrain || '';
    lines.push({ at: m.first, text: `${z.firstFrom === 'offDuty' ? 'Off duty at Toronto, lined up' : 'First lined up'}${firstTrain ? ` for ${firstTrain}` : ''}${T.toMin(z.firstCall) != null ? `, call ${whenWords(z.firstCall)}` : ''}`, why: z.firstWhy || '' });
    let prevCall = T.toMin(z.firstCall || z.expected), prevTrain = firstTrain || z.expectedTrain || '', prevOrdered = false;
    for (const ch of m.changes) {
      const call = T.toMin(ch.call);
      const hop = !!ch.train && !!prevTrain && !sameJob(ch.train, prevTrain);
      const parts = [];
      if (ch.dropped) parts.push(`${ch.dropped} ${ch.droppedFrom === 'spare list' ? 'closed' : 'was pulled'} without a call`);
      if (hop) parts.push(`moved to ${ch.train}, call ${whenWords(ch.call)}`);
      else if (call !== prevCall) parts.push(`${ch.orderFrom ? 'ordered time' : 'call'} moved ${whenWords(prevCall)} → ${whenWords(ch.call)}`);
      else if (ch.ordered && !prevOrdered) parts.push(`ordered, call ${whenWords(ch.call)}`);
      if (ch.ordered && !prevOrdered && parts.length && !/^ordered/.test(parts[parts.length - 1])) parts.push('ordered');
      if (!parts.length) parts.push(`call ${whenWords(ch.call)}`);
      const text = parts.join('; ');
      if (ch.at > m.first || ch.dropped || hop || call !== prevCall) lines.push({ at: ch.at, text: text.charAt(0).toUpperCase() + text.slice(1), why: ch.why || '' });
      prevCall = call; if (ch.train) prevTrain = ch.train; prevOrdered = prevOrdered || !!ch.ordered;
    }
    if (end != null) {
      const other = calledFor(z);
      const why = off ? callWhy(c) : !other ? (z.calledWhy || '') : !other.same ? z.calledWhy
        : [other.working ? `working ${other.working}` : '', other.had ? `${other.had} was lined up for it${other.hadThen}` : ''].filter(Boolean).join('; ');
      lines.push({ at: end, text: off ? 'Taken off the line-up' : `Called${z.train ? ` for ${z.train}` : ''}${T.toMin(z.onDuty) != null ? ` (on duty ${whenWords(z.onDuty)}, less 2 hours)` : ''}`, why, end: true });
    }
    return lines.map((l, i) => ({ ...l, i })).sort((a, b) => a.at - b.at || a.i - b.i).map(({ i, ...l }) => ({ ...l, when: whenWords(l.at) }));
  }

  // The picture: lined up → expected → called, with the words on it.
  function callPicture(c) {
    const { z, m, lead, end, off, called, gap } = c;
    const W = 360, L = 8, R = 8, Y = 46; // room at each end for the ring round "expected"
    const from = c.from, to = c.to, first = m.first;
    const x = (t) => L + (W - L - R) * Math.max(0, Math.min(1, (t - from) / (to - from)));
    const f1 = (n) => n.toFixed(1);
    const past = lead < first; // the expected time had gone by before the turn showed on the board
    const w0 = Math.max(first, lead - 480);
    const early = called && gap < 0, late = called && gap > 0;
    const rect = (a, b, fill, y, h) => (x(b) - x(a) > 0.5 ? `<rect x="${f1(x(a))}" y="${y}" width="${f1(x(b) - x(a))}" height="${h}" fill="${fill}"></rect>` : '');
    let g = `<line x1="${L}" x2="${W - R}" y1="${Y}" y2="${Y}" stroke="var(--rule)" stroke-width="1"></line>`;
    const stop = called || off ? end : lead; // where what happened ends
    let green = false, dashed = false;
    g += rect(first, past ? stop : Math.min(w0, stop), 'var(--soft)', Y - 3, 6);
    // No eight hours and no waiting are drawn before the turn was on the board.
    if (!past) {
      if (early || off) {
        const kept = rect(w0, Math.min(end, lead), 'var(--go)', Y - 10, 20);
        g += kept; green = !!kept;
        if (early) g += rect(end, lead, gap >= -30 ? 'var(--amber)' : 'var(--stop)', Y - 10, 20);
        if (end < lead && (off || end < w0)) {
          const a = Math.max(w0, off ? end : w0);
          if (x(lead) - x(a) > 2) { g += `<rect x="${f1(x(a))}" y="${Y - 10}" width="${f1(x(lead) - x(a))}" height="20" fill="none" stroke="var(--go)" stroke-width="1.5" stroke-dasharray="4 3"></rect>`; dashed = true; }
        }
      } else {
        const kept = rect(w0, lead, 'var(--go)', Y - 10, 20);
        g += kept; green = !!kept;
        if (late) g += rect(lead, end, CALL_PURPLE, Y - 10, 20);
      }
    }
    // Changes of more than 30 minutes: small dots, counted in words underneath.
    const dots = c.moves.filter((mv) => mv.at >= from && mv.at <= to);
    // How far it moved, written in its band when there is room and no dot under the words.
    if (called && gap && !past) {
      const a = Math.min(end, lead), b = Math.max(end, lead);
      const text = `${spanWords(gap)} ${early ? 'earlier' : 'later'}`;
      const half = text.length * 3.3 + 4, mid = (x(a) + x(b)) / 2;
      if (x(b) - x(a) > half * 2 + 4 && !dots.some((mv) => Math.abs(x(mv.at) - mid) < half + 3)) g += `<text x="${f1(mid)}" y="${Y + 4}" text-anchor="middle" class="cc-in">${escHtml(text)}</text>`;
    }
    g += dots.map((mv) => `<circle cx="${f1(x(mv.at))}" cy="${Y}" r="2.6" fill="var(--ink)" stroke="var(--sheet, #fff)" stroke-width="1"></circle>`).join('');
    const drops = c.drops.filter((ch) => ch.at >= from && ch.at <= to);
    g += drops.map((ch) => `<g transform="translate(${f1(x(ch.at))} ${Y})"><circle r="8" fill="var(--sheet, #fff)" stroke="var(--stop)" stroke-width="2"></circle><path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="var(--stop)" stroke-width="2.4" stroke-linecap="round"></path></g>`).join('');
    // The moments, named on the picture. Two labels under the line never sit
    // on each other: the second drops to a row of its own when they would.
    const est = (t) => t.length * 6.1;
    const side = (px) => (px < 70 ? 'start' : px > W - 70 ? 'end' : 'middle');
    const below = [{ t: first, l1: z.firstFrom === 'offDuty' ? 'Off duty' : 'Lined up', l2: whenWords(first) }];
    if (lead >= from && lead <= to && Math.abs(x(lead) - x(first)) > 4) below.push({ t: lead, l1: 'Expected', l2: whenWords(lead), ring: true });
    for (const b of below) b.a = side(x(b.t));
    const box = (b) => { const w = Math.max(est(b.l1), est(b.l2) + 4), px = x(b.t); return b.a === 'start' ? [px, px + w] : b.a === 'end' ? [px - w, px] : [px - w / 2, px + w / 2]; };
    let row2 = false;
    if (below.length === 2) { const a = box(below[0]), b = box(below[1]); row2 = Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > -8; }
    g += below.map((b, i) => {
      const yy = Y + 26 + (row2 && i === 1 ? 27 : 0), px = f1(x(b.t));
      return `<line x1="${px}" x2="${px}" y1="${Y + 11}" y2="${yy - 9}" stroke="var(--soft)" stroke-width="1"></line>`
        + (b.ring ? `<circle cx="${px}" cy="${Y}" r="5" fill="var(--sheet, #fff)" stroke="var(--ink)" stroke-width="2"></circle>` : '')
        + `<text x="${px}" y="${yy}" text-anchor="${b.a}" class="cc-l1">${escHtml(b.l1)}</text><text x="${px}" y="${yy + 13}" text-anchor="${b.a}" class="cc-l2">${escHtml(b.l2)}</text>`;
    }).join('');
    if (end != null) {
      const px = x(end), a = px < 80 ? 'start' : px > W - 80 ? 'end' : 'middle';
      g += `<line x1="${f1(px)}" x2="${f1(px)}" y1="${Y - 16}" y2="${Y + 14}" stroke="var(--ink)" stroke-width="3"></line>`
        + `<text x="${f1(px)}" y="${Y - 21}" text-anchor="${a}" class="cc-l2">${escHtml(`${off ? 'Taken off' : 'Called'} ${whenWords(end)}`)}</text>`;
    }
    const cap = [];
    if (green) cap.push('<span><i style="background:var(--go)"></i>the 8 hours before the expected time</span>');
    if (dashed) cap.push(`<span><i class="cc-dash"></i>${off ? 'the rest of those 8 hours, not used' : 'those 8 hours, gone to the early call'}</span>`);
    if (dots.length) {
      const late8 = c.asOf > c.from ? dots.filter((mv) => mv.at > c.asOf).length : dots.length;
      cap.push(`<span><i class="cc-dot"></i>the time changed (${timesWords(dots.length)}${late8 && late8 < dots.length ? `, ${late8} of them in the last 8 hours` : late8 === 0 ? ', all before the last 8 hours' : ''})</span>`);
    }
    if (drops.length) cap.push('<span><i class="cc-x"></i>job pulled without a call</span>');
    if (past) cap.push(`<span>The expected time (${escHtml(whenWords(lead))}) had already passed when the turn was lined up.</span>`);
    const label = `${z.firstFrom === 'offDuty' ? 'Off duty' : 'Lined up'} ${whenWords(first)}, expected ${whenWords(lead)}${end != null ? `, ${off ? 'taken off' : 'called'} ${whenWords(end)}` : ''}`;
    return `<svg class="cc-svg" viewBox="0 0 ${W} ${104 + (row2 ? 27 : 0)}" role="img" aria-label="${escHtml(label)}">${g}</svg>${cap.length ? `<p class="cc-cap">${cap.join('')}</p>` : ''}`;
  }

  // The card. opts.bare: the block and the picture only (the "how to read" example).
  // opts.who === false: no turn and train line (the row above already says them).
  function renderCallCard(z0, opts = {}) {
    const c = callCard(z0, opts);
    if (c && c.unavailable) return '<p class="anote">This call can’t be compared: the line-up that was saved was for a different trip of the same train.</p>';
    if (!c) return '<p class="anote">No saved history for this call.</p>';
    const { z, m, off, end, notice } = c;
    const e = escHtml;
    if (c.unscored) {
      return `<div class="callcard">${opts.who === false ? '' : `<p class="cc-who">${e(z.turn)} · ${e(z.train || z.expectedTrain)}</p>`}<p class="cc-head" style="color:var(--soft)">Not scored</p>`
        + `<p class="cc-note">The board first showed ${e(z.turn)} lined up at ${e(whenWords(m.first))}${z.firstTrain && !sameJob(z.firstTrain, z.train) ? ` (for ${e(z.firstTrain)})` : ''}, after it had already gone on duty at ${e(whenWords(z.onDuty))}. There was nothing on the board to compare this call with.</p></div>`;
    }
    const w = callWords(c);
    const offDuty = z.firstFrom === 'offDuty';
    const row = (k, v, notes, cls) => `<div${cls ? ` class="${cls}"` : ''}><dt>${k}</dt><dd>${v ? `<b>${e(v)}</b>` : ''}${notes.filter(Boolean).map((s) => `<small>${e(s)}</small>`).join('')}</dd></div>`;
    const ahead = c.lead - c.asOf;
    const far = ahead >= 450 ? '' : ahead > 0 ? `, ${spanWords(ahead)} ahead` : ', already past';
    const lined = `the time on the board when ${offDuty ? 'going off duty' : 'lined up'}`;
    const how = c.rule === 'before' && !off ? (c.eight ? 'what the board showed 8 hours before the call' : `${lined}, ${spanWords(notice)} before the call`)
      : !c.eight ? 'the first time the board gave' : end != null && !off && c.asOf > end ? `on the board only from ${whenWords(c.asOf)}, after the call`
        : ahead >= 450 ? 'the time on the board 8 hours ahead' : c.asOf <= m.first ? `${lined}${far}` : `on the board at ${whenWords(c.asOf)}${far}`;
    const lw = callLastWord(c);
    const why = callWhy(c);
    const within = c.within && c.gap ? `${w.moved} (30 min either way counts as expected)` : w.moved;
    const firstJob = z.firstTrain || z.expectedTrain || '';
    const facts = (c.unseen ? '' : row('Expected', whenWords(c.lead), [how, c.asOf > m.first && Math.abs(c.shown - c.lead) > 30 ? `first shown as ${whenWords(c.shown)}` : '']))
      + (off ? row('Taken off', whenWords(end), [`after ${spanWords(notice)} on the line-up`]) : row('Called', end == null ? '—' : whenWords(end), [within]))
      + (off || end == null ? '' : c.unseen ? row('Warning', 'none', [`first seen on a line-up ${whenWords(m.first)}${firstJob && !sameJob(firstJob, z.train) ? ` (for ${firstJob})` : ''}, after the call`])
        : row('Warning', spanWords(notice), [`from ${offDuty ? 'going off duty at Toronto' : 'being lined up'}, ${whenWords(m.first)}`, lw]))
      + (why ? `<div class="cc-why"><dt>Why</dt><dd>${e(why)}</dd></div>` : off ? '<div class="cc-why"><dt>Why</dt><dd>The board did not show a reason.</dd></div>' : '');
    const head = `${opts.who === false || opts.bare ? '' : `<p class="cc-who">${e(z.turn)} · ${e(z.train || z.expectedTrain)}</p>`}${w.tone === CALL_PURPLE ? '<p class="cc-head cc-late">' : `<p class="cc-head" style="color:${w.tone}">`}${e(w.head)}</p><dl class="cc-facts">${facts}</dl>${c.unseen ? '' : callPicture(c)}`;
    if (opts.bare) return `<div class="callcard cc-bare">${head}</div>`;
    const story = callStory(c);
    const li = (l) => `<li><b>${e(l.when)}</b> ${e(l.text)}${l.why ? `<span class="cc-because">${e(l.why)}</span>` : ''}</li>`;
    const n = m.changes.length;
    const method = c.unseen ? `Called is on duty less 2 hours: the phone call itself is not recorded. The first check that showed ${z.turn} on a line-up was after that time, so there was no time on the board to expect and no warning to count. The board is read every few minutes, so the line-up can have gone up a few minutes before it was seen.`
      : `Called is on duty less 2 hours: the phone call itself is not recorded. Expected is ${c.rule === 'before' && !off ? (c.eight ? `what the board was showing at ${whenWords(c.asOf)}, 8 hours before the call came` : 'the time the board was showing when the turn was lined up, less than 8 hours before the call')
        : c.eight ? (c.asOf <= m.first ? 'the time the board was showing when the turn was lined up, already 8 hours or less away' : `the time the board was showing at ${whenWords(c.asOf)}, the first check with the call 8 hours or less away`) : 'the first time the board gave, because the call came before the board had shown it 8 hours or less away'}. `
      + `Warning runs from ${offDuty ? 'going off duty at the Toronto bunkhouse, with the train already on the line-up,' : 'the first check that showed the turn lined up'} to the call. A call within 30 minutes of expected counts as called when expected. Green on the picture is the 8 hours before the expected time; a dot is a change of more than 30 minutes. `
      + `The board is read every few minutes, so a time here can be a few minutes later than it really changed.${m.complete ? '' : ' Older history may be incomplete.'}`;
    return `<div class="callcard">${head}<div class="cc-more"><details><summary>${n ? `Every change the board showed (${n})` : 'What the board showed'}</summary><ul class="cc-story">${story.map(li).join('')}</ul></details>`
      + `<details class="cc-how"><summary><i>i</i>How this is worked out</summary><p>${e(method)}</p></details></div></div>`;
  }

  // The counts for a list of calls, each against the same "expected" its card shows.
  function callSummary(list, opts = {}) {
    const c5 = [0, 0, 0, 0, 0];
    let n = 0, short = 0, takenOff = 0, excluded = 0, unscored = 0, noBoard = 0, movedOk = 0, noEight = 0, earlier = 0, later = 0;
    const early = [];
    for (const z0 of list) {
      const c = callCard(z0, opts);
      if (c && c.off) { takenOff++; continue; }
      if (c && c.unscored) { unscored++; continue; }
      if (c && c.unseen) { noBoard++; short++; continue; }
      if (!c || c.unavailable || c.gap == null) { excluded++; continue; }
      n++;
      const g = c.gap;
      c5[g < -60 ? 0 : g < -30 ? 1 : g <= 30 ? 2 : g <= 60 ? 3 : 4]++;
      if (c.short) short++;
      if (!c.eight) noEight++;
      if (c.within && c.after) movedOk++;
      if (g < -30) { earlier++; early.push(-g); } else if (g > 30) later++;
    }
    early.sort((a, b) => a - b);
    // n: calls with a time on the board to measure against. calls: those and the ones with nothing on the board first.
    return { n, calls: n + noBoard, c: c5, ok: c5[2], warn: c5[1] + c5[3], bad: c5[0] + c5[4], earlier, later, short, takenOff, excluded, unscored, noBoard, movedOk, noEight,
      typicalEarly: early.length ? early[Math.floor((early.length - 1) / 2)] : null };
  }
  // One line per turn, the most "more than an hour off" first (as sleepByTurn sorts).
  function callSummaryByTurn(list, opts = {}) {
    const by = new Map();
    for (const z of list) { if (!by.has(z.turn)) by.set(z.turn, []); by.get(z.turn).push(z); }
    return [...by.entries()].map(([turn, l]) => ({ turn, ...callSummary(l, opts) }))
      .sort((a, b) => (b.n ? b.bad / b.n : 0) - (a.n ? a.bad / a.n : 0) || b.n - a.n || (a.turn < b.turn ? -1 : 1));
  }

  const api = { cleanCallRecord, planReliability, callTimeline, renderCallTimeline, trainMatches, kindOf, numberOf, poolOf, runOf, trainRuns, indexTrains, newestFirst, workRuns, timeOfDay, stats, WEEKDAYS,
    inRange, byHour, byWeek, whenSummary, everyDay, between, turnRow, byNumber, accuracyByDay, predLead, runaroundStats, spareJobStats, csv, SEQ_POOLS,
    renderCallTimelineV2, callReasons, renderCallReasons, sleepBand, sleepStats, sleepByTurn, SLEEP_GREEN, SLEEP_YELLOW, joinOld,
    callCard, callWords, callLastWord, callWhy, callStory, renderCallCard, callSummary, callSummaryByTurn, callSpan: spanWords };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BoardAnalytics = api;
})(this);
