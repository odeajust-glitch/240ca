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
    ['SR03', 'lineup', 'SR03 lined up: M38261 22 planned for 22nd 1500, expected call 22nd 1245.'],
    ['SD05', 'lineup', 'SD05 lined up: M38261 22 planned for 22nd 1500, expected call 22nd 1245.'],
  ]);
  let told = r.told;
  assert.deepEqual(step(told, [pred({ call: at(2026, 10, 22, 14, 0) })]).events, []); // time is per phone
  r = step(told, [pred({ status: 'ORD', spare: true })]);
  assert.deepEqual(r.events.map((e) => e.text), ['SR03 ordered: M38261 22 ordered for 22nd 1500, expected call 22nd 1245. The turn goes spare (spareboard covers).', 'SD05 ordered: M38261 22 ordered for 22nd 1500, expected call 22nd 1245.']);
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
  // A later call goes with a later order (call = order − 2 h 15).
  const states = (o = {}) => turnStates({ predictions: [pred(o.call ? { order: o.call + 135, ...o } : o)] }, []);
  const orderOnly = { turns: ['SR03'], prefs: { SR03: { lineup: false, ordered: true, onDuty: false, time: 0 } } };
  const hourMoves = { turns: ['SR03'], prefs: { SR03: { lineup: false, ordered: false, onDuty: false, time: 60 } } };
  const everything = { turns: ['SR03'] }; // defaults: all on, 30 min
  // ("Where you stand" for a new phone has its own test below.)
  const run = (shared, phone, st, base) => { const r = phoneEvents(shared, phone, st, base, {}); return { ...r, events: r.events.filter((e) => e.kind !== 'stand') }; };

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
  assert.deepEqual(r2.events.map((e) => e.text), ['SR03 time change: M38261 22 planned for 22nd 1540, expected call 22nd 1325 (was 22nd 1500, call 22nd 1245).']);
  // Another 25 min: 65 min from what the hour phone was told → it hears now.
  r1 = run([], hourMoves, states({ call: at(2026, 10, 22, 13, 50) }), r1.base);
  assert.deepEqual(r1.events.map((e) => e.text), ['SR03 time change: M38261 22 planned for 22nd 1605, expected call 22nd 1350 (was 22nd 1500, call 22nd 1245).']);
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
    'SR03 lined up: DHT031B 22 (deadhead) planned for 22nd 1500, expected call 22nd 1245.',
    'SR07 lined up: M38261 22 planned for 22nd 1500, expected call 22nd 1245.',
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

// Owner, 2026-10-22: the crew office's mandatory reset always shows until
// 0559; tell that turn when it's put on one.
test('turn alerts: a turn put on a mandatory reset (until 0559)', () => {
  const now = at(2026, 10, 22, 10, 0);
  const row = (turn, o = {}) => ({ craft: 'CO', turn, pos: 1, restUntil: null, statusUntil: null, rn: '', ...o });
  const states = (pools) => turnStates({ now, predictions: [] }, [], pools);
  let r = turnEvents({}, states({ chainGang: [row('SR03')], a: [row('SA05')] }), { lineupRead: false });
  assert.deepEqual(r.events, []);
  r = turnEvents(r.told, states({
    chainGang: [row('SR03', { restUntil: at(2026, 10, 23, 5, 59) })],
    a: [row('SA05', { rn: 'HT', statusUntil: at(2026, 10, 23, 5, 59) })],
    s1: [row('S107', { craft: 'EN', restUntil: at(2026, 10, 22, 18, 0) })], // ordinary rest: not a reset
  }), { lineupRead: false });
  assert.deepEqual(r.events.map((e) => [e.turn, e.kind, e.text]), [
    ['SR03', 'reset', "SR03: you've been put on a mandatory reset until 23rd 0559."],
    ['SA05', 'reset', "SA05: you've been put on a mandatory reset until 23rd 0559."],
  ]);
  // Same reset next check: said once. Switched off: not sent.
  const again = turnEvents(r.told, states({ chainGang: [row('SR03', { restUntil: at(2026, 10, 23, 5, 59) })] }), { lineupRead: false });
  assert.deepEqual(again.events, []);
  assert.deepEqual(phoneEvents(r.events, { turns: ['SR03'], prefs: { SR03: { reset: false } } }, {}, {}, { lineupRead: false }).events, []);
});

// Owner, 2026-10-22: tell me when my board position changes, and why
// ("SR07 (train)").
test('turn alerts: board position changes, with who left or came in ahead', () => {
  const now = at(2026, 10, 22, 10, 0);
  const row = (turn, pos, o = {}) => ({ craft: 'CO', turn, pos, restUntil: null, statusUntil: null, rn: '', ...o });
  const states = (gang, callBoard = []) => turnStates({ now, predictions: [] }, callBoard, { chainGang: gang });
  let r = turnEvents({}, states([row('SR07', 1), row('SR04', 2), row('SR03', 3)]), { lineupRead: false });
  assert.deepEqual(r.events, []); // first look: just learns positions
  // SR07 out working on M38261, SR04 on duty on the Call Board: SR03 moves up two.
  const onBoard = { symbol: 'M39671', originDay: '21', station: 'SARNIA', onDuty: now, crew: [{ craft: 'CO', turn: 'SR04' }] };
  r = turnEvents(r.told, states([row('SR07', 999, { working: true, workingOn: 'M38261' }), row('SR04', 999, { working: true }), row('SR03', 1)], [onBoard]), { lineupRead: false });
  const pos = r.events.filter((e) => e.kind === 'position').map((e) => e.text);
  assert.deepEqual(pos, ['SR03: now position 001 (was 003). Moved up: SR07 (M38261) and SR04 (M39671 21) went out.']);
  // A returning turn placed ahead: moved down. Same position next check: nothing.
  r = turnEvents(r.told, states([row('SR12', 1), row('SR03', 2)]), { lineupRead: false });
  assert.deepEqual(r.events.filter((e) => e.kind === 'position').map((e) => e.text), ['SR03: now position 002 (was 001). Moved down: SR12 placed ahead of you.']);
  assert.deepEqual(turnEvents(r.told, states([row('SR12', 1), row('SR03', 2)]), { lineupRead: false }).events, []);
  // Switched off: not sent.
  const ev = [{ turn: 'SR03', kind: 'position', text: 'x' }];
  assert.deepEqual(phoneEvents(ev, { turns: ['SR03'], prefs: { SR03: { position: false } } }, {}, {}, { lineupRead: false }).events, []);
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

// Owner, 2026-10-23: "someone ahead" news only while the turn is on the
// Chain Gang board at home in Sarnia. Away or on duty it hears nothing, and
// coming back home it starts fresh rather than comparing with before it left.
test('turn alerts: someone ahead only while on the Sarnia Chain Gang board', () => {
  const now = at(2026, 10, 22, 10, 0);
  const row = (turn, pos, o = {}) => ({ craft: 'CO', turn, pos, restUntil: null, statusUntil: null, rn: '', ...o });
  const held = row('SR12', 2, { rn: 'HT', statusUntil: at(2026, 10, 23, 5, 59) });
  const home = (gang, callBoard = []) => turnStates({ now, predictions: [] }, callBoard, { chainGang: gang });
  let r = turnEvents({}, home([row('SR12', 2), row('SR03', 3)]), { lineupRead: false });
  // SR03 goes away (lined up on a train home from Toronto): off the Sarnia board.
  const away = turnStates({ now, predictions: [pred({ turn: 'SR03', engineer: null })] }, [], { chainGang: [held] });
  r = turnEvents(r.told, away, { lineupRead: false });
  assert.deepEqual(r.events.filter((e) => e.turn === 'SR03' && e.kind !== 'lineup'), []);
  // Back home with SR12 still held: no "went on hold" news, it's not new.
  r = turnEvents(r.told, home([held, row('SR03', 3)]), { lineupRead: false });
  assert.deepEqual(r.events.filter((e) => e.turn === 'SR03'), []);
  // On duty per the Call Board while the pool screen still lists the turn: quiet.
  const onDuty = [board({ crew: [{ craft: 'CO', turn: 'SR03' }] })];
  r = turnEvents(turnEvents({}, home([row('SR12', 2), row('SR03', 3)], onDuty), { lineupRead: false }).told, home([held, row('SR03', 3)], onDuty), { lineupRead: false });
  assert.deepEqual(r.events.filter((e) => e.kind === 'aheadRest'), []);
});

// Owner, 2026-10-23: the same for SD engineer turns on the Sarnia SD board.
test('turn alerts: SD board, someone ahead only while home in Sarnia', () => {
  const now = at(2026, 10, 22, 10, 0);
  const row = (turn, pos, o = {}) => ({ craft: 'EN', turn, pos, restUntil: null, statusUntil: null, rn: '', ...o });
  const held = row('SD12', 2, { rn: 'HT', statusUntil: at(2026, 10, 23, 5, 59) });
  const home = (sd, callBoard = []) => turnStates({ now, predictions: [] }, callBoard, { sd });
  const sd05 = (r) => r.events.filter((e) => e.turn === 'SD05' && e.kind !== 'lineup');
  let r = turnEvents({}, home([row('SD12', 2), row('SD05', 3)]), { lineupRead: false });
  // SD05 away, lined up on a train home from Toronto.
  r = turnEvents(r.told, turnStates({ now, predictions: [pred({ turn: null, engineer: 'SD05' })] }, [], { sd: [held] }), { lineupRead: false });
  assert.deepEqual(sd05(r), []);
  r = turnEvents(r.told, home([held, row('SD05', 3)]), { lineupRead: false });
  assert.deepEqual(sd05(r), []); // back home: SD12's hold isn't news
  // On duty per the Call Board while the SD screen still lists it: quiet.
  const onDuty = [board({ crew: [{ craft: 'EN', turn: 'SD05' }] })];
  r = turnEvents(turnEvents({}, home([row('SD12', 2), row('SD05', 3)], onDuty), { lineupRead: false }).told, home([held, row('SD05', 3)], onDuty), { lineupRead: false });
  assert.deepEqual(sd05(r).filter((e) => e.kind === 'aheadRest'), []);
  // Home and on the board: SD12 going on hold is news for SD05.
  r = turnEvents(turnEvents({}, home([row('SD12', 2), row('SD05', 3)]), { lineupRead: false }).told, home([held, row('SD05', 3)]), { lineupRead: false });
  assert.deepEqual(sd05(r).map((e) => e.kind), ['aheadRest']);
});

// Owner, 2026-10-23: a rescue train (R + the stalled train's symbol) on the
// Sarnia line-up (47130) is news for turns home on a Sarnia board; on the
// Toronto line-up (41975), for crews waiting in the bunkhouse.
test('turn alerts: rescue trains, Sarnia board vs bunkhouse', () => {
  const now = at(2026, 10, 23, 10, 0);
  const row = (turn, pos, o = {}) => ({ craft: 'CO', turn, pos, restUntil: null, statusUntil: null, rn: '', ...o });
  const train = (symbol, o = {}) => ({ symbol, originDay: '23', status: 'PLN', order: at(2026, 10, 23, 14, 0), deadhead: false, ...o });
  const gang = [row('SR03', 1), row('SR07', 2, { working: true, workingOn: 'M38261' })];
  const bunk = [{ pos: 1, co: 'SR12', en: 'SD04' }];
  const states = (lineup, macLineup) => turnStates({ now, predictions: [] }, [], { chainGang: gang, sd: [], lineup, macLineup, bunkhouse: bunk });
  let r = turnEvents({}, states([train('M38261')], [train('M30131')]), { lineupRead: true });
  // RM383 shows in Sarnia, RQ148 in Toronto.
  r = turnEvents(r.told, states([train('M38261'), train('RM38321')], [train('M30131'), train('RQ14891', { status: 'ORD' })]), { lineupRead: true });
  assert.deepEqual(r.events.filter((e) => e.kind === 'rescue').map((e) => [e.turn, e.kind, e.text]), [
    ['SR03', 'rescue', 'SR03: rescue train RM38321 23 on the Sarnia line-up, planned for 23rd 1400, expected call 23rd 1145.'],
    ['SR12', 'rescue', 'SR12: rescue train RQ14891 23 on the Toronto line-up, ordered for 23rd 1400, expected call 23rd 1200.'],
    ['SD04', 'rescue', 'SD04: rescue train RQ14891 23 on the Toronto line-up, ordered for 23rd 1400, expected call 23rd 1200.'],
  ]); // SR07 is out working: not told
  // Still there next check: said once. A line-up not read: nothing, nothing forgotten.
  r = turnEvents(r.told, states([train('M38261'), train('RM38321')], [train('RQ14891')]), { lineupRead: true });
  assert.deepEqual(r.events.filter((e) => e.kind === 'rescue'), []);
  r = turnEvents(r.told, states(null, null), { lineupRead: false });
  assert.deepEqual(r.events.filter((e) => e.kind === 'rescue'), []);
  r = turnEvents(r.told, states([train('RM38321')], [train('RQ14891')]), { lineupRead: true });
  assert.deepEqual(r.events.filter((e) => e.kind === 'rescue'), []);
  // A phone can switch it off.
  assert.deepEqual(phoneEvents([{ turn: 'SR03', kind: 'rescue', text: 'x' }], { turns: ['SR03'], prefs: { SR03: { rescue: false } } }, {}, {}, { lineupRead: false }).events, []);
});

// Owner, 2026-10-24: B138 filling in on SR03's job: the on-duty alert goes
// to B138 (the person working), not SR03.
test('turn alerts: on duty goes to the spare person filling in', () => {
  const cb = [board({ crew: [{ craft: 'EN', turn: 'SD05' }, { craft: 'CO', turn: 'SR03' }] })];
  const states = (backfill) => turnStates({ predictions: [] }, cb, { backfill });
  const fill = [{ train: 'M38261 22', craft: 'CO', job: 'SR03', turn: 'B138' }];
  const r = turnEvents({}, states(fill));
  assert.deepEqual(r.events.map((e) => [e.turn, e.text]), [
    ['SD05', 'SD05 on duty on M38261 22 at Sarnia 22nd 1445.'],
    ['B138', 'B138 on duty on M38261 22 at Sarnia 22nd 1445, working SR03.'],
  ]);
  assert.equal(states(fill).SR03, undefined);
  assert.ok(turnEvents({}, states([])).events.some((e) => e.turn === 'SR03')); // no match: as before
});

// Owner, 2026-10-25: spareboard turns get the same alerts as the Chain Gang.
test('turn alerts: spareboard turns', () => {
  const now = at(2026, 10, 24, 3, 0);
  const sb = (turn, pos, o = {}) => ({ turn, pos, terminal: 0, working: false, workingOn: null, st: null, rn: null, statusUntil: null, restUntil: null, ...o });
  const job = (train, cc, yard, h, m, status = 'PLANNED') => ({ train, cc, yard, at: at(2026, 10, 24, h, m), status, pool: yard ? 'YD' : 'SD', turn: train });
  const states = (coFast, vacancies, yardJobs = []) => turnStates({ now, predictions: [] }, [], { spareboards: { coFast, coSlow: null, enFast: null, enSlow: null }, vacancies, yardJobs });
  const board1 = [sb('B138', 1), sb('B147', 2), sb('B119', 3)];
  let r = turnEvents({}, states(board1, [job('YPRS02', 'FO', true, 6, 45)]), { lineupRead: true });
  assert.deepEqual(r.events.map((e) => e.text), ['B138 lined up: YPRS02 planned for 24th 0645, expected call 24th 0445.']);
  // B138 goes out on the yard job; B147 moves up, B119 hears B147 went on rest.
  const yard = [{ job: 'YPRS02', station: 'SARNIA', onDuty: at(2026, 10, 24, 6, 45), crew: [{ craft: 'FO', turn: 'B138' }] }];
  r = turnEvents(r.told, states([sb('B147', 1, { restUntil: at(2026, 10, 24, 12, 0) }), sb('B119', 2)], [job('YPRS02', 'FO', true, 6, 45, 'ORDERED')], yard), { lineupRead: true });
  assert.deepEqual(r.events.map((e) => `${e.turn} ${e.kind}`).sort(), ['B119 aheadRest', 'B119 position', 'B138 onDuty', 'B147 position'].sort());
  assert.ok(r.events.find((e) => e.turn === 'B138').text.startsWith('B138 on duty on YPRS02 at Sarnia'));
  // A mandatory reset on the spareboard.
  r = turnEvents(r.told, states([sb('B147', 1, { restUntil: at(2026, 10, 25, 5, 59) }), sb('B119', 2)], []), { lineupRead: true });
  assert.ok(r.events.some((e) => e.turn === 'B147' && e.kind === 'reset'));
});

// Owner, 2026-10-25: a road job going spare needing an engineer, no one free
// on the engineer slow board: the next SD turn may be called, told once.
test('turn alerts: SD may be called when the engineer slow board is empty', () => {
  const now = at(2026, 10, 24, 18, 0);
  const sd = (turn, pos, o = {}) => ({ craft: 'EN', turn, pos, terminal: 0, working: false, restUntil: null, statusUntil: null, rn: '', ...o });
  const job = { train: 'M30241', cc: 'EN', yard: false, status: 'PLANNED', at: at(2026, 10, 24, 22, 41), pool: 'SD', turn: 'SD07' };
  const states = (enSlow, sdList, vacancies = [job]) => turnStates({ now, predictions: [{ engineer: 'SD01', order: at(2026, 10, 24, 20, 21) }] }, [],
    { sd: sdList, spareboards: { coFast: null, coSlow: null, enFast: null, enSlow }, vacancies });
  const sdList = [sd('SD01', 1), sd('SD02', 2, { restUntil: at(2026, 10, 25, 1, 0) }), sd('SD05', 3)];
  // Engineer slow board empty (everyone on rest): SD01 lined up already, SD02 on rest → SD05.
  const r = turnEvents({}, states([{ turn: 'EN17', pos: 1, restUntil: at(2026, 10, 25, 2, 0) }], sdList), { lineupRead: true });
  assert.deepEqual(r.events.filter((e) => e.kind === 'mayCall').map((e) => e.text), [
    'SD05: you may be called for M30241 (planned for 24th 2241, expected call 24th 2026): no engineer is free on the engineer slow board.',
  ]);
  assert.deepEqual(turnEvents(r.told, states([{ turn: 'EN17', pos: 1, restUntil: at(2026, 10, 25, 2, 0) }], sdList), { lineupRead: true }).events.filter((e) => e.kind === 'mayCall'), []);
  // Someone free on the slow board: no SD alert.
  assert.ok(!turnEvents({}, states([{ turn: 'EN17', pos: 1, restUntil: null }], sdList), { lineupRead: true }).events.some((e) => e.kind === 'mayCall'));
  // A phone can switch it off.
  assert.deepEqual(phoneEvents([{ turn: 'SD05', kind: 'mayCall', text: 'x' }], { turns: ['SD05'], prefs: { SD05: { mayCall: false } } }, {}, {}, { lineupRead: false }).events, []);
});

// Owner, 2026-10-25: the same for conductors: no one free on the conductor
// slow board → the next SR turn may be called.
test('turn alerts: SR may be called when the conductor slow board is empty', () => {
  const now = at(2026, 10, 24, 18, 0);
  const sr = (turn, pos, o = {}) => ({ craft: 'CO', turn, pos, terminal: 0, working: false, restUntil: null, statusUntil: null, rn: '', ...o });
  const job = { train: 'M38261', cc: 'CO', yard: false, status: 'PLANNED', at: at(2026, 10, 24, 15 + 7, 40), pool: 'SR', turn: 'SR09' };
  const st = turnStates({ now, predictions: [{ turn: 'SR03', order: at(2026, 10, 24, 20, 0) }] }, [],
    { chainGang: [sr('SR03', 1), sr('SR07', 2)], spareboards: { coFast: null, coSlow: [], enFast: null, enSlow: null }, vacancies: [job] });
  const r = turnEvents({}, st, { lineupRead: true });
  assert.deepEqual(r.events.filter((e) => e.kind === 'mayCall').map((e) => e.text), [
    'SR07: you may be called for M38261 (planned for 24th 2240, expected call 24th 2025): no conductor is free on the conductor slow board.',
  ]);
});

// Owner, 2026-10-25: a reminder a set time before the expected call (yard
// jobs don't always show ordered): once, inside the window.
test('turn alerts: reminder before the expected call', () => {
  const states = { B119: { lineup: { train: 'YPRS60', status: 'PLN', order: at(2026, 10, 24, 22, 45), call: at(2026, 10, 24, 20, 45), spare: false, deadhead: false } } };
  const phone = { turns: ['B119'], prefs: { B119: { before: 60 } } };
  let r = phoneEvents([], phone, states, {}, { now: at(2026, 10, 24, 19, 30) }); // 75 min out: not yet
  assert.deepEqual(r.events, []);
  r = phoneEvents([], phone, states, r.base, { now: at(2026, 10, 24, 19, 50) });
  assert.deepEqual(r.events.map((e) => e.text), ['B119: about 55 min to your expected call: YPRS60 planned for 24th 2245, expected call 24th 2045.']);
  assert.deepEqual(phoneEvents([], phone, states, r.base, { now: at(2026, 10, 24, 20, 0) }).events, []); // once
  assert.deepEqual(phoneEvents([], { turns: ['B119'] }, states, {}, { now: at(2026, 10, 24, 20, 0) }).events, []); // off by default
});

// Owner, 2026-10-25: an ordered Mac yard train with no crew rested by the
// call: the crew first in line (on rest) hears a Toronto South crew may get it.
test('turn alerts: Toronto South may get an ordered train', () => {
  const now = at(2026, 10, 24, 14, 0);
  const train = { symbol: 'M38331', originDay: '24', status: 'ORD', order: at(2026, 10, 24, 18, 30), deadhead: false };
  const bunk = [{ pos: 3, en: 'SD13', co: 'SR02', restUntil: at(2026, 10, 24, 16, 44) }];
  const st = (status) => turnStates({ now, predictions: [] }, [], { macLineup: [{ ...train, status }], bunkhouse: bunk });
  const r = turnEvents({}, st('ORD'), { lineupRead: true });
  assert.deepEqual(r.events.filter((e) => e.kind === 'mayCall').map((e) => e.turn).sort(), ['SD13', 'SR02']);
  assert.match(r.events.find((e) => e.turn === 'SD13').text, /M38331 24 is ordered for 24th 1830 \(call 24th 1630\) and no crew in the bunkhouse is rested by then \(you're on rest until 24th 1644\): a Toronto South crew may get it\./);
  assert.deepEqual(turnEvents(r.told, st('ORD'), { lineupRead: true }).events.filter((e) => e.kind === 'mayCall'), []); // once
  assert.deepEqual(turnEvents({}, st('PLN'), { lineupRead: true }).events.filter((e) => e.kind === 'mayCall'), []); // planned: stays theirs
});

// Owner, 2026-10-25: crews in the Toronto bunkhouse hear about the train
// home they're predicted for, like a Sarnia line-up.
test('turn alerts: lined up home from Toronto', () => {
  const now = at(2026, 10, 24, 14, 0);
  const bunk = [{ pos: 3, en: 'SD13', co: 'SR02', restUntil: at(2026, 10, 24, 16, 44) }];
  const train = (status) => ({ symbol: 'M39931', originDay: '25', status, order: at(2026, 10, 25, 2, 0), deadhead: false });
  const st = (status) => turnStates({ now, predictions: [] }, [], { macLineup: [train(status)], bunkhouse: bunk });
  let r = turnEvents({}, st('PLN'), { lineupRead: true });
  assert.deepEqual(r.events.filter((e) => e.turn === 'SR02').map((e) => e.text), ['SR02 lined up home from Toronto: M39931 25 planned for 25th 0200, expected call 25th 0000.']);
  r = turnEvents(r.told, st('ORD'), { lineupRead: true });
  assert.deepEqual(r.events.filter((e) => e.turn === 'SR02').map((e) => e.kind), ['ordered']);
  // And the reminder, on a phone that asked for it.
  const p = phoneEvents([], { turns: ['SR02'], prefs: { SR02: { before: 60 } } }, st('ORD'), {}, { now: at(2026, 10, 24, 23, 0) });
  assert.match(p.events[0].text, /^SR02: about 60 min to your expected call: M39931 25 ordered/);
});

// Owner, 2026-10-25: a phone that starts following a turn gets one "where
// you stand" (news told before it subscribed isn't sent again); phones from
// before this get none for the turns they already had.
test('turn alerts: where you stand, once, for a newly followed turn', () => {
  const st = turnStates({ predictions: [pred()] }, []);
  const r = phoneEvents([], { turns: ['SR03'] }, st, undefined, {});
  assert.deepEqual(r.events.map((e) => e.text), ['SR03 tracked. Right now: lined up: M38261 22 planned for 22nd 1500, expected call 22nd 1245.']);
  assert.deepEqual(phoneEvents([], { turns: ['SR03'] }, st, r.base, {}).events, []); // once
  const added = phoneEvents([], { turns: ['SR03', 'SR09'] }, st, r.base, {});
  assert.deepEqual(added.events.map((e) => e.text), ['SR09 tracked. Not lined up for anything yet.']);
  // A phone known before this update: no burst for its existing turns.
  assert.deepEqual(phoneEvents([], { turns: ['SR03'] }, st, { SR03: { train: 'M38261 22', call: 0 } }, {}).events.filter((e) => e.kind === 'stand'), []);
});

// Owner, 2026-10-25: B119 fills in on SB04's job to Toronto. In the bunkhouse
// (listed as SB04) the Toronto alerts go to B119; back home, both turns hear
// they're back on the board in Sarnia.
test('turn alerts: a spare filling in, through Toronto and back', () => {
  const { updateFillIns } = require('../../lib/board/fillins');
  const sb = (turn, pos, o = {}) => ({ turn, pos, terminal: 0, working: false, workingOn: null, st: null, rn: null, statusUntil: null, restUntil: null, ...o });
  const bpool = (o = {}) => ({ craft: 'CO', turn: 'SB04', pos: 4, terminal: 0, working: false, restUntil: null, statusUntil: null, rn: '', ...o });
  const out = { symbol: 'M38261', originDay: '25', station: 'SARNIA', onDuty: at(2026, 10, 25, 14, 45), crew: [{ craft: 'CO', turn: 'SB04' }] };
  const backfill = [{ train: 'M38261 25', craft: 'CO', job: 'SB04', turn: 'B119' }];
  const now = at(2026, 10, 25, 15, 0);
  // 1. Home: B119 on the slow board, SB04 on the B pool.
  let r = turnEvents({}, turnStates({ now, predictions: [] }, [], { b: [bpool()], spareboards: { coSlow: [sb('B119', 3)] } }), { lineupRead: true });
  // 2. B119 on duty under SB04; SB04 shows working.
  let fills = updateFillIns({}, { backfill, callBoard: [out], now });
  r = turnEvents(r.told, turnStates({ now, predictions: [] }, [out], { b: [bpool({ working: true, workingOn: 'M38261', pos: 999 })], spareboards: { coSlow: [] }, backfill, fillIns: fills }), { lineupRead: true });
  assert.deepEqual(r.events.map((e) => e.turn), ['B119']); // on duty, working SB04
  // 3. In the bunkhouse as SB04: the train home is B119's news, not SB04's.
  const later = at(2026, 10, 25, 23, 0);
  fills = updateFillIns(fills, { callBoard: [], now: later });
  const home = { symbol: 'M39931', originDay: '26', status: 'PLN', order: at(2026, 10, 26, 6, 0), deadhead: false };
  r = turnEvents(r.told, turnStates({ now: later, predictions: [] }, [], { macLineup: [home], bunkhouse: [{ pos: 1, en: 'S301', co: 'SB04', restUntil: null }], fillIns: fills }), { lineupRead: true });
  assert.deepEqual(r.events.filter((e) => e.kind === 'lineup').map((e) => e.text).sort(), [
    'B119 lined up home from Toronto: M39931 26 planned for 26th 0600, expected call 26th 0400.',
    'S301 lined up home from Toronto: M39931 26 planned for 26th 0600, expected call 26th 0400.',
  ]);
  assert.ok(!r.events.some((e) => e.turn === 'SB04')); // SB04's holder isn't the one in Toronto
  // 4. Back in Sarnia: both on their boards again.
  const back = at(2026, 10, 26, 14, 0);
  fills = updateFillIns(fills, { callBoard: [], now: back, homeTurns: new Set(['SB04']), spareTurns: new Set(['B119']) });
  assert.deepEqual(fills, {});
  r = turnEvents(r.told, turnStates({ now: back, predictions: [] }, [], { b: [bpool({ pos: 6 })], spareboards: { coSlow: [sb('B111', 1), sb('B119', 2)] } }), { lineupRead: true });
  assert.deepEqual(r.events.filter((e) => /back on the board/.test(e.text)).map((e) => e.text).sort(), [
    'B119 is back on the board in Sarnia: position 002 (1 ahead).',
    'SB04 is back on the board in Sarnia: position 006 (first out).',
  ]);
});

// Owner, 2026-10-25: the bunkhouse read by name confirms a fill-in (or finds
// one the trip out missed), and clears it when it's the turn's own holder.
test('fill-ins: the bunkhouse by name', () => {
  const { updateFillIns } = require('../../lib/board/fillins');
  const now = at(2026, 10, 25, 23, 0);
  assert.deepEqual(updateFillIns({}, { bunk: [{ job: 'SB04', turn: 'B119' }], now }), { SB04: { turn: 'B119', train: null, at: now } });
  const had = { SB04: { turn: 'B119', train: 'M38261 25', at: now - 60 } };
  assert.deepEqual(updateFillIns(had, { bunk: [{ job: 'SB04', turn: 'B119' }], now }).SB04, { turn: 'B119', train: 'M38261 25', at: now });
  assert.deepEqual(updateFillIns(had, { bunk: [{ job: 'SB04', turn: 'SB04' }], now }), {});
});

// Owner, 2026-10-25: alerts can follow a person instead of a turn: the phone
// keeps '@<hash>', and each check that becomes their own turn now.
test('turn alerts: following a person across turns', () => {
  const { expandPhone, updatePersonTurns } = require('../../lib/board/alerts');
  const h = 'abcdef0123456789';
  let people = updatePersonTurns({}, [{ h, turn: 'B119', own: true }, { h, turn: 'SB04', own: false }], 1);
  assert.deepEqual(people[h].turn, 'B119'); // covering SB04 for a trip doesn't count
  const phone = { key: 'k', turns: [`@${h}`, 'SR09'], prefs: { [`@${h}`]: { lineup: false, time: 60 }, SR09: { time: 15 } } };
  assert.deepEqual(expandPhone(phone, people).turns, ['B119', 'SR09']);
  assert.deepEqual(expandPhone(phone, people).prefs.B119, { lineup: false, time: 60 });
  // A temporary assignment onto the Chain Gang: alerts move to SR03, with a "where you stand".
  const st = turnStates({ predictions: [pred({ turn: 'SR03' })] }, []);
  const first = phoneEvents([], expandPhone(phone, people), st, undefined, {});
  people = updatePersonTurns(people, [{ h, turn: 'SR03', own: true }], 2);
  const moved = phoneEvents([], expandPhone(phone, people), st, first.base, {});
  assert.deepEqual(moved.events.map((e) => e.text), ['SR03 tracked. Right now: lined up: M38261 22 planned for 22nd 1500, expected call 22nd 1245.']);
  // Not seen yet: nothing for them, the rest of the phone's turns as usual.
  assert.deepEqual(expandPhone({ turns: ['@ffffffffffffffff', 'SR09'] }, people).turns, ['SR09']);
});

// Owner, 2026-10-30: "it should say I'm not found since there is a new
// person on SR03": a followed person off their turn gets no more of its alerts.
test('turn alerts: a followed person off their turn', () => {
  const { expandPhone, updatePersonTurns } = require('../../lib/board/alerts');
  const me = 'abcdef0123456789';
  const other = '0123456789abcdef';
  const t0 = Date.UTC(2026, 9, 30, 2, 0);
  let people = updatePersonTurns({}, [{ h: me, turn: 'SR03', own: true }], t0);
  // Someone else on SR03 now: straight off.
  people = updatePersonTurns(people, [{ h: other, turn: 'SR03', own: true }], t0 + 5 * 60000);
  assert.ok(!people[me]);
  assert.deepEqual(expandPhone({ turns: [`@${me}`, 'SR09'] }, people).turns, ['SR09']);
  // Not seen while names are read: off after 30 min, not before.
  people = updatePersonTurns({}, [{ h: me, turn: 'SR03', own: true }], t0);
  people = updatePersonTurns(people, [{ h: other, turn: 'SA01', own: true }], t0 + 25 * 60000);
  assert.equal(people[me].turn, 'SR03');
  people = updatePersonTurns(people, [{ h: other, turn: 'SA01', own: true }], t0 + 35 * 60000);
  assert.ok(!people[me]);
  // A check that read no names says nothing about them.
  people = updatePersonTurns({}, [{ h: me, turn: 'SR03', own: true }], t0);
  people = updatePersonTurns(people, [], t0 + 60 * 60000);
  assert.equal(people[me].turn, 'SR03');
  // 501/502: two people on one turn.
  people = updatePersonTurns({}, [{ h: me, turn: 'S501', own: true }], t0);
  people = updatePersonTurns(people, [{ h: me, turn: 'S501', own: true }, { h: other, turn: 'S501', own: true }], t0 + 5 * 60000);
  assert.equal(people[me].turn, 'S501');
});

// Owner, 2026-10-25: S501 is two turns (EN and CO); a phone can follow one.
test('turn alerts: S501-CO hears only the conductor going on duty', () => {
  const cb = [{ symbol: 'L50231', originDay: '25', station: 'SARNIA', onDuty: at(2026, 10, 25, 3, 0), crew: [{ craft: 'EN', turn: 'S502' }, { craft: 'CO', turn: 'S501' }] }];
  const st = turnStates({ predictions: [] }, cb);
  assert.ok(st['S501-CO'].onDuty && !st['S501-EN']);
  const r = turnEvents({}, st);
  assert.deepEqual(r.events.filter((e) => /S501-/.test(e.turn)).map((e) => e.text), ['S501-CO on duty on L50231 25 at Sarnia 25th 0300.']);
});

// Owner, 2026-10-29: mid-call the called crew drops off the board but the
// train stays on the line-up until both accept, so the next crew looked
// lined up for it and got a wrong alert. It waits now.
test('turn alerts: no line-up alert for the next crew while a train is being called', () => {
  const ord = (o) => pred({ status: 'ORD', ...o });
  let r = step({}, [ord()], [], { now: at(2026, 10, 22, 12, 40) });
  let told = r.told; // SR03 + SD05 lined up, ordered
  // 1250: SR03 is being called (off the board); the prediction moves SR04 up.
  r = step(told, [ord({ turn: 'SR04' })], [], { now: at(2026, 10, 22, 12, 50) });
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.held, ['SR04']);
  // 1300: called, on the Call Board: SR03 on duty, SR04 never told.
  r = step(r.told, [], [board()], { now: at(2026, 10, 22, 13, 0) });
  assert.deepEqual(r.events.map((e) => [e.turn, e.kind]), [['SD05', 'onDuty'], ['SR03', 'onDuty']]);
  assert.ok(!r.events.some((e) => e.turn === 'SR04'));
  // The call really moved on: still the same after 30 min, SR04 is told.
  r = step(told, [ord({ turn: 'SR04' })], [], { now: at(2026, 10, 22, 12, 50) });
  r = step(r.told, [ord({ turn: 'SR04' })], [], { now: at(2026, 10, 22, 13, 5) });
  assert.deepEqual(r.events, []);
  r = step(r.told, [ord({ turn: 'SR04' })], [], { now: at(2026, 10, 22, 13, 21) });
  assert.deepEqual(r.events.map((e) => [e.turn, e.kind]), [['SR04', 'lineup'], ['SR04', 'ordered']]);
  // Hours before the call, a new line-up is news straight away.
  r = step(told, [ord({ turn: 'SR04', call: at(2026, 10, 22, 18, 0) })], [], { now: at(2026, 10, 22, 12, 50) });
  assert.deepEqual(r.events.map((e) => [e.turn, e.kind]), [['SR04', 'lineup'], ['SR04', 'ordered']]);
});
