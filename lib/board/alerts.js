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

const MOVE_MINUTES = 30;
// What a phone gets for a turn unless it chose otherwise.
const DEFAULT_PREFS = { lineup: true, ordered: true, onDuty: true, aheadRest: true, aheadBack: true, reset: true, position: true, time: MOVE_MINUTES };

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
// pools: { chainGang, sd, a, b, s1, s3 } as loadSummary gives them.
function turnStates(result, callBoard, pools = {}) {
  const out = {};
  const at = (turn) => (out[turn] ||= { lineup: null, onDuty: null, ahead: null, reset: null, board: null, workingOn: null });
  const own = (list) => list.filter((t) => !t.craft || t.craft === 'CO' || /^S[D13]/.test(t.turn));
  for (const t of own([...(pools.chainGang || []), ...(pools.sd || []), ...(pools.a || []), ...(pools.b || []), ...(pools.s1 || []), ...(pools.s3 || [])])) {
    if (t.working) continue;
    at(t.turn).reset = resetUntil(t);
  }
  // Each turn's board position and who's ahead of it at home (owner,
  // 2026-10-22: tell me when my position changes, and why), every board.
  const co = (list) => (list || []).filter((t) => t.craft === 'CO');
  for (const list of [co(pools.chainGang), pools.sd || [], co(pools.a), co(pools.b), pools.s1 || [], pools.s3 || []]) {
    for (const t of list) if (t.working && t.workingOn) at(t.turn).workingOn = t.workingOn;
    const home = list.filter((t) => !t.working).sort((a, b) => a.pos - b.pos);
    home.forEach((t, i) => { at(t.turn).board = { pos: t.pos, ahead: home.slice(0, i).map((x) => x.turn) }; });
  }
  for (const list of [(pools.chainGang || []).filter((t) => t.craft === 'CO'), pools.sd || []]) {
    const home = list.filter((t) => !t.working).sort((a, b) => a.pos - b.pos);
    home.forEach((t, i) => {
      at(t.turn).ahead = Object.fromEntries(home.slice(0, i).map((x) => {
        const r = restingNow(x, result.now);
        return [x.turn, { pos: x.pos, resting: !!r, why: r && r.why, until: r && r.until }];
      }));
    });
  }
  for (const p of [...result.predictions].sort((a, b) => a.order - b.order)) {
    if (p.onDutyAt != null) continue; // already on duty: the Call Board says so below
    const train = `${p.symbol} ${p.originDay}`;
    for (const [turn, spare] of [[p.turn, p.spare], [p.engineer, p.engineerSpare]]) {
      if (!turn || (out[turn] && out[turn].lineup)) continue;
      at(turn).lineup = { train, status: p.status, order: p.order, call: p.call, spare: !!spare, deadhead: !!p.deadhead };
    }
  }
  for (const t of callBoard) {
    for (const c of t.crew) {
      if (!c.turn || (out[c.turn] && out[c.turn].onDuty)) continue;
      at(c.turn).onDuty = { train: `${t.symbol} ${t.originDay}`, at: t.onDuty, station: t.station };
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
function turnEvents(prev, states, { lineupRead = true } = {}) {
  const told = {};
  const events = [];
  for (const [turn, s] of Object.entries(states)) {
    const p = (prev && prev[turn]) || {};
    const t = { ...p };
    if (s.onDuty) {
      if (p.onDuty !== s.onDuty.train) {
        events.push({ turn, kind: 'onDuty', text: `${turn} on duty on ${s.onDuty.train} at ${cap(s.onDuty.station)} ${fmt(s.onDuty.at)}.` });
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
    if (s.board) {
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
    } else if (s.workingOn || s.onDuty) {
      delete t.pos; delete t.posAhead; // out working: back on the board is a fresh start
    }
    // A turn ahead (here last check too) went on rest or hold, or came off it.
    if (s.ahead) {
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
    }
    const l = s.lineup;
    if (!lineupRead) {
      // keep what they were told
    } else if (l && l.train !== t.onDuty) {
      const spare = l.spare ? ' The turn goes spare (spareboard covers).' : '';
      if (p.train !== l.train) {
        events.push({ turn, kind: 'lineup', text: `${turn} lined up: ${trainLine(l)}.${spare}` });
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
  return { events: prev ? events : [], told };
}

// One phone's time news: for each turn it follows, the call it was last told
// of (set when the turn is lined up for a train) against the call now, with
// that phone's threshold (prefs[turn].time minutes; 0 = no time alerts).
// base: { turn: { train, call } } for this phone. Returns { events, base }.
function timeEvents(base, states, turns, prefs, { lineupRead = true } = {}) {
  const next = { ...(base || {}) };
  const events = [];
  if (!lineupRead) return { events, base: next };
  for (const turn of turns || []) {
    const l = states[turn] && states[turn].lineup;
    if (!l) { delete next[turn]; continue; }
    const b = next[turn];
    if (!b || b.train !== l.train) { next[turn] = { train: l.train, order: l.order, call: l.call }; continue; }
    const min = Number(prefsFor(prefs, turn).time) || 0;
    if (min > 0 && Math.abs(l.call - b.call) >= min) {
      events.push({ turn, kind: 'time', text: `${turn} time change: ${trainLine(l)} (was ${b.order != null ? `${fmt(b.order)}, call ` : 'call '}${fmt(b.call)}).` });
      next[turn] = { train: l.train, order: l.order, call: l.call };
    }
  }
  return { events, base: next };
}

// Everything one phone should get this check: the shared news it wants,
// then its own time moves. An "ordered" that came with the line-up isn't
// sent twice to a phone that also wants line-ups.
function phoneEvents(shared, phone, states, base, opts) {
  const turns = phone.turns || [];
  const mine = shared.filter((e) => turns.includes(e.turn) && wants(phone.prefs, e.turn, e.kind)
    && !(e.alsoLineup && wants(phone.prefs, e.turn, 'lineup')));
  const time = timeEvents(base, states, turns, phone.prefs, opts);
  return { events: [...mine, ...time.events], base: time.base };
}

function loadTold(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function saveTold(file, told) {
  fs.writeFileSync(file, JSON.stringify(told));
}

module.exports = { turnStates, turnEvents, timeEvents, phoneEvents, prefsFor, loadTold, saveTold, MOVE_MINUTES, DEFAULT_PREFS };
