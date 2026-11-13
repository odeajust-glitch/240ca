// Agreements tab, the answer tools. Owner, 2026-11-12 evening, to the suggestions put to him: "Go with your pick:
// 3, 2, 1, 4 and 5". Test site only (board.html passes preview: PREVIEW to board-ask.js) until he says otherwise.
//   3. the answer drawn with its formatting; a [n] opens that passage
//   2. "the documents below" said where they are
//   1. a question naming a document the search leaves out is offered it
//   4. after "couldn't find it": the wording tip and examples
//   5. Copy answer, with the pages it cites
// The pure functions are cut from board-ask.js and run here. No question is ever sent.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ask = fs.readFileSync(require.resolve('../../public/board-ask.js'), 'utf8');
const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = ask.indexOf(from); const b = ask.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found: ${from}`); return ask.slice(a, b); };
const ctx = {};
vm.createContext(ctx);
vm.runInContext(cut('  const esc = (s) =>', '\n  let box = null;'), ctx);
vm.runInContext(`${cut('  function answerHtml(raw, n) {', '  // --- end of the answer tools ---')}\nglobalThis.T = { answerHtml, notFound, plainText, refsIn, mentioned, MENTIONS };`, ctx);
const { answerHtml, notFound, plainText, refsIn, mentioned } = ctx.T;

test('3: the marks the answers use are drawn, not shown as typed', () => {
  // The shapes found in his Search Review (4 to 12 Nov): **bold** (with an *italic* word inside), # headings,
  // - and * bullets (some indented), a > quote, a --- line, [n], [1][2] and [1, 2].
  const raw = '**Held away *after 14 hours*** is paid [1].\n\n# Rates\n- **A pool**: 9 miles [2]\n  - after 18 hours [1][2]\n* B pool [1, 2]\n\n1. one\n2. two\n\n> quoted\n\n---\nEnd: 5 * 3 = 15, and 2*x.';
  const h = answerHtml(raw, 2);
  assert.equal(h, '<p><b>Held away <i>after 14 hours</i></b> is paid [<button type="button" class="askref" data-ref="1">1</button>].</p>'
    + '<h4>Rates</h4><ul><li><b>A pool</b>: 9 miles [<button type="button" class="askref" data-ref="2">2</button>]</li>'
    + '<li class="sub">after 18 hours [<button type="button" class="askref" data-ref="1">1</button>][<button type="button" class="askref" data-ref="2">2</button>]</li>'
    + '<li>B pool [<button type="button" class="askref" data-ref="1">1</button>, <button type="button" class="askref" data-ref="2">2</button>]</li></ul>'
    + '<ol><li>one</li><li>two</li></ol><blockquote>quoted</blockquote><p>End: 5 * 3 = 15, and 2*x.</p>');
  // A number past the passages it was written from stays text; a numbered list keeps its first number.
  assert.ok(answerHtml('see [9]', 2).includes('see [9]') && !answerHtml('see [9]', 2).includes('askref'));
  assert.ok(answerHtml('3. three\n4. four', 0).startsWith('<ol start="3">'));
  // Everything is escaped before the marks become tags.
  const evil = answerHtml('**<script>alert(1)</script>** <img src=x onerror=1> "q" & \'a\'', 0);
  assert.ok(!/<script|<img/.test(evil) && evil.includes('&lt;script&gt;') && evil.includes('&amp;') && evil.includes('&quot;q&quot;'));
  // While it is still being written, an unclosed mark stays as it is until it closes.
  assert.equal(answerHtml('**Held aw', 0), '<p>**Held aw</p>');
});

test('3: drawn that way on the test site only; a [n] opens the passage the answer was written from', () => {
  assert.ok(ask.includes('    const md = preview;'));
  assert.ok(ask.includes("      if (md) { run._raw += t; run.innerHTML = answerHtml(run._raw, run._cites.length); } else run.textContent += t;"));
  assert.ok(ask.includes("        if (md) { run.className = 'askmd'; run._raw = ''; run._cites = citesNow; }"));
  assert.ok(ask.includes("run = document.createElement(md ? 'div' : 'span');"), 'members keep the plain text span');
  // The passages an answer was written from are kept with it, so after a deeper search an earlier answer's [n]
  // still opens its own passage.
  assert.ok(cut('  function cites(list) {', '\n  }').includes('    citesNow = list;'));
  const show = cut('  function showPassage(b) {', '\n  }');
  assert.ok(show.includes('const c = run && (run._cites || [])[k - 1];') && show.includes('esc(c.fullText || c.snippet)') && show.includes('citeHref(c)'));
  assert.ok(html.includes('.askanswer .askmd, .askanswer .asknf { white-space: normal; }'));
});

test('2: the note says the documents are the ones picked above (with the craft buttons, on the test site)', () => {
  const set = cut('  function setPreview(on) {', '\n  }\n');
  // Three notes share the class askhint; the first in the page is "Tap one to add it" (found in a browser).
  assert.ok(set.includes("const hint = [...box.querySelectorAll('.askhint')].find((p) => /the documents (?:picked above|below)/.test(p.textContent));"));
  assert.ok(set.includes("if (hint) hint.textContent = hint.textContent.replace(/the documents (?:picked above|below)/, preview && simple ? 'the documents picked above' : 'the documents below');"));
  const built = cut('  function build() {', '\n  }\n');
  assert.equal((built.match(/class="muted askhint"/g) || []).length, 3);
  assert.ok(built.indexOf('Tap one to add it') < built.indexOf('the documents below'), 'the first askhint is not the one to change');
  assert.ok(ask.includes('<p class="muted askhint">Answers come only from the documents below, with the page for every point.'), 'the page as members have it');
});

test('1: a question naming a document the search leaves out is offered it', () => {
  const ids = (q) => JSON.parse(JSON.stringify(mentioned(q)));
  assert.deepEqual(ids('What does CROR rule 42 say?'), ['cror']);
  assert.deepEqual(ids('What does Rule 105 say about speed?'), ['cror']);
  assert.deepEqual(ids('Where is that in the GOI?'), ['goi']);
  assert.deepEqual(ids('Which placard goes on a dangerous goods car?'), ['dangerous_goods']);
  assert.deepEqual(ids('What discipline is given for a missed call?'), ['disciplinary_grid']);
  assert.deepEqual(ids('Is there a CROA award on held away time?'), ['croa']);
  assert.deepEqual(ids('What does the 8960 operating manual say?'), ['le_operating_manual']);
  for (const q of ['What does Article 18.6 say?', 'How much rest under the duty and rest rules?', 'How is deadheading paid?', 'What is a runaround?']) assert.deepEqual(ids(q), [], q);
  // Only one that is not ticked and can be added (4.3 and 4.16 cannot be searched together).
  const paint = cut('  function paintMentions() {', '\n  }');
  assert.ok(paint.includes('return i && !i.checked && !i.disabled;'));
  assert.ok(paint.includes('i.checked = true; refresh();'));
  assert.ok(ask.includes("$('#askq').addEventListener('input', () => { if (preview) paintMentions(); });"));
});

test('4: after "couldn’t find it", the wording tip and three examples (which fill the box, never send)', () => {
  for (const t of ['I could not find that in the excerpts provided.', 'I couldn’t find it [1].', "I couldn't find a rule on that.", 'No matching passages were found in the selected document(s) for this question.', 'The excerpts do not contain the rate.']) assert.equal(notFound(t), true, t);
  for (const t of ['Article 18.6 pays 12 1/2 miles an hour after 14 hours [1].', '', null]) assert.equal(notFound(t), false, String(t));
  const box = cut('  function notFoundBox() {', '\n  }');
  assert.ok(box.includes('Didn’t find it?') && box.includes('“held at the away-from-home terminal”, not “kept in Toronto”') && box.includes('exampleList(list)'));
  const done = cut('  function answerDone(ans) {', '\n  }');
  assert.ok(done.includes("if (notFound(run._raw) && !ans.querySelector('.asknf'))") && done.includes("wireFill(ans.querySelector('.asknf'))"));
  assert.ok(ask.includes("else if (e.type === 'done') { if (e.canEscalate) deep.hidden = false; if (md) answerDone(ans); }"));
});

test('5: Copy answer: the question, the answer without its marks, the pages it cites, and the note', () => {
  assert.equal(plainText('**Held away *after 14 hours*** applies [1].\n\n# Rates\n* item\n  * sub\n---\nok'), 'Held away after 14 hours applies [1].\n\nRates\n- item\n  - sub\n\nok');
  assert.deepEqual(JSON.parse(JSON.stringify(refsIn('a [2] b [1, 2] c [3][9]', 4))), [2, 1, 3]);
  const copy = cut('  async function copyAnswer(b) {', '\n  }\n');
  assert.ok(copy.includes('`Question: ${last.question}`') && copy.includes('plainText(run._raw)') && copy.includes('const used = refsIn(run._raw, list.length);'));
  assert.ok(copy.includes('A search aid, not legal advice: confirm with your Local Chairperson.'));
  assert.ok(copy.includes('navigator.clipboard.writeText(text)') && copy.includes("document.execCommand('copy')"));
  // Shown once an answer is finished; hidden when a new one starts.
  assert.ok(ask.includes('    if (copy) copy.hidden = true;') && cut('  function answerDone(ans) {', '\n  }').includes('if (copy) copy.hidden = notFound(run._raw);'));
});

test('members: the tab is built as before, and the test site’s pieces come off again', () => {
  const built = cut('  function build() {', '\n  }\n');
  for (const cls of ['asksugg', 'asktry', 'askhow', 'askcopy', 'asknf', 'askmd']) assert.ok(!built.includes(cls), cls);
  assert.ok(ask.includes("} else box.querySelectorAll('.asksugg, .asktry, .askhow, .askcopy').forEach((x) => x.remove());"));
  assert.ok(html.includes('window.BoardAsk.render(view, { simple: true, preview: PREVIEW });'));
});
