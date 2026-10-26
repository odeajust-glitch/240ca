// Long-term memory for the Analytics tab (owner, 2026-10-26: "keep more than
// 30 days"). The site only keeps BOARD_SITE_DAYS of snapshots, so each build
// also saves what Analytics needs, small, in BoardChecker\analytics-archive.json:
// the trains (no event lists), the trains each turn worked, when each turn
// went spare or rested, people's turn stretches (hashes only, as on the
// site), runarounds and jobs going spare. Kept BOARD_ARCHIVE_DAYS (365).
//
// Each build: what's older than the site's first day comes from the archive
// as it was, everything newer from the build itself (so nothing is counted
// twice). The site gets data/archive.json: only the part older than its first
// day, which the page adds to what it already has.
const fs = require('fs');
const BoardTrains = require('../../public/board-trains');

const KEEP_DAYS = 365;
const EMPTY = () => ({ trains: {}, work: {}, spares: {}, rests: {}, people: {}, runarounds: {}, spareJobs: {} });

function load(file) {
  try {
    const a = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...EMPTY(), ...a };
  } catch {
    return EMPTY();
  }
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

// Each part, keyed, with the stamp that says how old it is.
function partsOf({ trains = [], turns = {}, people = {}, insights = { runarounds: [], spareJobs: [] } }) {
  const p = EMPTY();
  for (const r of trains) p.trains[`${r.id} ${r.month}`] = slimTrain(r);
  for (const [turn, rec] of Object.entries(turns)) {
    const w = workOf(rec);
    if (w.length) p.work[turn] = Object.fromEntries(w.map((o) => [`${o.train}|${o.at}`, o]));
    if ((rec.spares || []).length) p.spares[turn] = rec.spares.map((x) => x.seen);
    if ((rec.rests || []).length) p.rests[turn] = rec.rests.map((x) => x.seen);
  }
  p.people = JSON.parse(JSON.stringify(people));
  for (const r of insights.runarounds) p.runarounds[`${r.train}|${r.taken}`] = r;
  for (const j of insights.spareJobs) p.spareJobs[`${j.train}|${j.turn}|${j.first}`] = j;
  return p;
}
const stampOf = {
  trains: (r) => r.onDuty || r.firstSeen || '',
  work: (o) => o.at || '',
  runarounds: (r) => r.taken,
  spareJobs: (j) => j.first,
};

// Keeps the parts of `a` passing keep(stamp).
function filter(a, keep) {
  const out = EMPTY();
  for (const k of ['trains', 'runarounds', 'spareJobs']) out[k] = Object.fromEntries(Object.entries(a[k]).filter(([, v]) => keep(stampOf[k](v))));
  for (const [turn, w] of Object.entries(a.work)) {
    const kept = Object.entries(w).filter(([, o]) => keep(o.at));
    if (kept.length) out.work[turn] = Object.fromEntries(kept);
  }
  for (const k of ['spares', 'rests']) {
    for (const [turn, list] of Object.entries(a[k])) { const kept = list.filter(keep); if (kept.length) out[k][turn] = kept; }
  }
  for (const [h, list] of Object.entries(a.people)) { const kept = list.filter((e) => keep(e.from)); if (kept.length) out.people[h] = kept; }
  return out;
}

// The archive after this build. since: the site's first day ("2026-09-27").
function update(old, current, since, { now = new Date(), keepDays = KEEP_DAYS } = {}) {
  const older = filter(old, (st) => st < since);
  const cur = partsOf(current);
  const out = EMPTY();
  for (const k of ['trains', 'runarounds', 'spareJobs']) out[k] = { ...older[k], ...cur[k] };
  for (const turn of new Set([...Object.keys(older.work), ...Object.keys(cur.work)])) out.work[turn] = { ...older.work[turn], ...cur.work[turn] };
  for (const k of ['spares', 'rests']) {
    for (const turn of new Set([...Object.keys(older[k]), ...Object.keys(cur[k])])) out[k][turn] = [...new Set([...(older[k][turn] || []), ...(cur[k][turn] || [])])].sort();
  }
  for (const h of new Set([...Object.keys(older.people), ...Object.keys(cur.people)])) out.people[h] = [...(older.people[h] || []), ...(cur.people[h] || [])];
  const cutoff = new Date(now.getTime() - keepDays * 864e5).toISOString().slice(0, 10);
  return filter(out, (st) => !!st && st >= cutoff);
}

// What the site publishes: only what's older than its own first day, as lists.
function forSite(archive, since) {
  const a = filter(archive, (st) => st < since);
  return {
    since,
    trains: Object.values(a.trains),
    work: Object.fromEntries(Object.entries(a.work).map(([t, w]) => [t, Object.values(w)])),
    spares: a.spares,
    rests: a.rests,
    people: a.people,
    runarounds: Object.values(a.runarounds),
    spareJobs: Object.values(a.spareJobs),
  };
}

function save(file, archive) {
  fs.writeFileSync(file, JSON.stringify(archive));
}

module.exports = { load, save, update, forSite, slimTrain, workOf, KEEP_DAYS };
