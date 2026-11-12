// A trip is never scored against a wait first seen after the turn had already gone on duty (owner,
// 2026-11-12, shown SD09 on M39671 23: on duty 25 Oct 0400, first seen lined up at 1134 for that night's
// X27331 26, and scored as called 22 hours early). Made-up checks in the shape the tracker reads.
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../../lib/board/insights');

const lined = (train, call, turn = 'SD09') => ({ train, call, crew: { co: turn } });
const out = (train, onDuty, turn = 'SD09') => ({ train, onDuty, crew: `CO ${turn}` });

test('out on one train, first seen lined up for the next: the trip under way is not scored, the next one is', () => {
  const st = I.collect([
    // 1134: still listed on duty since 0400 on M1 07; the board now shows the turn lined up for tonight's M2 08.
    { taken: '2026-11-07 1134', lineup: [lined('M2 08', '7th 2345')], onDuty: [out('M1 07', '7th 0400')], vacancies: [] },
    { taken: '2026-11-07 1600', lineup: [lined('M2 08', '7th 2345')], onDuty: [out('M1 07', '7th 0400')], vacancies: [] },
    // The real call for M2 08 comes that night, an hour later than the board said.
    { taken: '2026-11-08 0250', lineup: [], onDuty: [out('M2 08', '8th 0245')], vacancies: [] },
  ]);
  const list = I.finish(st).sleep;
  assert.deepEqual(list.map((z) => [z.turn, z.train, !!z.takenOff, z.call]), [['SD09', 'M2 08', false, '2026-11-08 0045']]);
  // The wait for the next trip was kept whole: first seen at 1134, its eight-hour figure from 1600.
  assert.equal(list[0].firstSeen, '2026-11-07 1134');
  assert.equal(list[0].expected, '2026-11-07 2345');
  assert.equal(list[0].off, 60);
});

test('first seen on the train it is already out on (a gap in the checks): nothing is scored and no wait is left', () => {
  const st = I.collect([
    // No check between 1916 and 2025: the turn is first seen lined up for E1 30 forty minutes after going on duty on it.
    { taken: '2026-10-30 2025', lineup: [lined('E1 30', '30th 1830', 'SD02')], onDuty: [out('E1 30', '30th 1945', 'SD02')], vacancies: [] },
    { taken: '2026-10-30 2040', lineup: [], onDuty: [out('E1 30', '30th 1945', 'SD02')], vacancies: [] },
    { taken: '2026-10-30 2100', lineup: [], onDuty: [out('E1 30', '30th 1945', 'SD02')], vacancies: [] },
  ]);
  // Neither a call 45 minutes "early" nor a "taken off the line-up" when the train leaves it.
  assert.deepEqual(I.finish(st).sleep, []);
});

test('an ordinary call is scored as before', () => {
  const st = I.collect([
    { taken: '2026-11-07 0900', lineup: [lined('M1 08', '8th 0400')], onDuty: [], vacancies: [] },
    { taken: '2026-11-07 2030', lineup: [lined('M1 08', '8th 0400')], onDuty: [], vacancies: [] },
    { taken: '2026-11-08 0310', lineup: [], onDuty: [out('M1 08', '8th 0500')], vacancies: [] },
  ]);
  const [z] = I.finish(st).sleep;
  assert.deepEqual([z.turn, z.train, z.call, z.expected, z.off, z.firstSeen], ['SD09', 'M1 08', '2026-11-08 0300', '2026-11-08 0400', -60, '2026-11-07 0900']);
});

test('records saved before the rule are left out of what the site publishes', () => {
  const state = I.collect([{ taken: '2026-11-08 0600', lineup: [], onDuty: [], vacancies: [] }]);
  state.sleep = {
    wrong: { turn: 'SD09', train: 'M39671 23', onDuty: '2026-10-25 0400', call: '2026-10-25 0200', firstSeen: '2026-10-25 1134', expected: '2026-10-25 2345', off: -1305 },
    right: { turn: 'SR03', train: 'M1 08', onDuty: '2026-11-08 0500', call: '2026-11-08 0300', firstSeen: '2026-11-07 0900', expected: '2026-11-08 0400', off: -60 },
    // First seen after the call time but before going on duty: a real call with no warning, kept.
    cold: { turn: 'SR09', train: 'X39661 23', onDuty: '2026-10-24 0045', call: '2026-10-23 2245', firstSeen: '2026-10-23 2301', expected: '2026-10-24 1935', off: -1250 },
    // A turn taken off: the time kept as "on duty" is when it came off, always after it was first seen.
    off: { turn: 'SR05', train: 'M2 08', takenOff: true, onDuty: '2026-11-07 1410', firstSeen: '2026-11-07 0900', expected: '2026-11-07 1655' },
  };
  assert.deepEqual(I.finish(state).sleep.map((z) => z.turn).sort(), ['SR03', 'SR05', 'SR09']);
});
