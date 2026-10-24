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

test('Call Board: yard jobs after the trains, stop at the crews in town', () => {
  const rows = grid([
    'M38261 23  ON DUTY AT: SARNIA       26/10/24  0145',
    '           CO  SMITH*+      J   JOHN       SR03',
    'YPRS02 0640  S1/S1  ON DUTY AT: SARNIA    26/10/24  0640',
    '           FO  BROWN*+      K   KATE       YPRS02',
    '           S1  GREEN+       P   PAUL       B126',
    'YSTY01 0700  ON DUTY AT: SARNIA',
    '           FO  WHITE+       A   ANNE       B138',
    'CREWS IN TOWN POOL: S1/SA C+C RESTED/STATUS',
    'YZZZ01 0800  ON DUTY AT: SARNIA    26/10/24  0800',
  ]);
  const p = S.parseCallBoardPage(rows, now);
  assert.deepEqual(p.trains.map((t) => t.symbol), ['M38261']);
  assert.equal(p.crewsInTown, true);
  assert.deepEqual(p.yard.map((j) => [j.job, j.station, fmt(j.onDuty), j.crew.map((c) => `${c.craft} ${c.turn}`).join(', ')]), [
    ['YPRS02', 'SARNIA', '24th 0640', 'FO YPRS02, S1 B126'],
    ['YSTY01', 'SARNIA', '24th 0700', 'FO B138'],
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
    { screenGrid: [...head, ...lines(['', '', '', 'YPRS02 0640  S1/S1  ON DUTY AT: SARNIA    26/10/15  0640', '           FO  BROWN*+      K   KATE       YPRS02', '           S1  GREEN+       P   PAUL       B126'])] },
    { label: 'co-fast', screenGrid: lines(['45 SA       SPAREBOARD INQUIRY', '    EMPLOYEE NAME         TURN  POS  ST  RN  RETN     REST    MTPD  USHR   PD    STT  #S  #O',
      'CHOPRA+       K    KARA   B138  001                                                   00  00', 'DAYE+         B    BRYS   B126  002                   0600  16                         01  00']) },
    { label: 'terminal', screenGrid: lines(['           TERMINAL LINEUP', 'POS  CALL   TIME  TZ  STATUS     TRAIN/DESC   ORGSTN  PL  CC    ST     RETN   DTTM   TURN     EMP',
      '001  10/15  0645  E   PLANNED    YPRS02       47130   YD  FO    * **   10/16  0001   YPRS02']) },
    { label: 's5', screenGrid: lines(['    POOL:  ( S5 )   TERM:  ( 0 )   CC:  (   )', 'CC TURN  T POS      EMPLOYEE     NAME      ST   RN   RETN    SC   REST     USHR  TURN  INFO',
      'EN S501  0 001  ARCHER*+         J  JEREM', 'CO S501  0 001  NOEL+            J  JORDA']) },
  ];
  const { shown } = snapshotOf({ ...base, screens });
  assert.deepEqual(shown.pools.map((p) => p.name).slice(-2), ['Conductor fast board', '501/502 (S5)']);
  assert.deepEqual(shown.pools.find((p) => p.name === 'Conductor fast board').turns.map((t) => `${t.pos} ${t.turn} ${t.status}`), ['001 B138 available', '002 B126 rest until 16th 0600']);
  assert.deepEqual(shown.yardJobs, [{ job: 'YPRS02', station: 'SARNIA', onDuty: '15th 0640', off: '15th 1440', crew: 'FO YPRS02 · S1 B126' }]);
  assert.equal(shown.vacancies[0].turn, 'YPRS02');
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
