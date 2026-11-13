// Yardmaster Call Order: the logic. Pure functions, shared by the page and its tests.
// The page (docs/board-checker/yardmaster/call-order-page.template.html) embeds this file.
(function (root) {
  'use strict';
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const pad = (n) => String(n).padStart(2, '0');
  // Railway local time as minutes, built from the local fields (no zone can shift it).
  const toMin = (iso, hhmm) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), +String(hhmm).slice(0, 2), +String(hhmm).slice(2, 4)) / 60000;
  const isoOf = (min) => new Date(min * 60000).toISOString().slice(0, 10);
  const addDays = (iso, n) => isoOf(toMin(iso, '0000') + n * 1440);
  const dowOf = (iso) => DAYS[(new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7];
  const hhmmOf = (min) => { const d = new Date(min * 60000); return pad(d.getUTCHours()) + pad(d.getUTCMinutes()); };
  const ord = (n) => n + ((n >= 11 && n <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
  const fmt = (min) => { const d = new Date(min * 60000); return `${DAYS[(d.getUTCDay() + 6) % 7]} ${ord(d.getUTCDate())} ${hhmmOf(min)}`; };
  const fromLocal = (s) => { const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(s || ''); return m ? toMin(m[1], m[2] + m[3]) : null; };
  // The work week starts Monday 0001 (Article 56.15).
  function weekStartOf(min) {
    const iso = isoOf(min);
    let ws = toMin(addDays(iso, -DAYS.indexOf(dowOf(iso))), '0001');
    if (ws > min) ws -= 7 * 1440;
    return ws;
  }

  // The tower (YSBY, 12 h): YSBY01 and YSBY02 work the same days, YSBY03 and YSBY04 the
  // others, 2-2-3 over two weeks; week A started Monday 26 Oct 2026 (read off the board checks).
  const TOWER = { anchor: '2026-10-26', weekA: 'AABBAAA' };
  function towerOn(iso) {
    const n = Math.round((toMin(iso, '0000') - toMin(TOWER.anchor, '0000')) / 1440);
    const i = ((n % 14) + 14) % 14;
    const inA = TOWER.weekA[i % 7] === 'A';
    return (i < 7) === inA ? 'a' : 'b';
  }
  const weekdays = (iso) => !['Sat', 'Sun'].includes(dowOf(iso));
  const YA_JOBS = {
    YSTY01: { start: '0630', hours: 8, runs: weekdays, label: 'Tower S/S', rota: 'Mon to Fri' },
    YSBY01: { start: '0700', hours: 12, runs: (d) => towerOn(d) === 'a', label: 'YDM Block 1', rota: 'tower A days' },
    YSBY02: { start: '1900', hours: 12, runs: (d) => towerOn(d) === 'a', label: 'YDM Block 2', rota: 'tower A days' },
    YSBY03: { start: '0700', hours: 12, runs: (d) => towerOn(d) === 'b', label: 'YDM Block 3', rota: 'tower B days' },
    YSBY04: { start: '1900', hours: 12, runs: (d) => towerOn(d) === 'b', label: 'YDM Block 4', rota: 'tower B days' },
    YSBY06: { start: '1430', hours: 12, runs: weekdays, label: 'S/S Temp YA', rota: 'Mon to Fri' },
  };
  // Yard jobs, their regular crews' days off and the relief jobs (the site's Job Aids, from the checks).
  const YARD = [
    ['YEBS03', '0600', 8], ['YSTY01', '0630', 8, { off: ['Sat', 'Sun'] }], ['YPRS02', '0645', 8], ['YBHS01', '0800', 8],
    ['YFLS01', '0800', 8, { off: ['Sun'] }], ['YSBY06', '1430', 12, { off: ['Sat', 'Sun'] }], ['YPRS30', '1445', 8], ['YMPS31', '1500', 8],
    ['YINS30', '1530', 8, { off: ['Sat', 'Sun'] }], ['YBHS31', '1600', 8], ['YEBS30', '1600', 8], ['YPRS60', '2245', 8],
    ['YBHS60', '2300', 8], ['YINS60', '2330', 8], ['YFLS60', '2359', 8], ['YMPS60', '2359', 8],
  ];
  const RUNS_AS = { YEBS04: { job: 'YEBS03', start: '0700' }, YBHS61: { job: 'YBHS60', start: '2300' } };
  const RELIEF = [
    ['XSAS01', ['Thu', 'Fri'], { Mon: 'YPRS02', Tue: 'YPRS02', Wed: 'YPRS30', Sat: 'YBHS01', Sun: 'YBHS01' }],
    ['XSAS02', ['Tue', 'Wed'], { Mon: 'YFLS60', Thu: 'YPRS30', Fri: 'YPRS60', Sat: 'YPRS60', Sun: 'YFLS60' }],
    ['XSAS03', ['Mon', 'Tue'], { Wed: 'YBHS31', Thu: 'YBHS31', Fri: 'YBHS60', Sat: 'YINS60', Sun: 'YINS60' }],
    ['XSAS04', ['Thu', 'Fri'], { Mon: 'YEBS30', Tue: 'YMPS31', Wed: 'YMPS31', Sat: 'YFLS01', Sun: 'YEBS30' }],
    ['XSAS05', ['Tue', 'Wed'], { Mon: 'YMPS60', Thu: 'YEBS04', Fri: 'YEBS04', Sat: 'YBHS61', Sun: 'YMPS60' }],
  ];
  function yardOff(job) {
    const set = new Set();
    for (const [, , week] of RELIEF) for (const d of DAYS) { const w = week[d]; if (w && (w === job || (RUNS_AS[w] && RUNS_AS[w].job === job))) set.add(d); }
    const j = YARD.find((x) => x[0] === job);
    for (const d of ((j && j[3] && j[3].off) || [])) set.add(d);
    return set;
  }

  // "SDSD01EN" -> { pool: 'SD', turn: 'SD01', craft: 'EN' }; "YSBY01YA", "YPRS60 FO", "SD05", "B123" too.
  function parseCode(code) {
    const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!c) return null;
    let asg = c; let craft = '';
    if (/^[A-Z0-9]{6}(YA|EN|LE|ET|CO|FO|S1|TT)$/.test(c)) { asg = c.slice(0, 6); craft = c.slice(6); }
    let pool = ''; let turn = asg;
    if (asg.length === 6 && !/^[YX]/.test(asg)) { pool = asg.slice(0, 2); turn = asg.slice(2); }
    return { code: c, pool, turn, craft };
  }
  // How someone would be called, from a job: the yardmaster spare, a regular yardmaster job,
  // conductor or yard work under 4.16, or engineer work (canvass only: owner, a hard rule).
  function groupOf(code) {
    const p = parseCode(code);
    if (!p) return 'none';
    const t = p.turn; const cr = p.craft;
    if (cr === 'YA') return (p.pool === 'EX' || /^YA\d\d$/.test(t)) ? 'spare' : 'regular';
    if (/^(EN|LE|ET)$/.test(cr)) return 'engineer';
    if (/^(CO|FO|S1|TT)$/.test(cr)) return 'c416';
    if (/^YS(BY|TY)\d\d$/.test(t)) return 'regular';
    if (/^YA\d\d$/.test(t)) return 'spare';
    if (/^(EN\d\d|SD\d\d|S[13]\d\d)$/.test(t)) return 'engineer';
    return 'c416';
  }
  // Conductor work in the yard (a yard or relief job), as against on the road.
  function inYard(code) {
    const p = parseCode(code);
    if (!p) return false;
    return /^(FO|S1|TT|YA)$/.test(p.craft) || /^Y[A-Z]{3}\d\d$/.test(p.turn) || /^XSAS\d\d$/.test(p.turn);
  }
  // Whether a job keeps a schedule the page knows (YA, yard and relief jobs).
  function scheduled(code) {
    const p = parseCode(code);
    if (!p) return false;
    return !!YA_JOBS[p.turn] || YARD.some((j) => j[0] === p.turn) || RELIEF.some((r) => r[0] === p.turn);
  }
  // The job someone with this job works on a day, if known: { job, start, hours } or null.
  function workOn(code, iso) {
    const p = parseCode(code);
    if (!p) return null;
    const t = p.turn; const day = dowOf(iso);
    const ya = YA_JOBS[t];
    if (ya) return ya.runs(iso) ? { job: t, start: ya.start, hours: ya.hours } : null;
    const yj = YARD.find((j) => j[0] === t);
    if (yj) return yardOff(t).has(day) ? null : { job: t, start: yj[1], hours: yj[2] };
    const rel = RELIEF.find((r) => r[0] === t);
    if (rel) {
      if (rel[1].includes(day)) return null;
      const w = rel[2][day];
      if (!w) return null;
      const st = RUNS_AS[w] ? RUNS_AS[w].start : (YARD.find((j) => j[0] === w) || [])[1];
      return st ? { job: w, start: st, hours: 8 } : null;
    }
    return null; // pool and spare turns: not known from here
  }
  function shiftsOver(code, iso, from, to) {
    const out = [];
    for (let k = from; k <= to; k++) {
      const d = addDays(iso, k);
      const w = workOn(code, d);
      if (w) { const s = toMin(d, w.start); out.push({ s, e: s + w.hours * 60, job: w.job }); }
    }
    return out;
  }
  const shiftsAround = (code, iso) => shiftsOver(code, iso, -1, 1);

  const GROUPS = {
    spare: 'Spare yardmaster', yard: 'Working in the yard (4.16)', regular: 'Regular yardmaster', c416: 'Working under 4.16 (conductor)',
    other: 'Another agreement (5.1)', engineer: 'Working as a locomotive engineer', any: 'Canvass', none: 'No current job',
  };
  const STATUS = { available: 'Available', off: 'Off', vacation: 'Vacation', busy: 'Not available' };

  // The starting rules: the Sarnia calling manual's steps (2011, "Relief – Yardmasters"), with
  // the owner's rules of 13 Nov 2026 ("We book our rest so if someone is on rest when the call
  // is made they are skipped"; the overtime rule "is correct"; engineers: "this is a hard rule
  // so it only goes to the conductors in the yard first"; and, of the regular yardmasters on
  // their rest day, "these 3 wouldnt get it first sicne they will get paid overtime, it will goto
  // someone in the yard making straight time first").
  function startingRules() {
    return {
      leadMin: 120, gapH: 8, ownShifts: true, groupBy: 'now', groupOverride: {},
      restSkips: true, otRule: true, otGapH: 8, otWeek: 5, c416Scope: 'all',
      steps: [
        { group: 'spare', need: 'call', pay: 'straight', on: true },
        { group: 'spare', need: 'start', pay: 'straight', on: true },
        { group: 'yard', need: 'call', pay: 'straight', on: true },
        { group: 'yard', need: 'start', pay: 'straight', on: true },
        { group: 'regular', need: 'call', pay: 'ot', on: true },
        { group: 'regular', need: 'start', pay: 'ot', on: true },
        { group: 'c416', need: 'call', pay: 'ot', on: true },
        { group: 'c416', need: 'start', pay: 'ot', on: true },
        { group: 'other', need: 'call', pay: 'ot', on: true },
        { group: 'other', need: 'start', pay: 'ot', on: true },
        { group: 'any', need: 'start', pay: 'ot', on: true },
      ],
    };
  }
  // Every rule set in one shape: settings filled in, no engineer step (engineers are reached only
  // in the canvass), and the canvass always last.
  function normalize(r) {
    const base = startingRules();
    const out = { ...base, ...(r || {}) };
    const given = Array.isArray(out.steps) ? out.steps : base.steps;
    const canvass = given.find((s) => s.group === 'any') || base.steps[base.steps.length - 1];
    out.steps = [...given.filter((s) => s.group !== 'any' && s.group !== 'engineer').map((s) => ({ group: s.group, need: s.need, pay: s.pay, on: s.on !== false })),
      { group: 'any', need: 'start', pay: 'ot', on: canvass.on !== false }];
    out.groupOverride = { ...(out.groupOverride || {}) };
    delete out._v;
    return out;
  }
  const callWords = (rules) => `${String(rules.leadMin / 60).replace(/\.0$/, '')}-hour call`;
  const stepLabel = (st, rules) => (st.group === 'any'
    ? 'Canvass: anyone on the list, in seniority order, engineers last'
    : `${GROUPS[st.group]} · ${st.need === 'call' ? callWords(rules) : 'on-time relief'} · ${st.pay === 'straight' ? 'straight time' : 'time and a half'}`);

  // New scenario facts: CATS's statuses of 13 Nov (OFF and VACATION: not available).
  function catsFacts(people) {
    const f = {};
    for (const p of people) f[p.rank] = { status: p.cats === 'OFF' ? 'off' : p.cats === 'VACATION' ? 'vacation' : 'available', now: '', freeAt: '', lastYard: '', week: '' };
    return f;
  }

  // What the rules need, worked out once per scenario.
  function prepare(sc, people) {
    const start = toMin(sc.date, sc.start);
    const end = start + Math.round((+sc.hours || 0) * 60);
    const job = String(sc.job || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const jobTurn = (parseCode(job) || {}).turn || job;
    const wk = weekStartOf(start);
    const rows = people.map((p) => {
      const f = (sc.facts || {})[p.rank] || {};
      const now = f.now ? String(f.now).toUpperCase() : p.perm;
      const pp = parseCode(p.perm); const pn = parseCode(now);
      // Their own yard shifts in the week before this one, from their job's schedule.
      const known = scheduled(now);
      const past = known ? shiftsOver(now, sc.date, -7, 0).filter((x) => x.s < start) : [];
      const ended = past.filter((x) => x.e <= start).map((x) => x.e);
      const lastSched = ended.length ? Math.max(...ended) : null;
      const weekSched = known ? past.filter((x) => x.s >= wk).length : null;
      const lastIn = fromLocal(f.lastYard);
      const weekIn = f.week === '' || f.week == null || Number.isNaN(+f.week) ? null : +f.week;
      return {
        p, status: f.status || 'available', now, moved: !!f.now && (!pn || !pp || pn.turn !== pp.turn || pn.craft !== pp.craft),
        gNow: groupOf(now), gPerm: groupOf(p.perm), yardNow: inYard(now), yardPerm: inYard(p.perm), freeAt: fromLocal(f.freeAt), shifts: shiftsAround(now, sc.date),
        holder: (!!pp && pp.craft === 'YA' && pp.turn === jobTurn) || (!!f.now && !!pn && pn.turn === jobTurn),
        lastSched, weekSched, lastEnd: lastIn != null ? lastIn : lastSched, weekCount: weekIn != null ? weekIn : weekSched,
      };
    });
    const ya = YA_JOBS[jobTurn];
    // "is anyone avaiable on the spareboard" yes or no (owner, 13 Nov): no, and the spare steps find nobody.
    return { sc, start, end, job: jobTurn, rows, runs: ya ? ya.runs(sc.date) : null, spareOff: String(sc.spareboard || 'yes') === 'no' };
  }

  // Down the list, step by step: who could take it at each step and, for everyone else, why not.
  function evaluate(prep, rulesIn) {
    const rules = normalize(rulesIn);
    const { start, end } = prep;
    const call = start - rules.leadMin;
    const gap = rules.gapH * 60;
    const groupOfRow = (r) => (rules.groupOverride && rules.groupOverride[r.p.rank]) || (rules.groupBy === 'perm' ? r.gPerm : r.gNow);
    const yardOf = (r) => (rules.groupBy === 'perm' ? r.yardPerm : r.yardNow);
    const isEng = (r) => (groupOfRow(r) === 'engineer' ? 1 : 0);
    // Overtime (Articles 34.3 and 56.15): under 8 h from their last yard shift, or past 5
    // straight-time yard shifts in the work week. Passed over at straight-time steps.
    const otWhy = (r) => {
      if (!rules.otRule) return '';
      if (r.lastEnd != null && start - r.lastEnd < rules.otGapH * 60) return `would be on overtime: last yard shift ended ${fmt(r.lastEnd)}, under ${rules.otGapH} h before`;
      if (r.weekCount != null && r.weekCount >= rules.otWeek) return `would be on overtime: yard shift ${r.weekCount + 1} this week`;
      return '';
    };
    const why = (r, st) => {
      if (r.holder) return 'holds this job';
      if (prep.spareOff && groupOfRow(r) === 'spare') return 'nobody available on the spareboard';
      if (r.status !== 'available') return STATUS[r.status].toLowerCase();
      if (rules.restSkips && r.freeAt != null && r.freeAt > call) return `on rest until ${fmt(r.freeAt)} when the call is made`;
      if (rules.ownShifts) {
        const o = r.shifts.find((x) => x.s < end + gap && x.e > start - gap);
        if (o) return `works ${o.job} ${fmt(o.s)}–${hhmmOf(o.e)}`;
      }
      const by = st.need === 'call' ? call : start;
      if (r.freeAt != null && r.freeAt > by) return `not free until ${fmt(r.freeAt)}`;
      if (st.pay === 'straight') { const ot = otWhy(r); if (ot) return ot; }
      return '';
    };
    const inStep = (st, r) => {
      if (st.group === 'any') return true;
      const g = groupOfRow(r);
      if (g === 'engineer') return false; // engineers: the canvass only (owner: "a hard rule")
      if (st.group === 'yard') return g === 'c416' && yardOf(r); // conductors on a yard or relief job
      if (st.group === 'c416') return (g === 'c416' || g === 'none') && (rules.c416Scope !== 'yard' || yardOf(r));
      return g === st.group;
    };
    const steps = [];
    const order = [];
    rules.steps.forEach((st, i) => {
      if (!st.on) return;
      const rows = prep.rows.filter((r) => inStep(st, r))
        .sort((a, b) => (st.group === 'any' ? isEng(a) - isEng(b) : 0) || a.p.rank - b.p.rank)
        .map((r) => ({ r, why: why(r, st), group: groupOfRow(r) }));
      for (const x of rows) if (!x.why && !order.some((o) => o.r === x.r)) order.push({ r: x.r, st, i });
      steps.push({ st, i, rows });
    });
    return { start, end, call, steps, order, pick: order.length ? order[0] : null, rules };
  }
  const decide = (sc, rules, people) => evaluate(prepare(sc, people), rules);

  // --- Fitting the rules to the examples -------------------------------------------------
  const clone = (x) => JSON.parse(JSON.stringify(x));
  function permute(a) { if (a.length <= 1) return [a]; const out = []; a.forEach((x, i) => { for (const rest of permute([...a.slice(0, i), ...a.slice(i + 1)])) out.push([x, ...rest]); }); return out; }
  // The owner's own rules (rest, overtime, engineers, the call lead) stay as they are, and the
  // spare yardmaster stays first; the search tries the order of the other groups, the call /
  // on-time layout, the own-shift check and its hours, and whether the 4.16 step takes road
  // conductors.
  function buildRules(base, v) {
    const b = normalize(base);
    const pay = (g) => (g === 'spare' || g === 'yard' ? 'straight' : 'ot');
    const steps = v.layout === 'pairs'
      ? v.order.flatMap((g) => [{ group: g, need: 'call', pay: pay(g), on: true }, { group: g, need: 'start', pay: pay(g), on: true }])
      : [...v.order.map((g) => ({ group: g, need: 'call', pay: pay(g), on: true })), ...v.order.map((g) => ({ group: g, need: 'start', pay: pay(g), on: true }))];
    steps.push(b.steps[b.steps.length - 1]);
    return normalize({ ...b, gapH: v.gapH, ownShifts: v.ownShifts, c416Scope: v.c416Scope, steps });
  }
  // A short fingerprint of what a rule set does, to count how far two are apart.
  function shape(rulesIn) {
    const rules = normalize(rulesIn);
    const on = rules.steps.filter((s) => s.on);
    return {
      steps: on.map((s) => `${s.group}/${s.need}/${s.pay}`).join(','), gapH: rules.ownShifts ? rules.gapH : '-', leadMin: rules.leadMin, ownShifts: rules.ownShifts,
      groupBy: rules.groupBy, restSkips: rules.restSkips, ot: rules.otRule ? `${rules.otGapH}/${rules.otWeek}` : '-', c416Scope: rules.c416Scope,
      over: JSON.stringify(rules.groupOverride),
    };
  }
  function distance(a, b) { const x = shape(a); const y = shape(b); return Object.keys(x).filter((k) => x[k] !== y[k]).length; }
  // Whether a saved check still agrees with what the rules say now. A check holds the call order
  // as it was (`order`, ranks), the owner's or a yardmaster's Yes / No beside the people in it
  // (`marks`), anyone missing from it (`missing`) and who should get it first (`expected`: a
  // rank, 0 for nobody, null when not said). It agrees when everyone marked Yes is still called,
  // in the same order among themselves; everyone marked No is no longer in the same spot (the
  // people ahead of them changed, or they drop out); anyone missing is now called; and the first
  // is the one chosen. -> { ok, fails: [{ kind, rank | got, want }] }
  function agrees(ex, res) {
    const now = res.order.map((o) => o.r.p.rank);
    const at = (rk) => now.indexOf(+rk);
    const was = (ex.order || []).map(Number);
    const markOf = (rk) => (ex.marks || {})[rk];
    const yes = was.filter((rk) => markOf(rk) === 'yes');
    const fails = [];
    for (const rk of yes) if (at(rk) < 0) fails.push({ kind: 'gone', rank: rk });
    const kept = yes.filter((rk) => at(rk) >= 0);
    if ([...kept].sort((a, b) => at(a) - at(b)).join() !== kept.join()) fails.push({ kind: 'order' });
    const setOf = (list) => [...list].sort((a, b) => a - b).join();
    for (const rk of was.filter((r) => markOf(r) === 'no')) {
      if (at(rk) < 0) continue;
      if (setOf(was.slice(0, was.indexOf(rk))) === setOf(now.slice(0, at(rk)))) fails.push({ kind: 'still', rank: rk });
    }
    for (const m of ex.missing || []) if (m && at(m.rank) < 0) fails.push({ kind: 'missing', rank: +m.rank });
    if (ex.expected != null && ex.expected !== '') {
      const got = now.length ? now[0] : 0;
      if (got !== +ex.expected) fails.push({ kind: 'first', got, want: +ex.expected });
    }
    return { ok: fails.length === 0, fails };
  }
  function score(rules, preps) { let ok = 0; for (const { prep, ex } of preps) if (agrees(ex, evaluate(prep, rules)).ok) ok++; return ok; }
  function fit(examples, people, current, { top = 3 } = {}) {
    const preps = examples.map((ex) => ({ ex, prep: prepare(ex.sc, people) }));
    const seen = new Set();
    const found = [];
    for (const rest of permute(['yard', 'regular', 'c416', 'other'])) for (const layout of ['pairs', 'callsFirst']) for (const ownShifts of [true, false])
      for (const gapH of (ownShifts ? [0, 4, 8, 10, 12] : [normalize(current).gapH])) for (const c416Scope of ['all', 'yard']) {
        const r = buildRules(current, { order: ['spare', ...rest], layout, gapH, ownShifts, c416Scope });
        const key = JSON.stringify(shape(r));
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ rules: r, score: score(r, preps), distance: distance(r, current) });
      }
    found.sort((a, b) => b.score - a.score || a.distance - b.distance);
    return { tried: found.length, best: found.slice(0, top), current: score(current, preps), total: preps.length };
  }
  // The rules in words, one line each (the same lines in the same order for every rule set).
  function describe(rulesIn) {
    const rules = normalize(rulesIn);
    const on = rules.steps.filter((s) => s.on);
    const order = [];
    for (const s of on) if (s.group !== 'any' && !order.includes(s.group)) order.push(s.group);
    const name = { spare: 'spare YM', yard: 'yard at straight time', regular: 'regular YM', c416: '4.16', other: '5.1' };
    const real = on.filter((s) => s.group !== 'any');
    const firstStart = real.findIndex((s) => s.need === 'start');
    const callsFirst = firstStart > -1 && !real.slice(firstStart).some((s) => s.need === 'call');
    const call = callWords(rules);
    return [
      `Order: ${order.map((g) => name[g] || g).join(' → ')}${on.some((s) => s.group === 'any') ? ' → canvass (engineers last)' : ''}`,
      firstStart < 0 ? `only ${call}s, no on-time relief steps` : callsFirst && order.length > 1 ? `every ${call} before any on-time relief` : `${call}, then on-time relief, group by group`,
      `call ${rules.leadMin / 60} h before the start`,
      rules.restSkips ? 'on rest when the call is made: skipped' : 'on rest when the call is made: may still relieve on time',
      rules.otRule ? `straight-time steps pass over anyone on overtime (under ${rules.otGapH} h since their last yard shift, or past ${rules.otWeek} yard shifts this week)` : 'overtime not checked',
      rules.c416Scope === 'yard' ? '4.16 time-and-a-half step: conductors in the yard only (road conductors in the canvass)' : '4.16 time-and-a-half step: conductors in the yard and on the road',
      rules.ownShifts ? `${rules.gapH} h needed between their own shift and this one` : 'own shifts not checked',
      rules.groupBy === 'perm' ? 'called by their permanent job' : 'called by the job they work at call time',
    ];
  }

  const api = {
    DAYS, toMin, fmt, hhmmOf, dowOf, addDays, fromLocal, weekStartOf, towerOn, YA_JOBS, YARD, RELIEF, parseCode, groupOf, inYard, scheduled, workOn, shiftsAround,
    GROUPS, STATUS, startingRules, manualRules: startingRules, normalize, stepLabel, catsFacts, prepare, evaluate, decide, agrees, fit, describe, distance, shape, clone,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.YM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
