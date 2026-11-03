// Owner, 2026-11-03: 501/502 is one number, two turns. JUOD on S501 CO was
// shown the S501 engineer's rest; rests and people's stretches keep the craft.
const test = require('node:test');
const assert = require('node:assert');
const BoardTurns = require('../../public/board-turns');
const People = require('../../lib/board/people');

test('rests on 501/502 keep their craft', () => {
  const snap = (taken, en, co) => ({ taken, lineup: [], onDuty: [], away: [], returning: [], sequence: [], bunkhouse: [], vacancies: [], yardJobs: [],
    pools: [{ name: '501/502 (S5)', turns: [{ pos: '001', turn: 'S501', craft: 'EN', status: en }, { pos: '001', turn: 'S501', craft: 'CO', status: co }] }] });
  const h = BoardTurns.history([snap('2026-11-03 0518', 'rest until 3rd 1500', 'hold turn until 3rd 0559')], {});
  assert.deepStrictEqual(h.S501.rests.map((r) => [r.kind, r.until, r.craft]), [['Rest', '3rd 1500', 'EN'], ['Hold turn', '3rd 0559', 'CO']]);
});

test('a person on 501/502: the stretch keeps their craft', () => {
  const into = People.addSightings({}, [{ h: 'a', turn: 'S501', own: true, craft: 'CO' }, { h: 'b', turn: 'SR03', own: true, craft: 'CO' }], '2026-11-03 0518');
  assert.strictEqual(into.a[0].craft, 'CO');
  assert.strictEqual(into.b[0].craft, undefined); // only 501/502 needs it
});
