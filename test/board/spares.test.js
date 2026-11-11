const test = require('node:test');
const assert = require('node:assert/strict');

// Owner, 2026-11-05 (option A): YPRS60 4th 2245 FO and S1 were on option 5
// while the 3rd 2245 crew hadn't been tied up; it never went spare.
test('a yard job listed only because the earlier crew is not tied up: probably not spare', () => {
  const S = require('../../lib/board/spares');
  const { at } = require('../../lib/board/time');
  const job = (o) => ({ pos: 2, at: at(2026, 11, 4, 22, 45), status: 'PLANNED', train: 'YPRS60', pool: 'YD', cc: 'FO', turn: 'YPRS60', yard: true, st: '', returns: null, ...o });
  const earlier = [{ job: 'YPRS60', onDuty: at(2026, 11, 3, 22, 45), off: at(2026, 11, 4, 6, 45), hours: 8, crew: '' }];
  assert.deepEqual(S.untiedEarlier(job(), earlier), { onDuty: at(2026, 11, 3, 22, 45) });
  assert.equal(S.openJob(job(), earlier), false);
  // Tied up (gone from the yard list): a normal spare job again.
  assert.equal(S.openJob(job(), []), true);
  // ** on it (the holder is off): really spare, whatever the earlier crew.
  assert.equal(S.untiedEarlier(job({ st: '**' }), earlier), null);
  // The same shift on duty is "on duty already", not this.
  assert.equal(S.untiedEarlier(job(), [{ job: 'YPRS60', onDuty: at(2026, 11, 4, 22, 45) }]), null);
  // Crews in town: still "status not known" (working) → still untied; every
  // FO there with a real status (owner, 2026-11-07: YEBS30's FO on a day
  // off, the temporary FO on a hold turn) → tied up, a normal spare job.
  const town = (crews) => [{ pool: 'YARD YPRS60', yard: 'YPRS60', crews }];
  assert.ok(S.untiedEarlier(job(), earlier, town([{ craft: 'FO', status: 'other' }, { craft: 'S1', status: 'rest' }])));
  assert.equal(S.untiedEarlier(job(), earlier, town([{ craft: 'FO', status: 'off' }, { craft: 'FO', status: 'hold', temp: true }])), null);
  assert.equal(S.openJob(job(), earlier, [], town([{ craft: 'FO', status: 'rest' }])), true);
  // No spare is lined up for it.
  const boards = { coFast: [{ turn: 'B136', pos: 1, terminal: 0, working: false }] };
  assert.equal(S.spareJobs([], [job()], boards, earlier, []).size, 0);
  assert.equal(S.spareJobs([], [job()], boards, [], []).get('B136').train, 'YPRS60');
});

// Owner, 2026-11-11: option 5 listed only the FO of YFXS01 (an extra job, nobody
// on its turn) and both an FO and an S1 were called. Three spares went that
// afternoon (YFXS01 FO and S1, YEBS30 S1), so YINS60 fell to the fourth.
test('an extra yard job: the crafts option 5 does not list are predicted, and count on the spareboard', () => {
  const S = require('../../lib/board/spares');
  const { at } = require('../../lib/board/time');
  const job = (train, cc, h, m, o = {}) => ({ pos: 1, at: at(2026, 11, 11, h, m), status: 'PLANNED', train, pool: 'YD', cc, turn: train, yard: true, st: '', returns: null, ...o });
  const listed = [job('YFXS01', 'FO', 15, 30), job('YEBS30', 'S1', 16, 0, { st: '**' }), job('YINS60', 'S1', 23, 30, { st: '**' })];
  const town = [{ pool: 'YARD YEBS30', yard: 'YEBS30', crews: [{ craft: 'S1', status: 'off' }, { craft: 'FO', status: 'rested' }] }];
  assert.equal(S.isExtraYard('YFXS01', town), true);
  assert.equal(S.isExtraYard('YMXS02', town), true);
  assert.equal(S.isExtraYard('YEBS30', town), false); // a regular job
  assert.equal(S.isExtraYard('YFLS01', town), false);
  const extra = S.extraYardJobs(listed, town);
  assert.deepEqual(extra.map((j) => [j.train, j.cc, j.at, j.yard, j.expected, j.extra]), [['YFXS01', 'S1', at(2026, 11, 11, 15, 30), true, true, true]]);
  assert.match(extra[0].why, /lists only the FO of YFXS01, an extra job/);
  assert.deepEqual(S.expectedJobs([], listed, town).map((j) => `${j.train} ${j.cc}`), ['YFXS01 S1']);
  // The spareboard: three jobs before YINS60, so it goes to the fourth spare.
  const fast = ['B134', 'B133', 'B130', 'B115'].map((turn, i) => ({ turn, pos: i + 1 }));
  const jobs = S.spareJobs([], listed, { coFast: fast });
  assert.deepEqual([...jobs].map(([turn, j]) => `${turn} ${j.train} ${j.cc}`), ['B134 YFXS01 FO', 'B133 YFXS01 S1', 'B130 YEBS30 S1', 'B115 YINS60 S1']);
  // Both crafts listed: nothing added. A YMX job takes an engineer too.
  assert.deepEqual(S.extraYardJobs([...listed, job('YFXS01', 'S1', 15, 30)], town), []);
  assert.deepEqual(S.extraYardJobs([job('YMXS01', 'FO', 8, 0)], town).map((j) => j.cc), ['EN', 'S1']);
  // Someone under it in the crews in town: not an extra job after all.
  assert.deepEqual(S.extraYardJobs(listed, [{ pool: 'YARD YFXS01', yard: 'YFXS01', crews: [{ craft: 'S1', status: 'rested' }] }]), []);
  // A regular job with one craft listed is left alone.
  assert.deepEqual(S.extraYardJobs([job('YEBS30', 'S1', 16, 0)], town), []);
});
