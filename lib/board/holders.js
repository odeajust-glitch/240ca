// Whose turn is whose (owner, 2026-10-25), remembered across restarts in
// BoardChecker\turn-holders.json. People are known by surname + first
// initial, stored only as a one-way hash, so the file has turns and no names.
//
// The rules (owner): a name on a Sarnia spareboard (conductor or engineer,
// fast or slow) is on their own turn. A name on a pool list (23, 19, 21,
// 27, 25, 26, 29) at home (T 0) and not working is on their own turn too:
// that's how a temporary assignment shows, e.g. off the spareboard onto the
// Chain Gang. A name on a pool list away (T 1+) or working (999), on the Call
// Board, or in the bunkhouse may be a spare covering for a trip, so it never
// changes whose turn is whose.
const crypto = require('crypto');
const fs = require('fs');

const SALT = '240ca-holder:';
const FORGET_DAYS = 90; // not seen on their own turn in that long: dropped
const hashKey = (key) => crypto.createHash('sha256').update(SALT + key).digest('hex').slice(0, 20);

// holders: { [hash]: { turn, at, from } } (turn null = two turns seen, unsure).
// seen: [{ key, turn, own, from: 'spare' | 'pool' }] from one check.
// Within a check, a pool turn at home beats a spareboard listing (the
// assignment is the newer news); two different turns of the same kind:
// unsure. now: ms.
function learn(holders, seen, now) {
  const next = { ...(holders || {}) };
  const rank = { pool: 2, spare: 1 };
  const check = new Map();
  for (const s of seen) {
    if (!s.own || !s.key || !s.turn) continue;
    const h = hashKey(s.key);
    const was = check.get(h);
    if (!was || rank[s.from] > rank[was.from]) check.set(h, { turn: s.turn, from: s.from });
    else if (rank[s.from] === rank[was.from] && was.turn !== s.turn) check.set(h, { turn: null, from: s.from });
  }
  for (const [h, v] of check) next[h] = { turn: v.turn, from: v.from, at: now };
  for (const [h, v] of Object.entries(next)) if (now - v.at > FORGET_DAYS * 864e5) delete next[h];
  return next;
}

const turnOf = (holders, key) => (key && holders && holders[hashKey(key)] ? holders[hashKey(key)].turn : null);
const loadHolders = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };
const saveHolders = (file, h) => fs.writeFileSync(file, JSON.stringify(h));

module.exports = { learn, turnOf, loadHolders, saveHolders, hashKey };
