// Crew names for the Article 18.6(b) grievance letters (owner, 2026-10-21).
//
// Everything else the board checker saves is masked. Names come only from a
// second, unmasked read of each Call Board page that board-auto.js keeps in
// memory; what's taken from it is a train + turn → name list in
// BoardChecker\names.json on the laptop. Nothing here goes into history\,
// the AI review, the relay to the phone or the site's open data.
//
// The site gets only the names of crews on its 14-hour list, locked with
// BOARD_NAMES_KEY (AES-256-GCM, key from PBKDF2-SHA256) as data/names.json;
// public/board-names.js unlocks it in the rep's browser. No key, no file.
const fs = require('fs');
const crypto = require('crypto');
const { PLACEHOLDER } = require('../../public/board-turns');

const KEEP_DAYS = 45;
const ITERATIONS = 250000;

const key = (train, turn) => `${train}|${turn}`;

function loadNames(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

// trains: parseCallBoardNames output. Adds or refreshes each crew member's
// name and drops entries not seen for KEEP_DAYS.
function recordNames(store, trains, now = new Date()) {
  const seen = now.toISOString();
  for (const t of trains) {
    for (const c of t.crew) {
      const k = key(`${t.symbol} ${t.originDay}`, c.turn);
      // crafts: who held it in each craft on this read. A 501/502 turn has a
      // conductor and an engineer under one number (crew names on the
      // board, 2026-11-10); `name` stays the last one read, as before.
      const prev = store[k] && store[k].seen === seen ? store[k].crafts : null;
      store[k] = { name: c.name, seen, crafts: { ...(prev || {}), [c.craft]: c.name } };
    }
  }
  const cutoff = now.getTime() - KEEP_DAYS * 86400000;
  for (const [k, v] of Object.entries(store)) if (!(Date.parse(v.seen) >= cutoff)) delete store[k];
  return store;
}

// Who each pool and spareboard screen shows on a turn right now
// (screens.js parseBoardCrew), kept beside the Call Board names under
// "@board|<turn>". Only the crew names on the board use these (namesByTurn);
// the 18.6(b) names (byTurn, namesForHeld) leave them alone.
function recordBoardCrew(store, crew, now = new Date()) {
  const seen = now.toISOString();
  for (const c of crew) {
    if (!c || !c.turn || !c.name) continue;
    const k = `@board|${c.turn}`;
    const prev = store[k] && store[k].seen === seen ? store[k].crafts : null;
    const craft = /^(CO|EN|LE)$/.test(c.craft) ? c.craft : '';
    store[k] = { name: c.name, seen, working: !!c.working, crafts: { ...(prev || {}), ...(craft ? { [craft]: c.name } : {}) } };
  }
  return store;
}

// Who the Toronto bunkhouse (option 28) shows at each position, by name
// (owner, 2026-11-13, with his photo of 28 beside the site: "This is showing
// the wrong crew on the train"; the Toronto line-up had MU01 under someone
// else's name). A make-up turn (MU01) is a placeholder: whoever had the
// number last on the Call Board or a Sarnia board is not who is in the
// bunkhouse, and a spare covering a turn shows there under that turn. So the
// bunkhouse keeps its own list, apart from the turns: "@bunk" → { seen, crew:
// [[pos, craft, turn, name], …] }, replaced by each check that read it.
// crew: screens.js parseBoardCrew rows off 28; not an array = 28 wasn't read
// this check, and the last list stays. checkAt: the check's own time
// (summary.probedAt), so the site can tell which check the names are from.
function recordBunkhouse(store, crew, checkAt = new Date()) {
  if (!Array.isArray(crew)) return store;
  const rows = crew.filter((c) => c && c.pos && c.turn && c.name && /^(EN|LE|CO)$/.test(c.craft));
  store['@bunk'] = { seen: new Date(checkAt).toISOString(), crew: rows.map((c) => [c.pos, c.craft, c.turn, c.name]) };
  return store;
}
// The page's Toronto box: [[pos, "EN" | "CO", turn, "Last, F"], …] when the
// bunkhouse names were read in the check taken at checkAt (the newest check
// the site is built from, its summary.probedAt), else nothing: an older read
// could name a crew that has since gone home, or put a make-up turn's new
// holder's name on the one before.
function bunkhouseNames(store, checkAt) {
  const b = store['@bunk'];
  if (!b || !Array.isArray(b.crew) || !checkAt || Date.parse(b.seen) !== Date.parse(checkAt)) return [];
  return b.crew.map(([pos, craft, turn, name]) => [pos, craft === 'CO' ? 'CO' : 'EN', turn, shortName(name)]);
}

// Make-up turns (MU01), each named by the row it is on (owner, 2026-11-13, the 501/502 board's MU01
// "out working on L50231" under the name of the MU01 who was in the Toronto bunkhouse: "⟨him⟩ is not
// working 502"). A make-up turn is a placeholder: the same number can be several people at once (a
// train on the Call Board, the 501/502 and Garnet boards, the bunkhouse), so namesByTurn never names
// one, and each row takes its own screen's name, this check only: "@mu" → { seen: the check's
// probedAt, boards: [[board, craft, turn, name]], trains: [[train, craft, turn, name]] }.
// boards: parseBoardCrew rows off 29 / 31, each with board ('s5' / 'garnet'); trains:
// parseCallBoardNames output. Called every check: a screen not read by name gives nothing.
function recordMakeUps(store, { boards, trains } = {}, checkAt = new Date()) {
  const mu = (turn) => PLACEHOLDER.test(turn || '');
  store['@mu'] = {
    seen: new Date(checkAt).toISOString(),
    boards: (boards || []).filter((c) => c && c.board && c.craft && c.name && mu(c.turn)).map((c) => [c.board, c.craft, c.turn, c.name]),
    trains: (trains || []).flatMap((t) => (t.crew || []).filter((c) => c.craft && c.name && mu(c.turn)).map((c) => [`${t.symbol} ${t.originDay}`, c.craft, c.turn, c.name])),
  };
  return store;
}
// The page's make-up turn names, "Last, F": { boards, trains } as read in the check taken at checkAt
// (the newest check the site is built from, its summary.probedAt), else null.
function makeUpNames(store, checkAt) {
  const m = store['@mu'];
  if (!m || !checkAt || Date.parse(m.seen) !== Date.parse(checkAt)) return null;
  const short = (rows) => (rows || []).map(([where, craft, turn, name]) => [where, craft, turn, shortName(name)]);
  return { boards: short(m.boards), trains: short(m.trains) };
}

// Whose yard job it is (screens.js parseYardOwners, from the crews in town):
// "@yard|<job>|<craft>". A yard job has one person per craft and no turn
// number, so the page's key is "<job>-<craft>" (YEBS30-S1).
function recordYardCrew(store, crew, now = new Date()) {
  const seen = now.toISOString();
  for (const c of crew || []) {
    if (!c || !c.job || !c.craft || !c.name) continue;
    store[`@yard|${c.job}|${c.craft}`] = { name: c.name, seen };
  }
  return store;
}

// Who is working each yard job now (screens.js parseYardCrewNames, off the
// Call Board): "@yardwork|<job>|<on duty, minutes>" → the crew as read this
// check. A job with no crew lines this check keeps nothing.
function recordYardWork(store, crew, now = new Date()) {
  const seen = now.toISOString();
  const by = new Map();
  for (const c of crew || []) {
    if (!c || !c.job || !c.craft || !c.name || c.onDuty == null) continue;
    const k = `@yardwork|${c.job}|${c.onDuty}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push([c.craft, c.name]);
  }
  for (const [k, list] of by) store[k] = { seen, crew: list };
  return store;
}
// { "<job>|<on duty, as the site prints it>": [[craft, "Last, F"], …] } for
// the yard jobs read in the newest check or the one before.
function workingByJob(store, fmt) {
  let newest = 0;
  const rows = Object.entries(store).filter(([k, v]) => k.startsWith('@yardwork|') && v && Array.isArray(v.crew));
  for (const [, v] of rows) newest = Math.max(newest, Date.parse(v.seen) || 0);
  const out = {};
  for (const [k, v] of rows) {
    if (newest - Date.parse(v.seen) > 20 * 60000) continue;
    const [, job, onDuty] = k.split('|');
    out[`${job}|${fmt(Number(onDuty))}`] = v.crew.map(([craft, name]) => [craft, shortName(name)]);
  }
  return out;
}

function saveNames(file, store) {
  fs.writeFileSync(file, JSON.stringify(store));
}

// The name most recently seen on a turn, any train (within TURN_DAYS): turns
// stay with one person between bids, so it covers trips from before the
// laptop read names, or a train it missed. A spare on the turn shows the
// regular's name; the rep checks it (owner, 2026-10-21: crews already on the
// list had no names).
const TURN_DAYS = 14;
function byTurn(store, now) {
  const out = {};
  const cutoff = now.getTime() - TURN_DAYS * 86400000;
  for (const [k, v] of Object.entries(store)) {
    if (k[0] === '@') continue; // a board screen's name, not a trip's
    const turn = k.slice(k.lastIndexOf('|') + 1);
    if (!(Date.parse(v.seen) >= cutoff)) continue;
    if (!out[turn] || v.seen > out[turn].seen) out[turn] = v;
  }
  return out;
}

// Names for the rows the 14h tab lists (trains.json rows with heldMin ≥ the
// limit): conductor and engineer of the train to Toronto; else, for the
// conductor, the train home; else the turn's latest name. `turnOnly` marks a
// row whose names came only from the turn.
function namesForHeld(rows, store, limit, now = new Date()) {
  const out = {};
  const latest = byTurn(store, now);
  for (const r of rows) {
    if (r.heldMin == null || r.heldMin < limit || !r.co) continue;
    const coTrip = store[key(r.id, r.co)] || (r.back && store[key(r.back.id, r.co)]);
    const enTrip = r.en && store[key(r.id, r.en)];
    const co = (coTrip || latest[r.co] || {}).name || null;
    const en = r.en ? (enTrip || latest[r.en] || {}).name || null : null;
    if (!co && !en) continue;
    out[`${r.id} ${r.month}`] = { co, en, ...(coTrip ? {} : { turnOnly: true }) };
  }
  return out;
}

// Same format public/board-names.js reads: base64 salt, iv and ciphertext
// with the GCM tag on the end (what WebCrypto expects).
function lockNames(names, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const k = crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const body = Buffer.concat([c.update(JSON.stringify(names), 'utf8'), c.final(), c.getAuthTag()]);
  return { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: salt.toString('base64'), iv: iv.toString('base64'), data: body.toString('base64') };
}

// Crew names on the board, members only (owner, 2026-11-10: "once the site
// is locked … add crew names to the board"; "last name, first initial ie
// Justin O'Dea would be O'Dea, J"). "Mike de Man" -> "de Man, M".
function shortName(name) {
  if (name === 'open turn') return name; // screens.js OPEN_TURN: nobody holds it
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  return `${parts.slice(1).join(' ')}, ${parts[0][0].toUpperCase()}`;
}

// { turn: "Last, F" } for every turn seen on a pool or spareboard screen
// (who CATS shows on it now) or a Call Board in the last TURN_DAYS: the
// name read most recently. A 501/502 turn is two people: its keys
// are "S501-CO" / "S501-EN" (the page's own keys for those), from the craft
// read with the name; an older entry with no craft kept is left out for
// them rather than put on the wrong person. A spare who filled a turn is
// the name shown until the regular is seen on it again.
function namesByTurn(store, now = new Date()) {
  const cutoff = now.getTime() - TURN_DAYS * 86400000;
  // Per turn (per craft on 501/502): the latest Call Board name (who worked
  // or is working it) and the board screens' name (whose turn it is).
  const trip = {};
  const board = {};
  let newest = 0;
  const put = (into, k, name, v) => { if (name && (!into[k] || v.seen > into[k].seen)) into[k] = { name, seen: v.seen, working: !!v.working }; };
  for (const [k, v] of Object.entries(store)) {
    const at = v && Date.parse(v.seen);
    if (!(at >= cutoff)) continue;
    if (at > newest) newest = at;
    if (k.startsWith('@yard')) continue; // yard jobs (whose it is, who is on it): below and workingByJob
    if (k === '@bunk' || k === '@mu') continue; // named row by row (bunkhouseNames, makeUpNames), never a turn's
    const into = k[0] === '@' ? board : trip;
    const turn = k.slice(k.lastIndexOf('|') + 1);
    // A make-up turn is never named by its number: one MU01 can be several people at once (makeUpNames).
    if (PLACEHOLDER.test(turn)) continue;
    if (/^S5\d{2}$/.test(turn)) {
      for (const [craft, name] of Object.entries(v.crafts || {})) put(into, `${turn}-${craft === 'CO' ? 'CO' : 'EN'}`, name, v);
    } else put(into, turn, v.name, v);
  }
  // Owner, 2026-11-10: "when a job is working, put the name of the person
  // who's working, who you would see on the call board. When the turn is
  // back home it should put the name of the person whose turn it is."
  const NOW = 20 * 60000; // read in the latest check or the one before
  const fresh = (e) => !!e && newest - Date.parse(e.seen) <= NOW;
  const out = {};
  for (const k of [...new Set([...Object.keys(trip), ...Object.keys(board)])].sort()) {
    const t = trip[k];
    const b = board[k];
    let pick;
    if (fresh(t)) pick = t; // on the Call Board now: whoever is working it
    else if (fresh(b)) pick = b.working && t && Date.parse(b.seen) - Date.parse(t.seen) <= 86400000 ? t : b; // out, off the Call Board: still its worker; home: its owner
    else pick = !t || (b && b.seen > t.seen) ? b : t; // on neither now: the name read last
    out[k] = shortName(pick.name);
  }
  // Yard jobs: whose job it is, per craft, as the crews in town last showed.
  for (const [k, v] of Object.entries(store)) {
    if (!k.startsWith('@yard|') || !v || !(Date.parse(v.seen) >= cutoff)) continue;
    const [, job, craft] = k.split('|');
    // An empty trainee slot is not shown (entries saved before screens.js left them out).
    if (/^(TT|ET)$/.test(craft) && v.name === 'open turn') continue;
    if (job && craft && v.name) out[`${job}-${craft}`] = shortName(v.name);
  }
  return out;
}

// The full name a pool or spareboard screen showed on a turn in the check
// just saved (displacement alerts; owner, 2026-11-13: "Joe Haugh"). key:
// "SR03", or "S501-CO" / "S501-EN" on 501/502. null when that screen wasn't
// read in the last NOW_MIN or showed an open turn.
const NOW_MIN = 20;
function boardNameNow(store, key, now = new Date()) {
  const m = /^(.+)-(CO|EN)$/.exec(key || '');
  const v = store && store[`@board|${m ? m[1] : key}`];
  if (!v || !(now.getTime() - Date.parse(v.seen) <= NOW_MIN * 60000)) return null;
  const name = m ? (v.crafts || {})[m[2]] || (m[2] === 'EN' ? (v.crafts || {}).LE : null) : v.name;
  return name && name !== 'open turn' ? name : null;
}

module.exports = { KEEP_DAYS, loadNames, recordNames, recordBoardCrew, recordBunkhouse, bunkhouseNames, recordMakeUps, makeUpNames, recordYardCrew, recordYardWork, workingByJob, saveNames, namesForHeld, lockNames, shortName, namesByTurn, boardNameNow };
