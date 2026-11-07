// Upcoming days off (Train Service 4; owner, 2026-11-05). Each line is
// taken as one day off: 24 h from the time shown (config.daysOffMinutes),
// until the owner says otherwise. A line can leave the "upcoming" list once
// the day off has started, so every line seen is remembered until it ends
// (BoardChecker\days-off.json; turn, craft and times only, no names).
// A turn off for a train (plFor below) still takes it and goes spare (every
// pool; owner, 2026-11-05: "it will go spare"), a spare off for a job is
// passed over, and the runaround log explains it. 24–36 h before a road
// job's PL: the spare who'd cover it is warned.
const fs = require('fs');
const config = require('./config');
const { fmt } = require('./time');

const minutes = () => config.daysOffMinutes || 24 * 60;
// Engineer (EN, LE) or conductor side. A trainee (ET / TT) is a side of
// its own and never put on a row (owner, 2026-11-05: "their jobs never go
// spare … they do not need to be replaced"): listed, nothing else.
const side = (craft) => (/^(ET|TT)$/.test(craft || '') ? 'trainee' : /^(EN|LE)$/.test(craft || '') ? 'en' : 'co');
const key = (d) => `${d.turn}/${d.craft}/${d.from}`;
const untilOf = (d) => d.until ?? d.from + minutes();

// The lines read this check plus the remembered ones, minus those over.
// wasRead (screen 4 read this check): a remembered line not started yet
// that's no longer listed was withdrawn and is dropped (owner, 2026-11-07:
// SD08 called to withdraw a PL and the site still showed it). Started ones
// are kept: they can leave the list once they start.
function merge(known = [], read = [], now, wasRead = false) {
  const all = new Map();
  const listed = new Set((read || []).map(key));
  const keep = (d) => !wasRead || now == null || d.from <= now || listed.has(key(d));
  for (const d of [...(known || []).filter(keep), ...(read || [])]) all.set(key(d), { ...d, until: untilOf(d) });
  return [...all.values()].filter((d) => now == null || d.until > now).sort((a, b) => a.from - b.from || a.turn.localeCompare(b.turn));
}

// Puts each turn's days off on its rows: rows[i].off = [{ from, until }].
// sideOf(row) → 'en' / 'co' (a pool row's craft, or the board it's on).
function attach(rows, daysOff, sideOf) {
  if (!daysOff || !daysOff.length) return;
  for (const r of rows || []) {
    const off = daysOff.filter((d) => d.turn === r.turn && side(d.craft) !== 'trainee' && side(d.craft) === sideOf(r)).map((d) => ({ from: d.from, until: untilOf(d) }));
    if (off.length) r.off = off;
  }
}

// Whether a PL keeps a row off a job called at `call` (owner, 2026-11-05):
//   already on at the call                → off
//   yard job (opts.yardMin long) running into the PL → off ("its A")
//   road job: PL starts 24 h or less after going on duty → off (goes
//     spare 100%); 24–36 h → 'maybe' (the person who'd take the job if it
//     went spare is warned)
// Going on duty = call + 2 h (config.callLeadMinutes).
const H = 60;
function plFor(row, call, { yardMin = null } = {}) {
  let best = null;
  const start = call + (config.callLeadMinutes || 120);
  for (const o of (row && row.off) || []) {
    if (o.until <= call) continue;
    const lead = o.from - start;
    const level = o.from <= call ? 'off'
      : yardMin != null ? (o.from < start + yardMin ? 'off' : null)
        : lead <= 24 * H ? 'off' : lead <= 36 * H ? 'maybe' : null;
    if (!level) continue;
    const hit = { ...o, lead: o.from <= call ? null : lead, level };
    if (level === 'off') return hit;
    best = best || hit;
  }
  return best;
}
// The PL that keeps a row off the job, or null.
const offAt = (row, call, opts) => { const x = plFor(row, call, opts); return x && x.level === 'off' ? x : null; };
// A road job's PL 24–36 h after going on duty: it may go spare.
const maybeOff = (row, call) => { const x = plFor(row, call); return x && x.level === 'maybe' ? x : null; };
// "PL @ 6th 0001", as the owner reads it (2026-11-05); with how long after
// going on duty it starts when it hasn't started by the call.
const hrs = (m) => { const h = Math.floor(m / 60); const mm = m % 60; return mm ? `${h} h ${mm} m` : `${h} h`; };
const offText = (o) => `PL @ ${fmt(o.from)}${o.lead != null ? ` (${o.lead <= 0 ? 'before going on duty' : `${hrs(o.lead)} after going on duty`})` : ''}`;

function load(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')).daysOff || []; } catch { return []; }
}
function save(file, list) {
  fs.writeFileSync(file, JSON.stringify({ daysOff: list }, null, 2));
}

module.exports = { merge, attach, plFor, offAt, maybeOff, offText, side, untilOf, load, save };
