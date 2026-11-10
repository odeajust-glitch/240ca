// Patterns in the saved checks (owner, 2026-11-10: "find patterns or ways to
// predict line ups that maybe wouldn't be obvious"). Published as
// data/patterns.json and, for now, shown only on the test site:
//   board  an available spare at this place on a spareboard → how long until
//          it was actually on duty
//   drift  a Sarnia train (letters + number, "E278") → how far on duty landed from its first plan
//   lead   the time shown this far before on duty → how wrong it was
//   predict  a planned Sarnia train → the window its call has landed in
//   spare  a spare, by the job shown beside it or by its place → the same for its call
// Rebuilt from the day files on every publish: collect() each day's
// snapshots in order, then finish() with the trains.
const BoardTrains = require('../../public/board-trains');

const min = BoardTrains.toMin;
const BOARD = /^(Conductor|Engineer) (fast|slow) board/;
const RANKS = [[1, '1st'], [2, '2nd'], [3, '3rd'], [5, '4th–5th'], [8, '6th–8th'], [Infinity, '9th or more']];
const rankOf = (n) => RANKS.find(([top]) => n <= top)[1];
const LEADS = [[16, 24], [12, 16], [8, 12], [6, 8], [4, 6], [3, 4], [2, 3]];
const quantile = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : null; };
const share = (a, f) => (a.length ? Math.round((100 * a.filter(f).length) / a.length) : 0);

function collect(snapshots, state = {}) {
  const duty = state.duty || (state.duty = {}); // turn → on-duty minutes, for whoever is seen working
  const samples = state.samples || (state.samples = []); // { board, rank, turn, at }
  const last = state.last || (state.last = {});
  const spares = state.spares || (state.spares = []); // { craft, turn, at, place, kind, call }: one look an hour a spare
  const lastSpare = state.lastSpare || (state.lastSpare = {});
  for (const s of snapshots || []) {
    const now = min(s.taken);
    if (now == null) continue;
    const seen = (turn, onDuty) => { const at = min(BoardTrains.resolve(onDuty, s.taken)); if (turn && at != null) (duty[turn] || (duty[turn] = new Set())).add(at); };
    const crew = (text) => String(text || '').split(' · ').map((c) => c.trim().split(' ')[1]).filter(Boolean);
    for (const t of s.onDuty || []) { for (const b of t.backfill || []) seen(b.turn, t.onDuty); for (const c of crew(t.crew)) if (/^(B|EN)\d/.test(c)) seen(c, t.onDuty); }
    for (const j of s.yardJobs || []) for (const c of crew(j.crew)) seen(c, j.onDuty);
    const here = {}; // turn → this check's look at a spare, over both of its boards
    for (const p of s.pools || []) {
      const m = BOARD.exec(p.name || '');
      if (!m) continue;
      const board = `${m[1]} ${m[2]}`;
      let n = 0;
      for (const t of p.turns || []) {
        if (t.left) continue;
        const open = t.status === 'available';
        if (open) n++;
        if (open || t.job) {
          const o = here[t.turn] || (here[t.turn] = { craft: m[1], turn: t.turn, at: now, place: null, kind: null, call: null });
          if (open) o.place = Math.min(o.place || Infinity, n); // the better of its two places
          const call = t.job ? min(BoardTrains.resolve(t.job.call, s.taken)) : null;
          if (call != null) { o.kind = t.job.yard ? 'yard' : 'train'; o.call = call; }
        }
        if (!open) continue;
        const key = `${board}|${t.turn}`;
        if (last[key] != null && now - last[key] < 60) continue; // one look an hour per turn
        last[key] = now;
        samples.push({ board, rank: rankOf(n), turn: t.turn, at: now });
      }
    }
    for (const o of Object.values(here)) {
      if (lastSpare[o.turn] != null && now - lastSpare[o.turn] < 60) continue;
      lastSpare[o.turn] = now;
      spares.push(o);
    }
  }
  return state;
}

function finish(state = {}, trains = []) {
  const board = {};
  const times = {};
  for (const [turn, set] of Object.entries(state.duty || {})) times[turn] = [...set].sort((a, b) => a - b);
  const waits = {};
  for (const x of state.samples || []) {
    const next = (times[x.turn] || []).find((t) => t > x.at - 120);
    if (next == null || next - x.at > 72 * 60) continue; // not seen working within 3 days: left out
    ((waits[x.board] || (waits[x.board] = {}))[x.rank] || (waits[x.board][x.rank] = [])).push(Math.max(0, next - x.at));
  }
  for (const [name, byRank] of Object.entries(waits)) {
    board[name] = RANKS.map(([, r]) => r).filter((r) => (byRank[r] || []).length >= 15).map((r) => {
      const a = byRank[r];
      return { rank: r, n: a.length, median: quantile(a, 0.5), quarter: quantile(a, 0.25), most: quantile(a, 0.75), in4: share(a, (x) => x <= 240), in8: share(a, (x) => x <= 480) };
    });
  }
  // A train's habit: on duty against its first plan, by number (Sarnia, not deadheads).
  const byNum = {};
  const lead = LEADS.map(([lo, hi]) => ({ lo, hi, miss: [] }));
  for (const r of trains || []) {
    if (r.from !== 'sarnia' || !r.onDuty || r.deadhead) continue;
    const od = min(r.onDuty);
    // By the letters and the number together: X278 is an extra, not the regular E278 (owner, 2026-11-10).
    const num = (/^([A-Z]+\d{3})/.exec(r.id || '') || [])[1];
    if (num && r.firstPlan) (byNum[num] || (byNum[num] = [])).push(od - min(r.firstPlan));
    const shown = (r.events || []).filter((e) => e.at && /^(seen|planChange|ordered|orderChange|back)$/.test(e.kind)).map((e) => ({ t: min(e.taken), at: min(e.at) })).sort((a, b) => a.t - b.t);
    for (const b of lead) { const cur = shown.filter((e) => e.t <= od - ((b.lo + b.hi) / 2) * 60).pop(); if (cur) b.miss.push(Math.abs(cur.at - od)); }
  }
  const drift = {};
  for (const [num, a] of Object.entries(byNum)) if (a.length >= 8) drift[num] = { n: a.length, median: quantile(a, 0.5), later: share(a, (x) => x > 30), earlier: share(a, (x) => x < -30), within30: share(a, (x) => Math.abs(x) <= 30) };
  return { board, drift, predict: predict(trains), score: score(trains), spare: spareCalls(state.spares, times), lead: lead.filter((b) => b.miss.length >= 20).map((b) => ({ lo: b.lo, hi: b.hi, n: b.miss.length, typical: quantile(b.miss, 0.5), within1h: share(b.miss, (x) => x <= 60), off2h: share(b.miss, (x) => x >= 120) })) };
}

// When a planned Sarnia train will really go (owner, 2026-11-10: "a
// prediction on when trains will be called based on historical data at
// certain points when people are checking the board ... an indication of
// accuracy"). For every hour a train sat on the line-up still planned: how
// far its shown time then was from the on-duty time it ended with, kept by
// train (letters + number) and by how far away the shown time was. A window
// is given, not one time, and each window says how often it held when every
// run was tested against that train's other runs.
const AWAY = [['past', -Infinity, 0], ['0-3', 0, 3], ['3-6', 3, 6], ['6-10', 6, 10], ['10-16', 10, 16], ['16-24', 16, 24], ['24+', 24, Infinity]];
const awayOf = (hours) => AWAY.find(([, lo, hi]) => hours >= lo && hours < hi)[0];
const WIDE = [0.05, 0.95]; // the "nearly always" window: a little wider than 8 in 10 while a train has few runs
const LIKELY = [0.25, 0.75];
const MIN_RUNS = 6;
const CALL_LEAD = 120; // the call comes 2 h before on duty
const SLEEP = 480;
// A window from one figure a run: where nearly all fell, where half fell, and
// how many runs each window held when every run was tested against the rest.
const stats = (a) => {
  if (a.length < MIN_RUNS) return null;
  const inside = (band) => a.filter((x, i) => { const rest = a.filter((_, j) => j !== i); return x >= quantile(rest, band[0]) && x <= quantile(rest, band[1]); }).length;
  return { n: a.length, mid: quantile(a, 0.5), lo: quantile(a, WIDE[0]), hi: quantile(a, WIDE[1]), likelyLo: quantile(a, LIKELY[0]), likelyHi: quantile(a, LIKELY[1]), held: inside(WIDE), likelyHeld: inside(LIKELY) };
};
const table = (o) => Object.fromEntries(Object.entries(o).map(([b, a]) => [b, stats(a)]).filter(([, x]) => x));
// One Sarnia run's figures while it was still planned: for each distance of
// its shown time, the middle of (real on duty − shown time) over its hourly
// looks there, and when the first of those looks was.
function runFigures(r) {
  if (r.from !== 'sarnia' || !r.onDuty || r.deadhead) return null;
  const od = min(r.onDuty);
  const sym = (/^([A-Z]+\d{3})/.exec(r.id || '') || [])[1];
  const ev = (r.events || []).filter((e) => e.at && /^(seen|planChange|ordered|orderChange|back)$/.test(e.kind)).map((e) => ({ t: min(e.taken), at: min(e.at), ord: /^order/.test(e.kind) })).sort((a, b) => a.t - b.t);
  if (!sym || od == null || !ev.length) return null;
  const looks = {}; // bucket → this run's misses while planned
  const first = {};
  for (let t = ev[0].t; t <= od - 120; t += 60) {
    const past = ev.filter((e) => e.t <= t);
    if (past.some((e) => e.ord)) break; // ordered: the shown time is the answer
    const cur = past[past.length - 1];
    const b = awayOf((cur.at - t) / 60);
    (looks[b] || (looks[b] = [])).push(od - cur.at);
    if (first[b] == null) first[b] = t;
  }
  // One figure a run, so a train that sat for a day doesn't outweigh the rest.
  return { id: r.id, sym, od, figs: Object.fromEntries(Object.entries(looks).map(([b, a]) => [b, { miss: quantile(a, 0.5), at: first[b] }])) };
}
function predict(trains = []) {
  const bySym = {};
  const all = {};
  for (const r of trains) {
    const f = runFigures(r);
    if (!f) continue;
    for (const [b, x] of Object.entries(f.figs)) {
      ((bySym[f.sym] || (bySym[f.sym] = {}))[b] || (bySym[f.sym][b] = [])).push(x.miss);
      (all[b] || (all[b] = [])).push(x.miss);
    }
  }
  const out = { trains: {}, all: table(all) };
  for (const [sym, o] of Object.entries(bySym)) { const t = table(o); if (Object.keys(t).length) out.trains[sym] = t; }
  return out;
}

// The likely-call window, tested forward (owner, 2026-11-10: "track it for 2
// weeks. Use the data its collecting and test to see how accurate the
// predictions are. If its more beneficial than the time it shows over 2 weeks
// maybe we can push it [to] the main site"). Every run is scored against a
// window built only from trains already on duty before the look, the way the
// page had it at the time: once at each distance it was seen planned. Three
// yardsticks against the shown time: is the "most often" time closer than the
// shown one, how often the window held, and whether the window covered the
// calls that came well before the shown time. `test` is the two weeks from
// TEST_FROM; `before` is the same replay over the days saved before it.
const TEST_FROM = '2026-11-11 0000';
const TEST_DAYS = 14;
const EARLY = 30; // a call this much before the shown one is an early call
const TIE = 10;
const PREP = 15; // a Sarnia train is on duty 15 min before its order time
function score(trains = [], { from = TEST_FROM, days = TEST_DAYS } = {}) {
  const start = min(from);
  const end = start + days * 1440;
  const runs = (trains || []).map(runFigures).filter(Boolean).sort((a, b) => a.od - b.od);
  const checks = [];
  for (const r of runs) {
    for (const [b, x] of Object.entries(r.figs)) {
      const prior = runs.filter((o) => o.od < x.at && o.figs[b]);
      const own = prior.filter((o) => o.sym === r.sym).map((o) => o.figs[b].miss);
      const a = own.length >= MIN_RUNS ? own : prior.map((o) => o.figs[b].miss);
      if (a.length < MIN_RUNS) continue; // the page showed no window
      const lo = quantile(a, WIDE[0]);
      const hi = quantile(a, WIDE[1]);
      checks.push({ id: r.id, od: r.od, b, miss: x.miss, lo, hi, mid: quantile(a, 0.5), own: own.length >= MIN_RUNS, held: x.miss >= lo && x.miss <= hi });
    }
  }
  const sum = (list) => {
    const n = list.length;
    // c.miss is real on duty less the shown order time. The call the line-up shows is the order less
    // PREP and 2 h, the real call is on duty less 2 h, so the shown call was off by miss + PREP.
    const shown = list.map((c) => Math.abs(c.miss + PREP));
    const likely = list.map((c) => Math.abs(c.miss - c.mid));
    const early = list.filter((c) => c.miss + PREP < -EARLY);
    return { checks: n, trains: new Set(list.map((c) => c.id)).size,
      shown: { within30: share(shown, (m) => m <= 30), within60: share(shown, (m) => m <= 60), typical: quantile(shown, 0.5) },
      likely: { within30: share(likely, (m) => m <= 30), within60: share(likely, (m) => m <= 60), typical: quantile(likely, 0.5) },
      closer: list.filter((c) => Math.abs(c.miss - c.mid) < Math.abs(c.miss + PREP) - TIE).length, further: list.filter((c) => Math.abs(c.miss - c.mid) > Math.abs(c.miss + PREP) + TIE).length,
      held: list.filter((c) => c.held).length, width: quantile(list.map((c) => c.hi - c.lo), 0.5),
      early: early.length, earlyCovered: early.filter((c) => c.miss >= c.lo).length };
  };
  const period = (list) => ({ ...sum(list), byAway: AWAY.map(([b]) => b).filter((b) => list.some((c) => c.b === b)).map((b) => ({ away: b, ...sum(list.filter((c) => c.b === b)) })) });
  const inTest = checks.filter((c) => c.od >= start && c.od < end);
  const byRun = {};
  for (const c of inTest) (byRun[c.id] || (byRun[c.id] = { id: c.id, onDuty: BoardTrains.fromMin(c.od), checks: [] })).checks.push({ away: c.b, miss: c.miss, lo: c.lo, hi: c.hi, mid: c.mid, held: c.held, own: c.own });
  return { from, days, test: period(inTest), before: period(checks.filter((c) => c.od < start)), runs: Object.values(byRun).sort((a, b) => (a.onDuty < b.onDuty ? 1 : -1)).slice(0, 200) };
}

// The same for a spare (owner, 2026-11-10: "can you do the same for the
// spareboard"). Each hourly look at a spare is matched to the next time that
// turn was on duty (within 3 days); its call is 2 h before that. Two tables,
// one figure a wait (the middle of its looks in that group):
//   job   a job shows beside the spare → the real call less the call shown,
//         by craft, yard job or train, and how far away the shown call was
//         ("Conductor|yard|3-6"); the same without the craft as a fallback
//   wait  nothing shows and the spare is available → minutes from the look to
//         the call, by craft and its better place on the two boards
//         ("Conductor|4th–5th"); in8 = the share called within 8 h
function spareCalls(spares = [], times = {}) {
  const job = {};
  const wait = {};
  const add = (o, key, run, x) => ((o[key] || (o[key] = {}))[run] || (o[key][run] = [])).push(x);
  for (const x of spares || []) {
    const next = (times[x.turn] || []).find((t) => t > x.at - CALL_LEAD);
    if (next == null || next - x.at > 72 * 60) continue;
    const call = next - CALL_LEAD;
    const run = `${x.turn}|${next}`;
    if (x.kind) {
      const away = awayOf((x.call - x.at) / 60);
      add(job, `${x.craft}|${x.kind}|${away}`, run, call - x.call);
      add(job, `${x.kind}|${away}`, run, call - x.call);
    } else if (x.place) add(wait, `${x.craft}|${rankOf(x.place)}`, run, call - x.at);
  }
  const runs = (o) => Object.fromEntries(Object.entries(o).map(([k, by]) => [k, Object.values(by).map((a) => quantile(a, 0.5))]));
  const waits = runs(wait);
  const out = { job: table(runs(job)), wait: table(waits) };
  for (const [k, x] of Object.entries(out.wait)) x.in8 = share(waits[k], (m) => m <= SLEEP);
  return out;
}

module.exports = { spareCalls, score, collect, finish, rankOf, predict, awayOf };
