// Send one notice to every phone that has alerts on (owner, 2026-11-10: "can
// we push a notification around 6 pm to anyone who's getting notifications",
// before the site is locked to members at 7).
//   node scripts/announce.js --dry      (only counts the phones, sends nothing)
//   node scripts/announce.js            (the sign-up reminder below)
//   node scripts/announce.js "Title" "What it says"
// Phones already matched to a signed-in member are skipped (they have an
// account); --all sends to them too. Tapping the notice opens the sign-up page.
const { ENV_FILES, PUSH_KEYS_FILE } = require('../lib/board/paths');
require('dotenv').config({ path: ENV_FILES, quiet: true });
const config = require('../lib/board/config');
const { siteSettings } = require('../lib/board/site');
const { listSubscriptions, retryingFetch } = require('../lib/board/r2');
const { sendPush, loadOrCreateKeys } = require('../lib/board/webpush');

(async () => {
  const words = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dry = process.argv.includes('--dry');
  const all = process.argv.includes('--all');
  const title = (words[0] || 'Sign up to keep access').slice(0, 60);
  const body = (words[1] || 'From 7 pm tonight this site needs an account. Tap here and choose Sign up now so you are not locked out.').slice(0, 300);
  const settings = siteSettings();
  if (!settings.r2) { console.log('Cloudflare isn\'t set up in .env, so there are no phones to reach.'); process.exit(1); }
  const subs = await listSubscriptions(settings.r2, retryingFetch(fetch));
  const phones = all ? subs : subs.filter((s) => !s.account);
  const members = subs.length - phones.length;
  console.log(`${subs.length} phone${subs.length === 1 ? ' has' : 's have'} alerts on.${members && !all ? ` Skipping ${members} already matched to a signed-in member (--all sends to them too).` : ''}`);
  console.log(`Notice: "${title}" / "${body}"`);
  if (dry) { console.log(`Dry run: nothing sent. Without --dry this goes to ${phones.length} phone${phones.length === 1 ? '' : 's'}.`); return; }
  if (!phones.length) { console.log('Nobody to send to.'); return; }
  const keys = loadOrCreateKeys(PUSH_KEYS_FILE);
  const sub = (process.env.BOARD_SITE_URL || '').trim() || config.siteUrl;
  let ok = 0;
  let gone = 0;
  let failed = 0;
  for (const ph of phones) {
    const r = await sendPush(ph, { title, body, tag: 'notice', url: './account#signup' }, { keys, sub }).catch((err) => ({ ok: false, message: err.message }));
    if (r.ok) ok++; else if (r.gone) gone++; else { failed++; console.log(`  one phone not reached: ${r.message}`); }
  }
  console.log(`\nSent to ${ok} of ${phones.length}.${gone ? ` ${gone} have turned alerts off or uninstalled.` : ''}${failed ? ` ${failed} failed (above).` : ''}`);
})().catch((err) => { console.log(`Couldn't send: ${err.message}`); process.exit(1); });
