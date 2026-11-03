// For the Analytics tab (owner, 2026-10-26): what the trains list doesn't
// already keep, gathered from the site's snapshots as they're built.
//   runarounds: trains shown out of sequence (engine rule 'pool': "ordered
//               for A but the sequence says B"), once per train: every
//               stretch of checks it showed wrong, then the crew that went on
//               duty and whether it was still wrong at the end (owner,
//               2026-10-26: "track the times it's showing wrong, then the
//               actual crew on the train")
//   spareJobs:  each job going spare (option 5), when it was first and last
//               listed, who was expected to fill it and who did (a spare
//               person on the Call Board working that job's turn)
//   catsMissing: the other CATS option 5 mistake (owner, 2026-11-03): a job
//               the order says goes spare (the line-up's "(goes spare") that
//               option 5 doesn't list; counted once it's been missing 30 min
//               (CATS is often a little slow), with whether CATS listed it
//               later and the crew that went
//   catsErrors: CATS's option 5 listing a train's job under a turn the order
//               doesn't have on it (owner, 2026-11-02: E27861 02's conductor
//               listed as SA09 while the order had SR05): once per train,
//               craft and wrong turn: first and last seen, whether CATS
//               fixed it before the train went, and the crew that went
//   stale:      trains still planned (not ordered) past the call worked out
//               from their plan (owner, 2026-11-02: "how long it sits
//               stale"): each stretch past the call (paused when the plan
//               moves later and the call is ahead again), counted once 15
//               min past; how it ended (ordered, gone, still stale), plan
//               moves, the crew lined up, the crew that went
//   runLog:     the runaround log (owner, 2026-11-02, all boards): when a
//               train goes on duty, each craft's crew against the order
//               the site worked out at the last check before (the line-up's
//               turn, the spare expected to fill a job going spare, the
//               Toronto bunkhouse crew, a yard job's spare). Someone else
//               went → likely (the passed-over turn was free), possible
//               (the order was old) or explained (on rest, a hold turn,
//               working, went on another train)
//   sleep:      for each turn, the expected call when it first came within
//               8 h (when they'd go to sleep), every change to it after that,
//               and the actual call (on duty − 2 h) when they went, or
//               `takenOff` when they were taken off the line-up first
// Feed snapshots oldest first; call again with more to carry on.
const BoardTrains = require('../../public/board-trains');

// Gone from the list this long and listed again: a new vacancy (a yard job
// going spare every morning is one a day, not one long one).
const SAME_JOB_MIN = 3 * 60;
const FILL_WITHIN = 48 * 60; // a fill-in this long after the vacancy still counts
// Sleep tracker (owner, 2026-10-26): once the call is 8 h away they go to
// sleep; how far the real call landed from the one they slept on.
const SLEEP_MIN = 8 * 60;
const CALL_LEAD = 120; // called 2 h before on duty (config.callLeadMinutes)
const DROP_AFTER = 24 * 60; // a turn gone from every screen this long: forget its wait
// Taken off the line-up after going to sleep (owner, 2026-10-26, option A):
// that wait ends there, counted on its own, and the next line-up starts a
// new one. Taken off = the train they slept on is still listed with someone
// else, or the turn has been on no line-up for this long (not on duty).
const TAKEN_OFF_MIN = 4 * 60;

function collect(snapshots, state = {}) {
  const min = BoardTrains.toMin;
  state.runarounds ||= {};
  state.spareJobs ||= {};
  const latest = state.latestJob || (state.latestJob = {}); // job id → its newest entry key
  const byTurn = state.jobByTurn || (state.jobByTurn = {}); // job's turn → its newest entry key
  for (const s of snapshots) {
    // The latest check decides whether it's a runaround: out of sequence,
    // then counted right (crew changed, road day recounted) is "fixed".
    for (const e of [...(s.sequence || []), ...(s.sequenceAhead || [])]) {
      if (!e.actual || !e.expected || e.actual === 'MU' || !/^\S+ \d{1,2}$/.test(e.train || '')) continue;
      const key = BoardTrains.trainKey(e.train, s.taken);
      let r = state.runarounds[key];
      const wrong = e.actual !== e.expected;
      if (!r && !wrong) continue;
      if (!r) r = state.runarounds[key] = { train: e.train, taken: s.taken, order: e.order, stretches: [] };
      if (wrong) {
        const st = r.stretches[r.stretches.length - 1];
        if (st && st.to === r.last && st.expected === e.expected && st.actual === e.actual && st.turn === (e.turn || '')) Object.assign(st, { to: s.taken, checks: st.checks + 1 });
        else r.stretches.push({ from: s.taken, to: s.taken, checks: 1, expected: e.expected, actual: e.actual, turn: e.turn || '' });
        // What it showed while wrong (the latest wrong values).
        Object.assign(r, { expected: e.expected, actual: e.actual, turn: e.turn || '', lastWrong: s.taken });
      }
      Object.assign(r, { last: s.taken, out: wrong, final: { expected: e.expected, actual: e.actual, turn: e.turn || '' }, order: e.order || r.order });
    }
    // The crew that actually went (Call Board).
    for (const t of s.onDuty || []) {
      if (!/^\S+ \d{1,2}$/.test(t.train || '')) continue; // "M38261 20"; never a yard job
      const r = state.runarounds[BoardTrains.trainKey(t.train, s.taken)];
      if (r && !r.onDuty) Object.assign(r, { onDuty: BoardTrains.resolve(t.onDuty, s.taken), crew: t.crew || '', station: t.station || '' });
    }
    for (const v of s.vacancies || []) {
      const id = `${v.train}|${v.pool}|${v.cc}|${v.turn}`;
      const prev = state.spareJobs[latest[id]];
      let j = prev;
      if (!prev || min(s.taken) - min(prev.last) > SAME_JOB_MIN) {
        const key = `${id}|${s.taken}`;
        j = state.spareJobs[key] = { train: v.train, pool: v.pool, cc: v.cc, turn: v.turn, yard: !!v.yard, first: s.taken };
        latest[id] = key;
        byTurn[v.turn] = key;
      }
      j.last = s.taken;
      if (v.at) j.at = v.at;
      if (v.fill && v.fill.turn) j.predicted = v.fill.turn;
    }
    // A spare person on the Call Board working a job's turn fills that job.
    for (const t of s.onDuty || []) {
      for (const b of t.backfill || []) {
        const j = state.spareJobs[byTurn[b.job]];
        if (j && !j.filledBy && min(s.taken) - min(j.first) <= FILL_WITHIN) Object.assign(j, { filledBy: b.turn, filledOn: t.train, filledSeen: s.taken });
      }
    }
    catsCheck(s, state);
    missingCheck(s, state);
    staleCheck(s, state);
    runLogCheck(s, state);
    sleepCheck(s, state);
  }
  return state;
}

// One check for the runaround log.
const RA_OLD = 3 * 60; // the order last seen this long before the train went: only "possible"
function runLogCheck(s, state) {
  const min = BoardTrains.toMin;
  const memo = state.raOrder || (state.raOrder = {}); // train key → the order at the latest check
  const done = state.raDone || (state.raDone = {}); // train key → checked already
  const out = state.runLog || (state.runLog = {});
  const recent = state.raWent || (state.raWent = {}); // turn → { train, seen }: who went on what lately
  // Each turn's board, position and status in this check.
  const where = new Map();
  const onBoard = new Map(); // `${turn}|${board}` → spot: a spare is on the fast and the slow board
  for (const p of s.pools || []) {
    for (const t of p.turns || []) {
      if (t.left) continue;
      const spot = { board: p.name.replace(/ · .*$/, ''), pos: t.pos, status: t.status || '' };
      if (!where.has(t.turn)) where.set(t.turn, spot);
      onBoard.set(`${t.turn}|${spot.board}`, spot);
    }
  }
  // board: the one they were expected from (owner, 2026-11-03: B111 shown at
  // fast board 004 for a deadhead, which goes to the slow board, where B111 was 001).
  const look = (turn, board) => (turn ? { turn, ...((board && onBoard.get(`${turn}|${board}`)) || where.get(turn) || { board: '', pos: '', status: 'not on a board at home' }) } : null);
  // Jobs going spare (corrected list): the spare expected to fill each.
  const fillOf = (sym, at, cc) => {
    const v = (s.vacancies || []).find((x) => x.train === sym && (!at || x.at === at) && (cc === 'EN' ? /^(EN|LE|ET)$/.test(x.cc) : !/^(EN|LE|ET)$/.test(x.cc)));
    return v && v.fill && v.fill.turn ? { turn: v.fill.turn, board: v.fill.board || '' } : null;
  };
  // 1. Remember the order for every train not on duty yet.
  for (const t of s.lineup || []) {
    if (!t.call || !t.crew || !/^\S+ \d{1,2}$/.test(t.train || '')) continue;
    const key = BoardTrains.trainKey(t.train, s.taken);
    if (done[key]) continue;
    const [sym] = t.train.split(' ');
    const spare = (turn) => !!turn && new RegExp(`${turn} \\(goes spare`).test(t.rules || '');
    const crafts = {};
    for (const [craft, turn] of [['CO', t.crew.co], ['EN', t.crew.en]]) {
      if (!turn) continue;
      const sp = spare(turn);
      const f = sp ? fillOf(sym, t.order, craft) : null;
      const fill = f ? f.turn : null;
      crafts[craft] = { job: turn, spare: sp, fill, jobAt: look(turn), fillAt: look(fill, f && f.board) };
    }
    memo[key] = { train: t.train, where: 'Sarnia', seen: s.sameUntil || s.taken, call: BoardTrains.resolve(t.call, s.taken), crafts };
  }
  for (const t of s.macLineup || []) {
    if (!t.crew || !/^\S+ \d{1,2}$/.test(t.train || '')) continue;
    const key = BoardTrains.trainKey(t.train, s.taken);
    if (done[key]) continue;
    const crew = String(t.crew).split(' + ').filter(Boolean);
    const bunk = (turn) => { const c = (s.bunkhouse || []).find((x) => x.en === turn || x.co === turn); return { turn, board: 'Toronto bunkhouse', pos: c ? c.pos : '', status: c ? (c.ready ? 'rested' : `rest until ${c.rested}`) : 'not in the bunkhouse' }; };
    memo[key] = { train: t.train, where: 'Toronto', seen: s.sameUntil || s.taken, call: BoardTrains.resolve(t.call, s.taken), crafts: { crew: { set: crew, at: crew.map(bunk) } } };
  }
  // Yard jobs going spare: the spare expected to fill each (by job and craft).
  for (const v of s.vacancies || []) {
    if (!v.yard || !v.fill || !v.fill.turn) continue;
    const key = `yard|${v.train}|${v.cc}|${v.at}`;
    if (done[key]) continue;
    memo[key] = { train: v.train, where: 'Yard', yard: true, at: v.at, seen: s.sameUntil || s.taken, call: BoardTrains.resolve(v.fill.call, s.taken), crafts: { [/^(EN|LE|ET)$/.test(v.cc) ? 'EN' : 'CO']: { job: v.turn, spare: true, fill: v.fill.turn, fillAt: look(v.fill.turn, v.fill.board) } } };
  }
  // Who went on what in this check.
  for (const t of s.onDuty || []) for (const c of crewOf(t.crew)) recent[c.turn] = { train: t.train, seen: s.taken };
  for (const b of (s.onDuty || []).flatMap((t) => (t.backfill || []).map((x) => ({ ...x, train: t.train })))) recent[b.turn] = { train: b.train, seen: s.taken };
  // A Sarnia turn's pool, by its id: SR/SD Chain Gang, SA/S1 A pool, SB/S3 B pool, S5 501/502.
  const poolName = (turn) => ({ SR: 'Chain Gang', SD: 'Chain Gang', SA: 'A pool', S1: 'A pool', SB: 'B pool', S3: 'B pool', S5: '501/502' })[String(turn || '').slice(0, 2)] || '';
  const why = (x, call, train) => {
    if (!x) return null;
    const other = recent[x.turn];
    if (other && other.train !== train && min(s.taken) - min(other.seen) < 12 * 60) return `went on ${other.train}`;
    const st = x.status || '';
    const rest = /rest until (\S+ \d{4})/.exec(st);
    if (rest) { const until = BoardTrains.resolve(rest[1], s.taken); if (until && call && min(until) > min(call)) return `on rest until ${rest[1]}, after the call (~${call.slice(11)})`; }
    if (/hold turn/.test(st)) return st;
    // ** goes spare (owner, 2026-11-03: SD01 "** goes spare, return 2nd 2359"
    // was a likely runaround on DHT024B 02): not callable until the return.
    const marked = /\*\* goes spare(?:, return (\S+ \d{4}))?/.exec(st);
    if (marked) { const back = marked[1] && BoardTrains.resolve(marked[1], s.taken); if (!back || !call || min(back) > min(call)) return st; }
    if (/out working|B0|TV/.test(st)) return st;
    if (/not on a board|not in the bunkhouse/.test(st)) return st;
    return null;
  };
  const record = (key, m, e) => {
    const old = min(s.taken) - min(m.seen) > RA_OLD;
    const excuse = e.explain || why(e.passedAt, m.call, m.train);
    out[`${key}|${e.craft}`] = { train: m.train, where: m.where, craft: e.craft, board: (e.passedAt && e.passedAt.board) || '', went: e.went, wentJob: e.wentJob || '',
      passed: e.passed, passedPos: (e.passedAt && e.passedAt.pos) || '', passedStatus: (e.passedAt && e.passedAt.status) || '', kind: e.kind,
      result: excuse ? 'explained' : old ? 'possible' : 'likely', reason: excuse || (old ? `the order was last seen ${BoardTrains.fromMin(min(m.seen))}` : ''),
      orderSeen: m.seen, call: m.call, onDuty: e.onDuty || null, seen: s.taken };
  };
  // 2. A train on the Call Board: who went against the order.
  for (const t of s.onDuty || []) {
    if (!/^\S+ \d{1,2}$/.test(t.train || '')) continue;
    const key = BoardTrains.trainKey(t.train, s.taken);
    const m = memo[key];
    if (done[key] || !m) continue;
    done[key] = s.taken;
    const crew = crewOf(t.crew);
    const onDuty = BoardTrains.resolve(t.onDuty, s.taken);
    if (m.where === 'Toronto') {
      const went = crew.map((c) => c.turn);
      const fills = new Map((t.backfill || []).map((b) => [b.job, b.turn]));
      const missing = m.crafts.crew.set.filter((x) => !went.includes(x) && ![...fills.values()].includes(x));
      const extra = went.filter((x) => !m.crafts.crew.set.includes(x));
      missing.forEach((x, i) => record(key, m, { craft: missing.length > 1 ? `crew ${i + 1}` : 'crew', kind: 'bunkhouse', passed: x, passedAt: m.crafts.crew.at.find((a) => a.turn === x), went: extra[i] || extra.join(' + ') || '?', onDuty }));
      continue;
    }
    // The whole crew from another pool than the order (owner, 2026-11-03:
    // M30241 19 planned 0534 → A pool SA05 + S103, went at 0345 with SR02 +
    // SD02: the order time moved before 0459, the previous road day's Chain
    // Gang). Not a runaround of the turns in the order.
    const pools = Object.entries(m.crafts).map(([craft, o]) => [o.job, (crew.find((x) => (craft === 'EN' ? x.craft !== 'CO' : x.craft === 'CO')) || {}).turn]);
    const moved = pools.length > 0 && pools.every(([a, b]) => b && poolName(a) && poolName(b) && poolName(a) !== poolName(b));
    const movedWhy = moved ? `went to the ${poolName(pools[0][1])}, not the ${poolName(pools[0][0])} (the order time likely changed)` : '';
    for (const [craft, o] of Object.entries(m.crafts)) {
      const c = crew.find((x) => (craft === 'EN' ? x.craft !== 'CO' : x.craft === 'CO'));
      if (!c) continue;
      const fill = (t.backfill || []).find((b) => b.job === c.turn && (b.craft === craft || (craft === 'EN' && b.craft !== 'CO')));
      if (c.turn !== o.job) record(key, m, { craft, kind: 'turn', passed: o.job, passedAt: o.jobAt, went: c.turn, onDuty, explain: movedWhy });
      else if (o.spare && o.fill && fill && fill.turn !== o.fill) record(key, m, { craft, kind: 'spare', passed: o.fill, passedAt: o.fillAt, went: fill.turn, wentJob: c.turn, onDuty });
    }
  }
  // 3. A yard job on duty: the spare that went against the spare expected.
  for (const j of s.yardJobs || []) {
    for (const [key, m] of Object.entries(memo)) {
      if (!m.yard || done[key] || m.train !== j.job || !j.onDuty) continue;
      const at = BoardTrains.resolve(j.onDuty, s.taken);
      if (!at || !m.call || Math.abs(min(at) - min(m.call) - 120) > 180) continue;
      done[key] = s.taken;
      for (const [craft, o] of Object.entries(m.crafts)) {
        const c = crewOf(j.crew).find((x) => (craft === 'EN' ? x.craft !== 'CO' : x.craft === 'CO'));
        if (c && c.turn !== o.fill && c.turn !== o.job) record(key, m, { craft, kind: 'yard', passed: o.fill, passedAt: o.fillAt, went: c.turn, wentJob: o.job, onDuty: at });
      }
    }
  }
  // Forget old orders (a train that never went).
  for (const [key, m] of Object.entries(memo)) if (min(s.taken) - min(m.seen) > 2 * 1440) delete memo[key];
  for (const [key, at] of Object.entries(done)) if (min(s.taken) - min(at) > 4 * 1440) delete done[key];
}

// One check for the stale trains. The board can sit unchanged for a while
// (one snapshot, sameUntil): it's been stale from the first check past the
// call through the last check that still showed it.
const STALE_GRACE = 15; // minutes past the call before it counts (owner, 2026-11-02)
function staleCheck(s, state) {
  const min = BoardTrains.toMin;
  const all = state.stale || (state.stale = {});
  const t0 = min(s.taken);
  const t1 = min(s.sameUntil || s.taken);
  const here = new Set();
  const rows = [...(s.lineup || []).map((t) => ({ ...t, where: 'Sarnia' })), ...(s.macLineup || []).map((t) => ({ ...t, where: 'Toronto' }))];
  for (const t of rows) {
    if (!t.call || !/^\S+ \d{1,2}$/.test(t.train || '')) continue;
    const key = BoardTrains.trainKey(t.train, s.taken);
    here.add(key);
    const call = BoardTrains.resolve(t.call, s.taken);
    const order = BoardTrains.resolve(t.order, s.taken);
    if (!call) continue;
    let r = all[key];
    const open = r && r.stretches[r.stretches.length - 1] && !r.stretches[r.stretches.length - 1].end ? r.stretches[r.stretches.length - 1] : null;
    const crew = typeof t.crew === 'string' ? t.crew : t.crew ? [t.crew.co, t.crew.en].filter(Boolean).join(' + ') : '';
    if (t.status === 'ORD') {
      if (open) Object.assign(open, { end: 'ordered', endAt: s.taken, to: s.taken, orderedFor: order });
      if (r && !r.ordered) Object.assign(r, { ordered: s.taken, orderedFor: order });
      continue;
    }
    const past = t1 - min(call);
    if (past < 0) {
      // The plan moved later and the call is ahead again: paused.
      if (open) Object.assign(open, { end: 'pushed', endAt: s.taken, to: s.taken, pushedTo: order });
      continue;
    }
    if (!r) r = all[key] = { train: t.train, where: t.where, firstPlan: order, stretches: [], moves: 0 };
    if (r.lastPlan && r.lastPlan !== order) r.moves++;
    r.lastPlan = order;
    if (crew) r.crew = crew;
    if (open) Object.assign(open, { to: BoardTrains.fromMin(t1), call, plan: order, maxPast: Math.max(open.maxPast, past) });
    else r.stretches.push({ from: BoardTrains.fromMin(Math.max(t0, min(call))), to: BoardTrains.fromMin(t1), call, plan: order, maxPast: past });
  }
  // Gone from the line-up while stale: on duty (Call Board) or cancelled.
  const onDuty = new Map((s.onDuty || []).filter((t) => /^\S+ \d{1,2}$/.test(t.train || '')).map((t) => [BoardTrains.trainKey(t.train, s.taken), t]));
  for (const [key, r] of Object.entries(all)) {
    const open = r.stretches[r.stretches.length - 1];
    const went = onDuty.get(key);
    if (went && !r.onDuty) Object.assign(r, { onDuty: BoardTrains.resolve(went.onDuty, s.taken), wentCrew: went.crew || '' });
    if (!here.has(key) && open && !open.end) Object.assign(open, { end: went ? 'onDuty' : 'gone', endAt: s.taken, to: s.taken });
  }
}

// One check for jobs missing from option 5. Only checks that read option 5
// count (snapshot screens has 'terminal').
const MISSING_MIN = 30;
function missingCheck(s, state) {
  const min = BoardTrains.toMin;
  const all = state.catsMissing || (state.catsMissing = {});
  if (!(s.screens || []).includes('terminal')) return;
  const listedJobs = s.vacanciesCats || s.vacancies || [];
  const until = s.sameUntil || s.taken;
  const eng = (cc) => /^(EN|LE|ET)$/.test(cc || '');
  const seenNow = new Set();
  for (const t of s.lineup || []) {
    if (!t.crew || !/^\S+ \d{1,2}$/.test(t.train || '')) continue;
    const [sym] = t.train.split(' ');
    for (const [craft, turn] of [['CO', t.crew.co], ['EN', t.crew.en]]) {
      if (!turn || !new RegExp(`${turn} \\(goes spare`).test(t.rules || '')) continue;
      const key = `${BoardTrains.trainKey(t.train, s.taken)}|${craft}`;
      const listed = listedJobs.some((v) => v.train === sym && eng(v.cc) === (craft === 'EN'));
      let r = all[key];
      if (listed) { if (r && !r.listedAt) r.listedAt = s.taken; continue; }
      if (r && r.listedAt) continue; // listed already; later gaps aren't a new mistake
      seenNow.add(key);
      if (!r) r = all[key] = { train: t.train, craft, turn, order: t.order, first: s.taken, checks: 0 };
      Object.assign(r, { last: until, checks: r.checks + 1, turn, order: t.order });
    }
  }
  // The crew that went (Call Board).
  for (const t of s.onDuty || []) {
    if (!/^\S+ \d{1,2}$/.test(t.train || '')) continue;
    const k = BoardTrains.trainKey(t.train, s.taken);
    for (const craft of ['CO', 'EN']) {
      const r = all[`${k}|${craft}`];
      if (r && !r.onDuty) Object.assign(r, { onDuty: BoardTrains.resolve(t.onDuty, s.taken), crew: t.crew || '' });
    }
  }
  // The order no longer says it goes spare (and CATS never listed it): over.
  for (const [key, r] of Object.entries(all)) if (!seenNow.has(key) && !r.listedAt && !r.ended && min(s.taken) - min(r.last) <= 15) r.ended = s.taken;
  for (const [key, r] of Object.entries(all)) if (min(s.taken) - min(r.last) > 4 * 1440) delete all[key];
}

// One check for the CATS option 5 errors (spares.js checkVacancies, saved
// per check as s.catsErrors by site.js).
function catsCheck(s, state) {
  const all = state.catsErrors || (state.catsErrors = {});
  const until = s.sameUntil || s.taken;
  const now = new Set();
  for (const e of s.catsErrors || []) {
    const key = `${BoardTrains.trainKey(e.train, s.taken)}|${e.craft}|${e.cats}`;
    now.add(key);
    const r = all[key] || (all[key] = { train: e.train, craft: e.craft, cats: e.cats, catsPool: e.catsPool, first: s.taken, checks: 0 });
    Object.assign(r, { order: e.order, orderSpare: e.orderSpare, at: e.at, last: until, checks: r.checks + 1, fixed: null });
    if (e.wouldCall) Object.assign(r, { wouldCall: e.wouldCall, call: e.call });
  }
  // Gone from option 5 while the train is still on the line-up: CATS fixed it.
  const listed = new Set((s.lineup || []).map((t) => t.train));
  for (const [key, r] of Object.entries(all)) if (!now.has(key) && !r.fixed && !r.onDuty && listed.has(r.train)) r.fixed = s.taken;
  // The crew that went (Call Board): who was right.
  for (const t of s.onDuty || []) {
    if (!/^\S+ \d{1,2}$/.test(t.train || '')) continue;
    for (const r of Object.values(all)) {
      if (r.train === t.train && !r.onDuty && Math.abs(BoardTrains.toMin(s.taken) - BoardTrains.toMin(r.last)) < 3 * 1440) Object.assign(r, { onDuty: BoardTrains.resolve(t.onDuty, s.taken), crew: t.crew || '' });
    }
  }
}

// The crew in "EN SD07 · CO SR03" → [{ craft, turn }].
const crewOf = (crew) => String(crew || '').split(' · ').map((c) => c.trim().split(' ')).filter((x) => x.length === 2 && /^[A-Z0-9]+$/.test(x[1])).map(([craft, turn]) => ({ craft, turn }));
// 501/502 is two turns with one number (owner, 2026-10-25): S501-CO, S501-EN.
const nameOf = (turn, craft) => (/^S5\d{2}$/.test(turn || '') ? `${turn}-${craft === 'CO' ? 'CO' : 'EN'}` : turn);

// One check for the sleep tracker. Expected calls: line-up trains (Sarnia's
// and Mac yard's) for the crew on them, jobs going spare for the spare turn
// expected to fill them; the earliest if a turn shows on more than one.
function sleepCheck(s, state) {
  const min = BoardTrains.toMin;
  const open = state.sleepOpen || (state.sleepOpen = {});
  const done = state.sleepDone || (state.sleepDone = {}); // "turn|train" → when it was called
  const out = state.sleep || (state.sleep = {});
  const now = min(s.taken);
  // Train ids come round again next month: "done" only lasts a few days.
  const isDone = (turn, train) => done[`${turn}|${train}`] && now - min(done[`${turn}|${train}`]) < 3 * 1440;
  const expect = new Map();
  const listed = new Map(); // train → the turns listed on it in this check
  const see = (turn0, craft, call, train) => {
    const turn = turn0 && nameOf(turn0, craft);
    if (turn) { if (!listed.has(train)) listed.set(train, new Set()); listed.get(train).add(turn); }
    const at = BoardTrains.resolve(call, s.taken);
    if (!turn || !at || isDone(turn, train)) return;
    const prev = expect.get(turn);
    if (!prev || at < prev.call) expect.set(turn, { call: at, train });
  };
  for (const t of [...(s.lineup || []), ...(s.macLineup || [])]) {
    const c = t.crew || t.pred;
    if (c) { see(c.co, 'CO', t.call, t.train); see(c.en, 'EN', t.call, t.train); }
  }
  for (const v of s.vacancies || []) if (v.fill && v.fill.turn) see(v.fill.turn, v.cc === 'CO' ? 'CO' : 'EN', v.fill.call, v.train);

  for (const [turn, { call, train }] of expect) {
    const o = open[turn] || (open[turn] = { turn, firstSeen: s.taken, firstCall: call, shifts: [] });
    const away = min(call) - now;
    if (!o.sleepAt && away <= SLEEP_MIN) {
      Object.assign(o, { sleepAt: s.taken, expected: call, expectedTrain: train, notice: away, short: o.firstSeen === s.taken });
    } else if (o.sleepAt && (call !== o.lastCall || train !== o.lastTrain)) {
      o.shifts.push({ taken: s.taken, call, train });
    }
    Object.assign(o, { lastCall: call, lastTrain: train, lastSeen: s.taken });
  }

  // Who went on duty: the Call Board's crews (a spare person filling in
  // instead of the job's own turn) and the yard jobs' crews.
  const went = [];
  for (const t of s.onDuty || []) {
    const fills = t.backfill || [];
    const crew = crewOf(t.crew).filter((x) => !fills.some((b) => b.job === x.turn));
    for (const c of [...crew, ...fills]) went.push({ turn: nameOf(c.turn, c.craft), train: t.train, onDuty: t.onDuty });
  }
  for (const j of s.yardJobs || []) for (const c of crewOf(j.crew)) if (j.onDuty) went.push({ turn: nameOf(c.turn, c.craft), train: j.job, onDuty: j.onDuty, yard: true });
  for (const w of went) {
    const o = open[w.turn];
    const at = BoardTrains.resolve(w.onDuty, s.taken);
    if (!o || !at || isDone(w.turn, w.train)) continue;
    const call = BoardTrains.fromMin(min(at) - CALL_LEAD);
    // Never within 8 h before it came: compare with the last call it showed.
    const expected = o.expected || o.lastCall;
    out[`${w.turn}|${w.train}|${at}`] = {
      turn: w.turn, train: w.train, yard: !!w.yard, onDuty: at, call, seen: s.taken,
      expected, expectedTrain: o.expectedTrain || o.lastTrain, sleepAt: o.sleepAt || null, notice: o.notice ?? null, short: !!o.short,
      noWindow: !o.sleepAt, firstSeen: o.firstSeen, firstCall: o.firstCall, shifts: o.shifts,
      off: min(call) - min(expected), // + called later than expected, − earlier
    };
    done[`${w.turn}|${w.train}`] = s.taken;
    delete open[w.turn];
  }
  // Taken off: the wait they slept on ends here (a record without a call);
  // not asleep yet, it just starts again when they're lined up again.
  const read = (s.lineup || []).length + (s.macLineup || []).length > 0;
  for (const [turn, o] of Object.entries(open)) {
    if (expect.has(turn)) continue;
    const others = listed.get(o.lastTrain);
    const off = (others && !others.has(turn)) || (read && now - min(o.lastSeen) >= TAKEN_OFF_MIN);
    if (off && o.sleepAt) {
      out[`${turn}|${o.lastTrain}|off|${s.taken}`] = {
        turn, train: o.lastTrain, takenOff: true, onDuty: s.taken, seen: s.taken, lastListed: o.lastSeen,
        expected: o.expected, expectedTrain: o.expectedTrain, sleepAt: o.sleepAt, notice: o.notice ?? null, short: !!o.short,
        firstSeen: o.firstSeen, firstCall: o.firstCall, shifts: o.shifts,
      };
    }
    if (off || now - min(o.lastSeen) > DROP_AFTER) delete open[turn];
  }
}

// The lists for the page, oldest first.
function finish(state) {
  const by = (k) => (a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0);
  return {
    runarounds: Object.values(state.runarounds).map(({ out, ...r }) => ({ ...r, fixed: out === false, wrongChecks: (r.stretches || []).reduce((n, x) => n + x.checks, 0) })).sort(by('taken')),
    spareJobs: Object.values(state.spareJobs).sort(by('first')),
    sleep: Object.values(state.sleep || {}).sort(by('onDuty')),
    // A one-check blip isn't counted (owner's pick b, 2026-11-02).
    catsErrors: Object.values(state.catsErrors || {}).filter((r) => r.checks > 1 || r.last !== r.first).sort(by('first')),
    // Missing from option 5 for MISSING_MIN or more.
    catsMissing: Object.values(state.catsMissing || {}).map((r) => ({ ...r, minutes: BoardTrains.toMin(r.listedAt || r.last) - BoardTrains.toMin(r.first) }))
      .filter((r) => r.minutes >= MISSING_MIN).sort(by('first')),
    runLog: Object.values(state.runLog || {}).sort(by('seen')),
    // Stretches 15 min or more past the call (STALE_GRACE), each train once.
    stale: Object.values(state.stale || {}).map((r) => {
      const stretches = r.stretches.filter((x) => x.maxPast >= STALE_GRACE);
      const minutes = stretches.reduce((n, x) => n + (BoardTrains.toMin(x.to) - BoardTrains.toMin(x.from)), 0);
      const last = stretches[stretches.length - 1];
      return { ...r, stretches, minutes, maxPast: Math.max(0, ...stretches.map((x) => x.maxPast)), from: stretches[0] && stretches[0].from, end: last ? last.end || 'stale' : null };
    }).filter((r) => r.stretches.length).sort(by('from')),
  };
}

module.exports = { collect, finish };
