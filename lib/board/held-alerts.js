// "You were held 14 h+" alerts (owner, 2026-11-06: "add a notification for
// those tracking their name code. Have it send a notification to them
// saying they were violated and to visit the site to submit the info to
// their rep"). For each crew held 14 h or more at the away terminal
// (trains.json rows, as the 18.6(b) tab lists them), the person on it is
// found from the Turn History sightings (people.json: { hash: [{ turn, own,
// from, to }] }): seen on that crew's conductor or engineer turn when the
// train went on duty. Phones following that person by name code ('@hash')
// are told, once per trip. Turns only, never names.
const { fmtStamp } = (() => {
  const SUFFIX = (d) => (d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th');
  // "2026-11-06 0019" → "6th 0019"
  const fmtStamp = (st) => (st ? `${+st.slice(8, 10)}${SUFFIX(+st.slice(8, 10))} ${st.slice(11, 15)}` : '');
  return { fmtStamp };
})();

const HELD_LIMIT = 14 * 60;
const NEAR = 60; // minutes either side of the train's on duty
const KEEP_DAYS = 10; // the told memory
const stampMin = (st) => Date.UTC(+st.slice(0, 4), +st.slice(5, 7) - 1, +st.slice(8, 10), +st.slice(11, 13), +st.slice(13, 15)) / 60000;
const dur = (m) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`;

// The person hashes on that train's crew: { hash: 'CO' | 'EN' }.
function crewOf(row, people) {
  const out = {};
  if (!row.onDuty) return out;
  const on = stampMin(row.onDuty);
  for (const [hash, list] of Object.entries(people || {})) {
    for (const e of list || []) {
      if (!e.from || !e.to) continue;
      const turn = String(e.turn || '').replace(/-(CO|EN|TT|ET)$/, '');
      const role = turn === row.co ? 'CO' : turn === row.en ? 'EN' : null;
      if (!role || /-(TT|ET)$/.test(e.turn || '')) continue; // trainees: their jobs never go spare
      if (stampMin(e.from) - NEAR <= on && stampMin(e.to) + NEAR >= on) { out[hash] = role; break; }
    }
  }
  return out;
}

// → { events: [{ hash, role, key, text }], told }. now: ms. told: { key: ms }.
function heldEvents({ trains = [], people = {}, followed = new Set(), told = {}, now = Date.now(), since = null }) {
  const next = Object.fromEntries(Object.entries(told || {}).filter(([, at]) => now - at < KEEP_DAYS * 86400000));
  const events = [];
  for (const r of trains) {
    if (r.heldMin == null || r.heldMin < HELD_LIMIT || !r.co) continue;
    if (since && r.offDuty && r.offDuty < since) continue; // old trips aren't news
    for (const [hash, role] of Object.entries(crewOf(r, people))) {
      if (!followed.has(hash)) continue;
      const key = `${hash}|${r.id}|${r.month}`;
      if (next[key] != null) continue;
      next[key] = now;
      const turn = role === 'EN' ? r.en : r.co;
      const where = /^L50/.test(r.id) ? 'Garnet' : 'Toronto';
      const what = role === 'EN' ? 'held at the away-from-home terminal 14 hours or more' : 'an Article 18.6(b) violation: held at the away-from-home terminal 14 hours or more';
      const text = `${turn}: you were held ${dur(r.heldMin)}${r.stillHeld ? ' so far' : ''} at ${where} after ${r.id} (off duty ≈ ${fmtStamp(r.offDuty)}${r.back ? `, ${r.back.id} home on duty ${fmtStamp(r.back.onDuty)}` : ''}). That's ${what}. Open the board's Article 18.6(b) tab to send it to your rep.`;
      // Tapping it opens the 18.6(b) tab on this trip's form, this craft
      // (owner, 2026-11-06: "brings them right to the page to fill out").
      const url = `./#14h=${encodeURIComponent(`${r.id}|${r.month}|${role}`)}`;
      events.push({ hash, role, turn, key, text, train: r.id, url });
    }
  }
  return { events, told: next };
}

module.exports = { heldEvents, crewOf, HELD_LIMIT };
