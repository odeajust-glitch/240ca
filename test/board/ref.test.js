// Reference tab (owner, 2026-11-03): the held-away penalty sheet.
const test = require('node:test');
const assert = require('node:assert');
const R = require('../../public/board-ref');

test('held-away penalty matches the posted sheet', () => {
  const t = (h, m) => R.penalty(h * 60 + m);
  const sheet = [[10, 0, 0], [10, 1, 0.21], [10, 3, 0.63], [10, 33, 6.88], [10, 59, 12.29], [11, 0, 12.5], [11, 59, 24.79], [12, 0, 25],
    [12, 1, 37.71], [12, 59, 49.79], [13, 0, 50], [13, 1, 62.71], [13, 59, 74.79], [14, 0, 75], [14, 1, 75.31], [14, 6, 76.88],
    [14, 59, 93.44], [15, 0, 93.75], [15, 20, 100], [15, 59, 112.19], [16, 0, 112.5], [16, 1, 212.5], [17, 0, 212.5], [17, 1, 312.5], [22, 0, 712.5]];
  for (const [h, m, want] of sheet) assert.strictEqual(t(h, m), want, `${h}:${m}`);
  assert.strictEqual(t(9, 30), 0);
  assert.strictEqual(t(22, 1), null);
});

test('reference lists: every status letter, C yard without CO45', () => {
  assert.strictEqual(R.STATUS.map((s) => s[0]).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const c = R.YARDS.find((y) => y.name === 'Mac Yard: C yard').tracks;
  assert.strictEqual(R.YARDS[R.YARDS.length - 1].name, 'Mac Yard: C yard'); // after Malport
  assert.strictEqual(c.length, 77);
  assert.ok(!c.some((x) => x[0] === 'CO45'));
  assert.deepStrictEqual(c.find((x) => x[0] === 'CO78'), ['CO78', 900]);
});

test('yard jobs: YSBY is a 12-hour shift (owner, 2026-11-03)', () => {
  const BoardTurns = require('../../public/board-turns');
  const s = { taken: '2026-11-03 0500', lineup: [], onDuty: [], away: [], returning: [], sequence: [], bunkhouse: [], vacancies: [], pools: [],
    yardJobs: [{ job: 'YSBY04', station: 'SARNIA', onDuty: '2nd 1900', off: '3rd 0700', hours: 12, crew: 'FO B126' }] };
  assert.ok(BoardTurns.facts(s, 'B126').some((f) => /off ~3rd 0700, 12 h assumed/.test(f.text)));
});
