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

// A yard job CATS lists going spare only because the crew of its earlier
// shift hasn't been tied up yet (owner, 2026-11-05, option A: YPRS60 4th
// 2245 FO and S1 were on option 5 from 0645 until the 3rd 2245 crew tied
// up at ~1445, then dropped off; the regular crew worked it). No ** on the
// job (CATS's own sign the holder is off) and the same job still on duty
// from an earlier shift → that earlier shift { onDuty }, else null. It's
// "probably not going spare": no spare lined up, no alerts, until the
// earlier crew ties up and CATS still lists it.
//
// CATS's yard jobs list keeps a shift long after its crew ties up (owner,
// 2026-11-07: YEBS30 6th 1600 still listed at 7th 0833, its FO on a day
// off and the temporary FO on a hold turn; YMPS31 and YPRS60 from the 5th
// too). The crews-in-town list (town: summary's crewsInTown) shows a crew
// still working as "status not known" (YPRS60 FO and S1 until 1436 on the
// 4th, then "on rest until 4th 1645"): when every crew of that job and
// craft there has a real status (rest, rested, hold, day off …), the
// earlier shift is tied up. Not read: as before.
function untiedEarlier(job, yardJobs = [], town = null) {
  if (!job.yard || job.at == null || /\*\*/.test(job.st || '')) return null;
  const y = yardJobs.find((x) => x.job === job.train && x.onDuty != null && x.onDuty < job.at - SAME_RUN);
  if (!y) return null;
  const crews = (town || []).filter((p) => p.yard === job.train).flatMap((p) => p.crews || [])
    .filter((c) => c.craft === job.cc && !c.trainee && c.status !== 'open');
  if (crews.length && crews.every((c) => c.status !== 'other')) return null; // tied up
  return { onDuty: y.onDuty };
}
// What's really open on option 5: not on duty already, not an untied crew.
const openJob = (job, yardJobs = [], callBoard = [], town = null) => !onDutyAlready(job, yardJobs, callBoard) && !untiedEarlier(job, yardJobs, town);

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
    // 501/502 (not checked against the order, they alternate): still named
    // with the line-up's day (L50231 06), so the order's copy of the same
    // job isn't counted again (owner's 1424 check, 2026-11-05).
    if (j.pool === 'S5' && !j.yard && j.at != null) {
      const q = predictions.filter((x) => x.s5 && x.symbol === j.train && x.order != null && Math.abs(x.order - j.at) <= MATCH_MIN).sort((a, b) => Math.abs(a.order - j.at) - Math.abs(b.order - j.at))[0];
      corrected.push(q ? { ...j, trainDay: `${q.symbol} ${q.originDay}` } : j);
      continue;
    }
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

// Jobs the order says go spare that option 5 doesn't list (yet), as jobs
// for spareFills (owner, 2026-11-05: the spare expected is told right away,
// and shown beside their turn on the spareboards). corrected: option 5's
// jobs after checkVacancies.
const isEngCc = (cc) => /^(EN|LE|ET)$/.test(cc || '');
function expectedJobs(predictions = [], corrected = []) {
  const out = [];
  for (const p of predictions) {
    if (p.onDutyAt != null || p.known || p.s5Pending || p.order == null) continue;
    const trainDay = `${p.symbol} ${p.originDay}`;
    // No turn free at all (X27691 04: "spareboard (no Chain Gang turn free)
    // + SD04"): that job goes to the spareboard too.
    const coNone = !p.turn && p.pool !== 'S5' && /→ spareboard/.test(p.reason || '');
    const enNone = !p.engineer && !!p.engineerNone;
    for (const [turn, spare, why, cc] of [
      [p.turn, p.spare || coNone, coNone ? `no ${p.pool === 'SR' ? 'Chain Gang' : `${p.pool} pool`} conductor is free` : p.spareWhy, 'CO'],
      [p.engineer, p.engineerSpare || enNone, enNone ? `no ${p.engineerNone} engineer is free` : p.engineerSpareWhy, 'EN']]) {
      if (!spare || (!turn && !(cc === 'CO' ? coNone : enNone))) continue;
      // Option 5 has it: the same train (its day, or its time within 12 h) and craft.
      if (corrected.some((j) => !j.yard && isEngCc(j.cc) === (cc === 'EN') && (j.trainDay ? j.trainDay === trainDay : j.train === p.symbol && j.at != null && Math.abs(j.at - p.order) <= MATCH_MIN))) continue;
      out.push({ train: p.symbol, trainDay, at: p.order, cc, yard: false, status: p.status === 'ORD' ? 'ORDERED' : 'PLANNED', turn: turn || '', why: why || 'can\'t be called', expected: true });
    }
  }
  return out;
}

// Every spare's job this check: option 5's (corrected, not on duty yet) and
// the order's, in call order → Map spare turn → { train, call, at, cc, yard,
// covers, why }.
function spareJobs(predictions, vacancies, spareboards, yardJobs = [], callBoard = [], town = null) {
  const listed = (vacancies || []).filter((j) => j.cc !== 'YA' && openJob(j, yardJobs, callBoard, town));
  const corrected = checkVacancies(listed, predictions).corrected;
  const jobs = [...corrected, ...expectedJobs(predictions, corrected)];
  const out = new Map();
  for (const [j, f] of spareFills(jobs, spareboards || {})) {
    if (!f || !f.turn || out.has(f.turn)) continue;
    out.set(f.turn, { train: j.trainDay || j.train, call: f.call, at: j.at, cc: j.cc, yard: !!j.yard, covers: j.turn || '', why: j.expected ? j.why : null });
  }
  return out;
}

module.exports = { spareFills, onDutyAlready, untiedEarlier, openJob, sdBackups, srBackups, checkVacancies, expectedJobs, spareJobs };
