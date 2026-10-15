// Does the board check by itself: you sign in to CATS once, then it walks
// the route the owner taught (Call Board to the yard jobs, Chain Gang 23
// with CO, A/B pools 19/21, Train Line-up 41) and prints when you go to work,
// the Chain Gang board, the line-up with who's projected on each train, and
// what changed since the last check.
//
//   node scripts/board-auto.js --me SR03              one check
//   node scripts/board-auto.js --me SR03 --every 20   re-check every 20 min
//                                                     (beeps when your answer changes)
//
// You do the sign-in yourself (Microsoft, Authenticator, CATS password); the
// script never sees or stores any of it. It only reads screens and presses
// Enter/F3/F8, the same keys you would. Each check's masked screens are saved
// to probe-out/auto-summary.json (no names) if you want to share one.
const fs = require('fs');
const path = require('path');
const { describeFrame } = require('../lib/board/capture');
const { parseGrid } = require('../lib/board/grid');
const S = require('../lib/board/screens');
const { loadSummary } = require('../lib/board/summary');
const { runBoardCheck } = require('../lib/board/engine');
const { formatReport, describeMe } = require('../lib/board/report');
const { snapshot } = require('../lib/board/view');
const { at } = require('../lib/board/time');

const OUT_DIR = path.join(__dirname, '..', 'probe-out');
const PROFILE_DIR = path.join(OUT_DIR, 'profile');
const LAST_FILE = path.join(OUT_DIR, 'last-check.json');
const START_URL = 'https://cats.cn.ca/';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toLocaleTimeString('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit' });

class NeedSignIn extends Error {}
class OffRoute extends Error {}

// --- Reading the current screen --------------------------------------------

function catsFrame(page) {
  return page.frames().find((f) => f.name() === 'jacadaframe') || null;
}

async function screenState(page) {
  const frame = catsFrame(page);
  if (!frame) return null;
  try {
    return await frame.evaluate(() => {
      const seq = document.querySelector('input[name=sequenceNumber]');
      const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      return {
        seq: seq ? seq.value : null,
        // One line of text: CATS draws each word in its own box, so
        // "END OF FILE" can come through split across lines.
        text: document.body ? document.body.innerText.replace(/\s+/g, ' ') : '',
        textInputs: [...document.querySelectorAll('input[type=text]')].filter(visible).map((el) => el.name),
        hasPassword: !!document.querySelector('input[type=password]'),
      };
    });
  } catch {
    return null; // mid-navigation
  }
}

// What each screen on the route looks like (real, unmasked screen text).
const is = {
  signOn: (s) => s.hasPassword,
  mainMenu: (s) => /MILEAGE/.test(s.text) && !/CHAIN GANG/.test(s.text) && s.textInputs.length >= 3,
  trainService: (s) => /CHAIN GANG/.test(s.text) && /LINE-UP/.test(s.text) && s.textInputs.length >= 3,
  callBoardPrompt: (s) => /CALL BOARD/.test(s.text) && !/PAGE \d+ OF \d+/.test(s.text) && !/CHAIN GANG/.test(s.text),
  callBoardList: (s) => /CALL BOARD/.test(s.text) && /PAGE \d+ OF \d+/.test(s.text),
  poolPosition: (s) => /POOL:/.test(s.text) && /TERM:/.test(s.text),
  lineup: (s) => /TRAIN LINE UP/.test(s.text),
};

// --- Doing things on the screen ---------------------------------------------

// CATS bumps sequenceNumber on every new screen; wait for that, not a clock.
async function waitForNewScreen(page, oldSeq, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = await screenState(page);
    if (s && s.seq !== null && s.seq !== oldSeq) {
      await sleep(300); // let the frame finish drawing
      return (await screenState(page)) || s;
    }
    await sleep(300);
  }
  throw new OffRoute('CATS did not answer within a minute.');
}

// Enter and the PF keys are submit buttons in Jacada's page.
async function press(page, key) {
  const before = await screenState(page);
  const frame = catsFrame(page);
  const names = key === 'Enter' ? ['btn_Button', 'defaultbtn_Button'] : [`acc_${key}`];
  const clicked = await frame.evaluate((ns) => {
    for (const n of ns) {
      const el = document.querySelector(`input[name="${n}"]`);
      if (el) { el.click(); return true; }
    }
    return false;
  }, names);
  if (!clicked) throw new OffRoute(`No ${key} key on this screen.`);
  return waitForNewScreen(page, before && before.seq);
}

// Fill the visible text boxes by their order on screen (CATS renames them
// from visit to visit, so names can't be relied on). `values` maps box index
// to text; negative indexes count from the end.
async function fill(page, values) {
  const frame = catsFrame(page);
  await frame.evaluate((vals) => {
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const boxes = [...document.querySelectorAll('input[type=text]')].filter(visible);
    for (const [k, v] of Object.entries(vals)) {
      const i = +k < 0 ? boxes.length + +k : +k;
      if (boxes[i]) boxes[i].value = v;
    }
  }, values);
}

function expect(s, check, what) {
  if (!s || !check(s)) {
    if (s && is.signOn(s)) throw new NeedSignIn();
    throw new OffRoute(`Expected the ${what} screen but landed somewhere else.`);
  }
  return s;
}

async function toMainMenu(page) {
  for (let i = 0; i < 6; i++) {
    const s = await screenState(page);
    if (s && is.signOn(s)) throw new NeedSignIn();
    if (s && is.mainMenu(s)) return s;
    if (!s) { await sleep(1000); continue; }
    await press(page, 'F3');
  }
  throw new OffRoute("Couldn't get back to the CATS main menu with F3.");
}

async function chooseFromMenus(page, option) {
  await toMainMenu(page);
  await fill(page, { 0: '45', 1: 'SA', 2: '3' });
  expect(await press(page, 'Enter'), is.trainService, 'Train Service menu');
  await fill(page, { 2: String(option) });
  return press(page, 'Enter');
}

// --- One full check ----------------------------------------------------------

async function runRoute(page) {
  const screens = [];
  const capture = async () => {
    const grid = (await describeFrame(catsFrame(page))).screenGrid;
    screens.push({ step: screens.length + 1, at: new Date().toISOString(), screenGrid: grid });
    return grid;
  };

  // Call Board: 3 → 6 → Enter, then F8 until the yard jobs start.
  let cb = await chooseFromMenus(page, 6);
  if (!is.callBoardList(cb || { text: '' })) {
    expect(cb, is.callBoardPrompt, 'Call Board prompt');
    expect(await press(page, 'Enter'), is.callBoardList, 'Call Board');
  }
  for (let pageNo = 0; pageNo < 15; pageNo++) {
    const grid = await capture();
    const parsed = S.parseCallBoardPage(parseGrid(grid));
    const m = /PAGE (\d+) OF (\d+)/.exec((await screenState(page)).text);
    if (parsed.reachedYard || (m && +m[1] >= +m[2])) break;
    expect(await press(page, 'F8'), is.callBoardList, 'next Call Board page');
  }

  // Pool positions, conductors only (CC = CO): 23 Chain Gang (needed), then
  // 19 A pool and 21 B pool (only to name the A/B turns on the line-up, so a
  // problem there doesn't stop the check).
  const pool = async (option, name) => {
    expect(await chooseFromMenus(page, option), is.poolPosition, `${name} (${option})`);
    await fill(page, { '-1': 'CO' });
    expect(await press(page, 'Enter'), is.poolPosition, `${name} (${option}) with CO`);
    await capture();
  };
  await pool(23, 'Chain Gang');
  for (const [option, name] of [[19, 'A pool'], [21, 'B pool']]) {
    try {
      await pool(option, name);
    } catch (err) {
      if (err instanceof NeedSignIn) throw err;
      console.log(`  (skipped ${name} ${option}: ${err.message})`);
    }
  }

  // Train Line-up: 41, Sarnia (47130), eastbound, 24 h ahead.
  expect(await chooseFromMenus(page, 41), is.lineup, 'Train Line-up (41)');
  await fill(page, { 0: '47130', 1: 'E', '-1': '24' });
  let s = expect(await press(page, 'Enter'), is.lineup, 'Train Line-up');
  for (let pageNo = 0; pageNo < 6; pageNo++) {
    await capture();
    if (/END OF FILE/.test(s.text)) break;
    s = expect(await press(page, 'F8'), is.lineup, 'next Line-up page');
  }

  await toMainMenu(page); // leave CATS ready for the next check
  return { probedAt: new Date().toISOString(), screens };
}

// The full view, plus what changed since the previous check (kept in
// probe-out/last-check.json, so it carries over between runs).
function answer(summary, me, nowOverride) {
  const input = loadSummary(summary, { now: nowOverride });
  const result = runBoardCheck({ ...input, me });
  const cur = snapshot(result, result.me ? describeMe(result.me) : []);
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(LAST_FILE, 'utf8')); } catch { /* first check */ }
  const text = formatReport(result, input.seen, { changes: { prev, cur } });
  fs.writeFileSync(LAST_FILE, JSON.stringify(cur, null, 2));
  const myAnswerChanged = !!prev && prev.me.join('\n') !== cur.me.join('\n');
  return { text, myAnswerChanged };
}

// --- Main ----------------------------------------------------------------------

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error('Playwright is not installed. Run:\n  npm install --no-save playwright && npx playwright install chromium');
    process.exit(1);
  }
}

async function waitForMainMenu(page, prompt) {
  console.log(prompt);
  for (;;) {
    const s = await screenState(page);
    if (s && is.mainMenu(s)) return;
    await sleep(1000);
  }
}

async function main() {
  const me = arg('--me');
  if (!me) {
    console.error('Usage: node scripts/board-auto.js --me SR03 [--every MINUTES]');
    process.exit(1);
  }
  const every = arg('--every') ? Math.max(5, +arg('--every')) : null;
  const url = arg('--url') || START_URL; // --url is for testing against a local copy
  let nowOverride;
  if (arg('--now')) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(arg('--now'));
    nowOverride = at(+m[1], +m[2], +m[3], +m[4], +m[5]);
  }

  const { chromium } = loadPlaywright();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const signIn = '\nSign in to CATS in the browser window (Microsoft, Authenticator, CATS sign-on).\n'
    + 'Stop at the CATS main menu; the script takes over from there. Leave the window alone while it works.';
  await waitForMainMenu(page, signIn);

  for (;;) {
    try {
      console.log(`\n[${stamp()}] Checking the board…`);
      const summary = await runRoute(page);
      fs.writeFileSync(path.join(OUT_DIR, 'auto-summary.json'), JSON.stringify(summary, null, 2));
      const { text, myAnswerChanged } = answer(summary, me, nowOverride);
      console.log(`${myAnswerChanged ? '\x07' : ''}\n${text}`);
    } catch (err) {
      if (err instanceof NeedSignIn) {
        await waitForMainMenu(page, '\x07\nCATS signed you out. Sign in again and stop at the main menu.');
        continue;
      }
      console.log(`[${stamp()}] Couldn't finish this check: ${err.message}`);
      if (!every) throw err;
    }
    if (!every) break;
    console.log(`[${stamp()}] Next check in ${every} minutes. Keep this window and the browser open (Ctrl+C to stop).`);
    await sleep(every * 60000);
  }
  await context.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
