const test = require('node:test');
const assert = require('node:assert/strict');
const { stuckReason } = require('../../lib/board/watchdog');

// Owner, 2026-10-22: it hung a few times a day and needed Ctrl+C + restart.
test('watchdog: busy is fine, stuck is caught, a sign-in gets longer', () => {
  const t0 = Date.UTC(2026, 9, 22, 12, 0);
  const min = 60000;
  const opts = { startedAt: t0, every: 5 };
  const at = (state, ago, now = t0 + 60 * min) => stuckReason({ at: now - ago * min, state }, now, opts);
  assert.equal(at('checking', 3), null);
  assert.equal(at('checking', 15), 'a check has been running for 15 min');
  assert.equal(at('idle', 14), null); // napping 5 min + 10 grace
  assert.equal(at('idle', 15), 'no new check has started for 15 min');
  assert.equal(at('signin', 30), null);
  assert.equal(at('signin', 45), 'it has been waiting on a sign-in for 45 min');
  // Reloading CATS after a stuck check (owner, 2026-10-31): 10 min, then a fresh Edge.
  assert.equal(at('unstick', 9), null);
  assert.equal(at('unstick', 10), 'reloading CATS hasn\'t got it back to the main menu for 10 min');
  // No heartbeat yet (or one left from before this start): counts from the start.
  assert.equal(stuckReason(null, t0 + 10 * min, opts), null);
  assert.equal(stuckReason({ at: t0 - 99 * min, state: 'idle' }, t0 + 20 * min, opts), 'it hasn\'t finished starting for 20 min');
});

// Owner, 2026-10-25: the alerts log goes on the Desktop (OneDrive's if any).
test('alerts log: Desktop, OneDrive first, or an override', () => {
  const path = require('path');
  const os = require('os');
  const { alertsLog } = require('../../lib/board/paths');
  const home = os.homedir();
  assert.equal(alertsLog({ BOARD_ALERTS_LOG: 'X:\\a.txt' }), 'X:\\a.txt');
  assert.equal(alertsLog({}, (d) => d === path.join(home, 'Desktop')), path.join(home, 'Desktop', 'Board alerts.txt'));
  assert.equal(alertsLog({ OneDrive: 'C:\\OD' }, (d) => d === path.join('C:\\OD', 'Desktop') || d === path.join(home, 'Desktop')), path.join('C:\\OD', 'Desktop', 'Board alerts.txt'));
});

// Owner, 2026-10-31: "close Edge and reopen it when it's stuck". The checker
// quits with code 3 when it's still stuck after reloading CATS; the watchdog
// starts it again (and says why in restarts.log).
test('watchdog: starts the checker again after a "still stuck" quit', async () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawn } = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-'));
  const child = path.join(dir, 'child.js');
  // First run: quit "still stuck"; second: note it ran under the watchdog, then wait.
  fs.writeFileSync(child, `const fs = require('fs'); const f = ${JSON.stringify(path.join(dir, 'runs'))};
    const n = fs.existsSync(f) ? +fs.readFileSync(f, 'utf8') : 0; fs.writeFileSync(f, String(n + 1));
    if (process.env.BOARD_WATCHDOG !== '1') process.exit(9);
    if (n === 0) process.exit(3); setTimeout(() => {}, 3000);`);
  const wd = spawn(process.execPath, [path.join(__dirname, '../../scripts/board-watchdog.js'), '--me', 'SR03'],
    { env: { ...process.env, BOARD_DATA_DIR: dir, BOARD_WATCHDOG_CHILD: child, BOARD_WATCHDOG_MINUTE_MS: '20', BOARD_WATCHDOG_TICK_MS: '100000' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 100 && !(fs.existsSync(path.join(dir, 'runs')) && fs.readFileSync(path.join(dir, 'runs'), 'utf8') === '2'); i++) await new Promise((r) => setTimeout(r, 50));
    assert.equal(fs.readFileSync(path.join(dir, 'runs'), 'utf8'), '2');
    assert.match(fs.readFileSync(path.join(dir, 'restarts.log'), 'utf8'), /Restarting: still stuck after reloading CATS; closed Edge to start fresh\./);
  } finally {
    wd.kill('SIGKILL'); // its stand-in checker ends by itself in 3 s
  }
});
