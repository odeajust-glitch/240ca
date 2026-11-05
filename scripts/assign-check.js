// What the checker saved from the assignment history (3 → 7) and what the
// reader makes of it (owner, 2026-11-04: pages saved, no off duty came out).
//   node scripts/assign-check.js            (the newest saved check that has one)
const fs = require('fs');
const path = require('path');
const { HISTORY_DIR } = require('../lib/board/paths');
const { parseGrid } = require('../lib/board/grid');
const S = require('../lib/board/screens');

const days = fs.readdirSync(HISTORY_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
for (const d of days) {
  const files = fs.readdirSync(path.join(HISTORY_DIR, d)).filter((f) => f.endsWith('.json')).sort().reverse();
  for (const f of files) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, d, f), 'utf8')); } catch { continue; }
    const pages = (j.screens || []).filter((x) => x.label === 'assignHistory');
    if (!pages.length) continue;
    console.log(`${d}\\${f}: ${pages.length} assignment history page(s)\n`);
    const rows = parseGrid(pages[0].screenGrid || []);
    console.log('First page, as saved:');
    for (const r of rows.slice(0, 14)) console.log(`  |${r.text}|`);
    console.log(`\nRecognised as the screen: ${S.isAssignHistory(rows.map((r) => r.text).join('\n'))}`);
    const got = pages.flatMap((p) => S.parseAssignHistory(parseGrid(p.screenGrid || [])));
    console.log(`Trains read from all pages: ${got.length}`);
    for (const t of got.slice(0, 5)) console.log(`  ${t.train}  on ${t.on}  duty ${t.duty}`);
    process.exit(0);
  }
}
console.log('No saved check has an assignment history page.');
