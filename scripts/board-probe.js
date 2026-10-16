// Phase 0 of the board checker (docs/board-checker/PLAN.md): find out
// whether the CATS board can be read automatically. Run it on your own
// computer — the cloud sessions can't reach cats.cn.ca.
//
// You sign in yourself in a normal browser window, so the script never
// sees your name, password or Authenticator code. The browser profile is
// kept in probe-out/profile so the 24h Authenticator approval carries over
// to the next run — that's also how we measure how long a session lasts.
//
// Output (all git-ignored, under probe-out/):
//   summary.json  — structure only: page URLs, request endpoints, form field
//                   names, a masked screen layout, table
//                   column headers and row counts, cookie NAMES. No
//                   names of crew, no cookie values. Safe to share.
//   board-frame-*.html, board.png, responses/  — raw captures with coworkers'
//                   names in them. For your eyes only; don't share.
//
// Setup (once):  npm install --no-save playwright && npx playwright install chromium
// Run:           node scripts/board-probe.js [boardUrl]
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const START_URL = process.argv[2] || 'https://cats.cn.ca/';
const OUT_DIR = path.join(__dirname, '..', 'probe-out');
const PROFILE_DIR = path.join(OUT_DIR, 'profile');
const RESP_DIR = path.join(OUT_DIR, 'responses');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error('Playwright is not installed. Run:\n  npm install --no-save playwright && npx playwright install chromium');
    process.exit(1);
  }
}

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => { rl.close(); resolve(); }));
}

// Query strings can carry session tokens; keep only their keys.
function scrubUrl(raw) {
  try {
    const u = new URL(raw);
    const keys = [...u.searchParams.keys()];
    return `${u.origin}${u.pathname}${keys.length ? `?${keys.join('&')}` : ''}`;
  } catch {
    return raw;
  }
}

const { BOARD_WORDS, maskTokenWith, describeFrame } = require('../lib/board/capture');

function looksLikeLogin(url, hasPassword) {
  return hasPassword || /login\.microsoftonline\.com|\/login|\/signin|adfs/i.test(url);
}

async function main() {
  const { chromium } = loadPlaywright();
  fs.mkdirSync(RESP_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false });
  const page = context.pages()[0] || (await context.newPage());

  // Record every XHR/fetch: if the board arrives as JSON from an API call,
  // parsing that is far sturdier than scraping the HTML.
  const requests = [];
  const redirects = [];
  let saved = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) redirects.push(scrubUrl(frame.url()));
  });
  // The key pressed and the fields typed into on the last CATS screen POST,
  // attached to the next recorded screen as "how we got here".
  let lastAction = null;
  const screens = [];
  page.on('request', (req) => {
    if (req.method() !== 'POST' || !/\/Xhtml/.test(req.url())) return;
    try {
      const form = new URLSearchParams(req.postData() || '');
      const keys = [...form.keys()];
      const key = keys.find((k) => /^acc_F\d+$/.test(k)) || (keys.includes('btn_Button') ? 'Enter' : null);
      const textBoxes = new Set(screens.length ? screens[screens.length - 1].inputs : []);
      const typed = keys.filter((k) => k.startsWith('txt_') && form.get(k).trim())
        .map((k) => (textBoxes.has(k)
          ? { field: k, value: form.get(k).trim().split(/(\s+)/).map((t) => (/\s/.test(t) ? t : maskTokenWith(t, BOARD_WORDS))).join('') }
          : { field: k, value: '(not recorded)' }));
      lastAction = { key: key ? key.replace('acc_', '') : null, typed };
    } catch { /* not a form */ }
  });
  page.on('response', async (resp) => {
    const req = resp.request();
    const type = req.resourceType();
    if (type !== 'xhr' && type !== 'fetch' && type !== 'document') return;
    const contentType = resp.headers()['content-type'] || '';
    // CATS screens are form POSTs; the field names (not values) show how
    // the app navigates between screens.
    let postFields;
    try {
      const form = req.postData();
      if (form && /cats\.cn\.ca/.test(resp.url())) postFields = [...new URLSearchParams(form).keys()];
    } catch { /* binary bodies aren't forms */ }
    let size = null;
    try {
      const body = await resp.body();
      size = body.length;
      const isCats = /cats\.cn\.ca/.test(resp.url());
      if ((type !== 'document' && /json|xml/i.test(contentType)) || (isCats && type === 'document')) {
        fs.writeFileSync(path.join(RESP_DIR, `${String(++saved).padStart(3, '0')}.txt`),
          `${req.method()} ${scrubUrl(resp.url())}\n\n${body.toString('utf8')}`);
      }
    } catch { /* redirects and aborted requests have no body */ }
    requests.push({ type, method: req.method(), status: resp.status(), url: scrubUrl(resp.url()), contentType, size, postFields });
  });

  const openedAt = new Date();
  await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
  const startedOnLogin = looksLikeLogin(page.url(), (await page.locator('input[type=password]').count()) > 0);

  console.log(startedOnLogin
    ? '\nSign in in the browser window (name, password, Authenticator).'
    : '\nAlready signed in from a previous run — the saved session still works.');
  console.log('Then go through the CATS screens in your usual order. Every screen is recorded.');

  // CATS bumps the hidden sequenceNumber on every screen, so a change means
  // a new screen to record.
  let recording = true;
  let lastSeq = null;
  let lastError = null;
  const recorder = (async () => {
    while (recording) {
      const frame = page.frames().find((f) => f.name() === 'jacadaframe');
      if (frame) {
        try {
          const seq = await frame.$eval('input[name=sequenceNumber]', (el) => el.value);
          if (seq !== lastSeq) {
            lastSeq = seq;
            await frame.waitForLoadState('domcontentloaded');
            const step = screens.length + 1;
            const d = await describeFrame(frame);
            fs.writeFileSync(path.join(OUT_DIR, `screen-${String(step).padStart(2, '0')}.html`), await frame.content());
            await page.screenshot({ path: path.join(OUT_DIR, `screen-${String(step).padStart(2, '0')}.png`), fullPage: true });
            screens.push({ step, at: new Date().toISOString(), cameFrom: lastAction, boardWordsFound: d.boardWordsFound, inputs: d.inputs.filter((i) => i.type === 'text').map((i) => i.name), screenGrid: d.screenGrid });
            lastAction = null;
            console.log(`  recorded screen ${step}`);
          }
        } catch (err) {
          // Mid-navigation errors are normal and retried next tick; anything
          // else is a bug the owner should see rather than silently losing screens.
          if (!/navigat|detached|context was destroyed|Target closed/i.test(err.message) && err.message !== lastError) {
            lastError = err.message;
            console.log(`  (couldn't record this screen: ${err.message.split('\n')[0]})`);
          }
        }
      }
      await new Promise((r) => setTimeout(r, 700));
    }
  })();
  await waitForEnter('Press Enter here when you have finished... ');
  recording = false;
  await recorder;

  await page.screenshot({ path: path.join(OUT_DIR, 'board.png'), fullPage: true });

  // CATS serves an empty top page and draws each screen inside a frame, so
  // every frame is captured, not just the top one.
  const frames = [];
  for (const [i, frame] of page.frames().entries()) {
    let html = '';
    try { html = await frame.content(); } catch { continue; }
    fs.writeFileSync(path.join(OUT_DIR, `board-frame-${i}.html`), html);
    frames.push({ index: i, name: frame.name() || null, url: scrubUrl(frame.url()), ...(await describeFrame(frame)) });
  }
  const cookies = await context.cookies();
  const summary = {
    probedAt: new Date().toISOString(),
    secondsInBrowser: Math.round((Date.now() - openedAt) / 1000),
    startUrl: scrubUrl(START_URL),
    startedOnLoginPage: startedOnLogin,
    boardUrl: scrubUrl(page.url()),
    navigation: redirects,
    screens,
    frames,
    responsesSaved: saved,
    requests: requests.filter((r) => r.type !== 'document' || r.status < 300),
    cookies: cookies.map((c) => ({
      name: c.name,
      domain: c.domain,
      expires: c.expires > 0 ? new Date(c.expires * 1000).toISOString() : 'session',
      httpOnly: c.httpOnly,
    })),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  await context.close();
  console.log(`\nDone. Share probe-out/summary.json; keep the screen-*, board-frame-* files, board.png and responses/ to yourself.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
