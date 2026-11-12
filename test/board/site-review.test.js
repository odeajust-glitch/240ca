// The whole site, reviewed with the owner on 2026-11-12 ("Review the entire site, suggestion improvements to
// the layout or structure"; HANDOFF has the twelve items). Asked which to build on the test site he picked
// "1, 3, 5, 6, 7"; of the others he said "2 leave it and leave 11" (the site's name and the order of
// Settings stay as they are: not to be raised again).
// Every piece here is TEST SITE ONLY: behind PREVIEW (board-test with the owner key) in public/board.html.
// A member on either site sees the page as before. To promote a piece, drop its PREVIEW test and change the
// test below that pins it, quoting him.
// Turn ids only; no names.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

test('1. Back: every tab’s address leads back to its tab', () => {
  const ctx = vm.createContext({});
  vm.runInContext(`${cut('  function tabOfAddress(hash, days) {', '  // A step is added only')}; this.tabOfAddress = tabOfAddress;`, ctx);
  const at = (h, days = ['2026-11-12', '2026-11-11']) => JSON.parse(JSON.stringify(ctx.tabOfAddress(h, days)));
  // The address each tab writes for itself (history.replaceState in its render).
  const wrote = { '#current': 'current', '#turns': 'turns', '#mystats': 'mine', '#orders': 'orders', '#14h': 'held', '#analytics': 'analytics', '#agreements': 'ask', '#ref': 'ref', '#postings': 'postings', '#notifications': 'notes', '#members': 'members', '#pagehealth': 'health', '#searchreview': 'review' };
  for (const [hash, mode] of Object.entries(wrote)) {
    assert.equal(at(hash).mode, mode, hash);
    assert.ok(html.includes(`'${hash}'`) || html.includes(`${hash}\``) || html.includes(`'${hash}=`), `the page still writes ${hash}`);
  }
  assert.deepEqual(at('#turn=SR03'), { mode: 'turns', turn: 'SR03' });
  assert.deepEqual(at('#turn=S501-CO'), { mode: 'turns', turn: 'S501-CO' });
  assert.deepEqual(at('#postings=786099'), { mode: 'postings', focus: '786099' });
  assert.deepEqual(at('#postings'), { mode: 'postings', focus: '' });
  assert.deepEqual(at('#14h=Z14891%2010%7C11%7CCO'), { mode: 'held' });
  assert.deepEqual(at('#train=M38261-12'), { mode: 'orders' });
  assert.deepEqual(at('#week'), { mode: 'analytics' });
  // A snapshot's address opens that check; a day no longer kept, or anything unknown, opens Current.
  assert.deepEqual(at('#2026-11-12-0815'), { mode: 'snap', day: '2026-11-12', taken: '2026-11-12 0815' });
  assert.deepEqual(at('#2026-10-01-0815'), { mode: 'current' });
  assert.deepEqual(at(''), { mode: 'current' });
  assert.deepEqual(at('#nothing'), { mode: 'current' });
  // Every tab has a button the Back handler can check is there for this viewer.
  const buttons = JSON.parse(cut('  const TAB_BUTTON = ', ';\n').replace('  const TAB_BUTTON = ', '').replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
  for (const mode of [...Object.values(wrote), 'snap']) assert.ok(html.includes(`<button id="${buttons[mode]}" type="button"`), `${mode} has its tab button`);
});

test('1. Back: a step is added only for a real change of tab, and only on the test site', () => {
  const ctx = vm.createContext({});
  vm.runInContext(`${cut('  function tabStepWanted(from, to, started, quiet) {', '  const TAB_BUTTON = ')}; this.tabStepWanted = tabStepWanted;`, ctx);
  const want = ctx.tabStepWanted;
  assert.equal(want('current', 'analytics', true, false), true);
  assert.equal(want('current', true, true, false), true, 'setMode(true) is Order summary');
  assert.equal(want('orders', true, true, false), false, 'the open tab drawn again is not a step');
  assert.equal(want('snap', false, true, false), false, 'setMode(false) is Snapshots');
  assert.equal(want('analytics', 'analytics', true, false), false);
  assert.equal(want('current', 'turns', false, false), false, 'not while the page is still opening its first tab');
  assert.equal(want('current', 'turns', true, true), false, 'not while Back itself opens the tab');
  // Behind PREVIEW, in the one place every tab change goes through; Back is listened for only there too.
  assert.ok(html.includes("if (PREVIEW && tabStepWanted(mode, m, firstTabOpen, tabQuiet || !tabTapped())) { try { history.pushState(null, '', location.href); } catch (e) { /* not allowed in some frames */ } }"));
  assert.equal(html.split('history.pushState(').length - 1, 1, 'the only place a step is added');
  const back = cut("  window.addEventListener('popstate', () => {", '  // 3. The box on Current');
  assert.ok(back.includes('if (!PREVIEW || !firstTabOpen) return;'));
  assert.ok(back.includes("if (!btn || btn.hidden) to = { mode: 'current' };"), 'a tab this viewer does not have opens Current');
  assert.ok(back.includes('tabQuiet = true;') && back.includes('finally { tabQuiet = false; }'));
  // The other session's two lines that open Page Health by its address are as it left them.
  assert.ok(html.includes("if (ownerTabWanted && healthData) { const want = ownerTabWanted; ownerTabWanted = ''; setMode(want); }"));
});

test('3. the box on Current is named for what it does, on the test site; a followed turn leads to its history', () => {
  assert.ok(html.includes('<label for="turn">Find a turn</label>'), 'the page as published still says Find a turn');
  assert.ok(html.includes("if (lbl) lbl.textContent = PREVIEW ? 'Follow a turn (alerts)' : 'Find a turn';"));
  assert.ok(html.includes('siteReviewPaint(); // whole-site review 2026-11-12'));
  // The card under the box: a button to Turn History for that turn (or the person's own code), test site only.
  assert.ok(html.includes("const hist = PREVIEW ? `<div><button type=\"button\" class=\"hist\" data-hist=\"${esc(entry)}\">Turn History →</button></div>` : '';"));
  assert.ok(html.includes("box.querySelectorAll('[data-hist]').forEach((b) => { b.onclick = () => { const x = b.dataset.hist; setFocus(isPerson(x) ? (codes()[x] || nowTurn(x)) : x); setMode('turns'); window.scrollTo(0, 0); }; });"));
  // Snapshots (a past check): no alert box and no instructions above it; the followed turns' card after the hours.
  const snap = 'body.preview-site:not(.current):not(.orders):not(.turns) .rail';
  assert.ok(style.includes(`${snap} .turnpick > label,`) && style.includes(`${snap} .turnpick > .row,`) && style.includes(`${snap} .turnpick > .turnhelp { display: none; }`));
  assert.ok(style.includes(`${snap} .turnpick { order: 9;`));
  assert.ok(!/\n\s*(body:not|:not\(\.current\))[^{]*\.turnpick[^{]*\{ display: none/.test(style), 'nothing hides the box without the test-site class');
});

test('5. the pinned strip is drawn on the test site only', () => {
  const paint = cut('  function pinPaint() {', '  { let queued = false;');
  assert.ok(paint.includes('const show = PREVIEW && !!top && top.getBoundingClientRect().bottom < 0;'), 'only once the tab bar is off the top');
  assert.ok(paint.includes('if (!show) return;'), 'nothing is added to the page until then');
  assert.ok(paint.includes("el.querySelector('.pintop').onclick = () => { pinClose(); window.scrollTo(0, 0); };"));
  // Its list of tabs is the page's own tab buttons, less the ones this viewer does not have; a tap presses the real one.
  assert.ok(html.includes("function pinTabs() { return [...document.querySelectorAll('.top .modes button')].filter((b) => !b.hidden); }"));
  assert.ok(paint.includes('const t = document.getElementById(b.dataset.tab); if (t) t.click();'));
  assert.ok(html.includes('pinPaint(); // the pinned strip names the open tab (test site)'));
  // Full rows, never a sideways row (the owner, 2026-11-10: "fix the tabs at the top so they don't run off the screen").
  assert.ok(style.includes('.pin .pinmenu .modes, body.nav-one-row .pin .pinmenu .modes { display: flex; flex-wrap: wrap;'));
  // Room for it above a box that is jumped to, and under it for what already sticks to the top.
  assert.ok(html.includes("document.documentElement.style.scrollPaddingTop = PREVIEW ? '56px' : '';"));
  assert.ok(style.includes('body.preview-site .rail { top: 64px; }') && style.includes('body.preview-site .arrangebar.on { top: 50px; }'));
});

test('6. My stats: its sections as a folded list of jump buttons, test site only', () => {
  const ctx = vm.createContext({ esc });
  vm.runInContext(`${cut('  function mineJumpHtml(secs, open) {', '  function mineJump(view) {')}; this.mineJumpHtml = mineJumpHtml;`, ctx);
  const secs = [{ id: 'ms-time', name: 'Where the time went' }, { id: 'ms-days', name: 'Your days, hour by hour' }, { id: 'ms-trips', name: 'Every trip <b>' }];
  const shut = ctx.mineJumpHtml(secs, false);
  assert.ok(shut.startsWith('<details class="msjump"><summary>Jump to a section (3)</summary>'));
  assert.equal(shut.split('data-msjump="').length - 1, 3);
  assert.ok(shut.includes('<button type="button" class="ms-btn" data-msjump="ms-time">Where the time went</button>'));
  assert.ok(shut.includes('Every trip &lt;b&gt;'), 'a heading is written as words');
  assert.ok(ctx.mineJumpHtml(secs, true).startsWith('<details class="msjump" open>'));
  assert.ok(html.includes('if (PREVIEW) mineJump(view); // whole-site review 2026-11-12, item 6 (test site)'));
  const jump = cut('  function mineJump(view) {', '  // -----');
  assert.ok(jump.includes("view.querySelectorAll('section.ms-sec[id]')"), 'from the sections My stats itself drew');
  assert.ok(jump.includes("if (!head || secs.length < 4 || view.querySelector('.msjump')) return;"));
  assert.ok(fs.readFileSync(require.resolve('../../public/board-mystats.js'), 'utf8').includes('<section class="ms-sec" id="ms-${id}"><h3>${heading}</h3>'), 'My stats still marks its sections that way');
});

test('7. Analytics: the section row wraps and Overview is a line a page, test site only', () => {
  // The row: one sideways row for a member (the layout he approved 2026-11-10), full rows on the test site.
  assert.ok(style.includes('.ana2 .anatabs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }'));
  assert.ok(style.includes('body.preview-site .ana2 .anatabs { flex-wrap: wrap; overflow-x: visible;'));
  // Overview.
  const ANA_SECS = [['overview', 'Overview'], ['week', 'My week'], ['trains', 'Trains'], ['turns', 'Turns side by side'], ['sleep', 'Call stability'], ['assignments', 'Assignment errors'], ['stale', 'Stale trains'], ['likely', 'Likely-call test']];
  const ctx = vm.createContext({ esc, ANA_SECS });
  vm.runInContext(`${cut('function analyticsOverviewGuide(', 'function analyticsOverview(o) {')}; this.guide = analyticsOverviewGuide;`, ctx);
  const numbers = { trains: '510 trains on duty in these dates', sleep: '45% called when expected (490 of 1083 calls)', stale: '118 trains left waiting past the call', assignments: '35 findings not cleared' };
  const full = ctx.guide({ numbers });
  const compact = ctx.guide({ numbers, compact: true });
  assert.ok(!full.includes('ov2'), 'a member’s Overview is the guide as it was');
  assert.ok(compact.startsWith('<section class="sheet overview-guide"><header><h2>Analytics pages</h2>'));
  const lines = compact.slice(0, compact.indexOf('<details class="ov2-more">'));
  // A line for each page that has a card in the guide (the likely-call test has none), each opening its page.
  for (const key of ['week', 'trains', 'turns', 'sleep', 'assignments', 'stale']) assert.equal(lines.split(`data-overview-open="${key}"`).length - 1, 1, key);
  assert.ok(!lines.includes('data-overview-open="overview"') && !lines.includes('data-overview-open="likely"'));
  assert.ok(lines.includes('<b>Trains</b><span>510 trains on duty in these dates</span>'), 'its figure when it has one');
  assert.ok(lines.includes('<b>My week</b><span>Your week at a glance.</span>'), 'else the question it answers');
  // Nothing he approved on 2026-11-08 is lost: the whole guide is folded underneath, word for word.
  assert.ok(compact.endsWith(`<details class="ov2-more"><summary>What each page answers, and using the records</summary>${full}</details>`));
  assert.ok(html.includes('return analyticsOverviewGuide({ compact: PREVIEW, numbers: {'));
  assert.ok(html.includes("view.querySelectorAll('[data-overview-open]').forEach(button => { button.onclick = () => { ana.q = ''; ana.kind = 'auto'; ana.sec = button.dataset.overviewOpen; renderAnalytics(); }; });"), 'the lines open pages the way the cards do');
});

test('left as they are at his word: the site’s name (item 2) and the order of Settings (item 11)', () => {
  assert.ok(html.includes('<title>Line-up Snapshots</title>') && html.includes('<h1>Line-up Snapshots</h1>'));
  const settings = cut('<div class="settings" id="settings"', '<div class="signnote');
  const order = ['<h2>Profile</h2>', '<h2 id="styhead">Page style</h2>'].map((x) => settings.indexOf(x));
  assert.ok(order[0] > 0 && order[1] > order[0], 'Profile, then Page style');
});
