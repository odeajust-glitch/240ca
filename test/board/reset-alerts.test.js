// Reset alerts (owner, 2026-11-03): whoever would get the train or job if
// the turn projected for it is put on a mandatory reset at the call.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const RA = require('../../lib/board/reset-alerts');
const { loadSummary } = require('../../lib/board/summary');
const { runBoardCheck } = require('../../lib/board/engine');
const { at } = require('../../lib/board/time');

const H = 60;

test('Chain Gang: the next turn in line is told (real 2026-10-15 check)', () => {
  const input = loadSummary(JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/board/2026-10-15.json'), 'utf8')));
  const run = (i) => runBoardCheck({ ...i, me: null });
  const result = run(input);
  const job = [...RA.assignments(input, result).values()].find((a) => a.turn === 'SR09');
  // Under 24 h left at the call: likely reset; SR03 is next.
  const { events, told } = RA.resetEvents({ input, result, run, resets: { SR09: { due: job.call + 10 * H } }, now: input.now });
  assert.deepEqual(events.map((e) => [e.turn, e.about, e.level]), [['SR03', 'SR09', 'will']]);
  assert.match(events[0].text, /^SR09 needs a reset by .* likely to be put on it when called for M39671 14 .* SR03 is next for it/);
  // Once per train.
  assert.equal(RA.resetEvents({ input, result, run, resets: { SR09: { due: job.call + 10 * H } }, now: input.now, told }).events.length, 0);
  // 24–48 h at the call: a heads-up. 48 h+: nothing. Already on a reset: nothing.
  assert.equal(RA.resetEvents({ input, result, run, resets: { SR09: { due: job.call + 30 * H } }, now: input.now }).events[0].level, 'could');
  assert.equal(RA.resetEvents({ input, result, run, resets: { SR09: { due: job.call + 50 * H } }, now: input.now }).events.length, 0);
  assert.equal(RA.resetEvents({ input, result, run, resets: { SR09: { due: job.call + 10 * H, ahead: job.call } }, now: input.now }).events.length, 0);
});

// A B-pool train: the B turn on a reset goes spare (the A/B rule), and the
// conductor slow board's next spare fills it.
const order = at(2026, 11, 3, 15, 38);
const call = order - 15 - 2 * H;
const bTrain = (spare) => ({ predictions: [{ symbol: 'M38261', originDay: '03', order, call, pool: 'B', turn: 'SB04', spare, engineer: 'S304', engineerSpare: false }] });
const boards = { coSlow: [{ turn: 'B111', pos: 1 }, { turn: 'B133', pos: 2 }], enSlow: [{ turn: 'EN01', pos: 1 }] };

test('B pool: the spare who would fill the job is told', () => {
  const input = { spareboards: boards, vacancies: [] };
  const run = (i) => (i.spareboards ? bTrain(true) : bTrain(false));
  const now = call - 6 * H;
  const will = RA.resetEvents({ input, result: bTrain(false), run, resets: { SB04: { due: call + 20 * H } }, now });
  assert.deepEqual(will.events.map((e) => [e.turn, e.level]), [['B111', 'will']]);
  const could = RA.resetEvents({ input, result: bTrain(false), run, resets: { SB04: { due: call + 30 * H } }, now });
  assert.deepEqual(could.events.map((e) => [e.turn, e.level]), [['B111', 'could']]);
  assert.match(could.events[0].text, /^Heads-up: SB04 has under 48 h before a reset/);
});

test('spareboard: the next spare is told when the deadline falls inside the job', () => {
  const yardAt = at(2026, 11, 3, 22, 45);
  // Yard jobs come off the fast board.
  const input = { spareboards: { coFast: [{ turn: 'B111', pos: 1 }, { turn: 'B133', pos: 2 }] }, vacancies: [{ train: 'YPRS60', at: yardAt, cc: 'CO', yard: true, pos: 1, status: 'PLANNED' }], yardJobs: [], callBoard: [] };
  const run = () => ({ predictions: [] });
  const now = yardAt - 5 * H;
  // B111 fills it; needed by 4th 0300, before the 8 h shift ends (0645): B133 next.
  const e = RA.resetEvents({ input, result: { predictions: [] }, run, resets: { B111: { due: yardAt + 4 * H } }, now }).events;
  assert.deepEqual(e.map((x) => [x.turn, x.about, x.level]), [['B133', 'B111', 'will']]);
  // Needed after the shift: fine, nothing (no 24–48 h heads-up for spares).
  assert.equal(RA.resetEvents({ input, result: { predictions: [] }, run, resets: { B111: { due: yardAt + 9 * H } }, now }).events.length, 0);
});

test('a reset scenario puts that turn (that craft on 501/502) on rest for 32 h', () => {
  const input = { chainGangHome: [{ turn: 'SR03', restUntil: null }], s5: [{ turn: 'S501', craft: 'CO' }, { turn: 'S501', craft: 'EN' }], spareboards: { coSlow: [{ turn: 'B111' }] } };
  const a = RA.withReset(input, 'SR03', 1000);
  assert.equal(a.chainGangHome[0].restUntil, 1000 + 32 * H);
  const b = RA.withReset(input, 'S501-CO', 1000);
  assert.deepEqual(b.s5.map((t) => t.restUntil), [1000 + 32 * H, undefined]);
});
