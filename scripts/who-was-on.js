// Who was on a turn: every name this laptop has read on it (owner,
// 2026-11-14: "Can you see who was bumped in each situation or make it so you
// can"). From BoardChecker\names.json: the Call Board crews by train (kept 45
// days) and what the turn's own board row shows now. Printed here only: the
// names never leave the laptop.
//
//   node scripts/who-was-on.js S502-CO SB03 SD05 SD01
//
// A 501/502 turn takes its craft (S502-CO, S501-EN). A train's crew can be a
// spare filling in, so read it beside the dates the holder had the turn.
const { NAMES_FILE } = require('../lib/board/paths');
const { loadNames, namesOnTurn } = require('../lib/board/names');

const turns = process.argv.slice(2);
if (!turns.length) {
  console.log('Type the turns after it, e.g.: node scripts/who-was-on.js S502-CO SB03 SD05 SD01');
  process.exit(1);
}
const store = loadNames(NAMES_FILE);
const when = (iso) => new Date(iso).toLocaleString('en-CA', { timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
for (const turn of turns) {
  const seen = namesOnTurn(store, turn);
  console.log(`\n${turn.toUpperCase()}: ${seen.length ? '' : 'no names kept for it'}`);
  for (const s of seen) console.log(`  ${when(s.seen).padEnd(16)} ${s.name.padEnd(24)} ${s.craft ? `${s.craft}, ` : ''}${s.where}`);
}
