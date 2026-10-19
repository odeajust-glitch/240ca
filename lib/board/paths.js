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
  browser,
};
