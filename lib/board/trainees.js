// Trainees (TT / ET) stay on their slot (S501-TT) while the turn they ride
// with is away from Sarnia (owner, 2026-11-04: WADE "should show him with
// me … for TTs and ETs that goto Toronto or Garnet … stay on the turn till
// they get back to Sarnia. They then can get the notifications for the turn
// they are linked to"). A trainee is only read in Sarnia's crews in town and
// on the Call Board, so away they'd drop off after 30 min.
//
// memory: { [hash]: { slot, base, craft, at, seen } } (BoardChecker\trainees.json).
// Each check: a trainee seen on a slot is remembered; one not seen whose turn
// is away (not on a Sarnia board at home, or out working) gets a kept
// sighting on the slot. Back home: kept 30 min more (crews in town shows
// them again if they're still training), then let go. Never past 4 days
// since really seen, or once seen on a turn of their own.
const SLOT = /^([A-Z][A-Z0-9]\d{2})-(TT|ET)$/;
const GRACE = 30 * 60000;
const MAX = 4 * 864e5;

// Is the turn at home in Sarnia and free (not out working)? input: loadSummary's.
function homeInSarnia(base, craft, input) {
  const s5 = /^S5\d{2}$/.test(base);
  const want = craft === 'TT' ? 'CO' : 'EN';
  const lists = [input.chainGangHome, input.aHome, input.bHome, input.sdHome, input.s1Home, input.s3Home, input.s5, ...Object.values(input.spareboards || {})];
  const onDuty = (input.callBoard || []).some((t) => (t.crew || []).some((c) => c.turn === base));
  if (onDuty) return false;
  return lists.some((list) => (list || []).some((t) => t.turn === base && !t.working && (t.terminal == null || t.terminal === 0)
    && (!s5 || !t.craft || (want === 'CO' ? t.craft === 'CO' : t.craft !== 'CO'))));
}

// → { memory, add: [sightings to add] }. sightings: this check's ({ h, turn, own }).
function keepTrainees(memory = {}, sightings = [], input = {}, now = Date.now()) {
  const next = { ...memory };
  const seenNow = new Set();
  for (const s of sightings) {
    const m = s.own && SLOT.exec(s.turn || '');
    if (!m) continue;
    next[s.h] = { slot: s.turn, base: m[1], craft: m[2], at: now, seen: now };
    seenNow.add(s.h);
  }
  const add = [];
  for (const [h, t] of Object.entries(next)) {
    if (seenNow.has(h)) continue;
    // On a turn of their own now, or not really seen for days: let go.
    if (sightings.some((s) => s.h === h && s.own) || now - (t.seen || t.at) > MAX) { delete next[h]; continue; }
    if (!homeInSarnia(t.base, t.craft, input)) {
      next[h] = { ...t, at: now };
      add.push({ h, turn: t.slot, own: true, kept: true });
    } else if (now - t.at > GRACE) delete next[h];
    else add.push({ h, turn: t.slot, own: true, kept: true });
  }
  return { memory: next, add };
}

module.exports = { keepTrainees, homeInSarnia };
