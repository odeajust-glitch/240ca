// Toronto South (owner, 2026-11-14). Asked how the one confirming check should
// work, he wrote: "IF you see a Sarnia crew on a train then its not a possible
// toronto south crew. if you see a train in the line up in mac yard and then
// fall off 8 hours before its was supposed to get called. Check the Toronto
// South call board 4 hours before the suspected call time, at the suspected
// call time, and 2 hours after the suspected call time to see if the train is
// there. we can have a list of train ids to look for to see if a TS crew is on
// one of our trains departing mac yard".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { at } = require('../../lib/board/time');
const { onCallBoard, torontoCrews, torontoSouth } = require('../../lib/board/toronto');
const { snapshotOf } = require('../../lib/board/site');
const { turnStates, turnEvents } = require('../../lib/board/alerts');
const BoardTurns = require('../../public/board-turns');

const fixture = (name) => fs.readFileSync(path.join(__dirname, '../fixtures/board', name));

// --- 1. A Sarnia crew on the train: it is not a possible Toronto South crew ---

const mac = (symbol, h, status = 'ORD', extra = {}) => ({ symbol, originDay: '15', status, order: at(2026, 10, 15, h, 0), deadhead: false, ...extra });
const called = (symbol, en, co, h = 9) => ({ symbol, originDay: '15', station: 'TORONTO', onDuty: at(2026, 10, 15, h, 45), crew: [{ craft: 'EN', turn: en }, { craft: 'CO', turn: co }] });

test('Sarnia crew on the train: no bunkhouse crew for it, and never possible Toronto South', () => {
  // Called at 0800 for the 1000 order: SD12 + SR01 left the bunkhouse when called.
  const trains = [mac('M30131', 10), mac('Q13931', 14)];
  const crews = [{ pos: 1, en: 'S304', co: 'SB04', restUntil: at(2026, 10, 15, 9, 0) }, { pos: 2, en: 'SD11', co: 'SR05', restUntil: null }];
  // Before: the called train looked crewless (S304 + SB04 on rest at its call) → "possible Toronto South".
  assert.deepEqual(torontoCrews(trains, crews), [1, 0]);
  const before = torontoCrews([mac('M30131', 10)], [crews[0]]);
  assert.deepEqual(torontoSouth([mac('M30131', 10)], [crews[0]], before), [0]);
  // Now: on the Call Board it has its crew; the bunkhouse crews go to the trains still waiting.
  const board = onCallBoard(trains, crews, [called('M30131', 'SD12', 'SR01')]);
  assert.deepEqual([...board.called.keys()], ['M30131 15']);
  assert.deepEqual([...board.busy], []);
  const pick = torontoCrews(trains, crews, board);
  assert.deepEqual(pick, [-1, 0]);
  assert.deepEqual(torontoSouth(trains, crews, pick, board), [-1, -1]);
  assert.deepEqual(torontoSouth([mac('M30131', 10)], [crews[0]], null, onCallBoard([mac('M30131', 10)], [crews[0]], [called('M30131', 'SD12', 'SR01')])), [-1]);
  // Ordered with no rested crew and NOT on the Call Board: still possible Toronto South.
  assert.deepEqual(torontoSouth([mac('M30131', 10)], [crews[0]], null, onCallBoard([mac('M30131', 10)], [crews[0]], [])), [0]);
});

test('Sarnia crew on the train: a called crew still listed in the bunkhouse is no one else\'s', () => {
  const trains = [mac('M30131', 10), mac('Q13931', 14)];
  const crews = [{ pos: 1, en: 'S304', co: 'SB04', restUntil: null }, { pos: 2, en: 'SD11', co: 'SR05', restUntil: null }];
  const board = onCallBoard(trains, crews, [called('M30131', 'S304', 'SB04')]);
  assert.deepEqual([...board.busy], [0]);
  assert.deepEqual([...board.busyOn], [[0, 'M30131 15']]);
  assert.deepEqual(torontoCrews(trains, crews, board), [-1, 1]); // Q13931 gets SD11 + SR05, not the called crew
  // MU turns are placeholders many people get: a bunkhouse MU01 isn't the called train's MU01 by that alone.
  const mu = [{ pos: 1, en: 'SD08', co: 'MU01', restUntil: null }, { pos: 2, en: 'MU04', co: 'MU01', restUntil: null }];
  assert.deepEqual([...onCallBoard(trains, mu, [called('M30131', 'SD12', 'MU01')]).busy], []);
  assert.deepEqual([...onCallBoard(trains, mu, [called('M30131', 'SD08', 'MU01')]).busy], [0]); // its regular turn matches
  assert.deepEqual([...onCallBoard(trains, mu, [called('M30131', 'MU04', 'MU01')]).busy], [1]); // both MU turns match
});

// The owner's screenshots of 2026-10-17 (as test/board/site.test.js uses them): the bunkhouse (28) and the
// Mac yard line-up (41, 41975 W). Here M30131 15 is ordered, and a Call Board page shows it with a Sarnia crew.
function macScreens({ m301 = 'ORD' } = {}) {
  const head = [
    '1 | 10:45 | 37:SA | 235:POOL AAAAAAAAAAA AAAAAAA | 640:AAAA99A',
    '37 | 46:POOL: | 100:( | 118:S1 | 145:) | 181:TERM: | 235:( | 253:1 | 271:) | 289:(9=AAAA, 9-9=AAAA, | 460:A=AAAA) | 550:CC: | 586:( | 604:[] | 631:)',
    '55 | 73:AAAAAAAA POOL- AAA | 469:AAAAAAAA | 550:AT: | 586:( | 712:)',
    '73 | 10:CC | 37:TURN | 82:T | 100:POS | 136:EMPLOYEE NAME | 343:ST | 379:RN | 415:AAAA | 478:SC | 514:REST | 577:AAAA | 622:TURN | 667:AAAA',
  ];
  const crew = (y, pos, en, co, rest) => [
    `${y} | 10:EN | 37:${en} | 82:1 | 100:${pos} | 136:AAAAA${rest ? ` | 505:${rest} | 550:15` : ''} | 622:99/AA/A9-9`,
    `${y + 18} | 10:CO | 37:${co} | 82:1 | 100:${pos} | 136:AAAAA${rest ? ` | 505:${rest} | 550:15` : ''} | 622:99/AA/AA-9`,
    `${y + 36} | 10:B1`,
  ];
  // Every crew on rest past M30131's 0830 call (order 1045 − 2 h 15).
  const bunk = [...head, ...crew(91, '001', 'S304', 'SB04', '0930'), ...crew(163, '002', 'SD11', 'SR05', '0900'),
    ...crew(235, '003', 'MU04', 'MU01', '1429')];
  const line = [
    '1 | 226:TRAIN LINE UP FIELD INQUIRY | 649:PSTS02H',
    '37 | 10:STATION | 82:( | 100:[41975] | 154:) | 181:DIR | 217:( | 235:[W] | 253:) | 280:POOL | 325:( | 343:[S1] | 370:) | 397:HOURS IN FUTURE | 541:( | 559:[24] | 586:) | 604:DEFAULT=16',
    '91 | 10:MMDD-HRMN | 100:Z | 118:STA | 154:TRAIN/ASGN | 253:ORSTN | 379:INFORMATION | 586:ENG CRW | 658:TRN CRW',
    `109 | 10:1015-1045 | 100:E | 118:${m301} | 163:M30131 | 226:15 | 253:41975 | 307:TOPC | 352:300SAR | 433:A | 451:EnCo | 586:45SAS11 | 658:45SAS11`,
    '127 | 10:1015-1430 | 100:E | 118:PLN | 163:Q13931 | 226:15 | 253:42368 | 307:TOPC | 352:100SAR | 433:A | 451:EnCo | 586:45SAS11 | 658:45SAS11',
    '145 | 10:1015-1645 | 100:E | 118:PLN | 163:Z14931 | 226:15 | 253:42368 | 307:TOPC | 352:149 | 433:A | 451:EnCo | 586:45SAS11 | 658:45SAS11',
    '415 | 10:END | 46:OF | 73:FILE | 640:E011-1',
  ];
  return [{ screenGrid: bunk, label: 'bunkhouse' }, { screenGrid: line, label: 'mac' }];
}
// A Call Board page, as the checker saves it, with these trains on it.
function callBoardPage(trains) {
  return { screenGrid: [
    '1 | 19:26/10/15-0815 | 352:CN | 379:AAAA | 586:PAGE | 631:004 | 667:OF | 694:031',
    '19 | 343:SARNIA',
    '37 | 289:CALL | 334:BOARD | 388:AAAAAA | 595:CNP27N',
    '73 | 19:TRAINS | 82:AAAAAAA',
    ...trains.flatMap(([sym, od, station, date, time, en, co], i) => [
      `${109 + i * 72} | 46:${sym} | 109:${od} | 154:ON | 181:DUTY | 226:AT: | 262:${station} | 451:${date} | 532:${time}`,
      `${127 + i * 72} | 100:EN | 136:AAAAA*+ | 262:A | 289:AAAAA | 388:${en}`,
      `${145 + i * 72} | 100:CO | 136:AAAAA*+ | 262:A | 289:AAAAA | 388:${co}`,
    ]),
    '397 | 91:AAAAA=AAA\\AAAAAAA | 298:F3=EXIT | 415:F7=PAGEUP | 550:F8=PAGEDN',
  ] };
}

test('site: an ordered Mac yard train already on the Call Board shows its Sarnia crew, not "possible Toronto South"', () => {
  const fx = JSON.parse(fixture('2026-10-15b.json')); // check taken 15th 0815
  // Without the Call Board line: S304 + SB04 are on rest until 0930, past M30131's 0830 call → no crew,
  // possible Toronto South (and before 2026-11-14 that's what the site said, though a Sarnia crew had it).
  const without = snapshotOf({ ...fx, screens: [...fx.screens, ...macScreens()] }).shown;
  const m0 = without.macLineup.find((t) => t.train === 'M30131 15');
  assert.equal(m0.called, null);
  assert.equal(m0.crew, '');
  assert.ok(m0.south);
  // With it: SD12 + SR01 are on the Call Board for M30131 15, on duty at Toronto 1030.
  const board = callBoardPage([['M30131', '15', 'TORONTO', '26/10/15', '1030', 'SD12', 'SR01']]);
  const { shown } = snapshotOf({ ...fx, screens: [...fx.screens, board, ...macScreens()] });
  const m = shown.macLineup.find((t) => t.train === 'M30131 15');
  assert.deepEqual(m.called, { crew: 'SD12 + SR01', en: 'SD12', co: 'SR01', onDuty: '15th 1030', station: 'TORONTO' });
  assert.equal(m.south, null);
  assert.equal(m.crew, '');
  assert.equal(m.pred, null); // a prediction is never the Call Board's crew (the call tracker scores predictions)
  assert.deepEqual(m.skipped, []);
  // The bunkhouse crews take the trains still waiting, in order, as before the call.
  assert.deepEqual(shown.macLineup.map((t) => [t.train, t.crew]), [
    ['M30131 15', ''], ['Q13931 15', 'S304 + SB04'], ['Z14931 15', 'SD11 + SR05']]);
  assert.ok(!shown.bunkhouse.some((c) => c.onTrain));
});

test('site: a called crew still listed in the bunkhouse is marked, and no other train gets it', () => {
  const fx = JSON.parse(fixture('2026-10-15b.json'));
  const board = callBoardPage([['M30131', '15', 'TORONTO', '26/10/15', '1030', 'S304', 'SB04']]);
  const { shown } = snapshotOf({ ...fx, screens: [...fx.screens, board, ...macScreens()] });
  assert.deepEqual(shown.macLineup.map((t) => [t.train, t.crew, t.called && t.called.crew]), [
    ['M30131 15', '', 'S304 + SB04'], ['Q13931 15', 'SD11 + SR05', null], ['Z14931 15', 'MU04 + MU01', null]]);
  assert.deepEqual(shown.bunkhouse.map((c) => [c.pos, c.onTrain || '']), [['001', 'M30131 15'], ['002', ''], ['003', '']]);
  // Turn History says where they are, not "no train on the Toronto line-up for it yet".
  const f = BoardTurns.facts(shown, 'SB04').map((x) => x.text);
  assert.ok(f.includes('On the Call Board for M30131 15'), f.join(' | '));
  assert.ok(!f.some((x) => /No train on the Toronto line-up/.test(x)));
});

test('alerts: no bunkhouse crew is lined up for a train home already on the Call Board', () => {
  const now = at(2026, 10, 15, 8, 15);
  const bunk = [{ pos: 1, en: 'S304', co: 'SB04', restUntil: null }];
  const trains = [mac('M30131', 10), mac('Q13931', 14, 'PLN')];
  // Before the call: S304 + SB04 are lined up for M30131 15.
  let st = turnStates({ now, predictions: [] }, [], { macLineup: trains, bunkhouse: bunk });
  assert.equal(st.SB04.lineup.train, 'M30131 15');
  // SD12 + SR01 were called for it instead: S304 + SB04 are lined up for the next train home.
  st = turnStates({ now, predictions: [] }, [called('M30131', 'SD12', 'SR01')], { macLineup: trains, bunkhouse: bunk });
  assert.equal(st.SB04.lineup.train, 'Q13931 15');
  assert.equal(st.SR01.onDuty.train, 'M30131 15');
  // Once the called crew is on the Call Board, the next crew isn't told it's lined up for that train.
  const r1 = turnEvents({}, turnStates({ now, predictions: [] }, [], { macLineup: trains, bunkhouse: [{ pos: 1, en: 'SD12', co: 'SR01', restUntil: null }, ...bunk] }), { lineupRead: true, now });
  const later = (r, m) => turnEvents(r.told, turnStates({ now: now + m, predictions: [] }, [called('M30131', 'SD12', 'SR01')], { macLineup: trains, bunkhouse: bunk }), { lineupRead: true, now: now + m });
  const r2 = later(r1, 10);
  const r3 = later(r2, 15); // a switch of train waits one check (pending), so look at the next one too
  for (const r of [r2, r3]) assert.ok(!r.events.some((e) => e.turn === 'SB04' && /M30131/.test(e.text)), JSON.stringify(r.events));
  assert.equal(r2.told.SB04.pending, undefined);
  assert.equal(r3.told.SB04.train, 'Q13931 15');
});

// The page's Toronto boxes (Current's short rows and Snapshots' table), cut from public/board.html.
const vm = require('node:vm');
const T = require('../../public/board-trains');
const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function page({ marks = [], preview = false } = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ctx = vm.createContext({ BoardTrains: T, BoardTurns, stampMin: T.toMin, esc, split: (s) => s.split(' '), CREW: null, CREW_BUNK: null, marks, PREVIEW: preview,
    marked: (t) => marks.includes(t), staleChip: () => '' });
  vm.runInContext(cut('function dt(stamp) {', 'function dur(min) {'), ctx);
  vm.runInContext(cut('function crewIn(html) {', 'function ruleText(rules) {'), ctx); // crewIn, markTurn
  vm.runInContext(cut('function torontoRestWarning(s, t, rested) {', 'function lineup2(s) {'), ctx); // toronto, calledCell, awayCall, cur2Row
  vm.runInContext(cut('function toronto2(s) {', '// Who is in Garnet when the Garnet board'), ctx);
  return ctx;
}

test('page: a Mac yard train with a Sarnia crew on the Call Board reads as theirs, in both Toronto boxes', () => {
  const fx = JSON.parse(fixture('2026-10-15b.json'));
  const board = callBoardPage([['M30131', '15', 'TORONTO', '26/10/15', '1030', 'S304', 'SB04']]);
  const { shown } = snapshotOf({ ...fx, screens: [...fx.screens, board, ...macScreens()] });
  const ctx = page({ marks: ['SB04'] });
  for (const box of ['toronto2', 'toronto']) {
    const out = ctx[box](shown);
    const words = text(out);
    assert.match(words, /M30131/, box);
    assert.match(words, /S304 \+ SB04 on the Call Board/, box);
    assert.match(words, /on duty 15th 1030/, box);
    assert.doesNotMatch(words, /possible Toronto South crew/, box);
    // The called crew isn't "in the bunkhouse, no train yet", though CATS still lists them there.
    assert.doesNotMatch(words, /no train yet: 001/, box);
    assert.match(out, /class="hit"|cur2 hit/, box); // a followed turn on it is marked
  }
  // Not on the Call Board and no rested crew: the label is still there (information, owner 2026-11-13).
  const alone = snapshotOf({ ...fx, screens: [...fx.screens, ...macScreens()] }).shown;
  for (const box of ['toronto2', 'toronto']) assert.match(text(ctx[box](alone)), /possible Toronto South crew/, box);
});

// --- 2. The watch: trains that fell off the Mac yard line-up 8 h or more before their call ---

const W = require('../../lib/board/toronto-south');
const os = require('node:os');
// E27531 14 as the live site had it: planned for 14th 0200 (call 13th 2345, order − 2 h 15), on the Mac
// yard line-up until 13th 1200, gone at 1205 (11.7 h before the call), never on the Call Board.
const e275 = { symbol: 'E27531', originDay: '14', status: 'PLN', order: at(2026, 11, 14, 2, 0), deadhead: false };
const m383 = { symbol: 'M38331', originDay: '13', status: 'PLN', order: at(2026, 11, 13, 18, 30), deadhead: false };
const dht = { symbol: 'DHT141B', originDay: '13', status: 'PLN', order: at(2026, 11, 14, 4, 0), deadhead: true };
const t1200 = at(2026, 11, 13, 12, 0);
const t1205 = at(2026, 11, 13, 12, 5);
const fellOff = () => {
  const s = W.update(W.empty(), { now: t1200, lineup: [e275, m383, dht], callBoard: [] });
  return W.update(s, { now: t1205, lineup: [], callBoard: [] });
};

test('watch: a train gone from the Mac yard line-up 8 h or more before its call is watched; looks at call − 4 h, the call, call + 2 h', () => {
  const s = W.update(W.empty(), { now: t1200, lineup: [e275, m383, dht], callBoard: [] });
  assert.deepEqual(s.trains, {});
  // At 1205 all three are gone. M38331 13's call (1615) is 4 h 10 away: close to its call, not watched.
  // The deadhead never goes to a Toronto South crew (owner, 2026-10-25).
  W.update(s, { now: t1205, lineup: [{ ...m383, symbol: 'Q13931' }], callBoard: [] });
  assert.deepEqual(Object.keys(s.trains), ['E27531 14']);
  const w = s.trains['E27531 14'];
  assert.equal(w.call, at(2026, 11, 13, 23, 45));
  assert.deepEqual(w.looks.map((l) => l.due), [at(2026, 11, 13, 19, 45), at(2026, 11, 13, 23, 45), at(2026, 11, 14, 1, 45)]);
  assert.equal(w.lastSeen, t1200);
  assert.equal(w.fellOff, t1205);
  // Exactly 8 h counts; a minute under doesn't.
  const edge = (min) => {
    const order = t1205 + 135 + min; // call = order − 2 h 15
    const x = W.update(W.empty(), { now: t1200, lineup: [{ ...e275, order }], callBoard: [] });
    return Object.keys(W.update(x, { now: t1205, lineup: [m383], callBoard: [] }).trains).length;
  };
  assert.equal(edge(8 * 60), 1);
  assert.equal(edge(8 * 60 - 1), 0);
});

test('watch: no look at the Toronto South Call Board until one is due, then one per due time', () => {
  const s = fellOff();
  for (const now of [t1205, at(2026, 11, 13, 19, 44)]) assert.deepEqual(W.due(s, now), []);
  const first = at(2026, 11, 13, 19, 46);
  assert.deepEqual(W.due(s, first).map((w) => w.id), ['E27531 14']);
  W.record(s, first, new Map()); // looked: not there
  assert.deepEqual(s.trains['E27531 14'].looks[0], { due: at(2026, 11, 13, 19, 45), at: first, seen: false });
  assert.deepEqual(W.due(s, at(2026, 11, 13, 21, 0)), []); // not again until the call
  const call = at(2026, 11, 13, 23, 50);
  assert.equal(W.due(s, call).length, 1);
  W.record(s, call, new Map([['E27531 14', { station: 'TORONTO', onDuty: at(2026, 11, 14, 1, 45), crew: [{ craft: 'EN', turn: 'T104' }, { craft: 'CO', turn: 'T207' }] }]]));
  const w = s.trains['E27531 14'];
  assert.equal(w.end, 'seen');
  assert.deepEqual(w.seen, { station: 'TORONTO', onDuty: at(2026, 11, 14, 1, 45), crew: 'EN T104 · CO T207' });
  assert.deepEqual(W.due(s, at(2026, 11, 14, 1, 50)), []); // seen: the third look isn't needed
  assert.deepEqual(W.list(s).map((x) => [x.id, x.end, x.looks.map((l) => (l.at == null ? '-' : l.seen ? 'on it' : 'not there'))]), [['E27531 14', 'seen', ['not there', 'on it', '-']]]);
});

test('watch: not there at all three looks; looks the checker missed are answered by one read', () => {
  const s = fellOff();
  for (const now of [at(2026, 11, 13, 19, 50), at(2026, 11, 13, 23, 50), at(2026, 11, 14, 1, 50)]) W.record(s, now, new Map());
  assert.equal(s.trains['E27531 14'].end, 'notSeen');
  // The checker was off from before the first look until after the last: one read answers all three.
  const off = fellOff();
  const back = at(2026, 11, 14, 2, 30);
  assert.equal(W.due(off, back).length, 1);
  W.record(off, back, new Map());
  assert.deepEqual(off.trains['E27531 14'].looks.map((l) => l.at), [back, back, back]);
  assert.equal(off.trains['E27531 14'].end, 'notSeen');
});

test('watch: CATS not showing the board is tried at the next check, twice in all', () => {
  const s = fellOff();
  const a = at(2026, 11, 13, 19, 46);
  W.record(s, a, null);
  assert.deepEqual(s.trains['E27531 14'].looks[0], { due: at(2026, 11, 13, 19, 45), tries: 1 });
  assert.equal(W.due(s, a + 5).length, 1);
  W.record(s, a + 5, null);
  assert.deepEqual(s.trains['E27531 14'].looks[0], { due: at(2026, 11, 13, 19, 45), tries: 2, at: a + 5, seen: false, failed: true });
  assert.deepEqual(W.due(s, a + 10), []);
  for (const now of [at(2026, 11, 13, 23, 46), at(2026, 11, 13, 23, 51), at(2026, 11, 14, 1, 46), at(2026, 11, 14, 1, 51)]) W.record(s, now, null);
  assert.equal(s.trains['E27531 14'].end, 'unread');
});

test('watch: off the list when a Sarnia crew is on it or it is back on the Mac yard line-up', () => {
  // Owner: "IF you see a Sarnia crew on a train then its not a possible toronto south crew."
  const s = fellOff();
  W.update(s, { now: at(2026, 11, 13, 22, 0), lineup: [m383], callBoard: [{ symbol: 'E27531', originDay: '14', station: 'TORONTO', onDuty: at(2026, 11, 14, 1, 45),
    crew: [{ craft: 'EN', turn: 'SD10' }, { craft: 'CO', turn: 'SR07' }, { craft: 'TT', turn: 'SR07' }] }] });
  assert.equal(s.trains['E27531 14'].end, 'sarnia');
  assert.deepEqual(s.trains['E27531 14'].sarnia, { crew: 'EN SD10 · CO SR07', onDuty: at(2026, 11, 14, 1, 45) });
  assert.deepEqual(W.due(s, at(2026, 11, 13, 23, 50)), []);
  // On the Call Board already when it left the line-up: never watched.
  const c = W.update(W.empty(), { now: t1200, lineup: [e275], callBoard: [] });
  W.update(c, { now: t1205, lineup: [m383], callBoard: [{ symbol: 'E27531', originDay: '14', station: 'TORONTO', onDuty: at(2026, 11, 14, 1, 45), crew: [] }] });
  assert.deepEqual(c.trains, {});
  // Back on the line-up: ours again, off the list.
  const b = fellOff();
  W.update(b, { now: at(2026, 11, 13, 13, 0), lineup: [e275], callBoard: [] });
  assert.deepEqual(b.trains, {});
});

test('watch: a check that skipped the Mac yard line-up, or a long gap, says nothing about what left it', () => {
  const s = W.update(W.empty(), { now: t1200, lineup: [e275], callBoard: [] });
  W.update(s, { now: t1205, lineup: null, callBoard: [] }); // not read
  assert.deepEqual(s.trains, {});
  assert.equal(s.last.at, t1200);
  // Read again 3 h later: too long since the last read to say it left 8 h before its call.
  W.update(s, { now: t1200 + 180, lineup: [m383], callBoard: [] });
  assert.deepEqual(s.trains, {});
  assert.equal(s.last.at, t1200 + 180);
});

test('watch: kept two days after its last look for the page, then dropped; the file survives a restart', () => {
  const s = fellOff();
  W.record(s, at(2026, 11, 13, 19, 46), new Map());
  W.update(s, { now: at(2026, 11, 16, 1, 0), lineup: null, callBoard: [] });
  assert.equal(Object.keys(s.trains).length, 1); // last look 14th 0145 + 48 h = 16th 0145
  W.update(s, { now: at(2026, 11, 16, 1, 46), lineup: null, callBoard: [] });
  assert.deepEqual(s.trains, {});
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-watch-'));
  const file = path.join(dir, 'toronto-south.json');
  W.save(file, fellOff());
  assert.deepEqual(Object.keys(W.load(file).trains), ['E27531 14']);
  fs.writeFileSync(file, '{ broken');
  assert.deepEqual(W.load(file), W.empty());
  assert.deepEqual(W.load(path.join(dir, 'none.json')), W.empty());
});

test('watch: the Toronto South Call Board codes come from config or .env; Sarnia\'s are refused', () => {
  assert.equal(W.boardCodes({}, { torontoSouthCallBoard: null }), null);
  assert.deepEqual(W.boardCodes({ BOARD_TS_CALLBOARD: '45 ts' }, {}), { district: '45', sub: 'TS' });
  assert.deepEqual(W.boardCodes({}, { torontoSouthCallBoard: '30/TO' }), { district: '30', sub: 'TO' });
  assert.deepEqual(W.boardCodes({ BOARD_TS_CALLBOARD: '45 TS' }, { torontoSouthCallBoard: '30 TO' }), { district: '45', sub: 'TS' });
  assert.equal(W.boardCodes({ BOARD_TS_CALLBOARD: '45 SA' }, {}), null);
  assert.equal(W.boardCodes({ BOARD_TS_CALLBOARD: 'toronto south' }, {}), null);
});

// --- 3. The checker's part (scripts/board-auto.js). Tried against a stand-in CATS page on 2026-11-14 (codes
// set and the train on page 2; not there; codes not set; CATS skipping the Call Board's first screen): see
// HANDOFF. These keep two promises the stand-in can't: Toronto South's pages never join the check's saved
// screens (summary.js would read them as Sarnia's Call Board), and the main route only types Sarnia's codes
// when a look couldn't put them back.
const auto = fs.readFileSync(require.resolve('../../scripts/board-auto.js'), 'utf8');
const between = (a, b) => { const i = auto.indexOf(a); const j = auto.indexOf(b, i + 1); assert.ok(i > 0 && j > i, a); return auto.slice(i, j); };

test('checker: Toronto South pages are read in memory only; Sarnia\'s codes typed only after a look', () => {
  const look = between('async function watchTorontoSouth(page, screens) {', '// On a Call Board list: make it Sarnia');
  assert.doesNotMatch(look, /capture\(/);
  assert.doesNotMatch(look, /screens\.push/);
  assert.match(look, /describeFrame\(catsFrame\(page\)\)/); // masked: no names
  assert.doesNotMatch(look, /unmasked/);
  const board = between('let cb = await chooseFromMenus(page, 6);', 'for (let pageNo = 0; pageNo < 45; pageNo++) {');
  assert.match(board, /if \(restoreSarnia\) await fill\(page, \{ 0: '45', 1: 'SA' \}\);/);
  assert.equal((board.match(/fill\(/g) || []).length, 1);
  // Read after the Mac yard and Garnet line-ups, before the hourly reads.
  assert.ok(auto.indexOf('torontoSouth = await watchTorontoSouth(page, screens)') > auto.indexOf("capture('garnetLineup')"));
  assert.ok(auto.indexOf('torontoSouth = await watchTorontoSouth(page, screens)') < auto.indexOf("capture('assignHistory')"));
});

test('screens: another terminal\'s Call Board, read for its trains only', () => {
  const S = require('../../lib/board/screens');
  const { parseGrid } = require('../../lib/board/grid');
  const page = (no, of, place, lines) => parseGrid([
    `1 | 19:26/11/13-1950 | 352:CN | 586:PAGE | 631:00${no} | 667:OF | 694:00${of}`, `19 | 343:${place}`, '37 | 289:CALL | 334:BOARD | 595:CNP27N', '73 | 19:TRAINS', ...lines]);
  const p1 = page(1, 2, 'TORONTO AAAAA', [
    // A two-word place after ON DUTY AT: (masked), and turns unlike ours: parseCallBoardPage misses both.
    '109 | 46:Q14931 | 109:13 | 154:ON | 181:DUTY | 226:AT: | 262:AAAAAAA | 343:AAAAA | 451:26/11/13 | 532:1800',
    '127 | 100:EN | 136:AAAAA*+ | 262:A | 289:AAAA | 388:TS101',
    '145 | 100:CO | 136:AAAAA+ | 262:A | 289:AAA | 388:TS201',
    '181 | 46:E27531 | 109:14 | 154:ON | 181:DUTY | 226:AT: | 262:TORONTO | 451:26/11/14 | 532:0145',
    '199 | 100:EN | 136:AAAAA*+ | 262:A | 289:AAAA | 388:TS104']);
  const carry = {};
  const a = S.parseCallBoardTrains(p1, carry);
  assert.deepEqual(a.trains.map((t) => [`${t.symbol} ${t.originDay}`, t.station, t.onDuty, t.crew.map((c) => `${c.craft} ${c.turn}`).join(' · ')]), [
    ['Q14931 13', 'AAAAAAA AAAAA', at(2026, 11, 13, 18, 0), 'EN TS101 · CO TS201'], ['E27531 14', 'TORONTO', at(2026, 11, 14, 1, 45), 'EN TS104']]);
  assert.equal(S.parseCallBoardPage(p1).trains.length, 1); // ours skips the two-word place
  assert.equal(S.callBoardPlace(p1), 'TORONTO AAAAA');
  // The crew runs on to page 2, then a yard job ends the trains.
  const b = S.parseCallBoardTrains(page(2, 2, 'TORONTO AAAAA', ['109 | 100:CO | 136:AAAAA+ | 262:A | 289:AAA | 388:TS207',
    '145 | 55:AAAA99 | 154:0800 | 199:AAAAAA | 262:S1/S1 | 343:ON | 370:DUTY | 415:AT: | 451:TORONTO | 586:26/11/13 | 667:0800',
    '181 | 46:M39931 | 109:13 | 154:ON | 181:DUTY | 226:AT: | 262:TORONTO | 451:26/11/13 | 532:2200']), carry);
  assert.deepEqual(a.trains[1].crew.map((c) => c.turn), ['TS104', 'TS207']);
  assert.deepEqual(b.trains, []);
  assert.equal(b.reachedYard, true);
  // Our own Call Board says SARNIA under its header.
  const ours = parseGrid(JSON.parse(fixture('2026-10-14.json')).screens[0].screenGrid);
  assert.equal(S.callBoardPlace(ours), 'SARNIA');
});
