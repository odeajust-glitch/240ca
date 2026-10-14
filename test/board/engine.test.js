const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { loadSummary } = require('../../lib/board/summary');
const { runBoardCheck } = require('../../lib/board/engine');
const { parseGrid } = require('../../lib/board/grid');
const { at } = require('../../lib/board/time');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/board/2026-10-14.json'), 'utf8'));

function check(extra = {}) {
  const input = loadSummary(fixture);
  return runBoardCheck({ ...input, me: 'SR03', ...extra });
}

// The 2026-10-14 16:17 prediction the owner read through and agreed with
// ("that's how I'd read it"). See BOARD-CHECK.md, worked example.
test('2026-10-14 line-up matches the owner-agreed prediction', () => {
  const got = check().predictions.map((p) => [p.symbol, p.originDay, p.pool === 'SR' ? p.turn : p.pool, !!p.spare]);
  assert.deepEqual(got, [
    ['DHT141B', '14', 'SR01', false],
    ['E27861', '14', 'SR07', false],
    ['M39671', '13', 'SR08', false],
    ['DHT211B', '05', 'SR06', false], // called 0030: SR02 on rest to 0100, SR05 held
    ['L50231', '15', 'S5', false],
    ['Z14891', '14', 'A', false],
    ['M30241', '13', 'A', false],
    ['M39491', '14', 'A', false],
    ['X30241', '13', 'B', false],
    ['A42431', '15', 'B', false],
    ['E27861', '15', 'SR02', false],
    ['M39291', '14', 'SR04', true], // ** → goes out with a spareboard employee
    ['M38261', '15', 'SR09', true],
  ]);
});

test('owner (SR03) is behind SR05 and SR14 after the line-up', () => {
  const { me } = check();
  assert.deepEqual(me.aheadAfterLineup.map((s) => s.split(' ')[0]), ['SR05', 'SR14']);
});

test('today: 3 A then 2 B out of Sarnia, no pool mismatch', () => {
  const r = check();
  assert.deepEqual(r.today.map((t) => [t.symbol, t.expected, t.actual]), [
    ['L50231', 'S5', 'MU'],
    ['Z14891', 'A', 'A'],
    ['M30241', 'A', 'A'],
    ['X38261', 'A', 'A'],
    ['A42431', 'B', 'B'],
    ['X39291', 'B', 'B'],
  ]);
  assert.equal(r.flags.filter((f) => f.rule === 'pool').length, 0);
});

test('L502 conductor on MU01 is flagged (owner confirmed miscoding); MU02 with SR03 is allowed', () => {
  const r = check();
  assert.deepEqual(r.flags.map((f) => f.rule), ['mu']);
  assert.match(r.flags[0].text, /L50231/);
  assert.ok(r.notes.some((n) => /E27121.*MU02.*Allowed/.test(n)));
});

// --- Rules in isolation ------------------------------------------------------

const NOW = at(2026, 10, 14, 6, 0);
function oneTrain({ deadhead, order, restUntil }) {
  return runBoardCheck({
    now: NOW,
    callBoard: [],
    chainGangHome: [
      { craft: 'CO', turn: 'SR01', terminal: 0, pos: 1, restUntil, statusUntil: null },
      { craft: 'CO', turn: 'SR02', terminal: 0, pos: 2, restUntil: null, statusUntil: null },
    ],
    lineup: [{ order, symbol: deadhead ? 'DHT999B' : 'M99931', trainNo: deadhead ? 'DHT999' : 'M999', originDay: '14', status: 'ORD', deadhead }],
  }, { aTurnsPerDay: 0, bTurnsPerDay: 0 }).predictions[0].turn;
}

// Owner's examples: order 1200. Deadhead called 1000; train on duty 1145, called 0945.
test('rest is checked against the call time (owner examples)', () => {
  const order = at(2026, 10, 14, 12, 0);
  assert.equal(oneTrain({ deadhead: true, order, restUntil: at(2026, 10, 14, 11, 0) }), 'SR02');
  assert.equal(oneTrain({ deadhead: true, order, restUntil: at(2026, 10, 14, 9, 59) }), 'SR01');
  assert.equal(oneTrain({ deadhead: false, order, restUntil: at(2026, 10, 14, 9, 59) }), 'SR02');
  assert.equal(oneTrain({ deadhead: false, order, restUntil: at(2026, 10, 14, 9, 44) }), 'SR01');
});

test('road day starts after 0459: a 0459 order counts toward the previous day', () => {
  const train = (h, m, day) => ({ order: at(2026, 10, 15, h, m), symbol: `M${day}0031`, trainNo: `M${day}00`, originDay: '15', status: 'PLN', deadhead: false });
  const r = runBoardCheck({
    now: NOW,
    callBoard: [],
    chainGangHome: [{ craft: 'CO', turn: 'SR01', terminal: 0, pos: 1, restUntil: null, statusUntil: null }],
    lineup: [train(4, 59, 1), train(5, 0, 2)],
  }, { aTurnsPerDay: 1, bTurnsPerDay: 0 });
  // Both are the first train of their own road day.
  assert.deepEqual(r.predictions.map((p) => p.pool), ['A', 'A']);
});

test('deadheads never use an A/B slot', () => {
  const r = runBoardCheck({
    now: NOW,
    callBoard: [],
    chainGangHome: [{ craft: 'CO', turn: 'SR01', terminal: 0, pos: 1, restUntil: null, statusUntil: null }],
    lineup: [
      { order: at(2026, 10, 14, 6, 0), symbol: 'DHT141B', trainNo: 'DHT141', originDay: '14', status: 'ORD', deadhead: true },
      { order: at(2026, 10, 14, 7, 0), symbol: 'Z14891', trainNo: 'Z148', originDay: '14', status: 'PLN', deadhead: false },
    ],
  });
  assert.deepEqual(r.predictions.map((p) => p.pool === 'SR' ? p.turn : p.pool), ['SR01', 'A']);
});

test('wrong engineer/conductor pairing and MU on an A train are flagged', () => {
  const crewTrain = (symbol, en, co) => ({ symbol, trainNo: symbol.slice(0, -2), originDay: '14', station: 'TORONTO', onDuty: NOW, crew: [{ craft: 'EN', turn: en }, { craft: 'CO', turn: co }] });
  const r = runBoardCheck({
    now: NOW,
    callBoard: [crewTrain('A42431', 'S305', 'SA01'), crewTrain('M30241', 'MU01', 'SA03'), crewTrain('E27121', 'SD01', 'SR03')],
    chainGangHome: [],
    lineup: [],
  });
  assert.deepEqual(r.flags.map((f) => [f.rule, f.text.slice(0, 6)]), [['pairing', 'A42431'], ['mu', 'M30241']]);
});

test('a 4th A train out of Sarnia on the same road day is flagged', () => {
  const dep = (symbol, h, co) => ({ symbol, trainNo: symbol.slice(0, -2), originDay: '14', station: 'SARNIA', onDuty: at(2026, 10, 14, h, 0), crew: [{ craft: 'EN', turn: 'S101' }, { craft: 'CO', turn: co }] });
  const r = runBoardCheck({
    now: NOW,
    callBoard: [dep('Z14891', 7, 'SA01'), dep('M30241', 8, 'SA02'), dep('X38261', 9, 'SA03'), dep('A42431', 10, 'SA04')],
    chainGangHome: [],
    lineup: [],
  });
  assert.equal(r.flags.filter((f) => f.rule === 'pool').length, 1);
  assert.match(r.flags.find((f) => f.rule === 'pool').text, /A42431.*sequence says B/);
});

test('grid parser keeps a literal "|" inside screen text', () => {
  const [row] = parseGrid(['49 | 33:/ | 185:| | 233:A | B']);
  assert.deepEqual(row.cells.map((c) => c.text), ['/', '|', 'A | B']);
});
