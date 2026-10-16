// Does the board check by itself: you sign in to CATS once, then it walks
// the route the owner taught (Call Board to the yard jobs, Chain Gang 23
// with CO, A/B pools 19/21, SD pool 27, Train Line-up 41) and prints when you go to work,
// the Chain Gang board, the line-up with who's projected on each train, and
// what changed since the last check.
//
//   node scripts/board-auto.js --me SR03              one check
//   node scripts/board-auto.js --me SR03 --every 20   re-check every 20 min
//                                                     (beeps when your answer changes)
//
// You do the Microsoft sign-in (Authenticator). The CATS sign-on is yours too,
// unless CATS_EMPLOYEE_NO and CATS_PASSWORD are in .env: then the script fills
// it, and when a check gets stuck it reloads CATS and signs back in. It only
// reads screens and presses Enter/F3/F8, the same keys you would.
//
// Everything it keeps lives in the data folder (lib/board/paths.js, default
// C:\Users\<you>\BoardChecker, off OneDrive): .env, the browser profile, and
// history\<date>\<HHMM>.txt + .json, one snapshot per check (the report as
// printed, and the masked screens behind it). BOARD_HISTORY_DAYS (default 90)
// says how long snapshots are kept.
//
// With BOARD_RELAY_URL and BOARD_KEY in .env, each check is also sent to the
// 240ca server so the RailroadTracker app on your phone shows it.
//
// With NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID in .env, the line-up snapshot
// website (lib/board/site.js) is rebuilt from history\ and published after a
// check that changed, at most every BOARD_SITE_EVERY minutes (default 30).
const { DATA_DIR, ENV_FILES, PROFILE_DIR, HISTORY_DIR } = require('../lib/board/paths');
require('dotenv').config({ path: ENV_FILES, quiet: true });
const fs = require('fs');
const path = require('path');
const { describeFrame } = require('../lib/board/capture');
const { parseGrid } = require('../lib/board/grid');
const S = require('../lib/board/screens');
const { loadSummary } = require('../lib/board/summary');
const { runBoardCheck } = require('../lib/board/engine');
const { formatReport, describeMe } = require('../lib/board/report');
const { snapshot, changeLines } = require('../lib/board/view');
const { pushCheck } = require('../lib/board/relay');
const { reviewCheck } = require('../lib/board/review');
const { buildSite, deploySite, siteSettings } = require('../lib/board/site');
const { at } = require('../lib/board/time');

const OUT_DIR = DATA_DIR;
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
    // A CATS message screen (broadcast, timeout warning) can have no F3,
    // only Enter to get past it, the same as you'd do by hand.
    try {
      await press(page, 'F3');
    } catch (err) {
      if (!/^No F3 key/.test(err.message)) throw err;
      await press(page, 'Enter');
    }
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
  // 27: the SD (engineer) list that goes with the Chain Gang trains. Not
  // recorded yet, so it's read as it first appears and again with CC = EN.
  const sdPool = async () => {
    const s = expect(await chooseFromMenus(page, 27), is.poolPosition, 'SD pool (27)');
    await capture();
    if (/CC:/.test(s.text)) {
      await fill(page, { '-1': 'EN' });
      expect(await press(page, 'Enter'), is.poolPosition, 'SD pool (27) with EN');
      await capture();
    }
  };
  for (const [option, name, read] of [[19, 'A pool'], [21, 'B pool'], [27, 'SD pool', sdPool]]) {
    try {
      await (read ? read() : pool(option, name));
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
  // The working behind each train, for the AI review.
  const detailed = formatReport(result, input.seen, { details: true });
  const lines = changeLines(prev, cur); // ['', heading, ...one line per change]
  return { text, detailed, first: !prev, changed: lines.length > 2, me: cur.me, changes: lines.filter((l) => l), myAnswerChanged };
}

// Claude's look over the check (lib/board/review.js). Only when something
// changed, so an unchanged board every 5 minutes doesn't cost a call each time.
async function aiReview(detailed) {
  const r = await reviewCheck(detailed);
  if (r.skipped) return null;
  if (r.error) {
    console.log(`  (AI check skipped: ${r.error})`);
    return null;
  }
  const note = `AI CHECK (${r.model}): ${r.note.includes('\n') ? `\n${r.note}` : r.note}`;
  console.log(`\n${note}`);
  return note;
}

// When a check gets stuck, keep the screen it got stuck on (masked, like
// auto-summary.json) so the route can be taught about it. Prints only the
// keys that screen offers, never its text.
async function saveStuckScreen(page) {
  const frame = catsFrame(page);
  if (!frame) return;
  try {
    const screen = await describeFrame(frame);
    const file = path.join(OUT_DIR, 'stuck-screen.json');
    fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...screen }, null, 2));
    const keys = screen.inputs.map((i) => i.name || '')
      .filter((n) => /^acc_|^(default)?btn_Button$/.test(n))
      .map((n) => (n.startsWith('acc_') ? n.slice(4) : 'Enter'));
    console.log(`  Saved the screen it got stuck on to ${path.relative(process.cwd(), file)}`
      + ` (keys on it: ${[...new Set(keys)].join(', ') || 'none'}).`);
  } catch {
    // mid-navigation; nothing to save
  }
}

// One snapshot per check, so any past board can be looked at again:
// history\<date>\<HHMM>.txt is the report as printed (plus the AI note and
// the working behind each train), .json the masked CATS screens behind it.
function saveSnapshot(summary, { text, detailed, note }) {
  const at = new Date(summary.probedAt);
  const day = at.toLocaleDateString('en-CA'); // YYYY-MM-DD, local
  const hhmm = at.toLocaleTimeString('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(':', '');
  const dir = path.join(HISTORY_DIR, day);
  fs.mkdirSync(dir, { recursive: true });
  let base = hhmm;
  for (let n = 2; fs.existsSync(path.join(dir, `${base}.txt`)); n++) base = `${hhmm}-${n}`;
  const parts = [text, note, `\n--- Working ---\n${detailed}`].filter(Boolean);
  fs.writeFileSync(path.join(dir, `${base}.txt`), `${parts.join('\n\n')}\n`);
  fs.writeFileSync(path.join(dir, `${base}.json`), JSON.stringify(summary, null, 2));
}

// The snapshot website. A changed check marks it due; it goes out once
// BOARD_SITE_EVERY minutes have passed since the last publish, so a busy
// board doesn't publish every 5 minutes. Settings are re-read each time, so
// adding them to .env doesn't need a restart.
const site = { due: false, lastAt: 0 };
async function publishSite(changed) {
  const { token, siteId, days, every } = siteSettings();
  if (!token || !siteId) return;
  if (changed) site.due = true;
  if (!site.due || Date.now() - site.lastAt < every * 60000) return;
  site.lastAt = Date.now();
  try {
    const dir = path.join(OUT_DIR, 'site');
    buildSite({ historyDir: HISTORY_DIR, outDir: dir, days });
    const sent = await deploySite({ dir, siteId, token });
    if (sent.ok) site.due = false;
    console.log(sent.ok ? `[${stamp()}] Snapshot website updated.` : `[${stamp()}] Snapshot website not updated: ${sent.message}`);
  } catch (err) {
    console.log(`[${stamp()}] Snapshot website not updated: ${err.message}`);
  }
}

// Deletes day folders older than BOARD_HISTORY_DAYS (default 90; 0 keeps all).
function pruneHistory() {
  const days = process.env.BOARD_HISTORY_DAYS === undefined ? 90 : +process.env.BOARD_HISTORY_DAYS;
  if (!(days > 0)) return;
  const cutoff = new Date(Date.now() - days * 86400000).toLocaleDateString('en-CA');
  let dirs = [];
  try { dirs = fs.readdirSync(HISTORY_DIR); } catch { return; }
  for (const d of dirs) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < cutoff) fs.rmSync(path.join(HISTORY_DIR, d), { recursive: true, force: true });
  }
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

// The CATS sign-on (employee number + CATS password, after Microsoft's) is
// filled from .env when CATS_EMPLOYEE_NO and CATS_PASSWORD are set (owner's
// decision, 2026-10-15). Microsoft and Authenticator stay with you. Neither
// value is ever printed or saved anywhere else.
const CATS_LOGIN = process.env.CATS_EMPLOYEE_NO && process.env.CATS_PASSWORD
  ? { user: process.env.CATS_EMPLOYEE_NO, password: process.env.CATS_PASSWORD }
  : null;
// Off after one refused sign-on, so a wrong password can't lock the account.
let autoSignOn = !!CATS_LOGIN;
let signOnFailures = 0;

async function signOn(page) {
  const filled = await catsFrame(page).evaluate(([user, password]) => {
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const pw = document.querySelector('input[type=password]');
    // The employee number box is the empty one; the others come filled (D, N).
    const box = [...document.querySelectorAll('input[type=text]')].filter(visible).find((el) => !el.value.trim());
    if (!pw || !box) return false;
    box.value = user;
    pw.value = password;
    return true;
  }, [CATS_LOGIN.user, CATS_LOGIN.password]);
  if (!filled) throw new OffRoute("Couldn't find the CATS sign-on boxes.");
  const s = await press(page, 'Enter');
  if (s && is.signOn(s)) {
    autoSignOn = false;
    console.log('\x07CATS refused the employee number/password in .env. Sign in by hand; automatic'
      + ' sign-on is off until you restart the script, so it can\'t lock your account.');
    return;
  }
  signOnFailures = 0;
  console.log(`[${stamp()}] Signed in to CATS.`);
  await toMainMenu(page); // past any notice CATS shows after signing on
}

async function waitForMainMenu(page, prompt) {
  console.log(prompt);
  for (;;) {
    const s = await screenState(page);
    if (s && is.mainMenu(s)) return;
    if (s && is.signOn(s) && autoSignOn) {
      try {
        await signOn(page);
      } catch (err) {
        if (!(err instanceof NeedSignIn)) console.log(`  (automatic sign-on didn't finish: ${err.message})`);
        if (++signOnFailures >= 3) {
          autoSignOn = false;
          console.log('\x07Automatic sign-on failed 3 times; sign in by hand.');
        }
        await sleep(5000);
      }
      continue;
    }
    await sleep(1000);
  }
}

// Last resort when a check gets stuck: load CATS again from the start and
// sign back in.
async function reloadCats(page, url) {
  console.log(`[${stamp()}] Reloading CATS to get unstuck…`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (err) {
    console.log(`  (reload: ${err.message})`);
  }
  await waitForMainMenu(page, autoSignOn
    ? 'Signing back in. If Microsoft asks, sign in there (Authenticator) and the script does the rest.'
    : '\x07Sign in to CATS again and stop at the main menu.');
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

  const relay = process.env.BOARD_RELAY_URL && process.env.BOARD_KEY
    ? { url: process.env.BOARD_RELAY_URL, key: process.env.BOARD_KEY }
    : null;

  const { chromium } = loadPlaywright();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const signIn = CATS_LOGIN
    ? '\nSign in to Microsoft in the browser window (Authenticator); the script fills the CATS sign-on.\n'
      + 'Leave the window alone while it works.'
    : '\nSign in to CATS in the browser window (Microsoft, Authenticator, CATS sign-on).\n'
      + 'Stop at the CATS main menu; the script takes over from there. Leave the window alone while it works.';
  await waitForMainMenu(page, signIn);

  let retried = false;
  for (;;) {
    let retryNow = false;
    try {
      console.log(`\n[${stamp()}] Checking the board…`);
      const summary = await runRoute(page);
      fs.writeFileSync(path.join(OUT_DIR, 'auto-summary.json'), JSON.stringify(summary, null, 2));
      const { text, detailed, first, changed, me: meLines, changes, myAnswerChanged } = answer(summary, me, nowOverride);
      console.log(`${myAnswerChanged ? '\x07' : ''}\n${text}`);
      const note = first || changed ? await aiReview(detailed) : null;
      try {
        saveSnapshot(summary, { text, detailed, note });
        pruneHistory();
      } catch (err) {
        console.log(`  (snapshot not saved: ${err.message})`);
      }
      if (relay) {
        const report = note ? `${text}\n\n${note}` : text;
        const check = { checkedAt: summary.probedAt, me: meLines, report, changes, myAnswerChanged };
        const sent = await pushCheck({ ...relay, check });
        console.log(sent.ok ? `[${stamp()}] Sent to your phone.` : `[${stamp()}] Not sent to your phone: ${sent.message}`);
      }
      await publishSite(first || changed);
      retried = false;
    } catch (err) {
      if (err instanceof NeedSignIn) {
        await waitForMainMenu(page, autoSignOn
          ? `\n[${stamp()}] CATS signed you out; signing back in.`
          : '\x07\nCATS signed you out. Sign in again and stop at the main menu.');
        continue;
      }
      console.log(`[${stamp()}] Couldn't finish this check: ${err.message}`);
      await saveStuckScreen(page);
      if (!every) throw err;
      // Reload, sign back in and check again straight away, once; if that
      // fails too, wait for the next check.
      await reloadCats(page, url);
      retryNow = !retried;
      retried = true;
    }
    if (retryNow) continue;
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
