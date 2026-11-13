// The yardmaster seniority list (owner, 2026-11-13): who can be called for a
// yardmaster job and in what order, with each person's own job. Read by
// scripts/board-auto.js on CATS 3 → 1 (list code 3G YA, 45 SA; the screen in
// lib/board/screens.js parseSeniorityList) "only 2 times a day, once the first
// check after 0000 and once the first check after 1200", Toronto time.
//
// The list has names, so it lives only on the laptop:
// BoardChecker\yardmaster-seniority.json. Never in history\, the saved checks,
// the laptop backup (lib/board/backup.js SKIP_FILES) or the site. Each version
// of the list is kept with when it was first and last seen (`past`), so a
// prediction can be tested against the list as it stood that day.
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

module.exports = { slotOf, due, keep, sig, KEEP_PAST, MAX_TRIES };
