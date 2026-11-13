// One-time fill of past off-duty times (owner, 2026-11-04: "run a one time
// script that gets you off duty times all the way back to a certain date …
// goto the screen … enter the date we need to go back to and then just f8").
// The running checker does it on its next check (it has CATS open): 3 → 7,
// POOL S1 then S5, HOME/AWAY 1, START DATE = this date, F8 to the end.
//   node scripts/assign-backfill.js 2026-10-16      (or 261016)
// The yard jobs' O-T the same way (3 → 7 with YD; owner, 2026-11-13): add
// "yard". The checker reads the yard from 26 October by itself the first time.
//   node scripts/assign-backfill.js 2026-10-26 yard
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../lib/board/paths');

const arg = String(process.argv[2] || '').trim();
let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(arg);
const start = m ? `${m[1].slice(2)}${m[2]}${m[3]}` : /^\d{6}$/.test(arg) ? arg : null;
if (!start) { console.log('Use: node scripts/assign-backfill.js 2026-10-16   (add "yard" for the yard jobs)'); process.exit(1); }
if (/^yard$/i.test(String(process.argv[3] || ''))) {
  fs.writeFileSync(path.join(DATA_DIR, 'yard-backfill.json'), JSON.stringify({ start, asked: new Date().toISOString() }));
  console.log(`Asked: on its next check the board checker reads the yard jobs' assignment history (3 → 7, YD) from ${start} to now, paging to the end. It says "Yard assignment history backfill …" in its window when done.`);
  process.exit(0);
}
fs.writeFileSync(path.join(DATA_DIR, 'assign-backfill.json'), JSON.stringify({ start, asked: new Date().toISOString() }));
console.log(`Asked: on its next check the board checker reads the assignment history (3 → 7) from ${start} to now, S1 and S5, paging to the end. It says "Assignment history backfill …" in its window when done.`);
