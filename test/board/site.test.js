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
  assert.deepStrictEqual(Object.keys(posted).sort(), ['/board-trains.js', '/board-turns.js', '/data/2026-10-14.json', '/data/2026-10-15.json', '/data/index.json', '/data/trains.json', '/data/turns.json', '/index.html', '/robots.txt']);
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
  const sr03 = turns.SR03;
  assert.strictEqual(sr03[0].taken, '2026-10-14 1617');
  assert.ok(sr03.length >= 2);
  // Consecutive entries always differ.
  for (let i = 1; i < sr03.length; i++) assert.notStrictEqual(sr03[i].text, sr03[i - 1].text);
  assert.ok(!('__last' in turns));
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
