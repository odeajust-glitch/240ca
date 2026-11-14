// Owner, 2026-11-13, with a photo of the 501/502 board on the site: its MU01 row ("out working on
// L50231") had the name of the MU01 who had been in the Toronto bunkhouse, who "is not working 502".
// A make-up turn (MU01) is a placeholder: the same number was two people at once (the conductor on
// L50231, and the bunkhouse's MU01, who went home on E27331 13), and the turn → name list kept one.
// Now a make-up turn is never named by its number; each row takes the name its own screen showed in
// the same check: 29 / 31 for their rows, the Call Board line for a train's crew.
// Turn ids and train ids from his photo; made-up names only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { parseGrid } = require('../../lib/board/grid');
const S = require('../../lib/board/screens');
const { recordNames, recordBoardCrew, recordMakeUps, makeUpNames, namesByTurn, saveNames } = require('../../lib/board/names');
const { unlockNames } = require('../../public/board-names');
const { buildSite } = require('../../lib/board/site');
const T = require('../../public/board-trains');
const Turns = require('../../public/board-turns');

// 29 (501/502) unmasked, as board-auto reads it: the make-up conductor on L50231.
const S5 = [
  '100 | 20:CO | 60:S502 | 110:0 | 130:001 | 180:PINE*+ | 340:C | 380:CARL | 600:**',
  '120 | 20:EN | 60:S502 | 110:0 | 130:999 | 180:STONE*+ | 340:K | 380:KYLE | 520:L50231',
  '140 | 20:CO | 60:MU01 | 110:0 | 130:999 | 180:FORD+ | 340:N | 380:NOAH | 520:L50231',
];
// The Call Board the same check: MU01 on two trains, two people.
const TRAINS = [
  { symbol: 'E27331', originDay: '13', station: 'TORONTO', crew: [{ craft: 'EN', turn: 'SD08', name: 'Casey Hill' }, { craft: 'CO', turn: 'MU01', name: 'Brett Lake' }] },
  { symbol: 'L50231', originDay: '13', station: 'SARNIA', crew: [{ craft: 'EN', turn: 'S502', name: 'Kyle Stone' }, { craft: 'CO', turn: 'MU01', name: 'Noah Ford' }] },
];

test('make-up turns: each row named by its own screen, never by the number', () => {
  const checkAt = '2026-11-13T10:49:00.000Z';
  const at = new Date(checkAt);
  const crew = S.parseBoardCrew(parseGrid(S5));
  const store = recordBoardCrew(recordNames({}, TRAINS, at), crew, at);
  recordMakeUps(store, { boards: crew.map((c) => ({ ...c, board: 's5' })), trains: TRAINS }, checkAt);
  assert.deepEqual(makeUpNames(store, checkAt), {
    boards: [['s5', 'CO', 'MU01', 'Ford, N']],
    trains: [['E27331 13', 'CO', 'MU01', 'Lake, B'], ['L50231 13', 'CO', 'MU01', 'Ford, N']],
  });
  // The turn list has no MU01 at all; the regular turns as before.
  const turns = namesByTurn(store, at);
  assert.equal(turns.MU01, undefined);
  assert.equal(turns['S502-EN'], 'Stone, K');
  // Another check's names: none (the newest check's only).
  assert.equal(makeUpNames(store, '2026-11-13T10:41:00.000Z'), null);
  // A check that read nothing by name: nothing.
  recordMakeUps(store, {}, '2026-11-13T10:57:00.000Z');
  assert.deepEqual(makeUpNames(store, '2026-11-13T10:57:00.000Z'), { boards: [], trains: [] });
});

test('make-up turns: the site locks them into data/crew.json with the newest check\'s snapshot', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mu-site-'));
  const hist = path.join(root, 'history', '2026-10-15');
  fs.mkdirSync(hist, { recursive: true });
  // Two checks, the newest the same board as the one before: one snapshot, "same until" the newest.
  const check = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/board/2026-10-15b.json'), 'utf8'));
  const newest = new Date(Date.parse(check.probedAt) + 5 * 60000).toISOString();
  fs.writeFileSync(path.join(hist, '0815.json'), JSON.stringify(check));
  fs.writeFileSync(path.join(hist, '0820.json'), JSON.stringify({ ...check, probedAt: newest }));
  const namesFile = path.join(root, 'names.json');
  const crew = S.parseBoardCrew(parseGrid(S5));
  saveNames(namesFile, recordMakeUps(recordNames({}, TRAINS, new Date()), { boards: crew.map((c) => ({ ...c, board: 's5' })), trains: TRAINS }, newest));
  const out = path.join(root, 'site');
  buildSite({ historyDir: path.join(root, 'history'), outDir: out, days: 0, names: { file: namesFile, key: 'pass phrase' } });
  const index = JSON.parse(fs.readFileSync(path.join(out, 'data/index.json'), 'utf8'));
  assert.deepEqual([index.latest, index.checked], ['2026-10-15 0815', '2026-10-15 0820']);
  const got = await unlockNames(JSON.parse(fs.readFileSync(path.join(out, 'data/crew.json'), 'utf8')), 'pass phrase');
  assert.deepEqual(got.mu, { taken: index.latest, boards: [['501/502 (S5)', 'CO', 'MU01', 'Ford, N']],
    trains: [['E27331 13', 'CO', 'MU01', 'Lake, B'], ['L50231 13', 'CO', 'MU01', 'Ford, N']] });
  assert.equal(got.turns.MU01, undefined);
  for (const f of fs.readdirSync(path.join(out, 'data'))) assert.doesNotMatch(fs.readFileSync(path.join(out, 'data', f), 'utf8'), /Ford|Lake|Stone/, f);
});

// The page's boards, cut from public/board.html and run as the page runs them.
const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function page({ crew = null, mu = null, marks = [] } = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ctx = vm.createContext({ BoardTrains: T, BoardTurns: Turns, stampMin: T.toMin, esc, split: (x) => x.split(' '), CREW: crew, CREW_MU: mu, CREW_BUNK: null, marks,
    marked: (t) => marks.includes(t), markedIn: (t) => marks.some((m) => Turns.turnIn(t, m)), staleChip: () => '',
    resetFor: () => null, resetKey: (t) => (/^S5\d{2}$/.test(t.turn) && t.craft ? `${t.turn}-${t.craft === 'CO' ? 'CO' : 'EN'}` : t.turn), resetText: () => '',
    SPARE_PREDICT: false, spareCall: () => null, boardOdds: () => '', dot: () => 'x' });
  vm.runInContext(cut('const crewTag = ', '// Whose yard job it is'), ctx); // crewTag, muName, muTag
  vm.runInContext(cut('function crewIn(html) {', 'function ruleText(rules) {'), ctx); // crewIn, markTurn
  vm.runInContext(cut('function poolBody(s, p, reviewed = false) {', '// Pools at Sarnia (owner, 2026-11-09'), ctx);
  vm.runInContext(cut('const MU_TURN = ', '// Upcoming days off'), ctx); // crewShown, fillIn, crewLine, onDuty
  vm.runInContext(cut('function dt(stamp) {', 'function dur(min) {'), ctx);
  vm.runInContext(cut('function torontoRestWarning(s, t, rested) {', 'function lineup2(s) {'), ctx); // pairCrew, wayCrew, toronto, awayCall, cur2Row
  vm.runInContext(cut('function toronto2(s) {', '// Who is in Garnet when the Garnet board'), ctx);
  return ctx;
}
const SNAP = {
  taken: '2026-11-13 0549', screens: ['bunkhouse', 'macLineup'], bunkhouse: [], macLineup: [],
  pools: [{ name: '501/502 (S5)', turns: [{ pos: '001', turn: 'S502', craft: 'CO', status: 'hold turn until 14th 0505 (**)' },
    { pos: '999', turn: 'S502', craft: 'EN', status: 'out working on L50231' }, { pos: '999', turn: 'MU01', craft: 'CO', status: 'out working on L50231' }] }],
  onDuty: [
    { onDuty: '13th 0045', station: 'TORONTO', train: 'E27331 13', crew: 'EN SD08 · CO MU01', backfill: [] },
    { onDuty: '13th 0400', station: 'SARNIA', train: 'L50231 13', crew: 'EN S502 · CO MU01', backfill: [] },
    { onDuty: '13th 0400', station: 'SARNIA', train: 'DHT048B 13', crew: 'EN SD06 · CO SR03', backfill: [] },
  ],
  onTheWay: [{ crew: 'SD06 + MU02', en: 'SD06', co: 'MU02', train: 'DHT048B 13', onDuty: '13th 0400', offDuty: '13th 0700', rested: '13th 1500' }],
};
// An old names file: MU01 under whoever had the number last (here the bunkhouse's, who went home).
const CREW = { MU01: 'Lake, B', 'S502-CO': 'Pine, C', 'S502-EN': 'Stone, K', SD08: 'Hill, C', SD06: 'Wood, D', SR03: 'Reed, J' };
const MU = { taken: SNAP.taken, boards: [['501/502 (S5)', 'CO', 'MU01', 'Ford, N']],
  trains: [['E27331 13', 'CO', 'MU01', 'Lake, B'], ['L50231 13', 'CO', 'MU01', 'Ford, N'], ['DHT048B 13', 'CO', 'MU02', 'Gale, P']] };
const rowsOf = (h) => [...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].filter((m) => !/<th/.test(m[1])).map((m) => text(m[1]));

test('501/502 board: the MU01 row takes the name 29 showed on it, not the number\'s', () => {
  const p = page({ crew: CREW, mu: MU });
  const rows = rowsOf(p.poolBody(SNAP, SNAP.pools[0]));
  assert.deepEqual(rows, ['001 S502 Pine, C CO hold turn until 14th 0505 (**)', '999 S502 Stone, K EN out working on L50231', '999 MU01 Ford, N CO out working on L50231']);
  // Another snapshot than the one the names were read with, or an old names file: no name, never the number's.
  const older = rowsOf(page({ crew: CREW, mu: { ...MU, taken: '2026-11-13 0541' } }).poolBody(SNAP, SNAP.pools[0]));
  assert.equal(older[2], '999 MU01 CO out working on L50231');
  assert.equal(rowsOf(page({ crew: CREW }).poolBody(SNAP, SNAP.pools[0]))[2], '999 MU01 CO out working on L50231');
  // Names off: none at all.
  assert.doesNotMatch(page({ mu: MU }).poolBody(SNAP, SNAP.pools[0]), /crewnm/);
  // Nowhere on the page is a make-up turn named by its number (crewTag, crewIn).
  assert.equal(vm.runInContext("crewTag('MU01')", p), '');
  assert.equal(vm.runInContext("crewTag('SD08')", p), ' <span class="crewnm">Hill, C</span>');
  assert.equal(p.markTurn('CO MU01 · EN SD08'), 'CO MU01 · EN SD08 <span class="crewnm">Hill, C</span>');
});

test('Call Board: each train\'s MU01 named from its own line; other crews exactly as before', () => {
  const p = page({ crew: CREW, mu: MU });
  const rows = rowsOf(p.onDuty(SNAP, true));
  assert.equal(rows[0], '13th 0045 Toronto E27331 13 EN SD08 Hill, C · CO MU01 Lake, B');
  assert.equal(rows[1], '13th 0400 Sarnia L50231 13 EN S502 Stone, K · CO MU01 Ford, N');
  assert.equal(rows[2], '13th 0400 Sarnia DHT048B 13 EN SD06 Wood, D · CO SR03 Reed, J');
  // No MU: the line as it always was, with each person's reset tag after them (owner, 2026-11-14: "show reset
  // required on the Call board a person needs it"), empty until the resets are in.
  const line = p.crewLine(SNAP, 'DHT048B 13', 'EN SD06 · CO SR03');
  assert.equal(line.replace(/<span class="rtag[^"]*" data-rkey="[^"]*" data-rtaken="[^"]*"><\/span>/g, ''), p.markTurn('EN SD06 · CO SR03'), 'no MU: the line as it always was');
  assert.deepEqual([...line.matchAll(/data-rkey="([^"]*)"/g)].map((m) => m[1]), ['SD06', 'SR03']);
  // The spare's own turn, when the checker matched it (crewShown), still comes first.
  const filled = rowsOf(p.onDuty({ ...SNAP, onDuty: [{ ...SNAP.onDuty[1], backfill: [{ craft: 'CO', job: 'MU01', turn: 'B130' }] }] }, true));
  assert.equal(filled[0], '13th 0400 Sarnia L50231 13 EN S502 Stone, K · CO B130');
  // A followed MU turn is still marked.
  assert.match(page({ crew: CREW, mu: MU, marks: ['MU01'] }).crewLine(SNAP, 'L50231 13', 'EN S502 · CO MU01'), /CO <mark class="t">MU01<\/mark> <span class="crewnm">Ford, N<\/span>/);
});

test('Toronto line-up: a crew on its way with an MU turn is named from its Call Board line', () => {
  const out = text(page({ crew: CREW, mu: MU }).toronto2(SNAP));
  assert.match(out, /On the way, no Toronto train for them yet \(estimates\): SD06 Wood, D \+ MU02 Gale, P \(DHT048B 13/);
  assert.match(text(page({ crew: CREW }).toronto2(SNAP)), /SD06 Wood, D \+ MU02 \(DHT048B 13/);
});
