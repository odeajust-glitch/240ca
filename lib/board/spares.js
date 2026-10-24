// The spareboards (owner, 2026-10-24): who's expected to fill each job going
// spare. Used by the site (lib/board/site.js) and the turn alerts
// (lib/board/alerts.js).
const config = require('./config');
const { callTime } = require('./engine');
const { fmt } = require('./time');

// Who fills each job going spare (owner, 2026-10-24): yard jobs from the
// fast board, road jobs from the slow board; engineer jobs (CC EN/LE/ET)
// from the engineer boards, the rest from the conductor boards. Each board
// in position order, earliest job first; a turn still on rest at the call
// is passed over and keeps its place. Call: a road job's time is its order
// time (call = order − prep − 2 h); a yard job's time is its start (call
// taken as 2 h before). → per job { turn, board, call, skipped } or null.
function spareFills(vacancies, boards) {
  const used = new Set();
  const out = new Map();
  for (const v of [...vacancies].filter((x) => x.at != null).sort((a, b) => a.at - b.at)) {
    const eng = /^(EN|LE|ET)$/.test(v.cc);
    const key = `${eng ? 'en' : 'co'}${v.yard ? 'Fast' : 'Slow'}`;
    const list = (boards || {})[key];
    if (!list) { out.set(v, null); continue; }
    const call = v.yard ? v.at - config.callLeadMinutes : callTime(v.at, false, config);
    const skipped = [];
    let pick = null;
    for (const t of list) {
      if (used.has(t.turn)) continue;
      if (t.restUntil != null && t.restUntil > call) { skipped.push(t); continue; }
      pick = t;
      break;
    }
    if (pick) used.add(pick.turn);
    out.set(v, { turn: pick ? pick.turn : '', board: `${eng ? 'Engineer' : 'Conductor'} ${v.yard ? 'fast' : 'slow'} board`, call,
      skipped: skipped.map((t) => `${t.turn} (rest until ${fmt(t.restUntil)})`) });
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

module.exports = { spareFills, onDutyAlready };
