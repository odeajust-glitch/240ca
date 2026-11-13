const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../../lib/board/displaced');
const { boardNameNow } = require('../../lib/board/names');
const { listCodeAccounts } = require('../../lib/board/r2');
const { at, fmt } = require('../../lib/board/time');

// Owner, 2026-11-13: "notify you if you have been displaced … Joe Haugh has
// displaced me so I need to place". Made-up hashes; the turns and times are
// his real case: S501 CO his at the 1212 check, Joe Haugh's at 1220.
const own = (h, turn, craft) => ({ h, turn, own: true, ...(craft ? { craft } : {}) });
const notOwn = (h, turn) => ({ h, turn, own: false });
const t1212 = at(2026, 11, 13, 12, 12);
const t1220 = at(2026, 11, 13, 12, 20);
const others = [own('sr02', 'SR02'), own('en', 'S501', 'EN'), own('sd01', 'SD01')];

test('displaced: the owner\'s own case, S501 CO taken by Joe at 1220', () => {
  let r = D.update(null, [own('owner', 'S501', 'CO'), ...others], t1212);
  assert.deepEqual(r.events, []); // the first check only learns the board
  r = D.update(r.memory, [own('joe', 'S501', 'CO'), ...others], t1220);
  assert.deepEqual(r.events, [{ h: 'owner', by: 'joe', turn: 'S501-CO', since: t1212, at: t1220 }]);
  assert.equal(r.boardChange, false);
  assert.equal(D.text(r.events[0], 'Joe Haugh', fmt(t1220)), 'Looks like Joe Haugh has displaced you off S501 CO (13th 1220 check). Check CATS: you may need to place.');
  assert.equal(D.why(r.events[0], (h) => ({ owner: 'JUOD', joe: 'JOHA' })[h], fmt), 'S501 CO was JUOD\'s own turn at the 13th 1212 check; at 13th 1220 the board showed JOHA on it as their own, and JUOD on no board.');
  // Told once: the next check sees Joe on it as before.
  r = D.update(r.memory, [own('joe', 'S501', 'CO'), ...others], t1220 + 8);
  assert.deepEqual(r.events, []);
  // No name read for the turn: nobody is named.
  assert.match(D.text({ turn: 'SR03' }, null, '9th 0008'), /^Looks like Someone else has displaced you off SR03 /);
});

test('displaced: 501/502 is two turns, one per craft', () => {
  let r = D.update({ turns: {} }, [own('co', 'S501', 'CO'), own('en', 'S501', 'EN')], t1212);
  // The engineer changes; the conductor is still there: only the engineer is told.
  r = D.update(r.memory, [own('co', 'S501', 'CO'), own('new', 'S501', 'EN')], t1220);
  assert.deepEqual(r.events.map((e) => [e.h, e.turn]), [['en', 'S501-EN']]);
  // A 501/502 sighting without its craft counts for neither.
  assert.equal(D.turnKey(own('x', 'S501')), null);
  assert.equal(D.turnKey(own('x', 'S502', 'LE')), 'S502-EN');
});

test('displaced: the 13 Nov 1358 chain: S108 to 164bea, its holder straight onto SD05, SD05\'s holder off every board', () => {
  let r = D.update({ turns: {} }, [own('134d', 'S108'), own('374a', 'SD05'), own('164b', 'S999')], at(2026, 11, 13, 13, 49));
  r = D.update(r.memory, [own('164b', 'S108'), own('134d', 'SD05')], at(2026, 11, 13, 13, 58));
  // 134d placed in the same check: nothing to tell them. 374a is told.
  assert.deepEqual(r.events.map((e) => [e.h, e.turn, e.by]), [['374a', 'SD05', '134d']]);
});

test('displaced: still on a board in any way, or the turn only filled for now: nothing sent', () => {
  const base = D.update({ turns: {} }, [own('a', 'SR03'), own('b', 'SR11')], t1212).memory;
  // Seen working (not their own turn this check): still with it.
  assert.deepEqual(D.update(base, [own('x', 'SR03'), notOwn('a', 'SR03')], t1220).events, []);
  // Filling in somewhere else: not off the boards.
  assert.deepEqual(D.update(base, [own('x', 'SR03'), notOwn('a', 'S108')], t1220).events, []);
  // On a turn of their own already: placed (or moved).
  assert.deepEqual(D.update(base, [own('x', 'SR03'), own('a', 'B138')], t1220).events, []);
  // The new holder has TV / TEMP VCNY on their own turn (25 Oct: the owner on
  // SR03 on a TV, its holder back on the 30th): a temporary vacancy.
  assert.deepEqual(D.update(base, [own('x', 'SR03')], t1220, { tempAway: ['x'] }).events, []);
  assert.deepEqual(D.update(base, [own('x', 'SR03')], t1220, { tempAway: ['someone'] }).events.map((e) => e.h), ['a']);
  // Two on it as their own, the holder one of them: still theirs.
  const two = D.update(base, [own('x', 'SR03'), own('a', 'SR03')], t1220);
  assert.deepEqual(two.events, []);
  assert.equal(two.memory.turns.SR03.h, 'a');
});

test('displaced: a change of card is not a bump; an old holder is not news; names not read change nothing', () => {
  const turns = ['SR01', 'SR02', 'SR03', 'SR04', 'SR05', 'SR06', 'SR07'];
  const base = D.update({ turns: {} }, turns.map((t, i) => own(`old${i}`, t)), t1212).memory;
  const seven = D.update(base, turns.map((t, i) => own(`new${i}`, t)), t1220);
  assert.equal(seven.changes, 7);
  assert.equal(seven.boardChange, true);
  assert.deepEqual(seven.events, []);
  assert.equal(seven.memory.turns.SR01.h, 'new0'); // the new board is learned
  // Six at once are still bumps (13 Nov had two in one check).
  const six = D.update(base, turns.map((t, i) => own(i < 6 ? `new${i}` : `old${i}`, t)), t1220);
  assert.equal(six.events.length, 6);
  // Last seen on it more than an hour ago (the laptop was off, or they left it): learned quietly.
  assert.deepEqual(D.update(base, [own('x', 'SR03')], t1212 + D.RECENT_MIN + 1).events, []);
  assert.equal(D.update(base, [own('x', 'SR03')], t1212 + D.RECENT_MIN).events.length, 1);
  // A check that read no names.
  const none = D.update(base, [], t1220);
  assert.deepEqual(none, { memory: base, events: [], changes: 0, boardChange: false });
  // Not kept (a check that couldn't reach Cloudflare): the next check tells it again.
  const again = D.update(base, [own('x', 'SR03')], t1220 + 8);
  assert.deepEqual(again.events.map((e) => e.h), ['old2']);
});

test('displaced: yard jobs, relief jobs, trainee slots and MU are left out', () => {
  for (const turn of ['YBHS01', 'XSAS05', 'S102-ET', 'S501-TT', 'MU01']) {
    const base = D.update({ turns: {} }, [own('a', turn)], t1212).memory;
    assert.deepEqual(D.update(base, [own('b', turn)], t1220).events, [], turn);
  }
  for (const turn of ['SR03', 'SA05', 'SB01', 'SD05', 'S108', 'S301', 'B138', 'EN01']) assert.equal(D.turnKey(own('a', turn)), turn);
});

test('displaced: the name the board shows on the turn now', () => {
  const now = new Date('2026-11-13T17:20:30Z');
  const seen = '2026-11-13T17:20:00.000Z';
  const store = {
    '@board|S501': { name: 'Joe Haugh', seen, crafts: { EN: 'Eddie Engineer', CO: 'Joe Haugh' } },
    '@board|SD05': { name: 'Sam Spare', seen, crafts: {} },
    '@board|SR03': { name: 'open turn', seen, crafts: {} },
    '@board|SR10': { name: 'Old Read', seen: '2026-11-13T16:00:00.000Z', crafts: {} },
  };
  assert.equal(boardNameNow(store, 'S501-CO', now), 'Joe Haugh');
  assert.equal(boardNameNow(store, 'S501-EN', now), 'Eddie Engineer');
  assert.equal(boardNameNow(store, 'SD05', now), 'Sam Spare');
  assert.equal(boardNameNow(store, 'SR03', now), null); // an open turn names nobody
  assert.equal(boardNameNow(store, 'SR10', now), null); // not read this check
  assert.equal(boardNameNow(store, 'S502-CO', now), null);
});

test('displaced: the accounts with a name code, read from the bucket (approved ones and the owner)', async () => {
  const objects = {
    'accounts/owner.json': { code: 'JUOD' },
    [`accounts/users/${'a'.repeat(32)}.json`]: { status: 'approved', code: 'JOHA', name: 'Joe Haugh', email: 'never@returned' },
    [`accounts/users/${'b'.repeat(32)}.json`]: { status: 'pending', code: 'PEND' },
    [`accounts/users/${'c'.repeat(32)}.json`]: { status: 'approved', name: "O'Dea, Justin" },
    'accounts/postings.json': { [`${'a'.repeat(32)}`]: 1 },
  };
  const fetchImpl = async (url) => {
    const u = new URL(url);
    if (u.searchParams.get('list-type') === '2') {
      const prefix = u.searchParams.get('prefix') || '';
      const items = Object.keys(objects).filter((k) => k.startsWith(prefix)).map((k) => `<Contents><Key>${k}</Key><ETag>x</ETag></Contents>`).join('');
      return { ok: true, status: 200, text: async () => `<ListBucketResult>${items}<IsTruncated>false</IsTruncated></ListBucketResult>` };
    }
    const key = decodeURIComponent(u.pathname.replace(/^\/board-site\//, ''));
    return key in objects ? { ok: true, status: 200, text: async () => JSON.stringify(objects[key]) } : { ok: false, status: 404 };
  };
  const r2 = { accountId: 'acct', bucket: 'board-site', keyId: 'KEY', secret: 'SECRET' };
  // Approved accounts only; the code their sign-up name makes, never the name or email.
  assert.deepEqual(await listCodeAccounts(r2, fetchImpl), [
    { id: 'owner', code: 'JUOD', nameCodes: [] },
    { id: 'a'.repeat(32), code: 'JOHA', nameCodes: ['JOHA'] },
    { id: 'c'.repeat(32), code: '', nameCodes: ['JUOD'] },
  ]);
});

test('displaced: only the displaced member\'s own devices are told (owner: "Only their account")', () => {
  const hashOf = (code) => `h:${code}`;
  const accounts = [{ id: 'acc-joe', code: 'JOHA' }, { id: 'acc-sam', code: 'SASP' }, { id: 'owner', code: 'JUOD' }];
  const subs = [
    { key: 'joe-phone', account: 'acc-joe', turns: ['SR10'] },
    { key: 'joe-tablet', account: 'acc-joe', turns: [] },
    { key: 'sam-follows-joe', account: 'acc-sam', turns: ['@h:JOHA'] },
    { key: 'loose-follows-joe', turns: ['@h:JOHA'] },
    { key: 'owner-phone', turns: ['@h:JUOD', 'S501-CO'] },
    { key: 'owner-device', account: 'owner', turns: [] },
    { key: 'sam-follows-owner', account: 'acc-sam', turns: ['@h:JUOD'] },
  ];
  const keys = (h) => D.devicesFor(h, subs, accounts, hashOf, 'h:JUOD').map((x) => x.key);
  assert.deepEqual(keys('h:JOHA'), ['joe-phone', 'joe-tablet']);
  // The owner: his account's device, and his own phones (owner key, no account).
  assert.deepEqual(keys('h:JUOD'), ['owner-phone', 'owner-device']);
  // Nobody has an account with that code: nobody is told.
  assert.deepEqual(keys('h:NOBO'), []);
  // The owner's phones are his even with no code saved on his own profile.
  assert.deepEqual(D.devicesFor('h:JUOD', subs, [], hashOf, 'h:JUOD').map((x) => x.key), ['owner-phone', 'owner-device']);
});

// Owner, 2026-11-13, the same evening: "if youre tracking TEST as a name code,
// and have the owners key, you will get all the bumping notifications that
// would normally goto everyone. Say whos getting bumped by whom. That way i can
// see if they are correct before pushing it as a feature".
test('displaced, owner test: members are not told yet; every bump goes to his TEST phones', () => {
  assert.equal(D.MEMBERS_ON, false);
  assert.equal(D.TEST_CODE, 'TEST');
  const fs = require('fs');
  const auto = fs.readFileSync(require.resolve('../../scripts/board-auto.js'), 'utf8');
  assert.ok(auto.includes("if (Displaced.MEMBERS_ON) await tell({ turn: d.turn, kind: 'displaced'"));
  assert.ok(auto.includes('await tell({ turn: d.turn, kind: \'displacedTest\''));
  // His TEST phones are kept past the 17 Nov cut-off for phones with no account.
  assert.ok(auto.includes('Health.membersOnly(await listSubscriptions(...args), Date.now(), [ownerHash(), People.personHash(Displaced.TEST_CODE)])'));
});

test('displaced, owner test: who bumped whom, from where, and whether their account would hear', () => {
  assert.equal(D.testText({ turn: 'S501-CO' }, "Justin O'Dea", 'Joe Haugh', '13th 1220', 0),
    "Joe Haugh bumped Justin O'Dea off S501 CO (13th 1220 check). No account has their name code, so nobody would be told.");
  // The 1358 chain: the new holder of SD05 was on S108 at the check before.
  let r = D.update({ turns: {} }, [own('134d', 'S108'), own('374a', 'SD05')], at(2026, 11, 13, 13, 49));
  r = D.update(r.memory, [own('164b', 'S108'), own('134d', 'SD05')], at(2026, 11, 13, 13, 58));
  assert.equal(r.events[0].from, 'S108');
  assert.equal(D.testText(r.events[0], 'Sam Senior', 'Pat Placer', '13th 1358', 1), 'Pat Placer (from S108) bumped Sam Senior off SD05 (13th 1358 check). Would go to 1 device on their account.');
  assert.equal(D.testText({ turn: 'SR03' }, null, null, '9th 0008', 2), 'Someone bumped the holder off SR03 (9th 0008 check). Would go to 2 devices on their account.');
  assert.equal(D.boardChangeText(18, '25th 1216'), '18 turns changed holder in the 25th 1216 check: taken as a change of card, so no bump alerts for it.');
});

test('displaced, owner test: only phones saved with the owner key that follow TEST', () => {
  const t = 'tttttttttttttttt';
  const after = '2026-11-13T22:00:00.000Z';
  const subs = [
    { key: 'owner-phone', turns: [`@${t}`], updated: after }, // owner key: the Worker writes no account
    { key: 'owner-device', account: 'owner', turns: [`@${t}`, 'SR03'], updated: after },
    { key: 'member', account: 'a'.repeat(32), turns: [`@${t}`], updated: after }, // a member typing TEST
    { key: 'before-lock', turns: [`@${t}`], updated: '2026-11-09T12:00:00.000Z' },
    { key: 'no-date', turns: [`@${t}`] },
    { key: 'owner-other', turns: ['@cccccccccccccccc'], updated: after },
  ];
  assert.deepEqual(D.testDevices(subs, t).map((x) => x.key), ['owner-phone', 'owner-device']);
  // His own member account (13 Nov: his TEST phone was saved under one): the
  // approved account whose sign-up name makes his code. Not a member who
  // saved his code as theirs, nor one whose name makes another code.
  const accounts = [{ id: 'owner', code: 'JUOD', nameCodes: [] }, { id: 'his', code: '', nameCodes: ['JUOD'] }, { id: 'a'.repeat(32), code: 'JUOD', nameCodes: ['JOHA'] }];
  const withHis = [...subs, { key: 'his-member-phone', account: 'his', turns: [`@${t}`], updated: after }];
  assert.deepEqual(D.testDevices(withHis, t, accounts, 'JUOD').map((x) => x.key), ['owner-phone', 'owner-device', 'his-member-phone']);
  assert.deepEqual(D.testDevices(withHis, t, accounts, '').map((x) => x.key), ['owner-phone', 'owner-device']);
  assert.equal(new Date(D.LOCKED_AT).toLocaleString('sv-SE', { timeZone: 'America/Toronto' }), '2026-11-10 19:00:00');
  // The page follows TEST straight away only with the owner key, and never offers
  // it as a job posting code.
  const html = require('fs').readFileSync(require.resolve('../../public/board.html'), 'utf8');
  assert.ok(html.includes("const BUMP_TEST = 'TEST';"));
  assert.ok(html.includes('if (t === BUMP_TEST && OwnerKey.has()) {'));
  assert.ok(html.includes('|| myCode === BUMP_TEST ? \'\' :'));
});
