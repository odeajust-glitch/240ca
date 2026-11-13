// Yardmaster Call Order (docs/board-checker/yardmaster): the logic behind the owner's test page
// for who gets a yardmaster job going spare. Made-up people only; the real list stays off the repo.
const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('../../public/board-ym');

const P = (rank, surname, perm, cats = '') => ({ rank, surname, first: 'Test', perm, cats });
const PEOPLE = [
  P(10, 'ALDER', 'YSTY01YA'), // regular YM, Mon to Fri
  P(20, 'BIRCH', 'YSBY02YA'), // regular YM, tower A days, 1900
  P(25, 'CEDAR', 'YSBY03YA'), // regular YM, tower B days, 0700
  P(30, 'DOGWOOD', 'EXYA01YA'), // the yardmaster spare
  P(40, 'ELM', 'S1S102EN'), // engineer
  P(50, 'FIR', 'SRSR10CO'), // road conductor
  P(60, 'GUM', 'YPRS60S1'), // yard helper, 2245, off Fri and Sat
  P(65, 'IVY', 'XSAS01FO'), // relief foreman: Saturday he works YBHS01 at 0800
  P(70, 'HAZEL', 'YMPS60FO'), // yard foreman, 2359
];
const RULES = Y.normalize(Y.startingRules());
// Steps: 1-2 spare, 3-4 yard that day not called yet, 5-6 yard at straight time, 7-8 regular,
// 9-10 4.16, 11-12 5.1, 13 the canvass.
// YSBY02 (BIRCH's job) going spare Saturday 14 Nov 2026 at 1900: called 1700.
const JOB = { job: 'YSBY02', date: '2026-11-14', start: '1900', hours: 12 };
const run = (mod, rules = RULES, job = JOB) => {
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

test('yardmaster call order: the spare, then the yard that day, then the yard at straight time, then regulars on overtime', () => {
  assert.equal(who(run()), 'DOGWOOD 1');
  // Owner, 13 Nov: "Anyone that is working that day the job is going spare, in the yard, hasnt been
  // called yet and isnt on rest will get the job first if no one is on the spareboard". HAZEL's
  // YMPS60 is at 2359 that night, called 2159, after this call: moved up, his own shift not held
  // against him. IVY's YBHS01 started at 0800: already called.
  const noSpare = run((f) => { f[30].status = 'busy'; });
  assert.equal(who(noSpare), 'HAZEL 3');
  assert.match(reason(noSpare, 65, 'yardday'), /already called for YBHS01 Sat 14th 0800/);
  assert.match(reason(noSpare, 20, 'regular'), /holds this job/);
  // Not moved up, the same shift is too close: at the straight-time yard step HAZEL is out.
  assert.match(reason(noSpare, 70, 'yard'), /works YMPS60/);
  // Then "someone in the yard making straight time": GUM is off Fri and Sat with 4 yard shifts
  // since Monday, so Saturday is his 5th. On his 6th, overtime: the senior regular yardmaster.
  assert.equal(who(run((f) => { f[30].status = 'busy'; f[70].status = 'busy'; })), 'GUM 5');
  const sixth = run((f) => { f[30].status = 'busy'; f[70].status = 'busy'; f[60].week = '5'; });
  assert.match(reason(sixth, 60, 'yard'), /would be on overtime: yard shift 6 this week/);
  assert.equal(who(sixth), 'ALDER 7');
});

test('yardmaster call order: moved up from their own shift that day (not called yet, not on rest)', () => {
  // YSBY01 Saturday 0700, called 0500. IVY's YBHS01 0800 is called at 0600: not yet. HAZEL is still on
  // his Friday YMPS60 (2359 to 0759): working. GUM is off that day: not in this step.
  const job = { job: 'YSBY01', date: '2026-11-14', start: '0700', hours: 12 };
  const res = run((f) => { f[30].status = 'busy'; }, RULES, job);
  assert.equal(who(res), 'IVY 3');
  assert.match(reason(res, 70, 'yardday'), /works YMPS60 Fri 13th 2359–0759/);
  assert.equal(res.steps.find((s) => s.st.group === 'yardday').rows.some((x) => x.r.p.rank === 60), false);
  // Moved up is not overtime (it replaces his own shift); on rest at the call, he is skipped.
  assert.equal(who(run((f) => { f[30].status = 'busy'; f[65].lastYard = '2026-11-14T00:00'; }, RULES, job)), 'IVY 3');
  const rest = run((f) => { f[30].status = 'busy'; f[65].freeAt = '2026-11-14T05:30'; }, RULES, job);
  assert.match(reason(rest, 65, 'yardday'), /on rest until Sat 14th 0530 when the call is made/);
  assert.equal(who(rest), 'GUM 5');
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
  assert.equal(who(run(onlyTwo)), 'FIR 9'); // the 4.16 time-and-a-half step, road conductors in
  const yardOnly = run(onlyTwo, Y.normalize({ ...RULES, c416Scope: 'yard' }));
  const canvass = yardOnly.steps[yardOnly.steps.length - 1];
  assert.equal(canvass.st.group, 'any');
  assert.deepEqual(canvass.rows.filter((x) => !x.why).map((x) => x.r.p.surname), ['FIR', 'ELM']); // the engineer last though senior
  // No rule set can put engineers in a step, or the canvass anywhere but last.
  const bad = Y.normalize({ ...RULES, steps: [{ group: 'any', need: 'start', pay: 'ot', on: true }, { group: 'engineer', need: 'call', pay: 'ot', on: true }, ...RULES.steps.slice(0, 2)] });
  assert.deepEqual(bad.steps.map((s) => s.group), ['spare', 'spare', 'any']);
});

test('yardmaster call order: fitting the rules keeps the spare and the yard that day first, and the owner\'s rules', () => {
  const facts = Y.catsFacts(PEOPLE);
  facts[30].status = 'busy';
  facts[70].status = 'busy';
  // An example where the regular yardmaster should come before the yard at straight time.
  const ex = [{ sc: { ...JOB, facts }, expected: 10 }];
  const out = Y.fit(ex, PEOPLE, RULES);
  assert.equal(out.tried, 576);
  assert.equal(out.current, 0);
  assert.equal(out.best[0].score, 1);
  const best = Y.normalize(out.best[0].rules);
  assert.deepEqual(best.steps.slice(0, 3).map((s) => s.group), ['spare', 'spare', 'yardday']);
  assert.ok(best.steps.findIndex((s) => s.group === 'regular') < best.steps.findIndex((s) => s.group === 'yard'));
  assert.deepEqual([best.restSkips, best.otRule, best.leadMin], [true, true, 120]);
});

test('yardmaster call order: "is anyone available on the spareboard" no skips the spare', () => {
  const res = run(null, RULES, { ...JOB, spareboard: 'no' });
  assert.match(reason(res, 30, 'spare'), /nobody available on the spareboard/);
  assert.equal(who(res), 'HAZEL 3');
  assert.equal(who(run(null, RULES, { ...JOB, spareboard: 'yes' })), 'DOGWOOD 1');
});

test('yardmaster call order: a saved check (Yes / No beside the order) agrees or says what does not', () => {
  const res = run();
  const order = res.order.map((o) => o.r.p.rank);
  assert.deepEqual(order.slice(0, 4), [30, 70, 60, 10]); // spare, yard that day, yard at straight time, senior regular
  // Spare right, the yard helper wrong where he is, the regular right.
  const ex = { order, marks: { 30: 'yes', 60: 'no', 10: 'yes' }, notes: { 60: 'should come after the regulars' }, expected: 30 };
  assert.deepEqual(Y.agrees(ex, res), { ok: false, fails: [{ kind: 'still', rank: 60 }] });
  // Rules with the regulars ahead of the yard at straight time: the No has moved, the Yes people keep their order.
  const steps = RULES.steps.filter((s) => s.group !== 'yard');
  steps.splice(steps.findIndex((s) => s.group === 'c416'), 0, { group: 'yard', need: 'call', pay: 'straight', on: true });
  assert.deepEqual(Y.agrees(ex, run(null, Y.normalize({ ...RULES, steps }))), { ok: true, fails: [] });
  // Who should be first, and someone missing from the order.
  assert.deepEqual(Y.agrees({ order, marks: {}, expected: 10 }, res).fails, [{ kind: 'first', got: 30, want: 10 }]);
  assert.deepEqual(Y.agrees({ order, marks: {}, missing: [{ rank: 65, note: '' }] }, res).fails, [{ kind: 'missing', rank: 65 }]);
  // The search fixes it.
  const fit = Y.fit([{ ...ex, sc: { ...JOB, facts: Y.catsFacts(PEOPLE) } }], PEOPLE, RULES);
  assert.deepEqual([fit.current, fit.best[0].score], [0, 1]);
});

test('yardmaster call order: the test site\'s page is the template built, test site only, no names in it', () => {
  const fs = require('fs');
  const path = require('path');
  const Build = require('../../docs/board-checker/yardmaster/build');
  const page = fs.readFileSync(Build.SITE_OUT, 'utf8');
  assert.equal(page, Build.site(), 'public/ym.html is out of date: node docs/board-checker/yardmaster/build.js site');
  assert.match(page, /<script src="board-ym\.js"><\/script>/);
  assert.match(page, /<script src="board-names\.js"><\/script>/);
  assert.match(page, /id="people-data">null</);
  assert.doesNotMatch(page, /fonts\.googleapis/);
  assert.ok(page.includes('/^board-test\\./.test(location.hostname)')); // the test site only
  assert.match(page, /boardOwnerKey/); // and the owner key, as every test-site piece
  const list = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/board-checker/yardmaster/seniority-2026-11-13.json'), 'utf8'));
  assert.equal(list.list.length, 34);
  assert.doesNotMatch(JSON.stringify(list) + page, /"(name|short|surname)"/);
  // The test site links to it from its Yardmaster jobs section only.
  const board = fs.readFileSync(path.join(__dirname, '../../public/board.html'), 'utf8');
  const links = board.match(/href="ym\.html"/g) || [];
  assert.equal(links.length, 1);
  assert.ok(board.indexOf('href="ym.html"') > board.indexOf('function anaYardmaster('));
  assert.ok(board.indexOf('href="ym.html"') < board.indexOf('function anaSpare('));
});

test('yardmaster call order: someone on a temporary assignment works that job at call time to start with', () => {
  const people = [...PEOPLE, { rank: 75, surname: 'JUNIPER', first: 'Test', perm: '', cats: '', temp: { assignment: 'SDSD05EN', turn: 'SD05' } }];
  const f = Y.catsFacts(people);
  assert.equal(f[75].now, 'SDSD05EN');
  assert.equal(f[60].now, '');
  // On an engineer's job for now: the canvass only, by the job at call time.
  const res = Y.decide({ ...JOB, facts: f }, RULES, people);
  const row = res.steps.find((s) => s.st.group === 'any').rows.find((x) => x.r.p.rank === 75);
  assert.equal(row.group, 'engineer');
  assert.equal(row.r.moved, true);
});
