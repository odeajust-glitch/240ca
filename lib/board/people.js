// Hidden search by person (owner, 2026-10-24): type a short code made from
// a name, e.g. Justin O'Dea → JUOD (first two letters of the first name,
// first two of the surname, letters only), and the site shows that person's
// history across every turn they were seen on. No name, and not even the
// code, goes on the site: each check saves only a one-way hash of the code
// with the turn the person was on; the page hashes what's typed the same
// way (public/board.html, crypto.subtle) and looks it up.
const crypto = require('crypto');

const SALT = '240ca-person:';

// Two or three people whose names make the same code (owner, 2026-11-10 and
// 11-11): the first keeps it, the second's last letter becomes 1, the third's
// 2 (BRWA, BRW1, BRW2). COBD was given by hand before that rule. MARO's second
// is MAR2 because MAR1 was taken by MARI's second (confirmed by him). Each is found by a one-way
// hash, so no name is in the code: of the first three letters of the first
// name + the surname where the surname is shared, else of the usual code +
// the surname. To add one:
//   node -e "const P=require('./lib/board/people');console.log(P.nameHash('SURNAME','FIRST'), P.nameHash('SURNAME','CODE',4))"
const OWN_CODES = {
  '1202b80c92a35f85': 'COBD',
  '34fcc410d85d8b69': 'BRW1',
  'da78cc650387ba0e': 'MAR1',
  'de5fac57294a727d': 'JAM1',
  'c4b0fc01cfc20556': 'MAD1',
  '6883e2d252a8a4c1': 'MAR2',
  // BRW2: anyone else with BRW1's surname under BRWA, however CATS spells the
  // first name (found 2026-11-11: after the split the second one still read
  // as BRWA, so the first-three-letters match had missed).
  'd81153b38e801d15': 'BRW2',
};
// Each shared code with the codes split off it, first person first. The page
// has the same list (public/board.html CODE_GROUPS).
const CODE_GROUPS = [['COBR', 'COBD'], ['BRWA', 'BRW1', 'BRW2'], ['JAMC', 'JAM1'], ['MADE', 'MAD1'], ['MARI', 'MAR1'], ['MARO', 'MAR2']];
const letters = (x) => String(x || '').toUpperCase().replace(/[^A-Z]/g, '');
const nameHash = (surname, first, n = 3) => crypto.createHash('sha256').update(`240ca-person-name:${letters(first).slice(0, n)}|${letters(surname)}`).digest('hex').slice(0, 16);

// "O'DEA", "JUSTIN" → "JUOD"; null if either part has under two letters.
function personCode(surname, first) {
  const a = letters(first);
  const b = letters(surname);
  if (a.length < 2 || b.length < 2) return null;
  const code = a.slice(0, 2) + b.slice(0, 2);
  return OWN_CODES[nameHash(surname, first)] || OWN_CODES[nameHash(surname, code, 4)] || code;
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

// --- History from before a code was split ---------------------------------
// Checks saved before the split hold the shared code's hash for everyone who
// shared it (and nothing else about who it was). They are told apart by
// turn: rules = { <shared hash>: { <turn>: <new hash> } }. The laptop learns
// the turns itself (learnSplit: where each split-off person is seen on a turn
// of their own in the first day after the split), plus what is known from
// before (SEED). Checks saved since carry peopleV 2 and are left alone.
// 3 since 2026-11-11 15:40: BRW2 was only recognised from then, so the checks
// saved as 2 (00:52 to 15:28 that day) are told apart by turn like the older ones.
const PEOPLE_V = 3;
const SEED = { COBD: ['SA07', 'SR11'] };
// Stretches the owner placed by hand: this code was on this turn up to (not
// including) `until`, a check time. Used where a turn alone can't tell two
// people apart (owner, 2026-11-11: the second COBR "was sr01 before the
// change" — the board change of 25 Oct 12:16; SR01 went to someone else after).
// From the 25 Oct change of card sheet (owner sent it 2026-11-11): MARI's second
// was a yard spare then and the first is an engineer, so the YBHS01 shifts are
// the second's; YSBY04 was MARO's second's own job before the change.
const DATED = [
  { code: 'COBD', turn: 'SR01', until: '2026-10-25 1216' },
  { code: 'MAR1', turn: 'YBHS01', until: '2026-11-03 0000' },
  { code: 'MAR2', turn: 'YSBY04', until: '2026-10-26 0000' },
  // MADE's second is a trainee (owner, 2026-11-11: "He would have had the TT
  // beside his name the whole time"); on 3 Nov the crews in town still put a
  // trainee on the plain job, so MADE "owned" these beside its own B111.
  { code: 'MAD1', turn: 'YPRS30', since: '2026-11-03 0900', until: '2026-11-04 0600' },
  { code: 'MAD1', turn: 'YINS30', since: '2026-11-03 0900', until: '2026-11-04 0600' },
];
const sharedOf = (code) => { const g = CODE_GROUPS.find((x) => x.indexOf(code) > 0); return g ? g[0] : null; };
const LEARN_MIN = 24 * 60;
function emptySplits() {
  const s = { since: {}, map: {} };
  for (const [code, turns] of Object.entries(SEED)) for (const turn of turns) (s.map[personHash(sharedOf(code))] = s.map[personHash(sharedOf(code))] || {})[turn] = personHash(code);
  s.dated = DATED.map((d) => ({ from: personHash(sharedOf(d.code)), turn: d.turn, to: personHash(d.code), ...(d.since ? { since: d.since } : {}), ...(d.until ? { until: d.until } : {}) }));
  return s;
}
function loadSplits(file) {
  const s = emptySplits();
  try {
    const got = JSON.parse(require('fs').readFileSync(file, 'utf8'));
    Object.assign(s.since, got.since || {});
    for (const [h, m] of Object.entries(got.map || {})) s.map[h] = { ...(s.map[h] || {}), ...m };
  } catch { /* none yet */ }
  return s;
}
// sightings: [{ code, turn, own }] from one check (codes in memory only).
// → true when a turn was added.
function learnSplit(splits, sightings, nowMin) {
  let changed = false;
  for (const { code, turn, own } of sightings || []) {
    const shared = own && code && turn ? sharedOf(code) : null;
    if (!shared) continue;
    const h = personHash(code);
    if (splits.since[h] == null) { splits.since[h] = nowMin; changed = true; }
    if (nowMin - splits.since[h] > LEARN_MIN) continue;
    const m = splits.map[personHash(shared)] || (splits.map[personHash(shared)] = {});
    const base = turn.replace(/-(TT|ET)$/, '');
    for (const t of new Set([turn, base])) if (m[t] !== h) { m[t] = h; changed = true; }
  }
  return changed;
}
const splitsSig = (splits) => crypto.createHash('sha256').update(JSON.stringify(Object.entries((splits && splits.map) || {}).sort().map(([h, m]) => [h, Object.entries(m).sort()]).concat([(splits && splits.dated) || []]))).digest('hex').slice(0, 12);
// One saved check's sightings with the split applied (a copy; v2 untouched).
function retie(sightings, splits, v, taken) {
  if (v >= PEOPLE_V || !splits || !splits.map) return sightings || [];
  const dated = (p) => taken && (splits.dated || []).find((d) => d.from === p.h && d.turn === p.turn && (!d.since || taken >= d.since) && (!d.until || taken < d.until));
  return (sightings || []).map((p) => { const d = p && dated(p); const to = d ? d.to : p && splits.map[p.h] && splits.map[p.h][p.turn]; return to ? { ...p, h: to } : p; });
}

module.exports = { personCode, nameHash, CODE_GROUPS, PEOPLE_V, emptySplits, loadSplits, learnSplit, splitsSig, retie, personHash, addSightings, mergeStretches, SALT, GAP, SHARED };
