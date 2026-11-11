const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../lib/board/postings');

// The owner's rules of 2026-11-11 for who may post for which job.
const job = (turn, cc, term = 'T', o = {}) => ({ number: '700000', description: '', turn, cc, yard: /^[YX]/.test(turn), pool: /^[YX]/.test(turn) ? '' : turn.slice(0, 2), term, closes: '2026-11-16', ...o });
const TV = { yardFO: job('YBHS01', 'FO'), yardS1: job('YPRS30', 'S1'), s5: job('S502', 'CO'), a: job('SA04', 'CO'), b: job('SB02', 'CO'), gang: job('SR05', 'CO'), engRoad: job('SD07', 'EN'), engYard: job('YMPS31', 'EN') };
const gets = (who) => Object.entries(TV).filter(([, j]) => P.mayPost(who, j)).map(([k]) => k);

test('job postings: where a person stands, from their turn and craft', () => {
  assert.deepEqual(P.standing('B114'), { craft: 'CO', place: 'spare', pool: 'B1' });
  assert.deepEqual(P.standing('EN05'), { craft: 'EN', place: 'spare', pool: 'EN' });
  assert.deepEqual(P.standing('SR11'), { craft: 'CO', place: 'road', pool: 'SR' });
  assert.deepEqual(P.standing('SA07'), { craft: 'CO', place: 'road', pool: 'SA' });
  assert.deepEqual(P.standing('SD04'), { craft: 'EN', place: 'road', pool: 'SD' });
  assert.deepEqual(P.standing('S105'), { craft: 'EN', place: 'road', pool: 'S1' });
  assert.deepEqual(P.standing('S501', 'CO'), { craft: 'CO', place: 'road', pool: 'S5' });
  assert.deepEqual(P.standing('S501-EN'), { craft: 'EN', place: 'road', pool: 'S5' });
  assert.deepEqual(P.standing('YBHS31', 'FO'), { craft: 'CO', place: 'yard', yardCraft: 'FO', pool: 'YD' });
  assert.deepEqual(P.standing('XSAS02', 'S1'), { craft: 'CO', place: 'yard', yardCraft: 'S1', pool: 'YD' });
  assert.deepEqual(P.standing('YMPS31', 'EN'), { craft: 'EN', place: 'yard', pool: 'YD' });
  // Not ours, or not known: no alert.
  assert.equal(P.standing('YSBY02', 'YA'), null); // a yardmaster
  assert.equal(P.standing('S501-TT'), null); // a trainee's slot
  assert.equal(P.standing('YPRS30'), null); // a yard job with no craft read
  assert.equal(P.standing(''), null);
});

test('job postings: temporary vacancies go to the people who can post for them', () => {
  // Engineers: road or yard, wherever they are.
  for (const t of [['SD04'], ['S105'], ['EN05'], ['YMPS31', 'EN'], ['S501-EN']]) assert.deepEqual(gets(P.standing(...t)), ['engRoad', 'engYard'], t.join(' '));
  // A conductor on the spareboard: the road or the yard.
  assert.deepEqual(gets(P.standing('B114')), ['yardFO', 'yardS1', 's5', 'a', 'b', 'gang']);
  // In the yard: yard only; a foreman only foreman postings, a switchman either.
  assert.deepEqual(gets(P.standing('YBHS31', 'FO')), ['yardFO']);
  assert.deepEqual(gets(P.standing('YPRS30', 'S1')), ['yardFO', 'yardS1']);
  // On the road: road only. A, B and 501/502 can post to the chain gang too.
  for (const t of [['SA07'], ['SB06'], ['S501', 'CO'], ['S502-CO']]) assert.deepEqual(gets(P.standing(...t)), ['s5', 'a', 'b', 'gang'], t.join(' '));
  // The chain gang: 501/502, A and B, not another chain gang turn.
  assert.deepEqual(gets(P.standing('SR11')), ['s5', 'a', 'b']);
  // Nobody known: nothing.
  assert.deepEqual(gets(null), []);
});

test('job postings: permanent ones go by craft and location only (for now)', () => {
  const perm = (who) => [['yardFO', job('YBHS01', 'FO', 'P')], ['yardS1', job('YPRS30', 'S1', 'P')], ['gang', job('SR05', 'CO', 'P')], ['a', job('SA04', 'CO', 'P')], ['eng', job('SD07', 'EN', 'P')]].filter(([, j]) => P.mayPost(who, j)).map(([k]) => k);
  assert.deepEqual(perm(P.standing('YBHS31', 'FO')), ['yardFO', 'yardS1']); // a foreman sees a permanent S1 job too
  assert.deepEqual(perm(P.standing('SR11')), ['gang', 'a']); // and the chain gang a permanent chain gang turn
  assert.deepEqual(perm(P.standing('SA07')), ['gang', 'a']);
  assert.deepEqual(perm(P.standing('B114')), ['yardFO', 'yardS1', 'gang', 'a']); // the spareboard: both
  assert.deepEqual(perm(P.standing('S105')), ['eng']);
});

test('job postings: the alert names the job, whether it is permanent, and when it closes', () => {
  assert.equal(P.postingText(job('YPRS30', 'S1', 'P', { description: '1445 PLANK YDH W/T', closes: '2026-11-12' })), 'YPRS30 S1 (1445 PLANK YDH W/T), permanent, closes Thu, Nov 12');
});
