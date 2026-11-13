// The likely-call test, read train by train (13 Nov 2026, for the owner's question "would the call prediction be
// effective with the data you have now"). Replays every check exactly as Patterns.score does (the counts match
// data/patterns.json score to the check), then splits them the way the totals hide: by train, own history or
// not, and how often someone trusting a later "likely time" would have been called near or before the line-up's call.
// Reads only; changes nothing. Usage: node docs/board-checker/likely-call/per-train.js path/to/data/trains.json
const fs = require('fs'); const Module = require('module'); const path = require('path');
const file = path.join(__dirname, '../../../lib/board/patterns.js');
const m = new Module(file, module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
m._compile(`${fs.readFileSync(file, 'utf8')}\nmodule.exports.runFigures = runFigures; module.exports.quantile = quantile; module.exports.MIN_RUNS = MIN_RUNS; module.exports.WIDE = WIDE; module.exports.TEST_FROM = TEST_FROM;`, file);
const { runFigures, quantile: q, MIN_RUNS, WIDE, TEST_FROM } = m.exports;
const BT = require('../../../public/board-trains');

const runs = JSON.parse(fs.readFileSync(process.argv[2] || 'data/trains.json', 'utf8')).trains.map(runFigures).filter(Boolean).sort((a, b) => a.od - b.od);
const checks = []; // miss = real on duty − shown order; the line-up's call is at miss −15, the likely time at mid
for (const r of runs) {
  for (const [b, x] of Object.entries(r.figs)) {
    const prior = runs.filter((o) => o.od < x.at && o.figs[b]);
    const own = prior.filter((o) => o.sym === r.sym).map((o) => o.figs[b].miss);
    const a = own.length >= MIN_RUNS ? own : prior.map((o) => o.figs[b].miss);
    if (a.length >= MIN_RUNS) checks.push({ id: r.id, sym: r.sym, od: r.od, b, miss: x.miss, lo: q(a, WIDE[0]), hi: q(a, WIDE[1]), mid: q(a, 0.5), own: own.length >= MIN_RUNS });
  }
}
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '—');
const h = (min) => `${(min / 60).toFixed(1)} h`;
function line(name, l) {
  if (!l.length) return;
  const n = l.length;
  const held = l.filter((c) => c.miss >= c.lo && c.miss <= c.hi).length;
  const same = l.filter((c) => Math.abs(c.miss + 15) <= (c.hi - c.lo) / 2).length; // same width, centred on the line-up's call
  const later = l.filter((c) => c.mid + 15 >= 60); const short = later.filter((c) => c.miss + 15 <= 30);
  const safe = l.filter((c) => c.miss >= Math.min(c.lo, -15) && c.miss <= c.hi).length; // window never starting after the line-up's call
  console.log(`${name.padEnd(26)} ${String(n).padStart(4)} checks · window held ${pct(held, n)} (${h(q(l.map((c) => c.hi - c.lo), 0.5))} wide; same width on the line-up's call ${pct(same, n)}; never after the line-up's call ${pct(safe, n)})`
    + ` · within 1 h: likely ${pct(l.filter((c) => Math.abs(c.miss - c.mid) <= 60).length, n)} vs line-up ${pct(l.filter((c) => Math.abs(c.miss + 15) <= 60).length, n)}`
    + ` · typical miss ${q(l.map((c) => Math.abs(c.miss - c.mid)), 0.5)} vs ${q(l.map((c) => Math.abs(c.miss + 15)), 0.5)} min · told "later", came near or before the line-up's call: ${short.length} of ${later.length}`);
}
const start = BT.toMin(TEST_FROM);
line('Everything', checks);
line('  the test days', checks.filter((c) => c.od >= start));
line('  before the test', checks.filter((c) => c.od < start));
line('Own history (6+ runs)', checks.filter((c) => c.own));
line('All-trains fallback', checks.filter((c) => !c.own));
for (const b of ['24+', '16-24', '10-16', '6-10', '3-6', '0-3']) line(`  ${b} h out`, checks.filter((c) => c.b === b));
const syms = [...new Set(checks.filter((c) => c.own).map((c) => c.sym))].sort();
for (const s of syms) line(`  ${s}`, checks.filter((c) => c.own && c.sym === s));
