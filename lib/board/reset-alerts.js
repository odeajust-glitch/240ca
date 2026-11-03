// Reset alerts (owner, 2026-11-03): tell whoever would get a train or job
// if the turn projected for it is put on a mandatory reset at the call
// (CATS usually does it "when they are going to call the job, then the next
// person gets an unexpected call").
//
// The owner's rules:
//   - pools (Chain Gang, SD, A, B, S1, S3, 501/502): they need the reset
//     before they get home, so it's measured at the call: under 24 h left
//     → "won't have enough time" (likely reset at the call); 24–48 h → "could
//     be put on reset" (a heads-up).
//   - spareboards: a spare is reset if the deadline falls before the job
//     ends (a yard shift 8 h, YSBY 12 h; a road job: home ~24 h after the
//     call). No 24–48 h heads-up.
//   - who's told: the person who'd get it instead ("if that person going on
//     reset would cause someone to get a notification that they are going to
//     work, make sure they know"; Chain Gang, SD, spareboards: "the next
//     person"; A/B/S1/S3: the spare who'd fill the job).
//   - once per train.
// Who'd get it instead: the same predictions run again with that turn on a
// 32 h reset from the call; whoever then has that train's job (same craft).
const { checkVacancies, onDutyAlready, spareFills } = require('./spares');
const { keyOf } = require('./resets');
const { fmt } = require('./time');

const H = 60;
const RESET_MIN = 32 * H;
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
function withReset(input, turn, from) {
  const until = from + RESET_MIN;
  const hit = (t) => keyOf(t.turn, t.craft) === turn || (t.turn === turn && !/^S5/.test(turn));
  const put = (list) => (list || []).map((t) => (hit(t) ? { ...t, restUntil: Math.max(t.restUntil ?? 0, until) } : t));
  const spareboards = Object.fromEntries(Object.entries(input.spareboards || {}).map(([k, v]) => [k, put(v)]));
  return { ...input, chainGangHome: put(input.chainGangHome), sdHome: put(input.sdHome), aHome: put(input.aHome), bHome: put(input.bHome),
    s1Home: put(input.s1Home), s3Home: put(input.s3Home), s5: put(input.s5), spareboards };
}

// How close a projected person is to their reset for that job: 'will',
// 'could' or null. due: minutes (resets.json).
function levelFor(a, due) {
  if (due == null) return null;
  if (a.from === 'spare') {
    const end = a.yard ? a.at + yardMinutes(a.train) : a.call + 24 * H;
    return due < end ? 'will' : null;
  }
  const left = due - a.call;
  return left < 24 * H ? 'will' : left < 48 * H ? 'could' : null;
}

// → { events: [{ turn, kind: 'resetAhead', text }], told }.
// resets: resets.json's turns ({ turn: { due, ahead } }); run(input) → a
// board check result for changed lists; told: { key: minutes sent }.
function resetEvents({ input, result, resets, run, told = {}, now }) {
  const events = [];
  const next = Object.fromEntries(Object.entries(told || {}).filter(([, at]) => now - at < 4 * 24 * H));
  const base = assignments(input, result);
  for (const [key, a] of base) {
    const r = (resets || {})[a.turn];
    if (!r || r.ahead) continue; // already put on one: CATS shows it
    const level = levelFor(a, r.due);
    if (!level) continue;
    let then;
    try { const changed = withReset(input, a.turn, a.call); then = assignments(changed, run(changed)); } catch { continue; }
    const b = then.get(key);
    if (!b || !b.turn || b.turn === a.turn) continue;
    const id = `${key}|${a.turn}|${b.turn}|${level}`;
    if (next[id] != null) continue;
    next[id] = now;
    const by = `${fmt(r.due)}${r.due <= now ? ', overdue' : ''}`;
    const text = level === 'will'
      ? `${a.turn} needs a reset by ${by} and is likely to be put on it when called for ${a.train} (call ~${fmt(a.call)}). If so, ${b.turn} is next for it (call ~${fmt(b.call)}).`
      : `Heads-up: ${a.turn} has under 48 h before a reset (needed by ${by}). If they're put on it when called for ${a.train} (call ~${fmt(a.call)}), ${b.turn} would be next for it.`;
    events.push({ turn: b.turn, kind: 'resetAhead', text, about: a.turn, train: a.train, level });
  }
  return { events, told: next };
}

module.exports = { resetEvents, assignments, withReset, levelFor };
