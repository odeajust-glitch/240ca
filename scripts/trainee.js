// Put a trainee on their turn by hand (owner, 2026-11-04: "Can you fix it so
// Wade shows in S501 now": he was last seen before the checker knew to keep
// trainees, and Garnet / Toronto screens never list TT / ET). The checker
// then keeps them on the slot while the turn is away, like one it saw
// itself (lib/board/trainees.js). Names never stored: only the code's hash.
//   node scripts/trainee.js add WADE S501 TT
//   node scripts/trainee.js remove WADE
//   node scripts/trainee.js list
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../lib/board/paths');
const People = require('../lib/board/people');

const FILE = path.join(DATA_DIR, 'trainees.json');
const load = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const save = (m) => fs.writeFileSync(FILE, JSON.stringify(m));
const [cmd, code0, turn0, craft0] = process.argv.slice(2);
const code = String(code0 || '').toUpperCase();
const usage = () => { console.log('Use: node scripts/trainee.js add WADE S501 TT   |   remove WADE   |   list'); process.exit(1); };

if (cmd === 'list') {
  const m = load();
  const rows = Object.values(m);
  console.log(rows.length ? rows.map((t) => `${t.slot} (since ${new Date(t.seen || t.at).toLocaleString('en-CA')})`).join('\n') : 'No trainees kept right now.');
} else if (cmd === 'add') {
  const turn = String(turn0 || '').toUpperCase();
  const craft = String(craft0 || '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(code) || !/^[A-Z][A-Z0-9]\d{2}$/.test(turn) || !/^(TT|ET)$/.test(craft)) usage();
  const m = load();
  const now = Date.now();
  m[People.personHash(code)] = { slot: `${turn}-${craft}`, base: turn, craft, at: now, seen: now, byHand: true };
  save(m);
  console.log(`${code} kept on ${turn} · ${craft} (trainee) from the next check, while ${turn} is away; let go 30 min after it's back in Sarnia unless crews in town shows ${code} there.`);
} else if (cmd === 'remove') {
  if (!/^[A-Z]{4}$/.test(code)) usage();
  const m = load();
  const h = People.personHash(code);
  console.log(m[h] ? `${code} taken off ${m[h].slot}.` : `${code} wasn't kept.`);
  delete m[h];
  save(m);
} else usage();
