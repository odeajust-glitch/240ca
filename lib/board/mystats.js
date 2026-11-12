// My stats, the laptop's side (owner, 2026-11-11: each member's own
// statistics, "only available to the person who owns the account"). Each
// site build works out every person's record (public/board-mystats.js
// build), joins it to what was kept from earlier builds
// (BoardChecker\my-stats.json, so the page reaches back past the days the
// site keeps), and writes one file per person, by name-code hash, to
// <site>/accounts/stats/<hash>.json. The publish puts them in the bucket
// under accounts/, which the Worker never serves as a file and the mirror
// never deletes; the Worker's /auth/stats hands a signed-in member only
// the one for the name code on their own account. Hashes only, no names.
const fs = require('fs');
const path = require('path');
const MyStats = require('../../public/board-mystats');

const Resets = require('./resets');

const BoardTrains = require('../../public/board-trains');

const KEEP_DAYS = 400;
const DIR = path.join('accounts', 'stats');

function load(file) {
  try { const a = JSON.parse(fs.readFileSync(file, 'utf8')); return a && a.v === MyStats.V && a.people ? a : { v: MyStats.V, people: {} }; } catch { return { v: MyStats.V, people: {} }; }
}

// Every run of every yard job as the Call Board listed it, from the site's
// snapshots (fed a day at a time, like the other collectors in site.js):
//   runs[job][on]            when that run was on the Call Board (first, last)
//   byTurn[turn][job/on]     a turn shown beside a craft on that run: a spare
//                            (or anyone with a turn of their own) working it
// A yard job's own history keeps one line per job, however many days it ran
// (found 2026-11-11 checking My stats), so the days come from here.
function collectYard(state, snapshots) {
  const runs = state.runs || (state.runs = {});
  const byTurn = state.byTurn || (state.byTurn = {});
  for (const s of snapshots || []) {
    const first = BoardTrains.toMin(s.taken);
    const last = BoardTrains.toMin(s.sameUntil || s.taken);
    if (first == null) continue;
    for (const j of s.yardJobs || []) {
      const on = j.job && j.onDuty ? BoardTrains.toMin(BoardTrains.resolve(j.onDuty, s.taken)) : null;
      if (on == null) continue;
      const all = runs[j.job] || (runs[j.job] = {});
      const r = all[on] || (all[on] = { on, first, last });
      r.first = Math.min(r.first, first); r.last = Math.max(r.last, last || first);
      for (const c of String(j.crew || '').split(' · ').filter(Boolean)) {
        const w = c.trim().split(/\s+/);
        const turn = w[w.length - 1];
        const mine = byTurn[turn] || (byTurn[turn] = {});
        const e = mine[`${j.job}/${on}`] || (mine[`${j.job}/${on}`] = { job: j.job, on, cc: w[0], first, last });
        e.first = Math.min(e.first, first); e.last = Math.max(e.last, last || first);
      }
    }
  }
  return state;
}

// What the reset tracker read, for one person at a time (owner, 2026-11-11:
// "work every figure out again from the saved checks"; the names it reads off
// the Call Board turned out to be the only sure word on who worked what).
// acc: the reset tracker's merged day files (lib/board/resets.js). → (hash) =>
// the `tracker` board-mystats.js build() takes, or null without acc.
function trackerOf(acc, { yard = null, people = {} } = {}) {
  if (!acc) return () => null;
  const stamp = (m) => BoardTrains.fromMin(m);
  // Every train a name was read on: who, on which job, until when.
  const byTrain = new Map();
  for (const [h, trips] of Object.entries(acc.trips || {})) {
    for (const t of Object.values(trips)) {
      if (t.yard) continue;
      const list = byTrain.get(t.train) || byTrain.set(t.train, []).get(t.train);
      list.push({ h, on: t.on, job: t.job, last: t.last });
    }
  }
  return (h, stretches = []) => ({
    named: Object.values((acc.trips || {})[h] || {}),
    turnTrips: acc.turnTrips || {},
    taken: (train, on, keys) => (byTrain.get(train) || []).some((x) => x.h !== h && Math.abs(x.on - on) <= 1440 && keys.includes(x.job) && x.last >= x.on - 5),
    // The person's resets and next one due from a list of trips, by the reset
    // tracker's own rules (its trips set aside for these).
    resetsOf: (list) => {
      const trips = {};
      for (const t of list) trips[`${t.train}/${t.on}`] = { train: t.train, on: t.on, job: t.job, first: t.on, last: t.last, ...(t.yard ? { yard: true } : {}) };
      const view = { ...acc, trips: { [h]: trips }, turnTrips: {}, filled: {} };
      const one = { [h]: stretches };
      const mine = Object.entries(Resets.byTurn(view, one, acc.last)).find(([, r]) => r.h === h);
      return { resets: Resets.personResets(view, one, acc.last)[h] || [], due: mine ? { turn: mine[0], dueText: mine[1].dueText, level: mine[1].level || '' } : null };
    },
    // Still on the Call Board at the newest check: still on duty, no guess (as resets.js trainOffs).
    offOf: (trip, ownKey) => {
      const r = Resets.offDuty(trip, ownKey, acc);
      if (r.how === 'call board' && acc.last != null && trip.last >= acc.last - 10) return null;
      return { off: Math.min(r.off, trip.on + 16 * 60), how: r.how };
    },
    yardFrom: acc.yardFrom == null ? null : acc.yardFrom,
    now: acc.last == null ? null : acc.last,
    yard,
    // Someone else held that turn as their own then (so a turn on a yard job's crew lines is theirs, not this person's).
    heldByOther: (turn, on) => Object.entries(people).some(([k, list]) => k !== h && list.some((e) => e.own && e.turn === turn && e.from <= stamp(on + 60) && e.to >= stamp(on - 60))),
  });
}

// people, turns, trains, resets ({ people, turns, offs } as resets.json),
// analytics ({ sleep, runLog, stale }), nowSeen (people.json "now") as the
// site build has them; acc: the reset tracker's merged day files; since: the
// first day the build covers.
// → { people: { hash: record } } to keep, every person ever seen included.
function update(kept, { people = {}, turns = {}, trains = [], resets = {}, analytics = {}, nowSeen = null, acc = null, yard = null }, since, { keepDays = KEEP_DAYS } = {}) {
  const out = { v: MyStats.V, people: {} };
  const tracker = trackerOf(acc, { yard, people });
  const dueOf = {};
  for (const [turn, r] of Object.entries(resets.turns || {})) if (r && r.h && r.dueText) dueOf[r.h] = { turn, dueText: r.dueText, level: r.level || '' };
  for (const h of new Set([...Object.keys(kept.people || {}), ...Object.keys(people)])) {
    const stretches = people[h];
    const craftNow = (turn) => { const me = nowSeen && (nowSeen.seen || []).find((x) => x.h === h && x.turn === turn && x.craft); return me ? (me.craft === 'CO' ? 'CO' : 'EN') : ''; };
    const fresh = stretches && stretches.length ? MyStats.build({
      stretches, turns, trains, offs: resets.offs || {}, resets: (resets.people || {})[h] || [], due: dueOf[h] || null,
      sleep: analytics.sleep || [], runLog: analytics.runLog || [], stale: analytics.stale || [], craftNow, tracker: tracker(h, stretches),
    }) : null;
    const rec = MyStats.merge((kept.people || {})[h], fresh, since, { keepDays });
    if (rec && (rec.trips.length || rec.turns.length)) out.people[h] = rec;
  }
  return out;
}

// Each pool's average and middle half over the last four weeks, for "You and
// your pool" on the tab (owner, 2026-11-11: "pool averages and ranges only",
// never "another person's own numbers"). No hashes, no turns, and a figure is
// given only when at least five people in the pool have enough saved
// (board-mystats.js poolFigures / poolSummary). Goes out as data/pools.json.
function pools(kept, { days = 28 } = {}) {
  const recs = Object.values(kept.people || {});
  const to = recs.reduce((m, r) => (r.to > m ? r.to : m), '');
  if (!to) return { from: '', to: '', pools: {} };
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 864e5).toISOString().slice(0, 10);
  return { from, to, pools: MyStats.poolSummary(recs.map((r) => MyStats.poolFigures(r, { from, to }))) };
}

// One file per person; a file is only rewritten when its content changed,
// and one whose person is gone from the record is removed.
function write(outDir, kept) {
  const dir = path.join(outDir, DIR);
  fs.mkdirSync(dir, { recursive: true });
  const live = new Set();
  for (const [h, rec] of Object.entries(kept.people || {})) {
    if (!/^[0-9a-f]{16}$/.test(h)) continue;
    const file = path.join(dir, `${h}.json`);
    const body = JSON.stringify(rec);
    live.add(`${h}.json`);
    let was = null;
    try { was = fs.readFileSync(file, 'utf8'); } catch { /* new */ }
    if (was !== body) fs.writeFileSync(file, body);
  }
  for (const f of fs.readdirSync(dir)) if (!live.has(f)) fs.rmSync(path.join(dir, f), { force: true });
  return live.size;
}

const save = (file, kept) => { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(kept)); fs.renameSync(tmp, file); };

module.exports = { load, update, write, save, trackerOf, collectYard, pools, KEEP_DAYS, DIR };
