// Turn alerts (owner, 2026-10-22): after each check, what changed for each
// turn that a phone may have subscribed to on the site: lined up for a
// train, that train ordered, on duty on the Call Board, and the call time
// moving. Conductor and engineer turns alike.
//
// Each phone chooses per turn which of these it wants and how far the call
// must move (owner: "only when it's ordered, or when the time changes by a
// certain amount"). Lined up / ordered / on duty are the same news for every
// phone (BoardChecker\turn-alerts.json); time moves are measured per phone
// from the call it was last told of (turn-alerts-phones.json), so small
// drifts add up and each phone's own threshold applies.
const fs = require('fs');
const { fmt } = require('./time');
const { callTime, torontoCallTime } = require('./engine');
const { spareFills, onDutyAlready, sdBackups, srBackups } = require('./spares');
const { torontoCrews, torontoSouth } = require('./toronto');
const config = require('./config');

const MOVE_MINUTES = 30;
// What a phone gets for a turn unless it chose otherwise.
const DEFAULT_PREFS = { lineup: true, ordered: true, onDuty: true, aheadRest: true, aheadBack: true, reset: true, position: true, rescue: true, mayCall: true, time: MOVE_MINUTES, before: 0 };

// A rescue train is the stalled train's symbol with an R in front (owner,
// 2026-10-23: M383 shows as RM383).
const isRescue = (symbol) => /^R[A-Z]\d/.test(symbol || '');

// A mandatory reset from the crew office always shows as rest or a hold turn
// until 0559 (owner, 2026-10-22).
const RESET_MINUTE = 5 * 60 + 59;
function resetUntil(t) {
  const until = t.rn === 'HT' && t.statusUntil != null ? t.statusUntil : t.restUntil;
  return until != null && ((until % 1440) + 1440) % 1440 === RESET_MINUTE ? until : null;
}
const prefsFor = (prefs, turn) => ({ ...DEFAULT_PREFS, ...((prefs && prefs[turn]) || {}) });
// Does this phone want this kind of news for this turn?
const wants = (prefs, turn, kind) => !!prefsFor(prefs, turn)[kind];

// Rest or a hold turn in force now, on a Chain Gang board row.
function restingNow(t, now) {
  if (t.rn === 'HT') return { why: 'hold turn', until: t.statusUntil ?? null };
  if (t.restUntil != null && t.restUntil > now) return { why: 'rest', until: t.restUntil };
  return null;
}

// What the board says about each turn now: its first line-up train (the
// engine's prediction, conductor or engineer), any Call Board train it's
// on duty on, and (Chain Gang only: SR conductors, SD engineers) the turns
// ahead of it at home and which of them are on rest or hold. On the Chain
// Gang a turn on rest is skipped, so the ones behind move up (owner,
// 2026-10-22); A/B turns on rest still take their train, so they're left out.
// Every board (pools.a/b/s1/s3 too): a turn's own mandatory reset.
// pools: { chainGang, sd, a, b, s1, s3 } as loadSummary gives them, plus
// for rescue trains: lineup (Sarnia, 47130), macLineup (Toronto, 41975) and
// bunkhouse, each null when that screen wasn't read this check.
// Spareboards (owner, 2026-10-25: the same alerts as the Chain Gang):
// pools.spareboards { coFast, coSlow, enFast, enSlow } (lists in board order,
// null when not read), pools.vacancies (jobs going spare, for who's lined up
// to fill them) and pools.yardJobs (crews matched to turns, for on duty).
function turnStates(result, callBoard, pools = {}) {
  const out = {};
  const at = (turn) => (out[turn] ||= { lineup: null, onDuty: null, ahead: null, reset: null, board: null, workingOn: null });
  // A spare filling in on a trip (pools.fillIns, lib/board/fillins.js):
  // the turn they're working stands for them in Toronto (owner, 2026-10-25).
  const fillIns = pools.fillIns || {};
  const person = (turn) => (turn && fillIns[turn] ? fillIns[turn].turn : turn);
  const own = (list) => list.filter((t) => !t.craft || t.craft === 'CO' || /^S[D13]/.test(t.turn));
  const spareLists = Object.values(pools.spareboards || {}).filter(Boolean);
  const spares = [...new Map(spareLists.flat().map((t) => [t.turn, t])).values()];
  for (const t of [...own([...(pools.chainGang || []), ...(pools.sd || []), ...(pools.a || []), ...(pools.b || []), ...(pools.s1 || []), ...(pools.s3 || [])]), ...spares]) {
    if (t.working) continue;
    at(t.turn).reset = resetUntil(t);
  }
  // Each turn's board position and who's ahead of it at home (owner,
  // 2026-10-22: tell me when my position changes, and why), every board.
  const co = (list) => (list || []).filter((t) => t.craft === 'CO');
  for (const list of [co(pools.chainGang), pools.sd || [], co(pools.a), co(pools.b), pools.s1 || [], pools.s3 || [], ...spareLists]) {
    for (const t of list) if (t.working && t.workingOn) at(t.turn).workingOn = t.workingOn;
    const home = list.filter((t) => !t.working).sort((a, b) => a.pos - b.pos);
    // A turn on both a fast and a slow board: its first board counts.
    home.forEach((t, i) => { if (!at(t.turn).board) at(t.turn).board = { pos: t.pos, ahead: home.slice(0, i).map((x) => x.turn) }; });
  }
  // Someone ahead on rest is skipped on the spareboards too.
  for (const list of [(pools.chainGang || []).filter((t) => t.craft === 'CO'), pools.sd || [], ...spareLists]) {
    const home = list.filter((t) => !t.working).sort((a, b) => a.pos - b.pos);
    home.forEach((t, i) => {
      if (at(t.turn).ahead) return;
      at(t.turn).ahead = Object.fromEntries(home.slice(0, i).map((x) => {
        const r = restingNow(x, result.now);
        return [x.turn, { pos: x.pos, resting: !!r, why: r && r.why, until: r && r.until }];
      }));
    });
  }
  // Rescue trains (owner, 2026-10-23): one on the Sarnia line-up is news for
  // every turn at home on a Sarnia board; one on the Toronto line-up for the
  // crews waiting in the bunkhouse. s.rescue: [] none, null screen not read.
  const rescues = (trains, where) => (trains == null ? null : trains.filter((t) => isRescue(t.symbol)).map((t) => ({
    id: `${t.symbol} ${t.originDay}`, where, status: t.status, order: t.order,
    call: where === 'Toronto' ? torontoCallTime(t.order, config) : callTime(t.order, t.deadhead, config) })));
  const sarnia = rescues(pools.lineup, 'Sarnia');
  const toronto = rescues(pools.macLineup, 'Toronto');
  for (const t of [...own([...(pools.chainGang || []), ...(pools.sd || []), ...(pools.a || []), ...(pools.b || []), ...(pools.s1 || []), ...(pools.s3 || [])]), ...spares]) {
    if (!t.working && pools.lineup !== undefined) at(t.turn).rescue = sarnia;
  }
  if (pools.macLineup !== undefined) {
    for (const c of pools.bunkhouse || []) for (const turn of [c.co, c.en].map(person)) if (turn) at(turn).rescue = toronto;
  }
  for (const p of [...result.predictions].sort((a, b) => a.order - b.order)) {
    if (p.onDutyAt != null) continue; // already on duty: the Call Board says so below
    const train = `${p.symbol} ${p.originDay}`;
    for (const [turn0, spare, craft] of [[p.turn, p.spare, 'CO'], [p.engineer, p.engineerSpare, 'EN']]) {
      // S502 on L502: the conductor and the engineer are two turns with one number.
      for (const turn of p.s5 && turn0 ? [`${turn0}-${craft}`, turn0] : [turn0]) {
        if (!turn || (out[turn] && out[turn].lineup)) continue;
        at(turn).lineup = { train, status: p.status, order: p.order, call: p.call, spare: !!spare, deadhead: !!p.deadhead };
      }
    }
  }
  // A spare person filling in shows under the job's turn; the alert goes to
  // the person's own turn (owner, 2026-10-24). pools.backfill: [{ train,
  // craft, job, turn }] from board-auto.js (matched by name, none kept).
  // A spare turn is lined up for the job going spare it's expected to fill
  // (lib/board/spares.js); yardmaster jobs (CC YA) aren't ours.
  if (pools.vacancies && pools.spareboards) {
    // A job already on duty (on the Call Board) is filled, even if it's
    // still on the vacancy list.
    const jobs = pools.vacancies.filter((j) => j.cc !== 'YA' && !onDutyAlready(j, pools.yardJobs, callBoard));
    const fills = spareFills(jobs, pools.spareboards);
    for (const j of [...jobs].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))) {
      const f = fills.get(j);
      if (!f || !f.turn || (out[f.turn] && out[f.turn].lineup)) continue;
      at(f.turn).lineup = { train: j.train, status: j.status === 'ORDERED' ? 'ORD' : 'PLN', order: j.at, call: f.call, spare: false, deadhead: /^DH/.test(j.train || ''), job: true };
    }
    // No one free on the slow board for a road job: the next Chain Gang
    // turn (not lined up for a train already) may be called for it, SD for
    // an engineer job, SR for a conductor job.
    const open = result.predictions.filter((p) => p.onDutyAt == null);
    const sr = (pools.chainGang || []).filter((t) => t.craft === 'CO');
    for (const t of [...(pools.sd || []), ...sr]) at(t.turn).mayCall = null; // read: none unless set below
    for (const [list, pick, who] of [[pools.sd, sdBackups, 'engineer'], [sr, srBackups, 'conductor']]) {
      const busy = new Set(open.map((p) => (who === 'engineer' ? p.engineer : p.turn)).filter(Boolean));
      for (const [j, b] of pick(jobs, fills, list, busy)) {
        if (at(b.turn).mayCall) continue;
        at(b.turn).mayCall = { train: j.train, status: j.status, order: j.at, call: b.call, who };
      }
    }
  }
  // An ordered Mac yard train with no crew rested by its call: a Toronto
  // South crew may get it; the bunkhouse crew first in line (on rest) is
  // told (owner, 2026-10-25). Uses the "may be called" option.
  if (pools.macLineup && pools.bunkhouse) {
    const trains = [...pools.macLineup].sort((a, b) => a.order - b.order);
    const crews = pools.bunkhouse.map((c) => ({ ...c, en: person(c.en), co: person(c.co) }));
    for (const c of crews) for (const t of [c.en, c.co]) if (t) at(t).south = null; // read: none unless set below
    const pick = torontoCrews(trains, crews);
    const south = torontoSouth(trains, crews, pick);
    // The train home each bunkhouse crew is predicted for (owner, 2026-10-25):
    // lined up / ordered / call moves / reminder, like a Sarnia line-up.
    trains.forEach((t, n) => {
      const c = crews[pick[n]];
      if (!c) return;
      for (const turn of [c.en, c.co].filter(Boolean)) {
        if (at(turn).lineup) continue;
        at(turn).lineup = { train: `${t.symbol} ${t.originDay}`, status: t.status, order: t.order, call: torontoCallTime(t.order, config),
          spare: false, deadhead: !!t.deadhead, home: true };
      }
    });
    trains.forEach((t, n) => {
      const c = crews[south[n]];
      if (!c) return;
      for (const turn of [c.en, c.co].filter(Boolean)) {
        if (at(turn).south) continue;
        at(turn).south = { train: `${t.symbol} ${t.originDay}`, order: t.order, call: torontoCallTime(t.order, config), rested: c.restUntil };
      }
    });
  }
  // On duty on a yard job (crews matched to turns by name).
  for (const j of pools.yardJobs || []) {
    for (const c of j.crew || []) {
      if (!c.turn || j.onDuty == null || (out[c.turn] && out[c.turn].onDuty)) continue;
      at(c.turn).onDuty = { train: j.job, at: j.onDuty, station: j.station || 'SARNIA' };
    }
  }
  for (const t of callBoard) {
    const train = `${t.symbol} ${t.originDay}`;
    for (const c of t.crew) {
      const fill = (pools.backfill || []).find((b) => b.train === train && b.job === c.turn && b.craft === c.craft)
        || (fillIns[c.turn] ? { turn: fillIns[c.turn].turn } : null);
      const turn = fill ? fill.turn : c.turn;
      if (!turn || (out[turn] && out[turn].onDuty)) continue;
      at(turn).onDuty = { train, at: t.onDuty, station: t.station, ...(fill ? { job: c.turn } : {}) };
      // One number, two turns (S501 EN / CO): also as "S501-CO" / "S501-EN".
      if (!fill && /^S5\d{2}$/.test(turn)) at(`${turn}-${c.craft === 'CO' ? 'CO' : 'EN'}`).onDuty = at(turn).onDuty;
    }
  }
  return out;
}

const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();

// "DHT030B 23 (deadhead) planned for 23rd 0300, expected call 23rd 0100"
// (owner, 2026-10-22: the train, its planned or ordered time and the
// expected call, spelled out).
const trainLine = (l) => `${l.train}${l.deadhead ? ' (deadhead)' : ''} ${l.status === 'ORD' ? 'ordered' : 'planned'} for ${fmt(l.order)}, expected call ${fmt(l.call)}`;

// The news every phone shares: lined up, ordered, on duty.
// prev: what each turn was last told ({ turn: { train, status, onDuty } }).
// Returns { events: [{ turn, kind, text }], told } where `told` replaces prev.
// No prev (first run): nothing is sent, the board is just learned.
// lineupRead false (screen 41 not read this check): line-up news waits.
// now (minutes): for the calling hold below.
//
// Mid-call (owner, 2026-10-29): while a crew is being called, they drop off
// the board but the train stays on the line-up until both accept, so the
// next crew looks lined up for it. A new line-up for an ordered train whose
// call time has come, that the turn lined up for it last check has just
// dropped off (not on duty), is held: no alert until the train shows on
// the Call Board (the real crew gets "on duty") or it's still that way
// after HOLD_MAX minutes (then it's real and goes out).
const CALL_WINDOW = 15; // the call window opens this many minutes before the call
const HOLD_MAX = 30;
function turnEvents(prev, states, { lineupRead = true, now = null } = {}) {
  const told = {};
  const events = [];
  const held = [];
  const beingCalled = (turn, l) => now != null && l.status === 'ORD' && l.call != null && now >= l.call - CALL_WINDOW
    && Object.entries(prev || {}).some(([x, q]) => x !== turn && q && q.train === l.train
      && !(states[x] && ((states[x].lineup && states[x].lineup.train === l.train) || states[x].onDuty)));
  for (const [turn, s] of Object.entries(states)) {
    const p = (prev && prev[turn]) || {};
    const t = { ...p };
    delete t.held; // set again below while it still applies
    if (s.onDuty) {
      if (p.onDuty !== s.onDuty.train) {
        events.push({ turn, kind: 'onDuty', text: `${turn} on duty on ${s.onDuty.train} at ${cap(s.onDuty.station)} ${fmt(s.onDuty.at)}${s.onDuty.job ? `, working ${s.onDuty.job}` : ''}.` });
      }
      t.onDuty = s.onDuty.train;
    }
    // The crew office put this turn on a mandatory reset (until 0559).
    if (s.reset !== undefined) {
      if (s.reset != null && p.reset !== s.reset) {
        events.push({ turn, kind: 'reset', text: `${turn}: you've been put on a mandatory reset until ${fmt(s.reset)}.` });
      }
      t.reset = s.reset;
    }
    // Its board position moved: who left the line ahead of it (and on what
    // train) or who was placed ahead of it.
    // Back home on a Sarnia board after being out working (owner, 2026-10-25:
    // "will it get a notification that their turn has returned to Sarnia?").
    if (s.board && p.offBoard) {
      events.push({ turn, kind: 'position', text: `${turn} is back on the board in Sarnia: position ${String(s.board.pos).padStart(3, '0')}${s.board.ahead.length ? ` (${s.board.ahead.length} ahead)` : ' (first out)'}.` });
      delete t.offBoard;
    } else if (s.board) {
      if (p.pos != null && p.pos !== s.board.pos && Array.isArray(p.posAhead)) {
        const where = (x) => {
          const o = states[x] || {};
          const train = (o.onDuty && o.onDuty.train) || o.workingOn || (o.lineup && o.lineup.train);
          return train ? `${x} (${train})` : `${x} (off the board)`;
        };
        const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]);
        const left = p.posAhead.filter((x) => !s.board.ahead.includes(x)).map(where);
        const joined = s.board.ahead.filter((x) => !p.posAhead.includes(x));
        const pad3 = (n) => String(n).padStart(3, '0');
        const why = [left.length ? `${list(left)} went out` : null, joined.length ? `${list(joined)} placed ahead of you` : null].filter(Boolean).join('; ');
        events.push({ turn, kind: 'position', text: `${turn}: now position ${pad3(s.board.pos)} (was ${pad3(p.pos)}).${why ? ` ${s.board.pos < p.pos ? 'Moved up' : 'Moved down'}: ${why}.` : ''}` });
      }
      t.pos = s.board.pos;
      t.posAhead = s.board.ahead;
    } else {
      // Out working (on duty, or POS 999 on its pool screen): back on a board later is news.
      if (s.onDuty || s.workingOn) t.offBoard = true;
      delete t.pos; delete t.posAhead; // off the Sarnia board: back on it is a fresh start
    }
    if (s.board) { t.pos = s.board.pos; t.posAhead = s.board.ahead; }
    // A turn ahead (here last check too) went on rest or hold, or came off it.
    // Only while this turn is itself on the Chain Gang board at home in
    // Sarnia (owner, 2026-10-23): not on duty, not away; what it knew before
    // it left is forgotten, so coming back home isn't reported as news.
    if (s.ahead && !s.onDuty) {
      for (const [x, a] of Object.entries(s.ahead)) {
        const was = p.ahead && p.ahead[x];
        const pos = String(a.pos).padStart(3, '0');
        if (a.resting && was === false) {
          events.push({ turn, kind: 'aheadRest', text: `${turn}: ${x} ahead of you (pos ${pos}) went on ${a.why}${a.until != null ? ` until ${fmt(a.until)}` : ''}; it's skipped for calls before then, so you move up.` });
        } else if (!a.resting && was === true) {
          events.push({ turn, kind: 'aheadBack', text: `${turn}: ${x} ahead of you (pos ${pos}) is off rest/hold and back in line ahead of you.` });
        }
      }
      t.ahead = Object.fromEntries(Object.entries(s.ahead).map(([x, a]) => [x, a.resting]));
    } else {
      delete t.ahead;
    }
    // A rescue train showed up where this turn is waiting. Each one is said
    // once; off that board, it's forgotten (back on it, a rescue still there
    // is news again).
    if (s.rescue === undefined) delete t.rescues;
    else if (s.rescue) {
      for (const r of s.rescue) {
        if (p.rescues && p.rescues.includes(r.id)) continue;
        events.push({ turn, kind: 'rescue', text: `${turn}: rescue train ${r.id} on the ${r.where} line-up, ${r.status === 'ORD' ? 'ordered' : 'planned'} for ${fmt(r.order)}, expected call ${fmt(r.call)}.` });
      }
      t.rescues = s.rescue.map((r) => r.id);
    }
    // May be called off the SD board for a job going spare (no engineer
    // free on the slow board). Said once per job.
    if (s.mayCall) {
      if (p.mayCall !== s.mayCall.train) {
        const m = s.mayCall;
        events.push({ turn, kind: 'mayCall', text: `${turn}: you may be called for ${m.train} (${m.status === 'ORDERED' ? 'ordered' : 'planned'} for ${fmt(m.order)}, expected call ${fmt(m.call)}): no ${m.who || 'engineer'} is free on the ${m.who || 'engineer'} slow board.` });
      }
      t.mayCall = s.mayCall.train;
    } else if (s.mayCall === null) {
      delete t.mayCall; // read, and no longer needed: a later one is news again
    }
    // Toronto South may get the ordered train this crew is first in line for.
    if (s.south) {
      if (p.south !== s.south.train) {
        const x = s.south;
        events.push({ turn, kind: 'mayCall', text: `${turn}: ${x.train} is ordered for ${fmt(x.order)} (call ${fmt(x.call)}) and no crew in the bunkhouse is rested by then${x.rested != null ? ` (you're on rest until ${fmt(x.rested)})` : ''}: a Toronto South crew may get it.` });
      }
      t.south = s.south.train;
    } else if (s.south === null) {
      delete t.south;
    }
    const l = s.lineup;
    if (!lineupRead) {
      // keep what they were told
    } else if (l && l.train !== t.onDuty) {
      const spare = l.spare ? ' The turn goes spare (spareboard covers).' : '';
      const hold = p.train !== l.train && beingCalled(turn, l)
        ? { train: l.train, since: p.held && p.held.train === l.train ? p.held.since : now } : null;
      if (hold && now - hold.since < HOLD_MAX) {
        t.held = hold; // wait: the crew before them is likely being called
        held.push(turn);
      } else if (p.train !== l.train) {
        events.push({ turn, kind: 'lineup', text: `${turn} lined up${l.home ? ' home from Toronto' : ''}: ${trainLine(l)}.${spare}` });
        // Lined up already ordered: that's news for phones that only want orders.
        if (l.status === 'ORD') events.push({ turn, kind: 'ordered', alsoLineup: true, text: `${turn} ordered: ${trainLine(l)}.${spare}` });
        Object.assign(t, { train: l.train, status: l.status });
      } else if (p.status !== 'ORD' && l.status === 'ORD') {
        events.push({ turn, kind: 'ordered', text: `${turn} ordered: ${trainLine(l)}.${spare}` });
        t.status = l.status;
      }
    } else if (!l && p.train && p.train !== t.onDuty) {
      // Off the line-up without going on duty here (cancelled, given to
      // someone else): forget it, so a later line-up for it is news again.
      delete t.train; delete t.status;
    }
    told[turn] = t;
  }
  // Turns not on any screen now keep what they were told (a missed screen
  // shouldn't re-announce everything next check).
  for (const [turn, p] of Object.entries(prev || {})) if (!told[turn]) told[turn] = p;
  return { events: prev ? events : [], told, held };
}

// One phone's time news: for each turn it follows, the call it was last told
// of (set when the turn is lined up for a train) against the call now, with
// that phone's threshold (prefs[turn].time minutes; 0 = no time alerts).
// base: { turn: { train, call } } for this phone. Returns { events, base }.
// Also the reminder a set time before the expected call (owner,
// 2026-10-25: yard jobs don't always show ordered): prefs[turn].before
// minutes (90/60/45/30, 0 = off), once per train. now: railway minutes.
// held: turns whose line-up is on hold mid-call (turnEvents): no time
// change or reminder for it meanwhile.
function timeEvents(base, states, turns, prefs, { lineupRead = true, now = null, held = [] } = {}) {
  const next = { ...(base || {}) };
  const events = [];
  if (!lineupRead) return { events, base: next };
  for (const turn of turns || []) {
    if (turn === '__welcomed' || held.includes(turn)) continue;
    const l = states[turn] && states[turn].lineup;
    if (!l) { delete next[turn]; continue; }
    let b = next[turn];
    if (!b || b.train !== l.train) {
      b = next[turn] = { train: l.train, order: l.order, call: l.call };
    } else {
      const min = Number(prefsFor(prefs, turn).time) || 0;
      if (min > 0 && Math.abs(l.call - b.call) >= min) {
        events.push({ turn, kind: 'time', text: `${turn} time change: ${trainLine(l)} (was ${b.order != null ? `${fmt(b.order)}, call ` : 'call '}${fmt(b.call)}).` });
        b = next[turn] = { ...b, train: l.train, order: l.order, call: l.call };
      }
    }
    const before = Number(prefsFor(prefs, turn).before) || 0;
    const left = now == null || l.call == null ? null : l.call - now;
    if (before > 0 && left != null && left <= before && left > -15 && b.reminded !== l.train) {
      events.push({ turn, kind: 'before', text: `${turn}: about ${Math.max(0, Math.round(left))} min to your expected call: ${trainLine(l)}.` });
      next[turn] = { ...b, reminded: l.train };
    }
  }
  return { events, base: next };
}

// Everything one phone should get this check: the shared news it wants,
// then its own time moves. An "ordered" that came with the line-up isn't
// sent twice to a phone that also wants line-ups.
// "Where you stand" (owner, 2026-10-25): the first check after a phone
// starts following a turn, one alert with what it's lined up for now, since
// news already told before it subscribed isn't sent again. base.__welcomed
// lists the turns this phone has had it for; a phone known from before this
// existed starts with all its turns counted (no burst of them).
function standText(turn, s = {}) {
  const bits = [];
  if (s.onDuty) bits.push(`on duty on ${s.onDuty.train} at ${cap(s.onDuty.station || '')} ${fmt(s.onDuty.at)}${s.onDuty.job ? `, working ${s.onDuty.job}` : ''}`);
  else if (s.lineup) bits.push(`lined up${s.lineup.home ? ' home from Toronto' : ''}: ${trainLine(s.lineup)}`);
  else if (s.workingOn) bits.push(`out working on ${s.workingOn}`);
  if (s.board) bits.push(`board position ${String(s.board.pos).padStart(3, '0')}${s.board.ahead.length ? ` (${s.board.ahead.length} ahead)` : ' (first out)'}`);
  if (s.reset != null) bits.push(`on a mandatory reset until ${fmt(s.reset)}`);
  if (s.mayCall) bits.push(`may be called for ${s.mayCall.train}`);
  if (s.south) bits.push(`first in line for ${s.south.train}, a Toronto South crew may get it`);
  return `${turn} tracked. ${bits.length ? `Right now: ${bits.join('; ')}.` : 'Not lined up for anything yet.'}`;
}

function phoneEvents(shared, phone, states, base, opts) {
  const turns = phone.turns || [];
  const mine = shared.filter((e) => turns.includes(e.turn) && wants(phone.prefs, e.turn, e.kind)
    && !(e.alsoLineup && wants(phone.prefs, e.turn, 'lineup')));
  const time = timeEvents(base, states, turns, phone.prefs, opts);
  const known = base && !base.__welcomed ? turns : (base && base.__welcomed) || [];
  const stand = turns.filter((t) => !known.includes(t)).map((turn) => ({ turn, kind: 'stand', text: standText(turn, states[turn]) }));
  time.base.__welcomed = turns.slice(); // a turn dropped and added again gets it again
  // Ordered with a new time (owner, 2026-10-31 alert log: "ordered" then
  // "time change" for the same train in the same check): the ordered message
  // already gives the new time, so the time change isn't sent too.
  const said = new Set(mine.filter((e) => e.kind === 'ordered').map((e) => e.turn));
  return { events: [...stand, ...mine, ...time.events.filter((e) => !(e.kind === 'time' && said.has(e.turn)))], base: time.base };
}

// A phone following a person (owner, 2026-10-25): its '@<hash>' entries
// become the turn that person is on now (personTurns: { hash: { turn } },
// from their own-turn sightings), with that entry's choices. A turn the
// phone follows by name keeps its own choices. → { turns, prefs }.
function expandPhone(phone, personTurns = {}) {
  const turns = [];
  const prefs = { ...(phone.prefs || {}) };
  for (const t of phone.turns || []) {
    if (!/^@/.test(t)) { if (!turns.includes(t)) turns.push(t); continue; }
    const p = personTurns[t.slice(1)];
    if (!p || !p.turn) continue;
    if (!turns.includes(p.turn)) { turns.push(p.turn); if (!(phone.turns || []).includes(p.turn)) prefs[p.turn] = (phone.prefs || {})[t] || {}; }
  }
  return { ...phone, turns, prefs };
}

// Each person's own turn now, kept across checks: { hash: { turn, at } }.
// sightings: summary.people ({ h, turn, own }); only own turns count.
// Off the turn (owner, 2026-10-30: "it should say I'm not found since there
// is a new person on SR03"): someone else seen on it as their own turn, or
// not seen on it for PERSON_GONE_MIN while the check read names. Their
// alerts stop until they're seen on a turn of their own again. 501/502 has
// two people on one turn, so only the time counts there.
const PERSON_GONE_MIN = 30;
const SHARED_TURN = /^S5\d{2}$/;
function updatePersonTurns(memory, sightings = [], now = Date.now()) {
  const next = { ...(memory || {}) };
  const own = sightings.filter((s) => s.own && s.h && s.turn);
  for (const s of own) next[s.h] = { turn: s.turn, at: now };
  const readNames = sightings.length > 0;
  for (const [h, v] of Object.entries(next)) {
    const takenOver = !SHARED_TURN.test(v.turn) && own.some((s) => s.turn === v.turn && s.h !== h) && !own.some((s) => s.h === h && s.turn === v.turn);
    if (now - v.at > 90 * 864e5 || takenOver || (readNames && now - v.at > PERSON_GONE_MIN * 60000)) delete next[h];
  }
  return next;
}

function loadTold(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function saveTold(file, told) {
  fs.writeFileSync(file, JSON.stringify(told));
}

module.exports = { expandPhone, updatePersonTurns, PERSON_GONE_MIN, isRescue, turnStates, turnEvents, timeEvents, phoneEvents, prefsFor, loadTold, saveTold, MOVE_MINUTES, DEFAULT_PREFS };
