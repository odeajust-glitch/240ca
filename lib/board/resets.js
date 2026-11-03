// Reset tracker (owner, 2026-11-03; TODO #8/#9): when each person next
// needs a Transport Canada reset break, so "someone ahead of me gets put on
// reset at the call and I get an unexpected call" can be seen coming.
//
// The rule (data/rest_rules.pdf, 10.1 + definitions): a reset break (at
// least 32 h free, with two nights undisturbed) must begin within any 7
// consecutive days. The owner's CATS "EMPLOYEE TIME ON DUTY LOG" (PSTS05Y)
// matched this model to the minute:
//   - a natural reset is logged at the later of off duty + 32 h and 05:59
//     on the second free night (RESETSYS 26th 0559 after off 24th 0220;
//     RESETM32 3rd 0754 after off 1st 2355). A night is free when no duty
//     touches 00:00–05:59 that day (owner: "not worked 2 consecutive nights").
//   - a manual reset shows on the boards as rest or a hold turn until 0559
//     (RESETMNL; the 'reset' alert already uses this).
//   - next reset needed by: the last reset + 7 days (the owner: yellow
//     2 days before, red 24 h before).
// Off duty, also checked against his log: Toronto bunkhouse REST − 8 h;
// at home the turn's REST − 10 h (− 24 h when booked for 24 h, i.e. when
// − 10 h would be after the REST first showed); a yard job 8 h (YSBY 12 h);
// else when the train left the Call Board, less 30 min.
//
// Per person (name-code hash, never names). Day files keep what each check
// showed (collect); finish() works it all out over every day kept.
const { at, fmt } = require('./time');

const DAY = 1440;
const NIGHT_END = 5 * 60 + 59; // 05:59
const RESET_MIN = 32 * 60;
const WEEK = 7 * DAY;
const SHARED = /^S5\d{2}$/;
const keyOf = (turn, craft) => (SHARED.test(turn) && craft ? `${turn}-${craft === 'CO' ? 'CO' : 'EN'}` : turn);
const minOf = (t) => { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})$/.exec(t || ''); return m ? at(+m[1], +m[2], +m[3], +m[4], +m[5]) : null; };
const mod = (n) => ((n % DAY) + DAY) % DAY;
const yardMinutes = (job) => (/^YSBY/.test(job || '') ? 12 * 60 : 8 * 60);

function empty() { return { since: null, last: null, trips: {}, rest: {}, bunk: {}, manual: {} }; }

// One check. input: loadSummary's output (times in minutes); people: the
// summary's sightings [{ h, turn, own, craft, train }]; taken: minutes.
function collect(acc, input, people, taken) {
  acc.since = acc.since == null ? taken : Math.min(acc.since, taken);
  acc.last = acc.last == null ? taken : Math.max(acc.last, taken);
  const first = (obj, k, v) => { if (obj[k] == null || v < obj[k]) obj[k] = v; };
  // Trains and yard jobs on duty, and who was on them.
  const trains = new Map((input.callBoard || []).filter((t) => t.onDuty != null).map((t) => [`${t.symbol} ${t.originDay}`, t]));
  const yard = new Map((input.yardJobs || []).filter((j) => j.onDuty != null).map((j) => [j.job, j]));
  for (const p of people || []) {
    if (!p.h) continue;
    let key; let rec;
    const t = p.train && trains.get(p.train);
    if (t) { key = `${p.train}/${t.onDuty}`; rec = { train: p.train, on: t.onDuty, job: keyOf(p.turn, p.craft) }; }
    else if (!p.own && !p.train && yard.has(p.turn)) {
      const j = yard.get(p.turn);
      if (j.onDuty > taken + 180) continue;
      key = `${j.job}/${j.onDuty}`; rec = { train: j.job, on: j.onDuty, job: j.job, yard: true };
    } else continue;
    const trips = acc.trips[p.h] || (acc.trips[p.h] = {});
    const e = trips[key] || (trips[key] = { ...rec, first: taken, last: taken });
    e.first = Math.min(e.first, taken); e.last = Math.max(e.last, taken);
  }
  // Every board's REST (and 0559 rests / holds = a manual reset).
  const lists = [input.chainGangHome, input.chainGangAway, input.aHome, input.bHome, input.sdHome, input.s1Home, input.s3Home, input.s5, input.garnet,
    ...Object.values(input.spareboards || {})];
  for (const list of lists) {
    for (const t of list || []) {
      const k = keyOf(t.turn, t.craft);
      if (t.restUntil != null) first(acc.rest[k] || (acc.rest[k] = {}), t.restUntil, taken);
      const until = t.rn === 'HT' && t.statusUntil != null ? t.statusUntil : t.restUntil;
      if (until != null && mod(until) === NIGHT_END) first(acc.manual[k] || (acc.manual[k] = {}), until, taken);
    }
  }
  for (const c of input.bunkhouse || []) {
    if (c.restUntil == null) continue;
    for (const turn of [c.co, c.en].filter(Boolean)) first(acc.bunk[turn] || (acc.bunk[turn] = {}), c.restUntil - 8 * 60, taken);
  }
  return acc;
}

// Days joined (from the day files): earliest first sighting, latest last.
function merge(into, day) {
  if (!day) return into;
  if (day.since != null) into.since = into.since == null ? day.since : Math.min(into.since, day.since);
  if (day.last != null) into.last = into.last == null ? day.last : Math.max(into.last, day.last);
  for (const [h, trips] of Object.entries(day.trips || {})) {
    const all = into.trips[h] || (into.trips[h] = {});
    for (const [k, e] of Object.entries(trips)) {
      const was = all[k];
      all[k] = was ? { ...was, first: Math.min(was.first, e.first), last: Math.max(was.last, e.last) } : { ...e };
    }
  }
  for (const f of ['rest', 'bunk', 'manual']) {
    for (const [turn, vals] of Object.entries(day[f] || {})) {
      const all = into[f][turn] || (into[f][turn] = {});
      for (const [v, seen] of Object.entries(vals)) if (all[v] == null || seen < all[v]) all[v] = seen;
    }
  }
  return into;
}

// A person's own turn at a time, from their people.js stretches.
function ownTurnAt(stretches, t) {
  let best = null;
  for (const e of stretches || []) {
    if (!e.own) continue;
    const from = minOf(e.from); const to = minOf(e.to);
    if (from == null || to == null || from > t + 60) continue;
    if (!best || from > best.from) best = { from, to, turn: keyOf(e.turn, e.craft) };
  }
  return best ? best.turn : null;
}

// When a trip ended (see the top).
function offDuty(trip, own, acc) {
  if (trip.yard) return { off: trip.on + yardMinutes(trip.train), how: 'yard' };
  const bunk = Object.keys(acc.bunk[trip.job] || {}).map(Number).filter((o) => o > trip.on + 30 && o <= trip.last + 180).sort((a, b) => a - b)[0];
  if (bunk != null) return { off: bunk, how: 'bunkhouse' };
  for (const turn of [own, trip.job].filter(Boolean)) {
    const seen = Object.entries(acc.rest[turn] || {}).map(([u, s]) => [+u, s]).filter(([, s]) => s >= trip.last - 30 && s <= trip.last + 240).sort((a, b) => a[1] - b[1]);
    for (const [until, s] of seen) {
      const off = until - 600 <= s + 5 ? until - 600 : until - DAY;
      if (off > trip.on + 30 && off <= s + 5) return { off, how: 'rest' };
    }
  }
  return { off: Math.max(trip.on + 60, trip.last - 30), how: 'call board' };
}

// When a natural reset completes in a gap free from duty [a, b), or null.
function naturalReset(a, b) {
  if (b - a < RESET_MIN) return null;
  // The first night D with D 00:00 ≥ a; nights D and D+1 must both fit.
  let d = Math.ceil(a / DAY) * DAY;
  const done = d + DAY + NIGHT_END;
  if (done > b) return null;
  const at32 = a + RESET_MIN;
  const t = Math.max(at32, done);
  return t <= b ? t : null;
}

// Every person: duty periods, resets, and when the next one is needed.
// people: people.json's stretches per hash. now: minutes (the newest check).
function finish(acc, people = {}, now = acc.last) {
  const out = {};
  const hashes = new Set([...Object.keys(acc.trips), ...Object.keys(people)]);
  for (const h of hashes) {
    const stretches = people[h] || [];
    const periods = Object.values(acc.trips[h] || {}).map((trip) => {
      const own = ownTurnAt(stretches, trip.on);
      const { off, how } = offDuty(trip, own, acc);
      return { train: trip.train, on: trip.on, off: Math.min(off, trip.on + 16 * 60), how };
    }).sort((x, y) => x.on - y.on);
    // Overlaps (the same trip under two names) joined.
    const duty = [];
    for (const p of periods) {
      const last = duty[duty.length - 1];
      if (last && p.on <= last.off) { last.off = Math.max(last.off, p.off); last.train += ` + ${p.train}`; } else duty.push({ ...p });
    }
    const resets = [];
    // Natural: each gap, from the first check kept to now.
    let from = acc.since;
    for (const p of [...duty, { on: now, off: now }]) {
      const r = from != null ? naturalReset(from, Math.min(p.on, now)) : null;
      if (r != null) resets.push({ at: r, kind: 'natural' });
      from = Math.max(from ?? p.off, p.off);
    }
    // Manual: a 0559 rest or hold on their own turn while they held it.
    for (const s of stretches.filter((e) => e.own)) {
      const turn = keyOf(s.turn, s.craft); const a = minOf(s.from); const b = minOf(s.to);
      for (const [until, seen] of Object.entries(acc.manual[turn] || {})) {
        if (seen >= a - 10 && seen <= b + 10 && !resets.some((r) => Math.abs(r.at - +until) < 120)) resets.push({ at: +until, kind: 'manual' });
      }
    }
    resets.sort((x, y) => x.at - y.at);
    const done = resets.filter((r) => r.at <= now);
    const last = done[done.length - 1] || null;
    const ahead = resets.find((r) => r.at > now) || null; // put on a reset already
    const due = last ? last.at + WEEK : null;
    out[h] = { duty, resets, last, ahead, due, turn: ownTurnAt(stretches, now) };
  }
  return out;
}

// For the boards: each own turn now → { due, level, last, ahead }.
// level: 'red' (24 h or less), 'yellow' (2 days or less), '' otherwise.
function byTurn(found, people, now) {
  const turns = {};
  for (const [h, r] of Object.entries(found)) {
    const stretches = people[h] || [];
    const live = stretches.filter((e) => e.own && minOf(e.to) >= now - 10);
    if (!live.length || r.due == null) continue;
    const left = r.due - now;
    const level = r.ahead ? '' : left <= DAY ? 'red' : left <= 2 * DAY ? 'yellow' : '';
    for (const e of live) turns[keyOf(e.turn, e.craft)] = { h, due: r.due, dueText: fmt(r.due), left, level, last: r.last, ahead: r.ahead ? r.ahead.at : null };
  }
  return turns;
}

module.exports = { empty, collect, merge, finish, byTurn, naturalReset, offDuty, keyOf, NIGHT_END };
