const test = require('node:test');
const assert = require('node:assert/strict');
const { at } = require('../../lib/board/time');
const { turnFor, serviceDay } = require('../../lib/board/s5-rotation');
const { runBoardCheck } = require('../../lib/board/engine');
const { s5Board } = require('../../lib/board/site');
const { turnStates, turnEvents } = require('../../lib/board/alerts');
const { expectedJobs } = require('../../lib/board/spares');
const anchor = { date: '2026-11-04', turn: 'S501' };
const train = (day, month = 11, year = 2026) => ({ symbol: 'L50231', trainNo: 'L502', originDay: String(day).padStart(2, '0'), order: at(year, month, day, 4), status: 'PLN', deadhead: false });
const row = (craft, turn, extra = {}) => ({ craft, turn, pos: turn === 'S501' ? 1 : 2, terminal: 0, working: false, st: null, rn: null, restUntil: null, statusUntil: null, ...extra });
function input() {
  return { now: at(2026, 11, 7, 13, 55), callBoard: [], chainGangHome: [], lineup: [train(8)],
    garnetLineup: [{ symbol: 'L50131', originDay: '07', order: at(2026, 11, 7, 21, 30), status: 'ORD' }],
    s5: [row('EN', 'S501', { off: [{ from: at(2026, 11, 8, 0, 1), until: at(2026, 11, 9, 0, 1) }] }), row('CO', 'S501'),
      row('EN', 'S502', { st: '**', rn: 'HT', statusUntil: at(2026, 11, 8, 5, 59) }), row('CO', 'S502'),
      row('EN', 'MU02', { terminal: 1, restUntil: at(2026, 11, 7, 21, 12) }), row('CO', 'MU02', { terminal: 1, restUntil: at(2026, 11, 7, 21, 12) })] };
}

test('S5 daily rotation survives month/year boundaries and a delayed train', () => {
  assert.deepEqual([4, 5, 6, 7, 8, 9].map((d) => turnFor(train(d), anchor)), ['S501', 'S502', 'S501', 'S502', 'S501', 'S502']);
  assert.notEqual(turnFor(train(30), anchor), turnFor(train(1, 12), anchor));
  assert.notEqual(turnFor(train(31, 12), anchor), turnFor(train(1, 1, 2027), anchor));
  const delayed = { ...train(8), order: at(2026, 11, 9, 1) };
  assert.equal(serviceDay(delayed), at(2026, 11, 8));
  assert.equal(turnFor(delayed, anchor), 'S501');
  assert.equal(turnFor({ ...train(8), originDay: null }, anchor), null);
});

test('Nov 7 MU02 covers S502; Nov 8 stays S501 with only engineer PL going spare', () => {
  const i = input(), r = runBoardCheck(i), p = r.predictions[0];
  assert.deepEqual([p.turn, p.engineer, p.spare, p.engineerSpare, p.s5Away], ['S501', 'S501', false, true, false]);
  assert.match(p.engineerSpareWhy, /PL @ 8th 0001/);
  assert.match(p.reason, /MU02 is working S502's trip/);
  assert.doesNotMatch(p.reason, /MU02 is working S501's trip/);
  assert.deepEqual(r.s5Order.map((c) => c.turn), ['S501', 'S502']);
  assert.equal(r.s5Order[1].mu, 'MU02');
  const rows = s5Board(i.s5.map((t) => ({ ...t, status: 'available' })), r.s5Order);
  assert.match(rows.find((t) => t.turn === 'S501').status, /next for L502/);
  assert.match(rows.find((t) => t.turn === 'MU02').status, /working S502's trip/);
  assert.deepEqual(expectedJobs(r.predictions).map((j) => [j.turn, j.cc]), [['S501', 'EN']]);
  const st = turnStates(r, i.callBoard, { s5: i.s5 });
  assert.equal(st['S501-CO'].lineup.train, 'L50231 08');
  assert.equal(st['S501-EN'].lineup.spare, true);
  assert.ok(!st['S502-CO']?.lineup);
  const sent = turnEvents({}, st, { now: i.now * 60000 }).events.filter((e) => e.kind === 'lineup');
  assert.ok(sent.some((e) => e.turn === 'S501-CO'));
  assert.ok(!sent.some((e) => /^S502/.test(e.turn)));
});

test('rotation persists without MU, after restart, through midnight and changing rest/position', () => {
  const i = input();
  for (const now of [at(2026, 11, 7, 23, 59), at(2026, 11, 8, 0, 1)]) {
    const changed = { ...i, now, s5: i.s5.filter((t) => !/^MU/.test(t.turn)).map((t) => ({ ...t, pos: t.turn === 'S502' ? 1 : 2 })) };
    assert.equal(runBoardCheck(changed).predictions[0].turn, 'S501');
    assert.equal(runBoardCheck(JSON.parse(JSON.stringify(changed))).predictions[0].turn, 'S501');
  }
  const noEvidence = { ...i, garnetLineup: [] };
  assert.equal(runBoardCheck(noEvidence).predictions[0].turn, 'S501');
  assert.ok(runBoardCheck(noEvidence).s5Order.every((c) => !c.mu));
});

test('multiple L502 dates keep daily assignments even when the line-up skips a day', () => {
  const i = input();
  const r = runBoardCheck({ ...i, lineup: [train(8), train(10), train(11)] });
  assert.deepEqual(r.predictions.map((p) => p.turn), ['S501', 'S501', 'S502']);
});


test('a missing regular row cannot hand its scheduled trip to the other regular crew', () => {
  const i = input();
  const r = runBoardCheck({ ...i, s5: i.s5.filter((t) => t.turn !== 'S501') });
  assert.equal(r.predictions[0].turn, 'S501');
  assert.equal(r.predictions[0].spare, true);
  assert.equal(r.predictions[0].engineerSpare, true);
  assert.doesNotMatch(r.predictions[0].reason, /Infinity/);
});
