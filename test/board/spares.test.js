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
