// Hidden search by person (owner, 2026-10-24): type a short code made from
// a name, e.g. Justin O'Dea → JUOD (first two letters of the first name,
// first two of the surname, letters only), and the site shows that person's
// history across every turn they were seen on. No name, and not even the
// code, goes on the site: each check saves only a one-way hash of the code
// with the turn the person was on; the page hashes what's typed the same
// way (public/board.html, crypto.subtle) and looks it up.
const crypto = require('crypto');

const SALT = '240ca-person:';

// Two people whose names make the same code (owner, 2026-11-10: one stays
// COBR, the other becomes COBD): the second gets a code of their own.
// Kept as a one-way hash of first three letters of the first name + the
// surname, so no name is in the code. To add one:
//   node -e "console.log(require('./lib/board/people').nameHash('SURNAME','FIRST'))"
const OWN_CODES = { '1202b80c92a35f85': 'COBD' };
const letters = (x) => String(x || '').toUpperCase().replace(/[^A-Z]/g, '');
const nameHash = (surname, first) => crypto.createHash('sha256').update(`240ca-person-name:${letters(first).slice(0, 3)}|${letters(surname)}`).digest('hex').slice(0, 16);

// "O'DEA", "JUSTIN" → "JUOD"; null if either part has under two letters.
function personCode(surname, first) {
  const a = letters(first);
  const b = letters(surname);
  if (a.length < 2 || b.length < 2) return null;
  return OWN_CODES[nameHash(surname, first)] || a.slice(0, 2) + b.slice(0, 2);
}

const personHash = (code) => crypto.createHash('sha256').update(SALT + String(code).toUpperCase()).digest('hex').slice(0, 16);

// Who was seen where, check by check → { hash: [{ turn, own, from, to }] }.
// A sighting within GAP minutes of the last one on the same turn stretches
// it; otherwise it starts a new stretch. own: seen on a board under their
// own turn (not a job they're filling in on).
const GAP = 45;
const minOf = (t) => { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})$/.exec(t || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : null; };
// 501/502: one number, two turns (EN and CO).
const SHARED = /^S5\d{2}$/;

function addSightings(into, sightings, taken) {
  for (const { h, turn, own, craft } of sightings || []) {
    if (!h || !turn) continue;
    const list = into[h] || (into[h] = []);
    // 501/502 is one number, two turns (owner, 2026-11-03): their craft
    // (EN / CO) goes with the stretch, so the page shows only theirs.
    const cr = SHARED.test(turn) && craft ? (craft === 'CO' ? 'CO' : 'EN') : null;
    // A change between their own turn and not (owner, 2026-10-25: S501
    // became a TV, JUOD on SR03) starts a new stretch, so the latest says which.
    const open = list.filter((e) => e.turn === turn).pop();
    if (open && open.own === !!own && minOf(taken) - minOf(open.to) <= GAP) { open.to = taken; if (cr) open.craft = cr; } else list.push({ turn, own: !!own, from: taken, to: taken, ...(cr ? { craft: cr } : {}) });
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
      if (open && open.own === e.own && minOf(e.from) - minOf(open.to) <= GAP) { open.to = e.to; if (e.craft) open.craft = e.craft; } else all.push({ ...e });
    }
  }
  return into;
}

module.exports = { personCode, nameHash, personHash, addSightings, mergeStretches, SALT, GAP, SHARED };
