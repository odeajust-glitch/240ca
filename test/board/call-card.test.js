// The call card (owner, 2026-11-12; a test-site preview): one call in plain
// words. "A person should be able to tell at a glance: when they expected to
// be called, when they were called, how much it moved, how much warning they
// got, and why it moved if the board shows why."
//
// Every record here is made up, in the shape lib/board/insights.js saves
// them; the two that copy a real call say so. Turn ids and train ids only.
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../../public/board-analytics');
const T = require('../../public/board-trains');

// Lined up on the 10th at 0900 for the 11th at 1900. At 0855 on the 11th the
// board first showed the call 8 hours or less away: 1655. At 1400 it moved to
// 1500, and the call came at 1500 (on duty 1700).
const base = {
  turn: 'SR07', train: 'M39671 10', expectedTrain: 'M39671 10', firstTrain: 'M39671 10',
  firstSeen: '2026-11-10 0900', firstCall: '2026-11-11 1900', firstWhy: 'M39671 10 first showed on the line-up at this check',
  sleepAt: '2026-11-11 0855', expected: '2026-11-11 1655', noWindow: false, short: false, notice: 480,
  call: '2026-11-11 1500', onDuty: '2026-11-11 1700', seen: '2026-11-11 1710', off: -115,
  timelineChanges: [
    { taken: '2026-11-11 0855', call: '2026-11-11 1655', train: 'M39671 10', why: "M39671 10's own time moved" },
    { taken: '2026-11-11 1400', call: '2026-11-11 1500', train: 'M39671 10', why: "M39671 10's own time moved" },
  ],
  shifts: [{ taken: '2026-11-11 1400', call: '2026-11-11 1500', train: 'M39671 10' }], timelineComplete: true,
};
const has = (html, list) => { for (const t of list) assert.ok(html.includes(t), `missing: ${t}\n${html}`); };
const lacks = (html, list) => { for (const t of list) assert.ok(!html.includes(t), `should not be there: ${t}`); };
const text = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('expected is the eight-hour figure the site already keeps; the first time shown sits beside it', () => {
  const c = A.callCard(base);
  assert.equal(c.eight, true);
  assert.equal(T.fromMin(c.lead), '2026-11-11 1655');
  assert.equal(T.fromMin(c.shown), '2026-11-11 1900');
  // The same number the eight-hour baseline has always scored (z.off), not a new one.
  assert.equal(c.gap, base.off);
  const w = A.callWords(c);
  assert.equal(w.head, 'Called 1 h 55 m earlier than expected');
  assert.equal(w.result, '1 h 55 m earlier');
  assert.equal(w.resultTone, 'bad');
  assert.equal(w.warning, '');
  const html = A.renderCallCard(base);
  has(html, ['class="callcard"', 'SR07 · M39671 10', '<dt>Expected</dt>', '<b>11th 1655</b>', 'the time on the board 8 hours ahead', 'first shown as 11th 1900',
    '<dt>Called</dt>', '<b>11th 1500</b>', '1 h 55 m earlier', '<dt>Warning</dt>', '<b>30 h</b>', 'from being lined up, 10th 0900', 'the time last changed 1 h before the call',
    '<dt>Why</dt>', 'The time moved once, the last 1 h before the call.', 'Every change the board showed (2)', 'How this is worked out']);
  // No jargon and no key to decode.
  lacks(text(html), ['baseline', 'planned', 'window', 'notice', 'Marker', 'Recorded changes', 'About this timeline', 'White bar', 'NaN', 'undefined']);
});

test('how far ahead the board really showed the expected time is said as it was', () => {
  // Lined up fresh with the call already inside 8 hours.
  const fresh = { ...base, firstSeen: '2026-11-11 1245', firstCall: '2026-11-11 1655', sleepAt: '2026-11-11 1245', short: true, call: '2026-11-11 1655', onDuty: '2026-11-11 1855', timelineChanges: [], shifts: [] };
  has(A.renderCallCard(fresh), ['the time on the board when lined up, 4 h 10 m ahead']);
  // On the line-up for a far-off time, then the board jumped to a close one (B139 on YBHS01, 7 November: 43 minutes ahead).
  const jumped = { ...base, sleepAt: '2026-11-11 1612', timelineChanges: [{ taken: '2026-11-11 1612', call: '2026-11-11 1655', train: 'M39671 10' }], shifts: [], call: '2026-11-11 1655', onDuty: '2026-11-11 1855' };
  has(A.renderCallCard(jumped), ['on the board at 11th 1612, 43 min ahead', 'first shown as 11th 1900']);
  // Out of Toronto the wait starts at going off duty.
  const toronto = { ...fresh, firstFrom: 'offDuty', firstWhy: 'off duty at the Toronto bunkhouse; M39671 10 was already on the line-up' };
  has(A.renderCallCard(toronto), ['the time on the board when going off duty, 4 h 10 m ahead', 'from going off duty at Toronto, 11th 1245', 'Went off duty at Toronto 4 h 10 m before the call, with the train already on the line-up.', '>Off duty<']);
});

test('a call that came before the board showed it 8 hours away is measured from the first time shown', () => {
  // The owner's own example (2026-11-10): EN09 on YMXS02, first lined 8th 1412 for 9th 0205, called 8th 1500.
  const z = { turn: 'EN09', train: 'YMXS02', expectedTrain: 'M39491', firstTrain: 'M39491', firstSeen: '2026-11-08 1412', firstCall: '2026-11-09 0205', firstWhy: 'M39491 first showed going spare at this check',
    expected: '2026-11-08 1500', sleepAt: null, noWindow: true, call: '2026-11-08 1500', onDuty: '2026-11-08 1700', off: 0,
    timelineChanges: [{ taken: '2026-11-08 1421', call: '2026-11-08 1500', train: 'YMXS02', why: 'EN05 had it before, now on M39491; M39491 is off the spare list' }], shifts: [], timelineComplete: true };
  const c = A.callCard(z);
  assert.equal(c.eight, false);
  assert.equal(T.fromMin(c.lead), '2026-11-09 0205');
  assert.equal(c.gap, -665);
  assert.equal(A.callWords(c).head, 'Called with 48 min warning');
  assert.equal(A.callWords(c).warning, '48 min warning');
  const html = A.renderCallCard(z);
  has(html, ['<b>9th 0205</b>', 'the first time the board gave', '11 h 05 m earlier', '<b>48 min</b>', 'The job first showed as going spare 48 min before the call.', 'Moved from M39491 to YMXS02 39 min before the call.',
    'because the call came before the board had shown it 8 hours or less away']);
});

test('under 8 hours of warning leads the headline, for an on-time or a late call too', () => {
  const lined = { ...base, firstSeen: '2026-11-11 1000', firstCall: '2026-11-11 1700', sleepAt: '2026-11-11 1000', expected: '2026-11-11 1700', short: true, notice: 420, firstWhy: 'SR08 had it before, now on Z14931 11', timelineChanges: [], shifts: [] };
  const onTime = A.callCard({ ...lined, call: '2026-11-11 1700', onDuty: '2026-11-11 1900' });
  assert.equal(A.callWords(onTime).head, 'Called with 7 h warning');
  assert.equal(A.callWords(onTime).result, 'when expected');
  assert.equal(A.callWords(onTime).tone, 'var(--stop)');
  const late = { ...lined, call: '2026-11-11 1730', onDuty: '2026-11-11 1930' };
  assert.equal(A.callWords(A.callCard(late)).head, 'Called with 7 h 30 m warning');
  has(A.renderCallCard(late), ['30 min later (30 min either way counts as expected)', 'Lined up in place of SR08, who was moved to Z14931 11, 7 h 30 m before the call.']);
  // Eight hours or more is not short: the headline goes back to how far it moved.
  const long = A.callCard({ ...lined, call: '2026-11-11 1900', onDuty: '2026-11-11 2100' });
  assert.equal(long.short, false);
  assert.equal(A.callWords(long).head, 'Called 2 h later than expected');
  assert.equal(A.callWords(long).tone, '#a78bfa');
});

test('within 30 minutes reads as called when expected, and says when the time moved in between', () => {
  const calm = { ...base, call: '2026-11-11 1715', onDuty: '2026-11-11 1915', off: 20, timelineChanges: [base.timelineChanges[0]], shifts: [] };
  const c = A.callCard(calm);
  assert.equal(c.within, true);
  assert.equal(c.after, 0);
  assert.equal(A.callWords(c).head, 'Called when expected');
  assert.equal(A.callWords(c).tone, 'var(--go)');
  assert.equal(A.callWords(c).result, 'when expected');
  has(A.renderCallCard(calm), ['20 min later (30 min either way counts as expected)']);
  // Nothing moved after the 8-hour point: nothing to explain.
  lacks(A.renderCallCard(calm), ['<dt>Why</dt>']);
  // The board went to 2100 and back inside the last 8 hours: still called when expected, and it says so.
  const shaky = { ...calm, timelineChanges: [base.timelineChanges[0], { taken: '2026-11-11 1000', call: '2026-11-11 2100', train: 'M39671 10' }, { taken: '2026-11-11 1500', call: '2026-11-11 1700', train: 'M39671 10' }] };
  assert.equal(A.callCard(shaky).after, 2);
  assert.equal(A.callWords(A.callCard(shaky)).head, 'Called when expected, after 2 changes');
  has(A.renderCallCard(shaky), ['The time moved twice.', 'the time changed (3 times, 2 of them in the last 8 hours)']);
  // A move before the 8-hour point is history, not a change after it.
  const early = { ...calm, timelineChanges: [{ taken: '2026-11-10 1500', call: '2026-11-11 2300', train: 'M39671 10' }, base.timelineChanges[0]] };
  assert.equal(A.callCard(early).after, 0);
  assert.equal(A.callWords(A.callCard(early)).head, 'Called when expected');
  has(A.renderCallCard(early), ['the time changed (twice, all before the last 8 hours)']);
  // Exactly on the minute.
  has(A.renderCallCard({ ...calm, call: '2026-11-11 1655', onDuty: '2026-11-11 1855' }), ['right on time']);
});

test('the card says what the board was showing when the call came', () => {
  // No change at all: the board still had the old time.
  const still = { ...base, timelineChanges: [base.timelineChanges[0]], shifts: [] };
  assert.equal(A.callLastWord(A.callCard(still)), 'the board still showed 11th 1655 when the call came');
  has(A.renderCallCard(still), ['the board still showed 11th 1655 when the call came', 'The board showed no change before the call.']);
  // Changed an hour before.
  assert.equal(A.callLastWord(A.callCard(base)), 'the time last changed 1 h before the call');
  // Long settled: nothing to add.
  const settled = { ...base, call: '2026-11-11 1655', onDuty: '2026-11-11 1855', timelineChanges: [{ taken: '2026-11-10 1000', call: '2026-11-11 1655', train: 'M39671 10' }], shifts: [] };
  assert.equal(A.callLastWord(A.callCard(settled)), '');
  // Left on the line-up past its time.
  const stale = { ...still, call: '2026-11-11 1900', onDuty: '2026-11-11 2100' };
  has(A.renderCallCard(stale), ['Called 2 h 05 m later than expected', 'It stayed on the line-up 2 h 05 m past its time before the call came.']);
});

test('taken off before the call: the headline says so and the reason comes first', () => {
  const off = { ...base, call: undefined, takenOff: true, onDuty: '2026-11-11 1410', seen: '2026-11-11 1410', lastListed: '2026-11-11 1400', timelineChanges: [base.timelineChanges[0]], shifts: [],
    ownStatus: 'rest until 12th 0100', replacedBy: 'S109', replacedWhy: 'moved from E27861 11' };
  const c = A.callCard(off);
  assert.equal(c.off, true);
  assert.equal(c.gap, null);
  assert.equal(A.callWords(c).head, 'Taken off before the call');
  assert.equal(A.callWords(c).result, 'taken off before the call');
  const html = A.renderCallCard(off);
  has(html, ['Taken off before the call', '<dt>Taken off</dt>', '<b>11th 1410</b>', 'after 29 h 10 m on the line-up', 'SR07 then showed: rest until 12th 0100. S109 was lined up for M39671 10 instead (moved from E27861 11).', 'Taken off 11th 1410', 'stroke-dasharray', 'the rest of those 8 hours, not used']);
  lacks(html, ['<dt>Warning</dt>', '<dt>Called</dt>', '#a78bfa']);
  // The job itself pulled.
  has(A.renderCallCard({ ...off, ownStatus: '', replacedBy: '', replacedWhy: '', jobDropped: 'M39671 10' }), ['M39671 10 came off the line-up without being called, and nothing replaced it.']);
  // Nothing saved: said plainly, not guessed.
  has(A.renderCallCard({ ...off, ownStatus: '', replacedBy: '', replacedWhy: '' }), ['The board did not show a reason.']);
  // The other craft on a 501/502 was on the job all along: not a replacement.
  const mate = A.callWhy(A.callCard({ ...off, turn: 'S502-CO', ownStatus: '** goes spare, return 12th 2111', replacedBy: 'S502-EN', replacedWhy: '' }));
  assert.equal(mate, 'S502-CO then showed: ** goes spare, return 12th 2111.');
});

test('a job shown with and without its day is the same job, not another train', () => {
  // 43 saved records read "Called for DHT130B 09 … not the DHT130B they were lined up for".
  const z = { ...base, turn: 'B123', train: 'DHT130B 09', expectedTrain: 'DHT130B', firstTrain: 'DHT130B', firstSeen: '2026-11-09 0600', firstCall: '2026-11-09 1100', sleepAt: '2026-11-09 0600', expected: '2026-11-09 1100', short: true,
    firstWhy: 'DHT130B first showed going spare at this check', call: '2026-11-09 1100', onDuty: '2026-11-09 1300', calledWhy: 'Called for DHT130B 09, working SR11, not the DHT130B they were lined up for; SR11 was lined up for it: rest until 9th 1800',
    timelineChanges: [], shifts: [] };
  const c = A.callCard(z);
  const why = A.callWhy(c);
  assert.equal(why, 'The job first showed as going spare 5 h before the call. Filled in for SR11.');
  const story = A.callStory(c);
  assert.equal(story[story.length - 1].why, 'working SR11; SR11 was lined up for it: rest until 9th 1800');
  lacks(A.renderCallCard(z), ['not the DHT130B', 'Moved from DHT130B', 'still showing']);
  // A different job really is one: called for a train the board was not showing.
  const other = { ...base, train: 'X27861 11', calledWhy: 'Called for X27861 11, not the M39671 10 they were lined up for; SD04 was lined up for it, now on M30241 10' };
  has(A.renderCallCard(other), ['Called for X27861 11; the board was still showing M39671 10 (SD04 had been lined up for it).', 'Called for X27861 11, not the M39671 10 they were lined up for; SD04 was lined up for it, now on M30241 10']);
});

test('moves between trains are told from when expected was set, up to the call', () => {
  const moved = { ...base, train: 'E27861 11', call: '2026-11-11 1500', timelineChanges: [
    { taken: '2026-11-10 1200', call: '2026-11-11 2000', train: 'Z14891 10', why: 'traded places with SA09, who is on M39671 10 now' }, // before the 8-hour point: history
    { taken: '2026-11-11 0855', call: '2026-11-11 1655', train: 'M39671 10', why: 'traded places with SA09, who is on Z14891 10 now' },
    { taken: '2026-11-11 1300', call: '2026-11-11 1500', train: 'E27861 11', dropped: 'M39671 10', droppedFrom: 'line-up', why: 'M39671 10 is off the line-up' },
    { taken: '2026-11-11 1520', call: '2026-11-11 2200', train: 'A42431 12', why: 'E27861 11 is off the line-up' }, // after the call: the board, not the reason
  ] };
  const c = A.callCard(moved);
  assert.equal(A.callWhy(c), 'M39671 10 was pulled without a call; moved to E27861 11 2 h before the call.');
  has(A.renderCallCard(moved), ['job pulled without a call', 'Every change the board showed (4)']);
  // The fold has all of it, in order, each with the reason the tracker saved.
  const story = A.callStory(c);
  assert.deepEqual(story.map((l) => l.when), ['10th 0900', '10th 1200', '11th 0855', '11th 1300', '11th 1500', '11th 1520']);
  assert.equal(story[0].text, 'First lined up for M39671 10, call 11th 1900');
  assert.equal(story[1].text, 'Moved to Z14891 10, call 11th 2000');
  assert.equal(story[3].text, 'M39671 10 was pulled without a call; moved to E27861 11, call 11th 1500');
  assert.equal(story[3].why, 'M39671 10 is off the line-up');
  assert.equal(story[4].text, 'Called for E27861 11 (on duty 11th 1700, less 2 hours)');
  // Back and forth, ending where it started.
  const shuffle = { ...base, call: '2026-11-11 1655', onDuty: '2026-11-11 1855', timelineChanges: [base.timelineChanges[0],
    { taken: '2026-11-11 1000', call: '2026-11-11 2100', train: 'Z14891 10' }, { taken: '2026-11-11 1100', call: '2026-11-11 1655', train: 'M39671 10' }] };
  assert.equal(A.callWhy(A.callCard(shuffle)), 'Moved between trains twice, ending back on M39671 10.');
  assert.equal(A.callWords(A.callCard(shuffle)).head, 'Called when expected, after 2 changes');
  // A spare's job coming off the spare list is the vacancy closing.
  const closed = { ...base, timelineChanges: [base.timelineChanges[0], { taken: '2026-11-11 1200', call: '2026-11-11 1655', train: 'M39671 10', dropped: 'M39671 10', droppedFrom: 'spare list', only: true }, base.timelineChanges[1]] };
  has(A.callWhy(A.callCard(closed)), ['M39671 10 closed without a call.']);
  // An ordered time that moved.
  const ordered = { ...base, timelineChanges: [base.timelineChanges[0], { taken: '2026-11-11 1300', call: '2026-11-11 1655', train: 'M39671 10', ordered: true }, { taken: '2026-11-11 1400', call: '2026-11-11 1500', train: 'M39671 10', ordered: true, orderFrom: '2026-11-11 1655' }] };
  assert.equal(A.callWhy(A.callCard(ordered)), 'The time moved once (after it was ordered), the last 1 h before the call.');
  assert.deepEqual(A.callStory(A.callCard(ordered)).slice(2, 4).map((l) => l.text), ['Ordered, call 11th 1655', 'Ordered time moved 11th 1655 → 11th 1500']);
});

// The three real calls where today's eight-hour figure gives a misleading answer. Today's rule stays the
// default (the owner decides); opts.rule 'before' is the proposal: what the board showed 8 hours before the
// call came, or when lined up if that was later.
test('today’s rule is the default, and the proposed rule reads the three awkward real calls the way they went', () => {
  // SB05 on X30241 17 (19 October): 20th 1055 on the board until the call at 19th 2300; the check ten minutes
  // AFTER the call showed 2300 and became the eight-hour figure.
  const sb05 = { turn: 'SB05', train: 'X30241 17', expectedTrain: 'X30241 17', firstTrain: 'X30241 17', firstSeen: '2026-10-19 0600', firstCall: '2026-10-20 1055',
    sleepAt: '2026-10-19 2310', expected: '2026-10-19 2300', noWindow: false, short: false, call: '2026-10-19 2300', onDuty: '2026-10-20 0100', off: 0,
    timelineChanges: [{ taken: '2026-10-19 2310', call: '2026-10-19 2300', train: 'X30241 17', ordered: true }], shifts: [], timelineComplete: true };
  const now = A.callCard(sb05);
  assert.equal(now.rule, 'eight');
  assert.equal(now.gap, sb05.off); // unchanged: exactly the site's own figure
  assert.equal(A.callWords(now).head, 'Called when expected');
  has(A.renderCallCard(sb05), ['<b>19th 2300</b>', 'on the board only from 19th 2310, after the call', 'first shown as 20th 1055', 'the board still showed 20th 1055 when the call came']);
  const then = A.callCard(sb05, { rule: 'before' });
  assert.equal(T.fromMin(then.lead), '2026-10-20 1055');
  assert.equal(then.gap, -715);
  assert.equal(A.callWords(then).head, 'Called 11 h 55 m earlier than expected');
  has(A.renderCallCard(sb05, { rule: 'before' }), ['<b>20th 1055</b>', 'what the board showed 8 hours before the call', '11 h 55 m earlier', 'what the board was showing at 19th 1500, 8 hours before the call came']);

  // EN09 on YMXS02 (8 November, the owner's own example): lined up 1412 for 0205 the next morning; the board
  // flipped to 1500 at 1421, and the call came at 1500.
  const en09 = { turn: 'EN09', train: 'YMXS02', expectedTrain: 'YMXS02', firstTrain: 'M39491', firstSeen: '2026-11-08 1412', firstCall: '2026-11-09 0205', firstWhy: 'M39491 first showed going spare at this check',
    sleepAt: '2026-11-08 1421', expected: '2026-11-08 1500', noWindow: false, short: false, call: '2026-11-08 1500', onDuty: '2026-11-08 1700', off: 0,
    timelineChanges: [{ taken: '2026-11-08 1421', call: '2026-11-08 1500', train: 'YMXS02', why: 'EN05 had it before, now on M39491; M39491 is off the spare list' }], shifts: [], timelineComplete: true };
  // Today's rule: the headline is the warning, the figure is the flipped time, and the card says when it appeared.
  assert.equal(A.callWords(A.callCard(en09)).head, 'Called with 48 min warning');
  assert.equal(A.callCard(en09).gap, 0);
  has(A.renderCallCard(en09), ['<b>8th 1500</b>', 'on the board at 8th 1421, 39 min ahead', 'first shown as 9th 0205', 'right on time']);
  // Proposed: against the time it was lined up for.
  const en = A.callCard(en09, { rule: 'before' });
  assert.equal(T.fromMin(en.lead), '2026-11-09 0205');
  assert.equal(en.gap, -665);
  assert.equal(A.callWords(en).head, 'Called with 48 min warning');
  assert.equal(A.callWords(en).result, '11 h 05 m earlier');
  has(A.renderCallCard(en09, { rule: 'before' }), ['<b>9th 0205</b>', 'the time on the board when lined up, 48 min before the call', '11 h 05 m earlier', 'Moved from M39491 to YMXS02 39 min before the call.']);

  // SR02 on X39291 05 (7 November), cut down to what matters: a 0241 that was on the board for 23 minutes the
  // evening before became the eight-hour figure; the board then said 1234, later 1523, and the call came at 1710.
  const sr02 = { turn: 'SR02', train: 'X39491 06', expectedTrain: 'M39491 06', firstTrain: 'M38261 07', firstSeen: '2026-11-06 1506', firstCall: '2026-11-07 1245',
    sleepAt: '2026-11-06 2006', expected: '2026-11-07 0241', noWindow: false, short: false, call: '2026-11-07 1710', onDuty: '2026-11-07 1910', off: 869,
    timelineChanges: [{ taken: '2026-11-06 2006', call: '2026-11-07 0241', train: 'M39491 06' }, { taken: '2026-11-06 2029', call: '2026-11-07 1234', train: 'X39491 06' }, { taken: '2026-11-07 0852', call: '2026-11-07 1523', train: 'X39491 06' }],
    shifts: [], timelineComplete: true };
  assert.equal(A.callWords(A.callCard(sr02)).head, 'Called 14 h 29 m later than expected');
  const sr = A.callCard(sr02, { rule: 'before' });
  assert.equal(T.fromMin(sr.asOf), '2026-11-07 0910');
  assert.equal(T.fromMin(sr.lead), '2026-11-07 1523');
  assert.equal(A.callWords(sr).head, 'Called 1 h 47 m later than expected');

  // A call whose time never moved reads the same either way.
  const steady = { ...base, firstCall: '2026-11-11 1655', timelineChanges: [], shifts: [] };
  assert.equal(A.callCard(steady, { rule: 'before' }).gap, A.callCard(steady).gap);
  assert.equal(A.callWords(A.callCard(steady, { rule: 'before' })).head, 'Called 1 h 55 m earlier than expected');
  // One that moved inside the 8 hours before the call is measured from what the board said at that point:
  // at 0700 it still said 1900 (it went to 1655 at 0855), so the proposed rule reads 4 hours, today's 1 h 55 m.
  assert.equal(A.callWords(A.callCard(base, { rule: 'before' })).head, 'Called 4 h earlier than expected');
  assert.equal(A.callWords(A.callCard(base)).head, 'Called 1 h 55 m earlier than expected');
  has(A.renderCallCard(base, { rule: 'before' }), ['what the board showed 8 hours before the call', '<b>11th 1900</b>']);
  lacks(A.renderCallCard(base, { rule: 'before' }), ['first shown as']);
  // ...and it counts the time moving in the 8 hours before the call.
  const shaky = { ...base, call: '2026-11-11 1715', onDuty: '2026-11-11 1915', timelineChanges: [base.timelineChanges[0], { taken: '2026-11-11 1000', call: '2026-11-11 2100', train: 'M39671 10' }, { taken: '2026-11-11 1500', call: '2026-11-11 1700', train: 'M39671 10' }] };
  assert.equal(A.callWords(A.callCard(shaky, { rule: 'before' })).head, 'Called when expected, after 2 changes'); // 1655 on the board at 0915; then 2100, then 1700
  // A turn taken off has no call to count back from: its expected time is today's figure under either rule.
  const off = { ...base, call: undefined, takenOff: true, onDuty: '2026-11-11 1410' };
  assert.equal(A.callCard(off, { rule: 'before' }).lead, A.callCard(off).lead);
  // The counts follow the rule they are asked for.
  assert.deepEqual(A.callSummary([sb05, en09, sr02]).c, [0, 0, 2, 0, 1]);
  assert.deepEqual(A.callSummary([sb05, en09, sr02], { rule: 'before' }).c, [2, 0, 0, 0, 1]);
});

test('first seen on a line-up only after the call: no warning, and nothing to measure against', () => {
  // SR09 on X39661 23 (real, 23 October): called 2245; the first line-up seen was at 2301, for another train the next evening.
  const z = { turn: 'SR09', train: 'X39661 23', expectedTrain: 'M30241 22', firstTrain: 'M30241 22', firstSeen: '2026-10-23 2301', firstCall: '2026-10-24 1935', firstWhy: 'SB02 had it before, now on M38261 24',
    expected: '2026-10-24 1935', sleepAt: null, noWindow: true, call: '2026-10-23 2245', onDuty: '2026-10-24 0045', off: -1250, calledWhy: 'Called for X39661 23, not the M30241 22 they were lined up for', timelineChanges: [], shifts: [], timelineComplete: true };
  const c = A.callCard(z);
  assert.equal(c.unseen, true);
  assert.equal(c.gap, null);
  assert.equal(c.short, true);
  const w = A.callWords(c);
  assert.equal(w.head, 'Called with no warning');
  assert.equal(w.warning, 'no warning');
  assert.equal(w.result, '');
  const html = A.renderCallCard(z);
  has(html, ['Called with no warning', '<dt>Called</dt>', '<b>23rd 2245</b>', '<b>none</b>', 'first seen on a line-up 23rd 2301 (for M30241 22), after the call', 'Called for X39661 23, which the board had not shown for this turn.']);
  // No expected time is claimed, and no picture of one.
  lacks(html, ['<dt>Expected</dt>', '<svg', 'earlier']);
  // The same job, seen a few minutes after its call time: still no warning, and nothing more to say.
  const same = { ...z, train: 'M30241 22', firstCall: '2026-10-23 2245', expected: '2026-10-23 2245', sleepAt: '2026-10-23 2301', noWindow: false, short: true, calledWhy: '' };
  assert.equal(A.callWords(A.callCard(same)).head, 'Called with no warning');
  has(A.renderCallCard(same), ['first seen on a line-up 23rd 2301, after the call']);
  lacks(A.renderCallCard(same), ['<dt>Why</dt>', '<dt>Expected</dt>']);
});

test('first seen lined up after it had already gone on duty is not scored', () => {
  // SD09 on M39671 23 (real, 25 October): on duty 0400; first seen lined up at 1134 for the next trip. The old
  // count reads it as called 21 h 45 m early.
  const z = { turn: 'SD09', train: 'M39671 23', expectedTrain: 'X27331 26', firstTrain: 'X27331 26', firstSeen: '2026-10-25 1134', firstCall: '2026-10-25 2345', expected: '2026-10-25 2345', sleepAt: null, noWindow: true,
    call: '2026-10-25 0200', onDuty: '2026-10-25 0400', off: -1305, timelineChanges: [], shifts: [], timelineComplete: true };
  const c = A.callCard(z);
  assert.equal(c.unscored, true);
  assert.equal(A.callWords(c).head, 'Not scored');
  assert.equal(A.callWhy(c), '');
  assert.deepEqual(A.callStory(c), []);
  const html = A.renderCallCard(z);
  has(html, ['Not scored', 'The board first showed SD09 lined up at 25th 1134 (for X27331 26), after it had already gone on duty at 25th 0400.']);
  lacks(html, ['<svg', 'earlier', '<dt>']);
});

test('the picture names its moments and never puts one label on another', () => {
  const svg = (z) => /<svg[\s\S]*?<\/svg>/.exec(A.renderCallCard(z))[0];
  const a = svg(base);
  has(a, ['viewBox="0 0 360 104"', '>Lined up<', '>10th 0900<', '>Expected<', '>11th 1655<', '>Called 11th 1500<', 'fill="var(--go)"', 'fill="var(--stop)"', 'role="img"', 'aria-label="Lined up 10th 0900, expected 11th 1655, called 11th 1500"']);
  // 1 h 55 m in a 32-hour picture is too narrow for words: they stay out rather than get cut off.
  lacks(a, ['class="cc-in"']);
  // A wide gap carries its amount.
  const wide = svg({ ...base, firstSeen: '2026-11-11 0600', firstCall: '2026-11-11 1655', sleepAt: '2026-11-11 0855', call: '2026-11-11 1100', onDuty: '2026-11-11 1300', timelineChanges: [], shifts: [] });
  has(wide, ['class="cc-in">5 h 55 m earlier<']);
  // Expected close to the start: its label drops to a second row and the picture grows to hold it.
  const tight = svg({ ...base, firstSeen: '2026-11-11 1600', firstCall: '2026-11-11 1655', sleepAt: '2026-11-11 1600', short: true, call: '2026-11-12 0200', onDuty: '2026-11-12 0400', timelineChanges: [], shifts: [] });
  has(tight, ['viewBox="0 0 360 131"', '>Expected<', '#a78bfa']);
  // 30 minutes or less early is yellow, more is red, late is purple: as the graph has always drawn them.
  has(svg({ ...base, call: '2026-11-11 1630', onDuty: '2026-11-11 1830', timelineChanges: [base.timelineChanges[0]] }), ['fill="var(--amber)"']);
  lacks(svg({ ...base, call: '2026-11-11 1630', onDuty: '2026-11-11 1830', timelineChanges: [base.timelineChanges[0]] }), ['fill="var(--stop)"', '#a78bfa']);
  // The expected time had gone by before the turn was lined up: no waiting is drawn back to before it was on the board.
  const pastZ = { ...base, firstSeen: '2026-11-11 2142', firstCall: '2026-11-11 2045', sleepAt: '2026-11-11 2142', expected: '2026-11-11 2045', short: true, call: '2026-11-11 2230', onDuty: '2026-11-12 0030', timelineChanges: [], shifts: [] };
  lacks(svg(pastZ), ['#a78bfa', '>Expected<', 'fill="var(--go)"']);
  has(A.renderCallCard(pastZ), ['Called with 48 min warning', 'the time on the board when lined up, already past', 'The expected time (11th 2045) had already passed when the turn was lined up.']);
  // A call before the 8 hours began: the dashed box is the 8 hours that went.
  has(A.renderCallCard({ ...base, firstCall: '2026-11-12 0900', sleepAt: null, noWindow: true, expected: '2026-11-11 1500', timelineChanges: [], shifts: [] }), ['stroke-dasharray', 'those 8 hours, gone to the early call']);
  // Never a broken number, whatever is missing.
  for (const z of [base, { ...base, timelineChanges: undefined }, { ...base, call: base.firstSeen, onDuty: '2026-11-10 1100' }, { ...base, firstCall: undefined }, { ...base, sleepAt: undefined, expected: undefined }]) {
    assert.ok(!/NaN|Infinity|undefined|null/.test(A.renderCallCard(z)), JSON.stringify(z).slice(0, 80));
  }
});

test('the card is safe and honest with broken or missing records', () => {
  has(A.renderCallCard({}), ['No saved history for this call.']);
  lacks(A.renderCallCard({}), ['<svg']);
  assert.equal(A.callCard({}), null);
  assert.equal(A.callWords(null), null);
  has(A.renderCallCard({ ...base, turn: '<script>alert(1)</script>', firstWhy: '<b>x</b>' }), ['&lt;script&gt;alert(1)&lt;/script&gt;']);
  lacks(A.renderCallCard({ ...base, turn: '<script>alert(1)</script>' }), ['<script>']);
  // A line-up saved for another trip of the same train: not compared, as today.
  const wrong = { ...base, train: 'L50231 02', expectedTrain: 'L50231 31', timelineChanges: [] };
  assert.equal(A.callCard(wrong).unavailable, true);
  has(A.renderCallCard(wrong), ['can’t be compared']);
  // ...unless the same trip showed later: then that is the first time shown, and no eight-hour figure is claimed.
  const fixed = { ...wrong, firstCall: '2026-10-31 0145', expected: '2026-10-31 0145', sleepAt: '2026-10-30 1800', call: '2026-11-02 0045', onDuty: '2026-11-02 0245', timelineChanges: [{ taken: '2026-11-01 1800', call: '2026-11-02 0145', train: 'L50231 02' }] };
  assert.equal(A.callCard(fixed).eight, false);
  assert.equal(A.callCard(fixed).gap, -60);
  // The bare card (the "how to read" example): the block and the picture, no folds and no name line.
  const bare = A.renderCallCard(base, { bare: true });
  has(bare, ['callcard cc-bare', '<dt>Expected</dt>', '<svg']);
  lacks(bare, ['<details', 'SR07 ·']);
  lacks(A.renderCallCard(base, { who: false }), ['SR07 ·']);
});

test('the counts measure every call against the same expected time its card shows', () => {
  const at = (hhmm, d = '11') => `2026-11-${d} ${hhmm}`;
  const call = (c, extra = {}) => ({ ...base, timelineChanges: [base.timelineChanges[0]], shifts: [], call: at(c), onDuty: T.fromMin(T.toMin(at(c)) + 120), ...extra });
  const list = [
    call('1655'), // when expected
    call('1720'), // when expected (25 min later)
    call('1610'), // 45 min earlier
    call('1500'), // 1 h 55 m earlier
    call('1740'), // 45 min later
    call('2000'), // 3 h 05 m later
    call('1700', { timelineChanges: [base.timelineChanges[0], { taken: at('1000'), call: at('2100'), train: 'M39671 10' }, { taken: at('1500'), call: at('1700'), train: 'M39671 10' }] }), // when expected, after 2 changes
    call('1700', { firstSeen: at('1000'), firstCall: at('1700'), sleepAt: at('1000'), expected: at('1700'), short: true }), // 7 h warning, on time
    call('1500', { firstCall: at('0900', '12'), sleepAt: null, noWindow: true, expected: at('1500') }), // no eight-hour figure: against the first time shown
    { ...base, turn: 'SR09', call: at('1500'), onDuty: at('1700'), firstSeen: at('1516'), firstCall: at('1500'), sleepAt: at('1516'), expected: at('1500'), short: true, timelineChanges: [], shifts: [] }, // first seen after the call
    { ...base, turn: 'SD09', call: at('0200'), onDuty: at('0400'), firstSeen: at('1134'), firstCall: at('2345'), sleepAt: null, noWindow: true, expected: at('2345'), timelineChanges: [], shifts: [] }, // first seen after going on duty
    { ...base, turn: 'SR03', call: undefined, takenOff: true, onDuty: at('1410'), timelineChanges: [base.timelineChanges[0]], shifts: [] }, // taken off
    { ...base, turn: 'S501-CO', train: 'L50131 04', expectedTrain: 'L50231 05', timelineChanges: [] }, // another trip's line-up: left out, as today
  ];
  const s = A.callSummary(list);
  assert.deepEqual(s.c, [2, 1, 4, 1, 1]); // over 1 h earlier, 31–60 earlier, when expected, 31–60 later, over 1 h later
  assert.equal(s.n, 9);
  assert.equal(s.calls, 10); // and the one with nothing on the board first
  assert.equal(s.ok, 4);
  assert.equal(s.warn, 2);
  assert.equal(s.bad, 3);
  assert.equal(s.earlier, 3);
  assert.equal(s.later, 2);
  assert.equal(s.short, 2); // the 7 h warning and the no-warning call
  assert.equal(s.noBoard, 1);
  assert.equal(s.unscored, 1);
  assert.equal(s.takenOff, 1);
  assert.equal(s.excluded, 1);
  assert.equal(s.movedOk, 1);
  assert.equal(s.noEight, 1);
  assert.equal(s.typicalEarly, 115); // the middle one of 45 min, 1 h 55 m and 18 h
  // Each band's count is the cards that read that way.
  const heads = list.map((z) => (A.callWords(A.callCard(z)) || {}).head);
  assert.equal(heads.filter((h) => /^Called when expected/.test(h)).length + 1, s.ok); // + the 7 h warning call, on time
  assert.equal(heads.filter((h) => h === 'Called with no warning').length, s.noBoard);
  assert.equal(heads.filter((h) => h === 'Not scored').length, s.unscored);
  // One line per turn, the most "more than an hour off" first.
  const by = A.callSummaryByTurn([...list, { ...call('2300'), turn: 'SR11' }, { ...call('1655'), turn: 'SR11' }, { ...call('2330'), turn: 'SB02' }]);
  assert.deepEqual(by.slice(0, 3).map((t) => [t.turn, t.n, t.bad]), [['SB02', 1, 1], ['SR11', 2, 1], ['SR07', 9, 3]]);
  assert.deepEqual(A.callSummary([]).c, [0, 0, 0, 0, 0]);
  assert.equal(A.callSummary([]).typicalEarly, null);
});

test('today’s graph is left exactly as the main site draws it', () => {
  // The same record through the graph the main site uses: measured from the first time shown, its own words,
  // and the exact opening tag the page relies on to open it.
  const v2 = A.renderCallTimelineV2(base);
  has(v2, ['<details class="call-timeline ct2"><summary>Show call timeline</summary>', 'Called 4 h 00 m early', 'Planned call', 'class="ct2-why"', 'Recorded changes (2)', 'About this timeline']);
  lacks(v2, ['callcard', 'cc-facts']);
  assert.equal(A.callTimeline(base).expected, T.toMin('2026-11-11 1900'));
  assert.equal(A.planReliability([base]).rows[0].planGap, -240);
  assert.equal(A.sleepStats([base]).bad, 1);
});
