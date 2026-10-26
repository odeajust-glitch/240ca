// For the Analytics tab (owner, 2026-10-26): what the trains list doesn't
// already keep, gathered from the site's snapshots as they're built.
//   runarounds: trains that went to a different pool than the calling
//               sequence said (engine rule 'pool'), once per train
//   spareJobs:  each job going spare (option 5), when it was first and last
//               listed, who was expected to fill it and who did (a spare
//               person on the Call Board working that job's turn)
// Feed snapshots oldest first; call again with more to carry on.
const BoardTrains = require('../../public/board-trains');

const SAME_JOB_MIN = 24 * 60; // listed again after this long: a new vacancy
const FILL_WITHIN = 48 * 60; // a fill-in this long after the vacancy still counts

function collect(snapshots, state = {}) {
  const min = BoardTrains.toMin;
  state.runarounds ||= {};
  state.spareJobs ||= {};
  const latest = state.latestJob || (state.latestJob = {}); // job id → its newest entry key
  const byTurn = state.jobByTurn || (state.jobByTurn = {}); // job's turn → its newest entry key
  for (const s of snapshots) {
    for (const e of s.sequence || []) {
      if (!e.actual || !e.expected || e.actual === e.expected || e.actual === 'MU') continue;
      const key = BoardTrains.trainKey(e.train, s.taken);
      const r = state.runarounds[key] || (state.runarounds[key] = { train: e.train, taken: s.taken, order: e.order });
      Object.assign(r, { expected: e.expected, actual: e.actual, turn: e.turn || '', last: s.taken });
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
  }
  return state;
}

// The lists for the page, oldest first.
function finish(state) {
  const by = (k) => (a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0);
  return {
    runarounds: Object.values(state.runarounds).sort(by('taken')),
    spareJobs: Object.values(state.spareJobs).sort(by('first')),
  };
}

module.exports = { collect, finish };
