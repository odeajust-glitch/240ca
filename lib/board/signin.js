// A fresh Microsoft sign-in on purpose (owner, 2026-10-22), so the ~24 h CN
// sign-in doesn't run out while they're away at work: by hand (R in the
// checker window) or when the owner's turn shows on duty on the Sarnia Call
// Board (owner: once working, not before the call). The approval itself stays with the owner's phone (Authenticator).
// BoardChecker\ms-signin.json keeps when the last one was done, so the
// checker can say how long Microsoft's sign-in really lasts.
const fs = require('fs');
const { fmt } = require('./time');
const defaults = require('./config');

// A sign-in this recent already covers the trip: don't ask for another.
const RECENT_MS = 3 * 60 * 60 * 1000;

function loadState(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function saveState(file, state) {
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

// The Sarnia Call Board train the owner's turn is on duty on, if a fresh
// sign-in is due for it (once per train, not right after another), else null.
function dueOnDuty(callBoard, me, state, { nowMs = Date.now(), homeStation = defaults.homeStation } = {}) {
  const t = callBoard.find((x) => x.station === homeStation && x.crew.some((c) => c.turn === me));
  if (!t) return null;
  const train = `${t.symbol} ${t.originDay}`;
  if (state.doneFor === train) return null;
  if (state.lastAt && nowMs - state.lastAt < RECENT_MS) return null;
  return { train, why: `you're on duty on ${train} at ${fmt(t.onDuty)}` };
}

// "23 h 58 m" since the last sign-in, or null if none is known.
function sinceLast(state, nowMs = Date.now()) {
  if (!state.lastAt) return null;
  const mins = Math.round((nowMs - state.lastAt) / 60000);
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} m`;
}

module.exports = { dueOnDuty, sinceLast, loadState, saveState, RECENT_MS };
