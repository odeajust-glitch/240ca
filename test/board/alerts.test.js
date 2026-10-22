const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { turnStates, turnEvents, phoneEvents } = require('../../lib/board/alerts');
const { encrypt, vapidHeader, sendPush, loadOrCreateKeys, pushEndpointOk } = require('../../lib/board/webpush');
const { at } = require('../../lib/board/time');

// Owner, 2026-10-22: alerts for a chosen turn when it's lined up, ordered,
// its call moves 30 min or more, or it goes on duty.
const pred = (o) => ({ symbol: 'M38261', originDay: '22', order: at(2026, 10, 22, 15, 0), call: at(2026, 10, 22, 12, 45), status: 'PLN', turn: 'SR03', engineer: 'SD05', ...o });
const board = (o) => ({ symbol: 'M38261', originDay: '22', station: 'SARNIA', onDuty: at(2026, 10, 22, 14, 45), crew: [{ craft: 'EN', turn: 'SD05' }, { craft: 'CO', turn: 'SR03' }], ...o });
const step = (prev, predictions, callBoard = [], opts) => turnEvents(prev, turnStates({ predictions }, callBoard), opts);

test('turn alerts: lined up, ordered, on duty are shared news; nothing on the first run', () => {
  let r = step(null, [pred()]);
  assert.deepEqual(r.events, []); // first run only learns the board
  r = step({}, [pred()]);
  assert.deepEqual(r.events.map((e) => [e.turn, e.kind, e.text]), [
    ['SR03', 'lineup', 'SR03 lined up for M38261 22: call ~22nd 1245 (planned).'],
    ['SD05', 'lineup', 'SD05 lined up for M38261 22: call ~22nd 1245 (planned).'],
  ]);
  let told = r.told;
  assert.deepEqual(step(told, [pred({ call: at(2026, 10, 22, 14, 0) })]).events, []); // time is per phone
  r = step(told, [pred({ status: 'ORD', spare: true })]);
  assert.deepEqual(r.events.map((e) => e.text), ['SR03 ordered for M38261 22: call ~22nd 1245. The turn goes spare (spareboard covers).', 'SD05 ordered for M38261 22: call ~22nd 1245.']);
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

// Owner, 2026-10-22: each phone picks per turn what it wants, e.g. only when
// it's ordered, or only when the time moves by a chosen amount.
test('turn alerts: each phone gets only what it chose, with its own time threshold', () => {
  const states = (o) => turnStates({ predictions: [pred(o)] }, []);
  const orderOnly = { turns: ['SR03'], prefs: { SR03: { lineup: false, ordered: true, onDuty: false, time: 0 } } };
  const hourMoves = { turns: ['SR03'], prefs: { SR03: { lineup: false, ordered: false, onDuty: false, time: 60 } } };
  const everything = { turns: ['SR03'] }; // defaults: all on, 30 min
  const run = (shared, phone, st, base) => phoneEvents(shared, phone, st, base, {});

  // Lined up at 1245: only "everything" hears; every phone notes the call.
  let shared = step({}, [pred()]).events;
  const b = {};
  for (const [name, ph] of Object.entries({ orderOnly, hourMoves, everything })) {
    const r = run(shared, ph, states(), undefined);
    b[name] = r.base;
    assert.deepEqual(r.events.map((e) => e.kind), name === 'everything' ? ['lineup'] : [], name);
  }
  // Call moves 40 min: "everything" (30) hears; the hour phone waits.
  let r1 = run([], hourMoves, states({ call: at(2026, 10, 22, 13, 25) }), b.hourMoves);
  assert.deepEqual(r1.events, []);
  const r2 = run([], everything, states({ call: at(2026, 10, 22, 13, 25) }), b.everything);
  assert.deepEqual(r2.events.map((e) => e.text), ['SR03: M38261 22 call ~22nd 1325, was ~22nd 1245.']);
  // Another 25 min: 65 min from what the hour phone was told → it hears now.
  r1 = run([], hourMoves, states({ call: at(2026, 10, 22, 13, 50) }), r1.base);
  assert.deepEqual(r1.events.map((e) => e.text), ['SR03: M38261 22 call ~22nd 1350, was ~22nd 1245.']);
  // Ordered: the orders-only phone hears; the hour phone doesn't.
  shared = step(step({}, [pred()]).told, [pred({ status: 'ORD' })]).events;
  assert.deepEqual(run(shared, orderOnly, states({ status: 'ORD' }), b.orderOnly).events.map((e) => e.kind), ['ordered']);
  assert.deepEqual(run(shared, hourMoves, states({ status: 'ORD', call: at(2026, 10, 22, 13, 50) }), r1.base).events, []);
  // Lined up already ordered: one alert each, never two.
  shared = step({}, [pred({ status: 'ORD' })]).events;
  assert.deepEqual(run(shared, orderOnly, states({ status: 'ORD' }), undefined).events.map((e) => e.kind), ['ordered']);
  assert.deepEqual(run(shared, everything, states({ status: 'ORD' }), undefined).events.map((e) => e.kind), ['lineup']);
});

test('turn alerts: a turn moved to another train is lined up again', () => {
  const told = step({}, [pred()]).told;
  const r = step(told, [pred({ symbol: 'DHT031B', originDay: '22', deadhead: true, turn: 'SR03', engineer: null }), pred({ turn: 'SR07' })]);
  assert.deepEqual(r.events.map((e) => e.text), [
    'SR03 lined up for DHT031B 22 (deadhead): call ~22nd 1245 (planned).',
    'SR07 lined up for M38261 22: call ~22nd 1245 (planned).',
  ]);
});

// Owner, 2026-10-22: tell me when someone ahead of me on the Chain Gang
// goes on rest (they're skipped for calls before it ends, so I move up).
test('turn alerts: a Chain Gang turn ahead going on rest or hold', () => {
  const now = at(2026, 10, 22, 10, 0);
  const row = (turn, pos, o = {}) => ({ craft: 'CO', turn, pos, restUntil: null, statusUntil: null, rn: '', ...o });
  const states = (gang) => turnStates({ now, predictions: [] }, [], { chainGang: gang });
  const before = [row('SR04', 1), row('SR12', 2), row('SR03', 3), row('SR07', 4)];
  let r = turnEvents({}, states(before), { lineupRead: false });
  assert.deepEqual(r.events, []); // first look: just learns who's ahead
  r = turnEvents(r.told, states([row('SR04', 1), row('SR12', 2, { restUntil: at(2026, 10, 22, 18, 0) }), row('SR03', 3), row('SR07', 4)]), { lineupRead: false });
  assert.deepEqual(r.events.map((e) => [e.turn, e.kind, e.text]), [
    ['SR03', 'aheadRest', 'SR03: SR12 ahead of you (pos 002) went on rest until 22nd 1800; it\'s skipped for calls before then, so you move up.'],
    ['SR07', 'aheadRest', 'SR07: SR12 ahead of you (pos 002) went on rest until 22nd 1800; it\'s skipped for calls before then, so you move up.'],
  ]);
  // Still resting next check: not said again. A hold turn is news too.
  r = turnEvents(r.told, states([row('SR04', 1, { rn: 'HT', statusUntil: at(2026, 10, 23, 2, 45) }), row('SR12', 2, { restUntil: at(2026, 10, 22, 18, 0) }), row('SR03', 3)]), { lineupRead: false });
  assert.deepEqual(r.events.map((e) => e.text), [
    'SR12: SR04 ahead of you (pos 001) went on hold turn until 23rd 0245; it\'s skipped for calls before then, so you move up.',
    'SR03: SR04 ahead of you (pos 001) went on hold turn until 23rd 0245; it\'s skipped for calls before then, so you move up.',
  ]);
  // A phone that switched it off doesn't get it.
  const shared = r.events;
  // Coming off: SR12's rest is over by 1900; SR04 still held.
  const later = turnStates({ now: at(2026, 10, 22, 19, 0), predictions: [] }, [], { chainGang: [row('SR04', 1, { rn: 'HT', statusUntil: at(2026, 10, 23, 2, 45) }), row('SR12', 2, { restUntil: at(2026, 10, 22, 18, 0) }), row('SR03', 3)] });
  const back = turnEvents(r.told, later, { lineupRead: false });
  assert.deepEqual(back.events.map((e) => [e.turn, e.kind, e.text]), [['SR03', 'aheadBack', 'SR03: SR12 ahead of you (pos 002) is off rest/hold and back in line ahead of you.']]);
  assert.deepEqual(turnEvents(back.told, later, { lineupRead: false }).events, []); // said once
  assert.deepEqual(phoneEvents(back.events, { turns: ['SR03'], prefs: { SR03: { aheadBack: false } } }, {}, {}, { lineupRead: false }).events, []);
  assert.deepEqual(phoneEvents(shared, { turns: ['SR03'], prefs: { SR03: { aheadRest: false } } }, {}, {}, { lineupRead: false }).events, []);
  assert.equal(phoneEvents(shared, { turns: ['SR03'] }, {}, {}, { lineupRead: false }).events.length, 1);
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
