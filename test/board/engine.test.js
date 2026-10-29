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
    // ** goes spare while CATS shows it; the time beside it is RETN, when
    // they're due back (owner, 15th 17:00, back to the 14th's reading).
    ['M39291', '14', 'SR04', true],
    ['M38261', '15', 'SR09', true],
  ]);
});

test('owner (SR03) still in Toronto on the 14th is reported as coming home, not placed in line', () => {
  // Turns in Toronto can't come up in Sarnia (owner, 15th).
  const { me, predictions } = check();
  assert.equal(me.comingHome, 'E27121 14');
  assert.ok(!predictions.some((p) => p.turn === 'SR03' || p.turn === 'SR14'));
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

test('MU on L502 is fine (owner, 2026-10-17); MU02 with SR03 is allowed', () => {
  const r = check();
  assert.deepEqual(r.flags.map((f) => f.rule), []);
  assert.ok(r.notes.some((n) => /L50231.*MU is fine on L501\/L502/.test(n)));
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
    lineup: [{ order, symbol: deadhead ? 'DHT999B' : 'M99831', trainNo: deadhead ? 'DHT999' : 'M998', originDay: '14', status: 'ORD', deadhead }],
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

// Owner, 2026-10-17: rest until 0000 = available at 0000. DHT031B 17 at 0200
// is called 0000, so SR08 (first out, rest to 0000) takes it.
test('rest ending exactly at the call time is available', () => {
  const order = at(2026, 10, 14, 12, 0);
  assert.equal(oneTrain({ deadhead: true, order, restUntil: at(2026, 10, 14, 10, 0) }), 'SR01'); // DH called 1000
  assert.equal(oneTrain({ deadhead: false, order, restUntil: at(2026, 10, 14, 9, 45) }), 'SR01'); // train called 0945
  assert.equal(oneTrain({ deadhead: false, order, restUntil: at(2026, 10, 14, 9, 46) }), 'SR02');
});

test('a hold turn ending exactly at the call time is available too', () => {
  const held = (until) => runBoardCheck({
    now: NOW,
    callBoard: [],
    chainGangHome: [
      { craft: 'CO', turn: 'SR01', terminal: 0, pos: 1, restUntil: null, rn: 'HT', statusUntil: until },
      { craft: 'CO', turn: 'SR02', terminal: 0, pos: 2, restUntil: null, statusUntil: null },
    ],
    lineup: [{ order: at(2026, 10, 14, 12, 0), symbol: 'DHT999B', trainNo: 'DHT999', originDay: '14', status: 'ORD', deadhead: true }],
  }, { aTurnsPerDay: 0, bTurnsPerDay: 0 }).predictions[0].turn;
  assert.equal(held(at(2026, 10, 14, 10, 0)), 'SR01'); // DH called 1000, hold to 1000
  assert.equal(held(at(2026, 10, 14, 10, 1)), 'SR02');
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
    callBoard: [crewTrain('A42431', 'S305', 'SA01'), crewTrain('M30241', 'MU01', 'SA03'), crewTrain('E27121', 'SD01', 'SR03'),
      crewTrain('M39931', 'MU04', 'MU01'), crewTrain('Z14931', 'MU02', 'MU02')],
    chainGangHome: [],
    lineup: [],
  });
  // MU with MU is a make-up crew: fine (owner, 2026-10-26).
  assert.deepEqual(r.flags.map((f) => [f.rule, f.text.slice(0, 6)]), [['pairing', 'A42431'], ['mu', 'M30241']]);
  assert.ok(r.notes.some((n) => /M39931.*make-up crew is fine/.test(n)));
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
    ['M38261', 'SR04', true], // SR05 on hold turn; SR04 still ** → goes spare
    ['M39671', 'SR09', false],
  ]);
  assert.deepEqual(r.flags.map((f) => f.rule), []); // L50131 on MU01: fine on L502 (owner, 2026-10-17)
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
  // Nothing but the answer by default (owner: only "when do I go").
  assert.doesNotMatch(text, /POSSIBLE PROBLEMS|Coming up|Notes:/);
  const full = formatReport(runBoardCheck({ ...input, me: 'SR03' }), input.seen, { details: true });
  assert.match(full, /Coming up/);
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
    ['E27861', '15', 'SR', 'SR04', true], // SR05 held; SR04 ** → goes spare
    ['M39671', '14', 'SR', 'SR09', false],
    ['L50231', '16', 'S5', null, false],
    ['M39491', '15', 'A', 'SA08', false], // new road day 16th
    ['Z14891', '15', 'A', 'SA09', false],
    ['M30241', '14', 'A', 'SA01', false],
  ]);
  // Today's A trains already out match the sequence: no pool flags.
  assert.equal(r.flags.filter((f) => f.rule === 'pool').length, 0);
});

test('B0 (working another job) makes a Chain Gang turn go spare, like **', () => {
  const r = runBoardCheck({
    now: NOW,
    callBoard: [],
    chainGangHome: [
      { craft: 'CO', turn: 'SR14', terminal: 0, pos: 1, st: 'B0', rn: null, restUntil: null, statusUntil: null },
      { craft: 'CO', turn: 'SR03', terminal: 0, pos: 2, st: null, rn: null, restUntil: null, statusUntil: null },
    ],
    lineup: [
      { order: at(2026, 10, 14, 12, 0), symbol: 'M39671', trainNo: 'M396', originDay: '14', status: 'PLN', deadhead: false },
      { order: at(2026, 10, 14, 14, 0), symbol: 'M38261', trainNo: 'M382', originDay: '14', status: 'PLN', deadhead: false },
    ],
  }, { aTurnsPerDay: 0, bTurnsPerDay: 0 });
  assert.deepEqual(r.predictions.map((p) => [p.turn, !!p.spare]), [['SR14', true], ['SR03', false]]);
  assert.match(r.predictions[0].reason, /B0 \(working another job\)/);
});

test('owner view: Chain Gang board, line-up crews and changes (08:13 run)', () => {
  const { formatReport, describeMe } = require('../../lib/board/report');
  const { snapshot } = require('../../lib/board/view');
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/board/2026-10-15b.json'), 'utf8'));
  const input = loadSummary(fx);
  const result = runBoardCheck({ ...input, me: 'SR03' });
  const cur = snapshot(result, describeMe(result.me));
  const text = formatReport(result, input.seen, { changes: { prev: null, cur } });
  assert.match(text, /CHAIN GANG BOARD/);
  assert.match(text, /001 {2}SR05 {2}hold turn until 16th 0559/);
  assert.match(text, /002 {2}SR04 {2}\*\* goes spare, return 15th 1026/);
  assert.match(text, /004 {2}SR03 {2}rest until 15th 1015 {3}← YOU/);
  assert.match(text, /999 {2}SR07 {2}out working on M39671/);
  assert.match(text, /15th 1610 {2}PLN {2}E27861 15 +call ~1355 {2}Chain Gang: SR04/);
  assert.match(text, /M38261 15 .*B pool: SB02 \(goes spare/);
  assert.match(text, /L50231 16 .*S5/);
  assert.match(text, /CHANGES: none to show/);

  // A later board: SR09 gone, E27861 ordered later.
  const prev = JSON.parse(JSON.stringify(cur));
  prev.asOf -= 60;
  prev.gang.push({ turn: 'SR10', pos: 6, status: 'available' });
  prev.gang.find((g) => g.turn === 'SR03').pos = 5;
  prev.trains.find((t) => t.train === 'E27861 15').order -= 20;
  prev.trains.find((t) => t.train === 'A42431 15').status = 'ORD';
  prev.trains.push({ train: 'Q14851 15', order: prev.asOf, status: 'ORD', goesTo: 'A pool' });
  prev.me = ['WHEN YOU GO (SR03): something else'];
  const diff = formatReport(result, input.seen, { changes: { prev, cur } });
  assert.match(diff, /CHANGES since the last check \(15th 0715\):/);
  assert.match(diff, /Your answer changed\. It was:\n {6}WHEN YOU GO \(SR03\): something else/);
  assert.match(diff, /~ E27861 15 time 15th 1550 → 15th 1610/);
  assert.match(diff, /~ A42431 15 ORD → PLN/);
  assert.match(diff, /- Q14851 15 off the line-up/);
  assert.match(diff, /~ SR03 position 005 → 004/);
  assert.match(diff, /- SR10 off the Sarnia board/);
  assert.match(formatReport(result, input.seen, { changes: { prev: cur, cur } }), /CHANGES since the last check \(15th 0815\): none\./);
});

test('SD turns (option 27) go with the Chain Gang trains by the same rules', () => {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/board/2026-10-15b.json'), 'utf8'));
  // Option 27 assumed laid out like 23 (not recorded yet): SD08 on rest past
  // E27861's call, so SD11 takes it and SD08 the next one.
  const sd = fx.screens[5].screenGrid
    .filter((l) => !/\| 37:SR/.test(l) || /SR05|SR04/.test(l))
    .map((l) => l.replace('118:SR', '118:SD').replace('[CO]', '[EN]').replace(/10:CO \| 37:SR05/, '10:EN | 37:SD08').replace(/10:CO \| 37:SR04/, '10:EN | 37:SD11'))
    .map((l) => (/SD08/.test(l) ? l.replace(/\| 343:.*$/, '| 505:1400 | 550:15') : /SD11/.test(l) ? l.replace(/\| 343:.*$/, '') : l));
  // A screen that can't be read (no headings) mustn't sink the check.
  const junk = ['1 | 10:45', '37 | 46:POOL: | 100:( | 118:SD | 145:) | 181:TERM: | 235:( | 253:0 | 271:) | 550:CC: | 600:POS'];
  const input = loadSummary({ ...fx, screens: [...fx.screens, { screenGrid: junk }, { screenGrid: sd }] });
  assert.equal(input.seen.sdPool, true);
  assert.deepEqual(input.sdHome.map((t) => t.turn), ['SD08', 'SD11']);
  const r = runBoardCheck({ ...input, me: 'SR03' });
  const by = Object.fromEntries(r.predictions.map((p) => [`${p.symbol} ${p.originDay}`, p]));
  assert.equal(by['E27861 15'].turn, 'SR04');
  assert.equal(by['E27861 15'].engineer, 'SD11');
  assert.equal(by['M39671 14'].engineer, 'SD08');
  assert.equal(by['A42431 15'].engineer, undefined);
  const { formatReport } = require('../../lib/board/report');
  const text = formatReport(r, input.seen);
  assert.match(text, /SD BOARD/);
  assert.match(text, /Chain Gang: SR04 \(goes spare → spareboard\) \+ SD11/);
});

test('S1 turns go with A trains and S3 with B, first in first out like A/B', () => {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/board/2026-10-15b.json'), 'utf8'));
  // Assumed laid out like 23 (option numbers not known yet): turns S101..,
  // S301.., engineer rows. S102 on rest past the 16th A calls → goes spare.
  const board = (pool, rows) => [
    `37 | 46:POOL: | 100:( | 118:${pool} | 145:) | 181:TERM: | 235:( | 253:0 | 271:) | 550:CC: | 586:( | 604:[EN] | 631:)`,
    '73 | 10:CC | 37:TURN | 82:T | 100:POS | 136:EMPLOYEE NAME | 343:ST | 379:RN | 415:RETN | 478:SC | 514:REST',
    ...rows.map(([turn, pos, rest], i) => `${91 + 18 * i} | 10:EN | 37:${turn} | 82:0 | 100:${pos} | 136:AAAA${rest ? ` | 505:${rest} | 550:16` : ''}`),
  ];
  const s1 = board('S1', [['S104', '001'], ['S102', '002', '0600'], ['S110', '003'], ['S101', '004']]);
  const s3 = board('S3', [['S303', '001'], ['S305', '002']]);
  const input = loadSummary({ ...fx, screens: [...fx.screens, { screenGrid: s1 }, { screenGrid: s3 }] });
  assert.deepEqual(input.s1Home.map((t) => t.turn), ['S104', 'S102', 'S110', 'S101']);
  const r = runBoardCheck({ ...input, me: 'SR03' });
  const eng = r.predictions.filter((p) => p.pool === 'A' || p.pool === 'B').map((p) => [p.symbol, p.pool, p.engineer, !!p.engineerSpare]);
  assert.deepEqual(eng, [
    ['A42431', 'A', 'S104', false],
    ['X30241', 'B', 'S303', false],
    ['M38261', 'B', 'S305', false],
    ['M39491', 'A', 'S102', true], // called ~16th 0305, rest to 0600 → spare
    ['Z14891', 'A', 'S110', false],
    ['M30241', 'A', 'S101', false],
  ]);
  const { formatReport } = require('../../lib/board/report');
  const text = formatReport(r, input.seen);
  assert.match(text, /S1 BOARD/);
  assert.match(text, /A pool: SA07 \+ S104/);
  assert.match(text, /A pool: SA08 \+ S102 \(goes spare\)/);
});

// Owner, 2026-10-15: SB01/SB02 were already out on the 15th's B trains, but
// the earlier A trains had left, so the check counted those B trains as A
// slots and handed the 15th's next trains to SB03/SB04.
test("a B train on the Call Board means that road day's A trains are used up", () => {
  const dep = (symbol, h, co) => ({ symbol, trainNo: symbol.slice(0, -2), originDay: '15', station: 'SARNIA', onDuty: at(2026, 10, 15, h, 0), crew: [{ craft: 'EN', turn: 'S301' }, { craft: 'CO', turn: co }] });
  const r = runBoardCheck({
    now: at(2026, 10, 15, 19, 45),
    callBoard: [dep('A42431', 14, 'SA07'), dep('X30241', 16, 'SB01'), dep('M38261', 18, 'SB02')],
    chainGangHome: [{ craft: 'CO', turn: 'SR03', terminal: 0, pos: 1, restUntil: null, statusUntil: null }],
    bHome: [{ craft: 'CO', turn: 'SB03', terminal: 0, pos: 1, restUntil: null, statusUntil: null }],
    lineup: [{ order: at(2026, 10, 16, 1, 0), symbol: 'M39671', trainNo: 'M396', originDay: '14', status: 'PLN', deadhead: false }],
  });
  assert.equal(r.predictions[0].pool, 'SR');
  assert.equal(r.predictions[0].turn, 'SR03');
  assert.deepEqual(r.flags.filter((f) => f.rule === 'pool'), []);
});

// Owner, 2026-10-16: an odd third digit in the manifest means the train is
// ordered out of Toronto (TM399 showed on duty at Sarnia), so it never takes
// one of Sarnia's A/B slots. Deadheads carry a running number and still count.
test('trains with an odd third manifest digit are Toronto trains, not Sarnia ones', () => {
  const dep = (symbol, trainNo, h, co) => ({ symbol, trainNo, originDay: '16', station: 'SARNIA', onDuty: at(2026, 10, 16, h, 0), crew: [{ craft: 'EN', turn: 'S101' }, { craft: 'CO', turn: co }] });
  const r = runBoardCheck({
    now: at(2026, 10, 16, 10, 0),
    callBoard: [dep('TM39931', 'TM399', 5, 'MU01'), dep('Z14891', 'Z148', 6, 'SA09'), dep('M39491', 'M394', 7, 'SA01'), dep('E27861', 'E278', 8, 'SA08'), dep('M30241', 'M302', 9, 'SB03')],
    chainGangHome: [{ craft: 'CO', turn: 'SR03', terminal: 0, pos: 1, restUntil: null, statusUntil: null }],
    lineup: [
      { order: at(2026, 10, 16, 12, 0), symbol: 'M38261', trainNo: 'M382', originDay: '16', status: 'PLN', deadhead: false },
      { order: at(2026, 10, 16, 13, 0), symbol: 'M38361', trainNo: 'M383', originDay: '16', status: 'PLN', deadhead: false },
      { order: at(2026, 10, 16, 14, 0), symbol: 'DHT031B', trainNo: 'DHT031B', originDay: '16', status: 'PLN', deadhead: true },
    ],
  });
  assert.deepEqual(r.flags.filter((f) => f.rule === 'pool'), []);
  // M382 is the 16th's 2nd B train; M383 is Toronto's and left out; the deadhead stays.
  assert.deepEqual(r.predictions.map((p) => [p.symbol, p.pool]), [['M38261', 'B'], ['DHT031B', 'SR']]);
});

// Owner, 2026-10-17: X27861 16 (0405) went out on MU01 with the 16th's A
// trains already gone from the Call Board; the site said A, it's Chain Gang.
test('a train crewed off MU counts as Chain Gang, not an A/B slot', () => {
  const dep = (symbol, h, m, co, en) => ({ symbol, trainNo: symbol.slice(0, 4), originDay: '16', station: 'SARNIA',
    onDuty: at(2026, 10, 17, h, m), crew: [{ craft: 'EN', turn: en }, { craft: 'CO', turn: co }] });
  const r = runBoardCheck({
    now: at(2026, 10, 17, 8, 0),
    callBoard: [dep('X27861', 3, 50, 'MU01', 'MU01')],
    chainGangHome: [],
    lineup: [],
  });
  assert.deepEqual(r.today.map((t) => [t.symbol, t.expected, t.actual]), [['X27861', 'SR', 'SR']]);
  assert.equal(r.flags.filter((f) => f.rule === 'pool').length, 0);
});

test('board checker drives Edge unless BOARD_BROWSER=chromium', () => {
  const { browser } = require('../../lib/board/paths');
  const edge = browser({});
  assert.deepEqual(edge.options, { channel: 'msedge' });
  assert.match(edge.profileDir, /profile-edge$/);
  const chromium = browser({ BOARD_BROWSER: 'chromium' });
  assert.deepEqual(chromium.options, {});
  assert.match(chromium.profileDir, /profile$/);
});

// Owner, 2026-10-21 0357: DHT042B 21 (ORD 0500) showed "Toronto train / not
// counted" with SR09 at 999 out working on it.
test('a line-up train already called or on duty shows its own crew and uses no turn', () => {
  const home = [
    { craft: 'CO', turn: 'SR14', terminal: 0, pos: 1, restUntil: null, statusUntil: null },
    { craft: 'CO', turn: 'SR05', terminal: 0, pos: 2, restUntil: null, statusUntil: null },
    { craft: 'CO', turn: 'SR09', terminal: 0, pos: 999, working: true, workingOn: 'DHT042B', restUntil: null, statusUntil: null },
  ];
  const sd = [
    { craft: 'EN', turn: 'SD07', terminal: 0, pos: 1, restUntil: null, statusUntil: null },
    { craft: 'EN', turn: 'SD04', terminal: 0, pos: 999, working: true, workingOn: 'DHT042B', restUntil: null, statusUntil: null },
  ];
  const lineup = [
    { order: at(2026, 10, 21, 5, 0), symbol: 'DHT042B', trainNo: 'DHT042B', originDay: '21', status: 'ORD', deadhead: true, trnCrew: '45SASR0' },
    { order: at(2026, 10, 21, 6, 0), symbol: 'DHT044B', trainNo: 'DHT044B', originDay: '21', status: 'PLN', deadhead: true },
  ];
  const onBoard = { symbol: 'DHT042B', trainNo: 'DHT042B', originDay: '21', station: 'SARNIA', onDuty: at(2026, 10, 21, 3, 50),
    crew: [{ craft: 'EN', turn: 'SD04' }, { craft: 'CO', turn: 'SR09' }] };
  const shape = (r) => r.predictions.map((p) => [p.symbol, p.pool, p.turn, p.engineer || null]);

  // Called, not on duty yet: SR09/SD04 have it; the next deadhead gets SR14/SD07.
  const called = runBoardCheck({ now: at(2026, 10, 21, 3, 30), callBoard: [], chainGangHome: home, sdHome: sd, lineup });
  assert.deepEqual(shape(called), [['DHT042B', 'SR', 'SR09', 'SD04'], ['DHT044B', 'SR', 'SR14', 'SD07']]);
  assert.match(called.predictions[0].reason, /SR09 is already called/);

  // On duty on the Call Board: the crew CATS shows, still in line-up order.
  const onDuty = runBoardCheck({ now: at(2026, 10, 21, 3, 57), callBoard: [onBoard], chainGangHome: home, sdHome: sd, lineup });
  assert.deepEqual(shape(onDuty), [['DHT042B', 'SR', 'SR09', 'SD04'], ['DHT044B', 'SR', 'SR14', 'SD07']]);
  assert.match(onDuty.predictions[0].reason, /On duty at .*0350/);
});

// CHECKUP #5 (owner, 2026-10-22): a road day's A trains leave the Call Board,
// and the next check handed the 4th train to A again. Trains seen by earlier
// checks are remembered (lib/board/roadday.js) and still count.
test("a road day's trains are remembered after they leave the Call Board", () => {
  const { remember, departed } = require('../../lib/board/roadday');
  const dep = (symbol, h, co) => ({ symbol, trainNo: symbol.slice(0, 4), originDay: '22', station: 'SARNIA', onDuty: at(2026, 10, 22, h, 0),
    crew: [{ craft: 'EN', turn: 'S101' }, { craft: 'CO', turn: co }] });
  const toronto = { ...dep('E27121', 6, 'SR05'), station: 'TORONTO' };
  const early = [dep('Z14891', 6, 'SA01'), dep('M30241', 8, 'SA02'), dep('M39491', 10, 'SA03'), toronto];
  let memory = remember(null, early, at(2026, 10, 22, 10, 30));
  assert.deepEqual(Object.keys(memory.trains).sort(), ['M30241/22', 'M39491/22', 'Z14891/22']); // Sarnia only

  // 1630: only the 3rd A train is still on the Call Board.
  const later = [early[2]];
  memory = remember(memory, later, at(2026, 10, 22, 16, 30));
  const gone = departed(memory, later);
  assert.deepEqual(gone.map((t) => t.symbol).sort(), ['M30241', 'Z14891']);
  const input = {
    now: at(2026, 10, 22, 16, 30),
    callBoard: later,
    chainGangHome: [],
    lineup: [{ order: at(2026, 10, 22, 18, 0), symbol: 'X30241', trainNo: 'X302', originDay: '22', status: 'PLN', deadhead: false }],
  };
  // Without the memory, X302 looks like the day's 2nd A train; with it, the 1st B.
  assert.equal(runBoardCheck(input).predictions[0].pool, 'A');
  const r = runBoardCheck({ ...input, departed: gone });
  assert.equal(r.predictions[0].pool, 'B');
  assert.match(r.notes.join('\n'), /Counted from earlier checks.*Z14891 22 \(A SA01\)/);
  // Remembered trains aren't re-checked or shown as today's trains.
  assert.deepEqual(r.today.map((t) => t.symbol), ['M39491']);

  // Kept 36 h, then dropped.
  memory = remember(memory, [], at(2026, 10, 23, 21, 0));
  assert.deepEqual(Object.keys(memory.trains), ['M39491/22']);
  memory = remember(memory, [], at(2026, 10, 23, 23, 0));
  assert.deepEqual(memory.trains, {});
});

// The memory only vouches for a road day it watched from the start; checks
// begun mid-day (or after hours off) still trust CATS's Chain Gang call.
test('a road day the memory saw only part of still trusts CATS sending a train to the Chain Gang', () => {
  const { remember, departed, GAP_MINUTES } = require('../../lib/board/roadday');
  const dep = (symbol, h, co) => ({ symbol, trainNo: symbol.slice(0, 4), originDay: '22', station: 'SARNIA', onDuty: at(2026, 10, 22, h, 0),
    crew: [{ craft: 'EN', turn: 'SD01' }, { craft: 'CO', turn: co }] });
  const lineup = [{ order: at(2026, 10, 22, 20, 0), symbol: 'X30241', trainNo: 'X302', originDay: '22', status: 'PLN', deadhead: false }];
  const run = (memory, board) => runBoardCheck({ now: memory.last, callBoard: board, departed: departed(memory, board), seenSince: memory.since,
    chainGangHome: [{ craft: 'CO', turn: 'SR03', terminal: 0, pos: 1, restUntil: null, statusUntil: null }], lineup });

  // Started at 0900: saw the 3rd A train, then an SR train. The 4th train is SR, no flag.
  let m = remember(null, [dep('M39491', 9, 'SA03')], at(2026, 10, 22, 9, 30));
  m = remember(m, [dep('E27861', 15, 'SR07')], at(2026, 10, 22, 15, 30));
  assert.equal(m.since, at(2026, 10, 22, 9, 30));
  let r = run(m, [dep('E27861', 15, 'SR07')]);
  assert.deepEqual(r.predictions.map((p) => p.pool), ['SR']);
  assert.deepEqual(r.flags.filter((f) => f.rule === 'pool'), []);

  // Watching since 0400: the count stands, so SR07 on the day's 2nd train is flagged.
  m = remember(null, [], at(2026, 10, 22, 4, 0));
  for (const h of [6, 10]) m = remember(m, [], at(2026, 10, 22, h, 0));
  m = remember(m, [dep('M39491', 9, 'SA03')], at(2026, 10, 22, 12, 0));
  m = remember(m, [dep('E27861', 15, 'SR07')], at(2026, 10, 22, 15, 30));
  r = run(m, [dep('E27861', 15, 'SR07')]);
  assert.equal(r.flags.filter((f) => f.rule === 'pool').length, 1);

  // A gap longer than GAP_MINUTES starts the watch over.
  m = remember(m, [], m.last + GAP_MINUTES + 1);
  assert.equal(m.since, m.last);
});

// Owner, 2026-10-25: M39671 showed SR06 and no engineer; with no SD turn
// callable, the engineer goes to the spareboard and says so.
test('no SD engineer free: the train says so', () => {
  const V = require('../../lib/board/view');
  assert.equal(V.goesTo({ pool: 'SR', turn: 'SR06', engineerNone: 'SD' }), 'Chain Gang: SR06 + spareboard (no SD turn free)');
  assert.equal(V.goesTo({ pool: 'SR', turn: 'SR06', engineer: 'SD01' }), 'Chain Gang: SR06 + SD01');
});

// Owner, 2026-10-25: L502 out of Sarnia goes to the first crew up on
// 501/502 (option 29), conductor + engineer, each spare like A/B.
test('L502: the first crew up on 501/502, each craft spare when it can\'t be called', () => {
  const { at } = require('../../lib/board/time');
  const now = at(2026, 10, 25, 14, 0);
  const lineup = [{ symbol: 'L50231', trainNo: 'L502', originDay: '26', order: at(2026, 10, 26, 4, 0), status: 'PLN', deadhead: false, engCrew: '45SAS50', trnCrew: '45SAS50' }];
  const row = (craft, turn, pos, o = {}) => ({ craft, turn, terminal: 0, pos, working: false, st: null, rn: null, statusUntil: null, restUntil: null, ...o });
  // The owner's board: S501 EN available, S501 CO TV; S502 both **; MU01 away.
  const s5 = [row('EN', 'S501', 1), row('CO', 'S501', 1, { st: 'TV' }), row('EN', 'S502', 2, { st: '**', rn: '**' }), row('CO', 'S502', 2, { st: '**', rn: '**' }),
    row('EN', 'MU01', 1, { terminal: 1 }), row('CO', 'MU01', 1, { terminal: 1 })];
  const p = runBoardCheck({ now, callBoard: [], chainGangHome: [], lineup, s5 }).predictions.find((x) => x.symbol === 'L50231');
  assert.deepEqual([p.pool, p.turn, p.spare, p.engineer, p.engineerSpare], ['S5', 'S501', true, 'S501', false]);
  assert.equal(require('../../lib/board/view').goesTo(p), 'S5: S501 (goes spare) + S501');
  // The board not read: as before.
  assert.equal(runBoardCheck({ now, callBoard: [], chainGangHome: [], lineup }).predictions[0].turn, undefined);
});

// Owner, 2026-10-28 12:39: SA08 at 999 "out working on M30241" (the
// morning's M30241 26, gone from the Call Board) was put on M30241 27,
// planned for 0331 the next night. A planned train 12 h out can't have a
// called crew: it takes the next A turn instead.
test('out working on a symbol: not the same symbol planned for much later', () => {
  const now = at(2026, 10, 28, 12, 39);
  const a = (turn, pos, extra = {}) => ({ craft: 'CO', turn, terminal: 0, pos, restUntil: null, statusUntil: null, ...extra });
  const input = {
    now, callBoard: [], chainGangHome: [], sdHome: [], s1Home: [], s3Home: [],
    aHome: [a('SA08', 999, { working: true, workingOn: 'M30241' }), a('SA02', 1), a('SA03', 2)],
    lineup: [{ order: at(2026, 10, 29, 3, 31), symbol: 'M30241', trainNo: 'M30241', originDay: '27', status: 'PLN', deadhead: false, trnCrew: '45SASA0' }],
  };
  const r = runBoardCheck(input);
  const p = r.predictions.find((x) => x.symbol === 'M30241');
  assert.notEqual(p.turn, 'SA08');
  assert.doesNotMatch(p.reason, /already called/);
  // Ordered and close: still theirs.
  const ord = runBoardCheck({ ...input, now: at(2026, 10, 29, 1, 30), lineup: [{ ...input.lineup[0], status: 'ORD' }] });
  assert.equal(ord.predictions.find((x) => x.symbol === 'M30241').turn, 'SA08');
});

// Owner's screenshot (2026-10-29 15:06): the calling sequence said M38261
// 29 (order 1645, SB06) "B, should be SR", but it's right: A42431 (B) and
// M38261 are the road day's two B trains. A train still on the line-up,
// planned before 1645 and not called yet, took the second B slot first.
// Trains already called take their slots before ones still to come.
test('a called train keeps its slot ahead of a line-up train planned earlier', () => {
  const sar = (symbol, day, h, m, co, en) => ({ symbol, trainNo: symbol.slice(0, 4), originDay: day, station: 'SARNIA', onDuty: at(2026, 10, 29, h, m),
    crew: [{ craft: 'EN', turn: en }, { craft: 'CO', turn: co }] });
  const input = {
    now: at(2026, 10, 29, 15, 6), seenSince: at(2026, 10, 29, 0, 0), chainGangHome: [], aHome: [], bHome: [], sdHome: [], s1Home: [], s3Home: [],
    callBoard: [sar('M30241', '27', 7, 0, 'SA03', 'S103'), sar('M39491', '28', 8, 15, 'SA04', 'S104'), sar('A42431', '29', 10, 45, 'SB05', 'S305'),
      sar('M38261', '29', 16, 30, 'SB06', 'S306')],
    // Still to come, planned at 1500 (before M38261's 1645).
    lineup: [{ order: at(2026, 10, 29, 15, 0), symbol: 'X30241', trainNo: 'X302', originDay: '29', status: 'PLN', deadhead: false, trnCrew: '' }],
  };
  const r = runBoardCheck(input);
  const seq = Object.fromEntries(r.today.map((t) => [t.symbol, t.expected]));
  assert.equal(seq.M38261, 'B');
  assert.ok(!r.flags.some((f) => /M38261/.test(f.text)), r.flags.map((f) => f.text).join(' | '));
  // The line-up train comes after both B trains: Chain Gang.
  assert.equal(r.predictions.find((p) => p.symbol === 'X30241').pool, 'SR');
});
