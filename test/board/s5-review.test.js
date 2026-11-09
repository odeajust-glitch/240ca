const test = require('node:test');
const assert = require('node:assert/strict');
const { compareS5, auditCases } = require('../../lib/board/s5-review');
const { at } = require('../../lib/board/time');

test('a previous undated working symbol cannot confirm a future order', () => {
  const [r] = compareS5(auditCases()[0].input);
  assert.deepEqual(r.current, ['S501 · marked known', 'S501 · marked known']);
  assert.deepEqual(r.proposed, ['S502 · predicted', 'S502 · predicted']);
});

test('the engineer retains TV coverage when the conductor is working', () => {
  const [r] = compareS5(auditCases()[1].input);
  assert.equal(r.proposed[0], 'S501 · predicted');
  assert.match(r.proposed[1], /S501 → spare .*TV/);
});

test('a dated craft record and fill-in do not confirm a missing second craft', () => {
  const i = auditCases()[1].input;
  i.callBoard = [{ ...i.lineup[0], station: 'Sarnia', onDuty: i.lineup[0].order, crew: [{ craft: 'CO', turn: 'S501' }] }];
  const [r] = compareS5(i, [{ train: 'L50231 09', craft: 'CO', turn: 'B123', job: 'S501' }]);
  assert.deepEqual(r.proposed, ['B123 covering S501 · recorded fill-in', 'No unambiguous craft record']);
});

test('the same symbol and day in another month do not confirm this trip', () => {
  const i = auditCases()[0].input;
  i.callBoard = [{ ...i.lineup[0], station: 'Sarnia', onDuty: at(2026,10,9,5), crew: [{craft:'CO',turn:'S501'}] }];
  assert.deepEqual(compareS5(i)[0].proposed, ['S502 · predicted', 'S502 · predicted']);
});
