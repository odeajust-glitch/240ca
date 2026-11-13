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
//                            and the first check without it after that (gone),
//                            and the turns on its crew lines (crew: "S1 B111")
//   byTurn[turn][job/on]     a turn shown beside a craft on that run: a spare
//                            (or anyone with a turn of their own) working it
//   spare[job][on]           the crafts the vacancy list had for that run
//   booked[turn/craft/from]  Train Service 4's days off lines (any turn)
//   cover                    when the checks were running: [first, last] spans
//   bookoff[job]             each crew line of a yard job going from working
//                            ("status not known") to "on rest until …" in the
//                            crews in town (snapshot town): { line ("FO",
//                            "S1 (temporary)", "TT trainee"), w (the last check
//                            it was working), at (the first check on rest),
//                            until (the rest booked) } (owner, 2026-11-13:
//                            each person's own end and the rest they booked)
// A yard job's own history keeps one line per job, however many days it ran
// (found 2026-11-11 checking My stats), so the days come from here. gone,
// crew, spare, booked and cover are for the yard pieces on the test site
// (owner, 2026-11-13: real shift ends, days off, who was on the crew).
function collectYard(state, snapshots) {
  const runs = state.runs || (state.runs = {});
  const byTurn = state.byTurn || (state.byTurn = {});
  const spare = state.spare || (state.spare = {});
  const booked = state.booked || (state.booked = {});
  const cover = state.cover || (state.cover = []);
  const bookoff = state.bookoff || (state.bookoff = {});
  const working = state.working || (state.working = {}); // job|line → the last check it was working
  // The runs the snapshot before listed (a Map: in memory only, like the rest).
  let listed = state.listed || new Map();
  for (const s of snapshots || []) {
    const first = BoardTrains.toMin(s.taken);
    const last = BoardTrains.toMin(s.sameUntil || s.taken);
    if (first == null) continue;
    const span = cover[cover.length - 1];
    if (span && first - span[1] <= 30) span[1] = Math.max(span[1], last || first); else cover.push([first, last || first]);
    const now = new Map();
    for (const j of s.yardJobs || []) {
      const on = j.job && j.onDuty ? BoardTrains.toMin(BoardTrains.resolve(j.onDuty, s.taken)) : null;
      if (on == null) continue;
      const all = runs[j.job] || (runs[j.job] = {});
      const r = all[on] || (all[on] = { on, first, last });
      r.first = Math.min(r.first, first); r.last = Math.max(r.last, last || first);
      if (r.gone != null && r.gone <= first) delete r.gone; // listed again: it had not gone
      now.set(`${j.job}/${on}`, r);
      for (const c of String(j.crew || '').split(' · ').filter(Boolean)) {
        const w = c.trim().split(/\s+/);
        const turn = w[w.length - 1];
        const mine = byTurn[turn] || (byTurn[turn] = {});
        const e = mine[`${j.job}/${on}`] || (mine[`${j.job}/${on}`] = { job: j.job, on, cc: w[0], first, last });
        e.first = Math.min(e.first, first); e.last = Math.max(e.last, last || first);
        const k = `${w[0]} ${turn}`;
        if (!(r.crew || (r.crew = [])).includes(k)) r.crew.push(k);
      }
    }
    // Listed on the snapshot before and not on this one: it left the Call Board by this check.
    for (const [k, r] of listed) if (!now.has(k) && r.gone == null) r.gone = first;
    listed = now;
    for (const v of s.vacancies || []) {
      if (!v || !v.yard || !v.train || !v.cc || !v.at) continue;
      const on = BoardTrains.toMin(BoardTrains.resolve(v.at, s.taken));
      if (on == null) continue;
      const crafts = (spare[v.train] || (spare[v.train] = {}))[on] || (spare[v.train][on] = []);
      if (!crafts.includes(v.cc)) crafts.push(v.cc);
    }
    for (const t of s.town || []) {
      const job = t && t.turn; const m = /^([^:]+):\s*(.*)$/.exec((t && t.text) || '');
      if (!m || !/^YARD /.test(t.pool || '') || !/^Y[A-Z]{3}\d{2}$/.test(job || '')) continue;
      const key = `${job}|${m[1]}`;
      if (/^status not known$/.test(m[2])) { working[key] = last || first; continue; }
      const rest = /^on rest until (.+)$/.exec(m[2]);
      if (rest && working[key] != null) {
        const until = BoardTrains.toMin(BoardTrains.resolve(rest[1], s.taken));
        if (until != null) (bookoff[job] || (bookoff[job] = [])).push({ line: m[1], w: working[key], at: first, until });
      }
      delete working[key];
    }
    for (const d of s.daysOff || []) {
      const from = d && d.turn && d.from ? BoardTrains.toMin(BoardTrains.resolve(d.from, s.taken)) : null;
      if (from == null) continue;
      const until = d.until ? BoardTrains.toMin(BoardTrains.resolve(d.until, s.taken)) : null;
      booked[`${d.turn}/${d.craft || ''}/${from}`] = { turn: d.turn, craft: d.craft || '', from, until: until != null && until > from ? until : from + 24 * 60 };
    }
  }
  state.listed = listed;
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
    // The craft they are on a yard job as at the newest check (FO, S1, YA …): for days off on the test site.
    const yardCraft = (turn) => { const me = nowSeen && (nowSeen.seen || []).find((x) => x.h === h && x.turn === turn && x.craft); return me ? me.craft : ''; };
    const fresh = stretches && stretches.length ? MyStats.build({
      stretches, turns, trains, offs: resets.offs || {}, resets: (resets.people || {})[h] || [], due: dueOf[h] || null,
      sleep: analytics.sleep || [], runLog: analytics.runLog || [], stale: analytics.stale || [], craftNow, tracker: tracker(h, stretches), yardCraft,
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
function pools(kept, { days = 28, yard = null } = {}) {
  const recs = Object.values(kept.people || {});
  const to = recs.reduce((m, r) => (r.to > m ? r.to : m), '');
  if (!to) return { from: '', to: '', pools: {}, yard: null };
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 864e5).toISOString().slice(0, 10);
  // yard: the yard workers' average and middle half for "You and the yard" on the test site (owner, 2026-11-13;
  // the same rules: 5 people or nothing, no one's own figure). The old page reads only `pools`.
  const lenOf = MyStats.lengthOf(Object.fromEntries(yardJobs(yard).jobs.map((j) => [j.job, j.length])));
  return { from, to, pools: MyStats.poolSummary(recs.map((r) => MyStats.poolFigures(r, { from, to }))), yard: MyStats.yardSummary(recs.map((r) => MyStats.yardFigures(r, { from, to }, lenOf))) };
}

// How each yard job really runs, by when it left the Call Board (owner, 2026-11-13: "how each yard job really
// runs", for bidding; the test site's My stats). The job's runs, never anyone's own: its usual on-duty time, its
// length (12 h where its runs usually go 10 h or more, else 8 h: MyStats.lengthFrom), how many runs the checks
// saw and how many had a trusted end (MyStats.boardEnd), the middle length, how many ran 15 min or more past its
// length, how many ended 30 min or more early, the longest. Goes out as data/yardjobs.json.
function yardJobs(yard, { now = null } = {}) {
  const jobs = [];
  let from = null; let to = null;
  for (const [job, runs] of Object.entries((yard && yard.runs) || {})) {
    const list = Object.values(runs).filter((r) => r.on != null).sort((a, b) => a.on - b.on);
    if (!list.length) continue;
    const starts = new Map();
    for (const r of list) { const m = ((r.on % 1440) + 1440) % 1440; starts.set(m, (starts.get(m) || 0) + 1); }
    let start = null; for (const [m, k] of starts) if (start == null || k > starts.get(start)) start = m;
    const ends = list.map((r) => { const e = MyStats.boardEnd(r, r.on, job); return e == null ? null : e - r.on; }).filter((x) => x != null).sort((a, b) => a - b);
    const len = MyStats.lengthFrom(job, ends); // 12 h where its runs usually go 10 h or more, else 8 h
    const mid = ends.length ? (ends.length % 2 ? ends[ends.length >> 1] : Math.round((ends[ends.length / 2 - 1] + ends[ends.length / 2]) / 2)) : null;
    jobs.push({ job, start: `${String(Math.floor(start / 60)).padStart(2, '0')}${String(start % 60).padStart(2, '0')}`, length: len, runs: list.length, timed: ends.length,
      median: mid, over: ends.filter((x) => x >= len + 15).length, early: ends.filter((x) => x <= len - 30).length, longest: ends.length ? ends[ends.length - 1] : null });
    from = from == null ? list[0].on : Math.min(from, list[0].on); to = to == null ? list[list.length - 1].on : Math.max(to, list[list.length - 1].on);
  }
  jobs.sort((a, b) => (a.job < b.job ? -1 : 1));
  const day = (m) => (m == null ? '' : BoardTrains.fromMin(m).slice(0, 10));
  return { from: day(from), to: day(to), ...(now ? { generatedAt: now } : {}), jobs };
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

module.exports = { load, update, write, save, trackerOf, collectYard, pools, yardJobs, KEEP_DAYS, DIR };
