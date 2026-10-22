// Turn alerts (owner, 2026-10-22): after each check, what changed for each
// turn that a phone may have subscribed to on the site. The alerts are the
// ones the owner asked for (2026-10-17): lined up for a Sarnia train, that
// train ordered, its call time moved 30 min or more; plus on duty on the
// Call Board. Conductor and engineer turns alike.
//
// The state kept between checks (BoardChecker\turn-alerts.json) holds what
// each turn was last *told*, so small time drifts can't add up unnoticed.
const fs = require('fs');
const { fmt } = require('./time');

const MOVE_MINUTES = 30;

// What the board says about each turn now: its first line-up train (the
// engine's prediction, conductor or engineer) and any Call Board train it's
// on duty on.
function turnStates(result, callBoard) {
  const out = {};
  const at = (turn) => (out[turn] ||= { lineup: null, onDuty: null });
  for (const p of [...result.predictions].sort((a, b) => a.order - b.order)) {
    if (p.onDutyAt != null) continue; // already on duty: the Call Board says so below
    const train = `${p.symbol} ${p.originDay}`;
    for (const [turn, spare] of [[p.turn, p.spare], [p.engineer, p.engineerSpare]]) {
      if (!turn || (out[turn] && out[turn].lineup)) continue;
      at(turn).lineup = { train, status: p.status, call: p.call, spare: !!spare, deadhead: !!p.deadhead };
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

// prev: what each turn was last told ({ turn: { train, status, call, onDuty } }).
// Returns { events: [{ turn, text }], told } where `told` replaces prev.
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
        events.push({ turn, text: `${turn} on duty on ${s.onDuty.train} at ${cap(s.onDuty.station)} ${fmt(s.onDuty.at)}.` });
      }
      t.onDuty = s.onDuty.train;
    }
    const l = s.lineup;
    if (!lineupRead) {
      // keep what they were told
    } else if (l && l.train !== t.onDuty) {
      const spare = l.spare ? ' The turn goes spare (spareboard covers).' : '';
      const call = `call ~${fmt(l.call)}`;
      if (p.train !== l.train) {
        events.push({ turn, text: `${turn} lined up for ${l.train}${l.deadhead ? ' (deadhead)' : ''}: ${call}${l.status === 'ORD' ? ' (ordered)' : ' (planned)'}.${spare}` });
        Object.assign(t, { train: l.train, status: l.status, call: l.call });
      } else if (p.status !== 'ORD' && l.status === 'ORD') {
        events.push({ turn, text: `${turn} ordered for ${l.train}: ${call}.${spare}` });
        Object.assign(t, { status: l.status, call: l.call });
      } else if (Math.abs(l.call - p.call) >= MOVE_MINUTES) {
        events.push({ turn, text: `${turn}: ${l.train} ${call}, was ~${fmt(p.call)}.` });
        t.call = l.call;
      }
    } else if (!l && p.train && p.train !== t.onDuty) {
      // Off the line-up without going on duty here (cancelled, given to
      // someone else): forget it, so a later line-up for it is news again.
      delete t.train; delete t.status; delete t.call;
    }
    told[turn] = t;
  }
  // Turns not on any screen now keep what they were told (a missed screen
  // shouldn't re-announce everything next check).
  for (const [turn, p] of Object.entries(prev || {})) if (!told[turn]) told[turn] = p;
  return { events: prev ? events : [], told };
}

function loadTold(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function saveTold(file, told) {
  fs.writeFileSync(file, JSON.stringify(told));
}

module.exports = { turnStates, turnEvents, loadTold, saveTold, MOVE_MINUTES };
