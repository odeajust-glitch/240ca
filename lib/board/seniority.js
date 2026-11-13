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
const sig = (list) => JSON.stringify((list || []).map((r) => [r.rank, r.name, r.assignment, r.status, r.awarded, r.move, r.temp ? r.temp.assignment : '']));

// The file after a complete read: { at, slot, since, pages, count, list, past }.
// since: when this version was first read; past: [{ from, until, list }].
function keep(saved, list, { now = new Date(), pages = 0, tempRead = null } = {}) {
  const at = now.toISOString();
  const same = !!(saved && saved.list && sig(saved.list) === sig(list));
  const past = [...((saved && saved.past) || [])];
  if (saved && saved.list && saved.list.length && !same) past.push({ from: saved.since || saved.at, until: saved.at, list: saved.list });
  return { at, slot: slotOf(now), since: same ? (saved.since || saved.at) : at, pages, count: list.length, ...(tempRead ? { tempRead } : {}), list, past: past.slice(-KEEP_PAST) };
}

// The list read with TEMP ASGN Y (owner, 2026-11-13) beside the permanent one, person by person
// (by rank): a second assignment line on the Y list, or else the one it shows when it differs from
// the permanent job, is their temporary assignment: `temp` { assignment, pool, turn, craft, yard,
// description, awarded, move }. tempRows null (not read): the list as it was.
const ASG_FIELDS = ['assignment', 'pool', 'turn', 'craft', 'yard', 'description'];
function withTemp(perm, tempRows) {
  if (!tempRows) return perm;
  const byRank = new Map(tempRows.map((r) => [r.rank, r]));
  return perm.map((r) => {
    const t = byRank.get(r.rank);
    if (!t) return r;
    const cand = (t.extra && t.extra.find((x) => x.assignment && x.assignment !== r.assignment)) || (t.assignment && t.assignment !== r.assignment ? t : null);
    if (!cand) return r;
    const temp = Object.fromEntries(ASG_FIELDS.map((k) => [k, cand[k]]));
    return { ...r, temp: { ...temp, awarded: t.awarded || '', move: t.move || '' } };
  });
}

// What the board's site gets for its test-site call order page (public/ym.html; owner, 2026-11-13:
// "build this into the test site as is for now"): the list without names, and the names by rank
// apart, for site.js to lock with the crew names' key (BOARD_NAMES_KEY). Before the laptop has read
// the list, the 13 Nov copy kept in the repository (no names). -> { read, since, source, list, names } or null.
const FALLBACK = path.join(__dirname, '..', '..', 'docs', 'board-checker', 'yardmaster', 'seniority-2026-11-13.json');
const SITE_FIELDS = ['rank', 'date', 'marks', 'tags', 'dist', 'sub', 'awarded', 'move', 'status', 'assignment', 'pool', 'turn', 'craft', 'yard', 'description', 'temp'];
const forSite = (r) => Object.fromEntries(SITE_FIELDS.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]));
function siteList(file, fallback = FALLBACK) {
  let saved = null;
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* not read yet */ }
  if (saved && Array.isArray(saved.list) && saved.list.length) {
    const names = {};
    // A list read before the short names were kept (13 Nov 1546): made from the name as CATS showed it.
    for (const r of saved.list) { const n = r.short || (r.name ? require('./screens').seniorityShort(r.name) : ''); if (n) names[r.rank] = n; }
    return { read: saved.at, since: saved.since || saved.at, source: 'cats', tempRead: saved.tempRead || null, list: saved.list.map(forSite), names: Object.keys(names).length ? names : null };
  }
  try {
    const d = JSON.parse(fs.readFileSync(fallback, 'utf8'));
    return { read: '2026-11-13T17:00:00.000Z', since: '2026-11-13T17:00:00.000Z', source: 'the 13 Nov list, no names', list: d.list.map(forSite), names: null };
  } catch { return null; }
}

// Each person on the list as the newest board check showed them (owner, 2026-11-13: "if a yard job
// went spare now, and it would have the exact order and why"), by rank, no names: from the job they
// are working (a temporary one first), the crews in town (craft by craft; "(temporary)" lines are a
// temporary holder's), the pool and spare boards, and the days off. snap: a snapshot as the day files
// keep it (taken "YYYY-MM-DD HHMM", pools, town, daysOff). -> { taken, byRank: { rank: { status
// (available | off | busy), freeAt ("YYYY-MM-DDTHH:MM" or ''), text, src } } } or null.
function liveFacts(list, snap) {
  const T = require('./time');
  const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d)(\d\d)$/.exec((snap && snap.taken) || '');
  if (!m) return null;
  const now = T.at(+m[1], +m[2], +m[3], +m[4], +m[5]);
  const when = (txt) => { const x = /(\d{1,2})(?:st|nd|rd|th) (\d\d)(\d\d)/.exec(txt || ''); return x ? T.nearestDay(now, +x[1], +x[2], +x[3]) : null; };
  const boards = new Map();
  for (const p of snap.pools || []) for (const t of p.turns || []) if (!boards.has(t.turn)) boards.set(t.turn, { src: p.name, text: t.status || '' });
  const byRank = {};
  for (const r of list || []) {
    const job = r.temp && r.temp.assignment ? r.temp : r;
    if (!job.assignment) { byRank[r.rank] = { status: 'available', freeAt: '', text: 'no current job', src: '' }; continue; }
    const temp = job !== r;
    const town = (snap.town || []).filter((t) => t.turn === job.turn && (!t.craft || t.craft === job.craft || /^TT/.test(t.text) === false && t.text.startsWith(`${job.craft}`)));
    const line = town.find((t) => /\(temporary\)/.test(t.text) === temp && t.text.startsWith(job.craft)) || town.find((t) => t.text.startsWith(job.craft) && !/\(temporary\)/.test(t.text));
    const b = boards.get(job.turn);
    // Out on a train first: on duty on the Call Board, on the way home, at the Toronto bunkhouse, away.
    const pairOf = (crew) => [...String(crew || '').matchAll(/\b(EN|CO|LE|FO|S1)\s+([A-Z0-9]+)/g)].map((x) => ({ craft: x[1], turn: x[2] }));
    const isMe = (craft, turn) => turn === job.turn && (craft === job.craft || (/^(EN|LE)$/.test(craft) && /^(EN|LE)$/.test(job.craft)));
    const duty = (snap.onDuty || []).find((t) => pairOf(t.crew).some((x) => isMe(x.craft, x.turn)));
    const way = (snap.onTheWay || []).find((t) => (t.en === job.turn && job.craft === 'EN') || (t.co === job.turn && job.craft !== 'EN'));
    const bunk = (snap.bunkhouse || []).find((t) => (t.en === job.turn && job.craft === 'EN') || (t.co === job.turn && job.craft !== 'EN'));
    const away = (snap.away || []).includes(job.turn);
    const back = (snap.returning || []).find((x) => String(x).split(' ')[0] === job.turn);
    const out = duty ? { src: 'Call Board', text: `on duty on ${duty.train} from ${duty.onDuty}`, busy: true }
      : way ? { src: 'on the way home', text: `coming home on ${way.train}${way.rested ? `, rested ${way.rested}` : ''}`, rested: way.rested }
        : bunk ? { src: 'Toronto bunkhouse', text: `at the Toronto bunkhouse${bunk.rested ? `, rested ${bunk.rested}` : ''}`, busy: true }
          : away ? { src: 'away', text: 'away from Sarnia', busy: true }
            : back ? { src: 'returning', text: `coming home (${back})`, busy: true } : null;
    const seen = out || (line ? { src: 'crews in town', text: line.text.replace(/^[A-Z0-9]+( \(temporary\))?:\s*/, '') } : b || null);
    let text = seen ? seen.text : 'not on a board the checker reads';
    let status = 'available';
    let freeAt = null;
    if (seen && seen.busy) status = 'busy';
    else if (/day off|vacancy \(off the turn\)/.test(text)) status = 'off';
    else if (/out working on|B0|working another job|away \(term|temporary vacancy/.test(text)) status = 'busy';
    else if (/hold turn(?! until)/.test(text)) status = 'busy';
    const pl = /PL @ (\S+ \d{4})/.exec(text);
    if (pl && when(pl[1]) != null && when(pl[1]) <= now) status = 'off';
    for (const x of text.matchAll(/(?:rest|hold turn) until (\S+ \d{4})/g)) { const t = when(x[1]); if (t != null && (freeAt == null || t > freeAt)) freeAt = t; }
    if (seen && seen.rested && when(seen.rested) != null) freeAt = Math.max(freeAt ?? -Infinity, when(seen.rested));
    // Days off running at the check, on this job and craft.
    const off = (snap.daysOff || []).find((d) => d.turn === job.turn && (!d.craft || d.craft === job.craft) && (d.on || ((when(d.from) ?? Infinity) <= now && now < (when(d.until) ?? -Infinity))));
    if (off) { status = 'off'; text = `${text}; days off ${off.from} to ${off.until}`; }
    byRank[r.rank] = { status, freeAt: freeAt != null && freeAt > now ? T.localIso(freeAt) : '', text: `${job.turn}${job.craft && !job.assignment.endsWith(job.turn) ? ` ${job.craft}` : ''}${temp ? ' (temporary)' : ''}: ${text}`, src: seen ? seen.src : '' };
  }
  return { taken: snap.taken, byRank };
}

module.exports = { slotOf, due, keep, sig, withTemp, siteList, liveFacts, KEEP_PAST, MAX_TRIES };
