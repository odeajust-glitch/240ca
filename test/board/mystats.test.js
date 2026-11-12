const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const MyStats = require('../../public/board-mystats');
const Files = require('../../lib/board/mystats');
const BoardTurns = require('../../public/board-turns');

// Owner, 2026-11-11: each member's own statistics. Made-up turns and trains;
// a person is a hash, as on the site.
const ME = 'a'.repeat(16);
const order = (train, seen, onDutyAt, station, crew, extra = {}) => ({ train, first: seen, last: seen, onDuty: `at ${station}, ${onDutyAt}`, onDutySeen: seen, onDutyAt, station, crew, job: '', workedBy: '', yard: false, ...extra });
function world() {
  const stretches = [
    { turn: 'SR03', own: true, from: '2026-10-24 0400', to: '2026-11-02 2254' },
    { turn: 'S501', own: true, from: '2026-11-03 0509', to: '2026-11-11 1923', craft: 'CO' },
  ];
  const turns = {
    SR03: {
      changes: [
        { taken: '2026-10-28 0131', text: 'Chain Gang (SR) position 007: rest until 28th 1040' },
        { taken: '2026-10-28 1808', text: 'Chain Gang (SR) position 005: available' },
        { taken: '2026-10-29 0052', text: 'Chain Gang (SR) position 001: available · Projected for DHT065C 29 (ORD 29th 0400): Chain Gang: SR03 + SD06' },
        { taken: '2026-10-29 0155', text: 'Chain Gang (SR) position 999: out working on DHT065C' },
      ],
      orders: [
        order('E27861 26', '2026-10-26 1848', '26th 2045', 'SARNIA', 'EN SD06 · CO SR03'),
        order('Z14931 27', '2026-10-27 1447', '27th 1630', 'TORONTO', 'EN SD06 · CO SR03'),
        order('DHT065C 29', '2026-10-29 0155', '29th 0400', 'SARNIA', 'EN SD06 · CO SR03'),
        order('M38331 29', '2026-10-29 1601', '29th 1800', 'TORONTO', 'EN SD06 · CO SR03'),
        // Before they were on the turn, and one a spare worked for it: neither is theirs.
        order('M30241 20', '2026-10-20 0900', '20th 1100', 'SARNIA', 'EN SD01 · CO SR03'),
        order('X39291 30', '2026-10-30 0900', '30th 1100', 'SARNIA', 'EN SD02 · CO B119', { workedBy: 'B119' }),
      ],
      rests: [
        { seen: '2026-10-27 0501', kind: 'Rest', until: '27th 1229', where: 'Toronto bunkhouse' },
        { seen: '2026-10-28 0131', kind: 'Rest', until: '28th 1040', where: 'Chain Gang (SR)' },
        { seen: '2026-10-29 0649', kind: 'Rest', until: '29th 1429', where: 'Toronto bunkhouse' },
      ],
      spares: [{ seen: '2026-10-30 0309', last: '2026-10-30 0339', text: '** goes spare, return 30th 1109' }],
    },
    S501: {
      changes: [],
      orders: [
        order('L50231 04', '2026-11-04 0049', '4th 0245', 'SARNIA', 'EN S501 · CO S501 · TT S501'),
        order('L50131 04', '2026-11-04 1920', '4th 2115', 'GARNET', 'EN S501 · CO S501 · TT S501'),
        // The engineer's trip a spare covered in the conductor's craft is not the conductor's.
        order('L50231 06', '2026-11-06 0049', '6th 0245', 'SARNIA', 'EN S501 · CO B111', { coveredCraft: 'CO' }),
      ],
      rests: [{ seen: '2026-11-04 1111', kind: 'Rest', until: '4th 1901', where: '501/502 (S5)', craft: 'CO' }, { seen: '2026-11-04 1111', kind: 'Rest', until: '4th 2000', where: '501/502 (S5)', craft: 'EN' }],
      spares: [],
    },
  };
  const trains = [
    { id: 'E27861 26', onDuty: '2026-10-26 2045', firstSeen: '2026-10-25 1612', firstPlan: '2026-10-26 1610', firstOrder: '2026-10-26 2100', planChanges: 1, orderChanges: 0 },
    { id: 'DHT065C 29', onDuty: '2026-10-29 0400', firstSeen: '2026-10-28 1933', firstOrder: '2026-10-29 0400', planChanges: 0, orderChanges: 0, deadhead: true },
    { id: 'E27861 26', onDuty: '2026-09-26 2045', firstPlan: '2026-09-26 0100' }, // last month's train of the same name
  ];
  const offs = {
    'E27861 26': { on: '2026-10-26 2045', off: '2026-10-27 0429', how: 'bunkhouse' },
    'Z14931 27': { on: '2026-10-27 1630', off: '2026-10-28 0040', how: 'history' },
    'DHT065C 29': { on: '2026-10-29 0400', off: '2026-10-29 0629', how: 'bunkhouse' },
    'M38331 29': { on: '2026-10-29 1800', off: '2026-10-30 0245', how: 'call board' },
    'L50231 04': { on: '2026-11-04 0245', off: '2026-11-04 1101', how: 'bunkhouse' },
    'L50131 04': { on: '2026-11-04 2115', off: '2026-11-05 0640', how: 'history' },
  };
  const sleep = [
    { turn: 'SR03', train: 'E27861 26', onDuty: '2026-10-26 2045', expected: '2026-10-26 1415', firstCall: '2026-10-26 1355', call: '2026-10-26 1845', off: 270, shifts: [1, 2, 3] },
    { turn: 'S501-CO', train: 'L50231 04', onDuty: '2026-11-04 0245', expected: '2026-11-04 0145', firstCall: '2026-11-04 0145', call: '2026-11-04 0045', off: -60, shifts: [1] },
    { turn: 'S501-EN', train: 'L50131 04', onDuty: '2026-11-04 2115', expected: '2026-11-04 1915', firstCall: '2026-11-04 1915', call: '2026-11-04 2015', off: 60, shifts: [] }, // the engineer's
    { turn: 'S501-CO', train: 'L50131 04', onDuty: '2026-11-04 2115', expected: '2026-11-04 1915', firstCall: '2026-11-04 1915', call: '2026-11-04 1915', off: 0, shifts: [], short: true },
  ];
  const runLog = [
    { train: 'Z14931 29', passed: 'SR03', went: 'SR08', result: 'explained', reason: 'went on DHT065C 29', seen: '2026-10-29 1514', craft: 'crew' },
    { train: 'L50231 05', passed: 'S501', went: 'S502', result: 'likely', seen: '2026-11-05 0054', craft: 'CO' },
    { train: 'L50231 05', passed: 'S501', went: 'S502', result: 'likely', seen: '2026-11-05 0054', craft: 'EN' },
    { train: 'M1 01', passed: 'SR03', went: 'SR04', result: 'likely', seen: '2026-11-05 0054', craft: 'CO' }, // after they left SR03
  ];
  const stale = [
    { train: 'E27861 26', from: '2026-10-26 1700', crew: 'SR03 + SD06', minutes: 87, end: 'ordered' },
    { train: 'M9 09', from: '2026-11-09 1700', crew: 'S501 + S501', minutes: 12, end: 'stale' }, // still running: left out
  ];
  return { stretches, turns, trains, offs, sleep, runLog, stale, resets: [{ at: '2026-10-26 0559', kind: 'natural' }, { at: '2026-11-03 0755', kind: 'natural' }, { at: '2026-11-02 0100', kind: 'natural', possible: true }], due: { turn: 'S501-CO', dueText: '11th 0245', level: '' } };
}

test('my stats: a person\'s record holds only what they worked, with off duty, the call and who with', () => {
  const rec = MyStats.build(world());
  assert.deepEqual(rec.trips.map((t) => t.id), ['E27861 26', 'Z14931 27', 'DHT065C 29', 'M38331 29', 'L50231 04', 'L50131 04']);
  assert.deepEqual(rec.trips[0], { id: 'E27861 26', at: '2026-10-26 2045', turn: 'SR03', st: 'SARNIA', off: '2026-10-27 0429', with: ['EN SD06'], plan: '2026-10-26 1610', pc: 1, ord: '2026-10-26 2100', oc: 0, seen: '2026-10-25 1612',
    call: { exp: '2026-10-26 1415', first: '2026-10-26 1355', got: '2026-10-26 1845', off: 270, n: 3 } });
  assert.equal(rec.trips[2].dh, true);
  assert.equal(rec.trips[3].est, true); // off duty from the Call Board is an estimate
  // 501/502: their craft's call and rest, and the engineer (not the trainee) as who they worked with.
  const l501 = rec.trips[5];
  assert.deepEqual([l501.craft, l501.with, l501.call.off, l501.call.short], ['CO', ['EN S501'], 0, true]);
  assert.deepEqual(rec.rests.filter((r) => r.turn === 'S501').map((r) => r.until), ['2026-11-04 1901']);
  assert.deepEqual(rec.rests[0], { seen: '2026-10-27 0501', kind: 'Rest', until: '2026-10-27 1229', where: 'Toronto bunkhouse', turn: 'SR03' });
  assert.deepEqual(rec.pos, [['2026-10-28 0131', 7, 'Chain Gang (SR)'], ['2026-10-28 1808', 5, 'Chain Gang (SR)'], ['2026-10-29 0052', 1, 'Chain Gang (SR)'], ['2026-10-29 0155', 999, 'Chain Gang (SR)']]);
  assert.deepEqual(rec.turns, [{ turn: 'SR03', own: true, from: '2026-10-24', to: '2026-11-02' }, { turn: 'S501', own: true, craft: 'CO', from: '2026-11-03', to: '2026-11-11' }]);
  // Passed over: once per train, and only while they were on that turn.
  assert.deepEqual(rec.passed.map((x) => [x.train, x.result]), [['Z14931 29', 'explained'], ['L50231 05', 'likely']]);
  assert.deepEqual(rec.stale, [{ from: '2026-10-26 1700', train: 'E27861 26', min: 87 }]);
  assert.deepEqual([rec.from, rec.to, rec.due.dueText], ['2026-10-24', '2026-11-11', '11th 0245']);
  assert.equal(JSON.stringify(rec).includes(ME), false);
});

test('my stats: the record does not change from one check to the next unless something happened', () => {
  const w = world();
  const a = MyStats.build(w);
  w.stretches[1].to = '2026-11-11 1930'; // seen again seven minutes later
  assert.deepEqual(MyStats.build(w), a);
});

test('my stats: agrees with Turn History\'s person search about what someone worked', () => {
  const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
  const at = html.indexOf('function personHistory(');
  // eslint-disable-next-line no-eval, no-unused-vars
  const personHistory = (0, eval)(`(function (BoardTurns) { return (${html.slice(at, html.indexOf('\n}\n', at) + 2)}); })`)(BoardTurns);
  const w = world();
  w.stretches.push({ turn: 'SR07', own: false, from: '2026-11-01 0900', to: '2026-11-01 1500' }, { turn: 'S502-TT', own: true, from: '2026-10-20 0000', to: '2026-10-22 0000' });
  w.turns.SR03.orders.push(order('M11111 01', '2026-11-01 1000', '1st 1200', 'SARNIA', 'EN SD09 · CO SR07', { job: 'SR07' }));
  w.turns.S502 = { changes: [], rests: [], spares: [], orders: [order('L50231 21', '2026-10-21 0049', '21st 0245', 'SARNIA', 'EN S502 · CO S502 · TT S502')] };
  const page = personHistory(w.stretches, w.turns, () => 'CO');
  const mine = MyStats.personRecord(w.stretches, w.turns, () => 'CO');
  const strip = (o) => String(o.train).replace(/ \(.*$/, '');
  assert.deepEqual(mine.orders.map(strip), page.orders.map(strip));
  assert.ok(mine.orders.some((o) => o.train === 'M11111 01') && mine.orders.some((o) => o.trainee === 'TT'));
  assert.deepEqual(mine.rests.map((r) => r.seen), page.rests.map((r) => r.seen));
  assert.deepEqual(mine.spares.map((r) => r.seen), page.spares.map((r) => r.seen));
});

test('my stats: what was kept before the site\'s first day stays, the rest is the new build\'s', () => {
  const w = world();
  const first = MyStats.build(w);
  assert.deepEqual(MyStats.merge(null, first, '2026-10-16'), first);
  assert.deepEqual(MyStats.merge(first, first, '2026-10-16'), first); // the same build twice changes nothing
  // A month on the site has dropped October: only November's trips are in the build.
  const later = { ...w, stretches: [{ turn: 'S501', own: true, from: '2026-11-03 0509', to: '2026-12-02 1200', craft: 'CO' }], resets: [{ at: '2026-11-03 0755', kind: 'natural' }] };
  later.turns = { ...w.turns, S501: { ...w.turns.S501, orders: [...w.turns.S501.orders, order('L50231 01', '2026-12-01 0049', '1st 0245', 'SARNIA', 'EN S501 · CO S501')] } };
  const joined = MyStats.merge(first, MyStats.build(later), '2026-11-03');
  assert.deepEqual(joined.trips.map((t) => t.id), ['E27861 26', 'Z14931 27', 'DHT065C 29', 'M38331 29', 'L50231 04', 'L50131 04', 'L50231 01']);
  assert.deepEqual(joined.turns, [{ turn: 'SR03', own: true, from: '2026-10-24', to: '2026-11-02' }, { turn: 'S501', own: true, craft: 'CO', from: '2026-11-03', to: '2026-12-02' }]);
  assert.deepEqual(joined.resets.map((x) => x.at), ['2026-10-26 0559', '2026-11-02 0100', '2026-11-03 0755']);
  assert.deepEqual([joined.from, joined.to], ['2026-10-24', '2026-12-02']);
  // Not seen at all in the newest build: kept as it was. Past the keep limit: dropped.
  assert.deepEqual(MyStats.merge(first, null, '2026-12-20').trips, first.trips);
  assert.deepEqual(MyStats.merge(joined, MyStats.build(later), '2026-11-03', { keepDays: 20 }).trips.map((t) => t.id), ['L50231 04', 'L50131 04', 'L50231 01']);
});

test('my stats: the numbers', () => {
  const rec = MyStats.build(world());
  const s = MyStats.stats(rec);
  assert.equal(s.trips.length, 6);
  assert.equal(s.done, 3); // three round trips
  assert.deepEqual(s.tours.map((x) => [x.out.id, x.back.id, x.held, x.away]), [['E27861 26', 'Z14931 27', 721, 1675], ['DHT065C 29', 'M38331 29', 691, 1365], ['L50231 04', 'L50131 04', 614, 1675]]);
  assert.deepEqual(s.held.places.map((p) => [p.place, p.n, p.avg]), [['TORONTO', 2, 706], ['GARNET', 1, 614]]);
  assert.equal(s.held.over14, 0);
  assert.equal(s.duty.total, 464 + 490 + 149 + 525 + 496 + 565);
  assert.equal(s.duty.est, 1);
  assert.deepEqual([s.duty.max.id, s.duty.min.id], ['L50131 04', 'DHT065C 29']);
  assert.equal(s.home.n, 2); // home after each of the first two round trips
  assert.equal(s.home.min, 1640); // off 28th 0040 → on duty 29th 0400
  // The calendar runs over every day they were seen, worked or not.
  assert.deepEqual([s.days.length, s.days[0].date, s.days[s.days.length - 1].date], [19, '2026-10-24', '2026-11-11']);
  assert.deepEqual(s.days.find((d) => d.date === '2026-10-27'), { date: '2026-10-27', wd: 2, duty: 269 + 450, night: 269, starts: 1, seen: true });
  assert.equal(s.worked, 7);
  assert.equal(s.weekdays[6].worked, 0); // no Saturday
  assert.equal(s.hours.out[20] + s.hours.out[4] + s.hours.out[2], 3);
  assert.equal(s.hours.home[16] + s.hours.home[18] + s.hours.home[21], 3);
  assert.equal(s.nightCalls, 2); // 0200 and 0045
  // Calls: the one slept on against the one that came.
  assert.deepEqual([s.calls.n, s.calls.ok, s.calls.warn, s.calls.bad, s.calls.later, s.calls.earlier, s.calls.exact, s.calls.changes, s.calls.worst.id], [3, 1, 1, 1, 1, 1, 1, 4, 'E27861 26']);
  assert.deepEqual([s.lineup.plan.n, s.lineup.plan.worst, s.lineup.order.n, s.lineup.order.changed], [1, 275, 2, 0]);
  // The call after a rest away from home; and the climb up the board.
  assert.deepEqual([s.rest.afterAway.n, s.rest.afterAway.least], [3, 14]);
  assert.deepEqual(s.board.list.map((c) => [c.id, c.from, c.to]), [['DHT065C 29', 7, 1]]);
  assert.deepEqual(s.resets.map((x) => [x.at, x.trips]), [['2026-10-26 0559', null], ['2026-11-03 0755', 4]]);
  assert.deepEqual(s.byTurn.map((t) => [t.turn, t.trips]), [['SR03', 4], ['S501 conductor', 2]]);
  assert.deepEqual(s.partners[0], ['EN SD06', 4]);
  assert.deepEqual([s.flags.likely, s.flags.explained, s.flags.stale.length], [1, 1, 1]);
  // Only the dates picked.
  const nov = MyStats.stats(rec, { from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual([nov.trips.length, nov.done, nov.days[0].date, nov.byTurn.length], [2, 1, '2026-11-01', 1]);
  assert.deepEqual(MyStats.rangeOf('30', rec), { from: '2026-10-13', to: '2026-11-11' });
  assert.deepEqual(MyStats.rangeOf('all', rec), {});
});

test('my stats: the tab draws, says so when there is nothing, and writes nothing unescaped', () => {
  const rec = MyStats.build(world());
  for (const range of ['30', '90', 'all']) {
    const page = MyStats.html(rec, { range, code: 'PAEX' });
    assert.match(page, /My stats/);
    assert.match(page, /only you can open this page/);
    assert.match(page, new RegExp(`data-ms-range="${range}" aria-pressed="true"`));
    assert.match(page, /Every round trip/);
  }
  assert.match(MyStats.html({ v: 1, from: '', to: '', turns: [], trips: [], rests: [], spares: [], pos: [], resets: [], due: null, passed: [], stale: [] }, {}), /No trips in the saved checks/);
  assert.match(MyStats.html(null, {}), /No trips in the saved checks/);
  const odd = MyStats.build(world());
  odd.trips[0].id = '<img src=x onerror=1>';
  assert.equal(MyStats.html(odd, { code: '<b>' }).includes('<img'), false);
});

test('my stats: one file per person, rewritten only when it changed, in a folder the Worker never serves', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'board-mystats-'));
  const w = world();
  const other = 'b'.repeat(16);
  const input = { people: { [ME]: w.stretches, [other]: [{ turn: 'SD06', own: true, from: '2026-10-24 0400', to: '2026-11-11 1923' }] }, turns: w.turns, trains: w.trains,
    resets: { offs: w.offs, people: { [ME]: w.resets }, turns: { 'S501-CO': { h: ME, dueText: '11th 0245', level: 'yellow' } } }, analytics: { sleep: w.sleep, runLog: w.runLog, stale: w.stale },
    nowSeen: { taken: '2026-11-11 1923', seen: [{ h: ME, turn: 'S501', craft: 'CO', train: '' }] } };
  const kept = Files.update(Files.load(path.join(root, 'my-stats.json')), input, '2026-10-16');
  assert.deepEqual(Object.keys(kept.people).sort(), [ME, other]);
  assert.equal(kept.people[ME].trips.length, 6);
  assert.deepEqual(kept.people[ME].due, { turn: 'S501-CO', dueText: '11th 0245', level: 'yellow' });
  assert.equal(kept.people[other].trips.length, 0); // nobody else's trips on their file
  assert.equal(Files.write(root, kept), 2);
  const file = path.join(root, 'accounts', 'stats', `${ME}.json`);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), kept.people[ME]);
  assert.equal(require('../../lib/board/r2').KEEP_PREFIXES.includes('accounts/'), true); // the mirror never deletes them
  const before = fs.statSync(file).mtimeMs;
  Files.save(path.join(root, 'my-stats.json'), kept);
  const again = Files.update(Files.load(path.join(root, 'my-stats.json')), input, '2026-10-16');
  assert.deepEqual(again, kept);
  Files.write(root, again);
  assert.equal(fs.statSync(file).mtimeMs, before);
  // Someone gone from the record: their file goes too.
  delete again.people[other];
  assert.equal(Files.write(root, again), 1);
  assert.deepEqual(fs.readdirSync(path.join(root, 'accounts', 'stats')), [`${ME}.json`]);
});

test('my stats: the site build writes the records and keeps its own copy beside the history', () => {
  const { buildSite } = require('../../lib/board/site');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'board-mystats-site-'));
  const hist = path.join(root, 'history');
  fs.mkdirSync(path.join(hist, '2026-10-15'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../fixtures/board/2026-10-15.json'), path.join(hist, '2026-10-15', '0143.json'));
  const built = buildSite({ historyDir: hist, outDir: path.join(root, 'site'), days: 0, now: new Date('2026-10-16T12:00:00Z') });
  assert.equal((built.skipped || []).some((x) => /my stats/.test(x)), false);
  assert.ok(fs.existsSync(path.join(root, 'site', 'accounts', 'stats')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'my-stats.json'), 'utf8')).v, MyStats.V);
  assert.ok(fs.existsSync(path.join(root, 'site', 'board-mystats.js')));
  assert.match(fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8'), /<script src="board-mystats\.js"><\/script>/);
});
