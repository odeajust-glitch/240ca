// Owner, 2026-11-06: tell people followed by name code they were held 14 h+.
const test = require('node:test');
const assert = require('node:assert/strict');
const { heldEvents, crewOf } = require('../../lib/board/held-alerts');

const row = { id: 'M38261 05', month: '2026-11', co: 'SB01', en: 'S301', onDuty: '2026-11-05 1455', offDuty: '2026-11-06 0019', back: { id: 'Z14931 06', onDuty: '2026-11-06 1600' }, heldMin: 941 };
const people = {
  aaaa: [{ turn: 'SB01', own: true, from: '2026-11-04 0800', to: '2026-11-05 1430' }],
  bbbb: [{ turn: 'B111', own: true, from: '2026-11-05 0800', to: '2026-11-05 1400' }, { turn: 'S301', own: false, from: '2026-11-05 1430', to: '2026-11-05 1500' }],
  cccc: [{ turn: 'SB01-TT', own: false, from: '2026-11-05 1400', to: '2026-11-05 1500' }],
  dddd: [{ turn: 'SB01', own: true, from: '2026-11-07 0800', to: '2026-11-07 0900' }],
};

test('held 14 h+: the conductor and engineer on that trip, by their sightings', () => {
  assert.deepEqual(crewOf(row, people), { aaaa: 'CO', bbbb: 'EN' });
});

test('held 14 h+: phones following them by name code, once per trip', () => {
  const now = Date.UTC(2026, 10, 6, 17);
  const r = heldEvents({ trains: [row, { ...row, id: 'X1 05', heldMin: 600 }], people, followed: new Set(['aaaa', 'bbbb', 'dddd']), now });
  assert.deepEqual(r.events.map((e) => [e.hash, e.turn]), [['aaaa', 'SB01'], ['bbbb', 'S301']]);
  assert.match(r.events[0].text, /^SB01: you were held 15 h 41 m at Toronto after M38261 05 \(off duty ≈ 6th 0019, Z14931 06 home on duty 6th 1600\)\. That's an Article 18\.6\(b\) violation/);
  assert.doesNotMatch(r.events[1].text, /18\.6\(b\) violation/); // engineers aren't under 18.6(b)
  // Tapping it opens that trip's form, that craft.
  assert.equal(r.events[1].url, `./#14h=${encodeURIComponent('M38261 05|2026-11|EN')}`);
  assert.equal(heldEvents({ trains: [row], people, followed: new Set(['aaaa']), now, told: r.told }).events.length, 0);
  // Not followed: nothing.
  assert.equal(heldEvents({ trains: [row], people, followed: new Set(), now }).events.length, 0);
  // An old trip (before the cut-off) isn't news.
  assert.equal(heldEvents({ trains: [row], people, followed: new Set(['aaaa']), now, since: '2026-11-07 0000' }).events.length, 0);
});

// Owner, 2026-11-07: M39671 04 left Sarnia as CO SA08 + EN S302; in Toronto
// and home it was SB02 + S302 (a spare on SB02's job).
test('held 14 h+: a crew whose conductor turn changed in Toronto', () => {
  const r = { id: 'M39671 04', month: '2026-11', co: 'SB02', en: 'S302', crew: 'EN S302 · ET S303 · CO SA08', onDuty: '2026-11-05 2100', offDuty: '2026-11-06 0529', back: { id: 'M38331 06', onDuty: '2026-11-06 2110' }, heldMin: 941 };
  assert.deepEqual(crewOf(r, { eeee: [{ turn: 'SA08', own: false, from: '2026-11-05 2040', to: '2026-11-05 2110' }] }), { eeee: 'CO' });
  // The trip itself, from the checks: off duty from the bunkhouse (SB02 + S302), home on M38331 06.
  const T = require('../../public/board-trains.js');
  const lu = { lineup: [{ order: '5th 2115', status: 'ORD', train: 'M39671 04', crew: null }], macLineup: [{ order: '6th 2125', status: 'PLN', train: 'M38331 06' }] };
  const snap = (taken, o) => ({ taken, screens: ['callBoard', 'bunkhouse', 'lineup', 'macLineup'], lineup: [], macLineup: [], onDuty: [], bunkhouse: [], ...o });
  const st = T.track([
    snap('2026-11-05 1900', lu),
    snap('2026-11-05 2110', { onDuty: [{ train: 'M39671 04', onDuty: '5th 2100', station: 'SARNIA', crew: 'EN S302 · ET S303 · CO SA08' }] }),
    snap('2026-11-06 0600', { bunkhouse: [{ en: 'S302', co: 'SB02', rested: '6th 1329' }] }),
    snap('2026-11-06 2120', { onDuty: [{ train: 'M38331 06', onDuty: '6th 2110', station: 'TORONTO', crew: 'EN S302 · CO SB02' }] }),
  ]);
  const row = T.summarize(st).find((x) => x.id === 'M39671 04');
  assert.deepEqual([row.offDuty, row.co, row.back && row.back.id, row.heldMin], ['2026-11-06 0529', 'SB02', 'M38331 06', 941]);
});
