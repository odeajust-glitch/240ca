const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const { plan, expired, runBackup } = require('../../lib/board/backup');
const { deployR2 } = require('../../lib/board/r2');

// A stand-in for the R2 bucket's S3 API: list, put, delete.
function fakeR2(store = new Map()) {
  return async (url, init = {}) => {
    const u = new URL(url);
    const key = decodeURIComponent(u.pathname.split('/').slice(2).join('/'));
    const method = init.method || 'GET';
    if (method === 'GET' && u.searchParams.get('list-type')) {
      const prefix = u.searchParams.get('prefix') || '';
      const items = [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => `<Contents><Key>${k}</Key><ETag>"x"</ETag></Contents>`).join('');
      return { ok: true, status: 200, text: async () => `<ListBucketResult>${items}<IsTruncated>false</IsTruncated></ListBucketResult>` };
    }
    if (method === 'PUT') { store.set(key, Buffer.from(init.body)); return { ok: true, status: 200 }; }
    if (method === 'DELETE') { store.delete(key); return { ok: true, status: 204 }; }
    return { ok: false, status: 400 };
  };
}
const r2 = { accountId: 'acct', bucket: 'board-site', keyId: 'k', secret: 's' };

// Owner, 2026-11-02: if the laptop dies, its memory goes with it.
test('backup: what is due, and what gets old', () => {
  const days = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', 'notes'];
  assert.deepEqual(plan({ days, today: '2026-11-02', hour: 2 }).state, false); // before 03:00
  assert.deepEqual(plan({ days, today: '2026-11-02', hour: 3, have: new Set(['backups/history/2026-10-30.zip']) }),
    { state: true, history: ['2026-10-31', '2026-11-01'] }); // today's isn't finished
  assert.equal(plan({ lastStateDay: '2026-11-02', days, today: '2026-11-02', hour: 9 }).state, false); // once a day
  const keys = ['backups/state/2026-10-18.zip', 'backups/state/2026-10-19.zip', 'backups/history/2026-08-03.zip', 'backups/history/2026-08-04.zip', 'index.html'];
  assert.deepEqual(expired(keys, '2026-11-02', 90), ['backups/state/2026-10-18.zip', 'backups/history/2026-08-03.zip']);
  assert.deepEqual(expired(keys, '2026-11-02', 0), ['backups/state/2026-10-18.zip']); // history kept forever
});

test('backup: zips the data folder and finished history days, never .env or names', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
  const hist = path.join(dir, 'history');
  for (const [f, v] of Object.entries({ '.env': 'CATS_PASSWORD=x', 'names.json': '{"M1 01|SR03":{"name":"X"}}', 'turn-alerts.json': '{"SR03":{}}', 'fill-ins.json': '{}', 'heartbeat.json': '{}' })) fs.writeFileSync(path.join(dir, f), v);
  fs.mkdirSync(path.join(dir, 'profile-edge'));
  fs.writeFileSync(path.join(dir, 'profile-edge', 'Cookies'), 'secret');
  for (const d of ['2026-11-01', '2026-11-02']) { fs.mkdirSync(path.join(hist, d), { recursive: true }); fs.writeFileSync(path.join(hist, d, '0800.json'), `{"day":"${d}"}`); }
  const store = new Map([['index.html', Buffer.from('x')], ['backups/state/2026-10-01.zip', Buffer.from('old')]]);
  const now = new Date(2026, 10, 2, 3, 5);
  const r = await runBackup({ dataDir: dir, historyDir: hist, r2, now, fetchImpl: fakeR2(store) });
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(r.did, ['state 2026-11-02', 'history 2026-11-01']);
  assert.deepEqual(r.state, { lastStateDay: '2026-11-02', lastAt: now.getTime() });
  assert.ok(!store.has('backups/state/2026-10-01.zip')); // past 14 days
  const state = await JSZip.loadAsync(store.get('backups/state/2026-11-02.zip'));
  assert.deepEqual(Object.keys(state.files).sort(), ['fill-ins.json', 'turn-alerts.json']);
  assert.equal(await state.file('turn-alerts.json').async('string'), '{"SR03":{}}');
  const day = await JSZip.loadAsync(store.get('backups/history/2026-11-01.zip'));
  assert.equal(await day.file('0800.json').async('string'), '{"day":"2026-11-01"}');
  // Later the same day: nothing more.
  const again = await runBackup({ dataDir: dir, historyDir: hist, r2, state: r.state, now: new Date(2026, 10, 2, 9, 0), fetchImpl: fakeR2(store) });
  assert.deepEqual(again.did, []);
  // R2 refusing: not ok, state unchanged (tried again next check).
  const refused = await runBackup({ dataDir: dir, historyDir: hist, r2, now: new Date(2026, 10, 3, 4, 0), fetchImpl: async () => ({ ok: false, status: 403, text: async () => '' }) });
  assert.equal(refused.ok, false);
  assert.deepEqual(refused.state, {});
});

// 2026-11-02: every site update deleted the Worker's visitor counts.
test('the site upload never deletes visitor counts, backups or subscriptions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<p>new</p>');
  const keep = ['stats/2026-11-02.json', 'backups/state/2026-11-02.zip', 'subs/abc.json', 'status/down.json'];
  const store = new Map([...keep, 'old.html'].map((k) => [k, Buffer.from('x')]));
  const r = await deployR2({ dir, r2, fetchImpl: fakeR2(store) });
  assert.equal(r.ok, true, r.message);
  assert.deepEqual([...store.keys()].sort(), [...keep, 'index.html'].sort());
});
