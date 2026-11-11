const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseGrid } = require('../../lib/board/grid');
const S = require('../../lib/board/screens');
const { recordNames, recordBoardCrew, recordYardCrew, namesForHeld, lockNames, loadNames, saveNames, shortName, namesByTurn } = require('../../lib/board/names');
const { unlockNames } = require('../../public/board-names');
const { buildSite } = require('../../lib/board/site');

// An unmasked Call Board page as the grievance read sees it (made-up people).
const PAGE = [
  '60 | 46:CALL BOARD | 300:PAGE 001 OF 004',
  '100 | 46:E27861 | 109:17 | 154:ON DUTY AT: | 262:SARNIA | 451:26/10/17 | 532:0300',
  '120 | 100:EN | 136:WILSON*+ | 262:DW | 289:DON | 388:SD11',
  '140 | 100:CO | 136:DE MAN*+(NET) | 262:MD | 289:MIKE | 388:SR05',
  '160 | 100:ET | 136:O\'BRIEN-SMITH | 262:K | 289:KATE | 388:MU01',
  '200 | 46:Z14931 | 109:17 | 154:ON DUTY AT: | 262:TORONTO | 451:26/10/18 | 532:0030',
  '220 | 100:CO | 136:DE MAN* | 262:MD | 289:MIKE | 388:SR05',
  '240 | 100:B1',
];

test('names: read off an unmasked Call Board page, properly cased', () => {
  const trains = S.parseCallBoardNames(parseGrid(PAGE));
  assert.deepEqual(trains.map((t) => [t.symbol, t.originDay, t.station, t.crew.map((c) => `${c.craft} ${c.turn} ${c.name}`)]), [
    ['E27861', '17', 'SARNIA', ['EN SD11 Don Wilson', 'CO SR05 Mike de Man', "ET MU01 Kate O'Brien-Smith"]],
    ['Z14931', '17', 'TORONTO', ['CO SR05 Mike de Man']],
  ]);
});

test('names: kept by train + turn, dropped after 45 days unseen', () => {
  const trains = S.parseCallBoardNames(parseGrid(PAGE));
  const store = recordNames({ 'OLD 01|SR01': { name: 'Gone', seen: '2026-08-01T00:00:00Z' } }, trains, new Date('2026-10-18T05:00:00Z'));
  assert.equal(store['E27861 17|SR05'].name, 'Mike de Man');
  assert.equal(store['E27861 17|SD11'].name, 'Don Wilson');
  assert.equal(store['OLD 01|SR01'], undefined);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'names-'));
  saveNames(path.join(dir, 'names.json'), store);
  assert.deepEqual(loadNames(path.join(dir, 'names.json')), store);
  assert.deepEqual(loadNames(path.join(dir, 'missing.json')), {});
});

test('names: only the 14h list goes out, locked; the browser code unlocks it', async () => {
  const store = recordNames({}, S.parseCallBoardNames(parseGrid(PAGE)), new Date('2026-10-18T05:00:00Z'));
  const rows = [
    { id: 'E27861 17', month: '2026-10', co: 'SR05', en: 'SD11', heldMin: 876, back: { id: 'Z14931 17' } },
    { id: 'M30241 17', month: '2026-10', co: 'SA04', en: 'S104', heldMin: 600 }, // under 14 h: not sent
    { id: 'X1 17', month: '2026-10', co: 'SR05', heldMin: 900, back: { id: 'Z14931 17' } }, // conductor's name off the train home
  ];
  const held = namesForHeld(rows, store, 840, new Date('2026-10-18T06:00:00Z'));
  assert.deepEqual(held, { 'E27861 17 2026-10': { co: 'Mike de Man', en: 'Don Wilson' }, 'X1 17 2026-10': { co: 'Mike de Man', en: null } });

  // A trip from before names were read: the name last seen on each turn,
  // marked turnOnly; a turn not seen for 14 days gives nothing.
  const old = namesForHeld([{ id: 'Q1 15', month: '2026-10', co: 'SR05', en: 'SD11', heldMin: 900 },
    { id: 'Q2 15', month: '2026-10', co: 'SR01', heldMin: 900 }], store, 840, new Date('2026-10-18T06:00:00Z'));
  assert.deepEqual(old, { 'Q1 15 2026-10': { co: 'Mike de Man', en: 'Don Wilson', turnOnly: true } });
  assert.deepEqual(namesForHeld([{ id: 'Q1 15', month: '2026-10', co: 'SR05', heldMin: 900 }], store, 840, new Date('2026-11-05T06:00:00Z')), {});

  const locked = lockNames(held, 'correct horse battery staple');
  assert.doesNotMatch(JSON.stringify(locked), /Man|Wilson/);
  assert.deepEqual(await unlockNames(locked, 'correct horse battery staple'), held);
  assert.equal(await unlockNames(locked, 'wrong'), null);
});

test('names: the site publishes data/names.json only with BOARD_NAMES_KEY, and never names in the open data', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'names-site-'));
  const hist = path.join(root, 'history', '2026-10-15');
  fs.mkdirSync(hist, { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../fixtures/board/2026-10-15b.json'), path.join(hist, '0815.json'));
  const namesFile = path.join(root, 'names.json');
  saveNames(namesFile, recordNames({}, S.parseCallBoardNames(parseGrid(PAGE))));
  const out = path.join(root, 'site');

  buildSite({ historyDir: path.join(root, 'history'), outDir: out, days: 0, names: { file: namesFile, key: '' } });
  assert.equal(fs.existsSync(path.join(out, 'data/names.json')), false);

  buildSite({ historyDir: path.join(root, 'history'), outDir: out, days: 0, names: { file: namesFile, key: 'pass phrase' } });
  const locked = JSON.parse(fs.readFileSync(path.join(out, 'data/names.json'), 'utf8'));
  assert.deepEqual(await unlockNames(locked, 'pass phrase'), {}); // nobody held 14 h in this fixture
  assert.ok(fs.existsSync(path.join(out, 'board-names.js')));
  for (const f of fs.readdirSync(path.join(out, 'data'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(out, 'data', f), 'utf8'), /Mike|Wilson|de Man/, f);
  }
});

// Owner, 2026-11-10: crew names on the board for members, "last name, first
// initial ie Justin O'Dea would be O'Dea, J".
test('names: each turn\'s latest name as "Last, F", a 501/502 turn by craft', () => {
  assert.equal(shortName("Justin O'Dea"), "O'Dea, J");
  assert.equal(shortName('Mike de Man'), 'de Man, M');
  assert.equal(shortName("Kate O'Brien-Smith"), "O'Brien-Smith, K");
  assert.equal(shortName('Cher'), 'Cher');
  assert.equal(shortName(''), '');
  const at = new Date('2026-10-18T05:00:00Z');
  const store = recordNames({}, S.parseCallBoardNames(parseGrid(PAGE)), at);
  // A 501 job: conductor and engineer under one turn number.
  recordNames(store, [{ symbol: 'L50131', originDay: '18', crew: [{ craft: 'EN', turn: 'S501', name: 'Ann Lee' }, { craft: 'CO', turn: 'S501', name: "Justin O'Dea" }] }], at);
  assert.equal(store['L50131 18|S501'].name, "Justin O'Dea"); // as before: the last read
  assert.deepEqual(namesByTurn(store, new Date('2026-10-18T06:00:00Z')), { MU01: "O'Brien-Smith, K", 'S501-CO': "O'Dea, J", 'S501-EN': 'Lee, A', SD11: 'Wilson, D', SR05: 'de Man, M' });
  // A spare on the turn later is the name shown; an old S5 entry with no craft is left out.
  recordNames(store, [{ symbol: 'M38331', originDay: '20', crew: [{ craft: 'CO', turn: 'SR05', name: 'Sam Spare' }] }], new Date('2026-10-20T05:00:00Z'));
  store['L50231 16|S502'] = { name: 'Old Entry', seen: '2026-10-16T05:00:00.000Z' };
  const later = namesByTurn(store, new Date('2026-10-21T06:00:00Z'));
  assert.equal(later.SR05, 'Spare, S');
  assert.equal(later['S502-CO'], undefined);
  assert.equal(later.S502, undefined);
  // Not seen for 14 days: no name.
  assert.deepEqual(namesByTurn(store, new Date('2026-11-20T06:00:00Z')), {});
});

// Owner, 2026-11-10: SA05 showed an older Call Board name; his photo of the
// A pool screen has the person CATS shows on it now.
test('names: the pool screen\'s own name for a turn wins over an older Call Board one', () => {
  const POOL = [
    '100 | 20:CC | 60:TURN | 110:T | 130:POS | 200:EMPLOYEE NAME | 420:ST',
    '140 | 20:EN',
    '160 | 20:CO | 60:SA05 | 110:0 | 130:001 | 180:ALLEN*+ | 300:(NET)B | 380:BEN',
    '180 | 20:B1',
    '200 | 20:CO | 60:SA06 | 110:0 | 130:002 | 180:BORODY*+ | 340:R | 380:ROBER',
    '220 | 20:CO | 60:SA07 | 110:0 | 130:003 | 180:PAVEY*+ | 340:R | 380:RYAN | 460:HT',
    // The initial in the surname's own cell (the site showed "Borody R, R"), and a two-word surname.
    '230 | 20:CO | 60:SR01 | 110:0 | 130:004 | 180:LANGIS*+     M | 380:MARC',
    '232 | 20:CO | 60:SB01 | 110:0 | 130:005 | 180:CHAD T | 380:TOM',
    '234 | 20:CO | 60:SR05 | 110:0 | 130:006 | 180:DE MAN* | 340:D | 380:MIKE',
    '236 | 20:EN | 60:S502 | 110:0 | 130:002 | 180:<< | 220:OPEN | 280:TURN | 340:>>',
    '238 | 20:CO | 60:S502 | 110:0 | 130:002 | 180:NITZ*+ | 340:C | 380:CHRIS',
    '240 | 20:EN | 60:S501 | 110:0 | 130:001 | 180:LEE | 380:ANN',
    '260 | 20:CO | 60:S501 | 110:0 | 130:001 | 180:O\'DEA | 380:JUSTIN',
  ];
  const crew = S.parseBoardCrew(parseGrid(POOL));
  assert.deepEqual(crew.map((c) => `${c.craft} ${c.turn} ${c.name}`), ['CO SA05 Ben Allen', 'CO SA06 Rober Borody', 'CO SA07 Ryan Pavey', 'CO SR01 Marc Langis', 'CO SB01 Tom Chad', 'CO SR05 Mike de Man', 'EN S502 open turn', 'CO S502 Chris Nitz', 'EN S501 Ann Lee', "CO S501 Justin O'Dea"]);
  assert.ok(crew.every((c) => c.working === false));
  // Thompson worked SA05 two days ago; the pool screen shows Allen on it today.
  const store = recordNames({}, [{ symbol: 'A42431', originDay: '08', crew: [{ craft: 'CO', turn: 'SA05', name: 'Chris Thompson' }, { craft: 'CO', turn: 'SB09', name: 'Away Person' }] }], new Date('2026-11-08T12:00:00Z'));
  recordBoardCrew(store, crew, new Date('2026-11-10T23:00:00Z'));
  assert.deepEqual(namesByTurn(store, new Date('2026-11-10T23:05:00Z')), { 'S501-CO': "O'Dea, J", 'S501-EN': 'Lee, A', 'S502-CO': 'Nitz, C', 'S502-EN': 'open turn', SA05: 'Allen, B', SA06: 'Borody, R', SA07: 'Pavey, R', SB01: 'Chad, T', SB09: 'Person, A', SR01: 'Langis, M', SR05: 'de Man, M' });
  // Owner: "when a job is working, put the name of the person who's working
  // … when the turn is back home, the person whose turn it is."
  // SA06 goes out with a spare on it: the Call Board has Sam Spare, the pool screen still Borody.
  const out1 = new Date('2026-11-11T02:00:00Z');
  recordNames(store, [{ symbol: 'M38331', originDay: '10', crew: [{ craft: 'CO', turn: 'SA06', name: 'Sam Spare' }] }], out1);
  recordBoardCrew(store, S.parseBoardCrew(parseGrid(['200 | 20:CO | 60:SA06 | 110:0 | 130:999 | 180:BORODY*+ | 340:R | 380:ROBER | 520:M38331'])), out1);
  assert.equal(namesByTurn(store, out1).SA06, 'Spare, S');
  // Off the Call Board but still out (shown working on the pool screen): still the spare.
  const out2 = new Date('2026-11-11T08:00:00Z');
  recordBoardCrew(store, S.parseBoardCrew(parseGrid(['200 | 20:CO | 60:SA06 | 110:0 | 130:999 | 180:BORODY*+ | 340:R | 380:ROBER'])), out2);
  assert.equal(namesByTurn(store, out2).SA06, 'Spare, S');
  // Back home on the board: Borody's turn again.
  const home = new Date('2026-11-11T20:00:00Z');
  recordBoardCrew(store, S.parseBoardCrew(parseGrid(['200 | 20:CO | 60:SA06 | 110:0 | 130:004 | 180:BORODY*+ | 340:R | 380:ROBER'])), home);
  assert.equal(namesByTurn(store, home).SA06, 'Borody, R');
  // The 18.6(b) names don't use the board's: still the trip's.
  assert.deepEqual(namesForHeld([{ id: 'Q9 07', month: '2026-11', co: 'SA05', heldMin: 900 }], store, 840, new Date('2026-11-10T23:05:00Z')), { 'Q9 07 2026-11': { co: 'Chris Thompson', en: null, turnOnly: true } });
});

test('yard jobs: whose job it is, from the crews in town, not who is on duty', () => {
  const lines = [
    'CREWS  IN  TOWN',
    'POOL:  1ST  MANIF                         RESTED/STATUS',
    '01  EN  S105  HILL*+          TR  TREVOR   ** RESTED  **',
    'YARD  :  XSAS01   REL#1   TH/FR   OFF     RESTED/STATUS',
    '      TT   <<  OPEN  TURN  >>              <<TEMP  VCNY>>',
    '      FO   LAKE*+    (NET)  C   CLAYTON  <<  VACANCY  >>',
    '      EN   <<  OPEN  TURN  >>',
    '      S1   FIELD*+(NET)        PAUL     <<TEMP  VCNY>>',
    'YARD  :  YEBS30   REL#3   MO/TU   OFF     RESTED/STATUS',
    '      FO   VAN  DE  MEADOW+  J  JEREMY   ***  OFF  ***',
    'TEMP  FO   BROOKS+         D   DRAKE     ** RESTED  **',
    '      S1   GROVE+          TR  TRISTAN   26/11/03-0953',
  ];
  const rows = lines.map((line, row) => [String(row * 18), ...[...line.matchAll(/\S+/g)].map((m) => `${m.index * 9}:${m[0]}`)].join(' | '));
  const owners = S.parseYardOwners([parseGrid(rows)]);
  assert.deepEqual(owners.map((o) => `${o.job} ${o.craft} ${o.name}`), [
    'XSAS01 FO Clayton Lake', 'XSAS01 EN open turn', 'XSAS01 S1 Paul Field', 'YEBS30 FO Jeremy van de Meadow', 'YEBS30 S1 Tristan Grove']);
  const at = new Date('2026-11-11T03:00:00Z');
  const store = recordYardCrew(recordBoardCrew({}, [{ turn: 'SA05', craft: 'CO', name: 'Ben Allen' }], at), owners, at);
  assert.deepEqual(namesByTurn(store, new Date('2026-11-11T03:05:00Z')), {
    SA05: 'Allen, B', 'XSAS01-EN': 'open turn', 'XSAS01-FO': 'Lake, C', 'XSAS01-S1': 'Field, P', 'YEBS30-FO': 'van de Meadow, J', 'YEBS30-S1': 'Grove, T' });
  // Not seen for 14 days: gone.
  assert.deepEqual(namesByTurn(store, new Date('2026-12-01T03:00:00Z')), {});
});
