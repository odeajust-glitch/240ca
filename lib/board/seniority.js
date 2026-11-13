// The yardmaster seniority list (owner, 2026-11-13): who can be called for a
// yardmaster job and in what order, with each person's own job. Read by
// scripts/board-auto.js on CATS 3 → 1 (list code 3G YA, 45 SA; the screen in
// lib/board/screens.js parseSeniorityList) "only 2 times a day, once the first
// check after 0000 and once the first check after 1200", Toronto time.
//
// The list has names, so it lives on the laptop: BoardChecker\yardmaster-seniority.json.
// Never in history\, the saved checks or the laptop backup (lib/board/backup.js SKIP_FILES);
// the site gets it only through siteList below, its names locked. Each version
// of the list is kept with when it was first and last seen (`past`), so a
// prediction can be tested against the list as it stood that day.
const fs = require('fs');
const path = require('path');

const KEEP_PAST = 60; // versions; the statuses (OFF, VACATION) change most days
const MAX_TRIES = 3; // a half day's read that fails is tried at the next two checks, then left

// "2026-11-13 0000" or "2026-11-13 1200": the half day a moment is in, Toronto time.
function slotOf(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${+p.hour < 12 ? '0000' : '1200'}`;
}

// Read on this check? Not yet read in this half day, and fewer than
// MAX_TRIES tries at it so far (tries: this half day's, kept by the caller).
const due = (saved, now, tries = 0) => (!saved || saved.slot !== slotOf(now)) && tries < MAX_TRIES;

// What changes a version: who is where, and their status.
const sig = (list) => JSON.stringify((list || []).map((r) => [r.rank, r.name, r.assignment, r.status, r.awarded, r.move]));

// The file after a complete read: { at, slot, since, pages, count, list, past }.
// since: when this version was first read; past: [{ from, until, list }].
function keep(saved, list, { now = new Date(), pages = 0 } = {}) {
  const at = now.toISOString();
  const same = !!(saved && saved.list && sig(saved.list) === sig(list));
  const past = [...((saved && saved.past) || [])];
  if (saved && saved.list && saved.list.length && !same) past.push({ from: saved.since || saved.at, until: saved.at, list: saved.list });
  return { at, slot: slotOf(now), since: same ? (saved.since || saved.at) : at, pages, count: list.length, list, past: past.slice(-KEEP_PAST) };
}

// What the board's site gets for its test-site call order page (public/ym.html; owner, 2026-11-13:
// "build this into the test site as is for now"): the list without names, and the names by rank
// apart, for site.js to lock with the crew names' key (BOARD_NAMES_KEY). Before the laptop has read
// the list, the 13 Nov copy kept in the repository (no names). -> { read, since, source, list, names } or null.
const FALLBACK = path.join(__dirname, '..', '..', 'docs', 'board-checker', 'yardmaster', 'seniority-2026-11-13.json');
const SITE_FIELDS = ['rank', 'date', 'marks', 'tags', 'dist', 'sub', 'awarded', 'move', 'status', 'assignment', 'pool', 'turn', 'craft', 'yard', 'description'];
const forSite = (r) => Object.fromEntries(SITE_FIELDS.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]));
function siteList(file, fallback = FALLBACK) {
  let saved = null;
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* not read yet */ }
  if (saved && Array.isArray(saved.list) && saved.list.length) {
    const names = {};
    // A list read before the short names were kept (13 Nov 1546): made from the name as CATS showed it.
    for (const r of saved.list) { const n = r.short || (r.name ? require('./screens').seniorityShort(r.name) : ''); if (n) names[r.rank] = n; }
    return { read: saved.at, since: saved.since || saved.at, source: 'cats', list: saved.list.map(forSite), names: Object.keys(names).length ? names : null };
  }
  try {
    const d = JSON.parse(fs.readFileSync(fallback, 'utf8'));
    return { read: '2026-11-13T17:00:00.000Z', since: '2026-11-13T17:00:00.000Z', source: 'the 13 Nov list, no names', list: d.list.map(forSite), names: null };
  } catch { return null; }
}

module.exports = { slotOf, due, keep, sig, siteList, KEEP_PAST, MAX_TRIES };
