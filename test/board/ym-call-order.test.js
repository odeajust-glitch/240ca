// Yardmaster Call Order (docs/board-checker/yardmaster): the logic behind the owner's test page
// for who gets a yardmaster job going spare. Made-up people only; the real list stays off the repo.
const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('../../docs/board-checker/yardmaster/call-order-logic');

const P = (rank, surname, perm, cats = '') => ({ rank, surname, first: 'Test', perm, cats });
const PEOPLE = [
  P(10, 'ALDER', 'YSTY01YA'), // regular YM, Mon to Fri
  P(20, 'BIRCH', 'YSBY02YA'), // regular YM, tower A days, 1900
  P(25, 'CEDAR', 'YSBY03YA'), // regular YM, tower B days, 0700
  P(30, 'DOGWOOD', 'EXYA01YA'), // the yardmaster spare
  P(40, 'ELM', 'S1S102EN'), // engineer
  P(50, 'FIR', 'SRSR10CO'), // road conductor
  P(60, 'GUM', 'YPRS60S1'), // yard helper, 2245, off Fri and Sat
  P(70, 'HAZEL', 'YMPS60FO'), // yard foreman, 2359
];
const RULES = Y.normalize(Y.startingRules());
// YSBY02 (BIRCH's job) going spare Saturday 14 Nov 2026 at 1900: called 1700.
const run = (mod, rules = RULES, job = { job: 'YSBY02', date: '2026-11-14', start: '1900', hours: 12 }) => {
  const facts = Y.catsFacts(PEOPLE);
  if (mod) mod(facts);
  return Y.decide({ ...job, facts }, rules, PEOPLE);
};
const who = (res) => (res.pick ? `${res.pick.r.p.surname} ${res.pick.i + 1}` : 'nobody');
const reason = (res, rank, group) => res.steps.find((s) => s.st.group === group).rows.find((x) => x.r.p.rank === rank).why;

test('yardmaster call order: the tower rotation and the jobs a date runs', () => {
  assert.equal(Y.towerOn('2026-11-14'), 'a');
  assert.equal(Y.towerOn('2026-11-16'), 'b');
  assert.equal(Y.YA_JOBS.YSBY02.runs('2026-11-14'), true);
  assert.equal(Y.YA_JOBS.YSTY01.runs('2026-11-14'), false); // Saturday
  assert.deepEqual(['EXYA01YA', 'YSBY02YA', 'S1S102EN', 'SRSR10CO', 'YPRS60S1', 'SD05', ''].map(Y.groupOf), ['spare', 'regular', 'engineer', 'c416', 'c416', 'engineer', 'none']);
});

test('yardmaster call order: the spare first, then someone in the yard at straight time, then regular yardmasters on overtime', () => {
  assert.equal(who(run()), 'DOGWOOD 1');
  // Owner, 13 Nov: the regular yardmasters on their rest day "will get paid overtime, it will goto
  // someone in the yard making straight time first". GUM is off Fri and Sat with 4 yard shifts
  // since Monday: Saturday is his 5th, straight time.
  const noSpare = run((f) => { f[30].status = 'busy'; });
  assert.equal(who(noSpare), 'GUM 3');
  assert.match(reason(noSpare, 20, 'regular'), /holds this job/);
  // HAZEL's own YMPS60 starts 2359 that night: too close.
  assert.match(reason(noSpare, 70, 'yard'), /works YMPS60/);
  // With GUM on his 6th yard shift: overtime, so the senior regular yardmaster at time and a half.
  const sixth = run((f) => { f[30].status = 'busy'; f[60].week = '5'; });
  assert.match(reason(sixth, 60, 'yard'), /would be on overtime: yard shift 6 this week/);
  assert.equal(who(sixth), 'ALDER 5');
});

test('yardmaster call order: booked rest at the call skips, and overtime is 8 h from the last yard shift', () => {
  // Owner: "We book our rest so if someone is on rest when the call it made they are skipped".
  const rest = run((f) => { f[30].freeAt = '2026-11-14T17:30'; });
  assert.match(reason(rest, 30, 'spare'), /on rest until Sat 14th 1730 when the call is made/);
  assert.notEqual(who(rest), 'DOGWOOD 2'); // not saved by the on-time relief step either
  // 8 h exactly is straight time; a minute less is overtime.
  assert.equal(who(run((f) => { f[30].lastYard = '2026-11-14T11:00'; })), 'DOGWOOD 1');
  const ot = run((f) => { f[30].lastYard = '2026-11-14T11:01'; });
  assert.match(reason(ot, 30, 'spare'), /would be on overtime: last yard shift ended Sat 14th 1101/);
  // With the overtime rule off, the spare takes it.
  assert.equal(who(run((f) => { f[30].lastYard = '2026-11-14T11:01'; }, Y.normalize({ ...RULES, otRule: false }))), 'DOGWOOD 1');
});

test('yardmaster call order: engineers only in the canvass, after everyone else (a hard rule)', () => {
  const onlyTwo = (f) => { for (const k of Object.keys(f)) f[k].status = 'off'; f[40].status = 'available'; f[50].status = 'available'; };
  assert.equal(who(run(onlyTwo)), 'FIR 7'); // the 4.16 time-and-a-half step, road conductors in
  const yardOnly = run(onlyTwo, Y.normalize({ ...RULES, c416Scope: 'yard' }));
  const canvass = yardOnly.steps[yardOnly.steps.length - 1];
  assert.equal(canvass.st.group, 'any');
  assert.deepEqual(canvass.rows.filter((x) => !x.why).map((x) => x.r.p.surname), ['FIR', 'ELM']); // the engineer last though senior
  // No rule set can put engineers in a step, or the canvass anywhere but last.
  const bad = Y.normalize({ ...RULES, steps: [{ group: 'any', need: 'start', pay: 'ot', on: true }, { group: 'engineer', need: 'call', pay: 'ot', on: true }, ...RULES.steps.slice(0, 2)] });
  assert.deepEqual(bad.steps.map((s) => s.group), ['spare', 'spare', 'any']);
});

test('yardmaster call order: fitting the rules to examples keeps the spare first and the owner\'s rules', () => {
  const facts = Y.catsFacts(PEOPLE);
  facts[30].status = 'busy';
  // An example where the regular yardmaster should come before the yard.
  const ex = [{ sc: { job: 'YSBY02', date: '2026-11-14', start: '1900', hours: 12, facts }, expected: 10 }];
  const out = Y.fit(ex, PEOPLE, RULES);
  assert.equal(out.tried, 576);
  assert.equal(out.current, 0);
  assert.equal(out.best[0].score, 1);
  const best = Y.normalize(out.best[0].rules);
  assert.equal(best.steps[0].group, 'spare');
  assert.ok(best.steps.findIndex((s) => s.group === 'regular') < best.steps.findIndex((s) => s.group === 'yard'));
  assert.deepEqual([best.restSkips, best.otRule, best.leadMin], [true, true, 120]);
});

test('yardmaster call order: "is anyone available on the spareboard" no skips the spare', () => {
  const res = run(null, RULES, { job: 'YSBY02', date: '2026-11-14', start: '1900', hours: 12, spareboard: 'no' });
  assert.match(reason(res, 30, 'spare'), /nobody available on the spareboard/);
  assert.equal(who(res), 'GUM 3');
  assert.equal(who(run(null, RULES, { job: 'YSBY02', date: '2026-11-14', start: '1900', hours: 12, spareboard: 'yes' })), 'DOGWOOD 1');
});

test('yardmaster call order: a saved check (Yes / No beside the order) agrees or says what does not', () => {
  const res = run();
  const order = res.order.map((o) => o.r.p.rank);
  assert.deepEqual(order.slice(0, 3), [30, 60, 10]); // spare, the yard at straight time, the senior regular
  // Spare right, the yard helper wrong where he is, the regular right.
  const ex = { order, marks: { 30: 'yes', 60: 'no', 10: 'yes' }, notes: { 60: 'should come after the regulars' }, expected: 30 };
  assert.deepEqual(Y.agrees(ex, res), { ok: false, fails: [{ kind: 'still', rank: 60 }] });
  // Rules with the regulars ahead of the yard: the No has moved, the Yes people keep their order.
  const steps = RULES.steps.filter((s) => s.group !== 'yard');
  steps.splice(steps.findIndex((s) => s.group === 'c416'), 0, { group: 'yard', need: 'call', pay: 'straight', on: true });
  const moved = run(null, Y.normalize({ ...RULES, steps }));
  assert.deepEqual(Y.agrees(ex, moved), { ok: true, fails: [] });
  // Who should be first, and someone missing from the order.
  assert.deepEqual(Y.agrees({ order, marks: {}, expected: 10 }, res).fails, [{ kind: 'first', got: 30, want: 10 }]);
  assert.deepEqual(Y.agrees({ order, marks: {}, missing: [{ rank: 70, note: '' }] }, res).fails, [{ kind: 'missing', rank: 70 }]);
  // The search fixes it.
  const fit = Y.fit([{ ...ex, sc: { job: 'YSBY02', date: '2026-11-14', start: '1900', hours: 12, facts: Y.catsFacts(PEOPLE) } }], PEOPLE, RULES);
  assert.deepEqual([fit.current, fit.best[0].score], [0, 1]);
});
