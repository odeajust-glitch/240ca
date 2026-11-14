// My stats, the November 2026 review (owner: "work every figure on the page
// out again from the saved checks ... Fix what you find. Each fix gets a
// test."). Each test here is a wrong or misleading number that was found by
// setting 168 people's records beside the names the checker read off the Call
// Board, and holds its fix. Made-up turns, trains and people: a person is a
// hash, as on the site.
const test = require('node:test');
const assert = require('node:assert/strict');
const MyStats = require('../../public/board-mystats');
const Files = require('../../lib/board/mystats');
const R = require('../../lib/board/resets');
const T = require('../../public/board-trains');

const ME = 'a'.repeat(16);
const OTHER = 'b'.repeat(16);
const m = (stamp) => T.toMin(stamp);
const order = (train, seen, onDutyAt, station, crew, extra = {}) => ({ train, first: seen, last: seen, onDuty: `at ${station}, ${onDutyAt}`, onDutySeen: seen, onDutyAt, station, crew, job: '', workedBy: '', yard: false, ...extra });
const turn = (orders = [], extra = {}) => ({ changes: [], orders, rests: [], spares: [], ...extra });

// What the reset tracker read (lib/board/resets.js): a name on a train's crew
// lines, and each turn's trains as the Call Board listed them.
function tracker0(last) { const acc = R.empty(); acc.since = m('2026-11-03 0000'); acc.last = m(last); return acc; }
function named(acc, h, train, on, job, first, last, extra = {}) {
  const trips = acc.trips[h] || (acc.trips[h] = {});
  trips[`${train}/${m(on)}`] = { train, on: m(on), job, first: m(first), last: m(last), ...extra };
}
function listed(acc, key, train, on, first, last) {
  const trips = acc.turnTrips[key] || (acc.turnTrips[key] = {});
  trips[`${train}/${m(on)}`] = { train, on: m(on), job: key, first: m(first), last: m(last) };
}
const build = (w, acc, { yard = null, people = null, h = ME } = {}) => MyStats.build({ ...w, tracker: Files.trackerOf(acc, { yard, people: people || { [h]: w.stretches } })(h, w.stretches) });
const ids = (rec) => rec.trips.map((t) => `${t.id} ${t.at.slice(8)}`);

const nth = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
// A yard job as the Call Board lists it, a check every half hour from `from` to `to`.
function yardChecks(job, day, onDuty, from, to, crew) {
  const out = [];
  for (let t = m(`${day} ${from}`); t <= m(`${day} ${to}`) + (to < from ? 1440 : 0); t += 30) out.push({ taken: T.fromMin(t), yardJobs: [{ job, station: 'SARNIA', onDuty: `${nth(+day.slice(8))} ${onDuty}`, hours: 8, crew }] });
  return out;
}

// --- What someone worked ----------------------------------------------------

// Found: a spare who worked the same yard job on eight days had two shifts on
// the page. A turn's history keeps one line per train NAME, and a yard job's
// name is the same every day.
test('review: a yard job worked on three days is three shifts, not the one line its history keeps', () => {
  const days = ['2026-11-04', '2026-11-05', '2026-11-07'];
  const yard = {};
  const acc = tracker0('2026-11-08 1200');
  const stretches = [{ turn: 'B109', own: true, from: '2026-11-03 0000', to: '2026-11-08 1200' }];
  for (const d of days) {
    Files.collectYard(yard, yardChecks('YBHS31', d, '1600', '1400', '2330', 'S1 B109'));
    named(acc, ME, 'YBHS31', `${d} 1600`, 'YBHS31', `${d} 1400`, `${d} 2330`, { yard: true });
    stretches.push({ turn: 'YBHS31', own: false, from: `${d} 1400`, to: `${d} 2330` }); // their name on the job only while it was on the Call Board
  }
  const turns = { B109: turn([order('YBHS31', '2026-11-04 1400', '4th 1600', 'SARNIA', 'S1 B109', { yard: true, last: '2026-11-07 2330' })]) };
  const rec = build({ stretches, turns }, acc, { yard });
  assert.deepEqual(ids(rec), ['YBHS31 04 1600', 'YBHS31 05 1600', 'YBHS31 07 1600']);
  assert.deepEqual(rec.trips[0], { id: 'YBHS31', at: '2026-11-04 1600', turn: 'B109', st: 'SARNIA', job: 'YBHS31', yard: true, off: '2026-11-05 0000', est: true, nm: 1 });
  const s = MyStats.stats(rec);
  assert.deepEqual([s.yard, s.road, s.duty.total, s.worked], [3, 0, 3 * 480, 3]);
  // Turn History's way alone (no names read) still gives the one line.
  assert.equal(MyStats.build({ stretches, turns }).trips.length, 1);
});

// Found: a yard job's own crew had no shifts at all, and someone listed TEMP
// on a yard job had one every day the job ran. Since 3 November the crews in
// town list each yard job's people all day, every day: whose job it is, not
// who came in.
test('review: days on a yard job\'s list in town are not counted as worked or as off, and say so', () => {
  const acc = tracker0('2026-11-11 2200');
  const stretches = [{ turn: 'YBHS01', own: true, from: '2026-11-03 0005', to: '2026-11-11 2200' }];
  const rec = build({ stretches, turns: { YBHS01: turn([order('YBHS01', '2026-11-03 0600', '3rd 0800', 'SARNIA', '', { yard: true })]) } }, acc);
  assert.deepEqual(rec.trips, []);
  assert.deepEqual(rec.unk, [{ job: 'YBHS01', from: '2026-11-03', to: '2026-11-11' }]);
  assert.equal(rec.due, null); // no reset clock from days nobody can speak for
  assert.deepEqual(rec.resets, []);
  const s = MyStats.stats(rec);
  assert.deepEqual([s.days.length, s.told, s.worked, s.clearDays, s.unknown.days, s.unknown.jobs, s.maxClear], [9, 0, 0, 0, 9, ['YBHS01'], 0]);
  assert.equal(s.weekdays.reduce((n, w) => n + w.days, 0), 0);
  assert.deepEqual([s.weekends.n, s.weeks.reduce((n, w) => n + w.unk, 0)], [0, 9]);
  const page = MyStats.html(rec, { code: 'PAEX' });
  assert.match(page, /9 days left out: 3 Nov to 11 Nov, on yard job YBHS01/);
  assert.match(page, /No trips in the saved checks/);
});

test('review: once the checker marks who is on duty on a yard job, the shifts count and the unknown days stop', () => {
  const acc = tracker0('2026-11-13 2200');
  acc.yardFrom = m('2026-11-12 0900'); // the first check after the laptop pulled
  const yard = {};
  Files.collectYard(yard, yardChecks('YBHS01', '2026-11-13', '0800', '0600', '1630', ''));
  named(acc, ME, 'YBHS01', '2026-11-13 0800', 'YBHS01', '2026-11-13 0600', '2026-11-13 1630', { yard: true, sure: true });
  const stretches = [{ turn: 'YBHS01', own: true, from: '2026-11-03 0005', to: '2026-11-13 2200' }];
  const rec = build({ stretches, turns: {} }, acc, { yard });
  assert.deepEqual(ids(rec), ['YBHS01 13 0800']);
  assert.deepEqual(rec.unk, [{ job: 'YBHS01', from: '2026-11-03', to: '2026-11-12' }]);
  const s = MyStats.stats(rec);
  assert.deepEqual([s.unknown.days, s.told, s.worked], [10, 1, 1]);
});

// Found: a pool turn's holder was given yard shifts because a yard job's crew
// lines still showed that turn for the person who held it before.
test('review: someone listed TEMP on a yard job gets only the shifts the job\'s own crew lines put their turn on', () => {
  const acc = tracker0('2026-11-09 1200');
  const yard = {};
  const stretches = [{ turn: 'B109', own: true, from: '2026-11-03 0000', to: '2026-11-09 1200' }, { turn: 'YMXS02', own: false, from: '2026-11-04 0010', to: '2026-11-08 2350' }];
  for (const d of ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']) {
    Files.collectYard(yard, yardChecks('YMXS02', d, '0700', '0500', '1530', d === '2026-11-06' ? 'CO B109' : 'CO B120'));
    named(acc, ME, 'YMXS02', `${d} 0700`, 'YMXS02', `${d} 0500`, `${d} 1530`, { yard: true }); // the old rule: seen on it, not their own turn
  }
  const w = { stretches, turns: {} };
  assert.deepEqual(ids(build(w, acc, { yard })), ['YMXS02 06 0700']);
  assert.equal(build(w, acc, { yard }).unk, undefined); // their days are known from the job's lines
  // The same lines, but someone else holds B109 as their own turn by then: a stale turn on the job, not this person.
  const moved = { stretches: [{ turn: 'B109', own: true, from: '2026-11-03 0000', to: '2026-11-05 1200' }, stretches[1]], turns: {} };
  const people = { [ME]: moved.stretches, [OTHER]: [{ turn: 'B109', own: true, from: '2026-11-05 1300', to: '2026-11-09 1200' }] };
  assert.deepEqual(ids(build(moved, acc, { yard, people })), []);
  // And a pool turn's holder who was never named on the job gets nothing from its lines.
  assert.deepEqual(ids(build({ stretches: [stretches[0]], turns: {} }, tracker0('2026-11-09 1200'), { yard })), []);
});

// Found: two yard shifts back to back read as one of 14 to 19 hours.
test('review: off a yard job\'s crew lines in its first hour is not a shift; later is leaving early', () => {
  const acc = tracker0('2026-11-06 1200');
  acc.yardFrom = m('2026-11-03 0000');
  const yard = {};
  Files.collectYard(yard, yardChecks('YSTY01', '2026-11-04', '2200', '2000', '0630', ''));
  Files.collectYard(yard, yardChecks('YSTY01', '2026-11-05', '2200', '2000', '0630', ''));
  named(acc, ME, 'YSTY01', '2026-11-04 2200', 'YSTY01', '2026-11-04 2000', '2026-11-04 2230', { yard: true, sure: true }); // replaced at the start
  named(acc, ME, 'YSTY01', '2026-11-05 2200', 'YSTY01', '2026-11-05 2000', '2026-11-06 0200', { yard: true, sure: true }); // went home at 0200
  const rec = build({ stretches: [{ turn: 'B109', own: true, from: '2026-11-03 0000', to: '2026-11-06 1200' }], turns: {} }, acc, { yard });
  assert.deepEqual(rec.trips.map((t) => [t.at, t.off]), [['2026-11-05 2200', '2026-11-06 0200']]);
});

// Found: one duty counted twice or three times when the train was renumbered
// while the crew was on it.
test('review: the same duty under two train numbers is one trip, under the number seen last', () => {
  const acc = tracker0('2026-11-07 1200');
  named(acc, ME, 'M39431 05', '2026-11-05 0900', 'SR04', '2026-11-05 0700', '2026-11-05 1100');
  named(acc, ME, 'M39631 05', '2026-11-05 0915', 'SR04', '2026-11-05 1110', '2026-11-05 1900');
  const turns = { SR04: turn([order('M39431 05', '2026-11-05 0700', '5th 0900', 'SARNIA', 'EN SD02 · CO SR04'), order('M39631 05', '2026-11-05 1110', '5th 0915', 'SARNIA', 'EN SD02 · CO SR04')]) };
  const rec = build({ stretches: [{ turn: 'SR04', own: true, from: '2026-11-03 0000', to: '2026-11-07 1200' }], turns }, acc);
  assert.deepEqual(rec.trips.map((t) => [t.id, t.at, t.aka]), [['M39631 05', '2026-11-05 0915', ['M39431 05']]]);
  assert.match(MyStats.html(rec, {}), /also shown as M39431 05/);
});

// Found: "EN S304 · ET S303 · CO SB04" gave S303's engineer a train only
// S303's trainee rode, and gave a trainee every train of the turn they were on.
test('review: a trainee\'s slot on a crew line is the trainee\'s, not the turn holder\'s', () => {
  const turns = { S303: turn([order('M38331 05', '2026-11-05 0700', '5th 0900', 'SARNIA', 'EN S304 · ET S303 · CO SB04'), order('M30241 06', '2026-11-06 0700', '6th 0900', 'SARNIA', 'EN S303 · CO SB04')]) };
  const holder = MyStats.build({ stretches: [{ turn: 'S303', own: true, from: '2026-11-03 0000', to: '2026-11-08 0000' }], turns });
  assert.deepEqual(holder.trips.map((t) => t.id), ['M30241 06']);
  const trainee = MyStats.build({ stretches: [{ turn: 'S303-ET', own: true, from: '2026-11-03 0000', to: '2026-11-08 0000' }], turns });
  assert.deepEqual(trainee.trips.map((t) => [t.id, t.tt]), [['M38331 05', 'ET']]);
});

// Found: a turn's record keeps a train "working SA05 (CO)" when the checker
// matched a spare on SA05 to that turn; the match can be a stale one, and the
// turn's holder was given a train they were never on (overlapping one they were).
test('review: a train kept on a turn\'s record as working another job goes to whoever was seen on that job', () => {
  const filled = order('E27531 28', '2026-10-28 0010', '28th 0145', 'TORONTO', 'EN SD03 · CO SA05', { job: 'SA05', onDuty: 'at Toronto, 28th 0145, working SA05 (CO)' });
  const turns = { S104: turn([filled, order('M30241 28', '2026-10-28 0300', '28th 0445', 'SARNIA', 'EN S104 · CO SB02')]) };
  const holder = [{ turn: 'S104', own: true, from: '2026-10-24 0000', to: '2026-10-30 0000' }];
  assert.deepEqual(MyStats.build({ stretches: holder, turns }).trips.map((t) => t.id), ['M30241 28']);
  // Seen on SA05 that night while holding S104: theirs, as a job filled in on.
  const filler = [...holder, { turn: 'SA05', own: false, from: '2026-10-27 2300', to: '2026-10-28 0200' }];
  assert.deepEqual(MyStats.build({ stretches: filler, turns }).trips.map((t) => [t.id, t.job || '']), [['E27531 28', 'SA05'], ['M30241 28', '']]);
  // Turn History's person search is unchanged (a test in mystats.test.js holds the two equal on ordinary turns).
  assert.deepEqual(MyStats.personRecord(holder, turns).orders.map((o) => o.train), ['E27531 28', 'M30241 28']);
});

// Found: three people at once were given every train a make-up turn worked.
test('review: a make-up turn is a placeholder: seen on one gives a train only by name', () => {
  const turns = { MU01: turn([order('M30131 05', '2026-11-05 0700', '5th 0900', 'TORONTO', 'EN MU04 · CO MU01'), order('M30131 06', '2026-11-06 0700', '6th 0900', 'TORONTO', 'EN MU04 · CO MU01')]), XSAS05: turn() };
  const stretches = [{ turn: 'XSAS05', own: true, from: '2026-11-03 0000', to: '2026-11-08 0000' }, { turn: 'MU01', own: false, from: '2026-11-05 0600', to: '2026-11-06 1800' }];
  assert.deepEqual(MyStats.build({ stretches, turns }).trips, []);
  const acc = tracker0('2026-11-08 0000');
  named(acc, ME, 'M30131 06', '2026-11-06 0900', 'MU01', '2026-11-06 0700', '2026-11-06 1700');
  const rec = build({ stretches, turns }, acc);
  assert.deepEqual(rec.trips.map((t) => [t.id, t.turn, t.job, t.st, t.with]), [['M30131 06', 'XSAS05', 'MU01', 'TORONTO', ['EN MU04']]]);
});

// Found: an engineer on a train's crew lines for one check, another in his
// place ten minutes later; the first was shown as working it.
test('review: called for a train and replaced before it went on duty is not a trip', () => {
  const turns = { EN05: turn([order('E27861 09', '2026-11-09 0100', '9th 0300', 'SARNIA', 'EN EN05 · CO SR02')]) };
  const stretches = [{ turn: 'EN05', own: true, from: '2026-11-03 0000', to: '2026-11-10 0000' }];
  const acc = tracker0('2026-11-10 0000');
  named(acc, ME, 'E27861 09', '2026-11-09 0300', 'EN05', '2026-11-09 0100', '2026-11-09 0110');
  named(acc, OTHER, 'E27861 09', '2026-11-09 0300', 'EN05', '2026-11-09 0120', '2026-11-09 0900');
  listed(acc, 'EN05', 'E27861 09', '2026-11-09 0300', '2026-11-09 0100', '2026-11-09 0900');
  assert.deepEqual(build({ stretches, turns }, acc).trips, []);
  // Nobody else named and the turn's own line stayed on the train: the name just went unread. Kept.
  const quiet = tracker0('2026-11-10 0000');
  named(quiet, ME, 'E27861 09', '2026-11-09 0300', 'EN05', '2026-11-09 0100', '2026-11-09 0110');
  listed(quiet, 'EN05', 'E27861 09', '2026-11-09 0300', '2026-11-09 0100', '2026-11-09 0900');
  assert.deepEqual(ids(build({ stretches, turns }, quiet)), ['E27861 09 09 0300']);
  // No name read at all, and the turn was off the train again before it went on duty: not worked.
  const gone = tracker0('2026-11-10 0000');
  listed(gone, 'EN05', 'E27861 09', '2026-11-09 0300', '2026-11-09 0100', '2026-11-09 0140');
  assert.deepEqual(build({ stretches, turns }, gone).trips, []);
  // No name read, but someone else's name was on that job: theirs, not the turn holder's.
  const taken = tracker0('2026-11-10 0000');
  named(taken, OTHER, 'E27861 09', '2026-11-09 0300', 'EN05', '2026-11-09 0100', '2026-11-09 0900');
  assert.deepEqual(build({ stretches, turns }, taken).trips, []);
});

// Found: a trip was timed from the on-duty time first shown, hours before the one it went at.
test('review: a trip is at the on-duty time last shown, and named on a job not their own is a job filled in on', () => {
  const turns = { SR05: turn([order('M38531 06', '2026-11-06 0100', '6th 0300', 'SARNIA', 'EN SD04 · CO SR05')]), B109: turn() };
  const acc = tracker0('2026-11-08 0000');
  named(acc, ME, 'M38531 06', '2026-11-06 0300', 'SR05', '2026-11-06 0100', '2026-11-06 0200'); // ordered for 0300
  named(acc, ME, 'M38531 06', '2026-11-06 0445', 'SR05', '2026-11-06 0210', '2026-11-06 1300'); // set back to 0445
  const rec = build({ stretches: [{ turn: 'B109', own: true, from: '2026-11-03 0000', to: '2026-11-08 0000' }], turns }, acc);
  assert.deepEqual(rec.trips.map((t) => [t.id, t.at, t.turn, t.job, t.st, t.with, t.nm]), [['M38531 06', '2026-11-06 0445', 'B109', 'SR05', 'SARNIA', ['EN SD04'], 1]]);
  assert.deepEqual(MyStats.stats(rec).jobs, [['SR05', 1]]);
});

// Found: a trip on someone's first day went to nobody (the train was first
// seen before their name was), and one first seen on their last day but on
// duty hours after they left the turn went to them.
test('review: a train is theirs by when it went on duty, not by when it was first seen', () => {
  const turns = { SA03: turn([order('M39671 24', '2026-10-24 0200', '24th 0700', 'SARNIA', 'EN SA03 · CO SR09'), order('M39671 29', '2026-10-29 2200', '30th 0600', 'SARNIA', 'EN SA03 · CO SR09')]) };
  const stretches = [{ turn: 'SA03', own: true, from: '2026-10-24 0600', to: '2026-10-29 2330' }];
  assert.deepEqual(MyStats.build({ stretches, turns }).trips.map((t) => t.id), ['M39671 24']);
  assert.deepEqual(MyStats.personRecord(stretches, turns).orders.map((o) => o.train), ['M39671 29']); // Turn History's way, by first seen
});

// Found: 88 pairs of trips overlapped (someone on two trains at once).
test('review: nobody is on two trains at once: a trip read by name beats one read off the turn', () => {
  const turns = { SD07: turn([order('M30241 05', '2026-11-05 0700', '5th 0900', 'SARNIA', 'EN SD07 · CO SR02'), order('Q14931 05', '2026-11-05 1300', '5th 1500', 'SARNIA', 'EN SD07 · CO SR06')]) };
  const stretches = [{ turn: 'SD07', own: true, from: '2026-11-03 0000', to: '2026-11-08 0000' }];
  const acc = tracker0('2026-11-08 0000');
  named(acc, ME, 'M30241 05', '2026-11-05 0900', 'SD07', '2026-11-05 0700', '2026-11-05 1800'); // still on it at 1800
  listed(acc, 'SD07', 'Q14931 05', '2026-11-05 1500', '2026-11-05 1300', '2026-11-05 1600'); // the turn listed on another train meanwhile
  const rec = build({ stretches, turns }, acc);
  assert.deepEqual(rec.trips.map((t) => t.id), ['M30241 05']);
  // Two by name that run into each other: the first ended when the next began.
  named(acc, ME, 'Q14931 05', '2026-11-05 1500', 'SD07', '2026-11-05 1300', '2026-11-05 2300');
  const both = build({ stretches, turns }, acc);
  assert.deepEqual(both.trips.map((t) => [t.id, t.off, t.est]), [['M30241 05', '2026-11-05 1500', true], ['Q14931 05', both.trips[1].off, true]]);
  assert.ok(m(both.trips[1].off) > m('2026-11-05 1500'));
});

// Found (asked for by the fix above): a yard shift had no call beside it.
test('review: a yard shift carries the call the sleep tracker measured for it', () => {
  const acc = tracker0('2026-11-06 1200');
  acc.yardFrom = m('2026-11-03 0000');
  named(acc, ME, 'YBHS31', '2026-11-05 1600', 'YBHS31', '2026-11-05 1400', '2026-11-05 2330', { yard: true, sure: true });
  const sleep = [{ turn: 'B109', train: 'YBHS31', onDuty: '2026-11-05 1600', expected: '2026-11-05 1300', firstCall: '2026-11-05 1300', call: '2026-11-05 1400', off: 60, shifts: [1] },
    { turn: 'B109', train: 'YBHS31', onDuty: '2026-11-02 1600', expected: '2026-11-02 1400', firstCall: '2026-11-02 1400', call: '2026-11-02 1400', off: 0, shifts: [] }]; // another day's
  const rec = build({ stretches: [{ turn: 'B109', own: true, from: '2026-11-03 0000', to: '2026-11-06 1200' }], turns: {}, sleep }, acc);
  assert.deepEqual(rec.trips[0].call, { exp: '2026-11-05 1300', first: '2026-11-05 1300', got: '2026-11-05 1400', off: 60, n: 1 });
  // The same job the next day, no call measured for it: not given the day before's (the job's name is the same every day).
  named(acc, ME, 'YBHS31', '2026-11-06 1600', 'YBHS31', '2026-11-06 1400', '2026-11-06 2330', { yard: true, sure: true });
  acc.last = m('2026-11-07 1200');
  const two = build({ stretches: [{ turn: 'B109', own: true, from: '2026-11-03 0000', to: '2026-11-07 1200' }], turns: {}, sleep }, acc);
  assert.deepEqual(two.trips.map((t) => [t.at, !!t.call]), [['2026-11-05 1600', true], ['2026-11-06 1600', false]]);
});

// Found: two 12-hour stand-by shifts read as 4 h 30 off between them, flagged as under the 12 h at home. The 12 h is an assumption.
test('review: time off that rests on an estimated off duty time is said to be an estimate', () => {
  const rec = blank({ from: '2026-10-25', to: '2026-10-28', turns: [{ turn: 'B109', own: true, from: '2026-10-25', to: '2026-10-28' }], trips: [
    { id: 'YSBY06', at: '2026-10-25 1430', off: '2026-10-26 0230', est: true, turn: 'B109', job: 'YSBY06', st: 'SARNIA', yard: true },
    { id: 'YSBY05', at: '2026-10-26 0700', off: '2026-10-26 1900', est: true, turn: 'B109', job: 'YSBY05', st: 'SARNIA', yard: true },
    { id: 'Z14931 28', at: '2026-10-28 0100', off: '2026-10-28 0900', turn: 'B109', st: 'SARNIA' }] });
  const r = MyStats.stats(rec).rules;
  assert.deepEqual([r.home.n, r.home.under, r.home.underEst, r.home.least.gap, r.home.least.est, r.quiet, r.quietEst], [2, 1, 1, 270, true, 1, 1]);
  const page = MyStats.html(rec, { more: true });
  assert.match(page, /Shortest time off at home<\/dt><dd>~4 h 30 <span class="ms-pill ms-bad">under<\/span><small>the least is 12 h · 1 of 2 under \(1 after an off duty time that is an estimate\)/);
  assert.match(page, /1 of the 1 on an estimated off duty time or call/);
  assert.match(page, /A ring instead of a dot: the off duty time before it is an estimate/);
  assert.equal((page.match(/class="ms-dotbad ms-dotest"/g) || []).length, 1);
});

// --- Resets -------------------------------------------------------------------

// Found: a reset shown on someone's second day in the checks, worked out from
// time off before anyone had seen them; and a next-reset date that ignored a
// call already in hand.
test('review: a reset is only said where the checks saw the 32 hours before it; a call in hand starts the 7 days', () => {
  const acc = R.empty(); acc.since = m('2026-11-01 0000'); acc.last = m('2026-11-12 1200');
  const turns = { SR04: turn([order('M30241 06', '2026-11-06 0800', '6th 1000', 'SARNIA', 'EN SD02 · CO SR04'), order('M30241 10', '2026-11-10 0800', '10th 1000', 'SARNIA', 'EN SD02 · CO SR04')]) };
  named(acc, ME, 'M30241 06', '2026-11-06 1000', 'SR04', '2026-11-06 0800', '2026-11-06 2000');
  named(acc, ME, 'M30241 10', '2026-11-10 1000', 'SR04', '2026-11-10 0800', '2026-11-10 2000');
  // First seen on the 5th: the reset the tracker would put at 6th 0559 rests on days nobody saw. Dropped.
  const late = build({ stretches: [{ turn: 'SR04', own: true, from: '2026-11-05 0000', to: '2026-11-12 1200' }], turns }, acc);
  assert.deepEqual(late.resets.map((x) => x.at), ['2026-11-10 0559', '2026-11-12 0559']);
  // Seen from the 3rd, off until the 6th: the checks stand behind it.
  const stretches = [{ turn: 'SR04', own: true, from: '2026-11-03 0000', to: '2026-11-12 1200' }];
  const seen = build({ stretches, turns }, acc);
  assert.deepEqual(seen.resets.map((x) => x.at), ['2026-11-06 0559', '2026-11-10 0559', '2026-11-12 0559']);
  assert.equal(seen.due, null); // reset this morning and not back on duty: the 7 days have not started
  // Called for a train that goes on duty at 1400: not a trip yet, but the 7 days start then.
  named(acc, ME, 'M30241 12', '2026-11-12 1400', 'SR04', '2026-11-12 1130', '2026-11-12 1200');
  const called = build({ stretches, turns }, acc);
  assert.equal(called.trips.length, 2);
  assert.deepEqual(called.due, { turn: 'SR04', dueText: '19th 1359', level: '' });
});

// --- The numbers ----------------------------------------------------------------

const blank = (extra) => ({ v: 1, from: '', to: '', turns: [], trips: [], rests: [], spares: [], pos: [], resets: [], due: null, passed: [], stale: [], ...extra });

// Found: a yard shift with no end read was given the usual length of a road trip.
test('review: a yard shift with no off duty is 8 hours, 12 on a YSBY job', () => {
  const s = MyStats.stats(blank({ from: '2026-11-05', to: '2026-11-07', turns: [{ turn: 'B109', own: true, from: '2026-11-05', to: '2026-11-07' }],
    trips: [{ id: 'M30241 04', at: '2026-11-05 0100', turn: 'B109', st: 'SARNIA', off: '2026-11-05 0500' }, { id: 'YSBY06', at: '2026-11-05 1800', turn: 'B109', job: 'YSBY06', yard: true }, { id: 'YBHS31', at: '2026-11-06 1600', turn: 'B109', job: 'YBHS31', yard: true }] }));
  assert.deepEqual(s.trips.map((t) => [t.id, t.dur, t.durEst]), [['M30241 04', 240, false], ['YSBY06', 720, true], ['YBHS31', 480, true]]);
  assert.deepEqual([s.duty.total, s.duty.est, s.yard, s.duty.yardAvg], [240 + 720 + 480, 2, 2, 600]);
});

// Found: "most on duty in any 7 days" came out low when the busiest 7 days began mid-day or the record began with a trip from the evening before.
test('review: the most on duty in any 7 days is the true busiest 7 days, counted minute by minute', () => {
  const trips = [['2026-10-23 2200', '2026-10-24 0900'], ['2026-10-25 1500', '2026-10-26 0200'], ['2026-10-27 0600', '2026-10-27 1730'], ['2026-10-29 1000', '2026-10-29 2100'],
    ['2026-10-30 2000', '2026-10-31 0730'], ['2026-11-01 1300', '2026-11-01 2300'], ['2026-11-03 0400', '2026-11-03 1500'], ['2026-11-06 0900', '2026-11-06 1900']]
    .map(([at, off], i) => ({ id: `M3024${i} 01`, at, off, turn: 'SR04', st: i % 2 ? 'TORONTO' : 'SARNIA' }));
  const rec = blank({ from: '2026-10-23', to: '2026-11-07', turns: [{ turn: 'SR04', own: true, from: '2026-10-24', to: '2026-11-07' }], trips });
  const s = MyStats.stats(rec);
  let best = 0;
  const spans = trips.map((t) => [m(t.at), m(t.off)]);
  for (let a = m('2026-10-16 0000'); a <= m('2026-11-07 0000'); a++) { let n = 0; for (const [on, off] of spans) n += Math.max(0, Math.min(off, a + 7 * 1440) - Math.max(on, a)); if (n > best) best = n; }
  assert.equal(s.most7.min, best);
  assert.equal(s.rules.week.min, best);
  assert.equal(s.most28, null); // not 28 days of record yet: no 28-day figure
  // The same sum the other way: the 7 days ending with each day never exceed it.
  assert.ok(s.roll.every((r) => r.min <= best));
  assert.equal(s.days[0].date, '2026-10-23'); // the evening before their first day on the turn is on the calendar
});

// Found: a trip home days after a trip out was paired with it as one round
// trip "held away" for 60 hours; the time after a trip out with no trip home
// seen was counted as time at home.
test('review: a round trip needs the trip home within a day and a half; otherwise the gap is not called home', () => {
  const rec = blank({ from: '2026-11-01', to: '2026-11-08', turns: [{ turn: 'SR04', own: true, from: '2026-11-01', to: '2026-11-08' }], trips: [
    { id: 'E27861 01', at: '2026-11-01 0800', off: '2026-11-01 1800', turn: 'SR04', st: 'SARNIA' }, // out; no trip home seen
    { id: 'Z14931 04', at: '2026-11-04 1000', off: '2026-11-04 2000', turn: 'SR04', st: 'TORONTO' }, // a trip home 64 h later: another stay
    { id: 'E27861 06', at: '2026-11-06 0800', off: '2026-11-06 1800', turn: 'SR04', st: 'SARNIA' },
    { id: 'Z14931 07', at: '2026-11-07 0700', off: '2026-11-07 1700', turn: 'SR04', st: 'TORONTO' }] });
  const s = MyStats.stats(rec);
  assert.deepEqual(s.tours.map((x) => [x.out.id, x.back ? x.back.id : null, x.held]), [['E27861 01', null, null], ['E27861 06', 'Z14931 07', 780]]);
  assert.deepEqual([s.done, s.held.n, s.held.max], [1, 1, 780]);
  assert.deepEqual(s.split, { span: 153 * 60, duty: 2400, held: 780, lost: 64 * 60, home: 153 * 60 - 2400 - 780 - 64 * 60 });
  // Time off beside the rest rules: at home after the trip home, away between the pair; nothing claimed for the gap nobody saw.
  assert.deepEqual(s.rules.offs.map((o) => [o.id, o.where, o.gap, o.quiet]), [['E27861 06', 'home', 36 * 60, 34 * 60], ['Z14931 07', 'away', 780, 660]]);
  assert.deepEqual([s.rules.home.under, s.rules.away.under, s.rules.quiet, s.rules.over, s.rules.longest.dur], [0, 0, 0, 0, 600]);
});

test('review: time off under the rest rules\' least, and duty over 12 hours, are counted', () => {
  const rec = blank({ from: '2026-11-01', to: '2026-11-04', turns: [{ turn: 'SR04', own: true, from: '2026-11-01', to: '2026-11-04' }], trips: [
    { id: 'E27861 01', at: '2026-11-01 0800', off: '2026-11-01 2030', turn: 'SR04', st: 'SARNIA' }, // 12 h 30 on duty
    { id: 'Z14931 02', at: '2026-11-02 0600', off: '2026-11-02 1500', turn: 'SR04', st: 'TORONTO', call: { exp: '2026-11-02 0400', first: '2026-11-02 0400', got: '2026-11-02 0400', off: 0, n: 0 } }, // 9 h 30 away, called 7 h 30 after going off
    { id: 'E27861 03', at: '2026-11-03 0200', off: '2026-11-03 1100', turn: 'SR04', st: 'SARNIA' }] }); // 11 h at home
  const r = MyStats.stats(rec).rules;
  assert.deepEqual([r.over, r.longest.id, r.away.n, r.away.under, r.away.least.gap, r.home.n, r.home.under, r.home.least.gap, r.quiet], [1, 'E27861 01', 1, 1, 570, 1, 1, 660, 1]);
  assert.deepEqual([MyStats.RULES.duty, MyStats.RULES.restHome, MyStats.RULES.restAway, MyStats.RULES.quiet, MyStats.RULES.week, MyStats.RULES.month], [720, 720, 600, 480, 3600, 11520]);
});

// Found: nobody on 501/502 had a place on the board (its lines read "position
// 001 (CO):"), and a move between boards was measured as one climb.
test('review: 501/502 board places are read for their own craft, and a climb is on one board only', () => {
  const changes = [
    { taken: '2026-11-04 1200', text: '501/502 (S5) position 002 (EN): rest until 4th 2000 · 501/502 (S5) position 003 (CO): available' },
    { taken: '2026-11-04 2000', text: '501/502 (S5) position 001 (EN): available · 501/502 (S5) position 002 (CO): available' },
    { taken: '2026-11-05 0100', text: '501/502 (S5) position 001 (EN): available · 501/502 (S5) position 001 (CO): available' }];
  const stretches = [{ turn: 'S501', own: true, from: '2026-11-03 0000', to: '2026-11-08 0000', craft: 'CO' }];
  const rec = MyStats.build({ stretches, turns: { S501: turn([], { changes }) } });
  assert.deepEqual(rec.pos, [['2026-11-04 1200', 3, '501/502 (S5)'], ['2026-11-04 2000', 2, '501/502 (S5)'], ['2026-11-05 0100', 1, '501/502 (S5)']]);
  const en = MyStats.build({ stretches: [{ ...stretches[0], craft: 'EN' }], turns: { S501: turn([], { changes }) } });
  assert.deepEqual(en.pos.map((p) => p[1]), [2, 1]);
  // Came home 7th on the Chain Gang, moved to 501/502 at 3rd, called from 1st there: a climb of two places, not six.
  const moved = blank({ from: '2026-11-01', to: '2026-11-08', turns: [{ turn: 'SR03', own: true, from: '2026-11-01', to: '2026-11-03' }, { turn: 'S501', own: true, craft: 'CO', from: '2026-11-04', to: '2026-11-08' }],
    pos: [['2026-11-02 0100', 999, 'Chain Gang (SR)'], ['2026-11-02 1200', 7, 'Chain Gang (SR)'], ['2026-11-03 0900', 5, 'Chain Gang (SR)'], ...rec.pos, ['2026-11-05 0250', 999, '501/502 (S5)']],
    trips: [{ id: 'L50231 05', at: '2026-11-05 0445', off: '2026-11-05 1300', turn: 'S501', craft: 'CO', st: 'SARNIA', call: { exp: '2026-11-05 0245', first: '2026-11-05 0245', got: '2026-11-05 0245', off: 0, n: 0 } }] });
  const b = MyStats.stats(moved).board;
  assert.deepEqual(b.list.map((c) => [c.id, c.board, c.from, c.to, c.wait, c.firstOut]), [['L50231 05', '501/502 (S5)', 3, 1, 14 * 60 + 45, 105]]);
  assert.equal(b.perPlace, Math.round((14 * 60 + 45) / 2));
  // Put back down the board before the call (3rd, then 6th): not a climb, not measured.
  const down = blank({ ...moved, pos: [['2026-11-04 1200', 3, '501/502 (S5)'], ['2026-11-04 2000', 6, '501/502 (S5)']] });
  assert.equal(MyStats.stats(down).board.n, 0);
});

// --- You and your pool ----------------------------------------------------------

// A made-up pool member: `n` trips of `dur` minutes out of Sarnia over the 14 days to 14 November.
function member(turnId, n, dur) {
  const trips = [];
  for (let i = 0; i < n; i++) { const on = m('2026-11-01 0800') + Math.round((i * 13 * 1440) / n); trips.push({ id: `M3${String(i).padStart(2, '0')}41 01`, at: T.fromMin(on), off: T.fromMin(on + dur), turn: turnId, st: 'SARNIA' }); }
  return blank({ from: '2026-11-01', to: '2026-11-14', turns: [{ turn: turnId, own: true, from: '2026-11-01', to: '2026-11-14' }], trips });
}

test('review: the pool comparison gives a pool\'s average and middle half only, from five people up, and nobody\'s own figure', () => {
  const win = { from: '2026-10-18', to: '2026-11-14' };
  const people = [[3, 400], [4, 450], [5, 500], [6, 550], [9, 640]].map(([n, dur], i) => member(`SR0${i + 1}`, n, dur));
  const figures = people.map((r) => MyStats.poolFigures(r, win));
  assert.deepEqual(figures.map((f) => [f.pool, f.days, f.v.trips]), [['SR', 14, 1.5], ['SR', 14, 2], ['SR', 14, 2.5], ['SR', 14, 3], ['SR', 14, 4.5]]);
  const out = MyStats.poolSummary(figures);
  assert.deepEqual(Object.keys(out), ['SR', 'ROAD']); // and the road pools together: here the same five (the next test)
  assert.deepEqual([out.SR.name, out.SR.people], ['Chain Gang (SR)', 5]);
  // Trips a week: the average, and a band whose ends are midway between two people's figures.
  assert.deepEqual(out.SR.m.trips, { n: 5, avg: 2.7, q1: 1.8, q3: 3.8 });
  assert.deepEqual(out.SR.m.trip, { n: 5, avg: 510, q1: 425, q3: 595 });
  for (const [k, fig] of Object.entries(out.SR.m)) {
    // Neither end of the band is anyone's own figure (a plain quartile of five is the second-lowest person's, to the minute).
    const own = figures.map((f) => f.v[k]);
    for (const x of [fig.q1, fig.q3]) assert.equal(own.includes(x), false, `${k} ${x} is one person's own figure`);
    assert.ok(fig.q1 > Math.min(...own) && fig.q3 < Math.max(...own) && fig.q1 < fig.avg && fig.avg < fig.q3);
    assert.deepEqual(Object.keys(fig), ['n', 'avg', 'q1', 'q3']);
  }
  // Nothing about who: no turn ids, no hashes, no lists of figures.
  assert.doesNotMatch(JSON.stringify(out), /SR0\d|"v"|\[/);
  // Four people: not given at all. A figure only some have (no calls measured here): left out.
  assert.deepEqual(MyStats.poolSummary(figures.slice(0, 4)), {});
  assert.equal(out.SR.m.miss, undefined);
  assert.equal(out.SR.m.away, undefined);
  // Who is left out of a pool's figures: under 10 days on it, under 3 trips, yard days nobody recorded, gone from the board.
  assert.equal(MyStats.poolFigures(blank({ ...member('SR06', 5, 500), turns: [{ turn: 'SR06', own: true, from: '2026-11-06', to: '2026-11-14' }] }), win), null);
  assert.equal(MyStats.poolFigures(member('SR07', 2, 500), win), null);
  assert.equal(MyStats.poolFigures(blank({ ...member('SR08', 5, 500), unk: [{ job: 'YBHS01', from: '2026-11-10', to: '2026-11-12' }], trips: member('SR08', 5, 500).trips.filter((t) => t.at < '2026-11-10') }), win), null);
  assert.equal(MyStats.poolFigures(blank({ ...member('SR09', 5, 500), turns: [{ turn: 'SR09', own: true, from: '2026-11-01', to: '2026-11-10' }] }), win), null);
  assert.equal(MyStats.poolFigures(member('S303-ET', 5, 500), win), null); // a trainee is on nobody's pool
  // The laptop's side: the last four weeks to the newest day on record, pools only.
  const kept = { v: MyStats.V, people: Object.fromEntries(people.map((r, i) => [String(i).repeat(16), r])) };
  const file = Files.pools(kept);
  assert.deepEqual([file.from, file.to, Object.keys(file.pools)], ['2026-10-18', '2026-11-14', ['SR', 'ROAD']]);
  assert.deepEqual(file.pools.SR.m.trips, out.SR.m.trips);
  assert.doesNotMatch(JSON.stringify(file), /0000000000000000|1111111111111111/);
  // On the page: the member's own figure beside the pool's, and nothing when the pool is too small to hide anyone.
  const page = MyStats.html(people[2], { more: true, pools: file });
  assert.match(page, /You and the Chain Gang \(SR\)/);
  assert.match(page, /5 people in the pool had enough saved to count/);
  assert.match(MyStats.html(people[2], { more: true, pools: { ...file, pools: {} } }), /Too few people in this pool/);
  assert.doesNotMatch(MyStats.html(people[2], { pools: file }), /You and the/); // not until the new sections are switched on
});

// 501/502 is four people at most, so it can never be compared within itself.
test('review: a pool too small to give is set beside every road pool together, and only when that hides everyone too', () => {
  const win = { from: '2026-10-18', to: '2026-11-14' };
  const sr = [[3, 400], [4, 450], [5, 500], [6, 550], [9, 640]].map(([n, dur], i) => member(`SR0${i + 1}`, n, dur));
  const s3 = [[4, 420], [5, 480], [6, 520], [7, 600]].map(([n, dur], i) => member(`S30${i + 1}`, n, dur));
  const sb = [[3, 410], [5, 470], [8, 530]].map(([n, dur], i) => member(`SB0${i + 1}`, n, dur));
  const s5 = member('S501', 6, 500);
  const fig = (list) => list.map((r) => MyStats.poolFigures(r, win));
  // The Chain Gang is given; with only the four on S3 besides, the wide group would be "the Chain Gang plus four people": withheld.
  const tight = MyStats.poolSummary(fig([...sr, ...s3]));
  assert.deepEqual(Object.keys(tight), ['SR']);
  // Eight people outside the given pool: the wide group can be given.
  const out = MyStats.poolSummary(fig([...sr, ...s3, ...sb, s5]));
  assert.deepEqual(Object.keys(out), ['SR', 'ROAD']);
  assert.deepEqual([out.ROAD.name, out.ROAD.people, out.ROAD.wide, out.ROAD.m.trips.n], ['every road pool together', 13, true, 13]);
  assert.doesNotMatch(JSON.stringify(out), /S50\d|S30\d|SB0\d|"v"|\[/);
  // With no pool given at all, the wide group is everyone in it: given once there are five.
  assert.deepEqual(Object.keys(MyStats.poolSummary(fig([...s3, s5]))), ['ROAD']);
  assert.deepEqual(MyStats.poolSummary(fig(s3)), {});
  const pools = { ...win, pools: out };
  const mine = MyStats.html(s5, { more: true, pools });
  assert.match(mine, /<h3>You and every road pool together<\/h3>/);
  assert.match(mine, /Too few people in this pool have enough saved .* So yours are set beside every road pool together instead: the Chain Gang, the A and B pools, the Drags, both manifests and 501\/502\./);
  assert.match(mine, /13 people had enough saved to count/);
  assert.match(mine, /The middle half of them: /);
  // Someone whose own pool is given sees their own pool, as before.
  const theirs = MyStats.html(sr[2], { more: true, pools });
  assert.match(theirs, /<h3>You and the Chain Gang \(SR\)<\/h3>/);
  assert.doesNotMatch(theirs, /every road pool together/);
  // The spareboards have their own wider group, and a yard job has none.
  const spare = MyStats.poolSummary(fig([[3, 400], [4, 450], [5, 500]].map(([n, dur], i) => member(`B10${i + 1}`, n, dur)).concat([[4, 420], [6, 480]].map(([n, dur], i) => member(`EN0${i + 1}`, n, dur)))));
  assert.deepEqual([Object.keys(spare), spare.SPARE.people], [['SPARE'], 5]);
});

// --- The page -------------------------------------------------------------------

function full() {
  const stretches = [{ turn: 'SR04', own: true, from: '2026-11-01 0000', to: '2026-11-12 1200' }];
  const trips = [];
  const turns = { SR04: turn([], { changes: [['2026-11-02 2300', '006: available'], ['2026-11-03 0500', '002: available'], ['2026-11-03 0700', '999: out working on E27861'], ['2026-11-05 0200', '008: rest until 5th 1200'],
    ['2026-11-06 0200', '005: available'], ['2026-11-07 2000', '001: available'], ['2026-11-08 0600', '999: out working on E27861']].map(([taken, text]) => ({ taken, text: `Chain Gang (SR) position ${text}` })) }) };
  [['E27861 01', '2026-11-01 0800', 'SARNIA', 600], ['Z14931 02', '2026-11-02 0700', 'TORONTO', 540], ['E27861 03', '2026-11-03 0900', 'SARNIA', 610], ['Z14931 04', '2026-11-04 0800', 'TORONTO', 560],
    ['E27861 08', '2026-11-08 0800', 'SARNIA', 600], ['Z14931 09', '2026-11-09 0700', 'TORONTO', 540]].forEach(([id, at, st, dur]) => trips.push({ id, at, st, turn: 'SR04', off: T.fromMin(m(at) + dur), with: ['EN SD02'], plan: T.fromMin(m(at) - 45), pc: 1,
    call: { exp: T.fromMin(m(at) - 150), first: T.fromMin(m(at) - 150), got: T.fromMin(m(at) - 120), off: 30, n: 1 } }));
  trips.push({ id: 'YBHS31', at: '2026-11-11 1600', off: '2026-11-12 0000', est: true, turn: 'SR04', job: 'YBHS31', st: 'SARNIA', yard: true, nm: 1 });
  const rec = MyStats.build({ stretches, turns });
  return { ...rec, trips, resets: [{ at: '2026-11-07 0559', kind: 'natural' }], due: { turn: 'SR04', dueText: '15th 0759', level: '' } };
}
const OLD_SECTIONS = ['time', 'hours', 'weekdays', 'calendar', 'weeks', 'tours', 'calls', 'lineup', 'rest', 'resets', 'turns', 'with'];
const NEW_SECTIONS = ['diary', 'rules', 'log'];

test('review: every section that was on the page is still on it; the new ones show only when switched on', () => {
  const rec = full();
  const plain = MyStats.html(rec, { code: 'PAEX' });
  const more = MyStats.html(rec, { code: 'PAEX', more: true, now: '2026-11-12 1200', pools: { from: '2026-10-16', to: '2026-11-12', pools: {} } });
  for (const id of OLD_SECTIONS) { assert.match(plain, new RegExp(`id="ms-${id}"`), `${id} gone`); assert.match(more, new RegExp(`id="ms-${id}"`), `${id} gone with the new sections on`); }
  for (const id of [...NEW_SECTIONS, 'pool']) { assert.doesNotMatch(plain, new RegExp(`id="ms-${id}"`)); assert.match(more, new RegExp(`id="ms-${id}"`), `${id} missing`); }
  assert.doesNotMatch(plain, /data-ms-csv|<svg class="ms-(tour|diverge|board|roll|dots|diary)/);
  // Each new picture says what it shows, in words, and keeps the numbers beside it.
  for (const words of [/Each row is a day, midnight on the left/, /Each bar is one round trip, newest first/, /Each bar is one call, newest first/, /Each bar is one train, newest first/, /Your place on your board over the dates picked/,
    /Each dot is the time off before one trip/, /Hours on duty in the 7 days ending with each day/]) assert.match(more, words);
  assert.equal((more.match(/<svg[^>]*role="img"[^>]*aria-label="[^"]+"/g) || []).length, (more.match(/<svg class="ms-chart"/g) || []).length); // every drawing is named for a screen reader
  assert.equal((more.match(/<svg/g) || []).length, (more.match(/<svg class="ms-chart"/g) || []).length + 1); // (the one other holds the stripe pattern, hidden from readers)
  assert.match(more, /<svg class="ms-defs" aria-hidden="true"/);
  assert.match(more, /<table class="ms-table"><thead><tr><th>Out<\/th>/); // the round-trip table is still under its picture
  assert.match(more, /<th>Train<\/th><th>On duty<\/th><th>Call you slept on<\/th>/);
  // The rules section gives the limits it compares with, and says what it is not.
  assert.match(more, /the limit is 12 h/);
  assert.match(more, /the limit is 60 h/);
  assert.match(more, /needs 28 days of saved checks/);
  assert.match(more, /not proof by itself/);
  assert.match(more, /left of the 7 days, as of the 12 Nov 1200 check/);
  assert.match(more, /Jobs filled in on/);
  // Nothing a member typed or a train id held can break out of the page.
  const odd = { ...rec, trips: rec.trips.map((t, i) => (i ? t : { ...t, id: '<img src=x onerror=1>', aka: ['"><script>'] })) };
  const drawn = MyStats.html(odd, { code: '<b>', more: true, now: '2026-11-12 1200' });
  assert.equal(/<img|<script/.test(drawn), false);
  assert.match(drawn, /<span class="ms-code">&lt;b&gt;<\/span>/);
});

test('review: the spreadsheet has one line a trip, the same figures as the log, with quotes kept safe', () => {
  const rec = full();
  rec.trips[0] = { ...rec.trips[0], aka: ['M39 "x" 01'] };
  const lines = MyStats.csv(rec, 'all').split('\r\n');
  assert.equal(lines.length, 1 + rec.trips.length);
  assert.equal(lines[0], '"On duty","Train or job","Also shown as","From","Turn","Working (job)","Off duty","Off duty estimated","On duty for (h:mm)","Time off before (h:mm)","Call you slept on","Call you got","Call off by (min)","Name read on it"');
  assert.equal(lines[1], '"2026-11-01 0800","E27861 01","M39 ""x"" 01","SARNIA","SR04","","2026-11-01 1800","","10:00","","2026-11-01 0530","2026-11-01 0600","30",""');
  assert.equal(lines[2], '"2026-11-02 0700","Z14931 02","","TORONTO","SR04","","2026-11-02 1600","","9:00","13:00","2026-11-02 0430","2026-11-02 0500","30",""');
  assert.equal(lines[7], '"2026-11-11 1600","YBHS31","","yard","SR04","YBHS31","2026-11-12 0000","yes","8:00","48:00","","","","yes"');
  // Only the dates picked: the 30 days to 10 December begin on 11 November, the day of the yard shift.
  assert.equal(MyStats.csv({ ...rec, to: '2026-12-10' }, '30').split('\r\n').length, 1 + 1);
  assert.equal(MyStats.csv({ ...rec, to: '2026-12-20' }, '30').split('\r\n').length, 1);
});

test('review: rest booked after a trip is listed for the day-by-day picture, and on duty before it was up is counted', () => {
  const rec = blank({ from: '2026-10-26', to: '2026-10-30', turns: [{ turn: 'SR04', own: true, from: '2026-10-26', to: '2026-10-30' }], trips: [
    { id: 'E27861 26', at: '2026-10-26 2045', off: '2026-10-27 0429', turn: 'SR04', st: 'SARNIA' },
    { id: 'Z14931 27', at: '2026-10-27 1200', off: '2026-10-27 2100', turn: 'SR04', st: 'TORONTO' }, // on duty 29 minutes before the bunkhouse rest was up
    { id: 'E27861 29', at: '2026-10-29 0800', off: '2026-10-29 1700', turn: 'SR04', st: 'SARNIA' }, // 24 h booked at home, on duty well after
    { id: 'L50131 30', at: '2026-10-30 0100', off: '2026-10-30 0900', turn: 'SR04', st: 'GARNET' }], // the only rest read before it is a Toronto bunkhouse line: another crew's
  rests: [{ seen: '2026-10-27 0501', kind: 'Rest', until: '2026-10-27 1229', where: 'Toronto bunkhouse', turn: 'SR04' },
    { seen: '2026-10-27 2130', kind: 'Rest', until: '2026-10-28 2100', where: 'Chain Gang (SR)', turn: 'SR04' },
    { seen: '2026-10-28 0300', kind: 'Hold turn', until: '2026-10-29 0559', where: 'Chain Gang (SR)', turn: 'SR04' },
    { seen: '2026-10-29 1730', kind: 'Rest', until: '2026-10-30 0330', where: 'Toronto bunkhouse', turn: 'SR04' }] });
  const s = MyStats.stats(rec);
  // Each rest from when they went off duty (not from when the board first showed it) to when it was up; a hold is not a rest.
  assert.deepEqual(s.rest.list.map((r) => [T.fromMin(r.from), T.fromMin(r.to)]), [['2026-10-27 0429', '2026-10-27 1229'], ['2026-10-27 2100', '2026-10-28 2100'], ['2026-10-29 1700', '2026-10-30 0330']]);
  assert.deepEqual([s.rules.early.n, s.rules.early.list], [2, [{ id: 'Z14931 27', at: '2026-10-27 1200', until: '2026-10-27 1229', by: 29 }]]);
  const page = MyStats.html(rec, { more: true });
  assert.match(page, /On duty before the booked rest was up<\/dt><dd>1 of 2 <span class="ms-pill ms-bad">check<\/span><small>Z14931 27, on duty 27 Oct 1200, rest shown until 27 Oct 1229 \(0 h 29 early\)/);
  assert.equal((page.match(/class="ms-restband"/g) || []).length, 1 + 1 + 2 + 2); // the legend, then each of the three rests on every day it touches
  assert.match(page, /the line along the bottom of a row is rest booked after a trip, as the board showed it/);
  assert.doesNotMatch(MyStats.html(rec, {}), /ms-restband|On duty before the booked rest/); // new: only when switched on
});

test('review: the place-on-board picture names a board once per stay, and says the moves in words', () => {
  const pos = [['2026-10-24 1100', 4, 'Chain Gang (SR)'], ['2026-10-25 0200', 1, 'Chain Gang (SR)'], ['2026-10-25 1216', 1, '501/502 (S5)'], ['2026-10-25 1338', 4, 'Chain Gang (SR)'], // an hour on another list: not a move
    ['2026-10-26 1848', 999, 'Chain Gang (SR)'], ['2026-10-28 0131', 7, 'Chain Gang (SR)'], ['2026-10-29 0052', 3, 'Chain Gang (SR)'], ['2026-11-03 0509', 1, '501/502 (S5)'], ['2026-11-04 0051', 999, '501/502 (S5)'],
    ['2026-11-04 1801', 1, 'Garnet'], ['2026-11-04 1809', 1, '501/502 (S5)'], ['2026-11-11 0647', 1, '501/502 (S5)']];
  const rec = blank({ from: '2026-10-24', to: '2026-11-11', turns: [{ turn: 'SR03', own: true, from: '2026-10-24', to: '2026-11-11' }], pos, trips: [{ id: 'E27861 26', at: '2026-10-26 2045', off: '2026-10-27 0429', turn: 'SR03', st: 'SARNIA' }] });
  const page = MyStats.html(rec, { more: true });
  assert.match(page, /Your place on your board over the dates picked: Chain Gang \(SR\) to 3 Nov, then 501\/502 \(S5\)\. .* An upright line is a move to another board\./);
  const chart = page.slice(page.indexOf('aria-label="Your place on the board over time'));
  const drawn = chart.slice(0, chart.indexOf('</svg>'));
  assert.equal((drawn.match(/>Chain Gang \(SR\)</g) || []).length, 1);
  assert.equal((drawn.match(/>501\/502 \(S5\)</g) || []).length, 1);
  assert.equal(drawn.includes('>Garnet<'), false);
  // One board the whole time: named, no talk of moves.
  const one = MyStats.html(blank({ ...rec, pos: pos.slice(4, 7).concat([['2026-10-30 0100', 2, 'Chain Gang (SR)']]) }), { more: true });
  assert.match(one, /over the dates picked: the Chain Gang \(SR\)\. The line climbs/);
  assert.doesNotMatch(one, /An upright line is a move/);
  // Too little to draw (two places, or under half a day): no picture rather than a misleading one.
  assert.doesNotMatch(MyStats.html(blank({ ...rec, pos: pos.slice(0, 2) }), { more: true }), /Your place on your board over the dates picked/);
});

test('review: each turn\'s on-duty times are drawn along the day, a mark a trip, by shape as well as colour', () => {
  const rec = full();
  const page = MyStats.html(rec, { more: true });
  const at = page.indexOf('aria-label="When each turn went on duty, by time of day"');
  assert.ok(at > 0);
  const drawn = page.slice(at, page.indexOf('</svg>', at));
  assert.deepEqual([(drawn.match(/class="ms-m-out"/g) || []).length, (drawn.match(/class="ms-m-home"/g) || []).length, (drawn.match(/class="ms-m-yard"/g) || []).length], [3, 3, 1]);
  assert.match(drawn, />SR04 · 7 trips</);
  assert.match(page, /<th>Turn<\/th><th>Trips<\/th>/); // the table is still under it
  assert.doesNotMatch(MyStats.html(rec, {}), /When each turn went on duty/);
});

// The site has 66 page styles. Found in the review: two set the page's pale tint
// to nothing, two switch every shadow off, eight have the same or nearly the
// same accent and amber, and in the white-on-dark ones the calendar's day
// numbers fell to 2 to 1 against their square.
test('review: the tab\'s colours hold in every page style the site has', () => {
  const fs = require('fs'); const path = require('path');
  const css = MyStats.CSS;
  assert.equal((css.match(/--plan-tint/g) || []).length, 1); // two styles set it to transparent: the tab's own --ms-pale is used, and plan-tint is only what an old phone falls back to
  // A phone too old for color-mix (iOS 15) must still get a colour for everything: no mixed colour outside the @supports block.
  assert.doesNotMatch(css.slice(0, css.indexOf('@supports (color: color-mix')), /color-mix\(/);
  assert.doesNotMatch(css, /box-shadow/); // two styles switch shadows off: outlines are used instead
  assert.match(css, /rect\.ms-k-home \{ fill: url\(#ms-hatch\) var\(--amber\); \}/); // striped, not only amber
  assert.match(css, /rect\.ms-k-yard \{[^}]*stroke: var\(--poolB\)/); // hollow, not only purple
  assert.match(MyStats.html(full(), {}), /<pattern id="ms-hatch"/);
  // Every style's own colours, read from the page: the day numbers on each calendar fill, 3 to 1 or better.
  const html = fs.readFileSync(path.join(__dirname, '../../public/board.html'), 'utf8');
  const styles = {};
  // A colour as written in the page: #rgb, #rrggbb, rgb() or rgba() (a see-through one keeps its share, laid over the style's backdrop below). Anything else: not read.
  const colour = (v) => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
    if (m) { const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
    const f = /^rgba?\(([^)]+)\)$/i.exec(v.trim());
    if (!f) return null;
    const n = f[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return n.length >= 3 && n.every(Number.isFinite) ? [n[0], n[1], n[2], n.length > 3 ? n[3] : 1] : null;
  };
  const read = (into, body) => { for (const [, k, v] of body.matchAll(/(--[a-z-]+):\s*([^;]+);/gi)) into[k] = colour(v); }; // (null: written some other way, so that style is not judged on it)
  const base = {};
  for (const [, body] of html.matchAll(/(?:^|\n)\s*:root \{([^}]*)\}/g)) read(base, body);
  for (const [, name, body] of html.matchAll(/:root\[data-theme="([a-z0-9-]+)"\] \{([^}]*)\}/g)) read(styles[name] || (styles[name] = { ...base }), body);
  styles['(light, the default)'] = base;
  for (const t of Object.values(styles)) for (const k of Object.keys(t)) { const c = t[k]; if (c && c.length === 4) t[k] = c[3] >= 1 || !t['--bg'] || t['--bg'].length === 4 ? c.slice(0, 3) : c.slice(0, 3).map((x, i) => x * c[3] + t['--bg'][i] * (1 - c[3])); }
  const lum = (c) => { const f = (x) => { const y = x / 255; return y <= 0.03928 ? y / 12.92 : ((y + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const mix = (a, b, f) => a.map((v, i) => v * f + b[i] * (1 - f));
  const share = (cls) => +new RegExp(`\\.${cls} \\{ background: color-mix\\(in srgb, var\\(--accent\\) (\\d+)%`).exec(css)[1] / 100;
  const pale = +/--ms-pale: color-mix\(in srgb, var\(--ink\) (\d+)%/.exec(css)[1] / 100;
  assert.deepEqual([share('ms-s1'), share('ms-s2'), share('ms-s3'), pale], [0.12, 0.25, 0.85, 0.1]);
  let checked = 0;
  for (const [name, t] of Object.entries(styles)) {
    const need = ['--ink', '--soft', '--sheet', '--accent', '--accent-ink'].every((k) => t[k]);
    if (!need) continue;
    checked++;
    const [ink, soft, sheet, accent, aink] = ['--ink', '--soft', '--sheet', '--accent', '--accent-ink'].map((k) => t[k]);
    for (const [what, r] of [['under 4 h', ratio(ink, mix(accent, sheet, share('ms-s1')))], ['4 to 8 h', ratio(ink, mix(accent, sheet, share('ms-s2')))], ['8 to 12 h', ratio(aink, mix(accent, sheet, share('ms-s3')))],
      ['12 h or more', ratio(aink, accent)], ['no duty', ratio(soft, sheet)], ['soft ink on the pale fill', ratio(soft, mix(ink, sheet, pale))], ['the accent on the pale fill', ratio(accent, mix(ink, sheet, pale))]]) {
      assert.ok(r >= 3, `${name}: ${what} is ${r.toFixed(1)} to 1`);
    }
  }
  assert.ok(checked >= 60, `only ${checked} page styles could be read`);
});

// Owner, 2026-11-12, asked "Show the new sections to every member?": "Push it".
// Before that they were on the test site only ("Do not switch anything on or
// off for members without asking me"): changing either switch is his to say.
test('review: the new sections are on for every signed-in member, and the page hands the tab what they need', () => {
  const html = require('fs').readFileSync(require.resolve('../../public/board.html'), 'utf8');
  assert.match(html, /\n  const MINE_ALL = true;\n/);
  assert.match(html, /\n  const MINE_MORE = true;\n/);
  assert.match(html, /const more = MINE_MORE \|\| PREVIEW;/);
  assert.match(html, /const poolsAsked = more \? getJSON\('data\/pools\.json'\)/); // the pool averages are only fetched for the comparison
  // The yard pieces and the owner's look at another code (owner, 2026-11-13: "Push to the test site. Also build in the
  // ability to search other name codes so I can see other My Stats pages"; then 2026-11-14, "do 1-3 5"): the yard
  // pieces for every member, the look for the owner key, both sites.
  assert.match(html, /BoardMyStats\.html\(d\.stats, \{ range: mineRange, code: d\.code, more, pools, now, yard: true, yardJobs, other: !!d\.other \}\)/);
  // Still the member's own record and nothing else: no code or hash goes in the request, but the owner's.
  assert.match(html, /const look = membersOwner \? mineLook : '';/);
  assert.match(html, /fetch\(look \? `auth\/stats\?code=\$\{encodeURIComponent\(look\)\}` : 'auth\/stats'/);
  assert.doesNotMatch(html.slice(html.indexOf('async function renderMine()'), html.indexOf('async function renderMembers(')), /accounts\/stats|people\.json/);
});

// --- Kept from one build to the next ---------------------------------------------

// Found (before it could show): a trip on duty the evening before the first day
// the site still keeps is in the kept record and in the new build, so from the
// 31st day of saved checks it would have been counted twice.
test('review: a trip from the evening before the build\'s first day is kept once, with what both knew', () => {
  const old = blank({ from: '2026-10-24', to: '2026-11-22', turns: [{ turn: 'SR04', own: true, from: '2026-10-24', to: '2026-11-22' }],
    trips: [{ id: 'E27861 24', at: '2026-10-24 0800', off: '2026-10-24 1800', turn: 'SR04', st: 'SARNIA' },
      { id: 'E27861 25', at: '2026-10-25 2200', turn: 'SR04', st: 'SARNIA', plan: '2026-10-25 2000', pc: 0, call: { exp: '2026-10-25 2000', first: '2026-10-25 2000', got: '2026-10-25 2000', off: 0, n: 0 } }], // still out when the 25th was last built
    unk: [{ job: 'YBHS01', from: '2026-10-24', to: '2026-10-28' }] });
  const fresh = blank({ from: '2026-10-25', to: '2026-11-23', turns: [{ turn: 'SR04', own: true, from: '2026-10-26', to: '2026-11-23' }],
    trips: [{ id: 'E27861 25', at: '2026-10-25 2200', off: '2026-10-26 0730', turn: 'SR04', st: 'SARNIA' }, { id: 'Z14931 26', at: '2026-10-26 1900', off: '2026-10-27 0400', turn: 'SR04', st: 'TORONTO' }],
    unk: [{ job: 'YBHS01', from: '2026-10-26', to: '2026-10-28' }] });
  const joined = MyStats.merge(old, fresh, '2026-10-26');
  assert.deepEqual(joined.trips.map((t) => t.id), ['E27861 24', 'E27861 25', 'Z14931 26']);
  assert.deepEqual(joined.trips[1], { id: 'E27861 25', at: '2026-10-25 2200', turn: 'SR04', st: 'SARNIA', plan: '2026-10-25 2000', pc: 0, call: old.trips[1].call, off: '2026-10-26 0730' });
  assert.deepEqual(MyStats.merge(joined, fresh, '2026-10-26'), joined); // and again the next check: no change
  // The yard days nobody recorded: kept up to the build's first day, then the build's.
  assert.deepEqual(joined.unk, [{ job: 'YBHS01', from: '2026-10-24', to: '2026-10-25' }, { job: 'YBHS01', from: '2026-10-26', to: '2026-10-28' }]);
  assert.equal(MyStats.stats(joined).unknown.days, 1); // the 24th to the 27th each had duty on them, so only the 28th is not known
  assert.equal(joined.from, '2026-10-24');
});

test('review: every run of a yard job is kept apart, with the turns its crew lines showed', () => {
  const yard = {};
  Files.collectYard(yard, [
    { taken: '2026-11-04 1400', yardJobs: [{ job: 'YBHS31', onDuty: '4th 1600', crew: 'S1 B109 · S2 SA01' }] },
    { taken: '2026-11-04 1500', sameUntil: '2026-11-04 2330', yardJobs: [{ job: 'YBHS31', onDuty: '4th 1600', crew: 'S1 B109' }] }, // nothing changed until 2330
    { taken: '2026-11-05 1400', yardJobs: [{ job: 'YBHS31', onDuty: '5th 1600', crew: '' }, { job: 'YMPS31', onDuty: '', crew: 'S1 B111' }] },
  ]);
  const on4 = m('2026-11-04 1600'); const on5 = m('2026-11-05 1600');
  // gone (the first check without the run) and crew (the turns on its crew lines): for the test site's yard pieces (owner, 2026-11-13).
  assert.deepEqual(yard.runs, { YBHS31: { [on4]: { on: on4, first: m('2026-11-04 1400'), last: m('2026-11-04 2330'), crew: ['S1 B109', 'S2 SA01'], gone: m('2026-11-05 1400') }, [on5]: { on: on5, first: m('2026-11-05 1400'), last: m('2026-11-05 1400') } } });
  assert.deepEqual(Object.keys(yard.byTurn).sort(), ['B109', 'SA01']);
  assert.deepEqual(yard.byTurn.B109[`YBHS31/${on4}`], { job: 'YBHS31', on: on4, cc: 'S1', first: m('2026-11-04 1400'), last: m('2026-11-04 2330') });
  assert.equal(yard.byTurn.SA01[`YBHS31/${on4}`].last, m('2026-11-04 1400'));
});

test('review: the site build passes the checker\'s yard-duty mark on to the reset tracker', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { buildSite } = require('../../lib/board/site');
  const check = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/board/2026-10-15.json'), 'utf8'));
  const dayFile = (extra) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'board-mystats-yard-'));
    fs.mkdirSync(path.join(root, 'history', '2026-10-15'), { recursive: true });
    fs.writeFileSync(path.join(root, 'history', '2026-10-15', '0143.json'), JSON.stringify({ ...check, ...extra }));
    buildSite({ historyDir: path.join(root, 'history'), outDir: path.join(root, 'site'), days: 0, now: new Date('2026-10-16T12:00:00Z') });
    return JSON.parse(fs.readFileSync(path.join(root, 'site', 'data', '2026-10-15.json'), 'utf8')).resets;
  };
  assert.equal(dayFile({}).yardFrom, undefined); // a check saved before the change
  const marked = dayFile({ yardDuty: 1 });
  assert.equal(marked.yardFrom, marked.last);
});

test('review: the site build publishes the pools file beside the data, with no person in it', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { buildSite } = require('../../lib/board/site');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'board-mystats-pools-'));
  const hist = path.join(root, 'history');
  fs.mkdirSync(path.join(hist, '2026-10-15'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../fixtures/board/2026-10-15.json'), path.join(hist, '2026-10-15', '0143.json'));
  const built = buildSite({ historyDir: hist, outDir: path.join(root, 'site'), days: 0, now: new Date('2026-10-16T12:00:00Z') });
  assert.equal((built.skipped || []).some((x) => /my stats/.test(x)), false);
  const pools = JSON.parse(fs.readFileSync(path.join(root, 'site', 'data', 'pools.json'), 'utf8'));
  // yard: the yard workers' figures for the test site's "You and the yard" (owner, 2026-11-13: "Let's do that. Push to
  // the test site"); and the yard jobs' own runs beside it. Neither has a person in it.
  assert.deepEqual(Object.keys(pools), ['from', 'to', 'pools', 'yard']);
  assert.doesNotMatch(JSON.stringify(pools), /[0-9a-f]{16}/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'site', 'data', 'yardjobs.json'), 'utf8'), /[0-9a-f]{16}/);
});
