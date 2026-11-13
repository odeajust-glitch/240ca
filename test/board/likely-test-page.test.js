// Analytics → Likely-call test, made simpler (owner, 2026-11-13: "It needs to be simple with minimal
// explanation so guys seeing it will understand it"). The page is still TEST SITE ONLY (ANA_SECS gets the
// page only when PREVIEW turns on; site-review.test.js pins that). Off the page, still in patterns.json:
// the table by distance, the replay before the test, the early calls covered and "How it is scored".
// Train symbols only; no names.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const BoardTrains = require('../../public/board-trains.js');

const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };
const line = (start) => { const a = html.indexOf(start); assert.ok(a > 0, start); return html.slice(a, html.indexOf('\n', a)); };

function page(PATTERNS) {
  const ctx = vm.createContext({ PATTERNS, BoardTrains, Date, Math, Object, String });
  vm.runInContext([
    "const esc = (s) => String(s).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));",
    line('const stampMin = '), line('const plural = '), line('const hrs = '),
    cut('function dt(stamp) {', 'function dur(min) {'),
    cut('function likelyTest() {', 'function planTrust('),
    'this.likelyTest = likelyTest;',
  ].join('\n'), ctx);
  return ctx.likelyTest();
}

// Shaped like data/patterns.json on board-test, 13 Nov 2026 (day 2 of 14), cut down.
const score = () => ({
  from: '2026-11-11 0000', days: 14,
  test: { checks: 79, trains: 19, held: 68, width: 271, closer: 42, further: 17, early: 15, earlyCovered: 13,
    shown: { within30: 27, within60: 48, typical: 65 }, likely: { within30: 41, within60: 56, typical: 50 },
    byAway: [{ away: '0-3', checks: 8, held: 7, shown: { within60: 75 }, likely: { within60: 88 } }] },
  before: { checks: 896, trains: 207, held: 698, width: 255, early: 154, earlyCovered: 126, shown: { within60: 49 }, likely: { within60: 54 }, byAway: [] },
  runs: [{ id: 'E27861 12', onDuty: '2026-11-12 2115', checks: [
    { away: '0-3', miss: 5, lo: 30, hi: 665, mid: 110, held: false, own: true },
    { away: '24+', miss: 485, lo: -75, hi: 495, mid: 60, held: true, own: false },
  ] }],
});

test('likely-call test: three numbers, one line saying which is ahead, and the trains', () => {
  const out = page({ generatedAt: '2026-11-13T00:41:48.162Z', score: score() });
  assert.ok(out.includes('<b>Day 2 of 14</b> · Nov 11 to Nov 24'));
  assert.ok(out.includes('<b>86%</b><span>called inside the likely window</span><small>68 of 79 checks · the window is usually 4.5 h wide</small>'));
  assert.ok(out.includes('<b>56%</b><span>called within an hour of the likely time</span>'));
  assert.ok(out.includes('<b>48%</b><span>called within an hour of the line-up\'s call</span>'));
  assert.ok(out.includes('<p class="lt2-verdict">So far the likely time is beating the line-up.</p>'));
  // A train: its call, how many of its checks the window held, and each check in plain times, a day out first.
  assert.ok(out.includes('<b>E27861 12</b> <span class="od">called 12th 1915</span></span><span class="res part">1 of 2</span>'));
  const day = out.indexOf('A day or more out'); const near = out.indexOf('Under 3 h out');
  assert.ok(day > 0 && near > day, 'a day out comes first');
  // Under 3 h: the order showed 2110 (on duty 2115, 5 min late), so the line-up's call was 1855; the window
  // 1940 to 13th 0615 (order + gap − 2 h); called 1915, before it.
  assert.ok(out.includes('<div class="lt2-check miss"><b>Under 3 h out</b><em>called earlier</em><span>line-up call 12th 1855</span><span>likely time 12th 2100</span><span>window 12th 1940 – 13th 0615</span></div>'));
  // What came off the page.
  for (const gone of ['<table', 'Before the test', 'How it is scored', 'early calls', '(all trains)', '896', '207 trains']) assert.ok(!out.includes(gone), gone);
});

test('likely-call test: which is ahead, and too early to tell', () => {
  const at = (likely, shown, checks = 79) => { const s = score(); s.test.likely.within60 = likely; s.test.shown.within60 = shown; s.test.checks = checks; return page({ generatedAt: '2026-11-13T00:41:48.162Z', score: s }); };
  assert.ok(at(50, 56).includes('So far the line-up is beating the likely time.'));
  assert.ok(at(52, 48).includes('So far the likely time and the line-up are about even.'));
  assert.ok(at(56, 48, 12).includes('Too early to tell: 12 checks so far.'));
});

test('likely-call test: before it starts, before a train goes, and before the figures arrive', () => {
  assert.ok(page({ generatedAt: '2026-11-10T12:00:00Z', score: score() }).includes('<b>Starts Nov 11</b>'));
  const s = score(); s.test = { checks: 0 }; s.runs = [];
  assert.ok(page({ score: s }).includes('No trains yet. Results show once the first planned train is called.'));
  assert.ok(page({}).includes('The test figures arrive with the next publish from the laptop.'));
  assert.ok(page(null).includes('The test figures arrive'));
});
