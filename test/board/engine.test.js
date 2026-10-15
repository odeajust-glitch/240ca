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
  assert.deepEqual(me.ahead.map((a) => a.turn), ['SR05', 'SR14']);
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

// --- 2026-10-15 ~01:43: the owner's first real shadow-check run ------------

const fixture15 = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/board/2026-10-15.json'), 'utf8'));

test('2026-10-15 run: clock falls back to probe time when the header is masked', () => {
  const input = loadSummary(fixture15);
  assert.equal(input.now, at(2026, 10, 15, 1, 43));
});

test('2026-10-15 run: deadheads on the Call Board are read, working turns leave the queue', () => {
  const input = loadSummary(fixture15);
  assert.ok(input.callBoard.some((t) => t.symbol === 'DHT211C' && t.crew.some((c) => c.turn === 'SR06')));
  const r = runBoardCheck({ ...input, me: 'SR03' });
  const assigned = r.predictions.filter((p) => p.turn).map((p) => p.turn);
  for (const busy of ['SR07', 'SR08', 'SR06']) assert.ok(!assigned.includes(busy), `${busy} is out working`);
});

test('2026-10-15 run: road day 14 A/B inferred as used; matches CATS on M30241', () => {
  const r = runBoardCheck({ ...loadSummary(fixture15), me: 'SR03' });
  assert.deepEqual(r.predictions.map((p) => [p.symbol, p.pool === 'SR' ? p.turn : p.pool, !!p.spare]), [
    ['M30241', 'SR02', false], // ORD, CATS crew code SASR0 agrees
    ['M39491', 'A', false],
    ['Z14891', 'A', false],
    ['A42431', 'A', false],
    ['E27861', 'B', false],
    ['X30241', 'B', false],
    ['M38261', 'SR04', true], // SR05 on hold turn; SR04 ** goes spare
    ['M39671', 'SR09', false],
  ]);
  assert.deepEqual(r.flags.map((f) => f.rule), ['mu']); // L50131 conductor on MU01 again
  assert.deepEqual(r.me.ahead.map((a) => a.turn), ['SR05']);
});

test('CATS crew codes on ordered line-up rows map to pools', () => {
  const { poolFromCrewCode } = require('../../lib/board/engine');
  assert.equal(poolFromCrewCode('45SASR0'), 'SR');
  assert.equal(poolFromCrewCode('45SASA0'), 'A');
  assert.equal(poolFromCrewCode('45SAS50'), 'S5');
  assert.equal(poolFromCrewCode(''), null);
});

test('Call Board clock: split header is read, masked header is ignored', () => {
  const S = require('../../lib/board/screens');
  assert.equal(S.callBoardTime(parseGrid(['1 | 19:26/10/15- | 109:142 | 352:CN'])), at(2026, 10, 15, 1, 42));
  assert.equal(S.callBoardTime(parseGrid(['1 | 19:99/99/99- | 109:142 | 352:CN'])), null);
});

test('report leads with when the owner goes to work (2026-10-15 run)', () => {
  const { formatReport } = require('../../lib/board/report');
  const input = loadSummary(fixture15);
  const text = formatReport(runBoardCheck({ ...input, me: 'SR03' }), input.seen);
  assert.match(text, /\nWHEN YOU GO \(SR03\): not on the line-up yet \(the line-up only runs to 15th 2216\)/);
  assert.ok(text.indexOf('WHEN YOU GO') < text.indexOf('POSSIBLE PROBLEMS'), 'owner section comes first');
  assert.match(text, /the 1st Chain Gang train or deadhead after that if it's called before 16th 0559 \(SR05 on hold turn\)/);
  assert.match(text, /Called after 16th 0559: the 2nd one/);
  assert.match(text, /Your own rest is up at 15th 1015/);
});

test('owner on a line-up train gets call and on-duty times', () => {
  const r = runBoardCheck({
    now: NOW,
    callBoard: [],
    chainGangHome: [{ craft: 'CO', turn: 'SR03', terminal: 0, pos: 1, restUntil: null, statusUntil: null }],
    lineup: [{ order: at(2026, 10, 14, 22, 16), symbol: 'M39671', trainNo: 'M396', originDay: '14', status: 'PLN', deadhead: false }],
    me: 'SR03',
  }, { aTurnsPerDay: 0, bTurnsPerDay: 0 });
  assert.equal(r.me.train, 'M39671 14');
  assert.equal(r.me.onDuty, at(2026, 10, 14, 22, 1));
  assert.equal(r.me.call, at(2026, 10, 14, 20, 1));
});

test('A/B position screens (19/21) give each A/B train its turn; resting A/B turns go spare', () => {
  const gangRow = (pool, top, turn, pos, extra = '') => `${top} | 10:CO | 37:${turn} | 82:0 | 100:${String(pos).padStart(3, '0')} | 136:AAAA+        A | 289:AAAA${extra}`;
  const screen = (pool, rows) => ({ screenGrid: [
    `37 | 46:POOL: | 100:( | 118:${pool} | 145:) | 181:TERM: | 235:( | 253:0 | 271:) | 550:CC: | 586:( | 604:[CO] | 631:)`,
    '73 | 10:CC | 37:TURN | 82:T | 100:POS | 136:EMPLOYEE NAME | 343:ST | 379:RN | 415:AAAA | 478:SC | 514:REST | 577:AAAA | 622:TURN | 667:AAAA',
    ...rows,
  ] });
  const summary = { ...fixture15, screens: [
    ...fixture15.screens,
    screen('SA', [gangRow('SA', 91, 'SA03', 1), gangRow('SA', 109, 'SA04', 2, ' | 505:0700 | 550:15'), gangRow('SA', 127, 'SA01', 3)]),
    screen('SB', [gangRow('SB', 91, 'SB05', 1), gangRow('SB', 109, 'SB06', 2)]),
  ] };
  const r = runBoardCheck({ ...loadSummary(summary), me: 'SR03' });
  const ab = r.predictions.filter((p) => p.pool === 'A' || p.pool === 'B').map((p) => [p.symbol, p.pool, p.turn, !!p.spare]);
  assert.deepEqual(ab, [
    ['M39491', 'A', 'SA03', false],
    ['Z14891', 'A', 'SA04', true], // called ~0513, rest to 0700 → goes spare
    ['A42431', 'A', 'SA01', false],
    ['E27861', 'B', 'SB05', false],
    ['X30241', 'B', 'SB06', false],
  ]);
});

// --- 2026-10-15 ~08:13: first run with A (19) and B (21) screens -----------

test('2026-10-15 08:13 run: A/B turns from screens 19/21, Chain Gang as before', () => {
  const fixture15b = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/board/2026-10-15b.json'), 'utf8'));
  const input = loadSummary(fixture15b);
  assert.deepEqual(input.aHome.map((t) => t.turn), ['SA07', 'SA08', 'SA09', 'SA01', 'SA05', 'SA06']);
  const r = runBoardCheck({ ...input, me: 'SR03' });
  assert.deepEqual(r.predictions.map((p) => [p.symbol, p.originDay, p.pool, p.turn || null, !!p.spare]), [
    ['A42431', '15', 'A', 'SA07', false], // 3rd A today after SA05, SA06
    ['X30241', '13', 'B', 'SB01', false],
    ['M38261', '15', 'B', 'SB02', true], // SB02 on rest to 2300 → goes spare
    ['E27861', '15', 'SR', 'SR04', true], // SR05 held; SR04 ** goes spare
    ['M39671', '14', 'SR', 'SR09', false],
    ['L50231', '16', 'S5', null, false],
    ['M39491', '15', 'A', 'SA08', false], // new road day 16th
    ['Z14891', '15', 'A', 'SA09', false],
    ['M30241', '14', 'A', 'SA01', false],
  ]);
  // Today's A trains already out match the sequence: no pool flags.
  assert.equal(r.flags.filter((f) => f.rule === 'pool').length, 0);
});
