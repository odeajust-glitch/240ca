// Owner, 2026-11-13, with a photo of CATS option 28 (the Toronto bunkhouse) beside the site's
// "Toronto line-up · Mac yard": "This is showing the wrong crew on the train". The bunkhouse had
// CO MU01 at POS 001 under one person; the site put MU01 under someone else, because crew names
// went by turn number and MU01 is a placeholder (make-up) turn that many people get.
// Now the bunkhouse's own names, by position and craft, name its crews in the Toronto box, on the
// board they were read with; elsewhere a placeholder gets no name rather than the wrong one.
// Turn ids and train ids from his photo; made-up names only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { parseGrid } = require('../../lib/board/grid');
const S = require('../../lib/board/screens');
const { recordNames, recordBunkhouse, bunkhouseNames, namesByTurn, saveNames, loadNames } = require('../../lib/board/names');
const { unlockNames } = require('../../public/board-names');
const { buildSite } = require('../../lib/board/site');
const T = require('../../public/board-trains');
const Turns = require('../../public/board-turns');

// Option 28 unmasked, in the layout of his photo (POOL S1, TERM 1): an EN + CO pair per POS, a B1
// line with no one on it, "(NET)" beside some names, two-letter initials on one.
const BUNK = [
  '80 | 20:CC | 60:TURN | 110:T | 130:POS | 200:EMPLOYEE NAME | 420:ST | 460:RN | 500:RETN | 560:SC | 600:REST | 680:USHR | 740:TURN INFO',
  '100 | 20:EN | 60:SD08 | 110:1 | 130:001 | 180:HILL*+ | 340:C | 380:CASEY | 760:45/SA/SD-1',
  '120 | 20:CO | 60:MU01 | 110:1 | 130:001 | 180:LAKE*+ | 270:(NET)B | 380:BRETT | 760:45/SA/SR-1',
  '140 | 20:B1',
  '200 | 20:EN | 60:SD09 | 110:1 | 130:002 | 180:STONE*+ | 340:A | 380:ADAM | 600:2229 | 640:12 | 760:45/SA/SD-1',
  '220 | 20:CO | 60:SR06 | 110:1 | 130:002 | 180:FIELD*+(NET) | 380:ELLIS | 600:2229 | 640:12 | 760:45/SA/SR-1',
  '240 | 20:B1',
  '300 | 20:EN | 60:S109 | 110:1 | 130:003 | 180:GROVE*+ | 340:DG | 380:DEREK | 600:0044 | 640:13',
  '320 | 20:CO | 60:SA08 | 110:1 | 130:003 | 180:BROOK*+(NET) | 380:GARTH | 600:0044 | 640:13 | 760:45/SA/SA-1',
];
const onSarniaTrain = [{ symbol: 'X27861', originDay: '12', crew: [{ craft: 'CO', turn: 'MU01', name: 'Kim Other' }] }];

test('Toronto bunkhouse: its own names by position, kept apart from the turns, for the check that read them', () => {
  const crew = S.parseBoardCrew(parseGrid(BUNK));
  assert.deepEqual(crew.map((c) => `${c.pos} ${c.craft} ${c.turn} ${c.name}`), [
    '001 EN SD08 Casey Hill', '001 CO MU01 Brett Lake', '002 EN SD09 Adam Stone', '002 CO SR06 Ellis Field',
    // Two-letter initials are initials, as nameParts has them (not "Derek Grove Dg").
    '003 EN S109 Derek Grove', '003 CO SA08 Garth Brook']);
  // The same check, MU01 is also on a Sarnia train on the Call Board, under someone else.
  const check1 = '2026-11-13T01:51:00.000Z';
  const store = recordNames({}, onSarniaTrain, new Date(check1));
  recordBunkhouse(store, crew, check1);
  assert.deepEqual(bunkhouseNames(store, check1), [
    ['001', 'EN', 'SD08', 'Hill, C'], ['001', 'CO', 'MU01', 'Lake, B'], ['002', 'EN', 'SD09', 'Stone, A'],
    ['002', 'CO', 'SR06', 'Field, E'], ['003', 'EN', 'S109', 'Grove, D'], ['003', 'CO', 'SA08', 'Brook, G']]);
  // The turns' names are as before: the bunkhouse never names a turn.
  assert.deepEqual(namesByTurn(store, new Date(check1)), { MU01: 'Other, K' });
  // 28's names not read in the next check: the list stays, but it is not that check's.
  const check2 = '2026-11-13T01:56:00.000Z';
  recordBunkhouse(recordNames(store, onSarniaTrain, new Date(check2)), undefined, check2);
  assert.equal(store['@bunk'].crew.length, 6);
  assert.deepEqual(bunkhouseNames(store, check2), []);
  assert.deepEqual(bunkhouseNames(store, undefined), []);
  // Read and empty: empty. An LE row is the engineer; a B1 row isn't kept.
  recordBunkhouse(store, [], check2);
  assert.deepEqual(bunkhouseNames(store, check2), []);
  recordBunkhouse(store, [{ pos: '001', craft: 'LE', turn: 'SD08', name: 'Casey Hill' }, { pos: '001', craft: 'B1', turn: 'MU02', name: 'Bo Brake' }], check2);
  assert.deepEqual(bunkhouseNames(store, check2), [['001', 'EN', 'SD08', 'Hill, C']]);
  assert.deepEqual(namesByTurn(store, new Date(check2)), { MU01: 'Other, K' });
});

test('Toronto bunkhouse: the site locks the newest check\'s names into data/crew.json with its snapshot, nowhere else', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bunk-site-'));
  const hist = path.join(root, 'history', '2026-10-15');
  fs.mkdirSync(hist, { recursive: true });
  // Two checks, the second (the newest) the same board as the first: one snapshot, "same until" 0820.
  const check = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/board/2026-10-15b.json'), 'utf8'));
  const firstAt = check.probedAt;
  const checkAt = new Date(Date.parse(firstAt) + 5 * 60000).toISOString();
  fs.writeFileSync(path.join(hist, '0815.json'), JSON.stringify(check));
  fs.writeFileSync(path.join(hist, '0820.json'), JSON.stringify({ ...check, probedAt: checkAt }));
  const namesFile = path.join(root, 'names.json');
  const build = async (bunkAt) => {
    // (The turns' names are kept 14 days back from today; the fixture's check is older.)
    saveNames(namesFile, recordBunkhouse(recordNames({}, onSarniaTrain, new Date()), S.parseBoardCrew(parseGrid(BUNK)), bunkAt));
    const out = path.join(root, 'site');
    buildSite({ historyDir: path.join(root, 'history'), outDir: out, days: 0, names: { file: namesFile, key: 'pass phrase' } });
    const index = JSON.parse(fs.readFileSync(path.join(out, 'data/index.json'), 'utf8'));
    return { out, index, got: await unlockNames(JSON.parse(fs.readFileSync(path.join(out, 'data/crew.json'), 'utf8')), 'pass phrase') };
  };
  const { out, index, got } = await build(checkAt);
  assert.ok(loadNames(namesFile)['@bunk']);
  assert.deepEqual(got.turns, { MU01: 'Other, K' });
  assert.deepEqual([index.latest, index.checked], ['2026-10-15 0815', '2026-10-15 0820']);
  assert.equal(got.bunk.taken, index.latest, 'the snapshot the newest check\'s board is, not the check\'s own time');
  assert.deepEqual(got.bunk.rows.slice(0, 2), [['001', 'EN', 'SD08', 'Hill, C'], ['001', 'CO', 'MU01', 'Lake, B']]);
  for (const f of fs.readdirSync(path.join(out, 'data'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(out, 'data', f), 'utf8'), /Lake|Hill|Grove|Other/, f);
  }
  // Names from another check than the newest (28's names not read in the newest): none.
  assert.equal((await build(firstAt)).got.bunk, null);
});

// The page's Toronto box, cut from public/board.html and run as the page runs it.
const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function page({ crew = null, bunk = null, marks = [] } = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ctx = vm.createContext({ BoardTrains: T, BoardTurns: Turns, stampMin: T.toMin, esc, split: (s) => s.split(' '), CREW: crew, CREW_BUNK: bunk, marks,
    marked: (t) => marks.includes(t), staleChip: () => '' });
  vm.runInContext(cut('function dt(stamp) {', 'function dur(min) {'), ctx);
  vm.runInContext(cut('function crewIn(html) {', 'function ruleText(rules) {'), ctx); // crewIn, markTurn
  vm.runInContext(cut('function torontoRestWarning(s, t, rested) {', 'function lineup2(s) {'), ctx); // bunkName, bunkCrew, southCrew, toronto, awayCall, cur2Row
  vm.runInContext(cut('function toronto2(s) {', '// Who is in Garnet when the Garnet board'), ctx);
  return ctx;
}
// The 20:51 check of his photo, Mac yard part (turn and train ids as shown; times as on the site).
const SNAP = {
  taken: '2026-11-12 2051', screens: ['bunkhouse', 'macLineup'], onTheWay: [],
  bunkhouse: [
    { pos: '001', en: 'SD08', co: 'MU01', offDuty: '12th 1309', rested: '12th 2109', ready: false },
    { pos: '002', en: 'SD09', co: 'SR06', offDuty: '12th 1429', rested: '12th 2229', ready: false },
    { pos: '003', en: 'S109', co: 'SA08', offDuty: '12th 1644', rested: '13th 0044', ready: false },
    { pos: '004', en: 'S110', co: 'SA09', offDuty: '12th 1719', rested: '13th 0119', ready: false },
  ],
  macLineup: [
    { order: '12th 2245', status: 'ORD', train: 'M39931 13', info: 'X', orstn: '41975', call: '12th 2030', crew: '', crewPos: '', crewExpected: null,
      skipped: ['001 SD08 + MU01 (rest until 12th 2109)'], south: { crew: '001 SD08 + MU01', en: 'SD08', co: 'MU01', rested: '12th 2109' } },
    { order: '12th 2359', status: 'PLN', train: 'E27331 13', info: 'X', orstn: '41975', call: '12th 2144', crew: 'SD08 + MU01', crewPos: '001', crewExpected: null, skipped: [] },
    { order: '13th 0300', status: 'ORD', train: 'Q13931 13', info: 'X', orstn: '41975', call: '13th 0045', crew: 'SD09 + SR06', crewPos: '002', crewExpected: null, skipped: [] },
  ],
};
// The turns' names: MU01's is whoever had the number last (the wrong person for the bunkhouse).
const CREW = { SD08: 'Hill, C', MU01: 'Other, K', SD09: 'Stone, A', SR06: 'Field, E', S109: 'Grove, D', SA08: 'Brook, G', S110: 'Dale, T', SA09: 'Ward, T' };
const ROWS = [['001', 'EN', 'SD08', 'Hill, C'], ['001', 'CO', 'MU01', 'Lake, B'], ['002', 'EN', 'SD09', 'Stone, A'], ['002', 'CO', 'SR06', 'Field, E'],
  ['003', 'EN', 'S109', 'Grove, D'], ['003', 'CO', 'SA08', 'Brook, G'], ['004', 'EN', 'S110', 'Dale, T'], ['004', 'CO', 'SA09', 'Ward, T']];
const BUNKED = { taken: SNAP.taken, rows: ROWS };
const rowOf = (out, train) => text(out.slice(out.indexOf(train), out.indexOf('</details>', out.indexOf(train))));

test('Toronto line-up (Current): each bunkhouse crew under the names the bunkhouse shows', () => {
  const out = page({ crew: CREW, bunk: BUNKED }).toronto2(SNAP);
  assert.match(rowOf(out, 'E27331'), /^E27331 13 PLN SD08 Hill, C \+ MU01 Lake, B rest until 12th 2109 call ~12th 2144/);
  assert.match(rowOf(out, 'Q13931'), /SD09 Stone, A \+ SR06 Field, E rest until 12th 2229/);
  // Toronto South's first in line, and the crews with no train yet, the same way.
  assert.match(rowOf(out, 'M39931'), /First in line: 001 SD08 Hill, C \+ MU01 Lake, B \(rest until 12th 2109\)/);
  assert.match(text(out), /Also in the bunkhouse, no train yet: 003 S109 Grove, D \+ SA08 Brook, G \(rest until 13th 0044\) · 004 S110 Dale, T \+ SA09 Ward, T/);
  assert.doesNotMatch(out, /Other, K/);
  // A followed turn is still marked, its name after it.
  const marked = page({ crew: CREW, bunk: BUNKED, marks: ['MU01'] }).toronto2(SNAP);
  assert.ok(marked.includes('SD08 <span class="crewnm">Hill, C</span> + <mark class="t">MU01</mark> <span class="crewnm">Lake, B</span>'));
  // A spare covering a turn in the bunkhouse: its name, not the turn holder's.
  const spare = { taken: SNAP.taken, rows: ROWS.map((r) => (r[2] === 'SR06' ? ['002', 'CO', 'SR06', 'Spare, S'] : r)) };
  assert.match(rowOf(page({ crew: CREW, bunk: spare }).toronto2(SNAP), 'Q13931'), /SR06 Spare, S/);
});

test('Toronto line-up: on any other board, or without the bunkhouse names, a placeholder turn has no name rather than a wrong one', () => {
  // The names file of a laptop without this change (no bunk list): MU01 is left bare, the
  // regular turns keep their turn's name.
  const old = page({ crew: CREW }).toronto2(SNAP);
  assert.match(rowOf(old, 'E27331'), /SD08 Hill, C \+ MU01 rest until/);
  assert.doesNotMatch(old, /Other, K/);
  // Another board than the one the names were read with (an older snapshot, or a newer board
  // while the page stays open): the bunkhouse's names aren't used, even at the same positions.
  const other = page({ crew: CREW, bunk: { taken: '2026-11-12 2346', rows: ROWS.map((r) => (r[2] === 'MU01' ? ['001', 'CO', 'MU01', 'New, P'] : r[2] === 'SR06' ? ['002', 'CO', 'SR06', 'Spare, S'] : r)) } }).toronto2(SNAP);
  assert.match(rowOf(other, 'E27331'), /SD08 Hill, C \+ MU01 rest until/);
  assert.match(rowOf(other, 'Q13931'), /SD09 Stone, A \+ SR06 Field, E/);
  assert.doesNotMatch(other, /New, P|Spare, S|Other, K/);
  // Names off (not a member, or CREW_NAMES off): no names at all, the bunkhouse's included.
  const off = page({ bunk: BUNKED }).toronto2(SNAP);
  assert.doesNotMatch(off, /crewnm/);
  assert.match(rowOf(off, 'E27331'), /SD08 \+ MU01 rest until/);
});

test('Toronto line-up (Snapshots layout): the same names', () => {
  const out = text(page({ crew: CREW, bunk: BUNKED }).toronto(SNAP));
  assert.match(out, /E27331 13 X · from 41975 SD08 Hill, C \+ MU01 Lake, B pos 001/);
  assert.match(out, /first in line: 001 SD08 Hill, C \+ MU01 Lake, B \(rest until 12th 2109\)/);
  assert.match(out, /Also in the bunkhouse, no train yet: 003 S109 Grove, D \+ SA08 Brook, G/);
  assert.doesNotMatch(out, /Other, K/);
  assert.match(text(page({ crew: CREW }).toronto(SNAP)), /E27331 13 X · from 41975 SD08 Hill, C \+ MU01 pos 001/);
});
