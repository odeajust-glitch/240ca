// The yardmaster seniority list (owner, 2026-11-13): CATS 3 → 1, list code
// 3G YA, 45 SA, read twice a day and kept only on the laptop. Laid out as in
// his photos of 13 Nov; every name here is made up.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../../lib/board/screens');
const { parseGrid } = require('../../lib/board/grid');
const Sen = require('../../lib/board/seniority');

const grid = (lines) => parseGrid(lines.map((line, row) => [String(row * 18), ...[...line.matchAll(/\S+/g)].map((m) => `${m.index * 9}:${m[0]}`)].join(' | ')));
const show = (list) => list.map((p) => `${p.rank} ${p.date} ${p.name} | ${p.key} | ${p.awarded || '-'} ${p.move || '-'} ${p.status || '-'} | ${p.assignment || '-'} ${p.pool || '-'} ${p.turn || '-'} ${p.craft || '-'} ${p.yard ? 'yard' : 'road'} | ${p.description || '-'}`);

test('yardmaster seniority: each person, their marks, status and own job, over two lines', () => {
  const lines = [
    'LIST  CODE:  [3G]  [YA]          SENIORITY  LIST  INQUIRY                 PSTS02F',
    '                                 YARDMSTRS  (LN,HA,SA,OAKVL)',
    'EMP-NBR:  []      OR  NAME:  []                         FIRST  TV  DATE:  []',
    '        DIST:  [45]   SUB-DIST:  [SA]   SERVICE:  []   TEMP  ASGN(Y):  []',
    'RANK    DATE        EMPLOYEE  NAME              DIST/SUB    AWARDED      MOVE  TYPE    STATUS',
    '                                                          CURRENT  ASSIGNMENT',
    '   30   930421   ALDER*+        TJ    TOMAS        45   SA    2610251200          B',
    '                                              YSTY01YA    0630  TOWER  S/S    JT60',
    '   60   960713   BIRCH+         PG    PETER        45   SA    2610251200          B        OFF',
    '                                              YSBY01YA    0700  YDM  BLOCK  1',
    '  140   150724   CEDAR*+        M     MILO         45   SA    2610251212',
    '                                              EXYA01YA    TRAFFIC  COORDINATORS  SPARE',
    '  150   170309   DOGWOOD*+(NODP)A     ARNO         45   SA    2610251200          B',
    '                                              S1S102EN    1ST  MANIF',
    '  230   191219   ELM*+          E     EDGAR        45   SA    2610251212                   VACATION',
    '                                              EXEN08EN    SARNIA  ENGINEERS  FAST/SLOW',
    '  270   220526   FIR*+          K     KARL         45   SA    2611110757          F',
    '                                              S5S502EN    502/501  PL',
    '  295   231010   GUM*+          K     KURT         45   SA                                 VACATION',
    '  320   231010   HAZEL*+(NET)MA       MARTIN       45   SA                                 OFF',
    '  410   250925   IVY*+  (NET)   C     COLE         45   SA    2610251200          B',
    '                                              XSAS01FO    REL#1  TH/FR    OFF',
    '  480   250925   JUNIPER*+(NET)       GORDON       45   SA    2610251200          B',
    '                                              SASA08CO    CO  "A"POOL',
    '  487   250925   O\'KAPOK+       BO    BRIAN        45   SA    2610251200          B',
    '                                              YBHS31FO    1600  BUNKHOUSE  W3/T3',
    'ENTER=INQ/RESTART      PF1=HELP     PF3=EXIT     PF7=PAGEUP     PF8=PAGEDN     PF11=PREV   MENU',
    'END  OF  LIST                                                                         E008-1',
  ];
  const rows = grid(lines);
  assert.equal(S.isSeniorityList(rows.map((r) => r.text).join(' ')), true);
  const list = S.parseSeniorityList(rows);
  assert.deepEqual(show(list), [
    '30 930421 ALDER*+ TJ TOMAS | ALDER/T/TOM | 2610251200 B - | YSTY01YA - YSTY01 YA yard | 0630 TOWER S/S JT60',
    '60 960713 BIRCH+ PG PETER | BIRCH/P/PET | 2610251200 B OFF | YSBY01YA - YSBY01 YA yard | 0700 YDM BLOCK 1',
    '140 150724 CEDAR*+ M MILO | CEDAR/M/MIL | 2610251212 - - | EXYA01YA EX YA01 YA road | TRAFFIC COORDINATORS SPARE',
    '150 170309 DOGWOOD*+(NODP)A ARNO | DOGWOOD/A/ARN | 2610251200 B - | S1S102EN S1 S102 EN road | 1ST MANIF',
    '230 191219 ELM*+ E EDGAR | ELM/E/EDG | 2610251212 - VACATION | EXEN08EN EX EN08 EN road | SARNIA ENGINEERS FAST/SLOW',
    '270 220526 FIR*+ K KARL | FIR/K/KAR | 2611110757 F - | S5S502EN S5 S502 EN road | 502/501 PL',
    // No assignment: no second line, and the next person isn't taken for one.
    '295 231010 GUM*+ K KURT | GUM/K/KUR | - - VACATION | - - - - road | -',
    '320 231010 HAZEL*+(NET)MA MARTIN | HAZEL/M/MAR | - - OFF | - - - - road | -',
    // The OFF after TH/FR is the relief job's days off, not a status.
    '410 250925 IVY*+ (NET) C COLE | IVY/C/COL | 2610251200 B - | XSAS01FO - XSAS01 FO yard | REL#1 TH/FR OFF',
    // No initials shown: the first name's letter stands in, as on the boards.
    '480 250925 JUNIPER*+(NET) GORDON | JUNIPER/G/GOR | 2610251200 B - | SASA08CO SA SA08 CO road | CO "A"POOL',
    "487 250925 O'KAPOK+ BO BRIAN | O'KAPOK/B/BRI | 2610251200 B - | YBHS31FO - YBHS31 FO yard | 1600 BUNKHOUSE W3/T3",
  ]);
  assert.deepEqual([list[0].marks, list[0].tags, list[7].tags, list[8].marks], ['*+', [], ['NET'], '*+']);
  assert.deepEqual([list[0].dist, list[0].sub], ['45', 'SA']);
});

test('yardmaster seniority: as the checker reads it, boxes and cells split their own way', () => {
  const rows = parseGrid([
    '1 | 10:LIST CODE: | 120:[3G] | 160:[YA] | 300:SENIORITY LIST INQUIRY | 640:PSTS02F',
    '19 | 300:YARDMSTRS (LN,HA,SA,OAKVL)',
    '73 | 30:30 | 64:930421 | 130:ALDER*+ | 250:TJ | 300:TOMAS | 410:45 | 440:SA | 480:2610251200 | 620:B',
    '91 | 400:YSTY01YA | 480:0630 TOWER S/S | 620:JT60',
    '109 | 30:40 | 64:951226 | 130:BIRCH+ | 250:JW | 300:JONAS | 410:45 | 440:SA | 480:2610251200 | 620:B | 680:OFF',
    '127 | 400:YSBY06YA | 480:1430 S/S TEMP YA',
    '397 | 19:ENTER=INQ/RESTART | 235:PF1=HELP | 334:PF3=EXIT | 433:PF7=PAGEUP | 541:PF8=PAGEDN',
    '415 | 19:PRESS PFKEY8 TO SCROLL | 640:P004-1',
  ]);
  assert.deepEqual(show(S.parseSeniorityList(rows)), [
    '30 930421 ALDER*+ TJ TOMAS | ALDER/T/TOM | 2610251200 B - | YSTY01YA - YSTY01 YA yard | 0630 TOWER S/S JT60',
    '40 951226 BIRCH+ JW JONAS | BIRCH/J/JON | 2610251200 B OFF | YSBY06YA - YSBY06 YA yard | 1430 S/S TEMP YA',
  ]);
  // Other screens are not taken for it.
  assert.equal(S.isSeniorityList('CIRCULAR INQUIRY- TRAIN/YARD'), false);
  assert.deepEqual(S.parseSeniorityList(grid(['   785410   1445  PLANK  YDH   W/T   45SA   YPRS30  S1    A      3    261112   P'])), []);
});

test('yardmaster seniority: read on the first check after 0000 and after 1200, Toronto time', () => {
  // November: Toronto is UTC-5.
  assert.equal(Sen.slotOf(new Date('2026-11-13T05:00:00Z')), '2026-11-13 0000'); // 0000
  assert.equal(Sen.slotOf(new Date('2026-11-13T04:59:00Z')), '2026-11-12 1200'); // 2359 the day before
  assert.equal(Sen.slotOf(new Date('2026-11-13T16:59:00Z')), '2026-11-13 0000'); // 1159
  assert.equal(Sen.slotOf(new Date('2026-11-13T17:00:00Z')), '2026-11-13 1200'); // 1200
  const at0005 = new Date('2026-11-13T05:05:00Z');
  assert.equal(Sen.due(null, at0005), true); // nothing read yet: this check
  const read = Sen.keep(null, [{ rank: 30, name: 'ALDER*+ TJ TOMAS', assignment: 'YSTY01YA', status: '' }], { now: at0005, pages: 5 });
  assert.equal(Sen.due(read, new Date('2026-11-13T05:10:00Z')), false); // the next check, same half day
  assert.equal(Sen.due(read, new Date('2026-11-13T16:55:00Z')), false); // 1155
  assert.equal(Sen.due(read, new Date('2026-11-13T17:02:00Z')), true); // the first check after 1200
  assert.equal(Sen.due(read, new Date('2026-11-14T05:01:00Z')), true); // and after the next 0000
  // A read that keeps failing: three tries a half day, then left until the next.
  assert.equal(Sen.due(read, new Date('2026-11-13T17:02:00Z'), 2), true);
  assert.equal(Sen.due(read, new Date('2026-11-13T17:02:00Z'), 3), false);
});

test('yardmaster seniority: each version of the list kept with when it was seen', () => {
  const a = [{ rank: 30, name: 'ALDER*+ TJ TOMAS', assignment: 'YSTY01YA', status: '' }, { rank: 60, name: 'BIRCH+ PG PETER', assignment: 'YSBY01YA', status: 'OFF' }];
  const t1 = new Date('2026-11-13T05:05:00Z');
  const t2 = new Date('2026-11-13T17:05:00Z');
  const t3 = new Date('2026-11-14T05:05:00Z');
  const r1 = Sen.keep(null, a, { now: t1, pages: 5 });
  assert.deepEqual([r1.since, r1.count, r1.slot, r1.past], [t1.toISOString(), 2, '2026-11-13 0000', []]);
  const r2 = Sen.keep(r1, a.map((p) => ({ ...p })), { now: t2 });
  assert.deepEqual([r2.since, r2.past.length, r2.slot], [t1.toISOString(), 0, '2026-11-13 1200']); // the same list: still since t1
  const b = [a[0], { ...a[1], status: '' }]; // back from OFF
  const r3 = Sen.keep(r2, b, { now: t3 });
  assert.equal(r3.since, t3.toISOString());
  assert.deepEqual(r3.past, [{ from: t1.toISOString(), until: t2.toISOString(), list: a }]);
  // Only so many versions are kept.
  let r = r3;
  for (let i = 0; i < Sen.KEEP_PAST + 5; i++) r = Sen.keep(r, [{ ...a[0], status: String(i) }], { now: new Date(t3.getTime() + (i + 1) * 43200000) });
  assert.equal(r.past.length, Sen.KEEP_PAST);
});

test('yardmaster seniority: each person\'s short name, "Last, F", as the board\'s crew names', () => {
  const list = S.parseSeniorityList(grid([
    '   30   930421   ALDER*+        TJ    TOMAS        45   SA    2610251200          B',
    '  480   250925   JUNIPER*+(NET)       GORDON       45   SA    2610251200          B',
    '  487   250925   O\'KAPOK+       BO    BRIAN        45   SA    2610251200          B',
  ]));
  assert.deepEqual(list.map((p) => p.short), ['Alder, T', 'Juniper, G', "O'Kapok, B"]);
});

test('yardmaster seniority: names stay on the laptop, except locked for the test site (never backed up, never in the clear)', async () => {
  const os = require('os');
  const { buildSite } = require('../../lib/board/site');
  const { unlockNames } = require('../../public/board-names');
  const backup = fs.readFileSync(path.join(__dirname, '../../lib/board/backup.js'), 'utf8');
  assert.match(backup, /SKIP_FILES = .*yardmaster-seniority\\\.json/);
  const { YM_SENIORITY_FILE, DATA_DIR } = require('../../lib/board/paths');
  assert.equal(path.dirname(YM_SENIORITY_FILE), DATA_DIR);
  // The site gets the list without names, and the names by rank apart.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-site-'));
  const file = path.join(root, 'yardmaster-seniority.json');
  const people = S.parseSeniorityList(grid([
    '   30   930421   ALDER*+        TJ    TOMAS        45   SA    2610251200          B',
    '                                              YSTY01YA    0630  TOWER  S/S    JT60',
    '  140   150724   CEDAR*+        M     MILO         45   SA    2610251212                   OFF',
    '                                              EXYA01YA    TRAFFIC  COORDINATORS  SPARE',
  ]));
  fs.writeFileSync(file, JSON.stringify(Sen.keep(null, people, { now: new Date('2026-11-14T05:05:00Z'), pages: 1 })));
  const got = Sen.siteList(file);
  assert.deepEqual(got.names, { 30: 'Alder, T', 140: 'Cedar, M' });
  assert.equal(got.source, 'cats');
  assert.doesNotMatch(JSON.stringify(got.list), /ALDER|Alder|CEDAR|Cedar|TOMAS|MILO/);
  assert.deepEqual(got.list.map((r) => [r.rank, r.assignment, r.status]), [[30, 'YSTY01YA', ''], [140, 'EXYA01YA', 'OFF']]);
  // A list saved before the short names were kept: made from the name as CATS showed it.
  const older = path.join(root, 'older.json');
  fs.writeFileSync(older, JSON.stringify({ at: '2026-11-13T20:46:29.689Z', list: people.map(({ short, ...r }) => r) }));
  assert.deepEqual(Sen.siteList(older).names, { 30: 'Alder, T', 140: 'Cedar, M' });
  // Before the laptop has read it: the 13 Nov copy in the repository, no names.
  const early = Sen.siteList(path.join(root, 'none.json'));
  assert.equal(early.list.length, 34);
  assert.equal(early.names, null);
  // buildSite: data/ym-list.json with the names locked by the names key; no key, no names. And the page.
  const hist = path.join(root, 'history', '2026-10-15');
  fs.mkdirSync(hist, { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../fixtures/board/2026-10-15b.json'), path.join(hist, '0815.json'));
  const out = path.join(root, 'site');
  buildSite({ historyDir: path.join(root, 'history'), outDir: out, days: 0, ym: file, names: { file: path.join(root, 'names.json'), key: 'pass phrase' } });
  const pub = fs.readFileSync(path.join(out, 'data/ym-list.json'), 'utf8');
  assert.doesNotMatch(pub, /ALDER|Alder|CEDAR|Cedar|TOMAS|MILO/);
  assert.deepEqual(await unlockNames(JSON.parse(pub).names, 'pass phrase'), { byRank: { 30: 'Alder, T', 140: 'Cedar, M' } });
  assert.ok(fs.existsSync(path.join(out, 'ym.html')) && fs.existsSync(path.join(out, 'board-ym.js')));
  buildSite({ historyDir: path.join(root, 'history'), outDir: out, days: 0, ym: file, names: { file: path.join(root, 'names.json'), key: '' } });
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'data/ym-list.json'), 'utf8')).names, null);
  // The route reads it unmasked and never captures it into the saved check.
  const auto = fs.readFileSync(path.join(__dirname, '../../scripts/board-auto.js'), 'utf8');
  const block = auto.slice(auto.indexOf('// The yardmaster seniority list (owner, 2026-11-13'), auto.indexOf('// Owner, 2026-10-24: the spareboards'));
  assert.ok(block.length > 500);
  assert.doesNotMatch(block, /capture\(/);
  assert.match(block, /unmaskedRows\(\)/);
});

test('yardmaster seniority: with TEMP ASGN Y, each temporary assignment put beside the permanent job', () => {
  // The permanent list, then the same list read with Y (owner, 2026-11-13: "put Y in that slot then make
  // the seinority list from that infomation"). Made-up names; the layout with Y not seen yet, so both
  // ways it might show a temporary job are taken: in place of the permanent one, or on a second line.
  const perm = S.parseSeniorityList(grid([
    '   30   930421   ALDER*+        TJ    TOMAS        45   SA    2610251200          B',
    '                                              YSTY01YA    0630  TOWER  S/S    JT60',
    '  320   231010   HAZEL*+(NET)MA       MARTIN       45   SA                                 OFF',
    '  487   250925   O\'KAPOK+       BO    BRIAN        45   SA    2610251200          B',
    '                                              YBHS31FO    1600  BUNKHOUSE  W3/T3',
  ]));
  const temp = S.parseSeniorityList(grid([
    '   30   930421   ALDER*+        TJ    TOMAS        45   SA    2610251200          B',
    '                                              YSTY01YA    0630  TOWER  S/S    JT60',
    '  320   231010   HAZEL*+(NET)MA       MARTIN       45   SA    2611121400          T',
    '                                              SDSD05EN    DRAG  POOL',
    '  487   250925   O\'KAPOK+       BO    BRIAN        45   SA    2610251200          B',
    '                                              YBHS31FO    1600  BUNKHOUSE  W3/T3',
    '                                              YPRS60FO    2245  PLANK  F2/S2',
    'END  OF  LIST',
  ]));
  assert.deepEqual(temp[2].extra.map((x) => x.assignment), ['YPRS60FO']); // a second line is kept, not lost
  const merged = Sen.withTemp(perm, temp);
  assert.equal(merged[0].temp, undefined); // the same job: nothing temporary
  assert.deepEqual([merged[1].assignment, merged[1].temp.assignment, merged[1].temp.turn, merged[1].temp.awarded], ['', 'SDSD05EN', 'SD05', '2611121400']);
  assert.deepEqual([merged[2].assignment, merged[2].temp.assignment, merged[2].temp.description], ['YBHS31FO', 'YPRS60FO', '2245 PLANK F2/S2']);
  assert.equal(Sen.withTemp(perm, null), perm); // not read: the list as it was
  // A new temporary job is a new version of the list; the site gets it, still without names.
  const t1 = new Date('2026-11-14T05:05:00Z');
  const a = Sen.keep(null, perm, { now: t1 });
  const b = Sen.keep(a, merged, { now: new Date('2026-11-14T17:05:00Z'), tempRead: { ok: true, rows: 3, pages: 1, temps: 2 } });
  assert.equal(b.past.length, 1);
  assert.deepEqual(b.tempRead, { ok: true, rows: 3, pages: 1, temps: 2 });
  const os = require('os');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ym-temp-')), 'yardmaster-seniority.json');
  fs.writeFileSync(file, JSON.stringify(b));
  const site = Sen.siteList(file);
  assert.deepEqual(site.list.map((r) => r.temp ? r.temp.assignment : ''), ['', 'SDSD05EN', 'YPRS60FO']);
  assert.deepEqual(site.tempRead, { ok: true, rows: 3, pages: 1, temps: 2 });
  assert.doesNotMatch(JSON.stringify(site.list), /ALDER|Alder|HAZEL|Hazel|KAPOK|Kapok/);
  // The route: a second pass with Y in TEMP ASGN(Y), its failure never costs the list.
  const auto = fs.readFileSync(path.join(__dirname, '../../scripts/board-auto.js'), 'utf8');
  assert.ok(auto.includes("['TEMP ASGN(Y)', 'ASGN") && auto.includes("[temp ? 'Y' : ''], !temp]"), 'Y in TEMP ASGN(Y) on the second pass only');
  assert.match(auto, /await readList\(true\)/);
  assert.match(auto, /Seniority\.withTemp\(/);
});

test('yardmaster seniority: each person as the newest check showed them, by rank (the test site\'s "went spare now")', () => {
  // Made-up list rows (no names), and a snapshot in the day files' shape with each kind of status.
  const row = (rank, assignment, turn, craft, extra = {}) => ({ rank, assignment, turn, craft, yard: /^[YX]/.test(assignment), ...extra });
  const list = [
    row(30, 'YSTY01YA', 'YSTY01', 'YA'), row(40, 'YSBY06YA', 'YSBY06', 'YA'), row(60, 'YSBY01YA', 'YSBY01', 'YA'),
    row(140, 'EXYA01YA', 'YA01', 'YA'), row(150, 'S1S102EN', 'S102', 'EN'), row(200, 'SDSD07EN', 'SD07', 'EN'),
    row(280, 'SRSR10CO', 'SR10', 'CO'), row(300, 'SASA07CO', 'SA07', 'CO'), row(310, 'SRSR01CO', 'SR01', 'CO'),
    row(320, '', '', '', { temp: { assignment: 'SDSD05EN', turn: 'SD05', craft: 'EN' } }), row(390, 'YBHS01S1', 'YBHS01', 'S1'),
    row(460, 'SBSB04CO', 'SB04', 'CO'), row(487, 'YBHS31FO', 'YBHS31', 'FO'), row(295, '', '', ''),
  ];
  const snap = {
    taken: '2026-11-13 1716',
    pools: [{ name: 'SD · engineers', turns: [{ pos: '001', turn: 'SD07', status: 'hold turn until 14th 2259 (**); rest until 14th 0159' }, { pos: '002', turn: 'SD05', status: 'out working on M38261' }] },
      { name: 'Chain Gang (SR) · conductors', turns: [{ pos: '001', turn: 'SR10', status: 'available' }] }],
    town: [
      { turn: 'YSTY01', craft: 'YA', text: 'YA: on rest until 14th 0030' }, { turn: 'YSBY06', craft: 'YA', text: 'YA: status not known' },
      { turn: 'YSBY01', craft: 'YA', text: 'YA: status not known' }, { turn: 'SA07', craft: 'CO', text: 'CO: rested' },
      { turn: 'YBHS01', craft: 'S1', text: 'S1: day off' }, { turn: 'YBHS01', craft: 'S1', text: 'S1 (temporary): on rest until 14th 0200' },
      { turn: 'YBHS31', craft: 'FO', text: 'FO: status not known' },
    ],
    onDuty: [{ onDuty: '13th 1635', train: 'Z14931 13', crew: 'EN S304 · CO SB04' }],
    onTheWay: [],
    bunkhouse: [{ pos: '002', en: 'S102', co: 'SA02', rested: '13th 2249' }],
    away: ['SR01'], returning: [],
    daysOff: [{ from: '13th 0001', until: '14th 0001', on: true, turn: 'YSBY01', craft: 'YA' }],
  };
  const L = Sen.liveFacts(list, snap);
  assert.equal(L.taken, '2026-11-13 1716');
  const got = (rank) => { const x = L.byRank[rank]; return `${x.status}|${x.freeAt}|${x.text}|${x.src}`; };
  assert.equal(got(30), 'available|2026-11-14T00:30|YSTY01 YA: on rest until 14th 0030|crews in town');
  assert.equal(got(40), 'available||YSBY06 YA: status not known|crews in town'); // on duty: their own shift decides
  assert.equal(got(60), 'off||YSBY01 YA: status not known; days off 13th 0001 to 14th 0001|crews in town');
  assert.equal(got(140), 'available||YA01 YA: not on a board the checker reads|');
  assert.equal(got(150), 'busy||S102 EN: at the Toronto bunkhouse, rested 13th 2249|Toronto bunkhouse');
  assert.equal(got(200), 'available|2026-11-14T22:59|SD07 EN: hold turn until 14th 2259 (**); rest until 14th 0159|SD · engineers');
  assert.equal(got(280), 'available||SR10 CO: available|Chain Gang (SR) · conductors');
  assert.equal(got(300), 'available||SA07 CO: rested|crews in town');
  assert.equal(got(310), 'busy||SR01 CO: away from Sarnia|away');
  assert.equal(got(320), 'busy||SD05 EN (temporary): out working on M38261|SD · engineers'); // the temporary job decides
  assert.equal(got(390), 'off||YBHS01 S1: day off|crews in town'); // the "(temporary)" line is someone else's
  assert.equal(got(460), 'busy||SB04 CO: on duty on Z14931 13 from 13th 1635|Call Board');
  assert.equal(got(295), 'available||no current job|');
  assert.equal(Sen.liveFacts(list, { taken: '' }), null);
});
