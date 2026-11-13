// Yardmaster Call Order: the logic. Pure functions, shared by the page and its tests.
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
  // conductor / yard work under 4.16, or engineer work (the manual leaves engineers to the canvass).
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
  function shiftsAround(code, iso) {
    const out = [];
    for (const k of [-1, 0, 1]) {
      const d = addDays(iso, k);
      const w = workOn(code, d);
      if (w) { const s = toMin(d, w.start); out.push({ s, e: s + w.hours * 60, job: w.job }); }
    }
    return out;
  }

  const GROUPS = {
    spare: 'Spare yardmaster', regular: 'Regular yardmaster', c416: 'Working under 4.16 (conductor or yard)',
    other: 'Another agreement (5.1)', engineer: 'Working as a locomotive engineer', any: 'Canvass: anyone on the list', none: 'No current job',
  };
  const STATUS = { available: 'Available', off: 'Off', vacation: 'Vacation', busy: 'Not available' };

  // The steps of the Sarnia calling manual (2011), "Relief – Yardmasters". Not yet confirmed.
  function manualRules() {
    return {
      leadMin: 120, gapH: 8, ownShifts: true, groupBy: 'now', groupOverride: {},
      steps: [
        { group: 'spare', need: 'call', pay: 'straight', on: true },
        { group: 'spare', need: 'start', pay: 'straight', on: true },
        { group: 'regular', need: 'call', pay: 'ot', on: true },
        { group: 'regular', need: 'start', pay: 'ot', on: true },
        { group: 'c416', need: 'call', pay: 'ot', on: true },
        { group: 'c416', need: 'start', pay: 'ot', on: true },
        { group: 'other', need: 'call', pay: 'ot', on: true },
        { group: 'other', need: 'start', pay: 'ot', on: true },
        { group: 'engineer', need: 'call', pay: 'ot', on: false },
        { group: 'any', need: 'start', pay: 'ot', on: true },
      ],
    };
  }
  const stepLabel = (st, rules) => `${GROUPS[st.group]} · ${st.need === 'call' ? `${(rules.leadMin / 60).toString().replace(/\.0$/, '')}-hour call` : 'on-time relief'} · ${st.pay === 'straight' ? 'straight time' : 'time and a half'}`;

  // New scenario facts: CATS's statuses of 13 Nov (OFF and VACATION: not available).
  function catsFacts(people) {
    const f = {};
    for (const p of people) f[p.rank] = { status: p.cats === 'OFF' ? 'off' : p.cats === 'VACATION' ? 'vacation' : 'available', now: '', freeAt: '' };
    return f;
  }

  // What the rules need, worked out once per scenario.
  function prepare(sc, people) {
    const start = toMin(sc.date, sc.start);
    const end = start + Math.round((+sc.hours || 0) * 60);
    const job = String(sc.job || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const jobTurn = (parseCode(job) || {}).turn || job;
    const rows = people.map((p) => {
      const f = (sc.facts || {})[p.rank] || {};
      const now = f.now ? String(f.now).toUpperCase() : p.perm;
      const pp = parseCode(p.perm); const pn = parseCode(now);
      return {
        p, status: f.status || 'available', now, moved: !!f.now && (!pn || !pp || pn.turn !== pp.turn || pn.craft !== pp.craft),
        gNow: groupOf(now), gPerm: groupOf(p.perm), freeAt: fromLocal(f.freeAt), shifts: shiftsAround(now, sc.date),
        holder: (!!pp && pp.craft === 'YA' && pp.turn === jobTurn) || (!!f.now && !!pn && pn.turn === jobTurn),
      };
    });
    const ya = YA_JOBS[jobTurn];
    return { sc, start, end, job: jobTurn, rows, runs: ya ? ya.runs(sc.date) : null };
  }

  // Down the list, step by step: who could take it at each step and, for everyone else, why not.
  function evaluate(prep, rules) {
    const { start, end } = prep;
    const call = start - rules.leadMin;
    const gap = rules.gapH * 60;
    const groupOfRow = (r) => (rules.groupOverride && rules.groupOverride[r.p.rank]) || (rules.groupBy === 'perm' ? r.gPerm : r.gNow);
    const why = (r, need) => {
      if (r.holder) return 'holds this job';
      if (r.status !== 'available') return STATUS[r.status].toLowerCase();
      if (rules.ownShifts) {
        const o = r.shifts.find((x) => x.s < end + gap && x.e > start - gap);
        if (o) return `works ${o.job} ${fmt(o.s)}–${hhmmOf(o.e)}`;
      }
      const by = need === 'call' ? call : start;
      if (r.freeAt != null && r.freeAt > by) return `not free until ${fmt(r.freeAt)}`;
      return '';
    };
    const steps = [];
    const order = [];
    rules.steps.forEach((st, i) => {
      if (!st.on) return;
      const inStep = prep.rows.filter((r) => { const g = groupOfRow(r); return st.group === 'any' || g === st.group || (st.group === 'c416' && g === 'none'); })
        .sort((a, b) => a.p.rank - b.p.rank);
      const rows = inStep.map((r) => ({ r, why: why(r, st.need), group: groupOfRow(r) }));
      for (const x of rows) if (!x.why && !order.some((o) => o.r === x.r)) order.push({ r: x.r, st, i });
      steps.push({ st, i, rows });
    });
    return { start, end, call, steps, order, pick: order.length ? order[0] : null };
  }
  const decide = (sc, rules, people) => evaluate(prepare(sc, people), rules);

  // --- Fitting the rules to the examples -------------------------------------------------
  const clone = (x) => JSON.parse(JSON.stringify(x));
  function permute(a) { if (a.length <= 1) return [a]; const out = []; a.forEach((x, i) => { for (const rest of permute([...a.slice(0, i), ...a.slice(i + 1)])) out.push([x, ...rest]); }); return out; }
  function buildRules(base, v) {
    const pay = (g) => (g === 'spare' ? 'straight' : 'ot');
    const groups = [...v.order];
    if (v.eng) groups.splice(groups.indexOf('c416') + 1, 0, 'engineer');
    const steps = v.layout === 'pairs'
      ? groups.flatMap((g) => [{ group: g, need: 'call', pay: pay(g), on: true }, { group: g, need: 'start', pay: pay(g), on: true }])
      : [...groups.map((g) => ({ group: g, need: 'call', pay: pay(g), on: true })), ...groups.map((g) => ({ group: g, need: 'start', pay: pay(g), on: true }))];
    steps.push({ group: 'any', need: 'start', pay: 'ot', on: true });
    return { ...clone(base), leadMin: v.leadMin, gapH: v.gapH, ownShifts: v.ownShifts, groupBy: v.groupBy, steps, _v: v };
  }
  // A short fingerprint of what a rule set does, to count how far two are apart.
  function shape(rules) {
    const on = rules.steps.filter((s) => s.on);
    return { steps: on.map((s) => `${s.group}/${s.need}`).join(','), gapH: rules.ownShifts ? rules.gapH : '-', leadMin: rules.leadMin, ownShifts: rules.ownShifts, groupBy: rules.groupBy };
  }
  function distance(a, b) { const x = shape(a); const y = shape(b); return Object.keys(x).filter((k) => x[k] !== y[k]).length; }
  const expectedOf = (ex) => (ex.expected ? +ex.expected : 0);
  const picked = (res) => (res.pick ? res.pick.r.p.rank : 0);
  function score(rules, preps) { let ok = 0; for (const { prep, ex } of preps) if (picked(evaluate(prep, rules)) === expectedOf(ex)) ok++; return ok; }
  function fit(examples, people, current, { top = 3 } = {}) {
    const preps = examples.map((ex) => ({ ex, prep: prepare(ex.sc, people) }));
    const seen = new Set();
    const found = [];
    for (const order of permute(['spare', 'regular', 'c416', 'other'])) for (const layout of ['pairs', 'callsFirst']) for (const ownShifts of [true, false])
      for (const gapH of (ownShifts ? [0, 4, 8, 10, 12] : [current.gapH])) for (const leadMin of [60, 120]) for (const eng of [false, true]) for (const groupBy of ['now', 'perm']) {
        const r = buildRules(current, { order, layout, gapH, leadMin, ownShifts, eng, groupBy });
        const key = JSON.stringify(shape(r));
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ rules: r, score: score(r, preps), distance: distance(r, current) });
      }
    found.sort((a, b) => b.score - a.score || a.distance - b.distance);
    return { tried: found.length, best: found.slice(0, top), current: score(current, preps), total: preps.length };
  }
  function describe(rules) {
    const on = rules.steps.filter((s) => s.on);
    const order = [];
    for (const s of on) if (s.group !== 'any' && !order.includes(s.group)) order.push(s.group);
    const name = { spare: 'spare YM', regular: 'regular YM', c416: '4.16', other: '5.1', engineer: 'engineers' };
    const real = on.filter((s) => s.group !== 'any');
    const firstStart = real.findIndex((s) => s.need === 'start');
    const callsFirst = firstStart > -1 && !real.slice(firstStart).some((s) => s.need === 'call');
    const call = `${String(rules.leadMin / 60).replace(/\.0$/, '')}-hour call`;
    return [
      `Order: ${order.map((g) => name[g]).join(' → ')}${on.some((s) => s.group === 'any') ? ' → canvass' : ''}`,
      firstStart < 0 ? `only ${call}s, no on-time relief steps` : callsFirst && order.length > 1 ? `every ${call} before any on-time relief` : `${call}, then on-time relief, group by group`,
      `call ${rules.leadMin / 60} h before the start`,
      rules.ownShifts ? `${rules.gapH} h needed between their own shift and this one` : 'own shifts not checked',
      rules.groupBy === 'perm' ? 'called by their permanent job' : 'called by the job they work at call time',
    ];
  }

  const api = { DAYS, toMin, fmt, hhmmOf, dowOf, addDays, fromLocal, towerOn, YA_JOBS, YARD, RELIEF, parseCode, groupOf, workOn, shiftsAround, GROUPS, STATUS, manualRules, stepLabel, catsFacts, prepare, evaluate, decide, fit, describe, distance, shape, clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.YM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
