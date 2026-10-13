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

// Words that label a crew board. Any of these found on the page are listed
// in the summary; all other text is masked (letters -> A, digits -> 9) so
// the screen's layout comes through without anyone's name.
const BOARD_WORDS = new Set(('SPARE SPAREBOARD BOARD FAST SLOW POOL TURN TURNS POS POSITION NAME EMP EMPLOYEE ' +
  'NO NUM NUMBER STATUS REST CALL CALLED CALLING TIME DATE ON OFF DUTY BOOK BOOKED AVAIL AVAILABLE ' +
  'LIST TERMINAL SARNIA YARD ROAD TRAIN JOB ASSIGNMENT CREW CONDUCTOR ENGINEER LE CO RC YM ' +
  'UP DOWN OUT FIRST NEXT PREV PAGE ENTER PF1 PF2 PF3 PF4 PF5 PF6 PF7 PF8 PF9 PF10 PF11 PF12 ' +
  'MARKED MARK UNION VACATION VAC SICK LOA ETA HRS HOURS MILES MILEAGE SENIORITY').split(' '));

async function describeFrame(frame) {
  return frame.evaluate((boardWords) => {
    const words = new Set(boardWords);
    const text = document.body ? document.body.innerText : '';
    const lines = text.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    const found = new Set();
    for (const w of text.toUpperCase().match(/[A-Z][A-Z0-9]*/g) || []) if (words.has(w)) found.add(w);
    return {
      title: document.title,
      framesInside: document.querySelectorAll('frame,iframe').length,
      tables: [...document.querySelectorAll('table')].slice(0, 20).map((t) => ({
        id: t.id || null,
        headers: [...t.querySelectorAll('th')].map((th) => th.textContent.trim()).slice(0, 30),
        rows: t.querySelectorAll('tr').length,
      })),
      inputs: [...document.querySelectorAll('input,select,textarea')].slice(0, 80)
        .map((el) => ({ tag: el.tagName.toLowerCase(), type: el.type || null, name: el.name || el.id || null })),
      preBlocks: document.querySelectorAll('pre').length,
      absPositioned: [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).position === 'absolute').length,
      textLines: lines.length,
      boardWordsFound: [...found].sort(),
      maskedLayout: lines.slice(0, 60).map((l) => l.replace(/[A-Za-z]/g, 'A').replace(/[0-9]/g, '9')),
    };
  }, [...BOARD_WORDS]);
}

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
  await waitForEnter('Then open the spareboard page you want checked, and press Enter here... ');

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
  console.log(`\nDone. Share probe-out/summary.json; keep the board-frame-*.html files, board.png and responses/ to yourself.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
