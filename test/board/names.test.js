const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseGrid } = require('../../lib/board/grid');
const S = require('../../lib/board/screens');
const { recordNames, namesForHeld, lockNames, loadNames, saveNames, shortName, namesByTurn } = require('../../lib/board/names');
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
