// Where board-auto.js keeps its data (owner, 2026-10-16: off OneDrive, so
// the CATS password, the browser's sign-in and the history don't sync to the
// cloud). Default C:\Users\<you>\BoardChecker; BOARD_DATA_DIR overrides it,
// set in the real environment (it can't come from the .env it locates).
const os = require('os');
const path = require('path');

const DATA_DIR = process.env.BOARD_DATA_DIR || path.join(os.homedir(), 'BoardChecker');

// .env in the data folder first, then the repo's (older setups).
const ENV_FILES = [path.join(DATA_DIR, '.env'), path.join(__dirname, '..', '..', '.env')];

// Which browser board-auto.js drives (owner, 2026-10-17: Edge, not Chrome).
// BOARD_BROWSER=chromium goes back to Playwright's own Chromium. Each keeps
// its own sign-in folder, so switching means one Microsoft sign-in.
function browser(env = process.env) {
  const chromium = /^chrom/i.test(env.BOARD_BROWSER || '');
  return chromium
    ? { name: 'Chromium', options: {}, profileDir: path.join(DATA_DIR, 'profile') }
    : { name: 'Edge', options: { channel: 'msedge' }, profileDir: path.join(DATA_DIR, 'profile-edge') };
}

module.exports = {
  DATA_DIR,
  ENV_FILES,
  PROFILE_DIR: path.join(DATA_DIR, 'profile'),
  HISTORY_DIR: path.join(DATA_DIR, 'history'),
  // Crew names for the grievance letters only (lib/board/names.js).
  NAMES_FILE: path.join(DATA_DIR, 'names.json'),
  // Each road day's Sarnia trains across checks (lib/board/roadday.js).
  ROAD_DAYS_FILE: path.join(DATA_DIR, 'road-days.json'),
  // Turn alerts (lib/board/alerts.js, webpush.js): what each turn was last
  // told, and the board checker's own push key pair (keep it private).
  TOLD_FILE: path.join(DATA_DIR, 'turn-alerts.json'),
  // Per phone: the call each followed turn was last told of (time alerts).
  PHONES_FILE: path.join(DATA_DIR, 'turn-alerts-phones.json'),
  PUSH_KEYS_FILE: path.join(DATA_DIR, 'push-keys.json'),
  // Written by board-auto.js as it works, read by board-watchdog.js.
  HEARTBEAT_FILE: path.join(DATA_DIR, 'heartbeat.json'),
  browser,
};
