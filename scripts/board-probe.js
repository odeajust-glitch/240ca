// Phase 0 of the board checker (docs/board-checker/PLAN.md): find out
// whether the CATS board can be read automatically. Run it on your own
// computer — the cloud sessions can't reach cats.cn.com.
//
// You sign in yourself in a normal browser window, so the script never
// sees your name, password or Authenticator code. The browser profile is
// kept in probe-out/profile so the 24h Authenticator approval carries over
// to the next run — that's also how we measure how long a session lasts.
//
// Output (all git-ignored, under probe-out/):
//   summary.json  — structure only: page URLs, request endpoints, table
//                   column headers and row counts, cookie NAMES. No
//                   names of crew, no cookie values. Safe to share.
//   board.html, board.png, responses/  — raw captures with coworkers'
//                   names in them. For your eyes only; don't share.
//
// Setup (once):  npm install --no-save playwright && npx playwright install chromium
// Run:           node scripts/board-probe.js [boardUrl]
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const START_URL = process.argv[2] || 'https://cats.cn.com/';
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
    const type = resp.request().resourceType();
    if (type !== 'xhr' && type !== 'fetch' && type !== 'document') return;
    const contentType = resp.headers()['content-type'] || '';
    let size = null;
    try {
      const body = await resp.body();
      size = body.length;
      if (type !== 'document' && /json|xml/i.test(contentType)) {
        fs.writeFileSync(path.join(RESP_DIR, `${String(++saved).padStart(3, '0')}.txt`),
          `${scrubUrl(resp.url())}\n\n${body.toString('utf8')}`);
      }
    } catch { /* redirects and aborted requests have no body */ }
    requests.push({ type, method: resp.request().method(), status: resp.status(), url: scrubUrl(resp.url()), contentType, size });
  });

  const openedAt = new Date();
  await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
  const startedOnLogin = looksLikeLogin(page.url(), (await page.locator('input[type=password]').count()) > 0);

  console.log(startedOnLogin
    ? '\nSign in in the browser window (name, password, Authenticator).'
    : '\nAlready signed in from a previous run — the saved session still works.');
  await waitForEnter('Then open the spareboard page you want checked, and press Enter here... ');

  const html = await page.content();
  fs.writeFileSync(path.join(OUT_DIR, 'board.html'), html);
  await page.screenshot({ path: path.join(OUT_DIR, 'board.png'), fullPage: true });

  // Column headers and row counts only — enough to write a parser without
  // copying anyone's name into the summary.
  const structure = await page.evaluate(() => {
    const tables = [...document.querySelectorAll('table')].map((t) => ({
      id: t.id || null,
      className: t.className || null,
      headers: [...t.querySelectorAll('th')].map((th) => th.textContent.trim()).slice(0, 30),
      rows: t.querySelectorAll('tr').length,
    }));
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,legend,caption')]
      .map((h) => h.textContent.trim()).filter(Boolean).slice(0, 30);
    return {
      title: document.title,
      tables,
      headings,
      iframes: [...document.querySelectorAll('iframe')].map((f) => f.src).slice(0, 10),
      gridLike: document.querySelectorAll('[role=grid],[role=row],.ag-row,.k-grid,.x-grid-row').length,
    };
  });
  structure.iframes = structure.iframes.map(scrubUrl);

  const cookies = await context.cookies();
  const summary = {
    probedAt: new Date().toISOString(),
    secondsInBrowser: Math.round((Date.now() - openedAt) / 1000),
    startUrl: scrubUrl(START_URL),
    startedOnLoginPage: startedOnLogin,
    boardUrl: scrubUrl(page.url()),
    navigation: redirects,
    page: structure,
    jsonResponsesSaved: saved,
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
  console.log(`\nDone. Share probe-out/summary.json; keep board.html, board.png and responses/ to yourself.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
