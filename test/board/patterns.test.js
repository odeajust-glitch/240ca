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
  assert.deepEqual(Patterns.finish({}, []), { board: {}, drift: {}, predict: { trains: {}, all: {} }, spare: { job: {}, wait: {} }, lead: [] });
  // The same train, planned and 6 to 10 h away (0100 → 1000): it went 6 h after the shown time every run.
  const w = p.predict.trains.M278['6-10'];
  assert.deepEqual([w.n, w.mid, w.lo, w.hi, w.held], [10, 360, 360, 360, 10]);
  // Still planned after its shown time had passed (1000 to 1330): its own group, the gap the same 6 h.
  assert.equal(p.predict.trains.M278.past.mid, 360);
  assert.equal(p.predict.all['6-10'].n, 10);
  assert.equal(Patterns.awayOf(-1), 'past');
});

// Owner, 2026-11-10: "can you do the same for the spareboard". A spare's call
// against the job shown beside it, or against its place when nothing shows.
test('patterns: when a spare is called, by the job shown or by its place', () => {
  const pad = (n) => String(n).padStart(2, '0');
  const th = (d) => `${d}${['th', 'st', 'nd', 'rd'][d % 10 > 3 || (d > 10 && d < 14) ? 0 : d % 10]}`;
  const snaps = [];
  for (let d = 1; d <= 10; d++) {
    const day = `2026-10-${pad(d)}`;
    // 0600: B101 is shown a yard job, call 1100 (5 h ahead); B102 is first out on the slow board with nothing showing;
    // B103 is resting but shown a train, call 2000 (14 h ahead).
    snaps.push({ taken: `${day} 0600`, pools: [
      { name: 'Conductor fast board · conductors', turns: [{ turn: 'B101', status: 'available', job: { train: 'YPRS30', call: `${th(d)} 1100`, yard: true } }, { turn: 'B102', status: 'available' }, { turn: 'B103', status: `rest until ${th(d)} 0900`, job: { train: `M39631 ${pad(d)}`, call: `${th(d)} 2000`, yard: false } }, { turn: 'B104', status: 'available', left: true }] },
      { name: 'Conductor slow board · conductors', turns: [{ turn: 'B102', status: 'available' }, { turn: 'B101', status: 'available', job: { train: 'YPRS30', call: `${th(d)} 1100`, yard: true } }] }] });
    // B101 on duty 1300 (called 1100, as shown); B102 on duty 1800 (called 1600, 10 h after the look);
    // B103 on duty 2000 (called 1800, 2 h before the call shown).
    snaps.push({ taken: `${day} 1230`, yardJobs: [{ job: 'YPRS30', onDuty: `${th(d)} 1300`, crew: 'CO B101' }] });
    snaps.push({ taken: `${day} 1730`, yardJobs: [{ job: 'YEBS30', onDuty: `${th(d)} 1800`, crew: 'CO B102' }] });
    snaps.push({ taken: `${day} 1930`, onDuty: [{ train: `M39631 ${pad(d)}`, onDuty: `${th(d)} 2000`, crew: 'CO SB01', backfill: [{ craft: 'CO', job: 'SB01', turn: 'B103' }] }] });
  }
  const { spare } = Patterns.finish(Patterns.collect(snaps), []);
  const yard = spare.job['Conductor|yard|3-6'];
  assert.deepEqual([yard.n, yard.lo, yard.hi, yard.held], [10, 0, 0, 10]);
  assert.equal(spare.job['yard|3-6'].n, 10); // the same without the craft, for a craft with too few of its own
  // A resting spare counts when a job shows beside it.
  const train = spare.job['Conductor|train|10-16'];
  assert.deepEqual([train.n, train.mid, train.likelyLo, train.likelyHi], [10, -120, -120, -120]);
  // Nothing showing: by the better of its two places (2nd on the fast board, 1st on the slow one). One figure a wait.
  const first = spare.wait['Conductor|1st'];
  assert.deepEqual([first.n, first.mid, first.in8], [10, 600, 0]);
  assert.equal(spare.wait['Conductor|2nd'], undefined);
  // A turn that only shows with VIEW TIME is left out; so is a spare never seen working.
  assert.equal(Object.keys(spare.wait).length, 1);
});
