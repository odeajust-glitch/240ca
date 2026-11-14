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
const GARNET_PREP = 15; // on duty away from home (Garnet, Toronto) is 15 min before the order
const DROP_AFTER = 24 * 60; // a turn gone from every screen this long: forget its wait
// Taken off the line-up after going to sleep (owner, 2026-10-26, option A):
// that wait ends there, counted on its own, and the next line-up starts a
// new one. Taken off = the train they slept on is still listed with someone
// else, or the turn has been on no line-up for this long (not on duty).
const TAKEN_OFF_MIN = 4 * 60;
// Someone else shown on their train: this long for the Call Board or the
// line-up to settle it before it counts as taken off.
const SWAP_WAIT = 30;

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
    // The board's own crew for a train shown out of sequence, while it was still a prediction, and the spare
    // it had for a turn going spare (owner, 2026-11-14, E27861 13: the board had SR05 going spare → B139;
    // B139 went, but on SB01's job). Kept to the last check before it went.
    for (const l of s.lineup || []) {
      if (!l.pred || !/^\S+ \d{1,2}$/.test(l.train || '')) continue;
      const r = state.runarounds[BoardTrains.trainKey(l.train, s.taken)];
      if (!r || r.onDuty) continue;
      const sym = l.train.split(' ')[0];
      const spareFor = (turn) => {
        if (!turn || !new RegExp(`${turn} \\(goes spare`).test(l.rules || '')) return '';
        const v = [...(s.vacancies || []), ...(s.vacanciesPredicted || [])].find((x) => x.turn === turn && x.train === sym && x.fill && x.fill.turn);
        return v ? v.fill.turn : '';
      };
      r.board = { co: l.pred.co || '', en: l.pred.en || '', coSpare: spareFor(l.pred.co), enSpare: spareFor(l.pred.en), seen: s.taken };
    }
    // The crew that actually went (Call Board), and a spare working a job's turn on it.
    for (const t of s.onDuty || []) {
      if (!/^\S+ \d{1,2}$/.test(t.train || '')) continue; // "M38261 20"; never a yard job
      const r = state.runarounds[BoardTrains.trainKey(t.train, s.taken)];
      if (r && !r.onDuty) Object.assign(r, { onDuty: BoardTrains.resolve(t.onDuty, s.taken), crew: t.crew || '', station: t.station || '' });
      // The crew as the Call Board last showed it (it can be put right after it first shows: M39671 12, 13 Nov,
      // CO SB01 worked by B139 at 23:58, CO SR02 from 00:06).
      if (r) Object.assign(r, { crewLast: t.crew || '', workedBy: (t.backfill || []).map((b) => ({ craft: b.craft, job: b.job, turn: b.turn })) });
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
    yardmasterCheck(s, state);
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

// Yardmaster jobs going spare (option 5, CC YA; owner, 2026-11-13: "can you see YM jobs that go spare, if
// you have been recording them can you show me what you know"). Kept apart from the jobs above (they go to
// the yardmaster spareboard, owner 2026-10-24). One entry a job and start: when CATS first and last listed
// it, and the shift seen on the Call Board (its on-duty time and the crew line: "YA SA01" when the person
// is on one of the boards the checker reads, empty when not).
const YM_RUN_NEAR = 4 * 60;
function yardmasterCheck(s, state) {
  const min = BoardTrains.toMin;
  const jobs = state.yardmaster || (state.yardmaster = {});
  for (const v of s.yardmasterJobs || []) {
    const at = v.at ? BoardTrains.resolve(v.at, s.taken) : null;
    const key = `${v.train}|${at || s.taken}`;
    const j = jobs[key] || (jobs[key] = { train: v.train, cc: v.cc, at, first: s.taken, checks: 0 });
    Object.assign(j, { last: s.taken, status: v.status, checks: j.checks + 1 });
    if (v.st) j.st = v.st;
  }
  // The shift on the Call Board: a run of the job within 4 h of the listed start.
  const runs = (s.yardJobs || []).filter((y) => y.onDuty);
  if (!runs.length) return;
  for (const j of Object.values(jobs)) {
    if (!j.at || min(s.taken) - min(j.at) > 24 * 60) continue;
    for (const y of runs) {
      if (y.job !== j.train) continue;
      const on = BoardTrains.resolve(y.onDuty, s.taken);
      if (Math.abs(min(on) - min(j.at)) > YM_RUN_NEAR) continue;
      j.onDuty = on;
      if (y.crew || !j.crew) j.crew = y.crew || '';
    }
  }
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
    // Days off at the call (option 4, owner 2026-11-05): "PL @ 6th 0001",
    // 24 h from the time shown.
    const off = /PL @ (\S+ \d{4})/.exec(st);
    if (off) {
      const from = BoardTrains.resolve(off[1], s.taken);
      // On at the call, or (a road job) starting 24 h or less after going on
      // duty (call + 2 h): it goes spare 100% (owner, 2026-11-05).
      if (call && from && min(call) < min(from) + 24 * 60 && min(from) - (min(call) + 120) <= 24 * 60) return min(from) <= min(call) ? `on days off at the call (~${call.slice(11)}): PL @ ${off[1]}` : `PL @ ${off[1]}, 24 h or less after going on duty`;
    }
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
      // An MU placeholder on a train whose turn went spare: the spare that
      // filled it is the question (below), not the turn (owner, 2026-11-03).
      if (c.turn !== o.job && !(/^MU/.test(c.turn) && o.spare)) record(key, m, { craft, kind: 'turn', passed: o.job, passedAt: o.jobAt, went: c.turn, onDuty, explain: movedWhy });
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
// Trainees (TT / ET) ride along: never the train's conductor or engineer.
const crewOf = (crew) => String(crew || '').split(' · ').map((c) => c.trim().split(' ')).filter((x) => x.length === 2 && /^[A-Z0-9]+$/.test(x[1]) && !/^(TT|ET)$/.test(x[0])).map(([craft, turn]) => ({ craft, turn }));
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
  // A road train's id carries its day ("M38261 08"); a yard job's doesn't
  // ("YPRS30" every day), so its note is kept per on-duty day. Without that a
  // spare lined up for the same job again within 3 days was ignored (owner,
  // 2026-11-10: B116 on YPRS30 the 7th, then again the 9th: no record).
  const doneKey = (turn, train, duty) => (/\s\d{1,2}$/.test(train || '') ? `${turn}|${train}` : `${turn}|${train}|${String(duty || '').slice(0, 10)}`);
  const isDone = (turn, train, duty) => { const at = done[doneKey(turn, train, duty)]; return !!at && now - min(at) < 3 * 1440; };
  const expect = new Map();
  const listed = new Map(); // train → the turns listed on it in this check
  // turn: as tracked ("SR03", "S501-CO"); at: the expected call, resolved.
  // seat: where the turn sits ({ key, src, skipped }), for the reasons below.
  const seatsNow = {}; // seat key → { turn, train, src, skipped }
  const put = (turn, at, train, status, seat) => {
    if (turn) { if (!listed.has(train)) listed.set(train, new Set()); listed.get(train).add(turn); }
    if (turn && seat) seatsNow[seat.key] = { key: seat.key, turn, train, src: seat.src, skipped: seat.skipped || [] };
    if (!turn || !at || isDone(turn, train, BoardTrains.fromMin(min(at) + CALL_LEAD))) return; // at is the call: on duty is 2 h later
    const prev = expect.get(turn);
    if (!prev || at < prev.call) expect.set(turn, { call: at, train, ordered: status === 'ORD', seat: seat ? seat.key : '', since: (seat && seat.since) || '' });
  };
  // Who is working a turn in its holder's place (a spare filling in), from
  // the Call Board: turn → { by, seen }. Ends when the holder is back on it.
  const riding = state.sleepRiding || (state.sleepRiding = {});
  for (const [k, r] of Object.entries(riding)) if (now - min(r.seen) > 2 * 1440) delete riding[k];
  for (const t of s.onDuty || []) {
    const fills = t.backfill || [];
    for (const c of crewOf(t.crew)) {
      const f = fills.find((b) => b.job === c.turn && (!/^S5\d{2}$/.test(c.turn) || (b.craft !== 'CO') === (c.craft !== 'CO')));
      const name = nameOf(c.turn, c.craft);
      if (f) riding[name] = { by: nameOf(f.turn, f.craft), seen: s.taken };
      else if (riding[name] && riding[name].train !== t.train) delete riding[name];
      if (f) riding[name].train = t.train;
    }
  }
  // Toronto bunkhouse: when each crew there went off duty.
  const bunkOff = new Map();
  for (const b of s.bunkhouse || []) { const off = BoardTrains.resolve(b.offDuty, s.taken); if (off) { if (b.en) bunkOff.set(b.en, off); if (b.co) bunkOff.set(b.co, off); } }
  const see = (turn0, craft, call, train, status, seat) => put(turn0 && nameOf(turn0, craft), BoardTrains.resolve(call, s.taken), train, status, seat);
  for (const [rows, src] of [[s.lineup || [], 'line-up'], [s.macLineup || [], 'Toronto line-up']]) {
    for (const t of rows) {
      // Sarnia's rows carry the crew as { co, en }. Toronto's carry it as
      // words ("S105 + SA03", engineer first) with the same pair in pred:
      // taking the words first meant no Toronto train was ever tracked
      // (owner, 2026-11-10: "trains originating in mac yard don't have the
      // data for the graph").
      const words = typeof t.crew === 'string' ? t.crew.split(' + ').map((x) => x.trim()) : null;
      const c = (t.crew && typeof t.crew === 'object' ? t.crew : null) || t.pred || (words && words.length === 2 ? { en: words[0], co: words[1] } : null);
      if (!c) continue;
      // Toronto's "call" on the page is order − 2 h; the real call compared
      // here is on duty − 2 h, and on duty there is 15 min before the order
      // for a train (279 of 280 on the live days), at the order for a deadhead.
      let at = BoardTrains.resolve(t.call, s.taken);
      if (src === 'Toronto line-up') { const order = BoardTrains.resolve(t.order, s.taken); if (order) at = BoardTrains.fromMin(min(order) - (t.deadhead || /^DH/.test(t.train || '') ? 0 : GARNET_PREP) - CALL_LEAD); }
      // Out of Toronto the notice starts when the crew goes off duty at the
      // bunkhouse, not when the train shows on the line-up (owner,
      // 2026-11-10): a crew still on its way there is on no wait yet.
      const onTheWay = src === 'Toronto line-up' && !!t.crewExpected && !t.crewPos;
      // A turn the line-up shows going spare for this train won't be called
      // for it (the spare filling it is tracked from the spare list). Counting
      // it made every day off a "removed from the line-up" (owner, 2026-11-10:
      // L502 "goes every day it doesn't get removed"). The rules read
      // conductor + engineer; on 501/502 both carry the same number.
      const parts = String(t.rules || '').replace(/^[^:]*: /, '').split(' + ');
      const goesSpare = (turn0, i) => (parts.length === 2 ? /\(goes spare/.test(parts[i]) : new RegExp(`${turn0} \\(goes spare`).test(t.rules || ''));
      for (const [turn0, craft, i] of [[c.co, 'CO', 0], [c.en, 'EN', 1]]) {
        if (!turn0 || goesSpare(turn0, i)) continue;
        // A spare who took the turn to Toronto brings it home: the wait is
        // theirs (the line-up lists the turn, the Call Board the spare).
        const rider = src === 'Toronto line-up' ? riding[nameOf(turn0, craft)] : null;
        put(rider ? rider.by : nameOf(turn0, craft), onTheWay ? null : at, t.train, t.status, { key: `${t.train}|${craft}`, src, since: src === 'Toronto line-up' ? bunkOff.get(turn0) || '' : '' });
      }
    }
  }
  // A job's seat on the spare list: its position there moves as jobs come and go.
  const vacSeen = {};
  for (const v of s.vacancies || []) {
    if (!v.fill || !v.fill.turn) continue;
    const k = `${v.train}|${v.at}|${v.cc}`;
    vacSeen[k] = (vacSeen[k] || 0) + 1;
    see(v.fill.turn, v.cc === 'CO' ? 'CO' : 'EN', v.fill.call, v.train, '', { key: vacSeen[k] > 1 ? `${k}|${vacSeen[k]}` : k, src: 'spare list', skipped: v.fill.skipped || [] });
  }
  // L501 home from Garnet (owner, 2026-11-10: "fix why 501 doesn't have the
  // call stability graph"): Garnet's line-up (option 41, 47956) has its
  // order time, and whoever took that day's L502 out brings it home (the
  // regular crew, a fill-in or an MU crew). The call as everywhere else:
  // on duty − 2 h, and on duty at Garnet is 15 min before the order.
  const home = state.s5Home || (state.s5Home = {}); // turn → { train: the L501 they bring home, seen }
  for (const g of s.garnetLineup || []) {
    if (!/^L501/.test(g.train || '')) continue;
    const order = BoardTrains.resolve(g.order, s.taken);
    if (!order) continue;
    // Away at Garnet, this is their next call whatever Sarnia's line-up
    // still projects for the turn (a fill-in's own pool keeps listing them).
    for (const [turn, h] of Object.entries(home)) {
      if (h.train !== g.train) continue;
      expect.delete(turn);
      put(turn, BoardTrains.fromMin(min(order) - GARNET_PREP - CALL_LEAD), g.train, g.status, { key: `${g.train}|home|${turn}`, src: 'Garnet line-up' });
    }
  }
  for (const [turn, h] of Object.entries(home)) if (now - min(h.seen) > 2 * 1440) delete home[turn];
  for (const [k, at] of Object.entries(done)) if (now - min(at) > 4 * 1440) delete done[k];

  // The wait they slept on, ended without a call (a record of its own).
  const takenOff = (turn, o, at) => {
    if (!o.sleepAt) return;
    settle(o);
    out[`${turn}|${o.lastTrain}|off|${at}`] = {
      turn, train: o.lastTrain, takenOff: true, onDuty: at, seen: at, lastListed: o.lastSeen,
      expected: o.expected, expectedTrain: o.expectedTrain, sleepAt: o.sleepAt, notice: o.notice ?? null, short: !!o.short,
      firstSeen: o.firstSeen, firstCall: o.firstCall, firstWhy: o.firstWhy || '', firstTrain: o.firstTrain || '', firstFrom: o.firstFrom || '', shifts: o.shifts, timelineChanges: o.timelineChanges || [], timelineComplete: !!o.timelineComplete,
      // Someone else shown on their job (who, where they came from, the turn's own status then), or the job itself gone.
      ...(o.offWho ? { replacedBy: o.offWho, replacedWhy: o.offWhy || '', ownStatus: o.offSelf || '' } : {}), ...(o.dropNoted ? { jobDropped: o.dropNoted } : {}),
    };
  };
  // Why a call moved (owner, 2026-11-10: "have a reasoning. ie job showing
  // spare before call time or someone coming off the spareboard in front of
  // you unexpectedly. Or a train or extra job showing up"). Said at the check
  // it happened, from what that check and the one before showed: a train or
  // job new on its list, who had the seat before and where they are now, who
  // has the seat they left, or the train's time moving.
  const mem = state.sleepWhy || (state.sleepWhy = { seats: {}, first: {}, read: {} });
  const readNow = { 'line-up': (s.lineup || []).length > 0, 'Toronto line-up': (s.macLineup || []).length > 0, 'Garnet line-up': (s.garnetLineup || []).length > 0,
    'spare list': (s.screens || []).includes('terminal') || (s.vacancies || []).length > 0 };
  const prevSeats = mem.seats;
  const before = { ...prevSeats }; // as the check before left it (prevSeats is brought up to date below)
  const baseOf = (t) => String(t || '').replace(/-(CO|EN)$/, '');
  // A yard job's id comes round every day: its time on the spare list tells them apart.
  const firstKey = (seat) => `${seat.src}|${seat.train}${seat.src === 'spare list' ? `|${seat.key.split('|')[1] || ''}` : ''}`;
  const isNew = (seat) => !mem.first[firstKey(seat)] && !!mem.read[seat.src];
  // Where a turn that had the seat is now.
  const whereNow = (p, seat) => {
    const b = baseOf(p);
    const skip = (seat.skipped || []).find((x) => x.startsWith(`${b} (`));
    if (skip) return `: ${skip.slice(b.length + 2, -1)}`;
    const other = Object.values(seatsNow).find((x) => x.turn === p && x.train !== seat.train);
    if (other) return `, now on ${other.train}`;
    const called = (s.onDuty || []).find((t) => t.train !== seat.train && (crewOf(t.crew).some((c) => nameOf(c.turn, c.craft) === p) || (t.backfill || []).some((x) => x.turn === b)));
    if (called) return `, called for ${called.train}`;
    for (const pool of s.pools || []) for (const t of pool.turns || []) if (t.turn === b && t.status && t.status !== 'available') return `: ${t.status}`;
    return '';
  };
  const cameFrom = (q) => {
    const was = Object.values(prevSeats).find((x) => x.turn === q);
    return was ? ` (moved from ${was.train})` : ' (not on a list the check before)';
  };
  const whyFor = (turn, train, call, ordered, seatKey, o) => {
    const seat = seatsNow[seatKey];
    if (!seat) return '';
    if (o && o.lastTrain === train) return o.lastCall !== call ? `${train}'s own time moved` : (ordered && !o.lastOrdered ? `${train} was ordered` : '');
    const bits = [];
    if (isNew(seat)) bits.push(seat.src === 'spare list' ? `${train} first showed going spare at this check` : `${train} first showed on the ${seat.src} at this check`);
    const p = isNew(seat) ? null : prevSeats[seatKey];
    const q0 = o && o.lastTrain && o.lastSeat ? seatsNow[o.lastSeat] : null;
    // The two simply traded trains.
    if (p && q0 && p.turn === q0.turn && p.turn !== turn) return `traded places with ${p.turn}, who is on ${o.lastTrain} now`;
    if (p && p.turn && p.turn !== turn) bits.push(`${p.turn} had it before${whereNow(p.turn, seat)}`);
    if (o && o.lastTrain && o.lastSeat) {
      const q = seatsNow[o.lastSeat];
      const went = (s.onDuty || []).find((t) => t.train === o.lastTrain);
      if (q && q.turn !== turn) bits.push(`${q.turn} is on ${o.lastTrain} now${cameFrom(q.turn)}`);
      else if (!q && went) bits.push(`${o.lastTrain} went on duty with ${went.crew || 'another crew'}`);
      else if (!q && readNow[(prevSeats[o.lastSeat] || {}).src]) bits.push(`${o.lastTrain} is off the ${(prevSeats[o.lastSeat] || {}).src}`);
    }
    return bits.join('; ');
  };
  // A job pulled without being called (owner, 2026-11-10: "anything that is
  // dropped without being called it need to be noticable ... the graph
  // should keep going. Only do this if its in the 8 hour window"): the train
  // or job is off its list, nobody is on it and it isn't on the Call Board.
  // A train can leave a line-up and come back, or leave it a check before
  // the Call Board shows it: a mark only stands if, when the wait ends, that
  // train or job was never seen again after it (settle, below).
  const onBoardNow = new Set((s.onDuty || []).map((t) => t.train));
  const present = state.sleepPresent || (state.sleepPresent = {}); // train or job → the last check it was on any list or the Call Board
  for (const t of [...(s.lineup || []), ...(s.macLineup || []), ...(s.garnetLineup || []), ...(s.vacancies || []), ...(s.onDuty || [])]) if (t.train) present[t.train] = s.taken;
  for (const j of s.yardJobs || []) if (j.job) present[j.job] = s.taken;
  for (const [k, at] of Object.entries(present)) if (now - min(at) > 3 * 1440) delete present[k];
  const settle = (o) => {
    o.timelineChanges = (o.timelineChanges || []).filter((c) => !(c.only && c.dropped && present[c.dropped] > c.taken))
      .map((c) => { if (c.dropped && present[c.dropped] > c.taken) { const { dropped, ...rest } = c; return rest; } return c; });
    if (o.dropNoted && !o.timelineChanges.some((c) => c.dropped === o.dropNoted)) o.dropNoted = '';
  };
  const inWindow = (o) => !!o.lastCall && min(o.lastCall) - now <= SLEEP_MIN;
  const jobGone = (o) => !!o.lastSeat && !!o.lastSrc && readNow[o.lastSrc] && !seatsNow[o.lastSeat] && present[o.lastTrain] !== s.taken;
  for (const [turn, { call, train, ordered, seat, since }] of expect) {
    // Their train showed someone else (offAt) and they're listed again: on
    // the same train it was a swap put right, on another the old wait is over.
    if (open[turn] && open[turn].offAt) {
      if (train === open[turn].lastTrain) delete open[turn].offAt;
      else { takenOff(turn, open[turn], open[turn].offAt); delete open[turn]; }
    }
    // A wait from Sarnia's line-up ends when the L501 home takes over: the
    // L501 is a wait of its own, from when Garnet first showed it.
    if (open[turn] && /^L501/.test(train) && open[turn].lastTrain && !/^L501/.test(open[turn].lastTrain)) delete open[turn];
    const fresh = !open[turn];
    const o = open[turn] || (open[turn] = { turn, firstSeen: s.taken, firstCall: call, firstTrain: train, shifts: [], timelineChanges: [], timelineComplete: true });
    if (!o.timelineChanges) { o.timelineChanges = []; o.timelineComplete = false; }
    const changed = (!o.lastCall && ordered) || (o.lastCall && (call !== o.lastCall || train !== o.lastTrain || ordered && !o.lastOrdered));
    let why = '';
    try { why = fresh || changed ? whyFor(turn, train, call, ordered, seat, fresh ? null : o) : ''; } catch { /* the record matters more than its reason */ }
    if (fresh) o.firstWhy = why;
    // A train already on Toronto's line-up when they went off duty: their
    // notice runs from going off duty (since), not from this check.
    if (fresh && since && seatsNow[seat]) {
      const shown = mem.first[firstKey(seatsNow[seat])] || s.taken;
      const from = since > shown ? since : shown;
      if (from <= s.taken && now - min(from) < 1440) Object.assign(o, { firstSeen: from, firstFrom: from === since ? 'offDuty' : '' });
      if (o.firstFrom) o.firstWhy = `off duty at the Toronto bunkhouse; ${train} was already on the line-up`;
    }
    // Moved to another job because theirs was pulled; an ordered time that moved.
    const dropped = !fresh && o.lastTrain && train !== o.lastTrain && o.dropNoted !== o.lastTrain && inWindow(o) && jobGone(o) ? o.lastTrain : '';
    const orderFrom = !fresh && o.lastOrdered && ordered && train === o.lastTrain && call !== o.lastCall ? o.lastCall : '';
    if (changed) {
      o.timelineChanges.push({ taken: s.taken, call, train, ordered, ...(why ? { why } : {}), ...(dropped ? { dropped, droppedFrom: o.lastSrc || '' } : {}), ...(orderFrom ? { orderFrom } : {}) });
    }
    if (train !== o.lastTrain) o.dropNoted = '';
    const away = min(call) - now;
    if (!o.sleepAt && away <= SLEEP_MIN) {
      Object.assign(o, { sleepAt: s.taken, expected: call, expectedTrain: train, notice: away, short: o.firstSeen === s.taken });
    } else if (o.sleepAt && (call !== o.lastCall || train !== o.lastTrain)) {
      o.shifts.push({ taken: s.taken, call, train });
    }
    if (train !== o.lastTrain) Object.assign(o, { trainSince: s.taken, moved: !!o.lastTrain });
    Object.assign(o, { lastCall: call, lastTrain: train, lastOrdered: ordered, lastSeen: s.taken, lastSeat: seat || o.lastSeat || '', lastSrc: (seatsNow[seat] || {}).src || o.lastSrc || '' });
  }
  // What this check showed, for the next one's reasons. A list not read in
  // this check keeps what it last showed.
  for (const seat of Object.values(seatsNow)) { const k = firstKey(seat); if (!mem.first[k]) mem.first[k] = s.taken; }
  for (const [k, x] of Object.entries(prevSeats)) if (readNow[x.src]) delete prevSeats[k];
  for (const [k, x] of Object.entries(seatsNow)) prevSeats[k] = { turn: x.turn, train: x.train, src: x.src };
  for (const [src, yes] of Object.entries(readNow)) if (yes) mem.read[src] = s.taken;
  for (const [k, at] of Object.entries(mem.first)) if (now - min(at) > 3 * 1440) delete mem.first[k];

  // Who went on duty: the Call Board's crews (a spare person filling in
  // instead of the job's own turn) and the yard jobs' crews.
  const went = [];
  const boarded = new Map(); // train → the turns the Call Board has on it
  const eng = (craft) => craft !== 'CO';
  for (const t of s.onDuty || []) {
    const fills = t.backfill || [];
    // S501 is two turns (CO, EN): a fill-in replaces only its own craft.
    const crew = crewOf(t.crew).filter((x) => !fills.some((b) => b.job === x.turn && (!/^S5\d{2}$/.test(x.turn) || eng(b.craft) === eng(x.craft))));
    for (const c of [...crew, ...fills]) {
      const turn = nameOf(c.turn, c.craft);
      went.push({ turn, train: t.train, onDuty: t.onDuty, craft: c.craft === 'CO' ? 'CO' : 'EN', job: c.job || '' });
      if (!boarded.has(t.train)) boarded.set(t.train, new Set());
      boarded.get(t.train).add(turn);
    }
  }
  for (const j of s.yardJobs || []) for (const c of crewOf(j.crew)) if (j.onDuty) went.push({ turn: nameOf(c.turn, c.craft), train: j.job, onDuty: j.onDuty, yard: true });
  const s5Kind = (train) => (/^L(501|502)/.exec(train || '') || [])[1];
  for (const w of went) {
    // Out on an L502: they bring the same day's L501 home.
    if (/^L502/.test(w.train || '') && !w.yard && !(home[w.turn] && home[w.turn].train === w.train.replace(/^L502/, 'L501'))) home[w.turn] = { train: w.train.replace(/^L502/, 'L501'), seen: s.taken };
    const o = open[w.turn];
    const at = BoardTrains.resolve(w.onDuty, s.taken);
    if (!o || !at || isDone(w.turn, w.train, at)) continue;
    // Already on duty when this wait was first seen: it is not the call for
    // it (owner, 2026-11-12, shown SD09 on M39671 23: on duty 25 Oct 0400,
    // first seen lined up at 1134 for that night's X27331 26, and scored as
    // called 22 hours early). The wait for the next trip stays open. Seen
    // late on the very train they are out on (a gap in the checks), there is
    // nothing to score and nothing left to wait for.
    if (min(o.firstSeen) > min(at)) {
      const base = (t) => String(t || '').replace(/ \d\d$/, '');
      if (w.train === o.lastTrain || base(w.train) === base(o.lastTrain)) { done[doneKey(w.turn, w.train, at)] = s.taken; delete open[w.turn]; }
      continue;
    }
    // L501 home isn't the call for an L502 they're waiting on (owner,
    // 2026-11-10; was "30 h early"). It is scored against Garnet's line-up
    // when that was read (above).
    if (s5Kind(w.train) && s5Kind(o.lastTrain) && s5Kind(w.train) !== s5Kind(o.lastTrain)) continue;
    // Nor for any other train a fill-in was waiting on: unscored without Garnet's line-up.
    if (s5Kind(w.train) === '501' && s5Kind(o.lastTrain) !== '501') continue;
    // Taken off their train, then on duty on another: the old wait is over.
    if (o.offAt && w.train !== o.lastTrain) { takenOff(w.turn, o, o.offAt); delete open[w.turn]; continue; }
    const call = BoardTrains.fromMin(min(at) - CALL_LEAD);
    // Called for a train they weren't lined up for: say so, and who was.
    let calledWhy = '';
    try {
      if (w.train !== o.lastTrain) {
        const p = before[`${w.train}|${w.craft}`];
        calledWhy = `Called for ${w.train}${w.job ? `, working ${w.job}` : ''}, not the ${o.lastTrain} they were lined up for` +
          (p && p.turn && p.turn !== w.turn ? `; ${p.turn} was lined up for it${whereNow(p.turn, { train: w.train, skipped: [] })}` : '');
      }
    } catch { /* the record matters more than its reason */ }
    settle(o);
    // Never within 8 h before it came: compare with the last call it showed.
    const expected = o.expected || o.lastCall;
    out[`${w.turn}|${w.train}|${at}`] = {
      turn: w.turn, train: w.train, yard: !!w.yard, onDuty: at, call, seen: s.taken,
      expected, expectedTrain: o.expectedTrain || o.lastTrain, sleepAt: o.sleepAt || null, notice: o.notice ?? null, short: !!o.short,
      noWindow: !o.sleepAt, firstSeen: o.firstSeen, firstCall: o.firstCall, firstWhy: o.firstWhy || '', firstTrain: o.firstTrain || '', firstFrom: o.firstFrom || '', calledWhy, shifts: o.shifts, timelineChanges: o.timelineChanges || [], timelineComplete: !!o.timelineComplete,
      off: min(call) - min(expected), // + called later than expected, − earlier
    };
    done[doneKey(w.turn, w.train, at)] = s.taken;
    delete open[w.turn];
  }
  // Taken off: the wait they slept on ends here (a record without a call);
  // not asleep yet, it just starts again when they're lined up again.
  // Someone else shown on their train isn't taken off yet (owner,
  // 2026-11-10: the line-up swapped the 501/502 crews minutes before the
  // call, three nights, and the real call was lost): it waits SWAP_WAIT for
  // the Call Board or the line-up to say who has it.
  const read = (s.lineup || []).length + (s.macLineup || []).length > 0;
  for (const [turn, o] of Object.entries(open)) {
    if (expect.has(turn)) continue;
    const others = listed.get(o.lastTrain);
    if (others && !others.has(turn) && !o.offAt) {
      o.offAt = s.taken;
      // Who is on their job now, where that turn was the check before, and
      // what their own board says about them.
      const q = seatsNow[o.lastSeat];
      const was = q ? Object.values(before).find((x) => x.turn === q.turn && x.train !== o.lastTrain) : null;
      o.offWho = q ? q.turn : [...others].join(' + ');
      o.offWhy = q ? (was ? `moved from ${was.train}` : 'not on a list the check before') : '';
      o.offSelf = '';
      for (const pool of s.pools || []) for (const t of pool.turns || []) if (t.turn === baseOf(turn) && t.status && t.status !== 'available' && !o.offSelf) o.offSelf = t.status;
    }
    // Their job is gone from its list with nobody on it and no call: marked
    // on the graph, which carries on (in the eight hours before the call only).
    if (!o.dropNoted && !o.offAt && inWindow(o) && jobGone(o)) {
      o.dropNoted = o.lastTrain;
      o.timelineChanges = o.timelineChanges || [];
      o.timelineChanges.push({ taken: s.taken, call: o.lastCall, train: o.lastTrain, dropped: o.lastTrain, droppedFrom: o.lastSrc || '', only: true, why: `${o.lastTrain} dropped off the ${o.lastSrc} without being called` });
    }
    // Their train is on the Call Board without them.
    if (boarded.has(o.lastTrain) && (o.offAt || /^S5/.test(turn) || now - min(o.trainSince || o.firstSeen) < SWAP_WAIT)) {
      // 501/502: the train went with the other crew's number (or a make-up
      // crew's). It was never this crew's day: the line-up had the wrong one
      // of the two, so there is nothing to record (owner, 2026-11-10: "the
      // train goes every day it doesn't get removed from the line up").
      const wentRow = /^S5/.test(turn) ? (s.onDuty || []).find((t) => t.train === o.lastTrain) : null;
      if (wentRow && !crewOf(wentRow.crew).some((c) => c.turn === baseOf(turn))) { delete open[turn]; continue; }
      // On it only for a moment (the swap's other side): never a wait.
      const blip = now - min(o.trainSince || o.firstSeen) < SWAP_WAIT;
      if (blip && o.moved) { delete o.offAt; continue; } // their own train is still to come
      if (!blip) takenOff(turn, o, o.offAt || s.taken);
      delete open[turn];
      continue;
    }
    // Garnet's line-up isn't read every check: a gap there isn't "taken off".
    const off = (o.offAt && now - min(o.offAt) >= SWAP_WAIT) || (read && !/^L501/.test(o.lastTrain || '') && now - min(o.lastSeen) >= TAKEN_OFF_MIN);
    if (off) takenOff(turn, o, o.offAt || s.taken);
    if (off || now - min(o.lastSeen) > DROP_AFTER) delete open[turn];
  }
}

// The lists for the page, oldest first.
// The turn the board had against the turn charged, by craft, for a train that went (owner, 2026-11-14):
// sameSpare when the spare the board had for its turn is the one who worked the other turn's job (the right
// person on the wrong turn).
function chargedOf(r) {
  const b = r.board;
  if (!b || !r.onDuty || r.fixed) return {};
  const crew = r.crewLast ?? r.crew;
  const out = [];
  for (const [craft, re] of [['CO', /(?:^|· )CO (\S+)/], ['EN', /(?:^|· )(?:EN|LE) (\S+)/]]) {
    const had = craft === 'CO' ? b.co : b.en;
    const spare = craft === 'CO' ? b.coSpare : b.enSpare;
    const went = (re.exec(crew || '') || [])[1];
    if (!had || !went || went === had) continue;
    const by = (r.workedBy || []).find((w) => w.job === went && (craft === 'CO' ? w.craft === 'CO' : /^(EN|LE)$/.test(w.craft)));
    out.push({ craft, board: had, boardSpare: spare || '', went, by: by ? by.turn : '', sameSpare: !!(by && spare && by.turn === spare) });
  }
  return out.length ? { charged: out } : {};
}

function finish(state) {
  const by = (k) => (a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0);
  return {
    runarounds: Object.values(state.runarounds).map(({ out, ...r }) => ({ ...r, fixed: out === false, wrongChecks: (r.stretches || []).reduce((n, x) => n + x.checks, 0), ...chargedOf({ ...r, fixed: out === false }) })).sort(by('taken')),
    spareJobs: Object.values(state.spareJobs).sort(by('first')),
    // Yardmaster jobs going spare (CC YA), by start (owner, 2026-11-13).
    yardmasterJobs: Object.values(state.yardmaster || {}).sort((a, b) => ((a.at || a.first) < (b.at || b.first) ? -1 : 1)),
    // Records saved before the rule above: a call whose wait was first seen
    // after the turn had gone on duty was never a call for that wait.
    sleep: Object.values(state.sleep || {}).filter((z) => z.takenOff || !z.firstSeen || !z.onDuty || z.firstSeen <= z.onDuty).sort(by('onDuty')),
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
