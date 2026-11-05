// Upcoming days off (Train Service 4; owner, 2026-11-05). Each line is
// taken as one day off: 24 h from the time shown (config.daysOffMinutes),
// until the owner says otherwise. A line can leave the "upcoming" list once
// the day off has started, so every line seen is remembered until it ends
// (BoardChecker\days-off.json; turn, craft and times only, no names).
// A turn off at a train's call still takes its train and goes spare (every
// pool; owner, 2026-11-05: "it will go spare"), a spare on days off is
// passed over, and the runaround log explains it.
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
function merge(known = [], read = [], now) {
  const all = new Map();
  for (const d of [...(known || []), ...(read || [])]) all.set(key(d), { ...d, until: untilOf(d) });
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

// The day off a row is on at `call`, or null.
const offAt = (row, call) => (row && row.off ? row.off.find((o) => o.from <= call && call < o.until) || null : null);
// "PL @ 6th 0001", as the owner reads it (2026-11-05).
const offText = (o) => `PL @ ${fmt(o.from)}`;

function load(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')).daysOff || []; } catch { return []; }
}
function save(file, list) {
  fs.writeFileSync(file, JSON.stringify({ daysOff: list }, null, 2));
}

module.exports = { merge, attach, offAt, offText, side, untilOf, load, save };
