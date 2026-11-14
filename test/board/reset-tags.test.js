// A person's reset beside them on the line-up and the Call board (owner, 2026-11-14, with a screenshot of
// Current: L50231 15 lined up with "CO S502 O'Dea, J", whose row in the 501/502 table said "reset needed by
// 15th 0449" in red: "Can you have it show reset required on the Call board a person needs it").
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const T = require('../../public/board-trains');
const Turns = require('../../public/board-turns');

const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const TAKEN = '2026-11-14 0554';
const RESETS = { taken: TAKEN, turns: {
  'S502-CO': { level: 'red', left: 300, dueText: '15th 0449' },
  'S502-EN': { level: '', left: 9000, dueText: '20th 0100' }, // not within 2 days: nothing shown
  B130: { level: 'yellow', left: 2000, dueText: '15th 2200' },
  SB04: { level: 'red', left: 100, dueText: '14th 0800' },
} };
function page(resets = RESETS) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ctx = vm.createContext({ BoardTrains: T, BoardTurns: Turns, esc, stampMin: T.toMin, split: (x) => x.split(' '), CREW: null, marks: [],
    marked: () => false, markedIn: () => false, markTurn: (t) => esc(t), crewTag: () => '', muTag: () => '', getJSON: () => Promise.resolve(null) });
  vm.runInContext(cut('// The reset tracker (owner, 2026-11-03)', '// One pool\'s board: its table'), ctx); // RESETS, resetFor, resetText, paintResets
  vm.runInContext(cut('const MU_TURN = ', '// Upcoming days off'), ctx); // resetTag, crewLine, onDuty
  vm.runInContext(cut('// Crew order in calling-rule text is conductor, then engineer.', 'function s5CrewWhy(s, t) {'), ctx); // lineupCrew
  vm.runInContext(cut('function ruleText(rules) {', '// Still planned 15 min or more past its call'), ctx);
  ctx.RESETS_IN = resets;
  vm.runInContext('RESETS = RESETS_IN;', ctx);
  return ctx;
}
const snap = (more = {}) => ({ taken: TAKEN, pools: [], vacancies: [], vacanciesPredicted: [], ...more });

test('reset tags: the line-up shows the reset of whoever works the train', () => {
  const p = page();
  // His screenshot: CO S502 goes, EN S502 goes spare with a spare covering it.
  const s = snap({ vacanciesPredicted: [{ cc: 'EN', trainDay: 'L50231 15', train: 'L50231', fill: { turn: 'B130' } }] });
  const crew = p.lineupCrew({ train: 'L50231 15', order: '15th 0400', rules: 'S5: S502 + S502 (goes spare)' }, s);
  assert.match(text(crew), /^Conductor: S502 reset needed by 15th 0449 · Engineer: spare \(S502 spare\) B130: reset needed by 15th 2200$/);
  assert.match(crew, /<span class="rtag r" data-rkey="S502-CO" data-rtaken="2026-11-14 0554">reset needed by 15th 0449<\/span>/);
  // The engineer's tag is the covering spare's (B130), not the S502 engineer's, who is not going.
  assert.match(crew, /<span class="rtag" data-rkey="B130"[^>]*data-rwho="B130">B130: reset needed by 15th 2200<\/span>/);
  assert.doesNotMatch(crew, /data-rkey="S502-EN"/);
  // No reset due within 2 days, or no turn at all: an empty tag (hidden), or none.
  const quiet = p.lineupCrew({ train: 'X 15', rules: 'Chain Gang: SR03 + SD05' }, s);
  assert.equal(text(quiet), 'Conductor: SR03 · Engineer: SD05');
  assert.equal(p.lineupCrew({ train: 'X 15', rules: 'Chain Gang: SR03 + spareboard (no SD turn free)' }, s).match(/class="rtag/g).length, 1);
});

test('reset tags: the Call board shows each crew member\'s, or the spare filling in for them', () => {
  const p = page();
  const s = snap({ onDuty: [
    { onDuty: '14th 0400', station: 'SARNIA', train: 'L50231 14', crew: 'EN S502 · CO S502', backfill: [] },
    { onDuty: '14th 0500', station: 'SARNIA', train: 'M38261 14', crew: 'EN SD06 · CO SB04', backfill: [{ craft: 'CO', job: 'SB04', turn: 'B130' }] },
  ] });
  const rows = [...p.onDuty(s, true).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].filter((m) => !/<th/.test(m[1])).map((m) => m[1]);
  assert.equal(text(rows[0]), '14th 0400 Sarnia L50231 14 EN S502 · CO S502 reset needed by 15th 0449');
  assert.match(rows[0], /CO S502<span class="rtag inl r" data-rkey="S502-CO"/);
  // SB04's own person isn't on the train: the spare working it, B130, carries the tag.
  assert.equal(text(rows[1]), '14th 0500 Sarnia M38261 14 EN SD06 · CO SB04 B130 filling in on SB04 reset needed by 15th 2200');
  assert.doesNotMatch(rows[1], /data-rkey="SB04"/);
});

test('reset tags: drawn empty before the resets are in, then filled in; another check\'s resets never', () => {
  const p = page(null);
  const s = snap();
  const tag = p.resetTag(s, 'S502', 'CO', true);
  assert.equal(tag, '<span class="rtag inl" data-rkey="S502-CO" data-rtaken="2026-11-14 0554"></span>');
  const el = (rkey, rtaken) => ({ dataset: { rkey, rtaken }, textContent: '', cls: new Set(), classList: { toggle(c, on) { if (on) this.owner.cls.add(c); else this.owner.cls.delete(c); } } });
  const tags = [el('S502-CO', TAKEN), el('SB04', '2026-11-14 0546'), el('S502-EN', TAKEN), el('B130', TAKEN)];
  tags[3].dataset.rwho = 'B130';
  for (const t of tags) t.classList.owner = t;
  p.document = { querySelectorAll: (q) => (q === '.rtag[data-rkey]' ? tags : []) };
  p.RESETS_IN = RESETS;
  vm.runInContext('RESETS = RESETS_IN; paintResets();', p);
  assert.deepEqual(tags.map((t) => [t.textContent, [...t.cls]]), [['reset needed by 15th 0449', ['r']], ['', []], ['', []], ['B130: reset needed by 15th 2200', []]]);
  // The page's style: hidden when empty; amber, red within 24 h.
  assert.ok(html.includes('.rtag:empty { display: none; }') && html.includes('.rtag.r { color: var(--stop); }'));
});
