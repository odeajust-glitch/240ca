// Long-term memory for the Analytics tab (owner, 2026-10-26: "keep more than
// 30 days"). The site only keeps BOARD_SITE_DAYS of snapshots, so each build
// also saves what Analytics needs, small, in BoardChecker\analytics-archive.json:
// the trains (no event lists), the trains each turn worked, when each turn
// went spare or rested, people's turn stretches (hashes only, as on the
// site), runarounds, jobs going spare and the sleep tracker's calls. Kept
// BOARD_ARCHIVE_DAYS (365).
//
// Each build: what started before the site's first day comes from the
// archive as it was (it saw the start), everything else from the build
// itself; something in both counts once (BoardAnalytics.joinOld). The site
// gets data/archive.json: only what started before its first day, which the
// page joins to what it already has the same way.
const fs = require('fs');
const BoardTrains = require('../../public/board-trains');
const { joinOld } = require('../../public/board-analytics');

const KEEP_DAYS = 365;
const LISTS = ['trains', 'runarounds', 'spareJobs', 'sleep'];
const BY_TURN = ['work', 'spares', 'rests'];
const EMPTY = () => ({ v: 2, trains: [], work: {}, spares: {}, rests: {}, people: {}, runarounds: [], spareJobs: [], sleep: [] });

// When each thing started (what decides old or new) and how old it is (pruning).
const startOf = {
  trains: (r) => r.firstSeen || r.onDuty || '', work: (o) => o.at || '', spares: (x) => x.seen, rests: (x) => x.seen,
  people: (e) => e.from, runarounds: (r) => r.taken, spareJobs: (j) => j.first, sleep: (z) => z.firstSeen || z.onDuty,
};
const ageOf = { ...startOf, trains: (r) => r.onDuty || r.firstSeen || '', sleep: (z) => z.onDuty, spares: (x) => x.last || x.seen };

function load(file) {
  let a;
  try { a = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return EMPTY(); }
  if (a.v === 2) return { ...EMPTY(), ...a };
  // The first version (2026-10-26, same day): keyed objects, stamps only.
  const vals = (o) => Object.values(o || {});
  const out = EMPTY();
  for (const k of LISTS) out[k] = vals(a[k]);
  for (const [t, w] of Object.entries(a.work || {})) out.work[t] = vals(w);
  for (const [t, l] of Object.entries(a.spares || {})) out.spares[t] = l.map((s) => (typeof s === 'string' ? { seen: s, last: s, text: '' } : s));
  for (const [t, l] of Object.entries(a.rests || {})) out.rests[t] = l.map((s) => (typeof s === 'string' ? { seen: s, until: '', kind: '' } : s));
  out.people = a.people || {};
  return out;
}

// A train row without what only the Order summary uses.
function slimTrain(r) {
  const keep = ['id', 'month', 'day', 'from', 'deadhead', 'firstSeen', 'firstPlan', 'firstOrder', 'onDuty', 'station', 'crew', 'orderChanges',
    'offPlan', 'offOrder', 'timeOnDuty', 'heldMin', 'stillHeld', 'flag', 'predHit'];
  const out = Object.fromEntries(keep.filter((k) => r[k] != null && r[k] !== '' && r[k] !== false).map((k) => [k, r[k]]));
  if (r.gone && !r.onDuty) out.gone = r.gone;
  return out;
}

// The trains a turn worked (as Turn History's work history counts them).
function workOf(rec) {
  return (rec.orders || []).filter((o) => o.onDuty && !o.workedBy).map((o) => ({
    train: o.train, at: BoardTrains.resolve(o.onDutyAt, o.onDutySeen) || o.onDutySeen, seen: o.onDutySeen,
    crew: o.crew || '', station: o.station || '', job: o.job || '', yard: !!o.yard,
  }));
}

// This build's data in the archive's shape.
function partsOf({ trains = [], turns = {}, people = {}, insights = {} }) {
  const p = EMPTY();
  p.trains = trains.map(slimTrain);
  for (const [turn, rec] of Object.entries(turns)) {
    const w = workOf(rec);
    if (w.length) p.work[turn] = w;
    if ((rec.spares || []).length) p.spares[turn] = rec.spares.map(({ seen, last, text }) => ({ seen, last, text }));
    if ((rec.rests || []).length) p.rests[turn] = rec.rests.map(({ seen, until, kind }) => ({ seen, until, kind }));
  }
  p.people = JSON.parse(JSON.stringify(people));
  for (const k of ['runarounds', 'spareJobs', 'sleep']) p[k] = insights[k] || [];
  return p;
}

// The archive with only what passes keep(item, kind).
function filter(a, keep) {
  const out = EMPTY();
  for (const k of LISTS) out[k] = a[k].filter((x) => keep(x, k));
  for (const k of BY_TURN) {
    for (const [turn, list] of Object.entries(a[k])) { const kept = list.filter((x) => keep(x, k)); if (kept.length) out[k][turn] = kept; }
  }
  for (const [h, list] of Object.entries(a.people)) { const kept = list.filter((e) => keep(e, 'people')); if (kept.length) out.people[h] = kept; }
  return out;
}
const before = (since) => (x, k) => startOf[k](x) < since;

// The archive after this build. since: the site's first day ("2026-09-27").
function update(old, current, since, { now = new Date(), keepDays = KEEP_DAYS } = {}) {
  const older = filter(old, before(since));
  const cur = partsOf(current);
  const out = EMPTY();
  for (const k of LISTS) out[k] = joinOld(k, older[k], cur[k]);
  for (const k of BY_TURN) {
    for (const turn of new Set([...Object.keys(older[k]), ...Object.keys(cur[k])])) out[k][turn] = joinOld(k, older[k][turn], cur[k][turn]);
  }
  // Stretches overlapping the first day can show twice; the page counts work once (by train and time).
  for (const h of new Set([...Object.keys(older.people), ...Object.keys(cur.people)])) out.people[h] = [...(older.people[h] || []), ...(cur.people[h] || [])];
  const cutoff = new Date(now.getTime() - keepDays * 864e5).toISOString().slice(0, 10);
  return filter(out, (x, k) => { const st = ageOf[k](x); return !!st && st >= cutoff; });
}

// What the site publishes: only what started before its own first day.
function forSite(archive, since) {
  return { since, ...filter(archive, before(since)) };
}

// F7 (2026-10-26): published as one file per month (by when each thing
// started), so the page only fetches the months its dates need.
// → { index: { since, months }, parts: { '2026-08': part } }
function byMonth(site) {
  const parts = {};
  const part = (m) => parts[m] || (parts[m] = { ...EMPTY(), month: m });
  for (const k of LISTS) for (const x of site[k]) part(startOf[k](x).slice(0, 7))[k].push(x);
  for (const k of BY_TURN) {
    for (const [turn, list] of Object.entries(site[k])) for (const x of list) { const p = part(startOf[k](x).slice(0, 7)); (p[k][turn] ||= []).push(x); }
  }
  for (const [h, list] of Object.entries(site.people)) for (const e of list) { const p = part(e.from.slice(0, 7)); (p.people[h] ||= []).push(e); }
  return { index: { since: site.since, months: Object.keys(parts).sort() }, parts };
}

function save(file, archive) {
  fs.writeFileSync(file, JSON.stringify(archive));
}

module.exports = { load, save, update, forSite, byMonth, slimTrain, workOf, KEEP_DAYS };
