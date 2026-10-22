const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { turnStates, turnEvents } = require('../../lib/board/alerts');
const { encrypt, vapidHeader, sendPush, loadOrCreateKeys, pushEndpointOk } = require('../../lib/board/webpush');
const { at } = require('../../lib/board/time');

// Owner, 2026-10-22: alerts for a chosen turn when it's lined up, ordered,
// its call moves 30 min or more, or it goes on duty.
const pred = (o) => ({ symbol: 'M38261', originDay: '22', order: at(2026, 10, 22, 15, 0), call: at(2026, 10, 22, 12, 45), status: 'PLN', turn: 'SR03', engineer: 'SD05', ...o });
const board = (o) => ({ symbol: 'M38261', originDay: '22', station: 'SARNIA', onDuty: at(2026, 10, 22, 14, 45), crew: [{ craft: 'EN', turn: 'SD05' }, { craft: 'CO', turn: 'SR03' }], ...o });
const step = (prev, predictions, callBoard = [], opts) => turnEvents(prev, turnStates({ predictions }, callBoard), opts);

test('turn alerts: lined up, ordered, call moved 30 min, on duty; nothing on the first run', () => {
  let r = step(null, [pred()]);
  assert.deepEqual(r.events, []); // first run only learns the board
  r = step({}, [pred()]);
  assert.deepEqual(r.events.map((e) => [e.turn, e.text]), [
    ['SR03', 'SR03 lined up for M38261 22: call ~22nd 1245 (planned).'],
    ['SD05', 'SD05 lined up for M38261 22: call ~22nd 1245 (planned).'],
  ]);
  let told = r.told;
  // Same again, then a 20-minute drift twice: told once it adds up to 30+.
  r = step(told, [pred({ call: at(2026, 10, 22, 13, 5) })]);
  assert.deepEqual(r.events, []);
  told = r.told;
  r = step(told, [pred({ call: at(2026, 10, 22, 13, 25) })]);
  assert.deepEqual(r.events.map((e) => e.text), ['SR03: M38261 22 call ~22nd 1325, was ~22nd 1245.', 'SD05: M38261 22 call ~22nd 1325, was ~22nd 1245.']);
  told = r.told;
  r = step(told, [pred({ call: at(2026, 10, 22, 13, 25), status: 'ORD', spare: true })]);
  assert.deepEqual(r.events.map((e) => e.text), ['SR03 ordered for M38261 22: call ~22nd 1325. The turn goes spare (spareboard covers).', 'SD05 ordered for M38261 22: call ~22nd 1325.']);
  told = r.told;
  // A check that didn't read the line-up changes nothing.
  r = step(told, [], [], { lineupRead: false });
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.told, told);
  // On duty on the Call Board (line-up row now shows it on duty).
  r = step(told, [pred({ onDutyAt: at(2026, 10, 22, 14, 45), status: 'ORD' })], [board()]);
  assert.deepEqual(r.events.map((e) => e.text), ['SD05 on duty on M38261 22 at Sarnia 22nd 1445.', 'SR03 on duty on M38261 22 at Sarnia 22nd 1445.']);
  told = r.told;
  assert.deepEqual(step(told, [], [board()]).events, []); // said once
  // The trip home: a new on-duty train at Toronto.
  r = step(told, [], [board({ symbol: 'E27121', originDay: '23', station: 'TORONTO', onDuty: at(2026, 10, 23, 9, 0) })]);
  assert.deepEqual(r.events.map((e) => e.text), ['SD05 on duty on E27121 23 at Toronto 23rd 0900.', 'SR03 on duty on E27121 23 at Toronto 23rd 0900.']);
});

test('turn alerts: a turn moved to another train is lined up again', () => {
  const told = step({}, [pred()]).told;
  const r = step(told, [pred({ symbol: 'DHT031B', originDay: '22', deadhead: true, turn: 'SR03', engineer: null }), pred({ turn: 'SR07' })]);
  assert.deepEqual(r.events.map((e) => e.text), [
    'SR03 lined up for DHT031B 22 (deadhead): call ~22nd 1245 (planned).',
    'SR07 lined up for M38261 22: call ~22nd 1245 (planned).',
  ]);
});

// RFC 8291 appendix A: the worked example, byte for byte.
test('web push encryption matches the RFC 8291 example', () => {
  const body = encrypt('When I grow up, I want to be a watermelon',
    { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' },
    { as: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', salt: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url') });
  assert.equal(body.toString('base64url'), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});

test('VAPID: keys made once, header signed for the push service', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vapid-')), 'push-keys.json');
  const keys = loadOrCreateKeys(file);
  assert.deepEqual(loadOrCreateKeys(file), keys); // kept, not remade
  assert.equal(Buffer.from(keys.publicKey, 'base64url').length, 65);
  const h = vapidHeader('https://fcm.googleapis.com/fcm/send/abc', keys, { sub: 'https://board.example', now: 0 });
  const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(h);
  assert.equal(k, keys.publicKey);
  const [head, claims, sig] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(claims, 'base64url')), { aud: 'https://fcm.googleapis.com', exp: 12 * 3600, sub: 'https://board.example' });
  const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: keys.privateJwk.x, y: keys.privateJwk.y }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(`${head}.${claims}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')));

  // Sending: only to push services; 410 means the phone unsubscribed.
  const phone = crypto.createECDH('prime256v1');
  phone.generateKeys();
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: phone.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
  let seen;
  const ok = await sendPush(subscription, { title: 'SR03', body: 'hi' }, { keys, sub: 'https://board.example', fetchImpl: async (url, opts) => { seen = opts; return { ok: true, status: 201 }; } });
  assert.deepEqual(ok, { ok: true });
  assert.equal(seen.headers['content-encoding'], 'aes128gcm');
  assert.match(seen.headers.authorization, /^vapid t=/);
  assert.deepEqual(await sendPush(subscription, {}, { keys, sub: 'x', fetchImpl: async () => ({ ok: false, status: 410 }) }), { ok: false, gone: true, message: 'push service says 410' });
  const evil = await sendPush({ ...subscription, endpoint: 'https://example.com/x' }, {}, { keys, sub: 'x', fetchImpl: async () => { throw new Error('must not be called'); } });
  assert.equal(evil.gone, true);
  assert.ok(pushEndpointOk('https://web.push.apple.com/QW') && !pushEndpointOk('http://fcm.googleapis.com/x'));
});
