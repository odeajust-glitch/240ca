const test = require('node:test');
const assert = require('node:assert/strict');


// The Notifications tab (owner, 2026-11-05): the Desktop log and the JSON
// log (with the logic) merged, newest first, a line in both taken once.
test('alert history: both logs, last 30 days, the JSON copy wins', () => {
  const H2 = require('../../lib/board/health');
  const txt = [
    'When              Turn    Alert      Sent to   Message',
    '2026-09-01 10:00  SR03    lineup     1 phone  SR03 lined up: old.',
    '2026-11-04 19:46  EN03    resetAhead  1 phone  Heads-up: SD02 …',
    '2026-11-05 01:40  SD08    onDuty     1 phone  SD08 on duty on M39491 04.',
  ].join('\r\n');
  const json = `${JSON.stringify({ at: '2026-11-05 01:40', turn: 'SD08', kind: 'onDuty', phones: 1, failed: 0, text: 'SD08 on duty on M39491 04.', why: 'The Call Board shows it.' })}\n{cut off`;
  const h = H2.alertHistory(txt, json, { days: 30, now: Date.UTC(2026, 10, 5, 18) });
  assert.deepEqual(h.alerts.map((a) => [a.at, a.turn, a.why || null]), [['2026-11-05 01:40', 'SD08', 'The Call Board shows it.'], ['2026-11-04 19:46', 'EN03', null]]);
});
