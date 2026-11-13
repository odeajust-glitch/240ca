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

test('yardmaster call order: the test site page has "If a yardmaster job went spare now", hidden without live data', () => {
  const fs = require('fs');
  const Build = require('../../docs/board-checker/yardmaster/build');
  const page = fs.readFileSync(Build.SITE_OUT, 'utf8');
  assert.match(page, /<section class="panel" id="now" hidden[^>]*>\s*<header><h2 id="h-now">If a yardmaster job went spare now<\/h2>/);
  assert.match(page, /box\.hidden = !LIVE;/);
  assert.match(page, /LIVE = data\.live && data\.live\.byRank \? data\.live : null;/);
});

// The test site's "YM seniority list" tab (owner, 2026-11-13: "add another tab that just has the YM seinoity list
// as it was last seen"): public/board.html's loadYmList / catsDate / anaYmList run as they are, made-up people.
function ymListTab(stubs = {}) {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const html = fs.readFileSync(path.join(__dirname, '../../public/board.html'), 'utf8');
  const from = html.indexOf('let ymNamesCache = null;');
  const to = html.indexOf('// A5: jobs going spare and who filled them.', from);
  assert.ok(from > 0 && to > from, 'the YM seniority list code is in the page');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ctx = vm.createContext({
    esc, plural: (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`,
    anaTile: (v, l) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`,
    OwnerKey: { headers: () => ({ 'x-owner-key': 'k' }) }, window: {}, ...stubs,
  });
  if (!ctx.window.BoardNames && ctx.BoardNames) ctx.window.BoardNames = ctx.BoardNames;
  vm.runInContext(html.slice(from, to), ctx);
  return { ctx, html };
}

test('YM seniority list tab: the newest read as CATS showed it, in rank order, names by rank, statuses and temporary jobs', () => {
  const vm = require('vm');
  const { ctx } = ymListTab();
  const run = (L) => vm.runInContext(`anaYmList(${JSON.stringify({ ymList: L })})`, ctx);
  assert.equal(vm.runInContext("catsDate('930421')", ctx), '21 Apr 1993');
  assert.equal(vm.runInContext("catsDate('2610251200')", ctx), '25 Oct 2026 1200');
  assert.equal(vm.runInContext("catsDate('151301')", ctx), '151301'); // not a date: as it was
  const row = (rank, extra) => ({ rank, date: '150724', marks: '*+', tags: [], dist: '45', sub: 'SA', awarded: '2610251200', move: 'B', status: '', assignment: '', craft: '', yard: false, description: '', ...extra });
  const L = {
    source: 'cats', read: '2026-11-13T20:46:29.689Z', since: '2026-11-13T20:46:29.689Z', tempRead: { ok: true, rows: 3, pages: 1, temps: 1 },
    list: [row(30, { assignment: 'SDSD05EN', craft: 'EN', description: 'DRAG POOL', status: 'OFF', tags: ['NET'] }),
      row(10, { assignment: 'YSTY01YA', craft: 'YA', yard: true, description: '0630 TOWER S/S JT60' }),
      row(20, { assignment: '', status: 'VACATION', awarded: '', move: '', temp: { assignment: 'YSBY02YA', description: '1900 YDM BLOCK 2' } })],
    byRank: { 10: 'Alder, T', 20: 'Birch, M', 30: 'Cedar, J' },
  };
  const out = run(L);
  const order = [...out.matchAll(/<tr class="nolink"><td><b>(\d+)<\/b> · ([^<]+)/g)].map((m) => `${m[1]} ${m[2].trim()}`);
  assert.deepEqual(order, ['10 Alder, T', '20 Birch, M', '30 Cedar, J']); // seniority order, whatever order the file has
  assert.match(out, /As CATS showed it at the read of <b>Fri, 13 Nov 2026, 15:46<\/b>\./); // Toronto time
  assert.match(out, /Cedar, J <span class="muted">\*\+ \(NET\)<\/span> <span class="chip">OFF<\/span>/);
  assert.match(out, /<b>YSTY01YA<\/b> <span class="muted">0630 TOWER S\/S JT60<\/span>/);
  assert.match(out, /<b>Temporary:<\/b> YSBY02YA · 1900 YDM BLOCK 2/);
  assert.match(out, /1 person on a temporary assignment, shown under their own job/);
  assert.match(out, /<div class="v">3<\/div><div class="l">People on the list/);
  assert.match(out, /<div class="v">1<\/div><div class="l">Holding a yardmaster job/);
  assert.match(out, /<div class="v">2<\/div><div class="l">OFF or VACATION on the list/);
  assert.match(out, /<div class="v">1<\/div><div class="l">On a temporary assignment/);
  assert.match(out, /data-ana2-paged="1"/); // all of it: the test site's cards don't stop at 10
  // A list changed earlier and read again since: when it was first seen this way.
  assert.match(run({ ...L, since: '2026-11-13T05:10:00.000Z' }), /15:46<\/b>, the same since Fri, 13 Nov 2026, 00:10\./);
  // No names opened: by rank, and said so.
  const noNames = run({ ...L, byRank: null });
  assert.match(noNames, /The names didn’t open, so people show by rank/);
  assert.doesNotMatch(noNames, /Alder|Birch|Cedar/);
  // The read with TEMP ASGN Y: not yet, or failed.
  assert.match(run({ ...L, tempRead: null }), /aren’t read yet: the first read with them is the first check after 0000/);
  assert.match(run({ ...L, tempRead: { ok: false } }), /didn’t finish, so no temporary assignments are shown/);
  assert.doesNotMatch(run({ ...L, tempRead: null }), /On a temporary assignment/);
  // Before the laptop's first read: the copy in the code.
  assert.match(run({ ...L, source: 'the 13 Nov list, no names', byRank: null }), /hasn’t read the list from CATS yet/);
  assert.match(run({ error: 'none' }), /isn’t on the site yet/);
  assert.match(run({ error: 'data/ym-list.json: 500' }), /didn’t load \(data\/ym-list\.json: 500\)/);
});

test('YM seniority list tab: the names opened with the crew names key and the owner key, once per publish of the file', async () => {
  const calls = [];
  const file = { at: '2026-11-13T22:55:29.234Z', read: '2026-11-13T20:46:29.689Z', source: 'cats', list: [{ rank: 10 }], names: { v: 1, data: 'locked' } };
  const { ctx } = ymListTab({
    getJSON: async (url) => { calls.push(`get ${url}`); return file; },
    fetch: async (url, o) => { calls.push(`fetch ${url} ${o.headers['x-owner-key']}`); return { ok: true, json: async () => ({ pass: 'p' }) }; },
    BoardNames: { unlockNames: async (locked, pass) => { calls.push(`unlock ${locked.data} ${pass}`); return { byRank: { 10: 'Alder, T' } }; } },
  });
  const a = await require('vm').runInContext('loadYmList()', ctx);
  assert.deepEqual(a.byRank, { 10: 'Alder, T' });
  assert.deepEqual(calls, ['get data/ym-list.json', 'fetch api/crewkey k', 'unlock locked p']);
  await require('vm').runInContext('loadYmList()', ctx); // the same publish: the names already open
  assert.deepEqual(calls.slice(3), ['get data/ym-list.json']);
  const gone = ymListTab({ getJSON: async () => { throw new Error('data/ym-list.json: 404'); } });
  assert.deepEqual({ ...(await require('vm').runInContext('loadYmList()', gone.ctx)) }, { error: 'none' });
});

test('YM seniority list tab: on the test site only, beside Yardmaster jobs, loaded only when open', () => {
  const { html } = ymListTab();
  assert.doesNotMatch(html.match(/const ANA_SECS = \[[^\n]*/)[0], /ymlist/); // the main site never has it
  assert.ok(html.includes("if (PREVIEW && yl < 0) ANA_SECS.push(['ymlist', 'YM seniority list']); else if (!PREVIEW && yl >= 0) ANA_SECS.splice(yl, 1);"));
  assert.ok(html.indexOf("ANA_SECS.push(['ymlist'") > html.indexOf("ANA_SECS.push(['ym', 'Yardmaster jobs'])"));
  assert.ok(html.includes('ymlist: PREVIEW ? anaYmList : anaHome'));
  assert.ok(html.includes("const ymList = PREVIEW && ana.sec === 'ymlist' ? await loadYmList() : null;"));
});
