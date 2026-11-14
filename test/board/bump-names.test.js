const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseGrid } = require('../../lib/board/grid');
const S = require('../../lib/board/screens');
const { namesOfPeople, namesOnTurn, shortName } = require('../../lib/board/names');

// Owner, 2026-11-14: "Chad, Tyson is his name (Last, First)": the site showed
// "Chad T Tyson, Q" for SB01. Something after TYSON on his row was taken as the
// first name; the name code (nameParts) already read him right. Made-up rows in
// the board's own layout: SURNAME, INITIAL, FIRST NAME, then whatever follows.
test('names: the first name is the word after the initial, not whatever ends the row', () => {
  const crew = S.parseBoardCrew(parseGrid([
    '200 | 20:CO | 60:SB01 | 110:0 | 130:001 | 180:CHAD+ | 340:T | 380:TYSON | 450:Q',
    '210 | 20:CO | 60:SB02 | 110:0 | 130:002 | 180:DE MAN+ | 340:M | 380:MICHA',
    '220 | 20:CO | 60:SB03 | 110:0 | 130:003 | 180:NITZ+ | 380:CHRISTOP',
    '230 | 20:CO | 60:SB04 | 110:0 | 130:004 | 180:VAN DE BERG+ | 340:J | 380:JOHN | 450:QX',
    '240 | 20:EN | 60:SD05 | 110:0 | 130:005 | 180:HILL*+ | 340:TR | 380:TREVOR',
  ]));
  assert.deepEqual(crew.map((c) => [c.turn, c.name, shortName(c.name)]), [
    ['SB01', 'Tyson Chad', 'Chad, T'],
    ['SB02', 'Micha de Man', 'de Man, M'],
    ['SB03', 'Christop Nitz', 'Nitz, C'],
    ['SB04', 'John van de Berg', 'van de Berg, J'],
    ['SD05', 'Trevor Hill', 'Hill, T'],
  ]);
  // The name code read the same row as TYCH all along.
  const people = S.parseBoardNames(parseGrid(['200 | 20:CO | 60:SB01 | 110:0 | 130:001 | 180:CHAD+ | 340:T | 380:TYSON | 450:Q']));
  assert.equal(people[0].code, 'TYCH');
});

test('names: each name code with its name, matched by turn and craft; MU01 rows left out', () => {
  const rows = parseGrid([
    '200 | 20:CO | 60:S502 | 110:0 | 130:001 | 180:CHAD+ | 340:T | 380:TYSON',
    '210 | 20:EN | 60:S502 | 110:0 | 130:001 | 180:STUBBS*+ | 340:C | 380:CHAD',
    '220 | 20:EN | 60:MU01 | 110:1 | 130:999 | 180:ROBBINS*+ | 340:M | 380:MARK',
    '230 | 20:EN | 60:MU01 | 110:1 | 130:999 | 180:DE MAN+ | 340:M | 380:MICHA',
  ]);
  const got = namesOfPeople(S.parseBoardNames(rows), S.parseBoardCrew(rows), (code) => `h:${code}`);
  assert.deepEqual([...got], [['h:TYCH', 'Tyson Chad'], ['h:CHST', 'Chad Stubbs']]);
});

test('who was on a turn: every name kept for it, oldest first, one craft on 501/502', () => {
  const store = {
    'L50231 11|S502': { name: 'Eddie Engineer', seen: '2026-11-11T09:00:00.000Z', crafts: { EN: 'Eddie Engineer', CO: 'Carl Conductor' } },
    'L50131 12|S502': { name: 'Carl Conductor', seen: '2026-11-12T20:00:00.000Z', crafts: { CO: 'Carl Conductor' } },
    '@board|S502': { name: 'Justin Odea', seen: '2026-11-14T05:00:00.000Z', crafts: { CO: "Justin O'Dea" } },
    'M38261 09|SB03': { name: 'Sam Spare', seen: '2026-11-09T12:00:00.000Z', crafts: { CO: 'Sam Spare' } },
    '@board|SB03': { name: 'open turn', seen: '2026-11-14T05:00:00.000Z', crafts: {} },
    '@yard|YBHS01|FO': { name: 'Yard Person', seen: '2026-11-14T05:00:00.000Z' },
  };
  assert.deepEqual(namesOnTurn(store, 'S502-CO').map((x) => [x.name, x.where]), [
    ['Carl Conductor', 'train L50231 11'], ['Carl Conductor', 'train L50131 12'], ["Justin O'Dea", 'the S502 board row now'],
  ]);
  assert.deepEqual(namesOnTurn(store, 'sb03').map((x) => [x.name, x.craft]), [['Sam Spare', 'CO']]);
  assert.deepEqual(namesOnTurn(store, 'SD01'), []);
  // The laptop command prints them, reading BoardChecker\names.json.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'who-was-on-'));
  fs.writeFileSync(path.join(dir, 'names.json'), JSON.stringify(store));
  const out = execFileSync(process.execPath, [require.resolve('../../scripts/who-was-on.js'), 'S502-CO', 'SD01'], { env: { ...process.env, BOARD_DATA_DIR: dir }, encoding: 'utf8' });
  assert.match(out, /S502-CO: \n.*Carl Conductor\s+CO, train L50231 11/);
  assert.match(out, /SD01: no names kept for it/);
});

test('displacement test: the bumped person is named from the boards this run', () => {
  const auto = fs.readFileSync(require.resolve('../../scripts/board-auto.js'), 'utf8');
  assert.ok(auto.includes('for (const [h, name] of namesOfPeople(people, crew, People.personHash)) nameByHash.set(h, name);'));
  assert.ok(auto.includes('const bumped = nameByHash.get(d.h) || (was && was !== by ? was : null) || codeByHash.get(d.h) || null;'));
  // Memory only: nameByHash is never written to a file.
  assert.ok(!/nameByHash[^\n]*(writeFile|saveTold|saveNames)/.test(auto));
});
