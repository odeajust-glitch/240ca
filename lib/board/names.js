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
  for (const t of trains) {
    for (const c of t.crew) store[key(`${t.symbol} ${t.originDay}`, c.turn)] = { name: c.name, seen: now.toISOString() };
  }
  const cutoff = now.getTime() - KEEP_DAYS * 86400000;
  for (const [k, v] of Object.entries(store)) if (!(Date.parse(v.seen) >= cutoff)) delete store[k];
  return store;
}

function saveNames(file, store) {
  fs.writeFileSync(file, JSON.stringify(store));
}

// Names for the rows the 14h tab lists (trains.json rows with heldMin ≥ the
// limit): conductor and engineer of the train to Toronto, falling back to
// the train home for the conductor.
function namesForHeld(rows, store, limit) {
  const out = {};
  for (const r of rows) {
    if (r.heldMin == null || r.heldMin < limit || !r.co) continue;
    const co = (store[key(r.id, r.co)] || (r.back && store[key(r.back.id, r.co)]) || {}).name;
    const en = r.en ? (store[key(r.id, r.en)] || {}).name : null;
    if (co || en) out[`${r.id} ${r.month}`] = { co: co || null, en: en || null };
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

module.exports = { KEEP_DAYS, loadNames, recordNames, saveNames, namesForHeld, lockNames };
