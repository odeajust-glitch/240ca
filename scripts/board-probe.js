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
  'MARKED MARK UNION VACATION VAC SICK LOA ETA HRS HOURS MILES MILEAGE SENIORITY ' +
  'TRAINS LINEUP LINE CHAIN GANG ORDER ORDERED ORDERS DEADHEAD DH CANCEL CANCELLED VACANT RESET ' +
  'SHORT WORK VIA MANIFEST SYMBOL TORONTO MAC MACMILLAN ARRIVED ARRIVAL ARR DEPART DEP DEPARTED ' +
  'CALLED TIE TIED HOME AWAY TERM PREP OD FROM TO DEST ORIGIN ENGR CONDR CREWED').split(' '));

// Masks one token unless it's safe to show: a board word, a short code
// (CO, LE), a small number (positions, times) or a train/turn symbol
// (SB01, L50221, Q14851). Names are letters only and employee numbers are
// long digit runs, so both get masked. Runs in Node and, via its source,
// inside the page.
function maskTokenWith(tok, words) {
  // Dates, times and codes aren't personal: 26/10/14, 0745-0800, 14OCT26,
  // 100MIL-style codes, 5-digit station/train numbers. Employee numbers are
  // 6+ digits and stay masked.
  if (/^\d{2}\/\d{2}\/\d{2}(-\d{0,4})?$/.test(tok)) return tok;
  if (/^\d{4}-\d{4}$/.test(tok)) return tok;
  if (/^\d{1,3}[A-Za-z]{2,4}\d{0,2}$/.test(tok)) return tok;
  if (/^\d{5}$/.test(tok)) return tok;
  const core = tok.replace(/[^A-Za-z0-9]/g, '');
  if (!core) return tok;
  if (words.has(core.toUpperCase())) return tok;
  if (/^[A-Za-z]{1,2}$/.test(core)) return tok;
  if (/^[0-9]{1,4}$/.test(core)) return tok;
  if (/^[A-Za-z]{1,3}[0-9][A-Za-z0-9]*$/.test(core) && core.length <= 10) return tok;
  return tok.replace(/[A-Za-z]/g, 'A').replace(/[0-9]/g, '9');
}

async function describeFrame(frame) {
  return frame.evaluate(([boardWords, maskSrc]) => {
    const words = new Set(boardWords);
    // eslint-disable-next-line no-eval
    const maskTokenWith = eval(`(${maskSrc})`);
    const text = document.body ? document.body.innerText : '';
    const lines = text.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    // The Train Line-up screen lists trains only, never people (owner
    // confirmed via screenshot 2026-10-14), so it's shown unmasked. Declared
    // before the return below, which calls mask() through screenGrid().
    const noNames = /TRAIN LINE UP/.test(text);
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
      screenGrid: screenGrid(words),
    };

    // CATS draws each mainframe field as an absolutely-positioned element.
    // Grouping fields by their top offset rebuilds the screen's rows, and the
    // left offsets give the columns. Text is masked unless it's a board word,
    // a short code (CO, LE, SB01) or a small number (positions, times), so
    // names and employee numbers don't come through.
    function maskToken(tok) { return maskTokenWith(tok, words); }
    function mask(t) { if (noNames) return t; return maskAll(t); }
    function maskAll(t) { return t.split(/(\s+)/).map((x) => (/\s/.test(x) ? x : maskToken(x))).join(''); }
    function screenGrid() {
      // Every text node is placed by its own on-screen box, whatever element
      // wraps it. CATS nests its text, so walking positioned elements misses it.
      const cells = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const raw = node.textContent.replace(/\s+$/, '');
        if (!raw.trim() || node.parentElement.closest('script,style,noscript')) continue;
        range.selectNodeContents(node);
        const r = range.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        cells.push({ top: Math.round(r.top), left: Math.round(r.left), text: mask(raw.trim()) });
      }
      for (const el of document.querySelectorAll('input,select,textarea')) {
        if (/hidden|submit|button|image/.test(el.type)) continue;
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        // Never show what's in a password box, not even masked.
        const text = el.type === 'password' ? '[password]' : `[${mask(el.value.trim())}]`;
        cells.push({ top: Math.round(r.top), left: Math.round(r.left), text });
      }
      cells.sort((a, b) => a.top - b.top || a.left - b.left);
      const rows = [];
      for (const c of cells) {
        const row = rows.length && Math.abs(rows[rows.length - 1].top - c.top) <= 4 ? rows[rows.length - 1] : null;
        if (row) row.cells.push(`${c.left}:${c.text}`);
        else rows.push({ top: c.top, cells: [`${c.left}:${c.text}`] });
      }
      return rows.slice(0, 120).map((r) => `${r.top} | ${r.cells.join(' | ')}`);
    }
  }, [[...BOARD_WORDS], maskTokenWith.toString()]);
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
