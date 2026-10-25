// The screens added 2026-10-24 (owner's screenshots): spareboards (13/9,
// 19/17), the terminal line-up of vacancies (5), 501/502 (29), and the yard
// jobs at the end of the Call Board.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGrid } = require('../../lib/board/grid');
const S = require('../../lib/board/screens');
const { at, fmt } = require('../../lib/board/time');
const { maskTokenWith, BOARD_WORDS } = require('../../lib/board/capture');

// Fixed-width screen text → the probe's grid lines: each word its own box,
// 9 px a character, names masked the way the checker saves them.
function grid(lines, mask = true) {
  return parseGrid(lines.map((line, row) => {
    const cells = [...line.matchAll(/\S+/g)].map((m) => `${m.index * 9}:${mask ? maskTokenWith(m[0], BOARD_WORDS) : m[0]}`);
    return [String(row * 18), ...cells].join(' | ');
  }));
}

const now = at(2026, 10, 24, 3, 26);

test('spareboard (13): turns, positions and rest, no names', () => {
  const rows = grid([
    '45 SA                    SPAREBOARD INQUIRY                PSTS02D',
    '                         TRAIN FAST BRD- PSTN             VIEW TIME(     )',
    '                      NBR ELIGIBLE:   999  NBR  ASSIGNED:   047',
    '    EMPLOYEE NAME         TURN  POS  ST  RN  RETN     REST    MTPD  USHR   PD    STT  #S  #O',
    'CHOPRA+       K    KARA   B138  001                                                   00  00',
    'DAYE+         B    BRYS   B126  006                   0600  24                         01  00',
    'DALEY+        M    MICH   B120  008                   0930  24  0800  0930  0800       01  00',
    'JACOBSEN+(N/NT)N   NEIL   B142  009                                                   01  00',
    '       ENTER=RESTART       F1=HELP      F3=EXIT      F8=PAGEDN      F11=PREV  MENU',
    'END  OF  SPAREBOARD                                                 E010-1',
  ]);
  assert.ok(S.isSpareboard(rows.map((r) => r.text).join('\n')));
  const { turns } = S.parseSpareboard(rows, now);
  assert.deepEqual(turns.map((t) => [t.turn, t.pos, t.restUntil == null ? null : fmt(t.restUntil)]), [
    ['B138', 1, null], ['B126', 6, '24th 0600'], ['B120', 8, '24th 0930'], ['B142', 9, null],
  ]);
  assert.ok(!JSON.stringify(rows).includes('CHOPRA'));
});

test('terminal line-up (5): the jobs going spare, turn without its pool', () => {
  const rows = grid([
    '                              TERMINAL LINEUP                          PSTS27P',
    'DIST:  ( 45 ) SDIST:  ( SA )  SVC TYP(RD/YD):  (   )   VACANCIES ONLY(Y/N):  ( Y )',
    'POS  CALL   TIME  TZ  STATUS     TRAIN/DESC   ORGSTN  PL  CC    ST     RETN   DTTM   TURN     EMP',
    '001  10/24  0615  E   ORDERED     M39491      47130   S1  EN    * **                 S1S103',
    '002  10/24  0630  E   PLANNED    YSTY01       47130   YD  YA                         YSTY01',
    '003  10/24  0645  E   PLANNED    YPRS02       47130   YD  FO    * **   10/25  0001   YPRS02',
    '004  10/24  1310  E   PLANNED     E27861      47130   SD  EN    * **   11/02  0001   SDSD02',
    '    LAST  REFRESHED:  261024  0326  (ET)    NEXT REFRESH   AFTER:  261024  0334  (ET)',
    'END OF FILE                                                                E011-1',
  ]);
  assert.ok(S.isTerminalLineup(rows.map((r) => r.text).join('\n')));
  const jobs = S.parseTerminalLineup(rows, now);
  assert.deepEqual(jobs.map((j) => [j.pos, fmt(j.at), j.status, j.train, j.pool, j.cc, j.st, j.returns == null ? null : fmt(j.returns), j.turn, j.yard]), [
    [1, '24th 0615', 'ORDERED', 'M39491', 'S1', 'EN', '* **', null, 'S103', false],
    [2, '24th 0630', 'PLANNED', 'YSTY01', 'YD', 'YA', '', null, 'YSTY01', true],
    [3, '24th 0645', 'PLANNED', 'YPRS02', 'YD', 'FO', '* **', '25th 0001', 'YPRS02', true],
    [4, '24th 1310', 'PLANNED', 'E27861', 'SD', 'EN', '* **', '2nd 0001', 'SD02', false],
  ]);
});

test('501/502 (29): any turn id, working and away turns', () => {
  const rows = grid([
    '45 SA                    POOL MAINTENANCE INQUIRY                 PSTS02E',
    '    POOL:  ( S5 )   TERM:  ( 0 )  (0=HOME, 1-5=AWAY,   T=TURN)    CC:  (   )',
    'CC TURN  T POS      EMPLOYEE     NAME      ST   RN   RETN    SC   REST     USHR  TURN  INFO',
    'EN S501  0 001  ARCHER*+         J  JEREM',
    'CO S502  0 002  DEBIE+           J  JASON                        0635  24',
    'EN MU01  1 999  CURRAN*+         B  BRAND  B0                                      L50131  23',
  ]);
  const { turns } = S.parseChainGang(rows, now, { anyTurn: true });
  assert.deepEqual(turns.map((t) => [t.craft, t.turn, t.terminal, t.pos, t.working, t.workingOn, t.restUntil == null ? null : fmt(t.restUntil)]), [
    ['EN', 'S501', 0, 1, false, null, null],
    ['CO', 'S502', 0, 2, false, null, '24th 0635'],
    ['EN', 'MU01', 1, 999, true, 'L50131', null],
  ]);
  assert.equal(S.parseChainGang(rows, now).turns.some((t) => t.turn === 'MU01'), false); // the old rule
});

// Owner's screenshot (page 5 of 31): yard jobs list names, no turns; the
// crews in town come after them.
const yardPage = [
  '26/10/24-   351                        CN  RAIL                     PAGE  005  OF  031',
  'TRAINS  ENROUTE',
  'M38261 23  ON DUTY AT: SARNIA       26/10/24  0145',
  '           CO  SMITH*+      J   JOHN       SR03',
  '    YPRS60      REL#2  TU/WE  OFF       ON  DUTY  AT:  SARNIA           26/10/23  2245',
  '          FO   DESCHENES+      M  MATTHEW',
  '          S1   JOSEPH+         B  BRAEDEN',
  '    YSBY04       1900  YDM  BLOCK  4     ON  DUTY  AT:  SARNIA           26/10/23  1900',
  '          YA   ROBBINS*+       M  MARK',
  'CREWS  IN  TOWN',
  'POOL:  S1/SA  C+C                         RESTED/STATUS',
  '        <<   NO  CREWS  IN  TOWN    >>',
];

test('Call Board: yard jobs after the trains, stop at the crews in town', () => {
  const p = S.parseCallBoardPage(grid(yardPage), now);
  assert.deepEqual(p.trains.map((t) => t.symbol), ['M38261']);
  assert.equal(p.crewsInTown, true);
  assert.deepEqual(p.yard.map((j) => [j.job, j.station, fmt(j.onDuty), j.crew.length]), [
    ['YPRS60', 'SARNIA', '23rd 2245', 0], ['YSBY04', 'SARNIA', '23rd 1900', 0],
  ]);
});

test('yard crews matched to turns by name, in memory only', () => {
  const yard = S.parseYardCrewNames(grid(yardPage, false));
  assert.deepEqual(yard.map((y) => `${y.job} ${y.craft} ${y.key} ${y.code}`), ['YPRS60 FO DESCHENES/M MADE', 'YPRS60 S1 JOSEPH/B BRJO', 'YSBY04 YA ROBBINS/M MARO']);
  const people = S.parseBoardNames(grid([
    '    EMPLOYEE NAME         TURN  POS  ST  RN  RETN     REST',
    'DESCHENES+     M    MATT   B138  001',
    'JACOBSEN+(N/NT)N   NEIL   B142  009',
    'EN MU01  1 999  ROBBINS*+        M  MARK   B0                                      L50131  23',
  ], false));
  assert.deepEqual(people, [
    { key: 'DESCHENES/M', turn: 'B138', code: 'MADE', own: true, from: 'spare' },
    { key: 'JACOBSEN/N', turn: 'B142', code: 'NEJA', own: true, from: 'spare' },
    { key: 'ROBBINS/M', turn: 'MU01', code: 'MARO', own: false, from: 'pool' }, // away and working: maybe covering a trip
  ]);
});

test('masking: yard job ids and headings stay, names go', () => {
  for (const w of ['YPRS02', 'YSTY01', 'PLANNED', 'B138', 'S1S103']) assert.equal(maskTokenWith(w, BOARD_WORDS), w);
  for (const w of ['CHOPRA+', 'KARA', 'JACOBSEN+(N/NT)N']) assert.notEqual(maskTokenWith(w, BOARD_WORDS), w);
});

// From a saved check to the site: the new screens become pool tabs, yard
// jobs and jobs going spare, and show in a turn's history.
test('site snapshot and turn facts with the new screens', () => {
  const { snapshotOf } = require('../../lib/board/site');
  const BoardTurns = require('../../public/board-turns');
  const base = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../fixtures/board/2026-10-15b.json'), 'utf8'));
  const lines = (rows) => rows.map((line, row) => [String(row * 18), ...[...line.matchAll(/\S+/g)].map((m) => `${m.index * 9}:${maskTokenWith(m[0], BOARD_WORDS)}`)].join(' | '));
  const yardPage = base.screens.find((x) => x.screenGrid.some((l) => /ON \| \d+:DUTY/.test(l)));
  const head = yardPage.screenGrid.slice(0, 3); // the Call Board header (clock, title)
  const screens = [...base.screens,
    { screenGrid: [...head, ...lines(['', '', '', 'YPRS02 0640  S1/S1  ON DUTY AT: SARNIA    26/10/15  0640', '           FO  BROWN*+      K   KATE', '           S1  GREEN+       P   PAUL'])] },
    { label: 'co-fast', screenGrid: lines(['45 SA       SPAREBOARD INQUIRY', '    EMPLOYEE NAME         TURN  POS  ST  RN  RETN     REST    MTPD  USHR   PD    STT  #S  #O',
      'CHOPRA+       K    KARA   B138  001                                                   00  00', 'DAYE+         B    BRYS   B126  002                   0600  16                         01  00']) },
    { label: 'terminal', screenGrid: lines(['           TERMINAL LINEUP', 'POS  CALL   TIME  TZ  STATUS     TRAIN/DESC   ORGSTN  PL  CC    ST     RETN   DTTM   TURN     EMP',
      '001  10/15  0645  E   PLANNED    YPRS02       47130   YD  FO    * **   10/16  0001   YPRS02',
      '002  10/15  0700  E   PLANNED    YSTY01       47130   YD  YA                         YSTY01']) },
    { label: 's5', screenGrid: lines(['    POOL:  ( S5 )   TERM:  ( 0 )   CC:  (   )', 'CC TURN  T POS      EMPLOYEE     NAME      ST   RN   RETN    SC   REST     USHR  TURN  INFO',
      'EN S501  0 001  ARCHER*+         J  JEREM', 'CO S501  0 001  NOEL+            J  JORDA']) },
  ];
  // board-auto.js matched the yard crew to turns by name (names not saved).
  const { shown } = snapshotOf({ ...base, screens, yardCrew: [{ job: 'YPRS02', craft: 'FO', turn: 'B138' }, { job: 'YPRS02', craft: 'S1', turn: 'B126' }] });
  assert.deepEqual(shown.pools.map((p) => p.name).slice(-2), ['Conductor fast board', '501/502 (S5)']);
  // 501/502: the engineer and the conductor each get a row (owner, 2026-10-25).
  assert.deepEqual(shown.pools.find((p) => p.name === '501/502 (S5)').turns.map((t) => `${t.turn} ${t.craft}`), ['S501 EN', 'S501 CO']);
  assert.deepEqual(shown.pools.find((p) => p.name === 'Conductor fast board').turns.map((t) => `${t.pos} ${t.turn} ${t.status}`), ['001 B138 available', '002 B126 rest until 16th 0600']);
  assert.deepEqual(shown.yardJobs, [{ job: 'YPRS02', station: 'SARNIA', onDuty: '15th 0640', off: '15th 1440', crew: 'FO B138 · S1 B126' }]);
  assert.equal(shown.vacancies[0].turn, 'YPRS02');
  assert.ok(!shown.vacancies.some((v) => v.cc === 'YA')); // yardmaster jobs left off
  assert.ok(['coFast', 'terminal', 's5Pool', 'yardJobs'].every((k) => shown.screens.includes(k)));
  assert.deepEqual(BoardTurns.facts(shown, 'B126').map((f) => f.text), [
    'Conductor fast board position 002: rest until 16th 0600',
    'On duty on YPRS02 yard at Sarnia, 15th 0640 (off ~15th 1440, 8 h assumed)',
  ]);
  assert.deepEqual(BoardTurns.facts(shown, 'YPRS02').map((f) => f.kind), ['onDuty', 'spareJob']);
  assert.ok(BoardTurns.turnsIn(shown).includes('B138') && BoardTurns.turnsIn(shown).includes('YPRS02'));
  const h = BoardTurns.finish(BoardTurns.history([shown]));
  assert.equal(h.YPRS02.spares.length, 1);
  assert.equal(h.B126.orders[0].train, 'YPRS02');
});

// Owner, 2026-10-24: a spare person filling in for someone absent shows on
// the Call Board under that job's turn; found by name, kept as turns only.
test('spare person filling in: job turn vs their own turn', () => {
  const crew = S.parseTrainCrewNames(grid(yardPage, false));
  assert.deepEqual(crew, [{ train: 'M38261 23', craft: 'CO', job: 'SR03', key: 'SMITH/J', code: 'JOSM' }]);
  const BoardTurns = require('../../public/board-turns');
  const s = { onDuty: [{ train: 'M38261 23', station: 'SARNIA', onDuty: '24th 0145', crew: 'CO SR03', backfill: [{ craft: 'CO', job: 'SR03', turn: 'B138' }] }] };
  assert.deepEqual(BoardTurns.facts(s, 'B138').map((f) => f.text), ['On duty on M38261 23 at Sarnia, 24th 0145, working SR03 (CO)']);
  assert.deepEqual(BoardTurns.facts(s, 'SR03').map((f) => f.text), ['On duty on M38261 23 at Sarnia, 24th 0145 (worked by B138)']);
  assert.ok(BoardTurns.turnsIn(s).includes('B138'));
  const h = BoardTurns.finish(BoardTurns.history([{ ...s, taken: '2026-10-24 0200' }]));
  assert.equal(h.B138.orders[0].train, 'M38261 23');
});

// Owner, 2026-10-24: yard jobs off the fast board, road jobs off the slow
// board, engineer jobs off the engineer boards, in board order; a spare on
// rest at the call is skipped and keeps its place.
test('who fills the jobs going spare', () => {
  const { spareFills } = require('../../lib/board/site');
  const v = (train, cc, yard, h, m) => ({ train, cc, yard, at: at(2026, 10, 24, h, m) });
  const sb = (turn, pos, rest = null) => ({ turn, pos, restUntil: rest });
  const jobs = [v('M39491', 'EN', false, 6, 15), v('YSTY01', 'YA', true, 6, 30), v('YPRS02', 'FO', true, 6, 45), v('M38261', 'CO', false, 15, 40)];
  const boards = {
    coFast: [sb('B138', 1, at(2026, 10, 24, 5, 0)), sb('B147', 2), sb('B119', 3)],
    coSlow: [sb('B201', 1, at(2026, 10, 24, 14, 0))],
    enSlow: [sb('E301', 1)],
  };
  const f = spareFills(jobs, boards);
  assert.deepEqual(jobs.map((j) => { const x = f.get(j); return [x.turn, x.board, fmt(x.call), x.skipped.join()]; }), [
    ['E301', 'Engineer slow board', '24th 0400', ''],
    ['B147', 'Conductor fast board', '24th 0430', 'B138 (rest until 24th 0500)'],
    ['B119', 'Conductor fast board', '24th 0445', 'B138 (rest until 24th 0500)'],
    ['', 'Conductor slow board', '24th 1325', 'B201 (rest until 24th 1400)'], // still resting at the call: no one free
  ]);
  assert.equal(spareFills([v('YXXX01', 'YE', true, 7, 0)], {}).values().next().value, null); // board not read
});

// Owner, 2026-10-24: hidden search by a short code from a name (Justin
// O'Dea → JUOD); only a hash of it is saved, with the turn.
test('person codes and sightings', () => {
  const { personCode, personHash, addSightings } = require('../../lib/board/people');
  assert.equal(personCode("O'DEA", 'JUSTIN'), 'JUOD');
  assert.equal(personCode('DE MAN', 'MIKE'), 'MIDE');
  assert.equal(personCode('LI', 'J'), null); // first name cut to an initial: no code
  assert.equal(personHash('juod'), personHash('JUOD'));
  assert.equal(personHash('JUOD').length, 16);
  const h = personHash('JUOD');
  const into = {};
  addSightings(into, [{ h, turn: 'B138', own: true }], '2026-10-24 0800');
  addSightings(into, [{ h, turn: 'B138', own: true }, { h, turn: 'SR03' }], '2026-10-24 0805');
  addSightings(into, [{ h, turn: 'B138', own: true }], '2026-10-24 1200'); // a gap: a new stretch
  assert.deepEqual(into[h], [
    { turn: 'B138', own: true, from: '2026-10-24 0800', to: '2026-10-24 0805' },
    { turn: 'SR03', own: false, from: '2026-10-24 0805', to: '2026-10-24 0805' },
    { turn: 'B138', own: true, from: '2026-10-24 1200', to: '2026-10-24 1200' },
  ]);
});

// Owner, 2026-10-25: yesterday's YPRS60 on duty (23rd 2245) mustn't count
// tonight's YPRS60 vacancies (24th 2245) as filled; in board order: YPRS60
// FO, YPRS60 S1, then YBHS61.
test('jobs going spare: the same job yesterday is not this one', () => {
  const { spareFills, onDutyAlready } = require('../../lib/board/spares');
  const v = (train, cc, h, m, d = 24) => ({ train, cc, yard: true, at: at(2026, 10, d, h, m) });
  const jobs = [v('YPRS60', 'FO', 22, 45), v('YPRS60', 'S1', 22, 45), v('YBHS61', 'FO', 23, 0)];
  const yard = [{ job: 'YPRS60', onDuty: at(2026, 10, 23, 22, 45) }];
  assert.equal(onDutyAlready(jobs[0], yard, []), false);
  assert.equal(onDutyAlready(v('YPRS60', 'FO', 22, 45, 23), yard, []), true);
  const sb = (turn, pos) => ({ turn, pos, restUntil: null });
  const f = spareFills(jobs.filter((j) => !onDutyAlready(j, yard, [])), { coFast: [sb('B119', 1), sb('B111', 2), sb('B134', 3)] });
  assert.deepEqual(jobs.map((j) => f.get(j).turn), ['B119', 'B111', 'B134']);
});

// Owner, 2026-10-25: B0 on the slow board holds the spot while working, but
// isn't called; the next one is.
test('jobs going spare: a B0 turn keeps its spot but is passed over', () => {
  const { spareFills } = require('../../lib/board/spares');
  const job = { train: 'M38261', cc: 'CO', yard: false, at: at(2026, 10, 25, 15, 40) };
  const f = spareFills([job], { coSlow: [{ turn: 'B201', pos: 1, st: 'B0', restUntil: null }, { turn: 'B202', pos: 2, restUntil: null }] }).get(job);
  assert.equal(f.turn, 'B202');
  assert.deepEqual(f.skipped, ['B201 (B0, working)']);
});

// Owner, 2026-10-25: B132 on a hold turn until the 26th was lined up for
// DHT031B; held turns are passed over, and a deadhead's call is 2 h before.
test('jobs going spare: hold turns passed over; deadhead call', () => {
  const { spareFills } = require('../../lib/board/spares');
  const job = { train: 'DHT031B', cc: 'CO', yard: false, at: at(2026, 10, 25, 4, 30) };
  const f = spareFills([job], { coSlow: [
    { turn: 'B132', pos: 1, rn: 'HT', statusUntil: at(2026, 10, 26, 8, 40), restUntil: at(2026, 10, 24, 18, 40) },
    { turn: 'B147', pos: 2, restUntil: null },
  ] }).get(job);
  assert.equal(f.turn, 'B147');
  assert.deepEqual(f.skipped, ['B132 (hold turn until 26th 0840)']);
  assert.equal(fmt(f.call), '25th 0230');
});

// Owner, 2026-10-25: whose turn is whose, saved with hashed names. Spareboard
// = own turn; a pool turn at home and not working = own turn (a temporary
// assignment beats the spareboard); away or working never counts.
test('turn holders: the rules, and no names in the file', () => {
  const H = require('../../lib/board/holders');
  const now = Date.UTC(2026, 9, 25);
  let h = H.learn({}, [{ key: "O'DEA/J", turn: 'B119', own: true, from: 'spare' }], now);
  assert.equal(H.turnOf(h, "O'DEA/J"), 'B119');
  assert.ok(!JSON.stringify(h).includes('DEA'));
  // Away or working on the Chain Gang (covering a trip): still B119.
  h = H.learn(h, [{ key: "O'DEA/J", turn: 'SR03', own: false, from: 'pool' }], now + 1);
  assert.equal(H.turnOf(h, "O'DEA/J"), 'B119');
  // A temporary assignment: home on the Chain Gang, even if also on a spareboard list that check.
  h = H.learn(h, [{ key: "O'DEA/J", turn: 'B119', own: true, from: 'spare' }, { key: "O'DEA/J", turn: 'SR03', own: true, from: 'pool' }], now + 2);
  assert.equal(H.turnOf(h, "O'DEA/J"), 'SR03');
  // Two different spareboard turns in one check: unsure.
  assert.equal(H.turnOf(H.learn({}, [{ key: 'X/Y', turn: 'B1', own: true, from: 'spare' }, { key: 'X/Y', turn: 'B2', own: true, from: 'spare' }], now), 'X/Y'), null);
  // Forgotten after 90 days unseen.
  assert.equal(H.turnOf(H.learn(h, [], now + 91 * 864e5), "O'DEA/J"), null);
});

// Owner, 2026-10-25: TV beside a name on a pool list: that turn is going
// spare and the person is on another one, so it isn't their own turn.
test('turn holders: TV on a pool row is not their own turn', () => {
  const people = S.parseBoardNames(grid([
    "EN S501  0 001  O'DEA+          J  JUSTI  TV",
    "CO SR03  0 004  O'DEA+          J  JUSTI",
  ], false));
  assert.deepEqual(people.map((p) => [p.turn, p.own]), [['S501', false], ['SR03', true]]);
  const H = require('../../lib/board/holders');
  assert.equal(H.turnOf(H.learn({}, people, 1), "O'DEA/J"), 'SR03');
});

// Owner's screenshot (29, 2026-10-25): TV in ST with RETN 0559 26 on S501;
// NITZ+ CHRISTOP with no initial still matched.
test('501/502 as on the screen: TV going spare, a name with no initial', () => {
  const lines = [
    '    POOL:  ( S5 )   TERM:  ( 0 )   CC:  (   )',
    'CC TURN  T POS      EMPLOYEE     NAME      ST   RN   RETN    SC   REST     USHR  TURN  INFO',
    'EN S501  0 001  STUBBS*+         C  CHAD',
    "CO S501  0 001  O'DEA+           J  JUSTI  TV        0559 26",
    'CO S502  0 002  NITZ+            CHRISTOP  **   **   1026',
  ];
  const t = S.parseChainGang(grid(lines), now, { anyTurn: true }).turns.find((x) => x.craft === 'CO' && x.turn === 'S501');
  assert.equal(t.st, 'TV');
  assert.equal(fmt(t.statusUntil), '26th 0559');
  assert.equal(require('../../lib/board/view').gangStatus(t, now), 'TV (temporary vacancy): goes spare, holder back 26th 0559');
  const people = S.parseBoardNames(grid(lines, false));
  assert.deepEqual(people.map((p) => [p.turn, p.key, p.own]), [['S501', 'STUBBS/C', true], ['S501', "O'DEA/J", false], ['S502', 'NITZ/C', true]]);
});

// Owner's Chain Gang screenshot (2026-10-25): names with (NET), with no
// initial, and a two-word surname; JUOD at home on SR03 with ** HT is still SR03.
test('Chain Gang names as on the screen', () => {
  const people = S.parseBoardNames(grid([
    'CO SR08  0 001  WATTS*+ (NET) B   BRAND   **   HT 1910 26   1910 25',
    "CO SR03  0 004  O'DEA+          J  JUSTI   **   HT 0559 26",
    'CO SR05  0 009  GREYDANUS*+(NET)   GARRE   **   ** 0600 26',
    'CO MU01  1 002  DE MAN+         M  MICHA                    1804 25',
  ], false));
  assert.deepEqual(people.map((p) => [p.turn, p.key, p.code, p.own]), [
    ['SR08', 'WATTS/B', 'BRWA', true], ['SR03', "O'DEA/J", 'JUOD', true], ['SR05', 'GREYDANUS/G', 'GAGR', true], ['MU01', 'DE MAN/M', 'MIDE', false],
  ]);
});
