// The call card on the page (owner, 2026-11-12): a preview for the test site only. These run the page's own
// functions, cut from public/board.html, with the preview switch off and on: off, the page must say and draw
// exactly what the main site does today; on, the plain words and the card. Turn ids and train ids only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const A = require('../../public/board-analytics');
const T = require('../../public/board-trains');

const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };
// The page's call-list functions in a sandbox, with the preview switch set as asked.
function page({ preview = false, rule = null } = {}) {
  const store = rule ? { boardCallRule: rule } : {};
  const ctx = { BoardAnalytics: A, BoardTrains: T, PREVIEW: preview, stampMin: T.toMin,
    esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    split: (s) => s.split(' '), plural: (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`,
    local: { get: (k) => (k in store ? store[k] : null), set: (k, v) => { store[k] = v; } } };
  vm.createContext(ctx);
  vm.runInContext(cut('function dt(stamp) {', 'const ON_TIME = 15;'), ctx); // dt, dur
  vm.runInContext(cut('const cur2Row = ', 'function lineup2(s) {'), ctx);
  vm.runInContext(cut('const ANA2_PAGE = 20;', 'const ANA_SECS = ['), ctx); // ANA2_CALLS, callRule, callOpen, callRowWords, the plain note
  vm.runInContext(cut('  const CS2_BANDS = [', '  function ana2Pass(view, callPage'), ctx); // the cards, the rows, the list
  return { ctx, run: (code) => vm.runInContext(code, ctx), store };
}
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Lined up on the 10th at 0900 for the 11th at 1900; the board showed 1655 once the call was 8 hours away;
// at 1400 it moved to 1500 and the call came at 1500.
const base = { turn: 'SR07', train: 'M39671 10', expectedTrain: 'M39671 10', firstTrain: 'M39671 10', firstSeen: '2026-11-10 0900', firstCall: '2026-11-11 1900',
  sleepAt: '2026-11-11 0855', expected: '2026-11-11 1655', noWindow: false, short: false, call: '2026-11-11 1500', onDuty: '2026-11-11 1700', seen: '2026-11-11 1710', off: -115,
  timelineChanges: [{ taken: '2026-11-11 0855', call: '2026-11-11 1655', train: 'M39671 10' }, { taken: '2026-11-11 1400', call: '2026-11-11 1500', train: 'M39671 10' }], shifts: [], timelineComplete: true };
const late = { ...base, turn: 'SR03', call: '2026-11-11 1900', onDuty: '2026-11-11 2100', timelineChanges: [base.timelineChanges[0]] };
const shortOnTime = { ...base, turn: 'SR08', firstSeen: '2026-11-11 1000', firstCall: '2026-11-11 1700', sleepAt: '2026-11-11 1000', expected: '2026-11-11 1700', short: true, call: '2026-11-11 1700', onDuty: '2026-11-11 1900', timelineChanges: [] };
const takenOff = { ...base, turn: 'SR05', call: undefined, takenOff: true, onDuty: '2026-11-11 1410', seen: '2026-11-11 1410', replacedBy: 'S109', timelineChanges: [base.timelineChanges[0]] };
const blip = { ...takenOff, turn: 'B105', firstSeen: '2026-11-11 1402', sleepAt: '2026-11-11 1402', short: true }; // on the line-up 8 minutes

test('preview off: a call opens as today’s graph, exactly, and nothing of the card is drawn', () => {
  const p = page({ preview: false });
  const out = p.run('callOpen')(base);
  assert.equal(out, A.renderCallTimelineV2(base).replace('<details class="call-timeline ct2">', '<details class="call-timeline ct2" open>'));
  assert.ok(out.includes('<details class="call-timeline ct2" open>'));
  assert.ok(!out.includes('callcard'));
  // The owner's switch does nothing off the test site: today's rule, whatever is stored on the device.
  assert.equal(page({ preview: false, rule: 'before' }).run('callRule')().rule, 'eight');
});

test('preview off: the rows, the cards and the list read as they do on the main site today', () => {
  const p = page({ preview: false });
  const rows = text(p.run('ana2CallRows')([base, late, takenOff], true, 0, 20));
  for (const t of ['planned 11th 1900 → called 11th 1500', '4 h 00 m early', 'planned 11th 1900 → called 11th 1900', 'called when planned', 'removed from the line-up', 'now S109']) assert.ok(rows.includes(t), `${t}\n${rows}`);
  for (const t of ['expected', 'earlier', 'warning', 'taken off']) assert.ok(!rows.includes(t), t);
  // Today's count: the first planned call, all in the five groups.
  const st = p.run('ana2OriginStats')([base, late, shortOnTime, takenOff]);
  assert.equal(st.calls, undefined);
  assert.deepEqual([...st.c], [1, 0, 2, 0, 0]); // (copied out of the sandbox to compare)
  const card = text(p.run('ana2OriginCard')('Ordered out of Sarnia', 'trains on the Sarnia line-up', st));
  for (const t of ['67% called within 30 min of the plan', 'Over 1 h early', 'Within 30 min', 'Under 8 h notice: 33% (1)']) assert.ok(card.includes(t), `${t}\n${card}`);
  // A short wait is still listed with the rest.
  const list = p.run('ana2CallList')([blip, base], true);
  assert.ok(!list.includes('cs2-waits'));
  assert.equal((list.match(/<details class="cur2/g) || []).length, 2);
});

test('preview on: a call opens as the plain card, by today’s rule unless the owner has tapped Proposed', () => {
  const p = page({ preview: true });
  assert.equal(p.run('callRule')().rule, 'eight');
  const out = p.run('callOpen')(base);
  assert.equal(out, A.renderCallCard(base, { rule: 'eight' }));
  assert.ok(out.includes('Called 1 h 55 m earlier than expected'));
  assert.ok(!out.includes('ct2'));
  const q = page({ preview: true, rule: 'before' });
  assert.equal(q.run('callRule')().rule, 'before');
  assert.ok(q.run('callOpen')(base).includes('Called 4 h earlier than expected')); // the board still said 1900 eight hours before the call
  // Anything else stored is today's rule.
  assert.equal(page({ preview: true, rule: 'nonsense' }).run('callRule')().rule, 'eight');
});

test('preview on: a row says expected → called, how far it moved, and the warning when it was short', () => {
  const p = page({ preview: true });
  const rows = text(p.run('ana2CallRows')([base, late, shortOnTime, takenOff], true, 0, 20));
  for (const t of ['expected 11th 1655 → called 11th 1500', '1 h 55 m earlier', 'expected 11th 1655 → called 11th 1900', '2 h 05 m later', 'expected 11th 1700 → called 11th 1700', 'when expected', '7 h warning', 'expected 11th 1655 taken off before the call', 'now S109']) assert.ok(rows.includes(t), `${t}\n${rows}`);
  for (const t of ['planned', ' early', ' late ', 'removed']) assert.ok(!rows.includes(t), t);
  const w = p.run('callRowWords')(late);
  assert.equal(w.result, '<span class="offv late">2 h 05 m later</span>');
  assert.equal(p.run('callRowWords')(shortOnTime).warning, '<span class="offv bad">7 h warning</span>');
  assert.equal(p.run('callRowWords')({}), null);
  // First seen after going on duty: said, not scored.
  const ghost = { ...base, turn: 'SD09', firstSeen: '2026-11-11 2000', firstCall: '2026-11-12 0900', sleepAt: null, noWindow: true };
  assert.ok(text(p.run('ana2CallRows')([ghost], true, 0, 20)).includes('on duty 11th 1700 not scored'));
  // The other craft on a 501/502 is not who took the job.
  const mate = { ...takenOff, turn: 'S502-CO', replacedBy: 'S502-EN' };
  assert.ok(!text(p.run('ana2CallRows')([mate], true, 0, 20)).includes('now S502-EN'));
});

test('preview on: the cards count every call against the expected time its row shows', () => {
  const p = page({ preview: true });
  const unseen = { ...base, turn: 'SR09', firstSeen: '2026-11-11 1516', firstCall: '2026-11-11 1500', sleepAt: '2026-11-11 1516', expected: '2026-11-11 1500', short: true, timelineChanges: [] };
  const st = p.run('ana2OriginStats')([base, late, shortOnTime, takenOff, unseen]);
  assert.deepEqual(st, A.callSummary([base, late, shortOnTime, takenOff, unseen], { rule: 'eight' }));
  assert.equal(st.calls, 4);
  const card = text(p.run('ana2OriginCard')('Ordered out of Sarnia', 'trains on the Sarnia line-up', st));
  for (const t of ['trains on the Sarnia line-up · 4 calls', '25% called when expected (within 30 min)', 'Over 1 h earlier 25% 1', 'When expected 25% 1', 'Over 1 h later 25% 1', 'No warning: nothing on the board first 25% 1', 'Under 8 h warning: 50% 2']) assert.ok(card.includes(t), `${t}\n${card}`);
  for (const t of ['of the plan', 'notice', 'Within 30 min ']) assert.ok(!card.includes(t), t);
  // The Proposed rule moves the counts with the cards.
  const q = page({ preview: true, rule: 'before' });
  assert.deepEqual(q.run('ana2OriginStats')([base]).c, [1, 0, 0, 0, 0]);
  assert.deepEqual(q.run('ana2OriginStats')([base]), A.callSummary([base], { rule: 'before' }));
  // No calls at all.
  assert.ok(text(p.run('ana2OriginCard')('Yard jobs', 'x', A.callSummary([]))).includes('No calls in these dates.'));
});

test('preview on: on a line-up under 30 minutes and taken off again folds away under the list', () => {
  const p = page({ preview: true });
  const list = p.run('ana2CallList')([blip, base, takenOff], true);
  assert.ok(list.includes('<details class="cs2-waits"><summary>1 short wait not listed: on a line-up under 30 minutes, then taken off</summary>'));
  const [shown, folded] = list.split('<details class="cs2-waits">');
  assert.equal((shown.match(/<details class="cur2/g) || []).length, 2); // the call, and the turn taken off after 29 hours
  assert.equal((folded.match(/<details class="cur2/g) || []).length, 1);
  assert.ok(text(folded).includes('B105'));
  // Only short waits: still said, not an empty page.
  assert.ok(p.run('ana2CallList')([blip], true).includes('1 short wait not listed'));
  assert.ok(p.run('ana2CallList')([], true).includes('No calls tracked in these dates.'));
});

test('preview on: the owner’s switch and “how to read a call” say which rule is showing', () => {
  const p = page({ preview: true });
  const sw = p.run('ana2RuleSwitch')(true);
  assert.ok(sw.includes('data-callrule="eight" aria-pressed="true"'));
  assert.ok(sw.includes('data-callrule="before" aria-pressed="false"'));
  for (const t of ['For you to pick', 'As now', 'Proposed', 'what the board showed 8 hours before the call came', 'EN09', 'SR02', 'SB05']) assert.ok(text(sw).includes(t), t);
  assert.ok(!text(p.run('ana2RuleSwitch')(false)).includes('SB05')); // the short form, above a turn's own calls
  const q = page({ preview: true, rule: 'before' });
  assert.ok(q.run('ana2RuleSwitch')(true).includes('data-callrule="before" aria-pressed="true"'));
  const read = text(p.run('ana2ReadCall')());
  for (const t of ['A made-up call', 'Called 1 h 30 m earlier than expected', 'Expected is the time the board was showing once the call was 8 hours or less away', 'Called is on duty less 2 hours', 'Within 30 minutes either way counts as called when expected']) assert.ok(read.includes(t), `${t}\n${read}`);
  assert.ok(text(q.run('ana2ReadCall')()).includes('Expected is what the board was showing 8 hours before the call came'));
  // One example and a handful of lines, not four graphs and an eight-part key.
  assert.equal((p.run('ana2ReadCall')().match(/class="callcard/g) || []).length, 1);
  assert.ok(!read.includes('White bar'));
});

test('the page keeps today’s graph for the main site in every place it is used', () => {
  // The exact expressions the main site runs must still be in the page: only a preview branch was added beside each.
  for (const t of [
    ": BoardAnalytics.renderCallTimelineV2(z).replace('<details class=\"call-timeline ct2\">', '<details class=\"call-timeline ct2\" open>'));",
    "BoardAnalytics.renderCallTimelineV2(z).replace('<summary>Show call timeline</summary>', `<summary>${esc(z.turn)}: call timeline</summary>`)",
    'BoardAnalytics.renderCallTimelineV2(z, { bare: true })',
    "BoardAnalytics.renderCallTimelineV2(z) + '</article>';",
    'const rows = BoardAnalytics.planReliability(list).rows;',
    "el.textContent = gap < 0 ? 'Called ' + dur(gap) + ' early' : gap > 0 ? dur(gap) + ' late' : 'At original expected call time';",
  ]) assert.ok(html.includes(t), t);
  // The card and its counts are reached only through the preview switch.
  for (const line of html.split('\n').filter((l) => /BoardAnalytics\.(renderCallCard|callCard|callSummary|callSummaryByTurn)\(/.test(l))) {
    const at = html.indexOf(line);
    const around = html.slice(Math.max(0, at - 1600), at + line.length + 400);
    assert.ok(/PREVIEW|function callRowWords|function ana2ReadCall/.test(around), line.trim().slice(0, 120));
  }
  // The preview is the test site's address and the owner key, as before.
  assert.ok(html.includes("const PREVIEW_HOST = /^board-test\\./.test(location.hostname);"));
  assert.ok(html.includes('const preview = PREVIEW_HOST && !!(h && OwnerKey.has());'));
});
