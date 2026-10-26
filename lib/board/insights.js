// For the Analytics tab (owner, 2026-10-26): what the trains list doesn't
// already keep, gathered from the site's snapshots as they're built.
//   runarounds: trains that went to a different pool than the calling
//               sequence said (engine rule 'pool'), once per train
//   spareJobs:  each job going spare (option 5), when it was first and last
//               listed, who was expected to fill it and who did (a spare
//               person on the Call Board working that job's turn)
//   sleep:      for each turn, the expected call when it first came within
//               8 h (when they'd go to sleep), every change to it after that,
//               and the actual call (on duty − 2 h) when they went
// Feed snapshots oldest first; call again with more to carry on.
const BoardTrains = require('../../public/board-trains');

const SAME_JOB_MIN = 24 * 60; // listed again after this long: a new vacancy
const FILL_WITHIN = 48 * 60; // a fill-in this long after the vacancy still counts
// Sleep tracker (owner, 2026-10-26): once the call is 8 h away they go to
// sleep; how far the real call landed from the one they slept on.
const SLEEP_MIN = 8 * 60;
const CALL_LEAD = 120; // called 2 h before on duty (config.callLeadMinutes)
const DROP_AFTER = 24 * 60; // a turn gone from every screen this long: forget its wait

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
    sleepCheck(s, state);
  }
  return state;
}

// The turns in "EN SD07 · CO SR03".
const turnsOf = (crew) => String(crew || '').split(' · ').map((c) => c.trim().split(' ').pop()).filter((t) => /^[A-Z0-9]+$/.test(t));

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
  const see = (turn, call, train) => {
    const at = BoardTrains.resolve(call, s.taken);
    if (!turn || !at || isDone(turn, train)) return;
    const prev = expect.get(turn);
    if (!prev || at < prev.call) expect.set(turn, { call: at, train });
  };
  for (const t of [...(s.lineup || []), ...(s.macLineup || [])]) {
    const c = t.crew || t.pred;
    if (c) { see(c.co, t.call, t.train); see(c.en, t.call, t.train); }
  }
  for (const v of s.vacancies || []) if (v.fill && v.fill.turn) see(v.fill.turn, v.fill.call, v.train);

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
    const crew = turnsOf(t.crew).filter((x) => !fills.some((b) => b.job === x));
    for (const turn of [...crew, ...fills.map((b) => b.turn)]) went.push({ turn, train: t.train, onDuty: t.onDuty });
  }
  for (const j of s.yardJobs || []) for (const turn of turnsOf(j.crew)) if (j.onDuty) went.push({ turn, train: j.job, onDuty: j.onDuty, yard: true });
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
  for (const [turn, o] of Object.entries(open)) if (now - min(o.lastSeen) > DROP_AFTER) delete open[turn];
}

// The lists for the page, oldest first.
function finish(state) {
  const by = (k) => (a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0);
  return {
    runarounds: Object.values(state.runarounds).sort(by('taken')),
    spareJobs: Object.values(state.spareJobs).sort(by('first')),
    sleep: Object.values(state.sleep || {}).sort(by('onDuty')),
  };
}

module.exports = { collect, finish };
