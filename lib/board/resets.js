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
//   - next reset needed by: 7 days after they first go on duty after the
//     last reset (owner; to confirm with CATS "7DY RESET"). Yellow 2 days
//     before, red 24 h before (owner).
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
const BOARD_TURN = /^[A-Z][A-Z0-9]\d{2}(-(EN|CO))?$/;
const keyOf = (turn, craft) => (SHARED.test(turn) && craft ? `${turn}-${craft === 'CO' ? 'CO' : 'EN'}` : turn);
const minOf = (t) => { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})$/.exec(t || ''); return m ? at(+m[1], +m[2], +m[3], +m[4], +m[5]) : null; };
const mod = (n) => ((n % DAY) + DAY) % DAY;
const yardMinutes = (job) => (/^YSBY/.test(job || '') ? 12 * 60 : 8 * 60);

function empty() { return { since: null, last: null, trips: {}, turnTrips: {}, filled: {}, rest: {}, bunk: {}, manual: {} }; }

// One check. input: loadSummary's output (times in minutes); people: the
// summary's sightings [{ h, turn, own, craft, train }] (train only from
// 2026-11-03 on); backfill: the summary's spares filling in [{ train,
// craft, job, turn }]; taken: minutes.
function collect(acc, input, people, taken, backfill = []) {
  acc.since = acc.since == null ? taken : Math.min(acc.since, taken);
  acc.last = acc.last == null ? taken : Math.max(acc.last, taken);
  const first = (obj, k, v) => { if (obj[k] == null || v < obj[k]) obj[k] = v; };
  // Trains and yard jobs on duty, and who was on them.
  const trains = new Map((input.callBoard || []).filter((t) => t.onDuty != null).map((t) => [`${t.symbol} ${t.originDay}`, t]));
  const yard = new Map((input.yardJobs || []).filter((j) => j.onDuty != null).map((j) => [j.job, j]));
  // Each turn's trains (whoever held the turn worked them, unless a spare
  // filled in: those jobs are kept apart).
  acc.turnTrips = acc.turnTrips || {}; acc.filled = acc.filled || {};
  for (const [name, t] of trains) {
    const key = `${name}/${t.onDuty}`;
    for (const c of t.crew || []) {
      const k = keyOf(c.turn, c.craft);
      const all = acc.turnTrips[k] || (acc.turnTrips[k] = {});
      const e = all[key] || (all[key] = { train: name, on: t.onDuty, job: k, first: taken, last: taken });
      e.first = Math.min(e.first, taken); e.last = Math.max(e.last, taken);
    }
  }
  for (const b of backfill || []) {
    const t = trains.get(b.train);
    if (!t || !b.job) continue;
    const key = `${b.train}/${t.onDuty}`;
    const jobs = acc.filled[key] || (acc.filled[key] = []);
    const k = keyOf(b.job, b.craft);
    if (!jobs.includes(k)) jobs.push(k);
  }
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
  for (const [turn, trips] of Object.entries(day.turnTrips || {})) {
    const all = (into.turnTrips || (into.turnTrips = {}))[turn] || (into.turnTrips[turn] = {});
    for (const [k, e] of Object.entries(trips)) {
      const was = all[k];
      all[k] = was ? { ...was, first: Math.min(was.first, e.first), last: Math.max(was.last, e.last) } : { ...e };
    }
  }
  for (const [k, jobs] of Object.entries(day.filled || {})) {
    const all = (into.filled || (into.filled = {}))[k] || (into.filled[k] = []);
    for (const j of jobs) if (!all.includes(j)) all.push(j);
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

// The reset a gap free from duty [a, b) gives, or null: its latest
// qualifying point (a long stretch off keeps the reset fresh): 05:59 on
// the last morning with two free nights before it, or the 32 h mark if
// later. Matches CATS: off 24th 0220 → on 26th 2045 gave RESETSYS 26th
// 0559; off 1st 2355 → RESETM32 3rd 0754.
function naturalReset(a, b) {
  if (b - a < RESET_MIN) return null;
  // The last 05:59 at or before b.
  let t = Math.floor((b - NIGHT_END) / DAY) * DAY + NIGHT_END;
  // Its two nights start at 00:00 the day before; that must be ≥ a.
  if (t - NIGHT_END - DAY < a) return null;
  t = Math.max(t, a + RESET_MIN);
  return t <= b ? t : null;
}

// One person's duty periods, resets and when the next one is needed, from
// their own-turn stretches (people.js) and the trips read by name.
function work(acc, stretches, nameTrips, now) {
  // Their trips: by name (from 2026-11-03), plus their own turn's trains
  // while they held it, unless a spare filled in on that job.
  const mine = { ...(nameTrips || {}) };
  for (const st of stretches.filter((e) => e.own)) {
    const k = keyOf(st.turn, st.craft); const a = minOf(st.from); const b = minOf(st.to);
    for (const [key, trip] of Object.entries((acc.turnTrips || {})[k] || {})) {
      if (mine[key] || trip.on < a - 180 || trip.on > b + 30) continue;
      if (((acc.filled || {})[key] || []).includes(k)) continue;
      mine[key] = trip;
    }
  }
  const periods = Object.values(mine).map((trip) => {
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
  // The 7 days start when they next go on duty after the reset (owner,
  // 2026-11-03: "I think the 7 days start when I go on duty"; to confirm
  // with CATS's "7DY RESET" field after his next call). Not on duty since:
  // the clock hasn't started, nothing due.
  const back = last ? duty.find((d) => d.on >= last.at) : null;
  const due = back ? back.on + WEEK : null;
  return { duty, resets, last, ahead, back: back ? back.on : null, due, turn: ownTurnAt(stretches, now) };
}

// A name code on two turns at once is two people with the same code (owner's
// data, 2026-11-03: one code on SR11 and SB06). For the person on `turn`:
// their stretches on it, plus other turns only at times they weren't on it
// (a bump from one turn to the next); trips by name likewise.
function onTurn(stretches, nameTrips, turn) {
  const here = stretches.filter((e) => keyOf(e.turn, e.craft) === turn);
  const span = here.map((e) => [minOf(e.from) - 60, minOf(e.to) + 60]);
  const clash = (a, b) => span.some(([x, y]) => a <= y && b >= x);
  const kept = stretches.filter((e) => keyOf(e.turn, e.craft) === turn || !e.own || !clash(minOf(e.from), minOf(e.to)));
  const others = new Set(stretches.filter((e) => e.own && !kept.includes(e)).map((e) => keyOf(e.turn, e.craft)));
  const trips = Object.fromEntries(Object.entries(nameTrips || {}).filter(([, t]) => !others.has(t.job)));
  return { stretches: kept, trips };
}

// Every person (name-code hash) → their work (see work()).
// people: people.json's stretches per hash. now: minutes (the newest check).
function finish(acc, people = {}, now = acc.last) {
  const out = {};
  const hashes = new Set([...Object.keys(acc.trips), ...Object.keys(people)]);
  for (const h of hashes) out[h] = work(acc, people[h] || [], acc.trips[h], now);
  return out;
}

// For the boards: each own turn now → { h, due, dueText, left, level, last,
// ahead }, worked out for the person on that turn (onTurn).
// level: 'red' (24 h or less), 'yellow' (2 days or less), '' otherwise.
function byTurn(acc, people, now = acc.last) {
  const turns = {};
  for (const [h, stretches] of Object.entries(people || {})) {
    const live = stretches.filter((e) => e.own && minOf(e.to) >= now - 10);
    for (const e of live) {
      const turn = keyOf(e.turn, e.craft);
      // Only board turns (SR03, SA02, S105, S501-CO, B111, EN01): a regular
      // yard job (XSAS02, YFLS01) has set days off, so it's always reset
      // (owner, 2026-11-03: "its the people on the boards that matter").
      if (turns[turn] || !BOARD_TURN.test(turn)) continue;
      const mine = onTurn(stretches, acc.trips[h], turn);
      const r = work(acc, mine.stretches, mine.trips, now);
      if (r.due == null) continue;
      const left = r.due - now;
      const level = r.ahead ? '' : left <= DAY ? 'red' : left <= 2 * DAY ? 'yellow' : '';
      turns[turn] = { h, due: r.due, dueText: fmt(r.due), left, level, last: r.last, ahead: r.ahead ? r.ahead.at : null };
    }
  }
  return turns;
}

module.exports = { empty, collect, merge, finish, byTurn, onTurn, naturalReset, offDuty, keyOf, NIGHT_END };
