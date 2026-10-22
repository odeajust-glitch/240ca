// Is the board checker stuck? (owner, 2026-10-22: a few times a day it hung
// and only Ctrl+C + starting it again fixed it.) board-auto.js writes a
// heartbeat (BoardChecker\heartbeat.json: { at, state }) when it starts a
// check ('checking'), finishes one ('idle') and waits for a sign-in
// ('signin'); scripts/board-watchdog.js reads it every minute and restarts
// the checker when this says so.
const fs = require('fs');

// How long each state may last before it counts as stuck (minutes). A check
// takes a minute or two (a site rebuild a few more); between checks it
// naps `every` minutes. A sign-in waits on a person, so it gets much longer:
// restarting then rarely helps, but a page that's wedged on a sign-in does.
const LIMITS = { checking: 15, idle: 10, signin: 45, starting: 20 };

function beat(file, state) {
  try { fs.writeFileSync(file, JSON.stringify({ at: Date.now(), state })); } catch { /* only a heartbeat */ }
}

function readBeat(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

// Why to restart now, or null. hb: the last heartbeat (null before the
// first); startedAt: when this run of the checker began; every: minutes
// between checks. minute: ms in a minute (tests speed it up).
function stuckReason(hb, now, { startedAt, every = 5, minute = 60000 }) {
  const state = hb && hb.at >= startedAt ? hb.state : 'starting';
  const since = hb && hb.at >= startedAt ? hb.at : startedAt;
  const limit = (LIMITS[state] ?? LIMITS.checking) + (state === 'idle' ? every : 0);
  const mins = Math.floor((now - since) / minute);
  if (mins < limit) return null;
  const what = { checking: 'a check has been running', idle: 'no new check has started', signin: 'it has been waiting on a sign-in', starting: 'it hasn\'t finished starting' }[state] || `it has been '${state}'`;
  return `${what} for ${mins} min`;
}

module.exports = { beat, readBeat, stuckReason, LIMITS };
