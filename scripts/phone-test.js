// Sends one test message to the owner's phone by each route that's set up
// in .env (ntfy: BOARD_NTFY_TOPIC; Pushover: BOARD_PUSHOVER_TOKEN +
// BOARD_PUSHOVER_USER), with the same retries the checker uses, and says
// which got through. docs/board-checker/PUSHOVER.md.
//   node scripts/phone-test.js
const { ENV_FILES } = require('../lib/board/paths');
require('dotenv').config({ path: ENV_FILES, quiet: true });
const N = require('../lib/board/owner-notify');
const Remote = require('../lib/board/remote');

(async () => {
  const text = `Board checker test (${new Date().toLocaleTimeString('en-CA', { hour12: false })}): if you see this, phone messages work.`;
  const topic = (process.env.BOARD_NTFY_TOPIC || '').trim();
  const pushover = { token: (process.env.BOARD_PUSHOVER_TOKEN || '').trim(), user: (process.env.BOARD_PUSHOVER_USER || '').trim() };
  const routes = [
    ['ntfy', topic ? () => N.sendNtfy(text, topic) : null, 'no BOARD_NTFY_TOPIC in .env'],
    ['Pushover', pushover.token && pushover.user ? () => N.sendPushover(text, pushover) : null,
      `${!pushover.token ? 'BOARD_PUSHOVER_TOKEN' : ''}${!pushover.token && !pushover.user ? ' and ' : ''}${!pushover.user ? 'BOARD_PUSHOVER_USER' : ''} missing in .env`],
  ];
  for (const [name, fn, why] of routes) {
    if (!fn) { console.log(`${name}: not set up (${why}).`); continue; }
    const r = await N.withRetry(fn);
    console.log(r.ok ? `${name}: sent${r.tries > 1 ? ` (after ${r.tries} tries)` : ''}. Check your phone.` : `${name}: NOT sent (${r.message}).`);
  }
  // A fresh Microsoft sign-in from the phone in one tap (owner, 2026-11-04):
  // open this in the phone's browser, or save it to the home screen.
  const cmd = Remote.commandTopic();
  if (cmd) console.log(`\nOne-tap fresh sign-in (open on your phone, or Add to Home screen):\n  ${N.signinLink(cmd)}`);
})();
