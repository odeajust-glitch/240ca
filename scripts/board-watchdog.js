// Keeps the board checker going (owner, 2026-10-22): runs
// scripts/board-auto.js with the same arguments and, when it stops making
// progress (lib/board/watchdog.js) or quits on its own, closes it and its
// Edge window and starts it again: the Ctrl+C-and-restart the owner was
// doing by hand. Ctrl+C here stops both for good.
//
//   node scripts/board-watchdog.js --me SR03 --every 5
//
// Each restart is noted in BoardChecker\restarts.log with the reason.
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { DATA_DIR, HEARTBEAT_FILE } = require('../lib/board/paths');
const { readBeat, stuckReason } = require('../lib/board/watchdog');

const args = process.argv.slice(2);
const i = args.indexOf('--every');
const every = i >= 0 ? Math.max(5, +args[i + 1] || 5) : 5;
const LOG = path.join(DATA_DIR, 'restarts.log');
// Tests only: a stand-in for board-auto.js and a faster look.
const CHILD = process.env.BOARD_WATCHDOG_CHILD || path.join(__dirname, 'board-auto.js');
const TICK_MS = +process.env.BOARD_WATCHDOG_TICK_MS || 60000;
const MINUTE = +process.env.BOARD_WATCHDOG_MINUTE_MS || 60000;
const stamp = () => new Date().toLocaleString('en-CA', { hour12: false });

let child = null;
let startedAt = 0;
let stopping = false;
let restarting = false;
const recent = []; // restart times, to back off if it keeps failing

function note(text) {
  console.log(`\n[watchdog ${stamp()}] ${text}`);
  try { fs.appendFileSync(LOG, `${stamp()}  ${text}\n`); } catch { /* only a log */ }
}

// The checker and everything it started (Edge), or the next start finds the
// browser profile still in use.
function killTree(pid) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => resolve());
    else { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } resolve(); }
  });
}

function start() {
  try { fs.rmSync(HEARTBEAT_FILE, { force: true }); } catch { /* fine */ }
  startedAt = Date.now();
  child = spawn(process.execPath, [CHILD, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => {
    child = null;
    if (stopping || code === 130) process.exit(0); // Ctrl+C
    restartSoon(restarting ? null : `the board checker quit (code ${code})`);
  });
}

function restartSoon(reason) {
  if (reason) note(`Restarting: ${reason}.`);
  restarting = false;
  const now = Date.now();
  while (recent.length && now - recent[0] > 30 * 60000) recent.shift();
  recent.push(now);
  // Five restarts in half an hour: something's really wrong; wait longer.
  const wait = recent.length >= 5 ? 5 * MINUTE : Math.min(10000, MINUTE);
  if (recent.length >= 5) note('Several restarts in a short time; waiting 5 minutes before the next.');
  setTimeout(start, wait);
}

setInterval(async () => {
  if (!child || restarting) return;
  const why = stuckReason(readBeat(HEARTBEAT_FILE), Date.now(), { startedAt, every, minute: MINUTE });
  if (!why) return;
  restarting = true;
  note(`The board checker looks stuck (${why}). Closing it and its browser, then starting it again.`);
  await killTree(child.pid); // its 'exit' then starts the next one
}, TICK_MS);

process.on('SIGINT', async () => {
  stopping = true;
  if (child) await killTree(child.pid);
  process.exit(0);
});

console.log(`Watchdog: running the board checker and restarting it if it gets stuck (log: ${LOG}).`);
start();
