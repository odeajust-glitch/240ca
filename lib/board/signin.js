// A fresh Microsoft sign-in on purpose (owner, 2026-10-22), so the ~24 h CN
// sign-in doesn't run out while they're away at work: by hand (R in the
// checker window) or when the owner's own train is ordered and the call is
// close. The approval itself stays with the owner's phone (Authenticator).
// BoardChecker\ms-signin.json keeps when the last one was done, so the
// checker can say how long Microsoft's sign-in really lasts.
const fs = require('fs');
const { fmt } = require('./time');

// Sign in again once the owner's ORDered train is called within this many
// minutes, so the fresh 24 h covers the trip. BOARD_SIGNIN_BEFORE_CALL overrides.
const BEFORE_CALL_MINUTES = 180;
// A sign-in this recent already covers the trip: don't ask for another.
const RECENT_MS = 3 * 60 * 60 * 1000;

function loadState(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function saveState(file, state) {
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

// me: the engine's answer for the owner; now: railway local minutes (same
// clock as me.call); nowMs: real time, for comparing with the last sign-in.
// Returns why a sign-in is due, or null.
function dueForCall(me, now, state, { nowMs = Date.now(), beforeCall = BEFORE_CALL_MINUTES } = {}) {
  if (!me || !me.train || me.status !== 'ORD') return null;
  if (state.doneFor === me.train) return null; // once per train
  if (me.call - now > beforeCall || now >= me.onDuty) return null;
  if (state.lastAt && nowMs - state.lastAt < RECENT_MS) return null;
  return `your train ${me.train} is ordered (called ~${fmt(me.call)})`;
}

// "23 h 58 m" since the last sign-in, or null if none is known.
function sinceLast(state, nowMs = Date.now()) {
  if (!state.lastAt) return null;
  const mins = Math.round((nowMs - state.lastAt) / 60000);
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} m`;
}

module.exports = { dueForCall, sinceLast, loadState, saveState, BEFORE_CALL_MINUTES, RECENT_MS };
