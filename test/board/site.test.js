const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildSite, deploySite } = require('../../lib/board/site');
const BoardTurns = require('../../public/board-turns');

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
  assert.deepStrictEqual(Object.keys(posted).sort(), ['/board-turns.js', '/data/2026-10-14.json', '/data/2026-10-15.json', '/data/index.json', '/data/turns.json', '/index.html', '/robots.txt']);
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
