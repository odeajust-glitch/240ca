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
// after the current check, so the ~24 h CN sign-in restarts before you leave.
// Your phone is reminded 12 h and 2 h before it runs out (lib/board/signin.js).
// You approve it in Authenticator either way.
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
// .env (Cloudflare, owner 2026-10-22; docs/board-checker/CLOUDFLARE.md), the
// line-up snapshot website (lib/board/site.js) is rebuilt from history\ and
// published after every check (BOARD_SITE_EVERY=N for a gap of N minutes).
const { DATA_DIR, ENV_FILES, HISTORY_DIR, NAMES_FILE, ROAD_DAYS_FILE, TOLD_FILE, PHONES_FILE, PUSH_KEYS_FILE, HEARTBEAT_FILE, browser, alertsLog, FILLINS_FILE, HOLDERS_FILE, PERSON_TURNS_FILE, DAYS_OFF_FILE, CODE_SPLITS_FILE, POSTINGS_FILE, POSTING_ALERTS_FILE, YM_SENIORITY_FILE } = require('../lib/board/paths');
const DaysOff = require('../lib/board/daysoff');
const Holders = require('../lib/board/holders');
const FillIns = require('../lib/board/fillins');
const RoadDays = require('../lib/board/roadday');
const SignIn = require('../lib/board/signin');
const Health = require('../lib/board/health');
const Backup = require('../lib/board/backup');
const Remote = require('../lib/board/remote');
const Stuck = require('../lib/board/signin-stuck');
const CatsAsk = require('../lib/board/cats-ask');
const TurnAlerts = require('../lib/board/alerts');
const ResetAlerts = require('../lib/board/reset-alerts');
// For scripts/board-watchdog.js: what it's doing, so it can tell stuck from busy.
const { beat } = require('../lib/board/watchdog');
const heartbeat = (state) => beat(HEARTBEAT_FILE, state);
const { sendPush, loadOrCreateKeys } = require('../lib/board/webpush');
const { listSubscriptions, listPostingAccounts, deleteObject, retryingFetch } = require('../lib/board/r2');
const { loadNames, recordNames, recordBoardCrew, recordBunkhouse, recordMakeUps, recordYardCrew, recordYardWork, saveNames } = require('../lib/board/names');
require('dotenv').config({ path: ENV_FILES, quiet: true });
const fs = require('fs');
const path = require('path');
const { describeFrame } = require('../lib/board/capture');
const { parseGrid } = require('../lib/board/grid');
const People = require('../lib/board/people');
const Postings = require('../lib/board/postings');
const OwnerNotify = require('../lib/board/owner-notify');
const Trainees = require('../lib/board/trainees');
const S = require('../lib/board/screens');
const Seniority = require('../lib/board/seniority');
const { loadSummary } = require('../lib/board/summary');
const { runBoardCheck } = require('../lib/board/engine');
const { formatReport, describeMe } = require('../lib/board/report');
const { snapshot, changeLines } = require('../lib/board/view');
const { pushCheck, mineForPhone } = require('../lib/board/relay');
const { buildSite, publishSiteDir, siteSettings } = require('../lib/board/site');
const { at, hhmmBefore } = require('../lib/board/time');
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

// The box in the top right of a screen (owner, 2026-10-26: the engineer
// spareboards' time box): of the text boxes in the top third, the one
// furthest right. Typed like a person would; false when there's none.
async function fillTopRight(page, value) {
  return catsFrame(page).evaluate((v) => {
    const boxes = [...document.querySelectorAll('input[type=text]')].map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((b) => b.r.width > 0 && b.r.height > 0);
    if (!boxes.length) return false;
    const bottom = Math.max(...boxes.map((b) => b.r.bottom), window.innerHeight || 0);
    const top = boxes.filter((b) => b.r.top < bottom / 3).sort((a, b) => b.r.left - a.r.left)[0];
    if (!top) return false;
    top.el.value = v;
    return true;
  }, value);
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
    if (await answerAssignment(page, s)) continue;
    if (Stuck.isAssignmentQuestion(s)) throw new OffRoute('CATS is asking "Do you wish to place on another assignment?"');
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

// CATS's "Do you wish to place on another assignment?" (Y/N) at sign-in
// (owner, 2026-11-03), and any other CATS page it can't get past before the
// main menu. BOARD_ASSIGNMENT_ANSWER (lib/board/signin-stuck.js): ask (the
// default) sends the page to the owner's ntfy and types their reply
// (lib/board/cats-ask.js); Y or N types that; off leaves it.
const assignmentMode = () => Stuck.assignmentAnswer(process.env);
// Each page asked about or answered: its words and a picture, on the laptop
// (BoardChecker\assignment-questions\<date>_<time>.txt / .png) and the last
// 20 in assignment-questions.json, shown in the owner's Page Health.
const QUESTIONS_DIR = path.join(OUT_DIR, 'assignment-questions');
const QUESTIONS_FILE = path.join(OUT_DIR, 'assignment-questions.json');
const readQuestions = () => { try { return JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8')); } catch { return []; } };
// The page: its words (with what's in the boxes, where CATS shows some of
// it) and the visible boxes in order.
async function readPage(frame) {
  return frame.evaluate(() => {
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const boxes = [...document.querySelectorAll('input[type=text]')].filter(visible).map((el) => ({ maxLength: el.maxLength, value: el.value }));
    const filled = boxes.map((b) => b.value.trim()).filter(Boolean);
    return { text: `${document.body ? document.body.innerText : ''}${filled.length ? `\n\nIn the boxes: ${filled.join(' | ')}` : ''}`, words: document.body ? document.body.innerText : '', boxes };
  }).catch(() => ({ text: '', words: '', boxes: [] }));
}
function saveQuestion(page, text, answer) {
  const now = new Date();
  const name = `${now.toLocaleDateString('en-CA')}_${now.toLocaleTimeString('en-CA', { hour12: false }).replace(/:/g, '')}`;
  try {
    fs.mkdirSync(QUESTIONS_DIR, { recursive: true });
    fs.writeFileSync(path.join(QUESTIONS_DIR, `${name}.txt`), `${now.toString()}\n${answer}\n\n${text}\n`);
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(Stuck.addQuestion(readQuestions(), { at: now.getTime(), answer, text }), null, 2));
  } catch (err) {
    console.log(`  (the CATS page wasn't saved: ${err.message})`);
  }
  return page.screenshot({ path: path.join(QUESTIONS_DIR, `${name}.png`) }).catch(() => {}).then(() => ({ at: now.getTime(), name }));
}
function noteAnswer(rec, answer) {
  try {
    const list = readQuestions();
    const q = list.find((x) => x.at === rec.at);
    if (q) { q.answer = answer; fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(list, null, 2)); }
    fs.appendFileSync(path.join(QUESTIONS_DIR, `${rec.name}.txt`), `\n${new Date().toString()}\n${answer}\n`);
  } catch { /* only a note */ }
}

// Y or N mode: type it and press Enter. True if it answered.
let assignmentTold = false;
async function answerAssignment(page, s) {
  const ans = assignmentMode();
  if ((ans !== 'Y' && ans !== 'N') || !Stuck.isAssignmentQuestion(s)) return false;
  const frame = catsFrame(page);
  const pg = await readPage(frame);
  const i = Stuck.answerBox(pg.boxes);
  if (i < 0) return false;
  await saveQuestion(page, pg.text, `Answered: ${ans}`);
  await fill(page, { [i]: ans });
  console.log(`[${stamp()}] CATS asked "place on another assignment?": answered ${ans}. The page is saved in ${QUESTIONS_DIR} and Page Health.`);
  if (!assignmentTold) {
    assignmentTold = true;
    alertPhone(`Board checker: CATS asked "Do you wish to place on another assignment?" and it answered ${ans}. What the page said is in Page Health.`);
  }
  try { await press(page, 'Enter'); } catch (err) { if (!(err instanceof OffRoute)) throw err; }
  return true;
}

// Ask mode: the page to the owner's ntfy, with Y / N buttons when it wants a
// yes or no. -> the question waiting for a reply, or null (no ntfy topic).
async function askOwner(page, s) {
  const topic = (process.env.BOARD_NTFY_TOPIC || '').trim();
  const cmd = Remote.commandTopic();
  if (!topic || !cmd || assignmentMode() === null) return null;
  const pg = await readPage(catsFrame(page));
  const waitMin = Stuck.askWait(process.env) / 60000;
  const msg = CatsAsk.questionMessage({ text: pg.words, boxes: pg.boxes, topic: cmd, waitMin, fallback: Stuck.fallbackAnswer(process.env) });
  const rec = await saveQuestion(page, pg.text, 'Sent to your ntfy; waiting for your answer.');
  const headers = { Title: msg.title, Priority: 'urgent', Tags: 'question' };
  if (msg.actions) headers.Actions = msg.actions;
  let ok = false;
  try {
    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: 'POST', body: msg.body, headers, signal: AbortSignal.timeout(10000) });
    ok = res.ok;
    writeAlertsLog(new Map([['CATS is asking you (the page sent to ntfy)', { turn: 'YOU', kind: 'ntfy', phones: ok ? 1 : 0, failed: ok ? 0 : 1, ...(ok ? {} : { errors: ['ntfy did not take it'] }) }]]));
  } catch { /* ok stays false */ }
  if (!ok) { console.log('  (the CATS page couldn\'t be sent to your phone)'); noteAnswer(rec, 'Not sent: ntfy didn\'t answer.'); return null; }
  console.log(`\x07[${stamp()}] CATS is showing a page it can't get past. Sent it to your phone (ntfy): answer there${msg.actions ? ' (Y / N buttons)' : ''}, or deal with it here. Waiting up to ${waitMin} minutes.`);
  return { at: Date.now(), since: Math.floor(Date.now() / 1000) - 1, seq: s.seq, boxes: pg.boxes, yn: CatsAsk.yesNo(pg.words), waitMin, rec, polled: 0 };
}

// The owner's reply, typed in. True when it did something.
async function checkReply(page, q) {
  const replies = await Remote.pollReplies({ topic: Remote.commandTopic(), since: q.since });
  for (const r of replies) {
    q.since = Math.max(q.since, r.time);
    const how = CatsAsk.parseReply(r.text, q.boxes);
    if (!how) {
      console.log(`[${stamp()}] Your reply "${r.text.slice(0, 40)}" didn't make sense for this page; still waiting.`);
      alertPhone(`Board checker: "${r.text.slice(0, 40)}" didn't fit the CATS page. Reply Y, or 2=Y for box 2, or F3.`);
      continue;
    }
    if (Object.keys(how.fills).length) await fill(page, how.fills);
    const did = CatsAsk.replyText(how);
    console.log(`[${stamp()}] Your answer from the phone: ${did}.`);
    noteAnswer(q.rec, `Your answer (ntfy "${r.text.slice(0, 40)}"): ${did}.`);
    try { await press(page, how.key); } catch (err) { if (!(err instanceof OffRoute)) throw err; console.log(`  (${err.message})`); }
    alertPhone(`Board checker: ${did} on the CATS page.`);
    return true;
  }
  return false;
}

// CATS sometimes shows messages right after signing on. Press Enter to clear
// them, as the owner does by hand (2026-10-16): up to 5 times, stopping as
// soon as the main menu shows, so nothing extra gets pressed.
async function clearMessages(page, max = 5) {
  for (let i = 0; i < max; i++) {
    const s = await screenState(page);
    if (!s || is.mainMenu(s) || is.signOn(s)) return s;
    if (await answerAssignment(page, s)) continue;
    if (Stuck.isAssignmentQuestion(s)) return s; // ask mode: the owner answers
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
// Boxes found by the label left of them on the same line (owner's
// assignment history screen has them over three lines): { 'HOME/AWAY': '1' }.
async function fillByLabel(page, values) {
  const frame = catsFrame(page);
  return frame.evaluate((vals) => {
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const boxes = [...document.querySelectorAll('input[type=text]')].filter(visible);
    const texts = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.textContent.trim()) texts.push(n);
    const missing = [];
    for (const [label, v] of Object.entries(vals)) {
      // CATS draws some labels word by word ("START" and "DATE:" apart; owner's
      // laptop, 2026-11-04: "no box for START DATE"): then its last word alone.
      const last = label.split(' ').pop().replace(/:$/, '');
      const node = texts.find((n) => n.textContent.replace(/\s+/g, ' ').includes(label))
        || texts.find((n) => n.textContent.trim().replace(/:$/, '') === last);
      if (!node) { missing.push(label); continue; }
      const range = document.createRange(); range.selectNodeContents(node);
      const lr = range.getBoundingClientRect();
      const box = boxes.filter((b) => { const r = b.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - (lr.top + lr.bottom) / 2) < 12 && r.left >= lr.right - 4; })
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0];
      if (box) box.value = v; else missing.push(label);
    }
    return missing;
  }, values);
}

// The Circular Inquiry's boxes (owner's photos, 2026-11-11), found by where
// they sit, since CATS renames them: the row with DIST / SUB-DIST, then
// LOCAL/REG and ASGN/POOL/SPARE, then PERM/TEMP, CHG CARD/746/OTHER and the
// two SEARCH CLOSE DATES boxes. The four letters get "*"; the dates are not
// typed (CATS puts today's in when Enter is pressed). → '' or what didn't fit.
async function fillCircularInquiry(page, today) {
  return catsFrame(page).evaluate((date) => {
    const boxes = [...document.querySelectorAll('input[type=text]')].map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((b) => b.r.width > 0 && b.r.height > 0).sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
    const rows = [];
    for (const b of boxes) {
      const mid = (b.r.top + b.r.bottom) / 2;
      const row = rows.find((x) => Math.abs(x.mid - mid) < 10);
      if (row) row.list.push(b); else rows.push({ mid, list: [b] });
    }
    for (const x of rows) x.list.sort((a, b) => a.r.left - b.r.left);
    // The date boxes can sit a little lower than PERM/TEMP's line: the same row.
    if (rows.length > 3 && rows[2].list.length === 2 && rows[3].list.length === 2 && rows[3].mid - rows[2].mid < 26 && rows[3].list[0].r.left > rows[2].list[1].r.right) {
      rows[2].list.push(...rows[3].list); rows.splice(3, 1);
    }
    const shape = rows.slice(0, 4).map((x) => x.list.length).join('/');
    if (rows.length < 3 || rows[0].list.length !== 2 || rows[1].list.length !== 2 || rows[2].list.length !== 4) return `boxes by row ${shape}, expected 2/2/4`;
    const set = (b, v) => { b.el.value = v; };
    set(rows[1].list[0], '*'); set(rows[1].list[1], '*');
    set(rows[2].list[0], '*'); set(rows[2].list[1], '*');
    // The close-date boxes are left as they are (owner, 2026-11-11: "the date
    // will auto generate when enter is hit if nothing is there").
    return '';
  }, today);
}

// The Seniority List Inquiry's boxes (owner's photos, 2026-11-13), each found
// right of its label on the same line: LIST CODE's two (3G, YA), DIST (45),
// SUB-DIST (SA). EMP-NBR, NAME, FIRST TV DATE, SERVICE and TEMP ASGN stay
// empty. → the labels with no box found (nothing typed for those).
async function fillSeniorityInquiry(page) {
  return catsFrame(page).evaluate((want) => {
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const boxes = [...document.querySelectorAll('input[type=text]')].filter(visible).map((el) => ({ el, r: el.getBoundingClientRect() }));
    const texts = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.textContent.trim()) texts.push(n);
    const missing = [];
    for (const [label, src, values] of want) {
      const re = new RegExp(src);
      const node = texts.find((n) => re.test(n.textContent.replace(/\s+/g, ' ').trim()));
      if (!node) { missing.push(label); continue; }
      const range = document.createRange(); range.selectNodeContents(node);
      const lr = range.getBoundingClientRect();
      const row = boxes.filter((b) => Math.abs((b.r.top + b.r.bottom) / 2 - (lr.top + lr.bottom) / 2) < 12 && b.r.left >= lr.right - 4).sort((a, b) => a.r.left - b.r.left);
      if (row.length < values.length) { missing.push(label); continue; }
      values.forEach((v, i) => { row[i].el.value = v; });
    }
    return missing;
  }, [['LIST CODE', '(^|\\s)CODE:$', ['3G', 'YA']], ['DIST', '(^|\\s)DIST:$', ['45']], ['SUB-DIST', 'SUB-DIST:$', ['SA']]]);
}

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
let assignReadAt = 0; // the assignment history (3 → 7) is read about once an hour
let yardHistReadAt = 0; // and with YD, for the yard jobs' O-T (tried about once an hour, read or not)
let yardAskedTried = ''; // a yard backfill asked with scripts/assign-backfill.js: tried on the next check, once
let postingsReadAt = 0; // the jobs up for bid (3 → 8, 1 → 8) are read about once an hour
let ymTries = { slot: '', n: 0 }; // the yardmaster seniority list (3 → 1): tries in this half day
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
  const yardCarry = {}; // the yard job a page ended on: its crew can start the next page
  const nameCarry = {}; // the same for a train's crew (owner, 2026-11-13: screens.js carriedOn)
  const trainCarry = {};
  const trainNames = []; // train crews by name: who's working whose job
  const unmaskedRows = async () => {
    try { return parseGrid((await describeFrame(catsFrame(page), { unmasked: true })).nameGrid); } catch { return null; }
  };
  const boardNames = []; // this check's people on boards, under their own turn
  const bunkNames = []; // the bunkhouse, by name: checked against own turns at the end
  const townPages = []; // the crews in town, unmasked, in memory: people on their home turns
  const learn = async () => {
    const rows = await unmaskedRows();
    if (!rows) return;
    boardNames.push(...S.parseBoardNames(rows)); // learned once, at the end
    // Who each turn shows, by name, for the crew names on the board
    // (members only, locked on the site): carried with the Call Board names.
    if (opts.names) {
      try {
        const crew = S.parseBoardCrew(rows);
        (opts.names.board = opts.names.board || []).push(...crew);
        // 501/502 (29) and Garnet (31): their make-up turns are named by their own rows (owner,
        // 2026-11-13: the bunkhouse's MU01 "is not working 502"; names.js recordMakeUps).
        const board = (screens[screens.length - 1] || {}).label;
        if (board === 's5' || board === 'garnet') (opts.names.mu = opts.names.mu || []).push(...crew.map((c) => ({ ...c, board })));
      } catch { /* the board can do without */ }
    }
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
        opts.names.push(...S.parseCallBoardNames(parseGrid(nameGrid), nameCarry));
      } catch { /* the letters can do without; the check can't wait on it */ }
    }
    {
      const rows = await unmaskedRows();
      if (rows) { yardNames.push(...S.parseYardCrewNames(rows, yardCarry)); trainNames.push(...S.parseTrainCrewNames(rows, trainCarry)); }
      if (rows && parsed.crewsInTown) townPages.push(rows);
    }
    const shown = (await screenState(page)).text;
    const m = /PAGE (\d+) OF (\d+)/.exec(shown);
    if (m && +m[1] >= +m[2]) break;
    if (parsed.crewsInTown || /CREWS\s*IN\s*TOWN/.test(shown)) {
      // The crews in town (TODO #10, owner 2026-11-03): page on to the end
      // of the list too (pages 5–29 of 29 in his screenshots), those pages
      // labelled for the loader. A problem
      // here only shortens the list; the check goes on.
      try {
        for (let more = 0; more < 40; more++) {
          const pg = /PAGE (\d+) OF (\d+)/.exec((await screenState(page)).text);
          if (!pg || +pg[1] >= +pg[2]) break;
          expect(await press(page, 'F8'), is.callBoardList, 'next crews in town page');
          await capture('crewsInTown');
          const rows = await unmaskedRows();
          if (rows) townPages.push(rows);
        }
      } catch (err) {
        if (err instanceof NeedSignIn) throw err;
        console.log(`  (crews in town list cut short: ${err.message})`);
      }
      break;
    }
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
      // Crew names on the board: who 28 shows at each position, for the
      // Toronto box (owner, 2026-11-13: MU01 showed someone else's name).
      // Kept apart from the turns' names (names.js recordBunkhouse).
      if (rows && opts.names) { try { (opts.names.bunk = opts.names.bunk || []).push(...S.parseBoardCrew(rows).filter((c) => c.pos)); } catch { /* the board can do without */ } }
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
  // 41 for Garnet (owner, 2026-11-03): when L501 is planned / ordered out of
  // Garnet, i.e. when the 501/502 crew there comes home for the next L502.
  // Station 47956 only (owner, 2026-11-04: "take out W S5 and 24"; with them
  // it never returned a train). CATS keeps the last 41's boxes (Mac yard's
  // W / S1 / 24), so DIR, POOL and hours are cleared, not just left.
  try {
    expect(await chooseFromMenus(page, 41), is.lineup, 'Garnet line-up (41)');
    await fill(page, { 0: '47956', 1: '', 2: '', '-1': '' });
    let g = expect(await press(page, 'Enter'), is.lineup, 'Garnet line-up');
    for (let pageNo = 0; pageNo < 3; pageNo++) {
      await capture('garnetLineup');
      if (/END OF FILE/.test(g.text)) break;
      g = expect(await press(page, 'F8'), is.lineup, 'next Garnet line-up page');
    }
  } catch (err) {
    if (err instanceof NeedSignIn) throw err;
    console.log(`  (skipped Garnet line-up 41: ${err.message})`);
  }

  // Assignment history (3 → 7; owner, 2026-11-04): each train's on duty and
  // hours on duty, so the exact off duty for the reset tracker. S1 = Sarnia,
  // S5 = 502/501; HOME/AWAY 1 = trips coming home (tying up in Toronto is
  // exact from the bunkhouse already). Only those two boxes are typed in;
  // START DATE and the rest are left as CATS has them (owner, 2026-11-04).
  // About once an hour.
  // A one-time backfill asked for with scripts/assign-backfill.js: START DATE
  // typed in too, and paged to the end (owner, 2026-11-04).
  let assignFill = null;
  try { assignFill = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'assign-backfill.json'), 'utf8')); } catch { /* none asked */ }
  if (assignFill || Date.now() - assignReadAt > 55 * 60000) {
    let read = 0;
    for (const loc of ['S1', 'S5']) {
      try {
        let a = await chooseFromMenus(page, 7);
        const missing = await fillByLabel(page, { 'POOL OR YD/LO': loc, 'HOME/AWAY': '1', ...(assignFill ? { 'START DATE': assignFill.start } : {}) });
        if (missing.length) throw new Error(`no box for ${missing.join(', ')}`);
        a = await press(page, 'Enter');
        if (!S.isAssignHistory(a.text)) throw new Error('not the assignment history screen');
        for (let pageNo = 0; pageNo < (assignFill ? 150 : 8); pageNo++) {
          await capture('assignHistory');
          if (assignFill) heartbeat('checking'); // a long backfill isn't "stuck" to the watchdog
          read++;
          const next = await press(page, 'F8').catch(() => null);
          if (!next || !S.isAssignHistory(next.text) || next.text === a.text) break;
          a = next;
        }
      } catch (err) {
        if (err instanceof NeedSignIn) throw err;
        console.log(`  (skipped assignment history ${loc} (3 → 7): ${err.message})`);
      }
    }
    if (read) {
      assignReadAt = Date.now();
      // Say what was read (owner, 2026-11-04: no line meant no way to tell).
      const rows = screens.filter((x) => x.label === 'assignHistory').flatMap((x) => S.parseAssignHistory(parseGrid(x.screenGrid || [])));
      const uniq = new Map(rows.map((r) => [`${r.train}/${r.on}`, r]));
      console.log(`  Assignment history${assignFill ? ` backfill from ${assignFill.start}` : ''} (3 → 7): ${uniq.size} trains read, ${[...uniq.values()].filter((r) => r.off != null).length} with their off duty.`);
      if (assignFill) { try { fs.rmSync(path.join(DATA_DIR, 'assign-backfill.json')); } catch { /* gone */ } }
    }
  }

  // Yard jobs' O-T (owner, 2026-11-13: "We wont need to assume yard off duty
  // times building 3 - 7 YD read, we can also scrap info going back to Oct
  // 26th to get off duty times"). The same screen with YD in POOL OR YD/LO,
  // HOME/AWAY blank (owner's photos, 2026-11-12): each yard job's on duty and
  // its O-T, the overtime on top of 8 hours, filled in when the crew closes
  // the ticket. START DATE three days back, so a ticket closed a day or two
  // late is read again. About once an hour, after the trains: whatever START
  // DATE CATS keeps from here for their next read is only three days back.
  // The first time, a one-time backfill from 26 October paged to the end;
  // BoardChecker\yard-backfill-done.json says it was done. Another start:
  // node scripts/assign-backfill.js 2026-10-26 yard.
  const yardDone = path.join(DATA_DIR, 'yard-backfill-done.json');
  let yardFill = null;
  try { yardFill = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'yard-backfill.json'), 'utf8')); } catch { /* none asked */ }
  const askedNow = !!(yardFill && yardFill.asked && yardFill.asked !== yardAskedTried);
  if (!yardFill && !fs.existsSync(yardDone)) yardFill = { start: '261026' };
  if (askedNow || Date.now() - yardHistReadAt > 55 * 60000) {
    // Tried: the next try is in an hour, read or not (a screen that will not read is not tried every check).
    yardHistReadAt = Date.now();
    if (askedNow) yardAskedTried = yardFill.asked;
    let read = 0;
    let whole = false; // paged to the end without trouble: only then is a backfill done
    try {
      const start = yardFill ? yardFill.start
        : new Date(Date.now() - 3 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }).replace(/-/g, '').slice(2);
      let a = await chooseFromMenus(page, 7);
      const missing = await fillByLabel(page, { 'POOL OR YD/LO': 'YD', 'HOME/AWAY': '', 'START DATE': start });
      if (missing.length) throw new Error(`no box for ${missing.join(', ')}`);
      a = await press(page, 'Enter');
      if (!S.isYardHistory(a.text)) throw new Error('not the yard assignment history (no O-T heading)');
      const had = new Set();
      for (let pageNo = 0; pageNo < (yardFill ? 150 : 10); pageNo++) {
        const rows = S.parseYardHistory(parseGrid(await capture('yardHistory')));
        if (yardFill) heartbeat('checking'); // a long backfill isn't "stuck" to the watchdog
        read++;
        // The last page shown again (with a message on it, say): nothing new, the end.
        if (pageNo > 0 && rows.length && rows.every((r) => had.has(`${r.job}/${r.on}`))) break;
        for (const r of rows) had.add(`${r.job}/${r.on}`);
        const next = await press(page, 'F8').catch(() => null);
        if (!next || !S.isYardHistory(next.text) || next.text === a.text) break;
        a = next;
      }
      whole = true;
    } catch (err) {
      if (err instanceof NeedSignIn) throw err;
      console.log(`  (skipped yard assignment history (3 → 7, YD)${read ? ` after ${read} page(s)` : ''}: ${err.message})`);
    }
    if (read) {
      const rows = screens.filter((x) => x.label === 'yardHistory').flatMap((x) => S.parseYardHistory(parseGrid(x.screenGrid || [])));
      const uniq = new Map(rows.map((r) => [`${r.job}/${r.on}`, r]));
      const days = new Set([...uniq.values()].map((r) => Math.floor(r.on / 1440)));
      console.log(`  Yard assignment history${yardFill ? ` backfill from ${yardFill.start}` : ''} (3 → 7, YD): ${read} page(s), ${uniq.size} yard shifts over ${days.size} day(s), ${[...uniq.values()].filter((r) => r.ot != null).length} with O-T.`);
      if (yardFill && whole && uniq.size) {
        try { fs.writeFileSync(yardDone, JSON.stringify({ start: yardFill.start, at: new Date().toISOString(), pages: read, shifts: uniq.size })); } catch (err) { console.log(`  (yard backfill not marked done: ${err.message})`); }
        try { fs.rmSync(path.join(DATA_DIR, 'yard-backfill.json')); } catch { /* none asked */ }
      }
    }
  }

  // Jobs up for bid (owner, 2026-11-11): the Circular Inquiry, conductors
  // 3 → 8 and engineers 1 → 8, about once an hour. Read unmasked, in memory
  // (the masked copy would lose the job descriptions; there are no names on
  // this screen), and only the parsed lines are kept: BoardChecker\postings.json.
  // Nothing of it goes into the saved check. Trouble with it only skips it.
  if (Date.now() - postingsReadAt > 55 * 60000) {
    const now = new Date();
    const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }).replace(/-/g, '').slice(2);
    let kept = {};
    try { kept = JSON.parse(fs.readFileSync(POSTINGS_FILE, 'utf8')); } catch { /* none yet */ }
    let read = 0;
    for (const [craft, menu, name] of [['co', 3, 'conductors'], ['en', 1, 'engineers']]) {
      try {
        let c = await chooseFromMenus(page, 8, menu);
        if (!S.isCircularInquiry(c.text)) throw new Error('not the Circular Inquiry screen');
        const wrong = await fillCircularInquiry(page, today);
        if (wrong) throw new Error(wrong);
        c = await press(page, 'Enter');
        if (!S.isCircularInquiry(c.text)) throw new Error('not the Circular Inquiry screen after Enter');
        const list = new Map();
        let ended = false;
        let sample = null;
        for (let pageNo = 0; pageNo < 12; pageNo++) {
          const rows = await unmaskedRows();
          for (const j of rows ? S.parseCircularInquiry(rows) : []) list.set(j.number, j);
          // Nothing read off the first page (first real run, 2026-11-11: both
          // crafts came back with no jobs while eight were up): keep what the
          // page looked like, masked (letters and digits only as A and 9, as
          // every saved screen is), and what is in the boxes, so the reader can
          // be fitted to it. Shown to the owner key only on the page.
          if (pageNo === 0 && !list.size) {
            try {
              const masked = (await describeFrame(catsFrame(page))).screenGrid || [];
              const boxes = await catsFrame(page).evaluate(() => [...document.querySelectorAll('input[type=text]')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
                .map((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.top)},${Math.round(r.left)}:${String(el.value || '').replace(/[A-Za-z]/g, 'A').replace(/\d/g, '9')}`; }).slice(0, 40));
              sample = { lines: masked.slice(0, 30), boxes, rows: rows ? rows.length : null };
            } catch { /* the read matters more */ }
          }
          if (/END\s+OF\s+RECORDS/.test(c.text)) { ended = true; break; }
          const next = await press(page, 'F8').catch(() => null);
          if (!next || !S.isCircularInquiry(next.text) || next.text === c.text) break;
          c = next;
        }
        const said = (c.text.match(/(NO\s+RECORDS[^=]{0,60}|INVALID[^=]{0,60}|ERROR[^=]{0,60})/) || [])[0];
        kept[craft] = { read: now.toISOString(), from: today, complete: ended, ...(sample ? { sample } : {}), list: [...list.values()].sort((a, b) => (a.closes < b.closes ? -1 : a.closes > b.closes ? 1 : a.number < b.number ? -1 : 1)) };
        console.log(`  Job postings, ${name} (${menu} → 8): ${list.size} up for bid${ended ? '' : ' (the end of the list was not reached)'}${said ? ` (CATS: ${said.trim()})` : ''}.`);
        read++;
      } catch (err) {
        if (err instanceof NeedSignIn) throw err;
        console.log(`  (skipped job postings, ${name} (${menu} → 8): ${err.message})`);
      }
    }
    // Tried, read or not: not again for an hour (a screen that doesn't fit is logged once an hour, not every check).
    postingsReadAt = Date.now();
    if (read) { try { fs.writeFileSync(POSTINGS_FILE, JSON.stringify({ ...kept, at: now.toISOString() })); } catch (err) { console.log(`  (job postings not saved: ${err.message})`); } }
  }

  // The yardmaster seniority list (owner, 2026-11-13: "lets figure out the YM
  // seniority list first"; "add this into the board check only 2 times a day,
  // once the first check after 0000 and once the first check after 1200").
  // 3 → 1, LIST CODE 3G YA, DIST 45, SUB-DIST SA, Enter, F8 to END OF LIST.
  // It has names, so it is read unmasked, in memory, never captured into the
  // saved check; the parsed list goes only to BoardChecker\yardmaster-seniority.json
  // (lib/board/seniority.js), and only when the end of the list was reached.
  // A failed try is tried again at the next check, three tries a half day.
  {
    const now = new Date();
    let saved = null;
    try { saved = JSON.parse(fs.readFileSync(YM_SENIORITY_FILE, 'utf8')); } catch { /* none yet */ }
    const slot = Seniority.slotOf(now);
    if (ymTries.slot !== slot) ymTries = { slot, n: 0 };
    if (Seniority.due(saved, now, ymTries.n)) {
      ymTries.n++;
      try {
        let s = await chooseFromMenus(page, 1);
        if (!S.isSeniorityList(s.text)) throw new Error('not the Seniority List Inquiry screen');
        const missing = await fillSeniorityInquiry(page);
        if (missing.length) throw new Error(`no box for ${missing.join(', ')}`);
        s = await press(page, 'Enter');
        if (!S.isSeniorityList(s.text)) throw new Error('not the Seniority List Inquiry screen after Enter');
        if (!/YARDMSTRS/.test(s.text)) throw new Error(`not the yardmasters' list (CATS: ${(s.text.match(/(INVALID[^=]{0,60}|ERROR[^=]{0,60}|NO\s+RECORDS[^=]{0,60})/) || ['nothing said'])[0].trim()})`);
        const list = new Map();
        let ended = false;
        let pages = 0;
        for (let pageNo = 0; pageNo < 15; pageNo++) {
          const rows = await unmaskedRows();
          pages++;
          for (const p of rows ? S.parseSeniorityList(rows) : []) list.set(p.rank, p);
          if (/END\s+OF\s+LIST/.test(s.text)) { ended = true; break; }
          const next = await press(page, 'F8').catch(() => null);
          if (!next || !S.isSeniorityList(next.text) || next.text === s.text) break;
          s = next;
        }
        if (ended && list.size) {
          const people = [...list.values()].sort((a, b) => a.rank - b.rank);
          const kept = Seniority.keep(saved, people, { now, pages });
          fs.writeFileSync(YM_SENIORITY_FILE, JSON.stringify(kept));
          ymTries.n = Seniority.MAX_TRIES;
          console.log(`  Yardmaster seniority (3 → 1, 3G YA): ${people.length} people on ${pages} page${pages === 1 ? '' : 's'}${kept.since === kept.at && saved ? ' (changed since the last read)' : ''}.`);
        } else {
          console.log(`  (yardmaster seniority (3 → 1): ${list.size} read on ${pages} page${pages === 1 ? '' : 's'}, the end of the list not reached; not saved, tried again next check)`);
        }
      } catch (err) {
        if (err instanceof NeedSignIn) throw err;
        console.log(`  (skipped yardmaster seniority (3 → 1): ${err.message})`);
      }
    }
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
  // timeBox (owner, 2026-10-26): the spareboards' VIEW TIME box. Option A:
  // the board is read as it opens (what predictions use), then again with
  // the check's time less 10 min in the box (Enter restarts the list):
  // whoever shows only then left the board in those 10 minutes, likely
  // called, and is never predicted for a job. That second read is labelled
  // "<board>-view" and isn't used for names.
  const spareboard = (menu, option, label, name, timeBox = false) => skip(`${name} ${menu} → ${option}`, async () => {
    let sb = await chooseFromMenus(page, option, menu);
    if (sb && !/SPAREBOARD/.test(sb.text)) sb = await press(page, 'Enter'); // a prompt first
    expect(sb, (x) => /SPAREBOARD/.test(x.text), name);
    const readPages = async (as, names, viewTime) => {
      for (let pageNo = 0; pageNo < 15; pageNo++) {
        await capture(as);
        if (viewTime) screens[screens.length - 1].viewTime = viewTime;
        if (names) await learn();
        if (/END\s+OF\s+SPAREBOARD/.test(sb.text)) break;
        const next = await press(page, 'F8');
        if (!next || next.text === sb.text || !/SPAREBOARD/.test(next.text)) break;
        sb = next;
      }
    };
    await readPages(label, true);
    if (!timeBox) return;
    const t = hhmmBefore(new Date(), 10);
    if (!(await fillTopRight(page, t))) { console.log(`  ${name}: no VIEW TIME box found.`); return; }
    sb = expect(await press(page, 'Enter'), (x) => /SPAREBOARD/.test(x.text), `${name} at ${t}`);
    const said = (sb.text.match(/[^\n]*(INVALID|ERROR|NOT VALID)[^\n]*/) || [])[0];
    console.log(`  ${name}: view time ${t} entered${said ? ` (CATS: ${said.trim()})` : ''}.`);
    await readPages(`${label}-view`, false, t);
  });
  await spareboard(3, 13, 'co-fast', 'Conductor fast board', true);
  await spareboard(3, 9, 'co-slow', 'Conductor slow board', true);
  await spareboard(1, 19, 'en-fast', 'Engineer fast board', true);
  await spareboard(1, 17, 'en-slow', 'Engineer slow board', true);
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

  // 4: upcoming days off (owner, 2026-11-05): nothing to type, F8 pages
  // down. Names stay masked; only turn, craft and the start are kept.
  await skip('Upcoming days off 4', async () => {
    expect(await chooseFromMenus(page, 4), (x) => S.isDaysOff(x.text), 'Upcoming days off (4)');
    let last = null;
    for (let pageNo = 0; pageNo < 15; pageNo++) {
      const grid = await capture('daysOff');
      const rows = S.parseDaysOff(parseGrid(grid), Date.now() / 60000).map((x) => `${x.from}/${x.turn}/${x.craft}`).join(',');
      if (!rows || rows === last) break; // an empty page, or F8 went no further
      last = rows;
      const next = await press(page, 'F8').catch(() => null);
      if (!next || !S.isDaysOff(next.text)) break;
    }
  });

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
  // craft: EN/CO where the screen shows it (501/502 is one number, two
  // turns); train: the Call Board train their name is on (owner, 2026-11-03:
  // JUOD bumped back onto S501 CO was shown "on duty on L50131", the train
  // the previous holder was still working).
  const codeSeen = []; // code + turn, in memory: where a split-off code's person is (people.js learnSplit)
  const sight = (code, turn, own, extra = {}) => {
    if (!code || !turn) return;
    codeSeen.push({ code, turn, own: !!own });
    const h = People.personHash(code);
    codeByHash.set(h, code); // memory only: the owner's "who gets alerts"
    const k = `${h}/${turn}`;
    const was = seen.get(k) || {};
    seen.set(k, { h, turn, own: own || was.own || false, ...(extra.craft || was.craft ? { craft: extra.craft || was.craft } : {}), ...(extra.train || was.train ? { train: extra.train || was.train } : {}), ...(extra.duty || was.duty ? { duty: true } : {}) });
  };
  // A name with TV beside it is on another turn for now (owner, 2026-10-26:
  // "it's supposed to ignore it if it has a TV beside the name"): not a sighting.
  // Away from home (term 1, e.g. at Garnet) or out working: still their own
  // turn when they're known to hold it (owner at Garnet, 2026-11-04: seen
  // as "not their own" turn, so his alerts stopped after 30 min).
  for (const b of boardNames) if (!b.tv) sight(b.code, b.turn, !!b.own || (b.from === 'pool' && knownPeople.get(b.key) === b.turn), { craft: b.craft });
  // A trainee (TT / ET) on a crew line rides with that turn: their own
  // trainee slot, S501-TT (owner, 2026-11-04: WADE, a TT on S501).
  for (const t of trainNames) {
    if (/^(TT|ET)$/.test(t.craft)) sight(t.code, `${t.job}-${t.craft}`, true, { train: t.train });
    else sight(t.code, t.job, knownPeople.get(t.key) === t.job, { craft: t.craft, train: t.train });
  }
  // duty: their name is on that yard job's own crew lines now, so they are
  // working it. Being listed on the job in the crews in town (below) says
  // whose job it is, not who is on it today; the two used to look the same
  // (found checking My stats, 2026-11-11). The summary says yardDuty: 1 so the
  // site knows this check tells them apart (lib/board/resets.js collect).
  for (const y of yardNames) sight(y.code, y.job, false, { duty: y.onDuty != null });
  // In the Toronto bunkhouse under a turn (their own or one they're covering).
  for (const b of bunkNames) sight(b.code, b.turn, knownPeople.get(b.key) === b.turn);
  // The crews in town (owner, 2026-11-03: "anything past the crews in town
  // shows people on their actual home turns"; the yard jobs on duty above
  // it may be someone filling in): their own turn or yard job. Trainees
  // (TT/ET) on the turn they're on; a TEMP fill-in isn't on their own;
  // TEMP VCNY = working another job for now, seen there instead (like TV).
  const town = S.parseCrewsInTownNames(townPages);
  for (const n of town) {
    if (n.status === 'tempVacancy') continue;
    // Trainees: their own slot beside the turn (S501-TT), never the holder's
    // (owner, 2026-11-04: WADE showed as S501's conductor).
    if (n.trainee && n.turn) { sight(n.code, `${n.turn}-${n.craft}`, true); continue; }
    sight(n.code, n.turn || n.job, !n.temp, { craft: n.craft });
  }
  if (town.length) console.log(`  Crews in town: ${town.length} people read.`);
  // Whose yard job it is, by name (crew names on the board; laptop only).
  if (opts.names) { try { opts.names.yard = S.parseYardOwners(townPages); } catch { /* the board can do without */ } }
  // Who is on each yard job now, by name (the Call Board's own crew lines).
  if (opts.names) opts.names.yardWork = yardNames.filter((y) => y.name && y.onDuty != null).map(({ job, craft, name, onDuty }) => ({ job, craft, name, onDuty }));
  // Days off seen in earlier checks, kept until each ends (a line can leave
  // option 4's "upcoming" list once it starts): turn, craft, times only.
  const daysOffKnown = DaysOff.load(DAYS_OFF_FILE);
  // Which turns each split-off name code is on, so the checks saved before
  // the split can be told apart by turn (hashes and turns only).
  try {
    const codeSplits = People.loadSplits(CODE_SPLITS_FILE);
    if (People.learnSplit(codeSplits, codeSeen, Date.now() / 60000)) fs.writeFileSync(CODE_SPLITS_FILE, JSON.stringify(codeSplits));
  } catch (err) { console.log(`  (name code splits not saved: ${err.message})`); }
  return { probedAt: new Date().toISOString(), screens, yardCrew: yardCrew.filter((y) => y.turn), backfill, bunkFill, people: [...seen.values()], peopleV: People.PEOPLE_V, yardDuty: 1, ...(daysOffKnown.length ? { daysOffKnown } : {}) };
}

// The full view, plus what changed since the previous check (kept in
// probe-out/last-check.json, so it carries over between runs).
function answer(summary, me, nowOverride) {
  const input = loadSummary(summary, { now: nowOverride });
  // Only after option 4 was read, so a skipped screen keeps what's remembered.
  if (input.seen.daysOff || (input.daysOff || []).length) {
    try { DaysOff.save(DAYS_OFF_FILE, input.daysOff); } catch (err) { console.log(`  (days off not saved: ${err.message})`); }
  }
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
    // 501/502: each craft's row that is home in Sarnia (not at Garnet, not working).
    sharedHome: new Set((input.s5 || []).filter((t) => !t.working && !t.terminal && /^(EN|LE|CO)$/.test(t.craft || '')).map((t) => `${t.turn}-${t.craft === 'CO' ? 'CO' : 'EN'}`)),
  });
  try { FillIns.saveFillIns(FILLINS_FILE, fillIns); } catch (err) { console.log(`  (fill-ins not saved: ${err.message})`); }
  const cur = snapshot(result, result.me ? describeMe(result.me) : []);
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(LAST_FILE, 'utf8')); } catch { /* first check */ }
  const text = formatReport(result, input.seen, { changes: { prev, cur } });
  // The checker window: the same without WHEN YOU GO (owner, 2026-11-03: the site does that).
  const screenText = formatReport(result, input.seen, { changes: { prev, cur }, hideMe: true });
  fs.writeFileSync(LAST_FILE, JSON.stringify(cur, null, 2));
  const myAnswerChanged = !!prev && prev.me.join('\n') !== cur.me.join('\n');
  // The working behind each train, kept with the snapshot.
  const detailed = formatReport(result, input.seen, { details: true });
  const lines = changeLines(prev, cur); // ['', heading, ...one line per change]
  // Toronto (bunkhouse + Mac yard line-up) isn't in the Sarnia report, so it
  // gets its own fingerprint: a change there also updates the website.
  const toronto = JSON.stringify({ b: input.bunkhouse, m: input.macLineup.map((t) => [t.symbol, t.originDay, t.order, t.status]) });
  // The reset alerts re-run the check with a turn on a reset (reset-alerts.js).
  const resetCtx = { input, result, run: (inp) => runBoardCheck({ ...inp, departed: RoadDays.departed(memory, inp.callBoard), seenSince: memory.since, me: null }) };
  return { resetCtx, text, screenText, detailed, first: !prev, changed: lines.length > 2, me: cur.me, mine: mineForPhone(result.me), changes: lines.filter((l) => l), myAnswerChanged, toronto,
    callBoard: input.callBoard, alertNow: input.now, alertStates: TurnAlerts.turnStates(result, input.callBoard, { chainGang: input.chainGangHome, sd: input.sdHome, a: input.aHome, b: input.bHome, s1: input.s1Home, s3: input.s3Home, s5: input.s5,
      predictionInput: { ...input, departed: RoadDays.departed(memory, input.callBoard), seenSince: memory.since },
      garnet: input.garnet, garnetLineup: input.seen.garnetLineup ? input.garnetLineup : null,
      lineup: input.seen.lineup ? input.lineup : null, macLineup: input.seen.macLineup ? input.macLineup : null, bunkhouse: input.seen.bunkhouse ? input.bunkhouse : null, backfill: summary.backfill || [],
      spareboards: input.spareboards, vacancies: input.seen.terminal ? input.vacancies : null, yardJobs: input.yardJobs, crewsInTown: input.seen.crewsInTown ? input.crewsInTown : null, fillIns }), lineupRead: !!input.seen.lineup };
}
let lastToronto = null;

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
// history\<date>\<HHMM>.txt is the report as printed (plus the working
// behind each train), .json the masked CATS screens behind it.
function saveSnapshot(summary, { text, detailed }) {
  const at = new Date(summary.probedAt);
  const day = at.toLocaleDateString('en-CA'); // YYYY-MM-DD, local
  const hhmm = at.toLocaleTimeString('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(':', '');
  const dir = path.join(HISTORY_DIR, day);
  fs.mkdirSync(dir, { recursive: true });
  let base = hhmm;
  for (let n = 2; fs.existsSync(path.join(dir, `${base}.txt`)); n++) base = `${hhmm}-${n}`;
  const parts = [text, `\n--- Working ---\n${detailed}`];
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
  if (!settings.r2) return;
  // An upload is free, so every check goes out, changed or not: the page's
  // "Last checked … ago" then stays fresh while the board sits unchanged
  // (owner, 2026-10-22).
  site.due = true;
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
    buildSite({ historyDir: HISTORY_DIR, outDir: dir, days, names: { file: NAMES_FILE, key: namesKey }, push, splits: CODE_SPLITS_FILE, postings: POSTINGS_FILE, ym: YM_SENIORITY_FILE });
    // The owner's health line: on Cloudflare only, where the Worker keeps it
    // to the owner's email (status/ is never served as a file).
    const healthFile = path.join(dir, 'status', 'health.json');
    if (settings.r2) {
      fs.mkdirSync(path.dirname(healthFile), { recursive: true });
      await refreshSubscriberHealth(settings.r2);
      fs.writeFileSync(healthFile, JSON.stringify(healthNow()));
      // The Notifications tab (owner only, through the Worker's
      // /health/alerts): every alert of the last 30 days with its logic.
      // Only uploaded when it changed (an alert went out).
      const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
      fs.writeFileSync(path.join(dir, 'status', 'alerts.json'), JSON.stringify(Health.alertHistory(read(alertsLog()), read(ALERTS_JSON_LOG), { days: 30 })));
    }
    else fs.rmSync(path.join(dir, 'status'), { recursive: true, force: true });
    const sent = await publishSiteDir(dir, settings);
    if (sent.ok) site.due = false;
    console.log(sent.ok ? `[${stamp()}] Snapshot website updated (${sent.where}).` : `[${stamp()}] Snapshot website not updated (${sent.where}): ${sent.message}`);
  } catch (err) {
    console.log(`[${stamp()}] Snapshot website not updated: ${err.message}`);
  }
}

// "My week" on Sunday (owner, 2026-11-03: "a Sunday alert … only works for
// JUOD first. If it's nice we can push it out"): the first check after 09:00
// on a Sunday sends last week's summary (public/board-week.js) to the phones
// following that person (BOARD_WEEKLY_CODES, default JUOD; comma-separated
// name codes), once per week. From the site just built (BoardChecker\site).
const WEEKLY_FILE = path.join(OUT_DIR, 'weekly.json');
const BoardWeek = require('../public/board-week');
async function sendWeekly() {
  const settings = siteSettings();
  if (!settings.r2) return;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  if (p.weekday !== 'Sun' || +p.hour < 9) return;
  const today = `${p.year}-${p.month}-${p.day}`;
  const week = BoardWeek.weekBefore(today);
  let state = {};
  try { state = JSON.parse(fs.readFileSync(WEEKLY_FILE, 'utf8')); } catch { /* first one */ }
  if (state.week === week.from) return;
  const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'site', 'data', f), 'utf8')); } catch { return {}; } };
  const people = read('people.json').people || {};
  const turnsAll = read('turns.json').turns || {};
  const trains = read('trains.json').trains || [];
  const found = read('analytics.json');
  const codes = String(process.env.BOARD_WEEKLY_CODES || 'JUOD').split(',').map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{3}[A-Z1-9]$/.test(c));
  try {
    const subs = await alertPhones(settings.r2);
    const keys = loadOrCreateKeys(PUSH_KEYS_FILE);
    const sub = (process.env.BOARD_SITE_URL || '').trim() || config.siteUrl;
    const log = new Map();
    let failed = 0;
    for (const code of codes) {
      const h = People.personHash(code);
      const phones = subs.filter((x) => (x.turns || []).includes(`@${h}`));
      if (!phones.length) continue;
      const text = BoardWeek.weekText(BoardWeek.personWeek(h, { people, turns: turnsAll, trains, analytics: found }, week));
      const l = { turn: code, kind: 'weekly', phones: 0, failed: 0 };
      for (const ph of phones) {
        const r = await sendPush(ph, { title: 'My week', body: text, tag: 'week', url: './#week' }, { keys, sub });
        if (r.ok) l.phones++; else { l.failed++; failed++; Health.noteFailure(l, r); }
      }
      log.set(text, l);
      console.log(`[${stamp()}] My week sent for ${code} (${l.phones} phone${l.phones === 1 ? '' : 's'}): ${text}`);
    }
    writeAlertsLog(log);
    // Every phone failed: try again next check (still Sunday).
    if (!failed || [...log.values()].some((l) => l.phones)) fs.writeFileSync(WEEKLY_FILE, JSON.stringify({ week: week.from, at: Date.now() }));
  } catch (err) {
    console.log(`  (My week not sent: ${err.message}; trying again next check)`);
  }
}

// "You were held 14 h+" (owner, 2026-11-06; lib/board/held-alerts.js): to
// phones following the person by name code, once per trip, from the site
// just built. The first run only looks back 2 days.
const HELD_FILE = path.join(OUT_DIR, 'held-alerts.json');
const HeldAlerts = require('../lib/board/held-alerts');
async function sendHeldAlerts() {
  const settings = siteSettings();
  if (!settings.r2) return;
  let state = {};
  try { state = JSON.parse(fs.readFileSync(HELD_FILE, 'utf8')); } catch { /* first run */ }
  const toStamp = (ms) => new Date(ms).toLocaleString('sv-SE', { timeZone: 'America/Toronto' }).slice(0, 16).replace(':', '');
  if (!state.since) state.since = toStamp(Date.now() - 2 * 86400000);
  const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'site', 'data', f), 'utf8')); } catch { return {}; } };
  try {
    const subs = await alertPhones(settings.r2);
    const wants = (s, h) => { const p = (s.prefs || {})[`@${h}`] || {}; return p.held !== false; };
    const followed = new Set(subs.flatMap((s) => (s.turns || []).filter((t) => t.startsWith('@')).map((t) => t.slice(1)).filter((h) => wants(s, h))));
    const { events, told } = HeldAlerts.heldEvents({ trains: read('trains.json').trains || [], people: read('people.json').people || {}, followed, told: state.told || {}, since: state.since });
    if (events.length) {
      const keys = loadOrCreateKeys(PUSH_KEYS_FILE);
      const sub = (process.env.BOARD_SITE_URL || '').trim() || config.siteUrl;
      const log = new Map();
      for (const e of events) {
        const l = { turn: e.turn, kind: 'held', phones: 0, failed: 0, why: `${e.turn} was on ${e.train} (seen on that turn on the board when it went on duty), held 14 h+ by the 18.6(b) tab's count. Sent to phones following that person's name code, once per trip.` };
        for (const ph of subs.filter((s) => (s.turns || []).includes(`@${e.hash}`) && wants(s, e.hash))) {
          const r = await sendPush(ph, { title: 'Held 14 h+', body: e.text, tag: `held-${e.train}`, url: e.url || './#14h' }, { keys, sub });
          if (r.ok) l.phones++; else { l.failed++; Health.noteFailure(l, r); }
        }
        log.set(e.text, l);
        if (!l.phones && l.failed) delete told[e.key]; // try again next check
      }
      writeAlertsLog(log);
      console.log(`[${stamp()}] Held 14 h+ alerts: ${events.map((e) => `${e.turn} (${e.train})`).join(', ')}.`);
    }
    fs.writeFileSync(HELD_FILE, JSON.stringify({ since: state.since, told }));
  } catch (err) {
    console.log(`  (held 14 h+ alerts not sent: ${err.message})`);
  }
}

// The laptop's memory, backed up to the R2 bucket once a day after 03:00
// (lib/board/backup.js; owner, 2026-11-02). Cloudflare only.
const BACKUP_FILE = path.join(OUT_DIR, 'backup.json');
async function backupLaptop() {
  const settings = siteSettings();
  if (!settings.r2) return;
  let state = {};
  try { state = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8')); } catch { /* first one */ }
  const historyDays = process.env.BOARD_HISTORY_DAYS === undefined ? 90 : +process.env.BOARD_HISTORY_DAYS || 0;
  const r = await Backup.runBackup({ dataDir: OUT_DIR, historyDir: HISTORY_DIR, r2: settings.r2, state, historyDays });
  if (r.did.length) console.log(`[${stamp()}] Backed up to Cloudflare: ${r.did.join(', ')}.`);
  if (!r.ok) console.log(`  (backup not finished: ${r.message}; trying again next check)`);
  if (r.state !== state) try { fs.writeFileSync(BACKUP_FILE, JSON.stringify(r.state)); } catch { /* tried again tomorrow */ }
}

// Turn alerts (owner, 2026-10-22): what changed for each turn since the last
// check (lib/board/alerts.js), pushed to the phones that chose that turn on
// the site (subscriptions in the R2 bucket). Only with the site on
// Cloudflare. Never stops a check; a phone that unsubscribed is dropped.
// Reset alerts (owner, 2026-11-03; lib/board/reset-alerts.js): from the
// reset deadlines the site build just worked out (site\data\resets.json),
// only when they're from this check (within 30 min).
const RESET_TOLD_FILE = path.join(DATA_DIR, 'reset-alerts-told.json');
const PENDING_ALERTS_FILE = path.join(DATA_DIR, 'alerts-pending.json');
const TRAINEES_FILE = path.join(DATA_DIR, 'trainees.json');
function resetEventsNow(ctx) {
  try {
    if (!ctx) return [];
    const r = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'site', 'data', 'resets.json'), 'utf8'));
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})$/.exec(r.taken || '');
    const taken = m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : null;
    if (taken == null || Math.abs(ctx.input.now - taken) > 30) return [];
    const { events, told } = ResetAlerts.resetEvents({ ...ctx, resets: r.turns, told: TurnAlerts.loadTold(RESET_TOLD_FILE) || {}, now: ctx.input.now });
    TurnAlerts.saveTold(RESET_TOLD_FILE, told);
    if (events.length) console.log(`  Reset alerts: ${events.map((e) => `${e.about} (${e.level === 'will' ? 'likely reset' : 'could be reset'}, ${e.train}) → ${e.turn}`).join('; ')}.`);
    return events;
  } catch (err) {
    console.log(`  (reset alerts skipped: ${err.message})`);
    return [];
  }
}

async function sendTurnAlerts(states, lineupRead, now, sightings = [], extra = []) {
  const settings = siteSettings();
  if (!settings.r2) return;
  // Followed people: their own turn now (owner, 2026-10-25); a trainee's
  // slot (S501-TT) gets the turn crew's train alerts (owner, 2026-11-04).
  const personTurns = TurnAlerts.updatePersonTurns(TurnAlerts.loadTold(PERSON_TURNS_FILE) || {}, sightings);
  TurnAlerts.addTrainees(states, Object.values(personTurns).map((p) => p.turn));
  const turned = TurnAlerts.turnEvents(TurnAlerts.loadTold(TOLD_FILE), states, { lineupRead, now });
  const { told, held } = turned;
  // Alerts a check couldn't send (owner's laptop, 2026-11-04: "Turn alerts
  // not sent: fetch failed") go with the next check, up to 30 min old:
  // { at, event, phone } (phone: just that phone; none: everyone following).
  const pending = (TurnAlerts.loadTold(PENDING_ALERTS_FILE) || []).filter((p) => Date.now() - p.at < 30 * 60000);
  const nextPending = [];
  const events = [...turned.events, ...extra, ...pending.filter((p) => !p.phone).map((p) => p.event)];
  if (held.length) console.log(`  Holding line-up alerts mid-call: ${held.join(', ')}.`);
  try { TurnAlerts.saveTold(PERSON_TURNS_FILE, personTurns); } catch (err) { console.log(`  (followed people not saved: ${err.message})`); }
  try { TurnAlerts.saveTold(TOLD_FILE, told); } catch (err) { console.log(`  (turn alerts: couldn't save ${err.message})`); }
  try {
    // Every check: a phone's time alerts depend on its own last-told call.
    const subs = await alertPhones(settings.r2, retryingFetch(fetch));
    health.phones = subs.length;
    // Subscriber health is refreshed independently before publishing.
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
      const mine = TurnAlerts.phoneEvents(events, s, states, bases[s.key], { lineupRead, now, held });
      nextBases[s.key] = mine.base;
      const owed = pending.filter((p) => p.phone === s.key);
      for (const { event: e, at } of [...owed, ...mine.events.map((event) => ({ event, at: Date.now() }))]) {
        const r = await sendPush(s, { title: e.turn, body: e.text, tag: `turn-${e.turn}`, url: TurnAlerts.goLink(e, states) }, { keys, sub });
        const l = log.get(e.text) || { turn: e.turn, kind: e.kind, phones: 0, failed: 0, ...(e.why ? { why: e.why } : {}) };
        log.set(e.text, l);
        if (r.ok) l.phones++; else { l.failed++; Health.noteFailure(l, r); }
        if (r.ok) { sent++; said.add(e.text); continue; }
        if (r.gone) { await deleteObject(settings.r2, s.key); delete nextBases[s.key]; dropped++; break; }
        errors.add(r.message);
        nextPending.push({ at, phone: s.key, event: e }); // that phone, next check
      }
    }
    // Job posting alerts (owner, 2026-11-11; lib/board/postings.js): a new
    // posting to every device of an account whose person may post for it, and
    // the reminders the member picked. Each person's last turn and craft and
    // what each account was told are kept on the laptop (hashes and numbers).
    try {
      const read = JSON.parse(fs.readFileSync(POSTINGS_FILE, 'utf8'));
      const memory = TurnAlerts.loadTold(POSTING_ALERTS_FILE) || {};
      const people = Postings.rememberPeople(memory.people, sightings);
      const jobs = [...((read.co && read.co.list) || []), ...((read.en && read.en.list) || [])];
      const accounts = await listPostingAccounts(settings.r2, retryingFetch(fetch));
      const nextTold = {};
      for (const acc of accounts) {
        const mine = Postings.accountEvents(acc, jobs, people, (memory.accounts || {})[acc.id] || null, People.personHash);
        if (!mine.told) continue;
        nextTold[acc.id] = mine.told;
        const devices = subs.filter((x) => x.account === acc.id && nextBases[x.key] !== undefined);
        for (const e of mine.events) {
          let went = false;
          for (const d of devices) {
            const r = await sendPush(d, { title: 'Job posting', body: e.text, tag: `posting-${e.number}`, url: e.url }, { keys, sub });
            const l = log.get(e.text) || { turn: 'JOBS', kind: e.kind, phones: 0, failed: 0 };
            log.set(e.text, l);
            if (r.ok) { l.phones++; sent++; went = true; said.add(e.text); continue; }
            l.failed++;
            Health.noteFailure(l, r);
            if (r.gone) { await deleteObject(settings.r2, d.key); delete nextBases[d.key]; dropped++; } else errors.add(r.message);
          }
          if (went) Postings.sent(mine.told, e); // no device reached: it goes with the next check
        }
      }
      TurnAlerts.saveTold(POSTING_ALERTS_FILE, { people, accounts: nextTold });
    } catch (err) {
      if (err.code !== 'ENOENT') console.log(`  (job posting alerts skipped: ${err.message})`);
    }
    try { TurnAlerts.saveTold(PHONES_FILE, nextBases); } catch (err) { console.log(`  (turn alerts: couldn't save ${err.message})`); }
    writeAlertsLog(log);
    if (sent || dropped || errors.size) {
      console.log(`[${stamp()}] Turn alerts: ${sent} sent${dropped ? `, ${dropped} unsubscribed phone(s) dropped` : ''}${errors.size ? `, failed: ${[...errors].join('; ')}` : ''}.${said.size ? ` (${[...said].join(' | ')})` : ''}`);
    }
  } catch (err) {
    // Couldn't reach Cloudflare at all: everything goes with the next check.
    const firstAt = new Map(pending.map((p) => [p.event, p.at]));
    nextPending.length = 0;
    nextPending.push(...events.map((event) => ({ at: firstAt.get(event) || Date.now(), event })), ...pending.filter((p) => p.phone));
    console.log(`[${stamp()}] Turn alerts not sent: ${err.message}${events.length ? `; ${events.length} kept for the next check` : ''}`);
  } finally {
    try { TurnAlerts.saveTold(PENDING_ALERTS_FILE, nextPending); } catch { /* next time */ }
  }
}

// Every alert sent this check, one line each, added to "Board alerts.txt" on
// the Desktop (owner, 2026-10-25): when, turn, kind, how many phones, text.
// The checker's own ntfy alerts to the owner go in too (turn YOU, kind ntfy).
let logSaid = false;
const ALERTS_JSON_LOG = path.join(OUT_DIR, 'alerts-log.jsonl');
function writeAlertsLog(log) {
  if (!log.size) return;
  const file = alertsLog();
  const now = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace(',', '');
  const lines = [...log].map(([text, l]) => `${now}  ${l.turn.padEnd(6)}  ${String(l.kind).padEnd(9)}  ${l.phones} phone${l.phones === 1 ? '' : 's'}${l.failed ? `, ${l.failed} failed` : ''}  ${text}`);
  // The same with the logic behind each (owner, 2026-11-05: the
  // Notifications tab, "see exactly the notifications being sent, then the
  // logic behind it"): one JSON line each, in BoardChecker.
  try {
    fs.appendFileSync(ALERTS_JSON_LOG, [...log].map(([text, l]) => JSON.stringify({ at: now, turn: l.turn, kind: l.kind, phones: l.phones, failed: l.failed || 0, ...(l.failed ? { gone: l.gone || 0, errors: l.errors || [] } : {}), text, ...(l.why ? { why: l.why } : {}) })).join('\n') + '\n');
  } catch (err) {
    console.log(`  (alerts: couldn't write ${ALERTS_JSON_LOG}: ${err.message})`);
  }
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, 'When              Turn    Alert      Sent to   Message\r\n');
    fs.appendFileSync(file, lines.join('\r\n') + '\r\n');
    if (!logSaid) { console.log(`  Turn alerts are logged in ${file}`); logSaid = true; }
  } catch (err) {
    console.log(`  (turn alerts: couldn't write ${file}: ${err.message})`);
  }
}

// The board checker's health, for the owner only (lib/board/health.js;
// owner, 2026-11-02). Was a public line on the site (2026-10-22).
const health = { lastCheck: null, lastProblem: null, phones: null, subscribers: null, version: null };
// Name codes seen on the boards, by their hash (owner, 2026-11-02: "what name
// codes notifications are getting sent to"). Kept in memory only, never in
// history; it goes no further than the owner-only health line.
const codeByHash = new Map();
const SUBSCRIBER_HEALTH_FILE = path.join(DATA_DIR, 'subscriber-health.json');
// Followed people's name codes, kept over a restart (owner, 2026-11-10). On
// the laptop only, like the cached report beside it; never on the site.
const SUBSCRIBER_CODES_FILE = path.join(DATA_DIR, 'subscriber-codes.json');
let savedCodes = {};
try { savedCodes = JSON.parse(fs.readFileSync(SUBSCRIBER_CODES_FILE, 'utf8')) || {}; for (const [h, code] of Object.entries(savedCodes)) codeByHash.set(h, code); } catch { /* first run */ }
try {
  const saved = JSON.parse(fs.readFileSync(SUBSCRIBER_HEALTH_FILE, 'utf8'));
  if (saved && typeof saved.phones === 'number') {
    health.subscribers = { ...saved, stale: true, error: 'Waiting for a fresh lookup after restart' };
    health.phones = saved.phones;
  }
} catch { /* first run or unreadable cache: show unavailable */ }
// The phones alerts go to: every phone until a week after the lock, then only
// members' (and the owner's own). See Health.membersOnly.
const ownerHash = () => People.personHash(((process.env.BOARD_OWNER_CODE || '').trim() || String(process.env.BOARD_WEEKLY_CODES || 'JUOD').split(',')[0]).trim().toUpperCase());
const alertPhones = async (...args) => Health.membersOnly(await listSubscriptions(...args), Date.now(), ownerHash());
async function refreshSubscriberHealth(r2) {
  const checkedAt = Date.now();
  try {
    const subs = await listSubscriptions(r2, retryingFetch(fetch), { diagnostics: true });
    if (subs.readFailures) throw new Error(`${subs.readFailures} subscription file(s) could not be read`);
    const people = TurnAlerts.loadTold(PERSON_TURNS_FILE) || {};
    const value = { ...Health.subscribersOf(subs, people, codeByHash), confirmedAt: checkedAt, checkedAt, stale: false, error: null };
    health.subscribers = value;
    health.phones = value.phones;
    try { savedCodes = Health.followedCodes(subs, codeByHash, savedCodes); fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(SUBSCRIBER_CODES_FILE, JSON.stringify(savedCodes)); } catch { /* shown as "not seen yet" after the next restart */ }
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(SUBSCRIBER_HEALTH_FILE, JSON.stringify(value)); }
    catch { console.log('Subscriber report could not be cached; current report is still available.'); }
  } catch (err) {
    const message = 'Subscriber lookup failed; check laptop R2 connection and permissions.';
    health.subscribers = { ...(health.subscribers || {}), checkedAt, stale: true, error: message };
    console.log(`[${stamp()}] ${message}`);
  }
}

try { health.version = require('child_process').execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 5000 }).trim(); } catch { /* not a git copy */ }
// The running code in words (owner, 2026-11-10: the short hash said nothing):
// when it's from and what it was, the folder's code now (newer = pulled but
// not restarted), and how many updates GitHub has that the folder doesn't.
const REPO_DIR = path.join(__dirname, '..');
const gitNow = (args) => { try { return require('child_process').execFileSync('git', args, { cwd: REPO_DIR, encoding: 'utf8', timeout: 5000 }).trim(); } catch { return ''; } };
const runningCode = (() => { const [hash, date, ...subject] = gitNow(['log', '-1', '--format=%h%n%cI%n%s']).split('\n'); return hash ? { hash, date: date || null, subject: subject.join(' ').slice(0, 120) } : null; })();
let codeBehind = { behind: null, behindAt: null, behindError: null };
let behindChecked = 0;
// Asks GitHub at most every 30 minutes, in the background; never prompts.
function refreshCodeBehind() {
  if (!runningCode || Date.now() - behindChecked < 30 * 60000) return;
  behindChecked = Date.now();
  const { execFile } = require('child_process');
  const opts = { cwd: REPO_DIR, encoding: 'utf8', timeout: 30000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } };
  const branch = gitNow(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branch || branch === 'HEAD') { codeBehind = Health.behindOf('', 'not on a branch'); return; }
  execFile('git', ['fetch', '--quiet', 'origin', branch], opts, (err) => {
    if (err) { codeBehind = Health.behindOf('', err.killed ? 'GitHub did not answer in time' : (err.stderr || err.message)); return; }
    execFile('git', ['rev-list', '--count', 'HEAD..FETCH_HEAD'], opts, (err2, out) => {
      if (err2) { codeBehind = Health.behindOf('', err2.stderr || err2.message); return; }
      // How many of those change what the laptop runs or publishes (owner, 2026-11-12: Page Health said
      // "git pull, then restart" for notes). If git won't say, the page falls back to the plain count.
      execFile('git', ['rev-list', '--count', 'HEAD..FETCH_HEAD', '--', ...Health.CODE_PATHS], opts, (err3, outCode) => { codeBehind = Health.behindOf(out, null, Date.now(), err3 ? undefined : outCode); });
    });
  });
}
function healthNow() {
  try { refreshCodeBehind(); } catch { /* the check matters more */ }
  const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
  const today = new Date().toLocaleDateString('en-CA');
  const todayToronto = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const nowToronto = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace(',', '');
  return Health.healthOf({
    ...health,
    code: runningCode ? { ...runningCode, folder: gitNow(['rev-parse', '--short', 'HEAD']) || runningCode.hash, ...codeBehind } : null,
    signIn: SignIn.loadState(SIGNIN_FILE),
    signInHours: SignIn.signInHours(),
    restarts: Health.restartsToday(read(path.join(OUT_DIR, 'restarts.log')), today),
    // What became of the day's failed sends rides along (owner, 2026-11-12: one failed send kept Page Health red all day).
    alerts: { ...Health.alertsToday(read(alertsLog()), todayToronto), ...Health.alertFailures(read(ALERTS_JSON_LOG), todayToronto, nowToronto) },
    sent: Health.recentAlerts(read(alertsLog())),
    backup: (() => { try { return JSON.parse(read(path.join(OUT_DIR, 'backup.json'))).lastAt || null; } catch { return null; } })(),
    questions: readQuestions().slice(0, 5),
  });
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

// The owner's own phone messages (sign-ins, CATS pages, stuck): ntfy.sh
// (BOARD_NTFY_TOPIC in .env, a topic name only the owner knows), and
// Pushover if set up (BOARD_PUSHOVER_TOKEN + BOARD_PUSHOVER_USER). Each is
// tried again for ~2 min when the connection drops (owner, 2026-11-04: "when
// I force a re auth I dont always get the number"), in the background so a
// sign-in isn't held up. urgent (the Microsoft number): the site's own phone
// alerts to the phones following the owner's name code too.
function alertPhone(text, { urgent = false, signinButton = false } = {}) {
  const topic = (process.env.BOARD_NTFY_TOPIC || '').trim();
  const pushover = { token: (process.env.BOARD_PUSHOVER_TOKEN || '').trim(), user: (process.env.BOARD_PUSHOVER_USER || '').trim() };
  const routes = [];
  // signinButton: a "Sign in now" button / link (owner, 2026-11-04).
  const signin = signinButton ? Remote.commandTopic() : null;
  if (topic) routes.push(['ntfy', () => OwnerNotify.sendNtfy(text, topic, { signin })]);
  if (pushover.token && pushover.user) routes.push(['Pushover', () => OwnerNotify.sendPushover(text, pushover, { signin })]);
  if (urgent) routes.push(['site alert', () => pushOwner(text)]);
  // → a promise for all of them; callers don't wait (except before an exit).
  return Promise.all(routes.map(([name, fn]) => OwnerNotify.withRetry(fn).then((r) => {
      console.log(r.ok ? `[${stamp()}] Phone alert sent (${name}${r.tries > 1 ? `, after ${r.tries} tries` : ''}).` : `  (phone alert not sent by ${name}: ${r.message})`);
      // One line per route in Page Health's alert log, so the Pushover trial
      // can be judged against ntfy (owner, 2026-11-04: "see if its more
      // workable"): which got through, and after how many tries.
      const kind = { ntfy: 'ntfy', Pushover: 'pushover', 'site alert': 'ownerPush' }[name];
      writeAlertsLog(new Map([[`${text}${r.tries > 1 ? ` (${r.ok ? `after ${r.tries} tries` : r.message})` : r.ok ? '' : ` (${r.message})`}`, { turn: 'YOU', kind, phones: r.ok ? (r.phones || 1) : 0, failed: r.ok ? 0 : 1, ...(r.ok ? {} : { errors: [String(r.message || 'not sent').split('\n')[0].slice(0, 100)] }) }]]));
  }).catch(() => {})));
}

// The site's phone alerts to the owner's own phones (following their name
// code: BOARD_OWNER_CODE, else the first of BOARD_WEEKLY_CODES, else JUOD).
async function pushOwner(text) {
  const settings = siteSettings();
  if (!settings.r2) return { ok: false, message: 'Cloudflare not set up', final: true };
  const code = ((process.env.BOARD_OWNER_CODE || '').trim() || String(process.env.BOARD_WEEKLY_CODES || 'JUOD').split(',')[0]).trim().toUpperCase();
  const h = People.personHash(code);
  const phones = (await listSubscriptions(settings.r2)).filter((x) => (x.turns || []).includes(`@${h}`));
  if (!phones.length) return { ok: false, message: `no phone follows ${code}`, final: true };
  const keys = loadOrCreateKeys(PUSH_KEYS_FILE);
  const sub = (process.env.BOARD_SITE_URL || '').trim() || config.siteUrl;
  let ok = 0;
  for (const ph of phones) if ((await sendPush(ph, { title: 'Board checker', body: text, tag: 'signin', url: './#current' }, { keys, sub })).ok) ok++;
  return ok ? { ok: true, phones: ok } : { ok: false, message: 'no phone took it' };
}

async function microsoftStep(page) {
  if (!onMicrosoft(page)) return;
  if (!ms.seenAt) {
    ms.seenAt = Date.now();
    const since = SignIn.sinceLast(SignIn.loadState(SIGNIN_FILE));
    console.log(`\x07[${stamp()}] Microsoft is asking you to sign in${since ? ` (${since} since the last sign-in)` : ''}. Approve it in Authenticator.`);
    alertPhone('Microsoft sign-in for the board checker: approve it in Authenticator.', { urgent: true });
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
    // The number to match: the usual box, the "approve sign-in" (phone
    // sign-in) box, or any DisplaySign box Microsoft uses (owner, 2026-11-04:
    // the number didn't always come through).
    const num = q('#idRichContext_DisplaySign, #idRemoteNGC_DisplaySign, #displaySign, [data-testid="displaySign"], [id$="DisplaySign"], .displaySign')
      || [...document.querySelectorAll('div, span')].find((el) => vis(el) && el.children.length === 0 && /^\d{2,3}$/.test(el.textContent.trim())
        && /enter the number|number shown|match the number/i.test(document.body.innerText)) || null;
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
    alertPhone(`Microsoft sign-in: enter ${seen.number} in Authenticator.`, { urgent: true });
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
    // Quiet about short blips (owner, 2026-11-04: the laptop's connection to
    // ntfy drops for a minute now and then): only after 10 min of failing,
    // and "again" only after that warning.
    if (r.error) {
      if (!failing) failing = { since: Date.now(), said: false };
      if (!failing.said && Date.now() - failing.since >= 10 * 60000) {
        failing.said = true;
        console.log(`  (can't read sign-in requests from the phone for 10 min: ${r.error}; still trying every minute)`);
      }
    } else {
      if (failing && failing.said) console.log(`[${stamp()}] Reading sign-in requests from the phone again.`);
      failing = false;
    }
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

// What it was stuck on before the main menu, kept on the laptop only: a
// CATS screen masked (stuck-screen.json), any other page as its address,
// title and a picture (signin-stuck.json / .png), so the route can be
// taught about it (owner, 2026-11-03).
async function saveSignInStuck(page, kind) {
  if (kind === 'cats') return saveStuckScreen(page);
  try {
    const u = new URL(page.url());
    const file = path.join(OUT_DIR, 'signin-stuck.json');
    fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), address: `${u.origin}${u.pathname}`, title: await page.title().catch(() => '') }, null, 2));
    await page.screenshot({ path: path.join(OUT_DIR, 'signin-stuck.png') }).catch(() => {});
    console.log(`  Saved what it was stuck on: ${path.relative(process.cwd(), file)} and signin-stuck.png`);
  } catch { /* mid-navigation; nothing to save */ }
}

async function waitForMainMenu(page, prompt, state = 'signin') {
  heartbeat(state);
  console.log(prompt);
  // Stuck before the main menu (lib/board/signin-stuck.js): Enter, F3,
  // reload CATS, then a fresh Edge. Never while Microsoft or the CATS
  // sign-on is waiting on a person.
  const t = { stuckFor: 0, enter: 0, keys: 0, reloads: 0, restarted: false, answered: 0, asks: 0, awaiting: false, canAsk: false };
  let q = null; // a page sent to the owner's ntfy, waiting for their reply
  let stuckSince = null;
  let told = false;
  for (;;) {
    if (await fixFramedLogin(page)) continue;
    await microsoftStep(page);
    const s = await screenState(page);
    const kind = Stuck.kindOf({ s, onMicrosoft: onMicrosoft(page), isMenu: !!s && is.mainMenu(s), isSignOn: !!s && is.signOn(s) });
    if (kind === 'menu') { microsoftDone(); return; }
    // A page sent to the owner: their reply typed in (looked for every 10 s);
    // given up when the page changes (answered by hand) or after 30 min.
    if (q) {
      if (kind !== 'cats' || s.seq !== q.seq) {
        q = null;
      } else if (Date.now() - q.at > q.waitMin * 60000) {
        // No answer (phone off at work?): force through. A yes-or-no page
        // gets the fallback answer; any other page the reload steps.
        const fb = Stuck.fallbackAnswer(process.env);
        const i = q.yn && fb ? Stuck.answerBox(q.boxes) : -1;
        const asked = q;
        q = null;
        stuckSince = Date.now();
        if (i >= 0) {
          await fill(page, { [i]: fb });
          const did = `No answer from your phone in ${asked.waitMin} minutes: typed ${fb} itself, then pressed Enter`;
          console.log(`[${stamp()}] ${did}.`);
          noteAnswer(asked.rec, `${did}.`);
          alertPhone(`Board checker: ${did} on the CATS page.`);
          try { await press(page, 'Enter'); } catch (err) { if (!(err instanceof OffRoute)) throw err; }
          t.asks = Stuck.MAX.asks; // forced through: don't ask about it again in this wait
          continue;
        }
        console.log(`[${stamp()}] No answer from your phone in ${asked.waitMin} minutes; forcing past it (Enter, F3, reload CATS).`);
        noteAnswer(asked.rec, `No answer in ${asked.waitMin} minutes: reloading CATS.`);
        alertPhone(`Board checker: no answer in ${asked.waitMin} minutes; it's reloading CATS to get past the page.`);
        Object.assign(t, { enter: 0, keys: 0, asks: Stuck.MAX.asks });
      } else if (Date.now() - q.polled > 10000) {
        q.polled = Date.now();
        if (await checkReply(page, q)) { q = null; continue; }
      }
    }
    t.awaiting = !!q;
    t.canAsk = !!(process.env.BOARD_NTFY_TOPIC || '').trim() && assignmentMode() !== null;
    // CATS's "another assignment?" question: Y or N straight away (twice at
    // most per wait), or (ask) sent to the owner straight away.
    if (kind === 'cats' && t.answered < 2 && await answerAssignment(page, s)) { t.answered++; continue; }
    if (kind === 'cats' && !q && assignmentMode() === 'ASK' && t.asks < Stuck.MAX.asks && Stuck.isAssignmentQuestion(s)) {
      t.asks++;
      q = await askOwner(page, s);
      if (q) { heartbeat('signin'); continue; } // the watchdog gives a sign-in 45 min
    }
    if (Stuck.waiting(kind)) stuckSince = null;
    else stuckSince ??= Date.now();
    t.stuckFor = stuckSince ? Date.now() - stuckSince : 0;
    const step = Stuck.nextStep(kind, t);
    if (step === 'enter') {
      t.enter++;
      console.log(`[${stamp()}] Clearing CATS messages with Enter…`);
      await clearMessages(page);
      continue;
    }
    if (step === 'ask') {
      t.asks++;
      q = await askOwner(page, s);
      if (q) heartbeat('signin');
      continue;
    }
    if (step === 'keys') {
      t.keys++;
      console.log(`[${stamp()}] Still not at the CATS main menu: trying F3…`);
      try {
        await press(page, 'F3');
      } catch (err) {
        if (/^No F3 key/.test(err.message)) await press(page, 'Enter').catch(() => {});
      }
      continue;
    }
    if (step === 'reload' || step === 'restart') {
      const what = Stuck.describe(kind, await page.title().catch(() => ''));
      health.lastProblem = { at: Date.now(), text: `Stuck before the CATS main menu on ${what}` };
      await saveSignInStuck(page, kind);
      if (!told) {
        told = true;
        alertPhone(`Board checker stuck before the CATS main menu on ${what}; it's reloading CATS.`);
      }
      if (step === 'reload') {
        t.reloads++;
        console.log(`[${stamp()}] Stuck for 5 minutes on ${what}: reloading CATS (${t.reloads} of ${Stuck.MAX.reloads})…`);
        await goto(page, catsUrl);
        Object.assign(t, { enter: 0, keys: 0 });
        stuckSince = null;
        continue;
      }
      t.restarted = true;
      if (process.env.BOARD_WATCHDOG) {
        console.log(`[${stamp()}] Still stuck on ${what} after reloading CATS: closing Edge so the watchdog starts it fresh.`);
        await Promise.race([alertPhone(`Board checker still stuck on ${what}: starting Edge fresh.`), sleep(20000)]);
        await Promise.race([page.context().close().catch(() => {}), sleep(15000)]);
        process.exit(3);
      }
      console.log(`\x07[${stamp()}] Still stuck on ${what}. Get it to the CATS main menu by hand, or close Edge and start the checker again.`);
      continue;
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
  // 'unstick': the watchdog closes Edge and starts over if this hangs.
  await waitForMainMenu(page, autoSignOn
    ? 'Signing back in. If Microsoft asks, sign in there (Authenticator) and the script does the rest.'
    : '\x07Sign in to CATS again and stop at the main menu.', 'unstick');
}

async function main() {
  // Turns are matched exactly; "sr03" means SR03 (owner, 2026-10-26).
  const me = (arg('--me') || '').trim().toUpperCase();
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
    + ` phone alerts ${(process.env.BOARD_NTFY_TOPIC || '').trim() ? 'on (ntfy' : 'off (no BOARD_NTFY_TOPIC in .env'}${(process.env.BOARD_PUSHOVER_TOKEN || '').trim() && (process.env.BOARD_PUSHOVER_USER || '').trim() ? ' + Pushover' : ''}).`
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
      health.lastCheck = Date.now();
      fs.writeFileSync(path.join(OUT_DIR, 'auto-summary.json'), JSON.stringify(summary, null, 2));
      const { resetCtx, text, screenText, detailed, first, changed, me: meLines, mine, changes, myAnswerChanged, toronto, callBoard, alertStates, lineupRead, alertNow } = answer(summary, me, nowOverride);
      // Trainees stay on their slot while their turn is away (owner,
      // 2026-11-04; lib/board/trainees.js), before the check is saved.
      try {
        const kept = Trainees.keepTrainees(TurnAlerts.loadTold(TRAINEES_FILE) || {}, summary.people || [], resetCtx.input);
        if (kept.add.length) summary.people = [...(summary.people || []), ...kept.add];
        TurnAlerts.saveTold(TRAINEES_FILE, kept.memory);
      } catch (err) { console.log(`  (trainees not kept: ${err.message})`); }
      const torontoChanged = toronto !== lastToronto;
      lastToronto = toronto;
      console.log(`\n${screenText}`);
      try {
        saveSnapshot(summary, { text, detailed });
        pruneHistory();
      } catch (err) {
        console.log(`  (snapshot not saved: ${err.message})`);
      }
      try {
        const store = recordBunkhouse(recordYardWork(recordYardCrew(recordBoardCrew(recordNames(loadNames(NAMES_FILE), names), names.board || []), names.yard || []), names.yardWork || []), names.bunk, summary.probedAt);
        saveNames(NAMES_FILE, recordMakeUps(store, { boards: names.mu, trains: names }, summary.probedAt));
      } catch (err) {
        console.log(`  (crew names not saved: ${err.message})`);
      }
      if (relay) {
        const check = { checkedAt: summary.probedAt, me: meLines, mine, report: text, changes, myAnswerChanged };
        const sent = await pushCheck({ ...relay, check });
        console.log(sent.ok ? `[${stamp()}] Sent to your phone.` : `[${stamp()}] Not sent to your phone: ${sent.message}`);
      }
      // The website goes up in the background (owner, 2026-11-03: "the
      // checker is taking too long … its getting stuck here"): a slow upload
      // no longer holds up the next check. One at a time; a check that
      // finds one still going leaves it be (the next one sends the newest).
      if (!site.busy) {
        site.busy = publishSite(first || changed || torontoChanged)
          .catch((err) => console.log(`[${stamp()}] Snapshot website not updated: ${err.message}`))
          .finally(() => { site.busy = null; });
      } else console.log(`  (snapshot website: the last upload is still going; this check goes with the next one)`);
      await sendTurnAlerts(alertStates, lineupRead, alertNow, summary.people || [], resetEventsNow(resetCtx));
      await backupLaptop();
      await sendWeekly();
      await sendHeldAlerts();
      retried = false;
      // The Microsoft sign-in runs out in 12 h, then 2 h: remind the phone
      // (owner, 2026-11-02; no automatic fresh sign-in any more).
      const signInState = SignIn.loadState(SIGNIN_FILE);
      const remind = SignIn.reminderDue(signInState);
      if (remind) {
        console.log(`[${stamp()}] ${remind.text}`);
        alertPhone(remind.text, { signinButton: true });
        try { SignIn.saveState(SIGNIN_FILE, { ...signInState, remindedFor: signInState.lastAt, reminded: remind.reminded }); } catch { /* reminded again next check */ }
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
      health.lastProblem = { at: Date.now(), text: err.message };
      await saveStuckScreen(page);
      if (!every) throw err;
      // Failed again right after reloading CATS: under the watchdog, close
      // Edge and start over (owner, 2026-10-31: closing Edge and running it
      // again always fixed it). Code 3 tells the watchdog it's on purpose.
      if (retried && process.env.BOARD_WATCHDOG) {
        console.log(`[${stamp()}] Still stuck after reloading CATS: closing Edge so the watchdog starts it fresh.`);
        await Promise.race([context.close().catch(() => {}), sleep(15000)]);
        process.exit(3);
      }
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
module.exports = { microsoftStep, microsoftDone, clearSignInCookies, waitForMainMenu };
