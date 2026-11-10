const test = require('node:test');
const assert = require('node:assert/strict');
const Patterns = require('../../lib/board/patterns');

// Owner, 2026-11-10: odds of working by board position, a train's habit, how
// wrong the shown time is by how far out.
test('patterns: board position to time on duty, train habit, miss by lead', () => {
  const pad = (n) => String(n).padStart(2, '0');
  const snaps = [];
  // 20 days: B101 first out at 0600 and on a yard job at 1400; B102 second, working at 2200.
  for (let d = 1; d <= 20; d++) {
    const day = `2026-10-${pad(d)}`;
    snaps.push({ taken: `${day} 0600`, pools: [{ name: 'Conductor fast board · conductors', turns: [{ turn: 'B109', status: 'rest until 9th 0900' }, { turn: 'B101', status: 'available' }, { turn: 'B102', status: 'available' }] }] });
    snaps.push({ taken: `${day} 1300`, yardJobs: [{ job: 'YPRS30', onDuty: `${d}${['th', 'st', 'nd', 'rd'][d % 10 > 3 || (d > 10 && d < 14) ? 0 : d % 10]} 1400`, crew: 'CO B101' }] });
    snaps.push({ taken: `${day} 2100`, onDuty: [{ train: `M1 ${pad(d)}`, onDuty: `${d}${['th', 'st', 'nd', 'rd'][d % 10 > 3 || (d > 10 && d < 14) ? 0 : d % 10]} 2200`, crew: 'CO SR01', backfill: [{ craft: 'CO', job: 'SR01', turn: 'B102' }] }] });
  }
  const trains = [];
  for (let d = 1; d <= 10; d++) trains.push({ id: `M27831 ${pad(d)}`, from: 'sarnia', firstPlan: `2026-10-${pad(d)} 1000`, onDuty: `2026-10-${pad(d)} 1600`,
    events: [{ kind: 'seen', taken: `2026-10-${pad(d)} 0100`, at: `2026-10-${pad(d)} 1000` }, { kind: 'ordered', taken: `2026-10-${pad(d)} 1330`, at: `2026-10-${pad(d)} 1600` }] });
  const p = Patterns.finish(Patterns.collect(snaps), trains);
  const fast = Object.fromEntries(p.board['Conductor fast'].map((x) => [x.rank, x]));
  // First available (the resting turn ahead doesn't count): on duty 8 h later; second: 16 h.
  assert.deepEqual([fast['1st'].n, fast['1st'].median, fast['1st'].in8], [20, 480, 100]);
  assert.deepEqual([fast['2nd'].median, fast['2nd'].in8], [960, 0]);
  // Kept by letters and number: an extra (X278) would be its own train.
  assert.deepEqual(p.drift.M278, { n: 10, median: 360, later: 100, earlier: 0, within30: 0 });
  assert.equal(p.drift['278'], undefined);
  assert.equal(Patterns.rankOf(7), '6th–8th');
  assert.deepEqual(Patterns.finish({}, []), { board: {}, drift: {}, predict: { trains: {}, all: {} }, lead: [] });
  // The same train, planned and 6 to 10 h away (0100 → 1000): it went 6 h after the shown time every run.
  const w = p.predict.trains.M278['6-10'];
  assert.deepEqual([w.n, w.mid, w.lo, w.hi, w.held], [10, 360, 360, 360, 10]);
  // Still planned after its shown time had passed (1000 to 1330): its own group, the gap the same 6 h.
  assert.equal(p.predict.trains.M278.past.mid, 360);
  assert.equal(p.predict.all['6-10'].n, 10);
  assert.equal(Patterns.awayOf(-1), 'past');
});
