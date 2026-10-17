const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { BoardRelay, boardRoutes, pushCheck, mineForPhone, validateCheck, hideBoardSite } = require('../../lib/board/relay');
const { at } = require('../../lib/board/time');

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

test('relay: "when you go" as fields for the phone', () => {
  const linedUp = mineForPhone({
    turn: 'SR03', train: 'M30241 17', status: 'PLN', deadhead: false,
    order: at(2026, 10, 17, 15, 45), onDuty: at(2026, 10, 17, 15, 30), call: at(2026, 10, 17, 13, 30),
  });
  assert.deepStrictEqual(linedUp, {
    turn: 'SR03', state: 'linedUp', train: 'M30241 17', status: 'PLN', deadhead: false,
    callAt: '2026-10-17T13:30', onDutyAt: '2026-10-17T15:30',
  });
  assert.deepStrictEqual(
    mineForPhone({ turn: 'SR03', lineupEnd: 0, ahead: [{ turn: 'SR07' }, { turn: 'SR01', until: 5 }], myRestUntil: at(2026, 10, 17, 10, 15) }),
    { turn: 'SR03', state: 'waiting', ahead: ['SR07', 'SR01'], myRestUntil: '2026-10-17T10:15' },
  );
  assert.deepStrictEqual(mineForPhone({ turn: 'SR03', comingHome: 'M38261 16', onDutyAway: 0 }), { turn: 'SR03', state: 'comingHome', train: 'M38261 16' });
  assert.deepStrictEqual(mineForPhone({ turn: 'SR03', notFound: true }), { turn: 'SR03', state: 'notFound' });
  assert.strictEqual(mineForPhone(null), null);

  // Survives the server's checks unchanged; old laptops without it still pass.
  const base = check('2026-10-17T12:00:00Z');
  assert.deepStrictEqual(validateCheck({ ...base, mine: linedUp }).check.mine, linedUp);
  assert.strictEqual(validateCheck(base).check.mine, null);
  assert.ok(validateCheck({ ...base, mine: { ...linedUp, onDutyAt: 'soon' } }).error);
  assert.ok(validateCheck({ ...base, mine: { turn: 'SR03', state: 'asleep' } }).error);
  assert.strictEqual(validateCheck({ ...base, mine: { ...linedUp, extra: 'x' } }).check.mine.extra, undefined);
});

test('relay: the line-up website stays off the agreement-search site', async () => {
  const app = express();
  app.use(hideBoardSite);
  app.use(express.static(path.join(__dirname, '../../public')));
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const p of ['/board.html', '/board-turns.js', '/board-trains.js', '/board-sample.json', '/Board.html', '/board%2Ehtml', '/x/../board.html', '/%2e%2e/public/board.html']) {
      assert.strictEqual((await fetch(url + p)).status, 404, p);
    }
    assert.strictEqual((await fetch(`${url}/index.html`)).status, 200);
    assert.strictEqual((await fetch(`${url}/`)).status, 200);
  } finally { server.close(); }
});
