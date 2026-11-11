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

// The account way (owner, 2026-11-11): the name code and the choices are on the
// member's account; the alerts go to every device signed in to it.
test('job posting alerts: a new posting once, to an account whose person may post for it', () => {
  const { personHash } = require('../../lib/board/people');
  const noon = (d) => P.closeAt(d);
  assert.equal(new Date(noon('2026-11-12')).toISOString(), '2026-11-12T17:00:00.000Z'); // 1200 in Toronto, winter
  assert.equal(new Date(noon('2026-07-12')).toISOString(), '2026-07-12T16:00:00.000Z'); // and in summer
  const now = Date.parse('2026-11-11T22:00:00Z');
  // The checker's memory of where people stand, by the hash of their code.
  let people = P.rememberPeople({}, [{ h: personHash('COBD'), turn: 'SR11', own: true, craft: 'CO' }, { h: personHash('BRW1'), turn: 'YBHS31', own: true, craft: 'FO' }, { h: personHash('JUOD'), turn: 'S501', own: false, craft: 'CO' }], now);
  assert.deepEqual(Object.keys(people).length, 2); // a turn that is not their own is not a position
  const gang = { code: 'COBD', postings: { on: true, remind: {} } };
  const up = [job('SR05', 'CO', 'T', { number: '785550', description: 'CDR CHAIN GANG' }), job('S502', 'CO', 'T', { number: '786099', description: '502/501 CREW B', closes: '2026-11-14' })];
  // On for the first time: what is already up is not sent.
  let r = P.accountEvents(gang, up, people, null, personHash, now);
  assert.deepEqual(r.events, []);
  assert.deepEqual(Object.keys(r.told.jobs), ['786099']); // the 502 job they could bid, noted as known; not the chain gang turn
  // An hour later two more go up: the A pool turn is theirs to bid, the yard job is not.
  const more = [...up, job('SA04', 'CO', 'T', { number: '786200', description: 'A POOL', closes: '2026-11-18' }), job('YBHS01', 'FO', 'T', { number: '786201' })];
  let told = r.told;
  r = P.accountEvents(gang, more, people, told, personHash, now + 3600000);
  assert.deepEqual(r.events.map((e) => [e.kind, e.number, e.text, e.url]), [['posting', '786200', 'Job posting: SA04 CO (A POOL), temporary, closes Wed, Nov 18 at 1200.', './#postings=786200']]);
  // Not marked until a device got it: it is tried again.
  assert.equal(P.accountEvents(gang, more, people, r.told, personHash, now + 3900000).events.length, 1);
  P.sent(r.told, r.events[0], now + 3600000);
  assert.deepEqual(P.accountEvents(gang, more, people, r.told, personHash, now + 7200000).events, []);
  // The yard foreman hears about the yard foreman job, not the road ones.
  const fo = { code: 'BRW1', postings: { on: true, remind: {} } };
  const first = P.accountEvents(fo, up, people, null, personHash, now);
  assert.deepEqual(P.accountEvents(fo, more, people, first.told, personHash, now + 3600000).events.map((e) => e.number), ['786201']);
  // Not seen this check: their last known position still counts.
  people = P.rememberPeople(people, [], now + 86400000);
  assert.equal(people[personHash('COBD')].turn, 'SR11');
  // No code, alerts off, or a person the boards never showed: nothing.
  assert.deepEqual(P.accountEvents({ code: '', postings: { on: true, remind: {} } }, more, people, null, personHash, now).told, null);
  assert.deepEqual(P.accountEvents({ code: 'COBD', postings: { on: false, remind: {} } }, more, people, null, personHash, now).told, null);
  assert.deepEqual(P.accountEvents({ code: 'ZZZZ', postings: { on: true, remind: {} } }, more, people, { since: 1, jobs: {} }, personHash, now).events, []);
});

test('job posting alerts: a reminder the chosen hours before 1200 on the closing date, once', () => {
  const { personHash } = require('../../lib/board/people');
  const people = P.rememberPeople({}, [{ h: personHash('COBD'), turn: 'SR11', own: true, craft: 'CO' }], 0);
  const up = [job('S502', 'CO', 'T', { number: '786099', description: '502/501 CREW B', closes: '2026-11-14' })];
  const acc = { code: 'COBD', postings: { on: false, remind: { 786099: 24, 111111: 6 } } }; // reminders work with new-posting alerts off
  const close = P.closeAt('2026-11-14');
  let r = P.accountEvents(acc, up, people, null, personHash, close - 30 * 3600000);
  assert.deepEqual(r.events, []); // 30 h before: not yet
  r = P.accountEvents(acc, up, people, r.told, personHash, close - 23.5 * 3600000);
  assert.deepEqual(r.events.map((e) => [e.kind, e.text]), [['postingRemind', 'Reminder: the posting for S502 CO (502/501 CREW B) closes in about 24 hours, at 1200 on Sat, Nov 14.']]);
  P.sent(r.told, r.events[0]);
  assert.deepEqual(P.accountEvents(acc, up, people, r.told, personHash, close - 3600000).events, []); // once
  assert.deepEqual(P.accountEvents(acc, up, people, null, personHash, close + 60000).events, []); // closed: nothing
});
