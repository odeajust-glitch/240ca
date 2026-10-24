// Hidden search by person (owner, 2026-10-24): type a short code made from
// a name, e.g. Justin O'Dea → JUOD (first two letters of the first name,
// first two of the surname, letters only), and the site shows that person's
// history across every turn they were seen on. No name, and not even the
// code, goes on the site: each check saves only a one-way hash of the code
// with the turn the person was on; the page hashes what's typed the same
// way (public/board.html, crypto.subtle) and looks it up.
const crypto = require('crypto');

const SALT = '240ca-person:';

// "O'DEA", "JUSTIN" → "JUOD"; null if either part has under two letters.
function personCode(surname, first) {
  const a = String(first || '').toUpperCase().replace(/[^A-Z]/g, '');
  const b = String(surname || '').toUpperCase().replace(/[^A-Z]/g, '');
  return a.length >= 2 && b.length >= 2 ? a.slice(0, 2) + b.slice(0, 2) : null;
}

const personHash = (code) => crypto.createHash('sha256').update(SALT + String(code).toUpperCase()).digest('hex').slice(0, 16);

// Who was seen where, check by check → { hash: [{ turn, own, from, to }] }.
// A sighting within GAP minutes of the last one on the same turn stretches
// it; otherwise it starts a new stretch. own: seen on a board under their
// own turn (not a job they're filling in on).
const GAP = 45;
const minOf = (t) => { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})$/.exec(t || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : null; };
function addSightings(into, sightings, taken) {
  for (const { h, turn, own } of sightings || []) {
    if (!h || !turn) continue;
    const list = into[h] || (into[h] = []);
    const open = list.filter((e) => e.turn === turn).pop();
    if (open && minOf(taken) - minOf(open.to) <= GAP) { open.to = taken; open.own = open.own || !!own; } else list.push({ turn, own: !!own, from: taken, to: taken });
  }
  return into;
}

// Joins a day's stretches onto the days before (a stretch running over
// midnight stays one).
function mergeStretches(into, day) {
  for (const [h, list] of Object.entries(day || {})) {
    const all = into[h] || (into[h] = []);
    for (const e of list) {
      const open = all.filter((x) => x.turn === e.turn).pop();
      if (open && minOf(e.from) - minOf(open.to) <= GAP) { open.to = e.to; open.own = open.own || e.own; } else all.push({ ...e });
    }
  }
  return into;
}

module.exports = { personCode, personHash, addSightings, mergeStretches, SALT, GAP };
