// Upcoming days off (Train Service 4; owner, 2026-11-05): the screen, the
// memory, and what it changes: the order, the spares, the runaround log.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGrid } = require('../../lib/board/grid');
const S = require('../../lib/board/screens');
const DaysOff = require('../../lib/board/daysoff');
const { runBoardCheck } = require('../../lib/board/engine');
const { spareFills } = require('../../lib/board/spares');
const { loadSummary } = require('../../lib/board/summary');
const Insights = require('../../lib/board/insights');
const { at, fmt } = require('../../lib/board/time');
const { maskTokenWith, BOARD_WORDS } = require('../../lib/board/capture');

const grid = (lines) => lines.map((line, row) => [String(row * 18), ...[...line.matchAll(/\S+/g)].map((m) => `${m.index * 9}:${maskTokenWith(m[0], BOARD_WORDS)}`)].join(' | '));

// The owner's screenshot, 2026-11-05.
const SCREEN = [
  '                              UPCOMING DAYS OFF                         PSTS02M',
  '                          ASSIGNMENT TYPE:  [ ] (A/U/X)',
  'MO/DY/TIME  DDSD  LEAVE-TYPE  STAT  NAME                               ASSIGNMENT',
  '11/06-0001   45SA      OFF             MARTIN*+        J  JIMMY        U-45SAS1S102ET',
  '11/06-0001   45SA      OFF       A     HAYNES*+        D  DEREK        A-45SAYSBY03YA',
  '11/06-0001   45SA      OFF       A     WALSH+          T  TAYLOR       U-45SASASA09CO',
  '11/07-0001   45SA      OFF       B     GOODHUE*+       C  CHRIS        U-45SAS1S106EN',
  '11/07-0001   45SA      OFF       A     HAUGH+          J  JOSEPH       U-45SASRSR10CO',
  '11/07-0500   45SA      OFF       A     CROTEAU*+       PA PIERRE       U-45SAS1S104ET',
  ' ENTER=INQUIRE    F1=HELP    F3=EXIT    F7=PAGEUP    F8=PAGEDN    F11=PREV  MENU',
  'RECORD DISPLAYED                                                     R037-1',
];
const NOW = at(2026, 11, 5, 14, 0);

test('days off (4): read from the screen, no names kept', () => {
  const lines = grid(SCREEN);
  const rows = parseGrid(lines);
  assert.ok(S.isDaysOff(rows.map((r) => r.text).join('\n')));
  const list = S.parseDaysOff(rows, NOW);
  assert.deepEqual(list.map((d) => [fmt(d.from), d.turn, d.pool, d.craft, d.type, d.stat, d.yard]), [
    ['6th 0001', 'S102', 'S1', 'ET', 'U', '', false],
    ['6th 0001', 'YSBY03', '', 'YA', 'A', 'A', true],
    ['6th 0001', 'SA09', 'SA', 'CO', 'U', 'A', false],
    ['7th 0001', 'S106', 'S1', 'EN', 'U', 'B', false],
    ['7th 0001', 'SR10', 'SR', 'CO', 'U', 'A', false],
    ['7th 0500', 'S104', 'S1', 'ET', 'U', 'A', false],
  ]);
  const saved = JSON.stringify(lines);
  for (const name of ['MARTIN', 'HAYNES', 'WALSH', 'GOODHUE', 'HAUGH', 'CROTEAU', 'JIMMY', 'PIERRE']) assert.ok(!saved.includes(name), name);
});

test('days off: 24 h from the time shown, remembered until they end', () => {
  const read = [{ from: at(2026, 11, 6, 0, 1), turn: 'SR10', craft: 'CO' }];
  const kept = DaysOff.merge([], read, NOW);
  assert.equal(fmt(kept[0].until), '7th 0001');
  // Gone from option 4 once it started: still off.
  assert.equal(DaysOff.merge(kept, [], at(2026, 11, 6, 12, 0)).length, 1);
  assert.equal(DaysOff.merge(kept, [], at(2026, 11, 7, 0, 1)).length, 0);
});

test('days off: a Chain Gang / SD turn off at the call takes it and goes spare (owner); an A turn too', () => {
  const off = [{ from: at(2026, 11, 6, 0, 1), until: at(2026, 11, 7, 0, 1) }];
  const gang = [
    { craft: 'CO', turn: 'SR10', terminal: 0, pos: 1, restUntil: null, statusUntil: null, off },
    { craft: 'CO', turn: 'SR02', terminal: 0, pos: 2, restUntil: null, statusUntil: null },
  ];
  const dh = (h) => ({ order: at(2026, 11, 6, h, 0), symbol: 'DHT999B', trainNo: 'DHT999', originDay: '06', status: 'PLN', deadhead: true });
  const sd = [{ craft: 'EN', turn: 'SD01', terminal: 0, pos: 1, restUntil: null, statusUntil: null, off }, { craft: 'EN', turn: 'SD02', terminal: 0, pos: 2, restUntil: null, statusUntil: null }];
  const p = runBoardCheck({ now: NOW, callBoard: [], chainGangHome: gang, sdHome: sd, lineup: [dh(10)] }).predictions[0];
  assert.deepEqual([p.turn, p.spare, p.engineer, p.engineerSpare], ['SR10', true, 'SD01', true]);
  assert.match(p.reason, /SR10 is PL @ 6th 0001 at the call → the turn goes out with a spareboard employee/);
  // Called before the days off start: SR10 goes.
  const early = { ...dh(1), order: at(2026, 11, 5, 23, 0), originDay: '05' };
  assert.equal(runBoardCheck({ now: NOW, callBoard: [], chainGangHome: gang, lineup: [early] }).predictions[0].turn, 'SR10');

  const a = runBoardCheck({ now: NOW, callBoard: [], chainGangHome: [], aHome: [{ craft: 'CO', turn: 'SA09', terminal: 0, pos: 1, restUntil: null, statusUntil: null, off }],
    lineup: [{ order: at(2026, 11, 6, 10, 0), symbol: 'M30241', trainNo: 'M302', originDay: '06', status: 'PLN', deadhead: false }] }).predictions[0];
  assert.deepEqual([a.pool, a.turn, a.spare], ['A', 'SA09', true]);
  assert.match(a.reason, /It's PL @ 6th 0001 at the call/);
});

test('days off: a spare off at the call is passed over', () => {
  const off = [{ from: at(2026, 11, 6, 0, 1), until: at(2026, 11, 7, 0, 1) }];
  const job = { train: 'M30241', at: at(2026, 11, 6, 12, 0), cc: 'CO', yard: false };
  const fills = spareFills([job], { coSlow: [{ turn: 'B111', pos: 1, off }, { turn: 'B133', pos: 2 }] });
  const f = fills.get(job);
  assert.equal(f.turn, 'B133');
  assert.match(f.skipped[0], /B111 \(PL @ 6th 0001\)/);
});

test('days off: put on the pool rows by turn and craft; shown in the status', () => {
  const s = loadSummary({ probedAt: '2026-11-05T19:00:00Z', screens: [{ screenGrid: grid(SCREEN), label: 'daysOff' }],
    daysOffKnown: [{ from: at(2026, 11, 5, 6, 0), until: at(2026, 11, 6, 6, 0), turn: 'SR05', craft: 'CO' }] }, { now: NOW });
  assert.ok(s.seen.daysOff);
  assert.equal(s.daysOff.length, 7); // 6 read + 1 remembered, still on
  assert.ok(s.daysOff.some((d) => d.turn === 'SR05'));
  const V = require('../../lib/board/view');
  // Owner, 2026-11-05: "Can you have it say PL @ 6th 0001. Also show it going spare."
  assert.equal(V.gangStatus({ turn: 'SA09', off: [{ from: at(2026, 11, 6, 0, 1), until: at(2026, 11, 7, 0, 1) }] }, NOW), 'PL @ 6th 0001 · goes spare');
  assert.equal(V.gangStatus({ turn: 'SR05', off: [{ from: at(2026, 11, 5, 6, 0), until: at(2026, 11, 6, 6, 0) }] }, NOW), 'PL @ 5th 0600 · goes spare until 6th 0600');
  // Engineer days off don't touch the conductor row of the same turn.
  const rows = [{ turn: 'S106', craft: 'CO' }, { turn: 'S106', craft: 'EN' }];
  DaysOff.attach(rows, s.daysOff, (r) => DaysOff.side(r.craft));
  assert.deepEqual(rows.map((r) => !!r.off), [false, true]);
  // A trainee's day off (S104 ET) leaves S104's engineer working.
  const s104 = [{ turn: 'S104', craft: 'EN' }];
  DaysOff.attach(s104, s.daysOff, (r) => DaysOff.side(r.craft));
  assert.equal(s104[0].off, undefined);
  // Not even on a trainee's own row (owner: they're never replaced).
  const tt = [{ turn: 'S104', craft: 'ET' }];
  DaysOff.attach(tt, s.daysOff, (r) => DaysOff.side(r.craft));
  assert.equal(tt[0].off, undefined);
});

test('runaround log: a turn on days off at the call is explained', () => {
  const lineRow = { train: 'DHT024B 06', order: '6th 0900', call: '6th 0700', status: 'ORD', crew: { co: 'SR10', en: 'SD01' }, rules: 'Chain Gang: SR10 + SD01' };
  const snap0 = (st) => ({ taken: '2026-11-06 0646', lineup: [lineRow], pools: [{ name: 'Chain Gang (SR) · conductors', turns: [{ pos: '001', turn: 'SR10', status: st }] }, { name: 'SD · engineers', turns: [{ pos: '001', turn: 'SD01', status: 'available' }] }] });
  const went = { taken: '2026-11-06 0653', lineup: [], onDuty: [{ train: 'DHT024B 06', onDuty: '6th 0900', crew: 'EN SD01 · CO SR02' }] };
  const r = (st) => Insights.finish(Insights.collect([snap0(st), went])).runLog.find((x) => x.passed === 'SR10');
  assert.equal(r('PL @ 6th 0001 · goes spare').result, 'explained');
  assert.equal(r('PL @ 5th 1000 · goes spare until 6th 1000').result, 'explained');
  // Days off starting after the call, or over before it: still a likely runaround.
  assert.equal(r('PL @ 6th 1200 · goes spare').result, 'likely');
  assert.equal(r('PL @ 5th 0600 · goes spare until 6th 0600').result, 'likely');
});

// Owner, 2026-11-05 (JUOD on S501 CO): S501 home, on rest until 6th 0640,
// past L50231 06's call (6th 0145): "I won't work this and it will go
// spare". The card says so; and no L502 alert while the crew is away.
test('L502: the card says it goes spare; no alert until the crew is off duty in Sarnia', () => {
  const { describeMe } = require('../../lib/board/report');
  const { turnStates } = require('../../lib/board/alerts');
  const now = at(2026, 11, 5, 7, 19);
  const row = (craft, turn, o = {}) => ({ craft, turn, terminal: 0, pos: 1, working: false, st: null, rn: null, statusUntil: null, restUntil: null, ...o });
  const s5 = [row('EN', 'S501', { restUntil: at(2026, 11, 6, 6, 40) }), row('CO', 'S501', { restUntil: at(2026, 11, 6, 6, 40) }),
    row('EN', 'S502', { pos: 999, working: true, workingOn: 'L50231' }), row('CO', 'S502', { pos: 999, working: true, workingOn: 'L50231' })];
  const l502 = (day, h) => ({ symbol: 'L50231', trainNo: 'L502', originDay: day, order: at(2026, 11, +day, h, 0), status: 'PLN', deadhead: false });
  const lineup = [l502('06', 4), l502('07', 4)];
  const r = runBoardCheck({ now, callBoard: [], chainGangHome: [], lineup, s5, me: 'S501' });
  assert.match(describeMe(r.me).join(' '), /L50231 06: called ~6th 0145.*Conductor on rest until 6th 0640 → goes spare; engineer on rest until 6th 0640 → goes spare/);
  // L50231 07 goes to S502, out on a 502 to Garnet: not told yet. S501 (home) is.
  const st = turnStates(r, [], { s5 });
  assert.equal(st['S501-CO'].lineup.train, 'L50231 06');
  assert.ok(!st['S502-CO'] || !st['S502-CO'].lineup);
  assert.ok(!st.S502 || !st.S502.lineup);
});
