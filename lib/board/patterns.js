// Patterns in the saved checks (owner, 2026-11-10: "find patterns or ways to
// predict line ups that maybe wouldn't be obvious"). Published as
// data/patterns.json and, for now, shown only on the test site:
//   board  an available spare at this place on a spareboard → how long until
//          it was actually on duty
//   drift  a Sarnia train number → how far on duty landed from its first plan
//   lead   the time shown this far before on duty → how wrong it was
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
  for (const s of snapshots || []) {
    const now = min(s.taken);
    if (now == null) continue;
    const seen = (turn, onDuty) => { const at = min(BoardTrains.resolve(onDuty, s.taken)); if (turn && at != null) (duty[turn] || (duty[turn] = new Set())).add(at); };
    const crew = (text) => String(text || '').split(' · ').map((c) => c.trim().split(' ')[1]).filter(Boolean);
    for (const t of s.onDuty || []) { for (const b of t.backfill || []) seen(b.turn, t.onDuty); for (const c of crew(t.crew)) if (/^(B|EN)\d/.test(c)) seen(c, t.onDuty); }
    for (const j of s.yardJobs || []) for (const c of crew(j.crew)) seen(c, j.onDuty);
    for (const p of s.pools || []) {
      const m = BOARD.exec(p.name || '');
      if (!m) continue;
      const board = `${m[1]} ${m[2]}`;
      let n = 0;
      for (const t of p.turns || []) {
        if (t.left || t.status !== 'available') continue;
        n++;
        const key = `${board}|${t.turn}`;
        if (last[key] != null && now - last[key] < 60) continue; // one look an hour per turn
        last[key] = now;
        samples.push({ board, rank: rankOf(n), turn: t.turn, at: now });
      }
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
    const num = (/^[A-Z]+(\d{3})/.exec(r.id || '') || [])[1];
    if (num && r.firstPlan) (byNum[num] || (byNum[num] = [])).push(od - min(r.firstPlan));
    const shown = (r.events || []).filter((e) => e.at && /^(seen|planChange|ordered|orderChange|back)$/.test(e.kind)).map((e) => ({ t: min(e.taken), at: min(e.at) })).sort((a, b) => a.t - b.t);
    for (const b of lead) { const cur = shown.filter((e) => e.t <= od - ((b.lo + b.hi) / 2) * 60).pop(); if (cur) b.miss.push(Math.abs(cur.at - od)); }
  }
  const drift = {};
  for (const [num, a] of Object.entries(byNum)) if (a.length >= 8) drift[num] = { n: a.length, median: quantile(a, 0.5), later: share(a, (x) => x > 30), earlier: share(a, (x) => x < -30), within30: share(a, (x) => Math.abs(x) <= 30) };
  return { board, drift, lead: lead.filter((b) => b.miss.length >= 20).map((b) => ({ lo: b.lo, hi: b.hi, n: b.miss.length, typical: quantile(b.miss, 0.5), within1h: share(b.miss, (x) => x <= 60), off2h: share(b.miss, (x) => x >= 120) })) };
}

module.exports = { collect, finish, rankOf };
