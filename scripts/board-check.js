// Reads a board-probe summary.json and says when you go to work while you
// wait in Sarnia. --details shows the full working behind the answer.
//
//   node scripts/board-check.js probe-out/summary.json --me SR03
//   node scripts/board-check.js summary.json --me SR03 --now 2026-10-14T16:17
//   node scripts/board-check.js summary.json --me SR03 --details   (full working)
//
// It only reads the file; it never logs in or touches CATS.
const fs = require('fs');
const { loadSummary } = require('../lib/board/summary');
const { runBoardCheck } = require('../lib/board/engine');
const { formatReport } = require('../lib/board/report');
const { at } = require('../lib/board/time');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const file = process.argv[2];
  if (!file || file.startsWith('--')) {
    console.error('Usage: node scripts/board-check.js <summary.json> [--me SR03] [--now YYYY-MM-DDTHH:MM]');
    process.exit(1);
  }
  let now;
  const nowArg = arg('--now');
  if (nowArg) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(nowArg);
    if (!m) throw new Error('--now must look like 2026-10-14T16:17');
    now = at(+m[1], +m[2], +m[3], +m[4], +m[5]);
  }
  const input = loadSummary(JSON.parse(fs.readFileSync(file, 'utf8')), { now });
  const result = runBoardCheck({ ...input, me: arg('--me') });
  console.log(formatReport(result, input.seen, { details: process.argv.includes('--details') }));
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
