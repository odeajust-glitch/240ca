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
