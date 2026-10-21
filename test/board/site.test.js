const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildSite, deploySite, snapshotOf } = require('../../lib/board/site');
const BoardTurns = require('../../public/board-turns');
const BoardTrains = require('../../public/board-trains');

const fixture = (name) => fs.readFileSync(path.join(__dirname, '../fixtures/board', name));

// A history folder laid out like board-auto.js writes it.
function makeHistory() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'board-site-'));
  const hist = path.join(root, 'history');
  const put = (day, file, body) => {
    fs.mkdirSync(path.join(hist, day), { recursive: true });
    fs.writeFileSync(path.join(hist, day, file), body);
  };
  put('2026-10-14', '1617.json', fixture('2026-10-14.json'));
  put('2026-10-15', '0143.json', fixture('2026-10-15.json'));
  put('2026-10-15', '0815.json', fixture('2026-10-15b.json'));
  // Same board five minutes later.
  const again = JSON.parse(fixture('2026-10-15b.json'));
  put('2026-10-15', '0820.json', JSON.stringify({ ...again, probedAt: '2026-10-15T12:20:27.398Z' }));
  put('2026-10-15', '0825.json', '{ not json');
  return { root, hist, out: path.join(root, 'site') };
}

test('site: builds a day file per day, newest day first in the index', () => {
  const { hist, out } = makeHistory();
  const built = buildSite({ historyDir: hist, outDir: out, days: 0, now: new Date('2026-10-16T12:00:00Z') });
  assert.strictEqual(built.days, 2);
  assert.strictEqual(built.snapshots, 3);
  assert.strictEqual(built.skipped.length, 1); // the broken file is skipped, not fatal

  const index = JSON.parse(fs.readFileSync(path.join(out, 'data/index.json'), 'utf8'));
  assert.deepStrictEqual(index.days, [{ day: '2026-10-15', count: 2 }, { day: '2026-10-14', count: 1 }]);
  assert.strictEqual(index.latest, '2026-10-15 0815');
  assert.ok(fs.existsSync(path.join(out, 'index.html')));
  assert.match(fs.readFileSync(path.join(out, 'robots.txt'), 'utf8'), /Disallow: \//);
});

test('site: an unchanged check stretches the one before; changes chain across days', () => {
  const { hist, out } = makeHistory();
  buildSite({ historyDir: hist, outDir: out, days: 0 });
  const d14 = JSON.parse(fs.readFileSync(path.join(out, 'data/2026-10-14.json'), 'utf8')).snapshots;
  const d15 = JSON.parse(fs.readFileSync(path.join(out, 'data/2026-10-15.json'), 'utf8')).snapshots;
  assert.strictEqual(d14[0].changes, null); // first ever
  assert.strictEqual(d15[0].prevTaken, d14[0].taken); // compared with yesterday's last
  assert.ok(d15[0].changes.length > 0);
  assert.strictEqual(d15[1].taken, '2026-10-15 0815');
  assert.strictEqual(d15[1].sameUntil, '2026-10-15 0820');
  // Nothing personal: no "when you go" answer in what's published.
  assert.doesNotMatch(JSON.stringify([d14, d15]), /WHEN YOU GO/);
});

test('site: days outside the window come off', () => {
  const { hist, out } = makeHistory();
  buildSite({ historyDir: hist, outDir: out, days: 0 });
  assert.ok(fs.existsSync(path.join(out, 'data/2026-10-14.json')));
  buildSite({ historyDir: hist, outDir: out, days: 1 });
  assert.ok(!fs.existsSync(path.join(out, 'data/2026-10-14.json')));
  const index = JSON.parse(fs.readFileSync(path.join(out, 'data/index.json'), 'utf8'));
  assert.deepStrictEqual(index.days.map((d) => d.day), ['2026-10-15']);
});

test('site: deploy sends every file digest and uploads only what Netlify asks for', async () => {
  const { hist, out } = makeHistory();
  buildSite({ historyDir: hist, outDir: out, days: 0 });
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    if (opts.method === 'POST') {
      const files = JSON.parse(opts.body).files;
      return { ok: true, json: async () => ({ id: 'dep1', ssl_url: 'https://x.netlify.app', required: [files['/data/index.json']] }) };
    }
    return { ok: true };
  };
  const sent = await deploySite({ dir: out, siteId: 'site1', token: 'tok', fetchImpl: fakeFetch });
  assert.deepStrictEqual(sent, { ok: true, uploaded: 1, url: 'https://x.netlify.app' });
  const posted = JSON.parse(calls[0].opts.body).files;
  assert.deepStrictEqual(Object.keys(posted).sort(), ['/board-trains.js', '/board-turns.js', '/data/2026-10-14.json', '/data/2026-10-15.json', '/data/index.json', '/data/trains.json', '/data/turns.json', '/grievance.js', '/grievance_template.odt', '/index.html', '/jszip.min.js', '/robots.txt']);
  assert.match(calls[0].url, /\/sites\/site1\/deploys$/);
  assert.strictEqual(calls[0].opts.headers.Authorization, 'Bearer tok');
  assert.match(calls[1].url, /\/deploys\/dep1\/files\/data\/index\.json$/);
});

test('site: a refused token is reported, not thrown', async () => {
  const { hist, out } = makeHistory();
  buildSite({ historyDir: hist, outDir: out, days: 0 });
  const sent = await deploySite({ dir: out, siteId: 's', token: 'bad', fetchImpl: async () => ({ ok: false, status: 401 }) });
  assert.strictEqual(sent.ok, false);
  assert.match(sent.message, /NETLIFY_AUTH_TOKEN/);
  const down = await deploySite({ dir: out, siteId: 's', token: 't', fetchImpl: async () => { throw new Error('offline'); } });
  assert.deepStrictEqual(down, { ok: false, message: 'offline' });
});

test('turns: where a turn shows up in one snapshot', () => {
  const { hist, out } = makeHistory();
  buildSite({ historyDir: hist, outDir: out, days: 0 });
  const [, s] = JSON.parse(fs.readFileSync(path.join(out, 'data/2026-10-15.json'), 'utf8')).snapshots;
  const f = BoardTurns.facts(s, 'sr04');
  assert.deepStrictEqual(f.map((x) => x.kind), ['pool', 'lineup']);
  assert.match(f[0].text, /^Chain Gang \(SR\) position 002: \*\* goes spare/);
  assert.match(f[1].text, /E27861 15/);
  assert.deepStrictEqual(BoardTurns.facts(s, 'SR02').map((x) => x.kind), ['pool', 'onDuty', 'sequence']);
  assert.deepStrictEqual(BoardTurns.facts(s, 'SR01').map((x) => x.kind), ['away']);
  assert.deepStrictEqual(BoardTurns.facts(s, 'SR0'), []); // no partial matches
  assert.ok(BoardTurns.turnsIn(s).includes('SA07'));
});

test('turns: history records each change, across days', () => {
  const { hist, out } = makeHistory();
  buildSite({ historyDir: hist, outDir: out, days: 0 });
  const { turns } = JSON.parse(fs.readFileSync(path.join(out, 'data/turns.json'), 'utf8'));
  const sr03 = turns.SR03.changes;
  assert.strictEqual(sr03[0].taken, '2026-10-14 1617');
  assert.ok(sr03.length >= 2);
  // Consecutive entries always differ.
  for (let i = 1; i < sr03.length; i++) assert.notStrictEqual(sr03[i].text, sr03[i - 1].text);
  assert.ok(!('__last' in turns));
  // SR03's rest to 15th 1015, first seen at 0143.
  assert.deepStrictEqual(turns.SR03.rests.map((r) => [r.kind, r.until, r.seen]), [['Rest', '15th 1015', '2026-10-15 0143']]);
  // SR04: ** goes spare, and its train goes spare too.
  assert.ok(turns.SR04.spares.some((x) => /\*\* goes spare/.test(x.text)));
  assert.ok(turns.SR04.spares.some((x) => /its train E27861 15 goes spare/.test(x.text)));
  assert.ok(turns.SR04.orders.some((o) => o.train === 'E27861 15' && /Chain Gang: SR04/.test(o.projected)));
});

test('turns: a change that lasted under 30 minutes is left out unless it matters', () => {
  const snap = (taken, status) => ({ taken, pools: [{ name: 'Chain Gang (SR) · conductors', turns: [{ pos: '003', turn: 'SR03', status }] }] });
  const h = BoardTurns.finish(BoardTurns.history([
    snap('2026-10-17 0800', 'available'),
    snap('2026-10-17 0810', 'B0: working another job, goes spare if called'), // 10 min, but spare: kept
    snap('2026-10-17 0815', 'available'),
    snap('2026-10-17 0820', 'out working on M30241'), // 10 min: dropped
    snap('2026-10-17 0830', 'available'),
    snap('2026-10-17 1000', 'rest until 17th 1800'),
  ]));
  assert.deepStrictEqual(h.SR03.changes.map((c) => c.taken), ['2026-10-17 0810', '2026-10-17 0830', '2026-10-17 1000']);
  assert.deepStrictEqual(h.SR03.spares.map((x) => [x.seen, x.last]), [['2026-10-17 0810', '2026-10-17 0810']]);
  assert.deepStrictEqual(h.SR03.rests.map((r) => r.until), ['17th 1800']);
});

test('orders: each train followed from first sighting to on duty', () => {
  const { hist, out } = makeHistory();
  buildSite({ historyDir: hist, outDir: out, days: 0 });
  const { trains } = JSON.parse(fs.readFileSync(path.join(out, 'data/trains.json'), 'utf8'));
  const byId = Object.fromEntries(trains.map((r) => [r.id, r]));
  // Seen PLN for 15th 0705 on the 14th, ORD for 0400 at 0143, on duty 0345.
  const m = byId['M30241 13'];
  assert.strictEqual(m.month, '2026-10');
  assert.strictEqual(m.firstSeen, '2026-10-14 1617');
  assert.strictEqual(m.firstPlan, '2026-10-15 0705');
  assert.strictEqual(m.firstOrder, '2026-10-15 0400');
  assert.strictEqual(m.onDuty, '2026-10-15 0345');
  assert.strictEqual(m.offPlan, -200);
  assert.strictEqual(m.offOrder, -15);
  assert.strictEqual(m.day, '2026-10-15');
  assert.deepStrictEqual(m.events.map((e) => e.kind), ['seen', 'ordered', 'onDuty']);
  // Plan moves are kept; no on duty yet → no "off".
  const x = byId['X30241 13'];
  assert.strictEqual(x.planChanges, 2);
  assert.strictEqual(x.offPlan, null);
});

test('orders: an ordered time that changes is counted, and month ends resolve', () => {
  const T = BoardTrains;
  const snap = (taken, status, order, onDuty) => ({ taken, lineup: onDuty ? [] : [{ train: 'Q12345 31', status, order }],
    onDuty: onDuty ? [{ train: 'Q12345 31', onDuty, station: 'SARNIA', crew: 'CO SR04' }] : [] });
  const st = T.track([
    snap('2026-10-31 2210', 'PLN', '1st 0600'),
    snap('2026-11-01 0350', 'ORD', '1st 0815'),
    snap('2026-11-01 0620', 'ORD', '1st 0900'),
    snap('2026-11-01 0850', null, null, '1st 0845'),
  ]);
  const [r] = T.summarize(st);
  assert.strictEqual(r.month, '2026-10'); // origin day 31 → October, though ordered in November
  assert.strictEqual(r.firstPlan, '2026-11-01 0600');
  assert.strictEqual(r.firstOrder, '2026-11-01 0815');
  assert.strictEqual(r.order, '2026-11-01 0900');
  assert.strictEqual(r.orderChanges, 1);
  assert.strictEqual(r.offPlan, 165);
  assert.strictEqual(r.offOrder, 30);
  assert.strictEqual(r.day, '2026-11-01');
});

test('site: S1/S3 engineer pools show under the pools; no "not ours" aside', () => {
  const fx = JSON.parse(fixture('2026-10-15b.json'));
  // The A pool screen again as CATS would show it with CC EN (S1 turns).
  const a = fx.screens[3].screenGrid.map((l) => l.replace('[CO]', '[EN]').replace(/10:CO \| 37:SA0/, '10:EN | 37:S10'));
  const b = fx.screens[4].screenGrid.map((l) => l.replace('[CO]', '[EN]').replace(/10:CO \| 37:SB0/, '10:EN | 37:S30'));
  const { shown } = snapshotOf({ ...fx, screens: [...fx.screens, { screenGrid: a }, { screenGrid: b }] });
  const names = shown.pools.map((p) => p.name);
  assert.deepStrictEqual(names, ['Chain Gang (SR) · conductors', 'A pool (SA)', 'B pool (SB)', 'S1 · engineers (A)', 'S3 · engineers (B)']);
  assert.deepStrictEqual(shown.pools[3].turns.map((t) => t.turn).slice(0, 2), ['S107', 'S108']);
  assert.strictEqual(shown.pools[1].turns[0].turn, 'SA07'); // A pool unchanged
  assert.ok(shown.lineup.some((t) => t.rules === 'S5 (L502/L501)'));
  assert.doesNotMatch(JSON.stringify(shown), /not ours/);
});

// The owner's screenshots of 2026-10-17: bunkhouse (28) and Mac yard line-up
// (41, 41975 W), laid out like the other captured screens.
function macScreens() {
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
  const bunk = [...head, ...crew(91, '001', 'S304', 'SB04', null), ...crew(163, '002', 'SD11', 'SR05', '0754'),
    ...crew(235, '003', 'SD10', 'SR12', '1429')];
  const mac = [
    '1 | 226:TRAIN LINE UP FIELD INQUIRY | 649:PSTS02H',
    '37 | 10:STATION | 82:( | 100:[41975] | 154:) | 181:DIR | 217:( | 235:[W] | 253:) | 280:POOL | 325:( | 343:[S1] | 370:) | 397:HOURS IN FUTURE | 541:( | 559:[24] | 586:) | 604:DEFAULT=16',
    '91 | 10:MMDD-HRMN | 100:Z | 118:STA | 154:TRAIN/ASGN | 253:ORSTN | 379:INFORMATION | 586:ENG CRW | 658:TRN CRW',
    '109 | 10:1015-1045 | 100:E | 118:PLN | 163:M30131 | 226:15 | 253:41975 | 307:TOPC | 352:300SAR | 433:A | 451:EnCo | 586:45SAS11 | 658:45SAS11',
    '127 | 10:1015-1430 | 100:E | 118:PLN | 163:Q13931 | 226:15 | 253:42368 | 307:TOPC | 352:100SAR | 433:A | 451:EnCo | 586:45SAS11 | 658:45SAS11',
    '145 | 10:1015-1645 | 100:E | 118:PLN | 163:Z14931 | 226:15 | 253:42368 | 307:TOPC | 352:149 | 433:A | 451:EnCo | 586:45SAS11 | 658:45SAS11',
    '163 | 10:1015-1830 | 100:E | 118:PLN | 163:M38331 | 226:15 | 253:41975 | 307:TOPC | 352:300SAR | 433:A | 451:EnCo | 586:45SAS11 | 658:45SAS11',
    '415 | 10:END | 46:OF | 73:FILE | 640:E011-1',
  ];
  return [{ screenGrid: bunk, label: 'bunkhouse' }, { screenGrid: mac, label: 'mac' }];
}

test('Mac yard: bunkhouse crews pair with the Toronto line-up in order', () => {
  const fx = JSON.parse(fixture('2026-10-15b.json')); // check taken 15th 0815
  const { shown } = snapshotOf({ ...fx, screens: [...fx.screens, ...macScreens()] });
  assert.ok(shown.screens.includes('bunkhouse') && shown.screens.includes('macLineup'));
  // Sarnia's line-up and pools are untouched by the Mac screens.
  assert.strictEqual(shown.lineup.length, 9);
  assert.ok(!shown.lineup.some((t) => t.train === 'M30131 15'));
  assert.deepStrictEqual(shown.bunkhouse.map((c) => [c.pos, c.en, c.co, c.offDuty, c.rested, c.ready]), [
    ['001', 'S304', 'SB04', '', '', true], // no REST: rested
    ['002', 'SD11', 'SR05', '14th 2354', '15th 0754', true], // off duty = rest − 8 h
    ['003', 'SD10', 'SR12', '15th 0629', '15th 1429', false],
  ]);
  assert.deepStrictEqual(shown.macLineup.map((t) => [t.train, t.crew]), [
    ['M30131 15', 'S304 + SB04'], ['Q13931 15', 'SD11 + SR05'], ['Z14931 15', 'SD10 + SR12'], ['M38331 15', ''],
  ]);
  const f = BoardTurns.facts(shown, 'SR05').map((x) => x.text);
  assert.ok(f.some((t) => /Toronto bunkhouse, position 002 \(with SD11\), off duty 14th 2354, rested/.test(t)));
  assert.ok(f.some((t) => /Predicted home on Q13931 15/.test(t)));
});

test('orders: time on duty from the bunkhouse rest; Toronto trains flagged red/yellow', () => {
  const T = BoardTrains;
  const base = { screens: ['lineup', 'macLineup', 'bunkhouse'], onDuty: [], bunkhouse: [], macLineup: [], lineup: [] };
  const snaps = [
    // Sarnia: E27861 on duty 0300 with SD11/SR05. Toronto: two trains, no rested crew.
    { ...base, taken: '2026-10-17 0100', lineup: [{ train: 'E27861 17', status: 'ORD', order: '17th 0315' }],
      macLineup: [{ train: 'Q13931 17', status: 'PLN', order: '17th 1430' }, { train: 'Z14931 17', status: 'PLN', order: '17th 1645' }],
      bunkhouse: [{ pos: '001', en: 'S304', co: 'SB04', rested: '17th 2000', offDuty: '17th 1200', ready: false }] },
    { ...base, taken: '2026-10-17 0310', onDuty: [{ train: 'E27861 17', onDuty: '17th 0300', station: 'SARNIA', crew: 'EN SD11 · CO SR05' }],
      macLineup: [{ train: 'Q13931 17', status: 'PLN', order: '17th 1430' }, { train: 'Z14931 17', status: 'PLN', order: '17th 1645' }],
      bunkhouse: [{ pos: '001', en: 'S304', co: 'SB04', rested: '17th 2000', offDuty: '17th 1200', ready: false }] },
    // SD11/SR05 tie up in Toronto: rest to 1754 → off duty 0954 (6 h 54 m on duty). Rested now, Q13931 gone.
    { ...base, taken: '2026-10-17 1400', onDuty: [{ train: 'E27861 17', onDuty: '17th 0300', station: 'SARNIA', crew: 'EN SD11 · CO SR05' }],
      macLineup: [{ train: 'Z14931 17', status: 'PLN', order: '17th 1645' }],
      bunkhouse: [{ pos: '001', en: 'SD11', co: 'SR05', rested: '17th 1754', offDuty: '17th 0954', ready: false }] },
    { ...base, taken: '2026-10-17 1800', macLineup: [],
      bunkhouse: [{ pos: '001', en: 'SD11', co: 'SR05', rested: '17th 1754', offDuty: '17th 0954', ready: true }] },
    { ...base, taken: '2026-10-17 1840', macLineup: [],
      bunkhouse: [{ pos: '001', en: 'SD11', co: 'SR05', rested: '17th 1754', offDuty: '17th 0954', ready: true }] },
  ];
  const rows = Object.fromEntries(T.summarize(T.track(snaps)).map((r) => [r.id, r]));
  const e = rows['E27861 17'];
  assert.strictEqual(e.offDuty, '2026-10-17 0954');
  assert.strictEqual(e.timeOnDuty, 6 * 60 + 54);
  // Q13931 left at 1400 when no crew was rested → Non-Sarnia Crew.
  assert.strictEqual(rows['Q13931 17'].from, 'mac');
  assert.strictEqual(rows['Q13931 17'].flag, 'nonSarnia');
  // Z14931 left at 1800 with SD11/SR05 rested in the bunkhouse → yellow.
  assert.strictEqual(rows['Z14931 17'].flag, 'possible');
  // Not flagged until 30 minutes have passed without a Call Board sighting.
  const early = Object.fromEntries(T.summarize(T.track(snaps.slice(0, 4))).map((r) => [r.id, r]));
  assert.strictEqual(early['Z14931 17'].flag, null);
});

test('orders: no Toronto off-duty time for L501/L502 or trains starting in Toronto', () => {
  const T = BoardTrains;
  const base = { screens: ['lineup', 'macLineup', 'bunkhouse'], lineup: [], macLineup: [], bunkhouse: [] };
  const snaps = [
    { ...base, taken: '2026-10-17 0100', lineup: [{ train: 'L50231 17', status: 'ORD', order: '17th 0400' }],
      macLineup: [{ train: 'M30131 17', status: 'ORD', order: '17th 1045' }], onDuty: [] },
    { ...base, taken: '2026-10-17 0400', onDuty: [{ train: 'L50231 17', onDuty: '17th 0345', station: 'SARNIA', crew: 'EN S501 · CO S502' }],
      macLineup: [{ train: 'M30131 17', status: 'ORD', order: '17th 1045' }] },
    // The L502 crew in the bunkhouse is never matched to it.
    { ...base, taken: '2026-10-17 1500', onDuty: [{ train: 'M30131 17', onDuty: '17th 1030', station: 'TORONTO', crew: 'EN S304 · CO SB04' }],
      bunkhouse: [{ pos: '001', en: 'S501', co: 'S502', rested: '17th 1900', offDuty: '17th 1100', ready: false }] },
  ];
  const rows = Object.fromEntries(T.summarize(T.track(snaps)).map((r) => [r.id, r]));
  assert.strictEqual(rows['L50231 17'].noOffDuty, true);
  assert.strictEqual(rows['L50231 17'].offDuty, null);
  assert.strictEqual(rows['M30131 17'].noOffDuty, true);
  assert.strictEqual(rows['L50231 17'].from, 'sarnia');
  // Odd third digit = starts in Toronto, even on Sarnia's line-up; even = Sarnia's.
  const st = T.track([{ ...base, taken: '2026-10-17 0100', onDuty: [],
    lineup: [{ train: 'M39931 17', status: 'PLN', order: '17th 0900' }, { train: 'M30241 17', status: 'PLN', order: '17th 0900' }] }]);
  const r2 = Object.fromEntries(T.summarize(st).map((r) => [r.id, r]));
  assert.strictEqual(r2['M39931 17'].noOffDuty, true);
  assert.strictEqual(r2['M30241 17'].noOffDuty, false);
});

test('14h: off duty in Toronto to the conductor\'s trip home; still held while in the bunkhouse', () => {
  const T = BoardTrains;
  const base = { screens: ['lineup', 'macLineup', 'bunkhouse'], onDuty: [], bunkhouse: [], macLineup: [], lineup: [] };
  const out = [
    { ...base, taken: '2026-10-17 0100', lineup: [{ train: 'E27861 17', status: 'ORD', order: '17th 0315' }] },
    { ...base, taken: '2026-10-17 0310', onDuty: [{ train: 'E27861 17', onDuty: '17th 0300', station: 'SARNIA', crew: 'EN SD11 · CO SR05' }] },
    // Off duty 0954 (rest to 1754).
    { ...base, taken: '2026-10-17 1400', bunkhouse: [{ pos: '001', en: 'SD11', co: 'SR05', rested: '17th 1754', ready: false }] },
  ];
  // Still in the bunkhouse at 18th 0100: held 15 h 06 m so far, no trip home.
  const held = [...out, { ...base, taken: '2026-10-18 0100', bunkhouse: [{ pos: '001', en: 'SD11', co: 'SR05', rested: '17th 1754', ready: true }] }];
  let e = T.summarize(T.track(held)).find((r) => r.id === 'E27861 17');
  assert.deepStrictEqual([e.co, e.en, e.back, e.heldMin, e.stillHeld], ['SR05', 'SD11', null, 15 * 60 + 6, true]);

  // Home on Z14931, not on any line-up, on duty 18th 0030 in Toronto: 14 h 36 m.
  // The ET trainee and another crew's later train don't count.
  const home = [...out,
    { ...base, taken: '2026-10-18 0040', onDuty: [{ train: 'Z14931 17', onDuty: '18th 0030', station: 'TORONTO', crew: 'EN SD11 · ET MU01 · CO SR05' }] },
    { ...base, taken: '2026-10-18 0300', onDuty: [{ train: 'Q13931 17', onDuty: '18th 0230', station: 'TORONTO', crew: 'EN SD12 · CO SR055' }] }];
  e = T.summarize(T.track(home)).find((r) => r.id === 'E27861 17');
  assert.deepStrictEqual(e.back, { id: 'Z14931 17', onDuty: '2026-10-18 0030', crew: 'EN SD11 · ET MU01 · CO SR05' });
  assert.strictEqual(e.heldMin, 14 * 60 + 36);
  assert.strictEqual(e.stillHeld, undefined);

  // Left the bunkhouse with no trip home seen (e.g. a taxi): not listed.
  const gone = [...out, { ...base, taken: '2026-10-18 0100', bunkhouse: [] }];
  e = T.summarize(T.track(gone)).find((r) => r.id === 'E27861 17');
  assert.strictEqual(e.heldMin, undefined);
});
