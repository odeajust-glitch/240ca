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

// A posting closes at 1200 on its closing date (owner, 2026-11-11: "the time
// is always 1200"), Toronto time. → ms.
const CLOSE_HOUR = 12;
function closeAt(closes) {
  const [y, m, d] = String(closes).split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, CLOSE_HOUR + 5);
  const hour = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', hourCycle: 'h23' }).format(guess));
  return guess + (CLOSE_HOUR - hour) * 3600000;
}

// A posting with C in the list's last column was cancelled (owner,
// 2026-11-11: "the C means cancelled and are no longer able to post for").
const cancelled = (j) => /C/.test((j && j.cia) || '');

// Each person's last own turn and craft, kept on the laptop for these alerts
// only ("use their last known position"): { hash: { turn, craft, at } }.
// sightings: summary.people ({ h, turn, own, craft }).
const KEEP_PEOPLE_MS = 120 * 86400000;
function rememberPeople(memory, sightings = [], now = Date.now()) {
  const next = { ...(memory || {}) };
  for (const s of sightings) {
    if (!s || !s.own || !s.h || !s.turn) continue;
    const was = next[s.h];
    // A sighting without the craft doesn't undo one with it on the same turn.
    next[s.h] = { turn: s.turn, craft: s.craft || (was && was.turn === s.turn ? was.craft : '') || '', at: now };
  }
  for (const [h, v] of Object.entries(next)) if (now - v.at > KEEP_PEOPLE_MS) delete next[h];
  return next;
}

// What to send one account now (owner, 2026-11-11: "build the account way":
// the name code and the choices are on the member's account, so every device
// signed in to it gets the alerts). account: { code, postings: { on, remind:
// { <circular number>: hours } } }; jobs: the postings read; people:
// rememberPeople's memory, by the hash of a name code (hashOf(code)); told:
// this account's memory ({ since, jobs: { <number>: { told, reminded } } }) or
// null for an account not seen with these alerts before. → { events: [{ kind:
// 'posting' | 'postingRemind', number, text, url }], told } (told = null when
// there is nothing to keep). The caller marks an event in told.jobs only once
// it went to a device (sent()).
//   - On for the first time: the postings already up are not sent (they are
//     on the Job postings tab); only what appears after.
//   - A new posting goes once, if the person may post for it.
//   - A reminder goes once, the chosen hours before 1200 on the closing date,
//     for a job the member picked, whether or not alerts for new ones are on.
function accountEvents(account, jobs, people, told, hashOf, now = Date.now()) {
  const pref = (account && account.postings) || {};
  const remind = pref.remind || {};
  if (!account || !account.code || (pref.on !== true && !Object.keys(remind).length)) return { events: [], told: null };
  const listed = (jobs || []).filter((j) => closeAt(j.closes) > now);
  const open = listed.filter((j) => !cancelled(j));
  const p = people[hashOf(account.code)];
  const who = p ? standing(p.turn, p.craft) : null;
  const mine = pref.on === true && who ? open.filter((j) => mayPost(who, j)) : [];
  const next = { since: (told && told.since) || now, jobs: {} };
  for (const j of listed) if (told && told.jobs && told.jobs[j.number]) next.jobs[j.number] = { ...told.jobs[j.number] };
  // Switched on again later: what went up meanwhile is not sent either.
  if (told && pref.on === true && told.on === false) for (const j of mine) if (!next.jobs[j.number]) next.jobs[j.number] = { told: now, quiet: true };
  next.on = pref.on === true;
  const events = [];
  if (!told) {
    for (const j of mine) next.jobs[j.number] = { told: now, quiet: true };
  } else {
    for (const j of mine) {
      if (next.jobs[j.number] && next.jobs[j.number].told) continue;
      events.push({ kind: 'posting', number: j.number, text: `Job posting: ${postingText(j)} at 1200.`, url: `./#postings=${j.number}` });
    }
  }
  for (const number of Object.keys(remind)) if (listed.some((x) => x.number === number) && !next.jobs[number]) next.jobs[number] = {};
  for (const [number, hours] of Object.entries(remind)) {
    const j = open.find((x) => x.number === number);
    if (!j || !(hours > 0) || (next.jobs[number] && next.jobs[number].reminded)) continue;
    const left = closeAt(j.closes) - now;
    if (left > hours * 3600000) continue;
    const h = Math.max(1, Math.round(left / 3600000));
    events.push({ kind: 'postingRemind', number, text: `Reminder: the posting for ${j.turn} ${j.cc}${j.description ? ` (${j.description})` : ''} closes in about ${h} hour${h === 1 ? '' : 's'}, at 1200 on ${DAY(j.closes)}.`, url: `./#postings=${number}` });
  }
  // Cancelled before it closed: said once to an account that was sent the
  // posting or had a reminder set for it. No reminder goes for it after.
  for (const j of listed.filter(cancelled)) {
    const t = next.jobs[j.number];
    if (!t || t.cancelled || !((t.told && !t.quiet) || t.reminded || remind[j.number])) continue;
    events.push({ kind: 'postingCancelled', number: j.number, text: `The posting for ${j.turn} ${j.cc}${j.description ? ` (${j.description})` : ''} was cancelled: it can no longer be posted for.`, url: `./#postings=${j.number}` });
  }
  return { events, told: next, standing: who };
}
// Marks one event as sent in an account's memory.
function sent(told, e, now = Date.now()) {
  const j = told.jobs[e.number] || (told.jobs[e.number] = {});
  if (e.kind === 'posting') j.told = now; else if (e.kind === 'postingCancelled') j.cancelled = now; else j.reminded = now;
}

module.exports = { standing, postingKind, mayPost, postingText, closeAt, cancelled, rememberPeople, accountEvents, sent };
