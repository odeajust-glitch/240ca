const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { BoardRelay, boardRoutes, pushCheck } = require('../../lib/board/relay');

const KEY = 'test-key-123';
const check = (at, me = ['You go on M38261 15, call ~1345']) => ({
  checkedAt: at, me, report: 'WHEN YOU GO\n' + me.join('\n'), changes: [], myAnswerChanged: false,
});

async function withServer(fn, key = KEY) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-'));
  const app = express();
  app.use(express.json());
  boardRoutes(app, new BoardRelay(dir), () => key);
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}`;
  try { await fn(url, dir); } finally { server.close(); }
}

const latest = (url, key = KEY) => fetch(`${url}/api/board/latest`, { headers: { Authorization: `Bearer ${key}` } });

test('relay: laptop push, phone pull, saved to disk', async () => {
  await withServer(async (url, dir) => {
    assert.strictEqual((await latest(url)).status, 204, 'nothing yet');
    const sent = await pushCheck({ url, key: KEY, check: check('2026-10-15T20:00:00Z') });
    assert.deepStrictEqual(sent, { ok: true });
    const got = await (await latest(url)).json();
    assert.deepStrictEqual(got.me, ['You go on M38261 15, call ~1345']);
    assert.ok(got.receivedAt);
    // A restart reads it back.
    assert.deepStrictEqual(new BoardRelay(dir).latest.me, got.me);
  });
});

test('relay: wrong or missing key looks like no endpoint', async () => {
  await withServer(async (url) => {
    assert.strictEqual((await latest(url, 'nope')).status, 404);
    assert.strictEqual((await fetch(`${url}/api/board/latest`)).status, 404);
    const sent = await pushCheck({ url, key: 'nope', check: check('2026-10-15T20:00:00Z') });
    assert.strictEqual(sent.ok, false);
  });
  await withServer(async (url) => {
    assert.strictEqual((await latest(url, '')).status, 404, 'BOARD_KEY unset');
  }, undefined);
});

test('relay: an older check arriving late keeps the newer one', async () => {
  await withServer(async (url) => {
    await pushCheck({ url, key: KEY, check: check('2026-10-15T20:20:00Z', ['newer']) });
    await pushCheck({ url, key: KEY, check: check('2026-10-15T20:00:00Z', ['older']) });
    assert.deepStrictEqual((await (await latest(url)).json()).me, ['newer']);
  });
});

test('relay: bad bodies are refused', async () => {
  await withServer(async (url) => {
    const post = (body) => fetch(`${url}/api/board`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body),
    });
    assert.strictEqual((await post({ me: [] })).status, 400);
    assert.strictEqual((await post({ ...check('not a time') })).status, 400);
    assert.strictEqual((await post({ ...check('2026-10-15T20:00:00Z'), me: 'text' })).status, 400);
  });
});

test('relay: push never throws when the server is down', async () => {
  const sent = await pushCheck({ url: 'http://127.0.0.1:9', key: KEY, check: check('2026-10-15T20:00:00Z') });
  assert.strictEqual(sent.ok, false);
});
