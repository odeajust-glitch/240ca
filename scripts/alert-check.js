// Send a test alert to every phone following a name code or a turn, to check
// a phone is set up (owner, 2026-11-04: "Can we push a notification to see
// if it's his phone").
//   node scripts/alert-check.js WADE        (a name code)
//   node scripts/alert-check.js S501        (a turn)
const { ENV_FILES, PUSH_KEYS_FILE } = require('../lib/board/paths');
require('dotenv').config({ path: ENV_FILES, quiet: true });
const config = require('../lib/board/config');
const People = require('../lib/board/people');
const { siteSettings } = require('../lib/board/site');
const { listSubscriptions, retryingFetch } = require('../lib/board/r2');
const { sendPush, loadOrCreateKeys } = require('../lib/board/webpush');

(async () => {
  const want = String(process.argv[2] || '').trim().toUpperCase();
  if (!want) { console.log('Use: node scripts/alert-check.js WADE   (or a turn, e.g. S501)'); process.exit(1); }
  const settings = siteSettings();
  if (!settings.r2) { console.log('Cloudflare isn\'t set up in .env, so there are no phones to reach.'); process.exit(1); }
  const code = /^[A-Z]{4}$/.test(want) && !/\d/.test(want);
  const key = code ? `@${People.personHash(want)}` : want;
  const subs = await listSubscriptions(settings.r2, retryingFetch(fetch));
  const phones = subs.filter((s) => (s.turns || []).some((t) => t === key || (!code && t.replace(/-(CO|EN|TT|ET)$/, '') === want)));
  if (!phones.length) {
    console.log(`No phone is following ${want}${code ? ' (by name code)' : ''}. On that phone: open the site, search ${want}, tap 🔔 Track / alerts and allow notifications.`);
    console.log(`(${subs.length} phone${subs.length === 1 ? '' : 's'} have alerts on in total.)`);
    return;
  }
  const keys = loadOrCreateKeys(PUSH_KEYS_FILE);
  const sub = (process.env.BOARD_SITE_URL || '').trim() || config.siteUrl;
  const time = new Date().toLocaleTimeString('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit' });
  let ok = 0;
  for (const [i, ph] of phones.entries()) {
    const r = await sendPush(ph, { title: `Test: ${want}`, body: `Test alert from the board checker (${time}). This phone is set up for ${want}.`, tag: `test-${want}`, url: './#current' }, { keys, sub });
    const where = (() => { try { return new URL(ph.endpoint).host; } catch { return 'unknown'; } })();
    console.log(`Phone ${i + 1} of ${phones.length} (${where}): ${r.ok ? 'sent' : `NOT sent (${r.gone ? 'that phone has turned alerts off or uninstalled' : r.message})`}`);
    if (r.ok) ok++;
  }
  console.log(`\n${ok} of ${phones.length} sent. Check the phone(s) for "Test: ${want}".`);
})().catch((err) => { console.log(`Couldn't send: ${err.message}`); process.exit(1); });
