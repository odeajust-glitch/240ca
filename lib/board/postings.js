// Job posting alerts: who may post for which job (owner, 2026-11-11). The
// postings come from CATS's Circular Inquiry (screens.js parseCircularInquiry;
// BoardChecker\postings.json). An alert for a posting goes only to a person
// who could bid it. His rules, in his words where quoted:
//
//   "if the person is a conductor or engineer. If their spot is unknown, for
//   the purposes of these notifications only, use their last known craft"
//   (and, asked: "use their last known position").
//   Engineers "can post for road or yard turns, regardless of where they are
//   currently".
//   Conductors: "on the spare board can post to either the road or to the
//   yard. Those in the yard can only goto other yard tvs, and more
//   specifically if they are a FO they can only post to other FO postings. S1
//   or switchman, can post to either. Road person can only post to road tvs.
//   Anyone on the road can post for 502/501 tv, any A or B pool TVs. Chain
//   gang cannot post to another chain gang tv"; "A conductor in the A or B
//   pool, or on 501/502 can also post to chain gang".
//   Permanent postings, "for now" (to be reviewed): "any perms show to in
//   their specific craft and location. Engineer, Conductor Yard and Conductor
//   Road". A spareboard conductor gets both (asked: "yes").
//
// Nothing here knows a name: a person is their turn and craft as the boards
// last showed them.

// Where a person stands, from their own turn (and craft, for a yard job):
// { craft: 'EN' | 'CO', place: 'spare' | 'yard' | 'road', yardCraft, pool }
// or null when it can't be told (a yardmaster, a trainee slot, no turn).
function standing(turn, craft = '') {
  const t = String(turn || '').toUpperCase();
  if (!t || /-(TT|ET)$/.test(t) || /^(TT|ET|YA)$/.test(craft)) return null;
  const base = t.replace(/-(CO|EN)$/, '');
  // Yard jobs and the relief jobs (YPRS30, XSAS02): the craft says which.
  if (/^[YX][A-Z]{2,3}[A-Z0-9]?\d{2}$/.test(base) && base.length >= 6) {
    if (/^(EN|LE)$/.test(craft)) return { craft: 'EN', place: 'yard', pool: 'YD' };
    if (/^(FO|S1|B1|YF|BR)$/.test(craft)) return { craft: 'CO', place: 'yard', yardCraft: craft === 'FO' || craft === 'YF' ? 'FO' : 'S1', pool: 'YD' };
    return null;
  }
  const pool = base.slice(0, 2);
  // Spareboards: conductors B1xx, engineers EN.. / SE.. (lib/board/config.js).
  if (/^B\d{3}$/.test(base)) return { craft: 'CO', place: 'spare', pool: 'B1' };
  if (/^(EN|SE)\d{2}$/.test(base)) return { craft: 'EN', place: 'spare', pool };
  // 501/502: one number, two turns.
  if (pool === 'S5') { const c = /-EN$/.test(t) || /^(EN|LE)$/.test(craft) ? 'EN' : 'CO'; return { craft: c, place: 'road', pool }; }
  if (/^(SA|SB|SR)$/.test(pool)) return { craft: 'CO', place: 'road', pool };
  if (/^(S1|S3|SD)$/.test(pool)) return { craft: 'EN', place: 'road', pool };
  if (/^(EN|LE)$/.test(craft)) return { craft: 'EN', place: 'road', pool };
  if (craft === 'CO') return { craft: 'CO', place: 'road', pool };
  return null;
}

// A posting's side: { craft, place: 'yard' | 'road', yardCraft, pool, perm }.
function postingKind(j) {
  const eng = /^(EN|LE)$/.test(j.cc || '');
  return { craft: eng ? 'EN' : 'CO', place: j.yard ? 'yard' : 'road', yardCraft: j.yard && !eng ? (j.cc === 'FO' ? 'FO' : 'S1') : '', pool: j.pool || '', perm: j.term === 'P' };
}

// May this person post for this job? who: standing()'s answer.
function mayPost(who, j) {
  if (!who) return false;
  const p = postingKind(j);
  if (who.craft !== p.craft) return false;
  if (who.craft === 'EN') return true; // road or yard, wherever they are
  if (who.place === 'spare') return true; // either side, permanent or temporary
  if (p.perm) return who.place === p.place; // for now: craft and location only
  if (who.place === 'yard') return p.place === 'yard' && (who.yardCraft === 'S1' || p.yardCraft === 'FO');
  // On the road: road turns only; the chain gang not to another chain gang turn.
  if (p.place !== 'road') return false;
  return !(who.pool === 'SR' && p.pool === 'SR');
}

// "S1 on YPRS30, permanent, closes Thu 12 Nov" for an alert.
const DAY = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
function postingText(j) {
  return `${j.turn} ${j.cc}${j.description ? ` (${j.description})` : ''}, ${j.term === 'P' ? 'permanent' : 'temporary'}, closes ${DAY(j.closes)}`;
}

module.exports = { standing, postingKind, mayPost, postingText };
