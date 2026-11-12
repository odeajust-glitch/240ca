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
//     last reset (owner; confirmed 2026-11-03: SD11, reset 27th 0559, back
//     28th 0015, needed by 4th 0015 as CATS had it). Yellow 2 days before,
//     red 24 h before (owner).
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
const CALL_MIN = 120; // the call comes 2 h before on duty
const WEEK = 7 * DAY;
const SHARED = /^S5\d{2}$/;
const BOARD_TURN = /^[A-Z][A-Z0-9]\d{2}(-(EN|CO))?$/;
const keyOf = (turn, craft) => (/^(TT|ET)$/.test(craft || '') ? `${turn}-${craft}`
  : SHARED.test(turn) && craft ? `${turn}-${craft === 'CO' ? 'CO' : 'EN'}` : turn);
// A trainee's slot (S501-TT, S102-ET) rides on the turn's trains: the
// conductor's for TT, the engineer's for ET (owner, 2026-11-04).
const TRAINEE = /^([A-Z][A-Z0-9]\d{2})-(TT|ET)$/;
const tripsOf = (k) => { const m = TRAINEE.exec(k); return m ? keyOf(m[1], m[2] === 'TT' ? 'CO' : 'EN') : k; };
const minOf = (t) => { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})$/.exec(t || ''); return m ? at(+m[1], +m[2], +m[3], +m[4], +m[5]) : null; };
const mod = (n) => ((n % DAY) + DAY) % DAY;
const yardMinutes = (job) => (/^YSBY/.test(job || '') ? 12 * 60 : 8 * 60);

function empty() { return { since: null, last: null, trips: {}, turnTrips: {}, filled: {}, rest: {}, bunk: {}, manual: {}, offs: {} }; }

// One check. input: loadSummary's output (times in minutes); people: the
// summary's sightings [{ h, turn, own, craft, train, duty }] (train only from
// 2026-11-03 on); backfill: the summary's spares filling in [{ train,
// craft, job, turn }]; taken: minutes.
// yardDuty: this check's sightings say who is on a yard job's own crew lines
// (duty: true; board-auto.js, 2026-11-11). Until then a yard shift was read
// off "seen on the job, not as their own turn", which since 2026-11-03 (the
// crews in town) missed the job's own people every day and counted someone
// listed TEMP on it every day the job ran, worked or not (found checking My
// stats: one person on a yard job nine days running, its holders on none).
function collect(acc, input, people, taken, backfill = [], { yardDuty = false } = {}) {
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
    // The spare filling in worked it: on their own turn's list too (owner's
    // data: COBO, SD08, on S301 for M38261 27 and M39731 28).
    if (!b.turn) continue;
    const mine = acc.turnTrips[keyOf(b.turn, b.craft)] || (acc.turnTrips[keyOf(b.turn, b.craft)] = {});
    const e = mine[key] || (mine[key] = { train: b.train, on: t.onDuty, job: k, first: taken, last: taken });
    e.first = Math.min(e.first, taken); e.last = Math.max(e.last, taken);
  }
  for (const p of people || []) {
    if (!p.h) continue;
    let key; let rec;
    const t = p.train && trains.get(p.train);
    if (t) { key = `${p.train}/${t.onDuty}`; rec = { train: p.train, on: t.onDuty, job: keyOf(p.turn, p.craft) }; }
    else if (!p.train && yard.has(p.turn) && (yardDuty ? p.duty : !p.own)) {
      const j = yard.get(p.turn);
      if (j.onDuty > taken + 180) continue;
      key = `${j.job}/${j.onDuty}`; rec = { train: j.job, on: j.onDuty, job: j.job, yard: true, ...(yardDuty ? { sure: true } : {}) };
    } else continue;
    const trips = acc.trips[p.h] || (acc.trips[p.h] = {});
    const e = trips[key] || (trips[key] = { ...rec, first: taken, last: taken });
    e.first = Math.min(e.first, taken); e.last = Math.max(e.last, taken);
    if (rec.sure) e.sure = true;
  }
  // The first check that knew who was on duty on a yard job by name.
  if (yardDuty) acc.yardFrom = acc.yardFrom == null ? taken : Math.min(acc.yardFrom, taken);
  // Every board's REST (and 0559 rests / holds = a manual reset).
  const lists = [input.chainGangHome, input.chainGangAway, input.aHome, input.bHome, input.sdHome, input.s1Home, input.s3Home, input.s5, input.garnet,
    ...Object.values(input.spareboards || {})];
  for (const list of lists) {
    for (const t of list || []) {
      const k = keyOf(t.turn, t.craft);
      // Away (term 1+, e.g. at Garnet): an 8 h rest like the Toronto
      // bunkhouse (owner's CATS: L50231 04 off 4th 1101, rest until 1901).
      if (t.restUntil != null && t.terminal) first(acc.bunk[k] || (acc.bunk[k] = {}), t.restUntil - 8 * 60, taken);
      else if (t.restUntil != null) first(acc.rest[k] || (acc.rest[k] = {}), t.restUntil, taken);
      const until = t.rn === 'HT' && t.statusUntil != null ? t.statusUntil : t.restUntil;
      if (until != null && mod(until) === NIGHT_END) first(acc.manual[k] || (acc.manual[k] = {}), until, taken);
    }
  }
  // Exact off duty from CATS's assignment history (owner, 2026-11-04):
  // train → { on, off }.
  acc.offs = acc.offs || {};
  for (const a of input.assignHistory || []) if (a.off != null) acc.offs[`${a.train}/${a.on}`] = a.off;
  delete acc.offsByTrain;
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
  if (day.yardFrom != null) into.yardFrom = into.yardFrom == null ? day.yardFrom : Math.min(into.yardFrom, day.yardFrom);
  for (const [h, trips] of Object.entries(day.trips || {})) {
    const all = into.trips[h] || (into.trips[h] = {});
    for (const [k, e] of Object.entries(trips)) {
      const was = all[k];
      all[k] = was ? { ...was, first: Math.min(was.first, e.first), last: Math.max(was.last, e.last), ...(e.sure ? { sure: true } : {}) } : { ...e };
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
  for (const [k, off] of Object.entries(day.offs || {})) (into.offs || (into.offs = {}))[k] = off;
  delete into.offsByTrain;
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
  // CATS's assignment history: on duty + hours on duty, exact (same train,
  // on duty within 30 min of the Call Board's).
  if (!acc.offsByTrain) {
    const idx = new Map();
    for (const [k, off] of Object.entries(acc.offs || {})) {
      const i = k.lastIndexOf('/');
      const list = idx.get(k.slice(0, i)) || idx.set(k.slice(0, i), []).get(k.slice(0, i));
      list.push({ on: +k.slice(i + 1), off });
    }
    Object.defineProperty(acc, 'offsByTrain', { value: idx, enumerable: false, configurable: true });
  }
  const hit = (acc.offsByTrain.get(trip.train) || []).find((x) => Math.abs(x.on - trip.on) <= 30 && x.off > trip.on);
  if (hit) return { off: hit.off, how: 'history' };
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
// `call`: when they were called for the duty starting at b (default b). The
// nights must be undisturbed (rest rules: "undisturbed by the company"), so
// a call before 05:59 spoils that night even when on duty is after it
// (owner's PSTS05Y, 2026-11-09: SA02 off 5th 1020, on duty 7th 0600, called
// about 0400 → no reset, 7DY RESET stayed 11th 0444). The 32 h still run
// to on duty.
function naturalReset(a, b, call = b) {
  if (b - a < RESET_MIN) return null;
  // The last 05:59 at or before the call.
  let t = Math.floor((Math.min(b, call) - NIGHT_END) / DAY) * DAY + NIGHT_END;
  // Its two nights start at 00:00 the day before; that must be ≥ a.
  if (t - NIGHT_END - DAY < a) return null;
  t = Math.max(t, a + RESET_MIN);
  return t <= b ? t : null;
}

// One person's duty periods, resets and when the next one is needed, from
// their own-turn stretches (people.js) and the trips read by name.
function work(acc, stretches, nameTrips, now, since = acc.since) {
  // Their trips: by name (from 2026-11-03), plus their own turn's trains
  // while they held it, unless a spare filled in on that job.
  const mine = { ...(nameTrips || {}) };
  for (const st of stretches.filter((e) => e.own)) {
    const k = tripsOf(keyOf(st.turn, st.craft)); const a = minOf(st.from); const b = minOf(st.to);
    for (const [key, trip] of Object.entries((acc.turnTrips || {})[k] || {})) {
      // A trip filling in on another job (trip.job ≠ their turn): they're
      // not seen on their own turn meanwhile, so it's theirs if that turn
      // was their latest own one before it.
      const filling = trip.job !== k;
      if (mine[key]) continue;
      if (filling ? ownTurnAt(stretches, trip.on) !== k : trip.on < a - 180 || trip.on > b + 30) continue;
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
  // Natural: each gap, from the first check kept (or, for a shared code,
  // since they were first seen on the turn) to now.
  // An off duty that's only estimated (from the Call Board or a yard job's
  // length, not a REST) and 30 min either way would change the answer: a
  // possible reset (owner, 2026-11-04: off at 2355 gave a reset, after 0000
  // it would have needed another night; "mark those as possible resets").
  let from = since;
  let fromHow = 'exact';
  for (const p of [...duty, { on: now, off: now, how: 'exact' }]) {
    const b = Math.min(p.on, now);
    // Called 2 h before going on duty (not yet on duty by now: no call yet).
    const call = p.on <= now && p.train ? p.on - CALL_MIN : b;
    if (from != null) {
      const r = naturalReset(from, b, call);
      const rough = !/^(exact|rest|bunkhouse|history)$/.test(fromHow);
      const moved = rough ? [-30, 30].map((d) => naturalReset(from + d, b, call)) : [];
      const differs = (x) => (x == null) !== (r == null) || (x != null && Math.abs(x - r) > 60);
      const possible = moved.some(differs);
      if (r != null) resets.push({ at: r, kind: 'natural', ...(possible ? { possible: true } : {}) });
      else { const x = moved.find((y) => y != null); if (x != null) resets.push({ at: x, kind: 'natural', possible: true }); }
    }
    if (from == null || p.off >= from) { from = p.off; fromHow = p.how || 'exact'; }
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
  // 2026-11-03; confirmed on SD11: needed by 4th 0015 = on duty 28th 0015
  // + 7 days). Not on duty since: the clock hasn't started, nothing due.
  // CATS's "7DY RESET" is one minute short of 7 days (owner's PSTS05Y,
  // 2026-11-04: on duty 4th 0245 → 7DY RESET 261111 0244).
  const dueAfter = (rs) => { const bk = rs ? duty.find((d) => d.on >= rs.at) : null; return { back: bk ? bk.on : null, due: bk ? bk.on + WEEK - 1 : null }; };
  const { back, due } = dueAfter(last);
  // The latest reset only possible: also when it's due if it didn't count
  // (the latest sure reset before it; null = not known).
  const sure = last && last.possible ? [...done].reverse().find((r) => !r.possible) || null : last;
  const dueIfNot = last && last.possible ? dueAfter(sure).due : due;
  // Off duty now (owner, 2026-11-07: SD08 off on a hold + PL, shown "reset
  // overdue"): the break began at their last off duty, so a reset begun
  // before it was due isn't overdue. offSince: that off duty; resetAt: when
  // it counts if they stay off (the 32 h + two nights point).
  const lastDuty = duty[duty.length - 1];
  const offSince = lastDuty && lastDuty.off <= now ? lastDuty.off : null;
  const resetAt = offSince != null ? firstReset(offSince) : null;
  return { duty, resets, last, ahead, back, due, dueIfNot, possible: !!(last && last.possible), turn: ownTurnAt(stretches, now), offSince, resetAt };
}

// The earliest a break starting at `a` counts as a reset (naturalReset's
// first qualifying point): 32 h, and 05:59 after two free nights.
function firstReset(a) {
  let t = Math.ceil((a - NIGHT_END) / DAY) * DAY + NIGHT_END; // first 05:59 at or after a
  if (t - NIGHT_END - DAY < a) t += DAY; // its two nights must start after a
  return Math.max(t, a + RESET_MIN);
}

// A name code on two turns at once is two people with the same code (owner's
// data, 2026-11-03: one code on SR11 and SB06). For the person on `turn`:
// their stretches on it, plus other turns only at times they weren't on it
// (a bump from one turn to the next); trips by name likewise.
function onTurn(stretches, nameTrips, turn) {
  const own = stretches.filter((e) => e.own);
  const span = (e) => [minOf(e.from), minOf(e.to)];
  // A code ever on two turns at once (owner's SR11, 2026-11-04: one code on
  // SR01, SB03, SA07, SB06 and SR11) is shared by several people: their
  // stretches can't be told apart, so only this turn's own stretches count,
  // and nothing before them is known.
  const base = (k) => k.replace(/-(EN|CO|TT|ET)$/, '');
  // At least 6 h together: a bump shows on both turns for a check or two
  // (owner, 2026-10-25: SR03 and S501 for 40 min), that's one person.
  const together = (a, b) => Math.min(span(a)[1], span(b)[1]) - Math.max(span(a)[0], span(b)[0]);
  const shared = own.some((a, i) => own.some((b, j) => j > i && base(keyOf(a.turn, a.craft)) !== base(keyOf(b.turn, b.craft)) && together(a, b) >= 6 * 60));
  if (shared) {
    const here = own.filter((e) => keyOf(e.turn, e.craft) === turn);
    const trips = Object.fromEntries(Object.entries(nameTrips || {}).filter(([, t]) => t.job === turn));
    return { stretches: here, trips, since: here.length ? Math.min(...here.map((e) => minOf(e.from))) : null, shared: true };
  }
  return { stretches, trips: nameTrips || {}, shared: false };
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
      const r = work(acc, mine.stretches, mine.trips, now, mine.shared ? mine.since : acc.since);
      // A possible latest reset: the earlier deadline (if it didn't count)
      // colours the board, the later one is said too.
      const due = r.possible && r.dueIfNot != null ? Math.min(r.due ?? Infinity, r.dueIfNot) : r.due;
      if (due == null) continue;
      const left = due - now;
      // Past the deadline but off since before it: on their reset break
      // now, not overdue. (Before the deadline, still yellow / red: they can
      // be called before the break counts.)
      const onBreak = left < 0 && r.offSince != null && r.offSince <= due && r.resetAt > now;
      const level = r.ahead || onBreak ? '' : left <= DAY ? 'red' : left <= 2 * DAY ? 'yellow' : '';
      turns[turn] = { h, due, dueText: fmt(due), left, level, last: r.last, ahead: r.ahead ? r.ahead.at : null,
        ...(onBreak ? { onBreak: true, offText: fmt(r.offSince), resetText: fmt(r.resetAt) } : {}),
        ...(r.possible ? { possible: true, possibleText: fmt(r.last.at), ...(r.due != null && r.due !== due ? { laterText: fmt(r.due) } : {}) } : {}) };
    }
  }
  return turns;
}

// Each person's resets (owner, 2026-11-04: Person search shows the rest
// where they got their reset in another colour): { hash: [{ at: 'YYYY-MM-DD
// HHMM', kind }] }, worked out on their latest own turn (shared codes: that
// turn only).
const pad2 = (n) => String(n).padStart(2, '0');
const takenOf = (m) => { const d = new Date(m * 60000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}`; };
function personResets(acc, people = {}, now = acc.last) {
  const out = {};
  for (const [h, stretches] of Object.entries(people || {})) {
    const own = stretches.filter((e) => e.own);
    if (!own.length) continue;
    const latest = own.reduce((a, b) => (minOf(b.to) > minOf(a.to) ? b : a));
    const mine = onTurn(stretches, acc.trips[h], keyOf(latest.turn, latest.craft));
    const r = work(acc, mine.stretches, mine.trips, now, mine.shared ? mine.since : acc.since);
    if (r.resets.length) out[h] = r.resets.filter((x) => x.at <= now).map((x) => ({ at: takenOf(x.at), kind: x.kind, ...(x.possible ? { possible: true } : {}) }));
  }
  return out;
}

// Each train's off duty, for the Work history (owner, 2026-11-04: "Can we
// start to add off duty times in turn history"): { 'L50231 04': { on, off,
// how } } with taken-style times. The best source wins (assignment history,
// bunkhouse, REST, then the estimates).
const HOW_RANK = { history: 0, bunkhouse: 1, rest: 2, 'call board': 3, yard: 4 };
function trainOffs(acc) {
  const out = {};
  for (const [turn, trips] of Object.entries(acc.turnTrips || {})) {
    for (const trip of Object.values(trips)) {
      const { off, how } = offDuty(trip, tripsOf(turn), acc);
      // Still on the Call Board at the newest check: still on duty, no guess
      // (owner's screenshot: Z14931 04 "off ~2006" while still working).
      if (how === 'call board' && acc.last != null && trip.last >= acc.last - 10) continue;
      const was = out[trip.train];
      if (was && was.on === takenOf(trip.on) && HOW_RANK[was.how] <= HOW_RANK[how]) continue;
      if (was && was.on !== takenOf(trip.on) && minOf(was.on) > trip.on) continue; // same name, a later run kept
      out[trip.train] = { on: takenOf(trip.on), off: takenOf(Math.min(off, trip.on + 16 * 60)), how };
    }
  }
  return out;
}

module.exports = { trainOffs, personResets, empty, collect, merge, finish, byTurn, onTurn, naturalReset, offDuty, keyOf, NIGHT_END };
