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
    const into = k[0] === '@' ? board : trip;
    const turn = k.slice(k.lastIndexOf('|') + 1);
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
  return out;
}

module.exports = { KEEP_DAYS, loadNames, recordNames, recordBoardCrew, saveNames, namesForHeld, lockNames, shortName, namesByTurn };
