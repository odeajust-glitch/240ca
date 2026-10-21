const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseGrid } = require('../../lib/board/grid');
const S = require('../../lib/board/screens');
const { recordNames, namesForHeld, lockNames, loadNames, saveNames } = require('../../lib/board/names');
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
  const held = namesForHeld(rows, store, 840);
  assert.deepEqual(held, { 'E27861 17 2026-10': { co: 'Mike de Man', en: 'Don Wilson' }, 'X1 17 2026-10': { co: 'Mike de Man', en: null } });

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
