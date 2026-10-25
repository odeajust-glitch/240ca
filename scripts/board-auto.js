// Does the board check by itself: you sign in to CATS once, then it walks
// the route the owner taught (Call Board to the yard jobs, Chain Gang 23
// with CO, A/B pools 19/21, SD pool 27, S1/S3 pools 25/26 with EN, Train Line-up 41,
// then Mac yard: bunkhouse 28 and line-up 41 for 41975 W) and prints when you go to work,
// the Chain Gang board, the line-up with who's projected on each train, and
// what changed since the last check.
//
//   node scripts/board-auto.js --me SR03              one check
//   node scripts/board-auto.js --me SR03 --every 20   re-check every 20 min
//                                                     (beeps when your answer changes)
//
// Press R in this window (or publish "signin" to the ntfy topic
// <BOARD_NTFY_TOPIC>-signin from your phone) for a fresh Microsoft sign-in
// after the current check, so the ~24 h CN sign-in restarts before you leave; it also does one
// by itself when your turn shows on duty on the Sarnia Call Board
// (lib/board/signin.js). You approve it in Authenticator either way.
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
// With R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in
// .env (Cloudflare, owner 2026-10-22; docs/board-checker/CLOUDFLARE.md), or
// else NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID, the line-up snapshot website
// (lib/board/site.js) is rebuilt from history\ and published after a check
// that changed, at most every BOARD_SITE_EVERY minutes (default 15 on
// Cloudflare, 90 on Netlify).
const { DATA_DIR, ENV_FILES, HISTORY_DIR, NAMES_FILE, ROAD_DAYS_FILE, TOLD_FILE, PHONES_FILE, PUSH_KEYS_FILE, HEARTBEAT_FILE, browser, alertsLog, FILLINS_FILE, HOLDERS_FILE, PERSON_TURNS_FILE } = require('../lib/board/paths');
const Holders = require('../lib/board/holders');
const FillIns = require('../lib/board/fillins');
const RoadDays = require('../lib/board/roadday');
const SignIn = require('../lib/board/signin');
const Remote = require('../lib/board/remote');
const TurnAlerts = require('../lib/board/alerts');
// For scripts/board-watchdog.js: what it's doing, so it can tell stuck from busy.
const { beat } = require('../lib/board/watchdog');
const heartbeat = (state) => beat(HEARTBEAT_FILE, state);
const { sendPush, loadOrCreateKeys } = require('../lib/board/webpush');
const { listSubscriptions, deleteObject } = require('../lib/board/r2');
const { loadNames, recordNames, saveNames } = require('../lib/board/names');
require('dotenv').config({ path: ENV_FILES, quiet: true });
const fs = require('fs');
const path = require('path');
const { describeFrame } = require('../lib/board/capture');
const { parseGrid } = require('../lib/board/grid');
const People = require('../lib/board/people');
const S = require('../lib/board/screens');
const { loadSummary } = require('../lib/board/summary');
const { runBoardCheck } = require('../lib/board/engine');
const { formatReport, describeMe } = require('../lib/board/report');
const { snapshot, changeLines } = require('../lib/board/view');
const { pushCheck, mineForPhone } = require('../lib/board/relay');
const { reviewCheck } = require('../lib/board/review');
const { buildSite, publishSiteDir, siteSettings } = require('../lib/board/site');
const { at } = require('../lib/board/time');
const config = require('../lib/board/config');

const OUT_DIR = DATA_DIR;
const LAST_FILE = path.join(OUT_DIR, 'last-check.json');
const SIGNIN_FILE = path.join(OUT_DIR, 'ms-signin.json');
const START_URL = 'https://cats.cn.ca/';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

// A Train Service option number from the command line (e.g. --s1 25).
function optionArg(name) {
  const v = arg(name);
  if (v === undefined) return null;
  if (!/^\d{1,3}$/.test(v)) throw new Error(`${name} needs a Train Service option number, e.g. ${name} 25`);
  return +v;
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

// CATS sometimes shows messages right after signing on. Press Enter to clear
// them, as the owner does by hand (2026-10-16): up to 5 times, stopping as
// soon as the main menu shows, so nothing extra gets pressed.
async function clearMessages(page, max = 5) {
  for (let i = 0; i < max; i++) {
    const s = await screenState(page);
    if (!s || is.mainMenu(s) || is.signOn(s)) return s;
    try {
      await press(page, 'Enter');
    } catch (err) {
      if (err instanceof OffRoute) return null; // no Enter key, or no answer
      throw err;
    }
  }
  return screenState(page);
}

// menu: the main-menu choice, 3 = Train Service (most screens), 1 = Engine
// Service (owner, 2026-10-24: engineer spareboards 1 → 19 / 17).
async function chooseFromMenus(page, option, menu = 3) {
  await toMainMenu(page);
  await fill(page, { 0: '45', 1: 'SA', 2: String(menu) });
  const m = await press(page, 'Enter');
  if (menu === 3) {
    expect(m, is.trainService, 'Train Service menu');
    await fill(page, { 2: String(option) });
  } else {
    // 1 = ENGINE SERVICE (owner's screenshot): 45 / SA / SELECTION, like 3.
    expect(m, (x) => /ENGINE\s+SERVICE/.test(x.text) && x.textInputs.length >= 3, `menu ${menu}`);
    await fill(page, { 2: String(option) });
  }
  return press(page, 'Enter');
}

// --- One full check ----------------------------------------------------------

// Who's on which turn, by surname + first initial, from the boards read
// unmasked (owner, 2026-10-24: a yard job's crew shows names, not turns).
// Saved across restarts with the names hashed, by the owner's rules on
// what counts as someone's own turn (lib/board/holders.js). A name on two
// turns of the same kind is left unmatched.
let holders = null;
const knownPeople = {
  get: (key) => Holders.turnOf(holders || (holders = Holders.loadHolders(HOLDERS_FILE)), key),
};
function learnPeople(list) {
  holders = Holders.learn(holders || Holders.loadHolders(HOLDERS_FILE), list, Date.now());
  try { Holders.saveHolders(HOLDERS_FILE, holders); } catch (err) { console.log(`  (turn holders not saved: ${err.message})`); }
}

async function runRoute(page, opts = {}) {
  const screens = [];
  const yardNames = []; // yard job crews by name, matched to turns at the end
  const trainNames = []; // train crews by name: who's working whose job
  const unmaskedRows = async () => {
    try { return parseGrid((await describeFrame(catsFrame(page), { unmasked: true })).nameGrid); } catch { return null; }
  };
  const boardNames = []; // this check's people on boards, under their own turn
  const bunkNames = []; // the bunkhouse, by name: checked against own turns at the end
  const learn = async () => {
    const rows = await unmaskedRows();
    if (!rows) return;
    boardNames.push(...S.parseBoardNames(rows)); // learned once, at the end
  };
  // `label` tells the loader which screens are Mac yard's (they look like
  // Sarnia's 23 and 41).
  const capture = async (label) => {
    const grid = (await describeFrame(catsFrame(page))).screenGrid;
    screens.push({ step: screens.length + 1, at: new Date().toISOString(), screenGrid: grid, ...(label ? { label } : {}) });
    return grid;
  };

  // Call Board: 3 → 6 → Enter, then F8 through the trains and the yard jobs
  // until the crews in town (owner, 2026-10-24: "CREWS IN TOWN POOL: S1/SA
  // C+C RESTED/STATUS"), or the last page.
  let cb = await chooseFromMenus(page, 6);
  if (!is.callBoardList(cb || { text: '' })) {
    expect(cb, is.callBoardPrompt, 'Call Board prompt');
    expect(await press(page, 'Enter'), is.callBoardList, 'Call Board');
  }
  for (let pageNo = 0; pageNo < 45; pageNo++) {
    const grid = await capture();
    const parsed = S.parseCallBoardPage(parseGrid(grid));
    // Crew names for the grievance letters: a second, unmasked read kept in
    // memory; only train + turn + name go on, into names.json (never into
    // `screens`, which is saved, reviewed and relayed).
    if (opts.names) {
      try {
        const { nameGrid } = await describeFrame(catsFrame(page), { unmasked: true });
        opts.names.push(...S.parseCallBoardNames(parseGrid(nameGrid)));
      } catch { /* the letters can do without; the check can't wait on it */ }
    }
    {
      const rows = await unmaskedRows();
      if (rows) { yardNames.push(...S.parseYardCrewNames(rows)); trainNames.push(...S.parseTrainCrewNames(rows)); }
    }
    const shown = (await screenState(page)).text;
    const m = /PAGE (\d+) OF (\d+)/.exec(shown);
    if (parsed.crewsInTown || /CREWS\s*IN\s*TOWN/.test(shown) || (m && +m[1] >= +m[2])) break;
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
    await learn();
  };
  await pool(23, 'Chain Gang');
  // Engineer lists: 27 SD (with the Chain Gang), and S1 (with A) / S3 (with
  // B), options 25/26 (config; --s1 N / --s3 N override). Read as they
  // first appear and again with CC = EN.
  const enginePool = (option, name) => async () => {
    const s = expect(await chooseFromMenus(page, option), is.poolPosition, `${name} (${option})`);
    await capture();
    if (/CC:/.test(s.text)) {
      await fill(page, { '-1': 'EN' });
      expect(await press(page, 'Enter'), is.poolPosition, `${name} (${option}) with EN`);
      await capture();
    }
    await learn();
  };
  const extra = [[19, 'A pool'], [21, 'B pool'], [27, 'SD pool', enginePool(27, 'SD pool')]];
  if (opts.s1) extra.push([opts.s1, 'S1 pool', enginePool(opts.s1, 'S1 pool')]);
  if (opts.s3) extra.push([opts.s3, 'S3 pool', enginePool(opts.s3, 'S3 pool')]);
  for (const [option, name, read] of extra) {
    try {
      await (read ? read() : pool(option, name));
    } catch (err) {
      if (err instanceof NeedSignIn) throw err;
      console.log(`  (skipped ${name} ${option}: ${err.message})`);
    }
  }

  // Train Line-up: 41, Sarnia (47130), eastbound, 24 h ahead.
  expect(await chooseFromMenus(page, 41), is.lineup, 'Train Line-up (41)');
  // POOL isn't touched: an S1 left there from Mac yard's line-up changes
  // nothing on Sarnia's (owner, 2026-10-17).
  await fill(page, { 0: '47130', 1: 'E', '-1': '24' });
  let s = expect(await press(page, 'Enter'), is.lineup, 'Train Line-up');
  for (let pageNo = 0; pageNo < 6; pageNo++) {
    await capture();
    if (/END OF FILE/.test(s.text)) break;
    s = expect(await press(page, 'F8'), is.lineup, 'next Line-up page');
  }

  // Mac yard (owner, 2026-10-17); trouble here only skips them.
  // 28: crews in the bunkhouse, no CC. F8 until a page has no crew.
  try {
    let b = expect(await chooseFromMenus(page, 28), is.poolPosition, 'Bunkhouse (28)');
    for (let pageNo = 0; pageNo < 10; pageNo++) {
      const grid = await capture('bunkhouse');
      // Who's really in the bunkhouse under each turn (fill-ins): names in
      // memory only, never learned from (a spare there shows under the job).
      const rows = await unmaskedRows();
      if (rows) bunkNames.push(...S.parseBoardNames(rows));
      let crews = 0;
      try { crews = S.parseChainGang(parseGrid(grid), Date.now() / 60000).turns.length; } catch { /* no heading: no crews */ }
      if (!crews) break;
      const next = await press(page, 'F8');
      if (!next || !is.poolPosition(next) || next.text === b.text) break; // no more pages
      b = next;
    }
  } catch (err) {
    if (err instanceof NeedSignIn) throw err;
    console.log(`  (skipped Bunkhouse 28: ${err.message})`);
  }
  // 41 for Mac yard: station 41975, westbound, pool S1, 24 h ahead.
  try {
    expect(await chooseFromMenus(page, 41), is.lineup, 'Mac yard line-up (41)');
    await fill(page, { 0: '41975', 1: 'W', 2: 'S1', '-1': '24' });
    let m = expect(await press(page, 'Enter'), is.lineup, 'Mac yard line-up');
    for (let pageNo = 0; pageNo < 6; pageNo++) {
      await capture('mac');
      if (/END OF FILE/.test(m.text)) break;
      m = expect(await press(page, 'F8'), is.lineup, 'next Mac yard line-up page');
    }
  } catch (err) {
    if (err instanceof NeedSignIn) throw err;
    console.log(`  (skipped Mac yard line-up 41: ${err.message})`);
  }

  // Owner, 2026-10-24: the spareboards, the jobs going spare, 501/502 and
  // Garnet. Each is labelled for the loader; trouble with one only skips it.
  const skip = async (name, fn) => {
    try { await fn(); } catch (err) {
      if (err instanceof NeedSignIn) throw err;
      console.log(`  (skipped ${name}: ${err.message})`);
    }
  };
  // Spareboards: F8 until "END OF SPAREBOARD".
  const spareboard = (menu, option, label, name) => skip(`${name} ${menu} → ${option}`, async () => {
    let sb = await chooseFromMenus(page, option, menu);
    if (sb && !/SPAREBOARD/.test(sb.text)) sb = await press(page, 'Enter'); // a prompt first
    expect(sb, (x) => /SPAREBOARD/.test(x.text), name);
    for (let pageNo = 0; pageNo < 15; pageNo++) {
      await capture(label);
      await learn();
      if (/END\s+OF\s+SPAREBOARD/.test(sb.text)) break;
      const next = await press(page, 'F8');
      if (!next || next.text === sb.text || !/SPAREBOARD/.test(next.text)) break;
      sb = next;
    }
  });
  await spareboard(3, 13, 'co-fast', 'Conductor fast board');
  await spareboard(3, 9, 'co-slow', 'Conductor slow board');
  await spareboard(1, 19, 'en-fast', 'Engineer fast board');
  await spareboard(1, 17, 'en-slow', 'Engineer slow board');
  // 5: the terminal line-up (vacancies only, as set), Enter, F8 to END OF FILE.
  await skip('Jobs going spare 5', async () => {
    expect(await chooseFromMenus(page, 5), (x) => /TERMINAL\s+LINEUP/.test(x.text), 'Terminal line-up (5)');
    let t = expect(await press(page, 'Enter'), (x) => /TERMINAL\s+LINEUP/.test(x.text), 'Terminal line-up');
    for (let pageNo = 0; pageNo < 10; pageNo++) {
      await capture('terminal');
      if (/END\s+OF\s+FILE/.test(t.text)) break;
      const next = await press(page, 'F8');
      if (!next || next.text === t.text || !/TERMINAL\s+LINEUP/.test(next.text)) break;
      t = next;
    }
  });
  // 29: 501/502, 31: crews in Garnet. Pool screens as they first show.
  for (const [option, label, name] of [[29, 's5', '501/502'], [31, 'garnet', 'Garnet']]) {
    await skip(`${name} ${option}`, async () => {
      let ps = expect(await chooseFromMenus(page, option), is.poolPosition, `${name} (${option})`);
      for (let pageNo = 0; pageNo < 6; pageNo++) {
        await capture(label);
        await learn();
        if (/END\s+OF\s+POOL\s+LISTING/.test(ps.text)) break;
        const next = await press(page, 'F8').catch(() => null);
        if (!next || !is.poolPosition(next) || next.text === ps.text) break;
        ps = next;
      }
    });
  }

  await toMainMenu(page); // leave CATS ready for the next check
  // Whose turn is whose, from every board this check, all at once so the
  // rules decide (a Chain Gang assignment over a spareboard listing).
  learnPeople(boardNames);
  // Yard job crews matched to turns: job + craft + turn only, no names.
  const yardCrew = yardNames.map((y) => ({ job: y.job, craft: y.craft, turn: knownPeople.get(y.key) || null }));
  const matched = yardCrew.filter((y) => y.turn).length;
  if (yardCrew.length) console.log(`  Yard jobs: ${matched} of ${yardCrew.length} crew matched to a turn.`);
  // A train crew member whose own turn (by name) isn't the job's turn: a
  // spare person filling in (owner, 2026-10-24). Job + craft + turns only.
  const backfill = trainNames.map((t) => ({ train: t.train, craft: t.craft, job: t.job, turn: knownPeople.get(t.key) || null }))
    .filter((t) => t.turn && t.turn !== t.job);
  if (backfill.length) console.log(`  Filling in: ${backfill.map((b) => `${b.turn} on ${b.job} (${b.train})`).join(', ')}.`);
  // In the bunkhouse under a turn: its own holder, or a spare filling in.
  const bunkFill = bunkNames.map((b) => ({ job: b.turn, turn: knownPeople.get(b.key) || null })).filter((b) => b.turn);
  const bunkSpares = bunkFill.filter((b) => b.turn !== b.job);
  if (bunkSpares.length) console.log(`  In Toronto filling in: ${bunkSpares.map((b) => `${b.turn} as ${b.job}`).join(', ')}.`);
  // The hidden search (lib/board/people.js): who was on which turn this
  // check, as a hash of the person's code + the turn. No names, no codes.
  const seen = new Map();
  const sight = (code, turn, own) => {
    if (!code || !turn) return;
    const h = People.personHash(code);
    const k = `${h}/${turn}`;
    seen.set(k, { h, turn, own: own || (seen.get(k) || {}).own || false });
  };
  for (const b of boardNames) sight(b.code, b.turn, !!b.own);
  for (const t of trainNames) sight(t.code, t.job, knownPeople.get(t.key) === t.job);
  for (const y of yardNames) sight(y.code, y.job, false);
  // In the Toronto bunkhouse under a turn (their own or one they're covering).
  for (const b of bunkNames) sight(b.code, b.turn, knownPeople.get(b.key) === b.turn);
  return { probedAt: new Date().toISOString(), screens, yardCrew: yardCrew.filter((y) => y.turn), backfill, bunkFill, people: [...seen.values()] };
}

// The full view, plus what changed since the previous check (kept in
// probe-out/last-check.json, so it carries over between runs).
function answer(summary, me, nowOverride) {
  const input = loadSummary(summary, { now: nowOverride });
  // Trains earlier checks saw on duty still count toward their road day's
  // A/B trains once they leave the Call Board. First run: built from history\.
  const memory = RoadDays.remember(RoadDays.loadMemory(ROAD_DAYS_FILE) || RoadDays.seedFromHistory(HISTORY_DIR), input.callBoard, input.now);
  try { RoadDays.saveMemory(ROAD_DAYS_FILE, memory); } catch (err) { console.log(`  (road-day trains not saved: ${err.message})`); }
  const result = runBoardCheck({ ...input, departed: RoadDays.departed(memory, input.callBoard), seenSince: memory.since, me });
  // Who's filling in on whose trip, until it's back (lib/board/fillins.js).
  const home = (list) => (list || []).filter((t) => !t.working).map((t) => t.turn);
  const fillIns = FillIns.updateFillIns(FillIns.loadFillIns(FILLINS_FILE), {
    backfill: summary.backfill || [], bunk: summary.bunkFill || [], callBoard: input.callBoard, now: input.now,
    homeTurns: new Set([input.chainGangHome, input.aHome, input.bHome, input.sdHome, input.s1Home, input.s3Home].flatMap(home)),
    spareTurns: new Set(Object.values(input.spareboards || {}).flatMap(home)),
  });
  try { FillIns.saveFillIns(FILLINS_FILE, fillIns); } catch (err) { console.log(`  (fill-ins not saved: ${err.message})`); }
  const cur = snapshot(result, result.me ? describeMe(result.me) : []);
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(LAST_FILE, 'utf8')); } catch { /* first check */ }
  const text = formatReport(result, input.seen, { changes: { prev, cur } });
  fs.writeFileSync(LAST_FILE, JSON.stringify(cur, null, 2));
  const myAnswerChanged = !!prev && prev.me.join('\n') !== cur.me.join('\n');
  // The working behind each train, for the AI review.
  const detailed = formatReport(result, input.seen, { details: true });
  const lines = changeLines(prev, cur); // ['', heading, ...one line per change]
  // Toronto (bunkhouse + Mac yard line-up) isn't in the Sarnia report, so it
  // gets its own fingerprint: a change there also updates the website.
  const toronto = JSON.stringify({ b: input.bunkhouse, m: input.macLineup.map((t) => [t.symbol, t.originDay, t.order, t.status]) });
  return { text, detailed, first: !prev, changed: lines.length > 2, me: cur.me, mine: mineForPhone(result.me), changes: lines.filter((l) => l), myAnswerChanged, toronto,
    callBoard: input.callBoard, alertNow: input.now, alertStates: TurnAlerts.turnStates(result, input.callBoard, { chainGang: input.chainGangHome, sd: input.sdHome, a: input.aHome, b: input.bHome, s1: input.s1Home, s3: input.s3Home,
      lineup: input.seen.lineup ? input.lineup : null, macLineup: input.seen.macLineup ? input.macLineup : null, bunkhouse: input.seen.bunkhouse ? input.bunkhouse : null, backfill: summary.backfill || [],
      spareboards: input.spareboards, vacancies: input.seen.terminal ? input.vacancies : null, yardJobs: input.yardJobs, fillIns }), lineupRead: !!input.seen.lineup };
}
let lastToronto = null;

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

// The snapshot website. A changed check (any check, on Cloudflare) marks it
// due; it goes out once BOARD_SITE_EVERY minutes have passed since the last
// publish. Settings are re-read each time, so
// adding them to .env doesn't need a restart.
const site = { due: false, lastAt: 0 };
async function publishSite(changed) {
  const settings = siteSettings();
  const { days, every, namesKey } = settings;
  if (settings.r2Missing.length) {
    if (!site.warned) console.log(`  (snapshot website: Cloudflare settings incomplete, ${settings.r2Missing.join(', ')} missing or empty in .env)`);
    site.warned = true;
    return;
  }
  site.warned = false;
  if (!settings.r2 && !(settings.token && settings.siteId)) return;
  // On Cloudflare an upload is free, so every check goes out, changed or not:
  // the page's "Last checked … ago" then stays fresh while the board sits
  // unchanged (owner, 2026-10-22). Netlify charges per deploy: changes only.
  if (changed || settings.r2) site.due = true;
  if (!site.due) return;
  if (Date.now() - site.lastAt < every * 60000) {
    const next = new Date(site.lastAt + every * 60000).toLocaleTimeString('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit' });
    console.log(`[${stamp()}] Snapshot website: next update after ${next} (BOARD_SITE_EVERY=${every}).`);
    return;
  }
  site.lastAt = Date.now();
  try {
    const dir = path.join(OUT_DIR, 'site');
    // On Cloudflare the site also carries the key phones subscribe to turn alerts with.
    const push = settings.r2 ? { publicKey: loadOrCreateKeys(PUSH_KEYS_FILE).publicKey } : null;
    buildSite({ historyDir: HISTORY_DIR, outDir: dir, days, names: { file: NAMES_FILE, key: namesKey }, push, status: checkerStatus() });
    const sent = await publishSiteDir(dir, settings);
    if (sent.ok) site.due = false;
    console.log(sent.ok ? `[${stamp()}] Snapshot website updated (${sent.where}).` : `[${stamp()}] Snapshot website not updated (${sent.where}): ${sent.message}`);
  } catch (err) {
    console.log(`[${stamp()}] Snapshot website not updated: ${err.message}`);
  }
}

// Turn alerts (owner, 2026-10-22): what changed for each turn since the last
// check (lib/board/alerts.js), pushed to the phones that chose that turn on
// the site (subscriptions in the R2 bucket). Only with the site on
// Cloudflare. Never stops a check; a phone that unsubscribed is dropped.
async function sendTurnAlerts(states, lineupRead, now, sightings = []) {
  const settings = siteSettings();
  if (!settings.r2) return;
  const { events, told } = TurnAlerts.turnEvents(TurnAlerts.loadTold(TOLD_FILE), states, { lineupRead });
  // Followed people: their own turn now (owner, 2026-10-25).
  const personTurns = TurnAlerts.updatePersonTurns(TurnAlerts.loadTold(PERSON_TURNS_FILE) || {}, sightings);
  try { TurnAlerts.saveTold(PERSON_TURNS_FILE, personTurns); } catch (err) { console.log(`  (followed people not saved: ${err.message})`); }
  try { TurnAlerts.saveTold(TOLD_FILE, told); } catch (err) { console.log(`  (turn alerts: couldn't save ${err.message})`); }
  try {
    // Every check: a phone's time alerts depend on its own last-told call.
    const subs = await listSubscriptions(settings.r2);
    if (!subs.length) return;
    const bases = TurnAlerts.loadTold(PHONES_FILE) || {};
    const nextBases = {};
    const keys = loadOrCreateKeys(PUSH_KEYS_FILE);
    const sub = (process.env.BOARD_SITE_URL || '').trim() || config.siteUrl;
    let sent = 0;
    let dropped = 0;
    const errors = new Set();
    const said = new Set();
    const log = new Map(); // text → { turn, kind, phones, failed }
    for (const sub0 of subs) {
      const s = TurnAlerts.expandPhone(sub0, personTurns);
      const mine = TurnAlerts.phoneEvents(events, s, states, bases[s.key], { lineupRead, now });
      nextBases[s.key] = mine.base;
      for (const e of mine.events) {
        const r = await sendPush(s, { title: e.turn, body: e.text, tag: `turn-${e.turn}`, url: './#current' }, { keys, sub });
        const l = log.get(e.text) || { turn: e.turn, kind: e.kind, phones: 0, failed: 0 };
        log.set(e.text, l);
        if (r.ok) l.phones++; else l.failed++;
        if (r.ok) { sent++; said.add(e.text); continue; }
        if (r.gone) { await deleteObject(settings.r2, s.key); delete nextBases[s.key]; dropped++; break; }
        errors.add(r.message);
      }
    }
    try { TurnAlerts.saveTold(PHONES_FILE, nextBases); } catch (err) { console.log(`  (turn alerts: couldn't save ${err.message})`); }
    writeAlertsLog(log);
    if (sent || dropped || errors.size) {
      console.log(`[${stamp()}] Turn alerts: ${sent} sent${dropped ? `, ${dropped} unsubscribed phone(s) dropped` : ''}${errors.size ? `, failed: ${[...errors].join('; ')}` : ''}.${said.size ? ` (${[...said].join(' | ')})` : ''}`);
    }
  } catch (err) {
    console.log(`[${stamp()}] Turn alerts not sent: ${err.message}`);
  }
}

// Every alert sent this check, one line each, added to "Board alerts.txt" on
// the Desktop (owner, 2026-10-25): when, turn, kind, how many phones, text.
let logSaid = false;
function writeAlertsLog(log) {
  if (!log.size) return;
  const file = alertsLog();
  const now = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace(',', '');
  const lines = [...log].map(([text, l]) => `${now}  ${l.turn.padEnd(6)}  ${String(l.kind).padEnd(9)}  ${l.phones} phone${l.phones === 1 ? '' : 's'}${l.failed ? `, ${l.failed} failed` : ''}  ${text}`);
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, 'When              Turn    Alert      Sent to   Message\r\n');
    fs.appendFileSync(file, lines.join('\r\n') + '\r\n');
    if (!logSaid) { console.log(`  Turn alerts are logged in ${file}`); logSaid = true; }
  } catch (err) {
    console.log(`  (turn alerts: couldn't write ${file}: ${err.message})`);
  }
}

// The board checker's health for the site (owner, 2026-10-22): when the last
// Microsoft sign-in was, and how often the watchdog restarted it today.
function checkerStatus() {
  const today = new Date().toLocaleDateString('en-CA');
  let restartsToday = 0;
  try {
    restartsToday = fs.readFileSync(path.join(OUT_DIR, 'restarts.log'), 'utf8').split('\n')
      .filter((l) => l.startsWith(today) && /looks stuck|Restarting:/.test(l)).length;
  } catch { /* no restarts yet */ }
  return { lastSignInAt: SignIn.loadState(SIGNIN_FILE).lastAt || null, restartsToday };
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
  await clearMessages(page); // Enter past any messages after signing on
  await toMainMenu(page); // F3 if something's still in the way
}

// When the Microsoft sign-in (about every 24 h) expires mid-session, CATS
// sends the Microsoft login into its inner frame, and Microsoft refuses to
// load there ("login.microsoftonline.com refused to connect"). Load CATS as
// the whole page instead, so the login shows normally. True if it did.
// Reloading CATS isn't enough (owner, 2026-10-19: same block again), so open
// the exact Microsoft address the frame was sent to as the whole page; after
// the sign-in, come back to CATS.
let catsUrl = START_URL;
let lastLoginReload = 0;
let framedLoginUrl = null; // set by watchFramedLogin
let returnToCats = false;

function watchFramedLogin(page) {
  page.on('request', (req) => {
    if (req.frame() !== page.mainFrame() && /^https:\/\/login\.microsoftonline\.com\//.test(req.url())) {
      framedLoginUrl = req.url();
    }
  });
}

async function fixFramedLogin(page) {
  const onLogin = /login\.microsoftonline\.com/.test(page.url());
  // Signed in on the full-page login and sent back: reload CATS proper.
  if (returnToCats && !onLogin && !catsFrame(page)) {
    returnToCats = false;
    console.log(`[${stamp()}] Microsoft sign-in done; opening CATS again.`);
    await goto(page, catsUrl);
    return true;
  }
  const framed = page.frames().some((f) => f !== page.mainFrame()
    && /login\.microsoftonline\.com|^chrome-error:/.test(f.url()));
  if (!framed || onLogin || Date.now() - lastLoginReload < 60000) return false;
  lastLoginReload = Date.now();
  console.log(`\x07[${stamp()}] Microsoft wants you to sign in again. Opening the sign-in page;`
    + ' approve it in Authenticator and the script carries on.');
  returnToCats = !!framedLoginUrl && await goto(page, framedLoginUrl);
  if (!returnToCats) await goto(page, catsUrl); // login wouldn't open: plain reload
  return true;
}

async function goto(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return true;
  } catch (err) {
    console.log(`  (couldn't open ${url.split('?')[0]}: ${err.message.split('\n')[0]})`);
    return false;
  }
}

// --- Microsoft sign-in ----------------------------------------------------------
// The approval is always the owner's, on their phone. The script only shows
// Microsoft's number to match, answers "Stay signed in?", and types the
// Microsoft email/password when MS_EMAIL / MS_PASSWORD are in .env (like
// the CATS password: never printed, the password off after one refusal).
const onMicrosoft = (page) => /^https:\/\/login\.(microsoftonline|live)\.com\//.test(page.url());
const MS_EMAIL = (process.env.MS_EMAIL || '').trim() || null;
const MS_PASSWORD = process.env.MS_PASSWORD || null;
let autoMsPassword = !!MS_PASSWORD;
const ms = { seenAt: null, number: null, emailSent: false, passwordSent: false, kmsiAt: 0 };

// Optional phone alert through ntfy.sh (BOARD_NTFY_TOPIC in .env, a topic
// name only the owner knows), for when they're away from the laptop and
// Microsoft shows a number to match. Never carries anything but that.
async function alertPhone(text) {
  const topic = (process.env.BOARD_NTFY_TOPIC || '').trim();
  if (!topic) return;
  try {
    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST', body: text, headers: { Title: 'Board checker', Priority: 'high' }, signal: AbortSignal.timeout(10000),
    });
    console.log(res.ok ? `[${stamp()}] Phone alert sent (ntfy).` : `  (phone alert not sent: ntfy answered ${res.status})`);
  } catch (err) {
    console.log(`  (phone alert not sent: ${err.message})`);
  }
}

async function microsoftStep(page) {
  if (!onMicrosoft(page)) return;
  if (!ms.seenAt) {
    ms.seenAt = Date.now();
    const since = SignIn.sinceLast(SignIn.loadState(SIGNIN_FILE));
    console.log(`\x07[${stamp()}] Microsoft is asking you to sign in${since ? ` (${since} since the last sign-in)` : ''}. Approve it in Authenticator.`);
    await alertPhone('Microsoft sign-in for the board checker: approve it in Authenticator.');
  }
  // Only boxes really on screen count: CN's email page also carries a password
  // box moved off screen for password managers (owner, 2026-10-22: the
  // password went there and the email was skipped). The ones to fill are
  // marked data-board-fill so the fill can't land in a hidden twin.
  const seen = await page.evaluate(() => {
    const vis = (el) => {
      if (!el || el.getAttribute('aria-hidden') === 'true' || (el.tagName === 'INPUT' && el.tabIndex < 0)) return false;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight
        && st.visibility !== 'hidden' && st.opacity !== '0';
    };
    const q = (sel) => [...document.querySelectorAll(sel)].find(vis) || null;
    const mark = (el, name) => { if (el) el.setAttribute('data-board-fill', name); return !!el; };
    document.querySelectorAll('[data-board-fill]').forEach((el) => el.removeAttribute('data-board-fill'));
    const num = q('#idRichContext_DisplaySign, #displaySign, [data-testid="displaySign"]');
    const email = q('input[name=loginfmt], input[type=email]');
    // Email first: on the email step a password box is never the one to fill.
    const password = email ? null : q('input[type=password]');
    mark(q('#idSIButton9, input[type=submit], button[type=submit]'), 'submit');
    return {
      number: num ? num.textContent.trim() : null,
      password: mark(password, 'password'),
      email: mark(email, 'email'),
      passwordError: !!q('#passwordError, #i0118Error'),
      kmsi: !!q('#KmsiCheckboxField, input[name=DontShowAgain]') || /stay signed in\?/i.test(document.body.innerText),
    };
  }).catch(() => null); // mid-navigation
  if (!seen) return;
  if (seen.number && seen.number !== ms.number) {
    ms.number = seen.number;
    console.log(`\n   >>> Microsoft's number: ${seen.number}  (enter it in Authenticator) <<<\n`);
    await alertPhone(`Microsoft sign-in: enter ${seen.number} in Authenticator.`);
  }
  if (seen.passwordError && autoMsPassword) {
    autoMsPassword = false;
    console.log('\x07Microsoft refused MS_PASSWORD from .env. Type it in the browser; the script won\'t try it again until restarted.');
  }
  if (seen.email && MS_EMAIL && !ms.emailSent) {
    ms.emailSent = true;
    try {
      await page.fill('[data-board-fill=email]', MS_EMAIL, { timeout: 5000 });
      await page.click('[data-board-fill=submit]', { timeout: 5000 });
      console.log(`[${stamp()}] Microsoft email filled from .env.`);
    } catch (err) {
      console.log(`  (couldn't fill the Microsoft email: ${err.message.split('\n')[0]})`);
    }
  }
  if (seen.password && autoMsPassword && !ms.passwordSent) {
    ms.passwordSent = true; // once per sign-in, so a wrong one can't lock the account
    try {
      await page.fill('[data-board-fill=password]', MS_PASSWORD, { timeout: 5000 });
      await page.click('[data-board-fill=submit]', { timeout: 5000 });
      console.log(`[${stamp()}] Microsoft password filled from .env.`);
    } catch (err) {
      console.log(`  (couldn't fill the Microsoft password: ${err.message.split('\n')[0]})`);
    }
  }
  if (seen.kmsi && Date.now() - ms.kmsiAt > 10000) {
    ms.kmsiAt = Date.now();
    try { await page.click('#idSIButton9, input[type=submit][value=Yes], button:has-text("Yes")'); } catch { /* gone already */ }
  }
}

// Back at the CATS main menu after a Microsoft sign-in: note when, so the
// next "Microsoft is asking" can say how long it lasted.
function microsoftDone() {
  if (!ms.seenAt) return;
  const state = SignIn.loadState(SIGNIN_FILE);
  const since = SignIn.sinceLast(state);
  try { SignIn.saveState(SIGNIN_FILE, { ...state, lastAt: Date.now() }); } catch { /* only a note */ }
  console.log(`[${stamp()}] Microsoft sign-in done${since ? ` (the one before was ${since} ago)` : ''}.`);
  Object.assign(ms, { seenAt: null, number: null, emailSent: false, passwordSent: false, kmsiAt: 0 });
}

async function clearSignInCookies(context) {
  try {
    await context.clearCookies({ domain: /(^|\.)(microsoftonline\.com|microsoft\.com|live\.com|cn\.ca)$/ });
  } catch {
    await context.clearCookies(); // older Playwright: no filter; this browser is only for CATS
  }
}

// Signs out of Microsoft (and CATS's Microsoft gateway) in the checker's
// browser and opens CATS again, so Microsoft asks for a full sign-in and its
// ~24 h starts over.
let signingIn = false;
async function freshSignIn(page, why) {
  console.log(`\n[${stamp()}] Fresh Microsoft sign-in: ${why}.`);
  signingIn = true;
  await clearSignInCookies(page.context());
  await goto(page, catsUrl);
  try {
    await waitForMainMenu(page, 'Approve the Microsoft sign-in in Authenticator; the script carries on after that.');
  } finally {
    signingIn = false;
  }
}

// The phone's way of pressing R (lib/board/remote.js): looks at the ntfy
// command topic every minute. Requests during a sign-in are dropped.
function watchPhone() {
  const topic = Remote.commandTopic();
  if (!topic) return null;
  let since = Date.now() / 1000;
  let busy = false;
  let failing = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    const r = await Remote.pollSignIn({ topic, since });
    busy = false;
    since = r.last;
    if (r.error && !failing) console.log(`  (can't read sign-in requests from the phone: ${r.error}; still trying every minute)`);
    if (!r.error && failing) console.log(`[${stamp()}] Reading sign-in requests from the phone again.`);
    failing = !!r.error;
    if (!r.asked || signInAsked || signingIn) return;
    signInAsked = true;
    console.log(`\n[${stamp()}] Your phone asked for a fresh Microsoft sign-in ${wake ? 'now' : 'after this check'}.`);
    alertPhone('Board checker: starting a fresh Microsoft sign-in. Approve it in Authenticator.');
    if (wake) wake();
  }, 60000).unref();
  return topic;
}

// R in this window: a fresh sign-in after the current check. Ctrl+C still stops.
let signInAsked = false;
let wake = null;
function listenForKeys() {
  if (!process.stdin.isTTY) return;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (b) => {
    const k = b.toString();
    if (k === '\u0003') process.exit(130);
    if (k === 'r' || k === 'R') {
      signInAsked = true;
      console.log(`\n[${stamp()}] R: fresh Microsoft sign-in ${wake ? 'now' : 'after this check'}.`);
      if (wake) wake();
    }
  });
}

// The wait between checks; R cuts it short.
function nap(ms) {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(t); wake = null; resolve(); };
    const t = setTimeout(done, ms);
    wake = done;
  });
}

async function waitForMainMenu(page, prompt) {
  heartbeat('signin');
  console.log(prompt);
  let otherSince = null; // when a CATS screen that isn't the menu showed up
  let rounds = 0;
  for (;;) {
    if (await fixFramedLogin(page)) continue;
    await microsoftStep(page);
    const s = await screenState(page);
    if (s && is.mainMenu(s)) { microsoftDone(); return; }
    // Signed in (by hand or not) but stuck on a message: clear it with Enter
    // once it's sat there a few seconds (at most twice per sign-in).
    if (s && s.seq !== null && !is.signOn(s)) {
      otherSince ??= Date.now();
      if (Date.now() - otherSince > 3000 && rounds < 2) {
        rounds++;
        console.log(`[${stamp()}] Clearing CATS messages with Enter…`);
        await clearMessages(page);
        otherSince = null;
        continue;
      }
    } else {
      otherSince = null;
    }
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
  const poolOpts = { s1: optionArg('--s1') ?? config.poolOptions.S1, s3: optionArg('--s3') ?? config.poolOptions.S3 };
  const url = arg('--url') || START_URL; // --url is for testing against a local copy
  catsUrl = url;
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
  const b = browser();
  console.log(`Browser: ${b.name}`);
  const context = await chromium.launchPersistentContext(b.profileDir, { headless: false, ...b.options });
  const page = context.pages()[0] || (await context.newPage());
  watchFramedLogin(page);
  listenForKeys();
  const commands = watchPhone();
  console.log(`Microsoft sign-in: email ${MS_EMAIL ? 'from .env' : 'typed by you'}, password ${MS_PASSWORD ? 'from .env' : 'typed by you'};`
    + ` phone alerts ${(process.env.BOARD_NTFY_TOPIC || '').trim() ? 'on (ntfy)' : 'off (no BOARD_NTFY_TOPIC in .env)'}.`
    + ` Press R for a fresh sign-in${commands ? `, or send "signin" to ntfy topic ${commands} from your phone` : ''}.`);
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
    if (signInAsked) {
      signInAsked = false;
      await freshSignIn(page, 'you pressed R');
    }
    try {
      heartbeat('checking');
      console.log(`\n[${stamp()}] Checking the board…`);
      const names = [];
      const summary = await runRoute(page, { ...poolOpts, names });
      fs.writeFileSync(path.join(OUT_DIR, 'auto-summary.json'), JSON.stringify(summary, null, 2));
      const { text, detailed, first, changed, me: meLines, mine, changes, myAnswerChanged, toronto, callBoard, alertStates, lineupRead, alertNow } = answer(summary, me, nowOverride);
      const torontoChanged = toronto !== lastToronto;
      lastToronto = toronto;
      console.log(`${myAnswerChanged ? '\x07' : ''}\n${text}`);
      const note = first || changed ? await aiReview(detailed) : null;
      try {
        saveSnapshot(summary, { text, detailed, note });
        pruneHistory();
      } catch (err) {
        console.log(`  (snapshot not saved: ${err.message})`);
      }
      try {
        saveNames(NAMES_FILE, recordNames(loadNames(NAMES_FILE), names));
      } catch (err) {
        console.log(`  (crew names not saved: ${err.message})`);
      }
      if (relay) {
        const report = note ? `${text}\n\n${note}` : text;
        const check = { checkedAt: summary.probedAt, me: meLines, mine, report, changes, myAnswerChanged };
        const sent = await pushCheck({ ...relay, check });
        console.log(sent.ok ? `[${stamp()}] Sent to your phone.` : `[${stamp()}] Not sent to your phone: ${sent.message}`);
      }
      await publishSite(first || changed || torontoChanged);
      await sendTurnAlerts(alertStates, lineupRead, alertNow, summary.people || []);
      retried = false;
      // You're on duty on the Sarnia Call Board: sign in fresh now, so the
      // ~24 h covers the trip (owner, 2026-10-22: once working, not before).
      const signInState = SignIn.loadState(SIGNIN_FILE);
      const due = SignIn.dueOnDuty(callBoard, me, signInState);
      if (due) {
        SignIn.saveState(SIGNIN_FILE, { ...signInState, doneFor: due.train });
        await freshSignIn(page, due.why);
      }
    } catch (err) {
      if (err instanceof NeedSignIn) {
        await waitForMainMenu(page, autoSignOn
          ? `\n[${stamp()}] CATS signed you out; signing back in.`
          : '\x07\nCATS signed you out. Sign in again and stop at the main menu.');
        continue;
      }
      if (await fixFramedLogin(page)) {
        await waitForMainMenu(page, 'Waiting for the Microsoft sign-in…');
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
    console.log(`[${stamp()}] Next check in ${every} minutes. Keep this window and the browser open (R = fresh Microsoft sign-in, Ctrl+C to stop).`);
    heartbeat('idle');
    if (!signInAsked) await nap(every * 60000);
  }
  await context.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

// For trying the Microsoft steps against a fake sign-in page.
module.exports = { microsoftStep, microsoftDone, clearSignInCookies };
