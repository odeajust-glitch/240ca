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
  return { board, drift, predict: predict(trains), spare: spareCalls(state.spares, times), lead: lead.filter((b) => b.miss.length >= 20).map((b) => ({ lo: b.lo, hi: b.hi, n: b.miss.length, typical: quantile(b.miss, 0.5), within1h: share(b.miss, (x) => x <= 60), off2h: share(b.miss, (x) => x >= 120) })) };
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
function predict(trains = []) {
  const bySym = {};
  const all = {};
  for (const r of trains) {
    if (r.from !== 'sarnia' || !r.onDuty || r.deadhead) continue;
    const od = min(r.onDuty);
    const sym = (/^([A-Z]+\d{3})/.exec(r.id || '') || [])[1];
    const ev = (r.events || []).filter((e) => e.at && /^(seen|planChange|ordered|orderChange|back)$/.test(e.kind)).map((e) => ({ t: min(e.taken), at: min(e.at), ord: /^order/.test(e.kind) })).sort((a, b) => a.t - b.t);
    if (!sym || od == null || !ev.length) continue;
    const mine = {}; // bucket → this run's misses while planned
    for (let t = ev[0].t; t <= od - 120; t += 60) {
      const past = ev.filter((e) => e.t <= t);
      if (past.some((e) => e.ord)) break; // ordered: the shown time is the answer
      const cur = past[past.length - 1];
      (mine[awayOf((cur.at - t) / 60)] || (mine[awayOf((cur.at - t) / 60)] = [])).push(od - cur.at);
    }
    for (const [b, a] of Object.entries(mine)) {
      const one = quantile(a, 0.5); // one figure a run, so a train that sat for a day doesn't outweigh the rest
      ((bySym[sym] || (bySym[sym] = {}))[b] || (bySym[sym][b] = [])).push(one);
      (all[b] || (all[b] = [])).push(one);
    }
  }
  const out = { trains: {}, all: table(all) };
  for (const [sym, o] of Object.entries(bySym)) { const t = table(o); if (Object.keys(t).length) out.trains[sym] = t; }
  return out;
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

module.exports = { spareCalls, collect, finish, rankOf, predict, awayOf };
