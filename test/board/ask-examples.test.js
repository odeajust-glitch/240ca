// Agreements tab: example questions and how to ask. Owner, 2026-11-12 evening: "add some sample questions and
// explanations ... example of good questions to ask, and the type of questions to ask. Explain how AI can be more
// useful than a normal search engine and its limitations"; shown a picture of it: "Push these changes to the test
// site"; then, to the list of what the test site had, "1-8. 10, 11, 12, 13, 14, 15, 16" (this is 10): on for
// every member since 2026-11-12 evening (board.html passes preview: true).
// Every example is run through the site's own word search (lib/search.js, the top 9 passages the answer is
// written from) over the repository's own copies of the agreements, with that craft's everyday documents, and
// must find the part of the agreement it is about. A new example needs its own line in TOPIC.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildIndex } = require('../../lib/indexer');
const { SearchIndex } = require('../../lib/search');

const ask = fs.readFileSync(require.resolve('../../public/board-ask.js'), 'utf8');
const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (src, from, to) => { const a = src.indexOf(from); const b = src.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found: ${from}`); return src.slice(a, b + to.length); };
const EXAMPLES = vm.runInNewContext(`(${cut(ask, 'const EXAMPLES = {', '\n  };').replace('const EXAMPLES = ', '').replace(/;$/, '')})`);
const COMMON = vm.runInNewContext(`(${cut(ask, 'const COMMON = {', '\n  };').replace('const COMMON = ', '').replace(/;$/, '')})`);

// What each example is about: at least two of the nine passages must say it, one of them in the first three.
const TOPIC = {
  'What am I paid when I am held at the away-from-home terminal more than 14 hours?': /held[- ]away|away[- ]from[- ]home/i,
  'What is a runaround and how is it paid?': /run-?around/i,
  'What am I paid if I am called and then cancelled?': /cancel/i,
  'When can I book rest, and how much rest can I book?': /book.{0,20}rest|rest.{0,20}book/i,
  'How am I paid if I work on a general holiday?': /general holiday/i,
  'How are trains assigned to the A pool and B pool in Sarnia?': /[“"]?[AB][”"]? pool/i,
  'How long can a locomotive engineer be held at the away-from-home terminal?': /held[- ]away|away[- ]from[- ]home/i,
  'How is an engineer paid for deadheading?': /deadhead/i,
  'When can an engineer book rest, and how much rest?': /book.{0,20}rest|rest.{0,20}book/i,
  'How are engineers called off the spare board?': /spare board/i,
  'What is the most mileage an engineer can run in a month?': /mileage limitation|3800 miles|monthly mileage/i,
  'How much bereavement leave does an engineer get?': /bereavement/i,
};
const FILES = { conductors: 'conductors.pdf', conductors_addendum: 'conductors_addendum.pdf', crew_calling_cty: 'crew_calling_cty.pdf', rest_rules: 'rest_rules.pdf',
  engineers: 'engineers.pdf', crew_calling: 'crew_calling_manual.pdf', mileage_guidelines: 'mileage_guidelines.txt' };

test('six examples a craft, each with what it is about', () => {
  assert.equal(EXAMPLES.conductor.length, 6);
  assert.equal(EXAMPLES.engineer.length, 6);
  for (const q of [...EXAMPLES.conductor, ...EXAMPLES.engineer]) {
    assert.ok(TOPIC[q], `no topic for: ${q}`);
    assert.ok(q.endsWith('?') && q.length <= 500, q);
  }
});

test('every example finds the part of the agreement it is about, in that craft’s documents', async () => {
  const D = path.join(__dirname, '..', '..', 'data');
  const idx = new SearchIndex(await buildIndex(Object.entries(FILES).map(([id, f]) => ({ filePath: path.join(D, f), label: id }))));
  for (const craft of ['conductor', 'engineer']) {
    for (const q of EXAMPLES[craft]) {
      const hits = idx.search(q, { topK: 9, sources: COMMON[craft] }); // the answer is written from these (TOP_K)
      const about = hits.map((h) => TOPIC[q].test(h.text));
      assert.ok(about.filter(Boolean).length >= 2 && about.slice(0, 3).some(Boolean), `${craft}: "${q}" found ${about.filter(Boolean).length} of ${hits.length}`);
    }
  }
  // The mileage limit is in the mileage guidelines themselves.
  assert.ok(idx.search('What is the most mileage an engineer can run in a month?', { topK: 9, sources: COMMON.engineer }).slice(0, 3).some((h) => h.source === 'mileage_guidelines'));
  // What the "How to ask" fold says about wording, as the search does it today.
  const toronto = idx.search('How long can they keep me in Toronto?', { topK: 9, sources: COMMON.conductor });
  assert.equal(toronto.filter((h) => TOPIC[EXAMPLES.conductor[0]].test(h.text)).length, 0, '"keep me in Toronto" finds nothing about being held');
  const held = idx.search(EXAMPLES.conductor[0], { topK: 9, sources: COMMON.conductor });
  assert.ok(held.slice(0, 2).some((h) => /18\.6|After 14 hours/.test(h.text)), 'the held-away question finds Article 18.6 at the top');
});

test('on for every member; a tap fills the box and never sends', () => {
  // Owner, 2026-11-12 evening, to the test-site list: "1-8. 10, 11, 12, 13, 14, 15, 16".
  assert.ok(html.includes('window.BoardAsk.render(view, { simple: true, preview: true });'));
  assert.ok(!/BoardAsk\.render\([^)]*PREVIEW/.test(html), 'not tied to the test site any more');
  assert.ok(ask.includes('      setPreview(!!(opts && opts.preview));'));
  // Off: nothing added (and anything added is taken away again).
  assert.ok(ask.includes("} else box.querySelectorAll('.asksugg, .asktry, .askhow, .askcopy').forEach((x) => x.remove());"));
  // The tap: the box is filled and shown; ask() is not called.
  const tap = cut(ask, '  function fillBox(q) {', '\n  }') + cut(ask, '  const wireFill = (el) =>', ');\n');
  assert.ok(tap.includes('t.value = q;') && tap.includes('b.onclick = () => fillBox(b.textContent)') && !/\bask\(|deeper\(|fetch\(/.test(tap));
  // Six for the craft picked; three of each until one is picked; repainted when the craft changes.
  assert.ok(ask.includes('const list = craft ? EXAMPLES[craft] : [...EXAMPLES.conductor.slice(0, 3), ...EXAMPLES.engineer.slice(0, 3)];'));
  assert.ok(ask.includes('    refresh();\n    paintExamples();\n  }'));
});

test('the two explanations say what was asked for, in plain words', () => {
  const how = cut(ask, 'const HOW = `', '</details>`;');
  const why = cut(ask, 'const WHY = `', '</details>`;');
  assert.ok(how.includes('<summary>How to ask a good question</summary>'));
  assert.ok(how.includes('"How long can they keep me in Toronto?" found nothing useful.'));
  assert.ok(how.includes('Each question starts fresh'));
  assert.ok(how.includes('<b>Good for:</b>') && how.includes('<b>Not for:</b>'));
  assert.ok(why.includes('<summary>What it does better than a search engine, and its limits</summary>'));
  assert.ok(why.includes('not the internet'));
  // The figures it gives are the Worker's own: 9 passages a question, 24 for a deeper search.
  const worker = fs.readFileSync(require.resolve('../../cloudflare/board-worker.js'), 'utf8');
  assert.ok(worker.includes('const TOP_K = 9;') && worker.includes('const TOP_K_DEEP = 24;') && why.includes('about 9 a question, 24 in a deeper search'));
  assert.ok(why.includes('confirm with your Local Chairperson'));
  // Folded by default (no open attribute).
  assert.ok(!/<details[^>]* open/.test(how + why));
});
