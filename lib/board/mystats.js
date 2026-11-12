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

const KEEP_DAYS = 400;
const DIR = path.join('accounts', 'stats');

function load(file) {
  try { const a = JSON.parse(fs.readFileSync(file, 'utf8')); return a && a.v === MyStats.V && a.people ? a : { v: MyStats.V, people: {} }; } catch { return { v: MyStats.V, people: {} }; }
}

// people, turns, trains, resets ({ people, turns, offs } as resets.json),
// analytics ({ sleep, runLog, stale }), nowSeen (people.json "now") as the
// site build has them; since: the first day the build covers.
// → { people: { hash: record } } to keep, every person ever seen included.
function update(kept, { people = {}, turns = {}, trains = [], resets = {}, analytics = {}, nowSeen = null }, since, { keepDays = KEEP_DAYS } = {}) {
  const out = { v: MyStats.V, people: {} };
  const dueOf = {};
  for (const [turn, r] of Object.entries(resets.turns || {})) if (r && r.h && r.dueText) dueOf[r.h] = { turn, dueText: r.dueText, level: r.level || '' };
  for (const h of new Set([...Object.keys(kept.people || {}), ...Object.keys(people)])) {
    const stretches = people[h];
    const craftNow = (turn) => { const me = nowSeen && (nowSeen.seen || []).find((x) => x.h === h && x.turn === turn && x.craft); return me ? (me.craft === 'CO' ? 'CO' : 'EN') : ''; };
    const fresh = stretches && stretches.length ? MyStats.build({
      stretches, turns, trains, offs: resets.offs || {}, resets: (resets.people || {})[h] || [], due: dueOf[h] || null,
      sleep: analytics.sleep || [], runLog: analytics.runLog || [], stale: analytics.stale || [], craftNow,
    }) : null;
    const rec = MyStats.merge((kept.people || {})[h], fresh, since, { keepDays });
    if (rec && (rec.trips.length || rec.turns.length)) out.people[h] = rec;
  }
  return out;
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

module.exports = { load, update, write, save, KEEP_DAYS, DIR };
