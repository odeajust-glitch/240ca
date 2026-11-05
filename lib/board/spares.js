// The spareboards (owner, 2026-10-24): who's expected to fill each job going
// spare. Used by the site (lib/board/site.js) and the turn alerts
// (lib/board/alerts.js).
const config = require('./config');
const { callTime, poolOf } = require('./engine');
const { fmt } = require('./time');
const { offAt, maybeOff, offText } = require('./daysoff');
const yardMinutes = (job) => (/^YSBY/.test(job || '') ? 12 * 60 : 8 * 60);

// B0 = working another job: the turn keeps its spot on the board but can't
// be called, so it's passed over (owner, 2026-10-25).
const isB0 = (t) => t.st === 'B0' || t.rn === 'B0';
// On a hold turn past the call (HT; no end time shown = still held).
const heldPast = (t, call) => t.rn === 'HT' && (t.statusUntil == null || t.statusUntil > call);

// Who fills each job going spare (owner, 2026-10-24): yard jobs from the
// fast board, road jobs from the slow board; engineer jobs (CC EN/LE/ET)
// from the engineer boards, the rest from the conductor boards. Each board
// in position order, earliest job first; a turn still on rest at the call
// is passed over and keeps its place. Call: a road job's time is its order
// time (call = order − prep − 2 h); a yard job's time is its start (call
// taken as 2 h before). → per job { turn, board, call, skipped } or null.
// taken: spares already given a job (a second pass for jobs that may go spare).
// A spare with a PL (lib/board/daysoff.js): a yard job running into it, or
// a road job 24 h or less before it, passes them over; 24–36 h before a
// road job's PL they keep it and `warn` is the next spare after them.
function spareFills(vacancies, boards, taken = new Set()) {
  const used = new Set(taken);
  const out = new Map();
  for (const v of [...vacancies].filter((x) => x.at != null).sort((a, b) => a.at - b.at)) {
    const eng = /^(EN|LE|ET)$/.test(v.cc);
    const key = `${eng ? 'en' : 'co'}${v.yard ? 'Fast' : 'Slow'}`;
    const list = (boards || {})[key];
    if (!list) { out.set(v, null); continue; }
    const call = v.yard ? v.at - config.callLeadMinutes : callTime(v.at, /^DH/.test(v.train || ''), config);
    const skipped = [];
    let pick = null;
    let warn = null;
    const yardMin = v.yard ? yardMinutes(v.train) : null;
    for (const t of list) {
      if (used.has(t.turn)) continue;
      if (pick) {
        // After a pick with a PL 24–36 h away: the next one who could go.
        if (isB0(t) || heldPast(t, call) || (t.restUntil != null && t.restUntil > call) || offAt(t, call)) continue;
        warn = { turn: t.turn, why: `${pick.turn} has a ${offText(maybeOff(pick, call))}` };
        break;
      }
      // B0: working another job; holds the spot but can't be called (owner, 2026-10-25).
      if (isB0(t)) { skipped.push(`${t.turn} (B0, working)`); continue; }
      // A hold turn past the call (owner, 2026-10-25: B132 was lined up while held).
      if (heldPast(t, call)) { skipped.push(`${t.turn} (hold turn${t.statusUntil != null ? ` until ${fmt(t.statusUntil)}` : ''})`); continue; }
      if (t.restUntil != null && t.restUntil > call) { skipped.push(`${t.turn} (rest until ${fmt(t.restUntil)})`); continue; }
      // A PL (option 4, owner 2026-11-05): see above.
      const off = offAt(t, call, { yardMin });
      if (off) { skipped.push(`${t.turn} (${offText(off)}${v.yard ? `, the job runs to ~${fmt(v.at + yardMin)}` : ''})`); continue; }
      pick = t;
      if (v.yard || !maybeOff(t, call)) break;
    }
    if (pick) used.add(pick.turn);
    out.set(v, { turn: pick ? pick.turn : '', board: `${eng ? 'Engineer' : 'Conductor'} ${v.yard ? 'fast' : 'slow'} board`, call, skipped, ...(warn ? { warn } : {}) });
  }
  return out;
}

// A job going spare that's already on duty (on the Call Board) is filled,
// even while it's still on the vacancy list. Matched on the job and its time
// (within 3 h): yard jobs and trains run every day under the same name
// (owner, 2026-10-25: yesterday's YPRS60 on duty hid tonight's).
const SAME_RUN = 180;
function onDutyAlready(job, yardJobs = [], callBoard = []) {
  if (job.at == null) return false;
  if (yardJobs.some((y) => y.job === job.train && y.onDuty != null && Math.abs(y.onDuty - job.at) <= SAME_RUN)) return true;
  return callBoard.some((t) => t.symbol === job.train && t.onDuty != null && Math.abs(t.onDuty + config.prepMinutes.train - job.at) <= SAME_RUN);
}

// A road job with no one free on its slow board: the next Chain Gang turn
// at home may be called for it (owner, 2026-10-25): SD for an engineer job,
// SR for a conductor job. List in position order; turns out working, on
// rest or a hold turn past the call, or already lined up for a train (busy)
// are passed over. engineers: true = engineer jobs, false = the others.
// → Map job → { turn, call } for those jobs.
function backups(jobs, fills, list, busy = new Set(), engineers = true) {
  const out = new Map();
  const taken = new Set(busy);
  const queue = [...(list || [])].filter((t) => !t.working).sort((a, b) => a.pos - b.pos);
  for (const j of [...jobs].filter((x) => x.at != null).sort((a, b) => a.at - b.at)) {
    const f = fills.get(j);
    if (!f || f.turn || j.yard || /^(EN|LE|ET)$/.test(j.cc) !== engineers) continue;
    const pick = queue.find((t) => !taken.has(t.turn) && !isB0(t) && !(t.restUntil != null && t.restUntil > f.call) && !heldPast(t, f.call) && !offAt(t, f.call));
    if (!pick) continue;
    taken.add(pick.turn);
    out.set(j, { turn: pick.turn, call: f.call });
  }
  return out;
}

const sdBackups = (jobs, fills, sd, busy) => backups(jobs, fills, sd, busy, true);
const srBackups = (jobs, fills, sr, busy) => backups(jobs, fills, sr, busy, false);

// CATS's option 5 against the order (owner, 2026-11-02: E27861 02's
// conductor job listed as SA09's (A pool) going spare while the order, and
// the line-up, had SR05 on it: "CATS is wrong, the turn showing is
// correct"). Each road job on a train in the line-up predictions (same
// train number, the run closest in time within MATCH_MIN) is checked craft
// by craft against the order's turn:
//   same turn       → kept, at the line-up's time (option 5's can be stale)
//   another turn    → a CATS error; kept with the order's turn if that turn
//                     also goes spare, else no job at all
//   no train / yard / 501-502 / no order turn → kept as CATS shows it
// → { corrected: [jobs], errors: [{ job, train, craft, cats, order, at }] }
const MATCH_MIN = 12 * 60;
function checkVacancies(jobs = [], predictions = []) {
  const corrected = [];
  const errors = [];
  for (const j of jobs) {
    const eng = /^(EN|LE|ET)$/.test(j.cc);
    const near = j.yard || j.pool === 'S5' || j.at == null ? []
      : predictions.filter((p) => p.symbol === j.train && p.pool !== 'S5' && p.order != null && Math.abs(p.order - j.at) <= MATCH_MIN);
    const p = near.sort((a, b) => Math.abs(a.order - j.at) - Math.abs(b.order - j.at))[0];
    const turn = p && (eng ? p.engineer : p.turn);
    if (!p || !turn) { corrected.push(j); continue; }
    const spare = !!(eng ? p.engineerSpare : p.spare);
    const at = p.order;
    // trainDay: the line-up's train ("Z14891 05"), so a spare told from the
    // order and then from option 5 hears about one train, not two.
    const trainDay = `${p.symbol} ${p.originDay}`;
    if (turn === j.turn) { corrected.push({ ...j, at, trainDay }); continue; }
    const train = trainDay;
    errors.push({ job: j, train, craft: eng ? 'EN' : 'CO', cats: { turn: j.turn, pool: j.pool }, order: { turn, pool: poolOf(turn), spare }, at });
    if (spare) corrected.push({ ...j, turn, pool: turn.slice(0, 2), at, catsTurn: j.turn, trainDay });
  }
  return { corrected, errors };
}

module.exports = { spareFills, onDutyAlready, sdBackups, srBackups, checkVacancies };
