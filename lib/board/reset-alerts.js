// Reset alerts (owner, 2026-11-03): tell whoever would get a train or job
// if the turn projected for it is put on a mandatory reset at the call
// (CATS usually does it "when they are going to call the job, then the next
// person gets an unexpected call").
//
// The owner's rules:
//   - pools (Chain Gang, SD, A, B, S1, S3, 501/502): they need the reset
//     before they get home, so it's measured at the call. A road job needs
//     about 35 h (owner: "use that as your marker"): under 35 h left →
//     likely reset at the call; 35–48 h → "could be put on reset" (heads-up).
//   - spareboards: a spare is reset if the deadline falls before the job
//     ends (a yard shift 8 h, YSBY 12 h; a road job 35 h from the call).
//     No heads-up.
//   - who's told: the person who'd get it instead ("if that person going on
//     reset would cause someone to get a notification that they are going to
//     work, make sure they know"; Chain Gang, SD, spareboards: "the next
//     person"; A/B/S1/S3: the spare who'd fill the job).
//   - once per reset (turn + deadline + who's next + likely/heads-up),
//     however often the projected train or its time changes.
// Who'd get it instead: the same predictions run again with that turn on a
// 32 h reset from the call; whoever then has that train's job (same craft).
const { checkVacancies, onDutyAlready, spareFills } = require('./spares');
const { keyOf } = require('./resets');
const { fmt } = require('./time');

const H = 60;
const RESET_MIN = 32 * H;
const ROAD = 35 * H; // a road job, call to home (owner, 2026-11-03)
const yardMinutes = (job) => (/^YSBY/.test(job || '') ? 12 * H : 8 * H);
const isEng = (cc) => /^(EN|LE|ET)$/.test(cc || '');

// Every job someone is projected for: key `${train}@${time}|CO/EN` →
// { turn, train, call, at, from: 'pool' | 'spare', yard }.
// A crew turn that goes spare (rest/reset, hold, **) leaves its job to the
// spareboard: a job for the spare fill, like a job on CATS's option 5.
function assignments(input, result) {
  const out = new Map();
  const preds = (result.predictions || []).filter((p) => p.onDutyAt == null && p.order != null);
  const jobs = [];
  for (const p of preds) {
    const call = p.call;
    for (const [role, turn, spare] of [['CO', p.turn, p.spare], ['EN', p.engineer, p.engineerSpare]]) {
      const key = `${p.symbol}@${p.order}|${role}`;
      if (turn && !spare) { out.set(key, { turn: keyOf(turn, role), train: `${p.symbol} ${p.originDay}`, call, at: p.order, from: 'pool' }); continue; }
      // To the spareboard: the turn goes spare, or no turn is free for it.
      const none = role === 'CO' ? !turn && /spareboard/.test(p.reason || '') : !turn && !!p.engineerNone;
      if ((turn && spare) || none) jobs.push({ train: p.symbol, at: p.order, cc: role, yard: false, key, label: `${p.symbol} ${p.originDay}` });
    }
  }
  const ours = (input.vacancies || []).filter((j) => j.cc !== 'YA');
  const corrected = checkVacancies(ours, result.predictions || []).corrected;
  const open = corrected.filter((j) => !onDutyAlready(j, input.yardJobs, input.callBoard));
  // A job the line-up has going spare and option 5 lists too: once.
  const listed = new Set(open.map((j) => `${j.train}@${j.at}|${isEng(j.cc) ? 'EN' : 'CO'}`));
  const all = [...open, ...jobs.filter((j) => !listed.has(j.key))];
  const fills = spareFills(all, input.spareboards || {});
  for (const j of all) {
    const f = fills.get(j);
    if (!f || !f.turn) continue;
    const key = j.key || `${j.train}@${j.at}|${isEng(j.cc) ? 'EN' : 'CO'}`;
    out.set(key, { turn: f.turn, train: j.label || j.train, call: f.call, at: j.at, from: 'spare', yard: !!j.yard });
  }
  return out;
}

// The board lists with `turn` (for 501/502, that craft) on a reset from `from`.
// job (`${train}@${order}|CO/EN`): on the Chain Gang / SD, that job then goes
// to the next turn that can work it, past ** turns, and only spare if no one
// is (owner, 2026-11-05: "the job won't go spare. It's only going spare if
// no one is available after them").
function withReset(input, turn, from, job = null) {
  const until = from + RESET_MIN;
  const hit = (t) => keyOf(t.turn, t.craft) === turn || (t.turn === turn && !/^S5/.test(turn));
  const put = (list) => (list || []).map((t) => (hit(t) ? { ...t, restUntil: Math.max(t.restUntil ?? 0, until) } : t));
  const spareboards = Object.fromEntries(Object.entries(input.spareboards || {}).map(([k, v]) => [k, put(v)]));
  const m = job && /^S[RD]\d/.test(turn) ? /^(.*)\|(CO|EN)$/.exec(job) : null;
  return { ...input, ...(m ? { resetJob: { train: m[1], role: m[2] } } : {}), chainGangHome: put(input.chainGangHome), sdHome: put(input.sdHome), aHome: put(input.aHome), bHome: put(input.bHome),
    s1Home: put(input.s1Home), s3Home: put(input.s3Home), s5: put(input.s5), spareboards };
}

// How close a projected person is to their reset for that job: 'will',
// 'could' or null. due: minutes (resets.json).
function levelFor(a, due) {
  if (due == null) return null;
  if (a.from === 'spare') {
    const end = a.yard ? a.at + yardMinutes(a.train) : a.call + ROAD;
    return due < end ? 'will' : null;
  }
  const left = due - a.call;
  return left < ROAD ? 'will' : left < 48 * H ? 'could' : null;
}

// → { events: [{ turn, kind: 'resetAhead', text }], told }.
// resets: resets.json's turns ({ turn: { due, ahead } }); run(input) → a
// board check result for changed lists; told: { key: minutes sent }.
//
// Worked through in call order, together (owner, 2026-11-05: "fix both"):
//   1. A likely reset ('will') is kept for the jobs after it, so a spare
//      who'd take an earlier job isn't told about a later one too (B130 for
//      S501's 0145, then B126 for SA05's 0330, B134 for SB02's 0645).
//   2. The person it would land on is checked for their own reset on that
//      job; if they'd be put on one too, it moves on down the board to
//      someone who can work it, and that person is the one told.
// A heads-up ('could') is worked out on top of the likely ones, not kept.
function resetEvents({ input, result, resets, run, told = {}, now }) {
  const events = [];
  const next = Object.fromEntries(Object.entries(told || {}).filter(([, at]) => now - at < 4 * 24 * H));
  const dueOf = (turn) => { const r = (resets || {})[turn]; return r && !r.ahead ? r.due : null; };
  let cur = input;
  let curAssign = assignments(cur, result);
  const keys = [...curAssign.entries()].sort((x, y) => (x[1].call ?? 0) - (y[1].call ?? 0)).map(([k]) => k);
  const reset = new Set(); // turns already taken as put on reset
  // From `state`, put `turn` on reset for job `key`; then whoever it lands
  // on, if they'd be reset too, the same, until someone can work it.
  const landOn = (state, turn, call, key) => {
    let changed = withReset(state, turn, call, key);
    const passed = [];
    for (let i = 0; i < 6; i++) {
      const b = assignments(changed, run(changed)).get(key);
      if (!b || !b.turn || b.turn === turn || passed.some((x) => x.turn === b.turn)) return null;
      const d = dueOf(b.turn);
      if (levelFor(b, d) !== 'will') return { b, passed, changed };
      passed.push({ turn: b.turn, due: d });
      changed = withReset(changed, b.turn, b.call, key);
    }
    return null;
  };
  for (const key of keys) {
    const a = curAssign.get(key);
    if (!a || !a.turn || reset.has(a.turn)) continue;
    const due = dueOf(a.turn);
    const level = levelFor(a, due);
    if (!level) continue;
    let got;
    try { got = landOn(cur, a.turn, a.call, key); } catch { continue; }
    if (!got) continue;
    const { b, passed, changed } = got;
    if (level === 'will') {
      cur = changed;
      reset.add(a.turn);
      for (const x of passed) reset.add(x.turn);
      try { curAssign = assignments(cur, run(cur)); } catch { /* keep the last */ }
    }
    // Once per reset, not per train (owner's alert log, 2026-11-04: EN03
    // was told about SD02 ten times as the projected train and its time
    // moved between M30241, M39491, M39671 and Z14891): the turn, its
    // deadline, who'd be next and how likely.
    const id = `${a.turn}|${due}|${b.turn}|${level}`;
    if (next[id] != null) continue;
    next[id] = now;
    const by = (d) => `${fmt(d)}${d <= now ? ', overdue' : ''}`;
    const also = passed.length ? ` ${passed.map((x) => `${x.turn} would be next, but needs a reset by ${by(x.due)} too`).join('; ')}.` : '';
    const text = level === 'will'
      ? `${a.turn} needs a reset by ${by(due)} and is likely to be put on it when called for ${a.train} (call ~${fmt(a.call)}).${also} If so, ${b.turn} is next for it (call ~${fmt(b.call)}).`
      : `Heads-up: ${a.turn} has under 48 h before a reset (needed by ${by(due)}). If they're put on it when called for ${a.train} (call ~${fmt(a.call)}),${also ? `${also.replace(/\.$/, ',')}` : ''} ${b.turn} would be next for it.`;
    events.push({ turn: b.turn, kind: 'resetAhead', text, about: a.turn, train: a.train, level });
  }
  return { events, told: next };
}

module.exports = { resetEvents, assignments, withReset, levelFor };
