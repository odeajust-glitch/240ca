// Owner, 2026-11-04: WADE (TT with S501) "should show him with me … stay on
// the turn till they get back to Sarnia".
const test = require('node:test');
const assert = require('node:assert/strict');
const { keepTrainees } = require('../../lib/board/trainees');

const MIN = 60000;
const home = { s5: [{ turn: 'S501', craft: 'CO', terminal: 0 }, { turn: 'S501', craft: 'EN', terminal: 0 }], callBoard: [] };
const onL502 = { s5: [{ turn: 'S501', craft: 'CO', terminal: 0, working: true }], callBoard: [{ symbol: 'L50231', crew: [{ craft: 'CO', turn: 'S501' }, { craft: 'TT', turn: 'S501' }] }] };
const atGarnet = { s5: [{ turn: 'S501', craft: 'CO', terminal: 1 }, { turn: 'S501', craft: 'EN', terminal: 1 }], callBoard: [] };

test('a trainee stays on the slot while the turn is away, until back in Sarnia', () => {
  // Seen in Sarnia's crews in town on S501-TT.
  let k = keepTrainees({}, [{ h: 'wade', turn: 'S501-TT', own: true }], home, 0);
  assert.equal(k.add.length, 0);
  // Out on L502, not read by name: kept.
  k = keepTrainees(k.memory, [], onL502, 60 * MIN);
  assert.deepEqual(k.add, [{ h: 'wade', turn: 'S501-TT', own: true, kept: true }]);
  // Hours at Garnet (term 1): still kept.
  k = keepTrainees(k.memory, [], atGarnet, 12 * 60 * MIN);
  assert.equal(k.add.length, 1);
  // Home again, not in crews in town: kept 30 min, then let go.
  k = keepTrainees(k.memory, [], home, 12 * 60 * MIN + 20 * MIN);
  assert.equal(k.add.length, 1);
  k = keepTrainees(k.memory, [], home, 12 * 60 * MIN + 45 * MIN);
  assert.deepEqual([k.add.length, k.memory.wade], [0, undefined]);
});

test('let go when seen on a turn of their own, or after 4 days unseen', () => {
  let k = keepTrainees({}, [{ h: 'wade', turn: 'S501-TT', own: true }], home, 0);
  k = keepTrainees(k.memory, [{ h: 'wade', turn: 'B119', own: true }], atGarnet, MIN);
  assert.equal(k.memory.wade, undefined);
  k = keepTrainees({}, [{ h: 'wade', turn: 'S501-TT', own: true }], home, 0);
  k = keepTrainees(k.memory, [], atGarnet, 5 * 864e5);
  assert.deepEqual([k.add.length, k.memory.wade], [0, undefined]);
});
