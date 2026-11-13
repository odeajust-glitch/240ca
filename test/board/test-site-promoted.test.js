// What the test site had and the main site did not, on 2026-11-12 evening, listed for the owner as sixteen
// items ("review the test site, list what needs to be pushed to the main so I can review"). His answer:
// "1-8. 10, 11, 12, 13, 14, 15, 16". All but 9 and 16 are on for every member, both sites, since then:
//   1 the four menus off Current (current-review.test.js)   2 "Follow a turn (alerts)" and "Turn History →"
//   3 the pinned strip   4 Back = the tab before   6 My stats' jump list   8 Analytics' Overview and row
//   (site-review.test.js)   10, 11 Agreements (ask-examples, ask-review)   12 Snapshots drawn like Current
//   (current-review)   13, 14 Members (members-review)   and, here: 5 Turn History's layout, 7 Article
//   18.6(b) as rows, 15 the compact header.
// Not picked: 9, My week's "Sleep this week" box: still the test site's. Picked but held back: 16, the "newer
// version" bar, which cannot show on the live sites as built (the page's address answers without an ETag,
// Last-Modified or Content-Length once Cloudflare compresses it): still the test site's, told to him.
// Also still the test site's, at his word: the TEST SITE badge, the purple pieces, Analytics → Likely-call test.
// Turn ids only; no names.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };
const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

test('5. Turn History: Now first, short work rows, the notes folded, for every member', () => {
  const panel = cut('function turnPanel(s) {', '// A time that opens that snapshot.');
  assert.ok(!/\bPREVIEW\b/.test(panel));
  assert.equal(panel.split('return `<section class="sheet turnpanel').length - 1, 1, 'one layout');
  assert.ok(panel.includes('return `<section class="sheet turnpanel tn2">'));
  assert.ok(panel.indexOf('<div class="tn2-now"><h3>Now') < panel.indexOf('<div id="worklog" class="work"></div>'), 'Now comes before the work history');
  assert.ok(panel.includes('<details class="moredet tn2-notes"><summary>Board notes: every change the checks saw</summary><div id="turnhist" class="hist">'));
  // The work history: one layout, the newest six, the rest behind a button, the calls added up.
  const work = cut('function workHistory(rec, turnIn, resets = [], offs = {}) {', 'const WORK2_SHOW = 6;');
  assert.ok(!/\bPREVIEW\b/.test(work));
  assert.ok(work.includes('<p class="work2-sum" data-work-sum') && work.includes('<div class="work2"><table>') && work.includes('data-work-more>Show all ${rows.length} trips</button>'));
  assert.ok(!work.includes('<div class="scroll"><table>'), 'the older wide table is gone');
  assert.ok(work.includes("${esc(offLine(o, offs).replace(/^ · /, ''))}"), 'the off duty line as the test site had it (no break before its bracket)');
  // A person search the same way; the turns looked up lately, one tap each (name codes never kept there).
  const person = cut('  async function showPerson(code, s) {', "    box.querySelectorAll('[data-pickp]')");
  assert.ok(person.includes('<section class="sheet turnpanel tn2"><header><h2>Person search</h2>') && !/\bPREVIEW\b/.test(person));
  assert.ok(person.includes('<details class="moredet tn2-notes"><summary>Turns seen on (${homes.length})</summary>'));
  assert.ok(html.includes('    const r = recentTurns().filter((x) => x !== focus && !tracked().includes(x));'));
  assert.ok(html.includes("function recentTurns() { const r = local.get('boardTurnsRecent'); return Array.isArray(r) ? r.filter((x) => typeof x === 'string' && !isCode(x)) : []; }"));
});

test('7. Article 18.6(b): rows in place of the sideways table, for every member', () => {
  const held = cut('  async function renderHeld() {', "    view.querySelector('[data-held-period]').onclick");
  assert.ok(held.includes("    view.classList.add('ana2'); ana2Stack(view, { all: true });"));
  assert.ok(!/\bPREVIEW\b/.test(held));
  // Leaving the tab takes the class off again (setMode), as it did on the test site.
  assert.ok(html.includes("    if (!ANA2) document.getElementById('view').classList.remove('ana2');"));
});

test('15. the compact header on a phone, for every member; the TEST SITE badge stays the test site’s', () => {
  assert.ok(style.includes('@media (max-width: 700px) { body.everyone .top h1 { font-size: 22px; } body.everyone .top .where { display: none; } body.everyone .signnote { padding: 8px 14px; font-size: 13px; } }'));
  assert.ok(style.includes("body.preview-site .top h1::after { content: 'TEST SITE';"));
  // The badge is the one rule left under the test site's class (comments aside).
  const rules = style.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(rules.match(/body\.preview-site[^{,]*(?=[{,])/g), ['body.preview-site .top h1::after ']);
  // The page's <body> always carries the class the promoted rules are under; the test site's class is still
  // switched by the page for what remains.
  assert.ok(html.includes('<body class="everyone">'));
  assert.ok(html.includes("PREVIEW = preview; document.body.classList.toggle('preview-site', PREVIEW);"));
  // The page's name stays as it is (his "2 leave it"): only the second line is off on a phone.
  assert.ok(html.includes('<title>Line-up Snapshots</title>') && html.includes('<h1>Line-up Snapshots</h1>'));
});

test('still the test site’s: 9, 16, the purple pieces and the Likely-call test', () => {
  // 9 (not picked): My week's "Sleep this week".
  assert.ok(html.includes('    if (PREVIEW && trips.length) {') && html.includes('// Sleep (test site; owner, 2026-11-10)'));
  // 16 (held back): the bar asks for the page's version tag, which the live sites do not send.
  const bar = cut('  async function checkSiteVersion() {', '  setInterval(checkSiteVersion');
  assert.ok(bar.includes("if (!PREVIEW || document.getElementById('newversion')) return;"));
  assert.ok(bar.includes("const tag = r.ok && (r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length'));") && bar.includes('if (!tag) return;'));
  // The purple pieces and the test page (owner, 2026-11-12: "except the purple predictive stuff"; 2026-11-13:
  // the likely-call test "Leave it on the test site for now").
  assert.ok(html.includes("const d = PREVIEW && PATTERNS && num ? (PATTERNS.drift || {})[num] : null;"));
  assert.ok(html.includes("if (!PREVIEW || !PATTERNS || !od || t.status === 'ORD') return '';"));
  assert.ok(html.includes("if (PREVIEW && at < 0) ANA_SECS.push(['likely', 'Likely-call test']);"));
  assert.ok(html.includes('likely: PREVIEW ? likelyTest : anaHome'));
});
