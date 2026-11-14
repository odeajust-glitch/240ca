// Current, reviewed with the owner on 2026-11-12 (the tab-by-tab review; HANDOFF has the ten findings).
// He said "Go" to items 1, 2, 3, 5, 6, 7 and 10, looked at them on the test site, and the same day said:
// "You can push all this to the main except the purple predictive stuff". So they are on for every member,
// on both sites, on the Current tab (the short-row layout); item 6, the counts line, he had taken out
// ("it does but take it out"). Snapshots keeps its older layout for members, and in it these boxes are as
// they were. These run the page's own functions, cut from the page:
//   the short-row layout (reviewed = true where a box is shared): the reviewed form, whoever is looking;
//   the older layout: word for word as before.
// Turn ids and train ids only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const T = require('../../public/board-trains');
const Turns = require('../../public/board-turns');

const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// The page's Current functions in a sandbox. preview: the test site with the owner key (it no longer
// changes any of these). marks: tracked turns.
function page({ preview = false, marks = [] } = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ctx = { BoardTrains: T, BoardTurns: Turns, PREVIEW: preview, stampMin: T.toMin, esc, split: (s) => s.split(' '),
    marked: (t) => marks.includes(t), markedIn: (t) => marks.some((m) => Turns.turnIn(t, m)), markTurn: (t) => esc(t),
    crewTag: () => '', crewBoth: () => '', garnetName: () => '', yardTag: () => '', yardWorking: () => '', resetFor: () => null, resetKey: (t) => t.turn, resetText: () => '',
    SPARE_PREDICT: false, spareCall: () => null, boardOdds: () => '', trainHabit: () => null, planTrust: () => '', poolChip: () => '', likelyCall: () => null, staleChip: () => '',
    // The crew of a row, as the page's lineupCrew words a job going spare when no cover is named.
    lineupCrew: (t) => (/goes spare/.test(t.rules || '') ? '<span class="crew-craft"><span class="muted">Conductor:</span> <span class="spare">spare</span> (S502 spare)</span>' : '<span class="crew-craft"><span class="muted">Conductor:</span> SR06</span>') };
  vm.createContext(ctx);
  vm.runInContext(cut('function dt(stamp) {', 'const ON_TIME = 15;'), ctx);
  vm.runInContext(cut('const awayCall = (s, t) => {', 'function lineup2(s) {'), ctx); // awayCall, cur2Row
  vm.runInContext(cut('function s5CrewWhy(s, t) {', 'function lineup(s, previewS5 = false) {'), ctx); // s5CrewWhy, lineupWhy
  vm.runInContext(cut('function lineup2(s) {', 'function toronto2(s) {'), ctx);
  vm.runInContext(cut('function garnetCrew(s) {', '// The reset tracker (owner, 2026-11-03)'), ctx); // garnet2, changes2, the review block, dot
  vm.runInContext(cut('function poolBody(s, p, reviewed = false) {', '// Pools at Sarnia (owner, 2026-11-09'), ctx);
  vm.runInContext(cut('const MU_TURN = ', '// Jobs up for bid (owner, 2026-11-11'), ctx); // the Call board, Days off
  vm.runInContext(cut('let vacTab = ', '\nfunction sequence(s) {'), ctx);
  return { ctx, run: (code) => vm.runInContext(code, ctx) };
}

// The 0852 check of 12 Nov 2026, cut down. SA08's conductor had a day off listed from 11th 2140 and went on
// duty on his own turn at 12th 0800; S101's engineer had one from 11th 1800 and a spare (EN02) worked the job.
const fill = (turn, board, call, more = {}) => ({ turn, board, call, skipped: [], sd: '', ...more });
const s = {
  taken: '2026-11-12 0852',
  screens: ['lineup', 'macLineup', 'bunkhouse', 'garnet', 'garnetLineup', 'daysOff'],
  lineup: [
    { order: '12th 1200', status: 'ORD', train: 'DHT127B 12', deadhead: true, rules: 'Chain Gang: SR06 + SD09', call: '12th 1000', info: 'TOPC SD DT A1 B EnCo', engCrew: '45SASD0', trnCrew: '45SASR0',
      reason: 'Deadhead → always the next Chain Gang turn. CATS has it ordered for the Chain Gang too. Called ~12th 1000.' },
    { order: '12th 1910', status: 'PLN', train: 'E27861 12', deadhead: false, rules: 'spareboard (no Chain Gang turn free) + SD12', call: '12th 1655', info: 'TOPC 200MAC A EnCo', engCrew: '45SAS10', trnCrew: '45SASA0',
      reason: 'A and B used up for this road day → Chain Gang. Called ~12th 1655. Skipped (keep their place): SR04 on hold turn until 13th 0559; SR01 on rest until 13th 0240. No Chain Gang turn available → spareboard.' },
    { order: '13th 0400', status: 'PLN', train: 'L50231 13', deadhead: false, rules: 'S5: S502 (goes spare) + S502', call: '13th 0145', info: 'TOPC 500GAR A EnCo', engCrew: '45SAS50', trnCrew: '45SAS50',
      reason: 'L502 follows regular 501/502 board position (option 29): S502 (home in Sarnia, position 001). Conductor: on a hold turn past the call → goes spare. Engineer: available.' },
  ],
  callingSequence: [],
  onDuty: [
    { onDuty: '12th 0145', station: 'SARNIA', train: 'X30241 08', crew: 'EN SD03 · CO SR03', backfill: [] },
    { onDuty: '12th 0245', station: 'SARNIA', train: 'L50231 12', crew: 'EN S501 · CO S501', backfill: [] },
    { onDuty: '12th 0735', station: 'TORONTO', train: 'A42531 12', crew: 'EN SD04 · CO SR08', backfill: [{ craft: 'EN', job: 'SD04', turn: 'EN06' }] },
    { onDuty: '12th 0800', station: 'SARNIA', train: 'Z14891 11', crew: 'EN S109 · CO SA08', backfill: [] },
    { onDuty: '12th 0945', station: 'SARNIA', train: 'M30241 10', crew: 'EN S101 · CO SA01', backfill: [{ craft: 'EN', job: 'S101', turn: 'EN02' }] },
  ],
  daysOff: [
    { from: '11th 1800', until: '12th 1800', on: true, turn: 'S101', craft: 'EN', pool: 'S1', yard: false },
    { from: '11th 2140', until: '12th 2140', on: true, turn: 'SA08', craft: 'CO', pool: 'SA', yard: false },
    { from: '13th 0001', until: '14th 0001', on: false, turn: 'YSBY01', craft: 'YA', pool: '', yard: true },
    { from: '13th 1400', until: '14th 1400', on: false, turn: 'B129', craft: 'B1', pool: 'EX', yard: false },
  ],
  pools: [
    { name: 'A pool (SA)', turns: [{ pos: '999', turn: 'SA08', status: 'out working on Z14891; PL @ 11th 2140 · goes spare until 12th 2140' }, { pos: '001', turn: 'SA02', status: 'available' }] },
    { name: 'S1 · engineers (A)', turns: [{ pos: '999', turn: 'S101', status: 'out working on M30241; PL @ 11th 1800 · goes spare until 12th 1800' }] },
    { name: 'Conductor fast board', turns: [{ pos: '004', turn: 'B129', status: 'PL @ 13th 1400' }, { pos: '006', turn: 'B139', status: 'available' }] },
    { name: 'Conductor slow board', turns: [{ pos: '001', turn: 'B139', status: 'available' }, { pos: '002', turn: 'B106', status: 'rest until 12th 1100' }] },
    { name: 'Engineer fast board', turns: [{ pos: '001', turn: 'EN05', status: 'available' }] },
    { name: '501/502 (S5)', turns: [{ pos: '999', turn: 'S501', craft: 'CO', status: 'out working on L50231' }, { pos: '999', turn: 'S501', craft: 'EN', status: 'out working on L50231' }, { pos: '001', turn: 'S502', craft: 'CO', status: 'hold turn until 13th 0559 (**)' }] },
  ],
  away: ['SR07'], returning: [],
  bunkhouse: [{ pos: '005', en: 'SD07', co: 'SR07', offDuty: '12th 0559', rested: '12th 1359', ready: false }],
  onTheWay: [{ crew: 'SD03 + SR03', en: 'SD03', co: 'SR03', train: 'X30241 08', onDuty: '12th 0145', offDuty: '12th 0945', rested: '12th 1745' }],
  macLineup: [
    { order: '12th 1904', status: 'PLN', train: 'E27121 12', deadhead: false, crew: 'SD07 + SR07', crewPos: '005', crewExpected: null, call: '12th 1649' },
    { order: '12th 2300', status: 'PLN', train: 'M39931 13', deadhead: false, crew: 'SD03 + SR03', crewPos: '', crewExpected: { onDuty: '12th 0145', train: 'X30241 08', offDuty: '12th 0945', rested: '12th 1745' }, call: '12th 2045' },
  ],
  garnetHome: { train: 'L50131 12', status: 'ORD', order: '12th 2130', call: '12th 1915', crew: null },
  vacancies: [
    { pos: '002', at: '12th 1530', status: 'PLANNED', train: 'YINS30', pool: 'YD', cc: 'FO', turn: 'YINS30', yard: true, spare: true, returns: '13th 0404', fill: fill('B104', 'Conductor fast board', '12th 1330') },
    { pos: '005', at: '12th 2210', status: 'PLANNED', train: 'M39671', pool: 'SD', cc: 'EN', turn: 'SD06', yard: false, spare: true, returns: '', fill: fill('EN05', 'Engineer slow board', '12th 1955', { skipped: ['EN03 (rest until 12th 2300)'] }) },
  ],
  vacanciesPredicted: [
    { pos: '', at: '12th 1910', status: 'PLANNED', predicted: true, trainDay: 'E27861 12', why: 'no Chain Gang conductor is free', train: 'E27861', pool: '', cc: 'CO', turn: '', yard: false, spare: false, returns: '', fill: fill('B139', 'Conductor slow board', '12th 1655') },
    { pos: '', at: '13th 0400', status: 'PLANNED', predicted: true, trainDay: 'L50231 13', why: 'is on a hold turn past the call', train: 'L50231', pool: 'S5', cc: 'CO', turn: 'S502', yard: false, spare: false, returns: '', fill: fill('B137', 'Conductor slow board', '13th 0145') },
  ],
  sequence: [], flags: [], yardJobs: [],
};
// The card's lines the way the page's trackSummary builds them from the turn's facts.
const LINED = new Set(['lineup', 'spareFill', 'homeTrain', 'onDuty', 'mayCall', 'sequence']);
const cardOf = (turn) => Turns.facts(s, turn).map((x) => (LINED.has(x.kind)
  ? { kind: x.kind, text: x.text.replace(/^Projected for /, 'Lined up for ').replace(/^Projected to fill /, 'Lined up for ') } : { kind: 'status', text: x.text }));

test('the review’s pieces are on for every member, at the owner’s word', () => {
  // Owner, 2026-11-12, to "the ten things, numbered; I'd build 1, 2, 3, 5, 6, 7 and 10": "Go" (the test site).
  // Then, having looked at board-test on his phone: "You can push all this to the main except the purple
  // predictive stuff which i believe you removed".
  assert.ok(html.includes('He said "Go" to items 1, 2, 3, 5, 6, 7 and 10 of that review'));
  assert.ok(html.includes('"You can push all this to the main except the purple predictive stuff"'));
  const block = cut('// ---- Current, reviewed with the owner 2026-11-12 ---', '// ---- end of the Current review block');
  assert.ok(!/\bPREVIEW\b/.test(block), 'nothing in the review block waits on the test site any more');
  // The purple predictive pieces are not part of it: the likely-call line is off everywhere, and the train
  // habit tag, its note and the spareboard odds still need the test site and its patterns file.
  assert.ok(html.includes('const TRAIN_LIKELY = false;'));
  assert.ok(html.includes('const P = TRAIN_LIKELY && PREVIEW && PATTERNS && PATTERNS.predict;'));
  assert.ok(html.includes("const d = PREVIEW && PATTERNS && num ? (PATTERNS.drift || {})[num] : null;"));
  assert.ok(html.includes('if (!PREVIEW || !PATTERNS || !od || t.status === \'ORD\') return \'\';'));
  // PREVIEW itself is still the test site's address with the owner key, for the previews that remain.
  assert.ok(html.includes("const PREVIEW_HOST = /^board-test\\./.test(location.hostname);"));
  assert.ok(html.includes('const preview = PREVIEW_HOST && !!(h && OwnerKey.has());'));
  // The Days off and Yard rules reach Current and Snapshots for everyone (Snapshots drawn like Current since
  // 2026-11-12 evening, the owner's pick 12): under body.everyone, which the page's <body> always carries, the
  // same weight as the body.current and body.preview-site they were under.
  assert.ok(html.includes('<body class="everyone">'));
  assert.ok(!/classList\.(remove|toggle)\('everyone'/.test(html) && !/body\.className\s*=/.test(html), 'nothing takes the class off');
  const rules = html.match(/\n {2}(?: {2})?body\.everyone #sec-(?:daysoff|yard)[^{]*\{[^}]*\}/g) || [];
  assert.equal(rules.length, 3);
  for (const rule of rules) assert.ok(rule.split('{')[0].split(',').every((sel) => /^\s*body\.everyone #sec-(daysoff|yard)/.test(sel)), rule);
  assert.ok(!/body\.(current|preview-site) #sec-(daysoff|yard)/.test(html));
});

test('the short-row layout draws the reviewed boxes, on Current and Snapshots alike', () => {
  // Snapshots drawn like Current, for every member: the owner, 2026-11-12 evening, to the list of what the test
  // site had: "1-8. 10, 11, 12, 13, 14, 15, 16" (this is 12; it had been a test-site preview since 11-10).
  const grid = cut('  function sectionsGrid(s, arrange = arranging, previewS5 = false) {', '    const wrap = (x, i, all) =>');
  assert.ok(!/\bPREVIEW\b|\bfresh\b|mode === 'current'/.test(grid), 'the same boxes whichever tab draws them');
  assert.ok(html.includes("vacancies: (x) => vacancies(x, true).replace('Jobs going spare · 5', 'Jobs going spare'),"));
  assert.ok(html.includes('pools: (x) => pools(x, poolPicks || [], true), daysoff: (x) => daysOff(x, true), callboard: (x) => onDuty(x, true) };'));
  assert.ok(html.includes('const built = order.map((k) => ({ ...byK[k], body: NEW[k] ? NEW[k](s) : byK[k].html(s) })).filter((x) => x.body);'));
  // Snapshots' counts tiles are gone with its older layout, and its boxes are wired the way Current's are.
  assert.ok(!html.includes('function strip(') && !html.includes('strip(s, false)'));
  assert.ok(html.includes('    if (!arranging) wireCurrentBoxes(document.getElementById(\'view\'), currentBoxOpen);'));
  // The older layout's own calls (left in place, nothing draws them now) carry no such word.
  for (const line of ["html: (s) => pools(s, poolPicks || []) },", "html: (s) => vacancies(s) },", "html: (s) => daysOff(s) },", "html: (s) => onDuty(s) },"]) assert.ok(html.includes(line), line);
  assert.ok(html.includes("'<details class=\"why\"><summary>Why</summary>' + lineupWhy(s, t, previewS5) +"));
  // The test site's key changes none of them now.
  const a = page();
  const b = page({ preview: true });
  for (const code of ['lineup2(s)', 'garnet2(s)', 'daysOff(s, true)', 'daysOff(s)', 'vacancies(s, true)', 'vacancies(s)', 'onDuty(s, true)', 'onDuty(s)', 'poolBody(s, s.pools[0], true)', 'poolBody(s, s.pools[0])', 'lineupWhy(s, s.lineup[1], true, true)', 'lineupWhy(s, s.lineup[1])']) {
    a.ctx.s = s; b.ctx.s = s;
    assert.equal(b.run(code), a.run(code), code);
  }
});

test('item 6: no counts line on Current; he had it taken out', () => {
  // On the test site it read "Spare conductors free 21 / 28 · Spare engineers free 0 / 3" at his "Go".
  // Owner, 2026-11-12, looking at it there: "it does but take it out".
  assert.ok(!html.includes('function strip2('));
  assert.ok(!/strip2\(s\)/.test(html));
  // Snapshots' older counts tiles went with its older layout (his pick 12, 2026-11-12 evening).
  assert.ok(!html.includes('Conductors available (spareboard)'));
  // The train count is still in the line-up's own heading.
  assert.ok(text(page().run('lineup2')(s)).startsWith('Train line-up 3 trains · 1 ordered'));
});

test('item 3: the note under the line-up says what the big time is; calls read "~" like every other box', () => {
  const on = page().run('lineup2')(s); // a member, the main site
  assert.ok(on.includes('The big time is the one on the CATS line-up (planned or ordered). The crew goes on duty 15 minutes before it (a deadhead at that time), and the call is 2 hours before on duty. CO conductor, EN engineer.'));
  assert.ok(!on.includes('The big time is on duty'));
  assert.ok(on.includes('<span class="call">call ~12th 1000</span>') && on.includes('<span class="call">call ~12th 1655</span>'));
  // A train with no call worked out has no "~" in front of the dash.
  assert.ok(page().run('lineup2')({ ...s, lineup: [{ ...s.lineup[0], call: '' }] }).includes('<span class="call">call —</span>'));
  // The figures the note gives are the checker's own.
  const cfg = require('../../lib/board/config');
  assert.deepEqual(cfg.prepMinutes, { train: 15, deadhead: 0 });
  assert.equal(cfg.callLeadMinutes, 120);
});

test('item 5: "why that crew" opens on the checker’s own sentence', () => {
  // Owner, 2026-11-12, of "Tap a train: the reason comes first" on the test site: "5 yes".
  const row = s.lineup[1]; // E27861 12: nobody free on the Chain Gang
  const p = page();
  // The row puts the sentence at the very top of its fold, above anything else, and once.
  const fold = p.run('lineup2')(s).split('<div class="fold">')[2];
  assert.ok(fold.startsWith('<b class="foldname">Why</b><p class="whysaid">A and B used up for this road day → Chain Gang. Skipped (keep their place): SR04 on hold turn until 13th 0559; SR01 on rest until 13th 0240. No Chain Gang turn available → spareboard.</p>'));
  assert.equal(p.run('lineup2')(s).split('class="whysaid"').length - 1, s.lineup.length);
  assert.ok(!p.run('whySaid')(row).includes('Called ~'), 'the row has the call; the sentence does not repeat it in the past tense');
  assert.equal(p.run('whySaid')(s.lineup[0]), '<p class="whysaid">Deadhead → always the next Chain Gang turn. CATS has it ordered for the Chain Gang too.</p>');
  assert.equal(p.run('whySaid')({ reason: '' }), '');
  // Under it, as the short-row layout asks for it: the sequence, the cover with "call ~", and no line about
  // spare cover being "saved" on a train with nobody going spare.
  const on = p.run('lineupWhy')(s, row, true, true);
  assert.ok(on.startsWith('<h4>Calling sequence</h4>'));
  assert.ok(on.includes('expected cover B139 · Conductor slow board · call ~12th 1655.'));
  assert.ok(on.endsWith('<p>Cover is an estimate, not a confirmed crew call.</p>'));
  assert.ok(!p.run('lineupWhy')(s, s.lineup[0], true, true).includes('No matching spare-job cover'));
  // L502: "spare" said once about the turn going spare.
  const l502 = p.run('lineupWhy')(s, s.lineup[2], true, true);
  assert.ok(text(l502).includes('Conductor: (S502 spare)') && !text(l502).includes('spare (S502 spare)'));
  assert.ok(fold.length && p.run('lineup2')(s).includes('<p class="whysaid">L502 follows regular 501/502 board position (option 29): S502'));
  // Snapshots' older layout asks the old way and gets the old words.
  const old = p.run('lineupWhy')(s, row);
  assert.ok(!old.includes('whysaid') && !old.includes('Skipped (keep their place)'));
  assert.ok(old.includes('expected cover B139 · Conductor slow board · call 12th 1655.'));
  assert.ok(p.run('lineupWhy')(s, s.lineup[0]).endsWith('<p>No matching spare-job cover is saved for this train in this check.</p>'));
});

test('item 2: a day off is not taken once its own person is on duty on that turn after it began', () => {
  const p = page();
  const worked = p.run('dayOffWorked');
  const [s101, sa08, ysby, b129] = s.daysOff;
  assert.equal(worked(s, sa08).train, 'Z14891 11'); // owner, 2026-11-12, of this very line: "It went this morning"
  assert.equal(worked(s, s101), null, 'a spare is filling in on S101: that day off stands');
  assert.equal(worked(s, ysby), null);
  assert.equal(worked(s, b129), null);
  // On duty before the day off began (still out when it starts) is not a day off given up.
  assert.equal(worked({ ...s, daysOff: [], onDuty: [{ ...s.onDuty[3], onDuty: '11th 2000' }] }, sa08), null);
  // The other craft on the same turn number, a trainee's line, and a turn not on the Call Board do not count.
  assert.equal(worked(s, { ...sa08, craft: 'EN' }), null);
  assert.equal(worked(s, { ...sa08, craft: 'TT' }), null);
  assert.equal(worked(s, { ...sa08, turn: 'SA02' }), null);
  assert.equal(worked(s, { ...sa08, on: false }), null);
  // 501/502 is two turns with one number: each craft by its own line.
  const s5 = { from: '12th 0100', until: '13th 0100', on: true, turn: 'S501', craft: 'CO', yard: false };
  assert.equal(worked(s, s5).train, 'L50231 12');
  assert.equal(worked({ ...s, onDuty: [{ ...s.onDuty[1], backfill: [{ craft: 'CO', job: 'S501', turn: 'B105' }] }] }, s5), null);
  assert.equal(worked({ ...s, onDuty: [{ ...s.onDuty[1], backfill: [{ craft: 'EN', job: 'S501', turn: 'SA07' }] }] }, s5).train, 'L50231 12');
});

test('item 2: the Days off box and the pool boards, on Current and in Snapshots’ older layout', () => {
  const p = page();
  const old = p.run('daysOff')(s);
  assert.ok(text(old).startsWith('Days off 2 active · 2 upcoming Active now · 2 From Ends Turn 11th 1800 12th 1800 S101 EN 11th 2140 12th 2140 SA08 CO Upcoming · 2'));
  assert.ok(!old.includes('not taken') && !old.includes('Listed, but working'));
  const on = text(p.run('daysOff')(s, true));
  assert.ok(on.startsWith('Days off 1 active · 2 upcoming · 1 not taken Active now · 1 From Ends Turn 11th 1800 12th 1800 S101 EN Upcoming · 2'));
  assert.ok(on.includes('Listed, but working · 1 From Ends Turn 11th 2140 12th 2140 SA08 CO on duty 12th 0800 on Z14891 11, nobody filling in'));
  assert.ok(on.includes('The line-up and the alerts still read it as CATS listed it.'));
  // Nothing worked: the box is as it always was.
  const quiet = { ...s, onDuty: [] };
  assert.equal(p.run('daysOff')(quiet, true), p.run('daysOff')(quiet));

  const board = (reviewed, i) => text(p.run('poolBody')(s, s.pools[i], reviewed));
  assert.ok(board(false, 0).includes('999 SA08 out working on Z14891; PL @ 11th 2140 · goes spare until 12th 2140'));
  assert.ok(board(true, 0).includes('999 SA08 out working on Z14891 001 SA02 available'));
  // S101's stands (a spare is working the job), and a day off still to come is left alone.
  assert.equal(board(true, 1), board(false, 1));
  assert.equal(board(true, 2), board(false, 2));
  assert.ok(board(true, 2).includes('B129 PL @ 13th 1400'));
  assert.equal(text(p.run('poolBody')(s, s.pools[0])), board(false, 0), 'asked the old way, a board is the older layout’s');
  // The Pools box hands the word on to each board.
  assert.ok(html.includes('function pools(s, picked, reviewed = false) {'));
  assert.ok(html.includes('<span class="meta">${p.turns.length} turns</span></div>${poolBody(s, p, reviewed)}`).join(\'\');'));
});

test('item 1: the card under Find a turn names a predicted job and the call for the train home', () => {
  // Owner, 2026-11-12, of his own card on the test site ("Home from Garnet on L50131 12 …, call ~1915"): "yes".
  const p = page();
  const card = (turn) => p.run('cardLines')(s, turn, cardOf(turn)).map((l) => l.text);
  // A spare the order has for a job CATS has not listed: before, only "available" on both boards.
  assert.deepEqual(cardOf('B139').map((l) => l.text), ['Conductor fast board position 006: available', 'Conductor slow board position 001: available']);
  assert.equal(card('B139')[2], 'Lined up for E27861 12 (CO, planned 12th 1910, call ~12th 1655, off the Conductor slow board). Not on CATS yet: the line-up has no turn free (no Chain Gang conductor is free).');
  assert.equal(card('B137').pop(), 'Lined up for L50231 13 (S5 CO, planned 13th 0400, call ~13th 0145, off the Conductor slow board). Not on CATS yet: the line-up has S502 going spare (it is on a hold turn past the call).');
  // A listed job is said once, by the line the card already had.
  assert.deepEqual(card('EN05').filter((t) => /M39671/.test(t)), ['Lined up for M39671 (SD EN, planned 12th 2210, call ~12th 1955, off the Engineer slow board)']);
  // A Chain Gang turn that may be called when nobody is free on the slow board.
  const may = { ...s, vacanciesPredicted: [{ ...s.vacanciesPredicted[0], fill: fill('', 'Conductor slow board', '12th 1655', { sd: 'SR06' }) }] };
  assert.equal(p.run('cardLines')(may, 'SR06', []).pop().text, 'May be called for E27861 12 (CO, planned 12th 1910, call ~12th 1655): no one free on the conductor slow board. Not on CATS yet: the line-up has no turn free (no Chain Gang conductor is free).');
  // The train home, with its call as the Toronto box works it out (on duty less 2 h; on duty 15 min before the order).
  assert.ok(card('SR07').includes('Predicted home on E27121 12 (PLN 12th 1904), call ~12th 1649'));
  assert.ok(card('SR03').some((t) => t.endsWith('predicted home on M39931 13 (PLN 12th 2300), call ~12th 2045')));
  // Home from Garnet: the crew that took L502 out, by craft; not a craft someone else is working, and the fill-in instead.
  assert.equal(card('S501-CO').pop(), 'Home from Garnet on L50131 12 (ORD 12th 2130), call ~12th 1915');
  assert.ok(!card('S502-CO').some((t) => /Garnet/.test(t)));
  const covered = { ...s, onDuty: [{ ...s.onDuty[1], backfill: [{ craft: 'EN', job: 'S501', turn: 'SA07' }] }] };
  assert.ok(!p.run('cardLines')(covered, 'S501-EN', []).some((l) => /Garnet/.test(l.text)));
  assert.ok(p.run('cardLines')(covered, 'S501-CO', []).some((l) => /Home from Garnet on L50131 12/.test(l.text)));
  assert.ok(p.run('cardLines')(covered, 'SA07', []).some((l) => /Home from Garnet on L50131 12/.test(l.text)));
  // The day off that was not taken comes off the status; one that stands stays.
  assert.equal(card('SA08')[0], 'A pool (SA) position 999: out working on Z14891');
  assert.equal(card('S101')[0], 'S1 (A) position 999: out working on M30241; PL @ 11th 1800 · goes spare until 12th 1800');
  // The box is called Jobs going spare.
  assert.deepEqual(card('YINS30'), ['Job YINS30 (YD FO, planned 12th 1530) is listed in Jobs going spare, returns 13th 0404']);
  assert.ok(cardOf('YINS30')[0].text.includes('is on the vacancy list: goes spare'), 'the wording board-turns.js writes, which the card rewords');
  // The lines handed in are not changed in place.
  const mine = cardOf('SA08');
  const before = JSON.stringify(mine);
  p.run('cardLines')(s, 'SA08', mine);
  assert.equal(JSON.stringify(mine), before);
});

test('item 1: the page draws the card’s extra lines for every member', () => {
  assert.ok(html.includes('const lines = cardLines(s, turn, built);'));
  assert.ok(html.includes("const built = [...where.map((text) => ({ kind: 'status', text })), ...lined];"));
});

// Owner, 2026-11-14, told the yardmaster jobs (CC YA) going spare were kept but left out of Jobs going spare (his word
// of 24 Oct: they go to the yardmaster spareboard): "Lets do this". The 0038 check of 14 Nov: YSTY01 and YSBY01.
test('Jobs going spare: the yardmaster jobs CATS lists, as their own rows, both layouts', () => {
  const ya = [{ pos: '004', at: '14th 0630', status: 'PLANNED', train: 'YSTY01', pool: 'YD', cc: 'YA', st: '', returns: '', turn: 'YSTY01' },
    { pos: '006', at: '14th 0700', status: 'PLANNED', train: 'YSBY01', pool: 'YD', cc: 'YA', st: '* **', returns: '16th 0001', turn: 'YSBY01' }];
  const p = page();
  const both = { ...s, yardmasterJobs: ya };
  const now = p.run('vacancies')(both, true);
  assert.ok(now.includes('+ 2 yardmaster</span>'), 'counted in the heading');
  assert.ok(text(now).includes('Yardmaster jobs going spare · 2'));
  // No note under the heading (owner, 2026-11-14: "For the YM jobs going spare remove the description").
  assert.ok(!/They go to the yardmaster spareboard first|so no cover is shown/.test(text(now)), text(now)); // each row's Details keep theirs
  assert.ok(now.includes('Yardmaster jobs going spare · 2</h3>') && !/Yardmaster jobs going spare · 2<\/h3>\s*<p class="anote"/.test(now));
  assert.ok(text(now).includes('0630 YSTY01 YD YA PLN (spare)'), text(now));
  assert.ok(text(now).includes('0700 YSBY01 YD YA PLN (spare) returns 16th 0001'));
  assert.ok(now.indexOf('Yardmaster jobs going spare') > now.indexOf('YINS30') && now.indexOf('Yardmaster jobs going spare') < now.indexOf('Predicted jobs going spare'));
  const old = p.run('vacancies')(both, false);
  assert.ok(text(old).includes('14th 0700 YSBY01 YD YA · planned (spare) returns 16th 0001'), text(old));
  // Only the yardmaster jobs on the list: the box is drawn for them.
  const only = { ...s, vacancies: [], vacanciesCats: [], vacanciesPredicted: [], yardmasterJobs: ya };
  assert.ok(text(p.run('vacancies')(only, true)).includes('Yardmaster jobs going spare · 2'));
  // None: as before.
  assert.equal(p.run('vacancies')({ ...s, yardmasterJobs: [] }, true), p.run('vacancies')(s, true));
  assert.equal(p.run('vacancies')({ ...s, vacancies: [], vacanciesCats: [], vacanciesPredicted: [] }, true), '');
});

// Owner, 2026-11-14: "put the spare YM jobs in the jobs going spare tab. but only show the predictions to anyone with an
// owners key for now. Lets verify them. That can be puhsed to the main page". The 0056 check of 14 Nov cut down, made-up
// names: YSTY01 Sat 0630 and YSBY01 Sat 0700 on CATS's list; the spare yardmaster on the yardmaster spareboard on rest
// until 0500 (his photo); a yard FO on YPRS02 0645 that day.
test('Jobs going spare: the yardmaster predictions, owner key only, both layouts', () => {
  const Y = require('../../public/board-ym');
  const snap = { ...s, taken: '2026-11-14 0056', vacancies: [], vacanciesCats: [], vacanciesPredicted: [],
    yardmasterJobs: [{ pos: '004', at: '14th 0630', status: 'PLANNED', train: 'YSTY01', pool: 'YD', cc: 'YA', st: '', returns: '', turn: 'YSTY01' },
      { pos: '006', at: '14th 0700', status: 'PLANNED', train: 'YSBY01', pool: 'YD', cc: 'YA', st: '* **', returns: '16th 0001', turn: 'YSBY01' }],
    pools: [{ name: 'Conductor fast board', turns: [{ pos: '001', turn: 'B108', status: 'rest until 14th 0500' }, { pos: '002', turn: 'B112', status: 'available' },
      { pos: '003', turn: 'B120', status: 'B0: working another job' }] }] };
  const L = {
    list: [{ rank: 30, assignment: 'EXYA01YA', status: '' }, { rank: 40, assignment: 'YSTY01YA', status: '' }, { rank: 50, assignment: 'YPRS02FO', status: '' }, { rank: 60, assignment: 'XSAS01FO', status: '' }],
    byRank: { 30: 'Dogwood, M', 40: 'Alder, T', 50: 'Birch, R', 60: 'Ivy, C' },
    live: { taken: '2026-11-14 0056', byRank: { 30: { status: 'available', freeAt: '2026-11-14T05:00', text: 'YA01 YA: rest until 14th 0500', src: 'Yardmaster spareboard' } },
      spareboard: [{ pos: '001', turn: 'YA01', status: 'rest until 14th 0500' }] },
  };
  const p = page();
  const plain = (x) => JSON.parse(JSON.stringify(x)); // out of the sandbox's realm
  const pred = plain(p.run('ymPredFrom')(Y, L, snap, null));
  // Earliest call first, one each: YSTY01 (call 0430): the spare is on rest until 0500 at the call, so the yard FO working
  // that day; YSBY01 (call 0500): the spare, free at 0500. The FO's YPRS02 0645 goes spare: B108 rests until 0500, past
  // its 0445 call, so B112.
  assert.deepEqual([pred.jobs['YSTY01|14th 0630'].who, pred.jobs['YSTY01|14th 0630'].step, pred.jobs['YSTY01|14th 0630'].call], ['Birch, R', 3, '14th 0430']);
  assert.match(pred.jobs['YSTY01|14th 0630'].passed[0], /^Dogwood, M \(rank 30\): on rest until Sat 14th 0500 when the call is made$/);
  assert.deepEqual([pred.jobs['YSBY01|14th 0700'].who, pred.jobs['YSBY01|14th 0700'].step, pred.jobs['YSBY01|14th 0700'].leaves], ['Dogwood, M', 1, '']);
  assert.deepEqual(pred.knock.map((v) => [v.at, v.train, v.cc, v.fill.turn, v.fill.call, v.fill.skipped]), [['14th 0645', 'YPRS02', 'FO', 'B112', '14th 0445', ['B108 (rest until 14th 0500)']]]);
  assert.equal(pred.sb, 'Yardmaster spareboard at the check of 0056: YA01 Dogwood, M · rest until 14th 0500.');
  // A member, or the owner before it's worked out: the yardmaster rows without a cover, nothing from YM.
  const member = p.run('vacancies')(snap, true);
  assert.ok(!/cover <b>|from YM|Birch|Dogwood|only you see/.test(member) && text(member).includes('0630 YSTY01 YD YA PLN (spare)'), text(member));
  // The owner, with the answer for this check: the cover on each row and the yard job left going spare.
  p.run('(x) => { YM_PRED = x; }')(pred);
  assert.equal(p.run('vacancies')(snap, true), member, 'not without the owner key');
  p.run('YM_OWNER = true');
  const owner = p.run('vacancies')(snap, true);
  assert.ok(text(owner).includes('0630 YSTY01 YD YA PLN (spare) cover Birch, R call ~14th 0430'), text(owner));
  assert.ok(text(owner).includes('0700 YSBY01 YD YA PLN tie (spare) cover Dogwood, M call ~14th 0500'), text(owner));
  // The tie (owner, 2026-11-14, of a 0500 rest and a 0500 call: "yes we will go with that, but we can watch that and check
  // for conflicts if you see that"): YSBY01's pick rests until its call; a minute later it would be the yard FO's relief.
  assert.deepEqual(pred.jobs['YSBY01|14th 0700'].tie, { who: 'Ivy, C', rank: 60, step: 3, leaves: 'YBHS01 FO 14th 0800' });
  assert.equal(pred.jobs['YSTY01|14th 0630'].tie, undefined);
  assert.ok(text(owner).includes('Tie, worth checking: a rest ending right at the call is taken as free, at your word. If it weren\'t, Ivy, C , rank 60 (step 3), and their YBHS01 FO 14th 0800 would go spare.'), text(owner));
  assert.ok(!/0630 YSTY01 YD YA PLN tie/.test(text(owner)));
  assert.ok(text(owner).includes('Expected cover (only you see this): Birch, R , rank 50 · Step 3: Working in the yard that day, not called yet · 2-hour call · straight time. Called ~14th 0430.'), text(owner));
  assert.ok(text(owner).includes('Passed over: Dogwood, M (rank 30): on rest until Sat 14th 0500 when the call is made. Their YPRS02 FO 14th 0645 goes spare'));
  assert.ok(text(owner).includes('0645 YPRS02 YD FO PLN predicted from YM cover B112 call ~14th 0445'), text(owner));
  assert.ok(text(owner).includes('Predicted (only you see this): Birch, R (rank 50), its FO that day, would be moved up to YSTY01 (yardmaster) at its 0430 call.'));
  // No note under the heading for the owner either (owner, 2026-11-14: "For the YM jobs going spare remove the description").
  assert.ok(!/Only you see the cover|Yardmaster spareboard at the check of/.test(text(owner)), text(owner));
  assert.ok(owner.includes('+ 1 predicted + 2 yardmaster</span>'));
  // The older table too; and another check's answer is not used.
  assert.ok(text(p.run('vacancies')(snap, false)).includes('Expected cover Birch, R estimate · call ~14th 0430'));
  assert.ok(!/from YM|Birch/.test(p.run('vacancies')({ ...snap, taken: '2026-11-14 0110' }, true)));
  // Nobody on the yardmaster spareboard: the spare's step is skipped, and the FO on the yard job that day gets the first.
  const empty = plain(p.run('ymPredFrom')(Y, { ...L, live: { ...L.live, spareboard: [] } }, snap, null));
  assert.deepEqual([empty.jobs['YSTY01|14th 0630'].who, empty.jobs['YSBY01|14th 0700'].who], ['Birch, R', 'Ivy, C']);
  // YBHS01 0800 (call 0600): B112 is taken by YPRS02, and B108's rest ends at 0500, before the call.
  assert.deepEqual(empty.knock.map((v) => `${v.train} ${v.fill.turn}`), ['YPRS02 B112', 'YBHS01 B108']);
  // A spare lined for one knock-on is not lined again: B112 first on the board takes YPRS02, so YBHS01 gets the next free.
  const order = { ...snap, pools: [{ name: 'Conductor fast board', turns: [snap.pools[0].turns[1], snap.pools[0].turns[0], snap.pools[0].turns[2]] }] };
  const once = plain(p.run('ymPredFrom')(Y, { ...L, live: { ...L.live, spareboard: [] } }, order, null));
  assert.deepEqual(once.knock.map((v) => `${v.train} ${v.fill.turn}`), ['YPRS02 B112', 'YBHS01 B108']);
  // The spare free for both (rest over at 0400): the first job takes him, so the second goes down the order (one each).
  const both = plain(p.run('ymPredFrom')(Y, { ...L, live: { ...L.live, byRank: { 30: { ...L.live.byRank[30], freeAt: '2026-11-14T04:00' } } } }, snap, null));
  assert.deepEqual([both.jobs['YSTY01|14th 0630'].who, both.jobs['YSBY01|14th 0700'].who], ['Dogwood, M', 'Ivy, C']);
  assert.equal(both.jobs['YSBY01|14th 0700'].passed[0], 'Dogwood, M (rank 30): taken for YSTY01 Sat 14th 0630 first');
  assert.ok(!both.jobs['YSTY01|14th 0630'].tie && !both.jobs['YSBY01|14th 0700'].tie, 'no rest ends at a call: no tie');
  p.run('YM_OWNER = false; YM_PRED = null');
  // On the page: the owner flag is the Worker-checked owner key, and Current works the answer out as it draws.
  assert.ok(html.includes('    YM_OWNER = membersOwner; // the yardmaster predictions in Jobs going spare (owner, 2026-11-14)'));
  assert.ok(html.includes('    if (YM_OWNER) ymPredict(s); // the owner\'s yardmaster predictions for this check, worked out once (below)'));
  assert.ok(html.includes('      YM_PRED = ymPredFrom(Y, L, s, saved && saved.rules ? saved.rules : null);'));
});

test('item 7: Jobs going spare as short rows on Current; the table as it was in Snapshots’ older layout', () => {
  // Owner, 2026-11-12, of "Jobs going spare is short rows that fit the screen" on the test site: "6 yes".
  const off = page().run('vacancies')(s);
  assert.equal((off.match(/<table>/g) || []).length, 2);
  assert.ok(!off.includes('vac2') && !off.includes('<details'));
  assert.ok(text(off).includes('12th 1530 YINS30 YD FO · planned Expected cover B104 estimate · Conductor fast board · call ~12th 1330 YINS30 (spare) returns 13th 0404'));

  const on = page({ marks: ['B139'] }).run('vacancies')(s, true);
  assert.ok(!on.includes('<table') && !on.includes('class="scroll"'), 'nothing left to sit off a phone’s edge');
  assert.equal((on.match(/<details class="cur2 vac2/g) || []).length, 4);
  const t = text(on);
  assert.ok(t.startsWith('Jobs going spare · 5 2 jobs + 2 predicted 12th 1530 YINS30 YD FO PLN cover B104 call ~12th 1330 Details'));
  // Everything the old Turn column held is still there: on the row, or under Details.
  assert.ok(t.includes('Returns 13th 0404.'));
  assert.ok(t.includes('2210 M39671 SD EN PLN SD06 (spare) cover EN05 call ~12th 1955'));
  assert.ok(t.includes('skipped: EN03 (rest until 12th 2300)'));
  assert.ok(t.includes('Predicted jobs going spare · 2'));
  assert.ok(t.includes('1910 E27861 12 CO PLN predicted no turn free cover B139 call ~12th 1655 Details CO · planned 12th 1910 Predicted: the line-up has no turn free (no Chain Gang conductor is free).'));
  assert.ok(t.includes('13th 0400 L50231 13 S5 CO PLN predicted CO S502 (spare) cover B137 call ~13th 0145'));
  assert.ok(t.includes('Predicted: the line-up has S502 going spare (it is on a hold turn past the call).'));
  assert.ok(t.endsWith('Listed and predicted jobs are filled together, earliest first.'));
  // The tracked spare's row is picked out, as its table row was.
  assert.equal((on.match(/<details class="cur2 vac2 hit"/g) || []).length, 1);
  assert.ok(on.includes('<details class="cur2 vac2 hit"><summary><span class="t">1910</span>'));
  // A job CATS lists under the wrong turn, and one whose earlier crew has not tied up, keep their marks and notes.
  const odd = { ...s, vacanciesPredicted: [], vacancies: [
    { ...s.vacancies[1], wrong: { order: 'SD11', train: 'M39671 11', spare: false } },
    { ...s.vacancies[0], untied: '12th 0730', fill: null },
    { ...s.vacancies[0], train: 'YFXS01', turn: 'YFXS01', fill: fill('', 'Conductor fast board', '12th 1330') }] };
  const o = page().run('vacancies')(odd, true);
  assert.ok(o.includes('<details class="cur2 vac2 catswrong">') && o.includes('<details class="cur2 vac2 untied">'));
  assert.ok(text(o).includes('wrong turn') && text(o).includes('Wrong turn: the order has SD11 on M39671 11, so this job isn\'t going spare'));
  assert.ok(text(o).includes('probably not spare') && text(o).includes('hasn\'t been tied up yet'));
  assert.ok(text(o).includes('NO SPARE AVAILABLE'));
  // Nothing listed and nothing predicted: no box, either way.
  const none = { ...s, vacancies: [], vacanciesPredicted: [], vacanciesCats: undefined };
  assert.equal(page().run('vacancies')(none, true), '');
  assert.equal(page().run('vacancies')(none), '');
  assert.ok(text(page().run('vacancies')({ ...s, vacancies: [] }, true)).includes('CATS\'s option 5 lists no jobs going spare.'));
});

test('item 10: the small wording', () => {
  // A fill-in line names the person once: the job's turn carries the same name while it is out working.
  const names = (reviewed) => { const p = page(); p.ctx.markTurn = (t) => String(t).replace(/\b(EN06|SD04|EN02|S101)\b/g, '$1 <span class="crewnm">Person, A</span>'); return p.run('onDuty')(s, reviewed); };
  assert.ok(names(false).includes('EN06 <span class="crewnm">Person, A</span> filling in on SD04 <span class="crewnm">Person, A</span>'), 'Snapshots’ older layout: as it was');
  assert.ok(names(true).includes('<div class="crew">EN06 <span class="crewnm">Person, A</span> filling in on SD04</div>'));
  assert.ok(names(true).includes('EN02 <span class="crewnm">Person, A</span> filling in on S101</div>'));
  assert.equal(names(), names(false), 'asked the old way, the Call board is the older layout’s');
  // Garnet: option 31 read and showing nobody is not "wasn't read".
  const g = (snap = s) => text(page().run('garnet2')(snap));
  assert.ok(g().includes('Nobody is shown at Garnet yet. S501 is shown away on the 501/502 board: CO out working on L50231 · EN out working on L50231.'));
  const unread = { ...s, screens: s.screens.filter((k) => k !== 'garnet') };
  assert.ok(g(unread).includes('The Garnet board wasn’t read in this check. S501 is shown away'));
});

// Owner, 2026-11-13, of the Garnet card on his phone ("S502 CO O'Dea, J · EN Street, K", highlighted as his):
// "This is wrong. I moved to this turn today but I am still on rest at home. It should show Jacobson". The 1931
// check of 13 Nov, cut down: L50231 13 went out with S502's engineer and MU01's conductor (S502's conductor job
// was held); he placed on S502's conductor job at home that afternoon. The Garnet board shows S502 EN and MU01 CO.
test('Garnet: each person at Garnet by their own row, not the turn\'s new holder at home', () => {
  const at = {
    taken: '2026-11-13 1931',
    screens: ['s5Pool', 'garnet', 'garnetLineup'],
    pools: [
      { name: '501/502 (S5)', turns: [{ pos: '001', turn: 'S502', craft: 'CO', status: 'rest until 14th 0530' }, { pos: '001', turn: 'S502', craft: 'EN', status: 'away (term 1)' }, { pos: '001', turn: 'MU01', craft: 'CO', status: 'away (term 1)' }] },
      { name: 'Garnet', turns: [{ pos: '001', turn: 'S502', craft: 'EN', status: 'available' }, { pos: '001', turn: 'MU01', craft: 'CO', status: 'available' }] },
    ],
    onDuty: [], lineup: [], macLineup: [], vacancies: [],
    garnetHome: { train: 'L50131 13', status: 'ORD', order: '13th 2145', call: '13th 1930', crew: { turn: 'S502', crafts: 'EN', rested: '', late: false } },
  };
  // Names as the page's crew file has them: S502's conductor is the new holder at home; MU01's conductor at
  // Garnet by the Garnet board's own row. Made-up names.
  const names = { 'Garnet|MU01|CO': 'Spare, N', 'S502|EN': 'Engineer, K', 'S502|CO': 'Holder, J' };
  const view = (snap, marks) => {
    const p = page({ marks });
    p.ctx.marked = (t, c) => marks.includes(t) || (!!c && marks.includes(`${t}-${c}`));
    p.ctx.garnetName = (x, board, turn, craft) => names[/^MU/.test(turn) ? `${board}|${turn}|${craft}` : `${turn}|${craft}`] || '';
    return p;
  };
  const html = (snap, marks = ['S502-CO']) => view(snap, marks).run('garnet2')(snap);
  // A checker that has not pulled yet (no members): the Garnet board's rows in this check.
  const old = html(at);
  assert.ok(text(old).includes('MU01 CO Spare, N + S502 EN Engineer, K'), text(old));
  assert.ok(!old.includes('Holder, J'), 'the conductor at home is not the one at Garnet');
  assert.ok(!old.includes('<mark'), 'not marked for the conductor at home');
  assert.ok(!/class="[^"]*hit/.test(old), 'not his row');
  assert.ok(text(old).includes('MU01 CO + S502 EN · from the Garnet board.'));
  // The laptop's own list once it has pulled: the same.
  const now = { ...at, garnetHome: { ...at.garnetHome, crew: { ...at.garnetHome.crew, crafts: 'EN + CO', members: [{ turn: 'S502', craft: 'EN' }, { turn: 'MU01', craft: 'CO' }] } } };
  assert.equal(text(html(now)), text(old));
  // Following S502's engineer job: that one is marked.
  assert.ok(html(now, ['S502-EN']).includes('<mark class="t">S502</mark>'));
  // His card: no "Home from Garnet" for the conductor at home; the engineer's has it.
  const p = view(now, []);
  assert.ok(!p.run('cardLines')(now, 'S502-CO', []).some((l) => /Garnet/.test(l.text)));
  assert.ok(p.run('cardLines')(now, 'S502-EN', []).some((l) => /Home from Garnet on L50131 13/.test(l.text)));
  assert.ok(!view(at, []).run('cardLines')(at, 'S502-CO', []).some((l) => /Garnet/.test(l.text)), 'the same before the pull');
  // One turn's whole crew is drawn as before: the turn, then each craft's name.
  const whole = { ...at, pools: [{ name: 'Garnet', turns: [{ pos: '001', turn: 'S501', craft: 'EN', status: 'available' }, { pos: '001', turn: 'S501', craft: 'CO', status: 'available' }] }],
    garnetHome: { ...at.garnetHome, crew: { turn: 'S501', crafts: 'EN + CO', rested: '', late: false } } };
  names['S501|CO'] = 'Conductor, A'; names['S501|EN'] = 'Driver, B';
  assert.ok(text(html(whole, ['S501-CO'])).includes('S501 CO Conductor, A · EN Driver, B'));
  assert.ok(html(whole, ['S501-CO']).includes('<mark class="t">S501</mark>'));
  // The Garnet board not read: the 501/502 board's away rows, MU01's conductor with S502's engineer.
  const unread = { ...at, screens: ['s5Pool', 'garnetLineup'], pools: [at.pools[0]], garnetHome: { ...at.garnetHome, crew: null } };
  names['501/502 (S5)|MU01|CO'] = 'Spare, N';
  const u = html(unread);
  assert.ok(text(u).includes('MU01 CO Spare, N + S502 EN Engineer, K'), text(u));
  assert.ok(text(u).includes('S502 EN and MU01 CO are shown away on the 501/502 board'), text(u));
  assert.ok(!u.includes('Holder, J') && !u.includes('<mark'));
  assert.ok(!view(unread, []).run('cardLines')(unread, 'S502-CO', []).some((l) => /Garnet/.test(l.text)));
});

test('the four menus above the boxes are gone, for every member', () => {
  // Owner, 2026-11-12, shown the Trains, Pools, Spareboards and Other menus now and cleaned up:
  // "I want them removed not fixed" (the test site first); then, to the list of what the test site had,
  // "1-8. 10, 11, 12, 13, 14, 15, 16" (this is 1).
  assert.ok(html.includes('"I want them removed not fixed"'));
  // The "No change until" chip that shared their row stays.
  assert.ok(html.includes('${same ? `<div class="screens" style="margin-top:8px">${same}</div>` : \'\'}</div>'));
  for (const gone of ['menusOff', 'screenGroups', "['Trains', ['callBoard'", 'class="screen-group"', 'data-jump="\' + esc(k)', 'const JUMPS = ', 'const SCREENS = ']) assert.ok(!html.includes(gone), gone);
});
